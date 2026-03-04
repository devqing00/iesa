"""Academic calendar event routes — CRUD for semester milestones, exams, holidays, etc."""

from datetime import datetime, timezone

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query, Request

from ..core.permissions import get_current_user, get_current_session, require_permission
from ..core.security import require_ipe_student
from ..core.audit import AuditLogger
from ..db import get_database
from ..models.academic_calendar import (
    AcademicEventCreate,
    AcademicEventResponse,
    AcademicEventUpdate,
)

router = APIRouter(prefix="/api/v1/academic-calendar", tags=["Academic Calendar"])


def _doc_to_response(doc: dict) -> AcademicEventResponse:
    """Convert a MongoDB document to a response model."""
    return AcademicEventResponse(
        id=str(doc["_id"]),
        title=doc["title"],
        eventType=doc["eventType"],
        startDate=doc["startDate"],
        endDate=doc.get("endDate"),
        semester=doc["semester"],
        sessionId=doc["sessionId"],
        description=doc.get("description"),
        createdBy=doc["createdBy"],
        createdAt=doc["createdAt"],
        updatedAt=doc.get("updatedAt"),
    )


@router.post("/", response_model=AcademicEventResponse, status_code=201)
async def create_academic_event(
    event_data: AcademicEventCreate,
    request: Request,
    user: dict = Depends(get_current_user),
    session: dict = Depends(get_current_session),
    _perm=Depends(require_permission("timetable:create")),
):
    """Create a new academic calendar event for the active session."""
    db = get_database()
    doc = {
        "title": event_data.title,
        "eventType": event_data.eventType.value,
        "startDate": event_data.startDate,
        "endDate": event_data.endDate,
        "semester": event_data.semester,
        "sessionId": str(session["_id"]),
        "description": event_data.description,
        "createdBy": str(user["_id"]),
        "createdAt": datetime.now(timezone.utc),
        "updatedAt": None,
    }
    result = await db.academicEvents.insert_one(doc)
    doc["_id"] = result.inserted_id

    await AuditLogger.log(
        action="academic_event.created",
        actor_id=str(user["_id"]),
        actor_email=user.get("email", "unknown"),
        resource_type="academic_event",
        resource_id=str(result.inserted_id),
        details={"title": event_data.title, "type": event_data.eventType.value},
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )

    return _doc_to_response(doc)


@router.get("/", response_model=list[AcademicEventResponse])
async def list_academic_events(
    semester: int | None = Query(None, ge=1, le=2),
    eventType: str | None = Query(None),
    user: dict = Depends(require_ipe_student),
    session: dict = Depends(get_current_session),
):
    """List academic calendar events for the current session. Filter by semester or type."""
    db = get_database()
    query: dict = {"sessionId": str(session["_id"])}
    if semester is not None:
        query["semester"] = semester
    if eventType:
        query["eventType"] = eventType

    cursor = db.academicEvents.find(query).sort("startDate", 1)
    docs = await cursor.to_list(length=200)
    return [_doc_to_response(d) for d in docs]


@router.get("/{event_id}", response_model=AcademicEventResponse)
async def get_academic_event(
    event_id: str,
    user: dict = Depends(require_ipe_student),
):
    """Get a single academic calendar event by ID."""
    db = get_database()
    if not ObjectId.is_valid(event_id):
        raise HTTPException(status_code=400, detail="Invalid event ID")
    doc = await db.academicEvents.find_one({"_id": ObjectId(event_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Event not found")
    return _doc_to_response(doc)


@router.patch("/{event_id}", response_model=AcademicEventResponse)
async def update_academic_event(
    event_id: str,
    event_data: AcademicEventUpdate,
    request: Request,
    user: dict = Depends(get_current_user),
    _perm=Depends(require_permission("timetable:edit")),
):
    """Update an academic calendar event."""
    db = get_database()
    if not ObjectId.is_valid(event_id):
        raise HTTPException(status_code=400, detail="Invalid event ID")

    updates = {
        k: (v.value if hasattr(v, "value") else v)
        for k, v in event_data.model_dump(exclude_none=True).items()
    }
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")
    updates["updatedAt"] = datetime.now(timezone.utc)

    result = await db.academicEvents.find_one_and_update(
        {"_id": ObjectId(event_id)},
        {"$set": updates},
        return_document=True,
    )
    if not result:
        raise HTTPException(status_code=404, detail="Event not found")

    await AuditLogger.log(
        action="academic_event.updated",
        actor_id=str(user["_id"]),
        actor_email=user.get("email", "unknown"),
        resource_type="academic_event",
        resource_id=event_id,
        details={"title": result.get("title"), "fields": list(updates.keys())},
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )

    return _doc_to_response(result)


@router.delete("/{event_id}", status_code=204)
async def delete_academic_event(
    event_id: str,
    request: Request,
    user: dict = Depends(get_current_user),
    _perm=Depends(require_permission("timetable:edit")),
):
    """Delete an academic calendar event."""
    db = get_database()
    if not ObjectId.is_valid(event_id):
        raise HTTPException(status_code=400, detail="Invalid event ID")
    doc = await db.academicEvents.find_one({"_id": ObjectId(event_id)})
    result = await db.academicEvents.delete_one({"_id": ObjectId(event_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Event not found")

    await AuditLogger.log(
        action="academic_event.deleted",
        actor_id=str(user["_id"]),
        actor_email=user.get("email", "unknown"),
        resource_type="academic_event",
        resource_id=event_id,
        details={"title": doc.get("title") if doc else None},
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )

    return None
