import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { decryptCredential, encryptCredential } from "@/lib/ai/credentials";
import { testMetaCredentials } from "../../../../worker/connectors/meta-graph";

export const dynamic = "force-dynamic";

const topicSourceCatalog = [
  { id: "news_web", name: "News / Web", provider: null, endpointEnv: null, secretEnv: null },
  { id: "youtube", name: "YouTube", provider: null, endpointEnv: null, secretEnv: null },
  { id: "reddit", name: "Reddit", provider: null, endpointEnv: null, secretEnv: null },
  { id: "x", name: "X", provider: "x_api", endpointEnv: "X_API_SEARCH_URL", secretEnv: "CONNECTOR_SECRET_X_API" },
  { id: "facebook", name: "Facebook Page", provider: "meta_graph", endpointEnv: null, secretEnv: null },
  { id: "instagram", name: "Instagram professional", provider: "meta_graph", endpointEnv: null, secretEnv: null },
  { id: "tiktok", name: "TikTok", provider: "tiktok_business", endpointEnv: "TIKTOK_BUSINESS_MENTIONS_URL", secretEnv: "CONNECTOR_SECRET_TIKTOK_BUSINESS" },
  { id: "threads", name: "Threads", provider: "meta_graph", endpointEnv: null, secretEnv: null },
];

function cleanList(value: unknown, hashtag = false): string[] {
  const raw = Array.isArray(value) ? value : typeof value === "string" ? value.split(/[\n,;]+/) : [];
  const found = new Map<string, string>();
  for (const item of raw) {
    if (typeof item !== "string") continue;
    let normalized = item.trim().replace(/\s+/g, " ");
    if (hashtag) normalized = `#${normalized.replace(/^#+/, "")}`;
    if (!normalized || normalized === "#") continue;
    const key = normalized.toLocaleLowerCase();
    if (!found.has(key)) found.set(key, normalized);
  }
  return [...found.values()];
}

function searchText(keywords: string[], related: string[], hashtags: string[]) {
  const terms = [...keywords, ...related, ...hashtags];
  return terms.map(value => `"${value.replace(/\\/g, "\\\\").replace(/"/g, "\\\"")}"`).join(" OR ").slice(0, 1000);
}

function topicQueryFromBody(body: Record<string, any>, existing: Record<string, any> = {}) {
  const before = existing.query && typeof existing.query === "object" ? existing.query : {};
  const primaryKeywords = cleanList(body.primaryKeywords ?? before.primary_keywords ?? body.query ?? before.text);
  const relatedKeywords = cleanList(body.relatedKeywords ?? before.related_keywords);
  const hashtags = cleanList(body.hashtags ?? before.hashtags, true);
  const excludedKeywords = cleanList(body.excludedKeywords ?? before.excluded_keywords);
  const sources = cleanList(body.sources ?? before.sources);
  const language = String(body.language ?? before.language ?? "id");
  const startsOn = String(body.startsOn ?? before.starts_on ?? "");
  const endsOn = String(body.endsOn ?? before.ends_on ?? "");
  const lifecycle = String(body.status ?? before.lifecycle ?? (existing.is_active === false ? "paused" : "active"));
  const query = {
    ...before,
    text: searchText(primaryKeywords, relatedKeywords, hashtags),
    primary_keywords: primaryKeywords,
    related_keywords: relatedKeywords,
    hashtags,
    excluded_keywords: excludedKeywords,
    sources,
    language: ["id", "en", "all"].includes(language) ? language : "id",
    starts_on: startsOn || null,
    ends_on: endsOn || null,
    lifecycle: ["active", "paused", "archived"].includes(lifecycle) ? lifecycle : "active",
    ingestion: before.ingestion ?? { status: "idle" },
  };
  const languages = query.language === "all" ? ["id", "en"] : [query.language];
  return { query, languages, primaryKeywords };
}

function connectorIsConfigured(row: Record<string, any>) {
  const provider = String(row.provider ?? "");
  if (provider === "meta_graph") return Boolean(row.capabilities?.credential_configured && (row.capabilities?.facebook_configured || row.capabilities?.instagram_configured || row.capabilities?.threads_configured));
  const catalog = topicSourceCatalog.find(item => item.provider === provider);
  if (!catalog?.endpointEnv || !catalog.secretEnv) return false;
  return Boolean(process.env[catalog.endpointEnv] && process.env[row.auth_ref || catalog.secretEnv]);
}

