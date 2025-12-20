"""
Academic Performance endpoints - Grade entry and term comments.
"""

from typing import Optional
from uuid import UUID
from datetime import datetime, UTC

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.deps import get_current_user, require_campus_admin
from app.models.student import Student
from app.models.student_performance import StudentPerformance
from app.models.student_term_comment import StudentTermComment
from app.models.subject import Subject
from app.models.term import Term
from app.models import Class
from app.models.student_class_history import StudentClassHistory
from app.models.teacher_class_assignment import TeacherClassAssignment
from app.schemas.performance import (
    PerformanceEntry,
    TermCommentEntry,
    PerformanceResponse,
    PerformanceListResponse,
    PerformanceListItem,
    TermCommentResponse,
)

router = APIRouter()


# ============================================================================
# Enter/Update Subject Performance
# ============================================================================

@router.put("/students/{student_id}/performance", response_model=dict, status_code=status.HTTP_200_OK)
async def enter_performance(
    student_id: UUID,
    performance_data: PerformanceEntry,
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> dict:
    """
    Enter or update a student's performance for a subject in a term. Upsert operation.
    
    Permission: TEACHER (if assigned to class/subject), SCHOOL_ADMIN, CAMPUS_ADMIN
    """
    # Verify student exists and belongs to school
    student_result = await db.execute(
        select(Student).where(
            Student.id == student_id,
            Student.school_id == current_user.school_id
        )
    )
    student = student_result.scalar_one_or_none()
    
    if not student:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error_code": "STUDENT_NOT_FOUND",
                "message": "Student not found or does not belong to your school",
                "recovery": "Verify the student ID"
            }
        )
    
    # Verify student is assigned to a class
    active_assignment_result = await db.execute(
        select(StudentClassHistory).where(
            StudentClassHistory.student_id == student_id,
            StudentClassHistory.end_date.is_(None)
        )
    )
    active_assignment = active_assignment_result.scalar_one_or_none()
    
    if not active_assignment:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error_code": "STUDENT_NOT_IN_CLASS",
                "message": "Student is not currently assigned to any class",
                "recovery": "Assign student to a class before entering performance"
            }
        )
    
    # Verify subject exists and belongs to student's current class
    subject_result = await db.execute(
        select(Subject).where(
            Subject.id == performance_data.subject_id,
            Subject.class_id == active_assignment.class_id
        )
    )
    subject = subject_result.scalar_one_or_none()
    
    if not subject:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error_code": "SUBJECT_NOT_IN_CLASS",
                "message": "This subject does not belong to the student's current class",
                "recovery": "Select a subject from the student's class"
            }
        )
    
    # Get the class to find its academic year
    class_result = await db.execute(
        select(Class).where(Class.id == active_assignment.class_id)
    )
    cls = class_result.scalar_one_or_none()
    
    if not cls:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error_code": "CLASS_NOT_FOUND",
                "message": "Student's class not found",
                "recovery": "Verify student's class assignment"
            }
        )
    
    # Verify term exists and belongs to the class's academic year
    term_result = await db.execute(
        select(Term).where(
            Term.id == performance_data.term_id,
            Term.academic_year_id == cls.academic_year_id
        )
    )
    term = term_result.scalar_one_or_none()
    
    if not term:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error_code": "TERM_NOT_FOUND",
                "message": "Term not found or does not belong to the student's academic year",
                "recovery": "Verify the term ID"
            }
        )
    
    # Permission check: TEACHER must be assigned to this class/subject
    if current_user.role == "TEACHER":
        # Check if teacher is assigned to this class
        assignment_result = await db.execute(
            select(TeacherClassAssignment).where(
                TeacherClassAssignment.teacher_id == current_user.id,
                TeacherClassAssignment.class_id == active_assignment.class_id,
                TeacherClassAssignment.end_date.is_(None)
            )
        )
        assignment = assignment_result.scalar_one_or_none()
        
        if not assignment:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "error_code": "TEACHER_NOT_ASSIGNED",
                    "message": "You are not assigned to teach this class or subject",
                    "recovery": "Contact an administrator to get assigned to this class",
                    "details": {
                        "teacher_id": str(current_user.id),
                        "class_id": str(active_assignment.class_id),
                        "subject_id": str(performance_data.subject_id)
                    }
                }
            )
        
        # If assignment has a subject_id, it must match
        if assignment.subject_id and assignment.subject_id != performance_data.subject_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "error_code": "TEACHER_NOT_ASSIGNED",
                    "message": "You are not assigned to teach this subject",
                    "recovery": "Contact an administrator to get assigned to this subject",
                    "details": {
                        "teacher_id": str(current_user.id),
                        "class_id": str(active_assignment.class_id),
                        "subject_id": str(performance_data.subject_id)
                    }
                }
            )
    
    # Check if performance record already exists
    existing_result = await db.execute(
        select(StudentPerformance).where(
            StudentPerformance.student_id == student_id,
            StudentPerformance.subject_id == performance_data.subject_id,
            StudentPerformance.term_id == performance_data.term_id
        )
    )
    existing = existing_result.scalar_one_or_none()
    
    if existing:
        # Update existing record
        existing.grade = performance_data.grade
        existing.subject_comment = performance_data.subject_comment
        existing.entered_by_user_id = current_user.id
        existing.updated_at = datetime.now(UTC)
        performance = existing
    else:
        # Create new record
        performance = StudentPerformance(
            student_id=student_id,
            subject_id=performance_data.subject_id,
            term_id=performance_data.term_id,
            grade=performance_data.grade,
            subject_comment=performance_data.subject_comment,
            entered_by_user_id=current_user.id,
            created_at=datetime.now(UTC),
            updated_at=datetime.now(UTC),
        )
        db.add(performance)
    
    await db.commit()
    await db.refresh(performance)
    
    # Load relationships for response
    await db.refresh(performance, ["student", "subject", "term", "entered_by"])
    
    return {
        "id": f"{performance.student_id}_{performance.subject_id}_{performance.term_id}",
        "student_id": str(performance.student_id),
        "subject_id": str(performance.subject_id),
        "term_id": str(performance.term_id),
        "grade": performance.grade,
        "subject_comment": performance.subject_comment,
        "entered_by_user_id": str(performance.entered_by_user_id),
        "created_at": performance.created_at.isoformat(),
        "updated_at": performance.updated_at.isoformat(),
        "student": {
            "id": str(performance.student.id),
            "first_name": performance.student.first_name,
            "last_name": performance.student.last_name,
        } if performance.student else None,
        "subject": {
            "id": str(performance.subject.id),
            "name": performance.subject.name,
        } if performance.subject else None,
        "term": {
            "id": str(performance.term.id),
            "name": performance.term.name,
        } if performance.term else None,
        "entered_by": {
            "id": str(performance.entered_by.id),
            "first_name": performance.entered_by.first_name,
            "last_name": performance.entered_by.last_name,
        } if performance.entered_by else None,
    }


