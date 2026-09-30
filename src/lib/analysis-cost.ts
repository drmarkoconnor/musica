// Standard list-price estimates, checked 2026-09-30. Not a billing ledger:
// failed calls, retries, hosting and discounts are deliberately not inferred.
export function transcriptionCostEstimate(model: string, seconds: number): number | null {
  if (model.startsWith("local-whisper:")) return 0;
  const rate = model === "gpt-transcribe" ? 0.0045 : model.startsWith("gpt-4o-mini-transcribe") ? 0.003 : model === "whisper-1" || model.startsWith("gpt-4o-transcribe") ? 0.006 : undefined;
  return rate === undefined ? null : Math.max(0, seconds) / 60 * rate;
}

export function analysisCostEstimate(usage: { model: string; inputTokens: number; outputTokens: number; cachedInputTokens: number } | null): number | null {
  if (!usage) return null;
  const rates = usage.model === "gpt-6-astra" ? [10, 1, 50] : usage.model === "gpt-4o-mini" ? [0.15, 0.075, 0.6] : null;
  if (!rates) return null;
  return ((usage.inputTokens - usage.cachedInputTokens) * rates[0] + usage.cachedInputTokens * rates[1] + usage.outputTokens * rates[2]) / 1_000_000;
}
