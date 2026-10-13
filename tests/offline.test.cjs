const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
function client(){const data=new Map(),state={user:{id:'offline-a',name:'Farmer A',role:'farmer',location:'Laguna'},token:'test-token',page:'home',recentActivity:[]};const storage={get length(){return data.size},key:i=>[...data.keys()][i]||null,getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};
 const blank=()=>({listings:[],offers:[],requests:[],drafts:[],alerts:[],suppliers:[],recurring:[],priceReports:[],assistedFarmers:[],premium:false});
 const ctx=vm.createContext({state,localStorage:storage,readStoredJson:(k,f=null)=>{try{return JSON.parse(storage.getItem(k)||'null')??f}catch{return f}},marketEmpty:blank,crops:[{id:'palay',base:27},{id:'kamatis',base:52}],t:(_fil,en)=>en,console,structuredClone,crypto:require('node:crypto').webcrypto,TextEncoder,navigator:{onLine:false},document:{getElementById:()=>null},window:{},Date,JSON,Map,Set,URL,Response,AbortSignal,setTimeout(){},toast(){},render(){},shouldPreserveFormInput:()=>true,updateRecentActivity(){},fetch:async()=>{throw Error('No connection')}});
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../js/offline.js'),'utf8'),ctx);ctx.api=async(p,b)=>{const r=await ctx.offlineTransport(p,b,{method:'POST',body:JSON.stringify(b)});return r.json()};return ctx;
}
test('offline guidance uses saved farmgate data, excludes DA retail, and computes quantity totals',async()=>{
 const c=client();c.offlinePut('data:estimate:kamatis',{downloadedAt:'2026-10-13T00:00:00Z',data:{governmentData:[{stage:'farmgate',observations:[{price:20}]},{stage:'retail',observations:[{price:999}]}]}});
 const r=await c.api('/api/estimate',{crop:'kamatis',quality:'standard',quantity:10,location:'Laguna',harvestDate:'2026-10-20'});
 assert.equal(r.source,'offline-guidance');assert.equal(r.minimum,18);assert.equal(r.maximum,22);assert.equal(r.totalMinimum,180);assert.equal(r.totalMaximum,220);assert.equal(r.confidence,0);assert.equal(r.activity.type,'offline-price-estimated');
 c.state.user={id:'offline-b',name:'B',role:'farmer'};c.state.offlineOwner=null;assert.equal(c.offlineSnapshot('estimate:kamatis'),null);assert.equal(c.offlineQueue().length,0);
});
test('offline transactions cannot be confirmed and new login cannot be faked',async()=>{
 const c=client();for(const action of ['respond','respondCounter','respondRequestOffer','selectDelivery','acceptDelivery','startDelivery','completeDelivery'])await assert.rejects(c.api('/api/market',{action,id:'example',status:'accepted'}),/server confirmation/);
 await assert.rejects(c.api('/api/auth/login',{email:'x',password:'x'}),/require internet/);assert.equal(c.offlineQueue().length,0);
});
test('harvests saved offline remain drafts or unpublished pending items',async()=>{
 const c=client(),body={draftId:'draft-1',crop:'palay',variety:'RC 222',quantity:50,location:'Laguna',harvestDate:'2026-10-22'};
 const saved=await c.api('/api/market',{action:'saveDraft',...body});assert.equal(saved.queued,true);assert.equal(c.offlineMarket().drafts[0].pendingSync,true);
 await c.api('/api/market',{action:'publish',...body,price:25});const listing=c.offlineMarket().listings[0];assert.equal(listing.status,'pending-sync');assert.equal(listing.availableQuantity,0);assert.equal(c.offlineMarket().drafts.length,0);
 await assert.rejects(c.api('/api/market',{action:'saveDraft',...body,quantity:-5}),/positive/);
});
test('offline posts, replies, and reactions persist without pretending they were sent',async()=>{
 const c=client(),post=await c.api('/api/community',{action:'createPost',text:'Offline post',category:'general'});
 await c.api('/api/community',{action:'addComment',postId:post.result.id,text:'Offline reply'});await c.api('/api/community',{action:'toggleReaction',postId:post.result.id,reaction:'helpful'});
 const data=c.offlineCommunity();assert.equal(data.posts[0].pendingSync,true);assert.equal(data.posts[0].comments[0].pendingSync,true);assert.equal(data.posts[0].reactions.helpful,1);assert.equal(c.offlineQueue().length,3);
});
test('local password verification uses real salted PBKDF2 and rejects incorrect credentials',async()=>{
 const c=client(),password='unrelated-test-secret',salt='test-salt',iterations=210000;
 assert.equal(await c.offlinePasswordVerifier(password,salt,iterations),require('node:crypto').pbkdf2Sync(password,salt,iterations,32,'sha256').toString('hex'));
 await assert.rejects(c.signInLocalOffline('jcherrera0723@gmail.com','incorrect-secret'),/Incorrect offline account/);
 await assert.rejects(c.signInLocalOffline('other@example.com','incorrect-secret'),/Incorrect offline account/);
 assert.equal(c.state.user.id,'offline-a');
});
test('local account work never reaches the server, even while connected or when sync is requested',async()=>{
 const c=client();c.state.user={id:'local-offline-jcherrera0723',name:'John Carlo Herrera',role:'farmer',localOnly:true};c.state.token='';c.navigator.onLine=true;let calls=0;c.fetch=async()=>{calls++;throw Error('Must not connect')};
 const body={draftId:'local-draft',crop:'palay',variety:'RC 222',quantity:50,location:'Laguna',harvestDate:'2026-10-22'};
 await c.api('/api/market',{action:'saveDraft',...body});assert.equal(c.offlineMarket().drafts[0].variety,'RC 222');
 await c.api('/api/community',{action:'createPost',text:'Local composition',category:'general'});
 for(let i=0;i<160;i++)await c.api('/api/market',{action:'recordUsage',page:'plan'});
 assert.equal(c.offlineQueue().length,2);assert.equal(c.offlineHistory(c.state.user.id).length,50);
 await c.offlineSync(true);assert.equal(calls,0);assert.equal(c.offlineQueue().length,2);
 for(const [path,body]of [['/api/market',{action:'offer'}],['/api/market',{action:'messageOffer'}],['/api/subscription',{action:'choose',plan:'enterprise'}]])await assert.rejects(c.api(path,body),/online account/);
 c.offlinePut('data:market',{downloadedAt:new Date().toISOString(),data:{premium:true,subscriptionTier:'enterprise'}});assert.equal(c.offlineMarket().premium,false);assert.equal(c.offlineMarket().subscriptionTier,null);
 c.state.user={id:'online-user',role:'farmer'};c.state.token='real-online-token';assert.equal(c.offlineQueue().length,0);assert.equal(c.offlineHistory(c.state.user.id).length,0);
});
test('online sign-in retries after a temporary failure instead of remaining trapped in offline mode',async()=>{
 const c=client();c.state.user=null;c.state.token='';c.navigator.onLine=true;let calls=0;
 c.fetch=async()=>{calls++;throw Error('Temporary failure')};await assert.rejects(c.api('/api/auth/login',{email:'test@example.com',password:'unrelated-secret'}),/require internet/);assert.equal(c.state.networkUnavailable,true);
 c.fetch=async()=>{calls++;return new Response(JSON.stringify({user:{id:'online-user'},token:'test-token'}),{status:200})};
 const response=await c.api('/api/auth/login',{email:'test@example.com',password:'unrelated-secret'});assert.equal(response.user.id,'online-user');assert.equal(c.state.networkUnavailable,false);assert.equal(calls,2);assert.equal(c.localStorage.length,0);
 c.state.networkUnavailable=true;c.fetch=async()=>new Response(JSON.stringify({error:'Service temporarily unavailable.'}),{status:503});const failure=await c.offlineTransport('/api/auth/login',{},{});assert.equal(failure.status,503);assert.equal((await failure.json()).error,'Service temporarily unavailable.');
});
test('failed synchronization retains work and a different account never sends it',async()=>{
 const c=client();await c.api('/api/market',{action:'offer',listingId:'old-listing',quantity:10,price:20});const owner=c.state.user.id;c.navigator.onLine=true;
 c.fetch=async(_p,o)=>new Response(JSON.stringify(JSON.parse(o.body).action==='readActivity'?{}:{error:'Not enough available quantity.'}),{status:JSON.parse(o.body).action==='readActivity'?200:409,headers:{'Content-Type':'application/json'}});
 await c.offlineSync();assert.equal(c.offlineQueue()[0].status,'failed');assert.match(c.offlineQueue()[0].error,/available quantity/);
 c.state.user={id:'offline-b',role:'buyer'};await c.offlineSync();assert.equal(c.offlineQueue().length,0);assert.equal(c.offlineQueue(owner).length,1);
});
test('sync replaces temporary parent IDs and retries use the same request ID',async()=>{
 const c=client();const p=await c.api('/api/community',{action:'createPost',text:'Parent',category:'general'});await c.api('/api/community',{action:'addComment',postId:p.result.id,text:'Reply'});const calls=[];c.navigator.onLine=true;
 c.fetch=async(url,o)=>{const b=JSON.parse(o.body);if(url==='/api/community'&&b.action!=='read'){calls.push(b);return new Response(JSON.stringify({result:{id:b.action==='createPost'?'server-post':'server-reply'},posts:[]}),{status:200})}return new Response(JSON.stringify(url==='/api/community'?{posts:[]}:b.action==='read'?c.marketEmpty():{}),{status:200})};
 await c.offlineSync();assert.equal(c.offlineQueue().length,0);assert.equal(calls[1].postId,'server-post');assert.ok(calls.every(b=>/^[a-z0-9-]{36}$/i.test(b.clientRequestId)));
});
test('backup validation rejects executable identifiers and malformed numeric records',()=>{
 const c=client();assert.doesNotThrow(()=>c.offlineValidateBackup({'data:community':{downloadedAt:'2026-10-13T00:00:00Z',data:{posts:[{id:'safe-post',text:'A < B',comments:[],reactions:{heart:0}}]}}}));
 assert.throws(()=>c.offlineValidateBackup({'data:market':{downloadedAt:'2026-10-13T00:00:00Z',data:{listings:[{id:"post');alert(1)//",quantity:10}]}}}),/identifier/);
 assert.throws(()=>c.offlineValidateBackup({'data:market':{downloadedAt:'2026-10-13T00:00:00Z',data:{listings:[{id:'safe',quantity:'<img onerror=alert(1)>'}]}}}),/number/);
});
test('passwords, file fields, and consent are excluded from local form backups',()=>{
 const c=client();c.state.page='submit';c.document.querySelectorAll=()=>[{id:'listDate',value:'2026-10-22',type:'date'},{id:'password',value:'private-password',type:'password'},{id:'consent',value:'yes',type:'checkbox'},{id:'photo',value:'private-file',type:'file'}];
 c.offlineSaveForm();const values=c.offlineGet('form:submit');assert.equal(values.listDate,'2026-10-22');assert.equal(values.password,undefined);assert.equal(values.consent,undefined);assert.equal(values.photo,undefined);
});

