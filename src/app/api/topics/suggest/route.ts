import { NextRequest, NextResponse } from "next/server";
import { routeCompletion } from "@/lib/ai/router";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function suggestions(value: unknown) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((item): item is string => typeof item === "string").map(item => item.trim().replace(/\s+/g, " ")).filter(Boolean))].slice(0, 20);
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const topic = typeof body.topic === "string" ? body.topic.trim().replace(/\s+/g, " ") : "";
  if (topic.length < 2 || topic.length > 160) return NextResponse.json({ error: "Enter a topic between 2 and 160 characters." }, { status: 400 });

  const auth = await createClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const { data: membership, error } = await auth.from("workspace_memberships").select("workspace_id,role").eq("user_id", user.id).order("created_at", { ascending: true }).limit(1).maybeSingle();
  if (error || !membership || !["owner", "admin", "analyst"].includes(membership.role)) return NextResponse.json({ error: "Analyst access required." }, { status: 403 });

  try {
    const result = await routeCompletion({
      db: createAdminClient(),
      workspaceId: membership.workspace_id,
      purpose: "topic_classification",
      messages: [
        { role: "system", content: "You suggest social listening search terms in Indonesian and English as useful. Return JSON only with arrays primary_keywords, related_terms, spelling_variations, hashtags, entities, exclusion_keywords. Keep terms concise, relevant and non-duplicative. Do not invent official facts or claim an entity is confirmed. Exclusion keywords should identify likely unrelated/noise meanings. Do not include explanations." },
        { role: "user", content: JSON.stringify({ topic }) },
      ],
    });
    const parsed = JSON.parse(result.content);
    return NextResponse.json({
      primaryKeywords: suggestions(parsed.primary_keywords),
      relatedTerms: suggestions(parsed.related_terms),
      spellingVariations: suggestions(parsed.spelling_variations),
      hashtags: suggestions(parsed.hashtags).map(tag => `#${tag.replace(/^#+/, "")}`),
      entities: suggestions(parsed.entities),
      exclusionKeywords: suggestions(parsed.exclusion_keywords),
      provider: result.provider,
      model: result.model,
    });
  } catch {
    return NextResponse.json({ error: "AI keyword suggestions are unavailable. Configure and test a provider in AI Control Center, then try again." }, { status: 502 });
  }
}
