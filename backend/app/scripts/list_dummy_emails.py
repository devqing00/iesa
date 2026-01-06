"""
List all dummy student emails for easy testing

Usage:
    python -m app.scripts.list_dummy_emails
"""

import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv

load_dotenv()

MONGODB_URL = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
DATABASE_NAME = os.getenv("DATABASE_NAME", "iesa_db")


async def list_emails():
    """List all generated student emails"""
    client = AsyncIOMotorClient(MONGODB_URL)
    db = client[DATABASE_NAME]
    
    print("\n" + "=" * 70)
    print("📧 IESA Dummy Account Emails")
    print("=" * 70)
    print()
    
    # Get admin
    admin = await db.users.find_one({"role": "admin", "email": {"$regex": "@iesa.ui.edu.ng"}})
    if admin:
        print("👤 ADMIN:")
        print(f"   Email: {admin['email']}")
        print(f"   Name: {admin.get('firstName', '')} {admin.get('lastName', '')}")
        print()
    
    # Get students by level
    levels = [100, 200, 300, 400, 500]
    total_students = 0
    
    for level in levels:
        students = await db.users.find(
            {"role": "student", "currentLevel": f"{level}L"}
        ).sort("email", 1).to_list(length=100)
        
        if students:
            print(f"👥 {level}L STUDENTS ({len(students)}):")
            for student in students:
                email = student.get('email', 'N/A')
                name = f"{student.get('firstName', '')} {student.get('lastName', '')}"
                matric = student.get('matricNumber', 'N/A')
                print(f"   • {email:<45} | {name:<25} | {matric}")
                total_students += 1
            print()
    
    print("=" * 70)
    print(f"📊 Total: {total_students} students + 1 admin = {total_students + 1} accounts")
    print("=" * 70)
    print()
    print("⚠️  REMEMBER: Register these emails at http://localhost:3000/register")
    print("   with any password (e.g., Test@123) before logging in.")
    print()
    
    client.close()


if __name__ == "__main__":
    asyncio.run(list_emails())
