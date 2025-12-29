from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from app.core.security import verify_token
from app.routers import schedule_bot

app = FastAPI(title="IESA Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:8000"],
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

