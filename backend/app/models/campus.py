"""
Campus model - Belongs to a school.
"""

from uuid import UUID

from sqlalchemy import ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel, TenantMixin


class Campus(BaseModel, TenantMixin):
    """
    Campus model - Physical location within a school.
    
    Every school must have at least one campus.
    Students belong to exactly one campus.
    """
    
    __tablename__ = "campus"
    
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    address: Mapped[str | None] = mapped_column(Text, nullable=True)
    
    # Relationships
    school: Mapped["School"] = relationship(back_populates="campuses")
    users: Mapped[list["User"]] = relationship(back_populates="campus")
    students: Mapped[list["Student"]] = relationship(back_populates="campus")
    classes: Mapped[list["Class"]] = relationship(back_populates="campus")
    
    __table_args__ = (
        UniqueConstraint("school_id", "name", name="uq_campus_school_name"),
        {"comment": "Campus belongs to a school with unique name per school"}
    )
    
    def __repr__(self) -> str:
        return f"<Campus(id={self.id}, name={self.name}, school_id={self.school_id})>"

