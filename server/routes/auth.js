import { Router } from 'express';
import { randomBytes, createHash } from 'node:crypto';
import { db } from '../db.js';
import { config } from '../config.js';
import {
  setSessionCookie,
  clearSessionCookie,
  getUserIdFromRequest,
  hashPassword,
  verifyPassword
} from '../auth.js';

const router = Router();

/** Forward async handler rejections to Express' error middleware. */
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const nowIso = () => new Date().toISOString();

function publicUser(u, prefs) {
  return {
    id: u.id,
    fullName: u.full_name,
    username: u.username,
    email: u.email,
    avatarSeed: u.avatar_seed,
    createdAt: u.created_at,
    preferences: prefs
      ? { theme: prefs.theme, defaultModel: prefs.default_model }
      : { theme: 'system', defaultModel: null }
  };
}

async function getPreferences(userId) {
  let prefs = await db.prepare('SELECT * FROM user_preferences WHERE user_id = ?').get(userId);
  if (!prefs) {
    await db.prepare('INSERT INTO user_preferences (user_id) VALUES (?)').run(userId);
    prefs = await db.prepare('SELECT * FROM user_preferences WHERE user_id = ?').get(userId);
  }
  return prefs;
}

function createSession(res, userId) {
  setSessionCookie(res, userId);
}

// ── SIGN UP ──────────────────────────────────────────────────────────
router.post('/signup', wrap(async (req, res) => {
  const { fullName, username, email, password, confirmPassword } = req.body ?? {};
  const errors = {};
  if (!fullName || !String(fullName).trim()) errors.fullName = 'Full name is required.';
  if (!username || !String(username).trim()) errors.username = 'Username is required.';
  else if (!/^[a-zA-Z0-9_.-]{3,30}$/.test(String(username).trim()))
    errors.username = 'Use 3–30 letters, numbers, dots, dashes or underscores.';
  if (!email || !EMAIL_RE.test(String(email).trim())) errors.email = 'Enter a valid email address.';
  if (!password || String(password).length < 8) errors.password = 'Password must be at least 8 characters.';
  if (password !== confirmPassword) errors.confirmPassword = 'Passwords do not match.';
  if (Object.keys(errors).length) return res.status(400).json({ error: 'Please fix the highlighted fields.', fields: errors });

  const uname = String(username).trim();
  const mail = String(email).trim().toLowerCase();

  const existing = await db
    .prepare('SELECT id, email, username FROM users WHERE lower(email) = lower(?) OR lower(username) = lower(?)')
    .get(mail, uname);
  if (existing) {
    const fields = {};
    if (existing.email.toLowerCase() === mail) fields.email = 'An account with this email already exists.';
    if (existing.username.toLowerCase() === uname.toLowerCase()) fields.username = 'This username is taken.';
    return res.status(409).json({ error: 'Account already exists.', fields });
  }

  const info = await db
    .prepare('INSERT INTO users (full_name, username, email, password_hash, avatar_seed) VALUES (?, ?, ?, ?, ?)')
    .run(String(fullName).trim(), uname, mail, hashPassword(String(password)), ['spark', 'orbit', 'nova', 'comet'][Math.floor(Math.random() * 4)]);

  await db.prepare('INSERT INTO user_preferences (user_id) VALUES (?)').run(info.lastInsertRowid);
  createSession(res, info.lastInsertRowid);

  const user = await db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json({ user: publicUser(user, await getPreferences(user.id)) });
}));

// ── LOGIN ────────────────────────────────────────────────────────────
router.post('/login', wrap(async (req, res) => {
  const { identifier, password } = req.body ?? {};
  if (!identifier || !String(identifier).trim()) return res.status(400).json({ error: 'Enter your email or username.' });
  if (!password) return res.status(400).json({ error: 'Enter your password.' });

  const idf = String(identifier).trim();
  const user = await db
    .prepare('SELECT * FROM users WHERE lower(email) = lower(?) OR lower(username) = lower(?)')
    .get(idf, idf);

  if (!user || !verifyPassword(String(password), user.password_hash)) {
    return res.status(401).json({ error: 'Incorrect email/username or password.' });
  }
  createSession(res, user.id);
  res.json({ user: publicUser(user, await getPreferences(user.id)) });
}));

// ── LOGOUT ───────────────────────────────────────────────────────────
router.post('/logout', (_req, res) => {
  clearSessionCookie(res);
  res.json({ ok: true });
});

// ── CURRENT USER ─────────────────────────────────────────────────────
router.get('/me', wrap(async (req, res) => {
  const userId = getUserIdFromRequest(req);
  if (!userId) return res.status(401).json({ error: 'Not signed in.' });
  const user = await db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  if (!user) return res.status(401).json({ error: 'Not signed in.' });
  res.json({ user: publicUser(user, await getPreferences(userId)) });
}));

// ── FORGOT PASSWORD ──────────────────────────────────────────────────
// No email service is configured, so the reset token is returned directly
// in development. In production, wire this to your mail provider.
router.post('/forgot-password', wrap(async (req, res) => {
  const { email } = req.body ?? {};
  if (!email || !EMAIL_RE.test(String(email).trim())) return res.status(400).json({ error: 'Enter a valid email address.' });

  const user = await db.prepare('SELECT id FROM users WHERE lower(email) = lower(?)').get(String(email).trim());
  // Always answer the same way so accounts cannot be enumerated.
  if (!user) return res.json({ ok: true, message: 'If that email exists, a reset link has been created.' });

  const token = randomBytes(24).toString('hex');
  const tokenHash = createHash('sha256').update(token).digest('hex');
  const expires = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  await db.prepare('INSERT INTO password_resets (user_id, token_hash, expires_at) VALUES (?, ?, ?)').run(
    user.id,
    tokenHash,
    expires
  );

  const payload = { ok: true, message: 'Reset link created. Use the token below to set a new password.' };
  if (!config.nodeEnv || config.nodeEnv !== 'production') payload.resetToken = token;
  res.json(payload);
}));

router.post('/reset-password', wrap(async (req, res) => {
  const { token, password, confirmPassword } = req.body ?? {};
  if (!token) return res.status(400).json({ error: 'Reset token is required.' });
  if (!password || String(password).length < 8)
    return res.status(400).json({ error: 'Password must be at least 8 characters.' });
  if (password !== confirmPassword) return res.status(400).json({ error: 'Passwords do not match.' });

  const tokenHash = createHash('sha256').update(String(token)).digest('hex');
  const row = await db
    .prepare("SELECT * FROM password_resets WHERE token_hash = ? AND used_at IS NULL AND expires_at > ?")
    .get(tokenHash, nowIso());
  if (!row) return res.status(400).json({ error: 'This reset link is invalid or has expired.' });

  await db.prepare("UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?").run(
    hashPassword(String(password)),
    nowIso(),
    row.user_id
  );
  await db.prepare('UPDATE password_resets SET used_at = ? WHERE id = ?').run(nowIso(), row.id);
  res.json({ ok: true, message: 'Password updated. You can now sign in.' });
}));

export default router;
