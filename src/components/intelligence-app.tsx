export const AI_PROVIDERS = [
  { id: "openrouter", name: "OpenRouter", baseUrl: "https://openrouter.ai/api/v1", kind: "openai-compatible" },
  { id: "gemini", name: "Google Gemini Direct", baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai", kind: "gemini" },
  { id: "openai", name: "OpenAI Direct", baseUrl: "https://api.openai.com/v1", kind: "openai-compatible" },
  { id: "xai", name: "xAI / Grok Direct", baseUrl: "https://api.x.ai/v1", kind: "openai-compatible" },
  { id: "custom", name: "Custom OpenAI-compatible", baseUrl: "", kind: "openai-compatible" },
] as const;

export type AiProviderId = typeof AI_PROVIDERS[number]["id"];
export const providerInfo = (id: string) => AI_PROVIDERS.find(item => item.id === id);
export const modelKey = (provider: string, modelId: string) => `${provider}::${modelId}`;

export function safeProviderUrl(value: string) {
  const url = new URL(value);
  const local = ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
  if (url.protocol !== "https:" && !(process.env.NODE_ENV !== "production" && local && url.protocol === "http:")) throw new Error("Provider endpoints must use HTTPS.");
  const host = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  const ipv4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/)?.slice(1).map(Number);
  const privateIpv4 = ipv4 && (ipv4.some(part => part > 255) || ipv4[0] === 10 || ipv4[0] === 127 || ipv4[0] === 0 || (ipv4[0] === 169 && ipv4[1] === 254) || (ipv4[0] === 172 && ipv4[1] >= 16 && ipv4[1] <= 31) || (ipv4[0] === 192 && ipv4[1] === 168) || (ipv4[0] === 100 && ipv4[1] >= 64 && ipv4[1] <= 127));
  const mappedIpv4 = host.match(/^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/)?.[1];
  const mappedParts = mappedIpv4?.split(".").map(Number);
  const mappedPrivate = mappedParts && (mappedParts[0] === 10 || mappedParts[0] === 127 || mappedParts[0] === 0 || (mappedParts[0] === 169 && mappedParts[1] === 254) || (mappedParts[0] === 172 && mappedParts[1] >= 16 && mappedParts[1] <= 31) || (mappedParts[0] === 192 && mappedParts[1] === 168));
  const privateIpv6 = host === "::" || host === "::1" || host.startsWith("fc") || host.startsWith("fd") || host.startsWith("fe8") || host.startsWith("fe9") || host.startsWith("fea") || host.startsWith("feb") || Boolean(mappedPrivate);
  if (url.username || url.password || host.endsWith(".local") || host.endsWith(".internal") || host.endsWith(".localhost") || privateIpv4 || privateIpv6) throw new Error("That provider endpoint is not allowed.");
  return url.toString().replace(/\/$/, "");
}

export function modelMetadata(provider: string, raw: Record<string, any>) {
  const modelId = String(raw.id || raw.name || "").replace(/^models\//, "");
  const price = raw.pricing ?? {};
  const inputPrice = Number(price.prompt ?? price.input ?? -1);
  const outputPrice = Number(price.completion ?? price.output ?? -1);
  const isFree = provider === "openrouter" ? inputPrice === 0 && outputPrice === 0 : false;
  const modalities: string[] = raw.architecture?.input_modalities ?? raw.input_modalities ?? [];
  const capabilities = new Set<string>(["text"]);
  if (modalities.includes("image") || /vision|multimodal/i.test(modelId)) capabilities.add("vision");
  if ((raw.supported_parameters ?? []).some((value: string) => /response_format|json/i.test(value))) capabilities.add("structured_output");
  if ((raw.supportedGenerationMethods ?? []).some((value: string) => /generateContent/i.test(value))) capabilities.add("structured_output");
  if (provider === "openrouter" && modelId === "openrouter/free") { capabilities.add("structured_output"); }
  return {
    model_id: modelId,
    display_name: String(raw.name || raw.displayName || modelId),
    is_free: isFree,
    capabilities: [...capabilities],
    context_window: Number(raw.context_length || raw.top_provider?.context_length || raw.inputTokenLimit || 0) || null,
    supports_vision: capabilities.has("vision"),
    supports_structured_output: capabilities.has("structured_output"),
    input_usd_per_million: inputPrice >= 0 ? inputPrice * 1_000_000 : null,
    output_usd_per_million: outputPrice >= 0 ? outputPrice * 1_000_000 : null,
  };
}
