# Drop and Give Me 50

A beautiful, installable web app for tracking one exercise: push-ups. Not a
generic fitness tracker — see [docs/prd.md](./docs/prd.md) for why that's a
deliberate choice, not a limitation.

- [docs/prd.md](./docs/prd.md) — product vision, philosophy, scope, health
  philosophy, rejected features
- [docs/architecture.md](./docs/architecture.md) — stack, schema, API
  boundaries, folder structure, roadmap, risks
- [docs/decisions.md](./docs/decisions.md) — decisions locked for the
  duration of the build, with rationale

## Status

**Phase 0 — Foundations.** The app currently boots to a placeholder page.
The logging screen, database schema, and auth arrive in Phase 1.

## Stack

Next.js (App Router) + TypeScript + React, tRPC, Drizzle ORM on Postgres
(Neon), Auth.js, deployed on Vercel. Full rationale in
[docs/architecture.md](./docs/architecture.md).

## Getting started

```bash
npm install
cp .env.example .env.local   # then fill in DATABASE_URL from a Neon project
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Start the Next.js dev server |
| `npm run build` | Production build |
| `npm run start` | Run the production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | Generate route types, then `tsc --noEmit` |
| `npm run test` | Run the unit test suite (Vitest) |
| `npm run db:generate` | Generate a SQL migration from `src/server/db/schema.ts` |
| `npm run db:migrate` | Apply generated migrations to `DATABASE_URL` |
| `npm run db:push` | Push the schema directly (fast local iteration only) |
| `npm run db:studio` | Open Drizzle Studio against `DATABASE_URL` |

## CI

`.github/workflows/ci.yml` runs typecheck, lint, unit tests, a production
build, and a migration-drift check (fails if the schema changed without a
committed, generated migration) on every push to `main` and every pull
request.
