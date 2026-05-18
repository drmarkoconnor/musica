import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { createDatabaseClient } from "@/db/client";
import { pieces } from "@/db/schema";
import {
  parsePiecePayload,
  type PieceRequestBody,
} from "@/lib/server/piece-payload";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ pieceId: string }> },
) {
  const { pieceId } = await context.params;
  let body: PieceRequestBody;

  try {
    body = (await request.json()) as PieceRequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const payload = parsePiecePayload(body);
  if ("error" in payload) {
    return NextResponse.json({ error: payload.error }, { status: 400 });
  }

  const db = createDatabaseClient();
  const [piece] = await db
    .update(pieces)
    .set(payload.value)
    .where(eq(pieces.id, pieceId))
    .returning({ id: pieces.id });

  if (!piece) {
    return NextResponse.json({ error: "Piece not found." }, { status: 404 });
  }

  return NextResponse.json({ id: piece.id });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ pieceId: string }> },
) {
  const { pieceId } = await context.params;
  const db = createDatabaseClient();

  const [piece] = await db
    .delete(pieces)
    .where(eq(pieces.id, pieceId))
    .returning({ id: pieces.id });

  if (!piece) {
    return NextResponse.json({ error: "Piece not found." }, { status: 404 });
  }

  return NextResponse.json({ id: piece.id });
}
