"""
Student Direct Messages Router

Lightweight student-to-student messaging.
Messages are stored in the `direct_messages` collection.
Conversations are implicitly defined by (user_a, user_b) pair.
"""

from datetime import datetime, timezone
from typing import Optional

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.core.security import get_current_user, require_ipe_student
from app.db import get_database

router = APIRouter(
    prefix="/api/v1/messages",
    tags=["Messages"],
    dependencies=[Depends(require_ipe_student)],
)


# ─── Models ──────────────────────────────────────────

class SendMessageBody(BaseModel):
    recipientId: str
    content: str = Field(..., min_length=1, max_length=2000)


# ─── Helpers ─────────────────────────────────────────

def _conversation_key(uid_a: str, uid_b: str) -> str:
    """Deterministic conversation key regardless of sender/recipient order."""
    return "|".join(sorted([uid_a, uid_b]))


# ─── Endpoints ───────────────────────────────────────

@router.post("/send")
async def send_message(
    body: SendMessageBody,
    user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    """Send a direct message to another student."""
    sender_id = str(user["_id"])

    if sender_id == body.recipientId:
        raise HTTPException(status_code=400, detail="Cannot message yourself")

    if not ObjectId.is_valid(body.recipientId):
        raise HTTPException(status_code=400, detail="Invalid recipient ID")

    # Verify recipient exists
    recipient = await db["users"].find_one(
        {"_id": ObjectId(body.recipientId)},
        {"firstName": 1, "lastName": 1},
    )
    if not recipient:
        raise HTTPException(status_code=404, detail="Recipient not found")

    conv_key = _conversation_key(sender_id, body.recipientId)
    now = datetime.now(timezone.utc)

    doc = {
        "conversationKey": conv_key,
        "senderId": sender_id,
        "recipientId": body.recipientId,
        "content": body.content.strip(),
        "isRead": False,
        "createdAt": now,
    }
    result = await db["direct_messages"].insert_one(doc)

    return {
        "id": str(result.inserted_id),
        "conversationKey": conv_key,
        "createdAt": now.isoformat(),
    }


@router.get("/conversations")
async def list_conversations(
    user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    """List all conversations for the current user, with last message preview."""
    user_id = str(user["_id"])

    # Aggregate: group by conversationKey, get last message
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
                "lastSenderId": {"$first": "$senderId"},
                "lastAt": {"$first": "$createdAt"},
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

    conversations = []
    async for doc in db["direct_messages"].aggregate(pipeline):
        conv_key: str = doc["_id"]
        parts = conv_key.split("|")
        other_id = parts[1] if parts[0] == user_id else parts[0]

        # Get other user info
        other_user = await db["users"].find_one(
            {"_id": ObjectId(other_id)},
            {"firstName": 1, "lastName": 1, "email": 1},
        )
        other_name = "Unknown"
        other_email = ""
        if other_user:
            other_name = f"{other_user.get('firstName', '')} {other_user.get('lastName', '')}".strip()
            other_email = other_user.get("email", "")

        conversations.append({
            "conversationKey": conv_key,
            "otherUserId": other_id,
            "otherUserName": other_name,
            "otherUserEmail": other_email,
            "lastMessage": doc["lastMessage"][:100],
            "lastSenderId": doc["lastSenderId"],
            "lastAt": doc["lastAt"].isoformat() if doc["lastAt"] else None,
            "unreadCount": doc["unreadCount"],
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
        messages.append({
            "id": str(doc["_id"]),
            "senderId": doc["senderId"],
            "recipientId": doc["recipientId"],
            "content": doc["content"],
            "isRead": doc.get("isRead", False),
            "createdAt": doc["createdAt"].isoformat(),
        })

    # Reverse to chronological order (oldest first at top)
    messages.reverse()

    # Get other user info
    other_user = await db["users"].find_one(
        {"_id": ObjectId(other_user_id)},
        {"firstName": 1, "lastName": 1, "email": 1},
    )

    return {
        "messages": messages,
        "otherUser": {
            "id": other_user_id,
            "name": f"{other_user.get('firstName', '')} {other_user.get('lastName', '')}".strip() if other_user else "Unknown",
            "email": other_user.get("email", "") if other_user else "",
        },
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

    result = await db["direct_messages"].update_many(
        {"conversationKey": conv_key, "recipientId": user_id, "isRead": False},
        {"$set": {"isRead": True}},
    )

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

    cursor = db["users"].find(
        {
            "_id": {"$ne": ObjectId(user_id)},
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

    results = []
    async for u in cursor:
        results.append({
            "id": str(u["_id"]),
            "name": f"{u.get('firstName', '')} {u.get('lastName', '')}".strip(),
            "email": u.get("email", ""),
            "level": u.get("currentLevel") or u.get("level"),
        })

    return results
