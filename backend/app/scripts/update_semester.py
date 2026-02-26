"""
Update Semester Script

Updates the current semester for the active session.
Use this when transitioning from 1st to 2nd semester (or vice versa).

Usage:
    python -m app.scripts.update_semester --semester 2
    python -m app.scripts.update_semester --semester 1
"""

import asyncio
import argparse
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timezone
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

MONGODB_URL = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
DATABASE_NAME = os.getenv("DATABASE_NAME", "iesa_db")


async def update_semester(semester_number: int):
    """Update the current semester for the active session."""
    
    if semester_number not in [1, 2]:
        print("❌ Invalid semester number. Must be 1 or 2.")
        return
    
    client = AsyncIOMotorClient(MONGODB_URL)
    db = client[DATABASE_NAME]
    
    print(f"📚 Updating to Semester {semester_number}...")
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
    
    current_semester = active_session.get("currentSemester", 1)
    session_name = active_session.get("name", "Unknown")
    
    print(f"📋 Session: {session_name}")
    print(f"📅 Current Semester: {current_semester}")
    print()
    
    if current_semester == semester_number:
        print(f"⚠️  Already in semester {semester_number}. No changes needed.")
        client.close()
        return
    
    # Update semester
    result = await sessions.update_one(
        {"_id": active_session["_id"]},
        {
            "$set": {
                "currentSemester": semester_number,
                "updatedAt": datetime.now(timezone.utc)
            }
        }
    )
    
    if result.modified_count > 0:
        print(f"✅ Semester updated: {current_semester} → {semester_number}")
        print()
        
        if semester_number == 1:
            print("📅 First Semester Period (UI Calendar):")
            print("   • Virtual Lectures: Feb 10 - Mar 21 (6 weeks)")
            print("   • Physical Teaching: Apr 21 - Jul 4 (11 weeks)")
            print("   • GES Exams: Jul 7-11")
            print("   • Faculty Exams: Jul 14 - Aug 8")
        else:
            print("📅 Second Semester Period (UI Calendar):")
            print("   • Teaching: Aug 25 - Nov 21 (13 weeks)")
            print("   • GES Exams: Nov 24-28")
            print("   • Faculty Exams: Dec 1-31")
            print("   • Result Processing: Jan-Feb")
        
        print()
        print("💡 Remember to:")
        print("   • Update course registrations")
        print("   • Clear previous semester's temporary data")
        print("   • Send semester transition announcement to students")
    else:
        print("⚠️  Update failed or no changes made")
    
    client.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Update the current semester for the active session"
    )
    parser.add_argument(
        "--semester",
        type=int,
        required=True,
        choices=[1, 2],
        help="Semester number (1 or 2)"
    )
    
    args = parser.parse_args()
    
    print()
    print("=" * 60)
    print("   IESA Semester Update Tool")
    print("=" * 60)
    print()
    
    asyncio.run(update_semester(args.semester))
    
    print()

