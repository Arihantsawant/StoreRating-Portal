import jwt from 'jsonwebtoken';
import 'dotenv/config';
const cookie = { httpOnly: true, sameSite: 'strict', secure: process.env.NODE_ENV === 'production', maxAge: 1000 * 60 * 60 * 8, path: '/' };
export function signIn(res, user) { res.cookie('srp_token', jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '8h' }), cookie); }
export function requireAuth(req, res, next) {
  try { req.user = jwt.verify(req.cookies.srp_token, process.env.JWT_SECRET); next(); }
  catch { res.status(401).json({ message: 'Authentication required.' }); }
}
export const allow = (...roles) => (req, res, next) => roles.includes(req.user.role) ? next() : res.status(403).json({ message: 'You do not have permission for this action.' });
export const clearAuth = res => res.clearCookie('srp_token', { httpOnly: true, sameSite: 'strict', secure: process.env.NODE_ENV === 'production', path: '/' });
