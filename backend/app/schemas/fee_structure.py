"""
Fee Structure schemas - Request/Response models for fee structure endpoints.
"""

from decimal import Decimal
from uuid import UUID
from typing import Optional, List, Literal

from pydantic import BaseModel, Field, field_validator, model_validator


# ============================================================================
# Fee Line Item Schemas
# ============================================================================

class FeeLineItemCreate(BaseModel):
    """Schema for creating a fee line item."""
    
    item_name: str = Field(..., min_length=1, max_length=200, description="Name of the fee line item")
    amount: Decimal = Field(..., ge=0, description="Amount for this line item (KES)")
    display_order: int = Field(0, ge=0, description="Order in which to display line items")
    is_annual: bool = Field(
        False,
        description="If true, this line item is charged once per academic year (annual); otherwise per term",
    )
    is_one_off: bool = Field(
        False,
        description="If true, this line item is charged once for new students only (one-off fee)",
    )
    
    @model_validator(mode='after')
    def validate_fee_type(self):
        """Validate that annual and one-off are mutually exclusive."""
        if self.is_annual and self.is_one_off:
            raise ValueError("A line item cannot be both annual and one-off")
        return self


class FeeLineItemResponse(BaseModel):
    """Schema for fee line item response."""
    
    id: UUID
    item_name: str
    amount: Decimal
    display_order: int
    is_annual: bool = False
    is_one_off: bool = False
    
    class Config:
        from_attributes = True


# ============================================================================
# Fee Structure Request Schemas
# ============================================================================

class FeeStructureTermlyCreate(BaseModel):
    """Schema for creating a termly fee structure."""
    
    campus_id: UUID = Field(..., description="Campus ID")
    academic_year_id: UUID = Field(..., description="Academic Year ID")
    term_id: UUID = Field(..., description="Term ID")
    class_ids: List[UUID] = Field(..., min_length=1, description="List of class IDs (multi-select)")
    line_items: List[FeeLineItemCreate] = Field(..., min_length=1, max_length=10, description="Fee line items (1-10 items)")
    
    @field_validator('line_items')
    @classmethod
    def validate_line_items(cls, v: List[FeeLineItemCreate]) -> List[FeeLineItemCreate]:
        """Validate line items count."""
        if len(v) < 1:
            raise ValueError("At least one line item is required")
        if len(v) > 10:
            raise ValueError("Maximum 10 line items allowed")
        return v
    
    @field_validator('class_ids')
    @classmethod
    def validate_class_ids(cls, v: List[UUID]) -> List[UUID]:
        """Validate at least one class is provided."""
        if len(v) < 1:
            raise ValueError("At least one class must be selected")
        return v


class FeeStructureAnnualCreate(BaseModel):
    """Schema for creating an annual fee structure."""
    
    campus_id: UUID = Field(..., description="Campus ID")
    academic_year_id: UUID = Field(..., description="Academic Year ID")
    class_ids: List[UUID] = Field(..., min_length=1, description="List of class IDs (multi-select)")
    override_conflicts: bool = Field(False, description="If true, delete existing conflicting structures and create new one. If false and conflicts exist, returns conflict info.")
    # Term-specific line items
    term_1_items: Optional[List[FeeLineItemCreate]] = Field(None, description="Line items for Term 1")
    term_2_items: Optional[List[FeeLineItemCreate]] = Field(None, description="Line items for Term 2")
    term_3_items: Optional[List[FeeLineItemCreate]] = Field(None, description="Line items for Term 3")
    # Annual and one-off items
    annual_items: Optional[List[FeeLineItemCreate]] = Field(None, description="Annual line items (charged once per year)")
    one_off_items: Optional[List[FeeLineItemCreate]] = Field(None, description="One-off line items (charged once for new students)")
    
    @model_validator(mode='after')
    def validate_total_items(self):
        """Validate total line items across all terms doesn't exceed 10."""
        all_items = []
        if self.term_1_items:
            all_items.extend(self.term_1_items)
        if self.term_2_items:
            all_items.extend(self.term_2_items)
        if self.term_3_items:
            all_items.extend(self.term_3_items)
        if self.annual_items:
            all_items.extend(self.annual_items)
        if self.one_off_items:
            all_items.extend(self.one_off_items)
        
        if len(all_items) > 10:
            raise ValueError("Total line items across all terms cannot exceed 10")
        if len(all_items) < 1:
            raise ValueError("At least one line item must be provided across all terms")
        
        return self
    
    @field_validator('class_ids')
    @classmethod
    def validate_class_ids(cls, v: List[UUID]) -> List[UUID]:
        """Validate at least one class is provided."""
        if len(v) < 1:
            raise ValueError("At least one class must be selected")
        return v


