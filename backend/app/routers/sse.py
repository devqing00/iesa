"""
Server-Sent Events (SSE) Router

Streams real-time notifications to authenticated clients.
The frontend opens a persistent EventSource connection and the backend
pushes events such as new announcements, payment reminders, event updates,
etc., as they happen.

Other backend routers can publish events through the ``publish`` helper.

**Limitation:** The in-process fan-out via ``asyncio.Queue`` only works within
a single Uvicorn worker process. If the app is deployed behind multiple workers
(e.g. ``--workers 4``), events published on one worker will NOT reach clients
connected to other workers. For multi-worker deployments, replace the in-memory
``_subscribers`` dict with Redis Pub/Sub or similar message broker.
"""

from __future__ import annotations

import asyncio
import json
import logging
import time
from typing import Any

from fastapi import APIRouter, Depends, Query, Request, HTTPException, status
from fastapi.responses import StreamingResponse

from app.core.auth import decode_access_token
from app.db import get_database
from bson import ObjectId

logger = logging.getLogger("iesa_backend")

router = APIRouter(prefix="/api/v1/sse", tags=["SSE Notifications"])


async def _get_user_from_query_token(token: str = Query(..., description="JWT access token")) -> dict:
    """
    SSE-specific auth dependency.  EventSource cannot set headers, so the
    JWT is passed as a ``?token=...`` query parameter instead.
    """
    try:
        payload = decode_access_token(token)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid token: {exc}",
        )

    user_id = payload.get("sub")
    if not user_id or not ObjectId.is_valid(user_id):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Bad token")

    db = get_database()
    user = await db["users"].find_one({"_id": ObjectId(user_id)})
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    user["_id"] = str(user["_id"])
    return user

# ── In-process fan-out ───────────────────────────────────────────
# Each connected client registers an asyncio.Queue here.
# ``publish()`` writes to every queue so every client gets the event.
# This works within a single process.  For multi-process deployments
# swap this for a Redis PubSub fan-out (see the cache module).

_subscribers: dict[str, asyncio.Queue] = {}


def publish(event_type: str, data: Any, *, target_role: str | None = None, ipe_only: bool = False) -> None:
    """
    Send an event to all connected SSE clients.

    Parameters
    ----------
    event_type : str
        Event name, e.g. ``"announcement_created"``, ``"payment_reminder"``.
    data : Any
        JSON-serialisable payload.
    target_role : str | None
        If set, only clients whose ``role`` matches will see the event.
    ipe_only : bool
        If True, only IPE (Industrial Engineering) students will see the event.
        Admins and excos still receive it regardless.
    """
    msg = {
        "type": event_type,
        "data": data,
        "timestamp": time.time(),
        "targetRole": target_role,
        "ipeOnly": ipe_only,
    }
    dead: list[str] = []
    for sub_id, q in _subscribers.items():
        try:
            q.put_nowait(msg)
        except asyncio.QueueFull:
            dead.append(sub_id)
    # Clean up lagging clients
    for sub_id in dead:
        _subscribers.pop(sub_id, None)


# ── SSE endpoint ─────────────────────────────────────────────────

@router.get("/stream")
async def sse_stream(
    request: Request,
    current_user: dict = Depends(_get_user_from_query_token),
):
    """
    Open an SSE stream.  The client receives JSON event payloads:

        event: announcement_created
        data: {"id":"...", "title":"New Announcement"}

    A heartbeat comment is sent every 30 s to keep proxies alive.
    """
    user_id = current_user["_id"]
    user_role = current_user.get("role", "student")
    user_dept = current_user.get("department", "Industrial Engineering")
    is_external = (user_role == "student" and user_dept != "Industrial Engineering")
    sub_id = f"{user_id}_{id(request)}"

    queue: asyncio.Queue = asyncio.Queue(maxsize=256)
    _subscribers[sub_id] = queue

    async def _event_generator():
        try:
            while True:
                # Check disconnect
                if await request.is_disconnected():
                    break

                try:
                    msg = await asyncio.wait_for(queue.get(), timeout=30.0)
                except asyncio.TimeoutError:
                    # Send heartbeat comment to keep connection alive
                    yield ": heartbeat\n\n"
                    continue

                # Role-based filtering
                target = msg.get("targetRole")
                if target and target != user_role:
                    continue

                # Department-based filtering: hide IPE-only events from external students
                if msg.get("ipeOnly") and is_external:
                    continue

                event_type = msg.get("type", "message")
                payload = json.dumps(msg.get("data", {}), default=str)
                yield f"event: {event_type}\ndata: {payload}\n\n"
        except asyncio.CancelledError:
            pass
        finally:
            _subscribers.pop(sub_id, None)

    return StreamingResponse(
        _event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",  # Nginx: don't buffer SSE
        },
    )
