"""
Subject model - Subjects/Units that can be taught in multiple classes.
"""

from uuid import UUID

from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel, TenantMixin


class Subject(BaseModel, TenantMixin):
    """
    Subject model - Subject/Unit that can be taught in multiple classes.
    
    Subjects can be shared across multiple classes (many-to-many).
    Code must be unique within school (if provided).
    """
    
    __tablename__ = "subject"
    
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    code: Mapped[str | None] = mapped_column(
        String(20),
        nullable=True,
        comment="Subject code (unique within school if provided)"
    )
    
    # Relationships - many-to-many with Class via ClassSubject junction table
    class_subjects: Mapped[list["ClassSubject"]] = relationship(
        back_populates="subject",
        cascade="all, delete-orphan"
    )
    
    __table_args__ = (
        {"comment": "Subject/Unit that can be taught in multiple classes"}
    )
    
    def __repr__(self) -> str:
        return f"<Subject(id={self.id}, name={self.name}, school_id={self.school_id})>"

