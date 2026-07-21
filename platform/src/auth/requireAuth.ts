import type { Context, Next } from "hono";
import { supabase } from "../db/client.js";

export type AuthedVars = {
    userId: string;
};

/**
 * Dashboard auth is a separate concern from WhatsApp end-users (PHASES.md
 * #2 notes) — this only guards /api/* routes used by the dashboard, never
 * the /webhook route. Expects `Authorization: Bearer <supabase-access-token>`,
 * as issued by the dashboard's Supabase Auth client-side session.
 */
export async function requireAuth(
    c: Context<{ Variables: AuthedVars }>,
    next: Next
): Promise<Response | void> {
    const header = c.req.header("authorization") ?? "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;

    if (!token) {
        return c.json({ error: "Missing bearer token" }, 401);
    }

    const { data, error } = await supabase.auth.getUser(token);

    if (error || !data.user) {
        return c.json({ error: "Invalid or expired session" }, 401);
    }

    c.set("userId", data.user.id);
    await next();
}
