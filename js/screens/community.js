/* ===================== PAMAYANAN / COMMUNITY TAB ===================== */

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('screen-community').innerHTML = `
    <div class="topbar"><div class="iconbtn" onclick="goHomeForRole()">←</div><h2>Pamayanan</h2></div>
    <p class="muted">Koneksyon at kaalaman ng magsasakang Pilipino</p>
    <div id="communityFeed"></div>
    <div class="card">
      <label>Magpost sa Pamayanan</label>
      <textarea id="postText" rows="3" placeholder="Ibahagi ang inyong karanasan o tanong..."></textarea>
      <button class="btn" style="margin-top:10px;" onclick="addPost()">I-post</button>
    </div>
  `;
});

function renderCommunity(){
  document.getElementById('communityFeed').innerHTML = DB.posts.slice().reverse().map(p => `
    <div class="card">
      <div style="display:flex;justify-content:space-between;"><b>${p.author}</b><span class="muted" style="font-size:11px;">${p.time}</span></div>
      <p class="muted" style="font-size:12px;">${p.role}</p>
      <p style="font-size:14px;">${p.text}</p>
      ${p.tag ? `<span class="tag">${p.tag}</span>` : ''}
      <div class="row" style="margin-top:8px;"><span class="muted" style="font-size:12px;">❤️ ${p.likes}</span><span class="muted" style="font-size:12px;">💬 Comment</span><span class="muted" style="font-size:12px;">↗ Share</span></div>
    </div>`).join('');
}

function addPost(){
  const text = document.getElementById('postText').value.trim();
  if(!text) return;
  DB.posts.push({author: currentUser()?.name || 'Ikaw', role: currentRole, time: 'ngayon lang', text, likes: 0, tag: ''});
  save();
  document.getElementById('postText').value = '';
  renderCommunity();
  toast('Naipost!');
}

SCREEN_REFRESHERS['screen-community'] = renderCommunity;