async function context() {
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return { response: NextResponse.json({ error: "Sign in required." }, { status: 401 }) } as const;
  const { data: membership, error } = await db.from("workspace_memberships").select("workspace_id,role").eq("user_id", user.id).order("created_at", { ascending: true }).limit(1).maybeSingle();
  if (error || !membership) return { response: NextResponse.json({ error: "Workspace membership not found." }, { status: 403 }) } as const;
  return { db, user, workspaceId: membership.workspace_id as string, role: membership.role as string } as const;
}

export async function GET(request: NextRequest) {
  const ctx = await context();
  if ("response" in ctx) return ctx.response;
  const { db, workspaceId, role } = ctx;
  const resource = request.nextUrl.searchParams.get("resource") ?? "overview";
  const topicId = request.nextUrl.searchParams.get("topicId");
  const scoped = (query: any) => query.eq("workspace_id", workspaceId);
  const limit = Math.min(200, Math.max(1, Number(request.nextUrl.searchParams.get("limit") ?? 100)));

  if (resource === "topics") {
    const { data, error } = await scoped(db.from("monitoring_topics").select("id,name,description,query,languages,is_active,demo_mode,created_at,updated_at")).order("created_at", { ascending: false });
    if (error) return NextResponse.json({ error: "Could not load monitoring topics." }, { status: 500 });
    const { data: connectors, error: connectorError } = await scoped(db.from("connectors").select("id,provider,display_name,state,capabilities,last_sync_at,last_error,config"));
    if (connectorError) return NextResponse.json({ error: "Could not load source availability." }, { status: 500 });
    const connectorRows = connectors ?? [];
    const configuredRows = new Map(connectorRows.filter(connectorIsConfigured).map((row: any) => [row.provider, row]));
    const sourceOptions: Array<{ id: string; name: string; provider: string | null; endpointEnv: string | null; secretEnv: string | null; configured: boolean; configurationLabel: string }> = topicSourceCatalog.map(source => {
      const row: any = configuredRows.get(source.provider ?? "");
      const platformConfigured = source.provider === "meta_graph" ? Boolean(row?.capabilities?.[`${source.id}_configured`]) : Boolean(row);
      return { ...source, configured: platformConfigured, configurationLabel: platformConfigured ? "Configured" : "Requires configuration" };
    });
    for (const connector of connectorRows) {
      if (topicSourceCatalog.some(source => source.provider === connector.provider)) continue;
      sourceOptions.push({ id: `connector:${connector.provider}`, name: connector.display_name, provider: connector.provider, configured: false, endpointEnv: null, secretEnv: null, configurationLabel: "No worker adapter registered" });
    }
    const topicStats: Array<[string, { mentionCount: number; lastIngestionAt: string | null }]> = await Promise.all((data ?? []).map(async (topic: any) => {
      const topicProviders = [...new Set((topic.query?.sources ?? []).map((id: string) => topicSourceCatalog.find(source => source.id === id)?.provider).filter(Boolean))];
      const [{ count }, { data: latest }, connectorResult] = await Promise.all([
        scoped(db.from("conversations").select("id", { count: "exact", head: true })).eq("topic_id", topic.id),
        scoped(db.from("conversations").select("captured_at").eq("topic_id", topic.id).order("captured_at", { ascending: false }).limit(1).maybeSingle()),
        topicProviders.length ? scoped(db.from("connectors").select("provider,last_sync_at")).in("provider", topicProviders) : Promise.resolve({ data: [], error: null }),
      ]);
      const lastConnectorSync = (connectorResult.data ?? []).map((row: any) => row.last_sync_at).filter(Boolean).sort().at(-1);
      return [topic.id, { mentionCount: count ?? 0, lastIngestionAt: latest?.captured_at ?? lastConnectorSync ?? null }] as [string, { mentionCount: number; lastIngestionAt: string | null }];
    }));
    const stats = new Map<string, { mentionCount: number; lastIngestionAt: string | null }>(topicStats);
    return NextResponse.json({ topics: (data ?? []).map((topic: any) => ({ ...topic, ...stats.get(topic.id), ingestionStatus: topic.query?.ingestion?.status ?? "idle" })), sources: sourceOptions });
  }
  if (resource === "connectors" || resource === "sources") {
    const { data, error } = await scoped(db.from("connectors").select("id,provider,display_name,state,capabilities,last_sync_at,last_error,config,created_at")).order("display_name");
    if (error) return NextResponse.json({ error: "Could not load connectors." }, { status: 500 });
    const connectorRows = data ?? [];
    const meta = connectorRows.find((row: any) => row.provider === "meta_graph");
    if (meta) {
      const admin = createAdminClient();
      const { data: credential } = await admin.from("connector_credentials").select("connector_id").eq("connector_id", meta.id).maybeSingle();
      meta.capabilities = { ...(meta.capabilities ?? {}), credential_configured: Boolean(credential) };
    }
    return NextResponse.json({ connectors: connectorRows });
  }
  if (resource === "conversations" || resource === "live" || resource === "explorer") {
    let query = scoped(db.from("conversations").select("id,topic_id,source,canonical_url,author_name,author_handle,author_followers,content,language,published_at,reach,engagement,conversation_analyses(sentiment,sentiment_score,emotions,stance,intent,entities)")).order("published_at", { ascending: false }).limit(limit);
    if (topicId) query = query.eq("topic_id", topicId);
    const { data, error } = await query;
    if (error) return NextResponse.json({ error: "Could not load conversations." }, { status: 500 });
    return NextResponse.json({ conversations: data ?? [] });
  }
  if (resource === "narratives") {
    let query = scoped(db.from("narratives").select("id,topic_id,title,summary,keywords,sentiment,post_count,share,velocity,risk_score,first_seen_at,last_seen_at,metadata")).order("last_seen_at", { ascending: false }).limit(limit);
    if (topicId) query = query.eq("topic_id", topicId);
    const { data, error } = await query;
    if (error) return NextResponse.json({ error: "Could not load narratives." }, { status: 500 });
    return NextResponse.json({ narratives: data ?? [] });
  }
  if (resource === "entities") {
    const { data, error } = await scoped(db.from("entities").select("id,canonical_name,entity_type,aliases,metadata")).order("canonical_name").limit(limit);
    if (error) return NextResponse.json({ error: "Could not load entities." }, { status: 500 });
    return NextResponse.json({ entities: data ?? [] });
  }
  if (resource === "influencers") {
    const { data, error } = await scoped(db.from("influencer_profiles").select("id,source,display_name,handle,profile_url,follower_count,engagement_rate,influence_score,topics,last_seen_at")).order("influence_score", { ascending: false }).limit(limit);
    if (error) return NextResponse.json({ error: "Could not load influencer profiles." }, { status: 500 });
    return NextResponse.json({ influencers: data ?? [] });
  }
  if (resource === "network") {
    let query = scoped(db.from("propagation_edges").select("id,topic_id,from_author_id,to_author_id,conversation_id,edge_type,occurred_at,weight,metadata")).order("occurred_at", { ascending: true }).limit(limit);
    if (topicId) query = query.eq("topic_id", topicId);
    const { data, error } = await query;
    if (error) return NextResponse.json({ error: "Could not load propagation events." }, { status: 500 });
    return NextResponse.json({ edges: data ?? [] });
  }
  if (resource === "competitors") {
    const { data: topics, error: topicError } = await scoped(db.from("monitoring_topics").select("id,name,is_active")).eq("is_active", true);
    if (topicError) return NextResponse.json({ error: "Could not load comparison topics." }, { status: 500 });
    const { data: posts, error } = await scoped(db.from("conversations").select("topic_id,source,published_at")).gte("published_at", new Date(Date.now() - 7 * 86400_000).toISOString()).limit(5000);
    if (error) return NextResponse.json({ error: "Could not calculate topic comparison." }, { status: 500 });
    const totals = new Map<string, number>();
    for (const post of posts ?? []) totals.set(post.topic_id, (totals.get(post.topic_id) ?? 0) + 1);
    const all = [...totals.values()].reduce((a, b) => a + b, 0);
    return NextResponse.json({ comparisons: (topics ?? []).map((topic: { id: string; name: string; is_active: boolean }) => ({ ...topic, mentions: totals.get(topic.id) ?? 0, shareOfVoice: all ? Math.round(((totals.get(topic.id) ?? 0) / all) * 1000) / 10 : 0 })) });
  }
  if (resource === "alerts") {
    const [events, rules] = await Promise.all([
      scoped(db.from("alert_events").select("id,rule_id,topic_id,title,summary,severity,status,triggered_at,resolved_at,evidence_conversation_ids")).order("triggered_at", { ascending: false }).limit(limit),
      scoped(db.from("alert_rules").select("id,topic_id,name,rule,severity,is_enabled,created_at")).order("created_at", { ascending: false }),
    ]);
    if (events.error || rules.error) return NextResponse.json({ error: "Could not load alerts." }, { status: 500 });
    return NextResponse.json({ events: events.data ?? [], rules: rules.data ?? [] });
  }
  if (resource === "reports") {
    const { data, error } = await scoped(db.from("reports").select("id,topic_id,title,format,status,content,created_at")).order("created_at", { ascending: false }).limit(limit);
    if (error) return NextResponse.json({ error: "Could not load reports." }, { status: 500 });
    return NextResponse.json({ reports: data ?? [] });
  }
  if (resource === "admin") {
    if (!["owner", "admin"].includes(role)) return NextResponse.json({ error: "Workspace admin access required." }, { status: 403 });
    const admin = createAdminClient();
    const [members, audit] = await Promise.all([
      admin.from("workspace_memberships").select("user_id,role,created_at").eq("workspace_id", workspaceId).order("created_at"),
      admin.from("audit_logs").select("id,actor_id,action,resource_type,resource_id,details,created_at").eq("workspace_id", workspaceId).order("created_at", { ascending: false }).limit(limit),
    ]);
    if (members.error || audit.error) return NextResponse.json({ error: "Could not load workspace administration." }, { status: 500 });
    const memberRows = await Promise.all((members.data ?? []).map(async member => {
      const { data } = await admin.auth.admin.getUserById(member.user_id);
      return { ...member, email: data.user?.email ?? "Unknown user" };
    }));
    return NextResponse.json({ members: memberRows, audit: audit.data ?? [] });
  }
  if (resource === "overview") {
    const [topics, posts, analyses, narratives, metrics, events] = await Promise.all([
      scoped(db.from("monitoring_topics").select("id,name,is_active")).eq("is_active", true),
      (topicId ? scoped(db.from("conversations").select("id,topic_id,source,content,author_name,published_at,reach,engagement,conversation_analyses(sentiment)")).eq("topic_id", topicId) : scoped(db.from("conversations").select("id,topic_id,source,content,author_name,published_at,reach,engagement"))).order("published_at", { ascending: false }).limit(200),
      scoped(db.from("conversation_analyses").select("sentiment,emotions,conversation_id,conversations!inner(topic_id)")).limit(2000),
      (topicId ? scoped(db.from("narratives").select("id,title,risk_score,post_count,last_seen_at")).eq("topic_id", topicId) : scoped(db.from("narratives").select("id,title,risk_score,post_count,last_seen_at")).order("last_seen_at", { ascending: false }).limit(8)),
      (topicId ? scoped(db.from("topic_metrics_hourly").select("bucket_at,mention_count,positive_count,neutral_count,negative_count,potential_reach,source_breakdown")).eq("topic_id", topicId) : scoped(db.from("topic_metrics_hourly").select("bucket_at,mention_count,positive_count,neutral_count,negative_count,potential_reach,source_breakdown")).order("bucket_at", { ascending: false }).limit(48)),
      (topicId ? scoped(db.from("alert_events").select("id,title,summary,severity,status,triggered_at")).eq("topic_id", topicId) : scoped(db.from("alert_events").select("id,title,summary,severity,status,triggered_at")).order("triggered_at", { ascending: false }).limit(8)).eq("status", "open"),
    ]);
    if ([topics, posts, analyses, narratives, metrics, events].some(result => result.error)) return NextResponse.json({ error: "Could not load command center data." }, { status: 500 });
    const sentiment = { positive: 0, neutral: 0, negative: 0, mixed: 0 };
    const analysisRows = topicId ? (posts.data ?? []).flatMap((post: any) => Array.isArray(post.conversation_analyses) ? post.conversation_analyses : post.conversation_analyses ? [post.conversation_analyses] : []) : analyses.data ?? [];
    for (const row of analysisRows) if (row.sentiment in sentiment) sentiment[row.sentiment as keyof typeof sentiment]++;
    return NextResponse.json({ topics: topics.data ?? [], conversations: posts.data ?? [], analyzedCount: analyses.data?.length ?? 0, sentiment, narratives: narratives.data ?? [], metrics: [...(metrics.data ?? [])].reverse(), alerts: events.data ?? [] });
  }
  return NextResponse.json({ error: "Unknown workspace resource." }, { status: 400 });
}

