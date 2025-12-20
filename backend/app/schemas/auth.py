"""
Authentication schemas - Request/Response models for auth endpoints.
"""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field, field_validator


# ============================================================================
# Login Schemas
# ============================================================================

class LoginRequest(BaseModel):
    """Login request schema."""
    
    email: EmailStr = Field(..., description="User email address")
    password: str = Field(..., min_length=1, description="User password")
    remember_me: bool = Field(default=False, description="Extend session to 30 days")


class UserResponse(BaseModel):
    """User response schema."""
    
    id: UUID
    email: str
    phone_number: str
    first_name: str
    last_name: str
    role: str
    status: str
    school_id: UUID
    campus_id: UUID | None = None


class LoginResponse(BaseModel):
    """Login response schema."""
    
    access_token: str
    refresh_token: str
    expires_in: int = Field(default=86400, description="Access token expiry in seconds")
    user: UserResponse


# ============================================================================
# Account Setup Schemas
# ============================================================================

class SetupAccountRequest(BaseModel):
    """Account setup request schema."""
    
    token: str = Field(..., description="Setup token from SMS link")
    password: str = Field(..., min_length=8, description="New password")
    password_confirmation: str = Field(..., min_length=8, description="Password confirmation")
    
    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        """Validate password meets requirements."""
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        if not any(c.isupper() for c in v):
            raise ValueError("Password must contain at least one uppercase letter")
        if not any(c.isdigit() for c in v):
            raise ValueError("Password must contain at least one number")
        if not any(c in "@$!%*?&" for c in v):
            raise ValueError("Password must contain at least one special character (@$!%*?&)")
        return v
    
    @field_validator("password_confirmation")
    @classmethod
    def validate_password_match(cls, v: str, info) -> str:
        """Validate passwords match."""
        if "password" in info.data and v != info.data["password"]:
            raise ValueError("Passwords do not match")
        return v


class SetupAccountResponse(BaseModel):
    """Account setup response schema."""
    
    access_token: str
    refresh_token: str
    expires_in: int = 86400
    user: UserResponse
    message: str = "Account setup successful! You are now logged in."


# ============================================================================
# Password Reset Schemas
# ============================================================================

class RequestPasswordResetRequest(BaseModel):
    """Request password reset schema."""
    
    email: EmailStr = Field(..., description="User email address")


class RequestPasswordResetResponse(BaseModel):
    """Request password reset response schema."""
    
    message: str = "If an account exists with this email, a password reset link has been sent."


class ResetPasswordRequest(BaseModel):
    """Reset password request schema."""
    
    token: str = Field(..., description="Reset token from email")
    password: str = Field(..., min_length=8)
    password_confirmation: str = Field(..., min_length=8)
    
    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        """Validate password meets requirements."""
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        if not any(c.isupper() for c in v):
            raise ValueError("Password must contain at least one uppercase letter")
        if not any(c.isdigit() for c in v):
            raise ValueError("Password must contain at least one number")
        if not any(c in "@$!%*?&" for c in v):
            raise ValueError("Password must contain at least one special character (@$!%*?&)")
        return v
    
    @field_validator("password_confirmation")
    @classmethod
    def validate_password_match(cls, v: str, info) -> str:
        """Validate passwords match."""
        if "password" in info.data and v != info.data["password"]:
            raise ValueError("Passwords do not match")
        return v


class ResetPasswordResponse(BaseModel):
    """Reset password response schema."""
    
    message: str = "Password reset successfully. You can now login with your new password."


# ============================================================================
# Token Refresh Schemas
# ============================================================================

class RefreshTokenRequest(BaseModel):
    """Refresh token request schema."""
    
    refresh_token: str = Field(..., description="Refresh token")


class RefreshTokenResponse(BaseModel):
    """Refresh token response schema."""
    
    access_token: str
    expires_in: int = 86400


# ============================================================================
# Logout Schemas
# ============================================================================

class LogoutRequest(BaseModel):
    """Logout request schema."""
    
    refresh_token: str = Field(..., description="Refresh token to revoke")


class LogoutResponse(BaseModel):
    """Logout response schema."""
    
    message: str = "Logged out successfully"


# ============================================================================
# Change Password Schemas
# ============================================================================

class ChangePasswordRequest(BaseModel):
    """Change password request schema."""
    
    current_password: str = Field(..., min_length=1)
    new_password: str = Field(..., min_length=8)
    new_password_confirmation: str = Field(..., min_length=8)
    
    @field_validator("new_password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        """Validate password meets requirements."""
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        if not any(c.isupper() for c in v):
            raise ValueError("Password must contain at least one uppercase letter")
        if not any(c.isdigit() for c in v):
            raise ValueError("Password must contain at least one number")
        if not any(c in "@$!%*?&" for c in v):
            raise ValueError("Password must contain at least one special character (@$!%*?&)")
        return v
    
    @field_validator("new_password_confirmation")
    @classmethod
    def validate_password_match(cls, v: str, info) -> str:
        """Validate passwords match."""
        if "new_password" in info.data and v != info.data["new_password"]:
            raise ValueError("Passwords do not match")
        return v


class ChangePasswordResponse(BaseModel):
    """Change password response schema."""
    
    message: str = "Password changed successfully. Please login again with your new password."

