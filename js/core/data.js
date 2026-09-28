/* ===================== DATA LAYER (localStorage) =====================
   Single source of truth for the whole app. Every screen file reads/writes
   through the global DB object and calls save() after changes. */

const DB_KEY = 'agrikaizen_db_v1';

function loadDB(){
  let d = localStorage.getItem(DB_KEY);
  if(d) return JSON.parse(d);
  const seed = {
    users: [],
    currentUserId: null,
    crops: [
      {id:'palay', name:'Palay', fairMin:25, fairMax:28, base:18, unit:'kg', trend:'up', demand:'Mataas', supplyRisk:true, bestTime:'Hulyo 11, 2026'},
      {id:'mais', name:'Mais', fairMin:17, fairMax:19, base:15, unit:'kg', trend:'flat', demand:'Katamtaman', supplyRisk:false, bestTime:'Agosto 2, 2026'},
      {id:'kamatis', name:'Kamatis', fairMin:48, fairMax:55, base:45, unit:'kg', trend:'up', demand:'Mataas', supplyRisk:true, bestTime:'Hulyo 20, 2026'},
      {id:'sibuyas', name:'Sibuyas', fairMin:60, fairMax:70, base:55, unit:'kg', trend:'up', demand:'Mataas', supplyRisk:false, bestTime:'Agosto 5, 2026'},
      {id:'saging', name:'Saging', fairMin:22, fairMax:26, base:20, unit:'kg', trend:'flat', demand:'Katamtaman', supplyRisk:false, bestTime:'Anumang oras'}
    ],
    harvests: [],
    priceReports: [],
    buyers: [
      {id:1,name:'Bulacan Organic Wholesalers',rating:4.9,dist:2.4,price:21.00,verified:true,type:'Wholesaler',contact:'0917-100-2001'},
      {id:2,name:'Juan Dela Cruz Agri-Trading',rating:4.7,dist:4.1,price:20.80,verified:true,type:'Trader',contact:'0917-100-2002'},
      {id:3,name:'Bustos Farmers Cooperative',rating:4.8,dist:1.2,price:20.50,verified:true,type:'Cooperative',contact:'0917-100-2003'},
      {id:4,name:'Pangasinan Grains Corp',rating:4.5,dist:6.7,price:19.90,verified:false,type:'Trader',contact:'0917-100-2004'}
    ],
    coops: [
      {id:1,name:'Banaue Organic Rice Coop',loc:'Banaue, Ifugao',dist:2.4,rating:4.9,members:245,tags:['Patubig','Butil Dryer','Micro-loans']},
      {id:2,name:'Benguet Highland Producers',loc:'La Trinidad, Benguet',dist:5.1,rating:4.8,members:480,tags:['Logistics','Cold Storage','Organic Seeds']},
      {id:3,name:'Samahang Nayon Coop',loc:'Binalonan, Pangasinan',dist:0.8,rating:4.6,members:132,tags:['Storage','Training']}
    ],
    plans: [
      {crop:'Palay (RC 218)', stage:'Yugto ng Pagpupunla (Sowing)', date:'2026-01-14'},
      {crop:'Kamatis (Diamante)', stage:'Paglilipat-tanim (Transplant)', date:'2026-01-16'}
    ],
    posts: [
      {author:'Ramon Dimaculangan', role:'Rice Farmer • Batangas', time:'2h ago', text:'Salamat sa payo ng AgrikAIzen! Matagumpay ang harvest ng aming RC 218 rice variety ngayon. Ang average yield ay tumaas ng halos 18% kumpara noong nakaraang taon dahil sa tamang timing ng pataba.', likes:48, tag:'#UlatAni'},
      {author:'Maria Santos', role:'Agronomist • Benguet Coop', time:'5h ago', text:'Mag-ingat sa peste ng Rice Black Bug (RBB) ngayong papalapit ang kabilugan ng buwan. Iminumungkahi na panatilihin ang antas ng tubig sa palayan o gumamit ng light traps.', likes:32, tag:'#AgronomiyaTip'}
    ],
    buyingRequests: [],
    announcements: []
  };
  localStorage.setItem(DB_KEY, JSON.stringify(seed));
  return seed;
}

let DB = loadDB();

function save(){ localStorage.setItem(DB_KEY, JSON.stringify(DB)); }

function cropById(id){ return DB.crops.find(c => c.id === id); }

function currentUser(){ return DB.users.find(u => u.id === DB.currentUserId); }

function cropEmoji(id){
  return {palay:'🌾', mais:'🌽', kamatis:'🍅', sibuyas:'🧅', saging:'🍌'}[id] || '🌱';
}

function fillCropSelect(sel){
  if(!sel) return;
  sel.innerHTML = DB.crops.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
}

function toast(msg){
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.style.display = 'block';
  setTimeout(() => t.style.display = 'none', 2200);
}
