"""
Make Admin Script

Promote a user to admin role by their email address.

Usage:
    python -m app.scripts.make_admin <email>
    
Example:
    python -m app.scripts.make_admin "admin@iesa.ui.edu.ng"
"""

import asyncio
import sys
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

MONGODB_URL = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
DATABASE_NAME = os.getenv("DATABASE_NAME", "iesa_db")


async def make_user_admin(email: str):
    """Promote a user to admin role."""
    
    # Connect to MongoDB
    client = AsyncIOMotorClient(MONGODB_URL)
    db = client[DATABASE_NAME]
    users = db.users
    
    print(f"🔍 Looking for user with email: {email}")
    
    # Find user
    user = await users.find_one({"email": email})
    
    if not user:
        print(f"❌ User not found with email: {email}")
        print()
        print("💡 Available users:")
        async for u in users.find({}, {"email": 1, "firstName": 1, "lastName": 1}):
            print(f"   - {u.get('firstName')} {u.get('lastName')} ({u.get('email')})")
            print()
        client.close()
        return False
    
    # Check if already admin
    if user.get("role") == "admin":
        print(f"⚠️  User {user.get('firstName')} {user.get('lastName')} is already an admin!")
        client.close()
        return True
    
    # Update to admin
    result = await users.update_one(
        {"email": email},
        {
            "$set": {
                "role": "admin",
                "updatedAt": datetime.utcnow()
            }
        }
    )
    
    if result.modified_count > 0:
        print(f"✅ Successfully promoted user to admin!")
        print(f"   Name: {user.get('firstName')} {user.get('lastName')}")
        print(f"   Email: {user.get('email')}")
        print(f"   Previous Role: {user.get('role')}")
        print(f"   New Role: admin")
        print()
        print("🎉 User now has full admin permissions!")
        client.close()
        return True
    else:
        print("❌ Failed to update user role")
        client.close()
        return False


async def list_all_users():
    """List all users in the database."""
    
    client = AsyncIOMotorClient(MONGODB_URL)
    db = client[DATABASE_NAME]
    users = db.users
    
    print("📋 All Users:")
    print()
    
    count = 0
    async for user in users.find({}):
        count += 1
        print(f"{count}. {user.get('firstName')} {user.get('lastName')}")
        print(f"   Email: {user.get('email')}")
        print(f"   Role: {user.get('role')}")
        print()
    
    if count == 0:
        print("   No users found. Register via the frontend first.")
        print()
    
    client.close()


if __name__ == "__main__":
    print()
    print("=" * 60)
    print("   IESA Make Admin Script")
    print("=" * 60)
    print()
    
    if len(sys.argv) < 2:
        print("❌ Error: Email address required")
        print()
        print("Usage:")
        print("   python -m app.scripts.make_admin <email>")
        print()
        print("Example:")
        print('   python -m app.scripts.make_admin "admin@iesa.ui.edu.ng"')
        print()
        print("To see all users:")
        print("   python -m app.scripts.make_admin --list")
        print()
        
        if "--list" in sys.argv or "-l" in sys.argv:
            asyncio.run(list_all_users())
        
        sys.exit(1)
    
    email = sys.argv[1]
    
    if email in ["--list", "-l"]:
        asyncio.run(list_all_users())
    else:
        success = asyncio.run(make_user_admin(email))
        sys.exit(0 if success else 1)
