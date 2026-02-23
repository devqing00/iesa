#!/usr/bin/env python3
"""
Comprehensive Dummy Data Generator for IESA Platform

Generates realistic test data for:
- Users (students and executives)
- Sessions
- Enrollments
- Executive Roles (all positions/sectors)
- Announcements
- Events
- Payments
- Unit Applications
- Grades
"""

import asyncio
import sys
import os
from datetime import datetime, timezone, timedelta
from typing import List, Dict
import random
from bson import ObjectId

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Import after path manipulation
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from app.core.auth import hash_password


# ============================================================================
# CONFIGURATION
# ============================================================================

CURRENT_SESSION = "2024/2025"
PREVIOUS_SESSION = "2023/2024"

# Student names pool
FIRST_NAMES = [
    "Oluwaseun", "Chidinma", "Tunde", "Ngozi", "Emeka", "Fatima", "Chidi", "Kemi",
    "Adebayo", "Blessing", "Yusuf", "Aisha", "Ifeanyi", "Chiamaka", "Babatunde", "Kehinde",
    "Adeola", "Chika", "Ibrahim", "Folake", "Chukwudi", "Zainab", "Obinna", "Titilayo",
    "Adamu", "Onyinye", "Segun", "Hauwa", "Chinedu", "Amara", "Musa", "Bisola",
    "Ikenna", "Funmilayo", "Abdullahi", "Nkechi", "Olumide", "Hadiza", "Ebuka", "Omolola",
    "Sadiq", "Ifeoma", "Tolu", "Zara", "Chukwuma", "Tolani", "Ahmed", "Chinelo",
    "Femi", "Amina", "Uchenna", "Bunmi", "Suleiman", "Adaeze", "Dele", "Jumoke",
]

LAST_NAMES = [
    "Adeleke", "Okonkwo", "Balogun", "Musa", "Eze", "Abdullahi", "Okoro", "Adeyemi",
    "Mohammed", "Nwosu", "Okafor", "Hassan", "Chukwu", "Ibrahim", "Usman", "Odili",
    "Olawale", "Yusuf", "Udoka", "Sanni", "Nnadi", "Garba", "Ekwueme", "Alabi",
    "Ahmed", "Obiora", "Babatunde", "Shehu", "Onwuka", "Fatai", "Ali", "Obi",
    "Tijani", "Uzoma", "Bello", "Chikezie", "Lawal", "Iroha", "Abubakar", "Okafor",
    "Sule", "Nnamdi", "Adebisi", "Sadiq", "Emeka", "Afolabi", "Mustapha", "Chidi",
    "Salisu", "Ifeanyi", "Kehinde", "Idris", "Obinna", "Olugbenga", "Abubakar", "Nwankwo",
]

SKILLS = [
    "Python", "JavaScript", "Data Analysis", "Project Management", "Public Speaking",
    "Graphic Design", "CAD", "MATLAB", "Excel", "Leadership", "Event Planning",
    "Content Writing", "Photography", "Video Editing", "Social Media",
    "Operations Research", "Quality Control", "Supply Chain", "Lean Manufacturing",
    "Six Sigma", "AutoCAD", "SolidWorks", "Statistical Analysis", "Research",
]


# ============================================================================
# EXECUTIVE POSITIONS & UNITS
# ============================================================================

