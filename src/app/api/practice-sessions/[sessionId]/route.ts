import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { createDatabaseClient } from "@/db/client";
import { practiceSessions } from "@/db/schema";
import { isUuid, optionalText } from "@/lib/server/session-payload";

type PracticeSessionUpdateBody = {
  ended?: unknown;
  notes?: unknown;
};

export async function PATCH(
  request: Request,
  context: { params: Promise<{ sessionId: string }> },
) {
  const { sessionId } = await context.params;

  if (!isUuid(sessionId)) {
    return NextResponse.json({ error: "Session ID is invalid." }, { status: 400 });
  }

  let body: PracticeSessionUpdateBody;

  try {
    body = (await request.json()) as PracticeSessionUpdateBody;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const db = createDatabaseClient();
  const [session] = await db
    .update(practiceSessions)
    .set({
      endedAt: body.ended === true ? new Date().toISOString() : null,
      notes: optionalText(body.notes),
    })
    .where(eq(practiceSessions.id, sessionId))
    .returning({ id: practiceSessions.id });

  if (!session) {
    return NextResponse.json({ error: "Session not found." }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
