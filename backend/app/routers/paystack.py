"""
Paystack Integration Router - Online Payment Processing

This module handles online payment processing using Paystack gateway.
Features:
- Initialize Paystack transactions
- Verify payment status
- Webhook for automatic confirmation
- Payment receipt generation
"""

from fastapi import APIRouter, HTTPException, Depends, Header, Request, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field, validator
from typing import Optional, List
from datetime import datetime, timezone
import os
import hmac
import hashlib
import httpx
from bson import ObjectId
from slowapi import Limiter
from slowapi.util import get_remote_address
from ..core.security import get_current_user
# receipt_generator is lazy-imported where used to save ~30MB startup memory
from ..core.email import send_payment_receipt

router = APIRouter(prefix="/api/v1/paystack", tags=["Paystack"])
limiter = Limiter(key_func=get_remote_address)

# Paystack configuration
PAYSTACK_SECRET_KEY = os.getenv("PAYSTACK_SECRET_KEY", "")
PAYSTACK_PUBLIC_KEY = os.getenv("PAYSTACK_PUBLIC_KEY", "")
PAYSTACK_BASE_URL = "https://api.paystack.co"

if not PAYSTACK_SECRET_KEY:
    print("⚠️  WARNING: PAYSTACK_SECRET_KEY not set. Online payments will fail.")


# Pydantic Models
class PaymentInitializeRequest(BaseModel):
    """Request to initialize a payment transaction"""
    amount: float = Field(..., gt=0, description="Amount in Naira")
    paymentId: str = Field(..., description="ID of the payment/due being paid")
    
    @validator('amount')
    def validate_amount(cls, v):
        if v <= 0:
            raise ValueError("Amount must be greater than 0")
        return v


class PaymentResponse(BaseModel):
    """Payment transaction response"""
    transactionId: str
    reference: str
    authorizationUrl: str
    accessCode: str
    amount: float
    status: str


class PaymentVerifyResponse(BaseModel):
    """Payment verification response"""
    transactionId: str
    reference: str
    amount: float
    status: str
    paidAt: Optional[datetime]
    channel: Optional[str]


# Helper Functions
def generate_payment_reference(user_id: str) -> str:
    """Generate unique payment reference"""
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
    return f"IESA-{user_id[:8]}-{timestamp}"


def verify_paystack_signature(payload: bytes, signature: str) -> bool:
    """Verify Paystack webhook signature"""
    if not PAYSTACK_SECRET_KEY:
        return False
    
    computed_signature = hmac.new(
        PAYSTACK_SECRET_KEY.encode('utf-8'),
        payload,
        hashlib.sha512
    ).hexdigest()
    
    return hmac.compare_digest(computed_signature, signature)


