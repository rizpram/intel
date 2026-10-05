import { createClient } from '@/lib/supabase/server';
export async function workspaceContext() {
 const db=await createClient();const {data:{user}}=await db.auth.getUser();
 if(!user)return {response:Response.json({error:'Sign in required.'},{status:401})} as const;
 const {data:member,error}=await db.from('workspace_memberships').select('workspace_id,role').eq('user_id',user.id).order('created_at').limit(1).maybeSingle();
 if(error||!member)return {response:Response.json({error:'Workspace membership required.'},{status:403})} as const;
 return {db,user,workspaceId:member.workspace_id,role:member.role} as const;
}