EXECUTIVE_POSITIONS = {
    # Core Executive
    "president": {"title": "President", "permissions": ["*"]},
    "vice_president": {"title": "Vice President", "permissions": ["announcement:create", "event:manage", "payment:view"]},
    "general_secretary": {"title": "General Secretary", "permissions": ["announcement:create", "event:manage", "enrollment:manage"]},
    "assistant_secretary": {"title": "Assistant General Secretary", "permissions": ["announcement:create", "event:view"]},
    "financial_secretary": {"title": "Financial Secretary", "permissions": ["payment:manage", "transaction:verify"]},
    "treasurer": {"title": "Treasurer", "permissions": ["payment:view", "transaction:view"]},
    "public_relations_officer": {"title": "Public Relations Officer (PRO)", "permissions": ["announcement:create", "press:manage"]},
    
    # Directors
    "director_of_socials": {"title": "Director of Socials", "permissions": ["event:manage", "announcement:create"]},
    "director_of_sports": {"title": "Director of Sports", "permissions": ["event:manage", "announcement:create"]},
    "director_of_welfare": {"title": "Director of Welfare", "permissions": ["announcement:create", "payment:view"]},
    "director_of_academics": {"title": "Director of Academics", "permissions": ["grade:view", "announcement:create", "resource:manage"]},
    
    # Unit Heads
    "press_unit_head": {"title": "Press Unit Head", "permissions": ["press:manage", "press:publish"]},
    "academic_committee_head": {"title": "Academic Committee Head", "permissions": ["resource:manage", "grade:view"]},
    "welfare_committee_head": {"title": "Welfare Committee Head", "permissions": ["announcement:create"]},
    "sports_committee_head": {"title": "Sports Committee Head", "permissions": ["event:manage"]},
    "socials_committee_head": {"title": "Socials Committee Head", "permissions": ["event:manage"]},
    
    # Class Representatives
    "class_rep_100L": {"title": "100 Level Class Representative", "permissions": ["announcement:view"], "level": "100L"},
    "class_rep_200L": {"title": "200 Level Class Representative", "permissions": ["announcement:view"], "level": "200L"},
    "class_rep_300L": {"title": "300 Level Class Representative", "permissions": ["announcement:view"], "level": "300L"},
    "class_rep_400L": {"title": "400 Level Class Representative", "permissions": ["announcement:view"], "level": "400L"},
    "class_rep_500L": {"title": "500 Level Class Representative", "permissions": ["announcement:view"], "level": "500L"},
}


# ============================================================================
# DATA GENERATION FUNCTIONS
# ============================================================================

def generate_matric_number(year: int, index: int) -> str:
    """Generate realistic UI matric number (e.g., 20/0001)"""
    year_suffix = str(year)[-2:]
    num = str(index + 1).zfill(4)
    return f"{year_suffix}/{num}"


async def create_users(db, count: int = 50) -> List[Dict]:
    """Create diverse student users"""
    users_collection = db["users"]
    created_users = []
    
    print(f"\n👥 Creating {count} student users...")
    
    levels = ["100L", "200L", "300L", "400L", "500L"]
    admission_years = [2020, 2021, 2022, 2023, 2024]
    
    for i in range(count):
        first_name = random.choice(FIRST_NAMES)
        last_name = random.choice(LAST_NAMES)
        admission_year = random.choice(admission_years)
        
        # Calculate current level based on admission year
        years_since_admission = 2024 - admission_year
        level_index = min(years_since_admission, 4)  # Cap at 500L
        current_level = levels[level_index]
        
        user_data = {
            "email": f"{first_name.lower()}.{last_name.lower()}{random.randint(1, 99)}@stu.ui.edu.ng",
            "firstName": first_name,
            "lastName": last_name,
            "matricNumber": generate_matric_number(admission_year, i),
            "department": "Industrial Engineering",
            "phone": f"+234{random.randint(7000000000, 9099999999)}",
            "role": "student",
            "bio": f"Industrial Engineering student passionate about {random.choice(['innovation', 'optimization', 'technology', 'sustainability', 'leadership'])}.",
            "profilePictureUrl": None,
            "admissionYear": admission_year,
            "currentLevel": current_level,
            "skills": random.sample(SKILLS, k=random.randint(3, 7)),
            "passwordHash": hash_password("Password123!"),  # Default password
            "emailVerified": True,
            "hasCompletedOnboarding": True,
            "isActive": True,
            "createdAt": datetime.now(timezone.utc) - timedelta(days=random.randint(100, 1000)),
            "updatedAt": datetime.now(timezone.utc),
            "lastLogin": datetime.now(timezone.utc) - timedelta(days=random.randint(0, 30)),
        }
        
        result = await users_collection.insert_one(user_data)
        user_data["_id"] = result.inserted_id
        created_users.append(user_data)
    
    print(f"   ✓ Created {len(created_users)} users")
    return created_users


