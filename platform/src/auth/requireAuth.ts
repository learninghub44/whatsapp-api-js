import type { NextFunction, Request, Response } from "express";
import { supabase } from "../db/client.js";

export type AuthedRequest = Request & {
    userId?: string;
};

/**
 * Dashboard auth is a separate concern from WhatsApp end-users (PHASES.md
 * #2 notes) — this only guards /api/* routes used by the dashboard, never
 * the /webhook route. Expects `Authorization: Bearer <supabase-access-token>`,
 * as issued by the dashboard's Supabase Auth client-side session.
 */
export async function requireAuth(
    req: AuthedRequest,
    res: Response,
    next: NextFunction
): Promise<void> {
    const header = req.header("authorization") ?? "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;

    if (!token) {
        res.status(401).json({ error: "Missing bearer token" });
        return;
    }

    const { data, error } = await supabase.auth.getUser(token);

    if (error || !data.user) {
        res.status(401).json({ error: "Invalid or expired session" });
        return;
    }

    req.userId = data.user.id;
    next();
}
