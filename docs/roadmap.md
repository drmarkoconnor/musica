# Practice Loop Roadmap

This roadmap keeps the app progressive and private. The app should become useful
before it becomes clever.

## Phase 1: Static MVP UI

Status: complete enough for now.

- Core routes and navigation
- Mocked dashboard, lessons, from-lessons, repertoire, practice, assets, recordings
- English and Italian UI labels
- Password-gated transcription entrypoint
- Initial product schema thinking

## Phase 2: Database Foundation

Status: connected for read-only screens.

- Use Drizzle as the TypeScript-owned schema layer
- Target Neon Postgres first
- Keep mock fallback data for areas that do not have real records yet
- Add a provider-neutral repository boundary
- Generate migrations locally
- Seed initial tags, spine tunes, exercises, and tune-exercise links
- Render read-only routes through the repository layer
- Defer audio and lead-sheet storage until the file workflow phase

No real recordings or lead sheets are needed for this phase.

## Phase 3: Real Practice Sessions

- Save practice sessions
- Accept, skip, replace, and add queue items
- Track tempo, notes, confidence, and overrides
- Start with a simple smart queue before making it more intelligent

Real data helpful later:

- A real current spine-tune list
- A few actual practice priorities

## Phase 4: Lesson Recording and Upload

- Create lessons
- Upload or record lesson audio
- Store recording metadata
- Play lesson recordings from object storage
- Add cost-aware teaching segment markers with 30 second pre-roll and 10 second
  end trim defaults
- Let those defaults become adjustable and support post-lesson segment review,
  trimming, splitting, and merging
- Show selected minutes before transcription

Real data needed here:

- One short test lesson recording
- One short practice recording

## Phase 5: Password-Protected Transcription and Extraction

- Keep transcription behind the server-side password gate
- Send audio to transcription only after authorisation
- Send selected teaching segments before ever trying a full one-hour lesson
- Save transcripts
- Show transcripts as a concise executive summary with bullet-level clip
  playback
- Extract candidate practice items
- Let Mark keep, discard, and edit extracted items
- Let Mark manually turn a useful point of interest into a practice note linked
  to the exact source audio segment

Real data needed here:

- A short real lesson clip for transcription testing
- Later, one full lesson recording when the cost guardrails feel solid

## Phase 6: Assets and Recording Polish

- Upload lead sheets and annotated versions
- Attach assets to pieces
- Attach practice recordings and spoken notes to pieces, sessions, exercises, or lesson items

Real data needed here:

- One or two lead sheet PDFs or images
- One annotated version if available

## Phase 7: Smart Resurfacing

- Use last-practised date
- Use confidence
- Weight lesson-derived tasks
- Rotate spine tunes
- Resurface overdue exercises
- Keep nudges gentle and non-judgemental

Real data helpful here:

- A realistic practice history over a few weeks
- Mark's sense of which tunes are currently over-practised or neglected
