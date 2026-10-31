#!/usr/bin/env node
/* 거미집 원고 검수: node tools/web-validate.mjs data/web/약지-제자.json
   외부 AI가 쓴 40턴 원고가 형식·문체 규칙을 지키는지 검사한다. 오류가 있으면 종료 코드 1. */
import {readFileSync} from 'node:fs';

const FINGERS=['엄지','검지','중지','약지','소지'],ROUTES=['disciple','master'];
const BONDS=['신뢰','의존','존경','집착','공범','연정'],SIZES=['없음','작음','보통','큼'];
const ENDS=['complete','apart','accomplice','left','revolt'];   // 완성된 관계 · 각자의 길 · 서로의 공범 · 남겨진 자리 · 재료의 반란
const BAN=['무흔검','롤랑','앤젤라','파우스트','이스마엘','돈키호테','히스클리프'];   // 쓰면 안 되는 이름
const PRON=/(그녀|그는|그가|그를|그의|그에게|그와\s|걔)/;   // 성별을 가리키는 대명사 후보(경고)
const WEAPON=/(총기|총열|총구|탄환|탄창|사격|방아쇠|권총|소총)/;   // 거미집은 '검'을 벼리는 이야기다: 무기 소재가 총이면 경고
const ODD=/(수입 동작|무기 수입|수입에)/;   // 오용어(손질·정비를 '수입'으로 씀)
const FORMAL=/(습니다|해요|예요|이에요|세요\b)/;   // 존댓말(경고) — 본문은 '~했다.' 체
const TOKENS=['{스승}','{제자}'];
const len=s=>Array.from(String(s||'')).length;
const file=process.argv[2];
if(!file){console.error('사용법: node tools/web-validate.mjs <파일.json>');process.exit(2)}
let J;try{J=JSON.parse(readFileSync(file,'utf8'))}catch(e){console.error('JSON을 읽지 못했다:',e.message);process.exit(2)}
/* 'null' 문자열은 null로 읽는다(외부 AI가 자주 이렇게 쓴다) */
for(const t of (Array.isArray(J.turns)?J.turns:[]))for(const c of (t&&Array.isArray(t.c)?t.c:[]))if(c&&c.bond==='null')c.bond=null;
const err=[],warn=[];
const E=(n,m)=>err.push(`턴 ${n}: ${m}`),W=(n,m)=>warn.push(`턴 ${n}: ${m}`);
if(!FINGERS.includes(J.finger))err.push(`finger는 ${FINGERS.join('/')} 중 하나여야 한다 (지금: ${J.finger})`);
if(!ROUTES.includes(J.route))err.push(`route는 ${ROUTES.join('/')} 중 하나여야 한다 (지금: ${J.route})`);
const T=Array.isArray(J.turns)?J.turns:[];
const LEN=T.length,NAME_FROM=LEN===20?17:31;
if(![20,40].includes(LEN))err.push(`turns는 20개 또는 40개여야 한다 (지금: ${T.length}개)`);
const range=(n,s,v,a,b,req=true)=>{if(v==null||v===''){if(req)E(n,`${s} 없음`);return}const L=len(v);if(L<a||L>b)E(n,`${s} 길이 ${L}자 (허용 ${a}~${b})`)};
const text=(n,s,v)=>{if(typeof v!=='string')return;
  for(const b of BAN)if(v.includes(b))E(n,`${s}에 쓰면 안 되는 말 '${b}'`);
  if(PRON.test(v))W(n,`${s}에 성별 대명사 후보 '${v.match(PRON)[0]}' (성별 중립으로 고칠 것)`);
  if(WEAPON.test(v))W(n,`${s}에 총기 소재 '${v.match(WEAPON)[0]}' (검·칼 중심으로)`);
  if(ODD.test(v))W(n,`${s}에 어색한 말 '${v.match(ODD)[0]}' (손질·정비 등으로)`);
  if(FORMAL.test(v))W(n,`${s}가 존댓말 같다 '${v.match(FORMAL)[0]}' ('~했다.' 체로)`);
  const br=v.match(/\{[^}]*\}/g)||[];for(const x of br)if(!TOKENS.includes(x))E(n,`${s}에 알 수 없는 표식 ${x} (허용: ${TOKENS.join(' ')})`);};
