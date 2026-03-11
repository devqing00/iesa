"""
Authentication Utilities — Firebase Auth edition

Most auth logic now lives in Firebase (password hashing, access tokens,
refresh tokens, email verification, password reset, 2FA).

This file retains only:
- EMAIL_SECRET_KEY + JWT helpers for **secondary** email verification
  (our custom dual-email feature; Firebase doesn't know about these)
- RegisterProfileRequest model (used by POST /auth/register-profile)
- Firebase Admin SDK initialisation helper
"""

import os
import base64
import json
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional

from jose import jwt, JWTError, ExpiredSignatureError   # noqa: F401 — re-exported
from pydantic import BaseModel, EmailStr, Field

import firebase_admin
from firebase_admin import credentials as fb_credentials, auth as fb_auth  # noqa: F401

logger = logging.getLogger("iesa_backend")

# ──────────────────────────────────────────────
# Firebase Admin SDK Initialisation
# ──────────────────────────────────────────────

_firebase_initialised = False


def init_firebase() -> None:
    """Initialise Firebase Admin SDK (idempotent — safe to call multiple times)."""
    global _firebase_initialised
    if _firebase_initialised or firebase_admin._apps:
        return

    # Prefer base64-encoded JSON (works in Docker / Render / Vercel)
    b64 = os.getenv("FIREBASE_SERVICE_ACCOUNT_JSON_BASE64", "")
    cred_path = os.getenv("FIREBASE_CREDENTIALS_PATH", "")

    if b64:
        info = json.loads(base64.b64decode(b64))
        cred = fb_credentials.Certificate(info)
    elif cred_path and os.path.exists(cred_path):
        cred = fb_credentials.Certificate(cred_path)
    elif os.path.exists("serviceAccountKey.json"):
        cred = fb_credentials.Certificate("serviceAccountKey.json")
    else:
        raise RuntimeError(
            "Firebase credentials not found.  Set FIREBASE_SERVICE_ACCOUNT_JSON_BASE64 "
            "or FIREBASE_CREDENTIALS_PATH, or place serviceAccountKey.json in the backend dir."
        )

    firebase_admin.initialize_app(cred)
    _firebase_initialised = True
    logger.info("Firebase Admin SDK initialised.")


async def verify_firebase_token(id_token: str) -> dict:
    """
    Verify a Firebase ID token (async-safe via run_in_executor).

    Returns the decoded token dict from Firebase Admin SDK.
    Raises firebase_admin.auth.InvalidIdTokenError on failure.
    """
    import asyncio
    loop = asyncio.get_running_loop()
    return await loop.run_in_executor(None, fb_auth.verify_id_token, id_token)


# ──────────────────────────────────────────────
# Configuration — Email Verification Token
# ──────────────────────────────────────────────

_ENV = os.getenv("ENVIRONMENT", "development")
_DEV_EMAIL = "iesa-dev-email-secret-do-not-use-in-production"

EMAIL_SECRET_KEY = os.getenv("JWT_EMAIL_SECRET_KEY", "")
if not EMAIL_SECRET_KEY:
    if _ENV == "production":
        raise RuntimeError(
            "FATAL: JWT_EMAIL_SECRET_KEY must be set in production "
            "(used for secondary email verification tokens)."
        )
    EMAIL_SECRET_KEY = _DEV_EMAIL
    logger.warning("⚠️  Using dev JWT_EMAIL_SECRET_KEY — set it for production.")

ALGORITHM = "HS256"
VERIFICATION_TOKEN_EXPIRE_HOURS = int(os.getenv("VERIFICATION_TOKEN_EXPIRE_HOURS", "24"))


# ──────────────────────────────────────────────
# Secondary Email Verification Tokens
# ──────────────────────────────────────────────

def create_verification_token(
    user_id: str,
    email: str,
    token_type: str = "email_verification",
) -> tuple[str, datetime]:
    """
    Create a JWT for email verification (secondary email flow).

    Args:
        user_id: MongoDB _id (string)
        email: The email address to verify
        token_type: "email_verification" | "secondary_email_verification"

    Returns (jwt_token, expires_at)
    """
    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(hours=VERIFICATION_TOKEN_EXPIRE_HOURS)
    payload = {
        "sub": user_id,
        "email": email,
        "type": token_type,
        "iat": now,
        "exp": expires_at,
    }
    token = jwt.encode(payload, EMAIL_SECRET_KEY, algorithm=ALGORITHM)
    return token, expires_at


def decode_verification_token(token: str, expected_type: str = "email_verification") -> dict:
    """
    Decode + validate an email verification JWT.

    Raises JWTError / ExpiredSignatureError on failure.
    """
    payload = jwt.decode(token, EMAIL_SECRET_KEY, algorithms=[ALGORITHM])
    if payload.get("type") != expected_type:
        raise JWTError("Invalid token type")
    return payload


# ──────────────────────────────────────────────
# Pydantic Models
# ──────────────────────────────────────────────

class RegisterProfileRequest(BaseModel):
    """
    Body for POST /auth/register-profile.
    Called *after* the frontend creates a Firebase user.
    """
    firebaseIdToken: str = Field(..., description="Firebase ID token proving the user just authenticated")
    firstName: str = Field(..., min_length=1, max_length=100)
    lastName: str = Field(..., min_length=1, max_length=100)
    matricNumber: Optional[str] = Field(None, max_length=50)
    phone: Optional[str] = Field(None, pattern=r"^(\+234|0)[789]\d{9}$")
    level: Optional[str] = Field(None, pattern=r"^\d{3}L$")
    admissionYear: Optional[int] = Field(None, ge=2000, le=2040)
    department: Optional[str] = Field(None, max_length=200)
    dateOfBirth: Optional[str] = Field(None, description="Date of birth in YYYY-MM-DD format")

