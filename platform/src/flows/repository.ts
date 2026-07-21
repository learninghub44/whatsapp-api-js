import { supabase } from "../db/client.js";
import { env } from "../config/env.js";
import type { Flow, FlowStep, Template } from "./types.js";

type CacheEntry = {
    flows: Flow[];
    templates: Map<string, Template>;
    expiresAt: number;
};

// Keyed by tenant_id. Same TTL/cache shape as tenants/repository.ts —
// flows and templates change about as often as tenant config, and are read
// on every incoming message, so re-fetching per message would be wasteful.
const cache = new Map<string, CacheEntry>();

async function load(tenantId: string): Promise<CacheEntry> {
    const [{ data: flowRows, error: flowError }, { data: templateRows, error: templateError }] =
        await Promise.all([
            supabase
                .from("tenant_flows")
                .select(
                    "id, tenant_id, name, trigger_type, trigger_keywords, steps, priority, enabled"
                )
                .eq("tenant_id", tenantId)
                .eq("enabled", true)
                .order("priority", { ascending: true }),
            supabase
                .from("tenant_templates")
                .select("id, tenant_id, name, body, quick_replies")
                .eq("tenant_id", tenantId)
        ]);

    if (flowError) throw flowError;
    if (templateError) throw templateError;

    const flows: Flow[] = (flowRows ?? []).map((row) => ({
        id: row.id,
        tenantId: row.tenant_id,
        name: row.name,
        triggerType: row.trigger_type,
        triggerKeywords: row.trigger_keywords ?? null,
        steps: (row.steps ?? []) as FlowStep[],
        priority: row.priority,
        enabled: row.enabled
    }));

    const templates = new Map<string, Template>();
    for (const row of templateRows ?? []) {
        templates.set(row.name, {
            id: row.id,
            tenantId: row.tenant_id,
            name: row.name,
            body: row.body,
            quickReplies: row.quick_replies ?? []
        });
    }

    const entry: CacheEntry = {
        flows,
        templates,
        expiresAt: Date.now() + env.tenantCacheTtlMs
    };
    cache.set(tenantId, entry);
    return entry;
}

async function getEntry(tenantId: string): Promise<CacheEntry> {
    const cached = cache.get(tenantId);
    if (cached && cached.expiresAt > Date.now()) {
        return cached;
    }
    return load(tenantId);
}

export async function getTenantFlows(tenantId: string): Promise<Flow[]> {
    return (await getEntry(tenantId)).flows;
}

export async function getFlowById(
    tenantId: string,
    flowId: string
): Promise<Flow | null> {
    const { flows } = await getEntry(tenantId);
    return flows.find((f) => f.id === flowId) ?? null;
}

export async function getTemplate(
    tenantId: string,
    name: string
): Promise<Template | null> {
    const { templates } = await getEntry(tenantId);
    return templates.get(name) ?? null;
}

/** Drops a tenant's flows/templates from cache — call after dashboard edits. */
export function invalidateFlowCache(tenantId: string): void {
    cache.delete(tenantId);
}
