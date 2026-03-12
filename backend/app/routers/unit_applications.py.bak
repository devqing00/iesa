"""
Unit Applications Router

Endpoints:
  POST   /api/v1/unit-applications/                  — Student submits an application
  GET    /api/v1/unit-applications/my                 — Student views their own applications
  GET    /api/v1/unit-applications/                    — Reviewer views applications (unit-scoped)
  PATCH  /api/v1/unit-applications/{id}/review         — Reviewer reviews (accept/reject)
  GET    /api/v1/unit-applications/overview             — Units overview (heads + members + stats)
  GET    /api/v1/unit-applications/settings             — Get unit settings for current session
  PATCH  /api/v1/unit-applications/settings/{unit}     — Update unit settings (scoped)
  PATCH  /api/v1/unit-applications/{id}/revoke          — Revoke accepted membership
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
from app.models.unit_application import (
    UnitApplicationCreate,
    UnitApplicationReview,
    UnitApplicationResponse,
    UnitSettingsUpdate,
    UnitType,
    UNIT_LABELS,
    UNIT_ROLE_MAP,
    HEAD_POSITION_TO_UNIT,
    UNIT_TO_HEAD_POSITION,
    GLOBAL_REVIEW_POSITIONS,
)

router = APIRouter(prefix="/api/v1/unit-applications", tags=["unit-applications"])


# ── Helpers ──────────────────────────────────────────────────────

def _serialize(doc: dict) -> dict:
    doc["id"] = str(doc["_id"])
    doc["unitLabel"] = UNIT_LABELS.get(doc.get("unit", ""), doc.get("unit", ""))
    return doc


async def _get_reviewer_units(user_id: str, session_id: str) -> list[str] | None:
    """
    Return unit types this reviewer can manage.
    - None  → global access (all units)
    - []    → no units (shouldn't happen but safe)
    - [...]  → specific unit types
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
        unit = HEAD_POSITION_TO_UNIT.get(pos)
        if unit:
            allowed.append(unit)
    return allowed


async def _get_unit_settings(db, unit: str, session_id: str) -> dict:
    """Get unit settings, defaulting to unlimited/open if not configured."""
    doc = await db["unit_settings"].find_one({"unit": unit, "sessionId": session_id})
    return {
        "maxMembers": doc.get("maxMembers", 0) if doc else 0,  # 0 = unlimited
        "isOpen": doc.get("isOpen", True) if doc else True,
    }


async def _count_active_members(db, unit: str, session_id: str) -> int:
    """Count active role holders for a unit in this session."""
    role_info = UNIT_ROLE_MAP.get(unit)
    if not role_info:
        return 0
    return await db["roles"].count_documents({
        "position": role_info["position"],
        "sessionId": session_id,
        "isActive": True,
    })


async def _notify_reviewers_bg(unit: str, session_id: str, student_name: str, app_id: str):
    """Fire-and-forget: notify users who can review this unit's applications."""
    try:
        db = get_database()
        head_position = UNIT_TO_HEAD_POSITION.get(unit)
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
            unit_label = UNIT_LABELS.get(unit, unit)
            await create_bulk_notifications(
                user_ids=reviewer_ids,
                type="unit_application",
                title="New Unit Application",
                message=f"{student_name} applied to join {unit_label}",
                link="/admin/units",
                related_id=app_id,
            )
    except Exception:
        pass  # Non-critical


# ── Endpoints ────────────────────────────────────────────────────

@router.post("/", response_model=UnitApplicationResponse)
async def create_application(
    body: UnitApplicationCreate,
    user=Depends(require_ipe_student),
    session=Depends(get_current_session),
):
    db = get_database()
    user_id = user.get("_id") or user.get("id")
    session_id = str(session["_id"])

    # ── Check if unit is open and has capacity ───────────────────
    settings = await _get_unit_settings(db, body.unit.value, session_id)
    if not settings["isOpen"]:
        raise HTTPException(400, f"{UNIT_LABELS.get(body.unit.value, body.unit.value)} is not accepting applications")

    if settings["maxMembers"] > 0:
        current_count = await _count_active_members(db, body.unit.value, session_id)
        if current_count >= settings["maxMembers"]:
            raise HTTPException(400, f"{UNIT_LABELS.get(body.unit.value, body.unit.value)} is full")

    # ── Duplicate check ──────────────────────────────────────────
    existing = await db["unit_applications"].find_one({
        "userId": user_id,
        "unit": body.unit.value,
        "sessionId": session_id,
        "status": {"$in": ["pending", "accepted"]},
    })
    if existing:
        if existing["status"] == "pending":
            raise HTTPException(400, "You already have a pending application for this unit")
        else:
            raise HTTPException(400, "You are already a member of this unit")

    now = datetime.now(timezone.utc)
    student_name = f"{user.get('firstName', '')} {user.get('lastName', '')}".strip()
    doc = {
        "userId": user_id,
        "userName": student_name,
        "userEmail": user.get("email", ""),
        "userLevel": user.get("currentLevel") or user.get("level"),
        "unit": body.unit.value,
        "motivation": body.motivation,
        "skills": body.skills,
        "status": "pending",
        "feedback": None,
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
        _notify_reviewers_bg(body.unit.value, session_id, student_name, str(result.inserted_id))
    )

    return UnitApplicationResponse(**_serialize(doc))


@router.get("/my", response_model=list[UnitApplicationResponse])
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
    return [UnitApplicationResponse(**_serialize(d)) for d in docs]


@router.get("/overview")
async def units_overview(
    user=Depends(require_permission("unit_application:review")),
    session=Depends(get_current_session),
):
    """
    Return all units with their head, members, settings, and pending application count.
    Scoped: committee heads see only their unit(s); global reviewers see all.
    """
    db = get_database()
    user_id = user.get("_id") or user.get("id")
    session_id = str(session["_id"])

    allowed_units = await _get_reviewer_units(user_id, session_id)
    unit_types = list(UNIT_LABELS.keys())
    if allowed_units is not None:
        unit_types = [u for u in unit_types if u in allowed_units]

    result = []
    for unit in unit_types:
        unit_label = UNIT_LABELS[unit]
        role_info = UNIT_ROLE_MAP.get(unit, {})
        head_position = UNIT_TO_HEAD_POSITION.get(unit)

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
                    {"firstName": 1, "lastName": 1, "email": 1, "matricNumber": 1, "profilePhotoURL": 1},
                )
                if head_user:
                    head = {
                        "id": str(head_user["_id"]),
                        "firstName": head_user.get("firstName", ""),
                        "lastName": head_user.get("lastName", ""),
                        "email": head_user.get("email", ""),
                        "matricNumber": head_user.get("matricNumber", ""),
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
                    {"firstName": 1, "lastName": 1, "email": 1, "matricNumber": 1, "currentLevel": 1, "profilePhotoURL": 1},
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
                            "profilePhotoURL": u.get("profilePhotoURL", ""),
                            "joinedAt": r.get("createdAt"),
                        })

        # Settings
        settings = await _get_unit_settings(db, unit, session_id)

        # Pending applications count
        pending_count = await db["unit_applications"].count_documents({
            "unit": unit,
            "sessionId": session_id,
            "status": "pending",
        })

        result.append({
            "unit": unit,
            "unitLabel": unit_label,
            "head": head,
            "members": members,
            "memberCount": len(members),
            "maxMembers": settings["maxMembers"],
            "isOpen": settings["isOpen"],
            "pendingApplications": pending_count,
        })

    return result


