-- Clearly labeled synthetic seed. No third-party platform data is fetched.
insert into public.workspaces(id,name,slug,settings) values
('10000000-0000-4000-8000-000000000001','Rizpram Studio','rizpram-studio','{"demo":true,"timezone":"Asia/Jakarta"}') on conflict(slug) do nothing;
insert into public.monitoring_topics(id,workspace_id,name,description,query,languages,is_active,demo_mode) values
('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','RIZPRAM Brand Health','Demo monitoring topic for brand, product, service and sustainability conversation.', '{"include":["RIZPRAM","Rizpram"],"exclude":[],"notes":"Synthetic demonstration topic; connect an authorized source provider to collect real posts."}', '{id,en}', true, true) on conflict(id) do nothing;
insert into public.connectors(id,workspace_id,provider,display_name,state,capabilities,config) values
('30000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','x_api','X API (authorized)','disconnected','{"search":true,"stream":true,"requires_oauth":true}','{"demo":true}'),
('30000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000001','meta_graph','Meta Graph API (authorized)','disconnected','{"mentions":true,"requires_oauth":true}','{"demo":true}'),
('30000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000001','tiktok_business','TikTok Business API (authorized)','disconnected','{"mentions":true,"requires_oauth":true}','{"demo":true}') on conflict(workspace_id,provider) do nothing;
insert into public.conversations(id,workspace_id,topic_id,connector_id,external_id,source,canonical_url,author_id,author_name,author_handle,author_followers,content,language,published_at,reach,engagement,raw_payload) values
('40000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','demo-x-001','X / Twitter','https://example.invalid/demo/x-001','demo-user-ayu','Ayu D.','@ayudaily',24800,'DEMO: Really hoping RIZPRAM addresses the delivery delays this week. My last order took 9 days and support has not replied yet.','en',now()-interval '2 minutes',24800,326,'{"demo":true}'),
('40000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000002','demo-meta-002','Instagram','https://example.invalid/demo/meta-002','demo-user-raka','Raka Kurniawan','@rakareviews',18200,'DEMO: Unboxing the new RIZPRAM essentials. Packaging is beautiful as always, but the restock took a long time.','en',now()-interval '7 minutes',18200,214,'{"demo":true}'),
('40000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000003','demo-tt-003','TikTok','https://example.invalid/demo/tt-003','demo-user-maya','Maya N.','@mayanoor',42600,'DEMO: This brand actually listened. The refill option is a good move for sustainability.','en',now()-interval '11 minutes',42600,920,'{"demo":true}') on conflict(connector_id,external_id) do nothing;
insert into public.propagation_edges(workspace_id,topic_id,from_author_id,to_author_id,conversation_id,edge_type,occurred_at,weight,metadata) values
('10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','demo-user-ayu','demo-user-raka','40000000-0000-4000-8000-000000000002','reply',now()-interval '6 minutes',1.2,'{"demo":true}'),
('10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','demo-user-raka','demo-user-maya','40000000-0000-4000-8000-000000000003','reshare',now()-interval '10 minutes',1.5,'{"demo":true}') on conflict do nothing;
insert into public.conversation_analyses(conversation_id,workspace_id,sentiment,sentiment_score,emotions,stance,intent,language,entities,model_provider,model_name) values
('40000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','negative',-0.61,'{"frustration":0.74,"disappointment":0.55}','critical','complaint','en','[{"name":"RIZPRAM","type":"brand"}]','demo','synthetic-v1'),
('40000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000001','mixed',0.08,'{"anticipation":0.35,"frustration":0.27}','mixed','review','en','[{"name":"RIZPRAM","type":"brand"}]','demo','synthetic-v1'),
('40000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000001','positive',0.77,'{"trust":0.48,"joy":0.54}','supportive','recommendation','en','[{"name":"RIZPRAM","type":"brand"}]','demo','synthetic-v1') on conflict(conversation_id) do nothing;
insert into public.narratives(id,workspace_id,topic_id,title,summary,keywords,sentiment,post_count,share,velocity,risk_score,metadata) values
('50000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','Delivery delays & fulfillment','Synthetic demo narrative: concerns about shipping time and support response.','{"delivery delay","fulfilment","support"}','negative',1284,28,34,76,'{"demo":true}'),
('50000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','New product launch reactions','Synthetic demo narrative: reactions to a recent product launch.','{"product","launch","packaging"}','mixed',1012,22,18,32,'{"demo":true}'),
('50000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','Sustainability commitments','Synthetic demo narrative: customer discussion about refill and sourcing.','{"sustainability","refill","packaging"}','positive',786,17,12,18,'{"demo":true}') on conflict(id) do nothing;
insert into public.entities(workspace_id,canonical_name,entity_type,aliases) values
('10000000-0000-4000-8000-000000000001','RIZPRAM','brand','{"Rizpram"}'),
('10000000-0000-4000-8000-000000000001','GlowLab','brand','{"Glow Lab"}') on conflict(workspace_id,canonical_name,entity_type) do nothing;
insert into public.influencer_profiles(workspace_id,source,external_profile_id,display_name,handle,profile_url,follower_count,engagement_rate,influence_score,topics,last_seen_at,metadata) values
('10000000-0000-4000-8000-000000000001','TikTok','demo-user-maya','Maya N.','@mayanoor','https://example.invalid/demo/mayanoor',42600,0.084,84,'{"sustainability","refill"}',now(),'{}'),
('10000000-0000-4000-8000-000000000001','X / Twitter','demo-user-ayu','Ayu D.','@ayudaily','https://example.invalid/demo/ayudaily',24800,0.063,78,'{"delivery","customer care"}',now(),'{}'),
('10000000-0000-4000-8000-000000000001','Instagram','demo-user-raka','Raka Kurniawan','@rakareviews','https://example.invalid/demo/rakareviews',18200,0.071,72,'{"beauty","product reviews"}',now(),'{}') on conflict(workspace_id,source,external_profile_id) do nothing;
insert into public.conversation_entities(conversation_id,entity_id)
select c.id,e.id from public.conversations c join public.entities e on e.workspace_id=c.workspace_id and e.canonical_name='RIZPRAM'
where c.topic_id='20000000-0000-4000-8000-000000000001' on conflict do nothing;
insert into public.narrative_conversations(narrative_id,conversation_id,confidence)
select n.id,c.id,0.91 from public.narratives n join public.conversations c on c.topic_id=n.topic_id
where n.topic_id='20000000-0000-4000-8000-000000000001' and c.id in ('40000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000002','40000000-0000-4000-8000-000000000003') on conflict do nothing;
insert into public.topic_metrics_hourly(workspace_id,topic_id,bucket_at,mention_count,positive_count,neutral_count,negative_count,potential_reach,source_breakdown)
select '10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001',date_trunc('hour',now())-(g||' hours')::interval,70+((g*7)%40),35+((g*3)%14),20+((g*2)%9),15+((g*2)%11),15000+g*570,'{"X API":24,"Instagram":29,"TikTok":17,"News":12}'::jsonb
from generate_series(0,23) as series(g) on conflict(topic_id,bucket_at) do nothing;
insert into public.alert_events(id,workspace_id,topic_id,title,summary,severity,status) values
('60000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','Delivery delays gaining momentum','Synthetic demo alert: negative mentions rose 34% in a sample time window.','high','open'),
('60000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','Competitor share of voice shifted','Synthetic demo alert: competitor share changed in sample values.','watch','open') on conflict(id) do nothing;

