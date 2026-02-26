"""
Events Router - Session-Aware Event Management

CRITICAL: All events are session-scoped.
Events from different academic sessions are completely separate.
"""

from fastapi import APIRouter, HTTPException, Depends, status, Query, UploadFile, File
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
import re
from typing import List, Optional
from datetime import datetime, timezone
from bson import ObjectId
import cloudinary
import cloudinary.uploader
import app.utils.cloudinary_config  # noqa: F401 — side-effect: configures Cloudinary credentials

from app.models.event import (
    Event, EventCreate, EventUpdate, EventWithStatus, EventRegistration
)
from app.db import get_database
from app.core.security import get_current_user
from app.core.permissions import require_permission
from app.core.sanitization import sanitize_html, validate_no_scripts
from app.core.audit import AuditLogger

router = APIRouter(prefix="/api/v1/events", tags=["Events"])


@router.post("/", response_model=Event, status_code=status.HTTP_201_CREATED)
async def create_event(
    event_data: EventCreate,
    user: dict = Depends(require_permission("event:create"))
):
    """
    Create a new event.
    Requires event:create permission.
    
    The event MUST include a session_id.
    """
    db = get_database()
    events = db["events"]
    
    # Sanitize input to prevent XSS
    if not validate_no_scripts(event_data.title):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid characters detected in title"
        )
    if not validate_no_scripts(event_data.description):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid characters detected in description"
        )
    
    # Verify session exists
    sessions = db["sessions"]
    session = await sessions.find_one({"_id": ObjectId(event_data.sessionId)})
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Session {event_data.sessionId} not found"
        )
    
    # Create event document
    event_dict = event_data.model_dump()
    event_dict["registrations"] = []
    event_dict["attendees"] = []
    event_dict["createdAt"] = datetime.now(timezone.utc)
    event_dict["updatedAt"] = datetime.now(timezone.utc)
    
    result = await events.insert_one(event_dict)
    created_event = await events.find_one({"_id": result.inserted_id})
    created_event["_id"] = str(created_event["_id"])
    
    await AuditLogger.log(
        action=AuditLogger.EVENT_CREATED,
        actor_id=user["_id"],
        actor_email=user.get("email", ""),
        resource_type="event",
        resource_id=str(result.inserted_id),
        session_id=event_data.sessionId,
        details={"title": event_data.title, "date": str(event_data.date)}
    )
    from app.routers.sse import publish
    from app.core.cache import cache_delete, cache_delete_pattern
    publish("event_created", {"id": str(result.inserted_id), "title": event_data.title})
    await cache_delete("admin_stats")
    await cache_delete_pattern("student_dashboard:*")
    return Event(**created_event)


@router.get("/")
async def list_events(
    session_id: Optional[str] = Query(None, description="Filter by session ID. Defaults to active session."),
    category: Optional[str] = None,
    search: Optional[str] = Query(None, description="Search in event title or description"),
    upcoming_only: Optional[bool] = Query(None, description="If true, only return events with date >= now"),
    limit: int = Query(100, ge=1, le=500, description="Maximum number of events to return"),
    skip: int = Query(0, ge=0, description="Number of events to skip (for pagination)"),
    user: dict = Depends(get_current_user)
):
    """
    List all events for a specific session with pagination.
    
    The session_id parameter enables "time travel".
    Returns events with user's registration status.
    Pagination: Use limit and skip parameters for large datasets.
    """
    db = get_database()
    events = db["events"]
    sessions = db["sessions"]
    
    # Resolve session_id
    if not session_id:
        active_session = await sessions.find_one({"isActive": True})
        if not active_session:
            # No active session — return empty result instead of 404
            return {"items": [], "total": 0}
        session_id = str(active_session["_id"])
    
    # Verify session exists
    session = await sessions.find_one({"_id": ObjectId(session_id)})
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Session {session_id} not found"
        )
    
    # Build query
    query = {"sessionId": session_id}
    if category:
        query["category"] = category
    if search:
        escaped = re.escape(search)
        query["$or"] = [
            {"title": {"$regex": escaped, "$options": "i"}},
            {"description": {"$regex": escaped, "$options": "i"}},
        ]
    if upcoming_only:
        query["date"] = {"$gte": datetime.now(timezone.utc)}
    
    # Get total count for pagination
    total = await events.count_documents(query)
    
    # Get events for this session with pagination
    cursor = events.find(query).sort("date", 1).skip(skip).limit(limit)
    event_list = await cursor.to_list(length=limit)
    
    # Enrich with user's status
    result = []
    for event in event_list:
        event["_id"] = str(event["_id"])
        
        is_registered = user["_id"] in event.get("registrations", [])
        has_attended = user["_id"] in event.get("attendees", [])
        is_full = False
        
        if event.get("maxAttendees"):
            is_full = len(event.get("registrations", [])) >= event["maxAttendees"]
        
        # Check payment status for paid events
        has_paid = False
        if event.get("requiresPayment"):
            payment_id = event.get("paymentId")
            if payment_id:
                payment = await db.payments.find_one({"_id": ObjectId(payment_id)})
                if payment and user["_id"] in payment.get("paidBy", []):
                    has_paid = True
            else:
                # Check if there's a direct event payment transaction
                txn = await db.paystackTransactions.find_one({
                    "eventId": event["_id"],
                    "studentId": user["_id"],
                    "status": "success"
                })
                if txn:
                    has_paid = True
        
        event_with_status = EventWithStatus(
            **event,
            isRegistered=is_registered,
            hasAttended=has_attended,
            isFull=is_full,
            hasPaid=has_paid
        )
        result.append(event_with_status)
    
    return {"items": result, "total": total}


