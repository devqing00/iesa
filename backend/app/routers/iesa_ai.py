"""
IESA AI Router - Comprehensive AI Assistant

A smart AI assistant powered by Groq that can:
- Answer questions about timetables/schedules with REAL data
- Provide personalized payment and enrollment info
- Help with IESA processes and procedures
- Offer contextual study tips and academic guidance
- Answer general questions about the department

Uses RAG (Retrieval Augmented Generation) with live database context.
"""

from fastapi import APIRouter, HTTPException, Depends, Request, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import List, Optional, AsyncGenerator
from datetime import datetime, timezone, timedelta, date
from motor.motor_asyncio import AsyncIOMotorDatabase
from bson import ObjectId
import os
import json
import logging
import asyncio

from ..core.security import get_current_user, require_ipe_student
from ..core.rate_limiting import limiter
from ..db import get_database

logger = logging.getLogger("iesa_backend")

router = APIRouter(prefix="/api/v1/iesa-ai", tags=["IESA AI"])

# ─── Account-linked rate limiting (persists across devices) ────────────
AI_HOURLY_LIMIT = int(os.getenv("AI_HOURLY_LIMIT", "20"))
AI_DAILY_LIMIT = int(os.getenv("AI_DAILY_LIMIT", "60"))


def _resolve_ai_account_key(user: dict) -> str:
    """Resolve a stable account key for AI rate limiting.

    Use Mongo user _id as canonical account key so usage is guaranteed
    to sync across all devices/sessions for the same account.
    Fallback to Firebase UID only if _id is unexpectedly missing.
    """
    user_id = user.get("_id")
    if user_id:
        return str(user_id)

    token_data = user.get("tokenData") or {}
    firebase_uid = token_data.get("firebase_uid")
    if firebase_uid:
        return str(firebase_uid)

    return ""


async def _find_or_migrate_rate_limit_doc(account_key: str, db, legacy_user_id: str | None = None) -> dict | None:
    """Find existing AI rate-limit document and migrate legacy keying when needed.

    Legacy docs were keyed by `userId` (Mongo _id string). New docs use
    `accountKey` (Firebase UID preferred). If a legacy doc is found, stamp
    `accountKey` on it to preserve counters.
    """
    col = db["ai_rate_limits"]

    doc = await col.find_one({"accountKey": account_key})
    if doc:
        return doc

    if legacy_user_id:
        legacy_doc = await col.find_one({"userId": legacy_user_id})
        if legacy_doc:
            await col.update_one(
                {"_id": legacy_doc["_id"]},
                {
                    "$set": {
                        "accountKey": account_key,
                        "updatedAt": datetime.now(timezone.utc),
                    }
                },
            )
            legacy_doc["accountKey"] = account_key
            return legacy_doc

    return None


def _current_hour_window() -> datetime:
    """Return the start of the current UTC hour (fixed window)."""
    now = datetime.now(timezone.utc)
    return now.replace(minute=0, second=0, microsecond=0)


def _current_day_window() -> datetime:
    """Return the start of the current UTC day (fixed window)."""
    now = datetime.now(timezone.utc)
    return now.replace(hour=0, minute=0, second=0, microsecond=0)


async def _check_ai_rate_limit(account_key: str, db, legacy_user_id: str | None = None) -> dict:
    """
    Check whether the user has remaining AI quota.

    Uses two fixed-window counters stored in MongoDB:
    - hourly: resets at the top of every hour
    - daily: resets at midnight UTC

    Returns dict with {allowed, hourly_remaining, daily_remaining, reset_at}.
    """
    col = db["ai_rate_limits"]
    hour_start = _current_hour_window()
    day_start = _current_day_window()

    doc = await _find_or_migrate_rate_limit_doc(account_key, db, legacy_user_id)

    hourly_count = 0
    daily_count = 0

    if doc:
        # Reset hourly counter if window has passed
        if doc.get("hourWindowStart") == hour_start:
            hourly_count = doc.get("hourlyCount", 0)
        # Reset daily counter if window has passed
        if doc.get("dayWindowStart") == day_start:
            daily_count = doc.get("dailyCount", 0)

    hourly_remaining = max(0, AI_HOURLY_LIMIT - hourly_count)
    daily_remaining = max(0, AI_DAILY_LIMIT - daily_count)

    allowed = hourly_remaining > 0 and daily_remaining > 0

    # Next hourly reset
    reset_at = hour_start + timedelta(hours=1)

    return {
        "allowed": allowed,
        "hourly_remaining": hourly_remaining,
        "daily_remaining": daily_remaining,
        "hourly_limit": AI_HOURLY_LIMIT,
        "daily_limit": AI_DAILY_LIMIT,
        "reset_at": reset_at.isoformat(),
    }


async def _increment_ai_usage(account_key: str, db, legacy_user_id: str | None = None) -> None:
    """Atomically increment both hourly and daily counters for the user."""
    col = db["ai_rate_limits"]
    hour_start = _current_hour_window()
    day_start = _current_day_window()

    # Upsert with conditional reset: if the stored window differs, reset counter
    doc = await _find_or_migrate_rate_limit_doc(account_key, db, legacy_user_id)

    update_fields: dict = {"updatedAt": datetime.now(timezone.utc)}
    inc_fields: dict = {}

    if not doc or doc.get("hourWindowStart") != hour_start:
        # New hour window — reset hourly counter to 1
        update_fields["hourWindowStart"] = hour_start
        update_fields["hourlyCount"] = 1
    else:
        inc_fields["hourlyCount"] = 1

    if not doc or doc.get("dayWindowStart") != day_start:
        # New day window — reset daily counter to 1
        update_fields["dayWindowStart"] = day_start
        update_fields["dailyCount"] = 1
    else:
        inc_fields["dailyCount"] = 1

    operations: dict = {"$set": update_fields}
    if inc_fields:
        operations["$inc"] = inc_fields

    if doc and doc.get("_id"):
        await col.update_one(
            {"_id": doc["_id"]},
            {
                **operations,
                "$set": {
                    **update_fields,
                    "accountKey": account_key,
                    "userId": legacy_user_id or doc.get("userId"),
                },
            },
            upsert=False,
        )
        return

    await col.update_one(
        {"accountKey": account_key},
        {
            **operations,
            "$set": {
                **update_fields,
                "accountKey": account_key,
                "userId": legacy_user_id,
            },
            "$setOnInsert": {
                "createdAt": datetime.now(timezone.utc),
            },
        },
        upsert=True,
    )

# Groq API setup
try:
    from groq import Groq
    GROQ_AVAILABLE = True
    GROQ_API_KEY = os.getenv("GROQ_API_KEY")
    if GROQ_API_KEY:
        groq_client = Groq(api_key=GROQ_API_KEY)
    else:
        GROQ_AVAILABLE = False
        print("Warning: GROQ_API_KEY not found in environment variables")
except ImportError:
    GROQ_AVAILABLE = False
    print("Warning: groq package not installed. Install with: pip install groq")


class ChatMessage(BaseModel):
    message: str
    conversationHistory: Optional[List[dict]] = []
    language: Optional[str] = "en"  # "en", "pcm" (Pidgin), "yo" (Yoruba)


class ChatResponse(BaseModel):
    reply: str
    suggestions: Optional[List[str]] = None
    data: Optional[dict] = None


