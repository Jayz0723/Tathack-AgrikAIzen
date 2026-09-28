/* ===================== IWAS-TAPON SOLUSYON / OVERSUPPLY GUIDE TAB ===================== */

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('screen-oversupply').innerHTML = `
    <div class="topbar"><div class="iconbtn" onclick="go('screen-farmer-home')">←</div><h2>Iwas-Tapon Solusyon</h2></div>
    <div class="hero"><small>⭐ AI REKOMENDASYON</small><h2 style="color:#fff;font-size:18px;">Iproseso ang sobrang ani upang maiwasan ang lugi</h2></div>
    <h3>Mga Pamamaraan ng Pagpoproseso</h3>
    <div class="card"><b>☀️ Pagpapatuyo (Drying)</b><p class="muted">Mainam para sa kamatis at sili. Pinahaba ang buhay ng 6 na buwan. ⏱ 2-3 araw</p></div>
    <div class="card"><b>💧 Pagbuburo (Pickling)</b><p class="muted">Bagay sa singkamas, papaya, at sili. ⏱ 1 araw prep</p></div>
    <div class="card"><b>🥤 Pagpupuree (Juice/Sauce)</b><p class="muted">Para sa labis na kamatis at mangga. ⏱ 4 oras</p></div>
    <div class="card"><b>🌾 Pag-giling (Flour)</b><p class="muted">Iproseso ang kamote o saging upang maging kapaki-pakinabang na harina. ⏱ 1-2 araw</p></div>
    <div class="card badge-ok">💡 Payong AgrikAIzen: May mataas na demand ngayon sa dried mangoes.</div>
  `;
});

/* Static content — nothing to refresh. */
SCREEN_REFRESHERS['screen-oversupply'] = () => {};
