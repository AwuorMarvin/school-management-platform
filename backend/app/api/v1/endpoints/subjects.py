"""
Subject endpoints - CRUD operations for subjects (many-to-many with classes).
"""

from typing import Optional
from uuid import UUID
from datetime import datetime, UTC

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy import select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.deps import get_current_user, require_campus_admin
from app.models.subject import Subject
from app.models.class_subject import ClassSubject
from app.models import Class
from app.models.campus import Campus
from app.models.student_performance import StudentPerformance
from app.schemas.subject import (
    SubjectCreate,
    SubjectUpdate,
    SubjectResponse,
    SubjectListResponse,
)

router = APIRouter()


# ============================================================================
# List All Subjects
# ============================================================================

@router.get("/subjects", response_model=dict)
async def list_subjects(
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Number of records per page"),
    search: Optional[str] = Query(None, description="Search by subject name or code"),
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> dict:
    """
    List all subjects for the current user's school.
    
    Permission: All authenticated users
    """
    offset = (page - 1) * page_size
    
    # Build query - filter by school_id
    query = select(Subject).where(Subject.school_id == current_user.school_id)
    count_query = select(func.count(Subject.id)).where(Subject.school_id == current_user.school_id)
    
    # Apply search filter
    if search:
        search_pattern = f"%{search}%"
        query = query.where(
            or_(
                Subject.name.ilike(search_pattern),
                Subject.code.ilike(search_pattern) if Subject.code else False
            )
        )
        count_query = count_query.where(
            or_(
                Subject.name.ilike(search_pattern),
                Subject.code.ilike(search_pattern) if Subject.code else False
            )
        )
    
    # Get total count
    total = (await db.execute(count_query)).scalar_one()
    
    # Apply pagination and ordering
    query = query.order_by(Subject.name).offset(offset).limit(page_size)
    
    # Eager load class relationships
    query = query.options(selectinload(Subject.class_subjects).selectinload(ClassSubject.class_))
    
    result = await db.execute(query)
    subjects = result.scalars().all()
    
    data = []
    for subject in subjects:
        # Get classes for this subject
        classes = [cs.class_ for cs in subject.class_subjects if cs.class_]
        
        data.append({
            "id": str(subject.id),
            "school_id": str(subject.school_id),
            "name": subject.name,
            "code": subject.code,
            "created_at": subject.created_at.isoformat(),
            "updated_at": subject.updated_at.isoformat(),
            "classes": [
                {
                    "id": str(cls.id),
                    "name": cls.name,
                }
                for cls in classes
            ] if classes else [],
        })
    
    total_pages = (total + page_size - 1) // page_size
    
    return {
        "data": data,
        "pagination": {
            "page": page,
            "page_size": page_size,
            "total": total,
            "total_pages": total_pages,
            "has_next": page < total_pages,
            "has_previous": page > 1,
        }
    }


# ============================================================================
# List Subjects for a Class
# ============================================================================

@router.get("/classes/{class_id}/subjects", response_model=dict)
async def list_class_subjects(
    class_id: UUID,
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> dict:
    """
    List all subjects for a class.
    
    Permission: All authenticated users with access to this class
    """
    # Verify class exists and belongs to school
    class_result = await db.execute(
        select(Class)
        .join(Campus)
        .where(
            Class.id == class_id,
            Campus.school_id == current_user.school_id
        )
    )
    cls = class_result.scalar_one_or_none()
    
    if not cls:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error_code": "CLASS_NOT_FOUND",
                "message": "Class not found",
                "recovery": "Check the class ID"
            }
        )
    
    # Get subjects via junction table
    result = await db.execute(
        select(Subject)
        .join(ClassSubject)
        .where(ClassSubject.class_id == class_id)
        .order_by(Subject.name)
    )
    subjects = result.scalars().all()
    
    return {
        "data": [
            {
                "id": str(s.id),
                "name": s.name,
                "code": s.code,
                "created_at": s.created_at.isoformat(),
                "updated_at": s.updated_at.isoformat(),
            }
            for s in subjects
        ]
    }


# ============================================================================
# Get Subject
# ============================================================================

