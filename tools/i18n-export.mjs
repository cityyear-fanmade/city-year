/* 번역 대기 문장을 다른 AI·번역 서비스에 넣을 파일로 내보낸다: node tools/i18n-export.mjs ja [묶음크기=2200]
   docs/i18n/<언어>-input-NN.tsv  (한 줄 = 짧은 번호<TAB>한국어 문장). 번역 결과는 같은 번호를 달아 <언어>-output-NN.tsv 로 돌려받는다 */
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {loadData} from '../src/data-node.js';
const lang=process.argv[2]||'ja',size=+(process.argv[3]||2200);
const D=loadData(),seen=new Set();let have={};
try{have=JSON.parse(readFileSync(new URL(`../data/i18n/${lang}.json`,import.meta.url),'utf8'))}catch(e){}
const walk=x=>{if(typeof x==='string'){if(/[가-힣]/.test(x)&&!have[x])seen.add(x)}else if(Array.isArray(x))x.forEach(walk);else if(x&&typeof x==='object')for(const k in x)walk(x[k])};
walk(D);
const id=s=>createHash('md5').update(s).digest('hex').slice(0,8);
const list=[...seen].filter(s=>!/[\t\n]/.test(s)),ids=new Set();
for(const s of list){if(ids.has(id(s)))throw new Error('번호 충돌: '+s);ids.add(id(s))}
mkdirSync(new URL('../docs/i18n/',import.meta.url),{recursive:true});
let n=0;for(let i=0;i<list.length;i+=size){n++;const part=list.slice(i,i+size);
  writeFileSync(new URL(`../docs/i18n/${lang}-input-${String(n).padStart(2,'0')}.tsv`,import.meta.url),part.map(s=>id(s)+'\t'+s).join('\n')+'\n')}
console.log(`${list.length}문장 → ${n}개 파일`);
