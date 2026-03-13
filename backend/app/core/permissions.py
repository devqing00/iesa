"""
Permission-Based RBAC System

Instead of checking "Is user President?", check "Does user have 'announcement:create' permission?"
This allows flexible role management across sessions.
"""

import time
from typing import List, Optional, Tuple
from fastapi import Depends, HTTPException, Header
from bson import ObjectId
from app.core.security import get_current_user
from app.models.user import User
from app.db import get_database


# ──────────────────────────────────────────────
# In-memory TTL caches — eliminates 2-3 DB round-trips per request.
# Active session changes ~twice per year; permissions change rarely.
# ──────────────────────────────────────────────

_active_session_cache: Tuple[Optional[dict], float] = (None, 0.0)
_ACTIVE_SESSION_TTL = 60  # seconds

_permissions_cache: dict[str, Tuple[List[str], float]] = {}
_PERMISSIONS_TTL = 120  # seconds


# Legacy permission aliases mapped to canonical keys.
# Keep this list tight and intentional so audits reflect current permission taxonomy.
LEGACY_PERMISSION_ALIASES: dict[str, str] = {
    "role:assign": "role:create",
    "role:revoke": "role:delete",
    "message:moderate": "messages:manage",
}


def normalize_permission(permission: str) -> str:
    """Return canonical permission key for a potentially-legacy permission."""
    return LEGACY_PERMISSION_ALIASES.get(permission, permission)


def normalize_permissions(permissions: List[str]) -> List[str]:
    """Normalize and de-duplicate permission keys while preserving order."""
    normalized: List[str] = []
    seen: set[str] = set()
    for permission in permissions or []:
        canonical = normalize_permission(permission)
        if canonical not in seen:
            seen.add(canonical)
            normalized.append(canonical)
    return normalized


def invalidate_session_cache():
    """Call after session activate/deactivate to bust the cache."""
    global _active_session_cache
    _active_session_cache = (None, 0.0)


def invalidate_permissions_cache(user_id: str | None = None):
    """Call after role assign/revoke. Pass user_id for targeted bust, or None for all."""
    global _permissions_cache
    if user_id:
        # Cache keys are "user_id:session_id" — remove all entries for this user
        keys_to_remove = [k for k in _permissions_cache if k.startswith(f"{user_id}:")]
        for k in keys_to_remove:
            _permissions_cache.pop(k, None)
    else:
        _permissions_cache.clear()


