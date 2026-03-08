"""
Announcements Router - Session-Aware Communications

CRITICAL: All announcements are session-scoped.
Announcements are specific to an academic session and can be targeted to specific levels.
"""

from fastapi import APIRouter, HTTPException, Depends, status, Query
from typing import List, Optional
from datetime import datetime, timezone
from bson import ObjectId
import asyncio
import logging
import re
from app.core.error_handling import fire_and_forget

from app.models.announcement import (
    Announcement, AnnouncementCreate, AnnouncementUpdate, AnnouncementWithStatus
)
from app.db import get_database
from app.core.security import get_current_user
from app.core.permissions import require_permission
from app.core.sanitization import sanitize_html, validate_no_scripts
from app.core.audit import AuditLogger
from app.core.email import send_announcement_email
from app.core.notification_utils import get_notification_emails, should_send_email, should_send_in_app

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/announcements", tags=["Announcements"])

def _normalize_levels(levels: list) -> list:
    """
    Normalise level values to canonical '\u202fNL' string format.
    Handles legacy integer levels (300 → '300L') and existing strings ('300L' → '300L').
    """
    out = []
    for lv in levels:
        s = str(lv).strip()
        if s.isdigit():
            out.append(f"{s}L")
        elif s.upper().endswith("L") and s[:-1].isdigit():
            out.append(s)  # already canonical
        else:
            out.append(s)
    return out


async def _fire_announcement_notifications(ann_doc: dict, db) -> None:
    """
    Shared helper: create in-app notifications for students + all admin/exco users
    for a published announcement.
    Idempotent — safe to call multiple times (callers should check if already sent).
    """
    try:
        from app.routers.notifications import create_bulk_notifications

        ann_id = str(ann_doc.get("_id", ""))
        target_levels = _normalize_levels(ann_doc.get("targetLevels") or [])
        session_id = ann_doc.get("sessionId", "")
        notif_audience = ann_doc.get("targetAudience") or "all"
        enrollments_coll = db["enrollments"]

        logger.info(
            "[NOTIF] '%s': sessionId=%s levels=%s audience=%s",
            ann_doc.get("title"), session_id, target_levels or "ALL", notif_audience,
        )

        if target_levels:
            enrolled = await enrollments_coll.find(
                {"sessionId": session_id, "level": {"$in": target_levels}, "isActive": True}
            ).to_list(length=None)
        else:
            enrolled = await enrollments_coll.find(
                {"sessionId": session_id, "isActive": True}
            ).to_list(length=None)

        student_ids = list({str(e.get("studentId") or e.get("userId") or e["_id"]) for e in enrolled})

        # Fallback: no enrollments + all-levels → notify all student users
        if not student_ids and not target_levels:
            logger.warning("[NOTIF] No enrollments for session %s — using all student users", session_id)
            all_students = await db["users"].find(
                {"role": "student"}, {"_id": 1, "department": 1}
            ).to_list(length=None)
            student_ids = [str(u["_id"]) for u in all_students]

        # Filter by department if audience is targeted
        if notif_audience != "all" and student_ids:
            dept_query: dict = {"_id": {"$in": [ObjectId(sid) for sid in student_ids]}}
            if notif_audience == "ipe":
                dept_query["department"] = "Industrial Engineering"
            elif notif_audience == "external":
                dept_query["department"] = {"$ne": "Industrial Engineering"}
            matched = await db["users"].find(dept_query, {"_id": 1}).to_list(length=None)
            student_ids = [str(u["_id"]) for u in matched]

        # Fetch admin/exco IDs upfront so we can exclude them from the student path
        # (admins who are also enrolled get exactly one notification — the admin-link variant)
        admin_users = await db["users"].find(
            {"role": {"$in": ["admin", "exco"]}}, {"_id": 1}
        ).to_list(length=None)
        admin_ids = [str(u["_id"]) for u in admin_users]
        admin_id_set = set(admin_ids)

        # Remove admins/exco from student set to avoid duplicates
        student_ids = [sid for sid in student_ids if sid not in admin_id_set]

        logger.info("[NOTIF] Student recipients: %d", len(student_ids))
        if student_ids:
            await create_bulk_notifications(
                user_ids=student_ids,
                type="announcement",
                title=f"📢 {ann_doc['title']}",
                message=(ann_doc.get("content") or "")[:200],
                link=f"/dashboard/announcements?highlight={ann_id}",
                related_id=ann_id,
                category="announcements",
            )

        if admin_ids:
            await create_bulk_notifications(
                user_ids=admin_ids,
                type="announcement",
                title=f"📢 {ann_doc['title']}",
                message=(ann_doc.get("content") or "")[:200],
                link="/admin/announcements",
                related_id=ann_id,
                category="announcements",
            )
    except Exception as e:
        logger.error(f"Failed to create announcement notifications: {e}", exc_info=True)


