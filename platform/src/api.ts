import { Hono } from "hono";
import { requireAuth, type AuthedVars } from "./auth/requireAuth.js";
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
import type { Context } from "hono";

type Env = { Variables: AuthedVars };

export const apiRouter = new Hono<Env>();
apiRouter.use("*", requireAuth);

/** True if the caller is a member of the tenant; caller sends 403 itself if not. */
async function requireTenantMember(
    c: Context<Env>,
    tenantId: string
): Promise<boolean> {
    const role = await getTenantRole(c.get("userId"), tenantId);
    return role !== null;
}

// --- Tenants ---------------------------------------------------------------

apiRouter.get("/api/tenants", async (c) => {
    const tenants = await listTenantsForUser(c.get("userId"));
    return c.json({ tenants });
});

apiRouter.post("/api/tenants", async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    if (!name) {
        return c.json({ error: "name is required" }, 400);
    }

    const tenant = await createTenantForUser(c.get("userId"), name);
    return c.json({ tenant }, 201);
});

// --- WhatsApp credentials ----------------------------------------------------

apiRouter.put("/api/tenants/:tenantId/whatsapp", async (c) => {
    const tenantId = c.req.param("tenantId");
    if (!(await requireTenantMember(c, tenantId))) {
        return c.json({ error: "Not a member of this tenant" }, 403);
    }

    const { phoneNumberId, token, appSecret, webhookVerifyToken } =
        await c.req.json().catch(() => ({}));

    if (!phoneNumberId || !token || !appSecret) {
        return c.json(
            { error: "phoneNumberId, token, and appSecret are required" },
            400
        );
    }

    await upsertWhatsAppCredentials(tenantId, {
        phoneNumberId,
        token,
        appSecret,
        webhookVerifyToken
    });

    return c.body(null, 204);
});

// --- AI providers --------------------------------------------------------

const VALID_PROVIDERS: AIProviderName[] = [
    "groq",
    "openrouter",
    "openai",
    "anthropic"
];

apiRouter.get("/api/tenants/:tenantId/ai-providers", async (c) => {
    const tenantId = c.req.param("tenantId");
    if (!(await requireTenantMember(c, tenantId))) {
        return c.json({ error: "Not a member of this tenant" }, 403);
    }

    const providers = await listAIProviders(tenantId);
    return c.json({ providers });
});

apiRouter.post("/api/tenants/:tenantId/ai-providers", async (c) => {
    const tenantId = c.req.param("tenantId");
    if (!(await requireTenantMember(c, tenantId))) {
        return c.json({ error: "Not a member of this tenant" }, 403);
    }

    const { provider, apiKey, model, priority } = await c.req
        .json()
        .catch(() => ({}));

    if (!VALID_PROVIDERS.includes(provider)) {
        return c.json(
            { error: `provider must be one of: ${VALID_PROVIDERS.join(", ")}` },
            400
        );
    }
    if (!apiKey) {
        return c.json({ error: "apiKey is required" }, 400);
    }

    await addAIProvider(tenantId, {
        provider,
        apiKey,
        model,
        priority: typeof priority === "number" ? priority : 0
    });

    return c.body(null, 201);
});

apiRouter.put("/api/tenants/:tenantId/ai-providers/:providerId", async (c) => {
    const tenantId = c.req.param("tenantId");
    const providerId = c.req.param("providerId");
    if (!(await requireTenantMember(c, tenantId))) {
        return c.json({ error: "Not a member of this tenant" }, 403);
    }

    const { apiKey, model, priority, enabled } = await c.req
        .json()
        .catch(() => ({}));

    await updateAIProvider(tenantId, providerId, {
        apiKey,
        model,
        priority,
        enabled
    });

    return c.body(null, 204);
});

apiRouter.delete(
    "/api/tenants/:tenantId/ai-providers/:providerId",
    async (c) => {
        const tenantId = c.req.param("tenantId");
        const providerId = c.req.param("providerId");
        if (!(await requireTenantMember(c, tenantId))) {
            return c.json({ error: "Not a member of this tenant" }, 403);
        }

        await deleteAIProvider(tenantId, providerId);
        return c.body(null, 204);
    }
);

// --- Usage / cost visibility ------------------------------------------------

apiRouter.get("/api/tenants/:tenantId/usage", async (c) => {
    const tenantId = c.req.param("tenantId");
    if (!(await requireTenantMember(c, tenantId))) {
        return c.json({ error: "Not a member of this tenant" }, 403);
    }

    const days = Number(c.req.query("days") ?? 30);
    const summary = await getUsageSummary(tenantId, days);
    return c.json({ summary });
});

