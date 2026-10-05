alter table public.ai_usage add column if not exists error_status text;
alter table public.ai_models add column if not exists input_usd_per_million numeric(12,6);
alter table public.ai_models add column if not exists output_usd_per_million numeric(12,6);
alter table public.ai_models add column if not exists error_count bigint not null default 0;

create or replace function public.record_ai_model_result(p_workspace_id uuid,p_provider_key text,p_model_id text,p_success boolean,p_latency_ms integer,p_cost numeric)
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
