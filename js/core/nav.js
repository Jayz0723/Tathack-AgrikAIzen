/* ===================== NAVIGATION =====================
   go(screenId) shows one .screen and calls that screen's own refresh
   function (defined in its own js/screens/*.js file). */

const NAVS = {
  farmer:[['screen-farmer-home','🏠','Home'],['screen-price-list','📈','Presyo'],['screen-ai-price','🤖','AI'],['screen-community','👥','Pamayanan'],['screen-profile','👤','Profile']],
  coop:[['screen-coop-home','🤝','Coop'],['screen-community','💬','Feed'],['screen-plan','📅','Plano'],['screen-profile','👤','Profile']],
  buyer:[['screen-buyer-home','🏠','Home'],['screen-find-coops','🤝','Kooperatiba'],['screen-profile','👤','Profile']],
  admin:[['screen-admin-home','🛡️','Gabay'],['screen-income','🧮','Kita'],['screen-profile','👤','Profile']]
};

let currentRole = 'farmer';

function renderNav(){
  const bar = document.getElementById('bottomnav');
  bar.innerHTML = '';
  (NAVS[currentRole] || []).forEach(([id, icon, label]) => {
    const div = document.createElement('div');
    div.className = 'navitem' + (document.getElementById(id)?.classList.contains('active') ? ' active' : '');
    div.innerHTML = `<span class="ic">${icon}</span>${label}`;
    div.onclick = () => go(id);
    bar.appendChild(div);
  });
}

/* Maps a screen id to the refresh function that repopulates it.
   Each screen file registers itself here via SCREEN_REFRESHERS[id] = fn. */
const SCREEN_REFRESHERS = {};

function go(id){
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  renderNav();
  window.scrollTo(0, 0);
  if(typeof SCREEN_REFRESHERS[id] === 'function') SCREEN_REFRESHERS[id]();
}

function goHomeForRole(){
  const map = {farmer:'screen-farmer-home', coop:'screen-coop-home', buyer:'screen-buyer-home', admin:'screen-admin-home'};
  go(map[currentRole]);
}
