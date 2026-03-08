#!/usr/bin/env python3
"""
Diagnostic script: check why student announcement notifications aren't appearing.

Run from the backend/ directory with the venv activated:
    python -m scripts.check_notifications

Checks:
  1. Active session exists
  2. Enrollments exist for the active session
  3. Notifications exist in the DB
  4. ID format consistency between enrollments and notifications
"""

import asyncio
import os
import sys

# Add parent dir so `app` is importable
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId


from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env"))

MONGO_URI = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
DB_NAME = os.getenv("DATABASE_NAME", "iesa_db")


async def main():
    client = AsyncIOMotorClient(MONGO_URI, serverSelectionTimeoutMS=10000)
    db = client[DB_NAME]

    print("=" * 60)
    print("IESA Notification Diagnostic")
    print(f"DB: {DB_NAME} @ {MONGO_URI[:40]}...")
    print("=" * 60)

    # 1. Check active session
    print("\n--- 1. Active Session ---")
    active_session = await db.sessions.find_one({"isActive": True})
    if not active_session:
        print("  ❌ NO ACTIVE SESSION FOUND!")
        print("     This is the most likely cause. No active session = no enrollments matched.")
        return
    session_id = str(active_session["_id"])
    print(f"  ✅ Active session: {active_session['name']} (id: {session_id})")

    # 2. Check enrollments
    print("\n--- 2. Enrollments for active session ---")
    enroll_count = await db.enrollments.count_documents({"sessionId": session_id, "isActive": True})
    print(f"  Total active enrollments: {enroll_count}")

    if enroll_count == 0:
        print("  ❌ NO ENROLLMENTS for the active session!")
        print("     Students must be enrolled in the active session to receive notifications.")
        print(f"     Session ID being queried: {session_id}")
        
        # Check if enrollments exist with different sessionId format
        all_enrollments = await db.enrollments.count_documents({})
        print(f"\n  Total enrollments in DB (all sessions): {all_enrollments}")
        if all_enrollments > 0:
            sample = await db.enrollments.find_one()
            print(f"  Sample enrollment sessionId: {sample.get('sessionId')!r}")
            print(f"  Active session _id:          {session_id!r}")
            if sample.get("sessionId") != session_id:
                print("  ⚠️  FORMAT MISMATCH! The enrollment sessionId doesn't match the active session _id.")
        return

    # Show level distribution
    pipeline = [
        {"$match": {"sessionId": session_id, "isActive": True}},
        {"$group": {"_id": "$level", "count": {"$sum": 1}}},
        {"$sort": {"_id": 1}},
    ]
    level_dist = await db.enrollments.aggregate(pipeline).to_list(length=None)
    print("  Level distribution:")
    for ld in level_dist:
        print(f"    {ld['_id']}: {ld['count']} student(s)")

    # Sample enrollment to check field formats
    sample_enroll = await db.enrollments.find_one({"sessionId": session_id, "isActive": True})
    print(f"\n  Sample enrollment doc fields:")
    print(f"    studentId type: {type(sample_enroll.get('studentId')).__name__} = {sample_enroll.get('studentId')!r}")
    print(f"    sessionId type: {type(sample_enroll.get('sessionId')).__name__} = {sample_enroll.get('sessionId')!r}")
    print(f"    level type:     {type(sample_enroll.get('level')).__name__} = {sample_enroll.get('level')!r}")
    print(f"    isActive type:  {type(sample_enroll.get('isActive')).__name__} = {sample_enroll.get('isActive')!r}")

    # 3. Check announcements for this session
    print("\n--- 3. Announcements for active session ---")
    ann_count = await db.announcements.count_documents({"sessionId": session_id})
    print(f"  Total announcements: {ann_count}")
    if ann_count > 0:
        latest = await db.announcements.find({"sessionId": session_id}).sort("createdAt", -1).to_list(length=3)
        for a in latest:
            print(f"    - '{a['title']}' | levels={a.get('targetLevels')} | published={a.get('isPublished')}")

    # 4. Check notifications
    print("\n--- 4. Notifications in DB ---")
    total_notifs = await db.notifications.count_documents({})
    ann_notifs = await db.notifications.count_documents({"type": "announcement"})
    print(f"  Total notifications: {total_notifs}")
    print(f"  Announcement notifications: {ann_notifs}")

    if ann_notifs > 0:
        latest_notifs = await db.notifications.find({"type": "announcement"}).sort("createdAt", -1).to_list(length=5)
        for n in latest_notifs:
            print(f"    - userId={n['userId']!r} | '{n['title']}' | read={n.get('isRead')} | {n.get('createdAt')}")
    else:
        print("  ❌ NO announcement notifications exist!")
        print("     The backend never created them, or they were deleted.")

    # 5. Cross-check: do notification userIds match enrollment studentIds?
    if ann_notifs > 0 and enroll_count > 0:
        print("\n--- 5. ID Cross-Check ---")
        notif_users = set()
        async for n in db.notifications.find({"type": "announcement"}, {"userId": 1}):
            notif_users.add(n["userId"])
        
        enroll_students = set()
        async for e in db.enrollments.find({"sessionId": session_id, "isActive": True}, {"studentId": 1}):
            enroll_students.add(e["studentId"])
        
        match = notif_users & enroll_students
        notif_only = notif_users - enroll_students
        print(f"  Notification userIds: {len(notif_users)}")
        print(f"  Enrollment studentIds: {len(enroll_students)}")
        print(f"  Overlap: {len(match)}")
        if notif_only:
            print(f"  IDs in notifications but not enrollments: {list(notif_only)[:5]}")
            print("  (These are likely admin/exco users)")

    # 6. Check a student user
    print("\n--- 6. Sample Student Check ---")
    student = await db.users.find_one({"role": "student"})
    if student:
        sid = str(student["_id"])
        print(f"  Student: {student.get('firstName')} {student.get('lastName')} ({sid})")
        print(f"  Department: {student.get('department')}")
        
        their_enrollment = await db.enrollments.find_one({"studentId": sid, "sessionId": session_id, "isActive": True})
        if their_enrollment:
            print(f"  ✅ Enrolled in active session at level {their_enrollment.get('level')}")
        else:
            print(f"  ❌ NOT enrolled in active session (sessionId: {session_id})")
            # Check if enrolled in other sessions
            any_enrollment = await db.enrollments.find_one({"studentId": sid})
            if any_enrollment:
                print(f"     Has enrollment in session: {any_enrollment.get('sessionId')!r} (level: {any_enrollment.get('level')})")
            else:
                print("     No enrollments at all for this student")
        
        their_notifs = await db.notifications.count_documents({"userId": sid, "type": "announcement"})
        print(f"  Announcement notifications for this student: {their_notifs}")
    else:
        print("  No student users found in DB")

    print("\n" + "=" * 60)
    print("Done. Check the output above for ❌ or ⚠️  markers.")
    print("=" * 60)

    client.close()


if __name__ == "__main__":
    asyncio.run(main())
