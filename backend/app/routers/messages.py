"""
Student Direct Messages Router

Full-featured student-to-student messaging with:
- Per-user rate limiting (MongoDB-backed, survives restarts)
- Block list (mutual block enforcement)
- Message requests (first message -> pending request; recipient must accept)
- Report + auto-mute (flag messages -> admin review -> mute sender for N days)
- Connections / follow system (mutual follow required to DM)

Collections used:
  - direct_messages       - individual messages
  - dm_blocks             - block list entries {blockerId, blockedId}
  - dm_connections        - follow / connection requests {fromUserId, toUserId, status}
  - dm_message_requests   - first-contact requests {senderId, recipientId, status, message}
  - dm_reports            - abuse reports {reporterId, reportedUserId, conversationKey, reason, ...}
  - dm_mutes              - muted users {userId, mutedUntil, reason}
  - dm_rate_limits        - per-user message counters {userId, windowKey, count}
"""

from datetime import datetime, timezone, timedelta
from typing import Optional, List

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query, WebSocket, WebSocketDisconnect, UploadFile, File, Form
from pydantic import BaseModel, Field
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.core.security import get_current_user, require_ipe_student
from app.core.permissions import require_permission
from app.core.security import verify_firebase_id_token_raw
from app.db import get_database

router = APIRouter(
    prefix="/api/v1/messages",
    tags=["Messages"],
    dependencies=[Depends(require_ipe_student)],
)


# --- Configuration -------------------------------------------------

RATE_LIMIT_PER_MINUTE = 15          # max messages per minute per user
RATE_LIMIT_PER_HOUR = 120           # max messages per hour
MUTE_DURATION_DAYS_DEFAULT = 7      # default mute duration
MESSAGE_MAX_LENGTH = 2000


# --- Pydantic Models -----------------------------------------------

class SendMessageBody(BaseModel):
    recipientId: str
    content: str = Field("", max_length=MESSAGE_MAX_LENGTH)
    replyToId: Optional[str] = None


class BlockUserBody(BaseModel):
    userId: str


class ConnectionRequestBody(BaseModel):
    userId: str


class ReportBody(BaseModel):
    reportedUserId: str
    messageIds: List[str] = Field(default_factory=list, max_length=20)
    reason: str = Field(..., min_length=5, max_length=1000)


class MuteUserBody(BaseModel):
    userId: str
    days: int = Field(default=MUTE_DURATION_DAYS_DEFAULT, ge=1, le=365)
    reason: str = Field(default="", max_length=500)


class ReviewReportBody(BaseModel):
    action: str = Field(..., pattern=r"^(dismiss|warn|mute)$")
    muteDays: int = Field(default=MUTE_DURATION_DAYS_DEFAULT, ge=1, le=365)
    adminNote: str = Field(default="", max_length=500)


class AcceptRequestBody(BaseModel):
    action: str = Field(..., pattern=r"^(accept|decline)$")


class ReactionBody(BaseModel):
    emoji: str = Field(..., min_length=1, max_length=8)


# --- Constants: Allowed reaction emojis & limits ---
ALLOWED_REACTIONS = {"👍", "❤️", "😂", "😮", "😢", "🔥", "👎", "🎉"}
MAX_REACTIONS_PER_MESSAGE = 50
MAX_PINNED_PER_CONVERSATION = 25
DELETE_WINDOW_MINUTES = 5
ATTACHMENT_MAX_SIZE_MB = 10


# --- Helpers -------------------------------------------------------

def _conversation_key(uid_a: str, uid_b: str) -> str:
    """Deterministic conversation key regardless of sender/recipient order."""
    return "|".join(sorted([uid_a, uid_b]))


async def _check_rate_limit(db: AsyncIOMotorDatabase, user_id: str) -> None:
    """
    Per-user rate limiting backed by MongoDB.
    Uses minute and hour windows (UTC-aligned).
    """
    now = datetime.now(timezone.utc)
    minute_key = f"{user_id}:{now.strftime('%Y%m%d%H%M')}"
    hour_key = f"{user_id}:{now.strftime('%Y%m%d%H')}"

    # Atomic increment-and-read for minute window
    minute_doc = await db["dm_rate_limits"].find_one_and_update(
        {"_id": minute_key},
        {"$inc": {"count": 1}, "$setOnInsert": {"createdAt": now}},
        upsert=True,
        return_document=True,
    )
    if minute_doc and minute_doc.get("count", 0) > RATE_LIMIT_PER_MINUTE:
        raise HTTPException(
            status_code=429,
            detail=f"Rate limit exceeded. Maximum {RATE_LIMIT_PER_MINUTE} messages per minute.",
        )

    # Atomic increment-and-read for hour window
    hour_doc = await db["dm_rate_limits"].find_one_and_update(
        {"_id": hour_key},
        {"$inc": {"count": 1}, "$setOnInsert": {"createdAt": now}},
        upsert=True,
        return_document=True,
    )
    if hour_doc and hour_doc.get("count", 0) > RATE_LIMIT_PER_HOUR:
        raise HTTPException(
            status_code=429,
            detail=f"Rate limit exceeded. Maximum {RATE_LIMIT_PER_HOUR} messages per hour.",
        )


async def _check_block(db: AsyncIOMotorDatabase, user_a: str, user_b: str) -> None:
    """Raise if either user has blocked the other."""
    block = await db["dm_blocks"].find_one({
        "$or": [
            {"blockerId": user_a, "blockedId": user_b},
            {"blockerId": user_b, "blockedId": user_a},
        ]
    })
    if block:
        raise HTTPException(status_code=403, detail="Unable to send message to this user")


async def _check_mute(db: AsyncIOMotorDatabase, user_id: str) -> None:
    """Raise if user is muted."""
    now = datetime.now(timezone.utc)
    mute = await db["dm_mutes"].find_one({
        "userId": user_id,
        "mutedUntil": {"$gt": now},
    })
    if mute:
        until = mute["mutedUntil"].strftime("%b %d, %Y")
        raise HTTPException(
            status_code=403,
            detail=f"Your messaging privileges are suspended until {until}.",
        )


async def _are_connected(db: AsyncIOMotorDatabase, user_a: str, user_b: str) -> bool:
    """Check if two users have an accepted mutual connection."""
    conn = await db["dm_connections"].find_one({
        "$or": [
            {"fromUserId": user_a, "toUserId": user_b, "status": "accepted"},
            {"fromUserId": user_b, "toUserId": user_a, "status": "accepted"},
        ]
    })
    return conn is not None


async def _has_pending_request(db: AsyncIOMotorDatabase, sender_id: str, recipient_id: str) -> bool:
    """Check if there is already a pending message request."""
    req = await db["dm_message_requests"].find_one({
        "senderId": sender_id,
        "recipientId": recipient_id,
        "status": "pending",
    })
    return req is not None


async def _user_brief(db: AsyncIOMotorDatabase, user_id: str) -> dict:
    """Get minimal user info."""
    if not ObjectId.is_valid(user_id):
        return {"id": user_id, "name": "Unknown", "email": ""}
    u = await db["users"].find_one(
        {"_id": ObjectId(user_id)},
        {"firstName": 1, "lastName": 1, "email": 1, "currentLevel": 1, "level": 1},
    )
    if not u:
        return {"id": user_id, "name": "Unknown", "email": ""}
    return {
        "id": user_id,
        "name": f"{u.get('firstName', '')} {u.get('lastName', '')}".strip(),
        "email": u.get("email", ""),
        "level": u.get("currentLevel") or u.get("level"),
    }


