import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export async function POST(request: NextRequest) {
  const body=await request.json();
  if(typeof body.title!=="string"||body.title.length<3||body.title.length>120) return NextResponse.json({error:"Report title must be between 3 and 120 characters."},{status:400});
  const db=await createClient();
  const {data:{user}}=await db.auth.getUser();
  if(!user) return NextResponse.json({error:"Sign in required."},{status:401});
  const {data:membership,error:memberError}=await db.from("workspace_memberships").select("workspace_id,role").eq("user_id",user.id).order("created_at",{ascending:true}).limit(1).maybeSingle();
  if(memberError||!membership||!["owner","admin","analyst"].includes(membership.role)) return NextResponse.json({error:"An analyst role is required to generate reports."},{status:403});
  let topicQuery=db.from("monitoring_topics").select("id").eq("workspace_id",membership.workspace_id).eq("is_active",true);
  if(typeof body.topic_id==="string") topicQuery=topicQuery.eq("id",body.topic_id);
  const {data:topic,error:topicError}=await topicQuery.order("created_at",{ascending:true}).limit(1).maybeSingle();
  if(topicError||!topic) return NextResponse.json({error:"No active monitoring topic is available."},{status:404});
  const serviceKey=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!serviceKey) return NextResponse.json({error:"Report service is not configured."},{status:503});
  const admin=createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:report,error:reportError}=await admin.from("reports").insert({workspace_id:membership.workspace_id,topic_id:topic.id,title:body.title,format:body.format==="json"?"json":"pdf",status:"queued",created_by:user.id}).select("id").single();
  if(reportError||!report) return NextResponse.json({error:"Could not queue the report."},{status:500});
  const {error:jobError}=await admin.from("worker_jobs").insert({workspace_id:membership.workspace_id,topic_id:topic.id,job_type:"generate_report",payload:{report_id:report.id}});
  if(jobError) { await admin.from("reports").update({status:"failed",content:{error:"Report queue unavailable."}}).eq("id",report.id); return NextResponse.json({error:"The report worker is unavailable."},{status:503}); }
  return NextResponse.json({id:report.id,status:"queued"},{status:202});
}
