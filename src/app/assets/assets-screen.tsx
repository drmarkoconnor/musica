"use client";

import { type FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Edit3,
  ExternalLink,
  FileImage,
  FileText,
  Upload,
  X,
} from "lucide-react";
import { ComingSoonButton } from "@/components/coming-soon-button";
import { Section } from "@/components/section";
import { StatusPill } from "@/components/status-pill";
import type { PracticeLoopReadModel } from "@/lib/data";
import { useLanguage } from "@/lib/language";
import type { AssetType, PieceAsset } from "@/lib/types";

type AssetFormValues = {
  title: string;
  pieceId: string;
  type: AssetType;
  versionLabel: string;
};

const assetTypeOptions: AssetType[] = [
  "lead_sheet_pdf",
  "lead_sheet_image",
  "annotated_version",
];

function formFromAsset(asset: PieceAsset): AssetFormValues {
  return {
    title: asset.title,
    pieceId: asset.pieceId,
    type: asset.type,
    versionLabel: asset.versionLabel,
  };
}

export function AssetsScreen({ data }: { data: PracticeLoopReadModel }) {
  const { t } = useLanguage();
  const router = useRouter();
  const { pieceAssets, pieces } = data;
  const [editingAsset, setEditingAsset] = useState<PieceAsset | null>(null);
  const [formValues, setFormValues] = useState<AssetFormValues | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">(
    "idle",
  );

  function openEditModal(asset: PieceAsset) {
    setEditingAsset(asset);
    setFormValues(formFromAsset(asset));
    setSaveState("idle");
  }

  function closeEditModal() {
    setEditingAsset(null);
    setFormValues(null);
    setSaveState("idle");
  }

  async function saveAssetMetadata(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingAsset || !formValues) return;

    setSaveState("saving");

    const response = await fetch(`/api/piece-assets/${editingAsset.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        assetType: formValues.type,
        pieceId: formValues.pieceId,
        title: formValues.title,
        versionLabel: formValues.versionLabel,
      }),
    });

    if (!response.ok) {
      setSaveState("error");
      return;
    }

    setSaveState("saved");
    router.refresh();
    setTimeout(() => closeEditModal(), 250);
  }

  function assetTypeLabel(type: AssetType) {
    if (type === "annotated_version") return t("annotatedVersion");
    if (type === "lead_sheet_image") return t("leadSheetImage");
    return t("leadSheet");
  }

  return (
    <div className="space-y-8">
      <Section
        action={
          <div className="flex flex-wrap gap-2">
            <Link
              className="inline-flex items-center gap-2 rounded-md border border-stone-300 px-3 py-2 text-sm font-semibold text-stone-700 transition hover:bg-stone-100"
              href="/assets/leadsheets"
            >
              <FileText aria-hidden="true" className="h-4 w-4" />
              {t("reviewLeadSheets")}
            </Link>
            <ComingSoonButton icon={Upload} tone="primary">
              {t("uploadAsset")}
            </ComingSoonButton>
          </div>
        }
        title={t("assets")}
      >
        <div className="grid gap-4 md:grid-cols-2">
          {pieceAssets.length === 0 ? (
            <div className="rounded-lg border border-stone-200 bg-white p-5 text-sm leading-6 text-stone-600 shadow-sm">
              {t("notYet")}
            </div>
          ) : null}
          {pieceAssets.map((asset) => {
            const piece = pieces.find((item) => item.id === asset.pieceId);
            const Icon = asset.type === "lead_sheet_image" ? FileImage : FileText;

            return (
              <article
                className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm"
                key={asset.id}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-emerald-50 text-emerald-900">
                      <Icon aria-hidden="true" className="h-5 w-5" />
                    </span>
                    <div>
                      <h2 className="font-semibold text-stone-950">
                        {asset.title}
                      </h2>
                      <p className="mt-1 text-sm text-stone-500">
                        {piece?.title ?? t("notYet")}
                      </p>
                    </div>
                  </div>
                  <StatusPill
                    tone={asset.type === "annotated_version" ? "amber" : "blue"}
                  >
                    {asset.type === "annotated_version"
                      ? t("annotatedVersion")
                      : t("leadSheet")}
                  </StatusPill>
                </div>

                <div className="mt-4 aspect-[16/10] rounded-lg border border-dashed border-stone-300 bg-stone-50 p-4">
                  <div className="h-full rounded bg-white p-4 shadow-inner">
                    <div className="mb-4 h-3 w-36 rounded bg-stone-300" />
                    <div className="grid h-[80%] grid-cols-3 gap-3">
                      {[0, 1, 2].map((column) => (
                        <div className="space-y-3" key={column}>
                          <div className="h-3 rounded bg-stone-200" />
                          <div className="h-3 rounded bg-stone-200" />
                          <div className="h-3 rounded bg-emerald-200" />
                          <div className="h-3 rounded bg-stone-200" />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <a
                    className="inline-flex items-center gap-2 rounded-md border border-stone-300 px-3 py-2 text-sm font-semibold text-stone-700 transition hover:bg-stone-100"
                    href={`/api/piece-assets/${asset.id}/file`}
                    rel="noreferrer"
                    target="_blank"
                  >
                    <ExternalLink aria-hidden="true" className="h-4 w-4" />
                    {t("openPdf")}
                  </a>
                  {piece ? (
                    <Link
                      className="inline-flex items-center rounded-md border border-stone-300 px-3 py-2 text-sm font-semibold text-stone-700 transition hover:bg-stone-100"
                      href={`/repertoire/${piece.id}`}
                    >
                      {t("repertoire")}
                    </Link>
                  ) : null}
                  <button
                    className="inline-flex items-center gap-2 rounded-md border border-stone-300 px-3 py-2 text-sm font-semibold text-stone-700 transition hover:bg-stone-100"
                    onClick={() => openEditModal(asset)}
                    type="button"
                  >
                    <Edit3 aria-hidden="true" className="h-4 w-4" />
                    {t("edit")}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </Section>

      {editingAsset && formValues ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/50 p-4">
          <div className="w-full max-w-xl rounded-lg bg-white p-5 shadow-xl">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-stone-950">
                  {t("edit")} {t("leadSheet")}
                </h2>
                <p className="mt-1 text-sm text-stone-600">
                  {t("readingFromNeon")}
                </p>
              </div>
              <button
                aria-label={t("cancel")}
                className="rounded-md p-2 text-stone-500 transition hover:bg-stone-100 hover:text-stone-900"
                onClick={closeEditModal}
                type="button"
              >
                <X aria-hidden="true" className="h-5 w-5" />
              </button>
            </div>

            <form className="space-y-4" onSubmit={saveAssetMetadata}>
              <label className="block">
                <span className="text-sm font-medium text-stone-800">
                  {t("title")}
                </span>
                <input
                  className="mt-2 w-full rounded-md border border-stone-300 px-3 py-2 text-stone-950 outline-none transition focus:border-emerald-800 focus:ring-2 focus:ring-emerald-800/20"
                  onChange={(event) =>
                    setFormValues((current) =>
                      current
                        ? { ...current, title: event.target.value }
                        : current,
                    )
                  }
                  required
                  value={formValues.title}
                />
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="text-sm font-medium text-stone-800">
                    {t("piece")}
                  </span>
                  <select
                    className="mt-2 w-full rounded-md border border-stone-300 px-3 py-2 text-stone-950 outline-none transition focus:border-emerald-800 focus:ring-2 focus:ring-emerald-800/20"
                    onChange={(event) =>
                      setFormValues((current) =>
                        current
                          ? { ...current, pieceId: event.target.value }
                          : current,
                      )
                    }
                    value={formValues.pieceId}
                  >
                    {pieces.map((piece) => (
                      <option key={piece.id} value={piece.id}>
                        {piece.title}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="text-sm font-medium text-stone-800">
                    {t("leadSheet")}
                  </span>
                  <select
                    className="mt-2 w-full rounded-md border border-stone-300 px-3 py-2 text-stone-950 outline-none transition focus:border-emerald-800 focus:ring-2 focus:ring-emerald-800/20"
                    onChange={(event) =>
                      setFormValues((current) =>
                        current
                          ? {
                              ...current,
                              type: event.target.value as AssetType,
                            }
                          : current,
                      )
                    }
                    value={formValues.type}
                  >
                    {assetTypeOptions.map((type) => (
                      <option key={type} value={type}>
                        {assetTypeLabel(type)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="block">
                <span className="text-sm font-medium text-stone-800">
                  {t("annotatedVersion")}
                </span>
                <input
                  className="mt-2 w-full rounded-md border border-stone-300 px-3 py-2 text-stone-950 outline-none transition focus:border-emerald-800 focus:ring-2 focus:ring-emerald-800/20"
                  onChange={(event) =>
                    setFormValues((current) =>
                      current
                        ? { ...current, versionLabel: event.target.value }
                        : current,
                    )
                  }
                  value={formValues.versionLabel}
                />
              </label>

              {saveState === "error" ? (
                <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
                  {t("saveFailed")}
                </p>
              ) : null}

              {saveState === "saved" ? (
                <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
                  {t("saved")}
                </p>
              ) : null}

              <div className="flex flex-wrap justify-end gap-2">
                <button
                  className="rounded-md border border-stone-300 px-4 py-2 text-sm font-semibold text-stone-700 transition hover:bg-stone-100"
                  onClick={closeEditModal}
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
