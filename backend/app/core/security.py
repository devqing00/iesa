"""
Security — Firebase Auth-based authentication

Provides:
- verify_token: Verify Firebase ID token → return dict with sub (MongoDB _id), email, role
- verify_firebase_id_token_raw: Low-level Firebase token verification for WS/SSE
- get_current_user: Look up user by _id from token `sub`
- require_role: Role-based dependency guard
- verify_session_access: Session-level access control
"""

import logging
from fastapi import HTTPException, Security, status, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import List
from bson import ObjectId

from app.core.auth import verify_firebase_token

security = HTTPBearer()
logger = logging.getLogger("iesa_backend")


async def verify_token(credentials: HTTPAuthorizationCredentials = Security(security)) -> dict:
    """
    Verify a Firebase ID token and return a dict compatible with the old JWT payload layout.

    Performs a DB lookup to map firebaseUid → MongoDB _id and fetch the current role.

    Returns dict with:
        sub: MongoDB user _id (string)
        email: user email
        role: user role (from DB, always fresh)
        type: "access"
        firebase_uid: the raw Firebase UID
    """
    token = credentials.credentials
    try:
        decoded = await verify_firebase_token(token)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

    firebase_uid = decoded.get("uid") or decoded.get("user_id")
    email = decoded.get("email", "")

    if not firebase_uid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token: missing Firebase UID",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Map Firebase UID → MongoDB user
    from app.db import get_database
    db = get_database()
    user = await db["users"].find_one(
        {"firebaseUid": firebase_uid},
        {"_id": 1, "role": 1, "email": 1},
    )

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User profile not found. Please complete your profile setup.",
        )

    return {
        "sub": str(user["_id"]),
        "email": user.get("email", email),
        "role": user.get("role", "student"),
        "type": "access",
        "firebase_uid": firebase_uid,
    }


async def verify_firebase_id_token_raw(token: str) -> dict:
    """
    Verify a Firebase ID token (for WebSocket / SSE where HTTPBearer is not available).

    Returns the same shape as verify_token: {sub, email, role, type, firebase_uid}.
    Raises HTTPException on failure.
    """
    try:
        decoded = await verify_firebase_token(token)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials",
        )

    firebase_uid = decoded.get("uid") or decoded.get("user_id")
    if not firebase_uid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token: missing Firebase UID",
        )

    from app.db import get_database
    db = get_database()
    user = await db["users"].find_one(
        {"firebaseUid": firebase_uid},
        {"_id": 1, "role": 1, "email": 1},
    )
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User profile not found.",
        )

    return {
        "sub": str(user["_id"]),
        "email": user.get("email", decoded.get("email", "")),
        "role": user.get("role", "student"),
        "type": "access",
        "firebase_uid": firebase_uid,
    }


async def get_current_user(token_data: dict = Depends(verify_token)) -> dict:
    """
    Get current user with profile data from MongoDB.
    Looks up user by _id (from token `sub` claim).
    Returns enriched user object with role and permissions.
    """
    from app.db import get_database

    db = get_database()
    users = db["users"]

    user_id = token_data.get("sub")
    if not user_id or not ObjectId.is_valid(user_id):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token: missing or invalid user ID",
        )

    # Find user by MongoDB _id (exclude passwordHash — never needed downstream)
    user = await users.find_one(
        {"_id": ObjectId(user_id)},
        {"passwordHash": 0}
    )

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User profile not found. Please complete your profile setup."
        )

    # Convert ObjectId to string
    user["_id"] = str(user["_id"])

    # Add token data for downstream compatibility
    user["tokenData"] = token_data

    return user


def require_role(allowed_roles: List[str]):
    """
    Dependency factory for role-based access control.

    Usage:
        @router.post("/admin-only")
        async def admin_route(user: dict = Depends(require_role(["admin"]))):
            ...
    """
    async def role_checker(user: dict = Depends(get_current_user)) -> dict:
        user_role = user.get("role", "student")
        if user_role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. Required roles: {', '.join(allowed_roles)}"
            )
        return user
    return role_checker


async def verify_session_access(session_id: str, user: dict = Depends(get_current_user)) -> bool:
    """
    Verify if a user has access to a specific session.
    """
    from app.db import get_database
    from bson import ObjectId

    db = get_database()

    # Admins have access to everything
    if user.get("role") == "admin":
        return True

    # Check if user has a role (exco) in this session
    roles = db["roles"]
    user_role_in_session = await roles.find_one({
        "userId": user["_id"],
        "sessionId": session_id,
        "isActive": True
    })
    if user_role_in_session:
        return True

    # Check if student is enrolled in this session
    enrollments = db["enrollments"]
    enrollment = await enrollments.find_one({
        "studentId": user["_id"],
        "sessionId": session_id,
        "isActive": True
    })
    if enrollment:
        return True

    return False


IPE_DEPARTMENT = "Industrial Engineering"


def _is_external_student(user: dict) -> bool:
    """Check if a user is an external (non-IPE) student."""
    return (
        user.get("role") == "student"
        and user.get("department", IPE_DEPARTMENT) != IPE_DEPARTMENT
    )


async def require_ipe_student(user: dict = Depends(get_current_user)) -> dict:
    """
    Dependency that blocks external students from IPE-only endpoints.
    Admins and excos pass through regardless of department.
    """
    if _is_external_student(user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This feature is only available to IPE students",
        )
    return user