@router.post("/upload-image")
async def upload_event_image(
    file: UploadFile = File(...),
    user: dict = Depends(require_permission("event:create"))
):
    """
    Upload an event image to Cloudinary.
    Requires event:create permission.
    Returns the secure URL of the uploaded image.
    """
    # Validate content type
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File must be an image (PNG, JPG, WebP, etc.)"
        )

    # Read file bytes
    file_bytes = await file.read()
    if len(file_bytes) > 10 * 1024 * 1024:  # 10 MB limit
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="Image must be smaller than 10 MB"
        )

    try:
        result = cloudinary.uploader.upload(
            file_bytes,
            folder="iesa/events",
            resource_type="image",
            transformation=[
                {"width": 1200, "height": 630, "crop": "fill", "gravity": "center"},
                {"quality": "auto:good"},
                {"fetch_format": "auto"}
            ]
        )
        return {"url": result["secure_url"]}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Image upload failed: {str(e)}"
        )


@router.get("/batch-payment-status")
async def get_batch_payment_status(
    event_ids: str = Query(..., description="Comma-separated event IDs"),
    user: dict = Depends(get_current_user),
):
    """Return payment status for multiple events in a single call."""
    db = get_database()
    raw_ids = [eid.strip() for eid in event_ids.split(",") if eid.strip()]
    if not raw_ids or len(raw_ids) > 50:
        raise HTTPException(status_code=400, detail="Provide 1-50 event IDs")

    valid_ids = [eid for eid in raw_ids if ObjectId.is_valid(eid)]
    if not valid_ids:
        return {}

    user_id = user["_id"]

    # Batch-fetch successful Paystack transactions for this user
    txn_cursor = db.paystackTransactions.find(
        {"eventId": {"$in": valid_ids}, "studentId": user_id, "status": "success"},
        {"eventId": 1, "reference": 1},
    )
    txn_map: dict[str, str] = {}
    async for txn in txn_cursor:
        txn_map[txn["eventId"]] = txn.get("reference", "")

    # Batch-fetch approved bank transfers
    approved_cursor = db.bankTransfers.find(
        {"eventId": {"$in": valid_ids}, "studentId": user_id, "status": "approved"},
        {"eventId": 1, "transactionReference": 1},
    )
    approved_map: dict[str, str] = {}
    async for t in approved_cursor:
        approved_map[t["eventId"]] = t.get("transactionReference", "")

    # Batch-fetch pending bank transfers
    pending_cursor = db.bankTransfers.find(
        {"eventId": {"$in": valid_ids}, "studentId": user_id, "status": "pending"},
        {"eventId": 1},
    )
    pending_set: set[str] = set()
    async for t in pending_cursor:
        pending_set.add(t["eventId"])

    # Batch-fetch events to check legacy paymentId → paidBy
    events_cursor = db.events.find(
        {"_id": {"$in": [ObjectId(eid) for eid in valid_ids]}, "paymentId": {"$exists": True}},
        {"paymentId": 1},
    )
    payment_doc_ids = []
    event_payment_map: dict[str, str] = {}
    async for ev in events_cursor:
        pid = ev.get("paymentId")
        if pid:
            payment_doc_ids.append(ObjectId(pid))
            event_payment_map[str(ev["_id"])] = str(pid)

    legacy_paid: set[str] = set()
    if payment_doc_ids:
        pay_cursor = db.payments.find(
            {"_id": {"$in": payment_doc_ids}, "paidBy": user_id},
            {"_id": 1},
        )
        paid_payment_ids: set[str] = set()
        async for p in pay_cursor:
            paid_payment_ids.add(str(p["_id"]))
        for eid, pid in event_payment_map.items():
            if pid in paid_payment_ids:
                legacy_paid.add(eid)

    # Build response
    result: dict[str, dict] = {}
    for eid in valid_ids:
        has_paid = eid in txn_map or eid in approved_map or eid in legacy_paid
        ref = txn_map.get(eid) or approved_map.get(eid)
        result[eid] = {
            "hasPaid": has_paid,
            "paymentReference": ref,
            "hasPendingTransfer": eid in pending_set,
        }
    return result


