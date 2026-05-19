import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { createDatabaseClient } from "@/db/client";
import { pieceAssets } from "@/db/schema";
import type { AssetType } from "@/lib/types";

type PieceAssetUpdateBody = {
  title?: unknown;
  pieceId?: unknown;
  assetType?: unknown;
  versionLabel?: unknown;
};

const assetTypes = new Set<AssetType>([
  "lead_sheet_pdf",
  "lead_sheet_image",
  "annotated_version",
]);

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function cleanText(value: unknown) {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ assetId: string }> },
) {
  const { assetId } = await context.params;

  if (!isUuid(assetId)) {
    return NextResponse.json({ error: "Asset ID is invalid." }, { status: 400 });
  }

  let body: PieceAssetUpdateBody;

  try {
    body = (await request.json()) as PieceAssetUpdateBody;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const title = cleanText(body.title);
  const pieceId = cleanText(body.pieceId);
  const assetType = cleanText(body.assetType);
  const versionLabel = cleanText(body.versionLabel);

  if (!title) {
    return NextResponse.json({ error: "Title is required." }, { status: 400 });
  }

  if (!pieceId || !isUuid(pieceId)) {
    return NextResponse.json({ error: "Piece ID is invalid." }, { status: 400 });
  }

  if (!assetType || !assetTypes.has(assetType as AssetType)) {
    return NextResponse.json({ error: "Asset type is invalid." }, { status: 400 });
  }

  const db = createDatabaseClient();
  const [asset] = await db
    .update(pieceAssets)
    .set({
      assetType: assetType as AssetType,
      pieceId,
      title,
      versionLabel,
    })
    .where(eq(pieceAssets.id, assetId))
    .returning({ id: pieceAssets.id });

  if (!asset) {
    return NextResponse.json({ error: "Asset not found." }, { status: 404 });
  }

  return NextResponse.json({ id: asset.id });
}
