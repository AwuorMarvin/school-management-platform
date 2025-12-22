"""
Service layer for academic performance reports and line items.
"""

from typing import List, Optional, Tuple
from uuid import UUID

from sqlalchemy import and_, select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models import (
    AcademicYear,
    Class,
    ClassSubject,
    PerformanceLineItem,
    PerformanceReport,
    Student,
    StudentClassHistory,
    Subject,
    TeacherClassAssignment,
    Term,
    User,
)
from app.schemas.performance import (
    PerformanceReportCreate,
    PerformanceReportUpdate,
)


class PerformancePermissionError(Exception):
    """Raised when a user is not allowed to access or modify a performance report."""


class PerformanceNotFoundError(Exception):
    """Raised when a performance report is not found."""


async def _get_teacher_for_context(
    db: AsyncSession,
    *,
    current_user: User,
    student: Student,
    cls: Class,
    subject: Subject,
) -> UUID:
    """
    Resolve the teacher responsible for a subject in a class, based on role.

    - For TEACHER: ensure they are assigned to the class/subject and return current_user.id.
    - For admins: use teacher_class_assignment to find or validate the teacher.
    """
    role = current_user.role

    if role == "TEACHER":
        assignment_result = await db.execute(
            select(TeacherClassAssignment).where(
                TeacherClassAssignment.teacher_id == current_user.id,
                TeacherClassAssignment.class_id == cls.id,
                TeacherClassAssignment.end_date.is_(None),
            )
        )
        assignment = assignment_result.scalar_one_or_none()
        if not assignment:
            raise PerformancePermissionError(
                "You are not assigned to teach this class or subject"
            )
        if assignment.subject_id and assignment.subject_id != subject.id:
            raise PerformancePermissionError("You are not assigned to teach this subject")
        return current_user.id

    # SCHOOL_ADMIN / CAMPUS_ADMIN / SUPER_ADMIN
    assignment_result = await db.execute(
        select(TeacherClassAssignment).where(
            TeacherClassAssignment.class_id == cls.id,
            TeacherClassAssignment.subject_id == subject.id,
            TeacherClassAssignment.end_date.is_(None),
        )
    )
    assignment = assignment_result.scalar_one_or_none()
    if not assignment:
        raise PerformancePermissionError(
            "No active teacher assignment found for this class and subject"
        )
    return assignment.teacher_id


async def _get_student_and_context(
    db: AsyncSession,
    *,
    data: PerformanceReportCreate,
    current_user: User,
) -> Tuple[Student, Class, Subject, AcademicYear, Term]:
    """Load and validate student, class, subject, academic year, term within tenant."""
    student_result = await db.execute(
        select(Student).where(
            Student.id == data.student_id,
            Student.school_id == current_user.school_id,
        )
    )
    student = student_result.scalar_one_or_none()
    if not student:
        raise ValueError("Student not found or does not belong to your school")

    class_result = await db.execute(
        select(Class).where(
            Class.id == data.class_id,
        )
    )
    cls = class_result.scalar_one_or_none()
    if not cls:
        raise ValueError("Class not found")

    subject_result = await db.execute(
        select(Subject)
        .join(ClassSubject, ClassSubject.subject_id == Subject.id)
        .where(
            Subject.id == data.subject_id,
            ClassSubject.class_id == cls.id,
            Subject.school_id == current_user.school_id,
        )
    )
    subject = subject_result.scalar_one_or_none()
    if not subject:
        raise ValueError("Subject not found in the selected class")

    ay_result = await db.execute(
        select(AcademicYear).where(
            AcademicYear.id == data.academic_year_id,
            AcademicYear.school_id == current_user.school_id,
        )
    )
    academic_year = ay_result.scalar_one_or_none()
    if not academic_year:
        raise ValueError("Academic year not found for this school")

    term_result = await db.execute(
        select(Term).where(
            Term.id == data.term_id,
            Term.academic_year_id == academic_year.id,
        )
    )
    term = term_result.scalar_one_or_none()
    if not term:
        raise ValueError("Term not found in the selected academic year")

    # Optional: ensure student currently belongs to this class
    sch_result = await db.execute(
        select(StudentClassHistory).where(
            StudentClassHistory.student_id == student.id,
            StudentClassHistory.class_id == cls.id,
            StudentClassHistory.end_date.is_(None),
        )
    )
    sch = sch_result.scalar_one_or_none()
    if not sch:
        raise ValueError("Student is not currently assigned to the selected class")

    return student, cls, subject, academic_year, term


