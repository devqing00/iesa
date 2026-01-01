"""
Database Initialization Script

This script sets up the initial database state for IESA:
- Creates the first admin user
- Creates the first active academic session
- Sets up database indexes for performance

Run this script once after deploying the application:
    python -m app.scripts.init_db
"""

import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timedelta
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

MONGODB_URL = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
DATABASE_NAME = os.getenv("DATABASE_NAME", "iesa_db")


async def init_database():
    """Initialize the database with default data and indexes."""
    
    # Connect to MongoDB
    client = AsyncIOMotorClient(MONGODB_URL)
    db = client[DATABASE_NAME]
    
    print("🚀 Starting IESA Database Initialization...")
    print(f"📊 Database: {DATABASE_NAME}")
    print(f"🔗 MongoDB URL: {MONGODB_URL}")
    print()
    
    # 1. Create Indexes
    print("📑 Creating database indexes...")
    await create_indexes(db)
    print("✅ Indexes created successfully!")
    print()
    
    # 2. Create Default Academic Session
    print("📅 Creating default academic session...")
    session_id = await create_default_session(db)
    print(f"✅ Session created: {session_id}")
    print()
    
    # 3. Create First Admin User (optional - commented out by default)
    # Uncomment and modify if you want to create an admin user via script
    # print("👤 Creating admin user...")
    # admin_id = await create_admin_user(db)
    # print(f"✅ Admin user created: {admin_id}")
    # print()
    
    print("🎉 Database initialization complete!")
    print()
    print("📝 Next Steps:")
    print("   1. Register your first user via the frontend")
    print("   2. Make them admin by running:")
    print("      python -m app.scripts.make_admin <firebase_uid>")
    print()
    
    client.close()


async def create_indexes(db):
    """Create database indexes for better query performance."""
    
    # Users collection indexes
    await db.users.create_index("firebaseUid", unique=True)
    await db.users.create_index("email", unique=True)
    await db.users.create_index("matricNumber")
    await db.users.create_index("role")
    
    # Sessions collection indexes
    await db.sessions.create_index("isActive")
    await db.sessions.create_index("name", unique=True)
    
    # Enrollments collection indexes
    await db.enrollments.create_index([("studentId", 1), ("sessionId", 1)], unique=True)
    await db.enrollments.create_index("sessionId")
    await db.enrollments.create_index("level")
    
    # Roles collection indexes
    await db.roles.create_index([("userId", 1), ("sessionId", 1), ("position", 1)], unique=True)
    await db.roles.create_index("sessionId")
    await db.roles.create_index("position")
    
    # Payments collection indexes
    await db.payments.create_index("sessionId")
    await db.payments.create_index("category")
    
    # Transactions collection indexes
    await db.transactions.create_index("studentId")
    await db.transactions.create_index("paymentId")
    await db.transactions.create_index("sessionId")
    await db.transactions.create_index("reference", unique=True)
    
    # Events collection indexes
    await db.events.create_index("sessionId")
    await db.events.create_index("date")
    
    # Announcements collection indexes
    await db.announcements.create_index("sessionId")
    await db.announcements.create_index("targetLevels")
    await db.announcements.create_index("createdAt")


async def create_default_session(db):
    """Create the first active academic session based on UI academic calendar."""
    
    sessions = db.sessions
    
    # Check if any session exists
    existing = await sessions.find_one({})
    if existing:
        print("   ⚠️  Session already exists, skipping...")
        return str(existing["_id"])
    
    # UI Academic Calendar follows Feb-Feb pattern (not Sept-June)
    # Current date: Jan 1, 2026
    # Current session: 2024/2025 (Started Feb 2025, ends Feb 2026)
    # Next session: 2025/2026 (Starts Mar 9, 2026)
    
    now = datetime.utcnow()
    current_month = now.month
    current_year = now.year
    
    # UI sessions run February to February (approx)
    # Jan-Feb: Previous session (2024/2025) - Second semester finishing
    # Mar-Jan: Current session continues
    if current_month <= 2:  # January-February
        session_start_year = current_year - 2
        session_end_year = current_year - 1
        current_semester = 2  # Second semester finishing
    else:  # March-December
        session_start_year = current_year - 1
        session_end_year = current_year
        # Determine semester based on month
        if current_month < 8:  # Mar-Jul = First semester
            current_semester = 1
        else:  # Aug-Dec = Second semester
            current_semester = 2
    
    session_data = {
        "name": f"{session_start_year}/{session_end_year}",
        "startDate": datetime(session_start_year, 2, 10),  # Virtual lectures start (Feb 10)
        "endDate": datetime(session_end_year, 2, 28),      # Approx end (before next session)
        "currentSemester": current_semester,
        "isActive": True,
        "createdAt": now,
        "updatedAt": now
    }
    
    print(f"   📅 Creating session: {session_data['name']}")
    print(f"   📚 Current semester: {current_semester}")
    print(f"   📆 Session period: Feb {session_start_year} - Feb {session_end_year}")
    
    result = await sessions.insert_one(session_data)
    return str(result.inserted_id)


async def create_admin_user(db):
    """
    Create a default admin user.
    
    ⚠️ WARNING: This is NOT RECOMMENDED for production!
    Instead, register via frontend and use make_admin script.
    
    This is here only for initial development/testing.
    """
    users = db.users
    
    admin_data = {
        "firebaseUid": "TEMP_ADMIN_UID",  # Replace with real Firebase UID
        "email": "admin@iesa.edu",
        "firstName": "Admin",
        "lastName": "User",
        "matricNumber": "ADM/2024/001",
        "phone": "+234000000000",
        "role": "admin",  # Set as admin
        "bio": "System Administrator",
        "profilePhotoURL": None,
        "admissionYear": 2024,
        "currentLevel": None,
        "skills": [],
        "isActive": True,
        "createdAt": datetime.utcnow(),
        "updatedAt": datetime.utcnow(),
        "lastLogin": datetime.utcnow()
    }
    
    result = await users.insert_one(admin_data)
    return str(result.inserted_id)


if __name__ == "__main__":
    print()
    print("=" * 60)
    print("   IESA Database Initialization")
    print("=" * 60)
    print()
    
    asyncio.run(init_database())
