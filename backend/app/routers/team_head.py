"""
Team Head Portal Router

Provides a workspace for unit/committee heads to manage their unit:
  - View member roster
  - Noticeboard (pinned posts visible to members)
  - Task board (assign tasks to members)
  - Unit-targeted announcements
  - Analytics (member activity, task completion rates)

Endpoints:
  GET    /api/v1/team-head/my-units                    — Which units this user heads
  GET    /api/v1/team-head/{unit}/members               — Member roster
  GET    /api/v1/team-head/{unit}/noticeboard           — List noticeboard posts
  POST   /api/v1/team-head/{unit}/noticeboard           — Create noticeboard post
  PUT    /api/v1/team-head/{unit}/noticeboard/{id}      — Update post
  DELETE /api/v1/team-head/{unit}/noticeboard/{id}      — Delete post
  GET    /api/v1/team-head/{unit}/tasks                 — List tasks
  POST   /api/v1/team-head/{unit}/tasks                 — Create task
  PATCH  /api/v1/team-head/{unit}/tasks/{id}            — Update task (status, details)
  DELETE /api/v1/team-head/{unit}/tasks/{id}            — Delete task
  POST   /api/v1/team-head/{unit}/announce              — Send unit-targeted announcement
  GET    /api/v1/team-head/{unit}/analytics             — Activity stats + task completion rates
  GET    /api/v1/team-head/{unit}/admin-content         — Admin view of noticeboard + tasks

Member-facing (authenticated, no head role):
  GET    /api/v1/team-head/my-memberships               — Which units this user belongs to
  GET    /api/v1/team-head/{unit}/member-view            — Member view (noticeboard + tasks)
  PATCH  /api/v1/team-head/{unit}/tasks/{id}/status     — Member updates own task status
"""

from datetime import datetime, timezone
from typing import Optional

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from app.core.error_handling import fire_and_forget
from app.core.permissions import get_current_session, require_permission
from app.core.security import get_current_user
from app.db import get_database
from app.models.team_application import (
    HEAD_POSITION_TO_TEAM,
    TEAM_LABELS,
    TEAM_ROLE_MAP,
    TEAM_TO_HEAD_POSITION,
)
from app.routers.notifications import create_bulk_notifications

router = APIRouter(prefix="/api/v1/team-head", tags=["team-head"])


# ── Pydantic schemas ─────────────────────────────────────────────

class NoticeCreate(BaseModel):
    title: str = Field(..., min_length=2, max_length=200)
    content: str = Field(..., min_length=2, max_length=2000)
    isPinned: bool = False


class NoticeUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=2, max_length=200)
    content: Optional[str] = Field(None, min_length=2, max_length=2000)
    isPinned: Optional[bool] = None


class TaskCreate(BaseModel):
    title: str = Field(..., min_length=2, max_length=200)
    description: str = Field("", max_length=1000)
    assignedTo: Optional[str] = None  # userId, or None for everyone
    dueDate: Optional[str] = None
    priority: str = Field("normal", pattern=r"^(low|normal|high|urgent)$")


class TaskUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=2, max_length=200)
    description: Optional[str] = Field(None, max_length=1000)
    assignedTo: Optional[str] = None
    dueDate: Optional[str] = None
    priority: Optional[str] = Field(None, pattern=r"^(low|normal|high|urgent)$")
    status: Optional[str] = Field(None, pattern=r"^(pending|in_progress|done)$")


class TaskStatusUpdate(BaseModel):
    status: str = Field(..., pattern=r"^(pending|in_progress|done)$")


class AnnouncePayload(BaseModel):
    title: str = Field(..., min_length=2, max_length=200)
    content: str = Field(..., min_length=10, max_length=5000)
    priority: str = Field("normal", pattern=r"^(low|normal|urgent)$")


# ── Helpers ──────────────────────────────────────────────────────