async def _notify_students_of_announcement(
    session_id: str,
    target_levels: Optional[List[str]],
    title: str,
    content: str,
    priority: str,
    db,
    target_audience: str = "all",
):
    """Fire-and-forget: email all enrolled students matching the target levels and audience."""
    try:
        users_col = db["users"]
        enrollments_col = db["enrollments"]

        # Build target label string
        audience_labels = {"all": "All Students", "ipe": "IPE Students", "external": "External Students"}
        # Normalise levels to handle legacy integer format (300 → '300L')
        if not target_levels:
            target_label = audience_labels.get(target_audience, "All Students")
            query: dict = {"sessionId": session_id, "isActive": True}
        else:
            target_levels = _normalize_levels(target_levels)
            level_map = {
                "100L": "100 Level", "200L": "200 Level", "300L": "300 Level",
                "400L": "400 Level", "500L": "500 Level", "PG": "Postgraduate",
            }
            target_label = ", ".join(level_map.get(lv, lv) for lv in target_levels)
            if target_audience != "all":
                target_label += f" ({audience_labels.get(target_audience, '')})"
            query = {"sessionId": session_id, "isActive": True, "level": {"$in": target_levels}}

        cursor = enrollments_col.find(query, {"studentId": 1})
        student_ids = [doc["studentId"] async for doc in cursor]

        # Fallback: if no enrollments and all-levels, use all student users
        if not student_ids and not target_levels:
            logger.warning("[EMAIL] No enrollments for session %s — falling back to all student users", session_id)
            all_students = await users_col.find({"role": "student"}, {"_id": 1}).to_list(length=None)
            student_ids = [str(u["_id"]) for u in all_students]

        if not student_ids:
            return

        # Build user query — filter by department when audience is targeted
        user_query: dict = {"_id": {"$in": [ObjectId(sid) for sid in student_ids]}}
        if target_audience == "ipe":
            user_query["department"] = "Industrial Engineering"
        elif target_audience == "external":
            user_query["department"] = {"$ne": "Industrial Engineering"}

        students = await users_col.find(
            user_query,
            {"email": 1, "firstName": 1, "lastName": 1,
             "secondaryEmail": 1, "secondaryEmailVerified": 1,
             "notificationEmailPreference": 1, "notificationChannelPreference": 1}
        ).to_list(length=None)

        sent = 0
        for student in students:
            # Respect channel preference — skip email if user prefers in-app only
            if not should_send_email(student):
                continue
            # Resolve which email(s) to send to based on preference
            emails = get_notification_emails(student)
            if not emails:
                continue
            name = f"{student.get('firstName', '')} {student.get('lastName', '')}".strip() or "Student"
            for email_addr in emails:
                try:
                    await send_announcement_email(
                        to=email_addr,
                        student_name=name,
                        title=title,
                        content=content,
                        priority=priority,
                        target_label=target_label,
                    )
                    sent += 1
                except Exception as e:
                    logger.warning(f"Failed to send announcement email to {email_addr}: {e}")

        logger.info(f"Announcement email sent to {sent}/{len(students)} recipient(s) — '{title}'")

    except Exception as e:
        logger.error(f"Announcement email dispatch error: {e}")


