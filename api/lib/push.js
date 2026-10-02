const {command} = require('./store');
const KEY='agrikaizen:push:subscriptions:v1';
const configured=()=>Boolean(process.env.VAPID_PUBLIC_KEY&&process.env.VAPID_PRIVATE_KEY&&process.env.VAPID_SUBJECT);
async function subscriptions(){const raw=await command(['GET',KEY]);return raw?JSON.parse(raw):[];}
async function saveSubscriptions(items,expected){
  const script="local old=redis.call('GET',KEYS[1]); if (old or '') ~= ARGV[1] then return 0 end; redis.call('SET',KEYS[1],ARGV[2]); return 1";
  return Boolean(await command(['EVAL',script,1,KEY,expected||'',JSON.stringify(items)]));
}
async function notify(filter,title,body,page,offerId){
  if(!configured())return {sent:0,configured:false};
  const webpush=require('web-push');
  webpush.setVapidDetails(process.env.VAPID_SUBJECT,process.env.VAPID_PUBLIC_KEY,process.env.VAPID_PRIVATE_KEY);
  const all=await subscriptions(),targets=all.filter(filter),payload=JSON.stringify({title,body,url:`/?page=${encodeURIComponent(page)}${offerId?`&offer=${encodeURIComponent(offerId)}`:''}`});
  const stale=new Set(),results=await Promise.allSettled(targets.map(async item=>{try{await webpush.sendNotification(item.subscription,payload);return true}catch(error){if(error.statusCode===404||error.statusCode===410)stale.add(item.subscription.endpoint);throw error}}));
  if(stale.size){const raw=await command(['GET',KEY]),latest=raw?JSON.parse(raw):[];await saveSubscriptions(latest.filter(x=>!stale.has(x.subscription.endpoint)),raw||'');}
  return {sent:results.filter(x=>x.status==='fulfilled').length,configured:true};
}
const notifyUsers=(ids,title,body,page,offerId)=>notify(x=>ids.includes(x.userId),title,body,page,offerId);
const notifyRoles=(roles,title,body,page,offerId)=>notify(x=>roles.includes(x.role),title,body,page,offerId);
module.exports={KEY,configured,subscriptions,saveSubscriptions,notifyUsers,notifyRoles};
