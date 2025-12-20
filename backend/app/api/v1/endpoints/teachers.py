"""
Teacher endpoints - CRUD operations for teachers and assignments.
"""

from datetime import date, datetime, UTC, timedelta
from uuid import UUID
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy import select, func, and_, or_, case, distinct
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.deps import get_current_user, require_campus_admin
from app.core.security import generate_secure_token, hash_token
from app.models.user import User
from app.models.teacher import Teacher
from app.models.campus import Campus
from app.models import Class
from app.models.subject import Subject
from app.models.class_subject import ClassSubject
from app.models.teacher_class_assignment import TeacherClassAssignment
from app.models.student_class_history import StudentClassHistory
from app.models.student import Student
from app.models.academic_year import AcademicYear
from app.models.account_setup_token import AccountSetupToken
from app.schemas.teacher import (
    TeacherCreate,
    TeacherUpdate,
    TeacherResponse,
    TeacherListResponse,
    TeacherListItem,
    TeacherAssignmentCreate,
    TeacherAssignmentBulkCreate,
    AssignmentCreateResponse,
    AssignmentBulkCreateResponse,
    AssignmentRemoveResponse,
    CampusMinimalResponse,
    SubjectMinimalResponse,
    ClassMinimalResponse,
    TeacherAssignmentResponse,
    TeacherAssignmentHistoryResponse,
)
from app.services.teacher_service import (
    compute_teacher_status,
    get_teacher_metrics,
    get_teacher_list_metrics,
)

router = APIRouter()


# ============================================================================
# Helper Functions
# ============================================================================

async def validate_campus_match(
    teacher: Teacher,
    class_obj: Class,
    db: AsyncSession
) -> None:
    """Validate that teacher and class belong to the same campus."""
    if teacher.campus_id != class_obj.campus_id:
        # Get campus names for error message
        teacher_campus_result = await db.execute(
            select(Campus).where(Campus.id == teacher.campus_id)
        )
        teacher_campus = teacher_campus_result.scalar_one()
        
        class_campus_result = await db.execute(
            select(Campus).where(Campus.id == class_obj.campus_id)
        )
        class_campus = class_campus_result.scalar_one()
        
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error_code": "CAMPUS_MISMATCH",
                "message": f"Teacher belongs to {teacher_campus.name} but class belongs to {class_campus.name}",
                "recovery": "Select a class from the teacher's campus"
            }
        )


async def validate_subject_class_compatibility(
    subject_id: UUID,
    class_id: UUID,
    db: AsyncSession
) -> None:
    """Validate that subject belongs to the class."""
    result = await db.execute(
        select(ClassSubject).where(
            ClassSubject.class_id == class_id,
            ClassSubject.subject_id == subject_id
        )
    )
    if not result.scalar_one_or_none():
        # Get subject and class names for error
        subject_result = await db.execute(
            select(Subject).where(Subject.id == subject_id)
        )
        subject = subject_result.scalar_one_or_none()
        
        class_result = await db.execute(
            select(Class).where(Class.id == class_id)
        )
        class_obj = class_result.scalar_one_or_none()
        
        subject_name = subject.name if subject else "Unknown"
        class_name = class_obj.name if class_obj else "Unknown"
        
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error_code": "SUBJECT_NOT_IN_CLASS",
                "message": f"Subject '{subject_name}' is not taught in class '{class_name}'",
                "recovery": "Add the subject to the class first, or select a different subject"
            }
        )


async def validate_active_class(
    class_id: UUID,
    db: AsyncSession
) -> None:
    """Validate that class belongs to current or future academic year."""
    class_result = await db.execute(
        select(Class).options(
            selectinload(Class.academic_year)
        ).where(Class.id == class_id)
    )
    class_obj = class_result.scalar_one_or_none()
    
    if not class_obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error_code": "CLASS_NOT_FOUND",
                "message": "Class not found",
                "recovery": "Verify the class ID"
            }
        )
    
    # Check if academic year is in the past
    if class_obj.academic_year.end_date < date.today():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error_code": "CLASS_IN_PAST_YEAR",
                "message": "Cannot assign teachers to classes in past academic years",
                "recovery": "Select a class from the current or future academic year"
            }
        )


def format_teacher_name(teacher: Teacher) -> str:
    """Format teacher name with salutation."""
    parts = [teacher.salutation, teacher.user.first_name]
    if teacher.middle_name:
        parts.append(teacher.middle_name)
    parts.append(teacher.user.last_name)
    return " ".join(parts)


