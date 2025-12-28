# Supabase Connection Troubleshooting

## Issue Identified

Your DATABASE_URL format is correct, but the hostname `db.lsqlbakxhdpzjyacugph.supabase.co` is resolving to IPv6 only, which may cause connection issues.

## Solution Steps

### 1. Verify Connection String in Supabase Dashboard

1. Go to your Supabase project dashboard
2. Navigate to **Settings** → **Database**
3. Scroll to **Connection String** section
4. Check which connection string you're using:
   - **Transaction Mode** (recommended for pooling) - Port 6543
   - **Session Mode** - Port 5432
   - **Direct Connection** - Port 5432

### 2. Use Connection Pooling (Recommended)

For production/reliable connections, use the **Transaction Mode** connection string:
- This uses port **6543** instead of 5432
- Format: `postgresql://postgres:[PASSWORD]@aws-0-[region].pooler.supabase.com:6543/postgres?pgbouncer=true`

Convert to asyncpg format:
```
postgresql+asyncpg://postgres:[PASSWORD]@aws-0-[region].pooler.supabase.com:6543/postgres?pgbouncer=true
```

### 3. Alternative: Session Mode Connection String

If Transaction Mode doesn't work, try Session Mode:
- Port: 5432
- Format: `postgresql://postgres:[PASSWORD]@db.[project-ref].supabase.co:5432/postgres`

### 4. Check Project Status

1. Go to Supabase dashboard
2. Check if project status shows "Active"
3. If it's still provisioning, wait a few minutes and try again

### 5. Update Your .env File

After getting the correct connection string from Supabase:

1. Copy the connection string
2. Convert `postgresql://` to `postgresql+asyncpg://`
3. Update your `.env` file:
   ```
   DATABASE_URL=postgresql+asyncpg://postgres:[YOUR-PASSWORD]@[HOST]:[PORT]/postgres
   ```

### 6. Test Connection Again

Run the test script:
```bash
cd backend
python test_supabase_connection.py
```

Then try migrations:
```bash
alembic upgrade head
```

## Common Issues

1. **Wrong Port**: Using 5432 instead of 6543 (Transaction Mode)
2. **Missing pgbouncer parameter**: Transaction Mode needs `?pgbouncer=true`
3. **Project not ready**: Wait for Supabase to finish provisioning
4. **Network/Firewall**: Check if your network allows outbound connections to Supabase

