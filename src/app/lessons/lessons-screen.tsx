"use client";

import {
  type ChangeEvent,
  FormEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  BookOpen,
  Check,
  Edit3,
  Mic2,
  Plus,
  Search,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { AudioStrip } from "@/components/audio-strip";
import { ComingSoonButton } from "@/components/coming-soon-button";
import { LessonRecorder } from "@/components/lesson-recorder";
import { LessonSegmentReview } from "@/components/lesson-segment-review";
import { Section } from "@/components/section";
import { StatusPill } from "@/components/status-pill";
import { TranscriptionGate } from "@/components/transcription-password-modal";
import type { PracticeLoopReadModel } from "@/lib/data";
import { useLanguage } from "@/lib/language";
import type { LessonExtract } from "@/lib/types";
import { formatDuration } from "@/lib/utils";

type LessonFormValues = {
  title: string;
  teacher: string;
  lessonDate: string;
  summary: string;
};

type LiveRecordingPreview = {
  phase: "recording" | "saving";
  startedAt: Date;
};

type MemoryTipTopic =
  | "harmony"
  | "rhythm"
  | "repertoire"
  | "technique"
  | "vocal"
  | "general";

type MemoryTip = {
  audioSrc: string | undefined;
  body: string;
  endsAtSeconds: number;
  id: string;
  lessonDate: string;
  lessonId: string;
  lessonTitle: string;
  practiceExtracts: LessonExtract[];
  recordingId: string;
  startsAtSeconds: number;
  title: string;
  topic: MemoryTipTopic;
  transcript: string;
};

const MEMORY_TIP_TOPIC_LABELS = {
  general: "topicGeneralAdvice",
  harmony: "topicHarmony",
  repertoire: "topicRepertoire",
  rhythm: "topicRhythm",
  technique: "topicTechnique",
  vocal: "topicVocal",
} as const;

const AUDIO_UPLOAD_TIMEOUT_MS = 120000;

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

function localLessonDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function previewLessonTitle(date: Date) {
  const label = new Intl.DateTimeFormat(undefined, {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);

  return `Leo lesson - ${label}`;
}

function emptyLessonForm(): LessonFormValues {
  return {
    title: "",
    teacher: "Leo",
    lessonDate: todayDate(),
    summary: "",
  };
}

function audioDurationForFile(file: File) {
  return new Promise<number | null>((resolve) => {
    const audio = document.createElement("audio");
    const url = URL.createObjectURL(file);
    const timeoutId = window.setTimeout(() => {
      URL.revokeObjectURL(url);
      resolve(null);
    }, 5000);

    audio.preload = "metadata";
    audio.onloadedmetadata = () => {
      window.clearTimeout(timeoutId);
      URL.revokeObjectURL(url);
      resolve(Number.isFinite(audio.duration) ? Math.round(audio.duration) : null);
    };
    audio.onerror = () => {
      window.clearTimeout(timeoutId);
      URL.revokeObjectURL(url);
      resolve(null);
    };
    audio.src = url;
  });
}

async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit,
  timeoutMs: number,
) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    window.clearTimeout(timeoutId);
  }
}

