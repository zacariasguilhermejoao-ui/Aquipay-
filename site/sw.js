const V='aquipay-realtime-calls-v14',SHELL=['./','index.html','app.css','i18n.js','legal.js','app.js','native-push.bundle.js','native-google.bundle.js','delete-account.html','manifest.json','aquipay-logo-claro.webp','aquipay-logo.webp','icon-192.png','icon-512.png','favicon.ico','favicon-32.png','apple-touch-icon.png'];
self.addEventListener('install',e=>e.waitUntil(caches.open(V).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==V).map(x=>caches.delete(x)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET'||new URL(e.request.url).origin!==location.origin)return;
  e.respondWith(fetch(e.request).then(r=>{if(r.ok&&!new URL(e.request.url).search){const c=r.clone();caches.open(V).then(x=>x.put(e.request,c))}return r}).catch(()=>caches.match(e.request).then(r=>r||caches.match('index.html'))));
});
self.addEventListener('push',e=>{
  let d={};try{d=e.data.json()}catch(_){}
  e.waitUntil(self.registration.showNotification(d.title||'Aquipay',{body:d.body||'',icon:'icon-192.png',badge:'icon-192.png',data:{url:d.url||'./',callId:d.callId||'',callType:d.callType||''}}));
});
self.addEventListener('notificationclick',e=>{
  e.notification.close();
  e.waitUntil(clients.matchAll({type:'window'}).then(async w=>{const data=e.notification.data||{},url=data.callId?('/?call='+encodeURIComponent(data.callId)):(data.url||'./');if(w.length){if(data.callId)await w[0].navigate(url);return w[0].focus()}return clients.openWindow(url)}));
});