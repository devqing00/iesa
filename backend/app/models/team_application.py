"""
Team Application Model

Students apply to join IESA teams.
Team heads or super admins review (accept/reject) with optional feedback.

MongoDB notes (backward compatibility):
  - Collection: ``unit_applications`` — field ``unit`` stores the team slug.
  - Collection: ``custom_units`` — stores admin-created team definitions.
  - Collection: ``unit_settings`` — stores per-team open/close + capacity settings.
  No data migration is needed; only code-level naming has changed.
"""

from pydantic import BaseModel, Field
from typing import Optional, Any, Literal
from datetime import datetime
from enum import Enum


class ApplicationStatus(str, Enum):
    pending = "pending"
    accepted = "accepted"
    rejected = "rejected"
    revoked = "revoked"


# ── Team Registry ──────────────────────────────────────────────────
# Built-in teams and their configuration.
# Custom teams created by admins are stored in the ``custom_units`` collection.

TEAM_REGISTRY: dict[str, dict] = {
    "ics": {
        "label": "IESA Creative Studio",
        "description": "Bring ideas to life — design graphics, create videos, and craft the visual identity of IESA.",
        "colorKey": "coral",
        "headPosition": "ics_head",
        "memberPosition": "ics_member",
        "memberPermissions": ["announcement:view", "event:view"],
        "requiresSkills": True,
        "subTeams": None,
        "customQuestions": None,
        "isHub": False,
    },
    "academic": {
        "label": "Academic Team",
        "description": "Drive academic excellence — coordinate tutorials, past questions, study resources, and timetable support.",
        "colorKey": "sunny",
        "headPosition": "academic_lead",
        "memberPosition": "committee_academic_member",
        "memberPermissions": ["announcement:view", "event:view", "resource:view"],
        "requiresSkills": False,
        "subTeams": None,
        "customQuestions": None,
        "isHub": False,
    },
    "industrial_visit": {
        "label": "Industrial Visit Team",
        "description": "Plan and coordinate industrial visits to companies and factories for practical learning.",
        "colorKey": "teal",
        "headPosition": "team_head_industrial_visit",
        "memberPosition": "team_industrial_visit_member",
        "memberPermissions": ["announcement:view", "event:view"],
        "requiresSkills": False,
        "subTeams": None,
        "customQuestions": None,
        "isHub": False,
    },
    "conference": {
        "label": "Conference Team",
        "description": "Organize the departmental conference — manage speakers, ushering, registration, and programmes.",
        "colorKey": "lavender",
        "headPosition": "team_head_conference",
        "memberPosition": "team_conference_member",
        "memberPermissions": ["announcement:view", "event:view"],
        "requiresSkills": False,
        "subTeams": ["Ushering", "Registration", "Speakers & Guests Relations", "Programs"],
        "customQuestions": None,
        "isHub": False,
    },
    "logistics": {
        "label": "Logistics Team",
        "description": "Handle event logistics — venue setup, equipment, transportation, and coordination.",
        "colorKey": "sunny",
        "headPosition": "team_head_logistics",
        "memberPosition": "team_logistics_member",
        "memberPermissions": ["announcement:view", "event:view"],
        "requiresSkills": False,
        "subTeams": None,
        "customQuestions": None,
        "isHub": False,
    },
    "welfare": {
        "label": "Welfare Team",
        "description": "Champion student wellbeing — address welfare concerns and support fellow students.",
        "colorKey": "coral",
        "headPosition": "team_head_welfare",
        "memberPosition": "team_welfare_member",
        "memberPermissions": ["announcement:view"],
        "requiresSkills": False,
        "subTeams": None,
        "customQuestions": None,
        "isHub": False,
    },
    "alumni_relations": {
        "label": "Alumni & External Relations Team",
        "description": "Build bridges with alumni and external stakeholders — networking, partnerships, and outreach.",
        "colorKey": "teal",
        "headPosition": "team_head_alumni_relations",
        "memberPosition": "team_alumni_relations_member",
        "memberPermissions": ["announcement:view", "event:view"],
        "requiresSkills": False,
        "subTeams": None,
        "customQuestions": None,
        "isHub": False,
    },
    "dinner_award": {
        "label": "Dinner and Award Team",
        "description": "Plan and execute the annual dinner and awards ceremony — decorations, awards, and entertainment.",
        "colorKey": "lavender",
        "headPosition": "team_head_dinner_award",
        "memberPosition": "team_dinner_award_member",
        "memberPermissions": ["announcement:view", "event:view"],
        "requiresSkills": False,
        "subTeams": None,
        "customQuestions": None,
        "isHub": False,
    },
    "publicity_content_creation": {
        "label": "Publicity and Content Creation",
        "description": "Drive visibility for IESA activities through social media campaigns, storytelling, and strategic content production.",
        "colorKey": "coral",
        "headPosition": "team_head_publicity_content_creation",
        "memberPosition": "team_publicity_content_creation_member",
        "memberPermissions": ["announcement:view", "event:view"],
        "requiresSkills": True,
        "subTeams": ["Social Media", "Graphics", "Copywriting", "Video Content"],
        "customQuestions": None,
        "isHub": False,
    },
    "press": {
        "label": "The IESA Press",
        "description": "Join the editorial team — write articles, cover events, and shape the narrative of our department.",
        "colorKey": "lavender",
        "headPosition": "press_editor_in_chief",
        "memberPosition": "press_member",
        "memberPermissions": ["press:access", "press:create"],
        "requiresSkills": True,
        "subTeams": None,
        "customQuestions": None,
        "isHub": True,
        "hubPath": "/dashboard/hubs",
    },
}


