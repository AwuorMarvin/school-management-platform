"""add_fee_structure_v2_fields_versioning_one_off

Revision ID: a1b2c3d4e5f6
Revises: 0b2a5f72b316
Create Date: 2025-01-20 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = "a1b2c3d4e5f6"
down_revision: Union[str, Sequence[str], None] = "0b2a5f72b316"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add v2 fields: versioning, multi-class support, one-off fees."""
    
    # Step 1: Add new columns to fee_structure
    op.add_column(
        "fee_structure",
        sa.Column(
            "campus_id",
            postgresql.UUID(as_uuid=True),
            nullable=True,  # Will be set to NOT NULL after data migration
            comment="Campus this fee structure applies to"
        )
    )
    op.add_column(
        "fee_structure",
        sa.Column(
            "academic_year_id",
            postgresql.UUID(as_uuid=True),
            nullable=True,  # Will be set to NOT NULL after data migration
            comment="Academic year this structure belongs to"
        )
    )
    op.add_column(
        "fee_structure",
        sa.Column(
            "version",
            sa.Integer(),
            nullable=False,
            server_default="1",
            comment="Version number (increments on edit)"
        )
    )
    op.add_column(
        "fee_structure",
        sa.Column(
            "parent_structure_id",
            postgresql.UUID(as_uuid=True),
            nullable=True,
            comment="Parent structure ID (for versioning - links to previous version)"
        )
    )
    op.add_column(
        "fee_structure",
        sa.Column(
            "effective_from",
            sa.DateTime(timezone=True),
            nullable=True,
            comment="When this structure becomes effective"
        )
    )
    op.add_column(
        "fee_structure",
        sa.Column(
            "effective_to",
            sa.DateTime(timezone=True),
            nullable=True,
            comment="When this structure expires (for historical tracking)"
        )
    )
    
    # Step 2: Make term_id nullable (for YEAR-scoped structures)
    op.alter_column(
        "fee_structure",
        "term_id",
        existing_type=postgresql.UUID(as_uuid=True),
        nullable=True
    )
    
    # Step 3: Migrate existing data - populate campus_id and academic_year_id from class and term
    op.execute("""
        UPDATE fee_structure fs
        SET 
            campus_id = c.campus_id,
            academic_year_id = c.academic_year_id
        FROM "class" c
        WHERE fs.class_id = c.id
    """)
    
    # Step 4: Now make campus_id and academic_year_id NOT NULL
    op.alter_column(
        "fee_structure",
        "campus_id",
        existing_type=postgresql.UUID(as_uuid=True),
        nullable=False
    )
    op.alter_column(
        "fee_structure",
        "academic_year_id",
        existing_type=postgresql.UUID(as_uuid=True),
        nullable=False
    )
    
    # Step 5: Add foreign key constraints
    op.create_foreign_key(
        "fk_fee_structure_campus",
        "fee_structure",
        "campus",
        ["campus_id"],
        ["id"],
        ondelete="RESTRICT"
    )
    op.create_foreign_key(
        "fk_fee_structure_academic_year",
        "fee_structure",
        "academic_year",
        ["academic_year_id"],
        ["id"],
        ondelete="RESTRICT"
    )
    op.create_foreign_key(
        "fk_fee_structure_parent",
        "fee_structure",
        "fee_structure",
        ["parent_structure_id"],
        ["id"],
        ondelete="SET NULL"
    )
    
    # Step 6: Add indexes
    op.create_index(
        "ix_fee_structure_campus_id",
        "fee_structure",
        ["campus_id"]
    )
    op.create_index(
        "ix_fee_structure_academic_year_id",
        "fee_structure",
        ["academic_year_id"]
    )
    op.create_index(
        "ix_fee_structure_parent_structure_id",
        "fee_structure",
        ["parent_structure_id"]
    )
    
    # Step 7: Add check constraint for version
    op.create_check_constraint(
        "ck_fee_structure_version",
        "fee_structure",
        "version > 0"
    )
    
    # Step 8: Update existing index to include new fields
    op.drop_index("idx_fee_structure_active", table_name="fee_structure")
    op.create_index(
        "idx_fee_structure_active",
        "fee_structure",
        ["campus_id", "academic_year_id", "term_id", "status"],
        unique=False
    )
    
    # Step 9: Create fee_structure_class junction table for multi-class support
    op.create_table(
        "fee_structure_class",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            nullable=False,
            comment="Unique identifier (UUID)"
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
            comment="Timestamp when record was created"
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=True,
            comment="Timestamp when record was last updated"
        ),
        sa.Column(
            "fee_structure_id",
            postgresql.UUID(as_uuid=True),
            nullable=False,
            comment="Fee structure ID"
        ),
        sa.Column(
            "class_id",
            postgresql.UUID(as_uuid=True),
            nullable=False,
            comment="Class ID"
        ),
        sa.ForeignKeyConstraint(
            ["fee_structure_id"],
            ["fee_structure.id"],
            ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["class_id"],
            ["class.id"],
            ondelete="RESTRICT"
        ),
        sa.PrimaryKeyConstraint("id"),
        comment="Junction table: Fee structures to classes (many-to-many)"
    )
    op.create_index(
        "ix_fee_structure_class_fee_structure_id",
        "fee_structure_class",
        ["fee_structure_id"]
    )
    op.create_index(
        "ix_fee_structure_class_class_id",
        "fee_structure_class",
        ["class_id"]
    )
    
    # Step 10: Migrate existing class_id relationships to junction table
    op.execute("""
        INSERT INTO fee_structure_class (id, created_at, fee_structure_id, class_id)
        SELECT 
            gen_random_uuid(),
            fs.created_at,
            fs.id,
            fs.class_id
        FROM fee_structure fs
    """)
    
    # Step 11: Add is_one_off to fee_line_item
    op.add_column(
        "fee_line_item",
        sa.Column(
            "is_one_off",
            sa.Boolean(),
            nullable=False,
            server_default="false",
            comment="If true, this line item is charged once for new students only (one-off fee)"
        )
    )
    
    # Step 12: Add check constraint: is_annual and is_one_off cannot both be true
    op.create_check_constraint(
        "ck_fee_line_item_type_exclusive",
        "fee_line_item",
        "NOT (is_annual = true AND is_one_off = true)"
    )
    
    # Step 13: Create student_one_off_fee table
    op.create_table(
        "student_one_off_fee",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            nullable=False,
            comment="Unique identifier (UUID)"
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
            comment="Timestamp when record was created"
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=True,
            comment="Timestamp when record was last updated"
        ),
        sa.Column(
            "student_id",
            postgresql.UUID(as_uuid=True),
            nullable=False,
            comment="Student who paid this one-off fee"
        ),
        sa.Column(
            "fee_line_item_id",
            postgresql.UUID(as_uuid=True),
            nullable=False,
            comment="The one-off fee line item that was paid"
        ),
        sa.Column(
            "academic_year_id",
            postgresql.UUID(as_uuid=True),
            nullable=False,
            comment="Academic year this one-off fee applies to"
        ),
        sa.Column(
            "paid_at",
            sa.DateTime(timezone=True),
            nullable=True,
            comment="When this one-off fee was paid (NULL if not yet paid)"
        ),
        sa.ForeignKeyConstraint(
            ["student_id"],
            ["student.id"],
            ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["fee_line_item_id"],
            ["fee_line_item.id"],
            ondelete="RESTRICT"
        ),
        sa.ForeignKeyConstraint(
            ["academic_year_id"],
            ["academic_year.id"],
            ondelete="RESTRICT"
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "student_id",
            "fee_line_item_id",
            "academic_year_id",
            name="uq_student_one_off_fee"
        ),
        comment="Tracks one-off fees paid by students per academic year"
    )
    op.create_index(
        "ix_student_one_off_fee_student_id",
        "student_one_off_fee",
        ["student_id"]
    )
    op.create_index(
        "ix_student_one_off_fee_fee_line_item_id",
        "student_one_off_fee",
        ["fee_line_item_id"]
    )
    op.create_index(
        "ix_student_one_off_fee_academic_year_id",
        "student_one_off_fee",
        ["academic_year_id"]
    )


