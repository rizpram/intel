import {NextRequest} from 'next/server';
import {workspaceContext} from '@/lib/workspace-context';
import {createAdminClient} from '@/lib/supabase/admin';
export async function POST(request:NextRequest){
 if(request.headers.get('origin')!==new URL(request.url).origin)return Response.json({error:'Invalid origin.'},{status:403});
 const c=await workspaceContext();if('response' in c)return c.response;
 if(!['owner','admin','analyst'].includes(c.role))return Response.json({error:'Analyst access required.'},{status:403});
 const b=await request.json().catch(()=>({}));
 const {data:topic,error}=await c.db.from('monitoring_topics').select('id,demo_mode,is_active').eq('workspace_id',c.workspaceId).eq('id',b.topic_id).maybeSingle();
 if(error||!topic||!topic.is_active||topic.demo_mode)return Response.json({error:'Select an active non-demo topic for ingestion.'},{status:400});
 const {data:connectors,error:connectorError}=await c.db.from('connectors').select('id').eq('workspace_id',c.workspaceId).eq('state','connected');
 if(connectorError||!connectors?.length)return Response.json({error:'No authorized connected source is configured.'},{status:409});
 const admin=createAdminClient();const {data:pending,error:pendingError}=await admin.from('worker_jobs').select('id').eq('workspace_id',c.workspaceId).eq('topic_id',topic.id).eq('job_type','sync_connector').in('state',['queued','running']).limit(1);
 if(pendingError)return Response.json({error:'Queue unavailable.'},{status:503});
 if(pending?.length)return Response.json({status:'already_queued'},{status:202});
 const jobs=connectors.map(connector=>({workspace_id:c.workspaceId,topic_id:topic.id,job_type:'sync_connector',payload:{connector_id:connector.id}}));
 const {error:queueError}=await admin.from('worker_jobs').insert(jobs);
 if(queueError)return Response.json({error:'Queue unavailable.'},{status:503});
 await admin.from('audit_logs').insert({workspace_id:c.workspaceId,actor_id:c.user.id,action:'ingestion.queued',resource_type:'topic',resource_id:topic.id,details:{connectors:connectors.length}});
 return Response.json({status:'queued',connectors:connectors.length},{status:202});
}
