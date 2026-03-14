"""
Web Push Notifications Router

Manages push subscriptions (VAPID-based Web Push API) and delivers
browser push notifications alongside the existing in-app notification
system.

Env vars:
    VAPID_PUBLIC_KEY   – Base64url-encoded VAPID public key
    VAPID_PRIVATE_KEY  – Base64url-encoded VAPID private key
    VAPID_CLAIMS_EMAIL – mailto: contact for the push service (e.g. mailto:admin@iesa.org)

If VAPID keys are not set, push is gracefully disabled — no errors.
"""

import asyncio
import base64
import logging
import os
from datetime import datetime, timezone

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.core.security import get_current_user
from app.core.permissions import require_permission
from app.db import get_database

logger = logging.getLogger("push_notifications")

router = APIRouter(prefix="/api/v1/push", tags=["push-notifications"])

# ── VAPID config (lazy-loaded) ─────────────────────────────────
_VAPID_PUBLIC_KEY: str | None = None
_VAPID_PRIVATE_KEY: str | None = None
_VAPID_CLAIMS: dict | None = None
_VAPID_PRIVATE_SOURCE: str | None = None
_vapid_loaded = False


def _strip_wrapping_quotes(value: str) -> str:
    """Remove accidental surrounding single/double quotes from env values."""
    v = (value or "").strip()
    if len(v) >= 2 and ((v[0] == '"' and v[-1] == '"') or (v[0] == "'" and v[-1] == "'")):
        return v[1:-1].strip()
    return v


def _b64_decode_loose(value: str) -> bytes:
    """Decode base64/base64url with relaxed padding and whitespace handling."""
    compact = "".join(value.split())
    padded = compact + ("=" * ((4 - (len(compact) % 4)) % 4))
    try:
        return base64.b64decode(padded)
    except Exception:
        return base64.urlsafe_b64decode(padded)


def _is_valid_subscription(sub_doc: dict) -> bool:
    """Validate presence and basic decodability of web-push subscription keys."""
    endpoint = (sub_doc.get("endpoint") or "").strip()
    if not endpoint.startswith("http"):
        return False

    keys = sub_doc.get("keys") or {}
    p256dh = keys.get("p256dh")
    auth = keys.get("auth")
    if not p256dh or not auth:
        return False
    try:
        p256dh_bytes = _b64_decode_loose(str(p256dh))
        auth_bytes = _b64_decode_loose(str(auth))

        # WebPush p256dh is expected to be an uncompressed P-256 public key:
        # 65 bytes total and starts with 0x04.
        if len(p256dh_bytes) != 65 or p256dh_bytes[0] != 0x04:
            return False

        # WebPush auth secret is expected to be 16 bytes.
        if len(auth_bytes) != 16:
            return False

        # Validate p256dh is an actual P-256 EC public key point.
        from cryptography.hazmat.primitives.asymmetric import ec
        ec.EllipticCurvePublicKey.from_encoded_point(ec.SECP256R1(), p256dh_bytes)

        return True
    except Exception:
        return False


def _normalize_private_key_to_pem(raw_private: str) -> tuple[str | None, str | None]:
    """Normalize different VAPID private key representations into canonical PKCS8 PEM."""
    if not raw_private:
        return None, None

    value = _strip_wrapping_quotes(raw_private)

    from cryptography.hazmat.primitives import serialization
    from cryptography.hazmat.primitives.asymmetric import ec
    from cryptography.hazmat.primitives.serialization import load_der_private_key, load_pem_private_key

    def _to_pem(key_obj) -> str:
        return key_obj.private_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PrivateFormat.PKCS8,
            encryption_algorithm=serialization.NoEncryption(),
        ).decode("utf-8")

    # 1) Raw PEM
    if "BEGIN" in value and "PRIVATE KEY" in value:
        key_obj = load_pem_private_key(value.encode("utf-8"), password=None)
        return _to_pem(key_obj), "pem-direct"

    # 2) Base64/base64url encoded payload
    decoded = _b64_decode_loose(value)
    try:
        decoded_text = decoded.decode("utf-8")
    except Exception:
        decoded_text = ""

    # 2a) Base64(Pem)
    if "BEGIN" in decoded_text and "PRIVATE KEY" in decoded_text:
        key_obj = load_pem_private_key(decoded_text.encode("utf-8"), password=None)
        return _to_pem(key_obj), "pem-base64"

    # 2b) Base64(DER)
    try:
        key_obj = load_der_private_key(decoded, password=None)
        return _to_pem(key_obj), "der-base64-to-pem"
    except Exception:
        pass

    # 2c) Raw 32-byte private scalar encoded as base64/base64url
    if len(decoded) == 32:
        private_value = int.from_bytes(decoded, byteorder="big")
        if private_value <= 0:
            return None, None
        key_obj = ec.derive_private_key(private_value, ec.SECP256R1())
        return _to_pem(key_obj), "raw32-base64-to-pem"

    return None, None


