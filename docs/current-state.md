# Practice Loop Current State

Last updated: 2026-05-20

Latest implementation commit: `1574052 Tighten practice sessions and recording management`

## Working Environment

- Local app: `http://localhost:3001`
- Phone/iPad microphone testing may need HTTPS:
  `npm run dev:https`, then open `https://<mac-ip>:3443/lessons`
- Data source: Neon when `PRACTICE_LOOP_DATA_SOURCE=neon`
- Local secrets: `.env.local`
- Hosted secrets: Netlify environment variables
- Current object storage on hosted app: Netlify Blobs

Important hosted env vars:

- `PRACTICE_LOOP_APP_PASSWORD`
- `PRACTICE_LOOP_SESSION_SECRET` optional
- `TRANSCRIPTION_PASSWORD`
- `OPENAI_API_KEY`
- `DATABASE_URL`
- `NETLIFY_BLOBS_TOKEN` optional fallback
- `PRACTICE_LOOP_AUDIO_STORAGE=netlify-blobs` optional local override
- `PRACTICE_LOOP_ASSET_STORAGE=netlify-blobs` optional local override

## Live Now

- Whole-app private password gate.
- English/Italian UI toggle.
- Neon-backed repertoire, lessons, practice tasks, sessions, lead sheets, and
  recordings.
- Create, edit, archive, restore, and delete repertoire pieces.
- Import/upload lead sheets through `/assets/leadsheets`.
- Lead-sheet PDFs/images stored in Netlify Blobs on hosted app, with metadata in
  `piece_assets`.
- Create lessons and record live lesson audio in browser.
- Starting a live lesson recording clears the previous lesson context and saves a
  fresh timestamped lesson when stopped.
- Play lesson recordings through protected server routes.
- Mark useful lesson clips before transcription.
- Lesson clip review now has an audio-first chapter rail and created-clip review
  queue, so saved clip titles and notes can be edited before transcription.
- Segment transcription sends selected clips by default.
- Full-recording transcription requires explicit confirmation if no segments are
  selected.
- Password-gated transcription route calls OpenAI, saves transcript, writes
  lesson summary, and inserts candidate lesson extracts.
- Raw transcript is collapsed by default.
- Lesson summary is shown as compact bullet-style review.
- Candidate practice items can be kept or discarded.
- Kept candidates become lesson-sourced practice tasks.
- `/from-lessons` is the active practice-list area.
- Practice tasks support manual creation, compact management, archive/restore,
  delete, confidence, frequency, and last-practised metadata.
- Practice session can be built from smart suggestions, existing practice-list
  items, or clearly labelled session-only items.
- A live session presents one active item, logs active elapsed time, supports
  pause, `Done and log time`, `Not today`, optional confidence, and notes.
- Live practice rows are clickable/selectable, and completion advances by the
  user's list order.
- Session item updates no longer use unsupported Neon HTTP transactions.
- Practice passages can be recorded during a live practice session and are saved
  against the active `session_item`.
- Practice passage audio can be replayed from the practice item, Recordings, and
  linked repertoire page.
- Basic metronome and 5-minute continue ping exist.
- The Quartet accompaniment panel has been removed from the live practice UI.
- Recordings can be deleted; practice recordings can be linked to repertoire
  pieces from `/recordings`.
- The dashboard has a first-pass activity log from completed `session_items`.

## Latest Database Shape

Latest migration: `drizzle/0005_sturdy_sabra.sql`

This adds `recordings.session_item_id` so practice passage recordings can attach
to the exact item being practised, not only the overall session or piece.

## Important Files

- App shell and navigation: `src/components/app-shell.tsx`
- Language dictionary: `src/lib/translations.ts`
- Database schema: `src/db/schema.ts`
- Neon read model: `src/lib/data/neon-repository.ts`
- Lesson screen: `src/app/lessons/lessons-screen.tsx`
- Lesson recorder: `src/components/lesson-recorder.tsx`
- Lesson segment editor: `src/components/lesson-segment-review.tsx`
- Audio player: `src/components/audio-strip.tsx`
- Transcription API: `src/app/api/transcriptions/route.ts`
- Lesson audio storage: `src/lib/server/lesson-audio-storage.ts`
- Practice screen: `src/app/practice/practice-screen.tsx`
- Practice session APIs: `src/app/api/practice-sessions/*`
- Session item API: `src/app/api/session-items/[itemId]/route.ts`
- Practice recording upload/file APIs: `src/app/api/practice-recordings/*`
- Practice recording edit/delete API:
  `src/app/api/practice-recordings/[recordingId]/route.ts`
- Lesson recording delete API:
  `src/app/api/lesson-recordings/[recordingId]/route.ts`
- Practice audio storage: `src/lib/server/practice-audio-storage.ts`
- Lead sheet upload: `src/app/api/piece-assets/upload/route.ts`
- Lead sheet file route: `src/app/api/piece-assets/[assetId]/file/route.ts`

## Commands Recently Verified

```bash
npm run typecheck
npm run build
npm run db:migrate
git diff --check
```

## Known Gaps

- Arbitrary lesson audio upload still has placeholder UI.
- Long lesson recording still uploads a browser blob on stop; robust hour-long
  capture should eventually move toward chunked or resilient background storage.
- Lesson segment editor has a first-pass chapter rail and review queue, but
  still needs split, merge, true waveform data, and deeper zoom/focus editing.
- AI-generated practice candidates may still need manual narrowing inside a
  clip.
- Practice sessions now run and log active time to `session_items`, and the
  dashboard shows first-pass totals. A richer session review/history view is
  still needed.
- Practice passage recordings can be saved, replayed, deleted, and linked to a
  piece, but not yet renamed inline or transcribed.
- Repertoire add/edit supports current and target tempo in the modal. Row
  affordances have been widened, but the repertoire list still needs broader
  density and metadata polish.
- The 12-keys reference card is intentionally deferred while Mark prepares a
  separate graphic.
- Smart queue is useful but still simple; later it should weight frequency,
  confidence, recency, source, and user refusal/skips more carefully.
- Whole-app password is appropriate for private v1. Named users and sharing
  with Leo will need proper auth and ownership rules later.

## Current Testing Priorities

Current feedback to test next:

1. Edit a practice-list item and confirm title, notes, confidence, importance,
   piece link, and frequency persist.
2. Build a practice session from an existing practice-list item.
3. Add a one-off session item and confirm it is clearly session-only.
4. Start a live session, click rows to switch active items, mark one item `Done
   and log time`, and confirm the next item advances in order.
5. Use `Not today` and confirm it does not update last-practised metadata.
6. Confirm no planned-duration labels are visible in the session builder.
7. Confirm the Quartet area is gone.
8. Delete a lesson/practice recording from `/recordings`.
9. Link a practice recording to a repertoire piece and confirm it appears on the
   piece page.
10. Check the dashboard activity log after completing timed practice items.
11. Later, add Mark's 12-keys graphic/reference card.

## Current Git Notes

At the time of this update, `uiscrubber` contains approved lesson segment UI
work committed as `d789206` and ready to fast-forward `main`.

Approved work in this branch:

- Canonical project memory docs.
- Audio-first clip rail and created-clip review queue.
- UI design board files:
  - `docs/uiscrubber-designs.html`
  - `public/uiscrubber-designs.html`

Local `tmux-*.log` files are not project files and are ignored.
