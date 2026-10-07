import type { ConnectorContext, SourceConnector, SourceRecord } from "./types";

type MetaCredentials = Partial<Record<"facebook_page" | "instagram" | "threads", string>>;
type MetaConfig = Partial<Record<"facebook_page_id" | "instagram_account_id" | "threads_user_id", string>>;

function apiVersion() {
  const version = process.env.META_GRAPH_API_VERSION?.trim() || "v23.0";
  if (!/^v\d+\.0$/.test(version)) throw new Error("META_GRAPH_API_VERSION must use the Meta format vNN.0.");
  return version;
}

async function requestJson(url: URL, token: string) {
  const response = await fetch(url, { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" }, signal: AbortSignal.timeout(15_000), redirect: "error", cache: "no-store" });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const code = typeof payload?.error?.code === "number" ? ` (Meta error ${payload.error.code})` : "";
    throw new Error(`Meta Graph API request failed with HTTP ${response.status}${code}. Check account access, token permissions, and connector health.`);
  }
  return payload;
}

function graphUrl(host: "graph.facebook.com" | "graph.threads.net", path: string) {
  const url = new URL(`https://${host}/${path.replace(/^\/+/, "")}`);
  return url;
}

async function listPages(host: "graph.facebook.com" | "graph.threads.net", path: string, fields: string, token: string) {
  const out: any[] = [];
  let url = graphUrl(host, path);
  url.searchParams.set("fields", fields);
  url.searchParams.set("limit", "50");
  for (let page = 0; page < 3; page++) {
    const payload = await requestJson(url, token);
    if (Array.isArray(payload.data)) out.push(...payload.data);
    const next = payload?.paging?.next;
    if (typeof next !== "string" || page === 2) break;
    const nextUrl = new URL(next);
    if (nextUrl.protocol !== "https:" || nextUrl.hostname !== host) throw new Error("Meta returned an unexpected pagination host; request stopped for safety.");
    nextUrl.searchParams.delete("access_token");
    url = nextUrl;
  }
  return out;
}

function hasAny(text: string, terms: string[]) {
  const normalized = text.toLocaleLowerCase();
  return terms.some(term => term && normalized.includes(term.toLocaleLowerCase()));
}

function toSourceRecord(item: any, source: "facebook" | "instagram" | "threads"): SourceRecord | null {
  const text = String(item.message ?? item.text ?? item.caption ?? "").trim();
  const publishedAt = String(item.created_time ?? item.timestamp ?? "");
  const id = String(item.id ?? "");
  if (!id || !text || !publishedAt || !Number.isFinite(Date.parse(publishedAt))) return null;
  const author = item.from ?? {};
  const engagement = Number(item.likes?.summary?.total_count ?? item.like_count ?? 0) + Number(item.comments?.summary?.total_count ?? item.comments_count ?? item.reply_count ?? 0) + Number(item.repost_count ?? 0) + Number(item.quote_count ?? 0);
  return {
    externalId: `${source}:${id}`,
    source,
    canonicalUrl: item.permalink_url ?? item.permalink,
    authorId: String(author.id ?? item.owner?.id ?? item.user_id ?? "") || undefined,
    authorName: String(author.name ?? item.username ?? "") || undefined,
    authorHandle: item.username ? `@${item.username}` : undefined,
    text,
    publishedAt,
    engagement,
    raw: { id, media_type: item.media_type, permalink: item.permalink ?? item.permalink_url, source },
  };
}

export class MetaGraphConnector implements SourceConnector {
  readonly provider = "meta_graph";

  async fetchRecent(context: ConnectorContext): Promise<SourceRecord[]> {
    let credentials: MetaCredentials;
    try { credentials = JSON.parse(context.secret) as MetaCredentials; }
    catch { throw new Error("Meta connector credentials could not be read. Re-enter the authorized access token."); }
    const config = (context.config ?? {}) as MetaConfig;
    const selected = Array.isArray(context.query.sources) ? context.query.sources as string[] : [];
    const terms = [...(Array.isArray(context.query.primary_keywords) ? context.query.primary_keywords : []), ...(Array.isArray(context.query.related_keywords) ? context.query.related_keywords : []), ...(Array.isArray(context.query.hashtags) ? context.query.hashtags : [])].filter((term): term is string => typeof term === "string" && term.trim().length > 0);
    const rows: SourceRecord[] = [];
    if (selected.includes("facebook") && config.facebook_page_id && credentials.facebook_page) {
      const items = await listPages("graph.facebook.com", `${apiVersion()}/${encodeURIComponent(config.facebook_page_id)}/posts`, "id,message,created_time,permalink_url,from,shares,likes.summary(true),comments.summary(true)", credentials.facebook_page);
      rows.push(...items.map((item: any) => toSourceRecord(item, "facebook")).filter((item: SourceRecord | null): item is SourceRecord => Boolean(item && hasAny(item.text, terms))));
    }
    if (selected.includes("instagram") && config.instagram_account_id && credentials.instagram) {
      const items = await listPages("graph.facebook.com", `${apiVersion()}/${encodeURIComponent(config.instagram_account_id)}/media`, "id,caption,media_type,permalink,timestamp,username,like_count,comments_count", credentials.instagram);
      rows.push(...items.map((item: any) => toSourceRecord(item, "instagram")).filter((item: SourceRecord | null): item is SourceRecord => Boolean(item && hasAny(item.text, terms))));
    }
    if (selected.includes("threads") && config.threads_user_id && credentials.threads) {
      const items = await listPages("graph.threads.net", `v1.0/${encodeURIComponent(config.threads_user_id)}/threads`, "id,text,permalink,timestamp,username,owner,is_quote_post", credentials.threads);
      rows.push(...items.map((item: any) => toSourceRecord(item, "threads")).filter((item: SourceRecord | null): item is SourceRecord => Boolean(item && hasAny(item.text, terms))));
    }
    return rows;
  }
}

export async function testMetaCredentials(config: MetaConfig, credentials: MetaCredentials) {
  const results: Record<string, { ok: boolean; account?: string; error?: string }> = {};
  const checks: Array<{ key: keyof MetaCredentials; id: keyof MetaConfig; source: string; host: "graph.facebook.com" | "graph.threads.net"; path: string; fields: string }> = [
    { key: "facebook_page", id: "facebook_page_id", source: "Facebook Page", host: "graph.facebook.com", path: `${apiVersion()}`, fields: "id,name" },
    { key: "instagram", id: "instagram_account_id", source: "Instagram professional account", host: "graph.facebook.com", path: `${apiVersion()}`, fields: "id,username" },
    { key: "threads", id: "threads_user_id", source: "Threads account", host: "graph.threads.net", path: "v1.0", fields: "id,username" },
  ];
  for (const check of checks) {
    const token = credentials[check.key], accountId = config[check.id];
    if (!token || !accountId) continue;
    const url = graphUrl(check.host, `${check.path}/${encodeURIComponent(accountId)}`);
    url.searchParams.set("fields", check.fields);
    try {
      const payload = await requestJson(url, token);
      results[check.key] = { ok: true, account: String(payload.username ?? payload.name ?? payload.id ?? check.source) };
    } catch (error) {
      results[check.key] = { ok: false, error: error instanceof Error ? error.message : "Connection check failed." };
    }
  }
  return results;
}
