#!/usr/bin/env python3
"""
Seed Admin Script — Promote a registered user to admin role.

Usage:
    python scripts/seed_admin.py <email>

Example:
    python scripts/seed_admin.py john@stu.ui.edu.ng

This script:
1. Connects to MongoDB
2. Finds the user by email
3. Updates their role to "admin"
4. Prints confirmation

The user must already have a registered account (via /auth/register).
"""

import asyncio
import sys
import os

# Add parent directory to path so we can import app modules
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


async def promote_to_admin(email: str) -> None:
    """Promote a user to admin by email address."""
    from motor.motor_asyncio import AsyncIOMotorClient
    from dotenv import load_dotenv

    load_dotenv()

    mongo_url = os.getenv("MONGODB_URL") or os.getenv("MONGO_URL") or "mongodb://localhost:27017"
    db_name = os.getenv("DATABASE_NAME") or os.getenv("DB_NAME") or "iesa"

    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    users = db["users"]

    # Find user
    user = await users.find_one({"email": email})

    if not user:
        print(f"\n❌ No user found with email: {email}")
        print("   Make sure the user has registered first via the student registration page.")
        client.close()
        sys.exit(1)

    current_role = user.get("role", "student")

    if current_role == "admin":
        print(f"\n✅ User '{user.get('firstName', '')} {user.get('lastName', '')}' is already an admin.")
        client.close()
        return

    # Promote to admin
    result = await users.update_one(
        {"_id": user["_id"]},
        {"$set": {"role": "admin"}}
    )

    if result.modified_count == 1:
        print(f"\n✅ Successfully promoted user to admin:")
        print(f"   Name:  {user.get('firstName', '')} {user.get('lastName', '')}")
        print(f"   Email: {email}")
        print(f"   Role:  {current_role} → admin")
        print(f"\n   They can now log in at /admin/login")
    else:
        print(f"\n❌ Failed to update user role. Please try again.")

    client.close()


def main():
    if len(sys.argv) != 2:
        print("Usage: python scripts/seed_admin.py <email>")
        print("Example: python scripts/seed_admin.py john@stu.ui.edu.ng")
        sys.exit(1)

    email = sys.argv[1].strip().lower()

    if "@" not in email:
        print(f"❌ Invalid email: {email}")
        sys.exit(1)

    print(f"🔄 Promoting {email} to admin...")
    asyncio.run(promote_to_admin(email))


if __name__ == "__main__":
    main()
