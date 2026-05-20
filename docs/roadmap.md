# Practice Loop Roadmap

Last updated: 2026-05-20

## Roadmap Rule

Keep the app useful before making it clever. Prioritise real lesson/practice
flows, persistence, privacy, and clear audio links over elaborate automation.

## Phase 1: Static MVP UI

Status: complete.

- Core routes and navigation.
- Mock dashboard, lessons, practice list, repertoire, practice session, assets,
  archive, and recordings.
- English/Italian labels.
- Initial product types and schema thinking.

## Phase 2: Neon Foundation

Status: complete enough for active testing.

- Drizzle schema and migrations.
- Neon metadata persistence.
- Repository boundary with mock fallback.
- Seed/import support for repertoire, exercises, tags, and lead sheets.
- Existing unsupported transaction usage removed from runtime routes.

## Phase 3: Privacy And Deployment

Status: working v1.

- Whole-app password via `PRACTICE_LOOP_APP_PASSWORD`.
- Separate transcription password for paid AI actions.
- Netlify build/deploy path.
- Netlify Blobs for v1 object storage.
- Keep secrets out of git and client bundles.

Later:

- Consider Neon Auth only when named users, Leo access, or per-user ownership
  becomes necessary.

## Phase 4: Lesson Capture And Teaching Clip Review

Status: working, needs editor polish.

Done:

- Browser lesson recording.
- Lesson creation and recording metadata.
- Protected audio playback.
- Teaching segment creation and adjustment.
- Selected segment minute preview before transcription.
- Server-side ffmpeg clipping before transcription.
- Audio-first chapter rail for long lesson orientation.
- Created-clip review queue with title and note editing before transcription.

Next:

- Arbitrary audio upload.
- Better long-recording studio: split, merge, chunk creation, true waveform
  data, deeper zoom/focus editing, and clearer clip states.
- More nuanced start/end editing beyond the original 30 second pre-roll and 10
  second trim idea.

## Phase 5: Transcription, Lesson Memory, And Extraction

Status: working for selected clips.

Done:

- Passworded transcription through OpenAI.
- Hidden raw transcript.
- AI lesson summary.
- Candidate practice extraction.
- Keep/discard candidate items.
- Link kept items to source lesson audio.

Next:

- Per-segment returned cards for transcript, memory, and candidate items.
- Better distinction between lesson memory, context note, practice note, and
  actual exercise.
- Manual editing before saving candidate practice items.
- Journal/diary-style lesson memory view in v2.

## Phase 6: Practice List And Repertoire Management

Status: active, needs density and CRUD polish.

Done:

- Lesson-derived and manual practice tasks.
- Compact practice-list rows.
- Edit flow for practice-list items.
- Archive/restore/delete.
- Confidence, frequency, and last-practised fields.
- Repertoire rows link to piece pages.
- Lead sheets attached to pieces.
- Practice session builder can pick existing practice-list items.

Next:

- Denser scalable list design for hundreds of practice items.
- Richer edit flows for tags/categories and source links.
- Category/tag filtering.
- Inline status/confidence/frequency controls where appropriate.
- More direct relation between practice tasks, repertoire, exercises, and logs.
- Keep repertoire sorted primarily by last practised, with inline status,
  confidence, and tempo affordances that do not crowd the row.

## Phase 7: Live Practice Sessions

Status: functional first pass.

Done:

- Build session from suggestions plus manual choices.
- Start live session.
- Active item timer with pause.
- 5-minute continue ping.
- Done/skip today.
- Clear `Done and log time` / `Not today` language.
- Optional confidence and notes.
- Add/delete items during a live session.
- Clickable/selectable session rows with ordered next-item advancement.
- Planned-duration labels removed from the visible session UI.
- Attach short practice recordings to the active session item.
- Quartet accompaniment area removed.

Next:

- Add Mark's 12-keys reminder graphic/card for major and the minor scale
  systems when ready.
- Session review/history page.
- Clear log records for what was actually practised and for how long.
- Better support for changing plans mid-session without losing intent.
- Recordings/note-to-self management per item.
- Optional confidence update prompts at the right moment.

### Practice Logging Model

The current implementation writes actual elapsed seconds to `session_items` when
an item is marked done. That is enough for a first-pass log, but the product
needs a clearer activity surface:

- Completed items count as practised and update linked piece, exercise, or
  practice-task last-practised metadata.
- Skipped items record intent/refusal but should not count as practised.
- One-off typed items should either become reusable manual practice tasks or be
  explicitly labelled as session-only.
- Practice recordings attach to the active `session_item` and should surface
  from the linked piece/task where available.
- The dashboard has first-pass totals from completed session items.
- A later dashboard should aggregate more deeply by day, piece, exercise,
  practice task, and source.

## Phase 8: Smart Resurfacing

Status: simple first pass.

Current smart queue uses lesson tasks, repertoire, exercises, confidence, and
recency.

Next:

- Weight target frequency, confidence, source, importance, skips/refusals, and
  last practised more carefully.
- Keep suggestions flexible and non-judgemental.
- Treat "skip today" as a real signal without punishing the user.

## Phase 9: Storage And V2 Foundations

Status: later.

- Decide whether Netlify Blobs remains sufficient.
- Likely durable move: Cloudflare R2 or S3-compatible private storage.
- Named auth and user ownership.
- More formal transcript usage ledger if transcription becomes commercial.
- Possible paid transcription bundles in v2, not v1.
- Journal/diary-style lesson memories that can be read, annotated, and searched
  independently from practice tasks.
- Periodic executive summaries from activity data, probably generated manually
  every few months behind an explicit paid-AI confirmation.

## Testing Triage From 2026-05-20

### Immediate Bugs Or Unfinished Controls

- Addressed in the current branch: `/from-lessons` edit, ordered session
  advancement, selectable session rows, and recording delete/link controls.

### UX Language And Clarity

- `Skip today` means "do not practise/log this item today; keep it for future
  resurfacing." Rename or add inline copy so it is not read as completion.
- `Done` should read like "Done and log time" in the live session, because it
  writes elapsed seconds and updates last-practised metadata.
- The standalone tick in the practice list is different: it means "mark
  practised today" without a timed live-session record.
- Planned minutes currently create the wrong mental model. Hide them from
  session cards and suggestions.
- The star/spine-tune control needs clearer spacing and meaning. It is intended
  to persist `is_spine_tune`, not a decorative rating.

### Music-Practice Helpers

- Deferred for Mark's separate graphic work: add a 12-keys reference card for
  major diatonic seventh chords:
  Imaj7, ii-7, iii-7, IVmaj7, V7, vi-7, vii half-diminished.
- Add matching cards for natural minor, harmonic minor, and melodic minor, then
  show them when the active item is the relevant scales/keys exercise.
- The card should be a reminder during practice, not another large editor.

### Data And Reporting

- Implemented first pass: use completed `session_items` as the activity log.
- Later consider a dedicated activity/event table only if session items become
  too overloaded.
- Build dashboard totals by date, piece, exercise, task, actual time, skips,
  confidence changes, and linked recordings.
- Add an explicit "monthly/quarterly reflection" route for AI summaries over
  aggregated activity, gated by confirmation so it does not spend money
  silently.

## Immediate Next Best Steps

1. Test the new practice-list edit flow.
2. Test building a session from existing practice-list items plus one-off
   session items.
3. Test ordered advancement, row selection, `Done and log time`, and `Not
   today`.
4. Test recording delete and practice-recording piece linking.
5. Test the dashboard activity log after completing a timed item.
6. Add Mark's 12-keys reference graphic/card when supplied.
7. Continue richer session history and dashboard drill-downs.
