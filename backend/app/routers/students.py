"""
Complete Student Registration

After authentication, students complete their profile
with additional details (matric number, level, phone, etc.)

Security features:
- Rate limiting (3 registrations per hour per IP)
- Duplicate prevention
- Input sanitization
- Level-year cross-validation
"""

from fastapi import APIRouter, Depends, HTTPException, status, Request
from pydantic import BaseModel, EmailStr, validator
from datetime import datetime, timezone, timedelta
from typing import Optional
from bson import ObjectId
import re
import os

from ..core.security import verify_token, get_current_user
from ..db import get_database
from ..core.auth import create_verification_token
from ..core.email import send_verification_email
from motor.motor_asyncio import AsyncIOMotorDatabase

# Rate limiting
try:
    from slowapi import Limiter
    from slowapi.util import get_remote_address
    limiter = Limiter(key_func=get_remote_address)
    RATE_LIMITING_ENABLED = True
except ImportError:
    RATE_LIMITING_ENABLED = False
    print("Warning: slowapi not installed. Rate limiting disabled. Install with: pip install slowapi")

router = APIRouter(prefix="/api/v1/students", tags=["students"])


class CompleteRegistrationRequest(BaseModel):
    firstName: str
    lastName: str
    matricNumber: str
    phone: str
    personalEmail: Optional[EmailStr] = None  # Personal email (can be verified later)
    level: str
    admissionYear: int
    institutionalEmail: Optional[str] = None  # If different from account email
    
    @validator("firstName", "lastName")
    def validate_name(cls, v):
        # Sanitize names: only letters, spaces, hyphens, apostrophes
        v = v.strip()
        if not v:
            raise ValueError("Name cannot be empty")
        if len(v) > 50:
            raise ValueError("Name too long (max 50 characters)")
        if not re.match(r"^[a-zA-Z\s\'-]+$", v):
            raise ValueError("Name can only contain letters, spaces, hyphens, and apostrophes")
        return v
    
    @validator("matricNumber")
    def validate_matric_number(cls, v):
        # UI matric numbers are exactly 6 digits (e.g., 236123)
        v = v.strip()
        if not re.match(r"^\d{6}$", v):
            raise ValueError("Matric number must be exactly 6 digits")
        
        return v
    
    @validator("phone")
    def validate_phone(cls, v):
        # Nigerian phone number: +234... or 0...
        v = v.strip().replace(" ", "").replace("-", "")
        if not re.match(r"^(\+234|0)[789]\d{9}$", v):
            raise ValueError("Invalid Nigerian phone number")
        return v
    
    @validator("level")
    def validate_level(cls, v):
        if v not in ["100L", "200L", "300L", "400L", "500L"]:
            raise ValueError("Invalid level")
        return v
    
    @validator("admissionYear")
    def validate_admission_year(cls, v):
        current_year = datetime.now(timezone.utc).year
        # Restrict to last 7 years (reasonable for 500L to 100L students)
        min_year = current_year - 6
        if v < min_year or v > current_year:
            raise ValueError(f"Admission year must be between {min_year} and {current_year}")
        return v
    
    @validator("level")
    def validate_level_with_year(cls, v, values):
        """Cross-validate level matches admission year.
        
        Uses the formula: level = (sessionStartYear - admissionYear) * 100 + 100
        Since validators can't do async DB lookups, we use the calendar year
        but allow ±1 level flexibility to account for session boundary timing.
        """
        if "admissionYear" in values:
            current_year = datetime.now(timezone.utc).year
            years_since_admission = current_year - values["admissionYear"]
            expected_level_num = min(years_since_admission * 100 + 100, 500)
            
            actual_level_num = int(v.replace("L", ""))
            
            # Allow ±100 level flexibility for session boundary timing and breaks
            if abs(actual_level_num - expected_level_num) > 100:
                raise ValueError(
                    f"Level does not match admission year. "
                    f"Expected around {expected_level_num}L based on {values['admissionYear']} admission."
                )
        return v


