"""update_teacher_class_assignment

Revision ID: f2a3b4c5d6e7
Revises: e1f2a3b4c5d6
Create Date: 2024-12-20 10:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = "f2a3b4c5d6e7"
down_revision: Union[str, Sequence[str], None] = "e1f2a3b4c5d6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """
    Update teacher_class_assignment table.
    
    Changes:
    1. Add campus_id column (denormalized for constraint enforcement)
    2. Make subject_id required (remove NULL option)
    3. Add unique constraint for active assignments
    4. Add performance indexes
    """
    
    # Step 1: Add campus_id column
    op.add_column(
        'teacher_class_assignment',
        sa.Column('campus_id', postgresql.UUID(as_uuid=True), nullable=True)
    )
    
    # Step 2: Populate campus_id from teacher's campus
    # For existing assignments, get campus from user table
    op.execute("""
        UPDATE teacher_class_assignment tca
        SET campus_id = (
            SELECT u.campus_id
            FROM "user" u
            WHERE u.id = tca.teacher_id
        )
        WHERE tca.campus_id IS NULL
    """)
    
    # Step 3: Handle NULL subject_id assignments
    # For assignments with NULL subject_id, we need to either:
    # - Assign to a default subject per class, or
    # - Delete them (they're invalid per spec)
    # For safety, we'll set them to the first subject in each class
    op.execute("""
        UPDATE teacher_class_assignment tca
        SET subject_id = (
            SELECT cs.subject_id
            FROM class_subject cs
            WHERE cs.class_id = tca.class_id
            ORDER BY cs.subject_id
            LIMIT 1
        )
        WHERE tca.subject_id IS NULL
        AND EXISTS (
            SELECT 1
            FROM class_subject cs
            WHERE cs.class_id = tca.class_id
        )
    """)
    
    # Delete any assignments that still have NULL subject_id (no subjects in class)
    op.execute("""
        DELETE FROM teacher_class_assignment
        WHERE subject_id IS NULL
    """)
    
    # Step 4: Make campus_id NOT NULL
    op.alter_column(
        'teacher_class_assignment',
        'campus_id',
        existing_type=postgresql.UUID(as_uuid=True),
        nullable=False
    )
    
    # Step 5: Make subject_id NOT NULL
    op.alter_column(
        'teacher_class_assignment',
        'subject_id',
        existing_type=postgresql.UUID(as_uuid=True),
        nullable=False
    )
    
    # Step 6: Add foreign key constraint for campus_id
    op.create_foreign_key(
        'fk_teacher_class_assignment_campus',
        'teacher_class_assignment',
        'campus',
        ['campus_id'],
        ['id'],
        ondelete='RESTRICT'
    )
    
    # Step 7: Add unique constraint for active assignments
    # This prevents duplicate (teacher, class, subject) combinations when end_date IS NULL
    op.create_index(
        'uk_teacher_class_subject_active',
        'teacher_class_assignment',
        ['teacher_id', 'class_id', 'subject_id'],
        unique=True,
        postgresql_where=sa.text('end_date IS NULL')
    )
    
    # Step 8: Add performance indexes
    op.create_index(
        'idx_assignment_teacher_active',
        'teacher_class_assignment',
        ['teacher_id', 'end_date'],
        unique=False,
        postgresql_where=sa.text('end_date IS NULL')
    )
    
    op.create_index(
        'idx_assignment_class_active',
        'teacher_class_assignment',
        ['class_id', 'end_date'],
        unique=False,
        postgresql_where=sa.text('end_date IS NULL')
    )


def downgrade() -> None:
    """Revert teacher_class_assignment changes."""
    
    # Drop indexes
    op.drop_index('idx_assignment_class_active', table_name='teacher_class_assignment')
    op.drop_index('idx_assignment_teacher_active', table_name='teacher_class_assignment')
    op.drop_index('uk_teacher_class_subject_active', table_name='teacher_class_assignment')
    
    # Drop foreign key
    op.drop_constraint('fk_teacher_class_assignment_campus', 'teacher_class_assignment', type_='foreignkey')
    
    # Make subject_id nullable again
    op.alter_column(
        'teacher_class_assignment',
        'subject_id',
        existing_type=postgresql.UUID(as_uuid=True),
        nullable=True
    )
    
    # Make campus_id nullable and drop column
    op.alter_column(
        'teacher_class_assignment',
        'campus_id',
        existing_type=postgresql.UUID(as_uuid=True),
        nullable=True
    )
    op.drop_column('teacher_class_assignment', 'campus_id')