# IESA Knowledge Base - Comprehensive reference for RAG
IESA_KNOWLEDGE = """
## About IESA
IESA (Industrial Engineering Students' Association) is the official departmental student body for Industrial & Production Engineering (IPE) at the University of Ibadan (UI), Nigeria — Faculty of Technology. It serves as the bridge between students and the department, organises academic and social programs, and manages departmental resources, dues, and welfare.

## Academic Program
- 5-year B.Sc. in Industrial & Production Engineering (100–500 Level)
- Session cycle: ~February to February, 2 semesters/session, ~15 weeks each + exams
- Level is based on admission year: 100L (Year 1), 200L (Year 2), ... 500L (Year 5)
- Core disciplines: Operations Research, Production Planning, Quality Control, Systems Engineering, Ergonomics, Facilities Planning, Engineering Economy, Automation & Robotics, Work Study
- Final Year Project: IOP 502 (500 Level) — individual research project submitted to the department
- Students take both IPE-specific (IOP-coded) and general engineering courses (MEE, EEE, MAT, GNS)

## Core Courses by Level
100L: ENG 101, MTH 101, PHY 101, CHM 101, GNS 101, GNS 102
200L: TVE 201, TVE 202, MEE 201, MEE 202, MAT 201, GNS 201
300L: IOP 301 (Work Study & Ergonomics), IOP 302 (Production Planning & Control), IOP 303 (Statistical Quality Control), MEE 301, EEE 301, MAT 301
400L: IOP 401 (Operations Research), IOP 402 (Systems Engineering), IOP 403 (Facilities Planning & Design), IOP 404 (Engineering Economy), IOP 405 (Human Factors Engineering)
500L: IOP 501 (Project Management), IOP 502 (Final Year Project), IOP 503 (Automation & Robotics), IOP 504 (Supply Chain Management)

## IESA Structure & Leadership
EXCO positions: President, Vice President, General Secretary, Assistant General Secretary, Financial Secretary, Treasurer, Public Relations Officer (PRO), Welfare Director, Academic Director, Sports Director, Social Director
Class Representatives: Each level has class reps who manage timetables, liaise with lecturers, and represent students
Committees: Academic (library, past questions, study sessions), Welfare (student support, medical, hostel), Sports (athletics, games), Protocol (events, decorum)
To see the current EXCO and their contacts: go to the Team page on the platform (Dashboard → Team → Central EXCO).
To see class reps: Dashboard → Team → Class Reps

## Payments & Dues
- Departmental dues vary by session (typically ₦2,500–₦5,000 total across one or more payment items)
- Multiple payment items may exist per session (e.g., association dues, level dues, welfare levy)
- Pay easily via Paystack: card, bank transfer, USSD — go to the Payments page
- Auto-generated PDF receipt available immediately after payment — go to Receipts page to download
- ID card: green border = dues paid, red border = dues owed
- Payment deadline reminders are sent via announcements

## Platform Features (Full Dashboard)
Core Pages:
- Dashboard Home: Overview of dues status, upcoming events, announcements, and AI assistant
- Payments: Pay all dues via Paystack. View all payment items and status.
- Receipts: Download PDF receipts for any payment you've made.
- Timetable: View your class schedule for the week (managed by class reps/admin)
- Resource Library: Browse and download past questions, lecture slides, study notes, and YouTube tutorials filtered by level and course. Resources are uploaded and managed by admin/EXCO.
- Events: View upcoming and past IESA events; RSVP to events
- Calendar: Full academic calendar — exam dates, events, key dates. Navigate between months and switch between month/week views.
- Announcements: Important notices from IESA EXCO and the department
- Applications: Apply for teams; track your application status
- Archive: Browse announcements and events from past academic sessions. Select any session to see its historical data.
- Settings: Manage notification preferences by category (events, schedule, academic, mentoring, community, admin). Update personal details.
- Profile: Update personal info, profile picture, change password

Growth Tools (Dashboard → Growth):
- CGPA Calculator: Calculate and track your semester GPA and cumulative CGPA using UI's grading system (supports both 5.0 Nigerian and 4.0 US scales). Includes NUC classification. Save progress to history and load previous calculations to auto-fill the calculator.
- Habits Tracker: Build and track daily academic habits (reading, exercise, revision, etc.)
- Weekly Journal: Reflect on your week — what went well, what to improve, next week's focus, gratitude
- Flashcards: Create and study flashcard decks for any course, with flip-card interaction
- Study Groups: Create or join peer study groups for specific courses; coordinate meetings, share resources, and collaborate with classmates
- Study Timer (Pomodoro): Timed focus sessions with break reminders to improve study efficiency
- Weekly Planner: Plan your weekly schedule with time blocks
- Courses: Manage your enrolled courses and track progress
- All growth data is synced to your account — accessible from any device

IEPOD Hub (Dashboard → IEPOD):
- IEPOD stands for IESA Professional Development
- Program structure is phase-based: Stimulate the Mind → Carve Your Niche → Pitch Your Process
- Core workflows include registration (pending/approved/rejected), society commitment, niche audit, team creation/join, iterative submissions, quizzes/challenges, and points leaderboard

TIMP Hub (Dashboard → TIMP):
- TIMP stands for The IESA Mentoring Project
- TIMP is managed as a separate mentoring ecosystem with its own application, pairing, feedback, messaging, and analytics workflows

- Mentoring operations include mentor applications, admin review/approval, mentor-mentee pairing, weekly feedback, pair messaging, and analytics
- TIMP applications are for mentors (not mentees)
- 100L students are mentees and should not apply as mentors
- Mentor applications are gated by session settings and current level rules in the backend
- Pair creation and lifecycle are managed by users with `timp:manage`
- Students can view their own TIMP state from their dashboard (application, pair status, feedback)

Team Pages:
- Central EXCO: Current executive officers with names, roles, and contacts
- Committees: Team members and their roles
- Class Reps: Class representatives for each level

Resource Library:
- Past Questions: Previous exam papers organized by course and level
- Lecture Notes: Slides and notes uploaded by class reps or EXCO
- YouTube Tutorials: Curated educational videos for courses
- Study Materials: General study resources and reference materials
- All resources are approved by admin before becoming visible to students

Press:
- Write for IESA: Submit articles for the IESA press/newsletter
- Review submissions (for editors)
- Read published IESA press articles

Admin Features (for EXCO & authorized roles):
- User management: View, edit, approve, and manage student accounts
- Session management: Create and manage academic sessions
- Payment management: Create payment items, track who has paid
- Timetable management: Add/edit class sessions for each level
- Resource management: Upload, approve, and organize study resources
- Announcement management: Create and publish announcements
- Event management: Create and manage events
- Audit logs: View all administrative actions for transparency
- Role management: Assign roles and permissions to users

Profile: Update personal info, profile picture, change password

## Study & Academic Tips
- For past questions: Dashboard → Resource Library → Filter by level and course
- For CGPA calculation: Dashboard → Growth → CGPA Calculator — supports 4.0 and 5.0 scales, with NUC classification. You can save calculations and load them later to continue tracking progress.
- For study groups: Dashboard → Growth → Study Groups — search by course or create a new group
- For exam prep: Use Flashcards for memorisation, Study Timer for focused sessions, Journal for weekly reflection
- For habit building: Dashboard → Growth → Habits — track daily academic habits and build consistency
- Departmental library (physical) is in the Technology Faculty Complex

## Contact & Support
Office: Technology Faculty Complex, Mon–Fri 10am–4pm
For urgent issues: Contact EXCO directly (see Team page for contacts)
Social: @IESAUI (Instagram, Twitter, Facebook)
Academic issues: Contact Academic Director or your class rep
Welfare issues: Contact Welfare Director
Payment issues: Contact Financial Secretary or Treasurer
"""


