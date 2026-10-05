import type { SupabaseClient } from "@supabase/supabase-js";
import { decryptCredential } from "@/lib/ai/credentials";
import { modelKey } from "@/lib/ai/catalog";

type Message = { role: "system" | "user" | "assistant"; content: string };
type Usage = { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number; cost?: number };
type ModelRow = { provider_key: string; model_id: string; enabled: boolean; is_free: boolean; latency_ms?: number | null; input_usd_per_million?: number | null; output_usd_per_million?: number | null };
type Provider = { id: string; base: string; key: string; model: string; free: boolean; monthlyBudget: number; inputRate: number; outputRate: number; headers?: Record<string, string> };
type RoutedResult = { content: string; provider: string; model: string; confidence: number; usage: Usage; estimatedCost: number; latencyMs: number; escalated: boolean };
type RoutingConfig = { task: any; providers: Provider[]; models: ModelRow[] };
const cooldownUntil = new Map<string, number>();

const n = (name: string, fallback = 0) => Number(process.env[name] ?? fallback);
const flag = (name: string, fallback = false) => (process.env[name] ?? String(fallback)).toLowerCase() === "true";
function confidence(content: string) {
  try { const value = JSON.parse(content)?.confidence; return Number.isFinite(Number(value)) ? Math.max(0, Math.min(1, Number(value))) : 0.5; } catch { return 0.5; }
}
function estimatedTokens(messages: Message[]) { return Math.ceil(messages.reduce((sum, item) => sum + item.content.length, 0) / 4); }
function monthlyStart() { const date = new Date(); date.setUTCDate(1); date.setUTCHours(0, 0, 0, 0); return date.toISOString(); }

async function loadRouting(db: SupabaseClient | undefined, workspaceId: string | undefined, purpose: string): Promise<RoutingConfig> {
  const taskKey = purpose === "analysis" ? "sentiment" : purpose;
  let task: any = null, configured: Provider[] = [], modelRows: ModelRow[] = [];
  if (db && workspaceId) {
    const [routeResult, providerResult, modelResult] = await Promise.all([
      db.from("ai_task_routes").select("*").eq("workspace_id", workspaceId).eq("task_key", taskKey).maybeSingle(),
      db.from("ai_providers").select("id,name,base_url,model,enabled,settings").eq("workspace_id", workspaceId),
      db.from("ai_models").select("provider_key,model_id,enabled,is_free,latency_ms,input_usd_per_million,output_usd_per_million").eq("workspace_id", workspaceId).eq("enabled", true),
    ]);
    if (routeResult.error || providerResult.error || modelResult.error) throw new Error("AI routing configuration could not be loaded.");
    task = routeResult.data;
    modelRows = (modelResult.data ?? []) as ModelRow[];
    const providerRows = providerResult.data ?? [];
    const { data: secrets, error: secretError } = providerRows.length ? await db.from("ai_provider_credentials").select("provider_id,ciphertext").in("provider_id", providerRows.map(row => row.id)) : { data: [], error: null };
    if (secretError) throw new Error("AI provider credentials are unavailable.");
    const secretById = new Map((secrets ?? []).map(row => [row.provider_id, row.ciphertext]));
    for (const row of providerRows) {
      if (!row.enabled || !secretById.has(row.id)) continue;
      let key: string;
      try { key = decryptCredential(secretById.get(row.id)!); } catch { continue; }
      const providerModels = modelRows.filter(model => model.provider_key === row.name);
      if (!providerModels.length) continue;
      configured.push({ id: row.name, base: row.base_url, key, model: row.model, free: false, monthlyBudget: Number(row.settings?.monthly_budget_usd ?? 0), inputRate: -1, outputRate: -1, ...(row.name === "gemini" ? { headers: { "x-goog-api-key": key } } : {}) });
    }
    // A minimal environment-only fallback supports workers during initial deployment before a provider is configured in the UI.
    if (!configured.some(provider => provider.id === "openrouter") && process.env.OPENROUTER_API_KEY && flag("AI_ENABLE_OPENROUTER", true)) {
      configured.push({ id: "openrouter", base: process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1", key: process.env.OPENROUTER_API_KEY, model: process.env.OPENROUTER_FREE_MODEL || "openrouter/free", free: true, monthlyBudget: 0, inputRate: 0, outputRate: 0, headers: { "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "https://intel.rizpram.cloud", "X-Title": "RIZPRAM Intelligence" } });
      if (!modelRows.some(row => row.provider_key === "openrouter" && row.model_id === "openrouter/free")) modelRows.push({ provider_key: "openrouter", model_id: "openrouter/free", enabled: true, is_free: true });
    }
  } else {
    const key = process.env.OPENROUTER_API_KEY;
    if (key && flag("AI_ENABLE_OPENROUTER", true)) {
      configured = [{ id: "openrouter", base: process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1", key, model: process.env.OPENROUTER_FREE_MODEL || "openrouter/free", free: true, monthlyBudget: 0, inputRate: 0, outputRate: 0 }];
      modelRows = [{ provider_key: "openrouter", model_id: configured[0].model, enabled: true, is_free: true }];
    }
  }
  if (!task) task = { enabled: true, preset: "ZERO COST", primary_model: "AUTO", fallback_model: "AUTO", second_opinion_model: "AUTO", judge_model: "AUTO", recommended_model: "openrouter::openrouter/free", confidence_threshold: n("AI_ESCALATION_CONFIDENCE_THRESHOLD", 0.72), escalation_rules: ["confidence_below"], consensus_enabled: false };
  return { task, providers: configured, models: modelRows };
}

async function spendByProvider(db: SupabaseClient | undefined, workspaceId?: string) {
  if (!db) return null;
  const { data, error } = await db.rpc("get_ai_usage_spend", { p_workspace_id: workspaceId ?? null, p_month_start: monthlyStart() });
  if (error) throw new Error("AI budget ledger unavailable; paid-provider call denied.");
  return new Map<string, number>((data ?? []).map((row: { provider: string; spent_usd: nu