async def create_performance_report(
    db: AsyncSession,
    *,
    current_user: User,
    data: PerformanceReportCreate,
) -> PerformanceReport:
    """
    Create a new performance report with 1–5 line items.

    - Enforces tenant isolation (school_id).
    - Enforces teacher assignment rules.
    - Ensures uniqueness of (student, subject, class, term, academic_year, teacher, school).
    """
    student, cls, subject, academic_year, term = await _get_student_and_context(
        db=db,
        data=data,
        current_user=current_user,
    )

    teacher_id = await _get_teacher_for_context(
        db=db,
        current_user=current_user,
        student=student,
        cls=cls,
        subject=subject,
    )

    # Ensure no duplicate active report exists
    existing_result = await db.execute(
        select(PerformanceReport).where(
            PerformanceReport.school_id == current_user.school_id,
            PerformanceReport.student_id == student.id,
            PerformanceReport.subject_id == subject.id,
            PerformanceReport.class_id == cls.id,
            PerformanceReport.academic_year_id == academic_year.id,
            PerformanceReport.term_id == term.id,
            PerformanceReport.teacher_id == teacher_id,
            PerformanceReport.is_deleted.is_(False),
        )
    )
    existing = existing_result.scalar_one_or_none()
    if existing:
        raise ValueError(
            "A performance report already exists for this student, subject, class, term and teacher"
        )

    report = PerformanceReport(
        school_id=current_user.school_id,
        student_id=student.id,
        class_id=cls.id,
        subject_id=subject.id,
        teacher_id=teacher_id,
        academic_year_id=academic_year.id,
        term_id=term.id,
        created_by_user_id=current_user.id,
        updated_by_user_id=current_user.id,
    )
    db.add(report)
    await db.flush()

    line_items: List[PerformanceLineItem] = []
    for index, item in enumerate(data.line_items, start=1):
        line_item = PerformanceLineItem(
            school_id=current_user.school_id,
            report_id=report.id,
            area_label=item.area_label,
            numeric_score=item.numeric_score,
            descriptive_score=item.descriptive_score,
            comment=item.comment,
            position=item.position or index,
        )
        db.add(line_item)
        line_items.append(line_item)

    await db.commit()
    await db.refresh(report)
    await db.refresh(report, ["student", "subject", "term", "teacher", "line_items"])
    return report


async def _get_report_for_update(
    db: AsyncSession,
    *,
    report_id: UUID,
    current_user: User,
) -> PerformanceReport:
    """Load a report for update/delete with permission checks."""
    result = await db.execute(
        select(PerformanceReport)
        .where(
            PerformanceReport.id == report_id,
            PerformanceReport.school_id == current_user.school_id,
            PerformanceReport.is_deleted.is_(False),
        )
        .options(selectinload(PerformanceReport.line_items))
    )
    report = result.scalar_one_or_none()
    if not report:
        raise PerformanceNotFoundError("Performance report not found")

    role = current_user.role
    if role == "TEACHER" and report.teacher_id != current_user.id:
        raise PerformancePermissionError("You can only edit your own performance reports")

    # Admins (school/campus/super) are allowed; parents have no write access
    if role == "PARENT":
        raise PerformancePermissionError("Parents cannot modify performance reports")

    return report


async def update_performance_report(
    db: AsyncSession,
    *,
    report_id: UUID,
    current_user: User,
    data: PerformanceReportUpdate,
) -> PerformanceReport:
    """Update an existing performance report's line items."""
    report = await _get_report_for_update(db=db, report_id=report_id, current_user=current_user)

    # Replace line items
    await db.execute(
        select(PerformanceLineItem)
        .where(
            PerformanceLineItem.report_id == report.id,
            PerformanceLineItem.school_id == current_user.school_id,
        )
    )
    # Easiest: delete existing via relationship
    report.line_items.clear()
    await db.flush()

    for index, item in enumerate(data.line_items, start=1):
        line_item = PerformanceLineItem(
            school_id=current_user.school_id,
            report_id=report.id,
            area_label=item.area_label,
            numeric_score=item.numeric_score,
            descriptive_score=item.descriptive_score,
            comment=item.comment,
            position=item.position or index,
        )
        db.add(line_item)

    report.updated_by_user_id = current_user.id

    await db.commit()
    await db.refresh(report)
    await db.refresh(report, ["student", "subject", "term", "teacher", "line_items"])
    return report


async def soft_delete_performance_report(
    db: AsyncSession,
    *,
    report_id: UUID,
    current_user: User,
) -> None:
    """Soft delete a performance report."""
    report = await _get_report_for_update(db=db, report_id=report_id, current_user=current_user)
    report.is_deleted = True
    report.updated_by_user_id = current_user.id
    await db.commit()


