import { initDb } from '../db.js';

console.log('Running migrations...');
await initDb();
console.log('Database is up to date.');
