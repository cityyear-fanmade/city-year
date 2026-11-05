/* 제미나이(무료 한도 안)로 번역 대기 문장을 번역해 사전에 합친다: node tools/i18n-gemini.mjs ja [--limit 줄수] [--dry]
   - 키는 환경이 주소 헤더로 자동 주입한다(주소에 ?key= 를 붙이지 않는다). 결제·유료 호출 없음
   - 모델 gemini-3.5-flash-lite (분당 15회 · 하루 500회). 한 번에 100줄, 호출 사이 5초 대기. 실패하면 자동 재시도 없이 멈춘다
   - 결과는 tools/i18n-merge.mjs 와 같은 검사를 거쳐 data/i18n/<언어>.json 에 들어가고, 통과 못 한 줄은 다음 실행 때 다시 대상이 된다 */
import {readFileSync,writeFileSync,existsSync,mkdirSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {loadData} from '../src/data-node.js';
const lang=process.argv[2]||'ja',dry=process.argv.includes('--dry'),li=process.argv.indexOf('--limit'),limit=li>0?+process.argv[li+1]:Infinity;
const BATCH=100,MODEL='gemini-3.5-flash-lite',TMP=new URL('../docs/i18n/.tmp/',import.meta.url);
mkdirSync(TMP,{recursive:true});
const id=s=>createHash('md5').update(s).digest('hex').slice(0,8);
const dp=new URL(`../data/i18n/${lang}.json`,import.meta.url),dict=existsSync(dp)?JSON.parse(readFileSync(dp,'utf8')):{};
const seen=new Map(),walk=x=>{if(typeof x==='string'){if(/[가-힣]/.test(x)&&!dict[x]&&!/[\t\n]/.test(x))seen.set(id(x),x)}else if(Array.isArray(x))x.forEach(walk);else if(x&&typeof x==='object')for(const k in x)walk(x[k])};
walk(loadData());
const todo=[...seen].slice(0,Number.isFinite(limit)?limit:undefined);
const GLOSS='화상=火傷 · 출혈=出血 · 진동=振動 · 파열=破裂 · 침잠=沈潜 · 호흡=呼吸 · 충전=充電 · 해결사=フィクサー · 사무소=事務所';
const PROMPT=`당신은 한국어 텍스트 RPG(프로젝트 문 세계관 팬메이드)를 일본어로 번역하는 전문 번역가입니다. 아래 줄들을 번역하세요.
규칙:
1. 입력은 \`번호<TAB>한국어 문장\`입니다. 출력은 \`번호<TAB>일본어 번역\` 줄만, 입력과 같은 번호·순서·줄 수로 내십시오. 설명·머리말·코드블록은 쓰지 마십시오.
2. 한 줄은 한 줄로 번역합니다. 합치거나 나누거나 빼먹지 마십시오.
3. 문장 전체를 자연스러운 일본어 어순과 어미로 새로 쓰십시오. 고유명사(사람·장소·장비·적 이름)를 제외하고 출력에 한글이 남으면 안 됩니다.
4. \`{n}\` 같은 중괄호 자리표시는 글자 하나도 바꾸지 말고 앞뒤에 공백을 넣지 마십시오. 중괄호 뒤의 한국어 조사는 일본어 조사로 바꿉니다.
5. 문체는 담담하고 건조한 서술체(だ・である調), 쓸쓸하고 차분한 분위기를 유지합니다.
6. 용어: ${GLOSS}. 이 외의 고유명사는 번역하지 말고 한국어 그대로 두십시오.
예시:
0001\t세 번 긁어 출혈 +2씩
0001\t3回引っかいて出血 +2ずつ`;
console.log(`번역 대기 ${seen.size}문장 · 이번 ${todo.length}문장 · 호출 ${Math.ceil(todo.length/BATCH)}회`);
if(dry||!todo.length)process.exit(0);
const ph=s=>(s.match(/\{[^}]+\}/g)||[]).sort().join('|');
let ok=0,bad=0;
for(let i=0;i<todo.length;i+=BATCH){
  const part=todo.slice(i,i+BATCH),body={contents:[{parts:[{text:PROMPT+'\n\n[번역할 줄]\n'+part.map(([k,s])=>k+'\t'+s).join('\n')}]}],generationConfig:{temperature:0.3}};
  writeFileSync(new URL('req.json',TMP),JSON.stringify(body));
  let out;try{out=execFileSync('curl',['-sS','-m','120','-X','POST',`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,'-H','Content-Type: application/json','-d','@'+new URL('req.json',TMP).pathname],{encoding:'utf8',maxBuffer:50e6})}catch(e){console.error('호출 실패 — 멈춤(자동 재시도 안 함):',e.message.slice(0,200));break}
  let r;try{r=JSON.parse(out)}catch(e){console.error('응답 해석 실패 — 멈춤:',out.slice(0,200));break}
  if(!r.candidates){console.error('오류 응답 — 멈춤:',JSON.stringify(r).slice(0,300));break}
  const text=r.candidates[0].content.parts[0].text;
  const map=new Map(part);
  for(const line of text.split('\n')){const t=line.indexOf('\t');if(t<0)continue;const k=line.slice(0,t).trim(),v=line.slice(t+1).trim(),src=map.get(k);if(!src||!v){bad++;continue}
    const vv=v.replace(/\{[^}]+\}/g,''),han=(vv.match(/[가-힣]/g)||[]).length,jp=/[぀-ヿ一-鿿]/.test(v);
    if(ph(src)!==ph(v)||(src.length>8&&(v===src||han/Math.max(1,vv.length)>0.3||!jp))){bad++;continue}
    dict[src]=v.replace(/\s*(\{[^}]+\})\s*/g,'$1');ok++}
  writeFileSync(dp,JSON.stringify(dict));
  console.log(`${Math.min(i+BATCH,todo.length)}/${todo.length} · 통과 ${ok} · 제외 ${bad}`);
  if(i+BATCH<todo.length)execFileSync('sleep',['5']);
}
console.log(`끝: 사전 ${Object.keys(dict).length}개 · 통과 ${ok} · 제외 ${bad} (제외한 줄은 다음 실행 때 다시 대상)`);
