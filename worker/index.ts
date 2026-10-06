import { createClient } from "@supabase/supabase-js";
import { getConnector } from "./connectors";
import { analyzeConversation, clusterTopic, generateReport } from "./analysis";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("Worker requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const delay = Number(process.env.WORKER_POLL_SECONDS ?? 10) * 1000;

async function processJob(job: any) {
  if(job.job_type==="analyze_conversation") return analyzeConversation(db,job.payload.conversation_id,job.workspace_id);
  if(job.job_type==="cluster_topic") return clusterTopic(db,job.topic_id,job.workspace_id);
  if(job.job_type==="generate_report") return generateReport(db,job.payload.report_id,job.workspace_id);
  if (job.job_type !== "sync_connector") throw new Error(`Unsupported worker job: ${job.job_type}`);
  const [{ data: topic, error: topicError }, { data: connector, error: connectorError }] = await Promise.all([
    db.from("monitoring_topics").select("query").eq("id", job.topic_id).single(),
    db.from("connectors").select("id,provider,auth_ref,state").eq("id", job.payload.connector_id).single(),
  ]);
  if (topicError || !topic) throw topicError ?? new Error("Monitoring topic not found.");
  if (connectorError || !connector) throw connectorError ?? new Error("Connector not found.");
  const secretName = connector.auth_ref || `CONNECTOR_SECRET_${connector.provider.toUpperCase()}`;
  const secret = process.env[secretName];
  if (!secret) throw new Error(`Authorized credentials are not configured for ${connector.provider}.`);
  const adapter = getConnector(connector.provider);
  const records = await adapter.fetchRecent({ workspaceId: job.workspace_id, topicId: job.topic_id, connectorId: connector.id, query: topic.query, secret });
  const propagation: Array<{ childId: string; childAuthor: string; parentExternalId: string; edgeType: string; occurredAt: string }> = [];
  let insertedCount = 0;
  for (const post of records) {
    if (!post.externalId || !post.text || !post.publishedAt) continue;
    const { data: inserted, error } = await db.from("conversations").upsert({ workspace_id: job.workspace_id, topic_id: job.topic_id, connector_id: connector.id, external_id: post.externalId, source: connector.provider, canonical_url: post.canonicalUrl, author_id: post.authorId, author_name: post.authorName, author_handle: post.authorHandle, author_followers: post.followers ?? 0, content: post.text, language: post.language, published_at: post.publishedAt, reach: post.reach ?? 0, engagement: post.engagement ?? 0, parent_external_id: post.parentExternalId ?? null, raw_payload: post.raw ?? {} }, { onConflict: "connector_id,external_id", ignoreDuplicates: true }).select("id").maybeSingle();
    if (error) throw error;
    let savedId = inserted?.id as string | undefined;
    if (!savedId) {
      const { data: existing, error: lookupError } = await db.from("conversations").select("id").eq("connector_id", connector.id).eq("external_id", post.externalId).maybeSingle();
      if (lookupError || !existing) throw lookupError ?? new Error("Existing conversation could not be retrieved.");
      savedId = existing.id;
    } else insertedCount++;
    if(post.authorId) {
      const {error:influencerError}=await db.from("influencer_profiles").upsert({workspace_id:job.workspace_id,source:connector.provider,external_profile_id:post.authorId,display_name:post.authorName,handle:post.authorHandle,profile_url:post.raw?.profile_url,follower_count:post.followers??0,influence_score:Math.min(100,Math.round(Math.log10(Math.max(1,post.followers??0))*14)),last_seen_at:new Date().toISOString(),metadata:{connector:connector.provider}},{onConflict:"workspace_id,source,external_profile_id"});
      if(influencerError) throw influencerError;
    }
    if (post.parentExternalId && post.authorId) propagation.push({ childId: savedId!, childAuthor: post.authorId, parentExternalId: post.parentExternalId, edgeType: post.edgeType || "reshare", occurredAt: post.publishedAt });
    if (inserted) {
      const {error:queueError}=await db.from("worker_jobs").insert({workspace_id:job.workspace_id,topic_id:job.topic_id,job_type:"analyze_conversation",payload:{conversation_id:savedId}});
      if(queueError) throw queueError;
    }
  }
  for (const event of propagation) {
    const { data: parent, error: parentError } = await db.from("conversations").select("author_id").eq("connector_id", connector.id).eq("external_id", event.parentExternalId).maybeSingle();
    if (parentError) throw parentError;
    if (!parent?.author_id || parent.author_id === event.childAuthor) continue;
    const { data: existingEdge, error: edgeLookupError } = await db.from("propagation_edges").select("id").eq("conversation_id", event.childId).eq("from_author_id", parent.author_id).eq("to_author_id", event.childAuthor).eq("edge_type", event.edgeType).limit(1).maybeSingle();
    if (edgeLookupError) throw edgeLookupError;
    if (existingEdge) continue;
    const { error: edgeError } = await db.from("propagation_edges").insert({ workspace_id: job.workspace_id, topic_id: job.topic_id, from_author_id: parent.author_id, to_author_id: event.childAuthor, conversation_id: event.childId, edge_type: event.edgeType, occurred_at: event.occurredAt, weight: 1, metadata: { source: connector.provider, parent_external_id: event.parentExternalId } });
    if (edgeError) throw edgeError;
  }
  if (insertedCount > 0) {
    const {error:clusterError}=await db.from("worker_jobs").insert({workspace_id:job.workspace_id,topic_id:job.topic_id,job_type:"cluster_topic",payload:{}});
    if(clusterError) throw clusterError;
  }
  await db.from("connectors").update({ state: "connected", last_sync_at: new Date().toISOString(), last_error: null }).eq("id", connector.id);
}

async function run() {
  console.info("RIZPRAM Intelligence worker online; official/authorized source adapters only.");
  const heartbeat = async () => {
    const { error } = await db.from("service_heartbeats").upsert({ service_name: "worker", instance_id: process.env.HOSTNAME || "worker", last_seen_at: new Date().toISOString() });
    if (error) console.error("Worker heartbeat failed", error.message);
  };
  await heartbeat();
  const heartbeatTimer = setInterval(() => { void heartbeat(); }, 30_000);
  heartbeatTimer.unref();
  for (;;) {
    try {
      const { data, error } = await db.rpc("claim_worker_job").maybeSingle();
      if (error) throw error;
      const job = data as any;
      if (!job) { await new Promise(resolve => setTimeout(resolve, delay)); continue; }
      try {
        await processJob(job);
        await db.from("worker_jobs").update({ state: "done", locked_at: null, last_error: null }).eq("id", job.id);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if(job.job_type==="generate_report") await db.from("reports").update({status:"failed",content:{error:"Report generation failed. Check worker and provider logs."}}).eq("id",job.payload.report_id).eq("workspace_id",job.workspace_id);
        await db.from("worker_jobs").update({ state: "failed", locked_at: null, last_error: message, available_at: new Date(Date.now() + Math.min(3600, 2 ** Number(job.attempts)) * 1000).toISOString() }).eq("id", job.id);
        console.error(`Job ${job.id} failed: ${message}`);
      }
    } catch (error) {
      console.error("Worker polling error", error);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}
void run();
