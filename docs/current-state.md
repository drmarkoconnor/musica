# Practice Loop Current State

Last updated: 2026-05-20

Current commit: `d789206 Add lesson clip review queue and project memory docs`

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
- Practice session can be built from smart suggestions plus manual items.
- A live session presents one active item, logs active elapsed time, supports
  pause, skip today, done, optional confidence, and notes.
- Session item updates no longer use unsupported Neon HTTP transactions.
- Practice passages can be recorded during a live practice session and are saved
  against the active `session_item`.
- Practice passage audio can be replayed from the practice item, Recordings, and
  linked repertoire page.
- Basic metronome and 5-minute continue ping exist.
- Quartet app is linked as an external accompaniment resource.

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
- Practice sessions now run and log active time, but the post-session history
  and review view is still thin.
- Practice passage recordings can be saved and replayed, but not yet edited,
  renamed, deleted, or transcribed.
- Smart queue is useful but still simple; later it should weight frequency,
  confidence, recency, source, and user refusal/skips more carefully.
- Whole-app password is appropriate for private v1. Named users and sharing
  with Leo will need proper auth and ownership rules later.

## Current Testing Priorities

After the next Netlify deploy:

1. Start a practice session.
2. Select an active item.
3. Record a short practice passage.
4. Stop/save and confirm it appears under the current item.
5. Play it back under the item.
6. Confirm it appears in `/recordings`.
7. If linked to a repertoire piece, confirm it appears on that piece page.
8. Mark the item done and confirm time/confidence/last-practised metadata save.
9. Delete/archive a manual practice task and confirm no Neon transaction error.

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
