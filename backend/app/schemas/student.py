"""
Student schemas - Request/Response models for student endpoints.
"""

from datetime import date
from uuid import UUID
from typing import Optional, List

from pydantic import BaseModel, Field, EmailStr, field_validator, model_validator


# ============================================================================
# Student Request Schemas
# ============================================================================

class ParentInfo(BaseModel):
    """Schema for parent information when creating a student."""
    
    first_name: str = Field(..., min_length=1, max_length=100)
    last_name: str = Field(..., min_length=1, max_length=100)
    phone_number: str = Field(..., description="Phone number (+254 format)")
    email: EmailStr = Field(..., description="Email address")
    id_number: str = Field(..., min_length=1, max_length=50, description="National ID or Passport")
    
    @field_validator("phone_number")
    @classmethod
    def validate_phone(cls, v: str) -> str:
        """Validate phone number starts with +254."""
        if not v.startswith("+254"):
            raise ValueError("Phone number must start with +254 (Kenya format)")
        return v


class StudentCreate(BaseModel):
    """Schema for creating a new student with parent information."""
    
    campus_id: UUID = Field(..., description="Campus ID where student is enrolled")
    class_id: UUID = Field(..., description="Class ID to assign student to")
    academic_year_id: UUID = Field(..., description="Academic year ID (must be active)")
    term_id: UUID = Field(..., description="Term ID (must be active)")
    first_name: str = Field(..., min_length=1, max_length=100, description="Student's first name")
    middle_name: Optional[str] = Field(None, max_length=100, description="Student's middle name")
    last_name: str = Field(..., min_length=1, max_length=100, description="Student's last name")
    date_of_birth: date = Field(..., description="Student's date of birth (YYYY-MM-DD)")
    status: str = Field(default="ACTIVE", description="Initial status (INACTIVE, ACTIVE)")
    transport_route_id: Optional[UUID] = Field(None, description="Transport route/zone ID (optional)")
    transport_type: Optional[str] = Field(
        None,
        description="Transport type: ONE_WAY or TWO_WAY (optional, defaults to TWO_WAY when route selected)",
    )
    club_activity_ids: Optional[List[UUID]] = Field(None, description="List of club/activity IDs (optional)")
    father: Optional[ParentInfo] = Field(None, description="Father information")
    mother: Optional[ParentInfo] = Field(None, description="Mother information")
    guardian: Optional[ParentInfo] = Field(None, description="Guardian information")
    
    @field_validator("status")
    @classmethod
    def validate_status(cls, v: str) -> str:
        """Validate status value."""
        allowed = ["INACTIVE", "ACTIVE"]
        if v not in allowed:
            raise ValueError(f"Status must be one of: {', '.join(allowed)}")
        return v
    
    @field_validator("date_of_birth")
    @classmethod
    def validate_date_of_birth(cls, v: date) -> date:
        """Validate date of birth is in the past."""
        if v >= date.today():
            raise ValueError("Date of birth must be in the past")
        return v
    
    @model_validator(mode='after')
    def validate_at_least_one_parent(self):
        """Validate that at least one parent is provided."""
        if not (self.father or self.mother or self.guardian):
            raise ValueError("At least one parent (father, mother, or guardian) must be provided")
        return self

    @model_validator(mode="after")
    def validate_transport(self):
        """Validate and normalise transport fields."""
        if self.transport_route_id and not self.transport_type:
            # Default to TWO_WAY if route selected but type not specified
            object.__setattr__(self, "transport_type", "TWO_WAY")
        if self.transport_type and self.transport_type not in ("ONE_WAY", "TWO_WAY"):
            raise ValueError("transport_type must be ONE_WAY or TWO_WAY")
        return self


class StudentUpdate(BaseModel):
    """Schema for updating a student."""
    
    first_name: Optional[str] = Field(None, min_length=1, max_length=100)
    middle_name: Optional[str] = Field(None, max_length=100)
    last_name: Optional[str] = Field(None, min_length=1, max_length=100)
    date_of_birth: Optional[date] = None
    campus_id: Optional[UUID] = None
    
    @field_validator("date_of_birth")
    @classmethod
    def validate_date_of_birth(cls, v: Optional[date]) -> Optional[date]:
        """Validate date of birth is in the past."""
        if v and v >= date.today():
            raise ValueError("Date of birth must be in the past")
        return v


class StudentStatusChange(BaseModel):
    """Schema for changing student status (state machine)."""
    
    status: str = Field(..., description="New status")
    reason: Optional[str] = Field(None, max_length=500, description="Reason for status change")
    
    @field_validator("status")
    @classmethod
    def validate_status(cls, v: str) -> str:
        """Validate status value."""
        allowed = ["INACTIVE", "ACTIVE", "COMPLETED", "TRANSFERRED_OUT"]
        if v not in allowed:
            raise ValueError(f"Status must be one of: {', '.join(allowed)}")
        return v


# ============================================================================
# Student Response Schemas
# ============================================================================

class StudentResponse(BaseModel):
    """Schema for student response."""
    
    id: UUID
    school_id: UUID
    campus_id: UUID
    first_name: str
    middle_name: Optional[str]
    last_name: str
    date_of_birth: date
    status: str
    created_at: str  # ISO format
    updated_at: str  # ISO format
    
    class Config:
        from_attributes = True


class StudentListResponse(BaseModel):
    """Paginated list of students."""
    
    data: List[StudentResponse]
    pagination: dict


# ============================================================================
# Student-Parent Linking Schemas
# ============================================================================

class LinkParentToStudent(BaseModel):
    """Schema for linking a parent to a student."""
    
    parent_id: UUID = Field(..., description="Parent user ID")
    role: str = Field(..., description="Parent role: FATHER, MOTHER, or GUARDIAN")
    
    @field_validator("role")
    @classmethod
    def validate_role(cls, v: str) -> str:
        """Validate parent role."""
        allowed = ["FATHER", "MOTHER", "GUARDIAN"]
        if v not in allowed:
            raise ValueError(f"Role must be one of: {', '.join(allowed)}")
        return v


class StudentParentResponse(BaseModel):
    """Schema for student-parent relationship."""
    
    student_id: UUID
    parent_id: UUID
    role: str
    parent_email: str
    parent_name: str
    created_at: str

