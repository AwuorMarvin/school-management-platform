"""
Password Reset Token model - Password reset tokens.
"""

from datetime import datetime
from uuid import UUID

from sqlalchemy import ForeignKey, Text, DateTime, UniqueConstraint, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel


class PasswordResetToken(BaseModel):
    """
    Password Reset Token model - Tokens for password reset.
    
    Generated when user requests password reset.
    Sent via email, valid for 1 hour, single-use.
    """
    
    __tablename__ = "password_reset_token"
    
    user_id: Mapped[UUID] = mapped_column(
        ForeignKey("user.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    token_hash: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        unique=True,
        comment="Bcrypt hashed token (not plain text)"
    )
    expires_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        index=True
    )
    used_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        comment="NULL until used, then timestamp of use"
    )
    
    # Relationships
    user: Mapped["User"] = relationship()
    
    __table_args__ = (
        Index("idx_password_reset_token_user", "user_id"),
        Index("idx_password_reset_token_expires", "expires_at"),
        {"comment": "Password reset tokens - 1 hour expiry, single-use"}
    )
    
    def __repr__(self) -> str:
        status = "USED" if self.used_at else "ACTIVE"
        return f"<PasswordResetToken(user_id={self.user_id}, status={status})>"