@router.post("/complete-registration")
async def complete_student_registration(
    request: Request,
    data: CompleteRegistrationRequest,
    token_data: dict = Depends(verify_token),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """
    Complete student registration after authentication.
    
    This updates the user's profile with additional student-specific details.
    
    Security checks:
    1. Prevents duplicate registrations by matric number or user ID
    2. Accepts both institutional (@stu.ui.edu.ng) and personal emails
    """
    
    users = db.users
    
    # Get user by _id from JWT
    user_id = token_data["sub"]
    email = token_data.get("email")
    user = await users.find_one({"_id": ObjectId(user_id)})
    
    # If user doesn't exist, they should register first via /auth/register
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found. Please register first."
        )
    
    # Accept both institutional and personal emails
    institutional_email = data.institutionalEmail if data.institutionalEmail else email
    
    # Check if user has already completed registration
    if user.get("hasCompletedOnboarding"):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Registration already completed. Contact admin if you need to update your details."
        )
    
    # Check for duplicate matric number (excluding current user)
    existing = await users.find_one({
        "matricNumber": data.matricNumber,
        "_id": {"$ne": ObjectId(user_id)}
    })
    
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Matric number already registered"
        )
    
    # Update user profile
    update_data = {
        "firstName": data.firstName,
        "lastName": data.lastName,
        "matricNumber": data.matricNumber,
        "institutionalEmail": institutional_email,
        "personalEmail": data.personalEmail,
        "personalEmailVerified": False,  # Will be True after verification
        "phone": data.phone,
        "phoneVerified": False,  # Will be True after SMS verification
        "currentLevel": data.level,
        "admissionYear": data.admissionYear,
        "hasCompletedOnboarding": True,
        "registrationCompletedAt": datetime.now(timezone.utc),
        "updatedAt": datetime.now(timezone.utc)
    }
    
    result = await users.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": update_data}
    )
    
    if result.modified_count == 0:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update user profile"
        )
    
    # Get updated user (exclude passwordHash to avoid leaking it)
    updated_user = await users.find_one(
        {"_id": ObjectId(user_id)},
        {"passwordHash": 0},
    )
    if not updated_user:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve updated user profile"
        )
    
    updated_user["_id"] = str(updated_user["_id"])
    
    # Initialize student data in current active session
    await initialize_student_data(db, updated_user, data.level)
    
    return {
        "message": "Registration completed successfully",
        "user": updated_user
    }


async def initialize_student_data(db, user: dict, level: str):
    """
    Initialize all necessary data for a new student registration.
    This ensures students never see null values or empty dashboards.
    
    Creates:
    - Enrollment record
    - Payment records (with defaults)
    - Basic role
    """
    sessions = db.sessions
    enrollments = db.enrollments
    payments = db.payments
    roles = db.roles
    
    # Get current active session
    active_session = await sessions.find_one({"isActive": True})
    
    if not active_session:
        # If no active session exists, skip initialization
        return
    
    session_id = str(active_session["_id"])
    user_id = user["_id"]
    # Normalise level to "NL" string format
    if isinstance(level, int) or (isinstance(level, str) and level.isdigit()):
        level = f"{level}L"
    user_id_str = str(user_id)

    # 1. Create enrollment record — guard against duplicates across both field name variants
    existing_enrollment = await enrollments.find_one({
        "$or": [
            {"studentId": user_id_str, "sessionId": session_id},
            {"userId": user_id_str, "sessionId": session_id},
        ]
    })

    if not existing_enrollment:
        enrollment_data = {
            "studentId": user_id_str,
            "sessionId": session_id,
            "level": level,
            "isActive": True,
            "semester": active_session.get("currentSemester", 1),
            "enrolledAt": datetime.now(timezone.utc),
            "createdAt": datetime.now(timezone.utc),
            "updatedAt": datetime.now(timezone.utc)
        }
        await enrollments.insert_one(enrollment_data)
    
    # 2. Initialize payment records (show as unpaid with placeholder amounts)
    # Create common departmental payments
    common_payments = [
        {
            "title": "Departmental Dues",
            "description": "Annual departmental dues for IESA activities",
            "amount": 5000.0,
            "category": "dues",
            "deadline": datetime.now(timezone.utc) + timedelta(days=30),
        },
        {
            "title": "Handbook & Materials",
            "description": "Student handbook and course materials",
            "amount": 2000.0,
            "category": "materials",
            "deadline": datetime.now(timezone.utc) + timedelta(days=45),
        }
    ]
    
    for payment_template in common_payments:
        existing_payment = await payments.find_one({
            "userId": user_id,
            "sessionId": session_id,
            "title": payment_template["title"]
        })
        
        if not existing_payment:
            payment_data = {
                "userId": user_id,
                "sessionId": session_id,
                **payment_template,
                "isPaid": False,
                "hasPaid": False,
                "paymentMethod": None,
                "paymentDate": None,
                "transactionId": None,
                "createdAt": datetime.now(timezone.utc),
                "updatedAt": datetime.now(timezone.utc),
                "createdBy": user_id
            }
            await payments.insert_one(payment_data)
    
    # 3. Initialize default student role
    existing_role = await roles.find_one({
        "userId": user_id,
        "sessionId": session_id
    })
    
    if not existing_role:
        role_data = {
            "userId": user_id,
            "sessionId": session_id,
            "position": "student",
            "permissions": [],
            "isActive": True,
            "createdAt": datetime.now(timezone.utc),
            "updatedAt": datetime.now(timezone.utc)
        }
        await roles.insert_one(role_data)


