import { OpenAICompatibleProvider } from "./openaiCompatible.js";
import type { AIProviderName } from "../types.js";

export class GroqProvider extends OpenAICompatibleProvider {
    readonly name: AIProviderName = "groq";
    protected readonly baseUrl = "https://api.groq.com/openai/v1/chat/completions";
    protected readonly defaultModel = "llama-3.3-70b-versatile";
}
