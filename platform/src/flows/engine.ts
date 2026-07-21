import { getFlowById, getTemplate, getTenantFlows } from "./repository.js";
import { matchDefaultFlow, matchFlow } from "./matcher.js";
import {
    enterFlow,
    exitFlow,
    getConversationState,
    handOff,
    saveConversationState
} from "../conversation/state.js";
import type { ConversationState, Flow } from "./types.js";

export type QuickReply = { id: string; title: string };

/** Sends one outgoing message for this turn — webhook.ts adapts this to
 *  args.reply()/Text/Interactive so the engine stays free of message SDK types. */
export type FlowSendFn = (
    body: string,
    quickReplies?: QuickReply[]
) => Promise<void>;

function interpolate(text: string, vars: Record<string, string>): string {
    return text.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => vars[key] ?? "");
}

/** If we're resuming mid-flow on an "ask" step, records the user's reply. */
function applyAskAnswer(
    state: ConversationState,
    flow: Flow,
    userText: string
): ConversationState {
    const step = flow.steps[state.stepIndex];
    if (step && step.type === "ask") {
        return {
            ...state,
            vars: { ...state.vars, [step.saveAs]: userText },
            stepIndex: state.stepIndex + 1
        };
    }
    return state;
}

/**
 * Runs steps from `state.stepIndex` onward until the flow needs to pause
 * (an "ask" step waiting on the user), hands off to a human, or finishes.
 */
async function runFlow(
    tenantId: string,
    flow: Flow,
    state: ConversationState,
    send: FlowSendFn
): Promise<void> {
    let cursor = state;

    while (cursor.stepIndex < flow.steps.length) {
        const step = flow.steps[cursor.stepIndex];
        if (!step) break;

        if (step.type === "send_text") {
            await send(interpolate(step.text, cursor.vars));
            cursor = { ...cursor, stepIndex: cursor.stepIndex + 1 };
            continue;
        }

        if (step.type === "send_template") {
            const template = await getTemplate(tenantId, step.template);
            if (template) {
                await send(
                    interpolate(template.body, cursor.vars),
                    template.quickReplies
                );
            }
            cursor = { ...cursor, stepIndex: cursor.stepIndex + 1 };
            continue;
        }

        if (step.type === "ask") {
            await send(interpolate(step.text, cursor.vars));
            // Stay parked on this step index — the next incoming message is
            // treated as the answer (see applyAskAnswer).
            await saveConversationState(cursor);
            return;
        }

        if (step.type === "handoff") {
            await saveConversationState(handOff(cursor, step.reason));
            return;
        }
    }

    // Ran off the end of the steps array — flow is done, back to idle.
    await saveConversationState(exitFlow(cursor));
}

/**
 * Entry point called from the webhook for every incoming text message,
 * before falling back to the AI provider router.
 *
 * Returns `true` if the flow engine fully handled this turn (a flow ran,
 * paused, handed off, or the conversation is already with a human — in all
 * these cases the caller must NOT also call the AI router). Returns
 * `false` if nothing matched and the caller should fall through to AI.
 */
export async function handleIncomingMessageForFlows(
    tenantId: string,
    waId: string,
    userText: string,
    send: FlowSendFn
): Promise<boolean> {
    const state = await getConversationState(tenantId, waId);

    if (state.mode === "human") {
        // Handed off to a person — the bot stays silent until a dashboard
        // operator resumes it (PHASES.md #3).
        return true;
    }

    const flows = await getTenantFlows(tenantId);

    if (state.activeFlowId) {
        const flow =
            flows.find((f) => f.id === state.activeFlowId) ??
            (await getFlowById(tenantId, state.activeFlowId));

        if (!flow) {
            // The flow was deleted/disabled mid-run — drop back to idle and
            // let this message be re-evaluated as a fresh trigger below.
            await saveConversationState(exitFlow(state));
        } else {
            await runFlow(tenantId, flow, applyAskAnswer(state, flow, userText), send);
            return true;
        }
    }

    const matched = matchFlow(flows, userText) ?? matchDefaultFlow(flows);
    if (!matched) return false;

    await runFlow(tenantId, matched, enterFlow(state, matched.id), send);
    return true;
}