def _is_valid_vapid_public_key(public_key: str | None) -> bool:
    """Validate VAPID public key shape and curve point."""
    if not public_key:
        return False
    try:
        pub = _b64_decode_loose(_strip_wrapping_quotes(public_key))
        if len(pub) != 65 or pub[0] != 0x04:
            return False
        from cryptography.hazmat.primitives.asymmetric import ec
        ec.EllipticCurvePublicKey.from_encoded_point(ec.SECP256R1(), pub)
        return True
    except Exception:
        return False


def _load_vapid():
    global _VAPID_PUBLIC_KEY, _VAPID_PRIVATE_KEY, _VAPID_CLAIMS, _VAPID_PRIVATE_SOURCE, _vapid_loaded
    if _vapid_loaded:
        return
    _vapid_loaded = True
    _VAPID_PUBLIC_KEY = (os.getenv("VAPID_PUBLIC_KEY") or "").strip().replace("\n", "").replace("\r", "") or None
    _VAPID_PUBLIC_KEY = _strip_wrapping_quotes(_VAPID_PUBLIC_KEY) if _VAPID_PUBLIC_KEY else None
    raw_private = os.getenv("VAPID_PRIVATE_KEY")
    claims_email = os.getenv("VAPID_CLAIMS_EMAIL", "mailto:admin@iesa.org")

    # Accept either:
    # 1) raw PEM (-----BEGIN PRIVATE KEY----- ...)
    # 2) base64-encoded PEM (single-line safe for env)
    # 3) raw VAPID private key string (base64url) for pywebpush
    if raw_private:
        try:
            normalized_private, source = _normalize_private_key_to_pem(raw_private)
            _VAPID_PRIVATE_KEY = normalized_private
            _VAPID_PRIVATE_SOURCE = source
        except Exception:
            _VAPID_PRIVATE_KEY = None
            _VAPID_PRIVATE_SOURCE = "invalid"

    # Ensure public key shape is valid before enabling push.
    if _VAPID_PUBLIC_KEY and not _is_valid_vapid_public_key(_VAPID_PUBLIC_KEY):
        logger.error("Invalid VAPID public key format detected; push disabled")
        _VAPID_PUBLIC_KEY = None

    if _VAPID_PUBLIC_KEY and _VAPID_PRIVATE_KEY:
        _VAPID_CLAIMS = {"sub": claims_email}
        logger.info(
            "VAPID keys loaded — push notifications enabled (private_source=%s public_len=%s)",
            _VAPID_PRIVATE_SOURCE,
            len(_VAPID_PUBLIC_KEY or ""),
        )
    else:
        logger.warning("VAPID keys not set/invalid — push notifications disabled")


def is_push_enabled() -> bool:
    _load_vapid()
    return bool(_VAPID_PUBLIC_KEY and _VAPID_PRIVATE_KEY)


# ── Pydantic models ───────────────────────────────────────────

class PushSubscription(BaseModel):
    endpoint: str
    keys: dict  # {p256dh: str, auth: str}


class PushSubscriptionOut(BaseModel):
    id: str
    endpoint: str
    createdAt: str


class PushTestByEmailRequest(BaseModel):
    email: str
    title: str = "IESA Push Test"
    body: str = "This is a test push notification from IESA admin tools."
    url: str = "/dashboard/announcements"
    tag: str = "push-test"


# ── Endpoints ─────────────────────────────────────────────────

@router.get("/vapid-public-key")
async def get_vapid_public_key():
    """Return the VAPID public key so the frontend can subscribe."""
    _load_vapid()
    if not _VAPID_PUBLIC_KEY:
        raise HTTPException(status_code=503, detail="Push notifications are not configured")
    return {"publicKey": _VAPID_PUBLIC_KEY}


@router.get("/vapid-status")
async def get_vapid_status(
    _: dict = Depends(require_permission("announcement:create")),
):
    """Admin-only diagnostics for VAPID parsing (no secret values returned)."""
    _load_vapid()
    return {
        "enabled": bool(_VAPID_PUBLIC_KEY and _VAPID_PRIVATE_KEY),
        "public_key_length": len(_VAPID_PUBLIC_KEY or ""),
        "private_key_present": bool(_VAPID_PRIVATE_KEY),
        "private_key_source": _VAPID_PRIVATE_SOURCE,
        "claims": _VAPID_CLAIMS,
    }


@router.post("/subscribe")
async def subscribe(
    sub: PushSubscription,
    user: dict = Depends(get_current_user),
):
    """Store a push subscription for the current user."""
    db = get_database()
    user_id = str(user["_id"])

    candidate = {
        "endpoint": sub.endpoint,
        "keys": sub.keys,
    }
    if not _is_valid_subscription(candidate):
        raise HTTPException(status_code=400, detail="Invalid push subscription payload")

    # Upsert by endpoint to avoid duplicates
    await db["push_subscriptions"].update_one(
        {"userId": user_id, "endpoint": sub.endpoint},
        {
            "$set": {
                "userId": user_id,
                "endpoint": sub.endpoint,
                "keys": sub.keys,
                "updatedAt": datetime.now(timezone.utc),
            },
            "$setOnInsert": {
                "createdAt": datetime.now(timezone.utc),
            },
        },
        upsert=True,
    )
    return {"message": "Subscribed to push notifications"}


