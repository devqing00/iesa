"""TIMP — The IESA Mentoring Project models."""

from datetime import datetime
from typing import Optional, List
from enum import Enum

from pydantic import BaseModel, Field


# ── Enums ──────────────────────────────────────────────────────────

class MentorApplicationStatus(str, Enum):
    pending = "pending"
    approved = "approved"
    rejected = "rejected"


class PairStatus(str, Enum):
    active = "active"
    paused = "paused"
    completed = "completed"


# ── Mentor Application ────────────────────────────────────────────

class MentorApplicationCreate(BaseModel):
    """Student applies to volunteer as a mentor."""
    motivation: str = Field(..., min_length=20, max_length=1000)
    skills: str = Field(..., min_length=5, max_length=500, description="Areas the student can mentor in")
    availability: str = Field(..., min_length=5, max_length=300, description="e.g. 'Weekdays after 4pm, weekends'")
    maxMentees: int = Field(default=2, ge=1, le=5)


class MentorApplicationReview(BaseModel):
    """TIMP lead reviews a mentor application."""
    status: MentorApplicationStatus
    feedback: Optional[str] = Field(None, max_length=500)


class MentorApplicationResponse(BaseModel):
    """Full mentor application response."""
    id: str
    userId: str
    userName: str
    userLevel: Optional[int] = None
    motivation: str
    skills: str
    availability: str
    maxMentees: int
    status: MentorApplicationStatus
    feedback: Optional[str] = None
    sessionId: str
    reviewedBy: Optional[str] = None
    createdAt: datetime
    updatedAt: Optional[datetime] = None


# ── Mentorship Pair ───────────────────────────────────────────────

class CreatePairRequest(BaseModel):
    """TIMP lead creates a mentor-mentee pair."""
    mentorId: str
    menteeId: str


class PairResponse(BaseModel):
    """A mentorship pair."""
    id: str
    mentorId: str
    mentorName: str
    menteeId: str
    menteeName: str
    status: PairStatus
    sessionId: str
    feedbackCount: int = 0
    createdAt: datetime
    updatedAt: Optional[datetime] = None


# ── Weekly Feedback ───────────────────────────────────────────────

class FeedbackCreate(BaseModel):
    """Weekly feedback submitted by mentor or mentee."""
    rating: int = Field(..., ge=1, le=5, description="1=Poor, 5=Excellent")
    notes: str = Field(..., min_length=10, max_length=1000)
    concerns: Optional[str] = Field(None, max_length=500)
    topicsCovered: Optional[List[str]] = Field(None, max_length=10)


class FeedbackResponse(BaseModel):
    """A feedback entry."""
    id: str
    pairId: str
    submittedBy: str
    submitterName: str
    submitterRole: str  # "mentor" or "mentee"
    rating: int
    notes: str
    concerns: Optional[str] = None
    topicsCovered: Optional[List[str]] = None
    weekNumber: int
    createdAt: datetime
