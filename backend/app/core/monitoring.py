"""
Performance Monitoring with Sentry

Tracks errors, performance metrics, and user interactions.
Provides real-time alerts for production issues.
"""

import os
import logging
from typing import Optional

logger = logging.getLogger("iesa_backend")


def init_sentry(app):
    """
    Initialize Sentry APM for error tracking and performance monitoring.
    
    Set SENTRY_DSN environment variable to enable.
    """
    sentry_dsn = os.getenv("SENTRY_DSN")
    
    if not sentry_dsn:
        logger.warning("⚠️  Sentry not configured. Set SENTRY_DSN to enable error tracking.")
        return
    
    try:
        import sentry_sdk
        from sentry_sdk.integrations.fastapi import FastApiIntegration
        from sentry_sdk.integrations.starlette import StarletteIntegration
        from sentry_sdk.integrations.pymongo import PyMongoIntegration
        
        environment = os.getenv("ENVIRONMENT", "development")
        release = os.getenv("RELEASE_VERSION", "unknown")
        
        sentry_sdk.init(
            dsn=sentry_dsn,
            environment=environment,
            release=release,
            
            # Performance monitoring
            traces_sample_rate=float(os.getenv("SENTRY_TRACES_SAMPLE_RATE", "0.1")),  # 10% of transactions
            profiles_sample_rate=float(os.getenv("SENTRY_PROFILES_SAMPLE_RATE", "0.1")),  # 10% profiling
            
            # Integrations
            integrations=[
                FastApiIntegration(transaction_style="endpoint"),
                StarletteIntegration(transaction_style="endpoint"),
                PyMongoIntegration(),
            ],
            
            # Error filtering
            before_send=before_send_filter,
            
            # Additional options
            attach_stacktrace=True,
            send_default_pii=False,  # Don't send PII for privacy
            max_breadcrumbs=50,
        )
        
        logger.info(f"✅ Sentry initialized (env: {environment}, release: {release})")
        
    except ImportError:
        logger.error("❌ Sentry SDK not installed. Run: pip install sentry-sdk")
    except Exception as e:
        logger.error(f"❌ Failed to initialize Sentry: {str(e)}")


def before_send_filter(event, hint):
    """
    Filter events before sending to Sentry.
    
    Use this to:
    - Remove sensitive data
    - Ignore certain errors
    - Add custom tags
    """
    
    # Ignore expected errors
    if "exc_info" in hint:
        exc_type, exc_value, tb = hint["exc_info"]
        
        # Ignore 404s
        if "404" in str(exc_value):
            return None
        
        # Ignore validation errors (these are user errors, not bugs)
        if "ValidationError" in str(exc_type):
            return None
    
    # Add custom tags
    event["tags"] = event.get("tags", {})
    event["tags"]["service"] = "iesa-backend"
    
    return event


def capture_exception(error: Exception, context: Optional[dict] = None):
    """
    Manually capture an exception to Sentry.
    
    Args:
        error: The exception to capture
        context: Additional context (tags, user info, etc.)
    """
    try:
        import sentry_sdk
        
        if context:
            with sentry_sdk.push_scope() as scope:
                for key, value in context.items():
                    scope.set_tag(key, value)
                sentry_sdk.capture_exception(error)
        else:
            sentry_sdk.capture_exception(error)
            
    except ImportError:
        # Sentry not installed, just log
        logger.error(f"Exception: {str(error)}", exc_info=True)


def capture_message(message: str, level: str = "info", context: Optional[dict] = None):
    """
    Send a message to Sentry.
    
    Args:
        message: The message to send
        level: Severity level (debug, info, warning, error, fatal)
        context: Additional context
    """
    try:
        import sentry_sdk
        
        if context:
            with sentry_sdk.push_scope() as scope:
                for key, value in context.items():
                    scope.set_tag(key, value)
                sentry_sdk.capture_message(message, level)
        else:
            sentry_sdk.capture_message(message, level)
            
    except ImportError:
        logger.log(getattr(logging, level.upper(), logging.INFO), message)


def set_user_context(user_id: str, email: Optional[str] = None, role: Optional[str] = None):
    """
    Set user context for Sentry events.
    
    This helps identify which users are experiencing issues.
    """
    try:
        import sentry_sdk
        
        sentry_sdk.set_user({
            "id": user_id,
            "email": email,
            "role": role
        })
        
    except ImportError:
        pass


def start_transaction(name: str, op: str = "http.server") -> Optional[object]:
    """
    Start a performance transaction.
    
    Args:
        name: Transaction name (e.g., "GET /api/users")
        op: Operation type
        
    Returns:
        Transaction object or None if Sentry not available
    """
    try:
        import sentry_sdk
        return sentry_sdk.start_transaction(name=name, op=op)
    except ImportError:
        return None


def add_breadcrumb(message: str, category: str = "custom", level: str = "info", data: Optional[dict] = None):
    """
    Add a breadcrumb to track user actions.
    
    Breadcrumbs help understand what led to an error.
    """
    try:
        import sentry_sdk
        
        sentry_sdk.add_breadcrumb(
            message=message,
            category=category,
            level=level,
            data=data or {}
        )
        
    except ImportError:
        pass
