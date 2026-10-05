import type { ConnectorContext, SourceConnector, SourceRecord } from "./types";
import { safeProviderUrl } from "../../src/lib/ai/catalog";

export function validateRecord(record: SourceRecord): SourceRecord {
  if (!record.externalId || record.externalId === "undefined" || !record.text?.trim() || record.text.length > 20000 || !Number.isFinite(Date.parse(record.publishedAt))) throw new Error("Provider returned an invalid source record.");
  if (record.canonicalUrl) { const url = new URL(record.canonicalUrl); if (url.protocol !== "https:" || url.username || url.password) throw new Error("Invalid source URL."); }
  for (const value of [record.followers, record.reach, record.engagement]) if (value !== undefined && (!Number.isFinite(value) || value < 0)) throw new Error("Invalid source metrics.");
  return record;
}

/* Adapter for authorized providers implementing the normalized response contract.
   Provider-specific endpoints must map their API's query and pagination semantics. */
export class AuthorizedRestConnector implements SourceConnector {
  constructor(readonly provider: string, private readonly endpointEnv: string, private readonly mapper: (item: any) => SourceRecord) {}
  async fetchRecent(context: ConnectorContext): Promise<SourceRecord[]> {
    const endpoint = process.env[this.endpointEnv];
    if (!endpoint) throw new Error(`Connector ${this.provider} needs a configured official API endpoint.`);
    const url = new URL(safeProviderUrl(endpoint));
    const hosts = (process.env.CONNECTOR_ALLOWED_HOSTS || "").split(",").map(host => host.trim()).filter(Boolean);
    if (!hosts.includes(url.hostname)) throw new Error("Connector host must be explicitly authorized in CONNECTOR_ALLOWED_HOSTS.");
    const terms = context.query.include ?? context.query.keywords;
    if (!Array.isArray(terms) || !terms.length || terms.some(term => typeof term !== "string")) throw new Error("Topic query requires include/keywords terms.");
    url.searchParams.set("query", terms.join(" OR "));
    const response = await fetch(url, { headers: { Authorization: `Bearer ${context.secret}`, Accept: "application/json" }, signal: AbortSignal.timeout(30_000), redirect: "error" });
    if (!response.ok) throw new Error(`${this.provider} API returned ${response.status}.`);
    const text = await response.text();
    if (text.length > 5_000_000) throw new Error("Provider response exceeds the allowed size.");
    const body = JSON.parse(text);
    if (!Array.isArray(body.data) || body.data.length > 1000) throw new Error("Provider must return at most 1000 normalized data records.");
    return body.data.map((item: any) => validateRecord(this.mapper(item)));
  }
}