@router.get("/{event_id}", response_model=EventWithStatus)
async def get_event(
    event_id: str,
    user: dict = Depends(get_current_user)
):
    """Get a specific event by ID with user's registration status"""
    db = get_database()
    events = db["events"]
    
    if not ObjectId.is_valid(event_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid event ID format"
        )
    
    event = await events.find_one({"_id": ObjectId(event_id)})
    
    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Event {event_id} not found"
        )
    
    event["_id"] = str(event["_id"])
    
    # Check status
    is_registered = user["_id"] in event.get("registrations", [])
    has_attended = user["_id"] in event.get("attendees", [])
    is_full = False
    
    if event.get("maxAttendees"):
        is_full = len(event.get("registrations", [])) >= event["maxAttendees"]
    
    # Check payment status for paid events
    has_paid = False
    if event.get("requiresPayment"):
        payment_id = event.get("paymentId")
        if payment_id:
            payment = await db.payments.find_one({"_id": ObjectId(payment_id)})
            if payment and user["_id"] in payment.get("paidBy", []):
                has_paid = True
        else:
            txn = await db.paystackTransactions.find_one({
                "eventId": event["_id"],
                "studentId": user["_id"],
                "status": "success"
            })
            if txn:
                has_paid = True
    
    return EventWithStatus(
        **event,
        isRegistered=is_registered,
        hasAttended=has_attended,
        isFull=is_full,
        hasPaid=has_paid
    )


@router.post("/{event_id}/register", response_model=EventWithStatus)
async def register_for_event(
    event_id: str,
    user: dict = Depends(get_current_user)
):
    """
    Register current user for an event.
    """
    db = get_database()
    events = db["events"]
    
    if not ObjectId.is_valid(event_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid event ID format"
        )
    
    # Get event
    event = await events.find_one({"_id": ObjectId(event_id)})
    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Event {event_id} not found"
        )
    
    # Check if already registered
    if user["_id"] in event.get("registrations", []):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Already registered for this event"
        )
    
    # Check if full
    if event.get("maxAttendees"):
        if len(event.get("registrations", [])) >= event["maxAttendees"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Event is full"
            )
    
    # Check registration deadline
    if event.get("registrationDeadline"):
        if datetime.now(timezone.utc) > event["registrationDeadline"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Registration deadline has passed"
            )
    
    # Check payment for paid events
    if event.get("requiresPayment"):
        has_paid = False
        payment_id = event.get("paymentId")
        if payment_id:
            payment = await db.payments.find_one({"_id": ObjectId(payment_id)})
            if payment and user["_id"] in payment.get("paidBy", []):
                has_paid = True
        else:
            txn = await db.paystackTransactions.find_one({
                "eventId": str(event["_id"]),
                "studentId": user["_id"],
                "status": "success"
            })
            if txn:
                has_paid = True
        
        if not has_paid:
            raise HTTPException(
                status_code=status.HTTP_402_PAYMENT_REQUIRED,
                detail="Payment is required before registering for this event"
            )
    
    # Register user
    await events.update_one(
        {"_id": ObjectId(event_id)},
        {
            "$push": {"registrations": user["_id"]},
            "$set": {"updatedAt": datetime.now(timezone.utc)}
        }
    )
    
    # Return updated event
    updated_event = await events.find_one({"_id": ObjectId(event_id)})
    updated_event["_id"] = str(updated_event["_id"])
    
    is_full = False
    if updated_event.get("maxAttendees"):
        is_full = len(updated_event.get("registrations", [])) >= updated_event["maxAttendees"]
    
    return EventWithStatus(
        **updated_event,
        isRegistered=True,
        hasAttended=False,
        isFull=is_full
    )


