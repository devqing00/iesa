"""
Events Router - Session-Aware Event Management

CRITICAL: All events are session-scoped.
Events from different academic sessions are completely separate.
"""

from fastapi import APIRouter, HTTPException, Depends, status, Query, UploadFile, File
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
from bson import ObjectId
import cloudinary
import cloudinary.uploader
import app.utils.cloudinary_config  # noqa: F401 — side-effect: configures Cloudinary credentials

from app.models.event import (
    Event, EventCreate, EventUpdate, EventWithStatus, EventRegistration
)
from app.db import get_database
from app.core.security import get_current_user
from app.core.permissions import require_permission
from app.core.sanitization import sanitize_html, validate_no_scripts
from app.core.audit import AuditLogger

router = APIRouter(prefix="/api/v1/events", tags=["Events"])


@router.post("/", response_model=Event, status_code=status.HTTP_201_CREATED)
async def create_event(
    event_data: EventCreate,
    user: dict = Depends(require_permission("event:create"))
):
    """
    Create a new event.
    Requires event:create permission.
    
    The event MUST include a session_id.
    """
    db = get_database()
    events = db["events"]
    
    # Sanitize input to prevent XSS
    if not validate_no_scripts(event_data.title):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid characters detected in title"
        )
    if not validate_no_scripts(event_data.description):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid characters detected in description"
        )
    
    # Verify session exists
    sessions = db["sessions"]
    session = await sessions.find_one({"_id": ObjectId(event_data.sessionId)})
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Session {event_data.sessionId} not found"
        )
    
    # Create event document
    event_dict = event_data.model_dump()
    event_dict["registrations"] = []
    event_dict["attendees"] = []
    event_dict["createdAt"] = datetime.utcnow()
    event_dict["updatedAt"] = datetime.utcnow()
    
    result = await events.insert_one(event_dict)
    created_event = await events.find_one({"_id": result.inserted_id})
    created_event["_id"] = str(created_event["_id"])
    
    await AuditLogger.log(
        action=AuditLogger.EVENT_CREATED,
        actor_id=user["_id"],
        actor_email=user.get("email", ""),
        resource_type="event",
        resource_id=str(result.inserted_id),
        session_id=event_data.sessionId,
        details={"title": event_data.title, "date": str(event_data.date)}
    )
    return Event(**created_event)


@router.get("/", response_model=List[EventWithStatus])
async def list_events(
    session_id: Optional[str] = Query(None, description="Filter by session ID. Defaults to active session."),
    category: Optional[str] = None,
    upcoming_only: Optional[bool] = Query(None, description="If true, only return events with date >= now"),
    user: dict = Depends(get_current_user)
):
    """
    List all events for a specific session.
    
    The session_id parameter enables "time travel".
    Returns events with user's registration status.
    """
    db = get_database()
    events = db["events"]
    sessions = db["sessions"]
    
    # Resolve session_id
    if not session_id:
        active_session = await sessions.find_one({"isActive": True})
        if not active_session:
            # No active session — return empty list instead of 404
            return []
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
    if category:
        query["category"] = category
    if upcoming_only:
        query["date"] = {"$gte": datetime.utcnow()}
    
    # Get events for this session
    cursor = events.find(query).sort("date", 1)  # Upcoming first
    event_list = await cursor.to_list(length=None)
    
    # Enrich with user's status
    result = []
    for event in event_list:
        event["_id"] = str(event["_id"])
        
        is_registered = user["_id"] in event.get("registrations", [])
        has_attended = user["_id"] in event.get("attendees", [])
        is_full = False
        
        if event.get("maxAttendees"):
            is_full = len(event.get("registrations", [])) >= event["maxAttendees"]
        
        event_with_status = EventWithStatus(
            **event,
            isRegistered=is_registered,
            hasAttended=has_attended,
            isFull=is_full
        )
        result.append(event_with_status)
    
    return result


