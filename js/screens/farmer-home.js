/* ===================== FARMER: HOME TAB ===================== */

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('screen-farmer-home').innerHTML = `
    <div class="topbar">
      <div class="avatar round">👨🏽‍🌾</div>
      <div style="flex:1;">
        <div class="muted" style="font-size:12px;">Mabuhay!</div>
        <h3 id="farmerGreetName">Kumusta!</h3>
      </div>
      <div class="iconbtn" onclick="go('screen-alerts')">🔔</div>
    </div>
    <div class="hero">
      <small>✨ NEW HARVEST INSIGHTS</small>
      <h2 style="color:#fff;font-size:19px;margin-top:4px;">Presyo ay alamin bago magbenta</h2>
      <p style="font-size:12px;opacity:.85;">Kunin ang pinakabagong fair market rates na dulot ng AgrikAIzen.</p>
    </div>
    <div class="topbar"><h3 style="flex:1;">Presyo Ngayon</h3><span class="muted" style="font-size:12px;" onclick="go('screen-price-list')">Tingnan lahat</span></div>
    <div class="pricegrid" id="priceStrip"></div>
    <h3>Mga Serbisyo</h3>
    <div class="services">
      <div class="svc" onclick="go('screen-submit-harvest')"><div class="ic" style="background:#eaf5e2;">➕</div><b>Itala ang Ani</b><div class="muted" style="font-size:12px;">Log crop records</div></div>
      <div class="svc" onclick="go('screen-price-list')"><div class="ic" style="background:#fdeedd;">📈</div><b>Presyo</b><div class="muted" style="font-size:12px;">Real-time trends</div></div>
      <div class="svc" onclick="go('screen-find-buyers')"><div class="ic" style="background:#fbe7e6;">🧑‍🌾</div><b>Mamimili</b><div class="muted" style="font-size:12px;">Verified Buyers</div></div>
      <div class="svc" onclick="go('screen-find-coops')"><div class="ic" style="background:#e6f0fb;">🤝</div><b>Kooperatiba</b><div class="muted" style="font-size:12px;">Farmer network</div></div>
      <div class="svc" onclick="go('screen-plan')"><div class="ic" style="background:#eee6fb;">📅</div><b>Plano</b><div class="muted" style="font-size:12px;">Crop planning</div></div>
      <div class="svc" onclick="go('screen-oversupply')"><div class="ic" style="background:#fff6de;">💡</div><b>Gabay</b><div class="muted" style="font-size:12px;">Expert farming tips</div></div>
    </div>
    <div style="margin-top:14px;">
      <div class="svc" onclick="go('screen-income')" style="display:flex;align-items:center;gap:10px;"><span style="font-size:22px;">🧮</span><div><b>Kalkulador ng Kita</b><div class="muted" style="font-size:12px;">Tantiyahin ang tubo ng ani</div></div></div>
    </div>
    <div style="margin-top:10px;">
      <div class="svc" onclick="go('screen-community')" style="display:flex;align-items:center;gap:10px;"><span style="font-size:22px;">💬</span><div><b>Pamayanan</b><div class="muted" style="font-size:12px;">Koneksyon sa ibang magsasaka</div></div></div>
    </div>
  `;
});

function refreshFarmerHome(){
  const u = currentUser();
  document.getElementById('farmerGreetName').textContent = 'Kumusta, ' + (u ? u.name.split(' ')[0] : 'Kaibigan');
  const strip = document.getElementById('priceStrip');
  strip.innerHTML = DB.crops.slice(0, 4).map(c => `
    <div class="pricecard" onclick="openAiPrice('${c.id}')">
      <div style="font-size:22px;">${cropEmoji(c.id)}</div>
      <div>${c.name}</div><div class="p">₱${c.base}<span style="font-weight:400;font-size:11px;">/kg</span></div>
    </div>`).join('');
}

SCREEN_REFRESHERS['screen-farmer-home'] = refreshFarmerHome;