# Permission definitions - centralized permission registry
PERMISSIONS = {
    # Announcement permissions
    "announcement:create": "Create announcements",
    "announcement:edit": "Edit announcements",
    "announcement:delete": "Delete announcements",
    "announcement:view": "View announcements",
    
    # Event permissions
    "event:create": "Create events",
    "event:edit": "Edit events",
    "event:delete": "Delete events",
    "event:view": "View events",
    "event:manage": "Manage event registrations",
    
    # Payment permissions
    "payment:create": "Create payment requests",
    "payment:edit": "Edit payment requests",
    "payment:delete": "Delete payment requests",
    "payment:approve": "Approve/verify payments",
    "payment:view_all": "View all students' payments",
    
    # User management permissions
    "user:view_all": "View all users",
    "user:edit": "Edit user profiles",
    "user:delete": "Delete users",
    
    # Role management permissions
    "role:view": "View role assignments",
    "role:create": "Create / assign new roles",
    "role:edit": "Edit existing role assignments",
    "role:delete": "Delete role assignments",
    
    # Session management permissions
    "session:create": "Create new sessions",
    "session:edit": "Edit sessions",
    "session:view": "View sessions",
    "session:activate": "Activate/deactivate sessions",
    "session:delete": "Delete sessions",
    
    # Enrollment permissions
    "enrollment:view": "View all enrollments",
    "enrollment:create": "Enroll students in sessions",
    "enrollment:edit": "Edit enrollments",
    "enrollment:delete": "Delete enrollments",
    
    # Resource permissions
    "resource:view": "View resources",
    "resource:create": "Create / upload resources",
    "resource:edit": "Edit resources",
    "resource:delete": "Delete resources",
    "resource:approve": "Approve or reject resource submissions",
    
    # Timetable permissions
    "timetable:view": "View timetable",
    "timetable:create": "Create timetable entries",
    "timetable:edit": "Edit timetable entries",
    "timetable:cancel": "Cancel timetable entries",
    "timetable:exam": "Manage exam timetable entries",
    
    # Press permissions
    "press:access": "Access the IESA Press ecosystem",
    "press:create": "Create press articles",
    "press:edit": "Edit press articles",
    "press:review": "Review and moderate press articles",
    "press:publish": "Publish / approve press articles",
    "press:manage": "Full press management (head-level access)",
    
    # Audit log permissions
    "audit:view": "View audit logs (admin only)",
    "audit:export": "Export audit logs",
    
    # Additional permissions
    "user:edit_role": "Change user roles (student/exco/admin)",
    "user:edit_academic": "Edit academic info (admission year, level)",
    "user:export": "Export user data as CSV",

    # Contact message permissions
    "contact:view": "View contact form submissions",
    "contact:manage": "Reply to, archive, and delete contact messages",

    # Team management permissions
    "team:review": "Review team applications",
    "team:manage": "Manage teams (create, edit, delete, assign heads)",

    # TIMP permissions
    "timp:manage": "Manage TIMP mentoring (review applications, create pairs)",
    "timp:view": "View TIMP pairs and feedback",

    # Bank transfer permissions
    "bank_transfer:manage_accounts": "Manage bank accounts (add/edit/delete IESA bank details)",
    "bank_transfer:review": "Review and approve/reject bank transfer submissions",
    "bank_transfer:view_all": "View all bank transfer submissions",

    # Platform settings permissions
    "admin:manage_settings": "Manage platform-wide settings (e.g. toggle online payments)",

    # IEPOD Hub permissions
    "iepod:manage": "Manage IEPOD program (registrations, quizzes, teams, points)",
    "iepod:view": "View IEPOD program data",

    # System / infrastructure permissions
    "system:health": "Access API health dashboard (super admin only)",

    # Class Rep Portal permissions
    "class_rep:view_cohort": "View student directory for own level",
    "class_rep:export_cohort": "Export level cohort contact list as CSV",
    "class_rep:manage_deadlines": "Create/edit/delete deadline board entries",
    "class_rep:manage_polls": "Create/edit/delete quick polls for level",
    "class_rep:manage_relay": "Create/edit/delete lecturer relay board posts",
    "class_rep:pin_relay": "Pin/unpin relay board posts",
    "class_rep:view_stats": "View cohort stats (enrollment, payments)",

    # Team Head Portal permissions
    "team_head:view_members": "View member list for own team",
    "team_head:manage_noticeboard": "Create/edit/delete noticeboard posts for own team",
    "team_head:manage_tasks": "Create/edit/delete tasks for team members",
    "team_head:announce": "Send announcements targeted to own team members",

    # Freshers Coordinator permissions
    "freshers:manage": "Manage 100L freshman coordination portal",

    # Messaging & Moderation permissions
    "messages:manage": "Manage DM reports (list, review, mute/unmute users)",
}


