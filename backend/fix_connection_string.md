# Fix Connection String

Remove `?pgbouncer=true` from your DATABASE_URL in `.env` file.

For asyncpg driver, the connection string should be:
```
postgresql+asyncpg://postgres:[PASSWORD]@aws-0-[region].pooler.supabase.com:6543/postgres
```

NOT:
```
postgresql+asyncpg://postgres:[PASSWORD]@aws-0-[region].pooler.supabase.com:6543/postgres?pgbouncer=true
```

The `pgbouncer=true` parameter is not needed for asyncpg and causes errors.