async def get_performance_report(
    db: AsyncSession,
    *,
    report_id: UUID,
    current_user: User,
) -> PerformanceReport:
    """Get a single performance report with permission checks (including parents)."""
    query = (
        select(PerformanceReport)
        .where(
            PerformanceReport.id == report_id,
            PerformanceReport.school_id == current_user.school_id,
            PerformanceReport.is_deleted.is_(False),
        )
        .options(
            selectinload(PerformanceReport.student),
            selectinload(PerformanceReport.cls),
            selectinload(PerformanceReport.subject),
            selectinload(PerformanceReport.academic_year),
            selectinload(PerformanceReport.term),
            selectinload(PerformanceReport.teacher),
            selectinload(PerformanceReport.line_items),
        )
    )
    result = await db.execute(query)
    report = result.scalar_one_or_none()
    if not report:
        raise PerformanceNotFoundError("Performance report not found")

    # Parents can only see their children; rely on existing relationship checks if available.
    if current_user.role == "PARENT":
        # Lightweight check: ensure parent is linked to the student via student_parent
        from app.models import StudentParent, Parent  # local import to avoid cycles

        parent_result = await db.execute(
            select(Parent).where(Parent.user_id == current_user.id)
        )
        parent = parent_result.scalar_one_or_none()
        if not parent:
            raise PerformancePermissionError("Parent record not found")

        sp_result = await db.execute(
            select(StudentParent).where(
                StudentParent.parent_id == parent.id,
                StudentParent.student_id == report.student_id,
            )
        )
        link = sp_result.scalar_one_or_none()
        if not link:
            raise PerformancePermissionError("You can only view performance for your own children")

    return report


async def list_performance_reports(
    db: AsyncSession,
    *,
    current_user: User,
    academic_year_id: Optional[UUID] = None,
    term_id: Optional[UUID] = None,
    subject_id: Optional[UUID] = None,
    student_id: Optional[UUID] = None,
    class_id: Optional[UUID] = None,
    page: int = 1,
    page_size: int = 20,
) -> Tuple[List[tuple], int]:
    """
    List performance reports with filters and role-based scoping.

    Parents only see their children; teachers see their own reports; admins see all in school.

    Returns a list of row tuples:
        (PerformanceReport, Student, Class, Subject, AcademicYear, Term, User, first_numeric_score, first_descriptive_score, item_count)
    """
    filters = [
        PerformanceReport.school_id == current_user.school_id,
        PerformanceReport.is_deleted.is_(False),
    ]

    if academic_year_id:
        filters.append(PerformanceReport.academic_year_id == academic_year_id)
    if term_id:
        filters.append(PerformanceReport.term_id == term_id)
    if subject_id:
        filters.append(PerformanceReport.subject_id == subject_id)
    if student_id:
        filters.append(PerformanceReport.student_id == student_id)
    if class_id:
        filters.append(PerformanceReport.class_id == class_id)

    role = current_user.role
    if role == "TEACHER":
        filters.append(PerformanceReport.teacher_id == current_user.id)
    elif role == "PARENT":
        from app.models import StudentParent, Parent  # local import

        parent_result = await db.execute(
            select(Parent).where(Parent.user_id == current_user.id)
        )
        parent = parent_result.scalar_one_or_none()
        if not parent:
            return [], 0

        child_ids_result = await db.execute(
            select(StudentParent.student_id).where(StudentParent.parent_id == parent.id)
        )
        child_ids = [row[0] for row in child_ids_result.all()]
        if not child_ids:
            return [], 0
        filters.append(PerformanceReport.student_id.in_(child_ids))

    # Subquery to compute first scores and item count per report
    li_subq = (
        select(
            PerformanceLineItem.report_id.label("r_id"),
            func.min(PerformanceLineItem.position).label("min_pos"),
            func.count(PerformanceLineItem.id).label("item_count"),
        )
        .group_by(PerformanceLineItem.report_id)
        .subquery()
    )

    first_scores_subq = (
        select(
            PerformanceLineItem.report_id.label("fs_r_id"),
            PerformanceLineItem.numeric_score.label("first_numeric_score"),
            PerformanceLineItem.descriptive_score.label("first_descriptive_score"),
        )
        .join(
            li_subq,
            (li_subq.c.r_id == PerformanceLineItem.report_id)
            & (li_subq.c.min_pos == PerformanceLineItem.position),
        )
        .subquery()
    )

    base_query = (
        select(
            PerformanceReport,
            Student,
            Class,
            Subject,
            AcademicYear,
            Term,
            User,
            first_scores_subq.c.first_numeric_score,
            first_scores_subq.c.first_descriptive_score,
            li_subq.c.item_count,
        )
        .join(Student, Student.id == PerformanceReport.student_id)
        .join(Class, Class.id == PerformanceReport.class_id)
        .join(Subject, Subject.id == PerformanceReport.subject_id)
        .join(AcademicYear, AcademicYear.id == PerformanceReport.academic_year_id)
        .join(Term, Term.id == PerformanceReport.term_id)
        .join(User, User.id == PerformanceReport.teacher_id)
        .join(li_subq, li_subq.c.r_id == PerformanceReport.id)
        .join(first_scores_subq, first_scores_subq.c.fs_r_id == PerformanceReport.id)
        .where(and_(*filters))
        .order_by(PerformanceReport.created_at.desc())
    )

    count_query = select(func.count()).select_from(
        select(PerformanceReport.id).where(and_(*filters)).subquery()
    )
    total_result = await db.execute(count_query)
    total = total_result.scalar_one()

    offset = (page - 1) * page_size
    result = await db.execute(base_query.offset(offset).limit(page_size))
    rows = result.all()
    return rows, int(total)