# Default permissions by position
# NOTE: Position keys MUST match the "value" field in the frontend POSITIONS
# catalogue (admin roles page) so that roles created from the admin UI
# automatically inherit the correct defaults.
DEFAULT_PERMISSIONS = {
    # ── Super Admin ──────────────────────────────────────────────────
    "super_admin": [
        # Super admins have ALL permissions — almighty access
        *PERMISSIONS.keys()
    ],

    # ── Regular Admin (view-only dashboard) ──────────────────────────
    "admin": [
        "announcement:view",
        "payment:view_all",
        "resource:view",
        "timetable:view",
        "event:view",
        "bank_transfer:view_all",
        "contact:view",
        "iepod:view",
        "timp:view",
    ],

    # ── Executive Officers ───────────────────────────────────────────
    "president": [
        # President has full platform permissions (same effective scope as super_admin)
        *PERMISSIONS.keys()
    ],
    "vice_president": [
        "announcement:create", "announcement:edit", "announcement:view",
        "event:create", "event:edit", "event:view", "event:manage",
        "payment:view_all",
        "resource:view", "resource:approve",
        "timetable:create", "timetable:edit", "timetable:view",
        "press:access",
        "timp:manage", "timp:view",
        "bank_transfer:review", "bank_transfer:view_all",
        "iepod:manage", "iepod:view",
        "contact:view", "contact:manage",
    ],
    "general_secretary": [
        "announcement:create", "announcement:edit", "announcement:view",
        "user:view_all", "user:edit", "user:edit_role", "user:edit_academic", "user:delete",
        "enrollment:view", "enrollment:create", "enrollment:edit", "enrollment:delete",
        "timetable:view",
        "contact:view", "contact:manage",
    ],
    "assistant_general_secretary": [
        "announcement:create", "announcement:view",
        "timetable:view",
        "contact:view",
    ],
    "financial_secretary": [
        "payment:create", "payment:edit", "payment:approve", "payment:view_all",
        "announcement:view",
        "bank_transfer:manage_accounts", "bank_transfer:review", "bank_transfer:view_all",
    ],
    "treasurer": [
        "payment:create", "payment:edit", "payment:view_all",
        "announcement:view",
        "bank_transfer:review", "bank_transfer:view_all",
    ],
    "pro": [
        "announcement:create", "announcement:edit", "announcement:view",
        "event:view",
        "press:access", "press:create", "press:edit", "press:review", "press:publish", "press:manage",
    ],
    "social_director": [
        "event:create", "event:edit", "event:view", "event:manage",
        "announcement:create", "announcement:edit", "announcement:view",
    ],
    "sports_secretary": [
        "event:create", "event:edit", "event:view", "event:manage",
        "announcement:create", "announcement:edit", "announcement:view",
        "timetable:view",
    ],
    "assistant_sports_secretary": [
        "event:create", "event:edit", "event:view",
        "announcement:create", "announcement:view",
    ],

    # ── Directors ────────────────────────────────────────────────────
    # Legacy aliases retained for existing records
    "director_of_socials": [
        "event:create", "event:edit", "event:view", "event:manage",
        "announcement:create", "announcement:edit", "announcement:view",
    ],
    "director_of_sports": [
        "event:create", "event:edit", "event:view", "event:manage",
        "announcement:create", "announcement:edit", "announcement:view",
        "timetable:view",
    ],
    "welfare_officer": [
        "announcement:create", "announcement:view",
        "user:view_all",
    ],
    "director_of_academics": [
        "announcement:create", "announcement:view",
        "resource:view", "resource:create",
        "timetable:view",
    ],
    "academic_lead": [
        "announcement:create", "announcement:view",
        "resource:view", "resource:create", "resource:edit", "resource:approve",
        "timetable:view", "timetable:create", "timetable:edit", "timetable:exam",
    ],
    "director_of_information": [
        "announcement:create", "announcement:edit", "announcement:view",
        "press:access", "press:create",
    ],
    # Legacy alias — kept for backward compatibility with any roles
    # created before the rename; maps to same perms as director_of_academics
    "director_of_welfare": [
        "announcement:create", "announcement:view",
        "user:view_all",
    ],

    # ── Class Representatives ────────────────────────────────────────
    "class_rep": [
        "announcement:create", "announcement:edit", "announcement:delete", "announcement:view",
        "event:view",
        "payment:view_all",
        "timetable:view",
        "class_rep:view_cohort", "class_rep:export_cohort",
        "class_rep:manage_deadlines", "class_rep:manage_polls",
        "class_rep:manage_relay", "class_rep:pin_relay",
        "class_rep:view_stats",
    ],

    # ── Assistant Class Representatives ──────────────────────────────
    "asst_class_rep": [
        "announcement:create", "announcement:view",
        "event:view",
        "payment:view_all",
        "timetable:view",
        "class_rep:view_cohort",
        "class_rep:manage_deadlines",
        "class_rep:manage_relay",
        "class_rep:view_stats",
    ],

    # ── Freshers Coordinator (100L oversight) ──────────────────────
    "freshers_coordinator": [
        "freshers:manage",
        "announcement:create", "announcement:edit", "announcement:delete", "announcement:view",
        "event:view",
        "payment:view_all",
        "timetable:view",
        "class_rep:view_cohort", "class_rep:export_cohort",
        "class_rep:manage_deadlines", "class_rep:manage_polls",
        "class_rep:manage_relay", "class_rep:pin_relay",
        "class_rep:view_stats",
    ],

    # ── Team Heads ─────────────────────────────────────────────────
    # New team structure — each built-in team has a head position
    "ics_head": [
        "announcement:create", "announcement:view",
        "event:view",
        "team_head:view_members", "team_head:manage_noticeboard",
        "team_head:manage_tasks", "team_head:announce",
    ],
    "team_head_industrial_visit": [
        "announcement:create", "announcement:view",
        "event:create", "event:view",
        "team_head:view_members", "team_head:manage_noticeboard",
        "team_head:manage_tasks", "team_head:announce",
    ],
    "team_head_conference": [
        "announcement:create", "announcement:view",
        "event:create", "event:view",
        "team_head:view_members", "team_head:manage_noticeboard",
        "team_head:manage_tasks", "team_head:announce",
    ],
    "team_head_logistics": [
        "announcement:create", "announcement:view",
        "event:view",
        "team_head:view_members", "team_head:manage_noticeboard",
        "team_head:manage_tasks", "team_head:announce",
    ],
    "team_head_welfare": [
        "announcement:create", "announcement:view",
        "team_head:view_members", "team_head:manage_noticeboard",
        "team_head:manage_tasks", "team_head:announce",
    ],
    "team_head_alumni_relations": [
        "announcement:create", "announcement:view",
        "event:create", "event:view",
        "team_head:view_members", "team_head:manage_noticeboard",
        "team_head:manage_tasks", "team_head:announce",
    ],
    "team_head_dinner_award": [
        "announcement:create", "announcement:view",
        "event:create", "event:edit", "event:view",
        "team_head:view_members", "team_head:manage_noticeboard",
        "team_head:manage_tasks", "team_head:announce",
    ],

    # ── Team Members ────────────────────────────────────────────────
    "ics_member": [
        "announcement:view",
        "event:view",
    ],
    "team_industrial_visit_member": [
        "announcement:view",
        "event:view",
    ],
    "team_conference_member": [
        "announcement:view",
        "event:view",
    ],
    "team_logistics_member": [
        "announcement:view",
        "event:view",
    ],
    "team_welfare_member": [
        "announcement:view",
    ],
    "team_alumni_relations_member": [
        "announcement:view",
        "event:view",
    ],
    "team_dinner_award_member": [
        "announcement:view",
        "event:view",
    ],

    # ── IEPOD Specialized Roles ──────────────────────────────────────
    "iepod_hub_director": [
        "iepod:manage", "iepod:view",
        "announcement:create", "announcement:view",
        "event:create", "event:view",
        "team_head:view_members", "team_head:manage_noticeboard",
        "team_head:manage_tasks", "team_head:announce",
    ],
    "iepod_hub_lead": [
        "iepod:manage", "iepod:view",
        "announcement:create", "announcement:view",
        "team_head:view_members", "team_head:manage_noticeboard",
        "team_head:manage_tasks", "team_head:announce",
    ],
    "iepod_conference_lead": [
        "iepod:view",
        "event:create", "event:view",
        "announcement:create", "announcement:view",
    ],
    "iepod_program_coordinator": [
        "iepod:view",
        "announcement:view",
        "event:view",
    ],
    "iepod_communications_officer": [
        "iepod:view",
        "announcement:create", "announcement:view",
    ],

    # ── TIMP Specialized Roles ───────────────────────────────────────
    "timp_mentor": [
        "timp:view",
        "announcement:view",
    ],
    "timp_mentee": [
        "timp:view",
        "announcement:view",
    ],

    # ── Press Specialized Roles ──────────────────────────────────────
    "press_niche_editor": [
        "press:access", "press:create", "press:edit", "press:review",
        "announcement:view",
    ],
    "press_pro": [
        "press:access", "press:create",
        "announcement:create", "announcement:view",
    ],

    # Legacy committee head positions — kept for backward compat with existing roles
    "committee_head_academic": [
        "announcement:create", "announcement:view",
        "event:create", "event:view",
        "resource:view",
        "team_head:view_members", "team_head:manage_noticeboard",
        "team_head:manage_tasks", "team_head:announce",
    ],
    "committee_head_welfare": [
        "announcement:create", "announcement:view",
        "team_head:view_members", "team_head:manage_noticeboard",
        "team_head:manage_tasks", "team_head:announce",
    ],
    "committee_head_sports": [
        "event:create", "event:edit", "event:view",
        "announcement:create", "announcement:view",
        "team_head:view_members", "team_head:manage_noticeboard",
        "team_head:manage_tasks", "team_head:announce",
    ],
    "committee_head_social": [
        "event:create", "event:edit", "event:view",
        "announcement:create", "announcement:view",
        "team_head:view_members", "team_head:manage_noticeboard",
        "team_head:manage_tasks", "team_head:announce",
    ],
    "committee_head_technical": [
        "announcement:create", "announcement:view",
        "resource:view", "resource:create",
        "team_head:view_members", "team_head:manage_noticeboard",
        "team_head:manage_tasks", "team_head:announce",
    ],
    # Legacy aliases — old keys kept for backward compatibility
    "committee_academic": [
        "announcement:create", "announcement:view",
        "event:view",
    ],
    "committee_welfare": [
        "announcement:create", "announcement:view",
        "user:view_all",
    ],
    "committee_sports": [
        "event:create", "event:view",
        "announcement:view",
    ],
    "committee_socials": [
        "event:create", "event:view",
        "announcement:create", "announcement:view",
    ],

    # ── Committee Members (fewer permissions than heads) ─────────────
    "committee_academic_member": [
        "announcement:view",
        "event:view",
    ],
    "committee_welfare_member": [
        "announcement:view",
    ],
    "committee_sports_member": [
        "announcement:view",
        "event:view",
    ],
    "committee_socials_member": [
        "announcement:view",
        "event:view",
    ],

    # ── Legacy Unit Heads (kept for backward compat with existing roles) ────
    "unit_head_photography": [
        "announcement:create", "announcement:view",
        "event:view",
        "team_head:view_members", "team_head:manage_noticeboard",
        "team_head:manage_tasks", "team_head:announce",
    ],
    "unit_head_logistics": [
        "announcement:create", "announcement:view",
        "event:view",
        "team_head:view_members", "team_head:manage_noticeboard",
        "team_head:manage_tasks", "team_head:announce",
    ],
    "unit_head_decoration": [
        "announcement:create", "announcement:view",
        "event:view",
        "team_head:view_members", "team_head:manage_noticeboard",
        "team_head:manage_tasks", "team_head:announce",
    ],

    # ── Special Roles ────────────────────────────────────────────────
    "timp_lead": [
        "timp:manage", "timp:view",
        "announcement:create", "announcement:view",
        "team_head:view_members", "team_head:manage_noticeboard",
        "team_head:manage_tasks", "team_head:announce",
    ],
    "press_editor_in_chief": [
        "press:access", "press:create", "press:edit", "press:review", "press:publish", "press:manage",
        "announcement:create", "announcement:view",
        "team_head:view_members", "team_head:manage_noticeboard",
        "team_head:manage_tasks", "team_head:announce",
    ],
    "press_head": [
        "press:access", "press:create", "press:edit", "press:review", "press:publish", "press:manage",
        "announcement:create", "announcement:view",
        "team_head:view_members", "team_head:manage_noticeboard",
        "team_head:manage_tasks", "team_head:announce",
    ],
    "press_member": [
        "press:access", "press:create", "press:edit",
    ],
    "ics_head": [
        "announcement:create", "announcement:view",
        "event:view",
        "team_head:view_members", "team_head:manage_noticeboard",
        "team_head:manage_tasks", "team_head:announce",
    ],
    "ics_member": [
        "announcement:view",
        "event:view",
    ],

    # ── Alumni & Relations ───────────────────────────────────────────
    "alumni": [
        "announcement:view",
        "event:view",
    ],
    "relations_committee": [
        "announcement:view",
        "event:view",
    ],

    # ── Custom Team Head (base defaults for team_head_custom_* positions) ────
    "team_head_custom": [
        "announcement:create", "announcement:view",
        "event:view",
        "team_head:view_members", "team_head:manage_noticeboard",
        "team_head:manage_tasks", "team_head:announce",
    ],
    # Legacy alias
    "unit_head_custom": [
        "announcement:create", "announcement:view",
        "event:view",
        "team_head:view_members", "team_head:manage_noticeboard",
        "team_head:manage_tasks", "team_head:announce",
    ],
}


