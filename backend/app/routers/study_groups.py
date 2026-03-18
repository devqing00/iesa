"""
Study Groups Router - Find and join study partners

REST API endpoints with WebSocket real-time chat.
Supports join-request approval flow, invite links, and head controls.
"""

from datetime import datetime, timezone
from typing import Optional, List, Literal
import asyncio

from fastapi import APIRouter, Depends, HTTPException, Query, WebSocket, WebSocketDisconnect
from pydantic import BaseModel, Field, field_validator
from bson import ObjectId
import re
import secrets
from html import escape

from ..core.security import verify_token, get_current_user
from ..core.sanitization import sanitize_html
from ..core.security import verify_firebase_id_token_raw
from ..core.ws_security import is_ws_origin_allowed
from ..core.database import get_database


async def _ipe_gate(user_data: dict = Depends(verify_token)):
    """Block external students from study group endpoints."""
    user_id = user_data.get("sub")
    if user_id and ObjectId.is_valid(user_id):
        db = get_database()
        u = await db["users"].find_one(
            {"_id": ObjectId(user_id)},
            {"department": 1, "role": 1},
        )
        if (
            u
            and u.get("role") == "student"
            and u.get("department", "Industrial Engineering") != "Industrial Engineering"
        ):
            raise HTTPException(
                status_code=403,
                detail="This feature is only available to IPE students",
            )


router = APIRouter(
    prefix="/api/v1/study-groups",
    tags=["study-groups"],
    dependencies=[Depends(_ipe_gate)],
)

COLLECTION = "study_groups"


# ─── Pydantic Models ───────────────────────────────────────────────────

class StudyGroupCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    courseCode: Optional[str] = Field(None, min_length=1, max_length=20)
    courseName: Optional[str] = Field(None, max_length=200)
    description: Optional[str] = Field(None, max_length=500)
    maxMembers: int = Field(8, ge=2, le=20)
    level: Optional[str] = None
    tags: Optional[List[str]] = Field(None, max_length=5)
    visibility: Literal["public", "private"] = "public"
    publicJoinRequiresApproval: bool = False
    isOpen: bool = True
    requireApproval: bool = False

    @field_validator("name")
    @classmethod
    def strip_whitespace(cls, v: str) -> str:
        return v.strip()

    @field_validator("courseCode")
    @classmethod
    def strip_optional_course_code(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        value = v.strip()
        return value or None

    @field_validator("tags")
    @classmethod
    def limit_tags(cls, v: Optional[List[str]]) -> Optional[List[str]]:
        if v is not None:
            return v[:5]
        return v


class StudyGroupUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=100)
    description: Optional[str] = Field(None, max_length=500)
    tags: Optional[List[str]] = None
    visibility: Optional[Literal["public", "private"]] = None
    publicJoinRequiresApproval: Optional[bool] = None
    isOpen: Optional[bool] = None
    maxMembers: Optional[int] = Field(None, ge=2, le=20)
    pinnedNote: Optional[str] = Field(None, max_length=500)
    requireApproval: Optional[bool] = None


class StudyGroupBulkInviteRequest(BaseModel):
    userIds: List[str] = Field(..., min_length=1, max_length=200)

    @field_validator("userIds")
    @classmethod
    def unique_user_ids(cls, v: List[str]) -> List[str]:
        seen = set()
        unique_ids: List[str] = []
        for raw_id in v:
            value = (raw_id or "").strip()
            if not value or value in seen:
                continue
            seen.add(value)
            unique_ids.append(value)
        if not unique_ids:
            raise ValueError("At least one valid user ID is required")
        return unique_ids


class MessageCreate(BaseModel):
    text: str = Field(..., min_length=1, max_length=500)

    @field_validator("text")
    @classmethod
    def strip_text(cls, v: str) -> str:
        return v.strip()


class SessionCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=100)
    date: str = Field(..., min_length=1)
    time: Optional[str] = ""
    meetupType: Literal["physical", "online"] = "physical"
    location: Optional[str] = Field(None, max_length=200)
    meetingLink: Optional[str] = Field(None, max_length=500)
    agenda: Optional[str] = Field(None, max_length=500)

    @field_validator("title")
    @classmethod
    def strip_title(cls, v: str) -> str:
        return v.strip()

    @field_validator("time", "location", "meetingLink", "agenda")
    @classmethod
    def strip_optional_fields(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        value = v.strip()
        return value or None

    @field_validator("location")
    @classmethod
    def validate_location_for_physical(cls, v: Optional[str], info):
        meetup_type = info.data.get("meetupType")
        if meetup_type == "physical" and not v:
            raise ValueError("Location is required for physical sessions")
        return v

    @field_validator("meetingLink")
    @classmethod
    def validate_link_for_online(cls, v: Optional[str], info):
        meetup_type = info.data.get("meetupType")
        if meetup_type == "online" and not v:
            raise ValueError("Meeting link is required for online sessions")
        return v


class ResourceCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=100)
    url: str = Field(..., min_length=1, max_length=500)
    type: str = Field("link", pattern=r"^(link|document|video)$")

    @field_validator("title", "url")
    @classmethod
    def strip_fields(cls, v: str) -> str:
        return v.strip()


# ─── WebSocket Chat Manager ────────────────────────────────────────────

class ChatManager:
    """Maintains active WebSocket connections per study group."""

    def __init__(self):
        self.connections: dict[str, list[WebSocket]] = {}
        self.user_connections: dict[str, dict[str, int]] = {}

    async def connect(self, group_id: str, user_id: str, ws: WebSocket):
        await ws.accept(headers=[(b"X-Accel-Buffering", b"no")])
        self.connections.setdefault(group_id, []).append(ws)
        group_users = self.user_connections.setdefault(group_id, {})
        group_users[user_id] = group_users.get(user_id, 0) + 1

    def disconnect(self, group_id: str, user_id: str, ws: WebSocket):
        if group_id in self.connections:
            self.connections[group_id] = [
                c for c in self.connections[group_id] if c is not ws
            ]
            if not self.connections[group_id]:
                del self.connections[group_id]
        group_users = self.user_connections.get(group_id)
        if group_users:
            if user_id in group_users:
                group_users[user_id] = max(0, group_users[user_id] - 1)
                if group_users[user_id] == 0:
                    del group_users[user_id]
            if not group_users:
                del self.user_connections[group_id]

    def online_user_ids(self, group_id: str) -> list[str]:
        return list(self.user_connections.get(group_id, {}).keys())

    async def broadcast(self, group_id: str, data: dict):
        dead: list[WebSocket] = []
        for ws in list(self.connections.get(group_id, [])):
            try:
                await ws.send_json(data)
            except Exception:
                dead.append(ws)
        # Prune dead connections
        if dead and group_id in self.connections:
            self.connections[group_id] = [
                c for c in self.connections[group_id] if c not in dead
            ]


