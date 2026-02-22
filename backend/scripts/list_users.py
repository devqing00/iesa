#!/usr/bin/env python3
"""
List Users Script — View all users with their roles and positions.

Usage:
    python scripts/list_users.py
    python scripts/list_users.py --admins-only
    python scripts/list_users.py --search "john"
"""

import asyncio
import sys
import os
import argparse

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


async def list_users(admins_only: bool = False, search: str = None) -> None:
    """List all users with their roles and positions."""
    from motor.motor_asyncio import AsyncIOMotorClient
    from dotenv import load_dotenv

    load_dotenv()

    mongo_url = os.getenv("MONGODB_URL") or "mongodb://localhost:27017"
    db_name = os.getenv("DATABASE_NAME") or "iesa"

    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    users = db["users"]
    roles = db["roles"]

    print("\n" + "="*90)
    print("👥 IESA USERS")
    print("="*90)
    print()

    # Build query
    query = {}
    if admins_only:
        query["role"] = "admin"
    if search:
        query["$or"] = [
            {"email": {"$regex": search, "$options": "i"}},
            {"firstName": {"$regex": search, "$options": "i"}},
            {"lastName": {"$regex": search, "$options": "i"}},
        ]

    # Get users
    user_list = await users.find(query).sort("email", 1).to_list(length=1000)
    
    if not user_list:
        print("❌ No users found matching criteria.")
        client.close()
        return

    print(f"Found {len(user_list)} user(s):\n")

    # Categorize by role
    admins = [u for u in user_list if u.get("role") == "admin"]
    excos = [u for u in user_list if u.get("role") == "exco"]
    students = [u for u in user_list if u.get("role") not in ["admin", "exco"]]

    # Print admins
    if admins:
        print("🔐 ADMINISTRATORS")
        print("-" * 90)
        for user in admins:
            user_id = str(user["_id"])
            email = user.get("email", "N/A")
            name = f"{user.get('firstName', '')} {user.get('lastName', '')}".strip()
            verified = "✓" if user.get("isEmailVerified") else "✗"
            
            # Get positions for this user
            user_roles = await roles.find({"userId": user_id, "isActive": True}).to_list(length=100)
            positions = [r.get("position") for r in user_roles if r.get("position")]
            positions_str = ", ".join(positions) if positions else "None"
            
            print(f"   • {name:<30} {email:<35} [Verified: {verified}]")
            print(f"     Positions: {positions_str}")
        print()

    # Print excos
    if excos:
        print("⭐ EXCO MEMBERS")
        print("-" * 90)
        for user in excos:
            user_id = str(user["_id"])
            email = user.get("email", "N/A")
            name = f"{user.get('firstName', '')} {user.get('lastName', '')}".strip()
            verified = "✓" if user.get("isEmailVerified") else "✗"
            
            user_roles = await roles.find({"userId": user_id, "isActive": True}).to_list(length=100)
            positions = [r.get("position") for r in user_roles if r.get("position")]
            positions_str = ", ".join(positions) if positions else "None"
            
            print(f"   • {name:<30} {email:<35} [Verified: {verified}]")
            print(f"     Positions: {positions_str}")
        print()

    # Print students (limit to first 20 if many)
    if students and not admins_only:
        print(f"🎓 STUDENTS ({len(students)} total)")
        print("-" * 90)
        display_students = students[:20]
        for user in display_students:
            email = user.get("email", "N/A")
            name = f"{user.get('firstName', '')} {user.get('lastName', '')}".strip()
            level = user.get("currentLevel", "N/A")
            matric = user.get("matricNumber", "N/A")
            verified = "✓" if user.get("isEmailVerified") else "✗"
            
            print(f"   • {name:<30} {email:<35} {level:<6} {matric:<10} [Verified: {verified}]")
        
        if len(students) > 20:
            print(f"\n   ... and {len(students) - 20} more students")
        print()

    # Summary
    print("="*90)
    print(f"Total: {len(user_list)} user(s) | Admins: {len(admins)} | Excos: {len(excos)} | Students: {len(students)}")
    print("="*90)
    print()

    client.close()


def main():
    """Main entry point."""
    parser = argparse.ArgumentParser(description="List IESA users")
    parser.add_argument("--admins-only", action="store_true", help="Show only admin users")
    parser.add_argument("--search", type=str, help="Search by name or email")
    
    args = parser.parse_args()
    
    asyncio.run(list_users(admins_only=args.admins_only, search=args.search))


if __name__ == "__main__":
    main()
