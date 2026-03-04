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
from jose import JWTError, ExpiredSignatureError
from pydantic import BaseModel

from app.core.auth import (
    async_hash_password,
    async_verify_password,
    check_needs_rehash,
    create_access_token,
    create_refresh_token,
    decode_access_token,
    decode_refresh_token,
    validate_password_strength,
    create_verification_token,
    decode_verification_token,
    create_reset_token,
    decode_reset_token,
    TokenPair,
    RegisterRequest,
    LoginRequest,
    ChangePasswordRequest,
    ResetPasswordRequest,
    ResetPasswordConfirm,
    ACCESS_TOKEN_EXPIRE_MINUTES,
    REFRESH_TOKEN_EXPIRE_DAYS,
)
from app.core.security import get_current_user
from app.core.email import send_verification_email, send_password_reset_email
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
    
    # Auto-detect email type from domain
    INSTITUTIONAL_DOMAIN = "@stu.ui.edu.ng"
    email_type = "institutional" if data.email.lower().endswith(INSTITUTIONAL_DOMAIN) else "personal"
    
    user_doc = {
        "email": data.email,
        "passwordHash": await async_hash_password(data.password),
        "firstName": data.firstName,
        "lastName": data.lastName,
        "matricNumber": data.matricNumber,
        "phone": data.phone,
        "currentLevel": data.level,
        "admissionYear": data.admissionYear,
        "department": data.department or "Industrial Engineering",
        "isExternalStudent": (data.department or "Industrial Engineering") != "Industrial Engineering",
        "role": role,
        "bio": None,
        "profilePictureUrl": None,
        "skills": [],
        "emailType": email_type,
        "secondaryEmail": None,
        "secondaryEmailType": None,
        "secondaryEmailVerified": False,
        "notificationEmailPreference": "primary",
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

    # Send verification email (non-blocking, errors logged but don't fail registration)
    try:
        frontend_url = os.getenv("FRONTEND_URL", "http://localhost:3000")
        verification_token, _ = create_verification_token(user_id, data.email)
        verification_url = f"{frontend_url}/verify-email?token={verification_token}"
        await send_verification_email(
            to=data.email,
            name=f"{data.firstName} {data.lastName}",
            verification_url=verification_url
        )
    except Exception as e:
        # Log error but don't fail registration
        import logging
        logging.error(f"Failed to send verification email: {e}")

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

    if not await async_verify_password(data.password, user["passwordHash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    # Re-hash if argon2 params changed
    if check_needs_rehash(user["passwordHash"]):
        new_hash = await async_hash_password(data.password)
        await users.update_one(
            {"_id": user["_id"]},
            {"$set": {"passwordHash": new_hash}},
        )

    user_id = str(user["_id"])
    role = user.get("role", "student")

    # Update last login (fire-and-forget — don't block the response)
    import asyncio
    _user_id_for_update = user["_id"]
    async def _update_last_login():
        await users.update_one(
            {"_id": _user_id_for_update},
            {"$set": {"lastLogin": datetime.now(timezone.utc)}},
        )
    asyncio.create_task(_update_last_login())

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
    if not await async_verify_password(data.currentPassword, user_doc["passwordHash"]):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Current password is incorrect")

    # Validate new password
    is_valid, err = validate_password_strength(data.newPassword)
    if not is_valid:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=err)

    # Hash and save
    await users.update_one(
        {"_id": ObjectId(user["_id"])},
        {"$set": {"passwordHash": await async_hash_password(data.newPassword), "updatedAt": datetime.now(timezone.utc)}},
    )

    return {"message": "Password changed successfully"}


# ──────────────────────────────────────────────
# EMAIL VERIFICATION
# ──────────────────────────────────────────────

@router.get("/verify-email")
async def verify_email(token: str):
    """
    Verify user's email address using token from verification email.
    
    - Validates JWT token
    - Marks emailVerified = True
    - Returns success message
    """
    db = get_database()
    users = db["users"]
    
    try:
        # Decode and validate token
        payload = decode_verification_token(token)
        user_id = payload.get("sub")
        email = payload.get("email")
        
        if not user_id or not email:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid verification token: missing user ID or email"
            )
        
        # Validate ObjectId format
        if not ObjectId.is_valid(user_id):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid verification token: malformed user ID"
            )
        
        # Find user
        user = await users.find_one({"_id": ObjectId(user_id), "email": email})
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found. The account may have been deleted."
            )
        
        # Check if already verified
        if user.get("emailVerified"):
            return {"message": "Email already verified", "alreadyVerified": True}
        
        # Mark as verified
        await users.update_one(
            {"_id": ObjectId(user_id)},
            {
                "$set": {
                    "emailVerified": True,
                    "updatedAt": datetime.now(timezone.utc)
                }
            }
        )
        
        return {"message": "Email verified successfully", "alreadyVerified": False}
        
    except ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Verification link has expired. Please request a new one."
        )
    except JWTError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid verification token: {str(e)}"
        )
    except Exception as e:
        # Log unexpected errors
        import logging
        logging.error(f"Unexpected error during email verification: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred during verification. Please try again or contact support."
        )


# ──────────────────────────────────────────────
# SECONDARY EMAIL VERIFICATION
# ──────────────────────────────────────────────

