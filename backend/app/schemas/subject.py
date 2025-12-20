"""
Subject schemas - Request/Response models for subject endpoints.
"""

from uuid import UUID
from typing import Optional, List

from pydantic import BaseModel, Field


# ============================================================================
# Subject Request Schemas
# ============================================================================

class SubjectCreate(BaseModel):
    """Schema for creating a new subject with optional class assignments."""
    
    name: str = Field(..., min_length=1, max_length=200, description="Subject name (e.g., 'Mathematics')")
    code: Optional[str] = Field(None, max_length=20, description="Subject code (unique within school if provided)")
    class_ids: Optional[List[UUID]] = Field(None, description="List of class IDs to assign this subject to")


class SubjectUpdate(BaseModel):
    """Schema for updating a subject."""
    
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    code: Optional[str] = Field(None, max_length=20)
    class_ids: Optional[List[UUID]] = Field(None, description="List of class IDs to assign this subject to")


# ============================================================================
# Subject Response Schemas
# ============================================================================

class ClassMinimalResponse(BaseModel):
    """Minimal class information for subject response."""
    
    id: UUID
    name: str
    
    class Config:
        from_attributes = True


class SubjectResponse(BaseModel):
    """Schema for subject response."""
    
    id: UUID
    school_id: UUID
    name: str
    code: Optional[str]
    created_at: str
    updated_at: str
    classes: Optional[List[ClassMinimalResponse]] = None
    
    class Config:
        from_attributes = True


class SubjectListResponse(BaseModel):
    """Paginated list of subjects."""
    
    data: List[SubjectResponse]
    pagination: dict
