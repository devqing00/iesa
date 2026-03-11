"""
IEPOD — IESA Professional Development Hub Models

"Forge the Future Series" – Process Drivers: Your Process, Our Progress.

Collections:
  iepod_societies        – Campus societies (Energy Club, IPTLC, IEEE, etc.)
  iepod_registrations    – Student intake applications / enrolments
  iepod_niche_audits     – Student niche-audit reflective worksheets
  iepod_teams            – Hackathon teams
  iepod_submissions      – Team iteration submissions for "Pitch Your Process"
  iepod_quizzes          – Admin-created quizzes / challenges
  iepod_quiz_responses   – Student quiz answers + scores
  iepod_points           – Gamification points ledger
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import List, Literal, Optional

from pydantic import BaseModel, Field
from bson import ObjectId


# ═══════════════════════════════════════════════════════════════════
# PHASE DEFINITIONS
# ═══════════════════════════════════════════════════════════════════

IepodPhase = Literal[
    "stimulate",   # Phase 1 – Stimulate the Mind
    "carve",       # Phase 2 – Carve Your Niche
    "pitch",       # Phase 3 – Pitch Your Process
]

RegistrationStatus = Literal["pending", "approved", "rejected", "completed"]
TeamStatus = Literal["forming", "active", "submitted", "disqualified"]
SubmissionStatus = Literal["draft", "submitted", "reviewed", "finalist"]
QuizType = Literal["unfractured_focus", "process_breakdown", "general", "live"]
PointAction = Literal[
    "registration",
    "quiz_score",
    "society_checkin",
    "niche_audit",
    "team_formed",
    "submission",
    "process_checkin",
    "mentor_feedback",
    "bonus",
]


# ═══════════════════════════════════════════════════════════════════
# SOCIETIES
# ═══════════════════════════════════════════════════════════════════

class SocietyBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    shortName: str = Field(..., min_length=1, max_length=20, description="E.g. IEEE, RAIN, SFC")
    description: str = Field(..., max_length=2000)
    focusArea: str = Field(..., max_length=200, description="E.g. 'Renewable energy solutions'")
    leadName: Optional[str] = Field(None, max_length=100)
    leadEmail: Optional[str] = None
    color: str = Field(default="lime", description="Theme color token")
    iconUrl: Optional[str] = None
    isActive: bool = Field(default=True)


class SocietyCreate(SocietyBase):
    pass


class SocietyUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    shortName: Optional[str] = Field(None, min_length=1, max_length=20)
    description: Optional[str] = Field(None, max_length=2000)
    focusArea: Optional[str] = Field(None, max_length=200)
    leadName: Optional[str] = Field(None, max_length=100)
    leadEmail: Optional[str] = None
    color: Optional[str] = None
    iconUrl: Optional[str] = None
    isActive: Optional[bool] = None


class Society(SocietyBase):
    id: str = Field(alias="_id")
    memberCount: int = Field(default=0)
    createdAt: datetime
    updatedAt: datetime

    class Config:
        populate_by_name = True
        json_encoders = {ObjectId: str}


# ═══════════════════════════════════════════════════════════════════
# REGISTRATIONS (Student Intake — Weeks 1-3)
# ═══════════════════════════════════════════════════════════════════

class RegistrationBase(BaseModel):
    interests: List[str] = Field(..., min_length=1, max_length=5, description="Initial interest areas")
    whyJoin: str = Field(..., min_length=10, max_length=1000, description="Why do you want to join?")
    priorExperience: Optional[str] = Field(None, max_length=1000)
    preferredSocietyId: Optional[str] = Field(None, description="Initial society preference")


class RegistrationCreate(RegistrationBase):
    pass


class RegistrationUpdate(BaseModel):
    status: Optional[RegistrationStatus] = None
    adminNote: Optional[str] = Field(None, max_length=500)
    phase: Optional[IepodPhase] = None


class Registration(RegistrationBase):
    id: str = Field(alias="_id")
    userId: str
    userName: str
    userEmail: str
    sessionId: str
    level: Optional[str] = Field(None, description="Academic level at time of registration (populated from user profile)")
    department: str = Field(default="Industrial Engineering", description="Student's department at time of registration")
    isExternalStudent: bool = Field(default=False, description="True if student is not from the Industrial Engineering department")
    externalFaculty: Optional[str] = Field(None, max_length=200, description="Faculty name for external students")
    status: RegistrationStatus = Field(default="pending")
    phase: IepodPhase = Field(default="stimulate")
    adminNote: Optional[str] = None
    societyId: Optional[str] = Field(None, description="Confirmed society commitment")
    points: int = Field(default=0)
    completedPhases: List[IepodPhase] = Field(default_factory=list)
    nicheAuditId: Optional[str] = None
    teamId: Optional[str] = None
    createdAt: datetime
    updatedAt: datetime

    class Config:
        populate_by_name = True
        json_encoders = {ObjectId: str}


# ═══════════════════════════════════════════════════════════════════
# NICHE AUDIT TOOL (Phase 2 reflective worksheet)
# ═══════════════════════════════════════════════════════════════════

class NicheAuditBase(BaseModel):
    focusProblem: str = Field(..., min_length=10, max_length=2000,
                              description="What specific problem are you focusing on?")
    targetAudience: str = Field(..., min_length=5, max_length=1000,
                                description="Who is affected by this problem?")
    constraints: str = Field(..., min_length=5, max_length=1000,
                             description="What constraints do you face?")
    proposedApproach: str = Field(..., min_length=10, max_length=2000,
                                  description="How do you plan to prototype a solution?")
    relevantSkills: List[str] = Field(default_factory=list, max_length=10)
    relatedSociety: Optional[str] = Field(None, description="Which society aligns with this niche?")
    inspirations: Optional[str] = Field(None, max_length=1000,
                                        description="Prior art, research, or inspirations")


class NicheAuditCreate(NicheAuditBase):
    pass


class NicheAuditUpdate(BaseModel):
    focusProblem: Optional[str] = Field(None, min_length=10, max_length=2000)
    targetAudience: Optional[str] = Field(None, min_length=5, max_length=1000)
    constraints: Optional[str] = Field(None, min_length=5, max_length=1000)
    proposedApproach: Optional[str] = Field(None, min_length=10, max_length=2000)
    relevantSkills: Optional[List[str]] = None
    relatedSociety: Optional[str] = None
    inspirations: Optional[str] = Field(None, max_length=1000)


class NicheAudit(NicheAuditBase):
    id: str = Field(alias="_id")
    userId: str
    userName: str
    sessionId: str
    submittedAt: datetime
    updatedAt: datetime

    class Config:
        populate_by_name = True
        json_encoders = {ObjectId: str}


# ═══════════════════════════════════════════════════════════════════
# HACKATHON TEAMS (Phase 3)
# ═══════════════════════════════════════════════════════════════════

class TeamMember(BaseModel):
    userId: str
    userName: str
    role: str = Field(default="member", description="E.g. 'lead', 'member'")
    joinedAt: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class TeamBase(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    problemStatement: str = Field(..., min_length=10, max_length=2000)
    maxMembers: int = Field(default=5, ge=2, le=8)


class TeamCreate(TeamBase):
    pass


class TeamUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=100)
    problemStatement: Optional[str] = Field(None, min_length=10, max_length=2000)
    maxMembers: Optional[int] = Field(None, ge=2, le=8)
    status: Optional[TeamStatus] = None


class Team(TeamBase):
    id: str = Field(alias="_id")
    leaderId: str
    leaderName: str
    sessionId: str
    members: List[TeamMember] = Field(default_factory=list)
    status: TeamStatus = Field(default="forming")
    submissionCount: int = Field(default=0)
    mentorId: Optional[str] = None
    mentorName: Optional[str] = None
    createdAt: datetime
    updatedAt: datetime

    class Config:
        populate_by_name = True
        json_encoders = {ObjectId: str}


# ═══════════════════════════════════════════════════════════════════
# HACKATHON SUBMISSIONS (Iterative — "Pitch Your Process")
# ═══════════════════════════════════════════════════════════════════

class SubmissionBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    description: str = Field(..., min_length=10, max_length=5000,
                             description="Describe your iteration / progress")
    processLog: str = Field(..., min_length=10, max_length=5000,
                            description="Document the HOW — what process you followed")
    attachmentUrls: List[str] = Field(default_factory=list, max_length=5)
    iterationNumber: int = Field(default=1, ge=1)


class SubmissionCreate(SubmissionBase):
    pass


class SubmissionReview(BaseModel):
    status: SubmissionStatus
    feedback: Optional[str] = Field(None, max_length=2000)
    score: Optional[int] = Field(None, ge=0, le=100)


class Submission(SubmissionBase):
    id: str = Field(alias="_id")
    teamId: str
    teamName: str
    sessionId: str
    status: SubmissionStatus = Field(default="draft")
    feedback: Optional[str] = None
    score: Optional[int] = None
    reviewedBy: Optional[str] = None
    submittedAt: datetime
    updatedAt: datetime

    class Config:
        populate_by_name = True
        json_encoders = {ObjectId: str}


# ═══════════════════════════════════════════════════════════════════
# QUIZZES & CHALLENGES (Gamification)
# ═══════════════════════════════════════════════════════════════════

class QuizQuestion(BaseModel):
    question: str = Field(..., max_length=1000)
    options: List[str] = Field(..., min_length=2, max_length=6)
    correctIndex: int = Field(..., ge=0)
    explanation: Optional[str] = Field(None, max_length=500)
    points: int = Field(default=10, ge=1, le=100)


class QuizBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = Field(None, max_length=1000)
    quizType: QuizType = Field(default="general")
    questions: List[QuizQuestion] = Field(..., min_length=1, max_length=50)
    timeLimitMinutes: Optional[int] = Field(None, ge=1, le=120)
    isLive: bool = Field(default=False, description="Whether this quiz is currently live / active")
    phase: Optional[IepodPhase] = Field(None, description="Which phase this quiz belongs to")


class QuizCreate(QuizBase):
    pass


class QuizUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = Field(None, max_length=1000)
    isLive: Optional[bool] = None
    timeLimitMinutes: Optional[int] = Field(None, ge=1, le=120)


class Quiz(QuizBase):
    id: str = Field(alias="_id")
    sessionId: str
    createdBy: str
    participantCount: int = Field(default=0)
    createdAt: datetime
    updatedAt: datetime

    class Config:
        populate_by_name = True
        json_encoders = {ObjectId: str}


class QuizPublic(BaseModel):
    """Quiz without correct answers — for students taking the quiz"""
    id: str
    title: str
    description: Optional[str] = None
    quizType: QuizType
    timeLimitMinutes: Optional[int] = None
    phase: Optional[IepodPhase] = None
    questionCount: int
    isLive: bool
    createdAt: datetime


class QuizQuestionPublic(BaseModel):
    """Question without the correct answer exposed"""
    index: int
    question: str
    options: List[str]
    points: int


# ═══════════════════════════════════════════════════════════════════
# QUIZ RESPONSES
# ═══════════════════════════════════════════════════════════════════

class QuizAnswer(BaseModel):
    questionIndex: int
    selectedOption: int


class QuizResponseCreate(BaseModel):
    answers: List[QuizAnswer]


class QuizResponse(BaseModel):
    id: str = Field(alias="_id")
    quizId: str
    userId: str
    userName: str
    answers: List[QuizAnswer]
    score: int = Field(default=0)
    maxScore: int = Field(default=0)
    percentage: float = Field(default=0.0)
    timeTakenSeconds: Optional[int] = None
    submittedAt: datetime

    class Config:
        populate_by_name = True
        json_encoders = {ObjectId: str}


# ═══════════════════════════════════════════════════════════════════
# POINTS / LEADERBOARD
# ═══════════════════════════════════════════════════════════════════

class PointEntry(BaseModel):
    id: str = Field(alias="_id")
    userId: str
    userName: str
    sessionId: str
    action: PointAction
    points: int
    description: str = Field(default="")
    referenceId: Optional[str] = None
    awardedAt: datetime

    class Config:
        populate_by_name = True
        json_encoders = {ObjectId: str}


class PointAward(BaseModel):
    """Admin awards bonus points"""
    userId: str
    points: int = Field(..., ge=1, le=500)
    description: str = Field(..., min_length=1, max_length=200)


class LeaderboardEntry(BaseModel):
    userId: str
    userName: str
    totalPoints: int
    rank: int
    phase: Optional[IepodPhase] = None
    societyName: Optional[str] = None
