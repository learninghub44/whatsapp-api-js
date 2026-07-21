"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";

/**
 * Tracks the current dashboard-account session. Pages consume `session` +
 * `loading` to gate their own render (see dashboard/page.tsx and
 * dashboard/[tenantId]/page.tsx); this hook also redirects to /login the
 * moment the session disappears, so pages don't each need that logic.
 */
export function useAuth(): { session: Session | null; loading: boolean } {
    const router = useRouter();
    const [session, setSession] = useState<Session | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        supabase.auth.getSession().then(({ data }) => {
            setSession(data.session);
            setLoading(false);
            if (!data.session) router.replace("/login");
        });

        const {
            data: { subscription }
        } = supabase.auth.onAuthStateChange((_event, newSession) => {
            setSession(newSession);
            setLoading(false);
            if (!newSession) router.replace("/login");
        });

        return () => subscription.unsubscribe();
    }, [router]);

    return { session, loading };
}
