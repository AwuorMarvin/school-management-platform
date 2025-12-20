"""
Base model for all database tables.

Provides common fields and SQLAlchemy 2.0 declarative base.
"""

from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import DateTime, func
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    """
    Base class for all database models.
    
    SQLAlchemy 2.0 declarative base with type annotations.
    """
    
    # Prevent SQLAlchemy from creating a table for this base class
    __abstract__ = True


class TimestampMixin:
    """
    Mixin for created_at and updated_at timestamp fields.
    
    Provides automatic timestamp tracking for all models.
    """
    
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        comment="Timestamp when record was created"
    )
    
    updated_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        onupdate=func.now(),
        comment="Timestamp when record was last updated"
    )


class BaseModel(Base, TimestampMixin):
    """
    Base model with UUID primary key and timestamps.
    
    All application models should inherit from this class.
    
    Provides:
    - id: UUID primary key (auto-generated)
    - created_at: Timestamp (auto-set on creation)
    - updated_at: Timestamp (auto-set on update)
    
    Example:
        class Student(BaseModel):
            __tablename__ = "student"
            
            first_name: Mapped[str] = mapped_column(String(100))
            last_name: Mapped[str] = mapped_column(String(100))
    """
    
    __abstract__ = True
    
    id: Mapped[UUID] = mapped_column(
        primary_key=True,
        default=uuid4,
        comment="Unique identifier (UUID)"
    )
    
    def __repr__(self) -> str:
        """String representation of model."""
        return f"<{self.__class__.__name__}(id={self.id})>"
    
    def to_dict(self) -> dict:
        """
        Convert model instance to dictionary.
        
        Returns:
            Dictionary with all column values
        """
        return {
            column.name: getattr(self, column.name)
            for column in self.__table__.columns
        }


class TenantMixin:
    """
    Mixin for multi-tenant models.
    
    Adds school_id foreign key for tenant isolation.
    Must be used with models that need tenant scoping.
    """
    
    from sqlalchemy import ForeignKey
    
    school_id: Mapped[UUID] = mapped_column(
        ForeignKey("school.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        comment="School (tenant) this record belongs to"
    )


# ============================================================================
# Helper Functions
# ============================================================================

def get_table_names() -> list[str]:
    """
    Get all table names from Base metadata.
    
    Returns:
        List of table names
    """
    return [table.name for table in Base.metadata.sorted_tables]


def get_model_by_tablename(tablename: str) -> type[Base] | None:
    """
    Get model class by table name.
    
    Args:
        tablename: Name of the table
        
    Returns:
        Model class or None if not found
    """
    for mapper in Base.registry.mappers:
        model = mapper.class_
        if hasattr(model, "__tablename__") and model.__tablename__ == tablename:
            return model
    return None

