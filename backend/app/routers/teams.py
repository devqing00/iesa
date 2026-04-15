"""
Teams Management Router

Allows admins to create, edit, and delete custom teams beyond the built-in
registry (ICS, Conference, etc.). Also supports assigning/removing a team head
for any team (built-in or custom).

Built-in teams keep their existing head-via-roles behaviour; custom teams
store ``headUserId`` directly on the team document.

Endpoints:
  GET    /api/v1/teams/                        — List all teams (built-in + custom)
  GET    /api/v1/teams/registry                 — Public team registry for applications
  POST   /api/v1/teams/                        — Create a custom team
  PATCH  /api/v1/teams/{team_id}               — Update label / description / color
  DELETE /api/v1/teams/{team_id}               — Soft-delete a custom team
  PATCH  /api/v1/teams/{team_id}/set-head      — Assign a user as head
  DELETE /api/v1/teams/{team_id}/head          — Remove head assignment
  GET    /api/v1/teams/user-search             — Search users for head picker
"""

import re
from datetime import datetime, timezone

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field

from app.core.audit import AuditLogger
from app.core.permissions import get_current_session, require_permission, normalize_permissions
from app.core.security import get_current_user
from app.db import get_database
from app.models.team_application import (
    TEAM_LABELS,
    TEAM_REGISTRY,
    TEAM_ROLE_MAP,
    TEAM_TO_HEAD_POSITION,
    HEAD_POSITION_TO_TEAM,
)

router = APIRouter(prefix="/api/v1/teams", tags=["teams"])

# ── Pydantic schemas ─────────────────────────────────────────────

class TeamCreate(BaseModel):
    label: str = Field(..., min_length=2, max_length=80)
    description: str = Field("", max_length=500)
    colorKey: str = Field("slate", max_length=30)
    memberPermissions: list[str] = Field(default_factory=lambda: ["announcement:view", "event:view"])


class TeamUpdate(BaseModel):
    label: str | None = Field(None, min_length=2, max_length=80)
    description: str | None = Field(None, max_length=500)
    colorKey: str | None = Field(None, max_length=30)
    memberPermissions: list[str] | None = None


class SetHeadPayload(BaseModel):
    userId: str


# ── Helpers ──────────────────────────────────────────────────────

def _slug_from_label(label: str) -> str:
    """Convert a display label to a URL-safe slug, e.g. 'My Team' → 'custom_my_team'."""
    slug = label.lower().strip()
    slug = re.sub(r"[^a-z0-9]+", "_", slug)
    slug = slug.strip("_")
    return f"custom_{slug}"


def _serialize_team(doc: dict) -> dict:
    doc["id"] = str(doc["_id"])
    doc["_id"] = str(doc["_id"])
    return doc


ALLOWED_CUSTOM_MEMBER_PERMISSIONS = {
    "announcement:view",
    "event:view",
    "resource:view",
    "timetable:view",
    "press:access",
}


def _validate_member_permissions(permissions: list[str] | None) -> list[str]:
    requested = normalize_permissions(permissions or ["announcement:view", "event:view"])
    invalid = [permission for permission in requested if permission not in ALLOWED_CUSTOM_MEMBER_PERMISSIONS]
    if invalid:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid custom-member permissions: {', '.join(invalid)}",
        )
    return requested


async def _builtin_team_head(team_slug: str, session_id: str, db) -> dict | None:
    """Fetch head info for a built-in team via the roles collection."""
    head_position = TEAM_TO_HEAD_POSITION.get(team_slug)
    if not head_position:
        return None
    head_role = await db["roles"].find_one(
        {"position": head_position, "sessionId": session_id, "isActive": True}
    )
    if not head_role:
        return None
    head_user = await db["users"].find_one(
        {"_id": ObjectId(head_role["userId"])},
        {"firstName": 1, "lastName": 1, "email": 1, "profilePhotoURL": 1, "gender": 1, "sex": 1},
    )
    if not head_user:
        return None
    return {
        "userId": str(head_user["_id"]),
        "firstName": head_user.get("firstName", ""),
        "lastName": head_user.get("lastName", ""),
        "email": head_user.get("email", ""),
        "gender": head_user.get("gender") or head_user.get("sex"),
        "profilePhotoURL": head_user.get("profilePhotoURL"),
    }


# ── Endpoints ────────────────────────────────────────────────────

