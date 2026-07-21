import express, { type NextFunction, type Request, type Response } from "express";
import cors from "cors";
import { env } from "./config/env.js";
import { webhookRouter } from "./webhook.js";
import { apiRouter } from "./api.js";

const app = express();

app.get("/health", (_req, res) => {
    res.status(200).json({ status: "ok" });
});

// The SDK's handle_post/post() expect the raw request body as a string
// (used for HMAC signature verification against appSecret), not a parsed
// object — see AGENTS.md and the express middleware docs. Scoped to
// /webhook only so it doesn't shadow express.json() below for /api/*.
app.use("/webhook", express.text({ type: "*/*" }));
app.use(webhookRouter);

app.use(express.json());
app.use(
    cors({
        origin: env.dashboardOrigins ?? true,
        credentials: true
    })
);
app.use(apiRouter);

// Catches errors forwarded via next(err) from the ah() wrapper in api.ts.
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error("Unhandled API error:", err.message);
    res.status(500).json({ error: "Internal error" });
});

app.listen(env.port, () => {
    console.log(`whatsapp-platform listening on :${env.port}`);
});
