#!/usr/bin/env python3
"""
Comprehensive Dummy-Data Seed Script for IESA Platform

Seeds: sessions, users (dual-email + notification prefs), enrollments, roles,
       events, announcements, payments, academic calendar, timetable, grades
       (all students, both sessions), bank accounts, bank transfers, notifications,
       study groups, press articles, library resources, TIMP mentor
       applications + pairs, unit applications, and previous-session archive data.

Usage:
    python scripts/seed_dummy_data.py              # Seed everything (keeps existing users)
    python scripts/seed_dummy_data.py --fresh       # Clear ALL data first, then seed
    python scripts/seed_dummy_data.py --no-users    # Skip user creation

⚠️  Requires the backend venv (motor, argon2-cffi, python-dotenv).
"""

import asyncio
import os
import sys
import argparse
import re
from datetime import datetime, timezone, timedelta
from typing import List

from bson import ObjectId

# Add parent directory to path so we can import app modules
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

from app.core.auth import hash_password

# ───────────────────────────────────────────────────────────────────────
# Helper
# ───────────────────────────────────────────────────────────────────────
NOW = datetime.now(timezone.utc)
YEAR = NOW.year  # e.g. 2026


def _dt(year: int, month: int, day: int, hour: int = 0, minute: int = 0) -> datetime:
    return datetime(year, month, day, hour, minute, tzinfo=timezone.utc)


