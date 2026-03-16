"""
IEPOD Router — IESA Professional Development Hub

"Forge the Future Series" – Process Drivers: Your Process, Our Progress.

Endpoint groups:
  /api/v1/iepod/societies       — Campus society CRUD
  /api/v1/iepod/register        — Student intake registration
  /api/v1/iepod/registrations   — Admin: manage registrations
  /api/v1/iepod/niche-audit     — Student niche-audit worksheet
  /api/v1/iepod/teams           — Hackathon team management
  /api/v1/iepod/submissions     — Iteration submissions
  /api/v1/iepod/quizzes         — Quiz / challenge CRUD + participation
  /api/v1/iepod/points          — Gamification points + leaderboard
  /api/v1/iepod/my              — Student's own IEPOD profile
  /api/v1/iepod/stats           — Admin dashboard aggregations
"""

from datetime import datetime, timezone
from typing import Optional, List
import re

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pymongo.errors import DuplicateKeyError

from ..core.permissions import (
    get_current_user,
    get_current_session,
    require_permission,
)
from ..core.sanitization import sanitize_html, validate_no_scripts
from ..core.audit import AuditLogger
from ..db import get_database
from ..models.iepod import (
    # Societies
    SocietyCreate, SocietyUpdate, Society,
    # Registrations
    RegistrationCreate, RegistrationUpdate, Registration,
    # Niche Audit
    NicheAuditCreate, NicheAuditUpdate, NicheAudit,
    # Teams
    TeamCreate, TeamUpdate, Team, TeamMember,
    # Submissions
    SubmissionCreate, SubmissionReview, Submission,
    # Quizzes
    QuizCreate, QuizUpdate, Quiz, QuizPublic, QuizQuestionPublic,
    QuizResponseCreate, QuizResponse, QuizAnswer,
    # Points
    PointEntry, PointAward, LeaderboardEntry,
)

router = APIRouter(prefix="/api/v1/iepod", tags=["IEPOD Hub"])


# ═══════════════════════════════════════════════════════════════════
# HELPERS
# ═══════════════════════════════════════════════════════════════════

def _oid(val: str) -> ObjectId:
    try:
        return ObjectId(val)
    except Exception:
        raise HTTPException(400, "Invalid ID format")


async def _award_points(
    db, user_id: str, user_name: str, session_id: str,
    action: str, pts: int, description: str = "", ref_id: str | None = None,
):
    """Credit points to a student and update their registration total."""
    entry = {
        "userId": user_id,
        "userName": user_name,
        "sessionId": session_id,
        "action": action,
        "points": pts,
        "description": description,
        "referenceId": ref_id,
        "awardedAt": datetime.now(timezone.utc),
    }
    await db.iepod_points.insert_one(entry)
    await db.iepod_registrations.update_one(
        {"userId": user_id, "sessionId": session_id},
        {"$inc": {"points": pts}},
    )


async def _get_registration(db, user_id: str, session_id: str) -> dict | None:
    return await db.iepod_registrations.find_one(
        {"userId": user_id, "sessionId": session_id}
    )


# ═══════════════════════════════════════════════════════════════════
# SOCIETIES — Public read, Admin write
# ═══════════════════════════════════════════════════════════════════

@router.get("/societies")
async def list_societies(
    active_only: bool = Query(True),
    user: dict = Depends(get_current_user),
):
    """List campus societies linked to IEPOD."""
    db = get_database()
    active_session = await db.sessions.find_one({"isActive": True}, {"_id": 1})
    active_session_id = str(active_session["_id"]) if active_session and active_session.get("_id") else None

    hub_lead_by_society: dict[str, dict] = {}
    if active_session_id:
        role_docs = await db.roles.find(
            {
                "sessionId": active_session_id,
                "position": "iepod_hub_lead",
                "isActive": True,
                "societyId": {"$exists": True, "$ne": None},
            },
            {
                "userId": 1,
                "societyId": 1,
                "societyName": 1,
                "createdAt": 1,
            },
        ).to_list(length=500)

        user_ids = [
            ObjectId(str(r.get("userId")))
            for r in role_docs
            if r.get("userId") and ObjectId.is_valid(str(r.get("userId")))
        ]
        users_map: dict[str, dict] = {}
        if user_ids:
            users = await db.users.find(
                {"_id": {"$in": user_ids}},
                {"firstName": 1, "lastName": 1, "email": 1, "institutionalEmail": 1},
            ).to_list(length=1000)
            users_map = {str(u["_id"]): u for u in users}

        for role_doc in role_docs:
            society_id = str(role_doc.get("societyId") or "").strip()
            user_id = str(role_doc.get("userId") or "").strip()
            if not society_id or not user_id:
                continue

            existing = hub_lead_by_society.get(society_id)
            existing_created = existing.get("_createdAt") if existing else None
            created_at = role_doc.get("createdAt")
            if existing and existing_created and created_at and existing_created > created_at:
                continue

            u = users_map.get(user_id)
            full_name = ""
            email = ""
            if u:
                full_name = f"{u.get('firstName', '')} {u.get('lastName', '')}".strip()
                email = u.get("institutionalEmail") or u.get("email") or ""

            hub_lead_by_society[society_id] = {
                "userId": user_id,
                "name": full_name,
                "email": email,
                "societyName": str(role_doc.get("societyName") or "").strip() or None,
                "_createdAt": created_at,
            }

    query = {"isActive": True} if active_only else {}
    cursor = db.iepod_societies.find(query).sort("name", 1)
    items = []
    async for doc in cursor:
        doc["_id"] = str(doc["_id"])
        # Get member count
        count = await db.iepod_registrations.count_documents(
            {"societyId": str(doc["_id"]), "status": "approved"}
        )
        doc["memberCount"] = count
        lead = hub_lead_by_society.get(doc["_id"])
        if lead:
            doc["hubLead"] = {
                "userId": lead.get("userId"),
                "name": lead.get("name") or "Unassigned",
                "email": lead.get("email") or "",
            }
            doc["hubLeadName"] = lead.get("name") or None
            doc["hubLeadEmail"] = lead.get("email") or None
        else:
            doc["hubLead"] = None
            doc["hubLeadName"] = None
            doc["hubLeadEmail"] = None
        items.append(doc)
    return items


@router.post("/societies", status_code=201)
async def create_society(
    data: SocietyCreate,
    request: Request,
    user: dict = Depends(require_permission("iepod:manage")),
):
    """Admin: Create a new society."""
    db = get_database()
    if not validate_no_scripts(data.name) or not validate_no_scripts(data.description):
        raise HTTPException(400, "Invalid characters detected")
    doc = data.model_dump()
    doc["memberCount"] = 0
    doc["createdAt"] = datetime.now(timezone.utc)
    doc["updatedAt"] = datetime.now(timezone.utc)
    result = await db.iepod_societies.insert_one(doc)
    created = await db.iepod_societies.find_one({"_id": result.inserted_id})
    created["_id"] = str(created["_id"])

    await AuditLogger.log(
        action="iepod.society_created",
        actor_id=str(user["_id"]),
        actor_email=user.get("email", "unknown"),
        resource_type="iepod_society",
        resource_id=str(result.inserted_id),
        details={"name": data.name},
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )

    return created


