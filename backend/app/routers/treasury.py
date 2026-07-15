from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime, timezone, timedelta
from bson import ObjectId
from app.core.security import get_current_user
from app.core.permissions import require_permission
from app.db import get_database
import asyncio

router = APIRouter(prefix="/api/v1/treasury", tags=["Treasury Management"])

class ExpenseCreate(BaseModel):
    title: str = Field(..., max_length=100)
    amount: float = Field(..., gt=0)
    category: str = Field(..., max_length=50)
    date: str = Field(..., description="ISO formatted date string")

class ExpenseResponse(BaseModel):
    id: str
    title: str
    amount: float
    category: str
    date: str
    createdAt: str
    createdBy: str

@router.post("/expenses", response_model=ExpenseResponse, status_code=status.HTTP_201_CREATED)
async def create_expense(
    expense: ExpenseCreate,
    current_user: dict = Depends(get_current_user),
    _perm: None = Depends(require_permission("payment:manage")),
):
    """Log a new expense."""
    db = get_database()
    
    # Get active session
    active_session = await db["sessions"].find_one({"isActive": True})
    if not active_session:
        raise HTTPException(status_code=400, detail="No active session found")
        
    doc = {
        "title": expense.title,
        "amount": expense.amount,
        "category": expense.category,
        "date": datetime.fromisoformat(expense.date.replace("Z", "+00:00")),
        "sessionId": str(active_session["_id"]),
        "createdAt": datetime.now(timezone.utc),
        "createdBy": str(current_user["_id"])
    }
    
    result = await db["expenses"].insert_one(doc)
    
    return {
        "id": str(result.inserted_id),
        "title": doc["title"],
        "amount": doc["amount"],
        "category": doc["category"],
        "date": doc["date"].isoformat(),
        "createdAt": doc["createdAt"].isoformat(),
        "createdBy": doc["createdBy"]
    }

@router.get("/expenses", response_model=List[ExpenseResponse])
async def get_expenses(
    current_user: dict = Depends(get_current_user),
    _perm: None = Depends(require_permission("payment:view_all")),
):
    """Get all expenses for current session."""
    db = get_database()
    
    active_session = await db["sessions"].find_one({"isActive": True})
    if not active_session:
        return []
        
    expenses = await db["expenses"].find({"sessionId": str(active_session["_id"])}).sort("date", -1).to_list(length=500)
    
    return [
        {
            "id": str(e["_id"]),
            "title": e["title"],
            "amount": e["amount"],
            "category": e["category"],
            "date": e["date"].isoformat() if isinstance(e["date"], datetime) else str(e["date"]),
            "createdAt": e["createdAt"].isoformat() if isinstance(e["createdAt"], datetime) else str(e["createdAt"]),
            "createdBy": e.get("createdBy", "")
        }
        for e in expenses
    ]

@router.get("/forecast")
async def get_forecast(
    current_user: dict = Depends(get_current_user),
    _perm: None = Depends(require_permission("payment:view_all")),
):
    """
    Get financial forecast:
    - Expected Revenue (Total dues * Target students)
    - Collected Revenue (Paystack + Bank Transfers)
    - Total Expenses
    - Net Balance (Collected - Expenses)
    """
    db = get_database()
    
    active_session = await db["sessions"].find_one({"isActive": True})
    if not active_session:
        return {"error": "No active session found"}
        
    session_id = str(active_session["_id"])
    
    # Run queries in parallel
    (
        payments,
        enrollment_count,
        paystack_result,
        bt_result,
        expenses_result
    ) = await asyncio.gather(
        db["payments"].find({"sessionId": session_id}).to_list(length=200),
        db["enrollments"].count_documents({"sessionId": session_id, "isActive": True}),
        db["paystackTransactions"].aggregate([
            {"$match": {"status": "success", "metadata.sessionId": session_id}},
            {"$group": {"_id": None, "total": {"$sum": "$amount"}}},
        ]).to_list(length=1),
        db["bankTransfers"].aggregate([
            {"$match": {"status": "approved", "sessionId": session_id}},
            {"$group": {"_id": None, "total": {"$sum": "$amount"}}},
        ]).to_list(length=1),
        db["expenses"].aggregate([
            {"$match": {"sessionId": session_id}},
            {"$group": {"_id": None, "total": {"$sum": "$amount"}}},
        ]).to_list(length=1)
    )
    
    # Calculate Expected
    # If a payment is targeted at all students, multiply amount by enrollment_count
    # Actually, the logic in admin_stats.py uses `_estimate_target_count` which just returns enrollment_count.
    # To be more precise, we could count specific targets, but enrollment_count is fine for the forecast.
    total_expected = 0
    target_count = max(enrollment_count, 1)
    
    for p in payments:
        total_expected += p.get("amount", 0) * target_count
        
    total_collected_paystack = paystack_result[0]["total"] if paystack_result else 0
    total_collected_transfer = bt_result[0]["total"] if bt_result else 0
    total_collected = total_collected_paystack + total_collected_transfer
    
    total_expenses = expenses_result[0]["total"] if expenses_result else 0
    
    return {
        "expectedRevenue": total_expected,
        "collectedRevenue": total_collected,
        "totalExpenses": total_expenses,
        "netBalance": total_collected - total_expenses
    }
