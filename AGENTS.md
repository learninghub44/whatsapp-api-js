# AGENTS.md — Guide for AI Agents

This file orients AI coding agents (Claude, GPT, etc.) working in this
repository. Read this before making changes or generating integration code.

## What this repo is

`whatsapp-api-js` is a **lightweight, dependency-free TypeScript SDK** for
the official **Meta WhatsApp Cloud API**. It is a backend library, not an
application.

- npm package: `whatsapp-api-js` (v6.2.2)
- License: MIT
- Node: `>=16`
- Module type: ESM (`"type": "module"`)
- Package manager used by this repo: **pnpm**

## What it does

- Sends WhatsApp messages (text, media, interactive, template, reaction,
  location, contacts) via the Cloud API.
- Parses and verifies incoming webhooks from Meta.
- Emits events for received messages/statuses via `src/emitters.ts`.
- Ships ready-made middleware adapters for common runtimes/frameworks.

## What it does NOT do

Be explicit about this with users — do not assume these exist:

- **No frontend / UI.** There is no dashboard, admin panel, or client app.
  Consumers call this library from their own backend code.
- **No multi-tenancy.** One `WhatsAppAPI` instance = one token/app-secret
  pair. Multi-tenant support (multiple WhatsApp Business accounts, tenant
  isolation, per-tenant storage/routing) must be built by the consumer,
  typically by instantiating one `WhatsAppAPI` object per tenant.
- **No user accounts / auth.** No login, sessions, roles, or permissions.
- **No database or persistence layer.** Nothing is stored; webhook state
  (e.g. `waitUntilTheEndOfTime`) is left to the consumer.

## Directory layout

```
src/
  apis/         # Low-level Cloud API calls (messages, media, webhooks, block, call, qr)
  messages/     # Message type builders (text, media, interactive, template, location, contacts, reaction)
  middleware/   # Framework adapters: express, next, cloudflare, deno, bun, adonis,
                # azure, sveltekit, vercel, node-http, web-standard
  setup/        # Runtime-specific setup helpers (node, bun, deno, web)
  index.ts      # Main WhatsAppAPI class export
  emitters.ts   # Event emitter for incoming messages/statuses
  errors.ts     # Error types
  types.ts      # Shared TS types
  utils.ts      # Shared utilities
test/           # Unit tests (uses payload/server/webhook mocks)
EXAMPLES/       # Usage docs per message type (text, media, template, etc.)
```

## Core usage pattern

```ts
import { WhatsAppAPI } from "whatsapp-api-js";
import { Text } from "whatsapp-api-js/messages";

const Whatsapp = new WhatsAppAPI({ token: TOKEN, appSecret: APP_SECRET });

// In your HTTP handler:
async function post(req) {
    return await Whatsapp.post(JSON.parse(req.body), req.rawBody, req.headers["x-hub-signature-256"]);
}
```

Sending a message:

```ts
await Whatsapp.sendMessage(phoneNumberId, to, new Text("Hello!"));
```

## Conventions for agents working in this repo

- Preserve the dependency-less design goal — do not add runtime deps to
  `src/` without strong justification.
- Match existing TS strictness (`tsconfig.json`) and ESLint config
  (`eslint.config.js`) / Prettier config (`.prettierrc`).
- Tests live in `test/*.test.js` — run via the project's configured test
  script in `package.json`.
- This repo uses **pnpm**, not npm/yarn, for installs (`pnpm-lock.yaml`,
  `pnpm-workspace.yaml` present).
- `.github/workflows/*` were intentionally omitted from this mirror's
  initial push (the pushing token lacked `workflow` scope) — re-add them
  with a properly-scoped token if CI is needed here.

## If asked to add frontend / multi-tenancy / user management

These are NOT part of upstream `whatsapp-api-js` and would be new,
substantial application-layer work built on top of this library, e.g.:

- Frontend: a separate app (React/Next.js etc.) calling your own backend.
- Multi-tenancy: a tenant model in your own DB, one `WhatsAppAPI` instance
  per tenant's credentials, tenant-scoped webhook routing.
- User management: your own auth/user system (e.g. Supabase, custom JWT),
  unrelated to this library.

Flag this clearly to the user rather than assuming the library provides it.