# ============================================================================
# Get Student Performance
# ============================================================================

@router.get("/students/{student_id}/performance", response_model=dict)
async def get_performance(
    student_id: UUID,
    term_id: Optional[UUID] = Query(None, description="Filter by term"),
    subject_id: Optional[UUID] = Query(None, description="Filter by subject"),
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> dict:
    """
    Get all performance records for a student.
    
    Permission: TEACHER (if assigned), SCHOOL_ADMIN, CAMPUS_ADMIN, PARENT (if own child)
    """
    # Verify student exists and belongs to school
    student_result = await db.execute(
        select(Student).where(
            Student.id == student_id,
            Student.school_id == current_user.school_id
        )
    )
    student = student_result.scalar_one_or_none()
    
    if not student:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error_code": "STUDENT_NOT_FOUND",
                "message": "Student not found",
                "recovery": "Verify the student ID"
            }
        )
    
    # TODO: Add PARENT permission check (if own child)
    # TODO: Add TEACHER permission check (if assigned to class)
    
    # Build query
    query = select(StudentPerformance).where(
        StudentPerformance.student_id == student_id
    ).options(
        selectinload(StudentPerformance.subject),
        selectinload(StudentPerformance.term),
        selectinload(StudentPerformance.entered_by)
    )
    
    # Apply filters
    if term_id:
        query = query.where(StudentPerformance.term_id == term_id)
    
    if subject_id:
        query = query.where(StudentPerformance.subject_id == subject_id)
    
    # Order by term, then subject
    query = query.order_by(StudentPerformance.term_id, StudentPerformance.subject_id)
    
    result = await db.execute(query)
    performances = result.scalars().all()
    
    data = []
    for perf in performances:
        data.append({
            "subject": {
                "id": str(perf.subject.id),
                "name": perf.subject.name,
            } if perf.subject else None,
            "term": {
                "id": str(perf.term.id),
                "name": perf.term.name,
            } if perf.term else None,
            "grade": perf.grade,
            "subject_comment": perf.subject_comment,
            "entered_by": {
                "first_name": perf.entered_by.first_name,
                "last_name": perf.entered_by.last_name,
            } if perf.entered_by else None,
            "entered_at": perf.created_at.isoformat(),
        })
    
    return {
        "student": {
            "id": str(student.id),
            "first_name": student.first_name,
            "last_name": student.last_name,
        },
        "data": data
    }