async def get_user_context(user_id: str, db: AsyncIOMotorDatabase) -> dict:
    """
    Fetch comprehensive user context for personalized AI responses.
    
    Uses asyncio.gather() to parallelize independent DB queries, reducing
    total wall-clock time from ~15 sequential round-trips to ~3 batches.
    """
    users = db.users
    user = await users.find_one({"_id": ObjectId(user_id) if ObjectId.is_valid(user_id) else user_id})
    
    if not user:
        return {}
    
    level = user.get("currentLevel", "Unknown")

    # ── Birthday check ──
    is_birthday = False
    dob = user.get("dateOfBirth")
    if dob:
        try:
            if isinstance(dob, str):
                from datetime import date as _date_cls
                dob = _date_cls.fromisoformat(dob)
            today = date.today()
            is_birthday = dob.month == today.month and dob.day == today.day
        except Exception:
            pass

    context = {
        "level": level,
        "name": f"{user.get('firstName', '')} {user.get('lastName', '')}".strip(),
        "matric": user.get("matricNumber", "Unknown"),
        "email": user.get("institutionalEmail") or user.get("email", ""),
        "admission_year": user.get("admissionYear", ""),
        "is_birthday": is_birthday,
    }
    
    # Get active session (needed by most subsequent queries)
    sessions = db.sessions
    active_session = await sessions.find_one({"isActive": True})
    
    if not active_session:
        return context

    session_id = str(active_session["_id"])
    context["session"] = active_session.get("name", "Current session")

    # ── Derive numeric level once ──
    numeric_level = None
    try:
        numeric_level = int(str(level).replace("L", "").replace("l", "").strip()) if level != "Unknown" else None
    except (ValueError, TypeError):
        pass

    now = datetime.now(timezone.utc)
    today_name = date.today().strftime("%A")

    # ── BATCH 1: All independent queries that only need session_id / user_id ──
    async def _fetch_payments():
        return await db.payments.find({"sessionId": session_id}).to_list(length=50)

    async def _fetch_events():
        try:
            results = await db.events.find({
                "sessionId": session_id,
                "date": {"$gte": now, "$lte": now + timedelta(days=60)}
            }).sort("date", 1).limit(10).to_list(length=10)
            if not results:
                results = await db.events.find({
                    "date": {"$gte": now, "$lte": now + timedelta(days=60)}
                }).sort("date", 1).limit(10).to_list(length=10)
            if not results:
                results = await db.events.find({
                    "date": {"$gte": now}
                }).sort("date", 1).limit(10).to_list(length=10)
            return results
        except Exception as e:
            logger.warning(f"Events fetch error: {e}")
            return []

    async def _fetch_timetable():
        try:
            if not numeric_level:
                return [], []
            today = await db.classSessions.find({
                "sessionId": session_id, "level": numeric_level, "day": today_name
            }).sort("startTime", 1).to_list(length=20)
            week = await db.classSessions.find({
                "sessionId": session_id, "level": numeric_level,
            }).sort([("day", 1), ("startTime", 1)]).to_list(length=50)
            return today, week
        except Exception as e:
            logger.warning(f"Timetable fetch error: {e}")
            return [], []

    async def _fetch_academic_calendar():
        try:
            now_cal = datetime.now(timezone.utc)
            return await db.academicEvents.find({
                "sessionId": session_id,
                "$or": [
                    {"endDate": {"$gte": now_cal}},
                    {"endDate": None, "startDate": {"$gte": now_cal - timedelta(days=1)}}
                ]
            }).sort("startDate", 1).to_list(length=25)
        except Exception as e:
            logger.warning(f"Academic calendar fetch error: {e}")
            return []

    async def _fetch_resources():
        try:
            if not numeric_level:
                return []
            return await db.resources.find({
                "isApproved": True, "level": numeric_level,
            }).sort("createdAt", -1).limit(15).to_list(length=15)
        except Exception as e:
            logger.warning(f"Resources fetch error: {e}")
            return []

    async def _fetch_iepod():
        try:
            return await db.iepod_registrations.find_one({
                "userId": user_id, "sessionId": session_id
            })
        except Exception as e:
            logger.warning(f"IEPOD fetch error: {e}")
            return None

    async def _fetch_timp():
        try:
            app = await db.timpApplications.find_one({
                "userId": user_id, "sessionId": session_id
            })
            pair = None
            if app:
                pair = await db.timpPairs.find_one({
                    "$or": [{"mentorId": user_id}, {"menteeId": user_id}],
                    "sessionId": session_id
                })
            return app, pair
        except Exception as e:
            logger.warning(f"TIMP fetch error: {e}")
            return None, None

    async def _fetch_enrollments():
        try:
            return await db.enrollments.find({
                "userId": user_id
            }).sort("createdAt", -1).limit(10).to_list(length=10)
        except Exception:
            return []

    async def _fetch_announcements():
        try:
            return await db.announcements.find({}).sort("createdAt", -1).limit(3).to_list(length=3)
        except Exception:
            return []

    async def _fetch_study_groups():
        try:
            return await db.study_groups.find({
                "members.userId": user_id
            }).limit(10).to_list(length=10)
        except Exception:
            return []

    async def _fetch_growth():
        try:
            cgpa_doc = await db.growth_data.find_one({"userId": user_id, "tool": "cgpa-history"})
            habits_doc = await db.growth_data.find_one({"userId": user_id, "tool": "habits"})
            return cgpa_doc, habits_doc
        except Exception:
            return None, None

    # ── NEW: Smart context queries ──────────────────────────────────────
    async def _fetch_unread_notifications():
        try:
            return await db.notifications.count_documents({"userId": user_id, "isRead": False})
        except Exception:
            return 0

    async def _fetch_unread_messages():
        try:
            return await db.messages.count_documents({"recipientId": user_id, "isRead": False})
        except Exception:
            return 0

    async def _fetch_unit_applications():
        try:
            return await db["unit_applications"].find(
                {"userId": user_id},
                {"unitCode": 1, "unitTitle": 1, "status": 1, "semester": 1}
            ).to_list(length=20)
        except Exception:
            return []

    async def _fetch_growth_tools_usage():
        """Get counts of all growth tools the student has used."""
        try:
            pipeline = [
                {"$match": {"userId": user_id}},
                {"$group": {"_id": "$tool", "count": {"$sum": 1}}},
            ]
            docs = await db.growth_data.aggregate(pipeline).to_list(length=20)
            return {d["_id"]: d["count"] for d in docs}
        except Exception:
            return {}

    # Fire all independent queries concurrently
    (
        session_payments,
        upcoming_events,
        timetable_result,
        academic_events_list,
        level_resources,
        iepod_reg,
        timp_result,
        user_enrollments,
        recent_announcements,
        user_groups,
        growth_result,
        unread_notifs,
        unread_msgs,
        unit_apps,
        growth_tools_usage,
    ) = await asyncio.gather(
        _fetch_payments(),
        _fetch_events(),
        _fetch_timetable(),
        _fetch_academic_calendar(),
        _fetch_resources(),
        _fetch_iepod(),
        _fetch_timp(),
        _fetch_enrollments(),
        _fetch_announcements(),
        _fetch_study_groups(),
        _fetch_growth(),
        _fetch_unread_notifications(),
        _fetch_unread_messages(),
        _fetch_unit_applications(),
        _fetch_growth_tools_usage(),
    )

    # ── Process payment results ──
    now = datetime.now(timezone.utc)
    paid_payments = [p for p in session_payments if user_id in (p.get("paidBy") or [])]
    unpaid_payments = [p for p in session_payments if user_id not in (p.get("paidBy") or [])]
    if session_payments:
        context["payment_status"] = f"Paid {len(paid_payments)}/{len(session_payments)} dues"
        context["paid_payments"] = [{"title": p.get("title", ""), "amount": p.get("amount", 0)} for p in paid_payments]

        # ── F16: Deadline urgency scoring for unpaid payments ──
        unpaid_with_urgency = []
        for p in unpaid_payments:
            entry: dict = {"title": p.get("title", ""), "amount": p.get("amount", 0)}
            deadline = p.get("deadline")
            if deadline:
                if hasattr(deadline, "tzinfo") and deadline.tzinfo is None:
                    deadline = deadline.replace(tzinfo=timezone.utc)
                days_left = (deadline - now).days
                entry["deadline"] = deadline.strftime("%B %d, %Y")
                entry["days_left"] = days_left
                if days_left < 0:
                    entry["urgency"] = "OVERDUE"
                elif days_left <= 3:
                    entry["urgency"] = "CRITICAL"
                elif days_left <= 7:
                    entry["urgency"] = "URGENT"
                elif days_left <= 14:
                    entry["urgency"] = "SOON"
                else:
                    entry["urgency"] = "UPCOMING"
            unpaid_with_urgency.append(entry)
        context["unpaid_payments"] = unpaid_with_urgency
    else:
        context["payment_status"] = "No payment dues found for this session"

    # ── Process events ──
    if upcoming_events:
        context["upcoming_events"] = [
            {
                "title": e.get("title", "Untitled Event"),
                "date": e.get("date").strftime("%A, %B %d, %Y") if e.get("date") else "TBD",
                "location": e.get("location", "TBD"),
                "type": e.get("category", e.get("type", "general")),
                "registered": user_id in (e.get("registrations") or []),
                "requires_payment": e.get("requiresPayment", False),
                "payment_amount": e.get("paymentAmount", 0),
            }
            for e in upcoming_events
        ]

    # ── Process timetable ──
    today_classes, all_classes = timetable_result
    if today_classes:
        context["today_classes"] = [
            {
                "course": c.get("courseCode", ""),
                "title": c.get("courseTitle", ""),
                "time": f"{c.get('startTime', '')} - {c.get('endTime', '')}",
                "venue": c.get("venue", "TBD"),
                "type": c.get("type", "lecture"),
                "lecturer": c.get("lecturer", ""),
            }
            for c in today_classes
        ]
    elif numeric_level:
        context["today_classes"] = []
        context["today_note"] = f"No classes scheduled for {today_name}"

    if all_classes:
        week_schedule: dict[str, list] = {}
        day_order = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]
        for c in all_classes:
            day = c.get("day", "Unknown")
            if day not in week_schedule:
                week_schedule[day] = []
            week_schedule[day].append({
                "course": c.get("courseCode", ""),
                "title": c.get("courseTitle", ""),
                "time": f"{c.get('startTime', '')} - {c.get('endTime', '')}",
                "venue": c.get("venue", "TBD"),
                "type": c.get("type", "lecture"),
                "lecturer": c.get("lecturer", ""),
            })
        context["weekly_timetable"] = {d: week_schedule[d] for d in day_order if d in week_schedule}

    # ── Process academic calendar ──
    if academic_events_list:
        context["academic_calendar"] = [
            {
                "title": ae.get("title", ""),
                "type": ae.get("eventType", "general"),
                "start": ae["startDate"].strftime("%A, %B %d, %Y") if ae.get("startDate") and hasattr(ae["startDate"], "strftime") else "TBD",
                "end": ae["endDate"].strftime("%A, %B %d, %Y") if ae.get("endDate") and hasattr(ae["endDate"], "strftime") else None,
                "semester": ae.get("semester", ""),
                "description": (ae.get("description") or "")[:150],
            }
            for ae in academic_events_list
        ]

    # ── Process resources ──
    if level_resources:
        context["resources"] = [
            {
                "title": r.get("title", ""),
                "course": r.get("courseCode", ""),
                "type": r.get("type", "material"),
                "url": r.get("url", ""),
                "uploader": r.get("uploaderName", "Anonymous"),
            }
            for r in level_resources
        ]

    # ── Process IEPOD (may need one follow-up query for society name) ──
    if iepod_reg:
        society_name = None
        if iepod_reg.get("societyId"):
            try:
                society = await db.iepod_societies.find_one({"_id": ObjectId(iepod_reg["societyId"])})
                society_name = society.get("name") if society else None
            except Exception:
                pass
        context["iepod"] = {
            "registered": True,
            "status": iepod_reg.get("status", "pending"),
            "society": society_name,
            "phase": iepod_reg.get("phase"),
        }
    else:
        context["iepod"] = {"registered": False}

    # ── Process TIMP ──
    timp_app, timp_pair = timp_result
    if timp_app:
        context["timp"] = {
            "applied": True,
            "role": "mentor",
            "status": timp_app.get("status", "pending"),
            "paired": bool(timp_pair),
            "partner_name": timp_pair.get("menteeName") if timp_pair else None,
        }
    else:
        context["timp"] = {"applied": False}

    # ── Process enrollments ──
    if user_enrollments:
        context["enrollments"] = [
            {
                "course": e.get("courseCode", ""),
                "title": e.get("courseTitle", ""),
                "status": e.get("status", "active"),
                "semester": e.get("semester", ""),
            }
            for e in user_enrollments
        ]

    # ── Process announcements ──
    if recent_announcements:
        context["recent_announcements"] = [
            {
                "title": a.get("title", ""),
                "content": a.get("content", "")[:150],
                "date": a.get("createdAt").strftime("%B %d, %Y") if a.get("createdAt") and hasattr(a["createdAt"], "strftime") else "Recent",
            }
            for a in recent_announcements
        ]

    # ── Process study groups ──
    if user_groups:
        context["study_groups"] = [
            {
                "name": g.get("name", ""),
                "course": g.get("courseCode", ""),
                "members": len(g.get("members", [])),
                "description": (g.get("description") or "")[:100],
            }
            for g in user_groups
        ]

    # ── Process growth data ──
    cgpa_doc, habits_doc = growth_result
    if cgpa_doc and cgpa_doc.get("data"):
        cgpa_history = cgpa_doc["data"]
        if isinstance(cgpa_history, list) and len(cgpa_history) > 0:
            latest = cgpa_history[0]
            context["cgpa_progress"] = {
                "latest_cgpa": latest.get("gpa"),
                "total_records": len(cgpa_history),
                "grading_system": latest.get("gradingSystem", "5.0"),
                "last_saved": latest.get("timestamp", ""),
            }
    if habits_doc and habits_doc.get("data"):
        habits_data = habits_doc["data"]
        if isinstance(habits_data, list):
            context["habits_count"] = len(habits_data)

    # ── F16: Unread notifications & messages ──
    context["unread_notifications"] = unread_notifs or 0
    context["unread_messages"] = unread_msgs or 0

    # ── F16: Team applications ──
    if unit_apps:
        context["unit_applications"] = [
            {
                "code": a.get("unitCode", ""),
                "title": a.get("unitTitle", ""),
                "status": a.get("status", "pending"),
                "semester": a.get("semester", ""),
            }
            for a in unit_apps
        ]

    # ── F16: Growth tools usage summary ──
    if growth_tools_usage:
        context["growth_tools_used"] = list(growth_tools_usage.keys())

    # ── F16: Academic progress summary (computed from fetched data) ──
    progress: dict = {}
    total_payments = len(session_payments) if session_payments else 0
    if total_payments:
        progress["payment_completion"] = f"{len(paid_payments)}/{total_payments}"
    if user_enrollments:
        progress["enrolled_courses"] = len(user_enrollments)
    if user_groups:
        progress["study_groups_joined"] = len(user_groups)
    if growth_tools_usage:
        progress["growth_tools_active"] = len(growth_tools_usage)
    if progress:
        context["academic_progress"] = progress

    # ── F16: Smart priority actions ────────────────────────────────────
    # Auto-generate 1-5 highest-priority things the student should act on
    priorities: list[dict] = []

    # 1. Overdue / critical payments
    for p in context.get("unpaid_payments", []):
        urg = p.get("urgency", "")
        if urg in ("OVERDUE", "CRITICAL"):
            label = "OVERDUE" if urg == "OVERDUE" else f"Due in {p['days_left']}d"
            priorities.append({
                "action": f"Pay {p['title']} (₦{p['amount']:,.0f}) — {label}",
                "category": "payment",
                "severity": 1 if urg == "OVERDUE" else 2,
            })

    # 2. Upcoming events not yet registered
    for ev in context.get("upcoming_events", []):
        if not ev.get("registered"):
            priorities.append({
                "action": f"RSVP to '{ev['title']}' on {ev['date']}",
                "category": "event",
                "severity": 3,
            })

    # 3. Unread notifs / messages nudge
    if unread_notifs and unread_notifs >= 3:
        priorities.append({
            "action": f"You have {unread_notifs} unread notifications",
            "category": "notification",
            "severity": 4,
        })
    if unread_msgs and unread_msgs >= 1:
        priorities.append({
            "action": f"You have {unread_msgs} unread message{'s' if unread_msgs > 1 else ''}",
            "category": "message",
            "severity": 4,
        })

    # 4. Unit application pending
    for ua in context.get("unit_applications", []):
        if ua["status"] == "pending":
            priorities.append({
                "action": f"Your application for {ua['code']} is still pending",
                "category": "application",
                "severity": 5,
            })

    # Sort by severity (1=most urgent) and keep top 5
    priorities.sort(key=lambda x: x["severity"])
    if priorities:
        context["priority_actions"] = priorities[:5]

    return context