# Endpoints
@router.post("/initialize", response_model=PaymentResponse)
@limiter.limit("10/minute")
async def initialize_payment(
    request: Request,
    payment_request: PaymentInitializeRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Initialize a Paystack payment transaction.
    Returns authorization URL for payment.
    
    Rate limited to prevent payment spam.
    """
    try:
        from app.db import get_database
        db = get_database()

        # External students cannot make payments
        if (
            current_user.get("role") == "student"
            and current_user.get("department", "Industrial Engineering") != "Industrial Engineering"
        ):
            raise HTTPException(status_code=403, detail="Payment is only available to IPE students")
        
        # Validate paymentId format
        if not ObjectId.is_valid(payment_request.paymentId):
            raise HTTPException(status_code=400, detail="Invalid payment ID format")
        
        # Verify payment exists
        payment = await db.payments.find_one({"_id": ObjectId(payment_request.paymentId)})
        if not payment:
            raise HTTPException(status_code=404, detail="Payment not found")
        
        # Check if already paid
        if current_user["_id"] in payment.get("paidBy", []):
            raise HTTPException(status_code=400, detail="You have already paid this due")
        
        # SECURITY: Use the server-side amount from the payment record, NOT the client-supplied amount
        server_amount = payment.get("amount", 0)
        if server_amount <= 0:
            raise HTTPException(status_code=400, detail="Payment amount is not configured")
        
        # Check for existing pending transaction to prevent duplicates
        existing_pending = await db.paystackTransactions.find_one({
            "studentId": current_user["_id"],
            "paymentId": payment_request.paymentId,
            "status": "pending"
        })
        if existing_pending:
            # Return the existing pending transaction's URL
            existing_url = existing_pending.get("paystackData", {}).get("authorizationUrl")
            if existing_url:
                return PaymentResponse(
                    transactionId=str(existing_pending["_id"]),
                    reference=existing_pending["reference"],
                    authorizationUrl=existing_url,
                    accessCode=existing_pending.get("paystackData", {}).get("accessCode", ""),
                    amount=server_amount,
                    status="pending"
                )
        
        # Generate unique reference
        reference = generate_payment_reference(current_user["_id"])
        
        # Convert to kobo (Paystack uses kobo) — use server amount
        amount_kobo = int(server_amount * 100)
        
        # Build student full name from profile
        _first = current_user.get("firstName", "")
        _last = current_user.get("lastName", "")
        _student_name = f"{_first} {_last}".strip() or current_user.get("displayName", current_user.get("email", "Unknown"))
        
        # Prepare Paystack request
        paystack_data = {
            "email": current_user.get("email", "student@example.com"),
            "amount": amount_kobo,
            "reference": reference,
            "callback_url": f"{os.getenv('FRONTEND_URL', 'http://localhost:3000')}/dashboard/payments?reference={reference}",
            "metadata": {
                "studentId": current_user["_id"],
                "studentName": _student_name,
                "studentEmail": current_user.get("email", "student@example.com"),
                "paymentId": payment_request.paymentId,
                "paymentTitle": payment.get("title", "IESA Payment"),
                "custom_fields": [
                    {
                        "display_name": "Student Name",
                        "variable_name": "student_name",
                        "value": _student_name
                    },
                    {
                        "display_name": "Payment Type",
                        "variable_name": "payment_type",
                        "value": payment.get("title", "IESA Payment")
                    }
                ]
            }
        }
        
        # Call Paystack API
        headers = {
            "Authorization": f"Bearer {PAYSTACK_SECRET_KEY}",
            "Content-Type": "application/json"
        }
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{PAYSTACK_BASE_URL}/transaction/initialize",
                json=paystack_data,
                headers=headers,
                timeout=10
            )
        
            if not response.is_success:
                error_data = response.json()
                raise HTTPException(
                    status_code=response.status_code,
                    detail=error_data.get("message", "Failed to initialize payment")
                )
        
            data = response.json()["data"]
        
        # Store transaction record
        transaction_record = {
            "reference": reference,
            "paymentId": payment_request.paymentId,
            "studentId": current_user["_id"],
            "studentName": _student_name,
            "studentLevel": current_user.get("currentLevel") or current_user.get("level") or "N/A",
            "studentEmail": current_user.get("email", "student@example.com"),
            "amount": server_amount,
            "amountKobo": amount_kobo,
            "status": "pending",
            "paystackData": {
                "accessCode": data["access_code"],
                "authorizationUrl": data["authorization_url"]
            },
            "createdAt": datetime.now(timezone.utc),
            "updatedAt": datetime.now(timezone.utc)
        }
        
        result = await db.paystackTransactions.insert_one(transaction_record)
        
        return PaymentResponse(
            transactionId=str(result.inserted_id),
            reference=reference,
            authorizationUrl=data["authorization_url"],
            accessCode=data["access_code"],
            amount=server_amount,
            status="pending"
        )
        
    except httpx.HTTPError as e:
        raise HTTPException(
            status_code=503,
            detail=safe_detail("Payment service unavailable", e)
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=safe_detail("Failed to initialize payment", e)
        )


@router.get("/verify/{reference}", response_model=PaymentVerifyResponse)
async def verify_payment(
    reference: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Verify payment status by reference.
    Checks Paystack for transaction status and updates local record.
    """
    try:
        from app.db import get_database
        db = get_database()
        
        # Check local database first
        transaction = await db.paystackTransactions.find_one({"reference": reference})
        
        if not transaction:
            raise HTTPException(status_code=404, detail="Transaction not found")
        
        # Verify ownership
        if transaction["studentId"] != current_user["_id"]:
            raise HTTPException(status_code=403, detail="Not authorized to access this transaction")
        
        # If already verified as success, return cached result
        if transaction["status"] == "success":
            return PaymentVerifyResponse(
                transactionId=str(transaction["_id"]),
                reference=transaction["reference"],
                amount=transaction["amount"],
                status=transaction["status"],
                paidAt=transaction.get("paidAt"),
                channel=transaction.get("channel")
            )
        
        # Verify with Paystack
        headers = {
            "Authorization": f"Bearer {PAYSTACK_SECRET_KEY}",
            "Content-Type": "application/json"
        }
        
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{PAYSTACK_BASE_URL}/transaction/verify/{reference}",
                headers=headers,
                timeout=10
            )
        
            if not response.is_success:
                error_data = response.json()
                raise HTTPException(
                    status_code=response.status_code,
                    detail=error_data.get("message", "Failed to verify payment")
                )
        
            data = response.json()["data"]
        
        status = data["status"]
        
        # Update transaction record
        update_data = {
            "status": status,
            "paystackResponse": data,
            "updatedAt": datetime.now(timezone.utc)
        }
        
        if status == "success":
            paid_at_str = data.get("paid_at", "")
            if paid_at_str:
                # Parse ISO format datetime
                paid_at = datetime.fromisoformat(paid_at_str.replace("Z", "+00:00"))
                update_data["paidAt"] = paid_at
            
            update_data["channel"] = data.get("channel")
            update_data["amountPaid"] = data["amount"] / 100  # Convert from kobo
            
            # SECURITY: Verify paid amount matches expected amount
            expected_amount = transaction.get("amount", 0)
            actual_amount = data["amount"] / 100
            if expected_amount > 0 and actual_amount < expected_amount:
                update_data["status"] = "amount_mismatch"
                update_data["amountMismatch"] = {
                    "expected": expected_amount,
                    "actual": actual_amount
                }
                await db.paystackTransactions.update_one(
                    {"reference": reference},
                    {"$set": update_data}
                )
                raise HTTPException(
                    status_code=400,
                    detail=f"Payment amount mismatch: expected {expected_amount}, got {actual_amount}"
                )
            
            # Update payment's paidBy array (if linked to a payment)
            payment_id = transaction.get("paymentId")
            if payment_id:
                await db.payments.update_one(
                    {"_id": ObjectId(payment_id)},
                    {
                        "$addToSet": {"paidBy": current_user["_id"]},
                        "$set": {"updatedAt": datetime.now(timezone.utc)}
                    }
                )
                
                # Idempotent upsert — prevents duplicate if webhook already created this
                await db.transactions.update_one(
                    {"reference": reference},
                    {
                        "$setOnInsert": {
                            "paymentId": payment_id,
                            "studentId": current_user["_id"],
                            "amount": transaction["amount"],
                            "method": "paystack",
                            "reference": reference,
                            "status": "verified",
                            "createdAt": datetime.now(timezone.utc),
                        }
                    },
                    upsert=True,
                )
            
            # Handle event payment: auto-register user for the event
            event_id = transaction.get("eventId")
            if event_id:
                await db.events.update_one(
                    {"_id": ObjectId(event_id)},
                    {
                        "$addToSet": {"registrations": current_user["_id"]},
                        "$set": {"updatedAt": datetime.now(timezone.utc)}
                    }
                )
        
        await db.paystackTransactions.update_one(
            {"reference": reference},
            {"$set": update_data}
        )
        
        # Fetch updated record
        transaction = await db.paystackTransactions.find_one({"reference": reference})
        
        return PaymentVerifyResponse(
            transactionId=str(transaction["_id"]),
            reference=transaction["reference"],
            amount=transaction["amount"],
            status=transaction["status"],
            paidAt=transaction.get("paidAt"),
            channel=transaction.get("channel")
        )
        
    except httpx.HTTPError as e:
        raise HTTPException(
            status_code=503,
            detail=safe_detail("Payment verification service unavailable", e)
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=safe_detail("Failed to verify payment", e)
        )


