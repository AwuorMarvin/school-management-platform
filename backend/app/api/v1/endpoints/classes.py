"""
Class endpoints - CRUD operations for classes.
"""

from typing import Optional
from uuid import UUID
from datetime import datetime, UTC, date, timedelta

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy import select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.deps import get_current_user, require_campus_admin
from app.models import Class
from app.models.campus import Campus
from app.models.academic_year import AcademicYear
from app.models.student_class_history import StudentClassHistory
from app.models.student_academic_enrollment import StudentAcademicEnrollment
from app.models.student import Student
from app.models.teacher_class_assignment import TeacherClassAssignment
from app.models.user import User
from app.models.subject import Subject
from app.models.class_subject import ClassSubject
from app.models.term import Term
# Import class schemas (class is reserved keyword, so use importlib)
import importlib
class_schemas = importlib.import_module("app.schemas.class")
ClassCreate = class_schemas.ClassCreate
ClassUpdate = class_schemas.ClassUpdate
ClassResponse = class_schemas.ClassResponse
ClassListResponse = class_schemas.ClassListResponse
from app.schemas.student_class_assignment import AssignStudentToClass
from app.schemas.teacher_assignment import AssignTeacherToClass

router = APIRouter()


# ============================================================================
# List Classes
# ============================================================================

@router.get("/classes", response_model=dict)
async def list_classes(
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Number of records per page"),
    campus_id: Optional[UUID] = Query(None, description="Filter by campus ID"),
    academic_year_id: Optional[UUID] = Query(None, description="Filter by academic year ID"),
    search: Optional[str] = Query(None, description="Search by class name"),
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> dict:
    """
    List all classes for the current user's school.
    
    Permission: All authenticated users
    """
    offset = (page - 1) * page_size
    
    # Build query - join with campus to filter by school_id
    query = select(Class).join(Campus).where(Campus.school_id == current_user.school_id)
    count_query = select(func.count(Class.id)).join(Campus).where(Campus.school_id == current_user.school_id)
    
    # Apply role-based filtering
    if current_user.role == "CAMPUS_ADMIN" and current_user.campus_id:
        query = query.where(Class.campus_id == current_user.campus_id)
        count_query = count_query.where(Class.campus_id == current_user.campus_id)
    elif current_user.role == "SCHOOL_ADMIN" and campus_id:
        # Verify campus belongs to school
        campus_check = await db.execute(
            select(Campus).where(
                Campus.id == campus_id,
                Campus.school_id == current_user.school_id
            )
        )
        if not campus_check.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"error_code": "CAMPUS_NOT_FOUND", "message": "Campus not found"}
            )
        query = query.where(Class.campus_id == campus_id)
        count_query = count_query.where(Class.campus_id == campus_id)
    # TODO: Add TEACHER and PARENT filtering
    
    # Apply academic year filter
    if academic_year_id:
        # Verify academic year belongs to school
        ay_check = await db.execute(
            select(AcademicYear).where(
                AcademicYear.id == academic_year_id,
                AcademicYear.school_id == current_user.school_id
            )
        )
        if not ay_check.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"error_code": "ACADEMIC_YEAR_NOT_FOUND", "message": "Academic year not found"}
            )
        query = query.where(Class.academic_year_id == academic_year_id)
        count_query = count_query.where(Class.academic_year_id == academic_year_id)
    
    # Apply search filter
    if search:
        search_pattern = f"%{search}%"
        query = query.where(Class.name.ilike(search_pattern))
        count_query = count_query.where(Class.name.ilike(search_pattern))
    
    # Get total count
    total = (await db.execute(count_query)).scalar_one()
    
    # Apply pagination and ordering
    query = query.order_by(Class.name).offset(offset).limit(page_size)
    
    # Eager load relationships
    query = query.options(
        selectinload(Class.campus),
        selectinload(Class.academic_year),
        selectinload(Class.student_assignments)
    )
    
    result = await db.execute(query)
    classes = result.scalars().all()
    
    data = []
    for cls in classes:
        # Count active student assignments
        active_assignments = [a for a in cls.student_assignments if a.end_date is None]
        student_count = len(active_assignments)
        
        data.append({
            "id": str(cls.id),
            "campus_id": str(cls.campus_id),
            "academic_year_id": str(cls.academic_year_id),
            "name": cls.name,
            "capacity": cls.capacity,
            "created_at": cls.created_at.isoformat(),
            "updated_at": cls.updated_at.isoformat(),
            "campus": {
                "id": str(cls.campus.id),
                "name": cls.campus.name,
            } if cls.campus else None,
            "academic_year": {
                "id": str(cls.academic_year.id),
                "name": cls.academic_year.name,
            } if cls.academic_year else None,
            "student_count": student_count,
        })
    
    return {
        "data": data,
        "pagination": {
            "page": page,
            "page_size": page_size,
            "total": total,
            "total_pages": (total + page_size - 1) // page_size,
            "has_next": (page * page_size) < total,
            "has_previous": page > 1,
        }
    }


