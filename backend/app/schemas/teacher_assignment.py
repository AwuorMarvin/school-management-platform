"""
Teacher Class Assignment schemas - Request/Response models.
"""

from datetime import date
from uuid import UUID
from typing import Optional

from pydantic import BaseModel, Field


# ============================================================================
# Teacher Assignment Request Schemas
# ============================================================================

class AssignTeacherToClass(BaseModel):
    """Schema for assigning a teacher to a class."""
    
    teacher_id: UUID = Field(..., description="Teacher ID to assign")
    subject_id: Optional[UUID] = Field(None, description="Optional subject ID (if not provided, teacher is class teacher)")
    start_date: Optional[date] = Field(None, description="Start date (defaults to today)")


# ============================================================================
# Teacher Assignment Response Schemas
# ============================================================================

class TeacherMinimalResponse(BaseModel):
    """Minimal teacher information for assignment response."""
    
    id: UUID
    first_name: str
    last_name: str
    email: Optional[str] = None
    
    class Config:
        from_attributes = True


class SubjectMinimalResponse(BaseModel):
    """Minimal subject information for assignment response."""
    
    id: UUID
    name: str
    
    class Config:
        from_attributes = True


class TeacherAssignmentResponse(BaseModel):
    """Schema for teacher class assignment response."""
    
    id: UUID
    teacher_id: UUID
    class_id: UUID
    subject_id: Optional[UUID]
    start_date: date
    end_date: Optional[date]
    created_at: str
    updated_at: str
    teacher: Optional[TeacherMinimalResponse] = None
    subject: Optional[SubjectMinimalResponse] = None
    
    class Config:
        from_attributes = True

