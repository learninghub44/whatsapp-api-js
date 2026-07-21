import { createClient } from "@supabase/supabase-js";
import { env } from "../config/env.js";

/**
 * Service-role Supabase client. Bypasses RLS by design (see schema.sql) —
 * this is the only client used by this backend in Phase 1.
 */
export const supabase = createClient(
    env.supabaseUrl,
    env.supabaseServiceRoleKey,
    {
        auth: { persistSession: false }
    }
);
