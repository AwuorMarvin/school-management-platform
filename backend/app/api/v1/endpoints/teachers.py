"""
Teacher endpoints - CRUD operations for teachers.
"""

from uuid import UUID
from datetime import datetime, UTC, timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user, require_campus_admin
from app.core.security import generate_secure_token, hash_token
from app.models.user import User
from app.models.campus import Campus
from app.models.account_setup_token import AccountSetupToken
from app.schemas.teacher import TeacherCreate, TeacherResponse

router = APIRouter()


# ============================================================================
# Create Teacher
# ============================================================================

@router.post("/teachers", response_model=dict, status_code=status.HTTP_201_CREATED)
async def create_teacher(
    teacher_data: TeacherCreate,
    current_user = Depends(require_campus_admin),
    db: AsyncSession = Depends(get_db)
) -> dict:
    """
    Create a new teacher account.
    
    Creates a User with role=TEACHER and status=PENDING_SETUP.
    Generates account setup token and sends SMS (TODO: implement SMS).
    
    Permission: SCHOOL_ADMIN, CAMPUS_ADMIN
    """
    # CAMPUS_ADMIN must provide campus_id (their campus)
    if current_user.role == "CAMPUS_ADMIN":
        if not teacher_data.campus_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "error_code": "CAMPUS_ID_REQUIRED",
                    "message": "Campus ID is required for campus admins",
                    "recovery": "Provide the campus ID"
                }
            )
        if teacher_data.campus_id != current_user.campus_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "error_code": "FORBIDDEN_ACTION",
                    "message": "You can only create teachers in your campus",
                    "recovery": "Use your campus ID"
                }
            )
    
    # If campus_id provided, verify it belongs to school
    if teacher_data.campus_id:
        campus_result = await db.execute(
            select(Campus).where(
                Campus.id == teacher_data.campus_id,
                Campus.school_id == current_user.school_id
            )
        )
        campus = campus_result.scalar_one_or_none()
        
        if not campus:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={
                    "error_code": "CAMPUS_NOT_FOUND",
                    "message": "Campus not found or does not belong to your school",
                    "recovery": "Verify the campus ID"
                }
            )
    
    # Check if email already exists in school
    existing_user_result = await db.execute(
        select(User).where(
            User.email == teacher_data.email,
            User.school_id == current_user.school_id
        )
    )
    if existing_user_result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "error_code": "EMAIL_ALREADY_EXISTS",
                "message": "Email already exists in this school",
                "recovery": "Use a different email"
            }
        )
    
    # Check if phone already exists in school
    existing_phone_result = await db.execute(
        select(User).where(
            User.phone_number == teacher_data.phone_number,
            User.school_id == current_user.school_id
        )
    )
    if existing_phone_result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "error_code": "PHONE_ALREADY_EXISTS",
                "message": "Phone number already exists in this school",
                "recovery": "Use a different phone number"
            }
        )
    
    # Create user with role=TEACHER
    new_user = User(
        school_id=current_user.school_id,
        campus_id=teacher_data.campus_id,
        email=teacher_data.email,
        phone_number=teacher_data.phone_number,
        first_name=teacher_data.first_name,
        last_name=teacher_data.last_name,
        role="TEACHER",
        status="ACTIVE",  # PENDING_SETUP is indicated by password_hash=None
        password_hash=None,
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC),
    )
    
    db.add(new_user)
    await db.flush()
    
    # Generate account setup token
    setup_token = generate_secure_token()
    token_hash = hash_token(setup_token)
    expires_at = datetime.now(UTC) + timedelta(days=7)
    
    account_setup_token = AccountSetupToken(
        user_id=new_user.id,
        token_hash=token_hash,
        expires_at=expires_at,
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC),
    )
    
    db.add(account_setup_token)
    await db.commit()
    await db.refresh(new_user)
    
    # TODO: Queue SMS with setup link
    # SMS would contain: https://portal.school.com/setup-account?token={setup_token}
    
    return {
        "id": str(new_user.id),
        "email": new_user.email,
        "phone_number": new_user.phone_number,
        "first_name": new_user.first_name,
        "last_name": new_user.last_name,
        "status": new_user.status,
        "campus_id": str(new_user.campus_id) if new_user.campus_id else None,
        "created_at": new_user.created_at.isoformat(),
        "setup_token": setup_token,  # TODO: Remove in production, only for testing
    }

