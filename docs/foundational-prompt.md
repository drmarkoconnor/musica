You are helping me build a private personal music practice web app called
Practice Loop.

The app is for an advanced amateur jazz pianist and singer. It is not a generic
beginner piano app. The central product idea is a lesson-to-practice loop:

Record a piano lesson -> transcribe the audio -> extract useful practice
instructions -> let the user select/edit the useful items -> save them as
lesson-derived practice tasks -> link each task back to the exact audio
timestamp -> resurface those tasks in future practice sessions.

Tech stack:

- Next.js
- TypeScript
- Tailwind CSS
- Supabase Postgres
- Supabase Storage for audio files and lead sheets
- Online-first
- Tablet-optimised responsive design, also good on mobile
- Calm, uncluttered UI
- No heavy gamification
- No intrusive reminders

Core screens for MVP:

1. Dashboard
   - One large button: Start Lesson Recording
   - One large button: Start Practice Session
   - Smart queue preview
   - Recently extracted lesson items
   - Neglected repertoire warning

2. Lessons
   - Create lesson
   - Record or upload audio
   - Store audio
   - Show transcript when available
   - Show extracted candidate practice items
   - User can keep/discard/edit extracted items
   - Kept items go to “From Lessons”

3. From Lessons
   - Bullet list of selected lesson-derived practice points
   - Each item links to source lesson and audio timestamp
   - Items can be tagged and attached to a piece or exercise
   - Duplicate/similar item warning should be considered

4. Repertoire
   - List of pieces/tunes
   - Fields: title, key, status, confidence, last practised, target tempo,
     current tempo, Spotify link
   - Piece detail page with lead sheet, recordings, lesson notes, related
     exercises

5. Practice Session
   - Smart queue generated from:
     - last practised date
     - confidence rating
     - lesson-derived priorities
     - selected spine tunes
     - overdue exercises
   - User can accept, skip, replace or add items
   - Track overrides
   - During session: timer, metronome placeholder, current item, notes,
     confidence, tempo

6. Assets
   - Upload/view simple lead sheet PDF or image
   - Upload new annotated version rather than complex in-app annotation for MVP

7. Recordings
   - Store lesson recordings and practice recordings
   - Practice recordings can attach to session, piece, exercise, or lesson item
   - User can add spoken notes to future self

Initial data:

- Create seed examples for 10 spine tunes
- Include common jazz practice exercises:
  - LH root-5 / RH 3-7 through 12 keys
  - ii-V-I drills
  - minor scale theory reminders
  - chord transition drills
  - interval ear-training prompts

Database entities:

- lessons
- lesson_recordings
- transcripts
- lesson_extracts
- practice_tasks
- pieces
- piece_assets
- practice_sessions
- session_items
- recordings
- exercises
- exercise_logs
- tags

Important product principles:

- The app should help structure, remember and review, not judge performance.
- It should not nag the user to practise at fixed times.
- It should nudge resurfacing of neglected material.
- It should be especially good at continuity between lessons and daily practice.
- It should make it easy to hear the original teacher instruction again.
- Build progressively. Do not over-engineer the first version.

First task: Create the initial Next.js app structure, core routes, TypeScript
types, and a proposed Supabase schema. Then build static mocked UI screens
before wiring Supabase. Keep components clean and reusable. Additional
requirements:

8. Add bilingual UI support from the start.
   - The app should support English and Italian.
   - Add a simple language toggle on the home page: English | Italiano.
   - Store the selected language in localStorage initially.
   - Use a small translation dictionary file for UI labels.
   - Do not auto-translate user-generated notes in MVP.
   - Translate core labels such as:
     - Start Lesson Recording / Avvia registrazione lezione
     - Start Practice Session / Avvia sessione di studio
     - From Lessons / Dalle lezioni
     - Repertoire / Repertorio
     - Smart Queue / Lista intelligente
     - Practise this / Studia questo
     - Listen to clip / Ascolta il frammento
     - Transcribe Lesson / Trascrivi la lezione

9. Protect transcription behind a password.
   - Users should be able to record, upload and listen to audio recordings.
   - However, sending audio to Whisper/OpenAI transcription must require a
     password.
   - This is because transcription costs money and should only be triggered by
     Mark or by Leo if Mark gives him the password.
   - Add a password modal before transcription starts.
   - Store the password only as an environment variable on the server, never in
     client code.
   - Validate the password through a server-side route or server action.
   - Do not expose the transcription API key to the browser.
   - Failed password attempts should not start transcription.
   - Add a clear UI note: “Transcription uses paid AI processing and requires
     authorisation.”

10. Keep the design friendly to Leo.

- Italian mode is included partly as a mark of respect to the teacher.
- The Italian UI should be simple, warm and practical, not over-formal.
  Commercialisation note:

The first version is a private personal practice app for Mark. Do not build
billing, public user accounts, pricing, quotas, Stripe, or premium feature gates
in v1.

However, design the architecture so that transcription could later become a
premium feature in v2. In v2, possible model:

- one free transcription of up to 15 minutes
- paid credit bundle, e.g. £10 for a defined number of transcription hours
- maximum recording length per transcription, possibly 30 minutes
- user authentication
- transcription usage ledger
- Stripe integration
- admin controls
- hard server-side limits to prevent accidental API spend

For v1, keep transcription password-protected and private.

