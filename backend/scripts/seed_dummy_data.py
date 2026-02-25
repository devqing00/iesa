#!/usr/bin/env python3
"""
Comprehensive Dummy-Data Seed Script for IESA Platform

Seeds: sessions, users, enrollments, roles, events, announcements, payments,
       academic calendar, timetable classes, grades.

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


# ───────────────────────────────────────────────────────────────────────
# Data generators
# ───────────────────────────────────────────────────────────────────────

async def seed_sessions(db) -> tuple[str, str]:
    """Create two sessions: current (active) and previous."""
    coll = db["sessions"]

    prev_name = f"{YEAR - 1}/{YEAR}"
    curr_name = f"{YEAR}/{YEAR + 1}"

    prev = {
        "name": prev_name,
        "semester1StartDate": _dt(YEAR - 1, 9, 15),
        "semester1EndDate": _dt(YEAR, 1, 31),
        "semester2StartDate": _dt(YEAR, 2, 10),
        "semester2EndDate": _dt(YEAR, 7, 31),
        "isActive": False,
        "createdAt": NOW,
        "updatedAt": NOW,
    }
    curr = {
        "name": curr_name,
        "semester1StartDate": _dt(YEAR, 9, 15),
        "semester1EndDate": _dt(YEAR + 1, 1, 31),
        "semester2StartDate": _dt(YEAR + 1, 2, 10),
        "semester2EndDate": _dt(YEAR + 1, 7, 31),
        "isActive": True,
        "createdAt": NOW,
        "updatedAt": NOW,
    }

    prev_id = (await coll.insert_one(prev)).inserted_id
    curr_id = (await coll.insert_one(curr)).inserted_id
    print(f"   ✓ Sessions: {prev_name} (inactive), {curr_name} (active)")
    return str(prev_id), str(curr_id)


async def seed_users(db) -> dict[str, str]:
    """Create admin + 15 students. Returns {email: id}."""
    coll = db["users"]
    pwd_hash = hash_password("Password1!")

    users = [
        # Admin
        {"firstName": "Admin", "lastName": "User", "email": "admin@iesa.dev",
         "role": "admin", "matricNumber": None, "admissionYear": None,
         "currentLevel": None, "isActive": True, "emailVerified": True},
        # ExCo user
        {"firstName": "Tobi", "lastName": "Adeyemi", "email": "tobi@iesa.dev",
         "role": "exco", "matricNumber": "210401", "admissionYear": YEAR - 3,
         "currentLevel": "400L", "isActive": True, "emailVerified": True},
        # Students – varied levels
        {"firstName": "Aisha", "lastName": "Bello", "email": "aisha@student.ui.edu.ng",
         "role": "student", "matricNumber": "230101", "admissionYear": YEAR - 1,
         "currentLevel": "200L"},
        {"firstName": "Chidi", "lastName": "Okonkwo", "email": "chidi@student.ui.edu.ng",
         "role": "student", "matricNumber": "230102", "admissionYear": YEAR - 1,
         "currentLevel": "200L"},
        {"firstName": "Fatima", "lastName": "Yusuf", "email": "fatima@student.ui.edu.ng",
         "role": "student", "matricNumber": "220201", "admissionYear": YEAR - 2,
         "currentLevel": "300L"},
        {"firstName": "Emeka", "lastName": "Eze", "email": "emeka@student.ui.edu.ng",
         "role": "student", "matricNumber": "220202", "admissionYear": YEAR - 2,
         "currentLevel": "300L"},
        {"firstName": "Grace", "lastName": "Adebayo", "email": "grace@student.ui.edu.ng",
         "role": "student", "matricNumber": "210301", "admissionYear": YEAR - 3,
         "currentLevel": "400L"},
        {"firstName": "Hakeem", "lastName": "Ibrahim", "email": "hakeem@student.ui.edu.ng",
         "role": "student", "matricNumber": "210302", "admissionYear": YEAR - 3,
         "currentLevel": "400L"},
        {"firstName": "Ifeoma", "lastName": "Nwosu", "email": "ifeoma@student.ui.edu.ng",
         "role": "student", "matricNumber": "200401", "admissionYear": YEAR - 4,
         "currentLevel": "500L"},
        {"firstName": "Jide", "lastName": "Akinola", "email": "jide@student.ui.edu.ng",
         "role": "student", "matricNumber": "200402", "admissionYear": YEAR - 4,
         "currentLevel": "500L"},
        {"firstName": "Kemi", "lastName": "Oladipo", "email": "kemi@student.ui.edu.ng",
         "role": "student", "matricNumber": "240501", "admissionYear": YEAR,
         "currentLevel": "100L"},
        {"firstName": "Lekan", "lastName": "Alabi", "email": "lekan@student.ui.edu.ng",
         "role": "student", "matricNumber": "240502", "admissionYear": YEAR,
         "currentLevel": "100L"},
        {"firstName": "Ngozi", "lastName": "Chukwuma", "email": "ngozi@student.ui.edu.ng",
         "role": "student", "matricNumber": "240503", "admissionYear": YEAR,
         "currentLevel": "100L"},
        {"firstName": "Pelumi", "lastName": "Afolabi", "email": "pelumi@student.ui.edu.ng",
         "role": "student", "matricNumber": "220203", "admissionYear": YEAR - 2,
         "currentLevel": "300L"},
        {"firstName": "Quincy", "lastName": "Ogundele", "email": "quincy@student.ui.edu.ng",
         "role": "student", "matricNumber": "230103", "admissionYear": YEAR - 1,
         "currentLevel": "200L"},
    ]

    docs = []
    for u in users:
        docs.append({
            **u,
            "password": pwd_hash,
            "isActive": u.get("isActive", True),
            "emailVerified": u.get("emailVerified", True),
            "profilePhotoURL": None,
            "googleId": None,
            "createdAt": NOW - timedelta(days=120),
            "updatedAt": NOW,
        })

    result = await coll.insert_many(docs)
    lookup = {}
    for i, doc_id in enumerate(result.inserted_ids):
        lookup[users[i]["email"]] = str(doc_id)

    print(f"   ✓ Users: 1 admin, 1 exco, {len(users) - 2} students (password: Password1!)")
    return lookup


async def seed_enrollments(db, session_id: str, users: dict[str, str]):
    """Enrol every student in the active session."""
    coll = db["enrollments"]
    student_emails = [e for e in users if e not in ("admin@iesa.dev",)]
    docs = []
    levels = {
        "aisha": "200L", "chidi": "200L", "fatima": "300L", "emeka": "300L",
        "grace": "400L", "hakeem": "400L", "ifeoma": "500L", "jide": "500L",
        "kemi": "100L", "lekan": "100L", "ngozi": "100L", "pelumi": "300L",
        "quincy": "200L", "tobi": "400L",
    }
    for email in student_emails:
        first = email.split("@")[0]
        level = levels.get(first, "200L")
        docs.append({
            "studentId": users[email],
            "sessionId": session_id,
            "level": level,
            "createdAt": NOW - timedelta(days=30),
            "updatedAt": NOW,
        })
    if docs:
        await coll.insert_many(docs)
    print(f"   ✓ Enrollments: {len(docs)} students enrolled")


async def seed_roles(db, session_id: str, users: dict[str, str]):
    """Assign key ExCo roles."""
    coll = db["roles"]
    roles_map = [
        ("tobi@iesa.dev", "president"),
        ("grace@student.ui.edu.ng", "general_secretary"),
        ("emeka@student.ui.edu.ng", "financial_secretary"),
        ("fatima@student.ui.edu.ng", "pro"),
        ("hakeem@student.ui.edu.ng", "class_rep_400L"),
        ("aisha@student.ui.edu.ng", "class_rep_200L"),
        ("pelumi@student.ui.edu.ng", "class_rep_300L"),
        ("kemi@student.ui.edu.ng", "class_rep_100L"),
        ("ifeoma@student.ui.edu.ng", "class_rep_500L"),
    ]
    docs = []
    for email, position in roles_map:
        uid = users.get(email)
        if uid:
            docs.append({
                "userId": uid,
                "sessionId": session_id,
                "position": position,
                "permissions": [],  # Uses DEFAULT_PERMISSIONS for the position
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


async def seed_payments(db, session_id: str):
    """Create departmental payment dues."""
    coll = db["payments"]
    payments = [
        {
            "title": "IESA Departmental Dues",
            "amount": 3000.0,
            "category": "Dues",
            "mandatory": True,
            "deadline": _dt(YEAR, 11, 30, 23, 59),
            "description": "Annual departmental dues for all Industrial Engineering students.",
        },
        {
            "title": "Faculty of Technology Tee-Shirt",
            "amount": 5500.0,
            "category": "Merchandise",
            "mandatory": False,
            "deadline": _dt(YEAR, 12, 15, 23, 59),
            "description": "Official Faculty of Technology branded t-shirt collection.",
        },
        {
            "title": "Industrial Visit Fee — Dangote Refinery",
            "amount": 5000.0,
            "category": "Event",
            "mandatory": False,
            "deadline": _dt(YEAR, 11, 10, 23, 59),
            "description": "Covers transportation and logistics for the refinery visit.",
        },
    ]
    docs = []
    for p in payments:
        docs.append({
            **p,
            "sessionId": session_id,
            "paidBy": [],
            "createdAt": NOW - timedelta(days=20),
            "updatedAt": NOW,
        })
    await coll.insert_many(docs)
    print(f"   ✓ Payments: {len(docs)} payment dues")


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


async def seed_grades(db, session_id: str, users: dict[str, str]):
    """Seed sample grade records for students."""
    coll = db["grades"]
    # Give a few students some grade data
    grade_data = [
        ("aisha@student.ui.edu.ng", "200L", [
            {"courseCode": "IEE 201", "courseTitle": "Intro to IE", "creditUnits": 3, "grade": "A"},
            {"courseCode": "MEE 201", "courseTitle": "Engineering Drawing", "creditUnits": 3, "grade": "B"},
            {"courseCode": "MTH 201", "courseTitle": "Mathematical Methods I", "creditUnits": 3, "grade": "A"},
        ]),
        ("fatima@student.ui.edu.ng", "300L", [
            {"courseCode": "IEE 301", "courseTitle": "Operations Research I", "creditUnits": 3, "grade": "A"},
            {"courseCode": "IEE 303", "courseTitle": "Ergonomics", "creditUnits": 3, "grade": "B"},
            {"courseCode": "IEE 305", "courseTitle": "Engineering Statistics", "creditUnits": 3, "grade": "A"},
        ]),
        ("grace@student.ui.edu.ng", "400L", [
            {"courseCode": "IEE 401", "courseTitle": "Operations Research II", "creditUnits": 3, "grade": "B"},
            {"courseCode": "IEE 403", "courseTitle": "Quality Control", "creditUnits": 3, "grade": "A"},
            {"courseCode": "IEE 405", "courseTitle": "Systems Engineering", "creditUnits": 3, "grade": "B"},
        ]),
    ]

    docs = []
    for email, level, courses in grade_data:
        uid = users.get(email)
        if uid:
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
    print(f"   ✓ Grades: {len(docs)} student grade records")


# ───────────────────────────────────────────────────────────────────────
# Main
# ───────────────────────────────────────────────────────────────────────

COLLECTIONS_TO_CLEAR = [
    "users", "sessions", "enrollments", "roles", "payments", "events",
    "announcements", "grades", "refresh_tokens", "audit_logs",
    "academicEvents", "classSessions", "classCancellations",
    "contact_messages", "resources", "press_articles",
    "timpApplications", "timpPairs",
    "iepodRegistrations", "iepodSocieties", "iepodQuizzes",
    "iepodTeams", "iepodSubmissions", "iepodPoints",
    "bankAccounts", "bankTransfers",
    "unitApplications",
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
    parser.add_argument("--fresh", action="store_true", help="Clear ALL data first (including users)")
    parser.add_argument("--no-users", action="store_true", help="Skip user creation (reuse existing)")
    args = parser.parse_args()

    load_dotenv()
    mongo_url = os.getenv("MONGODB_URL") or os.getenv("MONGO_URL") or "mongodb://localhost:27017"
    db_name = os.getenv("DATABASE_NAME") or os.getenv("DB_NAME") or "iesa"

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
        # ── Clear ──
        if args.fresh:
            await clear_collections(db, keep_users=False)
        else:
            await clear_collections(db, keep_users=True)

        # ── Sessions ──
        print("\n📅 Seeding sessions...")
        prev_session_id, curr_session_id = await seed_sessions(db)

        # ── Users ──
        if args.no_users:
            print("\n👤 Skipping user creation (--no-users)")
            # Build lookup from existing users
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

        # ── Enrollments ──
        print("\n📝 Seeding enrollments...")
        await seed_enrollments(db, curr_session_id, user_lookup)

        # ── Roles ──
        print("\n🏷️  Seeding roles...")
        await seed_roles(db, curr_session_id, user_lookup)

        # ── Events ──
        print("\n📆 Seeding events...")
        await seed_events(db, curr_session_id, admin_id)

        # ── Announcements ──
        print("\n📢 Seeding announcements...")
        await seed_announcements(db, curr_session_id, admin_id)

        # ── Payments ──
        print("\n💰 Seeding payments...")
        await seed_payments(db, curr_session_id)

        # ── Academic Calendar ──
        print("\n🗓️  Seeding academic calendar...")
        await seed_academic_calendar(db, curr_session_id, admin_id)

        # ── Timetable ──
        print("\n🕐 Seeding timetable...")
        await seed_timetable(db, curr_session_id, admin_id)

        # ── Grades ──
        print("\n📊 Seeding grades...")
        await seed_grades(db, curr_session_id, user_lookup)

        # ── Summary ──
        print(f"\n{'=' * 60}")
        print(f"  ✅ Seed complete!")
        print(f"{'=' * 60}")
        print(f"\n  Login credentials:")
        print(f"    Admin:   admin@iesa.dev / Password1!")
        print(f"    ExCo:    tobi@iesa.dev / Password1!")
        print(f"    Student: aisha@student.ui.edu.ng / Password1!")
        print(f"\n  Active session: {YEAR}/{YEAR + 1}")
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
