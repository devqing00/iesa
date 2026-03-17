"""
Class Rep Portal Router

Provides level-scoped features for class representatives and their assistants:
- Cohort directory & CSV/PDF export
- Cohort stats (enrollment, payment compliance)
- Deadline board (CRUD)
- Quick polls (CRUD + voting)
- Lecturer relay board (CRUD + pin)
- Level-targeted announcements (create)
- Level-filtered timetable view

Every endpoint auto-scopes data to the rep's assigned level.
"""

import csv
import io
import asyncio
from datetime import datetime, timezone
from typing import Optional

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import StreamingResponse

from app.core.permissions import require_permission
from app.core.security import get_current_user
from app.core.audit import AuditLogger
from app.db import get_database

router = APIRouter(prefix="/api/v1/class-rep", tags=["class-rep"])


# ──────────────────────────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────────────────────────

async def _get_rep_level(user: dict) -> str:
    """
    Resolve the level scope from the caller's active portal role.
    Supports class reps, assistant class reps, and freshers coordinator.
    Raises 403 if the caller has no active role for this portal.
    """
    db = get_database()
    user_id = str(user.get("_id") or user.get("id", ""))

    active_session_id = await _get_active_session_id()

    roles = await db["roles"].find({
        "userId": user_id,
        "isActive": True,
        "$or": [
            {"position": {"$regex": "^class_rep_"}},
            {"position": {"$regex": "^asst_class_rep_"}},
            {"position": "freshers_coordinator"},
        ],
    }).to_list(None)

    if not roles:
        raise HTTPException(status_code=403, detail="No active class-rep or freshers-coordinator role found")

    # Prioritize active session roles; fall back to any active role if needed.
    scoped_roles = [r for r in roles if str(r.get("sessionId", "")) == active_session_id] or roles

    # Freshers coordinator is always scoped to 100L.
    if any(r.get("position") == "freshers_coordinator" for r in scoped_roles):
        return "100L"

    role = next(
        (
            r for r in scoped_roles
            if str(r.get("position", "")).startswith("class_rep_")
            or str(r.get("position", "")).startswith("asst_class_rep_")
        ),
        None,
    )
    if not role:
        raise HTTPException(status_code=403, detail="No active class-rep role found")

    # Extract level from position string: class_rep_400L → 400L
    # Or use the explicit `level` field on the role doc
    level = role.get("level")
    if not level:
        pos = role["position"]
        # class_rep_400L or asst_class_rep_400L
        parts = pos.split("_")
        level = parts[-1]  # last segment is the level

    if not level:
        raise HTTPException(status_code=500, detail="Level not set on class-rep role")
    return level


async def _require_active_freshers_role(user: dict) -> None:
    """Ensure caller has an active freshers_coordinator role for the active session."""
    db = get_database()
    user_id = str(user.get("_id") or user.get("id", ""))
    active_session_id = await _get_active_session_id()

    role = await db["roles"].find_one({
        "userId": user_id,
        "position": "freshers_coordinator",
        "sessionId": active_session_id,
        "isActive": True,
    })
    if not role:
        raise HTTPException(
            status_code=403,
            detail="Freshers portal access requires an active freshers_coordinator role in the current session",
        )


async def _get_active_session_id() -> str:
    db = get_database()
    session = await db["sessions"].find_one({"isActive": True})
    if not session:
        raise HTTPException(status_code=404, detail="No active session")
    return str(session["_id"])


def _user_id(user: dict) -> str:
    return str(user.get("_id") or user.get("id", ""))


def _level_to_int(level: str) -> int:
    digits = "".join(ch for ch in str(level) if ch.isdigit())
    if not digits:
        raise HTTPException(status_code=500, detail="Invalid level scope")
    level_num = int(digits)
    if level_num not in [100, 200, 300, 400, 500]:
        raise HTTPException(status_code=400, detail="Invalid level")
    return level_num


def _validate_day(day: str) -> str:
    valid_days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
    day_normalized = str(day or "").strip().capitalize()
    if day_normalized not in valid_days:
        raise HTTPException(status_code=400, detail=f"Invalid day. Must be one of: {', '.join(valid_days)}")
    return day_normalized


def _validate_time(time_str: str) -> str:
    try:
        datetime.strptime(time_str, "%H:%M")
        return time_str
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid time format: {time_str}. Use HH:MM (e.g., 08:00)")


def _time_to_minutes(time_str: str) -> int:
    hours, minutes = map(int, time_str.split(":"))
    return (hours * 60) + minutes


async def _get_level_cohort_user_ids(db, session_id: str, level: str) -> list[str]:
    enrollments = await db["enrollments"].find(
        {"sessionId": session_id, "level": level, "isActive": True},
        {"studentId": 1, "userId": 1},
    ).to_list(None)
    cohort_ids = []
    for e in enrollments:
        sid = e.get("studentId") or str(e.get("userId", ""))
        if sid:
            cohort_ids.append(str(sid))
    return list(dict.fromkeys(cohort_ids))


def _normalize_level_label(level: str) -> str:
    digits = "".join(ch for ch in str(level) if ch.isdigit())
    if not digits:
        raise HTTPException(status_code=400, detail="Invalid level")
    level_num = int(digits)
    if level_num not in [100, 200, 300, 400, 500]:
        raise HTTPException(status_code=400, detail="Invalid level")
    return f"{level_num}L"


async def _get_level_leadership_user_ids(db, session_id: str, level: str) -> set[str]:
    """Return active class rep / assistant user IDs for a level in the active session."""
    role_docs = await db["roles"].find(
        {
            "sessionId": session_id,
            "isActive": True,
            "$or": [
                {"position": f"class_rep_{level}"},
                {"position": f"asst_class_rep_{level}"},
                {
                    "$and": [
                        {"position": {"$regex": "^(class_rep_|asst_class_rep_)"}},
                        {"level": level},
                    ]
                },
            ],
        },
        {"userId": 1},
    ).to_list(None)
    return {str(r.get("userId", "")) for r in role_docs if r.get("userId")}


async def _get_member_level(current_user: dict, session_id: str) -> str:
    """Resolve level for a student-facing cohort view in the active session."""
    db = get_database()
    uid = _user_id(current_user)

    blocked_role = await db["roles"].find_one(
        {
            "userId": uid,
            "sessionId": session_id,
            "isActive": True,
            "$or": [
                {"position": {"$regex": "^class_rep_"}},
                {"position": {"$regex": "^asst_class_rep_"}},
            ],
        },
        {"_id": 1},
    )
    if blocked_role:
        raise HTTPException(
            status_code=403,
            detail="Class reps and assistants cannot access the cohort portal.",
        )

    enrollment = await db["enrollments"].find_one(
        {
            "sessionId": session_id,
            "isActive": True,
            "$or": [
                {"studentId": uid},
                {"userId": uid},
                {"userId": ObjectId(uid)} if ObjectId.is_valid(uid) else {"userId": uid},
            ],
        },
        {"level": 1},
        sort=[("updatedAt", -1), ("createdAt", -1)],
    )
    if enrollment and enrollment.get("level"):
        return _normalize_level_label(str(enrollment.get("level")))

    # Fallback for reps/assistants who may use this route.
    try:
        return await _get_rep_level(current_user)
    except HTTPException:
        pass

    profile_level = current_user.get("currentLevel") or current_user.get("level")
    if profile_level:
        return _normalize_level_label(str(profile_level))

    raise HTTPException(status_code=403, detail="Unable to determine your cohort level")


