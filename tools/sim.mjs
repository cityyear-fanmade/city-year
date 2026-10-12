#!/usr/bin/env node
/* 밸런스 측정 CLI
   npm run sim -- --n 2000            적별 승률·평균 라운드·연속 전투 클리어율
   npm run sim -- --n 2000 --seed 7   같은 시드면 같은 결과
   npm run sim -- --json              결과를 JSON으로 출력 */
import {parseArgs} from 'node:util';
import {loadData} from '../src/data-node.js';
import {createEngine,validateData,mulberry32} from '../src/engine.js';
import {CFG} from '../src/config.js';

const {values:a}=parseArgs({options:{n:{type:'string',default:'1000'},seed:{type:'string'},json:{type:'boolean',default:false}}});
const n=Math.max(1,parseInt(a.n,10)||1000);
const D=loadData();
const err=validateData(D);
if(err.length){console.error('데이터 오류:\n  '+err.join('\n  '));process.exit(1)}
const rng=a.seed!=null?mulberry32(parseInt(a.seed,10)||0):Math.random;
const t0=Date.now();
const r=createEngine(D,{rng}).simulate(n);
if(a.json){console.log(JSON.stringify(r,null,1));process.exit(0)}

const pc=x=>(x*100).toFixed(1)+'%';
const w=s=>[...s].reduce((a,c)=>a+(c.charCodeAt(0)>0x2e80?2:1),0);
const pad=(s,k,right)=>{s=String(s);const sp=' '.repeat(Math.max(0,k-w(s)));return right?sp+s:s+sp};
console.log(`도시의 한 해 · 밸런스 측정 · 전투당 ${n}회${a.seed!=null?' · 시드 '+a.seed:''}`);
console.log('카드는 손패에서 무작위로 낸다(보수적인 값). 무작위 캐릭터, 성장기 포함.\n');
console.log(pad('적',20)+pad('승률',9,1)+pad('평균 라운드',13,1)+pad('승리 시 남은 HP',17,1));
const row=x=>console.log(pad(`${x.n} (${x.id})`,20)+pad(pc(x.win),9,1)+pad(x.rounds.toFixed(2),13,1)+pad(x.left.toFixed(1),17,1));
r.rows.filter(x=>!x.hidden).forEach(row);
if(r.rows.some(x=>x.hidden)){console.log('\n히든 보스 (성장 없는 무작위 캐릭터 기준, 실제로는 성장한 뒤 만난다)');r.rows.filter(x=>x.hidden).forEach(row)}
console.log('');
const nm=x=>x.startsWith('table:')?(D.encounters.labels[x.slice(6)]||x)+' 표':D.enemies[x].n;
console.log(pad(`연속 ${r.chainIds.length}전 (${r.chainIds.map(nm).join(' → ')})`,40)+pad(pc(r.chain),9,1));
console.log(pad(`연속 ${r.chainIds.length}전 · 성장 반영 (레벨 업 ${CFG.simGrowth.join('/')}회 + 보상 카드)`,40)+pad(pc(r.grown),9,1));
console.log(`\n전투 사이 회복 HP ${CFG.chainHeal} · ${((Date.now()-t0)/1000).toFixed(1)}초`);
