"""
Team Applications Router

Endpoints:
  POST   /api/v1/team-applications/                  — Student submits an application
  GET    /api/v1/team-applications/my                 — Student views their own applications
  GET    /api/v1/team-applications/                    — Reviewer views applications (unit-scoped)
  PATCH  /api/v1/team-applications/{id}/review         — Reviewer reviews (accept/reject)
  GET    /api/v1/team-applications/overview             — Units overview (heads + members + stats)
  GET    /api/v1/team-applications/settings             — Get unit settings for current session
  PATCH  /api/v1/team-applications/settings/{unit}     — Update unit settings (scoped)
  PATCH  /api/v1/team-applications/{id}/revoke          — Revoke accepted membership
"""

import asyncio
import re

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from app.core.error_handling import fire_and_forget
from typing import Optional
from datetime import datetime, timezone
from bson import ObjectId

from app.core.security import get_current_user, require_ipe_student
from app.core.permissions import (
    get_current_session,
    require_permission,
    invalidate_permissions_cache,
)
from app.core.audit import AuditLogger
from app.db import get_database
from app.routers.notifications import create_notification, create_bulk_notifications
from app.models.team_application import (
    TeamApplicationCreate,
    TeamApplicationReview,
    TeamApplicationResponse,
    TeamSettingsUpdate,
    
    TEAM_LABELS,
    TEAM_ROLE_MAP,
    HEAD_POSITION_TO_TEAM,
    TEAM_TO_HEAD_POSITION,
    GLOBAL_REVIEW_POSITIONS,
)

router = APIRouter(prefix="/api/v1/team-applications", tags=["team-applications"])


# ── Helpers ──────────────────────────────────────────────────────

def _serialize(doc: dict) -> dict:
    doc["id"] = str(doc["_id"])
    doc["team"] = doc.get("unit", "")  # DB field is still "unit", expose as "team"
    doc["teamLabel"] = TEAM_LABELS.get(doc.get("unit", ""), doc.get("unit", ""))
    return doc


async def _get_reviewer_teams(user_id: str, session_id: str) -> list[str] | None:
    """
    Return team slugs this reviewer can manage.
    - None  → global access (all teams)
    - []    → no teams (shouldn't happen but safe)
    - [...]  → specific team slugs
    """
    db = get_database()
    cursor = db["roles"].find({
        "userId": user_id,
        "isActive": True,
        "$or": [
            {"sessionId": session_id},
            {"position": "super_admin"},
        ],
    })
    roles = await cursor.to_list(length=None)
    positions = {r["position"] for r in roles}

    if positions & GLOBAL_REVIEW_POSITIONS:
        return None  # All units

    allowed: list[str] = []
    for pos in positions:
        unit = HEAD_POSITION_TO_TEAM.get(pos)
        if unit:
            allowed.append(unit)
    return allowed


async def _ensure_team_application_reviewer(user: dict, session_id: str) -> list[str] | None:
    """Validate user is allowed to review team applications.

    Returns reviewer scope:
    - None => global reviewer (all teams)
    - [..] => scoped teams for team head
    Raises 403 when user has no review scope.
    """
    user_id = user.get("_id") or user.get("id")
    allowed_teams = await _get_reviewer_teams(user_id, session_id)
    if allowed_teams is not None and not allowed_teams:
        raise HTTPException(403, "Team application review permissions required")
    return allowed_teams


async def _get_team_settings(db, unit: str, session_id: str) -> dict:
    """Get team settings, defaulting to unlimited/open if not configured."""
    doc = await db["unit_settings"].find_one({"unit": unit, "sessionId": session_id})
    return {
        "maxMembers": doc.get("maxMembers", 0) if doc else 0,  # 0 = unlimited
        "isOpen": doc.get("isOpen", True) if doc else True,
    }


