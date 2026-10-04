const { send, method, command } = require('./lib/store');
const {intelligence, weather} = require('./intelligence');
const MARKET_KEY='agrikaizen:market:v1';
const base = { palay:27, mais:18, kamatis:52, sibuyas:64, saging:24 };
const names = { palay:'Palay (rice)', mais:'Mais (corn)', kamatis:'Kamatis (tomato)', sibuyas:'Sibuyas (onion)', saging:'Saging (banana)' };

function fallback({ crop, quality, quantity, language },market) {
  const b = market?.fairPrice?.center || base[crop] || 25, modifier = quality === 'premium' ? 1.12 : quality === 'low' ? .84 : 1;
  const center = Math.round(b * modifier), en = language === 'en';
  const sellNow=market?.sellTiming?.recommendation==='sell-now';
  return { minimum:Math.max(1,Math.round((market?.fairPrice?.minimum||center-2)*modifier)), maximum:Math.round((market?.fairPrice?.maximum||center+3)*modifier), confidence:Math.min(88,55+(market?.fairPrice?.records||0)*4), bestTime:sellNow?(en?'Current demand favors selling soon.':'Mas mainam magbenta habang mataas ang kasalukuyang demand.'):(en?`Compare offers for up to ${market?.sellTiming?.waitDays||7} days.`:`Ihambing ang mga alok sa loob ng ${market?.sellTiming?.waitDays||7} araw.`), tips:en?[`Sort and protect the ${quantity||0} kg harvest before listing.`, 'Compare at least two verified buyer offers.', 'Confirm transport and payment terms before accepting.']:[`Uriin at ingatan ang ${quantity||0} kg na ani bago i-lista.`, 'Ihambing ang hindi bababa sa dalawang verified buyer offer.', 'Kumpirmahin ang biyahe at paraan ng bayad bago tumanggap.'], source:'market-guidance',marketRecords:market?.fairPrice?.records||0 };
}
module.exports = async (req,res) => {
  if (!method(req,res)) return;
  const input = req.body || {};
  if (!base[input.crop] || !['premium','standard','low'].includes(input.quality) || !Number.isFinite(input.quantity) || input.quantity < 1 || !input.location || !input.harvestDate) return send(res,400,{error:'Punan ang lahat ng detalye ng ani.'});
  let market=null,weatherData=null;
  try{const raw=await command(['GET',MARKET_KEY]),db=raw?JSON.parse(raw):{};market=intelligence({listings:[],offers:[],requests:[],priceReports:[],...db},input.crop,input.location);}catch(error){console.error('market context unavailable',error)}
  try{weatherData=await weather(input.location)}catch(error){console.error('weather context unavailable',error)}
  if (!process.env.OPENAI_API_KEY) return send(res,200,{...fallback(input,market),weather:weatherData});
  try {
    const OpenAI=require('openai');
    const client = new OpenAI({ apiKey:process.env.OPENAI_API_KEY });
    const instruction = `You are AgrikAIzen's careful Philippine crop-market assistant. Use only the supplied app records and weather context. Give a conservative price estimate, compare selling now with waiting, account for perishability, never guarantee a sale, and never claim government data unless an official feed is explicitly present. Return only valid JSON with keys minimum (integer PHP/kg), maximum (integer PHP/kg), confidence (integer 40-90), bestTime (short string), tips (array of exactly 3 short strings). Write values in ${input.language==='en'?'English':'Filipino'}.`;
    const response = await client.responses.create({ model:process.env.OPENAI_MODEL || 'gpt-5.6-luna', instructions:instruction, input:JSON.stringify({crop:names[input.crop],quality:input.quality,quantityKg:input.quantity,location:String(input.location).slice(0,100),expectedHarvest:input.harvestDate,market:market||{referenceBaseline:base[input.crop]},weather:weatherData}) });
    const text = response.output_text.replace(/^```json\s*|\s*```$/g,'').trim(); const result = JSON.parse(text);
    if (!Number.isFinite(result.minimum) || !Number.isFinite(result.maximum) || !Array.isArray(result.tips)) throw new Error('Invalid model response');
    return send(res,200,{minimum:Math.max(1,Math.round(result.minimum)),maximum:Math.max(1,Math.round(result.maximum)),confidence:Math.min(90,Math.max(40,Math.round(result.confidence||70))),bestTime:String(result.bestTime||''),tips:result.tips.slice(0,3).map(String),source:'openai',marketRecords:market?.fairPrice?.records||0,weather:weatherData});
  } catch (error) { console.error('estimate failed',error); return send(res,200,{...fallback(input,market),weather:weatherData,notice:'AI service is temporarily unavailable; showing adaptive market guidance.'}); }
};