async def create_sessions(db) -> Dict[str, str]:
    """Create current and previous academic sessions"""
    sessions_collection = db["sessions"]
    
    print(f"\n📅 Creating academic sessions...")
    
    sessions_ids = {}
    
    # Previous session (2023/2024)
    prev_session_data = {
        "name": PREVIOUS_SESSION,
        "semester1StartDate": datetime(2023, 9, 1, tzinfo=timezone.utc),
        "semester1EndDate": datetime(2024, 1, 31, tzinfo=timezone.utc),
        "semester2StartDate": datetime(2024, 2, 1, tzinfo=timezone.utc),
        "semester2EndDate": datetime(2024, 8, 31, tzinfo=timezone.utc),
        "isActive": False,
        "createdAt": datetime(2023, 7, 1, tzinfo=timezone.utc),
        "updatedAt": datetime(2023, 7, 1, tzinfo=timezone.utc),
    }
    result = await sessions_collection.insert_one(prev_session_data)
    sessions_ids[PREVIOUS_SESSION] = str(result.inserted_id)
    print(f"   ✓ Created session: {PREVIOUS_SESSION}")
    
    # Current session (2024/2025) - ACTIVE
    curr_session_data = {
        "name": CURRENT_SESSION,
        "semester1StartDate": datetime(2024, 9, 1, tzinfo=timezone.utc),
        "semester1EndDate": datetime(2025, 1, 31, tzinfo=timezone.utc),
        "semester2StartDate": datetime(2025, 2, 1, tzinfo=timezone.utc),
        "semester2EndDate": datetime(2025, 8, 31, tzinfo=timezone.utc),
        "isActive": True,
        "createdAt": datetime(2024, 7, 1, tzinfo=timezone.utc),
        "updatedAt": datetime(2024, 7, 1, tzinfo=timezone.utc),
    }
    result = await sessions_collection.insert_one(curr_session_data)
    sessions_ids[CURRENT_SESSION] = str(result.inserted_id)
    print(f"   ✓ Created active session: {CURRENT_SESSION}")
    
    return sessions_ids


async def create_enrollments(db, users: List[Dict], session_id: str):
    """Enroll all users in the active session"""
    enrollments_collection = db["enrollments"]
    
    print(f"\n📝 Creating enrollments...")
    
    enrollments = []
    for user in users:
        enrollment_data = {
            "studentId": str(user["_id"]),
            "sessionId": session_id,
            "level": user["currentLevel"],
            "enrollmentDate": datetime.now(timezone.utc) - timedelta(days=random.randint(30, 90)),
            "isActive": True,
        }
        enrollments.append(enrollment_data)
    
    if enrollments:
        result = await enrollments_collection.insert_many(enrollments)
        print(f"   ✓ Enrolled {len(result.inserted_ids)} students in {CURRENT_SESSION}")


async def create_executive_roles(db, users: List[Dict], session_id: str, admin_id: str):
    """Create executive positions for the current session"""
    roles_collection = db["roles"]
    
    print(f"\n👔 Creating executive roles...")
    
    # Select users for executive positions (top 20)
    executives = random.sample(users, min(20, len(users)))
    
    roles_created = 0
    for i, (position_key, position_info) in enumerate(EXECUTIVE_POSITIONS.items()):
        if i >= len(executives):
            break
        
        exec_user = executives[i]
        
        role_data = {
            "userId": str(exec_user["_id"]),
            "sessionId": session_id,
            "position": position_key,
            "department": "Industrial Engineering",
            "level": position_info.get("level"),
            "customTitle": position_info["title"],
            "permissions": position_info["permissions"],
            "assignedAt": datetime.now(timezone.utc) - timedelta(days=random.randint(60, 120)),
            "assignedBy": admin_id,
            "isActive": True,
        }
        
        await roles_collection.insert_one(role_data)
        roles_created += 1
    
    print(f"   ✓ Created {roles_created} executive roles")


