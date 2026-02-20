"""
Security — JWT-based authentication (replaces Firebase Admin SDK)

Provides:
- verify_token: Decode + validate JWT access token
- get_current_user: Look up user by _id from token `sub`
- require_role: Role-based dependency guard
- verify_session_access: Session-level access control
"""

from fastapi import HTTPException, Security, status, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import List
from bson import ObjectId

from app.core.auth import decode_access_token

security = HTTPBearer()


async def verify_token(credentials: HTTPAuthorizationCredentials = Security(security)) -> dict:
    """
    Verify JWT access token and return decoded payload.
    
    Returns dict with:
        sub: user id (string)
        email: user email
        role: user role
        type: "access"
    """
    token = credentials.credentials
    try:
        payload = decode_access_token(token)
        return payload
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid authentication credentials: {str(e)}",
            headers={"WWW-Authenticate": "Bearer"},
        )


async def get_current_user(token_data: dict = Depends(verify_token)) -> dict:
    """
    Get current user with profile data from MongoDB.
    Looks up user by _id (from JWT `sub` claim).
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
    
    # Find user by MongoDB _id
    user = await users.find_one({"_id": ObjectId(user_id)})
    
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
    
    Args:
        allowed_roles: List of allowed roles (e.g., ["admin", "exco"])
    
    Returns:
        Dependency function that checks user role
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
    
    Rules:
    - Admins: Access to all sessions
    - Excos with role in that session: Access to that session
    - Students: Access to sessions they're enrolled in
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

