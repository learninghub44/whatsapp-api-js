export type TenantStatus = "active" | "paused" | "disabled";

export type Tenant = {
    id: string;
    name: string;
    status: TenantStatus;
};

export type TenantWhatsAppCredentials = {
    tenantId: string;
    phoneNumberId: string;
    token: string;
    appSecret: string;
    webhookVerifyToken?: string;
};

export type AIProviderName = "groq" | "openrouter" | "openai" | "anthropic";

export type TenantAIProviderConfig = {
    tenantId: string;
    provider: AIProviderName;
    apiKey: string;
    model?: string;
    priority: number;
    enabled: boolean;
};

/** Everything needed to run one tenant's message loop, loaded together. */
export type TenantRuntimeConfig = {
    tenant: Tenant;
    whatsapp: TenantWhatsAppCredentials;
    aiProviders: TenantAIProviderConfig[];
};
