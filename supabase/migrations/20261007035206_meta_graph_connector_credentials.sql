-- Store encrypted source tokens separately from connector metadata. Browser roles
-- receive no table privileges; only server-side service_role can access ciphertext.
create table public.connector_credentials (
  connector_id uuid primary key references public.connectors(id) on delete cascade,
  ciphertext text not null,
  updated_at timestamptz not null default now()
);

alter table public.connector_credentials enable row level security;
revoke all privileges on table public.connector_credentials from public, anon, authenticated;
grant all privileges on table public.connector_credentials to service_role;
