# Wordroom — Oxford 3000

An Arabic-friendly vocabulary learning desk for studying the Oxford 3000 through daily sets and milestone reviews.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/oxford-3000/src/App.tsx` — primary vocabulary UI, bilingual copy, study sessions, daily map, and Review milestone flow
- `artifacts/oxford-3000/src/index.css` — shared warm editorial theme and dark-mode tokens
- `lib/api-spec/openapi.yaml` — source of truth for synced learning progress
- `lib/db/src/schema/userProgress.ts` — persisted user progress schema
- `artifacts/api-server/src/routes/progress.ts` — authenticated progress sync

## Architecture decisions

- Review completion is persisted as a keyed milestone map so the 3-day/6-day rhythm repeats across the full vocabulary journey.
- The six-day checkpoint supersedes the three-day checkpoint at each six-day boundary, avoiding two mandatory reviews for the same stopping point.
- Guest progress is stored locally and merged into the signed-in progress record when a user authenticates.

## Product

- Study the Oxford 3000 one word at a time with pronunciation, examples, editing, and spaced review prompts.
- Browse and filter the full library by search, CEFR level, and part of speech.
- Progress through twelve-word daily sets; every three or six completed days unlocks a randomized milestone review before the next set opens.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

_Populate as you build — sharp edges, "always run X before Y" rules._

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
