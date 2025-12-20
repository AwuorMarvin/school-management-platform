"""
Authentication endpoints - Login, setup, password reset, etc.
"""

from datetime import datetime, timedelta, UTC
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.deps import (
    get_current_user,
    INVALID_CREDENTIALS,
    AUTH_TOKEN_INVALID,
    ACCOUNT_INACTIVE,
)
from app.core.security import (
    hash_password,
    verify_password,
    hash_token,
    verify_token,
    create_access_token,
    create_refresh_token,
    decode_token,
    generate_secure_token,
)
from app.models.user import User
from app.models.account_setup_token import AccountSetupToken
from app.models.password_reset_token import PasswordResetToken
from app.models.refresh_token import RefreshToken
from app.schemas.auth import (
    LoginRequest,
    LoginResponse,
    UserResponse,
    SetupAccountRequest,
    SetupAccountResponse,
    RequestPasswordResetRequest,
    RequestPasswordResetResponse,
    ResetPasswordRequest,
    ResetPasswordResponse,
    RefreshTokenRequest,
    RefreshTokenResponse,
    LogoutRequest,
    LogoutResponse,
    ChangePasswordRequest,
    ChangePasswordResponse,
)

router = APIRouter()


# ============================================================================
# Login
# ============================================================================

@router.post("/login", response_model=LoginResponse, status_code=status.HTTP_200_OK)
async def login(
    request: LoginRequest,
    db: AsyncSession = Depends(get_db)
) -> LoginResponse:
    """
    Login with email and password.
    
    Returns JWT access token and refresh token.
    """
    # Find user by email (tenant-scoped)
    result = await db.execute(
        select(User).where(User.email == request.email)
    )
    user = result.scalar_one_or_none()
    
    if not user:
        raise INVALID_CREDENTIALS
    
    # Check user status
    if user.status != "ACTIVE":
        raise ACCOUNT_INACTIVE
    
    # Check password is set
    if user.password_hash is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "error_code": "ACCOUNT_PENDING_SETUP",
                "message": "Account setup not completed",
                "recovery": "Please complete account setup using the link sent to your phone via SMS"
            }
        )
    
    # Verify password
    if not verify_password(request.password, user.password_hash):
        raise INVALID_CREDENTIALS
    
    # Generate tokens
    token_data = {
        "sub": str(user.id),
        "school_id": str(user.school_id),
        "role": user.role,
        "email": user.email
    }
    
    access_token = create_access_token(token_data)
    refresh_token = create_refresh_token(token_data, remember_me=request.remember_me)
    
    # Store refresh token in database
    refresh_token_hash = hash_token(refresh_token)
    expires_at = datetime.now(UTC) + (
        timedelta(days=settings.JWT_REFRESH_TOKEN_EXPIRE_DAYS) if request.remember_me
        else timedelta(hours=settings.JWT_REFRESH_TOKEN_EXPIRE_HOURS)
    )
    
    db_refresh_token = RefreshToken(
        user_id=user.id,
        token_hash=refresh_token_hash,
        expires_at=expires_at
    )
    db.add(db_refresh_token)
    
    # Update last login
    user.last_login_at = datetime.now(UTC)
    
    await db.commit()
    
    return LoginResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        expires_in=86400,
        user=UserResponse(
            id=user.id,
            email=user.email,
            phone_number=user.phone_number,
            first_name=user.first_name,
            last_name=user.last_name,
            role=user.role,
            status=user.status,
            school_id=user.school_id,
            campus_id=user.campus_id
        )
    )


# ============================================================================
# Account Setup
# ============================================================================

