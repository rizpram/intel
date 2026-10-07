import { NextRequest, NextResponse } from "next/server";
import { aiAdminContext } from "@/lib/ai/admin-context";
import { decryptCredential, encryptCredential } from "@/lib/ai/credentials";
import { modelMetadata, providerInfo, safeProviderUrl } from "@/lib/ai/catalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function modelListUrl(provider: string, baseUrl: string) {
  return provider === "gemini" ? "https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000" : `${safeProviderUrl(baseUrl)}/models`;
}
async function fetchModels(provider: string, baseUrl: string, apiKey: string) {
  const url = modelListUrl(provider, baseUrl);
  const headers: Record<string, string> = provider === "gemini" ? { "x-goog-api-key": apiKey } : { Authorization: `Bearer ${apiKey}` };
  const response = await fetch(url, { headers, signal: AbortSignal.timeout(12_000), redirect: "error" });
  if (!response.ok) return { ok: false as const, status: response.status, models: [] as Record<string, any>[] };
  const payload = await response.json();
  return { ok: true as const, status: response.status, models: (provider === "gemini" ? payload.models : payload.data) ?? [] };
}

export async function POST(request: NextRequest) {
  const context = await aiAdminContext();
  if ("response" in context) return context.response;
  const { admin, workspaceId, user } = context;
  const body = await request.json().catch(() => ({}));
  const provider = String(body.provider ?? "");
  const info = providerInfo(provider);
  if (!info) return NextResponse.json({ error: "Unknown AI provider." }, { status: 400 });

  const existing = await admin.from("ai_providers").select("id,base_url,model,enabled,settings").eq("workspace_id", workspaceId).eq("name", provider).maybeSingle();
  if (existing.error) return NextResponse.json({ error: "Could not load provider configuration." }, { status: 500 });

  if (body.action === "save" || body.action === "toggle") {
    const baseUrl = provider === "custom" ? String(body.baseUrl ?? existing.data?.base_url ?? "") : info.baseUrl;
    if (!baseUrl) return NextResponse.json({ error: "Enter the custom provider base URL." }, { status: 400 });
    try { safeProviderUrl(baseUrl); } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid provider URL." }, { status: 400 }); }
    const enabled = body.action === "toggle" ? Boolean(body.enabled) : Boolean(body.enabled ?? existing.data?.enabled ?? provider === "openrouter");
    const apiKey = typeof body.apiKey === "string" ? body.apiKey.trim() : "";
    const { data: existingSecret } = existing.data ? await admin.from("ai_provider_credentials").select("provider_id").eq("provider_id", existing.data.id).maybeSingle() : { data: null };
    if (enabled && !apiKey && !existingSecret) return NextResponse.json({ error: "Add an API key before enabling this provider." }, { status: 400 });
    if (apiKey && !process.env.AI_CREDENTIAL_ENCRYPTION_KEY) return NextResponse.json({ error: "Credential encryption is not configured on the server." }, { status: 503 });
    const monthlyBudget = Math.max(0, Number(body.monthlyBudget ?? existing.data?.settings?.monthly_budget_usd ?? 0));
    const { data: saved, error } = await admin.from("ai_providers").upsert({
      ...(existing.data?.id ? { id: existing.data.id } : {}), workspace_id: workspaceId, name: provider, base_url: baseUrl,
      model: String(body.defaultModel ?? existing.data?.model ?? (provider === "openrouter" ? "openrouter/free" : "")), enabled,
      settings: { ...(existing.data?.settings ?? {}), display_name: info.name, monthly_budget_usd: monthlyBudget },
    }, { onConflict: "workspace_id,name" }).select("id").single();
    if (error || !saved) return NextResponse.json({ error: "Could not save provider settings." }, { status: 500 });
    if (apiKey) {
      const { error: secretError } = await admin.from("ai_provider_credentials").upsert({ provider_id: saved.id, ciphertext: encryptCredential(apiKey), updated_at: new Date().toISOString() });
      if (secretError) return NextResponse.json({ error: "Provider saved, but encrypted credential storage failed." }, { status: 500 });
    }
    await admin.from("audit_logs").insert({ workspace_id: workspaceId, actor_id: user.id, action: `ai_provider.${body.action}`, resource_type: "ai_provider", resource_id: saved.id, details: { provider, enabled, credential_changed: Boolean(apiKey) } });
    return NextResponse.json({ ok: true, provider, enabled, hasApiKey: Boolean(apiKey || existingSecret) });
  }

  if (body.action === "test" || body.action === "sync") {
    if (!existing.data) return NextResponse.json({ error: "Save provider settings first." }, { status: 404 });
    let apiKey = typeof body.apiKey === "string" && body.apiKey.trim() ? body.apiKey.trim() : "";
    if (!apiKey) {
      const { data: stored } = await admin.from("ai_provider_credentials").select("ciphertext").eq("provider_id", existing.data.id).maybeSingle();
      if (stored?.ciphertext) {
        try { apiKey = decryptCredential(stored.ciphertext); } catch { return NextResponse.json({ error: "Could not decrypt the stored provider credential." }, { status: 500 }); }
      }
    }
    if (!apiKey) return NextResponse.json({ error: "Add an API key before testing or syncing." }, { status: 400 });
    const checkedAt = new Date().toISOString(), started = Date.now();
    let result;
    try { result = await fetchModels(provider, existing.data.base_url, apiKey); }
    catch { result = { ok: false as const, status: 0, models: [] as Record<string, any>[] }; }
    const latency = Date.now() - started;
    const health = { provider_id: existing.data.id, status: result.ok ? "healthy" : "unhealthy", latency_ms: latency, error_status: result.ok ? null : (result.status ? `HTTP ${result.status}` : "Connection failed"), checked_at: checkedAt, ...(body.action === "sync" && result.ok ? { models_synced_at: checkedAt } : {}) };
    await admin.from("ai_provider_health").upsert(health);
    if (!result.ok) return NextResponse.json({ ok: false, status: health.error_status, latencyMs: latency }, { status: 502 });
    if (body.action === "test") return NextResponse.json({ ok: true, provider, latencyMs: latency, availableModels: result.models.length });

    const { data: currentModels } = await admin.from("ai_models").select("model_id,enabled,recommended,suitability_score,recommendation_reason,health").eq("workspace_id", workspaceId).eq("provider_key", provider);
    const current = new Map((currentModels ?? []).map(row => [row.model_id, row]));
    const normalized = (result.models as Record<string,any>[]).map(raw => modelMetadata(provider, raw)).filter(model => model.model_id).map(model => ({
      workspace_id: workspaceId, provider_key: provider, model_id: model.model_id, display_name: model.display_name,
      enabled: current.get(model.model_id)?.enabled ?? false, is_free: model.is_free, capabilities: model.capabilities,
      context_window: model.context_window, supports_vision: model.supports_vision, supports_structured_output: model.supports_structured_output,
      input_usd_per_million: model.input_usd_per_million, output_usd_per_million: model.output_usd_per_million,
      health: current.get(model.model_id)?.health ?? "unknown", suitability_score: current.get(model.model_id)?.suitability_score ?? 0, recommended: current.get(model.model_id)?.recommended ?? false, last_synced_at: checkedAt,
      recommendation_reason: current.get(model.model_id)?.recommendation_reason ?? "Newly discovered; enable explicitly before production routing.",
    }));
    for (let offset = 0; offset < normalized.length; offset += 500) {
      const batch = normalized.slice(offset, offset + 500);
      const { error } = await admin.from("ai_models").upsert(batch, { onConflict: "workspace_id,provider_key,model_id" });
      if (error) return NextResponse.json({ error: "Provider connected, but model synchronization could not be saved." }, { status: 500 });
    }
    await admin.from("audit_logs").insert({ workspace_id: workspaceId, actor_id: user.id, action: "ai_provider.models_synced", resource_type: "ai_provider", resource_id: existing.data.id, details: { provider, discovered: normalized.length } });
    return NextResponse.json({ ok: true, provider, latencyMs: latency, discovered: normalized.length, newlyDisabled: normalized.filter(model => !current.has(model.model_id)).length });
  }

  return NextResponse.json({ error: "Unsupported provider action." }, { status: 400 });
}

