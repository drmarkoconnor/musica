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

## 2026-05-25 - Recording Controls And Memory Tips Library

Branch: `main`

Implementation commit: `f6638ef Add memory tip library`

Work done:

- Clarified lesson recording entry points: the native capture fallback is now
  labelled as a phone/iPad recorder and hidden on desktop-style browsers, while
  the normal file path reads `Upload audio file`.
- Hid the local-file recording checkbox when the browser cannot write to a
  user-chosen file during recording. Where supported, it remains selectable and
  is labelled `Also save a local file`.
- Removed the artificial pre-analysis chapter regions from the clip creation
  area. The lesson map now appears in the created-clip review queue and only
  visualizes actual saved clips, including discarded/transcribed state.
- Replaced post-transcription warning states with a completion state: saved clip
  memories suppress the pre-transcription warning, and the authorisation modal
  shows success metadata after a job completes.
- Added `public/lesson-clip-choice-mockups.html` with three visual directions
  based on the real `Leo lesson - 2024-10-16 11:08` segments.
- Implemented Option B from the mockups: completed clip memories now present as
  listen-back teaching memories with topic, summary, transcript, audio, and
  related practice suggestions.
- Added a lightweight `Useful memory tips from Leo` library on `/lessons`, built
  from completed clip memories with search, topic filters, clipped audio
  playback, and source-lesson links.

Commands run:

```bash
node --import tsx --env-file=.env.local -e ... inspect 2024-10-16 lesson segments
./node_modules/.bin/tsc --noEmit
PATH="/Users/moc/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" ./node_modules/.bin/next build
/usr/local/Cellar/git/2.47.1/bin/git diff --check
PATH="/Users/moc/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" ./node_modules/.bin/next dev --port 3001
browser smoke of /lessons memory tip search and 2024-10-16 selected lesson
```

Migration status: no database migration.

What Mark should test next:

- On desktop, confirm `/lessons` shows only `Upload audio file` plus the live
  recorder, not a duplicate native-capture file picker.
- On iPad, confirm the phone/iPad recorder label makes the native capture path
  clearer and that `Upload audio file` remains the existing-file route.
- Open `Leo lesson - 2024-10-16 11:08` and confirm `Chosen clip map` shows the
  four saved clip decisions without any artificial chapter regions.
- Search `slash` in `Useful memory tips from Leo` and confirm the library shows
  the two relevant listen-back memories.
- Review `http://localhost:3001/lesson-clip-choice-mockups.html` for the three
  saved-clip visual directions.

Known caveats:

- The normal system `git` shim is broken on this machine because Xcode command
  line tools are missing; Homebrew Git was used for status/diff checks.
- `npm` is not on the shell `PATH`; direct local binaries and the bundled
  workspace Node were used.
- The unrelated untracked `public/presentations/` folder remains local and was
  not touched.

## 2026-05-23 - Netlify Background Transcription Start Fix

Branch: `main`

Implementation commits:

- `43ab678 Start transcription jobs reliably on Netlify`
- `9042101 Allow transcription background function through auth`

Production deploy: `https://jazzmusica.netlify.app`, ready at
2026-05-23T20:23:36Z.

Work done:

- Investigated Mark's report that a newly recorded iPad lesson and selected
  clip hung again after authorising transcription.
- Found the live job `d2ba300a-3249-423a-bd02-c3d12f30c0c4` for
  `Leo lesson - 23 May 2026 at 20:24` stuck in `queued` with no background
  function logs.
- Recovered Mark's clip by running that job directly; it completed, saved the
  segment memory `Major Scales in Circle of Fourths`, and created candidate
  practice item `Circle of Fourths Exercise`.
- Fixed production dispatch so Netlify/prod requests use the background
  function instead of the local fire-and-forget runner.
- Added stale queued-job detection so jobs that never start fail visibly with a
  retry instruction.
- Found the deeper issue: the whole-app auth middleware intercepted
  `/.netlify/functions/transcribe-lesson-background` and returned the login
  shell as HTTP 200, so the starter believed the background job had started.
