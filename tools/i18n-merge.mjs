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
  /* 번역이 안 된 줄 거르기: 원문과 같거나(짧은 이름은 예외), 한글이 30% 넘게 남았거나, 일본어 글자가 하나도 없으면 제외 */
  const han=(v.match(/[가-힣]/g)||[]).length,jp=/[぀-ヿ一-鿿]/.test(v);
  if(src.length>8&&(v===src||han/v.length>0.3||!jp)){bad.push(['번역 안 됨',k+'\t'+src]);continue}
  dict[src]=v;ok++}
writeFileSync(dp,JSON.stringify(dict,null,0));
writeFileSync(new URL(`../docs/i18n/${lang}-rejects.txt`,import.meta.url),bad.map(b=>b.join('\t')).join('\n'));
/* 다시 번역할 줄(번호<탭>한국어)만 따로 모은다: 이 파일을 다시 번역 서비스에 넣으면 된다 */
writeFileSync(new URL(`../docs/i18n/${lang}-retry.tsv`,import.meta.url),bad.filter(b=>b[0]==='번역 안 됨'||b[0]==='빈 번역'||b[0]==='자리표시 불일치').map(b=>b[1].split('\t').slice(0,2).join('\t')).join('\n')+'\n');
console.log(`합침 ${ok}개 · 제외 ${bad.length}개 (docs/i18n/${lang}-rejects.txt) · 사전 총 ${Object.keys(dict).length}개`);
