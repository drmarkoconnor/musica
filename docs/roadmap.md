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
- Archive/restore/delete.
- Confidence, frequency, and last-practised fields.
- Repertoire rows link to piece pages.
- Lead sheets attached to pieces.

Next:

- Denser scalable list design for hundreds of practice items.
- Better edit flows for manual items.
- Category/tag filtering.
- Inline status/confidence/frequency controls where appropriate.
- More direct relation between practice tasks, repertoire, exercises, and logs.

## Phase 7: Live Practice Sessions

Status: functional first pass.

Done:

- Build session from suggestions plus manual choices.
- Start live session.
- Active item timer with pause.
- 5-minute continue ping.
- Done/skip today.
- Optional confidence and notes.
- Add/delete items during a live session.
- Attach short practice recordings to the active session item.

Next:

- Session review/history page.
- Clear log records for what was actually practised and for how long.
- Better support for changing plans mid-session without losing intent.
- Recordings/note-to-self management per item.
- Optional confidence update prompts at the right moment.

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

## Immediate Next Best Steps

1. Let Mark test practice passage recording on phone/iPad after Netlify deploy.
2. Fix any save/playback edge cases from that test.
3. Improve session review/log visibility.
4. Continue the lesson audio studio with split/merge, true waveform data, and
   deeper zoom/focus editing.
5. Continue tightening dense practice-list CRUD before adding more intelligence.
