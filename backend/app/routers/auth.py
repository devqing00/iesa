"""
Auth Router — Firebase Auth edition

Endpoints:
- POST /register-profile         — Create MongoDB profile after Firebase account creation
- GET  /check-similar-email      — Pre-registration fuzzy-match check to prevent duplicate accounts
- GET  /verify-secondary-email   — Verify secondary email (custom dual-email system)
- POST /resend-verification      — Resend secondary email verification

All primary auth (login, register, password reset, email verification) is
handled client-side via the Firebase SDK.
"""

from fastapi import APIRouter, HTTPException, Depends, status, Request, Query
from datetime import datetime, timezone
from bson import ObjectId
import os
import logging
from typing import Optional
from slowapi import Limiter
from slowapi.util import get_remote_address
from jose import JWTError, ExpiredSignatureError

from app.core.auth import (
    verify_firebase_token,
    create_verification_token,
    decode_verification_token,
    RegisterProfileRequest,
)
from app.core.security import get_current_user
from app.core.email import send_verification_email, send_welcome_email
from app.core.error_handling import safe_detail
from app.core.error_handling import fire_and_forget
from app.db import get_database

router = APIRouter(prefix="/api/v1/auth", tags=["Auth"])
limiter = Limiter(key_func=get_remote_address)
logger = logging.getLogger("iesa_backend")


# ──────────────────────────────────────────────
# SIMILARITY HELPERS
# ──────────────────────────────────────────────

def _normalize_email_local(email: str) -> str:
    """Normalize email local-part: lowercase, strip dots, remove +alias."""
    local = email.split("@")[0].lower()
    local = local.split("+")[0]  # strip plus-alias
    local = local.replace(".", "")  # strip dots (gmail-style)
    return local


def _levenshtein_ratio(a: str, b: str) -> float:
    """Return similarity ratio between 0 and 1 using Levenshtein distance."""
    if not a and not b:
        return 1.0
    if not a or not b:
        return 0.0
    la, lb = len(a), len(b)
    # dp table
    dp = list(range(lb + 1))
    for i in range(1, la + 1):
        prev = dp[:]
        dp[0] = i
        for j in range(1, lb + 1):
            cost = 0 if a[i - 1] == b[j - 1] else 1
            dp[j] = min(dp[j] + 1, dp[j - 1] + 1, prev[j - 1] + cost)
    return 1.0 - dp[lb] / max(la, lb)


def _mask_email(email: str) -> str:
    """Mask email address for privacy: j***@gmail.com."""
    parts = email.split("@")
    if len(parts) != 2:
        return "***@***"
    local, domain = parts
    if len(local) <= 1:
        return f"{local}***@{domain}"
    return f"{local[0]}{'*' * min(len(local) - 1, 3)}@{domain}"


# ──────────────────────────────────────────────
# SIMILAR EMAIL CHECK (pre-registration)
# ──────────────────────────────────────────────

@router.get("/check-similar-email")
@limiter.limit("10/minute")
async def check_similar_email(
    request: Request,
    email: str = Query(..., description="Email address to check for similarity"),
    first_name: Optional[str] = Query(None, description="Optional first name for name-based matching"),
    last_name: Optional[str] = Query(None, description="Optional last name for name-based matching"),
):
    """
    Pre-registration similarity check.

    Returns existing accounts whose email is suspiciously close to the
    provided email (fuzzy match on local-part), or whose name matches.
    Results are privacy-masked (partial email + first name only).

    Used by the frontend to warn users who may be creating a duplicate account.
    Rate limited to 10 requests/minute per IP.
    """
    if not email or "@" not in email:
        return {"matches": []}

    db = get_database()
    incoming_local = _normalize_email_local(email)
    incoming_domain = email.split("@")[1].lower() if "@" in email else ""
    incoming_name = f"{(first_name or '').strip()} {(last_name or '').strip()}".strip().lower()

    # Only scan active accounts (limit to 500 for performance)
    cursor = db.users.find(
        {"isActive": {"$ne": False}},
        {"email": 1, "firstName": 1, "lastName": 1},
    ).limit(500)

    matches = []
    async for doc in cursor:
        stored_email = str(doc.get("email") or "")
        if not stored_email or "@" not in stored_email:
            continue

        # Skip exact match — they'd log in normally
        if stored_email.lower() == email.lower():
            continue

        stored_local = _normalize_email_local(stored_email)
        stored_domain = stored_email.split("@")[1].lower()
        stored_first = str(doc.get("firstName") or "").strip()
        stored_name = f"{stored_first} {doc.get('lastName', '').strip()}".strip().lower()

        # Strategy 1: normalised local-part similarity
        local_ratio = _levenshtein_ratio(incoming_local, stored_local)

        # Boost if domains also match
        domain_match = (incoming_domain == stored_domain)
        effective_ratio = local_ratio + (0.05 if domain_match else 0)

        # Strategy 2: name similarity (only if a name was provided)
        name_ratio = 0.0
        if incoming_name and stored_name:
            name_ratio = _levenshtein_ratio(incoming_name, stored_name)

        # Include if email is very similar OR name is very similar AND email moderately similar
        email_threshold = 0.82
        name_threshold = 0.80
        email_name_combo = 0.72  # lower email bar when name strongly matches

        is_similar = (
            effective_ratio >= email_threshold
            or (name_ratio >= name_threshold and local_ratio >= email_name_combo)
        )

        if is_similar:
            confidence = min(1.0, max(effective_ratio, name_ratio))
            matches.append({
                "maskedEmail": _mask_email(stored_email),
                "firstName": stored_first,
                "confidence": round(confidence, 2),
            })

        if len(matches) >= 3:
            break

    # Sort by confidence descending
    matches.sort(key=lambda x: x["confidence"], reverse=True)
    return {"matches": matches}


