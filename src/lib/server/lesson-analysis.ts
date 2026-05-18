import "server-only";

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
  suggestedPracticeNote: string;
};

export type LessonAnalysisResult = {
  overallSummary: string;
  practiceCandidates: LessonPracticeCandidate[];
  summaryBullets: LessonAnalysisBullet[];
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
    suggestedPracticeNote,
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
