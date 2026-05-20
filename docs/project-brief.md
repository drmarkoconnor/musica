# Practice Loop Project Brief

Last updated: 2026-05-20

## Purpose

Practice Loop is a private web app for an advanced amateur jazz pianist and
singer. Its core job is to preserve continuity between lessons and practice:

```text
Lesson recording -> useful clip selection -> authorised transcription -> lesson memory -> optional practice item -> smart resurfacing
```

The app should capture what was discussed and demonstrated in real adult
lessons, then let Mark choose what becomes future practice material. It should
not automatically turn every teaching point into a rigid exercise.

## Product Feel

The app should feel calm, musical, reflective, and useful. It should avoid
gamification, judgemental language, noisy dashboards, and generic productivity
patterns.

Design for:

- tablet landscape as the primary working mode
- phone recording at the piano
- desktop review and editing
- English and Italian labels, with Italian included partly as a practical
  courtesy to Leo

## Primary Workflows

1. Record or upload a lesson.
2. Mark the useful teaching clips and avoid sending social chat to paid AI.
3. Password-authorise transcription.
4. Show a concise lesson summary and hidden raw transcript.
5. Keep, discard, or later edit suggested practice items.
6. Manage a dense practice list that can grow to hundreds of entries.
7. Build a flexible practice session from suggestions plus manual choices.
8. During practice, log what actually happened, record short passages against
   the current item, and optionally rate confidence.
9. Maintain repertoire, lead sheets, recordings, exercises, and history.

## Technology Shape

- Next.js, TypeScript, Tailwind CSS
- Drizzle-owned schema and migrations
- Neon Postgres for metadata
- Netlify deployment
- Netlify Blobs as the current v1 object-storage bridge
- OpenAI transcription and extraction behind a server-side password gate
- Whole-app password gate via `PRACTICE_LOOP_APP_PASSWORD`

The older documents mention Supabase as the initial planned backend. The current
implementation uses Neon plus Netlify Blobs.

## Data Principles

- Neon stores metadata: lessons, segments, transcripts, practice tasks, pieces,
  assets, sessions, session items, recordings, tags, logs.
- Blob/object storage stores private audio and PDF/image bytes.
- The GitHub repo is public, so real recordings, transcripts, secrets, and local
  PDFs must stay out of git.
- App passwords, database URLs, OpenAI keys, and blob tokens live only in local
  or Netlify environment variables.

## Product Principles

- Continuity over productivity.
- Reflection over scoring.
- User approval before lesson points become practice work.
- Smart resurfacing, but gentle.
- One-button capture where possible.
- Cost-aware AI use.
- Raw transcript preserved but hidden by default.
- Audio timestamps and clip links are central, not decorative.

## V1 Non-Goals

- Public signup
- Billing, Stripe, credit ledgers, or quotas
- Social features
- Heavy analytics
- Complex in-browser PDF annotation
- Full AI autonomy over practice assignment

## V2 Directions

- Named users and shared Leo access, possibly with Neon Auth
- User-owned records and stricter server-side ownership checks
- Journal/diary views over lesson memories
- Cloudflare R2 or S3-compatible durable private storage
- Transcription usage ledger and paid transcription bundles if commercialised
- More sophisticated spaced repetition and practice recommendations