async def _resolve_member_role_info(db, unit: str) -> dict | None:
    """Return role info for team members (position + permissions) for built-in or custom teams."""
    role_info = TEAM_ROLE_MAP.get(unit)
    if role_info:
        return role_info

    custom_team = await db["custom_units"].find_one({"slug": unit, "isActive": True})
    if not custom_team:
        return None

    return {
        "position": f"team_member_custom_{unit}",
        "permissions": custom_team.get("memberPermissions") or ["announcement:view", "event:view"],
    }


async def _count_active_members(db, unit: str, session_id: str) -> int:
    """Count active role holders for a unit in this session."""
    role_info = await _resolve_member_role_info(db, unit)
    if not role_info:
        return 0

    positions = {role_info["position"]}
    if role_info["position"].startswith("team_member_custom_"):
        positions.add(role_info["position"].replace("team_member_custom_", "unit_member_custom_", 1))

    return await db["roles"].count_documents({
        "position": {"$in": list(positions)},
        "sessionId": session_id,
        "isActive": True,
    })


async def _notify_reviewers_bg(unit: str, session_id: str, student_name: str, app_id: str):
    """Fire-and-forget: notify users who can review this unit's applications."""
    try:
        db = get_database()
        head_position = TEAM_TO_HEAD_POSITION.get(unit)
        target_positions = list(GLOBAL_REVIEW_POSITIONS)
        if head_position:
            target_positions.append(head_position)

        cursor = db["roles"].find({
            "position": {"$in": target_positions},
            "isActive": True,
            "$or": [
                {"sessionId": session_id},
                {"position": "super_admin"},
            ],
        })
        roles = await cursor.to_list(length=None)
        reviewer_ids = list({r["userId"] for r in roles})

        if reviewer_ids:
            unit_label = TEAM_LABELS.get(unit, unit)
            await create_bulk_notifications(
                user_ids=reviewer_ids,
                type="team_application",
                title="New Team Application",
                message=f"{student_name} applied to join {unit_label}",
                link="/admin/teams",
                related_id=app_id,
            )
    except Exception:
        pass  # Non-critical


# ── Endpoints ────────────────────────────────────────────────────

@router.post("/", response_model=TeamApplicationResponse)
async def create_application(
    body: TeamApplicationCreate,
    user=Depends(require_ipe_student),
    session=Depends(get_current_session),
):
    db = get_database()
    user_id = user.get("_id") or user.get("id")
    session_id = str(session["_id"])

    # ── Validate team slug exists ────────────────────────────────
    team_slug = body.team
    # Check built-in teams first, then custom teams in DB
    if team_slug not in TEAM_LABELS:
        custom_team = await db["custom_units"].find_one(
            {"slug": team_slug, "isActive": True, "isStatic": {"$ne": True}}
        )
        if not custom_team:
            raise HTTPException(400, f"Team '{team_slug}' not found")

    # ── Check if team is open and has capacity ───────────────────
    settings = await _get_team_settings(db, team_slug, session_id)
    if not settings["isOpen"]:
        raise HTTPException(400, f"{TEAM_LABELS.get(team_slug, team_slug)} is not accepting applications")

    if settings["maxMembers"] > 0:
        current_count = await _count_active_members(db, team_slug, session_id)
        if current_count >= settings["maxMembers"]:
            raise HTTPException(400, f"{TEAM_LABELS.get(team_slug, team_slug)} is full")

    # ── Duplicate check ──────────────────────────────────────────
    existing = await db["unit_applications"].find_one({
        "userId": user_id,
        "unit": team_slug,
        "sessionId": session_id,
        "status": {"$in": ["pending", "accepted"]},
    })
    if existing:
        if existing["status"] == "pending":
            raise HTTPException(400, "You already have a pending application for this team")
        else:
            raise HTTPException(400, "You are already a member of this team")

    now = datetime.now(timezone.utc)
    student_name = f"{user.get('firstName', '')} {user.get('lastName', '')}".strip()
    doc = {
        "userId": user_id,
        "userName": student_name,
        "userEmail": user.get("email", ""),
        "userLevel": user.get("currentLevel") or user.get("level"),
        "userGender": user.get("gender") or user.get("sex"),
        "unit": team_slug,
        "motivation": body.motivation,
        "skills": body.skills,
        "subTeam": body.subTeam,
        "customAnswers": body.customAnswers,
        "status": "pending",
        "feedback": None,
        "rejectionTag": None,
        "reviewedBy": None,
        "reviewerName": None,
        "sessionId": session_id,
        "createdAt": now,
        "reviewedAt": None,
    }

    result = await db["unit_applications"].insert_one(doc)
    doc["_id"] = result.inserted_id

    # Notify reviewers (fire-and-forget)
    fire_and_forget(
        _notify_reviewers_bg(team_slug, session_id, student_name, str(result.inserted_id))
    )

    return TeamApplicationResponse(**_serialize(doc))


