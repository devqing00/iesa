"""
Growth Hub Router - Backend persistence for personal growth tools.

Provides a per-user key-value store for 8 growth tools:
  habits, goals, journal, planner, flashcards, timer, cgpa, courses

Each tool's entire data blob is stored as a single document per user,
mirroring the previous localStorage pattern but with cloud persistence.
"""

from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, field_validator
from typing import Any, Literal, Optional
from bson import ObjectId

from ..core.security import verify_token
from ..core.database import get_database

router = APIRouter(prefix="/api/v1/growth", tags=["growth"])

COLLECTION = "growth_data"
REWARDS_COLLECTION = "engagement_rewards"

VALID_TOOLS = {
    "habits", "goals", "journal", "planner", "flashcards",
    "timer-settings", "timer-history",
    "cgpa-history", "cgpa-grading",
    "courses",
}

# Maximum payload size per tool (512 KB as JSON string)
MAX_DATA_SIZE_BYTES = 512 * 1024


def _week_key(now: datetime) -> str:
    return f"{now.isocalendar().year}-W{str(now.isocalendar().week).zfill(2)}"


def _coerce_dt(value: Any) -> Optional[datetime]:
    if isinstance(value, datetime):
        return value
    if isinstance(value, str):
        try:
            parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
            return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)
        except Exception:
            return None
    return None


def _perk_utilities(weekly_actions: int) -> list[str]:
    utilities: list[str] = []
    if weekly_actions >= 6:
        utilities.append("fast_shortcuts")
    if weekly_actions >= 12:
        utilities.append("priority_pin_slots")
    return utilities


def _recognition_level(visit_streak: int, weekly_actions: int) -> str:
    if visit_streak >= 14 or weekly_actions >= 12:
        return "Consistency Star"
    if visit_streak >= 7 or weekly_actions >= 8:
        return "Momentum Builder"
    if visit_streak >= 3 or weekly_actions >= 3:
        return "On Track"
    return "Starter"


def _next_chain(action_type: str) -> dict:
    action = (action_type or "").lower()
    if "pay" in action:
        return {
            "title": "Done paying? Check today’s class update",
            "detail": "Stay ahead by confirming timetable changes now.",
            "href": "/dashboard/timetable",
            "cta": "View timetable",
        }
    if "vote" in action or "poll" in action:
        return {
            "title": "Done voting? Open class notes",
            "detail": "Review the latest class notes while it’s fresh.",
            "href": "/dashboard/cohort?tab=notes",
            "cta": "Open class note",
        }
    if "class" in action or "timetable" in action:
        return {
            "title": "Nice. Lock in a growth session",
            "detail": "Use Growth tools to keep momentum today.",
            "href": "/dashboard/growth",
            "cta": "Open Growth Hub",
        }
    return {
        "title": "Great progress — keep the flow",
        "detail": "Check your latest announcements for what’s next.",
        "href": "/dashboard/announcements",
        "cta": "View updates",
    }


# ─── Models ──────────────────────────────────────────────────────────────

class GrowthDataPayload(BaseModel):
    data: Any  # Tool-specific JSON blob

    @field_validator("data")
    @classmethod
    def enforce_size_limit(cls, v: Any) -> Any:
        """Reject payloads larger than MAX_DATA_SIZE_BYTES to prevent storage DoS."""
        import json
        serialized = json.dumps(v, default=str)
        if len(serialized.encode("utf-8")) > MAX_DATA_SIZE_BYTES:
            raise ValueError(
                f"Data payload too large (max {MAX_DATA_SIZE_BYTES // 1024} KB)"
            )
        return v


class RewardsActionPayload(BaseModel):
    actionType: str

    @field_validator("actionType")
    @classmethod
    def validate_action_type(cls, v: str) -> str:
        value = (v or "").strip()
        if not value:
            raise ValueError("actionType is required")
        if len(value) > 120:
            raise ValueError("actionType too long")
        return value


class RewardsPrivacyPayload(BaseModel):
    optIn: bool


class RewardsPinsPayload(BaseModel):
    pins: list[str] = []

    @field_validator("pins")
    @classmethod
    def validate_pins(cls, v: list[str]) -> list[str]:
        clean = [str(item).strip() for item in (v or []) if str(item).strip()]
        if len(clean) > 2:
            raise ValueError("Maximum of 2 pins allowed")
        return clean


async def _fetch_user_doc(db, user_id: str) -> dict:
    if not ObjectId.is_valid(user_id):
        return {}
    user_doc = await db["users"].find_one(
        {"_id": ObjectId(user_id)},
        {"firstName": 1, "lastName": 1, "currentLevel": 1, "level": 1, "role": 1},
    )
    return user_doc or {}


