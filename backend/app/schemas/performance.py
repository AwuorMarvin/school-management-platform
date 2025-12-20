"""
Academic Performance schemas - Request/Response models.
"""

from uuid import UUID
from typing import Optional

from pydantic import BaseModel, Field


# ============================================================================
# Performance Entry Request Schemas
# ============================================================================

class PerformanceEntry(BaseModel):
    """Schema for entering/updating student performance."""
    
    subject_id: UUID = Field(..., description="Subject ID")
    term_id: UUID = Field(..., description="Term ID")
    grade: Optional[str] = Field(None, max_length=10, description="Grade (e.g., A, A+, B, 85%)")
    subject_comment: Optional[str] = Field(None, max_length=1000, description="Subject-level comment")


class TermCommentEntry(BaseModel):
    """Schema for entering/updating term comment."""
    
    term_id: UUID = Field(..., description="Term ID")
    comment: str = Field(..., min_length=1, max_length=2000, description="Overall term comment")


# ============================================================================
# Performance Response Schemas
# ============================================================================

class StudentMinimalResponse(BaseModel):
    """Minimal student information."""
    
    id: UUID
    first_name: str
    last_name: str
    
    class Config:
        from_attributes = True


class SubjectMinimalResponse(BaseModel):
    """Minimal subject information."""
    
    id: UUID
    name: str
    
    class Config:
        from_attributes = True


class TermMinimalResponse(BaseModel):
    """Minimal term information."""
    
    id: UUID
    name: str
    
    class Config:
        from_attributes = True


class UserMinimalResponse(BaseModel):
    """Minimal user information."""
    
    id: UUID
    first_name: str
    last_name: str
    
    class Config:
        from_attributes = True


class PerformanceResponse(BaseModel):
    """Schema for performance entry response."""
    
    id: str
    student_id: UUID
    subject_id: UUID
    term_id: UUID
    grade: Optional[str]
    subject_comment: Optional[str]
    entered_by_user_id: UUID
    created_at: str
    updated_at: str
    student: Optional[StudentMinimalResponse] = None
    subject: Optional[SubjectMinimalResponse] = None
    term: Optional[TermMinimalResponse] = None
    entered_by: Optional[UserMinimalResponse] = None
    
    class Config:
        from_attributes = True


class PerformanceListItem(BaseModel):
    """Schema for performance list item."""
    
    subject: SubjectMinimalResponse
    term: TermMinimalResponse
    grade: Optional[str]
    subject_comment: Optional[str]
    entered_by: UserMinimalResponse
    entered_at: str


class PerformanceListResponse(BaseModel):
    """Schema for performance list response."""
    
    student: StudentMinimalResponse
    data: list[PerformanceListItem]


class TermCommentResponse(BaseModel):
    """Schema for term comment response."""
    
    id: str
    student_id: UUID
    term_id: UUID
    comment: str
    entered_by_user_id: UUID
    created_at: str
    updated_at: str
    student: Optional[StudentMinimalResponse] = None
    term: Optional[TermMinimalResponse] = None
    entered_by: Optional[UserMinimalResponse] = None
    
    class Config:
        from_attributes = True