# ============================================================================
# Get Class
# ============================================================================

@router.get("/classes/{class_id}", response_model=dict)
async def get_class(
    class_id: UUID,
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> dict:
    """
    Get class details.
    
    Permission: All authenticated users with access to this class
    """
    result = await db.execute(
        select(Class)
        .join(Campus)
        .where(
            Class.id == class_id,
            Campus.school_id == current_user.school_id
        )
        .options(
            selectinload(Class.campus),
            selectinload(Class.academic_year),
            selectinload(Class.student_assignments)
        )
    )
    cls = result.scalar_one_or_none()
    
    if not cls:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error_code": "CLASS_NOT_FOUND",
                "message": "Class not found",
                "recovery": "Check the class ID"
            }
        )
    
    # Count active student assignments
    active_assignments = [a for a in cls.student_assignments if a.end_date is None]
    student_count = len(active_assignments)
    
    return {
        "id": str(cls.id),
        "campus_id": str(cls.campus_id),
        "academic_year_id": str(cls.academic_year_id),
        "name": cls.name,
        "capacity": cls.capacity,
        "created_at": cls.created_at.isoformat(),
        "updated_at": cls.updated_at.isoformat(),
        "campus": {
            "id": str(cls.campus.id),
            "name": cls.campus.name,
        } if cls.campus else None,
        "academic_year": {
            "id": str(cls.academic_year.id),
            "name": cls.academic_year.name,
        } if cls.academic_year else None,
        "student_count": student_count,
    }


# ============================================================================
# Create Class
# ============================================================================

@router.post("/classes", response_model=dict, status_code=status.HTTP_201_CREATED)
async def create_class(
    class_data: ClassCreate,
    current_user = Depends(require_campus_admin),
    db: AsyncSession = Depends(get_db)
) -> dict:
    """
    Create a new class.
    
    Permission: SCHOOL_ADMIN, CAMPUS_ADMIN
    """
    # Verify campus belongs to school
    campus_result = await db.execute(
        select(Campus).where(
            Campus.id == class_data.campus_id,
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
    
    # CAMPUS_ADMIN can only create classes in their campus
    if current_user.role == "CAMPUS_ADMIN":
        if current_user.campus_id != class_data.campus_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "error_code": "FORBIDDEN_ACTION",
                    "message": "You can only create classes in your campus",
                    "recovery": "Use your campus ID"
                }
            )
    
    # Verify academic year belongs to school
    ay_result = await db.execute(
        select(AcademicYear).where(
            AcademicYear.id == class_data.academic_year_id,
            AcademicYear.school_id == current_user.school_id
        )
    )
    academic_year = ay_result.scalar_one_or_none()
    
    if not academic_year:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error_code": "ACADEMIC_YEAR_NOT_FOUND",
                "message": "Academic year not found or does not belong to your school",
                "recovery": "Verify the academic year ID"
            }
        )
    
    # Check for duplicate class name within campus+academic_year
    duplicate_check = await db.execute(
        select(Class).where(
            Class.campus_id == class_data.campus_id,
            Class.academic_year_id == class_data.academic_year_id,
            Class.name == class_data.name
        )
    )
    if duplicate_check.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "error_code": "DUPLICATE_CLASS_NAME",
                "message": f"A class named '{class_data.name}' already exists for this campus and academic year",
                "recovery": "Choose a different class name"
            }
        )
    
    # Create class
    cls = Class(
        campus_id=class_data.campus_id,
        academic_year_id=class_data.academic_year_id,
        name=class_data.name,
        capacity=class_data.capacity,
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC),
    )
    
    db.add(cls)
    await db.flush()  # Get cls.id
    
    # Assign subjects if provided
    if class_data.subject_ids:
        # Verify all subjects exist and belong to school
        subjects_result = await db.execute(
            select(Subject).where(
                Subject.id.in_(class_data.subject_ids),
                Subject.school_id == current_user.school_id
            )
        )
        subjects = subjects_result.scalars().all()
        
        if len(subjects) != len(class_data.subject_ids):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={
                    "error_code": "SUBJECT_NOT_FOUND",
                    "message": "One or more subjects not found or do not belong to your school",
                    "recovery": "Verify all subject IDs"
                }
            )
        
        # Create class-subject links
        for subject in subjects:
            class_subject = ClassSubject(
                class_id=cls.id,
                subject_id=subject.id,
                created_at=datetime.now(UTC),
                updated_at=datetime.now(UTC),
            )
            db.add(class_subject)
    
    await db.commit()
    await db.refresh(cls)
    
    # Load relationships for response
    await db.refresh(cls, ["campus", "academic_year"])
    
    return {
        "id": str(cls.id),
        "campus_id": str(cls.campus_id),
        "academic_year_id": str(cls.academic_year_id),
        "name": cls.name,
        "capacity": cls.capacity,
        "created_at": cls.created_at.isoformat(),
        "updated_at": cls.updated_at.isoformat(),
        "campus": {
            "id": str(cls.campus.id),
            "name": cls.campus.name,
        } if cls.campus else None,
        "academic_year": {
            "id": str(cls.academic_year.id),
            "name": cls.academic_year.name,
        } if cls.academic_year else None,
        "student_count": 0,
    }