@router.post("/{event_id}/pay")
async def pay_for_event(
    event_id: str,
    user: dict = Depends(get_current_user)
):
    """
    Initialize payment for a paid event via Paystack.
    Returns Paystack authorization URL and reference.
    """
    import httpx
    import os
    
    db = get_database()
    events_col = db["events"]
    
    if not ObjectId.is_valid(event_id):
        raise HTTPException(status_code=400, detail="Invalid event ID format")
    
    event = await events_col.find_one({"_id": ObjectId(event_id)})
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    
    if not event.get("requiresPayment"):
        raise HTTPException(status_code=400, detail="This event does not require payment")
    
    amount = event.get("paymentAmount", 0)
    if amount <= 0:
        raise HTTPException(status_code=400, detail="Event payment amount is not configured")
    
    # Check if user already paid
    # Option 1: Linked payment
    payment_id = event.get("paymentId")
    if payment_id:
        payment = await db.payments.find_one({"_id": ObjectId(payment_id)})
        if payment and user["_id"] in payment.get("paidBy", []):
            raise HTTPException(status_code=400, detail="You have already paid for this event")
    else:
        # Option 2: Direct event transaction
        existing_txn = await db.paystackTransactions.find_one({
            "eventId": event_id,
            "studentId": user["_id"],
            "status": "success"
        })
        if existing_txn:
            raise HTTPException(status_code=400, detail="You have already paid for this event")
    
    # Generate reference
    from app.routers.paystack import generate_payment_reference
    reference = generate_payment_reference(user["_id"])
    
    PAYSTACK_SECRET_KEY = os.getenv("PAYSTACK_SECRET_KEY", "")
    if not PAYSTACK_SECRET_KEY:
        raise HTTPException(status_code=503, detail="Payment service not configured")
    
    amount_kobo = int(amount * 100)
    
    _ev_first = user.get("firstName", "")
    _ev_last = user.get("lastName", "")
    _ev_student_name = f"{_ev_first} {_ev_last}".strip() or user.get("displayName", user.get("email", "Unknown"))
    
    paystack_data = {
        "email": user.get("email", "student@example.com"),
        "amount": amount_kobo,
        "reference": reference,
        "callback_url": f"{os.getenv('FRONTEND_URL', 'http://localhost:3000')}/dashboard/events?payment_ref={reference}",
        "metadata": {
            "studentId": user["_id"],
            "studentName": _ev_student_name,
            "eventId": event_id,
            "eventTitle": event.get("title", "Event Payment"),
            "type": "event_payment",
            "custom_fields": [
                {"display_name": "Student Name", "variable_name": "student_name", "value": f"{user.get('firstName', '')} {user.get('lastName', '')}".strip() or "Unknown"},
                {"display_name": "Event", "variable_name": "event_title", "value": event.get("title", "Event")}
            ]
        }
    }
    
    headers = {
        "Authorization": f"Bearer {PAYSTACK_SECRET_KEY}",
        "Content-Type": "application/json"
    }
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://api.paystack.co/transaction/initialize",
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
        
        # Store transaction record linked to event
        transaction_record = {
            "reference": reference,
            "eventId": event_id,
            "studentId": user["_id"],
            "studentName": _ev_student_name,
            "studentLevel": user.get("currentLevel") or user.get("level") or "N/A",
            "studentEmail": user.get("email", "student@example.com"),
            "amount": amount,
            "amountKobo": amount_kobo,
            "status": "pending",
            "type": "event_payment",
            "paystackData": {
                "accessCode": data["access_code"],
                "authorizationUrl": data["authorization_url"]
            },
            "createdAt": datetime.now(timezone.utc),
            "updatedAt": datetime.now(timezone.utc)
        }
        
        if payment_id:
            transaction_record["paymentId"] = payment_id
        
        result = await db.paystackTransactions.insert_one(transaction_record)
        
        return {
            "transactionId": str(result.inserted_id),
            "reference": reference,
            "authorizationUrl": data["authorization_url"],
            "accessCode": data["access_code"],
            "amount": amount,
            "status": "pending"
        }
    except httpx.HTTPError as e:
        raise HTTPException(status_code=503, detail=f"Payment service unavailable: {str(e)}")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to initialize event payment: {str(e)}")


@router.get("/{event_id}/payment-status")
async def get_event_payment_status(
    event_id: str,
    user: dict = Depends(get_current_user)
):
    """Check if user has paid for a specific event."""
    db = get_database()
    events_col = db["events"]
    
    if not ObjectId.is_valid(event_id):
        raise HTTPException(status_code=400, detail="Invalid event ID format")
    
    event = await events_col.find_one({"_id": ObjectId(event_id)})
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    
    if not event.get("requiresPayment"):
        return {"requiresPayment": False, "hasPaid": True}
    
    has_paid = False
    payment_ref = None
    payment_id = event.get("paymentId")
    if payment_id:
        payment = await db.payments.find_one({"_id": ObjectId(payment_id)})
        if payment and user["_id"] in payment.get("paidBy", []):
            has_paid = True
    else:
        txn = await db.paystackTransactions.find_one({
            "eventId": event_id,
            "studentId": user["_id"],
            "status": "success"
        })
        if txn:
            has_paid = True
            payment_ref = txn.get("reference")
    
    # Also check approved bank transfers
    if not has_paid:
        approved_transfer = await db.bankTransfers.find_one({
            "eventId": event_id,
            "studentId": user["_id"],
            "status": "approved",
        })
        if approved_transfer:
            has_paid = True
            payment_ref = approved_transfer.get("transactionReference")
    
    # Check pending bank transfer
    pending_transfer = await db.bankTransfers.find_one({
        "eventId": event_id,
        "studentId": user["_id"],
        "status": "pending",
    })
    
    return {
        "requiresPayment": True,
        "hasPaid": has_paid,
        "paymentAmount": event.get("paymentAmount", 0),
        "eventTitle": event.get("title", ""),
        "paymentReference": payment_ref,
        "hasPendingTransfer": pending_transfer is not None,
    }


