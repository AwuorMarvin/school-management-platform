"""
Class schemas - Request/Response models for class endpoints.
"""

from uuid import UUID
from typing import Optional, List

from pydantic import BaseModel, Field, field_validator


# ============================================================================
# Class Request Schemas
# ============================================================================

class ClassCreate(BaseModel):
    """Schema for creating a new class."""
    
    campus_id: UUID = Field(..., description="Campus ID")
    academic_year_id: UUID = Field(..., description="Academic year ID")
    name: str = Field(..., min_length=1, max_length=100, description="Class name (e.g., 'Grade 3A')")
    capacity: Optional[int] = Field(None, ge=1, le=100, description="Maximum number of students (1-100)")
    subject_ids: Optional[List[UUID]] = Field(None, description="List of subject IDs to assign to this class")


class ClassUpdate(BaseModel):
    """Schema for updating a class."""
    
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    capacity: Optional[int] = Field(None, ge=1, le=100)
    subject_ids: Optional[List[UUID]] = Field(None, description="List of subject IDs to assign to this class")


# ============================================================================
# Class Response Schemas
# ============================================================================

class CampusMinimalResponse(BaseModel):
    """Minimal campus information for class response."""
    
    id: UUID
    name: str
    
    class Config:
        from_attributes = True


class AcademicYearMinimalResponse(BaseModel):
    """Minimal academic year information for class response."""
    
    id: UUID
    name: str
    
    class Config:
        from_attributes = True


class ClassResponse(BaseModel):
    """Schema for class response."""
    
    id: UUID
    campus_id: UUID
    academic_year_id: UUID
    name: str
    capacity: Optional[int]
    created_at: str
    updated_at: str
    campus: Optional[CampusMinimalResponse] = None
    academic_year: Optional[AcademicYearMinimalResponse] = None
    student_count: Optional[int] = None
    
    class Config:
        from_attributes = True


class ClassListResponse(BaseModel):
    """Paginated list of classes."""
    
    data: List[ClassResponse]
    pagination: dict

