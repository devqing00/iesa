#!/usr/bin/env python3
"""
Verify Email Script — Manually verify a user's email address.

Useful when:
- Email delivery is not working
- Testing without email service
- Emergency verification needed

Usage:
    python scripts/verify_email.py <email>

Example:
    python scripts/verify_email.py john@stu.ui.edu.ng
"""

import asyncio
import sys
import os
from datetime import datetime

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


async def verify_email(email: str) -> None:
    """Manually verify a user's email."""
    from motor.motor_asyncio import AsyncIOMotorClient
    from dotenv import load_dotenv

    load_dotenv()

    mongo_url = os.getenv("MONGODB_URL") or "mongodb://localhost:27017"
    db_name = os.getenv("DATABASE_NAME") or "iesa"

    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    users = db["users"]

    print("\n" + "="*70)
    print("✉️  EMAIL VERIFICATION")
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
    is_verified = user.get("isEmailVerified", False)
    
    print(f"👤 User Found:")
    print(f"   Name: {user_name}")
    print(f"   Email: {email}")
    print(f"   Role: {user.get('role', 'student')}")
    print(f"   Current Status: {'✓ Verified' if is_verified else '✗ Not Verified'}")
    print()

    if is_verified:
        print("✅ Email is already verified!")
        print()
        client.close()
        return

    # Verify the email
    print("📝 Verifying email...")
    result = await users.update_one(
        {"_id": user["_id"]},
        {
            "$set": {
                "isEmailVerified": True,
                "emailVerifiedAt": datetime.utcnow(),
                "updatedAt": datetime.utcnow()
            }
        }
    )

    if result.modified_count > 0:
        print("✅ Email successfully verified!")
        print()
        print("="*70)
        print("🎉 SUCCESS!")
        print("="*70)
        print()
        print(f"User: {user_name}")
        print(f"Email: {email}")
        print(f"Status: ✓ Verified")
        print()
        print("The user can now log in without email verification.")
        print()
    else:
        print("❌ Failed to verify email")
        print()

    client.close()


def main():
    """Main entry point."""
    if len(sys.argv) != 2:
        print("\n❌ Usage: python scripts/verify_email.py <email>")
        print("\nExample:")
        print("   python scripts/verify_email.py john@stu.ui.edu.ng")
        print()
        sys.exit(1)

    email = sys.argv[1].strip()
    asyncio.run(verify_email(email))


if __name__ == "__main__":
    main()
