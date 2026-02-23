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
from datetime import datetime
import os
import hmac
import hashlib
import requests
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
    timestamp = datetime.utcnow().strftime("%Y%m%d%H%M%S")
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
        
        # Verify payment exists
        payment = await db.payments.find_one({"_id": ObjectId(payment_request.paymentId)})
        if not payment:
            raise HTTPException(status_code=404, detail="Payment not found")
        
        # Check if already paid
        if current_user["_id"] in payment.get("paidBy", []):
            raise HTTPException(status_code=400, detail="You have already paid this due")
        
        # Generate unique reference
        reference = generate_payment_reference(current_user["_id"])
        
        # Convert to kobo (Paystack uses kobo)
        amount_kobo = int(payment_request.amount * 100)
        
        # Prepare Paystack request
        paystack_data = {
            "email": current_user.get("email", "student@example.com"),
            "amount": amount_kobo,
            "reference": reference,
            "callback_url": f"{os.getenv('FRONTEND_URL', 'http://localhost:3000')}/dashboard/payments/verify?reference={reference}",
            "metadata": {
                "studentId": current_user["_id"],
                "studentName": current_user.get("displayName", current_user.get("email", "Unknown")),
                "studentEmail": current_user.get("email", "student@example.com"),
                "paymentId": payment_request.paymentId,
                "paymentTitle": payment.get("title", "IESA Payment"),
                "custom_fields": [
                    {
                        "display_name": "Student Name",
                        "variable_name": "student_name",
                        "value": current_user.get("displayName", "Unknown")
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
        
        response = requests.post(
            f"{PAYSTACK_BASE_URL}/transaction/initialize",
            json=paystack_data,
            headers=headers,
            timeout=10
        )
        
        if not response.ok:
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
            "studentName": current_user.get("displayName", current_user.get("email", "Unknown")),
            "studentEmail": current_user.get("email", "student@example.com"),
            "amount": payment_request.amount,
            "amountKobo": amount_kobo,
            "status": "pending",
            "paystackData": {
                "accessCode": data["access_code"],
                "authorizationUrl": data["authorization_url"]
            },
            "createdAt": datetime.utcnow(),
            "updatedAt": datetime.utcnow()
        }
        
        result = await db.paystackTransactions.insert_one(transaction_record)
        
        return PaymentResponse(
            transactionId=str(result.inserted_id),
            reference=reference,
            authorizationUrl=data["authorization_url"],
            accessCode=data["access_code"],
            amount=payment_request.amount,
            status="pending"
        )
        
    except requests.RequestException as e:
        raise HTTPException(
            status_code=503,
            detail=f"Payment service unavailable: {str(e)}"
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to initialize payment: {str(e)}"
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
        
        response = requests.get(
            f"{PAYSTACK_BASE_URL}/transaction/verify/{reference}",
            headers=headers,
            timeout=10
        )
        
        if not response.ok:
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
            "updatedAt": datetime.utcnow()
        }
        
        if status == "success":
            paid_at_str = data.get("paid_at", "")
            if paid_at_str:
                # Parse ISO format datetime
                paid_at = datetime.fromisoformat(paid_at_str.replace("Z", "+00:00"))
                update_data["paidAt"] = paid_at
            
            update_data["channel"] = data.get("channel")
            update_data["amountPaid"] = data["amount"] / 100  # Convert from kobo
            
            # Update payment's paidBy array (if linked to a payment)
            payment_id = transaction.get("paymentId")
            if payment_id:
                await db.payments.update_one(
                    {"_id": ObjectId(payment_id)},
                    {
                        "$addToSet": {"paidBy": current_user["_id"]},
                        "$set": {"updatedAt": datetime.utcnow()}
                    }
                )
                
                # Also create a transaction record in the transactions collection
                await db.transactions.insert_one({
                    "paymentId": payment_id,
                    "studentId": current_user["_id"],
                    "amount": transaction["amount"],
                    "method": "paystack",
                    "reference": reference,
                    "status": "verified",
                    "createdAt": datetime.utcnow()
            })
            
            # Handle event payment: auto-register user for the event
            event_id = transaction.get("eventId")
            if event_id:
                await db.events.update_one(
                    {"_id": ObjectId(event_id)},
                    {
                        "$addToSet": {"registrations": current_user["_id"]},
                        "$set": {"updatedAt": datetime.utcnow()}
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
        
    except requests.RequestException as e:
        raise HTTPException(
            status_code=503,
            detail=f"Payment verification service unavailable: {str(e)}"
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to verify payment: {str(e)}"
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
                "updatedAt": datetime.utcnow()
            }
            
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
                        "$set": {"updatedAt": datetime.utcnow()}
                    }
                )
                
                # Create transaction record
                await db.transactions.insert_one({
                    "paymentId": payment_id,
                    "studentId": student_id,
                    "amount": transaction["amount"],
                    "method": "paystack",
                    "reference": reference,
                    "status": "verified",
                    "createdAt": datetime.utcnow()
                })
            
            # Handle event payment: auto-register user for the event
            event_id = transaction.get("eventId")
            if event_id:
                await db.events.update_one(
                    {"_id": ObjectId(event_id)},
                    {
                        "$addToSet": {"registrations": student_id},
                        "$set": {"updatedAt": datetime.utcnow()}
                    }
                )
            
            # Send receipt email asynchronously with PDF attachment
            try:
                payment = await db.payments.find_one({"_id": ObjectId(payment_id)})
                await send_payment_receipt(
                    to=transaction.get("studentEmail", "student@example.com"),
                    student_name=transaction.get("studentName", "Student"),
                    payment_title=payment.get("title", "IESA Payment") if payment else "IESA Payment",
                    amount=transaction["amount"],
                    reference=reference,
                    date=datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S"),
                    student_email=transaction.get("studentEmail", "student@example.com"),
                    student_level=transaction.get("studentLevel", "N/A"),
                    transaction_id=str(transaction.get("_id", reference))
                )
            except Exception as email_error:
                # Log error but don't fail the payment
                print(f"Failed to send receipt email: {str(email_error)}")
            
            return {"status": "success", "message": "Payment verified"}
        
        return {"status": "ignored", "event": event}
        
    except Exception as e:
        print(f"Webhook error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


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
        transactions = []
        if is_admin:
            # Admin sees all transactions
            cursor = db.paystackTransactions.find({}).sort("createdAt", -1).limit(limit)
        else:
            # Students see only their transactions
            cursor = db.paystackTransactions.find({"studentId": user_id}).sort("createdAt", -1).limit(limit)
        
        async for txn in cursor:
            txn["_id"] = str(txn["_id"])
            transactions.append(txn)
        
        return transactions
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch transactions: {str(e)}"
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
            detail=f"Failed to fetch receipt data: {str(e)}"
        )


@router.get("/receipt/pdf")
async def download_receipt_by_query(
    reference: str = Query(..., description="Transaction reference"),
    current_user: dict = Depends(get_current_user)
):
    """Download PDF receipt using query parameter (supports slashes in reference)."""
    return await download_receipt(reference, current_user)


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
        
        print(f"[RECEIPT] Looking for transaction with reference: {reference}")
        print(f"[RECEIPT] User ID: {current_user.get('_id')}")
        
        # Try paystackTransactions first (online payments)
        transaction = await db.paystackTransactions.find_one({"reference": reference})
        payment_method = "Paystack"
        
        # If not found, check transactions collection (bank transfers)
        if not transaction:
            print(f"[RECEIPT] Not found in paystackTransactions, checking transactions...")
            transaction = await db.transactions.find_one({"reference": reference})
            payment_method = "Bank Transfer"
        
        if not transaction:
            print(f"[RECEIPT] Transaction not found in any collection for reference: {reference}")
            # Debug: Show user's recent transactions
            paystack_txns = await db.paystackTransactions.find(
                {"studentId": current_user["_id"]}
            ).limit(3).to_list(length=3)
            other_txns = await db.transactions.find(
                {"studentId": current_user["_id"]}
            ).limit(3).to_list(length=3)
            print(f"[RECEIPT] Paystack transactions: {len(paystack_txns)}")
            print(f"[RECEIPT] Other transactions: {len(other_txns)}")
            if paystack_txns:
                print(f"[RECEIPT] Sample Paystack refs: {[t.get('reference') for t in paystack_txns]}")
            if other_txns:
                print(f"[RECEIPT] Sample other refs: {[t.get('reference') for t in other_txns]}")
            raise HTTPException(status_code=404, detail=f"Transaction not found with reference: {reference}")
        
        print(f"[RECEIPT] Transaction found in {payment_method}: {transaction.get('_id')}, status: {transaction.get('status')}")
        
        # Verify ownership
        if transaction["studentId"] != current_user["_id"]:
            print(f"[RECEIPT] Ownership mismatch")
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
                print(f"[RECEIPT] Payment record not found: {payment_id}")
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
        
        print(f"[RECEIPT] Generating PDF for: {payment_title}")
        
        # Get student level
        student_level = current_user.get("level", "Unknown")
        if isinstance(student_level, int):
            student_level = str(student_level)
        
        # Get payment date
        paid_at = transaction.get("paidAt") or transaction.get("createdAt") or datetime.utcnow()
        
        # Generate PDF receipt
        from ..utils.receipt_generator import generate_payment_receipt
        pdf_buffer = generate_payment_receipt(
            transaction_id=str(transaction["_id"]),
            reference=reference,
            student_name=transaction.get("studentName", current_user.get("displayName", "Unknown Student")),
            student_email=transaction.get("studentEmail", current_user.get("email", "student@example.com")),
            student_level=student_level,
            payment_title=payment_title,
            amount=transaction["amount"],
            paid_at=paid_at,
            channel=transaction.get("channel", payment_method),
            payment_type=payment_category
        )
        
        print(f"[RECEIPT] PDF generated successfully")
        
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
        print(f"[RECEIPT] Error generating receipt: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate receipt: {str(e)}"
        )
