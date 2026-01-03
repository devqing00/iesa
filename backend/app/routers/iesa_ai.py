"""
IESA AI Router - Comprehensive AI Assistant

A smart AI assistant powered by Groq that can:
- Answer questions about timetables/schedules
- Provide information about payments, events, library
- Help with IESA processes and procedures
- Offer study tips and academic guidance
- Answer general questions about the department

Uses RAG (Retrieval Augmented Generation) with database context.
"""

from fastapi import APIRouter, HTTPException, Depends, status
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime, timezone, timedelta
from motor.motor_asyncio import AsyncIOMotorDatabase
import os
import json

from ..core.security import get_current_user
from ..db import get_database

router = APIRouter(prefix="/api/v1/iesa-ai", tags=["IESA AI"])

# Groq API setup
try:
    from groq import Groq
    GROQ_AVAILABLE = True
    GROQ_API_KEY = os.getenv("GROQ_API_KEY")
    if GROQ_API_KEY:
        groq_client = Groq(api_key=GROQ_API_KEY)
    else:
        GROQ_AVAILABLE = False
        print("Warning: GROQ_API_KEY not found in environment variables")
except ImportError:
    GROQ_AVAILABLE = False
    print("Warning: groq package not installed. Install with: pip install groq")


class ChatMessage(BaseModel):
    message: str
    conversationHistory: Optional[List[dict]] = []


class ChatResponse(BaseModel):
    reply: str
    suggestions: Optional[List[str]] = None
    data: Optional[dict] = None


# IESA Knowledge Base - Static information for RAG
IESA_KNOWLEDGE = """
# IESA (Industrial Engineering Students' Association) - University of Ibadan

## About IESA
- Department: Industrial and Production Engineering
- Faculty: Technology
- Institution: University of Ibadan, Nigeria
- Levels: 100L, 200L, 300L, 400L, 500L (5-year program)

## Academic Structure
- Session format: 2024/2025 (February to February cycle)
- Two semesters per session
- Each semester: ~15 weeks of lectures + exams
- Result processing phases after each semester

## Student Services

### 1. Payments & Dues
- Departmental dues: Varies by session (typically ₦2,500 - ₦5,000)
- Payment methods: Paystack (card, bank transfer, USSD)
- Receipts: Auto-generated PDF after successful payment
- ID Cards: Issued after payment (green border = paid, red = owing)
- Payment deadline: Usually end of first semester

### 2. Resource Library
- Past questions organized by course code and year
- Lecture slides from lecturers (approved uploads only)
- Video tutorials and study materials
- Textbook recommendations
- Access: All paid-up students
- Upload permissions: Academic Committee members only

### 3. Events & Programs
- Freshers' welcome (beginning of session)
- General meetings (monthly)
- Career fairs and workshops
- Industrial visits
- Annual dinner and awards
- Departmental week celebrations

### 4. EXCO Structure
- President: Overall leadership
- Vice President: Deputy and special projects
- Secretary General: Documentation and records
- Financial Secretary: Money management
- PRO (Public Relations Officer): Communications
- Welfare Director: Student wellbeing
- Academic Director: Learning resources
- Sports Director: Athletic activities
- Class Representatives: Level-specific representatives

### 5. Committees
- Academic Committee: Manages library, past questions
- Welfare Committee: Student support
- Sports Committee: Athletic programs
- Protocol Committee: Event organization

## Common Courses by Level
### 100 Level
- ENG 101: Introduction to Engineering
- MTH 101: Calculus I
- PHY 101: General Physics I
- CHM 101: General Chemistry I
- GNS 101: Use of Library

### 200 Level
- TVE 201: Engineering Drawing I
- TVE 202: Engineering Drawing II
- MEE 201: Strength of Materials
- MEE 202: Engineering Thermodynamics I
- MAT 201: Differential Equations

### 300 Level
- IOP 301: Work Study and Ergonomics
- IOP 302: Production Planning and Control
- IOP 303: Quality Control
- MEE 301: Fluid Mechanics
- EEE 301: Electrical Engineering I

### 400 Level
- IOP 401: Operations Research I
- IOP 402: Systems Engineering
- IOP 403: Facilities Planning and Design
- IOP 404: Engineering Economy

### 500 Level
- IOP 501: Project Management
- IOP 502: Industrial Project (Final Year Project)
- IOP 503: Automation and Robotics

## Contact & Office
- IESA Office: Technology Faculty Complex
- Office hours: Monday-Friday, 10am-4pm
- Email: iesa@tech.ui.edu.ng (example)
- Social media: Instagram, Twitter, Facebook (@IESAUI)

## How to Use IESA Platform
1. Register with UI student email (@stu.ui.edu.ng)
2. Complete profile with matric number and level
3. Pay departmental dues via Paystack
4. Access library resources, timetable, events
5. Use CGPA calculator for grade planning
6. Chat with IESA AI for help and questions

## Study Tips
- Attend all lectures and practicals
- Form study groups with classmates
- Use past questions to prepare for exams
- Start assignments early, don't procrastinate
- Attend office hours if you need help
- Balance academics with extracurricular activities
- Take care of your mental health
- Network with seniors and industry professionals
"""


