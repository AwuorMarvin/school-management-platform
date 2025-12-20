# Alembic Configuration

Alembic is configured for async SQLAlchemy 2.0 with the School Management Platform.

## Configuration Details

### Files Modified

1. **`alembic.ini`**
   - `sqlalchemy.url` is commented out (we use `.env` instead)
   - All other settings use defaults

2. **`alembic/env.py`**
   - Imports settings from `app.core.config`
   - Imports `Base` from `app.models`
   - Sets `target_metadata = Base.metadata`
   - Converts asyncpg URL to psycopg2 URL for migrations
   - Uses sync engine for migrations (standard Alembic approach)

### How It Works

- **Application Runtime**: Uses async engine (`asyncpg`) for async operations
- **Migrations**: Uses sync engine (`psycopg2`) for Alembic (standard practice)
- **URL Conversion**: Automatically converts `postgresql+asyncpg://` to `postgresql://` for migrations

## Usage

### Create a Migration

```bash
# Auto-generate migration from model changes
alembic revision --autogenerate -m "Description of changes"

# Manual migration (if needed)
alembic revision -m "Description of changes"
```

### Apply Migrations

```bash
# Apply all pending migrations
alembic upgrade head

# Apply specific revision
alembic upgrade <revision_id>

# Rollback one migration
alembic downgrade -1

# Rollback to specific revision
alembic downgrade <revision_id>
```

### Check Status

```bash
# Show current database revision
alembic current

# Show migration history
alembic history

# Show pending migrations
alembic heads
```

## Important Notes

1. **Database URL**: Must be set in `.env` file as `DATABASE_URL`
2. **Models Import**: All models must be imported in `app/models/__init__.py` for autogenerate to work
3. **Sync Driver**: Migrations use `psycopg2` (sync), app uses `asyncpg` (async)
4. **First Migration**: Create models first, then generate initial migration

## Next Steps

1. Create your database models in `app/models/`
2. Import all models in `app/models/__init__.py`
3. Generate initial migration: `alembic revision --autogenerate -m "Initial schema"`
4. Review the generated migration file
5. Apply migration: `alembic upgrade head`

## Troubleshooting

### "No module named 'app'"
- Make sure you're running commands from the `backend/` directory
- Check that `app/` is in your Python path

### "target_metadata is None"
- Make sure `Base` is imported in `app/models/__init__.py`
- Make sure all models are imported so they register with Base.metadata

### "Connection refused" or "Authentication failed"
- Check your `.env` file has correct `DATABASE_URL`
- Make sure PostgreSQL is running
- Verify database user and password are correct

### "No changes detected"
- Make sure models are imported in `app/models/__init__.py`
- Check that models inherit from `BaseModel` or `Base`
- Verify models have `__tablename__` defined

