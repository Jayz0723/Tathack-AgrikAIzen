const {getUser,verify,send,method,command}=require('./lib/store');
const {KEY,configured,saveSubscriptions}=require('./lib/push');
module.exports=async(req,res)=>{
  if(!method(req,res))return;
  try{
    const session=verify((req.headers.authorization||'').replace(/^Bearer /,'')),user=session&&await getUser(session.email);
    if(!user||user.id!==session.sub)return send(res,401,{error:'Please sign in again.'});
    const input=req.body||{};
    if(input.action==='key')return send(res,200,{configured:configured(),publicKey:configured()?process.env.VAPID_PUBLIC_KEY:null});
    if(!['subscribe','unsubscribe'].includes(input.action)||!input.subscription?.endpoint)return send(res,400,{error:'Invalid push subscription.'});
    for(let attempt=0;attempt<3;attempt++){
      const raw=await command(['GET',KEY]),all=raw?JSON.parse(raw):[],without=all.filter(x=>x.subscription.endpoint!==input.subscription.endpoint&&!(x.userId===user.id&&input.action==='unsubscribe'));
      if(input.action==='subscribe')without.push({userId:user.id,role:user.role,subscription:input.subscription,updatedAt:new Date().toISOString()});
      if(await saveSubscriptions(without,raw||''))return send(res,200,{subscribed:input.action==='subscribe'});
    }
    return send(res,409,{error:'Subscription changed. Please retry.'});
  }catch(error){console.error('push setup failed',error);return send(res,500,{error:'Push notifications are temporarily unavailable.'});}
};