# ──────────────────────────────────────────────
# REGISTER PROFILE
# ──────────────────────────────────────────────

@router.post("/register-profile")
@limiter.limit("5/minute")
async def register_profile(request: Request, data: RegisterProfileRequest):
    """
    Create a MongoDB user profile for a freshly-created Firebase account.

    Called by the frontend immediately after signInWithEmailAndPassword /
    createUserWithEmailAndPassword / signInWithPopup completes.

    Flow:
    1. Verify the Firebase ID token to extract uid + email
    2. If a user doc with this firebaseUid already exists → return it (idempotent)
    3. Create user doc, auto-enroll in active session, return profile
    """
    db = get_database()
    users = db["users"]

    # 1. Verify token
    try:
        decoded = await verify_firebase_token(data.firebaseIdToken)
    except Exception:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid Firebase ID token")

    firebase_uid = decoded.get("uid") or decoded.get("user_id")
    email = decoded.get("email", "")

    if not firebase_uid or not email:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Token missing uid or email")

    # 2. Idempotent — if profile already exists, just return it
    existing = await users.find_one({"firebaseUid": firebase_uid})
    if existing:
        existing["_id"] = str(existing["_id"])
        return {"message": "Profile already exists", "user": existing}

    # Also check if the email was previously used (e.g. old non-Firebase account)
    email_existing = await users.find_one({"email": email})
    if email_existing:
        # Link the existing account to the new Firebase UID
        auth_provider = decoded.get("firebase", {}).get("sign_in_provider")
        email_verified = decoded.get("email_verified", False)
        await users.update_one(
            {"_id": email_existing["_id"]},
            {"$set": {
                "firebaseUid": firebase_uid,
                "authProvider": auth_provider,
                "emailVerified": email_verified,
                "updatedAt": datetime.now(timezone.utc)
            }},
        )
        email_existing["_id"] = str(email_existing["_id"])
        return {"message": "Profile linked to Firebase", "user": email_existing}

    # 3. Create new profile
    now = datetime.now(timezone.utc)

    INSTITUTIONAL_DOMAIN = "@stu.ui.edu.ng"
    email_type = "institutional" if email.lower().endswith(INSTITUTIONAL_DOMAIN) else "personal"

    # Parse dateOfBirth string to datetime (MongoDB/BSON requires datetime, not date)
    from datetime import date as date_type
    parsed_dob = None
    if data.dateOfBirth:
        try:
            dob_date = date_type.fromisoformat(data.dateOfBirth)
            parsed_dob = datetime(dob_date.year, dob_date.month, dob_date.day, tzinfo=timezone.utc)
        except (ValueError, TypeError):
            raise HTTPException(status_code=400, detail="Invalid date of birth format. Use YYYY-MM-DD.")

    auth_provider = decoded.get("firebase", {}).get("sign_in_provider")

    user_doc = {
        "firebaseUid": firebase_uid,
        "email": email,
        "firstName": data.firstName,
        "lastName": data.lastName,
        "matricNumber": data.matricNumber,
        "phone": data.phone,
        "currentLevel": data.level,
        "admissionYear": data.admissionYear,
        "department": data.department or "Industrial Engineering",
        "gender": data.gender,
        "isExternalStudent": (data.department or "Industrial Engineering") != "Industrial Engineering",
        "dateOfBirth": parsed_dob,
        "role": "student",
        "bio": None,
        "profilePictureUrl": None,
        "skills": [],
        "emailType": email_type,
        "secondaryEmail": None,
        "secondaryEmailType": None,
        "secondaryEmailVerified": False,
        "notificationEmailPreference": "primary",
        "notificationChannelPreference": "both",
        "emailVerified": decoded.get("email_verified", False),
        "authProvider": auth_provider,
        "hasCompletedOnboarding": False,
        "isActive": True,
        "createdAt": now,
        "updatedAt": now,
    }

    result = await users.insert_one(user_doc)
    user_id = str(result.inserted_id)

    # Auto-enroll in active session
    await _auto_enroll(db, user_id, data.level)

    # Send welcome email asynchronously (non-blocking)
    frontend_url = os.getenv("FRONTEND_URL", "http://localhost:3000").rstrip("/")
    dashboard_url = f"{frontend_url}/dashboard"
    student_name = f"{data.firstName} {data.lastName}".strip() or "Student"
    fire_and_forget(
        send_welcome_email(
            to=email,
            name=student_name,
            dashboard_url=dashboard_url,
            student_level=str(data.level) if data.level is not None else None,
            matric_number=data.matricNumber,
            department=data.department or "Industrial Engineering",
        )
    )

    user_doc["_id"] = user_id
    return {"message": "Profile created", "user": user_doc}


