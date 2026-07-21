import { CircuitBreaker } from "./circuitBreaker.js";
import { AIProviderConfigError } from "./types.js";
import type { AIProvider, AIResponse, ChatMessage } from "./types.js";
import { env } from "../config/env.js";

type RouterEntry = {
    provider: AIProvider;
    breaker: CircuitBreaker;
};

/**
 * Given a tenant's ordered provider chain, tries provider[0]; on error,
 * timeout, rate-limit, or missing key, skips to the next (PHASES.md #2).
 * A tenant with only 1 of N providers configured works exactly the same as
 * a tenant with all of them configured.
 */
export class AIProviderRouter {
    private readonly entries: RouterEntry[];

    constructor(providers: AIProvider[]) {
        this.entries = providers.map((provider) => ({
            provider,
            breaker: new CircuitBreaker(
                env.circuitBreakerThreshold,
                env.circuitBreakerCooldownMs
            )
        }));
    }

    async chat(messages: ChatMessage[]): Promise<AIResponse> {
        const attempted: string[] = [];

        for (const entry of this.entries) {
            const { provider, breaker } = entry;

            if (!provider.isHealthy() || !breaker.canAttempt()) {
                continue;
            }

            attempted.push(provider.name);

            const controller = new AbortController();
            const timeout = setTimeout(
                () => controller.abort(),
                env.aiRequestTimeoutMs
            );

            try {
                const response = await provider.chat(messages, {
                    signal: controller.signal
                });
                breaker.recordSuccess();
                return response;
            } catch (err) {
                // A missing/invalid key is a config state, not a transient
                // failure — don't let it trip the breaker, just move on.
                if (!(err instanceof AIProviderConfigError)) {
                    breaker.recordFailure();
                }
            } finally {
                clearTimeout(timeout);
            }
        }

        throw new Error(
            attempted.length
                ? `All configured AI providers failed for this tenant (tried: ${attempted.join(", ")})`
                : "No AI provider is configured or healthy for this tenant"
        );
    }
}
