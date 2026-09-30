import { spawn } from "node:child_process";
import { serverEnv } from "@/lib/server/env";

// Runs in the background worker, never in the upload/queue HTTP request.
export async function probeAudioDuration(filePath: string): Promise<number> {
  const ffmpeg = serverEnv("FFMPEG_PATH") || (process.platform === "win32" ? "node_modules/ffmpeg-static/ffmpeg.exe" : "node_modules/ffmpeg-static/ffmpeg");
  return new Promise((resolve, reject) => {
    const child = spawn(ffmpeg, ["-hide_banner", "-i", filePath, "-map", "0:a:0", "-vn", "-f", "null", "-"], { stdio: ["ignore", "ignore", "pipe"] });
    let output = "";
    const timer = setTimeout(() => { child.kill("SIGKILL"); reject(new Error("Reading the recording duration timed out. Export this recording as M4A or MP3 and try again.")); }, 120_000);
    child.stderr.on("data", (data: Buffer) => { output = (output + data.toString()).slice(-16_000); });
    child.on("error", (error) => { clearTimeout(timer); reject(error); });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code !== 0) { reject(new Error("The recording could not be decoded. Export it as M4A or MP3 and try again.")); return; }
      const matches = [...output.matchAll(/time=(\d+):(\d+):(\d+(?:\.\d+)?)/g)];
      const match = matches.at(-1) ?? output.match(/Duration: (\d+):(\d+):(\d+(?:\.\d+)?)/);
      const seconds = match ? Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]) : 0;
      if (!Number.isFinite(seconds) || seconds <= 0) reject(new Error("The recording has no readable audio duration."));
      else resolve(Math.ceil(seconds));
    });
  });
}
