"""
Student Club Activity junction table - Many-to-many relationship between students and club activities.
"""

from uuid import UUID

from sqlalchemy import ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel


class StudentClubActivity(BaseModel):
    """
    Student Club Activity junction table.
    
    Links students to club activities (many-to-many relationship).
    A student can participate in multiple club activities.
    A club activity can have multiple students.
    """
    
    __tablename__ = "student_club_activity"
    
    student_id: Mapped[UUID] = mapped_column(
        ForeignKey("student.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    club_activity_id: Mapped[UUID] = mapped_column(
        ForeignKey("club_activity.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    
    # Relationships
    student: Mapped["Student"] = relationship(back_populates="club_activities")
    club_activity: Mapped["ClubActivity"] = relationship(back_populates="student_activities")
    
    __table_args__ = (
        UniqueConstraint("student_id", "club_activity_id", name="uq_student_club_activity"),
        {"comment": "Many-to-many relationship between students and club activities"}
    )
    
    def __repr__(self) -> str:
        return f"<StudentClubActivity(student_id={self.student_id}, club_activity_id={self.club_activity_id})>"