- Allowed `/.netlify/functions/*` through the app auth middleware and made the
  starter reject HTML app-shell responses from the background endpoint.
- Ran a production smoke through login, audio upload, segment creation,
  transcription authorisation, Netlify background function execution, polling to
  `complete`, and cleanup.

Commands run:

```bash
node ... netlify logs --source functions --since 2h --json
node node_modules/tsx/dist/cli.mjs ... inspect recent lessons/jobs/chunks
node node_modules/tsx/dist/cli.mjs ... run stuck job d2ba300a...
npm run typecheck
npm run build
git diff --check
node ... netlify build
gh auth setup-git
git push origin main
node ... netlify watch
node ... production function/login-path probe
node ... production transcription smoke and cleanup
node node_modules/tsx/dist/cli.mjs ... verify no smoke leftovers
```

Migration status: no database migration. The production smoke created a
throwaway lesson/recording/segment/job and deleted the lesson/recording/audio
after completion.

What Mark should test next:

- Refresh `/lessons`, open `Leo lesson - 23 May 2026 at 20:24`, and confirm the
  recovered clip memory and candidate practice item are visible.
- Record or upload one more very short real clip and authorise transcription;
  it should move from queued to running within a few seconds.

Known caveats:

- Netlify background functions return `202` immediately with an empty response,
  so the UI must rely on job polling for the true result.
- The unrelated untracked `public/presentations/` folder remains local and was
  not committed.

## 2026-05-23 - Disable Production Test Fixtures

Branch: `main`

Implementation commit: `c14e2a1 Disable test audio fixtures in production`

Production deploy: `https://jazzmusica.netlify.app`, ready at
2026-05-23T17:26:00Z.

Work done:

- Followed up Mark's report that a visible test clip path had been confusing
  and unplayable.
- Confirmed there are no current Neon lesson recording rows pointing at the old
  local test fixture.
- Added a shared fixture gate so test audio fixture APIs only work in
  non-production when `PRACTICE_LOOP_ENABLE_TEST_AUDIO=true`.
- Confirmed the live production transcription API rejects a fixture request
  after authenticated login with `404 Test audio fixtures are disabled`.

Commands run:

```bash
rg -n "testAudioFixture|fixture|test clip|Attach|transcription" src
npx tsx -e ... inspect fixture recording rows
npm run typecheck
npm run build
git diff --check
NODE_ENV=production PRACTICE_LOOP_ENABLE_TEST_AUDIO=true npx tsx -e ... verify fixture gate
git push origin main
npx netlify watch
npx netlify api listSiteDeploys --data '{"site_id":"4615fba6-fab5-42ab-be8a-616a65d46ed7"}'
node - <<'NODE' ... authenticated production fixture rejection smoke
```

Migration status: no database migration.

What Mark should test next:

- Use only real lesson audio: `Record with device`, upload audio, then select a
  short teaching clip and authorise transcription.

Known caveats:

- Translation keys and older docs still mention fixture/test wording, but the
  production UI and API path are blocked for real use.

## 2026-05-23 - Transcription Retry Stale Job Fix

Branch: `main`

Implementation commit: `c2b1740 Restart stalled transcription jobs`

Production deploy: `https://jazzmusica.netlify.app`, ready at
2026-05-23T17:21:38Z.

Work done:

- Investigated Mark's clarification that the earlier failure was the
  transcription process.
- Found the concrete stuck state in Neon: transcription job
  `ad6e8dd1-2286-4354-a99d-2325501e9aed` for `Leo lesson - 2024-10-16 11:08`
  was `running` at `Preparing recording`, with 0/1 chunks complete and its
  chunk still `pending`.
- Identified the retry bug: matching `running` jobs were treated as already
  active, so re-authorising transcription did not restart a stale background
  run.
- Added stale-running detection. Re-authorising a matching stale job now resets
  it to queued and returns `shouldStart: true`; status polling can also mark a
  stale run failed with a restart instruction.
