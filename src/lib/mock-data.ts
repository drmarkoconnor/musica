import type {
  Exercise,
  Lesson,
  LessonExtract,
  LessonRecording,
  Piece,
  PieceAsset,
  PracticeSession,
  PracticeTask,
  Recording,
  SessionItem,
  SmartQueueItem,
  Tag,
  Transcript,
} from "./types";
import { leadSheetCatalog, leadSheetPieceId } from "./lead-sheet-catalog";

export const tags: Tag[] = [
  { id: "tag-harmony", name: "harmony", color: "green" },
  { id: "tag-time", name: "time feel", color: "blue" },
  { id: "tag-vocal", name: "vocal", color: "rose" },
  { id: "tag-voicing", name: "voicing", color: "amber" },
  { id: "tag-memory", name: "memory", color: "slate" },
];

const leadSheetPieceOverrides: Record<string, Partial<Piece>> = {
  "autumn-leaves": {
    key: "G minor",
    status: "spine",
    confidence: 4,
    lastPractised: "2026-05-14",
    targetTempo: 132,
    currentTempo: 112,
    isSpineTune: true,
    notes: "Keep the melody plain before adding fills.",
    relatedExerciseIds: ["ex-ii-v-i-12", "ex-root-five-rh-three-seven"],
  },
  "my-funny-valentine": {
    key: "C minor",
    status: "spine",
    confidence: 4,
    lastPractised: "2026-05-15",
    targetTempo: 92,
    currentTempo: 78,
    isSpineTune: true,
    notes: "Vocal phrasing can lead the piano voicings.",
    relatedExerciseIds: ["ex-interval-ear", "ex-minor-scale-reminders"],
  },
};

export const pieces: Piece[] = leadSheetCatalog.map((entry) => {
  const id = leadSheetPieceId(entry.title);
  const override = leadSheetPieceOverrides[id] ?? {};

  return {
    id,
    title: entry.title,
    composer: entry.composer,
    lyricist: entry.lyricist,
    key: entry.key ?? "",
    status: "learning",
    confidence: 3,
    lastPractised: "",
    targetTempo: 0,
    currentTempo: 0,
    spotifyUrl: `https://open.spotify.com/search/${encodeURIComponent(
      `${entry.title} jazz`,
    )}`,
    isSpineTune: false,
    notes: "",
    relatedExerciseIds: [],
    ...override,
  };
});

export const exercises: Exercise[] = [
  {
    id: "ex-root-five-rh-three-seven",
    title: "LH root-5 / RH 3-7 through 12 keys",
    category: "voicing",
    keyFocus: "All keys",
    confidence: 3,
    lastPractised: "2026-05-12",
    targetTempo: 96,
    currentTempo: 72,
    notes: "Keep the left hand relaxed and quiet.",
  },
  {
    id: "ex-ii-v-i-12",
    title: "ii-V-I drills through 12 keys",
    category: "ii-v-i",
    keyFocus: "Cycle of fifths",
    confidence: 3,
    lastPractised: "2026-05-10",
    targetTempo: 120,
    currentTempo: 88,
    notes: "Name guide tones out loud before increasing tempo.",
  },
  {
    id: "ex-minor-scale-reminders",
    title: "Minor scale theory reminders",
    category: "minor_harmony",
    keyFocus: "Natural, harmonic, melodic minor",
    confidence: 2,
    lastPractised: "2026-05-01",
    notes: "Connect each scale to a tune moment.",
  },
  {
    id: "ex-chord-transitions",
    title: "Chord transition drills",
    category: "transition",
    keyFocus: "Close voice-leading",
    confidence: 2,
    lastPractised: "2026-04-29",
    targetTempo: 84,
    currentTempo: 58,
    notes: "Practise tiny moves between dense chords.",
  },
  {
    id: "ex-interval-ear",
    title: "Interval ear-training prompts",
    category: "ear_training",
    keyFocus: "Bass-baritone range",
    confidence: 4,
    lastPractised: "2026-05-16",
    notes: "Sing, play, then sing again without the piano.",
  },
  {
    id: "ex-rhythm-cell",
    title: "Two-bar rhythmic cells",
    category: "rhythm",
    keyFocus: "Comping placement",
    confidence: 3,
    lastPractised: "2026-05-06",
    targetTempo: 132,
    currentTempo: 104,
    notes: "Keep the cell consistent before reharmonising.",
  },
];

export const lessons: Lesson[] = [
  {
    id: "lesson-2026-05-13",
    title: "Leo lesson - voicings and time",
    teacher: "Leo",
    lessonDate: "2026-05-13",
    status: "extracted",
    summary: "Rootless voicing continuity and steadier left-hand time.",
  },
  {
    id: "lesson-2026-05-06",
    title: "Leo lesson - minor harmony",
    teacher: "Leo",
    lessonDate: "2026-05-06",
    status: "transcribed",
    summary: "Minor scale choices over Summertime and My Funny Valentine.",
  },
];