async def get_current_session(
    x_session_id: Optional[str] = Header(None, alias="X-Session-ID"),
    current_user: User = Depends(get_current_user)
) -> dict:
    """
    Middleware to get the current session from header or default to active session.
    
    When X-Session-ID is provided (for archive/history browsing), it is validated:
    - The session must exist
    - The requesting user must have an active role in that session OR be accessing
      the currently-active session. This prevents privilege escalation by replaying
      old session IDs to regain expired permissions.
    
    Usage:
        @app.get("/endpoint")
        async def endpoint(session: dict = Depends(get_current_session)):
            session_id = session["_id"]
    """
    db = get_database()
    sessions = db["sessions"]
    
    # If session ID provided in header, use it
    if x_session_id:
        if not ObjectId.is_valid(x_session_id):
            raise HTTPException(status_code=400, detail="Invalid session ID format")
        session = await sessions.find_one({"_id": ObjectId(x_session_id)})
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")

        # If it's the active session, allow (no privilege difference)
        if session.get("isActive"):
            return session

        # Non-active session: check that the user has a super_admin role OR
        # an active role specifically in that requested session.  This blocks
        # former executives from replaying an old session-id to regain perms.
        user_id = current_user.get("_id") or current_user.get("id")
        roles_col = db["roles"]

        is_super = await roles_col.find_one({
            "userId": user_id,
            "position": "super_admin",
            "isActive": True,
        })
        if not is_super:
            has_role = await roles_col.find_one({
                "userId": user_id,
                "sessionId": str(session["_id"]),
                "isActive": True,
            })
            if not has_role:
                # Fall back to the active session instead of granting
                # permissions for a session the user has no role in.
                active = await sessions.find_one({"isActive": True})
                if not active:
                    raise HTTPException(
                        status_code=404,
                        detail="No active session found. Please create and activate a session.",
                    )
                return active

        return session
    
    # Otherwise, get active session (cached — changes ~twice per year)
    global _active_session_cache
    cached, cached_at = _active_session_cache
    if cached and (time.monotonic() - cached_at) < _ACTIVE_SESSION_TTL:
        return cached

    session = await sessions.find_one({"isActive": True})
    if not session:
        raise HTTPException(
            status_code=404,
            detail="No active session found. Please create and activate a session."
        )

    _active_session_cache = (session, time.monotonic())
    return session


