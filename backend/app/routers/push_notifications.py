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
from app.db import get_database

logger = logging.getLogger("push_notifications")

router = APIRouter(prefix="/api/v1/push", tags=["push-notifications"])

# ── VAPID config (lazy-loaded) ─────────────────────────────────
_VAPID_PUBLIC_KEY: str | None = None
_VAPID_PRIVATE_KEY: str | None = None
_VAPID_CLAIMS: dict | None = None
_vapid_loaded = False


def _load_vapid():
    global _VAPID_PUBLIC_KEY, _VAPID_PRIVATE_KEY, _VAPID_CLAIMS, _vapid_loaded
    if _vapid_loaded:
        return
    _vapid_loaded = True
    _VAPID_PUBLIC_KEY = (os.getenv("VAPID_PUBLIC_KEY") or "").strip().replace("\n", "").replace("\r", "") or None
    raw_private = os.getenv("VAPID_PRIVATE_KEY")
    claims_email = os.getenv("VAPID_CLAIMS_EMAIL", "mailto:admin@iesa.org")
    # The private key is stored as base64-encoded PEM in .env (single-line safe)
    if raw_private:
        try:
            _VAPID_PRIVATE_KEY = base64.b64decode(raw_private).decode("utf-8")
        except Exception:
            _VAPID_PRIVATE_KEY = raw_private  # fallback: use as-is (plain PEM)
    if _VAPID_PUBLIC_KEY and _VAPID_PRIVATE_KEY:
        _VAPID_CLAIMS = {"sub": claims_email}
        logger.info("VAPID keys loaded — push notifications enabled")
    else:
        logger.warning("VAPID keys not set — push notifications disabled")


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


# ── Endpoints ─────────────────────────────────────────────────

@router.get("/vapid-public-key")
async def get_vapid_public_key():
    """Return the VAPID public key so the frontend can subscribe."""
    _load_vapid()
    if not _VAPID_PUBLIC_KEY:
        raise HTTPException(status_code=503, detail="Push notifications are not configured")
    return {"publicKey": _VAPID_PUBLIC_KEY}


@router.post("/subscribe")
async def subscribe(
    sub: PushSubscription,
    user: dict = Depends(get_current_user),
):
    """Store a push subscription for the current user."""
    db = get_database()
    user_id = str(user["_id"])

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
            logger.debug(f"Push failed for {sub_doc['endpoint'][:60]}…: {e}")
        except Exception as e:
            logger.debug(f"Push error: {e}")

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