async def get_user_context(user_id: str, db: AsyncIOMotorDatabase) -> dict:
    """
    Fetch relevant user context for personalized responses.
    
    Returns user's level, payment status, upcoming events, timetable, etc.
    """
    users = db.users
    user = await users.find_one({"_id": user_id})
    
    if not user:
        return {}
    
    context = {
        "level": user.get("currentLevel", "Unknown"),
        "name": f"{user.get('firstName', '')} {user.get('lastName', '')}".strip(),
        "matric": user.get("matricNumber", "Unknown"),
    }
    
    # Get active session
    sessions = db.sessions
    active_session = await sessions.find_one({"isActive": True})
    
    if active_session:
        session_id = str(active_session["_id"])
        context["session"] = active_session.get("name", "Current session")
        
        # Check payment status
        payments = db.payments
        payment = await payments.find_one({
            "userId": user_id,
            "sessionId": session_id
        })
        
        if payment:
            context["payment_status"] = "Paid" if payment.get("isPaid") else "Owing"
            context["payment_amount"] = payment.get("amount", 0)
        
        # Get upcoming events (next 7 days)
        events = db.events
        upcoming_events = await events.find({
            "sessionId": session_id,
            "date": {"$gte": datetime.now(timezone.utc), "$lte": datetime.now(timezone.utc) + timedelta(days=7)}
        }).sort("date", 1).limit(3).to_list(length=3)
        
        if upcoming_events:
            context["upcoming_events"] = [
                {
                    "title": e.get("title"),
                    "date": e.get("date").strftime("%B %d, %Y") if e.get("date") else "TBD"
                }
                for e in upcoming_events
            ]
    
    return context


def build_system_prompt(user_context: dict) -> str:
    """
    Build a comprehensive system prompt for IESA AI.
    """
    
    prompt = f"""You are IESA AI, a friendly and knowledgeable assistant for the Industrial Engineering Students' Association (IESA) at the University of Ibadan.

## Your Role
- Help students with questions about schedules, payments, events, and academic resources
- Provide study tips and academic guidance
- Explain IESA processes and procedures
- Be encouraging, supportive, and professional
- Use Nigerian English and understand UI student culture

## Knowledge Base
{IESA_KNOWLEDGE}

## Current User Context
"""
    
    if user_context:
        prompt += f"- Student: {user_context.get('name', 'Student')}\n"
        prompt += f"- Level: {user_context.get('level', 'Unknown')}\n"
        prompt += f"- Matric: {user_context.get('matric', 'Unknown')}\n"
        prompt += f"- Session: {user_context.get('session', 'Current session')}\n"
        prompt += f"- Payment Status: {user_context.get('payment_status', 'Unknown')}\n"
        
        if user_context.get("upcoming_events"):
            prompt += "\n## Upcoming Events:\n"
            for event in user_context["upcoming_events"]:
                prompt += f"- {event['title']} on {event['date']}\n"
    
    prompt += """
## Response Guidelines
1. Be concise but informative (2-4 sentences typically)
2. Use friendly, conversational tone
3. Include relevant emojis when appropriate 🎓📚
4. If you don't know something, admit it and suggest alternatives
5. For complex questions, break down into steps
6. Encourage students to stay motivated
7. Reference specific features of the IESA platform when relevant

## Examples of Good Responses
User: "When is the next general meeting?"
You: "The monthly general meeting is usually held in the main auditorium on the second Friday of each month at 4pm 📅 Check the Events page for the exact date and any updates!"

User: "How do I pay my dues?"
You: "Head over to the Payments page in your dashboard 💳 You can pay using your debit card, bank transfer, or USSD through Paystack. Your receipt will be generated automatically!"

User: "I'm stressed about exams"
You: "I understand exam season can be tough! 💪 Try studying with classmates, use past questions from the Library, and take regular breaks. You've got this! Also, check out the CGPA Calculator to plan your target grades."

Remember: You're here to help students succeed and feel supported! 🌟
"""
    
    return prompt


