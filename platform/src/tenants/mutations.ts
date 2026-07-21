import { supabase } from "../db/client.js";
import { invalidateTenantCache } from "./repository.js";
import { invalidateTenantRuntime } from "./registry.js";
import type { AIProviderName, TenantStatus } from "../types.js";

export async function createTenantForUser(
    userId: string,
    name: string
): Promise<{ id: string; name: string; status: TenantStatus }> {
    const { data: tenant, error: tenantError } = await supabase
        .from("tenants")
        .insert({ name })
        .select("id, name, status")
        .single();

    if (tenantError) throw tenantError;

    const { error: memberError } = await supabase
        .from("tenant_members")
        .insert({ tenant_id: tenant.id, user_id: userId, role: "owner" });

    if (memberError) throw memberError;

    return tenant;
}

export async function listTenantsForUser(userId: string) {
    const { data, error } = await supabase
        .from("tenant_members")
        .select("role, tenants (id, name, status)")
        .eq("user_id", userId);

    if (error) throw error;

    return (data ?? []).map((row) => ({
        role: row.role,
        // Supabase's join typing comes back as an array even for a
        // to-one relationship; take the first (only) row.
        ...(Array.isArray(row.tenants) ? row.tenants[0] : row.tenants)
    }));
}

export async function upsertWhatsAppCredentials(
    tenantId: string,
    creds: {
        phoneNumberId: string;
        token: string;
        appSecret: string;
        webhookVerifyToken?: string;
    }
): Promise<void> {
    // Look up the previous phone_number_id first so we can invalidate the
    // right cache key if it's being changed.
    const { data: existing } = await supabase
        .from("tenant_whatsapp_credentials")
        .select("phone_number_id")
        .eq("tenant_id", tenantId)
        .maybeSingle();

    const { error } = await supabase
        .from("tenant_whatsapp_credentials")
        .upsert(
            {
                tenant_id: tenantId,
                phone_number_id: creds.phoneNumberId,
                token: creds.token,
                app_secret: creds.appSecret,
                webhook_verify_token: creds.webhookVerifyToken ?? null
            },
            { onConflict: "tenant_id" }
        );

    if (error) throw error;

    if (existing?.phone_number_id) {
        invalidateTenantCache(existing.phone_number_id);
    }
    invalidateTenantCache(creds.phoneNumberId);
    invalidateTenantRuntime(tenantId);
}

export async function listAIProviders(tenantId: string) {
    const { data, error } = await supabase
        .from("tenant_ai_providers")
        .select("id, provider, model, priority, enabled")
        .eq("tenant_id", tenantId)
        .order("priority", { ascending: true });

    if (error) throw error;
    // Deliberately omit api_key — the dashboard never needs to read it back.
    return data ?? [];
}

export async function addAIProvider(
    tenantId: string,
    input: {
        provider: AIProviderName;
        apiKey: string;
        model?: string;
        priority: number;
    }
): Promise<void> {
    const { error } = await supabase.from("tenant_ai_providers").insert({
        tenant_id: tenantId,
        provider: input.provider,
        api_key: input.apiKey,
        model: input.model ?? null,
        priority: input.priority
    });

    if (error) throw error;
    await invalidateRuntimeAfterProviderChange(tenantId);
}

export async function updateAIProvider(
    tenantId: string,
    providerRowId: string,
    patch: Partial<{
        apiKey: string;
        model: string | null;
        priority: number;
        enabled: boolean;
    }>
): Promise<void> {
    const update: Record<string, unknown> = {};
    if (patch.apiKey !== undefined) update.api_key = patch.apiKey;
    if (patch.model !== undefined) update.model = patch.model;
    if (patch.priority !== undefined) update.priority = patch.priority;
    if (patch.enabled !== undefined) update.enabled = patch.enabled;

    const { error } = await supabase
        .from("tenant_ai_providers")
        .update(update)
        .eq("id", providerRowId)
        .eq("tenant_id", tenantId);

    if (error) throw error;
    await invalidateRuntimeAfterProviderChange(tenantId);
}

export async function deleteAIProvider(
    tenantId: string,
    providerRowId: string
): Promise<void> {
    const { error } = await supabase
        .from("tenant_ai_providers")
        .delete()
        .eq("id", providerRowId)
        .eq("tenant_id", tenantId);

    if (error) throw error;
    await invalidateRuntimeAfterProviderChange(tenantId);
}

async function invalidateRuntimeAfterProviderChange(
    tenantId: string
): Promise<void> {
    const { data } = await supabase
        .from("tenant_whatsapp_credentials")
        .select("phone_number_id")
        .eq("tenant_id", tenantId)
        .maybeSingle();

    if (data?.phone_number_id) {
        invalidateTenantCache(data.phone_number_id);
    }
    invalidateTenantRuntime(tenantId);
}