async def get_user_permissions(
    user_id: str,
    session_id: str
) -> List[str]:
    """
    Get all permissions for a user in a specific session.
    Cached for 120s to avoid repeated DB lookups on every request.
    
    Returns:
        List of permission strings (e.g., ['announcement:create', 'event:manage'])
    """
    global _permissions_cache
    cache_key = f"{user_id}:{session_id}"
    cached = _permissions_cache.get(cache_key)
    if cached:
        perms, cached_at = cached
        if (time.monotonic() - cached_at) < _PERMISSIONS_TTL:
            return perms

    db = get_database()
    roles_collection = db["roles"]
    
    # Super admin check — if user has super_admin position in ANY session, they have ALL permissions
    super_admin_role = await roles_collection.find_one({
        "userId": user_id,
        "position": "super_admin",
        "isActive": True
    })
    if super_admin_role:
        result = list(PERMISSIONS.keys())
        _permissions_cache[cache_key] = (result, time.monotonic())
        return result
    
    # Get user's roles for this session
    cursor = roles_collection.find({
        "userId": user_id,
        "sessionId": session_id,
        "isActive": True
    })
    roles_list = await cursor.to_list(length=None)
    
    # Collect all permissions from roles
    all_permissions = set()
    for role in roles_list:
        # Add explicitly assigned permissions
        if "permissions" in role and role["permissions"]:
            all_permissions.update(normalize_permissions(role["permissions"]))
        
        # Add default permissions for position
        position = role.get("position")
        if position:
            if position in DEFAULT_PERMISSIONS:
                all_permissions.update(normalize_permissions(DEFAULT_PERMISSIONS[position]))
            elif position.startswith("class_rep") or position.startswith("asst_class_rep"):
                # class_rep_100L → class_rep defaults, asst_class_rep_100L → asst_class_rep defaults
                base = "asst_class_rep" if position.startswith("asst_class_rep") else "class_rep"
                all_permissions.update(normalize_permissions(DEFAULT_PERMISSIONS.get(base, [])))
            elif position.startswith("team_head_custom_") or position.startswith("unit_head_custom_"):
                # Custom team heads get the base team_head_custom defaults
                all_permissions.update(normalize_permissions(DEFAULT_PERMISSIONS.get("team_head_custom", [])))
    
    result = list(all_permissions)
    # Only cache non-empty permission sets.
    # Empty sets occur when a user has no roles yet (common transient state after
    # make_super_admin.py runs): caching them would stale-lock the user out for
    # up to _PERMISSIONS_TTL seconds even after a role is assigned.
    if result:
        _permissions_cache[cache_key] = (result, time.monotonic())
    return result


