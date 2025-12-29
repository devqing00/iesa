from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
import os
from app.core.security import verify_token
from app.routers import schedule_bot

app = FastAPI(title="IESA Backend")

def _get_origins():
    raw = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000,http://localhost:8000")
    return [o.strip() for o in raw.split(",") if o.strip()]

origins = _get_origins()

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    return {"message": "Welcome to IESA Backend"}


@app.get("/health")
async def health():
    return {"status": "ok"}

# Register schedule-bot router
app.include_router(schedule_bot.router)

@app.get("/api/protected")
async def protected_route(user_data: dict = Depends(verify_token)):
    return {
        "message": "You are authenticated!",
        "user_id": user_data.get("uid"),
        "email": user_data.get("email")
    }

