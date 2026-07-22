#!/usr/bin/env python3
"""
Seed script to populate University of Ibadan 2025/2026 Academic Calendar into MongoDB.
"""

import asyncio
import os
import sys
from datetime import datetime, timezone

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

def _dt(year: int, month: int, day: int, hour: int = 0, minute: int = 0) -> datetime:
    return datetime(year, month, day, hour, minute, tzinfo=timezone.utc)

async def main():
    load_dotenv()
    mongo_url = os.getenv("MONGODB_URL") or os.getenv("MONGO_URL") or "mongodb://localhost:27017"
    db_name   = os.getenv("DATABASE_NAME") or os.getenv("DB_NAME") or "iesa"

    print(f"\n============================================================")
    print(f"  Seeding UI 2025/2026 Academic Calendar into '{db_name}'")
    print(f"============================================================")

    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]

    # 1. Update or activate session 2025/2026
    session_doc = await db["sessions"].find_one({"name": "2025/2026"})
    sem1_start = _dt(2026, 1, 19)
    sem1_end   = _dt(2026, 6, 26, 23, 59)
    sem2_start = _dt(2026, 7, 13)
    sem2_end   = _dt(2026, 12, 30, 23, 59)

    # Deactivate all other sessions
    await db["sessions"].update_many({}, {"$set": {"isActive": False}})

    if session_doc:
        session_id = str(session_doc["_id"])
        await db["sessions"].update_one(
            {"_id": session_doc["_id"]},
            {
                "$set": {
                    "isActive": True,
                    "semester1StartDate": sem1_start,
                    "semester1EndDate": sem1_end,
                    "semester2StartDate": sem2_start,
                    "semester2EndDate": sem2_end,
                    "currentSemester": 2, # July 2026 falls in Semester 2
                    "updatedAt": datetime.now(timezone.utc),
                }
            }
        )
        print(f"[OK] Updated active session 2025/2026 (ID: {session_id})")
    else:
        res = await db["sessions"].insert_one({
            "name": "2025/2026",
            "isActive": True,
            "semester1StartDate": sem1_start,
            "semester1EndDate": sem1_end,
            "semester2StartDate": sem2_start,
            "semester2EndDate": sem2_end,
            "currentSemester": 2,
            "createdAt": datetime.now(timezone.utc),
            "updatedAt": datetime.now(timezone.utc),
        })
        session_id = str(res.inserted_id)
        print(f"[OK] Created active session 2025/2026 (ID: {session_id})")

    # Get admin user ID for createdBy
    admin_user = await db["users"].find_one({"role": {"$in": ["admin", "super_admin"]}})
    admin_id = str(admin_user["_id"]) if admin_user else session_id

    # 2. Clear existing academic events for this session
    del_res = await db["academicEvents"].delete_many({"sessionId": session_id})
    print(f"[OK] Cleared {del_res.deleted_count} old academic calendar events")

    # 3. Events definition
    events_data = [
        # ── First Semester ────────────────────────────────────────────
        {
            "title": "Commencement of online Registration for New Students",
            "eventType": "registration",
            "startDate": _dt(2026, 1, 19),
            "endDate": _dt(2026, 1, 19, 23, 59),
            "semester": 1,
            "description": "University of Ibadan - Online Registration for New Students Begins"
        },
        {
            "title": "Virtual Orientation for New Students",
            "eventType": "orientation",
            "startDate": _dt(2026, 1, 19),
            "endDate": _dt(2026, 1, 20, 23, 59),
            "semester": 1,
            "description": "Virtual Orientation Program for Freshers"
        },
        {
            "title": "5 Weeks for Virtual Lectures",
            "eventType": "lecture_start",
            "startDate": _dt(2026, 1, 21),
            "endDate": _dt(2026, 2, 27, 23, 59),
            "semester": 1,
            "description": "5 Weeks for Virtual Lectures"
        },
        {
            "title": "Physical Resumption for New Students",
            "eventType": "other",
            "startDate": _dt(2026, 3, 2),
            "endDate": None,
            "semester": 1,
            "description": "New Students Arrive Campus for Physical Resumption"
        },
        {
            "title": "Physical Orientation for New Students",
            "eventType": "orientation",
            "startDate": _dt(2026, 3, 3),
            "endDate": _dt(2026, 3, 4, 23, 59),
            "semester": 1,
            "description": "On-Campus Physical Orientation for New Students"
        },
        {
            "title": "Physical Resumption for Returning Students & Online Registration",
            "eventType": "registration",
            "startDate": _dt(2026, 3, 5),
            "endDate": None,
            "semester": 1,
            "description": "Campus Resumption & Online Course Registration for Returning Students"
        },
        {
            "title": "Matriculation Ceremony (Physical)",
            "eventType": "convocation",
            "startDate": _dt(2026, 3, 11),
            "endDate": None,
            "semester": 1,
            "description": "Official Matriculation Ceremony for New Students"
        },
        {
            "title": "11 Weeks for Teaching/Revision and Continuous Assessment",
            "eventType": "lecture_start",
            "startDate": _dt(2026, 3, 9),
            "endDate": _dt(2026, 5, 22, 23, 59),
            "semester": 1,
            "description": "Physical Teaching, Revision, and Continuous Assessment"
        },
        {
            "title": "GES Examinations",
            "eventType": "exam_period",
            "startDate": _dt(2026, 5, 25),
            "endDate": _dt(2026, 5, 29, 23, 59),
            "semester": 1,
            "description": "General Studies (GES) First Semester Examinations"
        },
        {
            "title": "Examinations: Technology, Education, Pharmacy, Law, Agriculture & Medical Sciences",
            "eventType": "exam_period",
            "startDate": _dt(2026, 6, 1),
            "endDate": _dt(2026, 6, 12, 23, 59),
            "semester": 1,
            "description": "2 Weeks Examinations in Faculties of Education, Pharmacy, Tech, Law, Agri, RNR, Medicine, Dentistry, EDM, Nursing"
        },
        {
            "title": "Examinations: Arts, Science, Social Sciences, Econ, Vet Med & Computing (End of S1)",
            "eventType": "exam_period",
            "startDate": _dt(2026, 6, 15),
            "endDate": _dt(2026, 6, 26, 23, 59),
            "semester": 1,
            "description": "2 Weeks Examinations in Arts, Science, Social Sciences, Economics, Vet Med, Computing — End of First Semester"
        },

        # ── Second Semester ────────────────────────────────────────────
        {
            "title": "11 Weeks for Teaching/Revision and Continuous Assessment",
            "eventType": "lecture_start",
            "startDate": _dt(2026, 7, 13),
            "endDate": _dt(2026, 10, 9, 23, 59),
            "semester": 2,
            "description": "Second Semester Teaching, Revision, and Continuous Assessment"
        },
        {
            "title": "Processing of First Semester Examination Results",
            "eventType": "other",
            "startDate": _dt(2026, 8, 3),
            "endDate": _dt(2026, 8, 14, 23, 59),
            "semester": 2,
            "description": "2 Weeks for Processing of First Semester Examination Results"
        },
        {
            "title": "Faculty Boards of Examiners Meetings (First Semester Results)",
            "eventType": "other",
            "startDate": _dt(2026, 8, 17),
            "endDate": _dt(2026, 8, 28, 23, 59),
            "semester": 2,
            "description": "Faculty Boards of Examiners meetings to consider First Semester Non-Final Year Results"
        },
        {
            "title": "Senate Meeting (First Semester Non-Final Year Results)",
            "eventType": "other",
            "startDate": _dt(2026, 9, 15),
            "endDate": _dt(2026, 9, 16, 23, 59),
            "semester": 2,
            "description": "Senate meeting for consideration of First Semester Non-Final Year Results"
        },
        {
            "title": "GES Examinations",
            "eventType": "exam_period",
            "startDate": _dt(2026, 10, 12),
            "endDate": _dt(2026, 10, 16, 23, 59),
            "semester": 2,
            "description": "General Studies (GES) Second Semester Examinations"
        },
        {
            "title": "Examinations: Technology, Education, Pharmacy, Law, Agriculture & Medical Sciences",
            "eventType": "exam_period",
            "startDate": _dt(2026, 10, 19),
            "endDate": _dt(2026, 10, 30, 23, 59),
            "semester": 2,
            "description": "2 Weeks Second Semester Exams (Tech, Education, Pharmacy, Law, Agriculture, Medicine, etc.)"
        },
        {
            "title": "Examinations: Arts, Science, Social Sciences, Econ, Vet Med & Computing",
            "eventType": "exam_period",
            "startDate": _dt(2026, 11, 2),
            "endDate": _dt(2026, 11, 13, 23, 59),
            "semester": 2,
            "description": "2 Weeks Second Semester Exams (Arts, Science, Social Sciences, Economics, Computing)"
        },
        {
            "title": "Processing of Second Semester Results",
            "eventType": "other",
            "startDate": _dt(2026, 11, 16),
            "endDate": _dt(2026, 11, 27, 23, 59),
            "semester": 2,
            "description": "2 Weeks for Processing of Second Semester Results"
        },
        {
            "title": "Faculty Boards of Examiners Meetings (Final and Non-Final Year)",
            "eventType": "other",
            "startDate": _dt(2026, 11, 30),
            "endDate": _dt(2026, 12, 11, 23, 59),
            "semester": 2,
            "description": "Faculty Boards of Examiners Meetings (Final and Non-Final Year Results)"
        },
        {
            "title": "Senate Meetings (Final & Non-Final Year Results)",
            "eventType": "other",
            "startDate": _dt(2026, 12, 28),
            "endDate": _dt(2026, 12, 30, 23, 59),
            "semester": 2,
            "description": "Senate meetings for consideration of Final and Non-Final Year Results"
        },

        # ── Next Session ────────────────────────────────────────────
        {
            "title": "Commencement of 2026/2027 Academic Session",
            "eventType": "lecture_start",
            "startDate": _dt(2027, 1, 18),
            "endDate": None,
            "semester": 1,
            "description": "Students Arrive for Commencement of 2026/2027 Academic Session (Undergraduate & Postgraduate)"
        }
    ]

    docs = []
    for ev in events_data:
        docs.append({
            **ev,
            "sessionId": session_id,
            "createdBy": admin_id,
            "createdAt": datetime.now(timezone.utc),
            "updatedAt": datetime.now(timezone.utc)
        })

    ins_res = await db["academicEvents"].insert_many(docs)
    print(f"[OK] Seeded {len(ins_res.inserted_ids)} academic events for 2025/2026 session.")

    # Clean out stale/fake live class notifications
    clean_notifs = await db["notifications"].delete_many({"title": "Class is live now"})
    print(f"[OK] Removed {clean_notifs.deleted_count} stale 'Class is live now' notifications.")

    print("\nAcademic Calendar successfully populated!")

if __name__ == "__main__":
    asyncio.run(main())
