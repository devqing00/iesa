"""
Platform Settings Router

Admin-controlled platform-wide toggles:
  - onlinePaymentEnabled: whether students can use Paystack online payments
"""

from fastapi import APIRouter, Depends, Request, HTTPException
from datetime import datetime, timezone
from pydantic import BaseModel, Field
from app.db import get_database
from app.core.security import get_current_user
from app.core.permissions import require_permission
from app.core.audit import AuditLogger
from app.core.email import get_email_service

router = APIRouter(prefix="/api/v1/settings", tags=["Settings"])

_DEFAULTS = {
    "onlinePaymentEnabled": True,
}


class EmailLimitsUpdatePayload(BaseModel):
    enabled: bool | None = None
    dailyLimitTotal: int | None = Field(default=None, ge=0, le=100000)
    resendLimit: int | None = Field(default=None, ge=0, le=100000)
    smtpLimit: int | None = Field(default=None, ge=0, le=100000)
    sendgridLimit: int | None = Field(default=None, ge=0, le=100000)
    buffer: int | None = Field(default=None, ge=0, le=10000)
    resetToDefaults: bool = False


def _validate_email_limits(candidate: dict) -> None:
    enabled = bool(candidate.get("enabled", True))
    if not enabled:
        return

    total = int(candidate.get("dailyLimitTotal", 0))
    resend = int(candidate.get("resendLimit", 0))
    smtp = int(candidate.get("smtpLimit", 0))
    sendgrid = int(candidate.get("sendgridLimit", 0))
    buffer = int(candidate.get("buffer", 0))

    if total <= 0:
        raise HTTPException(status_code=400, detail="Daily total limit must be greater than 0 when limits are enabled")

    provider_limits = {
        "resend": resend,
        "smtp": smtp,
        "sendgrid": sendgrid,
    }

    for provider, value in provider_limits.items():
        if value > total:
            raise HTTPException(
                status_code=400,
                detail=f"{provider} limit ({value}) cannot be greater than daily total ({total})",
            )

    positive_limits = [value for value in provider_limits.values() if value > 0]
    if positive_limits and buffer >= min(positive_limits):
        raise HTTPException(
            status_code=400,
            detail=f"Buffer ({buffer}) must be smaller than the smallest enabled provider limit ({min(positive_limits)})",
        )


@router.get("/")
async def get_settings(_: dict = Depends(get_current_user)):
    """Return current platform settings. Any authenticated user can read."""
    db = get_database()
    doc = await db.platformSettings.find_one({"_id": "global"})
    if not doc:
        return _DEFAULTS.copy()
    return {k: doc.get(k, v) for k, v in _DEFAULTS.items()}


@router.patch(
    "/",
    dependencies=[Depends(require_permission("admin:manage_settings"))],
)
async def update_settings(
    request: Request,
    onlinePaymentEnabled: bool | None = None,
    current_user: dict = Depends(get_current_user),
):
    """Update platform settings. Requires admin:manage_settings permission."""
    db = get_database()
    updates: dict = {"updatedAt": datetime.now(timezone.utc), "updatedBy": current_user.get("_id")}
    if onlinePaymentEnabled is not None:
        updates["onlinePaymentEnabled"] = onlinePaymentEnabled

    if len(updates) <= 2:  # only timestamps — nothing to change
        doc = await db.platformSettings.find_one({"_id": "global"})
        return {k: (doc or {}).get(k, v) for k, v in _DEFAULTS.items()}

    # Fetch old settings for audit diff
    old_doc = await db.platformSettings.find_one({"_id": "global"})
    old_values = {k: (old_doc or {}).get(k) for k in updates if k not in ("updatedAt", "updatedBy")}

    await db.platformSettings.update_one(
        {"_id": "global"},
        {"$set": updates},
        upsert=True,
    )

    await AuditLogger.log(
        action="settings.updated",
        actor_id=str(current_user.get("_id")),
        actor_email=current_user.get("email", "unknown"),
        resource_type="platform_settings",
        resource_id="global",
        details={"old": old_values, "new": {k: updates[k] for k in old_values}},
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )

    doc = await db.platformSettings.find_one({"_id": "global"})
    return {k: (doc or {}).get(k, v) for k, v in _DEFAULTS.items()}


