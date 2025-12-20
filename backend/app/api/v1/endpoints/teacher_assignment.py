"""
Teacher Assignment endpoints - Assign teachers to classes/subjects.
"""

from typing import Optional
from uuid import UUID
from datetime import datetime, UTC, date

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.deps import get_current_user, require_campus_admin
from app.models import Class
from app.models.campus import Campus
from app.models.teacher_class_assignment import TeacherClassAssignment
from app.models.user import User
from app.models.subject import Subject
from app.schemas.teacher_assignment import AssignTeacherToClass

router = APIRouter()


# ============================================================================
# Assign Teacher to Class
# ============================================================================

@router.post("/classes/{class_id}/teachers", response_model=dict, status_code=status.HTTP_201_CREATED)
async def assign_teacher_to_class(
    class_id: UUID,
    assignment_data: AssignTeacherToClass,
    current_user = Depends(require_campus_admin),
    db: AsyncSession = Depends(get_db)
) -> dict:
    """
    Assign a teacher to a class, optionally for a specific subject.
    
    Permission: SCHOOL_ADMIN, CAMPUS_ADMIN
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
                "message": "Class not found or does not belong to your school",
                "recovery": "Verify the class ID"
            }
        )
    
    # CAMPUS_ADMIN can only assign to classes in their campus
    if current_user.role == "CAMPUS_ADMIN":
        if current_user.campus_id != cls.campus_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "error_code": "FORBIDDEN_ACTION",
                    "message": "You can only assign teachers to classes in your campus",
                    "recovery": "Contact school admin"
                }
            )
    
    # Verify teacher exists, has role=TEACHER, and belongs to same school
    teacher_result = await db.execute(
        select(User).where(
            User.id == assignment_data.teacher_id,
            User.school_id == current_user.school_id,
            User.role == "TEACHER"
        )
    )
    teacher = teacher_result.scalar_one_or_none()
    
    if not teacher:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error_code": "TEACHER_NOT_FOUND",
                "message": "Teacher not found, does not belong to your school, or is not a teacher",
                "recovery": "Verify the teacher ID and role"
            }
        )
    
    # If subject_id provided, verify it belongs to this class
    subject = None
    if assignment_data.subject_id:
        subject_result = await db.execute(
            select(Subject).where(
                Subject.id == assignment_data.subject_id,
                Subject.class_id == class_id
            )
        )
        subject = subject_result.scalar_one_or_none()
        
        if not subject:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "error_code": "SUBJECT_NOT_IN_CLASS",
                    "message": "Subject does not belong to this class",
                    "recovery": "Select a subject from this class"
                }
            )
    
    # Note: A subject can have multiple teachers (removed single-teacher restriction)
    
    # Check for duplicate assignment (same teacher, class, subject combination)
    duplicate_query = select(TeacherClassAssignment).where(
        TeacherClassAssignment.teacher_id == assignment_data.teacher_id,
        TeacherClassAssignment.class_id == class_id,
        TeacherClassAssignment.end_date.is_(None)  # Only active assignments
    )
    
    if assignment_data.subject_id:
        duplicate_query = duplicate_query.where(
            TeacherClassAssignment.subject_id == assignment_data.subject_id
        )
    else:
        # If no subject_id, check if teacher is already assigned as class teacher (subject_id IS NULL)
        duplicate_query = duplicate_query.where(
            TeacherClassAssignment.subject_id.is_(None)
        )
    
    existing_assignment = await db.execute(duplicate_query)
    if existing_assignment.scalar_one_or_none():
        subject_name = subject.name if subject else "this class"
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "error_code": "TEACHER_ALREADY_ASSIGNED",
                "message": f"Teacher is already assigned to this class for {subject_name}",
                "recovery": "Teacher already has an active assignment for this class and subject"
            }
        )
    
    # Determine start date
    start_date = assignment_data.start_date or date.today()
    
    # Create new assignment
    new_assignment = TeacherClassAssignment(
        teacher_id=assignment_data.teacher_id,
        class_id=class_id,
        subject_id=assignment_data.subject_id,
        start_date=start_date,
        end_date=None,  # Active assignment
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC),
    )
    
    db.add(new_assignment)
    await db.commit()
    await db.refresh(new_assignment)
    
    # Load relationships for response
    await db.refresh(new_assignment, ["teacher", "subject", "class_"])
    
    return {
        "id": str(new_assignment.id),
        "teacher_id": str(new_assignment.teacher_id),
        "class_id": str(new_assignment.class_id),
        "subject_id": str(new_assignment.subject_id) if new_assignment.subject_id else None,
        "start_date": new_assignment.start_date.isoformat(),
        "end_date": None,
        "created_at": new_assignment.created_at.isoformat(),
        "updated_at": new_assignment.updated_at.isoformat(),
        "teacher": {
            "id": str(new_assignment.teacher.id),
            "first_name": new_assignment.teacher.first_name,
            "last_name": new_assignment.teacher.last_name,
            "email": new_assignment.teacher.email,
        } if new_assignment.teacher else None,
        "subject": {
            "id": str(new_assignment.subject.id),
            "name": new_assignment.subject.name,
        } if new_assignment.subject else None,
        "class": {
            "id": str(new_assignment.class_.id),
            "name": new_assignment.class_.name,
        } if new_assignment.class_ else None,
    }


# ============================================================================
# List Teachers in Class
# ============================================================================

@router.get("/classes/{class_id}/teachers", response_model=dict)
async def list_teachers_in_class(
    class_id: UUID,
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> dict:
    """
    List all teachers assigned to a class.
    
    Permission: All authenticated users with access to class
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
    
    # Get all active teacher assignments for this class
    query = select(TeacherClassAssignment).where(
        TeacherClassAssignment.class_id == class_id,
        TeacherClassAssignment.end_date.is_(None)  # Only active assignments
    ).options(
        selectinload(TeacherClassAssignment.teacher),
        selectinload(TeacherClassAssignment.subject)
    )
    
    result = await db.execute(query)
    assignments = result.scalars().all()
    
    data = []
    for assignment in assignments:
        data.append({
            "id": str(assignment.id),
            "teacher": {
                "id": str(assignment.teacher.id),
                "first_name": assignment.teacher.first_name,
                "last_name": assignment.teacher.last_name,
                "email": assignment.teacher.email,
            } if assignment.teacher else None,
            "subject": {
                "id": str(assignment.subject.id),
                "name": assignment.subject.name,
            } if assignment.subject else None,
            "start_date": assignment.start_date.isoformat(),
            "end_date": None,
        })
    
    return {
        "data": data
    }


