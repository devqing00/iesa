"""Fix users in cloud MongoDB - add password hashes"""
import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timezone
import sys
import os.path
sys.path.append(os.path.dirname(__file__))

# Import from backend
from app.core.auth import hash_password

MONGODB_URL = "mongodb+srv://adetayoalexander12:8oj4NiUp7FK0jyty@cluster0.qrykl.mongodb.net/?appName=Cluster0"
DATABASE_NAME = "iesa_db"

async def fix_users():
    client = AsyncIOMotorClient(MONGODB_URL)
    db = client[DATABASE_NAME]
    
    # Fix firebaseUid index - make it sparse so multiple nulls are allowed
    print("🔧 Fixing firebaseUid index...")
    try:
        await db.users.drop_index("firebaseUid_1")
        print("   ✅ Dropped old unique firebaseUid index")
    except Exception as e:
        print(f"   ℹ️  Index doesn't exist: {e}")
    
    # Create sparse index (allows multiple null values)
    await db.users.create_index("firebaseUid", unique=False, sparse=True)
    print("   ✅ Created sparse firebaseUid index\n")
    
    # Check existing users
    all_users = await db.users.find({}, {"email": 1, "role": 1, "passwordHash": 1}).to_list(100)
    
    print(f"\n{'='*60}")
    print(f"Found {len(all_users)} users in database:")
    print(f"{'='*60}")
    
    users_without_password = []
    for u in all_users:
        has_pwd = bool(u.get("passwordHash"))
        email = u.get("email", "NO_EMAIL")
        role = u.get("role", "NONE")
        print(f"  - {email} ({role}): {'✅ Has password' if has_pwd else '❌ NO password'}")
        if not has_pwd:
            users_without_password.append(u)
    
    print(f"\n{'='*60}")
    print(f"Users without passwords: {len(users_without_password)}")
    print(f"{'='*60}\n")
    
    # Delete old users without passwords (from Firebase)
    if users_without_password:
        print("🗑️  Deleting old Firebase users (no password hashes)...")
        for u in users_without_password:
            await db.users.delete_one({"_id": u["_id"]})
            print(f"   Deleted: {u.get('email')}")
        print(f"✅ Cleaned up {len(users_without_password)} old users\n")
    
    # Create test users with passwords
    print("👤 Creating test users with JWT auth...")
    
    # Admin user
    admin_email = "admin@iesa.ui.edu.ng"
    admin_password = "AdminPass1!"
    
    existing_admin = await db.users.find_one({"email": admin_email})
    if existing_admin:
        print(f"✅ Admin exists: {admin_email}")
        if not existing_admin.get("passwordHash"):
            await db.users.update_one(
                {"email": admin_email},
                {"$set": {"passwordHash": hash_password(admin_password)}}
            )
            print(f"   ✅ Added password hash")
    else:
        admin_doc = {
            "email": admin_email,
            "passwordHash": hash_password(admin_password),
            "firstName": "Admin",
            "lastName": "User",
            "role": "admin",
            "department": "Industrial Engineering",
            "position": "Head of Department",
            "bio": None,
            "profilePictureUrl": None,
            "skills": [],
            "emailVerified": True,
            "hasCompletedOnboarding": True,
            "isActive": True,
            "createdAt": datetime.now(timezone.utc),
            "updatedAt": datetime.now(timezone.utc),
        }
        await db.users.insert_one(admin_doc)
        print(f"✅ Created admin: {admin_email}")
    
    # Student user
    student_email = "test@stu.ui.edu.ng"
    student_password = "TestPass1!"
    
    existing_student = await db.users.find_one({"email": student_email})
    if existing_student:
        print(f"✅ Student exists: {student_email}")
        # Update both password and level format
        updates = {}
        if not existing_student.get("passwordHash"):
            updates["passwordHash"] = hash_password(student_password)
        if existing_student.get("currentLevel") and not existing_student["currentLevel"].endswith("L"):
            updates["currentLevel"] = existing_student["currentLevel"] + "L"
        if updates:
            await db.users.update_one(
                {"email": student_email},
                {"$set": updates}
            )
            print(f"   ✅ Updated: {', '.join(updates.keys())}")
    else:
        student_doc = {
            "email": student_email,
            "passwordHash": hash_password(student_password),
            "firstName": "Test",
            "lastName": "Student",
            "matricNumber": "123456",
            "phone": "+2348012345678",
            "currentLevel": "400L",
            "admissionYear": 2022,
            "role": "student",
            "department": "Industrial Engineering",
            "bio": None,
            "profilePictureUrl": None,
            "skills": [],
            "emailVerified": True,
            "hasCompletedOnboarding": True,
            "isActive": True,
            "createdAt": datetime.now(timezone.utc),
            "updatedAt": datetime.now(timezone.utc),
        }
        await db.users.insert_one(student_doc)
        print(f"✅ Created student: {student_email}")
    
    print(f"\n{'='*60}")
    print("🎉 DATABASE READY FOR JWT AUTH!")
    print(f"{'='*60}")
    print("\n📝 TEST CREDENTIALS:")
    print(f"{'='*60}")
    print(f"🔑 Admin:   {admin_email}")
    print(f"   Password: {admin_password}")
    print(f"\n🔑 Student: {student_email}")
    print(f"   Password: {student_password}")
    print(f"{'='*60}\n")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(fix_users())
