"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/useAuth";
import { Topbar } from "@/components/Topbar";
import { api, ApiError, type TenantMembership } from "@/lib/api";

const STATUS_STYLE: Record<string, string> = {
    active: "bg-ok-soft text-ok",
    paused: "bg-signal-soft text-signal",
    disabled: "bg-warn-soft text-warn"
};

export default function DashboardHomePage() {
    const { session, loading: authLoading } = useAuth();
    const [tenants, setTenants] = useState<TenantMembership[] | null>(null);
    const [loadError, setLoadError] = useState("");
    const [newName, setNewName] = useState("");
    const [creating, setCreating] = useState(false);
    const [createError, setCreateError] = useState("");

    useEffect(() => {
        if (!session) return;
        api.listTenants()
            .then(setTenants)
            .catch((err: unknown) =>
                setLoadError(
                    err instanceof ApiError ? err.message : "Failed to load tenants"
                )
            );
    }, [session]);

    async function createTenant(e: React.FormEvent) {
        e.preventDefault();
        if (!newName.trim()) return;
        setCreating(true);
        setCreateError("");
        try {
            const tenant = await api.createTenant(newName.trim());
            setTenants((prev) => [
                { ...tenant, role: "owner" },
                ...(prev ?? [])
            ]);
            setNewName("");
        } catch (err) {
            setCreateError(
                err instanceof ApiError ? err.message : "Failed to create tenant"
            );
        } finally {
            setCreating(false);
        }
    }

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
                <div className="mb-8 flex items-end justify-between">
                    <div>
                        <p className="label mb-1">tenants</p>
                        <h1 className="text-2xl font-semibold tracking-tight text-ink">
                            Your tenants
                        </h1>
                    </div>
                </div>

                <form
                    onSubmit={createTenant}
                    className="card mb-8 flex items-center gap-3 p-4"
                >
                    <input
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        placeholder="New tenant name"
                        className="flex-1 rounded-md border border-line bg-paper px-3 py-2 text-sm text-ink outline-none focus:border-ink"
                    />
                    <button
                        type="submit"
                        disabled={creating || !newName.trim()}
                        className="rounded-md bg-ink px-4 py-2 text-sm font-medium text-paper transition hover:opacity-90 disabled:opacity-50"
                    >
                        {creating ? "Creating…" : "Create tenant"}
                    </button>
                </form>
                {createError && (
                    <p className="-mt-6 mb-6 text-sm text-warn">{createError}</p>
                )}

                {loadError && <p className="text-sm text-warn">{loadError}</p>}

                {tenants === null && !loadError && (
                    <p className="label">Loading tenants…</p>
                )}

                {tenants !== null && tenants.length === 0 && (
                    <div className="card p-8 text-center">
                        <p className="text-sm text-muted">
                            No tenants yet. Create one above to configure a
                            WhatsApp number and AI providers.
                        </p>
                    </div>
                )}

                {tenants !== null && tenants.length > 0 && (
                    <div className="card divide-y divide-line">
                        {tenants.map((t) => (
                            <Link
                                key={t.id}
                                href={`/dashboard/${t.id}`}
                                className="flex items-center justify-between px-5 py-4 transition hover:bg-paper"
                            >
                                <div>
                                    <p className="text-sm font-medium text-ink">
                                        {t.name}
                                    </p>
                                    <p className="mt-0.5 font-mono text-xs text-muted">
                                        {t.id}
                                    </p>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className="label">{t.role}</span>
                                    <span
                                        className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                                            STATUS_STYLE[t.status] ??
                                            "bg-paper text-muted"
                                        }`}
                                    >
                                        {t.status}
                                    </span>
                                </div>
                            </Link>
                        ))}
                    </div>
                )}
            </main>
        </div>
    );
}