@router.patch("/societies/{society_id}")
async def update_society(
    society_id: str,
    data: SocietyUpdate,
    request: Request,
    user: dict = Depends(require_permission("iepod:manage")),
):
    db = get_database()
    updates = {k: v for k, v in data.model_dump(exclude_unset=True).items()}
    if not updates:
        raise HTTPException(400, "No fields to update")
    updates["updatedAt"] = datetime.now(timezone.utc)
    await db.iepod_societies.update_one({"_id": _oid(society_id)}, {"$set": updates})
    updated = await db.iepod_societies.find_one({"_id": _oid(society_id)})
    if not updated:
        raise HTTPException(404, "Society not found")
    updated["_id"] = str(updated["_id"])

    await AuditLogger.log(
        action="iepod.society_updated",
        actor_id=str(user["_id"]),
        actor_email=user.get("email", "unknown"),
        resource_type="iepod_society",
        resource_id=society_id,
        details={"name": updated.get("name"), "fields": list(updates.keys())},
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )

    return updated


@router.delete("/societies/{society_id}", status_code=204)
async def delete_society(
    society_id: str,
    request: Request,
    user: dict = Depends(require_permission("iepod:manage")),
):
    db = get_database()
    doc = await db.iepod_societies.find_one({"_id": _oid(society_id)})
    result = await db.iepod_societies.delete_one({"_id": _oid(society_id)})
    if result.deleted_count == 0:
        raise HTTPException(404, "Society not found")

    # Nullify societyId on registrations referencing this society
    await db.iepod_registrations.update_many(
        {"societyId": society_id},
        {"$set": {"societyId": None}},
    )

    await AuditLogger.log(
        action="iepod.society_deleted",
        actor_id=str(user["_id"]),
        actor_email=user.get("email", "unknown"),
        resource_type="iepod_society",
        resource_id=society_id,
        details={"name": doc.get("name") if doc else None},
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )


# ═══════════════════════════════════════════════════════════════════
# STUDENT REGISTRATION / INTAKE
# ═══════════════════════════════════════════════════════════════════

@router.post("/register", status_code=201)
async def register_for_iepod(
    data: RegistrationCreate,
    user: dict = Depends(get_current_user),
    session: dict = Depends(get_current_session),
):
    """Student registers for the IEPOD program in the current session."""
    db = get_database()
    session_id = str(session["_id"])
    user_id = user["_id"]

    # Check for duplicate
    existing = await _get_registration(db, user_id, session_id)
    if existing:
        raise HTTPException(400, "You have already registered for this session's IEPOD program")

    # Sanitise
    if not validate_no_scripts(data.whyJoin):
        raise HTTPException(400, "Invalid characters in motivation text")

    doc = data.model_dump()
    doc["userId"] = user_id
    doc["userName"] = f"{user.get('firstName', '')} {user.get('lastName', '')}".strip()
    doc["userEmail"] = user.get("email", "")
    doc["sessionId"] = session_id
    doc["level"] = user.get("currentLevel") or user.get("level") or "N/A"
    doc["department"] = user.get("department", "Industrial Engineering")
    doc["isExternalStudent"] = doc["department"] != "Industrial Engineering"
    doc["externalFaculty"] = None
    doc["status"] = "pending"
    doc["phase"] = "stimulate"
    doc["points"] = 0
    doc["completedPhases"] = []
    doc["societyId"] = None
    doc["nicheAuditId"] = None
    doc["teamId"] = None
    doc["createdAt"] = datetime.now(timezone.utc)
    doc["updatedAt"] = datetime.now(timezone.utc)

    try:
        result = await db.iepod_registrations.insert_one(doc)
    except DuplicateKeyError:
        raise HTTPException(400, "You have already registered for this session's IEPOD program")
    created = await db.iepod_registrations.find_one({"_id": result.inserted_id})
    created["_id"] = str(created["_id"])

    # Points are awarded when admin approves the registration (not here)

    return created


@router.get("/my")
async def get_my_iepod_profile(
    user: dict = Depends(get_current_user),
    session: dict = Depends(get_current_session),
):
    """Get the logged-in student's full IEPOD profile for the current session."""
    db = get_database()
    session_id = str(session["_id"])
    user_id = user["_id"]

    reg = await _get_registration(db, user_id, session_id)
    if not reg:
        return {"registered": False}

    reg["_id"] = str(reg["_id"])

    # Grab linked data
    society = None
    if reg.get("societyId"):
        s = await db.iepod_societies.find_one({"_id": _oid(reg["societyId"])})
        if s:
            s["_id"] = str(s["_id"])
            society = s

    niche = None
    if reg.get("nicheAuditId"):
        n = await db.iepod_niche_audits.find_one({"_id": _oid(reg["nicheAuditId"])})
        if n:
            n["_id"] = str(n["_id"])
            niche = n

    team = None
    if reg.get("teamId"):
        t = await db.iepod_teams.find_one({"_id": _oid(reg["teamId"])})
        if t:
            t["_id"] = str(t["_id"])
            team = t

    # Recent points
    points_cursor = db.iepod_points.find(
        {"userId": user_id, "sessionId": session_id}
    ).sort("awardedAt", -1).limit(20)
    points_history = []
    async for p in points_cursor:
        p["_id"] = str(p["_id"])
        points_history.append(p)

    # Quiz results
    quiz_cursor = db.iepod_quiz_responses.find(
        {"userId": user_id, "sessionId": session_id}
    ).sort("submittedAt", -1).limit(10)
    quiz_results = []
    async for q in quiz_cursor:
        q["_id"] = str(q["_id"])
        quiz_results.append(q)

    return {
        "registered": True,
        "registration": reg,
        "society": society,
        "nicheAudit": niche,
        "team": team,
        "pointsHistory": points_history,
        "quizResults": quiz_results,
    }


# ═══════════════════════════════════════════════════════════════════
# ADMIN: REGISTRATION MANAGEMENT
# ═══════════════════════════════════════════════════════════════════

@router.get("/registrations")
async def list_registrations(
    status_filter: Optional[str] = Query(None, alias="status"),
    phase: Optional[str] = None,
    department: Optional[str] = Query(None, description="Filter by department: 'ipe' for Industrial Engineering, 'external' for non-IPE"),
    search: Optional[str] = None,
    limit: int = Query(50, ge=1, le=200),
    skip: int = Query(0, ge=0),
    user: dict = Depends(require_permission("iepod:manage")),
    session: dict = Depends(get_current_session),
):
    """Admin: List all IEPOD registrations."""
    db = get_database()
    query: dict = {"sessionId": str(session["_id"])}
    if status_filter:
        query["status"] = status_filter
    if phase:
        query["phase"] = phase
    if department == "ipe":
        query["isExternalStudent"] = {"$ne": True}
    elif department == "external":
        query["isExternalStudent"] = True
    if search:
        escaped = re.escape(search)
        query["$or"] = [
            {"userName": {"$regex": escaped, "$options": "i"}},
            {"userEmail": {"$regex": escaped, "$options": "i"}},
        ]
    cursor = db.iepod_registrations.find(query).sort("createdAt", -1).skip(skip).limit(limit)
    items = []
    async for doc in cursor:
        doc["_id"] = str(doc["_id"])
        items.append(doc)
    total = await db.iepod_registrations.count_documents(query)
    return {"registrations": items, "total": total}