# ============================================================================
# List Teachers
# ============================================================================

@router.get("/teachers", response_model=TeacherListResponse)
async def list_teachers(
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Number of records per page"),
    campus_id: Optional[UUID] = Query(None, description="Filter by campus (School Admin only)"),
    status_filter: Optional[str] = Query(None, alias="status", description="Filter by status: ACTIVE | INACTIVE"),
    search: Optional[str] = Query(None, description="Search by name, phone, national_id, tsc_number"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> TeacherListResponse:
    """
    List all teachers with derived metrics.
    
    Permission: SCHOOL_ADMIN (all campuses), CAMPUS_ADMIN (own campus only)
    """
    offset = (page - 1) * page_size
    
    # Build base query - tenant isolation
    query = select(Teacher).where(Teacher.school_id == current_user.school_id)
    count_query = select(func.count(Teacher.id)).where(Teacher.school_id == current_user.school_id)
    
    # Campus scoping for CAMPUS_ADMIN
    if current_user.role == "CAMPUS_ADMIN" and current_user.campus_id:
        query = query.where(Teacher.campus_id == current_user.campus_id)
        count_query = count_query.where(Teacher.campus_id == current_user.campus_id)
    elif campus_id and current_user.role == "SCHOOL_ADMIN":
        # School admin can filter by campus
        query = query.where(Teacher.campus_id == campus_id)
        count_query = count_query.where(Teacher.campus_id == campus_id)
    
    # Always join User for ordering and potential search
    query = query.join(User, Teacher.user_id == User.id)
    count_query = count_query.join(User, Teacher.user_id == User.id)
    
    # Search filter
    if search:
        search_term = f"%{search.lower()}%"
        query = query.where(
            or_(
                func.lower(User.first_name).like(search_term),
                func.lower(Teacher.middle_name).like(search_term),
                func.lower(User.last_name).like(search_term),
                func.lower(User.phone_number).like(search_term),
                func.lower(Teacher.national_id).like(search_term),
                func.lower(Teacher.tsc_number).like(search_term) if Teacher.tsc_number else False
            )
        )
        count_query = count_query.where(
            or_(
                func.lower(User.first_name).like(search_term),
                func.lower(Teacher.middle_name).like(search_term),
                func.lower(User.last_name).like(search_term),
                func.lower(User.phone_number).like(search_term),
                func.lower(Teacher.national_id).like(search_term),
                func.lower(Teacher.tsc_number).like(search_term) if Teacher.tsc_number else False
            )
        )
    
    # Get total count
    total = (await db.execute(count_query)).scalar_one()
    
    # Apply pagination and ordering
    query = query.options(
        selectinload(Teacher.user),
        selectinload(Teacher.campus)
    ).order_by(User.last_name, User.first_name).offset(offset).limit(page_size)
    
    result = await db.execute(query)
    teachers = result.scalars().all()
    
    # Get metrics for all teachers in one query (no N+1)
    teacher_ids = [t.id for t in teachers]
    metrics_dict = await get_teacher_list_metrics(teacher_ids, current_user.school_id, db)
    
    # Build response
    data = []
    for teacher in teachers:
        metrics = metrics_dict.get(teacher.id, {
            "subjects_taught": 0,
            "classes_taught": 0,
            "total_students": 0,
            "subject_ratio": None
        })
        
        # Compute status
        status, _ = await compute_teacher_status(teacher.id, db)
        
        data.append(TeacherListItem(
            id=teacher.id,
            name=format_teacher_name(teacher),
            phone_number=teacher.user.phone_number,
            campus=CampusMinimalResponse(
                id=teacher.campus.id,
                name=teacher.campus.name
            ),
            status=status,
            subjects_taught=metrics["subjects_taught"],
            classes_taught=metrics["classes_taught"],
            total_students=metrics["total_students"],
            subject_ratio=metrics["subject_ratio"]
        ))
    
    # Apply status filter if provided
    if status_filter:
        data = [t for t in data if t.status == status_filter]
        # Recalculate total for filtered results
        # Note: This is a simplified approach - in production, you'd want to filter in the query
        total = len(data)
    
    total_pages = (total + page_size - 1) // page_size
    
    return TeacherListResponse(
        data=data,
        pagination={
            "page": page,
            "page_size": page_size,
            "total": total,
            "total_pages": total_pages,
            "has_next": page < total_pages,
            "has_previous": page > 1
        }
    )


# ============================================================================
# Get Teacher Details
# ============================================================================

@router.get("/teachers/{teacher_id}", response_model=TeacherResponse)
async def get_teacher(
    teacher_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> TeacherResponse:
    """
    Get teacher details with assignments.
    
    Permission: SCHOOL_ADMIN, CAMPUS_ADMIN (if teacher in their campus)
    """
    # Get teacher with relationships
    query = select(Teacher).where(
        Teacher.id == teacher_id,
        Teacher.school_id == current_user.school_id
    ).options(
        selectinload(Teacher.user),
        selectinload(Teacher.campus),
        selectinload(Teacher.assignments).selectinload(TeacherClassAssignment.class_),
        selectinload(Teacher.assignments).selectinload(TeacherClassAssignment.subject),
        selectinload(Teacher.assignments).selectinload(TeacherClassAssignment.campus)
    )
    
    # Campus scoping for CAMPUS_ADMIN
    if current_user.role == "CAMPUS_ADMIN" and current_user.campus_id:
        query = query.where(Teacher.campus_id == current_user.campus_id)
    
    result = await db.execute(query)
    teacher = result.scalar_one_or_none()
    
    if not teacher:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error_code": "TEACHER_NOT_FOUND",
                "message": "Teacher not found",
                "recovery": "Verify the teacher ID"
            }
        )
    
    # Compute status
    status, status_reason = await compute_teacher_status(teacher.id, db)
    
    # Get current assignments (end_date IS NULL)
    current_assignments_query = select(TeacherClassAssignment).where(
        and_(
            TeacherClassAssignment.teacher_id == teacher_id,
            TeacherClassAssignment.end_date.is_(None)
        )
    ).options(
        selectinload(TeacherClassAssignment.class_),
        selectinload(TeacherClassAssignment.subject)
    ).order_by(TeacherClassAssignment.class_.name)
    
    current_assignments_result = await db.execute(current_assignments_query)
    current_assignments = current_assignments_result.scalars().all()
    
    # Group assignments by class
    assignments_by_class: dict[UUID, dict] = {}
    for assignment in current_assignments:
        class_id = assignment.class_id
        if class_id not in assignments_by_class:
            # Count students in this class
            student_count_result = await db.execute(
                select(func.count(Student.id)).select_from(
                    Student
                ).join(
                    StudentClassHistory,
                    and_(
                        Student.id == StudentClassHistory.student_id,
                        StudentClassHistory.class_id == class_id,
                        StudentClassHistory.end_date.is_(None),
                        Student.status == "ACTIVE"
                    )
                )
            )
            student_count = student_count_result.scalar_one() or 0
            
            assignments_by_class[class_id] = {
                "id": assignment.id,
                "class": assignment.class_,
                "subjects": [],
                "students_in_class": student_count,
                "start_date": assignment.start_date
            }
        
        assignments_by_class[class_id]["subjects"].append(assignment.subject)
    
    # Build current assignments response
    current_assignments_data = []
    for class_id, assignment_data in assignments_by_class.items():
        current_assignments_data.append(TeacherAssignmentResponse(
            id=assignment_data["id"],
            class_=ClassMinimalResponse(
                id=assignment_data["class"].id,
                name=assignment_data["class"].name
            ),
            subjects=[
                SubjectMinimalResponse(id=s.id, name=s.name)
                for s in assignment_data["subjects"]
            ],
            students_in_class=assignment_data["students_in_class"],
            start_date=assignment_data["start_date"],
            end_date=None
        ))
    
    # Get assignment history (end_date IS NOT NULL)
    history_query = select(TeacherClassAssignment).where(
        and_(
            TeacherClassAssignment.teacher_id == teacher_id,
            TeacherClassAssignment.end_date.isnot(None)
        )
    ).options(
        selectinload(TeacherClassAssignment.class_),
        selectinload(TeacherClassAssignment.subject)
    ).order_by(TeacherClassAssignment.end_date.desc())
    
    history_result = await db.execute(history_query)
    history_assignments = history_result.scalars().all()
    
    # Group history by class and date range
    history_by_class: dict[tuple[UUID, date, date], dict] = {}
    for assignment in history_assignments:
        key = (assignment.class_id, assignment.start_date, assignment.end_date)
        if key not in history_by_class:
            duration = (assignment.end_date - assignment.start_date).days
            history_by_class[key] = {
                "id": assignment.id,
                "class": assignment.class_,
                "subjects": [],
                "start_date": assignment.start_date,
                "end_date": assignment.end_date,
                "duration_days": duration
            }
        history_by_class[key]["subjects"].append(assignment.subject)
    
    # Build history response
    history_data = []
    for key, assignment_data in history_by_class.items():
        history_data.append(TeacherAssignmentHistoryResponse(
            id=assignment_data["id"],
            class_=ClassMinimalResponse(
                id=assignment_data["class"].id,
                name=assignment_data["class"].name
            ),
            subjects=[
                SubjectMinimalResponse(id=s.id, name=s.name)
                for s in assignment_data["subjects"]
            ],
            start_date=assignment_data["start_date"],
            end_date=assignment_data["end_date"],
            duration_days=assignment_data["duration_days"]
        ))
    
    return TeacherResponse(
        id=teacher.id,
        user_id=teacher.user_id,
        salutation=teacher.salutation,
        first_name=teacher.user.first_name,
        middle_name=teacher.middle_name,
        last_name=teacher.user.last_name,
        phone_number=teacher.user.phone_number,
        email=teacher.user.email,
        national_id=teacher.national_id,
        tsc_number=teacher.tsc_number,
        date_of_birth=teacher.date_of_birth,
        gender=teacher.gender,
        campus=CampusMinimalResponse(
            id=teacher.campus.id,
            name=teacher.campus.name
        ),
        status=status,
        status_reason=status_reason,
        current_assignments=current_assignments_data,
        assignment_history=history_data,
        created_at=teacher.created_at.isoformat(),
        updated_at=teacher.updated_at.isoformat() if teacher.updated_at else None
    )


# ============================================================================
# Create Teacher
# ============================================================================

@router.post("/teachers", response_model=dict, status_code=status.HTTP_201_CREATED)
async def create_teacher(
    teacher_data: TeacherCreate,
    current_user: User = Depends(require_campus_admin),
    db: AsyncSession = Depends(get_db)
) -> dict:
    """
    Create a new teacher account.
    
    Creates a User with role=TEACHER and status=INACTIVE (until assigned).
    Creates a Teacher record with all teacher-specific fields.
    Generates account setup token.
    
    Permission: SCHOOL_ADMIN, CAMPUS_ADMIN
    """
    # CAMPUS_ADMIN must use their campus
    if current_user.role == "CAMPUS_ADMIN":
        if teacher_data.campus_id != current_user.campus_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "error_code": "FORBIDDEN_ACTION",
                    "message": "You can only create teachers in your campus",
                    "recovery": "Use your campus ID"
                }
            )
    
    # Verify campus exists and belongs to school
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
    
    # Check if email already exists (if provided)
    if teacher_data.email:
        existing_email_result = await db.execute(
            select(User).where(
                User.email == teacher_data.email,
                User.school_id == current_user.school_id
            )
        )
        if existing_email_result.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={
                    "error_code": "DUPLICATE_EMAIL",
                    "message": "Email already exists in this school",
                    "recovery": "Use a different email"
                }
            )
    
    # Check if phone already exists
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
                "error_code": "DUPLICATE_PHONE_NUMBER",
                "message": "Phone number already exists in this school",
                "recovery": "Use a different phone number"
            }
        )
    
    # Check if national_id already exists
    existing_national_id_result = await db.execute(
        select(Teacher).where(
            Teacher.national_id == teacher_data.national_id,
            Teacher.school_id == current_user.school_id
        )
    )
    if existing_national_id_result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "error_code": "DUPLICATE_NATIONAL_ID",
                "message": "National ID already exists in this school",
                "recovery": "Use a different national ID"
            }
        )
    
    # Create user with role=TEACHER, status=INACTIVE (until assigned)
    new_user = User(
        school_id=current_user.school_id,
        campus_id=teacher_data.campus_id,
        email=teacher_data.email or f"teacher_{teacher_data.phone_number.replace('+', '').replace('-', '')}@school.local",
        phone_number=teacher_data.phone_number,
        first_name=teacher_data.first_name,
        last_name=teacher_data.last_name,
        role="TEACHER",
        status="INACTIVE",  # Will become ACTIVE when assigned to a class
        password_hash=None,  # Pending setup
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC),
    )
    
    db.add(new_user)
    await db.flush()
    
    # Create teacher record
    new_teacher = Teacher(
        user_id=new_user.id,
        school_id=current_user.school_id,
        salutation=teacher_data.salutation,
        middle_name=teacher_data.middle_name,
        national_id=teacher_data.national_id,
        tsc_number=teacher_data.tsc_number,
        date_of_birth=teacher_data.date_of_birth,
        gender=teacher_data.gender,
        campus_id=teacher_data.campus_id,
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC),
    )
    
    db.add(new_teacher)
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
    await db.refresh(new_teacher)
    await db.refresh(new_user)
    
    # TODO: Queue SMS with setup link
    
    return {
        "id": str(new_teacher.id),
        "name": format_teacher_name(new_teacher),
        "status": "INACTIVE",
        "campus": {
            "id": str(campus.id),
            "name": campus.name
        },
        "setup_token": setup_token  # TODO: Remove in production
    }


