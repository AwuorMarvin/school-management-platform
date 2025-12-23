"""
Fee Summary endpoints - Campus, class, and student-level fee summaries with drill-down.
"""

from typing import Optional
from uuid import UUID
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy import select, func, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.deps import get_current_user, require_campus_admin
from app.models.user import User
from app.models.campus import Campus
from app.models import Class
from app.models.student import Student
from app.models.fee import Fee
from app.models.term import Term
from app.models.academic_year import AcademicYear
from app.models.student_class_history import StudentClassHistory
from app.models.teacher_class_assignment import TeacherClassAssignment
from app.models.student_parent import StudentParent
from app.services.fee_calculation import calculate_student_fee_from_student

router = APIRouter()


# ============================================================================
# Get Active Academic Year and Term
# ============================================================================

async def get_active_academic_year_and_term(
    db: AsyncSession,
    school_id: UUID
) -> tuple:
    """
    Get the active academic year and term for a school.
    
    Returns:
        Tuple of (academic_year, term) or (None, None) if not found
    """
    from datetime import date
    
    # Get current date
    today = date.today()
    
    # Find active academic year (where today is between start_date and end_date)
    academic_year_result = await db.execute(
        select(AcademicYear)
        .where(
            AcademicYear.school_id == school_id,
            AcademicYear.start_date <= today,
            AcademicYear.end_date >= today
        )
        .order_by(AcademicYear.start_date.desc())
        .limit(1)
    )
    academic_year = academic_year_result.scalar_one_or_none()
    
    if not academic_year:
        return (None, None)
    
    # Find active term (where today is between start_date and end_date)
    term_result = await db.execute(
        select(Term)
        .where(
            Term.academic_year_id == academic_year.id,
            Term.start_date <= today,
            Term.end_date >= today
        )
        .order_by(Term.start_date.desc())
        .limit(1)
    )
    term = term_result.scalar_one_or_none()
    
    return (academic_year, term)


# ============================================================================
# Campus-Level Fee Summary
# ============================================================================