@router.get("/verify-secondary-email")
async def verify_secondary_email(token: str):
    """
    Verify user's secondary email address using token from verification email.
    
    - Validates JWT token with type "secondary_email_verification"
    - Marks secondaryEmailVerified = True
    - Returns success message
    """
    db = get_database()
    users = db["users"]
    
    try:
        # Decode token with secondary-specific type check
        payload = decode_verification_token(token, expected_type="secondary_email_verification")
        user_id = payload.get("sub")
        email = payload.get("email")
        
        if not user_id or not email:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid verification token: missing user ID or email"
            )
        
        if not ObjectId.is_valid(user_id):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid verification token: malformed user ID"
            )
        
        # Find user and verify the secondary email still matches
        user = await users.find_one({"_id": ObjectId(user_id)})
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found. The account may have been deleted."
            )
        
        # Ensure the token email matches the current secondary email
        if user.get("secondaryEmail") != email:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Secondary email has been changed since this link was generated. Please request a new verification."
            )
        
        # Check if already verified
        if user.get("secondaryEmailVerified"):
            return {"message": "Secondary email already verified", "alreadyVerified": True}
        
        # Mark secondary email as verified
        await users.update_one(
            {"_id": ObjectId(user_id)},
            {
                "$set": {
                    "secondaryEmailVerified": True,
                    "updatedAt": datetime.now(timezone.utc)
                }
            }
        )
        
        return {"message": "Secondary email verified successfully", "alreadyVerified": False}
        
    except ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Verification link has expired. Please request a new one."
        )
    except JWTError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid verification token: {str(e)}"
        )
    except HTTPException:
        raise
    except Exception as e:
        import logging
        logging.error(f"Unexpected error during secondary email verification: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred during verification. Please try again or contact support."
        )


# ──────────────────────────────────────────────
# FORGOT PASSWORD
# ──────────────────────────────────────────────

@router.post("/forgot-password")
@limiter.limit("3/minute")
async def forgot_password(request: Request, data: ResetPasswordRequest):
    """
    Request a password reset email.
    
    Always returns success to prevent email enumeration.
    """
    db = get_database()
    users = db["users"]

    user = await users.find_one({"email": data.email})
    
    # Always return success to prevent email enumeration
    if not user:
        return {"message": "If an account exists with this email, a reset link has been sent."}
    
    if not user.get("isActive", True):
        return {"message": "If an account exists with this email, a reset link has been sent."}

    user_id = str(user["_id"])
    name = f"{user.get('firstName', '')} {user.get('lastName', '')}".strip() or "Student"

    try:
        frontend_url = os.getenv("FRONTEND_URL", "http://localhost:3000")
        reset_token, _ = create_reset_token(user_id, data.email)
        reset_url = f"{frontend_url}/reset-password?token={reset_token}"
        await send_password_reset_email(
            to=data.email,
            name=name,
            reset_url=reset_url
        )
    except Exception as e:
        import logging
        logging.error(f"Failed to send password reset email: {e}")

    return {"message": "If an account exists with this email, a reset link has been sent."}


# ──────────────────────────────────────────────
# RESET PASSWORD
# ──────────────────────────────────────────────

@router.post("/reset-password")
@limiter.limit("5/minute")
async def reset_password(request: Request, data: ResetPasswordConfirm):
    """
    Reset password using a token from the reset email.
    """
    db = get_database()
    users = db["users"]

    try:
        payload = decode_reset_token(data.token)
        user_id = payload.get("sub")
        email = payload.get("email")
        
        if not user_id or not email:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid reset token"
            )
        
        if not ObjectId.is_valid(user_id):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid reset token"
            )
        
        # Validate new password
        is_valid, err = validate_password_strength(data.newPassword)
        if not is_valid:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=err)
        
        # Find user
        user = await users.find_one({"_id": ObjectId(user_id), "email": email})
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        # Update password
        await users.update_one(
            {"_id": ObjectId(user_id)},
            {
                "$set": {
                    "passwordHash": await async_hash_password(data.newPassword),
                    "updatedAt": datetime.now(timezone.utc)
                }
            }
        )

        # Revoke all refresh tokens for this user (force re-login)
        await db["refresh_tokens"].update_many(
            {"userId": user_id},
            {"$set": {"isRevoked": True}},
        )
        
        return {"message": "Password reset successfully. Please log in with your new password."}
        
    except ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Reset link has expired. Please request a new one."
        )
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid reset token"
        )


# ──────────────────────────────────────────────
# RESEND VERIFICATION EMAIL
# ──────────────────────────────────────────────

@router.post("/resend-verification")
@limiter.limit("3/minute")
async def resend_verification(request: Request, user: dict = Depends(get_current_user)):
    """
    Resend email verification for the current user.
    """
    db = get_database()
    users = db["users"]

    user_doc = await users.find_one({"_id": ObjectId(user["_id"])})
    if not user_doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    if user_doc.get("emailVerified"):
        return {"message": "Email is already verified"}

    user_id = str(user_doc["_id"])
    email = user_doc["email"]
    name = f"{user_doc.get('firstName', '')} {user_doc.get('lastName', '')}".strip() or "Student"

    try:
        frontend_url = os.getenv("FRONTEND_URL", "http://localhost:3000")
        verification_token, _ = create_verification_token(user_id, email)
        verification_url = f"{frontend_url}/verify-email?token={verification_token}"
        email_sent = await send_verification_email(
            to=email,
            name=name,
            verification_url=verification_url
        )
        if not email_sent:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to send verification email. Please try again later."
            )
    except HTTPException:
        raise
    except Exception as e:
        import logging
        logging.error(f"Failed to resend verification email: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to send verification email. Please try again later."
        )

    return {"message": "Verification email sent. Please check your inbox."}


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
