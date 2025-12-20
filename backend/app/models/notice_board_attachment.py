"""
Notice Board Attachment model - Files attached to notice board items.
"""

from uuid import UUID

from sqlalchemy import ForeignKey, Integer, String, Text, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel


class NoticeBoardAttachment(BaseModel):
    """
    Notice Board Attachment model - Files attached to notice board items.
    
    Files stored in S3, accessed via signed URLs.
    """
    
    __tablename__ = "notice_board_attachment"
    
    notice_board_item_id: Mapped[UUID] = mapped_column(
        ForeignKey("notice_board_item.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    filename: Mapped[str] = mapped_column(String(500), nullable=False)
    file_url: Mapped[str] = mapped_column(Text, nullable=False)
    file_size: Mapped[int] = mapped_column(Integer, nullable=False)
    
    # Relationships
    notice_board_item: Mapped["NoticeBoardItem"] = relationship(back_populates="attachments")
    
    __table_args__ = (
        Index("idx_notice_board_attachment_item", "notice_board_item_id"),
        {"comment": "Files attached to notice board items"}
    )
    
    def __repr__(self) -> str:
        return f"<NoticeBoardAttachment(id={self.id}, notice_board_item_id={self.notice_board_item_id})>"

