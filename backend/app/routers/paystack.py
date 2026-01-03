"""
Paystack Integration Router - Online Payment Processing

This module handles online payment processing using Paystack gateway.
Features:
- Initialize Paystack transactions
- Verify payment status
- Webhook for automatic confirmation
- Payment receipt generation
"""

from fastapi import APIRouter, HTTPException, Depends, Header, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field, validator
from typing import Optional, List
from datetime import datetime
import os
import hmac
import hashlib
import requests
from bson import ObjectId
from ..core.security import get_current_user
from ..utils.receipt_generator import generate_payment_receipt

router = APIRouter(prefix="/api/v1/paystack", tags=["Paystack"])

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
async def initialize_payment(
    request: PaymentInitializeRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Initialize a Paystack payment transaction.
    Returns authorization URL for payment.
    """
    try:
        from ..main import db
        
        # Verify payment exists
        payment = db.payments.find_one({"_id": ObjectId(request.paymentId)})
        if not payment:
            raise HTTPException(status_code=404, detail="Payment not found")
        
        # Check if already paid
        if current_user["uid"] in payment.get("paidBy", []):
            raise HTTPException(status_code=400, detail="You have already paid this due")
        
        # Generate unique reference
        reference = generate_payment_reference(current_user["uid"])
        
        # Convert to kobo (Paystack uses kobo)
        amount_kobo = int(request.amount * 100)
        
        # Prepare Paystack request
        paystack_data = {
            "email": current_user.get("email", "student@example.com"),
            "amount": amount_kobo,
            "reference": reference,
            "callback_url": f"{os.getenv('FRONTEND_URL', 'http://localhost:3000')}/dashboard/payments/verify?reference={reference}",
            "metadata": {
                "studentId": current_user["uid"],
                "studentName": current_user.get("displayName", current_user.get("email", "Unknown")),
                "studentEmail": current_user.get("email", "student@example.com"),
                "paymentId": request.paymentId,
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
            "paymentId": request.paymentId,
            "studentId": current_user["uid"],
            "studentName": current_user.get("displayName", current_user.get("email", "Unknown")),
            "studentEmail": current_user.get("email", "student@example.com"),
            "amount": request.amount,
            "amountKobo": amount_kobo,
            "status": "pending",
            "paystackData": {
                "accessCode": data["access_code"],
                "authorizationUrl": data["authorization_url"]
            },
            "createdAt": datetime.utcnow(),
            "updatedAt": datetime.utcnow()
        }
        
        result = db.paystackTransactions.insert_one(transaction_record)
        
        return PaymentResponse(
            transactionId=str(result.inserted_id),
            reference=reference,
            authorizationUrl=data["authorization_url"],
            accessCode=data["access_code"],
            amount=request.amount,
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
        from ..main import db
        
        # Check local database first
        transaction = db.paystackTransactions.find_one({"reference": reference})
        
        if not transaction:
            raise HTTPException(status_code=404, detail="Transaction not found")
        
        # Verify ownership
        if transaction["studentId"] != current_user["uid"]:
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
            
            # Update payment's paidBy array
            payment_id = transaction["paymentId"]
            db.payments.update_one(
                {"_id": ObjectId(payment_id)},
                {
                    "$addToSet": {"paidBy": current_user["uid"]},
                    "$set": {"updatedAt": datetime.utcnow()}
                }
            )
            
            # Also create a transaction record in the transactions collection
            db.transactions.insert_one({
                "paymentId": payment_id,
                "studentId": current_user["uid"],
                "amount": transaction["amount"],
                "method": "paystack",
                "reference": reference,
                "status": "verified",
                "createdAt": datetime.utcnow()
            })
        
        db.paystackTransactions.update_one(
            {"reference": reference},
            {"$set": update_data}
        )
        
        # Fetch updated record
        transaction = db.paystackTransactions.find_one({"reference": reference})
        
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
            from ..main import db
            transaction = db.paystackTransactions.find_one({"reference": reference})
            
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
            
            db.paystackTransactions.update_one(
                {"reference": reference},
                {"$set": update_data}
            )
            
            # Update payment's paidBy array
            payment_id = transaction["paymentId"]
            student_id = transaction["studentId"]
            
            db.payments.update_one(
                {"_id": ObjectId(payment_id)},
                {
                    "$addToSet": {"paidBy": student_id},
                    "$set": {"updatedAt": datetime.utcnow()}
                }
            )
            
            # Create transaction record
            db.transactions.insert_one({
                "paymentId": payment_id,
                "studentId": student_id,
                "amount": transaction["amount"],
                "method": "paystack",
                "reference": reference,
                "status": "verified",
                "createdAt": datetime.utcnow()
            })
            
            # TODO: Send receipt email
            
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
    Get Paystack transactions for current user.
    Returns list of all Paystack transactions.
    """
    try:
        from ..main import db
        
        # Fetch transactions
        transactions = list(
            db.paystackTransactions.find({"studentId": current_user["uid"]})
            .sort("createdAt", -1)
            .limit(limit)
        )
        
        # Convert ObjectId to string
        for txn in transactions:
            txn["_id"] = str(txn["_id"])
        
        return transactions
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch transactions: {str(e)}"
        )


@router.get("/receipt/{reference}")
async def download_receipt(
    reference: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Download PDF receipt for a successful payment.
    Only available for verified transactions.
    """
    try:
        from ..main import db
        
        # Fetch transaction
        transaction = db.paystackTransactions.find_one({"reference": reference})
        
        if not transaction:
            raise HTTPException(status_code=404, detail="Transaction not found")
        
        # Verify ownership
        if transaction["studentId"] != current_user["uid"]:
            raise HTTPException(status_code=403, detail="Not authorized to access this receipt")
        
        # Check if payment was successful
        if transaction["status"] != "success":
            raise HTTPException(
                status_code=400,
                detail=f"Receipt not available. Payment status: {transaction['status']}"
            )
        
        # Get payment details
        payment = db.payments.find_one({"_id": ObjectId(transaction["paymentId"])})
        if not payment:
            raise HTTPException(status_code=404, detail="Payment record not found")
        
        # Get student level (try to get from user profile or default)
        student_level = current_user.get("level", "Unknown")
        if isinstance(student_level, int):
            student_level = str(student_level)
        
        # Generate PDF receipt
        pdf_buffer = generate_payment_receipt(
            transaction_id=str(transaction["_id"]),
            reference=reference,
            student_name=transaction.get("studentName", current_user.get("displayName", "Unknown Student")),
            student_email=transaction.get("studentEmail", current_user.get("email", "student@example.com")),
            student_level=student_level,
            payment_title=payment.get("title", "IESA Payment"),
            amount=transaction["amount"],
            paid_at=transaction.get("paidAt", datetime.utcnow()),
            channel=transaction.get("channel", "Paystack"),
            payment_type=payment.get("category", "Departmental Dues")
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
            detail=f"Failed to generate receipt: {str(e)}"
        )
