import { supabase } from "../db/client.js";
import { env } from "../config/env.js";
import type { ChatMessage } from "../ai/types.js";

/**
 * Last N turns for a given tenant+wa_id, oldest first — ready to prepend
 * to a new user message as chat context (PHASES.md #4: "stateless-per-turn
 * chat with short recent history for context", no flow/intent state yet).
 */
export async function getRecentHistory(
    tenantId: string,
    waId: string
): Promise<ChatMessage[]> {
    const { data, error } = await supabase
        .from("conversation_messages")
        .select("role, content")
        .eq("tenant_id", tenantId)
        .eq("wa_id", waId)
        .order("created_at", { ascending: false })
        .limit(env.conversationHistoryTurns);

    if (error) throw error;

    return (data ?? []).reverse().map((row) => ({
        role: row.role as ChatMessage["role"],
        content: row.content
    }));
}

export async function appendMessage(
    tenantId: string,
    waId: string,
    role: "user" | "assistant",
    content: string,
    provider?: string
): Promise<void> {
    const { error } = await supabase.from("conversation_messages").insert({
        tenant_id: tenantId,
        wa_id: waId,
        role,
        content,
        provider: provider ?? null
    });

    if (error) throw error;
}
