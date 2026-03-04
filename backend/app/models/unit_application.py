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
    revoked = "revoked"


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

# ── Centralised role mappings ────────────────────────────────────

# Maps unit type → the role position + permissions granted on acceptance
UNIT_ROLE_MAP = {
    "press": {
        "position": "press_member",
        "permissions": ["press:access", "press:create"],
    },
    "committee_academic": {
        "position": "committee_academic_member",
        "permissions": ["announcement:view", "event:view"],
    },
    "committee_welfare": {
        "position": "committee_welfare_member",
        "permissions": ["announcement:view"],
    },
    "committee_sports": {
        "position": "committee_sports_member",
        "permissions": ["announcement:view", "event:view"],
    },
    "committee_socials": {
        "position": "committee_socials_member",
        "permissions": ["announcement:view", "event:view"],
    },
}

# Maps committee head position → the unit type they manage
HEAD_POSITION_TO_UNIT: dict[str, str] = {
    "committee_head_academic": "committee_academic",
    "committee_head_welfare": "committee_welfare",
    "committee_head_sports": "committee_sports",
    "committee_head_social": "committee_socials",
    "press_head": "press",
}

# Reverse map: unit type → its head position
UNIT_TO_HEAD_POSITION: dict[str, str] = {v: k for k, v in HEAD_POSITION_TO_UNIT.items()}

# Positions with global review access (can review ANY unit)
GLOBAL_REVIEW_POSITIONS = frozenset({
    "super_admin", "president", "vice_president", "general_secretary",
})


# ── Pydantic schemas ────────────────────────────────────────────

class UnitApplicationCreate(BaseModel):
    unit: UnitType
    motivation: str = Field(..., min_length=20, max_length=1000)
    skills: Optional[str] = Field(None, max_length=500)


class UnitApplicationReview(BaseModel):
    status: ApplicationStatus = Field(..., description="accepted or rejected")
    feedback: Optional[str] = Field(None, max_length=500)


class UnitSettingsUpdate(BaseModel):
    maxMembers: Optional[int] = Field(None, ge=0, le=500, description="0 = unlimited")
    isOpen: Optional[bool] = Field(None, description="Whether the unit accepts new applications")


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
