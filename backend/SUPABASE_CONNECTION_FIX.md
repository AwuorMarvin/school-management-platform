# Fix Supabase Direct Connection Issue

## Problem
Direct Connection (port 5432) may not resolve properly or the project may not be fully ready.

## Solution: Use Transaction Mode (Connection Pooling)

**Transaction Mode is recommended for applications anyway** - it provides better performance and reliability.

### Steps:

1. **Go to Supabase Dashboard**
   - Settings → Database
   - Scroll to "Connection String" section

2. **Copy the "Transaction Mode" connection string**
   - It looks like: `postgresql://postgres:[PASSWORD]@aws-0-[region].pooler.supabase.com:6543/postgres?pgbouncer=true`
   - Uses port **6543** (not 5432)
   - Uses `pooler.supabase.com` domain (not `db.*.supabase.co`)

3. **Convert to asyncpg format**
   - Change `postgresql://` to `postgresql+asyncpg://`
   - Keep the `?pgbouncer=true` parameter
   - Example:
     ```
     postgresql+asyncpg://postgres:[YOUR-PASSWORD]@aws-0-us-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true
     ```

4. **Update your `.env` file**
   ```
   DATABASE_URL=postgresql+asyncpg://postgres:[YOUR-PASSWORD]@aws-0-[region].pooler.supabase.com:6543/postgres?pgbouncer=true
   ```

5. **Test the connection**
   ```bash
   cd backend
   python test_supabase_connection.py
   ```

6. **Run migrations**
   ```bash
   alembic upgrade head
   ```

## Why Transaction Mode?

- ✅ More reliable (uses connection pooling)
- ✅ Better for applications
- ✅ Recommended by Supabase for production
- ✅ Handles high connection counts better
- ✅ Usually resolves DNS properly

## If Transaction Mode Doesn't Work

1. **Check project status** in Supabase dashboard - make sure it's "Active"
2. **Wait a few minutes** if the project was just created
3. **Try Session Mode** connection string as an alternative
4. **Check your network/firewall** allows outbound connections

