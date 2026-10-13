/* 설명서 생성: npm run guide → docs/guide.md
   표와 숫자는 전부 data/*.json과 src/config.js에서 뽑는다. 수치를 바꾼 뒤 다시 돌리면 설명서도 맞춰진다.
   승률은 시뮬(시드 고정)을 돌려 넣는다. */
import {writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {loadData} from '../src/data-node.js';
import {createEngine,mulberry32} from '../src/engine.js';
import {CFG} from '../src/config.js';

const D=loadData(),T=D.text,K=D.keywords,N=+(process.argv[2]||3000);
const E=createEngine(D,{rng:mulberry32(1)});
const sg=n=>n>=0?'+'+n:'−'+Math.abs(n);
const pc=x=>(x*100).toFixed(1)+'%';
const one=(tbl,i)=>(i?tbl[i-1].max+1:1)===tbl[i].max;
const range=(tbl,i)=>`${i?tbl[i-1].max+1:1}–${tbl[i].max}`;
const table=(head,rows)=>[`| ${head.join(' | ')} |`,`|${head.map(()=>'---').join('|')}|`,...rows.map(r=>`| ${r.join(' | ')} |`)].join('\n');
const kwText=c=>(c.kw||[]).map(([k,n,to])=>`${K[k].n} +${n}${to==='s'?'(자신)':''}`).join(', ');
const special=c=>[c.adv&&'명중 2회 굴림',c.rr&&'낮은 피해 주사위 재굴림',c.min&&`피해 주사위 최소 ${c.min}`,c.eva&&`회피 +${c.eva}`].filter(Boolean).join(', ');
const cardRow=([id,c])=>[c.n,c.c,{atk:'공격',def:'방어',buff:'버프'}[c.t],c.t==='atk'?`${c.hits>1?c.hits+'타 × ':''}${c.dice}d6${c.b?sg(c.b):''}`:'–',c.t==='atk'?sg(c.hit):'–',kwText(c)||'–',special(c)||(c.t!=='atk'?(c.d||''):'–')];
const fx=x=>x.e||Object.entries(x.fx||{}).map(([k,v])=>`${k} ${sg(v)}`).join(', ');

/* 조건을 사람이 읽는 문장으로 */
const reqText=r=>{
  if(Array.isArray(r))return r.map(reqText).join(' 그리고 ');
  if(r&&r.any)return r.any.map(reqText).join(' 또는 ');
  const m={canfix:'손가락·날개 소속 아님',nofinger:'손가락 소속 아님',licensed:T.licensed,unlicensed:T.licensed+' 아님',aff:'소속 있음',noaff:'소속 없음',pinky:D.pinky.n+' 표식',nopinky:D.pinky.n+' 표식 없음'};
  if(m[r])return m[r];
  if(r.startsWith('flag:')){const [k,n]=r.slice(5).split('>=');const nm={taboo:'금기 위반',libraryInvite:'도서관 초대 수락',libraryGuest:'두 번째 초대 수락',defied:'지령 거역'}[k]||k;return `${nm}${n?' '+n+'회 이상':''}`}
  if(r==='beat:any')return '히든 보스를 하나 이상 이김';
  if(r.startsWith('beat:'))return r.slice(5).split('|').map(id=>D.enemies[id].n).join('·')+' 중 하나를 이김';
  if(r.startsWith('affname:'))return r.slice(8)+' 소속';
  if(r.startsWith('aff:'))return (T.affTypes[r.slice(4)]||r.slice(4))+' 소속';
  if(r.startsWith('rank<='))return `${T.licensed} ${r.slice(6)}${T.rankUnit} 이상`;
  return r;
};
const sim=E.simulate(N);
const check=execFileSync(process.execPath,[new URL('./check.mjs',import.meta.url).pathname,'6000'],{encoding:'utf8'}).trim();
const enemyCards=new Set(Object.values(D.enemies).flatMap(e=>e.deck));
const base=['slash','thrust','smash','guard'];
const out=[];
const h=(t)=>out.push('',t,'');

out.push('# 도시의 한 해 · 규칙과 밸런스 설명서',
'',`> 자동 생성 문서 (\`npm run guide\`). 수치는 \`src/config.js\`와 \`data/*.json\` 기준이고, 승률은 시뮬 ${N}회(시드 1)와 무작위 진행 6,000판 결과다. 모든 수치는 임시값이다.`);

h('## 1. 한 판의 흐름');
out.push(`1. **출생**: 이름을 정하고, 출신·재능·결점·무기·색을 각각 1d100으로 굴린다. 태어날 때마다 새 시드가 뽑힌다.`,
`2. **성장기**: ${D.childhood.stages.map(s=>s.age+'세').join('·')}에 성장기 표를 1d100으로 굴려 능력치가 하나씩 오른다.`,
`3. **${CFG.startAge}~${CFG.startAge+CFG.years-1}세 (${CFG.years}년)**: 해마다 사건 하나. ${Object.keys(D.fixedFights).join('·')}년차는 고정 전투. ${CFG.affiliationYear}년차에는 소속을 정하는 갈림길.`,
`4. 전투에서 이기면 회복·보상 카드·경험치·현상금을 받고, 레벨이 오르면 성장표를 1d100으로 세 번 굴려 하나를 고른다.`,
`5. ${CFG.years}년을 버티면 완주. 전투에서 HP가 0이 되면 끝.`);

h('## 2. 능력치');
out.push(table(['능력치','기본값','쓰이는 곳'],[
 ['HP',CFG.baseHp,'0이 되면 끝. 해마다 +'+CFG.yearHeal+', 전투 승리 후 +'+CFG.winHeal+' 회복'],
 ['공격','0','명중 굴림에 더한다'],
 ['회피','0','상대의 명중 굴림을 막는 굴림에 더한다'],
 ['속도','0','라운드 순서 굴림에 더한다'],
 ['사건 판정','0','모든 사건 판정에 더한다'],
 ['시작 출혈 / 시작 호흡','0','전투 시작 때 자신에게 붙는 스택'],
 ['피해 최소값','1','피해 d6가 이 값보다 작게 나오면 이 값으로 (무기·장비)'],
 ['방어 카드 보너스','0','방어 카드의 회피 보너스에 더한다'],
 ['2회 굴림','0','라운드 첫 공격의 명중을 1d100 두 번 굴려 높은 값'],
 ['적 HP 보정','0','모든 적의 HP에 더한다 (결점 "추적자")']]));

h('## 3. 주사위 규칙');
out.push(table(['판정','식','비고'],[
 ['사건 판정',`1d100 + 능력치 + 사건 판정 보정 (+ 출신 진로 보정) ≥ 난이도`,'능력치가 없는 "운 판정"은 보정만 더한다'],
 ['라운드 순서',`1d100 + 속도 (+${CFG.catchupBonus} 추격 보정)`,`높은 쪽이 선공·빛 +${CFG.orderBonusLight}. ${CFG.gapFirst} 이상 앞서면 선제: 첫 공격 명중 +${CFG.firstHit}. 진 쪽은 다음 라운드 추격 +${CFG.catchupBonus}. 동점이면 둘 다 보너스 없음`],
 ['명중',`1d100 + 공격 + 카드 명중 보정 > 상대 1d100 + 회피 (+ 방어 카드)`,'동점은 방어 쪽 승리'],
 ['피해',`카드의 d6 개수만큼 굴려 합 + 카드 고정값`,'코스트가 높을수록 주사위가 많다'],
 ['치명',`호흡 스택 × ${CFG.breathCritPer}% 확률로 피해 ×${CFG.critMult} (소수점 버림)`,'명중할 때마다 호흡 1 소모'],
 ['방어 자세',`카드를 하나도 내지 않은 라운드: 회피 대신 방어로 같은 굴림`,`${CFG.guard.bleedCut?`출혈 스택 ×${CFG.guard.bleedCut}(내림, 플레이어만). `:''}막으면 피해 ${CFG.guard.guardHit}, 못 막으면 피해 ×${CFG.guard.guardFailMul}(소수점 버림). 다음 라운드 명중 +${CFG.guard.nextHit}${CFG.guard.lightUp?`, 그 전투 동안 빛 +${CFG.guard.lightUp}(최대 +${CFG.guard.lightUpMax})`:''}${CFG.guard.lightNext?`, 다음 라운드 빛 +${CFG.guard.lightNext}`:''}`]]));
out.push('',`**빛(코스트)**: 라운드마다 ${CFG.light}, 선공이면 +${CFG.orderBonusLight}, 최대 ${CFG.lightMax}. 남은 빛은 사라진다. 손패는 덱에서 ${CFG.hand}장. 고른 순서대로 발동한다.`,
'',`**발동 순서**: 방어 카드가 먼저(순서대로) 적용되고, 그다음 공격·버프 카드를 선공부터 한 장씩 번갈아 낸다. 적은 라운드 시작 때 낼 카드를 정하고 화면에 공개한다.`,
'',`**예시**: 공격 +2인 내가 찌르기(명중 +10)로 회피 +3인 적을 친다. 내 1d100이 40이면 40+2+10=52, 적 1d100이 45면 45+3=48. 52 > 48이라 명중, 1d6이 4면 피해 4. 적에게 파열 2가 있으면 피해 +2로 6, 파열은 1로 줄어든다.`);

h('## 4. 키워드');
out.push(table(['키워드','효과','최대 스택','주는 카드'],Object.entries(K).map(([k,v])=>[v.n,
 {bleed:'공격할 때마다(빗나가도) 스택만큼 피해, 그 뒤 스택 1 감소. 플레이어가 방어 자세를 취하면 스택 절반(내림)',rupture:'맞을 때마다 스택만큼 추가 피해, 그 뒤 스택 1 감소',burn:'레바테인 전용. 스택이 있으면 받는 피해 ×1.5(소수점 버림), 5스택 이상이면 푸른 화염 ×2. 라운드 끝에 1 감소',breath:`스택당 치명 ${CFG.breathCritPer}%(피해 ×${CFG.critMult}), 명중할 때마다 1 소모`}[k]||'',
 CFG.stackCap,Object.entries(D.cards).filter(([id,c])=>(c.kw||[]).some(x=>x[0]===k)&&!id.startsWith('x_')).map(([,c])=>c.n).join(', ')])));

h('## 5. 카드');
out.push('### 기본 덱 (모두 시작)','',table(['카드','코스트','종류','피해','명중','키워드','특수'],base.map(id=>cardRow([id,D.cards[id]]))));
out.push('','### 출신·보상·장비로 얻는 카드','',table(['카드','코스트','종류','피해','명중','키워드','특수'],
 Object.entries(D.cards).filter(([id])=>!base.includes(id)&&!id.startsWith('x_')&&(D.rewards.includes(id)||D.origins.some(o=>o.card===id)||Object.values(D.items).some(i=>i.card===id))).map(cardRow)));
out.push('','### 적 전용 카드','',table(['카드','코스트','종류','피해','명중','키워드','특수'],
 Object.entries(D.cards).filter(([id])=>enemyCards.has(id)&&!D.rewards.includes(id)&&!base.includes(id)).map(cardRow)));

h('## 6. 출생표 (각 1d100)');
out.push('### 출신','',table(['1d100','출신','효과','진로 보정','시작 자산'],D.origins.map((o,i)=>one(D.origins,i)?[range(D.origins,i),'???','???','???','???']:[range(D.origins,i),o.n,o.e.replace(/ · [^·]*진로 \+\d+/g,''),Object.entries(o.paths||{}).map(([k,v])=>`${T.paths[k]} +${v}`).join(', ')||'–',(D.money.start[o.n]||0)+D.money.unit])));
out.push('','진로 보정은 그 진로로 들어가는 판정에 더해지고, 그 진로의 권유 사건이 (보정 × '+CFG.pathEventMul+')% 확률로 먼저 나온다.');
for(const [title,tbl] of [['재능',D.talents],['결점',D.flaws],['무기 (무기 칸의 첫 장비)',D.weapons],['성장기 (단계마다)',D.childhood.table],['레벨 업 성장표 (세 번 굴려 하나 고름)',D.growth]])
  out.push('',`### ${title}`,'',table(['1d100','이름','효과'],tbl.map((x,i)=>one(tbl,i)?[range(tbl,i),'???','???']:[range(tbl,i),x.n,fx(x)])));
out.push('','### 색','',`1d100을 10씩 나눠 ${D.colors.map(c=>c.adj).join(' · ')} 중 하나. 직접 바꿀 수 있다. 특색 칭호는 색 + 가장 높은 능력치의 단어(공격 ${D.titleWords.atk.join('/')}, 회피 ${D.titleWords.eva.join('/')}, 속도 ${D.titleWords.spd.join('/')}, 체력 ${D.titleWords.hp.join('/')}).`);

h('## 7. 성장');
out.push(`경험치: 판정 성공 ${CFG.xp.ok}, 실패 ${CFG.xp.fail}, 판정 없는 선택 ${CFG.xp.plain}, 전투 승리 ${CFG.xp.win}. 레벨별 누적 경험치 ${CFG.levels.slice(1).map((v,i)=>`Lv${i+2} ${v}`).join(' · ')}.`);

h('## 8. 신분·소속별 보정');
out.push(table(['소속','들어가는 길','봉급(해마다)','공방 등급','승진'],[
 ['무소속','–',D.money.salary.none,D.access.base,'–'],
 [`${T.affTypes.office} (골목·철문·등불)`,`${T.licensed}면 갈림길에서 확정, 아니면 견습(속도 45)`,D.money.salary.office,D.access.aff.office,`${T.licensed} 급수`],
 [`${T.affTypes.assoc} (${D.orgs.assoc.join('·')})`,`${T.licensed}만. 입회 심사(운 55, 협회 진로 보정)`,D.money.salary.assoc,D.access.aff.assoc,`${T.licensed} 급수`],
 [`${T.affTypes.wing} (${D.orgs.wing.join('·')})`,`입사 시험(운 60, 날개 진로 보정) 또는 채용 공고`,D.money.salary.wing,D.access.aff.wing,'아직 없음'],
 [`${T.affTypes.finger} (${D.orgs.finger.join('·')})`,`손가락의 문(공격 60, 손가락 진로 보정) 또는 조직의 손짓`,D.money.salary.finger,D.access.aff.finger,'손가락 서열']]));
out.push('',`- **${T.licensed}**: 자격 시험·계약·견습으로 ${T.rankStart}${T.rankUnit} 등록. 무소속이나 ${T.affTypes.office} 소속이면 전투 승리 뒤 소문 판정(1d100 + 해결사 진로 보정 ≥ ${CFG.winLicenseDc})으로도 등록. 고정 전투 승리·급수 심사 사건마다 2급씩 올라 최대 ${T.rankTop}${T.rankUnit}. 급수 수당: 오른 급수당 ${D.money.rankSalary}${D.money.unit}. ${D.access.rankBonus.rank}${T.rankUnit} 이상이면 공방 +${D.access.rankBonus.plus}등급. 승급할 때마다 가장 높은 능력치 +1(체력이면 최대 HP +4).`,
`- **진로 포인트**: 해결사 ${T.promoPoints} · 협회 ${D.careers.assoc.pts} · 날개 ${D.careers.wing.pts} · 손가락 ${D.careers.finger.pts}. 맨 위 단계에서 특수 심사 한 번(해결사는 특색, 1d100 + 판정 보정 ≥ ${CFG.colorDc}).`,
`- **${D.pinky.n}**: 어느 소속에도 겹쳐 붙는 표식. ${D.pinky.e}.`);
out.push('','### 손가락 서열 (오를 때마다 보정을 더함)','',table(['손가락','성격','서열과 보정'],Object.entries(D.fingers).map(([n,F])=>[n,F.trait,
 F.ranks.map(r=>r.branch?`(${r.branch.map(b=>`${b.n}: ${b.e}`).join(' / ')}, 1d100 갈래)`:`${r.n}: ${r.e}`).join(' → ')])));
out.push('',`서열 ${D.fingerRules.shopTier}단계 이상이면 공방 +1등급, 서열 단계마다 봉급 +${D.fingerRules.salaryPerTier}${D.money.unit}.`);

h('## 9. 돈과 공방');
out.push(`수입: 출신별 시작 자산, 해마다 봉급, 전투 현상금(${Object.entries(D.money.bounty).map(([k,v])=>`${{early:'초반',mid:'중반',boss:'보스',hidden:'히든'}[k]} ${v}`).join(' · ')}), 일부 사건.`,'',
 table(['등급','공방','물건','칸','가격','효과'],Object.entries(D.items).map(([id,it])=>[it.grade,D.workshops[it.grade-1].n,it.n,D.slots[it.slot],it.price+D.money.unit,it.e])));

h('## 10. 적과 조우');
out.push(table(['적','단계','HP','공격','회피','속도','덱','현상금','승률*'],sim.rows.filter(r=>!r.hidden).map(r=>{const e=D.enemies[r.id];
 return [e.n,{early:'초반',mid:'중반',boss:'보스'}[e.tier],e.hp,e.atk,e.eva,e.spd,e.deck.map(c=>D.cards[c].n).join(', '),D.money.bounty[e.tier],pc(r.win)]})));
out.push('',`\\* 성장 없는 무작위 캐릭터가 카드를 무작위로 낼 때의 승률(보수적인 값).`,'','### 조우 표 (1d100)','');
for(const [k,t] of Object.entries(D.encounters.tables))out.push(`- **${k}**: ${t.map((x,i)=>`${range(t,i)} ${D.enemies[x.enemy].n}`).join(' · ')}`);
out.push('',`\`<표>@<소속>\` 표는 그 소속일 때 대신 쓴다. 고정 전투: ${Object.entries(D.fixedFights).map(([y,s])=>`${y}년차 ${s.startsWith('table:')?s.slice(6)+' 표':D.enemies[s].n}`).join(' · ')}.`);
out.push('','### 히든 보스','',table(['보스','HP','공격','회피','속도','조건','시점','피할 수 있나','승률*'],D.hiddenBosses.map(hb=>{const e=D.enemies[hb.id],r=sim.rows.find(x=>x.id===hb.id);
 return [e.n,e.hp,e.atk,e.eva,e.spd,reqText(hb.req)+(hb.chance?`, 1d100 ≤ ${hb.chance}`:'')+(hb.penalty?`, ${hb.penalty.fullRank}${T.rankUnit} 미만이면 명중·회피 ${hb.penalty.atk}`:''),(hb.from||1)+'년차부터',hb.noEscape?'아니오':'예 (불길한 예감)',pc(r.win)]})));
out.push('',`히든 보스를 이기면 발톱 → ${T.jobs.claw}, 조율자 → ${T.jobs.arbiter} 해금(그 브라우저에 기록).`);

h('## 11. 밸런스 현황');
out.push(`연속 3전(초반 표 → 중반 표 → 보스): ${pc(sim.chain)} · 레벨 업과 보상 카드 반영 시 ${pc(sim.grown)}.`,'','무작위 진행 6,000판 (`npm run check`):','','```',check,'```');
out.push('','**알려진 점**',
 `- 방어 자세: 지금 설정(전투 동안 빛 +${CFG.guard.lightUp})이면 첫 라운드에 방어 자세를 하는 운영이 보스 승률을 약 12%p 올린다. 상황 선택지로 만들려면 \`CFG.guard\`를 \`lightUp: 0, lightNext: 2\`(다음 라운드만 빛 +2)로 바꾸면 안 넘길 때와 비슷해진다.`,
 `- 특색 보스는 7년차를 3급 이상으로 맞아야 나와서 매우 드물다.`,
 `- 히든 보스 단독 승률은 조율자가 발톱보다 높다(조율자는 보통 발톱과 싸운 다음 해에 나와서 낮췄다). 고증상 조율자가 더 강해야 하면 data/enemies.json에서 조율자 수치를 올린다.`,
 `- 날개 소속은 아직 승진이 없다.`);

h('## 12. 바꾸는 곳');
out.push(table(['바꾸고 싶은 것','파일'],[['전투·성장·진행 수치','src/config.js (CFG)'],['카드','data/cards.json'],['적, 고정 전투, 히든 보스','data/enemies.json'],['조우 표','data/encounters.json'],['사건, 갈림길, 소속 이름','data/events.json'],['출생표, 성장표','data/birth.json'],['돈, 공방, 장비','data/workshops.json'],['손가락 서열, 소지','data/fingers.json'],['화면 용어(해결사, 급 등)','data/text.json']]));
out.push('','바꾼 뒤: `npm run check` (데이터 검사 + 무작위 진행) → `npm run sim -- --n 2000` → `npm run guide` (이 문서 갱신).','');

writeFileSync(new URL('../docs/guide.md',import.meta.url),out.join('\n'));
console.log('docs/guide.md · '+out.length+'줄');
