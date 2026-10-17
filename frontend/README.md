# HMS Frontend

React 19, TypeScript, Vite, Tailwind CSS v4, React Router, TanStack Query, and Supabase JS.

## Setup

```bash
bun install
cp ../.env.example .env
bun run dev
```

Configure `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in `.env`. Use only the public publishable key in the browser; never expose a Supabase secret or service-role key.

## Checks

```bash
bun run build
bun run lint
```

Tailwind CSS v4 is integrated through `@tailwindcss/vite` in `vite.config.ts`; styles are loaded with `@import "tailwindcss";` in `src/styles/index.css`.
