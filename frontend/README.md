# HMS Frontend

React 19, TypeScript, Vite, Tailwind CSS v4, React Router, TanStack Query, and Supabase JS.

## Setup

```bash
npm install
cp ../.env.example .env
npm run dev
```

Configure `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `.env`. Use only the public anon/publishable key in the browser; never expose the service-role key.

## Checks

```bash
npm run build
npm run lint
```

Tailwind CSS v4 is integrated through `@tailwindcss/vite` in `vite.config.ts`; styles are loaded with `@import "tailwindcss";` in `src/styles/index.css`.
