# Testing The Current Build

The app is now partly live and partly scaffolded.

For same-machine testing, use `http://localhost:3001`. For phone/iPad
microphone testing from another device, browser security may require HTTPS; use
`npm run dev:https` and open `https://<mac-ip>:3443/lessons`.

The GitHub repo is public, so private lesson audio, generated transcripts, and
lead-sheet PDFs are intentionally gitignored. Keep those files local until the
app has private object storage.

Set `PRACTICE_LOOP_APP_PASSWORD` before using the hosted app for real
conversations. When this value is present, every page and API route is protected
by a private app password. `PRACTICE_LOOP_SESSION_SECRET` is optional; if set,
it adds separate signing material to the app session cookie.

On Netlify the live upload route stores audio in Netlify Blobs. Neon stores the
lesson and recording metadata; the audio object lives in the `lesson-recordings`
blob store.

Lead-sheet PDFs are still local-only fixtures in the repo workspace. For the
hosted app they should move to object storage too, with Neon keeping
`piece_assets` metadata and the object store keeping the private PDF/image.

Netlify environment variables that are only needed by API routes should be
scoped to Functions rather than Builds when the Netlify plan/UI allows it. On
the free/default setup, where variables may be scoped everywhere, use long
unique values and verify that they do not appear in the client bundle or build
output.

- `TRANSCRIPTION_PASSWORD`
- `PRACTICE_LOOP_APP_PASSWORD`
- `PRACTICE_LOOP_SESSION_SECRET`
- `OPENAI_API_KEY`
- `DATABASE_URL`
- optional fallback: `NETLIFY_BLOBS_TOKEN`

Netlify normally supplies Blobs context automatically to Functions. If upload
still reports `MissingBlobsEnvironmentError`, create a Netlify Personal Access
Token and set it as `NETLIFY_BLOBS_TOKEN` with Functions scope. The function can
combine that token with Netlify's built-in `SITE_ID` to access the blob store.

Use a long unique transcription password; short common words can trigger
Netlify's exact-value secret scanner because they naturally appear in docs or
compiled output.

## Live Now

- Navigation between pages
- Whole-app private password gate when `PRACTICE_LOOP_APP_PASSWORD` is set
- English / Italian language toggle
- Repertoire read from Neon
- Add repertoire piece
- Edit repertoire piece
- Archive repertoire piece
- Restore repertoire piece from Archive
- Delete repertoire piece after confirmation
- Lead sheet review/import from `docs/leadsheets`
- Lead-sheet assets linked to repertoire pieces
- Actual lead-sheet PDF viewer on piece detail pages
- Create draft lesson
- Record live lesson audio in the browser and save it into the selected lesson
- Transcription password modal
- Server-side rejection of failed transcription passwords
- Real OpenAI transcription test script for the central 15-minute fixture
- Password-gated transcription route can transcribe the allow-listed central
  fixture when explicitly requested
- Password-gated transcription route can transcribe saved local lesson
  recordings after authorisation
- After transcription, a second AI pass creates a lesson summary and candidate
  practice items when the transcript contains clear teaching instructions.
- Mark teaching segments on a saved recording before transcription.
- See selected segment count and selected minutes before entering the
  transcription password.
- Transcription now uses selected teaching segments by default; full-recording
  transcription requires an explicit checkbox when no segments are selected.
- Attach the central 15-minute fixture to a lesson
- Play allow-listed lesson audio and browser-recorded lesson audio in the
  lesson screen
- Use the compact lesson history to switch between previous lessons and inspect
  their audio, narrative transcript, and extracted candidates.
- View the AI lesson summary first, with raw transcript text collapsed by
  default
- Review fixture transcript as a single executive-summary card with timestamped
  bullets
- Listen to the relevant clip from the small button beside each bullet
- Create a lesson-sourced practice note from a transcript bullet
- Keep or discard extracted candidate practice items. Kept items become
  lesson-sourced practice tasks in `From Lessons`.
- Manage lesson-sourced practice tasks in a dense row list, with compact clip
  playback, archive/restore, delete, and expandable details.
- Real 24 April 2026 Leo lesson audio is available locally for upcoming
  transcription work
- A central 15-minute test fixture has been cut from that recording

## Still Placeholder UI

These controls are intentionally disabled and marked `Coming soon`:

- Upload audio
- Edit lesson extracts
- Split or merge teaching segments
- Practice session accept / skip / replace / add
- Metronome controls
- Upload asset
- Lead sheet import/write after review

The transcription endpoint now calls OpenAI for local lesson recordings after
password authorisation. It saves the transcript, then runs a second AI pass to
populate the lesson summary and `Extracted candidate practice items`.

## Audio Test Fixture

Original recording:

- `docs/leadsheets/Leo Lesson_20260424_1200.m4a`
- Duration: 56:02
- Format: mono AAC `.m4a`

First transcription/extraction test clip:

- `docs/test-audio/Leo Lesson_20260424_1200.central-15m.m4a`
- Source range: 20:31-35:31
- Duration: 15:00
- Size: about 7.2 MB

Use the 15-minute clip before trying the full lesson. It is long enough to test
real teacher/student context, timestamped musical instructions, and noisy lesson
flow without making every test slow or expensive.

## AI Transcription Test

Run:

```bash
npm run ai:transcribe:test
```

This sends only the central 15-minute fixture to OpenAI and writes:

- `docs/test-audio/Leo Lesson_20260424_1200.central-15m.transcript.json`
- `docs/test-audio/Leo Lesson_20260424_1200.central-15m.transcript.txt`

The app route can also transcribe this fixture after password authorisation by
posting `testAudioFixture: "leo-20260424-central-15"` to
`/api/transcriptions`.

## What To Test Now

1. Open `http://localhost:3001/repertoire`.
2. Confirm the page says it is reading from Neon.
3. Add a test tune.
4. Refresh the page and confirm it remains.
5. Edit the tune's confidence, tempo, status, or notes.
6. Refresh again and confirm the edit remains.
7. Try the language toggle and confirm labels change.
8. Archive the tune and confirm it moves out of Repertoire into `Archive`.
9. Restore it from `Archive` and confirm it comes back as `Maintenance`.
10. Open `http://localhost:3001/assets/leadsheets` and confirm the approved
    lead sheets are all linked to repertoire pieces.
11. Open a repertoire piece and confirm its lead-sheet PDF is visible.
12. Open `http://localhost:3001/lessons`, create a draft lesson, refresh, and
    confirm it remains.
13. Confirm the new draft lesson shows no transcript or extracts yet.
14. Attach the test lesson clip to the draft lesson.
15. Play the full test clip and one timestamped transcript bullet.
16. Turn one useful transcript bullet into a practice note.
17. Open `http://localhost:3001/from-lessons` and confirm the new practice
    element appears with its audio timestamp.
18. Return to `http://localhost:3001/lessons`.
19. Press `Start live lesson recording` for a short 20-60 second test.
20. Speak or play a little, then press `Stop and save lesson`.
21. Confirm a new lesson appears with playable audio.
22. Add one teaching segment around the useful part of the recording.
23. Confirm the transcription modal shows the selected segment count and
    selected minutes.
24. Press `Transcribe Lesson`, enter the transcription password, and wait for
    the modal success message.
25. Confirm the lesson summary appears and raw transcript is collapsed.
26. Keep one useful extracted candidate.
27. Open `http://localhost:3001/from-lessons` and confirm the kept item appears.

Archive is safer than delete. Delete is available in the edit dialog and asks
for confirmation.

## What Comes Next

The next sensible feature is tightening the segment editor: split, merge, and
better post-lesson navigation for long recordings.
