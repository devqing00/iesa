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
import re
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from app.core.security import get_current_user
from app.core.notification_utils import should_notify_category
from app.db import get_database

logger = logging.getLogger("iesa_backend")

router = APIRouter(prefix="/api/v1/notifications", tags=["Notifications"])


def _append_query_params(url: str, params: dict[str, str]) -> str:
    if not url:
        return url
    parts = urlsplit(url)
    existing = dict(parse_qsl(parts.query, keep_blank_values=True))
    existing.update({k: v for k, v in params.items() if v})
    query = urlencode(existing)
    return urlunsplit((parts.scheme, parts.netloc, parts.path, query, parts.fragment))


def _resolve_notification_link(
    type_: str,
    link: str | None,
    related_id: str | None,
    title: str | None = None,
) -> str:
    default_links = {
        "announcement": "/dashboard/announcements",
        "event": "/dashboard/events",
        "payment": "/dashboard/payments",
        "transfer_approved": "/dashboard/payments?tab=bank-transfer",
        "transfer_rejected": "/dashboard/payments?tab=bank-transfer",
        "message": "/dashboard/messages",
        "message_request": "/dashboard/messages",
        "message_request_accepted": "/dashboard/messages",
        "study_group": "/dashboard/study-groups",
        "study_group_message": "/dashboard/study-groups",
        "timetable": "/dashboard/timetable",
        "timetable_reminder": "/dashboard/timetable",
        "role_assigned": "/dashboard/profile",
        "enrollment": "/dashboard/archive",
        "system": "/dashboard",
    }

    base = (link or "").strip() or default_links.get(type_, "/dashboard")
    route_params = {
        "source": "notification",
        "notificationType": type_,
    }

    if related_id:
        key_map = {
            "announcement": "announcementId",
            "event": "eventId",
            "payment": "paymentId",
            "transfer_approved": "paymentId",
            "transfer_rejected": "paymentId",
            "timetable": "classId",
            "timetable_reminder": "classId",
            "study_group": "groupId",
            "study_group_message": "groupId",
        }
        key = key_map.get(type_)
        if key:
            route_params[key] = related_id

    if type_ in {"message", "message_request", "message_request_accepted"} and title:
        route_params["context"] = "notification"
        route_params["contextLabel"] = title

    return _append_query_params(base, route_params)


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

    normalized_link = _resolve_notification_link(type, link, related_id, title)

    doc = {
        "userId": user_id,
        "type": type,
        "title": title,
        "message": message,
        "link": normalized_link,
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
        }, target_user_id=user_id)
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
                url=normalized_link,
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

    normalized_link = _resolve_notification_link(type, link, related_id, title)
    now = datetime.now(timezone.utc)
    docs = [
        {
            "userId": uid,
            "type": type,
            "title": title,
            "message": message,
            "link": normalized_link,
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
                url=normalized_link,
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
    has_tags = False
    async for n in cursor:
        n["_id"] = str(n["_id"])
        if "{{" in str(n.get("title", "")) or "{{" in str(n.get("message", "")):
            has_tags = True
        notifications.append(n)

    if has_tags and notifications:
        user_query_id = ObjectId(str(user_id)) if ObjectId.is_valid(str(user_id)) else str(user_id)
        user_doc = await db.users.find_one(
            {"_id": user_query_id},
            {"firstName": 1, "lastName": 1, "matricNumber": 1, "currentLevel": 1, "department": 1, "email": 1}
        )
        if user_doc:
            first_name = str(user_doc.get("firstName") or "").strip()
            last_name = str(user_doc.get("lastName") or "").strip()
            full_name = f"{first_name} {last_name}".strip() or "Student"
            matric_no = str(user_doc.get("matricNumber") or "").strip()
            level = str(user_doc.get("currentLevel") or "").strip()
            dept = str(user_doc.get("department") or "Industrial and Production Engineering").strip()
            email_val = str(user_doc.get("email") or current_user.get("email") or "").strip()

            def _repl(m):
                k = m.group(1).lower().strip()
                if k in ("first_name", "firstname"):
                    return first_name or "Student"
                if k in ("last_name", "lastname"):
                    return last_name or ""
                if k in ("student_name", "studentname", "name", "full_name", "fullname"):
                    return full_name
                if k in ("matric_no", "matricno", "matric_number", "matricnumber"):
                    return matric_no or "N/A"
                if k in ("level", "current_level", "currentlevel"):
                    return level or "IPE"
                if k in ("department", "dept"):
                    return dept
                if k == "email":
                    return email_val
                return m.group(0)

            for n in notifications:
                if "{{" in str(n.get("title", "")):
                    n["title"] = re.sub(r'\{\{\s*([\w]+)\s*\}\}', _repl, str(n["title"]))
                if "{{" in str(n.get("message", "")):
                    n["message"] = re.sub(r'\{\{\s*([\w]+)\s*\}\}', _repl, str(n["message"]))

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
