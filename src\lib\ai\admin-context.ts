import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function aiAdminContext() {
  const authDb = await createClient();
  const { data: { user } } = await authDb.auth.getUser();
  if (!user) return { response: Response.json({ error: "Sign in required." }, { status: 401 }) } as const;
  const { data: membership } = await authDb.from("workspace_memberships").select("workspace_id,role").eq("user_id", user.id).order("created_at", { ascending: true }).limit(1).maybeSingle();
  if (!membership || !["owner", "admin"].includes(membership.role)) return { response: Response.json({ error: "Workspace admin access required." }, { status: 403 }) } as const;
  return { authDb, admin: createAdminClient(), user, workspaceId: membership.workspace_id } as const;
}
