const { send, method, command } = require('./lib/store');
const {intelligence, weather, externalPrices, withOfficial, governmentSummary} = require('./intelligence');
const MARKET_KEY='agrikaizen:market:v1';
const base = { palay:27, mais:18, kamatis:52, sibuyas:64, saging:24, talong:48, sili:95, pechay:42, repolyo:38, patatas:70, kamote:36, mangga:65, pinya:35, papaya:32, niyog:28 };
const names = { palay:'Palay (rice)', mais:'Mais (corn)', kamatis:'Kamatis (tomato)', sibuyas:'Sibuyas (onion)', saging:'Saging (banana)', talong:'Talong (eggplant)', sili:'Sili (chili pepper)', pechay:'Pechay (bok choy)', repolyo:'Repolyo (cabbage)', patatas:'Patatas (potato)', kamote:'Kamote (sweet potato)', mangga:'Mangga (mango)', pinya:'Pinya (pineapple)', papaya:'Papaya', niyog:'Niyog (coconut)' };

function addTotals(estimate,quantity) {
  const kg=Number(quantity);
  return {...estimate,totalMinimum:Math.round(estimate.minimum*kg*100)/100,totalMaximum:Math.round(estimate.maximum*kg*100)/100};
}

function fallback({ crop, quality, quantity, language },market) {
  const b = market?.fairPrice?.center || base[crop] || 25, modifier = quality === 'premium' ? 1.12 : quality === 'low' ? .84 : 1;
  const center = Math.round(b * modifier), en = language === 'en';
  const sellNow=market?.sellTiming?.recommendation==='sell-now';
  return addTotals({ minimum:Math.max(1,Math.round((market?.fairPrice?.minimum||center-2)*modifier)), maximum:Math.round((market?.fairPrice?.maximum||center+3)*modifier), confidence:Math.min(88,55+(market?.fairPrice?.records||0)*4), bestTime:sellNow?(en?'Current demand favors selling soon.':'Mas mainam magbenta habang mataas ang kasalukuyang demand.'):(en?`Compare offers for up to ${market?.sellTiming?.waitDays||7} days.`:`Ihambing ang mga alok sa loob ng ${market?.sellTiming?.waitDays||7} araw.`), tips:en?[`Sort and protect the ${quantity||0} kg harvest before listing.`, 'Compare at least two verified buyer offers.', 'Confirm transport and payment terms before accepting.']:[`Uriin at ingatan ang ${quantity||0} kg na ani bago i-lista.`, 'Ihambing ang hindi bababa sa dalawang verified buyer offer.', 'Kumpirmahin ang biyahe at paraan ng bayad bago tumanggap.'], source:'market-guidance',marketRecords:market?.fairPrice?.records||0 },quantity);
}
module.exports = async (req,res) => {
  if (!method(req,res)) return;
  const input = req.body || {};
  if (!base[input.crop] || !['premium','standard','low'].includes(input.quality) || !Number.isFinite(input.quantity) || input.quantity < 1 || !input.location || !input.harvestDate) return send(res,400,{error:'Punan ang lahat ng detalye ng ani.'});
  let market=null,weatherData=null,officialRecords=0,governmentData=[];
  try{const raw=await command(['GET',MARKET_KEY]),db={listings:[],offers:[],requests:[],priceReports:[],...(raw?JSON.parse(raw):{})};const official=await externalPrices(input.crop,input.location);officialRecords=official.length;governmentData=governmentSummary(official,official.sourceStatus);market=intelligence(withOfficial(db,official),input.crop,input.location);market.governmentData=governmentData;}catch(error){console.error('market context unavailable',error)}
  try{weatherData=await weather(input.location)}catch(error){console.error('weather context unavailable',error)}
  if (!process.env.OPENAI_API_KEY) return send(res,200,{...fallback(input,market),officialRecords,governmentData,weather:weatherData});
  try {
    const OpenAI=require('openai');
    const client = new OpenAI({ apiKey:process.env.OPENAI_API_KEY });
    const instruction = `You are AgrikAIzen's careful Philippine crop-market assistant. Use only the supplied records and weather context. The numerical farmer price range must use market.fairPrice with quality adjustments; DA retail prices are comparison context only and must never be averaged into the farmgate estimate. PSA observations are monthly farmgate statistics; DA reports are daily NCR retail references, not local farmgate quotations. Milled rice is not unmilled palay, and fresh corn cobs are not dry grain. Mention dates and unavailable sources honestly, never claim real-time government data, compare selling now with waiting, account for perishability, and never guarantee a sale. Return only valid JSON with keys minimum (integer PHP/kg), maximum (integer PHP/kg), confidence (integer 40-90), bestTime (short string), tips (array of exactly 3 short strings). Write values in ${input.language==='en'?'English':'Filipino'}.`;
    const response = await client.responses.create({ model:process.env.OPENAI_MODEL || 'gpt-5.6-luna', instructions:instruction, input:JSON.stringify({crop:names[input.crop],quality:input.quality,quantityKg:input.quantity,location:String(input.location).slice(0,100),expectedHarvest:input.harvestDate,market:market||{referenceBaseline:base[input.crop]},weather:weatherData}) });
    const text = response.output_text.replace(/^```json\s*|\s*```$/g,'').trim(); const result = JSON.parse(text);
    if (!Number.isFinite(result.minimum) || !Number.isFinite(result.maximum) || !Array.isArray(result.tips)) throw new Error('Invalid model response');
    const reference=fallback(input,market);
    return send(res,200,{...addTotals({minimum:reference.minimum,maximum:reference.maximum,confidence:Math.min(90,Math.max(40,Math.round(result.confidence||70))),bestTime:String(result.bestTime||''),tips:result.tips.slice(0,3).map(String),source:'openai',marketRecords:market?.fairPrice?.records||0},input.quantity),officialRecords,governmentData,weather:weatherData});
  } catch (error) { console.error('estimate failed',error); return send(res,200,{...fallback(input,market),officialRecords,governmentData,weather:weatherData,notice:'AI service is temporarily unavailable; showing adaptive market guidance.'}); }
};
module.exports.addTotals=addTotals;
