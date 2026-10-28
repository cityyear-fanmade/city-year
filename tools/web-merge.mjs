#!/usr/bin/env node
/* 거미집 원고 합치기: 10턴씩 받은 조각을 한 파일로 만든다.
   node tools/web-merge.mjs <손가락> <disciple|master> <출력.json> <조각1> <조각2> ...
   조각은 JSON 배열이거나 {"turns":[...]} 이고, ```json 코드 블록이 붙어 있어도 읽는다. n 순서로 정렬해 중복이 있으면 알려 준다. */
import {readFileSync,writeFileSync} from 'node:fs';
const [finger,route,out,...parts]=process.argv.slice(2);
if(!finger||!route||!out||!parts.length){console.error('사용법: node tools/web-merge.mjs <손가락> <disciple|master> <출력.json> <조각...>');process.exit(2)}
const turns=[],seen=new Map();
for(const p of parts){
  let s=readFileSync(p,'utf8').trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'');
  let j;try{j=JSON.parse(s)}catch(e){console.error(`${p}: JSON 오류 — ${e.message}`);process.exit(1)}
  const a=Array.isArray(j)?j:j.turns;if(!Array.isArray(a)){console.error(`${p}: 배열 또는 {"turns":[...]} 이어야 한다`);process.exit(1)}
  for(const t of a){if(seen.has(t.n))console.warn(`경고: 턴 ${t.n}이 ${seen.get(t.n)}와 ${p}에 중복 — 뒤의 것을 쓴다`);seen.set(t.n,p);const i=turns.findIndex(x=>x.n===t.n);if(i>=0)turns[i]=t;else turns.push(t)}
}
for(const t of turns)for(const c of (t.c||[]))if(c&&c.bond==='null')c.bond=null;
turns.sort((a,b)=>a.n-b.n);
writeFileSync(out,JSON.stringify({finger,route,turns},null,1)+'\n');
const miss=[];for(let n=1;n<=Math.max(20,...seen);n++)if(!seen.has(n))miss.push(n);
console.log(`${out} · ${finger} · ${route} · 턴 ${turns.length}개`+(miss.length?` · 빠진 턴: ${miss.join(', ')}`:''));