@router.get("/subjects/{subject_id}", response_model=dict)
async def get_subject(
    subject_id: UUID,
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> dict:
    """
    Get subject details with associated classes.
    
    Permission: All authenticated users with access to this subject
    """
    result = await db.execute(
        select(Subject)
        .where(
            Subject.id == subject_id,
            Subject.school_id == current_user.school_id
        )
        .options(selectinload(Subject.class_subjects).selectinload(ClassSubject.class_))
    )
    subject = result.scalar_one_or_none()
    
    if not subject:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error_code": "SUBJECT_NOT_FOUND",
                "message": "Subject not found",
                "recovery": "Check the subject ID"
            }
        )
    
    # Get classes for this subject
    classes = [cs.class_ for cs in subject.class_subjects if cs.class_]
    
    return {
        "id": str(subject.id),
        "school_id": str(subject.school_id),
        "name": subject.name,
        "code": subject.code,
        "created_at": subject.created_at.isoformat(),
        "updated_at": subject.updated_at.isoformat(),
        "classes": [
            {
                "id": str(cls.id),
                "name": cls.name,
            }
            for cls in classes
        ],
    }


# ============================================================================
# Create Subject
# ============================================================================

@router.post("/subjects", response_model=dict, status_code=status.HTTP_201_CREATED)
async def create_subject(
    subject_data: SubjectCreate,
    current_user = Depends(require_campus_admin),
    db: AsyncSession = Depends(get_db)
) -> dict:
    """
    Create a new subject with optional class assignments.
    
    Permission: SCHOOL_ADMIN, CAMPUS_ADMIN
    """
    # Check for duplicate code within school (if code is provided)
    if subject_data.code:
        duplicate_check = await db.execute(
            select(Subject).where(
                Subject.school_id == current_user.school_id,
                Subject.code == subject_data.code
            )
        )
        if duplicate_check.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={
                    "error_code": "DUPLICATE_SUBJECT_CODE",
                    "message": f"A subject with code '{subject_data.code}' already exists in your school",
                    "recovery": "Choose a different subject code"
                }
            )
    
    # Create subject
    subject = Subject(
        school_id=current_user.school_id,
        name=subject_data.name,
        code=subject_data.code,
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC),
    )
    
    db.add(subject)
    await db.flush()  # Get subject.id
    
    # Assign to classes if provided
    if subject_data.class_ids:
        # Verify all classes exist and belong to school
        classes_result = await db.execute(
            select(Class)
            .join(Campus)
            .where(
                Class.id.in_(subject_data.class_ids),
                Campus.school_id == current_user.school_id
            )
        )
        classes = classes_result.scalars().all()
        
        if len(classes) != len(subject_data.class_ids):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={
                    "error_code": "CLASS_NOT_FOUND",
                    "message": "One or more classes not found or do not belong to your school",
                    "recovery": "Verify all class IDs"
                }
            )
        
        # CAMPUS_ADMIN can only assign to classes in their campus
        if current_user.role == "CAMPUS_ADMIN":
            for cls in classes:
                if cls.campus_id != current_user.campus_id:
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail={
                            "error_code": "FORBIDDEN_ACTION",
                            "message": "You can only assign subjects to classes in your campus",
                            "recovery": "Contact school admin"
                        }
                    )
        
        # Create class-subject links
        for cls in classes:
            class_subject = ClassSubject(
                class_id=cls.id,
                subject_id=subject.id,
                created_at=datetime.now(UTC),
                updated_at=datetime.now(UTC),
            )
            db.add(class_subject)
    
    await db.commit()
    await db.refresh(subject)
    
    # Load classes for response
    await db.refresh(subject, ["class_subjects"])
    classes = [cs.class_ for cs in subject.class_subjects if cs.class_]
    
    return {
        "id": str(subject.id),
        "school_id": str(subject.school_id),
        "name": subject.name,
        "code": subject.code,
        "created_at": subject.created_at.isoformat(),
        "updated_at": subject.updated_at.isoformat(),
        "classes": [
            {
                "id": str(cls.id),
                "name": cls.name,
            }
            for cls in classes
        ],
    }


# ============================================================================
# Update Subject
# ============================================================================

