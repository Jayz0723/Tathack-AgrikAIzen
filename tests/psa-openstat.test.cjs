const test=require('node:test');
const assert=require('node:assert/strict');
const {CROPS,fetchPSAPrices,locationValues,SOURCE}=require('../api/lib/psa-openstat');
const {withOfficial,intelligence}=require('../api/intelligence');

const metadata={variables:[
  {code:'Geolocation',values:['0','10'],valueTexts:['PHILIPPINES','....Bulacan']},
  {code:'Commodity',values:['4','5'],valueTexts:['Eggplant, long, purple','Eggplant, native, round']},
  {code:'Year',values:['15','16'],valueTexts:['2025','2026']},
  {code:'Period',values:['0','1','12'],valueTexts:['January','February','Annual']}
]};

test('PSA OpenSTAT connector maps the requested crop, prefers local data, and labels its source',async()=>{
  assert.equal(Object.keys(CROPS).length,15);
  const original=global.fetch;let query;
  global.fetch=async(_url,options={})=>({ok:true,status:200,text:async()=>{if(!options.method)return JSON.stringify(metadata);query=JSON.parse(options.body);return `\uFEFF${JSON.stringify({data:[
    {key:['0','4','16','0'],values:['44.00']},
    {key:['10','4','16','0'],values:['52.50']},
    {key:['10','5','16','1'],values:['55.25']},
    {key:['10','5','16','12'],values:['54.00']},
    {key:['10','5','15','1'],values:['..']}
  ]})}`;}});
  try{
    const records=await fetchPSAPrices('talong','Bustos, Bulacan',{now:new Date('2026-10-04'),force:true});
    assert.equal(records.length,2);assert.equal(records[0].location,'....Bulacan');assert.equal(records[0].saleDate,'2026-02-01');assert.equal(records[0].sourceName,SOURCE);assert.equal(records[0].status,'verified');
    assert.deepEqual(query.query.find(x=>x.code==='Geolocation').selection.values,['10','0']);
    assert.deepEqual(query.query.find(x=>x.code==='Period').selection.values,['0','1']);
  }finally{global.fetch=original}
});

test('official records are upserted without duplication and contribute verified evidence',()=>{
  const item={crop:'talong',price:52.5,location:'Bulacan',saleDate:'2026-01-01',sourceName:SOURCE,sourceKey:'psa:05:10:4:16:0',status:'verified',marketType:'official-farmgate'};
  const empty={listings:[],offers:[],requests:[],priceReports:[]},first=withOfficial(empty,[item]),second=withOfficial(first,[{...item,price:54}]);
  assert.equal(second.priceReports.length,1);assert.equal(second.priceReports[0].price,54);assert.equal(intelligence(second,'talong','Bulacan').sources.official,1);
  assert.deepEqual(locationValues(metadata,'Bustos, Bulacan').values,['10','0']);
});