class EventBankTransferCreate(BaseModel):
    """Student submits bank transfer proof for an event payment."""
    bankAccountId: str
    senderName: str
    senderBank: str
    transactionReference: str
    transferDate: str
    narration: Optional[str] = None


@router.post("/{event_id}/bank-transfer")
async def submit_event_bank_transfer(
    event_id: str,
    data: EventBankTransferCreate,
    user: dict = Depends(get_current_user)
):
    """
    Student submits bank transfer proof for a paid event.
    Creates a bankTransfer document with eventId for admin review.
    """
    db = get_database()
    user_id = user.get("uid") or user.get("_id")
    
    if not ObjectId.is_valid(event_id):
        raise HTTPException(status_code=400, detail="Invalid event ID format")
    
    event = await db.events.find_one({"_id": ObjectId(event_id)})
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    
    if not event.get("requiresPayment"):
        raise HTTPException(status_code=400, detail="This event does not require payment")
    
    amount = event.get("paymentAmount", 0)
    if amount <= 0:
        raise HTTPException(status_code=400, detail="Event payment amount is not configured")
    
    # Check if already paid (Paystack)
    existing_txn = await db.paystackTransactions.find_one({
        "eventId": event_id,
        "studentId": user_id,
        "status": "success"
    })
    if existing_txn:
        raise HTTPException(status_code=400, detail="You have already paid for this event")
    
    # Check for existing pending bank transfer
    existing_transfer = await db.bankTransfers.find_one({
        "studentId": user_id,
        "eventId": event_id,
        "status": "pending",
    })
    if existing_transfer:
        raise HTTPException(
            status_code=400,
            detail="You already have a pending bank transfer for this event. Please wait for admin review."
        )
    
    # Check approved transfer
    approved_transfer = await db.bankTransfers.find_one({
        "studentId": user_id,
        "eventId": event_id,
        "status": "approved",
    })
    if approved_transfer:
        raise HTTPException(status_code=400, detail="Your bank transfer for this event has already been approved")
    
    # Check for duplicate transaction reference globally
    duplicate_ref = await db.bankTransfers.find_one({
        "transactionReference": data.transactionReference
    })
    if duplicate_ref:
        raise HTTPException(
            status_code=409,
            detail=f"A transfer submission with reference '{data.transactionReference}' already exists. "
                   "Each bank transaction can only be submitted once."
        )
    # Also check approved transactions collection
    duplicate_txn = await db.transactions.find_one({"reference": data.transactionReference})
    if duplicate_txn:
        raise HTTPException(
            status_code=409,
            detail=f"Reference '{data.transactionReference}' has already been used for a verified payment."
        )
    
    # Validate bank account exists and is active
    bank_account = await db.bankAccounts.find_one({
        "_id": ObjectId(data.bankAccountId),
        "isActive": True,
    })
    if not bank_account:
        raise HTTPException(status_code=404, detail="Bank account not found or inactive")
    
    doc = {
        "studentId": user_id,
        "studentName": f"{user.get('firstName', '')} {user.get('lastName', '')}".strip() or user.get("email", "Unknown"),
        "studentEmail": user.get("email", ""),
        "eventId": event_id,
        "eventTitle": event.get("title", "Event Payment"),
        "paymentTitle": f"Event: {event.get('title', 'Event Payment')}",
        "bankAccountId": data.bankAccountId,
        "bankAccountName": bank_account.get("accountName", ""),
        "bankAccountBank": bank_account.get("bankName", ""),
        "bankAccountNumber": bank_account.get("accountNumber", ""),
        "amount": amount,
        "senderName": data.senderName,
        "senderBank": data.senderBank,
        "transactionReference": data.transactionReference,
        "transferDate": data.transferDate,
        "narration": data.narration,
        "status": "pending",
        "adminNote": None,
        "reviewedBy": None,
        "reviewedAt": None,
        "createdAt": datetime.now(timezone.utc),
        "updatedAt": datetime.now(timezone.utc),
    }
    result = await db.bankTransfers.insert_one(doc)
    doc["_id"] = str(result.inserted_id)
    return doc


