# Practice Loop Roadmap

Last updated: 2026-05-25

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
- Browser lesson recording now keeps a local IndexedDB rescue draft while
  recording, saves small clips through the simpler direct upload path, uses
  chunked upload sessions for larger recordings or fallback saves, and
  retries/downloads/discards unsaved drafts after failed saves.
- Mobile recording save waits are bounded so iPad/WebKit browsers should fail
  recoverably instead of hanging indefinitely on `Saving recording`.
- Live recording now starts before IndexedDB rescue setup finishes, avoiding a
  mobile start-up stall on slow browser storage APIs.
- The lesson screen has a mobile/native `Record with device` capture-file path,
  with iOS-style audio MIME types accepted by the upload route.
- Browser lesson recording has a default-on `Save a device copy` option where
  supported, so a user-granted local audio file is written while recording.
- Lesson audio upload has a first-pass real file picker backed by the lesson
  recording upload route.
- Recording entry controls now distinguish desktop upload from the phone/iPad
  capture fallback, and unsupported local-file writing is hidden instead of
  shown as an unavailable checkbox.
- Normal lesson UI no longer exposes the development test-audio attachment, and
  fixture APIs are blocked in production even if the old request path is called.
- Lesson creation and recording metadata.
- Lesson screen opens on start/record controls and history rather than
  auto-loading a previous summary.
- Empty lesson shells can be deleted after their recordings have been removed.
- Protected audio playback.
- Teaching segment creation and adjustment.
- Selected segment minute preview before transcription.
- Server-side ffmpeg clipping before transcription.
- Audio-first scrubber for long lesson orientation.
- Created-clip review queue with title and note editing before transcription.
- Chosen-clip map that visualizes only user-created clips with status and
  metadata, rather than artificial pre-analysis lesson regions.
- Visual mockups for the next saved-clip presentation pass:
  `public/lesson-clip-choice-mockups.html`.
- Private archive dry-run importer for `lessonrecordings/`, with exact duplicate
  detection and no transcription side effects.
- Initial private archive import: 31 non-duplicate recordings uploaded to
  Netlify Blobs and linked into Neon lesson metadata, with 4 exact duplicates
  skipped.

Next:

- Review imported archive lessons in the app, create useful teaching clips, and
  transcribe selected clips only.
- Better long-recording studio: split, merge, chunk creation, true waveform
  data, deeper zoom/focus editing, and clearer clip states.
- Consider multipart/object-compose storage later if final server assembly ever
  becomes too memory-heavy for very long recordings.
- More nuanced start/end editing beyond the original 30 second pre-roll and 10
  second trim idea.

## Phase 5: Transcription, Lesson Memory, And Extraction

Status: working for selected clips, with background queue/progress.

Done:

- Passworded transcription through OpenAI.
- Durable transcription jobs and chunk rows in Neon.
- Netlify background function for long-running transcription work.
- 3-minute transcription chunks for selected clips and rare full-lesson retries.
- Progress polling in the transcription modal.
- Failed chunk/job state can be retried without redoing completed chunks when
  the selected clip set is unchanged.
- Stale `running` jobs can be restarted instead of blocking future retries, and
  status polling can surface a restartable stalled-run failure.
- Netlify background function dispatch now bypasses the app auth middleware,
  and queued jobs that never start surface a retryable failure.
- Lesson-page warnings steer Mark toward listening first and selecting short
  clips, with whole-lesson transcription framed as a rare fallback.
- Memory-first clip cards present each completed teaching segment as a reusable
  listen-back memory with transcript and related practice suggestions.
- `/lessons` has a lightweight `Useful memory tips from Leo` library with
  search, topic filters, source-lesson links, and clipped audio playback.
- Hidden raw transcript.
- AI lesson summary.
- Candidate practice extraction.
- Keep/discard candidate items.
- Link kept items to source lesson audio.

Next:

- Per-segment returned cards for transcript, memory, and candidate items.
- Better distinction between lesson memory, context note, practice note, and
  actual exercise.
- Editable topic/tag metadata for memory tips if the listen-back library grows.
- Manual editing before saving candidate practice items.
- Consider a transcription usage/cost ledger after the background flow has been
  tested on real archive lessons.
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
- Practice session builder can add any active repertoire piece from a dedicated
  song dropdown, separate from smart queue suggestions.
- Spine/core tune is now a single visible concept: the star toggle. The status
  dropdown is lifecycle-only.

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
- Save and display a dedicated spoken note to future self with practice passage
  recordings.
- Quartet accompaniment area removed.
- Optional chart aide memoir overlay when a live practice session starts.

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
- The dashboard is activity-first and aggregates completed session-item time by
  day, piece, exercise, and practice task, with simple weekly and practice-mix
  graphics.
- A later dashboard should add drill-downs, session review, skips, confidence
  changes, source/lesson links, and longer-range reflection views.

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
- Addressed in current branch: `spine` has been removed from the visible status
  dropdown to avoid duplicate spine controls.

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

1. Open `/lessons` and confirm imported archive lessons play through the
   protected audio route.
2. Create one useful teaching clip from an imported lesson and transcribe only
   that selected clip.
3. Test the new practice-list edit flow.
4. Test building a session from existing practice-list items plus one-off
   session items.
5. Test ordered advancement, row selection, `Done and log time`, and `Not
   today`.
6. Test recording delete and practice-recording piece linking.
7. Test the dashboard totals and graphics after completing timed practice items linked to a
   piece, an exercise, and a lesson-derived practice item.
8. In `/practice`, add a repertoire piece that is not in the smart queue, record
   a passage, and confirm its future-self note persists.
9. Open `/lessons`, confirm it starts with controls/history, and delete an empty
   lesson shell after deleting its recordings.
10. Open an imported archive lesson, create a short useful clip, authorise
   transcription, and watch queued/running/completed progress.
11. Treat full-lesson transcription as an exception; retry the previous
   57-minute failure only to prove the 3-minute background chunk path works.
12. Add Mark's 12-keys reference graphic/card when supplied.
13. Continue richer session history and dashboard drill-downs.