async def _get_user_headed_teams(user_id: str, session_id: str, db) -> list[dict]:
    """Return list of {teamSlug, teamLabel, isCustom} for units this user heads."""
    roles = await db["roles"].find({
        "userId": user_id,
        "sessionId": session_id,
        "isActive": True,
    }).to_list(length=50)

    positions = {r["position"] for r in roles}
    result = []

    # Static units: check HEAD_POSITION_TO_TEAM
    for pos in positions:
        team_slug = HEAD_POSITION_TO_TEAM.get(pos)
        if team_slug:
            result.append({
                "unitSlug": team_slug,
                "teamLabel": TEAM_LABELS.get(team_slug, team_slug),
                "isCustom": False,
            })

    # Custom units: check unit_head_custom_* positions
    for pos in positions:
        if pos.startswith("unit_head_custom_"):
            slug = pos.replace("unit_head_custom_", "", 1)
            doc = await db["custom_units"].find_one({"slug": slug, "isActive": True})
            if doc:
                result.append({
                    "teamSlug": slug,
                    "teamLabel": doc.get("label", slug),
                    "isCustom": True,
                })

    return result


async def _verify_head_of_team(user_id: str, team_slug: str, session_id: str, db) -> dict:
    """Verify user is head of the given unit. Returns unit info dict or raises 403."""
    headed = await _get_user_headed_teams(user_id, session_id, db)
    match = next((u for u in headed if u["teamSlug"] == team_slug), None)
    if not match:
        raise HTTPException(403, "You are not the head of this team")
    return match


async def _get_team_member_ids(team_slug: str, session_id: str, db) -> list[str]:
    """Return list of userIds who are active members of this unit."""
    role_info = TEAM_ROLE_MAP.get(team_slug)
    if not role_info:
        # Custom unit: no members via role system (custom units don't have TEAM_ROLE_MAP entries)
        return []
    member_roles = await db["roles"].find({
        "position": role_info["position"],
        "sessionId": session_id,
        "isActive": True,
    }).to_list(length=500)
    return [r["userId"] for r in member_roles]


async def _get_team_members_full(team_slug: str, session_id: str, db) -> list[dict]:
    """Return enriched member list with user details."""
    role_info = TEAM_ROLE_MAP.get(team_slug)
    if not role_info:
        return []
    member_roles = await db["roles"].find({
        "position": role_info["position"],
        "sessionId": session_id,
        "isActive": True,
    }).to_list(length=500)

    if not member_roles:
        return []

    user_ids = [ObjectId(r["userId"]) for r in member_roles]
    users = await db["users"].find(
        {"_id": {"$in": user_ids}},
        {"firstName": 1, "lastName": 1, "email": 1, "matricNumber": 1,
         "currentLevel": 1, "profilePhotoURL": 1, "phone": 1},
    ).to_list(length=500)
    user_map = {str(u["_id"]): u for u in users}

    result = []
    for r in member_roles:
        u = user_map.get(r["userId"])
        if u:
            result.append({
                "id": str(u["_id"]),
                "firstName": u.get("firstName", ""),
                "lastName": u.get("lastName", ""),
                "email": u.get("email", ""),
                "matricNumber": u.get("matricNumber", ""),
                "level": u.get("currentLevel", ""),
                "phone": u.get("phone", ""),
                "profilePhotoURL": u.get("profilePhotoURL"),
                "joinedAt": r.get("createdAt"),
            })
    return result


def _check_membership(user_id: str, member_ids: list[str]) -> bool:
    return user_id in member_ids


def _ser(doc: dict) -> dict:
    """Standard serialization: _id → id string."""
    doc["id"] = str(doc.pop("_id"))
    return doc


# ═══════════════════════════════════════════════════════════
# HEAD ENDPOINTS (require team_head:* permissions)
# ═══════════════════════════════════════════════════════════

@router.get("/my-teams")
async def my_headed_teams(
    user=Depends(require_permission("team_head:view_members")),
    session=Depends(get_current_session),
):
    """Return units this user heads."""
    db = get_database()
    user_id = str(user.get("_id") or user.get("id"))
    session_id = str(session["_id"])
    return await _get_user_headed_teams(user_id, session_id, db)


@router.get("/{team}/members")
async def team_members(
    team: str,
    user=Depends(require_permission("team_head:view_members")),
    session=Depends(get_current_session),
):
    """Return member roster for a unit this user heads."""
    db = get_database()
    user_id = str(user.get("_id") or user.get("id"))
    session_id = str(session["_id"])
    team_info = await _verify_head_of_team(user_id, unit, session_id, db)
    members = await _get_team_members_full(unit, session_id, db)
    return {"unit": team_info, "members": members}


# ── Noticeboard ──────────────────────────────────────────────