def _slug(title: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-")


# ───────────────────────────────────────────────────────────────────────
# Data generators
# ───────────────────────────────────────────────────────────────────────

async def seed_sessions(db) -> tuple[str, str]:
    """Create two sessions: 2024/2025 (inactive) and 2025/2026 (active)."""
    coll = db["sessions"]

    prev = {
        "name": "2024/2025",
        "semester1StartDate": _dt(2024, 9, 16),
        "semester1EndDate":   _dt(2025, 1, 31),
        "semester2StartDate": _dt(2025, 2, 10),
        "semester2EndDate":   _dt(2025, 7, 31),
        "currentSemester": 2,
        "isActive": False,
        "createdAt": _dt(2024, 8, 1),
        "updatedAt": NOW,
    }
    curr = {
        "name": "2025/2026",
        "semester1StartDate": _dt(2025, 9, 15),
        "semester1EndDate":   _dt(2026, 1, 30),
        "semester2StartDate": _dt(2026, 2,  9),
        "semester2EndDate":   _dt(2026, 7, 31),
        "currentSemester": 1,
        "isActive": True,
        "createdAt": _dt(2025, 8, 1),
        "updatedAt": NOW,
    }

    prev_id = (await coll.insert_one(prev)).inserted_id
    curr_id = (await coll.insert_one(curr)).inserted_id
    print(f"   ✓ Sessions: 2024/2025 (inactive), 2025/2026 (active)")
    return str(prev_id), str(curr_id)


async def seed_users(db) -> dict[str, str]:
    """Create admin + 15 students/exco. Returns {email: id}."""
    coll = db["users"]
    pwd_hash = hash_password("Password1!")

    users = [
        # ── Admin ────────────────────────────────────────────
        {
            "firstName": "Admin", "lastName": "User",
            "email": "admin@iesa.dev",
            "role": "admin",
            "matricNumber": None, "admissionYear": None, "currentLevel": None,
            "department": "Industrial Engineering",
            "phone": None, "bio": None, "skills": [],
            "emailType": "personal",
            "secondaryEmail": None, "secondaryEmailType": None,
            "secondaryEmailVerified": False,
            "notificationEmailPreference": "primary",
            "notificationChannelPreference": "both",
            "isActive": True, "emailVerified": True,
        },
        # ── ExCo President ───────────────────────────────────
        {
            "firstName": "Tobi", "lastName": "Adeyemi",
            "email": "tobi@iesa.dev",
            "role": "exco",
            "matricNumber": f"{str(YEAR-5)[2:]}/22EE210",
            "admissionYear": YEAR - 3,
            "currentLevel": "400L",
            "department": "Industrial Engineering",
            "phone": "+2348012345678",
            "bio": "President of IESA. 400L Industrial Engineering student passionate about operations research.",
            "skills": ["Leadership", "Operations Research", "MATLAB"],
            "emailType": "personal",
            "secondaryEmail": "tobi.adeyemi@stu.ui.edu.ng",
            "secondaryEmailType": "institutional",
            "secondaryEmailVerified": True,
            "notificationEmailPreference": "both",
            "notificationChannelPreference": "both",
            "isActive": True, "emailVerified": True,
        },
        # ── Students ─────────────────────────────────────────
        {
            "firstName": "Aisha", "lastName": "Bello",
            "email": "aisha@stu.ui.edu.ng",
            "role": "student",
            "matricNumber": f"{str(YEAR-3)[2:]}/23IP101",
            "admissionYear": YEAR - 1,
            "currentLevel": "200L",
            "department": "Industrial Engineering",
            "phone": "+2348023456789",
            "bio": "200L student. Interested in ergonomics and human factors.",
            "skills": ["AutoCAD", "Python", "Industrial Safety"],
            "emailType": "institutional",
            "secondaryEmail": "aishab2005@gmail.com",
            "secondaryEmailType": "personal",
            "secondaryEmailVerified": True,
            "notificationEmailPreference": "both",
            "notificationChannelPreference": "both",
        },
        {
            "firstName": "Chidi", "lastName": "Okonkwo",
            "email": "chidi@stu.ui.edu.ng",
            "role": "student",
            "matricNumber": f"{str(YEAR-3)[2:]}/23IP102",
            "admissionYear": YEAR - 1,
            "currentLevel": "200L",
            "department": "Industrial Engineering",
            "phone": None, "bio": None,
            "skills": ["Engineering Drawing", "SolidWorks"],
            "emailType": "institutional",
            "secondaryEmail": None, "secondaryEmailType": None,
            "secondaryEmailVerified": False,
            "notificationEmailPreference": "primary",
            "notificationChannelPreference": "both",
        },
        {
            "firstName": "Fatima", "lastName": "Yusuf",
            "email": "fatima@stu.ui.edu.ng",
            "role": "student",
            "matricNumber": f"{str(YEAR-4)[2:]}/22IP101",
            "admissionYear": YEAR - 2,
            "currentLevel": "300L",
            "department": "Industrial Engineering",
            "phone": "+2348034567890",
            "bio": "300L student and IESA PRO. Loves writing and communication.",
            "skills": ["Public Relations", "Microsoft Office", "R", "Statistics"],
            "emailType": "institutional",
            "secondaryEmail": "fatimayusuf99@yahoo.com",
            "secondaryEmailType": "personal",
            "secondaryEmailVerified": False,
            "notificationEmailPreference": "primary",
            "notificationChannelPreference": "email",
        },
        {
            "firstName": "Emeka", "lastName": "Eze",
            "email": "emeka@stu.ui.edu.ng",
            "role": "student",
            "matricNumber": f"{str(YEAR-4)[2:]}/22IP102",
            "admissionYear": YEAR - 2,
            "currentLevel": "300L",
            "department": "Industrial Engineering",
            "phone": "+2348045678901",
            "bio": "300L Financial Secretary. Tracking every kobo.",
            "skills": ["Excel", "QuickBooks", "Lean Manufacturing"],
            "emailType": "institutional",
            "secondaryEmail": "emekaeze@gmail.com",
            "secondaryEmailType": "personal",
            "secondaryEmailVerified": True,
            "notificationEmailPreference": "secondary",
            "notificationChannelPreference": "both",
        },
        {
            "firstName": "Grace", "lastName": "Adebayo",
            "email": "grace@stu.ui.edu.ng",
            "role": "student",
            "matricNumber": f"{str(YEAR-5)[2:]}/21IP101",
            "admissionYear": YEAR - 3,
            "currentLevel": "400L",
            "department": "Industrial Engineering",
            "phone": "+2348056789012",
            "bio": "400L General Secretary. Final year project on supply chain optimisation.",
            "skills": ["Supply Chain", "Python", "Arena Simulation", "LaTeX"],
            "emailType": "institutional",
            "secondaryEmail": None, "secondaryEmailType": None,
            "secondaryEmailVerified": False,
            "notificationEmailPreference": "primary",
            "notificationChannelPreference": "in_app",
        },
        {
            "firstName": "Hakeem", "lastName": "Ibrahim",
            "email": "hakeem@stu.ui.edu.ng",
            "role": "student",
            "matricNumber": f"{str(YEAR-5)[2:]}/21IP102",
            "admissionYear": YEAR - 3,
            "currentLevel": "400L",
            "department": "Industrial Engineering",
            "phone": None, "bio": "400L Class Rep. SIWES at Dangote Group last session.",
            "skills": ["Process Engineering", "AutoCAD", "MATLAB"],
            "emailType": "institutional",
            "secondaryEmail": "hakim.ibrahim@hotmail.com",
            "secondaryEmailType": "personal",
            "secondaryEmailVerified": True,
            "notificationEmailPreference": "primary",
            "notificationChannelPreference": "both",
        },
        {
            "firstName": "Ifeoma", "lastName": "Nwosu",
            "email": "ifeoma@stu.ui.edu.ng",
            "role": "student",
            "matricNumber": f"{str(YEAR-6)[2:]}/20IP101",
            "admissionYear": YEAR - 4,
            "currentLevel": "500L",
            "department": "Industrial Engineering",
            "phone": "+2348067890123",
            "bio": "500L class rep. Final year project: facility layout optimisation.",
            "skills": ["Facility Planning", "AutoPlant", "Lean Six Sigma", "Research"],
            "emailType": "institutional",
            "secondaryEmail": "ifeoma.nwosu@gmail.com",
            "secondaryEmailType": "personal",
            "secondaryEmailVerified": True,
            "notificationEmailPreference": "both",
            "notificationChannelPreference": "both",
        },
        {
            "firstName": "Jide", "lastName": "Akinola",
            "email": "jide@stu.ui.edu.ng",
            "role": "student",
            "matricNumber": f"{str(YEAR-6)[2:]}/20IP102",
            "admissionYear": YEAR - 4,
            "currentLevel": "500L",
            "department": "Industrial Engineering",
            "phone": None, "bio": None,
            "skills": ["Operations Management", "SPSS"],
            "emailType": "institutional",
            "secondaryEmail": None, "secondaryEmailType": None,
            "secondaryEmailVerified": False,
            "notificationEmailPreference": "primary",
            "notificationChannelPreference": "both",
        },
        {
            "firstName": "Kemi", "lastName": "Oladipo",
            "email": "kemi@stu.ui.edu.ng",
            "role": "student",
            "matricNumber": f"{str(YEAR-2)[2:]}/24IP101",
            "admissionYear": YEAR,
            "currentLevel": "100L",
            "department": "Industrial Engineering",
            "phone": "+2348078901234",
            "bio": "Fresh 100L student, excited to be an IESA member!",
            "skills": ["Microsoft Word", "PowerPoint"],
            "emailType": "institutional",
            "secondaryEmail": "kemioladipo@gmail.com",
            "secondaryEmailType": "personal",
            "secondaryEmailVerified": False,
            "notificationEmailPreference": "primary",
            "notificationChannelPreference": "both",
        },
        {
            "firstName": "Lekan", "lastName": "Alabi",
            "email": "lekan@stu.ui.edu.ng",
            "role": "student",
            "matricNumber": f"{str(YEAR-2)[2:]}/24IP102",
            "admissionYear": YEAR,
            "currentLevel": "100L",
            "department": "Industrial Engineering",
            "phone": None, "bio": None, "skills": [],
            "emailType": "institutional",
            "secondaryEmail": None, "secondaryEmailType": None,
            "secondaryEmailVerified": False,
            "notificationEmailPreference": "primary",
            "notificationChannelPreference": "both",
        },
        {
            "firstName": "Ngozi", "lastName": "Chukwuma",
            "email": "ngozi@stu.ui.edu.ng",
            "role": "student",
            "matricNumber": f"{str(YEAR-2)[2:]}/24IP103",
            "admissionYear": YEAR,
            "currentLevel": "100L",
            "department": "Industrial Engineering",
            "phone": "+2348089012345",
            "bio": None,
            "skills": ["Python Basics"],
            "emailType": "institutional",
            "secondaryEmail": None, "secondaryEmailType": None,
            "secondaryEmailVerified": False,
            "notificationEmailPreference": "primary",
            "notificationChannelPreference": "email",
        },
        {
            "firstName": "Pelumi", "lastName": "Afolabi",
            "email": "pelumi@stu.ui.edu.ng",
            "role": "student",
            "matricNumber": f"{str(YEAR-4)[2:]}/22IP103",
            "admissionYear": YEAR - 2,
            "currentLevel": "300L",
            "department": "Industrial Engineering",
            "phone": "+2348090123456",
            "bio": "300L student. Passionate about manufacturing and Industry 4.0.",
            "skills": ["Manufacturing", "CAD", "Python", "IoT"],
            "emailType": "institutional",
            "secondaryEmail": "pelumiafolabi@gmail.com",
            "secondaryEmailType": "personal",
            "secondaryEmailVerified": True,
            "notificationEmailPreference": "secondary",
            "notificationChannelPreference": "both",
        },
        {
            "firstName": "Quincy", "lastName": "Ogundele",
            "email": "quincy@stu.ui.edu.ng",
            "role": "student",
            "matricNumber": f"{str(YEAR-3)[2:]}/23IP103",
            "admissionYear": YEAR - 1,
            "currentLevel": "200L",
            "department": "Industrial Engineering",
            "phone": None, "bio": None, "skills": ["Maths", "Engineering Drawing"],
            "emailType": "institutional",
            "secondaryEmail": None, "secondaryEmailType": None,
            "secondaryEmailVerified": False,
            "notificationEmailPreference": "primary",
            "notificationChannelPreference": "both",
        },
    ]

    docs = []
    for u in users:
        docs.append({
            **u,
            "password": pwd_hash,
            "isActive": u.get("isActive", True),
            "emailVerified": u.get("emailVerified", True),
            "profilePictureUrl": None,
            "googleId": None,
            "createdAt": NOW - timedelta(days=120),
            "updatedAt": NOW,
        })

    result = await coll.insert_many(docs)
    lookup = {users[i]["email"]: str(doc_id) for i, doc_id in enumerate(result.inserted_ids)}

    print(f"   ✓ Users: 1 admin, 1 exco, {len(users) - 2} students (password: Password1!)")
    return lookup


async def seed_enrollments(db, session_id: str, users: dict[str, str]):
    """Enrol every non-admin user in the given session."""
    coll = db["enrollments"]
    skip = {"admin@iesa.dev"}
    level_map = {
        "aisha": "200L", "chidi": "200L", "quincy": "200L",
        "fatima": "300L", "emeka": "300L", "pelumi": "300L",
        "grace": "400L", "hakeem": "400L", "tobi": "400L",
        "ifeoma": "500L", "jide": "500L",
        "kemi": "100L", "lekan": "100L", "ngozi": "100L",
    }
    docs = []
    for email, uid in users.items():
        if email in skip:
            continue
        first = email.split("@")[0]
        level = level_map.get(first, "200L")
        docs.append({
            "studentId": uid,
            "sessionId": session_id,
            "level": level,
            "enrollmentDate": NOW - timedelta(days=30),
            "isActive": True,
            "createdAt": NOW - timedelta(days=30),
            "updatedAt": NOW,
        })
    if docs:
        await coll.insert_many(docs)
    print(f"   ✓ Enrollments: {len(docs)} students enrolled")


async def seed_roles(db, session_id: str, users: dict[str, str]):
    """Assign key ExCo and class-rep roles."""
    coll = db["roles"]
    roles_map = [
        ("tobi@iesa.dev",       "president"),
        ("grace@stu.ui.edu.ng", "general_secretary"),
        ("emeka@stu.ui.edu.ng", "financial_secretary"),
        ("fatima@stu.ui.edu.ng","pro"),
        ("hakeem@stu.ui.edu.ng","class_rep_400L"),
        ("aisha@stu.ui.edu.ng", "class_rep_200L"),
        ("pelumi@stu.ui.edu.ng","class_rep_300L"),
        ("kemi@stu.ui.edu.ng",  "class_rep_100L"),
        ("ifeoma@stu.ui.edu.ng","class_rep_500L"),
    ]
    docs = []
    for email, position in roles_map:
        uid = users.get(email)
        if uid:
            docs.append({
                "userId": uid,
                "sessionId": session_id,
                "position": position,
                "permissions": [],
                "assignedBy": users.get("admin@iesa.dev", ""),
                "createdAt": NOW - timedelta(days=25),
                "updatedAt": NOW,
            })
    if docs:
        await coll.insert_many(docs)
    print(f"   ✓ Roles: {len(docs)} ExCo/class-rep assignments")


async def seed_events(db, session_id: str, admin_id: str) -> List[str]:
    """Create sample IESA events."""
    coll = db["events"]
    events = [
        {
            "title": "IESA Welcome Freshers Night",
            "category": "Social",
            "description": "Annual welcome party for new 100-level students. Live DJ, refreshments, and networking with seniors.",
            "date": _dt(YEAR, 10, 5, 18, 0),
            "location": "Trenchard Hall, University of Ibadan",
            "maxAttendees": 200,
            "requiresPayment": False,
            "registrationDeadline": _dt(YEAR, 10, 3, 23, 59),
        },
        {
            "title": "Industrial Visit — Dangote Refinery",
            "category": "Career",
            "description": "A guided tour of the Dangote Refinery in Lekki, Lagos. Transportation provided. Bring a valid ID.",
            "date": _dt(YEAR, 11, 15, 7, 0),
            "location": "Lekki Free Trade Zone, Lagos",
            "maxAttendees": 50,
            "requiresPayment": True,
            "paymentAmount": 5000.0,
            "registrationDeadline": _dt(YEAR, 11, 10, 23, 59),
        },
        {
            "title": "MATLAB & Python Workshop",
            "category": "Workshop",
            "description": "Hands-on workshop covering MATLAB for control engineering and Python for data analysis. Bring your laptop.",
            "date": _dt(YEAR, 10, 22, 10, 0),
            "location": "Computer Lab 2, Faculty of Technology",
            "maxAttendees": 80,
            "requiresPayment": False,
            "registrationDeadline": _dt(YEAR, 10, 20, 23, 59),
        },
        {
            "title": "IESA Inter-Level Quiz Competition",
            "category": "Competition",
            "description": "Annual quiz competition between all levels. Topics: Engineering fundamentals, General Knowledge, Current affairs.",
            "date": _dt(YEAR + 1, 3, 8, 14, 0),
            "location": "Engineering Lecture Theatre",
            "maxAttendees": None,
            "requiresPayment": False,
        },
        {
            "title": "Career Fair & Alumni Meet",
            "category": "Career",
            "description": "Connect with IESA alumni working at top firms. Resume reviews, mock interviews, and job postings.",
            "date": _dt(YEAR + 1, 4, 20, 9, 0),
            "location": "Faculty of Technology Auditorium",
            "maxAttendees": 300,
            "requiresPayment": False,
            "registrationDeadline": _dt(YEAR + 1, 4, 18, 23, 59),
        },
    ]
    docs = []
    for ev in events:
        docs.append({
            **ev,
            "sessionId": session_id,
            "createdBy": admin_id,
            "registrations": [],
            "attendees": [],
            "imageUrl": None,
            "createdAt": NOW - timedelta(days=10),
            "updatedAt": NOW,
        })
    result = await coll.insert_many(docs)
    ids = [str(i) for i in result.inserted_ids]
    print(f"   ✓ Events: {len(ids)} departmental events")
    return ids


async def seed_announcements(db, session_id: str, admin_id: str):
    """Create sample announcements."""
    coll = db["announcements"]
    announcements = [
        {
            "title": "Welcome to the New Academic Session!",
            "content": "Dear Industrial Engineering students,\n\nWe are excited to welcome you to the new academic session. Please ensure you complete your course registration before the deadline. The IESA executive team has a lot of exciting activities planned this year!",
            "priority": "high",
            "isPinned": True,
            "targetLevels": None,
        },
        {
            "title": "IESA Dues Payment Deadline Extended",
            "content": "The deadline for IESA departmental dues has been extended by two weeks. Please make payments through the portal. Contact the Financial Secretary for any issues.",
            "priority": "urgent",
            "isPinned": False,
            "targetLevels": None,
        },
        {
            "title": "100-Level Orientation Schedule",
            "content": "All 100-level students should report to the Engineering Lecture Theatre on Monday at 9:00 AM for the departmental orientation. Attendance is compulsory.",
            "priority": "normal",
            "isPinned": False,
            "targetLevels": ["100L"],
        },
        {
            "title": "500-Level Final Year Project Guidelines",
            "content": "The final year project proposal submission deadline is approaching. All 500-level students should collect the project guideline document from the HOD's office. Supervisor allocation will begin next week.",
            "priority": "high",
            "isPinned": False,
            "targetLevels": ["500L"],
        },
        {
            "title": "Library Access Cards",
            "content": "Kenneth Dike Library access cards for the new session are ready for collection. Visit the Faculty of Technology office with your student ID.",
            "priority": "low",
            "isPinned": False,
            "targetLevels": None,
        },
    ]
    docs = []
    for i, ann in enumerate(announcements):
        docs.append({
            **ann,
            "sessionId": session_id,
            "authorId": admin_id,
            "authorName": "Admin User",
            "readBy": [],
            "expiresAt": None,
            "createdAt": NOW - timedelta(days=15 - i * 3),
            "updatedAt": NOW,
        })
    await coll.insert_many(docs)
    print(f"   ✓ Announcements: {len(docs)} items")


async def seed_payments(db, session_id: str, users: dict[str, str]):
    """Create departmental payment dues and mark a few as paid."""
    coll = db["payments"]
    paid_students = [
        users.get("aisha@stu.ui.edu.ng"),
        users.get("grace@stu.ui.edu.ng"),
        users.get("fatima@stu.ui.edu.ng"),
        users.get("emeka@stu.ui.edu.ng"),
        users.get("tobi@iesa.dev"),
    ]
    paid_students = [uid for uid in paid_students if uid]

    payments = [
        {
            "title": "IESA Departmental Dues",
            "amount": 3000.0,
            "category": "Dues",
            "mandatory": True,
            "deadline": _dt(YEAR, 11, 30, 23, 59),
            "description": "Annual departmental dues for all Industrial Engineering students.",
            "paidBy": paid_students,
        },
        {
            "title": "Faculty of Technology Tee-Shirt",
            "amount": 5500.0,
            "category": "Merchandise",
            "mandatory": False,
            "deadline": _dt(YEAR, 12, 15, 23, 59),
            "description": "Official Faculty of Technology branded t-shirt collection.",
            "paidBy": paid_students[:2],
        },
        {
            "title": "Industrial Visit Fee — Dangote Refinery",
            "amount": 5000.0,
            "category": "Event",
            "mandatory": False,
            "deadline": _dt(YEAR, 11, 10, 23, 59),
            "description": "Covers transportation and logistics for the refinery visit.",
            "paidBy": paid_students[:3],
        },
        {
            "title": "Student Welfare Fund",
            "amount": 1000.0,
            "category": "Dues",
            "mandatory": True,
            "deadline": _dt(YEAR, 12, 1, 23, 59),
            "description": "Supports student welfare activities including medical and emergency assistance.",
            "paidBy": paid_students,
        },
    ]
    docs = []
    for p in payments:
        docs.append({
            **p,
            "sessionId": session_id,
            "createdAt": NOW - timedelta(days=20),
            "updatedAt": NOW,
        })
    await coll.insert_many(docs)
    print(f"   ✓ Payments: {len(docs)} dues ({len(paid_students)} students marked as paid for dues)")


async def seed_academic_calendar(db, session_id: str, admin_id: str):
    """Seed academic calendar milestones for both semesters."""
    coll = db["academicEvents"]
    events = [
        # ── Semester 1 ────────────────────────────────────────────
        {
            "title": "Semester 1 Lectures Begin",
            "eventType": "lecture_start",
            "startDate": _dt(YEAR, 9, 22),
            "endDate": None,
            "semester": 1,
            "description": "First day of lectures for the first semester.",
        },
        {
            "title": "Course Registration Period",
            "eventType": "registration",
            "startDate": _dt(YEAR, 9, 15),
            "endDate": _dt(YEAR, 10, 15),
            "semester": 1,
            "description": "Students must register for courses on the university portal.",
        },
        {
            "title": "Add/Drop Period",
            "eventType": "add_drop",
            "startDate": _dt(YEAR, 10, 16),
            "endDate": _dt(YEAR, 10, 31),
            "semester": 1,
            "description": "Last chance to add or drop courses without penalty.",
        },
        {
            "title": "Independence Day Holiday",
            "eventType": "holiday",
            "startDate": _dt(YEAR, 10, 1),
            "endDate": None,
            "semester": 1,
            "description": "National holiday — no lectures.",
        },
        {
            "title": "Mid-Semester Break",
            "eventType": "break_period",
            "startDate": _dt(YEAR, 11, 10),
            "endDate": _dt(YEAR, 11, 14),
            "semester": 1,
            "description": "One-week mid-semester break.",
        },
        {
            "title": "Semester 1 Lectures End",
            "eventType": "lecture_end",
            "startDate": _dt(YEAR, 12, 20),
            "endDate": None,
            "semester": 1,
            "description": "Last day of first-semester lectures.",
        },
        {
            "title": "Semester 1 Examination Period",
            "eventType": "exam_period",
            "startDate": _dt(YEAR + 1, 1, 6),
            "endDate": _dt(YEAR + 1, 1, 25),
            "semester": 1,
            "description": "First semester examinations for all levels.",
        },
        {
            "title": "Christmas & New Year Break",
            "eventType": "break_period",
            "startDate": _dt(YEAR, 12, 21),
            "endDate": _dt(YEAR + 1, 1, 5),
            "semester": 1,
            "description": "University-wide holiday break.",
        },
        # ── Semester 2 ────────────────────────────────────────────
        {
            "title": "Semester 2 Lectures Begin",
            "eventType": "lecture_start",
            "startDate": _dt(YEAR + 1, 2, 10),
            "endDate": None,
            "semester": 2,
            "description": "First day of lectures for the second semester.",
        },
        {
            "title": "Semester 2 Course Registration",
            "eventType": "registration",
            "startDate": _dt(YEAR + 1, 2, 3),
            "endDate": _dt(YEAR + 1, 3, 7),
            "semester": 2,
            "description": "Second-semester course registration window.",
        },
        {
            "title": "Easter Break",
            "eventType": "holiday",
            "startDate": _dt(YEAR + 1, 4, 18),
            "endDate": _dt(YEAR + 1, 4, 21),
            "semester": 2,
            "description": "Easter holiday break.",
        },
        {
            "title": "Semester 2 Lectures End",
            "eventType": "lecture_end",
            "startDate": _dt(YEAR + 1, 6, 20),
            "endDate": None,
            "semester": 2,
            "description": "Last day of second-semester lectures.",
        },
        {
            "title": "Semester 2 Examination Period",
            "eventType": "exam_period",
            "startDate": _dt(YEAR + 1, 7, 1),
            "endDate": _dt(YEAR + 1, 7, 21),
            "semester": 2,
            "description": "Second semester examinations for all levels.",
        },
        {
            "title": "Convocation Ceremony",
            "eventType": "convocation",
            "startDate": _dt(YEAR + 1, 7, 28),
            "endDate": None,
            "semester": 2,
            "description": "University convocation for graduating students.",
        },
        {
            "title": "Project Proposal Submission Deadline",
            "eventType": "deadline",
            "startDate": _dt(YEAR + 1, 3, 15),
            "endDate": None,
            "semester": 2,
            "description": "Final year project proposals must be submitted to the department.",
        },
    ]

    docs = []
    for ev in events:
        docs.append({
            **ev,
            "sessionId": session_id,
            "createdBy": admin_id,
            "createdAt": NOW - timedelta(days=30),
            "updatedAt": None,
        })
    await coll.insert_many(docs)
    print(f"   ✓ Academic Calendar: {len(docs)} events across 2 semesters")


async def seed_timetable(db, session_id: str, admin_id: str):
    """Seed timetable class sessions for all levels."""
    coll = db["classSessions"]  # matches the timetable router's collection name
    
    # Industrial Engineering courses by level
    classes = [
        # ── 100 Level ──────────────────────────────────────────
        {"courseCode": "MTH 101", "courseTitle": "Elementary Mathematics I", "level": 100,
         "day": "Monday", "startTime": "08:00", "endTime": "10:00", "venue": "FT LT 1", "lecturer": "Dr. A. Ogunleye", "type": "lecture"},
        {"courseCode": "MTH 101", "courseTitle": "Elementary Mathematics I (Tutorial)", "level": 100,
         "day": "Wednesday", "startTime": "14:00", "endTime": "15:00", "venue": "FT LT 2", "lecturer": "Mr. B. Kolawole", "type": "tutorial"},
        {"courseCode": "PHY 101", "courseTitle": "General Physics I", "level": 100,
         "day": "Tuesday", "startTime": "10:00", "endTime": "12:00", "venue": "PHY LT", "lecturer": "Prof. C. Adekunle", "type": "lecture"},
        {"courseCode": "PHY 109", "courseTitle": "General Physics Lab I", "level": 100,
         "day": "Thursday", "startTime": "14:00", "endTime": "17:00", "venue": "Physics Lab", "lecturer": "Dr. D. Owolabi", "type": "practical"},
        {"courseCode": "CHM 101", "courseTitle": "General Chemistry I", "level": 100,
         "day": "Wednesday", "startTime": "08:00", "endTime": "10:00", "venue": "Chemistry LT", "lecturer": "Dr. E. Fasina", "type": "lecture"},
        {"courseCode": "GES 101", "courseTitle": "Use of English", "level": 100,
         "day": "Friday", "startTime": "08:00", "endTime": "10:00", "venue": "Arts LT", "lecturer": "Mrs. F. Adeyemo", "type": "lecture"},

        # ── 200 Level ──────────────────────────────────────────
        {"courseCode": "IEE 201", "courseTitle": "Introduction to Industrial Engineering", "level": 200,
         "day": "Monday", "startTime": "10:00", "endTime": "12:00", "venue": "IE Lab", "lecturer": "Dr. G. Akanbi", "type": "lecture"},
        {"courseCode": "MEE 201", "courseTitle": "Engineering Drawing", "level": 200,
         "day": "Tuesday", "startTime": "08:00", "endTime": "10:00", "venue": "Drawing Room", "lecturer": "Engr. H. Balogun", "type": "lecture"},
        {"courseCode": "MEE 201", "courseTitle": "Engineering Drawing (Practical)", "level": 200,
         "day": "Thursday", "startTime": "08:00", "endTime": "11:00", "venue": "Drawing Room", "lecturer": "Engr. H. Balogun", "type": "practical"},
        {"courseCode": "MTH 201", "courseTitle": "Mathematical Methods I", "level": 200,
         "day": "Wednesday", "startTime": "10:00", "endTime": "12:00", "venue": "FT LT 1", "lecturer": "Dr. I. Salami", "type": "lecture"},
        {"courseCode": "EEE 201", "courseTitle": "Applied Electricity", "level": 200,
         "day": "Friday", "startTime": "10:00", "endTime": "12:00", "venue": "EE LT", "lecturer": "Dr. J. Oladele", "type": "lecture"},

        # ── 300 Level ──────────────────────────────────────────
        {"courseCode": "IEE 301", "courseTitle": "Operations Research I", "level": 300,
         "day": "Monday", "startTime": "08:00", "endTime": "10:00", "venue": "IE Seminar Room", "lecturer": "Prof. K. Adeniyi", "type": "lecture"},
        {"courseCode": "IEE 303", "courseTitle": "Ergonomics & Work Study", "level": 300,
         "day": "Tuesday", "startTime": "10:00", "endTime": "12:00", "venue": "IE Lab", "lecturer": "Dr. L. Omotoso", "type": "lecture"},
        {"courseCode": "IEE 305", "courseTitle": "Engineering Statistics", "level": 300,
         "day": "Wednesday", "startTime": "08:00", "endTime": "10:00", "venue": "FT LT 2", "lecturer": "Dr. M. Fakoya", "type": "lecture"},
        {"courseCode": "IEE 307", "courseTitle": "Manufacturing Processes", "level": 300,
         "day": "Thursday", "startTime": "10:00", "endTime": "12:00", "venue": "Workshop", "lecturer": "Engr. N. Adegbenro", "type": "lecture"},
        {"courseCode": "IEE 309", "courseTitle": "Manufacturing Lab", "level": 300,
         "day": "Friday", "startTime": "14:00", "endTime": "17:00", "venue": "IE Workshop", "lecturer": "Engr. N. Adegbenro", "type": "practical"},

        # ── 400 Level ──────────────────────────────────────────
        {"courseCode": "IEE 401", "courseTitle": "Operations Research II", "level": 400,
         "day": "Monday", "startTime": "10:00", "endTime": "12:00", "venue": "IE Seminar Room", "lecturer": "Prof. K. Adeniyi", "type": "lecture"},
        {"courseCode": "IEE 403", "courseTitle": "Quality Control & Reliability", "level": 400,
         "day": "Tuesday", "startTime": "08:00", "endTime": "10:00", "venue": "IE Lab", "lecturer": "Dr. O. Falade", "type": "lecture"},
        {"courseCode": "IEE 405", "courseTitle": "Systems Engineering", "level": 400,
         "day": "Wednesday", "startTime": "10:00", "endTime": "12:00", "venue": "FT LT 1", "lecturer": "Dr. P. Ogbonnaya", "type": "lecture"},
        {"courseCode": "IEE 407", "courseTitle": "Production Planning & Control", "level": 400,
         "day": "Thursday", "startTime": "08:00", "endTime": "10:00", "venue": "IE Seminar Room", "lecturer": "Dr. Q. Olayinka", "type": "lecture"},
        {"courseCode": "IEE 499", "courseTitle": "Industrial Training (SIWES)", "level": 400,
         "day": "Friday", "startTime": "08:00", "endTime": "10:00", "venue": "IE Lab", "lecturer": "Dr. R. Ajala", "type": "lecture"},

        # ── 500 Level ──────────────────────────────────────────
        {"courseCode": "IEE 501", "courseTitle": "Engineering Economics & Finance", "level": 500,
         "day": "Monday", "startTime": "08:00", "endTime": "10:00", "venue": "IE Seminar Room", "lecturer": "Prof. S. Oyewole", "type": "lecture"},
        {"courseCode": "IEE 503", "courseTitle": "Facilities Planning & Design", "level": 500,
         "day": "Tuesday", "startTime": "10:00", "endTime": "12:00", "venue": "IE Lab", "lecturer": "Dr. T. Bankole", "type": "lecture"},
        {"courseCode": "IEE 505", "courseTitle": "Supply Chain Management", "level": 500,
         "day": "Wednesday", "startTime": "08:00", "endTime": "10:00", "venue": "FT LT 2", "lecturer": "Dr. U. Akpan", "type": "lecture"},
        {"courseCode": "IEE 507", "courseTitle": "Simulation & Modelling", "level": 500,
         "day": "Thursday", "startTime": "10:00", "endTime": "12:00", "venue": "Computer Lab", "lecturer": "Dr. V. Okorie", "type": "lecture"},
        {"courseCode": "IEE 509", "courseTitle": "Final Year Project", "level": 500,
         "day": "Friday", "startTime": "10:00", "endTime": "12:00", "venue": "Supervisor's Office", "lecturer": None, "type": "lecture"},
    ]

    docs = []
    for cls in classes:
        docs.append({
            **cls,
            "sessionId": session_id,
            "recurring": True,
            "createdBy": admin_id,
            "createdAt": NOW - timedelta(days=20),
            "updatedAt": NOW,
        })
    await coll.insert_many(docs)
    print(f"   ✓ Timetable: {len(docs)} class sessions across 5 levels")


async def seed_grades(db, session_id: str, users: dict[str, str], session_label: str = ""):
    """Seed grade records for all students for a given session."""
    coll = db["grades"]

    _GRADE_DATA = {
        "kemi": ("100L", [
            {"courseCode": "MTH 101", "courseTitle": "Elementary Mathematics I", "creditUnits": 4, "grade": "B"},
            {"courseCode": "PHY 101", "courseTitle": "General Physics I",         "creditUnits": 3, "grade": "C"},
            {"courseCode": "CHM 101", "courseTitle": "General Chemistry I",       "creditUnits": 3, "grade": "B"},
            {"courseCode": "GES 101", "courseTitle": "Use of English",            "creditUnits": 2, "grade": "A"},
        ]),
        "lekan": ("100L", [
            {"courseCode": "MTH 101", "courseTitle": "Elementary Mathematics I", "creditUnits": 4, "grade": "C"},
            {"courseCode": "PHY 101", "courseTitle": "General Physics I",        "creditUnits": 3, "grade": "B"},
            {"courseCode": "CHM 101", "courseTitle": "General Chemistry I",      "creditUnits": 3, "grade": "C"},
            {"courseCode": "GES 101", "courseTitle": "Use of English",           "creditUnits": 2, "grade": "B"},
        ]),
        "ngozi": ("100L", [
            {"courseCode": "MTH 101", "courseTitle": "Elementary Mathematics I", "creditUnits": 4, "grade": "A"},
            {"courseCode": "PHY 101", "courseTitle": "General Physics I",        "creditUnits": 3, "grade": "A"},
            {"courseCode": "CHM 101", "courseTitle": "General Chemistry I",      "creditUnits": 3, "grade": "B"},
            {"courseCode": "GES 101", "courseTitle": "Use of English",           "creditUnits": 2, "grade": "A"},
        ]),
        "aisha": ("200L", [
            {"courseCode": "IEE 201", "courseTitle": "Introduction to Industrial Engineering", "creditUnits": 3, "grade": "A"},
            {"courseCode": "MEE 201", "courseTitle": "Engineering Drawing",                    "creditUnits": 3, "grade": "B"},
            {"courseCode": "MTH 201", "courseTitle": "Mathematical Methods I",                "creditUnits": 3, "grade": "A"},
            {"courseCode": "EEE 201", "courseTitle": "Applied Electricity",                   "creditUnits": 3, "grade": "B"},
            {"courseCode": "IEE 203", "courseTitle": "Engineering Materials",                 "creditUnits": 3, "grade": "A"},
        ]),
        "chidi": ("200L", [
            {"courseCode": "IEE 201", "courseTitle": "Introduction to Industrial Engineering", "creditUnits": 3, "grade": "B"},
            {"courseCode": "MEE 201", "courseTitle": "Engineering Drawing",                    "creditUnits": 3, "grade": "A"},
            {"courseCode": "MTH 201", "courseTitle": "Mathematical Methods I",                "creditUnits": 3, "grade": "C"},
            {"courseCode": "EEE 201", "courseTitle": "Applied Electricity",                   "creditUnits": 3, "grade": "C"},
            {"courseCode": "IEE 203", "courseTitle": "Engineering Materials",                 "creditUnits": 3, "grade": "B"},
        ]),
        "quincy": ("200L", [
            {"courseCode": "IEE 201", "courseTitle": "Introduction to Industrial Engineering", "creditUnits": 3, "grade": "B"},
            {"courseCode": "MEE 201", "courseTitle": "Engineering Drawing",                    "creditUnits": 3, "grade": "B"},
            {"courseCode": "MTH 201", "courseTitle": "Mathematical Methods I",                "creditUnits": 3, "grade": "B"},
            {"courseCode": "EEE 201", "courseTitle": "Applied Electricity",                   "creditUnits": 3, "grade": "C"},
        ]),
        "fatima": ("300L", [
            {"courseCode": "IEE 301", "courseTitle": "Operations Research I",    "creditUnits": 3, "grade": "A"},
            {"courseCode": "IEE 303", "courseTitle": "Ergonomics & Work Study",  "creditUnits": 3, "grade": "B"},
            {"courseCode": "IEE 305", "courseTitle": "Engineering Statistics",   "creditUnits": 3, "grade": "A"},
            {"courseCode": "IEE 307", "courseTitle": "Manufacturing Processes",  "creditUnits": 3, "grade": "B"},
            {"courseCode": "IEE 311", "courseTitle": "Thermodynamics for IE",    "creditUnits": 3, "grade": "B"},
        ]),
        "emeka": ("300L", [
            {"courseCode": "IEE 301", "courseTitle": "Operations Research I",    "creditUnits": 3, "grade": "B"},
            {"courseCode": "IEE 303", "courseTitle": "Ergonomics & Work Study",  "creditUnits": 3, "grade": "C"},
            {"courseCode": "IEE 305", "courseTitle": "Engineering Statistics",   "creditUnits": 3, "grade": "B"},
            {"courseCode": "IEE 307", "courseTitle": "Manufacturing Processes",  "creditUnits": 3, "grade": "A"},
            {"courseCode": "IEE 311", "courseTitle": "Thermodynamics for IE",    "creditUnits": 3, "grade": "B"},
        ]),
        "pelumi": ("300L", [
            {"courseCode": "IEE 301", "courseTitle": "Operations Research I",    "creditUnits": 3, "grade": "A"},
            {"courseCode": "IEE 303", "courseTitle": "Ergonomics & Work Study",  "creditUnits": 3, "grade": "A"},
            {"courseCode": "IEE 305", "courseTitle": "Engineering Statistics",   "creditUnits": 3, "grade": "B"},
            {"courseCode": "IEE 307", "courseTitle": "Manufacturing Processes",  "creditUnits": 3, "grade": "A"},
        ]),
        "grace": ("400L", [
            {"courseCode": "IEE 401", "courseTitle": "Operations Research II",         "creditUnits": 3, "grade": "A"},
            {"courseCode": "IEE 403", "courseTitle": "Quality Control & Reliability",  "creditUnits": 3, "grade": "A"},
            {"courseCode": "IEE 405", "courseTitle": "Systems Engineering",            "creditUnits": 3, "grade": "B"},
            {"courseCode": "IEE 407", "courseTitle": "Production Planning & Control",  "creditUnits": 3, "grade": "A"},
        ]),
        "hakeem": ("400L", [
            {"courseCode": "IEE 401", "courseTitle": "Operations Research II",         "creditUnits": 3, "grade": "B"},
            {"courseCode": "IEE 403", "courseTitle": "Quality Control & Reliability",  "creditUnits": 3, "grade": "B"},
            {"courseCode": "IEE 405", "courseTitle": "Systems Engineering",            "creditUnits": 3, "grade": "C"},
            {"courseCode": "IEE 407", "courseTitle": "Production Planning & Control",  "creditUnits": 3, "grade": "B"},
        ]),
        "tobi": ("400L", [
            {"courseCode": "IEE 401", "courseTitle": "Operations Research II",        "creditUnits": 3, "grade": "A"},
            {"courseCode": "IEE 403", "courseTitle": "Quality Control & Reliability", "creditUnits": 3, "grade": "B"},
            {"courseCode": "IEE 405", "courseTitle": "Systems Engineering",           "creditUnits": 3, "grade": "A"},
        ]),
        "ifeoma": ("500L", [
            {"courseCode": "IEE 501", "courseTitle": "Engineering Economics & Finance", "creditUnits": 3, "grade": "A"},
            {"courseCode": "IEE 503", "courseTitle": "Facilities Planning & Design",   "creditUnits": 3, "grade": "A"},
            {"courseCode": "IEE 505", "courseTitle": "Supply Chain Management",        "creditUnits": 3, "grade": "B"},
            {"courseCode": "IEE 507", "courseTitle": "Simulation & Modelling",         "creditUnits": 3, "grade": "A"},
            {"courseCode": "IEE 511", "courseTitle": "Human Resource Management",      "creditUnits": 3, "grade": "B"},
        ]),
        "jide": ("500L", [
            {"courseCode": "IEE 501", "courseTitle": "Engineering Economics & Finance", "creditUnits": 3, "grade": "B"},
            {"courseCode": "IEE 503", "courseTitle": "Facilities Planning & Design",   "creditUnits": 3, "grade": "C"},
            {"courseCode": "IEE 505", "courseTitle": "Supply Chain Management",        "creditUnits": 3, "grade": "B"},
            {"courseCode": "IEE 507", "courseTitle": "Simulation & Modelling",         "creditUnits": 3, "grade": "C"},
        ]),
    }

    docs = []
    for email, uid in users.items():
        first = email.split("@")[0]
        if first not in _GRADE_DATA:
            continue
        level, courses = _GRADE_DATA[first]
        docs.append({
            "studentId": uid,
            "sessionId": session_id,
            "level": level,
            "semester": 1,
            "courses": courses,
            "createdAt": NOW - timedelta(days=5),
            "updatedAt": NOW,
        })
    if docs:
        await coll.insert_many(docs)
    print(f"   ✓ Grades: {len(docs)} student grade records{' ' + session_label if session_label else ''}")


# ───────────────────────────────────────────────────────────────────────
# Bank Accounts
# ───────────────────────────────────────────────────────────────────────

async def seed_bank_accounts(db, admin_id: str) -> List[str]:
    """Seed IESA bank accounts that students can transfer to."""
    coll = db["bankAccounts"]
    accounts = [
        {
            "bankName": "Guaranty Trust Bank (GTB)",
            "accountName": "IESA — Industrial Engineering Students Association",
            "accountNumber": "0123456789",
            "isActive": True,
            "notes": "For all IESA dues, merchandise, and event payments.",
        },
        {
            "bankName": "Access Bank",
            "accountName": "IESA Welfare Fund",
            "accountNumber": "9876543210",
            "isActive": True,
            "notes": "For welfare fund contributions only.",
        },
    ]
    docs = [{**a, "createdBy": admin_id, "createdAt": NOW - timedelta(days=60), "updatedAt": NOW}
            for a in accounts]
    result = await coll.insert_many(docs)
    ids = [str(i) for i in result.inserted_ids]
    print(f"   ✓ Bank Accounts: {len(ids)} IESA accounts created")
    return ids


# ───────────────────────────────────────────────────────────────────────
# Bank Transfers
# ───────────────────────────────────────────────────────────────────────

async def seed_bank_transfers(db, session_id: str, users: dict[str, str], bank_account_ids: List[str]):
    """Seed sample bank transfer proof submissions."""
    coll = db["bankTransfers"]
    if not bank_account_ids:
        return
    transfers = [
        {
            "studentId": users.get("aisha@stu.ui.edu.ng"),
            "studentName": "Aisha Bello", "studentEmail": "aisha@stu.ui.edu.ng",
            "paymentId": None, "bankAccountId": bank_account_ids[0],
            "bankAccountName": "IESA — Industrial Engineering Students Association",
            "amount": 3000.0, "senderName": "AISHA BELLO", "senderBank": "First Bank of Nigeria",
            "transactionReference": "FBN240001234567", "transferDate": "2025-11-02",
            "narration": "IESA Dues 2025/2026", "status": "approved",
            "adminNote": "Payment confirmed by the Financial Secretary.",
            "reviewedBy": users.get("admin@iesa.dev"), "reviewedAt": NOW - timedelta(days=10),
        },
        {
            "studentId": users.get("emeka@stu.ui.edu.ng"),
            "studentName": "Emeka Eze", "studentEmail": "emeka@stu.ui.edu.ng",
            "paymentId": None, "bankAccountId": bank_account_ids[0],
            "bankAccountName": "IESA — Industrial Engineering Students Association",
            "amount": 3000.0, "senderName": "EMEKA EZE", "senderBank": "Zenith Bank",
            "transactionReference": "ZTH240009876543", "transferDate": "2025-11-05",
            "narration": "IESA dues payment", "status": "approved",
            "adminNote": None, "reviewedBy": users.get("admin@iesa.dev"), "reviewedAt": NOW - timedelta(days=8),
        },
        {
            "studentId": users.get("chidi@stu.ui.edu.ng"),
            "studentName": "Chidi Okonkwo", "studentEmail": "chidi@stu.ui.edu.ng",
            "paymentId": None, "bankAccountId": bank_account_ids[0],
            "bankAccountName": "IESA — Industrial Engineering Students Association",
            "amount": 3000.0, "senderName": "CHIDI OKONKWO", "senderBank": "UBA",
            "transactionReference": "UBA240007654321", "transferDate": "2025-11-10",
            "narration": "IESA payment", "status": "pending",
            "adminNote": None, "reviewedBy": None, "reviewedAt": None,
        },
    ]
    docs = [
        {**t, "sessionId": session_id, "createdAt": NOW - timedelta(days=12), "updatedAt": NOW}
        for t in transfers if t["studentId"]
    ]
    if docs:
        await coll.insert_many(docs)
    print(f"   ✓ Bank Transfers: {len(docs)} submissions (2 approved, 1 pending)")


# ───────────────────────────────────────────────────────────────────────
# Notifications
# ───────────────────────────────────────────────────────────────────────

async def seed_notifications(db, users: dict[str, str]):
    """Seed in-app notifications for all students."""
    coll = db["notifications"]
    student_emails = [e for e in users if e not in ("admin@iesa.dev",)]
    docs = []
    for email in student_emails:
        uid = users[email]
        first = email.split("@")[0].capitalize()
        docs.append({
            "userId": uid, "type": "announcement",
            "title": "Welcome to IESA!", "isRead": True,
            "message": f"Hi {first}, welcome to the IESA platform for the 2025/2026 academic session.",
            "link": "/dashboard/announcements", "relatedId": None,
            "createdAt": NOW - timedelta(days=30),
        })
        docs.append({
            "userId": uid, "type": "payment",
            "title": "Dues Payment Reminder", "isRead": False,
            "message": "IESA departmental dues are due by 30 November. Pay now to avoid losing access to events.",
            "link": "/dashboard/payments", "relatedId": None,
            "createdAt": NOW - timedelta(days=5),
        })
    upper = [e for e in student_emails if e.split("@")[0] in
             ("grace", "hakeem", "ifeoma", "jide", "fatima", "emeka", "pelumi", "tobi")]
    for email in upper:
        uid = users[email]
        docs.append({
            "userId": uid, "type": "event",
            "title": "Industrial Visit — Dangote Refinery", "isRead": False,
            "message": "Registration is now open for the Dangote Refinery industrial visit. Limited spots available!",
            "link": "/dashboard/events", "relatedId": None,
            "createdAt": NOW - timedelta(days=3),
        })
    if docs:
        await coll.insert_many(docs)
    print(f"   ✓ Notifications: {len(docs)} in-app notifications")


# ───────────────────────────────────────────────────────────────────────
# Study Groups
# ───────────────────────────────────────────────────────────────────────

async def seed_study_groups(db, users: dict[str, str]):
    """Seed sample study groups."""
    coll = db["study_groups"]
    groups = [
        {
            "name": "OR I Study Circle",
            "courseCode": "IEE 301", "courseName": "Operations Research I",
            "description": "Weekly study sessions covering simplex method, transportation & assignment problems.",
            "maxMembers": 8, "meetingDay": "Saturday", "meetingTime": "10:00",
            "meetingLocation": "IE Seminar Room / Zoom", "level": "300L",
            "tags": ["Linear Programming", "Simplex", "Exam Prep"], "isOpen": True,
            "createdBy": users.get("fatima@stu.ui.edu.ng"), "creatorName": "Fatima Yusuf",
            "members": [
                {"userId": users.get("fatima@stu.ui.edu.ng"), "firstName": "Fatima", "lastName": "Yusuf",
                 "matricNumber": f"{str(YEAR-4)[2:]}/22IP101", "joinedAt": NOW - timedelta(days=14)},
                {"userId": users.get("emeka@stu.ui.edu.ng"), "firstName": "Emeka", "lastName": "Eze",
                 "matricNumber": f"{str(YEAR-4)[2:]}/22IP102", "joinedAt": NOW - timedelta(days=14)},
                {"userId": users.get("pelumi@stu.ui.edu.ng"), "firstName": "Pelumi", "lastName": "Afolabi",
                 "matricNumber": f"{str(YEAR-4)[2:]}/22IP103", "joinedAt": NOW - timedelta(days=12)},
            ],
        },
        {
            "name": "Maths Methods 200L",
            "courseCode": "MTH 201", "courseName": "Mathematical Methods I",
            "description": "We tackle differential equations, Laplace transforms, and Fourier series together.",
            "maxMembers": 6, "meetingDay": "Sunday", "meetingTime": "16:00",
            "meetingLocation": "Faculty Library, Ground Floor", "level": "200L",
            "tags": ["ODE", "Laplace", "Fourier"], "isOpen": True,
            "createdBy": users.get("aisha@stu.ui.edu.ng"), "creatorName": "Aisha Bello",
            "members": [
                {"userId": users.get("aisha@stu.ui.edu.ng"), "firstName": "Aisha", "lastName": "Bello",
                 "matricNumber": f"{str(YEAR-3)[2:]}/23IP101", "joinedAt": NOW - timedelta(days=20)},
                {"userId": users.get("chidi@stu.ui.edu.ng"), "firstName": "Chidi", "lastName": "Okonkwo",
                 "matricNumber": f"{str(YEAR-3)[2:]}/23IP102", "joinedAt": NOW - timedelta(days=18)},
                {"userId": users.get("quincy@stu.ui.edu.ng"), "firstName": "Quincy", "lastName": "Ogundele",
                 "matricNumber": f"{str(YEAR-3)[2:]}/23IP103", "joinedAt": NOW - timedelta(days=16)},
            ],
        },
        {
            "name": "FYP Writing Group (500L)",
            "courseCode": "IEE 509", "courseName": "Final Year Project",
            "description": "Peer accountability group for FYP writing, referencing, and presentation.",
            "maxMembers": 5, "meetingDay": "Wednesday", "meetingTime": "18:00",
            "meetingLocation": "Online (Google Meet)", "level": "500L",
            "tags": ["FYP", "Research", "Writing", "LaTeX"], "isOpen": False,
            "createdBy": users.get("ifeoma@stu.ui.edu.ng"), "creatorName": "Ifeoma Nwosu",
            "members": [
                {"userId": users.get("ifeoma@stu.ui.edu.ng"), "firstName": "Ifeoma", "lastName": "Nwosu",
                 "matricNumber": f"{str(YEAR-6)[2:]}/20IP101", "joinedAt": NOW - timedelta(days=7)},
                {"userId": users.get("jide@stu.ui.edu.ng"), "firstName": "Jide", "lastName": "Akinola",
                 "matricNumber": f"{str(YEAR-6)[2:]}/20IP102", "joinedAt": NOW - timedelta(days=7)},
            ],
        },
        {
            "name": "Quality Control Crash Course",
            "courseCode": "IEE 403", "courseName": "Quality Control & Reliability",
            "description": "Exam prep — control charts, acceptance sampling, reliability functions.",
            "maxMembers": 10, "meetingDay": "Friday", "meetingTime": "14:00",
            "meetingLocation": "IE Lab", "level": "400L",
            "tags": ["SPC", "Six Sigma", "Exam Prep"], "isOpen": True,
            "createdBy": users.get("grace@stu.ui.edu.ng"), "creatorName": "Grace Adebayo",
            "members": [
                {"userId": users.get("grace@stu.ui.edu.ng"), "firstName": "Grace", "lastName": "Adebayo",
                 "matricNumber": f"{str(YEAR-5)[2:]}/21IP101", "joinedAt": NOW - timedelta(days=10)},
                {"userId": users.get("hakeem@stu.ui.edu.ng"), "firstName": "Hakeem", "lastName": "Ibrahim",
                 "matricNumber": f"{str(YEAR-5)[2:]}/21IP102", "joinedAt": NOW - timedelta(days=9)},
                {"userId": users.get("tobi@iesa.dev"), "firstName": "Tobi", "lastName": "Adeyemi",
                 "matricNumber": f"{str(YEAR-5)[2:]}/22EE210", "joinedAt": NOW - timedelta(days=8)},
            ],
        },
    ]
    docs = [
        {**g, "createdAt": NOW - timedelta(days=21), "updatedAt": NOW}
        for g in groups if g["createdBy"]
    ]
    if docs:
        await coll.insert_many(docs)
    print(f"   ✓ Study Groups: {len(docs)} active groups")


# ───────────────────────────────────────────────────────────────────────
# Press Articles
# ───────────────────────────────────────────────────────────────────────

async def seed_press_articles(db, session_id: str, users: dict[str, str]):
    """Seed published press articles for the IESA blog."""
    coll = db["press_articles"]
    author_id    = users.get("fatima@stu.ui.edu.ng", users.get("tobi@iesa.dev"))
    author2_id   = users.get("aisha@stu.ui.edu.ng",  author_id)
    reviewer_id  = users.get("tobi@iesa.dev",        users.get("admin@iesa.dev"))

    articles = [
        {
            "title": "IESA Kicks Off 2025/2026 Session with Freshers Night",
            "slug": "iesa-kicks-off-2025-2026-session-with-freshers-night",
            "content": "<p>The IESA Welcome Freshers Night was held on October 5th at Trenchard Hall, University of Ibadan, to a roaring crowd of over 180 students. The event marked the official start of IESA's 2025/2026 academic session activities...</p>",
            "excerpt": "IESA's annual welcome night welcomed over 180 students to the new academic session with music, networking, and prizes.",
            "category": "event_coverage", "tags": ["Freshers Night", "Social", "2025/2026"],
            "coverImageUrl": None, "authorId": author_id, "authorName": "Fatima Yusuf",
            "status": "published", "viewCount": 142, "likeCount": 38, "likedBy": [],
            "publishedAt": NOW - timedelta(days=12), "submittedAt": NOW - timedelta(days=14),
            "reviewedAt": NOW - timedelta(days=13), "reviewedBy": reviewer_id,
        },
        {
            "title": "Opinion: Why Every Industrial Engineer Should Learn Python",
            "slug": "opinion-why-every-industrial-engineer-should-learn-python",
            "content": "<p>In the age of Industry 4.0, data is the new raw material. Python has emerged as the lingua franca of data analysis, simulation, and automation for Industrial Engineers...</p>",
            "excerpt": "Python is increasingly indispensable for modern Industrial Engineers — here's why every IE student at UI should pick it up now.",
            "category": "opinion", "tags": ["Python", "Industry 4.0", "Career"],
            "coverImageUrl": None, "authorId": author2_id, "authorName": "Aisha Bello",
            "status": "published", "viewCount": 97, "likeCount": 22, "likedBy": [],
            "publishedAt": NOW - timedelta(days=8), "submittedAt": NOW - timedelta(days=10),
            "reviewedAt": NOW - timedelta(days=9), "reviewedBy": reviewer_id,
        },
        {
            "title": "Recap: MATLAB & Python Workshop Draws 70+ Students",
            "slug": "recap-matlab-python-workshop-draws-70-students",
            "content": "<p>The IESA MATLAB & Python workshop held on October 22nd drew a larger-than-expected crowd of 73 students from all levels...</p>",
            "excerpt": "Over 70 students attended IESA's annual tech workshop covering MATLAB and Python for engineering applications.",
            "category": "event_coverage", "tags": ["Workshop", "MATLAB", "Python"],
            "coverImageUrl": None, "authorId": author_id, "authorName": "Fatima Yusuf",
            "status": "published", "viewCount": 64, "likeCount": 15, "likedBy": [],
            "publishedAt": NOW - timedelta(days=4), "submittedAt": NOW - timedelta(days=6),
            "reviewedAt": NOW - timedelta(days=5), "reviewedBy": reviewer_id,
        },
        {
            "title": "IESA Departmental Dues: What Your Money Funds",
            "slug": "iesa-departmental-dues-what-your-money-funds",
            "content": "<p>Every year, questions arise about where the IESA departmental dues go. Here is a transparent breakdown of the ₦3,000 budget for 2025/2026...</p>",
            "excerpt": "A transparent breakdown of how your ₦3,000 IESA dues are allocated for the 2025/2026 academic session.",
            "category": "news", "tags": ["Dues", "Transparency", "Finance"],
            "coverImageUrl": None, "authorId": reviewer_id, "authorName": "Tobi Adeyemi",
            "status": "published", "viewCount": 211, "likeCount": 56, "likedBy": [],
            "publishedAt": NOW - timedelta(days=2), "submittedAt": NOW - timedelta(days=3),
            "reviewedAt": NOW - timedelta(days=2), "reviewedBy": reviewer_id,
        },
        {
            "title": "What to Expect as a 100-Level Industrial Engineering Student",
            "slug": "what-to-expect-100-level-industrial-engineering-student",
            "content": "<p>Starting university as a 100-level student can be both exciting and overwhelming. This guide walks you through what to expect in your first year...</p>",
            "excerpt": "Senior students share everything 100-level IE students need to know to thrive in their first year at UI.",
            "category": "campus_life", "tags": ["100L", "Guide", "New Students"],
            "coverImageUrl": None, "authorId": author2_id, "authorName": "Aisha Bello",
            "status": "draft", "viewCount": 0, "likeCount": 0, "likedBy": [],
            "publishedAt": None, "submittedAt": None, "reviewedAt": None, "reviewedBy": None,
        },
    ]
    docs = [{**a, "feedback": [], "sessionId": session_id,
             "createdAt": NOW - timedelta(days=20), "updatedAt": NOW}
            for a in articles]
    await coll.insert_many(docs)
    published = sum(1 for a in articles if a["status"] == "published")
    print(f"   ✓ Press Articles: {len(docs)} ({published} published, {len(docs)-published} draft)")


# ───────────────────────────────────────────────────────────────────────
# Resources
# ───────────────────────────────────────────────────────────────────────

async def seed_resources(db, session_id: str, users: dict[str, str], admin_id: str):
    """Seed library resources (past questions, slides, notes, textbooks, videos)."""
    coll = db["resources"]
    uploader_id  = users.get("tobi@iesa.dev", admin_id)
    uploader2_id = users.get("grace@stu.ui.edu.ng", admin_id)

    resources = [
        {
            "title": "IEE 301 Operations Research I — Past Questions (2020-2024)",
            "description": "Compiled past exam questions for OR I, covering 5 years of semester exams.",
            "type": "pastQuestion", "courseCode": "IEE 301", "level": 300,
            "url": "https://drive.google.com/file/d/sample_or1_pq",
            "driveFileId": None, "youtubeVideoId": None, "fileType": "pdf", "fileSize": 2048000,
            "uploadedBy": uploader_id, "uploaderName": "Tobi Adeyemi",
            "tags": ["Past Questions", "OR I", "Simplex"], "downloadCount": 87, "viewCount": 153,
            "isApproved": True, "approvedBy": admin_id, "feedback": None,
        },
        {
            "title": "IEE 403 Quality Control — Lecture Slides (Dr. Falade)",
            "description": "Full slide set — control charts, OC curves, acceptance sampling.",
            "type": "slide", "courseCode": "IEE 403", "level": 400,
            "url": "https://drive.google.com/file/d/sample_qc_slides",
            "driveFileId": None, "youtubeVideoId": None, "fileType": "pdf", "fileSize": 5120000,
            "uploadedBy": uploader2_id, "uploaderName": "Grace Adebayo",
            "tags": ["Slides", "Quality Control", "SPC"], "downloadCount": 62, "viewCount": 98,
            "isApproved": True, "approvedBy": admin_id, "feedback": None,
        },
        {
            "title": "MTH 201 Mathematical Methods I — Summary Notes",
            "description": "Exam-ready notes on ODE, Laplace Transforms, Fourier Series for 200L students.",
            "type": "note", "courseCode": "MTH 201", "level": 200,
            "url": "https://drive.google.com/file/d/sample_mth201_notes",
            "driveFileId": None, "youtubeVideoId": None, "fileType": "pdf", "fileSize": 1024000,
            "uploadedBy": users.get("aisha@stu.ui.edu.ng", admin_id), "uploaderName": "Aisha Bello",
            "tags": ["Notes", "ODE", "Laplace", "200L"], "downloadCount": 44, "viewCount": 76,
            "isApproved": True, "approvedBy": admin_id, "feedback": None,
        },
        {
            "title": "Introduction to Arena Simulation Software",
            "description": "Tutorial series on Arena — modelling queues, resources, and entities.",
            "type": "video", "courseCode": "IEE 507", "level": 500,
            "url": "https://www.youtube.com/watch?v=example_arena",
            "driveFileId": None, "youtubeVideoId": "example_arena", "fileType": None, "fileSize": None,
            "uploadedBy": uploader_id, "uploaderName": "Tobi Adeyemi",
            "tags": ["Arena", "Simulation", "Video", "500L"], "downloadCount": 0, "viewCount": 121,
            "isApproved": True, "approvedBy": admin_id, "feedback": None,
        },
        {
            "title": "IEE 305 Engineering Statistics — Past Questions (2019-2023)",
            "description": "Past questions covering probability, distributions, hypothesis testing, regression.",
            "type": "pastQuestion", "courseCode": "IEE 305", "level": 300,
            "url": "https://drive.google.com/file/d/sample_stats_pq",
            "driveFileId": None, "youtubeVideoId": None, "fileType": "pdf", "fileSize": 1536000,
            "uploadedBy": users.get("emeka@stu.ui.edu.ng", admin_id), "uploaderName": "Emeka Eze",
            "tags": ["Past Questions", "Statistics", "300L"], "downloadCount": 55, "viewCount": 89,
            "isApproved": True, "approvedBy": admin_id, "feedback": None,
        },
        {
            "title": "Introduction to Industrial Engineering — Textbook (Groover)",
            "description": "Fundamentals of Modern Manufacturing by Groover — recommended for 200L & 300L.",
            "type": "textbook", "courseCode": "IEE 201", "level": 200,
            "url": "https://drive.google.com/file/d/sample_groover_textbook",
            "driveFileId": None, "youtubeVideoId": None, "fileType": "pdf", "fileSize": 25600000,
            "uploadedBy": admin_id, "uploaderName": "Admin User",
            "tags": ["Textbook", "Manufacturing", "Groover", "200L"], "downloadCount": 103, "viewCount": 174,
            "isApproved": True, "approvedBy": admin_id, "feedback": None,
        },
        {
            "title": "IEE 499 SIWES Report Template",
            "description": "Official SIWES report template for 400L students with all required sections.",
            "type": "note", "courseCode": "IEE 499", "level": 400,
            "url": "https://drive.google.com/file/d/sample_siwes_template",
            "driveFileId": None, "youtubeVideoId": None, "fileType": "docx", "fileSize": 512000,
            "uploadedBy": uploader2_id, "uploaderName": "Grace Adebayo",
            "tags": ["SIWES", "Template", "400L"], "downloadCount": 78, "viewCount": 112,
            "isApproved": True, "approvedBy": admin_id, "feedback": None,
        },
    ]
    docs = [{**r, "sessionId": session_id, "createdAt": NOW - timedelta(days=25), "updatedAt": NOW}
            for r in resources]
    await coll.insert_many(docs)
    print(f"   ✓ Resources: {len(docs)} library resources (all approved)")


# ───────────────────────────────────────────────────────────────────────
# TIMP
# ───────────────────────────────────────────────────────────────────────

async def seed_timp(db, session_id: str, users: dict[str, str], admin_id: str):
    """Seed TIMP mentor applications and active pairs."""
    app_coll  = db["timpApplications"]
    pair_coll = db["timpPairs"]

    mentor_apps = [
        {
            "userId": users.get("grace@stu.ui.edu.ng"), "userName": "Grace Adebayo", "userLevel": "400L",
            "motivation": "I want to give back. My seniors mentored me through 300L and I would love to do the same.",
            "skills": "Operations Research, Engineering Statistics, Python, Study skills",
            "availability": "Weekday evenings (5–7pm) and Saturday mornings",
            "maxMentees": 2, "status": "approved",
            "feedback": "Approved. Grace consistently performs well and shows strong communication skills.",
            "sessionId": session_id, "reviewedBy": admin_id,
        },
        {
            "userId": users.get("hakeem@stu.ui.edu.ng"), "userName": "Hakeem Ibrahim", "userLevel": "400L",
            "motivation": "I completed SIWES at Dangote last session and can share practical industry experience.",
            "skills": "Process Engineering, MATLAB, CAD, industry readiness",
            "availability": "Weekends, any time",
            "maxMentees": 2, "status": "approved",
            "feedback": None, "sessionId": session_id, "reviewedBy": admin_id,
        },
        {
            "userId": users.get("fatima@stu.ui.edu.ng"), "userName": "Fatima Yusuf", "userLevel": "300L",
            "motivation": "I have a strong academic record and enjoy explaining concepts. I'd like to mentor 100L and 200L.",
            "skills": "Operations Research, Statistics, Microsoft Office, public speaking",
            "availability": "Tuesdays and Thursdays, 4–6pm",
            "maxMentees": 3, "status": "pending",
            "feedback": None, "sessionId": session_id, "reviewedBy": None,
        },
    ]
    app_docs = [
        {**a, "createdAt": NOW - timedelta(days=18), "updatedAt": NOW}
        for a in mentor_apps if a["userId"]
    ]
    if app_docs:
        await app_coll.insert_many(app_docs)

    pairs = [
        {
            "mentorId": users.get("grace@stu.ui.edu.ng"), "mentorName": "Grace Adebayo",
            "menteeId": users.get("aisha@stu.ui.edu.ng"), "menteeName": "Aisha Bello",
            "status": "active", "sessionId": session_id, "feedbackCount": 2,
        },
        {
            "mentorId": users.get("grace@stu.ui.edu.ng"), "mentorName": "Grace Adebayo",
            "menteeId": users.get("chidi@stu.ui.edu.ng"), "menteeName": "Chidi Okonkwo",
            "status": "active", "sessionId": session_id, "feedbackCount": 1,
        },
        {
            "mentorId": users.get("hakeem@stu.ui.edu.ng"), "mentorName": "Hakeem Ibrahim",
            "menteeId": users.get("fatima@stu.ui.edu.ng"), "menteeName": "Fatima Yusuf",
            "status": "active", "sessionId": session_id, "feedbackCount": 0,
        },
    ]
    pair_docs = [
        {**p, "createdAt": NOW - timedelta(days=14), "updatedAt": NOW}
        for p in pairs if p["mentorId"] and p["menteeId"]
    ]
    if pair_docs:
        await pair_coll.insert_many(pair_docs)
    print(f"   ✓ TIMP: {len(app_docs)} mentor applications, {len(pair_docs)} pairs")


# ───────────────────────────────────────────────────────────────────────
# Unit Applications
# ───────────────────────────────────────────────────────────────────────

async def seed_unit_applications(db, session_id: str, users: dict[str, str], admin_id: str):
    """Seed unit/committee applications."""
    coll = db["unitApplications"]
    applications = [
        {
            "userId": users.get("aisha@stu.ui.edu.ng"), "userName": "Aisha Bello",
            "userEmail": "aisha@stu.ui.edu.ng", "userLevel": "200L",
            "unit": "press", "unitLabel": "IESA Press",
            "motivation": "I love writing and storytelling. I want to document IESA's activities.",
            "skills": "Creative writing, Photography, Social media management",
            "status": "accepted", "feedback": "Welcome to the Press Unit!",
            "reviewedBy": users.get("tobi@iesa.dev"), "reviewerName": "Tobi Adeyemi",
            "sessionId": session_id, "reviewedAt": NOW - timedelta(days=12),
        },
        {
            "userId": users.get("chidi@stu.ui.edu.ng"), "userName": "Chidi Okonkwo",
            "userEmail": "chidi@stu.ui.edu.ng", "userLevel": "200L",
            "unit": "committee_sports", "unitLabel": "Sports Committee",
            "motivation": "I am an active footballer and want to help organise inter-level sports events.",
            "skills": "Sports coordination, Event planning",
            "status": "accepted", "feedback": None,
            "reviewedBy": admin_id, "reviewerName": "Admin User",
            "sessionId": session_id, "reviewedAt": NOW - timedelta(days=10),
        },
        {
            "userId": users.get("ngozi@stu.ui.edu.ng"), "userName": "Ngozi Chukwuma",
            "userEmail": "ngozi@stu.ui.edu.ng", "userLevel": "100L",
            "unit": "committee_academic", "unitLabel": "Academic Committee",
            "motivation": "As a fresh student I want to help organise study sessions and collate past questions.",
            "skills": "Research, Microsoft Office, Enthusiasm",
            "status": "pending", "feedback": None,
            "reviewedBy": None, "reviewerName": None,
            "sessionId": session_id, "reviewedAt": None,
        },
        {
            "userId": users.get("lekan@stu.ui.edu.ng"), "userName": "Lekan Alabi",
            "userEmail": "lekan@stu.ui.edu.ng", "userLevel": "100L",
            "unit": "committee_welfare", "unitLabel": "Welfare Committee",
            "motivation": "I am empathetic and want to support student welfare initiatives.",
            "skills": "Compassion, Communication",
            "status": "pending", "feedback": None,
            "reviewedBy": None, "reviewerName": None,
            "sessionId": session_id, "reviewedAt": None,
        },
    ]
    docs = [
        {**a, "createdAt": NOW - timedelta(days=15), "updatedAt": NOW}
        for a in applications if a["userId"]
    ]
    if docs:
        await coll.insert_many(docs)
    accepted = sum(1 for a in docs if a["status"] == "accepted")
    pending  = sum(1 for a in docs if a["status"] == "pending")
    print(f"   ✓ Unit Applications: {len(docs)} ({accepted} accepted, {pending} pending)")


# ───────────────────────────────────────────────────────────────────────
# Previous-Session Archive Data
# ───────────────────────────────────────────────────────────────────────

async def seed_previous_session_data(db, prev_session_id: str, users: dict[str, str], admin_id: str):
    """Seed 2024/2025 events and announcements for the archive page."""
    ann_coll   = db["announcements"]
    event_coll = db["events"]

    prev_anns = [
        {"title": "Welcome to the 2024/2025 Academic Session",
         "content": "Dear students, welcome back! The IESA exco is ready to serve you this session.",
         "priority": "high", "isPinned": True, "targetLevels": None},
        {"title": "2024/2025 Dues Payment Open",
         "content": "Payment of IESA departmental dues is now open. Amount: ₦3,000. Deadline: 30 Nov 2024.",
         "priority": "urgent", "isPinned": False, "targetLevels": None},
        {"title": "Semester 1 Exam Timetable Released",
         "content": "The Semester 1 timetable for 2024/2025 has been released. Check the portal.",
         "priority": "urgent", "isPinned": True, "targetLevels": None},
        {"title": "SIWES Forms — 400 Level",
         "content": "400L students must collect SIWES forms from the IT coordinator by Friday.",
         "priority": "high", "isPinned": False, "targetLevels": ["400L"]},
    ]
    ann_docs = []
    for i, a in enumerate(prev_anns):
        ann_docs.append({
            **a, "sessionId": prev_session_id, "authorId": admin_id,
            "authorName": "Admin User", "readBy": list(users.values()),
            "expiresAt": None,
            "createdAt": _dt(2024, 9, 20) + timedelta(days=i * 7),
            "updatedAt": _dt(2025, 1, 1),
        })
    await ann_coll.insert_many(ann_docs)

    prev_events = [
        {
            "title": "IESA Freshers Night 2024", "category": "Social",
            "description": "Welcome event for the incoming 100L class of 2024.",
            "date": _dt(2024, 10, 6, 18, 0), "location": "Trenchard Hall, University of Ibadan",
            "maxAttendees": 200, "requiresPayment": False,
            "registrations": [], "attendees": [], "imageUrl": None,
        },
        {
            "title": "Industrial Visit — Nestle Nigeria (Flowergate)", "category": "Career",
            "description": "IESA industrial visit to the Nestle Nigeria manufacturing plant in Sagamu.",
            "date": _dt(2024, 11, 23, 7, 0), "location": "Flowergate Factory, Sagamu, Ogun State",
            "maxAttendees": 45, "requiresPayment": True, "paymentAmount": 4500.0,
            "registrations": [], "attendees": [], "imageUrl": None,
        },
    ]
    event_docs = [
        {**e, "sessionId": prev_session_id, "createdBy": admin_id,
         "createdAt": _dt(2024, 9, 15), "updatedAt": _dt(2025, 1, 1)}
        for e in prev_events
    ]
    await event_coll.insert_many(event_docs)

    print(f"   ✓ Previous session (2024/2025): {len(ann_docs)} announcements, {len(event_docs)} events")


# ───────────────────────────────────────────────────────────────────────
# Collections to clear
# ───────────────────────────────────────────────────────────────────────

COLLECTIONS_TO_CLEAR = [
    "users", "sessions", "enrollments", "roles", "payments", "events",
    "announcements", "grades", "refresh_tokens", "audit_logs",
    "academicEvents", "classSessions", "classCancellations",
    "contact_messages", "resources", "press_articles",
    "timpApplications", "timpPairs", "timpFeedbacks",
    "iepodRegistrations", "iepodSocieties", "iepodQuizzes",
    "iepodTeams", "iepodSubmissions", "iepodPoints",
    "bankAccounts", "bankTransfers",
    "unitApplications",
    "notifications",
    "study_groups",
]


async def clear_collections(db, keep_users: bool = False):
    """Drop data from all known collections."""
    print("\n🗑️  Clearing collections...")
    for name in COLLECTIONS_TO_CLEAR:
        if keep_users and name == "users":
            continue
        result = await db[name].delete_many({})
        if result.deleted_count > 0:
            print(f"   ✓ {name}: {result.deleted_count} deleted")


async def main():
    parser = argparse.ArgumentParser(description="Seed IESA platform with rich dummy data")
    parser.add_argument("--fresh",    action="store_true", help="Clear ALL data first (including users)")
    parser.add_argument("--no-users", action="store_true", help="Skip user creation (reuse existing)")
    args = parser.parse_args()

    load_dotenv()
    mongo_url = os.getenv("MONGODB_URL") or os.getenv("MONGO_URL") or "mongodb://localhost:27017"
    db_name   = os.getenv("DATABASE_NAME") or os.getenv("DB_NAME") or "iesa"

    print(f"\n{'=' * 60}")
    print(f"  IESA Dummy Data Seed Script")
    print(f"{'=' * 60}")
    print(f"  Database: {db_name}")
    print(f"  MongoDB:  {mongo_url}")
    print(f"  Mode:     {'Fresh (clear all)' if args.fresh else 'Incremental'}")

    if args.fresh:
        confirm = input("\n⚠️  This will DELETE ALL data. Type 'yes' to continue: ")
        if confirm.lower() != "yes":
            print("Aborted.")
            sys.exit(0)

    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]

    try:
        # ── Clear ──────────────────────────────────────────────
        if args.fresh:
            await clear_collections(db, keep_users=False)
        else:
            await clear_collections(db, keep_users=True)

        # ── Sessions ───────────────────────────────────────────
        print("\n📅 Seeding sessions...")
        prev_session_id, curr_session_id = await seed_sessions(db)

        # ── Users ──────────────────────────────────────────────
        if args.no_users:
            print("\n👤 Skipping user creation (--no-users)")
            user_lookup: dict[str, str] = {}
            async for u in db["users"].find({}):
                user_lookup[u["email"]] = str(u["_id"])
            if not user_lookup:
                print("   ⚠️  No existing users found! Run without --no-users first.")
                sys.exit(1)
            admin_id = user_lookup.get("admin@iesa.dev", list(user_lookup.values())[0])
        else:
            print("\n👤 Seeding users...")
            user_lookup = await seed_users(db)
            admin_id = user_lookup["admin@iesa.dev"]

        # ── Enrollments ────────────────────────────────────────
        print("\n📝 Seeding enrollments...")
        await seed_enrollments(db, curr_session_id, user_lookup)

        # ── Roles ──────────────────────────────────────────────
        print("\n🏷️  Seeding roles...")
        await seed_roles(db, curr_session_id, user_lookup)

        # ── Events ─────────────────────────────────────────────
        print("\n📆 Seeding events (current session)...")
        await seed_events(db, curr_session_id, admin_id)

        # ── Announcements ──────────────────────────────────────
        print("\n📢 Seeding announcements (current session)...")
        await seed_announcements(db, curr_session_id, admin_id)

        # ── Payments ───────────────────────────────────────────
        print("\n💰 Seeding payments...")
        await seed_payments(db, curr_session_id, user_lookup)

        # ── Academic Calendar ──────────────────────────────────
        print("\n🗓️  Seeding academic calendar...")
        await seed_academic_calendar(db, curr_session_id, admin_id)

        # ── Timetable ──────────────────────────────────────────
        print("\n🕐 Seeding timetable...")
        await seed_timetable(db, curr_session_id, admin_id)

        # ── Grades (current session) ───────────────────────────
        print("\n📊 Seeding grades (current session)...")
        await seed_grades(db, curr_session_id, user_lookup)

        # ── Bank Accounts ──────────────────────────────────────
        print("\n🏦 Seeding bank accounts...")
        bank_account_ids = await seed_bank_accounts(db, admin_id)

        # ── Bank Transfers ─────────────────────────────────────
        print("\n💸 Seeding bank transfer submissions...")
        await seed_bank_transfers(db, curr_session_id, user_lookup, bank_account_ids)

        # ── Notifications ──────────────────────────────────────
        print("\n🔔 Seeding notifications...")
        await seed_notifications(db, user_lookup)

        # ── Study Groups ───────────────────────────────────────
        print("\n👥 Seeding study groups...")
        await seed_study_groups(db, user_lookup)

        # ── Press Articles ─────────────────────────────────────
        print("\n📰 Seeding press articles...")
        await seed_press_articles(db, curr_session_id, user_lookup)

        # ── Resources ──────────────────────────────────────────
        print("\n📚 Seeding library resources...")
        await seed_resources(db, curr_session_id, user_lookup, admin_id)

        # ── TIMP ───────────────────────────────────────────────
        print("\n🤝 Seeding TIMP (mentoring)...")
        await seed_timp(db, curr_session_id, user_lookup, admin_id)

        # ── Unit Applications ──────────────────────────────────
        print("\n📋 Seeding unit applications...")
        await seed_unit_applications(db, curr_session_id, user_lookup, admin_id)

        # ── Previous Session Archive Data ──────────────────────
        print("\n🗂️  Seeding previous session archive data (2024/2025)...")
        await seed_previous_session_data(db, prev_session_id, user_lookup, admin_id)

        # ── Grades (previous session) ──────────────────────────
        print("\n📊 Seeding grades (previous session 2024/2025)...")
        await seed_grades(db, prev_session_id, user_lookup, "(2024/2025)")

        # ── Summary ────────────────────────────────────────────
        print(f"\n{'=' * 60}")
        print(f"  ✅ Seed complete!")
        print(f"{'=' * 60}")
        print(f"\n  Login credentials (all use: Password1!):")
        print(f"    Admin:   admin@iesa.dev")
        print(f"    ExCo:    tobi@iesa.dev           (President, 400L)")
        print(f"    Student: aisha@stu.ui.edu.ng      (200L, Class Rep)")
        print(f"    Student: fatima@stu.ui.edu.ng     (300L, PRO)")
        print(f"    Student: grace@stu.ui.edu.ng      (400L, Gen. Sec.)")
        print(f"    Student: ifeoma@stu.ui.edu.ng     (500L, Class Rep)")
        print(f"    Student: kemi@stu.ui.edu.ng       (100L, Class Rep)")
        print(f"\n  Active session: 2025/2026")
        print(f"  Archive session: 2024/2025 (events, announcements, grades)")
        print()

    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
    finally:
        client.close()


if __name__ == "__main__":
    asyncio.run(main())