async def create_announcements(db, users: List[Dict], session_id: str):
    """Create diverse announcements"""
    announcements_collection = db["announcements"]
    
    print(f"\n📢 Creating announcements...")
    
    announcement_templates = [
        {
            "title": "Welcome to {session} Academic Session",
            "content": "We are excited to welcome all students to the {session} academic session. IESA is committed to providing excellent support throughout this year. Stay connected!",
            "priority": "high",
            "isPinned": True,
            "targetLevels": None,
        },
        {
            "title": "Upcoming General Meeting",
            "content": "All members are invited to our general meeting scheduled for next week. We'll discuss exciting events and opportunities for this session. Attendance is mandatory.",
            "priority": "high",
            "isPinned": False,
            "targetLevels": None,
        },
        {
            "title": "Workshop: Introduction to Lean Manufacturing",
            "content": "Join us for an intensive workshop on Lean Manufacturing principles. Industry experts will share practical insights. Limited slots available!",
            "priority": "normal",
            "isPinned": False,
            "targetLevels": ["300L", "400L", "500L"],
        },
        {
            "title": "Exam Timetable Released",
            "content": "The first semester examination timetable is now available. Please check the notice board and plan accordingly. Good luck!",
            "priority": "urgent",
            "isPinned": True,
            "targetLevels": None,
        },
        {
            "title": "Sports Tournament Registration Open",
            "content": "Ready to showcase your athletic skills? Register for the inter-departmental sports tournament. Football, basketball, and athletics events available.",
            "priority": "normal",
            "isPinned": False,
            "targetLevels": None,
        },
        {
            "title": "100L Students: Orientation Program",
            "content": "Welcome to Industrial Engineering! Mandatory orientation program for all 100 level students. Learn about curriculum, facilities, and student life.",
            "priority": "high",
            "isPinned": False,
            "targetLevels": ["100L"],
        },
        {
            "title": "Career Fair: Meet Industry Leaders",
            "content": "Major companies will be on campus next month for recruitment and internships. Polish your CVs and prepare for networking opportunities!",
            "priority": "normal",
            "isPinned": False,
            "targetLevels": ["400L", "500L"],
        },
        {
            "title": "IT Support: System Maintenance",
            "content": "The student portal will be undergoing maintenance this weekend. Please save your work and avoid submitting assignments during this period.",
            "priority": "low",
            "isPinned": False,
            "targetLevels": None,
        },
    ]
    
    announcements = []
    admin_users = [u for u in users if u.get("role") == "admin"]
    author = admin_users[0] if admin_users else users[0]
    
    for template in announcement_templates:
        announcement_data = {
            "title": template["title"].replace("{session}", CURRENT_SESSION),
            "content": template["content"].replace("{session}", CURRENT_SESSION),
            "sessionId": session_id,
            "priority": template["priority"],
            "targetLevels": template["targetLevels"],
            "isPinned": template["isPinned"],
            "authorId": str(author["_id"]),
            "authorName": f"{author['firstName']} {author['lastName']}",
            "readBy": [str(u["_id"]) for u in random.sample(users, random.randint(10, 30))],
            "createdAt": datetime.now(timezone.utc) - timedelta(days=random.randint(1, 60)),
            "updatedAt": datetime.now(timezone.utc) - timedelta(days=random.randint(0, 30)),
            "expiresAt": None if template["isPinned"] else datetime.now(timezone.utc) + timedelta(days=random.randint(30, 90)),
        }
        announcements.append(announcement_data)
    
    if announcements:
        result = await announcements_collection.insert_many(announcements)
        print(f"   ✓ Created {len(result.inserted_ids)} announcements")


