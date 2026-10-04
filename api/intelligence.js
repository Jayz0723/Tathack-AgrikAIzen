const crypto = require('crypto');
const {command, getUser, verify, send, method} = require('./lib/store');
const {fetchPSAPrices, SOURCE:PSA_SOURCE} = require('./lib/psa-openstat');

const KEY = 'agrikaizen:market:v1';
const CROPS = ['palay','mais','kamatis','sibuyas','saging','talong','sili','pechay','repolyo','patatas','kamote','mangga','pinya','papaya','niyog'];
const BASE = {palay:25,mais:18,kamatis:50,sibuyas:65,saging:24,talong:48,sili:95,pechay:42,repolyo:38,patatas:70,kamote:36,mangga:65,pinya:35,papaya:32,niyog:28};
const PERISHABILITY = {palay:'low',mais:'medium',kamatis:'high',sibuyas:'medium',saging:'high',talong:'high',sili:'medium',pechay:'high',repolyo:'medium',patatas:'low',kamote:'low',mangga:'high',pinya:'medium',papaya:'high',niyog:'low'};
const COOPERATIVES = [
  {id:'coop-banaue',name:'Banaue Organic Rice Cooperative',location:'Banaue, Ifugao',crops:['palay'],services:['buyer-linkage','storage','transport'],rating:4.9,verified:true},
  {id:'coop-benguet',name:'Benguet Highland Producers',location:'La Trinidad, Benguet',crops:['kamatis','sibuyas'],services:['cold-storage','processing','transport'],rating:4.8,verified:true},
  {id:'coop-samahan',name:'Samahang Nayon Cooperative',location:'Binalonan, Pangasinan',crops:['palay','mais','saging'],services:['buyer-linkage','drying','training'],rating:4.6,verified:true}
];
const blank = () => ({listings:[],offers:[],requests:[],drafts:[],alerts:[],suppliers:[],recurring:[],priceReports:[],assistedFarmers:[]});
const positive = value => typeof value === 'number' && Number.isFinite(value) && value > 0 && value <= 1e9;
const validDate = value => /^\d{4}-\d{2}-\d{2}$/.test(value || '') && Number.isFinite(Date.parse(value));
const clean = (value,max=120) => typeof value === 'string' ? value.trim().slice(0,max) : '';
const fail = (message,status=400) => { throw Object.assign(new Error(message),{status}); };
const month = value => String(value || '').slice(0,7);
const round = value => Math.round(value * 100) / 100;

