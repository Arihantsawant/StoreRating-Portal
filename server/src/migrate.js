import fs from 'node:fs'; import { pool, query } from './db.js';
try { await query('CREATE EXTENSION IF NOT EXISTS "pgcrypto"'); await query(fs.readFileSync(new URL('./schema.sql', import.meta.url), 'utf8')); console.log('Database migration complete.'); }
finally { await pool.end(); }
