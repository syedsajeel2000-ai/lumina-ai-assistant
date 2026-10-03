import { initDb } from '../db.js';

console.log('Applying migrations + seed data...');
await initDb();
console.log('Seed complete. Task templates are ready to use.');