@router.delete("/{event_id}/register", response_model=EventWithStatus)
async def unregister_from_event(
    event_id: str,
    user: dict = Depends(get_current_user)
):
    """Unregister current user from an event"""
    db = get_database()
    events = db["events"]
    
    if not ObjectId.is_valid(event_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid event ID format"
        )
    
    # Unregister user
    result = await events.update_one(
        {"_id": ObjectId(event_id)},
        {
            "$pull": {"registrations": user["_id"]},
            "$set": {"updatedAt": datetime.now(timezone.utc)}
        }
    )
    
    if result.matched_count == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Event {event_id} not found"
        )
    
    # Return updated event
    updated_event = await events.find_one({"_id": ObjectId(event_id)})
    updated_event["_id"] = str(updated_event["_id"])
    
    is_full = False
    if updated_event.get("maxAttendees"):
        is_full = len(updated_event.get("registrations", [])) >= updated_event["maxAttendees"]
    
    return EventWithStatus(
        **updated_event,
        isRegistered=False,
        hasAttended=user["_id"] in updated_event.get("attendees", []),
        isFull=is_full
    )


@router.patch("/{event_id}", response_model=Event)
async def update_event(
    event_id: str,
    event_update: EventUpdate,
    user: dict = Depends(require_permission("event:edit"))
):
    """
    Update event details.
    Requires event:edit permission.
    """
    db = get_database()
    events = db["events"]
    
    if not ObjectId.is_valid(event_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid event ID format"
        )
    
    update_data = event_update.model_dump(exclude_unset=True)
    if not update_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No fields to update"
        )
    
    update_data["updatedAt"] = datetime.now(timezone.utc)
    
    result = await events.update_one(
        {"_id": ObjectId(event_id)},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Event {event_id} not found"
        )
    
    updated_event = await events.find_one({"_id": ObjectId(event_id)})
    updated_event["_id"] = str(updated_event["_id"])
    
    await AuditLogger.log(
        action=AuditLogger.EVENT_UPDATED,
        actor_id=user["_id"],
        actor_email=user.get("email", ""),
        resource_type="event",
        resource_id=event_id,
        details={"updated_fields": list(update_data.keys())}
    )
    from app.routers.sse import publish
    from app.core.cache import cache_delete, cache_delete_pattern
    publish("event_updated", {"id": event_id})
    await cache_delete("admin_stats")
    await cache_delete_pattern("student_dashboard:*")
    return Event(**updated_event)


@router.delete("/{event_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_event(
    event_id: str,
    user: dict = Depends(require_permission("event:delete"))
):
    """
    Delete an event.
    Only admins can delete events.
    """
    db = get_database()
    events = db["events"]
    
    if not ObjectId.is_valid(event_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid event ID format"
        )
    
    result = await events.delete_one({"_id": ObjectId(event_id)})
    
    if result.deleted_count == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Event {event_id} not found"
        )
    
    await AuditLogger.log(
        action=AuditLogger.EVENT_DELETED,
        actor_id=user["_id"],
        actor_email=user.get("email", ""),
        resource_type="event",
        resource_id=event_id,
    )
    from app.routers.sse import publish
    from app.core.cache import cache_delete, cache_delete_pattern
    publish("event_deleted", {"id": event_id})
    await cache_delete("admin_stats")
    await cache_delete_pattern("student_dashboard:*")
    return None


@router.get("/registrations/me", response_model=List[str])
async def get_my_registrations(
    user: dict = Depends(get_current_user)
):
    """
    Get list of event IDs the current user is registered for.
    Returns array of event ID strings.
    """
    db = get_database()
    events = db["events"]
    
    # Find all events where user is in registrations array
    cursor = events.find({"registrations": user["_id"]})
    registered_events = await cursor.to_list(length=None)
    
    # Return array of event IDs as strings
    return [str(event["_id"]) for event in registered_events]


# ── Admin: Manage registrations for a specific event ────────────────────────

class AttendMarkRequest(BaseModel):
    userId: str


@router.get("/{event_id}/registrations")
async def list_event_registrations(
    event_id: str,
    user: dict = Depends(require_permission("event:edit"))
):
    """
    Admin: List all students registered for an event with their profile details.
    Returns enriched list — name, matric, level, attended status.
    """
    db = get_database()
    events_col = db["events"]
    users_col  = db["users"]

    if not ObjectId.is_valid(event_id):
        raise HTTPException(status_code=400, detail="Invalid event ID")

    event = await events_col.find_one({"_id": ObjectId(event_id)})
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    registered_ids = event.get("registrations", [])
    attended_ids   = event.get("attendees", [])

    result = []
    for uid in registered_ids:
        student = await users_col.find_one({"_id": ObjectId(uid)})
        if not student:
            continue
        result.append({
            "id":            uid,
            "firstName":     student.get("firstName", ""),
            "lastName":      student.get("lastName", ""),
            "email":         student.get("email", ""),
            "matricNumber":  student.get("matricNumber", ""),
            "level":         student.get("level", ""),
            "profilePhotoURL": student.get("profilePhotoURL", ""),
            "hasAttended":   uid in attended_ids,
        })

    return {
        "eventId":         event_id,
        "eventTitle":      event.get("title", ""),
        "totalRegistered": len(result),
        "totalAttended":   sum(1 for r in result if r["hasAttended"]),
        "registrants":     result,
    }


