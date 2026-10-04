/* ===================== PROFILE TAB ===================== */

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('screen-profile').innerHTML = `
    <div class="topbar"><div class="iconbtn" onclick="goHomeForRole()">←</div><h2>Profile</h2></div>
    <div class="card" style="text-align:center;">
      <div class="avatar round" style="margin:0 auto 8px;width:64px;height:64px;font-size:30px;">👨🏽‍🌾</div>
      <h3 id="profName">—</h3>
      <p class="muted" id="profLoc">—</p>
      <div class="row" style="margin-top:14px;">
        <div class="stat"><b id="profHarvests">0</b><span class="muted" style="font-size:11px;">KABUUANG ANI</span></div>
        <div class="stat"><b id="profIncome">₱0</b><span class="muted" style="font-size:11px;">KABUUANG KITA</span></div>
      </div>
    </div>
    <button class="btn danger" onclick="logout()">Mag-logout</button>
  `;
});

function renderProfile(){
  const u = currentUser();
  document.getElementById('profName').textContent = u ? u.name : '—';
  document.getElementById('profLoc').textContent = u ? u.loc : '—';
  const myHarvests = DB.harvests.filter(h => h.farmerId === u?.id);
  document.getElementById('profHarvests').textContent = myHarvests.length;
  document.getElementById('profIncome').textContent = '₱' + myHarvests.reduce((s, h) => s + h.qty * (cropById(h.cropId)?.base || 0), 0).toLocaleString();
}

SCREEN_REFRESHERS['screen-profile'] = renderProfile;