@router.delete("/unsubscribe")
async def unsubscribe(
    sub: PushSubscription,
    user: dict = Depends(get_current_user),
):
    """Remove a push subscription."""
    db = get_database()
    user_id = str(user["_id"])
    await db["push_subscriptions"].delete_one(
        {"userId": user_id, "endpoint": sub.endpoint},
    )
    return {"message": "Unsubscribed from push notifications"}


@router.get("/subscriptions")
async def list_subscriptions(
    user: dict = Depends(get_current_user),
):
    """List active push subscriptions for the current user."""
    db = get_database()
    user_id = str(user["_id"])
    cursor = db["push_subscriptions"].find(
        {"userId": user_id},
        {"keys": 0},  # Don't expose crypto keys
    ).sort("createdAt", -1)
    subs: list[dict] = []
    async for doc in cursor:
        subs.append({
            "id": str(doc["_id"]),
            "endpoint": doc["endpoint"],
            "createdAt": doc.get("createdAt", ""),
        })
    return subs


@router.post("/test/send-by-email")
async def send_push_test_by_email(
    payload: PushTestByEmailRequest,
    _: dict = Depends(require_permission("announcement:create")),
):
    """Admin utility: send a test push notification to a user resolved by email."""
    db = get_database()

    email = payload.email.strip().lower()
    if not email:
        raise HTTPException(status_code=400, detail="Email is required")

    user = await db["users"].find_one({"email": email}, {"_id": 1, "email": 1})
    if not user:
        raise HTTPException(status_code=404, detail=f"No user found for email: {email}")

    user_id = str(user["_id"])
    sub_count = await db["push_subscriptions"].count_documents({"userId": user_id})

    if sub_count == 0:
        return {
            "message": "User has no active push subscriptions",
            "email": email,
            "userId": user_id,
            "subscriptions": 0,
        }

    await send_push_to_user(
        user_id=user_id,
        title=payload.title,
        body=payload.body,
        url=payload.url,
        tag=payload.tag,
    )

    return {
        "message": "Push test dispatched",
        "email": email,
        "userId": user_id,
        "subscriptions": sub_count,
    }


# ── Push sending helper (called from notifications.py) ────────

async def send_push_to_user(
    user_id: str,
    title: str,
    body: str,
    url: str | None = None,
    tag: str | None = None,
):
    """
    Send a Web Push notification to all subscriptions for a user.
    Called as fire-and-forget from create_notification.
    Silently removes expired/invalid subscriptions.
    """
    if not is_push_enabled():
        return

    db = get_database()
    cursor = db["push_subscriptions"].find({"userId": user_id})
    subs = await cursor.to_list(None)
    if not subs:
        return

    # Lazy-import pywebpush to avoid startup cost
    try:
        from pywebpush import webpush, WebPushException
    except ImportError:
        logger.warning("pywebpush not installed — skipping push")
        return

    import json

    payload = json.dumps({
        "title": title,
        "body": body,
        "url": url or "/dashboard",
        "tag": tag or "iesa-notification",
        "icon": "/assets/images/iesa-logo.png",
    })

    stale_ids: list[ObjectId] = []

    for sub_doc in subs:
        if not _is_valid_subscription(sub_doc):
            stale_ids.append(sub_doc["_id"])
            logger.warning("Push subscription dropped (invalid keys) for userId=%s", user_id)
            continue

        subscription_info = {
            "endpoint": sub_doc["endpoint"],
            "keys": sub_doc["keys"],
        }
        try:
            # pywebpush is a sync library — run in executor
            loop = asyncio.get_event_loop()
            await loop.run_in_executor(
                None,
                lambda si=subscription_info: webpush(
                    subscription_info=si,
                    data=payload,
                    vapid_private_key=_VAPID_PRIVATE_KEY,
                    vapid_claims=_VAPID_CLAIMS,
                ),
            )
        except WebPushException as e:
            # 410 Gone or 404 → subscription expired
            if hasattr(e, "response") and e.response is not None:
                status = getattr(e.response, "status_code", 0)
                if status in (404, 410):
                    stale_ids.append(sub_doc["_id"])
            logger.warning(f"Push failed for {sub_doc['endpoint'][:60]}…: {e}")
        except Exception as e:
            if "Could not deserialize key data" in str(e):
                stale_ids.append(sub_doc["_id"])
            logger.warning(f"Push error: {e}")

    # Clean up stale subscriptions
    if stale_ids:
        await db["push_subscriptions"].delete_many({"_id": {"$in": stale_ids}})


async def send_push_to_users(
    user_ids: list[str],
    title: str,
    body: str,
    url: str | None = None,
    tag: str | None = None,
):
    """Bulk push to multiple users. Fires concurrently."""
    if not is_push_enabled() or not user_ids:
        return
    tasks = [send_push_to_user(uid, title, body, url, tag) for uid in user_ids]
    await asyncio.gather(*tasks, return_exceptions=True)
