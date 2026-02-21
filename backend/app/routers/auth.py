"""
Auth Router — Registration, Login, Refresh, Logout

Replaces Firebase client-side auth with server-side JWT auth.

Security features:
- Argon2id password hashing
- Short-lived access tokens (15 min)
- httpOnly refresh cookies (7 days)
- Refresh token rotation with family-based theft detection
- Rate-limited login to prevent brute force
"""

from fastapi import APIRouter, HTTPException, Depends, status, Request, Response
from datetime import datetime, timezone
from bson import ObjectId
import os
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.core.auth import (
    hash_password,
    verify_password,
    check_needs_rehash,
    create_access_token,
    create_refresh_token,
    decode_access_token,
    decode_refresh_token,
    validate_password_strength,
    TokenPair,
    RegisterRequest,
    LoginRequest,
    ChangePasswordRequest,
    ACCESS_TOKEN_EXPIRE_MINUTES,
    REFRESH_TOKEN_EXPIRE_DAYS,
)
from app.core.security import get_current_user
from app.db import get_database

router = APIRouter(prefix="/api/v1/auth", tags=["Auth"])
limiter = Limiter(key_func=get_remote_address)

# Cookie settings — environment-aware for cross-origin (Vercel ↔ Render)
REFRESH_COOKIE_NAME = "refresh_token"
_ENV = os.getenv("ENVIRONMENT", "development")
COOKIE_SECURE = _ENV == "production"            # True over HTTPS in prod
COOKIE_SAMESITE: str = "none" if _ENV == "production" else "lax"  # cross-origin needs "none"
COOKIE_PATH = "/api/v1/auth"  # Only sent to auth endpoints


def _set_refresh_cookie(response: Response, token: str) -> None:
    """Set httpOnly refresh token cookie."""
    response.set_cookie(
        key=REFRESH_COOKIE_NAME,
        value=token,
        httponly=True,
        secure=COOKIE_SECURE,
        samesite=COOKIE_SAMESITE,
        path=COOKIE_PATH,
        max_age=REFRESH_TOKEN_EXPIRE_DAYS * 86400,
    )


def _clear_refresh_cookie(response: Response) -> None:
    """Remove refresh token cookie."""
    response.delete_cookie(
        key=REFRESH_COOKIE_NAME,
        path=COOKIE_PATH,
        httponly=True,
        secure=COOKIE_SECURE,
        samesite=COOKIE_SAMESITE,
    )


async def _store_refresh_token(db, user_id: str, token: str, family: str, expires_at) -> None:
    """Store refresh token in MongoDB for validation and rotation tracking."""
    await db["refresh_tokens"].insert_one({
        "token": token,
        "userId": user_id,
        "family": family,
        "expiresAt": expires_at,
        "isRevoked": False,
        "createdAt": datetime.now(timezone.utc),
    })


async def _revoke_token_family(db, family: str) -> None:
    """Revoke all tokens in a family (theft detection)."""
    await db["refresh_tokens"].update_many(
        {"family": family},
        {"$set": {"isRevoked": True}},
    )


# ──────────────────────────────────────────────
# REGISTER
# ──────────────────────────────────────────────

@router.post("/register", response_model=TokenPair)
@limiter.limit("5/minute")
async def register(
    request: Request,
    response: Response,
    data: RegisterRequest,
):
    """
    Register a new student account.
    
    - Validates email uniqueness
    - Validates password strength
    - Hashes password with Argon2id
    - Returns access + refresh token pair
    """
    db = get_database()
    users = db["users"]

    # Password strength check
    is_valid, err = validate_password_strength(data.password)
    if not is_valid:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=err)

    # Check email uniqueness
    existing = await users.find_one({"email": data.email})
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists",
        )

    # Build user document
    now = datetime.now(timezone.utc)
    
    # All registrations create student accounts
    # Admin promotion is done via seed script or admin endpoint
    role = "student"
    
    user_doc = {
        "email": data.email,
        "passwordHash": hash_password(data.password),
        "firstName": data.firstName,
        "lastName": data.lastName,
        "matricNumber": data.matricNumber,
        "phone": data.phone,
        "currentLevel": data.level,
        "admissionYear": data.admissionYear,
        "department": "Industrial Engineering",
        "role": role,
        "bio": None,
        "profilePictureUrl": None,
        "skills": [],
        "emailVerified": False,
        "hasCompletedOnboarding": False,
        "isActive": True,
        "createdAt": now,
        "updatedAt": now,
    }

    result = await users.insert_one(user_doc)
    user_id = str(result.inserted_id)

    # Auto-enroll in active session with selected level
    await _auto_enroll(db, user_id, data.level)

    # Issue tokens
    access = create_access_token(user_id, data.email, role)
    refresh, family, expires_at = create_refresh_token(user_id)
    await _store_refresh_token(db, user_id, refresh, family, expires_at)

    _set_refresh_cookie(response, refresh)

    return TokenPair(
        access_token=access,
        refresh_token=refresh,
        expires_in=ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )


# ──────────────────────────────────────────────
# LOGIN
# ──────────────────────────────────────────────

