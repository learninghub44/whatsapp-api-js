/**
 * Rough $ per 1M tokens, input/output. Not billing-accurate — good enough
 * for relative usage/cost visibility on the dashboard (PHASES.md #2).
 * Unrecognized provider/model pairs fall back to a conservative default
 * rather than silently reporting $0, so gaps are visible instead of hidden.
 */
const PRICING_PER_MILLION_TOKENS: Record<
    string,
    Record<string, { input: number; output: number }>
> = {
    groq: {
        "llama-3.3-70b-versatile": { input: 0.59, output: 0.79 },
        default: { input: 0.59, output: 0.79 }
    },
    openrouter: {
        "meta-llama/llama-3.3-70b-instruct": { input: 0.6, output: 0.6 },
        default: { input: 1.0, output: 1.0 }
    },
    openai: {
        default: { input: 2.5, output: 10.0 }
    },
    anthropic: {
        default: { input: 3.0, output: 15.0 }
    }
};

const FALLBACK_RATE = { input: 1.0, output: 3.0 };

export function estimateCostUsd(
    provider: string,
    model: string | undefined,
    promptTokens: number | undefined,
    completionTokens: number | undefined
): number | null {
    if (promptTokens === undefined && completionTokens === undefined) {
        return null;
    }

    const providerTable = PRICING_PER_MILLION_TOKENS[provider];
    const modelRate = model ? providerTable?.[model] : undefined;
    const rate = modelRate ?? providerTable?.default ?? FALLBACK_RATE;

    const inputCost = ((promptTokens ?? 0) / 1_000_000) * rate.input;
    const outputCost = ((completionTokens ?? 0) / 1_000_000) * rate.output;

    return Number((inputCost + outputCost).toFixed(6));
}