@router.get("/fees/summary/campus")
async def get_campus_fee_summary(
    term_id: Optional[UUID] = Query(None, description="Term ID (uses active term if not provided)"),
    campus_id: Optional[UUID] = Query(None, description="Filter by specific campus (for Campus Admin)"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get campus-level fee summary.
    
    Permission: All authenticated users (scope-filtered)
    - School Admin: All campuses
    - Campus Admin: Only their campus
    - Teacher: Only campuses with their classes
    - Parent: Only campuses with their children
    """
    # Get active term if not provided
    if not term_id:
        academic_year, term = await get_active_academic_year_and_term(db, current_user.school_id)
        if not term:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"error_code": "NO_ACTIVE_TERM", "message": "No active term found"}
            )
        term_id = term.id
        active_academic_year_name = academic_year.name if academic_year else None
    else:
        # Validate term exists
        term_result = await db.execute(
            select(Term).where(Term.id == term_id)
        )
        term = term_result.scalar_one_or_none()
        if not term:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"error_code": "TERM_NOT_FOUND", "message": "Term not found"}
            )
        # Look up academic year name explicitly to avoid lazy-loading relationships
        ay_result = await db.execute(
            select(AcademicYear.name).where(AcademicYear.id == term.academic_year_id)
        )
        active_academic_year_name = ay_result.scalar_one_or_none()
    
    # Build campus query based on role
    campus_query = select(Campus).where(Campus.school_id == current_user.school_id)
    
    if current_user.role == "CAMPUS_ADMIN":
        # Campus Admin: Only their campus
        campus_query = campus_query.where(Campus.id == current_user.campus_id)
    elif current_user.role == "TEACHER":
        # Teacher: Only campuses with their assigned classes
        class_assignments_result = await db.execute(
            select(TeacherClassAssignment).where(TeacherClassAssignment.teacher_id == current_user.id)
        )
        class_assignments = class_assignments_result.scalars().all()
        class_ids = [ca.class_id for ca in class_assignments]
        
        if not class_ids:
            return {
                "data": [],
                "summary": {
                    "total_expected": 0.0,
                    "total_paid": 0.0,
                    "total_pending": 0.0,
                    "payment_rate": 0.0
                }
            }
        
        # Get campuses from classes
        classes_result = await db.execute(
            select(Class).where(Class.id.in_(class_ids))
        )
        classes = classes_result.scalars().all()
        campus_ids = list(set([c.campus_id for c in classes]))
        campus_query = campus_query.where(Campus.id.in_(campus_ids))
    elif current_user.role == "PARENT":
        # Parent: Only campuses with their children
        parent_result = await db.execute(
            select(StudentParent).where(StudentParent.parent_id == current_user.id)
        )
        parent_links = parent_result.scalars().all()
        student_ids = [pl.student_id for pl in parent_links]
        
        if not student_ids:
            return {
                "data": [],
                "summary": {
                    "total_expected": 0.0,
                    "total_paid": 0.0,
                    "total_pending": 0.0,
                    "payment_rate": 0.0
                }
            }
        
        # Get campuses from students' classes
        students_result = await db.execute(
            select(Student).where(Student.id.in_(student_ids))
        )
        students = students_result.scalars().all()
        
        # Get active class assignments
        class_history_result = await db.execute(
            select(StudentClassHistory).where(
                StudentClassHistory.student_id.in_(student_ids),
                StudentClassHistory.end_date.is_(None)
            )
        )
        class_histories = class_history_result.scalars().all()
        class_ids = [ch.class_id for ch in class_histories]
        
        if not class_ids:
            return {
                "data": [],
                "summary": {
                    "total_expected": 0.0,
                    "total_paid": 0.0,
                    "total_pending": 0.0,
                    "payment_rate": 0.0
                }
            }
        
        classes_result = await db.execute(
            select(Class).where(Class.id.in_(class_ids))
        )
        classes = classes_result.scalars().all()
        campus_ids = list(set([c.campus_id for c in classes]))
        campus_query = campus_query.where(Campus.id.in_(campus_ids))
    
    if campus_id:
        campus_query = campus_query.where(Campus.id == campus_id)
    
    campuses_result = await db.execute(campus_query)
    campuses = campuses_result.scalars().all()
    
    # Calculate summary for each campus
    data = []
    total_expected = Decimal("0.00")
    total_paid = Decimal("0.00")
    
    for campus in campuses:
        # Get all classes in this campus
        classes_result = await db.execute(
            select(Class).where(Class.campus_id == campus.id)
        )
        classes = classes_result.scalars().all()
        class_ids = [c.id for c in classes]
        
        if not class_ids:
            data.append({
                "campus_id": campus.id,
                "campus_name": campus.name,
                "active_academic_year": active_academic_year_name,
                "active_term": term.name if term else None,
                "active_classes": 0,
                "active_students": 0,
                "total_expected_fee": 0.0,
                "total_paid_amount": 0.0,
                "total_pending_amount": 0.0,
                "payment_rate": 0.0
            })
            continue
        
        # Get active students in these classes
        class_history_result = await db.execute(
            select(StudentClassHistory).where(
                StudentClassHistory.class_id.in_(class_ids),
                StudentClassHistory.end_date.is_(None)
            )
        )
        class_histories = class_history_result.scalars().all()
        student_ids = list(set([ch.student_id for ch in class_histories]))
        
        if not student_ids:
            data.append({
                "campus_id": campus.id,
                "campus_name": campus.name,
                "active_academic_year": active_academic_year_name,
                "active_term": term.name if term else None,
                "active_classes": len(class_ids),
                "active_students": 0,
                "total_expected_fee": 0.0,
                "total_paid_amount": 0.0,
                "total_pending_amount": 0.0,
                "payment_rate": 0.0
            })
            continue
        
        # Get fee records for these students and term
        fees_result = await db.execute(
            select(Fee).where(
                Fee.student_id.in_(student_ids),
                Fee.term_id == term_id
            )
        )
        fees = fees_result.scalars().all()
        
        campus_expected = sum(fee.expected_amount for fee in fees)
        campus_paid = sum(fee.paid_amount for fee in fees)
        campus_pending = campus_expected - campus_paid
        
        payment_rate = 0.0
        if campus_expected > 0:
            payment_rate = float((campus_paid / campus_expected) * 100)
        
        total_expected += campus_expected
        total_paid += campus_paid
        
        data.append({
            "campus_id": campus.id,
            "campus_name": campus.name,
            "active_academic_year": active_academic_year_name,
            "active_term": term.name if term else None,
            "active_classes": len(class_ids),
            "active_students": len(student_ids),
            "total_expected_fee": float(campus_expected),
            "total_paid_amount": float(campus_paid),
            "total_pending_amount": float(campus_pending),
            "payment_rate": round(payment_rate, 1)
        })
    
    total_pending = total_expected - total_paid
    overall_payment_rate = 0.0
    if total_expected > 0:
        overall_payment_rate = float((total_paid / total_expected) * 100)
    
    return {
        "data": data,
        "summary": {
            "total_expected": float(total_expected),
            "total_paid": float(total_paid),
            "total_pending": float(total_pending),
            "payment_rate": round(overall_payment_rate, 1)
        }
    }


# ============================================================================
# Class-Level Fee Summary
# ============================================================================

@router.get("/fees/summary/class/{class_id}")
async def get_class_fee_summary(
    class_id: UUID,
    term_id: Optional[UUID] = Query(None, description="Term ID (uses active term if not provided)"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get class-level fee summary.
    
    Permission: All authenticated users (scope-filtered)
    - School Admin: All classes
    - Campus Admin: Classes in their campus
    - Teacher: Only their assigned classes
    - Parent: Only classes with their children
    """
    # Validate class exists and user has access
    class_result = await db.execute(
        select(Class)
        .join(Campus)
        .where(
            Class.id == class_id,
            Campus.school_id == current_user.school_id
        )
    )
    class_ = class_result.scalar_one_or_none()
    
    if not class_:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error_code": "CLASS_NOT_FOUND", "message": "Class not found"}
        )
    
    # Role-based access check
    if current_user.role == "CAMPUS_ADMIN" and class_.campus_id != current_user.campus_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"error_code": "FORBIDDEN_ACTION", "message": "You don't have access to this class"}
        )
    elif current_user.role == "TEACHER":
        # Check if teacher is assigned to this class
        assignment_result = await db.execute(
            select(TeacherClassAssignment).where(
                TeacherClassAssignment.teacher_id == current_user.id,
                TeacherClassAssignment.class_id == class_id
            )
        )
        assignment = assignment_result.scalar_one_or_none()
        if not assignment:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={"error_code": "FORBIDDEN_ACTION", "message": "You are not assigned to this class"}
            )
    elif current_user.role == "PARENT":
        # Check if parent has children in this class
        parent_result = await db.execute(
            select(StudentParent).where(StudentParent.parent_id == current_user.id)
        )
        parent_links = parent_result.scalars().all()
        student_ids = [pl.student_id for pl in parent_links]
        
        if not student_ids:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={"error_code": "FORBIDDEN_ACTION", "message": "You don't have children in this class"}
            )
        
        class_history_result = await db.execute(
            select(StudentClassHistory).where(
                StudentClassHistory.student_id.in_(student_ids),
                StudentClassHistory.class_id == class_id,
                StudentClassHistory.end_date.is_(None)
            )
        )
        class_history = class_history_result.scalar_one_or_none()
        if not class_history:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={"error_code": "FORBIDDEN_ACTION", "message": "You don't have children in this class"}
            )
    
    # Get active term if not provided
    if not term_id:
        academic_year, term = await get_active_academic_year_and_term(db, current_user.school_id)
        if not term:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"error_code": "NO_ACTIVE_TERM", "message": "No active term found"}
            )
        term_id = term.id
        academic_year_name = academic_year.name if academic_year else None
    else:
        term_result = await db.execute(select(Term).where(Term.id == term_id))
        term = term_result.scalar_one_or_none()
        if not term:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"error_code": "TERM_NOT_FOUND", "message": "Term not found"}
            )
        ay_result = await db.execute(
            select(AcademicYear.name).where(AcademicYear.id == term.academic_year_id)
        )
        academic_year_name = ay_result.scalar_one_or_none()
    
    # Get active students in this class
    class_history_result = await db.execute(
        select(StudentClassHistory).where(
            StudentClassHistory.class_id == class_id,
            StudentClassHistory.end_date.is_(None)
        )
    )
    class_histories = class_history_result.scalars().all()
    student_ids = [ch.student_id for ch in class_histories]
    
    if not student_ids:
        return {
            "class_id": class_id,
            "class_name": class_.name,
            "academic_year": academic_year_name,
            "term": term.name if term else None,
            "active_students": 0,
            "total_expected_fee": 0.0,
            "total_paid_amount": 0.0,
            "total_pending_amount": 0.0,
            "payment_rate": 0.0,
            "students": []
        }
    
    # Get fee records
    fees_result = await db.execute(
        select(Fee).where(
            Fee.student_id.in_(student_ids),
            Fee.term_id == term_id
        )
    )
    fees = fees_result.scalars().all()
    fee_dict = {fee.student_id: fee for fee in fees}
    
    # Get students
    students_result = await db.execute(
        select(Student).where(Student.id.in_(student_ids))
    )
    students = students_result.scalars().all()
    
    # Calculate summary
    total_expected = Decimal("0.00")
    total_paid = Decimal("0.00")
    student_data = []
    
    for student in students:
        fee = fee_dict.get(student.id)
        if fee:
            expected = fee.expected_amount
            paid = fee.paid_amount
        else:
            # Calculate fee if no record exists
            expected = await calculate_student_fee_from_student(db, student, term_id)
            paid = Decimal("0.00")
        
        pending = expected - paid
        payment_rate = 0.0
        if expected > 0:
            payment_rate = float((paid / expected) * 100)
        
        total_expected += expected
        total_paid += paid
        
        student_data.append({
            "student_id": student.id,
            "student_name": f"{student.first_name} {student.last_name}",
            "academic_year": academic_year_name,
            "term": term.name if term else None,
            "expected_fee": float(expected),
            "paid_amount": float(paid),
            "pending_amount": float(pending),
            "payment_rate": round(payment_rate, 1)
        })
    
    total_pending = total_expected - total_paid
    overall_payment_rate = 0.0
    if total_expected > 0:
        overall_payment_rate = float((total_paid / total_expected) * 100)
    
    return {
        "class_id": class_id,
        "class_name": class_.name,
        "academic_year": academic_year_name,
        "term": term.name if term else None,
        "term_id": str(term.id) if term else None,
        "active_students": len(student_ids),
        "total_expected_fee": float(total_expected),
        "total_paid_amount": float(total_paid),
        "total_pending_amount": float(total_pending),
        "payment_rate": round(overall_payment_rate, 1),
        "students": student_data
    }


