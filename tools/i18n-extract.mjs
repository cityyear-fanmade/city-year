/* 번역할 문장 뽑기: node tools/i18n-extract.mjs ja
   data/*.json의 한글 문자열 중 아직 data/i18n/<언어>.json에 없는 것만 모아 data/i18n/todo-<언어>.json 로 쓴다(배치 나누기용 통계 포함) */
import {readFileSync,writeFileSync} from 'node:fs';
import {loadData} from '../src/data-node.js';
const lang=process.argv[2]||'ja';
const D=loadData(),seen=new Map();
let have={};try{have=JSON.parse(readFileSync(new URL(`../data/i18n/${lang}.json`,import.meta.url),'utf8'))}catch(e){}
const walk=(x,path)=>{if(typeof x==='string'){if(/[가-힣]/.test(x)&&!have[x]&&!seen.has(x))seen.set(x,path)}else if(Array.isArray(x))x.forEach((v,i)=>walk(v,path))
  else if(x&&typeof x==='object')for(const k in x)walk(x[k],path||k)};
walk(D,'');
const list=[...seen.keys()],chars=list.reduce((a,s)=>a+s.length,0);
writeFileSync(new URL(`../data/i18n/todo-${lang}.json`,import.meta.url),JSON.stringify(list,null,0));
console.log(`번역 대기 ${list.length}문장 · 약 ${chars}자 · data/i18n/todo-${lang}.json`);
