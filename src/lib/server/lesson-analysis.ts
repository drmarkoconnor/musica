import OpenAI from "openai";
import { serverEnv } from "@/lib/server/env";

export const DEFAULT_LESSON_ANALYSIS_MODEL =
  serverEnv("OPENAI_LESSON_ANALYSIS_MODEL") || "gpt-4o-mini";

export type LessonAnalysisBullet = {
  body: string;
  endsAtSeconds?: number;
  startsAtSeconds: number;
  title: string;
};

export type LessonPracticeCandidate = LessonAnalysisBullet & {
  segmentId?: string;
  suggestedPracticeNote: string;
};

export type LessonSegmentAnalysisInput = {
  endsAtSeconds: number;
  notes?: string;
  segmentId: string;
  startsAtSeconds: number;
  title: string;
  transcriptText: string;
};

export type LessonSegmentMemory = LessonAnalysisBullet & {
  practiceCandidates: LessonPracticeCandidate[];
  segmentId: string;
};

export type LessonAnalysisResult = {
  overallSummary: string;
  practiceCandidates: LessonPracticeCandidate[];
  summaryBullets: LessonAnalysisBullet[];
};

export type SegmentedLessonAnalysisResult = LessonAnalysisResult & {
  segmentMemories: LessonSegmentMemory[];
};

const EMPTY_ANALYSIS: LessonAnalysisResult = {
  overallSummary: "",
  practiceCandidates: [],
  summaryBullets: [],
};

function coerceTimestamp(value: unknown, fallback = 0) {
  const timestamp = Number(value);

  if (!Number.isFinite(timestamp) || timestamp < 0) {
    return fallback;
  }

  return Math.round(timestamp);
}

function coerceText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function coerceBullet(value: unknown): LessonAnalysisBullet | null {
  if (!value || typeof value !== "object") return null;

  const raw = value as Record<string, unknown>;
  const title = coerceText(raw.title);
  const body = coerceText(raw.body);

  if (!title || !body) return null;

  const startsAtSeconds = coerceTimestamp(raw.startsAtSeconds);
  const endsAtSeconds =
    raw.endsAtSeconds === null || raw.endsAtSeconds === undefined
      ? undefined
      : Math.max(coerceTimestamp(raw.endsAtSeconds), startsAtSeconds);

  return {
    body,
    endsAtSeconds,
    startsAtSeconds,
    title,
  };
}

function coercePracticeCandidate(value: unknown): LessonPracticeCandidate | null {
  const bullet = coerceBullet(value);

  if (!bullet || !value || typeof value !== "object") return null;

  const suggestedPracticeNote = coerceText(
    (value as Record<string, unknown>).suggestedPracticeNote,
  );

  if (!suggestedPracticeNote) return null;

  return {
    ...bullet,
    segmentId: coerceText((value as Record<string, unknown>).segmentId) || undefined,
    suggestedPracticeNote,
  };
}

function coerceSegmentMemory(
  value: unknown,
  fallback: LessonSegmentAnalysisInput,
): LessonSegmentMemory {
  const raw = value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
  const title = coerceText(raw.title) || fallback.title;
  const body =
    coerceText(raw.body) ||
    coerceText(raw.summary) ||
    fallback.notes ||
    "Useful lesson moment captured for review.";
  const startsAtSeconds = coerceTimestamp(
    raw.startsAtSeconds,
    fallback.startsAtSeconds,
  );
  const endsAtSeconds = Math.max(
    coerceTimestamp(raw.endsAtSeconds, fallback.endsAtSeconds),
    startsAtSeconds + 1,
  );
  const practiceCandidates = Array.isArray(raw.practiceCandidates)
    ? raw.practiceCandidates
        .map((candidate) => coercePracticeCandidate(candidate))
        .filter((item) => item !== null)
        .map((candidate) => ({
          ...candidate,
          endsAtSeconds: candidate.endsAtSeconds ?? endsAtSeconds,
          segmentId: fallback.segmentId,
          startsAtSeconds:
            typeof candidate.startsAtSeconds === "number"
              ? candidate.startsAtSeconds
              : startsAtSeconds,
        }))
    : [];

  return {
    body,
    endsAtSeconds,
    practiceCandidates,
    segmentId: fallback.segmentId,
    startsAtSeconds,
    title,
  };
}

