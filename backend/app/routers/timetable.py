"""
Timetable Router - Dynamic class schedule management
"""

from datetime import datetime, date, timedelta, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from motor.motor_asyncio import AsyncIOMotorDatabase
from pydantic import BaseModel, Field
from bson import ObjectId

from ..core.security import get_current_user
from ..core.permissions import require_permission
from ..core.database import get_database
from ..core.audit import AuditLogger

router = APIRouter(prefix="/api/v1/timetable", tags=["timetable"])


# Pydantic Models
class ClassSessionCreate(BaseModel):
    courseCode: str
    courseTitle: str
    level: int
    day: str  # Monday, Tuesday, Wednesday, Thursday, Friday
    startTime: str  # "08:00"
    endTime: str  # "10:00"
    venue: str
    lecturer: Optional[str] = None
    type: str = "lecture"  # lecture, practical, tutorial
    recurring: bool = True


class ClassSessionResponse(BaseModel):
    id: str = Field(alias="_id")
    sessionId: str
    courseCode: str
    courseTitle: str
    level: int
    day: str
    startTime: str
    endTime: str
    venue: str
    lecturer: Optional[str] = None
    type: str
    recurring: bool
    createdBy: str
    createdAt: datetime
    updatedAt: datetime

    class Config:
        populate_by_name = True


class ClassCancellationCreate(BaseModel):
    date: str  # "2025-02-15"
    reason: str


class CancellationResponse(BaseModel):
    id: str = Field(alias="_id")
    classSessionId: str
    date: str
    reason: str
    cancelledBy: str
    cancelledAt: datetime

    class Config:
        populate_by_name = True


class WeeklyScheduleResponse(BaseModel):
    classes: List[dict]
    cancellations: List[dict]
    weekStart: str
    weekEnd: str


# Helper functions
async def get_current_session(db: AsyncIOMotorDatabase):
    """Get the current active session"""
    sessions = db["sessions"]
    session = await sessions.find_one({"isActive": True})
    if not session:
        raise HTTPException(status_code=404, detail="No active session found")
    return session


def validate_day(day: str) -> str:
    """Validate and normalize day name"""
    valid_days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
    day_normalized = day.strip().capitalize()
    if day_normalized not in valid_days:
        raise HTTPException(status_code=400, detail=f"Invalid day. Must be one of: {', '.join(valid_days)}")
    return day_normalized


def validate_time(time_str: str) -> str:
    """Validate time format HH:MM"""
    try:
        datetime.strptime(time_str, "%H:%M")
        return time_str
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid time format: {time_str}. Use HH:MM (e.g., 08:00)")


def get_week_dates(week_start: Optional[date] = None):
    """Get start and end dates for a week (Monday to Sunday)"""
    if week_start is None:
        today = date.today()
        # Get Monday of current week
        week_start = today - timedelta(days=today.weekday())
    
    week_end = week_start + timedelta(days=6)
    return week_start, week_end


# Routes

