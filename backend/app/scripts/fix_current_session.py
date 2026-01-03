"""
Fix Current Session Script

Updates the active session to reflect the correct 2025/2026 academic year.
Run this if you already initialized the database with the wrong session.

Usage:
    python -m app.scripts.fix_current_session
"""

import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

MONGODB_URL = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
DATABASE_NAME = os.getenv("DATABASE_NAME", "iesa_db")


async def fix_session():
    """Update the active session to the correct 2025/2026 session."""
    
    client = AsyncIOMotorClient(MONGODB_URL)
    db = client[DATABASE_NAME]
    
    print("🔧 Fixing Active Session...")
    print(f"📊 Database: {DATABASE_NAME}")
    print()
    
    sessions = db.sessions
    
    # Find the active session
    active_session = await sessions.find_one({"isActive": True})
    
    if not active_session:
        print("❌ No active session found!")
        print("   Run: python -m app.scripts.init_db")
        client.close()
        return
    
    print(f"📋 Current session: {active_session.get('name', 'Unknown')}")
    print(f"📅 Current semester: {active_session.get('currentSemester', 'Unknown')}")
    print()
    
    # Correct session data for 2024/2025
    # As of Jan 1, 2026: We are in the 2024/2025 session
    # Second semester exams just finished (Dec 2025)
    # Currently in result processing phase
    # Next session (2025/2026) starts March 9, 2026
    correct_session_data = {
        "name": "2024/2025",
        "startDate": datetime(2025, 2, 10),   # Virtual lectures started Feb 10, 2025
        "endDate": datetime(2026, 2, 28),     # Approx end (before next session Mar 9)
        "currentSemester": 2,  # Second semester (exams finished, processing results)
        "isActive": True,
        "updatedAt": datetime.utcnow()
    }
    
    print("✏️  Updating to correct session:")
    print(f"   📅 Session: {correct_session_data['name']}")
    print(f"   📚 Semester: {correct_session_data['currentSemester']}")
    print(f"   📆 Period: Feb 10, 2025 - Feb 2026")
    print()
    
    # Update the session
    result = await sessions.update_one(
        {"_id": active_session["_id"]},
        {"$set": correct_session_data}
    )
    
    if result.modified_count > 0:
        print("✅ Session updated successfully!")
        print()
        print("📝 Session Details:")
        print(f"   • Name: 2024/2025")
        print(f"   • Current Semester: 2 (Result Processing Phase)")
        print(f"   • Status: Active")
        print()
        print("📅 Current Timeline (Jan 2026):")
        print("   • Second semester exams completed (Dec 2025)")
        print("   • Result processing: Jan 5-16, 2026")
        print("   • Faculty Board meetings: Jan 19-30, 2026")
        print("   • Senate meetings: Feb 16-18, 2026")
        print()
        print("💡 Next Steps:")
        print("   1. Next session (2025/2026) starts March 9, 2026")
        print("   2. Create new session before March 9")
        print("   3. Mark this session inactive when new session starts")
    else:
        print("⚠️  No changes made (session might already be correct)")
    
    client.close()


if __name__ == "__main__":
    print()
    print("=" * 60)
    print("   IESA Session Fix Tool - 2024/2025 Academic Year")
    print("=" * 60)
    print()
    
    asyncio.run(fix_session())
    
    print()

