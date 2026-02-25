"""
Redis Cache Layer

Async Redis cache with graceful fallback: when Redis is unavailable the
helpers simply return cache-misses so the caller always hits the DB instead.

Usage:
    from app.core.cache import cache_get, cache_set, cache_delete

    data = await cache_get("admin_stats")
    if data is None:
        data = await expensive_query()
        await cache_set("admin_stats", data, ttl=60)

    # Invalidate:
    await cache_delete("admin_stats")
"""

from __future__ import annotations

import json
import logging
import os
from typing import Any

logger = logging.getLogger("iesa_backend")

_redis_client = None
_redis_checked = False


async def _get_redis():
    """Lazy-init an async Redis client. Returns None when unavailable."""
    global _redis_client, _redis_checked

    if _redis_checked:
        return _redis_client

    _redis_checked = True
    redis_url = os.getenv("REDIS_URL")
    if not redis_url:
        logger.info("ℹ️  Cache: no REDIS_URL — cache disabled.")
        return None

    try:
        import redis.asyncio as aioredis  # type: ignore[import-untyped]

        client = aioredis.from_url(
            redis_url,
            decode_responses=True,
            socket_connect_timeout=2,
            socket_timeout=2,
        )
        await client.ping()
        _redis_client = client
        logger.info("✅ Cache: connected to Redis.")
        return _redis_client
    except Exception as exc:
        logger.warning(f"⚠️  Cache: Redis unavailable ({exc}). Cache disabled.")
        return None


# ── public API ───────────────────────────────────────────────────

CACHE_PREFIX = "iesa:"


async def cache_get(key: str) -> Any | None:
    """Fetch a cached value. Returns ``None`` on miss or Redis failure."""
    r = await _get_redis()
    if r is None:
        return None
    try:
        raw = await r.get(f"{CACHE_PREFIX}{key}")
        if raw is None:
            return None
        return json.loads(raw)
    except Exception:
        return None


async def cache_set(key: str, value: Any, ttl: int = 60) -> None:
    """Store *value* (JSON-serialisable) with a TTL in seconds."""
    r = await _get_redis()
    if r is None:
        return
    try:
        await r.set(f"{CACHE_PREFIX}{key}", json.dumps(value, default=str), ex=ttl)
    except Exception:
        pass


async def cache_delete(key: str) -> None:
    """Evict a single cache key."""
    r = await _get_redis()
    if r is None:
        return
    try:
        await r.delete(f"{CACHE_PREFIX}{key}")
    except Exception:
        pass


async def cache_delete_pattern(pattern: str) -> None:
    """Evict all keys matching a glob pattern (e.g. ``admin_stats*``)."""
    r = await _get_redis()
    if r is None:
        return
    try:
        full = f"{CACHE_PREFIX}{pattern}"
        async for k in r.scan_iter(match=full, count=100):
            await r.delete(k)
    except Exception:
        pass
