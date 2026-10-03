/**
 * One-time data migration: local SQLite file → the configured hosted database.
 *
 *   node server/scripts/migrate-data.js            # copy (backs up source first)
 *   node server/scripts/migrate-data.js --dry-run  # show the plan, write nothing
 *
 * Copies users, conversations, messages, saved_responses, user_preferences and
 * password_resets with their original primary keys, so every relationship stays
 * intact. Safe to re-run: rows that already exist (by id, email or username) are
 * skipped and their ids remapped instead of duplicated.
 *
 * Task templates and the migration tracker are NOT copied — the target is seeded
 * automatically on connect.
 */
// NOTE: no `import 'dotenv/config'` here — ../config.js loads `.env.vars`
// (secrets) and `.env` (defaults) in the correct order.
import { DatabaseSync } from 'node:sqlite';
import { existsSync, copyFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { initDb } from '../db.js';
import { config } from '../config.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const NO_BACKUP = args.includes('--no-backup');
const sourceArg = args.find((a) => a.startsWith('--source='));
const sourcePath = resolve(root, sourceArg ? sourceArg.split('=')[1] : config.databasePath);

const TABLES = [
  { table: 'users', fk: [] },
  { table: 'conversations', fk: ['user_id'] },
  { table: 'messages', fk: ['conversation_id'] },
  { table: 'saved_responses', fk: ['user_id', 'conversation_id'] },
  { table: 'user_preferences', fk: ['user_id'] },
  { table: 'password_resets', fk: ['user_id'] }
];

const label = (s) => `\x1b[1m${s}\x1b[0m`;
const dim = (s) => `\x1b[2m${s}\x1b[0m`;
const green = (s) => `\x1b[32m${s}\x1b[0m`;
const yellow = (s) => `\x1b[33m${s}\x1b[0m`;

/* ── Preflight ─────────────────────────────────────────────────────── */
if (!existsSync(sourcePath)) {
  console.error(`[migrate] Source database not found: ${sourcePath}`);
  process.exit(1);
}
if (!config.databaseUrl) {
  console.error('[migrate] DATABASE_URL is not set — this script copies INTO a hosted database.');
  console.error('[migrate] Set DATABASE_URL (+ LIBSQL_AUTH_TOKEN for Turso) and re-run.');
  process.exit(1);
}

if (!NO_BACKUP) {
  const dir = join(root, 'data', 'backups');
  mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const dest = join(dir, `pre-migration-${stamp}.db`);
  copyFileSync(sourcePath, dest);
  console.log(`${label('Backup')}  ${dim(dest.replace(root + '\\', '').replace(root + '/', ''))}`);
}
console.log(`${label('Source')}  ${dim(sourcePath.replace(root + '\\', '').replace(root + '/', ''))}`);

/* ── Open both sides ───────────────────────────────────────────────── */
const source = new DatabaseSync(sourcePath, { readOnly: true });
const target = await initDb(); // connects to Turso/Postgres and ensures schema
console.log(`${label('Target')}  ${dim(config.databaseUrl.replace(/:[^:@/]+@/, ':***@'))} (${target.kind})\n`);

const colsOf = async (table) => new Set((await target.prepare(`PRAGMA table_info(${table})`).all()).map((r) => r.name));

const insertRow = async (table, row, allowed) => {
  const cols = Object.keys(row).filter((c) => allowed.has(c));
  const sql = `INSERT INTO ${table} (${cols.join(', ')}) VALUES (${cols.map((c) => '@' + c).join(', ')}) ON CONFLICT DO NOTHING`;
  const args = Object.fromEntries(cols.map((c) => [c, row[c] === undefined ? null : row[c]]));
  return target.prepare(sql).run(args);
};

const report = [];
let totalCopied = 0;
let totalSkipped = 0;

/* ── Users first: they own the id map everything else depends on ───── */
const userMap = new Map();
const userCols = await colsOf('users');
for (const u of source.prepare('SELECT * FROM users').all()) {
  const byId = await target.prepare('SELECT id FROM users WHERE id = ?').get(u.id);
  const byIdentity = byId ?? (await target.prepare('SELECT id FROM users WHERE lower(email) = lower(?) OR lower(username) = lower(?)').get(u.email, u.username));
  if (byIdentity) {
    userMap.set(u.id, byIdentity.id); // already there (maybe migrated before) — reuse its id
    totalSkipped++;
    report.push(`  users              ${yellow('skip')}  #${u.id} ${u.username} -> existing #${byIdentity.id}`);
    continue;
  }
  if (!DRY_RUN) await insertRow('users', u, userCols);
  userMap.set(u.id, u.id);
  totalCopied++;
  report.push(`  users              ${green('copy')}  #${u.id} ${u.username} <${u.email}>`);
}

/* ── Everything else, remapping foreign keys through the map ───────── */
for (const { table, fk } of TABLES.slice(1)) {
  const rows = source.prepare(`SELECT * FROM ${table}`).all();
  if (!rows.length) {
    report.push(`  ${table.padEnd(19)} ${dim('—')}     no rows`);
    continue;
  }
  const allowed = await colsOf(table);
  let copied = 0;
  let skipped = 0;
  for (const row of rows) {
    const next = { ...row };
    for (const key of fk) {
      if (next[key] == null) continue;
      const mapped = key === 'user_id' ? userMap.get(next[key]) : next[key];
      if (mapped === undefined) continue; // parent missing — FK would reject it
      next[key] = mapped;
    }
    const existing = await target.prepare(`SELECT id FROM ${table} WHERE id = ?`).get(row.id);
    if (existing) {
      skipped++;
      totalSkipped++;
      continue;
    }
    if (!DRY_RUN) await insertRow(table, next, allowed);
    copied++;
    totalCopied++;
  }
  report.push(`  ${table.padEnd(19)} ${DRY_RUN ? yellow('copy') : green('copy')}  ${copied} copied${skipped ? dim(`, ${skipped} already present`) : ''}`);
}

console.log(label('Plan') + (DRY_RUN ? yellow('  (dry run — nothing written)') : ''));
report.forEach((l) => console.log(l));

/* ── Verify ────────────────────────────────────────────────────────── */
const count = async (t) => (await target.prepare(`SELECT COUNT(*) AS n FROM ${t}`).get()).n;
console.log(`\n${label('Result in ' + target.kind)}`);
for (const { table } of TABLES) console.log(`  ${table.padEnd(19)} ${await count(table)}`);
console.log(`  ${'task_templates'.padEnd(19)} ${await count('task_templates')} ${dim('(seeded automatically)')}`);

source.close();
console.log(
  DRY_RUN
    ? `\n${yellow('Dry run complete.')} Re-run without --dry-run to write ${totalCopied} rows.`
    : `\n${green('Migration complete.')} ${totalCopied} copied, ${totalSkipped} already present.`
);