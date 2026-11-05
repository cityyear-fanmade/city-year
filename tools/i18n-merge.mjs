/* 번역 결과를 사전에 합친다: node tools/i18n-merge.mjs ja docs/i18n/ja-output-01.tsv [...]
   검사: 번호가 있는 문장인지, 비었는지, {자리표시}가 원문과 같은지. 이상한 줄은 합치지 않고 docs/i18n/<언어>-rejects.txt 에 모은다 */
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {loadData} from '../src/data-node.js';
const [lang,...files]=process.argv.slice(2);
if(!lang||!files.length){console.error('사용: node tools/i18n-merge.mjs ja <결과.tsv>...');process.exit(1)}
const D=loadData(),all=new Map();
const id=s=>createHash('md5').update(s).digest('hex').slice(0,8);
const walk=x=>{if(typeof x==='string'){if(/[가-힣]/.test(x))all.set(id(x),x)}else if(Array.isArray(x))x.forEach(walk);else if(x&&typeof x==='object')for(const k in x)walk(x[k])};
walk(D);
const dp=new URL(`../data/i18n/${lang}.json`,import.meta.url);
const dict=existsSync(dp)?JSON.parse(readFileSync(dp,'utf8')):{};
const ph=s=>(s.match(/\{[^}]+\}/g)||[]).sort().join('|');
let ok=0;const bad=[];
for(const f of files)for(const line of readFileSync(f,'utf8').split('\n')){
  if(!line.trim())continue;const t=line.indexOf('\t');if(t<0){bad.push(['형식',line]);continue}
  const k=line.slice(0,t).trim(),v=line.slice(t+1).trim(),src=all.get(k);
  if(!src){bad.push(['모르는 번호',line]);continue}
  if(!v){bad.push(['빈 번역',k+'\t'+src]);continue}
  if(ph(src)!==ph(v)){bad.push(['자리표시 불일치',k+'\t'+src+'\t→\t'+v]);continue}
  if(/[가-힣]/.test(v)&&!/[가-힣]/.test(src.replace(/[가-힣]/g,''))){}
  dict[src]=v;ok++}
writeFileSync(dp,JSON.stringify(dict,null,0));
writeFileSync(new URL(`../docs/i18n/${lang}-rejects.txt`,import.meta.url),bad.map(b=>b.join('\t')).join('\n'));
console.log(`합침 ${ok}개 · 제외 ${bad.length}개 (docs/i18n/${lang}-rejects.txt) · 사전 총 ${Object.keys(dict).length}개`);
