const crypto = require('crypto');
const { getUser, putUser, hashPassword, publicUser, sign, send, method } = require('../lib/store');
const validRoles = new Set(['farmer','buyer','coop','logistics','admin']);

module.exports = async (req, res) => {
  if (!method(req,res)) return;
  try {
    const { name, location, email, password, role } = req.body || {};
    const normalized = String(email || '').trim().toLowerCase();
    if (!name?.trim() || !location?.trim() || !/^\S+@\S+\.\S+$/.test(normalized)) return send(res,400,{error:'Maglagay ng buong pangalan, lokasyon, at wastong email.'});
    if (typeof password !== 'string' || password.length < 8) return send(res,400,{error:'Ang password ay dapat may hindi bababa sa 8 karakter.'});
    if (!validRoles.has(role)) return send(res,400,{error:'Hindi wastong tungkulin.'});
    if (await getUser(normalized)) return send(res,409,{error:'May account na gamit ang email na ito. Mag-log in na lang.'});
    const user = { id: crypto.randomUUID(), name:name.trim().slice(0,80), location:location.trim().slice(0,100), email:normalized, role, joinedAt:new Date().toISOString(), passwordHash:hashPassword(password) };
    await putUser(user); return send(res,201,{user:publicUser(user),token:sign(user)});
  } catch (error) { console.error('register failed',error); return send(res,500,{error:error.message || 'Hindi magawa ang account ngayon.'}); }
};
