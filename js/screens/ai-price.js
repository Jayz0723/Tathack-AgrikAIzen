/* ===================== AI PRICE INSIGHTS TAB ===================== */

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('screen-ai-price').innerHTML = `
    <div class="topbar"><div class="iconbtn" onclick="go('screen-farmer-home')">←</div><h2>AI Price Insights</h2><div class="iconbtn">↗</div></div>
    <div class="card" style="display:flex;gap:10px;align-items:center;">
      <div class="avatar">🌾</div>
      <div><div class="muted" style="font-size:12px;">Analysing variety</div><b id="aiCropName">—</b></div>
    </div>
    <div class="card" style="text-align:center;background:linear-gradient(180deg,#f3fbe9,#fff);">
      <div class="muted" style="font-size:12px;font-weight:700;">AI REKOMENDADONG PRESYO</div>
      <div class="gauge"><div class="val" id="aiPriceRange">₱25-₱28</div><div class="muted">bawat kilo</div></div>
      <span class="pill" id="aiAboveAvg">+₱3.70 Above Local Buyer Average</span>
    </div>
    <div class="card">
      <div class="row" style="align-items:center;"><span style="flex:1;">AI Confidence Level</span><b id="aiConfidence" style="color:var(--green-700);">94% (Mataas)</b></div>
      <div class="progress"><div class="b" id="aiConfBar" style="width:94%;height:10px;"></div></div>
    </div>
    <div class="card">📅 Pinaka Mainam na Oras na Pagbenta<br><b id="aiBestTime">—</b></div>
    <div class="card" id="aiDemandNote">ℹ️ Mataas ang Demand Ngayong Buwan</div>
    <div class="card badge-warn" id="aiSupplyWarn" style="display:none;">⚠️ Sobra ang Supply sa Susunod na Buwan</div>
    <button class="btn" onclick="acceptAiPrice()">Tanggapin ang Presyo</button>
  `;
});

let aiSelectedCropId = 'palay';

function openAiPrice(id){
  aiSelectedCropId = id;
  go('screen-ai-price');
}

function refreshAiPrice(){
  const c = cropById(aiSelectedCropId) || DB.crops[0];
  document.getElementById('aiCropName').textContent = c.name + ' (RC222 Premium)';
  document.getElementById('aiPriceRange').textContent = `₱${c.fairMin}-₱${c.fairMax}`;
  document.getElementById('aiAboveAvg').textContent = `+₱${(c.fairMin - c.base).toFixed(2)} Above Local Buyer Average`;
  const conf = c.supplyRisk ? 94 : 88;
  document.getElementById('aiConfidence').textContent = `${conf}% (${conf > 90 ? 'Mataas' : 'Katamtaman'})`;
  document.getElementById('aiConfBar').style.width = conf + '%';
  document.getElementById('aiBestTime').textContent = c.bestTime;
  document.getElementById('aiDemandNote').textContent = `ℹ️ ${c.demand} ang Demand Ngayong Buwan — Based on quality & supply`;
  document.getElementById('aiSupplyWarn').style.display = c.supplyRisk ? 'block' : 'none';
}

function acceptAiPrice(){ toast('Naitala ang inaasahang presyo para sa inyong ani.'); }

SCREEN_REFRESHERS['screen-ai-price'] = refreshAiPrice;
