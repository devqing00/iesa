"""WebSocket origin validation helpers."""

from __future__ import annotations

import os
import re


def _get_allowed_origins() -> list[str]:
    env = os.getenv("ENVIRONMENT", "development")

    raw_ws = os.getenv("WS_ALLOWED_ORIGINS", "")
    raw_http = os.getenv("ALLOWED_ORIGINS", "")

    configured = [o.strip().rstrip("/") for o in [*raw_ws.split(","), *raw_http.split(",")] if o.strip()]

    if env == "production":
        defaults = [
            "https://iesa-seven.vercel.app",
            "https://www.iesaui.org",
            "https://iesaui.org",
            "https://iesa-ui-zzyme.ondigitalocean.app",
        ]
    else:
        defaults = [
            "http://localhost:3000",
            "http://127.0.0.1:3000",
        ]

    merged: list[str] = []
    for origin in [*configured, *defaults]:
        if origin not in merged:
            merged.append(origin)
    return merged


def is_ws_origin_allowed(origin: str | None) -> bool:
    """
    Validate browser Origin for WebSocket handshakes.

    Returns True when:
    - Origin is absent (non-browser clients), or
    - Origin is explicitly configured/allowed, or
    - In production, origin matches trusted wildcard patterns.
    """
    if not origin:
        return True

    normalized = origin.strip().rstrip("/")
    if normalized in _get_allowed_origins():
        return True

    env = os.getenv("ENVIRONMENT", "development")
    if env != "production":
        return False

    return bool(
        re.match(r"^https://([a-z0-9-]+\.)*iesaui\.org$", normalized)
        or re.match(r"^https://[a-z0-9-]+\.ondigitalocean\.app$", normalized)
        or re.match(r"^https://[a-z0-9-]+\.vercel\.app$", normalized)
    )
