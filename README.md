# Hospital Management System (HMS)

HMS is a role-based hospital workflow application with a React frontend, a Python FastAPI backend, and Supabase Postgres/Auth.

## Requirements

- Bun for the frontend
- Python 3.12+ and [uv](https://docs.astral.sh/uv/) for the backend
- A Supabase project configured with the migrations in `supabase/migrations/`

## Backend (Python + FastAPI)

```bash
cd backend
uv sync --extra dev
uv run uvicorn app.main:app --reload
```

Open `http://127.0.0.1:8000/docs` for the API docs and `http://127.0.0.1:8000/api/health` for the health check. Copy `backend/.env.example` to `backend/.env` and configure server-only Supabase credentials when adding database-backed endpoints.

## Frontend

```bash
cd frontend
bun install
cp ../.env.example .env
bun run dev
```

Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in `frontend/.env`. Never expose a Supabase service-role key in frontend variables.

## Database

Review `supabase/README.md` and apply migrations in order to the intended Supabase project. Preserve row-level security and role-based access controls.

## Project layout

- `frontend/` — React, TypeScript, Vite, Tailwind CSS
- `backend/` — Python FastAPI API, tests, and server configuration
- `supabase/` — database migrations and Supabase configuration
