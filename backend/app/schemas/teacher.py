"""
Teacher schemas - Request/Response models for teacher endpoints.
"""

from uuid import UUID
from typing import Optional

from pydantic import BaseModel, Field, EmailStr, field_validator


# ============================================================================
# Teacher Request Schemas
# ============================================================================

class TeacherCreate(BaseModel):
    """Schema for creating a new teacher."""
    
    email: EmailStr = Field(..., description="Teacher's email address")
    phone_number: str = Field(..., description="Phone number (+254 format)")
    first_name: str = Field(..., min_length=1, max_length=100, description="Teacher's first name")
    last_name: str = Field(..., min_length=1, max_length=100, description="Teacher's last name")
    campus_id: Optional[UUID] = Field(None, description="Campus ID (optional, for CAMPUS_ADMIN)")
    
    @field_validator("phone_number")
    @classmethod
    def validate_phone(cls, v: str) -> str:
        """Validate phone number starts with +254."""
        if not v.startswith("+254"):
            raise ValueError("Phone number must start with +254 (Kenya format)")
        return v


# ============================================================================
# Teacher Response Schemas
# ============================================================================

class TeacherResponse(BaseModel):
    """Schema for teacher response."""
    
    id: UUID
    email: str
    phone_number: str
    first_name: str
    last_name: str
    status: str
    campus_id: Optional[UUID]
    created_at: str  # ISO format
    
    class Config:
        from_attributes = True

