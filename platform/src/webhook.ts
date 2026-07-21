import { Router, type Request, type Response } from "express";
import { Text } from "whatsapp-api-js/messages";
import type { OnMessageArgs } from "whatsapp-api-js/emitters";
import type { PostData } from "whatsapp-api-js/types";

import { getTenantRuntime } from "./tenants/registry.js";
import { getRecentHistory, appendMessage } from "./conversation/history.js";
import { logUsageEvent } from "./usage/log.js";
import type { AIProviderRouter } from "./ai/router.js";

export const webhookRouter = Router();

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

    const history = await getRecentHistory(runtime.tenantId, args.from);
    await appendMessage(runtime.tenantId, args.from, "user", userText);

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
webhookRouter.get("/webhook", async (req: Request, res: Response) => {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

    if (mode === "subscribe" && token && token === process.env.WEBHOOK_VERIFY_TOKEN) {
        res.status(200).send(challenge);
        return;
    }

    res.sendStatus(403);
});

webhookRouter.post(
    "/webhook",
    async (req: Request, res: Response) => {
        const raw = typeof req.body === "string" ? req.body : "";
        const phoneNumberId = peekPhoneNumberId(raw);

        if (!phoneNumberId) {
            res.sendStatus(400);
            return;
        }

        const runtime = await getTenantRuntime(
            phoneNumberId,
            handleIncomingMessage
        );

        if (!runtime) {
            // Unknown phone_number_id — not one of our tenants.
            res.sendStatus(404);
            return;
        }

        const status = await runtime.api.handle_post(req);
        res.sendStatus(status);
    }
);
