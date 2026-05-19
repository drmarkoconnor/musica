import path from "node:path";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { createDatabaseClient } from "@/db/client";
import { pieceAssets } from "@/db/schema";
import {
  inlineAssetDisposition,
  pieceAssetContentTypeForPath,
  readPieceAssetBuffer,
} from "@/lib/server/piece-asset-storage";

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

  const file = await readPieceAssetBuffer({
    storageBucket: asset.storageBucket,
    storagePath: asset.storagePath,
  });

  if (!file) {
    return NextResponse.json({ error: "Asset file not found." }, { status: 404 });
  }

  const filename = path.basename(asset.storagePath);

  return new Response(new Uint8Array(file), {
    headers: {
      "Cache-Control": "private, max-age=0, must-revalidate",
      "Content-Disposition": inlineAssetDisposition(filename),
      "Content-Length": String(file.byteLength),
      "Content-Type": pieceAssetContentTypeForPath(asset.storagePath),
    },
  });
}
