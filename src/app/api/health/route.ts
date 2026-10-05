import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export async function GET() {
  if (process.env.DEMO_MODE === "true") return NextResponse.json({ status: "ok", app: "rizpram-intelligence", database: "demo", worker: "demo", time: new Date().toISOString() });
  try {
    const db = createAdminClient();
    const [{ data, error }, { data: heartbeat }] = await Promise.all([
      db.from("workspaces").select("id").limit(1),
      db.from("service_heartbeats").select("last_seen_at,instance_id").eq("service_name", "worker").maybeSingle(),
    ]);
    if (error) throw error;
    const seenAt = heartbeat?.last_seen_at ? new Date(heartbeat.last_seen_at).getTime() : 0;
    const worker = seenAt > Date.now() - 90_000 ? "healthy" : heartbeat ? "stale" : "starting";
    return NextResponse.json({ status: worker === "healthy" ? "ok" : "degraded", app: "rizpram-intelligence", database: "connected", workspace_count: data?.length ?? 0, worker, time: new Date().toISOString() }, {status:worker === "healthy" ? 200 : 503});
  } catch {
    return NextResponse.json({ status: "unavailable", app: "rizpram-intelligence", database: "disconnected", worker: "unknown", time: new Date().toISOString() }, { status: 503 });
  }
}
