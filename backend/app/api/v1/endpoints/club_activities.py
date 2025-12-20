"""
Club Activity endpoints - CRUD operations for clubs and extra-curricular activities.
"""

from typing import List, Optional
from uuid import UUID
from datetime import datetime, UTC

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy import select, and_, or_, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.deps import get_current_user, require_school_admin
from app.models.club_activity import ClubActivity
from app.models.club_activity_class import ClubActivityClass
from app.models.user import User
from app.models.academic_year import AcademicYear
from app.models.term import Term
from app.models.campus import Campus
from app.models import Class
from app.schemas.club_activity import (
    ClubActivityCreate,
    ClubActivityUpdate,
    ClubActivityResponse,
    ClubActivityListResponse,
)

router = APIRouter()


# ============================================================================
# List Club Activities
# ============================================================================

@router.get("/club-activities", response_model=ClubActivityListResponse)
async def list_club_activities(
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(100, ge=1, le=1000, description="Number of records to return"),
    activity_type: Optional[str] = Query(None, description="Filter by type (CLUB or EXTRA_CURRICULAR)"),
    academic_year_id: Optional[UUID] = Query(None, description="Filter by academic year"),
    term_id: Optional[UUID] = Query(None, description="Filter by term"),
    search: Optional[str] = Query(None, description="Search by service name"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> ClubActivityListResponse:
    """
    List club activities with filtering and pagination.
    
    Permission: All authenticated users
    """
    query = select(ClubActivity).where(ClubActivity.school_id == current_user.school_id)
    
    if activity_type:
        if activity_type not in ["CLUB", "EXTRA_CURRICULAR"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"error_code": "INVALID_ACTIVITY_TYPE", "message": "activity_type must be CLUB or EXTRA_CURRICULAR"}
            )
        query = query.where(ClubActivity.activity_type == activity_type)
    
    if academic_year_id:
        query = query.where(ClubActivity.academic_year_id == academic_year_id)
    
    if term_id:
        query = query.where(ClubActivity.term_id == term_id)
    
    if search:
        query = query.where(ClubActivity.service_name.ilike(f"%{search}%"))
    
    # Get total count with same filters
    count_query = select(func.count(ClubActivity.id)).where(ClubActivity.school_id == current_user.school_id)
    if activity_type:
        count_query = count_query.where(ClubActivity.activity_type == activity_type)
    if academic_year_id:
        count_query = count_query.where(ClubActivity.academic_year_id == academic_year_id)
    if term_id:
        count_query = count_query.where(ClubActivity.term_id == term_id)
    if search:
        count_query = count_query.where(ClubActivity.service_name.ilike(f"%{search}%"))
    
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0
    
    # Apply pagination
    query = query.offset(skip).limit(limit)
    
    # Load relationships
    query = query.options(
        selectinload(ClubActivity.teacher),
        selectinload(ClubActivity.academic_year),
        selectinload(ClubActivity.term),
        selectinload(ClubActivity.class_activities).selectinload(ClubActivityClass.class_)
    )
    
    result = await db.execute(query)
    activities = result.scalars().all()
    
    # Format response
    data = []
    for activity in activities:
        classes = [ca.class_ for ca in activity.class_activities]
        data.append({
            "id": activity.id,
            "school_id": activity.school_id,
            "service_name": activity.service_name,
            "activity_type": activity.activity_type,
            "cost_per_term": activity.cost_per_term,
            "teacher_id": activity.teacher_id,
            "academic_year_id": activity.academic_year_id,
            "term_id": activity.term_id,
            "created_at": activity.created_at.isoformat(),
            "updated_at": activity.updated_at.isoformat(),
            "teacher": {
                "id": activity.teacher.id,
                "first_name": activity.teacher.first_name,
                "last_name": activity.teacher.last_name,
            } if activity.teacher else None,
            "academic_year": {
                "id": activity.academic_year.id,
                "name": activity.academic_year.name,
            } if activity.academic_year else None,
            "term": {
                "id": activity.term.id,
                "name": activity.term.name,
            } if activity.term else None,
            "classes": [{"id": c.id, "name": c.name} for c in classes] if classes else None,
        })
    
    return ClubActivityListResponse(
        data=data,
        pagination={
            "page": (skip // limit) + 1,
            "page_size": limit,
            "total": total,
            "total_pages": (total + limit - 1) // limit if total > 0 else 0,
            "has_next": (skip + limit) < total,
            "has_previous": skip > 0,
        }
    )


# ============================================================================
# Get Club Activity
# ============================================================================

@router.get("/club-activities/{activity_id}", response_model=ClubActivityResponse)
async def get_club_activity(
    activity_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> ClubActivityResponse:
    """
    Get a single club activity by ID.
    
    Permission: All authenticated users
    """
    result = await db.execute(
        select(ClubActivity)
        .where(
            ClubActivity.id == activity_id,
            ClubActivity.school_id == current_user.school_id
        )
        .options(
            selectinload(ClubActivity.teacher),
            selectinload(ClubActivity.academic_year),
            selectinload(ClubActivity.term),
            selectinload(ClubActivity.class_activities).selectinload(ClubActivityClass.class_)
        )
    )
    activity = result.scalar_one_or_none()
    
    if not activity:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error_code": "CLUB_ACTIVITY_NOT_FOUND", "message": "Club activity not found"}
        )
    
    classes = [ca.class_ for ca in activity.class_activities]
    
    return ClubActivityResponse(
        id=activity.id,
        school_id=activity.school_id,
        service_name=activity.service_name,
        activity_type=activity.activity_type,
        cost_per_term=activity.cost_per_term,
        teacher_id=activity.teacher_id,
        academic_year_id=activity.academic_year_id,
        term_id=activity.term_id,
        created_at=activity.created_at.isoformat(),
        updated_at=activity.updated_at.isoformat(),
        teacher={
            "id": activity.teacher.id,
            "first_name": activity.teacher.first_name,
            "last_name": activity.teacher.last_name,
        } if activity.teacher else None,
        academic_year={
            "id": activity.academic_year.id,
            "name": activity.academic_year.name,
        } if activity.academic_year else None,
        term={
            "id": activity.term.id,
            "name": activity.term.name,
        } if activity.term else None,
        classes=[{"id": c.id, "name": c.name} for c in classes] if classes else None,
    )


# ============================================================================
# Create Club Activity
# ============================================================================

@router.post("/club-activities", response_model=ClubActivityResponse, status_code=status.HTTP_201_CREATED)
async def create_club_activity(
    activity_data: ClubActivityCreate,
    current_user: User = Depends(require_school_admin),
    db: AsyncSession = Depends(get_db)
) -> ClubActivityResponse:
    """
    Create a new club activity.
    
    Permission: SCHOOL_ADMIN, SUPER_ADMIN
    """
    # Validate academic year
    academic_year_result = await db.execute(
        select(AcademicYear).where(
            AcademicYear.id == activity_data.academic_year_id,
            AcademicYear.school_id == current_user.school_id
        )
    )
    academic_year = academic_year_result.scalar_one_or_none()
    
    if not academic_year:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error_code": "ACADEMIC_YEAR_NOT_FOUND", "message": "Academic year not found"}
        )
    
    # Validate term belongs to academic year
    term_result = await db.execute(
        select(Term).where(
            Term.id == activity_data.term_id,
            Term.academic_year_id == activity_data.academic_year_id
        )
    )
    term = term_result.scalar_one_or_none()
    
    if not term:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"error_code": "TERM_NOT_IN_ACADEMIC_YEAR", "message": "Term does not belong to the selected academic year"}
        )
    
    # Validate teacher if provided
    if activity_data.teacher_id:
        teacher_result = await db.execute(
            select(User).where(
                User.id == activity_data.teacher_id,
                User.school_id == current_user.school_id,
                User.role == "TEACHER"
            )
        )
        teacher = teacher_result.scalar_one_or_none()
        
        if not teacher:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"error_code": "TEACHER_NOT_FOUND", "message": "Teacher not found or is not a teacher"}
            )
    
    # Create club activity
    activity = ClubActivity(
        school_id=current_user.school_id,
        service_name=activity_data.service_name,
        activity_type=activity_data.activity_type,
        cost_per_term=activity_data.cost_per_term,
        teacher_id=activity_data.teacher_id,
        academic_year_id=activity_data.academic_year_id,
        term_id=activity_data.term_id,
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC),
    )
    
    db.add(activity)
    await db.flush()
    
    # Link classes if provided
    if activity_data.class_ids:
        # Validate classes belong to school
        classes_result = await db.execute(
            select(Class)
            .join(Campus)
            .where(
                Class.id.in_(activity_data.class_ids),
                Campus.school_id == current_user.school_id
            )
        )
        classes = classes_result.scalars().all()
        
        if len(classes) != len(activity_data.class_ids):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"error_code": "CLASS_NOT_FOUND", "message": "One or more classes not found"}
            )
        
        for class_ in classes:
            club_activity_class = ClubActivityClass(
                club_activity_id=activity.id,
                class_id=class_.id,
                created_at=datetime.now(UTC),
                updated_at=datetime.now(UTC),
            )
            db.add(club_activity_class)
    
    await db.commit()
    await db.refresh(activity)
    
    # Load relationships for response
    result = await db.execute(
        select(ClubActivity)
        .where(ClubActivity.id == activity.id)
        .options(
            selectinload(ClubActivity.teacher),
            selectinload(ClubActivity.academic_year),
            selectinload(ClubActivity.term),
            selectinload(ClubActivity.class_activities).selectinload(ClubActivityClass.class_)
        )
    )
    activity = result.scalar_one()
    
    classes = [ca.class_ for ca in activity.class_activities]
    
    return ClubActivityResponse(
        id=activity.id,
        school_id=activity.school_id,
        service_name=activity.service_name,
        activity_type=activity.activity_type,
        cost_per_term=activity.cost_per_term,
        teacher_id=activity.teacher_id,
        academic_year_id=activity.academic_year_id,
        term_id=activity.term_id,
        created_at=activity.created_at.isoformat(),
        updated_at=activity.updated_at.isoformat(),
        teacher={
            "id": activity.teacher.id,
            "first_name": activity.teacher.first_name,
            "last_name": activity.teacher.last_name,
        } if activity.teacher else None,
        academic_year={
            "id": activity.academic_year.id,
            "name": activity.academic_year.name,
        } if activity.academic_year else None,
        term={
            "id": activity.term.id,
            "name": activity.term.name,
        } if activity.term else None,
        classes=[{"id": c.id, "name": c.name} for c in classes] if classes else None,
    )


