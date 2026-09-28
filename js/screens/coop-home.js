/* ===================== COOPERATIVE DASHBOARD TAB ===================== */

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('screen-coop-home').innerHTML = `
    <div class="topbar"><h2>Kooperatiba Dashboard</h2><div class="iconbtn" onclick="logout()">⎋</div></div>
    <p class="muted" id="coopGreet">—</p>
    <div class="row" style="margin:14px 0;">
      <div class="card stat"><b id="coopFarmerCount">0</b><span class="muted" style="font-size:11px;">MGA MAGSASAKA</span></div>
      <div class="card stat"><b id="coopHarvestCount">0</b><span class="muted" style="font-size:11px;">MGA ANI</span></div>
    </div>
    <h3>I-rehistro ang Magsasaka</h3>
    <div class="card">
      <label>Pangalan ng Magsasaka</label><input id="coopFarmerName" placeholder="Juan Dela Cruz">
      <label>Lokasyon</label><input id="coopFarmerLoc" placeholder="Bustos, Bulacan">
      <label>Pananim</label><select id="coopFarmerCrop"></select>
      <label>Tinatayang Ani (kg)</label><input type="number" id="coopFarmerQty" placeholder="500">
      <button class="btn" style="margin-top:12px;" onclick="coopRegisterFarmer()">I-rehistro</button>
    </div>
    <h3>Mga Naka-rehistrong Magsasaka</h3>
    <div id="coopFarmerList"></div>
    <h3 style="margin-top:14px;">I-verify na Ulat ng Presyo</h3>
    <div id="coopPriceReports"></div>
  `;
});

function refreshCoopHome(){
  const u = currentUser();
  document.getElementById('coopGreet').textContent = `Kumusta, ${u ? u.name : ''} — pangasiwaan ang inyong mga miyembro.`;
  document.getElementById('coopFarmerCount').textContent = DB.users.filter(x => x.role === 'farmer').length;
  document.getElementById('coopHarvestCount').textContent = DB.harvests.length;
  fillCropSelect(document.getElementById('coopFarmerCrop'));
  document.getElementById('coopFarmerList').innerHTML = DB.users.filter(x => x.role === 'farmer').map(f => `
    <div class="list-item"><div class="avatar round">👨🏽‍🌾</div><div style="flex:1;"><b>${f.name}</b><br><span class="muted" style="font-size:12px;">${f.loc}</span></div></div>`).join('') || '<p class="muted">Wala pang naka-rehistro.</p>';
  document.getElementById('coopPriceReports').innerHTML = DB.priceReports.map(r => `
    <div class="card" style="display:flex;justify-content:space-between;align-items:center;">
      <div><b>${cropById(r.cropId)?.name}</b> — ₱${r.price}/kg<br><span class="muted" style="font-size:12px;">ni ${r.reporter} • ${r.status}</span></div>
      <button class="btn small" onclick="verifyReport(${r.id})">I-verify</button>
    </div>`).join('') || '<p class="muted">Walang ulat.</p>';
}

function coopRegisterFarmer(){
  const name = document.getElementById('coopFarmerName').value.trim();
  const loc = document.getElementById('coopFarmerLoc').value.trim();
  const cropId = document.getElementById('coopFarmerCrop').value;
  const qty = document.getElementById('coopFarmerQty').value;
  if(!name){ toast('Ilagay ang pangalan ng magsasaka'); return; }
  const user = {id: Date.now(), name, role: 'farmer', loc: loc || '—', joined: new Date().getFullYear()};
  DB.users.push(user);
  if(qty) DB.harvests.push({id: Date.now() + 1, farmerId: user.id, farmerName: name, cropId, variety: cropById(cropId).name, unit: 'Kilo', qty: Number(qty), grade: 'Grade A (Premium)', loc, date: ''});
  save();
  toast('Narehistro ang magsasaka!');
  refreshCoopHome();
  document.getElementById('coopFarmerName').value = '';
  document.getElementById('coopFarmerLoc').value = '';
  document.getElementById('coopFarmerQty').value = '';
}

function verifyReport(id){
  const r = DB.priceReports.find(x => x.id === id);
  if(r){ r.status = 'Verified'; save(); refreshCoopHome(); toast('Na-verify ang ulat.'); }
}

SCREEN_REFRESHERS['screen-coop-home'] = refreshCoopHome;
