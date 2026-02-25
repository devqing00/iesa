"""
Announcements Router - Session-Aware Communications

CRITICAL: All announcements are session-scoped.
Announcements are specific to an academic session and can be targeted to specific levels.
"""

from fastapi import APIRouter, HTTPException, Depends, status, Query
from typing import List, Optional
from datetime import datetime
from bson import ObjectId
import asyncio
import logging

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


async def _notify_students_of_announcement(
    session_id: str,
    target_levels: Optional[List[str]],
    title: str,
    content: str,
    priority: str,
    db,
):
    """Fire-and-forget: email all enrolled students matching the target levels."""
    try:
        users_col = db["users"]
        enrollments_col = db["enrollments"]

        # Build target label string
        if not target_levels:
            target_label = "All Students"
            query: dict = {"sessionId": session_id, "status": "active"}
        else:
            level_map = {
                "100": "100 Level", "200": "200 Level", "300": "300 Level",
                "400": "400 Level", "500": "500 Level", "PG": "Postgraduate",
            }
            target_label = ", ".join(level_map.get(lv, lv) for lv in target_levels)
            query = {"sessionId": session_id, "status": "active", "level": {"$in": target_levels}}

        cursor = enrollments_col.find(query, {"studentId": 1})
        student_ids = [doc["studentId"] async for doc in cursor]

        if not student_ids:
            return

        students = await users_col.find(
            {"_id": {"$in": [ObjectId(sid) for sid in student_ids]}},
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
    announcement_dict["createdAt"] = datetime.utcnow()
    announcement_dict["updatedAt"] = datetime.utcnow()
    
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

    # Fire-and-forget: email enrolled students matching this announcement's target levels
    asyncio.create_task(_notify_students_of_announcement(
        session_id=announcement_data.sessionId,
        target_levels=announcement_data.targetLevels,
        title=announcement_data.title,
        content=announcement_data.content,
        priority=announcement_data.priority,
        db=db,
    ))

    from app.routers.sse import publish
    from app.core.cache import cache_delete, cache_delete_pattern
    publish("announcement_created", {
        "id": str(result.inserted_id),
        "title": announcement_data.title,
        "priority": announcement_data.priority,
    })
    await cache_delete("admin_stats")
    await cache_delete_pattern("student_dashboard:*")

    # Create in-app notifications for targeted students
    try:
        from app.routers.notifications import create_bulk_notifications
        target_levels = announcement_data.targetLevels or []
        enrollments_coll = db["enrollments"]
        if target_levels:
            enrolled = await enrollments_coll.find(
                {"sessionId": announcement_data.sessionId, "level": {"$in": [f"{l}L" for l in target_levels]}, "isActive": True}
            ).to_list(length=None)
        else:
            enrolled = await enrollments_coll.find(
                {"sessionId": announcement_data.sessionId, "isActive": True}
            ).to_list(length=None)
        student_ids = list({e["studentId"] for e in enrolled})
        if student_ids:
            asyncio.create_task(
                create_bulk_notifications(
                    user_ids=student_ids,
                    type="announcement",
                    title=f"📢 {announcement_data.title}",
                    message=announcement_data.content[:200],
                    link=f"/dashboard/announcements?highlight={result.inserted_id}",
                    related_id=str(result.inserted_id),
                )
            )
    except Exception as e:
        logger.error(f"Failed to create announcement notifications: {e}")

    return Announcement(**created_announcement)


@router.get("/", response_model=List[AnnouncementWithStatus])
async def list_announcements(
    session_id: Optional[str] = Query(None, description="Filter by session ID. Defaults to active session."),
    priority: Optional[str] = None,
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
    
    # Filter by priority if specified
    if priority:
        query["priority"] = priority
    
    # Hide expired announcements
    query["$or"] = [
        {"expiresAt": None},
        {"expiresAt": {"$gt": datetime.utcnow()}}
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
    
    # Get announcements
    cursor = announcements.find(query).sort([
        ("isPinned", -1),  # Pinned first
        ("priority", -1),   # High priority next
        ("createdAt", -1)   # Most recent
    ]).skip(skip).limit(limit)
    announcement_list = await cursor.to_list(length=limit)
    
    # Filter by target levels and enrich with read status
    result = []
    user_role = user.get("role", "student")
    is_admin_user = user_role in ("admin", "super_admin")

    for announcement in announcement_list:
        # Check if announcement is targeted to specific levels
        target_levels = announcement.get("targetLevels")

        # If targeted, admins always see it; students must match their enrolled level
        if target_levels and not is_admin_user:
            if not user_level or user_level not in target_levels:
                continue  # Skip — student's level doesn't match
        
        announcement["_id"] = str(announcement["_id"])
        
        # Check read status
        is_read = user["_id"] in announcement.get("readBy", [])
        
        announcement_with_status = AnnouncementWithStatus(
            **announcement,
            isRead=is_read
        )
        result.append(announcement_with_status)
    
    return result


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
            "$set": {"updatedAt": datetime.utcnow()}
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
    
    update_data["updatedAt"] = datetime.utcnow()
    
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
