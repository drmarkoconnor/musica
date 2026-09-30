import { spawn } from "node:child_process";
import { access, mkdtemp, readFile, rm } from "node:fs/promises";
import { constants } from "node:fs";
import os from "node:os";
import path from "node:path";
import { isNetlifyRuntime, serverEnv } from "@/lib/server/env";
import type { AudioTranscriptionResult } from "@/lib/server/openai-transcription";

export function localWhisperModelPath() {
  return serverEnv("WHISPER_MODEL_PATH") || path.join(process.cwd(), ".local", "whisper", "ggml-small-q5_1.bin");
}

export async function localWhisperConfiguration() {
  if (isNetlifyRuntime()) return null;
  const modelPath = localWhisperModelPath();
  try { await access(modelPath, constants.R_OK); } catch { return null; }
  const candidates = serverEnv("WHISPER_CLI_PATH")
    ? [serverEnv("WHISPER_CLI_PATH")!]
    : [...(serverEnv("PATH") ?? "").split(path.delimiter).filter(Boolean).map((directory) => path.join(directory, "whisper-cli")), "/opt/homebrew/bin/whisper-cli", "/usr/local/bin/whisper-cli"];
  for (const binaryPath of candidates) {
    try {
      await access(binaryPath, constants.X_OK);
      return { binaryPath, modelPath, model: `local-whisper:${path.basename(modelPath, ".bin")}` };
    } catch { /* Try the next installed location. */ }
  }
  return null;
}

export function parseWhisperJson(value: unknown, durationSeconds: number): NonNullable<AudioTranscriptionResult["timedSegments"]> {
  if (!value || typeof value !== "object" || !Array.isArray((value as { transcription?: unknown }).transcription)) throw new Error("Local Whisper returned an invalid transcript. Your source audio is unchanged.");
  const segments: NonNullable<AudioTranscriptionResult["timedSegments"]> = [];
  for (const item of (value as { transcription: unknown[] }).transcription) {
    if (!item || typeof item !== "object") throw new Error("Local Whisper returned an invalid passage.");
    const row = item as { text?: unknown; offsets?: { from?: unknown; to?: unknown } };
    if (typeof row.text !== "string" || typeof row.offsets?.from !== "number" || typeof row.offsets.to !== "number") throw new Error("Local Whisper returned an untimed passage.");
    const start = row.offsets.from / 1000;
    const end = Math.min(row.offsets.to / 1000, durationSeconds);
    if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || start > durationSeconds || end < start) throw new Error("Local Whisper returned an invalid audio range.");
    const text = row.text.trim();
    if (!text || end === start || /^\[.*\]$/.test(text) || /^\(.*\)$/.test(text)) continue;
    if (segments.length && start < segments.at(-1)!.startsAtSeconds) throw new Error("Local Whisper returned out-of-order passages.");
    segments.push({ startsAtSeconds: start, endsAtSeconds: end, text });
  }
  return segments;
}

export function runLocalAudioProcess(binary: string, args: string[], timeoutMs: number, onProgress?: () => Promise<unknown>) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(binary, args, { stdio: "ignore", shell: false });
    let failure: Error | undefined;
    const timer = setTimeout(() => { failure = new Error("Local transcription took too long. Saved passages are ready to retry; no audio was sent to OpenAI."); child.kill("SIGKILL"); }, timeoutMs);
    let renewing = false;
    const heartbeat = onProgress ? setInterval(() => {
      if (renewing) return;
      renewing = true;
      void onProgress().catch((error: unknown) => { failure = error instanceof Error ? error : new Error("Local processing lost its worker lease."); child.kill("SIGKILL"); }).finally(() => { renewing = false; });
    }, 30_000) : undefined;
    const cleanup = () => { clearTimeout(timer); clearInterval(heartbeat); };
    child.once("error", () => { cleanup(); reject(new Error("Could not start local Whisper. Check the installation; no audio was sent to OpenAI.")); });
    child.once("close", (code) => { cleanup(); if (failure) reject(failure); else if (code === 0) resolve(); else reject(new Error("Local Whisper could not process this passage. Saved progress is preserved; no audio was sent to OpenAI.")); });
  });
}

export async function transcribeWithLocalWhisper({ filePath, durationSeconds, model, onProgress }: {
  filePath: string; durationSeconds: number; model?: string; onProgress?: () => Promise<unknown>;
}): Promise<AudioTranscriptionResult> {
  const configuration = await localWhisperConfiguration();
  if (!configuration || (model && model !== configuration.model)) throw new Error("This lesson needs the local Whisper model used when it was started. Restore that model or explicitly start a new OpenAI analysis.");
  const directory = await mkdtemp(path.join(/*turbopackIgnore: true*/ os.tmpdir(), "practice-loop-whisper-"));
  const wavePath = path.join(/*turbopackIgnore: true*/ directory, "passage.wav");
  const outputPath = path.join(/*turbopackIgnore: true*/ directory, "transcript");
  const startedAt = Date.now();
  try {
    await runLocalAudioProcess(serverEnv("FFMPEG_PATH") || "node_modules/ffmpeg-static/ffmpeg", ["-y", "-hide_banner", "-loglevel", "error", "-i", filePath, "-vn", "-ar", "16000", "-ac", "1", "-c:a", "pcm_s16le", wavePath], 90_000, onProgress);
    const args = ["-m", configuration.modelPath, "-f", wavePath, "-l", "auto", "-oj", "-of", outputPath, "-np", "-t", String(Math.min(8, Math.max(1, os.availableParallelism() - 1)))];
    if (process.arch === "x64") args.push("-ng");
    // Keep each persisted three-minute passage bounded, while renewing its lease on
    // slower Intel Macs. A local failure never triggers a paid audio upload.
    await runLocalAudioProcess(configuration.binaryPath, args, 30 * 60_000, onProgress);
    const timedSegments = parseWhisperJson(JSON.parse(await readFile(`${outputPath}.json`, "utf8")), durationSeconds);
    return { text: timedSegments.map((segment) => segment.text).join(" "), timedSegments, model: configuration.model, durationMs: Date.now() - startedAt };
  } finally { await rm(directory, { recursive: true, force: true }); }
}