@router.post("/login", response_model=TokenPair)
@limiter.limit("10/minute")
async def login(
    request: Request,
    response: Response,
    data: LoginRequest,
):
    """
    Login with email and password.
    
    - Verifies Argon2id hash
    - Re-hashes if parameters changed
    - Returns access + sets httpOnly refresh cookie
    """
    db = get_database()
    users = db["users"]

    user = await users.find_one({"email": data.email})
    if not user or not user.get("passwordHash"):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    if not user.get("isActive", True):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is deactivated. Contact admin.",
        )

    if not verify_password(data.password, user["passwordHash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    # Re-hash if argon2 params changed
    if check_needs_rehash(user["passwordHash"]):
        new_hash = hash_password(data.password)
        await users.update_one(
            {"_id": user["_id"]},
            {"$set": {"passwordHash": new_hash}},
        )

    user_id = str(user["_id"])
    role = user.get("role", "student")

    # Update last login
    await users.update_one(
        {"_id": user["_id"]},
        {"$set": {"lastLogin": datetime.now(timezone.utc)}},
    )

    # Issue tokens
    access = create_access_token(user_id, user["email"], role)
    refresh, family, expires_at = create_refresh_token(user_id)
    await _store_refresh_token(db, user_id, refresh, family, expires_at)

    _set_refresh_cookie(response, refresh)

    return TokenPair(
        access_token=access,
        refresh_token=refresh,
        expires_in=ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )


# ──────────────────────────────────────────────
# REFRESH
# ──────────────────────────────────────────────

@router.post("/refresh", response_model=TokenPair)
async def refresh_token(request: Request, response: Response):
    """
    Rotate refresh token and issue a new access token.
    
    Security: If a refresh token is reused after rotation,
    the entire family is revoked (potential token theft).
    """
    db = get_database()

    # Get token from cookie or body
    token = request.cookies.get(REFRESH_COOKIE_NAME)
    if not token:
        # Fall back to body for mobile clients
        try:
            body = await request.json()
            token = body.get("refresh_token") if isinstance(body, dict) else None
        except Exception:
            # Empty body or invalid JSON - that's okay, we'll check cookie only
            pass

    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="No refresh token provided",
        )

    # Decode the token
    try:
        payload = decode_refresh_token(token)
    except Exception:
        _clear_refresh_cookie(response)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token",
        )

    user_id = payload["sub"]
    family = payload["family"]

    # Check if token exists and is not revoked
    stored = await db["refresh_tokens"].find_one({"token": token})

    if not stored:
        # Token not found — possible theft, revoke family
        await _revoke_token_family(db, family)
        _clear_refresh_cookie(response)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token not recognized. All sessions revoked for security.",
        )

    if stored.get("isRevoked"):
        # Reuse detected — THEFT. Revoke entire family.
        await _revoke_token_family(db, family)
        _clear_refresh_cookie(response)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token reuse detected. All sessions revoked for security.",
        )

    # Revoke the old token (it's been used)
    await db["refresh_tokens"].update_one(
        {"_id": stored["_id"]},
        {"$set": {"isRevoked": True}},
    )

    # Get user
    users = db["users"]
    user = await users.find_one({"_id": ObjectId(user_id)})
    if not user:
        _clear_refresh_cookie(response)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )

    role = user.get("role", "student")

    # Issue new pair (same family for rotation tracking)
    access = create_access_token(user_id, user["email"], role)
    new_refresh, _, expires_at = create_refresh_token(user_id, token_family=family)
    await _store_refresh_token(db, user_id, new_refresh, family, expires_at)

    _set_refresh_cookie(response, new_refresh)

    return TokenPair(
        access_token=access,
        refresh_token=new_refresh,
        expires_in=ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )


# ──────────────────────────────────────────────
# LOGOUT
# ──────────────────────────────────────────────

@router.post("/logout")
async def logout(request: Request, response: Response):
    """Logout: revoke refresh token family and clear cookie."""
    db = get_database()

    token = request.cookies.get(REFRESH_COOKIE_NAME)
    if token:
        try:
            payload = decode_refresh_token(token)
            await _revoke_token_family(db, payload["family"])
        except Exception:
            pass  # Token invalid — still clear cookie

    _clear_refresh_cookie(response)
    return {"message": "Logged out successfully"}


# ──────────────────────────────────────────────
# CHANGE PASSWORD
# ──────────────────────────────────────────────

@router.post("/change-password")
@limiter.limit("5/minute")
async def change_password(
    request: Request,
    data: ChangePasswordRequest,
    user: dict = Depends(get_current_user),
):
    """Change password for the currently authenticated user."""
    db = get_database()
    users = db["users"]

    # Get the user doc with password hash
    user_doc = await users.find_one({"_id": ObjectId(user["_id"])})
    if not user_doc or not user_doc.get("passwordHash"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot change password")

    # Verify current password
    if not verify_password(data.currentPassword, user_doc["passwordHash"]):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Current password is incorrect")

    # Validate new password
    is_valid, err = validate_password_strength(data.newPassword)
    if not is_valid:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=err)

    # Hash and save
    await users.update_one(
        {"_id": ObjectId(user["_id"])},
        {"$set": {"passwordHash": hash_password(data.newPassword), "updatedAt": datetime.now(timezone.utc)}},
    )

    return {"message": "Password changed successfully"}


# ──────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────

async def _auto_enroll(db, user_id: str, level: str = "100L") -> None:
    """Auto-enroll new student in active session."""
    sessions = db["sessions"]
    enrollments = db["enrollments"]

    active = await sessions.find_one({"isActive": True})
    if active:
        now = datetime.now(timezone.utc)
        await enrollments.insert_one({
            "studentId": user_id,
            "sessionId": str(active["_id"]),
            "level": level,
            "enrollmentDate": now,
            "createdAt": now,
            "isActive": True,
        })
