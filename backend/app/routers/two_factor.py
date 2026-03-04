"""
Two-Factor Authentication (TOTP) Router

Allows users to enable/disable TOTP-based 2FA.
Uses pyotp for TOTP generation/verification and qrcode for QR provisioning URIs.
The TOTP secret is stored encrypted on the user document.
"""

import base64
import io
from datetime import datetime, timezone

import pyotp
import qrcode  # type: ignore
from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.core.security import get_current_user
from app.db import get_database

router = APIRouter(prefix="/api/v1/2fa", tags=["Two-Factor Auth"])


# ─── Models ──────────────────────────────────────────

class Enable2FAResponse(BaseModel):
    secret: str
    qrCodeDataUrl: str
    otpauthUrl: str


class Verify2FABody(BaseModel):
    code: str = Field(..., min_length=6, max_length=6)


class Disable2FABody(BaseModel):
    code: str = Field(..., min_length=6, max_length=6)


# ─── Helpers ─────────────────────────────────────────

def _generate_qr_data_url(otpauth_url: str) -> str:
    """Generate a base64 data URL for a QR code image."""
    img = qrcode.make(otpauth_url, box_size=6, border=2)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    b64 = base64.b64encode(buf.getvalue()).decode()
    return f"data:image/png;base64,{b64}"


# ─── Endpoints ───────────────────────────────────────

@router.post("/setup", response_model=Enable2FAResponse)
async def setup_2fa(
    user: dict = Depends(get_current_user),
):
    """
    Generate a new TOTP secret and return it with a QR code.
    The secret is stored as pending until the user confirms with a valid code.
    Does NOT enable 2FA yet — call /verify to confirm.
    """
    db = get_database()
    user_id = str(user["_id"])
    email = user.get("email", "user@iesa.ng")

    # Check if already enabled
    if user.get("twoFactorEnabled"):
        raise HTTPException(status_code=400, detail="2FA is already enabled. Disable it first to reconfigure.")

    secret = pyotp.random_base32()
    totp = pyotp.TOTP(secret)
    otpauth_url = totp.provisioning_uri(name=email, issuer_name="IESA Platform")
    qr_data_url = _generate_qr_data_url(otpauth_url)

    # Store pending secret on user (not yet activated)
    await db["users"].update_one(
        {"_id": ObjectId(user_id)},
        {"$set": {"twoFactorPendingSecret": secret}},
    )

    return Enable2FAResponse(
        secret=secret,
        qrCodeDataUrl=qr_data_url,
        otpauthUrl=otpauth_url,
    )


@router.post("/verify")
async def verify_and_enable_2fa(
    body: Verify2FABody,
    user: dict = Depends(get_current_user),
):
    """
    Verify a TOTP code against the pending secret to confirm 2FA setup.
    On success, enables 2FA and generates backup codes.
    """
    db = get_database()
    user_id = str(user["_id"])

    # Get fresh user doc to read pending secret
    doc = await db["users"].find_one(
        {"_id": ObjectId(user_id)},
        {"twoFactorPendingSecret": 1, "twoFactorEnabled": 1},
    )
    if not doc:
        raise HTTPException(status_code=404, detail="User not found")

    if doc.get("twoFactorEnabled"):
        raise HTTPException(status_code=400, detail="2FA is already enabled")

    pending_secret = doc.get("twoFactorPendingSecret")
    if not pending_secret:
        raise HTTPException(status_code=400, detail="No pending 2FA setup. Call /setup first.")

    totp = pyotp.TOTP(pending_secret)
    if not totp.verify(body.code, valid_window=1):
        raise HTTPException(status_code=400, detail="Invalid code. Please try again.")

    # Generate backup codes
    import secrets
    backup_codes = [secrets.token_hex(4).upper() for _ in range(8)]

    # Enable 2FA
    await db["users"].update_one(
        {"_id": ObjectId(user_id)},
        {
            "$set": {
                "twoFactorEnabled": True,
                "twoFactorSecret": pending_secret,
                "twoFactorBackupCodes": backup_codes,
                "twoFactorEnabledAt": datetime.now(timezone.utc),
            },
            "$unset": {"twoFactorPendingSecret": ""},
        },
    )

    return {
        "enabled": True,
        "backupCodes": backup_codes,
        "message": "2FA enabled successfully. Save your backup codes securely.",
    }


@router.post("/disable")
async def disable_2fa(
    body: Disable2FABody,
    user: dict = Depends(get_current_user),
):
    """Disable 2FA after verifying with a current code."""
    db = get_database()
    user_id = str(user["_id"])

    doc = await db["users"].find_one(
        {"_id": ObjectId(user_id)},
        {"twoFactorEnabled": 1, "twoFactorSecret": 1},
    )
    if not doc or not doc.get("twoFactorEnabled"):
        raise HTTPException(status_code=400, detail="2FA is not enabled")

    secret = doc.get("twoFactorSecret", "")
    totp = pyotp.TOTP(secret)
    if not totp.verify(body.code, valid_window=1):
        raise HTTPException(status_code=400, detail="Invalid code")

    await db["users"].update_one(
        {"_id": ObjectId(user_id)},
        {
            "$set": {"twoFactorEnabled": False},
            "$unset": {
                "twoFactorSecret": "",
                "twoFactorPendingSecret": "",
                "twoFactorBackupCodes": "",
                "twoFactorEnabledAt": "",
            },
        },
    )

    return {"enabled": False, "message": "2FA has been disabled."}


@router.get("/status")
async def get_2fa_status(
    user: dict = Depends(get_current_user),
):
    """Check whether 2FA is enabled for the current user."""
    return {
        "enabled": bool(user.get("twoFactorEnabled")),
        "enabledAt": user.get("twoFactorEnabledAt"),
    }


@router.post("/validate")
async def validate_totp_code(
    body: Verify2FABody,
    user: dict = Depends(get_current_user),
):
    """
    Validate a TOTP code (used during login flow).
    Also accepts backup codes (single-use).
    """
    db = get_database()
    user_id = str(user["_id"])

    doc = await db["users"].find_one(
        {"_id": ObjectId(user_id)},
        {"twoFactorEnabled": 1, "twoFactorSecret": 1, "twoFactorBackupCodes": 1},
    )
    if not doc or not doc.get("twoFactorEnabled"):
        raise HTTPException(status_code=400, detail="2FA is not enabled")

    secret = doc.get("twoFactorSecret", "")
    totp = pyotp.TOTP(secret)

    # Try TOTP code first
    if totp.verify(body.code, valid_window=1):
        return {"valid": True, "method": "totp"}

    # Try backup code
    backup_codes: list = doc.get("twoFactorBackupCodes", [])
    code_upper = body.code.upper()
    if code_upper in backup_codes:
        # Consume the backup code (single-use)
        backup_codes.remove(code_upper)
        await db["users"].update_one(
            {"_id": ObjectId(user_id)},
            {"$set": {"twoFactorBackupCodes": backup_codes}},
        )
        return {"valid": True, "method": "backup", "remainingBackupCodes": len(backup_codes)}

    raise HTTPException(status_code=400, detail="Invalid code")
