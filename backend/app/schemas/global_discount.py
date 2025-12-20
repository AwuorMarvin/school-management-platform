"""
Global Discount schemas - Request/Response models for global discount endpoints.
"""

from decimal import Decimal
from uuid import UUID
from typing import Optional, List

from pydantic import BaseModel, Field, field_validator


# ============================================================================
# Global Discount Request Schemas
# ============================================================================

class GlobalDiscountCreate(BaseModel):
    """Schema for creating a global discount."""
    
    discount_name: str = Field(..., min_length=1, max_length=200, description="Name of the discount")
    discount_type: str = Field(..., description="FIXED_AMOUNT | PERCENTAGE")
    discount_value: Decimal = Field(..., ge=0, description="Discount amount (KES) or percentage (%)")
    term_id: UUID = Field(..., description="Term ID")
    applies_to: str = Field(..., description="ALL_STUDENTS | SELECTED_CAMPUSES | SELECTED_CLASSES")
    campus_ids: Optional[List[UUID]] = Field(None, description="Campus IDs (required if applies_to = SELECTED_CAMPUSES)")
    class_ids: Optional[List[UUID]] = Field(None, description="Class IDs (required if applies_to = SELECTED_CLASSES)")
    condition_type: Optional[str] = Field(None, description="PAYMENT_BEFORE_DATE | NONE")
    condition_value: Optional[str] = Field(None, description="Condition value (e.g., ISO date for PAYMENT_BEFORE_DATE)")
    is_active: bool = Field(True, description="Whether this discount is currently active")
    
    @field_validator('discount_type')
    @classmethod
    def validate_discount_type(cls, v: str) -> str:
        """Validate discount type."""
        if v not in ["FIXED_AMOUNT", "PERCENTAGE"]:
            raise ValueError("discount_type must be FIXED_AMOUNT or PERCENTAGE")
        return v
    
    @field_validator('discount_value')
    @classmethod
    def validate_discount_value(cls, v: Decimal, info) -> Decimal:
        """Validate discount value based on type."""
        if 'discount_type' in info.data:
            if info.data['discount_type'] == 'PERCENTAGE' and v > 100:
                raise ValueError("Percentage discount cannot exceed 100%")
        return v
    
    @field_validator('applies_to')
    @classmethod
    def validate_applies_to(cls, v: str) -> str:
        """Validate applies_to."""
        if v not in ["ALL_STUDENTS", "SELECTED_CAMPUSES", "SELECTED_CLASSES"]:
            raise ValueError("applies_to must be ALL_STUDENTS, SELECTED_CAMPUSES, or SELECTED_CLASSES")
        return v
    
    @field_validator('campus_ids', 'class_ids')
    @classmethod
    def validate_selection_ids(cls, v: Optional[List[UUID]], info) -> Optional[List[UUID]]:
        """Validate that selection IDs are provided when needed."""
        applies_to = info.data.get('applies_to')
        field_name = info.field_name
        
        if applies_to == 'SELECTED_CAMPUSES' and field_name == 'campus_ids' and (not v or len(v) == 0):
            raise ValueError("campus_ids is required when applies_to = SELECTED_CAMPUSES")
        
        if applies_to == 'SELECTED_CLASSES' and field_name == 'class_ids' and (not v or len(v) == 0):
            raise ValueError("class_ids is required when applies_to = SELECTED_CLASSES")
        
        return v


class GlobalDiscountUpdate(BaseModel):
    """Schema for updating a global discount."""
    
    discount_name: Optional[str] = Field(None, min_length=1, max_length=200)
    discount_type: Optional[str] = Field(None, description="FIXED_AMOUNT | PERCENTAGE")
    discount_value: Optional[Decimal] = Field(None, ge=0)
    applies_to: Optional[str] = Field(None, description="ALL_STUDENTS | SELECTED_CAMPUSES | SELECTED_CLASSES")
    campus_ids: Optional[List[UUID]] = Field(None)
    class_ids: Optional[List[UUID]] = Field(None)
    condition_type: Optional[str] = Field(None)
    condition_value: Optional[str] = Field(None)
    is_active: Optional[bool] = Field(None)


# ============================================================================
# Global Discount Response Schemas
# ============================================================================

class GlobalDiscountCampusResponse(BaseModel):
    """Schema for global discount campus relationship."""
    
    id: UUID
    campus_id: UUID
    campus: Optional[dict] = None
    
    class Config:
        from_attributes = True


class GlobalDiscountClassResponse(BaseModel):
    """Schema for global discount class relationship."""
    
    id: UUID
    class_id: UUID
    class_: Optional[dict] = None
    
    class Config:
        from_attributes = True


class GlobalDiscountResponse(BaseModel):
    """Schema for global discount response."""
    
    id: UUID
    school_id: UUID
    discount_name: str
    discount_type: str
    discount_value: Decimal
    term_id: UUID
    applies_to: str
    condition_type: Optional[str] = None
    condition_value: Optional[str] = None
    is_active: bool
    created_at: str
    updated_at: str
    term: Optional[dict] = None
    campus_discounts: List[GlobalDiscountCampusResponse] = []
    class_discounts: List[GlobalDiscountClassResponse] = []
    
    class Config:
        from_attributes = True


class GlobalDiscountListResponse(BaseModel):
    """Paginated list of global discounts."""
    
    data: List[GlobalDiscountResponse]
    pagination: dict

