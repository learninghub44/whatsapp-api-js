import {
    AIProvider,
    AIProviderConfigError,
    AIProviderName,
    AIResponse,
    ChatMessage,
    ChatOptions
} from "../types.js";

type OpenAICompatibleChatResponse = {
    choices?: { message?: { content?: string } }[];
    usage?: { prompt_tokens?: number; completion_tokens?: number };
    error?: { message?: string };
};

/**
 * Base for providers that speak the OpenAI-style `/chat/completions` shape
 * (Groq, OpenRouter, and OpenAI itself). Keeps adding a new provider a
 * drop-in: subclass, set name/baseUrl/defaultModel, done (PHASES.md #2).
 */
export abstract class OpenAICompatibleProvider implements AIProvider {
    abstract readonly name: AIProviderName;
    protected abstract readonly baseUrl: string;
    protected abstract readonly defaultModel: string;

    private healthy = true;

    constructor(private readonly apiKey: string | undefined) {}

    isHealthy(): boolean {
        return this.healthy && !!this.apiKey;
    }

    async chat(
        messages: ChatMessage[],
        opts: ChatOptions = {}
    ): Promise<AIResponse> {
        if (!this.apiKey) {
            throw new AIProviderConfigError(this.name, "no API key configured");
        }

        const model = opts.model ?? this.defaultModel;

        let res: Response;
        try {
            res = await fetch(this.baseUrl, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${this.apiKey}`
                },
                body: JSON.stringify({ model, messages }),
                signal: opts.signal
            });
        } catch (err) {
            this.healthy = false;
            throw err;
        }

        if (!res.ok) {
            this.healthy = res.status < 500; // config/auth errors aren't "down", 5xx is
            const body = (await res.json().catch(() => null)) as
                | OpenAICompatibleChatResponse
                | null;
            throw new Error(
                `[${this.name}] request failed (${res.status}): ${
                    body?.error?.message ?? res.statusText
                }`
            );
        }

        this.healthy = true;
        const data = (await res.json()) as OpenAICompatibleChatResponse;
        const content = data.choices?.[0]?.message?.content;

        if (!content) {
            throw new Error(`[${this.name}] empty response`);
        }

        return {
            content,
            provider: this.name,
            model,
            usage: {
                promptTokens: data.usage?.prompt_tokens,
                completionTokens: data.usage?.completion_tokens
            }
        };
    }
}
