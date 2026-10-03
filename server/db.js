import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from './config.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Pluggable database layer.
 *
 *   • No DATABASE_URL           → local SQLite file (node:sqlite, zero setup)
 *   • DATABASE_URL=postgres://… → any Postgres provider — Neon, Supabase,
 *                                  Railway, RDS, self-hosted, …
 *   • DATABASE_URL=libsql://…   → Turso / any libSQL host (SQLite over HTTP)
 *
 * Auth: Postgres carries its password in the URL; libSQL reads the token from
 * LIBSQL_AUTH_TOKEN or an ?authToken=… parameter on DATABASE_URL.
 *
 * Both adapters expose the same surface — prepare(sql) → { get, all, run },
 * exec(sql), transaction(fn) — so application code is engine-agnostic.
 * SQLite returns plain values; Postgres returns promises. Call sites always
 * `await`, which is a no-op for plain values.
 *
 * Schema changes live in `MIGRATIONS` and are applied in order, tracked in the
 * `_migrations` table — idempotent across restarts and across both engines.
 */

/* Live binding: assigned by initDb() before the server starts accepting requests. */
export let db = null;

/* ── SQLite adapter ─────────────────────────────────────────────────── */
export function createSqliteAdapter(filePath) {
  const dbFile = resolve(__dirname, '..', filePath || config.databasePath);
  mkdirSync(dirname(dbFile), { recursive: true });
  const raw = new DatabaseSync(dbFile);
  raw.exec('PRAGMA journal_mode = WAL;');
  raw.exec('PRAGMA foreign_keys = ON;');

  const prepare = (sql) => {
    const stmt = raw.prepare(sql);
    return {
      get: (...args) => stmt.get(...args),
      all: (...args) => stmt.all(...args),
      run: (...args) => stmt.run(...args)
    };
  };
  const exec = (sql) => {
    raw.exec(sql);
  };
  const adapter = {
    kind: 'sqlite',
    raw,
    prepare,
    exec,
    transaction: async (fn) => {
      raw.exec('BEGIN');
      try {
        const out = await fn({ prepare, exec });
        raw.exec('COMMIT');
        return out;
      } catch (err) {
        raw.exec('ROLLBACK');
        throw err;
      }
    }
  };
  return adapter;
}

/* ── Postgres adapter (node-postgres) ───────────────────────────────── */

/** Convert `?` positional or `@name` named params to Postgres $1…$n. */
function toPgSql(sql, args) {
  if (args.length === 1 && args[0] && typeof args[0] === 'object' && !Array.isArray(args[0])) {
    const obj = args[0];
    const values = [];
    const text = sql.replace(/@([a-zA-Z_]\w*)/g, (_, key) => {
      values.push(obj[key]);
      return `$${values.length}`;
    });
    return { text, values };
  }
  let i = 0;
  const values = [...args];
  const text = sql.replace(/\?/g, () => `$${++i}`);
  return { text, values };
}

function pgStatement(runner, sql) {
  const withParams = (args) => toPgSql(sql, args);
  return {
    get: (...args) => {
      const { text, values } = withParams(args);
      return runner.query(text, values).then((r) => r.rows[0]);
    },
    all: (...args) => {
      const { text, values } = withParams(args);
      return runner.query(text, values).then((r) => r.rows);
    },
    run: (...args) => {
      let { text, values } = withParams(args);
      // Emulate SQLite's `lastInsertRowid` for INSERTs that don't ask for rows.
      if (/^\s*insert/i.test(text) && !/returning/i.test(text)) text += ' RETURNING id';
      return runner.query(text, values).then((r) => ({
        changes: r.rowCount ?? 0,
        lastInsertRowid: r.rows?.[0]?.id ?? null
      }));
    }
  };
}

