-- RIZPRAM Intelligence: apply only to the dedicated intel project.
create extension if not exists pgcrypto;
create extension if not exists vector with schema extensions;

create type public.workspace_role as enum ('owner','admin','analyst','viewer');
create type public.connector_state as enum ('disconnected','connected','degraded','paused');
create type public.alert_severity as enum ('info','watch','high','critical');

create table public.workspaces (
  id uuid primary key default gen_random_uuid(), name text not null,
  slug text not null unique, settings jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create table public.workspace_memberships (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.workspace_role not null default 'viewer',
  created_at timestamptz not null default now(), primary key(workspace_id,user_id)
);
create table public.monitoring_topics (
  id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null, description text, query jsonb not null default '{}', languages text[] not null default '{id,en}',
  is_active boolean not null default true, demo_mode boolean not null default false,
  created_by uuid references auth.users(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.connectors (
  id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id) on delete cascade,
  provider text not null, display_name text not null, state public.connector_state not null default 'disconnected',
  auth_ref text, capabilities jsonb not null default '{}', last_sync_at timestamptz, last_error text,
  config jsonb not null default '{}', created_at timestamptz not null default now(), unique(workspace_id,provider)
);
create table public.conversations (
  id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id) on delete cascade,
  topic_id uuid not null references public.monitoring_topics(id) on delete cascade,
  connector_id uuid references public.connectors(id) on delete set null,
  external_id text not null, source text not null, canonical_url text, author_id text, author_name text,
  author_handle text, author_followers bigint not null default 0, content text not null,
  language text, published_at timestamptz not null, captured_at timestamptz not null default now(),
  reach bigint not null default 0, engagement bigint not null default 0, parent_external_id text,
  raw_payload jsonb not null default '{}', created_at timestamptz not null default now(),
  unique(connector_id,external_id)
);
create index conversations_topic_time_idx on public.conversations(topic_id,published_at desc);
create index conversations_workspace_source_time_idx on public.conversations(workspace_id,source,published_at desc);
create table public.conversation_analyses (
  conversation_id uuid primary key references public.conversations(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  sentiment text not null check (sentiment in ('positive','neutral','negative','mixed')),
  sentiment_score numeric(5,4) not null default 0, emotions jsonb not null default '{}',
  stance text, intent text, language text, entities jsonb not null default '[]',
  model_provider text, model_name text, analyzed_at timestamptz not null default now()
);
create table public.narratives (
  id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id) on delete cascade,
  topic_id uuid not null references public.monitoring_topics(id) on delete cascade,
  title text not null, summary text, keywords text[] not null default '{}',
  sentiment text, post_count integer not null default 0, share numeric(6,3) not null default 0,
  velocity numeric(8,3) not null default 0, risk_score numeric(5,2) not null default 0,
  first_seen_at timestamptz not null default now(), last_seen_at timestamptz not null default now(),
  centroid extensions.vector(1536), metadata jsonb not null default '{}', unique(topic_id,title)
);
create table public.narrative_conversations (
  narrative_id uuid not null references public.narratives(id) on delete cascade,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  confidence numeric(5,4), primary key(narrative_id,conversation_id)
);
create table public.entities (
  id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id) on delete cascade,
  canonical_name text not null, entity_type text not null, aliases text[] not null default '{}', metadata jsonb not null default '{}',
  unique(workspace_id,canonical_name,entity_type)
);
create table public.influencer_profiles (
  id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id) on delete cascade,
  source text not null, external_profile_id text not null, display_name text, handle text,
  profile_url text, follower_count bigint not null default 0, engagement_rate numeric(8,4),
  influence_score numeric(6,2) not null default 0, topics text[] not null default '{}',
  last_seen_at timestamptz, metadata jsonb not null default '{}',
  unique(workspace_id,source,external_profile_id)
);
create table public.topic_metrics_hourly (
  id bigint generated always as identity primary key, workspace_id uuid not null references public.workspaces(id) on delete cascade,
  topic_id uuid not null references public.monitoring_topics(id) on delete cascade, bucket_at timestamptz not null,
  mention_count integer not null default 0, positive_count integer not null default 0,
  neutral_count integer not null default 0, negative_count integer not null default 0,
  potential_reach bigint not null default 0, source_breakdown jsonb not null default '{}',
  unique(topic_id,bucket_at)
);
create table public.conversation_entities (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  entity_id uuid not null references public.entities(id) on delete cascade,
  mention_count integer not null default 1, primary key(conversation_id,entity_id)
);
create table public.propagation_edges (
  id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id) on delete cascade,
  topic_id uuid not null references public.monitoring_topics(id) on delete cascade,
  from_author_id text not null, to_author_id text not null, conversation_id uuid references public.conversations(id) on delete set null,
  edge_type text not null, occurred_at timestamptz not null, weight numeric(8,3) not null default 1, metadata jsonb not null default '{}'
);
create table public.alert_rules (
  id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id) on delete cascade,
  topic_id uuid references public.monitoring_topics(id) on delete cascade, name text not null,
  rule jsonb not null, severity public.alert_severity not null default 'watch', is_enabled boolean not null default true,
  created_by uuid references auth.users(id), created_at timestamptz not null default now()
);
create table public.alert_events (
  id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id) on delete cascade,
  rule_id uuid references public.alert_rules(id) on delete set null, topic_id uuid references public.monitoring_topics(id) on delete cascade,
  title text not null, summary text, severity public.alert_severity not null,
  fingerprint text, evidence_conversation_ids uuid[] not null default '{}', status text not null default 'open',
  triggered_at timestamptz not null default now(), resolved_at timestamptz
);
create table public.reports (
  id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id) on delete cascade,
  topic_id uuid references public.monitoring_topics(id) on delete set null, title text not null,
  format text not null default 'pdf', status text not null default 'queued',
  schedule jsonb, content jsonb not null default '{}', created_by uuid references auth.users(id), created_at timestamptz not null default now()
);
create table public.ai_providers (
  id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null, base_url text not null, model text not null, secret_ref text,
  is_default boolean not null default false, enabled boolean not null default true, settings jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create table public.ai_usage (
  id bigint generated always as identity primary key,
  workspace_id uuid references public.workspaces(id) on delete cascade,
  provider text not null, model text not null, purpose text not null,
  confidence numeric(5,4) not null default 0,
  prompt_tokens integer, completion_tokens integer,
  estimated_cost_usd numeric(12,8) not null default 0,
  latency_ms integer not null default 0, escalated boolean not null default false,
  status text not null check(status in ('success','failed')), error_status text,
  created_at timestamptz not null default now()
);
create index ai_usage_workspace_date_idx on public.ai_usage(workspace_id,created_at desc);
create index ai_usage_provider_date_idx on public.ai_usage(provider,created_at desc);
create function public.get_ai_usage_spend(p_workspace_id uuid,p_month_start timestamptz)
returns table(provider text,spent_usd numeric) language sql security definer set search_path = '' as $$
  select u.provider,coalesce(sum(u.estimated_cost_usd),0)::numeric
  from public.ai_usage u
  where u.created_at>=p_month_start and (p_workspace_id is null or u.workspace_id=p_workspace_id)
  group by u.provider;
$$;
revoke all on function public.get_ai_usage_spend(uuid,timestamptz) from public,anon,authenticated;
grant execute on function public.get_ai_usage_spend(uuid,timestamptz) to service_role;
create table public.audit_logs (
  id bigint generated always as identity primary key, workspace_id uuid not null references public.workspaces(id) on delete cascade,
  actor_id uuid references auth.users(id), action text not null, resource_type text not null, resource_id text,
  details jsonb not null default '{}', ip inet, created_at timestamptz not null default now()
);
create table public.worker_jobs (
  id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id) on delete cascade,
  topic_id uuid references public.monitoring_topics(id) on delete cascade, job_type text not null, payload jsonb not null default '{}',
  state text not null default 'queued' check(state in ('queued','running','done','failed')),
  attempts integer not null default 0, available_at timestamptz not null default now(), locked_at timestamptz,
  last_error text, created_at timestamptz not null default now()
);
create table public.service_heartbeats (
  service_name text primary key, instance_id text not null,
  last_seen_at timestamptz not null default now()
);
create unique index ai_providers_workspace_name_uidx on public.ai_providers(workspace_id,name);
create table public.ai_provider_credentials (
  provider_id uuid primary key references public.ai_providers(id) on delete cascade,
  ciphertext text not null, updated_at timestamptz not null default now()
);
create table public.ai_provider_health (
  provider_id uuid primary key references public.ai_providers(id) on delete cascade,
  status text not null default 'unknown' check(status in ('unknown','healthy','degraded','unhealthy')),
  latency_ms integer, error_status text, checked_at timestamptz, models_synced_at timestamptz
);
create table public.ai_models (
  id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id) on delete cascade,
  provider_key text not null, model_id text not null, display_name text not null,
  enabled boolean not null default false, is_free boolean not null default false,
  capabilities jsonb not null default '[]', context_window integer,
  supports_vision boolean not null default false, supports_structured_output boolean not null default false,
  health text not null default 'unknown' check(health in ('unknown','healthy','degraded','unhealthy')),
  latency_ms integer, usage_count bigint not null default 0, estimated_cost_usd numeric(14,8) not null default 0,
  input_usd_per_million numeric(12,6), output_usd_per_million numeric(12,6), error_count bigint not null default 0,
  suitability_score numeric(5,2) not null default 0, recommended boolean not null default false,
  recommendation_reason text, last_synced_at timestamptz not null default now(),
  unique(workspace_id,provider_key,model_id)
);
create index ai_models_enabled_idx on public.ai_models(workspace_id,enabled,provider_key);
create table public.ai_task_routes (
  id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id) on delete cascade,
  task_key text not null, label text not null, enabled boolean not null default true,
  preset text not null default 'ZERO COST' check(preset in ('ZERO COST','FAST','BALANCED','MAXIMUM ACCURACY','CRISIS MODE','CUSTOM')),
  primary_model text not null default 'AUTO', fallback_model text not null default 'AUTO',
  second_opinion_model text not null default 'AUTO', judge_model text not null default 'AUTO',
  recommended_model text not null default 'openrouter::openrouter/free',
  confidence_threshold numeric(4,3) not null default 0.72 check(confidence_threshold between 0 and 1),
  escalation_rules jsonb not null default '["confidence_below","sarcasm","conflicting_classifications","high_impact_author","high_engagement","rapid_velocity","crisis_mention"]',
  consensus_enabled boolean not null default false,
  updated_at timestamptz not null default now(), unique(workspace_id,task_key)
);
create index ai_task_routes_workspace_idx on public.ai_task_routes(workspace_id,task_key);
create function public.record_ai_model_result(p_workspace_id uuid,p_provider_key text,p_model_id text,p_success boolean,p_latency_ms integer,p_cost numeric)
returns void language sql set search_path = '' as $$
  update public.ai_models set
    usage_count=usage_count+1,
    error_count=error_count+case when p_success then 0 else 1 end,
    estimated_cost_usd=estimated_cost_usd+greatest(0,p_cost),
    latency_ms=case when p_success then case when usage_count=0 then p_latency_ms else round((latency_ms*usage_count+p_latency_ms)/(usage_count+1))::integer end else latency_ms end,
    health=case when p_success then 'healthy' else 'degraded' end
  where workspace_id=p_workspace_id and provider_key=p_provider_key and model_id=p_model_id;
