const { getUser, checkPassword, publicUser, sign, send, method } = require('../lib/store');

module.exports = async (req, res) => {
  if (!method(req,res)) return;
  try {
    const email = String(req.body?.email || '').trim().toLowerCase(), password = String(req.body?.password || '');
    const user = await getUser(email);
    if (!user || !checkPassword(password,user.passwordHash)) return send(res,401,{error:'Mali ang email o password.'});
    return send(res,200,{user:publicUser(user),token:sign(user)});
  } catch (error) { console.error('login failed',error); return send(res,500,{error:error.message || 'Hindi makapag-log in ngayon.'}); }
};