export function createPostgresAdapter(pgModule, url) {
  const pool = new pgModule.Pool({ connectionString: url, max: 10 });
  const adapter = {
    kind: 'postgres',
    pool,
    prepare: (sql) => pgStatement({ query: (text, values) => pool.query(text, values) }, sql),
    exec: (sql) => pool.query(sql).then(() => undefined),
    transaction: async (fn) => {
      const client = await pool.connect();
      const runner = { query: (text, values) => client.query(text, values) };
      try {
        await client.query('BEGIN');
        const out = await fn({
          prepare: (sql) => pgStatement(runner, sql),
          exec: (sql) => client.query(sql).then(() => undefined)
        });
        await client.query('COMMIT');
        return out;
      } catch (err) {
        try { await client.query('ROLLBACK'); } catch { /* connection may be gone */ }
        throw err;
      } finally {
        client.release();
      }
    }
  };
  return adapter;
}

/* ── libSQL / Turso adapter ────────────────────────────────────────── */

/**
 * Turso (and any libSQL host) speaks the SQLite dialect over HTTP, so the
 * schema and every query above are reused unchanged. Supported URLs:
 *   libsql://my-db.turso.io        token from LIBSQL_AUTH_TOKEN or ?authToken=
 *   https://my-db.turso.io
 *   file:data/lumina.db            local libSQL file
 */
export function createLibsqlAdapter(libsql, url) {
  let authToken = '';
  try {
    authToken = new URL(url).searchParams.get('authToken') || '';
  } catch {
    /* not a URL (e.g. file:) — the token must come from the environment */
  }
  if (!authToken) authToken = config.libsqlAuthToken || '';
  const client = libsql.createClient({ url, ...(authToken ? { authToken } : {}) });

  /**
   * Multi-statement DDL (the whole schema) must go through executeMultiple —
   * a transaction's execute() silently runs only the FIRST statement, which
   * would leave the schema half-created.
   */
  const execSql = async (runner, sql) => {
    if (typeof runner.executeMultiple === 'function') {
      await runner.executeMultiple(sql);
      return;
    }
    await runner.execute(sql);
  };

  const executeOn = async (runner, sql, args) => {
    // libSQL wants named params as a plain object (run({sql, args: {...}})),
    // never wrapped in an array — that would try to bind an object literal.
    const named =
      args?.length === 1 &&
      args[0] !== null &&
      typeof args[0] === 'object' &&
      !Array.isArray(args[0]) &&
      !Buffer.isBuffer(args[0]);
    const res = args === undefined
      ? await runner.execute(sql)
      : await runner.execute(named ? { sql, args: args[0] } : { sql, args });
    return {
      rows: res.rows ?? [],
      changes: res.rowsAffected ?? 0,
      // libSQL reports the new rowid as a BigInt — normalize to Number so it
      // can be handed straight back into the next statement.
      lastInsertRowid: res.lastInsertRowid == null ? null : Number(res.lastInsertRowid)
    };
  };

  const stmtOn = (runner, sql) => ({
    get: async (...args) => (await executeOn(runner, sql, args)).rows[0] ?? undefined,
    all: async (...args) => (await executeOn(runner, sql, args)).rows,
    run: async (...args) => {
      const r = await executeOn(runner, sql, args);
      return { changes: r.changes, lastInsertRowid: r.lastInsertRowid };
    }
  });

  return {
    kind: 'libsql',
    client,
    prepare: (sql) => stmtOn(client, sql),
    exec: async (sql) => {
      await execSql(client, sql);
    },
    transaction: async (fn) => {
      const tx = await client.transaction();
      try {
        const out = await fn({
          prepare: (sql) => stmtOn(tx, sql),
          exec: async (sql) => {
            await execSql(tx, sql);
          }
        });
        await tx.commit();
        return out;
      } catch (err) {
        try { await tx.rollback(); } catch { /* connection may be gone */ }
        throw err;
      }
    }
  };
}

/** Never log credentials: postgres://u:pw@host → postgres://u:***@host */
const maskUrl = (u) => u.replace(/:\/\/([^:@/]+):[^@/]*@/, '://$1:***@');

