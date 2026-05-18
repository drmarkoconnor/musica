# Testing The Current Build

The app is now partly live and partly scaffolded.

For same-machine testing, use `http://localhost:3001`. For phone/iPad
microphone testing from another device, browser security may require HTTPS; use
`npm run dev:https` and open `https://<mac-ip>:3443/lessons`.

The GitHub repo is public, so private lesson audio, generated transcripts, and
lead-sheet PDFs are intentionally gitignored. Keep those files local until the
app has private object storage.

On Netlify the live upload route uses temporary `/tmp` storage. That is enough
to smoke-test the phone microphone flow over HTTPS, but recordings are not
durable there yet.

Netlify environment variables that are only needed by API routes should be
scoped to Functions rather than Builds:

- `TRANSCRIPTION_PASSWORD`
- `OPENAI_API_KEY`
- `DATABASE_URL`

Use a long unique transcription password; short common words can trigger
Netlify's exact-value secret scanner because they naturally appear in docs or
compiled output.

## Live Now

- Navigation between pages
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
- Record live lesson audio in the browser and save it as a new lesson
- Transcription password modal
- Server-side rejection of failed transcription passwords
- Real OpenAI transcription test script for the central 15-minute fixture
- Password-gated transcription route can transcribe the allow-listed central
  fixture when explicitly requested
- Password-gated transcription route can transcribe saved local lesson
  recordings after authorisation
- Attach the central 15-minute fixture to a lesson
- Play allow-listed lesson audio and browser-recorded lesson audio in the
  lesson screen
- View saved transcript text as a bulleted list
- Review fixture transcript as a single executive-summary card with timestamped
  bullets
- Listen to the relevant clip from the small button beside each bullet
- Create a lesson-sourced practice note from a transcript bullet
- Real 24 April 2026 Leo lesson audio is available locally for upcoming
  transcription work
- A central 15-minute test fixture has been cut from that recording

## Still Placeholder UI

These controls are intentionally disabled and marked `Coming soon`:

- Upload audio
- Keep / edit / discard lesson extracts
- Practice session accept / skip / replace / add
- Metronome controls
- Upload asset
- Lead sheet import/write after review

The transcription endpoint now calls OpenAI for local lesson recordings after
password authorisation. It saves the transcript, but it does not yet generate
the executive summary or practice-note suggestions automatically.

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
22. Press `Transcribe Lesson`, enter the transcription password, and wait for
    the modal success message.
23. Confirm the transcript appears as bullets after the page refreshes.
24. Confirm Upload audio, Keep, Edit, and Discard remain disabled until the
    remaining review pipeline is implemented.

Archive is safer than delete. Delete is available in the edit dialog and asks
for confirmation.

## What Comes Next

The next sensible feature is generating the executive summary from the saved
transcript, then adding adjustable cost-aware teaching segment markers so only
selected teaching sections need to be sent to paid transcription.
