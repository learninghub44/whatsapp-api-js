-- Phase 3 additions (PHASES.md #3): intent routing, flow/rules builder,
-- human handoff/escalation, templates and quick replies per tenant.
-- Apply after schema.sql and schema_phase2.sql.

-- ---------------------------------------------------------------------------
-- tenant_templates
-- Reusable canned messages a tenant can send from a flow step: a body of
-- text plus up to 3 quick-reply buttons (mirrors whatsapp-api-js's
-- ActionButtons limit of 3). Referenced by name from flow steps rather than
-- inlined, so editing a template updates every flow that uses it.
-- ---------------------------------------------------------------------------
create table if not exists tenant_templates (
    id uuid primary key default gen_random_uuid(),
    tenant_id uuid not null references tenants (id) on delete cascade,
    name text not null,
    body text not null,
    -- [{ "id": "yes", "title": "Yes" }, ...] — 0 to 3 entries.
    quick_replies jsonb not null default '[]'::jsonb,
    created_at timestamptz not null default now(),
    unique (tenant_id, name)
);

create index if not exists idx_tenant_templates_tenant_id
    on tenant_templates (tenant_id);

-- ---------------------------------------------------------------------------
-- tenant_flows
-- The rules builder: "when an incoming message matches this trigger, run
-- these steps." Kept intentionally simple (keyword match, not NLU) per
-- PHASES.md #3 ("simple flow/rules builder"). `steps` is an ordered JSONB
-- array; see platform/src/flows/types.ts for the step shapes understood by
-- the engine. `priority` breaks ties when multiple flows could match
-- (lowest wins); `trigger_type = 'default'` marks the tenant's fallback
-- flow, tried only when no keyword flow matches and before falling back to
-- the Phase 1/2 AI router.
-- ---------------------------------------------------------------------------
create table if not exists tenant_flows (
    id uuid primary key default gen_random_uuid(),
    tenant_id uuid not null references tenants (id) on delete cascade,
    name text not null,
    trigger_type text not null default 'keyword' check (trigger_type in ('keyword', 'default')),
    -- One or more keywords/phrases, matched case-insensitively against the
    -- whole incoming message. Null/empty for trigger_type = 'default'.
    trigger_keywords text[],
    steps jsonb not null default '[]'::jsonb,
    priority int not null default 0,
    enabled boolean not null default true,
    created_at timestamptz not null default now(),
    unique (tenant_id, name)
);

create index if not exists idx_tenant_flows_tenant_id
    on tenant_flows (tenant_id, priority);

-- ---------------------------------------------------------------------------
-- conversation_state
-- One row per (tenant, wa_id): is this conversation currently run by the
-- bot or has it been handed off to a human, and if a flow is mid-run, where
-- in it are we. Separate from conversation_messages (which is just chat
-- history/context) because this is control state, not transcript.
-- ---------------------------------------------------------------------------
create table if not exists conversation_state (
    tenant_id uuid not null references tenants (id) on delete cascade,
    wa_id text not null,
    mode text not null default 'bot' check (mode in ('bot', 'human')),
    active_flow_id uuid references tenant_flows (id) on delete set null,
    step_index int not null default 0,
    -- Values captured by "ask" steps (e.g. { "name": "Jane" }), interpolated
    -- into later step text as {{name}}.
    vars jsonb not null default '{}'::jsonb,
    handoff_reason text,
    handoff_at timestamptz,
    updated_at timestamptz not null default now(),
    primary key (tenant_id, wa_id)
);

create index if not exists idx_conversation_state_tenant_mode
    on conversation_state (tenant_id, mode);

alter table tenant_templates enable row level security;
alter table tenant_flows enable row level security;
alter table conversation_state enable row level security;

-- No self-serve policies yet, consistent with schema.sql: dashboard access
-- goes through the backend's service_role-backed /api/* endpoints, not
-- direct table reads.
