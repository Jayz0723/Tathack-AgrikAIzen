const OpenAI = require('openai');
const { send, method } = require('./lib/store');
const base = { palay:27, mais:18, kamatis:52, sibuyas:64, saging:24 };
const names = { palay:'Palay (rice)', mais:'Mais (corn)', kamatis:'Kamatis (tomato)', sibuyas:'Sibuyas (onion)', saging:'Saging (banana)' };

function fallback({ crop, quality, quantity, language }) {
  const b = base[crop] || 25, modifier = quality === 'premium' ? 1.12 : quality === 'low' ? .84 : 1;
  const center = Math.round(b * modifier), en = language === 'en';
  return { minimum:Math.max(1,center-2), maximum:center+3, confidence:78, bestTime:en?'Within 3–7 days of harvest':'Sa loob ng 3–7 araw mula sa ani', tips:en?[`Sort and dry the ${quantity||0} kg harvest before listing.`, 'Compare at least two verified buyer offers.', 'Confirm transport and payment terms before accepting.']:[`Uriin at patuyuin ang ${quantity||0} kg na ani bago i-lista.`, 'Ihambing ang hindi bababa sa dalawang verified buyer offer.', 'Kumpirmahin ang biyahe at paraan ng bayad bago tumanggap.'], source:'market-guidance' };
}
module.exports = async (req,res) => {
  if (!method(req,res)) return;
  const input = req.body || {};
  if (!base[input.crop] || !['premium','standard','low'].includes(input.quality) || !Number.isFinite(input.quantity) || input.quantity < 1 || !input.location || !input.harvestDate) return send(res,400,{error:'Punan ang lahat ng detalye ng ani.'});
  if (!process.env.OPENAI_API_KEY) return send(res,200,fallback(input));
  try {
    const client = new OpenAI({ apiKey:process.env.OPENAI_API_KEY });
    const instruction = `You are AgrikAIzen's careful Philippine crop-market assistant. Give a conservative price estimate, never guarantee a sale, and do not invent real-time market data. Return only valid JSON with keys minimum (integer PHP/kg), maximum (integer PHP/kg), confidence (integer 40-90), bestTime (short string), tips (array of exactly 3 short strings). Write values in ${input.language==='en'?'English':'Filipino'}.`;
    const response = await client.responses.create({ model:process.env.OPENAI_MODEL || 'gpt-6-astra', instructions:instruction, input:`Crop: ${names[input.crop]}; quality: ${input.quality}; quantity: ${input.quantity} kg; location: ${String(input.location).slice(0,100)}; expected harvest: ${input.harvestDate}; reference baseline: PHP ${base[input.crop]}/kg.` });
    const text = response.output_text.replace(/^```json\s*|\s*```$/g,'').trim(); const result = JSON.parse(text);
    if (!Number.isFinite(result.minimum) || !Number.isFinite(result.maximum) || !Array.isArray(result.tips)) throw new Error('Invalid model response');
    return send(res,200,{minimum:Math.max(1,Math.round(result.minimum)),maximum:Math.max(1,Math.round(result.maximum)),confidence:Math.min(90,Math.max(40,Math.round(result.confidence||70))),bestTime:String(result.bestTime||''),tips:result.tips.slice(0,3).map(String),source:'openai'});
  } catch (error) { console.error('estimate failed',error); return send(res,200,{...fallback(input),notice:'AI service is temporarily unavailable; showing market guidance.'}); }
};
