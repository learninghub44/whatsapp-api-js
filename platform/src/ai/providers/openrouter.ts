import { OpenAICompatibleProvider } from "./openaiCompatible.js";
import type { AIProviderName } from "../types.js";

export class OpenRouterProvider extends OpenAICompatibleProvider {
    readonly name: AIProviderName = "openrouter";
    protected readonly baseUrl = "https://openrouter.ai/api/v1/chat/completions";
    protected readonly defaultModel = "meta-llama/llama-3.3-70b-instruct";
}