async def _find_timetable_conflict(
    db,
    *,
    session_id: str,
    level_num: int,
    day: str,
    start_time: str,
    end_time: str,
    exclude_entry_id: Optional[str] = None,
) -> Optional[dict]:
    query: dict = {
        "sessionId": session_id,
        "level": {"$in": [level_num, str(level_num), f"{level_num}L"]},
        "day": day,
    }
    if exclude_entry_id and ObjectId.is_valid(exclude_entry_id):
        query["_id"] = {"$ne": ObjectId(exclude_entry_id)}

    docs = await db["classSessions"].find(query, {
        "courseCode": 1,
        "courseTitle": 1,
        "day": 1,
        "startTime": 1,
        "endTime": 1,
        "venue": 1,
        "type": 1,
    }).to_list(None)

    new_start = _time_to_minutes(start_time)
    new_end = _time_to_minutes(end_time)

    for existing in docs:
        existing_start = str(existing.get("startTime", ""))
        existing_end = str(existing.get("endTime", ""))
        if not existing_start or not existing_end:
            continue

        old_start = _time_to_minutes(existing_start)
        old_end = _time_to_minutes(existing_end)

        if new_start < old_end and new_end > old_start:
            return {
                "id": str(existing.get("_id")),
                "courseCode": existing.get("courseCode", ""),
                "courseTitle": existing.get("courseTitle", ""),
                "day": existing.get("day", ""),
                "startTime": existing_start,
                "endTime": existing_end,
                "venue": existing.get("venue", ""),
                "type": existing.get("type", "lecture"),
            }

    return None


@router.get(
    "/freshers/verify",
    dependencies=[Depends(require_permission("freshers:manage"))],
)
async def verify_freshers_access(
    request: Request,
    current_user: dict = Depends(get_current_user),
):
    """Verify strict freshers-coordinator access and normalized level scope."""
    try:
        await _require_active_freshers_role(current_user)
    except HTTPException as exc:
        if exc.status_code == 403:
            await AuditLogger.log(
                action="freshers.access_denied",
                actor_id=_user_id(current_user),
                actor_email=current_user.get("email", "unknown"),
                resource_type="freshers_portal",
                details={"reason": exc.detail},
                ip_address=request.client.host if request and request.client else None,
                user_agent=request.headers.get("user-agent") if request else None,
            )
        raise

    await AuditLogger.log(
        action="freshers.access_verified",
        actor_id=_user_id(current_user),
        actor_email=current_user.get("email", "unknown"),
        resource_type="freshers_portal",
        details={"level": "100L"},
        ip_address=request.client.host if request and request.client else None,
        user_agent=request.headers.get("user-agent") if request else None,
    )
    return {"ok": True, "level": "100L"}


# ──────────────────────────────────────────────────────────────────
# COHORT DIRECTORY
# ──────────────────────────────────────────────────────────────────

@router.get(
    "/cohort",
    dependencies=[Depends(require_permission("class_rep:view_cohort"))],
)
async def list_cohort(
    search: Optional[str] = Query(None, description="Search by name, email, or matric"),
    current_user: dict = Depends(get_current_user),
):
    """Return all students enrolled at the rep's level in the active session."""
    level = await _get_rep_level(current_user)
    session_id = await _get_active_session_id()
    db = get_database()

    # Get enrollment docs for this level + session
    enrollments = await db["enrollments"].find({
        "sessionId": session_id,
        "level": level,
        "isActive": True,
    }).to_list(None)

    student_ids = []
    for e in enrollments:
        sid = e.get("studentId") or str(e.get("userId", ""))
        if sid:
            student_ids.append(sid)

    if not student_ids:
        return {"level": level, "count": 0, "students": []}

    # Fetch user docs
    oid_list = [ObjectId(s) for s in student_ids if ObjectId.is_valid(s)]
    query: dict = {"_id": {"$in": oid_list}}

    if search:
        regex = {"$regex": search, "$options": "i"}
        query["$or"] = [
            {"firstName": regex},
            {"lastName": regex},
            {"email": regex},
            {"matricNumber": regex},
        ]

    users = await db["users"].find(
        query,
        {
            "passwordHash": 0,
            "firebaseUid": 0,
            "skills": 0,
            "bio": 0,
        },
    ).sort("lastName", 1).to_list(None)

    students = []
    for u in users:
        students.append({
            "id": str(u["_id"]),
            "firstName": u.get("firstName", ""),
            "lastName": u.get("lastName", ""),
            "email": u.get("email", ""),
            "matricNumber": u.get("matricNumber"),
            "phone": u.get("phone"),
            "profilePictureUrl": u.get("profilePictureUrl"),
            "level": level,
        })

    return {"level": level, "count": len(students), "students": students}


@router.get(
    "/cohort/{student_id}",
    dependencies=[Depends(require_permission("class_rep:view_cohort"))],
)
async def get_cohort_student(
    student_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Return detailed profile of a single coursemate in the rep's level cohort."""
    if not ObjectId.is_valid(student_id):
        raise HTTPException(status_code=400, detail="Invalid student ID")

    level = await _get_rep_level(current_user)
    session_id = await _get_active_session_id()
    db = get_database()

    enrollment = await db["enrollments"].find_one({
        "sessionId": session_id,
        "level": level,
        "$or": [
            {"studentId": student_id},
            {"userId": student_id},
            {"userId": ObjectId(student_id)},
        ],
        "isActive": True,
    })
    if not enrollment:
        raise HTTPException(status_code=404, detail="Student not found in your cohort")

    user_doc = await db["users"].find_one(
        {"_id": ObjectId(student_id)},
        {
            "passwordHash": 0,
            "firebaseUid": 0,
        },
    )
    if not user_doc:
        raise HTTPException(status_code=404, detail="Student not found")

    return {
        "id": str(user_doc["_id"]),
        "firstName": user_doc.get("firstName", ""),
        "lastName": user_doc.get("lastName", ""),
        "email": user_doc.get("email", ""),
        "institutionalEmail": user_doc.get("institutionalEmail"),
        "secondaryEmail": user_doc.get("secondaryEmail"),
        "matricNumber": user_doc.get("matricNumber"),
        "phone": user_doc.get("phone"),
        "department": user_doc.get("department"),
        "currentLevel": user_doc.get("currentLevel") or level,
        "admissionYear": user_doc.get("admissionYear"),
        "isExternalStudent": user_doc.get("isExternalStudent", False),
        "role": user_doc.get("role", "student"),
        "bio": user_doc.get("bio"),
        "skills": user_doc.get("skills", []),
        "dateOfBirth": user_doc.get("dateOfBirth"),
        "profilePictureUrl": user_doc.get("profilePictureUrl"),
        "notificationEmailPreference": user_doc.get("notificationEmailPreference"),
        "notificationChannelPreference": user_doc.get("notificationChannelPreference"),
        "createdAt": user_doc.get("createdAt"),
        "updatedAt": user_doc.get("updatedAt"),
        "lastLogin": user_doc.get("lastLogin"),
    }


@router.get(
    "/cohort/export",
    dependencies=[Depends(require_permission("class_rep:export_cohort"))],
)
async def export_cohort_csv(
    current_user: dict = Depends(get_current_user),
):
    """Download the level cohort as a CSV file."""
    level = await _get_rep_level(current_user)
    session_id = await _get_active_session_id()
    db = get_database()

    enrollments = await db["enrollments"].find({
        "sessionId": session_id,
        "level": level,
        "isActive": True,
    }).to_list(None)

    student_ids = [
        e.get("studentId") or str(e.get("userId", ""))
        for e in enrollments
    ]
    oid_list = [ObjectId(s) for s in student_ids if ObjectId.is_valid(s)]

    users = await db["users"].find(
        {"_id": {"$in": oid_list}},
        {"firstName": 1, "lastName": 1, "email": 1, "matricNumber": 1, "phone": 1},
    ).sort("lastName", 1).to_list(None)

    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(["Name", "Email", "Matric Number", "Phone"])
    for u in users:
        writer.writerow([
            f"{u.get('firstName', '')} {u.get('lastName', '')}",
            u.get("email", ""),
            u.get("matricNumber", ""),
            u.get("phone", ""),
        ])

    buf.seek(0)
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={level}_cohort.csv"},
    )