# ============================================================================
# Update Teacher
# ============================================================================

@router.put("/teachers/{teacher_id}", response_model=TeacherResponse)
async def update_teacher(
    teacher_id: UUID,
    teacher_data: TeacherUpdate,
    current_user: User = Depends(require_campus_admin),
    db: AsyncSession = Depends(get_db)
) -> TeacherResponse:
    """
    Update teacher details.
    
    Cannot update: campus_id (immutable), national_id (immutable)
    
    Permission: SCHOOL_ADMIN, CAMPUS_ADMIN (if teacher in their campus)
    """
    # Get teacher
    query = select(Teacher).where(
        Teacher.id == teacher_id,
        Teacher.school_id == current_user.school_id
    ).options(
        selectinload(Teacher.user),
        selectinload(Teacher.campus)
    )
    
    # Campus scoping for CAMPUS_ADMIN
    if current_user.role == "CAMPUS_ADMIN" and current_user.campus_id:
        query = query.where(Teacher.campus_id == current_user.campus_id)
    
    result = await db.execute(query)
    teacher = result.scalar_one_or_none()
    
    if not teacher:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error_code": "TEACHER_NOT_FOUND",
                "message": "Teacher not found",
                "recovery": "Verify the teacher ID"
            }
        )
    
    # Update user fields
    if teacher_data.first_name is not None:
        teacher.user.first_name = teacher_data.first_name
    if teacher_data.last_name is not None:
        teacher.user.last_name = teacher_data.last_name
    if teacher_data.phone_number is not None:
        # Check for duplicate phone
        existing_phone = await db.execute(
            select(User).where(
                User.phone_number == teacher_data.phone_number,
                User.school_id == current_user.school_id,
                User.id != teacher.user_id
            )
        )
        if existing_phone.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={
                    "error_code": "DUPLICATE_PHONE_NUMBER",
                    "message": "Phone number already exists in this school",
                    "recovery": "Use a different phone number"
                }
            )
        teacher.user.phone_number = teacher_data.phone_number
    if teacher_data.email is not None:
        # Check for duplicate email
        existing_email = await db.execute(
            select(User).where(
                User.email == teacher_data.email,
                User.school_id == current_user.school_id,
                User.id != teacher.user_id
            )
        )
        if existing_email.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={
                    "error_code": "DUPLICATE_EMAIL",
                    "message": "Email already exists in this school",
                    "recovery": "Use a different email"
                }
            )
        teacher.user.email = teacher_data.email
    
    # Update teacher-specific fields
    if teacher_data.salutation is not None:
        teacher.salutation = teacher_data.salutation
    if teacher_data.middle_name is not None:
        teacher.middle_name = teacher_data.middle_name
    if teacher_data.tsc_number is not None:
        teacher.tsc_number = teacher_data.tsc_number
    if teacher_data.date_of_birth is not None:
        teacher.date_of_birth = teacher_data.date_of_birth
    if teacher_data.gender is not None:
        teacher.gender = teacher_data.gender
    
    teacher.updated_at = datetime.now(UTC)
    teacher.user.updated_at = datetime.now(UTC)
    
    await db.commit()
    await db.refresh(teacher)
    
    # Return full teacher details (reuse get_teacher logic)
    return await get_teacher(teacher_id, current_user, db)


