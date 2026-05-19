import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { createDatabaseClient } from "@/db/client";
import { pieceAssets, pieces } from "@/db/schema";
import { leadSheetCatalogByFilename } from "@/lib/lead-sheet-catalog";
import { serverEnv } from "@/lib/server/env";

export const runtime = "nodejs";
export const maxDuration = 300;

const MAX_ASSET_BYTES = 30 * 1024 * 1024;
const LOCAL_PIECE_ASSET_BUCKET = "local-docs";
const LOCAL_PIECE_ASSET_STORAGE_PREFIX = "docs/piece-assets/";
const NETLIFY_PIECE_ASSET_BUCKET = "netlify-blobs";
const NETLIFY_PIECE_ASSET_STORAGE_PREFIX = "netlify-blobs/piece-assets/";

function localPieceAssetStoragePath(fileName: string) {
  return `${LOCAL_PIECE_ASSET_STORAGE_PREFIX}${fileName}`;
}

function netlifyPieceAssetStoragePath(fileName: string) {
  return `${NETLIFY_PIECE_ASSET_STORAGE_PREFIX}${fileName}`;
}

function isUploadedFile(value: FormDataEntryValue | null): value is File {
  return (
    typeof value === "object" &&
    value !== null &&
    "arrayBuffer" in value &&
    "name" in value &&
    "size" in value &&
    "type" in value
  );
}

function normalizeTitle(value: string) {
  return value
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function fallbackTitle(filename: string) {
  const baseName = filename.replace(/\.[^.]+$/i, "");

  return baseName
    .replace(/\s*-\s*[^-]+$/u, "")
    .replace(/\s+[A-G](?:b|#)?$/u, "")
    .trim();
}

function safeBaseName(value: string) {
  return value
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 70);
}

function extensionForUpload(file: File) {
  const extensionFromName = path
    .extname(file.name)
    .toLowerCase()
    .replace(/^\./, "");
  const extensionFromType = new Map([
    ["application/pdf", "pdf"],
    ["image/jpeg", "jpg"],
    ["image/png", "png"],
  ]).get(file.type.toLowerCase());
  const extension = extensionFromType ?? extensionFromName;

  if (["jpg", "jpeg", "pdf", "png"].includes(extension)) {
    return extension === "jpeg" ? "jpg" : extension;
  }

  return "";
}

function assetTypeForExtension(extension: string) {
  if (extension === "pdf") return "lead_sheet_pdf" as const;
  if (extension === "jpg" || extension === "png") {
    return "lead_sheet_image" as const;
  }

  return null;
}

function contentTypeForExtension(extension: string) {
  if (extension === "pdf") return "application/pdf";
  if (extension === "png") return "image/png";
  if (extension === "jpg") return "image/jpeg";

  return "application/octet-stream";
}

function bufferArrayBuffer(buffer: Buffer) {
  const arrayBuffer = new ArrayBuffer(buffer.byteLength);
  new Uint8Array(arrayBuffer).set(buffer);
  return arrayBuffer;
}

function shouldUseNetlifyBlobs() {
  return (
    serverEnv("PRACTICE_LOOP_ASSET_STORAGE") === "netlify-blobs" ||
    serverEnv("NETLIFY") === "true" ||
    Boolean(serverEnv("SITE_ID") || serverEnv("NETLIFY_SITE_ID"))
  );
}

async function saveUploadedAssetFile({
  buffer,
  contentType,
  fileName,
}: {
  buffer: Buffer;
  contentType: string;
  fileName: string;
}) {
  if (shouldUseNetlifyBlobs()) {
    const { getStore } = await import("@netlify/blobs");
    const siteID = serverEnv("NETLIFY_SITE_ID") ?? serverEnv("SITE_ID");
    const token =
      serverEnv("NETLIFY_BLOBS_TOKEN") ??
      serverEnv("NETLIFY_AUTH_TOKEN") ??
      serverEnv("NETLIFY_TOKEN");
    const store =
      siteID && token
        ? getStore({ name: "piece-assets", siteID, token })
        : getStore("piece-assets");

    await store.set(fileName, bufferArrayBuffer(buffer), {
      metadata: {
        contentType,
        uploadedAt: new Date().toISOString(),
      },
    });

    return {
      storageBucket: NETLIFY_PIECE_ASSET_BUCKET,
      storagePath: netlifyPieceAssetStoragePath(fileName),
    };
  }

  const directory = process.env.NETLIFY
    ? path.join(os.tmpdir(), "practice-loop/piece-assets")
    : path.join(/*turbopackIgnore: true*/ process.cwd(), "docs/piece-assets");
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, fileName), buffer);

  return {
    storageBucket: LOCAL_PIECE_ASSET_BUCKET,
    storagePath: localPieceAssetStoragePath(fileName),
  };
}

