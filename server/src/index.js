import path from 'node:path'; import { fileURLToPath } from 'node:url';
import express from 'express'; import helmet from 'helmet'; import rateLimit from 'express-rate-limit'; import cookieParser from 'cookie-parser'; import bcrypt from 'bcryptjs'; import 'dotenv/config';
import { query } from './db.js'; import { signIn, requireAuth, allow, clearAuth } from './auth.js'; import { clean, validatePassword, validateUser } from './validation.js';

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) throw new Error('Set a JWT_SECRET with at least 32 characters.');
const app = express(); const port = process.env.PORT || 8080;
app.set('trust proxy', process.env.TRUST_PROXY === 'true' ? 1 : false);
app.use(helmet({ contentSecurityPolicy: process.env.NODE_ENV === 'production' ? undefined : false })); app.use(express.json({ limit: '20kb' })); app.use(cookieParser());
const authLimit = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: 'draft-7', legacyHeaders: false, message: { message: 'Too many attempts. Please try again later.' } });
const asyncRoute = fn => (req,res,next) => Promise.resolve(fn(req,res,next)).catch(next);
const userView = `id, name, email, address, role`;

app.post('/api/auth/register', authLimit, asyncRoute(async (req,res) => {
 const errors = validateUser(req.body); if (Object.keys(errors).length) return res.status(400).json({ errors });
 const { name, email, address, password } = req.body; const hash = await bcrypt.hash(password, 12);
 try { const result = await query(`INSERT INTO users(name,email,address,password_hash,role) VALUES($1,$2,$3,$4,'USER') RETURNING ${userView}`, [clean(name), clean(email).toLowerCase(), clean(address), hash]); signIn(res, result.rows[0]); res.status(201).json({ user: result.rows[0] }); }
 catch (e) { if (e.code === '23505') return res.status(409).json({ message: 'An account with that email already exists.' }); throw e; }
}));
app.post('/api/auth/login', authLimit, asyncRoute(async (req,res) => {
 const result = await query('SELECT id,name,email,address,role,password_hash FROM users WHERE email=$1', [clean(req.body.email).toLowerCase()]); const user = result.rows[0];
 if (!user || !(await bcrypt.compare(req.body.password || '', user.password_hash))) return res.status(401).json({ message: 'Invalid email or password.' });
 delete user.password_hash; signIn(res,user); res.json({ user });
}));
app.post('/api/auth/logout', (req,res) => { clearAuth(res); res.status(204).end(); });
app.get('/api/auth/me', requireAuth, asyncRoute(async (req,res) => { const r=await query(`SELECT ${userView} FROM users WHERE id=$1`,[req.user.id]); if(!r.rows[0]) return res.status(401).json({message:'Account not found.'}); res.json({user:r.rows[0]}); }));
app.put('/api/auth/password', requireAuth, asyncRoute(async (req,res) => { if(!validatePassword(req.body.password)) return res.status(400).json({message:'Password must be 8-16 characters and include an uppercase letter and a special character.'}); await query('UPDATE users SET password_hash=$1 WHERE id=$2',[await bcrypt.hash(req.body.password,12),req.user.id]); res.status(204).end(); }));

app.get('/api/stores', requireAuth, asyncRoute(async (req,res) => {
 const search=clean(req.query.search); const values=[req.user.id]; let where=''; if(search){values.push(`%${search}%`); where=`WHERE s.name ILIKE $2 OR s.address ILIKE $2`;}
 const sql=`SELECT s.id,s.name,s.email,s.address,COALESCE(ROUND(AVG(r.rating)::numeric,1),0) AS average_rating, MAX(r.rating) FILTER (WHERE r.user_id=$1) AS user_rating FROM stores s LEFT JOIN ratings r ON r.store_id=s.id ${where} GROUP BY s.id ORDER BY s.name`;
 const rows=(await query(sql,values)).rows; res.json({stores:rows});
}));
app.put('/api/stores/:id/rating', requireAuth, allow('USER'), asyncRoute(async(req,res)=>{ const rating=Number(req.body.rating); if(!Number.isInteger(rating)||rating<1||rating>5) return res.status(400).json({message:'Rating must be an integer from 1 to 5.'}); const exists=await query('SELECT 1 FROM stores WHERE id=$1',[req.params.id]); if(!exists.rowCount)return res.status(404).json({message:'Store not found.'}); await query(`INSERT INTO ratings(store_id,user_id,rating) VALUES($1,$2,$3) ON CONFLICT(store_id,user_id) DO UPDATE SET rating=EXCLUDED.rating,updated_at=NOW()`,[req.params.id,req.user.id,rating]); res.status(204).end(); }));