- Ran a tiny end-to-end transcription smoke test through ffmpeg, OpenAI
  transcription, OpenAI lesson analysis, DB writes, and cleanup.
- Ran the exact stuck job locally; it completed successfully, saved the
  transcript and segment memory, and created one candidate practice item.

Commands run:

```bash
npx netlify logs --source functions --function transcribe-lesson-background --since 24h --json
npx tsx -e ... inspect transcription jobs/chunks/transcripts
npm run typecheck
npx tsx -e ... end-to-end transcription smoke test and cleanup
npx tsx -e ... reset stale job via createLessonTranscriptionJob
npx tsx -e ... run stuck job ad6e8dd1...
npx tsx -e ... verify completed job/chunk/transcript/segment memory/extract
npm run typecheck
npm run build
git diff --check
npx netlify build
git push origin main
npx netlify status
npx netlify watch
npx netlify api listSiteDeploys --data '{"site_id":"4615fba6-fab5-42ab-be8a-616a65d46ed7"}'
```

Migration status: no database migration. The smoke test created one temporary
local lesson/recording/selected segment, then deleted its rows and local audio
file. The real stuck 2024-10-16 transcription job is now complete.

What Mark should test next:

- Open `Leo lesson - 2024-10-16 11:08` and confirm the useful clip memory and
  candidate practice item are visible.
- Transcribe one new short selected clip after deploy to confirm the retry path
  no longer wedges if a background run stalls.

Known caveats:

- Selected-clip transcription still materializes the full source recording
  before clipping. It worked locally for the stuck 74-second clip from a
  one-hour source recording, but future storage work should avoid full-object
  materialization for long recordings.

## 2026-05-23 - Mobile Recording Fallback

Branch: `main`

Implementation commit: `0dcb54e Add mobile lesson recording fallback`

Production deploy: `https://jazzmusica.netlify.app`, ready at
2026-05-23T17:02:52Z.

Work done:

- Responded to follow-up report that lesson recording still would not work in
  Chrome or on iPhone after the first hardening deploy.
- Confirmed no new successful `lesson_recordings` rows appeared in Neon after
  the mobile attempts.
- Moved IndexedDB rescue setup behind the actual `MediaRecorder.start()` path so
  mobile browser storage APIs cannot block the recording start.
- Added a separate `Record with device` button on `/lessons` that uses the
  phone/tablet native capture-file flow and then uploads through the existing
  lesson audio upload route.
- Widened lesson upload acceptance for iOS-style audio MIME types, including
  `audio/x-m4a`, `audio/m4a`, and related WAV variants.
- Added a client-side timeout around manual/native audio uploads.

Commands run:

```bash
npm run typecheck
npm run build
git diff --check
curl http://localhost:3001/lessons
npx tsx -e ... iOS-style audio/x-m4a upload smoke test and cleanup
```

Migration status: no database migration. The iOS-style upload smoke created one
tiny throwaway lesson recording, then deleted its audio object and DB rows.

What Mark should test next:

- On iPhone/iPad, first try `Record with device` on `/lessons`, record a short
  clip, accept/use the resulting file, and confirm the lesson appears.
- Then try `Start live lesson recording`; it should enter recording state more
  quickly because rescue storage no longer blocks start-up.

Known caveats:

- iOS browser live recording still depends on WebKit `MediaRecorder`; the
  native `Record with device` path is the safer fallback for immediate testing.

## 2026-05-23 - iPad Brave Recording Save Hardening

Branch: `main`

Implementation commit: `e4723e0 Harden lesson recording saves`

Production deploy: `https://jazzmusica.netlify.app`, ready at
2026-05-23T07:35:23Z.

Work done:

- Responded to a report that even a short lesson clip hung on iPad using Brave.
- Changed live lesson recording to avoid server upload work during recording:
  chunks are kept in memory and browser rescue storage first, then saved after
  stop.
- Small recordings now use the simpler direct upload route first; larger
  recordings and direct-upload fallback use server-side chunk upload sessions.
