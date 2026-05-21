import { spawn } from "node:child_process";
import { mkdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { serverEnv } from "@/lib/server/env";

export type AudioSegmentRange = {
  id: string;
  startsAtSeconds: number;
  endsAtSeconds: number;
  notes?: string | null;
  title: string;
};

export type ClippedAudioSegment = {
  filePath: string;
  segment: AudioSegmentRange;
};

function ffmpegPath() {
  const packagedFfmpegPath =
    process.platform === "win32"
      ? "node_modules/ffmpeg-static/ffmpeg.exe"
      : "node_modules/ffmpeg-static/ffmpeg";

  return serverEnv("FFMPEG_PATH") || packagedFfmpegPath;
}

function runFfmpeg(args: string[]) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(ffmpegPath(), args, {
      stdio: ["ignore", "ignore", "pipe"],
    });
    const stderr: Buffer[] = [];

    child.stderr.on("data", (chunk: Buffer) => {
      stderr.push(chunk);
    });

    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(
        new Error(
          `ffmpeg exited with ${code}: ${Buffer.concat(stderr).toString("utf8")}`,
        ),
      );
    });
  });
}

export async function clipAudioSegments({
  segments,
  sourceFilePath,
}: {
  segments: AudioSegmentRange[];
  sourceFilePath: string;
}) {
  const tempDirectory = path.join(
    /*turbopackIgnore: true*/ os.tmpdir(),
    `practice-loop-segments-${randomUUID()}`,
  );
  await mkdir(tempDirectory, { recursive: true });

  const clippedSegments: ClippedAudioSegment[] = [];

  try {
    for (const [index, segment] of segments.entries()) {
      const durationSeconds = Math.max(
        segment.endsAtSeconds - segment.startsAtSeconds,
        1,
      );
      const outputPath = path.join(
        /*turbopackIgnore: true*/ tempDirectory,
        `segment-${String(index + 1).padStart(2, "0")}.mp3`,
      );

      await runFfmpeg([
        "-y",
        "-hide_banner",
        "-loglevel",
        "error",
        "-ss",
        String(segment.startsAtSeconds),
        "-t",
        String(durationSeconds),
        "-i",
        sourceFilePath,
        "-vn",
        "-ac",
        "1",
        "-ar",
        "16000",
        "-b:a",
        "64k",
        outputPath,
      ]);

      clippedSegments.push({ filePath: outputPath, segment });
    }

    return {
      cleanup: async () => {
        await rm(tempDirectory, { force: true, recursive: true });
      },
      clippedSegments,
    };
  } catch (error) {
    await rm(tempDirectory, { force: true, recursive: true });
    throw error;
  }
}
