/* ===================== MAGHANAP NG KATUWANG / FIND COOPS TAB ===================== */

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('screen-find-coops').innerHTML = `
    <div class="topbar"><div class="iconbtn" onclick="goHomeForRole()">←</div><h2>Maghanap ng Katuwang</h2></div>
    <input placeholder="I-search ang bayan o produkto..." id="coopSearch" oninput="renderCoops()">
    <div class="row" style="margin:10px 0;">
      <button class="choicebtn active" data-sort="near" onclick="pickCoopSort(this)">Pinakamalapit</button>
      <button class="choicebtn" data-sort="members" onclick="pickCoopSort(this)">Maraming Kasapi</button>
    </div>
    <div id="coopList"></div>
  `;
});

let coopSort = 'near';

function pickCoopSort(el){
  el.parentElement.querySelectorAll('.choicebtn').forEach(b => b.classList.remove('active'));
  el.classList.add('active');
  coopSort = el.dataset.sort;
  renderCoops();
}

function renderCoops(){
  const q = (document.getElementById('coopSearch')?.value || '').toLowerCase();
  let arr = DB.coops.filter(c => c.name.toLowerCase().includes(q) || c.loc.toLowerCase().includes(q));
  if(coopSort === 'near') arr.sort((a, b) => a.dist - b.dist);
  if(coopSort === 'members') arr.sort((a, b) => b.members - a.members);
  document.getElementById('coopList').innerHTML = arr.map(c => `
    <div class="card">
      <div><b>${c.name}</b></div>
      <p class="muted" style="font-size:12px;">📍 ${c.loc} (${c.dist} km) &nbsp; 👥 ${c.members} Kasapi</p>
      <div>${c.tags.map(t => `<span class="tag">${t}</span>`).join('')}</div>
      <button class="btn small secondary" style="margin-top:10px;" onclick="toast('Humiling ng koneksyon kay ${c.name}')">Kumonekta</button>
    </div>`).join('') || '<p class="muted">Walang nahanap.</p>';
}

SCREEN_REFRESHERS['screen-find-coops'] = renderCoops;
