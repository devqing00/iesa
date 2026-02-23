"""
Unit Application Model

Students apply to join IESA units/committees.
Unit heads or super admins review (accept/reject) with optional feedback.
"""

from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from enum import Enum


class ApplicationStatus(str, Enum):
    pending = "pending"
    accepted = "accepted"
    rejected = "rejected"


class UnitType(str, Enum):
    press = "press"
    committee_academic = "committee_academic"
    committee_welfare = "committee_welfare"
    committee_sports = "committee_sports"
    committee_socials = "committee_socials"


UNIT_LABELS = {
    "press": "IESA Press",
    "committee_academic": "Academic Committee",
    "committee_welfare": "Welfare Committee",
    "committee_sports": "Sports Committee",
    "committee_socials": "Socials Committee",
}


class UnitApplicationCreate(BaseModel):
    unit: UnitType
    motivation: str = Field(..., min_length=20, max_length=1000)
    skills: Optional[str] = Field(None, max_length=500)


class UnitApplicationReview(BaseModel):
    status: ApplicationStatus = Field(..., description="accepted or rejected")
    feedback: Optional[str] = Field(None, max_length=500)


class UnitApplicationResponse(BaseModel):
    id: str
    userId: str
    userName: str
    userEmail: str
    userLevel: Optional[str] = None
    unit: str
    unitLabel: str
    motivation: str
    skills: Optional[str] = None
    status: str
    feedback: Optional[str] = None
    reviewedBy: Optional[str] = None
    reviewerName: Optional[str] = None
    sessionId: str
    createdAt: datetime
    reviewedAt: Optional[datetime] = None
