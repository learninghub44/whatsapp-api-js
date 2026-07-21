import { Hono } from "hono";
import { cors } from "hono/cors";
import { env } from "./config/env.js";
import { webhookRouter } from "./webhook.js";
import { apiRouter } from "./api.js";

const app = new Hono();

app.get("/health", (c) => c.json({ status: "ok" }));

// /webhook needs the raw body for HMAC signature verification against
// appSecret (see webhook.ts / AGENTS.md) — Hono's c.req.raw is already the
// unparsed Fetch Request, so no body-parser wiring is needed here like it
// was with Express.
app.route("/", webhookRouter);

app.use(
    "/api/*",
    cors({
        origin: env.dashboardOrigins ?? "*",
        credentials: true
    })
);
app.route("/", apiRouter);

app.onError((err, c) => {
    console.error("Unhandled API error:", err.message);
    return c.json({ error: "Internal error" }, 500);
});

export default app;
