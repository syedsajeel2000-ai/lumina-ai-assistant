import express from 'express';
import { initDb } from './db.js';
import authRoutes from './routes/auth.js';
import dataRoutes from './routes/data.js';
import chatRoutes from './routes/chat.js';
import { config, isProd } from './config.js';
import { existsSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

/*
 * The Express app, without a listener — safe to import from both the local
 * `server/index.js` launcher and the Vercel serverless entry (`api/index.js`).
 */
export const app = express();

/*
 * Connect + migrate + seed before accepting any traffic. Works with the
 * zero-config SQLite default or any Postgres provider via DATABASE_URL.
 * Throws on failure so serverless platforms surface a hard boot error.
 */
export async function prepare() {
  try {
    await initDb();
  } catch (err) {
    console.error('[db] startup failed:', err.message);
    const msg = String(err.message || '');
    if (/401|unauthor|invalid jwt/i.test(msg) && /^(libsql|https):/i.test(config.databaseUrl)) {
      console.error('[db] Turso rejected the auth token. Create a fresh API token with READ + WRITE');
      console.error('[db] access (turso.io → Settings → API Tokens) and set LIBSQL_AUTH_TOKEN.');
    } else if (config.databaseUrl) {
      console.error('[db] Check that DATABASE_URL points to a reachable database (Turso, Neon, Supabase, Railway, RDS…).');
      console.error('[db] Or unset DATABASE_URL to fall back to the local SQLite file.');
    } else {
      console.error('[db] Local SQLite database could not be opened at:', config.databasePath);
    }
    throw err;
  }
}

app.disable('x-powered-by');
app.use(express.json({ limit: '1mb' }));

// Tiny security headers (kept dependency-free).
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  next();
});

app.use('/api/auth', authRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api', dataRoutes);

app.use('/api', (_req, res) => res.status(404).json({ error: 'API route not found.' }));

// In production, serve the built frontend from dist/ with SPA fallback.
const distDir = resolve(__dirname, '..', 'dist');
if (isProd || existsSync(distDir)) {
  app.use(express.static(distDir));
  app.get('*', (_req, res) => res.sendFile(join(distDir, 'index.html')));
}
