import { createReadStream } from "node:fs";
import OpenAI from "openai";
import { serverEnv } from "@/lib/server/env";

export const DEFAULT_TRANSCRIPTION_MODEL =
  serverEnv("OPENAI_TRANSCRIPTION_MODEL") || "gpt-4o-mini-transcribe";

export const MUSIC_LESSON_TRANSCRIPTION_PROMPT = [
  "This is a private jazz piano and singing lesson between Mark and Leo.",
  "Expect discussion of jazz standards, harmony, voicings, guide tones, left-hand timing, vocal phrasing, intervals, keys, scales, tempo, and practice instructions.",
  "Preserve musical terms and song titles as accurately as possible.",
  "Use speaker labels only when they are clear from the audio.",
].join(" ");

export type AudioTranscriptionResult = {
  text: string;
  model: string;
  durationMs: number;
};

export async function transcribeAudioFile({
  filePath,
  model = DEFAULT_TRANSCRIPTION_MODEL,
  prompt = MUSIC_LESSON_TRANSCRIPTION_PROMPT,
}: {
  filePath: string;
  model?: string;
  prompt?: string;
}): Promise<AudioTranscriptionResult> {
  const apiKey = serverEnv("OPENAI_API_KEY");

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is required for transcription.");
  }

  const startedAt = Date.now();
  const client = new OpenAI({ apiKey });
  const transcript = await client.audio.transcriptions.create({
    file: createReadStream(filePath),
    model,
    prompt,
    response_format: "json",
  });

  return {
    text: transcript.text,
    model,
    durationMs: Date.now() - startedAt,
  };
}
