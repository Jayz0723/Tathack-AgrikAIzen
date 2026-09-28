/* ===================== PRESYO / PRICE LIST TAB ===================== */

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('screen-price-list').innerHTML = `
    <div class="topbar"><div class="iconbtn" onclick="go('screen-farmer-home')">←</div><h2>Presyo ng Pananim</h2></div>
    <div id="priceListFull"></div>
    <h3 style="margin-top:16px;">I-ulat ang Aktwal na Presyo</h3>
    <div class="card">
      <label>Pananim</label><select id="reportCrop"></select>
      <label>Aktwal na presyo (₱/kg)</label><input type="number" id="reportPrice" placeholder="e.g. 19.50">
      <button class="btn" style="margin-top:14px;" onclick="submitPriceReport()">I-submit ang Ulat</button>
      <p class="disclaimer">Ang mga ulat ay susuriin ng Admin bago isama sa datos ng presyo.</p>
    </div>
  `;
});

function refreshPriceList(){
  const list = document.getElementById('priceListFull');
  list.innerHTML = DB.crops.map(c => `
    <div class="card" style="display:flex;align-items:center;gap:12px;cursor:pointer;" onclick="openAiPrice('${c.id}')">
      <div class="avatar">${cropEmoji(c.id)}</div>
      <div style="flex:1;">
        <b>${c.name}</b><br><span class="muted" style="font-size:12px;">Fair range: ₱${c.fairMin}-₱${c.fairMax}/kg</span>
      </div>
      <div style="text-align:right;">
        <b style="color:var(--green-700);">₱${c.base}</b><br><span class="muted" style="font-size:11px;">/kg base</span>
      </div>
    </div>`).join('');
  fillCropSelect(document.getElementById('reportCrop'));
}

function submitPriceReport(){
  const cropId = document.getElementById('reportCrop').value;
  const price = parseFloat(document.getElementById('reportPrice').value);
  if(!price){ toast('Ilagay ang presyo'); return; }
  DB.priceReports.push({id: Date.now(), cropId, price, reporter: currentUser()?.name || 'Anonymous', status: 'Pending', flagged: false});
  save();
  toast('Naisumite ang ulat ng presyo. Susuriin ng Admin.');
  document.getElementById('reportPrice').value = '';
}

SCREEN_REFRESHERS['screen-price-list'] = refreshPriceList;
