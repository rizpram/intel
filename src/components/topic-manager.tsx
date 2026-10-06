"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Archive, CalendarDays, Check, Clock3, Copy, Globe2, Hash, LoaderCircle, MessageCircle, Pause, Play, Plus, RefreshCw, Sparkles, SquarePen } from "lucide-react";

type Source = { id: string; name: string; configured: boolean; configurationLabel: string };
type Topic = { id: string; name: string; description: string | null; query: Record<string, any>; languages: string[]; is_active: boolean; created_at: string; mentionCount: number; lastIngestionAt: string | null; ingestionStatus: string };
type Suggestions = { primaryKeywords: string[]; relatedTerms: string[]; spellingVariations: string[]; hashtags: string[]; entities: string[]; exclusionKeywords: string[]; provider?: string; model?: string };
type FormState = { name: string; description: string; primaryKeywords: string; relatedKeywords: string; hashtags: string; excludedKeywords: string; language: string; sources: string[]; startsOn: string; endsOn: string; status: "active" | "paused" };

const initialForm = (): FormState => ({ name: "", description: "", primaryKeywords: "", relatedKeywords: "", hashtags: "", excludedKeywords: "", language: "id", sources: [], startsOn: "", endsOn: "", status: "active" });
const splitValues = (value: string, hashtag = false) => {
  const values = value.split(/[\n,;]+/).map(item => {
    const clean = item.trim().replace(/\s+/g, " ");
    return hashtag ? `#${clean.replace(/^#+/, "")}` : clean;
  }).filter(value => value && value !== "#");
  const unique = new Map<string, string>();
  for (const value of values) if (!unique.has(value.toLocaleLowerCase())) unique.set(value.toLocaleLowerCase(), value);
  return [...unique.values()];
};
const joinValues = (items: unknown) => Array.isArray(items) ? items.join("\n") : "";
const stamp = (value?: string | null) => value ? new Date(value).toLocaleString() : "Not yet";
const statusName = (topic: Topic) => topic.query?.lifecycle === "archived" ? "Archived" : topic.is_active ? "Active" : "Paused";