def build_system_prompt(user_context: dict, language: str = "en") -> str:
    """
    Build an intelligent, data-aware system prompt for IESA AI.
    """
    
    # Language-specific instructions
    language_instructions = {
        "en": "Respond in clear, friendly Nigerian English. Be conversational and warm.",
        
        "pcm": """Respond ENTIRELY in Nigerian Pidgin English throughout this conversation. 
Use authentic expressions: "How far?", "E go sweet you", "No wahala", "Wetin dey happen?", "Na so", "Sharp sharp", "Bros/Sisi", "Chai!", "Ehen!", "Omo!", "E be like say".
Keep it friendly like you dey gist with your paddy. Mix English only for technical terms.
Example: "Bros, your payment don enter! You fit download receipt for the Payment page. Na so we see am!"
IMPORTANT: You MUST maintain Pidgin throughout ALL responses in this conversation, never switch to standard English.""",
        
        "yo": """Respond in Yoruba language mixed naturally with English (code-switching). 
Use authentic expressions: "E kaaro", "E kaasan", "E pele", "Bawo ni?", "O dara", "Mo ti gbọ".
Use English for technical terms as Yoruba speakers naturally would.
Example: "E kaaro! Mo ti ri payment rẹ. O le download receipt rẹ lati Payment page. A ti ri i!"
IMPORTANT: You MUST maintain Yoruba style throughout ALL responses in this conversation."""
    }
    
    lang_instruction = language_instructions.get(language, language_instructions["en"])
    
    # Build rich user data section
    user_data_section = ""
    if user_context:
        user_data_section = f"""
## STUDENT PROFILE (REAL DATA — use this to answer questions directly)
- Name: {user_context.get('name', 'Unknown')}
- Level: {user_context.get('level', 'Unknown')}
- Matric Number: {user_context.get('matric', 'Unknown')}
- Email: {user_context.get('email', 'Not set')}
- Admission Year: {user_context.get('admission_year', 'Unknown')}
- Session: {user_context.get('session', 'Unknown')}
- Payment Status: {user_context.get('payment_status', 'Unknown')}"""
        
        if user_context.get('payment_amount'):
            user_data_section += f"\n- Payment Amount: ₦{user_context['payment_amount']:,.0f}"
        if user_context.get('payment_date'):
            user_data_section += f"\n- Paid On: {user_context['payment_date']}"
        
        # Today's classes
        if user_context.get('today_classes'):
            user_data_section += "\n\n## TODAY'S CLASSES"
            for c in user_context['today_classes']:
                user_data_section += f"\n- {c['course']} ({c['title']}): {c['time']} at {c['venue']}"
                if c.get('lecturer'):
                    user_data_section += f" — {c['lecturer']}"
                if c.get('type') != 'lecture':
                    user_data_section += f" [{c['type']}]"
        elif user_context.get('today_note'):
            user_data_section += f"\n\n## TODAY'S CLASSES\n{user_context['today_note']}"
        
        # Weekly timetable
        if user_context.get('weekly_timetable'):
            user_data_section += "\n\n## WEEKLY TIMETABLE"
            for day, classes in user_context['weekly_timetable'].items():
                user_data_section += f"\n### {day}"
                for c in classes:
                    user_data_section += f"\n- {c['course']}: {c['time']} at {c['venue']}"
                    if c.get('lecturer'):
                        user_data_section += f" ({c['lecturer']})"
        
        # Enrollments
        if user_context.get('enrollments'):
            user_data_section += "\n\n## ENROLLED COURSES"
            for e in user_context['enrollments']:
                user_data_section += f"\n- {e['course']} ({e['title']}): {e['status']}"
        
        # Academic Calendar
        if user_context.get('academic_calendar'):
            user_data_section += "\n\n## ACADEMIC CALENDAR"
            for ac in user_context['academic_calendar']:
                user_data_section += f"\n- {ac['title']} ({ac['type']}): {ac['start']} – {ac['end']}"
                if ac.get('semester'):
                    user_data_section += f" [{ac['semester']}]"
                if ac.get('description'):
                    user_data_section += f"\n  {ac['description']}"
        
        # Events
        if user_context.get('upcoming_events'):
            user_data_section += "\n\n## UPCOMING EVENTS (next 60 days)"
            for event in user_context['upcoming_events']:
                registered_tag = " [YOU ARE REGISTERED]" if event.get('registered') else ""
                user_data_section += f"\n- {event['title']} ({event['type']}) — {event['date']}{registered_tag}"
                if event.get('location') and event['location'] != 'TBD':
                    user_data_section += f" at {event['location']}"
                if event.get('requires_payment') and event.get('payment_amount'):
                    user_data_section += f" | ₦{event['payment_amount']:,.0f} entry fee"
        
        # Resources
        if user_context.get('resources'):
            user_data_section += "\n\n## LIBRARY RESOURCES (your level)"
            for r in user_context['resources']:
                user_data_section += f"\n- [{r['type']}] {r['course']}: {r['title']} (by {r['uploader']})"
        
        # IEPOD
        iepod = user_context.get('iepod', {})
        user_data_section += "\n\n## IEPOD STATUS"
        if iepod.get('registered'):
            user_data_section += f"\n- Registered: Yes"
            user_data_section += f"\n- Application Status: {iepod.get('status', 'pending')}"
            if iepod.get('society'):
                user_data_section += f"\n- Assigned Society: {iepod['society']}"
            if iepod.get('phase'):
                user_data_section += f"\n- Current Phase: {iepod['phase']}"
        else:
            user_data_section += "\n- Not yet registered for IEPOD this session"
        
        # TIMP
        timp = user_context.get('timp', {})
        user_data_section += "\n\n## TIMP (MENTORING) STATUS"
        if timp.get('applied'):
            user_data_section += f"\n- Applied as: {timp.get('role', 'mentee').capitalize()}"
            user_data_section += f"\n- Application Status: {timp.get('status', 'pending')}"
            if timp.get('paired'):
                partner = timp.get('partner_name', 'a partner')
                label = "Mentor" if timp.get('role') == 'mentee' else "Mentee"
                user_data_section += f"\n- Paired with {label}: {partner}"
            else:
                user_data_section += "\n- Not yet paired"
        else:
            user_data_section += "\n- Has not applied to TIMP this session"

        level_text = str(user_context.get('level', '')).upper().replace(' ', '')
        if level_text.startswith('100'):
            user_data_section += "\n- Note: As a 100L student, you are in the mentee pool and should not apply as a mentor."
        
        # Announcements
        if user_context.get('recent_announcements'):
            user_data_section += "\n\n## RECENT ANNOUNCEMENTS"
            for a in user_context['recent_announcements']:
                user_data_section += f"\n- [{a['date']}] {a['title']}: {a['content']}"
        
        # Study Groups
        if user_context.get('study_groups'):
            user_data_section += "\n\n## YOUR STUDY GROUPS"
            for g in user_context['study_groups']:
                user_data_section += f"\n- {g['name']}"
                if g.get('course'):
                    user_data_section += f" ({g['course']})"
                user_data_section += f" — {g['members']} members"
        
        # CGPA Progress
        if user_context.get('cgpa_progress'):
            prog = user_context['cgpa_progress']
            user_data_section += f"\n\n## CGPA PROGRESS"
            user_data_section += f"\n- Latest CGPA: {prog.get('latest_cgpa', 'N/A')} ({prog.get('grading_system', '5.0')} scale)"
            user_data_section += f"\n- Records saved: {prog.get('total_records', 0)}"
        
        # Growth Hub usage
        if user_context.get('habits_count'):
            user_data_section += f"\n\n## GROWTH HUB USAGE"
            user_data_section += f"\n- Habits tracked: {user_context['habits_count']}"
        if user_context.get('growth_tools_used'):
            if not user_context.get('habits_count'):
                user_data_section += f"\n\n## GROWTH HUB USAGE"
            user_data_section += f"\n- Tools used: {', '.join(user_context['growth_tools_used'])}"

        # Notifications & Messages
        notif_count = user_context.get('unread_notifications', 0)
        msg_count = user_context.get('unread_messages', 0)
        if notif_count or msg_count:
            user_data_section += "\n\n## INBOX STATUS"
            if notif_count:
                user_data_section += f"\n- Unread notifications: {notif_count}"
            if msg_count:
                user_data_section += f"\n- Unread messages: {msg_count}"

        # Team Applications
        if user_context.get('unit_applications'):
            user_data_section += "\n\n## TEAM APPLICATIONS"
            for ua in user_context['unit_applications']:
                status_tag = ua['status'].upper()
                user_data_section += f"\n- {ua['code']} ({ua['title']}): {status_tag}"
                if ua.get('semester'):
                    user_data_section += f" [{ua['semester']}]"

        # Academic Progress Summary
        if user_context.get('academic_progress'):
            prog = user_context['academic_progress']
            user_data_section += "\n\n## ACADEMIC PROGRESS SNAPSHOT"
            if prog.get('payment_completion'):
                user_data_section += f"\n- Payment completion: {prog['payment_completion']}"
            if prog.get('enrolled_courses'):
                user_data_section += f"\n- Enrolled courses: {prog['enrolled_courses']}"
            if prog.get('study_groups_joined'):
                user_data_section += f"\n- Study groups: {prog['study_groups_joined']}"
            if prog.get('growth_tools_active'):
                user_data_section += f"\n- Growth tools active: {prog['growth_tools_active']}"

        # Smart Priority Actions
        if user_context.get('priority_actions'):
            user_data_section += "\n\n## ⚡ PRIORITY ACTIONS (most urgent first)"
            for i, pa in enumerate(user_context['priority_actions'], 1):
                user_data_section += f"\n{i}. {pa['action']}"

        # Birthday
        if user_context.get('is_birthday'):
            user_data_section += "\n\n## 🎂 TODAY IS THIS STUDENT'S BIRTHDAY!"
            user_data_section += "\nMake your greeting extra warm and celebratory. Wish them a happy birthday naturally in your first response."
    
    # Build unpaid / paid payment details for the prompt
    payment_detail_section = ""
    if user_context.get('paid_payments'):
        payment_detail_section += "\nPaid items:"
        for p in user_context['paid_payments']:
            payment_detail_section += f"\n  ✓ {p['title']} — ₦{p['amount']:,.0f}"
    if user_context.get('unpaid_payments'):
        payment_detail_section += "\nOwing items:"
        for p in user_context['unpaid_payments']:
            line = f"\n  ✗ {p['title']} — ₦{p['amount']:,.0f}"
            if p.get('urgency'):
                line += f" [{p['urgency']}]"
                if p.get('deadline'):
                    if p.get('days_left') is not None and p['days_left'] < 0:
                        line += f" (was due {p['deadline']}, {abs(p['days_left'])} days ago!)"
                    elif p.get('days_left') is not None:
                        line += f" (due {p['deadline']}, {p['days_left']} days left)"
                    else:
                        line += f" (due {p['deadline']})"
            payment_detail_section += line
    if payment_detail_section:
        user_data_section = user_data_section.replace(
            f"- Payment Status: {user_context.get('payment_status', 'Unknown')}",
            f"- Payment Status: {user_context.get('payment_status', 'Unknown')}{payment_detail_section}"
        )

    prompt = f"""You are IESA AI — the smart, friendly academic assistant built for students of the Industrial Engineering Students' Association (IESA) at the University of Ibadan, Nigeria.

You are knowledgeable, encouraging, and grounded in real data. You speak like a helpful senior student who knows the platform inside out.

## LANGUAGE INSTRUCTION
{lang_instruction}

## DIRECT DATA ACCESS
You have LIVE access to this student's real data: profile (name, matric, email, level, admission year), payment status (exact dues paid/owed), class timetable (today + full week), enrolled courses, academic calendar (exam dates, registration periods, breaks), upcoming events (+ whether the student is registered), library resources for their level, IEPOD registration status, TIMP mentoring status, recent announcements, study groups, and CGPA progress. This data is in the STUDENT PROFILE section below. USE IT — never say "I can't access your records" or "check your dashboard" when the answer is already here.

## RESPONSE GUIDELINES
1. **Be specific & direct:** Quote actual data when answering — course names, amounts, times, venues. Don't be vague.
2. **Be concise:** 2–5 sentences for simple questions. Use brief bullet lists for multi-item answers. Avoid long walls of text.
3. **Be honest about gaps:** If a field is empty (no timetable), say so clearly with a practical next step. Example: "No timetable entries yet — your class rep likely hasn't added them. Remind them to update it."
4. **Be context-aware:** "Do I have class tomorrow?" → check the weekly timetable for tomorrow's day. Parse the question's intent before answering.
5. **Be a community ally:** This is a student platform. Be warm, encouraging, motivating. Students are navigating academics and early career — meet them there.
6. **Use emojis sparingly:** 1–2 per message max. Only where they genuinely add warmth, not as filler.
7. **Stay in scope:** You're an IESA/academic assistant. For completely unrelated topics, briefly acknowledge and redirect back to what you can help with.
8. **Reference specific pages:** When guiding a student, name the exact page — "Go to Dashboard → Payments", "Check Dashboard → Growth → CGPA Calculator", "Open Dashboard → IEPOD" or "Open Dashboard → TIMP".
9. **Urgency-aware:** If the PRIORITY ACTIONS section exists, factor urgency into your responses. When a student asks "what should I do?" or any open-ended question, surface the most urgent items naturally. When payment deadlines are OVERDUE or CRITICAL, proactively mention them.
10. **Notification-aware:** If the student has unread notifications or messages, you can mention them when contextually relevant (e.g., "By the way, you have 5 unread notifications").
11. **IEPOD/TIMP factual mode:** For "what is IEPOD" or "what is TIMP" questions, use only the definitions/workflows in PLATFORM KNOWLEDGE + user context. Do not add extra programs, eligibility ranges, or features that are not explicitly listed.
12. **TIMP eligibility clarity:** TIMP application flow is for mentor applications. Do not tell students to apply to be mentored. For 100L students, clearly state they are mentees and are matched by TIMP leads.

## PLATFORM KNOWLEDGE
{IESA_KNOWLEDGE}
{user_data_section}

## CURRENT DATE & TIME
- Today: {datetime.now().strftime("%A, %B %d, %Y")}
- Time: {datetime.now().strftime("%I:%M %p")} (WAT, West Africa Time)

## NON-NEGOTIABLE RULES
- You have the student's data above — NEVER claim otherwise
- NEVER fabricate data not present in the student profile section; if something is missing, say it hasn't been entered yet
- Always suggest the relevant EXCO contact for issues beyond the platform (see Knowledge Base → Contact section)
- For payment questions, be precise: list exactly what is paid and what is owed using the data above, including deadline urgency (OVERDUE, CRITICAL, URGENT, SOON)
- For timetable questions with no data, guide the student to their class rep
- When urgency data is present, naturally weave it into responses — mention overdue/critical deadlines without being alarmist
- For open-ended greetings ("hi", "how far", "what's up"), give a warm greeting then briefly surface the #1 priority action if one exists
- For TIMP guidance: do not suggest "apply as a mentee". State mentor-application-only flow, and if the student is 100L, state they are mentees and should await matching by TIMP leads.
"""

    return prompt