app.get('/api/admin/dashboard', requireAuth, allow('ADMIN'), asyncRoute(async(req,res)=>{ const r=await query(`SELECT (SELECT COUNT(*) FROM users) AS users,(SELECT COUNT(*) FROM stores) AS stores,(SELECT COUNT(*) FROM ratings) AS ratings`);res.json(r.rows[0]); }));
app.get('/api/admin/users', requireAuth, allow('ADMIN'), asyncRoute(async(req,res)=>{
 const field=['name','email','address','role'].includes(req.query.sort)?req.query.sort:'name'; const direction=req.query.direction==='desc'?'DESC':'ASC'; const filters=['name','email','address','role']; const clauses=[], values=[]; for(const f of filters)if(clean(req.query[f])){values.push(`%${clean(req.query[f])}%`);clauses.push(`${f}::text ILIKE $${values.length}`)} const sql=`SELECT u.id,u.name,u.email,u.address,u.role,COALESCE(ROUND(AVG(r.rating)::numeric,1),0) AS average_rating FROM users u LEFT JOIN stores s ON s.owner_id=u.id LEFT JOIN ratings r ON r.store_id=s.id ${clauses.length?'WHERE '+clauses.join(' AND '):''} GROUP BY u.id ORDER BY ${field} ${direction}`;res.json({users:(await query(sql,values)).rows});
}));
app.post('/api/admin/users', requireAuth, allow('ADMIN'), asyncRoute(async(req,res)=>{ const errors=validateUser(req.body);const role=['ADMIN','USER','OWNER'].includes(req.body.role)?req.body.role:null;if(!role)errors.role='Choose a valid role.';if(Object.keys(errors).length)return res.status(400).json({errors}); try{const r=await query(`INSERT INTO users(name,email,address,password_hash,role) VALUES($1,$2,$3,$4,$5) RETURNING ${userView}`,[clean(req.body.name),clean(req.body.email).toLowerCase(),clean(req.body.address),await bcrypt.hash(req.body.password,12),role]);res.status(201).json({user:r.rows[0]});}catch(e){if(e.code==='23505')return res.status(409).json({message:'Email already exists.'});throw e;} }));
app.get('/api/admin/stores', requireAuth, allow('ADMIN'), asyncRoute(async(req,res)=>{ const field=['name','email','address'].includes(req.query.sort)?req.query.sort:'name';const direction=req.query.direction==='desc'?'DESC':'ASC';const filters=['name','email','address'];const clauses=[],values=[];for(const f of filters)if(clean(req.query[f])){values.push(`%${clean(req.query[f])}%`);clauses.push(`s.${f} ILIKE $${values.length}`)}const sql=`SELECT s.*,COALESCE(ROUND(AVG(r.rating)::numeric,1),0) AS average_rating FROM stores s LEFT JOIN ratings r ON r.store_id=s.id ${clauses.length?'WHERE '+clauses.join(' AND '):''} GROUP BY s.id ORDER BY ${field} ${direction}`;res.json({stores:(await query(sql,values)).rows}); }));
app.post('/api/admin/stores',requireAuth,allow('ADMIN'),asyncRoute(async(req,res)=>{const {name,email,address,ownerId}=req.body;if(clean(name).length<1||clean(name).length>120||!/^\S+@\S+\.\S+$/.test(clean(email))||!clean(address)||clean(address).length>400)return res.status(400).json({message:'Enter a valid store name, email, and address.'});if(ownerId){const o=await query(`SELECT id FROM users WHERE id=$1 AND role='OWNER'`,[ownerId]);if(!o.rowCount)return res.status(400).json({message:'Assigned owner must be a store owner.'});}try{const r=await query('INSERT INTO stores(name,email,address,owner_id) VALUES($1,$2,$3,$4) RETURNING *',[clean(name),clean(email).toLowerCase(),clean(address),ownerId||null]);res.status(201).json({store:r.rows[0]});}catch(e){if(e.code==='23505')return res.status(409).json({message:'Store email or owner is already assigned.'});throw e;}}));
app.get('/api/owner/dashboard',requireAuth,allow('OWNER'),asyncRoute(async(req,res)=>{const s=await query(`SELECT s.id,s.name,s.address,COALESCE(ROUND(AVG(r.rating)::numeric,1),0) AS average_rating FROM stores s LEFT JOIN ratings r ON r.store_id=s.id WHERE s.owner_id=$1 GROUP BY s.id`,[req.user.id]);if(!s.rowCount)return res.json({store:null,raters:[]});const raters=await query('SELECT u.name,u.email,u.address,r.rating,r.updated_at FROM ratings r JOIN users u ON u.id=r.user_id WHERE r.store_id=$1 ORDER BY r.updated_at DESC',[s.rows[0].id]);res.json({store:s.rows[0],raters:raters.rows});}));

const __dirname=path.dirname(fileURLToPath(import.meta.url)); const clientDist=path.resolve(__dirname,'../../client/dist'); if(process.env.NODE_ENV==='production'){app.use(express.static(clientDist));app.get('*',(req,res)=>res.sendFile(path.join(clientDist,'index.html')));}
app.use((err,req,res,next)=>{if(err instanceof SyntaxError && err.status===400 && 'body' in err)return res.status(400).json({message:'Request body must contain valid JSON.'});console.error(err);res.status(500).json({message:'Something went wrong. Please try again.'});}); app.listen(port,()=>console.log(`StoreRating Portal API listening on ${port}`));
