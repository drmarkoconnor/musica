import type {
  Exercise,
  Lesson,
  LessonExtract,
  LessonRecording,
  LessonSegment,
  LessonSegmentTranscript,
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

export const lessons: Lesson[] = [];

export const lessonRecordings: LessonRecording[] = [];

export const lessonSegments: LessonSegment[] = [];

export const lessonSegmentTranscripts: LessonSegmentTranscript[] = [];

export const transcripts: Transcript[] = [];

export const lessonExtracts: LessonExtract[] = [];

export const practiceTasks: PracticeTask[] = [
  {
    id: "task-ii-v-i",
    title: "ii-V-I guide tones in all keys",
    body: "Say 3 and 7 before playing. Keep the line connected through the cycle.",
    source: "manual",
    linkedExerciseId: "ex-ii-v-i-12",
    tags: ["tag-harmony", "tag-voicing"],
    status: "active",
    confidence: 3,
    importance: 4,
    lastPractised: "2026-05-04",
    targetFrequencyDays: 7,
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
    notes: "Local mock session for exercising the practice screen.",
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
    actualSeconds: 0,
    confidenceBefore: 3,
    tempo: 72,
    notes: "",
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
    actualSeconds: 0,
    confidenceBefore: 3,
    tempo: 58,
    notes: "",
  },
];

export const recordings: Recording[] = [
  {
    id: "recording-practice-autumn",
    kind: "practice",
    title: "Autumn Leaves slow chorus",
    durationSeconds: 420,
    recordedAt: "2026-05-03T09:20:00Z",
    storageBucket: "local-practice-audio",
    storagePath: "practice-recordings/autumn-leaves-slow.m4a",
    pieceId: "autumn-leaves",
    practiceSessionId: "session-2026-05-17",
    sessionItemId: "session-item-2",
    spokenNote: "Still rushing the resolution into the second A.",
  },
  {
    id: "recording-voice-note",
    kind: "voice_note",
    title: "Future note about My Funny Valentine",
    durationSeconds: 58,
    recordedAt: "2026-05-13T20:10:00Z",
    storageBucket: "local-practice-audio",
    storagePath: "practice-recordings/my-funny-valentine-note.m4a",
    pieceId: "my-funny-valentine",
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