@router.get("/my", response_model=list[TeamApplicationResponse])
async def my_applications(
    user=Depends(require_ipe_student),
    session=Depends(get_current_session),
):
    db = get_database()
    user_id = user.get("_id") or user.get("id")
    session_id = str(session["_id"])

    cursor = db["unit_applications"].find({
        "userId": user_id,
        "sessionId": session_id,
    }).sort("createdAt", -1)

    docs = await cursor.to_list(length=100)
    return [TeamApplicationResponse(**_serialize(d)) for d in docs]


@router.get("/overview")
async def teams_overview(
    user=Depends(get_current_user),
    session=Depends(get_current_session),
):
    """
    Return all teams with their head, members, settings, and pending application count.
    Scoped: committee heads see only their unit(s); global reviewers see all.
    """
    db = get_database()
    session_id = str(session["_id"])
    allowed_teams = await _ensure_team_application_reviewer(user, session_id)
    team_slugs = list(TEAM_LABELS.keys())
    if allowed_teams is not None:
        team_slugs = [u for u in team_slugs if u in allowed_teams]

    result = []
    for team in team_slugs:
        team_label = TEAM_LABELS[team]
        role_info = TEAM_ROLE_MAP.get(team, {})
        head_position = TEAM_TO_HEAD_POSITION.get(team)

        # Head
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
                    {"firstName": 1, "lastName": 1, "email": 1, "matricNumber": 1, "profilePhotoURL": 1, "gender": 1, "sex": 1},
                )
                if head_user:
                    head = {
                        "id": str(head_user["_id"]),
                        "firstName": head_user.get("firstName", ""),
                        "lastName": head_user.get("lastName", ""),
                        "email": head_user.get("email", ""),
                        "matricNumber": head_user.get("matricNumber", ""),
                        "gender": head_user.get("gender") or head_user.get("sex"),
                        "profilePhotoURL": head_user.get("profilePhotoURL", ""),
                    }

        # Members
        members = []
        member_position = role_info.get("position")
        if member_position:
            member_roles = await db["roles"].find({
                "position": member_position,
                "sessionId": session_id,
                "isActive": True,
            }).to_list(length=500)

            if member_roles:
                member_user_ids = [ObjectId(r["userId"]) for r in member_roles]
                member_users = await db["users"].find(
                    {"_id": {"$in": member_user_ids}},
                    {"firstName": 1, "lastName": 1, "email": 1, "matricNumber": 1, "currentLevel": 1, "profilePhotoURL": 1, "gender": 1, "sex": 1},
                ).to_list(length=500)
                user_map = {str(u["_id"]): u for u in member_users}

                for r in member_roles:
                    u = user_map.get(r["userId"])
                    if u:
                        members.append({
                            "id": str(u["_id"]),
                            "roleId": str(r["_id"]),
                            "firstName": u.get("firstName", ""),
                            "lastName": u.get("lastName", ""),
                            "email": u.get("email", ""),
                            "matricNumber": u.get("matricNumber", ""),
                            "level": u.get("currentLevel", ""),
                            "gender": u.get("gender") or u.get("sex"),
                            "profilePhotoURL": u.get("profilePhotoURL", ""),
                            "joinedAt": r.get("createdAt"),
                        })

        # Settings
        settings = await _get_team_settings(db, team, session_id)

        # Pending applications count
        pending_count = await db["unit_applications"].count_documents({
            "unit": team,
            "sessionId": session_id,
            "status": "pending",
        })

        result.append({
            "team": team,
            "teamLabel": team_label,
            "head": head,
            "members": members,
            "memberCount": len(members),
            "maxMembers": settings["maxMembers"],
            "isOpen": settings["isOpen"],
            "pendingApplications": pending_count,
        })

    return result