async def summarize_conversation_history(history: List[dict]) -> str:
    """
    Summarize older conversation messages to maintain context without token overflow.
    
    Uses Groq to create a compact summary of the conversation so far.
    """
    if not GROQ_AVAILABLE or not GROQ_API_KEY or len(history) < 8:
        return ""
    
    try:
        # Take the first N-6 messages to summarize (keep last 6 full)
        messages_to_summarize = history[:-6]
        
        summary_prompt = "Summarize this conversation between a student and IESA AI assistant in 2-3 sentences, focusing on key questions asked and answers given:\n\n"
        for msg in messages_to_summarize:
            role = "Student" if msg.get("role") == "user" else "AI"
            summary_prompt += f"{role}: {msg.get('content', '')[:150]}\n"
        
        loop = asyncio.get_running_loop()
        completion = await loop.run_in_executor(None, lambda: groq_client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": summary_prompt}],
            temperature=0.4,
            max_tokens=200,
        ))
        
        summary = completion.choices[0].message.content or ""
        return summary
    except Exception as e:
        logger.debug(f"Summary generation error: {e}")
        return ""


@router.post("/chat/stream")
async def chat_with_iesa_ai_stream(
    request: Request,
    chat_data: ChatMessage,
    user: dict = Depends(require_ipe_student),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """
    Streaming version of IESA AI chat - returns tokens as they're generated.
    
    Rate-limited per student account (persists across devices/sessions).
    Returns Server-Sent Events (SSE) stream with:
    - data: {token: "..."} for each token
    - data: {done: true, suggestions: [...]} when complete
    """
    
    if not GROQ_AVAILABLE or not GROQ_API_KEY:
        async def error_stream():
            yield f"data: {json.dumps({'error': 'AI is currently offline'})}\n\n"
        return StreamingResponse(error_stream(), media_type="text/event-stream")
    
    # Account-linked rate limit check
    user_id = str(user["_id"])
    account_key = _resolve_ai_account_key(user)
    rate_status = await _check_ai_rate_limit(account_key, db, legacy_user_id=user_id)
    if not rate_status["allowed"]:
        async def rate_limit_stream():
            yield f"data: {json.dumps({'error': 'Rate limit reached. You have used all your AI queries for this period.', 'rate_limit': rate_status})}\n\n"
        return StreamingResponse(rate_limit_stream(), media_type="text/event-stream")
    
    # Increment usage BEFORE the call (prevents burst abuse)
    await _increment_ai_usage(account_key, db, legacy_user_id=user_id)
    
    async def generate():
        try:
            # Get user context
            user_context = await get_user_context(str(user["_id"]), db)
            
            # Debug: Log what data is available
            logger.info(f"User context keys: {list(user_context.keys())}")
            logger.info(f"Has timetable: {bool(user_context.get('today_classes') or user_context.get('weekly_timetable'))}")
            
            # Build system prompt
            system_prompt = build_system_prompt(user_context, chat_data.language or "en")
            
            # Build messages with smart context window
            messages = [{"role": "system", "content": system_prompt}]
            
            if chat_data.conversationHistory:
                history_len = len(chat_data.conversationHistory)
                
                if history_len > 12:
                    # Summarize older messages
                    summary = await summarize_conversation_history(chat_data.conversationHistory)
                    if summary:
                        messages.append({"role": "system", "content": f"Previous conversation summary: {summary}"})
                    
                    # Add recent messages
                    for msg in chat_data.conversationHistory[-6:]:
                        messages.append({"role": msg.get("role", "user"), "content": msg.get("content", "")})
                else:
                    # Add all messages if short conversation
                    for msg in chat_data.conversationHistory[-10:]:
                        messages.append({"role": msg.get("role", "user"), "content": msg.get("content", "")})
            
            # Add current message
            messages.append({"role": "user", "content": chat_data.message})
            
            # Stream from Groq (offload sync iterator to executor)
            loop = asyncio.get_running_loop()
            stream = await loop.run_in_executor(None, lambda: groq_client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=messages,  # type: ignore
                temperature=0.6,
                max_tokens=800,
                top_p=0.85,
                stream=True
            ))
            
            full_response = ""
            _sentinel = object()
            stream_iter = iter(stream)
            while True:
                chunk = await loop.run_in_executor(None, lambda: next(stream_iter, _sentinel))
                if chunk is _sentinel:
                    break
                if chunk.choices[0].delta.content:
                    token = chunk.choices[0].delta.content
                    full_response += token
                    yield f"data: {json.dumps({'token': token})}\n\n"
            
            # Generate suggestions
            suggestions = generate_suggestions(chat_data.message, full_response)
            
            # Send completion event
            yield f"data: {json.dumps({'done': True, 'suggestions': suggestions, 'user_context': user_context})}\n\n"
            
        except Exception as e:
            error_msg = str(e).lower()
            logger.error(f"IESA AI stream error: {e}")
            
            if "rate_limit" in error_msg or "429" in error_msg:
                yield f"data: {json.dumps({'error': 'Rate limit reached. Please wait a minute and try again.'})}\n\n"
            else:
                yield f"data: {json.dumps({'error': 'An error occurred. Please try again.'})}\n\n"
    
    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )


@router.get("/usage")
async def get_usage(
    request: Request,
    user: dict = Depends(require_ipe_student),
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    """
    Get current rate limit usage for the authenticated user.
    
    Returns accurate remaining requests from MongoDB-backed counters.
    """
    try:
        user_id = str(user["_id"])
        account_key = _resolve_ai_account_key(user)
        rate_status = await _check_ai_rate_limit(account_key, db, legacy_user_id=user_id)
        return {
            "hourly_limit": rate_status["hourly_limit"],
            "daily_limit": rate_status["daily_limit"],
            "hourly_remaining": rate_status["hourly_remaining"],
            "daily_remaining": rate_status["daily_remaining"],
            "reset_at": rate_status["reset_at"],
        }
    except Exception as e:
        logger.error(f"Usage endpoint error: {e}")
        return {
            "hourly_limit": AI_HOURLY_LIMIT,
            "daily_limit": AI_DAILY_LIMIT,
            "hourly_remaining": None,
            "daily_remaining": None,
        }


@router.post("/chat", response_model=ChatResponse)
async def chat_with_iesa_ai(
    request: Request,
    chat_data: ChatMessage,
    user: dict = Depends(require_ipe_student),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """
    Chat with IESA AI - Comprehensive student assistant.
    
    Rate-limited per student account (persists across devices/sessions).
    
    Handles:
    - Schedule/timetable queries
    - Payment information
    - Event information
    - Study guidance
    - General IESA questions
    """
    
    if not GROQ_AVAILABLE or not GROQ_API_KEY:
        return ChatResponse(
            reply="I'm currently offline. Please check back later or contact the IESA admin.",
            suggestions=["Check the Events page", "Visit the Library", "View your Timetable"]
        )
    
    # Account-linked rate limit check
    user_id = str(user["_id"])
    account_key = _resolve_ai_account_key(user)
    rate_status = await _check_ai_rate_limit(account_key, db, legacy_user_id=user_id)
    if not rate_status["allowed"]:
        hourly_r = rate_status["hourly_remaining"]
        daily_r = rate_status["daily_remaining"]
        if hourly_r <= 0:
            msg = f"You've used all {AI_HOURLY_LIMIT} AI queries for this hour. Try again after {rate_status['reset_at'][:16]}."
        else:
            msg = f"You've used all {AI_DAILY_LIMIT} AI queries for today. Your daily limit resets at midnight UTC."
        return ChatResponse(
            reply=msg,
            suggestions=["Try again later", "Check the Events page", "View your Timetable"],
        )
    
    # Increment usage BEFORE the call
    await _increment_ai_usage(account_key, db, legacy_user_id=user_id)
    
    try:
        # Get user context for personalization
        user_context = await get_user_context(str(user["_id"]), db)
        
        # Build system prompt with context and language preference
        system_prompt = build_system_prompt(user_context, chat_data.language or "en")
        
        # Build conversation history
        messages = [{"role": "system", "content": system_prompt}]
        
        # Add previous messages (keep last 10 for context)
        if chat_data.conversationHistory:
            for msg in chat_data.conversationHistory[-10:]:
                messages.append({
                    "role": msg.get("role", "user"),
                    "content": msg.get("content", "")
                })
        
        # Add current user message
        messages.append({"role": "user", "content": chat_data.message})
        
        # Call Groq API (offload sync SDK call to executor)
        loop = asyncio.get_running_loop()
        completion = await loop.run_in_executor(None, lambda: groq_client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=messages,  # type: ignore
            temperature=0.6,
            max_tokens=800,
            top_p=0.85,
        ))
        
        ai_response = completion.choices[0].message.content or "I couldn't generate a response. Please try again."
        
        # Generate smart suggestions based on query intent
        suggestions = generate_suggestions(chat_data.message, ai_response)
        
        return ChatResponse(
            reply=ai_response,
            suggestions=suggestions,
            data={"user_context": user_context}
        )
        
    except Exception as e:
        error_msg = str(e).lower()
        logger.error(f"IESA AI chat error: {e}")
        
        # Handle Groq rate limit errors specifically
        if "rate_limit" in error_msg or "429" in error_msg or "rate limit" in error_msg:
            return ChatResponse(
                reply="I've hit my thinking limit for now! 🧠 Groq's free tier has request limits. Please wait a minute and try again, or keep your questions concise to use fewer tokens.",
                suggestions=["Try again in 1 minute", "Check the Events page", "View your Timetable"]
            )
        
        return ChatResponse(
            reply="Sorry, I encountered an error. Please try again or rephrase your question.",
            suggestions=["Check the Events page", "Visit the Library", "View your Timetable"]
        )


def generate_suggestions(user_message: str, ai_response: str) -> List[str]:
    """
    Generate context-aware follow-up suggestions.

    Scans both the user's message AND the AI's response for topic signals so
    suggestions always feel relevant to what was just discussed.
    """
    # Combine both sides for topic detection
    combined = (user_message + " " + ai_response).lower()

    # Payment / dues — specific follow-ups depending on whether AI discussed receipts or deadlines
    if any(w in combined for w in ["pay", "dues", "owing", "fee", "receipt", "balance", "clearance"]):
        subs: list[str] = []
        if any(w in combined for w in ["receipt", "download"]):
            subs.append("Download my payment receipt")
        if any(w in combined for w in ["deadline", "overdue", "due in", "critical"]):
            subs.append("When is the next payment deadline?")
        if any(w in combined for w in ["bank transfer", "transfer"]):
            subs.append("How do I submit a bank transfer proof?")
        subs = subs or ["How do I pay my dues?"]
        subs += ["Show all my payment items"] if len(subs) < 2 else []
        subs += ["Check my full payment history"] if len(subs) < 3 else []
        return subs[:3]

    # Events — tailor by whether the AI mentioned a specific event or RSVP
    if any(w in combined for w in ["event", "general meeting", "seminar", "workshop", "program", "activity", "rsvp"]):
        if any(w in combined for w in ["register", "rsvp", "registered"]):
            return ["How do I register for events?", "Show all upcoming events", "What events did I register for?"]
        if any(w in combined for w in ["past", "happened", "previous"]):
            return ["Show upcoming events", "Tell me about recent IESA events", "Who organises events?"]
        return ["Show all upcoming events", "How do I RSVP to an event?", "Are there any paid events?"]

    # Timetable / schedule
    if any(w in combined for w in ["class", "schedule", "timetable", "lecture", "practical", "tutorial", "venue", "lecturer"]):
        if any(w in combined for w in ["tomorrow", "next week", "week"]):
            return ["What classes do I have today?", "Download my timetable as PDF", "Who is my class rep?"]
        if any(w in combined for w in ["venue", "room", "location"]):
            return ["Show my full weekly timetable", "What class is happening now?", "Who is my class rep?"]
        return ["View my full weekly timetable", "Download timetable PDF", "Who is my class rep?"]

    # CGPA
    if any(w in combined for w in ["cgpa", "gpa", "score", "result", "point", "semester"]):
        return ["Open Growth Hub CGPA Calculator", "Find past questions for my courses", "Browse library resources"]

    # Study / exam preparation
    if any(w in combined for w in ["study", "exam", "test", "revision", "prepare", "prepare", "read"]):
        return ["Browse past questions by course", "Start a Pomodoro study timer", "Find or create a study group"]

    # Library / resources
    if any(w in combined for w in ["library", "resource", "material", "book", "slide", "note", "past question", "download"]):
        return ["Browse library resources", "Find past questions by course", "Upload a study material"]

    # IEPOD
    if any(w in combined for w in ["iepod", "orientation", "society", "phase", "quiz", "niches"]):
        return ["Check my IEPOD registration", "What societies are available?", "How do IEPOD phases work?"]

    # TIMP / mentoring
    if any(w in combined for w in ["timp", "mentor", "mentee", "mentoring", "pair", "paired"]):
        return ["How do I apply to TIMP?", "What is the TIMP application deadline?", "Who can be a mentor?"]

    # Growth tools
    if any(w in combined for w in ["habit", "journal", "flashcard", "goal", "timer", "planner", "pomodoro", "growth hub"]):
        return ["Track my daily habits", "Open my study journal", "Start a Pomodoro focus timer"]

    # Team / EXCO / contacts
    if any(w in combined for w in ["exco", "president", "secretary", "team", "class rep", "welfare", "contact", "officer"]):
        return ["View current EXCO members", "Who is my class rep?", "How do I contact the Welfare Director?"]

    # Announcements
    if any(w in combined for w in ["announcement", "notice", "update", "news"]):
        return ["Show all recent announcements", "What did EXCO announce this week?", "How do I get notified?"]

    # Applications (teams)
    if any(w in combined for w in ["application", "team", "apply", "pending", "approved", "rejected"]):
        return ["Check my application status", "What teams can I apply to?", "When do applications close?"]

    # Study groups
    if any(w in combined for w in ["study group", "group", "collaborate", "join"]):
        return ["Find a study group for my course", "Create a new study group", "Show my study groups"]

    # Career / niche / professional
    if any(w in combined for w in ["career", "niche", "professional", "industry", "internship", "audit"]):
        return ["Take the Niche Audit tool", "Apply for TIMP mentoring", "Explore IEPOD resources"]

    # Priority / what should I do (open-ended)
    if any(w in combined for w in ["priority", "urgent", "important", "should i do", "what next", "todo"]):
        return ["Check my payment status", "Show unread notifications", "What events am I registered for?"]

    # Default — varied, genuinely useful starting points
    return [
        "What classes do I have today?",
        "Check my payment status",
        "Show upcoming events",
    ]


@router.get("/suggestions")
async def get_quick_suggestions():
    """
    Get quick suggestion chips for the chat interface.
    """
    return {
        "suggestions": [
            "What events are coming up?",
            "How do I pay my dues?",
            "What classes do I have today?",
            "Show me resources for my level",
            "How do I calculate my CGPA?",
            "What is TIMP mentoring?",
            "How do I join or create a study group?",
            "Who are the current EXCO members?",
            "What is the Niche Audit tool?",
            "Tips for exam preparation",
            "How do I apply for a team?",
            "When is the next general meeting?"
        ]
    }


@router.post("/feedback")
async def submit_feedback(
    feedback: dict,
    user: dict = Depends(require_ipe_student),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """
    Submit feedback on AI responses (for improvement).
    """
    
    feedbacks = db.ai_feedback
    
    feedback_doc = {
        "userId": str(user["_id"]),
        "message": feedback.get("message"),
        "response": feedback.get("response"),
        "rating": feedback.get("rating"),  # thumbs up/down
        "comment": feedback.get("comment"),
        "createdAt": datetime.now(timezone.utc)
    }
    
    await feedbacks.insert_one(feedback_doc)
    
    return {"message": "Thank you for your feedback!"}