@router.get("/{team}/noticeboard")
async def list_notices(
    team: str,
    user=Depends(require_permission("team_head:manage_noticeboard")),
    session=Depends(get_current_session),
):
    db = get_database()
    user_id = str(user.get("_id") or user.get("id"))
    session_id = str(session["_id"])
    await _verify_head_of_team(user_id, unit, session_id, db)

    cursor = db["unit_noticeboard"].find({
        "unitSlug": unit, "sessionId": session_id,
    }).sort([("isPinned", -1), ("createdAt", -1)])
    docs = await cursor.to_list(length=100)
    return {"posts": [_ser(d) for d in docs]}


@router.post("/{team}/noticeboard")
async def create_notice(
    team: str,
    body: NoticeCreate,
    user=Depends(require_permission("team_head:manage_noticeboard")),
    session=Depends(get_current_session),
):
    db = get_database()
    user_id = str(user.get("_id") or user.get("id"))
    session_id = str(session["_id"])
    await _verify_head_of_team(user_id, unit, session_id, db)

    now = datetime.now(timezone.utc)
    user_name = f"{user.get('firstName', '')} {user.get('lastName', '')}".strip()
    doc = {
        "unitSlug": unit,
        "sessionId": session_id,
        "title": body.title.strip(),
        "content": body.content.strip(),
        "isPinned": body.isPinned,
        "createdBy": user_id,
        "createdByName": user_name,
        "createdAt": now,
        "updatedAt": now,
    }
    result = await db["unit_noticeboard"].insert_one(doc)
    doc["_id"] = result.inserted_id
    return _ser(doc)


@router.put("/{team}/noticeboard/{post_id}")
async def update_notice(
    team: str,
    post_id: str,
    body: NoticeUpdate,
    user=Depends(require_permission("team_head:manage_noticeboard")),
    session=Depends(get_current_session),
):
    db = get_database()
    user_id = str(user.get("_id") or user.get("id"))
    session_id = str(session["_id"])
    await _verify_head_of_team(user_id, unit, session_id, db)

    if not ObjectId.is_valid(post_id):
        raise HTTPException(400, "Invalid post ID")

    updates: dict = {"updatedAt": datetime.now(timezone.utc)}
    if body.title is not None:
        updates["title"] = body.title.strip()
    if body.content is not None:
        updates["content"] = body.content.strip()
    if body.isPinned is not None:
        updates["isPinned"] = body.isPinned

    res = await db["unit_noticeboard"].update_one(
        {"_id": ObjectId(post_id), "unitSlug": unit, "sessionId": session_id},
        {"$set": updates},
    )
    if res.matched_count == 0:
        raise HTTPException(404, "Post not found")
    return {"updated": True}


@router.delete("/{team}/noticeboard/{post_id}")
async def delete_notice(
    team: str,
    post_id: str,
    user=Depends(require_permission("team_head:manage_noticeboard")),
    session=Depends(get_current_session),
):
    db = get_database()
    user_id = str(user.get("_id") or user.get("id"))
    session_id = str(session["_id"])
    await _verify_head_of_team(user_id, unit, session_id, db)

    if not ObjectId.is_valid(post_id):
        raise HTTPException(400, "Invalid post ID")
    res = await db["unit_noticeboard"].delete_one(
        {"_id": ObjectId(post_id), "unitSlug": unit, "sessionId": session_id},
    )
    if res.deleted_count == 0:
        raise HTTPException(404, "Post not found")
    return {"deleted": True}


# ── Task Board ───────────────────────────────────────────────

@router.get("/{team}/tasks")
async def list_tasks(
    team: str,
    status: Optional[str] = Query(None),
    user=Depends(require_permission("team_head:manage_tasks")),
    session=Depends(get_current_session),
):
    db = get_database()
    user_id = str(user.get("_id") or user.get("id"))
    session_id = str(session["_id"])
    await _verify_head_of_team(user_id, unit, session_id, db)

    query: dict = {"unitSlug": unit, "sessionId": session_id}
    if status:
        query["status"] = status
    cursor = db["unit_tasks"].find(query).sort("createdAt", -1)
    docs = await cursor.to_list(length=200)

    # Enrich assignedTo with user name
    assigned_ids = [ObjectId(d["assignedTo"]) for d in docs if d.get("assignedTo") and ObjectId.is_valid(d["assignedTo"])]
    user_map = {}
    if assigned_ids:
        users = await db["users"].find(
            {"_id": {"$in": assigned_ids}}, {"firstName": 1, "lastName": 1}
        ).to_list(length=200)
        user_map = {str(u["_id"]): f"{u.get('firstName', '')} {u.get('lastName', '')}".strip() for u in users}

    result = []
    for d in docs:
        s = _ser(d)
        s["assignedToName"] = user_map.get(d.get("assignedTo", ""), "Everyone") if d.get("assignedTo") else "Everyone"
        result.append(s)

    return {"tasks": result}


