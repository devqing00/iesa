#!/usr/bin/env python3
"""
Comprehensive Dummy-Data Seed Script for IESA Platform

Seeds: sessions, users (dual-email + notification prefs), enrollments, roles,
       events, announcements, payments, academic calendar, timetable,
       bank accounts, bank transfers, notifications,
       study groups, press articles, library resources, TIMP mentor
       applications + pairs, unit applications, and previous-session archive data.

Usage:
    python scripts/seed_dummy_data.py              # Seed everything (keeps existing users)
    python scripts/seed_dummy_data.py --fresh       # Clear ALL data first, then seed
    python scripts/seed_dummy_data.py --no-users    # Skip user creation

⚠️  Requires the backend venv (motor, python-dotenv).
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

# NOTE: Passwords handled by Firebase Auth — no passwordHash fields needed

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
        "currentSemester": 2,
        "isActive": True,
        "createdAt": _dt(2025, 8, 1),
        "updatedAt": NOW,
    }

    prev_id = (await coll.insert_one(prev)).inserted_id
    curr_id = (await coll.insert_one(curr)).inserted_id
    print(f"   ✓ Sessions: 2024/2025 (inactive), 2025/2026 (active)")
    return str(prev_id), str(curr_id)


async def seed_users(db) -> dict[str, str]:
    """Create admin + exco + students. Returns {email: id}."""
    coll = db["users"]
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
        # ── ExCo ─────────────────────────────────────────────
        {
            "firstName": "Tobi", "lastName": "Adeyemi",
            "email": "tobi@iesa.dev",
            "role": "exco",
            "matricNumber": f"{str(YEAR-5)[2:]}/22EE210",
            "admissionYear": YEAR - 3,
            "currentLevel": "400L",
            "department": "Industrial Engineering",
            "phone": "+2348012345678",
            "bio": "President of IESA. 400L student passionate about operations research and lean manufacturing.",
            "skills": ["Leadership", "Operations Research", "MATLAB", "Lean Manufacturing"],
            "emailType": "personal",
            "secondaryEmail": "tobi.adeyemi@stu.ui.edu.ng",
            "secondaryEmailType": "institutional",
            "secondaryEmailVerified": True,
            "notificationEmailPreference": "both",
            "notificationChannelPreference": "both",
            "isActive": True, "emailVerified": True,
        },
        {
            "firstName": "Emeka", "lastName": "Eze",
            "email": "emeka@iesa.dev",
            "role": "exco",
            "matricNumber": f"{str(YEAR-4)[2:]}/22IP102",
            "admissionYear": YEAR - 2,
            "currentLevel": "300L",
            "department": "Industrial Engineering",
            "phone": "+2348045678901",
            "bio": "Financial Secretary of IESA, 300L. Tracking every kobo for transparency.",
            "skills": ["Excel", "QuickBooks", "Lean Manufacturing", "Budgeting"],
            "emailType": "personal",
            "secondaryEmail": "emeka.eze@stu.ui.edu.ng",
            "secondaryEmailType": "institutional",
            "secondaryEmailVerified": True,
            "notificationEmailPreference": "both",
            "notificationChannelPreference": "both",
            "isActive": True, "emailVerified": True,
        },
        {
            "firstName": "Fatima", "lastName": "Yusuf",
            "email": "fatima@iesa.dev",
            "role": "exco",
            "matricNumber": f"{str(YEAR-4)[2:]}/22IP101",
            "admissionYear": YEAR - 2,
            "currentLevel": "300L",
            "department": "Industrial Engineering",
            "phone": "+2348034567890",
            "bio": "IESA PRO, 300L. Loves writing, communications, and brand building.",
            "skills": ["Public Relations", "Canva", "Microsoft Office", "R", "Statistics"],
            "emailType": "personal",
            "secondaryEmail": "fatima.yusuf@stu.ui.edu.ng",
            "secondaryEmailType": "institutional",
            "secondaryEmailVerified": True,
            "notificationEmailPreference": "both",
            "notificationChannelPreference": "email",
            "isActive": True, "emailVerified": True,
        },
        {
            "firstName": "Grace", "lastName": "Adebayo",
            "email": "grace@iesa.dev",
            "role": "exco",
            "matricNumber": f"{str(YEAR-5)[2:]}/21IP101",
            "admissionYear": YEAR - 3,
            "currentLevel": "400L",
            "department": "Industrial Engineering",
            "phone": "+2348056789012",
            "bio": "General Secretary of IESA. FYP focused on supply chain optimisation in Nigerian SMEs.",
            "skills": ["Supply Chain", "Python", "Arena Simulation", "LaTeX", "Research"],
            "emailType": "personal",
            "secondaryEmail": "grace.adebayo@stu.ui.edu.ng",
            "secondaryEmailType": "institutional",
            "secondaryEmailVerified": True,
            "notificationEmailPreference": "both",
            "notificationChannelPreference": "both",
            "isActive": True, "emailVerified": True,
        },
        {
            "firstName": "Hakeem", "lastName": "Ibrahim",
            "email": "hakeem@iesa.dev",
            "role": "exco",
            "matricNumber": f"{str(YEAR-5)[2:]}/21IP102",
            "admissionYear": YEAR - 3,
            "currentLevel": "400L",
            "department": "Industrial Engineering",
            "phone": "+2348099887766",
            "bio": "IESA Social Director, 400L. Organised SIWES at Dangote Group. Loves AutoCAD and process mapping.",
            "skills": ["Process Engineering", "AutoCAD", "MATLAB", "Event Planning"],
            "emailType": "personal",
            "secondaryEmail": "hakeem.ibrahim@stu.ui.edu.ng",
            "secondaryEmailType": "institutional",
            "secondaryEmailVerified": True,
            "notificationEmailPreference": "both",
            "notificationChannelPreference": "both",
            "isActive": True, "emailVerified": True,
        },
        {
            "firstName": "Ifeoma", "lastName": "Nwosu",
            "email": "ifeoma@iesa.dev",
            "role": "exco",
            "matricNumber": f"{str(YEAR-6)[2:]}/20IP101",
            "admissionYear": YEAR - 4,
            "currentLevel": "500L",
            "department": "Industrial Engineering",
            "phone": "+2348067890123",
            "bio": "IESA Academic Director, 500L. FYP on facility layout optimisation. Lean Six Sigma Green Belt.",
            "skills": ["Facility Planning", "AutoPlant", "Lean Six Sigma", "Research", "Python"],
            "emailType": "personal",
            "secondaryEmail": "ifeoma.nwosu@stu.ui.edu.ng",
            "secondaryEmailType": "institutional",
            "secondaryEmailVerified": True,
            "notificationEmailPreference": "both",
            "notificationChannelPreference": "both",
            "isActive": True, "emailVerified": True,
        },
        # ── Students — 500L ───────────────────────────────────
        {
            "firstName": "Jide", "lastName": "Akinola",
            "email": "jide@stu.ui.edu.ng",
            "role": "student",
            "matricNumber": f"{str(YEAR-6)[2:]}/20IP102",
            "admissionYear": YEAR - 4,
            "currentLevel": "500L",
            "department": "Industrial Engineering",
            "phone": None, "bio": "500L student, writing FYP on demand forecasting for FMCG.",
            "skills": ["Operations Management", "SPSS", "Excel"],
            "emailType": "institutional",
            "secondaryEmail": None, "secondaryEmailType": None,
            "secondaryEmailVerified": False,
            "notificationEmailPreference": "primary",
            "notificationChannelPreference": "both",
        },
        {
            "firstName": "Amira", "lastName": "Hassan",
            "email": "amira@stu.ui.edu.ng",
            "role": "student",
            "matricNumber": f"{str(YEAR-6)[2:]}/20IP103",
            "admissionYear": YEAR - 4,
            "currentLevel": "500L",
            "department": "Industrial Engineering",
            "phone": "+2347061234567",
            "bio": "500L. Research interest: healthcare logistics and hospital layout.",
            "skills": ["Healthcare IE", "Simulation", "AutoCAD", "Python"],
            "emailType": "institutional",
            "secondaryEmail": "amirahassan20@gmail.com",
            "secondaryEmailType": "personal",
            "secondaryEmailVerified": True,
            "notificationEmailPreference": "both",
            "notificationChannelPreference": "both",
        },
        # ── Students — 400L ───────────────────────────────────
        {
            "firstName": "Bolaji", "lastName": "Oduya",
            "email": "bolaji@stu.ui.edu.ng",
            "role": "student",
            "matricNumber": f"{str(YEAR-5)[2:]}/21IP103",
            "admissionYear": YEAR - 3,
            "currentLevel": "400L",
            "department": "Industrial Engineering",
            "phone": "+2348071234567",
            "bio": "400L student. Loves systems engineering and IoT integration.",
            "skills": ["Systems Engineering", "IoT", "Arduino", "Python"],
            "emailType": "institutional",
            "secondaryEmail": None, "secondaryEmailType": None,
            "secondaryEmailVerified": False,
            "notificationEmailPreference": "primary",
            "notificationChannelPreference": "in_app",
        },
        {
            "firstName": "Chiamaka", "lastName": "Obi",
            "email": "chiamaka@stu.ui.edu.ng",
            "role": "student",
            "matricNumber": f"{str(YEAR-5)[2:]}/21IP104",
            "admissionYear": YEAR - 3,
            "currentLevel": "400L",
            "department": "Industrial Engineering",
            "phone": "+2348082345678",
            "bio": "400L student. Passionate about ergonomics and occupational health.",
            "skills": ["Ergonomics", "Work Study", "HSE", "MATLAB"],
            "emailType": "institutional",
            "secondaryEmail": "chiamakaobi@outlook.com",
            "secondaryEmailType": "personal",
            "secondaryEmailVerified": True,
            "notificationEmailPreference": "secondary",
            "notificationChannelPreference": "email",
        },
        # ── Students — 300L ───────────────────────────────────
        {
            "firstName": "Emeka", "lastName": "Eze",
            "email": "emeka@stu.ui.edu.ng",
            "role": "student",
            "matricNumber": f"{str(YEAR-4)[2:]}/22IP102",
            "admissionYear": YEAR - 2,
            "currentLevel": "300L",
            "department": "Industrial Engineering",
            "phone": "+2348045678901",
            "bio": "300L. Also serves as IESA Financial Secretary (exco role).",
            "skills": ["Excel", "QuickBooks", "Lean Manufacturing"],
            "emailType": "institutional",
            "secondaryEmail": "emekaeze@gmail.com",
            "secondaryEmailType": "personal",
            "secondaryEmailVerified": True,
            "notificationEmailPreference": "secondary",
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
            "bio": "300L IESA PRO student account.",
            "skills": ["Public Relations", "Microsoft Office", "R", "Statistics"],
            "emailType": "institutional",
            "secondaryEmail": "fatimayusuf99@yahoo.com",
            "secondaryEmailType": "personal",
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
            "firstName": "Remi", "lastName": "Badmus",
            "email": "remi@stu.ui.edu.ng",
            "role": "student",
            "matricNumber": f"{str(YEAR-4)[2:]}/22IP104",
            "admissionYear": YEAR - 2,
            "currentLevel": "300L",
            "department": "Industrial Engineering",
            "phone": None, "bio": None,
            "skills": ["Operations Research", "Python Basics"],
            "emailType": "institutional",
            "secondaryEmail": None, "secondaryEmailType": None,
            "secondaryEmailVerified": False,
            "notificationEmailPreference": "primary",
            "notificationChannelPreference": "both",
        },
        {
            "firstName": "Sola", "lastName": "Bankole",
            "email": "sola@stu.ui.edu.ng",
            "role": "student",
            "matricNumber": f"{str(YEAR-4)[2:]}/22IP105",
            "admissionYear": YEAR - 2,
            "currentLevel": "300L",
            "department": "Industrial Engineering",
            "phone": "+2348093456789",
            "bio": "300L. Very interested in quality management and Six Sigma.",
            "skills": ["Quality Control", "Six Sigma", "Minitab", "Excel"],
            "emailType": "institutional",
            "secondaryEmail": "solabankole@gmail.com",
            "secondaryEmailType": "personal",
            "secondaryEmailVerified": True,
            "notificationEmailPreference": "primary",
            "notificationChannelPreference": "in_app",
        },
        # ── Students — 200L ───────────────────────────────────
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
        {
            "firstName": "Tunde", "lastName": "Olamide",
            "email": "tunde@stu.ui.edu.ng",
            "role": "student",
            "matricNumber": f"{str(YEAR-3)[2:]}/23IP104",
            "admissionYear": YEAR - 1,
            "currentLevel": "200L",
            "department": "Industrial Engineering",
            "phone": "+2347055678901",
            "bio": "200L. Love robotics and automation — hoping to work in smart manufacturing.",
            "skills": ["Python", "Arduino", "Basic CAD", "Robotics"],
            "emailType": "institutional",
            "secondaryEmail": "tundeolamide@gmail.com",
            "secondaryEmailType": "personal",
            "secondaryEmailVerified": False,
            "notificationEmailPreference": "primary",
            "notificationChannelPreference": "both",
        },
        {
            "firstName": "Uche", "lastName": "Nnaemeka",
            "email": "uche@stu.ui.edu.ng",
            "role": "student",
            "matricNumber": f"{str(YEAR-3)[2:]}/23IP105",
            "admissionYear": YEAR - 1,
            "currentLevel": "200L",
            "department": "Industrial Engineering",
            "phone": None, "bio": None, "skills": [],
            "emailType": "institutional",
            "secondaryEmail": None, "secondaryEmailType": None,
            "secondaryEmailVerified": False,
            "notificationEmailPreference": "primary",
            "notificationChannelPreference": "email",
        },
        # ── Students — 100L ───────────────────────────────────
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
            "firstName": "Victor", "lastName": "Adegoke",
            "email": "victor@stu.ui.edu.ng",
            "role": "student",
            "matricNumber": f"{str(YEAR-2)[2:]}/24IP104",
            "admissionYear": YEAR,
            "currentLevel": "100L",
            "department": "Industrial Engineering",
            "phone": "+2349067890123",
            "bio": "100L. Curious about everything engineering.",
            "skills": ["Excel Basics", "Drawing"],
            "emailType": "institutional",
            "secondaryEmail": None, "secondaryEmailType": None,
            "secondaryEmailVerified": False,
            "notificationEmailPreference": "primary",
            "notificationChannelPreference": "in_app",
        },
        {
            "firstName": "Wunmi", "lastName": "Adeleke",
            "email": "wunmi@stu.ui.edu.ng",
            "role": "student",
            "matricNumber": f"{str(YEAR-2)[2:]}/24IP105",
            "admissionYear": YEAR,
            "currentLevel": "100L",
            "department": "Industrial Engineering",
            "phone": None, "bio": None, "skills": ["PowerPoint"],
            "emailType": "institutional",
            "secondaryEmail": "wunmideleke@gmail.com",
            "secondaryEmailType": "personal",
            "secondaryEmailVerified": False,
            "notificationEmailPreference": "primary",
            "notificationChannelPreference": "both",
        },
    ]

    docs = []
    for u in users:
        docs.append({
            **u,
            "isActive": u.get("isActive", True),
            "emailVerified": u.get("emailVerified", True),
            "profilePictureUrl": None,
            "googleId": None,
            "createdAt": NOW - timedelta(days=120),
            "updatedAt": NOW,
        })

    result = await coll.insert_many(docs)
    lookup = {users[i]["email"]: str(doc_id) for i, doc_id in enumerate(result.inserted_ids)}

    exco_count    = sum(1 for u in users if u["role"] == "exco")
    student_count = sum(1 for u in users if u["role"] == "student")
    print(f"   ✓ Users: 1 admin, {exco_count} exco, {student_count} students (password: Password1!)")
    return lookup


async def seed_enrollments(db, session_id: str, users: dict[str, str]):
    """Enrol every non-admin user in the given session."""
    coll = db["enrollments"]
    skip = {"admin@iesa.dev"}
    level_map = {
        # exco
        "tobi@iesa.dev": "400L", "emeka@iesa.dev": "300L", "fatima@iesa.dev": "300L",
        "grace@iesa.dev": "400L", "hakeem@iesa.dev": "400L", "ifeoma@iesa.dev": "500L",
        # 500L
        "jide@stu.ui.edu.ng": "500L", "amira@stu.ui.edu.ng": "500L",
        # 400L
        "bolaji@stu.ui.edu.ng": "400L", "chiamaka@stu.ui.edu.ng": "400L",
        # 300L
        "emeka@stu.ui.edu.ng": "300L", "fatima@stu.ui.edu.ng": "300L",
        "pelumi@stu.ui.edu.ng": "300L", "remi@stu.ui.edu.ng": "300L", "sola@stu.ui.edu.ng": "300L",
        # 200L
        "aisha@stu.ui.edu.ng": "200L", "chidi@stu.ui.edu.ng": "200L",
        "quincy@stu.ui.edu.ng": "200L", "tunde@stu.ui.edu.ng": "200L", "uche@stu.ui.edu.ng": "200L",
        # 100L
        "kemi@stu.ui.edu.ng": "100L", "lekan@stu.ui.edu.ng": "100L", "ngozi@stu.ui.edu.ng": "100L",
        "victor@stu.ui.edu.ng": "100L", "wunmi@stu.ui.edu.ng": "100L",
    }
    docs = []
    for email, uid in users.items():
        if email in skip:
            continue
        level = level_map.get(email, "200L")
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
    print(f"   ✓ Enrollments: {len(docs)} users enrolled")


async def seed_roles(db, session_id: str, users: dict[str, str]):
    """Assign ExCo and class-rep roles."""
    coll = db["roles"]
    roles_map = [
        # ExCo positions
        ("tobi@iesa.dev",        "president"),
        ("grace@iesa.dev",       "general_secretary"),
        ("emeka@iesa.dev",       "financial_secretary"),
        ("fatima@iesa.dev",      "pro"),
        ("hakeem@iesa.dev",      "social_director"),
        ("ifeoma@iesa.dev",      "academic_director"),
        # Class reps (student accounts)
        ("aisha@stu.ui.edu.ng",  "class_rep_200L"),
        ("pelumi@stu.ui.edu.ng", "class_rep_300L"),
        ("bolaji@stu.ui.edu.ng", "class_rep_400L"),
        ("amira@stu.ui.edu.ng",  "class_rep_500L"),
        ("kemi@stu.ui.edu.ng",   "class_rep_100L"),
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
            "description": "Annual welcome party for new 100-level students. Live DJ, refreshments, games, and networking with seniors. Dress code: smart casual.",
            "date": _dt(YEAR, 10, 5, 18, 0),
            "location": "Trenchard Hall, University of Ibadan",
            "maxAttendees": 200,
            "requiresPayment": False,
            "registrationDeadline": _dt(YEAR, 10, 3, 23, 59),
        },
        {
            "title": "Industrial Visit — Dangote Refinery",
            "category": "Career",
            "description": "Guided tour of the Dangote Petroleum Refinery in Lekki, Lagos — the world's largest single-train refinery. Transportation provided from UI campus. Bring a valid school ID and wear closed-toe shoes.",
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
            "description": "Hands-on two-hour workshop covering MATLAB for control engineering simulations and Python for data analysis and visualisation. Bring your laptop with MATLAB and Python installed. Beginner-friendly.",
            "date": _dt(YEAR, 10, 22, 10, 0),
            "location": "Computer Lab 2, Faculty of Technology",
            "maxAttendees": 80,
            "requiresPayment": False,
            "registrationDeadline": _dt(YEAR, 10, 20, 23, 59),
        },
        {
            "title": "IESA Inter-Level Quiz Competition",
            "category": "Competition",
            "description": "Annual quiz showdown between all five levels. Topics: Engineering fundamentals, General Knowledge, Nigerian history, and Current affairs. Prizes for top 3 levels. Each level fields a team of 4.",
            "date": _dt(YEAR + 1, 3, 8, 14, 0),
            "location": "Engineering Lecture Theatre, Faculty of Technology",
            "maxAttendees": None,
            "requiresPayment": False,
        },
        {
            "title": "Career Fair & Alumni Meet",
            "category": "Career",
            "description": "Connect with IESA alumni working at top engineering firms — Dangote, Nestle, Julius Berger, Shell, and more. Resume reviews, live mock interviews, and exclusive job postings. Must register in advance.",
            "date": _dt(YEAR + 1, 4, 20, 9, 0),
            "location": "Faculty of Technology Auditorium",
            "maxAttendees": 300,
            "requiresPayment": False,
            "registrationDeadline": _dt(YEAR + 1, 4, 18, 23, 59),
        },
        {
            "title": "Lean Six Sigma Awareness Seminar",
            "category": "Workshop",
            "description": "Introduction to Lean Six Sigma methodology: DMAIC, waste elimination, and process improvement. Guest speaker from a local manufacturing company. Certificate of participation issued.",
            "date": _dt(YEAR, 11, 28, 14, 0),
            "location": "IE Seminar Room, Faculty of Technology",
            "maxAttendees": 60,
            "requiresPayment": False,
            "registrationDeadline": _dt(YEAR, 11, 26, 23, 59),
        },
        {
            "title": "IESA End-of-Semester Dinner",
            "category": "Social",
            "description": "Formal end-of-semester dinner to celebrate the year's achievements. Awards, speeches, and a photo exhibition of IESA's 2025/2026 activities. Ticketed event.",
            "date": _dt(YEAR + 1, 7, 18, 18, 0),
            "location": "Trenchard Hall, University of Ibadan",
            "maxAttendees": 150,
            "requiresPayment": True,
            "paymentAmount": 6000.0,
            "registrationDeadline": _dt(YEAR + 1, 7, 14, 23, 59),
        },
        {
            "title": "IE Project Expo — 400L & 500L Showcase",
            "category": "Academic",
            "description": "400L and 500L students present their design projects and final year research to faculty, alumni, and industry guests. Open to all levels. Voting open to all attendees.",
            "date": _dt(YEAR + 1, 5, 10, 10, 0),
            "location": "Faculty of Technology Auditorium",
            "maxAttendees": 200,
            "requiresPayment": False,
        },
        {
            "title": "New Exco Inauguration Ceremony",
            "category": "Social",
            "description": "Official inauguration of the 2026/2027 IESA Executive Council. All students are invited to witness the handover and celebrate our new leaders.",
            "date": _dt(YEAR + 1, 6, 15, 12, 0),
            "location": "Faculty of Technology Conference Room",
            "maxAttendees": 100,
            "requiresPayment": False,
        },
        {
            "title": "AutoCAD & SolidWorks Bootcamp",
            "category": "Workshop",
            "description": "3-day intensive bootcamp on AutoCAD 2D/3D and SolidWorks parametric modelling. Targeted at 100L–300L students. Limited to 40 seats. Laptop required.",
            "date": _dt(YEAR, 12, 8, 9, 0),
            "location": "Computer Lab 1, Faculty of Technology",
            "maxAttendees": 40,
            "requiresPayment": True,
            "paymentAmount": 2500.0,
            "registrationDeadline": _dt(YEAR, 12, 5, 23, 59),
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
            "title": "Welcome to the 2025/2026 Academic Session!",
            "content": "Dear Industrial Engineering students,\n\nWe are excited to welcome you to the 2025/2026 academic session. Please ensure you complete your course registration before the deadline. IESA has a packed calendar of technical workshops, industrial visits, and social events lined up for you this year. Stay active on the platform to keep up with all announcements.\n\nWith warm regards,\nThe IESA Executive Council",
            "priority": "high",
            "isPinned": True,
            "targetLevels": None,
        },
        {
            "title": "IESA Dues Payment Deadline Extended — Act Now",
            "content": "Following requests from students, the deadline for IESA departmental dues (₦3,000) has been extended by two weeks to 30th November 2025. Please make your payments through the portal using the bank transfer option. Contact the Financial Secretary (Emeka Eze) via the platform if you encounter any issues.",
            "priority": "urgent",
            "isPinned": False,
            "targetLevels": None,
        },
        {
            "title": "100-Level Departmental Orientation Schedule",
            "content": "All 100-level students should report to the Engineering Lecture Theatre on Monday at 9:00 AM for the departmental orientation hosted by IESA. Attendance is compulsory. You will be introduced to the department, your course advisor, and the IESA platform. Bring a pen and notepad.",
            "priority": "normal",
            "isPinned": False,
            "targetLevels": ["100L"],
        },
        {
            "title": "500-Level Final Year Project — Proposal Submission",
            "content": "The FYP proposal submission deadline is approaching. All 500-level students must submit their typed proposals (minimum 3 pages) — including problem statement, objectives, and proposed methodology — to the HOD's office. Supervisor allocation will begin the week after submission closes.\n\nDeadline: 15th March 2026\nFormat: Two hard copies + one soft copy to the departmental admin email.",
            "priority": "high",
            "isPinned": True,
            "targetLevels": ["500L"],
        },
        {
            "title": "Kenneth Dike Library Access Cards Ready",
            "content": "New-session library access cards for all students are ready for collection from the Faculty of Technology undergraduate office. Bring your current student ID. Cards expire at the end of the 2025/2026 session.",
            "priority": "low",
            "isPinned": False,
            "targetLevels": None,
        },
        {
            "title": "Semester 2 Course Registration Opens Monday",
            "content": "Semester 2 course registration is now open on the university portal (student.ui.edu.ng). All students must register before 7th March 2026 to avoid late registration fees. See your faculty adviser if you have carryover courses.\n\nReminder: You must also update your IESA portal enrollment to reflect Semester 2.",
            "priority": "urgent",
            "isPinned": False,
            "targetLevels": None,
        },
        {
            "title": "SIWES Handbook & Placement Forms — 400 Level",
            "content": "400-level students: the SIWES handbook and company placement forms are now available from the IT coordinator's office (Room 110). You must source your own placement company or use the department's recommended companies list. Submission deadline for placement confirmation letters: 28 February 2026.",
            "priority": "high",
            "isPinned": False,
            "targetLevels": ["400L"],
        },
        {
            "title": "IESA Sports Day — All Levels Welcome",
            "content": "IESA's annual inter-level Sports Day is returning! Events include football, table tennis, tug-of-war, and relay races. All students are encouraged to participate — sign up with your class representative by Friday. Participation is free and prizes will be awarded.",
            "priority": "normal",
            "isPinned": False,
            "targetLevels": None,
        },
        {
            "title": "Notice: Academic Integrity Policy Reminder",
            "content": "All students are reminded that collusion, plagiarism, and impersonation in coursework or examinations is a serious academic offence at the University of Ibadan. The department will enforce a zero-tolerance policy this session. Please familiarise yourself with the university's academic integrity guidelines on the UI portal.",
            "priority": "normal",
            "isPinned": False,
            "targetLevels": None,
        },
        {
            "title": "Congratulations to IESA Quiz Team — Regional Winners!",
            "content": "We are thrilled to announce that the IESA quiz team (Grace Adebayo, Pelumi Afolabi, and Tobi Adeyemi) have emerged as winners of the South-West Regional Engineering Quiz Championships held at OAU Ile-Ife last weekend. They now advance to the national finals in Abuja. Congratulations to the team and their coach!",
            "priority": "high",
            "isPinned": True,
            "targetLevels": None,
        },
        {
            "title": "200L Course Study Materials Now on the Library",
            "content": "Lecture slides and recommended reading lists for IEE 201 (Introduction to Industrial Engineering), MTH 201 (Mathematical Methods I), and EEE 201 (Applied Electricity) have been uploaded to the IESA Library. Log in and visit the Resources section to access them.",
            "priority": "normal",
            "isPinned": False,
            "targetLevels": ["200L"],
        },
        {
            "title": "Exam Timetable — Semester 1 Released",
            "content": "The official Semester 1 examination timetable for all levels has been released. All students should check immediately and report any clashes to the department within 48 hours. The timetable will also be pinned on the departmental notice board.\n\nExaminations run from 6th January to 25th January 2027.",
            "priority": "urgent",
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
            "createdAt": NOW - timedelta(days=max(1, 40 - i * 3)),
            "updatedAt": NOW,
        })
    await coll.insert_many(docs)
    print(f"   ✓ Announcements: {len(docs)} items")


async def seed_payments(db, session_id: str, users: dict[str, str]):
    """Create departmental payment dues and mark various students as paid."""
    coll = db["payments"]

    def ids(*emails):
        return [users[e] for e in emails if users.get(e)]

    all_exco = ids("tobi@iesa.dev", "emeka@iesa.dev", "fatima@iesa.dev",
                   "grace@iesa.dev", "hakeem@iesa.dev", "ifeoma@iesa.dev")
    most_paid = ids(
        "tobi@iesa.dev", "emeka@iesa.dev", "fatima@iesa.dev",
        "grace@iesa.dev", "hakeem@iesa.dev", "ifeoma@iesa.dev",
        "aisha@stu.ui.edu.ng", "pelumi@stu.ui.edu.ng", "amira@stu.ui.edu.ng",
        "bolaji@stu.ui.edu.ng", "sola@stu.ui.edu.ng", "jide@stu.ui.edu.ng",
        "kemi@stu.ui.edu.ng",
    )
    some_paid = ids(
        "tobi@iesa.dev", "grace@iesa.dev", "aisha@stu.ui.edu.ng",
        "fatima@stu.ui.edu.ng", "emeka@stu.ui.edu.ng",
    )
    few_paid = ids("tobi@iesa.dev", "grace@iesa.dev", "aisha@stu.ui.edu.ng")
    event_attendees = ids(
        "grace@iesa.dev", "hakeem@iesa.dev", "ifeoma@iesa.dev",
        "jide@stu.ui.edu.ng", "amira@stu.ui.edu.ng", "bolaji@stu.ui.edu.ng",
        "chiamaka@stu.ui.edu.ng", "fatima@stu.ui.edu.ng", "emeka@stu.ui.edu.ng",
        "pelumi@stu.ui.edu.ng", "sola@stu.ui.edu.ng",
    )

    payments = [
        {
            "title": "IESA Departmental Dues 2025/2026",
            "amount": 3000.0,
            "category": "Dues",
            "mandatory": True,
            "deadline": _dt(YEAR, 11, 30, 23, 59),
            "description": "Annual IESA departmental dues for all enrolled Industrial Engineering students. Covers association activities, events, and member benefits.",
            "paidBy": most_paid,
        },
        {
            "title": "Faculty of Technology Branded Tee-Shirt",
            "amount": 5500.0,
            "category": "Merchandise",
            "mandatory": False,
            "deadline": _dt(YEAR, 12, 15, 23, 59),
            "description": "Official Faculty of Technology branded tee-shirt. Available in sizes S–XXL. Order through the portal and collect from the departmental office.",
            "paidBy": some_paid,
        },
        {
            "title": "Industrial Visit Fee — Dangote Refinery",
            "amount": 5000.0,
            "category": "Event",
            "mandatory": False,
            "deadline": _dt(YEAR, 11, 10, 23, 59),
            "description": "Covers bus transportation from UI to Lekki and logistics for the Dangote Refinery industrial visit on 15 November.",
            "paidBy": event_attendees,
        },
        {
            "title": "Student Welfare Fund 2025/2026",
            "amount": 1000.0,
            "category": "Dues",
            "mandatory": True,
            "deadline": _dt(YEAR, 12, 1, 23, 59),
            "description": "Supports IESA student welfare activities including medical emergency assistance, student hardship relief, and graduation gifts.",
            "paidBy": most_paid,
        },
        {
            "title": "AutoCAD & SolidWorks Bootcamp Fee",
            "amount": 2500.0,
            "category": "Event",
            "mandatory": False,
            "deadline": _dt(YEAR, 12, 5, 23, 59),
            "description": "3-day intensive CAD bootcamp covering AutoCAD and SolidWorks. Covers lab usage, printed handouts, and USB with software resources.",
            "paidBy": few_paid,
        },
        {
            "title": "IESA End-of-Semester Dinner Ticket",
            "amount": 6000.0,
            "category": "Event",
            "mandatory": False,
            "deadline": _dt(YEAR + 1, 7, 14, 23, 59),
            "description": "Ticket for the IESA End-of-Semester Dinner. Covers a 3-course meal, entertainment, and access to the awards ceremony. Dress code: formal.",
            "paidBy": ids("tobi@iesa.dev", "grace@iesa.dev", "ifeoma@iesa.dev",
                          "hakeem@iesa.dev", "aisha@stu.ui.edu.ng", "amira@stu.ui.edu.ng",
                          "bolaji@stu.ui.edu.ng", "chiamaka@stu.ui.edu.ng"),
        },
        {
            "title": "Departmental Directory & Yearbook Contribution",
            "amount": 1500.0,
            "category": "Merchandise",
            "mandatory": False,
            "deadline": _dt(YEAR + 1, 5, 30, 23, 59),
            "description": "Contribution towards the 2025/2026 IESA departmental directory and yearbook. All contributors get a printed copy. Mandatory for 500L graduating class.",
            "paidBy": ids("ifeoma@iesa.dev", "jide@stu.ui.edu.ng", "amira@stu.ui.edu.ng",
                          "grace@iesa.dev", "tobi@iesa.dev"),
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
    print(f"   ✓ Payments: {len(docs)} payment items seeded")


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
    gtb_id  = bank_account_ids[0]
    welf_id = bank_account_ids[1] if len(bank_account_ids) > 1 else bank_account_ids[0]

    transfers = [
        # ── Approved ─────────────────────────────────────────
        {
            "studentId": users.get("aisha@stu.ui.edu.ng"),
            "studentName": "Aisha Bello", "studentEmail": "aisha@stu.ui.edu.ng",
            "paymentId": None, "bankAccountId": gtb_id,
            "bankAccountName": "IESA — Industrial Engineering Students Association",
            "amount": 3000.0, "senderName": "AISHA BELLO", "senderBank": "First Bank of Nigeria",
            "transactionReference": "FBN250001234567", "transferDate": "2025-11-02",
            "narration": "IESA Dues 2025/2026", "status": "approved",
            "adminNote": "Confirmed by Financial Secretary.",
            "reviewedBy": users.get("admin@iesa.dev"), "reviewedAt": NOW - timedelta(days=25),
        },
        {
            "studentId": users.get("emeka@stu.ui.edu.ng"),
            "studentName": "Emeka Eze", "studentEmail": "emeka@stu.ui.edu.ng",
            "paymentId": None, "bankAccountId": gtb_id,
            "bankAccountName": "IESA — Industrial Engineering Students Association",
            "amount": 3000.0, "senderName": "EMEKA CHUKWUEMEKA EZE", "senderBank": "Zenith Bank",
            "transactionReference": "ZTH250009876543", "transferDate": "2025-11-05",
            "narration": "IESA dues payment 2025/2026", "status": "approved",
            "adminNote": None, "reviewedBy": users.get("admin@iesa.dev"), "reviewedAt": NOW - timedelta(days=23),
        },
        {
            "studentId": users.get("pelumi@stu.ui.edu.ng"),
            "studentName": "Pelumi Afolabi", "studentEmail": "pelumi@stu.ui.edu.ng",
            "paymentId": None, "bankAccountId": gtb_id,
            "bankAccountName": "IESA — Industrial Engineering Students Association",
            "amount": 3000.0, "senderName": "OLUWAPELUMI AFOLABI", "senderBank": "GTBank",
            "transactionReference": "GTB250001928374", "transferDate": "2025-11-07",
            "narration": "IESA departmental dues", "status": "approved",
            "adminNote": None, "reviewedBy": users.get("admin@iesa.dev"), "reviewedAt": NOW - timedelta(days=20),
        },
        {
            "studentId": users.get("grace@iesa.dev"),
            "studentName": "Grace Adebayo", "studentEmail": "grace@iesa.dev",
            "paymentId": None, "bankAccountId": gtb_id,
            "bankAccountName": "IESA — Industrial Engineering Students Association",
            "amount": 5000.0, "senderName": "ADEBAYO GRACE OMOTOLA", "senderBank": "Access Bank",
            "transactionReference": "ACC250003847261", "transferDate": "2025-11-08",
            "narration": "Dangote Refinery visit fee", "status": "approved",
            "adminNote": "Spot confirmed. Bus list updated.",
            "reviewedBy": users.get("admin@iesa.dev"), "reviewedAt": NOW - timedelta(days=18),
        },
        {
            "studentId": users.get("sola@stu.ui.edu.ng"),
            "studentName": "Sola Bankole", "studentEmail": "sola@stu.ui.edu.ng",
            "paymentId": None, "bankAccountId": gtb_id,
            "bankAccountName": "IESA — Industrial Engineering Students Association",
            "amount": 4000.0, "senderName": "BANKOLE OLAOLUWA", "senderBank": "UBA",
            "transactionReference": "UBA250005647382", "transferDate": "2025-11-15",
            "narration": "IESA dues + welfare", "status": "approved",
            "adminNote": "₦3,000 allocated to dues, ₦1,000 to welfare fund.",
            "reviewedBy": users.get("admin@iesa.dev"), "reviewedAt": NOW - timedelta(days=12),
        },
        {
            "studentId": users.get("amira@stu.ui.edu.ng"),
            "studentName": "Amira Hassan", "studentEmail": "amira@stu.ui.edu.ng",
            "paymentId": None, "bankAccountId": gtb_id,
            "bankAccountName": "IESA — Industrial Engineering Students Association",
            "amount": 3000.0, "senderName": "AMIRA HASSAN", "senderBank": "Kuda Bank",
            "transactionReference": "KDA250008291034", "transferDate": "2025-11-18",
            "narration": "IESA 2025/2026 Dues", "status": "approved",
            "adminNote": None, "reviewedBy": users.get("admin@iesa.dev"), "reviewedAt": NOW - timedelta(days=10),
        },
        # ── Pending ─────────────────────────────────────────
        {
            "studentId": users.get("chidi@stu.ui.edu.ng"),
            "studentName": "Chidi Okonkwo", "studentEmail": "chidi@stu.ui.edu.ng",
            "paymentId": None, "bankAccountId": gtb_id,
            "bankAccountName": "IESA — Industrial Engineering Students Association",
            "amount": 3000.0, "senderName": "CHIDI OKONKWO", "senderBank": "UBA",
            "transactionReference": "UBA250007654321", "transferDate": "2025-11-22",
            "narration": "IESA payment", "status": "pending",
            "adminNote": None, "reviewedBy": None, "reviewedAt": None,
        },
        {
            "studentId": users.get("bolaji@stu.ui.edu.ng"),
            "studentName": "Bolaji Oduya", "studentEmail": "bolaji@stu.ui.edu.ng",
            "paymentId": None, "bankAccountId": gtb_id,
            "bankAccountName": "IESA — Industrial Engineering Students Association",
            "amount": 3000.0, "senderName": "ODUYA BOLAJI", "senderBank": "FCMB",
            "transactionReference": "FCM250001234098", "transferDate": "2025-11-25",
            "narration": "Dues 2025", "status": "pending",
            "adminNote": None, "reviewedBy": None, "reviewedAt": None,
        },
        {
            "studentId": users.get("tunde@stu.ui.edu.ng"),
            "studentName": "Tunde Olamide", "studentEmail": "tunde@stu.ui.edu.ng",
            "paymentId": None, "bankAccountId": welf_id,
            "bankAccountName": "IESA Welfare Fund",
            "amount": 1000.0, "senderName": "OLAMIDE TUNDE", "senderBank": "Opay",
            "transactionReference": "OPY250009871234", "transferDate": "2025-12-01",
            "narration": "Welfare fund contribution", "status": "pending",
            "adminNote": None, "reviewedBy": None, "reviewedAt": None,
        },
        # ── Rejected ─────────────────────────────────────────
        {
            "studentId": users.get("remi@stu.ui.edu.ng"),
            "studentName": "Remi Badmus", "studentEmail": "remi@stu.ui.edu.ng",
            "paymentId": None, "bankAccountId": gtb_id,
            "bankAccountName": "IESA — Industrial Engineering Students Association",
            "amount": 3000.0, "senderName": "BADMUS R", "senderBank": "Moniepoint",
            "transactionReference": "MNP250002938471", "transferDate": "2025-11-20",
            "narration": "IESA", "status": "rejected",
            "adminNote": "Transaction reference not verifiable. Please resubmit with a clear bank debit alert screenshot.",
            "reviewedBy": users.get("admin@iesa.dev"), "reviewedAt": NOW - timedelta(days=5),
        },
    ]
    docs = [
        {**t, "sessionId": session_id, "createdAt": NOW - timedelta(days=30), "updatedAt": NOW}
        for t in transfers if t["studentId"]
    ]
    if docs:
        await coll.insert_many(docs)
    approved = sum(1 for t in docs if t["status"] == "approved")
    pending  = sum(1 for t in docs if t["status"] == "pending")
    rejected = sum(1 for t in docs if t["status"] == "rejected")
    print(f"   ✓ Bank Transfers: {len(docs)} submissions ({approved} approved, {pending} pending, {rejected} rejected)")


# ───────────────────────────────────────────────────────────────────────
# Notifications
# ───────────────────────────────────────────────────────────────────────

async def seed_notifications(db, users: dict[str, str]):
    """Seed in-app notifications for users."""
    coll = db["notifications"]
    student_emails = [e for e in users if e != "admin@iesa.dev"]
    docs = []

    # Welcome notification for everyone
    for email in student_emails:
        uid   = users[email]
        first = email.split("@")[0].capitalize()
        docs.append({
            "userId": uid, "type": "announcement",
            "title": "Welcome to IESA!", "isRead": True,
            "message": f"Hi {first}, welcome to the IESA platform for the 2025/2026 academic session. Explore events, resources, and your dashboard.",
            "link": "/dashboard/announcements", "relatedId": None,
            "createdAt": NOW - timedelta(days=120),
        })

    # Dues reminder for all students
    for email in student_emails:
        uid = users[email]
        docs.append({
            "userId": uid, "type": "payment",
            "title": "IESA Dues Due — 30 November", "isRead": False,
            "message": "IESA departmental dues (₦3,000) are due by 30 November 2025. Pay via the portal to avoid losing access to events and resources.",
            "link": "/dashboard/payments", "relatedId": None,
            "createdAt": NOW - timedelta(days=30),
        })

    # Industrial visit notification for upper-level students
    upper_emails = [e for e in student_emails if e.split("@")[0] in
                    ("grace", "hakeem", "ifeoma", "jide", "amira", "fatima", "emeka", "pelumi",
                     "bolaji", "chiamaka", "sola", "remi", "tobi")]
    for email in upper_emails:
        uid = users[email]
        docs.append({
            "userId": uid, "type": "event",
            "title": "Industrial Visit — Dangote Refinery Now Open", "isRead": False,
            "message": "Registration is now open for the Dangote Refinery industrial visit on 15 November. Only 50 spots available — register now!",
            "link": "/dashboard/events", "relatedId": None,
            "createdAt": NOW - timedelta(days=18),
        })

    # Transfer approved notifications
    transfer_approved = [
        ("aisha@stu.ui.edu.ng", "Aisha"),
        ("emeka@stu.ui.edu.ng", "Emeka"),
        ("pelumi@stu.ui.edu.ng", "Pelumi"),
        ("grace@iesa.dev",      "Grace"),
        ("sola@stu.ui.edu.ng",  "Sola"),
        ("amira@stu.ui.edu.ng", "Amira"),
    ]
    for email, first in transfer_approved:
        uid = users.get(email)
        if uid:
            docs.append({
                "userId": uid, "type": "payment",
                "title": "Payment Transfer Approved", "isRead": True,
                "message": f"Your bank transfer has been verified and your payment has been marked as paid. Thank you, {first}!",
                "link": "/dashboard/payments", "relatedId": None,
                "createdAt": NOW - timedelta(days=10),
            })

    # Transfer rejected notification
    remi_uid = users.get("remi@stu.ui.edu.ng")
    if remi_uid:
        docs.append({
            "userId": remi_uid, "type": "payment",
            "title": "Transfer Submission Rejected", "isRead": False,
            "message": "Your bank transfer submission was rejected. Reason: Transaction reference not verifiable. Please resubmit with a clear bank debit alert screenshot.",
            "link": "/dashboard/payments", "relatedId": None,
            "createdAt": NOW - timedelta(days=5),
        })

    # Quiz competition announcement for all
    for email in student_emails:
        uid = users[email]
        docs.append({
            "userId": uid, "type": "announcement",
            "title": "🏆 IESA Quiz Team — Regional Champions!", "isRead": False,
            "message": "Congratulations to our quiz team for winning the South-West Regional Engineering Quiz. They advance to the national finals!",
            "link": "/dashboard/announcements", "relatedId": None,
            "createdAt": NOW - timedelta(days=3),
        })

    # Course registration reminder
    for email in student_emails:
        uid = users[email]
        docs.append({
            "userId": uid, "type": "announcement",
            "title": "Semester 2 Registration Open", "isRead": False,
            "message": "Semester 2 course registration is now open. Complete registration before 7th March 2026 to avoid late fees.",
            "link": "/dashboard/announcements", "relatedId": None,
            "createdAt": NOW - timedelta(days=1),
        })

    # Study group invites for specific users
    group_invites = [
        ("chidi@stu.ui.edu.ng",   "Maths Methods 200L", "Aisha Bello has invited you to join the Maths Methods 200L study group."),
        ("quincy@stu.ui.edu.ng",  "Maths Methods 200L", "You have been added to the Maths Methods 200L study group."),
        ("emeka@stu.ui.edu.ng",   "OR I Study Circle",  "Fatima Yusuf has invited you to join the OR I Study Circle."),
        ("hakeem@iesa.dev",       "Quality Control Crash Course", "Grace Adebayo has invited you to the Quality Control Crash Course study group."),
        ("jide@stu.ui.edu.ng",    "FYP Writing Group",  "Ifeoma Nwosu has invited you to join the FYP Writing Group."),
        ("tunde@stu.ui.edu.ng",   "Maths Methods 200L", "You have a new study group invitation from Aisha Bello."),
    ]
    for email, group_name, msg in group_invites:
        uid = users.get(email)
        if uid:
            docs.append({
                "userId": uid, "type": "study_group",
                "title": f"Study Group Invitation: {group_name}", "isRead": False,
                "message": msg,
                "link": "/dashboard/study-groups", "relatedId": None,
                "createdAt": NOW - timedelta(days=7),
            })

    if docs:
        await coll.insert_many(docs)
    print(f"   ✓ Notifications: {len(docs)} in-app notifications")


# ───────────────────────────────────────────────────────────────────────
# Study Groups
# ───────────────────────────────────────────────────────────────────────

async def seed_study_groups(db, users: dict[str, str]):
    """Seed sample study groups with messages."""
    coll = db["study_groups"]
    groups = [
        {
            "name": "OR I Study Circle",
            "courseCode": "IEE 301", "courseName": "Operations Research I",
            "description": "Weekly study sessions covering the simplex method, transportation & assignment problems, and network analysis. Exam prep discussions every Saturday.",
            "maxMembers": 8, "meetingDay": "Saturday", "meetingTime": "10:00",
            "meetingLocation": "IE Seminar Room / Zoom", "level": "300L",
            "tags": ["Linear Programming", "Simplex", "Transportation", "Exam Prep"], "isOpen": True,
            "createdBy": users.get("fatima@stu.ui.edu.ng"), "creatorName": "Fatima Yusuf",
            "members": [
                {"userId": users.get("fatima@stu.ui.edu.ng"), "firstName": "Fatima", "lastName": "Yusuf",
                 "matricNumber": f"{str(YEAR-4)[2:]}/22IP101", "joinedAt": NOW - timedelta(days=14)},
                {"userId": users.get("emeka@stu.ui.edu.ng"), "firstName": "Emeka", "lastName": "Eze",
                 "matricNumber": f"{str(YEAR-4)[2:]}/22IP102", "joinedAt": NOW - timedelta(days=14)},
                {"userId": users.get("pelumi@stu.ui.edu.ng"), "firstName": "Pelumi", "lastName": "Afolabi",
                 "matricNumber": f"{str(YEAR-4)[2:]}/22IP103", "joinedAt": NOW - timedelta(days=12)},
                {"userId": users.get("remi@stu.ui.edu.ng"), "firstName": "Remi", "lastName": "Badmus",
                 "matricNumber": f"{str(YEAR-4)[2:]}/22IP104", "joinedAt": NOW - timedelta(days=10)},
                {"userId": users.get("sola@stu.ui.edu.ng"), "firstName": "Sola", "lastName": "Bankole",
                 "matricNumber": f"{str(YEAR-4)[2:]}/22IP105", "joinedAt": NOW - timedelta(days=8)},
            ],
            "pinnedNote": "Check the pinned simplex method cheat sheet before Saturday's session!",
            "messages": [
                {"userId": users.get("fatima@stu.ui.edu.ng"), "senderName": "Fatima Yusuf",
                 "text": "Welcome everyone! Our first session is Saturday at 10am in the IE seminar room.", "sentAt": NOW - timedelta(days=14)},
                {"userId": users.get("emeka@stu.ui.edu.ng"), "senderName": "Emeka Eze",
                 "text": "Thanks Fatima! Should we cover the simplex method or transportation first?", "sentAt": NOW - timedelta(days=13)},
                {"userId": users.get("fatima@stu.ui.edu.ng"), "senderName": "Fatima Yusuf",
                 "text": "Let's start with simplex since it's the foundation. Bring Hillier & Lieberman chapters 3 and 4.", "sentAt": NOW - timedelta(days=13)},
                {"userId": users.get("pelumi@stu.ui.edu.ng"), "senderName": "Pelumi Afolabi",
                 "text": "I uploaded past question papers from 2019–2023 to the IESA library. Grab them before Saturday!", "sentAt": NOW - timedelta(days=7)},
                {"userId": users.get("sola@stu.ui.edu.ng"), "senderName": "Sola Bankole",
                 "text": "Just joined — excited to be part of this! I have a solved example on Network Analysis I can share.", "sentAt": NOW - timedelta(days=5)},
            ],
        },
        {
            "name": "Maths Methods 200L",
            "courseCode": "MTH 201", "courseName": "Mathematical Methods I",
            "description": "Study group for 200L students tackling differential equations, Laplace transforms, and Fourier series. We meet Sundays and share resources during the week.",
            "maxMembers": 6, "meetingDay": "Sunday", "meetingTime": "16:00",
            "meetingLocation": "Faculty Library, Ground Floor", "level": "200L",
            "tags": ["ODE", "Laplace", "Fourier", "200L"], "isOpen": True,
            "createdBy": users.get("aisha@stu.ui.edu.ng"), "creatorName": "Aisha Bello",
            "members": [
                {"userId": users.get("aisha@stu.ui.edu.ng"), "firstName": "Aisha", "lastName": "Bello",
                 "matricNumber": f"{str(YEAR-3)[2:]}/23IP101", "joinedAt": NOW - timedelta(days=20)},
                {"userId": users.get("chidi@stu.ui.edu.ng"), "firstName": "Chidi", "lastName": "Okonkwo",
                 "matricNumber": f"{str(YEAR-3)[2:]}/23IP102", "joinedAt": NOW - timedelta(days=18)},
                {"userId": users.get("quincy@stu.ui.edu.ng"), "firstName": "Quincy", "lastName": "Ogundele",
                 "matricNumber": f"{str(YEAR-3)[2:]}/23IP103", "joinedAt": NOW - timedelta(days=16)},
                {"userId": users.get("tunde@stu.ui.edu.ng"), "firstName": "Tunde", "lastName": "Olamide",
                 "matricNumber": f"{str(YEAR-3)[2:]}/23IP104", "joinedAt": NOW - timedelta(days=12)},
            ],
            "pinnedNote": "Next session: Laplace transforms — bring your formula sheet.",
            "messages": [
                {"userId": users.get("aisha@stu.ui.edu.ng"), "senderName": "Aisha Bello",
                 "text": "Hi all! Welcome to our study group. Let's start with ODEs — it's the first topic in Dr. Salami's schedule.", "sentAt": NOW - timedelta(days=20)},
                {"userId": users.get("chidi@stu.ui.edu.ng"), "senderName": "Chidi Okonkwo",
                 "text": "Are we meeting this Sunday? I'm a bit lost on second-order ODEs.", "sentAt": NOW - timedelta(days=15)},
                {"userId": users.get("aisha@stu.ui.edu.ng"), "senderName": "Aisha Bello",
                 "text": "Yes, 4pm at the faculty library! We'll cover second-order ODEs and start on Laplace.", "sentAt": NOW - timedelta(days=15)},
                {"userId": users.get("tunde@stu.ui.edu.ng"), "senderName": "Tunde Olamide",
                 "text": "Just joined! I found a really good YouTube series on Laplace transforms, will share this Sunday.", "sentAt": NOW - timedelta(days=10)},
            ],
        },
        {
            "name": "FYP Writing Group (500L)",
            "courseCode": "IEE 509", "courseName": "Final Year Project",
            "description": "Peer accountability group for 500L students working on their final year projects. We track weekly progress, review each other's drafts, and help with referencing and presentation slides.",
            "maxMembers": 5, "meetingDay": "Wednesday", "meetingTime": "18:00",
            "meetingLocation": "Online (Google Meet)", "level": "500L",
            "tags": ["FYP", "Research", "Writing", "LaTeX", "500L"], "isOpen": False,
            "createdBy": users.get("ifeoma@iesa.dev"), "creatorName": "Ifeoma Nwosu",
            "members": [
                {"userId": users.get("ifeoma@iesa.dev"), "firstName": "Ifeoma", "lastName": "Nwosu",
                 "matricNumber": f"{str(YEAR-6)[2:]}/20IP101", "joinedAt": NOW - timedelta(days=7)},
                {"userId": users.get("jide@stu.ui.edu.ng"), "firstName": "Jide", "lastName": "Akinola",
                 "matricNumber": f"{str(YEAR-6)[2:]}/20IP102", "joinedAt": NOW - timedelta(days=7)},
                {"userId": users.get("amira@stu.ui.edu.ng"), "firstName": "Amira", "lastName": "Hassan",
                 "matricNumber": f"{str(YEAR-6)[2:]}/20IP103", "joinedAt": NOW - timedelta(days=6)},
            ],
            "pinnedNote": "Proposal deadline: 15 March 2026. Everyone should have Chapter 1 done by then.",
            "messages": [
                {"userId": users.get("ifeoma@iesa.dev"), "senderName": "Ifeoma Nwosu",
                 "text": "Welcome Jide and Amira! This group is for accountability — let's check in every Wednesday at 6pm on Google Meet.", "sentAt": NOW - timedelta(days=7)},
                {"userId": users.get("jide@stu.ui.edu.ng"), "senderName": "Jide Akinola",
                 "text": "Sounds great! My topic is demand forecasting for FMCG companies using ML models.", "sentAt": NOW - timedelta(days=6)},
                {"userId": users.get("amira@stu.ui.edu.ng"), "senderName": "Amira Hassan",
                 "text": "Mine is hospital layout optimisation. I'm using Arena for simulation. Looking forward to the peer reviews!", "sentAt": NOW - timedelta(days=6)},
                {"userId": users.get("ifeoma@iesa.dev"), "senderName": "Ifeoma Nwosu",
                 "text": "Perfect. Let's all write a 500-word problem statement draft before Wednesday. Share in the group for feedback.", "sentAt": NOW - timedelta(days=5)},
            ],
        },
        {
            "name": "Quality Control Crash Course (400L)",
            "courseCode": "IEE 403", "courseName": "Quality Control & Reliability",
            "description": "400L exam prep group for Quality Control & Reliability. We focus on SPC, control charts, OC curves, acceptance sampling, and reliability functions. Open to all 400L students.",
            "maxMembers": 10, "meetingDay": "Friday", "meetingTime": "14:00",
            "meetingLocation": "IE Lab", "level": "400L",
            "tags": ["SPC", "Control Charts", "Six Sigma", "Exam Prep", "400L"], "isOpen": True,
            "createdBy": users.get("grace@iesa.dev"), "creatorName": "Grace Adebayo",
            "members": [
                {"userId": users.get("grace@iesa.dev"), "firstName": "Grace", "lastName": "Adebayo",
                 "matricNumber": f"{str(YEAR-5)[2:]}/21IP101", "joinedAt": NOW - timedelta(days=10)},
                {"userId": users.get("hakeem@iesa.dev"), "firstName": "Hakeem", "lastName": "Ibrahim",
                 "matricNumber": f"{str(YEAR-5)[2:]}/21IP102", "joinedAt": NOW - timedelta(days=9)},
                {"userId": users.get("tobi@iesa.dev"), "firstName": "Tobi", "lastName": "Adeyemi",
                 "matricNumber": f"{str(YEAR-5)[2:]}/22EE210", "joinedAt": NOW - timedelta(days=8)},
                {"userId": users.get("bolaji@stu.ui.edu.ng"), "firstName": "Bolaji", "lastName": "Oduya",
                 "matricNumber": f"{str(YEAR-5)[2:]}/21IP103", "joinedAt": NOW - timedelta(days=7)},
                {"userId": users.get("chiamaka@stu.ui.edu.ng"), "firstName": "Chiamaka", "lastName": "Obi",
                 "matricNumber": f"{str(YEAR-5)[2:]}/21IP104", "joinedAt": NOW - timedelta(days=6)},
            ],
            "pinnedNote": "Dr. Falade confirmed: X-bar/R control charts and p-charts WILL be on the exam.",
            "messages": [
                {"userId": users.get("grace@iesa.dev"), "senderName": "Grace Adebayo",
                 "text": "Hey everyone! Let's use this group for QC exam prep. First session is Friday at 2pm in the IE lab.", "sentAt": NOW - timedelta(days=10)},
                {"userId": users.get("hakeem@iesa.dev"), "senderName": "Hakeem Ibrahim",
                 "text": "I have Dr. Falade's slides and the 5-year past questions. Will bring printouts on Friday.", "sentAt": NOW - timedelta(days=9)},
                {"userId": users.get("tobi@iesa.dev"), "senderName": "Tobi Adeyemi",
                 "text": "Can someone explain the difference between Type I and Type II errors in SPC? I keep mixing them up.", "sentAt": NOW - timedelta(days=4)},
                {"userId": users.get("grace@iesa.dev"), "senderName": "Grace Adebayo",
                 "text": "Type I = false alarm (reject when process is in control). Type II = miss (accept when out of control). Remember: Type I is the cry wolf error!", "sentAt": NOW - timedelta(days=4)},
                {"userId": users.get("chiamaka@stu.ui.edu.ng"), "senderName": "Chiamaka Obi",
                 "text": "That's such a great way to remember it! Adding that to my notes.", "sentAt": NOW - timedelta(days=3)},
            ],
        },
        {
            "name": "Engineering Statistics 300L",
            "courseCode": "IEE 305", "courseName": "Engineering Statistics",
            "description": "Group for IEE 305 — covering probability distributions, hypothesis testing, regression analysis, and design of experiments. Resources uploaded weekly.",
            "maxMembers": 8, "meetingDay": "Thursday", "meetingTime": "17:00",
            "meetingLocation": "Faculty Library, Room 1C", "level": "300L",
            "tags": ["Statistics", "Regression", "Hypothesis Testing", "DOE"], "isOpen": True,
            "createdBy": users.get("sola@stu.ui.edu.ng"), "creatorName": "Sola Bankole",
            "members": [
                {"userId": users.get("sola@stu.ui.edu.ng"), "firstName": "Sola", "lastName": "Bankole",
                 "matricNumber": f"{str(YEAR-4)[2:]}/22IP105", "joinedAt": NOW - timedelta(days=5)},
                {"userId": users.get("remi@stu.ui.edu.ng"), "firstName": "Remi", "lastName": "Badmus",
                 "matricNumber": f"{str(YEAR-4)[2:]}/22IP104", "joinedAt": NOW - timedelta(days=4)},
                {"userId": users.get("pelumi@stu.ui.edu.ng"), "firstName": "Pelumi", "lastName": "Afolabi",
                 "matricNumber": f"{str(YEAR-4)[2:]}/22IP103", "joinedAt": NOW - timedelta(days=3)},
            ],
            "pinnedNote": None,
            "messages": [
                {"userId": users.get("sola@stu.ui.edu.ng"), "senderName": "Sola Bankole",
                 "text": "Hey everyone, I created this group for IEE 305 prep. First meeting is Thursday at 5pm.", "sentAt": NOW - timedelta(days=5)},
                {"userId": users.get("pelumi@stu.ui.edu.ng"), "senderName": "Pelumi Afolabi",
                 "text": "I'll be there! Can we cover normal distribution and z-tests first?", "sentAt": NOW - timedelta(days=4)},
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
    fatima_id    = users.get("fatima@stu.ui.edu.ng", users.get("tobi@iesa.dev"))
    aisha_id     = users.get("aisha@stu.ui.edu.ng",  fatima_id)
    emeka_id     = users.get("emeka@stu.ui.edu.ng",  fatima_id)
    pelumi_id    = users.get("pelumi@stu.ui.edu.ng", fatima_id)
    bolaji_id    = users.get("bolaji@stu.ui.edu.ng", fatima_id)
    jide_id      = users.get("jide@stu.ui.edu.ng",   fatima_id)
    reviewer_id  = users.get("tobi@iesa.dev",        users.get("admin@iesa.dev"))

    articles = [
        {
            "title": "IESA Kicks Off 2025/2026 Session with Freshers Night",
            "slug": "iesa-kicks-off-2025-2026-session-with-freshers-night",
            "content": (
                "<p>The IESA Welcome Freshers Night was held on October 5th at Trenchard Hall, University of Ibadan, "
                "to a roaring crowd of over 180 students. The event marked the official start of IESA's 2025/2026 "
                "academic session activities.</p>"
                "<p>The night featured live performances, a DJ, various games, and a networking session where fresh "
                "100-level students were introduced to their seniors. President Tobi Adeyemi gave a short welcome "
                "address emphasising the association's goals for the year, including the expansion of the TIMP "
                "mentoring programme and a new quarterly newsletter.</p>"
                "<p>\"We want every student in this department to feel seen, supported, and inspired,\" Adeyemi said "
                "to thunderous applause.</p>"
            ),
            "excerpt": "IESA's annual welcome night welcomed over 180 students to the new academic session with music, networking, and prizes.",
            "category": "event_coverage", "tags": ["Freshers Night", "Social", "2025/2026"],
            "coverImageUrl": None, "authorId": fatima_id, "authorName": "Fatima Yusuf",
            "status": "published", "viewCount": 142, "likeCount": 38, "likedBy": [],
            "publishedAt": NOW - timedelta(days=120), "submittedAt": NOW - timedelta(days=122),
            "reviewedAt": NOW - timedelta(days=121), "reviewedBy": reviewer_id,
        },
        {
            "title": "Opinion: Why Every Industrial Engineer Should Learn Python",
            "slug": "opinion-why-every-industrial-engineer-should-learn-python",
            "content": (
                "<p>In the age of Industry 4.0, data is the new raw material. Python has emerged as the lingua "
                "franca of data analysis, simulation, and automation for Industrial Engineers worldwide.</p>"
                "<p>As a 200L student, I first encountered Python in our programming elective. I was sceptical — "
                "why would an IE student need to code? But after running a Monte Carlo simulation for my OR "
                "assignment and finishing in under an hour what would have taken days in Excel, I was converted.</p>"
                "<p>Python libraries like <code>scipy.optimize</code>, <code>simpy</code>, and <code>pandas</code> "
                "directly map to core IE concepts: linear programming, discrete-event simulation, and data "
                "manipulation. If you haven't started yet, there's no better time than now.</p>"
            ),
            "excerpt": "Python is increasingly indispensable for modern Industrial Engineers — here's why every IE student at UI should pick it up now.",
            "category": "opinion", "tags": ["Python", "Industry 4.0", "Career"],
            "coverImageUrl": None, "authorId": aisha_id, "authorName": "Aisha Bello",
            "status": "published", "viewCount": 97, "likeCount": 22, "likedBy": [],
            "publishedAt": NOW - timedelta(days=100), "submittedAt": NOW - timedelta(days=104),
            "reviewedAt": NOW - timedelta(days=101), "reviewedBy": reviewer_id,
        },
        {
            "title": "Recap: MATLAB & Python Workshop Draws 70+ Students",
            "slug": "recap-matlab-python-workshop-draws-70-students",
            "content": (
                "<p>The IESA MATLAB & Python workshop held on October 22nd drew a larger-than-expected crowd of "
                "73 students from all levels. Organised by the Academic Committee, the day-long session covered "
                "MATLAB basics, Python for data analysis, and a joint simulation mini-project.</p>"
                "<p>Facilitators included two 400L students and an invited alumnus currently working as a data "
                "engineer at Access Bank. Participants praised the hands-on nature of the workshop, with one 200L "
                "attendee saying: \"I finally understand what MATLAB is for. The queue simulation exercise was "
                "the best part.\"</p>"
                "<p>Materials from the workshop — including slides, code notebooks, and recordings — are available "
                "on the IESA resource library.</p>"
            ),
            "excerpt": "Over 70 students attended IESA's annual tech workshop covering MATLAB and Python for engineering applications.",
            "category": "event_coverage", "tags": ["Workshop", "MATLAB", "Python"],
            "coverImageUrl": None, "authorId": fatima_id, "authorName": "Fatima Yusuf",
            "status": "published", "viewCount": 64, "likeCount": 15, "likedBy": [],
            "publishedAt": NOW - timedelta(days=80), "submittedAt": NOW - timedelta(days=84),
            "reviewedAt": NOW - timedelta(days=81), "reviewedBy": reviewer_id,
        },
        {
            "title": "IESA Departmental Dues: What Your Money Funds",
            "slug": "iesa-departmental-dues-what-your-money-funds",
            "content": (
                "<p>Every year, questions arise about where the IESA departmental dues go. Here is a transparent "
                "breakdown of the ₦3,000 budget for 2025/2026.</p>"
                "<p><strong>Events & Social (₦900)</strong> — Covers Freshers Night venue, decorations, DJ, and "
                "the End-of-Semester Dinner.</p>"
                "<p><strong>Academic Support (₦600)</strong> — Past question printing, Workshop materials, MATLAB "
                "and Python toolkits, and StudyGroup resource uploads.</p>"
                "<p><strong>Welfare (₦500)</strong> — Emergency welfare fund for students facing hardship.</p>"
                "<p><strong>IESA Press (₦400)</strong> — Newsletter printing, photography equipment, and media "
                "subscriptions.</p>"
                "<p><strong>Admin & Ops (₦600)</strong> — Printing, stationery, and meeting costs.</p>"
                "<p>We are committed to publishing a full financial report at the end of every session. "
                "Questions? Email finance@iesa.dev.</p>"
            ),
            "excerpt": "A transparent breakdown of how your ₦3,000 IESA dues are allocated for the 2025/2026 academic session.",
            "category": "news", "tags": ["Dues", "Transparency", "Finance"],
            "coverImageUrl": None, "authorId": reviewer_id, "authorName": "Tobi Adeyemi",
            "status": "published", "viewCount": 211, "likeCount": 56, "likedBy": [],
            "publishedAt": NOW - timedelta(days=60), "submittedAt": NOW - timedelta(days=62),
            "reviewedAt": NOW - timedelta(days=61), "reviewedBy": reviewer_id,
        },
        {
            "title": "IESA Quiz Team Wins Regional Qualifying Round",
            "slug": "iesa-quiz-team-wins-regional-qualifying-round",
            "content": (
                "<p>The IESA quiz team has qualified for the national final of the Nigerian Engineering Students' "
                "Association (NESA) quiz competition after a dominant performance at the regional qualifying round "
                "held in Lagos last month.</p>"
                "<p>The team — comprising Emeka Eze (300L), Bolaji Oduya (400L), and Amira Hassan (500L) — won "
                "all four of their group-stage matches and topped their pool with a perfect score. In the "
                "semifinal, they edged out the University of Lagos team 14–11 in a tense final round.</p>"
                "<p>\"We prepared for six weeks straight,\" said Emeka Eze. \"The industrial engineering syllabus "
                "is broad, but we drilled every topic from ergonomics to supply chain strategy.\"</p>"
                "<p>The national final is scheduled for April. IESA will be cheering them on!</p>"
            ),
            "excerpt": "The IESA quiz team qualifies for the NESA national final after a dominant regional performance.",
            "category": "news", "tags": ["Quiz", "NESA", "Achievement", "Competition"],
            "coverImageUrl": None, "authorId": fatima_id, "authorName": "Fatima Yusuf",
            "status": "published", "viewCount": 183, "likeCount": 71, "likedBy": [],
            "publishedAt": NOW - timedelta(days=18), "submittedAt": NOW - timedelta(days=20),
            "reviewedAt": NOW - timedelta(days=19), "reviewedBy": reviewer_id,
        },
        {
            "title": "SIWES Survival Guide: Lessons From Students Who've Been There",
            "slug": "siwes-survival-guide-lessons-from-students-who-ve-been-there",
            "content": (
                "<p>Students in Industrial Engineering at UI undergo the Students' Industrial Work Experience "
                "Scheme (SIWES) during their 400-level year. It's one of the most formative — and stressful — "
                "parts of the programme. Here's what our seniors wish they'd known going in.</p>"
                "<p><strong>Start your placement search early.</strong> \"I started in March for a July placement "
                "and I was lucky to get Dangote,\" says Bolaji Oduya (400L). \"My classmates who started in May "
                "ended up scrambling.\"</p>"
                "<p><strong>Keep a daily logbook from day one.</strong> Your SIWES report is your insurance. "
                "Document every task, project, and meeting. Supervisors often ask for evidence you were actually "
                "engaged, not just physically present.</p>"
                "<p><strong>Ask questions — boldly.</strong> The biggest mistake students make is staying quiet "
                "to avoid looking ignorant. Industry supervisors respect curiosity.</p>"
                "<p>IESA is organising a SIWES Q&A session next month. Watch this space for details.</p>"
            ),
            "excerpt": "400L students share hard-won lessons about SIWES placements, logbooks, and getting the most out of industrial experience.",
            "category": "campus_life", "tags": ["SIWES", "400L", "Industry", "Career Tips"],
            "coverImageUrl": None, "authorId": bolaji_id, "authorName": "Bolaji Oduya",
            "status": "published", "viewCount": 128, "likeCount": 44, "likedBy": [],
            "publishedAt": NOW - timedelta(days=10), "submittedAt": NOW - timedelta(days=13),
            "reviewedAt": NOW - timedelta(days=11), "reviewedBy": reviewer_id,
        },
        {
            "title": "The Hidden Value of Lean Six Sigma for IE Students",
            "slug": "the-hidden-value-of-lean-six-sigma-for-ie-students",
            "content": (
                "<p>Most students know that Lean and Six Sigma are popular in manufacturing. Fewer realise just "
                "how directly they map to the Industrial Engineering curriculum at UI.</p>"
                "<p>When you study waste elimination in IEE 401 (Production Management), you're studying the "
                "foundation of Lean. When you design experiments in IEE 305 (Engineering Statistics), you're "
                "practising the statistical backbone of Six Sigma. The connection is not coincidental — IE is "
                "the original home of these methodologies.</p>"
                "<p>Getting a Lean Six Sigma Yellow Belt certification while in school is achievable, affordable, "
                "and increasingly expected by manufacturing recruiters in Nigeria. The IESA Lean Six Sigma Seminar "
                "held last November was a great introduction — look for the slides in the resource library.</p>"
            ),
            "excerpt": "Lean Six Sigma isn't just a corporate buzzword — it's built on the same foundations you study in your IE courses.",
            "category": "opinion", "tags": ["Lean", "Six Sigma", "Career", "Manufacturing"],
            "coverImageUrl": None, "authorId": emeka_id, "authorName": "Emeka Eze",
            "status": "published", "viewCount": 76, "likeCount": 29, "likedBy": [],
            "publishedAt": NOW - timedelta(days=5), "submittedAt": NOW - timedelta(days=7),
            "reviewedAt": NOW - timedelta(days=6), "reviewedBy": reviewer_id,
        },
        {
            "title": "Careers Fair Preview: 12 Companies Coming to Campus",
            "slug": "careers-fair-preview-12-companies-coming-to-campus",
            "content": (
                "<p>The IESA Annual Careers Fair is returning on March 15, 2026, and this year's edition is the "
                "biggest yet — with 12 companies confirmed to attend, including Dangote Cement, Unilever Nigeria, "
                "Julius Berger, Access Bank's Operations Division, and Flour Mills Nigeria.</p>"
                "<p>The fair is open to all levels, though 400L and 500L students are most likely to receive "
                "direct internship and graduate trainee offers. 300L students are also encouraged to attend for "
                "networking and to learn what skills companies are looking for in upcoming graduates.</p>"
                "<p><strong>Tips to prepare:</strong> Bring 5 printed CV copies. Research at least 3 companies "
                "in advance. Prepare a 30-second personal pitch. Dress formally.</p>"
                "<p>Registration for time-slot interviews will open on the IESA portal next week.</p>"
            ),
            "excerpt": "12 top companies are confirmed for the IESA Careers Fair on March 15 — here's how to prepare.",
            "category": "news", "tags": ["Careers Fair", "Jobs", "Internship", "Networking"],
            "coverImageUrl": None, "authorId": pelumi_id, "authorName": "Pelumi Afolabi",
            "status": "published", "viewCount": 244, "likeCount": 89, "likedBy": [],
            "publishedAt": NOW - timedelta(days=3), "submittedAt": NOW - timedelta(days=5),
            "reviewedAt": NOW - timedelta(days=4), "reviewedBy": reviewer_id,
        },
        {
            "title": "A Final Year Student's Reflections on Five Years in Industrial Engineering",
            "slug": "final-year-student-reflections-five-years-industrial-engineering",
            "content": (
                "<p>I won't pretend the journey was easy. When I arrived for my 100-level orientation in 2020, "
                "I had no clear idea what Industrial Engineering was. The phrase 'optimise systems and processes' "
                "that every lecturer recites meant nothing to me.</p>"
                "<p>Five years later, I understand it in my bones. I've watched supply chains fail, modelled queue "
                "systems for a hospital in my FYP, and survived four exam seasons. Here's what I know now that I "
                "wish I'd known then.</p>"
                "<p><strong>Your course mates are your greatest asset.</strong> The solution to every difficult "
                "assignment, the best internship tips, the mental support at 2am before an exam — it all came "
                "from my peers.</p>"
                "<p><strong>Use the library resources early.</strong> Past questions are your compass. Start "
                "studying them in week 3, not week 12.</p>"
                "<p>To my juniors: this department will push you. Let it. </p>"
            ),
            "excerpt": "A 500L student reflects on five years of industrial engineering — the struggles, the lessons, and the friendships that made it worth it.",
            "category": "campus_life", "tags": ["500L", "FYP", "Reflection", "Graduating"],
            "coverImageUrl": None, "authorId": jide_id, "authorName": "Jide Akinola",
            "status": "published", "viewCount": 198, "likeCount": 77, "likedBy": [],
            "publishedAt": NOW - timedelta(days=1), "submittedAt": NOW - timedelta(days=3),
            "reviewedAt": NOW - timedelta(days=1), "reviewedBy": reviewer_id,
        },
        {
            "title": "What to Expect as a 100-Level Industrial Engineering Student",
            "slug": "what-to-expect-100-level-industrial-engineering-student",
            "content": (
                "<p>Starting university as a 100-level student can be both exciting and overwhelming. This guide "
                "walks you through what to expect in your first year of Industrial Engineering at UI.</p>"
                "<p>Your first-year courses will include Mathematics, Physics, Chemistry, and introduction to "
                "engineering courses. These lay the foundation for the more specialised IE courses in 200L and above. "
                "Don't underestimate them — many students struggle later because they skipped the basics.</p>"
                "<p>Join the IESA Study Groups early. The Maths Methods group for 200L students is especially "
                "popular and the peer teaching makes a real difference. Start asking seniors for past questions "
                "from your very first semester.</p>"
            ),
            "excerpt": "Senior students share everything 100-level IE students need to know to thrive in their first year at UI.",
            "category": "campus_life", "tags": ["100L", "Guide", "New Students"],
            "coverImageUrl": None, "authorId": aisha_id, "authorName": "Aisha Bello",
            "status": "draft", "viewCount": 0, "likeCount": 0, "likedBy": [],
            "publishedAt": None, "submittedAt": None, "reviewedAt": None, "reviewedBy": None,
        },
    ]
    docs = [{**a, "feedback": [], "sessionId": session_id,
             "createdAt": NOW - timedelta(days=125), "updatedAt": NOW}
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
    tobi_id    = users.get("tobi@iesa.dev",         admin_id)
    grace_id   = users.get("grace@iesa.dev",        admin_id)
    aisha_id   = users.get("aisha@stu.ui.edu.ng",   admin_id)
    emeka_id   = users.get("emeka@stu.ui.edu.ng",   admin_id)
    sola_id    = users.get("sola@stu.ui.edu.ng",    admin_id)
    jide_id    = users.get("jide@stu.ui.edu.ng",    admin_id)
    amira_id   = users.get("amira@stu.ui.edu.ng",   admin_id)
    bolaji_id  = users.get("bolaji@stu.ui.edu.ng",  admin_id)
    ifeoma_id  = users.get("ifeoma@iesa.dev",       admin_id)

    resources = [
        # ── 100L ─────────────────────────────────────────────────────────────────
        {
            "title": "CHM 101 General Chemistry — Past Questions (2020-2024)",
            "description": "Five years of 100L General Chemistry exam questions covering atomic structure, bonding, stoichiometry, and thermochemistry.",
            "type": "pastQuestion", "courseCode": "CHM 101", "level": 100,
            "url": "https://drive.google.com/file/d/sample_chm101_pq",
            "driveFileId": None, "youtubeVideoId": None, "fileType": "pdf", "fileSize": 1843200,
            "uploadedBy": aisha_id, "uploaderName": "Aisha Bello",
            "tags": ["Past Questions", "Chemistry", "100L"], "downloadCount": 134, "viewCount": 221,
            "isApproved": True, "approvedBy": admin_id, "feedback": None,
        },
        {
            "title": "MTH 101 Elementary Mathematics I — Compiled Notes",
            "description": "Comprehensive notes on algebra, trigonometry, and introductory calculus for 100L engineering students.",
            "type": "note", "courseCode": "MTH 101", "level": 100,
            "url": "https://drive.google.com/file/d/sample_mth101_notes",
            "driveFileId": None, "youtubeVideoId": None, "fileType": "pdf", "fileSize": 921600,
            "uploadedBy": emeka_id, "uploaderName": "Emeka Eze",
            "tags": ["Notes", "Mathematics", "100L", "Calculus"], "downloadCount": 189, "viewCount": 302,
            "isApproved": True, "approvedBy": admin_id, "feedback": None,
        },
        # ── 200L ─────────────────────────────────────────────────────────────────
        {
            "title": "MTH 201 Mathematical Methods I — Summary Notes",
            "description": "Exam-ready notes on ODE, Laplace Transforms, and Fourier Series for 200L students.",
            "type": "note", "courseCode": "MTH 201", "level": 200,
            "url": "https://drive.google.com/file/d/sample_mth201_notes",
            "driveFileId": None, "youtubeVideoId": None, "fileType": "pdf", "fileSize": 1024000,
            "uploadedBy": aisha_id, "uploaderName": "Aisha Bello",
            "tags": ["Notes", "ODE", "Laplace", "200L"], "downloadCount": 44, "viewCount": 76,
            "isApproved": True, "approvedBy": admin_id, "feedback": None,
        },
        {
            "title": "Introduction to Industrial Engineering — Textbook (Groover)",
            "description": "Fundamentals of Modern Manufacturing by Groover — recommended for 200L & 300L students.",
            "type": "textbook", "courseCode": "IEE 201", "level": 200,
            "url": "https://drive.google.com/file/d/sample_groover_textbook",
            "driveFileId": None, "youtubeVideoId": None, "fileType": "pdf", "fileSize": 25600000,
            "uploadedBy": admin_id, "uploaderName": "Admin User",
            "tags": ["Textbook", "Manufacturing", "Groover", "200L"], "downloadCount": 103, "viewCount": 174,
            "isApproved": True, "approvedBy": admin_id, "feedback": None,
        },
        {
            "title": "IEE 201 Introduction to IE — Lecture Slides (Full Semester)",
            "description": "Complete set of IEE 201 lecture slides covering work study, method study, and basic systems concepts.",
            "type": "slide", "courseCode": "IEE 201", "level": 200,
            "url": "https://drive.google.com/file/d/sample_iee201_slides",
            "driveFileId": None, "youtubeVideoId": None, "fileType": "pdf", "fileSize": 7340032,
            "uploadedBy": sola_id, "uploaderName": "Sola Bankole",
            "tags": ["Slides", "Work Study", "200L", "System Analysis"], "downloadCount": 67, "viewCount": 111,
            "isApproved": True, "approvedBy": admin_id, "feedback": None,
        },
        # ── 300L ─────────────────────────────────────────────────────────────────
        {
            "title": "IEE 301 Operations Research I — Past Questions (2020-2024)",
            "description": "Compiled past exam questions for OR I, covering 5 years of semester exams.",
            "type": "pastQuestion", "courseCode": "IEE 301", "level": 300,
            "url": "https://drive.google.com/file/d/sample_or1_pq",
            "driveFileId": None, "youtubeVideoId": None, "fileType": "pdf", "fileSize": 2048000,
            "uploadedBy": tobi_id, "uploaderName": "Tobi Adeyemi",
            "tags": ["Past Questions", "OR I", "Simplex"], "downloadCount": 87, "viewCount": 153,
            "isApproved": True, "approvedBy": admin_id, "feedback": None,
        },
        {
            "title": "IEE 305 Engineering Statistics — Past Questions (2019-2023)",
            "description": "Past questions covering probability, distributions, hypothesis testing, and regression analysis.",
            "type": "pastQuestion", "courseCode": "IEE 305", "level": 300,
            "url": "https://drive.google.com/file/d/sample_stats_pq",
            "driveFileId": None, "youtubeVideoId": None, "fileType": "pdf", "fileSize": 1536000,
            "uploadedBy": emeka_id, "uploaderName": "Emeka Eze",
            "tags": ["Past Questions", "Statistics", "300L"], "downloadCount": 55, "viewCount": 89,
            "isApproved": True, "approvedBy": admin_id, "feedback": None,
        },
        {
            "title": "Operations Research I — Video Lecture Series (Simplex Method)",
            "description": "YouTube playlist covering simplex method, big-M method, and sensitivity analysis with worked examples.",
            "type": "video", "courseCode": "IEE 301", "level": 300,
            "url": "https://www.youtube.com/watch?v=example_or_simplex",
            "driveFileId": None, "youtubeVideoId": "example_or_simplex", "fileType": None, "fileSize": None,
            "uploadedBy": tobi_id, "uploaderName": "Tobi Adeyemi",
            "tags": ["Video", "Simplex", "OR I", "300L"], "downloadCount": 0, "viewCount": 88,
            "isApproved": True, "approvedBy": admin_id, "feedback": None,
        },
        # ── 400L ─────────────────────────────────────────────────────────────────
        {
            "title": "IEE 403 Quality Control — Lecture Slides (Dr. Falade)",
            "description": "Full slide set covering control charts, OC curves, acceptance sampling, and reliability.",
            "type": "slide", "courseCode": "IEE 403", "level": 400,
            "url": "https://drive.google.com/file/d/sample_qc_slides",
            "driveFileId": None, "youtubeVideoId": None, "fileType": "pdf", "fileSize": 5120000,
            "uploadedBy": grace_id, "uploaderName": "Grace Adebayo",
            "tags": ["Slides", "Quality Control", "SPC", "400L"], "downloadCount": 62, "viewCount": 98,
            "isApproved": True, "approvedBy": admin_id, "feedback": None,
        },
        {
            "title": "IEE 499 SIWES Report Template (2025/2026)",
            "description": "Official SIWES report template for 400L students with all required sections pre-filled with guidance notes.",
            "type": "note", "courseCode": "IEE 499", "level": 400,
            "url": "https://drive.google.com/file/d/sample_siwes_template",
            "driveFileId": None, "youtubeVideoId": None, "fileType": "docx", "fileSize": 512000,
            "uploadedBy": grace_id, "uploaderName": "Grace Adebayo",
            "tags": ["SIWES", "Template", "400L", "Report"], "downloadCount": 78, "viewCount": 112,
            "isApproved": True, "approvedBy": admin_id, "feedback": None,
        },
        {
            "title": "Lean Six Sigma Yellow Belt Study Guide",
            "description": "Self-study guide covering DMAIC, the 8 wastes, 5S, and value stream mapping. Useful for IESA's annual LSS seminar.",
            "type": "note", "courseCode": "IEE 401", "level": 400,
            "url": "https://drive.google.com/file/d/sample_lss_guide",
            "driveFileId": None, "youtubeVideoId": None, "fileType": "pdf", "fileSize": 3145728,
            "uploadedBy": bolaji_id, "uploaderName": "Bolaji Oduya",
            "tags": ["Lean", "Six Sigma", "DMAIC", "400L"], "downloadCount": 49, "viewCount": 83,
            "isApproved": True, "approvedBy": admin_id, "feedback": None,
        },
        # ── 500L ─────────────────────────────────────────────────────────────────
        {
            "title": "IEE 501 Advanced Operations Research — Past Questions (2019-2023)",
            "description": "Five years of IEE 501 exam questions covering integer programming, network flows, and dynamic programming.",
            "type": "pastQuestion", "courseCode": "IEE 501", "level": 500,
            "url": "https://drive.google.com/file/d/sample_or2_pq",
            "driveFileId": None, "youtubeVideoId": None, "fileType": "pdf", "fileSize": 2097152,
            "uploadedBy": amira_id, "uploaderName": "Amira Hassan",
            "tags": ["Past Questions", "Advanced OR", "500L"], "downloadCount": 41, "viewCount": 64,
            "isApproved": True, "approvedBy": admin_id, "feedback": None,
        },
        {
            "title": "Introduction to Arena Simulation Software",
            "description": "Tutorial series on Arena — modelling queues, resources, and entities for discrete-event simulation.",
            "type": "video", "courseCode": "IEE 507", "level": 500,
            "url": "https://www.youtube.com/watch?v=example_arena",
            "driveFileId": None, "youtubeVideoId": "example_arena", "fileType": None, "fileSize": None,
            "uploadedBy": tobi_id, "uploaderName": "Tobi Adeyemi",
            "tags": ["Arena", "Simulation", "Video", "500L"], "downloadCount": 0, "viewCount": 121,
            "isApproved": True, "approvedBy": admin_id, "feedback": None,
        },
        {
            "title": "FYP Writing & Referencing Guide (IEEE Format)",
            "description": "Step-by-step guide to writing a final year project report with proper IEEE citations, abstract, and appendix structure.",
            "type": "note", "courseCode": "IEE 509", "level": 500,
            "url": "https://drive.google.com/file/d/sample_fyp_writing_guide",
            "driveFileId": None, "youtubeVideoId": None, "fileType": "pdf", "fileSize": 2621440,
            "uploadedBy": ifeoma_id, "uploaderName": "Ifeoma Nwosu",
            "tags": ["FYP", "Writing", "IEEE", "Referencing", "500L"], "downloadCount": 92, "viewCount": 147,
            "isApproved": True, "approvedBy": admin_id, "feedback": None,
        },
        # ── Pending approval ──────────────────────────────────────────────────────
        {
            "title": "Engineering Drawing — First and Third Angle Projection Notes",
            "description": "Comprehensive illustrated notes on orthographic projection, sectional views, and dimensioning for 100L and 200L.",
            "type": "note", "courseCode": "GEE 101", "level": 100,
            "url": "https://drive.google.com/file/d/sample_engdrawing_notes",
            "driveFileId": None, "youtubeVideoId": None, "fileType": "pdf", "fileSize": 4194304,
            "uploadedBy": jide_id, "uploaderName": "Jide Akinola",
            "tags": ["Engineering Drawing", "Projection", "100L", "200L"], "downloadCount": 0, "viewCount": 3,
            "isApproved": False, "approvedBy": None,
            "feedback": "Good resource — please compress the file to under 3MB before we approve.",
        },
    ]
    docs = [{**r, "sessionId": session_id, "createdAt": NOW - timedelta(days=30), "updatedAt": NOW}
            for r in resources]
    await coll.insert_many(docs)
    approved = sum(1 for r in resources if r["isApproved"])
    pending  = sum(1 for r in resources if not r["isApproved"])
    print(f"   ✓ Resources: {len(docs)} library resources ({approved} approved, {pending} pending)")


# ───────────────────────────────────────────────────────────────────────
# TIMP
# ───────────────────────────────────────────────────────────────────────

async def seed_timp(db, session_id: str, users: dict[str, str], admin_id: str):
    """Seed TIMP mentor applications and active pairs."""
    app_coll  = db["timpApplications"]
    pair_coll = db["timpPairs"]

    mentor_apps = [
        {
            "userId": users.get("grace@iesa.dev"), "userName": "Grace Adebayo", "userLevel": "400L",
            "motivation": "I want to give back. My seniors mentored me through 300L and I would love to do the same for younger students.",
            "skills": "Operations Research, Engineering Statistics, Python, Study skills planning",
            "availability": "Weekday evenings (5–7pm) and Saturday mornings",
            "maxMentees": 2, "status": "approved",
            "feedback": "Approved. Grace consistently performs well and demonstrates strong communication skills.",
            "sessionId": session_id, "reviewedBy": admin_id,
        },
        {
            "userId": users.get("hakeem@iesa.dev"), "userName": "Hakeem Ibrahim", "userLevel": "400L",
            "motivation": "I completed SIWES at Dangote last session and want to share practical industry experience with juniors preparing for placement.",
            "skills": "Process Engineering, MATLAB, AutoCAD, Industry readiness coaching",
            "availability": "Weekends, flexible timing",
            "maxMentees": 2, "status": "approved",
            "feedback": "Approved. Excellent SIWES track record.", "sessionId": session_id, "reviewedBy": admin_id,
        },
        {
            "userId": users.get("ifeoma@iesa.dev"), "userName": "Ifeoma Nwosu", "userLevel": "500L",
            "motivation": "As a final year student I can guide 300L and 400L students on coursework, FYP topic selection, and career planning.",
            "skills": "Research methods, Arena simulation, LaTeX, FYP writing, academic strategy",
            "availability": "Wednesdays 6–8pm, Sundays anytime",
            "maxMentees": 3, "status": "approved",
            "feedback": "Approved — Ifeoma's academic profile makes her an excellent mentor.", "sessionId": session_id, "reviewedBy": admin_id,
        },
        {
            "userId": users.get("fatima@stu.ui.edu.ng"), "userName": "Fatima Yusuf", "userLevel": "300L",
            "motivation": "I have a strong academic record and enjoy explaining concepts clearly. I'd like to mentor 100L and 200L students.",
            "skills": "Operations Research, Statistics, Microsoft Office, public speaking",
            "availability": "Tuesdays and Thursdays, 4–6pm",
            "maxMentees": 3, "status": "pending",
            "feedback": None, "sessionId": session_id, "reviewedBy": None,
        },
        {
            "userId": users.get("bolaji@stu.ui.edu.ng"), "userName": "Bolaji Oduya", "userLevel": "400L",
            "motivation": "I struggled a lot in 200L and found my footing through peer support. I want to help 200L students avoid the same pitfalls.",
            "skills": "Quality Control, SIWES preparation, time management, peer tutoring",
            "availability": "Saturday afternoons",
            "maxMentees": 2, "status": "pending",
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
            "mentorId": users.get("grace@iesa.dev"),   "mentorName": "Grace Adebayo",
            "menteeId": users.get("aisha@stu.ui.edu.ng"), "menteeName": "Aisha Bello",
            "status": "active", "sessionId": session_id, "feedbackCount": 3,
            "lastActivity": NOW - timedelta(days=2),
        },
        {
            "mentorId": users.get("grace@iesa.dev"),   "mentorName": "Grace Adebayo",
            "menteeId": users.get("chidi@stu.ui.edu.ng"), "menteeName": "Chidi Okonkwo",
            "status": "active", "sessionId": session_id, "feedbackCount": 2,
            "lastActivity": NOW - timedelta(days=5),
        },
        {
            "mentorId": users.get("hakeem@iesa.dev"),  "mentorName": "Hakeem Ibrahim",
            "menteeId": users.get("fatima@stu.ui.edu.ng"), "menteeName": "Fatima Yusuf",
            "status": "active", "sessionId": session_id, "feedbackCount": 1,
            "lastActivity": NOW - timedelta(days=7),
        },
        {
            "mentorId": users.get("hakeem@iesa.dev"),  "mentorName": "Hakeem Ibrahim",
            "menteeId": users.get("tunde@stu.ui.edu.ng"), "menteeName": "Tunde Olamide",
            "status": "active", "sessionId": session_id, "feedbackCount": 0,
            "lastActivity": NOW - timedelta(days=3),
        },
        {
            "mentorId": users.get("ifeoma@iesa.dev"),  "mentorName": "Ifeoma Nwosu",
            "menteeId": users.get("bolaji@stu.ui.edu.ng"), "menteeName": "Bolaji Oduya",
            "status": "active", "sessionId": session_id, "feedbackCount": 2,
            "lastActivity": NOW - timedelta(days=4),
        },
        {
            "mentorId": users.get("ifeoma@iesa.dev"),  "mentorName": "Ifeoma Nwosu",
            "menteeId": users.get("chiamaka@stu.ui.edu.ng"), "menteeName": "Chiamaka Obi",
            "status": "active", "sessionId": session_id, "feedbackCount": 1,
            "lastActivity": NOW - timedelta(days=6),
        },
        {
            "mentorId": users.get("ifeoma@iesa.dev"),  "mentorName": "Ifeoma Nwosu",
            "menteeId": users.get("ngozi@stu.ui.edu.ng"), "menteeName": "Ngozi Chukwuma",
            "status": "active", "sessionId": session_id, "feedbackCount": 0,
            "lastActivity": NOW - timedelta(days=1),
        },
    ]
    pair_docs = [
        {**p, "createdAt": NOW - timedelta(days=14), "updatedAt": NOW}
        for p in pairs if p["mentorId"] and p["menteeId"]
    ]
    if pair_docs:
        await pair_coll.insert_many(pair_docs)
    approved_apps = sum(1 for a in mentor_apps if a["status"] == "approved")
    pending_apps  = sum(1 for a in mentor_apps if a["status"] == "pending")
    print(f"   ✓ TIMP: {len(app_docs)} mentor apps ({approved_apps} approved, {pending_apps} pending), {len(pair_docs)} active pairs")


# ───────────────────────────────────────────────────────────────────────
# Unit Applications
# ───────────────────────────────────────────────────────────────────────

async def seed_unit_applications(db, session_id: str, users: dict[str, str], admin_id: str):
    """Seed unit/committee applications."""
    coll = db["unitApplications"]
    applications = [
        # Accepted
        {
            "userId": users.get("aisha@stu.ui.edu.ng"), "userName": "Aisha Bello",
            "userEmail": "aisha@stu.ui.edu.ng", "userLevel": "200L",
            "unit": "press", "unitLabel": "IESA Press",
            "motivation": "I love writing and storytelling. I want to document IESA's activities and give students a voice through the newsletter.",
            "skills": "Creative writing, Photography, Social media management",
            "status": "accepted", "feedback": "Welcome to the Press Unit! Report to the first editorial meeting.",
            "reviewedBy": users.get("tobi@iesa.dev"), "reviewerName": "Tobi Adeyemi",
            "sessionId": session_id, "reviewedAt": NOW - timedelta(days=12),
        },
        {
            "userId": users.get("chidi@stu.ui.edu.ng"), "userName": "Chidi Okonkwo",
            "userEmail": "chidi@stu.ui.edu.ng", "userLevel": "200L",
            "unit": "committee_sports", "unitLabel": "Sports Committee",
            "motivation": "I am an active footballer and I want to help organise inter-level sports events and the departmental games.",
            "skills": "Sports coordination, Event logistics, Team motivation",
            "status": "accepted", "feedback": None,
            "reviewedBy": admin_id, "reviewerName": "Admin User",
            "sessionId": session_id, "reviewedAt": NOW - timedelta(days=10),
        },
        {
            "userId": users.get("sola@stu.ui.edu.ng"), "userName": "Sola Bankole",
            "userEmail": "sola@stu.ui.edu.ng", "userLevel": "300L",
            "unit": "committee_academic", "unitLabel": "Academic Committee",
            "motivation": "I want to help organise study sessions and exam prep resources. I already run a 300L study group and would like to scale it.",
            "skills": "Study session facilitation, Resource curation, Operations Research tutoring",
            "status": "accepted", "feedback": "Great initiative — welcome aboard!",
            "reviewedBy": admin_id, "reviewerName": "Admin User",
            "sessionId": session_id, "reviewedAt": NOW - timedelta(days=9),
        },
        {
            "userId": users.get("amira@stu.ui.edu.ng"), "userName": "Amira Hassan",
            "userEmail": "amira@stu.ui.edu.ng", "userLevel": "500L",
            "unit": "press", "unitLabel": "IESA Press",
            "motivation": "I'm a final year student who wants to leave behind quality documented content for juniors. I've written for the faculty newsletter before.",
            "skills": "Technical writing, Proofreading, MS Publisher, Interview technique",
            "status": "accepted", "feedback": "Accepted as senior editor.",
            "reviewedBy": users.get("tobi@iesa.dev"), "reviewerName": "Tobi Adeyemi",
            "sessionId": session_id, "reviewedAt": NOW - timedelta(days=11),
        },
        # Pending
        {
            "userId": users.get("ngozi@stu.ui.edu.ng"), "userName": "Ngozi Chukwuma",
            "userEmail": "ngozi@stu.ui.edu.ng", "userLevel": "100L",
            "unit": "committee_academic", "unitLabel": "Academic Committee",
            "motivation": "As a fresh student I want to help organise study sessions and collate past questions from seniors.",
            "skills": "Research, Microsoft Office, Enthusiasm and commitment",
            "status": "pending", "feedback": None,
            "reviewedBy": None, "reviewerName": None,
            "sessionId": session_id, "reviewedAt": None,
        },
        {
            "userId": users.get("lekan@stu.ui.edu.ng"), "userName": "Lekan Alabi",
            "userEmail": "lekan@stu.ui.edu.ng", "userLevel": "100L",
            "unit": "committee_welfare", "unitLabel": "Welfare Committee",
            "motivation": "I am empathetic and want to support student welfare initiatives and help classmates who are struggling.",
            "skills": "Communication, Compassion, Conflict resolution",
            "status": "pending", "feedback": None,
            "reviewedBy": None, "reviewerName": None,
            "sessionId": session_id, "reviewedAt": None,
        },
        {
            "userId": users.get("tunde@stu.ui.edu.ng"), "userName": "Tunde Olamide",
            "userEmail": "tunde@stu.ui.edu.ng", "userLevel": "200L",
            "unit": "committee_social", "unitLabel": "Social Committee",
            "motivation": "I love events, parties, and getting people together. I helped organise my secondary school's graduation prom and want to bring that energy to IESA.",
            "skills": "Event planning, Budget management, Vendor coordination, Design (Canva)",
            "status": "pending", "feedback": None,
            "reviewedBy": None, "reviewerName": None,
            "sessionId": session_id, "reviewedAt": None,
        },
        {
            "userId": users.get("wunmi@stu.ui.edu.ng"), "userName": "Wunmi Adeleke",
            "userEmail": "wunmi@stu.ui.edu.ng", "userLevel": "100L",
            "unit": "committee_welfare", "unitLabel": "Welfare Committee",
            "motivation": "I want to contribute to making this department a welcoming place. I can help with welfare visits and support coordination.",
            "skills": "Interpersonal skills, MS Excel (basic), Time-keeping",
            "status": "pending", "feedback": None,
            "reviewedBy": None, "reviewerName": None,
            "sessionId": session_id, "reviewedAt": None,
        },
        # Rejected
        {
            "userId": users.get("victor@stu.ui.edu.ng"), "userName": "Victor Adegoke",
            "userEmail": "victor@stu.ui.edu.ng", "userLevel": "100L",
            "unit": "press", "unitLabel": "IESA Press",
            "motivation": "I want to write articles.",
            "skills": "Writing",
            "status": "rejected",
            "feedback": "Your application was too brief. We need to see specific writing samples and a clearer motivation. Please reapply next session with a stronger portfolio.",
            "reviewedBy": users.get("tobi@iesa.dev"), "reviewerName": "Tobi Adeyemi",
            "sessionId": session_id, "reviewedAt": NOW - timedelta(days=8),
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
    rejected = sum(1 for a in docs if a["status"] == "rejected")
    print(f"   ✓ Unit Applications: {len(docs)} ({accepted} accepted, {pending} pending, {rejected} rejected)")


# ───────────────────────────────────────────────────────────────────────
# Previous-Session Archive Data
# ───────────────────────────────────────────────────────────────────────

async def seed_previous_session_data(db, prev_session_id: str, users: dict[str, str], admin_id: str):
    """Seed 2024/2025 events and announcements for the archive page."""
    ann_coll   = db["announcements"]
    event_coll = db["events"]

    prev_anns = [
        {
            "title": "Welcome to the 2024/2025 Academic Session",
            "content": "Dear students, welcome back! The IESA executive committee is ready to serve you this session. Our priorities this year include expanding the TIMP programme, launching the digital resource library, and organising a full departmental careers fair in Semester 2.",
            "priority": "high", "isPinned": True, "targetLevels": None,
        },
        {
            "title": "2024/2025 Dues Payment Now Open",
            "content": "Payment of IESA departmental dues for 2024/2025 is now open. Amount: ₦3,000. Deadline: 30 November 2024. Payment is accepted at the IESA office or via bank transfer to the association's GTBank account (see details on the portal). Proof of payment must be submitted to the financial secretary.",
            "priority": "urgent", "isPinned": False, "targetLevels": None,
        },
        {
            "title": "Semester 2 Registration Notice (2024/2025)",
            "content": "Semester 2 course registration is open from 3 February 2025. Students must complete registration before 14 February 2025 to avoid a late fee. Log in to the faculty portal and select your courses. Contact the academic secretary if you encounter any issues.",
            "priority": "urgent", "isPinned": False, "targetLevels": None,
        },
        {
            "title": "Semester 1 Examination Timetable Released",
            "content": "The Semester 1 examination timetable for 2024/2025 has been released by the faculty. Please check the departmental notice board or download from the faculty portal. All students are advised to confirm their course registrations align with the timetable. Report any discrepancies to the examination office immediately.",
            "priority": "urgent", "isPinned": True, "targetLevels": None,
        },
        {
            "title": "SIWES Forms — 400 Level Students",
            "content": "400L students must collect their SIWES placement forms from the IT coordinator (Room 204, IE Building) before Friday, 28 March 2025. Students who have already secured placement letters from their companies should attach them. Uncollected forms will be forfeited.",
            "priority": "high", "isPinned": False, "targetLevels": ["400L"],
        },
        {
            "title": "IESA Quiz Team Selected for NESA Regional Round",
            "content": "Congratulations to Emeka Eze (300L), Jide Akinola (500L), and Fatima Yusuf (300L) who have been selected to represent IESA at the NESA Regional Quiz Competition in Ibadan on April 12, 2025. The team has been training for two months. Show them your support!",
            "priority": "normal", "isPinned": False, "targetLevels": None,
        },
        {
            "title": "End of Session Notice — Clearance Procedure",
            "content": "The 2024/2025 academic session is winding down. All students must complete the departmental clearance process before July 31, 2025. This involves returning borrowed library materials, settling any outstanding dues, and signing the clearance register at the IESA office.",
            "priority": "high", "isPinned": False, "targetLevels": None,
        },
    ]
    ann_docs = []
    base_dates = [
        _dt(2024, 9, 20), _dt(2024, 10, 5), _dt(2025, 2, 1), _dt(2024, 11, 15),
        _dt(2025, 3, 25), _dt(2025, 3, 30), _dt(2025, 6, 20),
    ]
    for i, a in enumerate(prev_anns):
        ann_docs.append({
            **a, "sessionId": prev_session_id, "authorId": admin_id,
            "authorName": "Admin User", "readBy": list(users.values()),
            "expiresAt": None,
            "createdAt": base_dates[i],
            "updatedAt": _dt(2025, 7, 1),
        })
    await ann_coll.insert_many(ann_docs)

    prev_events = [
        {
            "title": "IESA Freshers Night 2024", "category": "Social",
            "description": "Welcome event for the incoming 100L class of 2024/2025. Held at Trenchard Hall with live DJ, games, and awards for the most creative freshers.",
            "date": _dt(2024, 10, 6, 18, 0), "location": "Trenchard Hall, University of Ibadan",
            "maxAttendees": 200, "requiresPayment": False,
            "registrations": [], "attendees": [], "imageUrl": None,
        },
        {
            "title": "Industrial Visit — Nestle Nigeria (Flowergate Plant)", "category": "Career",
            "description": "IESA organised industrial visit to the Nestle Nigeria manufacturing plant in Sagamu, Ogun State. 44 students and 2 faculty supervisors attended.",
            "date": _dt(2024, 11, 23, 7, 0), "location": "Flowergate Factory, Sagamu, Ogun State",
            "maxAttendees": 45, "requiresPayment": True, "paymentAmount": 4500.0,
            "registrations": [], "attendees": [], "imageUrl": None,
        },
        {
            "title": "MATLAB & Python Workshop (2024/2025)", "category": "Academic",
            "description": "Annual IESA technical skills workshop. 68 students attended sessions on MATLAB fundamentals, Python scripting, and engineering data visualisation.",
            "date": _dt(2024, 11, 9, 8, 0), "location": "IE Computer Lab, Faculty of Technology",
            "maxAttendees": 80, "requiresPayment": False,
            "registrations": [], "attendees": [], "imageUrl": None,
        },
        {
            "title": "Careers & Internship Fair 2025", "category": "Career",
            "description": "Second annual IESA Careers Fair attracting 9 companies including Dangote Cement, UAC Foods, Nigerian Breweries, and Emzor Pharmaceuticals. Over 120 students attended.",
            "date": _dt(2025, 3, 8, 9, 0), "location": "IE Seminar Hall & Courtyard",
            "maxAttendees": 150, "requiresPayment": False,
            "registrations": [], "attendees": [], "imageUrl": None,
        },
        {
            "title": "End-of-Session Awards Night (2024/2025)", "category": "Social",
            "description": "IESA celebrated the close of the 2024/2025 session with an awards night honouring the top performers, most active members, and outstanding committee contributions.",
            "date": _dt(2025, 7, 12, 18, 0), "location": "Independence Hall Annex, University of Ibadan",
            "maxAttendees": 150, "requiresPayment": True, "paymentAmount": 5000.0,
            "registrations": [], "attendees": [], "imageUrl": None,
        },
    ]
    event_docs = [
        {**e, "sessionId": prev_session_id, "createdBy": admin_id,
         "createdAt": _dt(2024, 9, 15), "updatedAt": _dt(2025, 7, 15)}
        for e in prev_events
    ]
    await event_coll.insert_many(event_docs)

    print(f"   ✓ Previous session (2024/2025): {len(ann_docs)} announcements, {len(event_docs)} events")


# ───────────────────────────────────────────────────────────────────────
# Collections to clear
# ───────────────────────────────────────────────────────────────────────

COLLECTIONS_TO_CLEAR = [
    "users", "sessions", "enrollments", "roles", "payments", "events",
    "announcements", "audit_logs",
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

        # ── Summary ────────────────────────────────────────────
        print(f"\n{'=' * 60}")
        print(f"  ✅ Seed complete!")
        print(f"{'=' * 60}")
        print(f"\n  Users seeded: 28 total")
        print(f"    1  admin   — admin@iesa.dev")
        print(f"    6  exco    — tobi/emeka/fatima/grace/hakeem/ifeoma @iesa.dev")
        print(f"    21 students — @stu.ui.edu.ng (5×100L, 5×200L, 5×300L, 4×400L, 2×500L)")
        print(f"\n  Login credentials (all passwords: Password1!)")
        print(f"    Admin:          admin@iesa.dev")
        print(f"    President:      tobi@iesa.dev          (ExCo, 400L)")
        print(f"    Gen. Secretary: grace@iesa.dev         (ExCo, 400L)")
        print(f"    Fin. Secretary: emeka@iesa.dev         (ExCo, 300L)")
        print(f"    PRO:            fatima@iesa.dev        (ExCo, 300L)")
        print(f"    Social Dir.:    hakeem@iesa.dev        (ExCo, 400L)")
        print(f"    Academic Dir.:  ifeoma@iesa.dev        (ExCo, 500L)")
        print(f"    100L class rep: kemi@stu.ui.edu.ng")
        print(f"    200L class rep: aisha@stu.ui.edu.ng")
        print(f"    300L class rep: pelumi@stu.ui.edu.ng")
        print(f"    400L class rep: bolaji@stu.ui.edu.ng")
        print(f"    500L class rep: amira@stu.ui.edu.ng")
        print(f"\n  Data summary:")
        print(f"    Sessions:             2  (2025/2026 active, 2024/2025 archived)")
        print(f"    Enrollments:          25")
        print(f"    Roles:                11  (6 exco + 5 class reps)")
        print(f"    Events (current):     10")
        print(f"    Announcements (curr): 12")
        print(f"    Payments:             7")
        print(f"    Bank Transfers:       10  (6 approved, 3 pending, 1 rejected)")
        print(f"    Notifications:        ~60+")
        print(f"    Study Groups:         5   (with full messages)")
        print(f"    Press Articles:       10  (9 published, 1 draft)")
        print(f"    Resources:            15  (14 approved, 1 pending)")
        print(f"    TIMP mentor apps:     5   (3 approved, 2 pending)")
        print(f"    TIMP pairs:           7   active")
        print(f"    Unit applications:    9   (4 accepted, 4 pending, 1 rejected)")
        print(f"    Archive (2024/2025):  7 announcements + 5 events")
        print(f"\n  Active session:  2025/2026  (Semester 2)")
        print(f"  Archive session: 2024/2025")
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