def downgrade() -> None:
    """Remove v2 fields."""
    
    # Drop student_one_off_fee table
    op.drop_table("student_one_off_fee")
    
    # Remove is_one_off from fee_line_item
    op.drop_constraint("ck_fee_line_item_type_exclusive", "fee_line_item", type_="check")
    op.drop_column("fee_line_item", "is_one_off")
    
    # Drop fee_structure_class junction table
    op.drop_table("fee_structure_class")
    
    # Remove indexes
    op.drop_index("idx_fee_structure_active", table_name="fee_structure")
    op.create_index(
        "idx_fee_structure_active",
        "fee_structure",
        ["class_id", "term_id", "status"],
        unique=False
    )
    op.drop_index("ix_fee_structure_parent_structure_id", table_name="fee_structure")
    op.drop_index("ix_fee_structure_academic_year_id", table_name="fee_structure")
    op.drop_index("ix_fee_structure_campus_id", table_name="fee_structure")
    
    # Remove constraints
    op.drop_constraint("ck_fee_structure_version", "fee_structure", type_="check")
    op.drop_constraint("fk_fee_structure_parent", "fee_structure", type_="foreignkey")
    op.drop_constraint("fk_fee_structure_academic_year", "fee_structure", type_="foreignkey")
    op.drop_constraint("fk_fee_structure_campus", "fee_structure", type_="foreignkey")
    
    # Remove columns
    op.drop_column("fee_structure", "effective_to")
    op.drop_column("fee_structure", "effective_from")
    op.drop_column("fee_structure", "parent_structure_id")
    op.drop_column("fee_structure", "version")
    op.drop_column("fee_structure", "academic_year_id")
    op.drop_column("fee_structure", "campus_id")
    
    # Make term_id NOT NULL again
    op.alter_column(
        "fee_structure",
        "term_id",
        existing_type=postgresql.UUID(as_uuid=True),
        nullable=False
    )

