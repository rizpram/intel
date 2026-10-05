import { NextResponse } from "next/server";
import { aiAdminContext } from "@/lib/ai/admin-context";
import { providerHealth } from "@/lib/ai/router";

export const dynamic = "force-dynamic";

export async function GET() {
  const context = await aiAdminContext();
  if ("response" in context) return context.response;
  return NextResponse.json({ providers: await providerHealth(context.admin, context.workspaceId) });
}
