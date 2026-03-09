"""
Class Rep Portal Router

Provides level-scoped features for class representatives and their assistants:
- Cohort directory & CSV export
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
from datetime import datetime, timezone
from typing import Optional

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse

from app.core.permissions import require_permission
from app.core.security import get_current_user
from app.db import get_database

router = APIRouter(prefix="/api/v1/class-rep", tags=["class-rep"])


# ──────────────────────────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────────────────────────

async def _get_rep_level(user: dict) -> str:
    """
    Resolve the class-rep level from the user's active role doc.
    Works for both class_rep_400L and asst_class_rep_400L positions.
    Raises 403 if the caller has no active class-rep role.
    """
    db = get_database()
    user_id = str(user.get("_id") or user.get("id", ""))

    role = await db["roles"].find_one({
        "userId": user_id,
        "isActive": True,
        "$or": [
            {"position": {"$regex": "^class_rep_"}},
            {"position": {"$regex": "^asst_class_rep_"}},
        ],
    })
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


async def _get_active_session_id() -> str:
    db = get_database()
    session = await db["sessions"].find_one({"isActive": True})
    if not session:
        raise HTTPException(status_code=404, detail="No active session")
    return str(session["_id"])


def _user_id(user: dict) -> str:
    return str(user.get("_id") or user.get("id", ""))


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
    polls = []
    for d in docs:
        votes = d.get("votes") or {}  # {optionIndex: [userId, ...]}
        total_votes = sum(len(v) for v in votes.values())
        user_vote = None
        for opt_idx, voter_ids in votes.items():
            if uid in voter_ids:
                user_vote = int(opt_idx)
                break

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
            "userVote": user_vote,
            "isActive": d.get("isActive", True),
            "createdBy": d.get("createdBy", ""),
            "createdByName": d.get("createdByName", ""),
            "createdAt": d.get("createdAt", ""),
        })
    return {"level": level, "polls": polls}


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
# TIMETABLE (level-filtered, read-only)
# ──────────────────────────────────────────────────────────────────

@router.get(
    "/timetable",
    dependencies=[Depends(require_permission("timetable:view"))],
)
async def level_timetable(current_user: dict = Depends(get_current_user)):
    """Return timetable entries filtered to the rep's level."""
    level = await _get_rep_level(current_user)
    session_id = await _get_active_session_id()
    db = get_database()

    # classSessions filtered by level
    docs = await db["classSessions"].find({
        "sessionId": session_id,
        "level": level,
    }).sort([("dayOfWeek", 1), ("startTime", 1)]).to_list(None)

    entries = []
    for d in docs:
        entries.append({
            "id": str(d["_id"]),
            "courseCode": d.get("courseCode", ""),
            "courseTitle": d.get("courseTitle", ""),
            "lecturer": d.get("lecturer", ""),
            "dayOfWeek": d.get("dayOfWeek", ""),
            "startTime": d.get("startTime", ""),
            "endTime": d.get("endTime", ""),
            "venue": d.get("venue", ""),
            "type": d.get("type", "lecture"),
        })
    return {"level": level, "timetable": entries}