function spotifySearchUrl(title: string) {
  return `https://open.spotify.com/search/${encodeURIComponent(`${title} jazz`)}`;
}

async function upsertPieceForUpload(file: File, importedAt: string) {
  const known = leadSheetCatalogByFilename[file.name];
  const title = known?.title ?? fallbackTitle(file.name);
  const normalizedTitle = normalizeTitle(title);
  const db = createDatabaseClient();
  const existingPieces = await db.select().from(pieces);
  const existing = existingPieces.find(
    (piece) => normalizeTitle(piece.title) === normalizedTitle,
  );

  if (existing) {
    return existing;
  }

  const [piece] = await db
    .insert(pieces)
    .values({
      title,
      composer: known?.composer ?? null,
      lyricist: known?.lyricist ?? null,
      musicalKey: known?.key ?? null,
      status: "learning",
      confidence: 3,
      spotifyUrl: spotifySearchUrl(title),
      updatedAt: importedAt,
    })
    .returning();

  return piece;
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const files = formData.getAll("assets").filter(isUploadedFile);

  if (files.length === 0) {
    return NextResponse.json(
      { error: "At least one lead sheet file is required." },
      { status: 400 },
    );
  }

  const importedAt = new Date().toISOString();
  const db = createDatabaseClient();
  const imported = [];

  for (const file of files) {
    if (file.size <= 0) {
      return NextResponse.json(
        { error: `${file.name} is empty.` },
        { status: 400 },
      );
    }

    if (file.size > MAX_ASSET_BYTES) {
      return NextResponse.json(
        { error: `${file.name} is too large.` },
        { status: 413 },
      );
    }

    const extension = extensionForUpload(file);
    const assetType = assetTypeForExtension(extension);

    if (!assetType) {
      return NextResponse.json(
        { error: `${file.name} must be a PDF, PNG, or JPG lead sheet.` },
        { status: 400 },
      );
    }

    const piece = await upsertPieceForUpload(file, importedAt);
    const buffer = Buffer.from(await file.arrayBuffer());
    const fileName = `${safeBaseName(piece.title) || "lead-sheet"}-${randomUUID()}.${extension}`;
    const storedFile = await saveUploadedAssetFile({
      buffer,
      contentType: file.type || contentTypeForExtension(extension),
      fileName,
    });
    const assetTitle =
      assetType === "lead_sheet_pdf"
        ? `${piece.title} lead sheet`
        : `${piece.title} lead sheet image`;
    const [existingAsset] = await db
      .select({ id: pieceAssets.id })
      .from(pieceAssets)
      .where(
        and(
          eq(pieceAssets.pieceId, piece.id),
          eq(pieceAssets.title, assetTitle),
          eq(pieceAssets.assetType, assetType),
        ),
      );

    if (existingAsset) {
      await db
        .update(pieceAssets)
        .set({
          versionLabel: "clean",
          storageBucket: storedFile.storageBucket,
          storagePath: storedFile.storagePath,
          uploadedAt: importedAt,
        })
        .where(eq(pieceAssets.id, existingAsset.id));

      imported.push({
        assetId: existingAsset.id,
        pieceId: piece.id,
        pieceTitle: piece.title,
        status: "updated",
      });
    } else {
      const [asset] = await db
        .insert(pieceAssets)
        .values({
          pieceId: piece.id,
          title: assetTitle,
          assetType,
          versionLabel: "clean",
          storageBucket: storedFile.storageBucket,
          storagePath: storedFile.storagePath,
          uploadedAt: importedAt,
        })
        .returning({ id: pieceAssets.id });

      imported.push({
        assetId: asset.id,
        pieceId: piece.id,
        pieceTitle: piece.title,
        status: "created",
      });
    }
  }

  return NextResponse.json({ imported }, { status: 201 });
}
