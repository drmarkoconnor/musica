import { NextResponse } from "next/server";
import {
  isLearningPointId,
  LearningPointError,
  parseLearningPointUpdate,
  updateLearningPoint,
} from "@/lib/server/learning-points";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  if (!isLearningPointId(id)) {
    return NextResponse.json({ error: "Learning point ID is invalid." }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  try {
    const updates = parseLearningPointUpdate(body);
    if (process.env.PRACTICE_LOOP_DATA_SOURCE !== "neon") {
      throw new LearningPointError("Changes are unavailable in the demonstration data.", 409);
    }
    const learningPoint = await updateLearningPoint(id, updates);
    return NextResponse.json({ learningPoint });
  } catch (error) {
    if (error instanceof LearningPointError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Learning point update failed", error);
    return NextResponse.json({ error: "The learning point could not be saved." }, { status: 500 });
  }
}
