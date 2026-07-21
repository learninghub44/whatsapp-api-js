import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
    throw new Error(
        "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY — see dashboard/.env.example"
    );
}

/**
 * Browser-side Supabase client, anon key only (safe to ship to the client).
 * Used solely for dashboard-account auth (magic link sign-in/out) — all
 * tenant/flow/usage data goes through the platform API (see api.ts), which
 * uses the resulting session's access token as a bearer credential.
 */
export const supabase = createClient(url, anonKey, {
    auth: {
        persistSession: true,
        autoRefreshToken: true
    }
});
