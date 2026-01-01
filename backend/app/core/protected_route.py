"""
Higher-Order Component for protecting routes with permission checks.

Usage:
    from app.core.protected_route import require_permission
    
    @app.post("/announcements")
    @require_permission("announcement:create")
    async def create_announcement(...):
        # Only users with announcement:create can access
"""

from functools import wraps
from typing import Callable, List
from fastapi import Depends
from app.core.permissions import require_permission, require_any_permission, require_all_permissions


def protected(permission: str):
    """
    Decorator for protecting routes with single permission.
    
    Usage:
        @protected("announcement:create")
        @router.post("/announcements")
        async def create_announcement(...):
            pass
    """
    def decorator(func: Callable):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Permission check is handled by FastAPI dependency
            return await func(*args, **kwargs)
        
        # Add dependency to function
        if not hasattr(wrapper, '__dependencies__'):
            wrapper.__dependencies__ = []
        wrapper.__dependencies__.append(Depends(require_permission(permission)))
        
        return wrapper
    return decorator


def protected_any(permissions: List[str]):
    """
    Decorator for protecting routes with ANY permission.
    
    Usage:
        @protected_any(["event:create", "event:edit"])
        @router.post("/events")
        async def manage_event(...):
            pass
    """
    def decorator(func: Callable):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            return await func(*args, **kwargs)
        
        if not hasattr(wrapper, '__dependencies__'):
            wrapper.__dependencies__ = []
        wrapper.__dependencies__.append(Depends(require_any_permission(permissions)))
        
        return wrapper
    return decorator


def protected_all(permissions: List[str]):
    """
    Decorator for protecting routes with ALL permissions.
    
    Usage:
        @protected_all(["payment:approve", "payment:edit"])
        @router.post("/payments/critical")
        async def critical_action(...):
            pass
    """
    def decorator(func: Callable):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            return await func(*args, **kwargs)
        
        if not hasattr(wrapper, '__dependencies__'):
            wrapper.__dependencies__ = []
        wrapper.__dependencies__.append(Depends(require_all_permissions(permissions)))
        
        return wrapper
    return decorator