- Added bounded waits/timeouts around IndexedDB rescue storage, persistent
  storage prompts, device-copy writes/closes, MediaRecorder stop finalization,
  and upload fetches so the UI should not remain stuck on `Saving recording`.
- Added `requestData()` before `MediaRecorder.stop()` plus a stop-event fallback
  for WebKit-style final-chunk delays.
- Ensured same-tab save prefers complete in-memory chunks over a partially
  persisted IndexedDB copy if browser storage is slow.

Commands run:

```bash
npm run typecheck
npm run build
git diff --check
curl http://localhost:3001/lessons
npx tsx -e ... local direct-upload smoke test and cleanup
npx tsx -e ... verify 0 Codex smoke lessons remain
npx netlify link --id 4615fba6-fab5-42ab-be8a-616a65d46ed7
git commit -m "Harden lesson recording saves"
git push origin main
npx netlify watch
npx netlify api getDeploy ...
```

Migration status: no database migration. The direct-upload smoke created one
tiny throwaway lesson recording, then deleted its audio object and DB rows.

What Mark should test next:

- On the iPad in Brave, record a 5-10 second lesson clip and stop it.
- Confirm it either saves quickly or shows an unsaved recording with retry and
  download options rather than hanging indefinitely.
- If Brave still misbehaves, repeat once in Safari to isolate Brave-specific
  shell behavior from iOS WebKit behavior.

Known caveats:

- Direct device-file writing is still unavailable on iPad browsers; iPad relies
  on browser rescue storage plus download/retry recovery.
- Very poor connectivity can still prevent server save, but it should now time
  out into a recoverable state.

## 2026-05-22 - Lesson Recording Chunking And Rescue Hardening

Branch: `main`

Implementation commit: `e4723e0 Harden lesson recording saves`

Work done:

- Investigated the failed hour-long live recording report.
- Confirmed there was no new real lesson recording row in Neon and no recent
  Netlify Blob for the failed take; the newest row was a development
  `local-test-audio` fixture attached at 11:11 BST.
- Removed that `local-test-audio` recording row from Neon and returned the
  `First with the app` lesson to draft/no-recording state.
- Removed the normal lesson UI path for attaching test audio and gated the test
  fixture API behind `PRACTICE_LOOP_ENABLE_TEST_AUDIO=true`.
- Added browser-local lesson recording rescue drafts in IndexedDB while
  recording/uploading, with retry save, download copy, and discard controls.
- Added server-side lesson recording upload sessions. Live recording now sends
  small chunks to `/api/lesson-recordings/upload-session/*` and completes only
  after the server assembles all chunks into the final lesson audio object.
- Added a default-on `Save a device copy` option where supported by the browser;
  Mark chooses a local file before recording and the app writes chunks to it
  during recording.
- Made device-copy success messaging depend on the local file stream closing
  successfully, so the UI does not claim a device copy exists after a write
  failure.
- Turned the lesson upload placeholder into a real audio file upload control.
- Preserved client `recordedAt` on upload and cleaned up newly stored audio if
  metadata insertion fails.

Commands run:

```bash
git status -sb
npx tsx -e ... latest lesson_recordings query
npx tsx -e ... Netlify Blobs orphan check
npx tsx -e ... remove local-test-audio row
npm run typecheck
npm run build
git diff --check
node/npx tsx ... chunked upload session smoke test
node --input-type=module -e ... lesson page smoke checks
npx -y playwright screenshot --channel chrome ...
```

Migration status: no database migration. Data cleanup deleted 1 accidental
`local-test-audio` `lesson_recordings` row and updated its lesson back to
`draft`.

What Mark should test next:

- Record a short live lesson with `Save a device copy` enabled, stop it, and
  confirm both the app recording and the local file play.
- Test the failure path on a throwaway recording if possible: interrupt upload
  and confirm the unsaved recording can be retried or downloaded.
- Upload a small audio file from `/lessons` and confirm it creates or attaches a
  playable lesson recording.

