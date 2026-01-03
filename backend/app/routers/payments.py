"""
Payments Router - Session-Aware Financial Tracking

CRITICAL: All payments are session-scoped.
The session_id filter is automatically applied based on user's current session.
"""

from fastapi import APIRouter, HTTPException, Depends, status, Query
from typing import List, Optional
from datetime import datetime
from bson import ObjectId

from app.models.payment import (
    Payment, PaymentCreate, PaymentUpdate, PaymentWithStatus,
    Transaction, TransactionCreate
)
from app.db import get_database
from app.core.security import get_current_user
from app.core.permissions import require_permission

router = APIRouter(prefix="/api/payments", tags=["Payments"])


@router.post("/", response_model=Payment, status_code=status.HTTP_201_CREATED)
async def create_payment(
    payment_data: PaymentCreate,
    user: dict = Depends(require_permission("payment:create"))
):
    """
    Create a new payment/due.
    Requires payment:create permission.
    
    The payment MUST include a session_id.
    """
    db = get_database()
    payments = db["payments"]
    
    # Verify session exists
    sessions = db["sessions"]
    session = await sessions.find_one({"_id": ObjectId(payment_data.sessionId)})
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Session {payment_data.sessionId} not found"
        )
    
    # Create payment document
    payment_dict = payment_data.model_dump()
    payment_dict["paidBy"] = []
    payment_dict["createdAt"] = datetime.utcnow()
    payment_dict["updatedAt"] = datetime.utcnow()
    
    result = await payments.insert_one(payment_dict)
    created_payment = await payments.find_one({"_id": result.inserted_id})
    created_payment["_id"] = str(created_payment["_id"])
    
    return Payment(**created_payment)


@router.get("/", response_model=List[PaymentWithStatus])
async def list_payments(
    session_id: str = Query(..., description="Filter by session ID (REQUIRED for session-aware filtering)"),
    user: dict = Depends(get_current_user)
):
    """
    List all payments for a specific session.
    
    The session_id parameter enables "time travel" - pass different
    session IDs to view payments from different academic years.
    
    Returns payments with user's payment status.
    """
    db = get_database()
    payments = db["payments"]
    transactions = db["transactions"]
    
    # Verify session exists
    sessions = db["sessions"]
    session = await sessions.find_one({"_id": ObjectId(session_id)})
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Session {session_id} not found"
        )
    
    # Get payments for this session
    cursor = payments.find({"sessionId": session_id}).sort("deadline", 1)
    payment_list = await cursor.to_list(length=None)
    
    # Enrich with user's payment status
    result = []
    for payment in payment_list:
        payment["_id"] = str(payment["_id"])
        
        # Check if current user has paid
        has_paid = user["_id"] in payment.get("paidBy", [])
        
        # Get transaction if exists
        transaction_id = None
        if has_paid:
            transaction = await transactions.find_one({
                "studentId": user["_id"],
                "paymentId": str(payment["_id"])
            })
            if transaction:
                transaction_id = str(transaction["_id"])
        
        payment_with_status = PaymentWithStatus(
            **payment,
            hasPaid=has_paid,
            transactionId=transaction_id
        )
        result.append(payment_with_status)
    
    return result


@router.get("/{payment_id}", response_model=PaymentWithStatus)
async def get_payment(
    payment_id: str,
    user: dict = Depends(get_current_user)
):
    """Get a specific payment by ID"""
    db = get_database()
    payments = db["payments"]
    transactions = db["transactions"]
    
    if not ObjectId.is_valid(payment_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid payment ID format"
        )
    
    payment = await payments.find_one({"_id": ObjectId(payment_id)})
    
    if not payment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Payment {payment_id} not found"
        )
    
    payment["_id"] = str(payment["_id"])
    
    # Check payment status
    has_paid = user["_id"] in payment.get("paidBy", [])
    transaction_id = None
    
    if has_paid:
        transaction = await transactions.find_one({
            "studentId": user["_id"],
            "paymentId": payment_id
        })
        if transaction:
            transaction_id = str(transaction["_id"])
    
    return PaymentWithStatus(
        **payment,
        hasPaid=has_paid,
        transactionId=transaction_id
    )


@router.post("/{payment_id}/pay", response_model=Transaction)
async def record_payment(
    payment_id: str,
    transaction_data: TransactionCreate,
    user: dict = Depends(get_current_user)
):
    """
    Record a payment transaction.
    Students can record their own payments, admins/excos can record for others.
    """
    db = get_database()
    payments = db["payments"]
    transactions = db["transactions"]
    
    if not ObjectId.is_valid(payment_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid payment ID format"
        )
    
    # Get payment
    payment = await payments.find_one({"_id": ObjectId(payment_id)})
    if not payment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Payment {payment_id} not found"
        )
    
    # Verify student can only pay for themselves (unless admin/exco)
    if user.get("role") == "student" and transaction_data.studentId != user["_id"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Students can only record their own payments"
        )
    
    # Check if already paid
    if transaction_data.studentId in payment.get("paidBy", []):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Payment already recorded for this student"
        )
    
    # Create transaction
    transaction_dict = transaction_data.model_dump()
    transaction_dict["createdAt"] = datetime.utcnow()
    
    result = await transactions.insert_one(transaction_dict)
    
    # Update payment's paidBy array
    await payments.update_one(
        {"_id": ObjectId(payment_id)},
        {
            "$push": {"paidBy": transaction_data.studentId},
            "$set": {"updatedAt": datetime.utcnow()}
        }
    )
    
    created_transaction = await transactions.find_one({"_id": result.inserted_id})
    created_transaction["_id"] = str(created_transaction["_id"])
    
    return Transaction(**created_transaction)


@router.patch("/{payment_id}", response_model=Payment)
async def update_payment(
    payment_id: str,
    payment_update: PaymentUpdate,
    user: dict = Depends(require_permission("payment:edit"))
):
    """
    Update payment details.
    Requires payment:edit permission.
    """
    db = get_database()
    payments = db["payments"]
    
    if not ObjectId.is_valid(payment_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid payment ID format"
        )
    
    update_data = payment_update.model_dump(exclude_unset=True)
    if not update_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No fields to update"
        )
    
    update_data["updatedAt"] = datetime.utcnow()
    
    result = await payments.update_one(
        {"_id": ObjectId(payment_id)},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Payment {payment_id} not found"
        )
    
    updated_payment = await payments.find_one({"_id": ObjectId(payment_id)})
    updated_payment["_id"] = str(updated_payment["_id"])
    
    return Payment(**updated_payment)


@router.delete("/{payment_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_payment(
    payment_id: str,
    user: dict = Depends(require_permission("payment:delete"))
):
    """
    Delete a payment.
    Requires payment:delete permission.
    """
    db = get_database()
    payments = db["payments"]
    transactions = db["transactions"]
    
    if not ObjectId.is_valid(payment_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid payment ID format"
        )
    
    # Delete payment
    result = await payments.delete_one({"_id": ObjectId(payment_id)})
    
    if result.deleted_count == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Payment {payment_id} not found"
        )
    
    # Also delete related transactions
    await transactions.delete_many({"paymentId": payment_id})
    
    return None
