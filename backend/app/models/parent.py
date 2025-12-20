"""
Parent model - Extends User for parent-specific data.
"""

from uuid import UUID

from sqlalchemy import ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel, TenantMixin


class Parent(BaseModel, TenantMixin):
    """
    Parent model - Parent-specific information.
    
    One-to-one relationship with User.
    Created automatically when user with role=PARENT is created.
    """
    
    __tablename__ = "parent"
    
    user_id: Mapped[UUID] = mapped_column(
        ForeignKey("user.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True
    )
    id_number: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        comment="National ID or Passport number"
    )
    
    # Relationships
    user: Mapped["User"] = relationship(back_populates="parent")
    student_links: Mapped[list["StudentParent"]] = relationship(
        back_populates="parent",
        cascade="all, delete-orphan"
    )
    
    __table_args__ = (
        {"comment": "Parent record - extends user with parent-specific data"}
    )
    
    def __repr__(self) -> str:
        return f"<Parent(id={self.id}, user_id={self.user_id}, id_number={self.id_number})>"