@router.get("/settings")
async def get_team_settings_endpoint(
    user=Depends(get_current_user),
    session=Depends(get_current_session),
):
    """Get team settings for the current session (scoped by reviewer's teams)."""
    db = get_database()
    session_id = str(session["_id"])
    allowed_teams = await _ensure_team_application_reviewer(user, session_id)
    team_slugs = list(TEAM_LABELS.keys())
    if allowed_teams is not None:
        team_slugs = [t for t in team_slugs if t in allowed_teams]

    result = {}
    for team in team_slugs:
        result[team] = await _get_team_settings(db, team, session_id)
        result[team]["teamLabel"] = TEAM_LABELS[team]

    return result


@router.patch("/settings/{team}")
async def update_team_settings(
    team: str,
    body: TeamSettingsUpdate,
    request: Request,
    user=Depends(get_current_user),
    session=Depends(get_current_session),
):
    """Update team settings. Scoped: team heads can only update their own team."""
    if team not in TEAM_LABELS:
        # Also check custom teams
        db_check = get_database()
        custom = await db_check["custom_units"].find_one({"slug": team, "isActive": True})
        if not custom:
            raise HTTPException(400, "Invalid team")

    db = get_database()
    user_id = user.get("_id") or user.get("id")
    session_id = str(session["_id"])
    allowed_teams = await _ensure_team_application_reviewer(user, session_id)
    if allowed_teams is not None and team not in allowed_teams:
        raise HTTPException(403, "You can only manage settings for your own team")

    update_fields: dict = {"updatedBy": user_id, "updatedAt": datetime.now(timezone.utc)}
    if body.maxMembers is not None:
        update_fields["maxMembers"] = body.maxMembers
    if body.isOpen is not None:
        update_fields["isOpen"] = body.isOpen

    await db["unit_settings"].update_one(
        {"unit": team, "sessionId": session_id},
        {"$set": update_fields, "$setOnInsert": {"unit": team, "sessionId": session_id}},
        upsert=True,
    )

    await AuditLogger.log(
        action="team_settings.update",
        actor_id=user_id,
        actor_email=user.get("email", "unknown"),
        resource_type="team_settings",
        resource_id=team,
        session_id=session_id,
        details={"team": team, **{k: v for k, v in body.model_dump(exclude_none=True).items()}},
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )

    return {"message": "Settings updated", "team": team}


@router.get("/", response_model=None)
async def list_applications(
    unit: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    search: Optional[str] = Query(None, description="Search by student name or email"),
    limit: int = Query(20, ge=1, le=100),
    skip: int = Query(0, ge=0),
    user=Depends(get_current_user),
    session=Depends(get_current_session),
):
    """
    List applications. Scoped: committee heads see only their unit's applications;
    global reviewers (president, VP, gen-sec, super admin) see all.
    """
    db = get_database()
    session_id = str(session["_id"])

    # ── Scope by reviewer's allowed units ────────────────────────
    allowed_teams = await _ensure_team_application_reviewer(user, session_id)

    query: dict = {"sessionId": session_id}

    if unit:
        # If a specific unit is requested, verify the reviewer can access it
        if allowed_teams is not None and unit not in allowed_teams:
            raise HTTPException(403, "You do not have access to this team's applications")
        query["unit"] = unit
    elif allowed_teams is not None:
        # No unit filter, but reviewer is scoped → restrict to their units
        if not allowed_teams:
            return {"items": [], "total": 0}
        query["unit"] = {"$in": allowed_teams}

    if status:
        query["status"] = status
    if search:
        search_regex = {"$regex": re.escape(search), "$options": "i"}
        query["$or"] = [
            {"userName": search_regex},
            {"userEmail": search_regex},
        ]

    total = await db["unit_applications"].count_documents(query)
    cursor = db["unit_applications"].find(query).sort("createdAt", -1).skip(skip).limit(limit)
    docs = await cursor.to_list(length=limit)
    return {"items": [TeamApplicationResponse(**_serialize(d)) for d in docs], "total": total}


