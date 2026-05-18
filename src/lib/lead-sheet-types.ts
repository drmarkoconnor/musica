export type LeadSheetSuggestion = {
  filename: string;
  relativePath: string;
  suggestedTitle: string;
  composer?: string;
  lyricist?: string;
  fileSizeBytes: number;
  pageCount?: number;
  matchedPieceId?: string;
  matchedPieceTitle?: string;
  suggestedAction: "attach" | "create";
};
