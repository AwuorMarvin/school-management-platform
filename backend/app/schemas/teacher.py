"""
Teacher schemas - Request/Response models for teacher endpoints.
"""

from datetime import date
from uuid import UUID
from typing import Optional, List

from pydantic import BaseModel, Field, EmailStr, field_validator


# ============================================================================
# Teacher Request Schemas
# ============================================================================

class TeacherCreate(BaseModel):
    """Schema for creating a new teacher."""
    
    salutation: str = Field(..., description="Mr | Mrs | Miss | Dr | Prof")
    first_name: str = Field(..., min_length=1, max_length=100, description="Teacher's first name")
    middle_name: Optional[str] = Field(None, max_length=100, description="Teacher's middle name (optional)")
    last_name: str = Field(..., min_length=1, max_length=100, description="Teacher's last name")
    phone_number: str = Field(..., description="Phone number (+254 format)")
    email: Optional[EmailStr] = Field(None, description="Email address (optional)")
    national_id: str = Field(..., min_length=1, max_length=50, description="National ID number (unique per school)")
    tsc_number: Optional[str] = Field(None, max_length=50, description="Teachers Service Commission registration number")
    date_of_birth: date = Field(..., description="Date of birth")
    gender: str = Field(..., description="MALE | FEMALE | OTHER")
    campus_id: UUID = Field(..., description="Campus ID (required)")
    
    @field_validator("phone_number")
    @classmethod
    def validate_phone(cls, v: str) -> str:
        """Validate phone number starts with +254."""
        if not v.startswith("+254"):
            raise ValueError("Phone number must start with +254 (Kenya format)")
        return v
    
    @field_validator("salutation")
    @classmethod
    def validate_salutation(cls, v: str) -> str:
        """Validate salutation."""
        allowed = ["Mr", "Mrs", "Miss", "Dr", "Prof"]
        if v not in allowed:
            raise ValueError(f"Salutation must be one of: {', '.join(allowed)}")
        return v
    
    @field_validator("gender")
    @classmethod
    def validate_gender(cls, v: str) -> str:
        """Validate gender."""
        allowed = ["MALE", "FEMALE", "OTHER"]
        if v not in allowed:
            raise ValueError(f"Gender must be one of: {', '.join(allowed)}")
        return v


class TeacherUpdate(BaseModel):
    """Schema for updating a teacher."""
    
    salutation: Optional[str] = None
    first_name: Optional[str] = Field(None, min_length=1, max_length=100)
    middle_name: Optional[str] = Field(None, max_length=100)
    last_name: Optional[str] = Field(None, min_length=1, max_length=100)
    phone_number: Optional[str] = None
    email: Optional[EmailStr] = None
    tsc_number: Optional[str] = Field(None, max_length=50)
    date_of_birth: Optional[date] = None
    gender: Optional[str] = None
    
    # Note: campus_id and national_id are immutable and cannot be updated
    
    @field_validator("phone_number")
    @classmethod
    def validate_phone(cls, v: Optional[str]) -> Optional[str]:
        """Validate phone number starts with +254."""
        if v and not v.startswith("+254"):
            raise ValueError("Phone number must start with +254 (Kenya format)")
        return v
    
    @field_validator("salutation")
    @classmethod
    def validate_salutation(cls, v: Optional[str]) -> Optional[str]:
        """Validate salutation."""
        if v:
            allowed = ["Mr", "Mrs", "Miss", "Dr", "Prof"]
            if v not in allowed:
                raise ValueError(f"Salutation must be one of: {', '.join(allowed)}")
        return v
    
    @field_validator("gender")
    @classmethod
    def validate_gender(cls, v: Optional[str]) -> Optional[str]:
        """Validate gender."""
        if v:
            allowed = ["MALE", "FEMALE", "OTHER"]
            if v not in allowed:
                raise ValueError(f"Gender must be one of: {', '.join(allowed)}")
        return v


# ============================================================================
# Assignment Request Schemas
# ============================================================================

