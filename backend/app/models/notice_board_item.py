"""
Notice Board Item model - Persistent notice board items.
"""

from uuid import UUID

from sqlalchemy import CheckConstraint, ForeignKey, String, Text, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel, TenantMixin


class NoticeBoardItem(BaseModel, TenantMixin):
    """
    Notice Board Item model - Persistent reference information.
    
    Long-lived content (e.g., school rules, menu).
    No automatic notifications.
    """
    
    __tablename__ = "notice_board_item"
    
    title: Mapped[str] = mapped_column(String(500), nullable=False)
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
    attachments: Mapped[list["NoticeBoardAttachment"]] = relationship(
        back_populates="notice_board_item",
        cascade="all, delete-orphan"
    )
    
    __table_args__ = (
        CheckConstraint(
            "audience IN ('PARENTS', 'TEACHERS', 'BOTH')",
            name="ck_notice_board_audience"
        ),
        Index("idx_notice_board_item_audience", "school_id", "audience"),
        {"comment": "Persistent notice board items - no notifications"}
    )
    
    def __repr__(self) -> str:
        return f"<NoticeBoardItem(id={self.id}, title={self.title}, audience={self.audience})>"