@router.get(
    "/email-limits",
    dependencies=[Depends(require_permission("system:health"))],
)
async def get_email_limit_settings(current_user: dict = Depends(get_current_user)):
    """Get current email limit config (defaults, overrides, effective)."""
    db = get_database()
    service = get_email_service()

    settings_doc = await db.platformSettings.find_one({"_id": "global"}, {"emailLimits": 1})
    overrides = (settings_doc or {}).get("emailLimits") or {}
    defaults = service.get_default_limit_config()
    effective = await service.get_effective_limit_config()
    quota = await service.get_daily_limit_report()

    return {
        "defaults": defaults,
        "overrides": overrides,
        "effective": effective,
        "quota": quota,
        "recommended": {
            "enabled": True,
            "dailyLimitTotal": 450,
            "resendLimit": 95,
            "smtpLimit": 450,
            "sendgridLimit": 450,
            "buffer": 5,
        },
        "updatedBy": current_user.get("_id"),
    }


@router.patch(
    "/email-limits",
    dependencies=[Depends(require_permission("system:health"))],
)
async def update_email_limit_settings(
    body: EmailLimitsUpdatePayload,
    request: Request,
    current_user: dict = Depends(get_current_user),
):
    """Update or reset email limit settings override used by email service."""
    db = get_database()
    service = get_email_service()

    old_doc = await db.platformSettings.find_one({"_id": "global"}, {"emailLimits": 1})
    old_overrides = (old_doc or {}).get("emailLimits") or {}

    if body.resetToDefaults:
        await db.platformSettings.update_one(
            {"_id": "global"},
            {
                "$unset": {"emailLimits": ""},
                "$set": {
                    "updatedAt": datetime.now(timezone.utc),
                    "updatedBy": current_user.get("_id"),
                },
            },
            upsert=True,
        )
        service.invalidate_limit_cache()

        await AuditLogger.log(
            action="settings.email_limits.reset",
            actor_id=str(current_user.get("_id")),
            actor_email=current_user.get("email", "unknown"),
            resource_type="platform_settings",
            resource_id="email_limits",
            details={"old": old_overrides, "new": {}},
            ip_address=request.client.host if request.client else None,
            user_agent=request.headers.get("user-agent"),
        )

        return await get_email_limit_settings(current_user)

    payload = body.model_dump(exclude_none=True)
    payload.pop("resetToDefaults", None)
    if not payload:
        return await get_email_limit_settings(current_user)

    new_overrides = {
        **old_overrides,
        **payload,
    }

    defaults = service.get_default_limit_config()
    candidate = {
        "enabled": bool(new_overrides.get("enabled", defaults.get("enabled", True))),
        "dailyLimitTotal": int(new_overrides.get("dailyLimitTotal", defaults.get("dailyLimitTotal", 0))),
        "resendLimit": int(new_overrides.get("resendLimit", defaults.get("resendLimit", 0))),
        "smtpLimit": int(new_overrides.get("smtpLimit", defaults.get("smtpLimit", 0))),
        "sendgridLimit": int(new_overrides.get("sendgridLimit", defaults.get("sendgridLimit", 0))),
        "buffer": int(new_overrides.get("buffer", defaults.get("buffer", 0))),
    }
    _validate_email_limits(candidate)

    await db.platformSettings.update_one(
        {"_id": "global"},
        {
            "$set": {
                "emailLimits": new_overrides,
                "updatedAt": datetime.now(timezone.utc),
                "updatedBy": current_user.get("_id"),
            },
        },
        upsert=True,
    )

    service.invalidate_limit_cache()

    await AuditLogger.log(
        action="settings.email_limits.updated",
        actor_id=str(current_user.get("_id")),
        actor_email=current_user.get("email", "unknown"),
        resource_type="platform_settings",
        resource_id="email_limits",
        details={"old": old_overrides, "new": new_overrides},
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )

    return await get_email_limit_settings(current_user)