def _build_rewards_response(doc: dict, *, streak_updated_today: bool, weekly_reset_celebration: bool, is_at_risk: bool) -> dict:
    weekly_actions = int(doc.get("weeklyUsefulActions", 0) or 0)
    visit_streak = int(doc.get("visitStreak", 1) or 1)
    return {
        "weekKey": doc.get("weekKey"),
        "visitStreak": visit_streak,
        "streakUpdatedToday": streak_updated_today,
        "weeklyUsefulActions": weekly_actions,
        "totalUsefulActions": int(doc.get("totalUsefulActions", 0) or 0),
        "privacyOptIn": bool(doc.get("privacyOptIn", False)),
        "priorityPins": doc.get("priorityPins", []),
        "perkUtilities": _perk_utilities(weekly_actions),
        "recognitionLevel": _recognition_level(visit_streak, weekly_actions),
        "weeklyResetCelebration": weekly_reset_celebration,
        "isAtRisk": is_at_risk,
    }


@router.get("/rewards")
async def get_rewards_snapshot(user: dict = Depends(verify_token)):
    db = get_database()
    user_id = user["sub"]
    now = datetime.now(timezone.utc)
    today = now.date().isoformat()
    yesterday = (now - timedelta(days=1)).date().isoformat()
    current_week = _week_key(now)

    rewards = db[REWARDS_COLLECTION]
    doc = await rewards.find_one({"userId": user_id})

    if not doc:
        doc = {
            "userId": user_id,
            "weekKey": current_week,
            "visitStreak": 1,
            "lastVisitDate": today,
            "weeklyUsefulActions": 0,
            "totalUsefulActions": 0,
            "privacyOptIn": False,
            "priorityPins": [],
            "createdAt": now,
            "updatedAt": now,
        }
        await rewards.insert_one(doc)
        return _build_rewards_response(doc, streak_updated_today=True, weekly_reset_celebration=False, is_at_risk=False)

    update_fields: dict[str, Any] = {"updatedAt": now}
    weekly_reset = False
    streak_updated = False

    if doc.get("weekKey") != current_week:
        weekly_reset = True
        update_fields.update({"weekKey": current_week, "weeklyUsefulActions": 0, "lastWeeklyResetAt": now})
        doc["weekKey"] = current_week
        doc["weeklyUsefulActions"] = 0

    last_visit = str(doc.get("lastVisitDate") or "")
    if last_visit != today:
        if last_visit == yesterday:
            doc["visitStreak"] = int(doc.get("visitStreak", 1) or 1) + 1
        else:
            doc["visitStreak"] = 1
        update_fields.update({"visitStreak": doc["visitStreak"], "lastVisitDate": today})
        streak_updated = True

    if len(update_fields) > 1:
        await rewards.update_one({"_id": doc["_id"]}, {"$set": update_fields})

    last_action_dt = _coerce_dt(doc.get("lastUsefulActionAt"))
    is_at_risk = bool(last_action_dt and (now - last_action_dt) >= timedelta(hours=24))

    if is_at_risk:
        last_reminder_dt = _coerce_dt(doc.get("lastRiskReminderAt"))
        if not last_reminder_dt or (now - last_reminder_dt) >= timedelta(hours=24):
            try:
                from app.routers.notifications import create_notification
                await create_notification(
                    user_id=user_id,
                    type="system",
                    title="Keep your momentum",
                    message="You have not completed a useful action in the last 24 hours. Take one quick action to keep your streak active.",
                    link="/dashboard",
                    category="system",
                )
                await rewards.update_one({"_id": doc["_id"]}, {"$set": {"lastRiskReminderAt": now, "updatedAt": now}})
            except Exception:
                pass

    latest_doc = await rewards.find_one({"_id": doc["_id"]}) or doc
    return _build_rewards_response(latest_doc, streak_updated_today=streak_updated, weekly_reset_celebration=weekly_reset, is_at_risk=is_at_risk)


