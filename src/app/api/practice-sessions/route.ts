import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { createDatabaseClient } from "@/db/client";
import { practiceSessions, sessionItems } from "@/db/schema";
import {
  parseSessionItemPayload,
  type SessionItemRequestBody,
} from "@/lib/server/session-payload";

type PracticeSessionRequestBody = {
  items?: unknown;
};

export async function POST(request: Request) {
  let body: PracticeSessionRequestBody;

  try {
    body = (await request.json()) as PracticeSessionRequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (!Array.isArray(body.items) || body.items.length === 0) {
    return NextResponse.json(
      { error: "Add at least one practice item before starting." },
      { status: 400 },
    );
  }

  const parsedItems = body.items.map((item, index) =>
    parseSessionItemPayload(item as SessionItemRequestBody, index + 1),
  );
  const firstError = parsedItems.find((item) => "error" in item);

  if (firstError && "error" in firstError) {
    return NextResponse.json({ error: firstError.error }, { status: 400 });
  }

  const db = createDatabaseClient();
  let sessionId: string | null = null;

  try {
    const [session] = await db
      .insert(practiceSessions)
      .values({ startedAt: new Date().toISOString() })
      .returning({ id: practiceSessions.id });

    sessionId = session.id;

    const insertedItems = await db
      .insert(sessionItems)
      .values(
        parsedItems.map((item) => {
          if ("error" in item) {
            throw new Error(item.error);
          }

          return {
            ...item.value,
            practiceSessionId: session.id,
          };
        }),
      )
      .returning({
        id: sessionItems.id,
        position: sessionItems.position,
      });

    return NextResponse.json(
      { id: session.id, items: insertedItems },
      { status: 201 },
    );
  } catch (error) {
    console.error("Practice session create failed", error);

    if (sessionId) {
      await db
        .delete(practiceSessions)
        .where(eq(practiceSessions.id, sessionId))
        .catch((cleanupError) => {
          console.error("Practice session cleanup failed", cleanupError);
        });
    }

    return NextResponse.json(
      { error: "Session could not be started." },
      { status: 500 },
    );
  }
}