# ============================================================================
# Update Class
# ============================================================================

@router.put("/classes/{class_id}", response_model=dict)
async def update_class(
    class_id: UUID,
    class_data: ClassUpdate,
    current_user = Depends(require_campus_admin),
    db: AsyncSession = Depends(get_db)
) -> dict:
    """
    Update class information.
    
    Permission: SCHOOL_ADMIN, CAMPUS_ADMIN (if their campus)
    """
    result = await db.execute(
        select(Class)
        .join(Campus)
        .where(
            Class.id == class_id,
            Campus.school_id == current_user.school_id
        )
        .options(selectinload(Class.campus), selectinload(Class.academic_year))
    )
    cls = result.scalar_one_or_none()
    
    if not cls:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error_code": "CLASS_NOT_FOUND",
                "message": "Class not found",
                "recovery": "Check the class ID"
            }
        )
    
    # CAMPUS_ADMIN can only update classes in their campus
    if current_user.role == "CAMPUS_ADMIN":
        if current_user.campus_id != cls.campus_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "error_code": "FORBIDDEN_ACTION",
                    "message": "You can only update classes in your campus",
                    "recovery": "Contact school admin"
                }
            )
    
    # Update fields
    update_data = class_data.model_dump(exclude_unset=True, exclude={"subject_ids"})
    
    # Check for name conflict if name is being updated
    if "name" in update_data and update_data["name"] != cls.name:
        duplicate_check = await db.execute(
            select(Class).where(
                Class.campus_id == cls.campus_id,
                Class.academic_year_id == cls.academic_year_id,
                Class.name == update_data["name"],
                Class.id != class_id
            )
        )
        if duplicate_check.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={
                    "error_code": "DUPLICATE_CLASS_NAME",
                    "message": f"A class named '{update_data['name']}' already exists for this campus and academic year",
                    "recovery": "Choose a different class name"
                }
            )
    
    # Apply updates
    for key, value in update_data.items():
        setattr(cls, key, value)
    
    cls.updated_at = datetime.now(UTC)
    
    # Update subject assignments if provided
    if "subject_ids" in class_data.model_dump(exclude_unset=True):
        new_subject_ids = set(class_data.subject_ids or [])
        
        # Verify all subjects exist and belong to school
        if new_subject_ids:
            subjects_result = await db.execute(
                select(Subject).where(
                    Subject.id.in_(new_subject_ids),
                    Subject.school_id == current_user.school_id
                )
            )
            subjects = subjects_result.scalars().all()
            
            if len(subjects) != len(new_subject_ids):
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail={
                        "error_code": "SUBJECT_NOT_FOUND",
                        "message": "One or more subjects not found or do not belong to your school",
                        "recovery": "Verify all subject IDs"
                    }
                )
        
        # Get current subject assignments
        current_assignments = await db.execute(
            select(ClassSubject).where(ClassSubject.class_id == class_id)
        )
        current_subject_ids = {str(cs.subject_id) for cs in current_assignments.scalars().all()}
        
        # Remove assignments that are no longer in the new list
        for assignment in current_assignments.scalars().all():
            if str(assignment.subject_id) not in {str(sid) for sid in new_subject_ids}:
                await db.delete(assignment)
        
        # Add new assignments
        existing_subject_ids = {str(cs.subject_id) for cs in cls.class_subjects if hasattr(cls, 'class_subjects')}
        for subject_id in new_subject_ids:
            if str(subject_id) not in existing_subject_ids:
                class_subject = ClassSubject(
                    class_id=class_id,
                    subject_id=subject_id,
                    created_at=datetime.now(UTC),
                    updated_at=datetime.now(UTC),
                )
                db.add(class_subject)
    
    await db.commit()
    await db.refresh(cls)
    
    # Count active student assignments
    await db.refresh(cls, ["student_assignments"])
    active_assignments = [a for a in cls.student_assignments if a.end_date is None]
    student_count = len(active_assignments)
    
    return {
        "id": str(cls.id),
        "campus_id": str(cls.campus_id),
        "academic_year_id": str(cls.academic_year_id),
        "name": cls.name,
        "capacity": cls.capacity,
        "created_at": cls.created_at.isoformat(),
        "updated_at": cls.updated_at.isoformat(),
        "campus": {
            "id": str(cls.campus.id),
            "name": cls.campus.name,
        } if cls.campus else None,
        "academic_year": {
            "id": str(cls.academic_year.id),
            "name": cls.academic_year.name,
        } if cls.academic_year else None,
        "student_count": student_count,
    }



