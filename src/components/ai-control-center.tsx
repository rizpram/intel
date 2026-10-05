"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Activity, CheckCircle2, ChevronDown, ChevronRight, CircleAlert, KeyRound, RefreshCw, Save, ShieldCheck, Sparkles, Zap } from "lucide-react";

type Model = { id: string; provider_key: string; model_id: string; display_name: string; enabled: boolean; is_free: boolean; capabilities: string[]; context_window: number | null; supports_vision: boolean; supports_structured_output: boolean; health: string; latency_ms: number | null; usage_count: number; error_count: number; error_rate?: number | null; input_usd_per_million: number | null; output_usd_per_million: number | null; estimated_cost_usd: number; suitability_score: number; recommended: boolean; recommendation_reason: string | null };
type Route = { task_key: string; label: string; enabled: boolean; preset: string; primary_model: string; fallback_model: string; second_opinion_model: string; judge_model: string; recommended_model: string; confidence_threshold: number; escalation_rules: string[]; consensus_enabled: boolean };
type Provider = { id: string; provider: string; baseUrl: string; defaultModel: string; enabled: boolean; hasApiKey: boolean; monthlyBudget: number; status?: string; latency_ms?: number; error_status?: string; checked_at?: string };

const providerCatalog = [
  { id: "openrouter", name: "OpenRouter", baseUrl: "https://openrouter.ai/api/v1" },
  { id: "gemini", name: "Google Gemini Direct", baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai" },
  { id: "openai", name: "OpenAI Direct", baseUrl: "https://api.openai.com/v1" },
  { id: "xai", name: "xAI / Grok Direct", baseUrl: "https://api.x.ai/v1" },
  { id: "custom", name: "Custom OpenAI-compatible", baseUrl: "" },
];
const taskCatalog = ["Sentiment","Emotion","Stance","Intent","Entity Extraction","Relevance","Spam / Noise Detection","Sarcasm Detection","Topic Classification","Narrative Clustering","Narrative Analysis","Trend Explanation","Crisis Analysis","Influencer Analysis","Multimodal Analysis","AI Analyst","Executive Summary","Report Generation"];
const taskKey = (label: string) => label.toLowerCase().replaceAll(" / ", "_").replaceAll(" ", "_");
const presets = ["ZERO COST","FAST","BALANCED","MAXIMUM ACCURACY","CRISIS MODE","CUSTOM"];
const escalationRuleLabels: Record<string, string> = { confidence_below: "Confidence below threshold", sarcasm: "Sarcasm detected", conflicting_classifications: "Conflicting classifications", high_impact_author: "High-impact author", high_engagement: "High engagement", rapid_velocity: "Rapid narrative velocity", crisis_mention: "Crisis-related mention" };
const routeModelFields: Record<string, keyof Route> = { primarymodel: "primary_model", fallbackmodel: "fallback_model", secondopinionmodel: "second_opinion_model", judgemodel: "judge_model" };

export default function AiControlCenter() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [models, setModels] = useState<Model[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [preset, setPreset] = useState("ZERO COST");
  const [globalBudget, setGlobalBudget] = useState(0);
  const [encryptionReady, setEncryptionReady] = useState(false);
  const [keys, setKeys] = useState<Record<string,string>>({});
  const [bases, setBases] = useState<Record<string,string>>({});
  const [budgets, setBudgets] = useState<Record<string,string>>({});
  const [prices, setPrices] = useState<Record<string,string>>({});
  const [expandedTask, setExpandedTask] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/ai/control", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "AI settings require a workspace administrator sign-in.");
      setProviders(providerCatalog.map(item => data.providers.find((provider: Provider) => provider.provider === item.id) ?? { id: item.id, provider: item.id, baseUrl: item.baseUrl, defaultModel: "", enabled: false, hasApiKey: false, monthlyBudget: 0 }));
      setModels(data.models ?? []); setRoutes(data.routes ?? []); setPreset(data.preset ?? "ZERO COST"); setGlobalBudget(data.globalBudgetUsd ?? 0); setEncryptionReady(Boolean(data.encryptionReady));
      setBases(previous => Object.fromEntries(providerCatalog.map(item => [item.id, previous[item.id] ?? data.providers.find((provider: Provider) => provider.provider === item.id)?.baseUrl ?? item.baseUrl])));
      setBudgets(previous => Object.fromEntries(providerCatalog.map(item => [item.id, previous[item.id] ?? String(data.providers.find((provider: Provider) => provider.provider === item.id)?.monthlyBudget ?? 0)])));
      setMessage("");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not load AI settings."); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const modelsForDropdown = useMemo(() => models.filter(model => model.enabled && providers.some(provider => provider.provider === model.provider_key && provider.enabled)), [models, providers]);
  async function post(url: string, body: unknown, key: string) {
    setBusy(key); setMessage("");
    try {
      const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "The setting could not be saved.");
      setMessage(data.discovered !== undefined ? `${data.discovered} models synced; ${data.newlyDisabled} newly discovered models remain disabled.` : data.latencyMs !== undefined ? `Connection healthy · ${data.latencyMs} ms${data.availableModels !== undefined ? ` · ${data.availableModels} models available` : ""}` : "AI routing settings saved.");
      return data;
    } catch (error) { setMessage(error instanceof Error ? error.message : "Request failed."); return null; }
    finally { setBusy(null); }
  }
  async function saveProvider(provider: Provider) {
    const data = await post("/api/ai/providers", { action: "save", provider: provider.provider, baseUrl: bases[provider.provider] ?? provider.baseUrl, enabled: provider.enabled, apiKey: keys[provider.provider] ?? "", monthlyBudget: Number(budgets[provider.provider] ?? 0) }, `save-${provider.provider}`);
    if (data) { setKeys(previous => ({ ...previous, [provider.provider]: "" })); await load(); }
  }
  async function providerAction(provider: Provider, action: "test" | "sync") {
    const data = await post("/api/ai/providers", { action, provider: provider.provider, apiKey: keys[provider.provider] ?? "" }, `${action}-${provider.provider}`);
    if (data?.ok) { if (action === "sync") await load(); else await load(); }
  }
  async function toggleProvider(provider: Provider) {
    const data = await post("/api/ai/providers", { action: "toggle", provider: provider.provider, enabled: !provider.enabled }, `toggle-${provider.provider}`);
    if (data) await load();
  }
  async function toggleModel(model: Model) {
    const data = await post("/api/ai/models", { providerKey: model.provider_key, modelId: model.model_id, enabled: !model.enabled }, `model-${model.id}`);
    if (data) await load();
  }
  async function savePrices(model: Model) {
    const input = prices[`${model.id}:in`]?.trim() ? Number(prices[`${model.id}:in`]) : model.input_usd_per_million;
    const output = prices[`${model.id}:out`]?.trim() ? Number(prices[`${model.id}:out`]) : model.output_usd_per_million;
    if (input == null || output == null) { setMessage("Enter both input and output token prices before enabling paid routing."); return; }
    const response = await fetch("/api/ai/models", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ providerKey: model.provider_key, modelId: model.model_id, inputUsdPerMillion: input, outputUsdPerMillion: output }) });
    const data = await response.json();
    if (!response.ok) { setMessage(data.error || "Model pricing could not be saved."); return; }
    setMessage("Model pricing saved."); await load();
  }
  async function updateRoute(route: Route, patch: Record<string, unknown>) {
    const data = await post("/api/ai/routes", { taskKey: route.task_key, ...patch }, `route-${route.task_key}`);
    if (data) await load();
  }
  async function applyPreset(value: string) {
    const data = await post("/api/ai/routes", { action: "preset", preset: value }, "preset");
    if (data) { setPreset(value); await load(); }
  }
  const modelLabel = (value: string) => {
    if (value === "AUTO") return "AUTO";
    const model = models.find(item => `${item.provider_key}::${item.model_id}` === value);
    return model ? model.display_name : value.split("::").at(-1) ?? value;
  };

  return <section className="ai-control-center">
    {message && <div className={`ai-control-message ${message.toLowerCase().includes("could not") || message.toLowerCase().includes("failed") || message.toLowerCase().includes("required") ? "error" : ""}`} role="status">{message}</div>}
    <div className="card ai-provider-panel">
      <div className="module-table-head"><div><h2>Providers</h2><p>Credentials are encrypted server-side; stored keys are never returned to this page.</p></div><span className="synthetic-tag">{encryptionReady ? "ENCRYPTION READY" : "ENCRYPTION KEY REQUIRED"}</span></div>
      <div className="ai-provider-grid">{providers.map(provider => {
        const meta = providerCatalog.find(item => item.id === provider.provider)!;
        const working = busy?.endsWith(provider.provider) ?? false;
        return <article className="ai-provider-card" key={provider.provider}>
          <header><div><b>{meta.name}</b><small>{provider.enabled ? "Enabled" : "Disabled"} · {provider.hasApiKey ? "Key saved" : "No key saved"}</small></div><button className={`ai-switch ${provider.enabled ? "on" : ""}`} aria-label={`${provider.enabled ? "Disable" : "Enable"} ${meta.name}`} onClick={() => void toggleProvider(provider)} disabled={working}>{provider.enabled ? "ON" : "OFF"}</button></header>
          {(provider.provider === "custom") && <label>OpenAI-compatible base URL<input value={bases[provider.provider] ?? ""} onChange={event => setBases(previous => ({ ...previous, [provider.provider]: event.target.value }))} placeholder="https://api.example.com/v1"/></label>}
          <label>API key<input type="password" autoComplete="new-password" value={keys[provider.provider] ?? ""} onChange={event => setKeys(previous => ({ ...previous, [provider.provider]: event.target.value }))} placeholder={provider.hasApiKey ? "Saved securely · enter only to rotate" : "Paste provider API key"}/></label>
          {provider.provider !== "openrouter" && <label>Provider monthly budget (USD)<input type="number" min="0" step="1" value={budgets[provider.provider] ?? "0"} onChange={event => setBudgets(previous => ({ ...previous, [provider.provider]: event.target.value }))}/></label>}
          <div className="ai-provider-health"><span className={provider.status === "healthy" ? "healthy" : provider.enabled ? "unhealthy" : "idle"}/><span>{provider.status ?? (provider.enabled ? (provider.hasApiKey ? "Not tested" : "Key required") : "Disabled")}</span>{provider.latency_ms != null && <b>{provider.latency_ms} ms</b>}{provider.error_status && <small>{provider.error_status}</small>}</div>
          <div className="ai-provider-actions"><button className="button-secondary" onClick={() => void saveProvider(provider)} disabled={working}><Save size={12}/> Save</button><button className="button-secondary" onClick={() => void providerAction(provider,"test")} disabled={working || !provider.hasApiKey && !keys[provider.provider]}><Activity size={12}/> Test</button><button className="button-secondary" onClick={() => void providerAction(provider,"sync")} disabled={working || !provider.hasApiKey && !keys[provider.provider]}><RefreshCw size={12}/> Sync models</button></div>
          {provider.provider === "openrouter" && <small className="ai-provider-note">Free OpenRouter models are discovered on sync. New models stay disabled until you enable them below.</small>}
        </article>;
      })}</div>
      <p className="ai-budget-note"><ShieldCheck size={13}/> Global paid-provider cap: <b>${globalBudget.toFixed(2)}/month</b> · direct paid calls also need explicit provider enablement, a provider budget, model pricing, and the server paid-provider guard.</p>
    </div>

    <div className="card ai-routing-panel">
      <div className="module-table-head"><div><h2>Task Routing</h2><p>Pick a preset, then tune any task. AUTO follows the recommended model and strategy.</p></div><span className="ai-preset-indicator"><Zap size={12}/> {preset}</span></div>
      <div className="ai-presets">{presets.map(item => <button key={item} className={preset === item ? "selected" : ""} onClick={() => void applyPreset(item)} disabled={busy === "preset"}>{item}</button>)}</div>
      <div className="ai-task-list">{(routes.length ? routes : taskCatalog.map(label => ({ task_key: taskKey(label), label, enabled: true, preset: "ZERO COST", primary_model: "AUTO", fallback_model: "AUTO", second_opinion_model: "AUTO", judge_model: "AUTO", recommended_model: "openrouter::openrouter/free", confidence_threshold: 0.72, escalation_rules: ["confidence_below"], consensus_enabled: false }))).map(route => {
        const selected = route.primary_model === "AUTO" ? route.recommended_model : route.primary_model;
        const isRecommended = route.primary_model === "AUTO" || selected === route.recommended_model;
        const expanded = expandedTask === route.task_key;
        const recommendation = models.find(model => `${model.provider_key}::${model.model_id}` === route.recommended_model);
        return <article className={`ai-task-row ${expanded ? "expanded" : ""}`} key={route.task_key}>
          <div className="ai-task-main"><button className="ai-task-expand" aria-label={`${expanded ? "Close" : "Open"} advanced routing for ${route.label}`} onClick={() => setExpandedTask(expanded ? null : route.task_key)}><ChevronRight size={14}/></button><div className="ai-task-label"><b>{route.label}</b><small>{modelLabel(selected)}</small></div><span className="ai-route-arrow">→</span><label className="ai-model-select"><span className="sr-only">Primary model for {route.label}</span><select value={route.primary_model} onChange={event => void updateRoute(route,{ primarymodel: event.target.value })}><option value="AUTO">AUTO · Recommended</option>{modelsForDropdown.map(model=><option key={model.id} value={`${model.provider_key}::${model.model_id}`}>{model.provider_key} · {model.display_name} · {model.is_free ? "FREE" : "PAID"}{model.recommended ? " · Recommended" : ""}</option>)}</select><ChevronDown size={12}/></label>{isRecommended && <span className="ai-recommended"><Sparkles size={10}/> Recommended</span>}<button className={`ai-switch task-switch ${route.enabled ? "on" : ""}`} aria-label={`${route.enabled ? "Disable" : "Enable"} ${route.label}`} onClick={() => void updateRoute(route,{ enabled: !route.enabled })}>{route.enabled ? "ON" : "OFF"}</button></div>
          {expanded && <div className="ai-task-advanced">
          <div className="ai-advanced-grid">{([["Primary","primarymodel"],["Fallback","fallbackmodel"],["Second Opinion","secondopinionmodel"],["Judge","judgemodel"]] as const).map(([label,key])=><label key={key}>{label}<select value={String(route[routeModelFields[key]]) ?? "AUTO"} onChange={event => void updateRoute(route,{ [key]: event.target.value })}><option value="AUTO">AUTO · Recommended</option>{modelsForDropdown.map(model=><option key={model.id} value={`${model.provider_key}::${model.model_id}`}>{model.provider_key} · {model.display_name} · {model.is_free ? "FREE" : "PAID"}{model.recommended || route.recommended_model === `${model.provider_key}::${model.model_id}` ? " · Recommended" : ""}</option>)}</select></label>)}</div>
            <div className="ai-threshold"><label>Confidence threshold <b>{Math.round(route.confidence_threshold * 100)}%</b><input type="range" min="0.4" max="0.98" step="0.01" value={route.confidence_threshold} onChange={event => void updateRoute(route,{ confidenceThreshold: Number(event.target.value) })}/></label><label className="ai-consensus"><input type="checkbox" checked={route.consensus_enabled} onChange={event => void updateRoute(route,{ consensusEnabled: event.target.checked })}/> Require multi-model consensus and judge on escalation</label></div>
            <div className="ai-escalation-rules"><b>Escalate when</b>{Object.entries(escalationRuleLabels).map(([key,label])=><label key={key}><input type="checkbox" checked={route.escalation_rules?.includes(key) ?? false} onChange={event => { const next = new Set(route.escalation_rules ?? []); event.target.checked ? next.add(key) : next.delete(key); void updateRoute(route,{ escalationRules: [...next] }); }}/>{label}</label>)}</div>
            <p className="ai-recommendation-copy">{recommendation?.recommendation_reason ?? "Recommended choices follow the selected preset and currently enabled model registry."}</p>
          </div>}
        </article>;
      })}</div>
    </div>

    <div className="card ai-model-registry">
      <div className="module-table-head"><div><h2>Unified Model Registry</h2><p>Models span all configured providers. Newly discovered entries start disabled.</p></div><span className="synthetic-tag">{models.length} MODELS</span></div>
      {models.length ? <div className="ai-model-table"><div className="ai-model-head"><span>MODEL</span><span>CAPABILITIES</span><span>HEALTH / LATENCY</span><span>USAGE / COST</span><span>ROUTE</span></div>{models.map(model=><div className="ai-model-row" key={model.id}><div><b>{model.display_name}</b>{model.recommended&&<span className="ai-recommended"><Sparkles size={10}/> Recommended</span>}<small>{model.provider_key} · {model.model_id}</small><small>Suitability {Math.round(model.suitability_score)}/100{model.error_rate!=null?` · ${(model.error_rate*100).toFixed(1)}% errors`:" · awaiting telemetry"}</small></div><div className="ai-model-tags"><span className={model.is_free?"free":"paid"}>{model.is_free?"FREE":"PAID"}</span>{model.supports_vision&&<span>Vision</span>}{model.supports_structured_output&&<span>JSON</span>}{model.context_window&&<span>{Math.round(model.context_window/1000)}K ctx</span>}</div><div><i className={`ai-health-dot ${model.health}`}/>{model.health}{model.latency_ms!=null&&<small>{model.latency_ms} ms</small>}</div><div>{model.usage_count.toLocaleString()} calls<small>${Number(model.estimated_cost_usd||0).toFixed(4)} est.</small>{!model.is_free&&<div className="ai-model-rates"><input aria-label={`${model.display_name} input price per million`} type="number" min="0" step="0.01" placeholder={`In ${model.input_usd_per_million ?? "?"}`} value={prices[`${model.id}:in`] ?? ""} onChange={event=>setPrices(previous=>({...previous,[`${model.id}:in`]:event.target.value}))}/><input aria-label={`${model.display_name} output price per million`} type="number" min="0" step="0.01" placeholder={`Out ${model.output_usd_per_million ?? "?"}`} value={prices[`${model.id}:out`] ?? ""} onChange={event=>setPrices(previous=>({...previous,[`${model.id}:out`]:event.target.value}))}/><button onClick={()=>void savePrices(model)}>Save pricing</button></div>}</div><div><button className={`ai-switch ${model.enabled?"on":""}`} aria-label={`${model.enabled?"Disable":"Enable"} ${model.display_name}`} onClick={()=>void toggleModel(model)}>{model.enabled?"ON":"OFF"}</button></div></div>)}</div> : <div className="ai-empty-models"><CircleAlert size={16}/><span>No synced models yet. Save a provider, test it, then sync its model catalog.</span></div>}
    </div>
  </section>;
}