chat_manager = ChatManager()


# ─── Helpers ────────────────────────────────────────────────────────────

def serialize(doc: dict) -> dict:
    """Convert MongoDB document to JSON-serializable dict"""
    doc["id"] = str(doc.pop("_id"))
    doc["onlineMemberIds"] = chat_manager.online_user_ids(doc["id"])
    doc["createdAt"] = doc.get("createdAt", "").isoformat() if isinstance(doc.get("createdAt"), datetime) else str(doc.get("createdAt", ""))
    doc["updatedAt"] = doc.get("updatedAt", "").isoformat() if isinstance(doc.get("updatedAt"), datetime) else str(doc.get("updatedAt", ""))
    for m in doc.get("members", []):
        if isinstance(m.get("joinedAt"), datetime):
            m["joinedAt"] = m["joinedAt"].isoformat()
    for jr in doc.get("joinRequests", []):
        if isinstance(jr.get("requestedAt"), datetime):
            jr["requestedAt"] = jr["requestedAt"].isoformat()
    return doc


def _generate_invite_code() -> str:
    """Generate a short URL-safe invite code."""
    return secrets.token_urlsafe(8)  # 11-char random code


def _group_visibility(doc: dict) -> str:
    visibility = (doc.get("visibility") or "public").lower()
    return "private" if visibility == "private" else "public"


def _group_requires_approval(doc: dict) -> bool:
    if _group_visibility(doc) == "private":
        return True
    if "publicJoinRequiresApproval" in doc:
        return bool(doc.get("publicJoinRequiresApproval", False))
    return bool(doc.get("requireApproval", False))


def _can_view_group(doc: dict, user_id: str) -> bool:
    if _group_visibility(doc) != "private":
        return True
    if doc.get("createdBy") == user_id:
        return True
    if any(m.get("userId") == user_id for m in doc.get("members", [])):
        return True
    if any(jr.get("userId") == user_id for jr in doc.get("joinRequests", [])):
        return True
    return False


# ─── LIST / SEARCH ─────────────────────────────────────────────────────

@router.get("/")
async def list_study_groups(
    course: Optional[str] = Query(None, description="Filter by course code"),
    level: Optional[str] = Query(None, description="Filter by level"),
    search: Optional[str] = Query(None, description="Search name/description"),
    open_only: bool = Query(True, description="Only show groups accepting members"),
    limit: int = Query(20, ge=1, le=50),
    skip: int = Query(0, ge=0),
    user: dict = Depends(get_current_user),
):
    """List study groups with optional filters"""
    db = get_database()
    user_id = user["_id"]
    and_filters: list[dict] = []

    if course:
        and_filters.append({"courseCode": {"$regex": re.escape(course), "$options": "i"}})
    if level:
        and_filters.append({"level": level})
    if search:
        escaped = re.escape(search)
        and_filters.append({"$or": [
            {"name": {"$regex": escaped, "$options": "i"}},
            {"description": {"$regex": escaped, "$options": "i"}},
            {"courseCode": {"$regex": escaped, "$options": "i"}},
            {"courseName": {"$regex": escaped, "$options": "i"}},
            {"tags": {"$regex": escaped, "$options": "i"}},
        ]})
    if open_only:
        and_filters.append({"isOpen": True})

    and_filters.append({
        "$or": [
            {"visibility": {"$ne": "private"}},
            {"createdBy": user_id},
            {"members.userId": user_id},
            {"joinRequests.userId": user_id},
        ]
    })

    query = {"$and": and_filters} if and_filters else {}

    cursor = db[COLLECTION].find(query).sort("createdAt", -1).skip(skip).limit(limit)
    groups = []
    async for doc in cursor:
        groups.append(serialize(doc))

    total = await db[COLLECTION].count_documents(query)
    return {"groups": groups, "total": total}


# ─── MY GROUPS ──────────────────────────────────────────────────────────

@router.get("/my-groups")
async def my_groups(
    user: dict = Depends(get_current_user),
):
    """List groups I created or am a member of"""
    db = get_database()
    user_id = user["_id"]

    query = {
        "$or": [
            {"createdBy": user_id},
            {"members.userId": user_id},
        ]
    }
    cursor = db[COLLECTION].find(query).sort("createdAt", -1)
    groups = []
    async for doc in cursor:
        groups.append(serialize(doc))
    return groups


# ─── LOOKUP BY INVITE CODE ──────────────────────────────────────────────

@router.get("/join-by-code/{invite_code}")
async def get_group_by_invite_code(
    invite_code: str,
    user: dict = Depends(get_current_user),
):
    """Look up a study group by its invite code"""
    db = get_database()

    doc = await db[COLLECTION].find_one({"inviteCode": invite_code})
    if not doc:
        raise HTTPException(status_code=404, detail="Invalid or expired invite code")

    return serialize(doc)


# ─── GET ONE ────────────────────────────────────────────────────────────