const pkType = () => (db?.kind === 'postgres' ? 'SERIAL PRIMARY KEY' : 'INTEGER PRIMARY KEY AUTOINCREMENT');
const nowDefault = () =>
  db?.kind === 'postgres'
    ? `to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`
    : `strftime('%Y-%m-%dT%H:%M:%fZ','now')`;

/* Portable DDL: works identically on SQLite and Postgres. */
function schemaSql() {
  const pk = pkType();
  const now = nowDefault();
  return `
    CREATE TABLE IF NOT EXISTS users (
      id            ${pk},
      full_name     TEXT NOT NULL,
      username      TEXT NOT NULL UNIQUE,
      email         TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      avatar_seed   TEXT NOT NULL DEFAULT 'spark',
      created_at    TEXT NOT NULL DEFAULT (${now}),
      updated_at    TEXT NOT NULL DEFAULT (${now})
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username_lower ON users (lower(username));
    CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_lower ON users (lower(email));

    CREATE TABLE IF NOT EXISTS conversations (
      id         ${pk},
      user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title      TEXT NOT NULL DEFAULT 'New chat',
      created_at TEXT NOT NULL DEFAULT (${now}),
      updated_at TEXT NOT NULL DEFAULT (${now})
    );
    CREATE INDEX IF NOT EXISTS idx_conversations_user ON conversations(user_id, updated_at DESC);

    CREATE TABLE IF NOT EXISTS messages (
      id              ${pk},
      conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
      role            TEXT NOT NULL CHECK (role IN ('user','assistant')),
      content         TEXT NOT NULL,
      model           TEXT,
      liked           INTEGER NOT NULL DEFAULT 0 CHECK (liked IN (-1,0,1)),
      created_at      TEXT NOT NULL DEFAULT (${now})
    );
    CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id, created_at);

    CREATE TABLE IF NOT EXISTS saved_responses (
      id              ${pk},
      user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      conversation_id INTEGER REFERENCES conversations(id) ON DELETE SET NULL,
      title           TEXT NOT NULL,
      content         TEXT NOT NULL,
      created_at      TEXT NOT NULL DEFAULT (${now}),
      updated_at      TEXT NOT NULL DEFAULT (${now})
    );
    CREATE INDEX IF NOT EXISTS idx_saved_user ON saved_responses(user_id, created_at DESC);

    CREATE TABLE IF NOT EXISTS task_templates (
      id              ${pk},
      name            TEXT NOT NULL UNIQUE,
      category        TEXT NOT NULL CHECK (category IN ('writing','coding','productivity')),
      description     TEXT NOT NULL,
      icon            TEXT NOT NULL DEFAULT 'spark',
      prompt_template TEXT NOT NULL,
      created_at      TEXT NOT NULL DEFAULT (${now})
    );

    CREATE TABLE IF NOT EXISTS user_preferences (
      id            ${pk},
      user_id       INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      theme         TEXT NOT NULL DEFAULT 'system' CHECK (theme IN ('light','dark','system')),
      default_model TEXT,
      created_at    TEXT NOT NULL DEFAULT (${now}),
      updated_at    TEXT NOT NULL DEFAULT (${now})
    );

    CREATE TABLE IF NOT EXISTS password_resets (
      id         ${pk},
      user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      used_at    TEXT,
      created_at TEXT NOT NULL DEFAULT (${now})
    );
  `;
}

const MIGRATIONS = [
  {
    name: '001_initial_schema',
    sql: () => schemaSql()
  }
];

export async function runMigrations() {
  await db.exec(`CREATE TABLE IF NOT EXISTS _migrations (
    id         ${pkType()},
    name       TEXT NOT NULL UNIQUE,
    applied_at TEXT NOT NULL DEFAULT (${nowDefault()})
  );`);
  const applied = new Set((await db.prepare('SELECT name FROM _migrations').all()).map((r) => r.name));
  for (const m of MIGRATIONS) {
    if (applied.has(m.name)) continue;
    await db.transaction(async (tx) => {
      await tx.exec(m.sql());
      await tx.prepare('INSERT INTO _migrations (name) VALUES (?)').run(m.name);
    });
    console.log(`[db] migration applied: ${m.name}`);
  }
}

