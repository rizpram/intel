import type { ConnectorContext, SourceConnector, SourceRecord } from "./types";

/* Minimal adapter shell for OAuth-authorized provider implementations.
   Each provider module can be replaced without changing persistence or jobs. */
export class AuthorizedRestConnector implements SourceConnector {
  constructor(readonly provider: string, private readonly endpointEnv: string, private readonly mapper: (item: any) => SourceRecord) {}
  async fetchRecent(context: ConnectorContext): Promise<SourceRecord[]> {
    const endpoint = process.env[this.endpointEnv];
    if (!endpoint) throw new Error(`Connector ${this.provider} needs a configured official API endpoint.`);
    const response = await fetch(endpoint, { headers: { Authorization: `Bearer ${context.secret}`, Accept: "application/json" } });
    if (!response.ok) throw new Error(`${this.provider} API returned ${response.status}.`);
    const body = await response.json();
    const rows = Array.isArray(body.data) ? body.data : [];
    return rows.map(this.mapper);
  }
}
