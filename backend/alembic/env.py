"""
Alembic environment configuration for async SQLAlchemy 2.0.

This file configures Alembic to work with:
- Async SQLAlchemy 2.0
- Settings from app.core.config
- Models from app.models
- Async migrations support

Note: Uses async engine with run_sync() for compatibility.
"""

import asyncio
from logging.config import fileConfig

from sqlalchemy import pool
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import AsyncEngine, async_engine_from_config

from alembic import context

# Import settings and models
from app.core.config import settings
from app.models import Base

# this is the Alembic Config object, which provides
# access to the values within the .ini file in use.
config = context.config

# Interpret the config file for Python logging.
# This line sets up loggers basically.
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Set target_metadata for autogenerate support
target_metadata = Base.metadata

# Override sqlalchemy.url from settings (if not set in alembic.ini)
# Keep asyncpg URL for async migrations
# Note: We need to escape % for ConfigParser (double it)
database_url = str(settings.DATABASE_URL).replace("%", "%%")
config.set_main_option("sqlalchemy.url", database_url)


def run_migrations_offline() -> None:
    """
    Run migrations in 'offline' mode.

    This configures the context with just a URL
    and not an Engine, though an Engine is acceptable
    here as well.  By skipping the Engine creation
    we don't even need a DBAPI to be available.

    Calls to context.execute() here emit the given string to the
    script output.
    
    For offline mode, we convert to sync URL since we can't use async.
    """
    url = str(settings.DATABASE_URL)
    # Convert asyncpg to psycopg2 for offline SQL generation
    if url.startswith("postgresql+asyncpg://"):
        url = url.replace("postgresql+asyncpg://", "postgresql://", 1)
    
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection: Connection) -> None:
    """
    Run migrations with the given connection.
    
    This function is called from async context via run_sync().
    """
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
    )

    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    """
    Run migrations in async mode.
    
    Creates an async engine and runs migrations using run_sync().
    This is the recommended approach for SQLAlchemy 2.0 async.
    """
    # Get database URL from config (already set from settings)
    database_url = config.get_main_option("sqlalchemy.url")
    
    # Remove pgbouncer parameter if present (asyncpg doesn't accept it)
    # pgbouncer=true is used for other drivers but not needed for asyncpg
    if "?pgbouncer=" in database_url or "&pgbouncer=" in database_url:
        from urllib.parse import urlparse, parse_qs, urlencode, urlunparse
        parsed = urlparse(database_url)
        query_params = parse_qs(parsed.query)
        # Remove pgbouncer parameter
        query_params.pop("pgbouncer", None)
        # Rebuild URL without pgbouncer parameter
        new_query = urlencode(query_params, doseq=True)
        database_url = urlunparse(parsed._replace(query=new_query))
    
    # Create async engine directly with the URL
    # This ensures we use asyncpg driver
    from sqlalchemy.ext.asyncio import create_async_engine
    
    # For pgbouncer (transaction mode), disable prepared statement cache
    # pgbouncer doesn't support prepared statements properly
    connect_args = {}
    if "pooler.supabase.com" in database_url:
        connect_args["statement_cache_size"] = 0
    
    connectable = create_async_engine(
        database_url,
        poolclass=pool.NullPool,
        echo=False,
        connect_args=connect_args,
    )

    async with connectable.connect() as connection:
        # Run migrations in sync context within async connection
        await connection.run_sync(do_run_migrations)

    await connectable.dispose()


def run_migrations_online() -> None:
    """
    Run migrations in 'online' mode.
    
    Uses async engine with run_sync() pattern for SQLAlchemy 2.0.
    """
    asyncio.run(run_async_migrations())


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
