import { supabase } from "../db/client.js";

export type TenantRole = "owner" | "admin";

/** Returns the caller's role on a tenant, or null if they're not a member. */
export async function getTenantRole(
    userId: string,
    tenantId: string
): Promise<TenantRole | null> {
    const { data, error } = await supabase
        .from("tenant_members")
        .select("role")
        .eq("user_id", userId)
        .eq("tenant_id", tenantId)
        .maybeSingle();

    if (error) throw error;
    return (data?.role as TenantRole | undefined) ?? null;
}

export async function listTenantIdsForUser(userId: string): Promise<string[]> {
    const { data, error } = await supabase
        .from("tenant_members")
        .select("tenant_id")
        .eq("user_id", userId);

    if (error) throw error;
    return (data ?? []).map((row) => row.tenant_id as string);
}
