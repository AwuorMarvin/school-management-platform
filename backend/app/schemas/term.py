"""
Term schemas - Request/Response models for term endpoints.
"""

from datetime import date
from uuid import UUID
from typing import Optional, List

from pydantic import BaseModel, Field, model_validator


# ============================================================================
# Term Request Schemas
# ============================================================================

class TermCreate(BaseModel):
    """Schema for creating a new term."""
    
    name: str = Field(..., min_length=1, max_length=100, description="Term name (e.g., 'Term 1')")
    start_date: date = Field(..., description="Start date of term (YYYY-MM-DD)")
    end_date: date = Field(..., description="End date of term (YYYY-MM-DD)")
    
    @model_validator(mode='after')
    def validate_dates(self):
        """Validate that end_date is after start_date."""
        if self.end_date <= self.start_date:
            raise ValueError("End date must be after start date")
        return self


class TermUpdate(BaseModel):
    """Schema for updating a term."""
    
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    
    @model_validator(mode='after')
    def validate_dates(self):
        """Validate that end_date is after start_date if both are provided."""
        if self.start_date and self.end_date and self.end_date <= self.start_date:
            raise ValueError("End date must be after start date")
        return self


# ============================================================================
# Term Response Schemas
# ============================================================================

class AcademicYearMinimalResponse(BaseModel):
    """Minimal academic year information for term response."""
    
    id: UUID
    name: str
    
    class Config:
        from_attributes = True


class TermResponse(BaseModel):
    """Schema for term response."""
    
    id: UUID
    academic_year_id: UUID
    name: str
    start_date: date
    end_date: date
    created_at: str
    updated_at: str
    academic_year: Optional[AcademicYearMinimalResponse] = None
    is_current: Optional[bool] = None
    
    class Config:
        from_attributes = True


class TermListResponse(BaseModel):
    """Paginated list of terms."""
    
    data: List[TermResponse]
    pagination: dict

