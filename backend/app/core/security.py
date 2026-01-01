import firebase_admin
from firebase_admin import credentials, auth
from fastapi import HTTPException, Security, status, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import List, Optional
import os, json, base64
from dotenv import load_dotenv

load_dotenv()

# Initialize Firebase Admin
cred_path = "serviceAccountKey.json"

sa_b64 = os.getenv("FIREBASE_SERVICE_ACCOUNT_JSON_BASE64")
if sa_b64:
    sa_json = json.loads(base64.b64decode(sa_b64).decode("utf-8"))
    cred = credentials.Certificate(sa_json)
else:
    cred = credentials.Certificate(cred_path)

# Initialize Firebase Admin app if not already initialized
try:
    firebase_admin.get_app()
except ValueError:
    firebase_admin.initialize_app(cred)

security = HTTPBearer()


async def verify_token(credentials: HTTPAuthorizationCredentials = Security(security)) -> dict:
    """
    Verify Firebase JWT token and return decoded token data.
    This is the base authentication check.
    """
    token = credentials.credentials
    try:
        decoded_token = auth.verify_id_token(token)
        return decoded_token
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid authentication credentials: {str(e)}",
            headers={"WWW-Authenticate": "Bearer"},
        )


async def get_current_user(token_data: dict = Depends(verify_token)) -> dict:
    """
    Get current user with profile data from MongoDB.
    Returns enriched user object with role and permissions.
    """
    from app.db import get_database
    from bson import ObjectId
    
    db = get_database()
    users = db["users"]
    
    # Find user by Firebase UID
    user = await users.find_one({"firebaseUid": token_data.get("uid")})
    
    if not user:
        # User authenticated with Firebase but no profile in DB
        # This should trigger profile creation on frontend
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User profile not found. Please complete your profile setup."
        )
    
    # Convert ObjectId to string
    user["_id"] = str(user["_id"])
    
    # Add Firebase data to user object
    user["firebaseData"] = token_data
    
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

