import { WhatsAppAPI } from "whatsapp-api-js/middleware/express";
import type { OnMessageArgs } from "whatsapp-api-js/emitters";

import { getTenantByPhoneNumberId } from "./repository.js";
import { createProvider } from "../ai/factory.js";
import { AIProviderRouter } from "../ai/router.js";
import type { TenantRuntimeConfig } from "../types.js";

type TenantRuntime = {
    tenantId: string;
    tenantName: string;
    api: WhatsAppAPI;
    router: AIProviderRouter;
    /** Reference to the config this runtime was built from, to detect refreshes. */
    configRef: TenantRuntimeConfig;
};

// One `WhatsAppAPI` instance per tenant (AGENTS.md: "one token/app-secret
// pair"), cached in memory keyed by tenant_id (PHASES.md #3).
const runtimeByTenantId = new Map<string, TenantRuntime>();

/**
 * Resolves (and lazily builds/refreshes) the full runtime for the tenant
 * that owns `phoneNumberId`. `onMessage` is wired once per tenant instance
 * — pass the platform's message handler here (see webhook.ts).
 */
export async function getTenantRuntime(
    phoneNumberId: string,
    onMessage: (args: OnMessageArgs, runtime: TenantRuntime) => Promise<void>
): Promise<TenantRuntime | null> {
    const config = await getTenantByPhoneNumberId(phoneNumberId);
    if (!config) return null;

    const existing = runtimeByTenantId.get(config.tenant.id);
    if (existing && existing.configRef === config) {
        return existing;
    }

    const api = new WhatsAppAPI({
        token: config.whatsapp.token,
        appSecret: config.whatsapp.appSecret,
        webhookVerifyToken: config.whatsapp.webhookVerifyToken
    });

    // Providers configured with only 1 of N adapters still "just work" —
    // the router (not this wiring code) is what handles the fallback logic.
    const providers = config.aiProviders
        .filter((p) => p.provider === "groq" || p.provider === "openrouter")
        .map(createProvider);

    const router = new AIProviderRouter(providers);

    const runtime: TenantRuntime = {
        tenantId: config.tenant.id,
        tenantName: config.tenant.name,
        api,
        router,
        configRef: config
    };

    api.on.message = (args) => onMessage(args, runtime);

    runtimeByTenantId.set(config.tenant.id, runtime);
    return runtime;
}

/** Drops a tenant's cached WhatsAppAPI/router instances — call after credential edits. */
export function invalidateTenantRuntime(tenantId: string): void {
    runtimeByTenantId.delete(tenantId);
}
