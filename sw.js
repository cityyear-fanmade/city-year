/* 도시의 한 해 · 서비스 워커: 게임 본체는 네트워크 우선(인터넷이 되면 항상 최신 판, 안 될 때나 3초 넘게 느릴 때만 저장본). 음악(mp3)은 파일이 바뀌지 않으므로 저장본 우선 — 한 번 들은 곡은 다시 받지 않고 오프라인에서도 나온다. 음악을 바꾸면 CACHE 이름의 숫자를 올린다 */
const CACHE='city-year-v2',WAIT=3000;
self.addEventListener('install',e=>{self.skipWaiting()});
self.addEventListener('activate',e=>{e.waitUntil((async()=>{for(const k of await caches.keys())if(k!==CACHE)await caches.delete(k);await self.clients.claim()})())});
self.addEventListener('fetch',e=>{
  const r=e.request;if(r.method!=='GET')return;const u=new URL(r.url);if(u.origin!==location.origin)return;
  if(r.headers.has('range'))return;   /* 부분 요청은 건드리지 않는다 */
  if(/\.(mp3|ogg|wav|m4a)$/i.test(u.pathname)){e.respondWith((async()=>{const c=await caches.open(CACHE),hit=await c.match(r);if(hit)return hit;const res=await fetch(r);if(res&&res.ok)c.put(r,res.clone());return res})());return}
  e.respondWith((async()=>{
    const c=await caches.open(CACHE);
    const net=fetch(r).then(res=>{if(res&&res.ok)c.put(r,res.clone());return res});
    const slow=new Promise(ok=>setTimeout(()=>ok(null),WAIT));
    try{const res=await Promise.race([net,slow.then(async()=>(await c.match(r))||net)]);return res}
    catch(_){const hit=await c.match(r);if(hit)return hit;throw _}
  })())});