export async function POST(request: NextRequest) {
  const ctx = await context();
  if ("response" in ctx) return ctx.response;
  const { db, workspaceId, user, role } = ctx;
  if (!["owner", "admin", "analyst"].includes(role)) return NextResponse.json({ error: "Analyst access required." }, { status: 403 });
  const body = await request.json().catch(() => ({}));
  const action = String(body.action ?? "");

  if (action === "create_topic") {
    const name = String(body.name ?? "").trim();
    const { query, languages, primaryKeywords } = topicQueryFromBody(body);
    if (name.length < 2 || name.length > 100) return NextResponse.json({ error: "Enter a topic name between 2 and 100 characters." }, { status: 400 });
    if (!primaryKeywords.length) return NextResponse.json({ error: "Add at least one main keyword." }, { status: 400 });
    if (query.starts_on && query.ends_on && query.starts_on > query.ends_on) return NextResponse.json({ error: "The monitoring end date must be the same as or later than its start date." }, { status: 400 });
    const isActive = query.lifecycle === "active";
    const { data, error } = await db.from("monitoring_topics").insert({ workspace_id: workspaceId, name, description: String(body.description ?? "").trim().slice(0, 500) || null, query, languages, is_active: isActive, created_by: user.id }).select("id,name,description,query,languages,is_active,created_at").single();
    if (error) return NextResponse.json({ error: "Could not create monitoring topic." }, { status: 500 });
    const { error: queueError } = await createAdminClient().from("worker_jobs").insert({ workspace_id: workspaceId, topic_id: data.id, job_type: "prepare_topic", payload: {} });
    if (queueError) {
      const failedQuery = { ...query, ingestion: { status: "queue_error", message: "The topic was saved, but the worker could not be notified. Try refreshing or contact an administrator." } };
      await createAdminClient().from("monitoring_topics").update({ query: failedQuery, updated_at: new Date().toISOString() }).eq("id", data.id).eq("workspace_id", workspaceId);
      return NextResponse.json({ topic: { ...data, query: failedQuery }, workerStatus: "queue_error", message: failedQuery.ingestion.message }, { status: 201 });
    }
    const { data: sourceRows } = await db.from("connectors").select("provider,capabilities").eq("workspace_id", workspaceId);
    const noSourceConfigured = !query.sources.length || !query.sources.some((sourceId: string) => {
      const source = topicSourceCatalog.find(item => item.id === sourceId);
      if (!source?.provider) return false;
      if (source.provider === "meta_graph") return Boolean(sourceRows?.some(row => row.provider === "meta_graph" && row.capabilities?.credential_configured && row.capabilities?.[`${source.id}_configured`]));
      return Boolean(source.endpointEnv && source.secretEnv && process.env[source.endpointEnv] && process.env[source.secretEnv]);
    });
    const message = noSourceConfigured ? "Topic created successfully. Configure at least one data source to begin ingestion." : "Topic saved successfully. The worker was notified to prepare ingestion.";
    return NextResponse.json({ topic: data, workerStatus: "queued", message }, { status: 201 });
  }
  if (action === "create_connector") {
    if (!["owner", "admin"].includes(role)) return NextResponse.json({ error: "Workspace admin access required." }, { status: 403 });
    const providers: Record<string, { name: string; endpointEnv: string | null }> = { x_api: { name: "X API", endpointEnv: "X_API_SEARCH_URL" }, meta_graph: { name: "Meta Graph API", endpointEnv: null }, tiktok_business: { name: "TikTok Business API", endpointEnv: "TIKTOK_BUSINESS_MENTIONS_URL" } };
    const provider = String(body.provider ?? "");
    const option = providers[provider];
    if (!option) return NextResponse.json({ error: "Select a supported official API connector." }, { status: 400 });
    const { data: existing } = await db.from("connectors").select("id,provider,display_name,state,capabilities,last_sync_at,last_error").eq("workspace_id", workspaceId).eq("provider", provider).maybeSingle();
    if (existing) return NextResponse.json({ connector: existing }, { status: 200 });
    const { data, error } = await db.from("connectors").insert({ workspace_id: workspaceId, provider, display_name: option.name, state: "disconnected", auth_ref: option.endpointEnv ? `CONNECTOR_SECRET_${provider.toUpperCase()}` : null, capabilities: { endpoint_configured: option.endpointEnv ? Boolean(process.env[option.endpointEnv]) : true, credential_configured: false, authorized_api_only: true } }).select("id,provider,display_name,state,capabilities,last_sync_at,last_error").single();
    if (error) return NextResponse.json({ error: "Could not save connector configuration." }, { status: 500 });
    return NextResponse.json({ connector: data }, { status: 201 });
  }
  if (action === "save_meta_config" || action === "test_meta_config") {
    if (!["owner", "admin"].includes(role)) return NextResponse.json({ error: "Workspace admin access required." }, { status: 403 });
    const admin = createAdminClient();
    const { data: connector, error: connectorError } = await db.from("connectors").select("id,provider,config,capabilities,state").eq("workspace_id", workspaceId).eq("provider", "meta_graph").maybeSingle();
    if (connectorError) return NextResponse.json({ error: "Could not load Meta connector." }, { status: 500 });
    let connectorId = connector?.id as string | undefined;
    let config = (connector?.config ?? {}) as Record<string, string>;
    let capabilities = (connector?.capabilities ?? {}) as Record<string, any>;
    if (action === "save_meta_config") {
      const pairs = [
        ["facebook_page_id", body.facebookPageId, "facebook_page", "facebookPageToken"],
        ["instagram_account_id", body.instagramAccountId, "instagram", "instagramToken"],
        ["threads_user_id", body.threadsUserId, "threads", "threadsToken"],
      ] as const;
      for (const [key, value, _tokenKey, tokenField] of pairs) {
        const next = typeof value === "string" ? value.trim() : "";
        if (next && (!/^[A-Za-z0-9._-]{1,128}$/.test(next))) return NextResponse.json({ error: "Meta account IDs may contain letters, numbers, dots, underscores, and hyphens." }, { status: 400 });
        if (next) config = { ...config, [key]: next };
        const token = typeof body[tokenField] === "string" ? body[tokenField].trim() : "";
        if (token.length > 4096) return NextResponse.json({ error: "Access token is too long." }, { status: 400 });
      }
      const { data: priorCredential } = connectorId ? await admin.from("connector_credentials").select("ciphertext").eq("connector_id", connectorId).maybeSingle() : { data: null };
      let credentials: Record<string, string> = {};
      if (priorCredential?.ciphertext) {
        try { credentials = JSON.parse(decryptCredential(priorCredential.ciphertext)); } catch { return NextResponse.json({ error: "Stored Meta credential cannot be decrypted. Re-enter tokens after checking the server encryption key." }, { status: 500 }); }
      }
      for (const [tokenKey, tokenField] of [["facebook_page", "facebookPageToken"], ["instagram", "instagramToken"], ["threads", "threadsToken"]] as const) {
        const incoming = typeof body[tokenField] === "string" ? body[tokenField].trim() : "";
        if (incoming) credentials[tokenKey] = incoming;
      }
      capabilities = {
        ...capabilities,
        authorized_api_only: true,
        endpoint_configured: true,
        credential_configured: Object.keys(credentials).length > 0,
        facebook_configured: Boolean(config.facebook_page_id && credentials.facebook_page),
        instagram_configured: Boolean(config.instagram_account_id && credentials.instagram),
        threads_configured: Boolean(config.threads_user_id && credentials.threads),
      };
      const saved = await admin.from("connectors").upsert({ ...(connectorId ? { id: connectorId } : {}), workspace_id: workspaceId, provider: "meta_graph", display_name: "Meta Graph API", state: "disconnected", auth_ref: null, config, capabilities }, { onConflict: "workspace_id,provider" }).select("id").single();
      if (saved.error) return NextResponse.json({ error: "Could not save Meta account configuration." }, { status: 500 });
      connectorId = saved.data.id;
      if (Object.keys(credentials).length) {
        const { error } = await admin.from("connector_credentials").upsert({ connector_id: connectorId, ciphertext: encryptCredential(JSON.stringify(credentials)), updated_at: new Date().toISOString() }, { onConflict: "connector_id" });
        if (error) return NextResponse.json({ error: "Account configuration was saved, but the encrypted token could not be stored." }, { status: 500 });
      }
      await admin.from("audit_logs").insert({ workspace_id: workspaceId, actor_id: user.id, action: "connector.meta_configured", resource_type: "connector", resource_id: connectorId, details: { account_ids: Object.keys(config), token_updated: Boolean(body.facebookPageToken || body.instagramToken || body.threadsToken) } });
      return NextResponse.json({ ok: true, connectorId, capabilities: { ...capabilities, credential_configured: Boolean(Object.keys(credentials).length) } });
    }
    if (!connector) return NextResponse.json({ error: "Add Meta Graph API connector first." }, { status: 404 });
    const { data: stored } = await admin.from("connector_credentials").select("ciphertext").eq("connector_id", connector.id).maybeSingle();
    if (!stored?.ciphertext) return NextResponse.json({ error: "Save at least one authorized Meta account and access token first." }, { status: 409 });
    let credentials: Record<string, string>;
    try { credentials = JSON.parse(decryptCredential(stored.ciphertext)); } catch { return NextResponse.json({ error: "Stored Meta credential cannot be decrypted. Check the server encryption key." }, { status: 500 }); }
    const results = await testMetaCredentials(config, credentials);
    const checks = Object.values(results) as Array<{ ok: boolean; error?: string }>;
    const ok = checks.length > 0 && checks.every(result => result.ok);
    const partial = checks.some(result => result.ok);
    const state = ok ? "connected" : partial ? "degraded" : "disconnected";
    const safeError = checks.find(result => !result.ok)?.error ?? null;
    await admin.from("connectors").update({ state, last_error: safeError, capabilities: { ...capabilities, credential_configured: true } }).eq("id", connector.id).eq("workspace_id", workspaceId);
    await admin.from("audit_logs").insert({ workspace_id: workspaceId, actor_id: user.id, action: "connector.meta_tested", resource_type: "connector", resource_id: connector.id, details: { platforms_checked: Object.keys(results), success: ok } });
    return NextResponse.json({ ok, results });
  }
  if (action === "sync_connector") {
    if (!["owner", "admin"].includes(role)) return NextResponse.json({ error: "Workspace admin access required." }, { status: 403 });
    const connectorId = String(body.connectorId ?? ""), topicId = String(body.topicId ?? "");
    const { data: connector } = await db.from("connectors").select("id,provider,auth_ref,capabilities,config").eq("id", connectorId).eq("workspace_id", workspaceId).maybeSingle();
    const { data: topic } = await db.from("monitoring_topics").select("id,query").eq("id", topicId).eq("workspace_id", workspaceId).eq("is_active", true).maybeSingle();
    if (!connector || !topic) return NextResponse.json({ error: "Choose a connector and active monitoring topic." }, { status: 400 });
    const providerSources = Object.entries({ x_api: ["x"], meta_graph: ["facebook", "instagram", "threads"], tiktok_business: ["tiktok"] }).find(([, providers]) => providers.includes(connector.provider))?.[1] ?? [];
    if (Array.isArray(topic.query?.sources) && !topic.query.sources.some((source: string) => providerSources.includes(source))) return NextResponse.json({ error: "Select this source in the monitoring topic before syncing." }, { status: 409 });
    const admin = createAdminClient();
    if (connector.provider === "meta_graph") {
      const selectedMeta = (topic.query?.sources ?? []).filter((source: string) => providerSources.includes(source));
      const configuredMeta = selectedMeta.some((source: string) => connector.capabilities?.[`${source}_configured`]);
      if (!configuredMeta) return NextResponse.json({ error: "Configure an authorized Meta account for one of the sources selected in this topic before syncing." }, { status: 409 });
      const { data: secure } = await admin.from("connector_credentials").select("connector_id").eq("connector_id", connectorId).maybeSingle();
      if (!secure) return NextResponse.json({ error: "Save authorized Meta account credentials before syncing." }, { status: 409 });
    } else {
      const endpointEnv = ({ x_api: "X_API_SEARCH_URL", tiktok_business: "TIKTOK_BUSINESS_MENTIONS_URL" } as Record<string, string>)[connector.provider];
      if (!endpointEnv || !process.env[endpointEnv] || !process.env[connector.auth_ref ?? ""]) return NextResponse.json({ error: "Configure the official API endpoint and authorized credential in the worker's secure environment first." }, { status: 409 });
    }
    const { error } = await admin.from("worker_jobs").insert({ workspace_id: workspaceId, topic_id: topicId, job_type: "sync_connector", payload: { connector_id: connectorId } });
    if (error) return NextResponse.json({ error: "Could not queue source synchronization." }, { status: 503 });
    return NextResponse.json({ ok: true, status: "queued" }, { status: 202 });
  }
  if (action === "create_alert_rule") {
    const name = String(body.name ?? "").trim();
    const threshold = Number(body.threshold);
    if (name.length < 3 || name.length > 100 || !Number.isFinite(threshold) || threshold < 1) return NextResponse.json({ error: "Enter a rule name and a valid threshold." }, { status: 400 });
    const topicId = typeof body.topicId === "string" ? body.topicId : null;
    const { data, error } = await db.from("alert_rules").insert({ workspace_id: workspaceId, topic_id: topicId, name, rule: { metric: body.metric === "mention_velocity" ? "mention_velocity" : "negative_share", operator: "gte", threshold }, severity: ["info", "watch", "high", "critical"].includes(body.severity) ? body.severity : "watch", created_by: user.id }).select("id,name,rule,severity,is_enabled,created_at").single();
    if (error) return NextResponse.json({ error: "Could not create alert rule." }, { status: 500 });
    return NextResponse.json({ rule: data }, { status: 201 });
  }
  return NextResponse.json({ error: "Unknown workspace action." }, { status: 400 });
}

