-- Phase 2 additions (PHASES.md #2): dashboard self-service + usage visibility.
-- Apply after schema.sql. Run via the Supabase SQL editor or CLI migrations.

-- ---------------------------------------------------------------------------
-- tenant_members
-- Maps Supabase Auth users (dashboard logins) to the tenants they can
-- manage. Deliberately separate from WhatsApp end-users (wa_id) — a
-- dashboard account is a business owner/admin, not a chat participant.
-- ---------------------------------------------------------------------------
create table if not exists tenant_members (
    id uuid primary key default gen_random_uuid(),
    tenant_id uuid not null references tenants (id) on delete cascade,
    user_id uuid not null references auth.users (id) on delete cascade,
    role text not null default 'owner' check (role in ('owner', 'admin')),
    created_at timestamptz not null default now(),
    unique (tenant_id, user_id)
);

create index if not exists idx_tenant_members_user_id on tenant_members (user_id);
create index if not exists idx_tenant_members_tenant_id on tenant_members (tenant_id);

alter table tenant_members enable row level security;

-- A member can see their own membership rows (used by the dashboard to list
-- "which tenants am I on"). All writes still go through the backend's
-- service_role key, which bypasses RLS — this policy is read-only self-access.
create policy "members can read their own membership rows"
    on tenant_members for select
    using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- usage_events
-- One row per AI provider call that actually served a reply. Powers the
-- dashboard's usage/cost visibility (PHASES.md #2). Token counts are
-- provider-reported when available; cost_estimate_usd is computed
-- server-side from ai/pricing.ts at write time (a snapshot, not a live
-- join, so historical costs don't shift if pricing tables change later).
-- ---------------------------------------------------------------------------
create table if not exists usage_events (
    id uuid primary key default gen_random_uuid(),
    tenant_id uuid not null references tenants (id) on delete cascade,
    provider text not null,
    model text,
    prompt_tokens int,
    completion_tokens int,
    cost_estimate_usd numeric(12, 6),
    created_at timestamptz not null default now()
);

create index if not exists idx_usage_events_tenant_created
    on usage_events (tenant_id, created_at desc);

alter table usage_events enable row level security;
-- No self-serve read policy yet: usage is surfaced through the backend's
-- aggregation endpoint (GET /api/tenants/:id/usage), not queried directly
-- by the dashboard client, so no RLS policy is needed here.