# ============================================================================
# Create Assignment
# ============================================================================

@router.post("/teachers/{teacher_id}/assignments", response_model=AssignmentCreateResponse, status_code=status.HTTP_201_CREATED)
async def create_assignment(
    teacher_id: UUID,
    assignment_data: TeacherAssignmentCreate,
    current_user: User = Depends(require_campus_admin),
    db: AsyncSession = Depends(get_db)
) -> AssignmentCreateResponse:
    """
    Create teacher assignment(s) to a class and subjects.
    
    Creates one row per (teacher, class, subject) combination.
    
    Permission: SCHOOL_ADMIN, CAMPUS_ADMIN (if teacher in their campus)
    """
    # Get teacher
    teacher_result = await db.execute(
        select(Teacher).where(
            Teacher.id == teacher_id,
            Teacher.school_id == current_user.school_id
        ).options(
            selectinload(Teacher.campus)
        )
    )
    teacher = teacher_result.scalar_one_or_none()
    
    if not teacher:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error_code": "TEACHER_NOT_FOUND",
                "message": "Teacher not found",
                "recovery": "Verify the teacher ID"
            }
        )
    
    # Campus scoping for CAMPUS_ADMIN
    if current_user.role == "CAMPUS_ADMIN" and current_user.campus_id:
        if teacher.campus_id != current_user.campus_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "error_code": "FORBIDDEN_ACTION",
                    "message": "You can only manage teachers in your campus",
                    "recovery": "This teacher belongs to a different campus"
                }
            )
    
    # Get class
    class_result = await db.execute(
        select(Class).where(
            Class.id == assignment_data.class_id,
            Class.campus.school_id == current_user.school_id
        ).options(
            selectinload(Class.campus),
            selectinload(Class.academic_year)
        )
    )
    class_obj = class_result.scalar_one_or_none()
    
    if not class_obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error_code": "CLASS_NOT_FOUND",
                "message": "Class not found",
                "recovery": "Verify the class ID"
            }
        )
    
    # Validate campus match
    await validate_campus_match(teacher, class_obj, db)
    
    # Validate active class
    await validate_active_class(assignment_data.class_id, db)
    
    # Validate all subjects belong to class
    for subject_id in assignment_data.subject_ids:
        await validate_subject_class_compatibility(subject_id, assignment_data.class_id, db)
    
    # Check for duplicate assignments
    start_date = assignment_data.start_date or date.today()
    
    existing_assignments_result = await db.execute(
        select(TeacherClassAssignment).where(
            TeacherClassAssignment.teacher_id == teacher_id,
            TeacherClassAssignment.class_id == assignment_data.class_id,
            TeacherClassAssignment.subject_id.in_(assignment_data.subject_ids),
            TeacherClassAssignment.end_date.is_(None)
        )
    )
    existing_assignments = existing_assignments_result.scalars().all()
    
    if existing_assignments:
        # Get subject names for error
        subject_ids_in_conflict = [a.subject_id for a in existing_assignments]
        subjects_result = await db.execute(
            select(Subject).where(Subject.id.in_(subject_ids_in_conflict))
        )
        subjects = subjects_result.scalars().all()
        subject_names = [s.name for s in subjects]
        
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "error_code": "DUPLICATE_ASSIGNMENT",
                "message": f"Teacher is already assigned to teach {', '.join(subject_names)} in {class_obj.name}",
                "recovery": "This assignment already exists"
            }
        )
    
    # Create assignments (one per subject)
    created_assignments = []
    for subject_id in assignment_data.subject_ids:
        new_assignment = TeacherClassAssignment(
            teacher_id=teacher_id,
            class_id=assignment_data.class_id,
            subject_id=subject_id,
            campus_id=teacher.campus_id,  # Denormalized for constraint enforcement
            start_date=start_date,
            end_date=None,  # Active assignment
            created_at=datetime.now(UTC),
            updated_at=datetime.now(UTC),
        )
        db.add(new_assignment)
        await db.flush()
        created_assignments.append(new_assignment)
    
    await db.commit()
    
    # Refresh assignments with relationships
    for assignment in created_assignments:
        await db.refresh(assignment, ["class_", "subject"])
    
    # Compute updated teacher status
    updated_status, _ = await compute_teacher_status(teacher_id, db)
    
    # Build response
    assignments_response = []
    for assignment in created_assignments:
        # Count students in class
        student_count_result = await db.execute(
            select(func.count(Student.id)).select_from(
                Student
            ).join(
                StudentClassHistory,
                and_(
                    Student.id == StudentClassHistory.student_id,
                    StudentClassHistory.class_id == assignment.class_id,
                    StudentClassHistory.end_date.is_(None),
                    Student.status == "ACTIVE"
                )
            )
        )
        student_count = student_count_result.scalar_one() or 0
        
        assignments_response.append(TeacherAssignmentResponse(
            id=assignment.id,
            class_=ClassMinimalResponse(
                id=assignment.class_.id,
                name=assignment.class_.name
            ),
            subjects=[SubjectMinimalResponse(
                id=assignment.subject.id,
                name=assignment.subject.name
            )],
            students_in_class=student_count,
            start_date=assignment.start_date,
            end_date=assignment.end_date
        ))
    
    return AssignmentCreateResponse(
        assignments=assignments_response,
        teacher_status=updated_status
    )


