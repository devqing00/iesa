"""
Timetable Router - Dynamic class schedule + exam timetable management
"""

from datetime import datetime, date, timedelta, timezone
from zoneinfo import ZoneInfo
from typing import List, Optional, Literal
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import StreamingResponse
from motor.motor_asyncio import AsyncIOMotorDatabase
from pydantic import BaseModel, Field
from bson import ObjectId

from ..core.security import get_current_user, require_ipe_student
from ..core.permissions import require_permission, require_any_permission
from ..core.database import get_database
from ..core.audit import AuditLogger
from ..core.error_handling import fire_and_forget

router = APIRouter(prefix="/api/v1/timetable", tags=["timetable"])
LAGOS_TZ = ZoneInfo("Africa/Lagos")


# ── Timetable change notification helper ───────────────────────────

async def _notify_level_students(
    db, level: int, session_id: str,
    title: str, message: str, link: str = "/dashboard/timetable",
):
    """Send push notification about timetable changes to all students at a level."""
    try:
        from app.routers.notifications import create_bulk_notifications
        # Find enrolled students at this level
        cursor = db.users.find(
            {"currentLevel": {"$regex": f"^{level}"},
             "role": "student", "isActive": {"$ne": False}},
            {"_id": 1},
        )
        user_ids = [str(u["_id"]) async for u in cursor]
        if user_ids:
            await create_bulk_notifications(
                user_ids=user_ids,
                type="timetable",
                title=title,
                message=message,
                link=link,
                category="timetable",
            )
    except Exception:
        pass  # Non-critical


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


class ClassStatusUpdateCreate(BaseModel):
    date: str  # YYYY-MM-DD
    status: Literal["holding", "suspended", "not_holding", "postponed", "cancelled"]
    note: Optional[str] = Field(None, max_length=300)


class ClassStatusUpdateResponse(BaseModel):
    id: str = Field(alias="_id")
    classSessionId: str
    sessionId: str
    level: int
    date: str
    status: str
    note: Optional[str] = None
    updatedBy: str
    createdAt: datetime
    updatedAt: datetime

    class Config:
        populate_by_name = True


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


def parse_level_value(raw_level: Optional[str]) -> Optional[int]:
    if not raw_level:
        return None
    digits = "".join(ch for ch in str(raw_level) if ch.isdigit())
    if not digits:
        return None
    try:
        return int(digits)
    except ValueError:
        return None


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

    # Notify students at this level
    fire_and_forget(_notify_level_students(
        db, class_data.level, str(session["_id"]),
        "New Class Added",
        f"{class_data.courseCode.upper()} — {class_data.day} {class_data.startTime}–{class_data.endTime} at {class_data.venue}",
    ))

    return ClassSessionResponse(**class_doc)


