"use client";

import { Activity, AlertTriangle, CheckCircle2, Clock3, Download, Globe2, MessageCircle, Network, ShieldCheck, Sparkles } from "lucide-react";
import AiControlCenter from "@/components/ai-control-center";

export default function ModuleWorkspace({ active }: { active: string }) {
  if (active === "AI Control Center") return <AiControlCenter/>;

  if (active === "Connectors" || active === "Sources") return <section className="module-workspace"><div className="connector-grid">{["X API","Meta Graph API","TikTok Business API","Authorized news provider"].map((name,i)=><article className="card connector-card" key={name}><div className="connector-logo">{["𝕏","◎","♪","N"][i]}</div><div className="connector-title"><b>{name}</b><small>Official / authorized API</small></div><span className="connector-state"><i/> Disconnected</span><p>Connect an account that is authorized to access this provider. No source is currently connected.</p></article>)}</div><p className="synthetic-note"><ShieldCheck size={13}/> No example posts or sample metrics are stored in this workspace.</p></section>;

  if (active === "Topics") return <section className="module-workspace"><div className="card module-table"><div className="module-table-head"><div><h2>Monitoring topics</h2><p>Topic lists will populate from your workspace database.</p></div></div><div className="empty-module"><Globe2 size={20}/><b>No monitoring topics</b><p>Connect a provider and create a topic before collecting conversations.</p></div></div></section>;

  if (active === "Network Graph") return <section className="module-workspace"><div className="card graph-card"><div className="module-table-head"><div><h2>Propagation network</h2><p>Account links and timeline playback require source records.</p></div></div><div className="empty-module"><Network size={20}/><b>No propagation data</b><p>The graph will be built from verified conversation and reshare events.</p></div></div></section>;

  if (active === "Alerts & Reports") return <section className="module-workspace report-grid"><div className="card report-card"><div className="module-table-head"><div><h2>Generate intelligence report</h2><p>Reports require an active topic and indexed source evidence.</p></div><Download size={17}/></div><div className="empty-module"><Download size={20}/><b>No reports yet</b><p>Configure an authorized source and monitoring topic before generating an evidence-backed report.</p></div></div><div className="card audit-card"><h2>Alert rules</h2><p>Configure thresholds once real topic data is available.</p><div className="empty-module"><AlertTriangle size={18}/><b>No alert rules</b></div></div></section>;

  if (active === "Crisis Monitor") return <section className="module-workspace"><div className="card module-table"><div className="module-table-head"><div><h2>Crisis monitor</h2><p>Risk signals are calculated from recent source evidence.</p></div></div><div className="empty-module"><ShieldCheck size={20}/><b>No crisis signals</b><p>There are no indexed conversations to evaluate.</p></div></div></section>;

  if (active === "AI Analyst") return <section className="module-workspace"><div className="card analyst-page"><div className="analyst-icon"><Sparkles size={18}/></div><h2>Evidence-grounded analysis</h2><p>Answers use retrieved conversation records from your active monitoring topic. No sample or synthetic evidence is available.</p><div className="grounding-steps"><span>1 <b>Connect an authorized source</b></span><Activity size={15}/><span>2 <b>Index conversations</b></span><Activity size={15}/><span>3 <b>Ask about evidence</b></span></div></div></section>;

  if (active === "Admin") return <section className="module-workspace admin-grid"><div className="card module-table"><div className="module-table-head"><div><h2>Workspace members</h2><p>Workspace memberships will appear here.</p></div></div><div className="empty-module"><ShieldCheck size={20}/><b>No members listed</b><p>Add an owner account to manage roles and invitations.</p></div></div><div className="card audit-card"><h2>Audit activity</h2><p>Administrative actions recorded for this workspace.</p><div className="empty-module"><Clock3 size={18}/><b>No audit events</b></div></div></section>;

  if (active === "Settings") return <section className="module-workspace"><div className="card report-card"><div className="module-table-head"><div><h2>Workspace settings</h2><p>Application and database configuration.</p></div></div><div className="settings-check"><CheckCircle2 size={15}/> Dedicated web service <b>Configured</b></div><div className="settings-check"><CheckCircle2 size={15}/> Isolated application database <b>Configured</b></div><small>Provider credentials are stored server-side and never returned to the browser.</small></div></section>;

  const title = active === "Live Monitor" ? "Live monitor" : active === "Conversation Explorer" ? "Conversation explorer" : active;
  return <section className="module-workspace"><div className="card module-table"><div className="module-table-head"><div><h2>{title}</h2><p>Results appear after authorized source data is ingested.</p></div></div><div className="empty-module"><MessageCircle size={20}/><b>No indexed conversations</b><p>Connect a provider and create a monitoring topic to populate this view.</p></div></div></section>;
}
