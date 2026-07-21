import type { AIProviderName } from "../types.js";
export type { AIProviderName } from "../types.js";

export type ChatRole = "system" | "user" | "assistant";

export type ChatMessage = {
    role: ChatRole;
    content: string;
};

export type ChatOptions = {
    model?: string;
    /** Aborts the underlying request; set by the router from env.aiRequestTimeoutMs. */
    signal?: AbortSignal;
};

export type AIResponse = {
    content: string;
    /** Name of the provider that actually produced this response. */
    provider: string;
    model?: string;
};

/**
 * A missing/invalid API key is a configuration state, not an exception.
 * Providers throw this instead of a raw fetch error so the router can treat
 * it the same as "not configured" without inspecting HTTP status codes.
 */
export class AIProviderConfigError extends Error {
    constructor(provider: string, message: string) {
        super(`[${provider}] ${message}`);
        this.name = "AIProviderConfigError";
    }
}

/** Common interface — one implementation per provider (PHASES.md #2). */
export interface AIProvider {
    readonly name: AIProviderName;
    chat(messages: ChatMessage[], opts?: ChatOptions): Promise<AIResponse>;
    isHealthy(): boolean;
}