@router.get("/{group_id}")
async def get_study_group(
    group_id: str,
    user: dict = Depends(get_current_user),
):
    """Get a single study group by ID"""
    db = get_database()
    if not ObjectId.is_valid(group_id):
        raise HTTPException(status_code=400, detail="Invalid group ID")

    doc = await db[COLLECTION].find_one({"_id": ObjectId(group_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Study group not found")
    if not _can_view_group(doc, user["_id"]):
        raise HTTPException(status_code=403, detail="You are not allowed to view this private group")
    return serialize(doc)


# ─── CREATE ─────────────────────────────────────────────────────────────

@router.post("/", status_code=201)
async def create_study_group(
    body: StudyGroupCreate,
    user: dict = Depends(get_current_user),
):
    """Create a new study group"""
    db = get_database()
    user_id = user["_id"]

    # Look up creator's name
    user = await db["users"].find_one({"_id": ObjectId(user_id)})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    creator_name = f"{user.get('firstName', '')} {user.get('lastName', '')}".strip()

    now = datetime.now(timezone.utc)
    visibility = body.visibility
    public_join_requires_approval = body.publicJoinRequiresApproval if visibility == "public" else False
    require_approval = True if visibility == "private" else public_join_requires_approval

    doc = {
        "name": body.name,
        "courseCode": body.courseCode.upper() if body.courseCode else "GENERAL",
        "courseName": body.courseName,
        "description": body.description,
        "maxMembers": body.maxMembers,
        "level": body.level,
        "tags": body.tags or [],
        "visibility": visibility,
        "publicJoinRequiresApproval": public_join_requires_approval,
        "isOpen": body.isOpen,
        "requireApproval": require_approval,
        "createdBy": user_id,
        "creatorName": creator_name,
        "members": [
            {
                "userId": user_id,
                "firstName": user.get("firstName", ""),
                "lastName": user.get("lastName", ""),
                "matricNumber": user.get("matricNumber"),
                "joinedAt": now,
            }
        ],
        "joinRequests": [],
        "inviteCode": _generate_invite_code(),
        "createdAt": now,
        "updatedAt": now,
    }

    result = await db[COLLECTION].insert_one(doc)
    doc["_id"] = result.inserted_id
    return serialize(doc)


# ─── UPDATE ─────────────────────────────────────────────────────────────

@router.put("/{group_id}")
async def update_study_group(
    group_id: str,
    body: StudyGroupUpdate,
    user: dict = Depends(get_current_user),
):
    """Update a study group (creator only)"""
    db = get_database()
    user_id = user["_id"]

    if not ObjectId.is_valid(group_id):
        raise HTTPException(status_code=400, detail="Invalid group ID")

    doc = await db[COLLECTION].find_one({"_id": ObjectId(group_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Study group not found")
    if doc["createdBy"] != user_id:
        raise HTTPException(status_code=403, detail="Only the creator can edit this group")

    updates: dict = {"updatedAt": datetime.now(timezone.utc)}
    for field, value in body.model_dump(exclude_unset=True).items():
        updates[field] = value

    next_visibility = updates.get("visibility", _group_visibility(doc))
    if next_visibility == "private":
        updates["publicJoinRequiresApproval"] = False
        updates["requireApproval"] = True
    elif "publicJoinRequiresApproval" in updates:
        updates["requireApproval"] = bool(updates["publicJoinRequiresApproval"])

    await db[COLLECTION].update_one({"_id": ObjectId(group_id)}, {"$set": updates})
    updated = await db[COLLECTION].find_one({"_id": ObjectId(group_id)})
    return serialize(updated)


# ─── JOIN ───────────────────────────────────────────────────────────────

@router.post("/{group_id}/join")
async def join_study_group(
    group_id: str,
    user: dict = Depends(get_current_user),
):
    """Join a study group (or request to join if approval is required)"""
    db = get_database()
    user_id = user["_id"]

    if not ObjectId.is_valid(group_id):
        raise HTTPException(status_code=400, detail="Invalid group ID")

    doc = await db[COLLECTION].find_one({"_id": ObjectId(group_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Study group not found")

    if _group_visibility(doc) == "private":
        raise HTTPException(status_code=403, detail="This is a private group. Use an invite link to request access")

    if not doc.get("isOpen", True):
        raise HTTPException(status_code=400, detail="This group is not accepting new members")

    # Check if already a member
    if any(m["userId"] == user_id for m in doc.get("members", [])):
        raise HTTPException(status_code=400, detail="Already a member of this group")

    # Check if already has a pending request
    if any(jr["userId"] == user_id for jr in doc.get("joinRequests", [])):
        raise HTTPException(status_code=400, detail="You already have a pending join request")

    # Check max members
    if len(doc.get("members", [])) >= doc.get("maxMembers", 8):
        raise HTTPException(status_code=400, detail="Group is full")

    user = await db["users"].find_one({"_id": ObjectId(user_id)})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # If approval is required, add to joinRequests instead of members
    if _group_requires_approval(doc):
        join_request = {
            "userId": user_id,
            "firstName": user.get("firstName", ""),
            "lastName": user.get("lastName", ""),
            "matricNumber": user.get("matricNumber"),
            "requestedAt": datetime.now(timezone.utc),
        }
        await db[COLLECTION].update_one(
            {"_id": ObjectId(group_id)},
            {
                "$push": {"joinRequests": join_request},
                "$set": {"updatedAt": datetime.now(timezone.utc)},
            },
        )
        updated = await db[COLLECTION].find_one({"_id": ObjectId(group_id)})

        # Notify group creator about the join request
        try:
            from app.routers.notifications import create_notification
            joiner_name = f"{user.get('firstName', '')} {user.get('lastName', '')}".strip()
            asyncio.create_task(create_notification(
                user_id=doc["createdBy"],
                type="study_group",
                title="New Join Request",
                message=f"{joiner_name} wants to join {doc.get('name', 'your study group')}.",
                link="/dashboard/growth/study-groups",
                category="study_groups",
            ))
        except Exception:
            pass

        return {"message": "Join request sent. The group head will review your request.", "status": "pending", "group": serialize(updated)}

    # Direct join (no approval needed)
    member = {
        "userId": user_id,
        "firstName": user.get("firstName", ""),
        "lastName": user.get("lastName", ""),
        "matricNumber": user.get("matricNumber"),
        "joinedAt": datetime.now(timezone.utc),
    }

    await db[COLLECTION].update_one(
        {"_id": ObjectId(group_id)},
        {
            "$push": {"members": member},
            "$set": {"updatedAt": datetime.now(timezone.utc)},
        },
    )

    # Auto-close if full
    if len(doc["members"]) + 1 >= doc.get("maxMembers", 8):
        await db[COLLECTION].update_one(
            {"_id": ObjectId(group_id)},
            {"$set": {"isOpen": False}},
        )

    updated = await db[COLLECTION].find_one({"_id": ObjectId(group_id)})

    # Notify group creator about the new member
    try:
        from app.routers.notifications import create_notification
        joiner_name = f"{user.get('firstName', '')} {user.get('lastName', '')}".strip()
        asyncio.create_task(create_notification(
            user_id=doc["createdBy"],
            type="study_group",
            title="New Member Joined",
            message=f"{joiner_name} joined {doc.get('name', 'your study group')}.",
            link="/dashboard/growth/study-groups",
            category="study_groups",
        ))
    except Exception:
        pass

    return serialize(updated)


# ─── JOIN REQUEST MANAGEMENT ────────────────────────────────────────────

@router.post("/{group_id}/approve/{user_id}")
async def approve_join_request(
    group_id: str,
    user_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Approve a pending join request (group head only)"""
    db = get_database()
    current_user_id = current_user["_id"]

    if not ObjectId.is_valid(group_id):
        raise HTTPException(status_code=400, detail="Invalid group ID")

    doc = await db[COLLECTION].find_one({"_id": ObjectId(group_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Study group not found")

    if doc["createdBy"] != current_user_id:
        raise HTTPException(status_code=403, detail="Only the group head can approve join requests")

    # Find the join request
    join_request = next(
        (jr for jr in doc.get("joinRequests", []) if jr["userId"] == user_id), None
    )
    if not join_request:
        raise HTTPException(status_code=404, detail="Join request not found")

    # Check max members
    if len(doc.get("members", [])) >= doc.get("maxMembers", 8):
        raise HTTPException(status_code=400, detail="Group is full. Cannot approve more members.")

    # Move from joinRequests to members
    member = {
        "userId": join_request["userId"],
        "firstName": join_request.get("firstName", ""),
        "lastName": join_request.get("lastName", ""),
        "matricNumber": join_request.get("matricNumber"),
        "joinedAt": datetime.now(timezone.utc),
    }

    await db[COLLECTION].update_one(
        {"_id": ObjectId(group_id)},
        {
            "$pull": {"joinRequests": {"userId": user_id}},
            "$push": {"members": member},
            "$set": {"updatedAt": datetime.now(timezone.utc)},
        },
    )

    # Auto-close if full
    if len(doc["members"]) + 1 >= doc.get("maxMembers", 8):
        await db[COLLECTION].update_one(
            {"_id": ObjectId(group_id)},
            {"$set": {"isOpen": False}},
        )

    updated = await db[COLLECTION].find_one({"_id": ObjectId(group_id)})

    # Notify the approved user
    try:
        from app.routers.notifications import create_notification
        asyncio.create_task(create_notification(
            user_id=user_id,
            type="study_group",
            title="Join Request Approved",
            message=f"You've been accepted into {doc.get('name', 'a study group')}!",
            link="/dashboard/growth/study-groups",
            category="study_groups",
        ))
    except Exception:
        pass

    return serialize(updated)


@router.post("/{group_id}/reject/{user_id}")
async def reject_join_request(
    group_id: str,
    user_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Reject a pending join request (group head only)"""
    db = get_database()
    current_user_id = current_user["_id"]

    if not ObjectId.is_valid(group_id):
        raise HTTPException(status_code=400, detail="Invalid group ID")

    doc = await db[COLLECTION].find_one({"_id": ObjectId(group_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Study group not found")

    if doc["createdBy"] != current_user_id:
        raise HTTPException(status_code=403, detail="Only the group head can reject join requests")

    if not any(jr["userId"] == user_id for jr in doc.get("joinRequests", [])):
        raise HTTPException(status_code=404, detail="Join request not found")

    await db[COLLECTION].update_one(
        {"_id": ObjectId(group_id)},
        {
            "$pull": {"joinRequests": {"userId": user_id}},
            "$set": {"updatedAt": datetime.now(timezone.utc)},
        },
    )

    updated = await db[COLLECTION].find_one({"_id": ObjectId(group_id)})

    # Notify the rejected user
    try:
        from app.routers.notifications import create_notification
        asyncio.create_task(create_notification(
            user_id=user_id,
            type="study_group",
            title="Join Request Declined",
            message=f"Your request to join {doc.get('name', 'a study group')} was not approved.",
            link="/dashboard/growth/study-groups",
            category="study_groups",
        ))
    except Exception:
        pass

    return serialize(updated)


# ─── MEMBER MANAGEMENT ─────────────────────────────────────────────────

@router.delete("/{group_id}/members/{user_id}")
async def remove_member(
    group_id: str,
    user_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Remove a member from the group (group head only)"""
    db = get_database()
    current_user_id = current_user["_id"]

    if not ObjectId.is_valid(group_id):
        raise HTTPException(status_code=400, detail="Invalid group ID")

    doc = await db[COLLECTION].find_one({"_id": ObjectId(group_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Study group not found")

    if doc["createdBy"] != current_user_id:
        raise HTTPException(status_code=403, detail="Only the group head can remove members")

    if user_id == current_user_id:
        raise HTTPException(status_code=400, detail="Cannot remove yourself. Delete the group instead.")

    if not any(m["userId"] == user_id for m in doc.get("members", [])):
        raise HTTPException(status_code=404, detail="User is not a member of this group")

    await db[COLLECTION].update_one(
        {"_id": ObjectId(group_id)},
        {
            "$pull": {"members": {"userId": user_id}},
            "$set": {"updatedAt": datetime.now(timezone.utc)},
        },
    )

    # Re-open if was full
    if not doc.get("isOpen") and len(doc.get("members", [])) - 1 < doc.get("maxMembers", 8):
        await db[COLLECTION].update_one(
            {"_id": ObjectId(group_id)},
            {"$set": {"isOpen": True}},
        )

    updated = await db[COLLECTION].find_one({"_id": ObjectId(group_id)})
    return serialize(updated)


# ─── INVITE SYSTEM ──────────────────────────────────────────────────────

@router.post("/{group_id}/regenerate-invite")
async def regenerate_invite_code(
    group_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Regenerate the invite code (group head only)"""
    db = get_database()
    current_user_id = current_user["_id"]

    if not ObjectId.is_valid(group_id):
        raise HTTPException(status_code=400, detail="Invalid group ID")

    doc = await db[COLLECTION].find_one({"_id": ObjectId(group_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Study group not found")

    if doc["createdBy"] != current_user_id:
        raise HTTPException(status_code=403, detail="Only the group head can regenerate the invite code")

    new_code = _generate_invite_code()
    await db[COLLECTION].update_one(
        {"_id": ObjectId(group_id)},
        {"$set": {"inviteCode": new_code, "updatedAt": datetime.now(timezone.utc)}},
    )

    return {"inviteCode": new_code}


@router.post("/{group_id}/join-by-invite")
async def join_by_invite(
    group_id: str,
    body: dict,
    user: dict = Depends(get_current_user),
):
    """Join a study group using an invite code."""
    db = get_database()
    user_id = user["_id"]
    invite_code = body.get("inviteCode", "")

    if not ObjectId.is_valid(group_id):
        raise HTTPException(status_code=400, detail="Invalid group ID")

    doc = await db[COLLECTION].find_one({"_id": ObjectId(group_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Study group not found")

    if doc.get("inviteCode") != invite_code:
        raise HTTPException(status_code=400, detail="Invalid invite code")

    if not doc.get("isOpen", True):
        raise HTTPException(status_code=400, detail="This group is not accepting new members")

    if any(m["userId"] == user_id for m in doc.get("members", [])):
        raise HTTPException(status_code=400, detail="Already a member of this group")

    if len(doc.get("members", [])) >= doc.get("maxMembers", 8):
        raise HTTPException(status_code=400, detail="Group is full")

    user_doc = await db["users"].find_one({"_id": ObjectId(user_id)})
    if not user_doc:
        raise HTTPException(status_code=404, detail="User not found")

    if _group_requires_approval(doc):
        if any(jr["userId"] == user_id for jr in doc.get("joinRequests", [])):
            raise HTTPException(status_code=400, detail="You already have a pending join request")

        join_request = {
            "userId": user_id,
            "firstName": user_doc.get("firstName", ""),
            "lastName": user_doc.get("lastName", ""),
            "matricNumber": user_doc.get("matricNumber"),
            "requestedAt": datetime.now(timezone.utc),
        }
        await db[COLLECTION].update_one(
            {"_id": ObjectId(group_id)},
            {
                "$push": {"joinRequests": join_request},
                "$set": {"updatedAt": datetime.now(timezone.utc)},
            },
        )

        # Notify group creator about the join request
        try:
            from app.routers.notifications import create_notification
            joiner_name = f"{user_doc.get('firstName', '')} {user_doc.get('lastName', '')}".strip()
            asyncio.create_task(create_notification(
                user_id=doc["createdBy"],
                type="study_group",
                title="New Join Request",
                message=f"{joiner_name} wants to join {doc.get('name', 'your study group')} via invite.",
                link="/dashboard/growth/study-groups",
                category="study_groups",
            ))
        except Exception:
            pass

        updated = await db[COLLECTION].find_one({"_id": ObjectId(group_id)})
        return {"message": "Join request sent. The group head will review your request.", "status": "pending", "group": serialize(updated)}

    member = {
        "userId": user_id,
        "firstName": user_doc.get("firstName", ""),
        "lastName": user_doc.get("lastName", ""),
        "matricNumber": user_doc.get("matricNumber"),
        "joinedAt": datetime.now(timezone.utc),
    }

    # Remove from joinRequests if they had a pending request
    await db[COLLECTION].update_one(
        {"_id": ObjectId(group_id)},
        {
            "$pull": {"joinRequests": {"userId": user_id}},
            "$push": {"members": member},
            "$set": {"updatedAt": datetime.now(timezone.utc)},
        },
    )

    # Auto-close if full
    if len(doc["members"]) + 1 >= doc.get("maxMembers", 8):
        await db[COLLECTION].update_one(
            {"_id": ObjectId(group_id)},
            {"$set": {"isOpen": False}},
        )

    updated = await db[COLLECTION].find_one({"_id": ObjectId(group_id)})
    return serialize(updated)


# ─── INVITE SEARCH + BULK SEND ────────────────────────────────────────

@router.get("/{group_id}/students/search")
async def search_students_for_group_invite(
    group_id: str,
    q: str = Query(..., min_length=2, max_length=100),
    user: dict = Depends(get_current_user),
):
    """Search IPE students for group invitations (creator only)."""
    db = get_database()
    user_id = user["_id"]

    if not ObjectId.is_valid(group_id):
        raise HTTPException(status_code=400, detail="Invalid group ID")

    doc = await db[COLLECTION].find_one({"_id": ObjectId(group_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Study group not found")
    if doc.get("createdBy") != user_id:
        raise HTTPException(status_code=403, detail="Only the group head can search invitees")

    existing_member_ids = {m.get("userId") for m in doc.get("members", [])}
    existing_pending_ids = {jr.get("userId") for jr in doc.get("joinRequests", [])}
    exclude_ids = {uid for uid in existing_member_ids.union(existing_pending_ids) if uid}
    exclude_ids.add(user_id)
    exclude_oids = [ObjectId(uid) for uid in exclude_ids if ObjectId.is_valid(uid)]

    escaped = re.escape(q.strip())
    regex = {"$regex": escaped, "$options": "i"}

    query = {
        "_id": {"$nin": exclude_oids},
        "$or": [
            {"department": "Industrial Engineering"},
            {"isExternalStudent": {"$ne": True}},
        ],
        "$and": [
            {
                "$or": [
                    {"firstName": regex},
                    {"lastName": regex},
                    {"email": regex},
                    {"matricNumber": regex},
                ]
            }
        ],
    }

    users = await db["users"].find(
        query,
        {
            "firstName": 1,
            "lastName": 1,
            "email": 1,
            "matricNumber": 1,
            "role": 1,
            "currentLevel": 1,
            "level": 1,
        },
    ).sort("lastName", 1).limit(25).to_list(None)

    results = []
    for u in users:
        results.append({
            "id": str(u["_id"]),
            "firstName": u.get("firstName", ""),
            "lastName": u.get("lastName", ""),
            "email": u.get("email", ""),
            "matricNumber": u.get("matricNumber"),
            "role": u.get("role", ""),
            "level": u.get("currentLevel") or u.get("level"),
        })

    return {"students": results, "count": len(results)}


@router.post("/{group_id}/invites/send")
async def send_group_invites(
    group_id: str,
    body: StudyGroupBulkInviteRequest,
    user: dict = Depends(get_current_user),
):
    """Send bulk study-group invites to selected students (creator only)."""
    db = get_database()
    user_id = user["_id"]

    if not ObjectId.is_valid(group_id):
        raise HTTPException(status_code=400, detail="Invalid group ID")

    doc = await db[COLLECTION].find_one({"_id": ObjectId(group_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Study group not found")
    if doc.get("createdBy") != user_id:
        raise HTTPException(status_code=403, detail="Only the group head can send invites")

    valid_target_ids = [uid for uid in body.userIds if ObjectId.is_valid(uid)]
    if not valid_target_ids:
        raise HTTPException(status_code=400, detail="No valid invite targets were provided")

    existing_member_ids = {m.get("userId") for m in doc.get("members", [])}
    existing_pending_ids = {jr.get("userId") for jr in doc.get("joinRequests", [])}

    targets = await db["users"].find(
        {
            "_id": {"$in": [ObjectId(uid) for uid in valid_target_ids]},
            "$or": [
                {"department": "Industrial Engineering"},
                {"isExternalStudent": {"$ne": True}},
            ],
        },
        {
            "firstName": 1,
            "lastName": 1,
            "email": 1,
            "secondaryEmail": 1,
            "secondaryEmailVerified": 1,
            "notificationEmailPreference": 1,
            "notificationChannelPreference": 1,
            "notificationCategories": 1,
        },
    ).to_list(None)

    filtered_targets = []
    for target in targets:
        target_id = str(target["_id"])
        if target_id == user_id:
            continue
        if target_id in existing_member_ids:
            continue
        if target_id in existing_pending_ids:
            continue
        filtered_targets.append(target)

    if not filtered_targets:
        return {
            "message": "No eligible students found for invite",
            "requested": len(body.userIds),
            "invited": 0,
            "inAppQueued": 0,
            "emailQueued": 0,
        }

    invite_code = doc.get("inviteCode") or _generate_invite_code()
    if invite_code != doc.get("inviteCode"):
        await db[COLLECTION].update_one(
            {"_id": ObjectId(group_id)},
            {"$set": {"inviteCode": invite_code, "updatedAt": datetime.now(timezone.utc)}},
        )

    invite_link = f"/dashboard/growth/study-groups?invite={invite_code}"
    visibility = _group_visibility(doc)
    invite_message = (
        f"You were invited to join {doc.get('name', 'a study group')}. "
        + ("Use your invite link to request access." if visibility == "private" else "Use your invite link to join.")
    )

    target_ids = [str(t["_id"]) for t in filtered_targets]

    from app.routers.notifications import create_bulk_notifications
    await create_bulk_notifications(
        user_ids=target_ids,
        type="study_group",
        title="Study Group Invite",
        message=invite_message,
        link=invite_link,
        related_id=group_id,
        category="study_groups",
    )

    from app.core.notification_utils import get_notification_emails, should_notify_category, should_send_email
    from app.core.email import get_email_service

    email_service = get_email_service()
    email_jobs = []
    email_queued = 0

    for target in filtered_targets:
        if not should_send_email(target):
            continue
        if not should_notify_category(target, "study_groups"):
            continue

        recipient_emails = list(dict.fromkeys(get_notification_emails(target)))
        if not recipient_emails:
            continue

        display_name = f"{target.get('firstName', '')} {target.get('lastName', '')}".strip() or "Student"
        group_name = escape(doc.get("name", "Study Group"))
        invite_url = f"https://iesa-ui.vercel.app{invite_link}"
        join_instruction = "request access" if visibility == "private" else "join"
        subject = f"IESA Study Group Invite — {doc.get('name', 'Study Group')}"
        html = f"""
        <html>
          <body style=\"margin:0;padding:24px;background:#FAFAFE;font-family:Inter,Arial,sans-serif;color:#0F0F2D;\">
            <div style=\"max-width:620px;margin:0 auto;background:#FFFFFF;border:3px solid #0F0F2D;border-radius:18px;overflow:hidden;box-shadow:6px 6px 0 #000;\">
              <div style=\"background:#C8F31D;padding:16px 20px;border-bottom:3px solid #0F0F2D;\">
                <p style=\"margin:0;font-size:11px;letter-spacing:.08em;text-transform:uppercase;font-weight:900;color:#0F0F2D;\">Study Group Invite</p>
              </div>
              <div style=\"padding:22px 20px;\">
                <p style=\"margin:0 0 10px;font-size:14px;line-height:1.7;color:#334155;\">Hi {escape(display_name)},</p>
                <p style=\"margin:0 0 10px;font-size:14px;line-height:1.7;color:#334155;\">You have been invited to {join_instruction} <strong>{group_name}</strong>.</p>
                <p style=\"margin:0 0 14px;font-size:13px;line-height:1.7;color:#64748B;\">Click below to continue in your dashboard.</p>
                <a href=\"{invite_url}\" style=\"display:inline-block;background:#0F0F2D;color:#FFFFFF;font-size:13px;font-weight:800;text-decoration:none;padding:10px 14px;border:3px solid #0F0F2D;border-radius:10px;\">Open Invite</a>
              </div>
            </div>
          </body>
        </html>
        """

        for recipient in recipient_emails:
            email_queued += 1
            email_jobs.append(email_service.send_email(to=recipient, subject=subject, html_content=html))

    if email_jobs:
        async def _send_all_invite_emails():
            await asyncio.gather(*email_jobs, return_exceptions=True)

        asyncio.create_task(_send_all_invite_emails())

    return {
        "message": "Study group invites queued",
        "requested": len(body.userIds),
        "invited": len(filtered_targets),
        "inAppQueued": len(target_ids),
        "emailQueued": email_queued,
    }


# ─── LEAVE ──────────────────────────────────────────────────────────────

@router.post("/{group_id}/leave")
async def leave_study_group(
    group_id: str,
    user: dict = Depends(get_current_user),
):
    """Leave a study group"""
    db = get_database()
    user_id = user["_id"]

    if not ObjectId.is_valid(group_id):
        raise HTTPException(status_code=400, detail="Invalid group ID")

    doc = await db[COLLECTION].find_one({"_id": ObjectId(group_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Study group not found")

    if doc["createdBy"] == user_id:
        raise HTTPException(status_code=400, detail="Creator cannot leave. Delete the group instead.")

    if not any(m["userId"] == user_id for m in doc.get("members", [])):
        raise HTTPException(status_code=400, detail="Not a member of this group")

    await db[COLLECTION].update_one(
        {"_id": ObjectId(group_id)},
        {
            "$pull": {"members": {"userId": user_id}},
            "$set": {"updatedAt": datetime.now(timezone.utc)},
        },
    )

    # Re-open if was full
    if not doc.get("isOpen") and len(doc.get("members", [])) <= doc.get("maxMembers", 8):
        await db[COLLECTION].update_one(
            {"_id": ObjectId(group_id)},
            {"$set": {"isOpen": True}},
        )

    updated = await db[COLLECTION].find_one({"_id": ObjectId(group_id)})
    return serialize(updated)


# ─── DELETE ─────────────────────────────────────────────────────────────

@router.delete("/{group_id}")
async def delete_study_group(
    group_id: str,
    user: dict = Depends(get_current_user),
):
    """Delete a study group (creator only)"""
    db = get_database()
    user_id = user["_id"]

    if not ObjectId.is_valid(group_id):
        raise HTTPException(status_code=400, detail="Invalid group ID")

    doc = await db[COLLECTION].find_one({"_id": ObjectId(group_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Study group not found")

    # Fetch current role from DB — JWT claim can be stale after role changes
    db_user = await db["users"].find_one(
        {"_id": ObjectId(user_id)}, {"role": 1}
    ) if ObjectId.is_valid(user_id) else None
    current_role = db_user.get("role", "") if db_user else ""

    # Allow creator or admin to delete
    if doc["createdBy"] != user_id and current_role != "admin":
        raise HTTPException(status_code=403, detail="Only the creator or admin can delete this group")

    await db[COLLECTION].delete_one({"_id": ObjectId(group_id)})
    return {"message": "Study group deleted"}


# ─── MESSAGES (Activity Feed) ──────────────────────────────────────────

@router.post("/{group_id}/messages")
async def add_message(
    group_id: str,
    body: MessageCreate,
    user: dict = Depends(get_current_user),
):
    """Add a message to the group activity feed (members only, max 100)"""
    db = get_database()
    user_id = user["_id"]

    if not ObjectId.is_valid(group_id):
        raise HTTPException(status_code=400, detail="Invalid group ID")

    doc = await db[COLLECTION].find_one({"_id": ObjectId(group_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Study group not found")

    if not any(m["userId"] == user_id for m in doc.get("members", [])):
        raise HTTPException(status_code=403, detail="Only members can post messages")

    user = await db["users"].find_one({"_id": ObjectId(user_id)})
    message = {
        "id": str(ObjectId()),
        "userId": user_id,
        "firstName": user.get("firstName", "") if user else "",
        "lastName": user.get("lastName", "") if user else "",
        "text": sanitize_html(body.text),
        "createdAt": datetime.now(timezone.utc),
    }

    # Push message and keep only the latest 100
    await db[COLLECTION].update_one(
        {"_id": ObjectId(group_id)},
        {
            "$push": {"messages": {"$each": [message], "$slice": -100}},
            "$set": {"updatedAt": datetime.now(timezone.utc)},
        },
    )
    message["createdAt"] = message["createdAt"].isoformat()
    await chat_manager.broadcast(group_id, {"type": "message", "data": message})

    try:
        from app.routers.notifications import create_notification
        sender_name = f"{message.get('firstName', '')} {message.get('lastName', '')}".strip() or "A group member"
        group_name = doc.get("name", "your study group")
        preview = (message.get("text") or "")[:120]
        for member in doc.get("members", []):
            member_id = member.get("userId")
            if member_id and member_id != user_id:
                asyncio.create_task(create_notification(
                    user_id=member_id,
                    type="study_group_message",
                    title=f"New message in {group_name}",
                    message=f"{sender_name}: {preview}" if preview else f"{sender_name} posted a new message.",
                    link="/dashboard/growth/study-groups",
                    related_id=group_id,
                    category="study_groups",
                ))
    except Exception:
        pass

    return message


@router.get("/{group_id}/messages")
async def get_messages(
    group_id: str,
    user: dict = Depends(get_current_user),
):
    """Get messages for a study group (members only)"""
    db = get_database()
    user_id = user["_id"]

    if not ObjectId.is_valid(group_id):
        raise HTTPException(status_code=400, detail="Invalid group ID")

    doc = await db[COLLECTION].find_one({"_id": ObjectId(group_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Study group not found")

    if not any(m["userId"] == user_id for m in doc.get("members", [])):
        raise HTTPException(status_code=403, detail="Only members can view messages")

    messages = doc.get("messages", [])
    for m in messages:
        if isinstance(m.get("createdAt"), datetime):
            m["createdAt"] = m["createdAt"].isoformat()
    return messages


# Separate router: router-level HTTPBearer deps don't work for WebSocket scope
_ws_router = APIRouter(prefix="/api/v1/study-groups", tags=["study-groups"])


@_ws_router.websocket("/{group_id}/ws")
async def websocket_chat(
    group_id: str,
    ws: WebSocket,
    token: str = Query(..., description="JWT access token"),
):
    """Real-time WebSocket chat for a study group (members only)."""
    origin = ws.headers.get("origin")
    if not is_ws_origin_allowed(origin):
        await ws.close(code=1008)
        return

    # Authenticate via query-param token (browsers can't set WS headers)
    try:
        user_data = await verify_firebase_id_token_raw(token)
    except Exception:
        await ws.close(code=4001)
        return

    user_id = user_data.get("sub")
    if not user_id:
        await ws.close(code=4001)
        return

    db = get_database()

    # Block external students (router-level _ipe_gate doesn't cover WebSocket)
    if ObjectId.is_valid(user_id):
        u = await db["users"].find_one(
            {"_id": ObjectId(user_id)},
            {"department": 1, "role": 1},
        )
        if (
            u
            and u.get("role") == "student"
            and u.get("department", "Industrial Engineering") != "Industrial Engineering"
        ):
            await ws.close(code=4003)
            return

    if not ObjectId.is_valid(group_id):
        await ws.close(code=4004)
        return

    doc = await db[COLLECTION].find_one({"_id": ObjectId(group_id)})
    if not doc:
        await ws.close(code=4004)
        return

    if not any(m["userId"] == user_id for m in doc.get("members", [])):
        await ws.close(code=4003)
        return

    user = await db["users"].find_one({"_id": ObjectId(user_id)})
    first_name = user.get("firstName", "") if user else ""
    last_name = user.get("lastName", "") if user else ""

    await chat_manager.connect(group_id, user_id, ws)
    await chat_manager.broadcast(group_id, {
        "type": "presence",
        "data": {"onlineUserIds": chat_manager.online_user_ids(group_id)},
    })
    try:
        while True:
            try:
                data = await ws.receive_json()
            except ValueError:
                continue
            if data.get("type") == "message":
                text = sanitize_html((data.get("text") or "").strip()[:500])
                if not text:
                    continue
                msg = {
                    "id": str(ObjectId()),
                    "userId": user_id,
                    "firstName": first_name,
                    "lastName": last_name,
                    "text": text,
                    "createdAt": datetime.now(timezone.utc),
                }
                await db[COLLECTION].update_one(
                    {"_id": ObjectId(group_id)},
                    {
                        "$push": {"messages": {"$each": [msg], "$slice": -100}},
                        "$set": {"updatedAt": datetime.now(timezone.utc)},
                    },
                )
                msg["createdAt"] = msg["createdAt"].isoformat()
                await chat_manager.broadcast(group_id, {"type": "message", "data": msg})

                try:
                    from app.routers.notifications import create_notification
                    sender_name = f"{first_name} {last_name}".strip() or "A group member"
                    group_name = doc.get("name", "your study group")
                    preview = text[:120]
                    for member in doc.get("members", []):
                        member_id = member.get("userId")
                        if member_id and member_id != user_id:
                            asyncio.create_task(create_notification(
                                user_id=member_id,
                                type="study_group_message",
                                title=f"New message in {group_name}",
                                message=f"{sender_name}: {preview}" if preview else f"{sender_name} posted a new message.",
                                link="/dashboard/growth/study-groups",
                                related_id=group_id,
                                category="study_groups",
                            ))
                except Exception:
                    pass
            elif data.get("type") == "ping":
                await ws.send_json({"type": "pong"})
    except WebSocketDisconnect:
        pass
    finally:
        chat_manager.disconnect(group_id, user_id, ws)
        await chat_manager.broadcast(group_id, {
            "type": "presence",
            "data": {"onlineUserIds": chat_manager.online_user_ids(group_id)},
        })


# ─── STUDY SESSIONS (Scheduling) ───────────────────────────────────────

@router.post("/{group_id}/sessions")
async def add_session(
    group_id: str,
    body: SessionCreate,
    user: dict = Depends(get_current_user),
):
    """Schedule a study session (members only, max 20 upcoming)"""
    db = get_database()
    user_id = user["_id"]

    if not ObjectId.is_valid(group_id):
        raise HTTPException(status_code=400, detail="Invalid group ID")

    doc = await db[COLLECTION].find_one({"_id": ObjectId(group_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Study group not found")

    if not any(m["userId"] == user_id for m in doc.get("members", [])):
        raise HTTPException(status_code=403, detail="Only members can schedule sessions")

    user = await db["users"].find_one({"_id": ObjectId(user_id)})
    creator_name = f"{user.get('firstName', '')} {user.get('lastName', '')}".strip() if user else ""

    session = {
        "id": str(ObjectId()),
        "title": body.title,
        "date": body.date,
        "time": body.time or "",
        "meetupType": body.meetupType,
        "location": body.location if body.meetupType == "physical" else None,
        "meetingLink": body.meetingLink if body.meetupType == "online" else None,
        "agenda": body.agenda,
        "createdBy": user_id,
        "creatorName": creator_name,
        "attendees": [user_id],
        "createdAt": datetime.now(timezone.utc),
    }

    await db[COLLECTION].update_one(
        {"_id": ObjectId(group_id)},
        {
            "$push": {"sessions": {"$each": [session], "$slice": -20}},
            "$set": {"updatedAt": datetime.now(timezone.utc)},
        },
    )
    session["createdAt"] = session["createdAt"].isoformat()

    # Notify other group members about the new session
    try:
        from app.routers.notifications import create_bulk_notifications
        member_ids = [m["userId"] for m in doc.get("members", []) if m["userId"] != user_id]
        if member_ids:
            asyncio.create_task(create_bulk_notifications(
                user_ids=member_ids,
                type="study_group",
                title="New Study Session",
                message=f"{creator_name} scheduled \"{body.title}\" in {doc.get('name', 'your study group')}.",
                link="/dashboard/growth/study-groups",
                category="study_groups",
            ))
    except Exception:
        pass

    return session


@router.delete("/{group_id}/sessions/{session_id}")
async def delete_session(
    group_id: str,
    session_id: str,
    user: dict = Depends(get_current_user),
):
    """Cancel a study session (creator of session or group creator only)"""
    db = get_database()
    user_id = user["_id"]

    if not ObjectId.is_valid(group_id):
        raise HTTPException(status_code=400, detail="Invalid group ID")

    doc = await db[COLLECTION].find_one({"_id": ObjectId(group_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Study group not found")

    session = next((s for s in doc.get("sessions", []) if s.get("id") == session_id), None)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    if session.get("createdBy") != user_id and doc["createdBy"] != user_id:
        raise HTTPException(status_code=403, detail="Only the session creator or group creator can cancel")

    await db[COLLECTION].update_one(
        {"_id": ObjectId(group_id)},
        {
            "$pull": {"sessions": {"id": session_id}},
            "$set": {"updatedAt": datetime.now(timezone.utc)},
        },
    )
    return {"message": "Session cancelled"}


@router.post("/{group_id}/sessions/{session_id}/rsvp")
async def rsvp_session(
    group_id: str,
    session_id: str,
    user: dict = Depends(get_current_user),
):
    """Toggle RSVP for a study session (members only)"""
    db = get_database()
    user_id = user["_id"]

    if not ObjectId.is_valid(group_id):
        raise HTTPException(status_code=400, detail="Invalid group ID")

    doc = await db[COLLECTION].find_one({"_id": ObjectId(group_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Study group not found")

    if not any(m["userId"] == user_id for m in doc.get("members", [])):
        raise HTTPException(status_code=403, detail="Only members can RSVP")

    session = next((s for s in doc.get("sessions", []) if s.get("id") == session_id), None)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    attendees = session.get("attendees", [])
    if user_id in attendees:
        # Remove RSVP
        await db[COLLECTION].update_one(
            {"_id": ObjectId(group_id), "sessions.id": session_id},
            {"$pull": {"sessions.$.attendees": user_id}},
        )
        return {"attending": False}
    else:
        # Add RSVP
        await db[COLLECTION].update_one(
            {"_id": ObjectId(group_id), "sessions.id": session_id},
            {"$push": {"sessions.$.attendees": user_id}},
        )
        return {"attending": True}


# ─── SHARED RESOURCES ──────────────────────────────────────────────────

@router.post("/{group_id}/resources")
async def add_resource(
    group_id: str,
    body: ResourceCreate,
    user: dict = Depends(get_current_user),
):
    """Share a resource link in the group (members only, max 30)"""
    db = get_database()
    user_id = user["_id"]

    if not ObjectId.is_valid(group_id):
        raise HTTPException(status_code=400, detail="Invalid group ID")

    doc = await db[COLLECTION].find_one({"_id": ObjectId(group_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Study group not found")

    if not any(m["userId"] == user_id for m in doc.get("members", [])):
        raise HTTPException(status_code=403, detail="Only members can share resources")

    user = await db["users"].find_one({"_id": ObjectId(user_id)})
    resource = {
        "id": str(ObjectId()),
        "title": body.title,
        "url": body.url,
        "type": body.type,
        "addedBy": user_id,
        "addedByName": f"{user.get('firstName', '')} {user.get('lastName', '')}".strip() if user else "",
        "createdAt": datetime.now(timezone.utc),
    }

    await db[COLLECTION].update_one(
        {"_id": ObjectId(group_id)},
        {
            "$push": {"resources": {"$each": [resource], "$slice": -30}},
            "$set": {"updatedAt": datetime.now(timezone.utc)},
        },
    )
    resource["createdAt"] = resource["createdAt"].isoformat()

    # Notify other group members about the shared resource
    try:
        from app.routers.notifications import create_bulk_notifications
        sharer_name = resource.get("addedByName", "Someone")
        member_ids = [m["userId"] for m in doc.get("members", []) if m["userId"] != user_id]
        if member_ids:
            asyncio.create_task(create_bulk_notifications(
                user_ids=member_ids,
                type="study_group",
                title="New Resource Shared",
                message=f"{sharer_name} shared \"{body.title}\" in {doc.get('name', 'your study group')}.",
                link="/dashboard/growth/study-groups",
                category="study_groups",
            ))
    except Exception:
        pass

    return resource


@router.delete("/{group_id}/resources/{resource_id}")
async def delete_resource(
    group_id: str,
    resource_id: str,
    user: dict = Depends(get_current_user),
):
    """Remove a shared resource (adder or group creator only)"""
    db = get_database()
    user_id = user["_id"]

    if not ObjectId.is_valid(group_id):
        raise HTTPException(status_code=400, detail="Invalid group ID")

    doc = await db[COLLECTION].find_one({"_id": ObjectId(group_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Study group not found")

    resource = next((r for r in doc.get("resources", []) if r.get("id") == resource_id), None)
    if not resource:
        raise HTTPException(status_code=404, detail="Resource not found")

    if resource.get("addedBy") != user_id and doc["createdBy"] != user_id:
        raise HTTPException(status_code=403, detail="Only the resource owner or group creator can remove")

    await db[COLLECTION].update_one(
        {"_id": ObjectId(group_id)},
        {
            "$pull": {"resources": {"id": resource_id}},
            "$set": {"updatedAt": datetime.now(timezone.utc)},
        },
    )
    return {"message": "Resource removed"}
