/* 엔진: 규칙·판정·전투·진행. DOM을 쓰지 않는다 (브라우저·Node 시뮬 공용).
   데이터(D)는 data/*.json을 합친 객체로 주입받는다. 세계관 고유명사는 데이터 문자열에만 있다. */
import {CFG} from './config.js';

export const clamp = (v,a,b) => Math.max(a,Math.min(b,v));
export const sg = n => n>=0 ? '+'+n : '−'+Math.abs(n);
export const STAT = {atk:'공격',eva:'회피',spd:'속도'};

/* 시드 고정 난수 (시뮬 재현용) */
export function mulberry32(a){
  return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296};
}

/* 데이터 검사: 없는 카드·적·키워드를 가리키는 곳을 찾는다. 새 데이터를 넣은 뒤 `npm run check` */
export function validateData(D){
  const err=[],card=(id,at)=>{if(!D.cards[id])err.push(`${at}: 없는 카드 "${id}"`)};
  for(const [id,c] of Object.entries(D.cards)){
    if(!['atk','def','buff'].includes(c.t))err.push(`카드 ${id}: t는 atk/def/buff 중 하나`);
    if(typeof c.c!=='number')err.push(`카드 ${id}: 코스트 c 없음`);
    if(c.t==='atk'&&!(c.hits>=1&&c.dice>=1))err.push(`카드 ${id}: 공격 카드는 hits, dice 필요`);
    for(const k of c.kw||[])if(!D.keywords[k[0]])err.push(`카드 ${id}: 없는 키워드 "${k[0]}"`);
  }
  for(const id of D.rewards)card(id,'보상 목록');
  for(const [id,e] of Object.entries(D.enemies))e.deck.forEach(c=>card(c,`적 ${id} 덱`));
  /* 전투 지정: 적 id 또는 "table:<조우 표>" */
  const spec=(s,at)=>{
    if(s.startsWith('table:')){if(!D.encounters.tables[s.slice(6)])err.push(`${at}: 없는 조우 표 "${s.slice(6)}"`)}
    else if(!D.enemies[s])err.push(`${at}: 없는 적 "${s}"`);
  };
  for(const [y,s] of Object.entries(D.fixedFights))spec(s,`고정 전투 ${y}년차`);
  for(const h of D.hiddenBosses||[])if(!D.enemies[h.id])err.push(`히든 보스: 없는 적 "${h.id}"`);
  for(const [k,t] of Object.entries(D.encounters.tables)){
    if(t.at(-1).max!==100)err.push(`조우 표 ${k}: 마지막 max가 100이 아님`);
    t.forEach(x=>{if(!D.enemies[x.enemy])err.push(`조우 표 ${k}: 없는 적 "${x.enemy}"`)});
  }
  for(const tbl of ['origins','talents','flaws','weapons','growth'])
    if(D[tbl].at(-1).max!==100)err.push(`${tbl}: 마지막 max가 100이 아님`);
  if(D.childhood.table.at(-1).max!==100)err.push('childhood.table: 마지막 max가 100이 아님');
  for(const [id,it] of Object.entries(D.items)){
    if(!it.perm&&!it.tool&&!D.slots[it.slot])err.push(`공방 물건 ${id}: 없는 칸 "${it.slot}"`);
    if(!D.workshops.some(w=>w.grade===it.grade))err.push(`공방 물건 ${id}: 없는 공방 등급 ${it.grade}`);
    if(it.card)card(it.card,`공방 물건 ${id}`);
  }
  for(const n of D.orgs.finger){
    const F=D.fingers[n];if(!F){err.push(`손가락 "${n}": fingers.json에 서열표 없음`);continue}
    for(const r of F.ranks)for(const x of r.branch||[r])if(x.card)card(x.card,`손가락 ${n} ${x.n}`);
  }
  for(const [k,C_] of Object.entries(D.careers||{}))for(const [n,rows] of Object.entries(C_.cards||{})){
    if(!(D.orgs[k]||[]).includes(n.split('/')[0]))err.push(`진로 ${k}: 전용 카드 소속 "${n}"이 orgs에 없음`);
    if(rows.length!==C_.ranks.length+1)err.push(`진로 ${k} ${n}: 전용 카드 줄 수가 직급 수 + 본부(${C_.ranks.length+1})와 다름`);
    for(const ids of rows)for(const id of ids)card(id,`진로 ${k} ${n}`);
  }
  for(const o of D.origins)if(D.money.start[o.n]==null)err.push(`출신 ${o.n}: 시작 자산(money.start) 없음`);
  for(const [id,e] of Object.entries(D.enemies))if(!e.tier||D.money.bounty[e.tier]==null)err.push(`적 ${id}: tier 없음 또는 현상금 없음`);
  D.origins.forEach(o=>{card(o.card,`출신 ${o.n}`);for(const k in o.paths||{})if(!D.text.paths[k])err.push(`출신 ${o.n}: 없는 진로 "${k}"`)});
  for(const ev of D.events)if(ev.tag&&!D.text.paths[ev.tag])err.push(`사건 "${ev.t}": 없는 진로 태그 "${ev.tag}"`);
  const evs=[...D.events,D.affiliation,D.promotionExam,D.colorExam,D.redBook,...Object.values(D.corp||{})].filter(Boolean);
  for(const ev of evs)for(const c of ev.c)for(const r of [c.ok,c.fail].filter(Boolean)){
    if(!r.fx)continue;
    if(r.fx.card)card(r.fx.card,`사건 "${ev.t}"`);
    if(r.fx.combat)spec(r.fx.combat,`사건 "${ev.t}"`);
    if(r.fx.join&&r.fx.join.from&&!(D.orgs[r.fx.join.from]||[]).length)err.push(`사건 "${ev.t}": 소속 목록 orgs.${r.fx.join.from} 없음`);
    if(r.fx.join&&!r.fx.join.from&&!r.fx.join.name)err.push(`사건 "${ev.t}": join에 name 또는 from 필요`);
    if(c.check&&c.check.path&&!D.text.paths[c.check.path])err.push(`사건 "${ev.t}": 없는 진로 "${c.check.path}"`);
    if(c.check&&!c.fail)err.push(`사건 "${ev.t}" / "${c.l}": 판정이 있으면 fail 필요`);
  }
  return err;
}

export function createEngine(D,{rng:rng0=Math.random}={}){
  /* 난수: 기본은 주입된 것. reseed(시드)로 한 판 전체를 그 시드로 굴린다(같은 시드 + 같은 선택 = 같은 결과) */
  let rng=rng0;
  const reseed=seed=>{rng=mulberry32(seed>>>0)};
  const d=n=>1+Math.floor(rng()*n);
  const T=D.text;
  /* 6시즌: 세계관 사무소. 급수 범위(hi~lo급)에 맞는 곳만 문이 열린다. 갈림길과 '사무소 문을 두드린다'가 같은 목록을 쓴다 */
  const officeChoice=o=>({l:o.n,h:o.h,lock:`해결사 ${o.hi}~${(D.orgs.office||[]).includes(o.n)?9:o.lo}급만 들어갈 수 있다`,lockReq:['licensed','canfix'],req:['licensed','canfix',`rankin:${o.hi}-${(D.orgs.office||[]).includes(o.n)?9:o.lo}`],ok:{t:o.t,fx:Object.assign({},o.fx,{join:{type:'office',name:o.n}})}});
  if(D.offices&&!D.officesBuilt){D.officesBuilt=true;
    if(D.officeKnock)D.officeKnock.c=[...D.offices.map(officeChoice),{l:'혼자 일한다',ok:{t:'아직은 혼자가 편하다.',fx:{}}}];
    if(D.affiliation)D.affiliation.c=[...D.offices.map(officeChoice),...D.affiliation.c]}
  function sample(arr,k){const a=arr.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a.slice(0,k)}
  const pick=(tbl,r)=>tbl.find(x=>r<=x.max);
  const one=arr=>arr[Math.floor(rng()*arr.length)];
  /* 덱보다 손패가 많으면 남는 칸은 덱에서 다시 뽑는다 */
  function drawHand(deck,k){const h=sample(deck,k);while(h.length<k)h.push(one(deck));return h}

  /* ===== 캐릭터 ===== */
  function addStats(s,fx){for(const k in fx){if(k==='dmin')s.dmin=Math.max(s.dmin,fx[k]);else if(k in s)s[k]+=fx[k]}}
  /* 성장기: 단계마다 1d100으로 표를 굴려 능력치 하나가 오른다 */
  /* tbl: 숨은 출생이 자기 성장기 표(kidTable)를 가지면 그 표에서 고른다. 단, 특별한 굴림(CFG.kidKeep: 목소리가 들림 · 무너진 유적 탐험 · 장비의 형상이 보임)은 어느 출생이든 그대로
     출생이 kidSpecial[굴림]을 가지면 그 특별한 굴림은 출생 전용 결과로 바꾼다 (예: 홍원은 유물 사건이 없어 무너진 유적 탐험 대신 다른 결과) */
  function childhood(s,o){
    const tbl=o&&o.kidTable,sp=(o&&o.kidSpecial)||{};
    return D.childhood.stages.map(st=>{const r=d(100),x=sp[r]||pick(tbl&&!CFG.kidKeep.includes(r)?tbl:D.childhood.table,r);addStats(s,x.fx);return {age:st.age,r,x}});
  }
  /* job: 히든 직업으로 태어나면 출신 칸이 그 직업으로 바뀐다 (발톱 1, 조율자 100). 나머지 굴림은 같은 시드 그대로 */
  /* 출생 보정 없이 시작: 출신·재능·결점·무기·타고난 것이 없고, 성장기 보정과 색만 남는다. keep = {r, kid} (이미 굴린 출생에서 가져온다) */
  /* 빈손의 보정: 아무것도 쥐지 않았기에 쥘 수 있는 것이 많다 (히든 보스 전리품 장비 확률 +gearUp%p, 마음이 꺾일 때 E.G.O 형상이 보일 확률 egoSight%) */
  const BLANK={o:{n:'아무것도 없는 존재',t:'이름도 내력도 쥐여 주지 않은 채 태어났다.',e:'출생 보정 없음 · 빈손: 히든 보스 전리품 장비 확률 +25%p · 정신이 꺾일 때 E.G.O 형상이 보일 확률 25%',fx:{gearUp:25,egoSight:25},paths:{},flags:{},deck:['slash','thrust','smash','guard']},
    t:{n:'재능 없음',t:'',e:'',fx:{}},f:{n:'결점 없음',t:'',e:'',fx:{}},w:{n:'맨손',e:'아무것도 쥐지 않았다',fx:{}}};
  /* 아무것도 없는 출발의 운명: chance% 확률로 히든 출신 n개 중 하나를 고르게 강요한다 (고를 수 있는 건 히든 출신 굴림 값) */
  function blankFate(){
    const F=CFG.blankFate,H=(D.hiddenOrigins||[]).map(x=>x.roll).filter(r=>!F.pool||F.pool.includes(r));
    if(H.length<F.n||d(100)>F.chance)return null;
    const pool=H.slice(),out=[];while(out.length<F.n){out.push(pool.splice(d(pool.length)-1,1)[0])}
    return out.sort((a,b)=>a-b);
  }
  const hasInn=(ch,k)=>ch.innate===k||ch.innate2===k;
  /* 해금해야 나오는 타고난 것(D.innate[k].unlock): 열린 목록 (UI가 기록실에서 읽어 넣는다). null이면 전부 열려 있다 (시뮬·검사용) */
  let innateOpen=null;
  const setInnateOpen=a=>{innateOpen=Array.isArray(a)?a.slice():null};
  /* 같은 시드면 같은 타고난 것이 나오게: 기본 타고난 것은 해금과 상관없이 항상 같은 순서로 고르고,
     해금한 타고난 것은 별도 해시(r<해금 목록 길이)가 걸릴 때만 그 자리를 대신한다. 해금 상태가 달라도 대부분의 시드는 같은 결과다 */
  function pickInnate(n,div,exclude){
    const all=Object.keys(D.innate||{}),isU=k=>!!(D.innate[k]&&D.innate[k].unlock),B=all.filter(k=>!isU(k)&&k!==exclude),U=all.filter(isU);
    if(!B.length)return null;
    const q=Math.floor(n/div);let k=B[q%B.length];
    const r=Math.floor(q/B.length)%10;
    if(r<U.length&&U[r]!==exclude&&(!innateOpen||innateOpen.includes(U[r])))k=U[r];
    return k;
  }
  const innatePool=()=>Object.keys(D.innate||{}).filter(k=>!(D.innate[k]&&D.innate[k].unlock)||!innateOpen||innateOpen.includes(k));
  /* 이번 판 기록으로 새로 열린 타고난 것: 강철 체질(한 전투에서 20번 피격) · 질풍(속도가 기본보다 크게 오름) · 타고난 학자(최고 레벨 기록) · 굳은 정신(E.G.O 개화 1회) */
  function innateUnlocks(ch,bestLv){
    const U=CFG.innateUnlock,out=[];
    if(ch.tough)out.push('iron');
    if(ch.spd0!=null&&ch.stats.spd-ch.spd0>=U.spdUp)out.push('swift');
    if(Math.max(bestLv||0,ch.lv||0)>=U.lv)out.push('scholar');
    if(ch.ego&&!ch.egoBorn)out.push('will');
    return out.filter(k=>D.innate[k]);
  }
  function newChar(job,fixO,keep){
    const r=keep?Object.assign({},keep.r):{o:d(100),t:d(100),f:d(100),w:d(100),n:d(100)},J=!keep&&job&&D.hiddenJobs[job];
    if(J)r.o=J.roll;
    else if(fixO)r.o=fixO;
    /* 6시즌 히든 출생: 출신 굴림이 정확히 그 숫자면 표의 칸 대신 숨은 출신 (예: 90 → 보냐텔리 가문). 숨은 출생이 talents·flaws·kidTable·noWeapon을 가지면 재능·결점·성장기는 그 표에서, 무기는 맨손(전용 무기)으로 */
    const HO=!J&&(!keep||keep.fate)&&(D.hiddenOrigins||[]).find(x=>x.roll===(keep&&keep.fate?keep.fate:r.o)&&(keep||!(CFG.blankFate.pool||[]).includes(x.roll)));
    const o=keep?(keep.fate&&HO?HO:BLANK.o):J?{n:J.n,t:J.t,e:J.e,fx:J.fx,card:J.cards[0],paths:{},flags:{}}:HO||pick(D.origins,r.o),t=keep?BLANK.t:pick(o.talents||D.talents,r.t),f=keep?BLANK.f:pick(o.flaws||D.flaws,r.f),w=keep||o.noWeapon?BLANK.w:pick(D.weapons,r.w),ci=Math.floor((r.n-1)/10);
    const s={maxHp:CFG.baseHp,atk:0,eva:0,spd:0,check:0,startBleed:0,startBreath:0,enemyHp:0,dmin:1,dminUp:0,dr:0,regen:0,defUp:0,hit:0,adv:0,extraD2:0,dmgB:0,burnHit:0,pdie:6,advDie:0,mindMax:0,gearUp:0,egoSight:0,relicApt:0};
    for(const x of [o,t,f])addStats(s,x.fx);
    const kid=keep?keep.kid.map(k=>{addStats(s,k.x.fx);return k}):childhood(s,o);
    const ch={r,o,t,f,w,kid,ci,blank:!!keep&&!(keep.fate&&HO),fated:!!(keep&&keep.fate&&HO),color:D.colors[ci].hex,licensed:false,title:null,aff:null,paths:Object.assign({},o.paths),
      flags:Object.assign({},o.flags),beaten:[],unlocks:[],mind:Math.min(CFG.mind.cap,CFG.mind.max+(s.mindMax||0)),stats:s,hp:s.maxHp,gear:{},money:D.money.start[o.n]||o.money||0,
      deck:o.deck?o.deck.slice():['slash','thrust','smash','guard',o.card],xp:0,lv:1,lvPend:0,lvOpts:null};
    ch.s0={maxHp:s.maxHp,atk:s.atk,eva:s.eva,spd:s.spd,check:s.check};
    if(o.race)ch.race=o.race;if(o.relicPick)ch.relicPick=true;if(o.thumbBias)ch.thumbBias=o.thumbBias;if(o.cardMoney)ch.cardMoney=true;if(o.relicBase)ch.relicBase=o.relicBase;
    if(o.sub){ch.relics=[...(ch.relics||[]),o.sub.n];if(o.sub.hwando)ch.hwando=true}
    if(o.hw)ch.hw={fi:0,rv:0};
    if(o.flags&&o.flags.lake)ch.aff={type:'lake',name:'U사 선원'};   // 대호수로 나간 자는 처음부터 선원: 기존 진로(공적·승급·최고 직위) 구조를 쓴다
    if(o.flags&&o.flags.lake&&D.careers&&D.careers.lake){const r0=D.careers.lake.ranks[0];ch.fi=0;ch.fr=r0;addStats(ch.stats,r0.fx||{});ch.licensed=true;ch.rank=T.rankStart;ch.dom='atk'}   // 선원 직위로 시작: 승급은 숙련 선원부터
    if(o.rb){const Z=CFG.rb,tr=d(100),tm=Z.team.find(t=>tr<=t[0])[1];ch.teamPick=true;   // 팀은 출생 화면에서 고른다(임시값만 굴려 둔다)
      
      ch.rteam=tm;ch.rb={n:0,chase:0,hides:0,chasers:['rh1'].concat(Object.keys(Z.foes).filter(t=>t!==tm).map(t=>Z.foes[t]))};(ch.relics=ch.relics||[]).push('R사 부화장 · '+tm+' 개체')}
    /* 타고난 것 (히든): 출생 굴림 값의 해시로 정한다 */
    const IN=CFG.innate,h=(r.o*7919+r.t*104729+r.f*1299709+r.w*15485863+r.n*32452843+ch.kid.reduce((a,k)=>a*31+k.r,7))%1000003;
    if(!keep&&h%IN.chanceDiv===0){const k=pickInnate(h,IN.chanceDiv,null);if(k)ch.innate=k}
    /* 타고난 것은 최대 2개까지 같이 뜰 수 있다: 첫 번째가 뜬 사람에게만 다른 해시로 두 번째를 굴린다 (secondDiv분의 1, 첫 번째와 다른 것) */
    {const h2=(r.o*104729+r.t*7919+r.f*15485863+r.w*1299709+r.n*49979687+ch.kid.reduce((a,k)=>a*37+k.r,11))%1000003;
      if(!keep&&ch.innate&&h2%IN.secondDiv===0){const k=pickInnate(h2,IN.secondDiv,ch.innate);if(k)ch.innate2=k}}
    /* 출생 때 한 번 적용되는 타고난 것 (강철 체질 · 질풍 · 굳은 정신) */
    for(const k of [ch.innate,ch.innate2]){const E_=k&&D.innate[k]&&D.innate[k].fx;if(!E_)continue;const s_=ch.stats;for(const [sk,v] of Object.entries(E_))s_[sk]=(s_[sk]||0)+v;if(E_.maxHp)ch.hp+=E_.maxHp;if(E_.mindMax)ch.mind=Math.min(CFG.mind.cap,CFG.mind.max+(s_.mindMax||0))}
    if(J){ch.job=job;ch.aff={type:'head',name:'머리'};if(J.deck){ch.deck=J.deck.slice();ch.cardMoney=true;ch.packName=J.n+' 전용 카드팩'}else for(const c of J.cards.slice(1))ch.deck.push(c);ch.money=J.money||0;ch.relics=[J.n]}
    /* 출생 때 굴린 무기는 무기 칸의 첫 장비 */
    /* 맨손은 무기가 아니다: 무기 칸을 비워 두고(화면에는 맨손으로 보인다) 그 보정은 몸에 직접 더한다 */
    if(w.n==='맨손'){for(const [k,v] of Object.entries(w.fx||{}))if(k in ch.stats)ch.stats[k]+=v}else equip(ch,{id:'birth',slot:'weapon',n:w.n,e:w.e,fx:w.fx});
    /* 히든 직업 전용 무기: 출생 무기는 보관함으로 */
    if(J&&J.weapon)equip(ch,Object.assign({grade:5},J.weapon));
    if(o.weapon===true)equip(ch,bonItem(0));
    if(o.weapon==='star'){equip(ch,starItem(0,''));ch.starPick=true}
    if(o.gear){equip(ch,Object.assign({grade:5},o.gear));if(o.rb||o.hw){const W=CFG.routeWeapon[o.rb?'rb':'hw'],g=W.lv[0];ch.gear.weapon.n=g.n;ch.gear.weapon.e=g.e}}
    /* E.G.O 적성자(20): 해결사 9급, 무작위 E.G.O 무기, 그 이름으로 개화한 E.G.O (종류 무작위) */
    if(o.egoWeapons){const g=o.egoWeapons[d(o.egoWeapons.length)-1];equip(ch,egoItem(g.id,0));ch.egoUses=0;egoDeck(ch,g.id,0,true);ch.stash=(ch.stash||[]).filter(x=>x.id!=='birth');
      ch.egoGear=(ch.egoGear||0)+1;setEgo(ch,d(2)===1?'atk':'def',g.n);ch.mind=Math.min(CFG.mind.cap,CFG.mind.max+(s.mindMax||0));license(ch);if(o.startRank)ch.rank=o.startRank;ch.colorBonus=o.colorBonus||0;ch.colorFx=o.colorFx||null}
    ch.spd0=ch.stats.spd;if(ch.ego)ch.egoBorn=true;ch.packKind=ch.deckLocked||ch.cardMoney?'special':'origin';ch.packName=ch.packName||(ch.o&&ch.o.packName)||(ch.packKind==='special'?(ch.o&&ch.o.n?ch.o.n+' 전용 카드팩':'전용 카드팩'):(ch.o&&ch.o.n?ch.o.n+' 출신 카드팩':'출신 카드팩'));ch.birthPack=ch.packName;ch.packs=newBasicPacks();
    return ch;
  }
  /* R사 부화장: 출생 때 고른 팀으로 바꾸고 보정을 준다(토끼 속도 · 코뿔소 체력 · 순록 회피) */
  function setRbTeam(ch,team){
    const Z=CFG.rb,B=Z.teamBonus&&Z.teamBonus[team];if(!ch.teamPick||!ch.rb||!B||!Z.foes[team])return false;
    const old=ch.rteam;ch.rteam=team;ch.teamPick=false;
    ch.rb.chasers=['rh1'].concat(Object.keys(Z.foes).filter(t=>t!==team).map(t=>Z.foes[t]));
    ch.relics=(ch.relics||[]).map(r=>r==='R사 부화장 · '+old+' 개체'?'R사 부화장 · '+team+' 개체':r);
    addStats(ch.stats,B);if(B.maxHp)ch.hp+=B.maxHp;if(B.spd!=null)ch.spd0=ch.stats.spd;
    return true;
  }
  /* 유물 적성자: 출생 때 고른 유물 지급 */
  function giveRelic(ch,id,late){
    const R=D.relics[id];if(!R)return;
    (ch.relics=ch.relics||[]).push(R.n);(ch.relicIds=ch.relicIds||[]).push(id);ch.relicPick=false;ch.relicPickLate=false;
    if(R.odin){ch.odin=true;if(ch.o&&ch.o.n==='보냐텔리 가문')ch.yeji=true}
    /* 환도 + 궁니르: 공명 패시브와 전용 카드 2장 */
    if(id==='gungnir'&&ch.hwando&&!ch.resonance){ch.resonance=true;ch.relics.push('궁니르 공명');for(const gid of ['g_gungnir','g_gungnir'])if(!routeBirthCard(ch,gid))forceAdd(ch,gid)}
    if(R.gear){const g=Object.assign({id:R.gear.id||id,grade:5},R.gear);if(late)offerGear(ch,g);else{equip(ch,g);ch.stash=(ch.stash||[]).filter(x=>x.id!=='birth')}}
  }
  /* 이미 가진 유물은 다시 고를 수 없다 */
  /* 잊힌 유물 확률: 기본 + 유물 적성 (성장기 '무너진 유적 탐험') */
  const relicChance=ch=>(ch.relicBase||CFG.relicEvent.chance)+((ch.stats&&ch.stats.relicApt)||0);
  const relicChoices=ch=>Object.keys(D.relics).filter(k=>!(ch.relicIds||[]).includes(k)&&!(ch.relics||[]).includes(D.relics[k].n)&&!(k==='laev'&&(ch.relics||[]).includes(D.relics.laev.open.n)));
  /* ===== 장비·돈·공방 ===== */
  /* 장비 칸마다 하나. 바꾸면 이전 장비 효과를 빼고 새 장비 효과를 더한다. 피해 최소값은 장비 중 가장 큰 값 */
  /* 피해 주사위 최소값 = 장비 중 가장 큰 값 + 재능·성장기에서 온 +1들 (겹치면 더해진다), dminCap 이하 */
  const calcDmin=ch=>Math.min(CFG.dminCap,Math.max(1,...Object.values(ch.gear).map(g=>g.fx.dmin||1))+(ch.stats.dminUp||0));
  function equip(ch,item){
    /* 육신 뒤틀림: 장비를 낄 수 없다 (보관함으로) · N사 날개: 의수를 끼지 않는다 (보관함으로) */
    if((ch.distForm&&!ch.distStable)||(item.slot==='aug'&&isN(ch))){(ch.stash=ch.stash||[]).push(item);return}
    const s=ch.stats,old=ch.gear[item.slot];
    /* 공방 해결사의 전용 무기·방어구·의수는 빼거나 다른 장비로 바꿀 수 없다 (다른 장비는 보관함으로) */
    if(old&&old.id==='ws_'+item.slot&&item.id!==old.id&&isWs(ch)){(ch.stash=ch.stash||[]).push(item);return}
    if(old)for(const [k,v] of Object.entries(old.fx))if(k!=='dmin'&&k in s){s[k]-=v;if(k==='maxHp')ch.hp=Math.min(ch.hp,s.maxHp)}
    for(const [k,v] of Object.entries(item.fx))if(k!=='dmin'&&k in s){s[k]+=v;if(k==='maxHp')ch.hp+=v}
    ch.gear[item.slot]=item;
    /* 빼낸 장비는 버리지 않고 보관함으로 */
    /* 맨손은 쥐고 있는 물건이 아니므로 보관함에 남기지 않는다 */
    if(old&&!(old.id==='birth'&&old.n==='맨손'))(ch.stash=ch.stash||[]).push(old);
    s.dmin=calcDmin(ch);
    /* 무기 피해 주사위 면 수 (궁니르 d10). 장비 중 가장 큰 값, 기본 d6 */
    s.pdie=Math.max(6,...Object.values(ch.gear).map(g=>g.fx.die||6));
    if(item.card&&!ownsCard(ch,item.card)&&!routeCard(ch,item.card,null)&&!ch.deckLocked){putCard(ch,item.card);if(ch.cardMoney&&ch.deck.includes(item.card))(ch.extra=ch.extra||[]).push(item.card)}
  }
  /* ===== 6시즌: N사 날개 · 의체 심판: 의수를 쓰지 않고, 의체 상대(enemies aug)를 심판한다 ===== */
  const isN=ch=>!!ch.aff&&ch.aff.name===CFG.nWing.name;
  /* 특색에 닿은 사람은 이미 전용 의수를 쓰고 있어서 N사 날개(의수 불가)에는 들어갈 수 없다 */
  const nBlocked=ch=>!!(ch.colorDone||ch.titleKind==='color');
  const isEastOuter=ch=>!!(ch.o&&ch.o.n==='동부 출신 외곽 생존자');
  function unequip(ch,slot){
    const s=ch.stats,it=ch.gear[slot];if(!it)return;
    for(const [k,v] of Object.entries(it.fx))if(k!=='dmin'&&k in s){s[k]-=v;if(k==='maxHp')ch.hp=Math.min(ch.hp,s.maxHp)}
    delete ch.gear[slot];(ch.stash=ch.stash||[]).push(it);
    s.dmin=calcDmin(ch);s.pdie=Math.max(6,...Object.values(ch.gear).map(g=>g.fx.die||6));
  }
  /* ===== 6시즌: 보냐텔리의 검 (레이피어 + 외날검) =====
     가속: 공격한 라운드마다 1스택(전투당 최대 3), 스택당 명중 +5 · 회피 +5.
     강화: 보관함의 다른 장비를 재료로 써서 최대 +5. 단계마다 필요한 재료 등급이 오른다 (+5는 유물·히든 장비) */
  /* 보냐텔리의 검 단계(+무한 모드 후반)에 따라 전용 검술 카드의 피해가 오른다 */
  function bonCardB(ch){
    const w=ch&&ch.gear&&ch.gear.weapon;if(!(w&&w.id==='bonatelli'))return 0;
    const B=CFG.bon;return (B.cardB[w.lvl||0]||0)+Math.min(B.lateMax,Math.floor(Math.max(0,((ch.year||0)-B.lateFrom))/B.lateEvery)*B.latePer)+(!ch.odin&&(w.lvl||0)>=B.noEyeFrom?B.noEye:0);
  }
  function bonItem(L){
    const B=CFG.bon,fx={atk:B.atk[L],eva:B.eva[L]};if(B.dmgB[L])fx.dmgB=B.dmgB[L];
    return {id:'bonatelli',slot:'weapon',grade:5,lvl:L,n:'보냐텔리의 검'+(L?' +'+L:''),
      e:`공+${fx.atk} · 회피+${fx.eva}${fx.dmgB?' · 피해+'+fx.dmgB:''} · 가속(공격한 라운드마다 명중·회피 +5, 최대 ${L>=B.max?B.accel.max+1:B.accel.max})`,fx,wx:{accel:L>=B.max?Object.assign({},B.accel,{max:B.accel.max+1}):B.accel}};
  }
  /* ===== 별에 선택받은 자: 이름을 붙인 성도 (무기) =====
     별 잇기: 적중할 때마다 별 하나, need개를 이으면 그 적중 피해 ×2. 강화는 보냐텔리의 검과 같은 재료 규칙(보관함 장비를 녹여 최대 +5) */
  /* virt: 소지 루트로 이은 별(인·의·예·지). 재료 강화(+1~+5)와 따로 더해지는 추가 강화 */
  function starItem(L,name,virt){
    const S=CFG.star,V=(virt||[]).filter(k=>S.virt[k]),fx={atk:S.atk[L],eva:S.eva[L]};if(S.dmgB[L])fx.dmgB=S.dmgB[L];
    for(const k of V)for(const [a,v] of Object.entries(S.virt[k].fx))fx[a]=(fx[a]||0)+v;
    const need=L>=S.fastFrom||V.includes('지')?3:4,nm=((name||'').trim()||'이름 없는')+'성도';
    return {id:'star',slot:'weapon',grade:5,lvl:L,base:nm,virt:V,n:nm+(L?' +'+L:'')+(V.length?' ['+V.join('·')+']':''),
      e:`공+${fx.atk} · 회피+${fx.eva}${fx.maxHp?' · HP+'+fx.maxHp:''}${fx.dmgB?' · 피해+'+fx.dmgB:''} · 별 잇기(적중 ${need}번째마다 피해 ×2)${L>=S.max?' · 전투마다 빛 +1':''}`,fx,wx:Object.assign({mark:{need,n:'별 잇기'}},L>=S.max?{lightUp:1}:{})};
  }
  /* 소지 루트: 이은 별(인·의·예·지)을 성도에 새긴다 (재료 강화 단계와 따로 더해지는 추가 강화, 장착 중이든 보관함이든) */
  function starUp(ch,k){
    const w=ch.gear.weapon,st=ch.stash||[],own=w&&w.id==='star'?w:st.find(x=>x.id==='star');if(!own||(own.virt||[]).includes(k))return null;
    const nw=carryTune(own,starItem(own.lvl||0,own.base.replace(/성도$/,''),[...(own.virt||[]),k]));
    if(own===w){equip(ch,nw);ch.stash=(ch.stash||[]).filter(x=>x!==own)}else st[st.indexOf(own)]=nw;
    return nw.n;
  }
  function setStar(ch,name,force){
    if(!ch.starPick||(!force&&nameErr(name)))return false;
    const w=ch.gear.weapon;ch.starPick=false;
    const it=carryTune(w&&w.id==='star'?w:null,starItem(w&&w.id==='star'?w.lvl||0:0,name));
    if(w&&w.id==='star'){ch.gear.weapon=it}else{const st=ch.stash||[],i=st.findIndex(x=>x.id==='star');if(i>=0)st[i]=it}
    (ch.relics=ch.relics||[]).push('별의 선택 · '+it.base);return it;
  }
  /* ===== 6시즌: E.G.O 적성자의 무기 성장 =====
     전용 카드 '발현'을 낸 누적 횟수가 CFG.egoGrow.need에 닿는 순간 TETH → HE → WAW → ALEPH. 수치는 egoWeapons[].grow[등급-1] */
  const egoBase=id=>{for(const o of D.hiddenOrigins||[])for(const g of o.egoWeapons||[])if(g.id===id)return g;return null};
  function egoItem(id,L){
    const b=egoBase(id),g=L?b.grow[L-1]:b,it=structuredClone({id:b.id,slot:b.slot,n:b.n,e:g.e,fx:g.fx,wx:g.wx});
    return Object.assign(it,{grade:L>=2?5:4,egoLv:L});
  }
  const egoLvFor=u=>CFG.egoGrow.need.reduce((a,n,i)=>u>=n?i:a,0);
  /* E.G.O 책장: 등급(L)마다 덱의 E.G.O 전용 카드가 그 등급의 카드로 바뀐다. 장수·구성은 birth.json egoBooks[무기 id].decks[L] */
  const egoBook=id=>{for(const o of D.hiddenOrigins||[])if(o.egoBooks&&o.egoBooks[id])return o.egoBooks[id];return null};
  /* 다른 카드팩으로 갈아탄 덱에는 E.G.O 책장을 끼워 넣지 않는다 (덱에 E.G.O 책장 카드가 있을 때만 그 등급 카드로 바꾼다). 보관 중인 팩의 덱도 같이 올려 둔다 */
  function egoDeck(ch,id,L,force){const bk=egoBook(id);if(!bk)return;const all=new Set(bk.decks.flat()),to=bk.decks[Math.min(L,bk.decks.length-1)];
    const swap=dk=>Array.isArray(dk)&&(force||dk.some(c=>all.has(c)))?dk.filter(c=>!all.has(c)).concat(to):dk;
    ch.deck=swap(ch.deck);for(const p of ch.packs||[])if(p&&p.deck)p.deck=swap(p.deck)}
  /* E.G.O 카드의 무기 자원: 징벌(내 쪽)·거미줄·우주의 노래(상대 쪽). get/add는 현재 무기 기준 */
  function egRes(A,B,add){const w=A.wx||{};
    if(w.grudge){if(add)A.grudge=Math.min(5,(A.grudge||0)+add);return A.grudge||0}
    if(w.debuff&&w.debuff.k==='web'){if(add)B.web=Math.min(5,(B.web||0)+add);return B.web||0}
    if(w.echo){if(add)B.wecho=(B.wecho||0)+add;return B.wecho||0}
    return 0}
  /* 발현을 낸 직후 확인: 장착 중이든 보관함이든 E.G.O 무기 하나를 올린다. 올렸으면 {old,nw} */
  /* 정비한 장비가 다른 등급 장비로 바뀔 때(E.G.O 성장·보냐텔리 강화) 정비 횟수와 강화분을 넘겨 준다 */
  /* 승급·계열 변경으로 같은 칸의 장비가 바뀔 때: 장비에 쌓은 연마(공격·회피 +1 시도)를 새 장비로 옮긴다.
     W사 열차 직급 무기처럼 직급이 오르며 대신 들어서는 무기는 업그레이드이므로 옛 무기는 보관함에 남기지 않고 사라진다. 그 밖의 무기(출신 무기·전리품 등)는 연마가 빠진 채 보관함으로 간다 */
  const warpWid=()=>{const s=new Set();for(const f of Object.values(D.warpWeapons||{}))for(const w of f)s.add(w.id);for(const r of ((CR.wing||{}).trainRanks||[])){if(r.gear)s.add(r.gear.id);if(r.gear2)s.add(r.gear2.id)}return s};
  function equipUp(ch,nw){const old=ch.gear[nw.slot];
    if(old&&(old.tries||old.tune)&&old.id!==nw.id){const tn=Object.assign({},old.tune||{});carryTune(old,nw);equip(ch,nw);for(const [k,v] of Object.entries(tn))if(old.fx&&k in old.fx)old.fx[k]-=v;delete old.tune;old.tries=0}else equip(ch,nw);
    if(old&&old.id!==nw.id&&warpWid().has(old.id))ch.stash=(ch.stash||[]).filter(x=>x!==old)}
  function carryTune(old,nw){if(!old||!(old.tries||old.tune))return nw;nw.tries=old.tries||0;if(old.tune){nw.tune=Object.assign({},old.tune);for(const [k,v] of Object.entries(old.tune))nw.fx[k]=(nw.fx[k]||0)+v}return nw}
  function egoGrow(ch){
    if(ch.egoUses==null)return null;
    const st=ch.stash||[],w=ch.gear.weapon,L=egoLvFor(ch.egoUses),own=w&&egoBase(w.id)?w:st.find(x=>egoBase(x.id));
    if(!own||(own.egoLv||0)>=L)return null;
    const nw=carryTune(own,egoItem(own.id,L));
    if(own===w){equip(ch,nw);ch.stash=ch.stash.filter(x=>x!==own)}else st[st.indexOf(own)]=nw;
    egoDeck(ch,nw.id,L);
    ch.egoNote=`E.G.O ${CFG.egoGrow.tier[L]} · ${nw.n} (${nw.e})`;
    return {old:own,nw,worn:own===w};
  }
  const bonNeed=ch=>{const w=ch.gear.weapon;return w&&(w.id==='bonatelli'&&w.lvl<CFG.bon.max||w.id==='star'&&w.lvl<CFG.star.max)?CFG.bon.need[w.lvl]:null};
  /* 강화할 수 있는 전용 무기의 다음 단계 */
  const upItem=(w,L)=>w.id==='star'?starItem(L,w.base.replace(/성도$/,''),w.virt):bonItem(L);
  /* 맨손은 쥐고 있는 물건이 아니므로 어떤 강화의 재료도 되지 않는다 */
  const isBare=x=>!!x&&x.id==='birth'&&x.n==='맨손';
  function bonUpgrade(ch,i){
    const need=bonNeed(ch),st=ch.stash||[],m=st[i];if(need==null||!m||isBare(m)||(m.grade||0)<need)return false;
    st.splice(i,1);const old=ch.gear.weapon;equip(ch,carryTune(old,upItem(old,old.lvl+1)));ch.stash=ch.stash.filter(x=>x!==old);return true;
  }
  function equipStash(ch,i){const st=ch.stash||[];if(!st[i]||(st[i].slot==='aug'&&isN(ch)))return false;equip(ch,st.splice(i,1)[0]);return true}
  const inStash=(ch,id)=>(ch.stash||[]).some(x=>x.id===id)||(ch.gearOffers||[]).some(x=>x.id===id);
  /* ===== 6시즌: 장비를 얻으면 바로 끼지 않고, 장착할지 보관함에 넣을지 고른다 ===== */
  function offerGear(ch,item){(ch.gearOffers=ch.gearOffers||[]).push(item)}
  function resolveGear(ch,i,wear){const o=ch.gearOffers||[];if(!o[i])return false;const it=o.splice(i,1)[0];if(wear)equip(ch,it);else (ch.stash=ch.stash||[]).push(it);return true}
  /* ===== 6시즌: 덱은 최대 CFG.deck.max장 (E.G.O가 개화하면 CFG.mind.deckPlus장 더). 넘치는 카드는 카드함에 두고, 공방 밖에서도 자유롭게 넣고 뺀다 ===== */
  const ownsCard=(ch,cid)=>ch.deck.includes(cid)||(ch.side||[]).includes(cid)||(ch.offers||[]).includes(cid)||(ch.picks||[]).some(g=>g.includes(cid));
  const deckMax=ch=>CFG.deck.max+(ch.ego?CFG.mind.deckPlus:0);
  const deckRoom=ch=>ch.deck.length<deckMax(ch);
  function putCard(ch,cid,chips,label){
    if(deckRoom(ch)){ch.deck.push(cid);chips&&chips.push((label||'카드')+' · '+D.cards[cid].n);return}
    (ch.side=ch.side||[]).push(cid);chips&&chips.push(`${label||'카드'} · ${D.cards[cid].n} (덱이 가득 차서 카드함으로)`);
  }
  function takeOffer(ch,i,to,swap){
    const o=ch.offers||[],cid=o[i];if(!cid)return false;
    if(to==='deck'){if(!deckRoom(ch))return false;ch.deck.push(cid)}
    else if(to==='swap'){const j=+swap;if(ch.deckLocked||!ch.deck[j]||D.cards[ch.deck[j]].fixed)return false;(ch.side=ch.side||[]).push(ch.deck[j]);ch.deck[j]=cid}
    else (ch.side=ch.side||[]).push(cid);
    copyToPacks(ch,cid);
    o.splice(i,1);return true;
  }
  function dropOffer(ch,i){const o=ch.offers||[];if(!o[i])return false;o.splice(i,1);return true}
  /* 덱이 고정이어도 사건·루트가 억지로 밀어 넣은 카드(고정 카드 제외)는 뺄 수 있다. 카드함 대신 사라진다 */
  const forceAdd=(ch,...ids)=>{(ch.extra=ch.extra||[]).push(...ids);ch.deck.push(...ids)};
  const extraOut=(ch,i)=>{const id=ch.deck[i];return !!id&&(ch.deckLocked||ch.cardMoney)&&!D.cards[id].fixed&&((ch.extra||[]).includes(id)||Object.values(ch.gear||{}).some(g=>g&&g.card===id))};
  function deckOut(ch,i){if(extraOut(ch,i)&&ch.deck.length>CFG.shop.minDeck){const xi=(ch.extra||[]).indexOf(ch.deck[i]);if(xi>=0)ch.extra.splice(xi,1);ch.deck.splice(i,1);return true}if(ch.deckLocked||ch.cardMoney||!ch.deck[i]||D.cards[ch.deck[i]].fixed||ch.deck.length<=CFG.shop.minDeck)return false;(ch.side=ch.side||[]).push(ch.deck.splice(i,1)[0]);return true}
  function deckIn(ch,i){const sd=ch.side||[];if(ch.deckLocked||ch.cardMoney||!sd[i]||!deckRoom(ch))return false;ch.deck.push(sd.splice(i,1)[0]);return true}
  function sideDrop(ch,i){const sd=ch.side||[];if(!sd[i]||ch.cardMoney||D.cards[sd[i]].fixed)return false;sd.splice(i,1);return true}
  /* 고르지 않고 넘어가면(시뮬레이션): 카드는 자리가 있으면 덱에, 없으면 버리고, 장비는 장착한다 */
  /* 카드가 들어갈 자리: 전용 팩(덱 고정·전용 카드팩)을 쓰는 중에 다른 곳에서 강제로 들어오는 카드(의수·승진)는
     지금 덱에 끼우지 않고, 그 카드가 속한 팩(없으면 기본 카드팩)의 보관함으로 보낸다. 보낼 팩도 없으면(처음부터 전용 책장만 쓰는 판) 받지 않는다. 덱에 끼우지 않았으면 true */
  const packByName=(ch,n)=>(ch.packs||[]).find(p=>p.n===n);
  function routeCard(ch,cid,owner,chips,label){
    if(!(ch.deckLocked||ch.cardMoney))return false;
    if(owner&&(ch.orgPack===owner||ch.packName===owner+' 전용 카드팩'))return false;
    const t=owner&&packByName(ch,owner+' 전용 카드팩');
    if(!t){
      if(!owner&&(ch.packs||[]).some(p=>p.k==='basic')){for(const p of ch.packs)if(p.k==='basic'&&!p.deck.includes(cid)&&!p.side.includes(cid))(p.deck.length<deckMax(ch)?p.deck:p.side).push(cid);
        chips&&chips.push(`${label||'카드'} · ${D.cards[cid].n} → 기본 카드팩에 보관 (쓰는 팩이 아니라 카드팩 보관함으로)`);return true}
      chips&&chips.push(`${label||'카드'} · ${D.cards[cid].n}은(는) 전용 책장을 쓰는 중이라 받지 않는다`);return true}
    if((ch.packs||[]).some(p=>p.deck.includes(cid)||p.side.includes(cid)))return true;
    (t.deck.length<deckMax(ch)?t.deck:t.side).push(cid);
    chips&&chips.push(`${label||'카드'} · ${D.cards[cid].n} → ${t.n}에 보관 (쓰는 팩이 아니라 카드팩 보관함으로)`);
    return true;
  }
  /* 출생 때 받은 팩에 속하는 카드(궁니르 공명 등): 지금 쓰는 팩이 출생팩이면 덱에, 출생팩을 보관함에 두고 다른 팩을 쓰는 중이면 그 보관함에 넣는다. 보냈으면 true */
  function routeBirthCard(ch,cid){
    const bp=ch.birthPack;if(!bp||ch.packName===bp)return false;
    const t=packByName(ch,bp);if(!t)return false;
    (t.deck.length<deckMax(ch)?t.deck:t.side).push(cid);
    return true;
  }
  /* ===== 카드팩 보관함 =====
     덱이 통째로 바뀌기 전에 지금 팩(덱·카드함·고정 여부)을 보관한다. 전투 밖에서는 횟수 제한 없이 팩을 바꿔 끼울 수 있다 (고정 덱과 기본 덱을 견주어 보는 용도).
     전투 중에는 가방이 열리지 않아 바꿀 수 없다 */
  const PACKMAX=40,BASE4=['slash','thrust','smash','guard'];
  const packSnap=ch=>({n:ch.packName||'출신 카드팩',k:ch.packKind||'origin',deck:ch.deck.slice(),side:(ch.side||[]).slice(),extra:(ch.extra||[]).slice(),deckLocked:!!ch.deckLocked,cardMoney:!!ch.cardMoney,orgPack:ch.orgPack||null,finalGiven:!!ch.finalGiven});
  function stashPack(ch,newName){(ch.packs=ch.packs||[]).push(packSnap(ch));/* 보관함이 가득 차면 가장 오래된 팩부터 밀려나지만, 기본 카드팩 3개와 출생 때 받은 팩은 지우지 않는다 */
    while(ch.packs.length>PACKMAX){const i=ch.packs.findIndex(p=>p.k!=='basic'&&p.n!==ch.birthPack);if(i<0)break;ch.packs.splice(i,1)}ch.packName=newName||'전용 카드팩';ch.packKind='special'}
  /* 기본 카드팩 3개: 기본 4장으로 시작하는 이름을 바꿀 수 있는 프리셋. 출신 카드·소속 카드는 들어 있지 않고, 얻은 카드는 편집 가능한 모든 팩에 복사된다 */
  const newBasicPacks=()=>[1,2,3].map(i=>({n:'기본 카드팩 '+i,k:'basic',deck:BASE4.slice(),side:[],extra:[],deckLocked:false,cardMoney:false,orgPack:null,finalGiven:false}));
  /* 예전 판·새 판 공통: 기본 카드팩이 없으면 만들고, 지금 팩의 이름·종류를 채운다 */
  /* 망가진 세이브 복구: 능력치나 HP가 NaN(저장하면 null)이 된 판은 기본값과 장비의 HP로 다시 맞춘다 */
  function repairStats(ch){
    const st=ch.stats;if(!st)return false;let fixed=false;
    for(const k in st){if(typeof st[k]!=='number'&&st[k]!==null)continue;if(!Number.isFinite(st[k])){st[k]=k==='maxHp'?NaN:0;fixed=true}}
    if(!Number.isFinite(st.maxHp)||st.maxHp<20){const gh=Object.values(ch.gear||{}).reduce((a,g)=>a+((g&&g.fx&&g.fx.maxHp)||0),0);st.maxHp=CFG.baseHp+gh;ch.hp=st.maxHp;fixed=true}
    if(!Number.isFinite(ch.hp)||ch.hp<1||ch.hp>st.maxHp){ch.hp=st.maxHp;fixed=true}
    return fixed;
  }
  function ensurePacks(ch){
    repairStats(ch);syncPackFlags(ch);
    /* 예전 표기 'D6≥N'·'피해 주사위 최소 N'을 '1d6 최소치 N'으로: 이미 가진 장비·출생 설명도 새 표기로 */
    {const fix=o=>{if(o&&typeof o.e==='string'&&(o.e.includes('D6≥')||o.e.includes('피해 주사위 최소')))o.e=o.e.replace(/D6≥(\d+)/g,'1d6 최소치 $1').replace(/피해 주사위 최소/g,'1d6 최소치')};Object.values(ch.gear||{}).forEach(fix);(ch.stash||[]).forEach(fix);(ch.gearOffers||[]).forEach(fix);[ch.w,ch.t,ch.f,ch.o].forEach(fix)}
    if(ch.wtrain&&!(ch.aff&&ch.aff.name==='W사 날개'))ch.wtrain=false;   // 해고 등으로 날개를 잃었는데 열차 상태만 남은 저장
    if(ch.packKind==='basic'||(ch.packs||[]).some(p=>p.k==='basic'))return;
    ch.packKind=ch.packKind||(ch.deckLocked||ch.cardMoney?'special':'origin');
    ch.packName=ch.packName||(ch.packKind==='special'?'전용 카드팩':'출신 카드팩');
    ch.birthPack=ch.birthPack||ch.packName;
    ch.packs=newBasicPacks().concat(ch.packs||[]);
  }
  /* 얻은 카드(보상·사건 카드)를 편집할 수 있는 다른 팩(기본 3개·고정 없는 출신 팩)에도 복사한다. 덱이 가득 차면 그 팩의 카드함으로 */
  function copyToPacks(ch,cid){
    let n=0;for(const p of ch.packs||[]){if(p.deckLocked||p.cardMoney||p.deck.includes(cid)||p.side.includes(cid))continue;(p.deck.length<deckMax(ch)?p.deck:p.side).push(cid);n++}
    return n;
  }
  /* 기본 카드팩의 이름 바꾸기: i는 보관 팩 번호, -1이면 지금 쓰는 팩. 성공하면 true, 실패하면 이유 문장 */
  function renamePack(ch,i,name){
    const n=String(name||'').trim().replace(/\s+/g,' ');
    const t=i<0?null:(ch.packs||[])[i];
    if(i<0?ch.packKind!=='basic':!t||t.k!=='basic')return '기본 카드팩만 이름을 바꿀 수 있다';
    if(!n||n.length>10)return '1~10글자로 정한다';
    if(/[<>"&]/.test(n))return '쓸 수 없는 글자가 있다';
    const used=[ch.packName,...(ch.packs||[]).map(p=>p.n)].filter((x,j)=>j!==(i<0?0:i+1));
    if(used.includes(n))return '이미 있는 카드팩 이름이다';
    if(i<0)ch.packName=n;else t.n=n;
    return true;
  }
  /* 'ok' 바꿀 수 있음 · 'busy' 받을 카드가 남아 있음 · 'no' 바꿀 수 없음 */
  function packCan(ch,i){
    const t=(ch.packs||[])[i];if(!t||(ch.distForm&&!ch.distStable))return 'no';
    if((ch.offers||[]).length||(ch.picks||[]).length||ch.packOffer||(ch.gearOffers||[]).length)return 'busy';
    return 'ok';
  }
  /* 책장 패시브(붉은 안개·1권속 등)는 그 책장을 쓰는 동안에만 켜진다. 보관함으로 빼 둔 책장의 패시브가 다른 책장에서 남아 있지 않게 맞춘다 */
  const PACKPASS=(()=>{const m={};for(const e of Object.values(D.enemies||{})){const dr=e.drop;if(dr&&dr.packPassive&&dr.packName)m[dr.packName]=dr.packPassive}return m})();
  function syncPackFlags(ch){
    ch.flags=ch.flags||{};
    for(const [n,f] of Object.entries(PACKPASS)){
      if(ch.packName===n)ch.flags[f]=ch.flags[f]||1;
      else if(ch.flags[f]&&(ch.packs||[]).some(p=>p.n===n))delete ch.flags[f];
    }
  }
  function switchPack(ch,i){
    if(packCan(ch,i)!=='ok')return false;
    const ps=ch.packs,t=ps[i],cur=packSnap(ch),fx=ch.deck.filter(id=>D.cards[id].fixed);
    ps.splice(i,1);ps.push(cur);
    ch.deck=t.deck.filter(id=>!D.cards[id].fixed).concat(fx);ch.side=t.side.filter(id=>!D.cards[id].fixed);ch.extra=t.extra.slice();
    ch.deckLocked=t.deckLocked;ch.cardMoney=t.cardMoney;ch.orgPack=t.orgPack;ch.finalGiven=t.finalGiven;ch.packName=t.n;ch.packKind=t.k||'origin';
    while(ch.deck.length>deckMax(ch)){const k=ch.deck.map(id=>D.cards[id].fixed).lastIndexOf(false);if(k<0)break;(ch.side=ch.side||[]).push(ch.deck.splice(k,1)[0])}
    syncPackFlags(ch);
    return true;
  }
  /* 히든 보스 전용 책장: 받으면 덱이 통째로 바뀌고 영구 고정, 거절하면 지금 덱 유지 (이전 덱은 카드팩 보관함에 남는다) */
  function acceptPack(ch){const P=ch.packOffer;if(!P)return false;if(ch.distForm){ch.packOffer=null;return false}stashPack(ch,P.n);ch.extra=[];ch.finalGiven=false;ch.deck=P.cards.concat(ch.deck.filter(id=>D.cards[id].fixed));ch.deckLocked=true;if(P.cm)ch.cardMoney=true;if(P.orgPack)ch.orgPack=P.orgPack;ch.offers=[];ch.picks=[];ch.side=[];if(P.relic)(ch.relics=ch.relics||[]).push(P.relic);if(P.passive)(ch.flags=ch.flags||{})[P.passive]=1;ch.packOffer=null;syncPackFlags(ch);return true}
  /* 흑수 카드: 덱이 고정된 흑수 전용 책장이면 카드를 바로 덱에 넣는다 (돈으로 바뀌지 않게) */
  function hwCard(ch,id,chips){if(ch.deckLocked||ch.cardMoney){forceAdd(ch,id);chips&&chips.push('흑수 카드 · '+D.cards[id].n)}else addCard(ch,id,chips,'흑수 카드')}
  /* 흑수 섞기: 후보 시절 카드(hc_)를 덜어내고 일반 책장에 흑수의 첫 카드를 더한다. 덱은 고정하지 않는다 */
  function acceptPackAlt(ch){const P=ch.packOffer;if(!P||!P.alt)return false;if(ch.distForm){ch.packOffer=null;return false}
    ch.deck=ch.deck.filter(id=>!id.startsWith('hc_'));ch.side=(ch.side||[]).filter(id=>!id.startsWith('hc_'));ch.extra=(ch.extra||[]).filter(id=>!id.startsWith('hc_'));
    for(const id of BASE4)if(ch.deck.length<BASE4.length&&!ch.deck.includes(id))ch.deck.push(id);
    ch.packOffer=null;hwCard(ch,'zb_'+P.bk+'_1',null);(ch.relics=ch.relics||[]).push('흑수와 일반 책장을 섞는다');return true}
  function declinePack(ch){if(!ch.packOffer)return false;ch.packOffer=null;return true}
  /* 고정 카드(E.G.O 전용)는 덱에서 뺄 수 없다. 예전 판에서 카드함으로 빠진 고정 카드는 덱으로 돌려놓고, 덱이 넘치면 일반 카드가 카드함으로 간다 */
  function repairFixed(ch){
    const sd=ch.side||[];
    for(let i=sd.length-1;i>=0;i--)if(D.cards[sd[i]]&&D.cards[sd[i]].fixed){ch.deck.push(sd[i]);sd.splice(i,1)}
    while(ch.deck.length>deckMax(ch)){const k=ch.deck.map(id=>D.cards[id].fixed).lastIndexOf(false);if(k<0)break;(ch.side=ch.side||[]).push(ch.deck.splice(k,1)[0])}
  }
  /* 예전 판: 재능·성장기의 피해 최소 효과가 장비를 낄 때 지워져 있었다. 처음 한 번만 그 출처(재능·성장기)를 세어 되돌린다 */
  /* 날개 대표·날개 소속·손가락은 해결사를 겸할 수 없다: 예전 규칙이나 해고 뒤 등록으로 등록된 채 남아 있으면 반납한다 */
  function repairFixer(ch){if(ch.licensed&&noFixer(ch)){ch.licensed=false;ch.title=ch.titleKind==='color'?null:ch.title}}
  function repairDmin(ch){
    const s=ch.stats;if(s.dminUp!==undefined)return;
    s.dminUp=[ch.t,...(ch.kid||[]).map(k=>k.x)].filter(x=>x&&x.fx&&(x.fx.dminUp||x.n==='타고난 완력'||x.n==='어깨너머 손질')).length;
    s.dmin=calcDmin(ch);
  }
  function autoOffers(ch){
    if(ch.packOffer)acceptPack(ch);
    while((ch.picks||[]).length)pickTake(ch,0);
    while((ch.offers||[]).length){if(deckRoom(ch))takeOffer(ch,0,'deck');else dropOffer(ch,0)}
    while((ch.gearOffers||[]).length)resolveGear(ch,0,true);
  }
  /* ===== 6시즌: 내 사무소 =====
     5급 이상 해결사가 운 판정(1d100 ≥ 55)에 성공하면 이름(1~12글자) + '사무소'로 차린다.
     전문 분야(키워드)를 고르면 3년마다(공방 거리) 그 키워드의 카드나 의수를 알선해 준다 */
  /* 이름 입력 규칙(공용): 한글·영문·숫자·일본어(히라가나·가타카나·한자) 1~CFG.nameMax글자 (특색은 2~). 띄어쓰기는 space일 때만 */
  const NAME_CH=/^[가-힣A-Za-z0-9\u3040-\u30ff\u4e00-\u9fff\uff66-\uff9f\u3005\uff10-\uff19\uff21-\uff3a\uff41-\uff5a\u3000 ]+$/,HANGUL=/[가-힣]/;
  function nameErr(raw,o={}){
    const max=CFG.nameMax,min=o.min||1,w=(raw||'').trim(),lim=max;
    const bad=!w||(!o.space&&/\s/.test(w))||!NAME_CH.test(w)||!w.replace(/\s/g,'')||[...w].length<min||[...w].length>lim;
    return bad?`${min}~${max}글자로 적어 주세요 (한글·영문·숫자·일본어${o.space?'':', 띄어쓰기 없이'})`:null;
  }
  const OKW={bleed:'출혈',rupture:'파열',breath:'호흡',burn:'화상'};
  const canFound=ch=>ch.licensed&&ch.rank<=CFG.office.rank&&!ch.job&&!noFixer(ch)&&!ch.officePick&&(!ch.aff||(ch.aff.type==='office'&&!ch.aff.own)||(isWs(ch)&&!ch.office));
  function officeNameErr(n){
    {const e=nameErr(n);if(e)return e}
    if((D.offices||[]).some(o=>o.n===n+' 사무소'))return '이미 있는 사무소 이름이다';
    return null;
  }
  function setOffice(ch,name,kw){
    if(officeNameErr(name)||!OKW[kw])return false;
    if(isWs(ch)){ch.office={name:name+' 사무소',kw,tier:0,ws:true};ch.officePick=false;return true}
    ch.office={name:name+' 사무소',kw,tier:0};ch.aff={type:'office',name:ch.office.name,own:true};ch.officePick=false;return true;
  }
  const officeCards=kw=>[...new Set([...D.rewards,'rustnote','tknife','supper','faint','o_ember','o_blaze','o_stance'])].filter(id=>D.cards[id]&&(D.cards[id].kw||[]).some(k=>k[0]===kw));
  function officeBroker(ch){
    const O=ch.office;if(!O||!ch.aff||!(ch.aff.own||(O.ws&&isWs(ch))))return null;
    const tier=ch.title||ch.rank<=1?3:ch.rank<=3?2:1,gs=(D.officeGear||{})[O.kw]||[];
    if((O.tier||0)<tier&&gs[tier-1]){O.tier=tier;const g=gs[tier-1];offerGear(ch,Object.assign({id:`office_${O.kw}${tier}`,grade:tier+2},g));return {kind:'gear',n:g.n}}
    const all=officeCards(O.kw),fresh=all.filter(id=>!ownsCard(ch,id)),cid=one(fresh.length?fresh:all);if(!cid)return null;
    addCard(ch,cid,null,null,true);return {kind:'card',n:D.cards[cid].n,locked:!!ch.deckLocked};
  }
  /* 암시장 카드 상자: 테마(디버프·버프)를 고르면 그 테마 카드 하나가 무작위로 나온다 */
  const boxPool=theme=>D.rewards.filter(id=>{const c=D.cards[id],kw=c.kw||[];
    return theme==='debuff'?kw.some(k=>k[2]!=='s'):(c.t==='buff'||c.t==='def'||kw.some(k=>k[2]==='s'))});
  function cardBox(ch,theme){
    const B=CFG.blackCard;if(ch.money<B.price||ch.deckLocked||ch.cardMoney)return null;
    const all=boxPool(theme);if(!all.length)return null;
    ch.money-=B.price;const r=offerPick(ch,all,null,'상자');return r;
  }
  /* 암시장 응급 카드: 같은 카드를 덱·카드함·제안 합쳐 max장까지 살 수 있다 */
  const aidCount=(ch,id)=>[...ch.deck,...(ch.side||[]),...(ch.offers||[])].filter(x=>x===id).length;
  function buyAid(ch,id){const B=CFG.blackAid,p=B.price[id];if(!p||ch.deckLocked||ch.cardMoney||ch.money<p||aidCount(ch,id)>=B.max)return false;ch.money-=p;(ch.offers=ch.offers||[]).push(id);return true}
  /* 공방 치유소: 돈을 내고 HP를 회복한다 (방문마다 CFG.clinic.max번) */
  const clinicPrice=ch=>CFG.clinic.price+CFG.clinic.step*(ch.healBought||0);
  function buyHeal(ch){
    const K=CFG.clinic,p=clinicPrice(ch);if(ch.money<p||ch.hp>=ch.stats.maxHp)return 0;
    const h=Math.min(K.hp,ch.stats.maxHp-ch.hp);ch.money-=p;ch.hp+=h;ch.healBought=(ch.healBought||0)+1;return h;
  }
  /* ===== 소모품(소지품): 지혈대·붕대 / 도시 음식 / 진정제. 종류마다 CFG.supply.max개까지 ===== */
  const supplyName=(ch,id)=>id==='snack'?(ch.hw?'회복환':lakeOn(ch)?'생선구이':'꼬치'):CFG.supply.items[id].n;
  const supplyCount=ch=>Object.values(ch.supply||{}).reduce((a,b)=>a+(b||0),0);
  const supplyPrice=(ch,id)=>{const K=CFG.supply,it=K.items[id];return it?Math.min(K.priceMax,it.price+Math.floor((ch.year||0)/K.priceEvery)*K.priceStep):0};
  /* 배 내구도: 선장이 되면 배를 얻는다. 전투마다 닳고 항구에서 돈으로 고친다. 0이 되면 침몰 */
  const hullOf=ch=>{const L=ch.lake||{};return L.hull==null?CFG.lake.hullMax:L.hull};
  function hullLose(ch,n,chips){const L=ch.lake=ch.lake||{};L.hull=Math.max(0,hullOf(ch)-n);chips.push(`배 내구도 -${n} (남은 ${L.hull}/${CFG.lake.hullMax})`);if(L.hull<=0){ch.sunk=true;chips.push('배가 가라앉는다')}}
  function repairHull(ch){const K=CFG.lake;if(!ch.lake||!ch.lake.captain||hullOf(ch)>=K.hullMax||ch.money<K.repairCost)return false;ch.money-=K.repairCost;ch.lake.hull=K.hullMax;return true}
  function buySupply(ch,id){const K=CFG.supply,it=K.items[id],p=supplyPrice(ch,id);if(!it||ch.money<p||((ch.supply||{})[id]||0)>=K.max)return false;ch.money-=p;(ch.supply=ch.supply||{})[id]=((ch.supply||{})[id]||0)+1;return true}
  /* 쓸 수 있으면 결과 문장, 아니면 null. 전투 중이면 C를 넘기고(HP는 전투 중 값에 더한다) 라운드마다 한 번만 쓴다 */
  function useSupply(ch,id,C){
    const it=CFG.supply.items[id];if(!it||!((ch.supply||{})[id]>0)||ch.distForm&&it.mind)return null;
    const P=C&&!C.over?C.P:null;if(C&&C.over)return null;if(P&&C.supplyRound===C.round)return null;
    const hp=P?P.hp:ch.hp,mx=P?P.maxHp:ch.stats.maxHp,bleed=P?(P.bleed||0)>0:false;
    const needHp=it.hp&&hp<mx,needMind=it.mind&&ch.mind<mindMax(ch);
    if(!needHp&&!needMind&&!(it.bleed&&bleed))return null;
    ch.supply[id]--;const out=[];
    if(it.hp){const h=Math.min(it.hp,mx-hp);if(h>0){if(P)P.hp+=h;else ch.hp+=h;out.push('HP +'+h)}}
    if(it.mind){const g=gainMind(ch,it.mind);if(g)out.push('정신력 +'+g)}
    if(it.bleed&&P&&P.bleed>0){out.push('출혈 해제');P.bleed=0}
    if(P)C.supplyRound=C.round;
    return `${supplyName(ch,id)} 사용 · ${out.join(' · ')||'효과 없음'}`;
  }
  /* 공방 치유소 · 마음 치료: 돈을 내고 정신력을 회복한다 (뒤틀린 몸은 마음을 쓰지 못해 받을 수 없다) */
  const mindClinicPrice=ch=>CFG.clinic.mindPrice+CFG.clinic.mindStep*(ch.mindBought||0);
  function buyMind(ch){
    const K=CFG.clinic,p=mindClinicPrice(ch);if(ch.distForm||ch.money<p||ch.mind>=mindMax(ch))return 0;
    const g=gainMind(ch,K.mind);if(g<=0)return 0;ch.money-=p;ch.mindBought=(ch.mindBought||0)+1;return g;
  }
  /* 암시장 K사 엠플: 전투 중 HP가 below 이하가 되면 자동으로 쓰여 HP를 heal 회복한다 (전투마다 1개). 최대 carry개, 무한 모드 뒤엔 값이 오른다 */
  const ampPrice=ch=>ch.infinite?CFG.ample.priceInf:CFG.ample.price;
  function buyAmple(ch){
    const K=CFG.ample;if(ch.hw&&!ch.hw.out&&!ch.hw.done)return false;if((ch.ample||0)>=K.carry||((ch.ampleBought||0)>=K.limit&&!ch.infinite)||ch.money<ampPrice(ch))return false;
    ch.money-=ampPrice(ch);ch.ample=(ch.ample||0)+1;ch.ampleBought=(ch.ampleBought||0)+1;return true;
  }
  /* 공방 등급: 기본 → 소속 → 해결사 급수 보너스 */
  function shopAccess(ch){
    const A=D.access;let g=A.base;
    if(ch.aff&&A.aff[ch.aff.type])g=Math.max(g,A.aff[ch.aff.type]);
    /* H사 홍원 가문은 가문의 저잣거리에서 협력 공방 등급까지 이용한다 */
    if(ch.hw)g=Math.max(g,2);
    /* 대호수로 나간 자는 U사의 항구에서 협력 공방 등급까지 이용한다 (항구에는 1·2등급 가게만 있다) */
    if(ch.flags&&ch.flags.lake)g=Math.max(g,2);
    /* 직접 날개를 세운 대표는 소속(aff)이 없어도 날개 최고 직급과 같은 대접 */
    if(isFounder(ch))g=Math.max(g,A.aff.wing);
    const fingerUp=isFinger(ch)&&ch.fr&&ch.fr.tier>=D.fingerRules.shopTier;
    /* 협회·날개처럼 직급표가 있는 진로는 해결사 급수가 오르지 않으므로, 최고 직급(날개 임원 등)에 오르면 급수 보너스와 같은 +1 */
    const CR_=D.careers&&ch.aff&&D.careers[ch.aff.type],topRank=isFounder(ch)||!!(CR_&&CR_.ranks&&ch.fi!=null&&ch.fi>=CR_.ranks.length-1);
    if((ch.licensed&&ch.rank<=A.rankBonus.rank)||fingerUp||topRank)g=Math.min(3,g+A.rankBonus.plus);
    /* 홍원의 자제가 가문 밖(외부 임무·가주 이후)에서 공방 거리에 들르면 1급 대접: 최고 등급(명장의 공방)까지 이용한다 */
    if(ch.hw&&(ch.hw.out||ch.hw.done))return A.max;
    /* 최상위 명장의 공방: 해결사 1급 이상이거나 진로 최고 직위(1급 대접)일 때만. 항구·저잣거리(대호수·홍원)에는 없다 */
    if(!ch.hw&&!(ch.flags&&ch.flags.lake)&&rankMet(ch,A.top))g=A.max;
    return g;
  }
  /* 살 수 있는지: 'ok' / 'locked'(등급) / 'money' / 'owned' */
  function canBuy(ch,id){
    const it=D.items[id];
    if(it.hw&&!(ch.hw&&!ch.hw.out&&!ch.hw.done))return 'locked';
    if(it.lake&&!(ch.flags&&ch.flags.lake))return 'locked';   // 항구 전용 물건은 대호수 출신만
    if(it.tool){const L=ch.lake||{};if(!(L.seenLakes||[]).includes(it.tool))return 'locked';if(((L.tools||{})[it.tool]||0)>=2)return 'owned';if(ch.money<priceOf(ch,id))return 'money';return 'ok'}   // 호수 방지 도구: 그 호수의 소문을 듣고 나서, 최대 2개
    if(it.hw&&(ch.hwGot||[]).includes(id))return 'owned';
    if(ch.gear[it.slot]&&ch.gear[it.slot].id===id)return 'owned';
    if(ch.distForm&&!ch.distStable)return 'distort';
    if(it.slot==='aug'&&isN(ch))return 'nwing';
    if(inStash(ch,id))return 'stash';
    if(it.grade>shopAccess(ch)&&!it.hw)return 'locked';
    if(ch.money<priceOf(ch,id))return 'money';
    return 'ok';
  }
  /* 공방 해결사: 공방 물건 할인, 보관함 장비 판매 */
  const WF=CFG.workshopFixer;
  const isWs=ch=>!!ch.aff&&ch.aff.type==='workshop';
  const priceOf=(ch,id)=>{const p=D.items[id].price,up=1+(CFG.ws.priceUp||0)*((ch.ws&&ch.ws.used&&ch.ws.used[id])||0);return Math.round(isWs(ch)?p*(1-WF.discount)*up:p*up)};
  const sellValue=it=>it.id==='hidmat'?WF.sellBase*2:(it.grade>=5&&!(D.items[it.id]||D.special[it.id]))?WF.hiddenSell+WF.hiddenSellPer*(it.lvl||it.egoLv||0):Math.floor((it.price||(D.items[it.id]&&D.items[it.id].price)||(D.special[it.id]&&D.special[it.id].price)||WF.sellBase)*WF.sell);
  /* 공방 해결사: 장비 판매는 없다. 대신 덱의 카드를 공방에 넘긴다 (덱 고정·전용 카드팩·고정 카드는 팔 수 없고, 덱은 minDeck장 아래로 줄이지 않는다) */
  const cardPrice=id=>WF.cardBase+WF.cardPer*((D.cards[id]&&D.cards[id].c)||0);
  function sellCard(ch,i){
    const id=ch.deck[i];
    if(!isWs(ch)||ch.deckLocked||ch.cardMoney||!id||D.cards[id].fixed||ch.deck.length<=CFG.shop.minDeck)return null;
    const v=cardPrice(id);ch.deck.splice(i,1);ch.money+=v;return {id,v};
  }
  /* 암시장: 영구 강화(한 번만)와 특수 장비 */
  function canBuySpecial(ch,id){
    const it=D.special[id];
    if(it.perm?(ch.perms||[]).includes(id):(ch.gear[it.slot]&&ch.gear[it.slot].id===id))return 'owned';
        if(!it.perm&&ch.distForm&&!ch.distStable)return 'distort';
    if(it.slot==='aug'&&isN(ch))return 'nwing';
    if(!it.perm&&inStash(ch,id))return 'stash';
    if(ch.money<it.price)return 'money';
    return 'ok';
  }
  function buySpecial(ch,id,offer){
    if(canBuySpecial(ch,id)!=='ok')return false;
    const it=D.special[id];ch.money-=it.price;
    if(it.perm){(ch.perms=ch.perms||[]).push(id);addStats(ch.stats,it.fx);if(it.fx.maxHp)ch.hp+=it.fx.maxHp}
    else if(offer)offerGear(ch,Object.assign({id,grade:4},it));else equip(ch,Object.assign({id,grade:4},it));
    return true;
  }
  function buy(ch,id,offer){
    if(canBuy(ch,id)!=='ok')return false;
    const it=D.items[id];ch.money-=priceOf(ch,id);if(it.tool){const L=ch.lake=ch.lake||{};(L.tools=L.tools||{})[it.tool]=((L.tools||{})[it.tool]||0)+1;return true}if(it.hw)(ch.hwGot=ch.hwGot||[]).push(id);if(it.perm){addStats(ch.stats,it.fx);if(it.fx.maxHp)ch.hp+=it.fx.maxHp;return true}if(offer)offerGear(ch,Object.assign({id},it));else equip(ch,Object.assign({id},it));return true;
  }
  /* 금전운: 버는 돈 +20% */
  const earn=(ch,n)=>n>0&&hasInn(ch,'fortune')?Math.round(n*CFG.innate.money):n;
  /* 성장력: 레벨 업 성장 능력치 1.2배 (소수점은 쌓아 두었다가 1이 되면 오른다) */
  function applyGrowth(ch,fx){
    const r=applyFx(ch,fx);
    if(hasInn(ch,'growth')){const acc=ch.growAcc=ch.growAcc||{},ex={};
      for(const [k,v] of Object.entries(fx))if(typeof v==='number'&&v>0&&k in ch.stats){acc[k]=(acc[k]||0)+v*(CFG.innate.growMul-1);const n=Math.floor(acc[k]+1e-9);if(n>0){acc[k]-=n;ex[k]=n}}
      if(Object.keys(ex).length){addStats(ch.stats,ex);if(ex.maxHp)ch.hp+=ex.maxHp;r.chips.push('성장력 · '+Object.entries(ex).map(([k,v])=>k+'+'+v).join(' '))}}
    return r;
  }
  /* 해마다 들어오는 돈: 소속 봉급 + 해결사 급수 수당 */
  const income=ch=>(D.money.salary[ch.aff?ch.aff.type:'none']||0)+(ch.licensed?(T.rankStart-ch.rank)*D.money.rankSalary:0)
    +(isFinger(ch)&&ch.fr?(ch.fr.tier-1)*D.fingerRules.salaryPerTier:0)+(ch.pinky?D.pinky.money:0);
  const money=n=>n.toLocaleString('ko-KR')+D.money.unit;
  function setColor(ch,ci){ch.ci=ci;ch.color=D.colors[ci].hex}
  /* 자격 등록: 가장 낮은 급수에서 시작한다. 특색은 여기서 주지 않는다 */
  /* 동부 외곽 출신이 N사 날개에 들어가면 해결사 자격을 지키고, N사 승진마다 해결사 급수도 함께 오른다 */
  const eastN=ch=>isN(ch)&&isEastOuter(ch);
  /* 동부 외곽의 N사 직급과 해결사 급수를 맞춘다: 직급에 맞는 급수보다 낮으면(숫자가 크면) 그 급수까지 올린다 */
  const alignOf=ch=>lakeOn(ch)?CFG.lake.align:CFG.eastN.align;
  function alignEast(ch,chips){if(!(eastN(ch)||lakeOn(ch))||!ch.licensed||ch.fi==null)return;const tgt=alignOf(ch)[ch.fi]??9;while(ch.rank>Math.max(tgt,T.rankTop)){const p=promote(ch);chips.push(...p.chips)}}
  /* ===== 공방 해결사의 작업대: 전용 무기·방어구·의수를 보관함 장비를 녹여 끝없이 강화한다 ===== */
  const WS=CFG.ws,wsKey=sl=>sl==='weapon'?'w':sl==='armor'?'a':'g';
  const wsNeed=n=>1+Math.floor(n/WS.needEvery);
  /* 일반 재료: 공방 물건이거나 등급이 4 이하. 히든 재료: 그 밖의 전리품·유물 (5등급 이상이나 등급이 없는 전용 장비) */
  const wsHidden=m=>!(D.items&&D.items[m.id])&&!((m.grade||0)>=1&&(m.grade||0)<=4)&&!(m.id==='birth'||m.n==='맨손');
  function wsItem(ch,slot){
    const w=ch.ws,k=w[wsKey(slot)];
    const nmOf=d=>(w.names&&w.names[slot])||d,B_=WS.big;
    /* 특수 강화: 5·10·15단계에 닿은 만큼의 보너스를 합친다 */
    const tiers=n=>B_.at.map((t,i)=>n>=t?i:-1).filter(i=>i>=0),bigFx=(sl,n)=>{const o={};for(const i of tiers(n))for(const [x,v] of Object.entries(B_[sl][i]))o[x]=(o[x]||0)+v;return o};
    if(slot==='weapon'){const C_=WS.weapon,bf=bigFx('weapon',k.n),atk=C_.base.atk+k.n*C_.normal.atk+(bf.atk||0)+k.h*(C_.hidden.atk||0),dmg=k.h*C_.hidden.dmgB+(bf.dmgB||0),spd=(C_.base.spd||0)+(bf.spd||0),bg=tiers(k.n).length;
      return {id:'ws_weapon',slot,n:nmOf(C_.n),grade:4,e:`공+${atk}${spd?` · 속도+${spd}`:''}${dmg?` · 피해+${dmg}`:''} · 피해 d${C_.dice[1]} · 강화 ${k.n}단계${k.h?' · 히든 '+k.h:''}${bg?` · 특수 강화 ${bg}/${B_.at.length}`:''}`,fx:{atk,spd,dmgB:dmg},wx:{dice:C_.dice.slice()}}}
    if(slot==='armor'){const C_=WS.armor,bf=bigFx('armor',k.n),hp=C_.base.maxHp+k.n*C_.normal.maxHp+(bf.maxHp||0)+k.h*(C_.hidden.maxHp||0),rg=bf.regen||0,dr=k.h*C_.hidden.dr+(bf.dr||0),eva=k.h*C_.hidden.eva,bg=tiers(k.n).length;
      return {id:'ws_armor',slot,n:nmOf(C_.n),grade:4,e:`HP+${hp}${rg?` · 라운드마다 HP+${rg}`:''}${dr?` · 받는 피해 −${dr}%`:''}${eva?` · 회피+${eva}`:''} · 강화 ${k.n}단계${k.h?' · 히든 '+k.h:''}${bg?` · 특수 강화 ${bg}/${B_.at.length}`:''}`,fx:{maxHp:hp,dr,eva,regen:rg}}}
    const A_=WS.aug,g=w.g,fx=Object.assign({},A_.base),pk=g.picks||[];
    fx.hit=(fx.hit||0)+(g.n||0)*A_.normal.hit+(g.h||0)*A_.hidden.hit;fx.eva=(fx.eva||0)+(g.h||0)*(A_.hidden.eva||0);
    for(const x of pk)fx[x]=(fx[x]||0)+A_.pickAmt[x];
    if(g.pick)fx[g.pick]=(fx[g.pick]||0)+A_.pick;
    const cu=w.cust&&w.cust.done?w.cust:null;
    if(cu){if(cu.atk)fx.atk=(fx.atk||0)+cu.atk*WS.cust.atkPer;if(cu.eva)fx.eva=(fx.eva||0)+cu.eva;if(cu.hp)fx.maxHp=(fx.maxHp||0)+cu.hp*WS.cust.hpPer}
    return {id:'ws_aug',slot,n:nmOf(A_.n),grade:4,e:Object.entries(fx).filter(([x,v])=>v).map(([x,v])=>`${A_.stats[x]||(x==='spd'?'속도':x==='maxHp'?'최대 HP':x)}+${v}`).join(' · ')+` · 강화 ${g.n||0}단계${g.h?' · 히든 '+g.h:''}${pk.length?` · 선택 ${pk.length}/${B_.at.length}`:''}${g.pend?` · 고를 수 있는 선택 ${g.pend}`:''}${cu&&cu.pas?` · 커스텀 패시브 ${WS.cust.pass[cu.pas].n}`:''}`,fx}
  }
  /* 공방 해결사가 되면 전용 무기·방어구·의수를 받는다. 쥐고 있던 무기·방어구·의수는 보관함으로 가서 재료가 된다 */
  function wsOpen(ch,chips){
    if(ch.ws)return;
    ch.ws={y:ch.year||0,ups:0,w:{n:0,h:0,p:0},a:{n:0,h:0,p:0},g:{pick:null,n:0,p:0,h:0,picks:[],pend:0}};
    for(const sl of ['weapon','armor','aug']){const it=wsItem(ch,sl);equip(ch,it);chips&&chips.push(`첫 공방 개설 · ${it.n} (${it.e})`)}
    chips&&chips.push('전용 무기·방어구·의수는 빼거나 바꿀 수 없다 · 다른 장비는 녹여서 재료로 쓴다');
  }
  /* 전용 장비 이름 짓기: 12자까지, 비우면 기본 이름으로 돌아간다 */
  function wsRename(ch,slot,name){
    const cur=ch.gear[slot];if(!ch.ws||!isWs(ch)||!cur||cur.id!=='ws_'+slot)return null;
    const nm=String(name||'').replace(/\s+/g,' ').trim().slice(0,12);
    ch.ws.names=ch.ws.names||{};if(nm)ch.ws.names[slot]=nm;else delete ch.ws.names[slot];
    equip(ch,carryTune(cur,wsItem(ch,slot)));ch.stash=(ch.stash||[]).filter(x=>x!==cur);return ch.gear[slot].n;
  }
  /* 예전 저장(의수 유형이 있던 판)과 공방 해결사가 된 뒤 처음 들어오는 경우를 맞춘다 */
  function wsEnsure(ch){
    if(!isWs(ch))return;
    if(!ch.ws){wsOpen(ch,[]);return}
    if(!ch.ws.g||!('pick' in ch.ws.g)){ch.ws.g={pick:null};}
    {const g=ch.ws.g;g.n=g.n||0;g.p=g.p||0;g.h=g.h||0;g.picks=g.picks||[];g.pend=g.pend||0}
    for(const sl of ['weapon','armor','aug'])if(!ch.gear[sl]||ch.gear[sl].id!=='ws_'+sl)equip(ch,wsItem(ch,sl));
  }
  /* 의수는 히든 의수 하나로 한 번만 개조한다: 공격·회피·명중 중 하나를 올린다 */
  const wsAugOk=(ch,m)=>false;
  function wsAugPick(ch,i,stat){
    const st=ch.stash||[],m=st[i];if(!wsAugOk(ch,m)||!WS.aug.stats[stat]||(ch.distForm&&!ch.distStable))return null;
    st.splice(i,1);ch.ws.g.pick=stat;ch.ws.ups++;
    const cur=ch.gear.aug;equip(ch,wsItem(ch,'aug'));if(cur)ch.stash=ch.stash.filter(x=>x!==cur);
    return {m:m.n,stat};
  }
  /* 커스텀 의수: 포인트를 공격·회피·체력·패시브에 나눠 한 번 만든다 */
  function wsCustom(ch,o){
    const K=WS.cust,w=ch.ws;if(!w||!isWs(ch)||(w.cust&&w.cust.done)||(ch.distForm&&!ch.distStable))return null;
    const atk=Math.max(0,o.atk|0),eva=Math.max(0,o.eva|0),hp=Math.max(0,o.hp|0),pas=o.pas&&K.pass[o.pas]?o.pas:null;
    const used=atk*K.atkCost+eva*K.evaCost+hp*K.hpCost+(pas?K.passCost:0);if(used>K.pts||used<=0)return null;
    w.cust={atk,eva,hp,pas,done:true,used};const cur=ch.gear.aug;equip(ch,carryTune(cur,wsItem(ch,'aug')));if(cur)ch.stash=(ch.stash||[]).filter(x=>x!==cur);return {used,atk,eva,hp,pas}
  }
  /* 의수 선택: 5·10·15단계에 닿으면 공격·회피·명중 중 하나를 고른다 */
  function wsAugChoose(ch,stat){
    const g=ch.ws&&ch.ws.g;if(!g||!isWs(ch)||!(g.pend>0)||!WS.aug.pickAmt[stat]||(ch.distForm&&!ch.distStable))return null;
    g.pend--;(g.picks=g.picks||[]).push(stat);const cur=ch.gear.aug;equip(ch,carryTune(cur,wsItem(ch,'aug')));if(cur)ch.stash=(ch.stash||[]).filter(x=>x!==cur);return {stat,amt:WS.aug.pickAmt[stat]};
  }
  /* 보관함 장비 하나를 녹여 장착 중인 전용 무기·방어구를 강화한다. 무기는 무기, 방어구는 방어구만 재료가 된다 */
  function wsMelt(ch,slot,i){
    const w=ch.ws,st=ch.stash||[],m=st[i],cur=ch.gear[slot];
    const mat=!!m&&m.id==='hidmat';
    if(!w||!isWs(ch)||!cur||cur.id!=='ws_'+slot||!m||isBare(m)||(!mat&&((m.id&&String(m.id).startsWith('ws_'))||m.slot!==slot))||(ch.distForm&&!ch.distStable))return null;
    const k=w[wsKey(slot)],hid=wsHidden(m);let step=0;
    st.splice(i,1);
    if(D.items&&D.items[m.id]){w.used=w.used||{};w.used[m.id]=(w.used[m.id]||0)+1}
    if(hid){k.h++;step=1}else{k.p++;if(k.p>=wsNeed(k.n)){k.p=0;k.n++;step=1}}
    if(step)w.ups++;
    if(slot==='aug'&&step&&!hid&&WS.big.at.includes(k.n))k.pend=(k.pend||0)+1;
    equip(ch,carryTune(cur,wsItem(ch,slot)));ch.stash=ch.stash.filter(x=>x!==cur);
    return {hidden:hid,step,n:k.n,h:k.h,p:k.p,need:wsNeed(k.n),m:m.n};
  }
  const noFixer=ch=>!!ch.hw||isFinger(ch)||isFounder(ch)||(!!ch.aff&&((ch.aff.type==='wing'&&!eastN(ch))||ch.aff.type==='head'));
  function license(ch){
    /* 손가락 조직원·날개 직원은 해결사로 등록될 수 없다 */
    if(ch.licensed||noFixer(ch))return false;
    const s=ch.stats;
    const c=sample([['atk',s.atk],['eva',s.eva],['spd',s.spd],['hp',(s.maxHp-CFG.baseHp)/4]],4);
    let best=c[0];for(const x of c)if(x[1]>best[1])best=x;
    ch.licensed=true;ch.rank=T.rankStart;ch.dom=best[0];
    return true;
  }
  /* 승급: 급수가 2 오르고 가장 높은 능력치가 한 단계 자란다.
     최고 급수(CFG.colorRank)에 오른 순간 특출 판정(1d100 + 판정 보정 ≥ CFG.colorDc)을 넘으면
     색 + 가장 높은 능력치의 단어로 특색을 받는다 */
  /* 승급: 한 번에 1급, 가장 높은 능력치가 한 단계 자란다. 특색은 1급에서 열리는 특색 심사로만 */
  function promote(ch){
    ch.rank=Math.max(T.rankTop,ch.rank-1);
    const k=ch.dom,s=ch.stats,chips=[T.promote+' · '+ch.rank+T.rankUnit];
    if(k==='hp'){s.maxHp+=4;ch.hp+=4;chips.push('최대 HP +4')}else{s[k]+=1;chips.push(STAT[k]+' +1')}
    return {chips};
  }
  /* ===== 승급 포인트와 심사 =====
     전투 승리·판정 성공으로 포인트가 쌓이고, 필요량에 닿으면 승급 심사 사건이 열린다 */
  /* 진로: 손가락 > 협회 > 날개 > 해결사(등록) 순으로 판단. 진로마다 단계 수가 달라도
     최고 단계까지 필요한 포인트 총량(CFG.promo.total)은 같게 기본값을 나눈다 */
  const CR=D.careers||{};
  /* 날개를 세운 사람은 그 날개의 대표다: 입사한 회사의 승진 체계에서 벗어난다 */
  const isFounder=ch=>!!(ch.corp&&ch.corp.wing);
  function career(ch){
    if(isFounder(ch))return null;
    if(isFinger(ch))return 'finger';
    if(ch.aff&&CR[ch.aff.type]&&CR[ch.aff.type].ranks)return ch.aff.type;
    return ch.licensed?'fixer':null;
  }
  function steps(k,ch){
    if(k==='fixer')return T.rankStart-T.rankTop;
    if(k==='finger')return D.fingers[ch.aff.name].ranks.length-1;
    return k?CR[k].ranks.length-1:0;
  }
  const multAt=i=>CFG.promo.mult[Math.min(i,CFG.promo.mult.length-1)];
  /* 지금까지 오른 단계 수. 해결사는 실제 급수로 센다 (사무소에 들어가면 promos가 0으로 돌아가도 급수는 남으므로) */
  /* 손가락은 시험 말고도 서열이 오른다(의리 순례 등): 지금 서열(fi)로 센다. 승진 횟수로 세면 큰형님인데도 승급 시험이 계속 뜬다 */
  const promoDone=ch=>career(ch)==='fixer'?Math.max(0,T.rankStart-(ch.rank||T.rankStart)):career(ch)==='finger'?(ch.fi||0):(ch.promos||0);
  function promoNeed(ch){
    const k=career(ch),n=Math.max(1,steps(k,ch));let sum=0,m=1;
    for(let i=0;i<n;i++){sum+=m;m*=multAt(i)}
    let need=CFG.promo.total*(k==='fixer'?CFG.promo.fixerMul:(CR[k].totalMul||1)*(k==='finger'&&D.fingers[ch.aff.name].promoMul||1))/sum;
    for(let i=0;i<promoDone(ch);i++)need*=multAt(i);
    return Math.round(need);
  }
  const canPromote=ch=>{const k=career(ch);return !!k&&promoDone(ch)<steps(k,ch)};
  const ptsName=ch=>{const k=career(ch);return k&&CR[k]?CR[k].pts:T.promoPoints};
  const examReady=ch=>canPromote(ch)&&(ch.pp||0)>=promoNeed(ch);
  const examDc=ch=>{const k=career(ch),n=Math.max(1,steps(k,ch));return Math.round(CFG.promo.examDc+CFG.promo.examDcSpan*promoDone(ch)/n)};
  function addPts(ch,n,chips){
    const k=career(ch);if(!n||!k)return;
    n=Math.round(n*((CR[k]&&CR[k].gainMul)||1));ch.pp=(ch.pp||0)+n;
    if(canPromote(ch))chips.push(`${ptsName(ch)} +${n} (${ch.pp}/${promoNeed(ch)})`);
    /* 무한 모드: 도시가 모두 적대적이라 격식을 차린 심사는 열리지 않는다. 포인트가 차면 전공으로 바로 승급하고,
       최고 직위에 오른 뒤에는 포인트가 연륜 단계로 바뀐다 (단계마다 능력치 +1, 최대 legacyMax) */
    if(ch.infinite){
      let g=0;
      while(canPromote(ch)&&(ch.pp||0)>=promoNeed(ch)&&g++<4){const need=promoNeed(ch),p=promoteAny(ch);if(!p)break;
        chips.push('전공 승급 · 적대적인 도시에서는 심사 대신 싸워 이긴 만큼이 직위가 된다');chips.push(...p.chips);ch.pp=Math.max(0,(ch.pp||0)-need);ch.promos=(ch.promos||0)+1;ch.strikes=0}
      const IL=CFG.infinite;
      if(!canPromote(ch)&&IL.legacyNeed){
        ch.legacyPts=(ch.legacyPts||0)+n;
        while(ch.legacyPts>=IL.legacyNeed&&(ch.legacyTier||0)<IL.legacyMax){
          ch.legacyPts-=IL.legacyNeed;ch.legacyTier=(ch.legacyTier||0)+1;const s_=ch.stats,dm=ch.dom;
          if(dm==='hp'||!dm){s_.maxHp+=4;ch.hp+=4;chips.push(`연륜 ${ch.legacyTier}단계 · 최대 HP +4`)}else{s_[dm]+=1;chips.push(`연륜 ${ch.legacyTier}단계 · ${STAT[dm]} +1`)}}
        if((ch.legacyTier||0)>=IL.legacyMax)ch.legacyPts=0;
      }
    }
  }
  /* 협회·날개 직급: 단계마다 그 직급의 보정을 더한다 (손가락 fingerStep과 같은 방식) */
  function careerStep(ch){
    const C_=CR[ch.aff.type],RK=ch.wtrain&&ch.aff.name==='W사 날개'&&C_.trainRanks||C_.ranks,r=RK[(ch.fi??-1)+1];if(!r)return null;
    ch.fi=(ch.fi??-1)+1;ch.fr=r;addStats(ch.stats,r.fx);
    /* W사 열차 직원: 직급이 오를 때마다 무기가 바뀐다 (이전 무기는 보관함으로) */
    {const wf=ch.wtrain&&ch.wFam&&D.warpWeapons&&D.warpWeapons[ch.wFam];if(wf&&wf[ch.fi]){equipUp(ch,structuredClone(wf[ch.fi]));}else if(r.gear&&!ch.wPick)equipUp(ch,structuredClone(r.gear))}if(r.fx.maxHp)ch.hp+=r.fx.maxHp;
    if(ch.wtrain&&ch.aff.name==='W사 날개'){if(r.gear2)equipUp(ch,structuredClone(r.gear2));warpRankCards(ch,r)}
    /* 협회 직급에 맞는 해결사 급수 (예: 지부장은 최소 4급) */
    if(r.minRank&&ch.licensed&&ch.rank>r.minRank)ch.rank=r.minRank;
    const out=[`${ch.aff.name} · ${r.n}`,...(r.e?[r.e]:[])];
    if(r.money){const m=earn(ch,r.money);ch.money+=m;out.push('승진 보너스 +'+money(m))}
    giveOrgCards(ch,C_,ch.fi,out);
    if(lakeOn(ch)&&C_.rows)lakeCards(ch,C_.rows[ch.fi],out,'승급');
    /* 보조 해결사 칭호: 직책(선원 직위)과 따로 받아 함께 보너스를 주는 칭호. 갑판장이 되면 얻는다 */
    if(lakeOn(ch)&&ch.fi===2){ch.titles=ch.titles||[];if(!ch.titles.includes('보조 해결사')){ch.titles.push('보조 해결사');(ch.titleLog=ch.titleLog||[]).push('보조 해결사');addStats(ch.stats,{check:2,spd:1});out.push('칭호 · 보조 해결사 (사건 판정 +2 · 속도 +1) · 직책과 함께 보너스를 준다')}}
    /* 최고 직급(임원)에 오르면 전용 카드팩의 마지막 줄(4코스트 카드)을 덱에 더한다 */
    if(ch.fi===C_.ranks.length-1)giveFinalCards(ch,C_,out,'최고 직급');
    return out;
  }
  function giveFinalCards(ch,C_,out,why){
    const rows=C_.finalRow&&orgRows(ch,C_);
    if(!rows||!ch.cardMoney||ch.finalGiven)return;ch.finalGiven=true;
    const ids=rows[rows.length-1].filter(id=>ch.deck.length<deckMax(ch));
    const keep=ids.filter(id=>!routeCard(ch,id,ch.aff.name,out,'전용 카드'));
    if(keep.length){ch.deck=ch.deck.concat(keep);if(ch.orgPack!==ch.aff.name)(ch.extra=ch.extra||[]).push(...keep)}
    if(keep.length)out.push(`전용 카드 · ${keep.map(id=>D.cards[id].n).join(', ')} (${why})`);
  }
  /* 협회 전용 카드팩: 입회 때 careers.*.cards[소속 이름]의 카드를 한 번에 받아 덱이 통째로 바뀐다.
     전용 카드팩(cardMoney)이라 이후 카드는 얻을 수 없고(대신 돈), 나중에 히든 책장으로 덱이 바뀌어도 협회 패시브는 소속 기록(assocName)으로 남는다 */
  /* R사 날개처럼 팀이 있는 소속은 처음 들어갈 때 1dN으로 팀이 정해지고, 그 팀의 전용 책장과 패시브를 쓴다 */
  const orgRows=(ch,C_)=>C_.cards&&(C_.cards[ch.aff.name+(ch.rteam?'/'+ch.rteam:'')]||C_.cards[ch.aff.name]);
  /* W사 열차 직원 책장: 직급이 오를 때 카드가 바뀌거나 늘어난다 (절단 → 공간 절단, 5등급에 차원 절단) */
  const warpDeckFor=fi=>{const W=D.warpDeck;return W.base.concat(fi>=1?W.mid:W.early,fi>=4?W.top:[])};
  function warpRankCards(ch,r){
    if(!(ch.relics||[]).includes('정리 요원의 책장'))return;
    if(r.cardSwap&&ch.deck.includes(r.cardSwap.from))ch.deck=ch.deck.map(id=>id===r.cardSwap.from?r.cardSwap.to:id);
    if(r.cardAdd)for(const id of r.cardAdd)if(ch.deck.length<deckMax(ch))ch.deck.push(id);
  }
  /* R사 팀 배치: 능력치가 기준을 넘으면 그 팀으로 고정(CFG.rbTeamRule), 아니면 null(무작위) */
  const rbTeamBy=(ch,teams)=>{for(const [k,min,team] of CFG.rbTeamRule||[])if(teams.includes(team)&&(ch.stats[k]||0)>=min)return {team,why:`${{spd:'속도',maxHp:'최대 HP',eva:'회피',atk:'공격'}[k]} ${ch.stats[k]} ≥ ${min}`};return null};
  function giveOrgCards(ch,C_,at,out){
    const T_=C_.teams&&C_.teams[ch.aff.name];
    if(at===0&&T_&&!ch.rteam){const rr=rbTeamBy(ch,T_);if(rr){ch.rteam=rr.team;out.push(`${ch.aff.name} · ${ch.rteam} 고정 배치 (${rr.why})`)}else{const r=d(T_.length);ch.rteam=T_[r-1];out.push(`${ch.aff.name} · ${ch.rteam} 배정 (기준에 맞지 않아 1d${T_.length} · ${r})`)}}
    const rows=orgRows(ch,C_);
    ch.assocName=ch.aff.name;
    if(at!==0||!rows||ch.deckLocked||ch.cardMoney)return;
    const ids=(C_.finalRow?rows.slice(0,-1):rows).flat();
    /* R사 날개: 팀 전용 책장은 통째로 강제하지 않고 받을지 고르게 한다(거절하면 지금 덱 유지, 이전 덱은 카드팩 보관함) */
    if(ch.aff.name==='R사 날개'&&ch.rteam&&!ch.packOffer){ch.packOffer={n:ch.rteam+' 전용 책장',cards:ids.slice(),relic:'R사 날개 · '+ch.rteam,cm:true,orgPack:ch.aff.name};out.push(`전용 카드팩 · ${ch.rteam} 책장 ${ids.length}장 · 받을지 고른다 (받으면 덱이 통째로 바뀌고 이후 카드는 얻지 못하고 대신 돈 · 거절하면 지금 덱 유지)`);return}
    ch.deck=ids.concat(ch.deck.filter(id=>D.cards[id].fixed));ch.side=[];ch.offers=[];ch.picks=[];stashPack(ch,ch.aff.name+' 전용 카드팩');ch.extra=[];ch.packOffer=null;ch.cardMoney=true;ch.orgPack=ch.aff.name;
    out.push(`전용 카드팩 · ${ch.aff.name} ${ids.length}장 (덱이 통째로 바뀐다 · 이후 카드는 얻지 못하고 대신 돈 · 이전 덱은 가방의 카드팩 보관함에 남는다)`);
  }
  const assocOf=ch=>ch.assocName||(ch.aff&&ch.aff.type==='assoc'?ch.aff.name:null);
  /* 최고 단계의 특수 사건: 해결사는 특색 심사, 다른 진로는 careers.*.top */
  const assocColor=ch=>career(ch)==='assoc'&&ch.titleKind==='top'&&!!ch.licensed&&ch.rank<=CFG.colorRank&&!ch.colorFailed&&!ch.colorDone;
  const topEvent=ch=>{const k=career(ch);return k==='fixer'||assocColor(ch)?D.colorExam:CR[k]&&CR[k].top};
  const topReady=ch=>{const k=career(ch);return !!k&&!canPromote(ch)&&(!ch.title||assocColor(ch))&&!ch.colorFailed&&promoDone(ch)>0&&(ch.year||0)>=(ch.topNext||0)}
  /* 특색·상석 심사 실패: 최대 CFG.top.tries번까지, 실패하면 CFG.top.wait년 뒤 다시 */
  function topFailed(ch,chips,label){ch.topTries=(ch.topTries||0)+1;const sb=ch.bond;if(sb&&sb.st==='married'){sb.promo=(sb.promo||0)+1;chips.push(`배우자 승급 · ${sb.name} (+1급)`)}const left=CFG.top.tries-ch.topTries;
    if(left<=0){ch.colorFailed=true;chips.push(label+' 실패 · 다시 기회 없음')}else{ch.topNext=(ch.year||0)+CFG.top.wait;chips.push(`${label} 실패 · 남은 기회 ${left}번 · ${CFG.top.wait}년 뒤 다시`)}}
  /* ===== 손가락 서열 =====
     손가락마다 서열표가 있고, 오를 때마다 그 서열의 보정을 더한다. branch면 1d100으로 갈래를 고른다 */
  const isFinger=ch=>!!ch.aff&&ch.aff.type==='finger'&&!!D.fingers[ch.aff.name];
  /* 예의 1스택당 상대 명중 감소: 엄지의 서열(솔다토→대부)마다 다르다 (낮은 서열일수록 탄환이 적어 스택당 더 크다) */
  const thumbPer=A=>{const m=CFG.thumbManner;return Array.isArray(m)?m[Math.min(m.length-1,(A&&A.thumbFi)||0)]:m};
  /* 해결사 등록을 할 수 없는 진로(손가락·협회·날개 직원)는 그 진로의 최고 직급(손가락 대부·협회/날개 최고 직급·날개 대표)이면 해결사 1급과 같은 대접으로 본다 */
  const topOfCareer=ch=>{if(isFounder(ch))return true;if(isFinger(ch)){const rs=D.fingers[ch.aff.name].ranks||[];return !!ch.fr&&rs.length>0&&ch.fr.tier>=Math.max(...rs.map(x=>x.tier))}const C_=D.careers&&ch.aff&&D.careers[ch.aff.type];return !!(C_&&C_.ranks&&ch.fi!=null&&ch.fi>=C_.ranks.length-1)};
  const rankMet=(ch,need)=>!!(ch.licensed&&ch.rank<=need)||(need>=1&&topOfCareer(ch));
  /* 조직(흑운회·검계·밤의 송곳): 손가락 서열표를 쓰되 패시브는 덱 장수(6·8·10)로 단계가 열린다 */
  const synOf=ch=>isFinger(ch)&&CFG.syn[ch.aff.name]?CFG.syn[ch.aff.name].key:null;
  const synTier=n=>n>=CFG.syn.at[1]?3:n>=CFG.syn.at[0]?2:-1;
  function fingerStep(ch){
    const F=D.fingers[ch.aff.name],next=F.ranks[(ch.fi??-1)+1];
    if(!next)return null;
    const r=next.branch?next.branch[d(100)<=50?0:1]:next;
    ch.fi=(ch.fi??-1)+1;ch.fr=r;
    addStats(ch.stats,r.fx);if(r.fx.maxHp)ch.hp+=r.fx.maxHp;
    if(r.card&&!ownsCard(ch,r.card))putCard(ch,r.card);
    for(const id of r.cards||[])if(!ownsCard(ch,id)&&ch.deck.length<deckMax(ch)){ch.deck.push(id)}
    if(r.cards&&CFG.syn[ch.aff.name])ch.flags.synTop=1;
    const out=[`${ch.aff.name} · ${r.n}`,...(r.e?[r.e]:[])];
    /* 조직 전용 책장: 들어가는 순간 덱이 통째로 바뀐다 (이후 카드는 얻지 못하고 대신 돈). 최고 서열에서 전용 카드 2장이 더해져 10장이 된다 */
    if(ch.fi===0&&F.pack&&!ch.deckLocked&&!ch.cardMoney){stashPack(ch,ch.aff.name+' 전용 카드팩');ch.extra=[];ch.deck=F.pack.concat(ch.deck.filter(id=>D.cards[id].fixed));ch.side=[];ch.offers=[];ch.picks=[];ch.packOffer=null;ch.cardMoney=true;out.push(`전용 카드팩 · ${ch.aff.name} ${F.pack.length}장 (덱이 통째로 바뀐다 · 이후 카드는 얻지 못하고 대신 돈 · 이전 덱은 가방의 카드팩 보관함에 남는다)`)}
    return out;
  }
  const canFingerUp=ch=>isFinger(ch)&&!!D.fingers[ch.aff.name].ranks[(ch.fi??-1)+1];
  /* 승급 사건·고정 전투 승리: 손가락이면 서열, 아니면 해결사 급수 */
  function promoteAny(ch){
    if(canFingerUp(ch))return {chips:fingerStep(ch),finger:true};
    if(isFinger(ch))return null;
    const k=career(ch);if(k&&k!=='fixer'){const c=careerStep(ch);if(c&&(eastN(ch)||lakeOn(ch))&&ch.licensed){const tgt=Math.min(ch.rank-1,alignOf(ch)[ch.fi]??9);while(ch.rank>Math.max(tgt,T.rankTop)){const p=promote(ch);c.push(...p.chips)}}return c?{chips:c}:null}
    if(ch.licensed&&ch.rank>T.rankTop)return promote(ch);
    return null;
  }
  /* 날개·손가락 진로면 해결사 급수 대신 그 진로의 직급을 보여 준다 (해결사 급수는 그 진로에서 오르지 않는다) */
  const rankLabelBase=ch=>{if(isFounder(ch)&&!ch.job)return ch.title?`${ch.title} · 날개 대표`:'날개 대표';if(ch.job)return ch.title?`${ch.title} · ${T.jobs[ch.job]}`:T.jobs[ch.job];const k=career(ch);if((k==='wing'||k==='finger')&&ch.fr){const fx_=eastN(ch)&&ch.licensed?` · ${ch.rank}${T.rankUnit} 해결사`:'';return (ch.title?`${ch.title} · ${ch.fr.n}`:ch.fr.n)+fx_}return rankLabel0(ch)};
  const rankLabel=ch=>rankLabelBase(ch)+(ch.legacyTier?` · 연륜 ${ch.legacyTier}단계`:'');
  const rankLabel0=ch=>!ch.licensed?T.unranked:ch.title?`${ch.title} · ${ch.rank}${T.rankUnit}`:`${ch.rank}${T.rankUnit} ${T.licensed}`;
  /* 카드 얻기: 덱이 고정(엄지 검술)이면 카드 대신 돈 */
  /* offer: 바로 넣지 않고 받을지 고르게 한다 (일반 전투 보상) */
  function addCard(ch,cid,chips,label,offer){
    if(!cid)return;
    /* 덱 고정(엄지 검술·책장) 또는 전용 카드팩(숨은 출생)이면 카드 대신 돈 */
    if(ch.deckLocked||ch.cardMoney){const m=earn(ch,CFG.lockedCardMoney);ch.money+=m;const cp=copyToPacks(ch,cid);chips&&chips.push(`${ch.deckLocked?'덱 고정':'전용 카드팩'} · ${D.cards[cid].n} +${money(m)}${cp?` · 카드는 기본 카드팩 ${cp}곳에 보관`:' · 카드는 보관할 팩이 없어 돈만 받는다'}`);return}
    if(offer){(ch.offers=ch.offers||[]).push(cid);chips&&chips.push(`${label||'카드'} 발견 · ${D.cards[cid].n} (받을지 고른다)`);return}
    putCard(ch,cid,chips,label);
    /* 보상 카드는 다른 편집 가능한 팩에도 복사하고, 전용 카드(보스·책장·집행 카드)는 지금 팩에만 둔다 */
    if(!['전용 카드','전용 책장','책장 카드','집행 카드'].includes(label))copyToPacks(ch,cid);
  }
  /* 카드 고르기: 새 카드를 한 장만 제안하지 않고 CFG.cardPick.n장 가운데 하나를 고르게 한다 (고정 덱이면 예전처럼 돈). 안 가진 카드를 먼저 뽑는다 */
  function offerPick(ch,pool,chips,label){
    if(ch.deckLocked||ch.cardMoney){const cid=one(pool.filter(id=>!ownsCard(ch,id)))||one(pool);return addCard(ch,cid,chips,label,true)}
    const fresh=pool.filter(id=>!ownsCard(ch,id)),src=fresh.length>=CFG.cardPick.n?fresh:fresh.concat(pool.filter(id=>!fresh.includes(id))),set=[];
    const left=src.slice();while(set.length<CFG.cardPick.n&&left.length)set.push(left.splice(d(left.length)-1,1)[0]);
    if(!set.length)return null;
    if(set.length===1)return addCard(ch,set[0],chips,label,true);
    (ch.picks=ch.picks||[]).push(set);chips&&chips.push(`${label||'카드'} 발견 · ${set.length}장 가운데 하나를 고른다`);return set;
  }
  function pickTake(ch,i){const g=(ch.picks||[])[0];if(!g||!g[i])return false;const cid=g[i];ch.picks.shift();(ch.offers=ch.offers||[]).unshift(cid);return true}
  function pickSkip(ch){if(!(ch.picks||[]).length)return false;ch.picks.shift();return true}
  function rewardCard(ch){const pool=D.rewards.filter(id=>!ownsCard(ch,id));return pool.length?one(pool):null}
  /* 사건·성장·보상 효과를 적용하고 화면용 칩을 돌려준다 */
  /* 소속에 들어간다: 소속·직급 기록을 새로 쓰고 첫 직급의 보정을 받는다 */
  function joinAff(ch,J,name,chips){
    /* 홍원의 자제는 어디에 몸을 둬도 홍원 소속이다: 다른 곳에 입사·입회하지 않는다(정보를 빼 오는 것뿐) */
    if(ch.hw){chips.push('홍원의 자제는 다른 곳에 소속되지 않는다 · 홍원 소속으로 남는다');return}
    ch.aff={type:J.type,name};(ch.affLog=ch.affLog||[]).includes(name)||ch.affLog.push(name);chips.push(((D.fingers[name]&&D.fingers[name].kind)||T.affTypes[J.type]||'소속')+' · '+name);
    if(isN(ch)&&ch.gear.aug){chips.push(`의체를 버린다 · ${ch.gear.aug.n} → 보관함`);unequip(ch,'aug')}
    ch.fi=undefined;ch.fr=null;ch.pp=0;ch.promos=0;ch.strikes=0;
    /* 동부 출신 외곽 생존자가 N사 날개에 들어가면 못 대신 전용 키워드 '운명': 모든 판정(사건 판정 · 전투 명중·회피 굴림) +fate */
    if(isN(ch)&&isEastOuter(ch)&&!ch.fate){ch.fate=true;addStats(ch.stats,{check:CFG.nWing.fate});(ch.relics=ch.relics||[]).push('운명');chips.push(`운명 · 모든 판정 +${CFG.nWing.fate} (사건 판정 · 전투 명중·회피)`)}
    if(noFixer(ch)&&ch.licensed){ch.licensed=false;ch.title=null;chips.push(`해결사 자격 반납 · ${T.affTypes[ch.aff.type]}은(는) 해결사를 겸할 수 없다`)}
    /* 전용 책장이 없는 날개(K·J·G사)는 카드팩 대신 보정치를 조금 더 받고, 덱은 스스로 꾸린다 */
    {const FW=CFG.freeWing;if(J.type==='wing'&&FW.names.includes(name)){addStats(ch.stats,FW.fx);if(FW.fx.maxHp)ch.hp+=FW.fx.maxHp;chips.push(`${name} · 전용 책장 없음 · 보정 최대 HP +${FW.fx.maxHp} · 공격·회피·속도 +${FW.fx.atk} · 사건 판정 +${FW.fx.check}`)}}
    if(isFinger(ch))chips.push(...fingerStep(ch));
    else if(CR[ch.aff.type]&&CR[ch.aff.type].ranks)chips.push(...careerStep(ch));
  }
  /* 사무소 입소: 그 사무소의 보정(능력치·카드)을 받고 소속이 된다 */
  function joinOffice(ch,name){const o=(D.offices||[]).find(x=>x.n===name);if(!o)return [];return applyFx(ch,Object.assign({},o.fx,{join:{type:'office',name:o.n}})).chips}
  /* 날개·협회 입사: 들어갈 곳을 직접 고른다 (고르지 않고 넘어오면 무작위) */
  function chooseOrg(ch,name){
    const t=ch.orgPick;if(!t||!(D.orgs[t]||[]).includes(name)||(name===CFG.nWing.name&&nBlocked(ch)))return null;
    ch.orgPick=null;
    if(t==='office')return joinOffice(ch,name);
    const chips=[];joinAff(ch,t==='syn'?{type:'finger',from:'syn'}:{type:t,from:t},name,chips);return chips;
  }
  function chooseFinger(ch,name){
    if(!ch.fingerPick)return null;
    /* 별에 선택받은 자만: 소지 루트 (손가락 서열 대신 인의예지 별을 이을 때마다 성도가 강해진다) */
    if(name==='소지'&&ch.flags.starborn&&!ch.pinky){ch.fingerPick=false;ch.pinky=true;ch.pinkyYear=ch.year||0;addStats(ch.stats,D.pinky.fx);return [D.pinky.n+' 표식 · '+D.pinky.e,'인의예지 별을 이을 때마다 그 별이 성도에 새겨진다 (추가 강화)']}
    if(!D.orgs.finger.includes(name))return null;
    const chips=[];ch.fingerPick=false;joinAff(ch,{type:'finger',from:'finger'},name,chips);return chips;
  }
  function applyFx(ch,fx){
    const s=ch.stats,chips=[];
    if(fx.maxHp){s.maxHp+=fx.maxHp;ch.hp+=fx.maxHp;chips.push('최대 HP '+sg(fx.maxHp))}
    if(fx.hp){ch.hp=clamp(ch.hp+fx.hp,1,s.maxHp);chips.push('HP '+sg(fx.hp))}
    if(fx.mindLoss)loseMind(ch,d(3)+d(3),t=>chips.push(t+' · 2d3'));
    for(const k of ['atk','eva','spd'])if(fx[k]){s[k]+=fx[k];chips.push(STAT[k]+' '+sg(fx[k]))}
    if(fx.money){const m=earn(ch,fx.money);ch.money=Math.max(0,ch.money+m);chips.push((m>0?'+':'−')+money(Math.abs(m))+(m!==fx.money?' (금전운)':''))}
    if(fx.check){s.check+=fx.check;chips.push('사건 판정 '+sg(fx.check))}
    if(fx.startBreath){s.startBreath+=fx.startBreath;chips.push('시작 '+D.keywords.breath.n+' +'+fx.startBreath)}
    if(fx.wsMat){(ch.stash=ch.stash||[]).push({id:'hidmat',n:'히든 강화재료',slot:'any',grade:5,e:'어떤 전용 장비든 녹이면 히든 한 단계'});chips.push('히든 강화재료 · 보관함에 들어왔다')}
    if(fx.card)addCard(ch,fx.card,chips,null,true);else if(fx.reward)offerPick(ch,D.rewards,chips,null);
    if(fx.escort)ch.flags.escortNext=1;
    if(fx.officeFound){ch.officePick=true;chips.push('사무소 개설 · 이름과 전문 분야를 정한다')}
    if(fx.auth){(ch.auth=ch.auth||[]).push(fx.auth);chips.push('조율자 권한 · '+(fx.auth==='seal'?'봉인':'집행')+' ('+ch.auth.length+'단계)');if(fx.auth==='exec'){if(ch.cardMoney){forceAdd(ch,'o_verdict');chips.push('전용 책장 · 집행')}else addCard(ch,'o_verdict',chips,'집행 카드')}}
    /* 표시 없이 쌓이는 기록(금기 위반, 초대 등). 조건 "flag:이름" / "flag:이름>=n"으로 읽는다 */
    for(const f of [].concat(fx.flag||[]))ch.flags[f]=(ch.flags[f]||0)+1;
    if([].concat(fx.flag||[]).includes('taboo'))bondTaboo(ch);
    /* 열차를 내린 뒤 일반 흐름으로: 해결사로 등록하고 급수를 한꺼번에 받는다 (협회나 해결사 길만 열려 있다). 받는 급수에 맞는 능력치 보너스도 같이 */
    if(fx.setRank&&!ch.wtrain){const R_=fx.setRank,B_=CFG.warp.after.bonus[R_.rank];if(!ch.licensed)license(ch);
      if(ch.licensed){ch.rank=Math.min(ch.rank,R_.rank);if(B_){addStats(ch.stats,B_);if(B_.maxHp)ch.hp+=B_.maxHp}chips.push(`해결사 ${ch.rank}급으로 등록되었다`+(B_?` · 공격 +${B_.atk||0} · 회피 +${B_.eva||0} · 최대 HP +${B_.maxHp||0}`:''))}}
    if(fx.join){
      /* 손가락 가입: 소지를 뺀 네 손가락 중 하나를 직접 고른다 (고르지 않고 넘어오면 무작위 · 엄지 특화 출신은 엄지 확률 보정) */
      if(fx.join.from==='finger'&&!fx.join.name){ch.fingerPick=true;chips.push('손가락 · 어느 손가락에 설지 고른다')}
      else if((fx.join.from==='wing'||fx.join.from==='assoc'||fx.join.from==='office'||fx.join.from==='syn')&&!fx.join.name){ch.orgPick=fx.join.from;chips.push(`${T.affTypes[fx.join.from]} · 어느 곳에 들어갈지 고른다`)}
      else joinAff(ch,fx.join,fx.join.name||one(D.orgs[fx.join.from]),chips);
    }
    /* 사건으로 승급 (해결사만, 최고 급수 미만일 때) */
    if(fx.promote)addPts(ch,CFG.promo.gain.mid,chips);
    if(fx.pts)addPts(ch,fx.pts*CFG.promo.gain.check,chips);
    if(fx.pinkyKey){const ks=ch.pinkyKeys=ch.pinkyKeys||[],K=D.pinky.keys[ks.length];if(K){ks.push(K.k);chips.push(`소지의 별 · ${K.k} (${ks.length}/${D.pinky.keys.length})`);if(ch.flags.starborn){const u=starUp(ch,K.k);if(u)chips.push(`${u} · 「${K.k}」의 별이 성도에 새겨졌다 (${CFG.star.virt[K.k].e})`);if(ks.length>=D.pinky.keys.length){(ch.deck.length<deckMax(ch)?ch.deck:(ch.side=ch.side||[])).push('st_link');chips.push('네 별을 모두 이었다 · 별을 잇다 카드 한 장 더')}}else if(ks.length>=D.pinky.keys.length){ch.seongPick=true;chips.push('성도 · 이름을 정한다')}}}
    if(fx.oracle&&!ch.oracle){ch.oracle=true;(ch.relics=ch.relics||[]).push('히든 직업 · 신탁대행자','전리품 · 신의 단말기');addStats(s,D.oracle.loot.fx);chips.push('히든 직업 · 신탁대행자 · 지령 독촉',`전리품 · 신의 단말기 · ${D.oracle.loot.e}`)}
    if(fx.officeJoin){chips.push(...joinOffice(ch,one(fx.officeJoin)))}
    if(fx.rb){const r=ch.rb,k=fx.rb,Z=CFG.rb,y=ch.year||0;
      if(r){
        if(k==='start')chips.push(`부화장 ${Z.total}연전 · 한 판이 끝날 때마다 HP를 회복한다`);
        else if(k==='exit'){r.out=1;r.next=Math.max(y+1,Z.fleeAt+d(Z.fleeRand)-1);chips.push('부화장을 나왔다');
          const dl=ch.deckLocked;ch.deckLocked=true;joinAff(ch,{type:'wing',from:'wing'},'R사 날개',chips);ch.deckLocked=dl;
          {const C_=CR.wing,rows=orgRows(ch,C_);if(rows&&!ch.cardMoney&&!ch.packOffer){ch.packOffer={n:ch.rteam+' 전용 책장',cards:(C_.finalRow?rows.slice(0,-1):rows).flat(),relic:'R사 날개 · '+ch.rteam,cm:true};chips.push(`${ch.rteam} 전용 책장 · 받을지 고른다 (받으면 덱이 바뀐다 · 복제체의 몸 카드는 남는다)`)}}}
        else if(k==='flee')rbFlee(ch,chips)
        else if(k==='prep'){r.prep=1;r.hAt=y+Z.headGap;if(ch.rteam==='까마귀팀'&&ch.cardMoney&&!ch.finalGiven){const rows=CR.wing.cards['R사 날개/까마귀팀'],ids=rows[rows.length-1];ch.finalGiven=true;ch.deck=ch.deck.concat(ids);chips.push('전용 카드 · '+ids.map(id=>D.cards[id].n).join(', ')+' (제4무리 임무 완수)')}if(fx.healAll){ch.hp=s.maxHp;ch.mind=mindMax(ch);chips.push('HP · 정신력 전부 회복')}if(fx.mindUp){const g_=gainMind(ch,fx.mindUp);if(g_)chips.push('정신력 +'+g_)}}
        else if(k==='head'){r.headSeen=1;r.chain=Z.head.filter(id=>!ch.beaten.includes(id));chips.push('금기 위반이 확인되었다 · 머리의 사자가 곧바로 온다')}
        else if(k==='fight'){ch.purge=r.chasers[r.chase];r.chase++;r.cnext=y+Z.chaseGap}
        else if(k==='hide'){r.hides++;r.cnext=y+Z.chaseGap;chips.push('이번 추격을 피했다 · 추격은 끝나지 않았다')}
        else if(k==='boss'){ch.purge=Z.boss;r.bossSeen=1}}}
    if(fx.lakeWave&&ch.flags&&ch.flags.lake){const L=ch.lake=ch.lake||{},W=CFG.lake.wave,w=L.wave;
      const endW=()=>{L.wave=null;L.crewAt=Math.max(L.crewAt||0,(ch.year||0)+2)};
      if(w&&fx.lakeWave!=='fail'){endW();if(fx.lakeWave==='sac'&&(L.crew||[]).length){const m=L.crew.splice(Math.floor(Math.random()*L.crew.length),1)[0];chips.push(`선원 · ${m.n} 실종`)}
        addPts(ch,W.rewardPts*CFG.promo.gain.check,chips);chips.push("파도를 넘었다");const g=gainMind(ch,W.rewardMind);if(g)chips.push(`정신력 +${g}`)}
      else if(w){w.i++;hullLose(ch,Math.round(W.hullLoss/w.max*(0.7+Math.random()*0.6)),chips);const lose=W.failMind+w.i*W.failMindStep;loseMind(ch,lose,t=>chips.push(t));ch.hp=clamp(ch.hp-W.failHp*w.i,1,s.maxHp);chips.push(`HP -${W.failHp*w.i}`);
        if((L.crew||[]).length&&d(100)<=W.failCrew){const m=L.crew.splice(Math.floor(Math.random()*L.crew.length),1)[0];chips.push(`선원 · ${m.n} 부상으로 이탈`)}
        if(w.i>=w.max){endW();loseMind(ch,W.driftMind,t=>chips.push('표류 · '+t));const n=Math.floor((L.crew||[]).length/2);if(n){L.crew.splice(0,n);chips.push(`선원 ${n}명 이탈`)}ch.hp=Math.max(1,Math.floor(ch.hp/2));chips.push('배가 반파되어 표류했다 · HP 절반')}
        else chips.push('다음 파도가 온다')}}
    if(fx.lakeMorph&&ch.flags&&ch.flags.lake){const L=ch.lake=ch.lake||{},Mo=CFG.lake.morph,m=(L.crew||[])[L.morphIdx];
      if(m){if(fx.lakeMorph==='a'){const g=gainMind(ch,Mo.mindA);if(g)chips.push(`정신력 +${g}`)}else{s.atk+=Mo.atkB;chips.push(`공격 +${Mo.atkB}`)}
        m.mo=(m.mo||0)+1;
        if(m.mo>=D.lake.infinite.morph.length){L.crew.splice(L.morphIdx,1);L.crewAt=Math.min(L.crewAt||0,(ch.year||0)+1);L.morphed=(L.morphed||0)+1;s.maxHp+=Mo.maxHpFinal;ch.hp+=Mo.maxHpFinal;chips.push(`선원 · ${m.n}이(가) 호수로 돌아갔다 · 젖은 옷만 남았다 · 최대 HP +${Mo.maxHpFinal}`);chips.push('다음 해, 빈자리에 새 선원을 태울 수 있다')}
        else chips.push(`선원 · ${m.n}에게 변화가 이어진다`)}}
    if(fx.lakeIndigo&&ch.flags&&ch.flags.lake){const L=ch.lake=ch.lake||{};L.indigo='done';
      if(fx.lakeIndigo==='fight'){ch.lakeNow={id:'lake_indigo',hidden:true,label:'쪽빛 노인'};chips.push('이어서 쪽빛 노인과 싸운다')}
      else if(fx.lakeIndigo==='learn'){const dr=D.enemies.lake_indigo.drop;ch.packOffer={n:dr.packName,cards:dr.cards.slice(),passive:dr.packPassive||null,e:dr.packE||null};chips.push('전용 카드팩 · 재앙살해')}
      else chips.push('쪽빛 노인은 다시 오지 않는다')}
    if(fx.lakeHunt&&ch.flags&&ch.flags.lake){const L=ch.lake=ch.lake||{};if(fx.lakeHunt==='fight'){ch.lakeNow={id:'lake_hunter',hidden:true,label:'대호수 금기 사냥꾼'};chips.push('이어서 사냥꾼과 싸운다')}else chips.push('사냥꾼은 떠났다')}
    if(fx.lakePirate&&ch.flags&&ch.flags.lake){const L=ch.lake=ch.lake||{};if(fx.lakePirate==='fight'){L.pirate='matefight';ch.lakeNow={id:'lake_mate',hidden:true,label:'쌍갈고리 해적단 부선장'};chips.push('이어서 쌍갈고리 해적단과 싸운다')}else{L.pirate=null;L.pirateAt=(ch.year||0)+4;chips.push('해적단은 물러났다 · 몇 해 뒤 다시 온다')}}
    if(fx.lakeCrew&&ch.flags&&ch.flags.lake){const L=ch.lake=ch.lake||{},R_=D.lake.crew.roles[fx.lakeCrew];(L.crew=L.crew||[]).push({role:fx.lakeCrew,n:R_.n,die:R_.die});chips.push(`선원 · ${R_.n} (${L.crew.length}/${CFG.lake.crewMax}) · ${R_.e}`)}
    if(fx.lakePaleAlly&&ch.flags&&ch.flags.lake){D.enemies.lake_whale_pale.ally=true;chips.push('곁의 사람이 함께 싸운다')}
    if(fx.lakeTool&&ch.flags&&ch.flags.lake){const L=ch.lake=ch.lake||{};if((L.tools||{})[fx.lakeTool]>0){L.tools[fx.lakeTool]--;chips.push(`도구 하나를 썼다 · 남은 ${L.tools[fx.lakeTool]}개`)}}
    if(fx.lakeRicardo&&ch.flags&&ch.flags.lake){const L=ch.lake=ch.lake||{};ch.lakeNow={id:'lake_ricardo',hidden:true,label:'중지의 큰형님'};chips.push('이어서 중지의 큰형님과 싸운다')}
    if(fx.lakeWhale&&ch.flags&&ch.flags.lake){const L=ch.lake=ch.lake||{};{const wt=L.whaleTarget,we=D.enemies[wt];if(we)ch.lakeNow={id:wt,hidden:!!we.hidden,label:we.hidden?'대재앙 토벌':'보스급 고래 토벌'}}chips.push('이어서 고래와 싸운다')}
    if(fx.lakeFlee&&ch.flags&&ch.flags.lake){const L=ch.lake=ch.lake||{};L.phase='enter';L.harbor=true;gainMind(ch,CFG.lake.harborMind);L.fled=(L.fled||0)+1;chips.push('고래에게서 도망쳤다 · 호수를 벗어나 선박장에 들른다')}
    if(fx.hyeol&&ch.race!=='hyeolgwi'){ch.race='hyeolgwi';s.maxHp+=10;ch.hp+=10;s.atk+=2;(ch.relics=ch.relics||[]).push('혈귀');chips.push(`혈귀가 되었다 · 최대 HP +10 · 공격 +2 · 패시브 혈찬(상대 출혈 5번 발동마다 HP ${CFG.hyeolchan.heal} 회복)`);
      if(!ch.cardMoney&&!ch.deckLocked&&!ch.packOffer&&D.hgDeck){ch.packOffer={n:'혈귀 전용 책장',cards:D.hgDeck.slice(),relic:'혈귀의 책장',cm:true};chips.push('혈귀 전용 책장 · 받을지 고른다 (받으면 덱이 바뀐다)')}}
    if(fx.redPost){ch.redPost=(ch.redPost||0)+1;chips.push(`붉은 안개 · 책을 덮었다 (${ch.redPost}번째) · 체력 ×${Math.pow(CFG.redBook.hpMul,ch.redPost).toFixed(2)}`)}
    if(fx.hwb&&ch.hw){const r=ch.hw,k=fx.hwb,Z=CFG.hw.beast;
      if(k==='stay')r.fork=1;
      else if(k==='become'){r.fork=1;r.beast=1;r.bk=fx.hwbKey;r.bp=0;r.mk=0;r.bnext=(ch.year||0)+1;r.cand='hr_'+(aniOf(r.bk).pi);const a=aniOf(r.bk);
        addStats(ch.stats,Z.startFx);if(Z.startFx.maxHp)ch.hp+=Z.startFx.maxHp;(ch.relics=ch.relics||[]).push('흑수 · '+a.nm);if(!ch.cardMoney&&!ch.deckLocked&&!ch.packOffer&&D.cards.zk_1){ch.packOffer={n:'흑수 전용 책장',cards:['zk_1','zk_1','zk_2','zk_2','zk_3','zk_5','zk_6','zb_'+r.bk+'_1'],relic:'흑수의 책장',must:true,yes:'마음 편히 흑수할래요',yesE:'덱이 흑수의 카드로 바뀌고 고정된다. 흑수의 특수 카드는 단계마다 그대로 받는다.',alt:{label:'흑수랑 다른 것도 섞어볼래요',e:'후보 시절의 카드만 덜어내고 일반 책장을 그대로 쓴다. 흑수 특수 카드를 더하고, 새 카드도 계속 받는다.'},bk:r.bk};chips.push('흑수의 길 · 마음 편히 흑수가 될지, 일반 책장에 흑수의 카드를 섞을지 고른다')}else hwCard(ch,'zb_'+r.bk+'_1',chips);{const w=((D.hwBeast.weapons||{})[r.bk]||[])[0];if(w){equip(ch,structuredClone(w));chips.push(`흑수의 무기 · ${w.n} (${w.e})`)}}
        chips.push(`${a.nm}(${a.hj})의 흑수가 되었다 · 가주 승계를 내려놓는다 · 최대 HP +${Z.startFx.maxHp} · 회피 +${Z.startFx.eva}`);chips.push('후원할 가주 후보 · '+((D.enemies[r.cand]||{}).n||'가주 후보'))}
      else if(k==='act'){r.bp=(r.bp||0)+1;chips.push(`흑수 활동 ${r.bp}/${Z.rank2}`)}
      else if(k==='rank1'){r.rank1=1;addStats(ch.stats,Z.rank1Fx);if(Z.rank1Fx.maxHp)ch.hp+=Z.rank1Fx.maxHp;hwCard(ch,'zb_'+r.bk+'_2',chips);hwCard(ch,'zb_'+r.bk+'_4',chips);{const w=((D.hwBeast.weapons||{})[r.bk]||[])[1];if(w){equip(ch,structuredClone(w));chips.push(`흑수의 무기가 자란다 · ${w.n} (${w.e})`)}}chips.push(`${aniOf(r.bk).nm}의 흑수 · 공격 +${Z.rank1Fx.atk} · 회피 +${Z.rank1Fx.eva} · 최대 HP +${Z.rank1Fx.maxHp}`)}
      else if(k==='rank2'){r.rank2=1;addStats(ch.stats,Z.rank2Fx);if(Z.rank2Fx.maxHp)ch.hp+=Z.rank2Fx.maxHp;const tt='흑수 필두';ch.titles=ch.titles||[];if(!ch.titles.includes(tt)){ch.titles.push(tt);(ch.titleLog=ch.titleLog||[]).push(tt)}hwCard(ch,'zb_'+r.bk+'_3',chips);hwCard(ch,'zb_'+r.bk+'_5',chips);{const w=((D.hwBeast.weapons||{})[r.bk]||[])[2];if(w){equip(ch,structuredClone(w));chips.push(`필두의 무기 · ${w.n} (${w.e})`)}}chips.push(`칭호 · ${tt} (${aniOf(r.bk).nm}) · 공격 +${Z.rank2Fx.atk} · 회피 +${Z.rank2Fx.eva} · 최대 HP +${Z.rank2Fx.maxHp}`)}
      else if(k==='mk'||k==='mkf'||k==='mkc'){if(k==='mkc'){r.clues=(r.clues||0)+1;chips.push(`불사의 단서를 얻었다 · ${r.clues}/2`)}const was=hwCandRank(r.mk||0);r.mk=(r.mk||0)+1;if(k==='mkf'&&fx.hwEnemy)ch.purge=fx.hwEnemy;chips.push(`후보를 세우는 일 ${r.mk}/${(D.hwBeast.maker||[]).length}`);{const nw=hwCandRank(r.mk);if(nw!==was)chips.push(`후보의 위상이 오른다 · ${CFG.hw.candRanks[nw]}`)}if(r.mk>=(D.hwBeast.maker||[]).length){const w=((D.hwBeast.weapons||{})[r.bk]||[])[3];if(w){equip(ch,structuredClone(w));chips.push(`무기가 완성되었다 · ${w.n} (${w.e})`)}}}
      else if(k==='accept'){r.accept=1;chips.push('가주 혼자 철함사에 들어갔다 · 문 밖에서 주위를 지킨다')}
      else if(k==='flee'){r.flee=1;r.maker=1;r.out=1;r.fc=0;r.fh=0;r.cnext=(ch.year||0)+CFG.hw.fleeGap;chips.push('가문을 버리고 후보와 도망쳤다 · 홍원의 추격대가 뒤를 쫓는다')}
      else if(k==='fchase'){ch.purge=D.hwBeast.fleeIds[r.fc];r.fc++;r.cnext=(ch.year||0)+CFG.hw.fleeGap}
      else if(k==='fhide'){r.fh++;r.cnext=(ch.year||0)+CFG.hw.fleeGap;chips.push('이번 추격을 피했다 · 추격은 끝나지 않았다')}
      else if(k==='fend'){r.done=1;chips.push('추격이 끝났다')}
    }
    if(fx.hw){const r=ch.hw,k=fx.hw,Z=CFG.hw,y=ch.year||0;
      if(fx.mindUp){const g_=gainMind(ch,fx.mindUp);if(g_)chips.push('정신력 +'+g_)}
      if(r){
        if(k==='fam'||k==='assassin'||k.startsWith('fight:')){r.fi++;if(r.fi===1&&!ch.hwDan){ch.hwDan=1;chips.push(`가문이 자제에게 내리는 강화 시술 · ${CFG.hw.dan.name} · 전투 중 매 라운드 시작에 HP ${CFG.hw.dan.heal[1]} 회복 (패시브)`)}if(k==='assassin')ch.purge='hw_assassin';else if(k.startsWith('fight:'))ch.purge=k.slice(6)}
        else if(k.startsWith('mission1:')){const key=k.split(':')[1],an=aniOf(key),pi=an.pi,w=an.w;r.have=[key];ch.hwDan=Math.max(ch.hwDan||0,2);chips.push(`${CFG.hw.dan.name} 심화 · 전투 중 매 라운드 시작에 HP ${CFG.hw.dan.heal[2]} 회복`);r.mission=1;r.out=1;r.cl=0;r.clues=0;r.clNext=y+3;r.pair=pi;r.w=w;
          forceAdd(ch,'zp_'+key);chips.push('흑수 카드 · '+D.cards['zp_'+key].n);
          while(ch.deck.length>deckMax(ch)){const j=ch.deck.findIndex(id=>!D.cards[id].fixed&&!id.startsWith('zp_'));if(j<0)break;(ch.side=ch.side||[]).push(...ch.deck.splice(j,1))}
          (ch.relics=ch.relics||[]).push('흑수 · '+D.cards['zp_'+key].n.replace('흑수 · ',''))}
        else if(k==='pick'){const pi=r.pair,partner=r.pk;r.picked=1;(r.have=r.have||[]).push(partner);
          for(const id of ['zp_'+partner,'hc_6']){forceAdd(ch,id);chips.push('흑수 카드 · '+D.cards[id].n)}
          while(ch.deck.length>deckMax(ch)){const j=ch.deck.findIndex(id=>!D.cards[id].fixed&&!id.startsWith('zp_'));if(j<0)break;(ch.side=ch.side||[]).push(...ch.deck.splice(j,1))}
          r.rivals=Z.pairs.map((_,i)=>i).filter(i=>i!==pi).map(i=>'hr_'+i);r.rv=0;r.cnext=y+Z.rivalGap;
          ch.hwDan=3;chips.push(`${CFG.hw.dan.name} 완성 · 전투 중 매 라운드 시작에 HP ${CFG.hw.dan.heal[3]} 회복`);routeWeaponUp(ch,'hw',1,chips);(ch.relics=ch.relics||[]).push('흑수 · '+D.cards['zp_'+partner].n.replace('흑수 · ',''));(ch.marks=ch.marks||[]).includes('가주 후보')||ch.marks.push('가주 후보');chips.push('가주 후보가 되었다')}
        else if(k==='sage'||k==='sagefail'){r.sage=(r.sage||0)+1;r.sNext=y+1;
          if(k==='sage'){const pool=hwAllowed().filter(x=>!hwHave(ch).includes(x));
            if(pool.length&&hwHave(ch).length<Z.haveMax){const key=one(pool),a=aniOf(key);(r.have=r.have||[]).push(key);(ch.relics=ch.relics||[]).push('흑수 · '+a.nm);chips.push(`흑수 선인의 재갈 · ${a.nm}(${a.hj}) · 흑수 부하가 늘었다 (${r.have.length}명)`);
              if(D.cards['zp_'+key]){forceAdd(ch,'zp_'+key);chips.push('흑수 카드 · '+D.cards['zp_'+key].n);while(ch.deck.length>deckMax(ch)){const j=ch.deck.findIndex(id=>!D.cards[id].fixed&&!id.startsWith('zp_'));if(j<0)break;(ch.side=ch.side||[]).push(...ch.deck.splice(j,1))}}}
            else chips.push('얻을 수 있는 재갈이 더는 없다')}
          else chips.push('재갈을 얻지 못했다')}
        else if(k==='clue'){ch.purge='hw_cl'+r.cl;r.cl++;r.clNext=y+(r.cl>=D.hwRoute.clue.length?2:Z.clueGap)}
        else if(k==='return'){r.out=0;r.back=1}
        else if(k==='rival'){ch.purge=r.rivals[r.rv];r.rv++;r.cnext=y+Z.rivalGap}
        else if(k==='host'){r.shrine=1;r.host=1;r.fnext=y+Z.finalGap;s.maxHp+=Z.hostHp;ch.hp+=Z.hostHp;s.mindMax=(s.mindMax||0)+Z.hostMind;ch.mind=Math.min(ch.mind,mindMax(ch));routeWeaponUp(ch,'hw','host',chips);(ch.relics=ch.relics||[]).push('선황충');chips.push(`선황충 · 최대 HP +${Z.hostHp} · 최대 정신력 ${Z.hostMind} · 전투 시작 빛 +${Z.hostLight}`)}
        else if(k==='break'){r.shrine=1;r.broke=1;ch.purge='hw_kamo';routeWeaponUp(ch,'hw','free',chips);chips.push(`재갈 ${hwHave(ch).length}개 · 흑수 부하가 모두 철함사로 나선다`)}
        else if(k==='refuse'){r.shrine=1;ch.purge='hw_elder';routeWeaponUp(ch,'hw','free',chips)}
        else if(k==='final'){r.finalSeen=1;ch.purge='hongru'}}}
    if(fx.giri){const k=fx.giri,fl=ch.flags;
      if(k==='start'){fl.giri=1;(ch.relics=ch.relics||[]).push('원한의 책 · 찢어낸 장부 세 장');chips.push('의리 순례 · 장부의 첫 이름을 찾아간다')}
      else if(k==='later'){ch.giriAt=(ch.year||0)+CFG.giri.gap;chips.push('원한의 책 · 몇 해 뒤에 다시 부른다')}
      else if(k==='obey'){fl.giriChoice=1;fl.giriObey=1;chips.push('형님의 징벌을 받아들인다')}
      else if(k==='rebel'){fl.giriChoice=1;fl.giriRebel=1;fl.giriTraitor=1;ch.titles=ch.titles||[];if(!ch.titles.includes('의리를 찢은 자')){ch.titles.push('의리를 찢은 자');(ch.titleLog=ch.titleLog||[]).push('의리를 찢은 자')}chips.push('장부를 찢었다 · 칭호 의리를 찢은 자 · 중지의 금기 · 이후 가족이 쫓아온다')}}
    if(fx.synRoute){const k=fx.synRoute,fl=ch.flags;
      if(k==='accept'){fl.thumbOffer=1;fl.thumbTurn=1;ch.purgeAt=(ch.year||0)+CFG.synRoute.purgeGap;const was=ch.aff.name;joinAff(ch,{type:'finger',from:'finger'},'엄지',chips);while((ch.fi??-1)<2){const st=fingerStep(ch);if(!st)break;chips.push(...st)}chips.push(`${was}의 패시브를 잃는다`)}
      else if(k==='snub'){fl.thumbOffer=1;fl.thumbSnub=1;ch.purgeAt=(ch.year||0)+CFG.synRoute.purgeGap;chips.push('엄지가 마땅치 않게 본다')}
      else if(k==='rebel'){fl.purgeSeen=1;fl.thumbRebel=1;chips.push('반역 · 엄지의 대모가 움직인다')}
      else if(k==='bow'){fl.purgeSeen=1;fl.thumbBow=1;ch.money+=earn(ch,150);chips.push('고개를 숙인다 · 이 길은 닫힌다')}
      else if(k==='traitor'){fl.traitor=1;chips.push('역적 · S사의 절도사가 온다')}
      else if(k==='traitorFlee'){fl.traitor=1;ch.hp=clamp(ch.hp-CFG.synRoute.fleeHp,1,ch.stats.maxHp);chips.push(`HP −${CFG.synRoute.fleeHp} · 역적 · S사의 절도사가 온다`)}}
    if(fx.eastScout&&!isN(ch)){joinAff(ch,{type:'wing',from:'wing'},CFG.nWing.name,chips);ch.eastScoutDone=true;for(let i=ch.fi||0;i<CFG.eastN.startFi;i++){ch.promos=(ch.promos||0)+1;const c=careerStep(ch);if(c)chips.push(...c)}}
    if(fx.oracleFail){ch.oracleTries=(ch.oracleTries||0)+1;ch.oracleNext=(ch.year||0)+CFG.oracle.every}
    if(fx.oracleDecline)ch.oracleTries=CFG.oracle.tries;
    if(fx.custOpen)ch.custPick=true;
    if(fx.pinky&&!ch.pinky){ch.pinkyYear=ch.year||0;ch.pinky=true;addStats(s,D.pinky.fx);chips.push(D.pinky.n+' 표식 · '+D.pinky.e)}
    if(fx.examPass){const need=promoNeed(ch),p=promoteAny(ch);if(p){chips.push(...p.chips);ch.pp=Math.max(0,(ch.pp||0)-need);ch.promos=(ch.promos||0)+1;ch.strikes=0}}
    if(fx.examFail){
      const k=career(ch),C_=CR[k]||{},lost=Math.floor((ch.pp||0)*(C_.lose||CFG.promo.loseFrac));
      ch.pp=(ch.pp||0)-lost;chips.push(`${ptsName(ch)} −${lost} (${ch.pp}/${promoNeed(ch)})`);
      if(C_.failHp){ch.hp=clamp(ch.hp+C_.failHp,1,s.maxHp);chips.push('HP '+sg(C_.failHp))}
      ch.strikes=(ch.strikes||0)+1;
      if(C_.strikes&&ch.strikes>=C_.strikes){
        ch.strikes=0;
        if(C_.strike==='fire'){chips.push(`${ch.aff.name} 해고 · 소속을 잃었다`);if(ch.wtrain&&ch.aff.name==='W사 날개'){ch.wtrain=false;chips.push('W사 열차에서도 내려졌다 · 열차 일은 이어지지 않는다')}ch.aff=null;ch.fi=undefined;ch.fr=null;ch.pp=0;ch.promos=0;if(ch.rb&&ch.rb.out)rbFlee(ch,chips);
          /* 날개를 잃으면 아직 날개를 세우지 못한 특이점 개발 길도 끊긴다 (대표는 해고된 사람이 될 수 없다) */
          if(ch.corp&&ch.corp.st==='dev'){ch.corp.st='declined';chips.push('특이점 개발 · 날개를 잃어 개발이 중단된다')}}
        if(C_.strike==='purge'){ch.purge=C_.purgeFoe;chips.push('숙청 대상이 되었다')}
      }
    }
    if(fx.topPass){const C_=CR[career(ch)];ch.title=isN(ch)&&isEastOuter(ch)?CFG.nWing.eastTitle:C_.topTitle;ch.titleKind='top';ch.topTries=0;ch.topNext=0;(ch.titleLog=ch.titleLog||[]).push(ch.title);addStats(s,C_.topFx||{});if((C_.topFx||{}).maxHp)ch.hp+=C_.topFx.maxHp;chips.push('칭호 · '+ch.title);if(lakeOn(ch)){ch.lake=ch.lake||{};ch.lake.captain=true;ch.lake.capYear=ch.year||0;chips.push('목표 · 대재앙 토벌');chips.push(`배를 얻었다 · 배 내구도 ${CFG.lake.hullMax}/${CFG.lake.hullMax}`);chips.push(`전투마다 내구도 -${CFG.lake.hullWear} · 파도에서는 크게 잃는다 · 항구에서 ${CFG.lake.repairCost}안으로 수리 · 0이 되면 침몰`);lakeCards(ch,C_.topRow,chips,'선장')}if(C_.topMinRank&&ch.licensed&&ch.rank>C_.topMinRank){ch.rank=C_.topMinRank;chips.push(`해결사 급수 ${ch.rank}급`)}const L_=C_.topLoot;if(L_){addStats(s,L_.fx);if(L_.fx.maxHp)ch.hp+=L_.fx.maxHp;(ch.relics=ch.relics||[]).push(L_.n);chips.push(`전리품 · ${L_.n} (${L_.e})`)}}
    if(fx.topFail)topFailed(ch,chips,'심사')
    if(fx.examSkip)ch.examSkipYear=ch.year;
    if(fx.colorPass){if(ch.titleKind==='top'){ch.title2=ch.title;ch.topTries=0}ch.colorDone=true;ch.colorYear=ch.year||0;if(CFG.colorReward){const up=k=>{const b=s[k];s[k]=Math.max(b+1,Math.round(b*CFG.colorMul));return s[k]-b},mh=Math.round(s.maxHp*CFG.colorMul)-s.maxHp;const ga=up('atk'),ge=up('eva'),gs=up('spd');s.maxHp+=mh;ch.hp+=mh;chips.push(`특색 · 모든 능력치 ×${CFG.colorMul} (공격 +${ga} · 회피 +${ge} · 속도 +${gs} · 최대 HP +${mh})`);ch.colorPick=true;chips.push('특색 패시브 · 셋 중 하나를 고른다')}ch.title=D.colors[ch.ci].adj+' '+one(D.titleWords[ch.dom||'atk']);ch.titleKind='color';(ch.titleLog=ch.titleLog||[]).push('특색');ch.titlePick=true;chips.push(T.titleLabel+' · '+ch.title);if(ch.colorFx){addStats(s,ch.colorFx);ch.hp+=ch.colorFx.maxHp||0;chips.push('E.G.O 적성자 · 특색 · 모든 능력치 +5')}}
    if(fx.colorFail)topFailed(ch,chips,T.titleLabel+' 심사')
    let licensed=false;
    if(fx.license){licensed=license(ch);if(licensed){chips.push(T.licenseGained+' · '+ch.rank+T.rankUnit);alignEast(ch,chips)}}
    return {chips,licensed};
  }
  /* 레벨 상한 없음(표는 120레벨까지 만들어 둔다): 레벨당 필요 경험치는 8, 16, 24… 레벨부터 2배씩 늘어난다 (CFG.lvCurve) */
  const xpFor=l=>CFG.levels[Math.min(l,CFG.levels.length)-1];
  function lvOf(xp){let l=1;while(xp>=xpFor(l+1))l++;return l}
  const xpNext=ch=>xpFor(ch.lv+1);
  function gainXp(ch,n){const b=ch.lv;if(hasInn(ch,'scholar')&&n>0){ch.xpAcc=(ch.xpAcc||0)+n*(CFG.innate.scholarMul-1);const x=Math.floor(ch.xpAcc+1e-9);if(x>0){ch.xpAcc-=x;n+=x}}ch.xp+=n;ch.lv=lvOf(ch.xp)+(ch.lvBonus||0);ch.lvPend+=ch.lv-b;return ch.lv-b}
  /* 덱이 고정(책장·전용 카드팩)이면 카드를 받을 수 없으므로 '보상 카드' 성장은 선택지에서 뺀다 */
  const WSMAT={n:'비장 재료',e:'히든 강화재료 1개 · 어떤 전용 장비든 녹이면 히든 한 단계',fx:{wsMat:1}};
  function rollGrowth(ch){
    const out=[],locked=!!(ch&&(ch.deckLocked||ch.cardMoney));let g=0;
    const wsm=!!(ch&&isWs(ch));
    while(out.length<3&&g++<80){const r=d(100);let x=pick(D.growth,r);if(wsm&&x.fx&&x.fx.reward)x=WSMAT;if(locked&&x.fx&&x.fx.reward)continue;if(!out.some(o=>o.g===x))out.push({r,g:x})}
    return out;
  }

  /* ===== 조우 =====
     "table:<이름>"이면 1d100으로 조우 표를 굴린다. 소속 전용 표(<이름>@<소속 종류>)가 있으면 그것을 쓴다 */
  /* 격리 실패: 아직 이기지 않은 환상체 보스 중 하나 */
  /* after: 그 환상체(아종 등)를 먼저 이겨야 나온다 (예: 크고 나쁜 늑대 → 커다랗고 나쁠 늑대) */
  const abnoLeft=ch=>Object.keys(D.enemies).filter(id=>{const e=D.enemies[id],m=ch.minis||[];return e.breach&&!m.includes(id)&&(!e.after||m.includes(e.after))});
  function encounter(ch,s){
    if(s==='abno'){const ls=abnoLeft(ch),AP=CFG.apoc,bl=ls.filter(x=>AP.birds.includes(x)),started=AP.birds.some(x=>(ch.minis||[]).includes(x));
      /* 새 시리즈를 시작했으면 남은 새를 먼저 만난다 */
      const MG=CFG.mgirl;
      const mgl=ls.filter(x=>MG.ids.includes(x)),mgDone=MG.ids.filter(x=>(ch.minis||[]).includes(x)).length;
      const pool=mgl.length&&d(100)<=(MG.pref[mgDone]||0)?mgl:ls;
      const id=ls.length?(started&&bl.length&&d(100)<=AP.pref?one(bl):one(pool)):'lullaby';return {id,roll:null,table:null,label:'격리 실패'}}
    if(!s.startsWith('table:'))return {id:s,roll:null,table:null};
    const name=s.slice(6),T_=D.encounters.tables;
    /* 라만차랜드 루트(혈귀)는 소속보다 먼저 */
    const key=ch.hw&&!ch.hw.out&&!ch.hw.done&&T_[`${name}@hwhome`]?`${name}@hwhome`:ch.flags&&ch.flags.lamancha&&T_[`${name}@lamancha`]?`${name}@lamancha`:ch.wtrain&&T_[`${name}@wtrain`]?`${name}@wtrain`:ch.aff&&T_[`${name}@${ch.aff.type}`]?`${name}@${ch.aff.type}`:name;
    /* 같은 조직의 적(enemy.org가 내 소속 종류나 내 소속 이름과 같음)은 배신자·명부의 처리 대상(enemy.traitor)이 아니면 만나지 않는다. 방금 싸운 적도 되도록 피한다 */
    const mine=new Set();if(ch.aff){mine.add(ch.aff.name);mine.add((D.orgs.syn||[]).includes(ch.aff.name)?'syn':ch.aff.type)}
    /* H사 홍원 가문의 후보는 도시의 조직(손가락·조직·협회·날개·사무소·공방)과 얽히지 않는다: 소속 표시가 있는 적은 만나지 않는다 */
    const house=!!ch.hw&&!ch.hw.out&&!ch.hw.done;
    const blocked=i=>{const e=D.enemies[i],o=e&&e.org;return !!o&&(house||(!e.traitor&&[].concat(o).some(x=>mine.has(x))))};
    let r,id;
    for(let t=0;t<30;t++){
      r=d(100);id=pick(T_[key],r).enemy;
      /* once: 한 번 이긴 미니보스는 다시 나오지 않는다 (표의 첫 적으로 바뀜) */
      if(D.enemies[id].once&&(ch.minis||[]).includes(id))id=T_[key][0].enemy;
      if(!blocked(id)&&(id!==ch.lastEnc||t>=6))break;
    }
    if(blocked(id)){const ok=T_[key].find(x=>!blocked(x.enemy));if(ok)id=ok.enemy}
    ch.lastEnc=id;
    return {id,roll:r,table:name,label:D.encounters.labels[name]||name};
  }

  /* ===== 진행 (7년) ===== */
  /* 조건: licensed / unlicensed / aff(소속 있음) / noaff / aff:<종류> / affname:<이름> / rank<=N /
     flag:<이름>[>=n]. 배열은 모두, {any:[...]}는 하나라도 */
  function meets(ch,req){
    if(!req)return true;
    if(Array.isArray(req))return req.every(r=>meets(ch,r));
    if(req.any)return req.any.some(r=>meets(ch,r));
    if(req.startsWith('noflag:'))return !ch.flags[req.slice(7)];
    if(req.startsWith('flag:')){const [k,n]=req.slice(5).split('>=');return (ch.flags[k]||0)>=(+n||1)}
    if(req.startsWith('lead:')){const [k,n]=req.slice(5).split('>=');return ((ch.leads||{})[k]||0)>=(+n||1)}
    if(req==='color')return !!(ch.colorDone||ch.titleKind==='color');   // 특색에 닿은 사람
    if(req==='nocolor')return !(ch.colorDone||ch.titleKind==='color');
    if(req==='fingerup')return canFingerUp(ch);
    if(req.startsWith('corpup<'))return ((ch.corp&&ch.corp.up)||0)<+req.slice(7);
    if(req.startsWith('corpup>='))return ((ch.corp&&ch.corp.up)||0)>=+req.slice(8);
    if(req==='pinky')return !!ch.pinky;
    if(req==='nopinky')return !ch.pinky;
    /* beat:any = 히든 보스를 하나라도 이김, beat:a|b = 그중 하나를 이김 */
    if(req==='beat:any')return ch.beaten.length>0;
    if(req.startsWith('beat:'))return req.slice(5).split('|').some(id=>ch.beaten.includes(id));
    if(req.startsWith('nobeat:'))return !req.slice(7).split('|').some(id=>ch.beaten.includes(id));
    if(req.startsWith('fi<'))return isFinger(ch)&&(ch.fi||0)<+req.slice(3);
    if(req.startsWith('fi>='))return isFinger(ch)&&(ch.fi||0)>=+req.slice(4);
    if(req.startsWith('notaffname:'))return !(ch.aff&&ch.aff.name===req.slice(11));
    if(req.startsWith('affname:'))return !!ch.aff&&ch.aff.name===req.slice(8);
    if(req.startsWith('rank<='))return ch.licensed&&ch.rank<=+req.slice(6);
    if(req.startsWith('rankin:')){const [a,b]=req.slice(7).split('-').map(Number);return ch.licensed&&ch.rank>=a&&ch.rank<=b}
    if(req.startsWith('memo:')){const [k,v]=req.slice(5).split('='),m=ch.memo&&ch.memo[k];return !!m&&!m.done&&(v==null||m.v===v)}
    if(req.startsWith('memoyears:')){const [k,n]=req.slice(10).split('>='),m=ch.memo&&ch.memo[k];return !!m&&(ch.year||0)-m.y>=+n}
    if(req.startsWith('year>='))return (ch.year||0)>=+req.slice(6);
    if(req.startsWith('age<='))return 16+(ch.year||0)<=+req.slice(5);   // 나이 = 16 + 연차 (연차 1 = 17세)
    if(req.startsWith('ledger:')){const [k,n]=req.slice(7).split('>=');return ((ch.ledger||{})[k]||0)>=+n}
    if(req==='inf')return !!ch.infinite;
    if(req==='wtrain')return !!ch.wtrain;
    if(req.startsWith('wfi:')){const [a,b]=req.slice(4).split('-').map(Number),i=ch.fi||0;return !!ch.wtrain&&i>=a&&i<=b}
    if(req==='licensed')return ch.licensed;
    if(req==='unlicensed')return !ch.licensed;
    if(req.startsWith('noflag:'))return !ch.flags[req.slice(7)];
    if(req==='nohyeol')return ch.race!=='hyeolgwi';
    if(req==='noeast')return !((ch.o&&ch.o.hidden)||isN(ch));   // 숨은 출생과 N사 같은 특수한 소속은 혈귀의 초대를 받지 않는다
    if(req==='freedeck')return !ch.cardMoney&&!ch.deckLocked&&!ch.packOffer;   // 혈귀 전용 책장을 받을 수 있는 덱 상태
    if(req==='noroute')return !ch.rb&&!ch.hw;
    if(req==='bondmarried')return !!(ch.bond&&ch.bond.st==='married');
    if(req==='bondlost')return !!(ch.bond&&ch.bond.st==='lost');
    if(req==='nobond')return !(ch.bond&&(ch.bond.st==='married'||ch.bond.st==='lost'));
    {const al=(ch.bond&&ch.bond.kids||[]).filter(k=>!k.dead&&!k.pend);
      if(req==='kidsany')return al.length>0;if(req==='nokids')return al.length===0;
      if(req==='grand')return al.some(k=>k.grand);if(req==='kidsonly')return al.length>0&&!al.some(k=>k.grand)}
    if(req==='nofinger')return !isFinger(ch);
    if(req==='nojob')return !ch.job;
    if(req==='canfix')return !noFixer(ch);
    /* 내 사무소(대표) / 남의 사무소 직원 */
    if(req==='ownoffice')return (!!ch.aff&&!!ch.aff.own)||(!!ch.office&&isWs(ch));
    if(req==='notown')return !((ch.aff&&ch.aff.own)||(ch.office&&isWs(ch)));
    if(req==='aff')return !!ch.aff;
    if(req==='noaff')return !ch.aff&&!isFounder(ch);
    if(req.startsWith('aff:'))return !!ch.aff&&ch.aff.type===req.slice(4);
    return true;
  }
  /* ===== 정신력 ===== */
  const M=CFG.mind;
  const mindFloor=ch=>ch.ego?M.ego[ch.ego.type].floor:0;
  /* 성장기 '목소리가 들림': 정신력 최대치 +5 */
  const mindMax=ch=>Math.min(M.cap||Infinity,M.max+((ch.stats&&ch.stats.mindMax)||0));
  /* ===== 전투 중 정신력이 0이 되면: 50% E.G.O 개화, 아니면 육신 뒤틀림 (둘 다 그 자리에서 전투에 반영) =====
     이름은 전투가 끝난 뒤 정한다 (ch.namePend) */
  let activeC=null;
  /* 목소리 선택(듣기 좋다/싫다)에 따른 개화 확률 보정: 좋다 −20%p, 싫다 +20%p */
  const biasOf=ch=>ch.voiceBias==='good'?-CFG.mind.voiceBias:ch.voiceBias==='bad'?CFG.mind.voiceBias:0;
  const clampN=(v,a,b)=>Math.max(a,Math.min(b,v));
  function mindBreak(C){
    const ch=C.ch,P=C.P,s=ch.stats;
    if(ch.ego||ch.distForm||C.mindHandled)return;
    C.mindHandled=true;
    const L=(t,x)=>{if(C.quiet)return;C.log.push({t,s:x});C.cur.push({t,s:x})};
    const th_=50+biasOf(ch),r=d(100),sg_=r>th_&&(s.egoSight||0)>0&&d(100)<=s.egoSight,ok=r<=th_||sg_;L('sys',`${P.name} · 정신력 0 · 마음이 한계에 닿았다 · 1d100 ${r} (${th_} 이하면 E.G.O 개화, 아니면 뒤틀림)`);if(sg_)L('kw',`  장비의 형상이 보였다 · ${s.egoSight}% · E.G.O 개화`);
    if(!C.quiet)C.rollPend={k:'break',r,th:th_,ok,sight:sg_,at:0};
    const b={atk:s.atk,eva:s.eva,spd:s.spd,maxHp:s.maxHp};
    ch.mindDead=false;
    if(ok){
      const type=d(2)===1?'atk':'def';setEgo(ch,type,'');ch.namePend='ego';
      P.egoLight=M.light;P.egoRounds=M.lightRounds;
      ch.bloomNote=`전투 중 정신력 0 · E.G.O 개화 (${M.ego[type].n}) · 이름을 정한다`;
      L('kw',`  E.G.O 개화 · ${M.ego[type].n} · 정신력 ${ch.mind}로 회복${M.ego[type].hit?` · 공격 +${M.ego[type].hit}`:''}${M.ego[type].hp?` · 최대 HP +${M.ego[type].hp}`:''}`);
    }else{
      setDistort(ch,'');ch.namePend='dist';
      P.distorted=true;P.wx=null;P.laev=null;P.hwando=false;P.resonance=false;P.thumb=false;P.deck=ch.deck;P.dmin=s.dmin;P.pdie=s.pdie;P.dmgB=s.dmgB||0;P.burnHit=s.burnHit||0;
      ch.bloomNote='전투 중 정신력 0 · 육신이 뒤틀렸다 · 이름을 정한다';
      L('kw',`  육신이 뒤틀린다 · 능력치가 크게 오른다 · 뒤틀림 전용 카드를 얻는다 · 손패는 다음 라운드부터 뒤틀린 책장`);
    }
    for(const k of ['atk','eva','spd'])P[k]+=s[k]-b[k];
    P.maxHp+=s.maxHp-b.maxHp;P.hp=clampN(P.hp+(s.maxHp-b.maxHp),1,P.maxHp);
  }
  /* 전투 뒤 이름 정하기: E.G.O 개화·뒤틀림 이름 */
  function renameForm(ch,name){
    const err=egoNameErr(name);if(err)return err;
    const n=name.trim();
    if(ch.namePend==='ego'){const i=(ch.relics||[]).indexOf('E.G.O · ');ch.ego.n=n;if(i>=0)ch.relics[i]=`E.G.O · ${n}`}
    else if(ch.namePend==='dist'){const i=(ch.relics||[]).indexOf('뒤틀림 · '+ch.distForm.n);ch.distForm.n=n;if(i>=0)ch.relics[i]='뒤틀림 · '+n}
    ch.namePend=null;return null;
  }
  function loseMind(ch,n,out){
    if(n<=0||ch.distForm)return;if(hasInn(ch,'will'))n=Math.ceil(n*CFG.innate.willCut);const m0=ch.mind;ch.mind=Math.max(mindFloor(ch),ch.mind-n);
    if(ch.mind<m0&&out)out(`정신력 −${m0-ch.mind} (${ch.mind}/${mindMax(ch)})`);
    if(ch.ego)return;
    /* 뒤틀림은 전투가 끝난 뒤 사건에서 고른다: 아직 그 사건을 겪지 않았으면 정신력 1에서 버틴다 */
    if(ch.mind<=0&&!ch.distortDone){ch.mind=1;out&&out('정신력 1 · 마음이 한계 끝에서 버틴다 (전투가 끝나면 고른다)')}
    if(ch.mind<=0){if(activeC&&activeC.ch===ch&&!activeC.over)mindBreak(activeC);else ch.mindDead=true}
    else if(ch.mind===1&&!ch.distortDone){if(bondMarried(ch)&&!ch.bond.saved){ch.bond.saved=true;ch.mind=CFG.bond.saveMind;out&&out(`가족의 목소리 · ${ch.bond.name}의 목소리가 당신을 붙잡았다 · 정신력 ${ch.mind}`)}else ch.distortPend=true}
    else if(ch.mind<=M.voiceAt&&!ch.voiceUsed)ch.voicePend=true;
  }
  const gainMind=(ch,n)=>{if(ch.distForm)return 0;const m0=ch.mind;ch.mind=Math.min(mindMax(ch),ch.mind+n);return ch.mind-m0};
  const mindTier=ch=>ch.distForm?null:M.tiers.find(t=>ch.mind>=t.at)||null;
  /* 정신력이 stat.at 각 값 이상일 때마다 모든 능력치 +1 (최대 6) */
  const mindStat=ch=>ch.distForm?0:M.stat.at.filter(x=>ch.mind>=x).length;
  /* E.G.O 이름: 1~12글자, 게임에 있는 물건·전리품·유물·카드 이름과 같으면 안 된다 (띄어쓰기 무시) */
  function egoTaken(){
    const n=new Set(),add=x=>{if(x)n.add(String(x).replace(/\s/g,''))};
    for(const o of [D.items,D.special,D.cards])for(const v of Object.values(o||{}))add(v.n);
    for(const v of Object.values(D.relics||{})){add(v.n);if(v.open)add(v.open.n)}
    for(const v of Object.values(D.hiddenJobs||{})){add(v.n);if(v.weapon)add(v.weapon.n)}
    for(const e of Object.values(D.enemies)){if(e.drop){add(e.drop.n);if(e.drop.gear)add(e.drop.gear.n);for(const x of e.drop.extra||[])add(x.n)}}
    return n;
  }
  function egoNameErr(name){
    const w=(name||'').trim();
    {const e=nameErr(w,{space:true});if(e)return e}
    if(egoTaken().has(w.replace(/\s/g,'')))return '이미 게임에 있는 물건·전리품·유물·카드 이름이다';
    return null;
  }
  function setEgo(ch,type,name){
    const e=M.ego[type];ch.ego={type,n:name.trim()};ch.egoPick=false;ch.voiceUsed=true;ch.voicePend=false;ch.distortPend=false;
    if(e.hit)ch.stats.atk+=e.hit;if(e.hp){ch.stats.maxHp+=e.hp;ch.hp+=e.hp}
    if(e.eva)ch.stats.eva+=e.eva;
    /* 고정 전용 카드: 덱 최대 장수 +1 자리에 들어간다 (적성자는 이미 전용 카드가 있다). 덱이 고정이어도 넣는다 */
    if(e.card&&!ch.deck.includes('e_manifest')&&!ch.deck.includes(e.card))ch.deck.push(e.card);
    ch.mind=Math.max(ch.mind,e.floor);(ch.relics=ch.relics||[]).push(`E.G.O · ${ch.ego.n}`);
  }
  /* ===== 6시즌: 기업 루트 (날개 직원 → 특이점 개발 → 날개 설립 → 강화·금기 실험 → 머리의 시험) =====
     ch.corp = {st: 'offer'|'dev'|'wing'|'declined', type, n, stack(개발 진척), up(강화), forb(금기 실험), wing, next(다음 사건 해), chain[], headSeen} */
  const CP=CFG.corp,CSTAT={maxHp:'최대 HP',atk:'공격',eva:'회피',spd:'속도',check:'사건 판정',mindMax:'최대 정신력'};
  function corpBump(ch,fx,chips){
    const s=ch.stats;
    for(const [k,v] of Object.entries(fx)){if(!v)continue;s[k]=(s[k]||0)+v;if(k==='maxHp')ch.hp+=v;chips&&chips.push(`${CSTAT[k]} ${sg(v)}`)}
  }
  const corpYes=ch=>!!ch.corp&&['dev','wing'].includes(ch.corp.st);
  const corpType=ch=>corpYes(ch)&&ch.corp.type?CP.types[ch.corp.type]:null;
  const singNameErr=egoNameErr;
  function wingNameErr(n){
    {const e=nameErr(n);if(e)return e}
    if((D.orgs.wing||[]).includes(n+' 날개'))return '이미 있는 날개 이름이다';
    return null;
  }
  /* 특이점 개발 참여: 효과 하나와 이름. force는 이름 검사를 건너뛴다 (자동 진행) */
  function setSing(ch,type,name,force){
    const T_=CP.types[type];if(!T_||!ch.corp||(!force&&singNameErr(name)))return false;
    ch.corp=Object.assign(ch.corp,{st:'dev',type,n:name.trim(),stack:0,up:0,forb:0,next:(ch.year||0)+CP.devGap});
    corpBump(ch,T_.base||{});ch.singPick=false;(ch.relics=ch.relics||[]).push(`특이점 · ${ch.corp.n} (${T_.n})`);return true;
  }
  /* 특수환: 고른 능력치가 영구히 오른다. 자동 진행(고르지 않고 넘어옴)이면 첫 번째 능력치 */
  const colorPasv={brand:{n:'낙인',e:'내가 거는 상태 이상(출혈·화상·파열 등)이 +2씩 더 쌓인다'},regen:{n:'재생',e:'매 라운드 HP +5'},strike:{n:'일격',e:'모든 타격 피해 +3'}};
  function setColorPick(ch,k){
    if(!ch.colorPick||!colorPasv[k])return false;
    ch.colorPick=false;ch.colorPasv=k;if(k==='regen')ch.stats.regen+=5;else if(k==='strike')ch.stats.dmgB+=3;
    (ch.relics=ch.relics||[]).push(`특색 패시브 · ${colorPasv[k].n} · ${colorPasv[k].e}`);return true;
  }
  const pillStats={atk:'공격',eva:'회피',spd:'속도',check:'사건 판정'};
  function setPill(ch,k,v){
    if(!ch.pillPick||!pillStats[k])return false;
    ch.stats[k]+=v||10;ch.pillPick=false;(ch.relics=ch.relics||[]).push(`특수환 · ${pillStats[k]} +${v||10}`);return true;
  }
  const singChips=ch=>{const t=corpType(ch);return t?[t.e.split(' (')[0]]:[]};
  function setWing(ch,name,force){
    if(!ch.corp||(!force&&wingNameErr(name)))return false;
    ch.corp.wing=name.trim()+' 날개';ch.corp.st='wing';ch.corp.next=(ch.year||0)+CP.labGap;ch.wingPick=false;
    (ch.relics=ch.relics||[]).push(`설립 · ${ch.corp.wing}`);
    /* 임원이 되기 전에 날개를 세우면 승진이 끝난다: 최고 직급 몫의 4코스트 카드를 대표가 되는 때 준다 */
    {const C_=ch.aff&&ch.aff.type==='wing'&&D.careers.wing;if(C_){const o=[];giveFinalCards(ch,C_,o,'날개 대표');}}
    return true;
  }
  function corpGrow(ch,chips){const c=ch.corp;if(!corpYes(ch)||c.st!=='dev')return;c.stack++;corpBump(ch,CP.grow,chips);chips.push(`특이점 개발 ${c.stack}/${CP.devMax}`)}
  /* 특이점 실효 강화 단계: 강화(최대 3) + 금기 실험을 끝까지 했을 때의 2차 강화(+2) */
  const corpLv=ch=>((ch.corp&&ch.corp.up)||0)+((ch.corp&&ch.corp.up2)||0);
  function corpUp2(ch,chips){
    const c=ch.corp;if(!corpYes(ch)||c.up2||c.forb<CP.forbMax)return;c.up2=CP.up2;const T_=CP.types[c.type];
    for(let i=0;i<CP.up2;i++){corpBump(ch,CP.up,chips);corpBump(ch,T_.per||{},chips)}
    chips.push(`특이점 ${c.n} 2차 강화 · 강화 +${CP.up2} (효과가 더 강해진다)`);
  }
  function corpUp(ch,chips){
    const c=ch.corp;if(!corpYes(ch)||c.up>=CP.upMax)return;c.up++;const T_=CP.types[c.type];
    corpBump(ch,CP.up,chips);corpBump(ch,T_.per||{},chips);chips.push(`특이점 ${c.n} 강화 ${c.up}/${CP.upMax}`);
  }
  function corpForb(ch,chips){
    const c=ch.corp;if(!corpYes(ch)||c.forb>=CP.forbMax)return;c.forb++;ch.flags.taboo=(ch.flags.taboo||0)+1;bondTaboo(ch);corpBump(ch,CP.forb,chips);chips.push(`금기 실험 ${c.forb}/${CP.forbMax}`);
    /* 발톱·조율자를 이미 이겼으면 장비 없이 돈과 경험치만 주는 재시험(발톱·조율자 재시험)이 찾아온다: 실험마다 huntChance%, 마지막(8/8)은 둘 다 확정 */
    if(CP.chain.every(id=>ch.beaten.includes(id))){const last=c.forb>=CP.forbMax;
      if(last)c.hunt=CP.chain.map(id=>id+'_x');else if(d(100)<=CP.huntChance)(c.hunt=c.hunt||[]).push(one(CP.chain)+'_x');
      if((c.hunt||[]).length)chips.push('머리가 강화된 시험을 보낸다');}
    if(c.forb>=CP.forbMax){c.chain=CP.chain.filter(id=>!ch.beaten.includes(id));chips.push('머리가 당신을 주시한다');corpUp2(ch,chips);corpClearCheck(ch,chips)}
  }
  /* 머리의 시험 상대(발톱·조율자)를 이미 모두 이긴 몸이면 시험 없이 바로 넘은 것으로 친다 (예전에는 아무 일도 일어나지 않던 문제) */
  function corpClearCheck(ch,chips){
    const c=ch.corp;if(!c||c.cleared||c.forb<CP.forbMax||(c.chain||[]).length||c.trial)return false;
    if(!CP.chain.every(id=>ch.beaten.includes(id)))return false;
    c.headSeen=true;c.cleared=true;chips&&chips.push('머리의 시험 상대는 이미 쓰러뜨렸다 · 머리의 시험을 넘었다');corpBump(ch,CP.clear,chips||[]);return true;
  }
  /* ===== 인연(동반자) =====
     ch.bond = {st: 'pick'(이름 정하는 중)|'met'|'married'|'lost'(배우자의 죽음)|'left'(결혼 전에 떠남)|'declined', kids[{n,born,job,told}], route, name, step, tries, love, since, next, saved} */
  const BD=CFG.bond;
  const bondGap=()=>BD.gap[0]+d(BD.gap[1]-BD.gap[0]+1)-1;
  /* 이름은 마음대로 짓는 것이라 성별을 정하지 않는 표현만 쓰고, 이름 뒤 조사(은/는·이/가·과/와)는 받침에 맞춘다 */
  const bondFill=(t,b)=>{const name=(b&&b.name)||'그 사람',c=name.charCodeAt(name.length-1),fin=c>=0xAC00&&c<=0xD7A3&&(c-0xAC00)%28!==0;
    return String(t||'').replace(/\{n\}(은|이|과)?/g,(m,j)=>name+(j?(j==='은'?(fin?'은':'는'):j==='이'?(fin?'이':'가'):(fin?'과':'와')):''))};
  function bondNameErr(n){n=(n||'').trim();if(!n)return '이름을 적는다';if(n.length>12)return '12글자까지 쓸 수 있다';return ''}
  function setBondName(ch,name,force){
    const b=ch.bond;if(!b||b.st!=='pick'||(!force&&bondNameErr(name)))return false;
    b.name=(name||'').trim()||'그 사람';b.st='met';b.since=ch.year||0;b.next=(ch.year||0)+bondGap();ch.bondPick=false;return true;
  }
  /* 아이 이름: 태어날 때 직접 짓는다. 비워 두면 미리 정해진 이름으로 부른다 */
  function kidNameErr(ch,n){n=(n||'').trim();if(!n)return '';if(n.length>12)return '12글자까지 쓸 수 있다';if((ch.bond&&ch.bond.kids||[]).some(k=>!k.pend&&k.n===n))return '이미 부르는 아이의 이름이다';return ''}
  function setKidName(ch,name,force){
    const k=(ch.bond&&ch.bond.kids||[]).find(x=>x.pend);if(!ch.kidPick)return false;
    if(!k){ch.kidPick=false;return false}
    if(!force&&kidNameErr(ch,name))return false;
    const n=(name||'').trim();if(n&&!kidNameErr(ch,n))k.n=n;delete k.pend;ch.kidPick=false;return true;
  }
  /* 붉은 머리 인연(freelance): 2급이던 상대가 1급이 되어 특색을 받는다. 내 색을 뺀 색 하나가 무작위로 정해지고 이름은 함께 고민한다. 이후 몇 해마다 특색 해결사로서의 행적이 들려온다 */
  function partnerAliasErr(n){n=(n||'').trim();if(n.length<2)return '2글자부터 쓸 수 있다';if(n.length>12)return '12글자까지 쓸 수 있다';return ''}
  function setPartnerAlias(ch,name,force){
    const b=ch.bond;if(!ch.bondColPick||!b||!b.col){ch.bondColPick=false;return false}
    if(!force&&partnerAliasErr(name))return false;
    const n=(name||'').trim();b.alias=n.length>=2?n:b.col.adj+' 칼날';b.colAt=ch.year||0;b.deedAt=b.colAt;ch.bondColPick=false;return true;
  }
  const partnerFill=(t,ch)=>{const b=ch.bond;return bondFill(t,b).replace(/\{a\}/g,b.alias||'').replace(/\{c\}/g,(b.col&&b.col.adj)||'')};
  function bondPartnerEvent(G){
    const ch=G.ch,b=ch.bond,B=D.bond,P=CFG.bond.partner;
    if(!b||b.route!=='freelance'||!B||!B.partnerRise||ch.distForm||ch.job||!['met','married'].includes(b.st))return null;
    if(!b.col){
      if((G.year-(b.since||0))<P.gap)return null;
      const E_=JSON.parse(JSON.stringify(B.partnerRise));
      E_.x=bondFill(E_.x,b);E_.c.forEach(c=>{c.h=bondFill(c.h,b);c.ok.t=bondFill(c.ok.t,b);c.ok.fx={bondCol:true}});
      return E_;
    }
    if(!b.alias||G.year-(b.deedAt||0)<P.deedEvery)return null;
    b.deedAt=G.year;
    const seen=b.deedSeen=b.deedSeen||[],S=B.partnerDeeds;let pool=S.map((e,i)=>i).filter(i=>!seen.includes(i));
    if(!pool.length){seen.length=0;pool=S.map((e,i)=>i)}
    const i=one(pool);seen.push(i);const e=S[i],own=!!(ch.office||(ch.aff&&ch.aff.own));
    return {t:'특색 해결사 · '+partnerFill(e.t,ch),x:partnerFill(e.x,ch)+(own&&B.partnerOffice?' '+bondFill(B.partnerOffice,b):''),c:[{l:partnerFill(e.a,ch),h:'함께하는 시간',ok:{t:partnerFill(e.at,ch),fx:{}}},{l:partnerFill(e.b,ch),h:'함께하는 시간',ok:{t:partnerFill(e.bt,ch),fx:{}}}]};
  }
  /* ===== 대호수로 나간 자: 호수 하나마다 [금기 사건 → 고래(선장 이전엔 선장의 명령으로 도망) → 선박장 정비] ===== */
  const lakeOn=ch=>!!(ch.flags&&ch.flags.lake);
  /* 대호수의 작살술(전용 카드팩): 처음 6장 · 숙련 선원에서 카드 강화 · 갑판장·부선장·선장에서 새 카드 2장씩. 덱이 가득 차면 카드함으로 간다 */
  function lakeCards(ch,row,out,why){
    if(!row)return;
    if(row.up){const done=[];for(const [from,to] of Object.entries(row.up)){const n0=ch.deck.filter(x=>x===from).length+(ch.side||[]).filter(x=>x===from).length;if(!n0)continue;ch.deck=ch.deck.map(x=>x===from?to:x);if(ch.side)ch.side=ch.side.map(x=>x===from?to:x);done.push(`${D.cards[from].n} → ${D.cards[to].n}`)}
      if(done.length)out.push(`카드 강화 · ${done.join(' · ')} (${why})`)}
    if(row.add){const into=[],side=[];
      for(const id of row.add){if(ch.deck.length<deckMax(ch)){ch.deck.push(id);into.push(id)}else{(ch.side=ch.side||[]).push(id);side.push(id)}}
      if(into.length||side.length)out.push(`전용 카드 · ${[...into,...side].map(id=>D.cards[id].n).join(', ')} (${why})${side.length?` · 덱이 가득 차 ${side.length}장은 카드함으로`:''}`)}
  }
  /* 내가 선장이면 호수 사건 속 "선장"은 나다: 제3자로 쓰인 선장 문구를 내가 하는 말과 행동으로 바꾼다 */
  const CAPSUB=[[/선장에게 (손짓|눈짓)으로 알린다/g,'직접 $1으로 지시한다'],[/선장이 처리한다/g,'내가 처리한다'],[/선장도 아직 모르는 것 같다/g,'아직 아무도 수습하지 못했다'],[/선장의 명령/g,'내 명령'],[/선장이/g,'당신이'],[/선장은/g,'당신은'],[/선장도/g,'당신도'],[/선장의 /g,'당신의 '],[/선장에게/g,'당신에게']];
  const capView=o=>{if(typeof o==='string'){let t=o;for(const [a,b] of CAPSUB)t=t.replace(a,b);return t}if(Array.isArray(o))return o.map(capView);if(o&&typeof o==='object'){const r={};for(const k of Object.keys(o))r[k]=k==='fx'||k==='check'?o[k]:capView(o[k]);return r}return o};
  function lakeYear(G){const r=lakeYear0(G);return r&&r.type!=='fight'&&G.ch.lake&&G.ch.lake.captain?capView(r):r}
  function lakeYear0(G){
    const ch=G.ch,Lk=D.lake;if(!Lk||!lakeOn(ch)||ch.distForm)return null;
    const L=ch.lake=ch.lake||{},ids=Object.keys(Lk.lakes);
    /* 금기 사냥꾼: 금기를 어기면 몇 해 뒤 대호수 금기 사냥꾼이 먼저 찾아온다 (조율자는 오지 않는다). 새 호수에 들어서기 전에 경고 사건 → 맞서면 다음 해 전투 */
    if(L.hunterFight){L.hunterFight=false;return {type:'fight',enemy:'lake_hunter',enc:{hidden:true,label:'대호수 금기 사냥꾼'}}}
    /* 쌍갈고리 해적단 반파: 선장이 된 지 pirateAfter해가 지나면 선원의 실수로 얽히고, 부선장 → 두목 오르카를 차례로 쓰러뜨린다 */
    if(L.captain&&L.pirate==='mate'){L.pirate='matefight';return {type:'fight',enemy:'lake_mate',enc:{hidden:true,label:'쌍갈고리 해적단 부선장'}}}
    if(L.captain&&L.pirate==='orca'){L.pirate='orcafight';return {type:'fight',enemy:'lake_orca',enc:{hidden:true,label:'쌍갈고리 해적단 두목'}}}
    if(L.captain&&L.pirate==='epi'&&Lk.pirateEnd){L.pirate='end';L.pirateEndYear=G.year;return JSON.parse(JSON.stringify(Lk.pirateEnd))}
    if(L.captain&&L.phase!=='whale'&&!L.pirate&&G.year>=(L.pirateAt||(L.capYear||99)+CFG.lake.pirateAfter)&&Lk.pirate){L.pirate='ev';return JSON.parse(JSON.stringify(Lk.pirate))}
    /* 선장이 된 뒤에는 새 호수에 들어서기 전 인어나 해적 조우가 끼어들 수 있다 */
    if(L.captain&&L.phase!=='whale'&&!L.encRolled){L.encRolled=true;if(d(100)<=CFG.lake.encChance){const r=d(100),id=r<=55?((Lk.mermaid&&Lk.mermaid[L.cur])||'lake_mermaid'):r<=70?'lake_hook':r<=85?'lake_blade':'lake_shield';return {type:'fight',enemy:id,enc:{label:/^lake_m(ermaid|_)/.test(id)?'호수에서 올라온 것':'쌍갈고리 해적단'}}}}
    /* 선장이 된 뒤: 선원 모집(최대 crewMax명, 직책을 고른다) · 선원이 생기면 호수에 변모하는 징후 */
    if(L.captain&&L.phase!=='whale'&&Lk.crew){
      const crew=L.crew=L.crew||[];
      if(crew.length<CFG.lake.crewMax&&G.year>=(L.crewAt||0)){
        L.crewAt=G.year+CFG.lake.crewEvery;const keys=sample(Object.keys(Lk.crew.roles),3);
        return {t:Lk.crew.t,x:Lk.crew.x+(crew.length?` 지금 배에는 선원이 ${crew.length}명 있다 (${crew.map(m=>m.n).join(', ')}).`:''),c:[...keys.map(k=>{const R_=Lk.crew.roles[k];return {l:`${R_.n}를 태운다`,h:`${R_.e} · ${R_.t}`,ok:{t:`${R_.n} 한 사람이 당신의 배에 올랐다. 이름은 묻지 않았다. 이 호수에서는 이름이 오래 남지 않는다.`,fx:{lakeCrew:k}}}}),{l:Lk.crew.later,ok:{t:'선장은 고개를 저었다. 사람이 더 필요하면 소문이 먼저 알아서 돈다.',fx:{}}}]}}
      if(crew.length&&Lk.crewSign&&G.year>=(L.signAt||0)){L.signAt=G.year+CFG.lake.signEvery;const sg=(L.signSeen=L.signSeen||[]);let pool=Lk.crewSign.map((e,i)=>i).filter(i=>!sg.includes(i));if(!pool.length){sg.length=0;pool=Lk.crewSign.map((e,i)=>i)}
        const i=one(pool);sg.push(i);const s_=Lk.crewSign[i];return {t:s_.t,x:s_.x,c:[{l:s_.a,h:'변모의 징후 · 항해 공적 +1',ok:{t:s_.at,fx:{pts:1}}},{l:s_.b,h:'변모의 징후 · 항해 공적 +1',ok:{t:s_.bt,fx:{pts:1}}}]}}
    }
    {const brk=(ch.flags.lakeBreak||0);if(brk>(L.hunted||0)&&!L.huntAt)L.huntAt=G.year+1+d(2);
     if(L.wave&&L.phase!=='whale')return waveEv(ch,L);
     if(L.phase!=='whale'&&L.huntAt&&G.year>=L.huntAt&&Lk.hunter){L.hunted=brk;L.huntAt=null;
       const W=CFG.lake.wave,r=d(100),pw=Math.min(W.maxPct,W.basePct+brk*W.perBreak),ev0=JSON.parse(JSON.stringify(Lk.hunter));
       if(r<=pw){L.wave={i:0,max:Math.min(W.maxStage,W.stage+Math.floor(brk/3))};const e=waveEv(ch,L);e.x=`금기를 어긴 값을 호수가 묻는다 · 1d100 ${r} (${pw} 이하 · 대형 파도)\n`+e.x;return e}
       ev0.x=`금기를 어긴 값을 호수가 묻는다 · 1d100 ${r} (${pw} 초과 · 파도는 오지 않았다)\n`+ev0.x;return ev0}}
    if(L.indigoFight){L.indigoFight=false;return {type:'fight',enemy:'lake_indigo',enc:{hidden:true,label:'쪽빛 노인'}}}
    if(L.ricardoFight){L.ricardoFight=false;return {type:'fight',enemy:'lake_ricardo',enc:{hidden:true,label:'중지의 큰형님'}}}
    if(L.captain&&L.pirate==='end'&&!ch.beaten.includes('lake_ricardo')&&L.phase!=='whale'&&G.year>=(L.ricardoAt||(L.pirateEndYear||0)+CFG.lake.ricardoAfter)&&Lk.ricardo){L.ricardoAt=G.year+CFG.lake.ricardoAfter;return JSON.parse(JSON.stringify(Lk.ricardo))}
    if(L.whaleFight){const id=L.whaleFight;L.whaleFight=null;const e=D.enemies[id];return {type:'fight',enemy:id,enc:{hidden:!!e.hidden,label:e.hidden?'대재앙 토벌':'보스급 고래 토벌'}}}
    if(L.phase==='whale'){
      /* 선장이 되기 전엔 선장의 명령으로 도망, 선장이 된 뒤엔 내가 명령한다: 어린 고래(보스급) 토벌 → 1막 끝 무렵 성체(대재앙) → 창세치 → 창백한 */
      if(L.captain){
        const killed=L.killed||[],W=Lk.whale&&Lk.whale[L.cur];let target=null;
        if(W&&!killed.includes(W.young))target=W.young;
        else if(W&&!killed.includes(W.adult)&&G.year>=CFG.years-CFG.lake.adultBefore)target=W.adult;
        else{const nA=Object.values(Lk.whale||{}).filter(x=>killed.includes(x.adult)).length;
          if(nA>=CFG.lake.genesisAt&&!killed.includes('lake_whale_genesis'))target='lake_whale_genesis';
          else if(killed.includes('lake_whale_genesis')&&!killed.includes('lake_whale_pale'))target='lake_whale_pale'}
        if(target==='lake_whale_pale'&&ch.bond&&ch.bond.st==='married'&&ch.bond.route==='lake'&&!L.paleBond&&Lk.paleBond){L.paleBond=true;return JSON.parse(bondFill(JSON.stringify(Lk.paleBond),ch.bond))}   // 인연이 창백한 고래를 보고 폭주한다
        if(target&&Lk.hunt){const e=D.enemies[target],ev=JSON.parse(JSON.stringify(Lk.hunt));ev.t=(e.hidden?'대재앙 · ':'보스급 고래 · ')+e.n;ev.x=e.intro+' 키를 쥔 선장인 당신이 정해야 한다.';L.whaleTarget=target;return ev}
        return JSON.parse(JSON.stringify(Lk.fleeCap||Lk.flee))
      }
      return JSON.parse(JSON.stringify(Lk.flee))
    }
    /* 쪽빛 노인: 대재앙을 둘 눕힌 선장이 다른 항구로 넘어가기 전에 나룻배로 찾아와 가르침을 제안한다 (한 번만) */
    if(L.captain&&!L.indigo&&Lk.indigo&&(L.killed||[]).filter(x=>x.startsWith('lake_whale_')).length>=2){L.indigo='ev';return JSON.parse(JSON.stringify(Lk.indigo))}
    if(!L.bag||!L.bag.length)L.bag=sample(ids,ids.length);   // 지난 호수는 나머지를 다 돌 때까지 나오지 않는다
    L.cur=L.bag.pop();L.phase='whale';L.seen=(L.seen||0)+1;L.encRolled=false;if(!(L.seenLakes=L.seenLakes||[]).includes(L.cur))L.seenLakes.push(L.cur);
    {const lk=Lk.lakes[L.cur];if(lk.slip&&d(100)<=CFG.lake.slip)return JSON.parse(JSON.stringify(lk.slip))}   // 주인공이 아닌 다른 선원이 금기를 어길 수도 있다
    {const ev=JSON.parse(JSON.stringify(Lk.lakes[L.cur])),T_=Lk.tools&&Lk.tools[L.cur];
      /* 방지 도구가 있으면 맨 위 선택지로 쓴다(소모). 없어도 막히지 않는다: 맨몸으로 지키거나, 입구에서 돌아설 수 있다 */
      if(T_&&((L.tools||{})[L.cur]||0)>0)ev.c.unshift({l:T_.l,h:`${T_.n} 소모 · 안전하게 지나간다 · 돈 +100`,ok:{t:T_.t,fx:{lakeTool:L.cur,money:100,flag:'lakeKeep',pts:2}}});
      ev.c.push({l:'입구에서 돌아선다',h:'이 호수를 지나지 않는다 · 보상도 위험도 없다 · 소문을 한 줄 들을 수 있다',ok:{t:Lk.turnBack&&Lk.turnBack[L.cur]||'호수 입구에서 키를 돌렸다. 오늘은 이 호수가 아니라고 선원들이 고개를 끄덕였다.',fx:{pts:1}}});
      return ev}
  }
  const bondMarried=ch=>!!(ch.bond&&ch.bond.st==='married');
  function bondMarry(ch,chips){
    const b=ch.bond,R=bondData(ch);b.st='married';b.since=ch.year||0;
    addStats(ch.stats,BD.marry);if(BD.marry.maxHp)ch.hp+=BD.marry.maxHp;
    chips.push(`결혼 · ${b.name}`);chips.push(bondFill(R.married,b));
    chips.push(`최대 HP +${BD.marry.maxHp} · 최대 정신력 +${BD.marry.mindMax} · 사건 판정 +${BD.marry.check}`);
  }
  /* 결혼 전에 기회를 모두 쓰면 상대가 떠난다 (작은 대가) */
  function bondLeft(ch,chips){
    const b=ch.bond,R=bondData(ch);b.st='left';
    ch.stats.mindMax=(ch.stats.mindMax||0)-BD.leaveMind;ch.mind=Math.min(ch.mind,mindMax(ch));
    chips.push(`떠났다 · ${b.name}`);chips.push(bondFill(R.left,b));chips.push(`최대 정신력 −${BD.leaveMind} (영구)`);
  }
  /* 결혼한 뒤 금기(도시의 해가 되는 짓)를 저지르면 그때부터 해마다 dieChance%로 배우자가 세상을 떠난다 */
  /* 배우자 사망 확률(%): 금기를 저지른 뒤엔 dieChance, 여기에 히든 보스를 이겨 쌓인 위험(0.1%씩)을 더한다 */
  /* 종족: 혈귀는 오래 산다. 배우자는 주인공이 혈귀이고 변형 1(혈귀 배우자)일 때, 아이는 부모 중 한 쪽이 혈귀면, 손주는 부모(아이)를 따른다 */
  const spouseHy=(ch,b)=>!!(ch&&b&&ch.race==='hyeolgwi'&&b.route==='hyeolgwi'&&b.variant===1);   // 다른 루트(동부·고급 해결사 등)의 두 번째 변형은 혈귀가 아니다
  const kidHy=(ch,k)=>!!k&&(k.race?k.race==='hyeolgwi':ch.race==='hyeolgwi');
  const lifeFrom=hy=>hy?BD.kid.oldFromLong:BD.kid.oldFrom;
  const lifeTo=hy=>hy?BD.kid.oldToLong:BD.kid.oldTo;
  /* 사람마다 눈을 감을 나이를 한 번 정해 둔다 (구간 안에서 가운데가 조금 더 잦은 삼각 분포): 같은 나이에 다 같이 쓰러지지 않고 구간 전체에 퍼진다 */
  const lifeAt=(o,hy)=>{if(o.dieAt==null){const a=lifeFrom(hy),z=lifeTo(hy),u=(d(1000)+d(1000))/2000;o.dieAt=a+Math.floor(u*(z-a+1))}return o.dieAt};
  function bondRisk(b,y,ch){if(ch&&ch.flags&&ch.flags.spouseAge)return 0;return ((b.tabooAt!=null&&y>b.tabooAt?BD.dieChance:0)+(b.risk||0))*(ch&&ch.flags&&ch.flags.bondGuard?0.5:1)}
  function bondTaboo(ch){const b=ch.bond;if(b&&b.st==='married'&&b.tabooAt==null)b.tabooAt=ch.year||0}
  /* 결혼한 뒤의 배우자의 죽음 (큰 대가). 아이는 남는다 */
  function bondDeath(ch,chips){
    const b=ch.bond;b.st='lost';
    ch.stats.mindMax=(ch.stats.mindMax||0)-BD.lossMind;ch.mind=Math.min(ch.mind,mindMax(ch));
    chips.push(`배우자의 죽음 · ${b.name}`);chips.push(`최대 정신력 −${BD.lossMind} (영구)`);
  }
  const kf=(t,n)=>bondFill(String(t).replace(/\{k\}/g,'{n}'),{name:n});
  const kidWord=b=>(b.kids||[]).length>1?'자식들':'자식';
  const kidAge=(k,y)=>Math.max(0,(y||0)-k.born);
  /* 토벌 의뢰: 결혼 중인 배우자와 성인이 된 아이 중 가장 강한 가족 (level 0~8, 급수 = 9 − level). 배우자는 결혼한 햇수가 지날수록 급수가 오른다 */
  const kidLevel=(k,y)=>Math.min(8,Math.floor((kidAge(k,y)-BD.kid.adult)/BD.hunt.years)+(BD.hunt.job[k.job]||0));
  const spouseLevel=(b,y)=>{const R=D.bond&&D.bond.routes[b.route],V=R&&(R.variants?R.variants[b.variant||0]:R);return Math.min(8,((V&&V.lv!=null)?V.lv:(BD.hunt.spouse[b.route]??1))+(b.promo||0)+Math.floor(Math.max(0,(y||0)-(b.since||0))/BD.hunt.spouseYears))};
  function familyHunter(ch,y){
    const b=ch.bond;if(!b)return null;
    const cs=(b.kids||[]).filter(k=>!k.dead&&kidAge(k,y)>=BD.kid.adult).map(k=>({n:k.n,job:k.job,lv:kidLevel(k,y),kid:k}));
    if(b.st==='married')cs.push({n:b.name,job:BD.hunt.spouseJob[b.route]||'fixer',lv:spouseLevel(b,y),spouse:true});
    return cs.reduce((a,c)=>!a||c.lv>a.lv?c:a,null);
  }
  /* 무한 모드: 처음 들어설 때 어긋난 자리 사건 한 번, 그 뒤 100살(나이)마다 능력치·주는 피해가 영구히 오르는 사건 (놓친 백 해는 순서대로 받는다) */
  function infiniteEvent(G){
    const ch=G.ch,I=D.infinite,K=CFG.infinite.century;if(!G.infinite||!ch.infinite||!I)return null;
    const LI=lakeOn(ch)&&D.lake&&D.lake.infinite;
    if(!ch.infIntro&&LI){ch.infIntro=1;return {t:LI.intro.t,x:LI.intro.x,c:[{l:LI.intro.a,h:'집은 짓지 않는다 · 호수에서 호수로 항해가 반복된다',ok:{t:LI.intro.at,fx:{lakeOuter:1}}}]}}
    if(!ch.infIntro){ch.infIntro=1;return {t:I.intro.t,x:I.intro.x,c:[{l:I.intro.a,h:'외곽에 작은 집을 짓는다 · 혼자여도, 곁에 사람이 있어도 이 집이 돌아오는 자리가 된다',ok:{t:I.intro.at+(ch.bond&&ch.bond.st==='married'&&ch.bond.name&&I.introWith?I.introWith.replace('{n}',ch.bond.name):''),fx:{infHome:1}}}]}}
    const have=ch.infCent||[],n=(()=>{for(let i=1;i<=Math.floor(age(G)/K.every);i++)if(!have.includes(i))return i;return 0})();
    /* 선원의 변화: 무한 모드에서 선원이 한 단계씩 호수를 닮아 가다가 어느 날 젖은 옷만 남기고 사라진다. 이름은 붙이지 않고 장면만 보여 준다 */
    if(!n&&ch.infIntro&&LI&&LI.morph){const L=ch.lake=ch.lake||{},Mo=CFG.lake.morph,crew=L.crew||[];
      if(L.captain&&crew.length){if(!L.morphAt)L.morphAt=G.year+Mo.every;
        if(G.year>=L.morphAt){L.morphAt=G.year+Mo.every;let bi=0;crew.forEach((m,i)=>{if((m.mo||0)>(crew[bi].mo||0))bi=i});L.morphIdx=bi;const m=crew[bi],T=LI.morph[Math.min(m.mo||0,LI.morph.length-1)],f=t=>t.replace(/\{n\}(이|을|은)?/g,(_,j)=>{if(!j)return m.n;const c=m.n.charCodeAt(m.n.length-1),b=c>=0xAC00&&c<=0xD7A3&&(c-0xAC00)%28>0;return m.n+(b?j:({'이':'가','을':'를','은':'는'})[j])});
          return {t:f(T.t),x:f(T.x),c:[{l:f(T.a),h:`정신력 +${Mo.mindA}`,ok:{t:f(T.at),fx:{lakeMorph:'a'}}},{l:f(T.b),h:`공격 +${Mo.atkB}`,ok:{t:f(T.bt),fx:{lakeMorph:'b'}}}]}}}}
    if(!n&&ch.infIntro){const Lm=CFG.infinite.limit;if(!ch.limAt)ch.limAt=G.year+Lm.every;
      if(G.year>=ch.limAt){ch.limAt=G.year+Lm.every;const m=ch.colorDone?Lm.traitMul:1,pct=x=>Math.round(x*m*1000)/10;
        return {t:'한계 돌파',x:LI?'호수에서 수십 해를 보내자 몸이 물결의 박자를 기억한다. 더 멀리, 더 세게 휘두를 수 있다고 느낀다.':'오래 버틴 몸이 한계 너머를 보기 시작한다. 어느 쪽으로 더 벼릴지 정해야 한다.',c:[
          {l:'공세를 벼린다',h:`공격 +${pct(Lm.atkPct)}% (영구)${ch.colorDone?' · 특색 보너스':''}`,ok:{t:'휘두르는 팔이 한결 무거워졌다.',fx:{limit:'atk'}}},
          {l:'맹공을 익힌다',h:`주는 피해 +${pct(Lm.dmgPct)}% (영구)${ch.colorDone?' · 특색 보너스':''}`,ok:{t:'맞는 쪽이 먼저 물러서는 것이 느껴진다.',fx:{limit:'dmg'}}},
          {l:'일격을 벼린다',h:`적중 시 상대에게 추가 피해 (내 최대 HP의 ${pct(Lm.strikePct)}%) (영구)${ch.colorDone?' · 특색 보너스':''}`,ok:{t:'몸 전체의 무게가 한 번의 타격에 실린다.',fx:{limit:'strike'}}}]}}}
    if(!n)return null;
    const T=(LI||I).century[Math.min(n-1,(LI||I).century.length-1)];
    return {t:T.t,x:T.x,c:[{l:T.a,h:`공격 +${K.atk} · 회피 +${K.eva} · 속도 +${K.spd} · 최대 HP +${K.maxHp} · 주는 피해 +${Math.round(K.dmg*100)}% (영구) · 적의 공격 피해도 +${Math.round(K.enemyDmg*100)}% (영구)`,ok:{t:T.at,fx:{infCentury:n}}}]}
  }
  function kidHuntEvent(G){
    const ch=G.ch,y=G.year;if(!ch.distForm||(y<(ch.huntNext||0)))return null;
    const k=familyHunter(ch,y);if(!k)return null;
    ch.huntNext=y+BD.hunt.gap;if(d(100)>BD.hunt.chance)return null;
    const H=bondTx(ch).hunt,Lv=Math.max(0,k.lv),e=D.enemies.kid_hunt,Z=BD.hunt;
    const jb=k.spouse?'배우자':(H.jobs[k.job]||'');ch.kidFoe=k.n;ch.kidFoeSpouse=!!k.spouse;ch.kidFoeLv=Lv;
    e.n=`${k.n} · ${jb} ${9-Lv}급`;e.hp=56+Lv*Z.hp;e.atk=3+Lv*Z.atk;e.eva=2+Lv*Z.eva;e.spd=5+Lv*Z.spd;
    e.deck=k.job==='fixer'?['lunge','a_maw','guard','lunge']:k.job==='assoc'?['a_maw','lunge','a_maw','guard']:['lunge','guard','lunge','guard'];
    e.intro=kf(k.spouse?H.introSpouse:H.intro,k.n).replace('{j}',`${jb} ${9-Lv}급`);
    return {type:'fight',enemy:'kid_hunt',enc:{id:'kid_hunt',roll:null,table:null,label:'토벌 의뢰'}};
  }
  /* 청혼: roll이면 1dN을 굴려 성공 범위면 결혼, 아니면 기회 1회 소모 (기회를 다 쓰면 인연이 끝난다) */
  /* 결혼 판정: 1d4에 쌓은 인연(인연 이벤트 + '인연을 더 쌓는다')을 더해 marryNeed 이상이면 성공 */
  const marryScore=b=>b.fixed?BD.marryNeed:Math.min(b.love||0,BD.steps)+(b.extra||0);
  function bondPropose(ch,chips,roll){
    const b=ch.bond;if(!b||b.st!=='met')return;
    let ok=false;
    if(roll){const sc=marryScore(b),r=d(BD.die);ok=r+sc>=BD.marryNeed;chips.push(`1d${BD.die} · ${r} + 인연 ${sc} = ${r+sc} (${BD.marryNeed} 이상이면 성공)`)}
    if(ok){bondMarry(ch,chips);return}
    b.tries=(b.tries||0)+1;chips.push(bondFill(roll?D.bond.proposeNo:D.bond.proposeWaitFail,b)+` · 남은 기회 ${Math.max(0,BD.tries-b.tries)}/${BD.tries}`);
    if(b.tries>=BD.tries)bondLeft(ch,chips);else b.next=(ch.year||0)+bondGap();
  }
  /* 인연 루트: 혈귀는 혈귀 전용, 동부 외곽 출신은 외곽 전용, 그 밖에는 소속(사무소·협회·날개·손가락) */
  const FINGER_ROUTE={'엄지':'thumb','검지':'pointer','중지':'middle','약지':'ring'};
  /* 호수 출생은 인연·가족 공통 문구를 D.bond.lake 로 덮어 쓴다(배에서 사는 사람의 말투) */
  const bondTx=ch=>(lakeOn(ch)&&D.bond&&D.bond.lake)?Object.assign({},D.bond,D.bond.lake):D.bond;
  const bondRouteOf=ch=>lakeOn(ch)?'lake':(ch.o&&ch.o.race==='hyeolgwi')?'hyeolgwi':ch.hw?'hcorp':ch.rb&&ch.rb.out?'rcorp':(ch.o&&ch.o.n==='동부 출신 외곽 생존자')?'east':(ch.licensed&&(!ch.aff||ch.aff.own||(ch.office&&isWs(ch)))?'freelance':(synOf(ch)?synOf(ch):ch.aff&&ch.aff.type==='finger'&&FINGER_ROUTE[ch.aff.name]?FINGER_ROUTE[ch.aff.name]:ch.aff&&BD.routes.includes(ch.aff.type)?ch.aff.type:null));
  /* 루트에 variants가 있으면 만날 때 무작위로 하나가 정해진다 */
  const bondData=ch=>{const b=ch.bond,R=b&&D.bond&&D.bond.routes[b.route];return R?(R.variants?R.variants[b.variant||0]:R):null};
  function bondMeetEvent(ch){
    const B=bondTx(ch);let rt=bondRouteOf(ch);
    /* 히든: 해결사 급수가 BD.hidden.rank급 이상(숫자 rank<=)이면 가끔 처음부터 2~1급 해결사인 상대를 만난다 */
    if(['thumb','pointer','middle','ring'].includes(rt)&&B.routes.finger&&d(100)<=BD.fingerGeneric)rt='finger';
    if(rt&&rt!=='hyeolgwi'&&rt!=='rcorp'&&rt!=='hcorp'&&ch.licensed&&ch.rank<=BD.hidden.rank&&B.routes.highfixer&&d(100)<=BD.hidden.chance)rt='highfixer';
    const R0=rt&&B&&B.routes[rt];
    if(!R0)return null;
    const vi=rt==='hcorp'&&R0.variants?(ch.hw&&ch.hw.beast?1:0):R0.variants?d(R0.variants.length)-1:0,R=R0.variants?R0.variants[vi]:R0;
    const yes={l:B.meetYes,h:'동반자의 이름을 정한다 · 이후 몇 해마다 사건이 온다',ok:{t:B.meetYesT,fx:{bondMeet:rt,bondVariant:vi}}};
    /* 흑수 루트: 약한 가주 후보와의 만남은 반드시 일어난다 */
    if(rt==='hcorp'&&ch.hw&&ch.hw.beast)return {t:R.meet.t,x:R.meet.x,c:[yes]};
    return {t:R.meet.t,x:R.meet.x,c:[
      yes,
      {l:B.meetNo,h:'다시 만나지 않는다',ok:{t:B.meetNoT,fx:{bondDecline:true}}}]};
  }
  /* 인연이 맺어진 뒤의 사건(3~4년마다)과 청혼. 만남은 일상 사건 안에서 일어난다 */
  let legacyFn=null,ghostFn=null;const ghostOf=ch=>{const g=ghostFn?ghostFn():null;return g&&g.deck&&g.deck.length>=3&&ch.infinite?g:null};
  function bondEvent(G){
    const ch=G.ch,b=ch.bond,y=G.year,B=bondTx(ch);
    if(!B||ch.distForm||ch.job||!b)return null;
    const R=bondData(ch);if(!R)return null;
    if(b.st==='married'||b.st==='lost'){
      const KD=BD.kid,kids=b.kids||(b.kids=[]);
      /* 성인이 된 아이: 사무소·해결사·협회 중 태어날 때 정해진 곳에 들어간다 */
      const grown=kids.find(k=>!k.told&&kidAge(k,y)>=KD.adult);
      if(grown){grown.told=true;const J=B.kidJobs.find(j=>j.k===grown.job)||B.kidJobs[0];
        return {t:J.t,x:kf(J.x,grown.n),c:[{l:J.a,h:'아이는 자라서 자신의 길을 간다',ok:{t:kf(B.kidAT,grown.n),fx:{}}}]}}
      /* 아이도 늙는다: oldFrom살부터 해마다 확률로 눈을 감는다 (배우자만 죽고 아이가 몇백 살까지 사는 것은 이상하다는 의견) */
      {const KO=B.kidOld,od=KO&&kids.find(k=>!k.dead&&!k.pend&&kidAge(k,y)>=lifeAt(k,kidHy(ch,k)));
        if(od){const over=age(G)>100&&B.kidOldOver,GF=CFG.infinite.grief;
          return {t:KO.t,x:kf(over?B.kidOldOver.x:KO.x,od.n),c:[{l:KO.a,h:`정신력 −${KD.oldMind}`+(over?` · 슬픔이 몸에 굳는다 (공격 +${GF.atk} · 최대 HP +${GF.maxHp} · 주는 피해 +${Math.round(GF.dmg*100)}% 영구)`:''),ok:{t:kf(over?B.kidOldOver.at:KO.at,od.n),fx:over?{kidOld:od.n,famGrief:1}:{kidOld:od.n}}}]}}}
      /* 손주: 성인이 된 아이가 30~50살 사이에 아이를 하나 낳는다. 이름은 무작위로 굴린다 */
      {const GR=BD.grand,gk=kids.find(k=>!k.dead&&!k.pend&&!k.grand&&kidAge(k,y)>=GR.from&&kidAge(k,y)<=GR.to&&d(100)<=GR.chance);
        if(gk){const used=[...kids.map(k=>k.n),...kids.filter(k=>k.grand).map(k=>k.grand.n),ch.name||'',...(b.st!=='lost'&&b.name?[b.name]:[])],all=[...B.kidNames,...(D.namePool||[])],pool=all.filter(n=>!used.includes(n));
          /* 일대기에 남은 이름(지난 삶의 나·연인·아이)을 일정 확률로 물려받는다 */
          let gn,lg=null;{const L=(legacyFn?legacyFn():[]).filter(x=>x&&x.n&&!used.includes(x.n));if(L.length&&d(100)<=BD.grand.legacy)lg=one(L)}
          gn=lg?lg.n:one(pool.length?pool:all);
          const lgx=lg&&B.grand.legacy&&B.grand.legacy[lg.k]?' '+B.grand.legacy[lg.k]:'';
          return {t:B.grand.t,x:kf(B.grand.x,gk.n).replace(/\{g\}/g,gn)+lgx,c:[{l:B.grand.a,h:`${gk.n}의 아이 · 이름은 ${gn}`,ok:{t:kf(B.grand.at,gk.n).replace(/\{g\}/g,gn),fx:{bondGrand:{k:gk.n,g:gn}}}}]}}}
      if(b.st!=='married')return null;
      const spAge=age(G),spHy=spouseHy(ch,b),ageDie=ch.flags&&ch.flags.spouseAge&&spAge>=lifeAt(b,spHy);   // 배우자는 주인공과 같은 나이로 센다
      if(ageDie||d(1000)<=bondRisk(b,y,ch)*10)
        {const over=age(G)>100&&B.deathOld,GF=CFG.infinite.grief;
        return {t:B.deathT,x:bondFill(over?B.deathOld.x:R.lost,b),c:[{l:B.deathA,h:`최대 정신력 −${BD.lossMind} (영구) · 해마다 정신력 회복이 끊긴다`+(over?` · 슬픔이 몸에 굳는다 (공격 +${GF.atk} · 최대 HP +${GF.maxHp} · 주는 피해 +${Math.round(GF.dmg*100)}% 영구)`:''),ok:{t:bondFill(over?B.deathOld.at:B.deathAT,b),fx:over?{bondDeath:true,famGrief:1,bondDie:ageDie?'age':'risk'}:{bondDeath:true,bondDie:ageDie?'age':'risk'}}}]}}
      const last=kids.length?kids[kids.length-1].born:-99;
      if(y-b.since>=KD.from&&kids.length<KD.max&&y-last>=KD.gap&&d(100)<=KD.chance){
        const used=kids.map(k=>k.n),pool=B.kidNames.filter(n=>!used.includes(n)),nm=one(pool.length?pool:B.kidNames);
        return {t:B.kidBirth.t,x:B.kidBirth.x,c:[{l:B.kidBirth.a,h:`최대 정신력 +${KD.mind} · 아이는 당신과 함께 나이를 먹는다`,ok:{t:B.kidBirth.at,fx:{bondKid:nm}}}]};
      }
      return null;
    }
    if(b.st!=='met')return null;
    if(y<b.next)return null;
    b.next=y+bondGap();
    if(b.step<BD.steps){
      const si=b.step,S=R.steps[si];b.step++;
      /* 선택 결과 문구: 그 사건(S.at/S.bt)에 적힌 것이 먼저, 없으면 단계별 문구 목록에서 무작위로 */
      const resT=(own,pool,gen)=>bondFill(own||(pool&&pool[si]&&pool[si].length?one(pool[si]):gen),b);
      return {t:S.t,x:bondFill(S.x,b),c:[
        {l:bondFill(S.a,b),h:`인연 +1 · 정신력 +${BD.loveMind}`,ok:{t:resT(S.at,B.stepATs,B.stepAT),fx:{bondLove:1}}},
        {l:bondFill(S.b,b),h:'변화 없음',ok:{t:resT(S.bt,B.stepBTs,B.stepBT),fx:{}}}]};
    }
    /* 인연 이벤트를 하나도 쌓지 않았다면 상대는 관심이 없다: 청혼 자리가 열리지 않고 조용히 떠난다 */
    if(!(b.love||0)&&!(b.extra||0))return {t:'말없이 떠난 사람',x:bondFill(R.left,b)+' 함께한 시간은 있었지만 쌓인 것은 없었다.',c:[{l:'떠나는 뒷모습을 본다',h:`최대 정신력 −${BD.leaveMind} (영구)`,ok:{t:bondFill('{n}의 이름을 한 번 불러 보았다. 대답은 돌아오지 않았다.',b),fx:{bondLeave:true}}}]};
    /* 흑수 루트: 청혼이 아니라 약한 후보가 먼저 고백한다. 플레이어는 지금의 자리를 보고 받아들일지 정한다 */
    if(ch.hw&&ch.hw.beast){const rk=(ch.hw.rank2?'필두':ch.hw.rank1?'흑수':'아직 이름을 얻지 못한 몸')+' · '+CFG.hw.candRanks[hwCandRank(ch.hw.mk||0)];
      return {t:R.propose.t,x:bondFill(R.propose.x,b),c:[
        {l:'받아들인다',h:`지금은 ${rk} · 결혼 · 최대 HP·정신력·판정 상승`,ok:{t:bondFill('{n}의 손을 잡았다. 흑수의 자리에서도, 후보의 자리에서도 해 본 적 없는 대답이었다.',b),fx:{hwLoveYes:true}}},
        {l:'받아들일 수 없다',h:`지금은 ${rk} · 결혼하지 않는다 · 흑수로 곁에 남는다`,ok:{t:bondFill('{n}에게 고개를 숙였다. 자리가 다르다고 했다. {n}은 한참 뒤에 고개를 끄덕였다. 곁에 서겠다는 약속만은 거두지 않았다.',b),fx:{hwLoveNo:true}}}]}}
    const left=BD.tries-(b.tries||0);
    return {t:R.propose.t,x:bondFill(R.propose.x,b),c:[
      {l:B.proposeYes,h:`인연 ${Math.min(b.love||0,BD.steps)}/${BD.steps}${b.extra?` · 더 쌓은 인연 ${b.extra}`:''} · 1d${BD.die} + 인연이 ${BD.marryNeed} 이상이면 결혼 · 남은 기회 ${left}/${BD.tries}`,ok:{t:bondFill('{n}에게 말을 꺼냈다. 답이 돌아오기까지의 시간이 길게 느껴졌다.',b),fx:{bondPropose:true}}},
      ...(1+marryScore(b)<BD.marryNeed?[{l:B.proposeWait,h:`1d${BD.waitDie} · ${BD.waitDc} 이상이면 인연이 더 쌓인다 · 청혼 기회는 쓰지 않는다 (보정 없음)`,check:{s:null,dc:BD.waitDc,pure:true,die:BD.waitDie},ok:{t:bondFill(B.proposeWaitOk,b),fx:{bondWait:true}},fail:{t:bondFill(B.proposeWaitFail,b),fx:{bondSlip:true}}}]:[])]};
  }
  /* 일상: 사건이 있는 해 일부에 온다. 안정적으로 능력치를 조금 올려 주는 사건이고, 인연이 없는 캐릭터는 일부가 인연(조우자)을 만나는 사건이 된다 */
  const DL=CFG.daily;
  function dailyEvent(G){
    const ch=G.ch,y=G.year,L=D.dailyLife;
    if(!L||!L.length||ch.distForm||ch.job||y<DL.from)return null;
    const late=!ch.bond&&y>=BD.by&&!!bondRouteOf(ch);
    /* 대호수 항해 중에는 뭍의 일상 사건은 끼어들지 않고, 인연(노을 머리의 선원) 만남만 이 자리에서 일어난다 */
    if(lakeOn(ch)){if(!ch.bond&&y>=BD.from&&(late||d(100)<=BD.meetChance*CFG.lake.meetMul)){const e=bondMeetEvent(ch);if(e)return e}return null}
    if(!late&&d(100)>DL.chance)return null;
    if(!ch.bond&&y>=BD.from&&bondRouteOf(ch)&&(late||d(100)<=BD.meetChance)){const e=bondMeetEvent(ch);if(e)return e}
    if((ch.dailyN||0)>=DL.max)return null;
    const seen=ch.dailySeen=ch.dailySeen||[];let pool=L.map((e,i)=>i).filter(i=>!seen.includes(i));
    if(!pool.length){seen.length=0;pool=L.map((e,i)=>i)}
    const i=one(pool);seen.push(i);ch.dailyN=(ch.dailyN||0)+1;const e=L[i];
    return {t:'일상 · '+e.t,x:e.x,c:e.o.map(o=>({l:o.l,h:o.h,ok:{t:o.t,fx:o.fx}}))};
  }
  /* 검지의 히든 직업 · 신탁대행자: 검지 루트 최종 서열(대행자·전령)에 오른 뒤 가끔 울리는 단말기를 만난다. 줍으면 1d100이 dc 이상일 때 신탁대행자가 되고
     전리품 '신의 단말기'를 얻는다. 패시브 지령 독촉: 지령 스택 최대 oracle.presc, 지령을 수행하지 못한 라운드의 다음 라운드는 명중 −missHit · 회피 −missEva */
  /* 동부 외곽 출신 해결사의 히든 제안: 해결사 CFG.eastN.rank급 이하가 되면 N사가 중간 직급으로 스카우트를 제안한다 (수락하면 해결사 자격을 지키고, N사 승진마다 급수도 함께 오른다) */
  function eastScoutEvent(G){
    const ch=G.ch,y=G.year,Z=CFG.eastN;
    if(ch.distForm||ch.job||!isEastOuter(ch)||isN(ch)||nBlocked(ch)||!ch.licensed||ch.rank>Z.rank||ch.aff&&(ch.aff.type==='wing'||ch.aff.type==='finger'||ch.aff.type==='head')||(ch.eastScoutN||0)>=Z.tries||y<(ch.eastScoutNext||0))return null;
    ch.eastScoutN=(ch.eastScoutN||0)+1;ch.eastScoutNext=y+Z.gap;
    const T_=D.eastScout,R=D.careers.wing.ranks[Z.startFi];
    return {t:T_.t,x:T_.x,c:[
      {l:T_.yes,h:`${CFG.nWing.name} ${R.n}으로 입사 · 해결사 ${ch.rank}${T.rankUnit} 유지 · 승진마다 함께 오른다 · 운명(모든 판정 +${CFG.nWing.fate})`,ok:{t:T_.yesT,fx:{eastScout:true}}},
      {l:T_.no,h:Z.tries-ch.eastScoutN>0?'나중에 한 번 더 제안이 올 수 있다':'다시 제안은 없다',ok:{t:T_.noT,fx:{}}}]};
  }
  /* 조직 루트 사건: 엄지 전향 제안(흑운회·송곳) → 숙청 소문 → 반역 / 검계 역적 낙인 */
  /* 의리 순례: 중지 동생 이상 → 원한의 책 제안 → 장부 3장 (첫째·둘째는 히든 전투) → 형님의 시험 (순응: 버티기 / 반역: 암살자 추격) */
  /* ===== H사 홍원 가주 후보 루트 =====
     ch.hw = {fi(가문 사건 진행), picked, pair, rivals[적 id], rv(만난 후보 수), cnext, shrine, host(선황충), elderDone, fnext, finalSeen, done} */
  /* 흑수 루트: 하나의 흑수로 활동하며 흑수 → 필두가 되고, 후보 한 명을 가주로 세운다 (가주메이커) */
  /* 도망자 루트: 후보와 홍원을 떠난 뒤 추격대가 차례로 온다 (방계 → 흑수 → 철함사 → 홍루). 이기면 추격이 끝난다 */
  function hwFleeYear(G){
    const ch=G.ch,r=ch.hw,y=G.year,B=D.hwBeast,ids=B.fleeIds,cn=(ch.bond&&ch.bond.name)||(D.enemies[r.cand]||{}).n||'가주 후보';
    if(r.done)return null;
    {const bv=bondEvent(G);if(bv)return bv}
    const fill=ev=>JSON.parse(JSON.stringify(ev).replace(/\{c\}/g,cn));
    if(ids.every(id=>ch.beaten.includes(id)))return fill(B.fleeEnd);
    if(y<r.cnext)return null;
    if(r.fc<ids.length&&(r.fc===0||ch.beaten.includes(ids[r.fc-1]))){const ev=fill(B.fleeChase[r.fc]);if(r.fh>=2)ev.c=ev.c.slice(0,1);return ev}
    return null;
  }
  /* 흑수 루트: 후보를 세우는 일을 끝낸 횟수로 후보의 위상(부족한 → 어엿한 → 후계)이 정해진다 */
  const hwCandRank=n=>{const A=CFG.hw.candAt;let k=0;for(let i=0;i<A.length;i++)if(n>=A[i])k=i;return k};
  function hwBeastYear(G){
    const ch=G.ch,r=ch.hw,y=G.year,Z=CFG.hw.beast,B=D.hwBeast;if(!B||!r.bk||r.maker)return null;
    /* 흑수가 홍원에 머무는 동안에도 인연(자신이 후원할 가주 후보)이 이어진다: 흑수가 된 뒤 한 번 만나고, 이후 인연 사건이 때가 되면 먼저 온다 */
    {const bv=bondEvent(G);if(bv)return bv}
    if(r.rank2&&!ch.bond&&!r.bmet){r.bmet=1;const e=bondMeetEvent(ch);if(e)return e}
    if(y<(r.bnext||0))return null;
    const nm=aniOf(r.bk).nm,cn=(ch.bond&&ch.bond.name)||(D.enemies[r.cand]||{}).n||'가주 후보',fill=t=>String(t).replace(/\{n\}/g,nm).replace(/\{c\}/g,cn);
    const mk=(tpl,fxk)=>tpl.fight?({t:tpl.t,x:fill(tpl.x),c:[{l:tpl.l,h:tpl.h,ok:{t:fill(tpl.t2),fx:{hwb:'mkf',hwEnemy:tpl.fight}}}]}):({t:tpl.t,x:fill(tpl.x),c:tpl.check?[{l:tpl.l,h:'판정 · 성공해도 실패해도 후보를 세우는 일은 이어진다',check:tpl.check,ok:{t:fill(tpl.ok.t),fx:tpl.ok.fx},fail:{t:fill(tpl.fail.t),fx:tpl.fail.fx}}]:[{l:tpl.l,ok:{t:fill(tpl.t2),fx:{hwb:fxk}}}]});
    const done=ev=>{r.bnext=y+Z.gap;return ev};
    if(r.rank2){
      if((r.mk||0)>=B.maker.length){if(r.accept||y<Z.finalFrom)return null;const F=B.final;return done({t:F.t,x:fill(F.x)+(r.loved?' {c}은(는) 당신의 손을 놓지 않는다.':r.refused?' {c}은(는) 그날의 대답을 묻지 않고, 곁에 선 흑수를 본다.':'').replace(/\{c\}/g,cn),c:[{l:F.accept.l,h:fill(F.accept.h),ok:{t:fill(F.accept.t2),fx:{hwb:'accept'}}},{l:F.flee.l,h:fill(F.flee.h),ok:{t:fill((F.flee.t2s||[])[Math.min(r.clues||0,2)]||F.flee.t2),fx:{hwb:'flee'}}}]})}
      if(!ch.bond||ch.bond.st==='pick')return null;
      {const ev=mk(B.maker[r.mk||0],'mk');r.bnext=y+(Z.mkGap||Z.gap);return ev}
    }
    if((r.bp||0)>=Z.rank2&&r.rank1)return done({t:B.rank2.t,x:fill(B.rank2.x),c:[{l:B.rank2.l,ok:{t:fill(B.rank2.t2),fx:{hwb:'rank2'}}}]});
    if((r.bp||0)>=Z.rank1&&!r.rank1)return done({t:B.rank1.t,x:fill(B.rank1.x),c:[{l:B.rank1.l,ok:{t:fill(B.rank1.t2),fx:{hwb:'rank1'}}}]});
    const used=r.bused=r.bused||[];let pool=B.acts.map((_,i)=>i).filter(i=>!used.includes(i));if(!pool.length){used.length=0;pool=B.acts.map((_,i)=>i)}
    const i=one(pool);used.push(i);const a=B.acts[i];
    const cc=o=>({l:o.l,h:o.h,check:o.check,ok:{t:fill(o.ok.t),fx:o.ok.fx},fail:o.fail&&{t:fill(o.fail.t),fx:o.fail.fx}});
    return done({t:a.t,x:fill(a.x),c:a.c.map(cc)});
  }
  function hwYear(G){
    const ch=G.ch,r=ch.hw,y=G.year,Z=CFG.hw,R=D.hwRoute;if(!r||!R||r.done)return null;
    /* 승계의 갈림길: 홍원 2년차에 가주 승계를 이어 가거나, 승계를 내려놓고 열두 흑수 중 하나의 흑수가 된다 */
    if(!r.fork&&r.fi>=1&&y>=Z.forkAt&&R.fork){const ks=Z.beast.keys.filter(k=>hwAllowed().includes(k)),F=R.fork;
      return {t:F.t,x:F.x,c:[{l:F.stay,h:F.stayH,ok:{t:F.stayT,fx:{hwb:'stay'}}},...ks.map(key=>{const {nm,hj}=aniOf(key),cd=D.cards['zp_'+key];
        return {l:`${nm}(${hj})의 흑수가 된다`,h:`가주 승계를 포기한다 · 이 흑수 하나로만 활동한다 · 카드 ${cd.n.replace('흑수 · ','')} 1장 (${cd.d.split(' · ')[1]||cd.d.split(' · ')[0]}) · 최대 HP +${Z.beast.startFx.maxHp} · 회피 +${Z.beast.startFx.eva}`,ok:{t:F.beastT.replace(/\{n\}/g,nm),fx:{hwb:'become',hwbKey:key}}}})]}}
    if(r.beast)return r.flee?hwFleeYear(G):hwBeastYear(G);
    /* 1) 홍원 안: 앞의 가문 사건 */
    if(r.fi<Z.homeEvents)return y>=Z.famAt[r.fi]?R.fam[r.fi]:null;
    /* 2) 가주의 명으로 홍원 밖에서 영생의 단서를 찾는다 */
    if(!r.mission){
      if(y<Z.missionAt)return null;
      const ks=sample(hwAllowed(),4);
      return {t:R.mission.t,x:R.mission.x,c:ks.map(key=>{const {nm,hj}=aniOf(key),cd=D.cards['zp_'+key];
        return {l:`${nm}(${hj})의 재갈을 쥐고 나선다`,h:`흑수 부하 한 사람(${nm}의 특성) · 흑수 카드 1장 · ${cd.d.split(' · ')[1]||cd.d.split(' · ')[0]} · 홍원 밖으로 나선다 · 돈 +200`,ok:{t:`가주가 ${nm}의 재갈을 건네며 흑수를 앞으로 세웠다. 흑수는 말없이 고개를 숙이고 한 걸음 뒤에 섰다. 붉은 대문을 나서며 뒤를 돌아보지 않았다.`,fx:{hw:`mission1:${key}`,money:200}}}})};
    }
    if(r.out){
      /* 흑수 선인: 단서 하나를 찾을 때마다 재갈을 청할 기회 (최대 sageMax번) */
      if((r.sage||0)<Math.min(Z.sage.max,r.clues||0)&&y>=(r.sNext||0)){const k=r.sage||0,S=R.sage,dc=Z.sage.dc;
        return {t:S.t[k],x:S.x[k],c:[
          {l:S.ask,h:`1d100 · ${dc} 이상이면 재갈 하나 (흑수 부하 +1)`,check:{s:null,dc,pure:true},ok:{t:S.okT,fx:{hw:'sage'}},fail:{t:S.failT,fx:{hw:'sagefail'}}},
          {l:S.gift,h:`돈 −${Z.sage.gift} · 1d100 · ${dc-Z.sage.giftDc} 이상이면 재갈 하나`,check:{s:null,dc:dc-Z.sage.giftDc,pure:true},ok:{t:S.okT,fx:{hw:'sage',money:-Z.sage.gift}},fail:{t:S.failT,fx:{hw:'sagefail',money:-Z.sage.gift}}},
          {l:S.leave,h:'재갈은 얻지 못한다',ok:{t:S.leaveT,fx:{hw:'sagefail'}}}]}}
      if((r.cl||0)<R.clue.length)return y>=r.clNext?R.clue[r.cl]:null;
      return (r.clues||0)>=R.clue.length&&y>=r.clNext?R.back:null;
    }
    /* 3) 귀환 뒤 남은 가문 사건 */
    if(r.fi<R.fam.length)return y>=Z.famAt[r.fi]?R.fam[r.fi]:null;
    if(!r.picked){
      if(y<Z.pickAt)return null;
      if(!r.pk){const pool=hwAllowed().filter(k=>!hwHave(ch).includes(k));r.pk=Z.pairs[r.pair][1-r.w]&&pool.includes(Z.pairs[r.pair][1-r.w])?Z.pairs[r.pair][1-r.w]:one(pool)}
      const {nm:pn,hj:ph}=aniOf(r.pk),ca=D.cards['zp_'+r.pk];
      return {t:R.pick.t,x:R.pick.x+` 이번에는 ${pn}(${ph})의 재갈이 건네진다. 가문이 후보에게 허락하는 마지막 흑수다.`,c:[
        {l:`${pn}(${ph})의 재갈을 받는다`,h:`흑수 부하 한 사람 더 · ${ca.n.replace('흑수 · ','')}: ${ca.d.split(' · ')[1]||ca.d.split(' · ')[0]} · 흑수여, 답하라 카드 · 후보 5명과 맞선다`,ok:{t:`${pn}의 흑수가 고개를 숙이고 곁에 섰다. 이제 부하가 늘었다.`,fx:{hw:'pick'}}}]};
    }
    if(r.rv<r.rivals.length){
      if(y<r.cnext||(r.rv>0&&!ch.beaten.includes(r.rivals[r.rv-1])))return null;
      const E_=D.enemies[r.rivals[r.rv]];return Object.assign({},R.rival,{x:R.rival.x.replace('{n}',E_.n)});
    }
    if(!ch.beaten.includes(r.rivals[r.rivals.length-1]))return null;
    if(!r.shrine){
      if(y<Z.elderFrom)return null;
      const n=hwHave(ch).length;if(n<Z.sage.min)return R.shrine;
      return Object.assign({},R.shrine,{c:[...R.shrine.c,{l:'철함사의 목을 친다',h:`재갈 ${n}개 · 흑수 부하 ${n}명이 모두 철함사로 나선다 · 철함사의 가모와 전투 · 부하가 많을수록 가모가 약해진다 · 공허한 순종은 부하가 거들 때마다 풀린다`,ok:{t:'재갈을 쥔 손에 힘을 주었다. 흑수들이 일제히 고개를 들었다. 어르신들이 처음으로 한 걸음 물러섰다.',fx:{hw:'break'}}}]})}
    if(!r.finalSeen&&(r.host||r.elderDone)&&y>=r.fnext)return R.final;
    return null;
  }
  /* 루트 전용 무기 강화: kind rb|hw, key = 단계 인덱스 또는 'host'|'free'. 끼고 있거나 보관함에 있는 같은 id의 무기를 새 단계로 바꾼다 */
  function routeWeaponUp(ch,kind,key,chips){
    const W=CFG.routeWeapon[kind],g=W[key]||W.lv[key];if(!g)return;
    const it={id:W.id,slot:'weapon',grade:5,lvl:typeof key==='number'?key:9,n:g.n,e:g.e,fx:Object.assign({},g.fx),wx:Object.assign({dice:g.dice},g.wx||{})};
    const old=ch.gear.weapon&&ch.gear.weapon.id===W.id?ch.gear.weapon:null;
    if(old){equip(ch,carryTune(old,it));ch.stash=(ch.stash||[]).filter(x=>x!==old)}
    else{const st=ch.stash||[],i=st.findIndex(x=>x.id===W.id);if(i<0)return;st[i]=carryTune(st[i],it)}
    chips&&chips.push(`전용 무기 강화 · ${g.n} (${g.e})`);
  }
  const s_=(ch,v)=>{ch.stats.maxHp+=v;ch.hp+=v};
  /* 홍루: 내 부하를 뺀 나머지 흑수가 차례로 덤벼든다 (E.zChain = 흑수 키 순서) */
  const ZKEYS=['rat','ox','tiger','rabbit','dragon','snake','horse','goat','monkey','rooster','dog','pig'];
  /* 흑수 재갈: 가주 몫 넷(소·용·원숭이·닭)은 후보가 쥘 수 없다. 흑수 선인에게서 나머지 여덟 재갈을 얻는다 */
  const eqT=ch=>{const t=ch.equipTitle;return t&&(t===ch.title||(ch.titles||[]).includes(t)||(ch.marks||[]).includes(t))?t:''};
  const hwAllowed=()=>ZKEYS.filter(k=>!CFG.hw.crown.includes(k));
  const aniOf=key=>{const Z=CFG.hw;for(let pi=0;pi<Z.pairs.length;pi++){const w=Z.pairs[pi].indexOf(key);if(w>=0){const pk=D.hwRoute.pick.pairs[pi];return {pi,w,nm:pk[w],hj:pk[2][w]}}}return {pi:0,w:0,nm:key,hj:''}};
  const hwHave=ch=>(ch.hw&&ch.hw.have)||[];
  function zNext(A,c){const cur=Object.keys(D.cards).find(k=>D.cards[k]===c)||'',k=cur.replace(/^zp?_/,''),i=A.zChain.indexOf(k);return i<0?c.next:'z_'+A.zChain[(i+1)%A.zChain.length]}
  function rbFlee(ch,chips){
    const r=ch.rb,Z=CFG.rb;if(!r||r.fled)return;
    r.fled=1;r.cnext=(ch.year||0)+Z.chaseGap;
    if(ch.aff&&ch.aff.name==='R사 날개'){ch.aff=null;ch.fi=undefined;ch.fr=null;ch.pp=0;ch.promos=0;ch.strikes=0}
    chips.push('R사를 탈주했다 · 소속을 잃고 숙청 추격대가 풀렸다')
  }
  /* ===== R사 부화장 복제체 루트 =====
     ch.rb = {n(쓰러뜨린 부화장 개체), out(부화장을 나옴), next(추격 시작 해), fled, chase(만난 추격대), hides, cnext(다음 추격 해), bossSeen, done}
     부화장 연전은 해를 넘기지 않고 이어진다. 부화장 안에서는 공방이 없고, 나온 뒤에는 R사 보급 구역, 탈주 뒤에는 뒷골목 공방으로 열린다 */
  function rbFree(G){
    const ch=G.ch,r=ch.rb,Z=CFG.rb;if(!r||!D.rbRoute)return null;
    /* 금기 위반이 확인되면 머리가 바로 보낸다: 발톱 → 조율자 (쉬지 않고 이어진다) */
    if(r.out&&r.chain&&r.chain.length){
      const id=r.chain.shift();(G.met=G.met||[]).push(id);if(!r.chain.length)r.cnext=G.year+Z.bossGap;
      return {type:'fight',enemy:id,enc:{hidden:true,label:'머리의 시험 · '+D.enemies[id].n}};
    }
    if(r.out)return null;
    if(!r.intro){r.intro=1;return {type:'event',ev:Object.assign({},D.rbRoute.hatch,{x:D.rbRoute.hatch.x+` 손등의 번호표 밑에는 R사 날개 ${ch.rteam} 표식이 찍혀 있다.`})}}
    if(r.n<Z.total)return {type:'fight',enemy:'rc'+String(r.n+1).padStart(2,'0'),enc:{label:`부화장 · ${r.n+1}/${Z.total}`}};
    return {type:'event',ev:Object.assign({},D.rbRoute.exit,{x:D.rbRoute.exit.x+` 배치 팀: ${ch.rteam}.`+(ch.rteam==='까마귀팀'?D.rbRoute.ravenNote:'')})};
  }
  function rbYear(G){
    const ch=G.ch,r=ch.rb,y=G.year,Z=CFG.rb,R=D.rbRoute;if(!r||!R||!r.out||r.done)return null;
    if(!r.fled)return y>=r.next?R.flee:null;
    const beat=r.chasers.every(id=>ch.beaten.includes(id));
    if(!beat){
      if(y<r.cnext)return null;
      if(r.chase<r.chasers.length&&(r.chase===0||ch.beaten.includes(r.chasers[r.chase-1]))){
        const E_=R.chase;return r.hides>=Z.hides?Object.assign({},E_,{c:E_.c.slice(0,1)}):E_;
      }
      return null;
    }
    /* 숙청 집행관(R사의 끝) → 2막 중반: 정비 한 번 → 금기 위반 확인(즉시 바랄 → 제나 연전) */
    if(!r.bossSeen)return y>=r.cnext?R.boss:null;
    if(!r.bossDone)return null;
    if(!r.prep)return y>=Z.headFrom?R.prep:null;
    if(!r.headSeen)return y>=r.hAt?R.head:null;
    return null;
  }
  function giriRouteEvent(G){
    const ch=G.ch,y=G.year,R=D.giriRoute,Z=CFG.giri,fl=ch.flags;
    if(!R||ch.distForm||ch.job||!ch.aff||ch.aff.name!=='중지')return null;
    if(fl.giri&&!fl.giriChoice&&(ch.beaten||[]).includes('pil2'))
      return {t:R.trial.t,x:R.trial.x,c:[
        {l:R.trial.obey,h:R.trial.obeyH,ok:{t:R.trial.obeyT,fx:{giri:'obey'}}},
        {l:R.trial.rebel,h:R.trial.rebelH,ok:{t:R.trial.rebelT,fx:{giri:'rebel'}}}]};
    if(!fl.giri&&ch.fi===Z.fi&&y>=(ch.giriAt||0)&&d(100)<=Z.chance)
      return {t:R.start.t,x:R.start.x,c:[
        {l:R.start.yes,h:R.start.yesH,ok:{t:R.start.yesT,fx:{giri:'start'}}},
        {l:R.start.no,h:R.start.noH,ok:{t:R.start.noT,fx:{giri:'later'}}}]};
    return null;
  }
  function synRouteEvent(G){
    const ch=G.ch,y=G.year,R=D.synRoute,Z=CFG.synRoute;
    if(!R||ch.distForm||ch.job)return null;
    const sy=synOf(ch),fl=ch.flags;
    if(fl.traitorPend&&!fl.traitor){
      return {t:R.traitor.t,x:R.traitor.x,c:[
        {l:R.traitor.fight,h:R.traitor.fightH,ok:{t:R.traitor.fightT,fx:{synRoute:'traitor'}}},
        {l:R.traitor.flee,h:R.traitor.fleeH,ok:{t:R.traitor.fleeT,fx:{synRoute:'traitorFlee'}}}]};
    }
    if(fl.thumbOffer&&!fl.purgeSeen&&y>=(ch.purgeAt||0)){
      return {t:R.purge.t,x:fl.thumbTurn?R.purge.yes:R.purge.snub,c:[
        {l:R.purge.rebel,h:R.purge.rebelH,ok:{t:R.purge.rebelT,fx:{synRoute:'rebel'}}},
        {l:R.purge.bow,h:R.purge.bowH,ok:{t:R.purge.bowT,fx:{synRoute:'bow'}}}]};
    }
    if((sy==='kuro'||sy==='awl')&&fl.synTop&&!fl.thumbOffer&&d(100)<=Z.offerChance){
      return {t:R.offer.t,x:R.offer[sy],c:[
        {l:R.offer.yes,h:R.offer.yesH,ok:{t:R.offer.yesT,fx:{synRoute:'accept'}}},
        {l:R.offer.no,h:R.offer.noH,ok:{t:R.offer.noT,fx:{synRoute:'snub'}}}]};
    }
    return null;
  }
  function oracleEvent(G){
    const ch=G.ch,y=G.year,O=CFG.oracle;
    if(ch.distForm||ch.job||ch.oracle||!ch.aff||ch.aff.name!=='검지'||(ch.fi||0)<1||(ch.oracleTries||0)>=O.tries||y<(ch.oracleNext||0)||d(100)>O.chance)return null;
    const T_=D.oracle;
    return {t:T_.t,x:T_.x,c:[
      {l:T_.pick,h:`1d100 · ${O.dc} 이상이면 신탁대행자 (남은 기회 ${O.tries-(ch.oracleTries||0)}번)`,check:{s:null,dc:O.dc,pure:true},ok:{t:T_.okT,fx:{oracle:true}},fail:{t:T_.failT,fx:{oracleFail:true}}},
      {l:T_.skip,h:'다시 만나지 않는다',ok:{t:T_.skipT,fx:{oracleDecline:true}}}]};
  }
  /* 소지의 도: 표식이 생긴 뒤 CFG.pinky.every년차마다 인·의·예·지 사건이 차례로 온다 (판정 1d100 ≥ dc) */
  function pinkyEvent(G){
    const ch=G.ch,y=G.year,P_=CFG.pinky;
    if(!ch.pinky||ch.distForm||ch.seongPick||(ch.pinkyKeys||[]).length>=D.pinky.keys.length||y<(ch.pinkyNext??((ch.pinkyYear||0)+P_.every)))return null;
    ch.pinkyNext=y+P_.every;
    const n=(ch.pinkyKeys||[]).length,K=D.pinky.keys[n];
    return {t:K.t,x:K.x,c:[{l:K.l,h:`1d100 · ${P_.dc} 이상이면 ${K.k}를 얻는다 (${n}/${D.pinky.keys.length})${ch.flags.starborn?' · 성도에 「'+K.k+'」의 별을 새긴다 ('+CFG.star.virt[K.k].e+')':''}`,check:{s:null,dc:P_.dc,pure:true},ok:{t:K.ok,fx:{pinkyKey:true}},fail:{t:K.fail,fx:{}}}]};
  }
  /* 성도: 인의예지를 모두 모으면 이름을 붙인 전리품(무기가 아닌 패시브). 공격·회피·추가 피해를 각각 굴려 능력치에 영구히 더한다 */
  function setSeongdo(ch,name,force){
    if(!ch.seongPick||(!force&&nameErr(name)))return false;
    const R=CFG.pinky.seongdo,r=([a,b])=>a-1+d(b-a+1),fx={atk:r(R.atk),eva:r(R.eva),dmgB:r(R.dmgB)};
    const nm=(name||'').trim()||'이름 없는',n=nm+'성도',e=`공+${fx.atk} · 회피+${fx.eva} · 피해+${fx.dmgB}`;
    addStats(ch.stats,fx);ch.seongNote=`${n} · ${e}`;ch.seongFx=fx;
    ch.seongPick=false;ch.seongDone=true;(ch.relics=ch.relics||[]).push(`성도 · ${n}`);return {n,e,fx};
  }
  /* 해마다 순서: 제안(from년차부터 chance%) → 개발 진척 → 날개 설립 → 실험. 사건을 보이면 그 사건을 돌려준다 */
  function corpEvent(G){
    const ch=G.ch,c=ch.corp,y=G.year;
    if(ch.distForm||ch.job)return null;
    if(!c){if(!(ch.aff&&ch.aff.type==='wing')||y<CP.from||d(100)>CP.chance)return null;ch.corp={st:'offer'};return D.corp.start}
    if(c.st==='dev'){
      if(c.stack>=CP.devMax)return D.corp.found;
      if(y>=c.next&&d(100)<=CP.devChance){c.next=y+CP.devGap;return D.corp.grow}
      return null;
    }
    if(c.st==='wing'&&!(c.chain&&c.chain.length)&&!(c.up>=CP.upMax&&c.forb>=CP.forbMax)&&y>=c.next&&d(100)<=CP.labChance){c.next=y+CP.labGap;return D.corp.lab}
    return null;
  }
  /* 육신 뒤틀림: 장비를 모두 벗고(보관함), 깡 능력치 상승, 카드팩은 뒤틀린 카드팩으로 고정, 정신력 시스템이 사라진다.
     이전 카드팩은 보관함에 남고, 안정화 사건(2년마다 40%)을 겪으면 장비·카드팩을 다시 쓸 수 있고 더 강해진 뒤틀린 카드팩을 얻는다 */
  function setDistort(ch,name){
    const X=CFG.distort,s=ch.stats;
    for(const it of Object.values(ch.gear)){if(!it)continue;for(const [k,v] of Object.entries(it.fx||{}))if(k!=='dmin'&&k in s)s[k]-=v;(ch.stash=ch.stash||[]).push(it)}
    ch.gear={};s.dmin=calcDmin(ch);for(const g of ch.gearOffers||[])(ch.stash=ch.stash||[]).push(g);ch.gearOffers=[];
    addStats(s,X.fx);ch.hp=clamp(ch.hp+(X.fx.maxHp||0),1,s.maxHp);ch.distStable=false;ch.stableNext=(ch.year||0)+X.stable.every;
    ch.distForm={n:(name||'').trim()||'이름 없는 뒤틀림'};ch.huntNext=(ch.year||0)+(BD.hunt?BD.hunt.gap:3);ch.distPick=false;ch.distortPend=false;ch.distortDone=true;ch.voiceUsed=true;ch.mind=mindMax(ch);
    ensurePacks(ch);
    const fx=ch.deck.filter(id=>D.cards[id].fixed);
    ch.preDistDeck=ch.deck.slice();   // 토벌 의뢰의 가족은 뒤틀리기 전 책장을 쓴다
    stashPack(ch,X.packN);
    ch.deck=X.deck.concat(fx);ch.deckLocked=true;ch.cardMoney=true;ch.side=[];ch.extra=[];ch.finalGiven=false;ch.offers=[];ch.picks=[];ch.packOffer=null;
    (ch.relics=ch.relics||[]).push('뒤틀림 · '+ch.distForm.n);
  }
  /* 뒤틀림 안정화: 2년마다 stable.chance% — 장비·카드팩을 다시 쓸 수 있고, 더 강해진 뒤틀린 카드팩을 얻는다 */
  function distStableEvent(G){
    const ch=G.ch,y=G.year,X=CFG.distort;if(!ch.distForm||ch.distStable||y<(ch.stableNext||0))return null;
    ch.stableNext=y+X.stable.every;if(d(100)>X.stable.chance)return null;
    return D.mindEvents.stable;
  }
  function setStable(ch){
    const X=CFG.distort;if(!ch.distForm||ch.distStable)return false;
    ch.distStable=true;const fx=ch.deck.filter(id=>D.cards[id].fixed);
    if(ch.packName===X.packN){ch.packName=X.packN2;ch.deck=X.deck2.concat(fx)}
    else{ensurePacks(ch);stashPack(ch,X.packN2);ch.deck=X.deck2.concat(fx);ch.deckLocked=true;ch.cardMoney=true;ch.side=[];ch.extra=[];ch.finalGiven=false}
    (ch.relics=ch.relics||[]).push('뒤틀림 안정화');
    return true;
  }
  /* 무한런: 마지막 해, 지금 위협 등급(-1이면 아직 기본 연차) */
  const lastYear=G=>G.infinite?Infinity:CFG.years+(G.endless?CFG.endless.span*CFG.endless.grades.length:0);
  const gradeAt=y=>y>CFG.years?Math.min(CFG.endless.grades.length-1,Math.floor((y-CFG.years-1)/CFG.endless.span)):-1;
  /* 무한 모드의 위협 등급 번호(상한 없음) */
  const gradeRaw=y=>y>CFG.years?Math.floor((y-CFG.years-1)/CFG.endless.span):-1;
  /* 공방 카드 교환: 덱 카드 1장을 일반 전투 보상 카드(아직 없는 것) 중 무작위 1장으로 바꾼다 */
  function swapCard(ch,i){
    const S=CFG.shop;if(ch.deckLocked||ch.cardMoney||ch.money<S.swapCost||!ch.deck[i]||D.cards[ch.deck[i]].fixed)return null;
    const pool=D.rewards.filter(id=>!ownsCard(ch,id));if(!pool.length)return null;
    const nid=one(pool),old=ch.deck[i];ch.money-=S.swapCost;ch.deck[i]=nid;return {old,nid};
  }
  /* 공방 장비 정비: 장착 중인 장비 1개에 공격 또는 회피 +1을 시도한다 (성공 chance%, 시도는 성패와 상관없이 소모) */
  const tuneCost=g=>CFG.shop.tune.base+CFG.shop.tune.step*(g.tries||0);
  /* 정비 최대 횟수: 공방 해결사는 더 많이 할 수 있다 */
  /* 제나를 쓰러뜨린 뒤에는 장비마다 정비를 zenaPlus번 더 할 수 있다 (바랄·제나의 장비는 기본 횟수만 — 후반 장비가 한 가지로 굳지 않게) */
  const tuneMax=(ch,g)=>(isWs(ch)?CFG.shop.tune.maxWs:CFG.shop.tune.max)+(ch.flags&&ch.flags.beatZena&&g&&!CFG.shop.tune.noPlus.includes(g.id)?CFG.shop.tune.zenaPlus:0);
  function tuneGear(ch,slot,stat){
    const T=CFG.shop.tune,g=ch.gear[slot];
    if(!g||(ch.distForm&&!ch.distStable)||!['atk','eva'].includes(stat)||(g.tries||0)>=tuneMax(ch,g)||ch.money<tuneCost(g))return null;
    const cost=tuneCost(g);ch.money-=cost;
    const ng=structuredClone(g);ng.tries=(g.tries||0)+1;
    const ok=d(100)<=T.chance;
    if(ok){ng.fx[stat]=(ng.fx[stat]||0)+1;ch.stats[stat]+=1;ng.tune=Object.assign({},ng.tune);ng.tune[stat]=(ng.tune[stat]||0)+1}
    ch.gear[slot]=ng;
    return {ok,cost,tries:ng.tries,stat,n:ng.n};
  }
  function delCard(ch,i){
    /* 덱 고정·전용 카드팩(숨은 출생)은 카드를 지울 수 없다 */
    if(ch.deckLocked||ch.cardMoney)return false;
    if(ch.money<CFG.shop.delCost||ch.deck.length<=CFG.shop.minDeck||!ch.deck[i]||D.cards[ch.deck[i]].fixed)return false;
    ch.money-=CFG.shop.delCost;return ch.deck.splice(i,1)[0];
  }
  /* 히든 직업 전용 문구: 사건의 jobs[직업].c = [{i:선택지 번호, ...덮어쓸 값}] (null이면 그 항목을 지운다) */
  function evForJob(ev,ch){
    const J=ev&&ev.jobs&&ch&&ch.job&&ev.jobs[ch.job];if(!J)return ev;
    const o=Object.assign({},ev);delete o.jobs;if(J.x)o.x=J.x;
    o.c=ev.c.map((c,i)=>{const ov=(J.c||[]).find(z=>z.i===i);if(!ov)return c;const n=Object.assign({},c);for(const [k,v] of Object.entries(ov)){if(k==='i')continue;if(v===null)delete n[k];else n[k]=v}return n});
    return o;
  }
  /* 결혼 후 달달한 한때: 해를 넘기지 않는 사건. 1막은 sweetEvery년마다, 2막부터는 sweetEvery2년마다. 선택지는 둘 다 좋은 쪽이고 2막에는 나이 든 묘사를 덧붙인다 */
  function bondSweetEvent(G){
    const ch=G.ch,b=ch.bond,BD_=CFG.bond,S=D.bond&&(lakeOn(ch)&&D.lake&&D.lake.sweetOld?Object.assign({},D.bond.sweet,{old:D.lake.sweetOld}):D.bond.sweet);
    if(!S||!b||b.st!=='married'||ch.distForm||ch.job)return null;
    const act2=G.year>CFG.years,every=act2?BD_.sweetEvery2:BD_.sweetEvery;
    if(b.sweetAt==null)b.sweetAt=b.since||G.year;
    if(G.year-b.sweetAt<every)return null;
    b.sweetAt=G.year;
    /* 배우자 소속(route)에 맞는 장면은 route가 같은 것만, 공통 장면은 route가 없는 것만. 소속 장면을 60% 확률로 먼저 고른다 */
    const seen=b.sweetSeen=b.sweetSeen||[],ok=e=>(e.route?e.route===b.route:b.route!=='lake')&&(e.variant==null||e.variant===(b.variant||0));   // 호수 인연은 호수 전용 문구만
    let pool=S.items.map((e,i)=>i).filter(i=>ok(S.items[i])&&!seen.includes(i));
    if(!pool.length){seen.length=0;pool=S.items.map((e,i)=>i).filter(i=>ok(S.items[i]))}
    const own=pool.filter(i=>S.items[i].route===b.route),gen=pool.filter(i=>!S.items[i].route);
    const i=one(own.length&&(!gen.length||d(100)<=(own.length>=4?85:60))?own:gen.length?gen:pool);seen.push(i);const e=S.items[i];
    const x=bondFill(e.x,b)+(act2&&S.old&&S.old.length?' '+one(S.old):'');
    return {t:'달달한 한때 · '+e.t,x,c:[{l:bondFill(e.a,b),h:'함께하는 시간',ok:{t:bondFill(e.at,b),fx:{}}},{l:bondFill(e.b,b),h:'함께하는 시간',ok:{t:bondFill(e.bt,b),fx:{}}}]};
  }
  /* 외곽 동행 의뢰(무한 모드): 배우자와 함께 나서는 전투. 배우자 소속에 따라 전투형(협공)·비전투형(지원)·수비형(막아섬) */
  const escortKind=route=>{const K=CFG.escort.kinds;return K.guard.includes(route)?'guard':K.support.includes(route)?'support':'fighter'};
  const outerPhase=G=>!!G.infinite&&G.year>CFG.years+CFG.endless.span*CFG.endless.grades.length;
  function bondEscortEvent(G){
    const ch=G.ch,b=ch.bond,S=D.bond&&D.bond.escort,Z=CFG.escort;
    if(!S||!b||b.st!=='married'||ch.distForm||ch.job||!outerPhase(G))return null;
    if(b.escortAt==null)b.escortAt=G.year;
    if(G.year<b.escortAt)return null;
    b.escortAt=G.year+Z.gap;if(d(100)>Z.chance)return null;
    const K=S.kinds[escortKind(b.route)];
    return {t:K.t,x:bondFill(K.x,b),c:[{l:bondFill(K.a,b),h:bondFill(K.h,b),ok:{t:bondFill(K.at,b),fx:{combat:'table:outskirts',escort:true}}},{l:bondFill(K.b,b),h:'변화 없음',ok:{t:bondFill(K.bt,b),fx:{}}}]};
  }
  function newGame(ch){return {ch,year:0,pool:sample(D.events.map((_,i)=>i),D.events.length)}}
  const age=G=>CFG.startAge+G.year-1;
  /* 다음 해: 끝 / 고정 전투 / 사건 */
  /* 고정 전투 지정: fixedFights에 적힌 해, 그다음은 fixedRule(every년마다 단계별 표, final 연차는 보스) */
  function fixedSpec(year){
    if(D.fixedFights[year])return D.fixedFights[year];
    const R=D.fixedRule;if(!R)return null;
    if(R.final&&R.final[year])return R.final[year];
    if(year%R.every)return null;
    const t=R.tiers.find(t=>year<=t.until);return t?t.spec:null;
  }
  /* W사 열차 직원 전용 사건: 열차 안에서 일어나는 일이라 해가 넘어가지 않는다 (해마다 최대 한 번) */
  function warpEvent(G){
    const ch=G.ch,L=D.warpEvents;if(ch.wtrain&&!(ch.aff&&ch.aff.name==='W사 날개'))ch.wtrain=false;if(!ch.wtrain||!L||!L.length||ch.distForm||ch.warpYear===G.year||d(100)>CFG.warp.chance+(ch.wLead?CFG.warp.leadPlus:0))return null;
    const seen=ch.warpSeen=ch.warpSeen||[];let pool=L.map((e,i)=>i).filter(i=>!seen.includes(i)&&meets(ch,L[i].req)&&!(L[i].once&&(ch.warpOnce||[]).includes(L[i].once)));
    if(!pool.length){seen.length=0;pool=L.map((e,i)=>i).filter(i=>meets(ch,L[i].req)&&!(L[i].once&&(ch.warpOnce||[]).includes(L[i].once)))}
    if(!pool.length)return null;const i=one(pool);seen.push(i);ch.warpYear=G.year;return L[i];
  }
  function advanceYear(G){
    /* G.free: 해를 넘기지 않는 사건(유물·라만차·뒤틀림 등)이면 true → 화면에 연차를 표시하지 않는다 */
    G.free=true;const mc=G.ch;repairFixed(mc);repairDmin(mc);repairFixer(mc);autoOffers(mc);if(mc.corp&&corpClearCheck(mc,[]))(mc.relics=mc.relics||[]).push('머리의 시험을 넘었다');if(mc.corp&&!mc.corp.up2&&mc.corp.forb>=CP.forbMax)corpUp2(mc,[]);
    if(mc.distPick)setDistort(mc,'');
    /* 기업 루트: 이름 고르기를 건너뛴 채(자동 진행) 넘어오면 기본값으로 정한다 */
    if(mc.singPick)setSing(mc,one(Object.keys(CP.types)),'제로',true);
    if(mc.wingPick)setWing(mc,'새벽',true);
    if(mc.bondPick)setBondName(mc,'동반자',true);
    if(mc.bondColPick)setPartnerAlias(mc,'',true);
    if(mc.kidPick)setKidName(mc,'',true);
    if(mc.seongPick)setSeongdo(mc,'무명',true);
    if(mc.starPick)setStar(mc,'',true);
    if(mc.orgPick)chooseOrg(mc,one(D.orgs[mc.orgPick]));
    if(mc.fingerPick)chooseFinger(mc,mc.thumbBias&&d(100)<=mc.thumbBias?'엄지':one(D.orgs.finger));
    if(mc.pillPick)setPill(mc,'atk');
    if(mc.custPick)custBuild(mc,{name:'',atk:4,eva:4,hp:3,pas:'absorb'});
    if(mc.colorPick)setColorPick(mc,'brand');
    if(mc.namePend)mc.namePend=null;
    if(mc.sunk)return {type:'end',win:false,cause:'sunk'};
    if(mc.mindDead)return {type:'end',win:false,cause:'mind'};
    if(mc.distorted)return {type:'end',win:false,cause:'distort'};
    if(mc.distortPend&&!mc.ego){mc.distortPend=false;mc.distortDone=true;return {type:'event',ev:D.mindEvents.distort}}
    if(hasInn(mc,'mark')&&!mc.markOn&&G.year>=CFG.innate.markYear-1)return {type:'event',ev:D.innateEvents.mark};
    if(D.relicEvent&&!mc.relicEvt&&!mc.hw&&G.year===CFG.relicEvent.year-1){mc.relicEvt=true;return {type:'event',ev:(lakeOn(G.ch)&&D.lake&&D.lake.relicEvent)||D.relicEvent}}
    /* 혈귀 종족: 40~70년차 사이 한 번 참을 수 없는 갈증이 온다 (연인이 인간인지 혈귀인지에 따라 다른 사건) */
    if(mc.race==='hyeolgwi'&&D.thirstEvents&&!mc.thirstDone&&!mc.distForm){mc.thirstAt=mc.thirstAt||(40+d(31)-1);
      if(G.year>=mc.thirstAt){mc.thirstDone=true;const T_=D.thirstEvents,b=mc.bond,mar=b&&b.st==='married',ev=JSON.parse(JSON.stringify(mar?(spouseHy(mc,b)?T_.hyeol:T_.human):T_.solo)),nm=mar?b.name:'';
        return {type:'event',ev:JSON.parse(JSON.stringify(ev).replace(/\{n\}/g,nm))}}}
    {const pe=bondPartnerEvent(G);if(pe)return {type:'event',ev:pe}}
    {const sw=bondSweetEvent(G);if(sw)return {type:'event',ev:sw}}
    if(mc.resoPend&&D.familyReso&&G.year>=(mc.resoAt||0)){mc.resoPend=false;mc.resoAsked=true;return {type:'event',ev:D.familyReso}}
    if(mc.familyPend&&D.familyCall){mc.familyPend=false;mc.familyAsked=true;return {type:'event',ev:D.familyCall}}
    /* 조율자: 10년마다 머리의 권한이 한 단계 오른다 (해는 넘어가지 않음) */
    /* 혈귀: 16년차에 라만차랜드 초대장 (해는 넘어가지 않음) */
    if(mc.race==='hyeolgwi'&&D.lamanchaEvent&&!mc.lamanchaAsked&&G.year===CFG.lamancha.year-1){mc.lamanchaAsked=true;return {type:'event',ev:D.lamanchaEvent}}
    if(mc.job==='arbiter'&&D.arbiterAuth&&G.year%10===9&&mc.authAt!==G.year){mc.authAt=G.year;return {type:'event',ev:D.arbiterAuth}}
    if(mc.affRetry&&!mc.aff){mc.affRetry=false;return {type:'event',ev:D.affiliation}}
    if(mc.voicePend&&!mc.voiceUsed&&!mc.ego){mc.voicePend=false;mc.voiceUsed=true;return {type:'event',ev:D.mindEvents.voice}}
    /* 기업 루트 끝: 금기 실험을 forbMax번 하면 머리가 부른다. 발톱 → 조율자가 해를 넘기지 않고 연속으로 온다 */
    if(mc.corp&&mc.corp.hunt&&mc.corp.hunt.length){const id=mc.corp.hunt.shift();(G.met=G.met||[]).push(id);return {type:'fight',enemy:id,enc:{hidden:true,label:'머리의 시험 · '+D.enemies[id].n}}}
    if(mc.corp&&mc.corp.chain&&mc.corp.chain.length){
      if(!mc.corp.headSeen){mc.corp.headSeen=true;return {type:'event',ev:D.corp.head}}
      const id=mc.corp.chain.shift();mc.corp.trial=id;(G.met=G.met||[]).push(id);
      return {type:'fight',enemy:id,enc:{hidden:true,label:'머리의 시험 · '+D.enemies[id].n}};
    }
    {const rv=rbFree(G);if(rv)return rv}
    if(mc.hw&&mc.hw.done&&!mc.hw.ended){mc.hw.ended=true;return {type:'end',win:true,hw:mc.hw.flee?'hwflee':mc.hw.maker?'hwmaker':mc.hw.host?'hwhost':mc.hw.broke?'hwbreak':'hwfree'}}
    if(mc.flags&&mc.flags.wquit&&!mc.wAfter&&D.warpAfter&&(!mc.wEnd||mc.wEnded)){mc.wAfter=true;return {type:'event',ev:D.warpAfter}}
    if(mc.wEnd&&!mc.wEnded){mc.wEnded=true;return {type:'end',win:true,hw:mc.wEnd}}
    if(mc.rb&&mc.rb.done&&!mc.rb.ended){mc.rb.ended=true;return {type:'end',win:true,rb:true}}
    /* 연전: 바랄을 쓰러뜨리면 쉬지 않고 제나가 나선다 */
    if(G.ch.hw&&G.ch.hw.hongruPend&&!G.ch.beaten.includes('hongru'))return {type:'fight',enemy:'hongru',enc:{hidden:true,label:'선황충을 노리는 홍루'}};
    if(G.ch.flags.zenaPend&&!G.ch.beaten.includes(CFG.endless.finalNext))return {type:'fight',enemy:CFG.endless.finalNext,enc:{hidden:true,label:'연전 · 마지막 상대'}};
    /* 무한 모드에서 oldAge살을 넘기면 히든 엔딩 (한 번만, 이어서 살아갈 수 있다) */
    if(G.infinite&&!G.ch.oldEnd&&age(G)>=CFG.oldAge){G.ch.oldEnd=true;return {type:'end',win:true,old:true}}
    /* 무한 모드에서 overflowAge살에 닿으면 끝나는 히든 엔딩 (기록실에는 올라가지 않고, 이어갈 수 없다) */
    if(G.infinite&&!G.ch.overflowEnd&&age(G)>=CFG.overflowAge){G.ch.overflowEnd=true;return {type:'end',win:true,overflow:true}}
    /* 무한 모드 추가 엔딩: 한 번씩, 끝낸 뒤에도 이어서 살아갈 수 있다 */
    if(G.infinite){const ch=G.ch,OE=CFG.outEnds;ch.outSeen=ch.outSeen||{};
      const baseEnd_=CFG.years+CFG.endless.span*CFG.endless.grades.length;
      /* 균열은 균열로 흘러드는 히든 보스를 모두 쓰러뜨리면 닫힌다 */
      if(!ch.outSeen.seal&&G.year>baseEnd_&&riftBosses().every(h=>ch.beaten.includes(h.id))){ch.outSeen.seal=1;return {type:'end',win:true,out:'seal'}}
      if(!ch.outSeen.star&&ch.beaten.length>=OE.starHidden){ch.outSeen.star=1;return {type:'end',win:true,out:'star'}}
      if(!ch.outSeen.settle&&bondMarried(ch)&&(ch.bond.kids||[]).some(k=>G.year-k.born>=BD.kid.adult)&&G.year>=baseEnd_+OE.settleYears){ch.outSeen.settle=1;return {type:'end',win:true,out:'settle'}}}
    /* W사: 입사 직후 근무지 선택, 열차 직원은 해마다 열차 안 사건이 온다 (해는 넘어가지 않음) */
    if(mc.aff&&mc.aff.name==='W사 날개'&&D.warpFork&&mc.wtrain===undefined&&!mc.wAsked){mc.wAsked=true;return {type:'event',ev:D.warpFork}}
    if(G.infinite&&mc.wtrain&&D.warpQuit&&!mc.wLead&&!mc.wQuitShown&&(mc.year||0)>=(mc.wQuitAt||0)){mc.wQuitShown=true;return {type:'event',ev:D.warpQuit}}
    /* 열차 연전: 사건 하나에서 적을 연달아 상대한다. 해는 넘어가지 않고, 정리가 끝나 수복한 뒤에야 해가 지난다 */
    if(mc.wChain){const W=mc.wChain;
      if(W.i<W.ids.length){const id=W.ids[W.i++];return {type:'fight',enemy:id,enc:{label:`${W.label} · ${W.i}/${W.ids.length}`}}}
      if(W.hid&&!W.hidTried){W.hidTried=true;if(d(100)<=W.hid.chance&&D.enemies[W.hid.id]){W.hidFight=true;return {type:'fight',enemy:W.hid.id,enc:{hidden:true,label:W.hid.label}}}}
      mc.wChain=null;const F=W.hidFight&&W.doneHid?W.doneHid:W.done;return {type:'event',ev:{t:F.t,x:F.x,c:[{l:F.l,ok:{t:F.t2,fx:F.fx}}]}}}
    if(mc.wtrain&&mc.wPick&&D.warpWeaponPick)return {type:'event',ev:D.warpWeaponPick};
    {const we=warpEvent(G);if(we)return {type:'event',ev:we}}
    G.free=false;G.year++;
    if(G.year>lastYear(G)){G.year=lastYear(G);const hk=G.ch.hw&&!G.ch.hw.ended?(G.ch.hw.flee?'hwflee':G.ch.hw.accept?'hwmaker':null):null;if(hk)G.ch.hw.ended=true;return {type:'end',win:true,trueEnd:!!G.endless,hw:hk}}
    G.ch.year=G.year;
    if(G.year>1){G.ch.hp=Math.min(G.ch.stats.maxHp,G.ch.hp+CFG.yearHeal);if(G.year%(M.healEvery||1)===0)gainMind(G.ch,M.yearHeal);
      /* 대호수: 호수에 오래 떠 있을수록 정신이 닳는다. 해마다 mindYear씩 깎이지만 mindKeep 밑으로는 이 깎임만으로 내려가지 않는다(뒤틀림·사망으로 곧장 가지 않게) */
      if(G.infinite&&G.ch.infinite&&G.ch.colorDone){const Lm=CFG.infinite.limit;if(G.year%Lm.traitYearEvery===0)G.ch.stats.atk+=1}
    if(lakeOn(G.ch)&&!G.ch.distForm&&G.ch.mind>CFG.lake.mindKeep)loseMind(G.ch,Math.min(CFG.lake.mindYear,G.ch.mind-CFG.lake.mindKeep));if(hasInn(G.ch,'will'))gainMind(G.ch,CFG.innate.willHeal);
      {const mt=corpType(G.ch);if(mt&&mt.year)gainMind(G.ch,mt.year+corpLv(G.ch)*(mt.yearPer||0))}
      if(bondMarried(G.ch))gainMind(G.ch,BD.yearMind);G.lastIncome=earn(G.ch,income(G.ch));G.ch.money+=G.lastIncome}
    /* 근속: 진로가 있으면 해마다 포인트가 조금씩 쌓인다 */
    if(G.year>1&&CFG.promo.gain.year&&canPromote(G.ch))G.ch.pp=(G.ch.pp||0)+CFG.promo.gain.year;
    let f=fixedSpec(G.year);
    /* 무한런 등급 전투: 등급 마지막 해. 도시의 별 등급은 피아니스트(이미 이겼으면 후반 조우), 마지막 등급은 최종 상대 */
    const X_=CFG.endless,k_=G.year-CFG.years;
    const baseEnd=CFG.years+X_.span*X_.grades.length,INF=CFG.infinite;
    if(G.infinite&&G.year>baseEnd){
      /* 제 2막 무한 모드: 위협 등급 전투는 후반 조우, every년마다 강화 불순물 */
      if((G.year-baseEnd)%INF.every===0){
        /* 무한 모드에 들어설 때 외곽에 지은 집(혼자여도), 또는 인연 이야기의 외곽의 작은 집이 있다면 불순물은 그 집으로 찾아온다 */
        const LH_=lakeOn(G.ch)&&D.lake&&D.lake.infinite&&D.lake.infinite.impurity,H_=LH_||(D.infinite&&D.infinite.home),E_=D.enemies[X_.final],home=H_&&(LH_||G.ch.infHome||(G.ch.outSeen&&G.ch.outSeen.settle));
        if(E_){if(E_.intro0===undefined)E_.intro0=E_.intro;E_.intro=home?H_.intro[((G.ch.infImp||1)-1)%H_.intro.length]:E_.intro0}
        return {type:'fight',enemy:X_.final,enc:{hidden:true,label:`${home?H_.label:'외곽의 괴수'} · ${(G.ch.infImp||1)}번째`}}}
      f=k_%X_.span?null:'table:late';
    }else
    if(k_>0)f=k_%X_.span?null:gradeAt(G.year)===X_.grades.length-1?X_.finalFirst:gradeAt(G.year)===X_.grades.indexOf('도시의 별')&&!(G.ch.minis||[]).includes(X_.star)?X_.star:'table:late';
    /* R사 루트처럼 마지막 등급 전투 전에 이미 바랄을 쓰러뜨렸다면 같은 상대를 다시 세우지 않는다: 제나가 남았으면 제나가 나서고, 둘 다 쓰러뜨렸다면 평소 해로 넘어간다 */
    if(f&&k_>0&&!(G.infinite&&G.year>baseEnd)&&gradeAt(G.year)===X_.grades.length-1&&G.ch.beaten.includes(X_.finalFirst))f=G.ch.beaten.includes(X_.finalNext)?null:X_.finalNext;
    if(f&&k_>0&&!(G.infinite&&G.year>baseEnd)&&gradeAt(G.year)===X_.grades.length-1)return {type:'fight',enemy:f,enc:{label:X_.grades[gradeAt(G.year)]+' · 마지막 등급 전투'}};
    /* 대호수로 나간 자: 1막엔 고정 전투가 없고, 2막엔 등급마다 대재앙 하나(전투 중 도주 가능), 무한 모드엔 호수의 적과 대재앙이 번갈아 나선다 */
    if(f&&lakeOn(G.ch)&&typeof f==='string'&&(f.startsWith('table:')||f===X_.star)){
      const L_=G.ch.lake=G.ch.lake||{},K_=L_.killed||[];
      if(G.year<=CFG.years)f=null;
      else if(G.year<=baseEnd){const order=['lake_whale_silence','lake_whale_lamp','lake_whale_anchor','lake_whale_tide','lake_whale_genesis','lake_whale_pale'],gi_=gradeAt(G.year),id=[0,1,2,3,4,5].map(i=>order[(gi_+i)%order.length]).find(x=>!K_.includes(x))||order[gi_%order.length];return {type:'fight',enemy:id,enc:{hidden:true,label:'대재앙 토벌 · '+X_.grades[gi_]}}}
      else if(d(100)>CFG.lake.infFight)f=null;   // 무한 모드의 대호수: 전투보다 호수를 건너는 항해가 중심
      /* 그 밖에는 일반 무한 모드처럼 아직 이기지 못한 히든 보스가 호수의 틈으로 올라온다 (잡았던 고래는 다시 나오지 않는다). 아무도 없으면 호수의 적 */
    }
    if(f){
      /* 히든 보스: 목록 위에서부터 조건(과 확률)이 맞는 첫 보스가 불길한 예감(omen)으로 먼저 나타난다.
         맞서면 그 보스와 싸우고(다시 나오지 않음), 돌아서면 평소 조우로 넘어간다(조건이 맞으면 다음에 또 나올 수 있다) */
      /* 제 2막 무한 모드의 세계의 균열: 조건과 상관없이 아직 이기지 못한 히든 보스 중 무엇이든 나타난다 */
      if(G.infinite&&G.year>baseEnd&&d(100)<=INF.crack){
        const pool=riftBosses().filter(h=>!G.ch.beaten.includes(h.id)&&!(G.met||[]).includes(h.id));
        if(pool.length){const h=one(pool),nm=D.enemies[h.id].n;
          return {type:'omen',boss:h.id,omen:riftOmenFor(G.ch,nm),rift:true,escape:true,spec:f}}
        /* 만날 수 있는 히든을 모두 만났다면, 이미 이긴 상대가 '불순물'이 되어 다시 나타난다 (전리품 대신 불순물의 조각과 경험치) */
        {const all=riftBosses().map(h=>h.id);if(lakeOn(G.ch))for(const k of (G.ch.lake&&G.ch.lake.killed)||[])if(/^lake_whale_/.test(k)&&!all.includes(k))all.push(k);if(all.length){const bid=one(all),nm=D.enemies[bid].n;
          return {type:'omen',boss:bid,omen:riftEchoOmenFor(G.ch,nm),rift:true,echo:true,escape:true,spec:f}}}
      }
      for(const h of D.hiddenBosses||[]){
        if(h.infOnly&&!G.infinite)continue;
        if(h.afterKey&&G.year<(G.ch[h.afterKey]||0))continue;
        if(G.year<(h.from||1)||G.ch.beaten.includes(h.id)||(G.met||[]).includes(h.id)||!meets(G.ch,h.req))continue;
        /* chanceBonus: 조건이 맞으면 확률 가산 (예: 검지 소속은 대행자 +30%) */
        const ch_=h.chance?Math.min(95,h.chance+[].concat(h.chanceBonus||[]).reduce((t_,b_)=>t_+(meets(G.ch,b_.req)?b_.add:0),0)+(G.infinite?INF.hiddenAdd:0)):0;
        if(ch_&&d(100)>ch_)continue;
        if(G.infinite&&G.year>baseEnd)return {type:'omen',boss:h.id,omen:riftOmenFor(G.ch,D.enemies[h.id].n),rift:true,escape:!h.noEscape,spec:f};
        return {type:'omen',boss:h.id,omen:omenOf(G.ch,h.omen),escape:!h.noEscape,spec:f};
      }
      if(lakeOn(G.ch)&&G.infinite&&G.year>baseEnd){const id=one(['lake_mermaid','lake_hook','lake_blade','lake_shield']),e_=D.enemies[id];return {type:'fight',enemy:id,enc:{label:'외곽 호수의 '+e_.n}}}
      const e=encounter(G.ch,f);return {type:'fight',enemy:e.id,enc:e};
    }
    /* 갈림길: 공방 해결사 제안이 가끔(WF.chance%) 끼어든다 */
    if(G.year===CFG.affiliationYear&&!G.ch.aff&&!G.ch.hw&&!lakeOn(G.ch)){
      if(D.workshopChoice&&!noFixer(G.ch)&&d(100)<=WF.chance)return {type:'event',ev:Object.assign({},D.affiliation,{x:D.affiliation.x+(D.workshopIntro||''),c:[...D.affiliation.c,D.workshopChoice]})};
      return {type:'event',ev:D.affiliation};
    }
    /* 승급 심사·특색 심사는 조건이 되면 다른 사건보다 먼저 (심사를 미룬 해의 다음 해까지는 다시 묻지 않음) */
    const ch=G.ch;
    if(topReady(ch))return {type:'event',ev:topEvent(ch)};
    if(examReady(ch)&&ch.examSkipYear!==G.year-1){const k=career(ch);return {type:'event',ev:(isFinger(ch)&&D.fingers[ch.aff.name].exam)||(CR[k]&&CR[k].exam)||D.promotionExam}}
    {const rv=rbYear(G);if(rv)return {type:'event',ev:rv}}
    {const hv=hwYear(G);if(hv)return {type:'event',ev:hv}}
    /* H사 홍원 가문 안에서 사는 동안은 도시의 일반 사건 대신 홍원의 한 해 사건이 온다 */
    if(ch.hw&&!ch.hw.out&&!ch.hw.done&&D.hwYearly&&D.hwYearly.length){const used=ch.hw.yUsed=ch.hw.yUsed||[];let left=D.hwYearly.map((_,i)=>i).filter(i=>!used.includes(i));if(!left.length){ch.hw.yUsed=[];left=D.hwYearly.map((_,i)=>i)}const i=one(left);ch.hw.yUsed.push(i);return {type:'event',ev:D.hwYearly[i]}}
    if(D.corp){const ce=corpEvent(G);if(ce)return {type:'event',ev:ce}}
    {const sb=distStableEvent(G);if(sb)return {type:'event',ev:sb}}
    {const iv=infiniteEvent(G);if(iv)return {type:'event',ev:iv}}
    {const kh=kidHuntEvent(G);if(kh)return kh}
    {const bv=bondEvent(G);if(bv)return {type:'event',ev:bv}}
    {const es=bondEscortEvent(G);if(es)return {type:'event',ev:es}}
    {const dv=dailyEvent(G);if(dv)return {type:'event',ev:dv}}
    {const pe=pinkyEvent(G);if(pe)return {type:'event',ev:pe}}
    {const oe=oracleEvent(G);if(oe)return {type:'event',ev:oe}}
    {const se=eastScoutEvent(G);if(se)return {type:'event',ev:se}}
    /* 1막 조직 루트(검계·밤의 송곳의 배신, 중지의 의리 순례)는 제 2막 이후에는 새로 시작하지도 이어지지도 않는다 */
    if(G.year<=CFG.years){
      {const sr=synRouteEvent(G);if(sr)return {type:'event',ev:sr}}
      {const gr=giriRouteEvent(G);if(gr)return {type:'event',ev:gr}}
    }
    {const c3=G.ch;if(c3.colorDone&&!c3.custDone&&!c3.custPick&&!c3.distForm&&!c3.job){if(c3.colorYear==null)c3.colorYear=G.year;if(G.year>=c3.colorYear+CFG.custEvent.gap&&G.year>=(c3.custNext||0)){c3.custNext=G.year+CFG.custEvent.retry;return {type:'event',ev:custEvent(c3)}}}}
    {const ch2=G.ch;if(D.redBook&&ch2.flags&&ch2.flags.redBook&&!ch2.beaten.includes('redmist')&&G.year>=(ch2.bookNext||0)){ch2.bookNext=G.year+CFG.redBook.every;{const n=ch2.redPost||0,RB=CFG.redBook,m=Math.pow(RB.hpMul,n).toFixed(2),ev=structuredClone(D.redBook);ev.c[0].h=`붉은 안개와 싸운다 · 이기면 더는 요동치지 않는다${n?` · 미뤄 온 만큼 체력 ×${m} (${n}번 미뤘다)`:''}`;ev.c[1].h=`${RB.every}년 뒤 다시 요동친다 · 붉은 안개의 체력이 ×${RB.hpMul}배로 커진다${n?` (지금 ×${m})`:''}`;ev.c[1].ok=Object.assign({},ev.c[1].ok,{fx:{redPost:true}});return {type:'event',ev}}}}
    /* 6시즌: 격리 실패 (환상체 보스는 조우 표가 아니라 이 사건으로만 나온다) */
    if(D.abnoBreach&&!lakeOn(ch)&&G.year>=CFG.abnoBreach.from&&abnoLeft(ch).length&&d(100)<=CFG.abnoBreach.chance)return {type:'event',ev:D.abnoBreach};
    /* 6시즌: 내 사무소 개설(5급 이상, 5년마다 다시 묻는다) · 소속 없는 해결사는 4년마다 급수에 맞는 사무소 문을 두드린다 */
    if(D.officeFound&&canFound(ch)&&G.year>=(ch.officeNext||0)){ch.officeNext=G.year+CFG.office.foundEvery;return {type:'event',ev:isWs(ch)?Object.assign({},D.officeFound,{x:D.officeFound.x+' 공방의 작업대는 그대로 두고, 그 옆에 간판을 하나 더 건다.'}):D.officeFound}}
    if(D.officeKnock&&ch.licensed&&!ch.aff&&!ch.job&&!noFixer(ch)&&G.year>CFG.affiliationYear&&G.year>=(ch.knockNext||0)){ch.knockNext=G.year+CFG.office.knockEvery;return {type:'event',ev:D.officeKnock}}
    {const lk=lakeYear(G);if(lk)return lk.type==='fight'?lk:{type:'event',ev:lk}}
    /* 사건을 다 쓰면 다시 섞는다 */
    if(!G.pool.length){G.pool=sample(D.events.map((_,i)=>i),D.events.length);
      /* 무한 모드처럼 풀을 여러 번 돌 때는 많이 본 사건이 뒤로 가서 덜 본 사건부터 나온다 (풀은 끝에서부터 뽑는다) */
      if(G.seenCnt){const sc=G.seenCnt;G.pool.sort((a,b)=>(sc[b]||0)-(sc[a]||0))}}
    /* 이미 본 사건이 다시 나오면, 무한 모드에서는 '이 일은 처음이 아니다'는 한 줄이 앞에 붙는다 */
    /* 사건 문구의 {배우자}·{아이}·{손주}를 이름으로 채운다 (살아 있는 가족 기준) */
    const famFill=ev=>{if(!ev)return ev;const js=JSON.stringify(ev);if(!/\{(배우자|아이|손주)\}/.test(js))return ev;
      const ch=G.ch,b=ch.bond,al=((b&&b.kids)||[]).filter(k=>!k.dead&&!k.pend),kd=al.find(k=>k.grand)||al[0];
      const jo=(nm,j)=>{if(!j)return nm;const c=nm.charCodeAt(nm.length-1),f=c>=0xAC00&&c<=0xD7A3&&(c-0xAC00)%28!==0;return nm+({'이라는':f?'이라는':'라는','은':f?'은':'는','는':f?'은':'는','이':f?'이':'가','가':f?'이':'가','을':f?'을':'를','를':f?'을':'를','과':f?'과':'와','와':f?'과':'와'}[j])};
      const nmOf={배우자:(b&&b.name)||'그 사람',아이:(kd&&kd.n)||'그 아이',손주:(kd&&kd.grand&&kd.grand.n)||'그 아이'};
      return JSON.parse(js.replace(/\{(배우자|아이|손주)\}(이라는|은|는|이|가|을|를|과|와)?/g,(m,k,j)=>jo(nmOf[k],j)))};
    const evOut=i=>{const sc=G.seenCnt||(G.seenCnt={}),n=sc[i]=(sc[i]||0)+1,ev=famFill(evForJob(D.events[i],G.ch)),RN=D.repeatNotes;
      return {type:'event',ev:G.infinite&&n>1&&RN&&RN.length&&ev&&ev.x?Object.assign({},ev,{x:RN[(n-2+i)%RN.length]+' '+ev.x}):ev}};
    /* first 표시가 있는 사건(소속 전용 등)은 조건이 맞으면 먼저 나온다 */
    const fi=G.pool.findIndex(i=>D.events[i].first&&meets(G.ch,D.events[i].req));
    if(fi>=0)return evOut(G.pool.splice(fi,1)[0]);
    /* 출신 진로 보정이 있으면 그 진로의 권유 사건(tag)이 보정값 × pathEventMul % 확률로 먼저 나온다 */
    const tagged=G.pool.filter(i=>{const e=D.events[i];return !(G.ch.hw&&e.noHw)&&e.tag&&(G.ch.paths[e.tag]||0)>0&&meets(G.ch,e.req)});
    if(tagged.length){
      const ti=one(tagged);
      if(d(100)<=(G.ch.paths[D.events[ti].tag]||0)*CFG.pathEventMul){G.pool.splice(G.pool.indexOf(ti),1);return evOut(ti)}
    }
    while(G.pool.length){const pi=G.pool.pop(),ev=D.events[pi];if(!(G.ch.hw&&ev.noHw)&&meets(G.ch,ev.req)&&(!ev.chance||d(100)<=ev.chance))return evOut(pi)}
    return {type:'event',ev:D.events.find(e=>e.fallback)||D.events[0]};
  }
  /* 불길한 예감에 대한 답: go면 히든 보스, 아니면 원래 고정 전투 지정대로 조우 */
  /* 인연이 걸린 전조 문구의 {n}을 이름으로 채운다 */
  /* 제 2막 무한 모드: 이 세계에서는 만날 수 없던 히든도 균열을 통해 나타난다 */
  const riftOmenLake=nm=>({x:`호수의 수면이 갈라진다. 물 밑에서 ${nm}의 기척이 올라온다. 이 호수에서는 만날 수 없던 운명이 갈라진 틈을 타고 떠오른다.`,go:'갈라진 물속으로 들어간다',away:'눈을 돌린다',awayT:'수면은 소리 없이 닫혔다. 만날 수 없던 운명은 다음 기회를 기다린다.'});
  const riftEchoOmenLake=nm=>({x:`갈라진 물 위에 ${nm}이(가) 서 있다. 예전에 상대한 적이 있는 모습이다. 하지만 불순물과 같은 느낌이 든다.`,go:'마주한다',away:'눈을 돌린다',awayT:'눈을 돌리자 수면이 닫혔다. 같은 얼굴이 다시 떠오를 것이라는 예감만 남았다.'});
  const riftOmenFor=(ch,nm)=>lakeOn(ch)?riftOmenLake(nm):riftOmen(nm),riftEchoOmenFor=(ch,nm)=>lakeOn(ch)?riftEchoOmenLake(nm):riftEchoOmen(nm);
  const riftEchoOmen=nm=>({x:`갈라진 틈 너머에 ${nm}이(가) 서 있다. 예전에 상대한 적이 있는 모습이다. 하지만 불순물과 같은 느낌이 든다.`,go:'마주한다',away:'눈을 돌린다',awayT:'눈을 돌리자 틈이 닫혔다. 같은 얼굴이 다시 나타날 것이라는 예감만 남았다.'});
  const riftOmen=nm=>({x:`세계에 균열이 갔다. 갈라진 틈 너머에서 ${nm}의 기척이 느껴진다. 이 세계에서는 만날 수 없던 운명이 균열을 타고 흘러든다.`,go:'균열 속으로 들어간다',away:'눈을 돌린다',awayT:'균열은 소리 없이 닫혔다. 만날 수 없던 운명은 다음 기회를 기다린다.'});
  const omenOf=(ch,o)=>{if(o&&o.alt){const a=o.alt.find(a=>meets(ch,a.req));if(a)o=Object.assign({},o,{x:a.x})}if(!o||!ch.bond||!ch.bond.name)return o||{};const f=t=>t&&bondFill(t,ch.bond);return Object.assign({},o,{x:f(o.x),go:f(o.go),away:f(o.away),awayT:f(o.awayT)})};
  /* 대호수 판에서 균열(호수의 틈)로 나타나는 히든 보스는 도시 배경의 등장 문구 대신 호수의 파도로 나타난다 */
  const gaI=n=>{const c=String(n).charCodeAt(String(n).length-1);return c>=0xAC00&&c<=0xD7A3&&(c-0xAC00)%28>0?'이':'가'};
  const LAKE_INTRO=[n=>`대호수의 파도가 몰아닥친다. 물 밑에서 ${n}${gaI(n)} 모습을 드러낸다.`,n=>`호수가 크게 일렁인다. 갈라진 수면 위로 ${n}${gaI(n)} 올라선다. 배가 한쪽으로 기운다.`,n=>`거센 파도가 뱃전을 때린다. 그 너머에 ${n}${gaI(n)} 서 있다.`];
  function lakeIntroFor(G,id){const E_=D.enemies[id];if(!E_)return;if(E_.intro0===undefined)E_.intro0=E_.intro;E_.intro=(lakeOn(G.ch)&&G.infinite)?one(LAKE_INTRO)(E_.n):E_.intro0}
  function answerOmen(G,st,go){
    if(go||!st.escape)lakeIntroFor(G,st.boss);
    if(go||!st.escape){if(st.echo){G.ch.echoFoe=st.boss;return {type:'fight',enemy:st.boss,enc:{hidden:true,rift:true,echo:true,label:lakeOn(G.ch)?'호수 밑의 불순물':'균열 너머의 불순물'}}}(G.met=G.met||[]).push(st.boss);return {type:'fight',enemy:st.boss,enc:{hidden:true,rift:!!st.rift,label:st.rift?(lakeOn(G.ch)?'호수 밑의 운명':'균열 너머의 운명'):T.hiddenBoss}}}
    if(lakeOn(G.ch)&&G.infinite){const id=one(['lake_mermaid','lake_hook','lake_blade','lake_shield']);return {type:'fight',enemy:id,enc:{id,label:'외곽 호수의 '+D.enemies[id].n},avoided:st.boss}}
    const e=encounter(G.ch,st.spec);return {type:'fight',enemy:e.id,enc:e,avoided:st.boss};
  }
  /* 고를 수 있는 선택지 (조건이 맞지 않는 선택지는 빠진다). i는 원래 번호 */
  const options=(G,ev)=>ev.c.map((c,i)=>({c,i})).filter(o=>meets(G.ch,o.c.req));
  /* 조건이 안 맞아 숨겨지는 선택지 중 lock(이유)이 적힌 것은 잠금으로 보여 준다. lockReq가 맞을 때만(해당 없는 선택지는 계속 숨김) */
  const lockedOptions=(G,ev)=>ev.c.map((c,i)=>({c,i})).filter(o=>o.c.lock&&!meets(G.ch,o.c.req)&&meets(G.ch,o.c.lockReq));
  /* 판정 보정 = 능력치 + 사건 판정 보정 + (그 진로 판정이면) 출신 진로 보정 */
  const pathMod=(ch,check)=>check.path?(ch.paths[check.path]||0):0;
  const checkDc=(ch,check)=>check.dc==='exam'?examDc(ch):check.dc==='color'?CFG.colorDc:check.dc==='top'?CFG.topDc:check.dc;
  /* pure: 능력치·판정 보정 없이 주사위만 (사무소 개설) */
  /* 약지 예술적 감각: 선택지 판정 주사위 최대치 +5×스택 (1d100 → 1d105 …, 보정치가 아님) */
  const checkDie=ch=>Math.min(CFG.checkMax,100+(ch.artSense||0)*CFG.artSense.die+(hasInn(ch,'miracle')?Math.floor((ch.year||0)/CFG.innate.miracleEvery)*CFG.innate.miracleDie:0));
  function checkMod(ch,check){if(check.pure)return 0;return (check.s?ch.stats[check.s]:0)+ch.stats.check+mindStat(ch)+pathMod(ch,check)+(check.dc==='color'?ch.colorBonus||0:0)}
  /* 선택: 판정이 있으면 1d100 + 능력치 + 판정 보정 ≥ 난이도 */
  /* 대형 파도: 금기를 어기면 일정 확률로 오는 생존 판정. 한 번 성공하면 탈출, 실패할 때마다 손실이 커진다 */
  function waveEv(ch,L){
    const W=CFG.lake.wave,w=L.wave,i=w.i,last=i+1>=w.max,nv=(L.crew||[]).filter(m=>m.role==='navigator').length;
    const lines=['호수가 한쪽으로 기울었다. 하늘 끝에서 벽 같은 물이 선다.','첫 파도가 갑판을 덮쳤다. 밧줄이 끊어지고 사람들이 서로를 붙잡았다.','두 번째 파도는 더 높다. 돛대가 비명을 지른다.','돛이 찢어졌다. 호수는 아직 물러날 기색이 없다.','마지막 힘으로 버티고 있다. 이 파도 뒤에 호수가 잠잠해진다는 보장은 없다.'];
    const c=[{l:'방벽을 세운다',h:`돈 ${W.wallCost} · 판정 쉬움`,check:{s:null,dc:W.wallDc},ok:{t:'널빤지와 돛천으로 뱃전을 막았다. 파도가 방벽을 때리고 부서졌다.',fx:{lakeWave:'ok',money:-W.wallCost}},fail:{t:'방벽이 첫 파도에 뜯겨 나갔다.',fx:{lakeWave:'fail',money:-W.wallCost}}},
      {l:'키를 잡고 파도 사이로 빠져나간다',h:`판정${nv?` · 항해사 ${nv}명 보정`:''}`,check:{s:null,dc:W.helmDc-W.helmNav*nv},ok:{t:'파도의 결을 읽고 키를 꺾었다. 배가 벽 사이로 미끄러져 나갔다.',fx:{lakeWave:'ok'}},fail:{t:'키가 손에서 튕겨 나갔다. 배가 옆으로 눕는다.',fx:{lakeWave:'fail'}}}];
    if((L.crew||[]).length)c.push({l:'선원 한 사람이 뛰어내려 밧줄을 끊는다',h:'선원 1명을 잃는다 · 자동 탈출',ok:{t:'누군가 고개를 끄덕이고 파도 속으로 뛰어들었다. 밧줄이 끊기고 배가 풀려났다.',fx:{lakeWave:'sac'}}});
    return {t:`대형 파도 ${i+1}/${w.max}`,x:lines[Math.min(i,lines.length-1)]+(last?' 이번이 마지막이다.':'')+`\n배 내구도 ${hullOf(ch)}/${CFG.lake.hullMax} · 판정에 실패할 때마다 내구도를 잃는다 (최대 ${W.hullLoss}). 0이 되면 배가 가라앉는다.`,shake:true,c}}
  function choose(G,ev,i){
    const ch=G.ch,c=ev.c[i];let res=c.ok,roll=null,xp=CFG.xp.plain,xpNote=null;
    if(c.check){
      const ib=hasInn(ch,'intuition')&&!c.check.pure?d(CFG.innate.intuitionDie):0;
      const dc=checkDc(ch,c.check),mod=checkMod(ch,c.check)+ib,cd=c.check.die||(c.check.pure?100:checkDie(ch)),r=d(cd),tot=r+mod,ok=tot>=dc;
      if(ib)xpNote=`타고난 직감 +${ib}`;
      roll={r,mod,tot,dc,ok,die:cd};res=ok?c.ok:c.fail;xp=ok?CFG.xp.ok:CFG.xp.fail;
    }
    /* 무한 모드: 결과에 inf가 있으면 그 문구·효과로 바꾼다 (초반 보상이 어울리지 않는 사건) */
    if(ch.infinite&&res&&res.inf)res=Object.assign({},res,res.inf);
    const fx=res.fx||{};
    /* 선택의 기억: 어떤 선택을 했는지(memo)와 보이지 않는 장부(ledger: help 도움·betray 배신·silence 침묵)를 남긴다. 몇 해 뒤 같은 일이 되돌아온다 (memo/memoyears 조건 사건) */
    if(c.memo){ch.memo=ch.memo||{};ch.memo[c.memo.k]={v:c.memo.v,y:G.year}}
    if(c.ledger){ch.ledger=ch.ledger||{};for(const [k,n] of Object.entries(c.ledger))ch.ledger[k]=(ch.ledger[k]||0)+n}
    if(fx.memoDone&&ch.memo&&ch.memo[fx.memoDone])ch.memo[fx.memoDone].done=1;
    const {chips,licensed}=applyFx(ch,fx);
    if(xpNote)chips.unshift(xpNote);
    if(fx.markAwake){const M_=CFG.innate.markMul,s0=ch.stats,b={};
      /* 장비 수치는 빼고 몸의 수치에만 배수를 곱한다 (장비를 바꿀 때 불어난 분이 남지 않게) */
      const gs=k=>Object.values(ch.gear).reduce((a,g)=>a+(g&&g.fx&&g.fx[k]||0),0);
      for(const k of ['atk','eva','spd','check']){const base=s0[k]-gs(k);if(base>0){const n=Math.floor(base*M_)-base;if(n>0){s0[k]+=n;b[k]=n}}}
      const hb=s0.maxHp-gs('maxHp'),hp=Math.floor(hb*M_)-hb;s0.maxHp+=hp;ch.hp+=hp;ch.markOn=true;
      chips.push('표지 발현 · 능력치 ×'+M_);chips.push(Object.entries(b).map(([k,v])=>`${k}+${v}`).concat(`HP+${hp}`,'적중마다 +2d3').join(' · '))}
    /* 선택지의 정신력: mind -1이면 2d3 감소, +1이면 2d3 회복 */
    if(c.mind){const x=d(3)+d(3);if(c.mind<0)loseMind(ch,x,t=>chips.push(t+' · 2d3'));else{const g=gainMind(ch,x);if(g)chips.push(`정신력 +${g} (${ch.mind}/${M.max})`)}}
    if(fx.relicRoll){const ca=relicChance(ch),r=d(100),ok=r<=ca&&relicChoices(ch).length;chips.push(`1d100 · ${r} (${ca} 이하${(ch.stats.relicApt||0)>0?' · 유물 적성':''}${ch.relicBase?' · 출신 보정':''})`);
      if(ok){ch.relicPickLate=true;chips.push('유물이 손에 감긴다 · 하나를 고른다')}else{chips.push('손끝에 먼지만 묻었다');if(ch.o&&ch.o.n==='보냐텔리 가문'&&!ch.familyAsked)ch.familyPend=true}}
    /* 보냐텔리 가문: 잊힌 유물을 놓치면 가문의 부름 · 오딘의 눈 */
    if(fx.odinRoll){const r=d(100),ok=r<=fx.odinRoll&&!(ch.relicIds||[]).includes('odin');chips.push(`1d100 · ${r} (${fx.odinRoll} 이하)`);
      if(ok){giveRelic(ch,'odin',true);chips.push('유물 · '+D.relics.odin.n+' ('+D.relics.odin.e+')');if(ch.yeji)chips.push('패시브 · 가속하는 미래 · 버프 · 예지안 (전용 검술 카드 피해 +'+CFG.odin.yeji+')');else chips.push('버프 · 순간의 예지 · 첫 라운드 회피 +'+CFG.odin.first+' · 이후 +'+CFG.odin.after)}else{chips.push(ch.resoAsked?'유물고의 울림이 잦아들었다':'보물고는 비어 있었다');if(ch.o&&ch.o.n==='보냐텔리 가문'&&!ch.resoAsked){ch.resoPend=true;ch.resoAt=(ch.year||0)+3}}}
    if(fx.wsRoll){
      const r=d(WF.die);chips.push(`1d${WF.die} · ${r} (${WF.minRoll} 이상)`);
      if(r>=WF.minRoll){const was=ch.licensed;if(!was)license(ch);ch.aff={type:'workshop',name:'공방 해결사'};
        chips.push(`소속 · 공방 해결사${was?'':' · '+T.licenseGained+' '+ch.rank+T.rankUnit}`);chips.push('공방 물건 20% 할인 · 보관함 장비 판매');wsOpen(ch,chips)}
      else{chips.push('공방 주인이 고개를 젓는다 · 다른 길을 고른다');ch.affRetry=true}
    }
    if(fx.voice){
      const dc_=ch.voiceBias==='good'?M.voiceGoodDc:ch.voiceBias==='bad'?M.voiceBadDc:M.voiceDc;
      const rs=[];for(let i=0;i<M.voiceRolls;i++)rs.push(d(M.voiceDie));
      const ok=rs.every(r=>r>=dc_);chips.push(`1d${M.voiceDie} × ${M.voiceRolls} · ${rs.join(' / ')} (${dc_} 이상 ${rs.filter(r=>r>=dc_).length}/${M.voiceRolls})`);
      const sure=!ok&&ch.voiceBias==='bad'&&(ch.stats.egoSight||0)>=CFG.mind.sureSight,sight=sure||(!ok&&(ch.stats.egoSight||0)>0&&d(100)<=ch.stats.egoSight);if(sure)chips.push('장비의 형상이 또렷하다 · 목소리를 밀어낸 마음이 흔들리지 않는다 · 개화 확정');else if(sight)chips.push(`장비의 형상이 보였다 · ${ch.stats.egoSight}%`);
      ch.rollFx={k:'voice',rs,dc:dc_,die:M.voiceDie,ok:ok||sight,sight,seq:(ch.rollSeq=(ch.rollSeq||0)+1),at:ch.mind};
      const allFail=rs.every(r=>r<dc_);
      if(ch.rollFx&&ch.rollFx.k==='voice')ch.rollFx.twist=!ok&&!sight&&allFail;
      if(ok||sight){ch.egoPick=true;chips.push('E.G.O 개화')}
      else if(allFail){ch.distPick=true;chips.push('목소리를 전혀 밀어내지 못했다 · 개화하지 못했다 · 육신이 뒤틀린다 · 뒤틀림의 이름을 정한다')}
      else{const x=d(M.failLoss);chips.push('개화 실패 · 아직 마음이 버티고 있다');loseMind(ch,x,t=>chips.push(t+` · 1d${M.failLoss}`))}
    }
    if(fx.distort){
      const th_=50+biasOf(ch),r=d(100),sg_=r>th_&&(ch.stats.egoSight||0)>0&&d(100)<=ch.stats.egoSight;chips.push(`뒤틀림 판정 1d100 · ${r} (${th_} 이하면 E.G.O 개화)`);if(sg_)chips.push(`장비의 형상이 보였다 · ${ch.stats.egoSight}%`);ch.rollFx={k:'distort',r,th:th_,ok:r<=th_||sg_,sight:sg_,seq:(ch.rollSeq=(ch.rollSeq||0)+1),at:1};
      if(r<=th_||sg_){ch.egoPick=true;ch.mind=mindMax(ch);chips.push('뒤틀리기 직전, E.G.O 개화 · 정신력 회복')}else{ch.distPick=true;chips.push('육신이 뒤틀린다 · 뒤틀림의 이름을 정한다')}
    }
    if(fx.distStable&&setStable(ch))chips.push('뒤틀림이 안정되었다 · 장비와 카드팩을 다시 쓸 수 있다 · 더 강해진 뒤틀린 카드팩을 얻었다');
    if(fx.distortAccept){ch.distPick=true;chips.push('목소리를 받아들였다 · 뒤틀림의 이름을 정한다')
    }
    if(fx.singPick){ch.singPick=true;chips.push('특이점 개발 · 효과와 이름을 정한다')}
    if(fx.corpDecline&&ch.corp)ch.corp.st='declined';
    if(fx.wingPick){ch.wingPick=true;chips.push('날개 설립 · 이름을 정한다')}
    if(fx.singGrow)corpGrow(ch,chips);
    if(fx.singUp)corpUp(ch,chips);
    if(fx.corpForb)corpForb(ch,chips);
    if(fx.bondMeet){ch.bond={st:'pick',route:fx.bondMeet,variant:fx.bondVariant||0,name:'',step:0,tries:0,love:0};ch.bondPick=true;chips.push('인연 · 동반자의 이름을 정한다')}
    if(fx.bondDecline)ch.bond={st:'declined'};
    if(fx.bondDeath&&ch.bond&&ch.bond.st==='married'){bondDeath(ch,chips);ch.bond.dieBy=fx.bondDie||'risk';ch.bond.dieYear=ch.year||0}
    if(fx.bondGrand&&ch.bond){const kk=(ch.bond.kids||[]).find(k=>k.n===fx.bondGrand.k&&!k.grand);if(kk){kk.grand={n:fx.bondGrand.g,born:ch.year||0,race:kk.race||(ch.race==='hyeolgwi'?'hyeolgwi':'human')};chips.push(`손주가 태어났다 · ${fx.bondGrand.g}`)}}
    if(fx.bondCol&&ch.bond&&!ch.bond.col){const ci=one(D.colors.map((c,i)=>i).filter(i=>i!==ch.ci)),C_=D.colors[ci];ch.bond.col={adj:C_.adj,hex:C_.hex};ch.bondColPick=true;chips.push(`${ch.bond.name} · ${C_.adj} 특색`)}
    if(fx.bondKid&&ch.bond){const k_={n:fx.bondKid,born:ch.year||0,job:one(D.bond.kidJobs).k,told:false,race:((ch.o&&ch.o.race==='hyeolgwi')||spouseHy(ch,ch.bond)||(ch.race==='hyeolgwi'&&d(2)===1))?'hyeolgwi':'human'};(ch.bond.kids=ch.bond.kids||[]).push(k_);ch.stats.mindMax=(ch.stats.mindMax||0)+BD.kid.mind;gainMind(ch,BD.kid.mind);k_.pend=true;ch.kidPick=true;chips.push('아이가 태어났다 · 이름을 정한다');chips.push(`최대 정신력 +${BD.kid.mind}`)}
    if(fx.limit){const Lm=CFG.infinite.limit,m=ch.colorDone?Lm.traitMul:1;
      if(fx.limit==='atk'){const g=Math.max(1,Math.round(ch.stats.atk*Lm.atkPct*m));ch.stats.atk+=g;chips.push(`한계 돌파 · 공격 +${g}`)}
      else if(fx.limit==='dmg'){ch.limDmg=(ch.limDmg||0)+Lm.dmgPct*m;chips.push(`한계 돌파 · 주는 피해 +${Math.round(Lm.dmgPct*m*1000)/10}% (누적 ${Math.round(ch.limDmg*1000)/10}%)`)}
      else{ch.limStrike=(ch.limStrike||0)+Lm.strikePct*m;chips.push(`한계 돌파 · 적중 시 상대에게 추가 피해 (내 최대 HP의 ${Math.round(Lm.strikePct*m*1000)/10}%) (누적 ${Math.round(ch.limStrike*1000)/10}%)`)}}
    if(fx.infCentury){const K=CFG.infinite.century;(ch.infCent=ch.infCent||[]).push(fx.infCentury);addStats(ch.stats,{atk:K.atk,eva:K.eva,spd:K.spd,maxHp:K.maxHp});ch.hp+=K.maxHp;ch.infBoost=(ch.infBoost||0)+1;chips.push(`${fx.infCentury*K.every}살 · 공격 +${K.atk} · 회피 +${K.eva} · 속도 +${K.spd} · 최대 HP +${K.maxHp} · 주는 피해 +${Math.round(K.dmg*100*ch.infBoost)}% · 적의 공격 피해 +${Math.round(K.enemyDmg*100*ch.infBoost)}% (누적)`)}
    if(fx.famGrief){const GF=CFG.infinite.grief;ch.famLoss=(ch.famLoss||0)+1;addStats(ch.stats,{atk:GF.atk,maxHp:GF.maxHp});ch.hp=Math.min(ch.stats.maxHp,ch.hp+GF.maxHp);chips.push(`슬픔이 몸에 굳었다 · 공격 +${GF.atk} · 최대 HP +${GF.maxHp} · 주는 피해 +${Math.round(GF.dmg*100*ch.famLoss)}% (누적)`)}
    if(fx.kidOld&&ch.bond){const kk=(ch.bond.kids||[]).find(k=>k.n===fx.kidOld&&!k.dead);if(kk){kk.dead='old';chips.push(`${kk.n} · 눈을 감았다`);loseMind(ch,BD.kid.oldMind,m=>chips.push(m))}}
    if(fx.infHome){ch.infHome=1;chips.push('외곽에 작은 집을 지었다')}
    if(fx.lakeOuter){chips.push('집은 짓지 않는다 · 호수에서 호수로 항해가 이어진다')}
    if(fx.bondLove&&ch.bond){ch.bond.love=(ch.bond.love||0)+1;const g_=gainMind(ch,BD.loveMind);chips.push('인연 +1'+(g_?` · 정신력 +${g_}`:''))}
    if(fx.warpChain&&D.warpChains&&D.warpChains[fx.warpChain]){const W=D.warpChains[fx.warpChain];ch.wChain={ids:W.ids.slice(),i:0,label:W.label,done:W.done,doneHid:W.doneHid,hid:W.hid};if(fx.warpChain==='blood')(ch.warpOnce=ch.warpOnce||[]).push('bloodhunt');chips.push(`${W.label} · 연전 ${W.ids.length}판 · 해가 넘어가지 않는다`)}
    if(fx.warpWpn&&ch.wtrain&&D.warpWeapons&&D.warpWeapons[fx.warpWpn]){ch.wFam=fx.warpWpn;ch.wPick=false;const w0=D.warpWeapons[fx.warpWpn][Math.max(0,Math.min(4,ch.fi||0))];equipUp(ch,structuredClone(w0));chips.push(`차원 무기 · ${w0.n} (${w0.e})`)}
    if(fx.wtrain!==undefined&&ch.aff&&ch.aff.name==='W사 날개'){ch.wtrain=!!fx.wtrain;
      if(ch.wtrain){const C_=CR.wing,r=C_.trainRanks[Math.max(0,ch.fi||0)];if(r){ch.fr=r;if(D.warpWeapons&&D.warpWeaponPick){ch.wPick=true;chips.push('차원 무기 · 입사 때 계열을 고른다')}else if(r.gear)equip(ch,structuredClone(r.gear));for(let q=0;q<=Math.max(0,ch.fi||0);q++){const g2=C_.trainRanks[q]&&C_.trainRanks[q].gear2;if(g2)equip(ch,structuredClone(g2))}chips.push(`W사 열차 직원 · ${r.n}`)}if(!ch.deckLocked&&!ch.cardMoney&&!ch.packOffer&&D.warpDeck){ch.packOffer={n:'W사 정리 요원 책장',cards:warpDeckFor(ch.fi||0),relic:'정리 요원의 책장'};chips.push('정리 요원 전용 책장 · 받을지 고른다 (받으면 덱이 바뀐다)')}}
      else chips.push('W사 날개 · 본사 근무')}
    /* W사 열차 직원이 무한 모드(2막)에서 열차를 내릴지 정한다: free=내리고 독립(공방·해결사·소속 제안이 다시 열린다) · stay=남아 정리 요원장 · later=5년 뒤 다시 */
    if(fx.wquit&&ch.wtrain){const W_=CFG.warp;
      const wTitle=tt=>{ch.titles=ch.titles||[];if(!ch.titles.includes(tt)){ch.titles.push(tt);(ch.titleLog=ch.titleLog||[]).push(tt);chips.push('칭호 · '+tt)}};
      if(fx.wquit==='free'){wTitle('열차를 내린 자');ch.wEnd='wfree';ch.wtrain=false;ch.aff=null;ch.fr=null;ch.fi=null;ch.flags=ch.flags||{};ch.flags.wquit=1;ch.flags.wgag=1;chips.push('W사 열차를 내렸다 · 어느 소속도 아니다');chips.push('특이점과 워프열차에 대한 이야기를 할 수 없게 되었다');chips.push('공방과 해결사, 소속 제안의 길이 다시 열린다')}
      else if(fx.wquit==='rival'){wTitle('열차를 내린 자');ch.wEnd='wrival';ch.wtrain=false;ch.aff=null;ch.fr=null;ch.fi=null;ch.flags=ch.flags||{};ch.flags.wquit=1;ch.flags.wayfarer=1;addStats(ch.stats,W_.rival.stats);ch.money+=W_.rival.money;chips.push('웨이페어러 컴퍼니와 계약했다 · 열차를 내렸다');chips.push(`속도 +${W_.rival.stats.spd} · 판정 +${W_.rival.stats.check} · 계약금 ${W_.rival.money}`)}
      else if(fx.wquit==='stay'){wTitle('정리 요원장');ch.wEnd='wstay';ch.wLead=true;addStats(ch.stats,W_.lead);ch.hp+=W_.lead.maxHp;chips.push('정리 요원장 · 열차에 남는다');chips.push(`최대 HP +${W_.lead.maxHp} · 공격 +${W_.lead.atk} · 열차 사건이 더 자주 온다`)}
      else{ch.wQuitAt=(ch.year||0)+W_.laterYears;ch.wQuitShown=false;chips.push(`${W_.laterYears}년 뒤 같은 서류가 놓인다`)}}
    if(fx.bondLeave&&ch.bond&&ch.bond.st==='met')bondLeft(ch,chips);
    if(fx.hwLoveYes&&ch.bond&&ch.bond.st==='met'){bondMarry(ch,chips);if(ch.hw)ch.hw.loved=1}
    if(fx.hwLoveNo&&ch.bond&&ch.bond.st==='met'){ch.bond.st='refused';if(ch.hw)ch.hw.refused=1;chips.push('후보의 마음을 받아들이지 않았다 · 흑수로 곁에 남는다')}
    if(fx.bondPropose)bondPropose(ch,chips,true);
    if(fx.bondSlip)bondPropose(ch,chips,false);
    if(fx.bondWait&&ch.bond){ch.bond.extra=(ch.bond.extra||0)+1;chips.push('인연을 더 쌓았다 · 청혼 기회는 그대로다')}
    if(roll&&roll.ok&&!fx.examPass&&!fx.colorPass&&!fx.topPass)addPts(ch,CFG.promo.gain.check,chips);
    const up=gainXp(ch,xp);chips.push('경험치 +'+xp);if(up)chips.push('레벨 업 · Lv '+ch.lv);
    let enc=fx.combat?encounter(ch,fx.combat):null;
    if(ch.purge){enc={id:ch.purge};delete ch.purge;chips.push('숙청 · '+D.enemies[enc.id].n)}
    if(ch.lakeNow){const n_=ch.lakeNow;delete ch.lakeNow;enc={id:n_.id,roll:null,table:null,hidden:n_.hidden,label:n_.label}}
    if(enc&&enc.roll)chips.push(`조우 1d100 ${enc.roll} · ${D.enemies[enc.id].n}`);
    return {t:res.t,roll,chips,title:licensed?rankLabel(ch):null,tlabel:licensed?T.licenseGained:null,combat:enc?enc.id:null,enc};
  }
  /* 전투 승리 보상: 회복, 카드, 경험치, 자격 등록 또는 (고정 전투) 승급 */
  /* ===== 특색 기념 의뢰: 소속에 따라 전용 의수 · 의안(공방 해결사) · 신체 개조(N사)를 설계해 받는다 ===== */
  const custKind=ch=>isN(ch)?'body':isWs(ch)?'eye':'aug';
  const custNoun=ch=>({aug:'의수',eye:'의안',body:'신체 개조'})[custKind(ch)];
  function custIntro(ch){const a=ch.aff;
    if(isN(ch))return 'N사는 의체를 쓰지 않는다. 대신 연구소에서 특색 기념으로 전용 신체 개조를 설계해 준다고 한다.';
    if(isWs(ch))return '공방 동료들이 특색 기념으로 전용 의안을 만들어 준다고 한다.';
    if(!a)return '협회가 이름도 알려 주지 않고 공방 하나를 안내해 주었다. 특색 기념으로 전용 의수를 만들어 준다고 한다.';
    if(a.type==='assoc')return `${a.name} 직속 공방에서 특색 기념으로 전용 의수를 만들어 준다고 한다.`;
    if(a.type==='wing')return `${a.name} 직속 개발실에서 특색 기념으로 전용 의수를 만들어 준다고 한다.`;
    if(a.type==='finger')return `${a.name}이(가) 쓰는 공방에서 특색 기념으로 전용 의수를 만들어 준다고 한다.`;
    return `${a.name} 단골 공방에서 특색 기념으로 전용 의수를 만들어 준다고 한다.`}
  function custEvent(ch){const nn=custNoun(ch);
    return {t:'특색 기념 의뢰',x:`특색을 받고 한 해가 지났다. ${custIntro(ch)} 이름과 능력치를 직접 설계할 수 있다.`,c:[
      {l:`전용 ${nn}을(를) 설계한다`,h:`포인트 ${WS.cust.pts}를 나눠 이름·능력치·패시브를 정한다`,ok:{t:`도면 위에 손을 올렸다. 무엇을 넣을지 정할 차례다.`,fx:{custOpen:true}}},
      {l:'지금은 사양한다',h:`${CFG.custEvent.retry}년 뒤 다시 연락이 온다`,ok:{t:'다음에 하겠다고 답했다. 연락은 다시 올 것이다.',fx:{}}}]}}
  /* 설계 확정: 의수는 장비 제안으로, 의안과 신체 개조는 몸(능력치·패시브)에 새겨진다 */
  function custBuild(ch,o){
    const K=WS.cust,atk=Math.max(0,o.atk|0),eva=Math.max(0,o.eva|0),hp=Math.max(0,o.hp|0),pas=o.pas&&K.pass[o.pas]?o.pas:null,used=atk*K.atkCost+eva*K.evaCost+hp*K.hpCost+(pas?K.passCost:0);
    if(!ch.custPick||ch.custDone||used>K.pts||used<=0)return null;
    const kind=custKind(ch),noun=custNoun(ch),nm=String(o.name||'').replace(/\s+/g,' ').trim().slice(0,12)||('이름 없는 '+noun),fx={};
    if(atk)fx.atk=atk*K.atkPer;if(eva)fx.eva=eva;if(hp)fx.maxHp=hp*K.hpPer;
    const txt=[atk?`공격 +${fx.atk}`:'',eva?`회피 +${eva}`:'',hp?`최대 HP +${fx.maxHp}`:'',pas?`${K.pass[pas].n} (${K.pass[pas].e})`:''].filter(Boolean).join(' · ');
    const chips=[];ch.custPick=false;ch.custDone=true;ch.cust={name:nm,kind,atk,eva,hp,pas};
    if(kind==='aug'){offerGear(ch,{id:'cust_aug',slot:'aug',n:nm,grade:4,e:txt,fx,cust:{pas}});chips.push(`전용 의수 · ${nm} · ${txt} (받을지 고른다)`)}
    else{addStats(ch.stats,fx);if(fx.maxHp)ch.hp+=fx.maxHp;ch.custPas=pas;ch.custNote=txt;(ch.relics=ch.relics||[]).push(`${noun} · ${nm}`);chips.push(`${kind==='eye'?'전용 의안':'전용 신체 개조'} · ${nm} · ${txt}`)}
    return {chips,kind,nm,txt}
  }
  /* 인연 도시락은 일이 다 끝난 뒤 챙겨 주는 것이라 결과 줄의 맨 끝에 둔다 */
  function winRewards(G,C){const r=winRewards0(G,C);if(r&&Array.isArray(r.chips)){const i=r.chips.findIndex(c=>String(c).startsWith('인연 도시락'));if(i>=0&&i<r.chips.length-1)r.chips.push(r.chips.splice(i,1)[0])}return r}
  function winRewards0(G,C){
    const ch=G.ch,chips=[];
    /* 인연 도시락: 인연이 있으면 전투를 이긴 뒤 가끔 받는다 */
    if(ch.bond&&['met','married'].includes(ch.bond.st)&&!ch.distForm&&d(100)<=CFG.supply.lunchChance){const L_=CFG.supply.lunch,hp0=C.P.hp,hh=Math.min(Math.round(ch.stats.maxHp*L_.hpPct/100),ch.stats.maxHp-C.P.hp);if(hh>0)C.P.hp+=hh;const g_=gainMind(ch,L_.mind);chips.push(`인연 도시락 · ${ch.bond.name||'인연'}이(가) 도시락을 건넸다${hh>0?' · HP +'+hh:''}${g_?' · 정신력 +'+g_:''}`)}
    /* 대호수: 호수에서 싸울 때마다(항해) 정신이 닳는다. mindKeep 밑으로는 항해만으로 내려가지 않는다 */
    if(ch.flags&&ch.flags.lake&&/^lake_/.test(C.id)&&!ch.distForm&&ch.mind>CFG.lake.mindKeep){loseMind(ch,Math.min(CFG.lake.mindSail,ch.mind-CFG.lake.mindKeep),m=>chips.push('항해의 피로 · '+m))}
    if(ch.flags&&ch.flags.lake&&ch.lake&&ch.lake.captain&&/^lake_/.test(C.id)&&hullOf(ch)>1)hullLose(ch,Math.min(CFG.lake.hullWear,hullOf(ch)-1),chips);
    if(ch.flags&&ch.flags.lake&&ch.lake){if(C.id==='lake_mate')ch.lake.pirate='orca';if(C.id==='lake_orca')ch.lake.pirate='epi';
      if(/^lake_(ywhale|whale)_/.test(C.id)){const L=ch.lake,K=L.killed=L.killed||[];if(!K.includes(C.id))K.push(C.id);L.phase='enter';L.harbor=true;gainMind(ch,CFG.lake.harborMind);
        const ny=K.filter(x=>x.startsWith('lake_ywhale_')).length,na=K.filter(x=>x.startsWith('lake_whale_')).length;chips.push(`고래 토벌 · 보스급 ${ny}/4 · 대재앙 ${na}/6`);
        if(/^lake_whale_/.test(C.id)&&L.captain&&!ch.colorDone){const T_=CFG.lake.trait,s_=ch.stats;s_.maxHp+=T_.hp;ch.hp+=T_.hp;s_.atk+=T_.atk;s_.eva+=T_.eva;
          ch.colorDone=true;ch.colorYear=ch.year||0;ch.custDone=true;L.trait=true;ch.colorPick=true;ch.title=D.colors[ch.ci].adj+' '+one(D.titleWords[ch.dom||'atk']);ch.titleKind='color';(ch.titleLog=ch.titleLog||[]).push('특색');ch.titlePick=true;
          chips.push('대재앙을 잡았다. 도시는 당신에게 특색을 부여했다');chips.push('하지만 내가 있을 곳은 대호수다');chips.push(`특색 · 최대 HP +${T_.hp} · 공격 +${T_.atk} · 회피 +${T_.eva}`);chips.push('특색 패시브 · 셋 중 하나를 고른다');chips.push(T.titleLabel+' · '+ch.title)}}}
    {const wh=CFG.winHeal+(ch.hw?CFG.hw.winHealUp:0)+(ch.wtrain?Math.round(ch.stats.maxHp*CFG.warp.winHealPct):0);ch.hp=clamp(C.P.hp+wh,1,ch.stats.maxHp);chips.push('HP +'+wh)}
    if((ch.ample||0)!==(C.P.ample||0)){chips.push(`${CFG.ample.name} 사용 · 남은 ${C.P.ample||0}개`);ch.ample=C.P.ample||0}
    if((C.id==='claw'||C.id==='arbiter')&&!(ch.flags&&ch.flags.spouseAge)){(ch.flags=ch.flags||{}).spouseAge=1;if(ch.bond)ch.bond.risk=0;chips.push('발톱과 조율자 중 하나를 쓰러뜨렸다 · 배우자의 위험이 가라앉고, 이제 나이로 눈을 감는다')}
    if(ch.infinite&&C.id===CFG.endless.final)ch.infImp=(ch.infImp||1)+1;
    /* 불순물을 쓰러뜨릴 때마다 얻는 전용 강화: 조각이 몸에 남아 능력치와 주는 피해가 영구히 오르고, 상처가 한 번에 아문다 (모두에게 같은 회복 수단) */
    if(ch.infinite&&(C.id===CFG.endless.final||C.echo)&&C.over!=='lose'){const SH=CFG.infinite.shard;if(C.echo){gainXp(ch,CFG.infinite.echoXp||3);chips.push(`불순물이 된 ${D.enemies[C.id].n} · 경험치 +${CFG.infinite.echoXp||3} (전리품은 없다)`)}ch.infShard=(ch.infShard||0)+1;const ex_=(!C.echo&&D.enemies[C.id].bonus&&D.enemies[C.id].bonus.fx)||{},ga_=SH.atk+(ex_.atk||0),gh_=SH.maxHp+(ex_.maxHp||0);if(!C.echo)C.bonusMerged=true;addStats(ch.stats,{atk:ga_,maxHp:gh_});const mh=ch.stats.maxHp,h0=ch.hp;ch.hp=Math.min(mh,ch.hp+gh_+Math.round(mh*SH.heal));chips.push(`불순물의 조각 ${ch.infShard}개 · 공격 +${ga_} · 최대 HP +${gh_} · 주는 피해 +${(SH.dmg*100*ch.infShard).toFixed(1).replace(/\.0$/,'')}% (누적)`+(ch.hp>h0?` · HP +${ch.hp-h0}`:''))}
    if(C.P&&C.P.sm){const SM=CFG.shinmang,g=gainMind(ch,SM.winMind);if(g)chips.push(`신(心)을 거둔다 · 정신력 +${g} (${ch.mind}/${mindMax(ch)})`)}
    /* 공방 해결사: 전투를 두 번 이길 때마다 재료용 장비를 하나 얻는다 (무한 모드는 5해마다 한 번) */
    if(isWs(ch)&&ch.ws){let give=false;
      if(ch.infinite){if(G.year-(ch.ws.matY||0)>=CFG.ws.matGapInf){ch.ws.matY=G.year;give=true}}
      else{ch.ws.winN=(ch.ws.winN||0)+1;if(ch.ws.winN>=CFG.ws.matWins){ch.ws.winN=0;give=true}}
      if(give){const sl=one(['weapon','armor','aug']),nm={weapon:'무기',armor:'방어구',aug:'의수'}[sl];
        (ch.stash=ch.stash||[]).push({id:'wsmat_'+sl,n:'재료용 '+nm,slot:sl,grade:3,price:200,e:'작업대에서 '+nm+' 칸에 녹이면 한 조각'});chips.push('재료용 '+nm+' · 보관함에 들어왔다')}}
    if(C.escort){const Z=CFG.escort,m=earn(ch,Z.money+Z.moneyPer*C.escort.lv);ch.money+=m;chips.push(`동행 의뢰 보수 · ${C.escort.name} · +${money(m)}`)}
    if(C.id==='kid_hunt'&&ch.bond){
      if(ch.kidFoeSpouse){if(ch.bond.st==='married'){ch.bond.st='lost';chips.push(kf(bondTx(ch).hunt.winSpouse,ch.bond.name))}}
      else{const kk=(ch.bond.kids||[]).find(k=>k.n===ch.kidFoe&&!k.dead);if(kk){kk.dead=true;chips.push(kf(bondTx(ch).hunt.win,kk.n))}}
      /* 가족을 직접 쓰러뜨린 충격: 최대 정신력이 영구히 크게 줄고 정신력도 같이 떨어진다 (뒤틀린 동안은 정신력이 쓰이지 않지만, 기록과 안정 뒤를 위해 남긴다) */
      {const hm=BD.hunt.mind;ch.stats.mindMax=(ch.stats.mindMax||0)-hm;ch.mind=Math.max(1,Math.min(ch.mind-hm,mindMax(ch)));chips.push(`가족을 쓰러뜨렸다 · 최대 정신력 −${hm} (영구) · 정신력 ${ch.mind}`)}}
    if(ch.flags&&ch.flags.redMist){const h=Math.min(CFG.redMist.heal+Math.round(ch.stats.maxHp*(CFG.redMist.healPct||0)),ch.stats.maxHp-ch.hp);if(h>0){ch.hp+=h;chips.push('붉은 안개 · 적을 쓰러뜨려 HP +'+h)}}
    {const f0=D.enemies[C.id];
      if(f0.rb&&ch.rb&&!f0.hidden&&!f0.rbLast){
        const r=ch.rb,Z=CFG.rb,h=Math.min(Math.round(ch.stats.maxHp*Z.healPct),ch.stats.maxHp-ch.hp);
        if(h>0){ch.hp+=h;chips.push('숨을 고른다 · HP +'+h)}
        r.n++;const up=gainXp(ch,Z.xp);chips.push(`부화장 ${r.n}/${Z.total} · 경험치 +${Z.xp}`);if(up)chips.push('레벨 업 · Lv '+ch.lv);
        return {chips,title:null,tlabel:null,newly:false,colorRoll:null,unlock:null,hidden:false,endText:f0.endText||null,last:G.year>=lastYear(G)};
      }
      if(f0.rbLast&&ch.rb){ch.rb.n++;chips.push('부화장 13연전을 끝냈다');routeWeaponUp(ch,'rb',1,chips)}
      if(f0.rb&&ch.rb&&f0.hidden&&!f0.rbBoss&&ch.rb.chasers&&ch.rb.chasers.every(id=>id===C.id||ch.beaten.includes(id)))routeWeaponUp(ch,'rb',2,chips)
      if(f0.rbBoss&&ch.rb){ch.rb.bossDone=1;chips.push('R사의 추격이 끝났다');routeWeaponUp(ch,'rb',3,chips)}
      if(f0.hw&&ch.hw&&C.id.startsWith('hr_')&&ch.hw.rivals&&ch.hw.rivals.every(id=>id===C.id||ch.beaten.includes(id)))routeWeaponUp(ch,'hw',2,chips)
      if(C.id===CFG.endless.finalNext&&ch.rb&&ch.rb.headSeen){ch.rb.done=1;chips.push('금기의 끝')}
      if(f0.hwClue&&ch.hw){const h_=CFG.hw.clueHp;ch.hw.clues=(ch.hw.clues||0)+1;ch.hw.sNext=(ch.year||0)+1;s_(ch,h_);chips.push(`영생의 단서 ${ch.hw.clues}/4 · 최대 HP +${h_}`)}
      if(f0.hwElder&&ch.hw){ch.hw.elderDone=1;ch.hw.fnext=(ch.year||0)+CFG.hw.finalGap}
      if(f0.hwFinal&&ch.hw){ch.hw.done=1;chips.push('가주의 자리');{const cw=ZKEYS.filter(k=>!hwHave(ch).includes(k)),cr=cw.filter(k=>CFG.hw.crown.includes(k)),rest=cw.filter(k=>!cr.includes(k));if(cw.length){(ch.hw.have=ch.hw.have||[]).push(...cw);if(cr.length)chips.push(`가주의 재갈 · ${cr.map(k=>aniOf(k).nm).join(' · ')} · 영구히 당신의 것이 되었다`);if(rest.length)chips.push(`홍원의 군주가 맡아 둔 재갈 · ${rest.map(k=>aniOf(k).nm).join(' · ')} · 가주가 된 자에게 넘어갔다 · 열두 흑수가 모두 당신 곁에 선다`);
        /* 재갈마다 흑수 카드와 전리품(흑수 · ○○)을 준다. 덱이 넘치면 일반 카드가 카드함으로 간다 */
        for(const k of cw){const cid='zp_'+k;if(!D.cards[cid])continue;forceAdd(ch,cid);chips.push('흑수 카드 · '+D.cards[cid].n);(ch.relics=ch.relics||[]).push('흑수 · '+D.cards[cid].n.replace('흑수 · ',''))}
        while(ch.deck.length>deckMax(ch)){const j=ch.deck.findIndex(id=>!D.cards[id].fixed&&!id.startsWith('zp_'));if(j<0)break;(ch.side=ch.side||[]).push(...ch.deck.splice(j,1))}}}ch.marks=(ch.marks||[]).filter(x=>x!=='가주 후보');ch.marks.push('홍원의 가주')}}
    offerPick(ch,D.rewards,chips,null);
    const bounty=earn(ch,D.money.bounty[D.enemies[C.id].tier]||0);if(bounty){ch.money+=bounty;chips.push('현상금 +'+money(bounty))}
    {const BN=D.enemies[C.id].bonus;if(BN){if(BN.money){const m_=earn(ch,BN.money+(BN.moneyPer||0)*(ch.infImp||0));if(m_){ch.money+=m_;chips.push(`${BN.n||'전리품'} · +${money(m_)}`)}}if(BN.xp){gainXp(ch,BN.xp);chips.push(`${BN.n||'전리품'} · 경험치 +${BN.xp}`)}if(BN.fx&&!C.bonusMerged){addStats(ch.stats,BN.fx);if(BN.fx.maxHp)ch.hp+=BN.fx.maxHp;chips.push(`${BN.n||'전리품'} · ${BN.e} (영구)`)}}}
    let up=gainXp(ch,CFG.xp.win);chips.push('경험치 +'+CFG.xp.win);
    /* 무한 모드: 경험치 표가 끝난 뒤에도 전투 승리 infLvEvery번마다 레벨이 1 오른다 (성장 선택 1회) */
    if(ch.infinite&&CFG.infinite.infLvEvery){ch.infWins=(ch.infWins||0)+1;if(ch.infWins>=CFG.infinite.infLvEvery){ch.infWins=0;ch.lvBonus=(ch.lvBonus||0)+1;ch.lv++;ch.lvPend++;up++}}
    if(up)chips.push('레벨 업 · Lv '+ch.lv);
    if(ch.egoNote){chips.push(ch.egoNote);ch.egoNote=null}
    if(ch.bloomNote){chips.push(ch.bloomNote);ch.bloomNote=null}
    let title=null,tlabel=null,newly=false,colorRoll=null,unlock=null;
    const foe=D.enemies[C.id];
    /* 단서: 같은 사연의 평범한 적을 이길 때마다 쌓이고, 쌓인 만큼 연관된 히든 보스가 나타날 확률이 오른다 */
    if(foe.lead&&!foe.hidden){ch.leads=ch.leads||{};ch.leads[foe.lead]=(ch.leads[foe.lead]||0)+1;if(ch.leads[foe.lead]===3)chips.push(`단서 · ${CFG.leads[foe.lead]} (3번째)`)}
    /* 인연: 결혼 중 히든 보스를 이길 때마다 배우자 사망 위험이 0.1%씩 쌓인다 (엔딩까지 가려면 거의 반드시 잡아야 하는 상대) */
    if(ch.bond&&ch.bond.st==='married'&&foe.hidden&&!(ch.flags&&ch.flags.spouseAge))ch.bond.risk=(ch.bond.risk||0)+BD.riskStep;
    /* 피의 각인된 갈망: 전투가 끝나면 자식이 흩어지고(각자 확률), 이긴 일반·보스 적은 새 자식이 된다. 히든 보스·환상체는 안 된다 */
    if(kidsOn(ch)){
      const KD=CFG.kids,before=ch.kids||0;let keep=0;for(let i=0;i<before;i++)if(d(100)>KD.lose)keep++;
      ch.kids=keep;if(before>keep)chips.push(`자식 ${before-keep}명이 흩어졌다 (${keep}/${KD.max})`);
      if(!foe.hidden&&!foe.abno&&ch.kids<KD.max){ch.kids++;chips.push(`피의 각인된 갈망 · ${foe.n}이(가) 혈귀가 되어 자식이 된다 (${ch.kids}/${KD.max})`)}
    }
    if(foe.hidden&&!C.echo){
      if(!ch.beaten.includes(C.id))ch.beaten.push(C.id);chips.push(T.hiddenWin+' · '+foe.n);
      if(C.id==='kasetti'){ch.titles=ch.titles||[];if(!ch.titles.includes('혈귀를 잠재운 자')){ch.titles.push('혈귀를 잠재운 자');(ch.titleLog=ch.titleLog||[]).push('혈귀를 잠재운 자');chips.push('칭호 · 혈귀를 잠재운 자')}}
      if(C.id==='hongru'&&ch.hw&&ch.hw.accept&&!ch.hw.maker){ch.hw.maker=1;ch.hw.done=1;chips.push('홍루를 쓰러뜨렸다 · 선황충을 품은 가주 곁의 필두로 남는다')}
      if(foe.chain){ch.flags.zenaPend=1;chips.push('연전 · 쉴 틈 없이 다음 상대가 나선다')}else if(C.id===CFG.endless.finalNext)ch.flags.zenaPend=0;
      if(ch.corp&&ch.corp.trial===C.id)ch.corp.trial=null;
      /* 기업 루트: 머리의 시험(발톱 → 조율자)을 끝까지 넘으면 영구 강화 */
      if(ch.corp&&ch.corp.headSeen&&!ch.corp.cleared&&!(ch.corp.chain||[]).length&&CP.chain.every(id=>ch.beaten.includes(id))){ch.corp.cleared=true;chips.push('머리의 시험을 넘었다');corpBump(ch,CP.clear,chips)}
      if(!foe.chain){const h=Math.min(CFG.hidden.winHeal,ch.stats.maxHp-ch.hp);if(h>0){ch.hp+=h;chips.push('숨을 돌린다 · HP +'+h)}}
      /* 엄지 소속으로 뇌횡: 동부십검 + 엄지 검술 (덱 고정) */
      const td=foe.thumbDrop&&meets(ch,foe.thumbDrop.req)?foe.thumbDrop:null;
      /* 도서관의 사서: 낮은 확률로 책장 카드 */
      for(const b of foe.bonusCards||[])if(d(100)<=b.chance)addCard(ch,b.card,chips,'책장 카드');
      if(td){addStats(ch.stats,td.fx);ch.hp+=td.fx.maxHp||0;(ch.relics=ch.relics||[]).push(td.n);offerGear(ch,Object.assign({grade:5},td.gear));
        ch.packOffer={n:'엄지 검술',cards:td.deck.slice(),relic:'엄지 검술'};chips.push(`전리품 · ${td.n} (${td.gear.e}) · 장착할지 고른다`);chips.push('엄지 검술 · 덱을 바꿀지 고른다')}
      /* 특수환: 승리하면 능력치 하나를 골라 영구 증가 (전리품보다 먼저, 전리품이 맨 끝) */
      if(foe.pill){ch.pillPick=true;chips.push(`${foe.pill.n} · 능력치 하나를 골라 +${foe.pill.v} (영구)`)}
      if(foe.drop&&!td&&!(foe.drop.once&&(ch.relics||[]).includes(foe.drop.n))){const bondOk0=!foe.drop.needBond||(ch.bond&&ch.bond.st==='married'),dr=!bondOk0&&foe.drop.alt?foe.drop.alt:foe.drop;addStats(ch.stats,dr.fx);if(dr.fx.maxHp)ch.hp+=dr.fx.maxHp;(ch.relics=ch.relics||[]).push(dr.n);
        const bondOk=!dr.needBond||(ch.bond&&ch.bond.st==='married');
        if(dr.flag&&bondOk)ch.flags[dr.flag]=1;
        if(dr.promote&&ch.fi===(dr.promoteFrom||1)&&canFingerUp(ch))chips.push(...fingerStep(ch))
        if(dr.title&&bondOk){ch.titles=ch.titles||[];if(!ch.titles.includes(dr.title)){ch.titles.push(dr.title);(ch.titleLog=ch.titleLog||[]).push(dr.title)}chips.push('칭호 · '+dr.title)}
        for(const x of bondOk?dr.extra||[]:[]){addStats(ch.stats,x.fx);if(x.fx.maxHp)ch.hp+=x.fx.maxHp;ch.relics.push(x.n);if(x.flag)ch.flags[x.flag]=1;chips.push(`전리품 · ${x.n} (${x.e}, 영구)`)}
        if(dr.gear&&!(dr.ego&&ch.distForm)){offerGear(ch,Object.assign({id:dr.gear.id,grade:5},dr.gear));chips.push(`전리품 무기 · ${dr.gear.n} (${dr.gear.e}) · 장착할지 고른다`)}
        for(const g of dr.gears||[]){if(dr.ego&&ch.distForm)continue;if(dr.gear&&dr.gearChance!=null&&d(100)>dr.gearChance+(ch.stats.gearUp||0))continue;offerGear(ch,Object.assign({grade:5},g));chips.push(`전리품 ${g.slot==='armor'?'방어구':'장비'} · ${g.n} (${g.e}) · 장착할지 고른다`)}
        chips.push(`전리품 · ${dr.n} (${dr.e}, 영구)`);if(dr.card)addCard(ch,dr.card,chips,'전용 카드');if(dr.cards&&dr.lockDeck){ch.packOffer={n:dr.packName||'전용 책장',cards:dr.cards.slice(),passive:dr.packPassive||null,e:dr.packE||null};chips.push(`${dr.packName||'전용 책장'} · 덱을 바꿀지 고른다`)}
        else for(const cc of dr.cards||[])addCard(ch,cc,chips,'전용 책장');}
      if(foe.quest){ch.flags[foe.quest.flag]=1;ch.bookNext=G.year+CFG.redBook.every;(ch.relics=ch.relics||[]).push(foe.quest.relic);chips.push(foe.quest.text)}
      if(foe.unlock&&!ch.unlocks.includes(foe.unlock)){ch.unlocks.push(foe.unlock);unlock=foe.unlock;chips.push('해금 · '+(T.jobs[foe.unlock]||foe.unlock))}
    }
    /* 미니보스 전리품(once): 처음 이겼을 때만 */
    if(!foe.hidden&&foe.drop&&!(ch.minis||[]).includes(C.id)){
      (ch.minis=ch.minis||[]).push(C.id);const dr=foe.drop;if(dr.ego)ch.egoGear=(ch.egoGear||0)+1;addStats(ch.stats,dr.fx);if(dr.fx.maxHp)ch.hp+=dr.fx.maxHp;(ch.relics=ch.relics||[]).push(dr.n);
      chips.push(`전리품 · ${dr.n} (${dr.e}, 영구)`);if(dr.card)addCard(ch,dr.card,chips,'전용 카드');for(const cc of dr.cards||[])addCard(ch,cc,chips,'전용 책장');
      /* 새 시리즈를 모두 이기면 종말의 예언 */
      {const MG=CFG.mgirl;if(MG.ids.includes(C.id)&&!ch.flags[MG.flag]&&MG.ids.every(id=>ch.minis.includes(id))){ch.flags[MG.flag]=1;ch.nihilAt=(G.year||0)+MG.gap}}
      const AP=CFG.apoc;if(AP.birds.includes(C.id)&&!ch.flags[AP.flag]&&AP.birds.every(id=>ch.minis.includes(id))){ch.flags[AP.flag]=1;(ch.relics=ch.relics||[]).push('종말의 예언');chips.push('종말의 예언 · 검은 숲 깊은 곳에서 무언가 눈을 뜬다')}
    }
    /* 전투 승리 후 등록: 소속이 없거나 사무소 소속일 때만, 소문 판정(1d100 + 해결사 진로 보정 ≥ winLicenseDc) */
    if(!ch.licensed){
      if((!ch.aff||ch.aff.type==='office'||eastN(ch))&&d(100)+(ch.paths.fixer||0)>=CFG.winLicenseDc&&license(ch)){
        newly=true;chips.push(T.licenseGained+' · '+ch.rank+T.rankUnit);alignEast(ch,chips);title=rankLabel(ch);tlabel=T.licenseGained;
      }
    }
    /* 약지 예술적 감각: 적을 쓰러뜨릴 때 10% 확률로 1 (최대 4, 영구) */
    if(ch.aff&&ch.aff.name==='약지'&&(ch.artSense||0)<CFG.artSense.max&&(ch.artKills=(ch.artKills||0)+1)>=CFG.artSense.every){ch.artKills=0;ch.artSense=(ch.artSense||0)+1;chips.push(`예술적 감각 ${ch.artSense}/${CFG.artSense.max} · 선택지 판정 주사위 1d${checkDie(ch)}`)}
    addPts(ch,foe.hidden?CFG.promo.gain.hidden:(CFG.promo.gain[foe.tier]||0),chips);
    return {chips,title,tlabel,newly,colorRoll,unlock,hidden:!!foe.hidden,endText:foe.endText||null,last:G.year>=lastYear(G)};
  }

  /* ===== 전투 (1:1) =====
     라운드마다 1d100 + 속도×2로 순서를 정하고, 카드는 순서대로 한 장씩 번갈아 발동한다. */
  function mkEnt(o){return Object.assign({bleed:0,rupture:0,breath:0,burn:0,ink:0,flame:0,nail:0,stagger:0,stunned:false,charge:0,sink:0,spent:0,chargeCap:CFG.charge.cap,chargeLoss:CFG.charge.loss,chargeRound:0,chargeHit:0,evaB:0,fs:false,fsOn:false,catchup:false,cu:false,
    dmin:1,defUp:0,adv:0,advUsed:false,hand:[],light:0,guarding:false,passHit:0,passHitNext:0,lightUp:0,lightNext:0},o)}
  /* 푸른 화염: 해방 레바테인에게 화상을 받은 쪽(blue), 또는 화상 blueAt 이상 */
  /* 카드 등급: 연차가 쌓이면 공격 카드가 강해지는 주인공 보정. 쉬움에서는 받지 않는다 */
  const cardGrade=(y,ch)=>ch&&ch.easy?CFG.cardGrade[0]:[...CFG.cardGrade].reverse().find(g=>(y||1)>=g.from)||CFG.cardGrade[0];
  /* 레바테인 해방 단계: 봉인(0) · 1단계 ¼ · 2단계 ½ · 완료 1 */
  const LAEV_F={laev_sealed:0,laev_s1:0.25,laev_s2:0.5,laev:1};
  const laevFrac=w=>w&&LAEV_F[w.id]!=null?LAEV_F[w.id]:null;
  const laevState=w=>{const f=laevFrac(w);return f==null?null:f>=0.5?'open':'sealed'};
  const isBlue=X=>X.flame>0&&(X.blue||X.flame>=CFG.laev.blueAt);
  const snap=C=>{const f=X=>({hunger:X.hunger||0,hp:Math.max(0,X.hp),bleed:X.bleed,rupture:X.rupture,breath:X.breath,burn:X.burn||0,vt:X.vtStack||0,ink:X.ink||0,obey:X.obey||0,flame:X.flame||0,nail:X.nail||0,stagger:X.stagger||0,stunned:!!X.stunned,work:X.work||0,blue:isBlue(X),echo:X.echo||0,ledger:X.ledger||0,prescript:X.prescript||0,warp:X.warp||0,shock:X.shock||0,chain:X.chain||0,web:X.web||0,mk:X.mk||0,grudge:X.grudge||0,shield:X.shield||0,matc:X.matc||0,mat:X.mat||0,wecho:X.wecho||0,revenge:X.revenge||0,revMul:X.revMul||0,presc:X.presc||0,serum:X.serum||0,ammo:X.ammo||0,manner:X.manner||0,disp:X.disp||0,sealMark:X.sealMark||0,accel:X.accel||0,cloud:X.cloud||0,black:X.black?1:0,harpoon:X.harpoon||0,wspear:X.wspear||0,charge:X.charge||0,sink:X.sink||0});return {P:f(C.P),E:f(C.E)}};
  /* 오랜 굶주림: HP를 회복할 때마다 스택 */
  let RS_=null;   /* 이번 전투에서 쌓는 판 전체 전투 기록(입힌·받은 피해, 회복, 버프·디버프) */
  const HG=(X,h)=>{if(h>0&&X&&X.hunger!=null)X.hunger=Math.min(CFG.hunger.max,X.hunger+h)};
  const kidsOn=ch=>ch.race==='hyeolgwi'&&(ch.beaten||[]).includes('dulcinea');
  /* 무한 모드에 들어선 뒤 지난 햇수: 해마다 양쪽 회피가 evaDown씩 줄어든다 (0에서 멈춤) */
  /* 출혈 최대 스택: 플레이어가 적에게 거는 출혈만 bleedMax, 플레이어가 받는 출혈은 stackCap */
  const bleedCap=X=>X.isP?CFG.stackCap:CFG.bleedMax;
  /* 혈찬 회복: 5스택마다 CFG.hyeolchan.heal (총량 제한 없음) */
  const hcHeal=X=>Math.max(0,Math.min(CFG.hyeolchan.heal,X.maxHp-X.hp));
  /* 균열에 나타날 수 있는 히든 보스: 조건과 상관없이 나타나지만, 이기는 것이 아니라 버티는 시험(trial)이나 noRift 표시가 있는 보스는 뺀다 */
  const riftBosses=()=>{const seen=new Set();return (D.hiddenBosses||[]).filter(h=>{const e=D.enemies[h.id];if(!e||h.noRift||(e.passive&&e.passive.id==='trial')||seen.has(h.id))return false;seen.add(h.id);return true})};
  /* 무한 모드 성장 요약: 가방에 항상 보여 준다 (적용되는 수치를 눈으로 확인할 수 있게) */
  function infGrowth(ch){
    if(!ch.infinite)return [];const IL=CFG.infinite,pc=x=>Math.round(x*1000)/10+'%',rows=[];
    const dm=(ch.infBoost||0)*IL.century.dmg,sh=(ch.infShard||0)*IL.shard.dmg,gr=(ch.famLoss||0)*IL.grief.dmg,lm=ch.limDmg||0,tot=dm+sh+gr+lm;
    rows.push(['주는 피해',`+${pc(tot)}`,tot?[dm&&`백 해마다 ${pc(dm)}`,sh&&`불순물의 조각 ${pc(sh)}`,gr&&`가족의 슬픔 ${pc(gr)}`,lm&&`한계 돌파 ${pc(lm)}`].filter(Boolean).join(' · '):'백 해를 넘기거나 불순물을 쓰러뜨리면 오른다']);
    if(ch.limStrike)rows.push(['일격 추가 피해',`적중 시 +${Math.round(ch.stats.maxHp*ch.limStrike)}`,`적중 시 상대에게 주는 추가 피해 (내 최대 HP의 ${pc(ch.limStrike)}) · 최대 HP가 늘면 함께 커진다 · 한계 돌파로 쌓임`]);
    if(ch.infBoost)rows.push(['받는 피해',`+${pc(ch.infBoost*IL.century.enemyDmg)}`,'백 해마다 적의 공격도 함께 강해진다']);
    const cut=infEvaCut(ch);if(cut>0)rows.push(['무한 회피 감소',`−${cut}`,'해가 갈수록 회피가 깎인다 · 0에서 멈춘다']);
    const SG=IL.surge;if(SG&&(ch.year||0)>=SG.year)rows.push(['기세',`${SG.round}라운드 이후`,`전투가 ${SG.round}라운드를 넘기면 라운드마다 주는 피해 ×${SG.per}`]);
    if(IL.legacyNeed){const t=ch.legacyTier||0;rows.push(['연륜',`${t}/${IL.legacyMax}단계`,`최고 직위에 오른 뒤 전공이 연륜으로 쌓인다 · 단계마다 ${({atk:'공격',eva:'회피',spd:'속도'})[ch.dom]||'최대 HP(+4)'} +1 · 다음 단계까지 ${ch.legacyPts||0}/${IL.legacyNeed}`])}
    return rows
  }
  const infEvaCut=ch=>Math.min(Math.max(0,ch.stats.eva),Math.floor(infYears(ch)*CFG.infinite.evaDown));
  const infYears=ch=>ch.infinite?Math.max(0,(ch.year||0)-(CFG.years+CFG.endless.span*CFG.endless.grades.length)):0;
  function mkCombat(ch,id,quiet){
    const s=ch.stats,e=D.enemies[id];
    const P=mkEnt({uid:'P',hunger:ch.flags&&ch.flags.hunger?0:null,name:(eqT(ch)?`[${eqT(ch)}] `:'')+(ch.name||T.you),tt:eqT(ch)||'',color:ch.color,hp:ch.hp,maxHp:s.maxHp,atk:s.atk,eva:Math.max(0,s.eva-Math.floor(infYears(ch)*CFG.infinite.evaDown)),spd:s.spd,
      bleed:s.startBleed,breath:s.startBreath,dmin:s.dmin,defUp:s.defUp,adv:s.adv,advDie:s.advDie||0,hwando:!!ch.hwando,resonance:!!ch.resonance,oracle:!!ch.oracle,middle:!!(ch.aff&&ch.aff.name==='중지'),bladeBoost:!!(ch.flags&&ch.flags.bladeBoost),kuro:synOf(ch)==='kuro'&&synTier(ch.deck.length)>=2,blade:synOf(ch)==='blade'&&synTier(ch.deck.length)>=2,awl:synOf(ch)==='awl'&&synTier(ch.deck.length)>=2,synT:synOf(ch)?Math.max(0,synTier(ch.deck.length)):0,midDr:ch.aff&&ch.aff.name==='중지'?(CFG.middle.dr[ch.fi||0]||0):0,midEff:ch.aff&&ch.aff.name==='중지'?(CFG.middle.evaEff[ch.fi||0]??1):1,ring:!!(ch.aff&&ch.aff.name==='약지'),work:0,index:!!(ch.aff&&ch.aff.name==='검지'),thumb:!!(ch.aff&&ch.aff.name==='엄지'),ammo:ch.aff&&ch.aff.name==='엄지'?CFG.thumbAmmo.base+CFG.thumbAmmo.per*(ch.fi||0):0,thumbFi:ch.fi||0,deck:ch.deck,extraD2:(s.extraD2||0),dmgB:s.dmgB||0,burnHit:s.burnHit||0,pdie:s.pdie||6,hyeolchan:ch.race==='hyeolgwi',psycho:hasInn(ch,'psycho'),swift:hasInn(ch,'swift'),cg:cardGrade(ch.year,ch),wx:ch.gear.weapon&&ch.gear.weapon.wx||null,jobPassive:ch.job&&D.hiddenJobs[ch.job]?D.hiddenJobs[ch.job].passive||null:null,mark:!!ch.markOn,odin:!!ch.odin,odinMid:!!(ch.odin&&ch.aff&&ch.aff.name==='중지'),revenge:(ch.odin&&ch.aff&&ch.aff.name==='중지')?CFG.odin.midStart:0,bonB:bonCardB(ch),yeji:!!(ch.yeji||(ch.odin&&ch.o&&ch.o.n==='보냐텔리 가문')),dr:s.dr||0,regen:s.regen||0,kwPlus:ch.colorPasv==='brand'?2:0,singHeal:corpType(ch)&&corpType(ch).heal?Math.min((ch.corp.up2?corpType(ch).heal2Max:0)||corpType(ch).healMax||999,corpType(ch).heal+corpLv(ch)*corpType(ch).per):0,warpLead:corpType(ch)&&corpType(ch).lead?corpType(ch).lead+corpLv(ch)*(corpType(ch).leadPer||0):0,egoLight:ch.ego?M.light:0,egoRounds:M.lightRounds,augHunt:isN(ch)?CFG.nWing.augDmg:0,distorted:!!(ch.distForm&&(ch.packName===CFG.distort.packN||ch.packName===CFG.distort.packN2)),laev:laevState(ch.gear.weapon),laevF:laevFrac(ch.gear.weapon),isP:true});
    if(ch.flags&&ch.flags.redMist&&ch.gear&&ch.gear.weapon&&ch.gear.weapon.id==='w_mimicry_p'){P.rmGauge=0;P.rmOpen=0}
    if(ch.flags&&ch.flags.redMist&&CFG.redMist.shieldPct)P.shield=Math.max(P.shield||0,Math.round(s.maxHp*CFG.redMist.shieldPct));   // 붉은 안개 책장: 전투 시작 때 보호막
    P.ample=ch.ample||0;P.hitB=s.hit||0;if(P.wx&&P.wx.forms)P.form='a';P.hwHeal=ch.hw?(CFG.hw.dan.heal[ch.hwDan||0]||0):0;
    const EZ=ch.easy?CFG.easy:null,S_=CFG.enemyScale,yy=Math.max(0,(ch.year||0)-S_.from),grow=e.hidden?0:yy*(EZ?EZ.grow:1);
    const IFH=CFG.infinite,yH=ch.infinite&&id===CFG.endless.final?Math.min(IFH.hpEnd,(Math.floor((CFG.startAge+(ch.year||0)-1)/IFH.hpStep)+1)*IFH.hpStep-CFG.startAge+1):(ch.year||0),growH=e.hidden?0:Math.max(0,yH-S_.from)*(EZ?EZ.grow:1);
    const H_=CFG.hidden,HL=CFG.hiddenLate,hy=e.hidden?Math.max(0,(ch.year||0)-HL.from)*(EZ?EZ.late:1):0,g=((ch.infinite?gradeRaw(ch.year||0):gradeAt(ch.year||0))+1)*(EZ?EZ.endless:1),X_=CFG.endless;
    const gH=((ch.infinite?gradeRaw(yH):gradeAt(yH))+1)*(EZ?EZ.endless:1);
    const eh=Math.round(((e.hp+s.enemyHp)*(1+S_.hpPerYear*growH)*(e.hidden?H_.hpMul*(EZ?EZ.hidden:1):S_.hpMul)+hy*HL.hpPerYear)*(1+X_.hpMul*gH));
    const up=Math.floor(grow/S_.atkEvery)+(e.hidden?H_.atk+Math.floor(hy/HL.atkEvery):0),xa=X_.atk*g;
    /* 보스별 난이도 보정(hard): 체력 배수, 공격·회피 가산 */
    const IM_=ch.infinite&&id===X_.final?(ch.infImp||0):0;
    const SI_=ch.infinite?Math.max(0,gradeRaw(yH)-X_.grades.length+1):0;
    const hd=e.hard||null,nm=e.names&&e.names.length?CFG.named:null,tr=ch.corp&&ch.corp.trial===id?CFG.corp.trial[id]:ch.rb&&ch.rb.headSeen&&CFG.rb.trial[id]||null,ehh0_=Math.round((hd?eh*(EZ?1+((hd.hp||1)-1)*EZ.bossHard:(hd.hp||1)):eh)*(nm?nm.hp:1)*(tr?tr.hp:1)*(ch.hard?CFG.hard.hp:1)*(EZ?EZ.hp*(EZ.boss&&EZ.boss[id]||1):1)*(1+CFG.infinite.impPer*IM_)*Math.pow(1+CFG.infinite.hpGrow,Math.min(SI_,CFG.infinite.hpGrowCap)));
    /* 무한 모드 불순물: 100살(나이)마다 정해 둔 체력표를 쓴다 (첫 100살은 잡을 만하게, 200살부터 조금 많이, 300살부터 확 오른다) */
    /* 100살 구간의 첫 불순물은 표의 딱 맞는 숫자, 그 구간에서 불순물을 쓰러뜨릴 때마다 뒷자리가 조금씩 늘어난다 (구간 안에서 최대 hpBandMax) */
    const infTab=ch.infinite&&id===X_.final?(()=>{const A_=CFG.startAge+(ch.year||0)-1,T_=CFG.infinite.hpTable,IF2=CFG.infinite;let v=T_[0][1],bi=0;T_.forEach(([at,hp],i)=>{if(A_>=at){v=hp;bi=i}});
      if(ch.infBandI!==bi){ch.infBandI=bi;ch.infBandStart=ch.infImp||0}
      const k=Math.max(0,(ch.infImp||0)-(ch.infBandStart||0));const jit=k>0?(((ch.year||0)*37+k*91)%11-5)*0.003:0;   // 숫자가 규칙적으로만 보이지 않게 ±1.5% 안에서 조금 흔든다 (같은 해에는 항상 같은 값)
      return Math.round(v*(1+Math.min(IF2.hpBandMax,k*IF2.hpPerKill)+jit))})():0;
    const ehhX=infTab?Math.round(infTab*(nm?nm.hp:1)*(tr?tr.hp:1)*(ch.hard?CFG.hard.hp:1)*(EZ?EZ.hp*(EZ.boss&&EZ.boss[id]||1):1)):ehh0_;
    const ehhCap=ch.infinite?Math.min(ehhX,CFG.infinite.hpMax):ehhX;
    const lastImp=ch.infinite&&id===X_.final&&(ch.year||0)+CFG.infinite.every>CFG.overflowAge-CFG.startAge+1;   // 1000살 오버플로우 전의 마지막 불순물 전투
    const ehh0=lastImp?CFG.infinite.hpMax:ehhCap,ehh1=EZ&&e.hidden?Math.max(ehh0,EZ.hiddenMin||0):ehh0,ehh=id==='redmist'&&(ch.redPost||0)>0?Math.round(ehh1*Math.pow(CFG.redBook.hpMul,ch.redPost)):ehh1;
    /* 네임드: 로보토미 직원처럼 무작위 이름. 절반은 세력 이름 목록, 절반은 공용 이름 목록에서 */
    const E=mkEnt({uid:'E',name:e.names&&e.names.length?`${e.n} · ${(D.namePool&&d(2)===1?one(D.namePool):one(e.names))}`:e.n,color:e.color,hp:Math.round(ehh*((ch.infinite&&lakeOn(ch)&&/^lake_/.test(id)&&!e.hidden&&e.tier!=='boss')?CFG.lake.infMob.hp:1)),maxHp:Math.round(ehh*((ch.infinite&&lakeOn(ch)&&/^lake_/.test(id)&&!e.hidden&&e.tier!=='boss')?CFG.lake.infMob.hp:1)),atk:Math.max(1,((ch.infinite&&lakeOn(ch)&&/^lake_/.test(id)&&!e.hidden&&e.tier!=='boss')?CFG.lake.infMob.atk:0)+e.atk+up+xa+CFG.infinite.impAtk*IM_+CFG.infinite.atkGrow*SI_+Math.round((hd&&hd.atk||0)*(EZ?EZ.bossHard:1))-(EZ?EZ.atkMinus:0))+(nm?nm.atk:0)+(tr?tr.atk:0)+(ch.hard?CFG.hard.atk:0),eva:e.eva+up+Math.round(CFG.infinite.evaGrow*SI_)+Math.round((hd&&hd.eva||0)*(EZ?EZ.bossHard:1))+(ch.hard?CFG.hard.eva:0),spd:e.spd,deck:e.deck,isP:false,passive:e.passive&&e.passive.id==='lockledger'&&ch.infinite?null:e.passive||null,aug:!!e.aug,hyeolchan:!!e.hyeolchan,trait:e.trait||null,kali:e.kali||null,ul:e.ul||null,middle:!!(e.passive&&e.passive.id==='brother'),revMul:e.passive&&e.passive.id==='brother'?e.passive.mul:0});
    /* 무한 모드에서도 적의 회피는 enemyMax에서 멈춘다. 공격(명중)도 enemyMax에서 멈추지만, 균열을 닫은(균열 엔딩을 본) 뒤에는 균열 피해가 없어지므로 atkMax까지 올라 플레이어 회피가 아무리 높아도 결국 맞게 한다 */
    E.atk+=Math.floor(infYears(ch)/CFG.infinite.atkEvery);E.atk=Math.min(E.atk,CFG.infinite.atkCap||(ch.outSeen&&ch.outSeen.seal?(CFG.infinite.atkMax||CFG.infinite.enemyMax):CFG.infinite.enemyMax));E.eva=Math.max(0,Math.min(E.eva,CFG.infinite.enemyMax)-Math.floor(infYears(ch)*CFG.infinite.evaDown));
    /* 급수 부족 보정: 히든 보스 규칙에 penalty가 있고 fullRank보다 급수가 낮으면 내 명중·회피가 깎인다 */
    const rule=(D.hiddenBosses||[]).find(h=>h.id===id),pen=rule&&rule.penalty;
    let penalty=null;
    if(isN(ch)){P.atk+=CFG.nWing.atk;P.eva+=CFG.nWing.eva;P.spd+=CFG.nWing.spd;P.nailHit=CFG.nail.hit;if(ch.fate){P.nailHit=0;P.atk+=CFG.nWing.fate;P.eva+=CFG.nWing.fate}}
    if(pen&&!rankMet(ch,pen.fullRank)){P.atk+=pen.atk||0;P.eva+=pen.eva||0;penalty=pen}
    /* 홍루: 홍루를 따르는 흑수들. 내 부하 두 사람은 빠진다 */
    /* 1000해를 넘긴 캐릭터가 이름 없는 불순물이 되어 돌아온다: 그 캐릭터가 쓰던 덱으로 싸운다 */
    if(id==='impurity'){const gh=ghostOf(ch);if(gh){E.deck=gh.deck.slice();E.ghost=true;if(gh.wx)E.wx=structuredClone(gh.wx);E.name+=' · '+(gh.name||T.you)}}
    if(e.zodiac10){const own=hwHave(ch);E.zChain=ZKEYS.filter(k=>!own.slice(0,2).includes(k));E.zExtra=Math.min(CFG.hw.zExtraMax,Math.max(0,own.length-CFG.hw.zExtraFrom));E.deck=['z_'+E.zChain[0]]}
    if(e.hwKamo){const n=hwHave(ch).length,cut=Math.min(CFG.hw.kamoCutMax,Math.max(0,n-3)*CFG.hw.kamoCut);E.maxHp=Math.round(E.maxHp*(1-cut));E.hp=E.maxHp}
    /* 히든 보스: 체력이 너무 낮으면 최소치까지 채운 상태로 시작 */
    let hpNote=null;
    if(P.laev==='open'){P.flame=1}
    if(e.hidden&&P.hp<Math.min(CFG.hidden.minHp,P.maxHp)){const t=Math.min(CFG.hidden.minHp,P.maxHp);hpNote=`불길한 예감에 숨을 고른다 · HP ${P.hp} → ${t}`;P.hp=t;ch.hp=t}
    /* 정신력: 환상체와 마주치면 2d3 감소, 그다음 정신력 구간 보정(호흡·회피) */
    let mindNote=hpNote?[hpNote]:[];
    if(e.abno)loseMind(ch,d(3)+d(3),t=>mindNote.push(`환상체와 마주쳤다 · ${t} · 2d3`));
    const mt=mindTier(ch),ct=corpType(ch),tm=ct&&ct.tier?ct.tier+corpLv(ch)*(ct.tierPer||0):1;
    {const dn=(ch.deck||[]).length,DB=CFG.deck.bonus,db=dn>=DB.from?(Math.floor((dn-DB.from)/DB.per)+1)*DB.atk:0;if(db){P.atk+=db;mindNote.push(`덱 ${dn}장 · 공격 +${db}`)}}
    if(P.kuro){const k=CFG.syn['흑운회'];P.cloud=k.start[P.synT];mindNote.push(`암운 · 구름 ${P.cloud} (덱 ${ch.deck.length}장)`)}
    if(P.blade)mindNote.push(`호흡결 · 매 라운드 호흡 +${P.synT>=2?2:1} · 자연 감소 ${CFG.syn['검계'].decay[P.synT]} (덱 ${ch.deck.length}장)`);
    if(P.awl){const w=CFG.syn['밤의 송곳'];P.synInit=w.init[P.synT];mindNote.push(`뒷골목의 룰 · 속도 굴림 +${P.synInit} (덱 ${ch.deck.length}장)`)}
    const ms=mindStat(ch);if(ms){P.atk+=ms;P.eva+=ms;P.spd+=ms;P.maxHp+=ms;P.hp+=ms;mindNote.push(`정신력 ${ch.mind} · 모든 능력치 +${ms}`)}
    if(mt){const tb=Math.round(mt.breath*tm),te=Math.round(mt.eva*tm);P.breath+=tb;P.eva+=te;mindNote.push(`정신력 ${ch.mind} · 호흡 +${tb}${te?` · 회피 +${te}`:''}${tm>1?' (월광석)':''}`)}
    /* 굳은 정신: 기본 정신력 보정에 더해, 정신력 15부터 5마다 한 단계(최대 100까지 willSteps단계): 단계마다 호흡 +1 · 최대 HP +willHp, 2단계마다 회피 +1, 3단계마다 모든 능력치 +1 */
    if(!ch.distForm&&hasInn(ch,'will')&&ch.mind>=CFG.innate.willFrom){const I=CFG.innate,n=Math.min(I.willSteps,Math.floor((ch.mind-I.willFrom)/5)+1),ev=Math.floor(n/2),st=Math.floor(n/3),br=Math.min(n,Math.max(0,CFG.breath.cap-P.breath)),hp=n*I.willHp+st;
      P.breath+=br;P.eva+=ev+st;P.atk+=st;P.spd+=st;P.maxHp+=hp;P.hp+=hp;mindNote.push(`굳은 정신 · 정신력 ${ch.mind} (${n}단계) · 호흡 +${br} · 회피 +${ev+st} · 최대 HP +${hp}${st?` · 공격·속도 +${st}`:''}`)}
    /* 특색 + 소지: 신(心) — 전투를 시작할 때 정신력을 쓰고 받는 피해를 줄이며 주는 피해를 늘린다. 3라운드마다 망이 하나씩 감긴다 (newRound) */
    {const SM=CFG.shinmang,isC=ch.titleKind==='color'||ch.colorDone;
      if(SM.on&&ch.pinky&&isC&&!ch.distForm&&ch.mind>SM.shinCost){ch.mind-=SM.shinCost;P.sm={rings:0,limit:Math.min(SM.maxRings,(ch.pinkyKeys||[]).length)};
        mindNote.push(`신(心) · 정신력 −${SM.shinCost} (지금 ${ch.mind}) · 받는 피해 −${Math.round(SM.takeShin*100)}% · 주는 피해 +${Math.round(SM.dealShin*100)}%${P.sm.limit?` · ${SM.ringEvery}라운드마다 망 하나 (최대 ${P.sm.limit}망)`:' · 소지의 별이 없어 망은 감기지 않는다'}`)}
      P.augPas=(ch.gear&&ch.gear.aug&&ch.gear.aug.cust&&ch.gear.aug.cust.pas)||ch.custPas||((ch.ws&&ch.ws.cust&&ch.ws.cust.done&&isWs(ch))?ch.ws.cust.pas:null);
      if(P.augPas)mindNote.push(`커스텀 의수 · ${CFG.ws.cust.pass[P.augPas].n} · ${CFG.ws.cust.pass[P.augPas].e}`);
      const CB=CFG.colorBuff;
      if(CB.on&&isC){const k=one(['dmg','hit','eva']);P.cb={k,v:CB[k]};mindNote.push(`특색 위력 · ${({dmg:'피해',hit:'명중',eva:'회피'})[k]} +${CB[k]} (HP ${Math.round(CB.hpMin*100)}% 이상일 때)`)}}
    if(ch.hw&&ch.hw.host)P.lightUp=(P.lightUp||0)+CFG.hw.hostLight;
    /* 대호수 대재앙 심장 전리품 패시브 */
    {const f=ch.flags||{};P.lk={silence:!!f.lkL_silence,lamp:!!f.lkL_lamp,anchor:!!f.lkL_anchor,tide:!!f.lkL_tide,genesis:!!f.lkL_genesis,pale:!!f.lkL_pale};if(P.lk.lamp)P.lightUp=(P.lightUp||0)+1}
    {const n=Math.floor((ch.lv||1)/CFG.lvLight.at);if(n>0)P.lightUp=(P.lightUp||0)+CFG.lvLight.up*n}
    if(P.wx&&P.wx.lightUp)P.lightUp=(P.lightUp||0)+P.wx.lightUp;
    P.inkIds=ch.hw&&ch.hw.mission&&hwHave(ch).length?hwHave(ch).map(k=>'zp_'+k):null;
    P.rv=assocOf(ch)==='R사 날개'&&ch.rteam==='까마귀팀'?{t:CFG.raven.tiers.filter(n=>ch.deck.filter(id=>id.startsWith('rv_')).length>=n).length}:null;
    {const o=assocOf(ch),CH=o&&(CFG.charge.orgs[o+(ch.rteam?'/'+ch.rteam:'')]||CFG.charge.orgs[o]);if(CH){P.chargeCap=CH.cap||P.chargeCap;P.chargeLoss=CH.loss??P.chargeLoss;P.chargeRound=CH.round||0;if(o==='W사 날개'){const fi_=ch.fi??-1;if(fi_>=4)P.chargeRound=4;else if(fi_>=2)P.chargeRound=3}P.chargeHit=CH.hit||0;P.chargeExp=CH.express||null;if(CH.start)P.charge=Math.min(P.chargeCap,(P.charge||0)+CH.start);P.spd+=CH.spd||0;P.spdBoost=CH.boost||null;P.spdBase=P.spd;P.pw=CH.power||null;P.wl=CH.wall||null;P.focus=CH.focus||null;P.armor=CH.armor||null;P.dmgB0=P.dmgB||0;P.defUp0=P.defUp||0;P.dr0=P.dr||0;P.lostN=0}}
    /* 토벌 의뢰의 가족: 주인공이 뒤틀리기 전의 책장과 같은 카드를 쓰고, 능력치는 내 능력치의 배수 (특색급(최고 급수)은 mulTop, 그 밑은 mul) */
    if(e.kidHunt){const K=CFG.bond.hunt,m=(ch.kidFoeLv||0)>=K.topLv?K.mulTop:K.mul;
      E.maxHp=E.hp=Math.max(1,Math.round(P.maxHp*m));E.atk=Math.max(1,Math.round(P.atk*m));E.eva=Math.round(P.eva*m);E.spd=Math.round(P.spd*m);E.deck=(ch.preDistDeck&&ch.preDistDeck.length?ch.preDistDeck:ch.deck).filter(id=>D.cards[id]).slice()}
    /* 인연과 함께 싸우는 보스(엘레나): 결혼한 인연이 라운드마다 추가 공격 */
    const beastAlly=ch.hw&&ch.hw.beast&&ch.hw.bk&&!ch.hw.done;
    const ally=e.ally&&ch.bond&&ch.bond.st==='married'?{name:ch.bond.name,lv:spouseLevel(ch.bond,ch.year||0)}:beastAlly?{name:(ch.bond&&ch.bond.name)||((D.enemies[ch.hw.cand]||{}).n||'가주 후보'),lv:ch.bond&&ch.bond.route?spouseLevel(ch.bond,ch.year||0):2}:null;
    const allyFirst=ch.flags&&ch.flags.bondFirst&&ch.bond&&ch.bond.st==='married'?{name:ch.bond.name,lv:spouseLevel(ch.bond,ch.year||0)}:null;
    const echo=ch.echoFoe===id;ch.echoFoe=null;if(echo)E.name+=' · 불순물';
    const C={ch,P,E,id,echo,ally,allyFirst,penalty,duel:assocOf(ch)===CFG.duel.org?CFG.duel.dmg:0,round:0,log:[],cur:[],evs:[],logBefore:0,over:null,order:[],quiet:!!quiet,mindNote};
    C.crew=ch.lake&&ch.lake.crew?ch.lake.crew.map(m=>({role:m.role,n:m.n,die:m.die})):[];
    {const nv=C.crew.filter(m=>m.role==='navigator').length;if(nv&&C.P)C.P.eva+=CFG.lake.navEva*nv}
    {const R=ch.rs=ch.rs||{};RS_=R;let hv=P.hp;Object.defineProperty(P,'hp',{get(){return hv},set(v){if(v>hv)R.heal=(R.heal||0)+(v-hv);hv=v},enumerable:true,configurable:true})}
    {const fl=ch.flags||{};if(fl.escortNext){fl.escortNext=0;if(ch.bond&&ch.bond.st==='married')C.escort={name:ch.bond.name,kind:escortKind(ch.bond.route),lv:spouseLevel(ch.bond,ch.year||0)}}}
    activeC=C;
    if(ch.mindDead&&!ch.ego&&!ch.distForm)mindBreak(C);
    newRound(C);
    return C;
  }
  /* 순서: 1d100 + 속도×2 (+ 지난 라운드에 뒤처졌으면 추격 보정).
     상대보다 높으면 빛 +1, 격차 gapFirst 이상이면 첫 공격 명중 +firstHit. 동점이면 둘 다 보너스 없음 */
  /* 오딘의 눈 · 가속하는 미래: 라운드마다 회피 보정이 cycle 순서로 돌아간다 (마지막 칸은 과부하) */
  /* 예지안(보냐텔리 가문이 오딘의 눈을 얻으면): 전용 검술 카드(b_)의 피해 +CFG.odin.yeji */
  const BONA=new Set(Object.entries(D.cards).filter(([k])=>k.startsWith('b_')).map(([,v])=>v));
  const odinEva=(r,X)=>X&&X.middle&&X.isP?0:X&&X.yeji?CFG.odin.cycle[(r-1)%CFG.odin.cycle.length]:(r===1?CFG.odin.first:CFG.odin.after);
  function newRound(C){
    C.round++;
    const {P,E}=C;P.triDmg=0;P.triCut=0;C.tri=null;
    if(P.augPas==='absorb'&&P.hp>0&&P.hp<P.maxHp){const h=Math.min(3,P.maxHp-P.hp);P.hp+=h;const m={t:'kw',s:`${P.name} · 흡수 코어 · HP +${h}`};if(!C.quiet){C.log.push(m);C.cur.push(m)}}
    /* 망(望): 3라운드마다 정신력을 쓰고 빛의 고리 하나가 감긴다. 최대 3망, 9라운드 이후에는 더 쓰지 않는다. 정신력이 모자라면 감기지 않는다 */
    {const SM=CFG.shinmang;if(P.sm&&C.round%SM.ringEvery===0&&P.sm.rings<P.sm.limit){const cost=SM.ringCost[P.sm.rings]||SM.ringCost[SM.ringCost.length-1];
      if(C.ch.mind>cost){C.ch.mind-=cost;P.sm.rings++;const m={t:'kw',s:`망(望) ${P.sm.rings}망 · 정신력 −${cost} (지금 ${C.ch.mind}) · 주는 피해 +${Math.round((SM.dealShin+P.sm.rings*SM.dealRing)*100)}% · 명중 +${P.sm.rings*SM.ringHit}`};if(!C.quiet){C.log.push(m);C.cur.push(m)}}}}
    P.evaPen=P.evaPenNext||0;P.evaPenNext=0;
    /* 토끼 강화·충전 자극 근력: 체력이 낮거나 충전이 충분하면 라운드 동안 속도가 오른다 */
    if(P.spdBoost){const B_=P.spdBoost;P.spd=P.spdBase+(P.hp<=P.maxHp*B_.low[0]?B_.low[1]:0)+(P.charge>=B_.charge[0]?B_.charge[1]:0)}
    /* 순록팀·코뿔소팀: 체력을 잃을수록 공격 피해(순록) · 방어(코뿔소)가 오르고, 충전이 충분하면 코뿔소는 받는 피해가 줄어든다 */
    if(P.pw||P.wl){const T_=P.pw||P.wl,n=Math.min(T_.max,Math.floor((P.maxHp-P.hp)/(P.maxHp*T_.step)));if(n>P.lostN)P.lostN=n;
      if(P.pw)P.dmgB=P.dmgB0+T_.dmg*P.lostN;if(P.wl)P.defUp=P.defUp0+T_.def*P.lostN}
    if(P.armor)P.dr=P.dr0+(P.charge>=P.armor.at?P.armor.dr:0);
    if(P.chargeRound){P.charge=Math.min(P.chargeCap,P.charge+P.chargeRound)}
    if(P.wx&&P.wx.field&&C.round%P.wx.field.every===0&&P.charge>=P.wx.field.cost){P.charge-=P.wx.field.cost;P.shield=Math.min(CFG.shieldCap,(P.shield||0)+P.wx.field.shield);C.jobNote=(C.jobNote?C.jobNote+' · ':'')+`${P.name} · 충전 역장 · 충전 ${P.wx.field.cost} 소모 · 보호막 +${P.wx.field.shield}`}
    for(const X of [P,E]){X.swiftR=!!X.swiftNext;X.swiftNext=false}
    for(const X of [P,E]){X.r=d(100);X.cu=X.catchup;X.tot=X.r+X.spd*CFG.spdMul+(X.synInit||0)+(X.catchup?CFG.catchupBonus:0)+(X.warpLead>=C.round?200:0)+(X.swift||X.swiftR?1000:0)}
    for(const [X,Y] of [[P,E],[E,P]]){
      X.lead=X.tot>Y.tot;X.awlUsed=false;X.fsOn=X.fs=X.tot-Y.tot>=CFG.gapFirst;X.catchup=X.tot<Y.tot;X.advUsed=false;
      const el=(X.egoLight&&C.round<=X.egoRounds?X.egoLight:0)+(X.burstLight&&C.round<=X.burstTo?X.burstLight:0);
      X.light=Math.min(CFG.lightMax+X.lightUp+X.lightNext+el,CFG.light+X.lightUp+X.lightNext+el+(X.lead?CFG.orderBonusLight:0));
      X.passHit=X.passHitNext;X.passHitNext=0;X.lightNext=0;X.matBonus=X.matNext||0;X.matNext=0;
    }
    /* 피의 각인된 갈망: 자식 1명당 라운드마다 혈찬 스택 per를 바로 얻는다 */
    {const kn=kidsOn(C.ch)&&P.hyeolchan?C.ch.kids||0:0;
      if(kn>0&&P.hp>0){P.hc=(P.hc||0)+CFG.kids.per*kn;let h=0;while(P.hc>=5){P.hc-=5;const x=hcHeal(P);P.hp+=x;h+=x}HG(P,h);
        C.kidNote=`${P.name} · 피의 각인된 갈망 · 자식 ${kn}명 · 혈찬 +${CFG.kids.per*kn}${h?` · HP +${h}`:''}`}}
    if(C.round>1)for(const X of [P,E])if(X.breath>0)X.breath=Math.max(0,X.breath-(X.blade?(X.bladeBoost&&X.synT>=2?0:CFG.syn['검계'].decay[X.synT]):CFG.breath.decay));
    if(P.blade){const g=P.synT>=2?2:1;P.breath=Math.min(CFG.breath.cap,P.breath+g);if(!C.quiet){const m={t:'kw',s:`${P.name} · 호흡결 · 호흡 +${g} (지금 ${P.breath})`};C.log.push(m);C.cur.push(m)}}
    {const cdOk=id=>!((D.cards[id].cd||0)&&((C.cdUntil||{})[id]||0)>C.round),dk=P.deck.filter(id=>!(D.cards[id].once&&(C.onceUsed||[]).includes(id))&&cdOk(id));P.hand=sample(dk.length?dk:P.deck,CFG.hand)}
    if(P.form)P.hand=P.hand.map(id=>formId(id,P.form));
    if(P.handPlusNext){const dk=P.deck.filter(id=>!(D.cards[id].once&&(C.onceUsed||[]).includes(id))),ex=sample(dk.length?dk:P.deck,P.handPlusNext);P.hand=P.hand.concat(ex);P.handPlusNext=0}
    if(P.furiosoNext){P.hand.push('x_furioso');P.furiosoNext=false}
    if(P.boneNext){P.hand.push('bl_bone');P.boneNext=false}
    if(P.grantNext){P.hand.push(P.grantNext);P.grantNext=null}
    if(P.grantQ&&P.grantQ.length){for(const id of P.grantQ)P.hand.push(id);P.grantQ=null}
    /* 한 라운드에 손패로 들어오는 지급 카드는 최대 2장이다. 그보다 많이 겹친 것은 다음 라운드로 넘어간다 */
    if(P.grantWait&&P.grantWait.length){const w=P.grantWait.splice(0,2);P.grantNext=w[0]||null;P.grantQ=w[1]?[w[1]]:null}
    if(C.id==='kid_hunt'&&!P.noKill&&D.cards.x_nokill&&P.hand.length)P.hand[0]='x_nokill'   // 가족과 싸울 때: 첫 번째 손패는 해치고 싶지 않은 마음 (쓰기 전까지 매 라운드)
    /* 검지 패시브 지령 수행: 손패 한 칸에 ☆ 지령이 박힌다 */
    if(P.index){P.starSlot=d(Math.min(CFG.hand,P.hand.length))-1;P.starId=P.hand[P.starSlot]}
    /* 히든 보스 전용 패시브: 라운드 단위 */
    const pv=E.passive&&E.passive.id;
    /* 대호수 고래 패시브 (라운드 단위) */
    {const hands=(C.crew||[]).filter(m=>m.role==='hand').length;if(hands&&P.hp>0){P.shield=Math.min(CFG.shieldCap,(P.shield||0)+CFG.lake.handShield*hands);C.jobNote=(C.jobNote?C.jobNote+' · ':'')+`갑판원이 돛을 잡아 준다 · 보호막 +${CFG.lake.handShield*hands}`}}
    {const cooks=(C.crew||[]).filter(m=>m.role==='cook').length;if(cooks&&C.round>1&&P.hp>0){const h=Math.min(CFG.lake.cookHeal*cooks,P.maxHp-P.hp);if(h>0){P.hp+=h;C.jobNote=(C.jobNote?C.jobNote+' · ':'')+`요리사가 통조림을 데워 준다 · HP +${h}`}}}
    if(pv==='lkLantern'&&E.lights==null){E.lights=E.passive.lights;C.jobNote=(C.jobNote?C.jobNote+' · ':'')+`${E.name} · 빛 촉수 ${E.lights}개를 먼저 부숴야 본체에 피해가 들어간다`}
    if(pv==='lkAnchor'){const navN=(C.crew||[]).filter(m=>m.role==='navigator').length;let add=Math.min(Math.max(1,E.passive.per-navN),E.passive.cap-(P.anchorLoss||0));if(P.lk&&P.lk.anchor)add=Math.floor(add/2);if(add>0){P.eva-=add;P.anchorLoss=(P.anchorLoss||0)+add;C.jobNote=(C.jobNote?C.jobNote+' · ':'')+`${E.name} · 배가 무거워진다 · 회피 −${P.anchorLoss} (로프 끊기로 푼다)`}}
    if(pv==='lkTide'){if(E.atk0==null)E.atk0=E.atk;const up=Math.min(E.passive.cap,(C.round-1)+Math.floor((P.bleed||0)/E.passive.per));E.atk=E.atk0+up;if(up>0)C.jobNote=(C.jobNote?C.jobNote+' · ':'')+`${E.name} · 피 냄새에 달아오른다 · 공격 +${up}`}
    if(pv==='obey'){P.obey=Math.min(CFG.hw.obey.cap,(P.obey||0)+CFG.hw.obey.gain);C.jobNote=(C.jobNote?C.jobNote+' · ':'')+`${E.name} · 공허한 순종 ${P.obey}`}
    E.maskOn=pv==='mask'&&C.round%E.passive.every===0;
    /* 카세티(혈귀): 체력이 hp 비율 아래로 처음 내려가면 피할 수 없는 광역 출혈을 걸고 체력을 회복한다 */
    if(pv==='kas'&&!E.kasDone&&E.hp>0&&E.hp<=E.maxHp*E.passive.hp){E.kasDone=true;P.bleed=Math.min(bleedCap(P),(P.bleed||0)+E.passive.bleed);const hl=Math.round(E.maxHp*E.passive.heal);E.hp=Math.min(E.maxHp,E.hp+hl);
      if(!C.quiet){const m={t:'kw',s:`${E.name} · ${E.passive.n} · 피할 수 없는 광역 출혈 · ${P.name} 출혈 +${E.passive.bleed} (지금 ${P.bleed}) · ${E.name} 체력 +${hl}`};C.log.push(m);C.cur.push(m)}}
    /* 에고 개방(붉은 안개 · 칼리): HP가 at 이하가 되면 공격 +atk · 회피 −eva · 피해 +dmgB · 받는 피해 −dr%, 이름이 바뀐다 (보스 전용, 전투당 한 번). 개방 직후 K.card를 이번 라운드에 한 번 쓴다 */
    {const K=E.kali;if(K&&!E.kaliOn&&E.hp>0&&E.hp<=E.maxHp*K.at){E.kaliOn=true;E.atk+=K.atk;E.light+=K.light||0;{const kc=!C.ch.hard&&K.cardN?K.cardN:K.card;if(kc&&D.cards[kc])E.forceNext=kc}E.eva-=K.eva;E.name=K.name;
      const m={t:'kw',s:`${K.name} · 에고 개방 · 공격 +${K.atk} · 회피 −${K.eva} · 피해 +${K.dmgB} · 받는 피해 −${K.dr}%`};if(!C.quiet){C.log.push(m);C.cur.push(m)}}}
    if(pv==='kin'&&C.round>1&&d(100)<=E.passive.chance){P.angry=E.passive.anger;{const m={t:'kw',s:`중지의 아우가 얻어맞았다 · 분노 · 다음 적중 +${E.passive.anger}`};if(!C.quiet){C.log.push(m);C.cur.push(m)}}}
    if(pv==='stance'){const st=Math.floor((C.round-1)/E.passive.every)%2===0?'bear':'tiger';if(E.sal==null)E.sal=5;
      if(E.stance!==st){E.stance=st;E.deck=E.passive.decks[st];if(!C.quiet){const m={t:'kw',s:`${E.name} · 본국태세 · ${st==='bear'?'곰 사냥 (강한 일격 · 살이 높을수록 강하다)':'범 사냥 (연격 · 살이 낮을수록 강하다)'}`};C.log.push(m);C.cur.push(m)}}}
    /* 보라눈물: 참격 · 관통 · 타격 · 방어 네 태세를 every라운드마다 돌아가며 바꾼다. 방어 태세에서는 상태 이상에 걸리지 않고, leapEvery라운드마다 평행세계로 도약해 첫 공격을 피한다 */
    if(pv==='forms'){const F=E.passive,st=F.order[Math.floor((C.round-1)/F.every)%F.order.length];
      if(E.stance!==st){E.stance=st;E.deck=F.decks[st];E.formImmune=st==='guard';if(!C.quiet){const m={t:'kw',s:`${E.name} · ${F.names[st]}${st==='guard'?' · 상태 이상에 걸리지 않는다':''}`};C.log.push(m);C.cur.push(m)}}
      if(C.round%F.leapEvery===0){E.leap=true;if(!C.quiet){const m={t:'kw',s:`${E.name} · 평행세계 도약 · 이번 라운드 첫 공격은 닿지 않는다`};C.log.push(m);C.cur.push(m)}}}
    P.locked=pv==='lock'&&C.round%E.passive.every===0?d(P.hand.length)-1:-1;
    C.order=P.tot>=E.tot?[P,E]:[E,P];
    /* 히든 직업 패시브: 발톱 질주(빛), 조율자 봉인(적 공격 카드 1장) */
    const jp=P.jobPassive;C.jobNote=null;
    if(jp&&jp.id==='rush'&&C.round%jp.every===0){P.light+=jp.light;C.jobNote=`${P.name} · ${jp.n} · 이번 라운드 빛 +${jp.light}`}
    /* 적은 라운드 시작 때 낼 카드를 정한다 (화면에 의도로 공개) */
    /* 라운드마다 HP 회복 (전리품·장비 효과) */
    if(P.regen>0&&P.hp>0&&P.hp<P.maxHp){const h=Math.min(P.regen,P.maxHp-P.hp);P.hp+=h;HG(P,h);C.jobNote=(C.jobNote?C.jobNote+' · ':'')+`${P.name} · 회복 · HP +${h}`}
    /* 기업 루트 혈청: 라운드가 시작될 때마다 HP 회복 */
    if(P.hwHeal&&P.hp>0&&P.hp<P.maxHp){const h=Math.min(P.hwHeal,P.maxHp-P.hp);P.hp+=h;HG(P,h);C.jobNote=(C.jobNote?C.jobNote+' · ':'')+`${P.name} · ${CFG.hw.dan.name} · HP +${h}`}
    if(P.singHeal&&P.hp>0&&P.hp<P.maxHp){const h=Math.min(P.singHeal,P.maxHp-P.hp);P.hp+=h;HG(P,h);C.jobNote=(C.jobNote?C.jobNote+' · ':'')+`${P.name} · 혈청 · HP +${h}`}
    C.ePlan=aiPlan(C);
    if(E.stunRound===C.round){E.stunned=true;for(const c of C.ePlan)if(c.next){E.forceNext=c.next;break}C.ePlan=[];C.jobNote=(C.jobNote?C.jobNote+' · ':'')+`${E.name} · 흐트러짐 · 이번 라운드 기절 (행동 불가 · 회피 0)`}else{E.stunned=false}
    /* 적 특성: 무리(공격 카드 한 장 더), 재생(HP 3 회복) */
    /* 홍루: 내 부하가 많을수록 따르는 흑수가 한 사람씩 더 덤벼든다 (연계는 이어지지 않는 단발) */
    if(E.zExtra&&E.zChain&&!E.stunned&&E.hp>0&&C.ePlan.length&&C.round%CFG.hw.zExtraEvery===0){const base=C.ePlan[0],cur=Object.keys(D.cards).find(k=>D.cards[k]===base)||'',ci=E.zChain.indexOf(cur.replace(/^zp?_/,''));for(let j=1;j<=E.zExtra;j++){const k=E.zChain[(Math.max(ci,0)+j*3)%E.zChain.length],c=D.cards['z_'+k];if(c)C.ePlan.push(Object.assign({},c,{next:null}))}}
    if(E.trait==='swarm'){const a=E.deck.map(id=>D.cards[id]).find(c=>c.t==='atk');if(a)C.ePlan.push(a)}
    if(E.trait==='bulwark'&&E.hp>0){E.shield=Math.max(E.shield||0,3)}
    if(E.trait==='focus'&&E.hp>0){E.breath=Math.min(CFG.breath.cap,E.breath+2)}
    if(E.trait==='regen'&&E.hp>0&&E.hp<E.maxHp){const h=Math.min(3,E.maxHp-E.hp);E.hp+=h;C.traitNote=`${E.name} · 재생 · HP +${h}`}else C.traitNote=null;
    if(jp&&jp.id==='seal'&&C.round%Math.max(2,jp.every-((C.ch&&C.ch.auth)||[]).filter(a=>a==='seal').length)===0){const i=C.ePlan.findIndex(c=>c.t==='atk');if(i>=0){const c=C.ePlan.splice(i,1)[0];if(c.next)E.forceNext=c.next;C.jobNote=`${P.name} · ${jp.n} · ${E.name}의 ${c.n}을(를) 봉인했다`}}
  }
  /* 이번 라운드 발동 순서: 방어 카드 먼저(순서대로), 그다음 공격·버프를 순서대로 한 장씩 번갈아 */
  function queue(C,pp,ep){
    const plays={P:pp,E:ep},out=[];
    for(const X of C.order)for(const c of plays[X.uid])if(c.t==='def')out.push({side:X.uid,card:c});
    const q={P:pp.filter(c=>c.t!=='def'),E:ep.filter(c=>c.t!=='def')};
    const n=Math.max(q.P.length,q.E.length);
    for(let i=0;i<n;i++)for(const X of C.order)if(q[X.uid][i])out.push({side:X.uid,card:q[X.uid][i]});
    return out;
  }
  /* 카드 코스트: 환영난무처럼 vtCost 카드는 뱀의 장벽을 쓴 만큼(최대 serpent.max) 싸진다 */
  const cardCost=(X,c)=>c.vtCost?Math.max(0,c.c-Math.min(CFG.serpent.max,(X&&X.vtStack)||0)):c.c;
  function autoPlay(hand,light,X){
    const plays=[];let l=light;
    for(const id of sample(hand,hand.length)){const c=D.cards[id],cc=cardCost(X,c);if(cc<=l){plays.push(c);l-=cc}}
    return plays;
  }
  /* 자동 전투용 카드 선택: 빛 안에서 점수 합이 가장 큰 조합(손패 4장이라 모든 조합을 본다).
     점수 = 기대 피해(타수 × (주사위 × 3.5 + 고정값)) + 키워드 스택 × 2. 방어 카드는 HP가 35% 미만일 때만 높게 친다.
     반환: 손패 번호 배열 (방어 → 점수 높은 순) */
  /* 보랏빛 사복검의 자세: 전투 중 라운드마다 한 번 공격 · 수비 · 찌르기 · 타격 중 하나를 고른다 (카드를 고르기 전에).
     고르면 손패의 전용 책장 카드가 그 자세의 카드로 바뀌고, 무기도 그 자세의 모습이 된다. 하나 협회의 괘와는 따로 고른다 */
  const formOk=C=>!!(C&&C.P&&C.P.wx&&C.P.wx.forms&&!C.over&&!C.P.distorted);
  const formId=(id,f)=>{const m=/^x_vs_[adps]([1-4])$/.exec(id||'');return m?`x_vs_${f}${m[1]}`:id};
  function applyForm(C,f){
    const P=C.P;P.form=f;P.hand=P.hand.map(id=>formId(id,f));
  }
  function setForm(C,f){
    const T_=CFG.form;
    if(!formOk(C)||C.formRound===C.round||!T_.names[f])return false;
    C.formRound=C.round;const was=C.P.form;applyForm(C,f);
    if(f==='d')C.P.triCut=Math.max(C.P.triCut||0,T_.defCut);
    C.formNote=`${C.P.name} · ${T_.names[f]} · ${T_.weapon[f]}${was&&was!==f?` (${T_.names[was]}에서 바뀐다)`:''}`;return true;
  }
  /* 자동 전투: 다치면 수비, 상대에게 상태 이상이 있으면 찌르기, 흐트러졌으면 타격, 아니면 공격 */
  function autoForm(C){
    if(!formOk(C)||C.formRound===C.round)return;const P=C.P,B=C.E,st=(B.bleed||0)+(B.rupture||0)+(B.burn||0);
    const f=P.hp<=P.maxHp*0.4?'d':st>=3?'p':(B.stagger||0)>=2?'s':'a';setForm(C,f)}
  /* 하나 협회 패시브: 라운드마다 한 번 고른다 (카드를 고르기 전에) */
  const triOk=C=>!!(C&&C.ch&&assocOf(C.ch)===CFG.tri.org&&!C.over&&!C.P.distorted);
  function setTri(C,k){
    const T_=CFG.tri,P=C.P;
    if(!triOk(C)||C.triRound===C.round||!T_.names[k]||C.triPrev===k)return false;
    C.triRound=C.round;C.tri=k;C.triPrev=k;let t;
    if(k==='gun'){P.triDmg=T_.gun;t=`공격 피해 +${T_.gun}`}
    else if(k==='gon'){P.triCut=T_.gon;t=`받는 피해 −${T_.gon}%`}
    else if(k==='gam'){P.light+=T_.gam;t=`빛 +${T_.gam}`}
    else{const h=Math.min(T_.ri.heal,P.maxHp-P.hp);P.hp+=h;HG(P,h);C.ch.hp=P.hp;const b=Math.min(T_.ri.breath,CFG.breath.cap-P.breath);P.breath+=Math.max(0,b);t=`HP +${h} · ${D.keywords.breath.n} +${Math.max(0,b)}`}
    C.triNote=`${P.name} · ${T_.names[k]} · ${t}`;return true;
  }
  /* 자동 전투: 다치면 이, 아니면 건 */
  function autoTri(C){if(!triOk(C)||C.triRound===C.round)return;const want=C.P.hp<=C.P.maxHp*0.6?['ri','gon','gun']:['gun','gon','ri'];setTri(C,want.find(k=>k!==C.triPrev))}
  function autoPick(C){autoTri(C);autoForm(C);
    const P=C.P,low=P.hp/P.maxHp<0.35;
    const bad=P.bleed+P.rupture+(P.burn||0)+(P.flame||0),score=c=>c.t==='def'?(low?8:c.selfHit?4:0.5):c.t==='buff'?(c.kw||[]).reduce((a,k)=>a+k[1]*1.5,0)+(c.shield||0)*0.5+(c.passNext||0)*0.4+(c.gain||0)*2-(c.hpCost||0)*0.3+(c.inkCall?9:0)+(c.heal&&P.hp/P.maxHp<0.75?c.heal*0.8:0)+(c.cleanseRand&&bad>0?c.cleanseRand*1.2:0)
      :c.hits*(c.dice*((c.die||6)+1)/2+c.b+(P.yeji&&BONA.has(c)?CFG.odin.yeji:0)+(P.bonB&&BONA.has(c)?P.bonB:0))+(c.kw||[]).reduce((a,k)=>a+k[1]*2,0)+c.hit*0.05+(c.spend?Math.min(P.charge||0,c.spend)*(c.fixPer||0)*c.hits:0)+(P.oracle&&P.starId&&c===D.cards[P.starId]?30:0)+(c.nailBurst&&C.E.nail>=Math.min(5,nailThr(C)-(C.E.stagger||0))?(C.E.nail||0)*2*c.nailBurst.mul+(c.nailBurst.add||0):0);
    let best=[],bs=-1;
    for(let m=1;m<1<<P.hand.length;m++){
      const idx=P.hand.map((_,i)=>i).filter(i=>m>>i&1);
      if(idx.includes(P.locked))continue;
      if(idx.some(i=>D.cards[P.hand[i]].noKill))continue;   // 자동 전투는 '해치고 싶지 않다'를 스스로 쓰지 않는다
      if(idx.some(i=>(D.cards[P.hand[i]].needBlack&&!P.black)||(D.cards[P.hand[i]].needLow&&C.E.hp>C.E.maxHp*CFG.raven.low)))continue;
      if(idx.reduce((a,i)=>a+cardCost(P,D.cards[P.hand[i]]),0)>P.light)continue;
      const sc=idx.reduce((a,i)=>a+score(D.cards[P.hand[i]])+0.01,0);
      if(sc>bs){bs=sc;best=idx}
    }
    return best.sort((a,b)=>(D.cards[P.hand[b]].t==='def')-(D.cards[P.hand[a]].t==='def')||score(D.cards[P.hand[b]])-score(D.cards[P.hand[a]]));
  }
  /* 적의 카드 선택. 방어 카드는 CFG.enemyGuard.chance% 확률로만 손에 남기고, 직전 라운드에 썼으면 이번엔 쓰지 않는다 */
  const cardId=new Map(Object.entries(D.cards).map(([k,v])=>[v,k]));
  function aiPlan(C){
    const G_=CFG.enemyGuard,E=C.E;
    /* 연계 카드: 직전 라운드에 쓴 카드가 다음 카드를 열면 그 카드 하나만 낸다 (빛 무시) */
    if(E.forceNext){const id=E.forceNext;E.forceNext=null;return [D.cards[id]]}
    let hand=drawHand(E.deck,CFG.hand);
    /* 연속 사용 불가(noRepeat): 직전 라운드에 낸 카드는 이번에 손에서 뺀다 (다른 카드가 하나라도 있을 때만) */
    {const last=E.lastIds||[],f=hand.filter(id=>!(D.cards[id].noRepeat&&last.includes(id)));if(f.length)hand=f}
    const noGuard=E.lastGuard===C.round-1||d(100)>G_.chance;
    if(noGuard&&hand.some(id=>D.cards[id].t!=='def'))hand=hand.filter(id=>D.cards[id].t!=='def');
    const plan=autoPlay(hand,E.light,E);
    E.lastIds=plan.map(c=>cardId.get(c)).filter(Boolean);
    if(plan.some(c=>c.t==='def'))E.lastGuard=C.round;
    return plan;
  }
  /* 호흡 → 치명 확률(%) */
  const critPct=b=>{const H=CFG.breath;return b>=H.sure?100:b>=H.from?Math.min(90,H.base+(b-H.from)*H.step):0};
  const cutStacks=A=>{const F=CFG.defCut;if(A.bleed>0)A.bleed=Math.floor(A.bleed*F.bleed);if(A.rupture>0)A.rupture=Math.floor(A.rupture*F.rupture)};
  /* N사 날개 · 못과 흐트러짐: 적중할 때마다 상대에게 못이 쌓이고(의체 적은 더 많이), 3·4코스트 망치 카드가 못을 모두 흐트러짐으로 바꾼다.
     흐트러짐은 단계마다 상대의 명중·피해를 깎고, 한계(적 등급별)에 닿으면 다음 라운드 한 번 기절한다 (행동 불가 · 회피 0). 기절이 끝나면 흐트러짐이 0이 되고 잠시 면역 */
  const nailThr=C=>{const e=D.enemies[C.id];return CFG.nail.stun[e.hidden?'hidden':e.tier]||CFG.nail.stun.mid};
  const staggerStage=X=>{let st=null;for(const g of CFG.nail.stages)if((X.stagger||0)>=g.at)st=g;return st};
  function addStagger(C,B,n,L){
    if(n<=0||B.stunned||B.formImmune)return;
    B.stagger=Math.min(CFG.nail.staggerCap,(B.stagger||0)+n);const thr=nailThr(C);
    L('kw',`  ${B.name}에게 흐트러짐 +${n} (지금 ${B.stagger}/${thr})`);
    if(B.stagger>=thr&&C.round>=(B.stunImmune||0)&&B.stunRound!==C.round+1){B.stunRound=C.round+1;L('kw',`  ${B.name} · 흐트러짐의 한계 · 다음 라운드 기절`)}
  }
  /* 레바테인 봉인: 붉은 화염을 건 횟수(무기 적중·카드 모두)가 쌓이면 해방 (전투가 끝나도 유지) */
  function laevGear(st){
    const O=D.relics.laev.open,f=st.f,atk=Math.round(O.fx.atk*f),dd=Math.max(6,Math.round(O.wx.dice[1]*f));
    const g=Object.assign({},O,{id:st.id,grade:5,n:`레바테인 (${st.n})`});
    g.fx={atk,burnHit:1};g.wx={dice:[1,dd]};
    g.e=`${st.n} · 공+${atk} · 피해 1d${dd}${f>=0.5?` · 상대의 붉은 화염이 곧바로 푸른 화염으로 (받는 피해 ×${(1+(CFG.laev.blueMul-1)*f).toFixed(2).replace(/\.?0+$/,'')}, 라운드마다 스택×${Math.max(1,Math.round(CFG.laev.blueDot*f))} 피해) · 전투 시작 때 자신에게 붉은 화염 1, 매 라운드 +1 · 자신이 푸른 화염이면 명중 −${Math.round(CFG.laev.selfBlueHit*f)}`:' · 적중 시 붉은 화염 1'}`;
    return g;
  }
  function laevCount(A,n,L){
    const C=activeC;if(!C||!A.laev||!A.isP||A.laevF>=1)return;
    const ch=C.ch,S=CFG.laev.stages;ch.laevN=(ch.laevN||0)+n;
    let k=-1;for(let i=0;i<S.length;i++)if(ch.laevN>=S[i].at)k=i;
    const cur=A.laevF>=0.5?1:A.laevF>=0.25?0:-1;
    if(k>cur){const st=S[k],g=st.f>=1?Object.assign({id:'laev',grade:5},D.relics.laev.open):laevGear(st),old=ch.gear.weapon;
      /* 단계가 올라 새 무기로 바뀌어도 공방 정비(공격·회피 강화)와 정비 횟수는 이어진다 */
      if(old&&(old.tune||old.tries)){g.fx=Object.assign({},g.fx);for(const [k,v] of Object.entries(old.tune||{}))g.fx[k]=(g.fx[k]||0)+v;g.tune=Object.assign({},old.tune);g.tries=old.tries||0}
      A.atk+=g.fx.atk-((old&&old.fx.atk)||0);A.wx=g.wx;A.laev=st.f>=0.5?'open':'sealed';A.laevF=st.f;
      equip(ch,g);ch.stash=(ch.stash||[]).filter(x=>!['laev_sealed','laev_s1','laev_s2'].includes(x.id));
      L('sys',`  봉인이 풀린다 · 레바테인 ${st.n} (공+${g.fx.atk}, 피해 1d${g.wx.dice[1]}${st.f>=0.5?', 상대의 붉은 화염은 푸른 화염으로':''})`)}
    else{const nx=S.find(x=>ch.laevN<x.at);if(nx)L('kw',`  레바테인 ${ch.laevN}/${nx.at} · 다음 ${nx.n}`)}
  }
  /* 흑운회 구름: 출혈을 걸거나 맞을 때마다 +1, max에 닿으면 흑운 (라운드 끝에 reset로 돌아온다) */
  function addCloud(X,L){
    if(X.black)return;const k=CFG.syn['흑운회'];X.cloud=(X.cloud||0)+1;
    if(X.cloud>=k.max){X.cloud=0;X.black=true;L('kw',`  ${X.name} · 구름이 ${k.max}가 되었다 · 흑운 · 주사위마다 +${k.die} · 적중 시 출혈 +${k.bleedPlus}${X.synT>=3?' · 받는 피해 ×'+k.half:''}`)}
    else L('kw',`  ${X.name} · 구름 ${X.cloud}/${k.max}`)
  }
  function applyKw(A,D_,c,L){
    for(let [k,n,to] of (c.kw||[])){
      if(A.distorted&&to!=='s')continue;
      const X=to==='s'?A:D_;
      if(X.formImmune&&X!==A)continue;
      if(k==='burn'&&!A.isP&&to!=='s')n=Math.max(1,Math.floor(n*CFG.burn.foe));
      if(k==='burn'&&to!=='s'&&A.wx&&A.wx.burnPlus)n+=A.wx.burnPlus;
      if(A.kwPlus&&to!=='s'&&(k==='bleed'||k==='burn'||k==='rupture'||k==='stagger'||k==='sink'||k==='nail'))n+=A.kwPlus;
      const cap_=k==='breath'?CFG.breath.cap:k==='charge'?X.chargeCap:k==='burn'?Math.round(CFG.burn.max*((to!=='s'&&A.wx&&A.wx.burnCap)||1)):k==='ink'?CFG.ink.cap+(A.wx&&A.wx.inkCap||0):k==='rupture'?CFG.rupture.max:k==='nail'?CFG.nail.cap:k==='harpoon'?CFG.harpoon.cap:k==='bleed'?bleedCap(X):CFG.stackCap,b4_=X[k]||0;
      X[k]=Math.min(cap_,b4_+n);
      {const R_=RS_;const gn_=X[k]-b4_;if(R_&&gn_>0){if(A.isP){if(to==='s')R_.buff=(R_.buff||0)+gn_;else R_.debuff=(R_.debuff||0)+gn_}else if(X.isP&&to!=='s')R_.debuffTaken=(R_.debuffTaken||0)+gn_}}
      L('kw',`  ${X.name}에게 ${D.keywords[k].n} +${n} (지금 ${X[k]}/${cap_}${b4_+n>cap_?` · 최대치라 실제 +${X[k]-b4_}`:''})`);
      if(k==='bleed'&&to!=='s'&&A.kuro)addCloud(A,L);
    }
  }
  /* 발톱 전용 키워드 · 혈청: 혈청 카드를 낼 때마다 1 (최대 3). 3이면 다음 적중 피해 ×1.5 후 비움 */
  function addSerum(A,c,L){A.serum=Math.min(3,(A.serum||0)+c.serum);L('kw',`  ${A.name} · 혈청 ${A.serum}/3${A.serum>=3?' · 과부하 준비':''}`)}
  /* 다음 라운드 손패에 넣어 줄 카드. 같은 때에 여러 장이 겹치면 한 라운드에 최대 2장(grantNext + 줄 한 칸)까지 받고, 더 겹친 것은 다음 라운드(grantWait)로 넘어간다 (예: 붉은 안개 개방의 대절단 가로 + 수호 개화) */
  function giveNext(A,id){if(!id)return;if(!A.grantNext)A.grantNext=id;else if(!A.grantQ||A.grantQ.length<1)A.grantQ=[id];else(A.grantWait=A.grantWait||[]).push(id)}
  function act(C,A,c,L,push){
    const B=A===C.P?C.E:C.P;
    if(c.noKill){if(A.noKill){L('sys',`${A.name} · ${c.n} · 이미 그런 마음이다`);return}A.noKill=true;A.eva-=80;A.takenMul=2;L('kw',`${A.name} · ${c.n} · 이번 전투 동안 받는 피해 2배 · 회피 −80`);return}
    if(c.flesh){A.evaB-=30;A.fleshRound=C.round;L('kw',`${A.name} · ${c.n} · 이번 라운드 회피 −30`)}
    if(c.cloudGain&&A.kuro)for(let i=0;i<c.cloudGain;i++)addCloud(A,L);
    if(c.needBlack&&!A.black){L('sys',`${A.name} · ${c.n} · 흑운이 아니면 쓸 수 없다 · 불발`);return}
    if(c.inkCall){const ids=A.inkIds||[];if(!ids.length){L('sys',`${A.name} · ${c.n} · 곁에 흑수가 없다 · 불발`);return}if(A.obey>0){A.obey=0;L('kw',`${A.name} · 공허한 순종이 모두 풀렸다`)}L('kw',`${A.name} · ${c.n} · 곁의 흑수 ${ids.length}명이 모두 나선다`);for(const id of ids){if(B.hp<=0)break;act(C,A,D.cards[id],L,push)}return}
    if(c.ropeCut&&(A.harpoon||0)>0){L('kw',`  ${A.name} · ${c.n} · 작살 ${A.harpoon}개를 끊어 냈다`);A.harpoon=0}
    if(c.ropeCut&&(A.anchorLoss||0)>0){A.eva+=A.anchorLoss;L('kw',`  ${A.name} · ${c.n} · 무게를 덜어 회피 +${A.anchorLoss}`);A.anchorLoss=0}
    if(c.needLow&&B.hp>B.maxHp*CFG.raven.low){L('sys',`${A.name} · ${c.n} · 상대 HP가 ${Math.round(CFG.raven.low*100)}% 이하여야 쓸 수 있다 · 불발`);return}
    if(c.t==='buff'&&(c.heal||c.passNext||c.debuffHit||c.cleanseRand)){
      if(c.cleanseRand){const ks=['bleed','rupture','burn','flame'].filter(k=>(A[k]||0)>0);if(ks.length){const k=ks[d(ks.length)-1],n0=A[k];A[k]=Math.max(0,n0-c.cleanseRand);L('kw',`  ${A.name} · ${c.n} · ${D.keywords[k].n} ${n0} → ${A[k]}`)}}
      if(c.heal){const h=Math.min(c.heal,A.maxHp-A.hp);A.hp+=h;HG(A,h);L('kw',`${A.name} · ${c.n} · HP +${h}`)}
      if(c.passNext){A.passHitNext=(A.passHitNext||0)+c.passNext;L('kw',`  ${A.name} · 다음 라운드 명중 ${sg(c.passNext)}`)}
      if(c.debuffHit){B.passHitNext=(B.passHitNext||0)+c.debuffHit;L('kw',`  ${B.name} · 다음 라운드 명중 ${sg(c.debuffHit)} (1라운드)`)}
    }
    if(c.t==='buff'){if(c.serum)addSerum(A,c,L);if(c.shield)A.shield=Math.min(CFG.shieldCap,(A.shield||0)+c.shield+(A.prescPlus||0)+(A.isP&&A.cg?5*CFG.cardGrade.indexOf(A.cg):0));L('sys',`${A.name} · ${c.n} (버프)${c.gain?` · 빛 +${c.gain}`:''}${c.shield?` · 보호막 ${A.shield}`:''}`);applyKw(A,B,c,L);push({k:'buff',side:A.uid,card:c});return}
    let hits=c.hits+(c.t==='atk'&&A.wx&&A.wx.extraHit?A.wx.extraHit:0);
    /* 창세치 고래 심장: 3타마다 1타 추가. 추가타는 다음 3타 세기에 들어가지 않는다 */
    if(A.isP&&A.lk&&A.lk.genesis&&c.t==='atk'){const b3=c.hits;A.h3=A.h3||0;const ex=Math.floor((A.h3+b3)/3)-Math.floor(A.h3/3);A.h3+=b3;if(ex>0){hits+=ex;L('kw',`  ${A.name} · 창세치 고래 심장 · 추가타 +${ex}`)}}
    /* 가속: 라운드마다 처음 공격할 때 1스택 (전투당 최대 3) */
    /* 엄지 패시브 탄환: 공격 카드마다 1발 소모 · 상대에게 '예의를 지킬 것' 1 (상대 명중 −1×스택) */
    if(c.t==='atk'&&A.thumb&&!A.distorted&&CFG.thumbRefund>0&&A.ammo<=0&&A.ammoRound!==C.round){A.ammoRound=C.round;A.ammo=CFG.thumbRefund;L('kw',`${A.name} · 탄환 ${CFG.thumbRefund}발 되돌아온다 (이번 라운드 한 번)`)}
    if(c.t==='atk'&&A.thumb&&A.ammo>0&&!A.distorted){A.ammo--;B.manner=Math.min(CFG.thumbMannerMax,(B.manner||0)+1);B.mannerPer=thumbPer(A);L('kw',`${A.name} · 탄환 1발 (남은 ${A.ammo}) · ${B.name}에게 예의를 지킬 것 ${B.manner} (명중 −${Math.floor(B.manner*B.mannerPer)})`)}
    if(c.t==='atk'&&c.serum)addSerum(A,c,L);
    if(c.t==='atk'&&A.wx&&A.wx.accel&&A.accRound!==C.round&&(A.accel||0)<A.wx.accel.max){A.accRound=C.round;A.accel=(A.accel||0)+1;L('kw',`${A.name} · 가속 ${A.accel}/${A.wx.accel.max} (명중·회피 +${A.accel*A.wx.accel.hit})`)}
    for(let h=0;h<hits;h++){
      if(A.hp<=0||B.hp<=0)return;
      /* 출혈: 공격할 때마다(명중 여부 무관) 스택만큼 피해, 그 뒤 1 감소 */
      if(A.bleed>0){
        const wm=(A.wspear||0)>0?Math.pow(A.wspearMul||1.2,A.wspear):1,bd=Math.round(A.bleed*wm);hpLoss(C,A,bd,L);A.bleed--;
        L('dmg',`${A.name} ${D.keywords.bleed.n} ${bd} 피해 (공격하며 상처가 벌어진다)${wm>1?` · ${D.keywords.wspear.n} ${A.wspear}개 ×${(Math.round(wm*100)/100)}`:''}`);
        push({k:'bleed',side:A.uid,dmg:bd});
        /* 혈귀 패시브 혈찬: 상대의 출혈이 5번 발동할 때마다 HP 15 회복 */
        if(B.hyeolchan){B.hc=(B.hc||0)+1;if(B.hc>=5){B.hc-=5;if(B.hp>0){const h=hcHeal(B);B.hp+=h;HG(B,h);L('kw',`  ${B.name} · 혈찬 · HP +${h}`)}}}
        if(A.hp<=0)return;
      }
      /* 명중: 1d100 + 공격 + 카드 보정 > 상대 1d100 + 회피 (동점은 방어 성공). 두 번 굴림이면 높은 값 */
      let ra=d(100),ra2=0,pnote='';
      /* 앙갚음 장부: 3스택이면 이번 명중 굴림은 1d110, 스택 소모 */
      if(A.passive&&A.passive.id==='ledger'&&(A.ledger||0)>=A.passive.need){ra=d(110);A.ledger=0;pnote=` ${A.passive.n}(1d110)`}
      /* 장비 두 번 굴림: adv 1 이상이면 라운드 첫 공격마다, 1 미만이면 그 확률로 */
      if(c.adv||(A.adv&&!A.advUsed&&(A.adv>=1||d(100)<=A.adv*100))){ra2=d(c.adv?100:(A.advDie||100));if(ra2>ra)[ra,ra2]=[ra2,ra]}
      A.advUsed=true;
      /* 회피 주사위: 적은 단계별 크기(CFG.enemyEvadeDie), 플레이어는 1d100 */
      const rdMax=B.isP?100:(D.enemies[C.id].evadeDie||CFG.enemyEvadeDie[D.enemies[C.id].tier]||100),rd=d(rdMax);
      const fsb=A.fs?CFG.firstHit:0;A.fs=false;
      /* 검은 침묵의 장갑: 공격마다 1d9로 무기가 바뀐다 */
      let sub=null;
      if(A.wx&&A.wx.arsenal){const i=d(A.wx.arsenal.length);sub=A.wx.arsenal[i-1];(C.ars=C.ars||[]);if(!C.ars.includes(i))C.ars.push(i);pnote+=` 장갑 1d9 ${i}·${sub.n}`}
      const gr=A.isP&&A.cg&&c.t==='atk'?A.cg:null;
      const acA=A.wx&&A.wx.accel?(A.accel||0)*A.wx.accel.hit:0,acB=B.wx&&B.wx.accel?(B.accel||0)*B.wx.accel.eva:0;
      const trH=(A.trait==='bloodscent'&&B.bleed>0?15:0)+(A.trait==='enrage'&&A.hp<=A.maxHp/2?15:0),trE=B.trait==='coward'&&B.hp<=B.maxHp/2?20:0;
      const exH=(c.execHit&&(B.disp||0)>0?c.execHit:0)+trH;if(exH)pnote+=` 처분 표식 명중+${exH}`;
      let am=(CFG.atkRule.on?Math.trunc(A.atk*CFG.atkRule.hitPer)+(A.hitB||0):A.atk)+(!A.isP&&C.ally?CFG.bond.allyHit:0)+(A.awl&&B.bleed>0?CFG.syn['밤의 송곳'].bleedHit:0)+c.hit+exH-Math.floor((A.manner||0)*(A.mannerPer||thumbPer(B)))-(A.obey||0)*CFG.hw.obey.hit+(gr?gr.hit:0)+fsb+Math.min(CFG.spdHit.max,Math.max(0,Math.floor((A.spd-B.spd)/CFG.spdHit.per)))+A.passHit+acA+(A.wx&&A.wx.hitB||0)+(A.ring?CFG.ring.hit*A.work:0)+(sub?sub.atk:0)-3*(A.prescript||0)-Math.floor((B.middle?CFG.middle.sinkHit:1)*CFG.sink.hit*Math.floor((A.sink||0)/CFG.sink.per))-((staggerStage(A)||{}).hit||0)-(A.isP&&A.laev==='open'&&isBlue(A)?Math.round(CFG.laev.selfBlueHit*(A.laevF||1)):0),dm=B.eva+B.evaB-(B.evaPen||0)+(B.breath>=1&&B.breath<=CFG.breath.evaMax?CFG.breath.eva:0)+acB+trE-3*(B.shock||0)-2*((B.chain||0)+(B.web||0))+(B.maskOn?B.passive.eva:0)+(B.odin?odinEva(C.round,B):0);
      if(A.sm&&A.sm.rings)am+=A.sm.rings*CFG.shinmang.ringHit;
      if(A.cb&&A.cb.k==='hit'&&A.hp>=A.maxHp*CFG.colorBuff.hpMin)am+=A.cb.v;
      if(B.cb&&B.cb.k==='eva'&&B.hp>=B.maxHp*CFG.colorBuff.hpMin)dm+=B.cb.v;
      if(B.augPas==='react'&&C.round<=2)dm+=10;
      if(A.rv){const RV=CFG.raven;
        if(A.rv.t>=1&&!RV.buffs.some(k=>(B[k]||0)>0)){am+=RV.hit;pnote+=` 까마귀의 눈 · 버프 없음 명중+${RV.hit}`}
        if(A.rv.t>=3&&B.hp<=B.maxHp*RV.exec){dm=0;B.guarding=false;if(A.rvRound!==C.round){A.rvRound=C.round;L('kw',`${A.name} · 처형 인가 · ${B.name}은(는) 방어 자세를 취할 수 없고 회피가 0이다`)}}}
      if(B.stunned)dm=0;
      if(B.leap&&!B.stunned){dm+=9999;B.leap=false;L('kw',`  ${B.name} · 평행세계로 도약 · 공격이 허공을 지난다`)}
      /* 중지: 서열이 오를수록 회피의 '피하는 힘'이 줄어든다(evaEff). 줄어든 만큼은 받는 피해 감소로 돌려준다 */
      if(B.middle&&B.isP&&B.midEff<1&&!B.stunned)dm-=Math.floor(Math.max(0,B.eva+B.evaB-(B.evaPen||0)+(B.odin?Math.max(0,odinEva(C.round,B)):0))*(1-B.midEff));
      {const ev_=Math.max(0,B.eva+B.evaB-(B.evaPen||0));if(c.ignoreEva)dm-=ev_;else if(A.awl&&A.lead)dm-=Math.floor(ev_/2)}
      const sa=sub&&sub.sure?Math.max(ra+am,rd+dm+1):ra+am,sd=rd+dm,G_=CFG.guard;
      /* 판정에 더해지거나 깎인 요소를 하나씩 눈 아래에 보여 준다. 알려진 요소를 뺀 나머지는 '그 밖'으로 묶어 합계가 항상 맞는다 */
      const amL=[],dmL=[];{
        const atkP=CFG.atkRule.on?Math.trunc(A.atk*CFG.atkRule.hitPer)+(A.hitB||0):A.atk,spdP=Math.min(CFG.spdHit.max,Math.max(0,Math.floor((A.spd-B.spd)/CFG.spdHit.per))),wpP=(A.wx&&A.wx.hitB)||0;
        const sk=Math.floor((B.middle?CFG.middle.sinkHit:1)*CFG.sink.hit*Math.floor((A.sink||0)/CFG.sink.per)),pr=3*(A.prescript||0),mn=Math.floor((A.manner||0)*(A.mannerPer||thumbPer(B))),ob=(A.obey||0)*CFG.hw.obey.hit,sgP=((staggerStage(A)||{}).hit||0);
        const ps=[['공격',atkP],['카드',c.hit],['선공',fsb],['속도 우위',spdP],['무기',wpP],['가속',acA],['그 자세',A.passHit||0],['표식·노림',exH+(A.awl&&B.bleed>0?CFG.syn['밤의 송곳'].bleedHit:0)],['동료',(!A.isP&&C.ally?CFG.bond.allyHit:0)],['작품',(A.ring?CFG.ring.hit*A.work:0)],['장갑 무기',(sub?sub.atk:0)],['명중 보정',(gr?gr.hit:0)],['침잠',-sk],['지령',-pr],['예법',-mn],['복종',-ob],['흐트러짐',-sgP]];
        const known=ps.reduce((t,x)=>t+x[1],0),rest=am-known;for(const [n_,v_] of ps)if(v_)amL.push([n_,v_]);if(rest)amL.push(['그 밖',rest]);
        const evP=B.eva+B.evaB-(B.evaPen||0),brP=(B.breath>=1&&B.breath<=CFG.breath.evaMax?CFG.breath.eva:0),shP=3*(B.shock||0),chP=2*((B.chain||0)+(B.web||0));
        const pd=[['회피',evP],['호흡',brP],['가속',acB],['겁쟁이',trE],['색 버프',(B.cb&&B.cb.k==='eva'&&B.hp>=B.maxHp*CFG.colorBuff.hpMin)?B.cb.v:0],['첫 반응',(B.augPas==='react'&&C.round<=2)?10:0],['가면',B.maskOn?B.passive.eva:0],['오딘',B.odin?odinEva(C.round,B):0],['감전',-shP],['사슬·거미줄',-chP]];
        const kd=pd.reduce((t,x)=>t+x[1],0),rd_=dm-kd;for(const [n_,v_] of pd)if(v_)dmL.push([n_,v_]);if(rd_)dmL.push(['그 밖',rd_])}
      const base={k:'atk',att:A.uid,def:B.uid,card:c,ra,ra2,rd,rdMax,am,dm,sa,sd,b:c.b,guard:B.guarding,amL,dmL};
      /* 방어 자세: 막아도 피해 guardHit는 받는다 (키워드는 붙지 않음) */
      if(B.guarding&&sa<=sd){
        const dmg=G_.guardHit;hpLoss(C,B,dmg,L);
        L('miss',`${A.name} → ${B.name} · ${c.n} · 명중 ${sa} vs 방어 ${sd} · 막았다 · 피해 ${dmg}`);
        push(Object.assign(base,{hit:false,blocked:true,rolls:[],dmg,note:''}));
        continue;
      }
      if(sa<=sd){
        if(B.passive&&B.passive.id==='godfather'&&!B.gfBonus){B.gfBonus=true;L('kw',`  ${B.name} · ${B.passive.n} · 다음 적중 피해 +1d2`)}
        L('miss',`${A.name} → ${B.name} · ${c.n} · 명중 ${sa} vs 회피 ${sd}${B.maskOn?` (${B.passive.n} +${B.passive.eva})`:''} · 빗나감`);
        if(c.onMiss&&A.hp>0){A.breath=Math.min(CFG.breath.cap,A.breath+c.onMiss.breath);A.passHitNext=(A.passHitNext||0)+c.onMiss.hitNext;L('kw',`  ${A.name} · ${c.n} · 빗나갔다 · 호흡 +${c.onMiss.breath} (지금 ${A.breath}) · 다음 라운드 명중 +${c.onMiss.hitNext}`)}
        push(Object.assign(base,{hit:false,rolls:[],dmg:0,note:''}));
        continue;
      }
      /* 피해: d6 × 카드 주사위 수 + 고정값. 최소값·재굴림은 카드/무기 효과 */
      const lo=Math.max(A.dmin,c.min||1),rolls=[];
      /* 피해 주사위 면 수: 기본 d6, 카드에 die가 있으면 그 값 (예: Furioso 1d2 × 9). 최소값 보정은 면 수를 넘지 않는다 */
      const die=c.die||(A.isP?A.pdie:6)||6,lo2=Math.min(lo,die);
      /* 전용 무기 피해 주사위: 카드 주사위 대신 무기 주사위 (Furioso처럼 주사위가 정해진 카드는 그대로) */
      /* 무기 주사위는 카드 주사위를 바꾸지 않고 위에 더해진다 (카드 주사위 + 무기 주사위). 자세 무기의 범위 피해도 한 번 더한다 */
      const wd=null,wdx=A.wx?(sub?sub.dice:A.wx.dice):null;
      {let ex=c.exec&&(B.disp||0)>0?c.exec:0;if(ex)pnote+=` 처분 표식 주사위+${ex}`;
        if(c.serumBurst&&(A.serum||0)>0){ex+=A.serum;pnote+=` 혈청 ${A.serum} 소모 · 주사위+${A.serum}`;A.serum=0}for(let i=0;i<c.dice+ex+(c.fsDice&&fsb?c.fsDice:0)+(gr&&!c.die?gr.dice:0);i++)rolls.push(c.range?c.range[0]-1+d(c.range[1]-c.range[0]+1):Math.max(lo2,d(die)))}
      if(sub&&sub.range)rolls.push(sub.range[0]-1+d(sub.range[1]-sub.range[0]+1));
      else if(wdx)for(let i=0;i<wdx[0];i++)rolls.push(Math.max(Math.min(lo,wdx[1]),d(wdx[1])));
      let note=fsb?' 선제':'';
      if(c.rr&&rolls.length){
        let mi=0;rolls.forEach((v,i)=>{if(v<rolls[mi])mi=i});
        const nv=Math.max(lo2,d(die));if(nv>rolls[mi]){note+=` 재굴림 ${rolls[mi]}→${nv}`;rolls[mi]=nv}
      }
      if(A.rv&&A.rv.t>=2&&B.hp<=B.maxHp*CFG.raven.low&&rolls.length){pnote+=` 까마귀의 눈 · 주사위 ${rolls.length}개 +1`}
      let dmg=rolls.reduce((a,b)=>a+b,0)+(A.rv&&A.rv.t>=2&&B.hp<=B.maxHp*CFG.raven.low?rolls.length:0)+c.b+(gr?gr.b:0)+(A.prescPlus||0)+(A.yeji&&BONA.has(c)?CFG.odin.yeji:0)+(A.bonB&&BONA.has(c)?A.bonB:0)+(c.markB&&B.disp?c.markB*B.disp:0)+(A.vtUse||0)+(A.vtBonus||0);
      if(CFG.atkRule.on){const x=Math.floor(Math.max(0,A.atk)/CFG.atkRule.dmgPer);if(x>0){dmg+=x;note+=` 공격 ${A.atk} · 피해+${x}`}}
      /* 흑수 카드: 속도 · 파열 · 호흡 · 보호막 · 화상에 따른 피해 보정 (주사위당 +n은 주사위 수만큼 더한다) */
      if(c.hz){const nr=rolls.length||1;
        if(c.spdRupt&&A.spd>B.spd)dmg=Math.floor(dmg*(1+Math.min(0.5,(A.spd-B.spd)*(B.rupture||0)/100)));
        if(c.ruptB)dmg+=Math.min(2,Math.floor((B.rupture||0)/c.ruptB))*nr;
        if(c.breathRupt)dmg+=Math.min(c.breathRupt[1],Math.floor(((A.breath||0)+(B.rupture||0))/c.breathRupt[0]))*nr;
        if(c.shieldDmg)dmg=Math.floor(dmg*(1+Math.min(0.5,(A.shield||0)*c.shieldDmg/100)));
        if(c.spdFinal&&A.spd>B.spd)dmg+=c.spdFinal*nr;
        if(c.lowHpB&&A.hp<A.maxHp*0.5)dmg+=c.lowHpB*nr;
        if(c.burnDmg)dmg=Math.floor(dmg*(1+Math.min(0.3,(B.burn||0)*c.burnDmg/100)));
        if(c.ruptBreath&&(B.rupture||0)>=5){A.breath=Math.min(CFG.breath.cap,(A.breath||0)+c.ruptBreath);L('kw',`  ${A.name} · ${c.n} · 파열 5 이상 · 호흡 +${c.ruptBreath}`)}}
      /* 인연과 함께 싸우는 보스: 배우자가 같은 공격을 같이 굴린다. 피해 주사위 합 = (본인 + 배우자)의 ¾씩 */
      let spR=null;
      if(A.isP&&C.ally&&rolls.length){const dd=wd?wd[1]:die;spR=rolls.map(()=>c.range&&!wd?c.range[0]-1+d(c.range[1]-c.range[0]+1):Math.max(lo2,d(dd)));
        const S_=rolls.reduce((a,b)=>a+b,0),SP_=spR.reduce((a,b)=>a+b,0),w_=CFG.bond.allyDice,mix=Math.round(w_*(S_+SP_));dmg+=mix-S_;
        pnote+=` 합산 (본인 ${S_} + ${C.ally.name} ${SP_})×${w_}=${mix}`}
      const ig=(A.blade&&A.breath>=CFG.breath.sure)||c.pierce;
      if(A.kuro&&A.black){const x=rolls.length*CFG.syn['흑운회'].die;dmg+=x;pnote+=` 흑운 · 주사위 ${rolls.length}개 +${x}`}
      if(A.blade){const x=Math.floor(A.breath/(A.bladeBoost?CFG.syn['검계'].boostPer:CFG.syn['검계'].per));if(x>0){dmg+=x;pnote+=` 본국 검술 · 호흡 ${A.breath} → +${x}`}}
      if(c.breathDice&&A.breath>0){dmg+=A.breath;pnote+=` 골단 · 호흡 ${A.breath} 가산`}
      /* 뒤틀린 책장: 도박 카드 (주사위 한 번, 맞으면 큰 피해) */
      if(c.gamble){const g=c.gamble,r=d(g.die),win=g.win.includes(r);if(g.keep){if(win)dmg=g.dmg;note+=` 1d${g.die} ${r}${win?` 사의 경계 · 피해 ${g.dmg}`:''}`}else{dmg=win?g.dmg:g.lose;rolls.length=0;rolls.push(r);note+=` 1d${g.die} ${r}${win?' 대박':''}`}
        if(win&&g.heal){const h=Math.min(g.heal,A.maxHp-A.hp);A.hp+=h;note+=` HP+${h}`}
        if(!win&&g.self){A.hp=Math.max(1,A.hp-g.self);note+=` 반동 −${g.self}`}}
      if(gr&&gr.n)note+=` 등급${gr.n}(피해+${gr.b})`;
      note+=pnote;
      /* 장비 추가 주사위 (천퇴성도: 적중마다 1d2 × N) */
      if(A.extraD2){let x=0;for(let i=0;i<A.extraD2;i++)x+=d(2);dmg+=x;note+=` 추가 1d2×${A.extraD2}+${x}`}
      if(A.passive&&A.passive.id==='stance'){const x=A.stance==='bear'?A.sal:Math.floor((A.passive.salMax-A.sal)/2);if(x>0){dmg+=x;note+=` 본국검술[살] ${A.sal} · ${A.stance==='bear'?'곰 사냥':'범 사냥'}+${x}`}}
      if(B.passive&&B.passive.id==='stance'){const v=B.stance==='bear'?Math.max(0,5-B.sal):Math.max(0,B.sal-5);if(v>0){dmg+=v*2;note+=` 살 ${B.sal} · 취약+${v*2}`}}
      if(A.isP&&A.form==='a'&&A.wx&&A.wx.forms){dmg+=CFG.form.atkDmg;note+=` 참격 자세+${CFG.form.atkDmg}`}
      if(A.passive&&A.passive.id==='forms'&&A.stance==='pierce'){const n=Math.min(A.passive.pierceCap,(B.bleed||0)+(B.rupture||0)+(B.burn||0));if(n>0){const x=n*A.passive.pierceBonus;dmg+=x;note+=` 관통 태세+${x}`}}
      if(A.passive&&A.passive.id==='kas'&&B.bleed>0){const x=Math.min(B.bleed,A.passive.cap)*A.passive.per;dmg+=x;note+=` ${A.passive.n}+${x}`}
      if(A.passive){
        if(A.passive.id==='godfather'&&A.gfBonus){const x=d(2);dmg+=x;A.gfBonus=false;note+=` ${A.passive.n}+${x}`}
        if(A.passive.id==='claw'){const x=d(A.passive.dice||4);dmg+=x;note+=` ${A.passive.n}+${x}`}
      }
      if(A.breath>0||c.forceCrit){
        if(c.forceCrit||d(100)<=critPct(A.breath)){const cm=(A.blade?(A.bladeBoost?CFG.syn['검계'].boostCrit:CFG.syn['검계'].crit):CFG.critMult)+(A.hwando?0.1*Math.min(A.breath,CFG.breath.hwandoCap):0);dmg=Math.floor(dmg*cm);note+=A.hwando?` 치명(환도 ×${cm.toFixed(1)})`:' 치명'}
      }
      if(A.blade&&A.breath>=CFG.syn['검계'].burst.at&&(A.bbRound==null||C.round-A.bbRound>=CFG.syn['검계'].burst.every)){const bs=CFG.syn['검계'].burst,sp=Math.min(A.breath,bs.max),x=Math.floor(sp*bs.per[A.synT||0]);A.bbRound=C.round;A.breath-=sp;dmg+=x;note+=` 호흡 폭발 · 호흡 ${sp} 소모 → +${x}`}
      if(B.rupture>0){dmg+=B.rupture;note+=` ${D.keywords.rupture.n}+${B.rupture}`;B.rupture--}
      if(A.ring&&A.work>0){dmg+=CFG.ring.dmg*A.work;note+=` 작품 ${A.work}+${CFG.ring.dmg*A.work}`;if(A.work>=CFG.ring.max){dmg=Math.floor(dmg*CFG.ring.finish);A.work=CFG.ring.after;note+=` 완성×${CFG.ring.finish}`}}
      if(A.dmgB){dmg+=A.dmgB;note+=` 무기+${A.dmgB}`}
      if(A.augPas==='over'&&A.ovRound!==C.round){A.ovRound=C.round;dmg+=4;note+=' 과부하 코어+4'}
      if(A.cb&&A.cb.k==='dmg'&&A.hp>=A.maxHp*CFG.colorBuff.hpMin){dmg+=A.cb.v;note+=` 특색 위력+${A.cb.v}`}
      if(A.sm){const SM=CFG.shinmang,mul=1+SM.dealShin+A.sm.rings*SM.dealRing;dmg=Math.floor(dmg*mul);note+=` 신망 ×${mul.toFixed(2)}`}
      if(A.wx&&A.wx.finish&&B.hp<=B.maxHp*A.wx.finish.at){dmg+=A.wx.finish.dmg;note+=` 마무리+${A.wx.finish.dmg}`}
      if(A.triDmg){dmg+=A.triDmg;note+=` 건+${A.triDmg}`}
      if(A.hungerUse>0){dmg+=A.hungerUse;note+=` 굶주림+${A.hungerUse}`;A.hungerUse=0}
      if(c.bleedDmg&&B.bleed>0){const wm=(B.wspear||0)>0?Math.pow(B.wspearMul||1.2,B.wspear):1,x=Math.round(B.bleed*c.bleedDmg*wm);dmg+=x;note+=` 출혈 ${B.bleed}×${c.bleedDmg}${wm>1?`×${Math.round(wm*100)/100}(${D.keywords.wspear.n})`:''}+${x}`}
      if(c.sinkDmg&&(B.sink||0)>=CFG.sink.per){const n_=Math.floor(B.sink/CFG.sink.per),x=n_*c.sinkDmg;dmg+=x;note+=` 침잠 ${n_}단계+${x}`}
      if(C.duel){dmg+=C.duel;note+=` 결투+${C.duel}`}
      if(A.augHunt&&B.aug){dmg+=A.augHunt;note+=` 의체 심판+${A.augHunt}`}
      /* 조율자 전용 키워드 · 봉인 각인: 해제가 각인 1당 피해 +4로 터뜨린다 */
      if(c.unseal&&(B.sealMark||0)>0){const x=B.sealMark*c.unseal;dmg+=x;note+=` 봉인 해제 ${B.sealMark}×${c.unseal}+${x}`;B.sealMark=0}
      if((A.serum||0)>=3&&!c.serumBurst){dmg=Math.floor(dmg*1.5);A.serum=0;note+=' 혈청 과부하×1.5'}
      /* 화상: 받는 피해 ×1.5, 5스택 이상이면 푸른 화염 ×2 */
      if(isBlue(B)){const bm=B.blueM||CFG.laev.blueMul;dmg=Math.floor(dmg*bm);note+=` 푸른 화염×${bm}`}else if(B.flame>0){dmg=Math.floor(dmg*1.5);note+=' 붉은 화염×1.5'}
      if(A.mark){const x=d(3)+d(3);dmg+=x;note+=` 표지+${x}`}
      const rawDmg=dmg;
      if(B.guarding&&!ig){dmg=Math.floor(dmg*G_.guardFailMul);note+=` 방어 감소×${G_.guardFailMul}`}else if(B.guarding&&ig)note+=' 방어 무시'
      /* 무기 디버프: 왜곡(내가 주는 피해 감소), 표적(3스택이면 2배), 원한(쌓인 만큼 추가) */
      if(A.matBonus){dmg+=A.matBonus;note+=` 신체관극+${A.matBonus}`}
      if(c.reuse&&A.mat>0){let x=0;for(let i=0;i<A.mat;i++)x+=d(c.die||6);dmg+=x;note+=` 폐장 재사용 ${A.mat}회+${x}`;A.mat=0}
      if(A.warp){dmg=Math.max(1,dmg-A.warp);note+=` 왜곡−${A.warp}`}
      {const g2=staggerStage(B);if(g2&&g2.take){dmg+=g2.take;note+=` 흐트러짐 취약+${g2.take}`}}
      {const g_=staggerStage(A);if(g_&&g_.dmg){dmg=Math.max(1,dmg-g_.dmg);note+=` 흐트러짐−${g_.dmg}`}}
      if((A.sink||0)>=CFG.sink.per){const x=Math.floor(A.sink/CFG.sink.per)*CFG.sink.dmg;dmg=Math.max(1,dmg-x);note+=` 침잠−${x}`}
      if(A.wx&&A.wx.mark){B.mk=(B.mk||0)+1;if(B.mk>=A.wx.mark.need){dmg*=2;B.mk=0;note+=` ${A.wx.mark.n||'표적'}×2`}}
      /* 중지 패시브 되갚음: 맞을 때마다 1 (최대 5), 다음 적중 피해 +2×스택 */
      if(A.middle&&(A.revenge||0)>0){const x=A.revenge*(A.revMul||CFG.middle.dmg);dmg+=x;note+=` 되갚음+${x}`;const hl=A.isP?Math.min(A.revenge*CFG.middle.heal,A.maxHp-A.hp):0;if(hl>0){A.hp+=hl;HG(A,hl);note+=` 스택 ${A.revenge} 소모 · HP +${hl}`}A.revenge=Math.floor(A.revenge*CFG.middle.keep)}
      if(A.isP&&A.angry>0&&dmg>0){dmg+=A.angry;note+=` 분노+${A.angry}`;A.angry=0}
      const EG_=A.isP&&c.eg?(A.mf&&c.eg.mf?Object.assign({},c.eg,c.eg.mf):c.eg):null;
      if(EG_){if(EG_.first&&A.egFR!==C.round){A.egFR=C.round;dmg+=EG_.first;note+=` 첫 적중+${EG_.first}`}
        if(EG_.per){const n_=egRes(A,B);if(n_>0){const x=n_*EG_.per;dmg+=x;note+=` ${(A.wx&&(A.wx.grudgeN||(A.wx.echo&&A.wx.echo.n)))||(A.wx&&A.wx.debuff?'거미줄':'')}+${x}`}}}
      if(A.wx&&A.wx.grudge&&A.grudge>0){const x=A.grudge*A.wx.grudge;dmg+=x;note+=` ${A.wx.grudgeN||'원한'}+${x}`;A.grudge=0}
      if(A.wx&&A.wx.scythe&&A.scRound!==C.round&&C.round%A.wx.scythe.every===0&&A.charge>=A.wx.scythe.cost){A.scRound=C.round;A.charge-=A.wx.scythe.cost;const nh=A.wx.scythe.hits||1;let x=0;for(let q=0;q<nh;q++)x+=A.wx.scythe.bonus+d(A.wx.dice?A.wx.dice[1]:6);dmg+=x;note+=` 첫 공격 추가 피해+${x}${nh>1?` (${nh}연타)`:''} (충전 ${A.wx.scythe.cost} 소모)`}
      if(A.wx&&A.wx.crush&&A.crRound!==C.round){A.crRound=C.round;dmg+=A.wx.crush;note+=` ${A.wx.crushN||'짓누름'}+${A.wx.crush}`}
      if(EG_&&EG_.gain){const b4=egRes(A,B);egRes(A,B,EG_.gain);const a4=egRes(A,B);if(a4>b4)L('kw',`  ${A.name} · ${c.n} · ${(A.wx.grudgeN||(A.wx.echo&&A.wx.echo.n)||'거미줄')} +${a4-b4} (지금 ${a4})`)}
      if(B.middle&&B.isP&&(B.revenge||0)>0&&CFG.middle.def){const r_=Math.min(dmg-1,B.revenge*CFG.middle.def);if(r_>0){dmg-=r_;note+=` 되갚음 방어−${r_}`}}
      if(B.wx&&B.wx.ward){dmg=Math.max(1,dmg-B.wx.ward);note+=` 책장−${B.wx.ward}`}
      if(A.swift){const x=Math.floor(A.spd/CFG.innate.swiftPer);if(x>0){dmg+=x;note+=` 질풍 속도 ${A.spd}→+${x}`}}
      if(A.psycho||B.psycho){const m=(A.psycho?CFG.innate.psycho:1)*(B.psycho?CFG.innate.psycho:1);dmg*=m;note+=` 사이코패스×${m}`}
      if(A.trait==='enrage'&&A.hp<=A.maxHp/2){dmg+=2;note+=' 분노+2'}
      if(A.kaliOn){dmg+=A.kali.dmgB;note+=` 칼리+${A.kali.dmgB}`}
      if(B.takenMul>1){const r=Math.round(dmg*(B.takenMul-1));if(r>0){dmg+=r;note+=` 해치고 싶지 않다 +${r}`}}
      if(B.sm){const r=Math.floor(dmg*CFG.shinmang.takeShin);if(r>0){dmg-=r;note+=` 신−${r}`}}
      if(B.kaliOn){const r=Math.floor(dmg*B.kali.dr/100);if(r>0){dmg-=r;note+=` 칼리−${r}`}}
      if(B.trait==='callus'){const r=Math.min(2,dmg-1);if(r>0){dmg-=r;note+=` 굳은살−${r}`}}
      if(B.presc>0){const r=Math.floor(dmg*B.presc*0.05);if(r>0){dmg-=r;note+=` 지령 수행−${r}`}}
      if(B.drRound===C.round){const r=dmg-Math.floor(dmg*0.4);dmg-=r;note+=` 공명−${r}`}
      /* 피해 감소(%): 영구 효과 + 황혼 키워드 (체력 from 이하부터 base%, low 이하에서 max%까지 선형으로 오른다) */
      {let mdr=B.midDr||0;if(B.middle&&B.isP&&B.midEff<1)mdr=Math.min(CFG.middle.drCap,mdr+Math.floor(Math.max(0,B.eva+B.evaB+(B.odin?Math.max(0,odinEva(C.round,B)):0))*(1-B.midEff)*CFG.middle.evaDr));let red=(B.dr||0)+(B.triCut||0)+mdr+(C.ch.infinite&&B.middle&&B.isP?B.infHit||0:0),tw='';red=Math.min(CFG.drCap,red);B.redPct=red;const T_=B.wx&&B.wx.twilight;
        if(T_){const r_=B.hp/B.maxHp;if(r_<=T_.from){const x=Math.min(T_.max,T_.base+(T_.from-Math.max(r_,T_.low))/(T_.from-T_.low)*(T_.max-T_.base));red+=x;tw=` 황혼`}}
        if(red>0){const x=Math.floor(dmg*red/100);if(x>0){dmg-=x;note+=`${tw} ${mdr?(B.midDr>=CFG.middle.dr[3]?'초근성 ':'근성 '):''}피해감소${Math.round(red)}%−${x}`}}}
      if(c.spdDice&&A.spd>=c.spdDice[0]){const x=rolls.length*c.spdDice[1];dmg+=x;note+=` 속도 ${A.spd} · 주사위 ${rolls.length}개 +${c.spdDice[1]}=+${x}`}
      if(A.spent>0&&c.fixPer){const fp=c.fixPer+(A.focusOn?A.focus.fix:0),em=A.expOn?A.chargeExp.mul:1,x=Math.floor(A.spent*fp*em);dmg+=x;note+=` 충전 ${A.spent}×${fp}${em>1?`×${em} 급행`:''}=고정 +${x}`}
      if(B.kuro&&B.black&&B.synT>=3){dmg=Math.max(1,Math.floor(dmg*CFG.syn['흑운회'].half));note+=' 흑운 ×'+CFG.syn['흑운회'].half}
      if(B.isP&&C.escort&&C.escort.kind==='guard'&&B.escortRound!==C.round&&dmg>1){B.escortRound=C.round;const Z=CFG.escort.guard,es=C.escort,pc=Math.min(Z.cutMax,Z.cut+Z.cutPer*es.lv,Math.max(0,CFG.drCap-(B.redPct||0))),x=Math.floor(dmg*pc/100);if(x>0){dmg-=x;note+=` ${es.name} 막아섬−${x}`}const cd=Z.counter+Z.counterPer*es.lv;A.hp=Math.max(0,A.hp-cd);L('dmg',`  ${es.name} · 수비 · ${A.name}에게 반격 ${cd}`)}
      if(B.passive&&B.passive.id==='lkLantern'&&(B.lights||0)>0){B.lights--;dmg=0;note+=` 빛 촉수가 부서졌다 (남은 ${B.lights})`}
      if(A.isP&&C.crew&&C.crew.length&&dmg>0){const rs=C.crew.map(m=>({n:m.n,r:d(m.die)})),sum=rs.reduce((a,x)=>a+x.r,0),add=Math.round(sum*CFG.lake.crewW);if(add>0){dmg+=add;note+=` 선원 [${rs.map(x=>x.n+' '+x.r).join(', ')}]×${CFG.lake.crewW} +${add}`}}
      if(c.harpoonPull&&(B.harpoon||0)>0){const used=B.harpoon,add=used*c.harpoonPull.per;B.harpoon=0;dmg+=add;note+=` 작살 ${used}개를 당겨 +${add}`}
      if(c.verdict){const x=Math.floor((B.maxHp-B.hp)/10);dmg=Math.max(dmg,rawDmg)+x;note+=` 처형 · 방어·감소 무시 · 잃은 체력 ${B.maxHp-B.hp} → 고정 +${x}`}
      if(C.ch.infinite&&dmg>0&&(A.escN||0)>0&&!(B.middle&&B.isP)){const IF_=CFG.infinite,m=B.isP?Math.min(IF_.escMaxP,Math.pow(1+IF_.escPerP,A.escN)):Math.min(IF_.escMaxE,Math.pow(1+IF_.escPerE,A.escN));dmg=Math.round(dmg*m);note+=` 몰아침 ×${m.toFixed(1)}`}
      if(C.ch.infinite&&!A.isP&&B.isP&&dmg>0&&C.id===CFG.endless.final&&CFG.infinite.impDmgMul!=null&&CFG.infinite.impDmgMul!==1){dmg=Math.max(1,Math.round(dmg*CFG.infinite.impDmgMul))}
      if(C.ch.infinite&&!A.isP&&B.isP&&dmg>0&&C.ch.infBoost){const m=1+C.ch.infBoost*CFG.infinite.century.enemyDmg;dmg=Math.round(dmg*m);note+=` 어긋남 ×${m.toFixed(2)}`}
      if(C.ch.infinite&&A.isP&&dmg>0&&C.ch.limStrike){const x=Math.round(A.maxHp*C.ch.limStrike);dmg+=x;note+=` 일격 +${x}`}
      if(C.ch.infinite&&A.isP&&dmg>0&&(C.ch.infBoost||C.ch.infShard||C.ch.famLoss||C.ch.limDmg)){const m=1+(C.ch.limDmg||0)+(C.ch.infBoost||0)*CFG.infinite.century.dmg+(C.ch.infShard||0)*CFG.infinite.shard.dmg+(C.ch.famLoss||0)*CFG.infinite.grief.dmg;dmg=Math.round(dmg*m);note+=` 백 해 ×${m.toFixed(2)}`}
      {const SG=CFG.infinite.surge;if(C.ch.infinite&&A.isP&&dmg>0&&SG&&(C.ch.year||0)>=SG.year&&C.round>SG.round){const m=Math.min(SG.max,Math.pow(SG.per,C.round-SG.round));dmg=Math.round(dmg*m);note+=` 기세 ×${m>=1000?m.toExponential(1):m.toFixed(1)}`}}
      if(B.shield>0&&!ig){const ab=Math.min(B.shield,dmg);B.shield-=ab;dmg-=ab;note+=` 보호막−${ab}`}else if(B.shield>0&&ig)note+=' 보호막 무시'
      if(A.passive&&A.passive.id==='lkPale'&&B.isP&&dmg>0){B.pale=(B.pale||0)+1;if(B.pale>=A.passive.at){B.pale=0;loseMind(C.ch,Math.ceil(A.passive.mind/(B.lk&&B.lk.pale?2:1)),t=>L('kw',`  ${A.name} · 창백화 · ${t}`))}else L('kw',`  ${A.name} · 창백화 ${B.pale}/${A.passive.at}`)}
      hpLoss(C,B,dmg,L);if(dmg>0){A.dealtR=C.round;if(C.ch.infinite){A.escN=(A.escN||0)+1;if(B.middle&&B.isP)B.infHit=Math.min(CFG.infinite.midCutMax,(B.infHit||0)+CFG.infinite.midCut)}}
      if(B.isP&&dmg>0){B.hitN=(B.hitN||0)+1;if(B.hitN>=CFG.innateUnlock.hits)C.ch.tough=1}
      L('hit',`${A.name} → ${B.name} · ${c.n} · 명중 ${sa} vs ${B.guarding?'방어':'회피'} ${sd} · 피해 [${rolls.join(',')}]${c.b?sg(c.b):''}${note} = ${dmg}`);
      if(c.hitShield){A.shield=Math.min(CFG.shieldCap,(A.shield||0)+c.hitShield);L('kw',`  ${A.name} · 보호막 +${c.hitShield} (지금 ${A.shield})`)}
      applyKw(A,B,c,L);
      if(A.isP&&A.wx&&A.wx.forms&&B.hp>0&&!B.formImmune){const F_=CFG.form;
        if(A.form==='p')applyKw(A,B,{kw:[['bleed',F_.bleed,'t']]},L);
        if(A.form==='s'){addStagger(C,B,F_.stagger,L);if((A.stagger||0)>0)A.stagger=Math.max(0,A.stagger-F_.stagger)}}
      if(A.passive&&A.passive.id==='forms'&&A.stance==='strike'&&B.hp>0){addStagger(C,B,A.passive.stagger,L);if((A.stagger||0)>0){A.stagger=Math.max(0,A.stagger-A.passive.recover);L('kw',`  ${A.name} · 타격 태세 · 자신의 흐트러짐 −${A.passive.recover}`)}}
      if(A.isP&&C.crew&&C.crew.length&&B.hp>0&&A.harpRound!==C.round){const nh=C.crew.filter(m=>m.role==='harpooner').length;if(nh){A.harpRound=C.round;applyKw(A,B,{kw:[['harpoon',CFG.lake.harpStack*nh,'t']]},L)}}
      if(A.wx&&A.wx.whaleSpear&&B.hp>0&&!B.formImmune){const W_=A.wx.whaleSpear;B.wspear=Math.min(W_.cap,(B.wspear||0)+1);B.wspearMul=W_.mul;L('kw',`  ${A.name} · 전용 무기 · ${B.name}에게 ${D.keywords.wspear.n} +1 (지금 ${B.wspear}/${W_.cap}) · 출혈 피해 ×${Math.round(Math.pow(W_.mul,B.wspear)*100)/100}`)}
      if(A.wx&&A.wx.hitBleed&&B.hp>0&&!B.formImmune){B.bleed=Math.min(bleedCap(B),B.bleed+A.wx.hitBleed);L('kw',`  ${A.name} · 전용 무기 · ${B.name}에게 출혈 +${A.wx.hitBleed} (지금 ${B.bleed})`)}
      if(A.inkIds&&A.inkIds.length&&!c.inkFollow&&B.hp>0){const id=A.inkIds[(A.inkI=A.inkI||0)%A.inkIds.length],K=CFG.ink;if(A.obey>0)A.obey--;A.inkI++;let x=K.follow+Math.max(0,A.inkIds.length-1)*K.followPer;if(B.shield>0){const ab=Math.min(B.shield,x);B.shield-=ab;x-=ab}hpLoss(C,B,x,L);B.ink=Math.min(K.cap+(A.wx&&A.wx.inkCap||0),(B.ink||0)+K.followInk);L('hit',`  ${A.name}의 ${D.cards[id].n.replace('흑수 · ','')} 흑수가 거든다 · ${B.name}에게 ${x} · 수흔 +${K.followInk} (지금 ${B.ink})`)}
      if(A.wx&&A.wx.hitInk&&B.hp>0){B.ink=Math.min(CFG.ink.cap+(A.wx.inkCap||0),(B.ink||0)+A.wx.hitInk);L('kw',`  ${A.name} · 전용 무기 · ${B.name}에게 수흔 +${A.wx.hitInk} (지금 ${B.ink})`)}
      if(c.verdict&&B.hp<=0&&A.rv)L('kw','처리 완료. 흔적은 남지 않았다.');
      if(c.erase&&B.hp>0){B.lightUp=0;B.lightNext=0;const ks=['bleed','rupture','burn','flame','nail','sink'].filter(k=>(B[k]||0)>0);for(const k of ks)B[k]=Math.min(k==='bleed'?bleedCap(B):CFG.stackCap,Math.floor(B[k]*1.5));L('kw',`  ${A.name} · ${c.n} · ${B.name}이(가) 아껴 둔 빛이 증발했다${ks.length?' · '+ks.map(k=>`${D.keywords[k].n} ${B[k]}`).join(' · ')+' (×1.5)':''}`)}
      if(A.rv&&B.hp>0){const k=CFG.raven.buffs.find(k=>(B[k]||0)>0);if(k){const nm={shield:'보호막',breath:'호흡',charge:'충전',cloud:'구름',passHit:'명중 보정'}[k];if(k==='passHit')B.passHit=0;else B[k]--;L('kw',`  ${A.name} · 까마귀의 눈 · ${B.name}의 ${nm} 1 말소`)}}
      if(A.kuro&&A.black&&B.hp>0){B.bleed=Math.min(bleedCap(B),B.bleed+CFG.syn['흑운회'].bleedPlus);L('kw',`  ${A.name} · 흑운 · ${B.name}에게 출혈 +${CFG.syn['흑운회'].bleedPlus} (지금 ${B.bleed})`)}
      if(A.awl&&A.synT>=3&&A.lead&&!A.awlUsed&&B.hp>0){A.awlUsed=true;B.bleed=Math.min(bleedCap(B),B.bleed+1);L('kw',`  ${A.name} · 선공 첫 적중 · ${B.name}에게 출혈 +1 (지금 ${B.bleed})`);if(A.kuro)addCloud(A,L)}
      if(A.ring&&A.work<CFG.ring.max){A.work++;L('kw',`  ${A.name} · 작품 ${A.work}/${CFG.ring.max}`)}
      if(A.nailHit&&B.hp>0){const n=B.aug?CFG.nail.augHit:A.nailHit;B.nail=Math.min(CFG.nail.cap,(B.nail||0)+n);L('kw',`  ${B.name}에게 못 +${n} (지금 ${B.nail})`)}
      if(c.nailBurst&&B.hp>0&&(B.nail||0)>0){const used=B.nail;B.nail=0;L('kw',`  ${B.name} · 못 ${used}개를 흐트러짐으로`);addStagger(C,B,Math.round(used*c.nailBurst.mul)+(c.nailBurst.add||0),L)}
      if(c.nextSwift){A.swiftNext=true;L('kw',`  ${A.name} · 다음 라운드 신속`)}
      if(c.handPlus){A.handPlusNext=Math.max(A.handPlusNext||0,c.handPlus);L('kw',`  ${A.name} · 다음 손패 +${c.handPlus}장`)}
      if(A.chargeHit){A.charge=Math.min(A.chargeCap,A.charge+A.chargeHit);L('kw',`  ${A.name} · 충전 +${A.chargeHit} (지금 ${A.charge})`)}
      if(B.chargeLoss>0&&B.charge>0&&B.isP){B.charge=Math.max(0,B.charge-B.chargeLoss);L('kw',`  ${B.name} · 피격 · 충전 −${B.chargeLoss} (남은 ${B.charge})`)}
      if(c.hitHeal&&A.hp>0){const h=Math.min(c.hitHeal,A.maxHp-A.hp);if(h>0){A.hp+=h;HG(A,h);L('kw',`  ${A.name} · ${c.n} · HP +${h}`)}}
      /* 보냐텔리 검술: 처분 표식, 엘레판테(표식이 있으면 다음 라운드 처분 1회) */
      if(c.grant&&(B.disp||0)>0&&B.hp>0){giveNext(A,c.grant);L('sys',`  ${A.name} · 처분 표식 · 다음 손패에 ${D.cards[c.grant].n}`)}
      if(c.seal&&B.hp>0){B.sealMark=Math.min(5,(B.sealMark||0)+c.seal);L('kw',`  ${B.name}에게 봉인 각인 ${B.sealMark}/5`)}
      if(c.dmark&&B.hp>0){B.disp=Math.min(CFG.bon.markMax,(B.disp||0)+c.dmark);L('kw',`  ${B.name}에게 처분 표식 ${B.disp}`)}
      /* 마에스트로 책장: 재료 수집 부여 / 신체관극(상대 디버프 수만큼 재료) */
      if(c.mat&&B.hp>0){B.matc=(B.matc||0)+c.mat;L('kw',`  ${B.name}에게 재료 수집 ${B.matc}`)}
      if(c.harvest&&B.matc>0){const n=['bleed','rupture','burn','flame','prescript','warp','shock','chain','web','mk','matc'].reduce((a,k)=>a+(B[k]>0?B[k]:0),0);
        A.mat=(A.mat||0)+n;A.matNext=(A.matNext||0)+n;L('kw',`  ${A.name} · 신체관극 · 재료 +${n} (지금 ${A.mat}) · 다음 라운드 적중마다 피해 +${A.matNext}`)}
      /* 전용 무기 효과: 적중 시 키워드·잔향·호흡·조율, 피격 시 반격 */
      if(A.wx&&B.hp>0){const X=A.wx;
        if(X.debuff){const {k,n}=X.debuff,nm={prescript:'지령',warp:'왜곡',shock:'감전',chain:'사슬',web:'거미줄'}[k];B[k]=Math.min(5,(B[k]||0)+n);L('kw',`  ${B.name}에게 ${nm} ${B[k]}`)}
        if(X.mindHit&&A.isP){const g=gainMind(C.ch,X.mindHit);if(g)L('kw',`  ${A.name} · 참회 · 정신력 +${g}`)}
        if(X.hitKw)for(const [k,n] of X.hitKw){B[k]=Math.min(k==='rupture'?CFG.rupture.max:k==='bleed'?bleedCap(B):CFG.stackCap,(B[k]||0)+n);L('kw',`  ${B.name}에게 ${D.keywords[k].n} +${n} (무기)`)}
        if(X.echo){B.wecho=(B.wecho||0)+1;L('kw',`  ${B.name}에게 ${X.echo.n||'잔향'} ${B.wecho}/${X.echo.need}`);if(B.wecho>=X.echo.need){hpLoss(C,B,X.echo.dmg,L);B.wecho=0;L('dmg',`  ${X.echo.n||'잔향'}이 울린다 · ${B.name} 고정 피해 ${X.echo.dmg}`)}}
        if(X.breathHit){A.breath=Math.min(CFG.breath.cap,A.breath+X.breathHit)}
        /* ALEPH E.G.O: 미미크리 흡수, 다 카포 악장 */
        if(X.drain&&A.isP&&A.rmGauge!=null&&B.hp>0){A.rmGauge++;if(A.rmGauge>=CFG.redMist.gauge){A.rmGauge=0;A.rmOpen=(A.rmOpen||0)+1;giveNext(A,'rp_cut6');A.burstLight=CFG.redMist.burstLight;A.burstTo=C.round+CFG.redMist.burstRounds;L('sys',`  ${A.name} · 붉은 안개 개방 · 다음 손패에 ${D.cards.rp_cut6.n}`)}else L('kw',`  ${A.name} · 붉은 안개 ${A.rmGauge}/${CFG.redMist.gauge}`)}
        if(X.drain&&A.hp>0){if(A.drainRd!==C.round){A.drainRd=C.round;A.drainN=0}if(A.drainN<CFG.drainCap){A.drainN++;const h=Math.min(X.drain,A.maxHp-A.hp);if(h>0){A.hp+=h;HG(A,h);L('kw',`  ${A.name} · 흡수 ${A.drainN}/${CFG.drainCap} · HP +${h}`)}}}
        if(X.movement&&C.round%X.movement.every===0&&A.mvRound!==C.round&&B.hp>0){A.mvRound=C.round;hpLoss(C,B,X.movement.dmg,L);L('dmg',`  다 카포 · 악장 · ${B.name} 고정 피해 ${X.movement.dmg}`)}
        if(X.execute&&B.hp>0&&B.hp<=B.maxHp*X.execute.below){hpLoss(C,B,X.execute.dmg,L);L('dmg',`  조율 · ${B.name} 고정 피해 ${X.execute.dmg}`)}}
      if(B.wx&&B.wx.grudge&&B.hp>0){B.grudge=Math.min(5,(B.grudge||0)+1+(B.egBrace===C.round?B.egBraceN:0))}
      if(B.fleshRound===C.round&&B.isP&&!B.boneNext){B.boneNext=true;L('kw',`  ${B.name} · 육참 · 맞았다 · 다음 손패에 골단`)}
      if(B.isP&&B.lk&&dmg>0&&A.hp>0){const LK=B.lk;if(LK.silence){A.warp=Math.min(5,(A.warp||0)+1);L('kw',`  ${B.name} · 무음의 고래 심장 · ${A.name}에게 왜곡 ${A.warp}`)}if(LK.anchor){A.chain=Math.min(5,(A.chain||0)+1);L('kw',`  ${B.name} · 닻을 삼킨 고래 심장 · ${A.name}에게 사슬 ${A.chain}`)}if(LK.tide)applyKw(B,A,{kw:[['bleed',2,'t']]},L);if(LK.pale)applyKw(B,A,{kw:[['sink',1,'t']]},L)}
      if(B.kuro&&B.hp>0&&dmg>0){const K=CFG.syn['흑운회'],cl=B.black?K.max:(B.cloud||0),x=Math.floor(cl*K.counter[B.synT||0]);
        if(x>0&&A.hp>0){A.hp=Math.max(0,A.hp-x);B.dealtR=C.round;L('dmg',`  ${B.name} · 흑운 반격 · 구름 ${cl} → ${A.name} 고정 피해 ${x}`)}
        addCloud(B,L)}
      if(A.passive&&A.passive.id==='stance')A.sal=Math.min(A.passive.salMax,A.sal+1);
      if(B.passive&&B.passive.id==='stance')B.sal=Math.max(0,B.sal-1);
      if(B.middle&&B.hp>0){B.revenge=Math.min(B.isP?CFG.middle.cap:5,(B.revenge||0)+1+(B.wx&&B.wx.revUp||0)+(B.odinMid&&B.odinMidRound!==C.round?(B.odinMidRound=C.round,CFG.odin.midHit):0))}
      /* 중지 수비 반격: 방어 카드(또는 방어 자세)를 낸 라운드에 맞으면 쌓인 되갚음 스택 × counter의 고정 피해로 바로 반격한다 (스택은 그대로, 라운드에 한 번) */
      if(B.middle&&B.isP&&B.hp>0&&A.hp>0&&(B.defRound===C.round||B.guarding)&&B.counterRound!==C.round&&(B.revenge||0)>0){B.counterRound=C.round;const x=B.revenge*CFG.middle.counter;A.hp=Math.max(0,A.hp-x);if(x>0)B.dealtR=C.round;L('dmg',`  ${B.name} · 수비 반격 · 되갚음 ${B.revenge} · ${A.name} 고정 피해 ${x}`)}
      if(A.trait==='thief'&&B.isP){const m=Math.min(30,C.ch.money);if(m>0){C.ch.money-=m;L('kw',`  ${A.name} · 손버릇 · 돈 −${m}`)}}
      if(B.trait==='counter'&&B.hp>0&&A.hp>0){A.hp=Math.max(0,A.hp-3);L('dmg',`  ${B.name} · 반격 · ${A.name} 피해 3`)}
      if(B.wx&&B.wx.thorns&&A.hp>0){A.hp=Math.max(0,A.hp-B.wx.thorns);L('dmg',`  ${B.name}의 무기 반격 · ${A.name} 피해 ${B.wx.thorns}`)}
      /* 검은 침묵의 장갑: 서로 다른 무기 3종을 쓰면 이번 전투에 한 번, 다음 손패에 Furioso */
      if(A.wx&&A.wx.arsenal&&!C.furiosoGiven&&(C.ars||[]).length>=3){C.furiosoGiven=true;A.furiosoNext=true;L('sys',`  ${A.name} · 서로 다른 무기 3종 · 다음 손패에 Furioso`)}
      /* 회피 실패: 1d5에서 1이면 정신력 1 감소 (E.G.O 장비 1개당 +1) */
      if(B.isP&&d(M.evadeDie)===1&&!(corpType(C.ch)&&corpType(C.ch).year))loseMind(C.ch,1+(C.ch.egoGear||0),t=>L('kw',`  ${B.name} · ${t}`));
      /* 레바테인 계열: 적중 시 화상 */
      if(A.burnHit&&B.hp>0){
        if(A.laev){B.flame=Math.min(CFG.stackCap,(B.flame||0)+A.burnHit);if(A.laev==='open'){B.blue=true;B.blueM=1+(CFG.laev.blueMul-1)*(A.laevF||1);B.blueD=Math.max(1,Math.round(CFG.laev.blueDot*(A.laevF||1)))}
          L('kw',`  ${B.name}에게 ${A.laev==='open'||isBlue(B)?'푸른 화염':'붉은 화염'} +${A.burnHit} (지금 ${B.flame})`);laevCount(A,A.burnHit,L)}
        else{const bp=A.burnHit+(A.wx&&A.wx.burnPlus||0);B.burn=Math.min(Math.round(CFG.burn.max*((A.wx&&A.wx.burnCap)||1)),(B.burn||0)+bp);L('kw',`  ${B.name}에게 화상 +${bp} (지금 ${B.burn})`)}}
      /* 주사위마다 무작위 디버프 1 (Furioso): 출혈 또는 파열 */
      if(c.rngDebuff&&B.hp>0){const got={};for(let i=0;i<c.dice;i++){const k=one(c.rngDebuff);B[k]=Math.min(k==='rupture'?CFG.rupture.max:k==='bleed'?bleedCap(B):CFG.stackCap,B[k]+1);got[k]=(got[k]||0)+1}
        L('kw',`  ${B.name}에게 ${Object.entries(got).map(([k,n])=>D.keywords[k].n+' +'+n).join(' · ')} (무작위)`)}
      if(B.passive&&B.passive.id==='ledger'&&B.hp>0){B.ledger=Math.min(B.passive.need,(B.ledger||0)+1);L('kw',`  ${B.name} · ${B.passive.n} ${B.ledger}/${B.passive.need}`)}
      if(A.passive&&A.passive.id==='echo'&&B.hp>0){
        B.echo=(B.echo||0)+1;L('kw',`  ${B.name}에게 ${A.passive.n} ${B.echo}/${A.passive.need}`);
        if(B.echo>=A.passive.need){hpLoss(C,B,A.passive.dmg,L);B.echo=0;L('dmg',`  ${A.passive.n}이 울린다 · ${B.name} 고정 피해 ${A.passive.dmg}`)}
      }
      push(Object.assign(base,{hit:true,rolls,rolls2:spR,ally2:spR?C.ally.name:null,dmg,note}));
    }
  }
  /* pp, ep: 이번 라운드에 낼 카드 배열 */
  /* 전투 중 도주 굴림: 적에게 flee가 있으면 라운드마다 시도할 수 있다 (대호수의 고래 전용). 1d100 + (회피+속도)/2 ≥ dc면 전투에서 빠져나간다.
     실패하면 그 라운드는 카드를 내지 못하고 공격만 받는다(UI가 빈 손으로 라운드를 진행한다) */
  /* 선장이 된 뒤의 대호수 전투는 도망칠 수 없다 (도망은 1막 초반 선원일 때만) */
  const lakeNoFlee=(ch,id)=>!!(ch&&ch.flags&&ch.flags.lake&&ch.lake&&ch.lake.captain&&/^lake_/.test(id));
  function fleeCheck(C){
    if(lakeNoFlee(C.ch,C.id))return null;
    const e=D.enemies[C.id],F=e&&e.flee;if(!F||C.over)return null;
    const r=d(100),mod=Math.floor(((C.P.eva||0)+(C.P.spd||0))/2)+CFG.lake.navFlee*(C.crew||[]).filter(m=>m.role==='navigator').length,tot=r+mod,ok=tot>=F.dc;
    C.log.push({t:'sys',s:`도주 시도 · 1d100 ${r} + ${mod} = ${tot} / 난이도 ${F.dc} → ${ok?'성공':'실패'}`});
    if(ok)C.over='flee';
    return {ok,r,mod,tot,dc:F.dc};
  }
  /* 도주에 성공한 뒤: 호수를 벗어나 선박장으로 (피해도 보상도 없다, 고래는 남는다) */
  function fleeEnd(G,C){
    const ch=G.ch,L=ch.lake=ch.lake||{};L.phase='enter';L.harbor=true;gainMind(ch,CFG.lake.harborMind);L.fled=(L.fled||0)+1;(L.fledFrom=L.fledFrom||[]).push(C.id);
    return {chips:['도주 성공 · 호수를 벗어나 선박장에 들른다'],text:D.enemies[C.id].fleeText||'고래의 그림자가 멀어졌다. 간신히 호수를 벗어났다.'};
  }
  function resolveRound(C,pp,ep){
    const {P,E}=C;
    C.cur=[];C.evs=[];
    /* 궁니르 공명: 궁니르 카드를 낸 라운드는 받는 피해 60% 감소 */
    if(P.resonance&&pp.some(c=>c.gungnir))P.drRound=C.round;
    const L=(t,s)=>{if(C.quiet)return;C.log.push({t,s});C.cur.push({t,s})};
    /* 보랏빛 사복검: 서로 다른 자세의 4코스트 카드를 두 가지 쓰면 다음 손패에 환영난무, 몇 라운드 동안 최대 빛 증가 (전투에 한 번) */
    if(P.isP&&P.wx&&P.wx.forms){C.vsTop=C.vsTop||[];pp.forEach(c=>{if(c.vsTop&&!C.vsTop.includes(c.vsTop))C.vsTop.push(c.vsTop)});if(C.vsTop.length>=2&&!C.vsGiven){C.vsGiven=true;giveNext(P,'x_vs_ego');P.burstLight=CFG.form.burstLight;P.burstTo=C.round+CFG.form.burstRounds;L('sys',`  ${P.name} · 3코스트 이상 두 자세 · 다음 손패에 환영난무 · 최대 빛 +${CFG.form.burstLight} (${CFG.form.burstRounds}라운드)`)}}
    const push=ev=>{if(C.quiet)return;if(C.rollPend){C.cur.unshift({t:'sys',s:`  판정 1d100 ${C.rollPend.r} / 개화 ${C.rollPend.th} 이하`,roll:C.rollPend});C.rollPend=null}ev.lines=C.cur;C.cur=[];ev.snap=snap(C);ev.step=C.step;C.evs.push(ev)};
    L('head',`— ${C.round}라운드 · ${C.order[0].name} 선공 —`);
    if(C.round===1&&C.mindNote&&C.mindNote.length)C.mindNote.forEach(t=>L('kw',t));
    if(C.jobNote)L('kw',C.jobNote);
    if(C.triNote){L('kw',C.triNote);C.triNote=null}
    if(C.formNote){L('kw',C.formNote);C.formNote=null}
    if(C.kidNote){L('kw',C.kidNote);C.kidNote=null}
    if(C.duel&&C.round===1)L('kw',`${CFG.duel.n} · 서로에게 주는 피해 +${C.duel}`);
    if(C.traitNote)L('kw',C.traitNote);
    /* 검지 지령 수행: ☆ 칸의 카드를 내면 스택 +1 (최대 5) · 호흡 +4 · 받는 피해 스택당 −5% */
    if(P.index&&P.starId){
      const did=pp.includes(D.cards[P.starId]),cap=P.oracle?CFG.oracle.presc:5;
      if(did){const full=(P.presc||0)>=cap;if(full&&!P.oracle){P.prescOver=(P.prescOver||0)+1;if(P.prescOver%CFG.prescPlus.every===0&&(P.prescPlus||0)<CFG.prescPlus.max){P.prescPlus=(P.prescPlus||0)+1;L('kw',`${P.name} · 지령 초과 수행 · 카드 수치 +${P.prescPlus} (최대 ${CFG.prescPlus.max})`)}}P.presc=Math.min(cap,(P.presc||0)+1);P.breath=Math.min(CFG.breath.cap,P.breath+4);L('kw',`${P.name} · 지령 수행 ${P.presc}/${cap} · 호흡 +4 · 받는 피해 −${P.presc*5}%`)}
      else if(P.oracle){P.oracleMiss=true;L('kw',`${P.name} · 지령 독촉 · 지령을 수행하지 못했다 · 다음 라운드 명중 −${CFG.oracle.missHit} · 회피 −${CFG.oracle.missEva}`)}
    }
    C.step=-1;push({k:'head'});
    P.evaB=E.evaB=0;
    if(C.escort){const es=C.escort,Z=CFG.escort,K=bondTx(C.ch).escort.kinds[es.kind];
      if(C.round===1)L('sys',`${es.name} · 동행 의뢰 · ${K.tag}`);
      if(es.kind==='support'){const sh=Z.support.shield+Z.support.shieldPer*es.lv,hl=Math.max(0,Math.min(Z.support.heal+Z.support.healPer*es.lv,P.maxHp-P.hp));P.shield=Math.min(CFG.shieldCap,(P.shield||0)+sh);if(hl>0){P.hp+=hl;HG(P,hl)}L('kw',`  ${es.name} · 지원 · 보호막 +${sh}${hl>0?` · HP +${hl}`:''}`)}}
    if(P.odin&&P.odinMid)L('kw',`${P.name} · 오딘의 눈 · 되갚음의 예지 · 이번 라운드 첫 피격 되갚음 +${CFG.odin.midHit}`);else if(P.odin){const v=odinEva(C.round,P);L('kw',`${P.name} · 오딘의 눈 · ${P.yeji?'가속하는 미래':'순간의 예지'} · 회피 ${v>0?'+':''}${v}${v<0?' (과부하)':''}`)}
    if(P.laev==='open'&&C.round>1&&C.round%CFG.laev.selfEvery===0){P.flame=Math.min(CFG.stackCap,(P.flame||0)+1);L('kw',`${P.name} · 레바테인 · 자신에게 붉은 화염 1 (지금 ${P.flame})`)}
    /* 아무 카드도 내지 않으면 방어 자세 */
    for(const [X,plays] of [[P,pp],[E,ep]]){
      X.guarding=plays.length===0&&!X.stunned;
      if(X.guarding){
        X.passHitNext=CFG.guard.nextHit;X.lightNext=CFG.guard.lightNext||0;X.lightUp=Math.max(X.lightUp,Math.min(CFG.guard.lightUpMax,X.lightUp+CFG.guard.lightUp));
        L('sys',`${X.name} · 방어 자세 · 이번 라운드 방어 판정 · 다음 라운드 명중 +${CFG.guard.nextHit} · 빛 +${CFG.guard.lightUp} (전투 동안)`);
        /* 플레이어 방어 자세: 출혈을 지혈해 스택을 줄인다 */
        if(X.isP&&X.bleed>0&&CFG.guard.bleedCut){const b0=X.bleed;X.bleed=Math.floor(X.bleed*CFG.guard.bleedCut);L('kw',`  ${X.name} 지혈 · ${D.keywords.bleed.n} ${b0} → ${X.bleed}`)}
        push({k:'def',side:X.uid,card:{n:'방어 자세'}});
      }
    }
    queue(C,pp,ep).forEach((st,i)=>{
      C.step=i;const A=C[st.side],c=st.card;
      if(c.next){const nx_=!A.isP&&A.zChain?zNext(A,c):c.next;if(A.isP)giveNext(A,c.next);else A.forceNext=nx_;L('sys',`${A.name} · ${c.n} · 다음 라운드 ${D.cards[nx_].n} 준비`)}
      if(A.isP&&c.t==='atk'&&(c.shield||c.lightNext)){if(c.shield){A.shield=Math.min(CFG.shieldCap,(A.shield||0)+c.shield);L('kw',`  ${A.name} · ${c.n} · 보호막 +${c.shield} (지금 ${A.shield})`)}if(c.lightNext){A.lightNext=(A.lightNext||0)+c.lightNext;L('kw',`  ${A.name} · ${c.n} · 다음 라운드 빛 +${c.lightNext}`)}}
      if(A.isP&&c.bloomGrant&&D.cards[c.bloomGrant]){A.bloomUses=(A.bloomUses||0)+1;L('sys',`  ${A.name} · 개화 ${A.bloomUses}회${A.bloomUses%CFG.bloom.every?` · ${CFG.bloom.every-A.bloomUses%CFG.bloom.every}회 더 쓰면 1회용 스킬`:''}`);if(A.bloomUses%CFG.bloom.every===0){giveNext(A,c.bloomGrant);L('sys',`  ${A.name} · ${c.n} · 다음 라운드 손패에 ${D.cards[c.bloomGrant].n} (1회용)`)}}
      if(A.isP&&c.egoGrow&&!A.mf){A.mf=true;const M_=CFG.egoGrow.mf[egoLvFor(C.ch.egoUses||0)];A.atk=Math.round(A.atk*(1+M_));A.eva=Math.round(A.eva*(1+M_));L('kw',`${A.name} · E.G.O 발현 · 이번 전투 동안 공격·회피 +${Math.round(M_*100)}% · 책장 카드가 강해진다`)}
      if(A.isP&&c.egoGrow){C.ch.egoUses=(C.ch.egoUses||0)+1;const up=egoGrow(C.ch);
        /* 특수 강화는 그 자리에서: 장착 중이면 이번 전투 수치도 바로 바꾼다 */
        if(up&&up.worn){for(const k of ['atk','eva'])A[k]+=(up.nw.fx[k]||0)-(up.old.fx[k]||0);A.wx=up.nw.wx}
        if(up)L('kw',`${A.name} · ${c.n} ${C.ch.egoUses}회 · E.G.O ${CFG.egoGrow.tier[up.nw.egoLv]} · ${up.nw.n}`)
        else{const G_=CFG.egoGrow,u_=C.ch.egoUses,L_=egoLvFor(u_),nx_=G_.need[L_+1];if(nx_!=null)L('kw',`${A.name} · ${c.n} ${u_}회 · E.G.O ${G_.tier[L_]} → ${G_.tier[L_+1]}까지 ${nx_-u_}회`)}}
      if(A.isP&&c.mindCost)loseMind(C.ch,c.mindCost,t=>L('kw',`${A.name} · ${c.n} · ${t}`));
      /* 오랜 굶주림: 공격 카드를 낼 때 쌓인 스택을 모두 써서 그 카드의 첫 적중 피해가 늘고, 스택은 비운다 */
      /* 보라눈물: 뱀의 장벽을 쓸 때마다 스택 +1(최대 7), 환영난무를 내면 쌓인 만큼 추가 피해를 주고 스택을 비운다 */
      if(c.serpent){A.vtStack=Math.min(CFG.serpent.max,(A.vtStack||0)+1);L('kw',`${A.name} · ${c.n} · 뱀의 장벽 ${A.vtStack}/${CFG.serpent.max} · 환영난무 빛 −1`)}
      A.vtUse=0;if(c.serpentDmg){A.vtUse=A.vtStack||0;A.vtStack=0;if(A.vtUse>0)L('kw',`${A.name} · ${c.n} · 뱀의 장벽 ${A.vtUse} 소진 · 피해 +${A.vtUse}`)}
      /* 보랏빛 사복검: 전용 책장 카드를 낼 때마다 이름이 익스큐셔너 소드·레이피어·카타나 중 하나로 바뀐다. 같은 계열 카드는 피해 +1 */
      A.vtBonus=0;if(A.isP&&A.wx&&A.wx.vform&&c.vform){const forms=CFG.vform;const f=one(Object.keys(forms));A.vform=f;L('kw',`${A.name} · 보랏빛 사복검 · ${forms[f]}(으)로 바뀐다`);if(c.vform===f){A.vtBonus=1;L('kw',`  ${forms[f]} · ${c.n} 피해 +1`)}}
      A.hungerUse=0;if(A.hunger>0&&c.t==='atk'){A.hungerUse=A.hunger;L('kw',`${A.name} · 오랜 굶주림 ${A.hunger} 소진 · 이 카드의 첫 적중 피해 +${A.hunger}`);A.hunger=0}
      if(c.hpCost&&A.hp>1){const x=Math.min(c.hpCost,A.hp-1);A.hp-=x;L('kw',`${A.name} · ${c.n} · HP −${x}`)}
      /* 충전: 카드를 낼 때 spend만큼(있는 만큼) 소모하고, 소모한 충전 1당 fixPer의 고정 피해를 적중마다 더한다 */
      if(c.once&&A.isP){const id_=Object.keys(D.cards).find(k=>D.cards[k]===c);if(id_)(C.onceUsed=C.onceUsed||[]).push(id_)}
      if(c.cd&&A.isP){const id_=Object.keys(D.cards).find(k=>D.cards[k]===c);if(id_)(C.cdUntil=C.cdUntil||{})[id_]=C.round+c.cd+1}
      A.focusOn=!!(A.focus&&A.charge>=A.focus.at);A.expOn=!!(A.chargeExp&&A.charge>=A.chargeExp.at);A.spent=0;if(c.spend&&A.charge>0){A.spent=Math.min(A.charge,c.spend+(A.wx&&A.wx.edge?A.wx.edge.spend:0));A.charge-=A.spent;L('kw',`${A.name} · ${c.n} · 충전 ${A.spent} 소모 (남은 ${A.charge})`)}
      if(A.isP&&c.mindGain){const g=gainMind(C.ch,c.mindGain);if(g)L('kw',`${A.name} · ${c.n} · 정신력 +${g} (${C.ch.mind})`)}
      if(c.t==='def'){A.defRound=C.round;if(c.egBrace){A.egBrace=C.round;A.egBraceN=c.egBrace+(A.mf&&c.egBraceMf||0)}cutStacks(A);if(c.kw)applyKw(A,A===C.P?C.E:C.P,c,L);if(c.charge)A.charge=Math.min(A.chargeCap,A.charge+c.charge);if(c.shield){const sh_=c.shield+(A.prescPlus||0);A.shield=Math.min(CFG.shieldCap,(A.shield||0)+sh_);L('kw',`${A.name} · ${c.n} · 보호막 +${sh_} (지금 ${A.shield})`)}if(c.selfHit)A.passHit+=c.selfHit;const ev=(c.eva||CFG.defBonus)+A.defUp+(A.prescPlus||0);A.evaB+=ev;if(c.lightNext)A.lightNext=(A.lightNext||0)+c.lightNext;L('sys',`${A.name} · ${c.n} · 이번 라운드 회피 +${ev}${c.lightNext?` · 다음 라운드 빛 +${c.lightNext}`:''}`);push({k:'def',side:A.uid,card:c});return}
      if(P.hp<=0||E.hp<=0)return;
      act(C,A,c,L,push);
      ampUse(C,L);
    });
    C.step=-1;
    /* 인연의 추가 공격 */
    if(C.escort&&C.escort.kind==='fighter'&&E.hp>0&&P.hp>0){const es=C.escort,Z=CFG.escort.fighter,x=Z.base+Z.per*es.lv+d(Z.rand)-1;E.hp=Math.max(0,E.hp-x);L('dmg',`${es.name} · 협공 · ${E.name}에게 고정 피해 ${x}`);push({k:'bleed',side:'E',dmg:x})}
    {const A_=C.round===1?C.allyFirst:null;if(A_&&E.hp>0&&P.hp>0){const x=Math.max(1,CFG.bond.ally.base+CFG.bond.ally.per*A_.lv+d(7)-4);E.hp=Math.max(0,E.hp-x);L('dmg',`${A_.name} · 인연의 추가 공격 · ${E.name}에게 ${x} 피해`);push({k:'bleed',side:'E',dmg:x})}}
    if(E.passive&&E.passive.id==='lkSilence'&&E.hp>0&&P.hp>0){const R=Object.assign({},E.passive,{limit:E.passive.limit+2*(C.crew||[]).filter(m=>m.role==='navigator').length}),noise=pp.reduce((a,c)=>a+(c.t==='def'?0:c.c+(c.hits>=3?1:0)),0);
      if(noise>=R.limit){hpLoss(C,P,R.dmg,L);L('dmg',`${E.name} · 소음 ${noise}/${R.limit} · 호수가 울렸다 · ${P.name} 고정 피해 ${R.dmg}`)}else L('kw',`${E.name} · 소음 ${noise}/${R.limit} · 호수가 조용하다`)}
    /* 연주(피아니스트): 라운드마다 악장 1. every에 닿으면 고정 피해 dmg, 그 라운드에 방어 자세였으면 절반 */
    if(E.passive&&E.passive.id==='recital'&&E.hp>0&&P.hp>0){
      const R=E.passive;E.recital=(E.recital||0)+1;
      if(E.recital>=R.every){const x=P.guarding?Math.floor(R.dmg/2):R.dmg;hpLoss(C,P,x,L);E.recital=0;L('dmg',`${E.name} · ${R.n} · 절정 · ${P.name} 고정 피해 ${x}${P.guarding?' (방어 자세로 절반)':''}`)}
      else L('kw',`${E.name} · ${R.n} ${E.recital}/${R.every}${E.recital===R.every-1?' · 다음 라운드 끝에 절정 (방어 자세면 절반)':''}`);
      push({k:'buff',side:'E',card:{n:R.n}});
    }
    /* 푸른 화염: 라운드 끝에 스택 × blueDot 피해, 그 뒤 1 감소. 해방 레바테인 소지자의 일반 화상은 줄지 않는다 */
    for(const X of [P,E]){
      if(isBlue(X)&&X.hp>0){const x=X.flame*(X.blueD||CFG.laev.blueDot);hpLoss(C,X,x,L);X.flame--;L('dmg',`${X.name} · 푸른 화염 ${x} 피해 (남은 ${X.flame})`)}
      else if(X.flame>0&&!(X.isP&&X.laev==='open'))X.flame--;
      /* 화상: 라운드 끝에 스택만큼 피해, 그 뒤 스택은 keep 비율만 남는다 (내림) */
      if(X.oracleMiss){X.oracleMiss=false;X.passHitNext=(X.passHitNext||0)-CFG.oracle.missHit;X.evaPenNext=CFG.oracle.missEva}
      if(X.stunned){X.stunned=false;X.stagger=0;X.stunImmune=C.round+3}else if(X.stagger>0)X.stagger=Math.max(0,X.stagger-CFG.nail.decay);
      if(X.burn>0&&X.hp>0){const x=X.burn*(X.isP?CFG.burn.dmgMe:CFG.burn.dmg),O_=X===P?E:P,tk=O_.wx&&O_.wx.burnTick?Math.min(X.burn,CFG.burn.tickCap):0;hpLoss(C,X,x,L);X.burn=Math.floor(X.burn*CFG.burn.keep);L('dmg',`${X.name} · 화상 ${x} 피해 (남은 ${X.burn})`);
        /* 달궈진 십자가: 라운드 끝에 화상 수치만큼 고정 피해를 더 준다 (상한 tickCap) */
        if(tk>0&&X.hp>0){hpLoss(C,X,tk,L);L('dmg',`${O_.name} · 달궈진 십자가 · ${X.name} 고정 피해 ${tk}`)}}
      if(X.ink>0&&X.hp>0){const x=X.ink*(X.isP?CFG.ink.dmgMe:CFG.ink.dmg);hpLoss(C,X,x,L);X.ink=Math.floor(X.ink*CFG.ink.keep);L('dmg',`${X.name} · 수흔 ${x} 피해 (남은 ${X.ink})`)}
      if(X.kuro&&X.black){X.black=false;X.cloud=CFG.syn['흑운회'].reset;L('kw',`${X.name} · 흑운이 가라앉았다 · 구름 ${X.cloud}`)}
      for(const k of ['prescript','warp','shock','chain','web','sink'])if(X[k]>0)X[k]--}
    /* 무한 모드 침식: 오래 살수록 라운드마다 고정 피해 (회피·보호막으로 막을 수 없다) */
    if(C.ch.infinite&&!(C.ch.outSeen&&C.ch.outSeen.seal)&&P.hp>0&&E.hp>0){const IN=CFG.infinite,e_=(C.ch.year||0)-IN.erodeFrom,x=Math.min(IN.erodeMax,Math.floor(e_*IN.erodePer));
      if(e_>0&&x>0){hpLoss(C,P,x,L);L('dmg',`${P.name} · 세계의 균열이 몸을 갉는다 · 고정 피해 ${x}`)}}
    /* 지구전 압박: from라운드부터, 피해를 연속 miss라운드 이상 한 번도 주지 못한 쪽은 라운드마다 최대 HP의 per%×(연속 못 준 라운드 수 − miss + 1) 고정 피해(상한 max%)를 받는다. 한 번이라도 맞히면 처음부터 다시 쌓인다 */
    {const F=CFG.fatigue,n=C.round-F.from+1;if(n>0&&C.ch.infinite&&infYears(C.ch)>0&&D.enemies[C.id].hidden&&P.hp>0&&E.hp>0&&!(E.passive&&E.passive.id==='trial')){
      if(n===1)L('sys','싸움이 길어진다 · 지친 숨이 거칠어진다 · 이제 상대에게 피해를 연달아 주지 못한 쪽이 라운드마다 최대 HP의 일부를 잃는다');
      /* 중지: 회피를 못 하는 대신 방어 자세로 받아낸 라운드는 상대가 피해를 준 것으로 치지 않는다 */
      if(P.middle&&(P.defRound===C.round||P.guarding)&&E.dealtR===C.round)E.dealtR=0;
      for(const X of [P,E]){if(X.dealtR===C.round){X.dry=0;continue}X.dry=(X.dry||0)+1;if(X.dry<F.miss)continue;
        const r=!X.isP&&X.maxHp>=CFG.infinite.hpMax?F.capRate.reduce((q,[at,v])=>n>at?v:q,F.capRate[0][1]):Math.min(F.max,F.per*(X.dry-F.miss+1)),x=Math.max(1,Math.round(X.maxHp*r));hpLoss(C,X,x,L);L('dmg',`${X.name} · 지침 · ${X.dry}라운드째 피해를 주지 못했다 · 고정 피해 ${x}`)}}}
    ampUse(C,L);
    if(P.hp<=0||C.ch.mindDead)C.over='lose';else if(E.hp<=0&&E.passive&&E.passive.id==='lkGenesis'&&(E.reborn||0)<E.passive.times){E.reborn=(E.reborn||0)+1;E.hp=Math.round(E.maxHp*E.passive.back);E.bleed=0;E.rupture=0;E.harpoon=0;L('kw',`${E.name} · 쓰러진 줄 알았던 몸이 호수에서 다시 일어선다 · HP ${E.hp}`)}else if(E.hp<=0)C.over='win';else if(E.passive&&E.passive.id==='trial'&&C.round>=E.passive.rounds)C.over='win';
  }
  /* K사 엠플: 살아 있고 HP가 최대 HP의 belowPct 이하이면 자동으로 쓴다 (한 번에 1개, 전투당 제한 없음) */
  /* HP를 잃는다. 플레이어가 한 번에 쓰러질 피해(공격·출혈·화상·고정 피해 모두)를 받으면, 쓰러지기 전에 K사 엠플이 먼저 쓰이고 받은 피해만큼 회복이 깎인다 (HP − 피해 + 회복) */
  function hpLoss(C,X,x,L){
    if(X.isP&&X.ample>0&&x>=X.hp&&!X.distorted){
      const K=CFG.ample;let h=X.hp-x,u=0;
      const ah_=Math.floor(X.maxHp*K.healPct);while(X.ample>0&&h<=0){X.ample--;u++;h+=ah_}
      h=Math.min(h,X.maxHp);X.hp=Math.max(0,h);
      L('amp',`${X.name} · ${K.name} ${u}개 사용 (치명적인 피해 ${x} · 회복 ${ah_*u}에서 깎여 HP ${X.hp}, 남은 ${X.ample}개)`);
      return;
    }
    {const b_=X.hp;X.hp=Math.max(0,X.hp-x);const R_=C&&C.ch&&C.ch.rs;if(R_&&b_>X.hp){if(X.isP)R_.taken=(R_.taken||0)+(b_-X.hp);else R_.dealt=(R_.dealt||0)+(b_-X.hp)}}
  }
  function ampUse(C,L){
    const P=C.P,K=CFG.ample;if(!(P.ample>0)||P.hp<=0||P.hp>Math.floor(P.maxHp*K.belowPct)||C.E.hp<=0)return;
    const h=Math.min(Math.floor(P.maxHp*K.healPct),P.maxHp-P.hp);P.hp+=h;P.ample--;L('amp',`${P.name} · ${K.name} 사용 · HP +${h} · 지금 ${P.hp}/${P.maxHp} (남은 ${P.ample}개)`);
  }
  /* 자동 전투 (시뮬): 카드 고르는 순서도 행동 순서를 따른다 */
  function fightAuto(ch,id){
    const C=mkCombat(ch,id,true);let g=0;
    while(!C.over&&g++<80){
      let pp,ep;
      autoTri(C);
      pp=autoPlay(C.P.hand.filter((id,i)=>i!==C.P.locked&&!((D.cards[id].needBlack&&!C.P.black)||(D.cards[id].needLow&&C.E.hp>C.E.maxHp*CFG.raven.low))),C.P.light);ep=C.ePlan;
      resolveRound(C,pp,ep);
      if(!C.over)newRound(C);
    }
    return C;
  }

  /* ===== 밸런스 측정 ===== */
  const chainIds=()=>Object.keys(D.fixedFights).sort((a,b)=>a-b).map(y=>D.fixedFights[y]);
  function chainSim(n,grow){
    let clear=0;
    for(let t=0;t<n;t++){
      const ch=newChar();let ok=true;
      for(const [fi,sp] of chainIds().entries()){
        const id=encounter(ch,sp).id;
        if(grow)for(let g=0;g<(CFG.simGrowth[fi]||0);g++)applyFx(ch,one(rollGrowth()).g.fx);
        const C=fightAuto(ch,id);
        if(C.over!=='win'){ok=false;break}
        ch.hp=Math.min(ch.stats.maxHp,C.P.hp+CFG.chainHeal);
        if(grow){const c=rewardCard(ch);if(c)putCard(ch,c)}
      }
      if(ok)clear++;
    }
    return clear/n;
  }
  function simulate(n){
    const rows=Object.keys(D.enemies).map(id=>{
      let w=0,rs=0,hl=0;
      for(let i=0;i<n;i++){const C=fightAuto(newChar(),id);rs+=C.round;if(C.over==='win'){w++;hl+=C.P.hp}}
      return {id,n:D.enemies[id].n,hidden:!!D.enemies[id].hidden,win:w/n,rounds:rs/n,left:w?hl/w:0};
    });
    return {n,rows,chain:chainSim(n,false),grown:chainSim(n,true),chainIds:chainIds()};
  }

  return {D,d,reseed,sample,newChar,setColor,license,promote,rankLabel,applyFx,xpNext,gainXp,rollGrowth,
    wsOpen,wsEnsure,wsRename,wsMelt,wsAugPick,wsAugChoose,wsAugOk,wsNeed,wsHidden,
    cardCost,colorPasv,setColorPick,setPartnerAlias,partnerAliasErr,fleeCheck,fleeEnd,    setLegacy:fn=>{legacyFn=fn},setGhost:fn=>{ghostFn=fn},ghostOf,bondRouteOf,buyMind,mindClinicPrice,equipUp,rankMet,infiniteEvent,setInnateOpen,corpClearCheck,setStable,setStar,upItem,starItem,distStableEvent,innateUnlocks,offerPick,pickTake,pickSkip,isFinger,extraOut,tuneMax,canFingerUp,blankFate,bonCardB,giveRelic,relicChance,acceptPack,acceptPackAlt,repairStats,custKind,custNoun,custIntro,custBuild,nBlocked,wsCustom,declinePack,switchPack,packCan,renamePack,ensurePacks,bonItem,bonNeed,bonUpgrade,egoItem,egoLvFor,isN,deckMax,setSing,setWing,setPill,pillStats,renameForm,singNameErr,wingNameErr,corpType,singChips,mindMax,offerGear,canFound,officeNameErr,setOffice,officeBroker,officeCards,OKW,resolveGear,takeOffer,offerPick,pickTake,pickSkip,dropOffer,deckOut,deckIn,sideDrop,autoOffers,cardBox,boxPool,deckRoom,relicChoices,applyGrowth,earn,priceOf,sellValue,isWs,sellCard,cardPrice,equip,equipStash,shopAccess,canBuy,buy,canBuySpecial,buySpecial,income,money,encounter,answerOmen,meets,newGame,age,advanceYear,options,checkMod,pathMod,choose,winRewards,
    isFounder,equip,egoItem,egoDeck,bondSweetEvent,lakeNoFlee,infGrowth,waveEv,hullOf,repairHull,supplyPrice,supplyName,supplyCount,buySupply,useSupply,bondTx,setRbTeam,infEvaCut,infYears,chooseFinger,chooseOrg,lockedOptions,nailThr,setSeongdo,familyHunter,spouseLevel,bondFill,bondData,setTri,triOk,setForm,formOk,formId,bondNameErr,setBondName,bondMarried,nameErr,swapCard,tuneGear,tuneCost,aidCount,buyAid,critPct,lastYear,buyHeal,clinicPrice,buyAmple,ampPrice,gradeAt,gradeRaw,checkDie,setDistort,cardGrade,loseMind,gainMind,mindTier,mindStat,synOf,synTier,kidNameErr,setKidName,egoNameErr,setEgo,delCard,promoNeed,examReady,checkDc,canPromote,ptsName,career,fixedSpec,mkCombat,newRound,queue,autoPick,resolveRound,aiPlan,autoPlay,snap,fightAuto,chainSim,simulate};
}
