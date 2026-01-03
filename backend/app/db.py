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
library_collection = lambda: get_collection("library")
