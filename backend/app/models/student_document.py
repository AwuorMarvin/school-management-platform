"""
Student Document model - Document vault.
"""

from uuid import UUID

from sqlalchemy import CheckConstraint, ForeignKey, Integer, String, Text, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel


class StudentDocument(BaseModel):
    """
    Student Document model - Documents in student vault.
    
    Three folders: PARENT, STUDENT, SCHOOL
    Files stored in S3, accessed via signed URLs.
    """
    
    __tablename__ = "student_document"
    
    student_id: Mapped[UUID] = mapped_column(
        ForeignKey("student.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    folder: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        comment="PARENT | STUDENT | SCHOOL"
    )
    document_type: Mapped[str] = mapped_column(
        String(200),
        nullable=False,
        comment="e.g., Birth Certificate, Parent ID, Report Card"
    )
    filename: Mapped[str] = mapped_column(String(500), nullable=False)
    file_url: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        comment="S3 URL or path"
    )
    file_size: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        comment="File size in bytes (max 10MB)"
    )
    mime_type: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        comment="MIME type (e.g., application/pdf)"
    )
    uploaded_by_user_id: Mapped[UUID] = mapped_column(
        ForeignKey("user.id", ondelete="RESTRICT"),
        nullable=False,
        index=True
    )
    
    # Relationships
    student: Mapped["Student"] = relationship()
    uploaded_by: Mapped["User"] = relationship()
    
    __table_args__ = (
        CheckConstraint(
            "folder IN ('PARENT', 'STUDENT', 'SCHOOL')",
            name="ck_student_document_folder"
        ),
        CheckConstraint(
            "file_size > 0 AND file_size <= 10485760",
            name="ck_student_document_size"
        ),
        Index("idx_student_document_folder", "student_id", "folder"),
        {"comment": "Student document vault - files in S3"}
    )
    
    def __repr__(self) -> str:
        return f"<StudentDocument(id={self.id}, student_id={self.student_id}, folder={self.folder})>"

