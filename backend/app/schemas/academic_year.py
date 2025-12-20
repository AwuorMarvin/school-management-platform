"""
Academic Year schemas - Request/Response models for academic year endpoints.
"""

from datetime import date
from uuid import UUID
from typing import Optional, List

from pydantic import BaseModel, Field, field_validator, model_validator


# ============================================================================
# Academic Year Request Schemas
# ============================================================================

class AcademicYearCreate(BaseModel):
    """Schema for creating a new academic year."""
    
    name: str = Field(..., min_length=1, max_length=50, description="Academic year name (e.g., '2024')")
    start_date: date = Field(..., description="Start date of academic year (YYYY-MM-DD)")
    end_date: date = Field(..., description="End date of academic year (YYYY-MM-DD)")
    
    @model_validator(mode='after')
    def validate_dates(self):
        """Validate that end_date is after start_date."""
        if self.end_date <= self.start_date:
            raise ValueError("End date must be after start date")
        return self


class AcademicYearUpdate(BaseModel):
    """Schema for updating an academic year."""
    
    name: Optional[str] = Field(None, min_length=1, max_length=50)
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    
    @model_validator(mode='after')
    def validate_dates(self):
        """Validate that end_date is after start_date if both are provided."""
        if self.start_date and self.end_date and self.end_date <= self.start_date:
            raise ValueError("End date must be after start date")
        return self


# ============================================================================
# Academic Year Response Schemas
# ============================================================================

class TermMinimalResponse(BaseModel):
    """Minimal term information for academic year response."""
    
    id: UUID
    name: str
    start_date: date
    end_date: date
    
    class Config:
        from_attributes = True


class AcademicYearResponse(BaseModel):
    """Schema for academic year response."""
    
    id: UUID
    school_id: UUID
    name: str
    start_date: date
    end_date: date
    created_at: str
    updated_at: str
    terms: List[TermMinimalResponse] = []
    term_count: Optional[int] = None
    is_current: Optional[bool] = None
    
    class Config:
        from_attributes = True


class AcademicYearListResponse(BaseModel):
    """Paginated list of academic years."""
    
    data: List[AcademicYearResponse]
    pagination: dict

