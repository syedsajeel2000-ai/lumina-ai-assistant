import dotenv from 'dotenv';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/*
 * Secrets live in `.env.vars` (git-ignored); non-secret settings live in `.env`.
 *
 * dotenv applies files left-to-right and never overwrites a variable that is
 * already set, so `.env.vars` MUST come first to take precedence. For the same
 * reason we deliberately do NOT `import 'dotenv/config'` here: it would load
 * `.env` first and lock in its values before `.env.vars` was ever read.
 *
 * Real process env (CI, `infisical run`, docker) always wins over both files.
 */
const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const secretsFile = join(projectRoot, '.env.vars');
const defaultsFile = join(projectRoot, '.env');
// `.env` alone still works when there is no secrets file.
dotenv.config({
  path: existsSync(secretsFile) ? [secretsFile, defaultsFile] : defaultsFile
});

const env = (key, fallback) => {
  const v = process.env[key];
  return v === undefined || v === '' ? fallback : v;
};

function sanitizePort(v) {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 && n < 65536 ? n : 3017;
}

/*
 * AI provider chain.
 *
 * Providers are tried in order; when one is rate-limited (429) or fails,
 * the request automatically fails over to the next configured one.
 * Every provider must expose an OpenAI-compatible /chat/completions API.
 *
 * Configure via env (all optional except at least one):
 *   GROQ_API_KEY / GROQ_MODEL
 *   COHERE_API_KEY / COHERE_MODEL      (Cohere command models via OpenAI-compat endpoint)
 *   OPENROUTER_API_KEY / OPENROUTER_MODEL
 *   CEREBRAS_API_KEY / CEREBRAS_MODEL
 *   MISTRAL_API_KEY / MISTRAL_MODEL
 *   HF_API_KEY / HF_MODEL
 *   OLLAMA_BASE_URL / OLLAMA_MODEL     (local, no key)
 *   XKIRO_API_KEY / XKIRO_MODELS       (multi-model gateway, e.g. qwen + cohere)
 *   AI_API_URL / AI_API_KEY / AI_MODEL (generic custom provider, kept for back-compat)
 * Optional per-provider override: AI_PROVIDER_ORDER=groq,cohere,...
 *
 * A preset may expose SEVERAL models: every model becomes selectable in the UI
 * and in the `model` request field, while the first one is the provider default.
 * `<ID>_MODEL` overrides just that default; `<ID>_MODELS` (comma-separated)
 * overrides the whole list.
 */
const PROVIDER_PRESETS = {
  groq: {
    label: 'Groq',
    apiUrl: 'https://api.groq.com/openai/v1',
    models: ['llama-3.3-70b-versatile'],
    keyEnv: 'GROQ_API_KEY',
    modelEnv: 'GROQ_MODEL'
  },
  cohere: {
    label: 'Cohere',
    apiUrl: 'https://api.cohere.ai/compatibility/v1',
    models: ['command-r7b-12-2024'],
    keyEnv: 'COHERE_API_KEY',
    modelEnv: 'COHERE_MODEL'
  },
  openrouter: {
    label: 'OpenRouter',
    apiUrl: 'https://openrouter.ai/api/v1',
    models: ['meta-llama/llama-3.1-8b-instruct'],
    keyEnv: 'OPENROUTER_API_KEY',
    modelEnv: 'OPENROUTER_MODEL'
  },
  cerebras: {
    label: 'Cerebras',
    apiUrl: 'https://api.cerebras.ai/v1',
    models: ['llama3.1-8b'],
    keyEnv: 'CEREBRAS_API_KEY',
    modelEnv: 'CEREBRAS_MODEL'
  },
  mistral: {
    label: 'Mistral',
    apiUrl: 'https://api.mistral.ai/v1',
    models: ['mistral-small-latest'],
    keyEnv: 'MISTRAL_API_KEY',
    modelEnv: 'MISTRAL_MODEL'
  },
  hf: {
    label: 'Hugging Face',
    apiUrl: 'https://router.huggingface.co/v1',
    models: ['meta-llama/Llama-3.1-8B-Instruct'],
    keyEnv: 'HF_API_KEY',
    modelEnv: 'HF_MODEL'
  },
  xkiro: {
    label: 'Xkiro',
    apiUrl: 'https://api.xkiro.com/v1',
    // Multi-model gateway — every id below is selectable per conversation.
    models: ['qwen/qwen3.5-flash:free', 'cohere/command-a-plus'],
    keyEnv: 'XKIRO_API_KEY',
    modelsEnv: 'XKIRO_MODELS',
    modelEnv: 'XKIRO_MODEL'
  },
  ollama: {
    label: 'Ollama (local)',
    apiUrl: '', // from OLLAMA_BASE_URL
    baseUrlEnv: 'OLLAMA_BASE_URL',
    models: ['llama3.2'],
    keyEnv: null,
    modelEnv: 'OLLAMA_MODEL'
  }
};

