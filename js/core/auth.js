/* ===================== AUTH SCREEN ===================== */

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('screen-auth').innerHTML = `
    <div style="text-align:center;margin:30px 0 20px;">
      <div style="font-size:40px;">🌾</div>
      <h1>AgrikAIzen</h1>
      <p class="muted">Mag-log in bilang:</p>
    </div>
    <select id="roleSelect" class="role">
      <option value="farmer">Magsasaka (Farmer)</option>
      <option value="coop">Kooperatiba / Extension Worker</option>
      <option value="buyer">Mamimili (Buyer)</option>
      <option value="admin">Admin</option>
    </select>
    <label>Pangalan</label>
    <input id="authName" placeholder="e.g. Mang Tomas dela Cruz">
    <label>Lokasyon</label>
    <input id="authLoc" placeholder="e.g. Bustos, Bulacan">
    <button class="btn" style="margin-top:18px;" onclick="doLogin()">Mag-login / Rehistro</button>
    <p class="disclaimer">Ang mga presyong AI ay pagtatantya lamang batay sa nakolektang datos, hindi garantiya ng aktwal na presyo sa bentahan.</p>
  `;
});

function doLogin(){
  const role = document.getElementById('roleSelect').value;
  const name = document.getElementById('authName').value.trim() || (role === 'farmer' ? 'Mang Tomas dela Cruz' : 'User');
  const loc = document.getElementById('authLoc').value.trim() || 'Pilipinas';
  let user = DB.users.find(u => u.name === name && u.role === role);
  if(!user){
    user = {id: Date.now(), name, role, loc, joined: new Date().getFullYear()};
    DB.users.push(user);
  }
  DB.currentUserId = user.id;
  currentRole = role;
  save();
  document.getElementById('screen-auth').classList.remove('active');
  goHomeForRole();
}

function logout(){
  DB.currentUserId = null;
  save();
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById('screen-auth').classList.add('active');
  document.getElementById('bottomnav').innerHTML = '';
}