@router.put("/subjects/{subject_id}", response_model=dict)
async def update_subject(
    subject_id: UUID,
    subject_data: SubjectUpdate,
    current_user = Depends(require_campus_admin),
    db: AsyncSession = Depends(get_db)
) -> dict:
    """
    Update subject information and class assignments.
    
    Permission: SCHOOL_ADMIN, CAMPUS_ADMIN
    """
    result = await db.execute(
        select(Subject)
        .where(
            Subject.id == subject_id,
            Subject.school_id == current_user.school_id
        )
        .options(selectinload(Subject.class_subjects).selectinload(ClassSubject.class_))
    )
    subject = result.scalar_one_or_none()
    
    if not subject:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error_code": "SUBJECT_NOT_FOUND",
                "message": "Subject not found",
                "recovery": "Check the subject ID"
            }
        )
    
    # Update fields
    update_data = subject_data.model_dump(exclude_unset=True, exclude={"class_ids"})
    
    # Check for code conflict if code is being updated
    if "code" in update_data and update_data["code"] and update_data["code"] != subject.code:
        duplicate_check = await db.execute(
            select(Subject).where(
                Subject.school_id == current_user.school_id,
                Subject.code == update_data["code"],
                Subject.id != subject_id
            )
        )
        if duplicate_check.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={
                    "error_code": "DUPLICATE_SUBJECT_CODE",
                    "message": f"A subject with code '{update_data['code']}' already exists in your school",
                    "recovery": "Choose a different subject code"
                }
            )
    
    # Apply updates
    for key, value in update_data.items():
        setattr(subject, key, value)
    
    subject.updated_at = datetime.now(UTC)
    
    # Update class assignments if provided
    if "class_ids" in subject_data.model_dump(exclude_unset=True):
        new_class_ids = set(subject_data.class_ids or [])
        
        # Verify all classes exist and belong to school
        if new_class_ids:
            classes_result = await db.execute(
                select(Class)
                .join(Campus)
                .where(
                    Class.id.in_(new_class_ids),
                    Campus.school_id == current_user.school_id
                )
            )
            classes = classes_result.scalars().all()
            
            if len(classes) != len(new_class_ids):
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail={
                        "error_code": "CLASS_NOT_FOUND",
                        "message": "One or more classes not found or do not belong to your school",
                        "recovery": "Verify all class IDs"
                    }
                )
            
            # CAMPUS_ADMIN can only assign to classes in their campus
            if current_user.role == "CAMPUS_ADMIN":
                for cls in classes:
                    if cls.campus_id != current_user.campus_id:
                        raise HTTPException(
                            status_code=status.HTTP_403_FORBIDDEN,
                            detail={
                                "error_code": "FORBIDDEN_ACTION",
                                "message": "You can only assign subjects to classes in your campus",
                                "recovery": "Contact school admin"
                            }
                        )
        
        # Replace existing class assignments with the new set.
        # Use a bulk delete to avoid issues with stale relationship state.
        await db.execute(
            ClassSubject.__table__.delete().where(ClassSubject.subject_id == subject_id)
        )
        
        # Add assignments for each new class_id
        for class_id in new_class_ids:
            class_subject = ClassSubject(
                class_id=class_id,
                subject_id=subject.id,
                created_at=datetime.now(UTC),
                updated_at=datetime.now(UTC),
            )
            db.add(class_subject)
    
    await db.commit()
    await db.refresh(subject)
    
    # Load classes for response
    await db.refresh(subject, ["class_subjects"])
    classes = [cs.class_ for cs in subject.class_subjects if cs.class_]
    
    return {
        "id": str(subject.id),
        "school_id": str(subject.school_id),
        "name": subject.name,
        "code": subject.code,
        "created_at": subject.created_at.isoformat(),
        "updated_at": subject.updated_at.isoformat(),
        "classes": [
            {
                "id": str(cls.id),
                "name": cls.name,
            }
            for cls in classes
        ],
    }


# ============================================================================
# Delete Subject
# ============================================================================

@router.delete("/subjects/{subject_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_subject(
    subject_id: UUID,
    current_user = Depends(require_campus_admin),
    db: AsyncSession = Depends(get_db)
) -> None:
    """
    Delete a subject.
    
    Permission: SCHOOL_ADMIN, CAMPUS_ADMIN
    
    Note: Cannot delete if performance records exist.
    """
    result = await db.execute(
        select(Subject).where(
            Subject.id == subject_id,
            Subject.school_id == current_user.school_id
        )
    )
    subject = result.scalar_one_or_none()
    
    if not subject:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error_code": "SUBJECT_NOT_FOUND",
                "message": "Subject not found",
                "recovery": "Check the subject ID"
            }
        )
    
    # Check if subject has performance records
    performance_check = await db.execute(
        select(StudentPerformance).where(StudentPerformance.subject_id == subject_id).limit(1)
    )
    if performance_check.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "error_code": "SUBJECT_HAS_PERFORMANCE_RECORDS",
                "message": "Cannot delete subject with existing performance records",
                "recovery": "Archive the subject instead or remove all performance records first"
            }
        )
    
    await db.delete(subject)
    await db.commit()