@router.patch("/{application_id}/review", response_model=TeamApplicationResponse)
async def review_application(
    application_id: str,
    body: TeamApplicationReview,
    request: Request,
    user=Depends(get_current_user),
    session=Depends(get_current_session),
):
    db = get_database()
    user_id = user.get("_id") or user.get("id")
    session_id = str(session["_id"])
    allowed_teams = await _ensure_team_application_reviewer(user, session_id)

    if body.status.value not in ("accepted", "rejected"):
        raise HTTPException(400, "Status must be 'accepted' or 'rejected'")
    if body.status.value == "rejected" and not (body.feedback or "").strip():
        raise HTTPException(400, "Please include feedback when rejecting an application")

    try:
        oid = ObjectId(application_id)
    except Exception:
        raise HTTPException(400, "Invalid application ID")

    app_doc = await db["unit_applications"].find_one({"_id": oid})
    if not app_doc:
        raise HTTPException(404, "Application not found")

    if app_doc["status"] != "pending":
        raise HTTPException(400, f"Application already {app_doc['status']}")

    # ── Scope check: reviewer must have access to this unit ──────
    if allowed_teams is not None and app_doc["unit"] not in allowed_teams:
        raise HTTPException(403, "You can only review applications for your own team")

    now = datetime.now(timezone.utc)
    reviewer_name = f"{user.get('firstName', '')} {user.get('lastName', '')}".strip()

    # ── Capacity check on acceptance ─────────────────────────────
    if body.status.value == "accepted":
        settings = await _get_team_settings(db, app_doc["unit"], session_id)
        if settings["maxMembers"] > 0:
            current_count = await _count_active_members(db, app_doc["unit"], session_id)
            if current_count >= settings["maxMembers"]:
                raise HTTPException(
                    400,
                    f"{TEAM_LABELS.get(app_doc['unit'], app_doc['unit'])} has reached its member limit ({settings['maxMembers']})"
                )

    update = {
        "$set": {
            "status": body.status.value,
            "feedback": body.feedback,
            "rejectionTag": body.rejectionTag if body.status.value == "rejected" else None,
            "reviewedBy": user_id,
            "reviewerName": reviewer_name,
            "reviewedAt": now,
        }
    }

    await db["unit_applications"].update_one({"_id": oid}, update)

    # ── If accepted, grant unit member role ───────────────────────
    if body.status.value == "accepted":
        unit = app_doc["unit"]
        role_info = await _resolve_member_role_info(db, unit)
        if role_info:
            existing_role = await db["roles"].find_one({
                "userId": app_doc["userId"],
                "sessionId": app_doc["sessionId"],
                "position": role_info["position"],
                "isActive": True,
            })
            if not existing_role:
                await db["roles"].insert_one({
                    "userId": app_doc["userId"],
                    "sessionId": app_doc["sessionId"],
                    "position": role_info["position"],
                    "permissions": role_info["permissions"],
                    "assignedBy": user_id,
                    "isActive": True,
                    "createdAt": now,
                    "updatedAt": now,
                })
            # Bust permissions cache so new role takes effect immediately
            invalidate_permissions_cache(app_doc["userId"])

    updated = await db["unit_applications"].find_one({"_id": oid})

    # ── Notify student of decision (fire-and-forget) ─────────────
    unit_label = TEAM_LABELS.get(app_doc["unit"], app_doc["unit"])
    status_text = "accepted into" if body.status.value == "accepted" else "not accepted into"
    feedback_text = f" — {body.feedback}" if body.feedback else ""
    tag_text = ""
    if body.status.value == "rejected" and body.rejectionTag in {"warning", "take_note"}:
        tag_text = f" [{body.rejectionTag.replace('_', ' ').title()}]"

    fire_and_forget(create_notification(
        user_id=app_doc["userId"],
        type="team_application",
        title=f"Application {'Accepted' if body.status.value == 'accepted' else 'Rejected'}",
        message=f"You have been {status_text} {unit_label}{tag_text}{feedback_text}",
        link="/dashboard",
        related_id=application_id,
    ))

    # ── Audit log ────────────────────────────────────────────────
    await AuditLogger.log(
        action=f"team_application.{body.status.value}",
        actor_id=user_id,
        actor_email=user.get("email", "unknown"),
        resource_type="team_application",
        resource_id=application_id,
        session_id=app_doc.get("sessionId"),
        details={
            "unit": app_doc["unit"],
            "status": body.status.value,
            "feedback": body.feedback,
            "rejectionTag": body.rejectionTag if body.status.value == "rejected" else None,
        },
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )

    return TeamApplicationResponse(**_serialize(updated))