@router.post("/webhook")
async def paystack_webhook(
    request: Request,
    x_paystack_signature: Optional[str] = Header(None)
):
    """
    Webhook endpoint for Paystack payment notifications.
    Automatically updates payment status when transaction completes.
    """
    try:
        # Get raw body for signature verification
        body = await request.body()
        
        # Verify signature
        if not x_paystack_signature or not verify_paystack_signature(body, x_paystack_signature):
            raise HTTPException(status_code=401, detail="Invalid signature")
        
        # Parse event data
        import json
        event_data = json.loads(body)
        event = event_data.get("event")
        data = event_data.get("data", {})
        
        # Handle charge.success event
        if event == "charge.success":
            reference = data.get("reference")
            
            if not reference:
                return {"status": "ignored", "reason": "No reference found"}
            
            # Update transaction in database
            from app.db import get_database
            db = get_database()
            transaction = await db.paystackTransactions.find_one({"reference": reference})
            
            if not transaction:
                return {"status": "ignored", "reason": "Transaction not found"}
            
            if transaction["status"] == "success":
                return {"status": "ignored", "reason": "Already processed"}
            
            # Update transaction record
            paid_at_str = data.get("paid_at", "")
            paid_at = None
            if paid_at_str:
                paid_at = datetime.fromisoformat(paid_at_str.replace("Z", "+00:00"))
            
            update_data = {
                "status": "success",
                "paidAt": paid_at,
                "channel": data.get("channel"),
                "amountPaid": data["amount"] / 100,
                "paystackResponse": data,
                "updatedAt": datetime.now(timezone.utc)
            }
            
            # SECURITY: Verify paid amount matches expected amount
            expected_amount = transaction.get("amount", 0)
            actual_amount = data["amount"] / 100
            if expected_amount > 0 and actual_amount < expected_amount:
                update_data["status"] = "amount_mismatch"
                update_data["amountMismatch"] = {
                    "expected": expected_amount,
                    "actual": actual_amount
                }
                await db.paystackTransactions.update_one(
                    {"reference": reference},
                    {"$set": update_data}
                )
                return {"status": "error", "reason": "Amount mismatch"}
            
            await db.paystackTransactions.update_one(
                {"reference": reference},
                {"$set": update_data}
            )
            
            # Update payment's paidBy array (only for regular payments, not event-only payments)
            payment_id = transaction.get("paymentId")
            student_id = transaction["studentId"]
            
            if payment_id:
                await db.payments.update_one(
                    {"_id": ObjectId(payment_id)},
                    {
                        "$addToSet": {"paidBy": student_id},
                        "$set": {"updatedAt": datetime.now(timezone.utc)}
                    }
                )
                
                # Idempotent upsert — prevents duplicate if verify already ran
                await db.transactions.update_one(
                    {"reference": reference},
                    {
                        "$setOnInsert": {
                            "paymentId": payment_id,
                            "studentId": student_id,
                            "amount": transaction["amount"],
                            "method": "paystack",
                            "reference": reference,
                            "status": "verified",
                            "createdAt": datetime.now(timezone.utc),
                        }
                    },
                    upsert=True,
                )
            
            # Handle event payment: auto-register user for the event
            event_id = transaction.get("eventId")
            if event_id:
                await db.events.update_one(
                    {"_id": ObjectId(event_id)},
                    {
                        "$addToSet": {"registrations": student_id},
                        "$set": {"updatedAt": datetime.now(timezone.utc)}
                    }
                )
            
            # Send receipt email asynchronously with PDF attachment
            try:
                payment = None
                if payment_id and ObjectId.is_valid(payment_id):
                    payment = await db.payments.find_one({"_id": ObjectId(payment_id)})
                await send_payment_receipt(
                    to=transaction.get("studentEmail", "student@example.com"),
                    student_name=transaction.get("studentName", "Student"),
                    payment_title=payment.get("title", "IESA Payment") if payment else "IESA Payment",
                    amount=transaction["amount"],
                    reference=reference,
                    date=datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S"),
                    student_email=transaction.get("studentEmail", "student@example.com"),
                    student_level=transaction.get("studentLevel", "N/A"),
                    transaction_id=str(transaction.get("_id", reference))
                )
            except Exception:
                # Log error but don't fail the payment
                pass
            
            return {"status": "success", "message": "Payment verified"}
        
        return {"status": "ignored", "event": event}
        
    except HTTPException:
        # Re-raise auth errors (401 for invalid signature)
        raise
    except Exception as e:
        # IMPORTANT: Webhooks must always return 200 to prevent Paystack from retrying
        return {"status": "error"}


