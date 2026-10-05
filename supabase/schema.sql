create table public.service_heartbeats (
  service_name text primary key, instance_id text not null,
  last_seen_at timestamptz not null default now()
);
alter table public.service_heartbeats enable row level security;
grant all privileges on public.service_heartbeats to service_role;