# ──────────────────────────────────────────────
# SECONDARY EMAIL VERIFICATION
# ──────────────────────────────────────────────

@router.get("/verify-secondary-email")
async def verify_secondary_email(token: str):
    """
    Verify user's secondary email address using token from verification email.
    """
    db = get_database()
    users = db["users"]

    try:
        payload = decode_verification_token(token, expected_type="secondary_email_verification")
        user_id = payload.get("sub")
        email = payload.get("email")

        if not user_id or not email:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid verification token")

        if not ObjectId.is_valid(user_id):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid verification token")

        user = await users.find_one({"_id": ObjectId(user_id)})
        if not user:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

        if user.get("secondaryEmail") != email:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Secondary email has changed since this link was generated.",
            )

        if user.get("secondaryEmailVerified"):
            return {"message": "Secondary email already verified", "alreadyVerified": True}

        await users.update_one(
            {"_id": ObjectId(user_id)},
            {"$set": {"secondaryEmailVerified": True, "updatedAt": datetime.now(timezone.utc)}},
        )

        return {"message": "Secondary email verified successfully", "alreadyVerified": False}

    except ExpiredSignatureError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Verification link expired.")
    except JWTError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=safe_detail("Invalid token", e))
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Secondary email verification error: {e}")
        raise HTTPException(status_code=500, detail="Verification error. Please try again.")


# ──────────────────────────────────────────────
# RESEND VERIFICATION (secondary email only)
# ──────────────────────────────────────────────

@router.post("/resend-verification")
@limiter.limit("3/minute")
async def resend_verification(request: Request, user: dict = Depends(get_current_user)):
    """Resend secondary email verification for the current user."""
    db = get_database()
    users = db["users"]

    user_doc = await users.find_one({"_id": ObjectId(user["_id"])})
    if not user_doc:
        raise HTTPException(status_code=404, detail="User not found")

    secondary = user_doc.get("secondaryEmail")
    if not secondary:
        raise HTTPException(status_code=400, detail="No secondary email set")

    if user_doc.get("secondaryEmailVerified"):
        return {"message": "Secondary email is already verified"}

    user_id = str(user_doc["_id"])
    name = f"{user_doc.get('firstName', '')} {user_doc.get('lastName', '')}".strip() or "Student"

    try:
        frontend_url = os.getenv("FRONTEND_URL", "http://localhost:3000").rstrip("/")
        token, _ = create_verification_token(user_id, secondary, "secondary_email_verification")
        url = f"{frontend_url}/verify-secondary-email?token={token}"
        email_sent = await send_verification_email(to=secondary, name=name, verification_url=url)
        if not email_sent:
            logger.warning(f"Email delivery failed for {secondary}. URL: {url}")
            return {"message": "Verification email queued."}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to resend verification: {e}")
        raise HTTPException(status_code=500, detail="Failed to send verification email.")

    return {"message": "Verification email sent. Check your inbox."}


# ──────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────

async def _auto_enroll(db, user_id: str, level: str | None = "100L") -> None:
    """Auto-enroll new student in active session."""
    sessions = db["sessions"]
    enrollments = db["enrollments"]

    active = await sessions.find_one({"isActive": True})
    if not active:
        return

    session_id = str(active["_id"])

    # If level is unknown (e.g. Google sign-up before onboarding), defer enrollment
    # creation to initialize_student_data which runs after onboarding with the real level.
    if not level:
        return

    if isinstance(level, int) or (isinstance(level, str) and level.isdigit()):
        level = f"{level}L"

    existing = await enrollments.find_one({
        "$or": [
            {"studentId": user_id, "sessionId": session_id},
            {"userId": user_id, "sessionId": session_id},
        ]
    })
    if existing:
        return

    now = datetime.now(timezone.utc)
    await enrollments.insert_one({
        "studentId": user_id,
        "sessionId": session_id,
        "level": level,
        "enrollmentDate": now,
        "createdAt": now,
        "isActive": True,
    })

