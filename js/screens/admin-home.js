/* ===================== ADMIN PANEL TAB ===================== */

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('screen-admin-home').innerHTML = `
    <div class="topbar"><h2>Admin Panel</h2><div class="iconbtn" onclick="logout()">⎋</div></div>
    <div class="grid2">
      <div class="card stat"><b id="adUsers">0</b><span class="muted" style="font-size:11px;">USERS</span></div>
      <div class="card stat"><b id="adHarvests">0</b><span class="muted" style="font-size:11px;">MGA ANI</span></div>
      <div class="card stat"><b id="adBuyers">0</b><span class="muted" style="font-size:11px;">BUYERS</span></div>
      <div class="card stat"><b id="adReports">0</b><span class="muted" style="font-size:11px;">PRICE REPORTS</span></div>
    </div>
    <h3>Mga Ulat ng Presyo (Review)</h3>
    <table id="adminReportTable"><thead><tr><th>Crop</th><th>₱</th><th>Reporter</th><th></th></tr></thead><tbody></tbody></table>
    <h3 style="margin-top:14px;">Base Prices (Manage Market Data)</h3>
    <table><thead><tr><th>Crop</th><th>Fair Price</th><th>Edit</th></tr></thead><tbody id="adminPriceTable"></tbody></table>
    <h3 style="margin-top:14px;">Mga Users</h3>
    <table><thead><tr><th>Pangalan</th><th>Role</th></tr></thead><tbody id="adminUserTable"></tbody></table>
    <h3 style="margin-top:14px;">Announcements</h3>
    <div class="card">
      <textarea id="annText" rows="2" placeholder="I-broadcast ang anunsyo sa lahat ng users..."></textarea>
      <button class="btn" style="margin-top:8px;" onclick="postAnnouncement()">I-broadcast</button>
    </div>
    <div id="annList"></div>
  `;
});

function refreshAdminHome(){
  document.getElementById('adUsers').textContent = DB.users.length;
  document.getElementById('adHarvests').textContent = DB.harvests.length;
  document.getElementById('adBuyers').textContent = DB.buyers.length;
  document.getElementById('adReports').textContent = DB.priceReports.length;
  document.querySelector('#adminReportTable tbody').innerHTML = DB.priceReports.map(r => {
    const dev = Math.abs(r.price - cropById(r.cropId).base) / cropById(r.cropId).base;
    const flag = dev > 0.4;
    return `<tr><td>${cropById(r.cropId).name}</td><td class="${flag ? 'flagged' : ''}">₱${r.price}${flag ? ' ⚠' : ''}</td><td>${r.reporter}</td>
    <td><button class="btn small" onclick="adminApprove(${r.id})">✓</button></td></tr>`;
  }).join('') || '<tr><td colspan="4" class="muted">Walang ulat.</td></tr>';
  document.getElementById('adminPriceTable').innerHTML = DB.crops.map(c => `
    <tr><td>${c.name}</td><td>₱${c.fairMin}-₱${c.fairMax}</td>
    <td><button class="btn small secondary" onclick="adminEditPrice('${c.id}')">Edit</button></td></tr>`).join('');
  document.getElementById('adminUserTable').innerHTML = DB.users.map(u => `<tr><td>${u.name}</td><td>${u.role}</td></tr>`).join('') || '<tr><td colspan="2" class="muted">Wala pang user.</td></tr>';
  document.getElementById('annList').innerHTML = DB.announcements.slice().reverse().map(a => `<div class="card">📢 ${a}</div>`).join('');
}

function adminApprove(id){
  const r = DB.priceReports.find(x => x.id === id);
  if(r){
    r.status = 'Approved';
    const c = cropById(r.cropId);
    c.base = Math.round(((c.base + r.price) / 2) * 100) / 100;
    save();
    refreshAdminHome();
    toast('Naaprubahan ang ulat, na-update ang market data.');
  }
}

function adminEditPrice(id){
  const c = cropById(id);
  const nv = prompt('Bagong fair min-max presyo (e.g. 20-24) para sa ' + c.name, c.fairMin + '-' + c.fairMax);
  if(nv && nv.includes('-')){
    const [a, b] = nv.split('-').map(Number);
    if(a && b){ c.fairMin = a; c.fairMax = b; save(); refreshAdminHome(); toast('Na-update ang presyo.'); }
  }
}

function postAnnouncement(){
  const t = document.getElementById('annText').value.trim();
  if(!t) return;
  DB.announcements.push(t);
  save();
  document.getElementById('annText').value = '';
  refreshAdminHome();
  toast('Na-broadcast ang anunsyo!');
}

SCREEN_REFRESHERS['screen-admin-home'] = refreshAdminHome;