@router.get("/user-search")
async def search_users_for_head(
    q: str = Query(..., min_length=2, description="Search query — name or email"),
    _=Depends(require_permission("team:manage")),
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
            "currentLevel": 1, "profilePhotoURL": 1, "role": 1, "gender": 1, "sex": 1},
    ).limit(15).to_list(length=15)

    return [
        {
            "id": str(u["_id"]),
            "firstName": u.get("firstName", ""),
            "lastName": u.get("lastName", ""),
            "email": u.get("email", ""),
            "matricNumber": u.get("matricNumber", ""),
            "level": u.get("currentLevel", ""),
            "gender": u.get("gender") or u.get("sex"),
            "profilePhotoURL": u.get("profilePhotoURL"),
            "role": u.get("role", "student"),
        }
        for u in users
    ]


@router.get("/registry")
async def team_registry(
    user=Depends(get_current_user),
):
    """
    Public team registry — returns all built-in teams with their configuration
    (label, description, colorKey, sub-teams, custom questions, etc.).
    Also includes any admin-created custom teams.
    Used by the student applications page to render team cards dynamically.
    """
    db = get_database()

    # Built-in teams from TEAM_REGISTRY
    result = []
    for slug, cfg in TEAM_REGISTRY.items():
        # Check for admin overrides in DB
        override = await db["custom_units"].find_one(
            {"slug": slug, "isStatic": True}
        ) or {}
        result.append({
            "slug": slug,
            "label": cfg["label"],
            "description": override.get("description") or cfg["description"],
            "colorKey": override.get("colorKey") or cfg["colorKey"],
            "memberPermissions": cfg.get("memberPermissions", []),
            "requiresSkills": cfg.get("requiresSkills", False),
            "subTeams": cfg.get("subTeams"),
            "customQuestions": cfg.get("customQuestions"),
            "isHub": cfg.get("isHub", False),
            "hubPath": cfg.get("hubPath"),
            "isBuiltIn": True,
        })

    # Custom teams from DB
    custom_cursor = db["custom_units"].find({"isStatic": {"$ne": True}, "isActive": True})
    customs = await custom_cursor.to_list(length=200)
    for doc in customs:
        result.append({
            "slug": doc["slug"],
            "label": doc["label"],
            "description": doc.get("description", ""),
            "colorKey": doc.get("colorKey", "slate"),
            "memberPermissions": doc.get("memberPermissions", ["announcement:view", "event:view"]),
            "requiresSkills": doc.get("requiresSkills", False),
            "subTeams": doc.get("subTeams"),
            "customQuestions": doc.get("customQuestions"),
            "isHub": False,
            "hubPath": None,
            "isBuiltIn": False,
        })

    return result


@router.get("/")
async def list_teams(
    user=Depends(require_permission("team:review")),
    session=Depends(get_current_session),
):
    """
    Return all teams: built-in teams first, then custom teams.
    Each item includes id/slug, label, description, colorKey, head info, isBuiltIn.
    """
    db = get_database()
    session_id = str(session["_id"])

    result = []

    # 1. Built-in teams
    for slug, label in TEAM_LABELS.items():
        head = await _builtin_team_head(slug, session_id, db)
        # Fetch saved overrides (description / colorKey) if any
        override = await db["custom_units"].find_one(
            {"slug": slug, "isStatic": True}
        ) or {}
        registry_entry = TEAM_REGISTRY.get(slug, {})
        result.append({
            "id": slug,
            "slug": slug,
            "label": label,
            "description": override.get("description") or registry_entry.get("description", ""),
            "colorKey": override.get("colorKey") or registry_entry.get("colorKey", slug),
            "memberPermissions": registry_entry.get("memberPermissions", []),
            "head": head,
            "isBuiltIn": True,
            "isStatic": True,  # backward compat
        })

    # 2. Custom teams
    custom_cursor = db["custom_units"].find({"isStatic": {"$ne": True}, "isActive": True})
    customs = await custom_cursor.to_list(length=200)
    for doc in customs:
        head = None
        if doc.get("headUserId"):
            head_user = await db["users"].find_one(
                {"_id": ObjectId(doc["headUserId"])},
                {"firstName": 1, "lastName": 1, "email": 1, "profilePhotoURL": 1, "gender": 1, "sex": 1},
            )
            if head_user:
                head = {
                    "userId": str(head_user["_id"]),
                    "firstName": head_user.get("firstName", ""),
                    "lastName": head_user.get("lastName", ""),
                    "email": head_user.get("email", ""),
                    "gender": head_user.get("gender") or head_user.get("sex"),
                    "profilePhotoURL": head_user.get("profilePhotoURL"),
                }
        result.append({
            "id": str(doc["_id"]),
            "slug": doc["slug"],
            "label": doc["label"],
            "description": doc.get("description", ""),
            "colorKey": doc.get("colorKey", "slate"),
            "memberPermissions": doc.get("memberPermissions", ["announcement:view", "event:view"]),
            "head": head,
            "isBuiltIn": False,
            "isStatic": False,
        })

    return result


