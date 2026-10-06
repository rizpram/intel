"use client";

import { useCallback, useEffect, useState } from "react";
import { Activity, AlertTriangle, Bell, Bot, BriefcaseBusiness, ChevronDown, ChevronLeft, ChevronRight, CircleHelp, Command, GitFork, Globe2, Hash, LayoutDashboard, LifeBuoy, MessageCircle, Network, Plus, Search, Settings2, ShieldCheck, Sparkles, Users } from "lucide-react";
import ModuleWorkspace from "@/components/module-workspace";

const nav = [
  { group: "WORKSPACE", items: [["Command Center", LayoutDashboard], ["Topics", Hash], ["Live Monitor", Activity], ["Conversation Explorer", MessageCircle]] },
  { group: "INTELLIGENCE", items: [["Narratives", GitFork], ["Entities", Users], ["Influencers", Users], ["Network Graph", Network], ["Competitors", BriefcaseBusiness], ["Sources", Globe2], ["Crisis Monitor", AlertTriangle]] },
  { group: "OPERATIONS", items: [["Alerts & Reports", Bell], ["AI Analyst", Bot], ["AI Control Center", Settings2], ["Connectors", Command], ["Admin", ShieldCheck]] },
];

const pageHints: Record<string, string> = {
  Topics: "Monitoring scope, query rules, and priority tracking.",
  "Live Monitor": "A real-time stream from your connected, authorized sources.",
  "Conversation Explorer": "Search and inspect conversations collected for your workspace.",
  Narratives: "Story clusters derived from monitored conversations.",
  Entities: "People, brands, products, and places found in your data.",
  Influencers: "Authors ranked from measured reach and engagement.",
  "Network Graph": "How verified stories travel between accounts and communities.",
  Competitors: "Share of voice across the brands you monitor.",
  Sources: "Coverage and contribution by connected source.",
  "Alerts & Reports": "Evidence-backed briefings and threshold-based alerts.",
  "AI Analyst": "Ask questions about indexed workspace evidence.",
  "AI Control Center": "Configure AI providers, models, and task routing.",
  Connectors: "Manage authorized source-provider connections.",
};