# ============================================================================
# Assign Student to Class
# ============================================================================

@router.post("/classes/{class_id}/students", response_model=dict, status_code=status.HTTP_201_CREATED)
async def assign_student_to_class(
    class_id: UUID,
    assignment_data: AssignStudentToClass,
    current_user = Depends(require_campus_admin),
    db: AsyncSession = Depends(get_db)
) -> dict:
    """
    Assign a student to a class. Automatically creates/updates academic enrollment.
    
    Permission: SCHOOL_ADMIN, CAMPUS_ADMIN
    
    Business Logic:
    1. Verify class exists and belongs to school
    2. Verify student exists and belongs to school
    3. Close previous active class assignment (if any)
    4. Create new class assignment
    5. Close previous active academic enrollment (if any)
    6. Create new academic enrollment matching class's academic_year and term
    7. Validate at least one active enrollment exists (for active students)
    """
    # Verify class exists and belongs to school
    class_result = await db.execute(
        select(Class)
        .join(Campus)
        .where(
            Class.id == class_id,
            Campus.school_id == current_user.school_id
        )
        .options(selectinload(Class.academic_year))
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
                    "message": "You can only assign students to classes in your campus",
                    "recovery": "Contact school admin"
                }
            )
    
    # Verify student exists and belongs to school
    student_result = await db.execute(
        select(Student).where(
            Student.id == assignment_data.student_id,
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
    
    # Check if student is already in this class
    existing_assignment_result = await db.execute(
        select(StudentClassHistory).where(
            StudentClassHistory.student_id == assignment_data.student_id,
            StudentClassHistory.class_id == class_id,
            StudentClassHistory.end_date.is_(None)
        )
    )
    if existing_assignment_result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "error_code": "STUDENT_ALREADY_IN_CLASS",
                "message": "Student is already assigned to this class",
                "recovery": "Student is currently in this class"
            }
        )
    
    # Check class capacity
    if cls.capacity:
        active_count_result = await db.execute(
            select(func.count(StudentClassHistory.id)).where(
                StudentClassHistory.class_id == class_id,
                StudentClassHistory.end_date.is_(None)
            )
        )
        active_count = active_count_result.scalar_one() or 0
        if active_count >= cls.capacity:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "error_code": "CLASS_AT_CAPACITY",
                    "message": f"Class has reached maximum capacity of {cls.capacity} students",
                    "recovery": "Increase class capacity or assign to a different class"
                }
            )
    
    # Determine start date
    start_date = assignment_data.start_date or date.today()
    
    # Close previous active class assignment
    previous_assignment_result = await db.execute(
        select(StudentClassHistory).where(
            StudentClassHistory.student_id == assignment_data.student_id,
            StudentClassHistory.end_date.is_(None)
        )
    )
    previous_assignment = previous_assignment_result.scalar_one_or_none()
    if previous_assignment:
        previous_assignment.end_date = start_date - timedelta(days=1)
        previous_assignment.updated_at = datetime.now(UTC)
    
    # Create new class assignment
    new_assignment = StudentClassHistory(
        student_id=assignment_data.student_id,
        class_id=class_id,
        start_date=start_date,
        end_date=None,  # Active assignment
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC),
    )
    db.add(new_assignment)
    
    # Get the current term for the class's academic year
    # Find the active term (or the term that contains the start_date)
    term_query = select(Term).where(
        Term.academic_year_id == cls.academic_year_id,
        Term.start_date <= start_date,
        Term.end_date >= start_date
    ).order_by(Term.start_date.desc())
    
    term_result = await db.execute(term_query)
    term = term_result.scalar_one_or_none()
    
    # If no term contains the start_date, find the most recent term
    if not term:
        term_query = select(Term).where(
            Term.academic_year_id == cls.academic_year_id
        ).order_by(Term.start_date.desc())
        term_result = await db.execute(term_query)
        term = term_result.scalar_one_or_none()
    
    if not term:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error_code": "NO_TERM_FOUND",
                "message": f"No term found for academic year '{cls.academic_year.name}'",
                "recovery": "Create a term for this academic year first"
            }
        )
    
    # Close previous active enrollment
    previous_enrollment_result = await db.execute(
        select(StudentAcademicEnrollment).where(
            StudentAcademicEnrollment.student_id == assignment_data.student_id,
            StudentAcademicEnrollment.end_date.is_(None)
        )
    )
    previous_enrollment = previous_enrollment_result.scalar_one_or_none()
    if previous_enrollment:
        previous_enrollment.end_date = start_date - timedelta(days=1)
        previous_enrollment.updated_at = datetime.now(UTC)
    
    # Create new academic enrollment (matching class's academic_year and term)
    new_enrollment = StudentAcademicEnrollment(
        student_id=assignment_data.student_id,
        academic_year_id=cls.academic_year_id,
        term_id=term.id,
        start_date=start_date,
        end_date=None,  # Active enrollment
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC),
    )
    db.add(new_enrollment)
    
    # Validate: Active students must have at least one active enrollment
    if student.status == "ACTIVE":
        active_enrollment_count_result = await db.execute(
            select(func.count(StudentAcademicEnrollment.id)).where(
                StudentAcademicEnrollment.student_id == assignment_data.student_id,
                StudentAcademicEnrollment.end_date.is_(None)
            )
        )
        active_enrollment_count = active_enrollment_count_result.scalar_one() or 0
        if active_enrollment_count == 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "error_code": "NO_ACTIVE_ENROLLMENT",
                    "message": "Active students must have at least one active academic enrollment",
                    "recovery": "Ensure the student has an active enrollment"
                }
            )
    
    await db.commit()
    await db.refresh(new_assignment)
    await db.refresh(new_enrollment)
    
    # Load relationships for response
    await db.refresh(new_assignment, ["student", "class_"])
    await db.refresh(new_enrollment, ["academic_year", "term"])
    
    return {
        "id": str(new_assignment.id),
        "student_id": str(new_assignment.student_id),
        "class_id": str(new_assignment.class_id),
        "start_date": new_assignment.start_date.isoformat(),
        "end_date": new_assignment.end_date.isoformat() if new_assignment.end_date else None,
        "created_at": new_assignment.created_at.isoformat(),
        "updated_at": new_assignment.updated_at.isoformat(),
        "student": {
            "id": str(new_assignment.student.id),
            "first_name": new_assignment.student.first_name,
            "last_name": new_assignment.student.last_name,
        } if new_assignment.student else None,
        "class_": {
            "id": str(new_assignment.class_.id),
            "name": new_assignment.class_.name,
        } if new_assignment.class_ else None,
        "enrollment": {
            "id": str(new_enrollment.id),
            "academic_year_id": str(new_enrollment.academic_year_id),
            "term_id": str(new_enrollment.term_id),
            "academic_year": {
                "id": str(new_enrollment.academic_year.id),
                "name": new_enrollment.academic_year.name,
            } if new_enrollment.academic_year else None,
            "term": {
                "id": str(new_enrollment.term.id),
                "name": new_enrollment.term.name,
            } if new_enrollment.term else None,
        } if new_enrollment else None,
    }
