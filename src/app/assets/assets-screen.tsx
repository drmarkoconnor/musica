"use client";

import Link from "next/link";
import { ExternalLink, FileImage, FileText, Upload } from "lucide-react";
import { ComingSoonButton } from "@/components/coming-soon-button";
import { Section } from "@/components/section";
import { StatusPill } from "@/components/status-pill";
import type { PracticeLoopReadModel } from "@/lib/data";
import { useLanguage } from "@/lib/language";

export function AssetsScreen({ data }: { data: PracticeLoopReadModel }) {
  const { t } = useLanguage();
  const { pieceAssets, pieces } = data;

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
                </div>
              </article>
            );
          })}
        </div>
      </Section>
    </div>
  );
}
