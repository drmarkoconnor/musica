import { NextResponse } from "next/server";
import { createDatabaseClient } from "@/db/client";
import { pieces } from "@/db/schema";
import {
  parsePiecePayload,
  type PieceRequestBody,
} from "@/lib/server/piece-payload";

export async function POST(request: Request) {
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
    .insert(pieces)
    .values(payload.value)
    .returning({ id: pieces.id });

  return NextResponse.json({ id: piece.id }, { status: 201 });
}
