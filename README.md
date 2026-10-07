# RIZPRAM Intelligence Ultimate

Standalone Next.js social and narrative intelligence workspace intended for `intel.rizpram.cloud`. It uses a dedicated Supabase project, one web container, and one independently restartable ingestion worker. It does not share app or database configuration with the existing Rizpram sites.

## Current state

- The workspace starts empty. No synthetic posts, metrics, alerts, or seeded monitoring topics are included.
- Source connectors are modular authorized-API adapters. Meta Graph supports authorized Facebook Pages, Instagram Business/Creator accounts, and Threads accounts; other providers remain replaceable adapters. The app does not scrape platforms or perform unrestricted public keyword search.
- AI calls use a server-side free-first router: OpenRouter's `openrouter/free` by default, confidence-based direct-provider escalation, optional multi-model judging, and a custom OpenAI-compatible provider. Only `OPENROUTER_API_KEY` is needed initially; every direct provider and consensus is off by default. Paid providers require explicit per-provider enablement, configured token rates, a provider cap, and a global monthly cap. The `ai_usage` ledger records usage and estimated costs.
- Database schema includes tenant scope, RBAC, RLS, audit, alerts, narrative clusters, entities, propagation edges, reports, AI provider settings, and a worker queue.
- `supabase/seed.sql` intentionally contains no sample data. Create a workspace and owner account during setup.

## Run locally

1. Install Node.js 22 or newer and copy `.env.example` to `.env.local`.
2. Keep `DEMO_MODE=false`; authentication is required and synthetic data is not included.
3. Run `pnpm install`, then `pnpm dev`.

For production, configure the dedicated Supabase project URL and publishable key, create the first user through Supabase Auth, create a workspace, then add that user as its owner in `workspace_memberships`. Never expose `SUPABASE_SERVICE_ROLE_KEY` to browser code. The publishable URL/key are passed as Docker build arguments; all secret keys remain runtime-only.

AI provider credentials entered in the Control Center are encrypted with AES-256-GCM before they are stored in the isolated database. Configure `AI_CREDENTIAL_ENCRYPTION_KEY` as a runtime-only secret containing base64 for 32 cryptographically random bytes (for example, generate with `openssl rand -base64 32`). Keep this key in the VPS secret store and back it up separately; rotating it requires re-encrypting stored provider credentials. `AI_ALLOW_PAID_PROVIDERS=false` and `AI_MONTHLY_BUDGET_USD=0` are the safe defaults; direct-provider calls remain blocked until the server guard, provider switch, per-provider cap, and model token rates are all configured.

## Meta Graph API connector

1. Open **Connectors**, select **Meta Graph API**, and add it if it is not listed.
2. Enter the IDs and read-authorized access tokens for the Facebook Page, Instagram professional account, and/or Threads account you administer. These are independent platform credentials; only fill the accounts you want to connect.
3. Save the configuration, then use **Test connection**. Tokens are encrypted with `AI_CREDENTIAL_ENCRYPTION_KEY`; their stored values are never returned to the browser. The worker must use the same encryption key.
4. In **Topics**, select the configured source, save the monitoring topic, and choose **Sync** from Connectors.

Meta access is limited to data the app/token is permitted to read. Facebook Page posts, an authorized Instagram Business/Creator account's media, and the authorized Threads account's posts are supported. Meta app permissions and access level govern availability; this connector does not provide global listening across all public Meta content. `META_GRAPH_API_VERSION` optionally selects the Facebook/Instagram Graph API version (format `vNN.0`; default `v23.0`).

## Database

For a fresh environment, apply the current complete `supabase/schema.sql` once. `supabase/seed.sql` is intentionally empty to prevent accidental demo data. The isolated production project has the schema, AI usage ledger, spend RPC, and worker heartbeat. Do not apply these to the existing `rizpram-hq` project. The application enables `pgvector` in Supabase's `extensions` schema for narrative embeddings.

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
