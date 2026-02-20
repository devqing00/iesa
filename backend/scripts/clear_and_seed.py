#!/usr/bin/env python3
"""
Clear and Seed Script — Reset database and create initial data

Usage:
    python scripts/clear_and_seed.py --all
    python scripts/clear_and_seed.py --clear-only
    python scripts/clear_and_seed.py --session "2024/2025"

This script:
1. Clears all collections (users, sessions, enrollments, roles, payments, etc.)
2. Creates the first active academic session
3. Optionally promotes a user to admin

⚠️  WARNING: This DELETES ALL DATA. Use only for development/testing.
"""

import asyncio
import sys
import os
from datetime import datetime, timezone
from typing import Optional

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


async def clear_all_data(db) -> None:
    """Delete all data from all collections."""
    print("\n🗑️  Clearing all data...")
    
    collections = [
        "users",
        "sessions",
        "enrollments",
        "roles",
        "payments",
        "events",
        "announcements",
        "grades",
        "refresh_tokens",
        "audit_logs",
    ]
    
    for collection_name in collections:
        collection = db[collection_name]
        result = await collection.delete_many({})
        print(f"   ✓ Deleted {result.deleted_count} documents from '{collection_name}'")


async def create_session(db, session_name: str, is_active: bool = True) -> str:
    """Create an academic session."""
    from bson import ObjectId
    
    sessions = db["sessions"]
    
    # Check if session already exists
    existing = await sessions.find_one({"name": session_name})
    if existing:
        print(f"   ✓ Session '{session_name}' already exists")
        return str(existing["_id"])
    
    # Parse session name (e.g., "2024/2025")
    try:
        start_year = int(session_name.split("/")[0])
    except (IndexError, ValueError):
        start_year = datetime.now().year
    
    session_data = {
        "name": session_name,
        "startDate": datetime(start_year, 9, 1, tzinfo=timezone.utc),  # September
        "endDate": datetime(start_year + 1, 8, 31, tzinfo=timezone.utc),  # August next year
        "currentSemester": 1,
        "isActive": is_active,
        "createdAt": datetime.now(timezone.utc),
        "updatedAt": datetime.now(timezone.utc),
    }
    
    result = await sessions.insert_one(session_data)
    session_id = str(result.inserted_id)
    
    status = "active" if is_active else "inactive"
    print(f"   ✓ Created {status} session: '{session_name}' (ID: {session_id[:8]}...)")
    
    return session_id


async def promote_user_to_admin(db, email: str) -> bool:
    """Promote a user to admin role."""
    users = db["users"]
    
    user = await users.find_one({"email": email.lower()})
    if not user:
        print(f"   ✗ User with email '{email}' not found")
        return False
    
    if user.get("role") == "admin":
        print(f"   ✓ User '{email}' is already an admin")
        return True
    
    result = await users.update_one(
        {"_id": user["_id"]},
        {"$set": {"role": "admin", "updatedAt": datetime.now(timezone.utc)}}
    )
    
    if result.modified_count == 1:
        print(f"   ✓ Promoted '{email}' to admin")
        return True
    
    return False


async def main():
    import argparse
    from motor.motor_asyncio import AsyncIOMotorClient
    from dotenv import load_dotenv

    parser = argparse.ArgumentParser(description="Clear database and seed initial data")
    parser.add_argument("--all", action="store_true", help="Clear all data and seed defaults")
    parser.add_argument("--clear-only", action="store_true", help="Only clear data, don't seed")
    parser.add_argument("--session", type=str, help="Session name to create (e.g., '2024/2025')")
    parser.add_argument("--admin", type=str, help="Email of user to promote to admin")
    parser.add_argument("--keep-users", action="store_true", help="Keep user accounts (only clear session data)")
    
    args = parser.parse_args()

    # Load environment
    load_dotenv()
    mongo_url = os.getenv("MONGODB_URL") or os.getenv("MONGO_URL") or "mongodb://localhost:27017"
    db_name = os.getenv("DATABASE_NAME") or os.getenv("DB_NAME") or "iesa"

    print(f"\n{'='*60}")
    print(f"IESA Database Clear & Seed Script")
    print(f"{'='*60}")
    print(f"Database: {db_name}")
    print(f"MongoDB:  {mongo_url}")
    
    # Confirmation prompt
    if not args.clear_only and not args.all and not args.session:
        print("\n⚠️  No action specified. Use --help to see options.")
        sys.exit(0)
    
    print(f"\n⚠️  WARNING: This will DELETE data from the database.")
    confirm = input("Type 'yes' to continue: ")
    if confirm.lower() != "yes":
        print("Aborted.")
        sys.exit(0)

    # Connect to MongoDB
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]

    try:
        # Step 1: Clear data
        if args.keep_users:
            print("\n🗑️  Clearing session data (keeping users)...")
            collections = ["sessions", "enrollments", "roles", "payments", "events", "announcements", "grades"]
            for collection_name in collections:
                result = await db[collection_name].delete_many({})
                print(f"   ✓ Deleted {result.deleted_count} documents from '{collection_name}'")
        else:
            await clear_all_data(db)

        if args.clear_only:
            print("\n✅ Data cleared successfully.")
            client.close()
            return

        # Step 2: Create session
        session_name = args.session or "2024/2025"
        if args.all or args.session:
            print(f"\n📅 Creating academic session...")
            session_id = await create_session(db, session_name, is_active=True)

        # Step 3: Promote admin
        if args.admin:
            print(f"\n👤 Promoting user to admin...")
            await promote_user_to_admin(db, args.admin)

        print(f"\n✅ Database setup complete!")
        print(f"\nNext steps:")
        print(f"  1. Register a new user at /register")
        if not args.admin:
            print(f"  2. Promote to admin: python scripts/seed_admin.py <email>")
        print(f"  3. Log in at /admin/login")

    except Exception as e:
        print(f"\n❌ Error: {str(e)}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
    finally:
        client.close()


if __name__ == "__main__":
    asyncio.run(main())
