from fastapi import APIRouter, HTTPException, Body, Request
from fastapi.responses import HTMLResponse, JSONResponse
import json
import os
import asyncio

# Optional Groq client integration: if GROQ_API_KEY is set and groq is installed,
# use the LLM to answer; otherwise fall back to rule-based replies.
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
_groq_client = None
if GROQ_API_KEY:
    try:
        from groq import Groq
        _groq_client = Groq(api_key=GROQ_API_KEY)
    except Exception:
        _groq_client = None

router = APIRouter(prefix="/schedule-bot", tags=["schedule-bot"])

BASE_DIR = os.path.dirname(os.path.dirname(__file__))
DATA_PATH = os.path.join(BASE_DIR, "data", "schedule.json")

@router.get("/schedule")
async def get_schedule():
    if not os.path.exists(DATA_PATH):
        raise HTTPException(status_code=404, detail="Schedule file not found")
    with open(DATA_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)
    return data


@router.post("/chat")
async def chat_endpoint(payload: dict = Body(...)):
    text = (payload.get("text") or "").strip().lower()
    if not text:
        return JSONResponse({"reply": "Please provide a message in the `text` field."}, status_code=400)

    if not os.path.exists(DATA_PATH):
        raise HTTPException(status_code=404, detail="Schedule file not found")

    with open(DATA_PATH, "r", encoding="utf-8") as f:
        schedule = json.load(f)

    # If we have a Groq client available, use it to answer more naturally.
    if _groq_client is not None:
        system_prompt = f"""
    You are a helpful academic assistant for a student named {schedule.get('student_name', 'Student')}.
    Here is their academic schedule and details:
    {json.dumps(schedule, indent=2)}
    
    Answer questions based on this schedule. If the answer is not in the schedule, say you don't know.
    Keep answers brief and helpful.
    """
        try:
            chat_completion = await asyncio.to_thread(
                _groq_client.chat.completions.create,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": payload.get("text")},
                ],
                model=os.getenv("GROQ_MODEL", "llama-3.1-8b-instant"),
            )
            # groq client shape may vary; attempt to access content
            reply = None
            try:
                reply = chat_completion.choices[0].message.content
            except Exception:
                reply = str(chat_completion)
            return {"reply": reply}
        except Exception as e:
            return {"reply": "Brain freeze! Try again later."}

    # Simple rule-based reply engine based on schedule data
    # If user mentions a course code, return course times
    for c in schedule.get("courses", []):
        code = (c.get("code") or "").lower()
        if code and code in text:
            times = []
            for s in c.get("schedule", []):
                times.append(f"{s.get('day')} {s.get('time')} @ {s.get('location')}")
            reply = f"{c.get('code')} - {c.get('name')} (Prof. {c.get('professor')}): " + "; ".join(times)
            return {"reply": reply}

    # If user asks about exams
    if "exam" in text or "final" in text or "midterm" in text:
        exams = schedule.get("exams", [])
        if not exams:
            return {"reply": "No exam information found in the schedule."}
        parts = [f"{e.get('course')}: {e.get('date')} {e.get('time')} @ {e.get('location')}" for e in exams]
        return {"reply": "Exams: " + "; ".join(parts)}

    # Default: provide a short summary or fallback
    student = schedule.get("student_name", "Student")
    sem = schedule.get("semester", "")
    reply = f"I can help with your schedule for {student} ({sem}). Ask about a course code (e.g. CS101) or say 'exams'."
    return {"reply": reply}

@router.get("/view", response_class=HTMLResponse)
async def view_schedule():
    if not os.path.exists(DATA_PATH):
        raise HTTPException(status_code=404, detail="Schedule file not found")
    with open(DATA_PATH, "r", encoding="utf-8") as f:
        schedule = json.load(f)

    html = f"""
    <html>
      <head>
        <title>Schedule Bot - Viewer</title>
        <meta charset=\"utf-8\" />
        <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\" />
        <style>
          body {{ font-family: Arial, sans-serif; padding: 24px; background: #f8f9fb; color: #0b1220 }}
          .card {{ background: #fff; border-radius: 8px; padding: 16px; box-shadow: 0 4px 12px rgba(16,24,40,0.06); max-width: 900px }}
          h1 {{ margin: 0 0 12px 0 }}
          pre {{ white-space: pre-wrap; word-break: break-word }}
        </style>
      </head>
      <body>
        <div class=\"card\">
          <h1>Academic Schedule</h1>
          <p><strong>Student:</strong> {schedule.get('student_name')}</p>
          <p><strong>Semester:</strong> {schedule.get('semester')}</p>
          <h2>Courses</h2>
          <ul>
    """

    for c in schedule.get("courses", []):
        html += f"<li><strong>{c.get('code')}</strong> - {c.get('name')} ({c.get('professor')})<br/>"
        html += "<ul>"
        for s in c.get("schedule", []):
            html += f"<li>{s.get('day')} {s.get('time')} @ {s.get('location')}</li>"
        html += "</ul></li>"

    html += "</ul><h2>Exams</h2><ul>"
    for e in schedule.get("exams", []):
        html += f"<li>{e.get('course')} - {e.get('date')} {e.get('time')} @ {e.get('location')}</li>"
    html += "</ul>"
    html += "</div></body></html>"

    return HTMLResponse(html)


# Catch-all proxy for convenience: forwards to internal handlers for known subpaths
@router.api_route("/{subpath:path}", methods=["GET", "POST", "PUT", "DELETE"])
async def proxy_subpath(subpath: str, request: Request):
    # normalize
    sub = (subpath or "").strip("/")
    if sub == "schedule" and request.method == "GET":
        return await get_schedule()
    if sub == "chat" and request.method == "POST":
        try:
            payload = await request.json()
        except Exception:
            payload = {}
        return await chat_endpoint(payload)
    if sub == "view" and request.method == "GET":
        return await view_schedule()

    raise HTTPException(status_code=404, detail=f"Unknown schedule-bot subpath: {sub}")
