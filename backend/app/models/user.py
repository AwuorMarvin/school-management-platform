"""
User model - All human users (Admins, Teachers, Parents).
"""

from datetime import datetime
from uuid import UUID

from sqlalchemy import (
    CheckConstraint,
    ForeignKey,
    String,
    Text,
    UniqueConstraint,
    DateTime,
    Index,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel, TenantMixin


class User(BaseModel, TenantMixin):
    """
    User model - All human users in the system.
    
    Supports: SUPER_ADMIN, SCHOOL_ADMIN, CAMPUS_ADMIN, TEACHER, PARENT
    """
    
    __tablename__ = "user"
    
    email: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    phone_number: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        comment="Must start with +254 (Kenya format)"
    )
    password_hash: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
        comment="NULL until account setup complete (bcrypt hashed)"
    )
    first_name: Mapped[str] = mapped_column(String(100), nullable=False)
    last_name: Mapped[str] = mapped_column(String(100), nullable=False)
    role: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        index=True,
        comment="SUPER_ADMIN | SCHOOL_ADMIN | CAMPUS_ADMIN | TEACHER | PARENT"
    )
    campus_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("campus.id", ondelete="SET NULL"),
        nullable=True,
        index=True
    )
    status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="ACTIVE",
        comment="ACTIVE | INACTIVE (PENDING_SETUP handled via password_hash NULL)"
    )
    last_login_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True
    )
    
    # Relationships
    campus: Mapped["Campus | None"] = relationship(back_populates="users")
    parent: Mapped["Parent | None"] = relationship(
        back_populates="user",
        uselist=False
    )
    account_setup_tokens: Mapped[list["AccountSetupToken"]] = relationship(
        back_populates="user",
        cascade="all, delete-orphan"
    )
    password_reset_tokens: Mapped[list["PasswordResetToken"]] = relationship(
        back_populates="user",
        cascade="all, delete-orphan"
    )
    refresh_tokens: Mapped[list["RefreshToken"]] = relationship(
        back_populates="user",
        cascade="all, delete-orphan"
    )
    
    __table_args__ = (
        UniqueConstraint("school_id", "email", name="uq_user_school_email"),
        UniqueConstraint("school_id", "phone_number", name="uq_user_school_phone"),
        CheckConstraint(
            "phone_number LIKE '+254%'",
            name="ck_user_phone_format"
        ),
        CheckConstraint(
            "role IN ('SUPER_ADMIN', 'SCHOOL_ADMIN', 'CAMPUS_ADMIN', 'TEACHER', 'PARENT')",
            name="ck_user_role"
        ),
        CheckConstraint(
            "status IN ('ACTIVE', 'INACTIVE')",
            name="ck_user_status"
        ),
        Index("idx_user_school_role", "school_id", "role"),
        {"comment": "User accounts with tenant isolation"}
    )
    
    def __repr__(self) -> str:
        return f"<User(id={self.id}, email={self.email}, role={self.role})>"