export async function PATCH(request: NextRequest) {
  const ctx = await context();
  if ("response" in ctx) return ctx.response;
  if (!["owner", "admin", "analyst"].includes(ctx.role)) return NextResponse.json({ error: "Analyst access required." }, { status: 403 });
  const body = await request.json().catch(() => ({}));
  if (body.action === "resolve_alert" && typeof body.id === "string") {
    const { error } = await ctx.db.from("alert_events").update({ status: "resolved", resolved_at: new Date().toISOString() }).eq("id", body.id).eq("workspace_id", ctx.workspaceId);
    if (error) return NextResponse.json({ error: "Could not resolve alert." }, { status: 500 });
    return NextResponse.json({ ok: true });
  }
  if (!(["update_topic", "set_topic_status"].includes(body.action) && typeof body.id === "string")) return NextResponse.json({ error: "Unsupported workspace update." }, { status: 400 });
  const { data: existing, error: existingError } = await ctx.db.from("monitoring_topics").select("id,name,description,query,languages,is_active").eq("id", body.id).eq("workspace_id", ctx.workspaceId).maybeSingle();
  if (existingError || !existing) return NextResponse.json({ error: "Monitoring topic not found." }, { status: 404 });
  const incoming = body.action === "set_topic_status" ? { status: body.status } : body;
  const nextName = body.action === "update_topic" ? String(body.name ?? "").trim() : existing.name;
  const { query, languages, primaryKeywords } = topicQueryFromBody(incoming, existing);
  if (body.action === "update_topic" && (nextName.length < 2 || nextName.length > 100)) return NextResponse.json({ error: "Enter a topic name between 2 and 100 characters." }, { status: 400 });
  if (!primaryKeywords.length) return NextResponse.json({ error: "Add at least one main keyword." }, { status: 400 });
  if (query.starts_on && query.ends_on && query.starts_on > query.ends_on) return NextResponse.json({ error: "The monitoring end date must be the same as or later than its start date." }, { status: 400 });
  const isActive = query.lifecycle === "active";
  const { data: topic, error } = await ctx.db.from("monitoring_topics").update({ name: nextName, description: body.action === "update_topic" ? String(body.description ?? "").trim().slice(0, 500) || null : existing.description, query, languages, is_active: isActive, updated_at: new Date().toISOString() }).eq("id", existing.id).eq("workspace_id", ctx.workspaceId).select("id,name,description,query,languages,is_active,created_at,updated_at").single();
  if (error) return NextResponse.json({ error: "Could not update monitoring topic." }, { status: 500 });
  if (isActive && body.action === "update_topic") await createAdminClient().from("worker_jobs").insert({ workspace_id: ctx.workspaceId, topic_id: topic.id, job_type: "prepare_topic", payload: {} });
  const noSourceConfigured = !query.sources.length || !query.sources.some((sourceId: string) => {
    const source = topicSourceCatalog.find(item => item.id === sourceId);
    return Boolean(source?.provider && source.endpointEnv && source.secretEnv && process.env[source.endpointEnv] && process.env[source.secretEnv]);
  });
  return NextResponse.json({ topic, message: isActive && noSourceConfigured ? "Topic created successfully. Configure at least one data source to begin ingestion." : "Topic updated successfully." });
}