@router.patch("/registrations/{reg_id}")
async def update_registration(
    reg_id: str,
    data: RegistrationUpdate,
    request: Request,
    user: dict = Depends(require_permission("iepod:manage")),
    session: dict = Depends(get_current_session),
):
    """Admin: approve/reject registration, update phase, add note."""
    db = get_database()
    session_id = str(session["_id"])

    # Fetch current registration first (needed for validation)
    current = await db.iepod_registrations.find_one({"_id": _oid(reg_id)})
    if not current:
        raise HTTPException(404, "Registration not found")

    # Session gating — prevent modifying registrations from other sessions
    if current.get("sessionId") != session_id:
        raise HTTPException(403, "Cannot modify registrations from a different session")

    updates = {k: v for k, v in data.model_dump(exclude_unset=True).items()}
    if not updates:
        raise HTTPException(400, "No fields to update")

    # Status transition validation
    new_status = updates.get("status")
    current_status = current.get("status", "pending")
    if new_status:
        valid_transitions = {
            "pending": {"approved", "rejected"},
            "approved": {"rejected", "completed"},
            "rejected": {"approved"},
            "completed": set(),
        }
        allowed = valid_transitions.get(current_status, set())
        if new_status not in allowed:
            raise HTTPException(
                400,
                f"Cannot change status from '{current_status}' to '{new_status}'. "
                f"Allowed: {', '.join(sorted(allowed)) if allowed else 'none'}"
            )

    # Phase progression tracking — push old phase into completedPhases
    new_phase = updates.get("phase")
    mongo_ops: dict = {"$set": {}}
    if new_phase and new_phase != current.get("phase"):
        # Validate forward movement only (unless admin deliberately overrides)
        phase_order = ["stimulate", "carve", "pitch"]
        old_idx = phase_order.index(current["phase"]) if current.get("phase") in phase_order else -1
        new_idx = phase_order.index(new_phase) if new_phase in phase_order else -1
        if new_idx <= old_idx:
            raise HTTPException(400, f"Phase can only advance forward. Current: {current.get('phase')}")

        # Mark old phase as completed
        completed_phases = list(current.get("completedPhases", []))
        old_phase = current.get("phase")
        if old_phase and old_phase not in completed_phases:
            completed_phases.append(old_phase)
        mongo_ops["$set"]["completedPhases"] = completed_phases

    updates["updatedAt"] = datetime.now(timezone.utc)
    mongo_ops["$set"].update(updates)

    await db.iepod_registrations.update_one({"_id": _oid(reg_id)}, mongo_ops)
    updated = await db.iepod_registrations.find_one({"_id": _oid(reg_id)})
    updated["_id"] = str(updated["_id"])

    await AuditLogger.log(
        action=f"iepod.registration_{updates.get('status', 'updated')}",
        actor_id=str(user["_id"]),
        actor_email=user.get("email", "unknown"),
        resource_type="iepod_registration",
        resource_id=reg_id,
        details={"student": updated.get("userName"), "status": updates.get("status"), "phase": updates.get("phase")},
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )

    # Award points on approval + send notification
    student_uid = updated.get("userId")
    if new_status and student_uid:
        # Award registration points when approved (not at registration time)
        if new_status == "approved" and current_status != "approved":
            user_name = updated.get("userName", "")
            await _award_points(
                db, student_uid, user_name, session_id,
                "registration", 10, "IEPOD registration approved",
                reg_id,
            )

        try:
            from app.routers.notifications import create_notification
            status_labels = {"approved": "approved", "rejected": "rejected", "completed": "completed"}
            status_label = status_labels.get(new_status, "updated")
            await create_notification(
                user_id=student_uid,
                type="iepod",
                title=f"IEPOD Registration {status_label.title()}",
                message=f"Your IEPOD registration has been {status_label}.",
                link="/dashboard/iepod",
                category="iepod",
            )
        except Exception:
            pass  # Non-critical

    return updated


@router.get("/registrations/{reg_id}")
async def get_registration(
    reg_id: str,
    user: dict = Depends(require_permission("iepod:manage")),
):
    db = get_database()
    doc = await db.iepod_registrations.find_one({"_id": _oid(reg_id)})
    if not doc:
        raise HTTPException(404, "Registration not found")
    doc["_id"] = str(doc["_id"])
    return doc


# ═══════════════════════════════════════════════════════════════════
# SOCIETY COMMITMENT (Student picks a society in Phase 2)
# ═══════════════════════════════════════════════════════════════════

@router.post("/commit-society/{society_id}")
async def commit_to_society(
    society_id: str,
    user: dict = Depends(get_current_user),
    session: dict = Depends(get_current_session),
):
    """Student commits to a campus society (Phase 2)."""
    db = get_database()
    session_id = str(session["_id"])
    user_id = user["_id"]

    reg = await _get_registration(db, user_id, session_id)
    if not reg:
        raise HTTPException(400, "You must register for IEPOD first")
    if reg["status"] != "approved":
        raise HTTPException(400, "Your registration hasn't been approved yet")

    society = await db.iepod_societies.find_one({"_id": _oid(society_id)})
    if not society:
        raise HTTPException(404, "Society not found")

    await db.iepod_registrations.update_one(
        {"_id": reg["_id"]},
        {"$set": {"societyId": society_id, "updatedAt": datetime.now(timezone.utc)}},
    )

    # Award points for society commitment
    if not reg.get("societyId"):  # Only award once
        user_name = f"{user.get('firstName', '')} {user.get('lastName', '')}".strip()
        await _award_points(
            db, user_id, user_name, session_id,
            "society_checkin", 15, f"Committed to {society['name']}",
            society_id,
        )

    return {"message": f"Successfully committed to {society['name']}"}


# ═══════════════════════════════════════════════════════════════════
# NICHE AUDIT (Phase 2 reflective worksheet)
# ═══════════════════════════════════════════════════════════════════

