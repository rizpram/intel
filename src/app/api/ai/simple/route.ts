import { NextRequest, NextResponse } from "next/server";
import { aiAdminContext } from "@/lib/ai/admin-context";
import { decryptCredential, encryptCredential } from "@/lib/ai/credentials";
import { modelMetadata, providerInfo, safeProviderUrl } from "@/lib/ai/catalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const context = await aiAdminContext();
  if ("response" in context) return context.response;
  const { admin, workspaceId, user } = context;
  const body = await request.json().catch(() => ({}));
  const { data: workspace, error: workspaceError } = await admin.from("workspaces").select("settings").eq("id", workspaceId).single();
  if (workspaceError) return NextResponse.json({ error: "Could not load workspace AI settings." }, { status: 500 });

  if (body.action === "advanced") {
    const { error } = await admin.from("workspaces").update({ settings: { ...workspace.settings, ai_simple: { enabled: false } } }).eq("id", workspaceId);
    if (error) return NextResponse.json({ error: "Could not restore advanced routing." }, { status: 500 });
    await admin.from("audit_logs").insert({ workspace_id: workspaceId, actor_id: user.id, action: "ai_simple.disabled", resource_type: "workspace" });
    return NextResponse.json({ ok: true });
  }
  if (body.action !== "activate" || body.billingMode !== "provider_quota") return NextResponse.json({ error: "Select provider quota billing to activate Simple mode." }, { status: 400 });
  if (process.env.AI_DISABLE_PROVIDER_QUOTA_MODE === "true") return NextResponse.json({ error: "Simple provider quota mode is disabled by the server administrator." }, { status: 403 });
  const provider = String(body.provider ?? "");
  const info = providerInfo(provider);
  const modelId = String(body.model ?? "").trim().replace(/^models\//, "");
  if (!info || !modelId || modelId.length > 200 || /\s/.test(modelId)) return NextResponse.json({ error: "Choose a provider and valid model ID." }, { status: 400 });
  const { data: current, error: providerError } = await admin.from("ai_providers").select("id,base_url,settings,enabled").eq("workspace_id", workspaceId).eq("name", provider).maybeSingle();
  if (providerError) return NextResponse.json({ error: "Could not load the provider." }, { status: 500 });
  let baseUrl: string;
  try { baseUrl = safeProviderUrl(provider === "custom" ? String(body.baseUrl ?? current?.base_url ?? "") : info.baseUrl); }
  catch { return NextResponse.json({ error: "Enter a valid HTTPS provider URL." }, { status: 400 }); }
  const incomingKey = typeof body.apiKey === "string" ? body.apiKey.trim() : "";
  if (!process.env.AI_CREDENTIAL_ENCRYPTION_KEY) return NextResponse.json({ error: "Server credential encryption is not configured." }, { status: 503 });
  let key = incomingKey;
  if (!key && current) {
    const { data: secret } = await admin.from("ai_provider_credentials").select("ciphertext").eq("provider_id", current.id).maybeSingle();
    try { if (secret) key = decryptCredential(secret.ciphertext); } catch { return NextResponse.json({ error: "Stored credential cannot be read. Re-enter the API key." }, { status: 503 }); }
  }
  if (!key) return NextResponse.json({ error: "Enter an API key first." }, { status: 400 });
  const { data: registered, error: registryError } = await admin.from("ai_models").select("*").eq("workspace_id", workspaceId).eq("provider_key", provider).eq("model_id", modelId).maybeSingle();
  if (registryError) return NextResponse.json({ error: "Could not load the model registry." }, { status: 500 });
  let metadata = registered;
  {
    if (provider === "custom") metadata = registered ?? modelMetadata(provider, { id: modelId });
    else {
      try {
        const url = provider === "gemini" ? "https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000" : `${baseUrl}/models`;
        const headers: Record<string, string> = provider === "gemini" ? { "x-goog-api-key": key } : { Authorization: `Bearer ${key}` };
        const response = await fetch(url, { headers, redirect: "error", signal: AbortSignal.timeout(15_000) });
        if (!response.ok) return NextResponse.json({ error: `Provider connection failed (HTTP ${response.status}). Test the key and try again.` }, { status: 502 });
        const payload = await response.json();
        const raw = ((provider === "gemini" ? payload.models : payload.data) ?? []).find((item: any) => String(item.id ?? item.name ?? "").replace(/^models\//, "") === modelId);
        if (!raw) return NextResponse.json({ error: "Model was not found in this provider's catalog. Sync models or choose another model." }, { status: 400 });
        metadata = registered ?? modelMetadata(provider, raw);
      } catch { return NextResponse.json({ error: "Provider catalog could not be reached. Try again or sync models first." }, { status: 502 }); }
    }
  }
  const { data: saved, error: saveError } = await admin.from("ai_providers").upsert({ ...(current ? { id: current.id } : {}), workspace_id: workspaceId, name: provider, base_url: baseUrl, model: modelId, enabled: current?.enabled ?? false, settings: { ...current?.settings, display_name: info.name } }, { onConflict: "workspace_id,name" }).select("id").single();
  if (saveError || !saved) return NextResponse.json({ error: "Could not save provider settings." }, { status: 500 });
  if (incomingKey) {
    const { error } = await admin.from("ai_provider_credentials").upsert({ provider_id: saved.id, ciphertext: encryptCredential(key), updated_at: new Date().toISOString() });
    if (error) return NextResponse.json({ error: "Could not securely save the API key." }, { status: 500 });
  }
  const { error: modelError } = await admin.from("ai_models").upsert({ ...metadata, workspace_id: workspaceId, provider_key: provider, model_id: modelId, enabled: true }, { onConflict: "workspace_id,provider_key,model_id" });
  if (modelError) return NextResponse.json({ error: "Could not enable the selected model." }, { status: 500 });
  const { error: enableError } = await admin.from("ai_providers").update({ enabled: true }).eq("id", saved.id).eq("workspace_id", workspaceId);
  if (enableError) return NextResponse.json({ error: "Could not enable the provider." }, { status: 500 });
  const { error: modeError } = await admin.from("workspaces").update({ settings: { ...workspace.settings, ai_simple: { enabled: true, provider, model: modelId, billingMode: "provider_quota", updatedAt: new Date().toISOString(), updatedBy: user.id } } }).eq("id", workspaceId);
  if (modeError) return NextResponse.json({ error: "Provider saved, but Simple mode could not be activated." }, { status: 500 });
  await admin.from("audit_logs").insert({ workspace_id: workspaceId, actor_id: user.id, action: "ai_simple.activated", resource_type: "workspace", details: { provider, model: modelId, billing_mode: "provider_quota" } });
  return NextResponse.json({ ok: true, provider, model: modelId });
}
