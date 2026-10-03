/**
 * Web access for the chatbot.
 *
 * Search uses the DuckDuckGo HTML endpoint (no API key), then fetches the
 * top pages and extracts readable text to build a compact context block.
 * Enabled per-request via the `web` flag on /api/chat; controlled globally
 * by WEB_SEARCH_ENABLED.
 */

import { config } from './config.js';

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

function withTimeout(ms) {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), ms);
  return { signal: c.signal, done: () => clearTimeout(t) };
}

/** Strip scripts/styles/tags and decode the handful of entities we care about. */
export function htmlToText(html) {
  return String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<\/(p|div|section|article|li|h[1-6]|tr)>/gi, '\n')
    .replace(/<(br|hr)\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n\s*/g, '\n')
    .trim();
}

/** One DuckDuckGo HTML search → [{ title, url, snippet }] */
export async function webSearch(query, { limit = config.webSearch.maxResults } = {}) {
  const { signal, done } = withTimeout(config.webSearch.timeoutMs);
  try {
    const res = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, {
      headers: { 'User-Agent': UA, 'Accept-Language': 'en-US,en;q=0.9' },
      signal
    });
    if (!res.ok) throw new Error(`search HTTP ${res.status}`);
    const html = await res.text();

    const results = [];
    const re =
      /<a[^>]+class="[^"]*result__a[^"]*"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?(?:<a[^>]+class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/a>)?/g;
    let m;
    while ((m = re.exec(html)) && results.length < limit) {
      let url = m[1];
      // DDG wraps outbound links: //duckduckgo.com/l/?uddg=<encoded>&rut=...
      const uddg = /[?&]uddg=([^&]+)/.exec(url);
      if (uddg) url = decodeURIComponent(uddg[1]);
      if (!/^https?:\/\//i.test(url)) continue;
      const title = htmlToText(m[2]).slice(0, 160);
      const snippet = m[3] ? htmlToText(m[3]).slice(0, 260) : '';
      if (title) results.push({ title, url, snippet });
    }
    return results;
  } finally {
    done();
  }
}

/** Fetch a page and return readable plain text, capped. */
export async function readPage(url, { maxChars = config.webSearch.maxChars } = {}) {
  const { signal, done } = withTimeout(config.webSearch.timeoutMs);
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': UA, Accept: 'text/html,text/plain' },
      signal,
      redirect: 'follow'
    });
    if (!res.ok) return '';
    const type = res.headers.get('content-type') || '';
    if (!/text\/html|text\/plain|application\/xhtml/i.test(type)) return '';
    const html = await res.text();
    return htmlToText(html).slice(0, maxChars);
  } catch {
    return '';
  } finally {
    done();
  }
}

/**
 * Search + read, returning a context block for the system prompt.
 * Returns { block, sources } — block is '' when the search found nothing.
 */
export async function gatherWebContext(query, { onStatus } = {}) {
  if (!config.webSearch.enabled) return { block: '', sources: [] };
  try {
    onStatus?.('searching');
    const hits = await webSearch(query);
    if (!hits.length) return { block: '', sources: [] };

    onStatus?.('reading');
    const pages = await Promise.all(hits.slice(0, 3).map((h) => readPage(h.url)));
    const sources = [];
    const parts = [];
    hits.forEach((h, i) => {
      const body = pages[i] || h.snippet || '';
      if (!body) return;
      sources.push({ title: h.title, url: h.url });
      parts.push(`[${i + 1}] ${h.title}\nURL: ${h.url}\n${body}`);
    });
    if (!parts.length) return { block: '', sources: [] };

    const block = [
      'You have web access. Use the current, sourced material below when relevant to the user question.',
      'Cite sources inline as [1], [2] … matching the entries. If the material does not answer the question, say so and answer from your own knowledge.',
      '─── WEB RESULTS ───',
      parts.join('\n\n'),
      '─── END WEB RESULTS ───'
    ].join('\n');
    return { block, sources };
  } catch {
    return { block: '', sources: [] }; // web access is best-effort, never fatal
  }
}
