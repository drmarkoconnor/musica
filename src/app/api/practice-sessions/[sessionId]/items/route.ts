import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { createDatabaseClient } from "@/db/client";
import { sessionItems } from "@/db/schema";
import {
  isUuid,
  parseSessionItemPayload,
  type SessionItemRequestBody,
} from "@/lib/server/session-payload";

export async function POST(
  request: Request,
  context: { params: Promise<{ sessionId: string }> },
) {
  const { sessionId } = await context.params;

  if (!isUuid(sessionId)) {
    return NextResponse.json({ error: "Session ID is invalid." }, { status: 400 });
  }

  let body: SessionItemRequestBody;

  try {
    body = (await request.json()) as SessionItemRequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const db = createDatabaseClient();
  const [lastItem] = await db
    .select({ position: sessionItems.position })
    .from(sessionItems)
    .where(eq(sessionItems.practiceSessionId, sessionId))
    .orderBy(desc(sessionItems.position))
    .limit(1);
  const parsed = parseSessionItemPayload(body, (lastItem?.position ?? 0) + 1);

  if ("error" in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const [item] = await db
    .insert(sessionItems)
    .values({
      ...parsed.value,
      practiceSessionId: sessionId,
    })
    .returning({
      id: sessionItems.id,
      position: sessionItems.position,
    });

  return NextResponse.json(item, { status: 201 });
}
