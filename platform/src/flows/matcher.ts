import type { Flow } from "./types.js";

/**
 * Intent routing for Phase 3 is deliberately simple keyword matching, not
 * NLU/AI classification (PHASES.md #3: "simple flow/rules builder") — a
 * flow matches if any of its trigger keywords appear as a substring of the
 * incoming message, case-insensitively. Flows are already priority-ordered
 * by the repository query, so the first match wins.
 */
export function matchFlow(flows: Flow[], userText: string): Flow | null {
    const normalized = userText.trim().toLowerCase();
    if (!normalized) return null;

    for (const flow of flows) {
        if (flow.triggerType !== "keyword") continue;
        const keywords = flow.triggerKeywords ?? [];
        if (keywords.some((kw) => normalized.includes(kw.toLowerCase()))) {
            return flow;
        }
    }

    return null;
}

/** The tenant's fallback flow, if configured — tried before the AI router. */
export function matchDefaultFlow(flows: Flow[]): Flow | null {
    return flows.find((f) => f.triggerType === "default") ?? null;
}