@router.post("/{team}/tasks")
async def create_task(
    team: str,
    body: TaskCreate,
    user=Depends(require_permission("team_head:manage_tasks")),
    session=Depends(get_current_session),
):
    db = get_database()
    user_id = str(user.get("_id") or user.get("id"))
    session_id = str(session["_id"])
    team_info = await _verify_head_of_team(user_id, unit, session_id, db)

    now = datetime.now(timezone.utc)
    user_name = f"{user.get('firstName', '')} {user.get('lastName', '')}".strip()

    doc = {
        "unitSlug": unit,
        "sessionId": session_id,
        "title": body.title.strip(),
        "description": body.description.strip(),
        "assignedTo": body.assignedTo,
        "dueDate": body.dueDate,
        "priority": body.priority,
        "status": "pending",
        "createdBy": user_id,
        "createdByName": user_name,
        "createdAt": now,
        "updatedAt": now,
    }
    result = await db["unit_tasks"].insert_one(doc)
    doc["_id"] = result.inserted_id

    # Notify assignee (or all members)
    member_ids = await _get_team_member_ids(unit, session_id, db)
    notify_ids = [body.assignedTo] if body.assignedTo else member_ids
    if notify_ids:
        fire_and_forget(create_bulk_notifications(
            user_ids=notify_ids,
            type="team_task",
            title=f"New Task: {body.title}",
            message=f"[{team_info['teamLabel']}] {body.title}",
            link="/dashboard/teams",
            related_id=str(result.inserted_id),
        ))

    s = _ser(doc)
    s["assignedToName"] = "Everyone"
    return s


@router.patch("/{team}/tasks/{task_id}")
async def update_task(
    team: str,
    task_id: str,
    body: TaskUpdate,
    user=Depends(require_permission("team_head:manage_tasks")),
    session=Depends(get_current_session),
):
    db = get_database()
    user_id = str(user.get("_id") or user.get("id"))
    session_id = str(session["_id"])
    await _verify_head_of_team(user_id, unit, session_id, db)

    if not ObjectId.is_valid(task_id):
        raise HTTPException(400, "Invalid task ID")

    updates: dict = {"updatedAt": datetime.now(timezone.utc)}
    for field in ("title", "description", "assignedTo", "dueDate", "priority", "status"):
        val = getattr(body, field, None)
        if val is not None:
            updates[field] = val.strip() if isinstance(val, str) else val

    res = await db["unit_tasks"].update_one(
        {"_id": ObjectId(task_id), "unitSlug": unit, "sessionId": session_id},
        {"$set": updates},
    )
    if res.matched_count == 0:
        raise HTTPException(404, "Task not found")
    return {"updated": True}


@router.delete("/{team}/tasks/{task_id}")
async def delete_task(
    team: str,
    task_id: str,
    user=Depends(require_permission("team_head:manage_tasks")),
    session=Depends(get_current_session),
):
    db = get_database()
    user_id = str(user.get("_id") or user.get("id"))
    session_id = str(session["_id"])
    await _verify_head_of_team(user_id, unit, session_id, db)

    if not ObjectId.is_valid(task_id):
        raise HTTPException(400, "Invalid task ID")
    res = await db["unit_tasks"].delete_one(
        {"_id": ObjectId(task_id), "unitSlug": unit, "sessionId": session_id},
    )
    if res.deleted_count == 0:
        raise HTTPException(404, "Task not found")
    return {"deleted": True}


# ── Unit-Targeted Announcement ───────────────────────────────

