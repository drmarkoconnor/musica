# Practice Loop — Product Requirements Document (PRD)

## Version

0.1 — Foundational Personal Build

---

# 1. Product Overview

## Working Title

**Practice Loop**

## Product Type

Private web-based music practice companion focused on:

- jazz piano practice
- lesson capture
- repertoire continuity
- smart resurfacing of neglected material
- musicianship reinforcement
- reflective long-term improvement

The app is primarily designed for a serious adult jazz pianist and singer, not
beginners.

---

# 2. Core Product Vision

The app exists to solve a specific problem:

> Musical insight gained during lessons is quickly forgotten or fragmented
> between practice sessions.

The central workflow is:

```text
Lesson -> Recording -> Transcription -> Extraction -> Practice Task -> Smart Resurfacing -> Long-Term Integration
```

The app should feel:

- calm
- intelligent
- musical
- reflective
- continuity-focused

It should NOT feel like:

- productivity software
- gamified habit tracking
- a children's piano app
- an exam prep app
- a social network

---

# 3. Primary User Goals

The app should help the user:

1. Record lessons easily
2. Capture important practice insights
3. Link ideas directly back to audio examples
4. Maintain continuity between lessons
5. Strengthen memory of core repertoire (“spine tunes”)
6. Practise warm-ups and harmonic drills consistently
7. Avoid neglecting older material
8. Track long-term development through recordings
9. Structure practice sessions intelligently
10. Reinforce jazz harmony and interval awareness

---

# 4. Product Philosophy

## Guiding Principles

### 4.1 Continuity Over Productivity

The app should preserve musical continuity between lessons and practice.

### 4.2 Support, Not Judgement

The app should structure and remind rather than evaluate harshly.

### 4.3 Reflection Matters

Voice notes, lesson memories and longitudinal recordings are important.

### 4.4 Minimal Friction

One-button recording and quick capture workflows are essential.

### 4.5 Smart Resurfacing

The app should gently reintroduce neglected material.

### 4.6 Calm UX

Avoid noisy dashboards, excessive metrics or intrusive reminders.

---

# 5. Target Devices

## Primary

- tablet landscape mode

## Secondary

- mobile portrait
- desktop browser

The UI should be responsive and mobile-friendly from the start.

---

# 6. Technology Stack

## Frontend

- Next.js
- TypeScript
- Tailwind CSS

## Backend

- Supabase Postgres
- Supabase Storage

## AI Services

- Whisper/OpenAI transcription API (later phase)

## Deployment

- Netlify or Vercel

---

# 7. MVP Core Features

---

# 7.1 Dashboard

## Purpose

Main entry point for daily use.

## Key Components

### Large Primary Actions

- Start Lesson Recording
- Start Practice Session

### Smart Queue Preview

Suggested practice items based on:

- neglected material
- confidence ratings
- lesson-derived tasks
- spine tunes
- warm-up scheduling

### Recent Lesson Extracts

Quick access to recently saved lesson ideas.

### Neglected Repertoire Alerts

Gentle nudges:

> “Lotus Blossom has not been practised in 12 days.”

---

# 7.2 Lesson Recording System

## Purpose

Capture lessons and transform them into actionable practice material.

## Workflow

### Step 1

Record or upload lesson audio.

### Step 2

Store recording.

### Step 3

Select teaching segments for transcription. The full lesson recording may
include social chat, setup time, and breaks, so the app should avoid sending the
entire file by default.

### Step 4

Transcribe lesson segments (password protected).

### Step 5

Extract candidate practice ideas.

### Step 6

User accepts/rejects/edit items.

### Step 7

Saved items become resurfacing practice material.

## Cost-Aware Teaching Capture

The app should support a full lesson recording plus explicit teaching markers.
This keeps the archive complete while only sending useful sections for paid AI
processing.

Expected controls:

- Start lesson recording
- Teaching started
- Teaching stopped
- Undo last teaching marker
- Review selected teaching segments before transcription