# ============================================================================
# Enter/Update Term Comment
# ============================================================================

@router.put("/students/{student_id}/term-comment", response_model=dict, status_code=status.HTTP_200_OK)
async def enter_term_comment(
    student_id: UUID,
    comment_data: TermCommentEntry,
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> dict:
    """
    Enter or update overall term comment for a student.
    
    Permission: TEACHER (if assigned to class), SCHOOL_ADMIN, CAMPUS_ADMIN
    """
    # Verify student exists and belongs to school
    student_result = await db.execute(
        select(Student).where(
            Student.id == student_id,
            Student.school_id == current_user.school_id
        )
    )
    student = student_result.scalar_one_or_none()
    
    if not student:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error_code": "STUDENT_NOT_FOUND",
                "message": "Student not found or does not belong to your school",
                "recovery": "Verify the student ID"
            }
        )
    
    # Verify student is assigned to a class
    active_assignment_result = await db.execute(
        select(StudentClassHistory).where(
            StudentClassHistory.student_id == student_id,
            StudentClassHistory.end_date.is_(None)
        )
    )
    active_assignment = active_assignment_result.scalar_one_or_none()
    
    if not active_assignment:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error_code": "STUDENT_NOT_IN_CLASS",
                "message": "Student is not currently assigned to any class",
                "recovery": "Assign student to a class before entering term comment"
            }
        )
    
    # Verify term exists
    term_result = await db.execute(
        select(Term).where(Term.id == comment_data.term_id)
    )
    term = term_result.scalar_one_or_none()
    
    if not term:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error_code": "TERM_NOT_FOUND",
                "message": "Term not found",
                "recovery": "Verify the term ID"
            }
        )
    
    # Permission check: TEACHER must be assigned to this class
    if current_user.role == "TEACHER":
        assignment_result = await db.execute(
            select(TeacherClassAssignment).where(
                TeacherClassAssignment.teacher_id == current_user.id,
                TeacherClassAssignment.class_id == active_assignment.class_id,
                TeacherClassAssignment.end_date.is_(None)
            )
        )
        assignment = assignment_result.scalar_one_or_none()
        
        if not assignment:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "error_code": "TEACHER_NOT_ASSIGNED",
                    "message": "You are not assigned to teach this class",
                    "recovery": "Contact an administrator to get assigned to this class"
                }
            )
    
    # Check if term comment already exists
    existing_result = await db.execute(
        select(StudentTermComment).where(
            StudentTermComment.student_id == student_id,
            StudentTermComment.term_id == comment_data.term_id
        )
    )
    existing = existing_result.scalar_one_or_none()
    
    if existing:
        # Update existing comment
        existing.comment = comment_data.comment
        existing.entered_by_user_id = current_user.id
        existing.updated_at = datetime.now(UTC)
        term_comment = existing
    else:
        # Create new comment
        term_comment = StudentTermComment(
            student_id=student_id,
            term_id=comment_data.term_id,
            comment=comment_data.comment,
            entered_by_user_id=current_user.id,
            created_at=datetime.now(UTC),
            updated_at=datetime.now(UTC),
        )
        db.add(term_comment)
    
    await db.commit()
    await db.refresh(term_comment)
    
    # Load relationships for response
    await db.refresh(term_comment, ["student", "term", "entered_by"])
    
    return {
        "id": f"{term_comment.student_id}_{term_comment.term_id}",
        "student_id": str(term_comment.student_id),
        "term_id": str(term_comment.term_id),
        "comment": term_comment.comment,
        "entered_by_user_id": str(term_comment.entered_by_user_id),
        "created_at": term_comment.created_at.isoformat(),
        "updated_at": term_comment.updated_at.isoformat(),
        "student": {
            "id": str(term_comment.student.id),
            "first_name": term_comment.student.first_name,
            "last_name": term_comment.student.last_name,
        } if term_comment.student else None,
        "term": {
            "id": str(term_comment.term.id),
            "name": term_comment.term.name,
        } if term_comment.term else None,
        "entered_by": {
            "id": str(term_comment.entered_by.id),
            "first_name": term_comment.entered_by.first_name,
            "last_name": term_comment.entered_by.last_name,
        } if term_comment.entered_by else None,
    }


