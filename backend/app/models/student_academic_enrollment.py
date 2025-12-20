"""
Student Academic Enrollment model - Tracks student enrollment in academic years and terms.
"""

from datetime import date
from uuid import UUID

from sqlalchemy import Date, ForeignKey, Index, CheckConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel


class StudentAcademicEnrollment(BaseModel):
    """
    Student Academic Enrollment model.
    
    Tracks student enrollment in academic years and terms.
    A student's academic_year/term must match their class's academic_year.
    Only one active enrollment per student (end_date IS NULL).
    """
    
    __tablename__ = "student_academic_enrollment"
    
    student_id: Mapped[UUID] = mapped_column(
        ForeignKey("student.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    academic_year_id: Mapped[UUID] = mapped_column(
        ForeignKey("academic_year.id", ondelete="RESTRICT"),
        nullable=False,
        index=True
    )
    term_id: Mapped[UUID] = mapped_column(
        ForeignKey("term.id", ondelete="RESTRICT"),
        nullable=False,
        index=True
    )
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date | None] = mapped_column(
        Date,
        nullable=True,
        comment="NULL for active enrollment"
    )
    
    # Relationships
    student: Mapped["Student"] = relationship(back_populates="academic_enrollments")
    academic_year: Mapped["AcademicYear"] = relationship()
    term: Mapped["Term"] = relationship()
    
    __table_args__ = (
        Index("idx_student_enrollment_active", "student_id", unique=True, postgresql_where="end_date IS NULL"),
        CheckConstraint(
            "end_date IS NULL OR start_date <= end_date",
            name="ck_enrollment_dates"
        ),
        {"comment": "Student academic enrollment - one active enrollment per student"}
    )
    
    def __repr__(self) -> str:
        status = "ACTIVE" if self.end_date is None else "ENDED"
        return f"<StudentAcademicEnrollment(student_id={self.student_id}, academic_year_id={self.academic_year_id}, term_id={self.term_id}, status={status})>"

