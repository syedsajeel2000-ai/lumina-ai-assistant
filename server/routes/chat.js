import { Router } from 'express';
import { db } from '../db.js';
import { getUserIdFromRequest } from '../auth.js';
import { streamChat, AiError, aiConfigured, availableModels } from '../ai.js';
import { gatherWebContext } from '../web.js';
import { config } from '../config.js';

const router = Router();
const nowIso = () => new Date().toISOString();

/**
 * POST /api/chat — streams an AI response for a conversation (SSE).
 *
 * Body: { conversationId?, message, model?, regenerate?, excludeMessageId? }
 * - If conversationId is missing, a new conversation is created lazily.
 * - regenerate=true replays the stored history WITHOUT inserting a new
 *   user message (used for the Regenerate / Retry buttons).
 * - excludeMessageId removes a broken assistant message before replaying.
 * Responds with SSE events, then persists the assistant message.
 */
router.post('/', async (req, res) => {
  const userId = getUserIdFromRequest(req);
  if (!userId) return res.status(401).json({ error: 'Please sign in to continue.' });

  const { conversationId = null, message, model, regenerate = false, excludeMessageId = null, web = false } = req.body ?? {};
  const text = String(message ?? '').trim();
  if (!text) return res.status(400).json({ error: 'Message cannot be empty.' });

  // Validate requested model against the configured allow-list (no fake models).
  let effectiveModel = config.ai.model;
  if (model && aiConfigured()) {
    const allowed = availableModels();
    if (allowed.includes(model)) effectiveModel = model;
  }

  // ── Resolve or create the conversation (always owned by this user) ──
  let convo = null;
  if (conversationId != null) {
    convo = await db.prepare('SELECT * FROM conversations WHERE id = ? AND user_id = ?').get(conversationId, userId);
    if (!convo) return res.status(404).json({ error: 'Conversation not found.' });
  }
  let isNew = false;
  if (!convo) {
    const info = await db.prepare("INSERT INTO conversations (user_id, title) VALUES (?, 'New chat')").run(userId);
    convo = await db.prepare('SELECT * FROM conversations WHERE id = ?').get(info.lastInsertRowid);
    isNew = true;
  }

  // ── Persist the user message (skipped when regenerating) ────────────
  let userMessage = null;
  if (!regenerate) {
    const info = await db
      .prepare('INSERT INTO messages (conversation_id, role, content) VALUES (?, ?, ?)')
      .run(convo.id, 'user', text);
    userMessage = await db.prepare('SELECT id, role, content, created_at FROM messages WHERE id = ?').get(info.lastInsertRowid);
  } else {
    // Regenerate replaces the trailing assistant message(s) after the last user turn.
    await db
      .prepare(
        `DELETE FROM messages WHERE conversation_id = ? AND role = 'assistant' AND id >
         (SELECT MAX(id) FROM messages WHERE conversation_id = ? AND role = 'user')`
      )
      .run(convo.id, convo.id);
  }

  // ── Build context: last N messages of THIS conversation only ───────
  const limit = Math.max(1, config.ai.contextLimit) * 2;
  const historyRows = (
    await db
      .prepare('SELECT id, role, content FROM messages WHERE conversation_id = ? ORDER BY id DESC LIMIT ?')
      .all(convo.id, limit)
  ).reverse();
  let history = historyRows;
  if (excludeMessageId) history = history.filter((m) => m.id !== excludeMessageId);
  const aiMessages = history.map(({ role, content }) => ({ role, content }));
  // Ensure the exchange ends with a user turn (regenerate case).
  while (aiMessages.length > 0 && aiMessages[aiMessages.length - 1].role !== 'user') aiMessages.pop();
  if (aiMessages.length === 0) aiMessages.push({ role: 'user', content: text });

  // ── SSE setup ───────────────────────────────────────────────────────
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no'
  });
  const send = (event, data) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  send('start', { conversationId: convo.id, isNew, userMessage, model: effectiveModel });

  // Detect the client hitting "Stop": res 'close' fires on premature disconnect
  // (req 'close' can fire spuriously once the body is consumed).
  const clientAbort = new AbortController();
  res.on('close', () => {
    if (!res.writableEnded) clientAbort.abort();
  });

  let full = '';
  try {
    // Optional web access: search + read pages, inject as sourced context.
    let webBlock = null;
    if (web && config.webSearch.enabled) {
      const { block, sources } = await gatherWebContext(text, {
        onStatus: (phase) => send('web', { phase })
      });
      if (block) {
        webBlock = block;
        send('web', { phase: 'done', sources });
      } else {
        send('web', { phase: 'none' });
      }
    }

    await streamChat({
      messages: aiMessages,
      model: effectiveModel,
      webBlock,
      signal: clientAbort.signal,
      onToken: (t) => {
        full += t;
        send('delta', { text: t });
      }
    });
  } catch (err) {
    const isAbort = clientAbort.signal.aborted || err.name === 'AbortError';
    if (isAbort) {
      // User pressed Stop. Keep whatever partial answer we have.
      if (full.trim()) {
        const info = await db
          .prepare('INSERT INTO messages (conversation_id, role, content, model) VALUES (?, ?, ?, ?)')
          .run(convo.id, 'assistant', full.trim(), effectiveModel);
        const saved = await db.prepare('SELECT id, role, content, model, liked, created_at FROM messages WHERE id = ?').get(info.lastInsertRowid);
        await db.prepare('UPDATE conversations SET updated_at = ? WHERE id = ?').run(nowIso(), convo.id);
        send('aborted', { message: saved });
      } else {
        send('aborted', { message: null });
      }
      return res.end();
    }
    const kind = err instanceof AiError ? err.kind : 'unavailable';
    const status = err instanceof AiError ? err.status : 502;
    send('error', { error: err.message || 'AI service is temporarily unavailable. Please try again.', kind, status });
    return res.end();
  }

  // ── Persist the completed assistant message ─────────────────────────
  const info = await db
    .prepare('INSERT INTO messages (conversation_id, role, content, model) VALUES (?, ?, ?, ?)')
    .run(convo.id, 'assistant', full, effectiveModel);
  const assistantMessage = await db
    .prepare('SELECT id, role, content, model, liked, created_at FROM messages WHERE id = ?')
    .get(info.lastInsertRowid);
  await db.prepare('UPDATE conversations SET updated_at = ? WHERE id = ?').run(nowIso(), convo.id);

  // ── Auto-title brand-new conversations (non-blocking, best effort) ──
  if (isNew) {
    try {
      const { completeChat } = await import('../ai.js');
      const title = await completeChat({
        messages: [{ role: 'user', content: text }],
        systemPrompt:
          'Generate a short conversation title (max 6 words) for a chat that starts with the user message below. Reply with the title only — no quotes, no trailing punctuation.',
        maxTokens: 24
      });
      const clean = title.replace(/^["'\s]+|["'.\s]+$/g, '').slice(0, 80);
      if (clean) {
        await db.prepare('UPDATE conversations SET title = ? WHERE id = ?').run(clean, convo.id);
        send('title', { title: clean });
      }
    } catch {
      // Title generation is cosmetic — leave "New chat" if it fails.
    }
  }

  send('done', { conversationId: convo.id, assistantMessage });
  res.end();
});

export default router;
