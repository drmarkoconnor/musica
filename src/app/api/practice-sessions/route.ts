import { NextResponse } from "next/server";
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
  const result = await db.transaction(async (tx) => {
    const [session] = await tx
      .insert(practiceSessions)
      .values({ startedAt: new Date().toISOString() })
      .returning({ id: practiceSessions.id });

    const insertedItems = await tx
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

    return { id: session.id, items: insertedItems };
  });

  return NextResponse.json(result, { status: 201 });
}
