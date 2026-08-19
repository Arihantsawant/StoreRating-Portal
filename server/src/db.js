import pg from 'pg';
import 'dotenv/config';

const ssl = process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== 'false' } : false;
export const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl });
export const query = (text, params) => pool.query(text, params);