async function loadDb() {
  const raw = await command(['GET',KEY]);
  return {raw:raw || '',db:Object.assign(blank(),raw ? JSON.parse(raw) : {})};
}
async function saveDb(raw,db) {
  const script="local old=redis.call('GET',KEYS[1]); if (old or '') ~= ARGV[1] then return 0 end; redis.call('SET',KEYS[1],ARGV[2]); return 1";
  if(!await command(['EVAL',script,1,KEY,raw,JSON.stringify(db)])) fail('The market changed. Refresh and try again.',409);
}
function records(db,crop) {
  const reports=db.priceReports.filter(r=>r.crop===crop&&r.status!=='rejected').map(r=>({price:r.price,date:r.saleDate,location:r.location,source:'community',weight:r.status==='verified'?3:1}));
  const offers=db.offers.filter(o=>o.crop===crop&&o.status==='accepted').map(o=>({price:o.price,date:o.completedAt||o.confirmedAt||o.createdAt,location:o.location,source:'transaction',weight:3}));
  const listings=db.listings.filter(l=>l.crop===crop&&l.status==='available').map(l=>({price:l.price,date:l.createdAt||l.harvestDate,location:l.location,source:'listing',weight:1}));
  return [...reports,...offers,...listings].filter(x=>positive(x.price));
}
function weightedAverage(rows) {
  if(!rows.length)return null;
  const total=rows.reduce((sum,row)=>sum+row.price*(row.weight||1),0),weights=rows.reduce((sum,row)=>sum+(row.weight||1),0);
  return round(total/weights);
}
function intelligence(db,crop,location) {
  const rows=records(db,crop),center=weightedAverage(rows)||BASE[crop],prices=rows.map(x=>x.price);
  const minimum=round(prices.length?Math.min(center*.92,...prices):center*.92),maximum=round(prices.length?Math.max(center*1.08,...prices):center*1.08);
  const supply=round(db.listings.filter(l=>l.crop===crop&&l.status==='available').reduce((sum,l)=>sum+(l.availableQuantity??l.quantity??0),0));
  const demand=round(db.requests.filter(r=>r.crop===crop).reduce((sum,r)=>sum+(r.quantity||0),0));
  const forecastMonths=[...new Set([...db.listings.filter(l=>l.crop===crop).map(l=>month(l.harvestDate)),...db.requests.filter(r=>r.crop===crop).map(r=>month(r.requiredDate))].filter(Boolean))].sort();
  const forecast=forecastMonths.map(period=>{const periodSupply=round(db.listings.filter(l=>l.crop===crop&&l.status==='available'&&month(l.harvestDate)===period).reduce((sum,l)=>sum+(l.availableQuantity??l.quantity??0),0)),periodDemand=round(db.requests.filter(r=>r.crop===crop&&month(r.requiredDate)===period).reduce((sum,r)=>sum+(r.quantity||0),0));return {month:period,supply:periodSupply,demand:periodDemand,gap:round(periodSupply-periodDemand),outlook:periodDemand>periodSupply?'shortage-risk':periodSupply>periodDemand*1.25?'oversupply-risk':'balanced'}});
  const ratio=supply ? demand/supply : demand ? 2 : 1;
  const status=ratio>1.25?'shortage-risk':ratio<.75?'oversupply-risk':'balanced';
  const monthly=Object.entries(rows.reduce((acc,row)=>{const key=month(row.date)||'unknown';(acc[key]||(acc[key]=[])).push(row);return acc},{})).filter(([key])=>key!=='unknown').sort().map(([key,list])=>({month:key,price:weightedAverage(list),reports:list.length}));
  const recent=monthly.slice(-3),trend=recent.length>1?round(recent.at(-1).price-recent[0].price):0;
  const perishability=PERISHABILITY[crop],waitDays=perishability==='high'?2:perishability==='medium'?7:14;
  const sellNowScore=Math.max(25,Math.min(95,Math.round(55+ratio*18-trend*1.5+(perishability==='high'?12:0))));
  const waitScore=100-sellNowScore;
  const recommendation=sellNowScore>=waitScore?'sell-now':'compare-and-wait';
  const byLocation=Object.entries(rows.reduce((acc,row)=>{const key=row.location||'Unspecified';(acc[key]||(acc[key]=[])).push(row);return acc},{})).map(([name,list])=>({location:name,price:weightedAverage(list),records:list.length})).sort((a,b)=>b.price-a.price);
  const terms=String(location||'').toLowerCase().split(/[,\s]+/).filter(x=>x.length>2);
  const cooperatives=COOPERATIVES.map(coop=>({...coop,matchScore:40+(coop.crops.includes(crop)?35:0)+(terms.some(term=>coop.location.toLowerCase().includes(term))?20:0)+(coop.services.includes('buyer-linkage')?5:0)})).sort((a,b)=>b.matchScore-a.matchScore);
  const cropReports=db.priceReports.filter(r=>r.crop===crop&&r.status!=='rejected'),official=cropReports.filter(r=>r.marketType==='official-farmgate'||r.marketType==='official-feed');
  return {crop,fairPrice:{minimum,maximum,center,records:rows.length},supplyDemand:{supply,demand,ratio:round(ratio),status,confidence:Math.min(90,45+rows.length*4),forecast},trend:{direction:trend>1?'up':trend<-1?'down':'stable',change:trend,monthly},sellTiming:{recommendation,sellNowScore,waitScore,waitDays,perishability},markets:byLocation.slice(0,8),cooperatives:cooperatives.slice(0,3),sources:{community:cropReports.filter(r=>!official.includes(r)).length,official:official.length,officialSource:PSA_SOURCE,transactions:db.offers.filter(o=>o.crop===crop&&o.status==='accepted').length,listings:db.listings.filter(l=>l.crop===crop&&l.status==='available').length,externalConfigured:true}};
}
async function customExternalPrices(crop,location) {
  if(!process.env.GOV_PRICE_API_URL)return [];
  const url=new URL(process.env.GOV_PRICE_API_URL);url.searchParams.set('crop',crop);if(location)url.searchParams.set('location',location);
  const headers={Accept:'application/json'};if(process.env.GOV_PRICE_API_TOKEN)headers.Authorization=`Bearer ${process.env.GOV_PRICE_API_TOKEN}`;
  const response=await fetch(url,{headers,signal:AbortSignal.timeout(6000)});if(!response.ok)throw new Error('External price source is temporarily unavailable.');
  const payload=await response.json(),items=Array.isArray(payload)?payload:Array.isArray(payload.data)?payload.data:[];
  return items.slice(0,100).map(item=>({crop,price:Number(item.price),location:clean(item.location||location),saleDate:String(item.date||new Date().toISOString()).slice(0,10),sourceName:clean(item.source||'Government price feed'),status:'verified'})).filter(item=>positive(item.price));
}
async function externalPrices(crop,location,options) {
  const psa=await fetchPSAPrices(crop,location,options);let custom=[];try{custom=await customExternalPrices(crop,location)}catch(error){console.error('additional external feed unavailable',error)}
  return [...psa,...custom];
}
function withOfficial(db,items,reporterId='psa-openstat') {
  if(!items.length)return db;
  const copy={...db,priceReports:[...db.priceReports]},byKey=new Map(copy.priceReports.filter(x=>x.sourceKey).map(x=>[x.sourceKey,x]));
  for(const item of items){const record={id:`official-${item.sourceKey||crypto.randomUUID()}`,reporterId,reporter:item.sourceName||'Official data import',quantity:null,createdAt:new Date().toISOString(),...item};const old=item.sourceKey&&byKey.get(item.sourceKey);if(old)Object.assign(old,record,{id:old.id,createdAt:old.createdAt});else copy.priceReports.push(record)}return copy;
}
async function weather(location) {
  if(!location)return null;
  const geo=await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(location)}&count=1&language=en&format=json`,{signal:AbortSignal.timeout(5000)});
  if(!geo.ok)return null;const place=(await geo.json()).results?.[0];if(!place)return null;
  const forecast=await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${place.latitude}&longitude=${place.longitude}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum&forecast_days=7&timezone=Asia%2FManila`,{signal:AbortSignal.timeout(5000)});
  if(!forecast.ok)return null;const daily=(await forecast.json()).daily;if(!daily)return null;
  return {place:`${place.name}${place.admin1?`, ${place.admin1}`:''}`,averageHigh:round(daily.temperature_2m_max.reduce((a,b)=>a+b,0)/daily.temperature_2m_max.length),rainfall:round(daily.precipitation_sum.reduce((a,b)=>a+b,0)),days:daily.time.length,source:'Open-Meteo'};
}
async function aiNarrative(summary,language,location,weatherData) {
  const fallback={source:'statistical',headline:summary.sellTiming.recommendation==='sell-now'?'Current demand favors selling soon.':'Compare buyers before waiting for a better price.',reason:`Demand is ${summary.supplyDemand.demand} kg versus ${summary.supplyDemand.supply} kg listed supply. The observed price trend is ${summary.trend.direction}.`,actions:summary.sellTiming.recommendation==='sell-now'?['Compare verified buyer offers.','Confirm delivery and payment terms.','Prioritize perishable harvests.']:['Monitor new buyer requests.','Protect quality during storage.','Set a price alert and review again.']};
  if(!process.env.OPENAI_API_KEY)return fallback;
  try{
    const OpenAI=require('openai');
    const client=new OpenAI({apiKey:process.env.OPENAI_API_KEY});
    const prompt={crop:summary.crop,location,fairPrice:summary.fairPrice,supplyDemand:summary.supplyDemand,trend:summary.trend,sellTiming:summary.sellTiming,weather:weatherData};
    const response=await client.responses.create({model:process.env.OPENAI_MODEL||'gpt-5.6-luna',instructions:`You are a careful Philippine agricultural market adviser. Use only the supplied statistics. Compare selling now with waiting, mention perishability, never claim live government data unless supplied, and return JSON with headline, reason, actions (exactly 3 short strings). Write in ${language==='en'?'English':'Filipino'}.`,input:JSON.stringify(prompt)});
    const parsed=JSON.parse(response.output_text);return {source:'openai',headline:clean(parsed.headline,180),reason:clean(parsed.reason,500),actions:Array.isArray(parsed.actions)?parsed.actions.slice(0,3).map(x=>clean(x,180)):fallback.actions};
  }catch(error){console.error('intelligence narrative fallback',error);return fallback;}
}

