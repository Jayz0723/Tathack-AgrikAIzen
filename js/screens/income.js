/* ===================== KALKULADOR NG KITA / INCOME CALCULATOR TAB ===================== */

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('screen-income').innerHTML = `
    <div class="topbar"><div class="iconbtn" onclick="goHomeForRole()">←</div><h2>Pagtatasa ng Tubo</h2></div>
    <div class="card">
      <label>Binhi at Punla (₱)</label><input type="number" id="expSeed" value="4500">
      <label>Pataba &amp; Pesticides (₱)</label><input type="number" id="expFert" value="6200">
      <label>Labor at Paggawa (₱)</label><input type="number" id="expLabor" value="8000">
      <label>Transportasyon (₱)</label><input type="number" id="expTrans" value="3500">
      <label>Kabuuang Harvest (kg)</label><input type="number" id="incQty" value="1500">
      <label>Presyo kada Kilo (₱)</label><input type="number" id="incPrice" value="45">
      <button class="btn" style="margin-top:14px;" onclick="calcIncome()">Kalkulahin</button>
    </div>
    <div id="incomeResult"></div>
  `;
});

function calcIncome(){
  const seed = +document.getElementById('expSeed').value || 0, fert = +document.getElementById('expFert').value || 0,
        labor = +document.getElementById('expLabor').value || 0, trans = +document.getElementById('expTrans').value || 0,
        qty = +document.getElementById('incQty').value || 0, price = +document.getElementById('incPrice').value || 0;
  const expenses = seed + fert + labor + trans;
  const sales = qty * price;
  const net = sales - expenses;
  document.getElementById('incomeResult').innerHTML = `
    <div class="card" style="background:linear-gradient(135deg,var(--green-700),var(--green-900));color:#fff;">
      <small style="opacity:.8;">INAASAHANG NETONG KITA</small>
      <div style="font-size:30px;font-weight:800;">₱${net.toLocaleString(undefined, {minimumFractionDigits: 2})}</div>
    </div>
    <div class="card">
      <div class="row"><span>Kabuuang Gastos</span><b style="text-align:right;flex:0;">₱${expenses.toLocaleString()}</b></div>
      <div class="row"><span>Benta</span><b style="text-align:right;flex:0;">₱${sales.toLocaleString()}</b></div>
      <div class="progress"><div class="a" style="width:${Math.min(100, expenses / sales * 100 || 0)}%;"></div><div class="b" style="width:${Math.max(0, 100 - (expenses / sales * 100 || 0))}%;"></div></div>
    </div>
    <p class="disclaimer">Ang kalkulasyong ito ay batay sa mga inilagay na numero at hindi garantisadong kita.</p>`;
}

/* No auto-refresh needed — this screen is calculated on demand. */
SCREEN_REFRESHERS['screen-income'] = () => {};