@router.post("/", response_model=Announcement, status_code=status.HTTP_201_CREATED)
async def create_announcement(
    announcement_data: AnnouncementCreate,
    user: dict = Depends(require_permission("announcement:create"))
):
    """
    Create a new announcement.
    Requires announcement:create permission.
    
    The announcement MUST include a session_id.
    """
    db = get_database()
    announcements = db["announcements"]
    users = db["users"]
    
    # Sanitize input to prevent XSS
    if not validate_no_scripts(announcement_data.title):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid characters detected in title"
        )
    if not validate_no_scripts(announcement_data.content):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid characters detected in content"
        )
    
    # Verify session exists
    sessions = db["sessions"]
    session = await sessions.find_one({"_id": ObjectId(announcement_data.sessionId)})
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Session {announcement_data.sessionId} not found"
        )
    
    # Get author name
    author = await users.find_one({"_id": ObjectId(user["_id"])})
    author_name = f"{author.get('firstName', '')} {author.get('lastName', '')}".strip() or "Admin"
    
    # Create announcement document
    announcement_dict = announcement_data.model_dump()
    announcement_dict["authorName"] = author_name
    announcement_dict["readBy"] = []
    announcement_dict["createdAt"] = datetime.now(timezone.utc)
    announcement_dict["updatedAt"] = datetime.now(timezone.utc)

    # Scheduling support: if scheduledFor is in the future, mark as draft
    is_scheduled = False
    if announcement_dict.get("scheduledFor"):
        scheduled_dt = announcement_dict["scheduledFor"]
        if isinstance(scheduled_dt, str):
            scheduled_dt = datetime.fromisoformat(scheduled_dt.replace("Z", "+00:00"))
        if scheduled_dt > datetime.now(timezone.utc):
            announcement_dict["isPublished"] = False
            is_scheduled = True
        else:
            # Scheduled time already passed — publish immediately
            announcement_dict["isPublished"] = True
            announcement_dict["scheduledFor"] = None
    else:
        announcement_dict["isPublished"] = True
    
    result = await announcements.insert_one(announcement_dict)
    created_announcement = await announcements.find_one({"_id": result.inserted_id})
    created_announcement["_id"] = str(created_announcement["_id"])
    
    await AuditLogger.log(
        action=AuditLogger.ANNOUNCEMENT_CREATED,
        actor_id=user["_id"],
        actor_email=user.get("email", ""),
        resource_type="announcement",
        resource_id=str(result.inserted_id),
        session_id=announcement_data.sessionId,
        details={"title": announcement_data.title, "priority": announcement_data.priority}
    )

    # Fire-and-forget: email enrolled students — only for immediately published announcements with sendEmail=True
    if not is_scheduled and announcement_data.sendEmail:
        fire_and_forget(_notify_students_of_announcement(
            session_id=announcement_data.sessionId,
            target_levels=announcement_data.targetLevels,
            title=announcement_data.title,
            content=announcement_data.content,
            priority=announcement_data.priority,
            db=db,
            target_audience=announcement_data.targetAudience or "all",
        ))

    if not is_scheduled:
        from app.routers.sse import publish
        from app.core.cache import cache_delete, cache_delete_pattern
        publish("announcement_created", {
            "id": str(result.inserted_id),
            "title": announcement_data.title,
            "priority": announcement_data.priority,
        }, ipe_only=(announcement_data.targetAudience == "ipe"))
        await cache_delete("admin_stats")
        await cache_delete_pattern("student_dashboard:*")
    else:
        from app.core.cache import cache_delete
        await cache_delete("admin_stats")

    # Create in-app notifications for targeted students (only for immediately published)
    if not is_scheduled:
        fire_and_forget(_fire_announcement_notifications(created_announcement, db))

    return Announcement(**created_announcement)


