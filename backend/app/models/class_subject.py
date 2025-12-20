"""
Class Subject junction table - Many-to-many relationship between classes and subjects.
"""

from uuid import UUID

from sqlalchemy import ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel


class ClassSubject(BaseModel):
    """
    Class Subject junction table.
    
    Links classes to subjects (many-to-many relationship).
    A subject can be taught in multiple classes.
    A class can have multiple subjects.
    """
    
    __tablename__ = "class_subject"
    
    class_id: Mapped[UUID] = mapped_column(
        ForeignKey("class.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    subject_id: Mapped[UUID] = mapped_column(
        ForeignKey("subject.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    
    # Relationships
    class_: Mapped["Class"] = relationship(back_populates="class_subjects")
    subject: Mapped["Subject"] = relationship(back_populates="class_subjects")
    
    __table_args__ = (
        UniqueConstraint("class_id", "subject_id", name="uq_class_subject"),
        {"comment": "Many-to-many relationship between classes and subjects"}
    )
    
    def __repr__(self) -> str:
        return f"<ClassSubject(class_id={self.class_id}, subject_id={self.subject_id})>"

