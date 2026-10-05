import { NextRequest } from 'next/server';
import { workspaceContext } from '@/lib/workspace-context';
export const dynamic='force-dynamic';
export async function GET(request:NextRequest){
 const c=await workspaceContext();if('response' in c)return c.response;
 const {db,workspaceId,role}=c;const topicId=request.nextUrl.searchParams.get('topic');
 const topics=await db.from('monitoring_topics').select('*').eq('workspace_id',workspaceId).order('created_at');
 if(topics.error)return Response.json({error:'Topics unavailable.'},{status:500});
 const topic=topics.data.find(t=>t.id===topicId)??topics.data[0];
 const read=(table:string,select='*',scoped=true)=>{let q=db.from(table).select(select).eq('workspace_id',workspaceId);if(scoped&&topic)q=q.eq('topic_id',topic.id);return q.limit(500);};
 if(!topic)return Response.json({topics:[],role,conversations:[],narratives:[],metrics:[],alerts:[],reports:[],edges:[],connectors:[],audit:[]},{headers:{'Cache-Control':'no-store'}});
 const results=await Promise.all([
 read('conversations','id,source,canonical_url,author_id,author_name,content,published_at,reach,engagement,parent_external_id,conversation_analyses(*)').order('published_at',{ascending:false}),
 read('narratives').order('post_count',{ascending:false}),read('topic_metrics_hourly').order('bucket_at'),read('alert_events').order('triggered_at',{ascending:false}),read('reports').order('created_at',{ascending:false}),read('propagation_edges').order('occurred_at'),read('connectors','id,provider,display_name,state,last_sync_at,last_error',false),
 ['owner','admin'].includes(role)?read('audit_logs','*',false).order('created_at',{ascending:false}):Promise.resolve({data:[],error:null})
 ]);
 if(results.some(x=>x.error))return Response.json({error:'Workspace data unavailable. Check schema and access policies.'},{status:500});
 return Response.json({topics:topics.data,topic,role,conversations:results[0].data,narratives:results[1].data,metrics:results[2].data,alerts:results[3].data,reports:results[4].data,edges:results[5].data,connectors:results[6].data,audit:results[7].data,coverage:'Most recent 500 collected records per table; not complete platform coverage.'},{headers:{'Cache-Control':'no-store'}});
}
export async function POST(request:NextRequest){
 if(request.headers.get('origin')!==new URL(request.url).origin)return Response.json({error:'Invalid origin.'},{status:403});
 const c=await workspaceContext();if('response' in c)return c.response;
 if(!['owner','admin','analyst'].includes(c.role))return Response.json({error:'Analyst access required.'},{status:403});
 const body=await request.json().catch(()=>null);if(!body||typeof body.name!=='string'||!body.name.trim()||body.name.length>120||typeof body.keywords!=='string'||body.keywords.length>1000)return Response.json({error:'Enter a name and keywords.'},{status:400});
 const {data,error}=await c.db.from('monitoring_topics').insert({workspace_id:c.workspaceId,name:body.name.trim(),query:{keywords:body.keywords.split(',').map((x:string)=>x.trim()).filter(Boolean)},created_by:c.user.id,demo_mode:false}).select('id').single();
 if(error)return Response.json({error:'Could not create topic.'},{status:500});return Response.json(data,{status:201});
}
