# School Management Platform

Multi-tenant School Management SaaS platform (MVP) built with FastAPI and React.

## Tech Stack

- **Backend**: Python 3.11 + FastAPI + SQLAlchemy 2.0 + PostgreSQL 15
- **Frontend**: React 18 + TypeScript + Vite + Tailwind CSS
- **Database**: PostgreSQL 15 (Supabase)
- **Cache/Queue**: Redis (Upstash)
- **ORM**: SQLAlchemy 2.0 (async)
- **Migrations**: Alembic

## Quick Start

### Backend

```bash
cd backend
pip install -r requirements.txt
cp .env.example .env  # Configure your database
python run.py
```

See [backend/README.md](backend/README.md) for detailed setup instructions.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

See [frontend/README.md](frontend/README.md) for detailed setup instructions.

## Documentation

- [Master Specification](docs/00-master-spec.md) - System requirements and rules
- [API Specification](docs/01-api-spec.md) - Complete API documentation
- [Data Model](docs/02-data-model.md) - Database schema
- [State Machines](docs/03-state-machines.md) - State transitions

## Deployment

### Zero-Cost Deployment

This application can be deployed for **$0/month** using free tiers:

- **Backend**: [Render](https://render.com) (Free tier)
- **Frontend**: [Vercel](https://vercel.com) (Free tier)
- **Database**: [Supabase](https://supabase.com) (Free tier)
- **Redis**: [Upstash](https://upstash.com) (Free tier)
- **Healthcheck**: GitHub Actions (Free tier)

**See [DEPLOYMENT.md](DEPLOYMENT.md) for complete deployment guide.**

### Quick Deployment Steps

1. **Set up Supabase** - Create PostgreSQL database
2. **Set up Upstash** - Create Redis database
3. **Deploy to Render** - Backend API service
4. **Deploy to Vercel** - Frontend application
5. **Configure GitHub Actions** - Healthcheck pinger to keep Render awake

See [DEPLOYMENT.md](DEPLOYMENT.md) for detailed step-by-step instructions.

## Project Structure

```
.
├── backend/              # FastAPI backend application
│   ├── app/             # Application code
│   │   ├── api/         # API routes
│   │   ├── core/        # Configuration, database, security
│   │   ├── models/      # SQLAlchemy models
│   │   ├── schemas/     # Pydantic schemas
│   │   └── services/    # Business logic
│   ├── alembic/         # Database migrations
│   └── tests/           # Test files
├── frontend/            # React frontend application
│   ├── src/
│   │   ├── api/         # API client
│   │   ├── components/  # React components
│   │   ├── pages/       # Page components
│   │   └── store/       # State management
│   └── dist/            # Build output
├── docs/                # Documentation
└── DEPLOYMENT.md        # Deployment guide
```

## Features

- 🏫 Multi-tenant architecture with data isolation
- 👥 User management (Admins, Teachers, Parents)
- 📚 Student management (Admissions, classes, performance)
- 📊 Academic performance tracking
- 💰 Fee management and payment tracking
- 🔐 JWT-based authentication
- 📁 Document storage (optional S3/Supabase)
- 💬 Announcements and notice board

## Development

### Prerequisites

- Python 3.11+
- Node.js 18+
- PostgreSQL 15+
- Redis (optional, for background tasks)

### Running Locally

1. **Backend**: See [backend/README.md](backend/README.md)
2. **Frontend**: See [frontend/README.md](frontend/README.md)

### Testing

```bash
# Backend tests
cd backend
pytest

# Frontend tests (if configured)
cd frontend
npm test
```

## License

[Add your license here]

## Support

For deployment help, see [DEPLOYMENT.md](DEPLOYMENT.md).

For development questions, check the documentation in the `docs/` folder.

