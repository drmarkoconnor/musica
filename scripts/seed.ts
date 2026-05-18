import { createHash } from "node:crypto";
import { config } from "dotenv";
import { inArray, sql } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { createDatabaseClient } from "../src/db/client";
import {
  exercises as exercisesTable,
  pieceExercises,
  pieces as piecesTable,
  tags as tagsTable,
} from "../src/db/schema";
import { exercises, pieces, tags } from "../src/lib/mock-data";

config({ path: ".env.local" });
config({ path: ".env" });

const isDryRun = process.argv.includes("--dry-run");

function stableUuid(input: string) {
  const bytes = createHash("sha1")
    .update(`practice-loop:v1:${input}`)
    .digest()
    .subarray(0, 16);

  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = bytes.toString("hex");
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20),
  ].join("-");
}

const tagIds = new Map(tags.map((tag) => [tag.id, stableUuid(tag.id)]));
const pieceIds = new Map(pieces.map((piece) => [piece.id, stableUuid(piece.id)]));
const exerciseIds = new Map(
  exercises.map((exercise) => [exercise.id, stableUuid(exercise.id)]),
);

const seededTags = tags.map((tag) => ({
  id: tagIds.get(tag.id) ?? stableUuid(tag.id),
  name: tag.name,
  color: tag.color,
}));

const seededPieces = pieces.map((piece) => ({
  id: pieceIds.get(piece.id) ?? stableUuid(piece.id),
  title: piece.title,
  composer: piece.composer,
  lyricist: piece.lyricist,
  musicalKey: piece.key || null,
  status: piece.status,
  confidence: piece.confidence,
  lastPractisedOn: piece.lastPractised || null,
  targetTempo: piece.targetTempo > 0 ? piece.targetTempo : null,
  currentTempo: piece.currentTempo > 0 ? piece.currentTempo : null,
  spotifyUrl: piece.spotifyUrl,
  isSpineTune: piece.isSpineTune,
  notes: piece.notes,
  updatedAt: new Date().toISOString(),
}));

const seededExercises = exercises.map((exercise) => ({
  id: exerciseIds.get(exercise.id) ?? stableUuid(exercise.id),
  title: exercise.title,
  category: exercise.category,
  keyFocus: exercise.keyFocus,
  confidence: exercise.confidence,
  lastPractisedOn: exercise.lastPractised,
  targetTempo: exercise.targetTempo,
  currentTempo: exercise.currentTempo,
  notes: exercise.notes,
  updatedAt: new Date().toISOString(),
}));

const seededPieceExercises = pieces.flatMap((piece) => {
  const pieceId = pieceIds.get(piece.id);

  if (!pieceId) {
    return [];
  }

  return piece.relatedExerciseIds.flatMap((exerciseId) => {
    const resolvedExerciseId = exerciseIds.get(exerciseId);

    if (!resolvedExerciseId) {
      return [];
    }

    return {
      pieceId,
      exerciseId: resolvedExerciseId,
    };
  });
});

async function main() {
  console.log("Practice Loop seed");
  console.log(`- tags: ${seededTags.length}`);
  console.log(`- repertoire pieces: ${seededPieces.length}`);
  console.log(`- exercises: ${seededExercises.length}`);
  console.log(`- piece/exercise links: ${seededPieceExercises.length}`);

  if (isDryRun) {
    console.log("Dry run only. No database writes performed.");
    return;
  }

  if (!process.env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL is required. Add it to .env.local or run with --dry-run.",
    );
  }

  const db = createDatabaseClient();

  await db
    .insert(tagsTable)
    .values(seededTags)
    .onConflictDoUpdate({
      target: tagsTable.name,
      set: {
        color: sqlExcluded(tagsTable.color),
      },
    });

  await db
    .insert(exercisesTable)
    .values(seededExercises)
    .onConflictDoUpdate({
      target: exercisesTable.id,
      set: {
        title: sqlExcluded(exercisesTable.title),
        category: sqlExcluded(exercisesTable.category),
        keyFocus: sqlExcluded(exercisesTable.keyFocus),
        confidence: sqlExcluded(exercisesTable.confidence),
        lastPractisedOn: sqlExcluded(exercisesTable.lastPractisedOn),
        targetTempo: sqlExcluded(exercisesTable.targetTempo),
        currentTempo: sqlExcluded(exercisesTable.currentTempo),
        notes: sqlExcluded(exercisesTable.notes),
        updatedAt: sqlExcluded(exercisesTable.updatedAt),
      },
    });

  await db
    .insert(piecesTable)
    .values(seededPieces)
    .onConflictDoUpdate({
      target: piecesTable.id,
      set: {
        title: sqlExcluded(piecesTable.title),
        composer: sqlExcluded(piecesTable.composer),
        lyricist: sqlExcluded(piecesTable.lyricist),
        musicalKey: sqlExcluded(piecesTable.musicalKey),
        status: sqlExcluded(piecesTable.status),
        confidence: sqlExcluded(piecesTable.confidence),
        lastPractisedOn: sqlExcluded(piecesTable.lastPractisedOn),
        targetTempo: sqlExcluded(piecesTable.targetTempo),
        currentTempo: sqlExcluded(piecesTable.currentTempo),
        spotifyUrl: sqlExcluded(piecesTable.spotifyUrl),
        isSpineTune: sqlExcluded(piecesTable.isSpineTune),
        notes: sqlExcluded(piecesTable.notes),
        updatedAt: sqlExcluded(piecesTable.updatedAt),
      },
    });

  await db
    .delete(pieceExercises)
    .where(
      inArray(
        pieceExercises.pieceId,
        seededPieces.map((piece) => piece.id),
      ),
    );

  if (seededPieceExercises.length > 0) {
    await db
      .insert(pieceExercises)
      .values(seededPieceExercises)
      .onConflictDoNothing();
  }

  console.log("Seed complete.");
}

function sqlExcluded(column: AnyPgColumn) {
  return sql.raw(`excluded.${column.name}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