Default segment timing should be configurable. The first practical defaults are:

- When Teaching started is pressed, include the previous 30 seconds.
- When Teaching stopped is pressed, trim the final 10 seconds by default.
- Let Mark adjust these defaults later.

These numbers are not musically special. They are only a starting guardrail to
reduce pressure during the lesson. The app should eventually support more
nuanced segment editing after the lesson.

Post-lesson review:

- Mark can listen back after the lesson and adjust selected teaching segments.
- The review screen should make it easy to split, extend, trim, merge, or discard
  segments before paid transcription.
- This may take real listening time, possibly close to a 1:1 ratio for a full
  lesson, but it is still useful when the lesson contains a lot of social chat or
  setup time.
- The system should show how many minutes are selected for transcription before
  authorisation.

Important behaviour:

- Preserve original lesson timestamps, even when only segments are transcribed.
- Allow multiple teaching segments per lesson.
- Transcribe only selected teaching segments unless Mark explicitly chooses the
  full recording.
- Keep the original full recording playable for memory and context.
- Show estimated selected minutes before password authorisation.
- Show the transcript as an executive-summary card with reviewable bullet
  points, rather than only a long block of prose.
- Each bullet should have a compact listen-to-clip control beside it.
- A bullet is first a point of interest from the lesson, not automatically a
  prescribed exercise.
- Some bullets may suggest a possible follow-up practice note, but Mark chooses
  manually whether to save it.
- Saved follow-up notes link back to the exact audio segment.
- Mark can leave a bullet as context only, discard it, or turn it into a
  lesson-derived practice note.

---

# 7.3 Lesson Transcription

## Important Constraint

Transcription costs money.

Therefore:

- recordings are freely playable
- transcription requires password authorisation
- only selected teaching segments should be sent by default
- the full recording can be sent only after an explicit confirmation

## Requirements

### Protected Action

User presses:

> “Transcribe Lesson”

Then:

- password modal appears
- password validated server-side
- only then transcription begins

## Security Requirements

- API keys never exposed to browser
- password stored server-side only
- transcription routes protected

---

# 7.4 Lesson Extraction Engine

## Purpose

Pull useful practice instructions from transcripts.

## Example Extracts

- “Practise this in twelve keys”
- “Use bass and melody only”
- “Watch the left-hand timing”
- “Try rootless voicings”
- “Important minor harmony concept”

## User Interaction

Each extracted item can be:

- kept
- discarded
- edited
- tagged
- attached to repertoire
- linked to exercises

## Audio Linking

Each extract links back to the exact lesson timestamp.

---

# 7.5 From Lessons Area

## Purpose

Persistent musical knowledge base derived from lessons.

## Structure

Each item contains:

- title
- source lesson
- timestamp
- linked audio clip
- tags
- associated tune/exercise
- status
- notes

## Status Values

- new
- active
- parked
- mastered

## Duplicate Detection

System should warn about near-duplicate concepts.

---

# 7.6 Practice Sessions

## Purpose

Guide daily practice intelligently.

## Workflow

### Start Session

User receives smart queue suggestions.

### User Actions

- accept
- skip
- replace
- add manually

### Tracking

The app tracks:

- overrides
- frequency
- tempo
- confidence
- time spent

---

# 7.7 Repertoire Library

## Purpose

Track core tunes and long-term memory development.

## Core Concept

“Spine tunes” form the centre of practice.

## Initial Scale

- 10 current spine tunes
- eventual target: 30+

## Tune Data

Each piece includes:

- title
- key
- lead sheet
- Spotify link
- confidence rating
- target tempo
- comfortable tempo
- recordings
- lesson links
- associated exercises
- practice history

---

# 7.8 Lead Sheet Support

## Version 1 Scope

Simple support only.

## Features

- upload PDF/image
- pop-up viewer
- optional replacement upload
- simple annotations later

## Non-Goals

- advanced annotation engine
- pedal page turns
- complex score management

