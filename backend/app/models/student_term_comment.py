"""
Student Term Comment model - Overall term comments.
"""

from uuid import UUID

from sqlalchemy import ForeignKey, Text, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel


class StudentTermComment(BaseModel):
    """
    Student Term Comment model - Overall term comment per student.
    
    Composite primary key: (student_id, term_id)
    One comment per student per term.
    """
    
    __tablename__ = "student_term_comment"
    
    student_id: Mapped[UUID] = mapped_column(
        ForeignKey("student.id", ondelete="CASCADE"),
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
    comment: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        comment="Overall term comment (1-2000 chars)"
    )
    entered_by_user_id: Mapped[UUID] = mapped_column(
        ForeignKey("user.id", ondelete="RESTRICT"),
        nullable=False,
        index=True
    )
    
    # Relationships
    student: Mapped["Student"] = relationship()
    term: Mapped["Term"] = relationship()
    entered_by: Mapped["User"] = relationship()
    
    __table_args__ = (
        Index("idx_student_term_comment_student", "student_id"),
        Index("idx_student_term_comment_term", "term_id"),
        {"comment": "Student term comment - one per student per term"}
    )
    
    def __repr__(self) -> str:
        return f"<StudentTermComment(student_id={self.student_id}, term_id={self.term_id})>"

