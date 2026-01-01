"""
Academic Session Models

Sessions represent academic years (e.g., "2024/2025").
This is the core of the time-travel feature.
"""

from pydantic import BaseModel, Field
from typing import Literal
from datetime import datetime
from bson import ObjectId


class SessionBase(BaseModel):
    name: str = Field(..., pattern=r"^\d{4}/\d{4}$", description="Format: YYYY/YYYY (e.g., 2024/2025)")
    startDate: datetime
    endDate: datetime
    currentSemester: Literal[1, 2] = Field(default=1, description="Current semester (1 or 2)")
    isActive: bool = Field(default=False, description="Only one session can be active at a time")


class SessionCreate(SessionBase):
    """Model for creating a new academic session"""
    pass


class SessionUpdate(BaseModel):
    """Model for updating session details"""
    currentSemester: Optional[Literal[1, 2]] = None
    isActive: Optional[bool] = None
    endDate: Optional[datetime] = None


class Session(SessionBase):
    """Session response model"""
    id: str = Field(alias="_id")
    createdAt: datetime
    updatedAt: datetime

    class Config:
        populate_by_name = True
        json_encoders = {ObjectId: str}


class SessionSummary(BaseModel):
    """Lightweight session model for dropdowns"""
    id: str
    name: str
    isActive: bool
    currentSemester: int