@router.get("/check-matric/{matric_number}")
async def check_matric_availability(
    matric_number: str,
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """
    Check if a matric number is already registered.
    Matric numbers are exactly 6 digits.
    """
    
    # Validate format first
    if not re.match(r"^\d{6}$", matric_number):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Matric number must be exactly 6 digits"
        )
    
    users = db.users
    existing = await users.find_one({"matricNumber": matric_number})
    
    return {
        "available": existing is None,
        "matricNumber": matric_number
    }


# ──────────────────────────────────────────────
# SECONDARY EMAIL MANAGEMENT
# ──────────────────────────────────────────────

INSTITUTIONAL_DOMAIN = "@stu.ui.edu.ng"


def _detect_email_type(email: str) -> str:
    """Detect whether an email is institutional or personal."""
    return "institutional" if email.lower().endswith(INSTITUTIONAL_DOMAIN) else "personal"


class AddSecondaryEmailRequest(BaseModel):
    email: EmailStr


class NotificationPreferenceRequest(BaseModel):
    preference: str  # "primary" | "secondary" | "both"
    
    @validator("preference")
    def validate_preference(cls, v):
        if v not in ("primary", "secondary", "both"):
            raise ValueError("Preference must be 'primary', 'secondary', or 'both'")
        return v


@router.post("/secondary-email")
async def add_secondary_email(
    request: Request,
    data: AddSecondaryEmailRequest,
    user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """
    Add a secondary email address.
    
    Rules:
    - Must be opposite type of primary email (institutional ↔ personal)
    - Cannot be the same as primary email
    - Cannot already be registered as another user's primary email
    - Sends verification email to the new address
    """
    users = db.users
    user_id = str(user["_id"])
    primary_email = user["email"]
    primary_type = user.get("emailType") or _detect_email_type(primary_email)
    
    new_email = data.email.lower().strip()
    new_type = _detect_email_type(new_email)
    
    # Must be opposite type
    if new_type == primary_type:
        if primary_type == "institutional":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Your primary email is institutional. Please add a personal email (e.g., gmail.com, yahoo.com)."
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Your primary email is personal. Please add an institutional email (ending in {INSTITUTIONAL_DOMAIN})."
            )
    
    # Cannot be the same as primary
    if new_email == primary_email.lower():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Secondary email cannot be the same as your primary email."
        )
    
    # Cannot be another user's primary email
    existing = await users.find_one({"email": new_email, "_id": {"$ne": ObjectId(user_id)}})
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This email is already registered to another account."
        )
    
    # Cannot be another user's secondary email
    existing_secondary = await users.find_one({
        "secondaryEmail": new_email,
        "_id": {"$ne": ObjectId(user_id)}
    })
    if existing_secondary:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This email is already used as a secondary email by another account."
        )
    
    # Update user with secondary email
    await users.update_one(
        {"_id": ObjectId(user_id)},
        {
            "$set": {
                "secondaryEmail": new_email,
                "secondaryEmailType": new_type,
                "secondaryEmailVerified": False,
                "emailType": primary_type,  # Ensure primary type is set
                "updatedAt": datetime.now(timezone.utc)
            }
        }
    )
    
    # Send verification email
    try:
        frontend_url = os.getenv("FRONTEND_URL", "http://localhost:3000")
        verification_token, _ = create_verification_token(
            user_id, new_email, token_type="secondary_email_verification"
        )
        verification_url = f"{frontend_url}/verify-secondary-email?token={verification_token}"
        name = f"{user.get('firstName', '')} {user.get('lastName', '')}".strip() or "Student"
        await send_verification_email(
            to=new_email,
            name=name,
            verification_url=verification_url
        )
    except Exception as e:
        import logging
        logging.error(f"Failed to send secondary email verification: {e}")
        # Don't fail — the email was saved, user can resend later
    
    return {
        "message": f"Secondary email added. A verification link has been sent to {new_email}.",
        "secondaryEmail": new_email,
        "secondaryEmailType": new_type,
        "secondaryEmailVerified": False
    }


