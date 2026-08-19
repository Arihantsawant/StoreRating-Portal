import bcrypt from 'bcryptjs'; import { pool, query } from './db.js';
try {
 await query('CREATE EXTENSION IF NOT EXISTS "pgcrypto"');
 const password = await bcrypt.hash('Welcome@123', 12);
 const admin = await query(`INSERT INTO users(name,email,address,password_hash,role) VALUES($1,$2,$3,$4,'ADMIN') ON CONFLICT(email) DO UPDATE SET password_hash=EXCLUDED.password_hash RETURNING id`, ['System Administrator User','admin@storerating.local','Portal headquarters',password]);
 const owner = await query(`INSERT INTO users(name,email,address,password_hash,role) VALUES($1,$2,$3,$4,'OWNER') ON CONFLICT(email) DO UPDATE SET password_hash=EXCLUDED.password_hash RETURNING id`, ['Downtown Store Owner User','owner@storerating.local','45 Main Street, Downtown',password]);
 await query(`INSERT INTO stores(name,email,address,owner_id) VALUES($1,$2,$3,$4) ON CONFLICT(email) DO NOTHING`, ['The Daily Grind Coffee','coffee@storerating.local','45 Main Street, Downtown',owner.rows[0].id]);
 console.log('Seed complete. Admin: admin@storerating.local / Welcome@123');
} finally { await pool.end(); }
