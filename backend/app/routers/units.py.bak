"""
Units Management Router

Allows admins to create, edit, and delete custom units/committees beyond the
built-in static set (press, ics, committees). Also supports assigning/removing
a unit head for any unit (static or custom).

Built-in static units keep their existing head-via-roles behaviour; custom units
store `headUserId` directly on the unit document.

Endpoints:
  GET    /api/v1/units/                        — List all units (static + custom)
  POST   /api/v1/units/                        — Create a custom unit
  PATCH  /api/v1/units/{unit_id}               — Update label / description / color
  DELETE /api/v1/units/{unit_id}               — Soft-delete a custom unit
  PATCH  /api/v1/units/{unit_id}/set-head      — Assign a user as head
  DELETE /api/v1/units/{unit_id}/head          — Remove head assignment
  GET    /api/v1/units/user-search             — Search users for head picker
"""

import re
from datetime import datetime, timezone

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field

from app.core.audit import AuditLogger
from app.core.permissions import get_current_session, require_permission
from app.db import get_database
from app.models.unit_application import UNIT_LABELS, UNIT_TO_HEAD_POSITION

router = APIRouter(prefix="/api/v1/units", tags=["units"])

# ── Pydantic schemas ─────────────────────────────────────────────

class UnitCreate(BaseModel):
    label: str = Field(..., min_length=2, max_length=80)
    description: str = Field("", max_length=500)
    colorKey: str = Field("slate", max_length=30)  # matches frontend UNIT_COLORS keys


class UnitUpdate(BaseModel):
    label: str | None = Field(None, min_length=2, max_length=80)
    description: str | None = Field(None, max_length=500)
    colorKey: str | None = Field(None, max_length=30)


class SetHeadPayload(BaseModel):
    userId: str


# ── Helpers ──────────────────────────────────────────────────────

def _slug_from_label(label: str) -> str:
    """Convert a display label to a URL-safe slug, e.g. 'My Unit' → 'my_unit'."""
    slug = label.lower().strip()
    slug = re.sub(r"[^a-z0-9]+", "_", slug)
    slug = slug.strip("_")
    return f"custom_{slug}"


def _serialize_unit(doc: dict) -> dict:
    doc["id"] = str(doc["_id"])
    doc["_id"] = str(doc["_id"])
    return doc


async def _static_unit_info(unit_slug: str, session_id: str, db) -> dict:
    """Build the basic info dict for a static (hardcoded) unit."""
    head_position = UNIT_TO_HEAD_POSITION.get(unit_slug)
    head = None
    if head_position:
        head_role = await db["roles"].find_one(
            {"position": head_position, "sessionId": session_id, "isActive": True}
        )
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
    return head


# ── Endpoints ────────────────────────────────────────────────────

@router.get("/user-search")
async def search_users_for_head(
    q: str = Query(..., min_length=2, description="Search query — name or email"),
    _=Depends(require_permission("unit_application:manage")),
):
    """
    Return up to 15 students/admins matching the query for use in the head picker.
    """
    db = get_database()
    regex = {"$regex": q, "$options": "i"}
    users = await db["users"].find(
        {
            "$or": [
                {"firstName": regex},
                {"lastName": regex},
                {"email": regex},
                {"matricNumber": regex},
            ]
        },
        {"firstName": 1, "lastName": 1, "email": 1, "matricNumber": 1,
         "currentLevel": 1, "profilePhotoURL": 1, "role": 1},
    ).limit(15).to_list(length=15)

    return [
        {
            "id": str(u["_id"]),
            "firstName": u.get("firstName", ""),
            "lastName": u.get("lastName", ""),
            "email": u.get("email", ""),
            "matricNumber": u.get("matricNumber", ""),
            "level": u.get("currentLevel", ""),
            "profilePhotoURL": u.get("profilePhotoURL"),
            "role": u.get("role", "student"),
        }
        for u in users
    ]


