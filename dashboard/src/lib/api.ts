import { supabase } from "./supabase";

const API_BASE_URL =
    process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3000";

export class ApiError extends Error {
    status: number;
    constructor(status: number, message: string) {
        super(message);
        this.status = status;
        this.name = "ApiError";
    }
}

async function request<T>(
    path: string,
    init?: RequestInit
): Promise<T> {
    const {
        data: { session }
    } = await supabase.auth.getSession();

    if (!session) {
        throw new ApiError(401, "Not signed in");
    }

    const res = await fetch(`${API_BASE_URL}${path}`, {
        ...init,
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
            ...init?.headers
        }
    });

    if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new ApiError(
            res.status,
            typeof body?.error === "string" ? body.error : res.statusText
        );
    }

    const text = await res.text();
    return (text ? JSON.parse(text) : undefined) as T;
}

// --- Tenants -----------------------------------------------------------------

export type TenantStatus = "active" | "paused" | "disabled";

export type TenantMembership = {
    id: string;
    name: string;
    status: TenantStatus;
    role: "owner" | "admin";
};

// --- AI providers --------------------------------------------------------

export type AIProviderName = "groq" | "openrouter" | "openai" | "anthropic";

export type AIProviderRow = {
    id: string;
    provider: AIProviderName;
    model: string | null;
    priority: number;
    enabled: boolean;
};

// --- Usage ---------------------------------------------------------------

export type UsageSummaryRow = {
    provider: string;
    calls: number;
    promptTokens: number;
    completionTokens: number;
    costEstimateUsd: number;
};

// --- Flows / templates (PHASES.md #3) ---------------------------------------

export type FlowStep =
    | { type: "send_text"; text: string }
    | { type: "send_template"; template: string }
    | { type: "ask"; text: string; saveAs: string }
    | { type: "handoff"; reason?: string };

export type FlowRow = {
    id: string;
    name: string;
    triggerType: "keyword" | "default";
    triggerKeywords: string[] | null;
    steps: FlowStep[];
    priority: number;
    enabled: boolean;
};

export type QuickReply = { id: string; title: string };

export type TemplateRow = {
    id: string;
    name: string;
    body: string;
    quickReplies: QuickReply[];
};

export type EscalatedConversationRow = {
    waId: string;
    reason: string | null;
    handoffAt: string | null;
};

// The backend's flow/template select queries return raw column names
// (trigger_type, trigger_keywords, quick_replies) — normalize to camelCase
// here so the rest of the dashboard doesn't deal with two casing styles.
type RawFlowRow = {
    id: string;
    name: string;
    trigger_type: "keyword" | "default";
    trigger_keywords: string[] | null;
    steps: FlowStep[];
    priority: number;
    enabled: boolean;
};

type RawTemplateRow = {
    id: string;
    name: string;
    body: string;
    quick_replies: QuickReply[];
};

function normalizeFlow(row: RawFlowRow): FlowRow {
    return {
        id: row.id,
        name: row.name,
        triggerType: row.trigger_type,
        triggerKeywords: row.trigger_keywords,
        steps: row.steps,
        priority: row.priority,
        enabled: row.enabled
    };
}

function normalizeTemplate(row: RawTemplateRow): TemplateRow {
    return {
        id: row.id,
        name: row.name,
        body: row.body,
        quickReplies: row.quick_replies
    };
}

export const api = {
    // --- Tenants ---
    listTenants: () =>
        request<{ tenants: TenantMembership[] }>("/api/tenants").then(
            (r) => r.tenants
        ),
    createTenant: (name: string) =>
        request<{ tenant: { id: string; name: string; status: TenantStatus } }>(
            "/api/tenants",
            { method: "POST", body: JSON.stringify({ name }) }
        ).then((r) => r.tenant),

    // --- WhatsApp credentials ---
    upsertWhatsApp: (
        tenantId: string,
        creds: {
            phoneNumberId: string;
            token: string;
            appSecret: string;
            webhookVerifyToken?: string;
        }
    ) =>
        request<void>(`/api/tenants/${tenantId}/whatsapp`, {
            method: "PUT",
            body: JSON.stringify(creds)
        }),

    // --- AI providers ---
    listAIProviders: (tenantId: string) =>
        request<{ providers: AIProviderRow[] }>(
            `/api/tenants/${tenantId}/ai-providers`
        ).then((r) => r.providers),
    addAIProvider: (
        tenantId: string,
        input: {
            provider: AIProviderName;
            apiKey: string;
            model?: string;
            priority: number;
        }
    ) =>
        request<void>(`/api/tenants/${tenantId}/ai-providers`, {
            method: "POST",
            body: JSON.stringify(input)
        }),
    updateAIProvider: (
        tenantId: string,
        providerId: string,
        patch: Partial<{
            apiKey: string;
            model: string | null;
            priority: number;
            enabled: boolean;
        }>
    ) =>
        request<void>(`/api/tenants/${tenantId}/ai-providers/${providerId}`, {
            method: "PUT",
            body: JSON.stringify(patch)
        }),
    deleteAIProvider: (tenantId: string, providerId: string) =>
        request<void>(`/api/tenants/${tenantId}/ai-providers/${providerId}`, {
            method: "DELETE"
        }),

    // --- Usage ---
    getUsageSummary: (tenantId: string, days = 30) =>
        request<{ summary: UsageSummaryRow[] }>(
            `/api/tenants/${tenantId}/usage?days=${days}`
        ).then((r) => r.summary),

    // --- Flows ---
    listFlows: (tenantId: string) =>
        request<{ flows: RawFlowRow[] }>(`/api/tenants/${tenantId}/flows`).then(
            (r) => r.flows.map(normalizeFlow)
        ),
    upsertFlow: (
        tenantId: string,
        flow: {
            id?: string;
            name: string;
            triggerType: "keyword" | "default";
            triggerKeywords: string[] | null;
            steps: FlowStep[];
            priority?: number;
            enabled?: boolean;
        }
    ) =>
        request<{ flow: RawFlowRow }>(`/api/tenants/${tenantId}/flows`, {
            method: "POST",
            body: JSON.stringify(flow)
        }).then((r) => normalizeFlow(r.flow)),
    deleteFlow: (tenantId: string, flowId: string) =>
        request<void>(`/api/tenants/${tenantId}/flows/${flowId}`, {
            method: "DELETE"
        }),

    // --- Templates ---
    listTemplates: (tenantId: string) =>
        request<{ templates: RawTemplateRow[] }>(
            `/api/tenants/${tenantId}/templates`
        ).then((r) => r.templates.map(normalizeTemplate)),
    upsertTemplate: (
        tenantId: string,
        template: { id?: string; name: string; body: string; quickReplies: QuickReply[] }
    ) =>
        request<{ template: RawTemplateRow }>(
            `/api/tenants/${tenantId}/templates`,
            { method: "POST", body: JSON.stringify(template) }
        ).then((r) => normalizeTemplate(r.template)),
    deleteTemplate: (tenantId: string, templateId: string) =>
        request<void>(`/api/tenants/${tenantId}/templates/${templateId}`, {
            method: "DELETE"
        }),

    // --- Human handoff ---
    listEscalatedConversations: (tenantId: string) =>
        request<{ conversations: EscalatedConversationRow[] }>(
            `/api/tenants/${tenantId}/conversations/escalated`
        ).then((r) => r.conversations),
    resumeBot: (tenantId: string, waId: string) =>
        request<void>(
            `/api/tenants/${tenantId}/conversations/${encodeURIComponent(waId)}/resume-bot`,
            { method: "POST" }
        )
};
