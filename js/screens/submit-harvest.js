/* ===================== ITALA ANG ANI / SUBMIT HARVEST TAB ===================== */

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('screen-submit-harvest').innerHTML = `
    <div class="topbar"><div class="iconbtn" onclick="go('screen-farmer-home')">←</div><h2>Tingnan ang Presyo ng Ani</h2></div>
    <label>Uri ng Pananim</label>
    <select id="hCrop"></select>
    <div class="row" style="margin-top:10px;">
      <button class="btn outline small" onclick="toast('Camera upload simulated')">📷 I-upload o kunan ng litrato</button>
      <button class="btn outline small" onclick="toast('Voice input simulated')">🎤 Pindutin at Magsalita</button>
    </div>
    <label>Pangalan ng Crop / Variety</label>
    <input id="hVariety" placeholder="e.g. RC222 Premium Rice">
    <label>Yunit</label>
    <div class="row">
      <button class="choicebtn active" data-unit="Sako" onclick="pickUnit(this)">Sako</button>
      <button class="choicebtn" data-unit="Kilo" onclick="pickUnit(this)">Kilo</button>
      <button class="choicebtn" data-unit="Kaing" onclick="pickUnit(this)">Kaing</button>
    </div>
    <label>Dami</label>
    <input id="hQty" type="number" placeholder="500">
    <label>Grade / Kalidad</label>
    <div class="row">
      <button class="choicebtn active" data-grade="Grade A (Premium)" onclick="pickGrade(this)">Grade A</button>
      <button class="choicebtn" data-grade="Grade B" onclick="pickGrade(this)">Grade B</button>
      <button class="choicebtn" data-grade="Grade C" onclick="pickGrade(this)">Grade C</button>
    </div>
    <label>Lokasyon</label>
    <input id="hLoc" placeholder="Bustos, Bulacan">
    <label>Inaasahang petsa ng ani</label>
    <input id="hDate" type="date">
    <button class="btn" style="margin-top:16px;" onclick="submitHarvest()">I-submit ang Ani</button>
  `;
});

let selUnit = 'Sako', selGrade = 'Grade A (Premium)';

function pickUnit(el){
  document.querySelectorAll('#screen-submit-harvest .row .choicebtn').forEach(b => { if(b.dataset.unit) b.classList.remove('active'); });
  el.classList.add('active');
  selUnit = el.dataset.unit;
}

function pickGrade(el){
  el.parentElement.querySelectorAll('.choicebtn').forEach(b => b.classList.remove('active'));
  el.classList.add('active');
  selGrade = el.dataset.grade;
}

function refreshHarvestForm(){
  fillCropSelect(document.getElementById('hCrop'));
}

function submitHarvest(){
  const cropId = document.getElementById('hCrop').value;
  const variety = document.getElementById('hVariety').value || cropById(cropId).name;
  const qty = document.getElementById('hQty').value;
  const loc = document.getElementById('hLoc').value || currentUser()?.loc || '';
  const date = document.getElementById('hDate').value;
  if(!qty){ toast('Ilagay ang dami ng ani'); return; }
  DB.harvests.push({id: Date.now(), farmerId: currentUser()?.id, farmerName: currentUser()?.name, cropId, variety, unit: selUnit, qty: Number(qty), grade: selGrade, loc, date});
  save();
  toast('Matagumpay na naitala ang ani!');
  openAiPrice(cropId);
}

SCREEN_REFRESHERS['screen-submit-harvest'] = refreshHarvestForm;