---

# 7.9 Warm-Up and Exercise System

## Exercise Types

- LH root–5 / RH 3–7 drills
- ii–V–I practice
- minor scale reminders
- interval drills
- chord transition drills
- rhythmic cells
- voicing exercises

## Exercise Metadata

- key
- tempo
- confidence
- related tunes
- last practised

---

# 7.10 Metronome

## Requirements

- large BPM display
- tap tempo
- click sounds
- start/stop
- save tempo progress

---

# 7.11 Recording System

## Types of Recording

### Lesson Recordings

Primary use case.

### Practice Recordings

Attached to:

- tune
- exercise
- session
- lesson idea

### Reflective Voice Notes

Example:

> “Finding this difficult today. Curious whether next June it will feel easy.”

---

# 7.12 Analytics

## Useful Metrics Only

### Include

- time per piece
- review frequency
- tempo progress
- neglected material
- session distribution

### Avoid

- streak obsession
- guilt-inducing metrics
- aggressive gamification

---

# 8. Smart Queue Logic

## Queue Inputs

- last practised date
- confidence
- lesson importance
- neglected status
- spine tune weighting
- exercise rotation
- overdue review intervals

## Behaviour

Queue should gently challenge user tendencies to over-practise favourites.

---

# 9. Musicianship Features

## Priority Areas

### High Priority

- interval recognition
- harmonic understanding
- jazz harmony
- scale reminders
- chord generation drills

### Low Priority

- advanced sight reading

---

# 10. Singing Support

## Vocal Requirements

Focus on:

- interval work
- bass-baritone range
- quick recording
- reference playback

---

# 11. Internationalisation

## Languages

- English
- Italian

## Purpose

Partly included as a gesture of respect toward the teacher.

## Scope

Translate:

- UI labels
- navigation
- workflow text

Do not auto-translate user notes in MVP.

---

# 12. UX Style

## Desired Feel

- elegant
- uncluttered
- reflective
- warm
- focused

## Avoid

- neon gamification
- cluttered analytics
- noisy dashboards
- productivity-app aesthetics

---

# 13. Database Concepts

## Main Entities

- lessons
- recordings
- transcripts
- lesson extracts
- practice ideas
- practice sessions
- repertoire pieces
- exercises
- tags

---

# 14. Key Abstraction: PracticeIdea

Many concepts blur together:

- exercises
- reminders
- insights
- voicing ideas
- rhythmic prompts
- teacher comments

Therefore create a unified model:

```ts
type PracticeIdea = {
	id: string
	title: string
	source: 'lesson' | 'manual' | 'generated'
	linkedPiece?: string
	linkedAudioClip?: string
	tags: string[]
	status: 'new' | 'active' | 'parked' | 'mastered'
	resurfacingScore: number
	createdAt: Date
}
```

---

# 15. Future Version 2 Ideas

## Possible Premium Features

- paid transcription credits
- user accounts
- Stripe billing
- free trial transcription
- quota system
- AI-assisted extraction refinement
- MIDI support
- automatic harmonic detection
- advanced annotation
- collaborative teacher sharing

## Important

Do NOT build these in MVP.

---

# 16. Build Strategy

## Phase 1

Static mocked UI only.

## Phase 2

Core data model + Supabase.

## Phase 3

Practice sessions.

## Phase 4

Lesson recording.

## Phase 5

Transcription + extraction.

## Phase 6

Advanced drill systems.

---

# 17. MVP Success Criteria

The MVP succeeds if the user can:

1. Record a lesson quickly
2. Extract useful ideas from it
3. Resurface those ideas intelligently later
4. Maintain continuity between lessons
5. Strengthen memory of core repertoire
6. Reflect meaningfully on progress over time

---

# 18. Final Product Identity

This app is fundamentally:

> A continuity engine for musical thought.

Not merely a timer, tracker or educational platform.

It exists to preserve and reactivate musical insight over time.