Known caveats:

- The already-lost hour-long take was not recoverable from server-side storage;
  no DB row or recent blob existed for it.
- Chrome/Edge support direct device-file writing; unsupported browsers still
  fall back to browser rescue storage and download-copy recovery.
- The app no longer depends on one large client upload, but final server
  assembly still materializes the full recording before writing the Netlify
  Blob. Multipart/object-compose storage can improve this later if needed.

## 2026-05-22 - Leo Presentation Deck

Branch: `main`

Implementation commit: not committed yet.

Work done:

- Created a bilingual English/Italian presentation for explaining Practice Loop
  to Leo as a professional educational product.
- Captured live app screenshots after entering through the passworded app flow.
- Added an interactive HTML deck with side-by-side English/Italian copy,
  screenshot-led slides, cost-aware AI/manual-note positioning, and an original
  click-to-start soft jazz backing bed.
- Exported a PDF copy for easy sharing.

Files added:

- `public/presentations/practice-loop-leo/index.html`
- `public/presentations/practice-loop-leo/practice-loop-for-leo.pdf`
- `public/presentations/practice-loop-leo/screenshots/*.png`
- `public/presentations/practice-loop-leo.zip`

Commands run:

```bash
npx -y playwright screenshot ...
npx -y playwright pdf ...
git diff --check
```

Migration status: no database migration.

What Mark should test next:

- Open the HTML deck, step through the slides, and decide whether the
  AI-transcription-cost slide should be more cautious before sharing with Leo.
- Use the PDF if a non-interactive/email-safe version is needed.

Known caveats:

- The HTML deck's jazz bed is generated in the browser and requires a click to
  start because browsers block autoplay audio.

## 2026-05-22 - Delete No-Recording Dummy Lessons

Branch: `main`

Implementation commit: `5977762`

Work done:

- Investigated why the visible dummy lessons did not delete.
- Found the UI only exposed deletion for lessons with no recordings, extracts,
  or transcripts, while the dummy lessons had 0 recordings but old extracted
  practice candidates.
- Changed the lesson history delete affordance to appear for any lesson with no
  recordings.
- Deleted 7 no-recording May 2026 dummy lesson shells directly from Neon.
- Verified there are now 0 lessons with no recordings.

Commands run:

```bash
npm run typecheck
npm run build
git diff --check
npx tsx -e ... no-recording lessons query
npx tsx -e ... delete 7 no-recording dummy lessons
npx tsx -e ... verify no-recording lessons query
git commit -m "Allow deleting lessons without recordings"
```

Migration status: no database migration. Data cleanup deleted 7 dummy `lessons`
rows with no `lesson_recordings`.

What Mark should test next:

- Reload `/lessons` after deploy and confirm the top dummy May 2026 lesson rows
  are gone.
- If a future lesson has no recordings, confirm the delete action is visible.

Known caveats:

- Lesson deletion remains blocked by the API while a lesson still has any
  recording rows.

## 2026-05-22 - Dashboard Lessons And Practice Session Cleanup

Branch: `main`

Implementation commit: `b7dc6c2`

Work done:

- Removed smart queue and recent lesson extraction cards from the dashboard.
- Moved activity directly under the launch cards and added weekly practice bars
  plus a simple practice-mix graphic.
- Added a repertoire-piece dropdown to the practice session builder so any
  active song can be added separately from smart queue suggestions.
- Split practice passage "spoken note to future self" from general item notes,
  saved it with practice recordings, and rendered it beside saved passages.
- Changed `/lessons` to open on start/record controls plus lesson history
  instead of auto-loading a lesson executive summary.
- Added guarded deletion for empty lesson shells once their recordings have
  already been removed.

Commands run:

```bash
git status -sb
npm run typecheck
npm run build
git diff --check
git commit -m "Refine dashboard lessons and practice session flows"
```

Migration status: no database migration.

What Mark should test next:

- Dashboard: confirm activity and graphics are visible immediately.
- Practice: add a non-smart-queue song, record a passage, and check the spoken
  note appears beside the saved clip.