@router.post("/{team}/announce")
async def create_team_announcement(
    team: str,
    body: AnnouncePayload,
    user=Depends(require_permission("team_head:announce")),
    session=Depends(get_current_session),
):
    """Create an announcement targeted to this unit's members only."""
    db = get_database()
    user_id = str(user.get("_id") or user.get("id"))
    session_id = str(session["_id"])
    team_info = await _verify_head_of_team(user_id, unit, session_id, db)

    now = datetime.now(timezone.utc)
    user_name = f"{user.get('firstName', '')} {user.get('lastName', '')}".strip()

    announcement = {
        "title": body.title.strip(),
        "content": body.content.strip(),
        "priority": body.priority,
        "targetTeam": unit,
        "targetTeamLabel": team_info["teamLabel"],
        "author": user_name,
        "authorId": user_id,
        "sessionId": session_id,
        "createdAt": now,
        "updatedAt": now,
    }
    result = await db["announcements"].insert_one(announcement)

    # Notify all members
    member_ids = await _get_team_member_ids(unit, session_id, db)
    if member_ids:
        fire_and_forget(create_bulk_notifications(
            user_ids=member_ids,
            type="announcement",
            title=f"[{team_info['teamLabel']}] {body.title}",
            message=body.content[:150],
            link="/dashboard/announcements",
            related_id=str(result.inserted_id),
        ))

    return {"id": str(result.inserted_id), "message": f"Announcement sent to {len(member_ids)} member(s)"}


# ── Unit Analytics ───────────────────────────────────────────

@router.get("/{team}/analytics")
async def get_team_analytics(
    team: str,
    user=Depends(require_permission("team_head:view_members")),
    session=Depends(get_current_session),
):
    """
    Activity stats and task completion rates for a unit.
    Available to the unit head (requires team_head:view_members permission).
    """
    db = get_database()
    user_id = str(user.get("_id") or user.get("id"))
    session_id = str(session["_id"])
    team_info = await _verify_head_of_team(user_id, unit, session_id, db)

    # Member count
    member_ids = await _get_team_member_ids(unit, session_id, db)
    member_count = len(member_ids)

    # Task stats via aggregation
    task_pipeline = [
        {"$match": {"unitSlug": unit, "sessionId": session_id}},
        {"$group": {
            "_id": "$status",
            "count": {"$sum": 1},
        }},
    ]
    task_agg = await db["unit_tasks"].aggregate(task_pipeline).to_list(length=10)
    status_map = {row["_id"]: row["count"] for row in task_agg}
    total_tasks = sum(status_map.values())
    done_tasks = status_map.get("done", 0)
    completion_rate = round((done_tasks / total_tasks) * 100, 1) if total_tasks else 0.0

    task_stats = {
        "total": total_tasks,
        "pending": status_map.get("pending", 0),
        "in_progress": status_map.get("in_progress", 0),
        "done": done_tasks,
        "completionRate": completion_rate,
    }

    # Priority breakdown
    priority_pipeline = [
        {"$match": {"unitSlug": unit, "sessionId": session_id, "status": {"$ne": "done"}}},
        {"$group": {"_id": "$priority", "count": {"$sum": 1}}},
    ]
    priority_agg = await db["unit_tasks"].aggregate(priority_pipeline).to_list(length=10)
    priority_map = {row["_id"]: row["count"] for row in priority_agg}

    # Overdue tasks (dueDate < now and not done)
    now = datetime.now(timezone.utc)
    overdue_count = await db["unit_tasks"].count_documents({
        "unitSlug": unit,
        "sessionId": session_id,
        "status": {"$ne": "done"},
        "dueDate": {"$lt": now.isoformat()},
    })

    # Noticeboard stats
    notice_total = await db["unit_noticeboard"].count_documents({"unitSlug": unit, "sessionId": session_id})
    notice_pinned = await db["unit_noticeboard"].count_documents({"unitSlug": unit, "sessionId": session_id, "isPinned": True})

    notice_stats = {
        "total": notice_total,
        "pinned": notice_pinned,
    }

    # Recent activity — last 5 task completions + last 5 notice posts combined
    recent_tasks_cursor = db["unit_tasks"].find(
        {"unitSlug": unit, "sessionId": session_id},
    ).sort("updatedAt", -1).limit(5)
    recent_tasks = await recent_tasks_cursor.to_list(length=5)

    recent_notices_cursor = db["unit_noticeboard"].find(
        {"unitSlug": unit, "sessionId": session_id},
    ).sort("createdAt", -1).limit(5)
    recent_notices = await recent_notices_cursor.to_list(length=5)

    # Per-member task completion stats
    member_stats = []
    if member_ids:
        member_pipeline = [
            {"$match": {
                "unitSlug": unit,
                "sessionId": session_id,
                "assignedTo": {"$in": member_ids},
            }},
            {"$group": {
                "_id": "$assignedTo",
                "total": {"$sum": 1},
                "done": {"$sum": {"$cond": [{"$eq": ["$status", "done"]}, 1, 0]}},
            }},
        ]
        member_agg = await db["unit_tasks"].aggregate(member_pipeline).to_list(length=100)
        user_ids_for_lookup = [row["_id"] for row in member_agg if row["_id"]]
        users_cursor = db["users"].find(
            {"_id": {"$in": [ObjectId(uid) for uid in user_ids_for_lookup if ObjectId.is_valid(uid)]}},
            {"firstName": 1, "lastName": 1, "profilePhotoURL": 1},
        )
        users_map = {str(u["_id"]): u async for u in users_cursor}

        for row in member_agg:
            uid = row["_id"]
            u = users_map.get(uid, {})
            member_stats.append({
                "userId": uid,
                "name": f"{u.get('firstName', '')} {u.get('lastName', '')}".strip() or "Unknown",
                "profilePhotoURL": u.get("profilePhotoURL"),
                "totalTasks": row["total"],
                "doneTasks": row["done"],
                "completionRate": round((row["done"] / row["total"]) * 100, 1) if row["total"] else 0.0,
            })
        member_stats.sort(key=lambda x: x["completionRate"], reverse=True)

    return {
        "unitSlug": unit,
        "teamLabel": team_info["teamLabel"],
        "memberCount": member_count,
        "taskStats": task_stats,
        "priorityBreakdown": priority_map,
        "overdueCount": overdue_count,
        "noticeStats": notice_stats,
        "memberStats": member_stats,
        "recentActivity": {
            "tasks": [_ser(t) for t in recent_tasks],
            "notices": [_ser(n) for n in recent_notices],
        },
    }


