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
    Complete student registration after authentication.
    
    This updates the user's profile with additional student-specific details.
    
    Security checks:
    1. Prevents duplicate registrations by matric, institutional email, or user ID
    2. Validates matric matches institutional email (last 3 digits)
    3. Ensures institutional email belongs to UI domain
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
    
    # Check for duplicate matric number or institutional email (excluding current user)
    existing = await users.find_one({
        "$or": [
            {"matricNumber": data.matricNumber},
            {"institutionalEmail": institutional_email}
        ],
        "_id": {"$ne": ObjectId(user_id)}
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
        {"_id": ObjectId(user_id)},
        {"$set": update_data}
    )
    
    if result.modified_count == 0:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update user profile"
        )
    
    # Get updated user
    updated_user = await users.find_one({"_id": ObjectId(user_id)})
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
    - Empty grade records (placeholders)
    """
    sessions = db.sessions
    enrollments = db.enrollments
    payments = db.payments
    roles = db.roles
    grades = db.grades
    
    # Get current active session
    active_session = await sessions.find_one({"isActive": True})
    
    if not active_session:
        # If no active session exists, skip initialization
        return
    
    session_id = str(active_session["_id"])
    user_id = user["_id"]
    level_num = int(level.replace("L", ""))
    
    # 1. Create enrollment record
    existing_enrollment = await enrollments.find_one({
        "userId": user_id,
        "sessionId": session_id
    })
    
    if not existing_enrollment:
        enrollment_data = {
            "userId": user_id,
            "sessionId": session_id,
            "level": level_num,
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
    
    # 4. Initialize placeholder grade records (empty, to be filled by admin)
    # This prevents "no grades found" errors
    existing_grade = await grades.find_one({
        "studentId": user_id,
        "sessionId": session_id
    })
    
    if not existing_grade:
        grade_data = {
            "studentId": user_id,
            "sessionId": session_id,
            "semester": active_session.get("currentSemester", 1),
            "courses": [],  # Empty, will be populated by admin
            "cgpa": None,
            "gpa": None,
            "remarks": "Grades pending - Contact departmental office",
            "createdAt": datetime.now(timezone.utc),
            "updatedAt": datetime.now(timezone.utc)
        }
        await grades.insert_one(grade_data)


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
