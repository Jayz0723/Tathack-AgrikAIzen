const test=require('node:test');
const assert=require('node:assert/strict');
const {sign,putUser,recentActivity,send}=require('../api/lib/store');
const market=require('../api/market');
const community=require('../api/community');
const first={id:'activity-first',email:'activity-first@test.local',name:'First',role:'farmer',location:'Laguna'};
const second={id:'activity-second',email:'activity-second@test.local',name:'Second',role:'buyer',location:'Laguna'};
async function call(handler,user,body){let status,data;await handler({method:'POST',headers:{authorization:user?'Bearer '+sign(user):''},body},{status(n){status=n;return this},json(d){data=d}});return {status,data}}

test('activity starts empty, stays private, and reads/background refreshes do not create events',async()=>{
  for(const user of [first,second])await putUser(user);
  assert.deepEqual((await call(market,first,{action:'readActivity'})).data.recentActivity,[]);
  const opened=await call(market,first,{action:'recordUsage',page:'prices',userId:second.id});
  assert.equal(opened.status,200);assert.equal(opened.data.activity.type,'view:prices');assert.ok(Number.isFinite(Date.parse(opened.data.activity.createdAt)));
  await call(market,first,{action:'read'});await call(market,first,{action:'read'});
  assert.equal((await recentActivity(first)).length,1);
  assert.deepEqual((await call(market,second,{action:'readActivity',userId:first.id})).data.recentActivity,[]);
  assert.equal((await call(market,null,{action:'readActivity'})).status,401);
});

test('failed actions do not appear as successful usage, but real community actions do',async()=>{
  const before=(await recentActivity(first)).length;
  assert.equal((await call(market,first,{action:'recordUsage',page:'arbitrary-script'})).status,400);
  assert.equal((await call(market,first,{action:'offer',listingId:'missing',price:10,quantity:1})).status,403);
  assert.equal((await recentActivity(first)).length,before);
  const post=await call(community,first,{action:'createPost',text:'An actual community action',category:'general'});
  assert.equal(post.data.activity.type,'community-posted');
  const deleted=await call(community,first,{action:'deletePost',postId:post.data.result.id});
  assert.equal(deleted.data.activity.type,'community-post-deleted');
  const history=await recentActivity(first);assert.equal(history[0].type,'community-post-deleted');assert.ok(!JSON.stringify(history).includes('An actual community action'));
});

test('opening an estimator is distinct from completing an estimate, and publish retries are deduplicated',async()=>{
  const user={...first,id:'activity-distinct',email:'activity-distinct@test.local'};await putUser(user);
  await call(market,user,{action:'recordUsage',page:'estimate'});
  const reply={activityContext:{user,path:'estimate',body:{crop:'kamatis'}},status(){return this},json(){}};
  await send(reply,400,{error:'Failed estimate'});assert.equal((await recentActivity(user)).length,1);
  await send(reply,200,{minimum:10,maximum:20});
  let history=await recentActivity(user);assert.equal(history[0].type,'price-estimated');assert.equal(history[0].crop,'kamatis');assert.equal(history[1].type,'view:estimate');
  reply.activityContext={user,path:'market',body:{action:'publish'}};
  await send(reply,200,{result:{id:'published-once',crop:'palay'}});await send(reply,200,{result:{id:'published-once',crop:'palay'}});
  history=await recentActivity(user);assert.equal(history.filter(e=>e.type==='listing-published').length,1);
});

test('history survives another session, concurrent events are retained, and storage is bounded',async()=>{
  const user={...first,id:'activity-bounded',email:'activity-bounded@test.local'};await putUser(user);
  for(let i=0;i<51;i++)await call(market,user,{action:'recordUsage',feature:'crop-plan',crop:'palay'});
  assert.equal((await recentActivity(user)).length,50);
  await Promise.all(['prices','coops','map'].map(page=>call(market,user,{action:'recordUsage',page})));
  const history=(await call(market,{...user},{action:'readActivity'})).data.recentActivity;
  assert.equal(history.length,50);for(const page of ['prices','coops','map'])assert.ok(history.some(e=>e.type===`view:${page}`));
});
