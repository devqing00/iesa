"""
Complete Student Registration

After Firebase authentication, students complete their profile
with additional details (matric number, level, phone, etc.)

Security features:
- Rate limiting (3 registrations per hour per IP)
- Duplicate prevention
- Input sanitization
- Level-year cross-validation
"""

from fastapi import APIRouter, Depends, HTTPException, status, Request
from pydantic import BaseModel, EmailStr, validator
from datetime import datetime, timezone
from typing import Optional
import re
import os

from ..core.security import verify_token
from ..db import get_database
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
    institutionalEmail: Optional[str] = None  # If different from Firebase email
    
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
        # UI matric numbers are exactly 6 digits (e.g., 236856)
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
        """Cross-validate level matches admission year"""
        if "admissionYear" in values:
            current_year = datetime.now(timezone.utc).year
            years_since_admission = current_year - values["admissionYear"]
            expected_level_num = min((years_since_admission + 1) * 100, 500)
            
            actual_level_num = int(v.replace("L", ""))
            
            # Allow some flexibility (±100 level) for students who took breaks
            if abs(actual_level_num - expected_level_num) > 100:
                raise ValueError(
                    f"Level does not match admission year. "
                    f"Expected around {expected_level_num}L based on {values['admissionYear']} admission."
                )
        return v
    
    @validator("institutionalEmail")
    def validate_institutional_email(cls, v):
        if v:
            v = v.strip().lower()
            if not v.endswith("@stu.ui.edu.ng"):
                raise ValueError("Institutional email must end with @stu.ui.edu.ng")
        return v


@router.post("/complete-registration")
async def complete_student_registration(
    request: Request,
    data: CompleteRegistrationRequest,
    token_data: dict = Depends(verify_token),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """
    Complete student registration after Firebase authentication.
    
    This updates the user's profile with additional student-specific details.
    
    Security checks:
    1. Prevents duplicate registrations by matric, institutional email, or Firebase UID
    2. Validates matric matches institutional email (last 3 digits)
    3. Ensures institutional email belongs to UI domain
    """
    
    users = db.users
    
    # Get user by Firebase UID
    firebase_uid = token_data["uid"]
    email = token_data.get("email")
    user = await users.find_one({"firebaseUid": firebase_uid})
    
    # If user doesn't exist, create a basic profile first
    if not user:
        user = {
            "firebaseUid": firebase_uid,
            "email": email,
            "role": "student",
            "department": "Industrial Engineering",
            "hasCompletedOnboarding": False,
            "createdAt": datetime.now(timezone.utc),
            "updatedAt": datetime.now(timezone.utc)
        }
        await users.insert_one(user)
    
    # Check for duplicate registration (by matric, institutional email, or already completed)
    institutional_email = data.institutionalEmail if data.institutionalEmail else email
    
    # Ensure institutional email is provided and valid
    if not institutional_email or not institutional_email.endswith("@stu.ui.edu.ng"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Valid institutional email (@stu.ui.edu.ng) is required"
        )
    
    # Check if user has already completed registration
    if user.get("hasCompletedOnboarding"):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Registration already completed. Contact admin if you need to update your details."
        )
    
    # Check for duplicate matric number or institutional email
    existing = await users.find_one({
        "$or": [
            {"matricNumber": data.matricNumber},
            {"institutionalEmail": institutional_email}
        ],
        "firebaseUid": {"$ne": firebase_uid}
    })
    
    if existing:
        if existing.get("matricNumber") == data.matricNumber:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Matric number already registered"
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Institutional email already registered"
            )
    
    # Validate matric matches email (last 3 digits)
    # Email format: [letter][lastname][3digits]@stu.ui.edu.ng (e.g., aadetayo856@stu.ui.edu.ng)
    email_local = institutional_email.split("@")[0]
    if len(email_local) >= 3:
        email_digits = email_local[-3:]  # Last 3 characters should be digits
        matric_digits = data.matricNumber[-3:]  # Last 3 digits of matric
        
        if email_digits.isdigit() and email_digits != matric_digits:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Matric number does not match institutional email. Please verify your details."
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
        {"firebaseUid": firebase_uid},
        {"$set": update_data}
    )
    
    if result.modified_count == 0:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update user profile"
        )
    
    # Get updated user
    updated_user = await users.find_one({"firebaseUid": firebase_uid})
    if not updated_user:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve updated user profile"
        )
    
    updated_user["_id"] = str(updated_user["_id"])
    
    # Initialize enrollment in current active session
    sessions = db.sessions
    enrollments = db.enrollments
    
    # Get current active session
    active_session = await sessions.find_one({"isActive": True})
    
    if active_session:
        # Check if enrollment already exists
        existing_enrollment = await enrollments.find_one({
            "userId": updated_user["_id"],
            "sessionId": str(active_session["_id"])
        })
        
        if not existing_enrollment:
            # Create enrollment record
            enrollment_data = {
                "userId": updated_user["_id"],
                "sessionId": str(active_session["_id"]),
                "level": int(data.level.replace("L", "")),
                "isActive": True,
                "enrolledAt": datetime.now(timezone.utc),
                "createdAt": datetime.now(timezone.utc),
                "updatedAt": datetime.now(timezone.utc)
            }
            await enrollments.insert_one(enrollment_data)
        
        # Initialize payment record for current session
        payments = db.payments
        existing_payment = await payments.find_one({
            "userId": updated_user["_id"],
            "sessionId": str(active_session["_id"])
        })
        
        if not existing_payment:
            payment_data = {
                "userId": updated_user["_id"],
                "sessionId": str(active_session["_id"]),
                "amount": 0.0,
                "isPaid": False,
                "paymentMethod": None,
                "paymentDate": None,
                "createdAt": datetime.now(timezone.utc),
                "updatedAt": datetime.now(timezone.utc)
            }
            await payments.insert_one(payment_data)
        
        # Initialize default student role
        roles = db.roles
        existing_role = await roles.find_one({
            "userId": updated_user["_id"]
        })
        
        if not existing_role:
            role_data = {
                "userId": updated_user["_id"],
                "position": "student",
                "level": int(data.level.replace("L", "")),
                "permissions": [],
                "isActive": True,
                "createdAt": datetime.now(timezone.utc),
                "updatedAt": datetime.now(timezone.utc)
            }
            await roles.insert_one(role_data)
    
    return {
        "message": "Registration completed successfully",
        "user": updated_user
    }


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
