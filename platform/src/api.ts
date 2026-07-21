import { Router, type NextFunction, type Response } from "express";
import { requireAuth, type AuthedRequest } from "./auth/requireAuth.js";
import { getTenantRole } from "./auth/tenantAccess.js";
import {
    addAIProvider,
    createTenantForUser,
    deleteAIProvider,
    listAIProviders,
    listTenantsForUser,
    updateAIProvider,
    upsertWhatsAppCredentials
} from "./tenants/mutations.js";
import { getUsageSummary } from "./usage/query.js";
import type { AIProviderName } from "./types.js";
import {
    deleteFlow,
    deleteTemplate,
    listFlows,
    listTemplates,
    upsertFlow,
    upsertTemplate
} from "./flows/mutations.js";
import {
    listEscalatedConversations,
    resumeBotForConversation
} from "./handoff/service.js";

export const apiRouter = Router();
apiRouter.use((req, res, next) => {
    requireAuth(req, res, next).catch(next);
});

/**
 * Express 4 doesn't forward async handler rejections to error middleware
 * on its own — wrap every route so a thrown/rejected error becomes a 500
 * via next(err) instead of hanging the request.
 */
function ah(handler: (req: AuthedRequest, res: Response) => Promise<void>) {
    return (req: AuthedRequest, res: Response, next: NextFunction) => {
        handler(req, res).catch(next);
    };
}

/** Extracts a required string route param, 400ing if it's missing/malformed. */
function requireParam(
    req: AuthedRequest,
    res: Response,
    name: string
): string | null {
    const value = req.params[name];
    if (typeof value !== "string") {
        res.status(400).json({ error: `Missing route param: ${name}` });
        return null;
    }
    return value;
}
async function requireTenantMember(
    req: AuthedRequest,
    res: Response,
    tenantId: string
): Promise<boolean> {
    const role = await getTenantRole(req.userId!, tenantId);
    if (!role) {
        res.status(403).json({ error: "Not a member of this tenant" });
        return false;
    }
    return true;
}

// --- Tenants ---------------------------------------------------------------

apiRouter.get(
    "/api/tenants",
    ah(async (req, res) => {
        const tenants = await listTenantsForUser(req.userId!);
        res.json({ tenants });
    })
);

apiRouter.post(
    "/api/tenants",
    ah(async (req, res) => {
        const name =
            typeof req.body?.name === "string" ? req.body.name.trim() : "";
        if (!name) {
            res.status(400).json({ error: "name is required" });
            return;
        }

        const tenant = await createTenantForUser(req.userId!, name);
        res.status(201).json({ tenant });
    })
);

// --- WhatsApp credentials ----------------------------------------------------

apiRouter.put(
    "/api/tenants/:tenantId/whatsapp",
    ah(async (req, res) => {
        const tenantId = requireParam(req, res, "tenantId");
        if (!tenantId) return;
        if (!(await requireTenantMember(req, res, tenantId))) return;

        const { phoneNumberId, token, appSecret, webhookVerifyToken } =
            req.body ?? {};

        if (!phoneNumberId || !token || !appSecret) {
            res.status(400).json({
                error: "phoneNumberId, token, and appSecret are required"
            });
            return;
        }

        await upsertWhatsAppCredentials(tenantId, {
            phoneNumberId,
            token,
            appSecret,
            webhookVerifyToken
        });

        res.status(204).send();
    })
);

// --- AI providers --------------------------------------------------------

const VALID_PROVIDERS: AIProviderName[] = [
    "groq",
    "openrouter",
    "openai",
    "anthropic"
];

apiRouter.get(
    "/api/tenants/:tenantId/ai-providers",
    ah(async (req, res) => {
        const tenantId = requireParam(req, res, "tenantId");
        if (!tenantId) return;
        if (!(await requireTenantMember(req, res, tenantId))) return;

        const providers = await listAIProviders(tenantId);
        res.json({ providers });
    })
);

apiRouter.post(
    "/api/tenants/:tenantId/ai-providers",
    ah(async (req, res) => {
        const tenantId = requireParam(req, res, "tenantId");
        if (!tenantId) return;
        if (!(await requireTenantMember(req, res, tenantId))) return;

        const { provider, apiKey, model, priority } = req.body ?? {};

        if (!VALID_PROVIDERS.includes(provider)) {
            res.status(400).json({
                error: `provider must be one of: ${VALID_PROVIDERS.join(", ")}`
            });
            return;
        }
        if (!apiKey) {
            res.status(400).json({ error: "apiKey is required" });
            return;
        }

        await addAIProvider(tenantId, {
            provider,
            apiKey,
            model,
            priority: typeof priority === "number" ? priority : 0
        });

        res.status(201).send();
    })
);

apiRouter.put(
    "/api/tenants/:tenantId/ai-providers/:providerId",
    ah(async (req, res) => {
        const tenantId = requireParam(req, res, "tenantId");
        const providerId = requireParam(req, res, "providerId");
        if (!tenantId || !providerId) return;
        if (!(await requireTenantMember(req, res, tenantId))) return;

        const { apiKey, model, priority, enabled } = req.body ?? {};

        await updateAIProvider(tenantId, providerId, {
            apiKey,
            model,
            priority,
            enabled
        });

        res.status(204).send();
    })
);

