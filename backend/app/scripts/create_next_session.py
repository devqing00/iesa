"""
Create Next Session Script

Creates the 2025/2026 academic session (starts March 9, 2026).
Run this in early March 2026 to prepare for the new session.

Usage:
    python -m app.scripts.create_next_session
"""

import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timezone
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

MONGODB_URL = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
DATABASE_NAME = os.getenv("DATABASE_NAME", "iesa_db")


async def create_next_session():
    """Create the 2025/2026 session and transition from 2024/2025."""
    
    client = AsyncIOMotorClient(MONGODB_URL)
    db = client[DATABASE_NAME]
    
    # Safety check: Don't run before March 1, 2026
    now = datetime.now(timezone.utc)
    session_start_date = datetime(2026, 3, 9)
    
    if now < datetime(2026, 3, 1):
        print("⚠️  WARNING: It's too early to create the new session!")
        print()
        print(f"📅 Current date: {now.strftime('%B %d, %Y')}")
        print(f"📅 New session starts: March 9, 2026")
        print()
        print("❌ The 2024/2025 session is still active:")
        print("   • Result processing: Jan 5-16, 2026")
        print("   • Faculty board meetings: Jan 19-30, 2026")
        print("   • Senate meetings: Feb 16-18, 2026")
        print()
        print("💡 Run this script on or after March 1, 2026")
        client.close()
        return
    
    print("🎓 Creating New Academic Session...")
    print(f"📊 Database: {DATABASE_NAME}")
    print()
    
    sessions = db.sessions
    
    # Check if 2025/2026 session already exists
    next_session = await sessions.find_one({"name": "2025/2026"})
    if next_session:
        print("⚠️  2025/2026 session already exists!")
        print(f"   Session ID: {next_session['_id']}")
        print(f"   Status: {'Active' if next_session.get('isActive') else 'Inactive'}")
        client.close()
        return
    
    # Get current active session (should be 2024/2025)
    current_session = await sessions.find_one({"isActive": True})
    
    if current_session:
        print(f"📋 Current active session: {current_session.get('name', 'Unknown')}")
        print("   Marking as inactive...")
        
        # Deactivate current session
        await sessions.update_one(
            {"_id": current_session["_id"]},
            {"$set": {"isActive": False, "updatedAt": datetime.now(timezone.utc)}}
        )
        print("   ✅ Previous session marked inactive")
        print()
    
    # Create 2025/2026 session
    new_session_data = {
        "name": "2025/2026",
        "startDate": datetime(2026, 3, 9),   # Session starts March 9, 2026
        "endDate": datetime(2027, 2, 28),     # Approx end (before next session)
        "currentSemester": 1,  # First semester
        "isActive": True,
        "createdAt": datetime.now(timezone.utc),
        "updatedAt": datetime.now(timezone.utc)
    }
    
    result = await sessions.insert_one(new_session_data)
    
    print("✅ New session created successfully!")
    print()
    print("📅 Session Details:")
    print(f"   • Name: 2025/2026")
    print(f"   • Start Date: March 9, 2026")
    print(f"   • Current Semester: 1 (First Semester)")
    print(f"   • Status: Active")
    print(f"   • Session ID: {result.inserted_id}")
    print()
    print("📚 Expected Timeline (2025/2026):")
    print("   • New Student Registration: ~Early March 2026")
    print("   • Virtual Lectures: ~Mar 10 - Apr 21, 2026")
    print("   • Physical Teaching: ~Apr-Jul 2026")
    print("   • First Semester Exams: ~Jul-Aug 2026")
    print("   • Second Semester: ~Aug 2026 - Dec 2026")
    print()
    print("💡 Next Steps:")
    print("   1. Create new session payments/events/announcements")
    print("   2. Auto-enroll returning students (level + 100)")
    print("   3. Enable new student registration")
    print("   4. Update system announcements")
    
    client.close()


if __name__ == "__main__":
    print()
    print("=" * 60)
    print("   IESA New Session Creation - 2025/2026")
    print("=" * 60)
    print()
    
    asyncio.run(create_next_session())
    
    print()

