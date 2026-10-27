#!/usr/bin/env node
/* 거미집 원고를 게임 데이터(data/web.json)에 넣는다.
   data/web/<손가락>-<disciple|master>.json (web-merge로 합친 파일) → data/web.json의 parts
   node tools/web-build.mjs            검수(web-validate)를 통과한 파일만 넣는다
   node tools/web-build.mjs --partial  40턴 미만(작업 중인 원고)도 넣는다 */
import {readdirSync,readFileSync,writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
const partial=process.argv.includes('--partial');
const dir=new URL('../data/web/',import.meta.url),out=new URL('../data/web.json',import.meta.url);
const W=JSON.parse(readFileSync(out,'utf8'));W.web.parts={};
let n=0;
for(const f of readdirSync(dir).sort()){
  const m=/^(엄지|검지|중지|약지|소지)-(disciple|master)\.json$/.exec(f);if(!m)continue;
  const path=new URL(f,dir).pathname;
  try{execFileSync('node',[new URL('./web-validate.mjs',import.meta.url).pathname,path],{stdio:'pipe'})}
  catch(e){if(!partial){console.error(`✕ ${f}: 검수 실패 — node tools/web-validate.mjs data/web/${f} 로 오류를 확인한다`);continue}}
  const J=JSON.parse(readFileSync(path,'utf8'));
  for(const t of J.turns)for(const c of t.c||[])if(c.bond==='null')c.bond=null;
  W.web.parts[`${m[1]}-${m[2]}`]={turns:J.turns};n++;console.log(`✓ ${f} (${J.turns.length}턴)`);
}
writeFileSync(out,JSON.stringify(W,null,1)+'\n');console.log(`parts ${n}개를 data/web.json에 넣었다`);
