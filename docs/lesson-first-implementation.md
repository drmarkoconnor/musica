# Lesson-first implementation

Implementation branch: `feat/lesson-first-workflow`. This restores the core task:
save a complete music lesson, extract useful teaching with source passages, and
optionally turn a point into practice. It supersedes the earlier clip-first
workflow described in the historical project notes.

## What changes

- The app opens on Lessons. Main navigation is Lessons, Learning points and
  Practice. Repertoire, recordings, archive and activity remain under More.
- File upload creates a new lesson by default. Attaching audio to an existing
  lesson is an explicit choice. Live recording and manual lesson entry remain
  available under the additional capture options.
- File imports and recovered browser recordings share one resumable uploader.
  It sends exact original bytes in 2 MiB requests, checks SHA-256 receipts, and
  retains completed chunks and result IDs across a retry. The upload ceiling is
  512 MiB. This is a byte limit, not a guarantee that every two-hour WAV fits.
- Saved audio uses immutable chunks and a manifest in the existing Netlify
  Blobs store. Finalisation retries reuse deterministic lesson/recording IDs.
  A metadata failure does not discard the uploaded source.
- New recording playback reads only the chunks intersecting the requested
  byte range, with a bounded 2 MiB response. Existing single-blob recordings
  remain compatible but still require a full object fetch when seeking because
  the installed Blobs SDK does not provide byte-range retrieval.
- Whole-recording analysis is the default, including when selected clips exist.
  Recordings up to two hours are supported. Missing duration is probed with
  FFmpeg in the background worker, then divided into passages of at most three
  minutes. The original recording is retained unchanged.
- Transcription and extraction have separate durable state. A failed extraction
  leaves the completed transcript available. Retries reuse completed chunks and
  cached analysis, with job identity and leases guarding repeated requests.
- Learning points are independent records, with teaching, practice, repertoire
  and decision kinds. Keeping a point does not create homework. Users can edit,
  dismiss, restore, search and filter points, or explicitly create a practice
  task. Existing edited/kept content and unrelated candidates are preserved.
- Source links identify the supporting transcript passage. They are labelled
  approximate: the app does not claim a precise sentence timestamp from a
  three-minute transcript chunk. Invalid evidence references and invented
  quotations fail validation instead of silently becoming successful results.

The existing Neon Postgres/Drizzle database and Netlify Blobs storage are retained.
No new database provider, AI model or paid subscription is required by this code
change. Current hosting limits and costs still need checking for the actual
account before production rollout.

## Reconciliation with the Mac checkout

The supplied August edits have been preserved and merged. Their local-storage
selection fix prevents Netlify credentials alone from forcing local uploads into
Blobs. Their device-copy MIME normalisation and advanced clip editor remain.
The latter is under the optional clip tools so the main lesson-first flow stays
simple. All recorder recovery protection and the resumable upload path remain
in place. The iPad native picker that could launch video capture is removed.

The downloadable `musica-reconciled-update.patch` is an incremental update from
the exact Mac state Mark supplied, not a patch from clean `main`. Run it from
`markoconnorai/musica`, with the downloaded patch saved in Downloads:

```bash
git apply --check "$HOME/Downloads/musica-reconciled-update.patch" && git apply "$HOME/Downloads/musica-reconciled-update.patch"
npm ci
npm run typecheck
```

If the check fails, keep the error for review; do not force application or use
`--reject`. The patch does not change Git history, local environment files,
recordings or the untracked presentations directory. The pre-existing edits
remain part of the working tree, combined with this implementation. Database
migration and hosted acceptance are separate steps described below; applying
the patch does not perform either.

### Mac installation progress — 13 September 2026

Mark applied the reconciled patch, installed dependencies and passed TypeScript.
He subsequently ran migration 0007 against his configured Neon database. Although
Drizzle returned without its usual success message, the read-only follow-up
reported eight recorded migrations and the learning-points table present. This
confirms the migration is applied. No further migration is needed on that database.

The initial install reported 18 dependency vulnerabilities. Compatible maintenance
updates are prepared for Next.js 16.3.3 and Netlify Blobs 10.7.13, with a refresh of
the transitive `baseline-browser-mapping` dependency. To install these updates on
the Mac without downloading another patch:

```bash
npm install --save-exact next@16.3.3 @netlify/blobs@10.7.13 &&
npm update baseline-browser-mapping &&
npm run typecheck &&
npm run dev
```

Open the Local URL printed by Next.js. The first functional check is importing a
complete lesson, seeking near its end and analysing the full recording. Local
uploads use local audio storage by default, so this does not validate Netlify's
hosted upload path. The existing transcription password gate still authorises
paid processing.

## Database and deployment order