export const SEED_TEMPLATES = [
  // ── WRITING ──────────────────────────────────────────────────────────
  {
    name: 'Write an Email', category: 'writing', icon: 'mail',
    description: 'Compose a polished email for any recipient, purpose and tone.',
    prompt_template: 'Write an email to {{recipient}}. Purpose: {{purpose}}. Tone: {{tone}}. Important details to include: {{details}}. Return a ready-to-send email with a subject line.'
  },
  {
    name: 'Write a LinkedIn Post', category: 'writing', icon: 'briefcase',
    description: 'Create an engaging LinkedIn post that sounds like you.',
    prompt_template: 'Write a LinkedIn post about {{topic}}. Tone: {{tone}}. Key points to mention: {{details}}. Include a hook, short paragraphs, and end with a question to drive engagement.'
  },
  {
    name: 'Write a Facebook Caption', category: 'writing', icon: 'message',
    description: 'Short, catchy caption for your next social post.',
    prompt_template: 'Write a Facebook caption about {{topic}}. Tone: {{tone}}. Keep it under 80 words and include relevant hashtags and emojis where natural. Details: {{details}}'
  },
  {
    name: 'Write a Blog Introduction', category: 'writing', icon: 'pen',
    description: 'An irresistible opening for your blog article.',
    prompt_template: 'Write an engaging introduction (120-180 words) for a blog post titled "{{topic}}". Tone: {{tone}}. The article covers: {{details}}. Hook the reader immediately and preview what they will learn.'
  },
  {
    name: 'Rewrite Text', category: 'writing', icon: 'refresh',
    description: 'Say the same thing better — new wording, same meaning.',
    prompt_template: 'Rewrite the following text in a {{tone}} tone while preserving its meaning:\n\n{{text}}'
  },
  {
    name: 'Improve Grammar', category: 'writing', icon: 'check',
    description: 'Fix grammar, spelling and clarity issues.',
    prompt_template: 'Correct the grammar, spelling and clarity of the following text. Return the corrected version first, then a short bulleted list of the changes you made:\n\n{{text}}'
  },
  // ── CODING ───────────────────────────────────────────────────────────
  {
    name: 'Explain Code', category: 'coding', icon: 'book',
    description: 'Understand what a piece of code actually does.',
    prompt_template: 'Explain what the following {{language}} code does, step by step, in clear language. Mention any bugs or pitfalls you notice:\n\n{{code}}'
  },
  {
    name: 'Debug Code', category: 'coding', icon: 'bug',
    description: 'Find the bug and get a corrected version.',
    prompt_template: 'The following {{language}} code has a problem. Identify the bug(s), explain the cause, and provide the corrected code with comments on the changed lines:\n\n{{code}}\n\nError message or unexpected behaviour (if any): {{error}}'
  },
  {
    name: 'Generate Code', category: 'coding', icon: 'code',
    description: 'Describe it, get working code back.',
    prompt_template: 'Write {{language}} code that fulfils this requirement: {{requirement}}. Include brief comments explaining the approach, and show example usage.'
  },
  {
    name: 'Optimize Code', category: 'coding', icon: 'zap',
    description: 'Faster, cleaner, more efficient code.',
    prompt_template: 'Optimize the following {{language}} code for performance and readability. Explain each optimization you make:\n\n{{code}}'
  },
  {
    name: 'Convert Code', category: 'coding', icon: 'repeat',
    description: 'Translate code between languages or frameworks.',
    prompt_template: 'Convert the following code from {{from_language}} to {{to_language}}. Keep behaviour identical, use idiomatic patterns of the target language, and note any differences:\n\n{{code}}'
  },
  {
    name: 'Write Documentation', category: 'coding', icon: 'file',
    description: 'Turn code into clear documentation.',
    prompt_template: 'Write clear documentation for the following {{language}} code. Include a short overview, parameters/inputs, return values, and usage examples:\n\n{{code}}'
  },
  // ── PRODUCTIVITY ─────────────────────────────────────────────────────
  {
    name: 'Summarize Text', category: 'productivity', icon: 'list',
    description: 'Long text in, key points out.',
    prompt_template: 'Summarize the following text. First give a 2-sentence overview, then the key points as a bulleted list:\n\n{{text}}'
  },
  {
    name: 'Create To-Do List', category: 'productivity', icon: 'check',
    description: 'Break a goal into an actionable checklist.',
    prompt_template: 'Create an actionable to-do list for this goal: {{goal}}. Group tasks by priority (Must do / Should do / Nice to have) and keep each item short and concrete. Context: {{details}}'
  },
  {
    name: 'Create Study Plan', category: 'productivity', icon: 'calendar',
    description: 'A structured plan to master any subject.',
    prompt_template: 'Create a study plan for learning {{subject}} over {{duration}}. Break it into phases with daily/weekly goals, recommended resources, and self-check milestones. My current level: {{details}}'
  },
  {
    name: 'Brainstorm Ideas', category: 'productivity', icon: 'bulb',
    description: 'Fresh ideas on demand.',
    prompt_template: 'Brainstorm 10 diverse ideas about {{topic}}. For each idea, add one sentence on why it could work. Aim for a mix of safe and bold ideas. Context: {{details}}'
  },
  {
    name: 'Create Meeting Agenda', category: 'productivity', icon: 'calendar',
    description: 'Run tighter meetings with a clear agenda.',
    prompt_template: 'Create a meeting agenda for a meeting about {{topic}} lasting {{duration}}. Include time-boxed discussion points, the goal of each point, and pre-reading. Attendees/context: {{details}}'
  }
];

