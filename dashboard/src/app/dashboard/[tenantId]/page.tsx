"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/useAuth";
import { Topbar } from "@/components/Topbar";
import {
    api,
    ApiError,
    type AIProviderName,
    type AIProviderRow,
    type UsageSummaryRow,
    type FlowRow,
    type FlowStep,
    type TemplateRow,
    type QuickReply,
    type EscalatedConversationRow
} from "@/lib/api";

const PROVIDERS: AIProviderName[] = [
    "groq",
    "openrouter",
    "openai",
    "anthropic"
];

export default function TenantDetailPage({
    params
}: {
    params: { tenantId: string };
}) {
    const { tenantId } = params;
    const { session, loading: authLoading } = useAuth();

    if (authLoading) {
        return (
            <div className="flex min-h-screen items-center justify-center">
                <span className="label">Loading…</span>
            </div>
        );
    }

    return (
        <div className="min-h-screen">
            <Topbar email={session?.user.email} />
            <main className="mx-auto max-w-5xl px-6 py-10">
                <div className="mb-8">
                    <Link
                        href="/dashboard"
                        className="label mb-3 inline-block text-muted hover:text-ink"
                    >
                        ← all tenants
                    </Link>
                    <p className="label mb-1">tenant</p>
                    <h1 className="font-mono text-xl font-semibold tracking-tight text-ink">
                        {tenantId}
                    </h1>
                </div>

                <div className="space-y-10">
                    <WhatsAppSection tenantId={tenantId} />
                    <AIProvidersSection tenantId={tenantId} />
                    <HandoffSection tenantId={tenantId} />
                    <TemplatesSection tenantId={tenantId} />
                    <FlowsSection tenantId={tenantId} />
                    <UsageSection tenantId={tenantId} />
                </div>
            </main>
        </div>
    );
}

// --- WhatsApp credentials ----------------------------------------------------

function WhatsAppSection({ tenantId }: { tenantId: string }) {
    const [phoneNumberId, setPhoneNumberId] = useState("");
    const [token, setToken] = useState("");
    const [appSecret, setAppSecret] = useState("");
    const [webhookVerifyToken, setWebhookVerifyToken] = useState("");
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [error, setError] = useState("");

    async function save(e: React.FormEvent) {
        e.preventDefault();
        setSaving(true);
        setError("");
        setSaved(false);
        try {
            await api.upsertWhatsApp(tenantId, {
                phoneNumberId,
                token,
                appSecret,
                webhookVerifyToken: webhookVerifyToken || undefined
            });
            setSaved(true);
        } catch (err) {
            setError(
                err instanceof ApiError ? err.message : "Failed to save credentials"
            );
        } finally {
            setSaving(false);
        }
    }

    return (
        <section>
            <p className="label mb-1">whatsapp</p>
            <h2 className="mb-4 text-lg font-semibold text-ink">
                Cloud API credentials
            </h2>
            <form onSubmit={save} className="card space-y-3 p-5">
                <Field
                    label="Phone number ID"
                    value={phoneNumberId}
                    onChange={setPhoneNumberId}
                    required
                />
                <Field
                    label="Access token"
                    value={token}
                    onChange={setToken}
                    type="password"
                    required
                />
                <Field
                    label="App secret"
                    value={appSecret}
                    onChange={setAppSecret}
                    type="password"
                    required
                />
                <Field
                    label="Webhook verify token (optional)"
                    value={webhookVerifyToken}
                    onChange={setWebhookVerifyToken}
                />
                <div className="flex items-center gap-3 pt-1">
                    <button
                        type="submit"
                        disabled={saving}
                        className="rounded-md bg-ink px-4 py-2 text-sm font-medium text-paper transition hover:opacity-90 disabled:opacity-50"
                    >
                        {saving ? "Saving…" : "Save credentials"}
                    </button>
                    {saved && (
                        <span className="text-sm text-ok">Saved.</span>
                    )}
                    {error && <span className="text-sm text-warn">{error}</span>}
                </div>
            </form>
        </section>
    );
}

// --- AI providers --------------------------------------------------------