export const lessonRecordings: LessonRecording[] = [
  {
    id: "rec-lesson-0513",
    lessonId: "lesson-2026-05-13",
    title: "Lesson recording",
    storageBucket: "lesson-recordings",
    durationSeconds: 3380,
    recordedAt: "2026-05-13T17:30:00Z",
    storagePath: "lesson-recordings/2026-05-13-leo.m4a",
  },
  {
    id: "rec-lesson-0506",
    lessonId: "lesson-2026-05-06",
    title: "Lesson recording",
    storageBucket: "lesson-recordings",
    durationSeconds: 2920,
    recordedAt: "2026-05-06T17:30:00Z",
    storagePath: "lesson-recordings/2026-05-06-leo.m4a",
  },
];

export const transcripts: Transcript[] = [
  {
    id: "transcript-0513",
    lessonId: "lesson-2026-05-13",
    recordingId: "rec-lesson-0513",
    language: "en",
    status: "complete",
    text: "Leo: keep the left hand very even. Try the bass and melody only before you fill the harmony. At bar 17, use rootless voicings and listen for the common tones.",
  },
  {
    id: "transcript-0506",
    lessonId: "lesson-2026-05-06",
    recordingId: "rec-lesson-0506",
    language: "en",
    status: "complete",
    text: "Leo: when the tune leans minor, name the colour first. Natural minor is not the whole story. Sing the minor sixth and then find it on the piano.",
  },
];

export const lessonExtracts: LessonExtract[] = [
  {
    id: "extract-bass-melody",
    lessonId: "lesson-2026-05-13",
    transcriptId: "transcript-0513",
    title: "Use bass and melody only",
    body: "Strip Autumn Leaves down to bass and melody before adding inner voices.",
    startsAtSeconds: 820,
    endsAtSeconds: 910,
    status: "kept",
    tags: ["tag-memory", "tag-time"],
    linkedPieceId: "autumn-leaves",
  },
  {
    id: "extract-left-hand-time",
    lessonId: "lesson-2026-05-13",
    transcriptId: "transcript-0513",
    title: "Watch the left-hand timing",
    body: "Keep LH root movement quiet and even under vocal phrasing.",
    startsAtSeconds: 1224,
    endsAtSeconds: 1308,
    status: "kept",
    tags: ["tag-time"],
    linkedPieceId: "my-funny-valentine",
    similarExtractId: "task-left-hand-time",
  },
  {
    id: "extract-rootless-voicings",
    lessonId: "lesson-2026-05-13",
    transcriptId: "transcript-0513",
    title: "Try rootless voicings",
    body: "Practise 3-7 guide-tone shells, then add colour notes only when the time is stable.",
    startsAtSeconds: 1840,
    endsAtSeconds: 1965,
    status: "candidate",
    tags: ["tag-harmony", "tag-voicing"],
    linkedExerciseId: "ex-root-five-rh-three-seven",
  },
  {
    id: "extract-minor-colour",
    lessonId: "lesson-2026-05-06",
    transcriptId: "transcript-0506",
    title: "Important minor harmony concept",
    body: "Name the minor colour before choosing a scale over My Funny Valentine.",
    startsAtSeconds: 1030,
    endsAtSeconds: 1120,
    status: "candidate",
    tags: ["tag-harmony", "tag-vocal"],
    linkedPieceId: "my-funny-valentine",
    linkedExerciseId: "ex-minor-scale-reminders",
  },
];

export const practiceTasks: PracticeTask[] = [
  {
    id: "task-bass-melody",
    title: "Autumn Leaves: bass and melody only",
    body: "Play one chorus with no inner voices, then sing the melody while keeping bass motion clear.",
    source: "lesson",
    sourceLessonId: "lesson-2026-05-13",
    sourceExtractId: "extract-bass-melody",
    linkedPieceId: "autumn-leaves",
    linkedRecordingId: "rec-lesson-0513",
    startsAtSeconds: 820,
    endsAtSeconds: 910,
    tags: ["tag-memory", "tag-time"],
    status: "active",
    resurfacingScore: 88,
    createdAt: "2026-05-13T19:10:00Z",
  },
  {
    id: "task-left-hand-time",
    title: "Left-hand timing under vocal line",
    body: "Practise My Funny Valentine with left hand softer and later fills.",
    source: "lesson",
    sourceLessonId: "lesson-2026-05-13",
    sourceExtractId: "extract-left-hand-time",
    linkedPieceId: "my-funny-valentine",
    linkedRecordingId: "rec-lesson-0513",
    startsAtSeconds: 1224,
    endsAtSeconds: 1308,
    tags: ["tag-time", "tag-vocal"],
    status: "new",
    resurfacingScore: 81,
    createdAt: "2026-05-13T19:12:00Z",
  },
  {
    id: "task-ii-v-i",
    title: "ii-V-I guide tones in all keys",
    body: "Say 3 and 7 before playing. Keep the line connected through the cycle.",
    source: "manual",
    linkedExerciseId: "ex-ii-v-i-12",
    tags: ["tag-harmony", "tag-voicing"],
    status: "active",
    resurfacingScore: 76,
    createdAt: "2026-05-02T10:00:00Z",
  },
];

