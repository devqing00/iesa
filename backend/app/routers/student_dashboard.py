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


def _is_team_lead_position(position: str) -> bool:
    return position.startswith("team_head_") or position in {"ics_head", "academic_lead", "press_editor_in_chief"}


async def _matches_announcement_audience(
    db,
    *,
    user_id: str,
    user_role: str,
    user_department: str,
    session_id: str,
    target_audience: str,
    target_user_ids: list[str],
    user_positions: list[str] | None = None,
) -> bool:
    if target_audience in {"all", "specific_levels"}:
        return True
    if target_audience == "ipe":
        return user_department == "Industrial Engineering"
    if target_audience == "external":
        return user_department != "Industrial Engineering"
    if target_audience == "specific_students":
        return user_id in set(target_user_ids or [])
    if target_audience == "exco_only":
        return user_role == "exco"

    positions = user_positions or []
    if not positions and target_audience in {"team_leads_only", "class_rep_and_assistant"}:
        role_docs = await db["roles"].find(
            {"userId": user_id, "sessionId": session_id, "isActive": True},
            {"position": 1},
        ).to_list(length=None)
        positions = [str(doc.get("position", "")) for doc in role_docs]

    if target_audience == "team_leads_only":
        return any(_is_team_lead_position(pos) for pos in positions)
    if target_audience == "class_rep_and_assistant":
        return any(pos.startswith("class_rep_") or pos.startswith("asst_class_rep_") for pos in positions)

    return True


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
        # Only show published announcements (or legacy docs without the field)
        "$and": [
            {"$or": [{"isPublished": True}, {"isPublished": {"$exists": False}}]}
        ],
    }
    cursor = (
        db["announcements"]
        .find(query)
        .sort([("isPinned", -1), ("priority", -1), ("createdAt", -1)])
        .limit(limit * 3)  # over-fetch to account for level + audience filtering
    )
    docs = await cursor.to_list(length=limit * 3)

    user_doc = await db["users"].find_one({"_id": ObjectId(user_id)}, {"role": 1})
    user_role = (user_doc or {}).get("role", "student")
    user_positions: list[str] = []
    if not is_admin:
        role_docs = await db["roles"].find(
            {"userId": user_id, "sessionId": session_id, "isActive": True},
            {"position": 1},
        ).to_list(length=None)
        user_positions = [str(doc.get("position", "")) for doc in role_docs]
    result = []
    for doc in docs:
        target_levels = doc.get("targetLevels")
        if target_levels and not is_admin:
            if not user_level or user_level not in target_levels:
                continue

        # Audience targeting
        target_audience = doc.get("targetAudience", "all")
        target_user_ids = [str(uid) for uid in (doc.get("targetUserIds") or [])]
        if not is_admin:
            allowed = await _matches_announcement_audience(
                db,
                user_id=user_id,
                user_role=user_role,
                user_department=user_department,
                session_id=session_id,
                target_audience=target_audience,
                target_user_ids=target_user_ids,
                user_positions=user_positions,
            )
            if not allowed:
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
    today_iso = date.today().isoformat()

    query: dict = {"sessionId": session_id, "day": day_name}
    if user_level:
        # user_level is e.g. "300L" — extract numeric part for the DB query
        try:
            query["level"] = int(str(user_level).replace("L", ""))
        except (ValueError, TypeError):
            pass

    cursor = db["classSessions"].find(query).sort("startTime", 1)
    docs = await cursor.to_list(length=20)

    if not docs:
        return []

    class_object_ids = [doc["_id"] for doc in docs]

    cancellations = await db["classCancellations"].find(
        {
            "date": today_iso,
            "classSessionId": {"$in": class_object_ids},
        },
        {"classSessionId": 1},
    ).to_list(length=100)
    cancelled_ids = {str(item.get("classSessionId")) for item in cancellations}

    status_updates = await db["classStatusUpdates"].find(
        {
            "sessionId": session_id,
            "date": today_iso,
            "classSessionId": {"$in": class_object_ids},
        },
        {"classSessionId": 1, "status": 1, "updatedAt": 1},
    ).sort("updatedAt", -1).to_list(length=200)

    latest_status_by_class: dict[str, str] = {}
    for item in status_updates:
        class_id = str(item.get("classSessionId"))
        if class_id not in latest_status_by_class:
            latest_status_by_class[class_id] = str(item.get("status") or "")

    blocked_statuses = {"suspended", "not_holding", "postponed", "cancelled"}

    result = []
    for doc in docs:
        class_id = str(doc["_id"])
        if class_id in cancelled_ids:
            continue

        if latest_status_by_class.get(class_id) in blocked_statuses:
            continue

        result.append({
            "id": class_id,
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


async def _fetch_todays_birthdays(db, current_user_id: str, limit: int = 10):
    """Return students whose birthday is today (month + day match)."""
    today = date.today()
    month = today.month
    day = today.day

    pipeline = [
        {
            "$match": {
                "dateOfBirth": {"$exists": True, "$ne": None},
                "isActive": {"$ne": False},
            }
        },
        {
            "$addFields": {
                "birthMonth": {"$month": "$dateOfBirth"},
                "birthDay": {"$dayOfMonth": "$dateOfBirth"},
            }
        },
        {"$match": {"birthMonth": month, "birthDay": day}},
        {
            "$project": {
                "_id": {"$toString": "$_id"},
                "firstName": 1,
                "lastName": 1,
                "profilePictureUrl": 1,
                "currentLevel": 1,
                "department": 1,
            }
        },
        {"$limit": limit},
    ]

    birthdays = await db["users"].aggregate(pipeline).to_list(length=limit)
    for b in birthdays:
        b["isCurrentUser"] = b["_id"] == current_user_id
    return birthdays


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
        announcements, birthdays = await asyncio.gather(
            _fetch_announcements(
                db, session_id, user_id, user_level, is_admin, user_department
            ),
            _fetch_todays_birthdays(db, user_id),
        )
        is_my_birthday = any(b["isCurrentUser"] for b in birthdays)
        result = {
            "announcements": announcements,
            "events": [],
            "payments": [],
            "todayClasses": [],
            "birthdays": birthdays,
            "isMyBirthday": is_my_birthday,
            "activeSession": session_name,
        }
    else:
        # Fetch all in parallel for IPE students
        announcements, events, payments, today_classes, birthdays = await asyncio.gather(
            _fetch_announcements(db, session_id, user_id, user_level, is_admin, user_department),
            _fetch_upcoming_events(db, session_id, user_id),
            _fetch_payments(db, session_id, user_id),
            _fetch_today_classes(db, session_id, user_level),
            _fetch_todays_birthdays(db, user_id),
        )
        is_my_birthday = any(b["isCurrentUser"] for b in birthdays)
        result = {
            "announcements": announcements,
            "events": events,
            "payments": payments,
            "todayClasses": today_classes,
            "birthdays": birthdays,
            "isMyBirthday": is_my_birthday,
            "activeSession": session_name,
        }
    await cache_set(cache_key, result, ttl=CACHE_TTL)
    return result
