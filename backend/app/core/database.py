"""
Database configuration using SQLAlchemy 2.0 async.

This module provides:
- Async database engine
- Async session factory
- FastAPI dependency for database sessions
"""

from typing import AsyncGenerator
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.pool import AsyncAdaptedQueuePool, NullPool

from app.core.config import settings


# ============================================================================
# Database Engine Configuration
# ============================================================================
def get_engine_kwargs() -> dict:
    """
    Get engine configuration based on environment.
    
    Returns:
        Dictionary of engine kwargs for create_async_engine
    """
    engine_kwargs = {
        "echo": settings.DATABASE_ECHO,
        "future": True,
    }
    
    # Use NullPool for testing (new connection each time)
    if settings.is_testing:
        engine_kwargs["poolclass"] = NullPool
    else:
        # Use AsyncAdaptedQueuePool for development/production (async compatible)
        engine_kwargs["poolclass"] = AsyncAdaptedQueuePool
        engine_kwargs["pool_size"] = settings.DATABASE_POOL_SIZE
        engine_kwargs["max_overflow"] = settings.DATABASE_MAX_OVERFLOW
        engine_kwargs["pool_timeout"] = settings.DATABASE_POOL_TIMEOUT
        engine_kwargs["pool_pre_ping"] = True  # Verify connections before using
        engine_kwargs["pool_recycle"] = 3600  # Recycle connections after 1 hour
    
    return engine_kwargs


# ============================================================================
# Database Engine
# ============================================================================
engine: AsyncEngine = create_async_engine(
    str(settings.DATABASE_URL),
    **get_engine_kwargs()
)


# ============================================================================
# Session Factory
# ============================================================================
AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,  # Don't expire objects after commit
    autocommit=False,
    autoflush=False,
)


# ============================================================================
# FastAPI Dependency
# ============================================================================
async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """
    FastAPI dependency for database sessions.
    
    Usage:
        @router.get("/students")
        async def list_students(db: AsyncSession = Depends(get_db)):
            result = await db.execute(select(Student))
            return result.scalars().all()
    
    Yields:
        AsyncSession: Database session
    """
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


# ============================================================================
# Database Initialization
# ============================================================================
async def init_db() -> None:
    """
    Initialize database tables.
    
    Creates all tables defined in models.
    Should be called on application startup (for development).
    In production, use Alembic migrations instead.
    """
    from app.models import Base
    
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def drop_db() -> None:
    """
    Drop all database tables.
    
    WARNING: This deletes all data!
    Should only be used in tests or development reset.
    """
    from app.models import Base
    
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


async def close_db() -> None:
    """
    Close database engine and all connections.
    
    Should be called on application shutdown.
    """
    await engine.dispose()


# ============================================================================
# Transaction Context Manager
# ============================================================================
class DatabaseTransaction:
    """
    Context manager for database transactions.
    
    Usage:
        async with DatabaseTransaction() as session:
            student = Student(name="John")
            session.add(student)
            # Automatically commits on success, rolls back on exception
    """
    
    def __init__(self):
        self.session: AsyncSession | None = None
    
    async def __aenter__(self) -> AsyncSession:
        """Enter transaction context."""
        self.session = AsyncSessionLocal()
        return self.session
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Exit transaction context."""
        if exc_type is not None:
            # Exception occurred, rollback
            await self.session.rollback()
        else:
            # Success, commit
            await self.session.commit()
        
        await self.session.close()
        self.session = None


# ============================================================================
# Helper Functions
# ============================================================================
async def check_db_connection() -> bool:
    """
    Check if database connection is working.
    
    Returns:
        True if connection successful, False otherwise
    """
    try:
        async with engine.connect() as conn:
            await conn.execute("SELECT 1")
        return True
    except Exception as e:
        print(f"Database connection failed: {e}")
        return False


async def get_db_session() -> AsyncSession:
    """
    Get a new database session.
    
    Note: Caller is responsible for closing the session.
    Prefer using get_db() dependency in FastAPI routes.
    
    Returns:
        AsyncSession: New database session
    """
    return AsyncSessionLocal()