const endsSeen=new Set();
T.forEach((t,i)=>{
  const n=t&&t.n!=null?t.n:i+1;
  if(t.n!==i+1)E(i+1,`n이 ${i+1}이어야 한다 (지금: ${t.n})`);
  range(n,'제목 t',t.t,2,16);range(n,'본문 x',t.x,120,420);text(n,'제목',t.t);text(n,'본문',t.x);
  if(n<NAME_FROM&&/레테/.test(JSON.stringify(t)))E(n,`'레테'는 ${NAME_FROM}턴부터 쓴다 — 그 전에는 '프로젝트의 대상'·'검의 자리(가칭)'로만`);
  const C=Array.isArray(t.c)?t.c:[];
  const maxC=n===LEN?5:3;if(C.length<2||C.length>maxC)E(n,`선택지는 2~${maxC}개여야 한다 (지금: ${C.length}개)`);
  C.forEach((c,k)=>{const q=`선택 ${k+1}`;
    range(n,q+' 라벨 l',c.l,3,28);range(n,q+' 결과 r',c.r,80,320);range(n,q+' 힌트 h',c.h,0,24,false);
    text(n,q+' 라벨',c.l);text(n,q+' 결과',c.r);text(n,q+' 힌트',c.h);
    if(c.bond!=null&&!BONDS.includes(c.bond))E(n,`${q} bond는 ${BONDS.join('/')} 또는 null`);
    if(!SIZES.includes(c.size))E(n,`${q} size는 ${SIZES.join('/')} 중 하나`);
    if(c.risk){range(n,q+' 실패 문구 f',c.f,70,260);text(n,q+' 실패 문구',c.f)}else if(c.f)W(n,`${q}에 f가 있지만 risk가 true가 아니다`);
    if(c.flag!=null&&!/^[a-z][a-z0-9_]{1,23}$/.test(c.flag))E(n,`${q} flag는 영문 소문자·숫자·밑줄 2~24자`);
    if(c.end!=null){if(!ENDS.includes(c.end))E(n,`${q} end는 ${ENDS.join('/')} 중 하나`);else endsSeen.add(c.end);if(n<LEN-2)E(n,`${q} end는 ${LEN-2}~${LEN}턴에서만 쓴다`)}
  });
  if(n===LEN&&C.some(c=>c.end==null))E(n,`${LEN}턴의 모든 선택지에는 end가 있어야 한다`);
  if(J.route==='master'&&n===3){const fl=C.map(c=>c.flag);for(const f of ['adopt','separate','defer'])if(!fl.includes(f))E(n,`스승 루트 3턴 선택지에 flag '${f}'가 하나씩 있어야 한다 (제자로 받아들인다/분리해 보호한다/미룬다)`)}
});
{const all=T.map(t=>[t.x,...(t.c||[]).flatMap(c=>[c.r,c.f])].join(' ')).join(' ');for(const w of ['완벽','묵직','기묘','차가운','철저','무표정']){const k=(all.match(new RegExp(w,'g'))||[]).length;if(k>=4)warn.push(`전체: '${w}'이(가) ${k}번 나온다 (같은 수식어 반복 — 다른 표현으로)`)}}
for(const e of ENDS)if(!endsSeen.has(e))err.push(`${LEN-2}~${LEN}턴 선택지에 결말 end '${e}'가 한 번도 없다`);
console.log(`${file} · ${J.finger||'?'} · ${J.route||'?'} · 턴 ${T.length}개`);
if(warn.length){console.log(`\n경고 ${warn.length}건`);warn.slice(0,60).forEach(x=>console.log('  △ '+x));if(warn.length>60)console.log(`  … ${warn.length-60}건 더`)}
if(err.length){console.log(`\n오류 ${err.length}건`);err.slice(0,80).forEach(x=>console.log('  ✕ '+x));if(err.length>80)console.log(`  … ${err.length-80}건 더`);process.exit(1)}
console.log('\n오류 0건'+(warn.length?' (경고만 있음)':''));
