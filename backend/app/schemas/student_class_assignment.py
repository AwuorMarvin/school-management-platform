"""
Student Class Assignment schemas - Request/Response models.
"""

from datetime import date
from uuid import UUID
from typing import Optional

from pydantic import BaseModel, Field


# ============================================================================
# Student Class Assignment Request Schemas
# ============================================================================

class AssignStudentToClass(BaseModel):
    """Schema for assigning a student to a class."""
    
    student_id: UUID = Field(..., description="Student ID to assign")
    start_date: Optional[date] = Field(None, description="Start date (defaults to today)")


# ============================================================================
# Student Class Assignment Response Schemas
# ============================================================================

class StudentMinimalResponse(BaseModel):
    """Minimal student information for assignment response."""
    
    id: UUID
    first_name: str
    last_name: str
    
    class Config:
        from_attributes = True


class ClassMinimalResponse(BaseModel):
    """Minimal class information for assignment response."""
    
    id: UUID
    name: str
    
    class Config:
        from_attributes = True


class StudentClassAssignmentResponse(BaseModel):
    """Schema for student class assignment response."""
    
    id: UUID
    student_id: UUID
    class_id: UUID
    start_date: date
    end_date: Optional[date]
    created_at: str
    updated_at: str
    student: Optional[StudentMinimalResponse] = None
    class_: Optional[ClassMinimalResponse] = None
    
    class Config:
        from_attributes = True

