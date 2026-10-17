# HMS Backend

The current HMS application uses Supabase (Postgres, Auth, RLS, and database RPCs) as its backend. The React frontend is in `../frontend/`, and the schema and migrations are in `../supabase/`.

This folder is reserved for optional Python services. `main.py` is only a placeholder and is not part of the running HMS request path. Do not treat it as a production API or add duplicate business logic here without an explicit architecture change.
