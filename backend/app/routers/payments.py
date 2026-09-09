"""
Payments Router - Session-Aware Financial Tracking

CRITICAL: All payments are session-scoped.
The session_id filter is automatically applied based on user's current session.
"""

from fastapi import APIRouter, HTTPException, Depends, status, Query, Request, BackgroundTasks, UploadFile, File
from fastapi.responses import StreamingResponse, Response
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime, timezone, timedelta
from bson import ObjectId
from slowapi import Limiter
from slowapi.util import get_remote_address
from html import escape

from app.models.payment import (
    Payment, PaymentCreate, PaymentUpdate, PaymentWithStatus,
    Transaction, TransactionCreate, TicketConfig
)
from app.db import get_database
from app.core.security import get_current_user
from app.core.permissions import require_permission
from app.core.audit import AuditLogger

router = APIRouter(prefix="/api/v1/payments", tags=["Payments"])
limiter = Limiter(key_func=get_remote_address)


async def _resolve_session_for_payments(db, session_ref: str) -> dict | None:
    """Resolve a session document from either ObjectId string or session name label."""
    sessions = db["sessions"]
    ref = (session_ref or "").strip()
    if not ref:
        return None

    if ObjectId.is_valid(ref):
        return await sessions.find_one({"_id": ObjectId(ref)})

    # Fallback for clients accidentally sending display labels like "2025/2026 (Active)"
    normalized_name = ref.replace("(Active)", "").strip()
    return await sessions.find_one({"name": normalized_name})


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
    session = await _resolve_session_for_payments(db, payment_data.sessionId)
    if not session:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid session reference: {payment_data.sessionId}"
        )
    
    # Create payment document
    payment_dict = payment_data.model_dump()
    payment_dict["sessionId"] = str(session["_id"])
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
        session_id=str(session["_id"]),
        details={"amount": payment_data.amount, "category": payment_data.category}
    )
    from app.routers.sse import publish
    from app.core.cache import cache_delete, cache_delete_pattern
    publish("payment_created", {"id": str(result.inserted_id), "category": payment_data.category}, ipe_only=True)
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
    session = await _resolve_session_for_payments(db, session_id)
    if not session:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid session reference: {session_id}"
        )
    session_id = str(session["_id"])
    
    # Get total count for pagination
    total = await payments.count_documents({"sessionId": session_id})
    
    # Get payments for this session
    cursor = payments.find({"sessionId": session_id}).sort("deadline", 1).skip(skip).limit(limit)
    payment_list = await cursor.to_list(length=limit)
    
    # Enrich with user's payment status
    user_id = str(user.get("_id", ""))
    result = []
    for payment in payment_list:
        payment["_id"] = str(payment["_id"])
        
        # Ensure paidBy is a list of clean string IDs
        raw_paid_by = payment.get("paidBy") or []
        paid_by_clean = [str(uid) for uid in raw_paid_by if uid is not None]
        payment["paidBy"] = paid_by_clean
        
        # Check if current user has paid
        has_paid = user_id in paid_by_clean
        
        # Get transaction if exists
        transaction_id = None
        if has_paid:
            transaction = await transactions.find_one({
                "studentId": user_id,
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


@router.get("/export/pdf")
async def export_payments_pdf(
    session_id: Optional[str] = Query(None, description="Filter by session ID. Defaults to active session."),
    category: Optional[str] = Query("all", description="Category filter"),
    status_filter: Optional[str] = Query("all", description="Status filter: all|pending|paid|overdue"),
    limit: int = Query(2000, ge=1, le=5000),
    user: dict = Depends(require_permission("payment:view_all")),
):
    """Export payments list as PDF (admin)."""
    from app.utils.tabular_pdf import generate_tabular_pdf

    db = get_database()
    payments = db["payments"]
    sessions = db["sessions"]

    if not session_id:
        active_session = await sessions.find_one({"isActive": True})
        if not active_session:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No active session found")
        session_id = str(active_session["_id"])

    session = await _resolve_session_for_payments(db, session_id)
    if not session:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Invalid session reference: {session_id}")
    resolved_session_id = str(session["_id"])

    query = {"sessionId": resolved_session_id}
    if category and category != "all":
        query["category"] = category

    payment_list = await payments.find(query).sort("deadline", 1).limit(limit).to_list(length=limit)

    now = datetime.now(timezone.utc)
    rows = []
    for payment in payment_list:
        paid_count = len(payment.get("paidBy") or [])
        deadline = payment.get("deadline")
        is_overdue = bool(deadline and isinstance(deadline, datetime) and deadline < now and paid_count == 0)
        derived_status = "overdue" if is_overdue else ("paid" if paid_count > 0 else "pending")
        if status_filter and status_filter != "all" and derived_status != status_filter:
            continue

        rows.append([
            payment.get("title", ""),
            payment.get("category", ""),
            f"{payment.get('amount', 0)}",
            deadline.strftime("%Y-%m-%d") if isinstance(deadline, datetime) else "—",
            "Yes" if payment.get("mandatory") else "No",
            str(paid_count),
            derived_status.capitalize(),
        ])

    pdf_buffer = generate_tabular_pdf(
        title="IESA Payments Export",
        subtitle=f"Session: {session.get('name', 'Unknown')} · Generated {now.strftime('%Y-%m-%d %H:%M UTC')} · Rows: {len(rows)}",
        headers=["Title", "Category", "Amount", "Deadline", "Mandatory", "Paid By", "Status"],
        rows=rows,
    )

    return Response(
        content=pdf_buffer.getvalue(),
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=iesa-payments-{now.strftime('%Y%m%d')}.pdf"},
    )


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
    user_id = str(user.get("_id", ""))
    raw_paid_by = payment.get("paidBy") or []
    paid_by_clean = [str(uid) for uid in raw_paid_by if uid is not None]
    payment["paidBy"] = paid_by_clean
    has_paid = user_id in paid_by_clean
    transaction_id = None
    
    if has_paid:
        transaction = await transactions.find_one({
            "studentId": user_id,
            "paymentId": payment_id
        })
        if transaction:
            transaction_id = str(transaction["_id"])
    
    payment_data = {k: v for k, v in payment.items() if k not in ["hasPaid", "transactionId"]}
    return PaymentWithStatus(
        **payment_data,
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

    # Sanitize title to prevent UnicodeEncodeError in HTTP headers
    safe_title = "".join(c for c in payment.get("title", "Payment") if c.isalnum() or c in " _-").strip()
    safe_title = safe_title.replace(" ", "_")[:30]
    
    return Response(
        content=pdf_buffer.getvalue(),
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"attachment; filename=PaidStudents_{safe_title}.pdf"
        },
    )


@router.post("/{payment_id}/pay", response_model=Transaction, dependencies=[Depends(require_permission("payment:edit"))])
async def record_payment(
    payment_id: str,
    transaction_data: TransactionCreate,
    user: dict = Depends(get_current_user)
):
    """
    Record a payment transaction.
    Only admins with payment:edit permission can record manual payments.
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


# ── Ticket Generation ────────────────────────────────────────────

@router.post("/{payment_id}/ticket-template")
async def upload_ticket_template_endpoint(
    payment_id: str,
    file: UploadFile = File(...),
    user: dict = Depends(require_permission("payment:edit"))
):
    """Upload a ticket template image to Cloudinary and return the URL."""
    from app.utils.cloudinary_config import upload_ticket_template
    
    if not ObjectId.is_valid(payment_id):
        raise HTTPException(400, "Invalid payment ID")
        
    if not file.content_type.startswith("image/"):
        raise HTTPException(400, "File must be an image")
        
    file_data = await file.read()
    if len(file_data) > 5 * 1024 * 1024:
        raise HTTPException(400, "File size must be under 5MB")
        
    url = await upload_ticket_template(file_data, payment_id)
    if not url:
        raise HTTPException(500, "Failed to upload image")
        
    return {"url": url}


@router.post("/{payment_id}/ticket-config", response_model=Payment)
async def update_ticket_config(
    payment_id: str,
    config: TicketConfig,
    user: dict = Depends(require_permission("payment:edit"))
):
    """Save visual ticket configuration"""
    db = get_database()
    
    if not ObjectId.is_valid(payment_id):
        raise HTTPException(400, "Invalid payment ID")
        
    result = await db.payments.update_one(
        {"_id": ObjectId(payment_id)},
        {"$set": {"ticketConfig": config.model_dump(), "updatedAt": datetime.now(timezone.utc)}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(404, "Payment not found")
        
    payment = await db.payments.find_one({"_id": ObjectId(payment_id)})
    payment["_id"] = str(payment["_id"])
    return Payment(**payment)


class TicketDispatchPayload(BaseModel):
    subject: Optional[str] = None
    content: Optional[str] = None
    testEmail: Optional[str] = None


async def _process_ticket_dispatch(
    payment_id: str,
    admin_email: str,
    custom_subject: Optional[str] = None,
    custom_content: Optional[str] = None,
    test_email: Optional[str] = None,
):
    import asyncio
    import logging
    from app.utils.visual_ticket_generator import generate_visual_ticket
    from app.core.email import EmailService, EmailTemplate
    
    db = get_database()
    payment = await db.payments.find_one({"_id": ObjectId(payment_id)})
    if not payment or not payment.get("ticketConfig"):
        return
        
    config = payment["ticketConfig"]
    paid_uids = payment.get("paidBy", [])
    if not paid_uids:
        return
        
    oid_list = [ObjectId(uid) for uid in paid_uids if ObjectId.is_valid(uid)]
    users = await db.users.find(
        {"_id": {"$in": oid_list}},
        {"firstName": 1, "lastName": 1, "email": 1, "matricNumber": 1}
    ).to_list(length=None)

    if not users:
        return

    is_test = bool(test_email)
    if is_test:
        sample_user = next((u for u in users if "toriola" in f"{u.get('firstName', '')} {u.get('lastName', '')}".lower()), users[0])
        recipients = [(sample_user, test_email)]
    else:
        recipients = [(u, u.get("email")) for u in users if u.get("email")]

    email_service = EmailService()
    raw_subject = custom_subject or config.get("emailSubject") or f"Your Ticket: {payment.get('title', 'Event Ticket')}"
    raw_content = custom_content or config.get("emailContent")

    for u, target_email in recipients:
        student_name = f"{u.get('firstName', '')} {u.get('lastName', '')}".strip()
        first_name = u.get("firstName", "Attendee").strip()
        first_token = first_name.split()[0].title() if first_name else "Attendee"
        matric = u.get("matricNumber", "")
        
        qr_data = f"IESA_EVENT:{payment_id}|STUDENT:{u['_id']}"
        
        try:
            loop = asyncio.get_running_loop()
            ticket_bytes = await loop.run_in_executor(None, lambda: generate_visual_ticket(
                template_url=config.get("templateUrl"),
                qr_config=config.get("qrCode", {}),
                name_config=config.get("studentName", {}),
                matric_config=config.get("matricNumber", {}),
                font_family=config.get("fontFamily", "Helvetica"),
                student_name=student_name,
                matric_number=matric,
                qr_data=qr_data
            ))

            subject = raw_subject.replace("{{first_name}}", first_token)
            subject = subject.replace("{{student_name}}", student_name)
            subject = subject.replace("{{full_name}}", student_name)
            subject = subject.replace("{{matric_number}}", matric)

            if raw_content:
                content = raw_content.replace("{{first_name}}", first_token)
                content = content.replace("{{student_name}}", student_name)
                content = content.replace("{{full_name}}", student_name)
                content = content.replace("{{matric_number}}", matric)

                context = {
                    "title": subject,
                    "content": content,
                    "student_name": student_name,
                    "priority": "normal",
                    "target_label": "Paid Attendees",
                    "dashboard_url": "https://iesaui.org/dashboard/payments",
                }
                _, html_content = email_service._render_template(EmailTemplate.ANNOUNCEMENT, context)
            else:
                html_content = f"""<!DOCTYPE html>
                <html lang="en">
                <head>
                  <meta charset="utf-8">
                  <meta name="viewport" content="width=device-width, initial-scale=1.0">
                  <style>
                    body {{ margin: 0; padding: 0; background-color: #FFFFFF; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; color: #334155; }}
                    a {{ color: #0F172A; }}
                  </style>
                </head>
                <body style="margin:0;padding:32px 16px;background-color:#FFFFFF;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;color:#334155;">
                  <div style="max-width:580px;margin:0 auto;text-align:left;">
                    <p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#334155;">Hello {escape(student_name)},</p>
                    <p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#334155;">Your ticket for <strong>{escape(payment.get('title', 'Event'))}</strong> is attached to this email as an image.</p>
                    <p style="margin:0 0 20px;font-size:14px;line-height:1.65;color:#64748B;">Please present the QR code at the entrance for verification.</p>

                    <div style="margin-top:40px;padding-top:20px;border-top:1px solid #E2E8F0;">
                      <p style="margin:0;font-size:12px;line-height:1.6;color:#94A3B8;">
                        Industrial Engineering Students&apos; Association · University of Ibadan<br>
                        Department of Industrial &amp; Production Engineering
                      </p>
                    </div>
                  </div>
                </body>
                </html>
                """

            safe_title = payment.get('title', 'Ticket').replace(' ', '_')
            await email_service.send_email(
                to=target_email,
                subject=subject,
                html_content=html_content,
                attachments=[{
                    "filename": f"IESA_Ticket_{safe_title}.png",
                    "content": ticket_bytes
                }]
            )
            
            if not is_test:
                await asyncio.sleep(0.2)
            
        except Exception as e:
            logging.error(f"Error dispatching ticket for {target_email}: {str(e)}")


@router.post("/{payment_id}/send-tickets")
async def dispatch_tickets(
    payment_id: str,
    background_tasks: BackgroundTasks,
    payload: Optional[TicketDispatchPayload] = None,
    user: dict = Depends(require_permission("payment:edit"))
):
    """Trigger background job or test email to send visual tickets to paid students"""
    db = get_database()
    if not ObjectId.is_valid(payment_id):
        raise HTTPException(400, "Invalid payment ID")
        
    payment = await db.payments.find_one({"_id": ObjectId(payment_id)})
    if not payment:
        raise HTTPException(404, "Payment not found")
        
    if not payment.get("ticketConfig"):
        raise HTTPException(400, "Ticket configuration not set for this payment")
        
    if not payment.get("paidBy"):
        raise HTTPException(400, "No paid students to send tickets to")

    subject = payload.subject if payload else None
    content = payload.content if payload else None
    test_email = payload.testEmail.strip() if (payload and payload.testEmail) else None

    # Persist custom subject and content to ticketConfig if provided
    if subject or content:
        update_fields = {}
        if subject:
            update_fields["ticketConfig.emailSubject"] = subject
        if content:
            update_fields["ticketConfig.emailContent"] = content
        await db.payments.update_one(
            {"_id": ObjectId(payment_id)},
            {"$set": update_fields}
        )

    if test_email:
        await _process_ticket_dispatch(
            payment_id=payment_id,
            admin_email=user.get("email"),
            custom_subject=subject,
            custom_content=content,
            test_email=test_email,
        )
        return {"message": f"Test ticket email sent to {test_email}", "count": 1, "isTest": True}
        
    background_tasks.add_task(
        _process_ticket_dispatch,
        payment_id=payment_id,
        admin_email=user.get("email"),
        custom_subject=subject,
        custom_content=content,
    )
    return {"message": "Ticket dispatch started", "count": len(payment.get("paidBy", []))}



@router.get("/{payment_id}/tickets/pdf")
async def download_printable_tickets_pdf(
    payment_id: str,
    student_id: Optional[str] = Query(None, description="Optional ID of a specific student to generate a ticket for"),
    user: dict = Depends(require_permission("payment:view_all"))
):
    """Generates a tiled A4 PDF of all tickets for paid students"""
    import asyncio
    import logging
    from app.utils.visual_ticket_generator import generate_visual_ticket, generate_printable_tickets_pdf
    
    db = get_database()
    if not ObjectId.is_valid(payment_id):
        raise HTTPException(400, "Invalid payment ID")
        
    payment = await db.payments.find_one({"_id": ObjectId(payment_id)})
    if not payment:
        raise HTTPException(404, "Payment not found")
        
    if not payment.get("ticketConfig"):
        raise HTTPException(400, "Ticket configuration not set for this payment")
        
    paid_uids = payment.get("paidBy", [])
    if not paid_uids:
        raise HTTPException(400, "No paid students to generate tickets for")
        
    config = payment["ticketConfig"]
    
    # Filter for single student if requested
    if student_id:
        if student_id not in paid_uids:
            raise HTTPException(400, "Requested student has not paid for this event")
        oid_list = [ObjectId(student_id)]
    else:
        oid_list = [ObjectId(uid) for uid in paid_uids if ObjectId.is_valid(uid)]
        
    users = await db.users.find(
        {"_id": {"$in": oid_list}},
        {"firstName": 1, "lastName": 1, "email": 1, "matricNumber": 1}
    ).to_list(length=None)
    
    loop = asyncio.get_running_loop()
    
    def generate_all_tickets(users_list, config, p_id):
        buffers = []
        for u in users_list:
            student_name = f"{u.get('firstName', '')} {u.get('lastName', '')}".strip()
            matric = u.get("matricNumber", "")
            qr_data = f"IESA_EVENT:{p_id}|STUDENT:{str(u['_id'])}"
            try:
                ticket_bytes = generate_visual_ticket(
                    template_url=config.get("templateUrl"),
                    qr_config=config.get("qrCode", {}),
                    name_config=config.get("studentName", {}),
                    matric_config=config.get("matricNumber", {}),
                    font_family=config.get("fontFamily", "Helvetica"),
                    student_name=student_name,
                    matric_number=matric,
                    qr_data=qr_data
                )
                buffers.append(ticket_bytes)
            except Exception as e:
                logging.error(f"Error generating ticket for {u.get('email')}: {str(e)}")
        return buffers

    ticket_buffers = await loop.run_in_executor(None, generate_all_tickets, users, config, payment_id)
    
    if not ticket_buffers:
        raise HTTPException(500, "Failed to generate any tickets")
        
    pdf_bytes = await loop.run_in_executor(None, generate_printable_tickets_pdf, ticket_buffers)
    
    if not pdf_bytes:
        raise HTTPException(500, "Failed to compile PDF")
        
    safe_title = "".join(c for c in payment.get("title", "Tickets") if c.isalnum() or c in (" ", "-", "_")).replace(" ", "_")
    filename = f"Ticket_{student_id}_{safe_title}.pdf" if student_id else f"PrintableTickets_{safe_title}.pdf"
    
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"'
        }
    )

class TicketCheckInRequest(BaseModel):
    qrData: str

@router.post("/{payment_id}/check-in")
async def check_in_ticket(
    payment_id: str,
    payload: TicketCheckInRequest,
    user: dict = Depends(get_current_user),
    _perm: None = Depends(require_permission("payment:edit"))
):
    """Scan a ticket QR code for a specific payment."""
    db = get_database()
    
    if not ObjectId.is_valid(payment_id):
        raise HTTPException(status_code=400, detail="Invalid payment ID")
        
    payment = await db.payments.find_one({"_id": ObjectId(payment_id)})
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")
        
    # parse qrData: IESA_EVENT:{payment_id}|STUDENT:{student_id}
    data = payload.qrData
    if not data.startswith("IESA_EVENT:"):
        raise HTTPException(status_code=400, detail="Invalid QR code format")
        
    parts = data.split("|")
    if len(parts) != 2:
        raise HTTPException(status_code=400, detail="Invalid QR code format")
        
    qr_payment_id = parts[0].replace("IESA_EVENT:", "")
    qr_student_id = parts[1].replace("STUDENT:", "")
    
    if qr_payment_id != payment_id:
        raise HTTPException(status_code=400, detail="Ticket is for a different event/payment")
        
    if qr_student_id not in payment.get("paidBy", []):
        raise HTTPException(status_code=400, detail="Student has not paid for this event")
        
    if qr_student_id in payment.get("checkIns", []):
        return {"message": "Already checked in", "success": True}
        
    await db.payments.update_one(
        {"_id": ObjectId(payment_id)},
        {"$push": {"checkIns": qr_student_id}}
    )
    
    student = await db.users.find_one({"_id": ObjectId(qr_student_id)})
    student_name = f"{student.get('firstName', '')} {student.get('lastName', '')}".strip() if student else "Student"
    
    return {"message": f"Check-in successful for {student_name}", "success": True}

class SyncEventRequest(BaseModel):
    eventId: str

@router.post("/{payment_id}/sync-event")
async def sync_payment_to_event(
    payment_id: str,
    payload: SyncEventRequest,
    user: dict = Depends(get_current_user),
    _perm: None = Depends(require_permission("payment:edit"))
):
    """Auto-register all students who have paid this payment to the specified event."""
    db = get_database()
    
    if not ObjectId.is_valid(payment_id):
        raise HTTPException(status_code=400, detail="Invalid payment ID")
    if not ObjectId.is_valid(payload.eventId):
        raise HTTPException(status_code=400, detail="Invalid event ID")
        
    payment = await db.payments.find_one({"_id": ObjectId(payment_id)})
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")
        
    event = await db.events.find_one({"_id": ObjectId(payload.eventId)})
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
        
    paid_students = payment.get("paidBy", [])
    if not paid_students:
        return {"message": "No paid students to sync", "synced": 0}
        
    # Get current registrations
    current_regs = event.get("registrations", [])
    
    # Calculate new ones
    new_regs = [sid for sid in paid_students if sid not in current_regs]
    
    if not new_regs:
        return {"message": "All paid students are already registered for this event.", "synced": 0}
        
    # Update event
    await db.events.update_one(
        {"_id": ObjectId(payload.eventId)},
        {"$push": {"registrations": {"$each": new_regs}}}
    )
    
    # Save the link on the payment so future payers get auto-registered
    await db.payments.update_one(
        {"_id": ObjectId(payment_id)},
        {"$set": {"linkedEventId": payload.eventId}}
    )
    
    return {"message": f"Successfully registered {len(new_regs)} paid students to {event.get('title')}", "synced": len(new_regs)}
