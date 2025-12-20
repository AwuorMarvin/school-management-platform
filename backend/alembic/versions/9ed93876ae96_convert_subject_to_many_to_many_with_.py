"""convert_subject_to_many_to_many_with_classes

Revision ID: 9ed93876ae96
Revises: 455830817e8c
Create Date: 2025-12-19 00:45:25.418932

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import text


# revision identifiers, used by Alembic.
revision: str = '9ed93876ae96'
down_revision: Union[str, Sequence[str], None] = '455830817e8c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema: Convert subject to many-to-many with classes."""
    
    # Step 1: Create the class_subject junction table
    op.create_table(
        'class_subject',
        sa.Column('id', sa.Uuid(), nullable=False, comment='Unique identifier (UUID)'),
        sa.Column('class_id', sa.Uuid(), nullable=False),
        sa.Column('subject_id', sa.Uuid(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False, comment='Timestamp when record was created'),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True, comment='Timestamp when record was last updated'),
        sa.ForeignKeyConstraint(['class_id'], ['class.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['subject_id'], ['subject.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('class_id', 'subject_id', name='uq_class_subject'),
        comment='Many-to-many relationship between classes and subjects'
    )
    op.create_index(op.f('ix_class_subject_class_id'), 'class_subject', ['class_id'], unique=False)
    op.create_index(op.f('ix_class_subject_subject_id'), 'class_subject', ['subject_id'], unique=False)
    
    # Step 2: Add school_id column to subject table (nullable first)
    op.add_column('subject', sa.Column('school_id', sa.Uuid(), nullable=True, comment='School (tenant) this record belongs to'))
    op.create_index(op.f('ix_subject_school_id'), 'subject', ['school_id'], unique=False)
    
    # Step 3: Migrate existing data
    # For each subject, get school_id from its class via campus
    op.execute(text("""
        UPDATE subject
        SET school_id = (
            SELECT campus.school_id
            FROM class
            JOIN campus ON class.campus_id = campus.id
            WHERE class.id = subject.class_id
        )
    """))
    
    # Step 4: Create class_subject records for existing subject-class relationships
    op.execute(text("""
        INSERT INTO class_subject (id, class_id, subject_id, created_at, updated_at)
        SELECT 
            gen_random_uuid(),
            subject.class_id,
            subject.id,
            subject.created_at,
            subject.updated_at
        FROM subject
        WHERE subject.class_id IS NOT NULL
    """))
    
    # Step 5: Make school_id NOT NULL now that all rows have values
    op.alter_column('subject', 'school_id', nullable=False)
    op.create_foreign_key('fk_subject_school', 'subject', 'school', ['school_id'], ['id'], ondelete='CASCADE')
    
    # Step 6: Drop old constraints and indexes
    op.drop_constraint('uq_subject_class_code', 'subject', type_='unique')
    op.drop_index(op.f('ix_subject_class_id'), table_name='subject')
    op.drop_constraint('subject_class_id_fkey', 'subject', type_='foreignkey')
    
    # Step 7: Drop class_id column
    op.drop_column('subject', 'class_id')
    
    # Step 8: Add new unique constraint on (school_id, code) if code is provided
    # Note: PostgreSQL doesn't support partial unique constraints directly in Alembic,
    # so we'll create a unique index with a WHERE clause
    op.execute(text("""
        CREATE UNIQUE INDEX uq_subject_school_code 
        ON subject (school_id, code) 
        WHERE code IS NOT NULL
    """))


def downgrade() -> None:
    """Downgrade schema: Revert to one-to-many relationship."""
    
    # Step 1: Drop new unique index
    op.drop_index('uq_subject_school_code', table_name='subject')
    
    # Step 2: Add class_id column back (nullable first)
    op.add_column('subject', sa.Column('class_id', sa.Uuid(), nullable=True))
    op.create_index(op.f('ix_subject_class_id'), 'subject', ['class_id'], unique=False)
    
    # Step 3: Migrate data back: assign each subject to one class (the first one from class_subject)
    op.execute(text("""
        UPDATE subject
        SET class_id = (
            SELECT class_id
            FROM class_subject
            WHERE class_subject.subject_id = subject.id
            LIMIT 1
        )
    """))
    
    # Step 4: Make class_id NOT NULL
    op.alter_column('subject', 'class_id', nullable=False)
    op.create_foreign_key('subject_class_id_fkey', 'subject', 'class', ['class_id'], ['id'], ondelete='CASCADE')
    
    # Step 5: Restore old unique constraint
    op.create_unique_constraint('uq_subject_class_code', 'subject', ['class_id', 'code'])
    
    # Step 6: Drop school_id column and its index
    op.drop_constraint('fk_subject_school', 'subject', type_='foreignkey')
    op.drop_index(op.f('ix_subject_school_id'), table_name='subject')
    op.drop_column('subject', 'school_id')
    
    # Step 7: Drop class_subject junction table
    op.drop_index(op.f('ix_class_subject_subject_id'), table_name='class_subject')
    op.drop_index(op.f('ix_class_subject_class_id'), table_name='class_subject')
    op.drop_table('class_subject')
