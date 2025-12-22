"""add performance_report and performance_line_item tables

Revision ID: e3f4a5b6c7d8
Revises: d7e8f9a0b1c2
Create Date: 2025-12-22 00:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "e3f4a5b6c7d8"
down_revision: Union[str, None] = "d7e8f9a0b1c2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        "performance_report",
        sa.Column("student_id", sa.Uuid(), nullable=False, comment="Student this report belongs to"),
        sa.Column("class_id", sa.Uuid(), nullable=False, comment="Class the student was in for this report"),
        sa.Column("subject_id", sa.Uuid(), nullable=False, comment="Subject this report is for"),
        sa.Column("teacher_id", sa.Uuid(), nullable=False, comment="Teacher responsible for this subject in this class"),
        sa.Column("academic_year_id", sa.Uuid(), nullable=False, comment="Academic year for this report"),
        sa.Column("term_id", sa.Uuid(), nullable=False, comment="Term for this report"),
        sa.Column("created_by_user_id", sa.Uuid(), nullable=False, comment="User who entered this report"),
        sa.Column("updated_by_user_id", sa.Uuid(), nullable=True, comment="Last user who updated this report"),
        sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default=sa.text("false"), comment="Soft delete flag for performance reports"),
        sa.Column("school_id", sa.Uuid(), nullable=False, comment="School (tenant) this record belongs to"),
        sa.Column("id", sa.Uuid(), nullable=False, comment="Unique identifier (UUID)"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
            comment="Timestamp when record was created",
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=True,
            comment="Timestamp when record was last updated",
        ),
        sa.ForeignKeyConstraint(["academic_year_id"], ["academic_year.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["class_id"], ["class.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["created_by_user_id"], ["user.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["school_id"], ["school.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["student_id"], ["student.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["subject_id"], ["subject.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["teacher_id"], ["user.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["term_id"], ["term.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["updated_by_user_id"], ["user.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
        comment="Student performance report per subject/class/term/teacher with detailed line items",
    )
    op.create_index(
        "ix_performance_report_student_id",
        "performance_report",
        ["student_id"],
        unique=False,
    )
    op.create_index(
        "ix_performance_report_class_id",
        "performance_report",
        ["class_id"],
        unique=False,
    )
    op.create_index(
        "ix_performance_report_subject_id",
        "performance_report",
        ["subject_id"],
        unique=False,
    )
    op.create_index(
        "ix_performance_report_teacher_id",
        "performance_report",
        ["teacher_id"],
        unique=False,
    )
    op.create_index(
        "ix_performance_report_academic_year_id",
        "performance_report",
        ["academic_year_id"],
        unique=False,
    )
    op.create_index(
        "ix_performance_report_term_id",
        "performance_report",
        ["term_id"],
        unique=False,
    )
    op.create_index(
        "ix_performance_report_school_id",
        "performance_report",
        ["school_id"],
        unique=False,
    )
    op.create_index(
        "idx_performance_report_student_subject_term_teacher",
        "performance_report",
        [
            "school_id",
            "student_id",
            "subject_id",
            "class_id",
            "academic_year_id",
            "term_id",
            "teacher_id",
        ],
        unique=True,
    )

    op.create_table(
        "performance_line_item",
        sa.Column("report_id", sa.Uuid(), nullable=False, comment="Parent performance report"),
        sa.Column("area_label", sa.String(length=200), nullable=False, comment="Performance area name (e.g., 'Algebra')"),
        sa.Column("numeric_score", sa.Numeric(5, 2), nullable=True, comment="Optional numeric score for this area"),
        sa.Column(
            "descriptive_score",
            sa.String(length=50),
            nullable=True,
            comment="Optional descriptive score (e.g., 'ME' for Meeting Expectations)",
        ),
        sa.Column("comment", sa.Text(), nullable=True, comment="Optional detailed comment for this performance area"),
        sa.Column("position", sa.Integer(), nullable=False, server_default=sa.text("1"), comment="Ordering (1–5)"),
        sa.Column("school_id", sa.Uuid(), nullable=False, comment="School (tenant) this record belongs to"),
        sa.Column("id", sa.Uuid(), nullable=False, comment="Unique identifier (UUID)"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
            comment="Timestamp when record was created",
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=True,
            comment="Timestamp when record was last updated",
        ),
        sa.CheckConstraint(
            "numeric_score IS NOT NULL OR descriptive_score IS NOT NULL",
            name="ck_performance_line_item_has_score",
        ),
        sa.CheckConstraint(
            "position >= 1 AND position <= 5",
            name="ck_performance_line_item_position_range",
        ),
        sa.ForeignKeyConstraint(["report_id"], ["performance_report.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["school_id"], ["school.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        comment="Detailed performance areas within a performance report (max 5 per report)",
    )
    op.create_index(
        "ix_performance_line_item_report_id",
        "performance_line_item",
        ["report_id"],
        unique=False,
    )
    op.create_index(
        "ix_performance_line_item_school_id",
        "performance_line_item",
        ["school_id"],
        unique=False,
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index("ix_performance_line_item_school_id", table_name="performance_line_item")
    op.drop_index("ix_performance_line_item_report_id", table_name="performance_line_item")
    op.drop_table("performance_line_item")

    op.drop_index("idx_performance_report_student_subject_term_teacher", table_name="performance_report")
    op.drop_index("ix_performance_report_school_id", table_name="performance_report")
    op.drop_index("ix_performance_report_term_id", table_name="performance_report")
    op.drop_index("ix_performance_report_academic_year_id", table_name="performance_report")
    op.drop_index("ix_performance_report_subject_id", table_name="performance_report")
    op.drop_index("ix_performance_report_class_id", table_name="performance_report")
    op.drop_index("ix_performance_report_teacher_id", table_name="performance_report")
    op.drop_index("ix_performance_report_student_id", table_name="performance_report")
    op.drop_table("performance_report")


