"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Activity, AlertTriangle, CheckCircle2, Clock3, Download, Globe2, MessageCircle, Network, Plus, RefreshCw, ShieldCheck, Sparkles } from "lucide-react";
import AiControlCenter from "@/components/ai-control-center";

type Row = Record<string, any>;
const sourceOptions = [{ id: "x_api", name: "X API" }, { id: "meta_graph", name: "Meta Graph API" }, { id: "tiktok_business", name: "TikTok Business API" }];
const resourceFor: Record<string, string> = { Topics: "topics", Connectors: "connectors", Sources: "sources", "Live Monitor": "live", "Conversation Explorer": "explorer", Narratives: "narratives", Entities: "entities", Influencers: "influencers", "Network Graph": "network", Competitors: "competitors", "Crisis Monitor": "alerts", "Alerts & Reports": "alerts", "AI Analyst": "overview", Admin: "admin" };
const emptyText: Record<string, [string, string]> = {
  topics: ["No monitoring topics", "Create a topic with the phrases your authorized source should monitor."],
  connectors: ["No source connected", "Add a connector for an official API, then configure its endpoint and credential on the worker."],
  conversations: ["No indexed conversations", "Configure a topic and authorized source to start collection."],
  narratives: ["No narratives yet", "Narrative clusters appear after the worker analyzes collected conversations."],
  entities: ["No extracted entities", "Entities will appear after conversation analysis."],
  influencers: ["No influencer profiles", "Profiles are calculated from author reach and engagement in source data."],
  network: ["No propagation events", "Propagation edges appear when an authorized connector provides reshare or reply relationships."],
  reports: ["No reports yet", "Generate a report from indexed evidence for an active topic."],
  alerts: ["No alerts", "Configure alert rules or wait for a real source signal."],
};

function stamp(value?: string) { return value ? new Date(value).toLocaleString() : "—"; }
function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) { return <article className={`card module-table ${className}`}>{children}</article>; }
function Head({ title, detail, children }: { title: string; detail: string; children?: React.ReactNode }) { return <div className="module-table-head"><div><h2>{title}</h2><p>{detail}</p></div>{children}</div>; }
function Empty({ type }: { type: string }) { const [title, detail] = emptyText[type] ?? emptyText.conversations; return <div className="empty-module"><MessageCircle size={20}/><b>{title}</b><p>{detail}</p></div>; }