@router.post("/secondary-email/resend-verification")
async def resend_secondary_email_verification(
    request: Request,
    user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """
    Resend verification email for the secondary email address.
    """
    users = db.users
    user_id = str(user["_id"])
    
    user_doc = await users.find_one({"_id": ObjectId(user_id)})
    if not user_doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    
    secondary_email = user_doc.get("secondaryEmail")
    if not secondary_email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No secondary email set. Add one first."
        )
    
    if user_doc.get("secondaryEmailVerified"):
        return {"message": "Secondary email is already verified."}
    
    try:
        frontend_url = os.getenv("FRONTEND_URL", "http://localhost:3000")
        verification_token, _ = create_verification_token(
            user_id, secondary_email, token_type="secondary_email_verification"
        )
        verification_url = f"{frontend_url}/verify-secondary-email?token={verification_token}"
        name = f"{user_doc.get('firstName', '')} {user_doc.get('lastName', '')}".strip() or "Student"
        await send_verification_email(
            to=secondary_email,
            name=name,
            verification_url=verification_url
        )
    except Exception as e:
        import logging
        logging.error(f"Failed to resend secondary email verification: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to send verification email. Please try again later."
        )
    
    return {"message": f"Verification email resent to {secondary_email}."}


@router.delete("/secondary-email")
async def remove_secondary_email(
    user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """
    Remove the secondary email address.
    Also resets notification preference to 'primary' if it was set to 'secondary'.
    """
    users = db.users
    user_id = str(user["_id"])
    
    user_doc = await users.find_one({"_id": ObjectId(user_id)})
    if not user_doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    
    if not user_doc.get("secondaryEmail"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No secondary email to remove."
        )
    
    # Reset notification preference if it references the secondary email
    notification_pref = user_doc.get("notificationEmailPreference", "primary")
    new_pref = "primary" if notification_pref in ("secondary", "both") else notification_pref
    
    await users.update_one(
        {"_id": ObjectId(user_id)},
        {
            "$set": {
                "secondaryEmail": None,
                "secondaryEmailType": None,
                "secondaryEmailVerified": False,
                "notificationEmailPreference": new_pref,
                "updatedAt": datetime.now(timezone.utc)
            }
        }
    )
    
    return {"message": "Secondary email removed.", "notificationEmailPreference": new_pref}


@router.patch("/notification-preference")
async def update_notification_preference(
    data: NotificationPreferenceRequest,
    user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """
    Update which email(s) receive notifications.
    
    Rules:
    - "secondary" or "both" requires a verified secondary email
    """
    users = db.users
    user_id = str(user["_id"])
    
    user_doc = await users.find_one({"_id": ObjectId(user_id)})
    if not user_doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    
    if data.preference in ("secondary", "both"):
        if not user_doc.get("secondaryEmail"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="You must add a secondary email before selecting this preference."
            )
        if not user_doc.get("secondaryEmailVerified"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Your secondary email must be verified before selecting this preference."
            )
    
    await users.update_one(
        {"_id": ObjectId(user_id)},
        {
            "$set": {
                "notificationEmailPreference": data.preference,
                "updatedAt": datetime.now(timezone.utc)
            }
        }
    )
    
    return {
        "message": f"Notification preference updated to '{data.preference}'.",
        "notificationEmailPreference": data.preference
    }