- Lessons: confirm the page starts on controls/history and delete an empty
  dummy lesson shell.

Known caveats:

- Empty lesson deletion is intentionally blocked while the lesson still has
  recordings; delete those from `/recordings` first.

## 2026-05-22 - Stream Lesson Blobs For Background Transcription

Branch: `main`

Implementation commit: `983675a`

Work done:

- Investigated Mark's report after a short clip transcription test.
- Confirmed the browser `favicon.ico` 404 was cosmetic, but the latest
  transcription job had stalled in `running` at `Preparing recording`.
- Manually resumed the same job locally; it completed successfully with a
  transcript, summary, and one practice candidate.
- Updated the Netlify background function to call `connectLambda(event)` before
  using Netlify Blobs.
- Updated lesson audio materialization to stream Netlify Blob audio to a temp
  file for transcription instead of loading the whole lesson blob into memory.
- Added an SVG app icon so the browser no longer falls back to missing
  `/favicon.ico`.

Commands run:

```bash
git status -sb
npx tsx -e ... latest transcription job query
npx tsx -e ... runLessonTranscriptionJob
npm run typecheck
npm run build
git diff --check
git commit -m "Stream lesson blobs for transcription jobs"
```

Migration status: no database migration.

What Mark should test next:

- Reload the live app after deploy, open the same lesson, and confirm the
  completed `Misty Counting` clip transcript appears.
- Try one more short selected clip and confirm it moves beyond `Preparing
  recording` into chunk progress.

Known caveats:

- If a Netlify background function is killed hard, a job may still remain in
  `running`; the same job can be resumed by rerunning the job runner.

## 2026-05-21 - Background Transcription Queue And Dashboard Totals

Branch: `main`

Implementation commit: `ddc633c`

Work done:

- Reworked lesson transcription from a synchronous API request into durable
  `transcription_jobs` and `transcription_job_chunks` rows.
- Added a Netlify `transcribe-lesson-background` function and a shared local/job
  runner that chunks audio into 3-minute transcription calls.
- Added transcription status polling and visible queued/running/failed/complete
  progress in the lesson modal.
- Added lesson-page warnings to listen first, select short useful clips, and
  reserve whole-lesson transcription for rare cases.
- Added dashboard totals by piece, exercise, practice item, and recent day.
- Added first-pass iPad landscape polish to the app shell and lesson workspace.

Commands run:

```bash
npm run typecheck
npm run db:generate
npm run build
npm run db:migrate
git diff --check
git commit -m "Add transcription jobs and practice dashboard totals"
```

Migration status:

- Generated `drizzle/0006_hot_starfox.sql`.
- Applied successfully to Neon with `npm run db:migrate`.

What Mark should test next:

- Open an imported lesson, make one short useful teaching clip, authorise
  transcription, and watch the modal progress through queued/running/complete.
- Check the dashboard on iPad landscape after a practice session with linked
  piece/exercise/task items.
- Only retry the previous 57-minute whole-lesson transcription as a proof test;
  the normal workflow should be clip-first.

Known caveats:

- A very long full-lesson request still makes many paid OpenAI calls and may
  leave the transcript saved while the later lesson-summary extraction fails.
- Netlify background function logs should be checked if a live queued job does
  not advance.

## 2026-05-21 - Chunk Full-Recording Transcription

Branch: `main`

Commit: `0284bb9` (pushed to `origin/main`)

Work done:

- Investigated continued transcription failure after the 60-minute guard.
- Found the latest failed transcript error from OpenAI:
  `400 Total number of tokens in instructions + audio is too large for this model`.
- Confirmed the failed recording was 57 minutes 37 seconds, so it correctly
  passed the 60-minute app guard but was still too large for one transcription
  model request.
- Updated full-recording transcription so recordings over 10 minutes are clipped
  into 10-minute chunks and transcribed sequentially.
- Kept the overall full-recording guard at 60 minutes.

Commands run:

```bash
git status -sb
npx tsx -e ... latest transcript failure query
npx tsx -e ... selected segment summary query
sed -n ... src/app/api/transcriptions/route.ts
npm run typecheck
npm run build
git diff --check
git push origin main
```

Migration status: no database migration.

What Mark should test next:

- Retry the failed 57-minute lesson full transcription after deploy, or better,
  create useful clips and transcribe those.

Known caveats:

- Chunked full-recording transcription will make several OpenAI calls and may
  take longer than short selected clips.

## 2026-05-21 - Audio Playback And Hydration Repair

Branch: `main`

Commit: `f645ac9` (pushed to `origin/main`)

Work done:

- Investigated Mark's browser errors after the archive import.
- Confirmed the reported recording ID was an older `local-lesson-audio` row,
  not an archive import.
- Migrated 2 legacy local lesson recordings and 2 local test-audio lesson rows
  to Netlify Blobs, then updated their Neon metadata.
- Marked 1 stale local practice recording as non-playable because its temporary
  local file no longer exists.
- Added hosted read-model filtering for local-only audio buckets.
- Replaced default `toLocaleDateString()` rendering with deterministic date
  labels to avoid React hydration text mismatches.
- Made local missing lesson audio return unavailable before transcription
  rather than falling into a long failing request.
- Blocked full-recording transcription for recordings over 60 minutes and
  improved transcription error display so non-password failures show their
  actual server message.

Commands run:

```bash
npx tsx -e ... inspect reported lesson_recording
curl -i -H 'Range: bytes=0-0' .../api/lesson-recordings/fdba.../file
npx tsx ... migrate legacy local lesson recordings to Netlify Blobs
npx tsx ... migrate local test-audio lesson rows and mark stale practice row
npx tsx -e ... storage bucket count checks
npm run typecheck
npm run build
git diff --check
git push origin main
```

Migration status: no schema migration. Data repair updated storage metadata for
legacy local audio rows.

Verification:

- The reported `fdba...` recording now returns `206 Partial Content` locally
  through the protected file route.
- An imported archive recording also returns `206 Partial Content`.
- All `lesson_recordings` rows now use `storage_bucket = netlify-blobs`.

What Mark should test next:

- Reload the live site and `/recordings` after the next deployment.
- Confirm the console no longer shows React #418 hydration errors.
- Play the previously failing lesson recording.
- On a long archive lesson, create a useful clip before transcribing.

Known caveats:

- One old practice recording had already lost its temporary local audio file, so
  it is retained as metadata but no longer presented as playable.
- Live deployment should include these fixes once Netlify finishes building
  `main`.

## 2026-05-21 - Lesson Archive Import Completed

Branch: `main`

Commit: `f645ac9` (pushed to `origin/main`)

Work done:

- Ran the private `lessonrecordings/` archive write import.
- Uploaded 31 non-duplicate lesson recordings to Netlify Blobs.
- Inserted 31 matching imported `lessons` rows and 31 `lesson_recordings` rows
  in Neon.
- Skipped 4 exact duplicate audio files.
- Verified imported database rows span 2024-10-02 through 2026-04-10.
- Updated import/current-state/roadmap docs.

Commands run:

```bash
node -e ... DATABASE_URL/NETLIFY_SITE_ID/NETLIFY_BLOBS_TOKEN presence check
npm run lessons:import-recordings -- --source lessonrecordings --write
npx tsx -e ... imported lesson_recordings count check
npx tsx -e ... imported lessons count check
```

Migration status: no database migration.

Import status:

- Complete: 31 imported, 4 duplicates skipped.
- No transcription or OpenAI calls were run.
- Result manifest is local and ignored:
  `lessonrecordings/.practice-loop-import-result.json`.

What Mark should test next:

- Open `/lessons` and confirm imported archive lessons appear.
- Play one imported recording through the protected audio route.
- Create one useful teaching clip and run passworded transcription only for the
  selected clip.

Known caveats:

- The archive importer is intentionally sequential and quiet during upload.
- Future archive additions can be rerun with the same command; existing storage
  paths should be treated idempotently.

## 2026-05-21 - Lesson Archive Importer

Branch: `main`

Commit: `f645ac9` (pushed to `origin/main`)

Work done:

- Added `scripts/import-lesson-recordings.ts`.
- Added `npm run lessons:import-recordings`.
- The importer dry-runs by default, reads duration and embedded creation time
  with `ffprobe`, hashes files, skips exact duplicate audio, and writes its
  private manifest inside ignored `lessonrecordings/`.
- Write mode is designed to upload non-duplicate archive audio to Netlify Blobs
  and insert `lessons`/`lesson_recordings` metadata without transcription.
- Updated `.env.example`, `docs/current-state.md`, `docs/roadmap.md`, and
  `docs/lesson-recording-import-plan.md`.

Commands run:

```bash
git status -sb
git log --oneline -5
npm run lessons:import-recordings -- --source lessonrecordings --dry-run
npm run lessons:import-recordings -- --source lessonrecordings --write --limit 1
npm run typecheck
npm run build
git check-ignore -v lessonrecordings/.practice-loop-import-dry-run.json
git diff --check
```

Migration status: no database migration.

Import status:

- Dry-run succeeded: 35 audio files discovered, 31 selected, 4 exact duplicates
  skipped, about 31.35 selected audio hours.
- Write mode stopped before upload or DB writes because local Netlify Blob
  credentials are missing.

What Mark should do next:

- Add `NETLIFY_SITE_ID` and `NETLIFY_BLOBS_TOKEN` to `.env.local`.
- Run `npm run lessons:import-recordings -- --source lessonrecordings --write`.
- Open `/lessons`, confirm archive lessons appear, and process useful clips
  through the existing passworded transcription flow.

Known caveats:

- The importer does not call OpenAI or create transcripts.
- It relies on `ffprobe` being available on the local PATH.

## 2026-05-21 - Private Lesson Recording Archive Investigation

Branch: `main`

Commit: `f645ac9` (pushed to `origin/main`)

Work done:

- Audited the new private `lessonrecordings/` source archive without importing,
  uploading, or transcribing any audio.
- Confirmed the archive is about 35 `.m4a` files, 549 MB, and 35.8 hours.
- Found 4 exact duplicate pairs by SHA-256 hash.
- Confirmed embedded M4A `creation_time` metadata is reliable enough to drive
  lesson dates where filenames are ambiguous.
- Added `lessonrecordings/` to `.gitignore`.
- Added `docs/lesson-recording-import-plan.md` with the recommended Blob-backed
  metadata import path.
- Updated `docs/current-state.md` and `docs/roadmap.md`.

Commands run:

```bash
git status -sb
git log --oneline -5
sed -n ... docs/project-brief.md docs/current-state.md docs/roadmap.md docs/agent-log.md
sed -n ... src/db/schema.ts src/lib/server/lesson-audio-storage.ts
sed -n ... src/app/api/lesson-recordings/upload/route.ts
sed -n ... src/app/api/transcriptions/route.ts
find lessonrecordings ...
du -sh lessonrecordings
ffprobe ...
shasum -a 256 ...
git check-ignore -v lessonrecordings ...
```

Migration status: no database migration and no database writes.

What to test next:

- Implement a dry-run archive importer that creates a local manifest and skips
  duplicate hashes.
- Choose whether the first real import should target Netlify Blobs for hosted
  playback/transcription or a local-only ignored folder for trial review.
- After import, review lessons manually and transcribe selected teaching clips,
  not the whole archive by default.

Known caveats:

- Hosted Netlify cannot play local-only archive files; hosted use needs private
  object storage.
- No build was needed for `.gitignore` and documentation-only changes.

## 2026-05-21 - Chart Aide Memoir Overlay

Branch: `practice-session-repertoire-roadmap`

Commit: `d0df3ed Add practice chart aide memoir overlay`

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

Commit: `c9eb847 Remove duplicate spine status control`

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