@router.delete("/{event_id}/registrations/{user_id}", status_code=204)
async def admin_remove_registration(
    event_id: str,
    user_id:  str,
    admin: dict = Depends(require_permission("event:edit"))
):
    """Admin: Remove a student's registration from an event."""
    db = get_database()
    events_col = db["events"]

    if not ObjectId.is_valid(event_id) or not ObjectId.is_valid(user_id):
        raise HTTPException(status_code=400, detail="Invalid ID format")

    result = await events_col.update_one(
        {"_id": ObjectId(event_id)},
        {
            "$pull": {"registrations": user_id, "attendees": user_id},
            "$set":  {"updatedAt": datetime.now(timezone.utc)},
        }
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Event not found")

    await AuditLogger.log(
        action="event:registration_removed",
        actor_id=admin["_id"],
        actor_email=admin.get("email", ""),
        resource_type="event",
        resource_id=event_id,
        details={"removed_user_id": user_id},
    )


@router.post("/{event_id}/attendees/bulk")
async def admin_mark_all_attended(
    event_id: str,
    body: dict,
    admin: dict = Depends(require_permission("event:edit"))
):
    """Admin: Bulk mark multiple registered students as attended in one request."""
    db = get_database()
    events_col = db["events"]

    if not ObjectId.is_valid(event_id):
        raise HTTPException(status_code=400, detail="Invalid event ID")

    user_ids: list = body.get("userIds", [])
    if not user_ids:
        raise HTTPException(status_code=400, detail="userIds must be a non-empty list")

    event = await events_col.find_one({"_id": ObjectId(event_id)})
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    registered = set(event.get("registrations", []))
    valid_ids = [uid for uid in user_ids if uid in registered]

    if not valid_ids:
        raise HTTPException(status_code=400, detail="None of the provided users are registered for this event")

    await events_col.update_one(
        {"_id": ObjectId(event_id)},
        {
            "$addToSet": {"attendees": {"$each": valid_ids}},
            "$set": {"updatedAt": datetime.now(timezone.utc)},
        }
    )

    await AuditLogger.log(
        action="event:bulk_attendance_marked",
        actor_id=admin["_id"],
        actor_email=admin.get("email", ""),
        resource_type="event",
        resource_id=event_id,
        details={"marked_count": len(valid_ids)},
    )

    return {"message": f"Marked {len(valid_ids)} attendee(s)", "markedCount": len(valid_ids)}


@router.post("/{event_id}/attendees")
async def admin_mark_attended(
    event_id: str,
    body:     AttendMarkRequest,
    admin: dict = Depends(require_permission("event:edit"))
):
    """Admin: Mark a registered student as having attended."""
    db = get_database()
    events_col = db["events"]

    if not ObjectId.is_valid(event_id):
        raise HTTPException(status_code=400, detail="Invalid event ID")

    event = await events_col.find_one({"_id": ObjectId(event_id)})
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    if body.userId not in event.get("registrations", []):
        raise HTTPException(status_code=400, detail="User is not registered for this event")

    await events_col.update_one(
        {"_id": ObjectId(event_id)},
        {
            "$addToSet": {"attendees": body.userId},
            "$set":      {"updatedAt": datetime.now(timezone.utc)},
        }
    )
    return {"message": "Attendance marked"}


@router.delete("/{event_id}/attendees/{user_id}", status_code=204)
async def admin_unmark_attended(
    event_id: str,
    user_id:  str,
    admin: dict = Depends(require_permission("event:edit"))
):
    """Admin: Unmark a student's attendance."""
    db = get_database()
    events_col = db["events"]

    if not ObjectId.is_valid(event_id):
        raise HTTPException(status_code=400, detail="Invalid event ID")

    await events_col.update_one(
        {"_id": ObjectId(event_id)},
        {
            "$pull": {"attendees": user_id},
            "$set":  {"updatedAt": datetime.now(timezone.utc)},
        }
    )


@router.get("/{event_id}/ticket/pdf")
async def download_event_ticket(
    event_id: str,
    reference: str = Query(..., description="Payment reference for the event"),
    current_user: dict = Depends(get_current_user)
):
    """
    Download PDF ticket for a registered event.
    Supports both online payments (Paystack) and bank transfers.
    """
    try:
        db = get_database()
        
        print(f"[TICKET] Event ID: {event_id}, Reference: {reference}")
        print(f"[TICKET] User ID: {current_user.get('_id')}")
        
        # Validate event ID
        if not ObjectId.is_valid(event_id):
            raise HTTPException(status_code=400, detail="Invalid event ID")
        
        # Fetch event
        event = await db.events.find_one({"_id": ObjectId(event_id)})
        if not event:
            print(f"[TICKET] Event not found: {event_id}")
            raise HTTPException(status_code=404, detail="Event not found")
        
        print(f"[TICKET] Event found: {event.get('title')}")
        
        # Try paystackTransactions first (online payments)
        transaction = await db.paystackTransactions.find_one({"reference": reference})
        payment_method = "Paystack"
        
        # If not found, check transactions collection (bank transfers)
        if not transaction:
            print(f"[TICKET] Not found in paystackTransactions, checking transactions...")
            transaction = await db.transactions.find_one({"reference": reference})
            payment_method = "Bank Transfer"
        
        if not transaction:
            print(f"[TICKET] Transaction not found in any collection for reference: {reference}")
            # Debug: Show user's recent transactions
            paystack_txns = await db.paystackTransactions.find(
                {"studentId": current_user["_id"]}
            ).limit(3).to_list(length=3)
            other_txns = await db.transactions.find(
                {"studentId": current_user["_id"]}
            ).limit(3).to_list(length=3)
            print(f"[TICKET] Paystack transactions: {len(paystack_txns)}")
            print(f"[TICKET] Other transactions: {len(other_txns)}")
            if paystack_txns:
                print(f"[TICKET] Sample Paystack refs: {[t.get('reference') for t in paystack_txns]}")
            if other_txns:
                print(f"[TICKET] Sample other refs: {[t.get('reference') for t in other_txns]}")
            raise HTTPException(status_code=404, detail=f"Transaction not found with reference: {reference}")
        
        print(f"[TICKET] Transaction found via {payment_method}: {transaction.get('_id')}, status: {transaction.get('status')}")
        
        # Verify ownership
        if transaction["studentId"] != current_user["_id"]:
            print(f"[TICKET] Ownership mismatch")
            raise HTTPException(status_code=403, detail="Not authorized to access this ticket")
        
        # Check if payment was successful/verified
        status = transaction.get("status")
        if status not in ["success", "verified"]:
            raise HTTPException(
                status_code=400,
                detail=f"Ticket not available. Payment status: {status}"
            )
        
        print(f"[TICKET] Payment verified, checking event registration...")
        
        # Check if user is registered for the event
        user_id = current_user["_id"]
        if "registrations" in event:
            # Check if user ID is in registrations (could be string or dict)
            is_registered = False
            for reg in event["registrations"]:
                if isinstance(reg, dict):
                    if reg.get("userId") == user_id:
                        is_registered = True
                        has_paid = reg.get("hasPaid", False)
                        break
                elif reg == user_id:
                    is_registered = True
                    has_paid = True  # Assume paid if registered via bank transfer
                    break
            
            if not is_registered:
                print(f"[TICKET] User not registered for event")
                raise HTTPException(status_code=403, detail="You are not registered for this event")
        else:
            print(f"[TICKET] Event has no registrations")
            raise HTTPException(status_code=403, detail="You are not registered for this event")
        
        print(f"[TICKET] User is registered, generating ticket...")
        
        # Get student level — prefer currentLevel from user profile
        student_level = (
            current_user.get("currentLevel")
            or current_user.get("level")
            or "N/A"
        )
        if isinstance(student_level, int):
            student_level = str(student_level)
        
        # Build student name from profile (firstName + lastName)
        first = current_user.get("firstName", "")
        last = current_user.get("lastName", "")
        student_name = f"{first} {last}".strip()
        if not student_name:
            student_name = current_user.get("displayName", "Unknown Student")
        
        # Format event date
        event_date = event.get("date")
        if isinstance(event_date, str):
            from dateutil import parser
            event_date = parser.parse(event_date)
        elif not isinstance(event_date, datetime):
            event_date = datetime.now(timezone.utc)
        
        # Generate PDF ticket
        from ..utils.ticket_generator import generate_event_ticket
        pdf_buffer = generate_event_ticket(
            event_id=str(event["_id"]),
            event_title=event.get("title", "IESA Event"),
            event_date=event_date,
            event_location=event.get("location", "TBA"),
            student_name=student_name,
            student_email=current_user.get("email", "student@example.com"),
            student_level=student_level,
            reference=reference,
            ticket_number=f"{event_id[:8]}-{reference[:8]}",
            event_category=event.get("category", "Event")
        )
        
        print(f"[TICKET] PDF generated successfully")
        
        # Return PDF as downloadable file
        return StreamingResponse(
            pdf_buffer,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f"attachment; filename=IESA_Ticket_{event_id}.pdf"
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"[TICKET] Error generating ticket: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate ticket: {str(e)}"
        )

