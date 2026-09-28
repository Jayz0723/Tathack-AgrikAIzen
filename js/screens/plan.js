/* ===================== PLANO SA ANI / CROP PLANNING TAB ===================== */

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('screen-plan').innerHTML = `
    <div class="topbar"><div class="iconbtn" onclick="goHomeForRole()">←</div><h2>Plano sa Ani</h2></div>
    <div class="card">☀️ Bahagyang Maulap <b style="float:right;">31°C</b></div>
    <h3>Iskedyul Ngayong Linggo</h3>
    <div id="planList"></div>
    <div class="card">
      <label>Pananim</label><input id="planCrop" placeholder="e.g. Kamatis (Diamante)">
      <label>Yugto</label><input id="planStage" placeholder="e.g. Paglilipat-tanim (Transplant)">
      <label>Petsa</label><input id="planDate" type="date">
      <button class="btn" style="margin-top:12px;" onclick="addPlan()">Idagdag sa Iskedyul</button>
    </div>
    <div class="card" style="background:#fff8e1;">
      <span class="pill" style="background:#fff2c2;color:#8a6d00;">AI TIP</span>
      <p style="font-weight:700;margin-top:6px;">Mungkahi para sa Crop Rotation</p>
      <p class="muted">Ayon sa inyong huling pananim, pinakamainam na magtanim ng Munggo (Mung bean) sa susunod na buwan upang maibalik ang Nitrogen sa lupa.</p>
    </div>
  `;
});

function renderPlans(){
  document.getElementById('planList').innerHTML = DB.plans.map(p => `
    <div class="card" style="display:flex;justify-content:space-between;align-items:center;">
      <div><b>${p.crop}</b><br><span class="muted" style="font-size:12px;">${p.stage}</span></div>
      <span class="pill">${p.date}</span>
    </div>`).join('');
}

function addPlan(){
  const crop = document.getElementById('planCrop').value, stage = document.getElementById('planStage').value, date = document.getElementById('planDate').value;
  if(!crop || !date){ toast('Punan ang pananim at petsa'); return; }
  DB.plans.push({crop, stage: stage || 'Naka-iskedyul', date});
  save();
  renderPlans();
  document.getElementById('planCrop').value = '';
  document.getElementById('planStage').value = '';
  document.getElementById('planDate').value = '';
  toast('Naidagdag sa iskedyul!');
}

SCREEN_REFRESHERS['screen-plan'] = renderPlans;
