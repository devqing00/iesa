"""
Payments Router - Session-Aware Financial Tracking

CRITICAL: All payments are session-scoped.
The session_id filter is automatically applied based on user's current session.
"""

from fastapi import APIRouter, HTTPException, Depends, status, Query, Request
from fastapi.responses import StreamingResponse
from typing import List, Optional
from datetime import datetime, timezone, timedelta
from bson import ObjectId
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.models.payment import (
    Payment, PaymentCreate, PaymentUpdate, PaymentWithStatus,
    Transaction, TransactionCreate
)
from app.db import get_database
from app.core.security import get_current_user
from app.core.permissions import require_permission
from app.core.audit import AuditLogger

router = APIRouter(prefix="/api/v1/payments", tags=["Payments"])
limiter = Limiter(key_func=get_remote_address)


@router.post("/", response_model=Payment, status_code=status.HTTP_201_CREATED)
@limiter.limit("10/minute")
async def create_payment(
    request: Request,
    payment_data: PaymentCreate,
    user: dict = Depends(require_permission("payment:create"))
):
    """
    Create a new payment/due.
    Requires payment:create permission.
    
    Rate limited to prevent spam payment creation.
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
    payment_dict["createdAt"] = datetime.now(timezone.utc)
    payment_dict["updatedAt"] = datetime.now(timezone.utc)
    
    result = await payments.insert_one(payment_dict)
    created_payment = await payments.find_one({"_id": result.inserted_id})
    created_payment["_id"] = str(created_payment["_id"])
    
    await AuditLogger.log(
        action=AuditLogger.PAYMENT_CREATED,
        actor_id=user.get("_id", ""),
        actor_email=user.get("email", ""),
        resource_type="payment",
        resource_id=str(result.inserted_id),
        session_id=payment_data.sessionId,
        details={"amount": payment_data.amount, "type": payment_data.type}
    )
    from app.routers.sse import publish
    from app.core.cache import cache_delete, cache_delete_pattern
    publish("payment_created", {"id": str(result.inserted_id), "type": payment_data.type}, ipe_only=True)
    await cache_delete("admin_stats")
    await cache_delete_pattern("student_dashboard:*")
    return Payment(**created_payment)


@router.get("/")
async def list_payments(
    session_id: Optional[str] = Query(None, description="Filter by session ID. Defaults to active session."),
    limit: int = Query(100, ge=1, le=500, description="Maximum number of payments to return"),
    skip: int = Query(0, ge=0, description="Number of payments to skip"),
    user: dict = Depends(get_current_user)
):
    """
    List all payments for a specific session with pagination.
    
    The session_id parameter enables "time travel" - pass different
    session IDs to view payments from different academic years.
    
    Returns payments with user's payment status.
    Supports pagination via limit and skip parameters.
    """
    db = get_database()
    payments = db["payments"]
    transactions = db["transactions"]
    sessions = db["sessions"]

    # External students don't have payment dues
    if (
        user.get("role") == "student"
        and user.get("department", "Industrial Engineering") != "Industrial Engineering"
    ):
        return {"items": [], "total": 0}
    
    # Resolve session_id
    if not session_id:
        active_session = await sessions.find_one({"isActive": True})
        if not active_session:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No active session found"
            )
        session_id = str(active_session["_id"])
    
    # Verify session exists
    session = await sessions.find_one({"_id": ObjectId(session_id)})
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Session {session_id} not found"
        )
    
    # Get total count for pagination
    total = await payments.count_documents({"sessionId": session_id})
    
    # Get payments for this session
    cursor = payments.find({"sessionId": session_id}).sort("deadline", 1).skip(skip).limit(limit)
    payment_list = await cursor.to_list(length=limit)
    
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
        
        # Prepare data for PaymentWithStatus, excluding keys that might conflict
        payment_data = {k: v for k, v in payment.items() if k not in ["hasPaid", "transactionId"]}
        
        payment_with_status = PaymentWithStatus(
            **payment_data,
            hasPaid=has_paid,
            transactionId=transaction_id
        )
        result.append(payment_with_status)
    
    return {"items": result, "total": total}


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


@router.get("/{payment_id}/paid-students")
async def get_paid_students(
    payment_id: str,
    user: dict = Depends(require_permission("payment:view_all")),
):
    """Return enriched list of students who paid a specific due, with txn details."""
    db = get_database()

    if not ObjectId.is_valid(payment_id):
        raise HTTPException(status_code=400, detail="Invalid payment ID format")

    payment = await db.payments.find_one({"_id": ObjectId(payment_id)})
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")

    paid_uids: list = payment.get("paidBy", [])
    if not paid_uids:
        return []

    # Batch-fetch user documents — paidBy stores string _ids
    oid_list = [ObjectId(uid) for uid in paid_uids if ObjectId.is_valid(uid)]
    users_cursor = db.users.find(
        {"_id": {"$in": oid_list}},
        {
            "firstName": 1,
            "lastName": 1,
            "email": 1,
            "matricNumber": 1,
            "currentLevel": 1,
            "admissionYear": 1,
        },
    )
    user_map = {}
    async for u in users_cursor:
        user_map[str(u["_id"])] = u

    # Batch-fetch Paystack transactions for this payment
    paystack_cursor = db.paystackTransactions.find(
        {"paymentId": payment_id, "status": "success"},
        {"studentId": 1, "reference": 1, "paidAt": 1, "channel": 1, "amount": 1, "createdAt": 1},
    )
    paystack_map: dict = {}
    async for t in paystack_cursor:
        paystack_map[t["studentId"]] = t

    # Batch-fetch bank transfers for this payment
    bt_cursor = db.bankTransfers.find(
        {"paymentId": payment_id, "status": "approved"},
        {
            "studentId": 1,
            "transactionReference": 1,
            "reviewedAt": 1,
            "senderBank": 1,
            "amount": 1,
            "createdAt": 1,
        },
    )
    bt_map: dict = {}
    async for t in bt_cursor:
        bt_map[t["studentId"]] = t

    # Assemble results
    results = []
    for uid in paid_uids:
        u = user_map.get(uid, {})
        first = u.get("firstName", "")
        last = u.get("lastName", "")
        level = u.get("currentLevel") or "N/A"
        if isinstance(level, int):
            level = str(level)

        # Check Paystack first, then bank transfer
        ps = paystack_map.get(uid)
        bt = bt_map.get(uid)

        if ps:
            paid_at = ps.get("paidAt") or ps.get("createdAt")
            method = "paystack"
            reference = ps.get("reference", "")
        elif bt:
            paid_at = bt.get("reviewedAt") or bt.get("createdAt")
            method = "bank_transfer"
            reference = bt.get("transactionReference", "")
        else:
            paid_at = None
            method = "Unknown"
            reference = ""

        results.append({
            "uid": uid,
            "firstName": first,
            "lastName": last,
            "email": u.get("email", ""),
            "matricNumber": u.get("matricNumber", ""),
            "level": level,
            "paidAt": paid_at.isoformat() if hasattr(paid_at, "isoformat") else str(paid_at) if paid_at else None,
            "method": method,
            "reference": reference,
        })

    return results


@router.get("/{payment_id}/paid-students/pdf")
async def download_paid_students_pdf(
    payment_id: str,
    user: dict = Depends(require_permission("payment:view_all")),
):
    """Download a PDF report of students who paid a specific due."""
    from ..utils.paid_students_report import generate_paid_students_pdf

    db = get_database()

    if not ObjectId.is_valid(payment_id):
        raise HTTPException(status_code=400, detail="Invalid payment ID format")

    payment = await db.payments.find_one({"_id": ObjectId(payment_id)})
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")

    paid_uids: list = payment.get("paidBy", [])
    if not paid_uids:
        raise HTTPException(status_code=404, detail="No students have paid this due yet.")

    # Batch-fetch users
    oid_list = [ObjectId(uid) for uid in paid_uids if ObjectId.is_valid(uid)]
    users_cursor = db.users.find(
        {"_id": {"$in": oid_list}},
        {"firstName": 1, "lastName": 1, "email": 1, "matricNumber": 1, "currentLevel": 1},
    )
    user_map = {}
    async for u in users_cursor:
        user_map[str(u["_id"])] = u

    # Batch-fetch Paystack and bank transfers
    ps_cursor = db.paystackTransactions.find(
        {"paymentId": payment_id, "status": "success"},
        {"studentId": 1, "reference": 1, "paidAt": 1, "createdAt": 1},
    )
    ps_map = {}
    async for t in ps_cursor:
        ps_map[t["studentId"]] = t

    bt_cursor = db.bankTransfers.find(
        {"paymentId": payment_id, "status": "approved"},
        {"studentId": 1, "transactionReference": 1, "reviewedAt": 1, "createdAt": 1},
    )
    bt_map = {}
    async for t in bt_cursor:
        bt_map[t["studentId"]] = t

    # Assemble rows
    rows = []
    for uid in paid_uids:
        u = user_map.get(uid, {})
        ps = ps_map.get(uid)
        bt = bt_map.get(uid)
        if ps:
            paid_at = ps.get("paidAt") or ps.get("createdAt")
            method = "Paystack"
            ref = ps.get("reference", "")
        elif bt:
            paid_at = bt.get("reviewedAt") or bt.get("createdAt")
            method = "Bank Transfer"
            ref = bt.get("transactionReference", "")
        else:
            paid_at = None
            method = "Unknown"
            ref = ""

        level = u.get("currentLevel", "N/A")
        if isinstance(level, int):
            level = str(level)

        rows.append({
            "name": f"{u.get('firstName', '')} {u.get('lastName', '')}".strip() or "N/A",
            "matricNumber": u.get("matricNumber", "N/A"),
            "email": u.get("email", ""),
            "level": level,
            "method": method,
            "reference": ref,
            "paidAt": paid_at,
        })

    pdf_buffer = generate_paid_students_pdf(
        payment_title=payment.get("title", "Payment"),
        payment_amount=payment.get("amount", 0),
        payment_category=payment.get("category", ""),
        rows=rows,
    )

    safe_title = payment.get("title", "Payment").replace(" ", "_")[:30]
    return StreamingResponse(
        pdf_buffer,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"attachment; filename=PaidStudents_{safe_title}.pdf"
        },
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

    # External students cannot make payments
    if (
        user.get("role") == "student"
        and user.get("department", "Industrial Engineering") != "Industrial Engineering"
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Payment is only available to IPE students"
        )
    
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
    transaction_dict["createdAt"] = datetime.now(timezone.utc)
    
    result = await transactions.insert_one(transaction_dict)
    
    # Update payment's paidBy array — use $addToSet to prevent duplicates
    # (guards against race conditions even with the earlier in-memory check)
    await payments.update_one(
        {"_id": ObjectId(payment_id)},
        {
            "$addToSet": {"paidBy": transaction_data.studentId},
            "$set": {"updatedAt": datetime.now(timezone.utc)}
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
    
    update_data["updatedAt"] = datetime.now(timezone.utc)
    
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
    
    await AuditLogger.log(
        action=AuditLogger.PAYMENT_APPROVED,
        actor_id=user.get("_id", ""),
        actor_email=user.get("email", ""),
        resource_type="payment",
        resource_id=payment_id,
        details={"updated_fields": list(update_data.keys())}
    )
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
    
    await AuditLogger.log(
        action=AuditLogger.PAYMENT_DELETED,
        actor_id=user.get("_id", ""),
        actor_email=user.get("email", ""),
        resource_type="payment",
        resource_id=payment_id,
    )
    return None


# ── Payment Reminders ────────────────────────────────────────────

@router.post("/{payment_id}/remind")
@limiter.limit("5/minute")
async def send_payment_reminder(
    request: Request,
    payment_id: str,
    user: dict = Depends(require_permission("payment:create")),
):
    """
    Send in-app notifications to all enrolled students who haven't paid.

    Rate limited to 5/minute to prevent spam.
    """
    from app.routers.notifications import create_bulk_notifications

    db = get_database()

    if not ObjectId.is_valid(payment_id):
        raise HTTPException(400, "Invalid payment ID format")

    payment = await db["payments"].find_one({"_id": ObjectId(payment_id)})
    if not payment:
        raise HTTPException(404, "Payment not found")

    session_id = payment.get("sessionId")
    paid_set = set(payment.get("paidBy", []))

    # Get all enrolled students for this session
    enrollments = await db["enrollments"].find(
        {
            "sessionId": session_id,
            "$or": [
                {"isActive": True},
                {"status": "active"},
            ],
        },
        {"userId": 1, "studentId": 1},
    ).to_list(length=5000)

    unpaid_ids_set: set[str] = set()
    for enrollment in enrollments:
        student_id = enrollment.get("studentId") or enrollment.get("userId")
        if student_id and student_id not in paid_set:
            unpaid_ids_set.add(student_id)

    unpaid_ids = list(unpaid_ids_set)

    if not unpaid_ids:
        return {"sent": 0, "message": "All enrolled students have paid"}

    title_text = payment.get("title", "Payment")
    deadline = payment.get("deadline")
    deadline_str = (
        deadline.strftime("%d %b %Y") if hasattr(deadline, "strftime") else str(deadline)
    )

    count = await create_bulk_notifications(
        user_ids=unpaid_ids,
        type="payment_reminder",
        title=f"Payment Reminder: {title_text}",
        message=f"You have an unpaid due — {title_text} (₦{payment.get('amount', 0):,.0f}). Deadline: {deadline_str}.",
        link="/dashboard/payments",
        related_id=payment_id,
        category="payments",
    )

    await AuditLogger.log(
        action="payment_reminder_sent",
        actor_id=user.get("_id", ""),
        actor_email=user.get("email", ""),
        resource_type="payment",
        resource_id=payment_id,
        details={"unpaid_count": len(unpaid_ids), "notified": count},
    )

    return {"sent": count, "unpaid": len(unpaid_ids)}
