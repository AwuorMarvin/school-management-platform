"""make_fee_structure_class_id_nullable

Revision ID: d7e8f9a0b1c2
Revises: a1b2c3d4e5f6
Create Date: 2025-12-19 23:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = "d7e8f9a0b1c2"
down_revision: Union[str, Sequence[str], None] = ["a1b2c3d4e5f6", "3972e3035615"]  # Merge both branches
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """
    Make class_id nullable in fee_structure table.
    
    This migration:
    1. Ensures all existing fee structures have entries in fee_structure_class junction table
    2. Makes class_id nullable (since we now use junction table for multi-class support)
    3. Removes the NOT NULL constraint
    """
    
    # Step 1: Ensure all existing fee structures have entries in fee_structure_class
    # This handles any structures that might have been created before the junction table migration
    op.execute("""
        INSERT INTO fee_structure_class (id, created_at, fee_structure_id, class_id)
        SELECT 
            gen_random_uuid(),
            fs.created_at,
            fs.id,
            fs.class_id
        FROM fee_structure fs
        WHERE fs.class_id IS NOT NULL
        AND NOT EXISTS (
            SELECT 1 
            FROM fee_structure_class fsc 
            WHERE fsc.fee_structure_id = fs.id
        )
    """)
    
    # Step 2: Drop the foreign key constraint temporarily (we'll recreate it)
    op.drop_constraint('fee_structure_class_id_fkey', 'fee_structure', type_='foreignkey')
    
    # Step 3: Drop the index on class_id (we'll recreate it if needed)
    op.drop_index('ix_fee_structure_class_id', table_name='fee_structure')
    
    # Step 4: Make class_id nullable
    op.alter_column(
        'fee_structure',
        'class_id',
        existing_type=postgresql.UUID(as_uuid=True),
        nullable=True,
        existing_nullable=False
    )
    
    # Step 5: Recreate the foreign key constraint (now nullable)
    op.create_foreign_key(
        'fee_structure_class_id_fkey',
        'fee_structure',
        'class',
        ['class_id'],
        ['id'],
        ondelete='RESTRICT'
    )
    
    # Step 6: Recreate the index (for backward compatibility queries)
    op.create_index(
        'ix_fee_structure_class_id',
        'fee_structure',
        ['class_id'],
        unique=False
    )


def downgrade() -> None:
    """
    Revert class_id to NOT NULL.
    
    WARNING: This will fail if there are any fee structures with NULL class_id.
    """
    
    # Step 1: Ensure all fee structures have a class_id before making it NOT NULL
    # Set class_id to the first class from the junction table for any NULL values
    op.execute("""
        UPDATE fee_structure fs
        SET class_id = (
            SELECT fsc.class_id 
            FROM fee_structure_class fsc 
            WHERE fsc.fee_structure_id = fs.id 
            LIMIT 1
        )
        WHERE fs.class_id IS NULL
        AND EXISTS (
            SELECT 1 
            FROM fee_structure_class fsc 
            WHERE fsc.fee_structure_id = fs.id
        )
    """)
    
    # Step 2: Drop foreign key and index
    op.drop_constraint('fee_structure_class_id_fkey', 'fee_structure', type_='foreignkey')
    op.drop_index('ix_fee_structure_class_id', table_name='fee_structure')
    
    # Step 3: Make class_id NOT NULL again
    op.alter_column(
        'fee_structure',
        'class_id',
        existing_type=postgresql.UUID(as_uuid=True),
        nullable=False,
        existing_nullable=True
    )
    
    # Step 4: Recreate foreign key and index
    op.create_foreign_key(
        'fee_structure_class_id_fkey',
        'fee_structure',
        'class',
        ['class_id'],
        ['id'],
        ondelete='RESTRICT'
    )
    op.create_index(
        'ix_fee_structure_class_id',
        'fee_structure',
        ['class_id'],
        unique=False
    )