const store=require('../api/lib/store'),market=require('../api/market'),community=require('../api/community');
async function call(handler,user,body){let status,data;await handler({method:'POST',headers:{authorization:'Bearer '+store.sign(user)},body},{status(n){status=n;return this},json(d){data=d}});return {status,data}}
test('server deduplicates retried posts, reactions, buying requests, and price reports per account',async()=>{
 const farmer={id:'offline-server-f',email:'offline-server-f@test.local',name:'Farmer',role:'farmer',location:'Laguna'},buyer={id:'offline-server-b',email:'offline-server-b@test.local',name:'Buyer',role:'buyer',location:'Laguna'};await store.putUser(farmer);await store.putUser(buyer);
 const nonce=()=>require('node:crypto').randomUUID();
 let b={action:'createPost',text:'One post despite retries',category:'general',clientRequestId:nonce()},a=await call(community,farmer,b),retry=await call(community,farmer,b);assert.equal(a.data.result.id,retry.data.result.id);assert.equal(retry.data.posts.filter(p=>p.text===b.text).length,1);
 b={action:'toggleReaction',postId:a.data.result.id,reaction:'heart',clientRequestId:nonce()};await call(community,farmer,b);retry=await call(community,farmer,b);assert.equal(retry.data.posts.find(p=>p.id===b.postId).reactions.heart,1);
 b={action:'request',crop:'palay',quantity:100,price:25,location:'Laguna',requiredDate:'2026-11-01',clientRequestId:nonce()};a=await call(market,buyer,b);retry=await call(market,buyer,b);assert.equal(a.data.result.id,retry.data.result.id);
 b={action:'reportPrice',crop:'palay',quantity:100,price:25,location:'Laguna',saleDate:'2026-10-13',clientRequestId:nonce()};a=await call(require('../api/intelligence'),farmer,b);retry=await call(require('../api/intelligence'),farmer,b);assert.equal(a.data.result.id,retry.data.result.id);
 assert.equal((await store.recentActivity(farmer)).filter(e=>e.type==='price-reported').length,1);
});
