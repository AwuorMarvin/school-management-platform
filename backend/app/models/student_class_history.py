"""
Student Class Assignment History model.
"""

from datetime import date
from uuid import UUID

from sqlalchemy import Date, ForeignKey, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel


class StudentClassHistory(BaseModel):
    """
    Student Class Assignment History model.
    
    Tracks student class assignments over time.
    Only one active assignment per student (end_date IS NULL).
    """
    
    __tablename__ = "student_class_history"
    
    student_id: Mapped[UUID] = mapped_column(
        ForeignKey("student.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    class_id: Mapped[UUID] = mapped_column(
        ForeignKey("class.id", ondelete="RESTRICT"),
        nullable=False,
        index=True
    )
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date | None] = mapped_column(
        Date,
        nullable=True,
        comment="NULL for active assignment"
    )
    
    # Relationships
    student: Mapped["Student"] = relationship(back_populates="class_history")
    class_: Mapped["Class"] = relationship(back_populates="student_assignments")
    
    __table_args__ = (
        Index("idx_student_class_active", "student_id", unique=True, postgresql_where="end_date IS NULL"),
        {"comment": "Student class assignment history - one active assignment per student"}
    )
    
    def __repr__(self) -> str:
        status = "ACTIVE" if self.end_date is None else "ENDED"
        return f"<StudentClassHistory(student_id={self.student_id}, class_id={self.class_id}, status={status})>"

