const test=require('node:test');
const assert=require('node:assert/strict');
const {getUser,putUser,sign}=require('../api/lib/store');
const subscription=require('../api/subscription');

const buyer={id:'subscription-buyer',email:'subscription-buyer@test.local',name:'Subscription Buyer',role:'buyer',location:'Bulacan'};
const farmer={id:'subscription-farmer',email:'subscription-farmer@test.local',name:'Subscription Farmer',role:'farmer',location:'Bulacan'};

async function call(user,body){let status,data;await subscription({method:'POST',headers:{authorization:user?`Bearer ${sign(user)}`:''},body},{status(value){status=value;return this},json(value){data=value}});return {status,...data}}

test('buyers can request a plan without granting themselves paid access',async()=>{
  await putUser(buyer);await putUser(farmer);
  assert.equal((await call(null,{action:'choose',plan:'pro'})).status,401);
  assert.equal((await call(farmer,{action:'choose',plan:'pro'})).status,403);
  assert.equal((await call(buyer,{action:'choose',plan:'free'})).status,400);

  const selected=await call(buyer,{action:'choose',plan:'pro'});
  assert.equal(selected.status,200);
  assert.equal(selected.requestedPlan,'pro');
  assert.equal(selected.subscriptionStatus,'pending_payment');
  assert.equal(selected.activePlan,null);
  const saved=await getUser(buyer.email);
  assert.equal(saved.requestedPlan,'pro');
  assert.equal(saved.subscriptionStatus,'pending_payment');
  assert.equal(saved.plan,undefined);

  const changed=await call(buyer,{action:'choose',plan:'enterprise'});
  assert.equal(changed.status,200);
  assert.equal(changed.requestedPlan,'enterprise');
  assert.equal(changed.activePlan,null);
});
