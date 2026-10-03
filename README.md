# ✦ Lumina — Your AI Assistant

A fully functional, Copilot-**inspired** AI assistant web application. Real streaming AI chat, task templates, chat history, saved responses, authentication and per-user data isolation — all persisted in **SQLite**.

> **Original interface.** Lumina is an original design inspired by the *category* of modern AI assistants — no Microsoft source code or proprietary assets are used.

---

## ✨ Features

| Area | What works |
|---|---|
| **AI Chat** | Real AI responses streamed token-by-token (SSE), conversation context, Stop generation, Regenerate, Retry, Copy, Save, Like/Dislike, timestamps |
| **Markdown + Code** | Headings, lists, tables, links, inline code and fenced code blocks with language label + working copy button, horizontal scroll, sanitized HTML (DOMPurify) |
| **Chat History** | Auto-titled conversations, last-message preview, search, rename, delete (with confirmation), continue where you left off |
| **Saved Responses** | Save any AI response, view, copy, rename, delete — persisted per user |
| **Task Templates** | 17 seeded workflows across Writing / Coding / Productivity. Structured forms → structured prompts → streamed results with Copy / Save / Regenerate |
| **Smart Suggestions** | Intent-based suggestions appear as you type and never block input |
| **Auth** | Signup, login (email *or* username), logout, forgot/reset password, JWT HttpOnly cookie sessions, bcrypt password hashing |
| **Settings** | Profile (name/username/email), password change, Light/Dark/System theme, AI model preference (only real configured models) |
| **Per-user isolation** | Every query is scoped by `user_id` — users can never see each other's data |
| **UI/UX** | Original premium design, dark/light themes, skeleton loaders, empty states, toasts, modals, micro-animations, `prefers-reduced-motion` respected |
| **Responsive** | 320 px → 1440 px+. Sidebar becomes a drawer on mobile; bottom-friendly composer; no horizontal overflow |

---

## 🧱 Tech Stack

- **Frontend:** React 18 + Vite + React Router. No UI framework — an original hand-rolled design system (CSS custom properties).
- **Backend:** Node.js + Express (ES modules).
- **Database:** **SQLite** via `node:sqlite` (built into Node 22.5+ — zero native dependencies, no setup).
- **Auth:** bcryptjs + JWT in an HttpOnly cookie.
- **AI:** provider-agnostic OpenAI-compatible client (`fetch` + SSE streaming).

---

## 🚀 Quick Start

### 1. Requirements
- **Node.js ≥ 22.5** (for the built-in `node:sqlite` module)

### 2. Install
```bash
npm install
```

### 3. Configure secrets

Secrets are split across two git-ignored files so keys never sit next to ordinary settings:

| File | Holds | Template |
|---|---|---|
| `.env.vars` | **Secrets** — `*_API_KEY`, `JWT_SECRET`, `LIBSQL_AUTH_TOKEN`, DB passwords | [.env.vars.example](.env.vars.example) |
| `.env` | Non-secret settings — `PORT`, `NODE_ENV`, `DATABASE_URL`, `DATABASE_PATH`, `*_MODEL(s)` | [.env.example](.env.example) |

```bash
cp .env.example .env
cp .env.vars.example .env.vars
# then fill in the real values in both
```

They load in that order — **`.env.vars` wins on conflicts**, and real process env (CI, Docker,
`infisical run`) wins over both. Both files are gitignored; `.env.vars` is listed explicitly in
[.gitignore](.gitignore) because `.env*` patterns do not cover it.