apiRouter.delete(
    "/api/tenants/:tenantId/ai-providers/:providerId",
    ah(async (req, res) => {
        const tenantId = requireParam(req, res, "tenantId");
        const providerId = requireParam(req, res, "providerId");
        if (!tenantId || !providerId) return;
        if (!(await requireTenantMember(req, res, tenantId))) return;

        await deleteAIProvider(tenantId, providerId);
        res.status(204).send();
    })
);

// --- Usage / cost visibility ------------------------------------------------

apiRouter.get(
    "/api/tenants/:tenantId/usage",
    ah(async (req, res) => {
        const tenantId = requireParam(req, res, "tenantId");
        if (!tenantId) return;
        if (!(await requireTenantMember(req, res, tenantId))) return;

        const days = Number(req.query.days ?? 30);
        const summary = await getUsageSummary(tenantId, days);
        res.json({ summary });
    })
);

// --- Flows / rules builder (PHASES.md #3) -----------------------------------

apiRouter.get(
    "/api/tenants/:tenantId/flows",
    ah(async (req, res) => {
        const tenantId = requireParam(req, res, "tenantId");
        if (!tenantId) return;
        if (!(await requireTenantMember(req, res, tenantId))) return;

        const flows = await listFlows(tenantId);
        res.json({ flows });
    })
);

apiRouter.post(
    "/api/tenants/:tenantId/flows",
    ah(async (req, res) => {
        const tenantId = requireParam(req, res, "tenantId");
        if (!tenantId) return;
        if (!(await requireTenantMember(req, res, tenantId))) return;

        const { id, name, triggerType, triggerKeywords, steps, priority, enabled } =
            req.body ?? {};

        if (typeof name !== "string" || !name.trim()) {
            res.status(400).json({ error: "name is required" });
            return;
        }
        if (triggerType !== "keyword" && triggerType !== "default") {
            res.status(400).json({
                error: "triggerType must be 'keyword' or 'default'"
            });
            return;
        }
        if (triggerType === "keyword" && !Array.isArray(triggerKeywords)) {
            res.status(400).json({
                error: "triggerKeywords is required for keyword-triggered flows"
            });
            return;
        }
        if (!Array.isArray(steps) || steps.length === 0) {
            res.status(400).json({ error: "steps must be a non-empty array" });
            return;
        }

        const flow = await upsertFlow(tenantId, {
            id,
            name,
            triggerType,
            triggerKeywords: triggerType === "keyword" ? triggerKeywords : null,
            steps,
            priority,
            enabled
        });

        res.status(201).json({ flow });
    })
);

apiRouter.delete(
    "/api/tenants/:tenantId/flows/:flowId",
    ah(async (req, res) => {
        const tenantId = requireParam(req, res, "tenantId");
        const flowId = requireParam(req, res, "flowId");
        if (!tenantId || !flowId) return;
        if (!(await requireTenantMember(req, res, tenantId))) return;

        await deleteFlow(tenantId, flowId);
        res.status(204).send();
    })
);

// --- Templates / quick replies (PHASES.md #3) -------------------------------

apiRouter.get(
    "/api/tenants/:tenantId/templates",
    ah(async (req, res) => {
        const tenantId = requireParam(req, res, "tenantId");
        if (!tenantId) return;
        if (!(await requireTenantMember(req, res, tenantId))) return;

        const templates = await listTemplates(tenantId);
        res.json({ templates });
    })
);

apiRouter.post(
    "/api/tenants/:tenantId/templates",
    ah(async (req, res) => {
        const tenantId = requireParam(req, res, "tenantId");
        if (!tenantId) return;
        if (!(await requireTenantMember(req, res, tenantId))) return;

        const { id, name, body, quickReplies } = req.body ?? {};

        if (typeof name !== "string" || !name.trim()) {
            res.status(400).json({ error: "name is required" });
            return;
        }
        if (typeof body !== "string" || !body.trim()) {
            res.status(400).json({ error: "body is required" });
            return;
        }

        try {
            const template = await upsertTemplate(tenantId, {
                id,
                name,
                body,
                quickReplies: Array.isArray(quickReplies) ? quickReplies : []
            });
            res.status(201).json({ template });
        } catch (err) {
            res.status(400).json({ error: (err as Error).message });
        }
    })
);

apiRouter.delete(
    "/api/tenants/:tenantId/templates/:templateId",
    ah(async (req, res) => {
        const tenantId = requireParam(req, res, "tenantId");
        const templateId = requireParam(req, res, "templateId");
        if (!tenantId || !templateId) return;
        if (!(await requireTenantMember(req, res, tenantId))) return;

        await deleteTemplate(tenantId, templateId);
        res.status(204).send();
    })
);

// --- Human handoff / escalation (PHASES.md #3) ------------------------------

apiRouter.get(
    "/api/tenants/:tenantId/conversations/escalated",
    ah(async (req, res) => {
        const tenantId = requireParam(req, res, "tenantId");
        if (!tenantId) return;
        if (!(await requireTenantMember(req, res, tenantId))) return;

        const conversations = await listEscalatedConversations(tenantId);
        res.json({ conversations });
    })
);

apiRouter.post(
    "/api/tenants/:tenantId/conversations/:waId/resume-bot",
    ah(async (req, res) => {
        const tenantId = requireParam(req, res, "tenantId");
        const waId = requireParam(req, res, "waId");
        if (!tenantId || !waId) return;
        if (!(await requireTenantMember(req, res, tenantId))) return;

        await resumeBotForConversation(tenantId, waId);
        res.status(204).send();
    })
);
