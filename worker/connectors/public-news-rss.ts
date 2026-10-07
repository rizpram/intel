import type { ConnectorContext, SourceConnector, SourceRecord } from "./types";

const FEED_URL = "https://news.google.com/rss/search";
const MAX_TERMS = 8;
const MAX_RESULTS_PER_TERM_MONTH = 10;
const MAX_CONCURRENT_FEEDS = 4;

function decodeXml(value: string) {
  return value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([\da-f]+);/gi, (_, code: string) => String.fromCodePoint(Number.parseInt(code, 16)));
}

function tag(xml: string, name: string) {
  const match = xml.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`, "i"));
  return match ? decodeXml(match[1]).trim() : "";
}

function stripHtml(value: string) { return decodeXml(value.replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim(); }

function searchTerms(query: Record<string, unknown>) {
  const primary = Array.isArray(query.primary_keywords) ? query.primary_keywords : [];
  const values = primary.length ? primary : [...(Array.isArray(query.related_keywords) ? query.related_keywords : []), ...(Array.isArray(query.hashtags) ? query.hashtags : [])];
  return [...new Set(values.filter((value): value is string => typeof value === "string").map(value => value.trim().replace(/\s+/g, " ")).filter(Boolean))].slice(0, MAX_TERMS);
}

function dateWindows(after: string, before: string) {
  const start = new Date(`${after}T00:00:00Z`);
  const end = new Date(`${before}T00:00:00Z`);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || start > end) throw new Error("News search date range is invalid.");
  const windows: Array<{ after: string; before: string }> = [];
  for (let cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1)); cursor <= end; cursor = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1))) {
    const monthEnd = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 0));
    const windowStart = cursor < start ? start : cursor;
    const windowEnd = monthEnd > end ? end : monthEnd;
    windows.push({ after: windowStart.toISOString().slice(0, 10), before: windowEnd.toISOString().slice(0, 10) });
  }
  return windows;
}

function toRecord(item: string): SourceRecord | null {
  const title = stripHtml(tag(item, "title"));
  const url = tag(item, "link");
  const publishedAt = new Date(tag(item, "pubDate"));
  if (!title || !url || !Number.isFinite(publishedAt.getTime())) return null;
  const sourceMatch = item.match(/<source(?:\s+url=["'][^"']*["'])?[^>]*>([\s\S]*?)<\/source>/i);
  const publisher = sourceMatch ? stripHtml(decodeXml(sourceMatch[1])) : "News / Web";
  const snippet = stripHtml(tag(item, "description"));
  return { externalId: url, source: "news_web", canonicalUrl: url, authorName: publisher, authorHandle: publisher,
    text: (snippet ? `${title}\n\n${snippet}` : title).slice(0, 12_000), language: "id", publishedAt: publishedAt.toISOString(),
    raw: { publisher, title, snippet } };
}

export class PublicNewsRssConnector implements SourceConnector {
  readonly provider = "public_news_rss";

  async fetchRecent(context: ConnectorContext) {
    const terms = searchTerms(context.query);
    if (!terms.length) throw new Error("Add at least one monitoring keyword before syncing News / Web.");
    const startsOn = typeof context.query.starts_on === "string" ? context.query.starts_on : "";
    const endsOn = typeof context.query.ends_on === "string" ? context.query.ends_on : "";
    const after = startsOn || new Date(Date.now() - 365 * 86_400_000).toISOString().slice(0, 10);
    const before = endsOn || new Date().toISOString().slice(0, 10);
    const requests = terms.flatMap(term => dateWindows(after, before).map(window => ({ term, ...window })));
    const results: SourceRecord[][] = [];
    for (let offset = 0; offset < requests.length; offset += MAX_CONCURRENT_FEEDS) {
      const batch = requests.slice(offset, offset + MAX_CONCURRENT_FEEDS);
      results.push(...await Promise.all(batch.map(async ({ term, after: windowStart, before: windowEnd }) => {
      const url = new URL(FEED_URL);
      url.searchParams.set("q", `${term} after:${windowStart} before:${windowEnd}`);
      url.searchParams.set("hl", "id"); url.searchParams.set("gl", "ID"); url.searchParams.set("ceid", "ID:id");
      const response = await fetch(url, { headers: { accept: "application/rss+xml, application/xml, text/xml" }, signal: AbortSignal.timeout(20_000), redirect: "error", cache: "no-store" });
      if (!response.ok) throw new Error(`News search returned HTTP ${response.status}.`);
      const xml = await response.text();
      if (!xml.includes("<rss") && !xml.includes("<feed")) throw new Error("News search returned an unexpected feed format.");
      return [...xml.matchAll(/<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/gi)].slice(0, MAX_RESULTS_PER_TERM_MONTH).map(match => toRecord(match[1])).filter((record): record is SourceRecord => Boolean(record));
      })));
    }
    const unique = new Map<string, SourceRecord>();
    for (const record of results.flat()) unique.set(record.externalId, record);
    return [...unique.values()].sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt));
  }
}
