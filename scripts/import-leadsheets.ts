import { createHash } from "node:crypto";
import { config } from "dotenv";
import { inArray, sql } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { createDatabaseClient } from "../src/db/client";
import { pieceAssets, pieces } from "../src/db/schema";
import {
  leadSheetCatalog,
  leadSheetPieceId,
} from "../src/lib/lead-sheet-catalog";

config({ path: ".env.local" });
config({ path: ".env" });

const oldSeedOnlyTitles = [
  "All the Things You Are",
  "Blue in Green",
  "Body and Soul",
  "I Remember You",
  "In a Sentimental Mood",
  "On Green Dolphin Street",
  "Stella by Starlight",
  "There Will Never Be Another You",
];

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

function normalizeTitle(value: string) {
  return value
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function spotifySearchUrl(title: string) {
  return `https://open.spotify.com/search/${encodeURIComponent(`${title} jazz`)}`;
}

function sqlExcluded(column: AnyPgColumn) {
  return sql.raw(`excluded.${column.name}`);
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required. Add it to .env.local.");
  }

  const db = createDatabaseClient();
  const existingPieces = await db.select().from(pieces);
  const existingByTitle = new Map(
    existingPieces.map((piece) => [normalizeTitle(piece.title), piece]),
  );
  const importedAt = new Date().toISOString();

  const pieceRows = leadSheetCatalog.map((entry) => {
    const existing = existingByTitle.get(normalizeTitle(entry.title));
    const id = existing?.id ?? stableUuid(leadSheetPieceId(entry.title));

    return {
      id,
      title: entry.title,
      composer: entry.composer ?? null,
      lyricist: entry.lyricist ?? null,
      musicalKey: existing?.musicalKey ?? entry.key ?? null,
      status: existing?.status ?? "learning",
      confidence: existing?.confidence ?? 3,
      lastPractisedOn: existing?.lastPractisedOn ?? null,
      targetTempo: existing?.targetTempo ?? null,
      currentTempo: existing?.currentTempo ?? null,
      spotifyUrl: existing?.spotifyUrl ?? spotifySearchUrl(entry.title),
      isSpineTune: existing?.isSpineTune ?? false,
      notes: existing?.notes ?? null,
      updatedAt: importedAt,
    };
  });

  const pieceIdsByTitle = new Map(
    pieceRows.map((piece) => [normalizeTitle(piece.title), piece.id]),
  );

  const assetRows = leadSheetCatalog.map((entry) => {
    const pieceId = pieceIdsByTitle.get(normalizeTitle(entry.title));

    if (!pieceId) {
      throw new Error(`Missing imported piece id for ${entry.title}.`);
    }

    return {
      id: stableUuid(`lead-sheet-asset:${entry.filename}`),
      pieceId,
      title: `${entry.title} lead sheet`,
      assetType: "lead_sheet_pdf" as const,
      versionLabel: "clean",
      storageBucket: "local-docs",
      storagePath: `docs/leadsheets/${entry.filename}`,
      uploadedAt: importedAt,
    };
  });

  await db
    .insert(pieces)
    .values(pieceRows)
    .onConflictDoUpdate({
      target: pieces.id,
      set: {
        title: sqlExcluded(pieces.title),
        composer: sqlExcluded(pieces.composer),
        lyricist: sqlExcluded(pieces.lyricist),
        musicalKey: sqlExcluded(pieces.musicalKey),
        status: sqlExcluded(pieces.status),
        confidence: sqlExcluded(pieces.confidence),
        lastPractisedOn: sqlExcluded(pieces.lastPractisedOn),
        targetTempo: sqlExcluded(pieces.targetTempo),
        currentTempo: sqlExcluded(pieces.currentTempo),
        spotifyUrl: sqlExcluded(pieces.spotifyUrl),
        isSpineTune: sqlExcluded(pieces.isSpineTune),
        notes: sqlExcluded(pieces.notes),
        updatedAt: sqlExcluded(pieces.updatedAt),
      },
    });

  await db
    .insert(pieceAssets)
    .values(assetRows)
    .onConflictDoUpdate({
      target: pieceAssets.id,
      set: {
        pieceId: sqlExcluded(pieceAssets.pieceId),
        title: sqlExcluded(pieceAssets.title),
        assetType: sqlExcluded(pieceAssets.assetType),
        versionLabel: sqlExcluded(pieceAssets.versionLabel),
        storageBucket: sqlExcluded(pieceAssets.storageBucket),
        storagePath: sqlExcluded(pieceAssets.storagePath),
        uploadedAt: sqlExcluded(pieceAssets.uploadedAt),
      },
    });

  const deletedOldSeeds = await db
    .delete(pieces)
    .where(inArray(pieces.title, oldSeedOnlyTitles))
    .returning({ title: pieces.title });

  console.log("Lead sheet import complete.");
  console.log(`- approved lead sheet pieces: ${pieceRows.length}`);
  console.log(`- lead sheet assets: ${assetRows.length}`);
  console.log(`- old seed-only pieces deleted: ${deletedOldSeeds.length}`);
  for (const deleted of deletedOldSeeds) {
    console.log(`  - ${deleted.title}`);
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