@router.post("/niche-audit", status_code=201)
async def create_niche_audit(
    data: NicheAuditCreate,
    user: dict = Depends(get_current_user),
    session: dict = Depends(get_current_session),
):
    """Student submits their Niche Audit worksheet."""
    db = get_database()
    session_id = str(session["_id"])
    user_id = user["_id"]

    reg = await _get_registration(db, user_id, session_id)
    if not reg:
        raise HTTPException(400, "You must register for IEPOD first")
    if reg["status"] != "approved":
        raise HTTPException(400, "Your IEPOD registration must be approved before submitting a Niche Audit")

    # External students cannot create niche audits (IPE-only feature)
    if reg.get("isExternalStudent"):
        raise HTTPException(403, "Niche Audit is restricted to Industrial & Production Engineering students. External participants can join teams and attend sessions.")

    # Check if already exists
    existing = await db.iepod_niche_audits.find_one(
        {"userId": user_id, "sessionId": session_id}
    )
    if existing:
        raise HTTPException(400, "You have already submitted a Niche Audit. Use PATCH to update.")

    if not validate_no_scripts(data.focusProblem):
        raise HTTPException(400, "Invalid characters detected")

    user_name = f"{user.get('firstName', '')} {user.get('lastName', '')}".strip()
    doc = data.model_dump()
    doc["userId"] = user_id
    doc["userName"] = user_name
    doc["sessionId"] = session_id
    doc["submittedAt"] = datetime.now(timezone.utc)
    doc["updatedAt"] = datetime.now(timezone.utc)

    result = await db.iepod_niche_audits.insert_one(doc)
    audit_id = str(result.inserted_id)

    # Link to registration
    await db.iepod_registrations.update_one(
        {"_id": reg["_id"]},
        {"$set": {"nicheAuditId": audit_id, "updatedAt": datetime.now(timezone.utc)}},
    )

    # Award points
    await _award_points(
        db, user_id, user_name, session_id,
        "niche_audit", 20, "Submitted Niche Audit",
        audit_id,
    )

    created = await db.iepod_niche_audits.find_one({"_id": result.inserted_id})
    created["_id"] = str(created["_id"])
    return created


@router.get("/niche-audit")
async def get_my_niche_audit(
    user: dict = Depends(get_current_user),
    session: dict = Depends(get_current_session),
):
    """Get the logged-in student's niche audit."""
    db = get_database()
    doc = await db.iepod_niche_audits.find_one(
        {"userId": user["_id"], "sessionId": str(session["_id"])}
    )
    if not doc:
        return None
    doc["_id"] = str(doc["_id"])
    return doc


@router.patch("/niche-audit")
async def update_my_niche_audit(
    data: NicheAuditUpdate,
    user: dict = Depends(get_current_user),
    session: dict = Depends(get_current_session),
):
    """Update the logged-in student's niche audit."""
    db = get_database()
    updates = {k: v for k, v in data.model_dump(exclude_unset=True).items()}
    if not updates:
        raise HTTPException(400, "No fields to update")
    updates["updatedAt"] = datetime.now(timezone.utc)
    result = await db.iepod_niche_audits.update_one(
        {"userId": user["_id"], "sessionId": str(session["_id"])},
        {"$set": updates},
    )
    if result.matched_count == 0:
        raise HTTPException(404, "Niche Audit not found")
    doc = await db.iepod_niche_audits.find_one(
        {"userId": user["_id"], "sessionId": str(session["_id"])}
    )
    doc["_id"] = str(doc["_id"])
    return doc


# Admin: List all niche audits
@router.get("/niche-audits")
async def list_niche_audits(
    search: Optional[str] = None,
    limit: int = Query(50, ge=1, le=200),
    skip: int = Query(0, ge=0),
    user: dict = Depends(require_permission("iepod:manage")),
    session: dict = Depends(get_current_session),
):
    db = get_database()
    query: dict = {"sessionId": str(session["_id"])}
    if search:
        escaped = re.escape(search)
        query["$or"] = [
            {"userName": {"$regex": escaped, "$options": "i"}},
            {"focusProblem": {"$regex": escaped, "$options": "i"}},
        ]
    cursor = db.iepod_niche_audits.find(query).sort("submittedAt", -1).skip(skip).limit(limit)
    items = []
    async for doc in cursor:
        doc["_id"] = str(doc["_id"])
        items.append(doc)
    total = await db.iepod_niche_audits.count_documents(query)
    return {"audits": items, "total": total}


# ═══════════════════════════════════════════════════════════════════
# HACKATHON TEAMS (Phase 3)
# ═══════════════════════════════════════════════════════════════════

@router.post("/teams", status_code=201)
async def create_team(
    data: TeamCreate,
    user: dict = Depends(get_current_user),
    session: dict = Depends(get_current_session),
):
    """Create a new hackathon team (must be IEPOD-registered)."""
    db = get_database()
    session_id = str(session["_id"])
    user_id = user["_id"]
    user_name = f"{user.get('firstName', '')} {user.get('lastName', '')}".strip()

    reg = await _get_registration(db, user_id, session_id)
    if not reg:
        raise HTTPException(400, "You must register for IEPOD first")
    if reg["status"] != "approved":
        raise HTTPException(400, "Your IEPOD registration must be approved before creating a team")
    if reg.get("teamId"):
        raise HTTPException(400, "You are already on a team")

    # External students cannot create teams (they can only join existing teams)
    if reg.get("isExternalStudent"):
        raise HTTPException(403, "Team creation is restricted to IPE students. You can join existing teams instead.")

    if not validate_no_scripts(data.name) or not validate_no_scripts(data.problemStatement):
        raise HTTPException(400, "Invalid characters detected")

    doc = data.model_dump()
    doc["leaderId"] = user_id
    doc["leaderName"] = user_name
    doc["sessionId"] = session_id
    doc["members"] = [{
        "userId": user_id,
        "userName": user_name,
        "role": "lead",
        "joinedAt": datetime.now(timezone.utc),
    }]
    doc["status"] = "forming"
    doc["submissionCount"] = 0
    doc["mentorId"] = None
    doc["mentorName"] = None
    doc["createdAt"] = datetime.now(timezone.utc)
    doc["updatedAt"] = datetime.now(timezone.utc)

    result = await db.iepod_teams.insert_one(doc)
    team_id = str(result.inserted_id)

    # Link to registration
    await db.iepod_registrations.update_one(
        {"_id": reg["_id"]},
        {"$set": {"teamId": team_id, "updatedAt": datetime.now(timezone.utc)}},
    )

    # Award points
    await _award_points(
        db, user_id, user_name, session_id,
        "team_formed", 15, f"Created team '{data.name}'",
        team_id,
    )

    created = await db.iepod_teams.find_one({"_id": result.inserted_id})
    created["_id"] = str(created["_id"])
    return created


@router.get("/teams")
async def list_teams(
    status_filter: Optional[str] = Query(None, alias="status"),
    search: Optional[str] = None,
    limit: int = Query(50, ge=1, le=200),
    skip: int = Query(0, ge=0),
    user: dict = Depends(get_current_user),
    session: dict = Depends(get_current_session),
):
    """List hackathon teams."""
    db = get_database()
    query: dict = {"sessionId": str(session["_id"])}
    if status_filter:
        query["status"] = status_filter
    if search:
        escaped = re.escape(search)
        query["$or"] = [
            {"name": {"$regex": escaped, "$options": "i"}},
            {"problemStatement": {"$regex": escaped, "$options": "i"}},
        ]
    cursor = db.iepod_teams.find(query).sort("createdAt", -1).skip(skip).limit(limit)
    items = []
    async for doc in cursor:
        doc["_id"] = str(doc["_id"])
        items.append(doc)
    total = await db.iepod_teams.count_documents(query)
    return {"teams": items, "total": total}


