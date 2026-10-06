export type SourceRecord = { externalId: string; canonicalUrl?: string; authorId?: string; authorName?: string; authorHandle?: string; followers?: number; text: string; language?: string; publishedAt: string; reach?: number; engagement?: number; parentExternalId?: string; edgeType?: string; raw?: Record<string, unknown> };
export type ConnectorContext = { workspaceId: string; topicId: string; connectorId: string; query: Record<string, unknown>; secret: string };
export interface SourceConnector { readonly provider: string; fetchRecent(context: ConnectorContext): Promise<SourceRecord[]>; }