@router.get("/classes", response_model=List[ClassSessionResponse])
async def list_class_sessions(
    level: Optional[int] = Query(None, description="Filter by level"),
    day: Optional[str] = Query(None, description="Filter by day"),
    courseCode: Optional[str] = Query(None, description="Filter by course code"),
    user: dict = Depends(require_ipe_student),
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


@router.get("/pdf")
async def download_timetable_pdf(
    level: Optional[int] = Query(None, description="Filter by level"),
    user: dict = Depends(require_ipe_student),
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    """Download timetable as a PDF for the current session."""
    from ..utils.timetable_generator import generate_timetable_pdf

    user_id = user.get("_id") or user.get("sub")
    if not user_id or not ObjectId.is_valid(user_id):
        raise HTTPException(status_code=401, detail="Invalid user identity")

    # Resolve level from user profile if not supplied
    student_level = level
    if not student_level:
        user_doc = await db["users"].find_one(
            {"_id": ObjectId(user_id)},
            {"currentLevel": 1, "level": 1}
        )
        if user_doc:
            raw = str(user_doc.get("currentLevel") or user_doc.get("level") or "300")
            student_level = int("".join(c for c in raw if c.isdigit()) or "300")
        else:
            student_level = 300

    # Get current session
    session = await get_current_session(db)
    session_name = session.get("name", "Current Session")

    # Fetch classes
    query = {"sessionId": str(session["_id"]), "level": student_level}
    cursor = db["classSessions"].find(query).sort([("day", 1), ("startTime", 1)])
    classes = []
    async for doc in cursor:
        classes.append(doc)

    if not classes:
        raise HTTPException(status_code=404, detail="No classes found for your level this session.")

    # Get student name
    user_doc = await db["users"].find_one(
        {"_id": ObjectId(user_id)},
        {"firstName": 1, "lastName": 1}
    )
    student_name = f"{user_doc.get('firstName', '')} {user_doc.get('lastName', '')}".strip() if user_doc else "Student"

    pdf_buffer = generate_timetable_pdf(
        classes=classes,
        student_name=student_name,
        student_level=student_level,
        session_name=session_name,
    )

    return StreamingResponse(
        pdf_buffer,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"attachment; filename=IESA_Timetable_Level{student_level}.pdf"
        },
    )


@router.get("/week", response_model=WeeklyScheduleResponse)
async def get_weekly_schedule(
    level: int = Query(..., description="Student level"),
    week_start: Optional[str] = Query(None, description="Week start date (YYYY-MM-DD)"),
    user: dict = Depends(require_ipe_student),
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
    user: dict = Depends(require_ipe_student),
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

    # Notify students at this level about the cancellation
    fire_and_forget(_notify_level_students(
        db, class_session.get("level", 0), class_session.get("sessionId", ""),
        "Class Cancelled",
        f"{class_session.get('courseCode', '')} on {cancellation_data.date} is cancelled: {cancellation_data.reason}",
    ))

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


@router.post("/classes/{class_id}/status", response_model=ClassStatusUpdateResponse)
async def update_class_status(
    class_id: str,
    status_data: ClassStatusUpdateCreate,
    request: Request,
    user: dict = Depends(require_any_permission(["timetable:cancel", "timetable:status"])),
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    """Class rep/admin sets the status of a class instance for a specific date."""
    if not ObjectId.is_valid(class_id):
        raise HTTPException(status_code=400, detail="Invalid class ID")

    class_doc = await db["classSessions"].find_one({"_id": ObjectId(class_id)})
    if not class_doc:
        raise HTTPException(status_code=404, detail="Class not found")

    try:
        datetime.strptime(status_data.date, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")

    session_id = str(class_doc.get("sessionId", ""))
    level = int(class_doc.get("level", 0))
    now = datetime.now(timezone.utc)

    update_doc = {
        "classSessionId": ObjectId(class_id),
        "sessionId": session_id,
        "level": level,
        "date": status_data.date,
        "status": status_data.status,
        "note": status_data.note,
        "updatedBy": str(user.get("_id") or user.get("uid") or ""),
        "updatedAt": now,
    }

    await db["classStatusUpdates"].update_one(
        {"classSessionId": ObjectId(class_id), "date": status_data.date},
        {
            "$set": update_doc,
            "$setOnInsert": {"createdAt": now},
        },
        upsert=True,
    )

    saved = await db["classStatusUpdates"].find_one(
        {"classSessionId": ObjectId(class_id), "date": status_data.date}
    )
    if not saved:
        raise HTTPException(status_code=500, detail="Failed to save class status")

    saved["_id"] = str(saved["_id"])
    saved["classSessionId"] = str(saved["classSessionId"])
    saved["updatedBy"] = str(saved.get("updatedBy", ""))

    status_label_map = {
        "holding": "Class holding",
        "suspended": "Class suspended",
        "not_holding": "Class not holding",
        "postponed": "Class postponed",
        "cancelled": "Class cancelled",
    }
    status_label = status_label_map.get(status_data.status, "Class status updated")
    message = f"{class_doc.get('courseCode', 'Class')} on {status_data.date}: {status_label}."
    if status_data.note:
        message = f"{message} Note: {status_data.note}"

    fire_and_forget(_notify_level_students(
        db,
        level,
        session_id,
        "Timetable Status Update",
        message,
    ))

    await AuditLogger.log(
        action="timetable.class_status_updated",
        actor_id=str(user.get("_id") or user.get("uid") or ""),
        actor_email=user.get("email", "unknown"),
        resource_type="class_session",
        resource_id=class_id,
        details={
            "courseCode": class_doc.get("courseCode"),
            "date": status_data.date,
            "status": status_data.status,
            "note": status_data.note,
        },
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )

    return ClassStatusUpdateResponse(**saved)


@router.get("/class-status", response_model=List[ClassStatusUpdateResponse])
async def list_class_status_updates(
    level: Optional[int] = Query(None, description="Filter by level"),
    start_date: Optional[str] = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="End date (YYYY-MM-DD)"),
    user: dict = Depends(require_ipe_student),
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    """List class status updates for the current session/date range."""
    session = await get_current_session(db)
    query: dict[str, object] = {"sessionId": str(session["_id"])}

    effective_level = level
    if not effective_level:
        effective_level = parse_level_value(
            str(user.get("currentLevel") or user.get("level") or "")
        )
    if effective_level:
        query["level"] = effective_level

    date_filter: dict = {}
    if start_date:
        try:
            datetime.strptime(start_date, "%Y-%m-%d")
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid start_date format. Use YYYY-MM-DD")
        date_filter["$gte"] = start_date
    if end_date:
        try:
            datetime.strptime(end_date, "%Y-%m-%d")
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid end_date format. Use YYYY-MM-DD")
        date_filter["$lte"] = end_date
    if date_filter:
        query["date"] = date_filter

    cursor = db["classStatusUpdates"].find(query).sort([("date", 1), ("updatedAt", -1)])
    docs = await cursor.to_list(length=500)
    response: List[ClassStatusUpdateResponse] = []
    for doc in docs:
        doc["_id"] = str(doc["_id"])
        doc["classSessionId"] = str(doc["classSessionId"])
        doc["updatedBy"] = str(doc.get("updatedBy", ""))
        response.append(ClassStatusUpdateResponse(**doc))
    return response


@router.post("/reminders/dispatch")
async def dispatch_class_reminders(
    level: Optional[int] = Query(None, description="Student level override"),
    user: dict = Depends(require_ipe_student),
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    """Create in-app reminders for classes that are 30m/15m away or ongoing (deduped per user/day)."""
    from app.routers.notifications import create_notification

    session = await get_current_session(db)
    user_id = str(user.get("_id") or user.get("uid") or "")
    if not user_id or not ObjectId.is_valid(user_id):
        raise HTTPException(status_code=401, detail="Invalid user identity")

    effective_level = level or parse_level_value(str(user.get("currentLevel") or user.get("level") or "")) or 300
    now = datetime.now(LAGOS_TZ)
    today = now.date().isoformat()
    weekday = now.strftime("%A")

    classes_cursor = db["classSessions"].find(
        {"sessionId": str(session["_id"]), "level": effective_level, "day": weekday},
        {"courseCode": 1, "courseTitle": 1, "startTime": 1, "endTime": 1, "venue": 1, "level": 1},
    )
    classes = await classes_cursor.to_list(length=100)
    if not classes:
        return {"created": 0, "reminders": []}

    cancellations_cursor = db["classCancellations"].find(
        {"date": today, "classSessionId": {"$in": [c["_id"] for c in classes]}}
    )
    cancelled_ids = {str(item.get("classSessionId")) async for item in cancellations_cursor}

    status_cursor = db["classStatusUpdates"].find(
        {
            "sessionId": str(session["_id"]),
            "level": effective_level,
            "date": today,
            "classSessionId": {"$in": [c["_id"] for c in classes]},
        }
    ).sort("updatedAt", -1)
    status_map: dict[str, str] = {}
    async for update in status_cursor:
        class_id = str(update.get("classSessionId"))
        if class_id not in status_map:
            status_map[class_id] = str(update.get("status") or "")

    skipped_statuses = {"suspended", "not_holding", "postponed", "cancelled"}
    created = 0
    reminders: list[dict] = []

    for cls in classes:
        class_id = str(cls.get("_id"))
        if class_id in cancelled_ids:
            continue
        if status_map.get(class_id) in skipped_statuses:
            continue

        try:
            start_dt = datetime.combine(
                now.date(),
                datetime.strptime(cls["startTime"], "%H:%M").time(),
                tzinfo=LAGOS_TZ,
            )
            end_dt = datetime.combine(
                now.date(),
                datetime.strptime(cls["endTime"], "%H:%M").time(),
                tzinfo=LAGOS_TZ,
            )
        except Exception:
            continue

        kind: Optional[str] = None
        if start_dt <= now < end_dt:
            kind = "ongoing"
        else:
            mins_to_start = (start_dt - now).total_seconds() / 60
            if 14.5 <= mins_to_start <= 15.5:
                kind = "15min"
            elif 29.5 <= mins_to_start <= 30.5:
                kind = "30min"

        if not kind:
            continue

        dedupe_key = f"{user_id}:{class_id}:{today}:{kind}"
        dedupe_result = await db["timetableReminderLogs"].update_one(
            {"key": dedupe_key},
            {
                "$setOnInsert": {
                    "key": dedupe_key,
                    "userId": user_id,
                    "classSessionId": class_id,
                    "date": today,
                    "kind": kind,
                    "createdAt": datetime.now(timezone.utc),
                }
            },
            upsert=True,
        )
        if not getattr(dedupe_result, "upserted_id", None):
            continue

        if kind == "ongoing":
            title = "Class is live now"
            message = f"{cls.get('courseCode', 'Class')} is currently holding at {cls.get('venue', 'its venue')}."
        elif kind == "15min":
            title = "Class starts in 15 minutes"
            message = f"{cls.get('courseCode', 'Class')} starts at {cls.get('startTime')} in {cls.get('venue', 'its venue')}."
        else:
            title = "Class starts in 30 minutes"
            message = f"{cls.get('courseCode', 'Class')} starts at {cls.get('startTime')} in {cls.get('venue', 'its venue')}."

        await create_notification(
            user_id=user_id,
            type="timetable_reminder",
            title=title,
            message=message,
            link="/dashboard/timetable",
            related_id=class_id,
            category="timetable",
        )
        created += 1
        reminders.append({
            "classSessionId": class_id,
            "kind": kind,
            "courseCode": cls.get("courseCode"),
            "startTime": cls.get("startTime"),
        })

    return {"created": created, "reminders": reminders}


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

    # Notify students at this level about the update
    fire_and_forget(_notify_level_students(
        db, class_data.level, "",
        "Timetable Updated",
        f"{class_data.courseCode.upper()} — {class_data.day} {class_data.startTime}–{class_data.endTime} at {class_data.venue}",
    ))

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

    if not ObjectId.is_valid(class_id):
        raise HTTPException(status_code=400, detail="Invalid class ID")

    # Fetch before deleting for audit
    session_doc = await class_sessions.find_one({"_id": ObjectId(class_id)})
    
    try:
        result = await class_sessions.delete_one({"_id": ObjectId(class_id)})
    except:
        raise HTTPException(status_code=400, detail="Invalid class ID")
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Class not found")

    if session_doc:
        fire_and_forget(_notify_level_students(
            db,
            int(session_doc.get("level", 0)),
            str(session_doc.get("sessionId", "")),
            "Class Removed",
            f"{session_doc.get('courseCode', 'A class')} on {session_doc.get('day', '')} at {session_doc.get('startTime', '')} was removed.",
        ))

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


# ═══════════════════════════════════════════════════════════════════
# EXAM TIMETABLE — Date-specific schedule (not recurring)
# ═══════════════════════════════════════════════════════════════════


class ExamCreate(BaseModel):
    courseCode: str
    courseTitle: str
    level: int
    date: str  # "2026-03-20"
    startTime: str  # "09:00"
    endTime: str  # "12:00"
    venue: str
    examType: str = "written"  # written, practical, oral, cbt


class ExamUpdate(BaseModel):
    courseCode: Optional[str] = None
    courseTitle: Optional[str] = None
    level: Optional[int] = None
    date: Optional[str] = None
    startTime: Optional[str] = None
    endTime: Optional[str] = None
    venue: Optional[str] = None
    examType: Optional[str] = None


@router.post("/exams")
async def create_exam(
    exam_data: ExamCreate,
    request: Request,
    user: dict = Depends(require_permission("timetable:create")),
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    """Create an exam timetable entry. Requires timetable:create permission."""
    if exam_data.level not in [100, 200, 300, 400, 500]:
        raise HTTPException(status_code=400, detail="Invalid level")
    validate_time(exam_data.startTime)
    validate_time(exam_data.endTime)
    if exam_data.examType not in ("written", "practical", "oral", "cbt"):
        raise HTTPException(status_code=400, detail="examType must be: written, practical, oral, or cbt")
    try:
        datetime.strptime(exam_data.date, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")

    session = await get_current_session(db)
    doc = {
        "sessionId": str(session["_id"]),
        "courseCode": exam_data.courseCode.upper(),
        "courseTitle": exam_data.courseTitle,
        "level": exam_data.level,
        "date": exam_data.date,
        "startTime": exam_data.startTime,
        "endTime": exam_data.endTime,
        "venue": exam_data.venue,
        "examType": exam_data.examType,
        "createdBy": str(user["_id"]),
        "createdAt": datetime.now(timezone.utc),
        "updatedAt": datetime.now(timezone.utc),
    }
    result = await db["examTimetable"].insert_one(doc)
    doc["_id"] = str(result.inserted_id)

    fire_and_forget(_notify_level_students(
        db,
        exam_data.level,
        str(session["_id"]),
        "New Exam Added",
        f"{exam_data.courseCode.upper()} exam is scheduled for {exam_data.date} ({exam_data.startTime}–{exam_data.endTime}) at {exam_data.venue}.",
    ))

    await AuditLogger.log(
        action="timetable.exam_created",
        actor_id=str(user["_id"]),
        actor_email=user.get("email", "unknown"),
        resource_type="exam_timetable",
        resource_id=str(result.inserted_id),
        details={"courseCode": doc["courseCode"], "date": doc["date"]},
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )

    # Bust caches
    from app.core.cache import cache_delete_pattern
    await cache_delete_pattern("student_dashboard:*")

    return {**doc, "id": doc["_id"]}


@router.get("/exams")
async def list_exams(
    level: Optional[int] = Query(None),
    user: dict = Depends(require_ipe_student),
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    """List exam timetable entries for the current session."""
    session = await get_current_session(db)
    query: dict = {"sessionId": str(session["_id"])}
    if level:
        query["level"] = level
    cursor = db["examTimetable"].find(query).sort([("date", 1), ("startTime", 1)])
    docs = await cursor.to_list(length=200)
    for doc in docs:
        doc["_id"] = str(doc["_id"])
        doc["id"] = doc["_id"]
    return docs


@router.patch("/exams/{exam_id}")
async def update_exam(
    exam_id: str,
    exam_data: ExamUpdate,
    request: Request,
    user: dict = Depends(require_permission("timetable:edit")),
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    """Update an exam timetable entry."""
    if not ObjectId.is_valid(exam_id):
        raise HTTPException(status_code=400, detail="Invalid exam ID")
    updates = {k: v for k, v in exam_data.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")
    if "courseCode" in updates:
        updates["courseCode"] = updates["courseCode"].upper()
    if "startTime" in updates:
        validate_time(updates["startTime"])
    if "endTime" in updates:
        validate_time(updates["endTime"])
    if "date" in updates:
        try:
            datetime.strptime(updates["date"], "%Y-%m-%d")
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date format")
    if "examType" in updates and updates["examType"] not in ("written", "practical", "oral", "cbt"):
        raise HTTPException(status_code=400, detail="Invalid examType")
    if "level" in updates and updates["level"] not in [100, 200, 300, 400, 500]:
        raise HTTPException(status_code=400, detail="Invalid level")

    existing_exam = await db["examTimetable"].find_one({"_id": ObjectId(exam_id)})
    if not existing_exam:
        raise HTTPException(status_code=404, detail="Exam not found")

    updates["updatedAt"] = datetime.now(timezone.utc)
    result = await db["examTimetable"].update_one({"_id": ObjectId(exam_id)}, {"$set": updates})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Exam not found")

    affected_levels = {
        int(existing_exam.get("level", 0)),
        int(updates.get("level", existing_exam.get("level", 0))),
    }
    new_course_code = updates.get("courseCode", existing_exam.get("courseCode", ""))
    new_date = updates.get("date", existing_exam.get("date", ""))
    new_start = updates.get("startTime", existing_exam.get("startTime", ""))

    for level in affected_levels:
        if level <= 0:
            continue
        fire_and_forget(_notify_level_students(
            db,
            level,
            str(existing_exam.get("sessionId", "")),
            "Exam Timetable Updated",
            f"{new_course_code} exam details were updated. Date: {new_date}, Time: {new_start}.",
        ))

    await AuditLogger.log(
        action="timetable.exam_updated",
        actor_id=str(user["_id"]),
        actor_email=user.get("email", "unknown"),
        resource_type="exam_timetable",
        resource_id=exam_id,
        details=updates,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )

    from app.core.cache import cache_delete_pattern
    await cache_delete_pattern("student_dashboard:*")

    return {"message": "Exam updated successfully"}


@router.delete("/exams/{exam_id}")
async def delete_exam(
    exam_id: str,
    request: Request,
    user: dict = Depends(require_permission("timetable:edit")),
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    """Delete an exam timetable entry."""
    if not ObjectId.is_valid(exam_id):
        raise HTTPException(status_code=400, detail="Invalid exam ID")
    doc = await db["examTimetable"].find_one({"_id": ObjectId(exam_id)})
    result = await db["examTimetable"].delete_one({"_id": ObjectId(exam_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Exam not found")

    if doc:
        fire_and_forget(_notify_level_students(
            db,
            int(doc.get("level", 0)),
            str(doc.get("sessionId", "")),
            "Exam Removed",
            f"{doc.get('courseCode', 'An exam')} scheduled for {doc.get('date', '')} was removed from the timetable.",
        ))

    await AuditLogger.log(
        action="timetable.exam_deleted",
        actor_id=str(user["_id"]),
        actor_email=user.get("email", "unknown"),
        resource_type="exam_timetable",
        resource_id=exam_id,
        details={"courseCode": doc.get("courseCode") if doc else None},
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )

    from app.core.cache import cache_delete_pattern
    await cache_delete_pattern("student_dashboard:*")

    return {"message": "Exam deleted successfully"}