# --- WebSocket DM Manager -----------------------------------------

class DMManager:
    """Maintains active WebSocket connections per user for real-time DM delivery."""

    def __init__(self):
        self.connections: dict[str, list[WebSocket]] = {}  # user_id -> [ws, ...]

    async def connect(self, user_id: str, ws: WebSocket):
        await ws.accept()
        self.connections.setdefault(user_id, []).append(ws)

    def disconnect(self, user_id: str, ws: WebSocket):
        if user_id in self.connections:
            self.connections[user_id] = [c for c in self.connections[user_id] if c is not ws]
            if not self.connections[user_id]:
                del self.connections[user_id]

    async def notify(self, user_id: str, data: dict):
        """Push a message event to all connected sockets for this user."""
        for ws in list(self.connections.get(user_id, [])):
            try:
                await ws.send_json(data)
            except Exception:
                pass


dm_manager = DMManager()


# ===================================================================
# CONNECTIONS (Follow / Connect)
# ===================================================================

@router.post("/connections/request")
async def send_connection_request(
    body: ConnectionRequestBody,
    user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    """Send a connection request to another student."""
    sender_id = str(user["_id"])
    target_id = body.userId

    if sender_id == target_id:
        raise HTTPException(status_code=400, detail="Cannot connect with yourself")
    if not ObjectId.is_valid(target_id):
        raise HTTPException(status_code=400, detail="Invalid user ID")

    # Check block
    await _check_block(db, sender_id, target_id)

    # Check if target exists
    target = await db["users"].find_one({"_id": ObjectId(target_id)}, {"_id": 1})
    if not target:
        raise HTTPException(status_code=404, detail="User not found")

    # Check if already connected or pending
    existing = await db["dm_connections"].find_one({
        "$or": [
            {"fromUserId": sender_id, "toUserId": target_id},
            {"fromUserId": target_id, "toUserId": sender_id},
        ]
    })
    if existing:
        if existing["status"] == "accepted":
            raise HTTPException(status_code=400, detail="Already connected")
        if existing["status"] == "pending":
            # If the OTHER person already sent a request to ME, auto-accept
            if existing["fromUserId"] == target_id:
                await db["dm_connections"].update_one(
                    {"_id": existing["_id"]},
                    {"$set": {"status": "accepted", "acceptedAt": datetime.now(timezone.utc)}},
                )
                await dm_manager.notify(target_id, {
                    "type": "connection_accepted",
                    "data": {"userId": sender_id, "userName": f"{user.get('firstName', '')} {user.get('lastName', '')}".strip()},
                })
                return {"status": "accepted", "message": "Connection established"}
            # I already sent a request to them
            raise HTTPException(status_code=400, detail="Connection request already sent")
        if existing["status"] == "declined":
            # Allow re-requesting if previously declined
            await db["dm_connections"].update_one(
                {"_id": existing["_id"]},
                {"$set": {
                    "fromUserId": sender_id,
                    "toUserId": target_id,
                    "status": "pending",
                    "createdAt": datetime.now(timezone.utc),
                }},
            )
            await dm_manager.notify(target_id, {
                "type": "connection_request",
                "data": {"userId": sender_id, "userName": f"{user.get('firstName', '')} {user.get('lastName', '')}".strip()},
            })
            return {"status": "pending", "message": "Connection request sent"}

    # Create new request
    now = datetime.now(timezone.utc)
    await db["dm_connections"].insert_one({
        "fromUserId": sender_id,
        "toUserId": target_id,
        "status": "pending",
        "createdAt": now,
    })

    sender_name = f"{user.get('firstName', '')} {user.get('lastName', '')}".strip()
    await dm_manager.notify(target_id, {
        "type": "connection_request",
        "data": {"userId": sender_id, "userName": sender_name},
    })

    return {"status": "pending", "message": "Connection request sent"}


@router.post("/connections/{request_id}/respond")
async def respond_to_connection(
    request_id: str,
    body: AcceptRequestBody,
    user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    """Accept or decline a connection request."""
    user_id = str(user["_id"])

    if not ObjectId.is_valid(request_id):
        raise HTTPException(status_code=400, detail="Invalid request ID")

    conn = await db["dm_connections"].find_one({"_id": ObjectId(request_id)})
    if not conn:
        raise HTTPException(status_code=404, detail="Connection request not found")

    if conn["toUserId"] != user_id:
        raise HTTPException(status_code=403, detail="This request was not sent to you")

    if conn["status"] != "pending":
        raise HTTPException(status_code=400, detail="Request already handled")

    now = datetime.now(timezone.utc)
    new_status = "accepted" if body.action == "accept" else "declined"
    update = {"$set": {"status": new_status, f"{new_status}At": now}}
    await db["dm_connections"].update_one({"_id": ObjectId(request_id)}, update)

    other_id = conn["fromUserId"]
    user_name = f"{user.get('firstName', '')} {user.get('lastName', '')}".strip()

    if new_status == "accepted":
        await dm_manager.notify(other_id, {
            "type": "connection_accepted",
            "data": {"userId": user_id, "userName": user_name},
        })

    return {"status": new_status}


@router.get("/connections")
async def list_connections(
    user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    """List all accepted connections for the current user."""
    user_id = str(user["_id"])

    cursor = db["dm_connections"].find({
        "$or": [
            {"fromUserId": user_id, "status": "accepted"},
            {"toUserId": user_id, "status": "accepted"},
        ]
    }).sort("acceptedAt", -1)

    connections = []
    async for doc in cursor:
        other_id = doc["toUserId"] if doc["fromUserId"] == user_id else doc["fromUserId"]
        info = await _user_brief(db, other_id)
        connections.append({
            "connectionId": str(doc["_id"]),
            "user": info,
            "connectedAt": doc.get("acceptedAt", doc.get("createdAt")).isoformat() if doc.get("acceptedAt") or doc.get("createdAt") else None,
        })

    return connections


@router.get("/connections/pending")
async def list_pending_connections(
    user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    """List incoming pending connection requests."""
    user_id = str(user["_id"])

    cursor = db["dm_connections"].find({
        "toUserId": user_id,
        "status": "pending",
    }).sort("createdAt", -1).limit(50)

    requests = []
    async for doc in cursor:
        info = await _user_brief(db, doc["fromUserId"])
        requests.append({
            "requestId": str(doc["_id"]),
            "user": info,
            "createdAt": doc["createdAt"].isoformat(),
        })

    return requests


@router.get("/connections/sent")
async def list_sent_connections(
    user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    """List outgoing pending connection requests."""
    user_id = str(user["_id"])

    cursor = db["dm_connections"].find({
        "fromUserId": user_id,
        "status": "pending",
    }).sort("createdAt", -1).limit(50)

    requests = []
    async for doc in cursor:
        info = await _user_brief(db, doc["toUserId"])
        requests.append({
            "requestId": str(doc["_id"]),
            "user": info,
            "createdAt": doc["createdAt"].isoformat(),
        })

    return requests


@router.delete("/connections/{other_user_id}")
async def remove_connection(
    other_user_id: str,
    user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    """Remove an existing connection (unfriend)."""
    user_id = str(user["_id"])

    result = await db["dm_connections"].delete_one({
        "$or": [
            {"fromUserId": user_id, "toUserId": other_user_id, "status": "accepted"},
            {"fromUserId": other_user_id, "toUserId": user_id, "status": "accepted"},
        ]
    })

    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Connection not found")

    return {"removed": True}


@router.get("/connections/status/{other_user_id}")
async def get_connection_status(
    other_user_id: str,
    user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    """Get connection status with a specific user."""
    user_id = str(user["_id"])

    conn = await db["dm_connections"].find_one({
        "$or": [
            {"fromUserId": user_id, "toUserId": other_user_id},
            {"fromUserId": other_user_id, "toUserId": user_id},
        ]
    })

    if not conn:
        return {"status": "none", "direction": None}

    direction = "outgoing" if conn["fromUserId"] == user_id else "incoming"
    return {
        "status": conn["status"],
        "direction": direction,
        "requestId": str(conn["_id"]),
    }


# ===================================================================
# BLOCK LIST
# ===================================================================

@router.post("/block")
async def block_user(
    body: BlockUserBody,
    user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    """Block a user. Removes any existing connection."""
    user_id = str(user["_id"])
    target_id = body.userId

    if user_id == target_id:
        raise HTTPException(status_code=400, detail="Cannot block yourself")
    if not ObjectId.is_valid(target_id):
        raise HTTPException(status_code=400, detail="Invalid user ID")

    # Check if already blocked
    existing = await db["dm_blocks"].find_one({"blockerId": user_id, "blockedId": target_id})
    if existing:
        raise HTTPException(status_code=400, detail="User is already blocked")

    now = datetime.now(timezone.utc)
    await db["dm_blocks"].insert_one({
        "blockerId": user_id,
        "blockedId": target_id,
        "createdAt": now,
    })

    # Remove any connection between the two
    await db["dm_connections"].delete_many({
        "$or": [
            {"fromUserId": user_id, "toUserId": target_id},
            {"fromUserId": target_id, "toUserId": user_id},
        ]
    })

    # Cancel pending message requests
    await db["dm_message_requests"].update_many(
        {
            "$or": [
                {"senderId": user_id, "recipientId": target_id, "status": "pending"},
                {"senderId": target_id, "recipientId": user_id, "status": "pending"},
            ]
        },
        {"$set": {"status": "cancelled"}},
    )

    return {"blocked": True}


@router.delete("/block/{user_id_param}")
async def unblock_user(
    user_id_param: str,
    user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    """Unblock a user."""
    user_id = str(user["_id"])
    result = await db["dm_blocks"].delete_one({"blockerId": user_id, "blockedId": user_id_param})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Block not found")
    return {"unblocked": True}


@router.get("/blocked")
async def list_blocked_users(
    user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    """List all users the current user has blocked."""
    user_id = str(user["_id"])
    cursor = db["dm_blocks"].find({"blockerId": user_id}).sort("createdAt", -1)
    results = []
    async for doc in cursor:
        info = await _user_brief(db, doc["blockedId"])
        results.append({
            "blockId": str(doc["_id"]),
            "user": info,
            "blockedAt": doc["createdAt"].isoformat(),
        })
    return results


# ===================================================================
# MESSAGE REQUESTS (first-contact)
# ===================================================================

@router.get("/requests")
async def list_message_requests(
    user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    """List incoming message requests (people who want to start a conversation)."""
    user_id = str(user["_id"])

    cursor = db["dm_message_requests"].find({
        "recipientId": user_id,
        "status": "pending",
    }).sort("createdAt", -1).limit(50)

    requests = []
    async for doc in cursor:
        info = await _user_brief(db, doc["senderId"])
        requests.append({
            "requestId": str(doc["_id"]),
            "user": info,
            "message": doc.get("message", "")[:200],
            "createdAt": doc["createdAt"].isoformat(),
        })

    return requests


@router.get("/requests/count")
async def count_message_requests(
    user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    """Get count of pending message requests."""
    user_id = str(user["_id"])
    count = await db["dm_message_requests"].count_documents({
        "recipientId": user_id,
        "status": "pending",
    })
    return {"count": count}


@router.post("/requests/{request_id}/respond")
async def respond_to_message_request(
    request_id: str,
    body: AcceptRequestBody,
    user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    """Accept or decline a message request."""
    user_id = str(user["_id"])

    if not ObjectId.is_valid(request_id):
        raise HTTPException(status_code=400, detail="Invalid request ID")

    req = await db["dm_message_requests"].find_one({"_id": ObjectId(request_id)})
    if not req:
        raise HTTPException(status_code=404, detail="Message request not found")

    if req["recipientId"] != user_id:
        raise HTTPException(status_code=403, detail="Not your request")

    if req["status"] != "pending":
        raise HTTPException(status_code=400, detail="Request already handled")

    now = datetime.now(timezone.utc)
    new_status = "accepted" if body.action == "accept" else "declined"

    await db["dm_message_requests"].update_one(
        {"_id": ObjectId(request_id)},
        {"$set": {"status": new_status, f"{new_status}At": now}},
    )

    sender_id = req["senderId"]

    if new_status == "accepted":
        # Auto-create mutual connection so they can DM freely
        existing_conn = await db["dm_connections"].find_one({
            "$or": [
                {"fromUserId": sender_id, "toUserId": user_id},
                {"fromUserId": user_id, "toUserId": sender_id},
            ]
        })
        if not existing_conn:
            await db["dm_connections"].insert_one({
                "fromUserId": sender_id,
                "toUserId": user_id,
                "status": "accepted",
                "createdAt": now,
                "acceptedAt": now,
            })

        # If the request included a message, insert it as a real DM
        if req.get("message"):
            conv_key = _conversation_key(sender_id, user_id)
            await db["direct_messages"].insert_one({
                "conversationKey": conv_key,
                "senderId": sender_id,
                "recipientId": user_id,
                "content": req["message"],
                "isRead": False,
                "createdAt": req["createdAt"],
            })

        user_name = f"{user.get('firstName', '')} {user.get('lastName', '')}".strip()
        await dm_manager.notify(sender_id, {
            "type": "message_request_accepted",
            "data": {"userId": user_id, "userName": user_name},
        })

    return {"status": new_status}


# ===================================================================
# REPORT + MUTE
# ===================================================================

@router.post("/report")
async def report_user(
    body: ReportBody,
    user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    """Report a user for abusive messaging behaviour."""
    reporter_id = str(user["_id"])
    reported_id = body.reportedUserId

    if reporter_id == reported_id:
        raise HTTPException(status_code=400, detail="Cannot report yourself")
    if not ObjectId.is_valid(reported_id):
        raise HTTPException(status_code=400, detail="Invalid user ID")

    # Check for duplicate recent report (don't spam)
    one_day_ago = datetime.now(timezone.utc) - timedelta(days=1)
    existing = await db["dm_reports"].find_one({
        "reporterId": reporter_id,
        "reportedUserId": reported_id,
        "createdAt": {"$gt": one_day_ago},
    })
    if existing:
        raise HTTPException(status_code=400, detail="You already reported this user recently")

    conv_key = _conversation_key(reporter_id, reported_id)

    # Gather evidence: fetch the reported message contents
    evidence_messages = []
    if body.messageIds:
        valid_ids = [ObjectId(mid) for mid in body.messageIds if ObjectId.is_valid(mid)]
        if valid_ids:
            cursor = db["direct_messages"].find({
                "_id": {"$in": valid_ids},
                "conversationKey": conv_key,
            }).limit(20)
            async for msg in cursor:
                evidence_messages.append({
                    "id": str(msg["_id"]),
                    "senderId": msg["senderId"],
                    "content": msg["content"],
                    "createdAt": msg["createdAt"].isoformat(),
                })

    now = datetime.now(timezone.utc)
    await db["dm_reports"].insert_one({
        "reporterId": reporter_id,
        "reportedUserId": reported_id,
        "conversationKey": conv_key,
        "reason": body.reason.strip(),
        "evidenceMessages": evidence_messages,
        "status": "pending",
        "adminAction": None,
        "adminNote": "",
        "reviewedBy": None,
        "reviewedAt": None,
        "createdAt": now,
    })

    return {"reported": True, "message": "Report submitted. An admin will review it."}


@router.get("/mute-status")
async def get_mute_status(
    user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    """Check if the current user is muted."""
    user_id = str(user["_id"])
    now = datetime.now(timezone.utc)
    mute = await db["dm_mutes"].find_one({
        "userId": user_id,
        "mutedUntil": {"$gt": now},
    })
    if mute:
        return {
            "muted": True,
            "mutedUntil": mute["mutedUntil"].isoformat(),
            "reason": mute.get("reason", ""),
        }
    return {"muted": False}


# ===================================================================
# ADMIN: Report Review + Mute Management
# ===================================================================

_admin_router = APIRouter(
    prefix="/api/v1/admin/messages",
    tags=["Admin Messages"],
)


@_admin_router.get("/reports")
async def list_reports(
    status_filter: str = Query("pending", pattern=r"^(pending|reviewed|all)$"),
    user: dict = Depends(require_permission("messages:manage")),
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    """Admin: list message abuse reports."""
    query: dict = {}
    if status_filter != "all":
        query["status"] = status_filter

    cursor = db["dm_reports"].find(query).sort("createdAt", -1).limit(100)

    reports = []
    async for doc in cursor:
        reporter_info = await _user_brief(db, doc["reporterId"])
        reported_info = await _user_brief(db, doc["reportedUserId"])
        reports.append({
            "id": str(doc["_id"]),
            "reporter": reporter_info,
            "reportedUser": reported_info,
            "reason": doc["reason"],
            "evidenceMessages": doc.get("evidenceMessages", []),
            "status": doc["status"],
            "adminAction": doc.get("adminAction"),
            "adminNote": doc.get("adminNote", ""),
            "reviewedBy": doc.get("reviewedBy"),
            "reviewedAt": doc.get("reviewedAt", ""),
            "createdAt": doc["createdAt"].isoformat(),
        })

    return reports


@_admin_router.post("/reports/{report_id}/review")
async def review_report(
    report_id: str,
    body: ReviewReportBody,
    user: dict = Depends(require_permission("messages:manage")),
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    """Admin: review a report. Actions: dismiss, warn, mute."""
    if not ObjectId.is_valid(report_id):
        raise HTTPException(status_code=400, detail="Invalid report ID")

    report = await db["dm_reports"].find_one({"_id": ObjectId(report_id)})
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    if report["status"] == "reviewed":
        raise HTTPException(status_code=400, detail="Report already reviewed")

    admin_id = str(user["_id"])
    now = datetime.now(timezone.utc)

    await db["dm_reports"].update_one(
        {"_id": ObjectId(report_id)},
        {"$set": {
            "status": "reviewed",
            "adminAction": body.action,
            "adminNote": body.adminNote,
            "reviewedBy": admin_id,
            "reviewedAt": now,
        }},
    )

    reported_user_id = report["reportedUserId"]

    if body.action == "mute":
        mute_until = now + timedelta(days=body.muteDays)
        # Upsert: extend mute if already muted
        await db["dm_mutes"].update_one(
            {"userId": reported_user_id},
            {"$set": {
                "mutedUntil": mute_until,
                "reason": body.adminNote or f"Muted by admin for {body.muteDays} days",
                "mutedBy": admin_id,
                "createdAt": now,
            }},
            upsert=True,
        )
        # Notify the muted user
        await dm_manager.notify(reported_user_id, {
            "type": "muted",
            "data": {
                "mutedUntil": mute_until.isoformat(),
                "days": body.muteDays,
            },
        })

    return {"reviewed": True, "action": body.action}


@_admin_router.get("/muted-users")
async def list_muted_users(
    user: dict = Depends(require_permission("messages:manage")),
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    """Admin: list currently muted users."""
    now = datetime.now(timezone.utc)
    cursor = db["dm_mutes"].find({"mutedUntil": {"$gt": now}}).sort("mutedUntil", -1)

    results = []
    async for doc in cursor:
        info = await _user_brief(db, doc["userId"])
        results.append({
            "user": info,
            "mutedUntil": doc["mutedUntil"].isoformat(),
            "reason": doc.get("reason", ""),
            "mutedBy": doc.get("mutedBy", ""),
        })
    return results


@_admin_router.delete("/muted-users/{target_user_id}")
async def unmute_user(
    target_user_id: str,
    user: dict = Depends(require_permission("messages:manage")),
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    """Admin: unmute a user."""
    result = await db["dm_mutes"].delete_one({"userId": target_user_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="User is not muted")
    return {"unmuted": True}


# ===================================================================
# MESSAGING ENDPOINTS
# ===================================================================

@router.post("/send")
async def send_message(
    body: SendMessageBody,
    user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    """
    Send a direct message to another student.

    Flow:
    1. Check rate limit
    2. Check mute status
    3. Check block list
    4. Check connection status:
       - If connected -> send directly
       - If NOT connected -> create a message request instead
    """
    sender_id = str(user["_id"])
    recipient_id = body.recipientId

    if sender_id == recipient_id:
        raise HTTPException(status_code=400, detail="Cannot message yourself")
    if not ObjectId.is_valid(recipient_id):
        raise HTTPException(status_code=400, detail="Invalid recipient ID")

    # 1. Rate limit
    await _check_rate_limit(db, sender_id)

    # 2. Mute check
    await _check_mute(db, sender_id)

    # 3. Block check
    await _check_block(db, sender_id, recipient_id)

    # Verify recipient exists
    recipient = await db["users"].find_one(
        {"_id": ObjectId(recipient_id)},
        {"firstName": 1, "lastName": 1},
    )
    if not recipient:
        raise HTTPException(status_code=404, detail="Recipient not found")

    # 4. Connection check
    connected = await _are_connected(db, sender_id, recipient_id)

    if not connected:
        # Not connected -- create a message request instead
        already_pending = await _has_pending_request(db, sender_id, recipient_id)
        if already_pending:
            raise HTTPException(
                status_code=400,
                detail="You already have a pending message request to this user. Wait for them to accept.",
            )

        # Check if recipient previously declined
        prev_declined = await db["dm_message_requests"].find_one({
            "senderId": sender_id,
            "recipientId": recipient_id,
            "status": "declined",
            "declinedAt": {"$gt": datetime.now(timezone.utc) - timedelta(days=7)},
        })
        if prev_declined:
            raise HTTPException(
                status_code=400,
                detail="This user declined your message request recently. Try again later.",
            )

        now = datetime.now(timezone.utc)
        await db["dm_message_requests"].insert_one({
            "senderId": sender_id,
            "recipientId": recipient_id,
            "message": body.content.strip(),
            "status": "pending",
            "createdAt": now,
        })

        sender_name = f"{user.get('firstName', '')} {user.get('lastName', '')}".strip()
        await dm_manager.notify(recipient_id, {
            "type": "message_request",
            "data": {
                "senderId": sender_id,
                "senderName": sender_name,
                "preview": body.content.strip()[:100],
            },
        })

        return {
            "id": None,
            "conversationKey": None,
            "createdAt": now.isoformat(),
            "messageRequest": True,
            "message": "Message request sent. They need to accept before you can chat.",
        }

    # Connected -- send the message directly
    conv_key = _conversation_key(sender_id, recipient_id)
    now = datetime.now(timezone.utc)

    # Require content or at least a reply reference (allows empty content if attachment sent separately)
    if not body.content.strip() and not body.replyToId:
        raise HTTPException(status_code=400, detail="Message content is required")

    doc = {
        "conversationKey": conv_key,
        "senderId": sender_id,
        "recipientId": recipient_id,
        "content": body.content.strip(),
        "isRead": False,
        "createdAt": now,
    }

    # Handle reply
    if body.replyToId:
        if not ObjectId.is_valid(body.replyToId):
            raise HTTPException(status_code=400, detail="Invalid replyToId")
        original = await db["direct_messages"].find_one(
            {"_id": ObjectId(body.replyToId), "conversationKey": conv_key},
            {"content": 1, "senderId": 1, "attachments": 1},
        )
        if original:
            reply_sender = await _user_brief(db, original["senderId"])
            doc["replyTo"] = {
                "id": body.replyToId,
                "content": (original.get("content") or "")[:200],
                "senderName": reply_sender.get("name", "Unknown"),
                "senderId": original["senderId"],
            }
            # Include attachment info in reply preview if original had attachments
            if original.get("attachments"):
                doc["replyTo"]["hasAttachment"] = True

    result = await db["direct_messages"].insert_one(doc)

    # Real-time delivery via WebSocket
    sender_name = f"{user.get('firstName', '')} {user.get('lastName', '')}".strip()
    ws_payload = {
        "type": "new_message",
        "data": {
            "id": str(result.inserted_id),
            "conversationKey": conv_key,
            "senderId": sender_id,
            "senderName": sender_name,
            "recipientId": recipient_id,
            "content": body.content.strip(),
            "isRead": False,
            "createdAt": now.isoformat(),
            "replyTo": doc.get("replyTo"),
            "attachments": doc.get("attachments", []),
        },
    }
    await dm_manager.notify(recipient_id, ws_payload)
    await dm_manager.notify(sender_id, ws_payload)

    return {
        "id": str(result.inserted_id),
        "conversationKey": conv_key,
        "createdAt": now.isoformat(),
        "messageRequest": False,
    }


@router.get("/conversations")
async def list_conversations(
    user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    """List all conversations for the current user, with last message preview."""
    user_id = str(user["_id"])

    pipeline = [
        {
            "$match": {
                "$or": [{"senderId": user_id}, {"recipientId": user_id}],
            }
        },
        {"$sort": {"createdAt": -1}},
        {
            "$group": {
                "_id": "$conversationKey",
                "lastMessage": {"$first": "$content"},
                "lastAttachments": {"$first": "$attachments"},
                "lastSenderId": {"$first": "$senderId"},
                "lastAt": {"$first": "$createdAt"},
                "lastDeletedAt": {"$first": "$deletedAt"},
                "unreadCount": {
                    "$sum": {
                        "$cond": [
                            {"$and": [
                                {"$eq": ["$recipientId", user_id]},
                                {"$eq": ["$isRead", False]},
                            ]},
                            1,
                            0,
                        ]
                    }
                },
            }
        },
        {"$sort": {"lastAt": -1}},
        {"$limit": 50},
    ]

    # Collect all other-user IDs first, then batch fetch
    raw_convs = []
    other_ids = set()
    async for doc in db["direct_messages"].aggregate(pipeline):
        conv_key: str = doc["_id"]
        parts = conv_key.split("|")
        other_id = parts[1] if parts[0] == user_id else parts[0]
        other_ids.add(other_id)
        raw_convs.append((doc, other_id))

    # Batch fetch user info
    user_map: dict[str, dict] = {}
    if other_ids:
        oids = [ObjectId(oid) for oid in other_ids if ObjectId.is_valid(oid)]
        if oids:
            async for u in db["users"].find(
                {"_id": {"$in": oids}},
                {"firstName": 1, "lastName": 1, "email": 1},
            ):
                uid = str(u["_id"])
                user_map[uid] = {
                    "name": f"{u.get('firstName', '')} {u.get('lastName', '')}".strip(),
                    "email": u.get("email", ""),
                }

    # Also check blocks
    blocked_ids = set()
    async for b in db["dm_blocks"].find({"blockerId": user_id}, {"blockedId": 1}):
        blocked_ids.add(b["blockedId"])

    conversations = []
    for doc, other_id in raw_convs:
        info = user_map.get(other_id, {"name": "Unknown", "email": ""})
        last_msg = doc["lastMessage"][:100] if doc.get("lastMessage") else ""
        # Fallback: attachment-only message → show label
        if not last_msg and doc.get("lastAttachments"):
            last_msg = "Sent an attachment"
        # Check if last message was deleted
        if doc.get("lastDeletedAt"):
            last_msg = "This message was deleted"
        conversations.append({
            "conversationKey": doc["_id"],
            "otherUserId": other_id,
            "otherUserName": info["name"],
            "otherUserEmail": info["email"],
            "lastMessage": last_msg,
            "lastSenderId": doc["lastSenderId"],
            "lastAt": doc["lastAt"].isoformat() if doc["lastAt"] else None,
            "unreadCount": doc["unreadCount"],
            "isBlocked": other_id in blocked_ids,
        })

    return conversations


@router.get("/conversation/{other_user_id}")
async def get_conversation(
    other_user_id: str,
    page: int = Query(1, ge=1),
    pageSize: int = Query(30, ge=1, le=100),
    user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    """Get messages in a conversation with another user."""
    if not ObjectId.is_valid(other_user_id):
        raise HTTPException(status_code=400, detail="Invalid user ID")

    user_id = str(user["_id"])
    conv_key = _conversation_key(user_id, other_user_id)

    skip = (page - 1) * pageSize
    cursor = (
        db["direct_messages"]
        .find({"conversationKey": conv_key})
        .sort("createdAt", -1)
        .skip(skip)
        .limit(pageSize)
    )

    messages = []
    async for doc in cursor:
        msg = {
            "id": str(doc["_id"]),
            "senderId": doc["senderId"],
            "recipientId": doc["recipientId"],
            "content": doc["content"] if not doc.get("deletedAt") else "",
            "isRead": doc.get("isRead", False),
            "createdAt": doc["createdAt"].isoformat(),
            "readAt": doc["readAt"].isoformat() if doc.get("readAt") else None,
            "deletedAt": doc["deletedAt"].isoformat() if doc.get("deletedAt") else None,
            "replyTo": doc.get("replyTo"),
            "attachments": doc.get("attachments", []),
            "reactions": doc.get("reactions", []),
            "isPinned": doc.get("isPinned", False),
        }
        messages.append(msg)

    messages.reverse()

    other_user = await db["users"].find_one(
        {"_id": ObjectId(other_user_id)},
        {"firstName": 1, "lastName": 1, "email": 1},
    )

    # Include connection + block status
    connected = await _are_connected(db, user_id, other_user_id)
    block = await db["dm_blocks"].find_one({
        "$or": [
            {"blockerId": user_id, "blockedId": other_user_id},
            {"blockerId": other_user_id, "blockedId": user_id},
        ]
    })

    return {
        "messages": messages,
        "otherUser": {
            "id": other_user_id,
            "name": f"{other_user.get('firstName', '')} {other_user.get('lastName', '')}".strip() if other_user else "Unknown",
            "email": other_user.get("email", "") if other_user else "",
        },
        "isConnected": connected,
        "isBlocked": block is not None,
        "blockedByMe": block is not None and block.get("blockerId") == user_id if block else False,
    }


@router.post("/conversation/{other_user_id}/read")
async def mark_conversation_read(
    other_user_id: str,
    user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    """Mark all messages from the other user as read."""
    if not ObjectId.is_valid(other_user_id):
        raise HTTPException(status_code=400, detail="Invalid user ID")

    user_id = str(user["_id"])
    conv_key = _conversation_key(user_id, other_user_id)

    now = datetime.now(timezone.utc)
    result = await db["direct_messages"].update_many(
        {"conversationKey": conv_key, "recipientId": user_id, "isRead": False},
        {"$set": {"isRead": True, "readAt": now}},
    )

    if result.modified_count > 0:
        await dm_manager.notify(other_user_id, {
            "type": "messages_read",
            "data": {
                "conversationKey": conv_key,
                "readBy": user_id,
                "count": result.modified_count,
                "readAt": now.isoformat(),
            },
        })

    return {"markedRead": result.modified_count}


@router.get("/search-users")
async def search_users_for_messaging(
    q: str = Query(..., min_length=2, max_length=100),
    user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    """Search for students to start a conversation with."""
    import re

    user_id = str(user["_id"])
    escaped = re.escape(q.strip())
    pattern = re.compile(escaped, re.IGNORECASE)

    # Get blocked user IDs to exclude from results
    blocked_ids = set()
    async for b in db["dm_blocks"].find(
        {"$or": [{"blockerId": user_id}, {"blockedId": user_id}]},
        {"blockerId": 1, "blockedId": 1},
    ):
        blocked_ids.add(b["blockedId"] if b["blockerId"] == user_id else b["blockerId"])

    exclude_oids = [ObjectId(uid) for uid in blocked_ids if ObjectId.is_valid(uid)]
    exclude_oids.append(ObjectId(user_id))

    cursor = db["users"].find(
        {
            "_id": {"$nin": exclude_oids},
            "role": "student",
            "$or": [
                {"firstName": {"$regex": pattern}},
                {"lastName": {"$regex": pattern}},
                {"email": {"$regex": pattern}},
                {"matricNumber": {"$regex": pattern}},
            ],
        },
        {"firstName": 1, "lastName": 1, "email": 1, "level": 1, "currentLevel": 1},
    ).limit(10)

    # Also batch-check connection status for these users
    results = []
    async for u in cursor:
        uid = str(u["_id"])
        results.append({
            "id": uid,
            "name": f"{u.get('firstName', '')} {u.get('lastName', '')}".strip(),
            "email": u.get("email", ""),
            "level": u.get("currentLevel") or u.get("level"),
        })

    # Batch check connection status
    if results:
        result_ids = [r["id"] for r in results]
        connected_set = set()
        pending_set = set()
        async for c in db["dm_connections"].find({
            "$or": [
                {"fromUserId": user_id, "toUserId": {"$in": result_ids}},
                {"fromUserId": {"$in": result_ids}, "toUserId": user_id},
            ]
        }):
            other = c["toUserId"] if c["fromUserId"] == user_id else c["fromUserId"]
            if c["status"] == "accepted":
                connected_set.add(other)
            elif c["status"] == "pending":
                pending_set.add(other)

        for r in results:
            r["connectionStatus"] = (
                "connected" if r["id"] in connected_set
                else "pending" if r["id"] in pending_set
                else "none"
            )

    return results


# ===================================================================
# UPLOAD ATTACHMENT
# ===================================================================

@router.post("/upload-attachment")
async def upload_attachment(
    recipientId: str = Form(...),
    file: UploadFile = File(...),
    user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    """
    Upload a file/image attachment for a DM.
    Returns the attachment metadata to be included in a subsequent send_message call.
    The attachment is stored on the message doc directly.
    """
    from app.utils.cloudinary_config import upload_dm_attachment

    sender_id = str(user["_id"])

    # Validate
    if sender_id == recipientId:
        raise HTTPException(status_code=400, detail="Cannot send to yourself")
    if not ObjectId.is_valid(recipientId):
        raise HTTPException(status_code=400, detail="Invalid recipient ID")

    await _check_mute(db, sender_id)
    await _check_block(db, sender_id, recipientId)
    await _check_rate_limit(db, sender_id)

    # Check file size (10 MB limit)
    contents = await file.read()
    if len(contents) > ATTACHMENT_MAX_SIZE_MB * 1024 * 1024:
        raise HTTPException(
            status_code=400,
            detail=f"File too large. Maximum size is {ATTACHMENT_MAX_SIZE_MB}MB.",
        )

    # Determine extension
    filename = file.filename or "file"
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else "bin"

    result = await upload_dm_attachment(contents, sender_id, ext)
    if not result or not result.get("url"):
        raise HTTPException(status_code=500, detail="Failed to upload file")

    # Build the attachment object
    attachment = {
        "url": result["url"],
        "name": filename,
        "size": len(contents),
        "type": file.content_type or "application/octet-stream",
        "resourceType": result.get("resourceType", "raw"),
    }

    # Now create the message with this attachment
    connected = await _are_connected(db, sender_id, recipientId)
    if not connected:
        raise HTTPException(
            status_code=400,
            detail="You must be connected to send attachments. Send a message request first.",
        )

    conv_key = _conversation_key(sender_id, recipientId)
    now = datetime.now(timezone.utc)

    doc = {
        "conversationKey": conv_key,
        "senderId": sender_id,
        "recipientId": recipientId,
        "content": "",
        "isRead": False,
        "createdAt": now,
        "attachments": [attachment],
    }
    insert_result = await db["direct_messages"].insert_one(doc)

    sender_name = f"{user.get('firstName', '')} {user.get('lastName', '')}".strip()
    ws_payload = {
        "type": "new_message",
        "data": {
            "id": str(insert_result.inserted_id),
            "conversationKey": conv_key,
            "senderId": sender_id,
            "senderName": sender_name,
            "recipientId": recipientId,
            "content": "",
            "isRead": False,
            "createdAt": now.isoformat(),
            "attachments": [attachment],
        },
    }
    await dm_manager.notify(recipientId, ws_payload)
    await dm_manager.notify(sender_id, ws_payload)

    return {
        "id": str(insert_result.inserted_id),
        "conversationKey": conv_key,
        "createdAt": now.isoformat(),
        "attachment": attachment,
    }


# ===================================================================
# SOFT DELETE MESSAGE
# ===================================================================

@router.delete("/message/{message_id}")
async def delete_message(
    message_id: str,
    user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    """
    Soft-delete a message within 5 minutes of sending.
    Only the sender can delete their own messages.
    """
    if not ObjectId.is_valid(message_id):
        raise HTTPException(status_code=400, detail="Invalid message ID")

    user_id = str(user["_id"])
    msg = await db["direct_messages"].find_one({"_id": ObjectId(message_id)})
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found")
    if msg["senderId"] != user_id:
        raise HTTPException(status_code=403, detail="You can only delete your own messages")
    if msg.get("deletedAt"):
        raise HTTPException(status_code=400, detail="Message already deleted")

    # Check time window
    created = msg["createdAt"]
    if isinstance(created, str):
        created = datetime.fromisoformat(created)
    if not created.tzinfo:
        created = created.replace(tzinfo=timezone.utc)
    elapsed = (datetime.now(timezone.utc) - created).total_seconds()
    if elapsed > DELETE_WINDOW_MINUTES * 60:
        raise HTTPException(
            status_code=400,
            detail=f"Messages can only be deleted within {DELETE_WINDOW_MINUTES} minutes of sending.",
        )

    now = datetime.now(timezone.utc)
    await db["direct_messages"].update_one(
        {"_id": ObjectId(message_id)},
        {"$set": {"deletedAt": now, "content": ""}},
    )

    # Notify both users
    conv_key = msg["conversationKey"]
    other_id = msg["recipientId"] if msg["senderId"] == user_id else msg["senderId"]
    ws_payload = {
        "type": "message_deleted",
        "data": {
            "messageId": message_id,
            "conversationKey": conv_key,
            "deletedAt": now.isoformat(),
        },
    }
    await dm_manager.notify(other_id, ws_payload)
    await dm_manager.notify(user_id, ws_payload)

    return {"deleted": True}


# ===================================================================
# MESSAGE SEARCH
# ===================================================================

@router.get("/search")
async def search_messages(
    q: str = Query(..., min_length=2, max_length=200),
    user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    """
    Search across all conversations for messages containing the query string.
    Returns up to 30 matching messages grouped by conversation.
    """
    import re as regex_module

    user_id = str(user["_id"])
    escaped = regex_module.escape(q.strip())
    pattern = regex_module.compile(escaped, regex_module.IGNORECASE)

    cursor = (
        db["direct_messages"]
        .find({
            "$or": [{"senderId": user_id}, {"recipientId": user_id}],
            "content": {"$regex": pattern},
            "deletedAt": {"$exists": False},
        })
        .sort("createdAt", -1)
        .limit(30)
    )

    # Collect results and other user IDs
    raw_results = []
    other_ids = set()
    async for doc in cursor:
        other_id = doc["recipientId"] if doc["senderId"] == user_id else doc["senderId"]
        other_ids.add(other_id)
        raw_results.append({
            "id": str(doc["_id"]),
            "conversationKey": doc["conversationKey"],
            "senderId": doc["senderId"],
            "recipientId": doc["recipientId"],
            "content": doc["content"],
            "createdAt": doc["createdAt"].isoformat(),
            "otherUserId": other_id,
        })

    # Batch fetch user names
    user_map: dict[str, str] = {}
    if other_ids:
        oids = [ObjectId(oid) for oid in other_ids if ObjectId.is_valid(oid)]
        if oids:
            async for u in db["users"].find(
                {"_id": {"$in": oids}},
                {"firstName": 1, "lastName": 1},
            ):
                uid = str(u["_id"])
                user_map[uid] = f"{u.get('firstName', '')} {u.get('lastName', '')}".strip()

    for r in raw_results:
        r["otherUserName"] = user_map.get(r["otherUserId"], "Unknown")

    return raw_results


# ===================================================================
# PINNED MESSAGES
# ===================================================================

@router.post("/message/{message_id}/pin")
async def pin_message(
    message_id: str,
    user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    """Pin a message in a conversation. Both participants can pin."""
    if not ObjectId.is_valid(message_id):
        raise HTTPException(status_code=400, detail="Invalid message ID")

    user_id = str(user["_id"])
    msg = await db["direct_messages"].find_one({"_id": ObjectId(message_id)})
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found")
    if msg.get("deletedAt"):
        raise HTTPException(status_code=400, detail="Cannot pin a deleted message")

    # Verify user is part of this conversation
    if user_id not in (msg["senderId"], msg["recipientId"]):
        raise HTTPException(status_code=403, detail="Not your conversation")

    if msg.get("isPinned"):
        raise HTTPException(status_code=400, detail="Message already pinned")

    # Check pin limit
    conv_key = msg["conversationKey"]
    pin_count = await db["direct_messages"].count_documents({
        "conversationKey": conv_key,
        "isPinned": True,
    })
    if pin_count >= MAX_PINNED_PER_CONVERSATION:
        raise HTTPException(
            status_code=400,
            detail=f"Maximum {MAX_PINNED_PER_CONVERSATION} pinned messages per conversation",
        )

    await db["direct_messages"].update_one(
        {"_id": ObjectId(message_id)},
        {"$set": {"isPinned": True, "pinnedAt": datetime.now(timezone.utc), "pinnedBy": user_id}},
    )

    other_id = msg["recipientId"] if msg["senderId"] == user_id else msg["senderId"]
    ws_payload = {
        "type": "message_pinned",
        "data": {
            "messageId": message_id,
            "conversationKey": conv_key,
            "isPinned": True,
            "pinnedBy": user_id,
        },
    }
    await dm_manager.notify(other_id, ws_payload)
    await dm_manager.notify(user_id, ws_payload)

    return {"pinned": True}


@router.delete("/message/{message_id}/pin")
async def unpin_message(
    message_id: str,
    user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    """Unpin a message."""
    if not ObjectId.is_valid(message_id):
        raise HTTPException(status_code=400, detail="Invalid message ID")

    user_id = str(user["_id"])
    msg = await db["direct_messages"].find_one({"_id": ObjectId(message_id)})
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found")
    if user_id not in (msg["senderId"], msg["recipientId"]):
        raise HTTPException(status_code=403, detail="Not your conversation")
    if not msg.get("isPinned"):
        raise HTTPException(status_code=400, detail="Message is not pinned")

    await db["direct_messages"].update_one(
        {"_id": ObjectId(message_id)},
        {"$unset": {"isPinned": "", "pinnedAt": "", "pinnedBy": ""}},
    )

    other_id = msg["recipientId"] if msg["senderId"] == user_id else msg["senderId"]
    conv_key = msg["conversationKey"]
    ws_payload = {
        "type": "message_pinned",
        "data": {
            "messageId": message_id,
            "conversationKey": conv_key,
            "isPinned": False,
        },
    }
    await dm_manager.notify(other_id, ws_payload)
    await dm_manager.notify(user_id, ws_payload)

    return {"unpinned": True}


@router.get("/conversation/{other_user_id}/pinned")
async def get_pinned_messages(
    other_user_id: str,
    user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    """Get all pinned messages in a conversation."""
    if not ObjectId.is_valid(other_user_id):
        raise HTTPException(status_code=400, detail="Invalid user ID")

    user_id = str(user["_id"])
    conv_key = _conversation_key(user_id, other_user_id)

    cursor = (
        db["direct_messages"]
        .find({"conversationKey": conv_key, "isPinned": True})
        .sort("pinnedAt", -1)
    )

    pinned = []
    async for doc in cursor:
        pinned.append({
            "id": str(doc["_id"]),
            "senderId": doc["senderId"],
            "recipientId": doc["recipientId"],
            "content": doc["content"] if not doc.get("deletedAt") else "",
            "createdAt": doc["createdAt"].isoformat(),
            "pinnedAt": doc.get("pinnedAt", doc["createdAt"]).isoformat(),
            "attachments": doc.get("attachments", []),
        })

    return pinned


# ===================================================================
# EMOJI REACTIONS
# ===================================================================

@router.post("/message/{message_id}/react")
async def add_reaction(
    message_id: str,
    body: ReactionBody,
    user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    """Add an emoji reaction to a message."""
    if not ObjectId.is_valid(message_id):
        raise HTTPException(status_code=400, detail="Invalid message ID")

    if body.emoji not in ALLOWED_REACTIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid reaction. Allowed: {', '.join(sorted(ALLOWED_REACTIONS))}",
        )

    user_id = str(user["_id"])
    msg = await db["direct_messages"].find_one({"_id": ObjectId(message_id)})
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found")
    if msg.get("deletedAt"):
        raise HTTPException(status_code=400, detail="Cannot react to a deleted message")
    if user_id not in (msg["senderId"], msg["recipientId"]):
        raise HTTPException(status_code=403, detail="Not your conversation")

    reactions = msg.get("reactions", [])

    # Check if user already reacted with this emoji
    existing = next(
        (r for r in reactions if r["userId"] == user_id and r["emoji"] == body.emoji),
        None,
    )
    if existing:
        raise HTTPException(status_code=400, detail="You already reacted with this emoji")

    if len(reactions) >= MAX_REACTIONS_PER_MESSAGE:
        raise HTTPException(status_code=400, detail="Too many reactions on this message")

    reaction = {
        "userId": user_id,
        "emoji": body.emoji,
        "createdAt": datetime.now(timezone.utc).isoformat(),
    }

    await db["direct_messages"].update_one(
        {"_id": ObjectId(message_id)},
        {"$push": {"reactions": reaction}},
    )

    other_id = msg["recipientId"] if msg["senderId"] == user_id else msg["senderId"]
    conv_key = msg["conversationKey"]
    ws_payload = {
        "type": "reaction_updated",
        "data": {
            "messageId": message_id,
            "conversationKey": conv_key,
            "reaction": reaction,
            "action": "add",
        },
    }
    await dm_manager.notify(other_id, ws_payload)
    await dm_manager.notify(user_id, ws_payload)

    return {"reacted": True}


@router.delete("/message/{message_id}/react/{emoji}")
async def remove_reaction(
    message_id: str,
    emoji: str,
    user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    """Remove your emoji reaction from a message."""
    if not ObjectId.is_valid(message_id):
        raise HTTPException(status_code=400, detail="Invalid message ID")

    user_id = str(user["_id"])
    msg = await db["direct_messages"].find_one({"_id": ObjectId(message_id)})
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found")
    if user_id not in (msg["senderId"], msg["recipientId"]):
        raise HTTPException(status_code=403, detail="Not your conversation")

    # URL-decode the emoji (might come URL-encoded)
    from urllib.parse import unquote
    decoded_emoji = unquote(emoji)

    result = await db["direct_messages"].update_one(
        {"_id": ObjectId(message_id)},
        {"$pull": {"reactions": {"userId": user_id, "emoji": decoded_emoji}}},
    )

    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Reaction not found")

    other_id = msg["recipientId"] if msg["senderId"] == user_id else msg["senderId"]
    conv_key = msg["conversationKey"]
    ws_payload = {
        "type": "reaction_updated",
        "data": {
            "messageId": message_id,
            "conversationKey": conv_key,
            "reaction": {"userId": user_id, "emoji": decoded_emoji},
            "action": "remove",
        },
    }
    await dm_manager.notify(other_id, ws_payload)
    await dm_manager.notify(user_id, ws_payload)

    return {"removed": True}


# --- WebSocket Endpoint --------------------------------------------
# Separate router: router-level HTTPBearer deps don't work for WebSocket scope
_ws_router = APIRouter(prefix="/api/v1/messages", tags=["Messages"])


@_ws_router.websocket("/ws")
async def dm_websocket(ws: WebSocket, token: str = Query("")):
    """
    Real-time DM connection.

    Connect with: ws://<host>/api/v1/messages/ws?token=<jwt>
    Server pushes events:
      - {"type": "new_message", "data": {...}}
      - {"type": "messages_read", "data": {...}}
      - {"type": "connection_request", "data": {...}}
      - {"type": "connection_accepted", "data": {...}}
      - {"type": "message_request", "data": {...}}
      - {"type": "message_request_accepted", "data": {...}}
      - {"type": "muted", "data": {...}}
    Client can send:
      - {"type": "ping"}  ->  server replies {"type": "pong"}
    """
    if not token:
        await ws.close(code=4001, reason="Token required")
        return

    try:
        user_data = await verify_firebase_id_token_raw(token)
    except Exception:
        await ws.close(code=4003, reason="Invalid token")
        return

    user_id = user_data.get("sub")
    if not user_id:
        await ws.close(code=4003, reason="Invalid token payload")
        return

    # Block external students
    db = get_database()
    if ObjectId.is_valid(user_id):
        u = await db["users"].find_one(
            {"_id": ObjectId(user_id)},
            {"department": 1, "role": 1},
        )
        if (
            u
            and u.get("role") == "student"
            and u.get("department", "Industrial Engineering")
            != "Industrial Engineering"
        ):
            await ws.close(code=4003, reason="IPE students only")
            return

    await dm_manager.connect(user_id, ws)
    try:
        while True:
            data = await ws.receive_json()
            msg_type = data.get("type", "")
            if msg_type == "ping":
                await ws.send_json({"type": "pong"})
            elif msg_type == "typing":
                # Relay typing indicator to the other user
                recipient_id = data.get("recipientId", "")
                if recipient_id and recipient_id != user_id:
                    await dm_manager.notify(recipient_id, {
                        "type": "typing",
                        "data": {"senderId": user_id},
                    })
    except WebSocketDisconnect:
        pass
    except Exception:
        pass
    finally:
        dm_manager.disconnect(user_id, ws)