@router.get("/")
async def list_announcements(
    session_id: Optional[str] = Query(None, description="Filter by session ID. Defaults to active session."),
    priority: Optional[str] = None,
    search: Optional[str] = Query(None, description="Search in title or content"),
    target_level: Optional[str] = Query(None, description="Filter by target level (e.g. 100L)"),
    limit: int = Query(100, ge=1, le=500, description="Maximum number of announcements to return"),
    skip: int = Query(0, ge=0, description="Number of announcements to skip"),
    user: dict = Depends(get_current_user)
):
    """
    List all announcements for a specific session with pagination.
    
    Filters announcements based on:
    - session_id (time travel)
    - targetLevels (if user is a student, only shows relevant announcements)
    - expiresAt (hides expired announcements)
    
    Returns announcements with user's read status.
    Supports pagination via limit and skip parameters.
    """
    db = get_database()
    announcements = db["announcements"]
    enrollments = db["enrollments"]
    sessions = db["sessions"]
    
    # Resolve session_id
    if not session_id:
        active_session = await sessions.find_one({"isActive": True})
        if not active_session:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No active session found"
            )
        session_id = str(active_session["_id"])
    
    # Verify session exists
    session = await sessions.find_one({"_id": ObjectId(session_id)})
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Session {session_id} not found"
        )
    
    # Build query
    query = {"sessionId": session_id}

    # Students only see published announcements; admins see all (including scheduled drafts)
    is_admin_viewer = user.get("role") in ("admin", "super_admin")
    if not is_admin_viewer:
        query["$and"] = query.get("$and", []) + [
            {"$or": [{"isPublished": True}, {"isPublished": {"$exists": False}}]}
        ]
    
    # Filter by priority if specified
    if priority:
        query["priority"] = priority
    
    # Search in title/content
    if search:
        escaped = re.escape(search)
        query["$and"] = query.get("$and", []) + [{
            "$or": [
                {"title": {"$regex": escaped, "$options": "i"}},
                {"content": {"$regex": escaped, "$options": "i"}},
            ]
        }]
    
    # Filter by target level (for admin filtering)
    if target_level and target_level != "all":
        query["targetLevels"] = target_level
    
    # Hide expired announcements
    query["$or"] = [
        {"expiresAt": None},
        {"expiresAt": {"$gt": datetime.now(timezone.utc)}}
    ]
    
    # Get user's level for this session (if student)
    user_level = None
    if user.get("role") == "student":
        enrollment = await enrollments.find_one({
            "studentId": user["_id"],
            "sessionId": session_id,
            "isActive": True
        })
        if enrollment:
            user_level = enrollment.get("level")
    
    # Get total count for pagination
    total = await announcements.count_documents(query)
    
    # Get announcements
    cursor = announcements.find(query).sort([
        ("isPinned", -1),  # Pinned first
        ("priority", -1),   # High priority next
        ("createdAt", -1)   # Most recent
    ]).skip(skip).limit(limit)
    announcement_list = await cursor.to_list(length=limit)
    
    # Filter by target levels and audience, enrich with read status
    result = []
    user_role = user.get("role", "student")
    is_admin_user = user_role in ("admin", "super_admin")
    user_department = user.get("department", "Industrial Engineering")
    is_ipe_student = user_department == "Industrial Engineering"

    for announcement in announcement_list:
        # Check if announcement is targeted to specific levels
        target_levels = announcement.get("targetLevels")

        # If targeted, admins always see it; students must match their enrolled level
        if target_levels and not is_admin_user:
            if not user_level or user_level not in target_levels:
                continue  # Skip — student's level doesn't match

        # Check audience targeting (ipe-only vs external-only vs all)
        target_audience = announcement.get("targetAudience", "all")
        if target_audience != "all" and not is_admin_user:
            if target_audience == "ipe" and not is_ipe_student:
                continue  # IPE-only announcement, skip for external students
            if target_audience == "external" and is_ipe_student:
                continue  # External-only announcement, skip for IPE students
        
        announcement["_id"] = str(announcement["_id"])
        
        # Check read status
        is_read = user["_id"] in announcement.get("readBy", [])
        
        announcement_with_status = AnnouncementWithStatus(
            **announcement,
            isRead=is_read
        )
        result.append(announcement_with_status)
    
    return {"items": result, "total": total}


@router.get("/{announcement_id}", response_model=AnnouncementWithStatus)
async def get_announcement(
    announcement_id: str,
    user: dict = Depends(get_current_user)
):
    """Get a specific announcement by ID with user's read status"""
    db = get_database()
    announcements = db["announcements"]
    
    if not ObjectId.is_valid(announcement_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid announcement ID format"
        )
    
    announcement = await announcements.find_one({"_id": ObjectId(announcement_id)})
    
    if not announcement:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Announcement {announcement_id} not found"
        )
    
    announcement["_id"] = str(announcement["_id"])
    
    # Check read status
    is_read = user["_id"] in announcement.get("readBy", [])
    
    return AnnouncementWithStatus(
        **announcement,
        isRead=is_read
    )


