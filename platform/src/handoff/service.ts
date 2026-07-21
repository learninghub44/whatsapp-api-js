import { supabase } from "../db/client.js";
import { getConversationState, resumeBot, saveConversationState } from "../conversation/state.js";

export type EscalatedConversation = {
    waId: string;
    reason: string | null;
    handoffAt: string | null;
};

/** Conversations currently parked in human mode for a tenant, most recent first. */
export async function listEscalatedConversations(
    tenantId: string
): Promise<EscalatedConversation[]> {
    const { data, error } = await supabase
        .from("conversation_state")
        .select("wa_id, handoff_reason, handoff_at")
        .eq("tenant_id", tenantId)
        .eq("mode", "human")
        .order("handoff_at", { ascending: false });

    if (error) throw error;

    return (data ?? []).map((row) => ({
        waId: row.wa_id,
        reason: row.handoff_reason,
        handoffAt: row.handoff_at
    }));
}

/** Hands a conversation back to the bot — called from the dashboard once a human is done. */
export async function resumeBotForConversation(
    tenantId: string,
    waId: string
): Promise<void> {
    const state = await getConversationState(tenantId, waId);
    await saveConversationState(resumeBot(state));
}