@router.get("/teams/{team_id}")
async def get_team(
    team_id: str,
    user: dict = Depends(get_current_user),
):
    db = get_database()
    doc = await db.iepod_teams.find_one({"_id": _oid(team_id)})
    if not doc:
        raise HTTPException(404, "Team not found")
    doc["_id"] = str(doc["_id"])
    return doc


@router.post("/teams/{team_id}/join")
async def join_team(
    team_id: str,
    user: dict = Depends(get_current_user),
    session: dict = Depends(get_current_session),
):
    """Join an existing hackathon team."""
    db = get_database()
    session_id = str(session["_id"])
    user_id = user["_id"]
    user_name = f"{user.get('firstName', '')} {user.get('lastName', '')}".strip()

    reg = await _get_registration(db, user_id, session_id)
    if not reg:
        raise HTTPException(400, "You must register for IEPOD first")
    if reg["status"] != "approved":
        raise HTTPException(400, "Your IEPOD registration must be approved before joining a team")
    if reg.get("teamId"):
        raise HTTPException(400, "You are already on a team")

    team = await db.iepod_teams.find_one({"_id": _oid(team_id)})
    if not team:
        raise HTTPException(404, "Team not found")
    if team["status"] != "forming":
        raise HTTPException(400, "This team is no longer accepting members")
    if len(team["members"]) >= team["maxMembers"]:
        raise HTTPException(400, "This team is full")

    member = {
        "userId": user_id,
        "userName": user_name,
        "role": "member",
        "joinedAt": datetime.now(timezone.utc),
    }

    await db.iepod_teams.update_one(
        {"_id": _oid(team_id)},
        {"$push": {"members": member}, "$set": {"updatedAt": datetime.now(timezone.utc)}},
    )
    await db.iepod_registrations.update_one(
        {"_id": reg["_id"]},
        {"$set": {"teamId": team_id, "updatedAt": datetime.now(timezone.utc)}},
    )

    # Award points for joining a team
    await _award_points(
        db, user_id, user_name, session_id,
        "team_formed", 10, f"Joined team '{team['name']}'",
        team_id,
    )

    return {"message": f"Joined team '{team['name']}'"}


@router.post("/teams/{team_id}/leave")
async def leave_team(
    team_id: str,
    user: dict = Depends(get_current_user),
    session: dict = Depends(get_current_session),
):
    """Leave a hackathon team. Leader cannot leave (must disband)."""
    db = get_database()
    session_id = str(session["_id"])
    user_id = user["_id"]

    team = await db.iepod_teams.find_one({"_id": _oid(team_id)})
    if not team:
        raise HTTPException(404, "Team not found")
    if team["leaderId"] == user_id:
        raise HTTPException(400, "Team leader cannot leave. Disband the team instead or transfer leadership.")

    await db.iepod_teams.update_one(
        {"_id": _oid(team_id)},
        {
            "$pull": {"members": {"userId": user_id}},
            "$set": {"updatedAt": datetime.now(timezone.utc)},
        },
    )
    await db.iepod_registrations.update_one(
        {"userId": user_id, "sessionId": session_id},
        {"$set": {"teamId": None, "updatedAt": datetime.now(timezone.utc)}},
    )
    return {"message": "Left the team"}


@router.patch("/teams/{team_id}")
async def update_team(
    team_id: str,
    data: TeamUpdate,
    user: dict = Depends(get_current_user),
):
    """Update team details (leader or admin only)."""
    db = get_database()
    team = await db.iepod_teams.find_one({"_id": _oid(team_id)})
    if not team:
        raise HTTPException(404, "Team not found")

    # Check if leader or admin (use permission check, not stale JWT role)
    is_admin = False
    try:
        from ..core.permissions import get_user_permissions
        active_session = await db.sessions.find_one({"isActive": True})
        if active_session:
            perms = await get_user_permissions(str(user["_id"]), str(active_session["_id"]))
            is_admin = "iepod:manage" in perms
    except Exception:
        pass
    if team["leaderId"] != user["_id"] and not is_admin:
        raise HTTPException(403, "Only the team leader or admins can edit the team")

    updates = {k: v for k, v in data.model_dump(exclude_unset=True).items()}
    if not updates:
        raise HTTPException(400, "No fields to update")
    updates["updatedAt"] = datetime.now(timezone.utc)
    await db.iepod_teams.update_one({"_id": _oid(team_id)}, {"$set": updates})
    updated = await db.iepod_teams.find_one({"_id": _oid(team_id)})
    updated["_id"] = str(updated["_id"])
    return updated


# Admin: assign mentor to team
@router.post("/teams/{team_id}/assign-mentor")
async def assign_mentor_to_team(
    team_id: str,
    request: Request,
    mentor_user_id: str = Query(..., description="User ID of the mentor"),
    user: dict = Depends(require_permission("iepod:manage")),
):
    db = get_database()
    team = await db.iepod_teams.find_one({"_id": _oid(team_id)})
    if not team:
        raise HTTPException(404, "Team not found")

    # Look up mentor name
    mentor = await db.users.find_one({"_id": _oid(mentor_user_id)})
    mentor_name = "Unknown"
    if mentor:
        mentor_name = f"{mentor.get('firstName', '')} {mentor.get('lastName', '')}".strip()

    await db.iepod_teams.update_one(
        {"_id": _oid(team_id)},
        {"$set": {"mentorId": mentor_user_id, "mentorName": mentor_name, "updatedAt": datetime.now(timezone.utc)}},
    )

    await AuditLogger.log(
        action="iepod.mentor_assigned",
        actor_id=str(user["_id"]),
        actor_email=user.get("email", "unknown"),
        resource_type="iepod_team",
        resource_id=team_id,
        details={"mentor": mentor_name, "team": team.get("name")},
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )

    return {"message": f"Assigned {mentor_name} as mentor"}


# ═══════════════════════════════════════════════════════════════════
# SUBMISSIONS (Iterative — "Pitch Your Process")
# ═══════════════════════════════════════════════════════════════════

@router.post("/teams/{team_id}/submissions", status_code=201)
async def create_submission(
    team_id: str,
    data: SubmissionCreate,
    user: dict = Depends(get_current_user),
    session: dict = Depends(get_current_session),
):
    """Submit an iteration for your hackathon team."""
    db = get_database()
    session_id = str(session["_id"])
    user_id = user["_id"]

    team = await db.iepod_teams.find_one({"_id": _oid(team_id)})
    if not team:
        raise HTTPException(404, "Team not found")

    # Must be a team member
    is_member = any(m["userId"] == user_id for m in team.get("members", []))
    if not is_member:
        raise HTTPException(403, "You are not a member of this team")

    # External students cannot create submissions
    reg = await _get_registration(db, user_id, session_id)
    if reg and reg.get("isExternalStudent"):
        raise HTTPException(403, "Submission creation is restricted to IPE students")

    if not validate_no_scripts(data.title) or not validate_no_scripts(data.description):
        raise HTTPException(400, "Invalid characters detected")

    doc = data.model_dump()
    doc["teamId"] = team_id
    doc["teamName"] = team["name"]
    doc["sessionId"] = session_id
    doc["status"] = "draft"
    doc["feedback"] = None
    doc["score"] = None
    doc["reviewedBy"] = None
    doc["submittedAt"] = datetime.now(timezone.utc)
    doc["updatedAt"] = datetime.now(timezone.utc)

    result = await db.iepod_submissions.insert_one(doc)

    # Increment team submission count
    await db.iepod_teams.update_one(
        {"_id": _oid(team_id)},
        {"$inc": {"submissionCount": 1}, "$set": {"updatedAt": datetime.now(timezone.utc)}},
    )

    created = await db.iepod_submissions.find_one({"_id": result.inserted_id})
    created["_id"] = str(created["_id"])
    return created


