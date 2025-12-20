"""
Database models package.

All SQLAlchemy models are imported here for easy access and
to ensure they're registered with the Base metadata.
"""

from app.models.base import Base, BaseModel, TenantMixin, TimestampMixin

# Core tenant models
from app.models.school import School
from app.models.campus import Campus

# User models
from app.models.user import User
from app.models.parent import Parent

# Student models
from app.models.student import Student
from app.models.student_parent import StudentParent

# Academic structure
from app.models.academic_year import AcademicYear
from app.models.term import Term
import importlib
class_module = importlib.import_module("app.models.class")
from app.models.subject import Subject

# Alias for Class model (class is reserved keyword)
Class = class_module.Class

# Assignments
from app.models.student_class_history import StudentClassHistory
from app.models.student_academic_enrollment import StudentAcademicEnrollment
from app.models.teacher_class_assignment import TeacherClassAssignment
from app.models.class_subject import ClassSubject

# Performance
from app.models.student_performance import StudentPerformance
from app.models.student_term_comment import StudentTermComment

# Authentication tokens
from app.models.account_setup_token import AccountSetupToken
from app.models.password_reset_token import PasswordResetToken
from app.models.refresh_token import RefreshToken

# Documents
from app.models.student_document import StudentDocument

# Communication
from app.models.announcement import Announcement
from app.models.announcement_attachment import AnnouncementAttachment
from app.models.notice_board_item import NoticeBoardItem
from app.models.notice_board_attachment import NoticeBoardAttachment

# Finance
from app.models.fee import Fee
from app.models.fee_structure import FeeStructure, FeeStructureClass
from app.models.fee_line_item import FeeLineItem
from app.models.fee_adjustment import FeeAdjustment
from app.models.global_discount import GlobalDiscount, GlobalDiscountCampus, GlobalDiscountClass
from app.models.payment_history import PaymentHistory
from app.models.student_one_off_fee import StudentOneOffFee

# Clubs & Activities
from app.models.club_activity import ClubActivity
from app.models.club_activity_class import ClubActivityClass
from app.models.student_club_activity import StudentClubActivity

# Transport
from app.models.transport_route import TransportRoute

# Messaging
from app.models.message_log import MessageLog

__all__ = [
    # Base classes
    "Base",
    "BaseModel",
    "TenantMixin",
    "TimestampMixin",
    # Core models
    "School",
    "Campus",
    "User",
    "Parent",
    "Student",
    "StudentParent",
    # Academic
    "AcademicYear",
    "Term",
    "Class",
    "Subject",
    # Assignments
    "StudentClassHistory",
    "StudentAcademicEnrollment",
    "TeacherClassAssignment",
    "ClassSubject",
    # Performance
    "StudentPerformance",
    "StudentTermComment",
    # Auth tokens
    "AccountSetupToken",
    "PasswordResetToken",
    "RefreshToken",
    # Documents
    "StudentDocument",
    # Communication
    "Announcement",
    "AnnouncementAttachment",
    "NoticeBoardItem",
    "NoticeBoardAttachment",
    # Finance
    "Fee",
    "FeeStructure",
    "FeeStructureClass",
    "FeeLineItem",
    "FeeAdjustment",
    "GlobalDiscount",
    "GlobalDiscountCampus",
    "GlobalDiscountClass",
    "PaymentHistory",
    "StudentOneOffFee",
    # Clubs & Activities
    "ClubActivity",
    "ClubActivityClass",
    "StudentClubActivity",
    # Transport
    "TransportRoute",
    # Messaging
    "MessageLog",
]
