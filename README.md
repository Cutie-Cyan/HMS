# Hospital Management System (HMS)

HMS is a role-based hospital workflow application. The React application lives in `frontend/`; Supabase migrations and database documentation live in `supabase/`. The `backend/` directory is reserved for optional Python services and is not currently the application API.

## Requirements

- Bun
- Node.js version supported by the installed Vite version
- A Supabase project with the migrations in `supabase/migrations/` applied

## Frontend setup

```bash
cd frontend
bun install
cp ../.env.example .env
bun run dev
```

Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in `frontend/.env`. Use only the public publishable key in browser code; never put a Supabase secret or service-role key in frontend environment variables.

## Verification

From `frontend/`:

```bash
bun run build
bun run lint
```

GitHub Actions runs the frontend build and lint checks from `frontend/` using Bun.

## Database

Review `supabase/README.md` and apply migrations in order to the intended Supabase project. Do not seed fake patient, staff, doctor, bed, or inventory records in production. Only the canonical ward configuration should be seeded.

## Project layout

- `frontend/` — React, TypeScript, Vite, Tailwind CSS v4
- `backend/` — reserved for future Python services; not required to run the current HMS app
- `supabase/` — schema, migrations, and database setup notes
