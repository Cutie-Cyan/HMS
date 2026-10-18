# HMS Python Backend

The HMS backend is built with **Python + FastAPI**. It provides the server-side API layer; the React frontend remains in `../frontend/`, and Supabase Postgres remains the database.

## Setup

From this directory:

```bash
uv sync --extra dev
uv run uvicorn app.main:app --reload
```

API docs: `http://127.0.0.1:8000/docs`

## Environment

Create `.env` in `backend/` (never commit real secrets):

```env
HMS_ENV=development
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_server_only_service_role_key
```

The service-role key must only be used by the backend and must never be exposed to the browser. The health endpoint does not require Supabase credentials.

## Current API

- `GET /api/health` — process health and runtime metadata.
- `GET /docs` — interactive OpenAPI documentation in development.

## Architecture notes

The frontend currently contains existing Supabase client workflows. Those workflows are not silently replaced by this scaffold: each feature should be migrated to FastAPI deliberately, preserving role checks, database policies, and audit logging. Do not disable Supabase RLS or trust a role sent by the browser.
