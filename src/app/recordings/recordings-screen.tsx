"use client";

import { Mic2, MessageSquareText, Radio } from "lucide-react";
import { AudioStrip } from "@/components/audio-strip";
import { Section } from "@/components/section";
import { StatusPill } from "@/components/status-pill";
import type { PracticeLoopReadModel } from "@/lib/data";
import { useLanguage } from "@/lib/language";

function practiceRecordingAudioSrc(recording: { id: string; storageBucket: string }) {
  if (
    recording.storageBucket === "local-practice-audio" ||
    recording.storageBucket === "netlify-blobs"
  ) {
    return `/api/practice-recordings/${recording.id}/file`;
  }

  return undefined;
}

export function RecordingsScreen({ data }: { data: PracticeLoopReadModel }) {
  const { t } = useLanguage();
  const { exercises, lessons, pieces, recordings } = data;
  const lessonRecordings = recordings.filter((item) => item.kind === "lesson");
  const practiceRecordings = recordings.filter((item) => item.kind !== "lesson");

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Section title={t("lessonRecordings")}>
        <div className="space-y-3">
          {lessonRecordings.map((recording) => {
            const lesson = lessons.find((item) => item.id === recording.lessonId);
            return (
              <article
                className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm"
                key={recording.id}
              >
                <div className="mb-4 flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-emerald-50 text-emerald-900">
                      <Mic2 aria-hidden="true" className="h-5 w-5" />
                    </span>
                    <div>
                      <h2 className="font-semibold text-stone-950">
                        {recording.title}
                      </h2>
                      <p className="mt-1 text-sm text-stone-500">
                        {lesson?.title ?? t("notYet")}
                      </p>
                    </div>
                  </div>
                  <StatusPill tone="blue">{recording.kind}</StatusPill>
                </div>
                <AudioStrip title={recording.title} />
              </article>
            );
          })}
        </div>
      </Section>

      <Section title={t("practiceRecordings")}>
        <div className="space-y-3">
          {practiceRecordings.map((recording) => {
            const piece = recording.pieceId
              ? pieces.find((item) => item.id === recording.pieceId)
              : null;
            const exercise = recording.exerciseId
              ? exercises.find((item) => item.id === recording.exerciseId)
              : null;

            return (
              <article
                className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm"
                key={recording.id}
              >
                <div className="mb-4 flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-sky-50 text-sky-900">
                      <Radio aria-hidden="true" className="h-5 w-5" />
                    </span>
                    <div>
                      <h2 className="font-semibold text-stone-950">
                        {recording.title}
                      </h2>
                      <p className="mt-1 text-sm text-stone-500">
                        {piece?.title ?? exercise?.title ?? t("notYet")}
                      </p>
                    </div>
                  </div>
                  <StatusPill
                    tone={recording.kind === "voice_note" ? "amber" : "green"}
                  >
                    {recording.kind}
                  </StatusPill>
                </div>
                <AudioStrip
                  audioSrc={practiceRecordingAudioSrc(recording)}
                  title={recording.title}
                />
                {recording.spokenNote ? (
                  <div className="mt-4 flex items-start gap-3 rounded-lg bg-stone-50 p-3">
                    <MessageSquareText
                      aria-hidden="true"
                      className="mt-0.5 h-5 w-5 text-stone-500"
                    />
                    <p className="text-sm leading-6 text-stone-700">
                      {recording.spokenNote}
                    </p>
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      </Section>
    </div>
  );
}
