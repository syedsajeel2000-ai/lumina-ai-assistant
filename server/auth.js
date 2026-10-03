import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { config, isProd } from './config.js';

const COOKIE_NAME = 'lumina_session';
const SESSION_DAYS = 30;

function signToken(userId) {
  return jwt.sign({ sub: userId }, config.jwtSecret, { expiresIn: `${SESSION_DAYS}d` });
}

export function setSessionCookie(res, userId) {
  const token = signToken(userId);
  res.setHeader(
    'Set-Cookie',
    `${COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_DAYS * 24 * 60 * 60}${
      isProd ? '; Secure' : ''
    }`
  );
}

export function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
}

/** Reads the session cookie from a request and returns the user id, or null. */
export function getUserIdFromRequest(req) {
  const cookie = req.headers.cookie;
  if (!cookie) return null;
  const raw = cookie
    .split(';')
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${COOKIE_NAME}=`));
  if (!raw) return null;
  const token = raw.slice(COOKIE_NAME.length + 1);
  try {
    const payload = jwt.verify(token, config.jwtSecret);
    return Number(payload.sub) || null;
  } catch {
    return null;
  }
}

export function hashPassword(password) {
  return bcrypt.hashSync(password, 10);
}

export function verifyPassword(password, hash) {
  try {
    return bcrypt.compareSync(password, hash);
  } catch {
    return false;
  }
}
