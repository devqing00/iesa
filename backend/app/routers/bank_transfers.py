"""
Bank Transfer Router - Manual Payment via Bank Transfer

Students can submit proof of bank transfer (form-based, no file upload).
Admins can manage IESA bank accounts and review/approve/reject submissions.

Collections:
  - bankAccounts: IESA's bank account details (managed by admin)
  - bankTransfers: Student transfer proof submissions
"""

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Request
from pydantic import BaseModel, Field
from typing import Optional, List, Literal
from datetime import datetime, timezone
import logging

from app.core.email import get_email_service, EmailTemplate
from app.core.notification_utils import get_notification_emails, should_send_email, should_send_in_app
from app.core.audit import AuditLogger
from bson import ObjectId

from app.core.security import get_current_user
from app.core.permissions import require_permission, require_any_permission
from app.db import get_database

router = APIRouter(prefix="/api/v1/bank-transfers", tags=["Bank Transfers"])


# ─── Pydantic Models ────────────────────────────────────────────

class BankAccountCreate(BaseModel):
    """Create an IESA bank account for students to transfer to."""
    bankName: str = Field(..., min_length=2, max_length=100)
    accountName: str = Field(..., min_length=2, max_length=200)
    accountNumber: str = Field(..., min_length=10, max_length=10, pattern=r"^\d{10}$")
    isActive: bool = Field(default=True)
    notes: Optional[str] = Field(None, max_length=500, description="e.g. 'For dues only'")


class BankAccountUpdate(BaseModel):
    bankName: Optional[str] = Field(None, min_length=2, max_length=100)
    accountName: Optional[str] = Field(None, min_length=2, max_length=200)
    accountNumber: Optional[str] = Field(None, min_length=10, max_length=10, pattern=r"^\d{10}$")
    isActive: Optional[bool] = None
    notes: Optional[str] = Field(None, max_length=500)


class TransferProofCreate(BaseModel):
    """
    Student submits transfer proof via form — no file upload.
    They provide details from their bank receipt/notification.
    """
    paymentId: str = Field(..., description="Which payment due this transfer is for")
    bankAccountId: str = Field(..., description="Which IESA bank account they transferred to")
    amount: float = Field(..., gt=0, description="Amount transferred in Naira")
    senderName: str = Field(..., min_length=2, max_length=200, description="Name on sender's account")
    senderBank: str = Field(..., min_length=2, max_length=100, description="Sender's bank name")
    transactionReference: Optional[str] = Field(None, max_length=100, description="Bank transaction/session ID from receipt (optional)")
    transferDate: str = Field(..., description="Date of transfer (YYYY-MM-DD)")
    narration: Optional[str] = Field(None, max_length=300, description="Transfer narration/description if any")


class TransferReviewData(BaseModel):
    """Admin reviews a transfer proof submission."""
    status: Literal["approved", "rejected"] = Field(...)
    adminNote: Optional[str] = Field(None, max_length=500, description="Optional note to student")


# ─── Bank Accounts (Admin) ──────────────────────────────────────

@router.get("/accounts")
async def list_bank_accounts(
    current_user: dict = Depends(get_current_user),
    active_only: bool = Query(False, description="Only return active accounts"),
):
    """List all IESA bank accounts. Any authenticated user can see active accounts."""
    db = get_database()
    query = {"isActive": True} if active_only else {}
    cursor = db.bankAccounts.find(query).sort("createdAt", -1)
    accounts = []
    async for acc in cursor:
        acc["_id"] = str(acc["_id"])
        accounts.append(acc)
    return accounts


@router.post("/accounts", dependencies=[Depends(require_permission("bank_transfer:manage_accounts"))])
async def create_bank_account(
    data: BankAccountCreate,
    current_user: dict = Depends(get_current_user),
):
    """Add a new IESA bank account."""
    db = get_database()
    
    # Check for duplicate account number
    existing = await db.bankAccounts.find_one({"accountNumber": data.accountNumber})
    if existing:
        raise HTTPException(status_code=400, detail="An account with this number already exists")
    
    doc = {
        **data.model_dump(),
        "createdBy": current_user.get("uid") or current_user.get("_id"),
        "createdAt": datetime.now(timezone.utc),
        "updatedAt": datetime.now(timezone.utc),
    }
    result = await db.bankAccounts.insert_one(doc)
    doc["_id"] = str(result.inserted_id)
    return doc