function parseLessonAnalysis(rawJson: string): LessonAnalysisResult {
  let parsed: unknown;

  try {
    parsed = JSON.parse(rawJson);
  } catch {
    return EMPTY_ANALYSIS;
  }

  if (!parsed || typeof parsed !== "object") return EMPTY_ANALYSIS;

  const raw = parsed as Record<string, unknown>;
  const summaryBullets = Array.isArray(raw.summaryBullets)
    ? raw.summaryBullets.map(coerceBullet).filter((item) => item !== null)
    : [];
  const practiceCandidates = Array.isArray(raw.practiceCandidates)
    ? raw.practiceCandidates
        .map(coercePracticeCandidate)
        .filter((item) => item !== null)
    : [];

  return {
    overallSummary: coerceText(raw.overallSummary),
    practiceCandidates,
    summaryBullets,
  };
}

function parseSegmentedLessonAnalysis(
  rawJson: string,
  segments: LessonSegmentAnalysisInput[],
): SegmentedLessonAnalysisResult {
  let parsed: unknown;

  try {
    parsed = JSON.parse(rawJson);
  } catch {
    parsed = {};
  }

  const raw = parsed && typeof parsed === "object"
    ? (parsed as Record<string, unknown>)
    : {};
  const baseAnalysis = parseLessonAnalysis(rawJson);
  const rawSegmentMemories = Array.isArray(raw.segmentMemories)
    ? raw.segmentMemories
    : [];

  const memoryBySegmentId = new Map<string, unknown>();
  for (const item of rawSegmentMemories) {
    if (!item || typeof item !== "object") continue;
    const segmentId = coerceText((item as Record<string, unknown>).segmentId);
    if (segmentId) {
      memoryBySegmentId.set(segmentId, item);
    }
  }

  const segmentMemories = segments.map((segment) =>
    coerceSegmentMemory(memoryBySegmentId.get(segment.segmentId), segment),
  );
  const practiceCandidates = segmentMemories.flatMap(
    (memory) => memory.practiceCandidates,
  );

  return {
    overallSummary: baseAnalysis.overallSummary,
    practiceCandidates,
    segmentMemories,
    summaryBullets:
      baseAnalysis.summaryBullets.length > 0
        ? baseAnalysis.summaryBullets
        : segmentMemories.map(({ practiceCandidates: _items, segmentId: _id, ...item }) => item),
  };
}

export function lessonSummaryText(analysis: LessonAnalysisResult) {
  const bullets = analysis.summaryBullets.map(
    (item) => `- ${item.title}: ${item.body}`,
  );

  return [analysis.overallSummary, ...bullets].filter(Boolean).join("\n");
}