@router.post("/upload-image")
async def upload_event_image(
    file: UploadFile = File(...),
    user: dict = Depends(require_permission("event:create"))
):
    """
    Upload an event image to Cloudinary.
    Requires event:create permission.
    Returns the secure URL of the uploaded image.
    """
    # Validate content type
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File must be an image (PNG, JPG, WebP, etc.)"
        )

    # Read file bytes
    file_bytes = await file.read()
    if len(file_bytes) > 10 * 1024 * 1024:  # 10 MB limit
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="Image must be smaller than 10 MB"
        )

    try:
        result = cloudinary.uploader.upload(
            file_bytes,
            folder="iesa/events",
            resource_type="image",
            transformation=[
                {"width": 1200, "height": 630, "crop": "fill", "gravity": "center"},
                {"quality": "auto:good"},
                {"fetch_format": "auto"}
            ]
        )
        return {"url": result["secure_url"]}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Image upload failed: {str(e)}"
        )


@router.get("/{event_id}", response_model=EventWithStatus)
async def get_event(
    event_id: str,
    user: dict = Depends(get_current_user)
):
    """Get a specific event by ID with user's registration status"""
    db = get_database()
    events = db["events"]
    
    if not ObjectId.is_valid(event_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid event ID format"
        )
    
    event = await events.find_one({"_id": ObjectId(event_id)})
    
    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Event {event_id} not found"
        )
    
    event["_id"] = str(event["_id"])
    
    # Check status
    is_registered = user["_id"] in event.get("registrations", [])
    has_attended = user["_id"] in event.get("attendees", [])
    is_full = False
    
    if event.get("maxAttendees"):
        is_full = len(event.get("registrations", [])) >= event["maxAttendees"]
    
    return EventWithStatus(
        **event,
        isRegistered=is_registered,
        hasAttended=has_attended,
        isFull=is_full
    )


@router.post("/{event_id}/register", response_model=EventWithStatus)
async def register_for_event(
    event_id: str,
    user: dict = Depends(get_current_user)
):
    """
    Register current user for an event.
    """
    db = get_database()
    events = db["events"]
    
    if not ObjectId.is_valid(event_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid event ID format"
        )
    
    # Get event
    event = await events.find_one({"_id": ObjectId(event_id)})
    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Event {event_id} not found"
        )
    
    # Check if already registered
    if user["_id"] in event.get("registrations", []):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Already registered for this event"
        )
    
    # Check if full
    if event.get("maxAttendees"):
        if len(event.get("registrations", [])) >= event["maxAttendees"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Event is full"
            )
    
    # Check registration deadline
    if event.get("registrationDeadline"):
        if datetime.utcnow() > event["registrationDeadline"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Registration deadline has passed"
            )
    
    # Register user
    await events.update_one(
        {"_id": ObjectId(event_id)},
        {
            "$push": {"registrations": user["_id"]},
            "$set": {"updatedAt": datetime.utcnow()}
        }
    )
    
    # Return updated event
    updated_event = await events.find_one({"_id": ObjectId(event_id)})
    updated_event["_id"] = str(updated_event["_id"])
    
    is_full = False
    if updated_event.get("maxAttendees"):
        is_full = len(updated_event.get("registrations", [])) >= updated_event["maxAttendees"]
    
    return EventWithStatus(
        **updated_event,
        isRegistered=True,
        hasAttended=False,
        isFull=is_full
    )


@router.delete("/{event_id}/register", response_model=EventWithStatus)
async def unregister_from_event(
    event_id: str,
    user: dict = Depends(get_current_user)
):
    """Unregister current user from an event"""
    db = get_database()
    events = db["events"]
    
    if not ObjectId.is_valid(event_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid event ID format"
        )
    
    # Unregister user
    result = await events.update_one(
        {"_id": ObjectId(event_id)},
        {
            "$pull": {"registrations": user["_id"]},
            "$set": {"updatedAt": datetime.utcnow()}
        }
    )
    
    if result.matched_count == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Event {event_id} not found"
        )
    
    # Return updated event
    updated_event = await events.find_one({"_id": ObjectId(event_id)})
    updated_event["_id"] = str(updated_event["_id"])
    
    is_full = False
    if updated_event.get("maxAttendees"):
        is_full = len(updated_event.get("registrations", [])) >= updated_event["maxAttendees"]
    
    return EventWithStatus(
        **updated_event,
        isRegistered=False,
        hasAttended=user["_id"] in updated_event.get("attendees", []),
        isFull=is_full
    )