@router.post("/classes", response_model=ClassSessionResponse)
async def create_class_session(
    class_data: ClassSessionCreate,
    user: dict = Depends(require_permission("timetable:create")),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """
    Create a new class session.
    Requires 'timetable:create' permission (Class Rep or Admin).
    """
    
    # Validate
    if class_data.level not in [100, 200, 300, 400, 500]:
        raise HTTPException(status_code=400, detail="Invalid level")
    
    validate_day(class_data.day)
    validate_time(class_data.startTime)
    validate_time(class_data.endTime)
    
    if class_data.type not in ["lecture", "practical", "tutorial"]:
        raise HTTPException(status_code=400, detail="Type must be: lecture, practical, or tutorial")
    
    # Get current session
    session = await get_current_session(db)
    
    # Create class session
    class_sessions = db["classSessions"]
    class_doc = {
        "sessionId": str(session["_id"]),
        "courseCode": class_data.courseCode.upper(),
        "courseTitle": class_data.courseTitle,
        "level": class_data.level,
        "day": validate_day(class_data.day),
        "startTime": class_data.startTime,
        "endTime": class_data.endTime,
        "venue": class_data.venue,
        "lecturer": class_data.lecturer,
        "type": class_data.type,
        "recurring": class_data.recurring,
        "createdBy": str(user["_id"]),
        "createdAt": datetime.now(timezone.utc),
        "updatedAt": datetime.now(timezone.utc)
    }
    
    result = await class_sessions.insert_one(class_doc)
    class_doc["_id"] = str(result.inserted_id)
    class_doc["sessionId"] = str(class_doc["sessionId"])
    class_doc["createdBy"] = str(class_doc["createdBy"])
    
    return ClassSessionResponse(**class_doc)


@router.get("/classes", response_model=List[ClassSessionResponse])
async def list_class_sessions(
    level: Optional[int] = Query(None, description="Filter by level"),
    day: Optional[str] = Query(None, description="Filter by day"),
    courseCode: Optional[str] = Query(None, description="Filter by course code"),
    user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Get list of class sessions"""
    class_sessions = db["classSessions"]
    
    # Get current session
    session = await get_current_session(db)
    
    # Build query
    query = {"sessionId": str(session["_id"])}
    
    if level:
        query["level"] = level
    
    if day:
        query["day"] = validate_day(day)
    
    if courseCode:
        query["courseCode"] = courseCode.upper()
    
    # Fetch classes
    cursor = class_sessions.find(query).sort([("day", 1), ("startTime", 1)])
    
    classes = []
    async for doc in cursor:
        doc["_id"] = str(doc["_id"])
        doc["sessionId"] = str(doc["sessionId"])
        doc["createdBy"] = str(doc["createdBy"])
        classes.append(ClassSessionResponse(**doc))
    
    return classes


@router.get("/week", response_model=WeeklyScheduleResponse)
async def get_weekly_schedule(
    level: int = Query(..., description="Student level"),
    week_start: Optional[str] = Query(None, description="Week start date (YYYY-MM-DD)"),
    user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Get weekly timetable view with cancellations"""
    class_sessions = db["classSessions"]
    cancellations_coll = db["classCancellations"]
    
    # Get current session
    session = await get_current_session(db)
    
    # Parse week dates
    if week_start:
        try:
            week_start_date = datetime.strptime(week_start, "%Y-%m-%d").date()
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")
    else:
        week_start_date = None
    
    start_date, end_date = get_week_dates(week_start_date)
    
    # Fetch classes for the level
    cursor = class_sessions.find({
        "sessionId": str(session["_id"]),
        "level": level
    }).sort([("day", 1), ("startTime", 1)])
    
    classes = []
    async for doc in cursor:
        doc["_id"] = str(doc["_id"])
        doc["sessionId"] = str(doc["sessionId"])
        doc["createdBy"] = str(doc["createdBy"])
        classes.append(doc)
    
    # Fetch cancellations for this week
    cancellations_cursor = cancellations_coll.find({
        "date": {
            "$gte": start_date.isoformat(),
            "$lte": end_date.isoformat()
        }
    })
    
    cancellations = []
    async for doc in cancellations_cursor:
        doc["_id"] = str(doc["_id"])
        doc["classSessionId"] = str(doc["classSessionId"])
        doc["cancelledBy"] = str(doc["cancelledBy"])
        cancellations.append(doc)
    
    return WeeklyScheduleResponse(
        classes=classes,
        cancellations=cancellations,
        weekStart=start_date.isoformat(),
        weekEnd=end_date.isoformat()
    )


@router.get("/today", response_model=List[dict])
async def get_today_classes(
    level: int = Query(..., description="Student level"),
    user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Get today's classes"""
    class_sessions = db["classSessions"]
    cancellations_coll = db["classCancellations"]
    
    # Get current session
    session = await get_current_session(db)
    
    # Get today's day name
    today = date.today()
    day_name = today.strftime("%A")  # Monday, Tuesday, etc.
    
    # Fetch classes
    cursor = class_sessions.find({
        "sessionId": str(session["_id"]),
        "level": level,
        "day": day_name
    }).sort("startTime", 1)
    
    classes = []
    async for doc in cursor:
        class_id = str(doc["_id"])
        
        # Check if cancelled today
        cancellation = await cancellations_coll.find_one({
            "classSessionId": ObjectId(class_id),
            "date": today.isoformat()
        })
        
        doc["_id"] = class_id
        doc["sessionId"] = str(doc["sessionId"])
        doc["createdBy"] = str(doc["createdBy"])
        doc["isCancelled"] = cancellation is not None
        doc["cancellationReason"] = cancellation.get("reason") if cancellation else None
        
        classes.append(doc)
    
    return classes


@router.post("/classes/{class_id}/cancel", response_model=CancellationResponse)
async def cancel_class(
    class_id: str,
    cancellation_data: ClassCancellationCreate,
    request: Request,
    user: dict = Depends(require_permission("timetable:cancel")),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """
    Cancel a specific occurrence of a class.
    Requires 'timetable:cancel' permission (Class Rep only).
    """
    
    # Validate class exists
    class_sessions = db["classSessions"]
    try:
        class_session = await class_sessions.find_one({"_id": ObjectId(class_id)})
    except:
        raise HTTPException(status_code=400, detail="Invalid class ID")
    
    if not class_session:
        raise HTTPException(status_code=404, detail="Class not found")
    
    # Validate date
    try:
        cancel_date = datetime.strptime(cancellation_data.date, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")
    
    # Check if already cancelled
    cancellations = db["classCancellations"]
    existing = await cancellations.find_one({
        "classSessionId": ObjectId(class_id),
        "date": cancellation_data.date
    })
    
    if existing:
        raise HTTPException(status_code=400, detail="This class is already cancelled for this date")
    
    # Create cancellation
    cancellation_doc = {
        "classSessionId": ObjectId(class_id),
        "date": cancellation_data.date,
        "reason": cancellation_data.reason,
        "cancelledBy": str(user["_id"]),
        "cancelledAt": datetime.now(timezone.utc)
    }
    
    result = await cancellations.insert_one(cancellation_doc)
    cancellation_doc["_id"] = str(result.inserted_id)
    cancellation_doc["classSessionId"] = class_id
    cancellation_doc["cancelledBy"] = str(cancellation_doc["cancelledBy"])

    await AuditLogger.log(
        action="timetable.class_cancelled",
        actor_id=str(user["_id"]),
        actor_email=user.get("email", "unknown"),
        resource_type="class_session",
        resource_id=class_id,
        details={"date": cancellation_data.date, "reason": cancellation_data.reason, "course": class_session.get("courseCode")},
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )

    return CancellationResponse(**cancellation_doc)


@router.patch("/classes/{class_id}")
async def update_class_session(
    class_id: str,
    class_data: ClassSessionCreate,
    request: Request,
    user: dict = Depends(require_permission("timetable:edit")),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Update a class session"""
    
    class_sessions = db["classSessions"]
    
    try:
        result = await class_sessions.update_one(
            {"_id": ObjectId(class_id)},
            {
                "$set": {
                    "courseCode": class_data.courseCode.upper(),
                    "courseTitle": class_data.courseTitle,
                    "level": class_data.level,
                    "day": validate_day(class_data.day),
                    "startTime": validate_time(class_data.startTime),
                    "endTime": validate_time(class_data.endTime),
                    "venue": class_data.venue,
                    "lecturer": class_data.lecturer,
                    "type": class_data.type,
                    "recurring": class_data.recurring,
                    "updatedAt": datetime.now(timezone.utc)
                }
            }
        )
    except:
        raise HTTPException(status_code=400, detail="Invalid class ID")
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Class not found")

    await AuditLogger.log(
        action="timetable.class_updated",
        actor_id=str(user["_id"]),
        actor_email=user.get("email", "unknown"),
        resource_type="class_session",
        resource_id=class_id,
        details={"courseCode": class_data.courseCode, "day": class_data.day, "startTime": class_data.startTime},
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )

    return {"message": "Class updated successfully"}


@router.delete("/classes/{class_id}")
async def delete_class_session(
    class_id: str,
    request: Request,
    user: dict = Depends(require_permission("timetable:edit")),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Delete a class session"""
    
    class_sessions = db["classSessions"]

    # Fetch before deleting for audit
    session_doc = await class_sessions.find_one({"_id": ObjectId(class_id)})
    
    try:
        result = await class_sessions.delete_one({"_id": ObjectId(class_id)})
    except:
        raise HTTPException(status_code=400, detail="Invalid class ID")
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Class not found")

    await AuditLogger.log(
        action="timetable.class_deleted",
        actor_id=str(user["_id"]),
        actor_email=user.get("email", "unknown"),
        resource_type="class_session",
        resource_id=class_id,
        details={"courseCode": session_doc.get("courseCode") if session_doc else None},
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )

    return {"message": "Class deleted successfully"}
