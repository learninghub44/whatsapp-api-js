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
    type UsageSummaryRow
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