@router.get("/teams/{team_id}/submissions")
async def list_team_submissions(
    team_id: str,
    user: dict = Depends(get_current_user),
):
    """List all submissions for a team."""
    db = get_database()
    cursor = db.iepod_submissions.find(
        {"teamId": team_id}
    ).sort("iterationNumber", 1)
    items = []
    async for doc in cursor:
        doc["_id"] = str(doc["_id"])
        items.append(doc)
    return items


@router.patch("/submissions/{sub_id}/submit")
async def submit_iteration(
    sub_id: str,
    user: dict = Depends(get_current_user),
    session: dict = Depends(get_current_session),
):
    """Mark a draft submission as submitted."""
    db = get_database()
    doc = await db.iepod_submissions.find_one({"_id": _oid(sub_id)})
    if not doc:
        raise HTTPException(404, "Submission not found")
    if doc["status"] != "draft":
        raise HTTPException(400, "Only draft submissions can be submitted")

    # Must be a team member
    team = await db.iepod_teams.find_one({"_id": _oid(doc["teamId"])})
    if not team or not any(m["userId"] == user["_id"] for m in team.get("members", [])):
        raise HTTPException(403, "You are not a member of this team")

    await db.iepod_submissions.update_one(
        {"_id": _oid(sub_id)},
        {"$set": {"status": "submitted", "updatedAt": datetime.now(timezone.utc)}},
    )

    # Award points to all team members
    session_id = str(session["_id"])
    for member in team.get("members", []):
        await _award_points(
            db, member["userId"], member["userName"], session_id,
            "submission", 20,
            f"Iteration #{doc['iterationNumber']} submitted",
            sub_id,
        )

    return {"message": "Submission marked as submitted"}


# Admin: review a submission
@router.patch("/submissions/{sub_id}/review")
async def review_submission(
    sub_id: str,
    data: SubmissionReview,
    request: Request,
    user: dict = Depends(require_permission("iepod:manage")),
):
    db = get_database()
    doc = await db.iepod_submissions.find_one({"_id": _oid(sub_id)})
    if not doc:
        raise HTTPException(404, "Submission not found")

    updates = data.model_dump(exclude_unset=True)
    updates["reviewedBy"] = user["_id"]
    updates["updatedAt"] = datetime.now(timezone.utc)
    await db.iepod_submissions.update_one({"_id": _oid(sub_id)}, {"$set": updates})
    updated = await db.iepod_submissions.find_one({"_id": _oid(sub_id)})
    updated["_id"] = str(updated["_id"])

    await AuditLogger.log(
        action="iepod.submission_reviewed",
        actor_id=str(user["_id"]),
        actor_email=user.get("email", "unknown"),
        resource_type="iepod_submission",
        resource_id=sub_id,
        details={"status": updates.get("status"), "score": updates.get("score"), "teamId": doc.get("teamId")},
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )

    return updated


# Admin: list all submissions
@router.get("/submissions")
async def list_all_submissions(
    team_id: Optional[str] = None,
    status_filter: Optional[str] = Query(None, alias="status"),
    limit: int = Query(50, ge=1, le=200),
    skip: int = Query(0, ge=0),
    user: dict = Depends(require_permission("iepod:manage")),
    session: dict = Depends(get_current_session),
):
    db = get_database()
    query: dict = {"sessionId": str(session["_id"])}
    if team_id:
        query["teamId"] = team_id
    if status_filter:
        query["status"] = status_filter
    cursor = db.iepod_submissions.find(query).sort("submittedAt", -1).skip(skip).limit(limit)
    items = []
    async for doc in cursor:
        doc["_id"] = str(doc["_id"])
        items.append(doc)
    total = await db.iepod_submissions.count_documents(query)
    return {"submissions": items, "total": total}


# ═══════════════════════════════════════════════════════════════════
# QUIZZES & CHALLENGES
# ═══════════════════════════════════════════════════════════════════

@router.post("/quizzes", status_code=201)
async def create_quiz(
    data: QuizCreate,
    request: Request,
    user: dict = Depends(require_permission("iepod:manage")),
    session: dict = Depends(get_current_session),
):
    """Admin: Create a new quiz / challenge."""
    db = get_database()
    if not validate_no_scripts(data.title):
        raise HTTPException(400, "Invalid characters detected")

    doc = data.model_dump()
    doc["sessionId"] = str(session["_id"])
    doc["createdBy"] = user["_id"]
    doc["participantCount"] = 0
    doc["createdAt"] = datetime.now(timezone.utc)
    doc["updatedAt"] = datetime.now(timezone.utc)

    result = await db.iepod_quizzes.insert_one(doc)
    created = await db.iepod_quizzes.find_one({"_id": result.inserted_id})
    created["_id"] = str(created["_id"])

    await AuditLogger.log(
        action="iepod.quiz_created",
        actor_id=str(user["_id"]),
        actor_email=user.get("email", "unknown"),
        resource_type="iepod_quiz",
        resource_id=str(result.inserted_id),
        details={"title": data.title, "type": data.quizType},
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )

    return created


@router.get("/quizzes")
async def list_quizzes(
    live_only: bool = Query(False),
    quiz_type: Optional[str] = None,
    user: dict = Depends(get_current_user),
    session: dict = Depends(get_current_session),
):
    """List quizzes. Students see public info only; admins see full details."""
    db = get_database()
    query: dict = {"sessionId": str(session["_id"])}
    if live_only:
        query["isLive"] = True
    if quiz_type:
        query["quizType"] = quiz_type

    # Check admin via permissions (not stale JWT role)
    is_admin = False
    try:
        from ..core.permissions import get_user_permissions
        perms = await get_user_permissions(str(user["_id"]), str(session["_id"]))
        is_admin = "iepod:manage" in perms
    except Exception:
        pass
    cursor = db.iepod_quizzes.find(query).sort("createdAt", -1)
    items = []
    async for doc in cursor:
        doc["_id"] = str(doc["_id"])
        if not is_admin:
            # Strip correct answers for students
            items.append({
                "id": doc["_id"],
                "title": doc["title"],
                "description": doc.get("description"),
                "quizType": doc["quizType"],
                "timeLimitMinutes": doc.get("timeLimitMinutes"),
                "phase": doc.get("phase"),
                "questionCount": len(doc.get("questions", [])),
                "isLive": doc.get("isLive", False),
                "createdAt": doc["createdAt"],
            })
        else:
            items.append(doc)
    return items


