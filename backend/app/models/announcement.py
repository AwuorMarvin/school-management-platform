"""
Announcement model - Event-based announcements.
"""

from uuid import UUID

from sqlalchemy import CheckConstraint, ForeignKey, String, Text, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel, TenantMixin


class Announcement(BaseModel, TenantMixin):
    """
    Announcement model - Time-bound announcements.
    
    Triggers notifications (in-app + SMS for critical).
    At least one of title or body must be provided.
    """
    
    __tablename__ = "announcement"
    
    title: Mapped[str | None] = mapped_column(String(500), nullable=True)
    body: Mapped[str | None] = mapped_column(Text, nullable=True)
    audience: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        comment="PARENTS | TEACHERS | BOTH"
    )
    created_by_user_id: Mapped[UUID] = mapped_column(
        ForeignKey("user.id", ondelete="RESTRICT"),
        nullable=False,
        index=True
    )
    
    # Relationships
    created_by: Mapped["User"] = relationship()
    attachments: Mapped[list["AnnouncementAttachment"]] = relationship(
        back_populates="announcement",
        cascade="all, delete-orphan"
    )
    
    __table_args__ = (
        CheckConstraint(
            "audience IN ('PARENTS', 'TEACHERS', 'BOTH')",
            name="ck_announcement_audience"
        ),
        CheckConstraint(
            "title IS NOT NULL OR body IS NOT NULL",
            name="ck_announcement_content"
        ),
        Index("idx_announcement_audience", "school_id", "audience"),
        Index("idx_announcement_created_at", "created_at"),
        {"comment": "Event-based announcements with notifications"}
    )
    
    def __repr__(self) -> str:
        return f"<Announcement(id={self.id}, title={self.title}, audience={self.audience})>"

