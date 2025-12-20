"""
Teacher model - Extends User for teacher-specific data.
"""

from datetime import date
from uuid import UUID

from sqlalchemy import CheckConstraint, Date, ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship, foreign

from app.models.base import BaseModel, TenantMixin


class Teacher(BaseModel, TenantMixin):
    """
    Teacher model - Teacher-specific information.
    
    One-to-one relationship with User.
    Stores teacher-specific fields: salutation, middle_name, national_id,
    tsc_number, date_of_birth, gender, campus_id.
    """
    
    __tablename__ = "teacher"
    
    user_id: Mapped[UUID] = mapped_column(
        ForeignKey("user.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True
    )
    salutation: Mapped[str] = mapped_column(
        String(10),
        nullable=False,
        comment="Mr | Mrs | Miss | Dr | Prof"
    )
    middle_name: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True
    )
    national_id: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        comment="National ID number (unique per school)"
    )
    tsc_number: Mapped[str | None] = mapped_column(
        String(50),
        nullable=True,
        comment="Teachers Service Commission registration number"
    )
    date_of_birth: Mapped[date] = mapped_column(
        Date,
        nullable=False
    )
    gender: Mapped[str] = mapped_column(
        String(10),
        nullable=False,
        comment="MALE | FEMALE | OTHER"
    )
    campus_id: Mapped[UUID] = mapped_column(
        ForeignKey("campus.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
        comment="Campus this teacher belongs to (required, immutable)"
    )
    
    # Relationships
    user: Mapped["User"] = relationship(back_populates="teacher")
    campus: Mapped["Campus"] = relationship()
    assignments: Mapped[list["TeacherClassAssignment"]] = relationship(
        "TeacherClassAssignment",
        primaryjoin="Teacher.user_id == foreign(TeacherClassAssignment.teacher_id)",
        back_populates="teacher_record",
        cascade="all, delete-orphan"
    )
    
    __table_args__ = (
        UniqueConstraint("school_id", "national_id", name="uq_teacher_school_national_id"),
        CheckConstraint(
            "salutation IN ('Mr', 'Mrs', 'Miss', 'Dr', 'Prof')",
            name="ck_teacher_salutation"
        ),
        CheckConstraint(
            "gender IN ('MALE', 'FEMALE', 'OTHER')",
            name="ck_teacher_gender"
        ),
        {"comment": "Teacher record - extends user with teacher-specific data"}
    )
    
    def __repr__(self) -> str:
        return f"<Teacher(id={self.id}, user_id={self.user_id}, national_id={self.national_id})>"

