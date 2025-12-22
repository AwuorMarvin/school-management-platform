"""
Teacher Class Assignment model.
"""

from datetime import date
from uuid import UUID

from sqlalchemy import Date, ForeignKey, Index
from sqlalchemy.dialects import postgresql
from sqlalchemy.orm import Mapped, mapped_column, relationship, foreign

from app.models.base import BaseModel


class TeacherClassAssignment(BaseModel):
    """
    Teacher Class Assignment model.
    
    Links teachers to classes and subjects.
    Time-bound assignments with start_date and end_date.
    Each row represents one (teacher, class, subject) combination.
    """
    
    __tablename__ = "teacher_class_assignment"
    
    teacher_id: Mapped[UUID] = mapped_column(
        ForeignKey("user.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    class_id: Mapped[UUID] = mapped_column(
        ForeignKey("class.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    subject_id: Mapped[UUID] = mapped_column(
        ForeignKey("subject.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        comment="Subject is required - one row per (teacher, class, subject)"
    )
    campus_id: Mapped[UUID] = mapped_column(
        ForeignKey("campus.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
        comment="Denormalized for campus constraint enforcement"
    )
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date | None] = mapped_column(
        Date,
        nullable=True,
        comment="NULL for active assignment"
    )
    
    # Relationships
    teacher: Mapped["User"] = relationship(overlaps="assignments")  # User relationship (for backward compatibility)
    teacher_record: Mapped["Teacher"] = relationship(
        "Teacher",
        primaryjoin="foreign(TeacherClassAssignment.teacher_id) == Teacher.user_id",
        back_populates="assignments",
        overlaps="teacher"
    )
    class_: Mapped["Class"] = relationship(back_populates="teacher_assignments")
    subject: Mapped["Subject"] = relationship()
    campus: Mapped["Campus"] = relationship()
    
    __table_args__ = (
        Index("idx_teacher_class_active", "teacher_id", "class_id", postgresql_where="end_date IS NULL"),
        # Partial unique constraint: one active assignment per (teacher, class, subject)
        Index(
            "uk_teacher_class_subject_active",
            "teacher_id", "class_id", "subject_id",
            unique=True,
            postgresql_where="end_date IS NULL"
        ),
        Index("idx_assignment_teacher_active", "teacher_id", "end_date", postgresql_where="end_date IS NULL"),
        Index("idx_assignment_class_active", "class_id", "end_date", postgresql_where="end_date IS NULL"),
        {"comment": "Teacher assignments to classes/subjects - time-bound"}
    )
    
    def __repr__(self) -> str:
        status = "ACTIVE" if self.end_date is None else "ENDED"
        return f"<TeacherClassAssignment(teacher_id={self.teacher_id}, class_id={self.class_id}, subject_id={self.subject_id}, status={status})>"