@router.post("/rewards/action")
async def track_rewards_action(payload: RewardsActionPayload, user: dict = Depends(verify_token)):
    db = get_database()
    user_id = user["sub"]
    now = datetime.now(timezone.utc)
    current_week = _week_key(now)

    rewards = db[REWARDS_COLLECTION]
    doc = await rewards.find_one({"userId": user_id})
    if not doc:
        await rewards.insert_one({
            "userId": user_id,
            "weekKey": current_week,
            "visitStreak": 1,
            "lastVisitDate": now.date().isoformat(),
            "weeklyUsefulActions": 0,
            "totalUsefulActions": 0,
            "privacyOptIn": False,
            "priorityPins": [],
            "createdAt": now,
            "updatedAt": now,
        })
        doc = await rewards.find_one({"userId": user_id})
        if not doc:
            raise HTTPException(status_code=500, detail="Failed to initialize rewards record")

    weekly_actions = int(doc.get("weeklyUsefulActions", 0) or 0)
    if doc.get("weekKey") != current_week:
        weekly_actions = 0

    weekly_actions += 1
    total_actions = int(doc.get("totalUsefulActions", 0) or 0) + 1

    await rewards.update_one(
        {"_id": doc["_id"]},
        {
            "$set": {
                "weekKey": current_week,
                "weeklyUsefulActions": weekly_actions,
                "totalUsefulActions": total_actions,
                "lastUsefulActionAt": now,
                "updatedAt": now,
            },
            "$push": {"recentActions": {"$each": [{"type": payload.actionType, "at": now}], "$slice": -30}},
        },
    )

    latest_doc = await rewards.find_one({"_id": doc["_id"]}) or doc
    response = _build_rewards_response(latest_doc, streak_updated_today=False, weekly_reset_celebration=False, is_at_risk=False)
    response["nextChain"] = _next_chain(payload.actionType)
    return response


@router.patch("/rewards/privacy")
async def update_rewards_privacy(payload: RewardsPrivacyPayload, user: dict = Depends(verify_token)):
    db = get_database()
    user_id = user["sub"]
    now = datetime.now(timezone.utc)
    current_week = _week_key(now)
    await db[REWARDS_COLLECTION].update_one(
        {"userId": user_id},
        {
            "$set": {"privacyOptIn": payload.optIn, "updatedAt": now, "weekKey": current_week},
            "$setOnInsert": {
                "userId": user_id,
                "visitStreak": 1,
                "lastVisitDate": now.date().isoformat(),
                "weeklyUsefulActions": 0,
                "totalUsefulActions": 0,
                "priorityPins": [],
                "createdAt": now,
            },
        },
        upsert=True,
    )
    return {"ok": True, "privacyOptIn": payload.optIn}


@router.patch("/rewards/pins")
async def update_rewards_pins(payload: RewardsPinsPayload, user: dict = Depends(verify_token)):
    db = get_database()
    user_id = user["sub"]
    now = datetime.now(timezone.utc)
    current_week = _week_key(now)

    doc = await db[REWARDS_COLLECTION].find_one({"userId": user_id})
    weekly_actions = int((doc or {}).get("weeklyUsefulActions", 0) or 0)
    if (doc or {}).get("weekKey") != current_week:
        weekly_actions = 0
    if "priority_pin_slots" not in _perk_utilities(weekly_actions):
        raise HTTPException(status_code=403, detail="Priority pins unlock at 12 useful actions in a week")

    await db[REWARDS_COLLECTION].update_one(
        {"userId": user_id},
        {
            "$set": {"priorityPins": payload.pins, "updatedAt": now, "weekKey": current_week},
            "$setOnInsert": {
                "userId": user_id,
                "visitStreak": 1,
                "lastVisitDate": now.date().isoformat(),
                "weeklyUsefulActions": weekly_actions,
                "totalUsefulActions": 0,
                "privacyOptIn": False,
                "createdAt": now,
            },
        },
        upsert=True,
    )
    return {"ok": True, "priorityPins": payload.pins}