$$;
revoke all on function public.record_ai_model_result(uuid,text,text,boolean,integer,numeric) from public,anon,authenticated;
grant execute on function public.record_ai_model_result(uuid,text,text,boolean,integer,numeric) to service_role;
create index ai_providers_workspace_id_idx on public.ai_providers(workspace_id);
create index alert_events_rule_id_idx on public.alert_events(rule_id);
create index alert_events_workspace_id_idx on public.alert_events(workspace_id);
create index alert_rules_created_by_idx on public.alert_rules(created_by);
create index alert_rules_topic_id_idx on public.alert_rules(topic_id);
create index alert_rules_workspace_id_idx on public.alert_rules(workspace_id);
create index audit_logs_actor_id_idx on public.audit_logs(actor_id);
create index audit_logs_workspace_id_idx on public.audit_logs(workspace_id);
create index conversation_analyses_workspace_id_idx on public.conversation_analyses(workspace_id);
create index conversation_entities_entity_id_idx on public.conversation_entities(entity_id);
create index monitoring_topics_created_by_idx on public.monitoring_topics(created_by);
create index monitoring_topics_workspace_id_idx on public.monitoring_topics(workspace_id);
create index narrative_conversations_conversation_id_idx on public.narrative_conversations(conversation_id);
create index narratives_workspace_id_idx on public.narratives(workspace_id);
create index propagation_edges_conversation_id_idx on public.propagation_edges(conversation_id);
create index propagation_edges_topic_id_idx on public.propagation_edges(topic_id);
create index propagation_edges_workspace_id_idx on public.propagation_edges(workspace_id);
create index reports_created_by_idx on public.reports(created_by);
create index reports_topic_id_idx on public.reports(topic_id);
create index reports_workspace_id_idx on public.reports(workspace_id);
create index topic_metrics_hourly_workspace_id_idx on public.topic_metrics_hourly(workspace_id);
create index worker_jobs_topic_id_idx on public.worker_jobs(topic_id);
create index worker_jobs_workspace_id_idx on public.worker_jobs(workspace_id);
create index workspace_memberships_user_id_idx on public.workspace_memberships(user_id);
create index worker_jobs_queue_idx on public.worker_jobs(state,available_at) where state in ('queued','failed');
create unique index alert_events_topic_fingerprint_idx on public.alert_events(topic_id,fingerprint) where fingerprint is not null;

