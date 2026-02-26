"""
Academic Session Models

Sessions represent academic years (e.g., "2024/2025").
This is the core of the time-travel feature.
"""

from pydantic import BaseModel, Field, ConfigDict, model_validator
from typing import Literal, Optional
from datetime import datetime, timezone
from bson import ObjectId


class SessionBase(BaseModel):
    name: str = Field(..., pattern=r"^\d{4}/\d{4}$", description="Format: YYYY/YYYY (e.g., 2024/2025)")
    semester1StartDate: datetime = Field(..., description="First semester start date")
    semester1EndDate: datetime = Field(..., description="First semester end date")
    semester2StartDate: datetime = Field(..., description="Second semester start date")
    semester2EndDate: datetime = Field(..., description="Second semester end date")
    isActive: bool = Field(default=False, description="Only one session can be active at a time")

    @model_validator(mode="after")
    def check_dates(self) -> "SessionBase":
        if self.semester1StartDate >= self.semester1EndDate:
            raise ValueError("semester1EndDate must be after semester1StartDate")
        if self.semester2StartDate >= self.semester2EndDate:
            raise ValueError("semester2EndDate must be after semester2StartDate")
        if self.semester1EndDate > self.semester2StartDate:
            raise ValueError("semester2StartDate must be on or after semester1EndDate")
        return self


class SessionCreate(SessionBase):
    """Model for creating a new academic session"""
    pass


class SessionUpdate(BaseModel):
    """Model for updating session details"""
    name: Optional[str] = Field(None, pattern=r"^\d{4}/\d{4}$")
    semester1StartDate: Optional[datetime] = None
    semester1EndDate: Optional[datetime] = None
    semester2StartDate: Optional[datetime] = None
    semester2EndDate: Optional[datetime] = None
    isActive: Optional[bool] = None

    @model_validator(mode="after")
    def check_dates(self) -> "SessionUpdate":
        if self.semester1StartDate and self.semester1EndDate:
            if self.semester1StartDate >= self.semester1EndDate:
                raise ValueError("semester1EndDate must be after semester1StartDate")
        if self.semester2StartDate and self.semester2EndDate:
            if self.semester2StartDate >= self.semester2EndDate:
                raise ValueError("semester2EndDate must be after semester2StartDate")
        return self


class Session(SessionBase):
    """Session response model"""
    id: str = Field(alias="_id")
    # Explicit fields for serialization (properties don't auto-serialize)
    startDate: Optional[datetime] = None
    endDate: Optional[datetime] = None
    currentSemester: Optional[int] = None
    createdAt: datetime
    updatedAt: datetime

    model_config = ConfigDict(
        populate_by_name=True,
        from_attributes=True,
    )
    
    @model_validator(mode="after")
    def compute_derived(self) -> "Session":
        """Compute startDate, endDate, currentSemester from semester dates"""
        self.startDate = self.semester1StartDate
        self.endDate = self.semester2EndDate
        now = datetime.now(timezone.utc)
        if now < self.semester2StartDate:
            self.currentSemester = 1
        else:
            self.currentSemester = 2
        return self


class SessionSummary(BaseModel):
    """Lightweight session model for list views and dropdowns"""
    id: str
    name: str
    isActive: bool
    currentSemester: int
    # Derived overall range (semester1Start → semester2End)
    startDate: Optional[datetime] = None
    endDate: Optional[datetime] = None
    # Individual semester boundaries (needed by the edit modal)
    semester1StartDate: Optional[datetime] = None
    semester1EndDate: Optional[datetime] = None
    semester2StartDate: Optional[datetime] = None
    semester2EndDate: Optional[datetime] = None
