"""
Permission-Based RBAC System

Instead of checking "Is user President?", check "Does user have 'announcement:create' permission?"
This allows flexible role management across sessions.
"""

from typing import List, Optional
from fastapi import Depends, HTTPException, Header
from bson import ObjectId
from app.core.security import get_current_user
from app.models.user import User
from app.db import get_database


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
    "event:manage": "Manage event registrations",
    
    # Payment permissions
    "payment:create": "Create payment requests",
    "payment:edit": "Edit payment requests",
    "payment:delete": "Delete payment requests",
    "payment:approve": "Approve/verify payments",
    "payment:view_all": "View all students' payments",
    
    # Grade permissions
    "grade:create": "Create grade records",
    "grade:edit": "Edit grade records",
    "grade:view_all": "View all students' grades",
    
    # User management permissions
    "user:view_all": "View all users",
    "user:edit": "Edit user profiles",
    "user:delete": "Delete users",
    
    # Role management permissions
    "role:assign": "Assign roles to users",
    "role:revoke": "Revoke roles from users",
    "role:view": "View role assignments",
    "role:create": "Create / assign new roles",
    "role:edit": "Edit existing role assignments",
    "role:delete": "Delete role assignments",
    
    # Session management permissions
    "session:create": "Create new sessions",
    "session:edit": "Edit sessions",
    "session:activate": "Activate/deactivate sessions",
    "session:delete": "Delete sessions",
    
    # Enrollment permissions
    "enrollment:view": "View all enrollments",
    "enrollment:create": "Enroll students in sessions",
    "enrollment:edit": "Edit enrollments",
    "enrollment:delete": "Delete enrollments",
    
    # Audit log permissions
    "audit:view": "View audit logs (admin only)",
    "audit:export": "Export audit logs",
    
    # Additional permissions
    "user:edit_role": "Change user roles (student/exco/admin)",
    "user:edit_academic": "Edit academic info (admission year, level)",
}


# Default permissions by position
DEFAULT_PERMISSIONS = {
    "admin": [
        # Admins have all permissions
        *PERMISSIONS.keys()
    ],
    "president": [
        "announcement:create", "announcement:edit", "announcement:delete", "announcement:view",
        "event:create", "event:edit", "event:delete", "event:manage",
        "payment:create", "payment:edit", "payment:delete", "payment:approve", "payment:view_all",
        "enrollment:view", "enrollment:edit",
        "user:view_all", "role:view",
    ],
    "vice_president": [
        "announcement:create", "announcement:edit", "announcement:view",
        "event:create", "event:edit", "event:manage",
        "payment:view_all", "enrollment:view", "enrollment:edit",
        "user:view_all",
    ],
    "general_secretary": [
        "announcement:create", "announcement:edit", "announcement:view",
        "user:view_all", "role:view",
    ],
    "financial_secretary": [
        "payment:create", "payment:edit", "payment:approve", "payment:view_all",
        "announcement:view",
    ],
    "treasurer": [
        "payment:create", "payment:edit", "payment:view_all",
        "announcement:view",
    ],
    "director_of_socials": [
        "event:create", "event:edit", "event:manage",
        "announcement:create", "announcement:view",
    ],
    "director_of_sports": [
        "event:create", "event:edit", "event:manage",
        "announcement:create", "announcement:view",
    ],
    "director_of_welfare": [
        "announcement:create", "announcement:view",
        "user:view_all",
    ],
    "pro": [
        "announcement:create", "announcement:edit", "announcement:view",
        "event:view", "user:view_all",
    ],
    "class_rep": [
        "announcement:view",
        "event:view",
        "payment:view_all",
    ],
    # Committee heads
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
}


async def get_current_session(
    x_session_id: Optional[str] = Header(None, alias="X-Session-ID"),
    current_user: User = Depends(get_current_user)
) -> dict:
    """
    Middleware to get the current session from header or default to active session.
    
    Usage:
        @app.get("/endpoint")
        async def endpoint(session: dict = Depends(get_current_session)):
            # session contains full session document
            session_id = session["_id"]
    """
    db = get_database()
    sessions = db["sessions"]
    
    # If session ID provided in header, use it
    if x_session_id:
        try:
            session = await sessions.find_one({"_id": ObjectId(x_session_id)})
            if not session:
                raise HTTPException(status_code=404, detail="Session not found")
            return session
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid session ID format")
    
    # Otherwise, get active session
    session = await sessions.find_one({"isActive": True})
    if not session:
        raise HTTPException(
            status_code=404,
            detail="No active session found. Please create and activate a session."
        )
    
    return session


async def get_user_permissions(
    user_id: str,
    session_id: str
) -> List[str]:
    """
    Get all permissions for a user in a specific session.
    
    Returns:
        List of permission strings (e.g., ['announcement:create', 'event:manage'])
    """
    db = get_database()
    roles_collection = db["roles"]
    users = db["users"]
    
    # Admin users have all permissions
    user = await users.find_one({"_id": ObjectId(user_id)})
    if user and user.get("role") == "admin":
        return list(PERMISSIONS.keys())
    
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
            all_permissions.update(role["permissions"])
        
        # Add default permissions for position
        position = role.get("position")
        if position:
            if position in DEFAULT_PERMISSIONS:
                all_permissions.update(DEFAULT_PERMISSIONS[position])
            elif position.startswith("class_rep"):
                # All class_rep_XL variants inherit base class_rep permissions
                all_permissions.update(DEFAULT_PERMISSIONS.get("class_rep", []))
    
    return list(all_permissions)


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
    
    # Check if user has the required permission
    if required_permission not in user_permissions:
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
        
        # Check if user has any of the required permissions
        if not any(perm in user_permissions for perm in permissions):
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
        
        # Check if user has all required permissions
        missing_permissions = [p for p in permissions if p not in user_permissions]
        if missing_permissions:
            raise HTTPException(
                status_code=403,
                detail=f"Permission denied. Missing: {', '.join(missing_permissions)}"
            )
        
        return user  # Return user data instead of True
    
    return permission_checker