@router.patch("/{application_id}/revoke", response_model=TeamApplicationResponse)
async def revoke_membership(
    application_id: str,
    request: Request,
    feedback: Optional[str] = Query(None, max_length=500),
    user=Depends(get_current_user),
    session=Depends(get_current_session),
):
    """
    Revoke an accepted member's unit membership.
    Sets application to 'revoked' and deactivates the member role.
    """
    db = get_database()
    user_id = user.get("_id") or user.get("id")
    session_id = str(session["_id"])
    allowed_teams = await _ensure_team_application_reviewer(user, session_id)

    try:
        oid = ObjectId(application_id)
    except Exception:
        raise HTTPException(400, "Invalid application ID")

    app_doc = await db["unit_applications"].find_one({"_id": oid})
    if not app_doc:
        raise HTTPException(404, "Application not found")
    if app_doc["status"] != "accepted":
        raise HTTPException(400, "Only accepted applications can be revoked")

    # Scope check
    if allowed_teams is not None and app_doc["unit"] not in allowed_teams:
        raise HTTPException(403, "You can only manage members of your own team")

    now = datetime.now(timezone.utc)
    reviewer_name = f"{user.get('firstName', '')} {user.get('lastName', '')}".strip()

    # Mark application as revoked
    await db["unit_applications"].update_one({"_id": oid}, {"$set": {
        "status": "revoked",
        "feedback": feedback or "Membership revoked",
        "reviewedBy": user_id,
        "reviewerName": reviewer_name,
        "reviewedAt": now,
    }})

    # Deactivate the member role
    role_info = await _resolve_member_role_info(db, app_doc["unit"])
    if role_info:
        positions = {role_info["position"]}
        if role_info["position"].startswith("team_member_custom_"):
            positions.add(role_info["position"].replace("team_member_custom_", "unit_member_custom_", 1))

        await db["roles"].update_many(
            {
                "userId": app_doc["userId"],
                "sessionId": app_doc["sessionId"],
                "position": {"$in": list(positions)},
                "isActive": True,
            },
            {"$set": {"isActive": False, "updatedAt": now}},
        )
        invalidate_permissions_cache(app_doc["userId"])

    # Notify student
    unit_label = TEAM_LABELS.get(app_doc["unit"], app_doc["unit"])
    fire_and_forget(create_notification(
        user_id=app_doc["userId"],
        type="team_application",
        title="Membership Revoked",
        message=f"Your membership in {unit_label} has been revoked{f' — {feedback}' if feedback else ''}",
        link="/dashboard",
        related_id=application_id,
    ))

    # Audit log
    await AuditLogger.log(
        action="team_application.revoked",
        actor_id=user_id,
        actor_email=user.get("email", "unknown"),
        resource_type="team_application",
        resource_id=application_id,
        session_id=app_doc.get("sessionId"),
        details={"unit": app_doc["unit"], "feedback": feedback},
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )

    updated = await db["unit_applications"].find_one({"_id": oid})
    return TeamApplicationResponse(**_serialize(updated))