@router.post("/", status_code=status.HTTP_201_CREATED)
async def create_team(
    payload: TeamCreate,
    user=Depends(require_permission("team:manage")),
):
    """Create a new custom team.."""
    db = get_database()
    slug = _slug_from_label(payload.label)

    # Ensure slug is unique
    if slug in TEAM_LABELS or await db["custom_units"].find_one({"slug": slug, "isActive": True}):
        # Append a number to avoid collision
        count = await db["custom_units"].count_documents({"slug": {"$regex": f"^{slug}"}})
        slug = f"{slug}_{count + 1}"

    member_permissions = _validate_member_permissions(payload.memberPermissions)

    doc = {
        "slug": slug,
        "label": payload.label.strip(),
        "description": payload.description.strip(),
        "colorKey": payload.colorKey,
        "memberPermissions": member_permissions,
        "headUserId": None,
        "isActive": True,
        "isStatic": False,
        "createdBy": str(user.get("_id", user.get("id", ""))),
        "createdAt": datetime.now(timezone.utc),
        "updatedAt": datetime.now(timezone.utc),
    }
    result = await db["custom_units"].insert_one(doc)

    await AuditLogger.log(
        action="team_created",
        actor_id=str(user.get("_id", user.get("id", ""))),
        actor_email=user.get("email", ""),
        resource_type="team",
        resource_id=str(result.inserted_id),
        details={"slug": slug, "label": payload.label, "memberPermissions": member_permissions},
    )

    return {"id": str(result.inserted_id), "slug": slug, "label": payload.label}


@router.patch("/{team_id}")
async def update_team(
    team_id: str,
    payload: TeamUpdate,
    session=Depends(get_current_session),
    user=Depends(require_permission("team:manage")),
):
    """Update label, description, or colorKey of any team (built-in or custom).."""
    db = get_database()
    updates: dict = {"updatedAt": datetime.now(timezone.utc)}

    if payload.label is not None:
        updates["label"] = payload.label.strip()
    if payload.description is not None:
        updates["description"] = payload.description.strip()
    if payload.colorKey is not None:
        updates["colorKey"] = payload.colorKey
    if payload.memberPermissions is not None:
        updates["memberPermissions"] = _validate_member_permissions(payload.memberPermissions)

    # Built-in teams: store overrides in custom_units with isStatic=True
    if team_id in TEAM_LABELS:
        await db["custom_units"].update_one(
            {"slug": team_id, "isStatic": True},
            {"$set": updates, "$setOnInsert": {"slug": team_id, "isStatic": True}},
            upsert=True,
        )
        return {"updated": True}

    # Custom teams
    if not ObjectId.is_valid(team_id):
        raise HTTPException(status_code=400, detail="Invalid team ID")

    res = await db["custom_units"].update_one(
        {"_id": ObjectId(team_id), "isActive": True, "isStatic": {"$ne": True}},
        {"$set": updates},
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Team not found")

    if "memberPermissions" in updates:
        custom_doc = await db["custom_units"].find_one({"_id": ObjectId(team_id)})
        if custom_doc:
            slug = custom_doc.get("slug")
            positions = [f"team_member_custom_{slug}", f"unit_member_custom_{slug}"]
            await db["roles"].update_many(
                {
                    "position": {"$in": positions},
                    "isActive": True,
                },
                {
                    "$set": {
                        "permissions": updates["memberPermissions"],
                        "updatedAt": datetime.now(timezone.utc),
                    }
                },
            )

    await AuditLogger.log(
        action="team_updated",
        actor_id=str(user.get("_id", user.get("id", ""))),
        actor_email=user.get("email", ""),
        resource_type="team",
        resource_id=team_id,
        details={"changes": {k: v for k, v in updates.items() if k != "updatedAt"}},
    )
    return {"updated": True}


@router.delete("/{team_id}")
async def delete_team(
    team_id: str,
    user=Depends(require_permission("team:manage")),
    session=Depends(get_current_session),
):
    """
    Soft-delete a custom team.
    Raises 400 if the team still has active members.
    Built-in teams cannot be deleted.
    """
    if team_id in TEAM_LABELS:
        raise HTTPException(status_code=400, detail="Built-in teams cannot be deleted")

    if not ObjectId.is_valid(team_id):
        raise HTTPException(status_code=400, detail="Invalid team ID")

    db = get_database()
    unit_doc = await db["custom_units"].find_one(
        {"_id": ObjectId(team_id), "isActive": True, "isStatic": {"$ne": True}}
    )
    if not unit_doc:
        raise HTTPException(status_code=404, detail="Team not found")

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
            detail=f"Cannot delete — team still has {active_members} active member(s). Revoke them first.",
        )

    await db["custom_units"].update_one(
        {"_id": ObjectId(team_id)},
        {"$set": {"isActive": False, "updatedAt": datetime.now(timezone.utc)}},
    )

    await AuditLogger.log(
        action="team_deleted",
        actor_id=str(user.get("_id", user.get("id", ""))),
        actor_email=user.get("email", ""),
        resource_type="team",
        resource_id=team_id,
        details={"slug": unit_doc["slug"], "label": unit_doc["label"]},
    )
    return {"deleted": True}


