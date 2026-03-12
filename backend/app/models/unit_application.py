"""
Unit Application Model — BACKWARD COMPATIBILITY SHIM

This module re-exports everything from team_application.py.
All new code should import from app.models.team_application directly.
"""

# Re-export everything from the new module
from app.models.team_application import (  # noqa: F401
    ApplicationStatus,
    TEAM_REGISTRY,
    TEAM_LABELS,
    TEAM_ROLE_MAP,
    HEAD_POSITION_TO_TEAM,
    TEAM_TO_HEAD_POSITION,
    GLOBAL_REVIEW_POSITIONS,
    LEGACY_SLUG_MAP,
    # Backward-compat aliases
    UNIT_LABELS,
    UNIT_ROLE_MAP,
    HEAD_POSITION_TO_UNIT,
    UNIT_TO_HEAD_POSITION,
    # Schemas (new names)
    TeamApplicationCreate,
    TeamApplicationReview,
    TeamSettingsUpdate,
    TeamApplicationResponse,
    # Schemas (old names)
    UnitApplicationCreate,
    UnitApplicationReview,
    UnitSettingsUpdate as UnitSettingsUpdate,
    UnitApplicationResponse,
)
