# RIZPRAM Intelligence Ultimate

Standalone Next.js social and narrative intelligence workspace intended for `intel.rizpram.cloud`. It uses a dedicated Supabase project, one web container, and one independently restartable ingestion worker. It does not share app or database configuration with the existing Rizpram sites.

## Current state

- `DEMO_MODE=true` renders the synthetic preview. With `DEMO_MODE=false`, the dashboard reads authorized workspace data through `/api/workspace`, supports topic creation/selection, conversation search/filter/export, narratives, entities, observed engagement rankings, recorded network edges with timeline playback, alerts, JSON reports, audit logs and source-grounded AI answers. Seeded demo topics remain prominently labeled. Collected-data views are limited to 500 recent rows; no claim of complete platform coverage is made.
- Source connectors are modular authorized-API adapter shells. They require provider OAuth credentials and official API endpoints; there is no scraping or credential collection from end users.
- AI calls use a server-side free-first router: OpenRouter's `openrouter/free` by default, confidence-based direct-provider escalation, optional multi-model judging, and a custom OpenAI-compatible provider. Only `OPENROUTER_API_KEY` is needed initially; every direct provider and consensus is off by default. Paid providers require explicit per-provider enablement, configured token rates, a provider cap, and a global monthly cap. The `ai_usage` ledger records usage and estimated costs.
- Database schema includes tenant scope, RBAC, RLS, audit, alerts, narrative clusters, entities, propagation edges, reports, AI provider settings, and a worker queue.
- `supabase/seed.sql` seeds a synthetic RIZPRAM Brand Health topic; URLs use the reserved `.invalid` domain.

## Run locally

1. Install Node.js 22 or newer and copy `.env.example` to `.env.local`.
2. Set `DEMO_MODE=true` to preview without authentication or a connected database.
3. Run `pnpm install --frozen-lockfile`, then `pnpm dev`.

For production, set `DEMO_MODE=false`, configure the dedicated Supabase project URL and publishable key, then create workspace users through Supabase Auth. Add the first user to the seeded workspace with `insert into public.workspace_memberships(workspace_id,user_id,role) values ('10000000-0000-4000-8000-000000000001','<auth user uuid>','owner');`. Never expose `SUPABASE_SERVICE_ROLE_KEY` to browser code. The publishable URL/key are passed as Docker build arguments; all secret keys remain runtime-only.

AI provider credentials entered in the Control Center are encrypted with AES-256-GCM before they are stored in the isolated database. Configure `AI_CREDENTIAL_ENCRYPTION_KEY` as a runtime-only secret containing base64 for 32 cryptographically random bytes (for example, generate with `openssl rand -base64 32`). Keep this key in the VPS secret store and back it up separately; rotating it requires re-encrypting stored provider credentials. `AI_ALLOW_PAID_PROVIDERS=false` and `AI_MONTHLY_BUDGET_USD=0` are the safe defaults; direct-provider calls remain blocked until the server guard, provider switch, per-provider cap, and model token rates are all configured.

## Database

For a fresh environment, apply the current complete `supabase/schema.sql` once, then `supabase/seed.sql`. The isolated production project already has the schema, AI usage ledger, spend RPC, worker heartbeat, and synthetic seed. Do not apply these to the existing `rizpram-hq` project. The application enables `pgvector` in Supabase's `extensions` schema for narrative embeddings.

## Standalone VPS deployment

The compose project name is `rizpram-intelligence`; the web container binds only to `127.0.0.1:3210` and the worker is a separate service. Set secrets in a root-readable `.env` file and keep it out of source control. Use a separate directory such as `/opt/rizpram-intelligence`.

1. Inspect the VPS, active containers, firewall, Nginx sites, and existing service ports before changing anything. Back up only the relevant Nginx configuration.
2. Copy this project to `/opt/rizpram-intelligence`, configure `.env`, then run `docker compose up -d --build` from that directory. This binds the app to localhost port 3210 under the unique compose project name `rizpram-intelligence`.
3. Add only `deploy/nginx/bootstrap-http.conf` as a new site file. Validate Nginx and reload it; leave all existing virtual hosts untouched.
4. Confirm DNS `intel.rizpram.cloud` points to the intended VPS. Issue a certificate with Certbot using the webroot `/var/www/certbot`.
5. Replace the temporary site file with `deploy/nginx/intel.rizpram.cloud.conf`, validate, reload Nginx, and verify the HTTPS health endpoint and browser dashboard.

Do not paste secrets into deployment notes or commit them. Do not alter `rizpram.cloud`, `hq.rizpram.cloud`, `affiliate.rizpram.cloud`, or `router.rizpram.cloud`.

## Verification endpoints

- `GET /api/health` verifies a live database query and reports worker heartbeat status.
- `POST /api/ask` accepts `{ "question": "..." }`; topic evidence is retrieved server-side and citations are grounded to authorized records.
- `GET /api/ai/health` checks configured provider `/models` endpoints for signed-in workspace administrators.
- Worker jobs use `claim_worker_job()` with `FOR UPDATE SKIP LOCKED`; failures retry with exponential backoff.

## Production blockers and scope

The connected Supabase project currently contains one synthetic topic and three synthetic conversations, with no workspace memberships. A user must exist in Supabase Auth and be assigned to the isolated workspace before authenticated production testing. VPS access, DNS/TLS installation and external provider credentials remain required. API adapter shells require provider-specific pagination and rate-limit implementations before large-scale ingestion. Competitor comparison, member administration, scheduled alerts, and report PDF rendering are not complete. JSON report downloads are implemented; do not describe a JSON result as a generated PDF. No production deployment has been verified in this session.

## Checks

Run `pnpm test`, `pnpm typecheck`, and `DEMO_MODE=false pnpm build`. Connector contract tests cover malformed records, host authorization and query forwarding. Worker images include shared AI source and tsconfig path resolution. Worker leases refresh during processing and expired jobs retry after 15 minutes. The public health endpoint returns HTTP 503 until both database and worker are healthy.
