import test, { afterEach } from "node:test";
import assert from "node:assert/strict";
import { estimateAiCost, simpleAiSettings } from "../src/lib/ai/billing";
import { encryptCredential } from "../src/lib/ai/credentials";
import { routeCompletion } from "../src/lib/ai/router";

const originalFetch = globalThis.fetch;
const envKeys = ["AI_CREDENTIAL_ENCRYPTION_KEY", "AI_ALLOW_PAID_PROVIDERS", "AI_MONTHLY_BUDGET_USD", "AI_DISABLE_PROVIDER_QUOTA_MODE", "AI_ENABLE_OPENROUTER", "OPENROUTER_API_KEY"];
const originalEnv = Object.fromEntries(envKeys.map(key => [key, process.env[key]]));
afterEach(() => {
  globalThis.fetch = originalFetch;
  for (const key of envKeys) originalEnv[key] == null ? delete process.env[key] : process.env[key] = originalEnv[key];
});

function fixture(options: { simple?: boolean; taskEnabled?: boolean; providerEnabled?: boolean; extraProvider?: boolean; priced?: boolean; unknownHistory?: boolean; model?: string } = {}) {
  process.env.AI_CREDENTIAL_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
  process.env.AI_ALLOW_PAID_PROVIDERS = "false";
  process.env.AI_MONTHLY_BUDGET_USD = "0";
  process.env.AI_ENABLE_OPENROUTER = "true";
  process.env.OPENROUTER_API_KEY = "environment-fallback-test-only";
  delete process.env.AI_DISABLE_PROVIDER_QUOTA_MODE;
  const model = options.model ?? "gemini-test";
  const calls: string[] = [], writes: any[] = [];
  const providers = [{ id: "gemini-id", name: "gemini", base_url: "https://generativelanguage.googleapis.com/v1beta/openai", model, enabled: options.providerEnabled !== false, settings: { monthly_budget_usd: 100 } }];
  if (options.extraProvider) providers.push({ id: "or-id", name: "openrouter", base_url: "https://openrouter.ai/api/v1", model: "openrouter/free", enabled: true, settings: { monthly_budget_usd: 0 } });
  const models: any[] = [{ provider_key: "gemini", model_id: model, enabled: true, is_free: false, input_usd_per_million: options.priced ? 1 : null, output_usd_per_million: options.priced ? 2 : null }];
  if (options.extraProvider) models.push({ provider_key: "openrouter", model_id: "openrouter/free", enabled: true, is_free: true });
  const tables: Record<string, any> = {
    ai_task_routes: { enabled: options.taskEnabled !== false, preset: "CUSTOM", primary_model: `gemini::${model}`, recommended_model: `gemini::${model}`, consensus_enabled: true, confidence_threshold: .99 },
    ai_providers: providers,
    ai_models: models,
    ai_provider_credentials: providers.map(provider => ({ provider_id: provider.id, ciphertext: encryptCredential("test-only-key") })),
    workspaces: { settings: { ai_simple: { enabled: options.simple !== false, provider: "gemini", model, billingMode: "provider_quota" } } },
    ai_usage: options.unknownHistory ? [{ id: 1 }] : [],
  };
  const db: any = {
    from(table: string) {
      let data = tables[table] ?? [], error: any = null;
      const query: any = {
        select() { return query; }, eq() { return query; }, in() { return query; }, is() { return query; }, gte() { return query; }, limit() { return query; },
        maybeSingle() { if (Array.isArray(data)) data = data[0] ?? null; return query; }, single() { return query; },
        insert(value: any) { if (table === "ai_usage") writes.push(value); data = null; return query; },
        upsert() { data = null; return query; },
        then(resolve: any, reject: any) { return Promise.resolve({ data, error }).then(resolve, reject); },
      };
      return query;
    },
    async rpc() { return { data: [], error: null }; },
  };
  globalThis.fetch = (async (url: any) => {
    calls.push(String(url));
    return Response.json({ choices: [{ message: { content: JSON.stringify({ answer: "test", confidence: .1 }) } }], usage: { prompt_tokens: 10, completion_tokens: 5 } });
  }) as typeof fetch;
  const run = () => routeCompletion({ db, workspaceId: "workspace-test", purpose: "ai_analyst", consensus: true, messages: [{ role: "user", content: "Test input" }] });
  return { run, calls, writes, db };
}