async def check_permission(
    required_permission: str,
    user: User = Depends(get_current_user),
    session: dict = Depends(get_current_session)
) -> bool:
    """
    Check if current user has a specific permission in the current session.
    
    Args:
        required_permission: Permission string (e.g., "announcement:create")
        user: Current authenticated user
        session: Current session (from get_current_session)
    
    Returns:
        True if user has permission, raises HTTPException otherwise
    """
    # Get user permissions
    user_permissions = await get_user_permissions(
        user.get('_id') or user.get('id'),
        str(session["_id"])
    )
    
    required_permission = normalize_permission(required_permission)
    normalized_user_permissions = set(normalize_permissions(user_permissions))

    # Check if user has the required permission
    if required_permission not in normalized_user_permissions:
        raise HTTPException(
            status_code=403,
            detail=f"Permission denied. Required permission: {required_permission}"
        )
    
    return True


def require_permission(permission: str):
    """
    Dependency factory for requiring specific permissions.
    
    Usage:
        @app.post("/announcements", dependencies=[Depends(require_permission("announcement:create"))])
        async def create_announcement(...):
            # Only users with announcement:create permission can access this
    
    Args:
        permission: Required permission string
    
    Returns:
        Dependency function that returns the user data dict
    """
    async def permission_checker(
        user: User = Depends(get_current_user),
        session: dict = Depends(get_current_session)
    ):
        await check_permission(permission, user, session)
        return user  # Return user data instead of True
    
    return permission_checker