async def create_events(db, users: List[Dict], session_id: str):
    """Create diverse events"""
    events_collection = db["events"]
    
    print(f"\n🎉 Creating events...")
    
    event_templates = [
        {
            "title": "IESA Week 2024",
            "category": "Social",
            "description": "Annual IESA Week celebration featuring competitions, cultural displays, and networking sessions. Show your department pride!",
            "location": "Faculty Auditorium",
            "maxAttendees": 200,
            "requiresPayment": False,
            "days_from_now": 45,
        },
        {
            "title": "Industrial Automation Workshop",
            "category": "Workshop",
            "description": "Hands-on workshop covering PLC programming, SCADA systems, and Industry 4.0 concepts. Bring your laptops!",
            "location": "Computer Lab A",
            "maxAttendees": 50,
            "requiresPayment": True,
            "paymentAmount": 1500.00,
            "days_from_now": 15,
        },
        {
            "title": "Career Development Seminar",
            "category": "Career",
            "description": "Learn resume writing, interview skills, and career planning from industry HR professionals. Open to all levels.",
            "location": "Lecture Theatre 1",
            "maxAttendees": 150,
            "requiresPayment": False,
            "days_from_now": 30,
        },
        {
            "title": "Inter-Department Football Match",
            "category": "Competition",
            "description": "IESA vs. Mechanical Engineering. Come support your department!",
            "location": "Faculty Sports Ground",
            "maxAttendees": None,
            "requiresPayment": False,
            "days_from_now": 20,
        },
        {
            "title": "Python for Engineers Bootcamp",
            "category": "Workshop",
            "description": "3-day intensive bootcamp on Python programming for data analysis, automation, and simulation. Certificates provided.",
            "location": "Innovation Hub",
            "maxAttendees": 40,
            "requiresPayment": True,
            "paymentAmount": 3000.00,
            "days_from_now": 25,
        },
        {
            "title": "End of Semester Party",
            "category": "Social",
            "description": "Celebrate the end of first semester with music, food, and fun! Dress code: Smart casual.",
            "location": "Student Center",
            "maxAttendees": 250,
            "requiresPayment": True,
            "paymentAmount": 2000.00,
            "days_from_now": 90,
        },
        {
            "title": "Research Presentation Day",
            "category": "Academic",
            "description": "Final year students present their research projects. Great opportunity to learn about ongoing research in the department.",
            "location": "Conference Room",
            "maxAttendees": 100,
            "requiresPayment": False,
            "days_from_now": 60,
        },
    ]
    
    events = []
    creator = users[0]
    
    for template in event_templates:
        event_date = datetime.now(timezone.utc) + timedelta(days=template["days_from_now"])
        reg_deadline = event_date - timedelta(days=3)
        
        # Random registrations
        num_registrations = random.randint(10, min(50, template.get("maxAttendees", 50) if template.get("maxAttendees") else 50))
        registrations = [str(u["_id"]) for u in random.sample(users, num_registrations)]
        attendees = random.sample(registrations, random.randint(0, len(registrations) // 2))
        
        event_data = {
            "title": template["title"],
            "sessionId": session_id,
            "date": event_date,
            "location": template["location"],
            "category": template["category"],
            "description": template["description"],
            "maxAttendees": template.get("maxAttendees"),
            "registrationDeadline": reg_deadline,
            "imageUrl": None,
            "requiresPayment": template.get("requiresPayment", False),
            "paymentAmount": template.get("paymentAmount"),
            "paymentId": None,
            "createdBy": str(creator["_id"]),
            "registrations": registrations,
            "attendees": attendees,
            "createdAt": datetime.now(timezone.utc) - timedelta(days=random.randint(10, 40)),
            "updatedAt": datetime.now(timezone.utc),
        }
        events.append(event_data)
    
    if events:
        result = await events_collection.insert_many(events)
        print(f"   ✓ Created {len(result.inserted_ids)} events")


async def create_payments(db, users: List[Dict], session_id: str):
    """Create payment records"""
    payments_collection = db["payments"]
    
    print(f"\n💰 Creating payments...")
    
    payment_templates = [
        {
            "title": "IESA Membership Dues",
            "amount": 5000.00,
            "mandatory": True,
            "category": "Dues",
            "description": "Annual IESA membership dues for the {session} academic session. Covers association activities and benefits.",
            "days_until_deadline": 30,
        },
        {
            "title": "IESA Polo Shirt",
            "amount": 3500.00,
            "mandatory": False,
            "category": "Merchandise",
            "description": "Official IESA polo shirt. Available in all sizes. Show your department pride!",
            "days_until_deadline": 45,
        },
        {
            "title": "Field Trip Contribution",
            "amount": 8000.00,
            "mandatory": True,
            "category": "Academic",
            "description": "Contribution for industrial field trip to Dangote Cement Factory and Coca-Cola Bottling Company.",
            "days_until_deadline": 60,
        },
        {
            "title": "End of Year Dinner",
            "amount": 7500.00,
            "mandatory": False,
            "category": "Event",
            "description": "Annual IESA dinner and awards night. Includes dinner, entertainment, and awards ceremony.",
            "days_until_deadline": 120,
        },
    ]
    
    payments = []
    for template in payment_templates:
        deadline = datetime.now(timezone.utc) + timedelta(days=template["days_until_deadline"])
        
        # Random payments (30-70% have paid)
        num_paid = random.randint(int(len(users) * 0.3), int(len(users) * 0.7))
        paid_by = [str(u["_id"]) for u in random.sample(users, num_paid)]
        
        payment_data = {
            "title": template["title"],
            "amount": template["amount"],
            "sessionId": session_id,
            "mandatory": template["mandatory"],
            "deadline": deadline,
            "description": template["description"].replace("{session}", CURRENT_SESSION),
            "category": template["category"],
            "paidBy": paid_by,
            "createdAt": datetime.now(timezone.utc) - timedelta(days=random.randint(20, 50)),
            "updatedAt": datetime.now(timezone.utc),
        }
        payments.append(payment_data)
    
    if payments:
        result = await payments_collection.insert_many(payments)
        print(f"   ✓ Created {len(result.inserted_ids)} payment records")


async def create_unit_applications(db, users: List[Dict], session_id: str):
    """Create unit applications"""
    applications_collection = db["unit_applications"]
    
    print(f"\n📋 Creating unit applications...")
    
    units = ["press", "committee_academic", "committee_welfare", "committee_sports", "committee_socials"]
    
    motivations = [
        "I am passionate about this unit and believe I can contribute significantly to its success.",
        "I have relevant experience and skills that would benefit the team and the association.",
        "I want to develop my leadership skills while serving the IESA community.",
        "I'm excited to work with like-minded individuals to achieve our collective goals.",
        "I believe my unique perspective and dedication would add value to this unit.",
    ]
    
    applications = []
    # 30% of users apply to various units
    applicants = random.sample(users, int(len(users) * 0.3))
    
    for applicant in applicants:
        unit = random.choice(units)
        status = random.choices(
            ["pending", "accepted", "rejected"],
            weights=[0.4, 0.4, 0.2]
        )[0]
        
        application_data = {
            "userId": str(applicant["_id"]),
            "sessionId": session_id,
            "unit": unit,
            "motivation": random.choice(motivations),
            "skills": ", ".join(random.sample(applicant.get("skills", SKILLS), k=min(3, len(applicant.get("skills", SKILLS))))),
            "status": status,
            "feedback": "Great application! We look forward to working with you." if status == "accepted" else (
                "Thank you for applying. We'll consider you for future opportunities." if status == "rejected" else None
            ),
            "reviewedBy": str(users[0]["_id"]) if status != "pending" else None,
            "createdAt": datetime.now(timezone.utc) - timedelta(days=random.randint(5, 40)),
            "reviewedAt": datetime.now(timezone.utc) - timedelta(days=random.randint(1, 20)) if status != "pending" else None,
        }
        applications.append(application_data)
    
    if applications:
        result = await applications_collection.insert_many(applications)
        print(f"   ✓ Created {len(result.inserted_ids)} unit applications")


async def create_grades(db, users: List[Dict], session_id: str):
    """Create sample grade records"""
    grades_collection = db["grades"]
    
    print(f"\n📊 Creating grades...")
    
    # Common courses by level
    courses_by_level = {
        "100L": [
            {"code": "IPE111", "title": "Introduction to Industrial Engineering", "units": 3},
            {"code": "MTH101", "title": "Elementary Mathematics I", "units": 3},
            {"code": "PHY101", "title": "General Physics I", "units": 3},
            {"code": "CHM101", "title": "General Chemistry I", "units": 3},
            {"code": "GST101", "title": "Use of English", "units": 2},
        ],
        "200L": [
            {"code": "IPE211", "title": "Engineering Statistics", "units": 3},
            {"code": "IPE221", "title": "Engineering Drawing", "units": 3},
            {"code": "MTH201", "title": "Mathematical Methods I", "units": 3},
            {"code": "MEE212", "title": "Mechanics of Machines", "units": 3},
        ],
        "300L": [
            {"code": "IPE311", "title": "Operations Research I", "units": 3},
            {"code": "IPE321", "title": "Work Study and Ergonomics", "units": 3},
            {"code": "IPE331", "title": "Quality Control", "units": 3},
            {"code": "IPE341", "title": "Production Planning", "units": 3},
        ],
    }
    
    grade_letters = ["A", "B", "C", "D", "E", "F"]
    grade_points = [5.0, 4.0, 3.0, 2.0, 1.0, 0.0]
    
    grades = []
    
    # Create grades for 40% of students
    graded_students = random.sample(users, int(len(users) * 0.4))
    
    for student in graded_students:
        level = student.get("currentLevel", "200L")
        if level not in courses_by_level:
            continue
        
        courses = []
        for course_info in courses_by_level[level]:
            # Weight towards better grades
            grade_idx = random.choices(range(len(grade_letters)), weights=[0.3, 0.35, 0.2, 0.1, 0.04, 0.01])[0]
            
            courses.append({
                "code": course_info["code"],
                "title": course_info["title"],
                "units": course_info["units"],
                "grade": grade_letters[grade_idx],
                "grade_point": grade_points[grade_idx],
            })
        
        grade_data = {
            "studentId": str(student["_id"]),
            "sessionId": session_id,
            "semester": 1,
            "level": level,
            "courses": courses,
            "createdAt": datetime.now(timezone.utc) - timedelta(days=random.randint(10, 30)),
            "updatedAt": datetime.now(timezone.utc),
        }
        grades.append(grade_data)
    
    if grades:
        result = await grades_collection.insert_many(grades)
        print(f"   ✓ Created {len(result.inserted_ids)} grade records")


# ============================================================================
# MAIN EXECUTION
# ============================================================================

async def main():
    import argparse
    
    parser = argparse.ArgumentParser(description="Generate comprehensive dummy data for IESA")
    parser.add_argument("--users", type=int, default=50, help="Number of users to create (default: 50)")
    parser.add_argument("--clear", action="store_true", help="Clear all data before generating")
    parser.add_argument("--no-confirm", action="store_true", help="Skip confirmation prompt")
    
    args = parser.parse_args()
    
    # Load environment
    load_dotenv()
    mongo_url = os.getenv("MONGODB_URL") or os.getenv("MONGO_URL") or "mongodb://localhost:27017"
    db_name = os.getenv("DATABASE_NAME") or os.getenv("DB_NAME") or "iesa"
    
    print(f"\n{'='*70}")
    print(f"IESA Comprehensive Dummy Data Generator")
    print(f"{'='*70}")
    print(f"Database: {db_name}")
    print(f"MongoDB:  {mongo_url}")
    print(f"Users:    {args.users}")
    print(f"Clear:    {'Yes' if args.clear else 'No'}")
    
    # Confirmation
    if not args.no_confirm:
        if args.clear:
            print(f"\n⚠️  WARNING: This will DELETE all existing data!")
        confirm = input("\nContinue? (yes/no): ")
        if confirm.lower() != "yes":
            print("Aborted.")
            sys.exit(0)
    
    # Connect to MongoDB
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    
    try:
        # Step 1: Clear data if requested
        if args.clear:
            print("\n🗑️  Clearing existing data...")
            collections = [
                "users", "sessions", "enrollments", "roles", "payments",
                "events", "announcements", "grades", "unit_applications",
                "refresh_tokens", "audit_logs",
            ]
            for collection_name in collections:
                result = await db[collection_name].delete_many({})
                if result.deleted_count > 0:
                    print(f"   ✓ Deleted {result.deleted_count} documents from '{collection_name}'")
        
        # Step 2: Create base data
        users = await create_users(db, args.users)
        sessions = await create_sessions(db)
        current_session_id = sessions[CURRENT_SESSION]
        
        # Get first user as admin
        admin_user = users[0]
        admin_id = str(admin_user["_id"])
        
        # Promote first user to admin
        await db["users"].update_one(
            {"_id": admin_user["_id"]},
            {"$set": {"role": "admin"}}
        )
        print(f"\n👤 Promoted {admin_user['email']} to admin")
        
        # Step 3: Create session-scoped data
        await create_enrollments(db, users, current_session_id)
        await create_executive_roles(db, users, current_session_id, admin_id)
        await create_announcements(db, users, current_session_id)
        await create_events(db, users, current_session_id)
        await create_payments(db, users, current_session_id)
        await create_unit_applications(db, users, current_session_id)
        await create_grades(db, users, current_session_id)
        
        # Summary
        print(f"\n{'='*70}")
        print(f"✅ GENERATION COMPLETE!")
        print(f"{'='*70}")
        print(f"\nGenerated Data:")
        print(f"  • {len(users)} users")
        print(f"  • {len(sessions)} academic sessions")
        print(f"  • ~{len(users)} enrollments")
        print(f"  • ~{len(EXECUTIVE_POSITIONS)} executive roles")
        print(f"  • ~8 announcements")
        print(f"  • ~7 events")
        print(f"  • ~4 payment records")
        print(f"  • ~{int(len(users) * 0.3)} unit applications")
        print(f"  • ~{int(len(users) * 0.4)} grade records")
        
        print(f"\n📝 Test Credentials:")
        print(f"  Email:    {admin_user['email']}")
        print(f"  Password: Password123!")
        print(f"  Role:     admin")
        
        print(f"\n🎉 You can now log in and explore the platform!")
        
    except Exception as e:
        print(f"\n❌ Error: {str(e)}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
    finally:
        client.close()


if __name__ == "__main__":
    asyncio.run(main())
