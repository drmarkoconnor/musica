# Neon Setup Guide

Not needed yet. This guide is here for when Mark is ready to connect the app to
a real database.

## What We Will Do Together

1. Create a Neon account. Done.
2. Create one Postgres project. Done.
3. Copy the connection string. Done.
4. Add it to `.env.local`. Done.
5. Run the Drizzle migration. Done.
6. Seed the initial pieces and exercises. Done.
7. Confirm the app can read from the database. Done.

## Local Environment Shape

The app can stay on mock data:

```bash
PRACTICE_LOOP_DATA_SOURCE=mock
```

When we are ready to use Neon:

```bash
PRACTICE_LOOP_DATA_SOURCE=neon
DATABASE_URL=postgres://user:password@host/database?sslmode=require
```

Keep `DATABASE_URL` private. It belongs in `.env.local`, never in client code
and never committed to git.

Because the first database URL was pasted into chat during setup, rotate the Neon
database password after the first wiring pass is confirmed.

## Commands

Generate a migration from the Drizzle TypeScript schema:

```bash
npm run db:generate
```

Apply migrations to the configured Neon database:

```bash
npm run db:migrate
```

Seed the initial tags, spine tunes, exercises, and piece-exercise links:

```bash
npm run db:seed
```

Open Drizzle Studio after the database exists:

```bash
npm run db:studio
```

## What Data Is Needed?

None for initial setup. We can create the schema first, then run the seed script
from the existing mock tune and exercise list.

Real recordings and lead sheets come later because they belong in object storage,
not directly in Postgres.

## Provider Roles

- Neon: Postgres metadata such as pieces, lessons, practice tasks, sessions,
  timestamps, and tags.
- Cloudflare R2 or another object store later: audio recordings and lead sheets.

This keeps the database small and makes the file-storage decision independent.
