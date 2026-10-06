import type { ConnectorContext, SourceConnector, SourceRecord } from "./types";

/* Minimal adapter shell for OAuth-authorized provider implementations.
   Each provider module can be replaced without changing persistence or jobs. */
export class AuthorizedRestConnector implements SourceConnector {
  constructor(readonly provider: string, private readonly endpointEnv: string, private readonly mapper: (item: any) => SourceRecord) {}
  async fetchRecent(context: ConnectorContext): Promise<SourceRecord[]> {
    const endpoint = process.env[this.endpointEnv];
    if (!endpoint) throw new Error(`Connector ${this.provider} needs a configured official API endpoint.`);
    let url: URL;
    try { url = new URL(endpoint); } catch { throw new Error(`Connector ${this.provider} has an invalid official API endpoint.`); }
    if (url.protocol !== "https:") throw new Error(`Connector ${this.provider} API endpoint must use HTTPS.`);
    const queryText = typeof context.query?.text === "string" ? context.query.text.trim() : "";
    if (queryText) url.searchParams.set(process.env[`${this.endpointEnv}_QUERY_PARAM`] || "query", queryText);
    url.searchParams.set("topic_id", context.topicId);
    const response = await fetch(url, { headers: { Authorization: `Bearer ${context.secret}`, Accept: "application/json" }, signal: AbortSignal.timeout(30_000), redirect: "error" });
    if (!response.ok) throw new Error(`${this.provider} API returned ${response.status}.`);
    const body = await response.json();
    const rows = Array.isArray(body.data) ? body.data : [];
    return rows.map(this.mapper);
  }
}