# ============================================================================
# Remove Teacher from Class
# ============================================================================

@router.delete("/classes/{class_id}/teachers/{teacher_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_teacher_from_class(
    class_id: UUID,
    teacher_id: UUID,
    subject_id: Optional[UUID] = Query(None, description="Optional: Only remove assignment for this subject"),
    current_user = Depends(require_campus_admin),
    db: AsyncSession = Depends(get_db)
):
    """
    End teacher's assignment to this class.
    If subject_id provided, only ends that subject assignment.
    Otherwise ends all assignments for this class.
    
    Permission: SCHOOL_ADMIN, CAMPUS_ADMIN
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
    
    # CAMPUS_ADMIN can only remove from classes in their campus
    if current_user.role == "CAMPUS_ADMIN":
        if current_user.campus_id != cls.campus_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "error_code": "FORBIDDEN_ACTION",
                    "message": "You can only remove teachers from classes in your campus",
                    "recovery": "Contact school admin"
                }
            )
    
    # Find active assignment(s)
    query = select(TeacherClassAssignment).where(
        TeacherClassAssignment.teacher_id == teacher_id,
        TeacherClassAssignment.class_id == class_id,
        TeacherClassAssignment.end_date.is_(None)
    )
    
    # If subject_id provided, filter by subject
    if subject_id:
        query = query.where(TeacherClassAssignment.subject_id == subject_id)
    
    result = await db.execute(query)
    assignments = result.scalars().all()
    
    if not assignments:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error_code": "ASSIGNMENT_NOT_FOUND",
                "message": "Teacher is not currently assigned to this class" + (f" for this subject" if subject_id else ""),
                "recovery": "Teacher may have already been removed or was never assigned"
            }
        )
    
    # If removing all assignments (not just a specific subject), validate class has at least one teacher
    if not subject_id:
        # Count remaining active teachers for this class after removal
        remaining_teachers_query = select(func.count(TeacherClassAssignment.id)).where(
            TeacherClassAssignment.class_id == class_id,
            TeacherClassAssignment.end_date.is_(None),
            TeacherClassAssignment.teacher_id != teacher_id  # Exclude the teacher being removed
        )
        remaining_count = (await db.execute(remaining_teachers_query)).scalar_one() or 0
        
        if remaining_count == 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "error_code": "CLASS_MUST_HAVE_TEACHER",
                    "message": "Cannot remove teacher: Each class must have at least one teacher",
                    "recovery": "Assign another teacher to this class before removing this one"
                }
            )
    
    # End the assignment(s)
    for assignment in assignments:
        assignment.end_date = date.today()
        assignment.updated_at = datetime.now(UTC)
    
    await db.commit()

