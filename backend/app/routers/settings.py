"""
Platform Settings Router

Admin-controlled platform-wide toggles:
  - onlinePaymentEnabled: whether students can use Paystack online payments
"""

from fastapi import APIRouter, Depends, Request
from datetime import datetime, timezone
from app.db import get_database
from app.core.security import get_current_user
from app.core.permissions import require_permission
from app.core.audit import AuditLogger

router = APIRouter(prefix="/api/v1/settings", tags=["Settings"])

_DEFAULTS = {
    "onlinePaymentEnabled": True,
}


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
    return {k: doc.get(k, v) for k, v in _DEFAULTS.items()}