@router.get(
    "/cohort/export/pdf",
    dependencies=[Depends(require_permission("class_rep:export_cohort"))],
)
async def export_cohort_pdf(
    current_user: dict = Depends(get_current_user),
):
    """Download the level cohort as a PDF file."""
    from app.utils.tabular_pdf import generate_tabular_pdf

    level = await _get_rep_level(current_user)
    session_id = await _get_active_session_id()
    db = get_database()

    enrollments = await db["enrollments"].find({
        "sessionId": session_id,
        "level": level,
        "isActive": True,
    }).to_list(None)

    student_ids = [
        e.get("studentId") or str(e.get("userId", ""))
        for e in enrollments
    ]
    oid_list = [ObjectId(s) for s in student_ids if ObjectId.is_valid(s)]

    users = await db["users"].find(
        {"_id": {"$in": oid_list}},
        {"firstName": 1, "lastName": 1, "email": 1, "matricNumber": 1, "phone": 1},
    ).sort("lastName", 1).to_list(None)

    rows = [
        [
            f"{u.get('firstName', '')} {u.get('lastName', '')}".strip(),
            u.get("email", ""),
            u.get("matricNumber", ""),
            u.get("phone", ""),
        ]
        for u in users
    ]

    pdf_buffer = generate_tabular_pdf(
        title=f"{level} Cohort Directory",
        subtitle=f"Generated {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}",
        headers=["Name", "Email", "Matric Number", "Phone"],
        rows=rows,
    )

    return StreamingResponse(
        pdf_buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={level}_cohort.pdf"},
    )


# ──────────────────────────────────────────────────────────────────
# COHORT STATS
# ──────────────────────────────────────────────────────────────────

@router.get(
    "/stats",
    dependencies=[Depends(require_permission("class_rep:view_stats"))],
)
async def cohort_stats(current_user: dict = Depends(get_current_user)):
    """Enrollment count, payment compliance %, etc. for the rep's level."""
    level = await _get_rep_level(current_user)
    session_id = await _get_active_session_id()
    db = get_database()

    # Enrolled students
    enrollments = await db["enrollments"].find({
        "sessionId": session_id,
        "level": level,
        "isActive": True,
    }).to_list(None)
    student_ids = [
        e.get("studentId") or str(e.get("userId", ""))
        for e in enrollments
    ]
    enrolled_count = len(student_ids)

    # Payment compliance — how many of these students are in every paidBy array
    payments = await db["payments"].find(
        {"sessionId": session_id},
        {"paidBy": 1, "title": 1},
    ).to_list(None)

    payment_stats = []
    for p in payments:
        paid_by = set(p.get("paidBy") or [])
        paid_count = sum(1 for sid in student_ids if sid in paid_by)
        payment_stats.append({
            "id": str(p.get("_id")),
            "title": p.get("title", "Unknown"),
            "total": enrolled_count,
            "paid": paid_count,
            "percentage": round(paid_count / enrolled_count * 100, 1) if enrolled_count else 0,
        })

    return {
        "level": level,
        "enrolledCount": enrolled_count,
        "payments": payment_stats,
    }


# ──────────────────────────────────────────────────────────────────
# STUDENT COHORT PORTAL
# ──────────────────────────────────────────────────────────────────

@router.get("/member/overview")
async def member_overview(current_user: dict = Depends(get_current_user)):
    """Student-facing cohort overview (member metrics exclude rep/asst)."""
    session_id = await _get_active_session_id()
    level = await _get_member_level(current_user, session_id)
    db = get_database()

    cohort_ids = await _get_level_cohort_user_ids(db, session_id, level)
    leadership_ids = await _get_level_leadership_user_ids(db, session_id, level)
    eligible_member_ids = [sid for sid in cohort_ids if sid not in leadership_ids]

    deadlines_count = await db["class_rep_deadlines"].count_documents({
        "level": level,
        "sessionId": session_id,
    })
    active_polls_count = await db["class_rep_polls"].count_documents({
        "level": level,
        "sessionId": session_id,
        "isActive": True,
    })
    updates_count = await db["class_rep_relay"].count_documents({
        "level": level,
        "sessionId": session_id,
    })

    return {
        "level": level,
        "totalCohortCount": len(cohort_ids),
        "eligibleMemberCount": len(eligible_member_ids),
        "activeDeadlines": deadlines_count,
        "activePolls": active_polls_count,
        "updates": updates_count,
    }


@router.get("/member/deadlines")
async def list_member_deadlines(current_user: dict = Depends(get_current_user)):
    """Student-facing deadline list for the caller's level cohort."""
    session_id = await _get_active_session_id()
    level = await _get_member_level(current_user, session_id)
    db = get_database()

    docs = await db["class_rep_deadlines"].find({
        "level": level,
        "sessionId": session_id,
    }).sort("dueDate", 1).to_list(None)

    deadlines = []
    for d in docs:
        deadlines.append({
            "id": str(d["_id"]),
            "title": d.get("title", ""),
            "course": d.get("course", ""),
            "description": d.get("description", ""),
            "dueDate": d["dueDate"].isoformat() if d.get("dueDate") else None,
            "createdByName": d.get("createdByName", ""),
            "createdAt": d.get("createdAt", ""),
        })

    return {"level": level, "deadlines": deadlines}


