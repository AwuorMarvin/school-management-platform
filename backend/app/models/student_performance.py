"""
Student Performance model - Grades and subject comments.
"""

from uuid import UUID

from sqlalchemy import ForeignKey, String, Text, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel


class StudentPerformance(BaseModel):
    """
    Student Performance model - Grades per subject per term.
    
    Composite primary key: (student_id, subject_id, term_id)
    One grade per student per subject per term.
    """
    
    __tablename__ = "student_performance"
    
    student_id: Mapped[UUID] = mapped_column(
        ForeignKey("student.id", ondelete="CASCADE"),
        nullable=False,
        primary_key=True,
        index=True
    )
    subject_id: Mapped[UUID] = mapped_column(
        ForeignKey("subject.id", ondelete="CASCADE"),
        nullable=False,
        primary_key=True,
        index=True
    )
    term_id: Mapped[UUID] = mapped_column(
        ForeignKey("term.id", ondelete="CASCADE"),
        nullable=False,
        primary_key=True,
        index=True
    )
    grade: Mapped[str | None] = mapped_column(
        String(10),
        nullable=True,
        comment="Grade (e.g., A, A+, B, 85%)"
    )
    subject_comment: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
        comment="Subject-level comment (max 1000 chars)"
    )
    entered_by_user_id: Mapped[UUID] = mapped_column(
        ForeignKey("user.id", ondelete="RESTRICT"),
        nullable=False,
        index=True
    )
    
    # Relationships
    student: Mapped["Student"] = relationship()
    subject: Mapped["Subject"] = relationship()
    term: Mapped["Term"] = relationship()
    entered_by: Mapped["User"] = relationship()
    
    __table_args__ = (
        Index("idx_student_performance_student", "student_id"),
        Index("idx_student_performance_subject", "subject_id"),
        Index("idx_student_performance_term", "term_id"),
        {"comment": "Student performance - one grade per student per subject per term"}
    )
    
    def __repr__(self) -> str:
        return f"<StudentPerformance(student_id={self.student_id}, subject_id={self.subject_id}, term_id={self.term_id}, grade={self.grade})>"

