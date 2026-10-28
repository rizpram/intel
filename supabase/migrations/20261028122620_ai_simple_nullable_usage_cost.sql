-- Provider quota mode can run without a published price catalog.
-- NULL is an unknown cost, distinct from a verified zero-cost request.
alter table public.ai_usage alter column estimated_cost_usd drop not null;
comment on column public.ai_usage.estimated_cost_usd is 'Estimated USD when known; NULL means unavailable, not free.';