@router.get(
    "/payments/{payment_id}/compliance",
    dependencies=[Depends(require_permission("class_rep:view_stats"))],
)
async def payment_compliance_details(
    payment_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Return paid and unpaid coursemates for a specific payment in the rep's level."""
    if not ObjectId.is_valid(payment_id):
        raise HTTPException(status_code=400, detail="Invalid payment ID")

    level = await _get_rep_level(current_user)
    session_id = await _get_active_session_id()
    db = get_database()

    payment = await db["payments"].find_one(
        {"_id": ObjectId(payment_id), "sessionId": session_id},
        {"title": 1, "amount": 1, "deadline": 1, "paidBy": 1},
    )
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")

    unique_ids = await _get_level_cohort_user_ids(db, session_id, level)
    oid_list = [ObjectId(s) for s in unique_ids if ObjectId.is_valid(s)]
    users = await db["users"].find(
        {"_id": {"$in": oid_list}},
        {
            "firstName": 1,
            "lastName": 1,
            "email": 1,
            "matricNumber": 1,
            "phone": 1,
            "profilePictureUrl": 1,
            "currentLevel": 1,
            "department": 1,
        },
    ).to_list(None)
    users_by_id = {str(u["_id"]): u for u in users}

    paid_by = set(str(uid) for uid in (payment.get("paidBy") or []))

    def _serialize_student(uid: str) -> dict:
        user_doc = users_by_id.get(uid, {})
        return {
            "id": uid,
            "firstName": user_doc.get("firstName", ""),
            "lastName": user_doc.get("lastName", ""),
            "email": user_doc.get("email", ""),
            "matricNumber": user_doc.get("matricNumber"),
            "phone": user_doc.get("phone"),
            "profilePictureUrl": user_doc.get("profilePictureUrl"),
            "currentLevel": user_doc.get("currentLevel") or level,
            "department": user_doc.get("department"),
        }

    paid_students = [_serialize_student(uid) for uid in unique_ids if uid in paid_by]
    unpaid_students = [_serialize_student(uid) for uid in unique_ids if uid not in paid_by]

    paid_students.sort(key=lambda s: (s.get("lastName", ""), s.get("firstName", "")))
    unpaid_students.sort(key=lambda s: (s.get("lastName", ""), s.get("firstName", "")))

    total = len(unique_ids)
    paid_count = len(paid_students)
    percentage = round((paid_count / total) * 100, 1) if total else 0

    return {
        "level": level,
        "payment": {
            "id": str(payment["_id"]),
            "title": payment.get("title", "Unknown"),
            "amount": payment.get("amount"),
            "deadline": payment.get("deadline"),
            "total": total,
            "paid": paid_count,
            "unpaid": len(unpaid_students),
            "percentage": percentage,
        },
        "paidStudents": paid_students,
        "unpaidStudents": unpaid_students,
    }


@router.get(
    "/payments/{payment_id}/unpaid/export",
    dependencies=[Depends(require_permission("class_rep:view_stats"))],
)
async def export_unpaid_payment_csv(
    payment_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Download unpaid students for a specific payment as CSV."""
    if not ObjectId.is_valid(payment_id):
        raise HTTPException(status_code=400, detail="Invalid payment ID")

    level = await _get_rep_level(current_user)
    session_id = await _get_active_session_id()
    db = get_database()

    payment = await db["payments"].find_one(
        {"_id": ObjectId(payment_id), "sessionId": session_id},
        {"title": 1, "paidBy": 1},
    )
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")

    cohort_ids = await _get_level_cohort_user_ids(db, session_id, level)
    paid_by = set(str(uid) for uid in (payment.get("paidBy") or []))
    unpaid_ids = [uid for uid in cohort_ids if uid not in paid_by]

    oid_list = [ObjectId(s) for s in unpaid_ids if ObjectId.is_valid(s)]
    users = await db["users"].find(
        {"_id": {"$in": oid_list}},
        {
            "firstName": 1,
            "lastName": 1,
            "email": 1,
            "matricNumber": 1,
            "phone": 1,
            "currentLevel": 1,
        },
    ).sort("lastName", 1).to_list(None)

    users_by_id = {str(u["_id"]): u for u in users}

    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(["Name", "Email", "Matric Number", "Phone", "Level", "Payment"])

    for uid in unpaid_ids:
        user_doc = users_by_id.get(uid, {})
        writer.writerow([
            f"{user_doc.get('firstName', '')} {user_doc.get('lastName', '')}".strip(),
            user_doc.get("email", ""),
            user_doc.get("matricNumber", ""),
            user_doc.get("phone", ""),
            user_doc.get("currentLevel", level),
            payment.get("title", "Payment"),
        ])

    safe_title = "".join(ch if ch.isalnum() else "_" for ch in str(payment.get("title", "payment"))).strip("_") or "payment"
    filename = f"{level}_{safe_title}_unpaid.csv"

    buf.seek(0)
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


@router.get(
    "/payments/{payment_id}/unpaid/export/pdf",
    dependencies=[Depends(require_permission("class_rep:view_stats"))],
)
async def export_unpaid_payment_pdf(
    payment_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Download unpaid students for a specific payment as PDF."""
    from app.utils.tabular_pdf import generate_tabular_pdf

    if not ObjectId.is_valid(payment_id):
        raise HTTPException(status_code=400, detail="Invalid payment ID")

    level = await _get_rep_level(current_user)
    session_id = await _get_active_session_id()
    db = get_database()

    payment = await db["payments"].find_one(
        {"_id": ObjectId(payment_id), "sessionId": session_id},
        {"title": 1, "paidBy": 1},
    )
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")

    cohort_ids = await _get_level_cohort_user_ids(db, session_id, level)
    paid_by = set(str(uid) for uid in (payment.get("paidBy") or []))
    unpaid_ids = [uid for uid in cohort_ids if uid not in paid_by]

    oid_list = [ObjectId(s) for s in unpaid_ids if ObjectId.is_valid(s)]
    users = await db["users"].find(
        {"_id": {"$in": oid_list}},
        {
            "firstName": 1,
            "lastName": 1,
            "email": 1,
            "matricNumber": 1,
            "phone": 1,
            "currentLevel": 1,
        },
    ).sort("lastName", 1).to_list(None)

    users_by_id = {str(u["_id"]): u for u in users}

    rows = []
    for uid in unpaid_ids:
        user_doc = users_by_id.get(uid, {})
        rows.append([
            f"{user_doc.get('firstName', '')} {user_doc.get('lastName', '')}".strip(),
            user_doc.get("email", ""),
            user_doc.get("matricNumber", ""),
            user_doc.get("phone", ""),
            user_doc.get("currentLevel", level),
            payment.get("title", "Payment"),
        ])

    safe_title = "".join(ch if ch.isalnum() else "_" for ch in str(payment.get("title", "payment"))).strip("_") or "payment"
    filename = f"{level}_{safe_title}_unpaid.pdf"

    pdf_buffer = generate_tabular_pdf(
        title=f"Unpaid Students · {payment.get('title', 'Payment')}",
        subtitle=f"Level {level} · Generated {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}",
        headers=["Name", "Email", "Matric Number", "Phone", "Level", "Payment"],
        rows=rows,
    )

    return StreamingResponse(
        pdf_buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


@router.post(
    "/payments/{payment_id}/remind-unpaid",
    dependencies=[Depends(require_permission("class_rep:view_stats"))],
)
async def remind_unpaid_payment_students(
    payment_id: str,
    body: dict,
    current_user: dict = Depends(get_current_user),
):
    """Send reminders to unpaid students in the rep's cohort (in-app + optional email)."""
    if not ObjectId.is_valid(payment_id):
        raise HTTPException(status_code=400, detail="Invalid payment ID")

    channel = str(body.get("channel") or "both").strip().lower()
    if channel not in {"in_app", "email", "both"}:
        raise HTTPException(status_code=400, detail="channel must be one of: in_app, email, both")

    custom_message = str(body.get("message") or "").strip()

    level = await _get_rep_level(current_user)
    session_id = await _get_active_session_id()
    db = get_database()

    payment = await db["payments"].find_one(
        {"_id": ObjectId(payment_id), "sessionId": session_id},
        {"title": 1, "amount": 1, "deadline": 1, "paidBy": 1},
    )
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")

    cohort_ids = await _get_level_cohort_user_ids(db, session_id, level)
    paid_by = set(str(uid) for uid in (payment.get("paidBy") or []))
    unpaid_ids = [uid for uid in cohort_ids if uid not in paid_by]

    if not unpaid_ids:
        return {
            "message": "All students have paid this due",
            "paymentId": payment_id,
            "paymentTitle": payment.get("title", "Payment"),
            "level": level,
            "totalUnpaid": 0,
            "inAppQueued": 0,
            "emailQueued": 0,
            "channel": channel,
        }

    amount = payment.get("amount")
    deadline = payment.get("deadline")
    amount_str = f" (₦{amount:,.0f})" if isinstance(amount, (int, float)) else ""
    deadline_str = ""
    if isinstance(deadline, datetime):
        deadline_str = f" Deadline: {deadline.strftime('%d %b %Y')}."

    default_message = (
        f"Reminder: '{payment.get('title', 'Payment')}'{amount_str} is still unpaid."
        f" Please complete payment via your dashboard.{deadline_str}"
    )
    message = custom_message or default_message

    in_app_queued = 0
    email_queued = 0

    if channel in {"in_app", "both"}:
        from app.routers.notifications import create_bulk_notifications
        await create_bulk_notifications(
            user_ids=unpaid_ids,
            type="payment",
            title=f"Payment Reminder: {payment.get('title', 'Payment')}",
            message=message,
            link="/dashboard/payments",
            related_id=payment_id,
            category="payments",
        )
        in_app_queued = len(unpaid_ids)

    if channel in {"email", "both"}:
        from app.core.email import get_email_service
        from app.core.notification_utils import get_notification_emails, should_notify_category, should_send_email

        user_docs = await db["users"].find(
            {"_id": {"$in": [ObjectId(uid) for uid in unpaid_ids if ObjectId.is_valid(uid)]}},
            {
                "firstName": 1,
                "lastName": 1,
                "email": 1,
                "secondaryEmail": 1,
                "secondaryEmailVerified": 1,
                "notificationEmailPreference": 1,
                "notificationChannelPreference": 1,
                "notificationCategories": 1,
            },
        ).to_list(None)

        service = get_email_service()
        send_jobs = []

        for user_doc in user_docs:
            if not should_send_email(user_doc):
                continue
            if not should_notify_category(user_doc, "payments"):
                continue

            display_name = f"{user_doc.get('firstName', '')} {user_doc.get('lastName', '')}".strip() or "Student"
            recipient_emails = list(dict.fromkeys(get_notification_emails(user_doc)))
            if not recipient_emails:
                continue

            subject = f"IESA Payment Reminder — {payment.get('title', 'Payment')}"
            html = f"""
            <html>
              <body style=\"margin:0;padding:24px;background:#FAFAFE;font-family:Inter,Arial,sans-serif;color:#0F0F2D;\">
                <div style=\"max-width:620px;margin:0 auto;background:#FFFFFF;border:3px solid #0F0F2D;border-radius:18px;overflow:hidden;box-shadow:6px 6px 0 #000;\">
                  <div style=\"background:#C8F31D;padding:16px 20px;border-bottom:3px solid #0F0F2D;\">
                    <p style=\"margin:0;font-size:11px;letter-spacing:.08em;text-transform:uppercase;font-weight:900;color:#0F0F2D;\">Payment Reminder</p>
                  </div>
                  <div style=\"padding:22px 20px;\">
                    <p style=\"margin:0 0 10px;font-size:14px;line-height:1.7;color:#334155;\">Hi {display_name},</p>
                    <p style=\"margin:0 0 10px;font-size:14px;line-height:1.7;color:#334155;\">{message}</p>
                    <p style=\"margin:0 0 14px;font-size:13px;line-height:1.7;color:#64748B;\">Open your dashboard to complete payment and avoid deadline issues.</p>
                    <a href=\"https://iesa-ui.vercel.app/dashboard/payments\" style=\"display:inline-block;background:#0F0F2D;color:#FFFFFF;font-size:13px;font-weight:800;text-decoration:none;padding:10px 14px;border:3px solid #0F0F2D;border-radius:10px;\">Open Payments</a>
                  </div>
                </div>
              </body>
            </html>
            """

            for recipient in recipient_emails:
                email_queued += 1
                send_jobs.append(service.send_email(to=recipient, subject=subject, html_content=html))

        if send_jobs:
            async def _send_all_emails():
                await asyncio.gather(*send_jobs, return_exceptions=True)

            asyncio.create_task(_send_all_emails())

    return {
        "message": "Reminder dispatch queued",
        "paymentId": payment_id,
        "paymentTitle": payment.get("title", "Payment"),
        "level": level,
        "totalUnpaid": len(unpaid_ids),
        "inAppQueued": in_app_queued,
        "emailQueued": email_queued,
        "channel": channel,
    }


# ──────────────────────────────────────────────────────────────────
# DEADLINE BOARD
# ──────────────────────────────────────────────────────────────────

@router.get(
    "/deadlines",
    dependencies=[Depends(require_permission("class_rep:view_cohort"))],
)
async def list_deadlines(current_user: dict = Depends(get_current_user)):
    """List all deadline entries for the rep's level."""
    level = await _get_rep_level(current_user)
    session_id = await _get_active_session_id()
    db = get_database()

    docs = await db["class_rep_deadlines"].find({
        "level": level,
        "sessionId": session_id,
    }).sort("dueDate", 1).to_list(None)

    deadlines = []
    for d in docs:
        deadlines.append({
            "id": str(d["_id"]),
            "title": d["title"],
            "course": d.get("course", ""),
            "description": d.get("description", ""),
            "dueDate": d["dueDate"].isoformat() if d.get("dueDate") else None,
            "createdBy": d.get("createdBy", ""),
            "createdByName": d.get("createdByName", ""),
            "createdAt": d.get("createdAt", ""),
        })
    return {"level": level, "deadlines": deadlines}


@router.post(
    "/deadlines",
    dependencies=[Depends(require_permission("class_rep:manage_deadlines"))],
)
async def create_deadline(
    body: dict,
    current_user: dict = Depends(get_current_user),
):
    """Create a deadline entry for the rep's level."""
    level = await _get_rep_level(current_user)
    session_id = await _get_active_session_id()
    db = get_database()

    title = (body.get("title") or "").strip()
    if not title:
        raise HTTPException(status_code=400, detail="Title is required")

    due_date_raw = body.get("dueDate")
    due_date = None
    if due_date_raw:
        try:
            due_date = datetime.fromisoformat(due_date_raw.replace("Z", "+00:00"))
        except (ValueError, AttributeError):
            raise HTTPException(status_code=400, detail="Invalid dueDate format")

    now = datetime.now(timezone.utc)
    uid = _user_id(current_user)
    doc = {
        "level": level,
        "sessionId": session_id,
        "title": title,
        "course": (body.get("course") or "").strip(),
        "description": (body.get("description") or "").strip(),
        "dueDate": due_date,
        "createdBy": uid,
        "createdByName": f"{current_user.get('firstName', '')} {current_user.get('lastName', '')}".strip(),
        "createdAt": now,
        "updatedAt": now,
    }
    result = await db["class_rep_deadlines"].insert_one(doc)
    doc["id"] = str(result.inserted_id)
    doc.pop("_id", None)

    # Notify cohort students about the new deadline (fire-and-forget)
    import asyncio

    async def _notify_cohort():
        try:
            enrollments = await db["enrollments"].find(
                {"sessionId": session_id, "level": level, "isActive": True},
                {"studentId": 1, "userId": 1},
            ).to_list(None)
            student_ids = []
            for e in enrollments:
                sid = e.get("studentId") or str(e.get("userId", ""))
                if sid and sid != uid:  # Don't notify the creator
                    student_ids.append(sid)
            if student_ids:
                from app.routers.notifications import create_bulk_notifications
                due_str = f" (due {due_date.strftime('%d %b %Y')})" if due_date else ""
                course_str = f" [{doc['course']}]" if doc.get("course") else ""
                await create_bulk_notifications(
                    user_ids=student_ids,
                    type="deadline_created",
                    title="New Deadline",
                    message=f"{title}{course_str}{due_str}",
                    link="/dashboard/announcements",
                    category="academic",
                )
        except Exception:
            pass  # Non-critical

    asyncio.create_task(_notify_cohort())

    return doc


@router.put(
    "/deadlines/{deadline_id}",
    dependencies=[Depends(require_permission("class_rep:manage_deadlines"))],
)
async def update_deadline(
    deadline_id: str,
    body: dict,
    current_user: dict = Depends(get_current_user),
):
    """Update a deadline entry."""
    if not ObjectId.is_valid(deadline_id):
        raise HTTPException(status_code=400, detail="Invalid deadline ID")
    db = get_database()

    update: dict = {"updatedAt": datetime.now(timezone.utc)}
    for field in ("title", "course", "description"):
        if field in body:
            update[field] = (body[field] or "").strip()
    if "dueDate" in body:
        raw = body["dueDate"]
        try:
            update["dueDate"] = datetime.fromisoformat(raw.replace("Z", "+00:00")) if raw else None
        except (ValueError, AttributeError):
            raise HTTPException(status_code=400, detail="Invalid dueDate format")

    result = await db["class_rep_deadlines"].update_one(
        {"_id": ObjectId(deadline_id)},
        {"$set": update},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Deadline not found")
    return {"message": "Deadline updated"}


@router.delete(
    "/deadlines/{deadline_id}",
    dependencies=[Depends(require_permission("class_rep:manage_deadlines"))],
)
async def delete_deadline(deadline_id: str):
    if not ObjectId.is_valid(deadline_id):
        raise HTTPException(status_code=400, detail="Invalid deadline ID")
    db = get_database()
    result = await db["class_rep_deadlines"].delete_one({"_id": ObjectId(deadline_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Deadline not found")
    return {"message": "Deadline deleted"}


# ──────────────────────────────────────────────────────────────────
# QUICK POLLS
# ──────────────────────────────────────────────────────────────────

@router.get(
    "/polls",
    dependencies=[Depends(require_permission("class_rep:view_cohort"))],
)
async def list_polls(current_user: dict = Depends(get_current_user)):
    """List all polls for the rep's level."""
    level = await _get_rep_level(current_user)
    session_id = await _get_active_session_id()
    db = get_database()

    docs = await db["class_rep_polls"].find({
        "level": level,
        "sessionId": session_id,
    }).sort("createdAt", -1).to_list(None)

    uid = _user_id(current_user)
    leadership_ids = await _get_level_leadership_user_ids(db, session_id, level)
    cohort_ids = await _get_level_cohort_user_ids(db, session_id, level)
    eligible_member_ids = {sid for sid in cohort_ids if sid not in leadership_ids}
    polls = []
    for d in docs:
        votes = d.get("votes") or {}  # {optionIndex: [userId, ...]}
        total_votes = sum(len(v) for v in votes.values())
        member_voters: set[str] = set()
        user_vote = None
        for opt_idx, voter_ids in votes.items():
            if uid in voter_ids:
                user_vote = int(opt_idx)
                break
            member_voters.update(str(voter_id) for voter_id in voter_ids if str(voter_id) in eligible_member_ids)

        # If the caller voted and belongs to eligible members but the vote was found before set update,
        # ensure they are still counted.
        for voter_ids in votes.values():
            member_voters.update(str(voter_id) for voter_id in voter_ids if str(voter_id) in eligible_member_ids)

        eligible_count = len(eligible_member_ids)
        member_vote_count = len(member_voters)
        turnout_percentage = round((member_vote_count / eligible_count) * 100, 1) if eligible_count else 0.0

        options_out = []
        for i, opt in enumerate(d.get("options", [])):
            options_out.append({
                "text": opt,
                "voteCount": len(votes.get(str(i), [])),
            })

        polls.append({
            "id": str(d["_id"]),
            "question": d["question"],
            "options": options_out,
            "totalVotes": total_votes,
            "eligibleMembers": eligible_count,
            "memberVotes": member_vote_count,
            "turnoutPercentage": turnout_percentage,
            "userVote": user_vote,
            "isActive": d.get("isActive", True),
            "createdBy": d.get("createdBy", ""),
            "createdByName": d.get("createdByName", ""),
            "createdAt": d.get("createdAt", ""),
        })
    return {"level": level, "polls": polls}


@router.get("/member/polls")
async def list_member_polls(current_user: dict = Depends(get_current_user)):
    """Student-facing poll list with member-only turnout metrics."""
    session_id = await _get_active_session_id()
    level = await _get_member_level(current_user, session_id)
    db = get_database()

    docs = await db["class_rep_polls"].find({
        "level": level,
        "sessionId": session_id,
    }).sort("createdAt", -1).to_list(None)

    uid = _user_id(current_user)
    leadership_ids = await _get_level_leadership_user_ids(db, session_id, level)
    cohort_ids = await _get_level_cohort_user_ids(db, session_id, level)
    eligible_member_ids = {sid for sid in cohort_ids if sid not in leadership_ids}

    polls = []
    for d in docs:
        votes = d.get("votes") or {}
        total_votes = sum(len(v) for v in votes.values())
        user_vote = None
        member_voters: set[str] = set()

        for opt_idx, voter_ids in votes.items():
            if uid in voter_ids:
                user_vote = int(opt_idx)
            member_voters.update(str(voter_id) for voter_id in voter_ids if str(voter_id) in eligible_member_ids)

        eligible_count = len(eligible_member_ids)
        member_vote_count = len(member_voters)
        turnout_percentage = round((member_vote_count / eligible_count) * 100, 1) if eligible_count else 0.0

        options_out = []
        for i, opt in enumerate(d.get("options", [])):
            options_out.append({
                "text": opt,
                "voteCount": len(votes.get(str(i), [])),
            })

        polls.append({
            "id": str(d["_id"]),
            "question": d.get("question", ""),
            "options": options_out,
            "totalVotes": total_votes,
            "eligibleMembers": eligible_count,
            "memberVotes": member_vote_count,
            "turnoutPercentage": turnout_percentage,
            "userVote": user_vote,
            "isActive": d.get("isActive", True),
            "createdByName": d.get("createdByName", ""),
            "createdAt": d.get("createdAt", ""),
        })

    return {"level": level, "polls": polls}


@router.post("/member/polls/{poll_id}/vote")
async def vote_on_member_poll(
    poll_id: str,
    body: dict,
    current_user: dict = Depends(get_current_user),
):
    """Vote on a cohort poll from the student-facing cohort portal."""
    if not ObjectId.is_valid(poll_id):
        raise HTTPException(status_code=400, detail="Invalid poll ID")

    option_index = body.get("optionIndex")
    if option_index is None:
        raise HTTPException(status_code=400, detail="optionIndex is required")

    session_id = await _get_active_session_id()
    level = await _get_member_level(current_user, session_id)
    db = get_database()

    poll = await db["class_rep_polls"].find_one(
        {"_id": ObjectId(poll_id), "sessionId": session_id, "level": level}
    )
    if not poll:
        raise HTTPException(status_code=404, detail="Poll not found")
    if not poll.get("isActive", True):
        raise HTTPException(status_code=400, detail="Poll is closed")
    if int(option_index) < 0 or int(option_index) >= len(poll.get("options", [])):
        raise HTTPException(status_code=400, detail="Invalid option index")

    uid = _user_id(current_user)
    cohort_ids = await _get_level_cohort_user_ids(db, session_id, level)
    if uid not in set(cohort_ids):
        raise HTTPException(status_code=403, detail="You are not in this cohort")

    votes = poll.get("votes") or {}
    for idx_key, voter_list in votes.items():
        if uid in voter_list:
            await db["class_rep_polls"].update_one(
                {"_id": ObjectId(poll_id)},
                {"$pull": {f"votes.{idx_key}": uid}},
            )

    await db["class_rep_polls"].update_one(
        {"_id": ObjectId(poll_id)},
        {"$addToSet": {f"votes.{option_index}": uid}},
    )
    return {"message": "Vote recorded"}


@router.post(
    "/polls",
    dependencies=[Depends(require_permission("class_rep:manage_polls"))],
)
async def create_poll(
    body: dict,
    current_user: dict = Depends(get_current_user),
):
    """Create a quick poll for the rep's level."""
    level = await _get_rep_level(current_user)
    session_id = await _get_active_session_id()
    db = get_database()

    question = (body.get("question") or "").strip()
    options = body.get("options", [])
    if not question:
        raise HTTPException(status_code=400, detail="Question is required")
    if len(options) < 2:
        raise HTTPException(status_code=400, detail="At least 2 options required")
    if len(options) > 6:
        raise HTTPException(status_code=400, detail="Maximum 6 options allowed")

    now = datetime.now(timezone.utc)
    uid = _user_id(current_user)
    doc = {
        "level": level,
        "sessionId": session_id,
        "question": question,
        "options": [str(o).strip() for o in options],
        "votes": {},  # {optionIndex: [userId, ...]}
        "isActive": True,
        "createdBy": uid,
        "createdByName": f"{current_user.get('firstName', '')} {current_user.get('lastName', '')}".strip(),
        "createdAt": now,
        "updatedAt": now,
    }
    result = await db["class_rep_polls"].insert_one(doc)
    doc["id"] = str(result.inserted_id)
    doc.pop("_id", None)
    return doc


@router.post(
    "/polls/{poll_id}/vote",
    dependencies=[Depends(require_permission("class_rep:view_cohort"))],
)
async def vote_on_poll(
    poll_id: str,
    body: dict,
    current_user: dict = Depends(get_current_user),
):
    """Vote on a poll. Any student at the level (+ the rep) can vote."""
    if not ObjectId.is_valid(poll_id):
        raise HTTPException(status_code=400, detail="Invalid poll ID")

    option_index = body.get("optionIndex")
    if option_index is None:
        raise HTTPException(status_code=400, detail="optionIndex is required")

    db = get_database()
    poll = await db["class_rep_polls"].find_one({"_id": ObjectId(poll_id)})
    if not poll:
        raise HTTPException(status_code=404, detail="Poll not found")
    if not poll.get("isActive", True):
        raise HTTPException(status_code=400, detail="Poll is closed")
    if int(option_index) < 0 or int(option_index) >= len(poll.get("options", [])):
        raise HTTPException(status_code=400, detail="Invalid option index")

    uid = _user_id(current_user)

    # Remove any existing vote by this user
    votes = poll.get("votes") or {}
    for idx_key, voter_list in votes.items():
        if uid in voter_list:
            await db["class_rep_polls"].update_one(
                {"_id": ObjectId(poll_id)},
                {"$pull": {f"votes.{idx_key}": uid}},
            )

    # Add new vote
    await db["class_rep_polls"].update_one(
        {"_id": ObjectId(poll_id)},
        {"$addToSet": {f"votes.{option_index}": uid}},
    )
    return {"message": "Vote recorded"}


@router.patch(
    "/polls/{poll_id}/close",
    dependencies=[Depends(require_permission("class_rep:manage_polls"))],
)
async def close_poll(poll_id: str):
    """Close a poll so no more votes can be cast."""
    if not ObjectId.is_valid(poll_id):
        raise HTTPException(status_code=400, detail="Invalid poll ID")
    db = get_database()
    result = await db["class_rep_polls"].update_one(
        {"_id": ObjectId(poll_id)},
        {"$set": {"isActive": False, "updatedAt": datetime.now(timezone.utc)}},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Poll not found")
    return {"message": "Poll closed"}


@router.delete(
    "/polls/{poll_id}",
    dependencies=[Depends(require_permission("class_rep:manage_polls"))],
)
async def delete_poll(poll_id: str):
    if not ObjectId.is_valid(poll_id):
        raise HTTPException(status_code=400, detail="Invalid poll ID")
    db = get_database()
    result = await db["class_rep_polls"].delete_one({"_id": ObjectId(poll_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Poll not found")
    return {"message": "Poll deleted"}


# ──────────────────────────────────────────────────────────────────
# LECTURER RELAY BOARD
# ──────────────────────────────────────────────────────────────────

@router.get(
    "/relay",
    dependencies=[Depends(require_permission("class_rep:view_cohort"))],
)
async def list_relay_posts(current_user: dict = Depends(get_current_user)):
    """List relay board posts for the rep's level (pinned first)."""
    level = await _get_rep_level(current_user)
    session_id = await _get_active_session_id()
    db = get_database()

    docs = await db["class_rep_relay"].find({
        "level": level,
        "sessionId": session_id,
    }).sort([("isPinned", -1), ("createdAt", -1)]).to_list(None)

    posts = []
    for d in docs:
        posts.append({
            "id": str(d["_id"]),
            "title": d.get("title", ""),
            "content": d.get("content", ""),
            "course": d.get("course", ""),
            "lecturerName": d.get("lecturerName", ""),
            "attachmentUrl": d.get("attachmentUrl"),
            "isPinned": d.get("isPinned", False),
            "createdBy": d.get("createdBy", ""),
            "createdByName": d.get("createdByName", ""),
            "createdAt": d.get("createdAt", ""),
        })
    return {"level": level, "posts": posts}


@router.get("/member/updates")
async def list_member_updates(current_user: dict = Depends(get_current_user)):
    """Student-facing class updates feed for the caller's cohort."""
    session_id = await _get_active_session_id()
    level = await _get_member_level(current_user, session_id)
    db = get_database()

    docs = await db["class_rep_relay"].find({
        "level": level,
        "sessionId": session_id,
    }).sort([("isPinned", -1), ("createdAt", -1)]).to_list(None)

    posts = []
    for d in docs:
        posts.append({
            "id": str(d["_id"]),
            "title": d.get("title", ""),
            "content": d.get("content", ""),
            "course": d.get("course", ""),
            "lecturerName": d.get("lecturerName", ""),
            "attachmentUrl": d.get("attachmentUrl"),
            "isPinned": d.get("isPinned", False),
            "createdByName": d.get("createdByName", ""),
            "createdAt": d.get("createdAt", ""),
        })

    return {"level": level, "updates": posts}


@router.post(
    "/relay",
    dependencies=[Depends(require_permission("class_rep:manage_relay"))],
)
async def create_relay_post(
    body: dict,
    current_user: dict = Depends(get_current_user),
):
    """Create a lecturer relay post."""
    level = await _get_rep_level(current_user)
    session_id = await _get_active_session_id()
    db = get_database()

    title = (body.get("title") or "").strip()
    content = (body.get("content") or "").strip()
    if not title or not content:
        raise HTTPException(status_code=400, detail="Title and content are required")

    now = datetime.now(timezone.utc)
    uid = _user_id(current_user)
    doc = {
        "level": level,
        "sessionId": session_id,
        "title": title,
        "content": content,
        "course": (body.get("course") or "").strip(),
        "lecturerName": (body.get("lecturerName") or "").strip(),
        "attachmentUrl": body.get("attachmentUrl"),
        "isPinned": False,
        "createdBy": uid,
        "createdByName": f"{current_user.get('firstName', '')} {current_user.get('lastName', '')}".strip(),
        "createdAt": now,
        "updatedAt": now,
    }
    result = await db["class_rep_relay"].insert_one(doc)
    doc["id"] = str(result.inserted_id)
    doc.pop("_id", None)
    return doc


@router.put(
    "/relay/{post_id}",
    dependencies=[Depends(require_permission("class_rep:manage_relay"))],
)
async def update_relay_post(post_id: str, body: dict):
    """Update a relay post."""
    if not ObjectId.is_valid(post_id):
        raise HTTPException(status_code=400, detail="Invalid post ID")
    db = get_database()

    update: dict = {"updatedAt": datetime.now(timezone.utc)}
    for field in ("title", "content", "course", "lecturerName", "attachmentUrl"):
        if field in body:
            val = body[field]
            update[field] = val.strip() if isinstance(val, str) else val

    result = await db["class_rep_relay"].update_one(
        {"_id": ObjectId(post_id)},
        {"$set": update},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Post not found")
    return {"message": "Post updated"}


@router.patch(
    "/relay/{post_id}/pin",
    dependencies=[Depends(require_permission("class_rep:pin_relay"))],
)
async def toggle_pin_relay(post_id: str, body: dict):
    """Pin or unpin a relay post."""
    if not ObjectId.is_valid(post_id):
        raise HTTPException(status_code=400, detail="Invalid post ID")
    db = get_database()

    pinned = bool(body.get("isPinned", True))
    result = await db["class_rep_relay"].update_one(
        {"_id": ObjectId(post_id)},
        {"$set": {"isPinned": pinned, "updatedAt": datetime.now(timezone.utc)}},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Post not found")
    return {"message": f"Post {'pinned' if pinned else 'unpinned'}"}


@router.delete(
    "/relay/{post_id}",
    dependencies=[Depends(require_permission("class_rep:manage_relay"))],
)
async def delete_relay_post(post_id: str):
    if not ObjectId.is_valid(post_id):
        raise HTTPException(status_code=400, detail="Invalid post ID")
    db = get_database()
    result = await db["class_rep_relay"].delete_one({"_id": ObjectId(post_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Post not found")
    return {"message": "Post deleted"}


# ──────────────────────────────────────────────────────────────────
# LEVEL-TARGETED ANNOUNCEMENTS
# ──────────────────────────────────────────────────────────────────

@router.post(
    "/announcements",
    dependencies=[Depends(require_permission("announcement:create"))],
)
async def create_level_announcement(
    body: dict,
    current_user: dict = Depends(get_current_user),
):
    """
    Create an announcement automatically scoped to the rep's level.
    Uses the existing announcements collection + notification pipeline.
    """
    level = await _get_rep_level(current_user)
    session_id = await _get_active_session_id()
    db = get_database()

    title = (body.get("title") or "").strip()
    content = (body.get("content") or "").strip()
    if not title or not content:
        raise HTTPException(status_code=400, detail="Title and content are required")

    now = datetime.now(timezone.utc)
    uid = _user_id(current_user)
    doc = {
        "title": title,
        "content": content,
        "targetAudience": "specific_levels",
        "targetLevels": [level],
        "priority": body.get("priority", "normal"),
        "isPinned": False,
        "sessionId": session_id,
        "authorId": uid,
        "authorName": f"{current_user.get('firstName', '')} {current_user.get('lastName', '')}".strip(),
        "createdAt": now,
        "updatedAt": now,
    }
    result = await db["announcements"].insert_one(doc)
    doc["id"] = str(result.inserted_id)
    doc.pop("_id", None)

    # Fire notifications to the target level
    try:
        from app.routers.announcements import _fire_announcement_notifications
        ann_doc = await db["announcements"].find_one({"_id": result.inserted_id})
        if ann_doc:
            await _fire_announcement_notifications(ann_doc, db)
    except Exception:
        pass  # Non-critical — don't fail the announcement

    return doc


# ──────────────────────────────────────────────────────────────────
# TIMETABLE (level-filtered + class-rep CRUD)
# ──────────────────────────────────────────────────────────────────

@router.get(
    "/timetable",
    dependencies=[Depends(require_permission("timetable:view"))],
)
async def level_timetable(current_user: dict = Depends(get_current_user)):
    """Return timetable entries filtered to the rep's level."""
    level = await _get_rep_level(current_user)
    level_num = _level_to_int(level)
    session_id = await _get_active_session_id()
    db = get_database()

    # classSessions filtered by level
    docs = await db["classSessions"].find({
        "sessionId": session_id,
        "level": {"$in": [level_num, level, str(level_num), f"{level_num}L"]},
    }).sort([("day", 1), ("startTime", 1)]).to_list(None)

    entries = []
    for d in docs:
        entries.append({
            "id": str(d["_id"]),
            "courseCode": d.get("courseCode", ""),
            "courseTitle": d.get("courseTitle", ""),
            "lecturer": d.get("lecturer", ""),
            "dayOfWeek": d.get("day", d.get("dayOfWeek", "")),
            "startTime": d.get("startTime", ""),
            "endTime": d.get("endTime", ""),
            "venue": d.get("venue", ""),
            "type": d.get("type", "lecture"),
            "recurring": d.get("recurring", True),
        })
    return {"level": level, "timetable": entries}


@router.post(
    "/timetable",
    dependencies=[Depends(require_permission("class_rep:manage_timetable"))],
)
async def create_level_timetable_entry(
    body: dict,
    current_user: dict = Depends(get_current_user),
):
    """Create a timetable entry scoped to the rep's own level and active session."""
    level = await _get_rep_level(current_user)
    level_num = _level_to_int(level)
    session_id = await _get_active_session_id()
    db = get_database()

    course_code = str(body.get("courseCode") or "").strip().upper()
    course_title = str(body.get("courseTitle") or "").strip()
    day = _validate_day(str(body.get("day") or ""))
    start_time = _validate_time(str(body.get("startTime") or ""))
    end_time = _validate_time(str(body.get("endTime") or ""))
    venue = str(body.get("venue") or "").strip()
    lecturer = str(body.get("lecturer") or "").strip()
    class_type = str(body.get("type") or "lecture").strip().lower()
    recurring = bool(body.get("recurring", True))

    if not course_code or not course_title:
        raise HTTPException(status_code=400, detail="courseCode and courseTitle are required")
    if class_type not in ["lecture", "practical", "tutorial"]:
        raise HTTPException(status_code=400, detail="type must be: lecture, practical, or tutorial")
    if _time_to_minutes(start_time) >= _time_to_minutes(end_time):
        raise HTTPException(status_code=400, detail="startTime must be earlier than endTime")

    conflict = await _find_timetable_conflict(
        db,
        session_id=session_id,
        level_num=level_num,
        day=day,
        start_time=start_time,
        end_time=end_time,
    )
    if conflict:
        raise HTTPException(
            status_code=409,
            detail=(
                f"Time conflict with {conflict.get('courseCode') or 'existing class'} "
                f"({conflict.get('startTime')}–{conflict.get('endTime')} on {conflict.get('day')})"
            ),
        )

    now = datetime.now(timezone.utc)
    doc = {
        "sessionId": session_id,
        "courseCode": course_code,
        "courseTitle": course_title,
        "level": level_num,
        "day": day,
        "startTime": start_time,
        "endTime": end_time,
        "venue": venue,
        "lecturer": lecturer,
        "type": class_type,
        "recurring": recurring,
        "createdBy": _user_id(current_user),
        "createdAt": now,
        "updatedAt": now,
    }
    result = await db["classSessions"].insert_one(doc)
    return {
        "id": str(result.inserted_id),
        "courseCode": doc["courseCode"],
        "courseTitle": doc["courseTitle"],
        "lecturer": doc.get("lecturer", ""),
        "dayOfWeek": doc["day"],
        "startTime": doc["startTime"],
        "endTime": doc["endTime"],
        "venue": doc.get("venue", ""),
        "type": doc["type"],
        "recurring": doc.get("recurring", True),
    }


@router.patch(
    "/timetable/{entry_id}",
    dependencies=[Depends(require_permission("class_rep:manage_timetable"))],
)
async def update_level_timetable_entry(
    entry_id: str,
    body: dict,
    current_user: dict = Depends(get_current_user),
):
    """Update a timetable entry, constrained to rep's own level/session records."""
    if not ObjectId.is_valid(entry_id):
        raise HTTPException(status_code=400, detail="Invalid timetable entry ID")

    level = await _get_rep_level(current_user)
    level_num = _level_to_int(level)
    session_id = await _get_active_session_id()
    db = get_database()

    update: dict = {"updatedAt": datetime.now(timezone.utc)}
    if "courseCode" in body:
        update["courseCode"] = str(body.get("courseCode") or "").strip().upper()
    if "courseTitle" in body:
        update["courseTitle"] = str(body.get("courseTitle") or "").strip()
    if "day" in body:
        update["day"] = _validate_day(str(body.get("day") or ""))
    if "startTime" in body:
        update["startTime"] = _validate_time(str(body.get("startTime") or ""))
    if "endTime" in body:
        update["endTime"] = _validate_time(str(body.get("endTime") or ""))
    if "venue" in body:
        update["venue"] = str(body.get("venue") or "").strip()
    if "lecturer" in body:
        update["lecturer"] = str(body.get("lecturer") or "").strip()
    if "type" in body:
        class_type = str(body.get("type") or "").strip().lower()
        if class_type not in ["lecture", "practical", "tutorial"]:
            raise HTTPException(status_code=400, detail="type must be: lecture, practical, or tutorial")
        update["type"] = class_type
    if "recurring" in body:
        update["recurring"] = bool(body.get("recurring"))

    if len(update.keys()) == 1:
        raise HTTPException(status_code=400, detail="No fields to update")

    existing = await db["classSessions"].find_one(
        {
            "_id": ObjectId(entry_id),
            "sessionId": session_id,
            "level": {"$in": [level_num, str(level_num), f"{level_num}L"]},
        },
        {"day": 1, "startTime": 1, "endTime": 1},
    )
    if not existing:
        raise HTTPException(status_code=404, detail="Timetable entry not found")

    candidate_day = update.get("day", existing.get("day", ""))
    candidate_start = update.get("startTime", existing.get("startTime", ""))
    candidate_end = update.get("endTime", existing.get("endTime", ""))
    if _time_to_minutes(candidate_start) >= _time_to_minutes(candidate_end):
        raise HTTPException(status_code=400, detail="startTime must be earlier than endTime")

    conflict = await _find_timetable_conflict(
        db,
        session_id=session_id,
        level_num=level_num,
        day=candidate_day,
        start_time=candidate_start,
        end_time=candidate_end,
        exclude_entry_id=entry_id,
    )
    if conflict:
        raise HTTPException(
            status_code=409,
            detail=(
                f"Time conflict with {conflict.get('courseCode') or 'existing class'} "
                f"({conflict.get('startTime')}–{conflict.get('endTime')} on {conflict.get('day')})"
            ),
        )

    result = await db["classSessions"].update_one(
        {
            "_id": ObjectId(entry_id),
            "sessionId": session_id,
            "level": {"$in": [level_num, str(level_num), f"{level_num}L"]},
        },
        {"$set": update},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Timetable entry not found")
    return {"message": "Timetable entry updated"}


@router.delete(
    "/timetable/{entry_id}",
    dependencies=[Depends(require_permission("class_rep:manage_timetable"))],
)
async def delete_level_timetable_entry(
    entry_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Delete a timetable entry, constrained to rep's own level/session records."""
    if not ObjectId.is_valid(entry_id):
        raise HTTPException(status_code=400, detail="Invalid timetable entry ID")

    level = await _get_rep_level(current_user)
    level_num = _level_to_int(level)
    session_id = await _get_active_session_id()
    db = get_database()

    result = await db["classSessions"].delete_one(
        {
            "_id": ObjectId(entry_id),
            "sessionId": session_id,
            "level": {"$in": [level_num, str(level_num), f"{level_num}L"]},
        }
    )
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Timetable entry not found")
    return {"message": "Timetable entry deleted"}