# ── Derived lookup tables ────────────────────────────────────────

TEAM_LABELS: dict[str, str] = {slug: t["label"] for slug, t in TEAM_REGISTRY.items()}

TEAM_ROLE_MAP: dict[str, dict] = {
    slug: {
        "position": t["memberPosition"],
        "permissions": t["memberPermissions"],
    }
    for slug, t in TEAM_REGISTRY.items()
}

HEAD_POSITION_TO_TEAM: dict[str, str] = {
    t["headPosition"]: slug for slug, t in TEAM_REGISTRY.items()
}

TEAM_TO_HEAD_POSITION: dict[str, str] = {
    slug: t["headPosition"] for slug, t in TEAM_REGISTRY.items()
}

# Positions with global review access (can review ANY team)
GLOBAL_REVIEW_POSITIONS = frozenset({
    "super_admin", "president", "vice_president", "general_secretary",
})


# ── Legacy compatibility aliases ─────────────────────────────────
# Old code may import these names from unit_application.py which re-exports them.
UNIT_LABELS = TEAM_LABELS
UNIT_ROLE_MAP = TEAM_ROLE_MAP
HEAD_POSITION_TO_UNIT = HEAD_POSITION_TO_TEAM
UNIT_TO_HEAD_POSITION = TEAM_TO_HEAD_POSITION

# Old unit slugs that may still exist in MongoDB documents.
# Mapping of old slug → new slug (or None if removed entirely).
LEGACY_SLUG_MAP: dict[str, str | None] = {
    "committee_academic": None,
    "committee_welfare": "welfare",
    "committee_sports": None,
    "committee_socials": None,
}


# ── Pydantic schemas ────────────────────────────────────────────

class TeamApplicationCreate(BaseModel):
    team: str = Field(..., min_length=1, max_length=100, description="Team slug")
    motivation: str = Field(..., min_length=20, max_length=1000)
    skills: Optional[str] = Field(None, max_length=500)
    subTeam: Optional[str] = Field(None, max_length=100, description="Selected sub-team (for teams that require it)")
    customAnswers: Optional[dict[str, Any]] = Field(None, description="Answers to team-specific custom questions")


class TeamApplicationReview(BaseModel):
    status: ApplicationStatus = Field(..., description="accepted or rejected")
    feedback: Optional[str] = Field(None, max_length=500)
    rejectionTag: Optional[Literal["warning", "take_note", "other"]] = Field(
        None,
        description="Optional rejection tag shown to applicants",
    )


class TeamSettingsUpdate(BaseModel):
    maxMembers: Optional[int] = Field(None, ge=0, le=500, description="0 = unlimited")
    isOpen: Optional[bool] = Field(None, description="Whether the team accepts new applications")


class TeamApplicationResponse(BaseModel):
    id: str
    userId: str
    userName: str
    userEmail: str
    userLevel: Optional[str] = None
    userGender: Optional[Literal["male", "female"]] = None
    team: str
    teamLabel: str
    motivation: str
    skills: Optional[str] = None
    subTeam: Optional[str] = None
    customAnswers: Optional[dict[str, Any]] = None
    status: str
    feedback: Optional[str] = None
    rejectionTag: Optional[Literal["warning", "take_note", "other"]] = None
    reviewedBy: Optional[str] = None
    reviewerName: Optional[str] = None
    sessionId: str
    createdAt: datetime
    reviewedAt: Optional[datetime] = None


# ── Backward-compat aliases for old schema names ────────────────
# These allow a gradual transition — remove once all old imports are updated.
UnitApplicationCreate = TeamApplicationCreate
UnitApplicationReview = TeamApplicationReview
UnitSettingsUpdate = TeamSettingsUpdate
UnitApplicationResponse = TeamApplicationResponse
