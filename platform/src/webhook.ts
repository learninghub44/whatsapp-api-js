import { Hono } from "hono";
import { Text, Interactive, ActionButtons, Button, Body } from "whatsapp-api-js/messages";
import type { OnMessageArgs } from "whatsapp-api-js/emitters";
import type { PostData } from "whatsapp-api-js/types";

import { getTenantRuntime } from "./tenants/registry.js";
import { getRecentHistory, appendMessage } from "./conversation/history.js";
import { logUsageEvent } from "./usage/log.js";
import type { AIProviderRouter } from "./ai/router.js";
import { handleIncomingMessageForFlows, type QuickReply } from "./flows/engine.js";
import { env } from "./config/env.js";

export const webhookRouter = new Hono();

/** Pulls phone_number_id out of Meta's payload without fully parsing it. */
function peekPhoneNumberId(raw: string): string | null {
    try {
        const payload = JSON.parse(raw) as PostData;
        return payload.entry?.[0]?.changes?.[0]?.value?.metadata
            ?.phone_number_id ?? null;
    } catch {
        return null;
    }
}

async function handleIncomingMessage(
    args: OnMessageArgs,
    runtime: { tenantId: string; router: AIProviderRouter }
): Promise<void> {
    const userText =
        args.message.type === "text" ? args.message.text?.body : undefined;

    if (!userText) {
        // Non-text messages (media, location, etc.) aren't handled by the
        // Phase 1 chat loop yet — ack receipt and stop.
        await args.received();
        return;
    }

    await args.received("text");
    await appendMessage(runtime.tenantId, args.from, "user", userText);

    // Reply helper the flow engine can call without knowing about
    // whatsapp-api-js message classes — up to 3 quick-reply buttons per
    // message, mirroring ActionButtons' limit (PHASES.md #3).
    const send = async (body: string, quickReplies?: QuickReply[]) => {
        let message: Text | Interactive;

        const buttons = (quickReplies ?? [])
            .slice(0, 3)
            .map((qr) => new Button(qr.id, qr.title));
        const [first, ...rest] = buttons;

        message = first
            ? new Interactive(new ActionButtons(first, ...rest), new Body(body))
            : new Text(body);

        await args.reply(message);
        await appendMessage(runtime.tenantId, args.from, "assistant", body);
    };

    const handledByFlow = await handleIncomingMessageForFlows(
        runtime.tenantId,
        args.from,
        userText,
        send
    );
    if (handledByFlow) return;

    const history = await getRecentHistory(runtime.tenantId, args.from);

    try {
        const response = await runtime.router.chat([
            ...history,
            { role: "user", content: userText }
        ]);

        await args.reply(new Text(response.content));
        await appendMessage(
            runtime.tenantId,
            args.from,
            "assistant",
            response.content,
            response.provider
        );
        await logUsageEvent(runtime.tenantId, response);
    } catch (err) {
        // All providers failed/misconfigured for this tenant — never let
        // that throw uncaught into the webhook handler (PHASES.md #2).
        console.error(
            `[tenant ${runtime.tenantId}] AI router failed:`,
            (err as Error).message
        );
        await args.reply(
            new Text(
                "Sorry, I'm having trouble responding right now — please try again shortly."
            )
        );
    }
}

// Meta's webhook verification handshake. This uses one process-wide
// WEBHOOK_VERIFY_TOKEN rather than a per-tenant one — fine for the common
// setup of one Meta app managing multiple phone numbers/tenants. Revisit if
// a tenant ever needs their own Meta app.
webhookRouter.get("/webhook", async (c) => {
    const mode = c.req.query("hub.mode");
    const token = c.req.query("hub.verify_token");
    const challenge = c.req.query("hub.challenge");

    if (mode === "subscribe" && token && token === env.webhookVerifyToken) {
        return c.text(challenge ?? "", 200);
    }

    return c.body(null, 403);
});

webhookRouter.post("/webhook", async (c) => {
    // The SDK's handle_post expects a standard Fetch Request (Workers-native),
    // but we still need to peek the raw body first to resolve the tenant —
    // clone so the SDK can read the body itself afterwards.
    const raw = await c.req.raw.clone().text();
    const phoneNumberId = peekPhoneNumberId(raw);

    if (!phoneNumberId) {
        return c.body(null, 400);
    }

    const runtime = await getTenantRuntime(
        phoneNumberId,
        handleIncomingMessage
    );

    if (!runtime) {
        // Unknown phone_number_id — not one of our tenants.
        return c.body(null, 404);
    }

    const status = await runtime.api.handle_post(c.req.raw);
    return new Response(null, { status });
});
