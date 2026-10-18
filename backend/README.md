# HMS Python Backend

The HMS API uses Python and FastAPI, with Supabase Auth and Postgres.

## Setup

From this directory:

```bash
uv sync --extra dev
cp .env.example .env
uv run uvicorn app.main:app --reload
```

Open `http://127.0.0.1:8000/docs` for interactive API docs.

Configure `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` in `.env`. Never commit secrets or expose the service-role key to the frontend.

## Implemented routes

- `GET /api/health` — health check.
- `POST /api/admin/staff/invite` — administrator-only staff creation, profile insertion, optional ward assignment, and audit logging.

The frontend must set `VITE_HMS_API_URL=http://127.0.0.1:8000` locally. Existing Supabase workflows are migrated incrementally; do not disable RLS or trust roles sent by the browser.