@router.get("/rewards/leaderboard")
async def get_rewards_leaderboard(
    scope: Literal["cohort", "team"] = Query("cohort"),
    limit: int = Query(5, ge=3, le=20),
    user: dict = Depends(verify_token),
):
    db = get_database()
    user_id = user["sub"]
    now = datetime.now(timezone.utc)
    current_week = _week_key(now)

    user_doc = await _fetch_user_doc(db, user_id)
    eligible_ids: set[str] = set()

    if scope == "cohort":
        level_value = str(user_doc.get("currentLevel") or user_doc.get("level") or "")
        level_prefix = "".join(ch for ch in level_value if ch.isdigit())[:3]
        if level_prefix:
            users_cursor = db["users"].find(
                {"currentLevel": {"$regex": f"^{level_prefix}"}},
                {"_id": 1, "firstName": 1, "lastName": 1},
            )
            async for u in users_cursor:
                eligible_ids.add(str(u["_id"]))
    else:
        active_session = await db["sessions"].find_one({"isActive": True}, {"_id": 1})
        if active_session:
            roles_cursor = db["roles"].find(
                {
                    "sessionId": str(active_session["_id"]),
                    "isActive": True,
                    "position": {"$not": {"$regex": r"^(class_rep_|asst_class_rep_|admin$|super_admin$)", "$options": "i"}},
                },
                {"userId": 1},
            )
            async for role_doc in roles_cursor:
                if role_doc.get("userId"):
                    eligible_ids.add(str(role_doc["userId"]))

    if not eligible_ids:
        return {"scope": scope, "items": []}

    rewards_cursor = db[REWARDS_COLLECTION].find(
        {
            "userId": {"$in": list(eligible_ids)},
            "weekKey": current_week,
            "privacyOptIn": True,
        },
        {"userId": 1, "weeklyUsefulActions": 1, "visitStreak": 1},
    )
    reward_docs = await rewards_cursor.to_list(length=200)
    reward_docs.sort(key=lambda d: (int(d.get("weeklyUsefulActions", 0) or 0), int(d.get("visitStreak", 0) or 0)), reverse=True)
    reward_docs = reward_docs[:limit]

    user_oids = [ObjectId(doc["userId"]) for doc in reward_docs if ObjectId.is_valid(str(doc.get("userId")))]
    name_map: dict[str, str] = {}
    if user_oids:
        users_cursor = db["users"].find({"_id": {"$in": user_oids}}, {"firstName": 1, "lastName": 1})
        async for u in users_cursor:
            full_name = f"{u.get('firstName', '')} {u.get('lastName', '')}".strip() or "Student"
            name_map[str(u["_id"])] = full_name

    items = []
    for idx, item in enumerate(reward_docs, start=1):
        uid = str(item.get("userId"))
        items.append(
            {
                "rank": idx,
                "name": name_map.get(uid, "Student"),
                "weeklyUsefulActions": int(item.get("weeklyUsefulActions", 0) or 0),
                "visitStreak": int(item.get("visitStreak", 0) or 0),
                "isMe": uid == user_id,
            }
        )

    return {"scope": scope, "items": items}


# ─── Endpoints ───────────────────────────────────────────────────────────

@router.get("/all")
async def get_all_growth_data(
    user: dict = Depends(verify_token),
):
    """Get all growth data for the current user (used by hub index page)."""
    db = get_database()
    cursor = db[COLLECTION].find(
        {"userId": user["sub"]},
        {"_id": 0, "tool": 1, "data": 1, "updatedAt": 1},
    )
    docs = await cursor.to_list(length=20)

    result = {}
    for doc in docs:
        result[doc["tool"]] = {
            "data": doc.get("data"),
            "updatedAt": doc.get("updatedAt"),
        }

    return result


@router.get("/{tool}")
async def get_growth_data(
    tool: str,
    user: dict = Depends(verify_token),
):
    """Get the user's saved data for a specific growth tool."""
    if tool not in VALID_TOOLS:
        raise HTTPException(status_code=400, detail=f"Invalid tool: {tool}")

    db = get_database()
    doc = await db[COLLECTION].find_one(
        {"userId": user["sub"], "tool": tool},
        {"_id": 0, "data": 1, "updatedAt": 1},
    )

    if not doc:
        return {"data": None, "updatedAt": None}

    return {
        "data": doc.get("data"),
        "updatedAt": doc.get("updatedAt"),
    }


@router.put("/{tool}")
async def save_growth_data(
    tool: str,
    payload: GrowthDataPayload,
    user: dict = Depends(verify_token),
):
    """Save (upsert) the user's data for a specific growth tool."""
    if tool not in VALID_TOOLS:
        raise HTTPException(status_code=400, detail=f"Invalid tool: {tool}")

    db = get_database()
    now = datetime.now(timezone.utc)

    result = await db[COLLECTION].update_one(
        {"userId": user["sub"], "tool": tool},
        {
            "$set": {
                "data": payload.data,
                "updatedAt": now,
            },
            "$setOnInsert": {
                "userId": user["sub"],
                "tool": tool,
                "createdAt": now,
            },
        },
        upsert=True,
    )

    return {"ok": True, "updatedAt": now.isoformat()}


@router.delete("/{tool}")
async def delete_growth_data(
    tool: str,
    user: dict = Depends(verify_token),
):
    """Delete the user's data for a specific growth tool (reset)."""
    if tool not in VALID_TOOLS:
        raise HTTPException(status_code=400, detail=f"Invalid tool: {tool}")

    db = get_database()
    result = await db[COLLECTION].delete_one(
        {"userId": user["sub"], "tool": tool}
    )

    return {"ok": True, "deleted": result.deleted_count > 0}
