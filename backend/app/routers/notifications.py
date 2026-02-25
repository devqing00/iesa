"""
Notification Router

CRUD operations for in-app notifications.
Provides a helper `create_notification()` for other routers to use.
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from datetime import datetime, timezone
from typing import Optional
from bson import ObjectId
import logging

from app.core.security import get_current_user
from app.db import get_database

logger = logging.getLogger("iesa_backend")

router = APIRouter(prefix="/api/v1/notifications", tags=["Notifications"])


# ─── Helper (for other routers to import) ────────────────────────

async def create_notification(
    user_id: str,
    type: str,
    title: str,
    message: str,
    link: str | None = None,
    related_id: str | None = None,
) -> str:
    """
    Create an in-app notification for a user.
    
    Called from other routers (announcements, payments, events, etc.)
    Returns the inserted notification ID.
    """
    db = get_database()
    doc = {
        "userId": user_id,
        "type": type,
        "title": title,
        "message": message,
        "link": link,
        "relatedId": related_id,
        "isRead": False,
        "createdAt": datetime.now(timezone.utc),
    }
    result = await db.notifications.insert_one(doc)
    return str(result.inserted_id)


async def create_bulk_notifications(
    user_ids: list[str],
    type: str,
    title: str,
    message: str,
    link: str | None = None,
    related_id: str | None = None,
) -> int:
    """
    Create notifications for multiple users at once.
    Returns the count of inserted notifications.
    """
    if not user_ids:
        return 0
    db = get_database()
    now = datetime.now(timezone.utc)
    docs = [
        {
            "userId": uid,
            "type": type,
            "title": title,
            "message": message,
            "link": link,
            "relatedId": related_id,
            "isRead": False,
            "createdAt": now,
        }
        for uid in user_ids
    ]
    result = await db.notifications.insert_many(docs)
    return len(result.inserted_ids)


# ─── Endpoints ───────────────────────────────────────────────────

@router.get("/")
async def list_notifications(
    current_user: dict = Depends(get_current_user),
    limit: int = Query(30, ge=1, le=100),
    unread_only: bool = Query(False),
):
    """List notifications for the current user (most recent first)."""
    db = get_database()
    user_id = current_user.get("uid") or current_user.get("_id")

    query: dict = {"userId": user_id}
    if unread_only:
        query["isRead"] = False

    cursor = db.notifications.find(query).sort("createdAt", -1).limit(limit)
    notifications = []
    async for n in cursor:
        n["_id"] = str(n["_id"])
        notifications.append(n)
    return notifications


@router.get("/unread-count")
async def get_unread_count(
    current_user: dict = Depends(get_current_user),
):
    """Get the count of unread notifications."""
    db = get_database()
    user_id = current_user.get("uid") or current_user.get("_id")
    count = await db.notifications.count_documents({"userId": user_id, "isRead": False})
    return {"count": count}


@router.patch("/{notification_id}/read")
async def mark_as_read(
    notification_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Mark a single notification as read."""
    if not ObjectId.is_valid(notification_id):
        raise HTTPException(status_code=400, detail="Invalid notification ID")
    
    db = get_database()
    user_id = current_user.get("uid") or current_user.get("_id")

    result = await db.notifications.update_one(
        {"_id": ObjectId(notification_id), "userId": user_id},
        {"$set": {"isRead": True}},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Notification not found")
    return {"message": "Marked as read"}


@router.post("/mark-all-read")
async def mark_all_read(
    current_user: dict = Depends(get_current_user),
):
    """Mark all notifications as read for the current user."""
    db = get_database()
    user_id = current_user.get("uid") or current_user.get("_id")

    result = await db.notifications.update_many(
        {"userId": user_id, "isRead": False},
        {"$set": {"isRead": True}},
    )
    return {"message": f"Marked {result.modified_count} notifications as read"}


@router.delete("/{notification_id}")
async def delete_notification(
    notification_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Delete a single notification."""
    if not ObjectId.is_valid(notification_id):
        raise HTTPException(status_code=400, detail="Invalid notification ID")
    
    db = get_database()
    user_id = current_user.get("uid") or current_user.get("_id")

    result = await db.notifications.delete_one(
        {"_id": ObjectId(notification_id), "userId": user_id}
    )
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Notification not found")
    return {"message": "Notification deleted"}
