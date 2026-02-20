"""
Academic Session Models

Sessions represent academic years (e.g., "2024/2025").
This is the core of the time-travel feature.
"""

from pydantic import BaseModel, Field, ConfigDict, model_validator
from typing import Literal, Optional
from datetime import datetime
from bson import ObjectId


class SessionBase(BaseModel):
    name: str = Field(..., pattern=r"^\d{4}/\d{4}$", description="Format: YYYY/YYYY (e.g., 2024/2025)")
    startDate: datetime
    endDate: datetime
    currentSemester: Literal[1, 2] = Field(default=1, description="Current semester (1 or 2)")
    isActive: bool = Field(default=False, description="Only one session can be active at a time")

    @model_validator(mode="after")
    def check_dates(self) -> "SessionBase":
        if self.startDate >= self.endDate:
            raise ValueError("endDate must be after startDate")
        return self


class SessionCreate(SessionBase):
    """Model for creating a new academic session"""
    pass


class SessionUpdate(BaseModel):
    """Model for updating session details"""
    name: Optional[str] = Field(None, pattern=r"^\d{4}/\d{4}$")
    startDate: Optional[datetime] = None
    endDate: Optional[datetime] = None
    currentSemester: Optional[Literal[1, 2]] = None
    isActive: Optional[bool] = None

    @model_validator(mode="after")
    def check_dates(self) -> "SessionUpdate":
        if self.startDate and self.endDate and self.startDate >= self.endDate:
            raise ValueError("endDate must be after startDate")
        return self


class Session(SessionBase):
    """Session response model"""
    id: str = Field(alias="_id")
    createdAt: datetime
    updatedAt: datetime

    model_config = ConfigDict(
        populate_by_name=True,
        from_attributes=True,
    )


class SessionSummary(BaseModel):
    """Lightweight session model for dropdowns"""
    id: str
    name: str
    isActive: bool
    currentSemester: int
