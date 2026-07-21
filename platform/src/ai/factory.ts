import { GroqProvider } from "./providers/groq.js";
import { OpenRouterProvider } from "./providers/openrouter.js";
import type { AIProvider } from "./types.js";
import type { TenantAIProviderConfig } from "../types.js";

/**
 * Builds the two Phase 1 adapters. `openai` and `anthropic` are intentionally
 * not wired yet (PHASES.md #2: "build first: GroqProvider, OpenRouterProvider")
 * — adding them here is the only change needed once those adapters exist.
 */
export function createProvider(config: TenantAIProviderConfig): AIProvider {
    switch (config.provider) {
        case "groq":
            return new GroqProvider(config.apiKey);
        case "openrouter":
            return new OpenRouterProvider(config.apiKey);
        case "openai":
        case "anthropic":
            throw new Error(
                `[${config.provider}] adapter not implemented yet (Phase 1 ships groq + openrouter only)`
            );
    }
}
