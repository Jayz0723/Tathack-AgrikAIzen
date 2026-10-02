const crypto = require('crypto');

const memory = global.__agrikaizenMemory || (global.__agrikaizenMemory = new Map());
const hasKv = () => Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);

async function command(args) {
  if (!hasKv()) {
    if (process.env.VERCEL) throw new Error('Persistent storage is not configured. Add Vercel KV environment variables before deploying.');
    const [op, key, value] = args;
    if (op === 'GET') return memory.get(key) || null;
    if (op === 'SET') { memory.set(key, value); return 'OK'; }
    if (op === 'EVAL') {
      const [, , , recordKey, expected, replacement] = args;
      if ((memory.get(recordKey) || '') !== expected) return 0;
      memory.set(recordKey, replacement); return 1;
    }
    throw new Error(`Unsupported local store command: ${op}`);
  }
  const response = await fetch(process.env.KV_REST_API_URL, {
    method: 'POST', headers: { Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}`, 'Content-Type': 'application/json' }, body: JSON.stringify(args)
  });
  if (!response.ok) throw new Error('The user store is temporarily unavailable.');
  const data = await response.json();
  if (data.error) throw new Error('Storage operation failed.');
  return data.result;
}

const userKey = email => `agrikaizen:user:${email.trim().toLowerCase()}`;
async function getUser(email) { const raw = await command(['GET', userKey(email)]); return raw ? JSON.parse(raw) : null; }
async function putUser(user) { await command(['SET', userKey(user.email), JSON.stringify(user)]); }
function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.pbkdf2Sync(password, salt, 210000, 32, 'sha256').toString('hex');
  return `${salt}:${hash}`;
}
function checkPassword(password, stored) {
  const [salt, expected] = stored.split(':');
  const attempt = crypto.pbkdf2Sync(password, salt, 210000, 32, 'sha256').toString('hex');
  return crypto.timingSafeEqual(Buffer.from(attempt, 'hex'), Buffer.from(expected, 'hex'));
}
function publicUser(user) { const { passwordHash, ...safe } = user; return safe; }
function secret() { return process.env.AUTH_SECRET || (process.env.VERCEL ? null : 'local-development-secret-change-me'); }
function sign(user) {
  const key = secret(); if (!key) throw new Error('AUTH_SECRET is not configured.');
  const payload = Buffer.from(JSON.stringify({ sub:user.id,email:user.email,exp:Date.now()+1000*60*60*24*14 })).toString('base64url');
  const signature = crypto.createHmac('sha256', key).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}
function verify(token) {
  const key = secret(); if (!key || !token) return null;
  const [payload, signature] = token.split('.'); if (!payload || !signature) return null;
  const expected = crypto.createHmac('sha256', key).update(payload).digest('base64url');
  if (signature.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
  try { const value = JSON.parse(Buffer.from(payload, 'base64url').toString()); return value.exp > Date.now() ? value : null; } catch { return null; }
}
function send(res, code, value) { res.status(code).json(value); }
function method(req, res) { if (req.method !== 'POST') { send(res,405,{error:'Method not allowed'}); return false; } return true; }

module.exports = { command, getUser, putUser, hashPassword, checkPassword, publicUser, sign, verify, send, method };
