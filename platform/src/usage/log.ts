import { supabase } from "../db/client.js";
import { estimateCostUsd } from "../ai/pricing.js";
import type { AIResponse } from "../ai/types.js";

export async function logUsageEvent(
    tenantId: string,
    response: AIResponse
): Promise<void> {
    const costEstimateUsd = estimateCostUsd(
        response.provider,
        response.model,
        response.usage?.promptTokens,
        response.usage?.completionTokens
    );

    const { error } = await supabase.from("usage_events").insert({
        tenant_id: tenantId,
        provider: response.provider,
        model: response.model ?? null,
        prompt_tokens: response.usage?.promptTokens ?? null,
        completion_tokens: response.usage?.completionTokens ?? null,
        cost_estimate_usd: costEstimateUsd
    });

    // Never let usage logging break the reply path — log and move on.
    if (error) {
        console.error("Failed to log usage event:", error.message);
    }
}
