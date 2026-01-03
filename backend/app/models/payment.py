"""
Payment Models - Session-scoped financial tracking

CRITICAL: All payments MUST have session_id.
A payment due in 2024/2025 is separate from 2025/2026.
"""

from pydantic import BaseModel, Field
from typing import List, Literal, Optional
from datetime import datetime
from bson import ObjectId


class PaymentBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    amount: float = Field(..., gt=0, description="Amount in Naira")
    sessionId: str = Field(..., description="REQUIRED: Links payment to academic session")
    mandatory: bool = Field(default=True)
    deadline: datetime
    description: Optional[str] = Field(None, max_length=1000)
    category: Optional[str] = Field(None, description="e.g., 'Dues', 'Event', 'Merchandise'")


class PaymentCreate(PaymentBase):
    """Model for creating a new payment"""
    pass


class PaymentUpdate(BaseModel):
    """Model for updating payment details"""
    title: Optional[str] = Field(None, min_length=1, max_length=200)
    amount: Optional[float] = Field(None, gt=0)
    deadline: Optional[datetime] = None
    description: Optional[str] = Field(None, max_length=1000)
    mandatory: Optional[bool] = None


class Payment(PaymentBase):
    """Payment response model"""
    id: str = Field(alias="_id")
    paidBy: List[str] = Field(default_factory=list, description="List of User IDs who have paid")
    createdAt: datetime
    updatedAt: datetime

    class Config:
        populate_by_name = True
        json_encoders = {ObjectId: str}


class PaymentWithStatus(Payment):
    """Payment with user's payment status"""
    hasPaid: bool = Field(default=False)
    transactionId: Optional[str] = None


# Transaction tracking
class TransactionBase(BaseModel):
    studentId: str = Field(..., description="Reference to User._id")
    paymentId: str = Field(..., description="Reference to Payment._id")
    sessionId: str = Field(..., description="REQUIRED: Links to academic session")
    amount: float = Field(..., gt=0)
    paymentMethod: Literal["cash", "transfer", "card", "other"] = Field(default="transfer")
    reference: Optional[str] = Field(None, description="Payment reference/receipt number")
    status: Literal["pending", "confirmed", "failed"] = Field(default="confirmed")
    notes: Optional[str] = None


class TransactionCreate(TransactionBase):
    """Model for recording a payment transaction"""
    pass


class Transaction(TransactionBase):
    """Transaction response model"""
    id: str = Field(alias="_id")
    createdAt: datetime
    verifiedBy: Optional[str] = Field(None, description="Admin who verified payment")
    verifiedAt: Optional[datetime] = None

    class Config:
        populate_by_name = True
        json_encoders = {ObjectId: str}