@router.get("/settings")
async def get_settings(
    user=Depends(require_permission("unit_application:review")),
    session=Depends(get_current_session),
):
    """Get unit settings for the current session (scoped by reviewer's units)."""
    db = get_database()
    user_id = user.get("_id") or user.get("id")
    session_id = str(session["_id"])

    allowed_units = await _get_reviewer_units(user_id, session_id)
    unit_types = list(UNIT_LABELS.keys())
    if allowed_units is not None:
        unit_types = [u for u in unit_types if u in allowed_units]

    result = {}
    for unit in unit_types:
        result[unit] = await _get_unit_settings(db, unit, session_id)
        result[unit]["unitLabel"] = UNIT_LABELS[unit]

    return result


@router.patch("/settings/{unit}")
async def update_settings(
    unit: str,
    body: UnitSettingsUpdate,
    request: Request,
    user=Depends(require_permission("unit_application:review")),
    session=Depends(get_current_session),
):
    """Update unit settings. Scoped: committee heads can only update their own unit."""
    if unit not in UNIT_LABELS:
        raise HTTPException(400, "Invalid unit type")

    db = get_database()
    user_id = user.get("_id") or user.get("id")
    session_id = str(session["_id"])

    allowed_units = await _get_reviewer_units(user_id, session_id)
    if allowed_units is not None and unit not in allowed_units:
        raise HTTPException(403, "You can only manage settings for your own unit")

    update_fields: dict = {"updatedBy": user_id, "updatedAt": datetime.now(timezone.utc)}
    if body.maxMembers is not None:
        update_fields["maxMembers"] = body.maxMembers
    if body.isOpen is not None:
        update_fields["isOpen"] = body.isOpen

    await db["unit_settings"].update_one(
        {"unit": unit, "sessionId": session_id},
        {"$set": update_fields, "$setOnInsert": {"unit": unit, "sessionId": session_id}},
        upsert=True,
    )

    await AuditLogger.log(
        action="unit_settings.update",
        actor_id=user_id,
        actor_email=user.get("email", "unknown"),
        resource_type="unit_settings",
        resource_id=unit,
        session_id=session_id,
        details={"unit": unit, **{k: v for k, v in body.model_dump(exclude_none=True).items()}},
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )

    return {"message": "Settings updated", "unit": unit}


