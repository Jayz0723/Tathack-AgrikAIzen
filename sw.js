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
