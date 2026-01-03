"""
Events Router - Session-Aware Event Management

CRITICAL: All events are session-scoped.
Events from different academic sessions are completely separate.
"""

from fastapi import APIRouter, HTTPException, Depends, status, Query
from typing import List, Optional
from datetime import datetime
from bson import ObjectId

from app.models.event import (
    Event, EventCreate, EventUpdate, EventWithStatus, EventRegistration
)
from app.db import get_database
from app.core.security import get_current_user
from app.core.permissions import require_permission

router = APIRouter(prefix="/api/events", tags=["Events"])


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
    
    return Event(**created_event)


@router.get("/", response_model=List[EventWithStatus])
async def list_events(
    session_id: str = Query(..., description="Filter by session ID (REQUIRED)"),
    category: Optional[str] = None,
    user: dict = Depends(get_current_user)
):
    """
    List all events for a specific session.
    
    The session_id parameter enables "time travel".
    Returns events with user's registration status.
    """
    db = get_database()
    events = db["events"]
    
    # Verify session exists
    sessions = db["sessions"]
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
    
    return None
