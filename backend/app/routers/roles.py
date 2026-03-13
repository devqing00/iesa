"""
Role Management Router

Handles assignment of executive positions to students for specific sessions.
Admins can create, view, update, and delete role assignments.
"""

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from typing import List, Optional
from bson import ObjectId
from datetime import datetime, timezone

from app.core.security import get_current_user
from app.core.permissions import require_permission, PERMISSIONS, DEFAULT_PERMISSIONS
from app.core.audit import AuditLogger
from app.models.role import Role, RoleCreate, RoleUpdate
from app.models.user import User
from app.db import get_database

router = APIRouter(prefix="/api/v1/roles", tags=["roles"])


# ── Permission catalogue endpoints ───────────────────────────────

@router.get("/permissions", dependencies=[Depends(get_current_user)])
async def list_all_permissions():
    """
    Return every permission key → description so the admin UI can build
    its checkbox grid without hardcoding anything on the frontend.
    Grouped by domain (announcement, event, payment …).
    """
    grouped: dict = {}
    for key, description in PERMISSIONS.items():
        domain = key.split(":")[0]
        grouped.setdefault(domain, []).append({"key": key, "description": description})
    return {"permissions": PERMISSIONS, "grouped": grouped}


@router.get("/permissions/defaults", dependencies=[Depends(get_current_user)])
async def list_default_permissions():
    """
    Return the default permission set for every defined position.
    Useful so the admin UI can visually distinguish
    'position defaults' from 'extra granted permissions'.
    """
    return {"defaults": DEFAULT_PERMISSIONS}