function transcriptBulletItems(text: string) {
  return text
    .split(/\n+|(?<=[.!?])\s+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function summaryBulletItems(text: string) {
  return text
    .split(/\n+/)
    .map((item) => item.replace(/^[-*]\s*/, "").trim())
    .filter(Boolean);
}

function audioSrcForRecording(recording?: { id: string; storageBucket: string }) {
  if (
    recording?.storageBucket === "local-test-audio" ||
    recording?.storageBucket === "local-lesson-audio" ||
    recording?.storageBucket === "netlify-blobs"
  ) {
    return `/api/lesson-recordings/${recording.id}/file`;
  }

  return undefined;
}

function memoryTipTopicForText(text: string): MemoryTipTopic {
  const normalized = text.toLowerCase();

  if (
    /\b(sing|singer|voice|vocal|phrase|phrasing|breath|lyric)\b/.test(normalized)
  ) {
    return "vocal";
  }

  if (
    /\b(chord|voicing|harmony|scale|minor|major|diminished|ii|dominant|rootless|slash)\b/.test(
      normalized,
    )
  ) {
    return "harmony";
  }

  if (
    /\b(tune|song|standard|bridge|chorus|melody|passage|goodbye|valentine|autumn)\b/.test(
      normalized,
    )
  ) {
    return "repertoire";
  }

  if (/\b(rhythm|time|swing|comp|groove|pulse)\b/.test(normalized)) {
    return "rhythm";
  }

  if (
    /\b(finger|fingering|hand|touch|relax|technique|tempo)\b/.test(normalized)
  ) {
    return "technique";
  }

  return "general";
}

export function LessonsScreen({ data }: { data: PracticeLoopReadModel }) {
  const { t } = useLanguage();
  const router = useRouter();
  const {
    lessonExtracts,
    lessonRecordings,
    lessons,
    lessonSegments,
    lessonSegmentTranscripts,
    transcripts,
  } = data;
  const captureInputRef = useRef<HTMLInputElement>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const [showDeviceCapture, setShowDeviceCapture] = useState(false);
  const sortedLessons = [...lessons].sort((a, b) =>
    (
      lessonRecordings.find((item) => item.lessonId === b.id)?.recordedAt ??
      b.lessonDate
    ).localeCompare(
      lessonRecordings.find((item) => item.lessonId === a.id)?.recordedAt ??
        a.lessonDate,
    ),
  );
  const [selectedLessonId, setSelectedLessonId] = useState("");
  const [liveRecordingPreview, setLiveRecordingPreview] =
    useState<LiveRecordingPreview | null>(null);
  const [pendingSavedLessonId, setPendingSavedLessonId] = useState("");
  const activeLesson =
    liveRecordingPreview === null && selectedLessonId
      ? sortedLessons.find((lesson) => lesson.id === selectedLessonId)
      : undefined;
  const recordingsForActiveLesson = activeLesson
    ? lessonRecordings
        .filter((item) => item.lessonId === activeLesson.id)
        .sort((a, b) => a.recordedAt.localeCompare(b.recordedAt))
    : [];
  const recording = recordingsForActiveLesson.at(-1);
  const recordingAudioSrc = audioSrcForRecording(recording);
  const segmentsForRecording = recording
    ? lessonSegments
        .filter((item) => item.recordingId === recording.id)
        .sort((a, b) => a.startsAtSeconds - b.startsAtSeconds)
    : [];
  const segmentById = new Map(segmentsForRecording.map((item) => [item.id, item]));
  const segmentTranscriptsForRecording = recording
    ? lessonSegmentTranscripts
        .filter((item) => item.recordingId === recording.id)
        .sort((a, b) => {
          const segmentA = segmentById.get(a.segmentId);
          const segmentB = segmentById.get(b.segmentId);

          return (
            (segmentA?.startsAtSeconds ?? 0) - (segmentB?.startsAtSeconds ?? 0)
          );
        })
    : [];
  const selectedSegmentSeconds = segmentsForRecording
    .filter((item) => item.status === "selected")
    .reduce(
      (total, item) =>
        total + Math.max(item.endsAtSeconds - item.startsAtSeconds, 0),
      0,
    );
  const selectedSegmentCount = segmentsForRecording.filter(
    (item) => item.status === "selected",
  ).length;
  const lessonTranscripts = activeLesson
    ? transcripts.filter((item) => item.lessonId === activeLesson.id)
    : [];
  const transcript = lessonTranscripts[0];
  const extracts = activeLesson
    ? lessonExtracts.filter((item) => item.lessonId === activeLesson.id)
    : [];
  const unlinkedExtracts = extracts.filter((item) => !item.segmentId);
  const joinedTranscriptText = lessonTranscripts.map((item) => item.text).join("\n");
  const executiveSummaryItems = summaryBulletItems(activeLesson?.summary ?? "");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formValues, setFormValues] = useState<LessonFormValues>(emptyLessonForm);
  const [saveState, setSaveState] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const [uploadState, setUploadState] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const [extractActionState, setExtractActionState] = useState<
    Record<string, "idle" | "saving" | "saved" | "error">
  >({});
  const [errorMessage, setErrorMessage] = useState("");
  const [pendingDeleteLessonId, setPendingDeleteLessonId] = useState("");
  const [lessonDeleteState, setLessonDeleteState] = useState<
    "idle" | "saving" | "error"
  >("idle");
  const [memoryTipSearch, setMemoryTipSearch] = useState("");
  const [memoryTipTopicFilter, setMemoryTipTopicFilter] = useState<
    MemoryTipTopic | "all"
  >("all");
  const memoryTips = useMemo(() => {
    const lessonById = new Map(lessons.map((item) => [item.id, item]));
    const recordingById = new Map(lessonRecordings.map((item) => [item.id, item]));
    const segmentByTipId = new Map(lessonSegments.map((item) => [item.id, item]));
    const extractsBySegmentId = new Map<string, LessonExtract[]>();

    lessonExtracts.forEach((extract) => {
      if (!extract.segmentId || extract.status === "discarded") return;

      const current = extractsBySegmentId.get(extract.segmentId) ?? [];
      current.push(extract);
      extractsBySegmentId.set(extract.segmentId, current);
    });

    return lessonSegmentTranscripts
      .filter((memory) => memory.status === "complete")
      .map((memory) => {
        const segment = segmentByTipId.get(memory.segmentId);
        const lesson = lessonById.get(memory.lessonId);
        const recording = recordingById.get(memory.recordingId);

        if (!segment || !lesson || !recording) return null;

        const title = memory.summaryTitle || segment.title;
        const body = memory.summaryBody || segment.notes || t("clipMemoryCaptured");
        const topic = memoryTipTopicForText(
          [title, body, segment.notes, memory.text].join(" "),
        );

        return {
          audioSrc: audioSrcForRecording(recording),
          body,
          endsAtSeconds: segment.endsAtSeconds,
          id: memory.id,
          lessonDate: lesson.lessonDate,
          lessonId: lesson.id,
          lessonTitle: lesson.title,
          practiceExtracts: extractsBySegmentId.get(segment.id) ?? [],
          recordingId: recording.id,
          startsAtSeconds: segment.startsAtSeconds,
          title,
          topic,
          transcript: memory.text,
        } satisfies MemoryTip;
      })
      .filter((tip): tip is MemoryTip => tip !== null)
      .sort((a, b) => {
        const lessonOrder = b.lessonDate.localeCompare(a.lessonDate);
        if (lessonOrder !== 0) return lessonOrder;

        return a.startsAtSeconds - b.startsAtSeconds;
      });
  }, [
    lessonExtracts,
    lessonRecordings,
    lessonSegmentTranscripts,
    lessonSegments,
    lessons,
    t,
  ]);
  const availableMemoryTipTopics = (
    ["harmony", "repertoire", "rhythm", "technique", "vocal", "general"] as const
  ).filter((topic) => memoryTips.some((tip) => tip.topic === topic));
  const filteredMemoryTips = useMemo(() => {
    const query = memoryTipSearch.trim().toLowerCase();

    return memoryTips.filter((tip) => {
      if (memoryTipTopicFilter !== "all" && tip.topic !== memoryTipTopicFilter) {
        return false;
      }

      if (!query) return true;

      const haystack = [
        tip.body,
        tip.lessonDate,
        tip.lessonTitle,
        tip.title,
        tip.transcript,
        ...tip.practiceExtracts.map((extract) => `${extract.title} ${extract.body}`),
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [memoryTipSearch, memoryTipTopicFilter, memoryTips]);
  const memoryTipsForActiveRecording = recording
    ? memoryTips.filter((tip) => tip.recordingId === recording.id)
    : [];

  useEffect(() => {
    const coarsePointer =
      typeof window !== "undefined" &&
      window.matchMedia("(pointer: coarse)").matches;
    const touchCapable =
      typeof navigator !== "undefined" && navigator.maxTouchPoints > 1;

    setShowDeviceCapture(coarsePointer || touchCapable);
  }, []);

  useEffect(() => {
    if (
      pendingSavedLessonId &&
      sortedLessons.some((lesson) => lesson.id === pendingSavedLessonId)
    ) {
      setLiveRecordingPreview(null);
      setPendingSavedLessonId("");
    }
  }, [pendingSavedLessonId, sortedLessons]);

  function openModal() {
    setIsModalOpen(true);
    setFormValues(emptyLessonForm());
    setSaveState("idle");
    setErrorMessage("");
  }

  function closeModal() {
    setIsModalOpen(false);
    setFormValues(emptyLessonForm());
    setSaveState("idle");
    setErrorMessage("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaveState("saving");
    setErrorMessage("");

    const response = await fetch("/api/lessons", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(formValues),
    });

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      setSaveState("error");
      setErrorMessage(body?.error ?? t("saveFailed"));
      return;
    }

    setSaveState("saved");
    const body = (await response.json().catch(() => null)) as {
      id?: string;
    } | null;
    if (body?.id) {
      setSelectedLessonId(body.id);
    }
    router.refresh();
    setTimeout(() => closeModal(), 250);
  }

  async function handleDeleteEmptyLesson(lessonId: string) {
    setLessonDeleteState("saving");
    setErrorMessage("");

    const response = await fetch(`/api/lessons/${lessonId}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      setLessonDeleteState("error");
      setErrorMessage(body?.error ?? t("saveFailed"));
      return;
    }

    if (selectedLessonId === lessonId) {
      setSelectedLessonId("");
    }
    setPendingDeleteLessonId("");
    setLessonDeleteState("idle");
    router.refresh();
  }

  async function handleAudioUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.currentTarget.value = "";

    if (!file) return;

    setUploadState("saving");
    setErrorMessage("");

    const recordedAt = file.lastModified ? new Date(file.lastModified) : new Date();
    const formData = new FormData();
    const durationSeconds = await audioDurationForFile(file);

    formData.append("audio", file);
    formData.append("title", activeLesson?.title ?? previewLessonTitle(recordedAt));
    formData.append("teacher", activeLesson?.teacher ?? "Leo");
    formData.append(
      "lessonDate",
      activeLesson?.lessonDate ?? localLessonDate(recordedAt),
    );
    formData.append("recordedAt", recordedAt.toISOString());
    formData.append(
      "summary",
      activeLesson?.summary ||
        "Uploaded in Practice Loop. Ready for authorised transcription.",
    );
    if (activeLesson) {
      formData.append("lessonId", activeLesson.id);
    }
    if (durationSeconds) {
      formData.append("durationSeconds", String(durationSeconds));
    }

    let response: Response;

    try {
      response = await fetchWithTimeout(
        "/api/lesson-recordings/upload",
        {
          body: formData,
          method: "POST",
        },
        AUDIO_UPLOAD_TIMEOUT_MS,
      );
    } catch (error) {
      setUploadState("error");
      setErrorMessage(
        error instanceof Error && error.name === "AbortError"
          ? t("recordingUploadTimedOut")
          : t("recordingUploadFailed"),
      );
      return;
    }

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;

      setUploadState("error");
      setErrorMessage(body?.error ?? t("recordingUploadFailed"));
      return;
    }

    const body = (await response.json().catch(() => null)) as {
      lessonId?: string;
    } | null;

    if (body?.lessonId) {
      setSelectedLessonId(body.lessonId);
    }

    setUploadState("saved");
    router.refresh();
  }

  async function handleExtractAction(
    extractId: string,
    action: "keep" | "discard",
  ) {
    setExtractActionState((current) => ({ ...current, [extractId]: "saving" }));

    const response = await fetch(`/api/lesson-extracts/${extractId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });

    if (!response.ok) {
      setExtractActionState((current) => ({ ...current, [extractId]: "error" }));
      return;
    }

    setExtractActionState((current) => ({ ...current, [extractId]: "saved" }));
    router.refresh();
  }

  function clipBoundsForExtract(extract: LessonExtract) {
    const sourceSegment =
      (extract.segmentId ? segmentById.get(extract.segmentId) : undefined) ??
      segmentsForRecording.find(
        (segment) =>
          extract.startsAtSeconds >= segment.startsAtSeconds &&
          extract.startsAtSeconds <= segment.endsAtSeconds,
      );

    return {
      endsAtSeconds: extract.endsAtSeconds ?? sourceSegment?.endsAtSeconds,
      startsAtSeconds: extract.startsAtSeconds,
    };
  }

  function renderExtractActions(extract: LessonExtract) {
    const actionState = extractActionState[extract.id] ?? "idle";

    return (
      <div className="mt-3 flex flex-wrap gap-2">
        {extract.status === "candidate" ? (
          <button
            className="inline-flex items-center justify-center gap-2 rounded-md bg-emerald-950 px-3 py-2 text-sm font-semibold text-white transition hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={actionState === "saving"}
            onClick={() => void handleExtractAction(extract.id, "keep")}
            type="button"
          >
            <Check aria-hidden="true" className="h-4 w-4" />
            {actionState === "saving" ? t("saving") : t("keep")}
          </button>
        ) : null}
        <ComingSoonButton icon={Edit3}>{t("edit")}</ComingSoonButton>
        {extract.status === "candidate" ? (
          <button
            className="inline-flex items-center justify-center gap-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-800 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={actionState === "saving"}
            onClick={() => void handleExtractAction(extract.id, "discard")}
            type="button"
          >
            <Trash2 aria-hidden="true" className="h-4 w-4" />
            {t("discard")}
          </button>
        ) : null}
        {actionState === "error" ? (
          <p className="w-full rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
            {t("candidateActionFailed")}
          </p>
        ) : null}
      </div>
    );
  }

  function renderMemoryTipCard(
    tip: MemoryTip,
    options: { showSource?: boolean } = {},
  ) {
    return (
      <article
        className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm"
        key={tip.id}
      >
        <div className="grid gap-4 lg:grid-cols-[12rem_minmax(0,1fr)]">
          <div className="rounded-md bg-stone-950 px-3 py-3 text-white">
            <p className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-stone-300">
              {t("clipTime")}
            </p>
            <p className="mt-1 text-xl font-semibold tabular-nums">
              {formatDuration(tip.startsAtSeconds)} -{" "}
              {formatDuration(tip.endsAtSeconds)}
            </p>
            <p className="mt-2 text-xs leading-5 text-stone-300">
              {tip.lessonDate}
            </p>
          </div>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-emerald-800">
                {t("memoryTip")}
              </p>
              <StatusPill tone="blue">
                {t(MEMORY_TIP_TOPIC_LABELS[tip.topic])}
              </StatusPill>
            </div>
            <h3 className="mt-1 text-lg font-semibold leading-tight text-stone-950">
              {tip.title}
            </h3>
            <p className="mt-2 text-sm leading-6 text-stone-700">{tip.body}</p>

            <div className="mt-3 grid gap-3 md:grid-cols-[1fr_auto] md:items-center">
              <AudioStrip
                audioSrc={tip.audioSrc}
                controlsMode="buttons"
                density="compact"
                endsAtSeconds={tip.endsAtSeconds}
                showLabel={false}
                showWaveform={false}
                startsAtSeconds={tip.startsAtSeconds}
                title={tip.title}
              />
              {options.showSource ? (
                <button
                  className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-stone-300 bg-white px-3 py-2 text-sm font-semibold text-stone-700 transition hover:bg-stone-100"
                  onClick={() => setSelectedLessonId(tip.lessonId)}
                  type="button"
                >
                  <BookOpen aria-hidden="true" className="h-4 w-4" />
                  {t("openSourceLesson")}
                </button>
              ) : null}
            </div>

            <details className="mt-3 rounded-md border border-stone-200 bg-stone-50">
              <summary className="cursor-pointer px-3 py-2 text-sm font-semibold text-stone-800">
                {t("clipTranscript")}
              </summary>
              <p className="border-t border-stone-200 bg-white px-3 py-3 text-sm leading-6 text-stone-700">
                {tip.transcript || t("notYet")}
              </p>
            </details>

            <div className="mt-3 rounded-md border border-stone-200 bg-stone-50 p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h4 className="text-sm font-semibold text-stone-950">
                    {t("relatedPractice")}
                  </h4>
                  <p className="mt-1 text-xs leading-5 text-stone-500">
                    {tip.lessonTitle}
                  </p>
                </div>
                <StatusPill tone={tip.practiceExtracts.length > 0 ? "green" : "slate"}>
                  {tip.practiceExtracts.length} {t("practiceElement")}
                </StatusPill>
              </div>

              {tip.practiceExtracts.length === 0 ? (
                <p className="mt-2 text-sm leading-6 text-stone-600">
                  {t("memoryTipNoPractice")}
                </p>
              ) : (
                <div className="mt-3 space-y-3">
                  {tip.practiceExtracts.map((extract) => (
                    <div
                      className="rounded-md border border-stone-200 bg-white p-3"
                      key={extract.id}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <h5 className="text-sm font-semibold text-stone-950">
                            {extract.title}
                          </h5>
                          <p className="mt-1 whitespace-pre-line text-sm leading-6 text-stone-600">
                            {extract.body}
                          </p>
                        </div>
                        <StatusPill
                          tone={extract.status === "kept" ? "green" : "slate"}
                        >
                          {extract.status}
                        </StatusPill>
                      </div>
                      {renderExtractActions(extract)}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </article>
    );
  }

  return (
    <div className="space-y-8">
      <div className="grid gap-4 xl:grid-cols-[24rem_minmax(0,1fr)]">
        <section className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm xl:sticky xl:top-36 xl:self-start">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-emerald-800">
                {t("lessons")}
              </p>
              <h1 className="mt-1 text-2xl font-semibold text-stone-950">
                {liveRecordingPreview
                  ? previewLessonTitle(liveRecordingPreview.startedAt)
                  : t("lessons")}
              </h1>
              {liveRecordingPreview ? (
                <p className="mt-2 text-sm text-stone-600">
                  {localLessonDate(liveRecordingPreview.startedAt)} / Leo
                </p>
              ) : activeLesson ? (
                <p className="mt-2 text-sm text-stone-600">
                  {activeLesson.lessonDate} / {activeLesson.teacher}
                </p>
              ) : null}
            </div>
            {liveRecordingPreview ? (
              <StatusPill
                tone={liveRecordingPreview.phase === "saving" ? "amber" : "rose"}
              >
                {liveRecordingPreview.phase === "saving"
                  ? t("savingRecording")
                  : t("recordingNow")}
              </StatusPill>
            ) : activeLesson ? (
              <StatusPill tone="green">{activeLesson.status}</StatusPill>
            ) : null}
          </div>
          <p className="mt-4 whitespace-pre-line text-sm leading-6 text-stone-600">
            {liveRecordingPreview
              ? t("recordingWillCreateLesson")
              : t("selectLessonOrRecord")}
          </p>
          <div className="mt-5 flex flex-col gap-2">
            <button
              className="w-full disabled:cursor-not-allowed disabled:opacity-60"
              disabled={liveRecordingPreview !== null}
              onClick={openModal}
              type="button"
            >
              <span className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-md bg-emerald-950 px-3 py-3 text-sm font-semibold text-white transition hover:bg-emerald-900">
                <Plus aria-hidden="true" className="h-4 w-4" />
                {t("createLesson")}
              </span>
            </button>
            <LessonRecorder
              onRecordingFailed={() => {
                setLiveRecordingPreview(null);
                setPendingSavedLessonId("");
              }}
              onRecordingSaving={() => {
                setLiveRecordingPreview((current) =>
                  current ? { ...current, phase: "saving" } : current,
                );
              }}
              onRecordingStarted={(startedAt) => {
                setPendingSavedLessonId("");
                setLiveRecordingPreview({ phase: "recording", startedAt });
              }}
              onSaved={(lessonId) => {
                setSelectedLessonId(lessonId);
                setPendingSavedLessonId(lessonId);
                router.refresh();
              }}
            />
            {showDeviceCapture ? (
              <>
                <input
                  accept="audio/*"
                  capture="user"
                  className="hidden"
                  onChange={(event) => void handleAudioUpload(event)}
                  ref={captureInputRef}
                  type="file"
                />
                <button
                  className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-md border border-stone-300 bg-white px-3 py-3 text-sm font-semibold text-stone-700 transition hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={
                    liveRecordingPreview !== null || uploadState === "saving"
                  }
                  onClick={() => captureInputRef.current?.click()}
                  title={t("recordWithDeviceHelp")}
                  type="button"
                >
                  <Mic2 aria-hidden="true" className="h-4 w-4" />
                  {uploadState === "saving"
                    ? t("savingRecording")
                    : uploadState === "saved"
                      ? t("audioAttached")
                      : t("recordWithDevice")}
                </button>
              </>
            ) : null}
            <input
              accept="audio/*"
              className="hidden"
              onChange={(event) => void handleAudioUpload(event)}
              ref={uploadInputRef}
              type="file"
            />
            <button
              className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-md border border-stone-300 bg-white px-3 py-3 text-sm font-semibold text-stone-700 transition hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={liveRecordingPreview !== null || uploadState === "saving"}
              onClick={() => uploadInputRef.current?.click()}
              title={t("uploadAudioHelp")}
              type="button"
            >
              <Upload aria-hidden="true" className="h-4 w-4" />
              {uploadState === "saving"
                ? t("savingRecording")
                : uploadState === "saved"
                  ? t("audioAttached")
                  : t("uploadAudio")}
            </button>
            {uploadState === "error" && errorMessage ? (
              <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
                {errorMessage}
              </p>
            ) : null}
          </div>
          <div className="mt-6 border-t border-stone-200 pt-4">
            {lessonDeleteState === "error" && errorMessage ? (
              <p className="mb-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
                {errorMessage}
              </p>
            ) : null}
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold text-stone-950">
                {t("lessonHistory")}
              </h2>
              <span className="text-xs font-medium text-stone-500">
                {sortedLessons.length}
              </span>
            </div>
            <div className="mt-3 max-h-80 divide-y divide-stone-200 overflow-y-auto rounded-md border border-stone-200">
              {sortedLessons.map((lesson) => {
                const recordingCount = lessonRecordings.filter(
                  (item) => item.lessonId === lesson.id,
                ).length;
                const extractCount = lessonExtracts.filter(
                  (item) =>
                    item.lessonId === lesson.id && item.status !== "discarded",
                ).length;
                const transcriptCount = transcripts.filter(
                  (item) => item.lessonId === lesson.id,
                ).length;
                const isSelected = activeLesson?.id === lesson.id;
                const canDeleteWithoutRecordings = recordingCount === 0;
                const isConfirmingDelete = pendingDeleteLessonId === lesson.id;
                const isDeleting =
                  isConfirmingDelete && lessonDeleteState === "saving";

                return (
                  <div
                    className={isSelected ? "bg-emerald-50" : "bg-white"}
                    key={lesson.id}
                  >
                    <button
                      className="grid w-full grid-cols-[1fr_auto] gap-3 px-3 py-2 text-left transition hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-60"
                      disabled={liveRecordingPreview !== null}
                      onClick={() => setSelectedLessonId(lesson.id)}
                      type="button"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold text-stone-950">
                          {lesson.title}
                        </span>
                        <span className="mt-0.5 block text-xs text-stone-500">
                          {lesson.lessonDate} / {lesson.teacher || t("notYet")}
                        </span>
                      </span>
                      <span className="flex flex-col items-end gap-1 text-xs text-stone-500">
                        <span>
                          {recordingCount} {t("clips")}
                        </span>
                        <span>
                          {extractCount} {t("practiceElement")}
                        </span>
                      </span>
                    </button>
                    {canDeleteWithoutRecordings ? (
                      <div className="border-t border-stone-100 px-3 py-2">
                        {isConfirmingDelete ? (
                          <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-rose-200 bg-rose-50 px-2 py-1.5 text-xs text-rose-900">
                            <span>{t("confirmDeleteLesson")}</span>
                            <div className="flex gap-1.5">
                              <button
                                className="rounded-md bg-white px-2 py-1 font-semibold text-rose-800"
                                disabled={isDeleting}
                                onClick={() =>
                                  void handleDeleteEmptyLesson(lesson.id)
                                }
                                type="button"
                              >
                                {isDeleting ? t("saving") : t("delete")}
                              </button>
                              <button
                                className="rounded-md bg-white px-2 py-1 font-semibold text-stone-700"
                                disabled={isDeleting}
                                onClick={() => setPendingDeleteLessonId("")}
                                type="button"
                              >
                                {t("cancel")}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-semibold text-rose-800 transition hover:bg-rose-50"
                            onClick={() => setPendingDeleteLessonId(lesson.id)}
                            type="button"
                          >
                            <Trash2 aria-hidden="true" className="h-3.5 w-3.5" />
                            {t("deleteNoRecordingLesson")}
                          </button>
                        )}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section className="min-w-0 space-y-4 rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-2xl font-semibold leading-tight text-stone-950">
                {liveRecordingPreview
                  ? t("newLessonRecording")
                  : recording
                    ? t("latestClip")
                    : t("recordings")}
              </h2>
              <p className="mt-1 text-sm text-stone-500">
                {liveRecordingPreview
                  ? t("recordingWillCreateLesson")
                  : recording?.storagePath}
              </p>
            </div>
            <StatusPill
              tone={
                liveRecordingPreview
                  ? liveRecordingPreview.phase === "saving"
                    ? "amber"
                    : "rose"
                  : "blue"
              }
            >
              {liveRecordingPreview
                ? liveRecordingPreview.phase === "saving"
                  ? t("savingRecording")
                  : t("recordingNow")
                : t("ready")}
            </StatusPill>
          </div>
          {liveRecordingPreview ? (
            <div className="rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-900">
              {liveRecordingPreview.phase === "saving"
                ? t("savingRecording")
                : `${t("recordingStartedAt")} ${new Intl.DateTimeFormat(
                    undefined,
                    {
                      hour: "2-digit",
                      minute: "2-digit",
                    },
                  ).format(liveRecordingPreview.startedAt)}`}
            </div>
          ) : (
            <>
              {recording ? (
                <AudioStrip audioSrc={recordingAudioSrc} title={recording.title} />
              ) : null}
              {recordingsForActiveLesson.length > 1 ? (
                <div className="space-y-2">
                  {recordingsForActiveLesson.map((item, index) => (
                    <div
                      className="rounded-md border border-stone-200 p-2"
                      key={item.id}
                    >
                      <AudioStrip
                        audioSrc={audioSrcForRecording(item)}
                        title={`${t("recordings")} ${index + 1}`}
                      />
                    </div>
                  ))}
                </div>
              ) : null}
            </>
          )}
          {!liveRecordingPreview && !activeLesson ? (
            <div className="grid min-h-72 place-items-center rounded-lg border border-dashed border-stone-300 bg-stone-50 px-4 py-8 text-center">
              <div className="max-w-md">
                <p className="text-sm font-semibold text-stone-950">
                  {t("selectLessonOrRecord")}
                </p>
                <p className="mt-2 text-sm leading-6 text-stone-600">
                  {t("emptyLessonWorkspace")}
                </p>
              </div>
            </div>
          ) : null}
          {activeLesson && recording && recordingAudioSrc ? (
            <>
              {segmentTranscriptsForRecording.length === 0 ? (
                <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-950">
                  <div className="flex gap-2">
                    <AlertTriangle
                      aria-hidden="true"
                      className="mt-0.5 h-4 w-4 flex-none text-amber-800"
                    />
                    <div>
                      <p className="font-semibold">
                        {t("transcriptionClipFirstTitle")}
                      </p>
                      <p>{t("transcriptionClipFirstBody")}</p>
                    </div>
                  </div>
                </div>
              ) : null}
              <LessonSegmentReview
                audioSrc={recordingAudioSrc}
                durationSeconds={recording.durationSeconds}
                lessonId={activeLesson.id}
                lessonTitle={activeLesson.title}
                onChanged={() => router.refresh()}
                recordingId={recording.id}
                segments={segmentsForRecording}
              />
            </>
          ) : null}
          {recording ? (
            <TranscriptionGate
              lessonId={activeLesson?.id ?? ""}
              recordingDurationSeconds={recording.durationSeconds}
              recordingId={recording.id}
              selectedSegments={segmentsForRecording
                .filter((item) => item.status === "selected")
                .map((item) => ({
                  endsAtSeconds: item.endsAtSeconds,
                  id: item.id,
                  startsAtSeconds: item.startsAtSeconds,
                  title: item.title,
                }))}
              selectedSegmentCount={selectedSegmentCount}
              selectedSegmentSeconds={selectedSegmentSeconds}
              transcriptErrorMessage={transcript?.errorMessage}
              transcriptStatus={transcript?.status}
            />
          ) : null}
        </section>
      </div>

      {memoryTipsForActiveRecording.length > 0 ? (
        <Section title={t("usefulClipMemories")}>
          <div className="grid gap-3">
            {memoryTipsForActiveRecording.map((tip) => renderMemoryTipCard(tip))}
          </div>
        </Section>
      ) : null}

      {memoryTips.length > 0 ? (
        <Section eyebrow={t("memoryLibrary")} title={t("leoMemoryTips")}>
          <div className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
              <label className="block">
                <span className="sr-only">{t("searchMemoryTips")}</span>
                <span className="flex min-h-11 items-center gap-2 rounded-md border border-stone-300 bg-white px-3 py-2 text-stone-700 focus-within:border-emerald-800 focus-within:ring-2 focus-within:ring-emerald-800/20">
                  <Search aria-hidden="true" className="h-4 w-4 text-stone-500" />
                  <input
                    className="min-w-0 flex-1 bg-transparent text-sm text-stone-950 outline-none"
                    onChange={(event) => setMemoryTipSearch(event.target.value)}
                    placeholder={t("searchMemoryTips")}
                    value={memoryTipSearch}
                  />
                </span>
              </label>
              <span className="rounded-md bg-stone-50 px-3 py-2 text-sm font-semibold text-stone-700 ring-1 ring-stone-200">
                {filteredMemoryTips.length} / {memoryTips.length}
              </span>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <button
                aria-pressed={memoryTipTopicFilter === "all"}
                className={`rounded-md border px-3 py-2 text-sm font-semibold transition ${
                  memoryTipTopicFilter === "all"
                    ? "border-emerald-900 bg-emerald-950 text-white"
                    : "border-stone-300 bg-white text-stone-700 hover:bg-stone-100"
                }`}
                onClick={() => setMemoryTipTopicFilter("all")}
                type="button"
              >
                {t("allTopics")}
              </button>
              {availableMemoryTipTopics.map((topic) => (
                <button
                  aria-pressed={memoryTipTopicFilter === topic}
                  className={`rounded-md border px-3 py-2 text-sm font-semibold transition ${
                    memoryTipTopicFilter === topic
                      ? "border-emerald-900 bg-emerald-950 text-white"
                      : "border-stone-300 bg-white text-stone-700 hover:bg-stone-100"
                  }`}
                  key={topic}
                  onClick={() => setMemoryTipTopicFilter(topic)}
                  type="button"
                >
                  {t(MEMORY_TIP_TOPIC_LABELS[topic])}
                </button>
              ))}
            </div>

            <p className="mt-3 max-w-3xl text-sm leading-6 text-stone-600">
              {t("leoMemoryTipsNote")}
            </p>

            <div className="mt-4 grid gap-3">
              {filteredMemoryTips.length === 0 ? (
                <p className="rounded-md border border-stone-200 bg-stone-50 px-3 py-3 text-sm leading-6 text-stone-600">
                  {t("noMemoryTips")}
                </p>
              ) : (
                filteredMemoryTips.map((tip) =>
                  renderMemoryTipCard(tip, { showSource: true }),
                )
              )}
            </div>
          </div>
        </Section>
      ) : null}

      {activeLesson ? (
      <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
        <Section title={t("lessonSummary")}>
          <div className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
            {executiveSummaryItems.length > 0 ? (
              <ul className="space-y-2 text-sm leading-7 text-stone-700">
                {executiveSummaryItems.map((item, index) => (
                  <li className="flex gap-3" key={`${item}-${index}`}>
                    <span
                      aria-hidden="true"
                      className="mt-3 h-1.5 w-1.5 flex-none rounded-full bg-emerald-800"
                    />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm leading-7 text-stone-700">{t("notYet")}</p>
            )}

            {joinedTranscriptText ? (
              <details className="mt-5 rounded-md border border-stone-200 bg-stone-50">
                <summary className="cursor-pointer px-3 py-2 text-sm font-semibold text-stone-800">
                  {t("rawTranscript")}
                </summary>
                <div className="border-t border-stone-200 bg-white px-3 py-3">
                  <ul className="space-y-2 text-sm leading-7 text-stone-700">
                    {transcriptBulletItems(joinedTranscriptText).map(
                      (item, index) => (
                        <li className="flex gap-3" key={`${item}-${index}`}>
                          <span
                            aria-hidden="true"
                            className="mt-3 h-1.5 w-1.5 flex-none rounded-full bg-stone-400"
                          />
                          <span>{item}</span>
                        </li>
                      ),
                    )}
                  </ul>
                </div>
              </details>
            ) : null}
          </div>
        </Section>

        {segmentTranscriptsForRecording.length === 0 ||
        unlinkedExtracts.length > 0 ? (
          <Section title={t("extractedCandidates")}>
            <div className="space-y-3">
              {unlinkedExtracts.length === 0 ? (
                <div className="rounded-lg border border-stone-200 bg-white p-5 text-sm leading-6 text-stone-600 shadow-sm">
                  {t("notYet")}
                </div>
              ) : null}
              {unlinkedExtracts.map((extract) => {
                const bounds = clipBoundsForExtract(extract);

                return (
                  <article
                    className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm"
                    key={extract.id}
                  >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-2">
                      <h3 className="text-base font-semibold text-stone-950">
                        {extract.title}
                      </h3>
                      <p className="whitespace-pre-line text-sm leading-6 text-stone-600">
                        {extract.body}
                      </p>
                      {extract.similarExtractId ? (
                        <StatusPill tone="amber">
                          {t("duplicateWarning")}
                        </StatusPill>
                      ) : null}
                    </div>
                    <StatusPill
                      tone={extract.status === "kept" ? "green" : "slate"}
                    >
                      {extract.status}
                    </StatusPill>
                  </div>
                  <div className="mt-4">
                    <AudioStrip
                      audioSrc={recordingAudioSrc}
                      controlsMode="buttons"
                      endsAtSeconds={bounds.endsAtSeconds}
                      startsAtSeconds={bounds.startsAtSeconds}
                      title={extract.title}
                    />
                  </div>
                  {renderExtractActions(extract)}
                </article>
                );
              })}
            </div>
          </Section>
        ) : null}
      </div>
      ) : null}

      {isModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/50 p-4">
          <div className="w-full max-w-xl rounded-lg bg-white p-5 shadow-xl">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-stone-950">
                  {t("createLesson")}
                </h2>
                <p className="mt-1 text-sm text-stone-600">
                  {t("recordAudio")} / {t("uploadAudio")}
                </p>
              </div>
              <button
                aria-label={t("cancel")}
                className="rounded-md p-2 text-stone-500 transition hover:bg-stone-100 hover:text-stone-900"
                onClick={closeModal}
                type="button"
              >
                <X aria-hidden="true" className="h-5 w-5" />
              </button>
            </div>

            <form className="space-y-4" onSubmit={handleSubmit}>
              <label className="block">
                <span className="text-sm font-medium text-stone-800">
                  {t("title")}
                </span>
                <input
                  className="mt-2 w-full rounded-md border border-stone-300 px-3 py-2 text-stone-950 outline-none transition focus:border-emerald-800 focus:ring-2 focus:ring-emerald-800/20"
                  onChange={(event) =>
                    setFormValues((current) => ({
                      ...current,
                      title: event.target.value,
                    }))
                  }
                  required
                  value={formValues.title}
                />
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="text-sm font-medium text-stone-800">
                    {t("teacher")}
                  </span>
                  <input
                    className="mt-2 w-full rounded-md border border-stone-300 px-3 py-2 text-stone-950 outline-none transition focus:border-emerald-800 focus:ring-2 focus:ring-emerald-800/20"
                    onChange={(event) =>
                      setFormValues((current) => ({
                        ...current,
                        teacher: event.target.value,
                      }))
                    }
                    value={formValues.teacher}
                  />
                </label>

                <label className="block">
                  <span className="text-sm font-medium text-stone-800">
                    {t("lessonDate")}
                  </span>
                  <input
                    className="mt-2 w-full rounded-md border border-stone-300 px-3 py-2 text-stone-950 outline-none transition focus:border-emerald-800 focus:ring-2 focus:ring-emerald-800/20"
                    onChange={(event) =>
                      setFormValues((current) => ({
                        ...current,
                        lessonDate: event.target.value,
                      }))
                    }
                    required
                    type="date"
                    value={formValues.lessonDate}
                  />
                </label>
              </div>

              <label className="block">
                <span className="text-sm font-medium text-stone-800">
                  {t("summary")}
                </span>
                <textarea
                  className="mt-2 min-h-24 w-full resize-none rounded-md border border-stone-300 px-3 py-2 text-stone-950 outline-none transition focus:border-emerald-800 focus:ring-2 focus:ring-emerald-800/20"
                  onChange={(event) =>
                    setFormValues((current) => ({
                      ...current,
                      summary: event.target.value,
                    }))
                  }
                  value={formValues.summary}
                />
              </label>

              {saveState === "error" ? (
                <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
                  {errorMessage}
                </p>
              ) : null}

              {saveState === "saved" ? (
                <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
                  {t("lessonCreated")}
                </p>
              ) : null}

              <div className="flex flex-wrap justify-end gap-2">
                <button
                  className="rounded-md border border-stone-300 px-4 py-2 text-sm font-semibold text-stone-700 transition hover:bg-stone-100"
                  onClick={closeModal}
                  type="button"
                >
                  {t("cancel")}
                </button>
                <button
                  className="rounded-md bg-emerald-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={saveState === "saving"}
                  type="submit"
                >
                  {saveState === "saving" ? t("saving") : t("save")}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