function AIProvidersSection({ tenantId }: { tenantId: string }) {
    const [providers, setProviders] = useState<AIProviderRow[] | null>(null);
    const [error, setError] = useState("");

    const [provider, setProvider] = useState<AIProviderName>("groq");
    const [apiKey, setApiKey] = useState("");
    const [model, setModel] = useState("");
    const [priority, setPriority] = useState(0);
    const [adding, setAdding] = useState(false);

    function refresh() {
        api.listAIProviders(tenantId)
            .then(setProviders)
            .catch((err: unknown) =>
                setError(
                    err instanceof ApiError
                        ? err.message
                        : "Failed to load AI providers"
                )
            );
    }

    useEffect(refresh, [tenantId]);

    async function add(e: React.FormEvent) {
        e.preventDefault();
        if (!apiKey.trim()) return;
        setAdding(true);
        setError("");
        try {
            await api.addAIProvider(tenantId, {
                provider,
                apiKey: apiKey.trim(),
                model: model.trim() || undefined,
                priority
            });
            setApiKey("");
            setModel("");
            setPriority(0);
            refresh();
        } catch (err) {
            setError(
                err instanceof ApiError ? err.message : "Failed to add provider"
            );
        } finally {
            setAdding(false);
        }
    }

    async function toggleEnabled(row: AIProviderRow) {
        await api.updateAIProvider(tenantId, row.id, {
            enabled: !row.enabled
        });
        refresh();
    }

    async function remove(row: AIProviderRow) {
        await api.deleteAIProvider(tenantId, row.id);
        refresh();
    }

    return (
        <section>
            <p className="label mb-1">ai providers</p>
            <h2 className="mb-4 text-lg font-semibold text-ink">
                Fallback chain
            </h2>

            {providers !== null && providers.length > 0 && (
                <div className="card mb-4 divide-y divide-line">
                    {providers
                        .slice()
                        .sort((a, b) => a.priority - b.priority)
                        .map((row) => (
                            <div
                                key={row.id}
                                className="flex items-center justify-between px-5 py-3"
                            >
                                <div className="flex items-center gap-3">
                                    <span className="label w-6 text-right">
                                        {row.priority}
                                    </span>
                                    <div>
                                        <p className="text-sm font-medium text-ink">
                                            {row.provider}
                                        </p>
                                        {row.model && (
                                            <p className="font-mono text-xs text-muted">
                                                {row.model}
                                            </p>
                                        )}
                                    </div>
                                </div>
                                <div className="flex items-center gap-4">
                                    <button
                                        onClick={() => toggleEnabled(row)}
                                        className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                                            row.enabled
                                                ? "bg-ok-soft text-ok"
                                                : "bg-paper text-muted"
                                        }`}
                                    >
                                        {row.enabled ? "enabled" : "disabled"}
                                    </button>
                                    <button
                                        onClick={() => remove(row)}
                                        className="text-sm text-muted hover:text-warn"
                                    >
                                        Remove
                                    </button>
                                </div>
                            </div>
                        ))}
                </div>
            )}

            {providers !== null && providers.length === 0 && (
                <p className="mb-4 text-sm text-muted">
                    No AI providers configured yet — this tenant can&apos;t
                    reply until at least one is added.
                </p>
            )}

            <form onSubmit={add} className="card flex flex-wrap items-end gap-3 p-4">
                <div>
                    <label className="label mb-1 block">Provider</label>
                    <select
                        value={provider}
                        onChange={(e) =>
                            setProvider(e.target.value as AIProviderName)
                        }
                        className="rounded-md border border-line bg-paper px-3 py-2 text-sm text-ink outline-none focus:border-ink"
                    >
                        {PROVIDERS.map((p) => (
                            <option key={p} value={p}>
                                {p}
                            </option>
                        ))}
                    </select>
                </div>
                <div className="flex-1">
                    <label className="label mb-1 block">API key</label>
                    <input
                        type="password"
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        className="w-full rounded-md border border-line bg-paper px-3 py-2 text-sm text-ink outline-none focus:border-ink"
                    />
                </div>
                <div>
                    <label className="label mb-1 block">
                        Model (optional)
                    </label>
                    <input
                        value={model}
                        onChange={(e) => setModel(e.target.value)}
                        placeholder="default"
                        className="w-36 rounded-md border border-line bg-paper px-3 py-2 text-sm text-ink outline-none focus:border-ink"
                    />
                </div>
                <div>
                    <label className="label mb-1 block">Priority</label>
                    <input
                        type="number"
                        value={priority}
                        onChange={(e) => setPriority(Number(e.target.value))}
                        className="w-20 rounded-md border border-line bg-paper px-3 py-2 text-sm text-ink outline-none focus:border-ink"
                    />
                </div>
                <button
                    type="submit"
                    disabled={adding || !apiKey.trim()}
                    className="rounded-md bg-ink px-4 py-2 text-sm font-medium text-paper transition hover:opacity-90 disabled:opacity-50"
                >
                    {adding ? "Adding…" : "Add provider"}
                </button>
            </form>
            {error && <p className="mt-3 text-sm text-warn">{error}</p>}
        </section>
    );
}

// --- Usage / cost visibility ------------------------------------------------

function UsageSection({ tenantId }: { tenantId: string }) {
    const [summary, setSummary] = useState<UsageSummaryRow[] | null>(null);
    const [days, setDays] = useState(30);
    const [error, setError] = useState("");

    useEffect(() => {
        api.getUsageSummary(tenantId, days)
            .then(setSummary)
            .catch((err: unknown) =>
                setError(
                    err instanceof ApiError ? err.message : "Failed to load usage"
                )
            );
    }, [tenantId, days]);

    const totalCost = summary?.reduce((sum, r) => sum + r.costEstimateUsd, 0) ?? 0;
    const totalCalls = summary?.reduce((sum, r) => sum + r.calls, 0) ?? 0;

    return (
        <section>
            <div className="mb-4 flex items-end justify-between">
                <div>
                    <p className="label mb-1">usage</p>
                    <h2 className="text-lg font-semibold text-ink">
                        Cost &amp; call volume
                    </h2>
                </div>
                <select
                    value={days}
                    onChange={(e) => setDays(Number(e.target.value))}
                    className="rounded-md border border-line bg-paper px-3 py-1.5 text-sm text-ink outline-none focus:border-ink"
                >
                    <option value={7}>Last 7 days</option>
                    <option value={30}>Last 30 days</option>
                    <option value={90}>Last 90 days</option>
                </select>
            </div>

            {error && <p className="text-sm text-warn">{error}</p>}

            {summary !== null && (
                <>
                    <div className="mb-4 flex gap-3">
                        <div className="card flex-1 p-4">
                            <p className="label mb-1">total calls</p>
                            <p className="font-mono text-2xl text-ink">
                                {totalCalls.toLocaleString()}
                            </p>
                        </div>
                        <div className="card flex-1 p-4">
                            <p className="label mb-1">estimated cost</p>
                            <p className="font-mono text-2xl text-ink">
                                ${totalCost.toFixed(4)}
                            </p>
                        </div>
                    </div>

                    {summary.length === 0 ? (
                        <div className="card p-8 text-center">
                            <p className="text-sm text-muted">
                                No usage recorded in this window yet.
                            </p>
                        </div>
                    ) : (
                        <div className="card overflow-hidden">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-line text-left">
                                        <th className="label px-5 py-3 font-normal">
                                            Provider
                                        </th>
                                        <th className="label px-5 py-3 font-normal">
                                            Calls
                                        </th>
                                        <th className="label px-5 py-3 font-normal">
                                            Prompt tokens
                                        </th>
                                        <th className="label px-5 py-3 font-normal">
                                            Completion tokens
                                        </th>
                                        <th className="label px-5 py-3 text-right font-normal">
                                            Cost (USD)
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-line">
                                    {summary.map((row) => (
                                        <tr key={row.provider}>
                                            <td className="px-5 py-3 font-medium text-ink">
                                                {row.provider}
                                            </td>
                                            <td className="px-5 py-3 font-mono text-ink">
                                                {row.calls.toLocaleString()}
                                            </td>
                                            <td className="px-5 py-3 font-mono text-muted">
                                                {row.promptTokens.toLocaleString()}
                                            </td>
                                            <td className="px-5 py-3 font-mono text-muted">
                                                {row.completionTokens.toLocaleString()}
                                            </td>
                                            <td className="px-5 py-3 text-right font-mono text-ink">
                                                ${row.costEstimateUsd.toFixed(4)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </>
            )}
        </section>
    );
}

// --- Human handoff / escalation ---------------------------------------------

function HandoffSection({ tenantId }: { tenantId: string }) {
    const [conversations, setConversations] = useState<
        EscalatedConversationRow[] | null
    >(null);
    const [error, setError] = useState("");
    const [resuming, setResuming] = useState<string | null>(null);

    function refresh() {
        api.listEscalatedConversations(tenantId)
            .then(setConversations)
            .catch((err: unknown) =>
                setError(
                    err instanceof ApiError
                        ? err.message
                        : "Failed to load escalated conversations"
                )
            );
    }

    useEffect(refresh, [tenantId]);

    async function resume(waId: string) {
        setResuming(waId);
        try {
            await api.resumeBot(tenantId, waId);
            refresh();
        } catch (err) {
            setError(
                err instanceof ApiError ? err.message : "Failed to resume bot"
            );
        } finally {
            setResuming(null);
        }
    }

    return (
        <section>
            <p className="label mb-1">human handoff</p>
            <h2 className="mb-4 text-lg font-semibold text-ink">
                Escalated conversations
            </h2>

            {error && <p className="mb-3 text-sm text-warn">{error}</p>}

            {conversations !== null && conversations.length === 0 && (
                <div className="card p-8 text-center">
                    <p className="text-sm text-muted">
                        No conversations are currently waiting on a human — the
                        bot is handling everything.
                    </p>
                </div>
            )}

            {conversations !== null && conversations.length > 0 && (
                <div className="card divide-y divide-line">
                    {conversations.map((c) => (
                        <div
                            key={c.waId}
                            className="flex items-center justify-between px-5 py-3"
                        >
                            <div>
                                <p className="font-mono text-sm text-ink">
                                    {c.waId}
                                </p>
                                {c.reason && (
                                    <p className="mt-0.5 text-xs text-muted">
                                        {c.reason}
                                    </p>
                                )}
                            </div>
                            <button
                                onClick={() => resume(c.waId)}
                                disabled={resuming === c.waId}
                                className="rounded-md border border-line px-3 py-1.5 text-sm font-medium text-ink transition hover:bg-paper disabled:opacity-50"
                            >
                                {resuming === c.waId ? "Resuming…" : "Resume bot"}
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </section>
    );
}

// --- Templates / quick replies -----------------------------------------------

function parseQuickReplies(input: string): QuickReply[] {
    return input
        .split(",")
        .map((part) => part.trim())
        .filter(Boolean)
        .slice(0, 3)
        .map((part) => {
            const [id = "", ...rest] = part.split(":");
            const title = rest.join(":").trim();
            return { id: id.trim(), title: title || id.trim() };
        });
}

function TemplatesSection({ tenantId }: { tenantId: string }) {
    const [templates, setTemplates] = useState<TemplateRow[] | null>(null);
    const [error, setError] = useState("");

    const [name, setName] = useState("");
    const [body, setBody] = useState("");
    const [quickRepliesInput, setQuickRepliesInput] = useState("");
    const [saving, setSaving] = useState(false);

    function refresh() {
        api.listTemplates(tenantId)
            .then(setTemplates)
            .catch((err: unknown) =>
                setError(
                    err instanceof ApiError
                        ? err.message
                        : "Failed to load templates"
                )
            );
    }

    useEffect(refresh, [tenantId]);

    async function save(e: React.FormEvent) {
        e.preventDefault();
        if (!name.trim() || !body.trim()) return;
        setSaving(true);
        setError("");
        try {
            await api.upsertTemplate(tenantId, {
                name: name.trim(),
                body: body.trim(),
                quickReplies: parseQuickReplies(quickRepliesInput)
            });
            setName("");
            setBody("");
            setQuickRepliesInput("");
            refresh();
        } catch (err) {
            setError(
                err instanceof ApiError ? err.message : "Failed to save template"
            );
        } finally {
            setSaving(false);
        }
    }

    async function remove(t: TemplateRow) {
        await api.deleteTemplate(tenantId, t.id);
        refresh();
    }

    return (
        <section>
            <p className="label mb-1">templates</p>
            <h2 className="mb-4 text-lg font-semibold text-ink">
                Canned messages &amp; quick replies
            </h2>

            {templates !== null && templates.length > 0 && (
                <div className="card mb-4 divide-y divide-line">
                    {templates.map((t) => (
                        <div key={t.id} className="px-5 py-3">
                            <div className="flex items-center justify-between">
                                <p className="text-sm font-medium text-ink">
                                    {t.name}
                                </p>
                                <button
                                    onClick={() => remove(t)}
                                    className="text-sm text-muted hover:text-warn"
                                >
                                    Remove
                                </button>
                            </div>
                            <p className="mt-1 text-sm text-muted">{t.body}</p>
                            {t.quickReplies.length > 0 && (
                                <div className="mt-2 flex flex-wrap gap-1.5">
                                    {t.quickReplies.map((qr) => (
                                        <span
                                            key={qr.id}
                                            className="rounded-full bg-paper px-2.5 py-1 text-xs text-ink"
                                        >
                                            {qr.title}
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            <form onSubmit={save} className="card space-y-3 p-5">
                <Field label="Name" value={name} onChange={setName} required />
                <div>
                    <label className="label mb-1 block">Body</label>
                    <textarea
                        value={body}
                        onChange={(e) => setBody(e.target.value)}
                        required
                        rows={3}
                        className="w-full rounded-md border border-line bg-paper px-3 py-2 text-sm text-ink outline-none focus:border-ink"
                    />
                </div>
                <Field
                    label="Quick replies (optional, up to 3, id:Title comma-separated)"
                    value={quickRepliesInput}
                    onChange={setQuickRepliesInput}
                />
                <div className="flex items-center gap-3 pt-1">
                    <button
                        type="submit"
                        disabled={saving || !name.trim() || !body.trim()}
                        className="rounded-md bg-ink px-4 py-2 text-sm font-medium text-paper transition hover:opacity-90 disabled:opacity-50"
                    >
                        {saving ? "Saving…" : "Save template"}
                    </button>
                    {error && <span className="text-sm text-warn">{error}</span>}
                </div>
            </form>
        </section>
    );
}

// --- Flows / rules builder ---------------------------------------------------

const STEP_TYPES: FlowStep["type"][] = [
    "send_text",
    "send_template",
    "ask",
    "handoff"
];

function describeStep(step: FlowStep): string {
    switch (step.type) {
        case "send_text":
            return `Send: "${step.text}"`;
        case "send_template":
            return `Send template: ${step.template}`;
        case "ask":
            return `Ask: "${step.text}" → save as {{${step.saveAs}}}`;
        case "handoff":
            return `Hand off to human${step.reason ? ` (${step.reason})` : ""}`;
    }
}

function FlowsSection({ tenantId }: { tenantId: string }) {
    const [flows, setFlows] = useState<FlowRow[] | null>(null);
    const [error, setError] = useState("");

    const [name, setName] = useState("");
    const [triggerType, setTriggerType] = useState<"keyword" | "default">(
        "keyword"
    );
    const [keywordsInput, setKeywordsInput] = useState("");
    const [steps, setSteps] = useState<FlowStep[]>([]);
    const [saving, setSaving] = useState(false);

    // Add-step sub-form.
    const [stepType, setStepType] = useState<FlowStep["type"]>("send_text");
    const [stepText, setStepText] = useState("");
    const [stepTemplate, setStepTemplate] = useState("");
    const [stepSaveAs, setStepSaveAs] = useState("");
    const [stepReason, setStepReason] = useState("");

    function refresh() {
        api.listFlows(tenantId)
            .then(setFlows)
            .catch((err: unknown) =>
                setError(
                    err instanceof ApiError ? err.message : "Failed to load flows"
                )
            );
    }

    useEffect(refresh, [tenantId]);

    function addStep() {
        if (stepType === "send_text" && stepText.trim()) {
            setSteps((prev) => [...prev, { type: "send_text", text: stepText.trim() }]);
        } else if (stepType === "send_template" && stepTemplate.trim()) {
            setSteps((prev) => [
                ...prev,
                { type: "send_template", template: stepTemplate.trim() }
            ]);
        } else if (stepType === "ask" && stepText.trim() && stepSaveAs.trim()) {
            setSteps((prev) => [
                ...prev,
                { type: "ask", text: stepText.trim(), saveAs: stepSaveAs.trim() }
            ]);
        } else if (stepType === "handoff") {
            setSteps((prev) => [
                ...prev,
                { type: "handoff", reason: stepReason.trim() || undefined }
            ]);
        } else {
            return;
        }
        setStepText("");
        setStepTemplate("");
        setStepSaveAs("");
        setStepReason("");
    }

    function removeStep(index: number) {
        setSteps((prev) => prev.filter((_, i) => i !== index));
    }

    async function save(e: React.FormEvent) {
        e.preventDefault();
        if (!name.trim() || steps.length === 0) return;
        setSaving(true);
        setError("");
        try {
            await api.upsertFlow(tenantId, {
                name: name.trim(),
                triggerType,
                triggerKeywords:
                    triggerType === "keyword"
                        ? keywordsInput
                              .split(",")
                              .map((k) => k.trim())
                              .filter(Boolean)
                        : null,
                steps
            });
            setName("");
            setKeywordsInput("");
            setSteps([]);
            refresh();
        } catch (err) {
            setError(
                err instanceof ApiError ? err.message : "Failed to save flow"
            );
        } finally {
            setSaving(false);
        }
    }

    async function toggleEnabled(flow: FlowRow) {
        await api.upsertFlow(tenantId, { ...flow, enabled: !flow.enabled });
        refresh();
    }

    async function remove(flow: FlowRow) {
        await api.deleteFlow(tenantId, flow.id);
        refresh();
    }

    return (
        <section>
            <p className="label mb-1">flows</p>
            <h2 className="mb-4 text-lg font-semibold text-ink">
                Rules builder
            </h2>

            {flows !== null && flows.length > 0 && (
                <div className="card mb-4 divide-y divide-line">
                    {flows.map((flow) => (
                        <div key={flow.id} className="px-5 py-3">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-medium text-ink">
                                        {flow.name}
                                    </p>
                                    <p className="label mt-0.5">
                                        {flow.triggerType === "default"
                                            ? "default fallback"
                                            : `on: ${(flow.triggerKeywords ?? []).join(", ")}`}
                                    </p>
                                </div>
                                <div className="flex items-center gap-4">
                                    <button
                                        onClick={() => toggleEnabled(flow)}
                                        className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                                            flow.enabled
                                                ? "bg-ok-soft text-ok"
                                                : "bg-paper text-muted"
                                        }`}
                                    >
                                        {flow.enabled ? "enabled" : "disabled"}
                                    </button>
                                    <button
                                        onClick={() => remove(flow)}
                                        className="text-sm text-muted hover:text-warn"
                                    >
                                        Remove
                                    </button>
                                </div>
                            </div>
                            <ol className="mt-2 space-y-0.5">
                                {flow.steps.map((step, i) => (
                                    <li
                                        key={i}
                                        className="font-mono text-xs text-muted"
                                    >
                                        {i + 1}. {describeStep(step)}
                                    </li>
                                ))}
                            </ol>
                        </div>
                    ))}
                </div>
            )}

            <form onSubmit={save} className="card space-y-4 p-5">
                <div className="flex flex-wrap gap-3">
                    <div className="flex-1">
                        <Field label="Name" value={name} onChange={setName} required />
                    </div>
                    <div>
                        <label className="label mb-1 block">Trigger</label>
                        <select
                            value={triggerType}
                            onChange={(e) =>
                                setTriggerType(
                                    e.target.value as "keyword" | "default"
                                )
                            }
                            className="rounded-md border border-line bg-paper px-3 py-2 text-sm text-ink outline-none focus:border-ink"
                        >
                            <option value="keyword">Keyword match</option>
                            <option value="default">Default fallback</option>
                        </select>
                    </div>
                </div>

                {triggerType === "keyword" && (
                    <Field
                        label="Keywords (comma-separated, matched anywhere in the message)"
                        value={keywordsInput}
                        onChange={setKeywordsInput}
                    />
                )}

                <div>
                    <label className="label mb-2 block">Steps</label>
                    {steps.length > 0 && (
                        <ol className="mb-3 space-y-1">
                            {steps.map((step, i) => (
                                <li
                                    key={i}
                                    className="flex items-center justify-between rounded-md bg-paper px-3 py-2 text-sm text-ink"
                                >
                                    <span className="font-mono text-xs">
                                        {i + 1}. {describeStep(step)}
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => removeStep(i)}
                                        className="text-xs text-muted hover:text-warn"
                                    >
                                        Remove
                                    </button>
                                </li>
                            ))}
                        </ol>
                    )}

                    <div className="flex flex-wrap items-end gap-2 rounded-md border border-dashed border-line p-3">
                        <div>
                            <label className="label mb-1 block">Step type</label>
                            <select
                                value={stepType}
                                onChange={(e) =>
                                    setStepType(e.target.value as FlowStep["type"])
                                }
                                className="rounded-md border border-line bg-paper px-3 py-2 text-sm text-ink outline-none focus:border-ink"
                            >
                                {STEP_TYPES.map((t) => (
                                    <option key={t} value={t}>
                                        {t}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {(stepType === "send_text" || stepType === "ask") && (
                            <div className="flex-1">
                                <label className="label mb-1 block">Text</label>
                                <input
                                    value={stepText}
                                    onChange={(e) => setStepText(e.target.value)}
                                    placeholder="Use {{var}} to insert an earlier answer"
                                    className="w-full rounded-md border border-line bg-paper px-3 py-2 text-sm text-ink outline-none focus:border-ink"
                                />
                            </div>
                        )}

                        {stepType === "send_template" && (
                            <div className="flex-1">
                                <label className="label mb-1 block">
                                    Template name
                                </label>
                                <input
                                    value={stepTemplate}
                                    onChange={(e) => setStepTemplate(e.target.value)}
                                    className="w-full rounded-md border border-line bg-paper px-3 py-2 text-sm text-ink outline-none focus:border-ink"
                                />
                            </div>
                        )}

                        {stepType === "ask" && (
                            <div>
                                <label className="label mb-1 block">Save as</label>
                                <input
                                    value={stepSaveAs}
                                    onChange={(e) => setStepSaveAs(e.target.value)}
                                    placeholder="name"
                                    className="w-32 rounded-md border border-line bg-paper px-3 py-2 text-sm text-ink outline-none focus:border-ink"
                                />
                            </div>
                        )}

                        {stepType === "handoff" && (
                            <div className="flex-1">
                                <label className="label mb-1 block">
                                    Reason (optional)
                                </label>
                                <input
                                    value={stepReason}
                                    onChange={(e) => setStepReason(e.target.value)}
                                    className="w-full rounded-md border border-line bg-paper px-3 py-2 text-sm text-ink outline-none focus:border-ink"
                                />
                            </div>
                        )}

                        <button
                            type="button"
                            onClick={addStep}
                            className="rounded-md border border-line px-3 py-2 text-sm font-medium text-ink transition hover:bg-paper"
                        >
                            Add step
                        </button>
                    </div>
                </div>

                <div className="flex items-center gap-3 pt-1">
                    <button
                        type="submit"
                        disabled={saving || !name.trim() || steps.length === 0}
                        className="rounded-md bg-ink px-4 py-2 text-sm font-medium text-paper transition hover:opacity-90 disabled:opacity-50"
                    >
                        {saving ? "Saving…" : "Save flow"}
                    </button>
                    {error && <span className="text-sm text-warn">{error}</span>}
                </div>
            </form>
        </section>
    );
}

function Field({
    label,
    value,
    onChange,
    type = "text",
    required
}: {
    label: string;
    value: string;
    onChange: (v: string) => void;
    type?: string;
    required?: boolean;
}) {
    return (
        <div>
            <label className="label mb-1 block">{label}</label>
            <input
                type={type}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                required={required}
                className="w-full rounded-md border border-line bg-paper px-3 py-2 text-sm text-ink outline-none focus:border-ink"
            />
        </div>
    );
}