@router.get("/transactions")
async def get_transactions(
    current_user: dict = Depends(get_current_user),
    limit: int = 50
):
    """
    Get Paystack transactions.
    - Admin/Super Admin: Returns all transactions
    - Students: Returns only their transactions
    """
    try:
        from app.db import get_database
        from app.core.permissions import get_user_permissions
        db = get_database()
        
        # Get active session for permission check
        sessions = db["sessions"]
        active_session = await sessions.find_one({"isActive": True})
        if not active_session:
            raise HTTPException(status_code=404, detail="No active session found")
        
        # Check if user has admin permissions
        user_id = current_user.get("_id") or current_user.get("id")
        user_permissions = await get_user_permissions(user_id, str(active_session["_id"]))
        is_admin = "payment:create" in user_permissions
        
        # Fetch transactions based on role
        raw_transactions = []
        if is_admin:
            cursor = db.paystackTransactions.find({}).sort("createdAt", -1).limit(limit)
        else:
            cursor = db.paystackTransactions.find({"studentId": user_id}).sort("createdAt", -1).limit(limit)
        
        async for txn in cursor:
            txn["_id"] = str(txn["_id"])
            raw_transactions.append(txn)
        
        if not is_admin:
            return raw_transactions
        
        # ── Admin enrichment: add user object + paymentCategory ──
        # Batch-fetch linked payment docs for category info
        payment_ids = list({
            txn["paymentId"] for txn in raw_transactions
            if txn.get("paymentId") and ObjectId.is_valid(txn["paymentId"])
        })
        payment_map: dict = {}
        if payment_ids:
            pay_cursor = db.payments.find(
                {"_id": {"$in": [ObjectId(pid) for pid in payment_ids]}},
                {"title": 1, "category": 1},
            )
            async for pay in pay_cursor:
                payment_map[str(pay["_id"])] = pay
        
        # Batch-fetch event docs for event payment titles
        event_ids = list({
            txn["eventId"] for txn in raw_transactions
            if txn.get("eventId") and ObjectId.is_valid(txn["eventId"])
        })
        event_map: dict = {}
        if event_ids:
            ev_cursor = db.events.find(
                {"_id": {"$in": [ObjectId(eid) for eid in event_ids]}},
                {"title": 1, "category": 1},
            )
            async for ev in ev_cursor:
                event_map[str(ev["_id"])] = ev
        
        # Enrich each transaction
        for txn in raw_transactions:
            # Structured user object for the frontend
            first = txn.get("studentName", "").split(" ")[0] if txn.get("studentName") else ""
            last = " ".join(txn.get("studentName", "").split(" ")[1:]) if txn.get("studentName") else ""
            txn["user"] = {
                "firstName": first or "Unknown",
                "lastName": last or "",
                "email": txn.get("studentEmail", ""),
            }
            # Payment category / title
            pid = txn.get("paymentId")
            eid = txn.get("eventId")
            if pid and pid in payment_map:
                txn["paymentCategory"] = payment_map[pid].get("category", "General")
                txn["paymentTitle"] = payment_map[pid].get("title", "Payment")
            elif eid and eid in event_map:
                txn["paymentCategory"] = "Event"
                txn["paymentTitle"] = event_map[eid].get("title", "Event")
            else:
                txn["paymentCategory"] = txn.get("paymentCategory") or "General"
                txn["paymentTitle"] = txn.get("paymentTitle") or "Payment"
        
        return raw_transactions
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=safe_detail("Failed to fetch transactions", e)
        )


