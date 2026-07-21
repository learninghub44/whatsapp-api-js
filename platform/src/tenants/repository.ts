import { supabase } from "../db/client.js";
import { env } from "../config/env.js";
import type {
    Tenant,
    TenantAIProviderConfig,
    TenantRuntimeConfig,
    TenantWhatsAppCredentials
} from "../types.js";

type CacheEntry = {
    config: TenantRuntimeConfig;
    expiresAt: number;
};

// Keyed by phone_number_id — that's the only identifier Meta's webhook
// payload gives us to resolve a tenant (PHASES.md #3).
const cache = new Map<string, CacheEntry>();

/**
 * Resolves the full runtime config (tenant + WhatsApp credentials + AI
 * provider chain) for the tenant that owns the given phone_number_id.
 * Returns null if no active tenant is registered for it.
 */
export async function getTenantByPhoneNumberId(
    phoneNumberId: string
): Promise<TenantRuntimeConfig | null> {
    const cached = cache.get(phoneNumberId);
    if (cached && cached.expiresAt > Date.now()) {
        return cached.config;
    }

    const { data: credentialsRow, error: credentialsError } = await supabase
        .from("tenant_whatsapp_credentials")
        .select("tenant_id, phone_number_id, token, app_secret, webhook_verify_token")
        .eq("phone_number_id", phoneNumberId)
        .maybeSingle();

    if (credentialsError) throw credentialsError;
    if (!credentialsRow) {
        cache.delete(phoneNumberId);
        return null;
    }

    const { data: tenantRow, error: tenantError } = await supabase
        .from("tenants")
        .select("id, name, status")
        .eq("id", credentialsRow.tenant_id)
        .single();

    if (tenantError) throw tenantError;
    if (tenantRow.status !== "active") {
        cache.delete(phoneNumberId);
        return null;
    }

    const { data: providerRows, error: providerError } = await supabase
        .from("tenant_ai_providers")
        .select("tenant_id, provider, api_key, model, priority, enabled")
        .eq("tenant_id", credentialsRow.tenant_id)
        .eq("enabled", true)
        .order("priority", { ascending: true });

    if (providerError) throw providerError;

    const tenant: Tenant = {
        id: tenantRow.id,
        name: tenantRow.name,
        status: tenantRow.status
    };

    const whatsapp: TenantWhatsAppCredentials = {
        tenantId: credentialsRow.tenant_id,
        phoneNumberId: credentialsRow.phone_number_id,
        token: credentialsRow.token,
        appSecret: credentialsRow.app_secret,
        webhookVerifyToken: credentialsRow.webhook_verify_token ?? undefined
    };

    const aiProviders: TenantAIProviderConfig[] = (providerRows ?? []).map(
        (row) => ({
            tenantId: row.tenant_id,
            provider: row.provider,
            apiKey: row.api_key,
            model: row.model ?? undefined,
            priority: row.priority,
            enabled: row.enabled
        })
    );

    const config: TenantRuntimeConfig = { tenant, whatsapp, aiProviders };

    cache.set(phoneNumberId, {
        config,
        expiresAt: Date.now() + env.tenantCacheTtlMs
    });

    return config;
}

/** Drops a tenant from the lookup cache — call after credential/provider edits. */
export function invalidateTenantCache(phoneNumberId: string): void {
    cache.delete(phoneNumberId);
}
