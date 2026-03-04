"""
Growth Hub Router - Backend persistence for personal growth tools.

Provides a per-user key-value store for 8 growth tools:
  habits, goals, journal, planner, flashcards, timer, cgpa, courses

Each tool's entire data blob is stored as a single document per user,
mirroring the previous localStorage pattern but with cloud persistence.
"""

from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, field_validator
from typing import Any, Literal

from ..core.security import verify_token
from ..core.database import get_database

router = APIRouter(prefix="/api/v1/growth", tags=["growth"])

COLLECTION = "growth_data"

VALID_TOOLS = {
    "habits", "goals", "journal", "planner", "flashcards",
    "timer-settings", "timer-history",
    "cgpa-history", "cgpa-grading",
    "courses",
}

# Maximum payload size per tool (512 KB as JSON string)
MAX_DATA_SIZE_BYTES = 512 * 1024


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


# ─── Endpoints ───────────────────────────────────────────────────────────

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


@router.get("/")
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
