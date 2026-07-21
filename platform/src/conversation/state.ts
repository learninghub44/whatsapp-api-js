import { supabase } from "../db/client.js";
import type { ConversationState } from "../flows/types.js";

const DEFAULT_STATE = (tenantId: string, waId: string): ConversationState => ({
    tenantId,
    waId,
    mode: "bot",
    activeFlowId: null,
    stepIndex: 0,
    vars: {},
    handoffReason: null
});

export async function getConversationState(
    tenantId: string,
    waId: string
): Promise<ConversationState> {
    const { data, error } = await supabase
        .from("conversation_state")
        .select("tenant_id, wa_id, mode, active_flow_id, step_index, vars, handoff_reason")
        .eq("tenant_id", tenantId)
        .eq("wa_id", waId)
        .maybeSingle();

    if (error) throw error;
    if (!data) return DEFAULT_STATE(tenantId, waId);

    return {
        tenantId: data.tenant_id,
        waId: data.wa_id,
        mode: data.mode,
        activeFlowId: data.active_flow_id,
        stepIndex: data.step_index,
        vars: data.vars ?? {},
        handoffReason: data.handoff_reason
    };
}

/** Upserts the full state row — callers pass the complete state, not a patch. */
export async function saveConversationState(
    state: ConversationState
): Promise<void> {
    const { error } = await supabase.from("conversation_state").upsert(
        {
            tenant_id: state.tenantId,
            wa_id: state.waId,
            mode: state.mode,
            active_flow_id: state.activeFlowId,
            step_index: state.stepIndex,
            vars: state.vars,
            handoff_reason: state.handoffReason,
            handoff_at: state.mode === "human" ? new Date().toISOString() : null,
            updated_at: new Date().toISOString()
        },
        { onConflict: "tenant_id,wa_id" }
    );

    if (error) throw error;
}

/** Starts a flow from step 0, clearing any prior flow's vars. */
export function enterFlow(
    state: ConversationState,
    flowId: string
): ConversationState {
    return { ...state, activeFlowId: flowId, stepIndex: 0, vars: {} };
}

/** Clears flow position, returning the conversation to idle bot mode. */
export function exitFlow(state: ConversationState): ConversationState {
    return { ...state, activeFlowId: null, stepIndex: 0 };
}

export function handOff(
    state: ConversationState,
    reason: string | undefined
): ConversationState {
    return {
        ...exitFlow(state),
        mode: "human",
        handoffReason: reason ?? null
    };
}

export function resumeBot(state: ConversationState): ConversationState {
    return { ...exitFlow(state), mode: "bot", handoffReason: null };
}