@router.get("/", response_model=None)
async def list_applications(
    unit: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    search: Optional[str] = Query(None, description="Search by student name or email"),
    limit: int = Query(20, ge=1, le=100),
    skip: int = Query(0, ge=0),
    user=Depends(require_permission("unit_application:review")),
    session=Depends(get_current_session),
):
    """
    List applications. Scoped: committee heads see only their unit's applications;
    global reviewers (president, VP, gen-sec, super admin) see all.
    """
    db = get_database()
    user_id = user.get("_id") or user.get("id")
    session_id = str(session["_id"])

    # ── Scope by reviewer's allowed units ────────────────────────
    allowed_units = await _get_reviewer_units(user_id, session_id)

    query: dict = {"sessionId": session_id}

    if unit:
        # If a specific unit is requested, verify the reviewer can access it
        if allowed_units is not None and unit not in allowed_units:
            raise HTTPException(403, "You do not have access to this unit's applications")
        query["unit"] = unit
    elif allowed_units is not None:
        # No unit filter, but reviewer is scoped → restrict to their units
        if not allowed_units:
            return {"items": [], "total": 0}
        query["unit"] = {"$in": allowed_units}

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
    return {"items": [UnitApplicationResponse(**_serialize(d)) for d in docs], "total": total}


@router.patch("/{application_id}/review", response_model=UnitApplicationResponse)
async def review_application(
    application_id: str,
    body: UnitApplicationReview,
    request: Request,
    user=Depends(require_permission("unit_application:review")),
    session=Depends(get_current_session),
):
    db = get_database()
    user_id = user.get("_id") or user.get("id")
    session_id = str(session["_id"])

    if body.status.value not in ("accepted", "rejected"):
        raise HTTPException(400, "Status must be 'accepted' or 'rejected'")

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
    allowed_units = await _get_reviewer_units(user_id, session_id)
    if allowed_units is not None and app_doc["unit"] not in allowed_units:
        raise HTTPException(403, "You can only review applications for your own unit")

    now = datetime.now(timezone.utc)
    reviewer_name = f"{user.get('firstName', '')} {user.get('lastName', '')}".strip()

    # ── Capacity check on acceptance ─────────────────────────────
    if body.status.value == "accepted":
        settings = await _get_unit_settings(db, app_doc["unit"], session_id)
        if settings["maxMembers"] > 0:
            current_count = await _count_active_members(db, app_doc["unit"], session_id)
            if current_count >= settings["maxMembers"]:
                raise HTTPException(
                    400,
                    f"{UNIT_LABELS.get(app_doc['unit'], app_doc['unit'])} has reached its member limit ({settings['maxMembers']})"
                )

    update = {
        "$set": {
            "status": body.status.value,
            "feedback": body.feedback,
            "reviewedBy": user_id,
            "reviewerName": reviewer_name,
            "reviewedAt": now,
        }
    }

    await db["unit_applications"].update_one({"_id": oid}, update)

    # ── If accepted, grant unit member role ───────────────────────
    if body.status.value == "accepted":
        unit = app_doc["unit"]
        role_info = UNIT_ROLE_MAP.get(unit)
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
    unit_label = UNIT_LABELS.get(app_doc["unit"], app_doc["unit"])
    status_text = "accepted into" if body.status.value == "accepted" else "not accepted into"
    feedback_text = f" — {body.feedback}" if body.feedback else ""

    fire_and_forget(create_notification(
        user_id=app_doc["userId"],
        type="unit_application",
        title=f"Application {'Accepted' if body.status.value == 'accepted' else 'Rejected'}",
        message=f"You have been {status_text} {unit_label}{feedback_text}",
        link="/dashboard",
        related_id=application_id,
    ))

    # ── Audit log ────────────────────────────────────────────────
    await AuditLogger.log(
        action=f"unit_application.{body.status.value}",
        actor_id=user_id,
        actor_email=user.get("email", "unknown"),
        resource_type="unit_application",
        resource_id=application_id,
        session_id=app_doc.get("sessionId"),
        details={"unit": app_doc["unit"], "status": body.status.value, "feedback": body.feedback},
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )

    return UnitApplicationResponse(**_serialize(updated))


