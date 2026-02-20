"""
In-App Authentication System

Replaces Firebase Auth with:
- Argon2id password hashing (OWASP recommended)
- JWT access tokens (short-lived, 15 min)
- Refresh tokens (long-lived, 7 days, stored in DB + httpOnly cookie)
- Token rotation with family tracking for theft detection
"""

import os
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional

from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError, VerificationError, InvalidHashError
from jose import jwt, JWTError, ExpiredSignatureError
from pydantic import BaseModel, EmailStr, Field

# ──────────────────────────────────────────────
# Configuration
# ──────────────────────────────────────────────

SECRET_KEY = os.getenv("JWT_SECRET_KEY", secrets.token_urlsafe(64))
REFRESH_SECRET_KEY = os.getenv("JWT_REFRESH_SECRET_KEY", secrets.token_urlsafe(64))
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "15"))
REFRESH_TOKEN_EXPIRE_DAYS = int(os.getenv("REFRESH_TOKEN_EXPIRE_DAYS", "7"))

# Argon2id hasher with OWASP-recommended parameters
ph = PasswordHasher(
    time_cost=3,        # 3 iterations
    memory_cost=65536,  # 64 MB
    parallelism=4,      # 4 threads
    hash_len=32,        # 32-byte hash
    salt_len=16,        # 16-byte salt
)


# ──────────────────────────────────────────────
# Pydantic Models
# ──────────────────────────────────────────────

class TokenPair(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int = Field(description="Access token TTL in seconds")


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128)
    firstName: str = Field(..., min_length=1, max_length=100)
    lastName: str = Field(..., min_length=1, max_length=100)
    matricNumber: Optional[str] = Field(None, max_length=50)
    phone: Optional[str] = Field(None, pattern=r"^(\+234|0)[789]\d{9}$")
    level: Optional[str] = Field(None, pattern=r"^\d{3}L$")
    admissionYear: Optional[int] = Field(None, ge=2000, le=2040)
    role: Optional[str] = Field(None, pattern=r"^(student|admin)$")


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=1)


class ChangePasswordRequest(BaseModel):
    currentPassword: str = Field(..., min_length=1)
    newPassword: str = Field(..., min_length=8, max_length=128)


class ResetPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordConfirm(BaseModel):
    token: str
    newPassword: str = Field(..., min_length=8, max_length=128)


# ──────────────────────────────────────────────
# Password Hashing
# ──────────────────────────────────────────────

def hash_password(password: str) -> str:
    """Hash a password using Argon2id."""
    return ph.hash(password)


def verify_password(password: str, hashed: str) -> bool:
    """Verify a password against its Argon2id hash."""
    try:
        return ph.verify(hashed, password)
    except (VerifyMismatchError, VerificationError, InvalidHashError):
        return False


def check_needs_rehash(hashed: str) -> bool:
    """Check if a hash needs to be re-hashed with updated parameters."""
    return ph.check_needs_rehash(hashed)


# ──────────────────────────────────────────────
# JWT Token Creation
# ──────────────────────────────────────────────

def create_access_token(
    user_id: str,
    email: str,
    role: str = "student",
    extra_claims: Optional[dict] = None,
) -> str:
    """
    Create a short-lived JWT access token.
    
    Claims:
        sub: user MongoDB _id (string)
        email: user email
        role: user role
        type: "access"
        iat: issued at
        exp: expiration (15 min default)
    """
    now = datetime.now(timezone.utc)
    payload = {
        "sub": user_id,
        "email": email,
        "role": role,
        "type": "access",
        "iat": now,
        "exp": now + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
    }
    if extra_claims:
        payload.update(extra_claims)
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def create_refresh_token(user_id: str, token_family: Optional[str] = None) -> tuple[str, str, datetime]:
    """
    Create a long-lived refresh token.
    
    Returns:
        (jwt_token, token_family, expires_at)
    
    Token family is used for rotation detection:
    - Each login creates a new family
    - Each refresh reuses the same family
    - If a token from the same family is used twice, the whole family is revoked (theft detected)
    """
    family = token_family or secrets.token_urlsafe(32)
    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    
    payload = {
        "sub": user_id,
        "type": "refresh",
        "family": family,
        "jti": secrets.token_urlsafe(16),  # unique token ID
        "iat": now,
        "exp": expires_at,
    }
    token = jwt.encode(payload, REFRESH_SECRET_KEY, algorithm=ALGORITHM)
    return token, family, expires_at


# ──────────────────────────────────────────────
# JWT Token Verification
# ──────────────────────────────────────────────

def decode_access_token(token: str) -> dict:
    """
    Decode and verify an access token.
    
    Returns the payload dict.
    Raises JWTError or ExpiredSignatureError on failure.
    """
    payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    if payload.get("type") != "access":
        raise JWTError("Invalid token type")
    return payload


def decode_refresh_token(token: str) -> dict:
    """
    Decode and verify a refresh token.
    
    Returns the payload dict.
    Raises JWTError or ExpiredSignatureError on failure.
    """
    payload = jwt.decode(token, REFRESH_SECRET_KEY, algorithms=[ALGORITHM])
    if payload.get("type") != "refresh":
        raise JWTError("Invalid token type")
    return payload


# ──────────────────────────────────────────────
# Password Strength Validation
# ──────────────────────────────────────────────

def validate_password_strength(password: str) -> tuple[bool, str]:
    """
    Validate password meets minimum security requirements.
    
    Requirements:
    - At least 8 characters
    - At least one uppercase letter
    - At least one lowercase letter
    - At least one digit
    - At least one special character
    
    Returns (is_valid, error_message)
    """
    if len(password) < 8:
        return False, "Password must be at least 8 characters long"
    if not any(c.isupper() for c in password):
        return False, "Password must contain at least one uppercase letter"
    if not any(c.islower() for c in password):
        return False, "Password must contain at least one lowercase letter"
    if not any(c.isdigit() for c in password):
        return False, "Password must contain at least one digit"
    if not any(c in "!@#$%^&*()_+-=[]{}|;':\",./<>?" for c in password):
        return False, "Password must contain at least one special character"
    return True, ""