test("Simple mode needs an explicit, valid provider quota profile", () => {
  assert.equal(simpleAiSettings({}), null);
  assert.equal(simpleAiSettings({ ai_simple: { enabled: true, provider: "gemini", model: "model", billingMode: "budgeted" } }), null);
  assert.equal(simpleAiSettings({ ai_simple: { enabled: false, provider: "gemini", model: "model", billingMode: "provider_quota" } }), null);
});

test("Simple runs at budget zero without prices, logs null cost, and makes one call despite low confidence/consensus", async () => {
  const f = fixture({ extraProvider: true });
  const result = await f.run();
  assert.equal(result.provider, "gemini");
  assert.equal(result.estimatedCost, null);
  assert.equal(result.escalated, false);
  assert.equal(f.calls.length, 1);
  assert.match(f.calls[0], /generativelanguage/);
  assert.equal(f.writes[0].estimated_cost_usd, null);
  assert.equal(f.writes[0].prompt_tokens, 10);
});

test("Simple records a known estimate when rates exist", async () => {
  const f = fixture({ priced: true, model: "known-cost-test" });
  const result = await f.run();
  assert.equal(result.estimatedCost, .00002);
  assert.equal(f.writes[0].estimated_cost_usd, .00002);
});

test("Simple never falls back to OpenRouter, including environment fallback, after provider failure", async () => {
  const f = fixture({ extraProvider: true, model: "failure-test" });
  globalThis.fetch = (async (url: any) => { f.calls.push(String(url)); return new Response("", { status: 429 }); }) as typeof fetch;
  await assert.rejects(f.run(), /gemini returned 429/);
  assert.equal(f.calls.length, 1);
  assert.match(f.calls[0], /generativelanguage/);
});

test("Simple respects provider kill switch and cannot use another enabled provider", async () => {
  const f = fixture({ providerEnabled: false, extraProvider: true });
  await assert.rejects(f.run(), /No enabled AI provider/);
  assert.equal(f.calls.length, 0);
});

test("Simple respects each task OFF control", async () => {
  const f = fixture({ taskEnabled: false });
  await assert.rejects(f.run(), /AI task is disabled/);
  assert.equal(f.calls.length, 0);
});

test("Server can revoke provider quota mode", async () => {
  const f = fixture();
  process.env.AI_DISABLE_PROVIDER_QUOTA_MODE = "true";
  await assert.rejects(f.run(), /disabled by the server administrator/);
  assert.equal(f.calls.length, 0);
});

test("Advanced still rejects missing pricing instead of silently bypassing the guard", async () => {
  const f = fixture({ simple: false });
  process.env.OPENROUTER_API_KEY = "";
  await assert.rejects(f.run(), /pricing is required/);
  assert.equal(f.calls.length, 0);
});

test("Advanced still requires the paid-provider guard", async () => {
  const f = fixture({ simple: false, priced: true });
  process.env.OPENROUTER_API_KEY = "";
  await assert.rejects(f.run(), /paid-provider guard/);
  assert.equal(f.calls.length, 0);
});

test("Advanced spending caps fail closed if previous usage cost is unknown", async () => {
  const f = fixture({ simple: false, priced: true, unknownHistory: true });
  process.env.OPENROUTER_API_KEY = "";
  process.env.AI_ALLOW_PAID_PROVIDERS = "true";
  process.env.AI_MONTHLY_BUDGET_USD = "100";
  await assert.rejects(f.run(), /unknown cost/);
  assert.equal(f.calls.length, 0);
});

test("Reported cost and verified free status are distinct from unavailable estimates", () => {
  const args = { isFree: false, providerManaged: true, inputTokens: 10, outputTokens: 5 };
  assert.equal(estimateAiCost({ ...args, reportedCost: .004 }), .004);
  assert.equal(estimateAiCost(args), null);
  assert.equal(estimateAiCost({ ...args, isFree: true }), 0);
});