# ============================================================================
# Bulk Create Assignments
# ============================================================================

@router.post("/teachers/{teacher_id}/assignments/bulk", response_model=AssignmentBulkCreateResponse, status_code=status.HTTP_201_CREATED)
async def create_bulk_assignments(
    teacher_id: UUID,
    bulk_data: TeacherAssignmentBulkCreate,
    current_user: User = Depends(require_campus_admin),
    db: AsyncSession = Depends(get_db)
) -> AssignmentBulkCreateResponse:
    """
    Create multiple teacher assignments atomically.
    
    Permission: SCHOOL_ADMIN, CAMPUS_ADMIN (if teacher in their campus)
    """
    # Get teacher
    teacher_result = await db.execute(
        select(Teacher).where(
            Teacher.id == teacher_id,
            Teacher.school_id == current_user.school_id
        ).options(
            selectinload(Teacher.campus)
        )
    )
    teacher = teacher_result.scalar_one_or_none()
    
    if not teacher:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error_code": "TEACHER_NOT_FOUND",
                "message": "Teacher not found",
                "recovery": "Verify the teacher ID"
            }
        )
    
    # Campus scoping for CAMPUS_ADMIN
    if current_user.role == "CAMPUS_ADMIN" and current_user.campus_id:
        if teacher.campus_id != current_user.campus_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "error_code": "FORBIDDEN_ACTION",
                    "message": "You can only manage teachers in your campus",
                    "recovery": "This teacher belongs to a different campus"
                }
            )
    
    start_date = bulk_data.start_date or date.today()
    
    # Validate all assignments before creating any
    all_subject_ids = []
    for assignment_item in bulk_data.assignments:
        # Get class
        class_result = await db.execute(
            select(Class).where(
                Class.id == assignment_item.class_id,
                Class.campus.school_id == current_user.school_id
            ).options(
                selectinload(Class.campus),
                selectinload(Class.academic_year)
            )
        )
        class_obj = class_result.scalar_one_or_none()
        
        if not class_obj:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={
                    "error_code": "CLASS_NOT_FOUND",
                    "message": f"Class not found: {assignment_item.class_id}",
                    "recovery": "Verify the class ID"
                }
            )
        
        # Validate campus match
        await validate_campus_match(teacher, class_obj, db)
        
        # Validate active class
        await validate_active_class(assignment_item.class_id, db)
        
        # Validate subjects
        for subject_id in assignment_item.subject_ids:
            await validate_subject_class_compatibility(subject_id, assignment_item.class_id, db)
            all_subject_ids.append((assignment_item.class_id, subject_id))
    
    # Check for duplicates
    existing_assignments_result = await db.execute(
        select(TeacherClassAssignment).where(
            TeacherClassAssignment.teacher_id == teacher_id,
            TeacherClassAssignment.end_date.is_(None)
        )
    )
    existing_assignments = existing_assignments_result.scalars().all()
    
    existing_keys = {(a.class_id, a.subject_id) for a in existing_assignments}
    new_keys = set(all_subject_ids)
    
    duplicates = existing_keys & new_keys
    if duplicates:
        # Get class and subject names for error
        duplicate_info = []
        for class_id, subject_id in list(duplicates)[:3]:  # Limit to first 3
            class_result = await db.execute(
                select(Class).where(Class.id == class_id)
            )
            class_obj = class_result.scalar_one()
            
            subject_result = await db.execute(
                select(Subject).where(Subject.id == subject_id)
            )
            subject = subject_result.scalar_one()
            
            duplicate_info.append(f"{subject.name} in {class_obj.name}")
        
        error_msg = ", ".join(duplicate_info)
        if len(duplicates) > 3:
            error_msg += f" and {len(duplicates) - 3} more"
        
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "error_code": "DUPLICATE_ASSIGNMENT",
                "message": f"Teacher already assigned to: {error_msg}",
                "recovery": "Remove duplicate assignments from the request"
            }
        )
    
    # Create all assignments
    created_assignments = []
    for assignment_item in bulk_data.assignments:
        for subject_id in assignment_item.subject_ids:
            new_assignment = TeacherClassAssignment(
                teacher_id=teacher_id,
                class_id=assignment_item.class_id,
                subject_id=subject_id,
                campus_id=teacher.campus_id,
                start_date=start_date,
                end_date=None,
                created_at=datetime.now(UTC),
                updated_at=datetime.now(UTC),
            )
            db.add(new_assignment)
            await db.flush()
            created_assignments.append(new_assignment)
    
    await db.commit()
    
    # Refresh with relationships
    for assignment in created_assignments:
        await db.refresh(assignment, ["class_", "subject"])
    
    # Compute updated status
    updated_status, _ = await compute_teacher_status(teacher_id, db)
    
    # Build response (group by class)
    assignments_by_class: dict[UUID, dict] = {}
    for assignment in created_assignments:
        class_id = assignment.class_id
        if class_id not in assignments_by_class:
            # Count students
            student_count_result = await db.execute(
                select(func.count(Student.id)).select_from(
                    Student
                ).join(
                    StudentClassHistory,
                    and_(
                        Student.id == StudentClassHistory.student_id,
                        StudentClassHistory.class_id == class_id,
                        StudentClassHistory.end_date.is_(None),
                        Student.status == "ACTIVE"
                    )
                )
            )
            student_count = student_count_result.scalar_one() or 0
            
            assignments_by_class[class_id] = {
                "id": assignment.id,
                "class": assignment.class_,
                "subjects": [],
                "students_in_class": student_count,
                "start_date": assignment.start_date
            }
        
        assignments_by_class[class_id]["subjects"].append(assignment.subject)
    
    assignments_response = []
    for class_id, assignment_data in assignments_by_class.items():
        assignments_response.append(TeacherAssignmentResponse(
            id=assignment_data["id"],
            class_=ClassMinimalResponse(
                id=assignment_data["class"].id,
                name=assignment_data["class"].name
            ),
            subjects=[
                SubjectMinimalResponse(id=s.id, name=s.name)
                for s in assignment_data["subjects"]
            ],
            students_in_class=assignment_data["students_in_class"],
            start_date=assignment_data["start_date"],
            end_date=None
        ))
    
    return AssignmentBulkCreateResponse(
        created_count=len(created_assignments),
        assignments=assignments_response,
        teacher_status=updated_status
    )


