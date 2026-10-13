const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {latestReport,parseReport,SOURCE,INDEX_URL}=require('../api/lib/da-prices');
const {intelligence,withOfficial,externalPrices,governmentSummary}=require('../api/intelligence');
const {sign,putUser}=require('../api/lib/store');
// Text extracted from the actual official DA PDF, not a synthetic pricing table.
const text=fs.readFileSync(path.join(__dirname,'fixtures/da-ncr-2026-10-13.txt'),'utf8');
const report={date:'2026-10-13',url:'https://www.da.gov.ph/wp-content/uploads/2026/10/October-13-2026-DPI-AFC.pdf'};
const parsed=parseReport(text,report);

test('DA discovery selects the newest published supported official report and rejects future or external links',()=>{
  const html=`<a href="https://example.com/October-13-2026-DPI-AFC.pdf">October 13, 2026</a><a href="/wp-content/uploads/2026/10/October-14-2026-DPI-AFC.pdf">October 14, 2026</a><a href="${report.url}">October 13, 2026</a><a href="/wp-content/uploads/2026/10/Weekly-Average-Prices-October-5-11-2026.pdf">October 5-11, 2026</a>`;
  assert.deepEqual(latestReport(html,new Date('2026-10-13T10:00:00Z')),report);
  assert.throws(()=>latestReport('<a href="https://example.com/report.pdf">October 13, 2026</a>'),/no supported/);
});

test('actual DA PDF text preserves crop, variety, geography, stage, unit, and reporting date',()=>{
  const tomato=parsed.find(r=>r.crop==='kamatis');
  assert.equal(tomato.price,110.97);assert.equal(tomato.saleDate,'2026-10-13');assert.equal(tomato.marketType,'official-retail');assert.equal(tomato.unit,'PHP/kg');assert.equal(tomato.sourceName,SOURCE);assert.equal(tomato.sourceUrl,report.url);assert.match(tomato.location,/NCR/);
  assert.equal(parsed.filter(r=>r.crop==='palay').length,5);
  assert.ok(parsed.filter(r=>r.crop==='palay').every(r=>r.productForm.includes('not unmilled palay')));
  assert.ok(parsed.filter(r=>r.crop==='mais').every(r=>r.productForm.includes('not dry grain')));
  assert.equal(parsed.filter(r=>r.crop==='pechay').length,1);
  assert.ok(!parsed.some(r=>r.commodity.includes('Imported')||r.commodity.includes('Cooking Oil')));
  assert.ok(!parsed.some(r=>r.crop==='niyog'));
  assert.throws(()=>parseReport(text,{...report,date:'2026-10-12'}),/could not be verified/);
  assert.throws(()=>parseReport(text.replace('Peso per Kilogram','Peso per Piece'),report),/units/);
  const unavailable=parseReport(text.replace('Tomato 15-18 pcs/kg 110.97','Tomato 15-18 pcs/kg n/a').replace('Eggplant 3-4 Small Bundles 86.44','Eggplant 3-4 Small Bundles 90.00'),report);
  // A missing price must not be fabricated from the commodity specification.
  assert.ok(!unavailable.some(r=>r.crop==='kamatis'));
});

test('DA retail prices never change farmgate estimates, trends, or market comparisons',()=>{
  const psa={crop:'kamatis',price:20.24,location:'Laguna',saleDate:'2026-06-01',sourceName:'PSA',sourceKey:'psa:tomato:laguna:june',status:'verified',marketType:'official-farmgate'};
  const db={listings:[],offers:[],requests:[],priceReports:[]};
  const farmerOnly=intelligence(withOfficial(db,[psa]),'kamatis','Calamba, Laguna');
  const both=intelligence(withOfficial(db,[psa,...parsed]),'kamatis','Calamba, Laguna');
  assert.deepEqual(both.fairPrice,farmerOnly.fairPrice);assert.deepEqual(both.trend,farmerOnly.trend);assert.deepEqual(both.markets,farmerOnly.markets);
  assert.equal(both.sources.official,2);assert.equal(both.sources.community,0);
  assert.equal(both.governmentData.find(s=>s.id==='da').observations[0].price,110.97);
  const retailOnly=intelligence(withOfficial(db,parsed),'kamatis','Laguna');
  assert.equal(retailOnly.fairPrice.records,0);assert.equal(retailOnly.fairPrice.center,50);
});

test('official sync is idempotent and leaves the original stored snapshot unchanged',()=>{
  const db={listings:[],offers:[],requests:[],priceReports:[]},first=withOfficial(db,parsed);
  const updated=withOfficial(first,[{...parsed[0],price:999},...parsed]);
  assert.equal(updated.priceReports.length,parsed.length);assert.equal(first.priceReports[0].price,parsed[0].price);
  assert.equal(withOfficial(db,[parsed[0],parsed[0]]).priceReports.length,1);
});

