"""
Refresh Token model - JWT refresh tokens for session management.
"""

from datetime import datetime
from uuid import UUID

from sqlalchemy import ForeignKey, Text, DateTime, UniqueConstraint, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel


class RefreshToken(BaseModel):
    """
    Refresh Token model - Long-lived tokens for session refresh.
    
    Generated on successful login.
    Can be revoked (logout, password change).
    Expires after 24h or 30 days (with remember me).
    """
    
    __tablename__ = "refresh_token"
    
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
    revoked_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        comment="NULL if active, timestamp if revoked"
    )
    
    # Relationships
    user: Mapped["User"] = relationship()
    
    __table_args__ = (
        Index("idx_refresh_token_user", "user_id"),
        Index("idx_refresh_token_expires", "expires_at"),
        {"comment": "Refresh tokens - 24h or 30d expiry, can be revoked"}
    )
    
    def __repr__(self) -> str:
        status = "REVOKED" if self.revoked_at else "ACTIVE"
        return f"<RefreshToken(user_id={self.user_id}, status={status})>"