@router.get("/quizzes/{quiz_id}")
async def get_quiz(
    quiz_id: str,
    user: dict = Depends(get_current_user),
):
    """Get quiz details. Students get questions without answers."""
    db = get_database()
    doc = await db.iepod_quizzes.find_one({"_id": _oid(quiz_id)})
    if not doc:
        raise HTTPException(404, "Quiz not found")

    # Check admin via permissions (not stale JWT role)
    is_admin = False
    try:
        from ..core.permissions import get_user_permissions
        active_session = await db.sessions.find_one({"isActive": True})
        if active_session:
            perms = await get_user_permissions(str(user["_id"]), str(active_session["_id"]))
            is_admin = "iepod:manage" in perms
    except Exception:
        pass

    if is_admin:
        doc["_id"] = str(doc["_id"])
        return doc

    # Check if student already took this quiz
    existing = await db.iepod_quiz_responses.find_one(
        {"quizId": quiz_id, "userId": user["_id"]}
    )
    if existing:
        existing["_id"] = str(existing["_id"])
        return {"alreadyTaken": True, "result": existing}

    # Return questions without correct answers
    questions = []
    for i, q in enumerate(doc.get("questions", [])):
        questions.append({
            "index": i,
            "question": q["question"],
            "options": q["options"],
            "points": q["points"],
        })

    return {
        "id": str(doc["_id"]),
        "title": doc["title"],
        "description": doc.get("description"),
        "quizType": doc["quizType"],
        "timeLimitMinutes": doc.get("timeLimitMinutes"),
        "questions": questions,
        "alreadyTaken": False,
    }


@router.post("/quizzes/{quiz_id}/answer", status_code=201)
async def submit_quiz_answers(
    quiz_id: str,
    data: QuizResponseCreate,
    user: dict = Depends(get_current_user),
    session: dict = Depends(get_current_session),
):
    """Student submits their quiz answers; auto-graded immediately."""
    db = get_database()
    user_id = user["_id"]

    quiz = await db.iepod_quizzes.find_one({"_id": _oid(quiz_id)})
    if not quiz:
        raise HTTPException(404, "Quiz not found")

    # Must have an approved IEPOD registration
    session_id = str(session["_id"])
    reg = await _get_registration(db, user_id, session_id)
    if not reg or reg["status"] != "approved":
        raise HTTPException(400, "You must have an approved IEPOD registration to take quizzes")

    # Prevent double-take
    existing = await db.iepod_quiz_responses.find_one(
        {"quizId": quiz_id, "userId": user_id}
    )
    if existing:
        raise HTTPException(400, "You have already taken this quiz")

    questions = quiz.get("questions", [])
    score = 0
    max_score = sum(q["points"] for q in questions)

    for ans in data.answers:
        if 0 <= ans.questionIndex < len(questions):
            q = questions[ans.questionIndex]
            if ans.selectedOption == q["correctIndex"]:
                score += q["points"]

    percentage = (score / max_score * 100) if max_score > 0 else 0
    user_name = f"{user.get('firstName', '')} {user.get('lastName', '')}".strip()

    response_doc = {
        "quizId": quiz_id,
        "userId": user_id,
        "userName": user_name,
        "sessionId": session_id,
        "answers": [a.model_dump() for a in data.answers],
        "score": score,
        "maxScore": max_score,
        "percentage": round(percentage, 1),
        "timeTakenSeconds": None,
        "submittedAt": datetime.now(timezone.utc),
    }

    result = await db.iepod_quiz_responses.insert_one(response_doc)

    # Update participant count
    await db.iepod_quizzes.update_one(
        {"_id": _oid(quiz_id)},
        {"$inc": {"participantCount": 1}},
    )

    # Award points based on score
    pts = max(5, int(score * 0.5))  # Minimum 5 points for participating
    await _award_points(
        db, user_id, user_name, session_id,
        "quiz_score", pts,
        f"Quiz '{quiz['title']}' — {score}/{max_score}",
        str(result.inserted_id),
    )

    created = await db.iepod_quiz_responses.find_one({"_id": result.inserted_id})
    created["_id"] = str(created["_id"])
    return created


@router.patch("/quizzes/{quiz_id}")
async def update_quiz(
    quiz_id: str,
    data: QuizUpdate,
    request: Request,
    user: dict = Depends(require_permission("iepod:manage")),
):
    db = get_database()
    updates = {k: v for k, v in data.model_dump(exclude_unset=True).items()}
    if not updates:
        raise HTTPException(400, "No fields to update")
    updates["updatedAt"] = datetime.now(timezone.utc)
    await db.iepod_quizzes.update_one({"_id": _oid(quiz_id)}, {"$set": updates})
    updated = await db.iepod_quizzes.find_one({"_id": _oid(quiz_id)})
    if not updated:
        raise HTTPException(404, "Quiz not found")
    updated["_id"] = str(updated["_id"])

    await AuditLogger.log(
        action="iepod.quiz_updated",
        actor_id=str(user["_id"]),
        actor_email=user.get("email", "unknown"),
        resource_type="iepod_quiz",
        resource_id=quiz_id,
        details={"title": updated.get("title"), "fields": list(updates.keys())},
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )

    return updated


@router.delete("/quizzes/{quiz_id}", status_code=204)
async def delete_quiz(
    quiz_id: str,
    request: Request,
    user: dict = Depends(require_permission("iepod:manage")),
):
    db = get_database()
    doc = await db.iepod_quizzes.find_one({"_id": _oid(quiz_id)})
    result = await db.iepod_quizzes.delete_one({"_id": _oid(quiz_id)})
    if result.deleted_count == 0:
        raise HTTPException(404, "Quiz not found")

    # Clean up quiz responses
    await db.iepod_quiz_responses.delete_many({"quizId": quiz_id})

    await AuditLogger.log(
        action="iepod.quiz_deleted",
        actor_id=str(user["_id"]),
        actor_email=user.get("email", "unknown"),
        resource_type="iepod_quiz",
        resource_id=quiz_id,
        details={"title": doc.get("title") if doc else None},
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )


# Admin: quiz results
@router.get("/quizzes/{quiz_id}/results")
async def get_quiz_results(
    quiz_id: str,
    user: dict = Depends(require_permission("iepod:manage")),
):
    """Admin: View all responses for a quiz."""
    db = get_database()
    cursor = db.iepod_quiz_responses.find(
        {"quizId": quiz_id}
    ).sort("score", -1)
    items = []
    async for doc in cursor:
        doc["_id"] = str(doc["_id"])
        items.append(doc)
    return items


# ═══════════════════════════════════════════════════════════════════
# POINTS & LEADERBOARD
# ═══════════════════════════════════════════════════════════════════