def require_any_permission(permissions: List[str]):
    """
    Dependency factory for requiring ANY of the specified permissions.
    
    Usage:
        @app.get("/dashboard", dependencies=[Depends(require_any_permission(["payment:view_all", "event:manage"]))])
    
    Args:
        permissions: List of permission strings (user needs at least one)
    
    Returns:
        Dependency function that returns the user data dict
    """
    async def permission_checker(
        user: User = Depends(get_current_user),
        session: dict = Depends(get_current_session)
    ):
        user_permissions = await get_user_permissions(
            user.get('_id') or user.get('id'),
            str(session["_id"])
        )
        
        normalized_required = set(normalize_permissions(permissions))
        normalized_user = set(normalize_permissions(user_permissions))

        # Check if user has any of the required permissions
        if not normalized_required.intersection(normalized_user):
            raise HTTPException(
                status_code=403,
                detail=f"Permission denied. Required one of: {', '.join(permissions)}"
            )
        
        return user  # Return user data instead of True
    
    return permission_checker


def require_all_permissions(permissions: List[str]):
    """
    Dependency factory for requiring ALL specified permissions.
    
    Usage:
        @app.post("/critical", dependencies=[Depends(require_all_permissions(["payment:approve", "user:edit"]))])
    
    Args:
        permissions: List of permission strings (user needs all of them)
    
    Returns:
        Dependency function that returns the user data dict
    """
    async def permission_checker(
        user: User = Depends(get_current_user),
        session: dict = Depends(get_current_session)
    ):
        user_permissions = await get_user_permissions(
            user.get('_id') or user.get('id'),
            str(session["_id"])
        )
        
        normalized_required = normalize_permissions(permissions)
        normalized_user = set(normalize_permissions(user_permissions))

        # Check if user has all required permissions
        missing_permissions = [p for p in normalized_required if p not in normalized_user]
        if missing_permissions:
            raise HTTPException(
                status_code=403,
                detail=f"Permission denied. Missing: {', '.join(missing_permissions)}"
            )
        
        return user  # Return user data instead of True
    
    return permission_checker
