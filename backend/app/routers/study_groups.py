"""
Study Groups Router - Find and join study partners

REST API endpoints (no WebSockets - compatible with Render free tier).
Frontend uses polling for real-time updates.
"""

from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from bson import ObjectId

from ..core.security import verify_token
from ..core.database import get_database

router = APIRouter(prefix="/api/v1/study-groups", tags=["study-groups"])

COLLECTION = "study_groups"


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
    user_data: dict = Depends(verify_token),
):
    """List study groups with optional filters"""
    db = get_database()
    query: dict = {}

    if course:
        query["courseCode"] = {"$regex": course, "$options": "i"}
    if level:
        query["level"] = level
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"description": {"$regex": search, "$options": "i"}},
            {"courseCode": {"$regex": search, "$options": "i"}},
            {"tags": {"$regex": search, "$options": "i"}},
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
    user_data: dict = Depends(verify_token),
):
    """List groups I created or am a member of"""
    db = get_database()
    user_id = user_data["sub"]

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
    user_data: dict = Depends(verify_token),
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
    body: dict,
    user_data: dict = Depends(verify_token),
):
    """Create a new study group"""
    db = get_database()
    user_id = user_data["sub"]

    # Look up creator's name
    user = await db["users"].find_one({"_id": ObjectId(user_id)})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    creator_name = f"{user.get('firstName', '')} {user.get('lastName', '')}".strip()

    now = datetime.utcnow()
    doc = {
        "name": body.get("name", "").strip()[:100],
        "courseCode": body.get("courseCode", "").strip().upper()[:20],
        "courseName": (body.get("courseName") or "").strip()[:200] or None,
        "description": (body.get("description") or "").strip()[:500] or None,
        "maxMembers": max(2, min(20, body.get("maxMembers", 8))),
        "meetingDay": body.get("meetingDay"),
        "meetingTime": body.get("meetingTime"),
        "meetingLocation": (body.get("meetingLocation") or "").strip()[:200] or None,
        "level": body.get("level"),
        "tags": (body.get("tags") or [])[:5],
        "isOpen": body.get("isOpen", True),
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

    if not doc["name"]:
        raise HTTPException(status_code=422, detail="Group name is required")
    if not doc["courseCode"]:
        raise HTTPException(status_code=422, detail="Course code is required")

    result = await db[COLLECTION].insert_one(doc)
    doc["_id"] = result.inserted_id
    return serialize(doc)


# ─── UPDATE ─────────────────────────────────────────────────────────────

@router.put("/{group_id}")
async def update_study_group(
    group_id: str,
    body: dict,
    user_data: dict = Depends(verify_token),
):
    """Update a study group (creator only)"""
    db = get_database()
    user_id = user_data["sub"]

    if not ObjectId.is_valid(group_id):
        raise HTTPException(status_code=400, detail="Invalid group ID")

    doc = await db[COLLECTION].find_one({"_id": ObjectId(group_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Study group not found")
    if doc["createdBy"] != user_id:
        raise HTTPException(status_code=403, detail="Only the creator can edit this group")

    updates: dict = {"updatedAt": datetime.utcnow()}
    for field in ["name", "description", "meetingDay", "meetingTime", "meetingLocation", "tags", "isOpen", "maxMembers"]:
        if field in body:
            updates[field] = body[field]

    await db[COLLECTION].update_one({"_id": ObjectId(group_id)}, {"$set": updates})
    updated = await db[COLLECTION].find_one({"_id": ObjectId(group_id)})
    return serialize(updated)


# ─── JOIN ───────────────────────────────────────────────────────────────

@router.post("/{group_id}/join")
async def join_study_group(
    group_id: str,
    user_data: dict = Depends(verify_token),
):
    """Join a study group"""
    db = get_database()
    user_id = user_data["sub"]

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
        "joinedAt": datetime.utcnow(),
    }

    await db[COLLECTION].update_one(
        {"_id": ObjectId(group_id)},
        {
            "$push": {"members": member},
            "$set": {"updatedAt": datetime.utcnow()},
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
    user_data: dict = Depends(verify_token),
):
    """Leave a study group"""
    db = get_database()
    user_id = user_data["sub"]

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
            "$set": {"updatedAt": datetime.utcnow()},
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
    user_data: dict = Depends(verify_token),
):
    """Delete a study group (creator only)"""
    db = get_database()
    user_id = user_data["sub"]

    if not ObjectId.is_valid(group_id):
        raise HTTPException(status_code=400, detail="Invalid group ID")

    doc = await db[COLLECTION].find_one({"_id": ObjectId(group_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Study group not found")

    # Allow creator or admin to delete
    if doc["createdBy"] != user_id and user_data.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Only the creator or admin can delete this group")

    await db[COLLECTION].delete_one({"_id": ObjectId(group_id)})
    return {"message": "Study group deleted"}