export default function IntelligenceApp() {
  const [active, setActive] = useState("Command Center");
  const [showAlerts, setShowAlerts] = useState(false);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [dashboard, setDashboard] = useState<Record<string, any>>({});
  const [selectedTopic, setSelectedTopic] = useState("");
  const [busy, setBusy] = useState(false);
  const isHome = active === "Command Center";

  const loadDashboard = useCallback(async () => {
    try {
      const response = await fetch(`/api/workspace?resource=overview&topicId=${encodeURIComponent(selectedTopic)}`, { cache: "no-store" });
      if (!response.ok) return;
      setDashboard(await response.json());
    } catch { /* The public temporary dashboard keeps data APIs protected until sign-in. */ }
  }, [selectedTopic]);
  useEffect(() => { void loadDashboard(); }, [loadDashboard]);

  async function askAnalyst() {
    if (!question.trim()) return;
    setBusy(true);
    try {
      const response = await fetch("/api/ask", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question, topic_id: selectedTopic || undefined }) });
      const data = await response.json();
      setAnswer(data.answer || data.error || "No response.");
    } catch {
      setAnswer("The analyst service is not reachable right now.");
    } finally {
      setBusy(false);
    }
  }

  return <div className="shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark"><span>R</span></div><div><b>RIZPRAM</b><small>INTELLIGENCE</small></div><button className="icon-button sidebar-collapse" aria-label="Collapse navigation"><ChevronLeft size={15}/></button></div>
      <div className="workspace-switch"><div className="workspace-avatar">R</div><div className="workspace-label"><b>Workspace</b><small>Intelligence platform</small></div><ChevronDown size={14}/></div>
      <button className="topic-select" onClick={() => setActive("Topics")}><span className="live-dot"/><span><small>MONITORING TOPIC</small><b>{dashboard.topics?.find((topic: any) => topic.id === selectedTopic)?.name ?? dashboard.topics?.[0]?.name ?? "No topic selected"}</b></span><ChevronDown size={14}/></button>
      <nav>{nav.map(section => <section key={section.group}><div className="nav-group">{section.group}</div>{section.items.map(([label, Icon]) => <button key={label as string} onClick={() => setActive(label as string)} className={`nav-item ${active === label ? "active" : ""}`}><Icon size={17}/><span>{label as string}</span></button>)}</section>)}</nav>
      <div className="sidebar-bottom"><button className={`nav-item ${active === "Settings" ? "active" : ""}`} onClick={() => setActive("Settings")}><Settings2 size={17}/><span>Settings</span></button><button className="nav-item"><CircleHelp size={17}/><span>Help center</span></button><div className="profile"><div className="profile-pic">R</div><div><b>Workspace</b><small>Intelligence user</small></div></div></div>
    </aside>
    <main className="main-area">
      <header className="topbar"><div className="crumb"><span>Workspace</span><ChevronRight size={14}/><b>{active}</b></div><div className="top-actions">{dashboard.topics?.length > 0 && <select className="dashboard-topic-select" value={selectedTopic} onChange={event => setSelectedTopic(event.target.value)} aria-label="Select monitoring topic"><option value="">All topics</option>{dashboard.topics.map((topic: any) => <option key={topic.id} value={topic.id}>{topic.name}</option>)}</select>}<div className="env-pill"><span className="green-pip"/> Workspace</div><button className="icon-button" aria-label="Search"><Search size={18}/></button><button className="icon-button alert-trigger" onClick={() => setShowAlerts(!showAlerts)} aria-label="Alerts"><Bell size={18}/></button></div>
        {showAlerts && <div className="alerts-popover"><strong>Alerts</strong><p>No alerts yet. Alerts will appear when connected data matches a rule.</p><button onClick={() => {setActive("Alerts & Reports");setShowAlerts(false)}}>Open alert center <ChevronRight size={13}/></button></div>}
      </header>
      <div className="content">
        <div className="page-heading"><div><div className="eyebrow"><span className="live-dot"/> WORKSPACE READY · AWAITING SOURCE DATA</div><h1>{isHome ? "Command Center" : active}</h1><p>{isHome ? "Connect an authorized source to start monitoring real conversations." : pageHints[active] ?? "Workspace preferences, permissions, and audit history."}</p></div><div className="heading-actions"><button className="button-secondary" onClick={() => setActive("Connectors")}><Globe2 size={15}/> Connect a source</button><button className="button-primary" onClick={() => setActive("Topics")}><Plus size={16}/> Monitoring topics</button></div></div>
        {isHome ? <>
          <section className="kpi-grid"><article className="card kpi-card"><div className="kpi-top"><span>Total mentions</span><i className="kpi-icon purple"><MessageCircle size={16}/></i></div><div className="kpi-value">{Number(dashboard.conversations?.length ?? 0).toLocaleString()}</div><div className="kpi-bottom"><small>Latest indexed records</small></div></article><article className="card kpi-card"><div className="kpi-top"><span>Potential reach</span><i className="kpi-icon blue"><Users size={16}/></i></div><div className="kpi-value">{Number((dashboard.conversations ?? []).reduce((sum: number, row: any) => sum + Number(row.reach ?? 0), 0)).toLocaleString()}</div><div className="kpi-bottom"><small>From authorized source metrics</small></div></article><article className="card kpi-card"><div className="kpi-top"><span>Sentiment</span><i className="kpi-icon green"><Activity size={16}/></i></div><div className="kpi-value">{dashboard.analyzedCount ? `${Math.round((dashboard.sentiment?.positive ?? 0) / dashboard.analyzedCount * 100)}%` : "—"}</div><div className="kpi-bottom"><small>{dashboard.analyzedCount ? `${dashboard.sentiment?.negative ?? 0} negative · ${dashboard.sentiment?.positive ?? 0} positive` : "Requires analyzed conversations"}</small></div></article><article className="card kpi-card"><div className="kpi-top"><span>Narratives</span><i className="kpi-icon amber"><GitFork size={16}/></i></div><div className="kpi-value">{Number(dashboard.narratives?.length ?? 0).toLocaleString()}</div><div className="kpi-bottom"><small>Recent detected clusters</small></div></article></section>
          <section className="overview-grid"><div className="card volume-card"><div className="card-header"><div><h2>Conversation volume</h2><p>Hourly volume and sentiment from the selected topic.</p></div><button className="text-link" onClick={() => void loadDashboard()}><Activity size={13}/> Refresh</button></div>{dashboard.metrics?.length ? <div className="dashboard-bars" aria-label="Hourly conversation volume">{dashboard.metrics.map((item: any) => <div key={item.bucket_at} title={`${new Date(item.bucket_at).toLocaleString()}: ${item.mention_count} mentions`}><i style={{ height: `${Math.max(4, Math.min(100, Number(item.mention_count) / Math.max(...dashboard.metrics.map((row: any) => Number(row.mention_count)), 1) * 100))}%` }}/></div>)}</div> : <div className="empty-module"><Activity size={20}/><b>No conversations yet</b><p>Connect an authorized source and create a monitoring topic to begin.</p><button className="button-primary" onClick={() => setActive("Connectors")}><Globe2 size={14}/> Open connectors</button></div>}</div>
            <div className="card sentiment-card"><div className="card-header"><div><h2>Sentiment & emotion</h2><p>Observed labels from analyzed conversations.</p></div></div>{dashboard.analyzedCount ? <div className="dashboard-sentiments">{Object.entries(dashboard.sentiment ?? {}).map(([label, count]) => <div key={label}><span>{label}</span><b>{Number(count).toLocaleString()}</b></div>)}</div> : <div className="empty-module"><Sparkles size={20}/><b>Analysis is waiting for source data</b><p>No synthetic sentiment or emotion values are shown.</p></div>}</div>
            <div className="card narratives-card"><div className="card-header"><div><h2>Emerging narratives</h2><p>Story clusters generated from monitored posts.</p></div><button className="text-link" onClick={() => setActive("Narratives")}>View narratives <ChevronRight size={14}/></button></div>{dashboard.narratives?.length ? dashboard.narratives.slice(0,4).map((row: any) => <div className="dashboard-item" key={row.id}><b>{row.title}</b><span>{row.post_count} posts · risk {row.risk_score}</span></div>) : <div className="empty-module"><GitFork size={20}/><b>No narratives yet</b><p>Narratives will appear after real conversations are collected.</p></div>}</div>
            <div className="card alerts-card"><div className="card-header"><div><h2>Attention needed</h2><p>Evidence-based alerts for your topics.</p></div></div>{dashboard.alerts?.length ? dashboard.alerts.slice(0,4).map((row: any) => <div className="dashboard-item" key={row.id}><b>{row.title}</b><span>{row.severity} · {row.status}</span></div>) : <div className="empty-module"><ShieldCheck size={20}/><b>No active alerts</b><p>Alerts will show when a configured rule matches real data.</p></div>}</div>
            <div className="card conversation-card"><div className="card-header"><div><h2>Live conversation</h2><p>Authorized source records for the selected topic.</p><button className="text-link" onClick={() => setActive("Conversation Explorer")}>Open explorer <ChevronRight size={14}/></button></div></div>{dashboard.conversations?.length ? dashboard.conversations.slice(0,3).map((row: any) => <div className="dashboard-conversation" key={row.id}><b>{row.author_name || row.source}</b><span>{row.source} · {new Date(row.published_at).toLocaleString()}</span><p>{row.content}</p></div>) : <div className="empty-module"><MessageCircle size={20}/><b>No conversations indexed</b><p>Connect a source provider to begin ingestion.</p></div>}</div>
            <div className="card analyst-card"><div className="card-header"><div><h2>Ask AI Analyst</h2><p>Answers will be grounded in your workspace data.</p></div><Bot size={18}/></div><div className="empty-module"><Sparkles size={20}/><b>Waiting for evidence</b><p>Add an authorized source and index conversations before asking questions.</p><textarea value={question} onChange={e=>setQuestion(e.target.value)} placeholder="Ask about your monitored conversations"/><button className="button-primary" disabled={busy||!question.trim()} onClick={askAnalyst}>{busy?"Thinking…":"Ask analyst"}</button>{answer&&<p role="status">{answer}</p>}</div></div>
          </section>
        </> : <><section className="module-banner"><div className="module-icon"><Sparkles size={19}/></div><div><b>{active} workspace</b><p>{pageHints[active] ?? "Workspace security, roles, and configuration."}</p></div></section><ModuleWorkspace active={active}/></>}
        <footer className="page-footer"><span>RIZPRAM INTELLIGENCE <b>·</b> v1.0.0</span><span>Waiting for authorized source data</span></footer>
      </div>
    </main>
  </div>;
}
