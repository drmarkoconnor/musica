import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { createReadStream } from "node:fs";
import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { neon } from "@neondatabase/serverless";
import { getStore } from "@netlify/blobs";
import { config } from "dotenv";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-http";
import { lessonRecordings, lessons } from "../src/db/schema";

config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });

const execFileAsync = promisify(execFile);
const NETLIFY_LESSON_AUDIO_BUCKET = "netlify-blobs";
const NETLIFY_LESSON_AUDIO_STORE = "lesson-recordings";
const NETLIFY_LESSON_AUDIO_STORAGE_PREFIX = "netlify-blobs/lesson-recordings/";
const DEFAULT_SOURCE_DIR = "lessonrecordings";
const LESSON_TIME_ZONE = "Europe/London";
const AUDIO_EXTENSIONS = new Set([
  ".aac",
  ".m4a",
  ".mp3",
  ".mp4",
  ".ogg",
  ".wav",
  ".webm",
]);

type Options = {
  dryRun: boolean;
  includeDuplicates: boolean;
  limit: number | null;
  manifestPath: string;
  sourceDir: string;
};

type FfprobeMetadata = {
  creationTime: string | null;
  durationSeconds: number | null;
};

type ImportCandidate = {
  blobKey: string;
  durationSeconds: number | null;
  fileName: string;
  filePath: string;
  hash: string;
  isDuplicate: boolean;
  lessonDate: string;
  recordedAt: string;
  sizeBytes: number;
  storagePath: string;
};

type ImportResult =
  | "dry-run"
  | "duplicate"
  | "existing"
  | "imported"
  | "repaired-blob"
  | "failed";

type ManifestEntry = {
  blobKey: string;
  durationSeconds: number | null;
  fileName: string;
  hash: string;
  isDuplicate: boolean;
  lessonDate: string;
  recordedAt: string;
  result: ImportResult;
  sizeBytes: number;
  storagePath: string;
};