@router.get("/leaderboard")
async def get_leaderboard(
    limit: int = Query(50, ge=1, le=100),
    user: dict = Depends(get_current_user),
    session: dict = Depends(get_current_session),
):
    """Get the IEPOD leaderboard for the current session."""
    db = get_database()
    session_id = str(session["_id"])

    pipeline = [
        {"$match": {"sessionId": session_id}},
        {"$group": {
            "_id": "$userId",
            "userName": {"$first": "$userName"},
            "totalPoints": {"$sum": "$points"},
        }},
        {"$sort": {"totalPoints": -1}},
        {"$limit": limit},
    ]

    results = await db.iepod_points.aggregate(pipeline).to_list(length=limit)

    leaderboard = []
    for i, entry in enumerate(results, 1):
        # Get extra info from registration
        reg = await db.iepod_registrations.find_one(
            {"userId": entry["_id"], "sessionId": session_id}
        )
        society_name = None
        if reg and reg.get("societyId"):
            soc = await db.iepod_societies.find_one({"_id": _oid(reg["societyId"])})
            if soc:
                society_name = soc["name"]

        leaderboard.append({
            "userId": entry["_id"],
            "userName": entry["userName"],
            "totalPoints": entry["totalPoints"],
            "rank": i,
            "phase": reg["phase"] if reg else None,
            "societyName": society_name,
        })

    return leaderboard


# Admin: award bonus points
@router.post("/points/award")
async def award_bonus_points(
    data: PointAward,
    request: Request,
    user: dict = Depends(require_permission("iepod:manage")),
    session: dict = Depends(get_current_session),
):
    """Admin: Award bonus points to a student."""
    db = get_database()
    session_id = str(session["_id"])

    # Look up student
    student = await db.users.find_one({"_id": _oid(data.userId)})
    if not student:
        raise HTTPException(404, "Student not found")

    student_name = f"{student.get('firstName', '')} {student.get('lastName', '')}".strip()
    await _award_points(
        db, data.userId, student_name, session_id,
        "bonus", data.points, data.description,
    )

    await AuditLogger.log(
        action="iepod.bonus_points_awarded",
        actor_id=str(user["_id"]),
        actor_email=user.get("email", "unknown"),
        resource_type="iepod_points",
        resource_id=data.userId,
        details={"student": student_name, "points": data.points, "description": data.description},
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )

    return {"message": f"Awarded {data.points} points to {student_name}"}


# ═══════════════════════════════════════════════════════════════════
# ADMIN STATS / DASHBOARD
# ═══════════════════════════════════════════════════════════════════

@router.get("/stats")
async def get_iepod_stats(
    user: dict = Depends(require_permission("iepod:manage")),
    session: dict = Depends(get_current_session),
):
    """Admin: Get IEPOD program statistics."""
    db = get_database()
    session_id = str(session["_id"])

    reg_query = {"sessionId": session_id}

    total_registrations = await db.iepod_registrations.count_documents(reg_query)
    pending = await db.iepod_registrations.count_documents({**reg_query, "status": "pending"})
    approved = await db.iepod_registrations.count_documents({**reg_query, "status": "approved"})
    rejected = await db.iepod_registrations.count_documents({**reg_query, "status": "rejected"})
    completed = await db.iepod_registrations.count_documents({**reg_query, "status": "completed"})

    # Phase breakdown
    phase_stimulate = await db.iepod_registrations.count_documents({**reg_query, "phase": "stimulate"})
    phase_carve = await db.iepod_registrations.count_documents({**reg_query, "phase": "carve"})
    phase_pitch = await db.iepod_registrations.count_documents({**reg_query, "phase": "pitch"})

    total_teams = await db.iepod_teams.count_documents({"sessionId": session_id})
    total_submissions = await db.iepod_submissions.count_documents({"sessionId": session_id})
    total_quizzes = await db.iepod_quizzes.count_documents({"sessionId": session_id})
    total_niche_audits = await db.iepod_niche_audits.count_documents({"sessionId": session_id})
    total_societies = await db.iepod_societies.count_documents({"isActive": True})

    # Society breakdown
    society_pipeline = [
        {"$match": {**reg_query, "societyId": {"$ne": None}}},
        {"$group": {"_id": "$societyId", "count": {"$sum": 1}}},
    ]
    society_stats_raw = await db.iepod_registrations.aggregate(society_pipeline).to_list(100)

    hub_roles = await db.roles.find(
        {
            "sessionId": session_id,
            "position": "iepod_hub_lead",
            "isActive": True,
            "societyId": {"$exists": True, "$ne": None},
        },
        {"userId": 1, "societyId": 1, "createdAt": 1},
    ).to_list(length=500)
    hub_user_ids = [
        ObjectId(str(r.get("userId")))
        for r in hub_roles
        if r.get("userId") and ObjectId.is_valid(str(r.get("userId")))
    ]
    hub_user_map: dict[str, dict] = {}
    if hub_user_ids:
        hub_users = await db.users.find(
            {"_id": {"$in": hub_user_ids}},
            {"firstName": 1, "lastName": 1, "email": 1, "institutionalEmail": 1},
        ).to_list(length=1000)
        hub_user_map = {str(u["_id"]): u for u in hub_users}

    hub_by_society: dict[str, dict] = {}
    for role_doc in hub_roles:
        society_id = str(role_doc.get("societyId") or "").strip()
        user_id = str(role_doc.get("userId") or "").strip()
        if not society_id or not user_id:
            continue
        existing = hub_by_society.get(society_id)
        existing_created = existing.get("_createdAt") if existing else None
        created_at = role_doc.get("createdAt")
        if existing and existing_created and created_at and existing_created > created_at:
            continue

        user_doc = hub_user_map.get(user_id)
        full_name = ""
        email = ""
        if user_doc:
            full_name = f"{user_doc.get('firstName', '')} {user_doc.get('lastName', '')}".strip()
            email = user_doc.get("institutionalEmail") or user_doc.get("email") or ""

        hub_by_society[society_id] = {
            "name": full_name or None,
            "email": email or None,
            "_createdAt": created_at,
        }

    society_stats = []
    for s in society_stats_raw:
        soc = await db.iepod_societies.find_one({"_id": _oid(s["_id"])})
        lead = hub_by_society.get(str(s.get("_id") or ""))
        society_stats.append({
            "societyId": s["_id"],
            "societyName": soc["name"] if soc else "Unknown",
            "memberCount": s["count"],
            "hubLeadName": lead.get("name") if lead else None,
            "hubLeadEmail": lead.get("email") if lead else None,
        })

    return {
        "totalRegistrations": total_registrations,
        "pending": pending,
        "approved": approved,
        "rejected": rejected,
        "completed": completed,
        "phases": {
            "stimulate": phase_stimulate,
            "carve": phase_carve,
            "pitch": phase_pitch,
        },
        "totalTeams": total_teams,
        "totalSubmissions": total_submissions,
        "totalQuizzes": total_quizzes,
        "totalNicheAudits": total_niche_audits,
        "totalSocieties": total_societies,
        "societyBreakdown": society_stats,
    }
