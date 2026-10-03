import { Router } from 'express';
import { db } from '../db.js';
import { getUserIdFromRequest, verifyPassword, hashPassword } from '../auth.js';
import { availableModels, aiConfigured, completeChat, AiError, providerChain } from '../ai.js';
import { config } from '../config.js';

const router = Router();
const nowIso = () => new Date().toISOString();

/** Forward async handler rejections to Express' error middleware. */
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// Attach req.userId or send 401. All data routes require a signed-in user.
const requireAuth = wrap(async (req, res, next) => {
  const userId = getUserIdFromRequest(req);
  if (!userId) return res.status(401).json({ error: 'Please sign in to continue.' });
  const user = await db.prepare('SELECT id FROM users WHERE id = ?').get(userId);
  if (!user) return res.status(401).json({ error: 'Session expired. Please sign in again.' });
  req.userId = userId;
  next();
});

// Every query below is scoped by user_id — users can never touch each other's data.

// ── CONVERSATIONS ────────────────────────────────────────────────────
router.get('/conversations', requireAuth, wrap(async (req, res) => {
  const rows = await db
    .prepare(
      `SELECT c.id, c.title, c.created_at, c.updated_at,
              (SELECT content FROM messages m WHERE m.conversation_id = c.id ORDER BY m.id DESC LIMIT 1) AS preview,
              (SELECT CAST(COUNT(*) AS INTEGER) FROM messages m WHERE m.conversation_id = c.id) AS message_count
       FROM conversations c
       WHERE c.user_id = ?
       ORDER BY c.updated_at DESC`
    )
    .all(req.userId);
  res.json({ conversations: rows });
}));

