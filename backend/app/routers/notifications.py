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
from app.core.notification_utils import should_notify_category
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
    category: str | None = None,
) -> str | None:
    """
    Create an in-app notification for a user.
    
    If `category` is provided, checks the user's notificationCategories
    preference first. Skips creation if the category is disabled.

    Called from other routers (announcements, payments, events, etc.)
    Returns the inserted notification ID, or None if skipped.
    """
    db = get_database()

    # Check category preference if a category was specified
    if category:
        user_doc = await db.users.find_one(
            {"_id": ObjectId(user_id)},
            {"notificationCategories": 1},
        )
        if user_doc and not should_notify_category(user_doc, category):
            logger.debug(f"Skipping notification for user {user_id}: category '{category}' disabled")
            return None

    doc = {
        "userId": user_id,
        "type": type,
        "title": title,
        "message": message,
        "link": link,
        "relatedId": related_id,
        "category": category,
        "isRead": False,
        "createdAt": datetime.now(timezone.utc),
    }
    result = await db.notifications.insert_one(doc)

    # Push SSE event so connected clients can refresh their notification bell
    try:
        from app.routers.sse import publish
        publish("notification_created", {
            "id": str(result.inserted_id),
            "userId": user_id,
            "type": type,
            "title": title,
        })
    except Exception:
        pass  # SSE is non-critical

    # Fire Web Push notification (fire-and-forget)
    try:
        from app.routers.push_notifications import send_push_to_user, is_push_enabled
        if is_push_enabled():
            import asyncio
            asyncio.create_task(send_push_to_user(
                user_id=user_id,
                title=title,
                body=message,
                url=link,
                tag=type,
            ))
    except Exception:
        logger.warning("Failed to trigger push notification task for userId=%s", user_id, exc_info=True)

    return str(result.inserted_id)


async def create_bulk_notifications(
    user_ids: list[str],
    type: str,
    title: str,
    message: str,
    link: str | None = None,
    related_id: str | None = None,
    category: str | None = None,
) -> int:
    """
    Create notifications for multiple users at once.

    If `category` is provided, filters out users who have disabled that
    category in their notificationCategories preferences.

    Returns the count of inserted notifications.
    """
    if not user_ids:
        return 0
    db = get_database()

    # Filter by category preference if specified
    if category:
        object_ids = [ObjectId(uid) for uid in user_ids if ObjectId.is_valid(str(uid))]
        allowed_ids = []
        if object_ids:
            users_cursor = db.users.find(
                {"_id": {"$in": object_ids}},
                {"notificationCategories": 1},
            )
            async for u in users_cursor:
                if should_notify_category(u, category):
                    allowed_ids.append(str(u["_id"]))
        if not allowed_ids:
            logger.debug(f"Bulk notification skipped entirely: all {len(user_ids)} users disabled category '{category}'")
            return 0
        user_ids = allowed_ids

    now = datetime.now(timezone.utc)
    docs = [
        {
            "userId": uid,
            "type": type,
            "title": title,
            "message": message,
            "link": link,
            "relatedId": related_id,
            "category": category,
            "isRead": False,
            "createdAt": now,
        }
        for uid in user_ids
    ]
    result = await db.notifications.insert_many(docs)

    # Push SSE event so connected clients can refresh their notification bell
    try:
        from app.routers.sse import publish
        publish("notification_created", {
            "type": type,
            "title": title,
            "count": len(result.inserted_ids),
        })
    except Exception:
        pass  # SSE is non-critical

    # Fire Web Push notifications (fire-and-forget)
    try:
        from app.routers.push_notifications import send_push_to_users, is_push_enabled
        if is_push_enabled():
            import asyncio
            asyncio.create_task(send_push_to_users(
                user_ids=user_ids,
                title=title,
                body=message,
                url=link,
                tag=type,
            ))
    except Exception:
        logger.warning("Failed to trigger bulk push notification task", exc_info=True)

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

    # Accept both string IDs (new) and ObjectId (legacy data)
    id_variants: list = [user_id]
    if ObjectId.is_valid(str(user_id)):
        id_variants.append(ObjectId(str(user_id)))
    query: dict = {"userId": {"$in": id_variants}}
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

    # Accept both string IDs (new) and ObjectId (legacy data)
    id_variants: list = [user_id]
    if ObjectId.is_valid(str(user_id)):
        id_variants.append(ObjectId(str(user_id)))
    count = await db.notifications.count_documents({"userId": {"$in": id_variants}, "isRead": False})
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

    id_variants: list = [user_id]
    if ObjectId.is_valid(str(user_id)):
        id_variants.append(ObjectId(str(user_id)))

    result = await db.notifications.update_one(
        {"_id": ObjectId(notification_id), "userId": {"$in": id_variants}},
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

    # Accept both string IDs (new) and ObjectId (legacy data)
    id_variants: list = [user_id]
    if ObjectId.is_valid(str(user_id)):
        id_variants.append(ObjectId(str(user_id)))
    result = await db.notifications.update_many(
        {"userId": {"$in": id_variants}, "isRead": False},
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

    id_variants: list = [user_id]
    if ObjectId.is_valid(str(user_id)):
        id_variants.append(ObjectId(str(user_id)))

    result = await db.notifications.delete_one(
        {"_id": ObjectId(notification_id), "userId": {"$in": id_variants}}
    )
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Notification not found")
    return {"message": "Notification deleted"}
