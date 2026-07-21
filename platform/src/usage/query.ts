import { supabase } from "../db/client.js";

export type UsageSummaryRow = {
    provider: string;
    calls: number;
    promptTokens: number;
    completionTokens: number;
    costEstimateUsd: number;
};

/**
 * Per-provider totals for a tenant over the last N days. Aggregated in
 * application code rather than a SQL view — the row volume per tenant is
 * small enough in Phase 2 that this is simpler than maintaining a
 * materialized view, and easy to swap out later if that changes.
 */
export async function getUsageSummary(
    tenantId: string,
    days = 30
): Promise<UsageSummaryRow[]> {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    const { data, error } = await supabase
        .from("usage_events")
        .select("provider, prompt_tokens, completion_tokens, cost_estimate_usd")
        .eq("tenant_id", tenantId)
        .gte("created_at", since);

    if (error) throw error;

    const totals = new Map<string, UsageSummaryRow>();

    for (const row of data ?? []) {
        const key = row.provider;
        const entry = totals.get(key) ?? {
            provider: key,
            calls: 0,
            promptTokens: 0,
            completionTokens: 0,
            costEstimateUsd: 0
        };

        entry.calls += 1;
        entry.promptTokens += row.prompt_tokens ?? 0;
        entry.completionTokens += row.completion_tokens ?? 0;
        entry.costEstimateUsd += row.cost_estimate_usd ?? 0;

        totals.set(key, entry);
    }

    return [...totals.values()].sort((a, b) => b.calls - a.calls);
}
