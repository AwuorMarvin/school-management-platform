"""
FastAPI dependencies - Authentication, authorization, database.
"""

from typing import Annotated
from uuid import UUID

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.security import decode_token
from app.models.user import User

# Error messages
INVALID_CREDENTIALS = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail={
        "error_code": "INVALID_CREDENTIALS",
        "message": "Invalid email or password",
        "recovery": "Check your credentials and try again. Use 'Forgot Password?' if needed."
    }
)

AUTH_TOKEN_INVALID = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail={
        "error_code": "AUTH_TOKEN_INVALID",
        "message": "Invalid authentication token",
        "recovery": "Please login again"
    }
)

AUTH_TOKEN_EXPIRED = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail={
        "error_code": "AUTH_TOKEN_EXPIRED",
        "message": "Authentication token has expired",
        "recovery": "Please login again"
    }
)

ACCOUNT_INACTIVE = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail={
        "error_code": "ACCOUNT_INACTIVE",
        "message": "Your account has been deactivated",
        "recovery": "Contact your school administrator for assistance"
    }
)

FORBIDDEN_ACTION = HTTPException(
    status_code=status.HTTP_403_FORBIDDEN,
    detail={
        "error_code": "FORBIDDEN_ACTION",
        "message": "You don't have permission to perform this action",
        "recovery": "Contact your administrator if you need access"
    }
)


# Create HTTPBearer instance
security = HTTPBearer()

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db)
) -> User:
    """
    Get current authenticated user from JWT token.
    
    Args:
        credentials: HTTP Bearer token credentials
        db: Database session
        
    Returns:
        User model instance
        
    Raises:
        HTTPException: If token is invalid, expired, or user not found
    """
    token = credentials.credentials
    
    try:
        payload = decode_token(token)
        user_id: UUID = UUID(payload.get("sub"))
        token_type: str = payload.get("type")
        
        if token_type != "access":
            raise AUTH_TOKEN_INVALID
        
    except (JWTError, ValueError, KeyError) as e:
        raise AUTH_TOKEN_INVALID
    
    # Get user from database
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    
    if not user:
        raise AUTH_TOKEN_INVALID
    
    # Check user status
    if user.status != "ACTIVE":
        raise ACCOUNT_INACTIVE
    
    # Check password is set (account setup complete)
    if user.password_hash is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "error_code": "ACCOUNT_PENDING_SETUP",
                "message": "Account setup not completed",
                "recovery": "Please complete account setup using the link sent to your phone via SMS"
            }
        )
    
    return user


def require_role(*allowed_roles: str):
    """
    Dependency factory to require specific roles.
    
    Usage:
        @router.get("/admin-only")
        async def admin_endpoint(
            current_user: User = Depends(require_role("SCHOOL_ADMIN", "SUPER_ADMIN"))
        ):
            ...
    """
    async def role_checker(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in allowed_roles:
            raise FORBIDDEN_ACTION
        return current_user
    
    return role_checker


"""
Concrete role-based dependencies.

These are created by partially applying `require_role` so they can be used
directly with `Depends(...)`:

    current_user: User = Depends(require_school_admin)
"""

require_school_admin = require_role("SCHOOL_ADMIN", "SUPER_ADMIN")

require_campus_admin = require_role("CAMPUS_ADMIN", "SCHOOL_ADMIN", "SUPER_ADMIN")

require_teacher = require_role("TEACHER", "SCHOOL_ADMIN", "SUPER_ADMIN", "CAMPUS_ADMIN")

