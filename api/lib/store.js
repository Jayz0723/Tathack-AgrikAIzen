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
const ACTIVITY_PAGES=new Set(['prices','estimate','intelligence','plan','coops','map','oversupply','buyers','harvests','community','premium','offers','logistics','assisted']);
function activityEvent(context,value){
  const {path,body={}}=context,result=value.result||{};
  const events={market:{saveDraft:'draft-saved',deleteDraft:'draft-deleted',publish:'listing-published',request:'buyer-request-posted',offer:'offer-sent',respondRequest:'request-response-sent',messageRequest:'message-sent',messageOffer:'message-sent',respond:'offer-response',respondRequestOffer:'offer-response',respondCounter:'counter-response',selectDelivery:'delivery-selected',acceptDelivery:'delivery-job-accepted',startDelivery:'delivery-started',completeDelivery:'delivery-completed',createAlert:'alert-saved',deleteAlert:'alert-deleted',toggleSupplier:'supplier-updated',createRecurring:'recurring-order-saved',toggleRecurring:'recurring-order-updated',bulkOffer:'bulk-request-sent',match:'smart-sourcing-used'},community:{createPost:'community-posted',addComment:'community-commented',toggleReaction:'community-reaction',deletePost:'community-post-deleted'},intelligence:{analyze:'market-analyzed',reportPrice:'price-reported',syncExternal:'official-prices-imported',createAssistedFarmer:'assisted-farmer-created',publishAssisted:'assisted-listing-published'},subscription:{choose:'plan-requested'}};
  let type=path==='estimate'?'price-estimated':events[path]?.[body.action];
  if(path==='market'&&body.action==='recordUsage')type=body.feature==='crop-plan'?'crop-plan-created':ACTIVITY_PAGES.has(body.page)?`view:${body.page}`:null;
  if(!type)return null;
  const crops=new Set(['palay','mais','kamatis','sibuyas','saging','talong','sili','pechay','repolyo','patatas','kamote','mangga','pinya','papaya','niyog']);
  const crop=crops.has(result.crop||body.crop)?result.crop||body.crop:null;
  return {id:crypto.randomUUID(),type,crop,status:['accepted','rejected','countered'].includes(body.status)?body.status:null,plan:['pro','enterprise'].includes(body.plan)?body.plan:null,resourceId:typeof result.id==='string'?result.id.slice(0,120):null,createdAt:new Date().toISOString()};
}
async function recentActivity(user){
  const raw=await command(['GET',`agrikaizen:activity:${user.id}`]);
  const items=raw?JSON.parse(raw):[];return Array.isArray(items)?items.slice(0,50):[];
}
async function appendActivity(user,event){
  const key=`agrikaizen:activity:${user.id}`;
  const script="local old=redis.call('GET',KEYS[1]); if (old or '') ~= ARGV[1] then return 0 end; redis.call('SET',KEYS[1],ARGV[2]); return 1";
  for(let attempt=0;attempt<4;attempt++){
    const raw=await command(['GET',key]),items=raw?JSON.parse(raw):[];
    // Publishing an existing draft is idempotent, so it should not create fake
    // repeat publishing entries when the request is retried.
    if(event.type==='listing-published'&&event.resourceId&&items.some(e=>e.type===event.type&&e.resourceId===event.resourceId))return null;
    if(await command(['EVAL',script,1,key,raw||'',JSON.stringify([event,...items].slice(0,50))]))return event;
  }
  throw new Error('Activity history changed concurrently.');
}
async function send(res, code, value) {
  const context=res.activityContext;
  if(code>=200&&code<300&&context?.user){
    try{
      const event=activityEvent(context,value);if(event){const saved=await appendActivity(context.user,event);if(saved)value={...value,activity:saved}}
      if(context.path==='market'&&['read','readActivity'].includes(context.body?.action))value={...value,recentActivity:await recentActivity(context.user)};
    }catch(error){console.error('activity history unavailable',error.message)}
  }
  res.status(code).json(value);
}
function method(req, res) { if (req.method !== 'POST') { send(res,405,{error:'Method not allowed'}); return false; } return true; }

module.exports = { command, getUser, putUser, hashPassword, checkPassword, publicUser, sign, verify, send, method, recentActivity, activityEvent };
