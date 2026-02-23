"""
Platform Settings Router

Admin-controlled platform-wide toggles:
  - onlinePaymentEnabled: whether students can use Paystack online payments
"""

from fastapi import APIRouter, Depends
from datetime import datetime
from app.db import get_database
from app.core.security import get_current_user
from app.core.permissions import require_permission

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
    onlinePaymentEnabled: bool | None = None,
    current_user: dict = Depends(get_current_user),
):
    """Update platform settings. Requires admin:manage_settings permission."""
    db = get_database()
    updates: dict = {"updatedAt": datetime.utcnow(), "updatedBy": current_user.get("_id")}
    if onlinePaymentEnabled is not None:
        updates["onlinePaymentEnabled"] = onlinePaymentEnabled

    if len(updates) <= 2:  # only timestamps — nothing to change
        doc = await db.platformSettings.find_one({"_id": "global"})
        return {k: (doc or {}).get(k, v) for k, v in _DEFAULTS.items()}

    await db.platformSettings.update_one(
        {"_id": "global"},
        {"$set": updates},
        upsert=True,
    )
    doc = await db.platformSettings.find_one({"_id": "global"})
    return {k: doc.get(k, v) for k, v in _DEFAULTS.items()}
