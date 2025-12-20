"""
Fee Adjustment schemas - Request/Response models for fee adjustment endpoints.
"""

from decimal import Decimal
from uuid import UUID
from typing import Optional, List

from pydantic import BaseModel, Field, field_validator


# ============================================================================
# Fee Adjustment Request Schemas
# ============================================================================

class FeeAdjustmentCreate(BaseModel):
    """Schema for creating a fee adjustment."""
    
    student_id: UUID = Field(..., description="Student ID")
    term_id: UUID = Field(..., description="Term ID")
    adjustment_type: str = Field(..., description="FIXED_AMOUNT | PERCENTAGE")
    adjustment_value: Decimal = Field(..., ge=0, description="Discount amount (KES) or percentage (%)")
    reason: str = Field(..., min_length=1, description="Reason for adjustment (required)")
    
    @field_validator('adjustment_type')
    @classmethod
    def validate_adjustment_type(cls, v: str) -> str:
        """Validate adjustment type."""
        if v not in ["FIXED_AMOUNT", "PERCENTAGE"]:
            raise ValueError("adjustment_type must be FIXED_AMOUNT or PERCENTAGE")
        return v
    
    @field_validator('adjustment_value')
    @classmethod
    def validate_adjustment_value(cls, v: Decimal, info) -> Decimal:
        """Validate adjustment value based on type."""
        if 'adjustment_type' in info.data:
            if info.data['adjustment_type'] == 'PERCENTAGE' and v > 100:
                raise ValueError("Percentage adjustment cannot exceed 100%")
        return v


class FeeAdjustmentUpdate(BaseModel):
    """Schema for updating a fee adjustment."""
    
    adjustment_type: Optional[str] = Field(None, description="FIXED_AMOUNT | PERCENTAGE")
    adjustment_value: Optional[Decimal] = Field(None, ge=0)
    reason: Optional[str] = Field(None, min_length=1)


# ============================================================================
# Fee Adjustment Response Schemas
# ============================================================================

class FeeAdjustmentResponse(BaseModel):
    """Schema for fee adjustment response."""
    
    id: UUID
    school_id: UUID
    student_id: UUID
    term_id: UUID
    adjustment_type: str
    adjustment_value: Decimal
    reason: str
    created_by_user_id: UUID
    created_at: str
    updated_at: str
    student: Optional[dict] = None
    term: Optional[dict] = None
    created_by: Optional[dict] = None
    
    class Config:
        from_attributes = True


class FeeAdjustmentListResponse(BaseModel):
    """Paginated list of fee adjustments."""
    
    data: List[FeeAdjustmentResponse]
    pagination: dict

