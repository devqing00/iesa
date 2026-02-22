#!/usr/bin/env python3
"""
Make Super Admin Script — Grant full super_admin privileges to a user.

This script:
1. Sets user role to "admin" (for dashboard access)
2. Creates/updates a "super_admin" position role with ALL permissions
3. Ensures the super_admin position persists across all sessions

Usage:
    python scripts/make_super_admin.py <email>

Example:
    python scripts/make_super_admin.py admin@stu.ui.edu.ng

Super Admin Powers:
✓ Dashboard access (role: admin)
✓ ALL permissions (position: super_admin)
✓ Can assign/revoke roles
✓ Omnipotent privileges across all sessions
"""

import asyncio
import sys
import os
from datetime import datetime
from bson import ObjectId

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


async def make_super_admin(email: str) -> None:
    """Grant super_admin position to a user."""
    from motor.motor_asyncio import AsyncIOMotorClient
    from dotenv import load_dotenv

    load_dotenv()

    mongo_url = os.getenv("MONGODB_URL") or "mongodb://localhost:27017"
    db_name = os.getenv("DATABASE_NAME") or "iesa"

    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    users = db["users"]
    roles = db["roles"]
    sessions_collection = db["sessions"]

    print("\n" + "="*70)
    print("🔐 SUPER ADMIN ASSIGNMENT")
    print("="*70)
    print()

    # Find user
    user = await users.find_one({"email": email})

    if not user:
        print(f"❌ No user found with email: {email}")
        print()
        print("💡 Available users:")
        async for u in users.find({}, {"email": 1, "firstName": 1, "lastName": 1, "role": 1}).limit(20):
            role_label = u.get('role', 'student')
            print(f"   • {u.get('firstName', '')} {u.get('lastName', '')} ({u.get('email', '')}) - {role_label}")
        print()
        client.close()
        sys.exit(1)

    user_id = str(user["_id"])
    user_name = f"{user.get('firstName', '')} {user.get('lastName', '')}"
    
    print(f"👤 User Found:")
    print(f"   Name: {user_name}")
    print(f"   Email: {email}")
    print(f"   Current Role: {user.get('role', 'student')}")
    print()

    # Step 1: Update user role to admin (for dashboard access)
    if user.get("role") != "admin":
        print("📝 Step 1: Granting admin role...")
        await users.update_one(
            {"_id": user["_id"]},
            {
                "$set": {
                    "role": "admin",
                    "updatedAt": datetime.utcnow()
                }
            }
        )
        print("   ✓ User role set to: admin")
    else:
        print("✓ User already has admin role")
    print()

    # Step 2: Get active session
    active_session = await sessions_collection.find_one({"isActive": True})
    if not active_session:
        print("❌ No active session found! Run init_db first.")
        client.close()
        sys.exit(1)

    session_id = str(active_session["_id"])
    session_name = active_session.get("name", "Unknown")
    
    print(f"📅 Active Session: {session_name}")
    print()

    # Step 3: Create super_admin position role
    print("📝 Step 2: Assigning super_admin position...")
    
    # Remove any existing super_admin position for this user
    await roles.delete_many({
        "userId": user_id,
        "position": "super_admin"
    })
    
    # Create new super_admin role entry
    super_admin_role = {
        "userId": user_id,
        "sessionId": session_id,
        "position": "super_admin",
        "isActive": True,
        "permissions": [],  # Empty - super_admin bypass check grants ALL
        "assignedBy": user_id,  # Self-assigned
        "assignedAt": datetime.utcnow(),
        "createdAt": datetime.utcnow(),
        "updatedAt": datetime.utcnow()
    }
    
    result = await roles.insert_one(super_admin_role)
    print(f"   ✓ Super admin position created (ID: {result.inserted_id})")
    print()

    # Success summary
    print("="*70)
    print("✅ SUCCESS!")
    print("="*70)
    print()
    print(f"🎉 {user_name} is now a SUPER ADMIN!")
    print()
    print("Powers granted:")
    print("   ✓ Full dashboard access (admin role)")
    print("   ✓ ALL permissions across platform")
    print("   ✓ Can assign/revoke any role")
    print("   ✓ Omnipotent privileges")
    print()
    print("🔑 Login credentials:")
    print(f"   Email: {email}")
    print(f"   Password: (unchanged)")
    print()
    print("🌐 Access admin dashboard at:")
    print("   http://localhost:3000/admin/dashboard")
    print()

    client.close()


def main():
    """Main entry point."""
    if len(sys.argv) != 2:
        print("\n❌ Usage: python scripts/make_super_admin.py <email>")
        print("\nExample:")
        print("   python scripts/make_super_admin.py admin@stu.ui.edu.ng")
        print()
        sys.exit(1)

    email = sys.argv[1].strip()
    asyncio.run(make_super_admin(email))


if __name__ == "__main__":
    main()
