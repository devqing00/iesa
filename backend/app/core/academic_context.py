from datetime import datetime, timezone
from motor.motor_asyncio import AsyncIOMotorDatabase
from typing import Dict, Any

async def get_academic_context(db: AsyncIOMotorDatabase, session: dict) -> Dict[str, Any]:
    """Generate a rich academic context based on the current date and active session/events."""
    now = datetime.now(timezone.utc)
    
    # 1. Determine current semester
    sem2_start = session.get("semester2StartDate")
    if sem2_start:
        if sem2_start.tzinfo is None:
            sem2_start = sem2_start.replace(tzinfo=timezone.utc)
        current_semester = 1 if now < sem2_start else 2
    else:
        current_semester = 1
        
    context = {
        "sessionName": session.get("name", ""),
        "currentSemester": current_semester,
        "isExamPeriod": False,
        "isHoliday": False,
        "isResumptionWeek": False,
        "isEndOfSemester": False,
        "isLecturePeriod": False,
        "currentEventTitle": None,
        "currentWeek": 1,
        "nextEventTitle": None,
        "nextEventType": None,
        "daysToNextEvent": None
    }
    
    # Calculate isLecturePeriod (first 11 weeks = 77 days)
    # Using current_semester, get the corresponding start date
    sem_start = session.get(f"semester{current_semester}StartDate")
    if sem_start:
        if sem_start.tzinfo is None:
            sem_start = sem_start.replace(tzinfo=timezone.utc)
        
        days_since_start = (now - sem_start).days
        if days_since_start >= 0:
            context["currentWeek"] = max(1, days_since_start // 7 + 1)
            
        if 0 <= days_since_start <= 77:
            context["isLecturePeriod"] = True
    
    # Check for active academic events
    # We query events that overlap with `now` and belong to the current session
    events_cursor = db["academicEvents"].find({
        "sessionId": str(session["_id"]),
        "startDate": {"$lte": now},
        "$or": [
            {"endDate": {"$gte": now}},
            {"endDate": None}
        ]
    }).sort("startDate", -1).limit(1)
    
    active_events = await events_cursor.to_list(length=1)
    if active_events:
        event = active_events[0]
        event_type = event.get("eventType")
        context["currentEventTitle"] = event.get("title")
        
        if event_type == "exam_period":
            context["isExamPeriod"] = True
            context["isLecturePeriod"] = False
        elif event_type in ["holiday", "break_period"]:
            context["isHoliday"] = True
            context["isLecturePeriod"] = False
            
    # Find next upcoming event
    next_events_cursor = db["academicEvents"].find({
        "sessionId": str(session["_id"]),
        "startDate": {"$gt": now}
    }).sort("startDate", 1).limit(1)
    
    next_events = await next_events_cursor.to_list(length=1)
    if next_events:
        next_event = next_events[0]
        context["nextEventTitle"] = next_event.get("title")
        context["nextEventType"] = next_event.get("eventType")
        next_start = next_event.get("startDate")
        if next_start:
            if next_start.tzinfo is None:
                next_start = next_start.replace(tzinfo=timezone.utc)
            context["daysToNextEvent"] = max(0, (next_start - now).days)
        
    # Check resumption week (first 14 days of either semester)
    sem1_start = session.get("semester1StartDate")
    if sem1_start:
        if sem1_start.tzinfo is None:
            sem1_start = sem1_start.replace(tzinfo=timezone.utc)
        if 0 <= (now - sem1_start).days <= 14:
            context["isResumptionWeek"] = True
            
    if sem2_start:
        if 0 <= (now - sem2_start).days <= 14:
            context["isResumptionWeek"] = True
            
    sem1_end = session.get("semester1EndDate")
    sem2_end = session.get("semester2EndDate")

    # Calculate first/last days
    context["isFirstDayOfSemester"] = False
    context["isFirstDayOfSession"] = False
    context["isLastDayOfSemester"] = False
    context["isLastDayOfSession"] = False
    context["daysIntoSemester"] = 0

    if sem_start:
        days_since_start = (now - sem_start).days
        context["daysIntoSemester"] = max(0, days_since_start)
        if days_since_start == 0:
            context["isFirstDayOfSemester"] = True
            if current_semester == 1:
                context["isFirstDayOfSession"] = True

    if sem1_end:
        if sem1_end.tzinfo is None:
            sem1_end = sem1_end.replace(tzinfo=timezone.utc)
        if current_semester == 1 and 0 <= (sem1_end - now).days <= 14:
            context["isEndOfSemester"] = True
            if (sem1_end - now).days == 0:
                context["isLastDayOfSemester"] = True
            
    if sem2_end:
        if sem2_end.tzinfo is None:
            sem2_end = sem2_end.replace(tzinfo=timezone.utc)
        if current_semester == 2 and 0 <= (sem2_end - now).days <= 14:
            context["isEndOfSemester"] = True
            if (sem2_end - now).days == 0:
                context["isLastDayOfSemester"] = True
                context["isLastDayOfSession"] = True

    # Work Experience & Industrial Training Info (SWEP, SIWES, IT)
    context["workExperienceDetails"] = {
        "200L": {
            "name": "SWEP (Student Work Experience Program)",
            "timing": "After Second Semester (during holiday break)",
            "duration": "6 to 8 weeks",
            "description": "Practical engineering workshop experience for 200L students after S2."
        },
        "300L": {
            "name": "SIWES (Students Industrial Work Experience Scheme)",
            "timing": "After Second Semester (during holiday break)",
            "duration": "3 months (9 to 12 weeks)",
            "description": "Industrial placement in manufacturing & engineering firms for 300L students after S2."
        },
        "400L": {
            "name": "6 Months Industrial Training (IT)",
            "timing": "Second Semester (Full 6 Months)",
            "duration": "6 months (minimum 24 weeks)",
            "description": "Full 6-month industrial placement starting at the beginning of 400L S2. 400L students take no on-campus lectures during S2."
        }
    }

    return context