export async function seedTemplates() {
  const insert = db.prepare(`
    INSERT INTO task_templates (name, category, description, icon, prompt_template)
    VALUES (@name, @category, @description, @icon, @prompt_template)
    ON CONFLICT(name) DO UPDATE SET
      category = excluded.category,
      description = excluded.description,
      icon = excluded.icon,
      prompt_template = excluded.prompt_template
  `);
  for (const t of SEED_TEMPLATES) await insert.run(t);
  console.log(`[db] seeded ${SEED_TEMPLATES.length} task templates`);
}

/**
 * Creates the adapter from configuration (or the provided one, for tests),
 * applies migrations and seeds. Must be awaited before handling requests.
 */
export async function initDb({ adapter } = {}) {
  if (adapter) {
    db = adapter;
  } else if (config.databaseUrl) {
    const url = config.databaseUrl;
    if (/^postgres(ql)?:\/\//i.test(url)) {
      const { default: pg } = await import('pg');
      db = createPostgresAdapter(pg, url);
      console.log('[db] connecting to Postgres provider…');
    } else if (/^(libsql|https):\/\//i.test(url) || /^file:/i.test(url)) {
      const libsql = await import('@libsql/client');
      db = createLibsqlAdapter(libsql, url);
      console.log('[db] connecting to libSQL / Turso…');
    } else {
      throw new Error(
        `Unsupported DATABASE_URL — use postgres://… (Neon, Supabase, Railway, RDS), ` +
        `libsql://… (Turso), or leave it empty for the local SQLite file. Got: ${maskUrl(url)}`
      );
    }
  } else {
    db = createSqliteAdapter();
  }

  // Verify connectivity early so misconfiguration fails fast and loudly.
  await db.prepare('SELECT 1 AS ok').get();

  await runMigrations();
  await seedTemplates();
  console.log(`[db] ready — engine: ${db.kind}`);
  return db;
}
