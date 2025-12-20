"""
Club Activity schemas - Request/Response models for club activity endpoints.
"""

from decimal import Decimal
from uuid import UUID
from typing import Optional, List

from pydantic import BaseModel, Field, field_validator


# ============================================================================
# Club Activity Request Schemas
# ============================================================================

class ClubActivityCreate(BaseModel):
    """Schema for creating a new club activity."""
    
    service_name: str = Field(..., min_length=1, max_length=200, description="Name of the club/activity")
    activity_type: str = Field(..., description="CLUB or EXTRA_CURRICULAR")
    cost_per_term: Decimal = Field(..., ge=0, description="Cost per term")
    teacher_id: Optional[UUID] = Field(None, description="Teacher/Instructor ID (optional)")
    academic_year_id: UUID = Field(..., description="Academic Year ID")
    term_id: UUID = Field(..., description="Term ID")
    class_ids: Optional[List[UUID]] = Field(None, description="List of class IDs this activity is offered to")
    
    @field_validator("activity_type")
    @classmethod
    def validate_activity_type(cls, v: str) -> str:
        """Validate activity type."""
        if v not in ["CLUB", "EXTRA_CURRICULAR"]:
            raise ValueError("activity_type must be either 'CLUB' or 'EXTRA_CURRICULAR'")
        return v


class ClubActivityUpdate(BaseModel):
    """Schema for updating a club activity."""
    
    service_name: Optional[str] = Field(None, min_length=1, max_length=200)
    activity_type: Optional[str] = None
    cost_per_term: Optional[Decimal] = Field(None, ge=0)
    teacher_id: Optional[UUID] = None
    academic_year_id: Optional[UUID] = None
    term_id: Optional[UUID] = None
    class_ids: Optional[List[UUID]] = None
    
    @field_validator("activity_type")
    @classmethod
    def validate_activity_type(cls, v: Optional[str]) -> Optional[str]:
        """Validate activity type."""
        if v is not None and v not in ["CLUB", "EXTRA_CURRICULAR"]:
            raise ValueError("activity_type must be either 'CLUB' or 'EXTRA_CURRICULAR'")
        return v


# ============================================================================
# Club Activity Response Schemas
# ============================================================================

class ClassMinimalResponse(BaseModel):
    """Minimal class information."""
    
    id: UUID
    name: str
    
    class Config:
        from_attributes = True


class TeacherMinimalResponse(BaseModel):
    """Minimal teacher information."""
    
    id: UUID
    first_name: str
    last_name: str
    
    class Config:
        from_attributes = True


class ClubActivityResponse(BaseModel):
    """Schema for club activity response."""
    
    id: UUID
    school_id: UUID
    service_name: str
    activity_type: str
    cost_per_term: Decimal
    teacher_id: Optional[UUID]
    academic_year_id: UUID
    term_id: UUID
    created_at: str
    updated_at: str
    teacher: Optional[TeacherMinimalResponse] = None
    academic_year: Optional[dict] = None
    term: Optional[dict] = None
    classes: Optional[List[ClassMinimalResponse]] = None
    
    class Config:
        from_attributes = True


class ClubActivityListResponse(BaseModel):
    """Paginated list of club activities."""
    
    data: List[ClubActivityResponse]
    pagination: dict