-- Default AI control plane: one free router is enabled; direct providers and every discovered model remain opt-in.
insert into public.ai_providers(workspace_id,name,base_url,model,enabled,settings)
values ('10000000-0000-4000-8000-000000000001','openrouter','https://openrouter.ai/api/v1','openrouter/free',true,'{"display_name":"OpenRouter","default_free_model":"openrouter/free","monthly_budget_usd":0}')
on conflict(workspace_id,name) do nothing;
insert into public.ai_models(workspace_id,provider_key,model_id,display_name,enabled,is_free,capabilities,context_window,supports_structured_output,suitability_score,recommended,recommendation_reason)
values ('10000000-0000-4000-8000-000000000001','openrouter','openrouter/free','OpenRouter Free Models Router',true,true,'["text","structured_output"]',200000,true,92,true,'Recommended zero-cost route; OpenRouter selects an eligible free model for each request.')
on conflict(workspace_id,provider_key,model_id) do nothing;
insert into public.ai_task_routes(workspace_id,task_key,label,enabled,preset,primary_model,fallback_model,second_opinion_model,judge_model,recommended_model,confidence_threshold,consensus_enabled)
select '10000000-0000-4000-8000-000000000001',v.task_key,v.label,true,'ZERO COST','AUTO','AUTO','AUTO','AUTO','openrouter::openrouter/free',0.72,false
from (values
 ('sentiment','Sentiment'),('emotion','Emotion'),('stance','Stance'),('intent','Intent'),('entity_extraction','Entity Extraction'),
 ('relevance','Relevance'),('spam_noise','Spam / Noise Detection'),('sarcasm','Sarcasm Detection'),('topic_classification','Topic Classification'),
 ('narrative_clustering','Narrative Clustering'),('narrative_analysis','Narrative Analysis'),('trend_explanation','Trend Explanation'),('crisis_analysis','Crisis Analysis'),
 ('influencer_analysis','Influencer Analysis'),('multimodal_analysis','Multimodal Analysis'),('ai_analyst','AI Analyst'),('executive_summary','Executive Summary'),('report_generation','Report Generation')
) as v(task_key,label)
on conflict(workspace_id,task_key) do nothing;