@router.get("/receipt/data")
async def get_receipt_data(
    reference: str = Query(..., description="Transaction reference"),
    current_user: dict = Depends(get_current_user)
):
    """
    Get receipt data as JSON for web display.
    Supports Paystack, bank transfer, and event payment receipts.
    """
    try:
        from app.db import get_database
        db = get_database()
        
        # Try Paystack transaction first
        transaction = await db.paystackTransactions.find_one({"reference": reference})
        receipt_type = "paystack"
        
        # If not found, try bank transfers
        if not transaction:
            transaction = await db.bankTransfers.find_one({"transactionReference": reference})
            receipt_type = "bank_transfer"
            
            if not transaction:
                raise HTTPException(status_code=404, detail="Transaction not found")
            
            # Check if approved
            if transaction.get("status") != "approved":
                raise HTTPException(
                    status_code=400,
                    detail=f"Receipt not available. Transfer status: {transaction.get('status', 'pending')}"
                )
        
        # Verify ownership
        student_id = transaction.get("studentId")
        if student_id != current_user["_id"]:
            raise HTTPException(status_code=403, detail="Not authorized to access this receipt")
        
        # For Paystack, check status
        if receipt_type == "paystack" and transaction.get("status") != "success":
            raise HTTPException(
                status_code=400,
                detail=f"Receipt not available. Payment status: {transaction.get('status', 'pending')}"
            )
        
        # Check if this is an event payment
        is_event_payment = False
        event_data = None
        metadata = transaction.get("metadata", {})
        event_id = metadata.get("eventId") or transaction.get("eventId")
        if event_id:
            is_event_payment = True
            event = await db.events.find_one({"_id": ObjectId(event_id)})
            if event:
                event_data = {
                    "id": str(event["_id"]),
                    "title": event.get("title", "Event"),
                    "date": str(event.get("date", "")) if event.get("date") else None,
                    "location": event.get("location", ""),
                    "category": event.get("category", "General"),
                }
        
        # Get payment details
        payment_id = transaction.get("paymentId")
        payment = None
        if payment_id:
            try:
                payment = await db.payments.find_one({"_id": ObjectId(payment_id)})
            except Exception:
                pass
        
        # Get student details
        student = await db.users.find_one({"uid": student_id})
        if not student:
            raise HTTPException(status_code=404, detail="Student not found")
        
        # Safely serialize date fields — convert datetime to ISO string
        def safe_date(val):
            if val is None:
                return None
            if hasattr(val, 'isoformat'):
                return val.isoformat()
            return str(val)
        
        tx_date = (
            transaction.get("paidAt")
            or transaction.get("reviewedAt")
            or transaction.get("createdAt")
        )
        
        # Determine title/category based on payment type
        if is_event_payment and event_data:
            payment_title = f"Event: {event_data['title']}"
            payment_category = "Event Payment"
        elif payment:
            payment_title = payment.get("title", "Payment")
            payment_category = payment.get("category", "General")
        else:
            payment_title = transaction.get("paymentTitle", "Payment")
            payment_category = "General"
        
        receipt_data = {
            "transactionId": str(transaction["_id"]),
            "reference": reference,
            "receiptType": receipt_type,
            "isEventPayment": is_event_payment,
            "event": event_data,
            "student": {
                "name": f"{student.get('firstName', '')} {student.get('lastName', '')}".strip() or transaction.get("studentName", "Unknown"),
                "email": student.get("email", transaction.get("studentEmail", "")),
                "matricNumber": student.get("matricNumber"),
                "level": str(student.get("currentLevel") or student.get("level") or "N/A"),
                "department": student.get("department", "Industrial Engineering"),
            },
            "payment": {
                "title": payment_title,
                "category": payment_category,
                "amount": float(transaction.get("amount", 0)),
                "description": payment.get("description") if payment else None,
            },
            "transaction": {
                "method": "Online (Paystack)" if receipt_type == "paystack" else f"Bank Transfer ({transaction.get('senderBank', '')})",
                "reference": reference,
                "date": safe_date(tx_date),
                "status": "Successful" if receipt_type == "paystack" or transaction.get("status") == "approved" else transaction.get("status", "Pending"),
                "channel": transaction.get("channel", "Paystack") if receipt_type == "paystack" else "Bank Transfer",
                "verifiedBy": transaction.get("verifiedBy") or transaction.get("reviewedBy"),
                "bankAccount": {
                    "bank": transaction.get("bankAccountBank"),
                    "accountNumber": transaction.get("bankAccountNumber"),
                    "accountName": transaction.get("bankAccountName"),
                } if receipt_type == "bank_transfer" else None,
            },
        }
        
        return receipt_data
        
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail=safe_detail("Failed to fetch receipt data", e)
        )


