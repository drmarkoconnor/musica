export type SearchablePassage = { id: string; text: string; startsAtSeconds: number; endsAtSeconds: number; precision: "approximate" | "segment" | "timed" };

export function searchLessonPassages<T extends SearchablePassage>(passages: T[], query: string): T[] {
  const words = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  return words.length ? passages.filter((passage) => words.every((word) => passage.text.toLocaleLowerCase().includes(word))) : passages;
}

export function parseLessonTime(value: string): number | null {
  if (!/^\d+(?::\d{1,2}){0,2}$/.test(value.trim())) return null;
  const parts = value.trim().split(":").map(Number);
  if (parts.length > 1 && parts.slice(1).some((part) => part >= 60)) return null;
  const seconds = parts.reduce((total, part) => total * 60 + part, 0);
  return Number.isSafeInteger(seconds) ? seconds : null;
}