export const pieceAssets: PieceAsset[] = [
  {
    id: "asset-autumn-leaves-chart",
    pieceId: "autumn-leaves",
    title: "Autumn Leaves lead sheet",
    type: "lead_sheet_pdf",
    versionLabel: "clean",
    uploadedAt: "2026-05-01",
    storageBucket: "local-docs",
    storagePath: "docs/leadsheets/Autumn Leaves - Joseph Kosma.pdf",
  },
  {
    id: "asset-my-funny-valentine-annotated",
    pieceId: "my-funny-valentine",
    title: "My Funny Valentine annotated chart",
    type: "annotated_version",
    versionLabel: "Leo bridge notes",
    uploadedAt: "2026-05-13",
    storageBucket: "piece-assets",
    storagePath: "piece-assets/my-funny-valentine-annotated.jpg",
  },
];

export const practiceSessions: PracticeSession[] = [
  {
    id: "session-2026-05-17",
    startedAt: "2026-05-17T09:00:00Z",
    notes: "Static mock session for the first build.",
  },
];

export const sessionItems: SessionItem[] = [
  {
    id: "session-item-1",
    sessionId: "session-2026-05-17",
    position: 1,
    title: "LH root-5 / RH 3-7 through 12 keys",
    reason: "Warm-up rotation",
    status: "accepted",
    exerciseId: "ex-root-five-rh-three-seven",
    plannedMinutes: 10,
    confidenceBefore: 3,
    tempo: 72,
  },
  {
    id: "session-item-2",
    sessionId: "session-2026-05-17",
    position: 2,
    title: "Autumn Leaves",
    reason: "Spine tune, 14 days since practice",
    status: "queued",
    pieceId: "autumn-leaves",
    plannedMinutes: 18,
    confidenceBefore: 3,
    tempo: 58,
  },
  {
    id: "session-item-3",
    sessionId: "session-2026-05-17",
    position: 3,
    title: "Autumn Leaves: bass and melody only",
    reason: "New from lesson",
    status: "queued",
    practiceTaskId: "task-bass-melody",
    pieceId: "autumn-leaves",
    plannedMinutes: 12,
    confidenceBefore: 3,
  },
];

export const recordings: Recording[] = [
  {
    id: "recording-lesson-0513",
    kind: "lesson",
    title: "Leo lesson - 13 May",
    durationSeconds: 3380,
    recordedAt: "2026-05-13T17:30:00Z",
    storagePath: "lesson-recordings/2026-05-13-leo.m4a",
    lessonId: "lesson-2026-05-13",
  },
  {
    id: "recording-practice-autumn",
    kind: "practice",
    title: "Autumn Leaves slow chorus",
    durationSeconds: 420,
    recordedAt: "2026-05-03T09:20:00Z",
    storagePath: "practice-recordings/autumn-leaves-slow.m4a",
    pieceId: "autumn-leaves",
    practiceSessionId: "session-2026-05-17",
    spokenNote: "Still rushing the resolution into the second A.",
  },
  {
    id: "recording-voice-note",
    kind: "voice_note",
    title: "Future note about My Funny Valentine",
    durationSeconds: 58,
    recordedAt: "2026-05-13T20:10:00Z",
    storagePath: "practice-recordings/my-funny-valentine-note.m4a",
    pieceId: "my-funny-valentine",
    practiceTaskId: "task-bass-melody",
    spokenNote:
      "Finding this difficult today. Curious whether next June it will feel easy.",
  },
];

export const smartQueue: SmartQueueItem[] = [
  {
    id: "queue-warmup",
    title: "LH root-5 / RH 3-7 through 12 keys",
    kind: "exercise",
    reason: "Warm-up rotation",
    minutes: 10,
    confidence: 3,
    exerciseId: "ex-root-five-rh-three-seven",
  },
  {
    id: "queue-autumn-leaves",
    title: "Autumn Leaves",
    kind: "piece",
    reason: "Spine tune, 14 days since practice",
    minutes: 18,
    confidence: 3,
    pieceId: "autumn-leaves",
  },
  {
    id: "queue-autumn-leaves-task",
    title: "Autumn Leaves: bass and melody only",
    kind: "lesson_task",
    reason: "New from lesson",
    minutes: 12,
    confidence: 3,
    taskId: "task-bass-melody",
    pieceId: "autumn-leaves",
  },
];

export function formatDuration(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function findPiece(pieceId: string) {
  return pieces.find((piece) => piece.id === pieceId);
}

export function findExercise(exerciseId: string) {
  return exercises.find((exercise) => exercise.id === exerciseId);
}
