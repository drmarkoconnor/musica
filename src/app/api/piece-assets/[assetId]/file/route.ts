import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { createDatabaseClient } from "@/db/client";
import { pieceAssets } from "@/db/schema";

function localLeadSheetPath(storagePath: string) {
  const normalizedPath = storagePath.replace(/\\/g, "/");
  const filename = path.posix.basename(normalizedPath);

  if (normalizedPath !== `docs/leadsheets/${filename}`) {
    return null;
  }

  return path.join(process.cwd(), "docs", "leadsheets", filename);
}

function contentTypeForPath(storagePath: string) {
  const extension = path.extname(storagePath).toLowerCase();

  if (extension === ".pdf") return "application/pdf";
  if (extension === ".png") return "image/png";
  if (extension === ".jpg" || extension === ".jpeg") return "image/jpeg";

  return "application/octet-stream";
}

function inlineDisposition(filename: string) {
  const asciiFilename = filename.replace(/[^\x20-\x7e]/g, "_").replace(/"/g, "'");
  return `inline; filename="${asciiFilename}"; filename*=UTF-8''${encodeURIComponent(
    filename,
  )}`;
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ assetId: string }> },
) {
  const { assetId } = await context.params;
  const db = createDatabaseClient();
  const [asset] = await db
    .select()
    .from(pieceAssets)
    .where(eq(pieceAssets.id, assetId));

  if (!asset) {
    return NextResponse.json({ error: "Asset not found." }, { status: 404 });
  }

  if (asset.storageBucket !== "local-docs") {
    return NextResponse.json(
      { error: "Only local document assets are available in this build." },
      { status: 501 },
    );
  }

  const filePath = localLeadSheetPath(asset.storagePath);

  if (!filePath) {
    return NextResponse.json({ error: "Asset path is not allowed." }, { status: 403 });
  }

  try {
    const [file, fileStat] = await Promise.all([readFile(filePath), stat(filePath)]);
    const filename = path.basename(asset.storagePath);

    return new Response(new Uint8Array(file), {
      headers: {
        "Cache-Control": "private, max-age=0, must-revalidate",
        "Content-Disposition": inlineDisposition(filename),
        "Content-Length": String(fileStat.size),
        "Content-Type": contentTypeForPath(asset.storagePath),
      },
    });
  } catch {
    return NextResponse.json({ error: "Asset file not found." }, { status: 404 });
  }
}