class TeacherAssignmentCreate(BaseModel):
    """Schema for creating a teacher assignment."""
    
    class_ids: List[UUID] = Field(..., min_length=1, description="List of class IDs (at least one required)")
    subject_ids: List[UUID] = Field(..., min_length=1, description="List of subject IDs (at least one required)")
    start_date: date = Field(..., description="Start date (required)")
    end_date: Optional[date] = Field(None, description="End date (optional, NULL for active assignment)")
    override_conflicts: bool = Field(False, description="If true, end conflicting assignments from other teachers")


class TeacherAssignmentBulkCreate(BaseModel):
    """Schema for creating multiple teacher assignments."""
    
    assignments: List[TeacherAssignmentCreate] = Field(..., min_length=1, description="List of assignments")
    start_date: Optional[date] = Field(None, description="Start date for all assignments (defaults to today)")


# ============================================================================
# Teacher Response Schemas
# ============================================================================

class CampusMinimalResponse(BaseModel):
    """Minimal campus information."""
    
    id: UUID
    name: str
    
    class Config:
        from_attributes = True


class SubjectMinimalResponse(BaseModel):
    """Minimal subject information."""
    
    id: UUID
    name: str
    
    class Config:
        from_attributes = True


class ClassMinimalResponse(BaseModel):
    """Minimal class information."""
    
    id: UUID
    name: str
    
    class Config:
        from_attributes = True


class TeacherAssignmentResponse(BaseModel):
    """Schema for teacher assignment response."""
    
    id: UUID
    class_: ClassMinimalResponse = Field(..., alias="class")
    subjects: List[SubjectMinimalResponse]
    students_in_class: int
    start_date: date
    end_date: Optional[date]
    
    class Config:
        from_attributes = True
        populate_by_name = True


class TeacherAssignmentHistoryResponse(BaseModel):
    """Schema for historical teacher assignment."""
    
    id: UUID
    class_: ClassMinimalResponse = Field(..., alias="class")
    subjects: List[SubjectMinimalResponse]
    start_date: date
    end_date: date
    duration_days: int
    
    class Config:
        from_attributes = True
        populate_by_name = True


class TeacherResponse(BaseModel):
    """Schema for full teacher details."""
    
    id: UUID
    user_id: UUID
    salutation: str
    first_name: str
    middle_name: Optional[str]
    last_name: str
    phone_number: str
    email: Optional[str]
    national_id: str
    tsc_number: Optional[str]
    date_of_birth: date
    gender: str
    campus: CampusMinimalResponse
    status: str  # Computed: ACTIVE | INACTIVE
    status_reason: Optional[str] = None
    current_assignments: List[TeacherAssignmentResponse]
    assignment_history: List[TeacherAssignmentHistoryResponse]
    created_at: str
    updated_at: Optional[str]
    
    class Config:
        from_attributes = True


class TeacherListItem(BaseModel):
    """Schema for teacher list item with derived metrics."""
    
    id: UUID
    name: str  # Formatted: "{salutation} {first_name} {last_name}"
    phone_number: str
    campus: CampusMinimalResponse
    status: str  # Computed: ACTIVE | INACTIVE
    subjects_taught: int
    classes_taught: int
    total_students: int
    subject_ratio: Optional[float]  # None if subjects = 0
    
    class Config:
        from_attributes = True


class TeacherListResponse(BaseModel):
    """Paginated list of teachers."""
    
    data: List[TeacherListItem]
    pagination: dict


# ============================================================================
# Assignment Response Schemas
# ============================================================================

class AssignmentCreateResponse(BaseModel):
    """Response after creating assignment(s)."""
    
    assignments: List[TeacherAssignmentResponse]
    teacher_status: str  # Updated status after assignment


class AssignmentBulkCreateResponse(BaseModel):
    """Response after bulk creating assignments."""
    
    created_count: int
    assignments: List[TeacherAssignmentResponse]
    teacher_status: str  # Updated status after assignments


class AssignmentRemoveResponse(BaseModel):
    """Response after removing an assignment."""
    
    id: UUID
    end_date: date
    teacher_status: str  # Updated status after removal
