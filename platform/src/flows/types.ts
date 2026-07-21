/**
 * A flow is an ordered list of steps run for one wa_id at a time, resuming
 * from `conversation_state.step_index` on each incoming message. Kept as a
 * small closed set of step types (not arbitrary code) so tenants can build
 * these from the dashboard in Phase 3+ without shipping JS.
 */
export type FlowStep =
    | { type: "send_text"; text: string }
    | { type: "send_template"; template: string }
    /**
     * Sends `text`, then pauses the flow and waits for the user's next
     * message, storing it in `vars[saveAs]` before advancing. Later steps
     * can reference it via `{{saveAs}}` in send_text/send_template text.
     */
    | { type: "ask"; text: string; saveAs: string }
    /**
     * Ends the flow and hands the conversation to a human — the bot stops
     * auto-replying until a dashboard operator resumes it.
     */
    | { type: "handoff"; reason?: string };

export type Flow = {
    id: string;
    tenantId: string;
    name: string;
    triggerType: "keyword" | "default";
    triggerKeywords: string[] | null;
    steps: FlowStep[];
    priority: number;
    enabled: boolean;
};

export type Template = {
    id: string;
    tenantId: string;
    name: string;
    body: string;
    quickReplies: { id: string; title: string }[];
};

export type ConversationState = {
    tenantId: string;
    waId: string;
    mode: "bot" | "human";
    activeFlowId: string | null;
    stepIndex: number;
    vars: Record<string, string>;
    handoffReason: string | null;
};