@router.patch("/{event_id}", response_model=Event)
async def update_event(
    event_id: str,
    event_update: EventUpdate,
    user: dict = Depends(require_permission("event:edit"))
):
    """
    Update event details.
    Requires event:edit permission.
    """
    db = get_database()
    events = db["events"]
    
    if not ObjectId.is_valid(event_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid event ID format"
        )
    
    update_data = event_update.model_dump(exclude_unset=True)
    if not update_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No fields to update"
        )
    
    update_data["updatedAt"] = datetime.utcnow()
    
    result = await events.update_one(
        {"_id": ObjectId(event_id)},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Event {event_id} not found"
        )
    
    updated_event = await events.find_one({"_id": ObjectId(event_id)})
    updated_event["_id"] = str(updated_event["_id"])
    
    await AuditLogger.log(
        action=AuditLogger.EVENT_UPDATED,
        actor_id=user["_id"],
        actor_email=user.get("email", ""),
        resource_type="event",
        resource_id=event_id,
        details={"updated_fields": list(update_data.keys())}
    )
    return Event(**updated_event)


@router.delete("/{event_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_event(
    event_id: str,
    user: dict = Depends(require_permission("event:delete"))
):
    """
    Delete an event.
    Only admins can delete events.
    """
    db = get_database()
    events = db["events"]
    
    if not ObjectId.is_valid(event_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid event ID format"
        )
    
    result = await events.delete_one({"_id": ObjectId(event_id)})
    
    if result.deleted_count == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Event {event_id} not found"
        )
    
    await AuditLogger.log(
        action=AuditLogger.EVENT_DELETED,
        actor_id=user["_id"],
        actor_email=user.get("email", ""),
        resource_type="event",
        resource_id=event_id,
    )
    return None


@router.get("/registrations/me", response_model=List[str])
async def get_my_registrations(
    user: dict = Depends(get_current_user)
):
    """
    Get list of event IDs the current user is registered for.
    Returns array of event ID strings.
    """
    db = get_database()
    events = db["events"]
    
    # Find all events where user is in registrations array
    cursor = events.find({"registrations": user["_id"]})
    registered_events = await cursor.to_list(length=None)
    
    # Return array of event IDs as strings
    return [str(event["_id"]) for event in registered_events]


# ── Admin: Manage registrations for a specific event ────────────────────────

class AttendMarkRequest(BaseModel):
    userId: str


@router.get("/{event_id}/registrations")
async def list_event_registrations(
    event_id: str,
    user: dict = Depends(require_permission("event:edit"))
):
    """
    Admin: List all students registered for an event with their profile details.
    Returns enriched list — name, matric, level, attended status.
    """
    db = get_database()
    events_col = db["events"]
    users_col  = db["users"]

    if not ObjectId.is_valid(event_id):
        raise HTTPException(status_code=400, detail="Invalid event ID")

    event = await events_col.find_one({"_id": ObjectId(event_id)})
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    registered_ids = event.get("registrations", [])
    attended_ids   = event.get("attendees", [])

    result = []
    for uid in registered_ids:
        student = await users_col.find_one({"_id": ObjectId(uid)})
        if not student:
            continue
        result.append({
            "id":            uid,
            "firstName":     student.get("firstName", ""),
            "lastName":      student.get("lastName", ""),
            "email":         student.get("email", ""),
            "matricNumber":  student.get("matricNumber", ""),
            "level":         student.get("level", ""),
            "profilePhotoURL": student.get("profilePhotoURL", ""),
            "hasAttended":   uid in attended_ids,
        })

    return {
        "eventId":         event_id,
        "eventTitle":      event.get("title", ""),
        "totalRegistered": len(result),
        "totalAttended":   sum(1 for r in result if r["hasAttended"]),
        "registrants":     result,
    }


