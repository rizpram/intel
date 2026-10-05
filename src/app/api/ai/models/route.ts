import { NextRequest, NextResponse } from "next/server";
import { aiAdminContext } from "@/lib/ai/admin-context";

export const dynamic = "force-dynamic";

export async function PATCH(request: NextRequest) {
  const context = await aiAdminContext();
  if ("response" in context) return context.response;
  const { admin, workspaceId, user } = context;
  const body = await request.json().catch(() => ({}));
  const providerKey = String(body.providerKey ?? ""), modelId = String(body.modelId ?? "");
  const { data: model } = await admin.from("ai_models").select("id,is_free").eq("workspace_id", workspaceId).eq("provider_key", providerKey).eq("model_id", modelId).maybeSingle();
  if (!model) return NextResponse.json({ error: "Model is not in the registry." }, { status: 404 });
  const patch: Record<string, unknown> = {};
  if (typeof body.enabled === "boolean") patch.enabled = body.enabled;
  for (const [key, column] of [["inputUsdPerMillion", "input_usd_per_million"], ["outputUsdPerMillion", "output_usd_per_million"]]) {
    if (body[key] === undefined) continue;
    if (body[key] !== null && (!Number.isFinite(Number(body[key])) || Number(body[key]) < 0)) return NextResponse.json({ error: "Model rates must be non-negative amounts per million tokens." }, { status: 400 });
    patch[column] = body[key] === null ? null : Number(body[key]);
  }
  if (!Object.keys(patch).length) return NextResponse.json({ error: "No model settings supplied." }, { status: 400 });
  const { data: provider } = await admin.from("ai_providers").select("enabled").eq("workspace_id", workspaceId).eq("name", providerKey).maybeSingle();
  if (body.enabled === true && !provider?.enabled) return NextResponse.json({ error: "Enable the provider before enabling its models." }, { status: 400 });
  const { error } = await admin.from("ai_models").update(patch).eq("id", model.id);
  if (error) return NextResponse.json({ error: "Could not update model settings." }, { status: 500 });
  await admin.from("audit_logs").insert({ workspace_id: workspaceId, actor_id: user.id, action: "ai_model.settings_updated", resource_type: "ai_model", resource_id: model.id, details: { enabled: patch.enabled, rates_changed: patch.input_usd_per_million !== undefined || patch.output_usd_per_million !== undefined } });
  return NextResponse.json({ ok: true });
}
