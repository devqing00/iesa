#!/usr/bin/env python3
"""
Reset Password Script — Manually reset a user's password.

Usage:
    python scripts/reset_password.py <email> <new_password>

Example:
    python scripts/reset_password.py john@stu.ui.edu.ng "NewPassword123"

Security Note: This bypasses email verification and should only be used
for administrative purposes or emergency recovery.
"""

import asyncio
import sys
import os
from datetime import datetime, timezone

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


async def reset_password(email: str, new_password: str) -> None:
    """Reset a user's password."""
    from motor.motor_asyncio import AsyncIOMotorClient
    from dotenv import load_dotenv
    from app.core.auth import hash_password

    load_dotenv()

    mongo_url = os.getenv("MONGODB_URL") or "mongodb://localhost:27017"
    db_name = os.getenv("DATABASE_NAME") or "iesa"

    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    users = db["users"]

    print("\n" + "="*70)
    print("🔑 PASSWORD RESET")
    print("="*70)
    print()

    # Find user
    user = await users.find_one({"email": email})

    if not user:
        print(f"❌ No user found with email: {email}")
        print()
        print("💡 Use 'python scripts/list_users.py' to see all users")
        print()
        client.close()
        sys.exit(1)

    user_name = f"{user.get('firstName', '')} {user.get('lastName', '')}"
    
    print(f"👤 User Found:")
    print(f"   Name: {user_name}")
    print(f"   Email: {email}")
    print(f"   Role: {user.get('role', 'student')}")
    print()

    # Validate new password
    if len(new_password) < 8:
        print("❌ Password must be at least 8 characters long")
        client.close()
        sys.exit(1)

    # Hash the new password
    print("🔐 Hashing new password...")
    hashed_password = hash_password(new_password)
    
    # Update password
    result = await users.update_one(
        {"_id": user["_id"]},
        {
            "$set": {
                "passwordHash": hashed_password,
                "updatedAt": datetime.now(timezone.utc)
            }
        }
    )

    if result.modified_count > 0:
        print("✅ Password successfully reset!")
        print()
        print("="*70)
        print("🎉 SUCCESS!")
        print("="*70)
        print()
        print(f"User: {user_name}")
        print(f"Email: {email}")
        print(f"New Password: {new_password}")
        print()
        print("⚠️  Make sure to share this password securely!")
        print()
    else:
        print("❌ Failed to update password")
        print()

    client.close()


def main():
    """Main entry point."""
    if len(sys.argv) != 3:
        print("\n❌ Usage: python scripts/reset_password.py <email> <new_password>")
        print("\nExample:")
        print('   python scripts/reset_password.py john@stu.ui.edu.ng "SecurePass123"')
        print()
        print("Password requirements:")
        print("   • At least 8 characters")
        print("   • Mix of uppercase and lowercase recommended")
        print("   • Numbers recommended")
        print()
        sys.exit(1)

    email = sys.argv[1].strip()
    new_password = sys.argv[2].strip()
    
    asyncio.run(reset_password(email, new_password))


if __name__ == "__main__":
    main()