router.post('/conversations', requireAuth, wrap(async (req, res) => {
  const title = (req.body?.title || 'New chat').toString().slice(0, 120) || 'New chat';
  const info = await db
    .prepare('INSERT INTO conversations (user_id, title) VALUES (?, ?)')
    .run(req.userId, title);
  const convo = await db.prepare('SELECT * FROM conversations WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json({ conversation: { ...convo, preview: null, message_count: 0 } });
}));

router.get('/conversations/:id', requireAuth, wrap(async (req, res) => {
  const convo = await db
    .prepare('SELECT * FROM conversations WHERE id = ? AND user_id = ?')
    .get(req.params.id, req.userId);
  if (!convo) return res.status(404).json({ error: 'Conversation not found.' });
  const messages = await db
    .prepare('SELECT id, role, content, model, liked, created_at FROM messages WHERE conversation_id = ? ORDER BY id ASC')
    .all(convo.id);
  res.json({ conversation: { ...convo, messages } });
}));

router.patch('/conversations/:id', requireAuth, wrap(async (req, res) => {
  const convo = await db
    .prepare('SELECT id FROM conversations WHERE id = ? AND user_id = ?')
    .get(req.params.id, req.userId);
  if (!convo) return res.status(404).json({ error: 'Conversation not found.' });
  const title = (req.body?.title || '').toString().trim().slice(0, 120);
  if (!title) return res.status(400).json({ error: 'Title cannot be empty.' });
  await db.prepare('UPDATE conversations SET title = ?, updated_at = ? WHERE id = ?').run(title, nowIso(), convo.id);
  res.json({ ok: true, title });
}));

router.delete('/conversations/:id', requireAuth, wrap(async (req, res) => {
  const convo = await db
    .prepare('SELECT id FROM conversations WHERE id = ? AND user_id = ?')
    .get(req.params.id, req.userId);
  if (!convo) return res.status(404).json({ error: 'Conversation not found.' });
  await db.prepare('DELETE FROM conversations WHERE id = ?').run(convo.id); // messages cascade
  res.json({ ok: true });
}));

// ── SAVED RESPONSES ──────────────────────────────────────────────────
router.get('/saved', requireAuth, wrap(async (req, res) => {
  const rows = await db
    .prepare(
      `SELECT s.id, s.title, s.content, s.conversation_id, s.created_at, s.updated_at, c.title AS conversation_title
       FROM saved_responses s
       LEFT JOIN conversations c ON c.id = s.conversation_id
       WHERE s.user_id = ?
       ORDER BY s.created_at DESC`
    )
    .all(req.userId);
  res.json({ saved: rows });
}));

router.post('/saved', requireAuth, wrap(async (req, res) => {
  const { conversationId, title, content } = req.body ?? {};
  const text = String(content ?? '').trim();
  if (!text) return res.status(400).json({ error: 'Nothing to save — the response is empty.' });
  const safeTitle = String(title ?? 'Saved response').trim().slice(0, 160) || 'Saved response';

  let convoId = null;
  if (conversationId != null) {
    const convo = await db
      .prepare('SELECT id FROM conversations WHERE id = ? AND user_id = ?')
      .get(conversationId, req.userId);
    convoId = convo ? convo.id : null; // never attach to someone else's conversation
  }
  const info = await db
    .prepare('INSERT INTO saved_responses (user_id, conversation_id, title, content) VALUES (?, ?, ?, ?)')
    .run(req.userId, convoId, safeTitle, text);
  const row = await db.prepare('SELECT * FROM saved_responses WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json({ saved: row });
}));

router.patch('/saved/:id', requireAuth, wrap(async (req, res) => {
  const row = await db.prepare('SELECT id FROM saved_responses WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
  if (!row) return res.status(404).json({ error: 'Saved response not found.' });
  const title = (req.body?.title || '').toString().trim().slice(0, 160);
  if (!title) return res.status(400).json({ error: 'Title cannot be empty.' });
  await db.prepare('UPDATE saved_responses SET title = ?, updated_at = ? WHERE id = ?').run(title, nowIso(), row.id);
  res.json({ ok: true, title });
}));

router.delete('/saved/:id', requireAuth, wrap(async (req, res) => {
  const row = await db.prepare('SELECT id FROM saved_responses WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
  if (!row) return res.status(404).json({ error: 'Saved response not found.' });
  await db.prepare('DELETE FROM saved_responses WHERE id = ?').run(row.id);
  res.json({ ok: true });
}));

// ── TEMPLATES ────────────────────────────────────────────────────────
router.get('/templates', requireAuth, wrap(async (req, res) => {
  const rows = await db.prepare('SELECT * FROM task_templates ORDER BY category, name').all();
  res.json({ templates: rows });
}));

// ── PREFERENCES & PROFILE ────────────────────────────────────────────
router.get('/preferences', requireAuth, wrap(async (req, res) => {
  const prefs = await db.prepare('SELECT * FROM user_preferences WHERE user_id = ?').get(req.userId);
  res.json({ preferences: prefs ? { theme: prefs.theme, defaultModel: prefs.default_model } : { theme: 'system', defaultModel: null } });
}));

router.put('/preferences', requireAuth, wrap(async (req, res) => {
  const { theme, defaultModel } = req.body ?? {};
  const prefs = await db.prepare('SELECT id FROM user_preferences WHERE user_id = ?').get(req.userId);
  if (!prefs)
    await db.prepare('INSERT INTO user_preferences (user_id, theme, default_model) VALUES (?, ?, ?)').run(
      req.userId,
      theme ?? 'system',
      defaultModel ?? null
    );
  else
    await db.prepare('UPDATE user_preferences SET theme = COALESCE(?, theme), default_model = COALESCE(?, default_model), updated_at = ? WHERE id = ?').run(
      theme ?? null,
      defaultModel ?? null,
      nowIso(),
      prefs.id
    );
  const updated = await db.prepare('SELECT * FROM user_preferences WHERE user_id = ?').get(req.userId);
  res.json({ preferences: { theme: updated.theme, defaultModel: updated.default_model } });
}));

router.put('/profile', requireAuth, wrap(async (req, res) => {
  const { fullName, username, email } = req.body ?? {};
  const errors = {};
  if (!fullName || !String(fullName).trim()) errors.fullName = 'Full name is required.';
  if (!username || !/^[a-zA-Z0-9_.-]{3,30}$/.test(String(username).trim()))
    errors.username = 'Use 3–30 letters, numbers, dots, dashes or underscores.';
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim())) errors.email = 'Enter a valid email address.';
  if (Object.keys(errors).length) return res.status(400).json({ error: 'Please fix the highlighted fields.', fields: errors });

  const uname = String(username).trim();
  const mail = String(email).trim().toLowerCase();
  // Case-insensitive clash check that works on both SQLite and Postgres.
  const clash = await db
    .prepare('SELECT id, email, username FROM users WHERE (lower(email) = lower(?) OR lower(username) = lower(?)) AND id != ?')
    .get(mail, uname, req.userId);
  if (clash) {
    const fields = {};
    if (clash.email.toLowerCase() === mail) fields.email = 'Another account already uses this email.';
    if (clash.username.toLowerCase() === uname.toLowerCase()) fields.username = 'Another account already uses this username.';
    return res.status(409).json({ error: 'Profile update conflicts with an existing account.', fields });
  }

  await db.prepare('UPDATE users SET full_name = ?, username = ?, email = ?, updated_at = ? WHERE id = ?').run(
    String(fullName).trim(),
    uname,
    mail,
    nowIso(),
    req.userId
  );
  const user = await db.prepare('SELECT * FROM users WHERE id = ?').get(req.userId);
  res.json({ ok: true, user: { id: user.id, fullName: user.full_name, username: user.username, email: user.email } });
}));

router.put('/password', requireAuth, wrap(async (req, res) => {
  const { currentPassword, newPassword, confirmPassword } = req.body ?? {};
  const user = await db.prepare('SELECT * FROM users WHERE id = ?').get(req.userId);
  if (!user || !verifyPassword(String(currentPassword ?? ''), user.password_hash))
    return res.status(400).json({ error: 'Current password is incorrect.' });
  if (!newPassword || String(newPassword).length < 8)
    return res.status(400).json({ error: 'New password must be at least 8 characters.' });
  if (newPassword !== confirmPassword) return res.status(400).json({ error: 'Passwords do not match.' });
  await db.prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?').run(
    hashPassword(String(newPassword)),
    nowIso(),
    req.userId
  );
  res.json({ ok: true });
}));

// ── AI MODELS + CONNECTION STATUS ────────────────────────────────────
router.get('/ai/status', requireAuth, wrap(async (req, res) => {
  const chain = providerChain();
  const providers = chain.map((p) => {
    let host = null;
    try { host = new URL(p.apiUrl).host; } catch { /* keep null */ }
    return { id: p.id, label: p.label, model: p.model, models: p.models?.length ? p.models : [p.model], host };
  });
  res.json({
    configured: aiConfigured(),
    models: availableModels(),
    defaultModel: chain[0]?.model || null,
    provider: providers[0]?.host || null,
    providers,
    webAccess: Boolean(config.webSearch.enabled)
  });
}));

// AI-powered title generator (kept tiny + non-streaming).
router.post('/ai/title', requireAuth, wrap(async (req, res) => {
  const text = String(req.body?.text ?? '').slice(0, 800);
  if (!text.trim()) return res.status(400).json({ error: 'No text provided.' });
  const title = await completeChat({
    messages: [{ role: 'user', content: text }],
    systemPrompt:
      'Generate a short conversation title (max 6 words) for a chat starting with the user message below. Reply with the title only — no quotes, no punctuation at the end.',
    maxTokens: 24
  });
  res.json({ title: title.replace(/^["'\s]+|["'.\s]+$/g, '').slice(0, 80) || 'New chat' });
}));

// Like/dislike an assistant message (stored on the message row).
router.patch('/messages/:id/reaction', requireAuth, wrap(async (req, res) => {
  const { reaction } = req.body ?? {};
  if (![-1, 0, 1].includes(reaction)) return res.status(400).json({ error: 'Invalid reaction.' });
  const row = await db
    .prepare(
      `SELECT m.id FROM messages m
       JOIN conversations c ON c.id = m.conversation_id
       WHERE m.id = ? AND c.user_id = ?`
    )
    .get(req.params.id, req.userId);
  if (!row) return res.status(404).json({ error: 'Message not found.' });
  await db.prepare('UPDATE messages SET liked = ? WHERE id = ?').run(reaction, row.id);
  res.json({ ok: true, reaction });
}));

// Express error handler — returns clean JSON, never leaks internals.
router.use((err, _req, res, _next) => {
  if (err instanceof AiError) {
    return res.status(err.status).json({ error: err.message, kind: err.kind });
  }
  console.error('[api]', err);
  res.status(500).json({ error: 'Something went wrong on our side. Please try again.' });
});

export default router;
