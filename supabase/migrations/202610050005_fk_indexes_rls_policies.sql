create table public.ai_usage (
  id bigint generated always as identity primary key,
  workspace_id uuid references public.workspaces(id) on delete cascade,
  provider text not null, model text not null, purpose text not null,
  confidence numeric(5,4) not null default 0,
  prompt_tokens integer, completion_tokens integer,
  estimated_cost_usd numeric(12,8) not null default 0,
  latency_ms integer not null default 0, escalated boolean not null default false,
  status text not null check(status in ('success','failed')),
  created_at timestamptz not null default now()
);
create index ai_usage_workspace_date_idx on public.ai_usage(workspace_id,created_at desc);
create index ai_usage_provider_date_idx on public.ai_usage(provider,created_at desc);
alter table public.ai_usage enable row level security;
create policy ai_usage_admin_read on public.ai_usage for select to authenticated
  using (exists(select 1 from public.workspace_memberships m where m.workspace_id=ai_usage.workspace_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin')));
grant select on public.ai_usage to authenticated;
grant all privileges on public.ai_usage to service_role;
grant usage,select on sequence public.ai_usage_id_seq to service_role;
