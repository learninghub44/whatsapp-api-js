# PHASES.md — Roadmap for AI Agents

This file tracks the phased plan to evolve this repo from a plain
WhatsApp Cloud API SDK into a **multi-tenant WhatsApp automation
platform** with a pluggable multi-AI-provider layer. Read `AGENTS.md`
first for repo context, then this file for what to build and in what
order.

## Vision

A platform where each tenant (a business) connects their own WhatsApp
Business number and their own AI provider keys (Groq, OpenRouter,
OpenAI, Anthropic, etc.), and gets automated conversational replies.
A missing or failed AI provider for a tenant must never break that
tenant's automation — the system falls back to the next configured
provider automatically.

## Phase 1 — Core multi-tenant loop (current phase)

Goal: prove one end-to-end message loop works for multiple tenants,
each with independent WhatsApp credentials and independent AI
provider chains. No dashboard/UI yet.

### 1. Multi-tenant data model
- `tenants` table: id, name, status, created_at
- `tenant_whatsapp_credentials`: tenant_id, phone_number_id, token,
  app_secret
- `tenant_ai_providers`: tenant_id, provider name (groq / openrouter /
  openai / anthropic / etc.), api_key, priority (order in fallback
  chain), enabled flag
- Row-level isolation by `tenant_id` on every table (Supabase RLS if
  using Supabase).

### 2. AI provider abstraction layer
- Common interface, one implementation per provider:
  ```ts
  interface AIProvider {
    name: string;
    chat(messages: ChatMessage[], opts?: ChatOptions): Promise<AIResponse>;
    isHealthy(): boolean;
  }
  ```
- Adapters to build first: `GroqProvider`, `OpenRouterProvider`.
  Structure so adding `OpenAIProvider`, `AnthropicProvider`, etc.
  later is a drop-in, not a refactor.
- **Fallback router**: given a tenant's ordered provider chain, try
  provider[0]; on error, timeout, rate-limit, or missing key, skip to
  the next. A tenant with only 1 of 5 providers configured must work
  exactly the same as a tenant with all 5.
- **Circuit breaker**: after N consecutive failures, mark a provider
  "down" for a cooldown window so a dead provider isn't retried on
  every single incoming message.
- A missing API key is a configuration state, not an exception —
  never let it throw uncaught into the message-handling path.

### 3. WhatsApp per-tenant wiring
- One `WhatsAppAPI` instance per tenant (from this repo's SDK),
  constructed from that tenant's stored credentials, cached in memory
  keyed by `tenant_id`.
- Single shared webhook endpoint. Meta's payload includes
  `phone_number_id` — resolve `tenant_id` from that before doing
  anything else.
- Incoming message → resolve tenant → resolve tenant's AI provider
  chain → get reply → send via that tenant's `WhatsAppAPI` instance.

### 4. Minimal conversation state
- Per WhatsApp user (`wa_id`) per tenant: last N messages for context,
  stored server-side (not in the AI provider).
- No flow builder, no intents yet — just stateless-per-turn chat with
  short recent history for context.

### Phase 1 exit criteria
- 2+ tenants running simultaneously with different WhatsApp numbers.
- At least one tenant configured with only Groq, another with only
  OpenRouter, another with both — all three work independently.
- Manually killing/removing one tenant's provider key does not affect
  any other tenant.
- No UI required — config can be seeded directly in the DB for now.

## Phase 2 — Dashboard & tenant self-service (not started)
- Web dashboard for tenants to connect their WhatsApp number and add/
  reorder their AI provider keys themselves.
- Auth/user accounts for the dashboard (separate concern from
  WhatsApp end-users).
- Usage/cost visibility per tenant per provider.

## Phase 3 — Automation depth (in progress)
- [x] Intent routing (keyword-based) + simple flow/rules builder.
- [x] Human handoff / escalation.
- [x] Templates and quick replies per tenant.
- [x] Dashboard screens for flows/templates/escalated conversations.

## Notes for agents picking this up
- Keep the AI provider abstraction and the WhatsApp layer fully
  decoupled — the automation engine should never import a specific
  provider or `WhatsAppAPI` directly, only the interfaces.
- Favor explicit per-tenant config over global env vars for anything
  tenant-specific (keys, credentials, provider priority).
- Log which provider actually served each reply (for debugging
  fallback behavior), but never log API keys.