# ============================================================================
# Get Term Comment
# ============================================================================

@router.get("/students/{student_id}/term-comment", response_model=dict)
async def get_term_comment(
    student_id: UUID,
    term_id: UUID = Query(..., description="Term ID (required)"),
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> dict:
    """
    Get term comment for a student.
    
    Permission: TEACHER (if assigned), SCHOOL_ADMIN, CAMPUS_ADMIN, PARENT (if own child)
    """
    # Verify student exists and belongs to school
    student_result = await db.execute(
        select(Student).where(
            Student.id == student_id,
            Student.school_id == current_user.school_id
        )
    )
    student = student_result.scalar_one_or_none()
    
    if not student:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error_code": "STUDENT_NOT_FOUND",
                "message": "Student not found",
                "recovery": "Verify the student ID"
            }
        )
    
    # TODO: Add PARENT permission check (if own child)
    # TODO: Add TEACHER permission check (if assigned to class)
    
    # Get term comment
    comment_result = await db.execute(
        select(StudentTermComment).where(
            StudentTermComment.student_id == student_id,
            StudentTermComment.term_id == term_id
        ).options(
            selectinload(StudentTermComment.term),
            selectinload(StudentTermComment.entered_by)
        )
    )
    term_comment = comment_result.scalar_one_or_none()
    
    if not term_comment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error_code": "TERM_COMMENT_NOT_FOUND",
                "message": "No term comment found for this student and term",
                "recovery": "Term comment has not been entered yet"
            }
        )
    
    return {
        "student": {
            "id": str(student.id),
            "first_name": student.first_name,
            "last_name": student.last_name,
        },
        "term": {
            "id": str(term_comment.term.id),
            "name": term_comment.term.name,
        } if term_comment.term else None,
        "comment": term_comment.comment,
        "entered_by": {
            "first_name": term_comment.entered_by.first_name,
            "last_name": term_comment.entered_by.last_name,
        } if term_comment.entered_by else None,
        "entered_at": term_comment.created_at.isoformat(),
    }

