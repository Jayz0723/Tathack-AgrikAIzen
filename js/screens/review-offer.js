/* ===================== SURIIN ANG ALOK / REVIEW OFFER TAB ===================== */

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('screen-review-offer').innerHTML = `
    <div class="topbar"><div class="iconbtn" onclick="go('screen-farmer-home')">←</div><h2>Suriin ang Alok</h2></div>
    <div class="card">
      <label>Pananim</label><select id="offerCrop"></select>
      <label>Alok ng Trader (₱/kg)</label><input type="number" id="offerAmount" placeholder="e.g. 18.00">
      <button class="btn" style="margin-top:14px;" onclick="checkOffer()">Suriin</button>
    </div>
    <div id="offerResult"></div>
  `;
});

function refreshOfferForm(){
  fillCropSelect(document.getElementById('offerCrop'));
  document.getElementById('offerResult').innerHTML = '';
}

function checkOffer(){
  const c = cropById(document.getElementById('offerCrop').value);
  const offer = parseFloat(document.getElementById('offerAmount').value);
  if(!offer){ toast('Ilagay ang alok na presyo'); return; }
  const fair = (c.fairMin + c.fairMax) / 2;
  const diffPct = Math.round((1 - offer / fair) * 100);
  const low = offer < fair;
  const res = document.getElementById('offerResult');
  res.innerHTML = `
    <div class="card" style="background:${low ? '#fdecea' : '#eafaea'};">
      <b style="color:${low ? 'var(--red)' : 'var(--green-700)'};">${low ? '⚠️ Mababa ang Presyo!' : '✅ Patas o Mataas ang Presyo!'}</b>
      <p class="muted" style="font-size:12px;">Inalok na presyo ay ${low ? 'mababa sa' : 'katugma o mataas sa'} fair market value.</p>
      <div class="row" style="margin-top:10px;">
        <div><span class="muted" style="font-size:11px;">Alok ng Trader</span><br><b style="color:var(--orange);font-size:20px;">₱${offer.toFixed(2)}</b><br><span class="muted" style="font-size:11px;">bawat kilo</span></div>
        <div><span class="muted" style="font-size:11px;">Fair Price (AI)</span><br><b style="color:var(--green-700);font-size:20px;">₱${fair.toFixed(2)}</b><br><span class="muted" style="font-size:11px;">bawat kilo</span></div>
      </div>
      ${low ? `<div class="badge-warn" style="margin-top:10px;">${diffPct}% mas mababa sa patas na presyo!</div>` : ''}
    </div>
    ${low ? `
    <h3>Inirerekomendang Hakbang</h3>
    <div class="card" onclick="go('screen-find-coops')" style="cursor:pointer;">🤝 Bumahagi sa pinakamalapit na Kooperatiba<br><span class="muted" style="font-size:12px;">${DB.coops[0].name} • ${DB.coops[0].dist}km away</span></div>
    <div class="card" onclick="go('screen-find-buyers')" style="cursor:pointer;">🧑‍🌾 Suriin ang direktang mamimili sa AgrikAIzen<br><span class="muted" style="font-size:12px;">${DB.buyers.filter(b => b.price > offer).length} buyers with higher offers verified</span></div>
    <div class="card" onclick="openAiPrice(document.getElementById('offerCrop').value)" style="cursor:pointer;">🔄 Humiling ng panibagong AI Quality Check<br><span class="muted" style="font-size:12px;">Verify moisture content metrics</span></div>
    <button class="btn" onclick="go('screen-find-buyers')">Hanapin ang Ibang Mamimili</button>` : ''}
  `;
}

SCREEN_REFRESHERS['screen-review-offer'] = refreshOfferForm;