function parseArgs(argv: string[]): Options {
  const options: Options = {
    dryRun: true,
    includeDuplicates: false,
    limit: null,
    manifestPath: "",
    sourceDir: DEFAULT_SOURCE_DIR,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];

    if (arg === "--write") {
      options.dryRun = false;
      continue;
    }

    if (arg === "--dry-run") {
      options.dryRun = true;
      continue;
    }

    if (arg === "--include-duplicates") {
      options.includeDuplicates = true;
      continue;
    }

    if (arg === "--source" && next) {
      options.sourceDir = next;
      index += 1;
      continue;
    }

    if (arg.startsWith("--source=")) {
      options.sourceDir = arg.slice("--source=".length);
      continue;
    }

    if (arg === "--manifest" && next) {
      options.manifestPath = next;
      index += 1;
      continue;
    }

    if (arg.startsWith("--manifest=")) {
      options.manifestPath = arg.slice("--manifest=".length);
      continue;
    }

    if (arg === "--limit" && next) {
      options.limit = parsePositiveInteger(next, "--limit");
      index += 1;
      continue;
    }

    if (arg.startsWith("--limit=")) {
      options.limit = parsePositiveInteger(arg.slice("--limit=".length), "--limit");
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  if (!options.manifestPath) {
    options.manifestPath = path.join(
      options.sourceDir,
      options.dryRun
        ? ".practice-loop-import-dry-run.json"
        : ".practice-loop-import-result.json",
    );
  }

  return options;
}

function parsePositiveInteger(value: string, label: string) {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${label} must be a positive integer.`);
  }

  return parsed;
}

async function discoverAudioFiles(sourceDir: string) {
  const entries = await readdir(sourceDir, { withFileTypes: true });

  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => path.join(sourceDir, entry.name))
    .filter((filePath) => AUDIO_EXTENSIONS.has(path.extname(filePath).toLowerCase()))
    .sort((left, right) => left.localeCompare(right));
}

async function sha256File(filePath: string) {
  const hash = createHash("sha256");
  const stream = createReadStream(filePath);

  for await (const chunk of stream) {
    hash.update(chunk);
  }

  return hash.digest("hex");
}

async function ffprobe(filePath: string): Promise<FfprobeMetadata> {
  const { stdout } = await execFileAsync("ffprobe", [
    "-v",
    "error",
    "-show_entries",
    "format=duration:format_tags=creation_time",
    "-of",
    "json",
    filePath,
  ]);
  const parsed = JSON.parse(stdout) as {
    format?: {
      duration?: string;
      tags?: { creation_time?: string };
    };
  };
  const duration = Number(parsed.format?.duration);
  const creationTime = parsed.format?.tags?.creation_time ?? null;

  return {
    creationTime: creationTime && !Number.isNaN(Date.parse(creationTime))
      ? new Date(creationTime).toISOString()
      : null,
    durationSeconds: Number.isFinite(duration) && duration > 0
      ? Math.round(duration)
      : null,
  };
}

function dateTimeParts(isoString: string) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
    minute: "2-digit",
    month: "2-digit",
    timeZone: LESSON_TIME_ZONE,
    year: "numeric",
  }).formatToParts(new Date(isoString));
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? "";

  return {
    date: `${part("year")}-${part("month")}-${part("day")}`,
    time: `${part("hour")}:${part("minute")}`,
  };
}

function fallbackDateFromFileName(fileName: string) {
  const match = /20\d{6}/.exec(fileName);
  if (!match) return null;

  const value = match[0];
  const year = value.slice(0, 4);
  const month = value.slice(4, 6);
  const day = value.slice(6, 8);
  const date = `${year}-${month}-${day}`;
  const timestamp = Date.parse(`${date}T12:00:00.000Z`);

  return Number.isNaN(timestamp) ? null : new Date(timestamp).toISOString();
}

function copyScore(fileName: string) {
  return /\s+\d+\.[^.]+$/i.test(fileName) ? 1 : 0;
}

function keyForCandidate({
  hash,
  recordedAt,
  sourcePath,
}: {
  hash: string;
  recordedAt: string;
  sourcePath: string;
}) {
  const extension = path.extname(sourcePath).toLowerCase() || ".m4a";
  const recordedLabel = recordedAt.replace(/[:.]/g, "-");

  return `archive-${recordedLabel}-${hash.slice(0, 16)}${extension}`;
}

async function buildCandidates(sourceDir: string): Promise<ImportCandidate[]> {
  const filePaths = await discoverAudioFiles(sourceDir);
  const candidates: ImportCandidate[] = [];

  for (const filePath of filePaths) {
    const fileName = path.basename(filePath);
    const [metadata, fileStat, hash] = await Promise.all([
      ffprobe(filePath),
      stat(filePath),
      sha256File(filePath),
    ]);
    const recordedAt =
      metadata.creationTime ??
      fallbackDateFromFileName(fileName) ??
      fileStat.mtime.toISOString();
    const { date: lessonDate } = dateTimeParts(recordedAt);
    const blobKey = keyForCandidate({ hash, recordedAt, sourcePath: filePath });

    candidates.push({
      blobKey,
      durationSeconds: metadata.durationSeconds,
      fileName,
      filePath,
      hash,
      isDuplicate: false,
      lessonDate,
      recordedAt,
      sizeBytes: fileStat.size,
      storagePath: `${NETLIFY_LESSON_AUDIO_STORAGE_PREFIX}${blobKey}`,
    });
  }

  const byHash = new Map<string, ImportCandidate[]>();
  for (const candidate of candidates) {
    const group = byHash.get(candidate.hash) ?? [];
    group.push(candidate);
    byHash.set(candidate.hash, group);
  }

  for (const group of byHash.values()) {
    group.sort((left, right) => {
      const copyDelta = copyScore(left.fileName) - copyScore(right.fileName);
      if (copyDelta !== 0) return copyDelta;

      const lengthDelta = left.fileName.length - right.fileName.length;
      if (lengthDelta !== 0) return lengthDelta;

      return left.fileName.localeCompare(right.fileName);
    });

    for (const duplicate of group.slice(1)) {
      duplicate.isDuplicate = true;
    }
  }

  return candidates.sort((left, right) => {
    const timeDelta = left.recordedAt.localeCompare(right.recordedAt);
    if (timeDelta !== 0) return timeDelta;

    return left.fileName.localeCompare(right.fileName);
  });
}

function createDatabase() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required for lesson metadata import.");
  }

  return drizzle(neon(process.env.DATABASE_URL), {
    schema: { lessonRecordings, lessons },
  });
}

function createBlobStore() {
  const siteID = process.env.NETLIFY_SITE_ID ?? process.env.SITE_ID;
  const token =
    process.env.NETLIFY_BLOBS_TOKEN ??
    process.env.NETLIFY_AUTH_TOKEN ??
    process.env.NETLIFY_TOKEN;

  if (siteID && token) {
    return getStore({
      name: NETLIFY_LESSON_AUDIO_STORE,
      siteID,
      token,
    });
  }

  if (process.env.NETLIFY_BLOBS_CONTEXT) {
    return getStore(NETLIFY_LESSON_AUDIO_STORE);
  }

  throw new Error(
    "Netlify Blob credentials are required. Set NETLIFY_SITE_ID and NETLIFY_BLOBS_TOKEN in .env.local, or provide NETLIFY_BLOBS_CONTEXT.",
  );
}

function bufferArrayBuffer(buffer: Buffer) {
  const arrayBuffer = new ArrayBuffer(buffer.byteLength);
  new Uint8Array(arrayBuffer).set(buffer);
  return arrayBuffer;
}

function contentTypeForPath(filePath: string) {
  const extension = path.extname(filePath).toLowerCase();

  if (extension === ".aac") return "audio/aac";
  if (extension === ".m4a" || extension === ".mp4") return "audio/mp4";
  if (extension === ".mp3") return "audio/mpeg";
  if (extension === ".ogg") return "audio/ogg";
  if (extension === ".wav") return "audio/wav";
  if (extension === ".webm") return "audio/webm";

  return "application/octet-stream";
}

function lessonTitle(candidate: ImportCandidate) {
  const { date, time } = dateTimeParts(candidate.recordedAt);
  return `Leo lesson - ${date} ${time}`;
}

function lessonSummary() {
  return "Imported from Mark's private lesson archive. Ready for clip review and authorised transcription.";
}

function recordingNotes(candidate: ImportCandidate) {
  return [
    "Imported from Mark's private local lesson archive.",
    `Original filename: ${candidate.fileName}`,
    `SHA-256: ${candidate.hash}`,
  ].join("\n");
}

async function ensureLesson(
  db: ReturnType<typeof createDatabase>,
  candidate: ImportCandidate,
) {
  const title = lessonTitle(candidate);
  const [existingLesson] = await db
    .select({ id: lessons.id })
    .from(lessons)
    .where(
      and(
        eq(lessons.title, title),
        eq(lessons.teacher, "Leo"),
        eq(lessons.lessonDate, candidate.lessonDate),
      ),
    );

  if (existingLesson) return existingLesson.id;

  const [lesson] = await db
    .insert(lessons)
    .values({
      lessonDate: candidate.lessonDate,
      status: "recorded",
      summary: lessonSummary(),
      teacher: "Leo",
      title,
      updatedAt: new Date().toISOString(),
    })
    .returning({ id: lessons.id });

  return lesson.id;
}

async function importCandidate(
  db: ReturnType<typeof createDatabase>,
  store: ReturnType<typeof createBlobStore>,
  candidate: ImportCandidate,
): Promise<ImportResult> {
  const [existingRecording] = await db
    .select({ id: lessonRecordings.id })
    .from(lessonRecordings)
    .where(
      and(
        eq(lessonRecordings.storageBucket, NETLIFY_LESSON_AUDIO_BUCKET),
        eq(lessonRecordings.storagePath, candidate.storagePath),
      ),
    );

  const existingBlob = await store.getMetadata(candidate.blobKey);

  if (!existingBlob) {
    const file = await readFile(candidate.filePath);
    await store.set(candidate.blobKey, bufferArrayBuffer(file), {
      metadata: {
        contentType: contentTypeForPath(candidate.filePath),
        importedAt: new Date().toISOString(),
        originalFileName: candidate.fileName,
        sha256: candidate.hash,
        sizeBytes: candidate.sizeBytes,
      },
      onlyIfNew: true,
    });
  }

  if (existingRecording) {
    return existingBlob ? "existing" : "repaired-blob";
  }

  const lessonId = await ensureLesson(db, candidate);

  await db.insert(lessonRecordings).values({
    durationSeconds: candidate.durationSeconds,
    lessonId,
    notes: recordingNotes(candidate),
    recordedAt: candidate.recordedAt,
    storageBucket: NETLIFY_LESSON_AUDIO_BUCKET,
    storagePath: candidate.storagePath,
    title: "Imported lesson recording",
  });

  return "imported";
}

function printSummary(entries: ManifestEntry[]) {
  const counts = new Map<ImportResult, number>();
  let importedSeconds = 0;

  for (const entry of entries) {
    counts.set(entry.result, (counts.get(entry.result) ?? 0) + 1);

    if (
      entry.result === "dry-run" ||
      entry.result === "existing" ||
      entry.result === "imported" ||
      entry.result === "repaired-blob"
    ) {
      importedSeconds += entry.durationSeconds ?? 0;
    }
  }

  console.log("Lesson recording import summary");
  for (const result of [
    "dry-run",
    "imported",
    "existing",
    "repaired-blob",
    "duplicate",
    "failed",
  ] as ImportResult[]) {
    const count = counts.get(result) ?? 0;
    if (count > 0) console.log(`- ${result}: ${count}`);
  }
  console.log(`- selected audio hours: ${(importedSeconds / 3600).toFixed(2)}`);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const sourceDir = path.resolve(options.sourceDir);
  const candidates = await buildCandidates(sourceDir);
  const selected = candidates
    .filter((candidate) => options.includeDuplicates || !candidate.isDuplicate)
    .slice(0, options.limit ?? undefined);

  console.log("Practice Loop lesson recording import");
  console.log(`- source: ${sourceDir}`);
  console.log(`- mode: ${options.dryRun ? "dry-run" : "write"}`);
  console.log(`- discovered audio files: ${candidates.length}`);
  console.log(
    `- exact duplicates skipped: ${
      options.includeDuplicates
        ? 0
        : candidates.filter((candidate) => candidate.isDuplicate).length
    }`,
  );
  console.log(`- selected for import: ${selected.length}`);

  const manifest: ManifestEntry[] = [];

  if (options.dryRun) {
    for (const candidate of candidates) {
      manifest.push({
        blobKey: candidate.blobKey,
        durationSeconds: candidate.durationSeconds,
        fileName: candidate.fileName,
        hash: candidate.hash,
        isDuplicate: candidate.isDuplicate,
        lessonDate: candidate.lessonDate,
        recordedAt: candidate.recordedAt,
        result:
          !options.includeDuplicates && candidate.isDuplicate ? "duplicate" : "dry-run",
        sizeBytes: candidate.sizeBytes,
        storagePath: candidate.storagePath,
      });
    }
  } else {
    const db = createDatabase();
    const store = createBlobStore();

    for (const candidate of candidates) {
      if (!options.includeDuplicates && candidate.isDuplicate) {
        manifest.push({
          blobKey: candidate.blobKey,
          durationSeconds: candidate.durationSeconds,
          fileName: candidate.fileName,
          hash: candidate.hash,
          isDuplicate: candidate.isDuplicate,
          lessonDate: candidate.lessonDate,
          recordedAt: candidate.recordedAt,
          result: "duplicate",
          sizeBytes: candidate.sizeBytes,
          storagePath: candidate.storagePath,
        });
        continue;
      }

      if (!selected.includes(candidate)) continue;

      let result: ImportResult;

      try {
        result = await importCandidate(db, store, candidate);
      } catch (error) {
        result = "failed";
        console.error(
          `Failed: ${candidate.fileName}: ${
            error instanceof Error ? error.message : "Unknown error"
          }`,
        );
      }

      manifest.push({
        blobKey: candidate.blobKey,
        durationSeconds: candidate.durationSeconds,
        fileName: candidate.fileName,
        hash: candidate.hash,
        isDuplicate: candidate.isDuplicate,
        lessonDate: candidate.lessonDate,
        recordedAt: candidate.recordedAt,
        result,
        sizeBytes: candidate.sizeBytes,
        storagePath: candidate.storagePath,
      });
    }
  }

  await writeFile(options.manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  printSummary(manifest);
  console.log(`- manifest: ${path.resolve(options.manifestPath)}`);

  if (!options.dryRun && manifest.some((entry) => entry.result === "failed")) {
    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
