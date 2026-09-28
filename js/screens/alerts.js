/* ===================== ALERTS / NOTIFICATIONS TAB ===================== */

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('screen-alerts').innerHTML = `
    <div class="topbar"><div class="iconbtn" onclick="goHomeForRole()">←</div><h2>Mga Abiso</h2></div>
    <div id="alertList"></div>
  `;
});

function renderAlerts(){
  const risky = DB.crops.filter(c => c.supplyRisk);
  const items = risky.map(c => `<div class="card badge-warn">⚠️ Sobra ang inaasahang supply ng ${c.name} sa susunod na buwan. Isaalang-alang ang pagproseso o maagang pagbenta.</div>`);
  const anns = DB.announcements.slice().reverse().map(a => `<div class="card badge-ok">📢 ${a}</div>`);
  document.getElementById('alertList').innerHTML = items.join('') + anns.join('') || '<p class="muted">Walang bagong abiso.</p>';
}

SCREEN_REFRESHERS['screen-alerts'] = renderAlerts;
