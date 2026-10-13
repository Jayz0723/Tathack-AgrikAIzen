const SHELL_CACHE='agrikaizen-shell-offline-v2';
const SHELL=['/','/index.html','/manifest.webmanifest','/css/style.css','/js/app.js','/js/offline.js','/js/marketplace.js','/js/community.js','/js/intelligence.js','/js/flow.js','/js/navigation.js','/assets/logo.jpg','/assets/harvest-insights-v2.jpg','/assets/profile-cover-v2.jpg','/assets/cooperatives-reference.jpg','/assets/profile-reference.jpg',...['palay','mais','kamatis','sibuyas','saging','talong','sili','pechay','repolyo','patatas','kamote','mangga','pinya','papaya','niyog'].map(c=>`/assets/crops/${c}.jpg`)];
self.addEventListener('install',event=>{event.waitUntil((async()=>{const cache=await caches.open(SHELL_CACHE);await cache.addAll(SHELL.map(url=>new Request(url,{cache:'reload'})));await self.skipWaiting()})())});
self.addEventListener('activate',event=>{event.waitUntil((async()=>{for(const key of await caches.keys())if(key.startsWith('agrikaizen-shell-')&&key!==SHELL_CACHE)await caches.delete(key);await self.clients.claim()})())});
self.addEventListener('fetch',event=>{
  const request=event.request,url=new URL(request.url);if(request.method!=='GET'||url.origin!==self.location.origin||url.pathname.startsWith('/api/')||url.pathname==='/sw.js')return;
  if(request.mode==='navigate'){event.respondWith((async()=>{const cache=await caches.open(SHELL_CACHE);try{const response=await fetch(request,{signal:AbortSignal.timeout(5000)});if(response.ok){await cache.put('/index.html',response.clone());return response}}catch{}return cache.match('/index.html')})());return}
  if(!SHELL.includes(url.pathname))return;
  event.respondWith((async()=>{const cache=await caches.open(SHELL_CACHE);if(/\.(js|css)$/.test(url.pathname)){try{const response=await fetch(request);if(response.ok){await cache.put(url.pathname,response.clone());return response}}catch{}}const saved=await cache.match(url.pathname);return saved||fetch(request)})());
});
self.addEventListener('push',event=>{
  let data={title:'AgrikAIzen',body:'May bagong update.',url:'/?page=offers'};
  try{data={...data,...event.data.json()}}catch{}
  event.waitUntil(self.registration.showNotification(data.title,{body:data.body,icon:'/assets/logo.jpg',badge:'/assets/logo.jpg',data:{url:data.url},tag:'agrikaizen-update'}));
});
self.addEventListener('notificationclick',event=>{
  event.notification.close();
  const target=new URL(event.notification.data?.url||'/?page=offers',self.location.origin).href;
  event.waitUntil(clients.matchAll({type:'window',includeUncontrolled:true}).then(list=>{const existing=list.find(c=>new URL(c.url).origin===self.location.origin);if(existing){existing.navigate(target);return existing.focus()}return clients.openWindow(target)}));
});