@router.post("/{announcement_id}/read", response_model=AnnouncementWithStatus)
async def mark_announcement_as_read(
    announcement_id: str,
    user: dict = Depends(get_current_user)
):
    """
    Mark an announcement as read by current user.
    """
    db = get_database()
    announcements = db["announcements"]
    
    if not ObjectId.is_valid(announcement_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid announcement ID format"
        )
    
    # Mark as read (add user to readBy array if not already there)
    await announcements.update_one(
        {"_id": ObjectId(announcement_id)},
        {
            "$addToSet": {"readBy": user["_id"]},  # addToSet prevents duplicates
            "$set": {"updatedAt": datetime.now(timezone.utc)}
        }
    )
    
    # Return updated announcement
    updated_announcement = await announcements.find_one({"_id": ObjectId(announcement_id)})
    
    if not updated_announcement:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Announcement {announcement_id} not found"
        )
    
    updated_announcement["_id"] = str(updated_announcement["_id"])
    
    return AnnouncementWithStatus(
        **updated_announcement,
        isRead=True
    )


@router.patch("/{announcement_id}", response_model=Announcement)
async def update_announcement(
    announcement_id: str,
    announcement_update: AnnouncementUpdate,
    user: dict = Depends(require_permission("announcement:edit"))
):
    """
    Update announcement details.
    Requires announcement:edit permission.
    """
    db = get_database()
    announcements = db["announcements"]
    
    if not ObjectId.is_valid(announcement_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid announcement ID format"
        )
    
    update_data = announcement_update.model_dump(exclude_unset=True)
    if not update_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No fields to update"
        )
    
    update_data["updatedAt"] = datetime.now(timezone.utc)

    # Snapshot isPublished BEFORE updating so we can detect first-publish
    was_published: bool = False
    if update_data.get("isPublished") is True:
        original = await announcements.find_one(
            {"_id": ObjectId(announcement_id)}, {"isPublished": 1}
        )
        was_published = bool(original and original.get("isPublished") is True)

    result = await announcements.update_one(
        {"_id": ObjectId(announcement_id)},
        {"$set": update_data}
    )

    if result.matched_count == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Announcement {announcement_id} not found"
        )

    updated_announcement = await announcements.find_one({"_id": ObjectId(announcement_id)})
    updated_announcement["_id"] = str(updated_announcement["_id"])

    # Fire notifications when an announcement is published for the first time via PATCH
    if update_data.get("isPublished") is True and not was_published:
        fire_and_forget(_fire_announcement_notifications(updated_announcement, db))

    await AuditLogger.log(
        action=AuditLogger.ANNOUNCEMENT_UPDATED,
        actor_id=user["_id"],
        actor_email=user.get("email", ""),
        resource_type="announcement",
        resource_id=announcement_id,
        details={"updated_fields": list(update_data.keys())}
    )
    return Announcement(**updated_announcement)


@router.delete("/{announcement_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_announcement(
    announcement_id: str,
    user: dict = Depends(require_permission("announcement:delete"))
):
    """
    Delete an announcement.
    Requires announcement:delete permission.
    """
    db = get_database()
    announcements = db["announcements"]
    
    if not ObjectId.is_valid(announcement_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid announcement ID format"
        )
    
    result = await announcements.delete_one({"_id": ObjectId(announcement_id)})
    
    if result.deleted_count == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Announcement {announcement_id} not found"
        )

    # Cascade: remove all in-app notifications for this announcement
    await db["notifications"].delete_many({"type": "announcement", "relatedId": announcement_id})

    await AuditLogger.log(
        action=AuditLogger.ANNOUNCEMENT_DELETED,
        actor_id=user["_id"],
        actor_email=user.get("email", ""),
        resource_type="announcement",
        resource_id=announcement_id,
    )
    from app.routers.sse import publish
    from app.core.cache import cache_delete, cache_delete_pattern
    publish("announcement_deleted", {"id": announcement_id})
    await cache_delete("admin_stats")
    await cache_delete_pattern("student_dashboard:*")
    return None