# Legacy schema for backward compatibility
class FeeStructureCreate(BaseModel):
    """Legacy schema for creating a fee structure (backward compatibility)."""
    
    structure_name: str = Field(..., min_length=1, max_length=200, description="Name of the fee structure")
    class_id: UUID = Field(..., description="Class ID")
    term_id: UUID = Field(..., description="Term ID")
    line_items: List[FeeLineItemCreate] = Field(..., min_length=1, max_length=10, description="Fee line items (1-10 items)")
    status: str = Field("INACTIVE", description="ACTIVE | INACTIVE")
    
    @field_validator('line_items')
    @classmethod
    def validate_line_items(cls, v: List[FeeLineItemCreate]) -> List[FeeLineItemCreate]:
        """Validate line items count."""
        if len(v) < 1:
            raise ValueError("At least one line item is required")
        if len(v) > 10:
            raise ValueError("Maximum 10 line items allowed")
        return v
    
    @field_validator('status')
    @classmethod
    def validate_status(cls, v: str) -> str:
        """Validate status."""
        if v not in ["ACTIVE", "INACTIVE"]:
            raise ValueError("Status must be ACTIVE or INACTIVE")
        return v


class FeeStructureUpdate(BaseModel):
    """Schema for updating a fee structure. Creates new version if structure is ACTIVE."""
    
    structure_name: Optional[str] = Field(None, min_length=1, max_length=200)
    line_items: Optional[List[FeeLineItemCreate]] = Field(None, min_length=1, max_length=10)
    status: Optional[Literal["ACTIVE", "INACTIVE"]] = Field(None, description="ACTIVE | INACTIVE")
    
    @field_validator('status')
    @classmethod
    def validate_status(cls, v: Optional[str]) -> Optional[str]:
        """Validate status."""
        if v is not None and v not in ["ACTIVE", "INACTIVE"]:
            raise ValueError("Status must be ACTIVE or INACTIVE")
        return v


class FeeStructureCarryForward(BaseModel):
    """Schema for carrying forward a fee structure."""
    
    structure_name: Optional[str] = Field(None, min_length=1, max_length=200, description="New structure name (optional)")
    term_id: UUID = Field(..., description="Target term ID to carry forward to")
    line_items: Optional[List[FeeLineItemCreate]] = Field(None, description="Updated line items (optional, uses original if not provided)")
    status: str = Field("INACTIVE", description="ACTIVE | INACTIVE")


# Legacy - kept for backward compatibility
class FeeStructureYearlyCreate(BaseModel):
    """Legacy schema for creating a yearly fee structure (deprecated - use FeeStructureAnnualCreate)."""

    class_id: UUID = Field(..., description="Class ID")
    academic_year_id: UUID = Field(..., description="Academic Year ID")
    line_items: List[FeeLineItemCreate] = Field(..., min_length=1, max_length=10, description="Fee line items (1-10 items)")
    status: str = Field("INACTIVE", description="ACTIVE | INACTIVE")


# ============================================================================
# Fee Structure Response Schemas
# ============================================================================

class FeeStructureResponse(BaseModel):
    """Schema for fee structure response."""
    
    id: UUID
    school_id: UUID
    structure_name: str
    campus_id: UUID
    academic_year_id: UUID
    term_id: Optional[UUID] = None  # Nullable for YEAR-scoped structures
    structure_scope: Literal["TERM", "YEAR"]
    version: int
    parent_structure_id: Optional[UUID] = None
    status: Literal["ACTIVE", "INACTIVE"]
    base_fee: Decimal
    effective_from: Optional[str] = None
    effective_to: Optional[str] = None
    created_at: str
    updated_at: Optional[str] = None
    # Multi-class support
    class_ids: List[UUID] = []  # List of class IDs this structure applies to
    classes: Optional[List[dict]] = None  # Class details
    campus: Optional[dict] = None
    academic_year: Optional[dict] = None
    term: Optional[dict] = None
    line_items: List[FeeLineItemResponse] = []
    # Version history (populated separately, not from attributes)
    child_versions: Optional[List["FeeStructureResponse"]] = Field(None, exclude=True)
    
    class Config:
        from_attributes = True


class FeeStructureConflictInfo(BaseModel):
    """Information about existing termly structures that conflict with annual creation."""
    
    class_id: UUID
    class_name: str
    existing_term_ids: List[UUID]
    existing_term_names: List[str]
    existing_structure_ids: List[UUID]


class FeeStructureConflictResponse(BaseModel):
    """Response when annual structure creation detects conflicts."""
    
    has_conflicts: bool
    conflicts: List[FeeStructureConflictInfo] = []
    message: str
    conflicting_structure_ids: List[UUID] = []  # IDs of structures that would conflict


class FeeStructureListResponse(BaseModel):
    """Paginated list of fee structures."""
    
    data: List[FeeStructureResponse]
    pagination: dict


class AcademicYearFeeOverviewRow(BaseModel):
    """Row in the academic year fee overview matrix."""
    
    campus_id: UUID
    campus_name: str
    class_id: UUID
    class_name: str
    term_1_amount: Optional[Decimal] = None
    term_2_amount: Optional[Decimal] = None
    term_3_amount: Optional[Decimal] = None
    one_off_amount: Optional[Decimal] = None
    annual_amount: Optional[Decimal] = None
    total_amount: Decimal
    structure_ids: List[UUID] = []  # IDs of structures contributing to this row
    line_items: Optional[List[dict]] = None  # Line items grouped by term, annual, and one-off


class AcademicYearFeeOverviewResponse(BaseModel):
    """Academic year fee overview matrix response."""
    
    academic_year_id: UUID
    academic_year_name: str
    rows: List[AcademicYearFeeOverviewRow]