# ============================================================================
# Student-Level Fee Summary
# ============================================================================

@router.get("/fees/summary/student/{student_id}")
async def get_student_fee_summary(
    student_id: UUID,
    term_id: Optional[UUID] = Query(None, description="Term ID (uses active term if not provided)"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get student-level fee summary.
    
    Permission: All authenticated users (scope-filtered)
    - School Admin: All students
    - Campus Admin: Students in their campus
    - Teacher: Students in their classes
    - Parent: Only their own children
    """
    # Validate student exists and user has access
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
            detail={"error_code": "STUDENT_NOT_FOUND", "message": "Student not found"}
        )
    
    # Role-based access check
    if current_user.role == "PARENT":
        # Check if student is child of parent
        parent_link_result = await db.execute(
            select(StudentParent).where(
                StudentParent.parent_id == current_user.id,
                StudentParent.student_id == student_id
            )
        )
        parent_link = parent_link_result.scalar_one_or_none()
        if not parent_link:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={"error_code": "FORBIDDEN_ACTION", "message": "You don't have access to this student"}
            )
    elif current_user.role == "TEACHER":
        # Check if student is in teacher's class
        class_history_result = await db.execute(
            select(StudentClassHistory).where(
                StudentClassHistory.student_id == student_id,
                StudentClassHistory.end_date.is_(None)
            )
        )
        class_history = class_history_result.scalar_one_or_none()
        if not class_history:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={"error_code": "FORBIDDEN_ACTION", "message": "Student is not in any active class"}
            )
        
        assignment_result = await db.execute(
            select(TeacherClassAssignment).where(
                TeacherClassAssignment.teacher_id == current_user.id,
                TeacherClassAssignment.class_id == class_history.class_id
            )
        )
        assignment = assignment_result.scalar_one_or_none()
        if not assignment:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={"error_code": "FORBIDDEN_ACTION", "message": "Student is not in your class"}
            )
    elif current_user.role == "CAMPUS_ADMIN":
        # Check if student is in admin's campus
        class_history_result = await db.execute(
            select(StudentClassHistory).where(
                StudentClassHistory.student_id == student_id,
                StudentClassHistory.end_date.is_(None)
            )
        )
        class_history = class_history_result.scalar_one_or_none()
        if class_history:
            class_result = await db.execute(
                select(Class).where(Class.id == class_history.class_id)
            )
            class_ = class_result.scalar_one_or_none()
            if class_ and class_.campus_id != current_user.campus_id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail={"error_code": "FORBIDDEN_ACTION", "message": "Student is not in your campus"}
                )
    
    # Get active term if not provided
    if not term_id:
        academic_year, term_temp = await get_active_academic_year_and_term(db, current_user.school_id)
        if not term_temp:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"error_code": "NO_ACTIVE_TERM", "message": "No active term found"}
            )
        term_id = term_temp.id
    
    # Fetch term with academic_year relationship loaded (needed for response)
    term_result = await db.execute(
        select(Term)
        .where(Term.id == term_id)
        .options(selectinload(Term.academic_year))
    )
    term = term_result.scalar_one_or_none()
    if not term:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error_code": "TERM_NOT_FOUND", "message": "Term not found"}
        )
    
    # Get or calculate fee
    fee_result = await db.execute(
        select(Fee).where(
            Fee.student_id == student_id,
            Fee.term_id == term_id
        )
    )
    fee = fee_result.scalar_one_or_none()
    
    if fee:
        expected = fee.expected_amount
        paid = fee.paid_amount
    else:
        # Calculate fee if no record exists
        expected = await calculate_student_fee_from_student(db, student, term_id)
        paid = Decimal("0.00")
    
    pending = expected - paid
    payment_rate = 0.0
    if expected > 0:
        payment_rate = float((paid / expected) * 100)
    
    # Get student's current class
    class_history_result = await db.execute(
        select(StudentClassHistory).where(
            StudentClassHistory.student_id == student_id,
            StudentClassHistory.end_date.is_(None)
        )
        .order_by(StudentClassHistory.start_date.desc())
        .limit(1)
    )
    class_history = class_history_result.scalar_one_or_none()
    
    class_name = None
    if class_history:
        class_result = await db.execute(select(Class).where(Class.id == class_history.class_id))
        class_ = class_result.scalar_one_or_none()
        if class_:
            class_name = class_.name
    
    return {
        "student_id": student_id,
        "student_name": f"{student.first_name} {student.last_name}",
        "academic_year": term.academic_year.name if term else None,
        "term": term.name if term else None,
        "class": class_name,
        "expected_fee": float(expected),
        "paid_amount": float(paid),
        "pending_amount": float(pending),
        "payment_rate": round(payment_rate, 1)
    }