# ── Admin Unit Content View ──────────────────────────────────

@router.get("/{team}/admin-content")
async def admin_team_content(
    team: str,
    user=Depends(require_permission("team:review")),
    session=Depends(get_current_session),
):
    """
    Admin/reviewer view: returns noticeboard posts and tasks for any unit.
    Requires team:review permission (admin/exco with review rights).
    """
    db = get_database()
    session_id = str(session["_id"])

    # Noticeboard (most recent 10)
    notice_cursor = db["unit_noticeboard"].find({
        "unitSlug": unit, "sessionId": session_id,
    }).sort([("isPinned", -1), ("createdAt", -1)])
    notices = await notice_cursor.to_list(length=10)

    # Tasks (all tasks, newest first)
    task_cursor = db["unit_tasks"].find({
        "unitSlug": unit, "sessionId": session_id,
    }).sort("createdAt", -1)
    tasks = await task_cursor.to_list(length=50)

    # Task summary
    status_counts: dict[str, int] = {}
    for t in tasks:
        s = t.get("status", "pending")
        status_counts[s] = status_counts.get(s, 0) + 1
    total = len(tasks)
    done = status_counts.get("done", 0)

    return {
        "unitSlug": unit,
        "teamLabel": TEAM_LABELS.get(unit, unit),
        "noticeboard": [_ser(n) for n in notices],
        "tasks": [_ser(t) for t in tasks],
        "taskSummary": {
            "total": total,
            "pending": status_counts.get("pending", 0),
            "in_progress": status_counts.get("in_progress", 0),
            "done": done,
            "completionRate": round((done / total) * 100, 1) if total else 0.0,
        },
    }


# ═══════════════════════════════════════════════════════════
# MEMBER ENDPOINTS (any authenticated user who is a member)
# ═══════════════════════════════════════════════════════════