@router.delete("/{event_id}/registrations/{user_id}", status_code=204)
async def admin_remove_registration(
    event_id: str,
    user_id:  str,
    admin: dict = Depends(require_permission("event:edit"))
):
    """Admin: Remove a student's registration from an event."""
    db = get_database()
    events_col = db["events"]

    if not ObjectId.is_valid(event_id) or not ObjectId.is_valid(user_id):
        raise HTTPException(status_code=400, detail="Invalid ID format")

    result = await events_col.update_one(
        {"_id": ObjectId(event_id)},
        {
            "$pull": {"registrations": user_id, "attendees": user_id},
            "$set":  {"updatedAt": datetime.utcnow()},
        }
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Event not found")

    await AuditLogger.log(
        action="event:registration_removed",
        actor_id=admin["_id"],
        actor_email=admin.get("email", ""),
        resource_type="event",
        resource_id=event_id,
        details={"removed_user_id": user_id},
    )


@router.post("/{event_id}/attendees/bulk")
async def admin_mark_all_attended(
    event_id: str,
    body: dict,
    admin: dict = Depends(require_permission("event:edit"))
):
    """Admin: Bulk mark multiple registered students as attended in one request."""
    db = get_database()
    events_col = db["events"]

    if not ObjectId.is_valid(event_id):
        raise HTTPException(status_code=400, detail="Invalid event ID")

    user_ids: list = body.get("userIds", [])
    if not user_ids:
        raise HTTPException(status_code=400, detail="userIds must be a non-empty list")

    event = await events_col.find_one({"_id": ObjectId(event_id)})
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    registered = set(event.get("registrations", []))
    valid_ids = [uid for uid in user_ids if uid in registered]

    if not valid_ids:
        raise HTTPException(status_code=400, detail="None of the provided users are registered for this event")

    await events_col.update_one(
        {"_id": ObjectId(event_id)},
        {
            "$addToSet": {"attendees": {"$each": valid_ids}},
            "$set": {"updatedAt": datetime.utcnow()},
        }
    )

    await AuditLogger.log(
        action="event:bulk_attendance_marked",
        actor_id=admin["_id"],
        actor_email=admin.get("email", ""),
        resource_type="event",
        resource_id=event_id,
        details={"marked_count": len(valid_ids)},
    )

    return {"message": f"Marked {len(valid_ids)} attendee(s)", "markedCount": len(valid_ids)}


@router.post("/{event_id}/attendees")
async def admin_mark_attended(
    event_id: str,
    body:     AttendMarkRequest,
    admin: dict = Depends(require_permission("event:edit"))
):
    """Admin: Mark a registered student as having attended."""
    db = get_database()
    events_col = db["events"]

    if not ObjectId.is_valid(event_id):
        raise HTTPException(status_code=400, detail="Invalid event ID")

    event = await events_col.find_one({"_id": ObjectId(event_id)})
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    if body.userId not in event.get("registrations", []):
        raise HTTPException(status_code=400, detail="User is not registered for this event")

    await events_col.update_one(
        {"_id": ObjectId(event_id)},
        {
            "$addToSet": {"attendees": body.userId},
            "$set":      {"updatedAt": datetime.utcnow()},
        }
    )
    return {"message": "Attendance marked"}


@router.delete("/{event_id}/attendees/{user_id}", status_code=204)
async def admin_unmark_attended(
    event_id: str,
    user_id:  str,
    admin: dict = Depends(require_permission("event:edit"))
):
    """Admin: Unmark a student's attendance."""
    db = get_database()
    events_col = db["events"]

    if not ObjectId.is_valid(event_id):
        raise HTTPException(status_code=400, detail="Invalid event ID")

    await events_col.update_one(
        {"_id": ObjectId(event_id)},
        {
            "$pull": {"attendees": user_id},
            "$set":  {"updatedAt": datetime.utcnow()},
        }
    )

