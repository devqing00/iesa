"""
Rate Limiting Middleware

Protects endpoints from abuse, brute force attacks, and DDoS.
Supports both in-memory (development) and Redis (production) storage.
"""

from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from fastapi import Request
import os
import logging

logger = logging.getLogger("iesa_backend")

# Get rate limit configuration from environment
DEFAULT_RATE_LIMIT = os.getenv("RATE_LIMIT_DEFAULT", "100/minute")
AUTH_RATE_LIMIT = os.getenv("RATE_LIMIT_AUTH", "5/minute")
PAYMENT_RATE_LIMIT = os.getenv("RATE_LIMIT_PAYMENT", "10/minute")


def get_identifier(request: Request) -> str:
    """
    Get unique identifier for rate limiting.
    
    Priority:
    1. Firebase UID (from auth token) - most accurate
    2. IP address - fallback for unauthenticated requests
    """
    # Try to get user from auth state (if already authenticated)
    if hasattr(request.state, "user") and request.state.user:
        return f"user:{request.state.user.get('uid', 'unknown')}"
    
    # Fallback to IP address
    return f"ip:{get_remote_address(request)}"


def get_storage_uri() -> str:
    """
    Get storage URI for rate limiting.
    
    Automatically uses Redis in production if REDIS_URL is set,
    falls back to in-memory storage for development.
    """
    redis_url = os.getenv("REDIS_URL")
    
    if redis_url:
        # Try to import redis to check if it's available
        try:
            import redis
            logger.info(f"✅ Using Redis for rate limiting: {redis_url}")
            return redis_url
        except ImportError:
            logger.warning("⚠️  REDIS_URL is set but 'redis' package not installed. Install with: pip install redis")
            logger.warning("⚠️  Falling back to in-memory rate limiting.")
            return "memory://"
    else:
        logger.warning("⚠️  Using in-memory rate limiting. For production, set REDIS_URL environment variable.")
        return "memory://"


# Initialize limiter with auto-detected storage and error handling
def create_limiter():
    """Create limiter with graceful fallback if Redis fails."""
    try:
        return Limiter(
            key_func=get_identifier,
            default_limits=[DEFAULT_RATE_LIMIT],
            storage_uri=get_storage_uri(),
            strategy="fixed-window"
        )
    except Exception as e:
        logger.error(f"❌ Failed to initialize rate limiter with configured storage: {e}")
        logger.warning("⚠️  Falling back to in-memory rate limiting.")
        return Limiter(
            key_func=get_identifier,
            default_limits=[DEFAULT_RATE_LIMIT],
            storage_uri="memory://",
            strategy="fixed-window"
        )

limiter = create_limiter()


# Rate limit presets for common use cases
RATE_LIMITS = {
    "default": DEFAULT_RATE_LIMIT,
    "auth": AUTH_RATE_LIMIT,  # Stricter for login/register
    "payment": PAYMENT_RATE_LIMIT,  # Moderate for payments
    "upload": "5/minute",  # File uploads
    "ai": "20/hour",  # AI assistant queries
}


def setup_rate_limiting(app):
    """
    Configure rate limiting for the FastAPI application.
    
    Usage:
        setup_rate_limiting(app)
    """
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
    
    return limiter
