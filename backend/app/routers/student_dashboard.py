"""
Student Dashboard Aggregation Router

Single endpoint that returns everything needed by the student dashboard
in one network round-trip: announcements, upcoming events, payment status,
and today's class schedule.
"""

from __future__ import annotations

import asyncio
from datetime import date, datetime, timezone

from fastapi import APIRouter, Depends
from bson import ObjectId

from app.core.security import get_current_user
from app.core.cache import cache_get, cache_set
from app.db import get_database

router = APIRouter(prefix="/api/v1/student", tags=["Student Dashboard"])

CACHE_TTL = 30  # seconds — short TTL because data is personalized per user


# ── helpers ──────────────────────────────────────────────────────

async def _get_active_session(db):
    """Return the active session document or None."""
    return await db["sessions"].find_one({"isActive": True})


async def _get_user_level(db, user_id: str, session_id: str):
    """Look up the student's enrolled level for a session."""
    enrollment = await db["enrollments"].find_one(
        {"studentId": user_id, "sessionId": session_id, "isActive": True},
        {"level": 1},
    )
    return enrollment.get("level") if enrollment else None


async def _fetch_announcements(db, session_id: str, user_id: str, user_level: str | None, is_admin: bool, user_department: str = "Industrial Engineering", limit: int = 5):
    """Latest N announcements, with read status, filtered by level + audience + expiry."""
    query = {
        "sessionId": session_id,
        "$or": [
            {"expiresAt": None},
            {"expiresAt": {"$gt": datetime.now(timezone.utc)}},
        ],
    }
    cursor = (
        db["announcements"]
        .find(query)
        .sort([("isPinned", -1), ("priority", -1), ("createdAt", -1)])
        .limit(limit * 3)  # over-fetch to account for level + audience filtering
    )
    docs = await cursor.to_list(length=limit * 3)

    is_ipe_student = user_department == "Industrial Engineering"
    result = []
    for doc in docs:
        target_levels = doc.get("targetLevels")
        if target_levels and not is_admin:
            if not user_level or user_level not in target_levels:
                continue

        # Audience targeting: ipe-only vs external-only vs all
        target_audience = doc.get("targetAudience", "all")
        if target_audience != "all" and not is_admin:
            if target_audience == "ipe" and not is_ipe_student:
                continue
            if target_audience == "external" and is_ipe_student:
                continue
        result.append({
            "id": str(doc["_id"]),
            "title": doc.get("title", ""),
            "content": doc.get("content", ""),
            "category": doc.get("category", ""),
            "priority": doc.get("priority", "normal"),
            "createdAt": doc.get("createdAt", ""),
            "authorName": doc.get("authorName", ""),
            "isRead": user_id in doc.get("readBy", []),
        })
        if len(result) >= limit:
            break
    return result


async def _fetch_upcoming_events(db, session_id: str, user_id: str, limit: int = 4):
    """Next N future events with registration status."""
    query = {
        "sessionId": session_id,
        "date": {"$gte": datetime.now(timezone.utc)},
    }
    cursor = db["events"].find(query).sort("date", 1).limit(limit)
    docs = await cursor.to_list(length=limit)

    result = []
    for doc in docs:
        result.append({
            "id": str(doc["_id"]),
            "title": doc.get("title", ""),
            "date": doc.get("date", ""),
            "location": doc.get("location", ""),
            "category": doc.get("category", ""),
            "isRegistered": user_id in doc.get("registrations", []),
        })
    return result


async def _fetch_payments(db, session_id: str, user_id: str):
    """All payments for the session with hasPaid status."""
    cursor = db["payments"].find({"sessionId": session_id}).sort("deadline", 1)
    docs = await cursor.to_list(length=100)

    result = []
    for doc in docs:
        result.append({
            "id": str(doc["_id"]),
            "title": doc.get("title", ""),
            "amount": doc.get("amount", 0),
            "deadline": doc.get("deadline", ""),
            "hasPaid": user_id in doc.get("paidBy", []),
        })
    return result


async def _fetch_today_classes(db, session_id: str, user_level: int | None):
    """Today's class sessions for the student's level."""
    day_name = date.today().strftime("%A")  # e.g. "Monday"

    query: dict = {"sessionId": session_id, "day": day_name}
    if user_level:
        # user_level is e.g. "300L" — extract numeric part for the DB query
        try:
            query["level"] = int(str(user_level).replace("L", ""))
        except (ValueError, TypeError):
            pass

    cursor = db["classSessions"].find(query).sort("startTime", 1)
    docs = await cursor.to_list(length=20)

    result = []
    for doc in docs:
        result.append({
            "id": str(doc["_id"]),
            "courseCode": doc.get("courseCode", ""),
            "courseTitle": doc.get("courseTitle", ""),
            "startTime": doc.get("startTime", ""),
            "endTime": doc.get("endTime", ""),
            "venue": doc.get("venue", ""),
            "day": doc.get("day", ""),
            "classType": doc.get("classType", ""),
        })
    return result


# ── main endpoint ────────────────────────────────────────────────

@router.get("/dashboard")
async def get_student_dashboard(
    current_user: dict = Depends(get_current_user),
):
    """
    Aggregate all student dashboard data in one call.

    Returns: announcements (5), upcoming events (4), payments (all with
    hasPaid status), and today's class schedule.
    """
    cache_key = f"student_dashboard:{current_user['_id']}"
    cached = await cache_get(cache_key)
    if cached is not None:
        return cached

    db = get_database()
    user_id = current_user["_id"]
    user_role = current_user.get("role", "student")
    is_admin = user_role in ("admin", "super_admin")

    # Get active session
    session = await _get_active_session(db)
    if not session:
        return {
            "announcements": [],
            "events": [],
            "payments": [],
            "todayClasses": [],
            "activeSession": None,
        }

    session_id = str(session["_id"])
    session_name = session.get("name")

    # Get user level (needed for announcements + timetable)
    user_level = await _get_user_level(db, user_id, session_id)

    # External students only need announcements — skip events, payments, timetable
    user_department = current_user.get("department", "Industrial Engineering")
    is_external = user_department != "Industrial Engineering" and not is_admin

    if is_external:
        announcements = await _fetch_announcements(
            db, session_id, user_id, user_level, is_admin, user_department
        )
        result = {
            "announcements": announcements,
            "events": [],
            "payments": [],
            "todayClasses": [],
            "activeSession": session_name,
        }
    else:
        # Fetch all in parallel for IPE students
        announcements, events, payments, today_classes = await asyncio.gather(
            _fetch_announcements(db, session_id, user_id, user_level, is_admin, user_department),
            _fetch_upcoming_events(db, session_id, user_id),
            _fetch_payments(db, session_id, user_id),
            _fetch_today_classes(db, session_id, user_level),
        )
        result = {
            "announcements": announcements,
            "events": events,
            "payments": payments,
            "todayClasses": today_classes,
            "activeSession": session_name,
        }
    await cache_set(cache_key, result, ttl=CACHE_TTL)
    return result