@router.patch("/accounts/{account_id}", dependencies=[Depends(require_permission("bank_transfer:manage_accounts"))])
async def update_bank_account(
    account_id: str,
    data: BankAccountUpdate,
    current_user: dict = Depends(get_current_user),
):
    """Update an IESA bank account."""
    if not ObjectId.is_valid(account_id):
        raise HTTPException(status_code=400, detail="Invalid account ID format")
    db = get_database()
    updates = {k: v for k, v in data.model_dump(exclude_unset=True).items() if v is not None}
    if not updates:
        raise HTTPException(status_code=400, detail="No updates provided")
    
    updates["updatedAt"] = datetime.now(timezone.utc)
    result = await db.bankAccounts.update_one(
        {"_id": ObjectId(account_id)},
        {"$set": updates},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Account not found")
    
    updated = await db.bankAccounts.find_one({"_id": ObjectId(account_id)})
    updated["_id"] = str(updated["_id"])
    return updated


@router.delete("/accounts/{account_id}", dependencies=[Depends(require_permission("bank_transfer:manage_accounts"))])
async def delete_bank_account(account_id: str):
    """Delete an IESA bank account."""
    if not ObjectId.is_valid(account_id):
        raise HTTPException(status_code=400, detail="Invalid account ID format")
    db = get_database()
    result = await db.bankAccounts.delete_one({"_id": ObjectId(account_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Account not found")
    return {"message": "Account deleted"}


# ─── Transfer Proof Submissions (Student) ────────────────────────

@router.get("/check-reference")
async def check_transaction_reference(
    reference: str,
    current_user: dict = Depends(get_current_user),
):
    """
    Check whether a transaction reference has already been submitted.
    Returns {"exists": bool} — used for real-time frontend validation.
    """
    reference = (reference or "").strip()
    if not reference:
        return {"exists": False}

    db = get_database()
    in_transfers = await db.bankTransfers.find_one({"transactionReference": reference})
    in_transactions = await db.transactions.find_one({"reference": reference})
    return {"exists": bool(in_transfers or in_transactions)}


@router.post("/submit")
async def submit_transfer_proof(
    data: TransferProofCreate,
    current_user: dict = Depends(get_current_user),
):
    """
    Student submits bank transfer proof for a payment due.
    No file upload — form-based details from their receipt.
    """
    db = get_database()
    user_id = current_user.get("uid") or current_user.get("_id")

    # External students cannot make payments
    if (
        current_user.get("role") == "student"
        and current_user.get("department", "Industrial Engineering") != "Industrial Engineering"
    ):
        raise HTTPException(status_code=403, detail="Payment is only available to IPE students")

    # Validate payment exists
    payment = await db.payments.find_one({"_id": ObjectId(data.paymentId)})
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")
    
    # Check if already paid via any method
    if user_id in payment.get("paidBy", []):
        raise HTTPException(status_code=400, detail="You have already paid this due")
    
    # Check for existing pending submission for this payment
    existing = await db.bankTransfers.find_one({
        "studentId": user_id,
        "paymentId": data.paymentId,
        "status": "pending",
    })
    if existing:
        raise HTTPException(
            status_code=400,
            detail="You already have a pending transfer submission for this payment. Please wait for admin review."
        )

    provided_reference = (data.transactionReference or "").strip()

    if provided_reference:
        # Check for duplicate transaction reference globally
        duplicate_ref = await db.bankTransfers.find_one({
            "transactionReference": provided_reference
        })
        if duplicate_ref:
            raise HTTPException(
                status_code=409,
                detail=f"A transfer submission with reference '{provided_reference}' already exists. "
                    "Each bank transaction can only be submitted once."
            )

        # Also check transactions collection (approved transfers)
        duplicate_txn = await db.transactions.find_one({"reference": provided_reference})
        if duplicate_txn:
            raise HTTPException(
                status_code=409,
                detail=f"Reference '{provided_reference}' has already been used for a verified payment."
            )

    transaction_reference = provided_reference or (
        f"BT-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}-{str(ObjectId())[-6:].upper()}"
    )
    
    # Validate bank account exists and is active
    bank_account = await db.bankAccounts.find_one({"_id": ObjectId(data.bankAccountId), "isActive": True})
    if not bank_account:
        raise HTTPException(status_code=404, detail="Bank account not found or inactive")
    
    # Validate transfer amount matches payment amount
    if abs(data.amount - payment["amount"]) > 0.01:
        raise HTTPException(
            status_code=400,
            detail=f"Transfer amount (₦{data.amount:,.2f}) does not match payment amount (₦{payment['amount']:,.2f})"
        )
    
    doc = {
        "studentId": user_id,
        "studentName": f"{current_user.get('firstName', '')} {current_user.get('lastName', '')}".strip() or current_user.get("email", "Unknown"),
        "studentEmail": current_user.get("email", ""),
        "paymentId": data.paymentId,
        "paymentTitle": payment.get("title", "Unknown Payment"),
        "sessionId": payment.get("sessionId", ""),
        "bankAccountId": data.bankAccountId,
        "bankAccountName": bank_account.get("accountName", ""),
        "bankAccountBank": bank_account.get("bankName", ""),
        "bankAccountNumber": bank_account.get("accountNumber", ""),
        "amount": data.amount,
        "senderName": data.senderName,
        "senderBank": data.senderBank,
        "transactionReference": transaction_reference,
        "transferDate": data.transferDate,
        "narration": data.narration,
        "status": "pending",  # pending | approved | rejected
        "adminNote": None,
        "reviewedBy": None,
        "reviewedAt": None,
        "createdAt": datetime.now(timezone.utc),
        "updatedAt": datetime.now(timezone.utc),
    }
    result = await db.bankTransfers.insert_one(doc)
    doc["_id"] = str(result.inserted_id)
    return doc


@router.post("/{transfer_id}/upload-receipt")
async def upload_receipt_image(
    transfer_id: str,
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
):
    """Upload a receipt image for a bank transfer submission."""
    if not ObjectId.is_valid(transfer_id):
        raise HTTPException(status_code=400, detail="Invalid transfer ID format")
    
    db = get_database()
    user_id = current_user.get("uid") or current_user.get("_id")
    
    transfer = await db.bankTransfers.find_one({"_id": ObjectId(transfer_id)})
    if not transfer:
        raise HTTPException(status_code=404, detail="Transfer not found")
    
    if transfer["studentId"] != user_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Validate file type
    allowed_types = ["image/jpeg", "image/png", "image/webp", "image/jpg"]
    if file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail="Only JPEG, PNG, and WebP images are allowed")
    
    # Validate file size (max 5MB)
    file_data = await file.read()
    if len(file_data) > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large. Maximum size is 5MB.")
    
    # Upload to Cloudinary (async — does not block the event loop)
    from app.utils.cloudinary_config import upload_transfer_receipt
    ext = file.filename.rsplit(".", 1)[-1] if file.filename and "." in file.filename else "jpg"
    image_url = await upload_transfer_receipt(file_data, transfer_id, ext)
    
    if not image_url:
        raise HTTPException(status_code=500, detail="Failed to upload image")
    
    # Update transfer with image URL
    await db.bankTransfers.update_one(
        {"_id": ObjectId(transfer_id)},
        {"$set": {"receiptImageUrl": image_url, "updatedAt": datetime.now(timezone.utc)}}
    )
    
    return {"receiptImageUrl": image_url, "message": "Receipt image uploaded successfully"}


@router.get("/my")
async def get_my_transfers(
    current_user: dict = Depends(get_current_user),
):
    """Get current student's bank transfer submissions."""
    db = get_database()
    user_id = current_user.get("uid") or current_user.get("_id")
    cursor = db.bankTransfers.find({"studentId": user_id}).sort("createdAt", -1)
    transfers = []
    async for t in cursor:
        t["_id"] = str(t["_id"])
        transfers.append(t)
    return transfers


# ─── Transfer Review (Admin) ────────────────────────────────────

@router.get(
    "/",
    dependencies=[Depends(require_any_permission(["bank_transfer:view_all", "bank_transfer:review"]))],
)
async def list_all_transfers(
    status: Optional[str] = Query(None, description="Filter by status: pending|approved|rejected"),
    session_id: Optional[str] = Query(None, description="Filter by session"),
    limit: int = Query(100, ge=1, le=500),
):
    """List all bank transfer submissions (admin)."""
    db = get_database()
    query: dict = {}
    if status:
        query["status"] = status
    if session_id:
        query["sessionId"] = session_id
    
    cursor = db.bankTransfers.find(query).sort("createdAt", -1).limit(limit)
    transfers = []
    async for t in cursor:
        t["_id"] = str(t["_id"])
        transfers.append(t)
    return transfers


@router.patch(
    "/{transfer_id}/review",
    dependencies=[Depends(require_permission("bank_transfer:review"))],
)
async def review_transfer(
    transfer_id: str,
    data: TransferReviewData,
    request: Request,
    current_user: dict = Depends(get_current_user),
):
    """
    Admin approves or rejects a bank transfer submission.
    On approval: marks the payment as paid for the student.
    """
    if not ObjectId.is_valid(transfer_id):
        raise HTTPException(status_code=400, detail="Invalid transfer ID format")
    db = get_database()
    admin_id = current_user.get("uid") or current_user.get("_id")
    
    transfer = await db.bankTransfers.find_one({"_id": ObjectId(transfer_id)})
    if not transfer:
        raise HTTPException(status_code=404, detail="Transfer not found")
    
    if transfer["status"] != "pending":
        raise HTTPException(status_code=400, detail=f"Transfer already {transfer['status']}")
    
    # Update transfer status
    update = {
        "status": data.status,
        "adminNote": data.adminNote,
        "reviewedBy": admin_id,
        "reviewedAt": datetime.now(timezone.utc),
        "updatedAt": datetime.now(timezone.utc),
    }
    await db.bankTransfers.update_one(
        {"_id": ObjectId(transfer_id)},
        {"$set": update},
    )
    
    # If approved, mark the payment as paid
    if data.status == "approved":
        student_id = transfer["studentId"]
        session_id = transfer.get("sessionId")  # Get session ID from transfer

        # For dues (payment-linked transfers), a receipt image is mandatory
        if transfer.get("paymentId") and not transfer.get("receiptImageUrl"):
            raise HTTPException(
                status_code=400,
                detail="Cannot approve this dues transfer without a receipt screenshot."
            )
        
        # Handle event bank transfers (have eventId instead of paymentId)
        event_id = transfer.get("eventId")
        if event_id:
            # Auto-register student for the event
            await db.events.update_one(
                {"_id": ObjectId(event_id)},
                {
                    "$addToSet": {"registrations": student_id},
                    "$set": {"updatedAt": datetime.now(timezone.utc)},
                },
            )
        else:
            # Regular payment transfer
            payment_id = transfer["paymentId"]
            # Add student to paidBy
            await db.payments.update_one(
                {"_id": ObjectId(payment_id)},
                {
                    "$addToSet": {"paidBy": student_id},
                    "$set": {"updatedAt": datetime.now(timezone.utc)},
                },
            )
        
        # Create a transaction record for receipts and consistency
        await db.transactions.insert_one({
            "paymentId": transfer.get("paymentId"),
            "eventId": event_id,
            "sessionId": session_id,
            "studentId": student_id,
            "amount": transfer["amount"],
            "method": "bank_transfer",
            "reference": transfer.get("transactionReference", ""),
            "status": "verified",
            "bankTransferId": transfer_id,
            "createdAt": datetime.now(timezone.utc),
            "paidAt": datetime.now(timezone.utc),
        })
    
    # Fetch student for email + in-app notifications
    student = None
    try:
        student = await db.users.find_one({"_id": ObjectId(transfer["studentId"])})
    except Exception:
        pass

    # Send email notification to student about the review result
    try:
        if student and student.get("email") and should_send_email(student):
            student_name = f"{student.get('firstName', '')} {student.get('lastName', '')}".strip() or "Student"
            notification_emails = get_notification_emails(student)
            status_label = "approved" if data.status == "approved" else "rejected"
            note_html = f"<p><strong>Admin Note:</strong> {data.adminNote}</p>" if data.adminNote else ""
            
            if data.status == "approved":
                subject = f"✅ Bank Transfer Approved - {transfer.get('paymentTitle', 'Payment')}"
                html = f"""
                <html><body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #1E4528;">Transfer Approved!</h2>
                    <p>Dear {student_name},</p>
                    <p>Your bank transfer for <strong>{transfer.get('paymentTitle', 'Payment')}</strong> has been approved.</p>
                    <div style="background: #E8F5E9; padding: 16px; border-radius: 8px; margin: 16px 0;">
                        <p><strong>Amount:</strong> ₦{transfer['amount']:,.2f}</p>
                        <p><strong>Reference:</strong> {transfer.get('transactionReference', 'N/A')}</p>
                        <p><strong>Status:</strong> ✅ Approved</p>
                    </div>
                    {note_html}
                    <p>You can download your receipt from the <a href="https://iesa-ui.vercel.app/dashboard/payments">Payments page</a>.</p>
                </body></html>
                """
            else:
                subject = f"❌ Bank Transfer Rejected - {transfer.get('paymentTitle', 'Payment')}"
                html = f"""
                <html><body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #D32F2F;">Transfer Rejected</h2>
                    <p>Dear {student_name},</p>
                    <p>Your bank transfer for <strong>{transfer.get('paymentTitle', 'Payment')}</strong> has been rejected.</p>
                    <div style="background: #FFEBEE; padding: 16px; border-radius: 8px; margin: 16px 0;">
                        <p><strong>Amount:</strong> ₦{transfer['amount']:,.2f}</p>
                        <p><strong>Reference:</strong> {transfer.get('transactionReference', 'N/A')}</p>
                        <p><strong>Status:</strong> ❌ Rejected</p>
                    </div>
                    {note_html}
                    <p>Please review the admin's note and resubmit if needed from the <a href="https://iesa-ui.vercel.app/dashboard/payments">Payments page</a>.</p>
                </body></html>
                """
            
            email_service = get_email_service()
            for email_addr in notification_emails:
                await email_service.send_email(
                    to=email_addr,
                    subject=subject,
                    html_content=html,
                )
    except Exception as e:
        logging.error(f"Failed to send transfer review email: {e}")

    # Create in-app notification for the student (respect channel preference)
    try:
        if should_send_in_app(student or {}):
            from app.routers.notifications import create_notification
            if data.status == "approved":
                notif_title = f"✅ Transfer Approved — {transfer.get('paymentTitle', 'Payment')}"
                notif_msg = f"Your bank transfer of ₦{transfer['amount']:,.0f} has been approved."
            else:
                notif_title = f"❌ Transfer Rejected — {transfer.get('paymentTitle', 'Payment')}"
                notif_msg = data.adminNote or "Your bank transfer was rejected. Please check and resubmit."
            await create_notification(
                user_id=transfer["studentId"],
                type=f"transfer_{data.status}",
                title=notif_title,
                message=notif_msg[:500],
                link="/dashboard/payments?tab=history",
                related_id=transfer_id,
                category="payments",
            )
    except Exception as e:
        logging.error(f"Failed to create transfer notification: {e}")

    updated = await db.bankTransfers.find_one({"_id": ObjectId(transfer_id)})
    updated["_id"] = str(updated["_id"])
    
    # Audit log
    await AuditLogger.log(
        action=f"bank_transfer.{data.status}",
        actor_id=admin_id,
        actor_email=current_user.get("email", "unknown"),
        resource_type="bank_transfer",
        resource_id=transfer_id,
        details={
            "student_id": transfer["studentId"],
            "amount": transfer["amount"],
            "status": data.status,
            "admin_note": data.adminNote,
        },
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    
    return updated


@router.get("/{transfer_id}")
async def get_transfer(
    transfer_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Get a single transfer's details. Students can only see their own."""
    if not ObjectId.is_valid(transfer_id):
        raise HTTPException(status_code=400, detail="Invalid transfer ID format")
    db = get_database()
    user_id = current_user.get("uid") or current_user.get("_id")
    
    transfer = await db.bankTransfers.find_one({"_id": ObjectId(transfer_id)})
    if not transfer:
        raise HTTPException(status_code=404, detail="Transfer not found")
    
    # Students can only see their own
    if transfer["studentId"] != user_id:
        # Check if admin
        from app.core.permissions import get_user_permissions, get_current_session
        session = await db.sessions.find_one({"isActive": True})
        if session:
            perms = await get_user_permissions(user_id, str(session["_id"]))
            if "bank_transfer:view_all" not in perms and "bank_transfer:review" not in perms:
                raise HTTPException(status_code=403, detail="Not authorized")
        else:
            raise HTTPException(status_code=403, detail="Not authorized")
    
    transfer["_id"] = str(transfer["_id"])
    return transfer
