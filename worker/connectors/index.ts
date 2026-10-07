import { AuthorizedRestConnector } from "./authorized-rest";
import { MetaGraphConnector } from "./meta-graph";
import type { SourceConnector } from "./types";

const toRecord = (item: any) => { const reference = item.referenced_tweets?.[0]; return { externalId: String(item.id), canonicalUrl: item.url, authorId: item.author_id, authorName: item.author_name, authorHandle: item.author_handle, followers: Number(item.followers_count ?? 0), text: String(item.text ?? ""), language: item.lang, publishedAt: item.created_at, reach: Number(item.reach ?? 0), engagement: Number(item.public_metrics?.like_count ?? 0), parentExternalId: item.parent_external_id ?? reference?.id, edgeType: item.edge_type ?? reference?.type, raw: item }; };
const registry = new Map<string, SourceConnector>([
  ["x_api", new AuthorizedRestConnector("x_api", "X_API_SEARCH_URL", toRecord)],
  ["meta_graph", new MetaGraphConnector()],
  ["tiktok_business", new AuthorizedRestConnector("tiktok_business", "TIKTOK_BUSINESS_MENTIONS_URL", toRecord)],
]);
export function getConnector(provider: string) { const connector = registry.get(provider); if (!connector) throw new Error(`No connector adapter registered for ${provider}.`); return connector; }
