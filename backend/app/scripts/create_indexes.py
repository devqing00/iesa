"""
Database Indexing Script

Creates indexes for MongoDB collections to improve query performance.
Run this script once to set up all necessary indexes.

Usage:
    python -m app.scripts.create_indexes
"""

import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient
from pymongo import ASCENDING, DESCENDING, IndexModel


async def create_indexes():
    """Create all database indexes for optimal performance"""
    
    # Connect to MongoDB
    MONGODB_URL = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
    DATABASE_NAME = os.getenv("DATABASE_NAME", "iesa_db")
    
    client = AsyncIOMotorClient(MONGODB_URL)
    db = client[DATABASE_NAME]
    
    print("🔧 Creating database indexes...")
    
    try:
        # ========================
        # USERS COLLECTION
        # ========================
        users = db["users"]
        
        # Unique indexes
        await users.create_index([("firebaseUid", ASCENDING)], unique=False, sparse=True, name="idx_firebaseUid_legacy")
        await users.create_index([("email", ASCENDING)], unique=True, name="idx_email")
        await users.create_index([("matricNumber", ASCENDING)], unique=True, sparse=True, name="idx_matricNumber")
        
        # Query indexes
        await users.create_index([("role", ASCENDING)], name="idx_role")
        await users.create_index([("isActive", ASCENDING)], name="idx_isActive")
        await users.create_index([("currentLevel", ASCENDING)], name="idx_currentLevel")
        await users.create_index([("isExternalStudent", ASCENDING)], name="idx_isExternalStudent")
        await users.create_index([("department", ASCENDING)], name="idx_department")
        
        print("✅ Users indexes created")
        
        # ========================
        # SESSIONS COLLECTION
        # ========================
        sessions = db["sessions"]
        
        await sessions.create_index([("name", ASCENDING)], unique=True, name="idx_session_name")
        await sessions.create_index([("isActive", ASCENDING)], name="idx_session_isActive")
        await sessions.create_index([("startDate", DESCENDING)], name="idx_session_startDate")
        
        print("✅ Sessions indexes created")
        
        # ========================
        # ENROLLMENTS COLLECTION
        # ========================
        enrollments = db["enrollments"]
        
        # Compound unique index to prevent duplicate enrollments
        await enrollments.create_index(
            [("studentId", ASCENDING), ("sessionId", ASCENDING)],
            unique=True,
            name="idx_enrollment_unique"
        )
        
        # Query indexes
        await enrollments.create_index([("sessionId", ASCENDING)], name="idx_enrollment_session")
        await enrollments.create_index([("studentId", ASCENDING)], name="idx_enrollment_student")
        await enrollments.create_index([("level", ASCENDING)], name="idx_enrollment_level")
        await enrollments.create_index([("isActive", ASCENDING)], name="idx_enrollment_isActive")
        
        print("✅ Enrollments indexes created")
        
        # ========================
        # PAYMENTS COLLECTION
        # ========================
        payments = db["payments"]
        
        # Session-scoped indexes
        await payments.create_index([("sessionId", ASCENDING)], name="idx_payment_session")
        await payments.create_index(
            [("sessionId", ASCENDING), ("dueDate", ASCENDING)],
            name="idx_payment_session_duedate"
        )
        
        # Query indexes
        await payments.create_index([("type", ASCENDING)], name="idx_payment_type")
        await payments.create_index([("isMandatory", ASCENDING)], name="idx_payment_mandatory")
        await payments.create_index([("paidBy", ASCENDING)], name="idx_payment_paidby")
        
        print("✅ Payments indexes created")
        
        # ========================
        # TRANSACTIONS COLLECTION
        # ========================
        transactions = db["transactions"]
        
        # Unique reference for Paystack
        await transactions.create_index([("reference", ASCENDING)], unique=True, sparse=True, name="idx_transaction_reference")
        
        # Query indexes
        await transactions.create_index([("userId", ASCENDING)], name="idx_transaction_user")
        await transactions.create_index([("paymentId", ASCENDING)], name="idx_transaction_payment")
        await transactions.create_index([("sessionId", ASCENDING)], name="idx_transaction_session")
        await transactions.create_index([("status", ASCENDING)], name="idx_transaction_status")
        await transactions.create_index([("createdAt", DESCENDING)], name="idx_transaction_created")
        
        print("✅ Transactions indexes created")
        
        # ========================
        # ROLES COLLECTION
        # ========================
        roles = db["roles"]
        
        # Compound unique index to prevent duplicate role assignments
        await roles.create_index(
            [("userId", ASCENDING), ("sessionId", ASCENDING), ("position", ASCENDING)],
            unique=True,
            name="idx_role_unique"
        )
        
        # Query indexes
        await roles.create_index([("sessionId", ASCENDING)], name="idx_role_session")
        await roles.create_index([("userId", ASCENDING)], name="idx_role_user")
        await roles.create_index([("position", ASCENDING)], name="idx_role_position")
        await roles.create_index([("isActive", ASCENDING)], name="idx_role_isActive")
        
        print("✅ Roles indexes created")
        
        # ========================
        # EVENTS COLLECTION
        # ========================
        events = db["events"]
        
        # Session-scoped indexes
        await events.create_index([("sessionId", ASCENDING)], name="idx_event_session")
        await events.create_index(
            [("sessionId", ASCENDING), ("date", DESCENDING)],
            name="idx_event_session_date"
        )
        
        # Query indexes
        await events.create_index([("category", ASCENDING)], name="idx_event_category")
        await events.create_index([("requiresRegistration", ASCENDING)], name="idx_event_registration")
        await events.create_index([("registrations.userId", ASCENDING)], name="idx_event_registrations")
        await events.create_index([("attendees", ASCENDING)], name="idx_event_attendees")
        
        print("✅ Events indexes created")
        
        # ========================
        # ANNOUNCEMENTS COLLECTION
        # ========================
        announcements = db["announcements"]
        
        # Session-scoped indexes
        await announcements.create_index([("sessionId", ASCENDING)], name="idx_announcement_session")
        await announcements.create_index(
            [("sessionId", ASCENDING), ("createdAt", DESCENDING)],
            name="idx_announcement_session_created"
        )
        
        # Query indexes
        await announcements.create_index([("priority", ASCENDING)], name="idx_announcement_priority")
        await announcements.create_index([("targetLevels", ASCENDING)], name="idx_announcement_targetlevels")
        await announcements.create_index([("readBy", ASCENDING)], name="idx_announcement_readby")
        await announcements.create_index([("expiresAt", ASCENDING)], name="idx_announcement_expires")
        
        print("✅ Announcements indexes created")
        
        # ========================
        # RESOURCES COLLECTION (if exists)
        # ========================
        try:
            resources = db["resources"]
            await resources.create_index([("sessionId", ASCENDING)], name="idx_resource_session")
            await resources.create_index([("category", ASCENDING)], name="idx_resource_category")
            await resources.create_index([("uploadedBy", ASCENDING)], name="idx_resource_uploadedby")
            print("✅ Resources indexes created")
        except Exception as e:
            print(f"⚠️  Resources collection not indexed: {e}")

        # ========================
        # IEPOD COLLECTIONS
        # ========================
        iepod_registrations = db["iepod_registrations"]
        iepod_points = db["iepod_points"]
        iepod_quiz_points = db["iepod_quiz_points"]

        await iepod_registrations.create_index(
            [("userId", ASCENDING), ("sessionId", ASCENDING)],
            unique=True,
            name="idx_iepod_registration_user_session_unique",
        )
        await iepod_registrations.create_index(
            [("sessionId", ASCENDING), ("userId", ASCENDING)],
            name="idx_iepod_registration_session_user",
        )
        await iepod_registrations.create_index(
            [("sessionId", ASCENDING), ("status", ASCENDING), ("createdAt", DESCENDING)],
            name="idx_iepod_registration_session_status_created",
        )

        await iepod_points.create_index(
            [("sessionId", ASCENDING), ("userId", ASCENDING)],
            name="idx_iepod_points_session_user",
        )
        await iepod_points.create_index(
            [("sessionId", ASCENDING), ("awardedAt", DESCENDING)],
            name="idx_iepod_points_session_awarded",
        )
        await iepod_quiz_points.create_index(
            [("sessionId", ASCENDING), ("userId", ASCENDING)],
            name="idx_iepod_quiz_points_session_user",
        )
        await iepod_quiz_points.create_index(
            [("sessionId", ASCENDING), ("awardedAt", DESCENDING)],
            name="idx_iepod_quiz_points_session_awarded",
        )

        iepod_live_quiz_sessions = db["iepod_live_quiz_sessions"]
        iepod_live_quiz_participants = db["iepod_live_quiz_participants"]
        iepod_live_quiz_answers = db["iepod_live_quiz_answers"]

        await iepod_live_quiz_sessions.create_index(
            [("sessionId", ASCENDING), ("joinCode", ASCENDING)],
            name="idx_iepod_live_session_session_join_code",
        )
        await iepod_live_quiz_sessions.create_index(
            [("quizId", ASCENDING), ("status", ASCENDING)],
            name="idx_iepod_live_session_quiz_status",
        )
        await iepod_live_quiz_participants.create_index(
            [("liveSessionId", ASCENDING), ("userId", ASCENDING)],
            unique=True,
            name="idx_iepod_live_participant_unique",
        )
        await iepod_live_quiz_answers.create_index(
            [("liveSessionId", ASCENDING), ("questionIndex", ASCENDING)],
            name="idx_iepod_live_answers_session_question",
        )
        await iepod_live_quiz_answers.create_index(
            [("liveSessionId", ASCENDING), ("userId", ASCENDING), ("questionIndex", ASCENDING)],
            unique=True,
            name="idx_iepod_live_answers_unique",
        )

        print("✅ IEPOD indexes created")
        
        print("\n🎉 All indexes created successfully!")
        
        # Print index statistics
        print("\n📊 Index Statistics:")
        collections = [
            "users", "sessions", "enrollments", "payments", "transactions",
            "roles", "events", "announcements", "iepod_registrations", "iepod_points", "iepod_live_quiz_sessions"
        ]
        
        for collection_name in collections:
            collection = db[collection_name]
            indexes = await collection.index_information()
            print(f"  {collection_name}: {len(indexes)} indexes")
        
    except Exception as e:
        print(f"❌ Error creating indexes: {e}")
        raise
    
    finally:
        client.close()


if __name__ == "__main__":
    print("IESA Database Indexing Script")
    print("=" * 50)
    asyncio.run(create_indexes())
