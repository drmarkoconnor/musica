import { localWhisperConfiguration } from "@/lib/server/local-whisper";
import { DEFAULT_TRANSCRIPTION_MODEL } from "@/lib/server/openai-transcription";
import { serverEnv } from "@/lib/server/env";
import { TranscriptionRequestError } from "@/lib/server/transcription-policy";

export type TranscriptionProvider = "openai" | "local-whisper";
export async function transcriptionOptions() {
  const local = await localWhisperConfiguration();
  return {
    localAvailable: Boolean(local),
    defaultProvider: (local && serverEnv("PRACTICE_LOOP_TRANSCRIPTION_PROVIDER") !== "openai" ? "local-whisper" : "openai") as TranscriptionProvider,
    cloudModel: DEFAULT_TRANSCRIPTION_MODEL,
  };
}

export async function resolveTranscriptionProvider(requested?: unknown) {
  if (requested !== undefined && requested !== "auto" && requested !== "openai" && requested !== "local-whisper") throw new TranscriptionRequestError("Choose local Whisper or OpenAI transcription.");
  const options = await transcriptionOptions();
  const provider = !requested || requested === "auto" ? options.defaultProvider : requested;
  if (provider === "local-whisper") {
    const local = await localWhisperConfiguration();
    if (!local) throw new TranscriptionRequestError("Local Whisper is not installed on this server. It runs in the Mac app, not on Netlify.", 503);
    return { provider: "local-whisper" as const, model: local.model };
  }
  return { provider: "openai" as const, model: DEFAULT_TRANSCRIPTION_MODEL };
}
