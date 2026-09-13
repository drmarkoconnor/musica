# Practice Loop

Private lesson-to-practice web app for Mark's jazz piano and singing practice.

## Lesson-first update — September 2026

The current direction is to accept a complete lesson recording and extract
useful, replayable learning points. Lessons, Learning points and Practice are
the primary views. The earlier activity dashboard and supporting tools remain
available through More.

Read [the implementation and rollout notes](docs/lesson-first-implementation.md)
before deploying this update. It includes an additive database migration; do
not point a deployment preview at the live database for testing.

The Mac's local `markoconnorai` directory can become an umbrella for independent
projects. The guarded [folder relocation helper](docs/mac-folder-relocation.md)
moves the whole existing checkout into `markoconnorai/musica`, preserving local
recordings, configuration and Git history. It must be run on the Mac; the remote
implementation does not move that folder.

## Original scaffold and supporting features

- Next.js App Router with TypeScript and Tailwind CSS
- Static mocked MVP screens:
  - Dashboard
  - Lessons
  - From Lessons
  - Repertoire and piece detail
  - Practice Session
  - Assets
  - Recordings
- English and Italian UI labels with localStorage language persistence
- Server-side transcription password gate at `POST /api/transcriptions`
- Optional whole-app private password gate with `PRACTICE_LOOP_APP_PASSWORD`
- Drizzle schema for a future Neon Postgres database
- Neon-backed read-only routes when `PRACTICE_LOOP_DATA_SOURCE=neon`
- Historical Supabase draft and seed data in `supabase/`

## Local Setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

Set `PRACTICE_LOOP_APP_PASSWORD` before using a hosted deployment for real
lesson conversations. Set `TRANSCRIPTION_PASSWORD` in `.env.local` for paid
transcription authorisation. Keep `OPENAI_API_KEY` server-side only.

The app defaults to mock data:

```bash
PRACTICE_LOOP_DATA_SOURCE=mock
```

## Useful Commands

```bash
npm run typecheck
npm run build
npm run db:generate
npm run db:seed -- --dry-run
```

## Database Direction

- `src/db/schema.ts` is the Drizzle-owned schema.
- `drizzle/` contains generated migration files.
- `src/lib/data/` contains the repository boundary so the app can use mock data
  now and Neon later.
- `docs/database/neon-setup.md` is the hand-holding checklist for the future
  Neon setup.
- `docs/database/seed-data.md` explains how the initial tune/exercise seed works.
- `docs/accounts.md` lists the external accounts we will need and when.
- `docs/testing-current-build.md` explains what is live and what is still a
  placeholder.
- `docs/leadsheets-plan.md` explains how the local lead sheet PDFs should be
  incorporated.
- `supabase/` is retained as the original SQL draft for reference.

The v1 schema intentionally avoids billing, public accounts, quotas, Stripe, and
premium feature gates.
