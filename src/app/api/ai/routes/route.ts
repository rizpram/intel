import { NextRequest, NextResponse } from "next/server";
import { aiAdminContext } from "@/lib/ai/admin-context";

export const dynamic = "force-dynamic";

const presets: Record<string, { threshold: number; consensus: boolean }> = {
  "ZERO COST": { threshold: 0.72, consensus: false }, FAST: { threshold: 0.62, consensus: false }, BALANCED: { threshold: 0.72, consensus: false },
  "MAXIMUM ACCURACY": { threshold: 0.84, consensus: true }, "CRISIS MODE": { threshold: 0.9, consensus: true }, CUSTOM: { threshold: 0.72, consensus: false },
};

export async function POST(request: NextRequest) {
  const context = await aiAdminContext();
  if ("response" in context) return context.response;
  const { admin, workspaceId, user } = context;
  const body = await request.json().catch(() => ({}));

  if (body.action === "preset") {
    const preset = String(body.preset ?? "");
    const policy = presets[preset];
    if (!policy) return NextResponse.json({ error: "Unknown routing preset." }, { status: 400 });
    const { error } = await admin.from("ai_task_routes").update({ preset, primary_model: "AUTO", fallback_model: "AUTO", second_opinion_model: "AUTO", judge_model: "AUTO", confidence_threshold: policy.threshold, consensus_enabled: policy.consensus, updated_at: new Date().toISOString() }).eq("workspace_id", workspaceId);
    if (error) return NextResponse.json({ error: "Could not apply routing preset." }, { status: 500 });
    await admin.from("audit_logs").insert({ workspace_id: workspaceId, actor_id: user.id, action: "ai_routing.preset_changed", resource_type: "ai_task_routes", details: { preset } });
    return NextResponse.json({ ok: true, preset });
  }

  const taskKey = String(body.taskKey ?? "");
  const { data: current } = await admin.from("ai_task_routes").select("*").eq("workspace_id", workspaceId).eq("task_key", taskKey).maybeSingle();
  if (!current) return NextResponse.json({ error: "Unknown AI task." }, { status: 404 });
  const modelFields = ["primary_model", "fallback_model", "second_opinion_model", "judge_model"] as const;
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof body.enabled === "boolean") patch.enabled = body.enabled;
  if (typeof body.confidenceThreshold === "number") patch.confidence_threshold = Math.max(0, Math.min(1, body.confidenceThreshold));
  if (typeof body.consensusEnabled === "boolean") patch.consensus_enabled = body.consensusEnabled;
  if (Array.isArray(body.escalationRules)) patch.escalation_rules = body.escalationRules.filter((item: unknown) => typeof item === "string");
  if (typeof body.preset === "string" && presets[body.preset]) patch.preset = body.preset;

  for (const field of modelFields) {
    const key = field.replaceAll("_", "");
    const value = body[key];
    if (typeof value !== "string") continue;
    if (value !== "AUTO") {
      const split = value.indexOf("::");
      if (split < 1) return NextResponse.json({ error: "Select a model from the registry." }, { status: 400 });
      const providerKey = value.slice(0, split), modelId = value.slice(split + 2);
      const [{ data: model }, { data: provider }] = await Promise.all([
        admin.from("ai_models").select("id,is_free").eq("workspace_id", workspaceId).eq("provider_key", providerKey).eq("model_id", modelId).eq("enabled", true).maybeSingle(),
        admin.from("ai_providers").select("enabled").eq("workspace_id", workspaceId).eq("name", providerKey).maybeSingle(),
      ]);
      if (!model || !provider?.enabled) return NextResponse.json({ error: "Selected model or provider is not enabled." }, { status: 400 });
      if ((patch.preset ?? current.preset) === "ZERO COST" && !model.is_free) return NextResponse.json({ error: "ZERO COST routing only accepts free models." }, { status: 400 });
    }
    patch[field] = value;
  }
  const { error } = await admin.from("ai_task_routes").update(patch).eq("workspace_id", workspaceId).eq("task_key", taskKey);
  if (error) return NextResponse.json({ error: "Could not update task routing." }, { status: 500 });
  await admin.from("audit_logs").insert({ workspace_id: workspaceId, actor_id: user.id, action: "ai_routing.task_updated", resource_type: "ai_task_route", resource_id: taskKey, details: { fields: Object.keys(patch) } });
  return NextResponse.json({ ok: true });
}
