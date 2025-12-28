# Row Level Security (RLS) Setup Guide

This guide explains how to set up Row Level Security (RLS) for the School Management Platform.

## Important Notes

**RLS does NOT work with superuser connections.** The `postgres` superuser bypasses all RLS policies. To use RLS, you must:

1. Create a non-superuser database role
2. Use that role for database connections
3. Set session variables to identify the current tenant

## Step 1: Create Non-Superuser Database Role

Connect to your Supabase database and run:

```sql
-- Create application role
CREATE ROLE app_user WITH LOGIN PASSWORD 'your_secure_password_here';

-- Grant necessary permissions
GRANT CONNECT ON DATABASE postgres TO app_user;
GRANT USAGE ON SCHEMA public TO app_user;
GRANT ALL ON ALL TABLES IN SCHEMA public TO app_user;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO app_user;

-- Grant permissions on future tables
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO app_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO app_user;

-- Grant execute permission on the helper function
GRANT EXECUTE ON FUNCTION current_school_id() TO app_user;
```

## Step 2: Update Connection String

Update your `DATABASE_URL` to use the new role:

**Before (superuser):**
```
postgresql+asyncpg://postgres:[PASSWORD]@host:port/postgres
```

**After (app_user):**
```
postgresql+asyncpg://app_user:[PASSWORD]@host:port/postgres
```

## Step 3: Update Application Code to Set Session Variable

You need to set the `app.school_id` session variable for each database connection based on the authenticated user's JWT token.

### Option A: Set in Database Connection (Recommended)

Update `backend/app/core/database.py` to set the session variable after connection:

```python
from sqlalchemy.ext.asyncio import AsyncSession

async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """
    FastAPI dependency for database sessions.
    Sets app.school_id session variable for RLS.
    """
    async with AsyncSessionLocal() as session:
        try:
            # Get current user from context (set by middleware/dependency)
            # This assumes you have a way to get current_user in this context
            # You may need to pass it differently depending on your architecture
            current_user = get_current_user_from_context()  # Implement this
            
            if current_user and current_user.school_id:
                # Set session variable for RLS
                await session.execute(
                    text("SET LOCAL app.school_id = :school_id"),
                    {"school_id": str(current_user.school_id)}
                )
            
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
```

**Note:** This requires access to the current user in the database dependency, which might require architectural changes.

### Option B: Set via SQLAlchemy Event Listener (Alternative)

Alternatively, you can use SQLAlchemy events to set the variable on connection:

```python
from sqlalchemy import event
from sqlalchemy.ext.asyncio import AsyncEngine

@event.listens_for(engine.sync_engine, "connect")
def set_school_id(dbapi_conn, connection_record):
    # This approach is tricky because you need the user context
    # You might need to use connection-local storage
    pass
```

### Option C: Set Per-Request via Middleware (Practical Approach)

Create middleware that sets the variable for each request:

```python
from fastapi import Request
from sqlalchemy import text
from app.core.database import AsyncSessionLocal

@app.middleware("http")
async def set_rls_context(request: Request, call_next):
    """
    Set RLS context (school_id) for database connections in this request.
    """
    # Extract user from request (set by authentication middleware)
    # This is a simplified example - adjust to your auth setup
    auth_header = request.headers.get("Authorization")
    if auth_header:
        token = auth_header.replace("Bearer ", "")
        user = decode_user_from_token(token)  # Implement this
        
        if user and user.school_id:
            # Store in request state for use in get_db dependency
            request.state.school_id = user.school_id
    
    response = await call_next(request)
    return response

# Then in get_db:
async def get_db(request: Request) -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        try:
            # Get school_id from request state (set by middleware)
            school_id = getattr(request.state, 'school_id', None)
            
            if school_id:
                await session.execute(
                    text("SET LOCAL app.school_id = :school_id"),
                    {"school_id": str(school_id)}
                )
            
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
```

## Step 4: Run the Migration

Run the migration to enable RLS:

```bash
cd backend
alembic upgrade head
```

## Step 5: Test RLS

1. Connect as `app_user` (not `postgres`)
2. Try to access data without setting `app.school_id` - should see no rows
3. Set `app.school_id` and verify you only see data for that school
4. Try accessing data from another school - should be blocked

## Important Considerations

### School Table
The `school` table does NOT have RLS enabled because:
- Users need to query it to validate their school exists
- Authentication logic needs to verify school records
- It's the root tenant table

### Token Tables
Token tables (`refresh_token`, `account_setup_token`, `password_reset_token`) are scoped to the user's school. If you need tokens to work across schools (e.g., for password reset), you may need to adjust the policies.

### Performance Impact
RLS policies add overhead to queries. The impact should be minimal with proper indexing on `school_id`, but monitor query performance after enabling RLS.

## Troubleshooting

### Issue: RLS not working
- **Check**: Are you using a superuser connection? RLS is bypassed for superusers.
- **Solution**: Use the `app_user` role instead of `postgres`.

### Issue: No rows returned
- **Check**: Is `app.school_id` being set correctly?
- **Solution**: Verify the session variable is set: `SHOW app.school_id;`

### Issue: Permission errors
- **Check**: Does `app_user` have proper grants?
- **Solution**: Run the GRANT statements in Step 1 again.

### Issue: Migration fails
- **Check**: Are there existing policies?
- **Solution**: The migration includes `IF EXISTS` clauses, but you can manually drop policies if needed.

## Security Notes

1. **RLS is defense-in-depth** - Your application code should still filter by `school_id`. RLS catches bugs and prevents data leaks.

2. **Session variables** are connection-local and reset on disconnect. They're safe for connection pooling if set per request.

3. **Never trust client-set variables** - Always set `app.school_id` server-side from the authenticated user's JWT token, never from client input.

4. **Test thoroughly** - RLS can be tricky. Test with multiple schools and verify isolation.

