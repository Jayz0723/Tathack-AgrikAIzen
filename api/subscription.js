const {getUser,putUser,verify,send,method}=require('./lib/store');

const activePlan=user=>user.plan==='pro'?'pro':['enterprise','premium'].includes(user.plan)?'enterprise':null;

module.exports=async(req,res)=>{
  if(!method(req,res))return;
  try{
    const session=verify((req.headers.authorization||'').replace(/^Bearer /,''));
    const user=session&&await getUser(session.email);
    if(!user||user.id!==session.sub)return send(res,401,{error:'Please sign in again.'});
    if(user.role!=='buyer')return send(res,403,{error:'Buyer plans are available only to buyer accounts.'});
    const input=req.body||{};
    if(input.action!=='choose'||!['pro','enterprise'].includes(input.plan))return send(res,400,{error:'Choose either the Pro or Enterprise plan.'});
    user.requestedPlan=input.plan;
    user.subscriptionStatus='pending_payment';
    user.subscriptionRequestedAt=new Date().toISOString();
    await putUser(user);
    return send(res,200,{requestedPlan:user.requestedPlan,subscriptionStatus:user.subscriptionStatus,subscriptionRequestedAt:user.subscriptionRequestedAt,activePlan:activePlan(user)});
  }catch(error){
    console.error('subscription selection failed',error);
    return send(res,500,{error:'The plan selection could not be saved. Please try again.'});
  }
};
