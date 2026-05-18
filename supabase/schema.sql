-- Practice Loop proposed Supabase schema for the private v1 MVP.
-- The app is private in v1: no billing, public accounts, quotas, or Stripe tables.
-- Transcription should be triggered only by server code after password validation.

create extension if not exists pgcrypto;

create type lesson_status as enum ('draft', 'recorded', 'transcribed', 'extracted');
create type transcript_status as enum ('pending', 'complete', 'failed');
create type extract_status as enum ('candidate', 'kept', 'discarded');
create type practice_source as enum ('lesson', 'manual', 'generated');
create type practice_status as enum ('new', 'active', 'parked', 'mastered');
create type piece_status as enum ('spine', 'learning', 'maintenance', 'parked');
create type asset_type as enum ('lead_sheet_pdf', 'lead_sheet_image', 'annotated_version');
create type recording_kind as enum ('lesson', 'practice', 'voice_note');
create type session_item_status as enum ('queued', 'accepted', 'skipped', 'replaced', 'done');
create type exercise_category as enum (
  'voicing',
  'ii-v-i',
  'minor_harmony',
  'transition',
  'ear_training',
  'rhythm'
);

create table lessons (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  teacher text,
  lesson_date date not null,
  status lesson_status not null default 'draft',
  summary text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table lesson_recordings (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references lessons(id) on delete cascade,
  title text not null default 'Lesson recording',
  storage_bucket text not null default 'lesson-recordings',
  storage_path text not null,
  duration_seconds integer check (duration_seconds is null or duration_seconds > 0),
  recorded_at timestamptz not null default now(),
  notes text,
  created_at timestamptz not null default now()
);

create table transcripts (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references lessons(id) on delete cascade,
  recording_id uuid not null references lesson_recordings(id) on delete cascade,
  language text not null default 'en' check (language in ('en', 'it')),
  status transcript_status not null default 'pending',
  text text,
  model text,
  requested_at timestamptz,
  completed_at timestamptz,
  error_message text,
  created_at timestamptz not null default now()
);

create table pieces (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  composer text,
  lyricist text,
  musical_key text,
  status piece_status not null default 'learning',
  confidence integer not null default 3 check (confidence between 1 and 5),
  last_practised_on date,
  target_tempo integer check (target_tempo is null or target_tempo > 0),
  current_tempo integer check (current_tempo is null or current_tempo > 0),
  spotify_url text,
  is_spine_tune boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table exercises (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category exercise_category not null,
  key_focus text,
  confidence integer not null default 3 check (confidence between 1 and 5),
  last_practised_on date,
  target_tempo integer check (target_tempo is null or target_tempo > 0),
  current_tempo integer check (current_tempo is null or current_tempo > 0),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table lesson_extracts (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references lessons(id) on delete cascade,
  transcript_id uuid references transcripts(id) on delete set null,
  title text not null,
  body text,
  starts_at_seconds integer not null check (starts_at_seconds >= 0),
  ends_at_seconds integer check (ends_at_seconds is null or ends_at_seconds >= starts_at_seconds),
  status extract_status not null default 'candidate',
  linked_piece_id uuid references pieces(id) on delete set null,
  linked_exercise_id uuid references exercises(id) on delete set null,
  similar_extract_id uuid references lesson_extracts(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table practice_tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text,
  source practice_source not null default 'manual',
  source_lesson_id uuid references lessons(id) on delete set null,
  source_extract_id uuid references lesson_extracts(id) on delete set null,
  linked_piece_id uuid references pieces(id) on delete set null,
  linked_exercise_id uuid references exercises(id) on delete set null,
  linked_recording_id uuid references lesson_recordings(id) on delete set null,
  starts_at_seconds integer check (starts_at_seconds is null or starts_at_seconds >= 0),
  ends_at_seconds integer check (ends_at_seconds is null or starts_at_seconds is null or ends_at_seconds >= starts_at_seconds),
  status practice_status not null default 'new',
  importance integer not null default 3 check (importance between 1 and 5),
  resurfacing_score numeric(6, 2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table piece_assets (
  id uuid primary key default gen_random_uuid(),
  piece_id uuid not null references pieces(id) on delete cascade,
  title text not null,
  asset_type asset_type not null,
  version_label text,
  storage_bucket text not null default 'piece-assets',
  storage_path text not null,
  uploaded_at timestamptz not null default now()
);

create table practice_sessions (
  id uuid primary key default gen_random_uuid(),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  notes text,
  created_at timestamptz not null default now()
);

create table session_items (
  id uuid primary key default gen_random_uuid(),
  practice_session_id uuid not null references practice_sessions(id) on delete cascade,
  position integer not null,
  title text not null,
  queue_reason text,
  status session_item_status not null default 'queued',
  practice_task_id uuid references practice_tasks(id) on delete set null,
  piece_id uuid references pieces(id) on delete set null,
  exercise_id uuid references exercises(id) on delete set null,
  override_reason text,
  planned_minutes integer check (planned_minutes is null or planned_minutes > 0),
  actual_seconds integer check (actual_seconds is null or actual_seconds >= 0),
  confidence_before integer check (confidence_before is null or confidence_before between 1 and 5),
  confidence_after integer check (confidence_after is null or confidence_after between 1 and 5),
  tempo integer check (tempo is null or tempo > 0),
  notes text
);

create table recordings (
  id uuid primary key default gen_random_uuid(),
  kind recording_kind not null,
  title text not null,
  storage_bucket text not null default 'practice-recordings',
  storage_path text not null,
  duration_seconds integer check (duration_seconds is null or duration_seconds > 0),
  recorded_at timestamptz not null default now(),
  lesson_id uuid references lessons(id) on delete set null,
  practice_session_id uuid references practice_sessions(id) on delete set null,
  piece_id uuid references pieces(id) on delete set null,
  exercise_id uuid references exercises(id) on delete set null,
  practice_task_id uuid references practice_tasks(id) on delete set null,
  spoken_note text,
  created_at timestamptz not null default now()
);

create table exercise_logs (
  id uuid primary key default gen_random_uuid(),
  exercise_id uuid not null references exercises(id) on delete cascade,
  practice_session_id uuid references practice_sessions(id) on delete set null,
  practised_at timestamptz not null default now(),
  musical_key text,
  tempo integer check (tempo is null or tempo > 0),
  confidence integer not null default 3 check (confidence between 1 and 5),
  notes text
);

create table tags (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  color text not null default 'slate',
  created_at timestamptz not null default now()
);

create table practice_task_tags (
  practice_task_id uuid not null references practice_tasks(id) on delete cascade,
  tag_id uuid not null references tags(id) on delete cascade,
  primary key (practice_task_id, tag_id)
);

create table lesson_extract_tags (
  lesson_extract_id uuid not null references lesson_extracts(id) on delete cascade,
  tag_id uuid not null references tags(id) on delete cascade,
  primary key (lesson_extract_id, tag_id)
);

create table piece_tags (
  piece_id uuid not null references pieces(id) on delete cascade,
  tag_id uuid not null references tags(id) on delete cascade,
  primary key (piece_id, tag_id)
);

create table piece_exercises (
  piece_id uuid not null references pieces(id) on delete cascade,
  exercise_id uuid not null references exercises(id) on delete cascade,
  primary key (piece_id, exercise_id)
);

create index lesson_recordings_lesson_id_idx on lesson_recordings(lesson_id);
create index transcripts_lesson_id_idx on transcripts(lesson_id);
create index lesson_extracts_lesson_id_idx on lesson_extracts(lesson_id);
create index practice_tasks_status_idx on practice_tasks(status);
create index practice_tasks_piece_idx on practice_tasks(linked_piece_id);
create index pieces_spine_last_practised_idx on pieces(is_spine_tune, last_practised_on);
create index session_items_session_position_idx on session_items(practice_session_id, position);
create index recordings_piece_idx on recordings(piece_id);
create index recordings_practice_task_idx on recordings(practice_task_id);

-- Storage bucket names expected by the app:
-- lesson-recordings, practice-recordings, piece-assets
--
-- Suggested v1 access pattern:
-- keep buckets private, upload/download through server routes or signed URLs,
-- and enable RLS policies only when authentication is introduced.
--
-- V2 premium transcription can add:
-- auth user ownership columns, transcription usage ledger, Stripe customer tables,
-- server-side duration limits, and admin controls. Those are intentionally absent here.
