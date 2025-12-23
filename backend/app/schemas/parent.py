"""
Parent schemas - Request/Response models for parent endpoints.
"""

from uuid import UUID
from typing import Optional, List

from pydantic import BaseModel, EmailStr, Field, field_validator


# ============================================================================
# Parent Request Schemas
# ============================================================================

class ParentCreate(BaseModel):
    """Schema for creating a new parent and linking to a student."""
    
    email: EmailStr = Field(..., description="Parent email address")
    phone_number: str = Field(..., description="Parent phone number (+254 format)")
    first_name: str = Field(..., min_length=1, max_length=100)
    last_name: str = Field(..., min_length=1, max_length=100)
    id_number: str = Field(..., min_length=1, max_length=50, description="National ID number")
    student_id: UUID = Field(..., description="Student ID to link this parent to")
    role: str = Field(..., description="Parent role: FATHER, MOTHER, or GUARDIAN")
    campus_id: Optional[UUID] = Field(None, description="Campus ID (optional)")
    
    @field_validator("phone_number")
    @classmethod
    def validate_phone(cls, v: str) -> str:
        """Validate phone number starts with +254."""
        if not v.startswith("+254"):
            raise ValueError("Phone number must start with +254 (Kenya format)")
        return v
    
    @field_validator("role")
    @classmethod
    def validate_role(cls, v: str) -> str:
        """Validate parent role."""
        allowed = ["FATHER", "MOTHER", "GUARDIAN"]
        if v not in allowed:
            raise ValueError(f"Role must be one of: {', '.join(allowed)}")
        return v


class ParentUpdate(BaseModel):
    """Schema for updating a parent."""
    
    first_name: Optional[str] = Field(None, min_length=1, max_length=100)
    last_name: Optional[str] = Field(None, min_length=1, max_length=100)
    phone_number: Optional[str] = None
    id_number: Optional[str] = Field(None, max_length=50)
    email: Optional[EmailStr] = None
    role: Optional[str] = Field(None, description="Parent role: FATHER, MOTHER, or GUARDIAN")
    
    @field_validator("phone_number")
    @classmethod
    def validate_phone(cls, v: Optional[str]) -> Optional[str]:
        """Validate phone number starts with +254."""
        if v and not v.startswith("+254"):
            raise ValueError("Phone number must start with +254 (Kenya format)")
        return v
    
    @field_validator("role")
    @classmethod
    def validate_role(cls, v: Optional[str]) -> Optional[str]:
        """Validate parent role on update (if provided)."""
        if v is None:
            return v
        allowed = ["FATHER", "MOTHER", "GUARDIAN"]
        if v not in allowed:
            raise ValueError(f"Role must be one of: {', '.join(allowed)}")
        return v


# ============================================================================
# Parent Response Schemas
# ============================================================================

class ParentResponse(BaseModel):
    """Schema for parent response."""
    
    id: UUID
    user_id: UUID
    school_id: UUID
    email: str
    phone_number: str
    first_name: str
    last_name: str
    id_number: str
    status: str
    created_at: str
    updated_at: str
    
    class Config:
        from_attributes = True


class ParentListResponse(BaseModel):
    """Paginated list of parents."""
    
    data: List[ParentResponse]
    pagination: dict


class ParentStudentLink(BaseModel):
    """Schema for parent's linked students."""
    
    student_id: UUID
    student_name: str
    role: str  # FATHER, MOTHER, GUARDIAN
    student_status: str
    created_at: str

