export type LessonRequestBody = {
  title?: unknown;
  teacher?: unknown;
  lessonDate?: unknown;
  summary?: unknown;
};

function optionalText(value: unknown) {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

export function parseLessonPayload(body: LessonRequestBody) {
  const title = optionalText(body.title);
  const lessonDate = optionalText(body.lessonDate);

  if (!title) {
    return { error: "Title is required." };
  }

  if (!lessonDate || !/^\d{4}-\d{2}-\d{2}$/.test(lessonDate)) {
    return { error: "Lesson date must be a YYYY-MM-DD date." };
  }

  return {
    value: {
      title,
      teacher: optionalText(body.teacher),
      lessonDate,
      status: "draft" as const,
      summary: optionalText(body.summary),
      updatedAt: new Date().toISOString(),
    },
  };
}
