const test=require('node:test');
const assert=require('node:assert/strict');
const {sign,putUser}=require('../api/lib/store');
const intelligenceApi=require('../api/intelligence');
const market=require('../api/market');

const farmer={id:'intel-farmer',email:'intel-farmer@test.local',name:'Farmer Intel',role:'farmer',location:'Bustos, Bulacan'};
const coop={id:'intel-coop',email:'intel-coop@test.local',name:'Bustos Cooperative',role:'coop',location:'Bustos, Bulacan'};
const buyer={id:'intel-buyer',email:'intel-buyer@test.local',name:'Institutional Buyer',role:'buyer',location:'Bustos, Bulacan'};
const admin={id:'intel-admin',email:'intel-admin@test.local',name:'Market Admin',role:'admin',location:'Manila'};
async function call(handler,user,body){let status,data;await handler({method:'POST',headers:{authorization:user?'Bearer '+sign(user):''},body},{status(n){status=n;return this},json(d){data=d}});return {status,...data}}

test('community prices improve intelligence and can be reviewed',async()=>{
  for(const user of [farmer,coop,buyer,admin])await putUser(user);
  assert.equal((await call(intelligenceApi,null,{action:'read'})).status,401);
  const report=await call(intelligenceApi,farmer,{action:'reportPrice',crop:'sibuyas',price:72,quantity:90,saleDate:'2026-10-02',location:'Bustos, Bulacan',buyerName:'Public market'});
  assert.equal(report.status,200);assert.equal(report.result.status,'community');
  const read=await call(intelligenceApi,farmer,{action:'read',crop:'sibuyas',location:'Bustos'});
  assert.equal(read.status,200);assert.equal(read.sources.community,1);assert.equal(read.fairPrice.center,72);assert.ok(read.sellTiming.sellNowScore>=25);
  assert.equal((await call(intelligenceApi,buyer,{action:'moderateReport',id:report.result.id,status:'verified'})).status,403);
  assert.equal((await call(intelligenceApi,admin,{action:'moderateReport',id:report.result.id,status:'verified'})).result.status,'verified');
});

test('cooperative assisted farmer mode publishes consent-backed listings and manages offers',async()=>{
  for(const user of [farmer,coop,buyer,admin])await putUser(user);
  assert.equal((await call(intelligenceApi,coop,{action:'createAssistedFarmer',name:'Mang Nilo',location:'Bustos',consent:false})).status,400);
  const profile=await call(intelligenceApi,coop,{action:'createAssistedFarmer',name:'Mang Nilo',location:'Bustos',consent:true});
  assert.equal(profile.status,200);
  const listing=await call(intelligenceApi,coop,{action:'publishAssisted',assistedFarmerId:profile.result.id,crop:'mais',variety:'Yellow Corn',quantity:300,price:19,harvestDate:'2026-10-20',listingType:'pre-harvest',quality:'standard',farmingMethod:'conventional'});
  assert.equal(listing.status,200);assert.equal(listing.result.assistedBy,coop.id);
  const offer=await call(market,buyer,{action:'offer',listingId:listing.result.id,quantity:100,price:19});
  assert.equal(offer.status,200);assert.equal(offer.result.farmerId,coop.id);
  const message=await call(market,buyer,{action:'messageOffer',id:offer.result.id,message:'Can the cooperative arrange pickup?'});
  assert.equal(message.status,200);assert.equal(message.result.messages.length,1);
  const coopRead=await call(market,coop,{action:'read'});assert.ok(coopRead.offers.some(x=>x.id===offer.result.id));
  const accepted=await call(market,coop,{action:'respond',id:offer.result.id,status:'accepted'});assert.equal(accepted.result.transactionStatus,'confirmed');
});

test('supply and demand outlook uses current buyer requests and listings',async()=>{
  for(const user of [farmer,buyer])await putUser(user);
  await call(market,buyer,{action:'request',crop:'saging',quantity:1000,price:28,location:'Bustos',requiredDate:'2026-11-01'});
  const outlook=await call(intelligenceApi,farmer,{action:'read',crop:'saging',location:'Bustos'});
  assert.equal(outlook.status,200);assert.ok(outlook.supplyDemand.demand>=1000);assert.equal(outlook.supplyDemand.status,'shortage-risk');assert.ok(outlook.supplyDemand.forecast.some(x=>x.month==='2026-11'&&x.demand>=1000));assert.ok(outlook.cooperatives.length>0);
});