@router.patch("/{team_id}/set-head")
async def set_team_head(
    team_id: str,
    payload: SetHeadPayload,
    user=Depends(require_permission("team:manage")),
    session=Depends(get_current_session),
):
    """
    Assign a user as the head of a team.

    - For built-in teams: creates (or updates) a role record using the mapped
      head-position so it integrates with the existing roles/permissions system.
    - For custom teams: stores headUserId directly on the team document.
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

    if team_id in TEAM_LABELS:
        # Built-in team: use the roles collection
        from app.models.team_application import TEAM_TO_HEAD_POSITION
        head_position = TEAM_TO_HEAD_POSITION.get(team_id)
        if not head_position:
            raise HTTPException(status_code=400, detail="No head position defined for this team")

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
        # Custom team: store headUserId on doc AND create a role record
        if not ObjectId.is_valid(team_id):
            raise HTTPException(status_code=400, detail="Invalid team ID")

        unit_doc = await db["custom_units"].find_one(
            {"_id": ObjectId(team_id), "isActive": True}
        )
        if not unit_doc:
            raise HTTPException(status_code=404, detail="Team not found")

        # Update the headUserId on the team doc
        await db["custom_units"].update_one(
            {"_id": ObjectId(team_id)},
            {"$set": {"headUserId": payload.userId, "updatedAt": datetime.now(timezone.utc)}},
        )

        # Create a role record so the head gets permissions
        head_position = f"team_head_custom_{unit_doc['slug']}"

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
        action="team_head_assigned",
        actor_id=str(user.get("_id", user.get("id", ""))),
        actor_email=user.get("email", ""),
        resource_type="team",
        resource_id=team_id,
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


@router.delete("/{team_id}/head")
async def remove_team_head(
    team_id: str,
    user=Depends(require_permission("team:manage")),
    session=Depends(get_current_session),
):
    """Remove the head assignment from a team."""
    db = get_database()
    session_id = str(session["_id"])

    if team_id in TEAM_LABELS:
        from app.models.team_application import TEAM_TO_HEAD_POSITION
        head_position = TEAM_TO_HEAD_POSITION.get(team_id)
        if not head_position:
            raise HTTPException(status_code=400, detail="No head position defined for this team")
        await db["roles"].update_many(
            {"position": head_position, "sessionId": session_id, "isActive": True},
            {"$set": {"isActive": False, "updatedAt": datetime.now(timezone.utc)}},
        )
    else:
        if not ObjectId.is_valid(team_id):
            raise HTTPException(status_code=400, detail="Invalid team ID")
        unit_doc = await db["custom_units"].find_one(
            {"_id": ObjectId(team_id), "isActive": True}
        )
        if not unit_doc:
            raise HTTPException(status_code=404, detail="Team not found")

        # Clear headUserId on team doc
        await db["custom_units"].update_one(
            {"_id": ObjectId(team_id)},
            {"$set": {"headUserId": None, "updatedAt": datetime.now(timezone.utc)}},
        )

        # Deactivate the custom unit head role
        head_position = f"team_head_custom_{unit_doc['slug']}"
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
        action="team_head_removed",
        actor_id=str(user.get("_id", user.get("id", ""))),
        actor_email=user.get("email", ""),
        resource_type="team",
        resource_id=team_id,
        details={},
    )
    return {"updated": True}
