/* ===================== MAGHANAP NG MAMIMILI / FIND BUYERS TAB ===================== */

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('screen-find-buyers').innerHTML = `
    <div class="topbar"><div class="iconbtn" onclick="go('screen-farmer-home')">←</div><h2>Maghanap ng Mamimili</h2></div>
    <input placeholder="Maghanap ng traders, cooperatives, etc..." id="buyerSearch" oninput="renderBuyers()">
    <div class="row" style="margin:10px 0;">
      <button class="choicebtn active" data-sort="near" onclick="pickBuyerSort(this)">Nearest</button>
      <button class="choicebtn" data-sort="price" onclick="pickBuyerSort(this)">Highest Price</button>
      <button class="choicebtn" data-sort="verified" onclick="pickBuyerSort(this)">Verified</button>
    </div>
    <div id="buyerList"></div>
  `;
});

let buyerSort = 'near';

function pickBuyerSort(el){
  el.parentElement.querySelectorAll('.choicebtn').forEach(b => b.classList.remove('active'));
  el.classList.add('active');
  buyerSort = el.dataset.sort;
  renderBuyers();
}

function renderBuyers(){
  const q = (document.getElementById('buyerSearch')?.value || '').toLowerCase();
  let arr = DB.buyers.filter(b => b.name.toLowerCase().includes(q) || b.type.toLowerCase().includes(q));
  if(buyerSort === 'near') arr.sort((a, b) => a.dist - b.dist);
  if(buyerSort === 'price') arr.sort((a, b) => b.price - a.price);
  if(buyerSort === 'verified') arr = arr.filter(b => b.verified);
  document.getElementById('buyerList').innerHTML = arr.map(b => `
    <div class="card" style="display:flex;align-items:center;gap:12px;">
      <div class="avatar round">🏬</div>
      <div style="flex:1;">
        <span class="muted" style="font-size:11px;">${b.verified ? 'VERIFIED PARTNER' : b.type.toUpperCase()}</span><br>
        <b>${b.name}</b><br>
        <span class="muted" style="font-size:12px;">${b.dist} km ang layo</span><br>
        <span style="color:var(--green-700);font-weight:700;">₱${b.price.toFixed(2)}/kg</span>
      </div>
      <button class="btn small" onclick="toast('Contact: ${b.contact}')">I-kontak</button>
    </div>`).join('') || '<p class="muted">Walang nahanap.</p>';
}

SCREEN_REFRESHERS['screen-find-buyers'] = renderBuyers;