The new application requires `drizzle/0007_lesson_learning_points.sql`. It adds
`learning_points`, analysis stage/cache/lease fields, stable request keys and
source identifiers. It also marks historical jobs that completed with analysis
errors as retryable failures. It does not delete existing lessons, transcripts,
recordings, practice tasks or extracts.

1. Create an isolated database branch or test database, and point the preview's
   `DATABASE_URL` at it. Use separate test audio storage or a separate Netlify
   test site. Do not assume a deploy preview isolates production data for you.
2. Install dependencies normally with `npm ci`; the FFmpeg install script must
   run. Use `FFMPEG_PATH` only when intentionally supplying another binary.
3. Review the migration, then run `npm run db:migrate` against that isolated
   database before opening the new application with Neon enabled. Do not use
   `db:push` as a substitute for the checked-in migration history.
4. Configure the existing server-side database, storage, private app gate,
   transcription authorisation and OpenAI settings for the preview. Netlify
   provides the deployment URL for background continuation; the dispatcher
   targets the current deployment when available. Never copy secret values into
   a PR, client bundle or report.
5. Complete the hosted acceptance checks below. Before production, take the
   normal database recovery checkpoint, apply migration 0007 to production,
   then deploy the reviewed application. Pause analysis while changing worker
   versions so an older worker cannot complete a new job with older semantics.

Implementation testing used an isolated database. Mark subsequently applied the
migration to his configured Neon database as recorded above; no production code
deployment has been performed. An automatically created Git deploy preview may
fail until its own database has the new migration and its required server settings.

For rollback, stop new analysis requests and roll back the application deployment.
Keep the additive migration and saved source data while diagnosing the issue;
do not drop new tables or delete audio to revert the interface. Earlier code
does not display the new learning-point records.

## Verification

```bash
npm test
npm run test:relocation
npm run typecheck
npm run build
```

The Node tests exercise the actual migration journal and application SQL in an
isolated in-memory PostgreSQL engine, with a test-only Neon HTTP adapter. They
block external fetches and use no live database or inference service. They cover
lost responses, partial metadata persistence, repeated/interleaved finalisation,
job creation and retry identity, failed analysis publication, preservation of
edits and source evidence, and idempotent practice creation. Storage/transport
tests verify byte equality, bounded requests, reconnection and selective seeks.
Recorder tests verify ordered bytes and recovery integrity. These tests do not
reproduce distributed database lock scheduling or Netlify's production network.

### Hosted acceptance before merge/deploy

Use a disposable test recording and the isolated preview first:

1. Import a 60–90 minute M4A or MP3, including one larger than 25 MiB. Confirm
   one new lesson and one recording are created. Interrupt the network midway,
   reselect the same file, and confirm acknowledged chunks are reused.
2. Seek near the start, across a chunk boundary, and near the end in Chrome and
   Safari. Confirm duration and playback. Large media requires a Range request;
   arbitrary non-range full-file downloads are not provided by this endpoint.
3. Analyse the full recording with and without pre-existing selected clips.
   Verify teaching points cover the entire lesson and replay the correct source
   passages. Test a recording without browser-readable duration.
4. Refresh or close the browser after processing starts, then return and verify
   saved progress. Exercise an extraction failure/retry without transcribing
   again or losing kept edits. Check background continuation and actual costs.
5. Keep an insight with no practice action, edit it, dismiss/restore another,
   and create a practice task twice to confirm only one task is linked.
6. Record a short live lesson; test failed upload, browser-draft recovery and
   downloading a rescue copy. Check microphone permissions on the actual device.

An hour-long hosted upload and paid model run remain acceptance checks; local
tests and synthetic browser fixtures are not evidence that these passed on
Mark's Netlify account.

Browser review covered the compiled app at desktop width, plus 390 px phone and
768 px tablet layouts in a temporary responsive harness. It checked the empty
lesson screen, a clearly labelled synthetic lesson, learning-point search and
editing controls, and the native create-lesson dialog's initial focus. The
synthetic records and harness were removed after review. Audio playback and
database-backed UI mutations were not claimed from those visual fixtures.

## Local folder organisation

Mark completed the move in Finder and confirmed the new Git root on 13 September
2026. His uncommitted edits were supplied as `musica-local-changes.patch` against
baseline `36dc83a8977189b3bbdfad3c9a5679f0eb7dcbeb` and preserved in a separate local
commit before reconciliation. His untracked `public/presentations/` directory
was not included in that patch and is not touched by this implementation.

See [mac-folder-relocation.md](mac-folder-relocation.md). The supplied helper
moves the complete existing checkout, including local notes and recordings, from
`markoconnorai` into `markoconnorai/musica`, leaving the parent free for sibling
projects. Its default operation is a dry run. This remote implementation has
not moved the Mac folder. The move preserves the Git repository root, so it
does not require changing Netlify's repository-relative build directory.
