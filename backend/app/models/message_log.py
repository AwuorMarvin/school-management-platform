"""
Message Log model - Audit trail of all sent messages.
"""

from datetime import datetime, UTC
from uuid import UUID

from sqlalchemy import CheckConstraint, ForeignKey, String, Text, DateTime, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel, TenantMixin


class MessageLog(BaseModel, TenantMixin):
    """
    Message Log model - Log of all sent messages (SMS, Email, In-App).
    
    Tracks delivery status and errors.
    Used for audit and debugging.
    """
    
    __tablename__ = "message_log"
    
    user_id: Mapped[UUID] = mapped_column(
        ForeignKey("user.id", ondelete="SET NULL"),
        nullable=True,
        index=True
    )
    channel: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        comment="SMS | EMAIL | IN_APP"
    )
    message_type: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        index=True,
        comment="ACCOUNT_SETUP | PASSWORD_RESET | ANNOUNCEMENT | FEE_REMINDER | EMERGENCY"
    )
    content: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str | None] = mapped_column(
        String(20),
        nullable=True,
        comment="QUEUED | SENT | DELIVERED | FAILED"
    )
    sent_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(UTC),
        index=True
    )
    delivered_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True
    )
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    
    # Relationships
    user: Mapped["User | None"] = relationship()
    
    __table_args__ = (
        CheckConstraint(
            "channel IN ('SMS', 'EMAIL', 'IN_APP')",
            name="ck_message_log_channel"
        ),
        CheckConstraint(
            "status IS NULL OR status IN ('QUEUED', 'SENT', 'DELIVERED', 'FAILED')",
            name="ck_message_log_status"
        ),
        Index("idx_message_log_user", "user_id"),
        Index("idx_message_log_sent_at", "sent_at"),
        Index("idx_message_log_type", "message_type"),
        {"comment": "Message log - audit trail of all sent messages"}
    )
    
    def __repr__(self) -> str:
        return f"<MessageLog(id={self.id}, channel={self.channel}, type={self.message_type}, status={self.status})>"