export default function ModuleWorkspace({ active }: { active: string }) {
  const resource = resourceFor[active];
  const [data, setData] = useState<Record<string, any>>({});
  const [topics, setTopics] = useState<Row[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [topicName, setTopicName] = useState("");
  const [topicQuery, setTopicQuery] = useState("");
  const [provider, setProvider] = useState("x_api");
  const [selectedTopic, setSelectedTopic] = useState("");
  const [reportTitle, setReportTitle] = useState("");
  const [alertName, setAlertName] = useState("");
  const [alertThreshold, setAlertThreshold] = useState("10");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<Row | null>(null);
  const [timeline, setTimeline] = useState(100);

  const load = useCallback(async () => {
    if (!resource || resource === "ai") return;
    setError("");
    try {
      const [response, topicResponse] = await Promise.all([
        fetch(`/api/workspace?resource=${resource}&topicId=${encodeURIComponent(selectedTopic)}&limit=100`, { cache: "no-store" }),
        resource === "topics" ? Promise.resolve(null) : fetch("/api/workspace?resource=topics", { cache: "no-store" }),
      ]);
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Could not load workspace data.");
      setData(payload);
      if (topicResponse) { const t = await topicResponse.json(); if (topicResponse.ok) setTopics(t.topics ?? []); }
    } catch (e) { setError(e instanceof Error ? e.message : "Could not load workspace data."); }
  }, [resource, selectedTopic]);
  useEffect(() => { void load(); }, [load]);

  async function mutate(body: Row, url = "/api/workspace", method = "POST") {
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Action failed.");
      setNotice(payload.status === "queued" ? "Source sync queued for the worker." : "Saved successfully.");
      await load();
      return payload;
    } catch (e) { setError(e instanceof Error ? e.message : "Action failed."); return null; }
    finally { setBusy(false); }
  }
  async function createReport() {
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/reports", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: reportTitle || "Monitoring intelligence brief", topic_id: selectedTopic || undefined, format: "json" }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Could not queue report.");
      setReportTitle(""); setNotice("Report queued. It will appear here when the worker finishes."); await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Could not queue report."); }
    finally { setBusy(false); }
  }
  async function ask() {
    setBusy(true); setError(""); setAnswer(null);
    try { const response = await fetch("/api/ask", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question, topic_id: selectedTopic || undefined }) }); const payload = await response.json(); if (!response.ok) throw new Error(payload.error ?? "AI Analyst is unavailable."); setAnswer(payload); }
    catch (e) { setError(e instanceof Error ? e.message : "AI Analyst is unavailable."); }
    finally { setBusy(false); }
  }

  if (active === "AI Control Center") return <AiControlCenter/>;
  if (!resource) return <Card><Head title={active} detail="Workspace module"/><Empty type="conversations"/></Card>;
  const rows: Row[] = resource === "topics" ? data.topics ?? [] : resource === "connectors" || resource === "sources" ? data.connectors ?? [] : resource === "live" || resource === "explorer" ? data.conversations ?? [] : resource === "narratives" ? data.narratives ?? [] : resource === "entities" ? data.entities ?? [] : resource === "influencers" ? data.influencers ?? [] : resource === "network" ? data.edges ?? [] : resource === "competitors" ? data.comparisons ?? [] : [];
  const visibleEdges = resource === "network" ? rows.slice(0, Math.max(1, Math.ceil(rows.length * timeline / 100))) : rows;

  return <section className="module-workspace">
    {error && <div className="ai-control-message error" role="alert">{error}</div>}{notice && <div className="ai-control-message" role="status">{notice}</div>}
    {resource !== "topics" && resource !== "connectors" && resource !== "sources" && topics.length > 0 && <label className="module-filter">Monitoring topic<select value={selectedTopic} onChange={event => setSelectedTopic(event.target.value)}><option value="">All active topics</option>{topics.map(topic => <option key={topic.id} value={topic.id}>{topic.name}</option>)}</select></label>}
    {resource === "topics" && <Card><Head title="Monitoring topics" detail="Define phrases and filters to scope collection from authorized sources."/><form className="module-form" onSubmit={event => { event.preventDefault(); void mutate({ action: "create_topic", name: topicName, query: topicQuery }).then(result => { if (result) { setTopicName(""); setTopicQuery(""); } }); }}><label>Topic name<input value={topicName} onChange={e => setTopicName(e.target.value)} placeholder="Brand, campaign, or issue" required maxLength={100}/></label><label>Search query<input value={topicQuery} onChange={e => setTopicQuery(e.target.value)} placeholder='e.g. "RIZPRAM" OR #RIZPRAM' required maxLength={1000}/></label><button className="button-primary" disabled={busy}><Plus size={14}/> Create topic</button></form><div className="module-record-list">{rows.length ? rows.map(row => <div className="module-record" key={row.id}><div><b>{row.name}</b><p>{row.query?.text ?? row.description ?? "No query set"}</p></div><span className={`state-pill ${row.is_active ? "healthy" : "idle"}`}>{row.is_active ? "Active" : "Paused"}</span></div>) : <Empty type="topics"/>}</div></Card>}

    {(resource === "connectors" || resource === "sources") && <Card><Head title="Authorized source connectors" detail="Use official APIs or authorized providers. Credentials stay in the server environment."/><div className="module-form"><label>Source provider<select value={provider} onChange={e => setProvider(e.target.value)}>{sourceOptions.map(item => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label><button className="button-primary" disabled={busy} onClick={() => void mutate({ action: "create_connector", provider })}><Plus size={14}/> Add connector</button></div><div className="module-record-list">{rows.length ? rows.map(row => <div className="module-record connector-record" key={row.id}><div><b>{row.display_name}</b><p>{row.provider} · {row.capabilities?.endpoint_configured ? "API endpoint set" : "Endpoint needs setup"} · {row.capabilities?.credential_configured ? "Credential set" : "Credential needs setup"}</p><small>Last sync: {stamp(row.last_sync_at)}{row.last_error ? ` · ${row.last_error}` : ""}</small></div><span className={`state-pill ${row.state === "connected" ? "healthy" : "idle"}`}>{row.state}</span><button className="button-secondary" disabled={busy || !topics.length} onClick={() => { const id = selectedTopic || topics[0]?.id; if (id) void mutate({ action: "sync_connector", connectorId: row.id, topicId: id }); }}><RefreshCw size={13}/> Sync</button></div>) : <Empty type="connectors"/>}</div><p className="synthetic-note"><ShieldCheck size={13}/> No sample or demo conversations are inserted. Connector credentials must be placed in the worker's protected environment.</p></Card>}

    {(resource === "live" || resource === "explorer") && <Card><Head title={active === "Live Monitor" ? "Latest conversations" : "Conversation Explorer"} detail={`${rows.length} most recent source records · refreshed on page load`}><button className="button-secondary" onClick={() => void load()}><RefreshCw size={13}/> Refresh</button></Head>{rows.length ? <div className="module-record-list">{rows.map(row => <div className="conversation-record" key={row.id}><div className="conversation-meta"><b>{row.author_name || row.author_handle || "Unknown author"}</b><span>{row.source} · {stamp(row.published_at)}</span></div><p>{row.content}</p><div className="conversation-meta"><span>{row.conversation_analyses?.[0]?.sentiment ?? row.conversation_analyses?.sentiment ?? "Analysis pending"} · {row.conversation_analyses?.[0]?.stance ?? row.conversation_analyses?.stance ?? "stance pending"}</span><span>{Number(row.engagement ?? 0).toLocaleString()} engagement · {Number(row.reach ?? 0).toLocaleString()} reach</span></div>{row.canonical_url && <a href={row.canonical_url} target="_blank" rel="noreferrer">Open source ↗</a>}</div>)}</div> : <Empty type="conversations"/>}</Card>}

    {resource === "narratives" && <Card><Head title="Narrative clusters" detail="Cluster summaries, share, acceleration and risk from analyzed records."/>{rows.length ? <div className="module-record-list">{rows.map(row => <div className="module-record" key={row.id}><div><b>{row.title}</b><p>{row.summary}</p><small>{(row.keywords ?? []).join(" · ")}</small></div><span>{row.post_count} posts<br/>{Number(row.share).toFixed(1)}% share</span><span className={Number(row.risk_score) >= 70 ? "risk-high" : ""}>Risk {Number(row.risk_score).toFixed(0)}<br/>Velocity {Number(row.velocity).toFixed(1)}</span></div>)}</div> : <Empty type="narratives"/>}</Card>}

    {resource === "entities" && <Card><Head title="Extracted entities" detail="Canonical entities extracted from authorized conversation text."/>{rows.length ? <div className="module-record-list">{rows.map(row => <div className="module-record" key={row.id}><div><b>{row.canonical_name}</b><p>{row.entity_type}</p></div><span>{(row.aliases ?? []).join(", ")}</span></div>)}</div> : <Empty type="entities"/>}</Card>}

    {resource === "influencers" && <Card><Head title="Influencer analysis" detail="Ranked from source-provided follower counts and observed engagement."/>{rows.length ? <div className="module-record-list">{rows.map(row => <div className="module-record" key={row.id}><div><b>{row.display_name || row.handle || row.external_profile_id}</b><p>{row.source} · {row.handle ? `@${row.handle}` : ""}</p></div><span>{Number(row.follower_count).toLocaleString()} followers</span><b>Influence {Number(row.influence_score).toFixed(0)}/100</b>{row.profile_url && <a href={row.profile_url} target="_blank" rel="noreferrer">Profile ↗</a>}</div>)}</div> : <Empty type="influencers"/>}</Card>}

    {resource === "network" && <Card><Head title="Propagation network & playback" detail={`${rows.length} verified propagation events. Move the control to replay events by time.`}/>{rows.length ? <><label className="timeline-control">Timeline playback<input type="range" min="1" max="100" value={timeline} onChange={e => setTimeline(Number(e.target.value))}/><span>{visibleEdges.length} / {rows.length} events</span></label><div className="module-record-list">{visibleEdges.map(row => <div className="module-record" key={row.id}><span>{row.from_author_id}</span><span>→ {row.edge_type} →</span><b>{row.to_author_id}</b><small>{stamp(row.occurred_at)} · weight {row.weight}</small></div>)}</div></> : <Empty type="network"/>}</Card>}

    {resource === "competitors" && <Card><Head title="Topic comparison" detail="Share of voice over the last seven days, based on each active monitoring topic."/>{rows.length ? <div className="module-record-list">{rows.map(row => <div className="module-record" key={row.id}><div><b>{row.name}</b><p>{row.is_active ? "Monitoring" : "Paused"}</p></div><span>{row.mentions} mentions</span><div className="share-meter"><i style={{ width: `${Math.min(100, row.shareOfVoice)}%` }}/></div><b>{row.shareOfVoice}% SOV</b></div>)}</div> : <Empty type="topics"/>}</Card>}

    {resource === "alerts" && active === "Crisis Monitor" && <Card><Head title="Crisis monitor" detail="High-impact alert events generated from measured source evidence."/>{(data.events ?? []).filter((row: Row) => ["high", "critical"].includes(row.severity)).length ? <div className="module-record-list">{data.events.filter((row: Row) => ["high", "critical"].includes(row.severity)).map((row: Row) => <div className="module-record" key={row.id}><AlertTriangle size={17}/><div><b>{row.title}</b><p>{row.summary}</p></div><b className="risk-high">{row.severity}</b><small>{stamp(row.triggered_at)}</small></div>)}</div> : <Empty type="alerts"/>}</Card>}

    {resource === "alerts" && active === "Alerts & Reports" && <div className="report-grid"><Card><Head title="Generate intelligence report" detail="Reports cite conversation evidence and run in the background."/><div className="module-form"><label>Report title<input value={reportTitle} onChange={e => setReportTitle(e.target.value)} placeholder="Weekly monitoring brief"/></label><button className="button-primary" disabled={busy || !topics.length} onClick={() => void createReport()}><Download size={14}/> Generate report</button></div><div className="module-record-list">{(data.reports ?? []).length ? data.reports.map((row: Row) => <details className="module-record report-row" key={row.id}><summary><b>{row.title}</b><span className={`state-pill ${row.status === "ready" ? "healthy" : "idle"}`}>{row.status}</span><small>{stamp(row.created_at)}</small></summary>{row.content?.executive_summary && <p>{row.content.executive_summary}</p>}{row.content?.findings?.map((finding: Row, i: number) => <p key={i}><b>{finding.title}.</b> {finding.detail} <small>Sources: {(finding.source_ids ?? []).join(", ")}</small></p>)}{row.status === "failed" && <p>Worker could not complete this report. Confirm a provider and worker are available.</p>}</details>) : <Empty type="reports"/>}</div></Card><Card><Head title="Alert rules" detail="Rules are saved per workspace."/><form className="module-form" onSubmit={event => { event.preventDefault(); void mutate({ action: "create_alert_rule", name: alertName, threshold: Number(alertThreshold), metric: "mention_velocity", topicId: selectedTopic || undefined }).then(result => { if (result) setAlertName(""); }); }}><label>Rule name<input value={alertName} onChange={e => setAlertName(e.target.value)} placeholder="Mention velocity threshold" required/></label><label>Mentions threshold<input type="number" min="1" value={alertThreshold} onChange={e => setAlertThreshold(e.target.value)}/></label><button className="button-secondary" disabled={busy}><Plus size={13}/> Add rule</button></form>{(data.rules ?? []).map((row: Row) => <div className="module-record" key={row.id}><div><b>{row.name}</b><p>{row.rule?.metric} ≥ {row.rule?.threshold}</p></div><span>{row.severity}</span></div>)}<h3>Recent alerts</h3>{(data.events ?? []).filter((row: Row) => row.status === "open").map((row: Row) => <div className="module-record" key={row.id}><div><b>{row.title}</b><p>{row.summary}</p></div><span>{row.severity}</span><button className="button-secondary" onClick={() => void mutate({ action: "resolve_alert", id: row.id }, "/api/workspace", "PATCH")}>Resolve</button></div>)}</Card></div>}

    {resource === "admin" && <div className="admin-grid"><Card><Head title="Workspace members" detail="Roles currently assigned to this workspace."/>{(data.members ?? []).map((row: Row) => <div className="module-record" key={row.user_id}><div><b>{row.email}</b><p>Added {stamp(row.created_at)}</p></div><span className="state-pill">{row.role}</span></div>)}</Card><Card><Head title="Audit activity" detail="Recent administrative and routing changes."/>{(data.audit ?? []).length ? data.audit.map((row: Row) => <div className="module-record" key={row.id}><div><b>{row.action}</b><p>{row.resource_type} {row.resource_id ?? ""}</p></div><small>{stamp(row.created_at)}</small></div>) : <div className="empty-module"><Clock3 size={18}/><b>No audit events yet</b></div>}</Card></div>}

    {active === "AI Analyst" && <Card className="analyst-page"><div className="analyst-icon"><Sparkles size={18}/></div><Head title="Evidence-grounded AI Analyst" detail="Answers are limited to source records in your active topic and cite supporting records."/><label className="analyst-input">Ask a question<textarea value={question} onChange={e => setQuestion(e.target.value)} placeholder="What changed in the last 24 hours?" maxLength={1000}/></label><button className="button-primary" disabled={busy || question.trim().length < 3} onClick={() => void ask()}>{busy ? "Analyzing…" : "Ask AI Analyst"}</button>{answer && <div className="analyst-answer"><p>{answer.answer}</p><small>Confidence {Math.round(Number(answer.confidence ?? 0) * 100)}% · {answer.provider} / {answer.model}</small><div>{(answer.citations ?? []).map((citation: Row) => <a key={citation.id} href={citation.url || undefined} target="_blank" rel="noreferrer">[{citation.id}] {citation.source} ↗</a>)}</div></div>}<p className="synthetic-note"><ShieldCheck size={13}/> The analyst will report when no real evidence or AI provider is available.</p></Card>}
  </section>;
}
