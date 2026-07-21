import "dotenv/config";

function required(name: string): string {
    const value = process.env[name];
    if (!value) {
        throw new Error(`Missing required environment variable: ${name}`);
    }
    return value;
}

export const env = {
    port: Number(process.env.PORT ?? 3000),
    supabaseUrl: required("SUPABASE_URL"),
    // Service role key: this backend is the only thing talking to these
    // tables in Phase 1 (see schema.sql RLS notes), never expose it client-side.
    supabaseServiceRoleKey: required("SUPABASE_SERVICE_ROLE_KEY"),
    // How many consecutive failures before a tenant's provider is tripped
    // into the circuit-broken "down" state.
    circuitBreakerThreshold: Number(
        process.env.CIRCUIT_BREAKER_THRESHOLD ?? 3
    ),
    // Cooldown window (ms) before a tripped provider is retried.
    circuitBreakerCooldownMs: Number(
        process.env.CIRCUIT_BREAKER_COOLDOWN_MS ?? 60_000
    ),
    // Per-provider request timeout (ms) before treating it as a failure.
    aiRequestTimeoutMs: Number(process.env.AI_REQUEST_TIMEOUT_MS ?? 15_000),
    // How many prior turns (user+assistant messages) to include as context.
    conversationHistoryTurns: Number(
        process.env.CONVERSATION_HISTORY_TURNS ?? 8
    ),
    // TTL (ms) for the in-memory tenant lookup cache before re-hitting Supabase.
    tenantCacheTtlMs: Number(process.env.TENANT_CACHE_TTL_MS ?? 30_000)
};
