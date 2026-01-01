"""
Database Helper Module

Provides MongoDB connection and collection access utilities.
Re-exports from app.db for backward compatibility.
"""

from motor.motor_asyncio import AsyncIOMotorDatabase
from app.db import get_database

# Re-export get_database for any imports that use this path
__all__ = ["get_database"]