test('DA still works when PSA fails, and PSA still works when DA fails',async()=>{
  const original=global.fetch,originalError=console.error,cache=global.__agrikaizenDaCache;
  const oldCache={...cache};console.error=()=>{};
  try{
    cache.report={url:report.url,records:parsed};cache.expiresAt=Date.now()+60000;
    global.fetch=async()=>{throw Error('PSA outage')};
    let result=await externalPrices('kamatis','test-location');
    assert.equal(result.filter(r=>r.sourceKey.startsWith('da:')).length,1);
    assert.equal(result.sourceStatus.find(s=>s.id==='psa').status,'unavailable');
    cache.report=null;cache.expiresAt=0;
    const metadata={variables:[{code:'Geolocation',values:['0'],valueTexts:['PHILIPPINES']},{code:'Commodity',values:['13'],valueTexts:['Tomato']},{code:'Year',values:['16'],valueTexts:['2026']},{code:'Period',values:['0'],valueTexts:['January']}]};
    global.fetch=async(url,options={})=>{if(url===INDEX_URL)throw Error('DA outage');return {ok:true,text:async()=>JSON.stringify(options.method?{data:[{key:['0','13','16','0'],values:['25.00']}]}:metadata)}};
    result=await externalPrices('kamatis','test-location',{force:true});
    assert.equal(result.filter(r=>r.sourceKey.startsWith('psa:')).length,1);
    assert.equal(result.sourceStatus.find(s=>s.id==='da').status,'unavailable');
    global.fetch=async()=>{throw Error('Both offline')};
    result=await externalPrices('kamatis','another-location',{force:true});
    assert.equal(result.length,0);assert.equal(governmentSummary(result,result.sourceStatus).filter(s=>s.status==='unavailable').length,2);
  }finally{global.fetch=original;console.error=originalError;Object.assign(cache,oldCache)}
});

test('community reports cannot impersonate an official government source',async()=>{
  const user={id:'report-source-test',email:'report-source@test.local',name:'Farmer',role:'farmer',location:'Laguna'};await putUser(user);
  let status;await require('../api/intelligence')({method:'POST',headers:{authorization:'Bearer '+sign(user)},body:{action:'reportPrice',crop:'kamatis',quantity:10,price:25,saleDate:'2026-10-13',location:'Laguna',marketType:'official-retail'}},{status(n){status=n;return this},json(){}});
  assert.equal(status,400);
});

test('AI cannot replace the farmer estimate with retail prices and quantity totals stay correct',async()=>{
  const originalFetch=global.fetch,key=process.env.OPENAI_API_KEY,cache=global.__agrikaizenDaCache,oldCache={...cache};
  const openaiPath=require.resolve('openai'),oldModule=require.cache[openaiPath];let modelInput;
  const metadata={variables:[{code:'Geolocation',values:['0'],valueTexts:['PHILIPPINES']},{code:'Commodity',values:['13'],valueTexts:['Tomato']},{code:'Year',values:['16'],valueTexts:['2026']},{code:'Period',values:['0'],valueTexts:['January']}]};
  try{
    process.env.OPENAI_API_KEY='unit-test-key';cache.report={url:report.url,records:parsed};cache.expiresAt=Date.now()+60000;
    global.__agrikaizenPsaCache.clear();
    await require('../api/lib/store').command(['SET','agrikaizen:market:v1',JSON.stringify({listings:[],offers:[],requests:[],priceReports:[]})]);
    global.fetch=async(url,options={})=>url.includes('geocoding-api')?{ok:true,json:async()=>({results:[]})}:{ok:true,text:async()=>JSON.stringify(options.method?{data:[{key:['0','13','16','0'],values:['25.00']}]}:metadata)};
    require.cache[openaiPath]={id:openaiPath,filename:openaiPath,loaded:true,exports:class {constructor(){this.responses={create:async input=>{modelInput=input;return {output_text:JSON.stringify({minimum:111,maximum:999,confidence:70,bestTime:'Compare offers.',tips:['Check quality.','Confirm delivery.','Compare dates.']})}}}}}};
    let status,data;await require('../api/estimate')({method:'POST',body:{crop:'kamatis',quality:'standard',quantity:10,location:'Laguna',harvestDate:'2026-10-14',language:'en'}},{status(n){status=n;return this},json(d){data=d}});
    assert.equal(status,200);assert.equal(data.source,'openai');assert.equal(data.minimum,23);assert.equal(data.maximum,27);assert.equal(data.totalMinimum,230);assert.equal(data.totalMaximum,270);
    const prompt=JSON.parse(modelInput.input);assert.equal(prompt.market.governmentData.find(s=>s.id==='da').observations[0].price,110.97);
    assert.match(modelInput.instructions,/never be averaged into the farmgate estimate/);
  }finally{global.fetch=originalFetch;Object.assign(cache,oldCache);if(key===undefined)delete process.env.OPENAI_API_KEY;else process.env.OPENAI_API_KEY=key;if(oldModule)require.cache[openaiPath]=oldModule;else delete require.cache[openaiPath]}
});

test('government references render bilingually with dates and safe official links',()=>{
  const ctx=vm.createContext({console,URL,Intl,localStorage:{getItem:()=>null},document:{querySelector:()=>({innerHTML:''})},setTimeout(){},window:{}});
  for(const file of ['app.js','marketplace.js','intelligence.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../js',file),'utf8'),ctx);
  ctx.testSources=governmentSummary(parsed,[{id:'psa',status:'unavailable',error:'PSA temporarily unavailable.'},{id:'da',status:'available'}]);
  for(const lang of ['en','fil']){
    const html=vm.runInContext(`state.lang='${lang}';governmentDataCard(testSources)`,ctx);
    assert.match(html,/2026-10-13/);assert.match(html,/NCR/);assert.match(html,/110.97/);assert.match(html,/temporarily unavailable/);assert.match(html,/DA/);assert.match(html,/PSA/);
  }
  ctx.testSources[1].observations[0].url='javascript:alert(1)';
  assert.ok(!vm.runInContext('governmentDataCard(testSources)',ctx).includes('javascript:'));
});
