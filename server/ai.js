import { config } from './config.js';

/**
 * AI provider abstraction with automatic failover.
 *
 * The app talks to ANY OpenAI-compatible /chat/completions endpoint.
 * Providers form an ordered chain (server/config.js): when one is
 * rate-limited (429) or fails, the next configured provider takes over
 * transparently. The API keys live ONLY on the server.
 */

export class AiError extends Error {
  constructor(message, status, kind, detail) {
    super(message);
    this.status = status;
    this.kind = kind; // config | auth | rate_limit | unavailable | network | empty
    this.detail = detail;
  }
}

/** Providers configured in the chain (id, label, apiUrl, model, apiKey). */
export function providerChain() {
  return config.ai.providerChain;
}

export function aiConfigured() {
  return providerChain().length > 0;
}

/** Every model a provider exposes (falls back to its single default). */
function modelsOf(provider) {
  return provider.models?.length ? provider.models : [provider.model];
}

/** Model allow-list across all providers (deduped, order preserved). */
export function availableModels() {
  const set = providerChain()
    .flatMap((p) => modelsOf(p))
    .filter(Boolean);
  return [...new Set(set)];
}

const USER_FRIENDLY = {
  config: 'The AI service is not configured yet. Add at least one provider API key (GROQ_API_KEY, COHERE_API_KEY, …) to your environment.',
  auth: 'The AI provider rejected the API key. Check the provider key in your server configuration.',
  rate_limit: 'All AI providers are rate limited right now. Please wait a moment and try again.',
  unavailable: 'AI service is temporarily unavailable. Please try again.',
  network: 'Could not reach the AI service. Check your connection, then retry.',
  empty: 'The AI returned an empty response. Please try again.'
};

function classifyHttpError(status, bodyText) {
  let detail = '';
  try {
    const parsed = JSON.parse(bodyText);
    detail = parsed?.error?.message || parsed?.message || bodyText.slice(0, 300);
  } catch {
    detail = bodyText.slice(0, 300);
  }
  if (status === 401 || status === 403) return new AiError(USER_FRIENDLY.auth, 502, 'auth', detail);
  if (status === 429) return new AiError(USER_FRIENDLY.rate_limit, 429, 'rate_limit', detail);
  if (status >= 500) return new AiError(USER_FRIENDLY.unavailable, 502, 'unavailable', detail);
  return new AiError(USER_FRIENDLY.unavailable, 502, 'unavailable', detail);
}

function headersFor(provider) {
  const headers = { 'Content-Type': 'application/json' };
  if (provider.apiKey) headers.Authorization = `Bearer ${provider.apiKey}`;
  return headers;
}

function normalizeMessages(messages, systemPrompt, webBlock) {
  const msgs = [];
  const sysParts = [
    systemPrompt ||
      'You are Lumina, a helpful, friendly AI assistant. Be accurate and concise. Use Markdown formatting (headings, lists, tables) and fenced code blocks with a language tag when sharing code.'
  ];
  if (webBlock) sysParts.push(webBlock);
  msgs.push({ role: 'system', content: sysParts.join('\n\n') });
  for (const m of messages) {
    if (m.role !== 'user' && m.role !== 'assistant') continue;
    const content = String(m.content ?? '').trim();
    if (content) msgs.push({ role: m.role, content });
  }
  return msgs;
}

function pickProvider(requestedModel) {
  const chain = providerChain();
  if (!chain.length) return null;
  if (requestedModel) {
    const match = chain.find((p) => modelsOf(p).includes(requestedModel));
    if (match) return match;
  }
  return chain[0];
}

function orderChain(primary) {
  const chain = providerChain();
  if (!primary || chain.length < 2) return chain;
  const idx = chain.indexOf(primary);
  if (idx <= 0) return chain;
  return [...chain.slice(idx), ...chain.slice(0, idx)];
}

/**
 * Streams tokens from the provider chain as plain text chunks via the callback.
 * On 429 / 5xx / network errors the next provider in the chain takes over;
 * the stream simply continues from whichever provider succeeds first.
 * Falls back to a single non-streaming call if the provider rejects streaming.
 */
export async function streamChat({ messages, model, systemPrompt, webBlock, onToken, signal }) {
  if (!aiConfigured()) throw new AiError(USER_FRIENDLY.config, 503, 'config');

  const primary = pickProvider(model);
  const chain = orderChain(primary);
  let lastError = null;

  for (const provider of chain) {
    // Only reuse the requested model on the provider that actually offers it —
    // during failover the next provider must use its own default.
    const useModel = model && modelsOf(provider).includes(model) ? model : undefined;
    try {
      return await streamFromProvider({ provider, model: useModel, messages, systemPrompt, webBlock, onToken, signal });
    } catch (err) {
      if (signal?.aborted || err.name === 'AbortError') throw err;
      if (err instanceof AiError && err.kind === 'auth') throw err; // key rejected → retrying another provider won't fix the caller's config, but failover is still worth trying below
      lastError = err;
      // continue to next provider
    }
  }
  throw lastError || new AiError(USER_FRIENDLY.unavailable, 502, 'unavailable', 'all providers failed');
}