create function public.claim_worker_job() returns setof public.worker_jobs language sql security invoker set search_path = '' as $$
  with next_job as (
    select id from public.worker_jobs where state in ('queued','failed') and available_at <= now() and attempts < 8
    order by available_at,created_at for update skip locked limit 1
  )
  update public.worker_jobs j set state='running', attempts=j.attempts+1, locked_at=now()
  from next_job where j.id=next_job.id returning j.*;
$$;

alter table public.workspaces enable row level security;
alter table public.workspace_memberships enable row level security;
alter table public.monitoring_topics enable row level security;
alter table public.connectors enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_analyses enable row level security;
alter table public.narratives enable row level security;
alter table public.narrative_conversations enable row level security;
alter table public.entities enable row level security;
alter table public.influencer_profiles enable row level security;
alter table public.topic_metrics_hourly enable row level security;
alter table public.conversation_entities enable row level security;
alter table public.propagation_edges enable row level security;
alter table public.alert_rules enable row level security;
alter table public.alert_events enable row level security;
alter table public.reports enable row level security;
alter table public.ai_providers enable row level security;
alter table public.ai_usage enable row level security;
alter table public.audit_logs enable row level security;
alter table public.worker_jobs enable row level security;
alter table public.service_heartbeats enable row level security;
alter table public.ai_provider_credentials enable row level security;
alter table public.ai_provider_health enable row level security;
alter table public.ai_models enable row level security;
alter table public.ai_task_routes enable row level security;
create policy service_heartbeat_service_role on public.service_heartbeats for all to service_role using (true) with check (true);
create policy ai_provider_credentials_service_role on public.ai_provider_credentials for all to service_role using (true) with check (true);
create policy ai_provider_health_admin_read on public.ai_provider_health for select to authenticated using (exists(select 1 from public.ai_providers p join public.workspace_memberships m on m.workspace_id=p.workspace_id where p.id=ai_provider_health.provider_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin')));
create policy ai_provider_health_service_role on public.ai_provider_health for all to service_role using (true) with check (true);
create policy ai_models_member_read on public.ai_models for select to authenticated using (exists(select 1 from public.workspace_memberships m where m.workspace_id=ai_models.workspace_id and m.user_id=(select auth.uid())));
create policy ai_models_admin_insert on public.ai_models for insert to authenticated with check (exists(select 1 from public.workspace_memberships m where m.workspace_id=ai_models.workspace_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin')));
create policy ai_models_admin_update on public.ai_models for update to authenticated using (exists(select 1 from public.workspace_memberships m where m.workspace_id=ai_models.workspace_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin'))) with check (exists(select 1 from public.workspace_memberships m where m.workspace_id=ai_models.workspace_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin')));
create policy ai_models_admin_delete on public.ai_models for delete to authenticated using (exists(select 1 from public.workspace_memberships m where m.workspace_id=ai_models.workspace_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin')));
create policy ai_task_routes_member_read on public.ai_task_routes for select to authenticated using (exists(select 1 from public.workspace_memberships m where m.workspace_id=ai_task_routes.workspace_id and m.user_id=(select auth.uid())));
create policy ai_task_routes_admin_insert on public.ai_task_routes for insert to authenticated with check (exists(select 1 from public.workspace_memberships m where m.workspace_id=ai_task_routes.workspace_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin')));
create policy ai_task_routes_admin_update on public.ai_task_routes for update to authenticated using (exists(select 1 from public.workspace_memberships m where m.workspace_id=ai_task_routes.workspace_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin'))) with check (exists(select 1 from public.workspace_memberships m where m.workspace_id=ai_task_routes.workspace_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin')));
create policy ai_task_routes_admin_delete on public.ai_task_routes for delete to authenticated using (exists(select 1 from public.workspace_memberships m where m.workspace_id=ai_task_routes.workspace_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin')));

create policy membership_self_read on public.workspace_memberships for select to authenticated using (user_id=(select auth.uid()));
create policy workspace_member_read on public.workspaces for select to authenticated using (exists(select 1 from public.workspace_memberships m where m.workspace_id=id and m.user_id=(select auth.uid())));
create policy topic_member_read on public.monitoring_topics for select to authenticated using (exists(select 1 from public.workspace_memberships m where m.workspace_id=monitoring_topics.workspace_id and m.user_id=(select auth.uid())));
create policy topic_analyst_insert on public.monitoring_topics for insert to authenticated with check (exists(select 1 from public.workspace_memberships m where m.workspace_id=monitoring_topics.workspace_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin','analyst')));
create policy topic_analyst_update on public.monitoring_topics for update to authenticated using (exists(select 1 from public.workspace_memberships m where m.workspace_id=monitoring_topics.workspace_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin','analyst'))) with check (exists(select 1 from public.workspace_memberships m where m.workspace_id=monitoring_topics.workspace_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin','analyst')));
create policy topic_analyst_delete on public.monitoring_topics for delete to authenticated using (exists(select 1 from public.workspace_memberships m where m.workspace_id=monitoring_topics.workspace_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin','analyst')));
create policy connector_member_read on public.connectors for select to authenticated using (exists(select 1 from public.workspace_memberships m where m.workspace_id=connectors.workspace_id and m.user_id=(select auth.uid())));
create policy connector_admin_insert on public.connectors for insert to authenticated with check (exists(select 1 from public.workspace_memberships m where m.workspace_id=connectors.workspace_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin')));
create policy connector_admin_update on public.connectors for update to authenticated using (exists(select 1 from public.workspace_memberships m where m.workspace_id=connectors.workspace_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin'))) with check (exists(select 1 from public.workspace_memberships m where m.workspace_id=connectors.workspace_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin')));
create policy connector_admin_delete on public.connectors for delete to authenticated using (exists(select 1 from public.workspace_memberships m where m.workspace_id=connectors.workspace_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin')));
create policy conversation_member_read on public.conversations for select to authenticated using (exists(select 1 from public.workspace_memberships m where m.workspace_id=conversations.workspace_id and m.user_id=(select auth.uid())));
create policy analysis_member_read on public.conversation_analyses for select to authenticated using (exists(select 1 from public.workspace_memberships m where m.workspace_id=conversation_analyses.workspace_id and m.user_id=(select auth.uid())));
create policy narrative_member_read on public.narratives for select to authenticated using (exists(select 1 from public.workspace_memberships m where m.workspace_id=narratives.workspace_id and m.user_id=(select auth.uid())));
create policy narrative_link_member_read on public.narrative_conversations for select to authenticated using (exists(select 1 from public.narratives n join public.workspace_memberships m on m.workspace_id=n.workspace_id where n.id=narrative_conversations.narrative_id and m.user_id=(select auth.uid())));
create policy entity_member_read on public.entities for select to authenticated using (exists(select 1 from public.workspace_memberships m where m.workspace_id=entities.workspace_id and m.user_id=(select auth.uid())));
create policy influencer_member_read on public.influencer_profiles for select to authenticated using (exists(select 1 from public.workspace_memberships m where m.workspace_id=influencer_profiles.workspace_id and m.user_id=(select auth.uid())));
create policy topic_metrics_member_read on public.topic_metrics_hourly for select to authenticated using (exists(select 1 from public.workspace_memberships m where m.workspace_id=topic_metrics_hourly.workspace_id and m.user_id=(select auth.uid())));
create policy conversation_entity_member_read on public.conversation_entities for select to authenticated using (exists(select 1 from public.conversations c join public.workspace_memberships m on m.workspace_id=c.workspace_id where c.id=conversation_entities.conversation_id and m.user_id=(select auth.uid())));
create policy propagation_member_read on public.propagation_edges for select to authenticated using (exists(select 1 from public.workspace_memberships m where m.workspace_id=propagation_edges.workspace_id and m.user_id=(select auth.uid())));
create policy alert_rule_member_read on public.alert_rules for select to authenticated using (exists(select 1 from public.workspace_memberships m where m.workspace_id=alert_rules.workspace_id and m.user_id=(select auth.uid())));
create policy alert_rule_analyst_insert on public.alert_rules for insert to authenticated with check (exists(select 1 from public.workspace_memberships m where m.workspace_id=alert_rules.workspace_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin','analyst')));
create policy alert_rule_analyst_update on public.alert_rules for update to authenticated using (exists(select 1 from public.workspace_memberships m where m.workspace_id=alert_rules.workspace_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin','analyst'))) with check (exists(select 1 from public.workspace_memberships m where m.workspace_id=alert_rules.workspace_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin','analyst')));
create policy alert_rule_analyst_delete on public.alert_rules for delete to authenticated using (exists(select 1 from public.workspace_memberships m where m.workspace_id=alert_rules.workspace_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin','analyst')));
create policy alert_event_member_read on public.alert_events for select to authenticated using (exists(select 1 from public.workspace_memberships m where m.workspace_id=alert_events.workspace_id and m.user_id=(select auth.uid())));
create policy alert_event_analyst_write on public.alert_events for update to authenticated using (exists(select 1 from public.workspace_memberships m where m.workspace_id=alert_events.workspace_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin','analyst'))) with check (exists(select 1 from public.workspace_memberships m where m.workspace_id=alert_events.workspace_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin','analyst')));
create policy report_member_read on public.reports for select to authenticated using (exists(select 1 from public.workspace_memberships m where m.workspace_id=reports.workspace_id and m.user_id=(select auth.uid())));
create policy report_analyst_insert on public.reports for insert to authenticated with check (exists(select 1 from public.workspace_memberships m where m.workspace_id=reports.workspace_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin','analyst')));
create policy ai_provider_admin_access on public.ai_providers for all to authenticated using (exists(select 1 from public.workspace_memberships m where m.workspace_id=ai_providers.workspace_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin'))) with check (exists(select 1 from public.workspace_memberships m where m.workspace_id=ai_providers.workspace_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin')));
create policy ai_usage_admin_read on public.ai_usage for select to authenticated using (exists(select 1 from public.workspace_memberships m where m.workspace_id=ai_usage.workspace_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin')));
grant select on public.ai_provider_health to authenticated;
grant select,insert,update,delete on public.ai_models,public.ai_task_routes to authenticated;
grant all privileges on public.ai_provider_credentials,public.ai_provider_health,public.ai_models,public.ai_task_routes to service_role;
create policy audit_admin_read on public.audit_logs for select to authenticated using (exists(select 1 from public.workspace_memberships m where m.workspace_id=audit_logs.workspace_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin')));
create policy jobs_admin_read on public.worker_jobs for select to authenticated using (exists(select 1 from public.workspace_memberships m where m.workspace_id=worker_jobs.workspace_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin')));
create policy report_job_enqueue on public.worker_jobs for insert to authenticated with check (job_type='generate_report' and exists(select 1 from public.workspace_memberships m where m.workspace_id=worker_jobs.workspace_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin','analyst')));

revoke all on function public.claim_worker_job() from public,anon,authenticated;
grant execute on function public.claim_worker_job() to service_role;
grant usage on schema public to authenticated;
grant select on public.workspaces,public.workspace_memberships,public.monitoring_topics,public.connectors,public.conversations,public.conversation_analyses,public.narratives,public.narrative_conversations,public.entities,public.influencer_profiles,public.topic_metrics_hourly,public.conversation_entities,public.propagation_edges,public.alert_rules,public.alert_events,public.reports,public.ai_providers,public.ai_usage,public.audit_logs,public.worker_jobs to authenticated;
grant insert,update,delete on public.monitoring_topics,public.connectors,public.narratives,public.alert_rules,public.alert_events,public.ai_providers to authenticated;
grant insert on public.reports,public.worker_jobs to authenticated;
grant all privileges on all tables in schema public to service_role;
grant usage,select on all sequences in schema public to service_role;