module.exports=async(req,res)=>{
  if(!method(req,res))return;
  try{
    const session=verify((req.headers.authorization||'').replace(/^Bearer /,'')),user=session&&await getUser(session.email);
    if(!user||user.id!==session.sub)return send(res,401,{error:'Please sign in again.'});
    const body=req.body||{},action=body.action||'read',crop=CROPS.includes(body.crop)?body.crop:'palay',location=clean(body.location||user.location);
    const {raw,db}=await loadDb();
    if(action==='read')return send(res,200,{...intelligence(db,crop,location),assistedFarmers:db.assistedFarmers.filter(x=>x.coopId===user.id),reports:db.priceReports.filter(x=>user.role==='admin'||x.reporterId===user.id).slice(-20).reverse()});
    if(action==='analyze'){
      let official=[],officialError=null;try{official=await externalPrices(crop,location)}catch(error){officialError='PSA OpenSTAT is temporarily unavailable.';console.error('official prices unavailable',error)}
      const summary=intelligence(withOfficial(db,official),crop,location);let weatherData=null;try{weatherData=await weather(location)}catch(error){console.error('weather unavailable',error)}
      return send(res,200,{...summary,officialData:{source:PSA_SOURCE,records:official.length,latestDate:official[0]?.saleDate||null,error:officialError},weather:weatherData,narrative:await aiNarrative(summary,body.language,location,weatherData)});
    }
    if(action==='syncExternal'){
      if(user.role!=='admin')fail('Only administrators can import external prices.',403);
      const imported=await externalPrices(crop,location,{force:true}),updated=withOfficial(db,imported,user.id);await saveDb(raw,updated);return send(res,200,{result:{imported:imported.length,source:PSA_SOURCE}});
    }
    if(action==='reportPrice'){
      if(user.role!=='farmer'&&user.role!=='coop')fail('Only farmers and cooperatives can report selling prices.',403);
      if(!CROPS.includes(body.crop)||!positive(body.price)||!positive(body.quantity)||!validDate(body.saleDate)||!location)fail('Complete the crop, price, quantity, date, and location.');
      const transaction=body.transactionId&&db.offers.find(o=>o.id===body.transactionId&&o.transactionStatus==='completed'&&(o.farmerId===user.id||o.delivery?.providerId===user.id));
      const report={id:crypto.randomUUID(),reporterId:user.id,reporter:user.name,crop:body.crop,price:body.price,quantity:body.quantity,location,saleDate:body.saleDate,marketType:clean(body.marketType||'direct-buyer',40),buyerName:clean(body.buyerName,100),transactionId:transaction?.id||null,status:transaction?'verified':'community',createdAt:new Date().toISOString()};
      db.priceReports.push(report);await saveDb(raw,db);return send(res,200,{result:report});
    }
    if(action==='moderateReport'){
      if(user.role!=='admin')fail('Only administrators can review reports.',403);const report=db.priceReports.find(x=>x.id===body.id);if(!report)fail('Price report not found.',404);if(!['verified','rejected'].includes(body.status))fail('Invalid review status.');report.status=body.status;report.reviewedBy=user.id;report.reviewedAt=new Date().toISOString();await saveDb(raw,db);return send(res,200,{result:report});
    }
    if(action==='createAssistedFarmer'){
      if(user.role!=='coop')fail('Only cooperative accounts can use Assisted Farmer Mode.',403);if(!clean(body.name,80)||!location)fail('Enter the farmer name and location.');
      const farmer={id:crypto.randomUUID(),coopId:user.id,coopName:user.name,name:clean(body.name,80),location,phone:clean(body.phone,30),consent:Boolean(body.consent),createdAt:new Date().toISOString()};if(!farmer.consent)fail('Record the farmer’s consent before creating the assisted profile.');db.assistedFarmers.push(farmer);await saveDb(raw,db);return send(res,200,{result:farmer});
    }
    if(action==='publishAssisted'){
      if(user.role!=='coop')fail('Only cooperative accounts can publish assisted listings.',403);const farmer=db.assistedFarmers.find(x=>x.id===body.assistedFarmerId&&x.coopId===user.id);if(!farmer)fail('Assisted farmer not found.',404);
      if(!CROPS.includes(body.crop)||!positive(body.quantity)||!positive(body.price)||!validDate(body.harvestDate)||!clean(body.variety,100)||!['pre-harvest','fresh','emergency'].includes(body.listingType))fail('Complete the assisted harvest details.');
      const listing={id:crypto.randomUUID(),draftId:`assisted-${crypto.randomUUID()}`,farmerId:user.id,farmer:farmer.name,assistedFarmerId:farmer.id,assistedBy:user.id,assistedByName:user.name,crop:body.crop,variety:clean(body.variety,100),quantity:body.quantity,availableQuantity:body.quantity,location:farmer.location,quality:['premium','standard','low'].includes(body.quality)?body.quality:'standard',farmingMethod:['conventional','organic','natural'].includes(body.farmingMethod)?body.farmingMethod:'conventional',listingType:body.listingType,harvestDate:body.harvestDate,price:body.price,status:'available',createdAt:new Date().toISOString()};db.listings.push(listing);await saveDb(raw,db);return send(res,200,{result:listing});
    }
    fail('Unknown intelligence action.');
  }catch(error){return send(res,error.status||500,{error:error.status?error.message:'Market intelligence is temporarily unavailable.'});}
};

module.exports.intelligence=intelligence;
module.exports.weather=weather;
module.exports.externalPrices=externalPrices;
module.exports.withOfficial=withOfficial;
