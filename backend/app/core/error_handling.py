"""
Centralized Error Handling Middleware

Provides consistent error responses across the API.
Catches and formats all exceptions with appropriate HTTP status codes.
"""

from fastapi import Request, status
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException
from pymongo.errors import PyMongoError, DuplicateKeyError
from bson.errors import InvalidId
import logging
from typing import Union, Optional

# Setup logger
logger = logging.getLogger("iesa_backend")


class IESAException(Exception):
    """Base exception for IESA-specific errors"""
    def __init__(self, message: str, status_code: int = 500, details: Optional[dict] = None):
        self.message = message
        self.status_code = status_code
        self.details = details or {}
        super().__init__(self.message)


async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    """Handle FastAPI HTTP exceptions"""
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": {
                "message": exc.detail,
                "status_code": exc.status_code,
                "type": "http_error"
            }
        }
    )


async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Handle Pydantic validation errors"""
    
    # Extract validation errors
    errors = []
    for error in exc.errors():
        field = " -> ".join(str(loc) for loc in error["loc"])
        errors.append({
            "field": field,
            "message": error["msg"],
            "type": error["type"]
        })
    
    logger.warning(f"Validation error on {request.url.path}: {errors}")
    
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "error": {
                "message": "Validation failed",
                "status_code": 422,
                "type": "validation_error",
                "details": errors
            }
        }
    )


async def mongodb_exception_handler(request: Request, exc: PyMongoError):
    """Handle MongoDB errors"""
    
    if isinstance(exc, DuplicateKeyError):
        # Extract field name from error message if possible
        error_msg = str(exc)
        field = "unknown"
        
        if "email" in error_msg:
            field = "email"
        elif "matricNumber" in error_msg:
            field = "matricNumber"
        elif "firebaseUid" in error_msg:
            field = "firebaseUid"
        
        logger.warning(f"Duplicate key error on {request.url.path}: {field}")
        
        return JSONResponse(
            status_code=status.HTTP_409_CONFLICT,
            content={
                "error": {
                    "message": f"A record with this {field} already exists",
                    "status_code": 409,
                    "type": "duplicate_error",
                    "field": field
                }
            }
        )
    
    else:
        # Generic MongoDB error
        logger.error(f"MongoDB error on {request.url.path}: {str(exc)}")
        
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "error": {
                    "message": "Database error occurred",
                    "status_code": 500,
                    "type": "database_error"
                }
            }
        )


async def invalid_id_exception_handler(request: Request, exc: InvalidId):
    """Handle invalid MongoDB ObjectId errors"""
    
    logger.warning(f"Invalid ObjectId on {request.url.path}: {str(exc)}")
    
    return JSONResponse(
        status_code=status.HTTP_400_BAD_REQUEST,
        content={
            "error": {
                "message": "Invalid ID format",
                "status_code": 400,
                "type": "invalid_id_error"
            }
        }
    )


async def iesa_exception_handler(request: Request, exc: IESAException):
    """Handle custom IESA exceptions"""
    
    logger.error(f"IESA error on {request.url.path}: {exc.message}")
    
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": {
                "message": exc.message,
                "status_code": exc.status_code,
                "type": "application_error",
                **exc.details
            }
        }
    )


async def generic_exception_handler(request: Request, exc: Exception):
    """Catch-all handler for unexpected errors"""
    
    logger.exception(f"Unexpected error on {request.url.path}: {str(exc)}")
    
    # In production, don't expose internal error details
    import os
    is_production = os.getenv("ENVIRONMENT", "development") == "production"
    
    error_message = "An internal server error occurred"
    details = {}
    
    if not is_production:
        # In development, include error details for debugging
        error_message = str(exc)
        details = {
            "exception_type": type(exc).__name__,
            "traceback": str(exc.__traceback__) if hasattr(exc, '__traceback__') else None
        }
    
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "error": {
                "message": error_message,
                "status_code": 500,
                "type": "internal_error",
                **details
            }
        }
    )


def setup_exception_handlers(app):
    """
    Register all exception handlers with the FastAPI application.
    
    Usage:
        from app.core.error_handling import setup_exception_handlers
        setup_exception_handlers(app)
    """
    
    # FastAPI and Starlette exceptions
    app.add_exception_handler(StarletteHTTPException, http_exception_handler)
    app.add_exception_handler(RequestValidationError, validation_exception_handler)
    
    # MongoDB exceptions
    app.add_exception_handler(PyMongoError, mongodb_exception_handler)
    app.add_exception_handler(InvalidId, invalid_id_exception_handler)
    
    # Custom IESA exceptions
    app.add_exception_handler(IESAException, iesa_exception_handler)
    
    # Catch-all for unexpected errors
    app.add_exception_handler(Exception, generic_exception_handler)
    
    logger.info("✅ Exception handlers registered")


# Logging configuration
def setup_logging():
    """Configure structured logging for the application"""
    
    import os
    
    log_level = os.getenv("LOG_LEVEL", "INFO")
    
    logging.basicConfig(
        level=getattr(logging, log_level),
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        handlers=[
            logging.StreamHandler(),
            # In production, add file handler or external logging service
        ]
    )
    
    # Set library log levels
    logging.getLogger("motor").setLevel(logging.WARNING)
    logging.getLogger("pymongo").setLevel(logging.WARNING)
    logging.getLogger("uvicorn.access").setLevel(logging.INFO)
    
    logger.info("✅ Logging configured")
