import express from "express";
import { env } from "./config/env.js";
import { webhookRouter } from "./webhook.js";

const app = express();

// The SDK's handle_post/post() expect the raw request body as a string
// (used for HMAC signature verification against appSecret), not a parsed
// object — see AGENTS.md and the express middleware docs.
app.use(express.text({ type: "*/*" }));

app.get("/health", (_req, res) => {
    res.status(200).json({ status: "ok" });
});

app.use(webhookRouter);

app.listen(env.port, () => {
    console.log(`whatsapp-platform listening on :${env.port}`);
});