# ============================================================================
# Update Club Activity
# ============================================================================

@router.put("/club-activities/{activity_id}", response_model=ClubActivityResponse)
async def update_club_activity(
    activity_id: UUID,
    activity_data: ClubActivityUpdate,
    current_user: User = Depends(require_school_admin),
    db: AsyncSession = Depends(get_db)
) -> ClubActivityResponse:
    """
    Update a club activity.
    
    Permission: SCHOOL_ADMIN, SUPER_ADMIN
    """
    result = await db.execute(
        select(ClubActivity).where(
            ClubActivity.id == activity_id,
            ClubActivity.school_id == current_user.school_id
        )
    )
    activity = result.scalar_one_or_none()
    
    if not activity:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error_code": "CLUB_ACTIVITY_NOT_FOUND", "message": "Club activity not found"}
        )
    
    # Update fields
    if activity_data.service_name is not None:
        activity.service_name = activity_data.service_name
    if activity_data.activity_type is not None:
        activity.activity_type = activity_data.activity_type
    if activity_data.cost_per_term is not None:
        activity.cost_per_term = activity_data.cost_per_term
    if activity_data.teacher_id is not None:
        # Validate teacher
        if activity_data.teacher_id:
            teacher_result = await db.execute(
                select(User).where(
                    User.id == activity_data.teacher_id,
                    User.school_id == current_user.school_id,
                    User.role == "TEACHER"
                )
            )
            teacher = teacher_result.scalar_one_or_none()
            
            if not teacher:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail={"error_code": "TEACHER_NOT_FOUND", "message": "Teacher not found or is not a teacher"}
                )
        activity.teacher_id = activity_data.teacher_id
    if activity_data.academic_year_id is not None:
        # Validate academic year
        academic_year_result = await db.execute(
            select(AcademicYear).where(
                AcademicYear.id == activity_data.academic_year_id,
                AcademicYear.school_id == current_user.school_id
            )
        )
        academic_year = academic_year_result.scalar_one_or_none()
        
        if not academic_year:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"error_code": "ACADEMIC_YEAR_NOT_FOUND", "message": "Academic year not found"}
            )
        activity.academic_year_id = activity_data.academic_year_id
    if activity_data.term_id is not None:
        # Validate term belongs to academic year
        academic_year_id = activity_data.academic_year_id or activity.academic_year_id
        term_result = await db.execute(
            select(Term).where(
                Term.id == activity_data.term_id,
                Term.academic_year_id == academic_year_id
            )
        )
        term = term_result.scalar_one_or_none()
        
        if not term:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"error_code": "TERM_NOT_IN_ACADEMIC_YEAR", "message": "Term does not belong to the academic year"}
            )
        activity.term_id = activity_data.term_id
    
    activity.updated_at = datetime.now(UTC)
    
    # Update class associations if provided
    if activity_data.class_ids is not None:
        # Remove existing associations using bulk delete to avoid relationship state issues
        await db.execute(
            ClubActivityClass.__table__.delete().where(ClubActivityClass.club_activity_id == activity.id)
        )
        
        # Add new associations
        if activity_data.class_ids:
            classes_result = await db.execute(
                select(Class)
                .join(Campus)
                .where(
                    Class.id.in_(activity_data.class_ids),
                    Campus.school_id == current_user.school_id
                )
            )
            classes = classes_result.scalars().all()
            
            if len(classes) != len(activity_data.class_ids):
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail={"error_code": "CLASS_NOT_FOUND", "message": "One or more classes not found"}
                )
            
            for class_ in classes:
                club_activity_class = ClubActivityClass(
                    club_activity_id=activity.id,
                    class_id=class_.id,
                    created_at=datetime.now(UTC),
                    updated_at=datetime.now(UTC),
                )
                db.add(club_activity_class)
    
    await db.commit()
    await db.refresh(activity)
    
    # Load relationships for response
    result = await db.execute(
        select(ClubActivity)
        .where(ClubActivity.id == activity.id)
        .options(
            selectinload(ClubActivity.teacher),
            selectinload(ClubActivity.academic_year),
            selectinload(ClubActivity.term),
            selectinload(ClubActivity.class_activities).selectinload(ClubActivityClass.class_)
        )
    )
    activity = result.scalar_one()
    
    classes = [ca.class_ for ca in activity.class_activities]
    
    return ClubActivityResponse(
        id=activity.id,
        school_id=activity.school_id,
        service_name=activity.service_name,
        activity_type=activity.activity_type,
        cost_per_term=activity.cost_per_term,
        teacher_id=activity.teacher_id,
        academic_year_id=activity.academic_year_id,
        term_id=activity.term_id,
        created_at=activity.created_at.isoformat(),
        updated_at=activity.updated_at.isoformat(),
        teacher={
            "id": activity.teacher.id,
            "first_name": activity.teacher.first_name,
            "last_name": activity.teacher.last_name,
        } if activity.teacher else None,
        academic_year={
            "id": activity.academic_year.id,
            "name": activity.academic_year.name,
        } if activity.academic_year else None,
        term={
            "id": activity.term.id,
            "name": activity.term.name,
        } if activity.term else None,
        classes=[{"id": c.id, "name": c.name} for c in classes] if classes else None,
    )


# ============================================================================
# Delete Club Activity
# ============================================================================

@router.delete("/club-activities/{activity_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_club_activity(
    activity_id: UUID,
    current_user: User = Depends(require_school_admin),
    db: AsyncSession = Depends(get_db)
):
    """
    Delete a club activity.
    
    Permission: SCHOOL_ADMIN, SUPER_ADMIN
    """
    result = await db.execute(
        select(ClubActivity).where(
            ClubActivity.id == activity_id,
            ClubActivity.school_id == current_user.school_id
        )
    )
    activity = result.scalar_one_or_none()
    
    if not activity:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error_code": "CLUB_ACTIVITY_NOT_FOUND", "message": "Club activity not found"}
        )
    
    db.delete(activity)
    await db.commit()

