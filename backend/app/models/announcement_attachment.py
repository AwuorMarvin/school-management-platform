"""
Announcement Attachment model - Files attached to announcements.
"""

from uuid import UUID

from sqlalchemy import ForeignKey, Integer, String, Text, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel


class AnnouncementAttachment(BaseModel):
    """
    Announcement Attachment model - Files attached to announcements.
    
    Files stored in S3, accessed via signed URLs.
    """
    
    __tablename__ = "announcement_attachment"
    
    announcement_id: Mapped[UUID] = mapped_column(
        ForeignKey("announcement.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    filename: Mapped[str] = mapped_column(String(500), nullable=False)
    file_url: Mapped[str] = mapped_column(Text, nullable=False)
    file_size: Mapped[int] = mapped_column(Integer, nullable=False)
    
    # Relationships
    announcement: Mapped["Announcement"] = relationship(back_populates="attachments")
    
    __table_args__ = (
        Index("idx_announcement_attachment_announcement", "announcement_id"),
        {"comment": "Files attached to announcements"}
    )
    
    def __repr__(self) -> str:
        return f"<AnnouncementAttachment(id={self.id}, announcement_id={self.announcement_id})>"