export async function analyzeLessonTranscript({
  model = DEFAULT_LESSON_ANALYSIS_MODEL,
  transcriptText,
}: {
  model?: string;
  transcriptText: string;
}): Promise<LessonAnalysisResult> {
  const apiKey = serverEnv("OPENAI_API_KEY");

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is required for lesson analysis.");
  }

  const client = new OpenAI({ apiKey });
  const response = await client.chat.completions.create({
    messages: [
      {
        role: "system",
        content: [
          "You analyse private adult jazz piano and singing lessons.",
          "Return concise JSON only.",
          "Capture what was discussed without making everything homework.",
          "Exclude social chat, logistics, greetings, and performance small talk unless it directly changes practice.",
          "For summaryBullets, keep only musically useful teaching points, decisions, repertoire observations, and context worth remembering.",
          "Only create practiceCandidates when the teacher clearly asks for a repeatable practice task, drill, assignment, or technical focus.",
          "A clear assignment such as moving a voicing pattern through all 12 keys should be a practiceCandidate.",
          "When the transcript contains bracketed teaching segment labels with original audio times, use those original audio times for startsAtSeconds and endsAtSeconds.",
          "If the transcript has no reliable timestamps, use startsAtSeconds 0 and omit endsAtSeconds.",
        ].join(" "),
      },
      {
        role: "user",
        content: [
          "Analyse this lesson transcript.",
          "Return JSON with this shape:",
          "{",
          '  "overallSummary": "one sentence",',
          '  "summaryBullets": [{"title": "short title", "body": "short adult-to-adult summary", "startsAtSeconds": 0}],',
          '  "practiceCandidates": [{"title": "short title", "body": "what to practise and why", "suggestedPracticeNote": "imperative practice note", "startsAtSeconds": 0}]',
          "}",
          "Transcript:",
          transcriptText,
        ].join("\n"),
      },
    ],
    model,
    response_format: { type: "json_object" },
    temperature: 0.2,
  });

  return parseLessonAnalysis(response.choices[0]?.message.content ?? "");
}

export async function analyzeLessonSegments({
  model = DEFAULT_LESSON_ANALYSIS_MODEL,
  segments,
}: {
  model?: string;
  segments: LessonSegmentAnalysisInput[];
}): Promise<SegmentedLessonAnalysisResult> {
  const apiKey = serverEnv("OPENAI_API_KEY");

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is required for lesson analysis.");
  }

  const client = new OpenAI({ apiKey });
  const response = await client.chat.completions.create({
    messages: [
      {
        role: "system",
        content: [
          "You analyse private adult jazz piano and singing lesson clips.",
          "Return concise JSON only.",
          "The input is a set of useful clips already selected by the user.",
          "Return exactly one segmentMemories item for every input segmentId.",
          "For each segment memory, summarise what is worth remembering from that clip.",
          "Do not turn every clip into homework.",
          "Only create practiceCandidates inside a segment when the teacher clearly asks for a repeatable practice task, drill, assignment, or technical focus.",
          "If a segment is repertoire context, musical discussion, or a decision without a drill, keep practiceCandidates empty.",
          "Always keep startsAtSeconds and endsAtSeconds inside the original segment boundaries.",
          "Use the original segment startsAtSeconds and endsAtSeconds as the default clip range for any practice candidate unless the transcript clearly supports a narrower range.",
          "Exclude social chat, logistics, greetings, and performance small talk unless it directly changes practice.",
        ].join(" "),
      },
      {
        role: "user",
        content: [
          "Analyse these selected lesson clips.",
          "Return JSON with this shape:",
          "{",
          '  "overallSummary": "one sentence across all clips",',
          '  "summaryBullets": [{"title": "short title", "body": "short adult-to-adult summary", "startsAtSeconds": 0, "endsAtSeconds": 10}],',
          '  "segmentMemories": [{"segmentId": "id", "title": "short title", "body": "what was worth remembering", "startsAtSeconds": 0, "endsAtSeconds": 10, "practiceCandidates": [{"title": "short title", "body": "what to practise and why", "suggestedPracticeNote": "imperative practice note", "startsAtSeconds": 0, "endsAtSeconds": 10}]}]',
          "}",
          "Clips:",
          JSON.stringify(
            segments.map((segment) => ({
              endsAtSeconds: segment.endsAtSeconds,
              notes: segment.notes,
              segmentId: segment.segmentId,
              startsAtSeconds: segment.startsAtSeconds,
              title: segment.title,
              transcript: segment.transcriptText,
            })),
            null,
            2,
          ),
        ].join("\n"),
      },
    ],
    model,
    response_format: { type: "json_object" },
    temperature: 0.2,
  });

  return parseSegmentedLessonAnalysis(
    response.choices[0]?.message.content ?? "",
    segments,
  );
}
