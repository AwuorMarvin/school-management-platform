"""
Club Activity Class junction table - Many-to-many relationship between club activities and classes.
"""

from uuid import UUID

from sqlalchemy import ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel


class ClubActivityClass(BaseModel):
    """
    Club Activity Class junction table.
    
    Links club activities to classes (many-to-many relationship).
    A club/activity can be offered to multiple classes.
    A class can have multiple club activities.
    """
    
    __tablename__ = "club_activity_class"
    
    club_activity_id: Mapped[UUID] = mapped_column(
        ForeignKey("club_activity.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    class_id: Mapped[UUID] = mapped_column(
        ForeignKey("class.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    
    # Relationships
    club_activity: Mapped["ClubActivity"] = relationship(back_populates="class_activities")
    class_: Mapped["Class"] = relationship()
    
    __table_args__ = (
        UniqueConstraint("club_activity_id", "class_id", name="uq_club_activity_class"),
        {"comment": "Many-to-many relationship between club activities and classes"}
    )
    
    def __repr__(self) -> str:
        return f"<ClubActivityClass(club_activity_id={self.club_activity_id}, class_id={self.class_id})>"

