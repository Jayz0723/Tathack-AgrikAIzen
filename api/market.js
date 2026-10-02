const crypto = require('crypto');
const {command, getUser, verify, send, method} = require('./lib/store');
const {notifyUsers, notifyRoles} = require('./lib/push');
const KEY = 'agrikaizen:market:v1';
const blank = () => ({listings:[], offers:[], requests:[], alerts:[], suppliers:[], recurring:[]});
const fail = (message, status=400) => { throw Object.assign(new Error(message), {status}); };
const number = (x) => typeof x === 'number' && Number.isFinite(x) && x > 0 && x <= 1e9;
const text = (x, max=100) => typeof x === 'string' && x.trim().length > 0 && x.trim().length <= max;
const cropIds = ['palay','mais','kamatis','sibuyas','saging'];
const date = x => /^\d{4}-\d{2}-\d{2}$/.test(x || '') && Number.isFinite(Date.parse(x));
const premium = user => user.role === 'buyer' && user.plan === 'premium';
const requirePremium = user => { if (!premium(user)) fail('This tool requires Buyer Premium.',403); };
function validateCrop(b) {
  if (!cropIds.includes(b.crop) || !number(b.quantity) || !text(b.location)) fail('Invalid crop, quantity or location.');
}
function assessOffer(listing, price) {
  const fairMinimum=number(listing.fairMinimum) ? listing.fairMinimum : Math.max(1,Math.round(listing.price*.9*100)/100);
  return {assessment:price>=fairMinimum?'fair':'low',fairMinimum,assessmentSource:number(listing.fairMinimum)?'ai-estimate':'listing-reference'};
}
function availableQuantity(db, listing) {
  const reserved=db.offers.filter(o=>o.listingId===listing.id&&o.status==='accepted'&&o.transactionStatus!=='cancelled').reduce((sum,o)=>sum+o.quantity,0);
  return Math.max(0,Math.round((listing.quantity-reserved)*100)/100);
}
function confirmTransaction(db, offer, now) {
  const listing=db.listings.find(l=>l.id===offer.listingId);
  if(!listing||availableQuantity(db,listing)<offer.quantity)fail('This harvest no longer has enough available quantity.',409);
  offer.status='accepted'; offer.transactionStatus='confirmed'; offer.confirmedAt=now;
  listing.availableQuantity=availableQuantity(db,listing);
  if(listing.availableQuantity===0)listing.status='sold';
}
function deliveryActor(offer,user) {
  const d=offer.delivery;if(!d)return false;
  if(d.method==='pickup')return user.role==='buyer'&&offer.buyerId===user.id;
  if(d.method==='coop')return user.role==='coop';
  return user.role==='logistics';
}
function visibleOffers(db,user) {
  if(user.role==='farmer')return db.offers.filter(o=>o.farmerId===user.id);
  if(user.role==='buyer')return db.offers.filter(o=>o.buyerId===user.id);
  if(user.role==='coop')return db.offers.filter(o=>o.delivery?.method==='coop'&&(!o.delivery.providerId||o.delivery.providerId===user.id));
  if(user.role==='logistics')return db.offers.filter(o=>o.delivery?.method==='partner'&&(!o.delivery.providerId||o.delivery.providerId===user.id));
  return user.role==='admin'?db.offers:[];
}
function mutate(db, user, b) {
  const id = crypto.randomUUID(), createdAt = new Date().toISOString();
  if (b.action === 'publish') {
    if (user.role !== 'farmer') fail('Only farmers can publish.',403);
    validateCrop(b);
    if (!['pre-harvest','fresh','emergency'].includes(b.listingType) || !['premium','standard','low'].includes(b.quality) || !['conventional','organic','natural'].includes(b.farmingMethod) || !text(b.variety) || !number(b.price) || !date(b.harvestDate)) fail('Complete all listing details.');
    const old = db.listings.find(l => l.farmerId === user.id && l.draftId === b.draftId);
    if (old) return old;
    if (!text(b.draftId)) fail('Missing draft identifier.');
    const listing = {id, draftId:b.draftId, farmerId:user.id, farmer:user.name, crop:b.crop, variety:b.variety.trim(), quantity:b.quantity, availableQuantity:b.quantity, location:b.location.trim(), quality:b.quality, farmingMethod:b.farmingMethod, listingType:b.listingType, harvestDate:b.harvestDate, price:b.price, fairMinimum:number(b.fairMinimum)?b.fairMinimum:null, fairMaximum:number(b.fairMaximum)?b.fairMaximum:null, status:'available', createdAt};
    db.listings.push(listing); return listing;
  }
  if (b.action === 'request') {
    if (user.role !== 'buyer') fail('Only buyers can post requests.',403);
    validateCrop(b); if (!number(b.price)) fail('Enter a valid price.');
    const request = {id,buyerId:user.id,buyer:user.name,crop:b.crop,quantity:b.quantity,price:b.price,location:b.location.trim(),createdAt};
    db.requests.push(request); return request;
  }
  if (b.action === 'offer') {
    if (user.role !== 'buyer') fail('Only buyers can make offers.',403);
    const listing = db.listings.find(l => l.id === b.listingId);
    if (!listing) fail('Listing not found.',404);
    if (listing.status!=='available'||!number(b.price) || !number(b.quantity) || b.quantity > availableQuantity(db,listing)) fail('Enter a valid price and available quantity.');
    const offer = {id,listingId:listing.id,farmerId:listing.farmerId,buyerId:user.id,buyer:user.name,location:user.location,crop:listing.crop,variety:listing.variety,quantity:b.quantity,price:b.price,status:'pending',transactionStatus:'offer_review',...assessOffer(listing,b.price),createdAt};
    db.offers.push(offer); return offer;
  }
  if (b.action === 'respond') {
    const offer = db.offers.find(o => o.id === b.id);
    if (!offer || user.role !== 'farmer' || offer.farmerId !== user.id) fail('Offer not found.',404);
    if (offer.status !== 'pending') fail('This offer has already been reviewed.',409);
    if (!['accepted','rejected','countered'].includes(b.status)) fail('Invalid response.');
    if (b.status === 'countered' && !number(b.price)) fail('Enter a valid counter price.');
    offer.status=b.status; offer.updatedAt=createdAt;
    if (b.status === 'countered') { offer.counterPrice=b.price; offer.transactionStatus='counter_review'; }
    if (b.status === 'accepted') confirmTransaction(db,offer,createdAt);
    if (b.status === 'rejected') offer.transactionStatus='cancelled';
    return offer;
  }
  if (b.action === 'respondCounter') {
    const offer=db.offers.find(o=>o.id===b.id);
    if(!offer||user.role!=='buyer'||offer.buyerId!==user.id||offer.status!=='countered')fail('Counter-offer not found.',404);
    if(!['accepted','rejected'].includes(b.status))fail('Invalid response.');
    if(b.status==='accepted'){offer.price=offer.counterPrice;confirmTransaction(db,offer,createdAt);}else{offer.status='rejected';offer.transactionStatus='cancelled';}
    offer.updatedAt=createdAt;return offer;
  }
  if (b.action === 'selectDelivery') {
    const offer=db.offers.find(o=>o.id===b.id);
    if(!offer||user.role!=='farmer'||offer.farmerId!==user.id||offer.status!=='accepted'||offer.transactionStatus!=='confirmed')fail('Confirmed transaction not found.',404);
    if(!['partner','coop','pickup'].includes(b.deliveryMethod))fail('Choose a delivery method.');
    offer.delivery={method:b.deliveryMethod,status:'awaiting_provider',providerId:null,providerName:null,fee:null,commissionRate:b.deliveryMethod==='pickup'?0:5,selectedAt:createdAt};
    offer.transactionStatus='delivery_assignment';offer.updatedAt=createdAt;return offer;
  }
  if (b.action === 'acceptDelivery') {
    const offer=db.offers.find(o=>o.id===b.id);
    if(!offer||offer.transactionStatus!=='delivery_assignment'||offer.delivery?.status!=='awaiting_provider'||!deliveryActor(offer,user))fail('Delivery job not available.',404);
    const fee=offer.delivery.method==='pickup'?0:b.fee;
    if(offer.delivery.method!=='pickup'&&!number(fee))fail('Enter a valid delivery fee.');
    offer.delivery.providerId=user.id;offer.delivery.providerName=user.name;offer.delivery.fee=fee;offer.delivery.status='accepted';offer.delivery.acceptedAt=createdAt;offer.transactionStatus='delivery_ready';offer.updatedAt=createdAt;return offer;
  }
  if (b.action === 'startDelivery' || b.action === 'completeDelivery') {
    const offer=db.offers.find(o=>o.id===b.id);
    if(!offer||offer.delivery?.providerId!==user.id||!deliveryActor(offer,user))fail('Assigned delivery not found.',404);
    if(b.action==='startDelivery'){
      if(offer.delivery.status!=='accepted')fail('Delivery cannot be started.',409);
      offer.delivery.status='in_progress';offer.delivery.startedAt=createdAt;offer.transactionStatus='delivery_in_progress';
    }else{
      if(offer.delivery.status!=='in_progress')fail('Delivery is not in progress.',409);
      offer.delivery.status='completed';offer.delivery.completedAt=createdAt;offer.transactionStatus='completed';offer.completedAt=createdAt;
      const produceTotal=Math.round(offer.quantity*offer.price*100)/100,deliveryFee=offer.delivery.fee||0,commission=Math.round(deliveryFee*offer.delivery.commissionRate)/100,providerPayout=Math.round((deliveryFee-commission)*100)/100;
      offer.payment={currency:'PHP',produceTotal,deliveryFee,buyerTotal:Math.round((produceTotal+deliveryFee)*100)/100,farmerReceives:produceTotal,providerReceives:providerPayout,agrikaizenCommission:commission,commissionRate:offer.delivery.commissionRate,status:'breakdown_ready'};
    }
    offer.updatedAt=createdAt;return offer;
  }
  if (b.action === 'bulkOffer') {
    requirePremium(user);
    if (!Array.isArray(b.listingIds) || !b.listingIds.length || b.listingIds.length > 20 || !number(b.quantity) || !number(b.price) || !date(b.requiredDate)) fail('Complete the bulk request details.');
    const selected = [...new Set(b.listingIds)].map(id => db.listings.find(l => l.id === id && l.status === 'available')).filter(Boolean);
    if (!selected.length) fail('No selected listings are available.',404);
    let remaining=b.quantity; const created=[];
    for (const listing of selected) {
      if (remaining <= 0) break;
      const quantity=Math.min(remaining,availableQuantity(db,listing));
      created.push({id:crypto.randomUUID(),listingId:listing.id,farmerId:listing.farmerId,buyerId:user.id,buyer:user.name,location:user.location,crop:listing.crop,variety:listing.variety,quantity,price:b.price,requiredDate:b.requiredDate,status:'pending',transactionStatus:'offer_review',...assessOffer(listing,b.price),bulkRequestId:id,createdAt});
      remaining-=quantity;
    }
    if (remaining > 0) fail('Selected suppliers do not cover the requested quantity.');
    db.offers.push(...created); return created;
  }
  if (b.action === 'createAlert') {
    requirePremium(user);
    if (!cropIds.includes(b.crop) || !number(b.quantity) || !number(b.maximumPrice) || !text(b.location) || !date(b.fromDate) || !date(b.toDate) || b.fromDate>b.toDate) fail('Complete the alert details.');
    const alert={id,buyerId:user.id,crop:b.crop,quantity:b.quantity,maximumPrice:b.maximumPrice,location:b.location.trim(),fromDate:b.fromDate,toDate:b.toDate,active:true,createdAt};
    db.alerts.push(alert); return alert;
  }
  if (b.action === 'deleteAlert') {
    requirePremium(user);
    const index=db.alerts.findIndex(x=>x.id===b.id && x.buyerId===user.id); if(index<0)fail('Alert not found.',404);
    return db.alerts.splice(index,1)[0];
  }
  if (b.action === 'toggleSupplier') {
    requirePremium(user);
    const listing=db.listings.find(l=>l.farmerId===b.farmerId); if(!listing)fail('Supplier not found.',404);
    const index=db.suppliers.findIndex(x=>x.buyerId===user.id && x.farmerId===b.farmerId);
    if(index>=0){db.suppliers.splice(index,1);return {farmerId:b.farmerId,saved:false};}
    const supplier={id,buyerId:user.id,farmerId:b.farmerId,farmer:listing.farmer,location:listing.location,createdAt};db.suppliers.push(supplier);return {...supplier,saved:true};
  }
  if (b.action === 'createRecurring') {
    requirePremium(user);
    if (!cropIds.includes(b.crop) || !number(b.quantity) || !number(b.maximumPrice) || !['weekly','biweekly','monthly'].includes(b.cadence) || !date(b.startDate)) fail('Complete the recurring order details.');
    const order={id,buyerId:user.id,crop:b.crop,quantity:b.quantity,maximumPrice:b.maximumPrice,cadence:b.cadence,startDate:b.startDate,active:true,createdAt};db.recurring.push(order);return order;
  }
  if (b.action === 'toggleRecurring') {
    requirePremium(user);
    const order=db.recurring.find(x=>x.id===b.id && x.buyerId===user.id);if(!order)fail('Recurring order not found.',404);order.active=!order.active;return order;
  }
  fail('Unknown action.');
}
module.exports = async (req,res) => {
  if (!method(req,res)) return;
  try {
    const session = verify((req.headers.authorization || '').replace(/^Bearer /,''));
    const user = session && await getUser(session.email);
    if (!user || user.id !== session.sub) return send(res,401,{error:'Please sign in again.'});
    const b = req.body || {};
    const raw = await command(['GET',KEY]); const db = Object.assign(blank(),raw ? JSON.parse(raw) : {});
    db.offers.forEach(o=>{o.transactionStatus=o.transactionStatus||(o.status==='accepted'?'confirmed':o.status==='countered'?'counter_review':o.status==='rejected'?'cancelled':'offer_review')});
    db.listings.forEach(l=>{l.availableQuantity=availableQuantity(db,l);if(l.availableQuantity===0)l.status='sold'});
    if (b.action === 'read') return send(res,200,{listings:db.listings,requests:db.requests,offers:visibleOffers(db,user),alerts:db.alerts.filter(x=>x.buyerId===user.id),suppliers:db.suppliers.filter(x=>x.buyerId===user.id),recurring:db.recurring.filter(x=>x.buyerId===user.id),premium:premium(user)});
    if (b.action === 'match') {
      if (!premium(user)) return send(res,403,{error:'Auto-matching requires Buyer Premium.'});
      validateCrop({...b,location:user.location}); if (!number(b.price)) fail('Enter a valid maximum price.');
      const matches=db.listings.filter(l => l.status==='available' && l.crop===b.crop && l.availableQuantity>=b.quantity && l.price<=b.price && (!number(b.minimumPrice) || l.price>=b.minimumPrice) && (!b.requiredDate || l.harvestDate<=b.requiredDate) && (!b.quality || b.quality==='any' || l.quality===b.quality) && (!b.farmingMethod || b.farmingMethod==='any' || l.farmingMethod===b.farmingMethod) && (!number(b.distance) || !number(l.distance) || l.distance<=b.distance)).sort((a,b)=>a.price-b.price);
      return send(res,200,{matches,distanceNotice:matches.some(l=>!number(l.distance))});
    }
    const result = mutate(db,user,b);
    // Compare and swap prevents simultaneous publishers/responders losing each other's changes.
    const script = "local old=redis.call('GET',KEYS[1]); if (old or '') ~= ARGV[1] then return 0 end; redis.call('SET',KEYS[1],ARGV[2]); return 1";
    if (!await command(['EVAL',script,1,KEY,raw || '',JSON.stringify(db)])) return send(res,409,{error:'The market changed. Refresh and try again.'});
    try {
      const list=Array.isArray(result)?result:[result],first=list[0];
      if(b.action==='offer'||b.action==='bulkOffer') await Promise.all(list.map(o=>notifyUsers([o.farmerId],'Bagong buyer offer',`${o.buyer} offered ₱${o.price}/kg for ${o.variety}.`,'offers',o.id)));
      if(b.action==='respond'||b.action==='respondCounter') await notifyUsers([first.buyerId,first.farmerId],'Na-update ang alok',`${first.variety}: ${first.status}.`,'offers',first.id);
      if(b.action==='selectDelivery') await (first.delivery.method==='partner'?notifyRoles(['logistics'],'Bagong delivery job',`${first.variety} delivery is available.`,'logistics',first.id):first.delivery.method==='coop'?notifyRoles(['coop'],'Bagong cooperative transport job',`${first.variety} delivery is available.`,'logistics',first.id):notifyUsers([first.buyerId],'Pickup requested',`${first.variety} is ready for buyer pickup.`,'logistics',first.id));
      if(['acceptDelivery','startDelivery','completeDelivery'].includes(b.action)) await notifyUsers([first.farmerId,first.buyerId],'Delivery update',`${first.variety}: ${first.transactionStatus.replaceAll('_',' ')}.`,'offers',first.id);
    } catch(pushError) { console.error('push notification failed',pushError); }
    return send(res,200,{result});
  } catch(error) { return send(res,error.status || 500,{error:error.status ? error.message : 'Marketplace unavailable. Please try again.'}); }
};
module.exports.mutate = mutate;