@router.patch("/{application_id}/revoke", response_model=UnitApplicationResponse)
async def revoke_membership(
    application_id: str,
    request: Request,
    feedback: Optional[str] = Query(None, max_length=500),
    user=Depends(require_permission("unit_application:review")),
    session=Depends(get_current_session),
):
    """
    Revoke an accepted member's unit membership.
    Sets application to 'revoked' and deactivates the member role.
    """
    db = get_database()
    user_id = user.get("_id") or user.get("id")
    session_id = str(session["_id"])

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
    allowed_units = await _get_reviewer_units(user_id, session_id)
    if allowed_units is not None and app_doc["unit"] not in allowed_units:
        raise HTTPException(403, "You can only manage members of your own unit")

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
    role_info = UNIT_ROLE_MAP.get(app_doc["unit"])
    if role_info:
        await db["roles"].update_one(
            {
                "userId": app_doc["userId"],
                "sessionId": app_doc["sessionId"],
                "position": role_info["position"],
                "isActive": True,
            },
            {"$set": {"isActive": False, "updatedAt": now}},
        )
        invalidate_permissions_cache(app_doc["userId"])

    # Notify student
    unit_label = UNIT_LABELS.get(app_doc["unit"], app_doc["unit"])
    fire_and_forget(create_notification(
        user_id=app_doc["userId"],
        type="unit_application",
        title="Membership Revoked",
        message=f"Your membership in {unit_label} has been revoked{f' — {feedback}' if feedback else ''}",
        link="/dashboard",
        related_id=application_id,
    ))

    # Audit log
    await AuditLogger.log(
        action="unit_application.revoked",
        actor_id=user_id,
        actor_email=user.get("email", "unknown"),
        resource_type="unit_application",
        resource_id=application_id,
        session_id=app_doc.get("sessionId"),
        details={"unit": app_doc["unit"], "feedback": feedback},
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )

    updated = await db["unit_applications"].find_one({"_id": oid})
    return UnitApplicationResponse(**_serialize(updated))
