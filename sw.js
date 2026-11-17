/* 도시의 한 해 · 서비스 워커: 네트워크 우선. 인터넷이 되면 항상 최신 판을 받고, 안 될 때만(또는 3초 넘게 느릴 때) 저장해 둔 판을 쓴다 */
const CACHE='city-year-v1',WAIT=3000;
self.addEventListener('install',e=>{self.skipWaiting()});
self.addEventListener('activate',e=>{e.waitUntil((async()=>{for(const k of await caches.keys())if(k!==CACHE)await caches.delete(k);await self.clients.claim()})())});
self.addEventListener('fetch',e=>{
  const r=e.request;if(r.method!=='GET')return;const u=new URL(r.url);if(u.origin!==location.origin)return;
  if(r.headers.has('range')||/\.(mp3|ogg|wav|m4a)$/i.test(u.pathname))return;   /* 음악은 저장하지 않는다 */
  e.respondWith((async()=>{
    const c=await caches.open(CACHE);
    const net=fetch(r).then(res=>{if(res&&res.ok)c.put(r,res.clone());return res});
    const slow=new Promise(ok=>setTimeout(()=>ok(null),WAIT));
    try{const res=await Promise.race([net,slow.then(async()=>(await c.match(r))||net)]);return res}
    catch(_){const hit=await c.match(r);if(hit)return hit;throw _}
  })())});
