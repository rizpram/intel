import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

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
    return NextResponse.json({ topics: data ?? [] });
  }
  if (resource === "connectors" || resource === "sources") {
    const { data, error } = await scoped(db.from("connectors").select("id,provider,display_name,state,capabilities,last_sync_at,last_error,config,created_at")).order("display_name");
    if (error) return NextResponse.json({ error: "Could not load connectors." }, { status: 500 });
    return NextResponse.json({ connectors: data ?? [] });
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
    const queryText = String(body.query ?? "").trim();
    if (name.length < 2 || name.length > 100 || queryText.length < 2 || queryText.length > 1000) return NextResponse.json({ error: "Enter a topic name and search query." }, { status: 400 });
    const { data, error } = await db.from("monitoring_topics").insert({ workspace_id: workspaceId, name, description: String(body.description ?? "").slice(0, 500) || null, query: { text: queryText }, languages: ["id", "en"], created_by: user.id }).select("id,name,description,query,languages,is_active,created_at").single();
    if (error) return NextResponse.json({ error: "Could not create monitoring topic." }, { status: 500 });
    return NextResponse.json({ topic: data }, { status: 201 });
  }
  if (action === "create_connector") {
    if (!["owner", "admin"].includes(role)) return NextResponse.json({ error: "Workspace admin access required." }, { status: 403 });
    const providers: Record<string, { name: string; endpointEnv: string }> = { x_api: { name: "X API", endpointEnv: "X_API_SEARCH_URL" }, meta_graph: { name: "Meta Graph API", endpointEnv: "META_GRAPH_MENTIONS_URL" }, tiktok_business: { name: "TikTok Business API", endpointEnv: "TIKTOK_BUSINESS_MENTIONS_URL" } };
    const provider = String(body.provider ?? "");
    const option = providers[provider];
    if (!option) return NextResponse.json({ error: "Select a supported official API connector." }, { status: 400 });
    const { data, error } = await db.from("connectors").upsert({ workspace_id: workspaceId, provider, display_name: option.name, state: "disconnected", auth_ref: `CONNECTOR_SECRET_${provider.toUpperCase()}`, capabilities: { endpoint_configured: Boolean(process.env[option.endpointEnv]), credential_configured: Boolean(process.env[`CONNECTOR_SECRET_${provider.toUpperCase()}`]), authorized_api_only: true } }, { onConflict: "workspace_id,provider" }).select("id,provider,display_name,state,capabilities,last_sync_at,last_error").single();
    if (error) return NextResponse.json({ error: "Could not save connector configuration." }, { status: 500 });
    return NextResponse.json({ connector: data }, { status: 201 });
  }
  if (action === "sync_connector") {
    if (!["owner", "admin"].includes(role)) return NextResponse.json({ error: "Workspace admin access required." }, { status: 403 });
    const connectorId = String(body.connectorId ?? ""), topicId = String(body.topicId ?? "");
    const { data: connector } = await db.from("connectors").select("id,provider,auth_ref,capabilities").eq("id", connectorId).eq("workspace_id", workspaceId).maybeSingle();
    const { data: topic } = await db.from("monitoring_topics").select("id").eq("id", topicId).eq("workspace_id", workspaceId).eq("is_active", true).maybeSingle();
    if (!connector || !topic) return NextResponse.json({ error: "Choose a connector and active monitoring topic." }, { status: 400 });
    const endpointEnv = ({ x_api: "X_API_SEARCH_URL", meta_graph: "META_GRAPH_MENTIONS_URL", tiktok_business: "TIKTOK_BUSINESS_MENTIONS_URL" } as Record<string, string>)[connector.provider];
    if (!endpointEnv || !process.env[endpointEnv] || !process.env[connector.auth_ref ?? ""]) return NextResponse.json({ error: "Configure the official API endpoint and authorized credential in the worker's secure environment first." }, { status: 409 });
    const admin = createAdminClient();
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
  if (body.action !== "resolve_alert" || typeof body.id !== "string") return NextResponse.json({ error: "Unsupported workspace update." }, { status: 400 });
  const { error } = await ctx.db.from("alert_events").update({ status: "resolved", resolved_at: new Date().toISOString() }).eq("id", body.id).eq("workspace_id", ctx.workspaceId);
  if (error) return NextResponse.json({ error: "Could not resolve alert." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
