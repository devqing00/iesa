"""
Realtime Notifications Router (WebSocket)

Provides a WebSocket channel for realtime notification events.
Other routers publish events via the ``publish`` helper.

Note:
This in-memory fan-out works per-process only. In multi-worker deployments,
replace local connection state with Redis Pub/Sub or another broker.
"""

from __future__ import annotations

import asyncio
import logging
import time
from typing import Any

from fastapi import APIRouter, Query, HTTPException, status, WebSocket, WebSocketDisconnect

from app.core.security import verify_firebase_id_token_raw
from app.core.ws_security import is_ws_origin_allowed
from app.db import get_database
from bson import ObjectId

logger = logging.getLogger("iesa_backend")

router = APIRouter(prefix="/api/v1/sse", tags=["Realtime Notifications"])
HEARTBEAT_INTERVAL_SECONDS = 20.0


def _heartbeat_payload() -> dict:
    """Lightweight keep-alive payload for WebSocket clients/proxies."""
    return {"type": "heartbeat", "timestamp": time.time()}


async def _get_user_from_query_token(token: str = Query(..., description="JWT access token")) -> dict:
    """Token auth helper for realtime WebSocket connections."""
    try:
        payload = await verify_firebase_id_token_raw(token)
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

class _RealtimeManager:
    def __init__(self):
        self.connections: dict[str, dict[str, Any]] = {}

    async def connect(self, sub_id: str, ws: WebSocket, *, user_id: str, role: str, is_external: bool) -> None:
        await ws.accept(headers=[(b"X-Accel-Buffering", b"no")])
        self.connections[sub_id] = {
            "ws": ws,
            "user_id": user_id,
            "role": role,
            "is_external": is_external,
        }

    def disconnect(self, sub_id: str) -> None:
        self.connections.pop(sub_id, None)

    async def broadcast(self, msg: dict[str, Any]) -> None:
        dead: list[str] = []
        target_role = msg.get("targetRole")
        ipe_only = bool(msg.get("ipeOnly"))
        target_user_id = msg.get("targetUserId")

        for sub_id, conn in list(self.connections.items()):
            if target_role and target_role != conn.get("role"):
                continue
            if ipe_only and conn.get("is_external"):
                continue
            if target_user_id and target_user_id != conn.get("user_id"):
                continue

            try:
                await conn["ws"].send_json({
                    "type": msg.get("type", "message"),
                    "data": msg.get("data", {}),
                    "timestamp": msg.get("timestamp", time.time()),
                })
            except Exception:
                dead.append(sub_id)

        for sub_id in dead:
            self.disconnect(sub_id)


_manager = _RealtimeManager()


async def _broadcast_async(msg: dict[str, Any]) -> None:
    await _manager.broadcast(msg)


def publish(
    event_type: str,
    data: Any,
    *,
    target_role: str | None = None,
    ipe_only: bool = False,
    target_user_id: str | None = None,
) -> None:
    """
    Send an event to connected realtime WebSocket clients.

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
    msg: dict[str, Any] = {
        "type": event_type,
        "data": data,
        "timestamp": time.time(),
        "targetRole": target_role,
        "ipeOnly": ipe_only,
        "targetUserId": target_user_id,
    }
    try:
        loop = asyncio.get_running_loop()
        loop.create_task(_broadcast_async(msg))
    except RuntimeError:
        logger.warning("Realtime publish skipped: no running event loop for event '%s'", event_type)


@router.get("/stream")
async def sse_stream_deprecated():
    raise HTTPException(
        status_code=status.HTTP_410_GONE,
        detail="SSE endpoint deprecated. Use WebSocket endpoint at /api/v1/sse/ws?token=...",
    )


@router.websocket("/ws")
async def ws_stream(ws: WebSocket, token: str = Query("", description="JWT access token")):
    """Open realtime notification stream over WebSocket."""
    origin = ws.headers.get("origin")
    if not is_ws_origin_allowed(origin):
        await ws.close(code=1008, reason="Origin not allowed")
        return

    if not token:
        await ws.close(code=4001, reason="Token required")
        return

    try:
        current_user = await _get_user_from_query_token(token)
    except HTTPException as exc:
        await ws.close(code=4003, reason=exc.detail)
        return

    user_id = current_user["_id"]
    user_role = current_user.get("role", "student")
    user_dept = current_user.get("department", "Industrial Engineering")
    is_external = (user_role == "student" and user_dept != "Industrial Engineering")
    sub_id = f"{user_id}_{id(ws)}"

    await _manager.connect(
        sub_id,
        ws,
        user_id=user_id,
        role=user_role,
        is_external=is_external,
    )

    try:
        while True:
            try:
                payload = await asyncio.wait_for(ws.receive_json(), timeout=HEARTBEAT_INTERVAL_SECONDS)
                if payload.get("type") == "ping":
                    await ws.send_json({"type": "pong", "timestamp": time.time()})
            except asyncio.TimeoutError:
                await ws.send_json(_heartbeat_payload())
            except ValueError:
                # Ignore malformed non-JSON frames and keep connection alive
                continue
    except WebSocketDisconnect:
        pass
    except Exception:
        logger.warning("Realtime WS connection closed unexpectedly for user %s", user_id, exc_info=True)
    finally:
        _manager.disconnect(sub_id)