@router.post("/chat", response_model=ChatResponse)
async def chat_with_iesa_ai(
    chat_data: ChatMessage,
    user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """
    Chat with IESA AI - Comprehensive student assistant.
    
    Handles:
    - Schedule/timetable queries
    - Payment information
    - Event information
    - Study guidance
    - General IESA questions
    """
    
    if not GROQ_AVAILABLE or not GROQ_API_KEY:
        return ChatResponse(
            reply="I'm currently offline. Please check back later or contact the IESA admin.",
            suggestions=["Check the Events page", "Visit the Library", "View your Timetable"]
        )
    
    try:
        # Get user context for personalization
        user_context = await get_user_context(str(user["_id"]), db)
        
        # Build system prompt with context
        system_prompt = build_system_prompt(user_context)
        
        # Build conversation history
        messages = [{"role": "system", "content": system_prompt}]
        
        # Add previous messages (keep last 10 for context)
        if chat_data.conversationHistory:
            for msg in chat_data.conversationHistory[-10:]:
                messages.append({
                    "role": msg.get("role", "user"),
                    "content": msg.get("content", "")
                })
        
        # Add current user message
        messages.append({"role": "user", "content": chat_data.message})
        
        # Call Groq API
        completion = groq_client.chat.completions.create(
            model="llama-3.3-70b-versatile",  # Fast and capable
            messages=messages,  # type: ignore
            temperature=0.7,
            max_tokens=500,
            top_p=0.9,
        )
        
        ai_response = completion.choices[0].message.content or "I couldn't generate a response. Please try again."
        
        # Generate smart suggestions based on query intent
        suggestions = generate_suggestions(chat_data.message, ai_response)
        
        return ChatResponse(
            reply=ai_response,
            suggestions=suggestions,
            data={"user_context": user_context}
        )
        
    except Exception as e:
        print(f"Error in IESA AI chat: {e}")
        return ChatResponse(
            reply="Sorry, I encountered an error. Please try again or rephrase your question.",
            suggestions=["Check the Events page", "Visit the Library", "View your Timetable"]
        )


def generate_suggestions(user_message: str, ai_response: str) -> List[str]:
    """
    Generate smart follow-up suggestions based on conversation context.
    """
    
    message_lower = user_message.lower()
    
    # Payment-related suggestions
    if any(word in message_lower for word in ["pay", "dues", "payment", "receipt"]):
        return [
            "View payment history",
            "Download my receipt",
            "Check payment deadline"
        ]
    
    # Event-related suggestions
    if any(word in message_lower for word in ["event", "meeting", "program", "activity"]):
        return [
            "Show all upcoming events",
            "Register for an event",
            "View past events"
        ]
    
    # Schedule/timetable suggestions
    if any(word in message_lower for word in ["class", "schedule", "timetable", "lecture"]):
        return [
            "View full timetable",
            "Export to calendar",
            "Check tomorrow's classes"
        ]
    
    # Study/academic suggestions
    if any(word in message_lower for word in ["study", "exam", "test", "grade", "gpa", "cgpa"]):
        return [
            "Calculate my CGPA",
            "Find past questions",
            "Browse study materials"
        ]
    
    # Library suggestions
    if any(word in message_lower for word in ["library", "resource", "material", "book", "slide"]):
        return [
            "Browse library resources",
            "Search for course materials",
            "Download past questions"
        ]
    
    # Default suggestions
    return [
        "Tell me about upcoming events",
        "Check my payment status",
        "Show my timetable"
    ]


@router.get("/suggestions")
async def get_quick_suggestions():
    """
    Get quick suggestion chips for the chat interface.
    """
    return {
        "suggestions": [
            "What events are coming up?",
            "How do I pay my dues?",
            "Show me resources for my level",
            "What's my class schedule?",
            "Tips for exam preparation",
            "How can I calculate my CGPA?",
            "Who are the current EXCO members?",
            "When is the next general meeting?"
        ]
    }


@router.post("/feedback")
async def submit_feedback(
    feedback: dict,
    user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """
    Submit feedback on AI responses (for improvement).
    """
    
    feedbacks = db.ai_feedback
    
    feedback_doc = {
        "userId": str(user["_id"]),
        "message": feedback.get("message"),
        "response": feedback.get("response"),
        "rating": feedback.get("rating"),  # thumbs up/down
        "comment": feedback.get("comment"),
        "createdAt": datetime.now(timezone.utc)
    }
    
    await feedbacks.insert_one(feedback_doc)
    
    return {"message": "Thank you for your feedback!"}