@router.get("/")
async def list_units(
    user=Depends(require_permission("unit_application:review")),
    session=Depends(get_current_session),
):
    """
    Return all units: built-in static units first, then custom DB units.
    Each item includes id/slug, label, description, colorKey, head info, isStatic.
    """
    db = get_database()
    session_id = str(session["_id"])

    result = []

    # 1. Static units
    for slug, label in UNIT_LABELS.items():
        head = await _static_unit_info(slug, session_id, db)
        # Fetch saved overrides (description / colorKey) if any
        override = await db["custom_units"].find_one(
            {"slug": slug, "isStatic": True}
        ) or {}
        result.append({
            "id": slug,          # Static units use slug as ID on frontend
            "slug": slug,
            "label": label,
            "description": override.get("description", ""),
            "colorKey": override.get("colorKey", slug),
            "head": head,
            "isStatic": True,
        })

    # 2. Custom units
    custom_cursor = db["custom_units"].find({"isStatic": {"$ne": True}, "isActive": True})
    customs = await custom_cursor.to_list(length=200)
    for doc in customs:
        head = None
        if doc.get("headUserId"):
            head_user = await db["users"].find_one(
                {"_id": ObjectId(doc["headUserId"])},
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
        result.append({
            "id": str(doc["_id"]),
            "slug": doc["slug"],
            "label": doc["label"],
            "description": doc.get("description", ""),
            "colorKey": doc.get("colorKey", "slate"),
            "head": head,
            "isStatic": False,
        })

    return result


@router.post("/", status_code=status.HTTP_201_CREATED)
async def create_unit(
    payload: UnitCreate,
    user=Depends(require_permission("unit_application:manage")),
):
    """Create a new custom unit/committee."""
    db = get_database()
    slug = _slug_from_label(payload.label)

    # Ensure slug is unique
    if slug in UNIT_LABELS or await db["custom_units"].find_one({"slug": slug, "isActive": True}):
        # Append a number to avoid collision
        count = await db["custom_units"].count_documents({"slug": {"$regex": f"^{slug}"}})
        slug = f"{slug}_{count + 1}"

    doc = {
        "slug": slug,
        "label": payload.label.strip(),
        "description": payload.description.strip(),
        "colorKey": payload.colorKey,
        "headUserId": None,
        "isActive": True,
        "isStatic": False,
        "createdBy": str(user.get("_id", user.get("id", ""))),
        "createdAt": datetime.now(timezone.utc),
        "updatedAt": datetime.now(timezone.utc),
    }
    result = await db["custom_units"].insert_one(doc)

    await AuditLogger.log(
        action="unit_created",
        actor_id=str(user.get("_id", user.get("id", ""))),
        actor_email=user.get("email", ""),
        resource_type="unit",
        resource_id=str(result.inserted_id),
        details={"slug": slug, "label": payload.label},
    )

    return {"id": str(result.inserted_id), "slug": slug, "label": payload.label}


@router.patch("/{unit_id}")
async def update_unit(
    unit_id: str,
    payload: UnitUpdate,
    user=Depends(require_permission("unit_application:manage")),
):
    """Update label, description, or colorKey of any unit (static or custom)."""
    db = get_database()
    updates: dict = {"updatedAt": datetime.now(timezone.utc)}

    if payload.label is not None:
        updates["label"] = payload.label.strip()
    if payload.description is not None:
        updates["description"] = payload.description.strip()
    if payload.colorKey is not None:
        updates["colorKey"] = payload.colorKey

    # Static units: store overrides in custom_units with isStatic=True
    if unit_id in UNIT_LABELS:
        await db["custom_units"].update_one(
            {"slug": unit_id, "isStatic": True},
            {"$set": updates, "$setOnInsert": {"slug": unit_id, "isStatic": True}},
            upsert=True,
        )
        return {"updated": True}

    # Custom units
    if not ObjectId.is_valid(unit_id):
        raise HTTPException(status_code=400, detail="Invalid unit ID")

    res = await db["custom_units"].update_one(
        {"_id": ObjectId(unit_id), "isActive": True, "isStatic": {"$ne": True}},
        {"$set": updates},
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Unit not found")

    await AuditLogger.log(
        action="unit_updated",
        actor_id=str(user.get("_id", user.get("id", ""))),
        actor_email=user.get("email", ""),
        resource_type="unit",
        resource_id=unit_id,
        details={"changes": {k: v for k, v in updates.items() if k != "updatedAt"}},
    )
    return {"updated": True}


@router.delete("/{unit_id}")
async def delete_unit(
    unit_id: str,
    user=Depends(require_permission("unit_application:manage")),
    session=Depends(get_current_session),
):
    """
    Soft-delete a custom unit.
    Raises 400 if the unit still has active members.
    Static (built-in) units cannot be deleted.
    """
    if unit_id in UNIT_LABELS:
        raise HTTPException(status_code=400, detail="Built-in units cannot be deleted")

    if not ObjectId.is_valid(unit_id):
        raise HTTPException(status_code=400, detail="Invalid unit ID")

    db = get_database()
    unit_doc = await db["custom_units"].find_one(
        {"_id": ObjectId(unit_id), "isActive": True, "isStatic": {"$ne": True}}
    )
    if not unit_doc:
        raise HTTPException(status_code=404, detail="Unit not found")

    # Check active members
    session_id = str(session["_id"])
    active_members = await db["unit_applications"].count_documents({
        "unit": unit_doc["slug"],
        "sessionId": session_id,
        "status": "accepted",
    })
    if active_members > 0:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot delete — unit still has {active_members} active member(s). Revoke them first.",
        )

    await db["custom_units"].update_one(
        {"_id": ObjectId(unit_id)},
        {"$set": {"isActive": False, "updatedAt": datetime.now(timezone.utc)}},
    )

    await AuditLogger.log(
        action="unit_deleted",
        actor_id=str(user.get("_id", user.get("id", ""))),
        actor_email=user.get("email", ""),
        resource_type="unit",
        resource_id=unit_id,
        details={"slug": unit_doc["slug"], "label": unit_doc["label"]},
    )
    return {"deleted": True}


@router.patch("/{unit_id}/set-head")
async def set_unit_head(
    unit_id: str,
    payload: SetHeadPayload,
    user=Depends(require_permission("unit_application:manage")),
    session=Depends(get_current_session),
):
    """
    Assign a user as the head of a unit.

    - For static units: creates (or updates) a role record using the mapped
      head-position so it integrates with the existing roles/permissions system.
    - For custom units: stores headUserId directly on the unit document.
    """
    db = get_database()
    if not ObjectId.is_valid(payload.userId):
        raise HTTPException(status_code=400, detail="Invalid user ID")

    head_user = await db["users"].find_one(
        {"_id": ObjectId(payload.userId)},
        {"firstName": 1, "lastName": 1, "email": 1},
    )
    if not head_user:
        raise HTTPException(status_code=404, detail="User not found")

    session_id = str(session["_id"])

    if unit_id in UNIT_LABELS:
        # Static unit: use the roles collection
        from app.models.unit_application import UNIT_TO_HEAD_POSITION
        head_position = UNIT_TO_HEAD_POSITION.get(unit_id)
        if not head_position:
            raise HTTPException(status_code=400, detail="No head position defined for this unit")

        # Deactivate any existing head role for this position + session
        await db["roles"].update_many(
            {"position": head_position, "sessionId": session_id, "isActive": True},
            {"$set": {"isActive": False, "updatedAt": datetime.now(timezone.utc)}},
        )

        # Create new head role
        await db["roles"].insert_one({
            "userId": payload.userId,
            "position": head_position,
            "sessionId": session_id,
            "isActive": True,
            "assignedBy": str(user.get("_id", user.get("id", ""))),
            "createdAt": datetime.now(timezone.utc),
            "updatedAt": datetime.now(timezone.utc),
        })

        # Invalidate permissions cache for the new head
        from app.core.permissions import invalidate_permissions_cache
        invalidate_permissions_cache(payload.userId)

    else:
        # Custom unit: store headUserId on doc AND create a role record
        if not ObjectId.is_valid(unit_id):
            raise HTTPException(status_code=400, detail="Invalid unit ID")

        unit_doc = await db["custom_units"].find_one(
            {"_id": ObjectId(unit_id), "isActive": True}
        )
        if not unit_doc:
            raise HTTPException(status_code=404, detail="Unit not found")

        # Update the headUserId on the unit doc
        await db["custom_units"].update_one(
            {"_id": ObjectId(unit_id)},
            {"$set": {"headUserId": payload.userId, "updatedAt": datetime.now(timezone.utc)}},
        )

        # Create a role record so the head gets permissions
        head_position = f"unit_head_custom_{unit_doc['slug']}"

        # Deactivate any previous head role for this custom unit
        await db["roles"].update_many(
            {"position": head_position, "sessionId": session_id, "isActive": True},
            {"$set": {"isActive": False, "updatedAt": datetime.now(timezone.utc)}},
        )

        await db["roles"].insert_one({
            "userId": payload.userId,
            "position": head_position,
            "sessionId": session_id,
            "isActive": True,
            "assignedBy": str(user.get("_id", user.get("id", ""))),
            "createdAt": datetime.now(timezone.utc),
            "updatedAt": datetime.now(timezone.utc),
        })

        from app.core.permissions import invalidate_permissions_cache
        invalidate_permissions_cache(payload.userId)

    await AuditLogger.log(
        action="unit_head_assigned",
        actor_id=str(user.get("_id", user.get("id", ""))),
        actor_email=user.get("email", ""),
        resource_type="unit",
        resource_id=unit_id,
        details={
            "newHeadUserId": payload.userId,
            "newHeadName": f"{head_user.get('firstName', '')} {head_user.get('lastName', '')}".strip(),
        },
    )
    return {
        "updated": True,
        "head": {
            "userId": payload.userId,
            "firstName": head_user.get("firstName", ""),
            "lastName": head_user.get("lastName", ""),
            "email": head_user.get("email", ""),
        },
    }


@router.delete("/{unit_id}/head")
async def remove_unit_head(
    unit_id: str,
    user=Depends(require_permission("unit_application:manage")),
    session=Depends(get_current_session),
):
    """Remove the head assignment from a unit."""
    db = get_database()
    session_id = str(session["_id"])

    if unit_id in UNIT_LABELS:
        from app.models.unit_application import UNIT_TO_HEAD_POSITION
        head_position = UNIT_TO_HEAD_POSITION.get(unit_id)
        if not head_position:
            raise HTTPException(status_code=400, detail="No head position defined for this unit")
        await db["roles"].update_many(
            {"position": head_position, "sessionId": session_id, "isActive": True},
            {"$set": {"isActive": False, "updatedAt": datetime.now(timezone.utc)}},
        )
    else:
        if not ObjectId.is_valid(unit_id):
            raise HTTPException(status_code=400, detail="Invalid unit ID")
        unit_doc = await db["custom_units"].find_one(
            {"_id": ObjectId(unit_id), "isActive": True}
        )
        if not unit_doc:
            raise HTTPException(status_code=404, detail="Unit not found")

        # Clear headUserId on unit doc
        await db["custom_units"].update_one(
            {"_id": ObjectId(unit_id)},
            {"$set": {"headUserId": None, "updatedAt": datetime.now(timezone.utc)}},
        )

        # Deactivate the custom unit head role
        head_position = f"unit_head_custom_{unit_doc['slug']}"
        old_roles = await db["roles"].find(
            {"position": head_position, "sessionId": session_id, "isActive": True}
        ).to_list(length=10)
        if old_roles:
            await db["roles"].update_many(
                {"position": head_position, "sessionId": session_id, "isActive": True},
                {"$set": {"isActive": False, "updatedAt": datetime.now(timezone.utc)}},
            )
            from app.core.permissions import invalidate_permissions_cache
            for r in old_roles:
                invalidate_permissions_cache(r["userId"])

    await AuditLogger.log(
        action="unit_head_removed",
        actor_id=str(user.get("_id", user.get("id", ""))),
        actor_email=user.get("email", ""),
        resource_type="unit",
        resource_id=unit_id,
        details={},
    )
    return {"updated": True}
