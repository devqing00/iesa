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
from datetime import datetime, timedelta, timezone
import os
from dotenv import load_dotenv
# NOTE: Passwords handled by Firebase Auth — no passwordHash fields needed

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
    print("      python -m app.scripts.make_admin <email>")
    print()
    
    client.close()


async def create_indexes(db):
    """Create database indexes for better query performance."""
    
    # Users collection indexes
    await db.users.create_index("email", unique=True)
    await db.users.create_index("matricNumber")
    await db.users.create_index("role")
    await db.users.create_index("isActive")
    await db.users.create_index("createdAt")
    await db.users.create_index([("firstName", 1), ("lastName", 1)])  # For name searches
    
    # Sessions collection indexes
    await db.sessions.create_index("isActive")
    await db.sessions.create_index("name", unique=True)
    await db.sessions.create_index([("startDate", -1)])  # For date range queries
    
    # Enrollments collection indexes
    await db.enrollments.create_index([("studentId", 1), ("sessionId", 1)], unique=True)
    await db.enrollments.create_index("sessionId")
    await db.enrollments.create_index("level")
    await db.enrollments.create_index("isActive")
    await db.enrollments.create_index([("sessionId", 1), ("level", 1)])  # Compound index for session+level queries
    
    # Roles collection indexes
    await db.roles.create_index([("userId", 1), ("sessionId", 1), ("position", 1)], unique=True)
    await db.roles.create_index("sessionId")
    await db.roles.create_index("position")
    await db.roles.create_index("userId")
    await db.roles.create_index("isActive")
    await db.roles.create_index([("sessionId", 1), ("isActive", 1)])  # For active roles in session
    
    # Payments collection indexes
    await db.payments.create_index("sessionId")
    await db.payments.create_index("category")
    await db.payments.create_index("dueDate")
    await db.payments.create_index("isActive")
    await db.payments.create_index([("sessionId", 1), ("isActive", 1)])  # For active payments in session
    
    # Transactions collection indexes
    await db.transactions.create_index("studentId")
    await db.transactions.create_index("paymentId")
    await db.transactions.create_index("sessionId")
    await db.transactions.create_index("reference", unique=True)
    await db.transactions.create_index("status")
    await db.transactions.create_index("createdAt")
    await db.transactions.create_index([("studentId", 1), ("createdAt", -1)])  # For student transaction history
    
    # Paystack Transactions collection indexes
    await db.paystackTransactions.create_index("reference", unique=True)
    await db.paystackTransactions.create_index("studentId")
    await db.paystackTransactions.create_index("status")
    await db.paystackTransactions.create_index("createdAt")
    await db.paystackTransactions.create_index([("studentId", 1), ("createdAt", -1)])  # For student payment history
    
    # Bank Transfers collection indexes
    await db.bankTransfers.create_index("studentId")
    await db.bankTransfers.create_index("status")
    await db.bankTransfers.create_index("createdAt")
    await db.bankTransfers.create_index("transactionReference")
    await db.bankTransfers.create_index([("status", 1), ("createdAt", -1)])  # For pending transfers
    
    # Events collection indexes
    await db.events.create_index("sessionId")
    await db.events.create_index("date")
    await db.events.create_index("category")
    await db.events.create_index([("sessionId", 1), ("date", 1)])  # For session events sorted by date
    await db.events.create_index("registrations")  # For checking if user is registered
    await db.events.create_index([("date", 1), ("sessionId", 1)])  # For upcoming events queries
    
    # Announcements collection indexes
    await db.announcements.create_index("sessionId")
    await db.announcements.create_index("targetLevels")
    await db.announcements.create_index("createdAt")
    await db.announcements.create_index("priority")
    await db.announcements.create_index([("sessionId", 1), ("createdAt", -1)])  # For recent announcements
    await db.announcements.create_index([("targetLevels", 1), ("createdAt", -1)])  # For level-specific announcements
    
    # Unit Applications collection indexes
    await db.unit_applications.create_index("studentId")
    await db.unit_applications.create_index("sessionId")
    await db.unit_applications.create_index("status")
    await db.unit_applications.create_index([("sessionId", 1), ("status", 1)])  # For filtering applications
    
    # Paystack + Bank Transfers compound indexes for event payment lookups
    await db.paystackTransactions.create_index([("eventId", 1), ("studentId", 1), ("status", 1)])
    await db.bankTransfers.create_index([("eventId", 1), ("studentId", 1), ("status", 1)])
    
    # Text indexes for search endpoints
    await db.announcements.create_index([("title", "text"), ("content", "text")])
    await db.events.create_index([("title", "text"), ("description", "text")])
    await db.resources.create_index([("title", "text"), ("description", "text"), ("tags", "text")])
    
    # Audit Logs collection indexes
    await db.audit_logs.create_index("userId")
    await db.audit_logs.create_index("action")
    await db.audit_logs.create_index("createdAt")
    await db.audit_logs.create_index([("userId", 1), ("createdAt", -1)])
    
    # Press / Articles collection indexes
    await db.press_articles.create_index("authorId")
    await db.press_articles.create_index("status")
    await db.press_articles.create_index("slug", unique=True, sparse=True)
    await db.press_articles.create_index("publishedAt")
    await db.press_articles.create_index([("status", 1), ("publishedAt", -1)])
    await db.article_views.create_index([("articleId", 1), ("viewerIp", 1)], unique=True)
    
    # Study Groups collection indexes
    await db.study_groups.create_index("members")
    await db.study_groups.create_index("createdBy")
    await db.study_groups.create_index("isActive")
    
    # Resources collection indexes
    await db.resources.create_index("uploadedBy")
    await db.resources.create_index("status")
    await db.resources.create_index("courseCode")
    await db.resources.create_index([("status", 1), ("createdAt", -1)])
    
    # IEPOD collection indexes
    # Drop legacy indexes that used wrong field name (studentId instead of userId)
    try:
        await db.iepod_registrations.drop_index("studentId_1")
    except Exception:
        pass
    try:
        await db.iepod_registrations.drop_index("studentId_1_sessionId_1")
    except Exception:
        pass
    await db.iepod_registrations.create_index("userId")
    await db.iepod_registrations.create_index("sessionId")
    await db.iepod_registrations.create_index([("userId", 1), ("sessionId", 1)], unique=True)
    await db.iepod_societies.create_index("sessionId")
    await db.iepod_points.create_index([("registrationId", 1), ("phase", 1)])
    await db.iepod_quiz_responses.create_index([("registrationId", 1), ("quizId", 1)])
    
    # TIMP collection indexes
    await db.timpApplications.create_index("sessionId")
    await db.timpApplications.create_index("userId")
    await db.timpApplications.create_index([("sessionId", 1), ("userId", 1)], unique=True)
    await db.timpPairs.create_index("sessionId")
    await db.timpPairs.create_index("mentorId")
    await db.timpPairs.create_index("menteeId")
    await db.timpPairs.create_index([("sessionId", 1), ("status", 1)])


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
    
    now = datetime.now(timezone.utc)
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
        "createdAt": datetime.now(timezone.utc),
        "updatedAt": datetime.now(timezone.utc),
        "lastLogin": datetime.now(timezone.utc)
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
