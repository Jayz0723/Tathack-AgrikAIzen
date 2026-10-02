const test=require('node:test');
const assert=require('node:assert/strict');
const {sign,putUser}=require('../api/lib/store');
const community=require('../api/community');

const farmer={id:'community-farmer',email:'community-farmer@test.local',name:'Mang Ben',role:'farmer',location:'Pangasinan'};
const buyer={id:'community-buyer',email:'community-buyer@test.local',name:'Ana Buyer',role:'buyer',location:'Bulacan'};
const other={id:'community-other',email:'community-other@test.local',name:'Ibang User',role:'coop',location:'Benguet'};
const admin={id:'community-admin',email:'community-admin@test.local',name:'Admin',role:'admin',location:'Manila'};
async function call(user,body){let status,data;await community({method:'POST',headers:{authorization:user?'Bearer '+sign(user):''},body},{status(n){status=n;return this},json(d){data=d}});return {status,...data}}

test('community supports shared posts, reactions, comments, ownership deletion and moderation',async()=>{
  for(const user of [farmer,buyer,other,admin])await putUser(user);
  assert.equal((await call(null,{action:'read'})).status,401);
  const created=await call(farmer,{action:'createPost',text:'Handa na ang aming palay para sa ani.',category:'harvest'});
  assert.equal(created.status,200);assert.equal(created.result.author,'Mang Ben');assert.equal(created.result.canDelete,true);
  const postId=created.result.id;
  const buyerRead=await call(buyer,{action:'read'}),postForBuyer=buyerRead.posts.find(p=>p.id===postId);
  assert.ok(postForBuyer);assert.equal(postForBuyer.canDelete,false);
  const reacted=await call(buyer,{action:'toggleReaction',postId,reaction:'helpful'});
  assert.equal(reacted.result.reactions.helpful,1);assert.deepEqual(reacted.result.viewerReactions,['helpful']);
  const unreacted=await call(buyer,{action:'toggleReaction',postId,reaction:'helpful'});
  assert.equal(unreacted.result.reactions.helpful,0);
  const commented=await call(other,{action:'addComment',postId,text:'Salamat sa update!'});
  assert.equal(commented.result.comments.length,1);assert.equal(commented.result.comments[0].author,'Ibang User');
  assert.equal((await call(buyer,{action:'deletePost',postId})).status,403);
  assert.equal((await call(farmer,{action:'deletePost',postId})).status,200);
  assert.equal((await call(buyer,{action:'read'})).posts.some(p=>p.id===postId),false);
  const moderated=await call(other,{action:'createPost',text:'Post for moderation',category:'general'});
  assert.equal((await call(admin,{action:'deletePost',postId:moderated.result.id})).status,200);
});

test('community validates content and interaction types',async()=>{
  await putUser(farmer);
  assert.equal((await call(farmer,{action:'createPost',text:'   ',category:'general'})).status,400);
  const created=await call(farmer,{action:'createPost',text:'May tanong ako tungkol sa patubig.',category:'question'});
  assert.equal((await call(farmer,{action:'addComment',postId:created.result.id,text:''})).status,400);
  assert.equal((await call(farmer,{action:'toggleReaction',postId:created.result.id,reaction:'angry'})).status,400);
});