# ============================================================================
# Remove Assignment
# ============================================================================

@router.delete("/teachers/{teacher_id}/assignments/{assignment_id}", response_model=AssignmentRemoveResponse)
async def remove_assignment(
    teacher_id: UUID,
    assignment_id: UUID,
    current_user: User = Depends(require_campus_admin),
    db: AsyncSession = Depends(get_db)
) -> AssignmentRemoveResponse:
    """
    End teacher assignment (soft delete).
    
    Sets end_date = CURRENT_DATE and recomputes teacher status.
    
    Permission: SCHOOL_ADMIN, CAMPUS_ADMIN (if teacher in their campus)
    """
    # Get teacher
    teacher_result = await db.execute(
        select(Teacher).where(
            Teacher.id == teacher_id,
            Teacher.school_id == current_user.school_id
        )
    )
    teacher = teacher_result.scalar_one_or_none()
    
    if not teacher:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error_code": "TEACHER_NOT_FOUND",
                "message": "Teacher not found",
                "recovery": "Verify the teacher ID"
            }
        )
    
    # Campus scoping for CAMPUS_ADMIN
    if current_user.role == "CAMPUS_ADMIN" and current_user.campus_id:
        if teacher.campus_id != current_user.campus_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "error_code": "FORBIDDEN_ACTION",
                    "message": "You can only manage teachers in your campus",
                    "recovery": "This teacher belongs to a different campus"
                }
            )
    
    # Get assignment
    assignment_result = await db.execute(
        select(TeacherClassAssignment).where(
            TeacherClassAssignment.id == assignment_id,
            TeacherClassAssignment.teacher_id == teacher_id,
            TeacherClassAssignment.end_date.is_(None)  # Only active assignments
        )
    )
    assignment = assignment_result.scalar_one_or_none()
    
    if not assignment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error_code": "ASSIGNMENT_NOT_FOUND",
                "message": "Assignment not found or already ended",
                "recovery": "Verify the assignment ID"
            }
        )
    
    # Soft delete: set end_date
    end_date = date.today()
    assignment.end_date = end_date
    assignment.updated_at = datetime.now(UTC)
    
    await db.commit()
    
    # Recompute teacher status
    updated_status, _ = await compute_teacher_status(teacher_id, db)
    
    return AssignmentRemoveResponse(
        id=assignment.id,
        end_date=end_date,
        teacher_status=updated_status
    )
