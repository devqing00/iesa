"""
Study Groups Router - Find and join study partners

REST API endpoints (no WebSockets - compatible with Render free tier).
Frontend uses polling for real-time updates.
"""

from datetime import datetime, timezone
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query, WebSocket, WebSocketDisconnect
from pydantic import BaseModel, Field, field_validator
from bson import ObjectId
import re

from ..core.security import verify_token, get_current_user
from ..core.sanitization import sanitize_html
from ..core.security import verify_firebase_id_token_raw
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
    courseCode: str = Field(..., min_length=1, max_length=20)
    courseName: Optional[str] = Field(None, max_length=200)
    description: Optional[str] = Field(None, max_length=500)
    maxMembers: int = Field(8, ge=2, le=20)
    meetingDay: Optional[str] = None
    meetingTime: Optional[str] = None
    meetingLocation: Optional[str] = Field(None, max_length=200)
    level: Optional[str] = None
    tags: Optional[List[str]] = Field(None, max_length=5)
    isOpen: bool = True

    @field_validator("name", "courseCode")
    @classmethod
    def strip_whitespace(cls, v: str) -> str:
        return v.strip()

    @field_validator("tags")
    @classmethod
    def limit_tags(cls, v: Optional[List[str]]) -> Optional[List[str]]:
        if v is not None:
            return v[:5]
        return v


class StudyGroupUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=100)
    description: Optional[str] = Field(None, max_length=500)
    meetingDay: Optional[str] = None
    meetingTime: Optional[str] = None
    meetingLocation: Optional[str] = Field(None, max_length=200)
    tags: Optional[List[str]] = None
    isOpen: Optional[bool] = None
    maxMembers: Optional[int] = Field(None, ge=2, le=20)
    pinnedNote: Optional[str] = Field(None, max_length=500)


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
    location: Optional[str] = Field(None, max_length=200)
    agenda: Optional[str] = Field(None, max_length=500)

    @field_validator("title")
    @classmethod
    def strip_title(cls, v: str) -> str:
        return v.strip()


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

    async def connect(self, group_id: str, ws: WebSocket):
        await ws.accept()
        self.connections.setdefault(group_id, []).append(ws)

    def disconnect(self, group_id: str, ws: WebSocket):
        if group_id in self.connections:
            self.connections[group_id] = [
                c for c in self.connections[group_id] if c is not ws
            ]

    async def broadcast(self, group_id: str, data: dict):
        for ws in list(self.connections.get(group_id, [])):
            try:
                await ws.send_json(data)
            except Exception:
                pass


chat_manager = ChatManager()


# ─── Helpers ────────────────────────────────────────────────────────────

def serialize(doc: dict) -> dict:
    """Convert MongoDB document to JSON-serializable dict"""
    doc["id"] = str(doc.pop("_id"))
    doc["createdAt"] = doc.get("createdAt", "").isoformat() if isinstance(doc.get("createdAt"), datetime) else str(doc.get("createdAt", ""))
    doc["updatedAt"] = doc.get("updatedAt", "").isoformat() if isinstance(doc.get("updatedAt"), datetime) else str(doc.get("updatedAt", ""))
    for m in doc.get("members", []):
        if isinstance(m.get("joinedAt"), datetime):
            m["joinedAt"] = m["joinedAt"].isoformat()
    return doc


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
    query: dict = {}

    if course:
        query["courseCode"] = {"$regex": re.escape(course), "$options": "i"}
    if level:
        query["level"] = level
    if search:
        escaped = re.escape(search)
        query["$or"] = [
            {"name": {"$regex": escaped, "$options": "i"}},
            {"description": {"$regex": escaped, "$options": "i"}},
            {"courseCode": {"$regex": escaped, "$options": "i"}},
            {"tags": {"$regex": escaped, "$options": "i"}},
        ]
    if open_only:
        query["isOpen"] = True

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
    doc = {
        "name": body.name,
        "courseCode": body.courseCode.upper(),
        "courseName": body.courseName,
        "description": body.description,
        "maxMembers": body.maxMembers,
        "meetingDay": body.meetingDay,
        "meetingTime": body.meetingTime,
        "meetingLocation": body.meetingLocation,
        "level": body.level,
        "tags": body.tags or [],
        "isOpen": body.isOpen,
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

    await db[COLLECTION].update_one({"_id": ObjectId(group_id)}, {"$set": updates})
    updated = await db[COLLECTION].find_one({"_id": ObjectId(group_id)})
    return serialize(updated)


# ─── JOIN ───────────────────────────────────────────────────────────────

@router.post("/{group_id}/join")
async def join_study_group(
    group_id: str,
    user: dict = Depends(get_current_user),
):
    """Join a study group"""
    db = get_database()
    user_id = user["_id"]

    if not ObjectId.is_valid(group_id):
        raise HTTPException(status_code=400, detail="Invalid group ID")

    doc = await db[COLLECTION].find_one({"_id": ObjectId(group_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Study group not found")

    if not doc.get("isOpen", True):
        raise HTTPException(status_code=400, detail="This group is not accepting new members")

    # Check if already a member
    if any(m["userId"] == user_id for m in doc.get("members", [])):
        raise HTTPException(status_code=400, detail="Already a member of this group")

    # Check max members
    if len(doc.get("members", [])) >= doc.get("maxMembers", 8):
        raise HTTPException(status_code=400, detail="Group is full")

    user = await db["users"].find_one({"_id": ObjectId(user_id)})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

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
    return serialize(updated)


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

    await chat_manager.connect(group_id, ws)
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
            elif data.get("type") == "ping":
                await ws.send_json({"type": "pong"})
    except WebSocketDisconnect:
        pass
    finally:
        chat_manager.disconnect(group_id, ws)


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
        "location": body.location,
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
