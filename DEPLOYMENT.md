# Deployment Guide - Zero-Cost Setup

This guide will help you deploy the School Management Platform to production using free tiers:
- **Render** (Backend API)
- **Vercel** (Frontend)
- **Supabase** (PostgreSQL Database)
- **Upstash** (Redis)
- **GitHub Actions** (Healthcheck Pinger)

**Total Cost: $0/month**

---

## Prerequisites

1. GitHub account with your code repository
2. Render account (free tier)
3. Vercel account (free tier)
4. Supabase account (free tier)
5. Upstash account (free tier)

---

## Step 1: Set Up Supabase (Database)

### 1.1 Create Supabase Project

1. Go to [https://supabase.com](https://supabase.com) and sign up/login
2. Click "New Project"
3. Choose your organization
4. Fill in project details:
   - **Name**: `school-management-db` (or your preference)
   - **Database Password**: Generate a strong password and **save it**
   - **Region**: Choose closest to your users
   - Click "Create new project"

### 1.2 Get Connection String

1. Wait for project to finish provisioning (~2 minutes)
2. Go to **Settings** → **Database**
3. Scroll to **Connection String** section
4. Copy the **Connection string** (URI) under "Connection pooling"
   - It looks like: `postgresql://postgres:[YOUR-PASSWORD]@db.xxxxx.supabase.co:5432/postgres`
5. **Convert to async format**: Replace `postgresql://` with `postgresql+asyncpg://`
   - Example: `postgresql+asyncpg://postgres:[YOUR-PASSWORD]@db.xxxxx.supabase.co:5432/postgres`

**Save this connection string** - you'll need it for Render.

### 1.3 Run Database Migrations

You'll need to run Alembic migrations to set up your database schema. You can do this:

**Option A: Run migrations locally (before deployment)**
```bash
cd backend
# Set DATABASE_URL to your Supabase connection string
export DATABASE_URL="postgresql+asyncpg://postgres:[PASSWORD]@db.xxxxx.supabase.co:5432/postgres"
alembic upgrade head
```

**Option B: Run migrations after Render deployment**
- SSH into Render service or use Render Shell
- Run: `alembic upgrade head`

---

## Step 2: Set Up Upstash (Redis)

### 2.1 Create Upstash Redis Database

1. Go to [https://upstash.com](https://upstash.com) and sign up/login
2. Click "Create Database"
3. Configure:
   - **Name**: `school-management-redis`
   - **Type**: Regional (choose free tier)
   - **Region**: Same as Supabase for best performance
   - Click "Create"

### 2.2 Get Redis URL

1. After creation, click on your database
2. Go to the **Details** tab
3. Copy the **Redis URL**
   - Format: `redis://default:[PASSWORD]@[HOST]:[PORT]`
   - Example: `redis://default:xxxxx@usw1-xxxxx.upstash.io:6379`

**Save this Redis URL** - you'll need it for Render.

---

## Step 3: Deploy Backend to Render

### 3.1 Connect Repository to Render

1. Go to [https://render.com](https://render.com) and sign up/login
2. Click "New +" → "Web Service"
3. Connect your GitHub account if not already connected
4. Select your repository
5. Render should detect the `render.yaml` file (if in root) or configure manually:

### 3.2 Configure Web Service

If using `render.yaml` (recommended):
- Render will auto-detect settings
- Review and adjust if needed

If configuring manually:
- **Name**: `school-management-api`
- **Environment**: `Python 3`
- **Region**: Oregon (or closest to users)
- **Branch**: `main` (or your default branch)
- **Root Directory**: `backend`
- **Build Command**: `pip install -r requirements.txt`
- **Start Command**: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
- **Plan**: Free

### 3.3 Set Environment Variables

In Render dashboard, go to **Environment** tab and add:

#### Required Variables:

```
ENVIRONMENT=production
DEBUG=false
DATABASE_URL=postgresql+asyncpg://postgres:[YOUR-SUPABASE-PASSWORD]@db.xxxxx.supabase.co:5432/postgres
REDIS_URL=redis://default:[YOUR-UPSTASH-PASSWORD]@xxxxx.upstash.io:6379
JWT_SECRET_KEY=[GENERATE-64-CHAR-SECRET]
CORS_ORIGINS=https://your-app.vercel.app
EMAIL_ENABLED=false
SMS_ENABLED=false
```

**Generate JWT_SECRET_KEY:**
```bash
python -c "import secrets; print(secrets.token_urlsafe(64))"
```

**Important Notes:**
- Replace `[YOUR-SUPABASE-PASSWORD]` with actual password (keep brackets in connection string)
- Replace `[YOUR-UPSTASH-PASSWORD]` with actual password
- Replace `[GENERATE-64-CHAR-SECRET]` with generated secret (min 64 chars)
- Replace `https://your-app.vercel.app` with your actual Vercel URL (you'll update this after frontend deployment)

### 3.4 Deploy

1. Click "Create Web Service"
2. Wait for first deployment (~5-10 minutes)
3. Note your service URL: `https://school-management-api.onrender.com` (or similar)

### 3.5 Run Database Migrations

After first deployment, you need to run migrations:

1. In Render dashboard, go to your service
2. Open **Shell** tab
3. Run:
```bash
cd backend
alembic upgrade head
```

---

## Step 4: Deploy Frontend to Vercel

### 4.1 Connect Repository to Vercel

1. Go to [https://vercel.com](https://vercel.com) and sign up/login
2. Click "Add New..." → "Project"
3. Import your GitHub repository
4. Configure project:

### 4.2 Configure Project Settings

- **Framework Preset**: Vite
- **Root Directory**: `frontend`
- **Build Command**: `npm run build` (should auto-detect)
- **Output Directory**: `dist` (should auto-detect)
- **Install Command**: `npm install` (should auto-detect)

### 4.3 Set Environment Variables

In Vercel dashboard, go to **Settings** → **Environment Variables**:

Add:
```
VITE_API_BASE_URL=https://school-management-api.onrender.com/api/v1
```

**Important:** Replace `school-management-api.onrender.com` with your actual Render service URL.

### 4.4 Deploy

1. Click "Deploy"
2. Wait for deployment (~2-3 minutes)
3. Note your Vercel URL: `https://your-app.vercel.app` (or custom domain)

### 4.5 Update Render CORS

After getting your Vercel URL:

1. Go back to Render dashboard
2. Edit your web service
3. Go to **Environment** tab
4. Update `CORS_ORIGINS`:
   ```
   CORS_ORIGINS=https://your-app.vercel.app,https://your-app-git-main.vercel.app
   ```
5. Save and redeploy (or wait for auto-redeploy)

---

## Step 5: Set Up GitHub Actions Healthcheck

### 5.1 Add GitHub Secret

1. Go to your GitHub repository
2. Navigate to **Settings** → **Secrets and variables** → **Actions**
3. Click "New repository secret"
4. Name: `BACKEND_URL`
5. Value: `https://school-management-api.onrender.com` (your Render URL)
6. Click "Add secret"

### 5.2 Enable GitHub Actions

1. Go to **Settings** → **Actions** → **General**
2. Under "Workflow permissions", select "Read and write permissions"
3. Save changes

### 5.3 Verify Healthcheck Workflow

The healthcheck workflow (`.github/workflows/healthcheck.yml`) should:
- Run every 5 minutes automatically
- Ping your Render backend `/health` endpoint
- Keep the Render free tier service awake (prevents 15-minute spin-down)

**Note:** The workflow will start running automatically once the file is in your repository and Actions are enabled.

---

## Step 6: Verify Deployment

### 6.1 Check Backend

1. Visit: `https://your-backend.onrender.com/health`
2. Should return: `{"status":"healthy","version":"1.0.0",...}`

### 6.2 Check Frontend

1. Visit: `https://your-app.vercel.app`
2. Should load the login page
3. Try logging in (create a user via API first if needed)

### 6.3 Check Healthcheck

1. Go to GitHub repository → **Actions** tab
2. You should see "Healthcheck Pinger" workflow runs
3. Runs should succeed (green checkmark)

---

## Troubleshooting

### Backend Issues

**Problem: Service keeps spinning down**
- Solution: Healthcheck should prevent this. Check GitHub Actions workflow is running.

**Problem: Database connection errors**
- Check `DATABASE_URL` format (must be `postgresql+asyncpg://`)
- Verify Supabase database is running
- Check password is correct (no extra spaces)

**Problem: Migrations failed**
- Run migrations manually via Render Shell: `alembic upgrade head`
- Check database connection first: `alembic current`

**Problem: CORS errors in browser**
- Verify `CORS_ORIGINS` includes your Vercel URL
- Check for typos in Vercel URL
- Restart Render service after updating CORS_ORIGINS

### Frontend Issues

**Problem: API calls failing**
- Check `VITE_API_BASE_URL` is set correctly in Vercel
- Verify backend is accessible: `https://your-backend.onrender.com/health`
- Check browser console for CORS errors

**Problem: Build fails**
- Check Node.js version (should be 18+)
- Review build logs in Vercel dashboard
- Ensure all dependencies are in `package.json`

### Redis Issues

**Problem: Celery/Redis connection errors**
- Verify `REDIS_URL` is correct in Render
- Check Upstash dashboard - database should be "Active"
- Free tier limit: 10,000 commands/day (monitor usage)

### Supabase Issues

**Problem: Connection limit exceeded**
- Free tier: 500MB database, limited connections
- Monitor usage in Supabase dashboard
- Consider connection pooling (already using asyncpg)

---

## Cost Tracking

To ensure you stay on free tiers:

### Render Free Tier Limits:
- ✅ 750 hours/month (enough for 24/7)
- ⚠️ Spins down after 15 minutes inactivity (healthcheck prevents this)
- ⚠️ Cold starts take ~30-60 seconds

### Vercel Free Tier Limits:
- ✅ Unlimited deployments
- ✅ 100GB bandwidth/month
- ✅ 100 build minutes/month

### Supabase Free Tier Limits:
- ✅ 500MB database
- ✅ 2GB bandwidth/month
- ⚠️ Limited connections (use connection pooling)

### Upstash Free Tier Limits:
- ✅ 10,000 commands/day
- ✅ 256MB storage

### GitHub Actions Free Tier:
- ✅ 2,000 minutes/month
- Healthcheck uses ~72 minutes/month (well within limit)

---

## Next Steps

1. **Set up file storage** (if needed):
   - Option A: Supabase Storage (free tier: 1GB)
   - Option B: AWS S3 (pay per use, ~$1-5/month)
   - Update `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` in Render

2. **Enable email** (if needed):
   - Sign up for SendGrid free tier
   - Set `EMAIL_ENABLED=true`
   - Add `SENDGRID_API_KEY` to Render

3. **Enable SMS** (if needed):
   - Sign up for Africa's Talking
   - Set `SMS_ENABLED=true`
   - Add API credentials to Render

4. **Custom domain** (optional):
   - Configure custom domain in Vercel
   - Update `CORS_ORIGINS` in Render
   - Update DNS records

5. **Monitoring**:
   - Set up error tracking (Sentry free tier)
   - Monitor Render logs for errors
   - Monitor Upstash/Supabase usage

---

## Support

If you encounter issues:
1. Check Render logs: Dashboard → Your Service → Logs
2. Check Vercel logs: Dashboard → Your Project → Deployments → View Build Logs
3. Check GitHub Actions logs: Repository → Actions → Failed Workflow
4. Review this guide's Troubleshooting section

---

## Environment Variable Reference

### Backend (Render) - Required:

```env
ENVIRONMENT=production
DEBUG=false
DATABASE_URL=postgresql+asyncpg://postgres:[PASSWORD]@db.xxxxx.supabase.co:5432/postgres
REDIS_URL=redis://default:[PASSWORD]@xxxxx.upstash.io:6379
JWT_SECRET_KEY=[64-CHAR-MINIMUM-SECRET]
CORS_ORIGINS=https://your-app.vercel.app
EMAIL_ENABLED=false
SMS_ENABLED=false
```

### Frontend (Vercel) - Required:

```env
VITE_API_BASE_URL=https://your-backend.onrender.com/api/v1
```

### GitHub Actions - Required Secret:

```
BACKEND_URL=https://your-backend.onrender.com
```

---

**Deployment Complete!** 🎉

Your app should now be running on free tiers. Monitor usage and upgrade services as needed.

