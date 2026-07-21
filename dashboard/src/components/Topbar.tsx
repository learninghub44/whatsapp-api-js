"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export function Topbar({ email }: { email?: string }) {
    const router = useRouter();

    async function signOut() {
        await supabase.auth.signOut();
        router.replace("/login");
    }

    return (
        <header className="border-b border-line bg-panel">
            <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
                <Link href="/dashboard" className="flex items-baseline gap-2">
                    <span className="text-sm font-semibold tracking-tight text-ink">
                        Console
                    </span>
                    <span className="label">whatsapp platform</span>
                </Link>
                <div className="flex items-center gap-4">
                    {email && (
                        <span className="text-sm text-muted">{email}</span>
                    )}
                    <button
                        onClick={signOut}
                        className="text-sm text-muted transition hover:text-ink"
                    >
                        Sign out
                    </button>
                </div>
            </div>
        </header>
    );
}
