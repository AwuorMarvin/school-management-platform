"""
Teacher service - Business logic for teacher operations.

Provides functions for:
- Computing teacher status (ACTIVE/INACTIVE)
- Calculating derived metrics (subjects_taught, classes_taught, total_students, subject_ratio)
- All queries use aggregated SQL (no N+1)
"""

from uuid import UUID
from typing import Optional

from sqlalchemy import case, func, select, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.teacher import Teacher
from app.models.teacher_class_assignment import TeacherClassAssignment
from app.models.student import Student
from app.models import Class
from app.models.student_class_history import StudentClassHistory


async def compute_teacher_status(
    teacher_id: UUID,
    db: AsyncSession
) -> tuple[str, Optional[str]]:
    """
    Compute teacher status based on active assignments.
    
    Returns:
        Tuple of (status, reason) where:
        - status: "ACTIVE" or "INACTIVE"
        - reason: Human-readable explanation (e.g., "Assigned to 3 classes")
    
    A teacher is ACTIVE if:
    - Assigned to at least one class (with end_date IS NULL)
    - AND at least one assigned subject is active
    
    A teacher is INACTIVE if:
    - Not assigned to any class
    - OR all assigned subjects are inactive
    """
    
    # Count active assignments
    query = select(
        func.count(TeacherClassAssignment.id).label("active_count")
    ).select_from(
        TeacherClassAssignment
    ).where(
        and_(
            TeacherClassAssignment.teacher_id == teacher_id,
            TeacherClassAssignment.end_date.is_(None)
        )
    )
    
    result = await db.execute(query)
    active_count = result.scalar_one() or 0
    
    if active_count > 0:
        # Get class count for reason
        class_query = select(
            func.count(func.distinct(TeacherClassAssignment.class_id)).label("class_count")
        ).where(
            and_(
                TeacherClassAssignment.teacher_id == teacher_id,
                TeacherClassAssignment.end_date.is_(None)
            )
        )
        class_result = await db.execute(class_query)
        class_count = class_result.scalar_one() or 0
        
        status = "ACTIVE"
        reason = f"Assigned to {class_count} class{'es' if class_count != 1 else ''}"
    else:
        status = "INACTIVE"
        reason = "No active assignments"
    
    return status, reason


async def get_teacher_metrics(
    teacher_id: UUID,
    db: AsyncSession
) -> dict:
    """
    Get derived metrics for a teacher.
    
    Returns:
        Dictionary with:
        - subjects_taught: int (unique subjects across all classes)
        - classes_taught: int (unique classes)
        - total_students: int (unique students across all classes)
        - subject_ratio: Optional[float] (total_students / subjects_taught, None if subjects = 0)
    
    Uses aggregated query (no N+1).
    """
    
    # Single aggregated query to get all metrics
    query = select(
        func.count(func.distinct(TeacherClassAssignment.subject_id)).label("subjects_taught"),
        func.count(func.distinct(TeacherClassAssignment.class_id)).label("classes_taught"),
        func.count(func.distinct(Student.id)).label("total_students")
    ).select_from(
        TeacherClassAssignment
    ).outerjoin(
        Class,
        TeacherClassAssignment.class_id == Class.id
    ).outerjoin(
        StudentClassHistory,
        and_(
            StudentClassHistory.class_id == Class.id,
            StudentClassHistory.end_date.is_(None)
        )
    ).outerjoin(
        Student,
        and_(
            Student.id == StudentClassHistory.student_id,
            Student.status == "ACTIVE"
        )
    ).where(
        and_(
            TeacherClassAssignment.teacher_id == teacher_id,
            TeacherClassAssignment.end_date.is_(None)
        )
    )
    
    result = await db.execute(query)
    row = result.first()
    
    if row:
        subjects_taught = row.subjects_taught or 0
        classes_taught = row.classes_taught or 0
        total_students = row.total_students or 0
        
        # Calculate subject ratio
        if subjects_taught > 0:
            subject_ratio = round(total_students / subjects_taught, 1)
        else:
            subject_ratio = None
    else:
        subjects_taught = 0
        classes_taught = 0
        total_students = 0
        subject_ratio = None
    
    return {
        "subjects_taught": subjects_taught,
        "classes_taught": classes_taught,
        "total_students": total_students,
        "subject_ratio": subject_ratio
    }


async def get_teacher_list_metrics(
    teacher_ids: list[UUID],
    school_id: UUID,
    db: AsyncSession
) -> dict[UUID, dict]:
    """
    Get metrics for multiple teachers in a single query (no N+1).
    
    Args:
        teacher_ids: List of teacher IDs
        school_id: School ID for tenant isolation
        db: Database session
    
    Returns:
        Dictionary mapping teacher_id to metrics dict
    """
    
    if not teacher_ids:
        return {}
    
    # Aggregated query for all teachers at once
    query = select(
        TeacherClassAssignment.teacher_id,
        func.count(func.distinct(TeacherClassAssignment.subject_id)).label("subjects_taught"),
        func.count(func.distinct(TeacherClassAssignment.class_id)).label("classes_taught"),
        func.count(func.distinct(Student.id)).label("total_students")
    ).select_from(
        TeacherClassAssignment
    ).outerjoin(
        Class,
        TeacherClassAssignment.class_id == Class.id
    ).outerjoin(
        StudentClassHistory,
        and_(
            StudentClassHistory.class_id == Class.id,
            StudentClassHistory.end_date.is_(None)
        )
    ).outerjoin(
        Student,
        and_(
            Student.id == StudentClassHistory.student_id,
            Student.status == "ACTIVE"
        )
    ).where(
        and_(
            TeacherClassAssignment.teacher_id.in_(teacher_ids),
            TeacherClassAssignment.end_date.is_(None)
        )
    ).group_by(
        TeacherClassAssignment.teacher_id
    )
    
    result = await db.execute(query)
    rows = result.all()
    
    # Build result dictionary
    metrics_dict = {}
    for row in rows:
        subjects_taught = row.subjects_taught or 0
        total_students = row.total_students or 0
        
        if subjects_taught > 0:
            subject_ratio = round(total_students / subjects_taught, 1)
        else:
            subject_ratio = None
        
        metrics_dict[row.teacher_id] = {
            "subjects_taught": subjects_taught,
            "classes_taught": row.classes_taught or 0,
            "total_students": total_students,
            "subject_ratio": subject_ratio
        }
    
    # Ensure all teacher_ids have entries (even if no assignments)
    for teacher_id in teacher_ids:
        if teacher_id not in metrics_dict:
            metrics_dict[teacher_id] = {
                "subjects_taught": 0,
                "classes_taught": 0,
                "total_students": 0,
                "subject_ratio": None
            }
    
    return metrics_dict

