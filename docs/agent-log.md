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

## 2026-05-21 - Chart Aide Memoir Overlay

Branch: `practice-session-repertoire-roadmap`

Commit: not committed yet.

Work done:

- Added `public/reference/chart-aide-memoir.png` from Mark's generated image.
- Added a `Chart aide memoir` checkbox beside the practice session start/finish
  controls.
- When the checkbox is active and a live practice session starts, the chart
  opens as a full-screen overlay.
- Added a small top-right close button and Escape-key close handling.

Commands run:

```bash
npm run typecheck
npm run build
git diff --check
```

Migration status: no database migration.

What to test:

- Add at least one practice item, tick `Chart aide memoir`, and start the
  session.
- Confirm the chart fills the screen and closes with the top-right X.
- Confirm leaving the checkbox unticked starts the session without the overlay.

## 2026-05-20 - Remove Duplicate Spine Status UI

Branch: `practice-session-repertoire-roadmap`

Commit: not committed yet.

Work done:

- Removed `spine` from the visible repertoire status dropdown.
- Kept the star toggle as the single visible spine/core tune flag.
- Mapped legacy `status = spine` rows to `maintenance` in UI labels and status
  dropdowns so old data does not preserve the duplicate affordance.

Commands run:

```bash
npm run typecheck
npm run build
```

Migration status: no database migration.

What to test:

- Open `/repertoire` and confirm the status dropdown only shows learning,
  maintenance, and parked.
- Toggle the star/spine control and confirm that is the only visible spine/core
  tune control.

## 2026-05-20 - Practice Session, Recording, And Activity Fixes

Branch: `practice-session-repertoire-roadmap`

Commit: `1574052 Tighten practice sessions and recording management`

Work done:

- Enabled editing for practice-list items in `/from-lessons`.
- Expanded the practice-task PATCH route so title, notes, linked piece,
  confidence, importance, frequency, and status can be saved.
- Reworked `/practice` so sessions can be built from existing practice-list
  items plus clearly labelled one-off session items.
- Removed visible planned-duration controls from practice sessions and smart
  suggestions.
- Renamed the live action to `Done and log time`, added `Not today`, and added
  inline copy explaining that skipped items do not count as practised.
- Made session rows clickable/selectable and fixed ordered advancement after a
  completed item.
- Removed the Quartet accompaniment panel.
- Added delete routes for lesson recordings and practice recordings.
- Added piece-linking and delete controls to `/recordings`.
- Added a first-pass dashboard activity log from completed `session_items`.
- Widened the repertoire spine-tune/star control and clarified that it is a
  persistent spine-tune flag.
- Deferred the 12-keys reference card because Mark will prepare the graphic
  separately.

Commands run:

```bash
npm run typecheck
npm run build
git diff --check
```

Migration status: no database migration.

What to test:

1. Edit a practice-list item and refresh.
2. Build a practice session from an existing practice-list item and a one-off
   item.
3. Start a session, switch rows, mark one item done, and confirm ordered
   advancement.
4. Use `Not today` and confirm the item is not marked practised.
5. Delete/link recordings from `/recordings`.
6. Complete a timed item and check the dashboard activity log.

## 2026-05-20 - Practice Session And Repertoire Testing Triage

Branch: `practice-session-repertoire-roadmap`

Commit: not committed yet.

Work done:

- Reviewed current practice session, practice-list, repertoire, recordings, and
  session-item API implementation against Mark's testing notes.
- Confirmed `/from-lessons` edit is currently disabled.
- Confirmed live session `Done` writes elapsed seconds to `session_items` and
  updates linked task/piece/exercise metadata only for `done`, while `skipped`
  saves the item state without marking it practised.
- Confirmed the practice session next-item helper needs list-order sequencing.
- Confirmed planned minutes are exposed throughout the practice session UI even
  though actual elapsed time is the useful practice log.
- Confirmed repertoire already has current/target tempo fields in the modal, but
  row affordances need clearer spacing and copy.
- Confirmed recordings list has playback but not delete/link/edit management.
- Updated `docs/current-state.md` and `docs/roadmap.md` with the stratified
  roadmap.

Commands run:

```bash
git status -sb
git log --oneline -5
sed -n ... docs/current-state.md docs/roadmap.md docs/agent-log.md
sed -n ... src/app/practice/practice-screen.tsx
sed -n ... src/app/from-lessons/from-lessons-screen.tsx
sed -n ... src/app/repertoire/repertoire-screen.tsx
sed -n ... src/app/recordings/recordings-screen.tsx
sed -n ... src/app/api/session-items/[itemId]/route.ts
sed -n ... src/app/api/practice-tasks/[taskId]/route.ts
sed -n ... src/app/api/practice-sessions/route.ts
```

Migration status: no database migration.

Recommended next implementation:

1. Practice-list edit and session builder picker.
2. Live-session sequencing and active-row selection.
3. Remove planned-duration UI and Quartet area.
4. Add 12-keys reference cards.
5. Repertoire and recordings management polish.
6. Activity log/dashboard.

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
