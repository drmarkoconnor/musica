"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, LockKeyhole, WandSparkles, X } from "lucide-react";
import { useLanguage } from "@/lib/language";
import { cn } from "@/lib/utils";

type RequestState = "idle" | "loading" | "success" | "error";

export function TranscriptionGate({
  lessonId,
  recordingDurationSeconds,
  recordingId,
  selectedSegmentCount,
  selectedSegmentSeconds,
}: {
  lessonId: string;
  recordingDurationSeconds: number;
  recordingId: string;
  selectedSegmentCount: number;
  selectedSegmentSeconds: number;
}) {
  const { t } = useLanguage();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [includeFullRecording, setIncludeFullRecording] = useState(false);
  const [requestState, setRequestState] = useState<RequestState>("idle");
  const [message, setMessage] = useState("");
  const hasSelectedSegments = selectedSegmentCount > 0;
  const selectedMinutes = Math.ceil(selectedSegmentSeconds / 60);
  const fullRecordingMinutes = Math.ceil((recordingDurationSeconds || 0) / 60);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setRequestState("loading");
    setMessage("");

    const response = await fetch("/api/transcriptions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        includeFullRecording,
        lessonId,
        recordingId,
        password,
      }),
    });

    if (!response.ok) {
      setRequestState("error");
      setMessage(t("passwordFailed"));
      return;
    }

    setRequestState("success");
    setPassword("");
    setMessage(t("transcriptionAccepted"));
    router.refresh();
    window.setTimeout(() => {
      setIsOpen(false);
      setRequestState("idle");
      setMessage("");
    }, 900);
  }

  return (
    <>
      <div className="space-y-3 rounded-lg border border-amber-200 bg-amber-50 p-4">
        <div className="flex items-start gap-3">
          <LockKeyhole className="mt-0.5 h-5 w-5 text-amber-800" />
          <div className="space-y-2">
            <p className="text-sm font-semibold text-amber-950">
              {t("transcriptionNote")}
            </p>
            <button
              className="inline-flex items-center gap-2 rounded-md bg-emerald-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-900"
              onClick={() => {
                setIsOpen(true);
                setIncludeFullRecording(false);
                setRequestState("idle");
                setMessage("");
              }}
              type="button"
            >
              <WandSparkles aria-hidden="true" className="h-4 w-4" />
              {t("transcribeLesson")}
            </button>
          </div>
        </div>
      </div>

      {isOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/50 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-stone-950">
                  {t("transcribeLesson")}
                </h2>
                <p className="mt-1 text-sm leading-6 text-stone-600">
                  {t("transcriptionNote")}
                </p>
              </div>
              <button
                aria-label={t("cancel")}
                className="rounded-md p-2 text-stone-500 transition hover:bg-stone-100 hover:text-stone-900"
                onClick={() => setIsOpen(false)}
                type="button"
              >
                <X aria-hidden="true" className="h-5 w-5" />
              </button>
            </div>

            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="rounded-md border border-stone-200 bg-stone-50 px-3 py-2 text-sm leading-6 text-stone-700">
                {hasSelectedSegments ? (
                  <p>
                    {t("selectedSegmentsWillTranscribe")}{" "}
                    <strong>
                      {selectedSegmentCount} / {selectedMinutes} {t("minutes")}
                    </strong>
                  </p>
                ) : (
                  <div className="space-y-2">
                    <p>
                      {t("noSegmentsWillTranscribeFull")}{" "}
                      <strong>
                        {fullRecordingMinutes} {t("minutes")}
                      </strong>
                    </p>
                    <label className="flex items-start gap-2">
                      <input
                        checked={includeFullRecording}
                        className="mt-1 h-4 w-4 accent-emerald-900"
                        onChange={(event) =>
                          setIncludeFullRecording(event.target.checked)
                        }
                        type="checkbox"
                      />
                      <span>{t("confirmFullTranscription")}</span>
                    </label>
                  </div>
                )}
              </div>

              <label className="block">
                <span className="text-sm font-medium text-stone-800">
                  {t("password")}
                </span>
                <input
                  autoComplete="current-password"
                  className="mt-2 w-full rounded-md border border-stone-300 px-3 py-2 text-stone-950 outline-none transition focus:border-emerald-800 focus:ring-2 focus:ring-emerald-800/20"
                  onChange={(event) => setPassword(event.target.value)}
                  type="password"
                  value={password}
                />
              </label>

              {message ? (
                <p
                  className={cn(
                    "rounded-md border px-3 py-2 text-sm",
                    requestState === "success"
                      ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                      : "border-rose-200 bg-rose-50 text-rose-800",
                  )}
                >
                  {message}
                </p>
              ) : null}

              <div className="flex flex-wrap justify-end gap-2">
                <button
                  className="rounded-md border border-stone-300 px-4 py-2 text-sm font-semibold text-stone-700 transition hover:bg-stone-100"
                  onClick={() => setIsOpen(false)}
                  type="button"
                >
                  {t("cancel")}
                </button>
                <button
                  className="inline-flex items-center gap-2 rounded-md bg-emerald-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={
                    requestState === "loading" ||
                    password.length === 0 ||
                    (!hasSelectedSegments && !includeFullRecording)
                  }
                  type="submit"
                >
                  {requestState === "loading" ? (
                    <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
                  ) : (
                    <LockKeyhole aria-hidden="true" className="h-4 w-4" />
                  )}
                  {t("authorise")}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