@router.get("/receipt/pdf")
async def download_receipt_by_query(
    reference: str = Query(..., description="Transaction reference"),
    current_user: dict = Depends(get_current_user)
):
    """Download PDF receipt using query parameter (supports slashes in reference)."""
    return await download_receipt(reference, current_user)


@router.post("/receipt/resend")
async def resend_receipt_email(
    reference: str = Query(..., description="Transaction reference"),
    current_user: dict = Depends(get_current_user)
):
    """
    Resend receipt email for a successful payment.
    """
    from app.db import get_database
    from app.core.email import send_payment_receipt
    
    db = get_database()
    
    # Look up transaction
    transaction = await db.paystackTransactions.find_one({"reference": reference})
    if not transaction:
        transaction = await db.transactions.find_one({"reference": reference})
    
    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")
    
    # Verify ownership
    if transaction["studentId"] != current_user["_id"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Check status
    if transaction.get("status") not in ["success", "verified"]:
        raise HTTPException(status_code=400, detail="Receipt only available for successful payments")
    
    # Get payment title
    payment_title = "IESA Payment"
    payment_id = transaction.get("paymentId")
    if payment_id and ObjectId.is_valid(str(payment_id)):
        payment = await db.payments.find_one({"_id": ObjectId(payment_id)})
        if payment:
            payment_title = payment.get("title", "IESA Payment")
    else:
        event_id = transaction.get("eventId")
        if event_id:
            event = await db.events.find_one({"_id": ObjectId(event_id)})
            if event:
                payment_title = f"Event: {event.get('title', 'IESA Event')}"
    
    # Build student info
    first = current_user.get("firstName", "")
    last = current_user.get("lastName", "")
    student_name = f"{first} {last}".strip() or "Student"
    student_email = current_user.get("email", transaction.get("studentEmail", ""))
    student_level = current_user.get("currentLevel") or transaction.get("studentLevel", "N/A")
    if isinstance(student_level, int):
        student_level = str(student_level)
    
    paid_at = transaction.get("paidAt") or transaction.get("createdAt") or datetime.now(timezone.utc)
    
    try:
        await send_payment_receipt(
            to=student_email,
            student_name=student_name,
            payment_title=payment_title,
            amount=transaction["amount"],
            reference=reference,
            date=paid_at.strftime("%Y-%m-%d %H:%M:%S") if hasattr(paid_at, 'strftime') else str(paid_at),
            student_email=student_email,
            student_level=student_level,
            transaction_id=str(transaction.get("_id", reference))
        )
        return {"message": "Receipt email sent successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=safe_detail("Failed to send receipt email", e))


@router.get("/receipt/{reference}")
async def download_receipt(
    reference: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Download PDF receipt for a successful payment.
    Supports both online payments (Paystack) and bank transfers.
    """
    try:
        from app.db import get_database
        db = get_database()
        
        # Try paystackTransactions first (online payments)
        transaction = await db.paystackTransactions.find_one({"reference": reference})
        payment_method = "Paystack"
        
        # If not found, check transactions collection (bank transfers)
        if not transaction:
            transaction = await db.transactions.find_one({"reference": reference})
            payment_method = "Bank Transfer"
        
        if not transaction:
            raise HTTPException(status_code=404, detail=f"Transaction not found with reference: {reference}")
        
        # Verify ownership
        if transaction["studentId"] != current_user["_id"]:
            raise HTTPException(status_code=403, detail="Not authorized to access this receipt")
        
        # Check if payment was successful/verified
        status = transaction.get("status")
        if status not in ["success", "verified"]:
            raise HTTPException(
                status_code=400,
                detail=f"Receipt not available. Payment status: {status}"
            )
        
        # Get payment details
        payment_id = transaction.get("paymentId")
        if payment_id:
            payment = await db.payments.find_one({"_id": ObjectId(payment_id)})
            if not payment:
                raise HTTPException(status_code=404, detail="Payment record not found")
            payment_title = payment.get("title", "IESA Payment")
            payment_category = payment.get("category", "Departmental Dues")
        else:
            # Event payment - get event details
            event_id = transaction.get("eventId")
            if event_id:
                event = await db.events.find_one({"_id": ObjectId(event_id)})
                payment_title = f"Event: {event.get('title', 'IESA Event')}" if event else "IESA Event"
                payment_category = "Event Registration"
            else:
                payment_title = "IESA Payment"
                payment_category = "Payment"
        
        # Get student level — prefer currentLevel from user profile, fall back to transaction data
        student_level = (
            current_user.get("currentLevel")
            or current_user.get("level")
            or transaction.get("studentLevel")
            or "N/A"
        )
        if isinstance(student_level, int):
            student_level = str(student_level)
        
        # Build student name from profile (firstName + lastName) with fallback
        first = current_user.get("firstName", "")
        last = current_user.get("lastName", "")
        student_name = f"{first} {last}".strip()
        if not student_name:
            student_name = current_user.get("displayName", transaction.get("studentName", "Unknown Student"))
        
        # Get payment date
        paid_at = transaction.get("paidAt") or transaction.get("createdAt") or datetime.now(timezone.utc)
        
        # Generate PDF receipt
        from ..utils.receipt_generator import generate_payment_receipt
        pdf_buffer = generate_payment_receipt(
            transaction_id=str(transaction["_id"]),
            reference=reference,
            student_name=student_name,
            student_email=current_user.get("email", transaction.get("studentEmail", "student@example.com")),
            student_level=student_level,
            payment_title=payment_title,
            amount=transaction["amount"],
            paid_at=paid_at,
            channel=transaction.get("channel", payment_method),
            payment_type=payment_category
        )
        
        # Return PDF as downloadable file
        return StreamingResponse(
            pdf_buffer,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f"attachment; filename=IESA_Receipt_{reference}.pdf"
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=safe_detail("Failed to generate receipt", e)
        )
