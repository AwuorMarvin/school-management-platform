"""
Payment schemas - Request/Response models for payment endpoints.
"""

from decimal import Decimal
from uuid import UUID
from typing import Optional
from datetime import date

from pydantic import BaseModel, Field, field_validator


# ============================================================================
# Payment Request Schemas
# ============================================================================

class PaymentCreate(BaseModel):
    """Schema for creating a payment record."""
    
    term_id: UUID = Field(..., description="Term ID")
    amount: Decimal = Field(..., gt=0, description="Payment amount (must be greater than 0)")
    payment_date: Optional[date] = Field(None, description="Payment date (defaults to today)")
    payment_method: Optional[str] = Field(None, max_length=100, description="Payment method (e.g., Cash, M-Pesa, Bank Transfer)")
    reference_number: Optional[str] = Field(None, max_length=100, description="Transaction reference number")
    
    @field_validator('amount')
    @classmethod
    def validate_amount(cls, v: Decimal) -> Decimal:
        """Validate payment amount."""
        if v <= 0:
            raise ValueError("Payment amount must be greater than 0")
        return v


# ============================================================================
# Payment Response Schemas
# ============================================================================

class PaymentResponse(BaseModel):
    """Schema for payment response."""
    
    id: str
    student: dict
    term: dict
    expected_amount: float
    paid_amount: float
    pending_amount: float
    last_payment: Optional[dict] = None
    updated_at: str