@router.post("/", response_model=Role, dependencies=[Depends(require_permission("role:create"))])
async def create_role(
    role: RoleCreate,
    request: Request,
    current_user: User = Depends(get_current_user)
):
    """
    Assign a role to a user for a specific session.
    Only admins can create role assignments.
    """
    db = get_database()
    roles = db["roles"]
    users = db["users"]
    sessions = db["sessions"]
    
    # Verify user exists
    if not ObjectId.is_valid(role.userId):
        raise HTTPException(status_code=400, detail="Invalid user ID")
    user = await users.find_one({"_id": ObjectId(role.userId)})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Verify session exists
    if not ObjectId.is_valid(role.sessionId):
        raise HTTPException(status_code=400, detail="Invalid session ID")
    session = await sessions.find_one({"_id": ObjectId(role.sessionId)})
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    # C3: Prevent self-assignment unless user is bootstrapping super_admin
    # or already holds super_admin (can self-manage additional roles).
    assigner_id = str(current_user.get("_id") or current_user.get("id", ""))
    if role.userId == assigner_id:
        assigner_has_super_admin = await roles.find_one({
            "userId": assigner_id,
            "position": "super_admin",
            "isActive": True,
        })
        if role.position != "super_admin" and not assigner_has_super_admin:
            raise HTTPException(
                status_code=400,
                detail="Cannot assign a role to yourself unless you are super_admin"
            )
    
    # C2+M4: Validate permission keys against the registry
    if role.permissions:
        invalid_perms = set(role.permissions) - set(PERMISSIONS.keys())
        if invalid_perms:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid permission keys: {', '.join(sorted(invalid_perms))}"
            )
    
    # Positions that allow multiple holders (admin roles)
    MULTI_HOLDER_POSITIONS = {"super_admin", "admin"}
    
    if role.position not in MULTI_HOLDER_POSITIONS:
        # Check if position already filled for this session
        existing = await roles.find_one({
            "sessionId": role.sessionId,
            "position": role.position
        })
        if existing:
            current_holder = await users.find_one({"_id": ObjectId(existing["userId"])})
            holder_name = f"{current_holder.get('firstName', '')} {current_holder.get('lastName', '')}" if current_holder else "Unknown"
            raise HTTPException(
                status_code=400,
                detail=f"Position '{role.position}' is already held by {holder_name} in session {session['name']}"
            )
    else:
        # For multi-holder positions, prevent duplicate assignment to same user
        existing = await roles.find_one({
            "userId": role.userId,
            "position": role.position,
            "isActive": True
        })
        if existing:
            # Idempotent bootstrap path: if super_admin self-assignment already exists,
            # return the existing assignment instead of erroring.
            if role.position == "super_admin" and role.userId == assigner_id:
                existing["id"] = str(existing.pop("_id"))
                return Role(**existing)
            raise HTTPException(
                status_code=400,
                detail=f"User already has the '{role.position}' position"
            )
    
    # Create role assignment
    role_data = role.model_dump()
    role_data["assignedAt"] = datetime.now(timezone.utc)
    role_data["assignedBy"] = current_user.get("_id") or str(current_user.get("id", ""))
    role_data["isActive"] = True
    role_data["createdAt"] = datetime.now(timezone.utc)
    role_data["updatedAt"] = datetime.now(timezone.utc)
    
    result = await roles.insert_one(role_data)
    created_role = await roles.find_one({"_id": result.inserted_id})
    
    # ── Auto-sync user document role field ──
    # This ensures the "Switch to Admin" button and admin layout access work
    ADMIN_POSITIONS = {"super_admin", "admin"}
    if role.position in ADMIN_POSITIONS:
        target_role = "admin"
    else:
        target_role = "exco"
    
    current_user_role = user.get("role", "student")
    # Only escalate role, never downgrade (admin > exco > student)
    ROLE_PRIORITY = {"student": 0, "exco": 1, "admin": 2}
    if ROLE_PRIORITY.get(target_role, 0) > ROLE_PRIORITY.get(current_user_role, 0):
        await users.update_one(
            {"_id": ObjectId(role.userId)},
            {"$set": {"role": target_role, "updatedAt": datetime.now(timezone.utc)}}
        )
    
    # Bust permissions cache for this user
    from app.core.permissions import invalidate_permissions_cache
    invalidate_permissions_cache(role.userId)
    
    # Convert ObjectId to string
    created_role["id"] = str(created_role.pop("_id"))
    
    # Audit log
    await AuditLogger.log(
        action=AuditLogger.ROLE_ASSIGNED,
        actor_id=current_user.get("_id") or str(current_user.get("id", "")),
        actor_email=current_user.get("email", "unknown"),
        resource_type="role",
        resource_id=created_role["id"],
        session_id=role.sessionId,
        details={"position": role.position, "userId": role.userId},
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    
    return Role(**created_role)


# ─── Batch helpers to avoid N+1 queries ────────────────────────────

_USER_FIELDS_FULL = {"firstName": 1, "lastName": 1, "email": 1, "matricNumber": 1, "profilePhotoURL": 1}
_USER_FIELDS_PUBLIC = {"firstName": 1, "lastName": 1, "email": 1}


async def _batch_users(db, user_ids: list, projection: dict | None = None) -> dict:
    """Batch-fetch users by string IDs → {str_id: doc} mapping."""
    if not user_ids:
        return {}
    oids = [ObjectId(uid) for uid in set(user_ids) if ObjectId.is_valid(uid)]
    if not oids:
        return {}
    proj = projection or _USER_FIELDS_FULL
    cursor = db["users"].find({"_id": {"$in": oids}}, proj)
    return {str(u["_id"]): u async for u in cursor}


async def _batch_sessions(db, session_ids: list) -> dict:
    """Batch-fetch sessions by string IDs → {str_id: doc} mapping."""
    if not session_ids:
        return {}
    oids = [ObjectId(sid) for sid in set(session_ids) if ObjectId.is_valid(sid)]
    if not oids:
        return {}
    cursor = db["sessions"].find({"_id": {"$in": oids}}, {"name": 1, "isActive": 1})
    return {str(s["_id"]): s async for s in cursor}


def _user_info(user_map: dict, user_id: str, public: bool = False) -> dict | None:
    """Build user info dict from batch-loaded map."""
    u = user_map.get(user_id)
    if not u:
        return None
    if public:
        return {"firstName": u.get("firstName", ""), "lastName": u.get("lastName", ""), "email": u.get("email", "")}
    return {
        "id": str(u["_id"]),
        "firstName": u.get("firstName", ""),
        "lastName": u.get("lastName", ""),
        "email": u.get("email", ""),
        "matricNumber": u.get("matricNumber", ""),
        "profilePhotoURL": u.get("profilePhotoURL", ""),
    }


def _session_info(session_map: dict, session_id: str) -> dict | None:
    """Build session info dict from batch-loaded map."""
    s = session_map.get(session_id)
    if not s:
        return None
    return {"id": str(s["_id"]), "name": s.get("name", ""), "isActive": s.get("isActive", False)}


@router.get("/", dependencies=[Depends(require_permission("role:view"))])
async def list_roles(
    session_id: Optional[str] = Query(None, description="Filter by session ID"),
    user_id: Optional[str] = Query(None, description="Filter by user ID"),
    position: Optional[str] = Query(None, description="Filter by position"),
    current_user: User = Depends(get_current_user)
):
    """
    List role assignments with optional filters.
    Returns roles with populated user and session details.
    """
    db = get_database()
    roles_collection = db["roles"]
    users = db["users"]
    sessions = db["sessions"]
    
    # Build query
    query = {}
    if session_id:
        query["sessionId"] = session_id
    if user_id:
        query["userId"] = user_id
    if position:
        query["position"] = position
    
    # Fetch roles
    cursor = roles_collection.find(query).sort("createdAt", -1)
    roles_list = await cursor.to_list(length=None)
    
    # Populate user and session details (batch to avoid N+1)
    user_ids = [r["userId"] for r in roles_list if r.get("userId")]
    session_ids = [r["sessionId"] for r in roles_list if r.get("sessionId")]
    user_map = await _batch_users(db, user_ids)
    session_map = await _batch_sessions(db, session_ids)

    result = []
    for role in roles_list:
        role["id"] = str(role.pop("_id"))
        role["user"] = _user_info(user_map, role.get("userId", ""))
        role["session"] = _session_info(session_map, role.get("sessionId", ""))
        result.append(role)
    
    return result


@router.get("/executives", dependencies=[Depends(require_permission("role:view"))])
async def get_executives(
    session_id: Optional[str] = Query(None, description="Filter by session ID. Defaults to active session."),
    current_user: User = Depends(get_current_user)
):
    """
    Get executive team for a session.
    If no session_id provided, returns excos for active session.
    """
    db = get_database()
    roles_collection = db["roles"]
    users = db["users"]
    sessions = db["sessions"]
    
    # If no session_id, get active session
    if not session_id:
        active_session = await sessions.find_one({"isActive": True})
        if not active_session:
            return []
        session_id = str(active_session["_id"])
    
    # Define executive positions hierarchy
    exec_positions = [
        "president",
        "vice_president",
        "general_secretary",
        "assistant_general_secretary",
        "treasurer",
        "social_director",
        "sports_secretary",
        "assistant_sports_secretary",
        "pro",
        "financial_secretary",
    ]
    exec_position_aliases = {
        "social_director": {"social_director", "director_of_socials"},
        "sports_secretary": {"sports_secretary", "director_of_sports"},
    }
    
    # Fetch roles for session
    cursor = roles_collection.find({"sessionId": session_id})
    roles_list = await cursor.to_list(length=None)
    
    # Organize by position (batch user lookup)
    exec_roles = [
        r for r in roles_list
        if r["position"] in exec_positions or any(r["position"] in aliases for aliases in exec_position_aliases.values())
    ]
    user_map = await _batch_users(db, [r["userId"] for r in exec_roles])

    executives = {}
    for role in exec_roles:
        canonical_position = role["position"]
        for key, aliases in exec_position_aliases.items():
            if role["position"] in aliases:
                canonical_position = key
                break
        info = _user_info(user_map, role["userId"])
        if info:
            executives[canonical_position] = {
                "position": canonical_position,
                "user": info,
                "assignedAt": role.get("createdAt")
            }
    
    # Return in hierarchy order
    result = []
    for position in exec_positions:
        if position in executives:
            result.append(executives[position])
    
    return result


@router.get("/committees", dependencies=[Depends(require_permission("role:view"))])
async def get_committees(
    session_id: Optional[str] = Query(None, description="Filter by session ID. Defaults to active session."),
    current_user: User = Depends(get_current_user)
):
    """
    Get committee heads for a session.
    If no session_id provided, returns committees for active session.
    """
    db = get_database()
    roles_collection = db["roles"]
    users = db["users"]
    sessions = db["sessions"]
    
    # If no session_id, get active session
    if not session_id:
        active_session = await sessions.find_one({"isActive": True})
        if not active_session:
            return []
        session_id = str(active_session["_id"])
    
    # Define committee positions
    committee_positions = [
        "committee_academic",
        "committee_welfare",
        "committee_sports",
        "committee_socials",
    ]
    
    # Fetch roles for session
    cursor = roles_collection.find({"sessionId": session_id})
    roles_list = await cursor.to_list(length=None)
    
    # Organize by position (batch user lookup)
    comm_roles = [r for r in roles_list if r["position"] in committee_positions]
    user_map = await _batch_users(db, [r["userId"] for r in comm_roles])

    committees = {}
    for role in comm_roles:
        info = _user_info(user_map, role["userId"])
        if info:
            committees[role["position"]] = {
                "position": role["position"],
                "user": info,
                "assignedAt": role.get("createdAt")
            }
    
    # Return in order
    result = []
    for position in committee_positions:
        if position in committees:
            result.append(committees[position])
    
    return result


@router.get("/{role_id}", dependencies=[Depends(require_permission("role:view"))])
async def get_role(
    role_id: str,
    current_user: User = Depends(get_current_user)
):
    """Get a specific role assignment by ID"""
    db = get_database()
    roles_collection = db["roles"]
    users = db["users"]
    sessions = db["sessions"]
    
    try:
        role = await roles_collection.find_one({"_id": ObjectId(role_id)})
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid role ID")
    
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
    
    # Populate user and session
    user = await users.find_one({"_id": ObjectId(role["userId"])})
    session = await sessions.find_one({"_id": ObjectId(role["sessionId"])})
    
    role["id"] = str(role.pop("_id"))
    role["user"] = {
        "id": str(user["_id"]),
        "firstName": user.get("firstName", ""),
        "lastName": user.get("lastName", ""),
        "email": user.get("email", ""),
        "matricNumber": user.get("matricNumber", "")
    } if user else None
    
    role["session"] = {
        "id": str(session["_id"]),
        "name": session.get("name", ""),
        "isActive": session.get("isActive", False)
    } if session else None
    
    return role


@router.patch("/{role_id}", dependencies=[Depends(require_permission("role:edit"))])
async def update_role(
    role_id: str,
    role_update: RoleUpdate,
    request: Request,
    current_user: User = Depends(get_current_user)
):
    """
    Update a role assignment.
    Only admins can update roles.
    """
    db = get_database()
    roles = db["roles"]
    
    try:
        existing = await roles.find_one({"_id": ObjectId(role_id)})
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid role ID")
    
    if not existing:
        raise HTTPException(status_code=404, detail="Role not found")
    
    # Update only provided fields
    update_data = role_update.model_dump(exclude_unset=True)
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")
    
    # C2: Validate permission keys against the registry
    if "permissions" in update_data and update_data["permissions"] is not None:
        invalid_perms = set(update_data["permissions"]) - set(PERMISSIONS.keys())
        if invalid_perms:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid permission keys: {', '.join(sorted(invalid_perms))}"
            )
    
    # If changing position, check if new position is available
    if "position" in update_data:
        conflict = await roles.find_one({
            "sessionId": existing["sessionId"],
            "position": update_data["position"],
            "_id": {"$ne": ObjectId(role_id)}
        })
        if conflict:
            raise HTTPException(
                status_code=400,
                detail=f"Position '{update_data['position']}' is already filled"
            )
    
    update_data["updatedAt"] = datetime.now(timezone.utc)
    
    await roles.update_one(
        {"_id": ObjectId(role_id)},
        {"$set": update_data}
    )
    
    updated_role = await roles.find_one({"_id": ObjectId(role_id)})
    updated_role["id"] = str(updated_role.pop("_id"))
    
    # Bust permissions cache for the affected user
    from app.core.permissions import invalidate_permissions_cache
    invalidate_permissions_cache(updated_role.get("userId") or existing.get("userId"))
    
    # Audit log
    await AuditLogger.log(
        action="role.updated",
        actor_id=current_user.get("_id") or str(current_user.get("id", "")),
        actor_email=current_user.get("email", "unknown"),
        resource_type="role",
        resource_id=role_id,
        details={"changes": role_update.model_dump(exclude_unset=True)},
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    
    return Role(**updated_role)


@router.delete("/{role_id}", dependencies=[Depends(require_permission("role:delete"))])
async def delete_role(
    role_id: str,
    request: Request,
    current_user: User = Depends(get_current_user)
):
    """
    Remove a role assignment.
    Only admins can delete roles.
    """
    db = get_database()
    roles = db["roles"]
    
    try:
        role_doc = await roles.find_one({"_id": ObjectId(role_id)})
        result = await roles.delete_one({"_id": ObjectId(role_id)})
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid role ID")
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Role not found")
    
    # Bust permissions cache for the affected user
    if role_doc:
        from app.core.permissions import invalidate_permissions_cache
        invalidate_permissions_cache(role_doc.get("userId"))
        
        # ── Auto-sync: revert user role if no remaining roles ──
        affected_user_id = role_doc.get("userId")
        remaining = await roles.find_one({
            "userId": affected_user_id,
            "isActive": True
        })
        if not remaining:
            await db["users"].update_one(
                {"_id": ObjectId(affected_user_id)},
                {"$set": {"role": "student", "updatedAt": datetime.now(timezone.utc)}}
            )
        else:
            # Recalculate: if any remaining role is admin-level, keep admin; else exco
            admin_positions = {"super_admin", "admin"}
            remaining_roles = await roles.find(
                {"userId": affected_user_id, "isActive": True}
            ).to_list(length=100)
            has_admin = any(r.get("position") in admin_positions for r in remaining_roles)
            new_role = "admin" if has_admin else "exco"
            await db["users"].update_one(
                {"_id": ObjectId(affected_user_id)},
                {"$set": {"role": new_role, "updatedAt": datetime.now(timezone.utc)}}
            )
    
    # Audit log
    await AuditLogger.log(
        action=AuditLogger.ROLE_REVOKED,
        actor_id=current_user.get("_id") or str(current_user.get("id", "")),
        actor_email=current_user.get("email", "unknown"),
        resource_type="role",
        resource_id=role_id,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    
    return {"message": "Role assignment deleted successfully"}


@router.get("/my-roles/current")
async def get_my_roles(current_user: User = Depends(get_current_user)):
    """
    Get current user's role assignments across all sessions.
    """
    db = get_database()
    roles_collection = db["roles"]
    sessions = db["sessions"]
    
    # Fetch user's roles
    cursor = roles_collection.find({"userId": current_user.get("_id", "")}).sort("createdAt", -1)
    roles_list = await cursor.to_list(length=None)
    
    # Populate session details (batch)
    session_map = await _batch_sessions(db, [r["sessionId"] for r in roles_list if r.get("sessionId")])

    result = []
    for role in roles_list:
        role["id"] = str(role.pop("_id"))
        role["session"] = _session_info(session_map, role.get("sessionId", ""))
        result.append(role)
    
    return result


# ─── Public endpoints (no auth required) ──────────────────────────


@router.get("/public/executives")
async def get_public_executives():
    """
    Public endpoint: Get executive team for the active session.
    Returns name and email only (no matric numbers).
    """
    db = get_database()
    roles_collection = db["roles"]
    users = db["users"]
    sessions = db["sessions"]

    active_session = await sessions.find_one({"isActive": True})
    if not active_session:
        return []
    session_id = str(active_session["_id"])

    exec_positions = [
        "president",
        "vice_president",
        "general_secretary",
        "assistant_general_secretary",
        "treasurer",
        "social_director",
        "sports_secretary",
        "assistant_sports_secretary",
        "pro",
        "financial_secretary",
    ]
    exec_position_aliases = {
        "social_director": {"social_director", "director_of_socials"},
        "sports_secretary": {"sports_secretary", "director_of_sports"},
    }

    cursor = roles_collection.find({"sessionId": session_id})
    roles_list = await cursor.to_list(length=None)

    executives = {}
    exec_roles = [
        r for r in roles_list
        if r["position"] in exec_positions or any(r["position"] in aliases for aliases in exec_position_aliases.values())
    ]
    user_map = await _batch_users(db, [r["userId"] for r in exec_roles], _USER_FIELDS_PUBLIC)

    for role in exec_roles:
        canonical_position = role["position"]
        for key, aliases in exec_position_aliases.items():
            if role["position"] in aliases:
                canonical_position = key
                break
        info = _user_info(user_map, role["userId"], public=True)
        if info:
            executives[canonical_position] = {
                "position": canonical_position,
                "user": info,
            }

    return [executives[p] for p in exec_positions if p in executives]


@router.get("/public/committees")
async def get_public_committees():
    """
    Public endpoint: Get committee heads for the active session.
    Returns name and email only.
    """
    db = get_database()
    roles_collection = db["roles"]
    users = db["users"]
    sessions = db["sessions"]

    active_session = await sessions.find_one({"isActive": True})
    if not active_session:
        return []
    session_id = str(active_session["_id"])

    committee_positions = [
        "committee_academic", "committee_welfare",
        "committee_sports", "committee_socials",
    ]

    cursor = roles_collection.find({"sessionId": session_id})
    roles_list = await cursor.to_list(length=None)

    committees = {}
    comm_roles = [r for r in roles_list if r["position"] in committee_positions]
    user_map = await _batch_users(db, [r["userId"] for r in comm_roles], _USER_FIELDS_PUBLIC)

    for role in comm_roles:
        info = _user_info(user_map, role["userId"], public=True)
        if info:
            committees[role["position"]] = {
                "position": role["position"],
                "user": info,
            }

    return [committees[p] for p in committee_positions if p in committees]


@router.get("/public/class-reps")
async def get_public_class_reps():
    """
    Public endpoint: Get class reps for the active session.
    Returns name and email only.
    """
    db = get_database()
    roles_collection = db["roles"]
    users = db["users"]
    sessions = db["sessions"]

    active_session = await sessions.find_one({"isActive": True})
    if not active_session:
        return []
    session_id = str(active_session["_id"])

    cursor = roles_collection.find({"sessionId": session_id})
    roles_list = await cursor.to_list(length=None)

    rep_roles = [r for r in roles_list if r.get("position", "").startswith("class_rep_")]
    user_map = await _batch_users(db, [r["userId"] for r in rep_roles], _USER_FIELDS_PUBLIC)

    result = []
    for role in rep_roles:
        info = _user_info(user_map, role["userId"], public=True)
        if info:
            result.append({
                "position": role["position"],
                "user": info,
            })

    return result
