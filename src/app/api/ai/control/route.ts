import { NextResponse } from "next/server";
import { aiAdminContext } from "@/lib/ai/admin-context";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const context = await aiAdminContext();
  if ("response" in context) return context.response;
  const { admin, workspaceId } = context;
  const { data: providerIds } = await admin.from("ai_providers").select("id").eq("workspace_id", workspaceId);
  const ids = providerIds?.map(provider => provider.id) ?? [];
  const [providers, credentials, health, models, routes, usage] = await Promise.all([
    admin.from("ai_providers").select("id,name,base_url,model,enabled,settings").eq("workspace_id", workspaceId),
    ids.length ? admin.from("ai_provider_credentials").select("provider_id").in("provider_id", ids) : Promise.resolve({ data: [], error: null }),
    ids.length ? admin.from("ai_provider_health").select("provider_id,status,latency_ms,error_status,checked_at,models_synced_at").in("provider_id", ids) : Promise.resolve({ data: [], error: null }),
    admin.from("ai_models").select("id,provider_key,model_id,display_name,enabled,is_free,capabilities,context_window,supports_vision,supports_structured_output,health,latency_ms,usage_count,error_count,input_usd_per_million,output_usd_per_million,estimated_cost_usd,suitability_score,recommended,recommendation_reason").eq("workspace_id", workspaceId).order("provider_key").order("display_name"),
    admin.from("ai_task_routes").select("task_key,label,enabled,preset,primary_model,fallback_model,second_opinion_model,judge_model,recommended_model,confidence_threshold,escalation_rules,consensus_enabled").eq("workspace_id", workspaceId).order("label"),
    admin.from("ai_usage").select("provider,model,estimated_cost_usd,latency_ms,status").eq("workspace_id", workspaceId).gte("created_at", new Date(Date.now() - 30 * 86_400_000).toISOString()).limit(1000),
  ]);
  const firstError = [providers, credentials, health, models, routes, usage].find(result => result.error)?.error;
  if (firstError) return NextResponse.json({ error: "Could not load AI Control Center." }, { status: 500 });
  const credentialIds = new Set((credentials.data ?? []).map(row => row.provider_id));
  const healthById = new Map((health.data ?? []).map(row => [row.provider_id, row]));
  const usageByModel = new Map<string, { count: number; cost: number; latency: number; errors: number }>();
  for (const row of usage.data ?? []) {
    const key = `${row.provider}::${row.model}`;
    const value = usageByModel.get(key) ?? { count: 0, cost: 0, latency: 0, errors: 0 };
    value.count++; value.cost += Number(row.estimated_cost_usd || 0); value.latency += Number(row.latency_ms || 0); if (row.status !== "success") value.errors++;
    usageByModel.set(key, value);
  }
  const providerRows = providers.data ?? [];
  const providerEnabled = new Map(providerRows.map(row => [row.name, row.enabled]));
  const modelRows = (models.data ?? []).map(row => {
    const metric = usageByModel.get(`${row.provider_key}::${row.model_id}`);
    const latency = row.latency_ms ?? (metric?.count ? Math.round(metric.latency / metric.count) : null);
    const observedCount = Number(row.usage_count || metric?.count || 0);
    const errorRate = observedCount ? Number(row.error_count || metric?.errors || 0) / observedCount : null;
    let suitability = Number(row.suitability_score || 0);
    if (observedCount) {
      const latencyScore = latency == null ? 0 : latency < 800 ? 10 : latency < 1800 ? 7 : latency < 3500 ? 4 : latency > 10000 ? -10 : 0;
      const reliabilityScore = (row.health === "healthy" ? 8 : row.health === "degraded" ? -5 : row.health === "unhealthy" ? -20 : 0) - (errorRate ?? 0) * 35;
      suitability = Math.max(0, Math.min(100, 50 + latencyScore + reliabilityScore + (row.is_free ? 8 : 0) + (providerEnabled.get(row.provider_key) ? 10 : -30)));
    }
    return { ...row, usage_count: observedCount, estimated_cost_usd: Number(row.estimated_cost_usd || metric?.cost || 0), latency_ms: latency, error_rate: errorRate, suitability_score: suitability };
  });
  const dynamicRoutes = (routes.data ?? []).map(route => {
    const preferFree = route.preset === "ZERO COST" || (route.preset === "BALANCED" && ["sentiment","emotion","stance","intent","entity_extraction","relevance","spam_noise","sarcasm","topic_classification"].includes(route.task_key));
    const needsVision = route.task_key === "multimodal_analysis";
    const candidates = modelRows.filter(model => model.enabled && providerEnabled.get(model.provider_key) && (!preferFree || model.is_free) && (!needsVision || model.supports_vision));
    const best = [...candidates].sort((a,b) => Number(b.suitability_score) - Number(a.suitability_score))[0];
    return { ...route, recommended_model: best ? `${best.provider_key}::${best.model_id}` : route.recommended_model };
  });
  return NextResponse.json({
    providers: providerRows.map(row => ({ id: row.id, provider: row.name, baseUrl: row.base_url, defaultModel: row.model, enabled: row.enabled, hasApiKey: credentialIds.has(row.id), monthlyBudget: Number(row.settings?.monthly_budget_usd ?? 0), ...healthById.get(row.id) })),
    models: modelRows,
    routes: dynamicRoutes,
    preset: dynamicRoutes[0]?.preset ?? "ZERO COST",
    encryptionReady: Boolean(process.env.AI_CREDENTIAL_ENCRYPTION_KEY),
    globalBudgetUsd: Number(process.env.AI_MONTHLY_BUDGET_USD ?? 0),
  });
}
