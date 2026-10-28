export type SimpleAiSettings = { enabled: boolean; provider: string; model: string; billingMode: "provider_quota" };

export function simpleAiSettings(settings: Record<string, any> | null | undefined): SimpleAiSettings | null {
  const value = settings?.ai_simple;
  if (value?.enabled !== true || value.billingMode !== "provider_quota" || typeof value.provider !== "string" || typeof value.model !== "string" || !value.provider || !value.model) return null;
  return value;
}

/** Null means unknown, never free. Provider quota mode can run without a price catalog. */
export function estimateAiCost(args: { isFree: boolean; providerManaged: boolean; inputRate?: number | null; outputRate?: number | null; inputTokens: number; outputTokens: number; reportedCost?: number }): number | null {
  if (args.reportedCost != null && Number.isFinite(args.reportedCost) && args.reportedCost >= 0) return args.reportedCost;
  if (args.isFree) return 0;
  const { inputRate, outputRate } = args;
  if (inputRate == null || outputRate == null || !Number.isFinite(inputRate) || !Number.isFinite(outputRate) || inputRate < 0 || outputRate < 0) {
    if (args.providerManaged) return null;
    throw new Error("Model pricing is required for app-budget routing.");
  }
  return (args.inputTokens * inputRate + args.outputTokens * outputRate) / 1_000_000;
}