@router.post("/setup-account", response_model=SetupAccountResponse, status_code=status.HTTP_200_OK)
async def setup_account(
    request: SetupAccountRequest,
    db: AsyncSession = Depends(get_db)
) -> SetupAccountResponse:
    """
    Complete first-time account setup with password.
    
    Uses setup token from SMS link.
    """
    # Find token (hash the provided token and search)
    token_hash = hash_token(request.token)
    
    result = await db.execute(
        select(AccountSetupToken).where(AccountSetupToken.token_hash == token_hash)
    )
    setup_token = result.scalar_one_or_none()
    
    if not setup_token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error_code": "INVALID_TOKEN",
                "message": "Setup token is invalid or not found",
                "recovery": "Contact your school administrator to receive a new setup link"
            }
        )
    
    # Check token not expired
    if setup_token.expires_at < datetime.now(UTC):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error_code": "TOKEN_EXPIRED",
                "message": "This setup link has expired",
                "recovery": "Contact your school administrator to receive a new setup link"
            }
        )
    
    # Check token not used
    if setup_token.used_at is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error_code": "TOKEN_ALREADY_USED",
                "message": "This setup link has already been used",
                "recovery": "Your account is already set up. Use the login page to sign in."
            }
        )
    
    # Get user
    user = await db.get(User, setup_token.user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"error_code": "USER_NOT_FOUND", "message": "User not found"}
        )
    
    # Set password
    user.password_hash = hash_password(request.password)
    user.status = "ACTIVE"
    
    # Mark token as used
    setup_token.used_at = datetime.now(UTC)
    
    # Generate tokens (auto-login)
    token_data = {
        "sub": str(user.id),
        "school_id": str(user.school_id),
        "role": user.role,
        "email": user.email
    }
    
    access_token = create_access_token(token_data)
    refresh_token = create_refresh_token(token_data, remember_me=False)
    
    # Store refresh token
    refresh_token_hash = hash_token(refresh_token)
    expires_at = datetime.now(UTC) + timedelta(hours=settings.JWT_REFRESH_TOKEN_EXPIRE_HOURS)
    
    db_refresh_token = RefreshToken(
        user_id=user.id,
        token_hash=refresh_token_hash,
        expires_at=expires_at
    )
    db.add(db_refresh_token)
    
    await db.commit()
    
    return SetupAccountResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        expires_in=86400,
        user=UserResponse(
            id=user.id,
            email=user.email,
            phone_number=user.phone_number,
            first_name=user.first_name,
            last_name=user.last_name,
            role=user.role,
            status=user.status,
            school_id=user.school_id,
            campus_id=user.campus_id
        )
    )


# ============================================================================
# Password Reset
# ============================================================================

@router.post("/request-password-reset", response_model=RequestPasswordResetResponse)
async def request_password_reset(
    request: RequestPasswordResetRequest,
    db: AsyncSession = Depends(get_db)
) -> RequestPasswordResetResponse:
    """
    Request password reset link (sent via email).
    
    Always returns success to prevent email enumeration.
    """
    # Find user by email
    result = await db.execute(
        select(User).where(User.email == request.email)
    )
    user = result.scalar_one_or_none()
    
    if user:
        # Generate reset token
        token = generate_secure_token()
        token_hash = hash_token(token)
        expires_at = datetime.now(UTC) + timedelta(hours=settings.PASSWORD_RESET_TOKEN_EXPIRE_HOURS)
        
        # Store token
        reset_token = PasswordResetToken(
            user_id=user.id,
            token_hash=token_hash,
            expires_at=expires_at
        )
        db.add(reset_token)
        await db.commit()
        
        # TODO: Send email with reset link
        # email_service.send_password_reset(user.email, token)
    
    # Always return success (security best practice)
    return RequestPasswordResetResponse()


@router.post("/reset-password", response_model=ResetPasswordResponse)
async def reset_password(
    request: ResetPasswordRequest,
    db: AsyncSession = Depends(get_db)
) -> ResetPasswordResponse:
    """
    Reset password using token from email.
    """
    # Find token
    token_hash = hash_token(request.token)
    
    result = await db.execute(
        select(PasswordResetToken).where(PasswordResetToken.token_hash == token_hash)
    )
    reset_token = result.scalar_one_or_none()
    
    if not reset_token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error_code": "INVALID_TOKEN",
                "message": "Reset token is invalid or not found",
                "recovery": "Request a new password reset link"
            }
        )
    
    # Check not expired
    if reset_token.expires_at < datetime.now(UTC):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error_code": "TOKEN_EXPIRED",
                "message": "This password reset link has expired",
                "recovery": "Request a new password reset link. Links are valid for 1 hour."
            }
        )
    
    # Check not used
    if reset_token.used_at is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error_code": "TOKEN_ALREADY_USED",
                "message": "This reset link has already been used",
                "recovery": "If you need to reset your password again, request a new link"
            }
        )
    
    # Get user
    user = await db.get(User, reset_token.user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"error_code": "USER_NOT_FOUND", "message": "User not found"}
        )
    
    # Update password
    user.password_hash = hash_password(request.password)
    reset_token.used_at = datetime.now(UTC)
    
    # Revoke all refresh tokens (force re-login)
    await db.execute(
        select(RefreshToken).where(RefreshToken.user_id == user.id)
    )
    # Mark all as revoked
    result = await db.execute(
        select(RefreshToken).where(
            RefreshToken.user_id == user.id,
            RefreshToken.revoked_at.is_(None)
        )
    )
    tokens = result.scalars().all()
    for token in tokens:
        token.revoked_at = datetime.now(UTC)
    
    await db.commit()
    
    return ResetPasswordResponse()


