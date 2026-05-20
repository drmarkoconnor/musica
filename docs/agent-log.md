# Practice Loop Agent Log

This file is the running handoff log for Codex sessions.

## How To Maintain This Log

At the end of a meaningful work session, and always after a build and push, add
a short newest-first entry with:

- date
- branch
- commit hash if committed or pushed
- commands run
- files or areas changed
- migration status if relevant
- what to test next
- known caveats

Keep entries concise. Put stable product truth in `project-brief.md`, current
implementation truth in `current-state.md`, and priority sequencing in
`roadmap.md`.

## 2026-05-20 - Audio-First Clip Rail And Review Queue

Branch: `uiscrubber`

Commit: `d789206 Add lesson clip review queue and project memory docs`

Work done:

- Wired the lesson segment chooser to an audio-first chapter rail instead of a
  transcript-first chooser.
- Added a created-clip review queue for saved lesson segments.
- Added title and note editing for created clips before transcription.
- Updated the lesson-segment PATCH route so metadata-only edits preserve the
  current segment status.
- Updated the UI design board, current-state notes, and roadmap to reflect the
  Option 3 + Option 5 direction.

Commands run:

```bash
npm run typecheck
npm run build
git diff --check
```

Migration status: no database migration.

What to test:

- Create a lesson clip on `/lessons`.
- Confirm the clip appears on the lesson map rail and in the review queue.
- Rename the clip title, optionally edit notes, save, and refresh.
- Confirm discard/restore still works and title-only edits do not change status.

## 2026-05-20 - Documentation Memory Setup

Branch: `uiscrubber`

Starting point:

- `uiscrubber`, `main`, and `origin/main` pointed at
  `249929d Attach practice recordings to session items`.
- Existing untracked files were present before this work:
  `docs/uiscrubber-designs.html` and `public/`.

Work done:

- Created `docs/project-brief.md`.
- Created `docs/current-state.md`.
- Replaced `docs/roadmap.md` with a current consolidated roadmap.
- Created this `docs/agent-log.md`.
- Created local Codex skill:
  `/Users/moc/.codex/skills/practice-loop-session-memory/SKILL.md`.

Commands run:

```bash
git status -sb
find docs -maxdepth 2 -type f | sort
git log --oneline --decorate -8
```

No app build was needed for documentation-only work.

Next:

- Future sessions should read the four canonical docs first.
- After each build/push, update `current-state.md` and this log.

## 2026-05-20 - Practice Passage Recording

Commit: `249929d Attach practice recordings to session items`

Work done:

- Added `recordings.session_item_id`.
- Added migration `drizzle/0005_sturdy_sabra.sql`.
- Added practice recording upload and file routes.
- Added practice audio storage helper.
- Added live practice passage recorder to `/practice`.
- Practice recordings now attach to the active session item and can play back
  from Practice, Recordings, and linked repertoire pages.

Commands run:

```bash
npm run typecheck
npm run build
npm run db:migrate
git diff --check
git push origin main
```

What to test:

- Start a practice session.
- Record a short passage on an active item.
- Stop/save.
- Play it back under that item.
- Confirm it appears in Recordings and on the linked piece page if applicable.

## 2026-05-20 - Neon Transaction Fix

Commit: `bfb1796 Remove unsupported Neon transactions`

Problem:

- Delete/save flows failed because `drizzle-orm/neon-http` does not support
  `db.transaction(...)`.

Work done:

- Removed transaction use from practice task delete.
- Removed transaction use from practice session creation.
- Removed transaction use from session item update.
- Added explicit sequential writes and cleanup where needed.

Commands run:

```bash
npm run typecheck
npm run build
git diff --check
git push origin main
```

## 2026-05-19 - Practice List, Lead Sheets, Auth, And Sessions

Highlights:

- Whole-app password gate added with `PRACTICE_LOOP_APP_PASSWORD`.
- Lead sheet upload/import flow added for `/assets/leadsheets`.
- Lead sheets stored in Netlify Blobs on hosted app and linked through
  `piece_assets`.
- Manual practice tasks promoted to tracked items with confidence, frequency,
  and last-practised metadata.
- Practice session model moved toward user-built sessions with suggestions,
  manual additions, active item timer, done/skip, notes, and optional
  confidence.

Important caveat:

- The practice session model is intentionally flexible; it should log what Mark
  actually practised, not merely enforce a pre-planned queue.

## 2026-05-18 - Lesson Recording, Segment Selection, And Transcription

Highlights:

- Browser lesson recording from `/lessons`.
- Fresh timestamped lesson creation on stop/save.
- Netlify Blobs bridge for hosted lesson audio.
- Teaching segment selection before paid transcription.
- Server-side clipping before OpenAI transcription.
- Transcription password gate.
- Lesson summary and extracted candidate practice items.
- Raw transcript collapsed by default.
- Candidate keep/discard into lesson-derived practice tasks.

Important product decision:

- The useful review object is a lesson memory with audio recall, not an
  automatic homework command.
