# Seed Data

The seed script prepares the initial Practice Loop musical vocabulary:

- 5 tags
- 22 approved lead-sheet repertoire pieces
- 6 common jazz practice exercises
- piece-to-exercise links

Lead sheet asset rows are imported separately with:

```bash
npm run leadsheets:import
```

The seed script does not create fake lesson recordings, transcripts, or uploaded
audio. Those should come from real data later.

## Dry Run

This checks what would be seeded without touching a database:

```bash
npm run db:seed -- --dry-run
```

## Real Seed

After `DATABASE_URL` exists and migrations have been applied:

```bash
npm run db:migrate
npm run db:seed
```

The script uses stable generated UUIDs, so it can be run again. Existing seeded
pieces and exercises are updated rather than duplicated.

## Why Stable IDs?

The current mocked UI uses readable IDs such as `autumn-leaves`, while Postgres
uses UUIDs. The seed script converts those readable IDs into repeatable UUIDs so
relationships remain stable across machines and reruns.
