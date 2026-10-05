create function public.get_ai_usage_spend(p_workspace_id uuid,p_month_start timestamptz)
returns table(provider text,spent_usd numeric) language sql security definer set search_path = '' as $$
  select u.provider,coalesce(sum(u.estimated_cost_usd),0)::numeric
  from public.ai_usage u
  where u.created_at>=p_month_start and (p_workspace_id is null or u.workspace_id=p_workspace_id)
  group by u.provider;
$$;
revoke all on function public.get_ai_usage_spend(uuid,timestamptz) from public,anon,authenticated;
grant execute on function public.get_ai_usage_spend(uuid,timestamptz) to service_role;