export default function TopicManager({ onOpenTopic }: { onOpenTopic: (topicId: string) => void }) {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [sources, setSources] = useState<Source[]>([]);
  const [form, setForm] = useState<FormState>(initialForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestions | null>(null);
  const [busy, setBusy] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const response = await fetch("/api/workspace?resource=topics", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Could not load monitoring topics.");
      setTopics(payload.topics ?? []);
      setSources(payload.sources ?? []);
    } catch (e) { setError(e instanceof Error ? e.message : "Could not load monitoring topics."); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const configuredSources = useMemo(() => new Set(sources.filter(source => source.configured).map(source => source.id)), [sources]);
  const updateForm = (key: keyof FormState, value: string | string[]) => setForm(current => ({ ...current, [key]: value }));
  const keywordsCount = (topic: Topic) => (topic.query?.primary_keywords?.length ?? 0) + (topic.query?.related_keywords?.length ?? 0) + (topic.query?.hashtags?.length ?? 0) + (topic.query?.excluded_keywords?.length ?? 0);
  const sourceNames = (topic: Topic) => (topic.query?.sources ?? []).map((id: string) => sources.find(source => source.id === id)?.name ?? id);

  function openEdit(topic: Topic) {
    setEditingId(topic.id);
    setForm({
      name: topic.name,
      description: topic.description ?? "",
      primaryKeywords: joinValues(topic.query?.primary_keywords ?? (topic.query?.text ? [topic.query.text] : [])),
      relatedKeywords: joinValues(topic.query?.related_keywords),
      hashtags: joinValues(topic.query?.hashtags),
      excludedKeywords: joinValues(topic.query?.excluded_keywords),
      language: topic.query?.language ?? topic.languages?.[0] ?? "id",
      sources: topic.query?.sources ?? [],
      startsOn: topic.query?.starts_on ?? "",
      endsOn: topic.query?.ends_on ?? "",
      status: topic.query?.lifecycle === "paused" || !topic.is_active ? "paused" : "active",
    });
    setSuggestions(null); setShowForm(true); setError(""); setNotice("");
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError(""); setNotice("");
    const payload = {
      action: editingId ? "update_topic" : "create_topic",
      ...(editingId ? { id: editingId } : {}),
      name: form.name,
      description: form.description,
      primaryKeywords: splitValues(form.primaryKeywords),
      relatedKeywords: splitValues(form.relatedKeywords),
      hashtags: splitValues(form.hashtags, true),
      excludedKeywords: splitValues(form.excludedKeywords),
      language: form.language,
      sources: form.sources,
      startsOn: form.startsOn,
      endsOn: form.endsOn,
      status: form.status,
    };
    try {
      const response = await fetch("/api/workspace", { method: editingId ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Could not save the topic.");
      setNotice(result.message ?? (editingId ? "Topic updated successfully." : "Topic created successfully."));
      const savedTopic = result.topic;
      setShowForm(false); setEditingId(null); setForm(initialForm()); setSuggestions(null);
      await load();
      if (savedTopic?.id && savedTopic.is_active) onOpenTopic(savedTopic.id);
    } catch (e) { setError(e instanceof Error ? e.message : "Could not save the topic."); }
    finally { setBusy(false); }
  }

  async function setStatus(topic: Topic, status: "active" | "paused" | "archived") {
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/workspace", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "set_topic_status", id: topic.id, status }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Could not update topic status.");
      setNotice(result.message ?? `Topic ${status}.`); await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Could not update topic status."); }
    finally { setBusy(false); }
  }

  async function generateKeywords() {
    if (form.name.trim().length < 2) { setError("Enter a topic name first, then ask AI to generate keywords."); return; }
    setSuggesting(true); setError(""); setNotice(""); setSuggestions(null);
    try {
      const response = await fetch("/api/topics/suggest", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ topic: form.name }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "AI keyword suggestions are unavailable.");
      setSuggestions(result); setNotice(`Suggestions are ready from ${result.provider} / ${result.model}. Choose which ones to add.`);
    } catch (e) { setError(e instanceof Error ? e.message : "AI keyword suggestions are unavailable."); }
    finally { setSuggesting(false); }
  }

  function addSuggestions(field: keyof FormState, values: string[], hashtag = false) {
    if (!values.length) return;
    const existing = splitValues(String(form[field] ?? ""), hashtag);
    updateForm(field, [...new Map([...existing, ...values].map(value => [value.toLocaleLowerCase(), value])).values()].join("\n"));
    setNotice(`${values.length} AI suggestion${values.length === 1 ? "" : "s"} added for your review. Save the topic to keep them.`);
  }

  function duplicate(topic: Topic) {
    openEdit(topic); setEditingId(null); setForm(current => ({ ...current, name: `Copy of ${topic.name}` })); setNotice("Review the copied settings, then create the new topic.");
  }

  return <section className="topic-manager">
    {error && <div className="ai-control-message error" role="alert">{error}</div>}
    {notice && <div className="ai-control-message" role="status">{notice}</div>}

    <article className="card topic-list-card">
      <div className="module-table-head"><div><h2>Monitoring Topics</h2><p>Create and manage tenant-scoped monitoring topics.</p></div><div className="topic-heading-actions"><button className="button-secondary" onClick={() => void load()} aria-label="Refresh topics"><RefreshCw size={14}/> Refresh</button><button className="button-primary" onClick={() => { setEditingId(null); setForm(initialForm()); setSuggestions(null); setError(""); setShowForm(true); }}><Plus size={14}/> Create Topic</button></div></div>
      {!topics.length ? <div className="topic-empty-state"><div className="topic-empty-icon"><Hash size={21}/></div><b>No monitoring topics yet.</b><p>Create a topic with the keywords and authorized sources you want to monitor.</p><button className="button-primary" onClick={() => { setShowForm(true); setForm(initialForm()); }}><Plus size={14}/> Create Your First Topic</button></div> : <div className="topic-card-list">{topics.map(topic => {
        const state = statusName(topic);
        const names = sourceNames(topic);
        const statusClass = state === "Active" ? "healthy" : state === "Paused" ? "idle" : "archived";
        return <article className="topic-record" key={topic.id}>
          <div className="topic-record-main"><div className="topic-record-title"><h3>{topic.name}</h3><span className={`state-pill ${statusClass}`}>{state}</span></div><p>{topic.description || (topic.query?.primary_keywords ?? []).join(" · ") || topic.query?.text || "No description"}</p><div className="topic-record-meta"><span><Hash size={12}/>{keywordsCount(topic)} keywords</span><span><Globe2 size={12}/>{names.length ? names.join(", ") : "No source selected"}</span><span><MessageCircle size={12}/>{Number(topic.mentionCount ?? 0).toLocaleString()} mentions</span><span><Clock3 size={12}/>Last ingestion: {stamp(topic.lastIngestionAt)}</span></div><div className="topic-ingestion-state">Ingestion: <b>{topic.ingestionStatus === "waiting_for_source" ? "Waiting for a configured source" : topic.ingestionStatus === "queued" ? "Queued for worker" : topic.ingestionStatus === "ingesting" ? "In progress" : topic.ingestionStatus === "ready" ? "Up to date" : topic.ingestionStatus === "queue_error" ? "Worker queue error" : state === "Archived" ? "Archived" : state === "Paused" ? "Paused" : "Ready when a source is configured"}</b></div></div>
          <div className="topic-record-actions"><button className="button-secondary" onClick={() => onOpenTopic(topic.id)} disabled={!topic.is_active}><Globe2 size={13}/> Open</button><button className="button-secondary" onClick={() => openEdit(topic)}><SquarePen size={13}/> Edit</button>{state !== "Archived" && <button className="button-secondary" onClick={() => void setStatus(topic, topic.is_active ? "paused" : "active")} disabled={busy}>{topic.is_active ? <Pause size={13}/> : <Play size={13}/>} {topic.is_active ? "Pause" : "Resume"}</button>}<button className="button-secondary" onClick={() => duplicate(topic)}><Copy size={13}/> Duplicate</button>{state !== "Archived" && <button className="button-secondary topic-archive" onClick={() => void setStatus(topic, "archived")} disabled={busy}><Archive size={13}/> Archive</button>}</div>
        </article>;
      })}</div>}
    </article>

    {showForm && <article className="card topic-form-card">
      <div className="module-table-head"><div><h2>{editingId ? "Edit monitoring topic" : "Create monitoring topic"}</h2><p>Only configured, authorized connectors can start ingestion.</p></div><button className="button-secondary" onClick={() => { setShowForm(false); setEditingId(null); setSuggestions(null); }}>Close</button></div>
      <form className="topic-form" onSubmit={event => void submit(event)}>
        <div className="topic-form-grid"><label>Topic Name <span className="required">*</span><input value={form.name} onChange={event => updateForm("name", event.target.value)} placeholder="e.g. GoZero Telkom" required minLength={2} maxLength={100}/></label><label>Description<input value={form.description} onChange={event => updateForm("description", event.target.value)} placeholder="What should this topic monitor?" maxLength={500}/></label></div>
        <div className="topic-form-grid"><label>Main Keywords <span className="required">*</span><textarea value={form.primaryKeywords} onChange={event => updateForm("primaryKeywords", event.target.value)} placeholder={'One keyword per line\nGoZero\nGoZero Telkom'} required rows={3}/><small>Required. Separate values with a new line, comma, or semicolon. Duplicate terms are removed.</small></label><label>Related Keywords<textarea value={form.relatedKeywords} onChange={event => updateForm("relatedKeywords", event.target.value)} placeholder={'sustainability Telkom\nTelkom GoZero'} rows={3}/></label></div>
        <div className="topic-form-grid"><label>Hashtags<textarea value={form.hashtags} onChange={event => updateForm("hashtags", event.target.value)} placeholder={'#GoZero\n#GoZeroTelkom'} rows={2}/><small>Hashtags are normalized to include #.</small></label><label>Exclude Keywords<textarea value={form.excludedKeywords} onChange={event => updateForm("excludedKeywords", event.target.value)} placeholder="Unrelated meanings or common noise" rows={2}/></label></div>
        <section className="topic-ai-assistant"><div><Sparkles size={16}/><div><b>AI Keyword Assistant</b><p>Enter only the topic name to request primary terms, spelling variations, hashtags, entities, and noise filters.</p></div></div><button type="button" className="button-secondary" onClick={() => void generateKeywords()} disabled={suggesting || form.name.trim().length < 2}>{suggesting ? <LoaderCircle className="spin" size={14}/> : <Sparkles size={14}/>} Generate Keywords with AI</button></section>
        {suggestions && <div className="topic-suggestions" aria-live="polite">{[
          ["Primary keywords", suggestions.primaryKeywords, "primaryKeywords", false],
          ["Spelling variations", suggestions.spellingVariations, "primaryKeywords", false],
          ["Related terms", suggestions.relatedTerms, "relatedKeywords", false],
          ["Entities", suggestions.entities, "relatedKeywords", false],
          ["Hashtags", suggestions.hashtags, "hashtags", true],
          ["Exclude / noise keywords", suggestions.exclusionKeywords, "excludedKeywords", false],
        ].map(([title, values, field, isHashtag]) => <div className="topic-suggestion-group" key={String(title)}><div><b>{String(title)}</b><div className="topic-suggestion-chips">{(values as string[]).length ? (values as string[]).map((value, index) => <span key={`${value}-${index}`}>{value}</span>) : <small>No suggestions</small>}</div></div><button type="button" className="button-secondary" onClick={() => addSuggestions(field as keyof FormState, values as string[], Boolean(isHashtag))} disabled={!(values as string[]).length}><Check size={13}/> Add suggestions</button></div>)}</div>}

        <div className="topic-form-grid"><label>Language<select value={form.language} onChange={event => updateForm("language", event.target.value)}><option value="id">Indonesian</option><option value="en">English</option><option value="all">All languages</option></select></label><label>Status<select value={form.status} onChange={event => updateForm("status", event.target.value)}><option value="active">Active</option><option value="paused">Paused</option></select></label></div>
        <div className="topic-form-grid"><label>Monitoring start<input type="date" value={form.startsOn} onChange={event => updateForm("startsOn", event.target.value)}/></label><label>Monitoring end<input type="date" value={form.endsOn} min={form.startsOn || undefined} onChange={event => updateForm("endsOn", event.target.value)}/></label></div>
        <fieldset className="topic-source-fieldset"><legend>Sources</legend><p>Select the platforms to include. Unconfigured sources are marked and will not ingest until authorized.</p><div className="topic-source-grid">{sources.map(source => <label className="topic-source-option" key={source.id}><input type="checkbox" checked={form.sources.includes(source.id)} onChange={event => updateForm("sources", event.target.checked ? [...form.sources, source.id] : form.sources.filter(id => id !== source.id))}/><span><b>{source.name}</b><small className={source.configured ? "source-ready" : "source-needs-setup"}>{source.configurationLabel}</small></span></label>)}</div>{!sources.length && <p className="topic-source-empty">No connectors are registered yet. You can save the topic now and add sources later.</p>}</fieldset>
        <div className="topic-form-actions"><span>{form.sources.some(source => configuredSources.has(source)) ? "At least one selected source is configured." : "No selected source is configured yet; the topic will wait for a data source."}</span><button type="button" className="button-secondary" onClick={() => { setShowForm(false); setEditingId(null); setSuggestions(null); }}>Cancel</button><button className="button-primary" disabled={busy || splitValues(form.primaryKeywords).length === 0}>{busy ? <LoaderCircle className="spin" size={14}/> : editingId ? <Check size={14}/> : <Plus size={14}/>} {editingId ? "Save Changes" : "Create Topic"}</button></div>
      </form>
    </article>}
  </section>;
}
