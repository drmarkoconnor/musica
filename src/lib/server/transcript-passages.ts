import type { LessonEvidence } from "@/lib/server/lesson-analysis";
import type { TranscriptionJobChunkRow } from "@/db/schema";

export function evidenceFromChunks(chunks: TranscriptionJobChunkRow[], mode: string): LessonEvidence[] {
  return chunks.filter((chunk) => chunk.status === "complete").flatMap((chunk) => {
    if (!chunk.timedSegments?.length) return chunk.text?.trim() ? [{ id: chunk.id, startsAtSeconds: chunk.startsAtSeconds, endsAtSeconds: chunk.endsAtSeconds, text: chunk.text, segmentId: chunk.segmentId ?? undefined, precision: mode === "selected_segments" ? "segment" as const : "approximate" as const }] : [];
    const passages: LessonEvidence[] = [];
    for (const segment of chunk.timedSegments) {
      const start = Math.max(chunk.startsAtSeconds, Math.floor(chunk.startsAtSeconds + segment.startsAtSeconds));
      const end = Math.min(chunk.endsAtSeconds, Math.ceil(chunk.startsAtSeconds + segment.endsAtSeconds));
      if (!segment.text.trim() || end <= start) continue;
      const previous = passages.at(-1);
      if (previous && end - previous.startsAtSeconds <= 35 && start - previous.endsAtSeconds <= 3) {
        previous.endsAtSeconds = end;
        previous.text += ` ${segment.text}`;
      } else passages.push({ id: `${chunk.id}:${passages.length}`, startsAtSeconds: start, endsAtSeconds: end, text: segment.text, segmentId: chunk.segmentId ?? undefined, precision: "timed" });
    }
    return passages;
  });
}
