import "server-only";

import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { leadSheetCatalogByFilename } from "@/lib/lead-sheet-catalog";
import type { LeadSheetSuggestion } from "@/lib/lead-sheet-types";
import type { Piece } from "@/lib/types";

function normalizeTitle(value: string) {
  return value
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function fallbackTitle(filename: string) {
  const baseName = filename.replace(/\.pdf$/i, "");
  return baseName
    .replace(/\s*-\s*[^-]+$/u, "")
    .replace(/\s+[A-G](?:b|#)?$/u, "")
    .trim();
}

function pageCount(buffer: Buffer) {
  const text = buffer.toString("latin1");
  const matches = text.match(/\/Type\s*\/Page\b/g);
  return matches?.length;
}

export async function scanLeadSheets(
  pieces: Pick<Piece, "id" | "title">[],
): Promise<LeadSheetSuggestion[]> {
  const leadSheetsDir = path.join(process.cwd(), "docs", "leadsheets");
  const entries = await readdir(leadSheetsDir, { withFileTypes: true }).catch(
    () => [],
  );
  const pdfEntries = entries
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".pdf"))
    .sort((a, b) => a.name.localeCompare(b.name));

  const piecesByTitle = new Map(
    pieces.map((piece) => [normalizeTitle(piece.title), piece]),
  );

  return Promise.all(
    pdfEntries.map(async (entry) => {
      const filePath = path.join(leadSheetsDir, entry.name);
      const [fileStat, fileBuffer] = await Promise.all([
        stat(filePath),
        readFile(filePath),
      ]);
      const known = leadSheetCatalogByFilename[entry.name];
      const suggestedTitle = known?.title ?? fallbackTitle(entry.name);
      const matchedPiece = piecesByTitle.get(normalizeTitle(suggestedTitle));

      return {
        filename: entry.name,
        relativePath: path
          .relative(process.cwd(), filePath)
          .split(path.sep)
          .join("/"),
        suggestedTitle,
        composer: known?.composer,
        lyricist: known?.lyricist,
        fileSizeBytes: fileStat.size,
        pageCount: pageCount(fileBuffer),
        matchedPieceId: matchedPiece?.id,
        matchedPieceTitle: matchedPiece?.title,
        suggestedAction: matchedPiece ? "attach" : "create",
      };
    }),
  );
}