@router.get("/reads/me", response_model=List[str])
async def get_my_read_announcements(
    user: dict = Depends(get_current_user)
):
    """
    Get list of announcement IDs the current user has read.
    Returns array of announcement ID strings.
    """
    db = get_database()
    announcements = db["announcements"]
    
    # Find all announcements where user is in readBy array
    cursor = announcements.find({"readBy": user["_id"]})
    read_announcements = await cursor.to_list(length=None)
    
    # Return array of announcement IDs as strings
    return [str(announcement["_id"]) for announcement in read_announcements]


# ═══════════════════════════════════════════════════════════════════
# SCHEDULED ANNOUNCEMENT PUBLISHER
# Call via cron or on admin dashboard load to publish due announcements
# ═══════════════════════════════════════════════════════════════════

@router.post("/publish-scheduled")
async def publish_scheduled_announcements(
    user: dict = Depends(require_permission("announcement:create")),
):
    """
    Publish all announcements whose scheduledFor has passed.
    Triggers email + in-app notifications for each published announcement.
    """
    db = get_database()
    now = datetime.now(timezone.utc)
    due = await db["announcements"].find({
        "isPublished": False,
        "scheduledFor": {"$lte": now},
    }).to_list(length=100)

    published_count = 0
    for ann in due:
        await db["announcements"].update_one(
            {"_id": ann["_id"]},
            {"$set": {"isPublished": True, "updatedAt": now}},
        )
        published_count += 1

        # Send email if sendEmail is true
        if ann.get("sendEmail", True):
            fire_and_forget(_notify_students_of_announcement(
                session_id=ann["sessionId"],
                target_levels=ann.get("targetLevels"),
                title=ann["title"],
                content=ann["content"],
                priority=ann.get("priority", "normal"),
                db=db,
                target_audience=ann.get("targetAudience", "all"),
            ))

        # SSE + cache
        from app.routers.sse import publish as sse_publish
        from app.core.cache import cache_delete, cache_delete_pattern
        sse_publish("announcement_created", {
            "id": str(ann["_id"]),
            "title": ann["title"],
            "priority": ann.get("priority", "normal"),
        }, ipe_only=(ann.get("targetAudience") == "ipe"))
        await cache_delete_pattern("student_dashboard:*")

        # In-app notifications — delegate to shared helper
        asyncio.ensure_future(_fire_announcement_notifications(ann, db))

    await cache_delete("admin_stats")
    return {"published": published_count}


@router.post("/backfill-notifications")
async def backfill_announcement_notifications(
    user: dict = Depends(get_current_user),
):
    # Only admin / exco can run the backfill
    user_role = user.get("role", "")
    if user_role not in ("admin", "exco"):
        raise HTTPException(status_code=403, detail="Admin or exco role required")
    """
    Retroactively create in-app notifications for all published announcements
    that have not yet had notifications sent (checked via relatedId in notifications collection).

    Useful after deploying the notification feature for the first time, or
    after seeding the database with announcements.

    Requires announcement:create permission.
    """
    db = get_database()

    # Find all published announcements (isPublished=True or field missing)
    published_anns = await db["announcements"].find(
        {"$or": [{"isPublished": True}, {"isPublished": {"$exists": False}}]}
    ).to_list(length=None)

    # Find which announcement IDs already have notifications
    existing_ids: set[str] = set()
    async for n in db["notifications"].find(
        {"type": "announcement", "relatedId": {"$ne": None}}, {"relatedId": 1}
    ):
        if n.get("relatedId"):
            existing_ids.add(str(n["relatedId"]))

    created_for: list[str] = []
    skipped: list[str] = []

    for ann in published_anns:
        ann_id = str(ann["_id"])
        ann["_id"] = ann_id  # normalise for helper
        if ann_id in existing_ids:
            skipped.append(ann_id)
            continue
        await _fire_announcement_notifications(ann, db)
        created_for.append(ann_id)

    logger.info(
        "[BACKFILL] Notification backfill complete: created for %d announcements, skipped %d (already sent)",
        len(created_for), len(skipped),
    )
    return {
        "created_for": len(created_for),
        "skipped_already_sent": len(skipped),
    }
