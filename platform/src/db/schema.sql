-- Phase 1 multi-tenant data model (PHASES.md #1)
-- Target: Supabase / PostgreSQL. Run via the Supabase SQL editor or CLI migrations.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- tenants
-- ---------------------------------------------------------------------------
create table if not exists tenants (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    status text not null default 'active' check (status in ('active', 'paused', 'disabled')),
    created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- tenant_whatsapp_credentials
-- One WhatsAppAPI instance = one token/app-secret pair (AGENTS.md), so this
-- is 1:1 with tenants, keyed additionally by phone_number_id since that's
-- what Meta's webhook payload gives us to resolve the tenant.
-- ---------------------------------------------------------------------------
create table if not exists tenant_whatsapp_credentials (
    id uuid primary key default gen_random_uuid(),
    tenant_id uuid not null references tenants (id) on delete cascade,
    phone_number_id text not null unique,
    token text not null,
    app_secret text not null,
    webhook_verify_token text,
    created_at timestamptz not null default now(),
    unique (tenant_id)
);

create index if not exists idx_tenant_whatsapp_credentials_tenant_id
    on tenant_whatsapp_credentials (tenant_id);

-- ---------------------------------------------------------------------------
-- tenant_ai_providers
-- The ordered fallback chain per tenant. `priority` (ascending, 0 = first)
-- defines try-order; `enabled` lets a provider be disabled without deleting
-- the row (keeps history/config around).
-- ---------------------------------------------------------------------------
create table if not exists tenant_ai_providers (
    id uuid primary key default gen_random_uuid(),
    tenant_id uuid not null references tenants (id) on delete cascade,
    provider text not null check (provider in ('groq', 'openrouter', 'openai', 'anthropic')),
    api_key text not null,
    model text,
    priority int not null default 0,
    enabled boolean not null default true,
    created_at timestamptz not null default now(),
    unique (tenant_id, provider)
);

create index if not exists idx_tenant_ai_providers_tenant_id
    on tenant_ai_providers (tenant_id, priority);

-- ---------------------------------------------------------------------------
-- conversation_messages
-- Minimal per-(tenant, wa_id) short-term history for stateless-per-turn
-- chat context (PHASES.md #4). Trimmed to the last N rows in application
-- code; no flow/intent state here yet.
-- ---------------------------------------------------------------------------
create table if not exists conversation_messages (
    id uuid primary key default gen_random_uuid(),
    tenant_id uuid not null references tenants (id) on delete cascade,
    wa_id text not null,
    role text not null check (role in ('user', 'assistant')),
    content text not null,
    provider text,
    created_at timestamptz not null default now()
);

create index if not exists idx_conversation_messages_tenant_wa_id
    on conversation_messages (tenant_id, wa_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Row-level isolation by tenant_id (Supabase RLS).
-- Phase 1 has no dashboard/end-user auth yet, so these tables are only
-- touched by the backend via the service_role key, which bypasses RLS.
-- RLS is enabled up front anyway so Phase 2 (tenant self-service, scoped by
-- auth.uid()) is additive rather than a retrofit.
-- ---------------------------------------------------------------------------
alter table tenants enable row level security;
alter table tenant_whatsapp_credentials enable row level security;
alter table tenant_ai_providers enable row level security;
alter table conversation_messages enable row level security;

-- No policies are created yet: with RLS enabled and zero policies, only the
-- service_role key (used by this backend) can access these tables. Phase 2
-- adds policies scoped to auth.uid() for the tenant dashboard.
