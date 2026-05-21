# Lesson Recording Import Plan

Last updated: 2026-05-21

## Current Finding

Mark has added a private local source folder named `lessonrecordings/`.
It should be treated as a source archive, not as repository content.

Quick audit:

- 35 `.m4a` files.
- About 549 MB total.
- About 35.8 hours of audio.
- Average lesson length is about 61 minutes.
- One very short file is about 3.5 minutes.
- The longest file is about 127 minutes.
- There are 4 exact duplicate pairs by SHA-256 hash.
- The embedded M4A `creation_time` metadata is more reliable than every
  filename, so import should prefer embedded metadata for lesson dates.

## Recommended Model

Do not store real audio bytes in Neon or GitHub.

Use the existing model:

- `lessons` stores the lesson date, teacher, title, status, and eventual
  summary.
- `lesson_recordings` stores private storage metadata, duration, recorded time,
  and notes.
- Object storage stores the audio bytes.
- `lesson_segments`, `transcripts`, `lesson_segment_transcripts`,
  `lesson_extracts`, and `practice_tasks` continue to handle the valuable
  lesson-memory workflow after Mark chooses useful clips.

For the hosted app, the best v1 storage target is the existing private
Netlify Blobs `lesson-recordings` store. For local-only testing, a gitignored
local folder can work, but local-only rows in Neon will not be playable or
transcribable from the hosted Netlify app.

## Import Pipeline

1. Keep `lessonrecordings/` ignored by git.
2. Run a dry-run audit over the folder:
   - read duration with `ffprobe`;
   - read embedded `creation_time`;
   - calculate SHA-256;
   - mark exact duplicates;
   - produce a local manifest for review.
3. Import only non-duplicate recordings:
   - upload audio to Netlify Blobs with opaque/sanitised keys;
   - insert one `lessons` row per lesson date/time;
   - insert one `lesson_recordings` row pointing at the blob;
   - set lesson status to `recorded`;
   - keep original filename/hash only in private DB notes or a local manifest,
     not in committed docs.
4. Do not transcribe during import.
5. Review each imported lesson in `/lessons`, create useful teaching clips, and
   use the existing passworded transcription flow on selected clips.
6. Keep/discard generated candidates in `/lessons` and `/from-lessons` so only
   Mark-approved ideas become practice-list work.

## Why Not Full Auto-Transcribe

The archive is too valuable and too large to process indiscriminately. Full
archive transcription would spend money, capture social/non-teaching audio, and
create too much review noise.

The app's purpose is better served by importing the recordings as searchable,
playable lesson memory first, then extracting practice ideas from selected
clips. A later batch mode can transcribe whole lessons only after an explicit
cost/time confirmation.

## Suggested Next Implementation

Implemented:

```bash
npm run lessons:import-recordings -- --source lessonrecordings --dry-run
npm run lessons:import-recordings -- --source lessonrecordings --write
```

The script should be idempotent and conservative:

- default to dry-run;
- refuse to run without `DATABASE_URL`;
- require Netlify Blob credentials for hosted storage import;
- skip exact duplicate hashes within the import set;
- skip recordings already present with the same storage target;
- never call transcription APIs;
- print a clear summary of imported, skipped, duplicate, and failed files.

Current import status:

- `npm run lessons:import-recordings -- --source lessonrecordings --dry-run`
  succeeds.
- `npm run lessons:import-recordings -- --source lessonrecordings --write`
  completed successfully.
- 31 non-duplicate recordings were uploaded to Netlify Blobs and inserted into
  Neon as lessons plus lesson recordings.
- 4 exact duplicate audio files were skipped.
- No transcription was run.

No database migration is required for the first pass. If imports become a
recurring workflow, add structured import bookkeeping later, such as
`import_batches`, `source_file_hash`, `source_file_size_bytes`, and
`original_recording_name`.