function buildProviderChain() {
  const chain = [];
  const push = (id, override) => {
    if (!override || chain.some((p) => p.id === id)) return;
    chain.push({ id, ...override });
  };

  // Legacy generic provider keeps priority for back-compat.
  const customModel = env('AI_MODEL', '');
  push('custom',
    env('AI_API_URL', '') && {
      label: 'Custom',
      apiUrl: env('AI_API_URL', ''),
      model: customModel,
      models: customModel ? [customModel] : [],
      apiKey: env('AI_API_KEY', '')
    }
  );

  const order = env('AI_PROVIDER_ORDER', '')
    .split(',').map((s) => s.trim()).filter(Boolean);
  const ids = order.length
    ? order
    : Object.keys(PROVIDER_PRESETS);
  for (const id of ids) {
    const preset = PROVIDER_PRESETS[id];
    if (!preset) continue;
    const apiKey = preset.keyEnv ? env(preset.keyEnv, '') : '';
    const baseUrl = preset.baseUrlEnv ? env(preset.baseUrlEnv, '') : '';
    const apiUrl = preset.apiUrl || baseUrl;
    if (!apiKey && !apiUrl) continue;
    if (preset.keyEnv && !apiKey) continue; // keyed provider without a key → skip

    // Models: <ID>_MODELS overrides the whole list, <ID>_MODEL just the default.
    const fromEnv = preset.modelsEnv
      ? env(preset.modelsEnv, '').split(',').map((s) => s.trim()).filter(Boolean)
      : [];
    const models = (fromEnv.length ? fromEnv : [...(preset.models ?? [])]).filter(Boolean);
    const defaultOverride = preset.modelEnv ? env(preset.modelEnv, '') : '';
    const orderedModels = defaultOverride
      ? [defaultOverride, ...models.filter((m) => m !== defaultOverride)]
      : models;

    push(id, {
      label: preset.label,
      apiUrl,
      model: orderedModels[0] || '',
      models: orderedModels,
      apiKey
    });
  }
  return chain;
}

export const config = {
  nodeEnv: env('NODE_ENV', 'development'),
  port: sanitizePort(env('PORT', '3017')),
  jwtSecret: env('JWT_SECRET', 'dev-only-insecure-secret-change-me'),
  databasePath: env('DATABASE_PATH', 'data/lumina.db'),
  // Set DATABASE_URL to use a hosted database instead of the local SQLite file:
  //   postgres://… → Neon, Supabase, Railway, RDS, self-hosted Postgres
  //   libsql://…   → Turso (or any libSQL host; SQLite dialect over HTTP)
  // Empty = local SQLite file. libSQL auth token can also live in its own var.
  databaseUrl: env('DATABASE_URL', ''),
  libsqlAuthToken: env('LIBSQL_AUTH_TOKEN', ''),
  ai: {
    // Legacy single-provider fields (back-compat).
    apiUrl: env('AI_API_URL', ''),
    apiKey: env('AI_API_KEY', ''),
    model: env('AI_MODEL', ''),
    extraModels: env('AI_MODELS', '')
      .split(',')
      .map((m) => m.trim())
      .filter(Boolean),
    contextLimit: Number(env('AI_CONTEXT_LIMIT', '20')),
    requestTimeoutMs: Number(env('AI_REQUEST_TIMEOUT_MS', '120000')),
    // Multi-provider failover chain.
    providerChain: buildProviderChain(),
    primary: env('AI_PROVIDER_ORDER', '').split(',')[0].trim() || 'auto'
  },
  webSearch: {
    enabled: env('WEB_SEARCH_ENABLED', 'true') !== 'false',
    maxResults: Math.max(1, Number(env('WEB_SEARCH_MAX_RESULTS', '5'))),
    timeoutMs: Number(env('WEB_SEARCH_TIMEOUT_MS', '8000')),
    maxChars: Number(env('WEB_SEARCH_MAX_CHARS', '4500'))
  }
};

export const isProd = config.nodeEnv === 'production';
