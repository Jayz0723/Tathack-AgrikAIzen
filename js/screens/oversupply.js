/* ===================== IWAS-TAPON SOLUSYON / OVERSUPPLY GUIDE TAB ===================== */

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('screen-oversupply').innerHTML = `
    <div class="topbar"><div class="iconbtn" onclick="go('screen-farmer-home')">←</div><h2>Iwas-Tapon Solusyon</h2></div>
    <div class="hero"><small>⭐ AI REKOMENDASYON</small><h2 style="color:#fff;font-size:18px;">Iproseso ang sobrang ani upang maiwasan ang lugi</h2></div>
    <h3>Mga Pamamaraan ng Pagpoproseso</h3>
    <details class="card"><summary><b>☀️ Pagpapatuyo (Drying)</b></summary><p class="muted">Para sa kamatis, sili, mangga, at saging. Hugasan, hiwain nang pantay, takpan laban sa alikabok at insekto, at patuyuin nang lubos bago ilagay sa airtight na lalagyan. ⏱ 2–3 araw</p></details>
    <details class="card"><summary><b>🫙 Pag-aatsara (Pickling)</b></summary><p class="muted">Para sa papaya, singkamas, pipino, carrots, at sili. Gumamit ng malinis na garapon at subok na recipe na may eksaktong sukat ng suka. Panatilihing refrigerated. ⏱ 1 araw prep</p></details>
    <details class="card"><summary><b>🥤 Juice o Sarsa</b></summary><p class="muted">Para sa kamatis, mangga, pinya, at papaya. Alisin ang sirang prutas, lutuin ayon sa subok na recipe, at ilagay agad sa refrigerator. ⏱ 3–5 oras</p></details>
    <details class="card"><summary><b>🌾 Pag-giling bilang Harina</b></summary><p class="muted">Para sa kamote o saging. Hiwain, patuyuin nang lubos, gilingin, salain, at itago sa malinis at tuyong lalagyan. ⏱ 1–2 araw</p></details>
    <div class="card badge-ok">💡 Payong AgrikAIzen: May mataas na demand ngayon sa dried mangoes.</div>
  `;
});

/* Static content — nothing to refresh. */
SCREEN_REFRESHERS['screen-oversupply'] = () => {};