// --- Flows / rules builder (PHASES.md #3) -----------------------------------

apiRouter.get("/api/tenants/:tenantId/flows", async (c) => {
    const tenantId = c.req.param("tenantId");
    if (!(await requireTenantMember(c, tenantId))) {
        return c.json({ error: "Not a member of this tenant" }, 403);
    }

    const flows = await listFlows(tenantId);
    return c.json({ flows });
});

apiRouter.post("/api/tenants/:tenantId/flows", async (c) => {
    const tenantId = c.req.param("tenantId");
    if (!(await requireTenantMember(c, tenantId))) {
        return c.json({ error: "Not a member of this tenant" }, 403);
    }

    const { id, name, triggerType, triggerKeywords, steps, priority, enabled } =
        await c.req.json().catch(() => ({}));

    if (typeof name !== "string" || !name.trim()) {
        return c.json({ error: "name is required" }, 400);
    }
    if (triggerType !== "keyword" && triggerType !== "default") {
        return c.json(
            { error: "triggerType must be 'keyword' or 'default'" },
            400
        );
    }
    if (triggerType === "keyword" && !Array.isArray(triggerKeywords)) {
        return c.json(
            { error: "triggerKeywords is required for keyword-triggered flows" },
            400
        );
    }
    if (!Array.isArray(steps) || steps.length === 0) {
        return c.json({ error: "steps must be a non-empty array" }, 400);
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

    return c.json({ flow }, 201);
});

apiRouter.delete("/api/tenants/:tenantId/flows/:flowId", async (c) => {
    const tenantId = c.req.param("tenantId");
    const flowId = c.req.param("flowId");
    if (!(await requireTenantMember(c, tenantId))) {
        return c.json({ error: "Not a member of this tenant" }, 403);
    }

    await deleteFlow(tenantId, flowId);
    return c.body(null, 204);
});

// --- Templates / quick replies (PHASES.md #3) -------------------------------

apiRouter.get("/api/tenants/:tenantId/templates", async (c) => {
    const tenantId = c.req.param("tenantId");
    if (!(await requireTenantMember(c, tenantId))) {
        return c.json({ error: "Not a member of this tenant" }, 403);
    }

    const templates = await listTemplates(tenantId);
    return c.json({ templates });
});

apiRouter.post("/api/tenants/:tenantId/templates", async (c) => {
    const tenantId = c.req.param("tenantId");
    if (!(await requireTenantMember(c, tenantId))) {
        return c.json({ error: "Not a member of this tenant" }, 403);
    }

    const { id, name, body, quickReplies } = await c.req
        .json()
        .catch(() => ({}));

    if (typeof name !== "string" || !name.trim()) {
        return c.json({ error: "name is required" }, 400);
    }
    if (typeof body !== "string" || !body.trim()) {
        return c.json({ error: "body is required" }, 400);
    }

    try {
        const template = await upsertTemplate(tenantId, {
            id,
            name,
            body,
            quickReplies: Array.isArray(quickReplies) ? quickReplies : []
        });
        return c.json({ template }, 201);
    } catch (err) {
        return c.json({ error: (err as Error).message }, 400);
    }
});

apiRouter.delete("/api/tenants/:tenantId/templates/:templateId", async (c) => {
    const tenantId = c.req.param("tenantId");
    const templateId = c.req.param("templateId");
    if (!(await requireTenantMember(c, tenantId))) {
        return c.json({ error: "Not a member of this tenant" }, 403);
    }

    await deleteTemplate(tenantId, templateId);
    return c.body(null, 204);
});

// --- Human handoff / escalation (PHASES.md #3) ------------------------------

apiRouter.get("/api/tenants/:tenantId/conversations/escalated", async (c) => {
    const tenantId = c.req.param("tenantId");
    if (!(await requireTenantMember(c, tenantId))) {
        return c.json({ error: "Not a member of this tenant" }, 403);
    }

    const conversations = await listEscalatedConversations(tenantId);
    return c.json({ conversations });
});

apiRouter.post(
    "/api/tenants/:tenantId/conversations/:waId/resume-bot",
    async (c) => {
        const tenantId = c.req.param("tenantId");
        const waId = c.req.param("waId");
        if (!(await requireTenantMember(c, tenantId))) {
            return c.json({ error: "Not a member of this tenant" }, 403);
        }

        await resumeBotForConversation(tenantId, waId);
        return c.body(null, 204);
    }
);
