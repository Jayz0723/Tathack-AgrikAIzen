/* ===================== BUYER DASHBOARD TAB ===================== */

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('screen-buyer-home').innerHTML = `
    <div class="topbar"><h2>Buyer Dashboard</h2><div class="iconbtn" onclick="logout()">⎋</div></div>
    <p class="muted" id="buyerGreet">—</p>
    <h3>Gumawa ng Buying Request</h3>
    <div class="card">
      <label>Pananim na kailangan</label><select id="reqCrop"></select>
      <label>Kailangang Dami (kg)</label><input type="number" id="reqQty" placeholder="1000">
      <label>Target na Presyo (₱/kg)</label><input type="number" id="reqPrice" placeholder="20">
      <label>Target na Petsa</label><input type="date" id="reqDate">
      <label>Lokasyon</label><input id="reqLoc" placeholder="Bulacan">
      <button class="btn" style="margin-top:12px;" onclick="postBuyingRequest()">I-post ang Request</button>
    </div>
    <h3>Mga Paparating na Ani (Browse)</h3>
    <div id="buyerHarvestList"></div>
    <h3 style="margin-top:14px;">Aking mga Request</h3>
    <div id="buyerRequestList"></div>
  `;
});

function refreshBuyerHome(){
  const u = currentUser();
  document.getElementById('buyerGreet').textContent = `Kumusta, ${u ? u.name : ''} — hanapin ang susunod na supply.`;
  fillCropSelect(document.getElementById('reqCrop'));
  document.getElementById('buyerHarvestList').innerHTML = DB.harvests.slice().reverse().map(h => `
    <div class="card" style="display:flex;justify-content:space-between;align-items:center;">
      <div><b>${h.variety}</b><br><span class="muted" style="font-size:12px;">${h.qty} ${h.unit} • ${h.grade} • ${h.loc}</span><br><span class="muted" style="font-size:11px;">ni ${h.farmerName || 'Magsasaka'}</span></div>
      <button class="btn small" onclick="toast('Nakipag-ugnayan kay ${h.farmerName || 'Magsasaka'}')">I-kontak</button>
    </div>`).join('') || '<p class="muted">Walang available na ani sa ngayon.</p>';
  document.getElementById('buyerRequestList').innerHTML = DB.buyingRequests.filter(r => r.buyerId === u?.id).map(r => `
    <div class="card"><b>${cropById(r.cropId)?.name}</b> — ${r.qty}kg @ ₱${r.price}/kg<br><span class="muted" style="font-size:12px;">Target: ${r.date || '—'} • ${r.loc}</span></div>`).join('') || '<p class="muted">Wala ka pang request.</p>';
}

function postBuyingRequest(){
  const cropId = document.getElementById('reqCrop').value, qty = document.getElementById('reqQty').value, price = document.getElementById('reqPrice').value,
        date = document.getElementById('reqDate').value, loc = document.getElementById('reqLoc').value;
  if(!qty || !price){ toast('Punan ang dami at presyo'); return; }
  DB.buyingRequests.push({id: Date.now(), buyerId: currentUser()?.id, cropId, qty, price, date, loc});
  save();
  toast('Naipost ang buying request!');
  refreshBuyerHome();
}

SCREEN_REFRESHERS['screen-buyer-home'] = refreshBuyerHome;