async function streamFromProvider({ provider, model, messages, systemPrompt, webBlock, onToken, signal }) {
  const body = JSON.stringify({
    model: model || provider.model,
    messages: normalizeMessages(messages, systemPrompt, webBlock),
    stream: true,
    temperature: 0.7
  });

  const timeout = AbortSignal.timeout(config.ai.requestTimeoutMs);
  const mergedSignal = signal ? AbortSignal.any([signal, timeout]) : timeout;

  let res;
  try {
    res = await fetch(`${provider.apiUrl.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: headersFor(provider),
      body,
      signal: mergedSignal
    });
  } catch (err) {
    if (err.name === 'TimeoutError') throw new AiError(USER_FRIENDLY.unavailable, 504, 'unavailable', 'request timed out');
    throw new AiError(USER_FRIENDLY.network, 502, 'network', err.message);
  }

  // Some providers do not support SSE streaming — retry this one without streaming.
  if (res.status === 400) {
    const t = await res.text();
    if (/stream/i.test(t)) {
      const content = await completeFromProvider({ provider, model, messages, systemPrompt, webBlock, signal });
      onToken(content);
      return;
    }
    throw classifyHttpError(400, t);
  }
  if (!res.ok) throw classifyHttpError(res.status, await res.text());

  if (!res.body) throw new AiError(USER_FRIENDLY.empty, 502, 'empty');

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let emitted = false;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data:')) continue;
        const data = trimmed.slice(5).trim();
        if (data === '[DONE]') continue;
        try {
          const json = JSON.parse(data);
          const delta = json?.choices?.[0]?.delta;
          const piece =
            delta?.content ??
            json?.choices?.[0]?.message?.content ?? // some providers use message deltas
            json?.choices?.[0]?.text ??
            '';
          if (piece) {
            emitted = true;
            onToken(piece);
          }
        } catch {
          // ignore malformed SSE fragments
        }
      }
    }
  } catch (err) {
    if (signal?.aborted) return; // client stopped generation — that is fine
    throw new AiError(USER_FRIENDLY.network, 502, 'network', err.message);
  }

  if (!emitted) throw new AiError(USER_FRIENDLY.empty, 502, 'empty');
}

/** Non-streaming completion with the same failover semantics. */
export async function completeChat({ messages, model, systemPrompt, signal, maxTokens }) {
  if (!aiConfigured()) throw new AiError(USER_FRIENDLY.config, 503, 'config');

  const primary = pickProvider(model);
  const chain = orderChain(primary);
  let lastError = null;

  for (const provider of chain) {
    const useModel = model && modelsOf(provider).includes(model) ? model : undefined;
    try {
      return await completeFromProvider({ provider, model: useModel, messages, systemPrompt, signal, maxTokens });
    } catch (err) {
      if (signal?.aborted || err.name === 'AbortError') throw err;
      lastError = err;
    }
  }
  throw lastError || new AiError(USER_FRIENDLY.unavailable, 502, 'unavailable', 'all providers failed');
}

async function completeFromProvider({ provider, model, messages, systemPrompt, signal, maxTokens }) {
  const body = JSON.stringify({
    model: model || provider.model,
    messages: normalizeMessages(messages, systemPrompt),
    temperature: 0.7,
    ...(maxTokens ? { max_tokens: maxTokens } : {})
  });

  const timeout = AbortSignal.timeout(config.ai.requestTimeoutMs);
  const mergedSignal = signal ? AbortSignal.any([signal, timeout]) : timeout;

  let res;
  try {
    res = await fetch(`${provider.apiUrl.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: headersFor(provider),
      body,
      signal: mergedSignal
    });
  } catch (err) {
    if (err.name === 'TimeoutError') throw new AiError(USER_FRIENDLY.unavailable, 504, 'unavailable', 'request timed out');
    throw new AiError(USER_FRIENDLY.network, 502, 'network', err.message);
  }

  if (!res.ok) throw classifyHttpError(res.status, await res.text());

  let json;
  try {
    json = await res.json();
  } catch {
    throw new AiError(USER_FRIENDLY.empty, 502, 'empty');
  }
  const content = json?.choices?.[0]?.message?.content?.trim();
  if (!content) throw new AiError(USER_FRIENDLY.empty, 502, 'empty');
  return content;
}