You can still use [Infisical](https://infisical.com) as a central secret store instead — it takes precedence
over both files.

1. Create a project in Infisical (e.g. `lumina`) and import your secrets — you can drag and drop an existing
   `.env` file onto the Secrets Overview page.
2. Install the CLI (`brew install infisical/get-cli/infisical` on macOS) and authenticate:
   ```bash
   infisical login        # or `infisical login -i` for WSL 2 / Codespaces / remote SSH
   ```
3. Link this codebase — this writes `.infisical.json` (local settings only, no secrets, safe to commit):
   ```bash
   infisical init
   ```

See the [`AI API Configuration`](#-ai-api-configuration) section for the variables the app expects.

### 4. Run
Every run script is wrapped in `infisical run`, so secrets are injected at runtime and the app keeps reading
`process.env` unchanged.
```bash
# Development — API on :3017 + Vite dev server on :5173 (proxied)
npm run dev        # = infisical run --env=dev -- concurrently ...

# Production — build then serve everything from Express
npm run build
npm start          # = infisical run --env=prod -- cross-env NODE_ENV=production node server/index.js
```

### 5. Database migrations & seed (optional but available)
The database is created, migrated and seeded automatically on server start. You can also run the steps manually:
```bash
npm run migrate    # apply schema migrations
npm run seed       # (re)seed task templates
```
The SQLite file lives at `data/lumina.db` (configurable via `DATABASE_PATH`). To run on a hosted Postgres instead, set `DATABASE_URL` — see **Database** below.

**Moving existing local data to a hosted database** (one-time): `server/scripts/migrate-data.js` copies the local
SQLite rows into whatever `DATABASE_URL` points at, keeping the original primary keys so every conversation, message,
saved response and preference keeps its relationships.
```bash
npm run migrate:data:dry   # print the per-table plan, write nothing
npm run migrate:data       # copy (backs up data/lumina.db to data/backups/ first)
npm run migrate:data -- --source=data/other.db --no-backup   # different source file, skip the backup
```
It copies `users`, `conversations`, `messages`, `saved_responses`, `user_preferences` and `password_resets`.
Templates and the migration ledger are not copied — the target seeds those itself on connect. Re-running is safe:
rows that already exist (matched by id, email or username) are skipped, never duplicated.

---

## 🤖 AI Providers & Automatic Failover

Lumina talks to **any OpenAI-compatible** `/chat/completions` endpoint and chains multiple providers together.
When one hits its rate limit (429) or goes down, **the next provider in the chain answers automatically** —
no user-visible failure.

| Provider | Env key | Free tier | Default model |
|---|---|---|---|
| **Groq** | `GROQ_API_KEY` | ✅ generous | `llama-3.3-70b-versatile` |
| **Cohere** | `COHERE_API_KEY` | ✅ trial key | `command-r7b-12-2024` |
| **OpenRouter** | `OPENROUTER_API_KEY` | ✅ free models | `meta-llama/llama-3.1-8b-instruct` |
| **Cerebras** | `CEREBRAS_API_KEY` | ✅ free tier | `llama3.1-8b` |
| **Mistral** | `MISTRAL_API_KEY` | free tier | `mistral-small-latest` |
| **Hugging Face** | `HF_API_KEY` | ✅ limited | `meta-llama/Llama-3.1-8B-Instruct` |
| **Xkiro** (multi-model gateway) | `XKIRO_API_KEY` | ✅ many `:free` models | `qwen/qwen3.5-flash:free` |
| **Ollama** (local) | `OLLAMA_BASE_URL` | ✅ no key | `llama3.2` |

Add one or more keys to your environment (`.env` or Infisical) and restart. The active chain is visible in
**Settings → AI model**, and its order can be forced with `AI_PROVIDER_ORDER=xkiro,groq`.
The legacy single-provider trio (`AI_API_URL`/`AI_API_KEY`/`AI_MODEL`) still works and takes chain position 1.

**Multi-model gateways.** One key can expose many models. Any preset may list several, and each becomes
selectable per conversation in **Settings → AI model** — while the first stays that provider's default:

```bash
XKIRO_MODELS=qwen/qwen3.5-flash:free,cohere/command-a-plus   # full list (optional)
XKIRO_MODEL=qwen/qwen3.5-flash:free                          # just move the default
```

The xkiro gateway alone serves 100+ models (GPT-5.x, Claude, Gemini, DeepSeek, Kimi, GLM, Qwen, Grok,
Mistral…). Add only what you want exposed — the list in `Settings → AI model` is exactly what you configure.
A model requested in chat is only ever sent to the provider that actually offers it, so failover never
carries a foreign model id to the next provider.

**Keys live only on the server and are never sent to the browser.** If every provider fails, users see a clear
error with a Retry button — **never fake answers**.

## 🌐 Web Access

Flip the **Web** toggle in any chat and Lumina will:

1. Search the web (DuckDuckGo, no API key needed) for the user's question
2. Read the top pages and extract readable text
3. Answer using that material with inline citations `[1]`, `[2]`… plus a Sources strip under the reply

Control via env: `WEB_SEARCH_ENABLED` (default `true`), `WEB_SEARCH_MAX_RESULTS`, `WEB_SEARCH_TIMEOUT_MS`,
`WEB_SEARCH_MAX_CHARS`. Web access is best-effort — if a search fails, the chat falls back to the model's
own knowledge without breaking the conversation.

---

## 🗄️ Database (SQLite by default — SQLite, Turso, or ANY Postgres provider)

The data layer is **pluggable via one environment variable**. No code changes, no SQL dialect forks —
the same schema, migrations and queries run on every engine:

- **Default (zero config):** local SQLite file at `data/lumina.db` via Node's built-in `node:sqlite`. No setup, no server, no key.
- **Turso / any libSQL host:** set `DATABASE_URL=libsql://…` plus `LIBSQL_AUTH_TOKEN`. SQLite dialect over HTTP — schema reused as-is.
- **Any Postgres provider:** set `DATABASE_URL` to a `postgres://` connection string. The adapter handles the dialect differences for you.

| Provider | Example `DATABASE_URL` |
|---|---|
| **Turso** (libSQL) | `libsql://your-db-yourname.turso.io` + `LIBSQL_AUTH_TOKEN=…` |
| **Neon** | `postgresql://user:pass@ep-xxx.aws.neon.tech/neondb?sslmode=require` |
| **Supabase** | `postgresql://postgres:pass@db.xxx.supabase.co:5432/postgres` |
| **Railway** | `postgresql://postgres:pass@containers-us-west-xxx.railway.app:6543/railway` |
| **RDS / self-hosted** | `postgresql://user:pass@your-host:5432/yourdb` |

Switching engines is a config change: the server verifies connectivity at startup (`SELECT 1`), applies
migrations idempotently inside transactions, seeds templates, and fails fast with a clear message if the
database is unreachable. Postgres connections are pooled (`pg`), libSQL runs over Turso's HTTP API, and
case-insensitive uniqueness is handled portably with `lower()` unique indexes instead of SQLite-only
`COLLATE NOCASE`. Startup prints the active engine: `[db] ready — engine: sqlite | libsql | postgres`.

Seven tables with foreign keys and `ON DELETE` rules:

```
users ──┬──< conversations ──< messages
        ├──< saved_responses >── conversations (optional, SET NULL)
        ├──< user_preferences (1:1)
        └──< password_resets

task_templates   (seeded: 17 templates)
_migrations      (applied migration tracker)
```

| Table | Purpose |
|---|---|
| `users` | Accounts (bcrypt hashes, unique email + username) |
| `conversations` | Chats, owned by a user, auto-titled by the AI |
| `messages` | User/assistant messages, model used, like/dislike |
| `saved_responses` | Bookmarked AI responses (optionally linked to a conversation) |
| `task_templates` | Seeded AI workflows with `{{placeholder}}` prompt templates |
| `user_preferences` | Theme + default AI model per user |
| `password_resets` | Hashed single-use reset tokens with expiry |

Migrations live in `server/db.js`, run in order inside transactions, and are tracked in `_migrations` — idempotent across restarts and identical on SQLite and Postgres.

---

## 🔐 Security

- Secrets live in **`.env.vars`** (API keys, `JWT_SECRET`, `LIBSQL_AUTH_TOKEN`), gitignored and never committed; `.env` holds only non-secret settings. Infisical/`infisical run` still overrides both at runtime
- Passwords hashed with bcrypt (10 rounds); never logged, never returned
- JWT session in an **HttpOnly, SameSite=Lax** cookie (`Secure` in production)
- Every data query scoped by the authenticated `user_id`
- All AI markdown sanitized with DOMPurify before rendering
- Parameterized SQL statements everywhere (no string-built queries)
- Friendly error messages only — raw provider errors never reach the UI

---

## 📁 Project Structure

```
├── server/
│   ├── index.js          # Express app, static serving (prod)
│   ├── config.js         # Env configuration
│   ├── db.js             # Pluggable DB layer: SQLite (default), Turso/libSQL, or Postgres via DATABASE_URL
│   ├── auth.js           # Cookies, JWT, bcrypt helpers
│   ├── ai.js             # AI provider abstraction + streaming
│   ├── routes/
│   │   ├── auth.js       # signup / login / logout / me / reset
│   │   ├── data.js       # conversations, saved, templates, prefs, profile
│   │   └── chat.js       # SSE streaming chat endpoint
│   └── scripts/          # migrate.js / seed.js CLIs + migrate-data.js (SQLite → hosted DB copier)
├── src/
│   ├── App.jsx           # Routes + auth guards
│   ├── components/       # AppShell, icons, UI primitives
│   ├── context/          # Auth, theme, toasts
│   ├── lib/              # API client (SSE reader), markdown renderer
│   ├── pages/            # Landing, Auth, Chat, History, Saved,
│   │                     # Templates, Settings, Help, 404
│   └── styles/global.css # Original design system
├── .env.example          # Placeholder environment template
└── data/                 # SQLite database (gitignored)
```

---

## 🧪 Manual Test Guide

1. **Signup** → create account → you land in a fresh chat.
2. **Chat**: "Write a professional email asking my teacher for a meeting." → streams live → stored in SQLite.
3. **Context**: "Explain React." then "Now explain it for a 10-year-old." → the follow-up understands *"it"*.
4. **Copy / Save** a response → toast appears → find it under **Saved Responses** → refresh → still there.
5. **Refresh the page / log out and back in** → conversations persist.
6. **Two users**: create User A and User B — neither sees the other's conversations or saves (all queries are `user_id`-scoped; try opening another user's `?c=` id → "Conversation not found").
7. **Templates** → "Write an Email" → fill Recipient/Purpose/Tone → **Generate** → streamed result → Copy / Save / Regenerate.
8. **Rename & delete** conversations (confirmation modal) → reflected in sidebar + history.
9. **Theme** → switch Light/Dark/System → persists across refresh.
10. **Without an API key** → chat shows a clear configuration error with Retry — never a fake answer.
11. **Web toggle** → turn on Web in a chat, ask about a current event → answer cites `[1]`, `[2]` with a Sources strip.

---

## 📦 Production Build & Deployment

```bash
npm run build     # builds the frontend to dist/
npm start         # Express serves dist/ + API on one port
```

- Set `NODE_ENV=production`, a strong `JWT_SECRET`, real `AI_*` values, and put the app behind HTTPS (the session cookie is marked `Secure` in production).
- Any Node host works (Render, Railway, Fly.io, a VPS…). Keep the default SQLite and persist the `data/` directory (or point `DATABASE_PATH` at a mounted volume) — **or simply set `DATABASE_URL` to a managed Postgres (Neon, Supabase, Railway…) and skip file persistence entirely.**

---

## 📄 License

MIT — built as an original, from-scratch implementation.
