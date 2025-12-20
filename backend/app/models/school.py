"""
School model - Multi-tenant root entity.
"""

from sqlalchemy import String, CheckConstraint, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel


class School(BaseModel):
    """
    School model - Primary tenant entity.
    
    Each school is a separate tenant with isolated data.
    """
    
    __tablename__ = "school"
    
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    subdomain: Mapped[str] = mapped_column(String(50), nullable=False)
    status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="ACTIVE",
        comment="ACTIVE | SUSPENDED"
    )
    
    # Relationships
    campuses: Mapped[list["Campus"]] = relationship(
        back_populates="school",
        cascade="all, delete-orphan"
    )
    
    __table_args__ = (
        UniqueConstraint("name", name="uq_school_name"),
        UniqueConstraint("subdomain", name="uq_school_subdomain"),
        CheckConstraint(
            "status IN ('ACTIVE', 'SUSPENDED')",
            name="ck_school_status"
        ),
        {"comment": "School tenant - root entity for multi-tenancy"}
    )
    
    def __repr__(self) -> str:
        return f"<School(id={self.id}, name={self.name}, subdomain={self.subdomain})>"