@router.get("/my-memberships")
async def my_memberships(
    user=Depends(get_current_user),
    session=Depends(get_current_session),
):
    """Return units this user is a member of (with head info)."""
    db = get_database()
    user_id = str(user.get("_id") or user.get("id"))
    session_id = str(session["_id"])

    # Find all member roles for this user
    roles = await db["roles"].find({
        "userId": user_id,
        "sessionId": session_id,
        "isActive": True,
    }).to_list(length=50)

    # Build a reverse map: position → teamSlug
    position_to_unit = {}
    for slug, info in TEAM_ROLE_MAP.items():
        position_to_unit[info["position"]] = slug

    result = []
    for r in roles:
        slug = position_to_unit.get(r["position"])
        if slug:
            # Get head info
            head_position = TEAM_TO_HEAD_POSITION.get(slug)
            head = None
            if head_position:
                head_role = await db["roles"].find_one({
                    "position": head_position,
                    "sessionId": session_id,
                    "isActive": True,
                })
                if head_role:
                    head_user = await db["users"].find_one(
                        {"_id": ObjectId(head_role["userId"])},
                        {"firstName": 1, "lastName": 1, "email": 1, "profilePhotoURL": 1},
                    )
                    if head_user:
                        head = {
                            "userId": str(head_user["_id"]),
                            "firstName": head_user.get("firstName", ""),
                            "lastName": head_user.get("lastName", ""),
                            "email": head_user.get("email", ""),
                            "profilePhotoURL": head_user.get("profilePhotoURL"),
                        }

            # Count members
            role_info = TEAM_ROLE_MAP.get(slug, {})
            member_count = 0
            if role_info.get("position"):
                member_count = await db["roles"].count_documents({
                    "position": role_info["position"],
                    "sessionId": session_id,
                    "isActive": True,
                })

            result.append({
                "teamSlug": slug,
                "teamLabel": TEAM_LABELS.get(slug, slug),
                "head": head,
                "memberCount": member_count,
                "joinedAt": r.get("createdAt"),
            })

    return result


@router.get("/{team}/member-view")
async def member_view(
    team: str,
    user=Depends(get_current_user),
    session=Depends(get_current_session),
):
    """
    Member view: returns noticeboard posts and tasks assigned to this member.
    User must be an active member of the unit.
    """
    db = get_database()
    user_id = str(user.get("_id") or user.get("id"))
    session_id = str(session["_id"])

    # Verify membership
    member_ids = await _get_team_member_ids(unit, session_id, db)
    if not _check_membership(user_id, member_ids):
        raise HTTPException(403, "You are not a member of this team")

    # Noticeboard
    notice_cursor = db["unit_noticeboard"].find({
        "unitSlug": unit, "sessionId": session_id,
    }).sort([("isPinned", -1), ("createdAt", -1)])
    notices = await notice_cursor.to_list(length=50)

    # Tasks (assigned to this user or to everyone)
    task_cursor = db["unit_tasks"].find({
        "unitSlug": unit,
        "sessionId": session_id,
        "$or": [
            {"assignedTo": user_id},
            {"assignedTo": None},
            {"assignedTo": {"$exists": False}},
        ],
    }).sort("createdAt", -1)
    tasks = await task_cursor.to_list(length=100)

    return {
        "unitSlug": unit,
        "teamLabel": TEAM_LABELS.get(unit, unit),
        "notices": [_ser(n) for n in notices],
        "tasks": [_ser(t) for t in tasks],
    }


@router.patch("/{team}/tasks/{task_id}/status")
async def member_update_task_status(
    team: str,
    task_id: str,
    body: TaskStatusUpdate,
    user=Depends(get_current_user),
    session=Depends(get_current_session),
):
    """Member updates the status of a task assigned to them."""
    db = get_database()
    user_id = str(user.get("_id") or user.get("id"))
    session_id = str(session["_id"])

    # Verify membership
    member_ids = await _get_team_member_ids(unit, session_id, db)
    if not _check_membership(user_id, member_ids):
        raise HTTPException(403, "You are not a member of this team")

    if not ObjectId.is_valid(task_id):
        raise HTTPException(400, "Invalid task ID")

    # Only allow updating tasks assigned to this user or to everyone
    res = await db["unit_tasks"].update_one(
        {
            "_id": ObjectId(task_id),
            "unitSlug": unit,
            "sessionId": session_id,
            "$or": [
                {"assignedTo": user_id},
                {"assignedTo": None},
                {"assignedTo": {"$exists": False}},
            ],
        },
        {"$set": {"status": body.status, "updatedAt": datetime.now(timezone.utc)}},
    )
    if res.matched_count == 0:
        raise HTTPException(404, "Task not found or not assigned to you")
    return {"updated": True}
