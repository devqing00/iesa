"""
MongoDB Database Connection and Collection References

This module provides async MongoDB client initialization using Motor.
All collections are centralized here for easy access across the application.
"""

from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from typing import Optional
import os
from dotenv import load_dotenv

load_dotenv()

# MongoDB Configuration
MONGODB_URL = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
DATABASE_NAME = os.getenv("DATABASE_NAME", "iesa_db")

# Global client instance
client: Optional[AsyncIOMotorClient] = None
database: Optional[AsyncIOMotorDatabase] = None


async def connect_to_mongo():
    """
    Establish connection to MongoDB.
    Called on application startup.
    """
    global client, database
    try:
        client = AsyncIOMotorClient(MONGODB_URL)
        database = client[DATABASE_NAME]
        # Verify connection
        await client.admin.command('ping')
        print(f"✅ Connected to MongoDB: {DATABASE_NAME}")
    except Exception as e:
        print(f"❌ Failed to connect to MongoDB: {e}")
        raise


async def close_mongo_connection():
    """
    Close MongoDB connection.
    Called on application shutdown.
    """
    global client
    if client:
        client.close()
        print("✅ MongoDB connection closed")


def get_database() -> AsyncIOMotorDatabase:
    """
    Get the database instance.
    Use this in route handlers to access collections.
    """
    if database is None:
        raise Exception("Database not initialized. Call connect_to_mongo() first.")
    return database


def get_database_client() -> AsyncIOMotorClient:
    """
    Get the MongoDB client instance.
    Required for transactions and advanced operations.
    
    Example:
        from app.db import get_database_client
        from app.core.transactions import run_in_transaction
        
        client = get_database_client()
        result = await run_in_transaction(client, my_callback)
    """
    if client is None:
        raise Exception("Database client not initialized. Call connect_to_mongo() first.")
    return client


# Collection References
# Access these directly in routers: from app.db import users_collection

def get_collection(name: str):
    """Helper to get a collection by name"""
    db = get_database()
    return db[name]


# Core Collections
users_collection = lambda: get_collection("users")
sessions_collection = lambda: get_collection("sessions")
enrollments_collection = lambda: get_collection("enrollments")

# Transactional Collections (all require session_id)
payments_collection = lambda: get_collection("payments")
events_collection = lambda: get_collection("events")
announcements_collection = lambda: get_collection("announcements")
grades_collection = lambda: get_collection("grades")
roles_collection = lambda: get_collection("roles")

# Additional Collections
transactions_collection = lambda: get_collection("transactions")
study_groups_collection = lambda: get_collection("study_groups")

# Sync Client for legacy/sync wrappers
from pymongo import MongoClient

def get_sync_db():
    """Get a synchronous database connection."""
    sync_client = MongoClient(MONGODB_URL)
    return sync_client[DATABASE_NAME]