# ============================================================================
# Token Refresh
# ============================================================================

@router.post("/refresh", response_model=RefreshTokenResponse)
async def refresh_token(
    request: RefreshTokenRequest,
    db: AsyncSession = Depends(get_db)
) -> RefreshTokenResponse:
    """
    Get new access token using refresh token.
    """
    try:
        payload = decode_token(request.refresh_token)
        user_id = UUID(payload.get("sub"))
        token_type = payload.get("type")
        
        if token_type != "refresh":
            raise AUTH_TOKEN_INVALID
        
    except (JWTError, ValueError, KeyError):
        raise AUTH_TOKEN_INVALID
    
    # Check token in database
    token_hash = hash_token(request.refresh_token)
    result = await db.execute(
        select(RefreshToken).where(RefreshToken.token_hash == token_hash)
    )
    db_token = result.scalar_one_or_none()
    
    if not db_token or db_token.revoked_at is not None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "error_code": "AUTH_TOKEN_REVOKED",
                "message": "Refresh token has been revoked",
                "recovery": "Please login again"
            }
        )
    
    if db_token.expires_at < datetime.now(UTC):
        raise AUTH_TOKEN_EXPIRED
    
    # Get user
    user = await db.get(User, user_id)
    if not user or user.status != "ACTIVE":
        raise AUTH_TOKEN_INVALID
    
    # Generate new access token
    token_data = {
        "sub": str(user.id),
        "school_id": str(user.school_id),
        "role": user.role,
        "email": user.email
    }
    
    access_token = create_access_token(token_data)
    
    return RefreshTokenResponse(access_token=access_token, expires_in=86400)


# ============================================================================
# Logout
# ============================================================================

@router.post("/logout", response_model=LogoutResponse)
async def logout(
    request: LogoutRequest,
    db: AsyncSession = Depends(get_db)
) -> LogoutResponse:
    """
    Logout and revoke refresh token.
    """
    token_hash = hash_token(request.refresh_token)
    result = await db.execute(
        select(RefreshToken).where(RefreshToken.token_hash == token_hash)
    )
    db_token = result.scalar_one_or_none()
    
    if db_token:
        db_token.revoked_at = datetime.now(UTC)
        await db.commit()
    
    return LogoutResponse()


# ============================================================================
# Change Password
# ============================================================================

@router.post("/change-password", response_model=ChangePasswordResponse)
async def change_password(
    request: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> ChangePasswordResponse:
    """
    Change password while logged in.
    """
    # Verify current password
    if not verify_password(request.current_password, current_user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "error_code": "INVALID_CREDENTIALS",
                "message": "Current password is incorrect",
                "recovery": "Enter your correct current password"
            }
        )
    
    # Check new password is different
    if verify_password(request.new_password, current_user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error_code": "SAME_AS_OLD_PASSWORD",
                "message": "New password cannot be the same as current password",
                "recovery": "Choose a different password"
            }
        )
    
    # Update password
    current_user.password_hash = hash_password(request.new_password)
    
    # Revoke all refresh tokens (force re-login)
    result = await db.execute(
        select(RefreshToken).where(
            RefreshToken.user_id == current_user.id,
            RefreshToken.revoked_at.is_(None)
        )
    )
    tokens = result.scalars().all()
    for token in tokens:
        token.revoked_at = datetime.now(UTC)
    
    await db.commit()
    
    return ChangePasswordResponse()


# ============================================================================
# Get Current User
# ============================================================================

@router.get("/me", response_model=UserResponse)
async def get_me(
    current_user: User = Depends(get_current_user)
) -> UserResponse:
    """
    Get current authenticated user details.
    """
    return UserResponse(
        id=current_user.id,
        email=current_user.email,
        phone_number=current_user.phone_number,
        first_name=current_user.first_name,
        last_name=current_user.last_name,
        role=current_user.role,
        status=current_user.status,
        school_id=current_user.school_id,
        campus_id=current_user.campus_id
    )

