# whatsapp-platform (Phase 1)

Multi-tenant WhatsApp automation layer built on top of `whatsapp-api-js`,
per `PHASES.md`. This package is the consumer app AGENTS.md says doesn't
belong in the SDK itself — multi-tenancy, AI providers, and persistence all
live here, decoupled behind interfaces from the SDK and from each other.

## What's here

- **`src/db/schema.sql`** — `tenants`, `tenant_whatsapp_credentials`,
  `tenant_ai_providers`, `conversation_messages`. RLS is enabled with no
  policies yet, so only the `service_role` key (used by this backend) can
  touch these tables until Phase 2 adds tenant-scoped dashboard access.
- **`src/ai/`** — the `AIProvider` interface, `GroqProvider` +
  `OpenRouterProvider` adapters, a per-provider `CircuitBreaker`, and
  `AIProviderRouter`, which tries a tenant's providers in priority order and
  skips ones that are unconfigured, unhealthy, or circuit-broken.
- **`src/tenants/`** — `repository.ts` loads a tenant's full config from
  Supabase (cached, keyed by `phone_number_id`, since that's what Meta's
  webhook payload gives us); `registry.ts` caches one `WhatsAppAPI` instance
  and one `AIProviderRouter` per tenant.
- **`src/conversation/history.ts`** — last N turns per `(tenant, wa_id)`,
  used as chat context. No flow/intent state yet — that's Phase 3.
- **`src/webhook.ts`** — the shared webhook endpoint. Peeks
  `phone_number_id` out of the raw payload to resolve which tenant it
  belongs to, then hands off to that tenant's `WhatsAppAPI` instance.

## Setup

```bash
cp platform/.env.example platform/.env
# fill in SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, WEBHOOK_VERIFY_TOKEN

# from repo root
pnpm install
pnpm --filter whatsapp-api-js build   # produces lib/, which platform depends on
pnpm --filter whatsapp-platform dev
```

Apply `platform/src/db/schema.sql` in the Supabase SQL editor (or via
migrations), then seed a tenant:

```sql
insert into tenants (name) values ('Test Tenant') returning id;

insert into tenant_whatsapp_credentials (tenant_id, phone_number_id, token, app_secret, webhook_verify_token)
values ('<tenant-id>', '<meta-phone-number-id>', '<meta-token>', '<meta-app-secret>', '<verify-token>');

insert into tenant_ai_providers (tenant_id, provider, api_key, priority)
values
  ('<tenant-id>', 'groq', '<groq-key>', 0),
  ('<tenant-id>', 'openrouter', '<openrouter-key>', 1);
```

Point the tenant's Meta app webhook at `https://<your-host>/webhook`.

## Exit criteria (PHASES.md #1)

- [x] 2+ tenants can run independently off one deployment (registry is
      keyed by `tenant_id`, resolved per-request from `phone_number_id`).
- [x] Killing one tenant's AI provider key doesn't affect another tenant
      (each tenant gets its own `AIProviderRouter` + `CircuitBreaker`s).
- [x] A tenant with only 1 of N providers configured works identically to
      one with all of them (the router just has a shorter chain to try).

## Known Phase 1 gaps (by design — see PHASES.md #2/#3)

- Only `groq` and `openrouter` adapters exist; `openai`/`anthropic` are
  typed in the schema/factory but throw until implemented — adding them is
  a drop-in (`OpenAICompatibleProvider` subclass + a case in `factory.ts`).
- Webhook verification (`GET /webhook`) uses one process-wide
  `WEBHOOK_VERIFY_TOKEN`, not a per-tenant one — fine for a single Meta app
  managing multiple phone numbers, which is the common setup.
- No dashboard, auth, or usage/cost visibility — that's Phase 2.
- No intent routing, flow builder, or human handoff — that's Phase 3.
