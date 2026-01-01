"""
User Models - Persistent across all sessions

Users are the ONLY collection without session_id.
They represent the permanent identity of a person.
"""

from pydantic import BaseModel, EmailStr, Field
from typing import Optional, Literal
from datetime import datetime
from bson import ObjectId


class PyObjectId(ObjectId):
    """Custom ObjectId type for Pydantic"""
    @classmethod
    def __get_validators__(cls):
        yield cls.validate

    @classmethod
    def validate(cls, v):
        if not ObjectId.is_valid(v):
            raise ValueError("Invalid ObjectId")
        return ObjectId(v)

    @classmethod
    def __get_pydantic_json_schema__(cls, field_schema):
        field_schema.update(type="string")


class UserBase(BaseModel):
    email: EmailStr
    firstName: str = Field(..., min_length=1, max_length=100)
    lastName: str = Field(..., min_length=1, max_length=100)
    matricNumber: Optional[str] = Field(None, min_length=1, max_length=50)  # Flexible format
    department: str = Field(default="Industrial Engineering")
    phone: Optional[str] = Field(None, pattern=r"^\+?[0-9]{10,15}$")
    role: Literal["student", "admin", "exco"] = Field(default="student")
    bio: Optional[str] = Field(None, max_length=500)
    profilePictureUrl: Optional[str] = None
    
    # Phase 1 Enhancements
    admissionYear: Optional[int] = Field(None, ge=2000, le=2030, description="Year student was admitted")
    currentLevel: Optional[Literal["100L", "200L", "300L", "400L", "500L"]] = Field(None, description="Current academic level")
    skills: Optional[list[str]] = Field(default_factory=list, max_length=20, description="Student skills/interests")


class UserCreate(UserBase):
    """Model for creating a new user"""
    firebaseUid: str = Field(..., min_length=1)


class UserUpdate(BaseModel):
    """Model for updating user profile (static data only)"""
    firstName: Optional[str] = Field(None, min_length=1, max_length=100)
    lastName: Optional[str] = Field(None, min_length=1, max_length=100)
    matricNumber: Optional[str] = Field(None, pattern=r"^\d{2}/\d{2}[A-Z]{2}\d{3}$")
    phone: Optional[str] = Field(None, pattern=r"^\+?[0-9]{10,15}$")
    bio: Optional[str] = Field(None, max_length=500)
    profilePictureUrl: Optional[str] = None
    skills: Optional[list[str]] = Field(None, max_length=20)
    # Note: role, admissionYear, currentLevel require admin privileges to change


class User(UserBase):
    """User response model"""
    id: str = Field(alias="_id")
    firebaseUid: str
    createdAt: datetime
    updatedAt: datetime

    class Config:
        populate_by_name = True
        json_encoders = {ObjectId: str}


class UserInDB(User):
    """Internal user model with additional metadata"""
    lastLogin: Optional[datetime] = None
    isActive: bool = True
