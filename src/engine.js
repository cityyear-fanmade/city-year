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
    if(!D.slots[it.slot])err.push(`공방 물건 ${id}: 없는 칸 "${it.slot}"`);
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
  function childhood(s){
    return D.childhood.stages.map(st=>{const r=d(100),x=pick(D.childhood.table,r);addStats(s,x.fx);return {age:st.age,r,x}});
  }
  /* job: 히든 직업으로 태어나면 출신 칸이 그 직업으로 바뀐다 (발톱 1, 조율자 100). 나머지 굴림은 같은 시드 그대로 */
  /* 출생 보정 없이 시작: 출신·재능·결점·무기·타고난 것이 없고, 성장기 보정과 색만 남는다. keep = {r, kid} (이미 굴린 출생에서 가져온다) */
  const BLANK={o:{n:'아무것도 없는 존재',t:'이름도 내력도 쥐여 주지 않은 채 태어났다.',e:'출생 보정 없음 · 성장기 보정만 가진다',fx:{},paths:{},flags:{},deck:['slash','thrust','smash','guard']},
    t:{n:'재능 없음',t:'',e:'',fx:{}},f:{n:'결점 없음',t:'',e:'',fx:{}},w:{n:'맨손',e:'아무것도 쥐지 않았다',fx:{}}};
  function newChar(job,fixO,keep){
    const r=keep?Object.assign({},keep.r):{o:d(100),t:d(100),f:d(100),w:d(100),n:d(100)},J=!keep&&job&&D.hiddenJobs[job];
    if(J)r.o=J.roll;
    else if(fixO)r.o=fixO;
    /* 6시즌 히든 출생: 출신 굴림이 정확히 그 숫자면 표의 칸 대신 숨은 출신 (예: 90 → 보냐텔리 가문) */
    const HO=!J&&!keep&&(D.hiddenOrigins||[]).find(x=>x.roll===r.o);
    const o=keep?BLANK.o:J?{n:J.n,t:J.t,e:J.e,fx:J.fx,card:J.cards[0],paths:{},flags:{}}:HO||pick(D.origins,r.o),t=keep?BLANK.t:pick(D.talents,r.t),f=keep?BLANK.f:pick(D.flaws,r.f),w=keep?BLANK.w:pick(D.weapons,r.w),ci=Math.floor((r.n-1)/10);
    const s={maxHp:CFG.baseHp,atk:0,eva:0,spd:0,check:0,startBleed:0,startBreath:0,enemyHp:0,dmin:1,dminUp:0,dr:0,regen:0,defUp:0,adv:0,extraD2:0,dmgB:0,burnHit:0,pdie:6,advDie:0,mindMax:0,egoSight:0,relicApt:0};
    for(const x of [o,t,f])addStats(s,x.fx);
    const kid=keep?keep.kid.map(k=>{addStats(s,k.x.fx);return k}):childhood(s);
    const ch={r,o,t,f,w,kid,ci,blank:!!keep,color:D.colors[ci].hex,licensed:false,title:null,aff:null,paths:Object.assign({},o.paths),
      flags:Object.assign({},o.flags),beaten:[],unlocks:[],mind:CFG.mind.max+(s.mindMax||0),stats:s,hp:s.maxHp,gear:{},money:D.money.start[o.n]||o.money||0,
      deck:o.deck?o.deck.slice():['slash','thrust','smash','guard',o.card],xp:0,lv:1,lvPend:0,lvOpts:null};
    ch.s0={maxHp:s.maxHp,atk:s.atk,eva:s.eva,spd:s.spd,check:s.check};
    if(o.race)ch.race=o.race;if(o.relicPick)ch.relicPick=true;if(o.thumbBias)ch.thumbBias=o.thumbBias;if(o.cardMoney)ch.cardMoney=true;if(o.relicBase)ch.relicBase=o.relicBase;
    if(o.sub){ch.relics=[...(ch.relics||[]),o.sub.n];if(o.sub.hwando)ch.hwando=true}
    /* 타고난 것 (히든): 출생 굴림 값의 해시로 정한다 */
    const IN=CFG.innate,h=(r.o*7919+r.t*104729+r.f*1299709+r.w*15485863+r.n*32452843+ch.kid.reduce((a,k)=>a*31+k.r,7))%1000003;
    if(!keep&&h%IN.chanceDiv===0){const ks=Object.keys(D.innate||{});if(ks.length)ch.innate=ks[Math.floor(h/IN.chanceDiv)%ks.length]}
    if(J){ch.job=job;ch.aff={type:'head',name:'머리'};if(J.deck){ch.deck=J.deck.slice();ch.cardMoney=true}else for(const c of J.cards.slice(1))ch.deck.push(c);ch.money=J.money||0;ch.relics=[J.n]}
    /* 출생 때 굴린 무기는 무기 칸의 첫 장비 */
    equip(ch,{id:'birth',slot:'weapon',n:w.n,e:w.e,fx:w.fx});
    /* 히든 직업 전용 무기: 출생 무기는 보관함으로 */
    if(J&&J.weapon)equip(ch,Object.assign({grade:5},J.weapon));
    if(o.weapon===true)equip(ch,bonItem(0));
    /* E.G.O 발현자(20): 해결사 9급, 무작위 E.G.O 무기, 그 이름으로 개화한 E.G.O (종류 무작위) */
    if(o.egoWeapons){const g=o.egoWeapons[d(o.egoWeapons.length)-1];equip(ch,egoItem(g.id,0));ch.egoUses=0;ch.stash=(ch.stash||[]).filter(x=>x.id!=='birth');
      ch.egoGear=(ch.egoGear||0)+1;setEgo(ch,d(2)===1?'atk':'def',g.n);ch.mind=CFG.mind.max+(s.mindMax||0);license(ch);ch.colorBonus=o.colorBonus||0;ch.colorFx=o.colorFx||null}
    return ch;
  }
  /* 유물 적성자: 출생 때 고른 유물 지급 */
  function giveRelic(ch,id,late){
    const R=D.relics[id];if(!R)return;
    (ch.relics=ch.relics||[]).push(R.n);(ch.relicIds=ch.relicIds||[]).push(id);ch.relicPick=false;ch.relicPickLate=false;
    if(R.odin){ch.odin=true;if(ch.o&&ch.o.n==='보냐텔리 가문')ch.yeji=true}
    /* 환도 + 궁니르: 공명 패시브와 전용 카드 2장 */
    if(id==='gungnir'&&ch.hwando&&!ch.resonance){ch.resonance=true;ch.relics.push('궁니르 공명');ch.deck.push('g_gungnir','g_gungnir')}
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
    if(ch.distForm||(item.slot==='aug'&&isN(ch))){(ch.stash=ch.stash||[]).push(item);return}
    const s=ch.stats,old=ch.gear[item.slot];
    if(old)for(const [k,v] of Object.entries(old.fx))if(k!=='dmin'&&k in s){s[k]-=v;if(k==='maxHp')ch.hp=Math.min(ch.hp,s.maxHp)}
    for(const [k,v] of Object.entries(item.fx))if(k!=='dmin'&&k in s){s[k]+=v;if(k==='maxHp')ch.hp+=v}
    ch.gear[item.slot]=item;
    /* 빼낸 장비는 버리지 않고 보관함으로 */
    if(old)(ch.stash=ch.stash||[]).push(old);
    s.dmin=calcDmin(ch);
    /* 무기 피해 주사위 면 수 (궁니르 d10). 장비 중 가장 큰 값, 기본 d6 */
    s.pdie=Math.max(6,...Object.values(ch.gear).map(g=>g.fx.die||6));
    if(item.card&&!ownsCard(ch,item.card)&&!ch.deckLocked)putCard(ch,item.card);
  }
  /* ===== 6시즌: N사 날개 · 의체 심판: 의수를 쓰지 않고, 의체 상대(enemies aug)를 심판한다 ===== */
  const isN=ch=>!!ch.aff&&ch.aff.name===CFG.nWing.name;
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
    const B=CFG.bon;return (B.cardB[w.lvl||0]||0)+Math.min(B.lateMax,Math.floor(Math.max(0,((ch.year||0)-B.lateFrom))/B.lateEvery)*B.latePer);
  }
  function bonItem(L){
    const B=CFG.bon,fx={atk:B.atk[L],eva:B.eva[L]};if(B.dmgB[L])fx.dmgB=B.dmgB[L];
    return {id:'bonatelli',slot:'weapon',grade:5,lvl:L,n:'보냐텔리의 검'+(L?' +'+L:''),
      e:`공+${fx.atk} · 회피+${fx.eva}${fx.dmgB?' · 피해+'+fx.dmgB:''} · 가속(공격한 라운드마다 명중·회피 +5, 최대 3)`,fx,wx:{accel:B.accel}};
  }
  /* ===== 6시즌: E.G.O 발현자의 무기 성장 =====
     전용 카드 '발현'을 낸 누적 횟수가 CFG.egoGrow.need에 닿는 순간 TETH → HE → WAW → ALEPH. 수치는 egoWeapons[].grow[등급-1] */
  const egoBase=id=>{for(const o of D.hiddenOrigins||[])for(const g of o.egoWeapons||[])if(g.id===id)return g;return null};
  function egoItem(id,L){
    const b=egoBase(id),g=L?b.grow[L-1]:b,it=structuredClone({id:b.id,slot:b.slot,n:b.n,e:g.e,fx:g.fx,wx:g.wx});
    return Object.assign(it,{grade:L>=2?5:4,egoLv:L});
  }
  const egoLvFor=u=>CFG.egoGrow.need.reduce((a,n,i)=>u>=n?i:a,0);
  /* 발현을 낸 직후 확인: 장착 중이든 보관함이든 E.G.O 무기 하나를 올린다. 올렸으면 {old,nw} */
  /* 정비한 장비가 다른 등급 장비로 바뀔 때(E.G.O 성장·보냐텔리 강화) 정비 횟수와 강화분을 넘겨 준다 */
  function carryTune(old,nw){if(!old||!(old.tries||old.tune))return nw;nw.tries=old.tries||0;if(old.tune){nw.tune=Object.assign({},old.tune);for(const [k,v] of Object.entries(old.tune))nw.fx[k]=(nw.fx[k]||0)+v}return nw}
  function egoGrow(ch){
    if(ch.egoUses==null)return null;
    const st=ch.stash||[],w=ch.gear.weapon,L=egoLvFor(ch.egoUses),own=w&&egoBase(w.id)?w:st.find(x=>egoBase(x.id));
    if(!own||(own.egoLv||0)>=L)return null;
    const nw=carryTune(own,egoItem(own.id,L));
    if(own===w){equip(ch,nw);ch.stash=ch.stash.filter(x=>x!==own)}else st[st.indexOf(own)]=nw;
    ch.egoNote=`E.G.O ${CFG.egoGrow.tier[L]} · ${nw.n} (${nw.e})`;
    return {old:own,nw,worn:own===w};
  }
  const bonNeed=ch=>{const w=ch.gear.weapon;return w&&w.id==='bonatelli'&&w.lvl<CFG.bon.max?CFG.bon.need[w.lvl]:null};
  function bonUpgrade(ch,i){
    const need=bonNeed(ch),st=ch.stash||[],m=st[i];if(need==null||!m||(m.grade||0)<need)return false;
    st.splice(i,1);const old=ch.gear.weapon;equip(ch,carryTune(old,bonItem(old.lvl+1)));ch.stash=ch.stash.filter(x=>x!==old);return true;
  }
  function equipStash(ch,i){const st=ch.stash||[];if(!st[i]||(st[i].slot==='aug'&&isN(ch)))return false;equip(ch,st.splice(i,1)[0]);return true}
  const inStash=(ch,id)=>(ch.stash||[]).some(x=>x.id===id)||(ch.gearOffers||[]).some(x=>x.id===id);
  /* ===== 6시즌: 장비를 얻으면 바로 끼지 않고, 장착할지 보관함에 넣을지 고른다 ===== */
  function offerGear(ch,item){(ch.gearOffers=ch.gearOffers||[]).push(item)}
  function resolveGear(ch,i,wear){const o=ch.gearOffers||[];if(!o[i])return false;const it=o.splice(i,1)[0];if(wear)equip(ch,it);else (ch.stash=ch.stash||[]).push(it);return true}
  /* ===== 6시즌: 덱은 최대 CFG.deck.max장 (E.G.O가 개화하면 CFG.mind.deckPlus장 더). 넘치는 카드는 카드함에 두고, 공방 밖에서도 자유롭게 넣고 뺀다 ===== */
  const ownsCard=(ch,cid)=>ch.deck.includes(cid)||(ch.side||[]).includes(cid)||(ch.offers||[]).includes(cid);
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
    o.splice(i,1);return true;
  }
  function dropOffer(ch,i){const o=ch.offers||[];if(!o[i])return false;o.splice(i,1);return true}
  function deckOut(ch,i){if(ch.deckLocked||ch.cardMoney||!ch.deck[i]||D.cards[ch.deck[i]].fixed||ch.deck.length<=CFG.shop.minDeck)return false;(ch.side=ch.side||[]).push(ch.deck.splice(i,1)[0]);return true}
  function deckIn(ch,i){const sd=ch.side||[];if(ch.deckLocked||ch.cardMoney||!sd[i]||!deckRoom(ch))return false;ch.deck.push(sd.splice(i,1)[0]);return true}
  function sideDrop(ch,i){const sd=ch.side||[];if(!sd[i]||ch.cardMoney||D.cards[sd[i]].fixed)return false;sd.splice(i,1);return true}
  /* 고르지 않고 넘어가면(시뮬레이션): 카드는 자리가 있으면 덱에, 없으면 버리고, 장비는 장착한다 */
  /* 히든 보스 전용 책장: 받으면 덱이 통째로 바뀌고 영구 고정, 거절하면 지금 덱 유지 */
  function acceptPack(ch){const P=ch.packOffer;if(!P)return false;if(ch.distForm){ch.packOffer=null;return false}ch.deck=P.cards.concat(ch.deck.filter(id=>D.cards[id].fixed));ch.deckLocked=true;if(P.cm)ch.cardMoney=true;ch.offers=[];ch.side=[];if(P.relic)(ch.relics=ch.relics||[]).push(P.relic);if(P.passive)(ch.flags=ch.flags||{})[P.passive]=1;ch.packOffer=null;return true}
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
  const canFound=ch=>ch.licensed&&ch.rank<=CFG.office.rank&&!ch.job&&!noFixer(ch)&&!ch.officePick&&(!ch.aff||(ch.aff.type==='office'&&!ch.aff.own));
  function officeNameErr(n){
    {const e=nameErr(n);if(e)return e}
    if((D.offices||[]).some(o=>o.n===n+' 사무소'))return '이미 있는 사무소 이름이다';
    return null;
  }
  function setOffice(ch,name,kw){
    if(officeNameErr(name)||!OKW[kw])return false;
    ch.office={name:name+' 사무소',kw,tier:0};ch.aff={type:'office',name:ch.office.name,own:true};ch.officePick=false;return true;
  }
  const officeCards=kw=>[...new Set([...D.rewards,'rustnote','tknife','supper','faint','o_ember','o_blaze','o_stance'])].filter(id=>D.cards[id]&&(D.cards[id].kw||[]).some(k=>k[0]===kw));
  function officeBroker(ch){
    const O=ch.office;if(!O||!ch.aff||!ch.aff.own)return null;
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
    const all=boxPool(theme),fresh=all.filter(id=>!ownsCard(ch,id)),cid=one(fresh.length?fresh:all);if(!cid)return null;
    ch.money-=B.price;(ch.offers=ch.offers||[]).push(cid);return cid;
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
  /* 암시장 K사 엠플: 전투 중 HP가 below 이하가 되면 자동으로 쓰여 HP를 heal 회복한다 (전투마다 1개). 최대 carry개, 무한 모드 뒤엔 값이 오른다 */
  const ampPrice=ch=>CFG.ample.price;
  function buyAmple(ch){
    const K=CFG.ample;if((ch.ample||0)>=K.carry||(ch.ampleBought||0)>=K.limit||ch.money<ampPrice(ch))return false;
    ch.money-=ampPrice(ch);ch.ample=(ch.ample||0)+1;ch.ampleBought=(ch.ampleBought||0)+1;return true;
  }
  /* 공방 등급: 기본 → 소속 → 해결사 급수 보너스 */
  function shopAccess(ch){
    const A=D.access;let g=A.base;
    if(ch.aff&&A.aff[ch.aff.type])g=Math.max(g,A.aff[ch.aff.type]);
    /* 직접 날개를 세운 대표는 소속(aff)이 없어도 날개 최고 직급과 같은 대접 */
    if(isFounder(ch))g=Math.max(g,A.aff.wing);
    const fingerUp=isFinger(ch)&&ch.fr&&ch.fr.tier>=D.fingerRules.shopTier;
    /* 협회·날개처럼 직급표가 있는 진로는 해결사 급수가 오르지 않으므로, 최고 직급(날개 임원 등)에 오르면 급수 보너스와 같은 +1 */
    const CR_=D.careers&&ch.aff&&D.careers[ch.aff.type],topRank=isFounder(ch)||!!(CR_&&CR_.ranks&&ch.fi!=null&&ch.fi>=CR_.ranks.length-1);
    if((ch.licensed&&ch.rank<=A.rankBonus.rank)||fingerUp||topRank)g=Math.min(A.max,g+A.rankBonus.plus);
    return g;
  }
  /* 살 수 있는지: 'ok' / 'locked'(등급) / 'money' / 'owned' */
  function canBuy(ch,id){
    const it=D.items[id];
    if(ch.gear[it.slot]&&ch.gear[it.slot].id===id)return 'owned';
    if(ch.distForm)return 'distort';
    if(it.slot==='aug'&&isN(ch))return 'nwing';
    if(inStash(ch,id))return 'stash';
    if(it.grade>shopAccess(ch))return 'locked';
    if(ch.money<priceOf(ch,id))return 'money';
    return 'ok';
  }
  /* 공방 해결사: 공방 물건 할인, 보관함 장비 판매 */
  const WF=CFG.workshopFixer;
  const isWs=ch=>!!ch.aff&&ch.aff.type==='workshop';
  const priceOf=(ch,id)=>{const p=D.items[id].price;return isWs(ch)?Math.round(p*(1-WF.discount)):p};
  const sellValue=it=>Math.floor((it.price||(D.items[it.id]&&D.items[it.id].price)||(D.special[it.id]&&D.special[it.id].price)||WF.sellBase)*WF.sell);
  function sellStash(ch,i){const st=ch.stash||[];if(!isWs(ch)||!st[i])return 0;const v=sellValue(st[i]);st.splice(i,1);ch.money+=v;return v}
  /* 암시장: 영구 강화(한 번만)와 특수 장비 */
  function canBuySpecial(ch,id){
    const it=D.special[id];
    if(it.perm?(ch.perms||[]).includes(id):(ch.gear[it.slot]&&ch.gear[it.slot].id===id))return 'owned';
    if(!it.perm&&ch.distForm)return 'distort';
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
    const it=D.items[id];ch.money-=priceOf(ch,id);if(offer)offerGear(ch,Object.assign({id},it));else equip(ch,Object.assign({id},it));return true;
  }
  /* 금전운: 버는 돈 +20% */
  const earn=(ch,n)=>n>0&&ch.innate==='fortune'?Math.round(n*CFG.innate.money):n;
  /* 성장력: 레벨 업 성장 능력치 1.2배 (소수점은 쌓아 두었다가 1이 되면 오른다) */
  function applyGrowth(ch,fx){
    const r=applyFx(ch,fx);
    if(ch.innate==='growth'){const acc=ch.growAcc=ch.growAcc||{},ex={};
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
  function alignEast(ch,chips){if(!eastN(ch)||!ch.licensed||ch.fi==null)return;const tgt=CFG.eastN.align[ch.fi]??9;while(ch.rank>Math.max(tgt,T.rankTop)){const p=promote(ch);chips.push(...p.chips)}}
  const noFixer=ch=>isFinger(ch)||isFounder(ch)||(!!ch.aff&&((ch.aff.type==='wing'&&!eastN(ch))||ch.aff.type==='head'));
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
    let need=CFG.promo.total*(k==='fixer'?CFG.promo.fixerMul:(CR[k].totalMul||1))/sum;
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
  }
  /* 협회·날개 직급: 단계마다 그 직급의 보정을 더한다 (손가락 fingerStep과 같은 방식) */
  function careerStep(ch){
    const C_=CR[ch.aff.type],r=C_.ranks[(ch.fi??-1)+1];if(!r)return null;
    ch.fi=(ch.fi??-1)+1;ch.fr=r;addStats(ch.stats,r.fx);if(r.fx.maxHp)ch.hp+=r.fx.maxHp;
    /* 협회 직급에 맞는 해결사 급수 (예: 지부장은 최소 4급) */
    if(r.minRank&&ch.licensed&&ch.rank>r.minRank)ch.rank=r.minRank;
    const out=[`${ch.aff.name} · ${r.n}`,...(r.e?[r.e]:[])];
    if(r.money){const m=earn(ch,r.money);ch.money+=m;out.push('승진 보너스 +'+money(m))}
    giveOrgCards(ch,C_,ch.fi,out);
    /* 최고 직급(임원)에 오르면 전용 카드팩의 마지막 줄(4코스트 카드)을 덱에 더한다 */
    if(ch.fi===C_.ranks.length-1)giveFinalCards(ch,C_,out,'최고 직급');
    return out;
  }
  function giveFinalCards(ch,C_,out,why){
    const rows=C_.finalRow&&orgRows(ch,C_);
    if(!rows||!ch.cardMoney||ch.finalGiven)return;ch.finalGiven=true;
    const ids=rows[rows.length-1].filter(id=>ch.deck.length<deckMax(ch));
    if(ids.length){ch.deck=ch.deck.concat(ids);out.push(`전용 카드 · ${ids.map(id=>D.cards[id].n).join(', ')} (${why})`)}
  }
  /* 협회 전용 카드팩: 입회 때 careers.*.cards[소속 이름]의 카드를 한 번에 받아 덱이 통째로 바뀐다.
     전용 카드팩(cardMoney)이라 이후 카드는 얻을 수 없고(대신 돈), 나중에 히든 책장으로 덱이 바뀌어도 협회 패시브는 소속 기록(assocName)으로 남는다 */
  /* R사 날개처럼 팀이 있는 소속은 처음 들어갈 때 1dN으로 팀이 정해지고, 그 팀의 전용 책장과 패시브를 쓴다 */
  const orgRows=(ch,C_)=>C_.cards&&(C_.cards[ch.aff.name+(ch.rteam?'/'+ch.rteam:'')]||C_.cards[ch.aff.name]);
  function giveOrgCards(ch,C_,at,out){
    const T_=C_.teams&&C_.teams[ch.aff.name];
    if(at===0&&T_&&!ch.rteam){const r=d(T_.length);ch.rteam=T_[r-1];out.push(`${ch.aff.name} · ${ch.rteam} 배정 (1d${T_.length} · ${r})`)}
    const rows=orgRows(ch,C_);
    ch.assocName=ch.aff.name;
    if(at!==0||!rows||ch.deckLocked||ch.cardMoney)return;
    const ids=(C_.finalRow?rows.slice(0,-1):rows).flat();
    ch.deck=ids.concat(ch.deck.filter(id=>D.cards[id].fixed));ch.side=[];ch.offers=[];ch.packOffer=null;ch.cardMoney=true;
    out.push(`전용 카드팩 · ${ch.aff.name} ${ids.length}장 (덱이 통째로 바뀐다 · 이후 카드는 얻지 못하고 대신 돈)`);
  }
  const assocOf=ch=>ch.assocName||(ch.aff&&ch.aff.type==='assoc'?ch.aff.name:null);
  /* 최고 단계의 특수 사건: 해결사는 특색 심사, 다른 진로는 careers.*.top */
  const topEvent=ch=>{const k=career(ch);return k==='fixer'?D.colorExam:CR[k]&&CR[k].top};
  const topReady=ch=>{const k=career(ch);return !!k&&!canPromote(ch)&&!ch.title&&!ch.colorFailed&&promoDone(ch)>0&&(ch.year||0)>=(ch.topNext||0)}
  /* 특색·상석 심사 실패: 최대 CFG.top.tries번까지, 실패하면 CFG.top.wait년 뒤 다시 */
  function topFailed(ch,chips,label){ch.topTries=(ch.topTries||0)+1;const sb=ch.bond;if(sb&&sb.st==='married'){sb.promo=(sb.promo||0)+1;chips.push(`배우자 승급 · ${sb.name} (+1급)`)}const left=CFG.top.tries-ch.topTries;
    if(left<=0){ch.colorFailed=true;chips.push(label+' 실패 · 다시 기회 없음')}else{ch.topNext=(ch.year||0)+CFG.top.wait;chips.push(`${label} 실패 · 남은 기회 ${left}번 · ${CFG.top.wait}년 뒤 다시`)}}
  /* ===== 손가락 서열 =====
     손가락마다 서열표가 있고, 오를 때마다 그 서열의 보정을 더한다. branch면 1d100으로 갈래를 고른다 */
  const isFinger=ch=>!!ch.aff&&ch.aff.type==='finger'&&!!D.fingers[ch.aff.name];
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
    if(ch.fi===0&&F.pack&&!ch.deckLocked&&!ch.cardMoney){ch.deck=F.pack.concat(ch.deck.filter(id=>D.cards[id].fixed));ch.side=[];ch.offers=[];ch.packOffer=null;ch.cardMoney=true;out.push(`전용 카드팩 · ${ch.aff.name} ${F.pack.length}장 (덱이 통째로 바뀐다 · 이후 카드는 얻지 못하고 대신 돈)`)}
    return out;
  }
  const canFingerUp=ch=>isFinger(ch)&&!!D.fingers[ch.aff.name].ranks[(ch.fi??-1)+1];
  /* 승급 사건·고정 전투 승리: 손가락이면 서열, 아니면 해결사 급수 */
  function promoteAny(ch){
    if(canFingerUp(ch))return {chips:fingerStep(ch),finger:true};
    if(isFinger(ch))return null;
    const k=career(ch);if(k&&k!=='fixer'){const c=careerStep(ch);if(c&&eastN(ch)&&ch.licensed){const tgt=Math.min(ch.rank-1,CFG.eastN.align[ch.fi]??9);while(ch.rank>Math.max(tgt,T.rankTop)){const p=promote(ch);c.push(...p.chips)}}return c?{chips:c}:null}
    if(ch.licensed&&ch.rank>T.rankTop)return promote(ch);
    return null;
  }
  /* 날개·손가락 진로면 해결사 급수 대신 그 진로의 직급을 보여 준다 (해결사 급수는 그 진로에서 오르지 않는다) */
  const rankLabel=ch=>{if(isFounder(ch)&&!ch.job)return ch.title?`${ch.title} · 날개 대표`:'날개 대표';if(ch.job)return ch.title?`${ch.title} · ${T.jobs[ch.job]}`:T.jobs[ch.job];const k=career(ch);if((k==='wing'||k==='finger')&&ch.fr){const fx_=eastN(ch)&&ch.licensed?` · ${ch.rank}${T.rankUnit} 해결사`:'';return (ch.title?`${ch.title} · ${ch.fr.n}`:ch.fr.n)+fx_}return rankLabel0(ch)};
  const rankLabel0=ch=>!ch.licensed?T.unranked:ch.title?`${ch.title} · ${ch.rank}${T.rankUnit}`:`${ch.rank}${T.rankUnit} ${T.licensed}`;
  /* 카드 얻기: 덱이 고정(엄지 검술)이면 카드 대신 돈 */
  /* offer: 바로 넣지 않고 받을지 고르게 한다 (일반 전투 보상) */
  function addCard(ch,cid,chips,label,offer){
    if(!cid)return;
    /* 덱 고정(엄지 검술·책장) 또는 전용 카드팩(숨은 출생)이면 카드 대신 돈 */
    if(ch.deckLocked||ch.cardMoney){const m=earn(ch,CFG.lockedCardMoney);ch.money+=m;chips&&chips.push(`${ch.deckLocked?'덱 고정':'전용 카드팩'} · ${D.cards[cid].n} 대신 +${money(m)}`);return}
    if(offer){(ch.offers=ch.offers||[]).push(cid);chips&&chips.push(`${label||'카드'} 발견 · ${D.cards[cid].n} (받을지 고른다)`);return}
    putCard(ch,cid,chips,label);
  }
  function rewardCard(ch){const pool=D.rewards.filter(id=>!ownsCard(ch,id));return pool.length?one(pool):null}
  /* 사건·성장·보상 효과를 적용하고 화면용 칩을 돌려준다 */
  /* 소속에 들어간다: 소속·직급 기록을 새로 쓰고 첫 직급의 보정을 받는다 */
  function joinAff(ch,J,name,chips){
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
    const t=ch.orgPick;if(!t||!(D.orgs[t]||[]).includes(name))return null;
    ch.orgPick=null;
    if(t==='office')return joinOffice(ch,name);
    const chips=[];joinAff(ch,t==='syn'?{type:'finger',from:'syn'}:{type:t,from:t},name,chips);return chips;
  }
  function chooseFinger(ch,name){
    if(!ch.fingerPick||!D.orgs.finger.includes(name))return null;
    const chips=[];ch.fingerPick=false;joinAff(ch,{type:'finger',from:'finger'},name,chips);return chips;
  }
  function applyFx(ch,fx){
    const s=ch.stats,chips=[];
    if(fx.maxHp){s.maxHp+=fx.maxHp;ch.hp+=fx.maxHp;chips.push('최대 HP '+sg(fx.maxHp))}
    if(fx.hp){ch.hp=clamp(ch.hp+fx.hp,1,s.maxHp);chips.push('HP '+sg(fx.hp))}
    for(const k of ['atk','eva','spd'])if(fx[k]){s[k]+=fx[k];chips.push(STAT[k]+' '+sg(fx[k]))}
    if(fx.money){const m=earn(ch,fx.money);ch.money=Math.max(0,ch.money+m);chips.push((m>0?'+':'−')+money(Math.abs(m))+(m!==fx.money?' (금전운)':''))}
    if(fx.check){s.check+=fx.check;chips.push('사건 판정 '+sg(fx.check))}
    if(fx.startBreath){s.startBreath+=fx.startBreath;chips.push('시작 '+D.keywords.breath.n+' +'+fx.startBreath)}
    const cid=fx.card||(fx.reward?rewardCard(ch):null);
    addCard(ch,cid,chips,null,true);
    if(fx.escort)ch.flags.escortNext=1;
    if(fx.officeFound){ch.officePick=true;chips.push('사무소 개설 · 이름과 전문 분야를 정한다')}
    if(fx.auth){(ch.auth=ch.auth||[]).push(fx.auth);chips.push('조율자 권한 · '+(fx.auth==='seal'?'봉인':'집행')+' ('+ch.auth.length+'단계)');if(fx.auth==='exec'){if(ch.cardMoney){ch.deck.push('o_verdict');chips.push('전용 책장 · 집행')}else addCard(ch,'o_verdict',chips,'집행 카드')}}
    /* 표시 없이 쌓이는 기록(금기 위반, 초대 등). 조건 "flag:이름" / "flag:이름>=n"으로 읽는다 */
    for(const f of [].concat(fx.flag||[]))ch.flags[f]=(ch.flags[f]||0)+1;
    if([].concat(fx.flag||[]).includes('taboo'))bondTaboo(ch);
    if(fx.join){
      /* 손가락 가입: 소지를 뺀 네 손가락 중 하나를 직접 고른다 (고르지 않고 넘어오면 무작위 · 엄지 특화 출신은 엄지 확률 보정) */
      if(fx.join.from==='finger'&&!fx.join.name){ch.fingerPick=true;chips.push('손가락 · 어느 손가락에 설지 고른다')}
      else if((fx.join.from==='wing'||fx.join.from==='assoc'||fx.join.from==='office'||fx.join.from==='syn')&&!fx.join.name){ch.orgPick=fx.join.from;chips.push(`${T.affTypes[fx.join.from]} · 어느 곳에 들어갈지 고른다`)}
      else joinAff(ch,fx.join,fx.join.name||one(D.orgs[fx.join.from]),chips);
    }
    /* 사건으로 승급 (해결사만, 최고 급수 미만일 때) */
    if(fx.promote)addPts(ch,CFG.promo.gain.mid,chips);
    if(fx.pts)addPts(ch,fx.pts*CFG.promo.gain.check,chips);
    if(fx.pinkyKey){const ks=ch.pinkyKeys=ch.pinkyKeys||[],K=D.pinky.keys[ks.length];if(K){ks.push(K.k);chips.push(`소지의 별 · ${K.k} (${ks.length}/${D.pinky.keys.length})`);if(ks.length>=D.pinky.keys.length){ch.seongPick=true;chips.push('성도 · 이름을 정한다')}}}
    if(fx.oracle&&!ch.oracle){ch.oracle=true;(ch.relics=ch.relics||[]).push('히든 직업 · 신탁대행자','전리품 · 신의 단말기');addStats(s,D.oracle.loot.fx);chips.push('히든 직업 · 신탁대행자 · 지령 독촉',`전리품 · 신의 단말기 · ${D.oracle.loot.e}`)}
    if(fx.officeJoin){chips.push(...joinOffice(ch,one(fx.officeJoin)))}
    if(fx.hyeol&&ch.race!=='hyeolgwi'){ch.race='hyeolgwi';s.maxHp+=10;ch.hp+=10;s.atk+=2;(ch.relics=ch.relics||[]).push('혈귀');chips.push('혈귀가 되었다 · 최대 HP +10 · 공격 +2 · 패시브 혈찬(상대 출혈 5번 발동마다 HP 15 회복)');
      if(!ch.cardMoney&&!ch.deckLocked&&!ch.packOffer&&D.hgDeck){ch.packOffer={n:'혈귀 전용 책장',cards:D.hgDeck.slice(),relic:'혈귀의 책장',cm:true};chips.push('혈귀 전용 책장 · 받을지 고른다 (받으면 덱이 바뀐다)')}}
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
    if(fx.pinky&&!ch.pinky){ch.pinkyYear=ch.year||0;ch.pinky=true;addStats(s,D.pinky.fx);chips.push(D.pinky.n+' 표식 · '+D.pinky.e)}
    if(fx.examPass){const need=promoNeed(ch),p=promoteAny(ch);if(p){chips.push(...p.chips);ch.pp=Math.max(0,(ch.pp||0)-need);ch.promos=(ch.promos||0)+1;ch.strikes=0}}
    if(fx.examFail){
      const k=career(ch),C_=CR[k]||{},lost=Math.floor((ch.pp||0)*(C_.lose||CFG.promo.loseFrac));
      ch.pp=(ch.pp||0)-lost;chips.push(`${ptsName(ch)} −${lost} (${ch.pp}/${promoNeed(ch)})`);
      if(C_.failHp){ch.hp=clamp(ch.hp+C_.failHp,1,s.maxHp);chips.push('HP '+sg(C_.failHp))}
      ch.strikes=(ch.strikes||0)+1;
      if(C_.strikes&&ch.strikes>=C_.strikes){
        ch.strikes=0;
        if(C_.strike==='fire'){chips.push(`${ch.aff.name} 해고 · 소속을 잃었다`);ch.aff=null;ch.fi=undefined;ch.fr=null;ch.pp=0;ch.promos=0;
          /* 날개를 잃으면 아직 날개를 세우지 못한 특이점 개발 길도 끊긴다 (대표는 해고된 사람이 될 수 없다) */
          if(ch.corp&&ch.corp.st==='dev'){ch.corp.st='declined';chips.push('특이점 개발 · 날개를 잃어 개발이 중단된다')}}
        if(C_.strike==='purge'){ch.purge=C_.purgeFoe;chips.push('숙청 대상이 되었다')}
      }
    }
    if(fx.topPass){const C_=CR[career(ch)];ch.title=isN(ch)&&isEastOuter(ch)?CFG.nWing.eastTitle:C_.topTitle;ch.titleKind='top';(ch.titleLog=ch.titleLog||[]).push(ch.title);addStats(s,C_.topFx||{});if((C_.topFx||{}).maxHp)ch.hp+=C_.topFx.maxHp;chips.push('칭호 · '+ch.title);if(C_.topMinRank&&ch.licensed&&ch.rank>C_.topMinRank){ch.rank=C_.topMinRank;chips.push(`해결사 급수 ${ch.rank}급`)}const L_=C_.topLoot;if(L_){addStats(s,L_.fx);if(L_.fx.maxHp)ch.hp+=L_.fx.maxHp;(ch.relics=ch.relics||[]).push(L_.n);chips.push(`전리품 · ${L_.n} (${L_.e})`)}}
    if(fx.topFail)topFailed(ch,chips,'심사')
    if(fx.examSkip)ch.examSkipYear=ch.year;
    if(fx.colorPass){ch.title=D.colors[ch.ci].adj+' '+one(D.titleWords[ch.dom||'atk']);ch.titleKind='color';(ch.titleLog=ch.titleLog||[]).push('특색');ch.titlePick=true;chips.push(T.titleLabel+' · '+ch.title);if(ch.colorFx){addStats(s,ch.colorFx);ch.hp+=ch.colorFx.maxHp||0;chips.push('E.G.O 발현자 · 특색 · 모든 능력치 +5')}}
    if(fx.colorFail)topFailed(ch,chips,T.titleLabel+' 심사')
    let licensed=false;
    if(fx.license){licensed=license(ch);if(licensed){chips.push(T.licenseGained+' · '+ch.rank+T.rankUnit);alignEast(ch,chips)}}
    return {chips,licensed};
  }
  function lvOf(xp){let l=1;for(let i=1;i<CFG.levels.length;i++)if(xp>=CFG.levels[i])l=i+1;return l}
  const xpNext=ch=>CFG.levels[ch.lv];
  function gainXp(ch,n){const b=ch.lv;ch.xp+=n;ch.lv=lvOf(ch.xp);ch.lvPend+=ch.lv-b;return ch.lv-b}
  /* 덱이 고정(책장·전용 카드팩)이면 카드를 받을 수 없으므로 '보상 카드' 성장은 선택지에서 뺀다 */
  function rollGrowth(ch){
    const out=[],locked=!!(ch&&(ch.deckLocked||ch.cardMoney));let g=0;
    while(out.length<3&&g++<80){const r=d(100),x=pick(D.growth,r);if(locked&&x.fx&&x.fx.reward)continue;if(!out.some(o=>o.g===x))out.push({r,g:x})}
    return out;
  }

  /* ===== 조우 =====
     "table:<이름>"이면 1d100으로 조우 표를 굴린다. 소속 전용 표(<이름>@<소속 종류>)가 있으면 그것을 쓴다 */
  /* 격리 실패: 아직 이기지 않은 환상체 보스 중 하나 */
  const abnoLeft=ch=>Object.keys(D.enemies).filter(id=>D.enemies[id].breach&&!(ch.minis||[]).includes(id));
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
    const key=ch.flags&&ch.flags.lamancha&&T_[`${name}@lamancha`]?`${name}@lamancha`:ch.aff&&T_[`${name}@${ch.aff.type}`]?`${name}@${ch.aff.type}`:name;
    /* 같은 조직의 적(enemy.org가 내 소속 종류나 내 소속 이름과 같음)은 배신자·명부의 처리 대상(enemy.traitor)이 아니면 만나지 않는다. 방금 싸운 적도 되도록 피한다 */
    const mine=new Set();if(ch.aff){mine.add(ch.aff.name);mine.add((D.orgs.syn||[]).includes(ch.aff.name)?'syn':ch.aff.type)}
    const blocked=i=>{const e=D.enemies[i],o=e&&e.org;return !!o&&!e.traitor&&[].concat(o).some(x=>mine.has(x))};
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
    if(req.startsWith('flag:')){const [k,n]=req.slice(5).split('>=');return (ch.flags[k]||0)>=(+n||1)}
    if(req.startsWith('corpup<'))return ((ch.corp&&ch.corp.up)||0)<+req.slice(7);
    if(req.startsWith('corpup>='))return ((ch.corp&&ch.corp.up)||0)>=+req.slice(8);
    if(req==='pinky')return !!ch.pinky;
    if(req==='nopinky')return !ch.pinky;
    /* beat:any = 히든 보스를 하나라도 이김, beat:a|b = 그중 하나를 이김 */
    if(req==='beat:any')return ch.beaten.length>0;
    if(req.startsWith('beat:'))return req.slice(5).split('|').some(id=>ch.beaten.includes(id));
    if(req.startsWith('fi>='))return isFinger(ch)&&(ch.fi||0)>=+req.slice(4);
    if(req.startsWith('notaffname:'))return !(ch.aff&&ch.aff.name===req.slice(11));
    if(req.startsWith('affname:'))return !!ch.aff&&ch.aff.name===req.slice(8);
    if(req.startsWith('rank<='))return ch.licensed&&ch.rank<=+req.slice(6);
    if(req.startsWith('rankin:')){const [a,b]=req.slice(7).split('-').map(Number);return ch.licensed&&ch.rank>=a&&ch.rank<=b}
    if(req==='licensed')return ch.licensed;
    if(req==='unlicensed')return !ch.licensed;
    if(req.startsWith('noflag:'))return !ch.flags[req.slice(7)];
    if(req==='nohyeol')return ch.race!=='hyeolgwi';
    if(req==='noroute')return !ch.rb&&!ch.hw;
    if(req==='bondmarried')return !!(ch.bond&&ch.bond.st==='married');
    if(req==='nofinger')return !isFinger(ch);
    if(req==='nojob')return !ch.job;
    if(req==='canfix')return !noFixer(ch);
    /* 내 사무소(대표) / 남의 사무소 직원 */
    if(req==='ownoffice')return !!ch.aff&&!!ch.aff.own;
    if(req==='notown')return !(ch.aff&&ch.aff.own);
    if(req==='aff')return !!ch.aff;
    if(req==='noaff')return !ch.aff;
    if(req.startsWith('aff:'))return !!ch.aff&&ch.aff.type===req.slice(4);
    return true;
  }
  /* ===== 정신력 ===== */
  const M=CFG.mind;
  const mindFloor=ch=>ch.ego?M.ego[ch.ego.type].floor:0;
  /* 성장기 '목소리가 들림': 정신력 최대치 +5 */
  const mindMax=ch=>M.max+((ch.stats&&ch.stats.mindMax)||0);
  /* ===== 전투 중 정신력이 0이 되면: 50% E.G.O 개화, 아니면 육신 뒤틀림 (둘 다 그 자리에서 전투에 반영) =====
     이름은 전투가 끝난 뒤 정한다 (ch.namePend) */
  let activeC=null;
  const clampN=(v,a,b)=>Math.max(a,Math.min(b,v));
  function mindBreak(C){
    const ch=C.ch,P=C.P,s=ch.stats;
    if(ch.ego||ch.distForm||C.mindHandled)return;
    C.mindHandled=true;
    const L=(t,x)=>{if(C.quiet)return;C.log.push({t,s:x});C.cur.push({t,s:x})};
    const r=d(100),ok=r<=50;L('sys',`${P.name} · 정신력 0 · 마음이 한계에 닿았다 · 1d100 ${r} (50 이하면 E.G.O 개화, 아니면 뒤틀림)`);
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
      L('kw',`  육신이 뒤틀린다 · 장비는 보관함으로 · 능력치가 크게 오른다 · 손패는 다음 라운드부터 뒤틀린 책장`);
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
    if(n<=0||ch.distForm)return;const m0=ch.mind;ch.mind=Math.max(mindFloor(ch),ch.mind-n);
    if(ch.mind<m0&&out)out(`정신력 −${m0-ch.mind} (${ch.mind}/${mindMax(ch)})`);
    if(ch.ego)return;
    if(ch.mind<=0){if(activeC&&activeC.ch===ch&&!activeC.over)mindBreak(activeC);else ch.mindDead=true}
    else if(ch.mind===1&&!ch.distortDone){if(bondMarried(ch)&&!ch.bond.saved){ch.bond.saved=true;ch.mind=CFG.bond.saveMind;out&&out(`가족의 목소리 · ${ch.bond.name}의 목소리가 당신을 붙잡았다 · 정신력 ${ch.mind}`)}else ch.distortPend=true}
    else if(ch.mind<=M.voiceAt&&!ch.voiceUsed)ch.voicePend=true;
  }
  const gainMind=(ch,n)=>{const m0=ch.mind;ch.mind=Math.min(mindMax(ch),ch.mind+n);return ch.mind-m0};
  const mindTier=ch=>M.tiers.find(t=>ch.mind>=t.at)||null;
  /* 정신력이 stat.at 각 값 이상일 때마다 모든 능력치 +1 (최대 6) */
  const mindStat=ch=>M.stat.at.filter(x=>ch.mind>=x).length;
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
    /* 고정 전용 카드: 덱 최대 장수 +1 자리에 들어간다 (발현자는 이미 전용 카드가 있다). 덱이 고정이어도 넣는다 */
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
  function corpUp(ch,chips){
    const c=ch.corp;if(!corpYes(ch)||c.up>=CP.upMax)return;c.up++;const T_=CP.types[c.type];
    corpBump(ch,CP.up,chips);corpBump(ch,T_.per||{},chips);chips.push(`특이점 ${c.n} 강화 ${c.up}/${CP.upMax}`);
  }
  function corpForb(ch,chips){
    const c=ch.corp;if(!corpYes(ch)||c.forb>=CP.forbMax)return;c.forb++;ch.flags.taboo=(ch.flags.taboo||0)+1;bondTaboo(ch);corpBump(ch,CP.forb,chips);chips.push(`금기 실험 ${c.forb}/${CP.forbMax}`);
    if(c.forb>=CP.forbMax){c.chain=CP.chain.filter(id=>!ch.beaten.includes(id));chips.push('머리가 당신을 주시한다')}
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
  function bondRisk(b,y,ch){return ((b.tabooAt!=null&&y>b.tabooAt?BD.dieChance:0)+(b.risk||0))*(ch&&ch.flags&&ch.flags.bondGuard?0.5:1)}
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
  function kidHuntEvent(G){
    const ch=G.ch,y=G.year;if(!ch.distForm||(y<(ch.huntNext||0)))return null;
    const k=familyHunter(ch,y);if(!k)return null;
    ch.huntNext=y+BD.hunt.gap;if(d(100)>BD.hunt.chance)return null;
    const H=D.bond.hunt,Lv=Math.max(0,k.lv),e=D.enemies.kid_hunt,Z=BD.hunt;
    const jb=k.spouse?'배우자':(H.jobs[k.job]||'');ch.kidFoe=k.n;ch.kidFoeSpouse=!!k.spouse;ch.kidFoeLv=Lv;
    e.n=`${k.n} · ${jb} ${9-Lv}급`;e.hp=56+Lv*Z.hp;e.atk=3+Lv*Z.atk;e.eva=2+Lv*Z.eva;e.spd=5+Lv*Z.spd;
    e.deck=k.job==='fixer'?['lunge','a_maw','guard','lunge']:k.job==='assoc'?['a_maw','lunge','a_maw','guard']:['lunge','guard','lunge','guard'];
    e.intro=kf(k.spouse?H.introSpouse:H.intro,k.n).replace('{j}',`${jb} ${9-Lv}급`);
    return {type:'fight',enemy:'kid_hunt',enc:{id:'kid_hunt',roll:null,table:null,label:'토벌 의뢰'}};
  }
  /* 청혼: roll이면 1dN을 굴려 성공 범위면 결혼, 아니면 기회 1회 소모 (기회를 다 쓰면 인연이 끝난다) */
  function bondPropose(ch,chips,roll){
    const b=ch.bond;if(!b||b.st!=='met')return;
    let ok=false;
    if(roll){const r=d(BD.die);ok=r>=BD.ok[0]&&r<=BD.ok[1];chips.push(`1d${BD.die} · ${r} (${BD.ok[0]}~${BD.ok[1]} 성공)`)}
    if(ok){bondMarry(ch,chips);return}
    b.tries=(b.tries||0)+1;chips.push(bondFill(roll?D.bond.proposeNo:D.bond.proposeWaitFail,b)+` · 남은 기회 ${Math.max(0,BD.tries-b.tries)}/${BD.tries}`);
    if(b.tries>=BD.tries)bondLeft(ch,chips);else b.next=(ch.year||0)+bondGap();
  }
  /* 인연 루트: 혈귀는 혈귀 전용, 동부 외곽 출신은 외곽 전용, 그 밖에는 소속(사무소·협회·날개·손가락) */
  const FINGER_ROUTE={'엄지':'thumb','검지':'pointer','중지':'middle','약지':'ring'};
  const bondRouteOf=ch=>ch.race==='hyeolgwi'?'hyeolgwi':(ch.o&&ch.o.n==='동부 출신 외곽 생존자')?'east':(synOf(ch)?synOf(ch):ch.aff&&ch.aff.type==='finger'&&FINGER_ROUTE[ch.aff.name]?FINGER_ROUTE[ch.aff.name]:ch.aff&&BD.routes.includes(ch.aff.type)?ch.aff.type:null);
  /* 루트에 variants가 있으면 만날 때 무작위로 하나가 정해진다 */
  const bondData=ch=>{const b=ch.bond,R=b&&D.bond&&D.bond.routes[b.route];return R?(R.variants?R.variants[b.variant||0]:R):null};
  function bondMeetEvent(ch){
    const B=D.bond;let rt=bondRouteOf(ch);
    /* 히든: 해결사 3급 이하라면 가끔 처음부터 2~1급 해결사인 상대를 만난다 */
    if(rt&&rt!=='hyeolgwi'&&ch.licensed&&ch.rank<=BD.hidden.rank&&B.routes.highfixer&&d(100)<=BD.hidden.chance)rt='highfixer';
    const R0=rt&&B&&B.routes[rt];
    if(!R0)return null;
    const vi=R0.variants?d(R0.variants.length)-1:0,R=R0.variants?R0.variants[vi]:R0;
    return {t:R.meet.t,x:R.meet.x,c:[
      {l:B.meetYes,h:'동반자의 이름을 정한다 · 이후 몇 해마다 사건이 온다',ok:{t:B.meetYesT,fx:{bondMeet:rt,bondVariant:vi}}},
      {l:B.meetNo,h:'다시 만나지 않는다',ok:{t:B.meetNoT,fx:{bondDecline:true}}}]};
  }
  /* 인연이 맺어진 뒤의 사건(3~4년마다)과 청혼. 만남은 일상 사건 안에서 일어난다 */
  function bondEvent(G){
    const ch=G.ch,b=ch.bond,y=G.year,B=D.bond;
    if(!B||ch.distForm||ch.job||!b)return null;
    const R=bondData(ch);if(!R)return null;
    if(b.st==='married'||b.st==='lost'){
      const KD=BD.kid,kids=b.kids||(b.kids=[]);
      /* 성인이 된 아이: 사무소·해결사·협회 중 태어날 때 정해진 곳에 들어간다 */
      const grown=kids.find(k=>!k.told&&kidAge(k,y)>=KD.adult);
      if(grown){grown.told=true;const J=B.kidJobs.find(j=>j.k===grown.job)||B.kidJobs[0];
        return {t:J.t,x:kf(J.x,grown.n),c:[{l:J.a,h:'아이는 자라서 자신의 길을 간다',ok:{t:kf(B.kidAT,grown.n),fx:{}}}]}}
      if(b.st!=='married')return null;
      if(d(1000)<=bondRisk(b,y,ch)*10)
        return {t:B.deathT,x:bondFill(R.lost,b),c:[{l:B.deathA,h:`최대 정신력 −${BD.lossMind} (영구) · 해마다 정신력 회복이 끊긴다`,ok:{t:bondFill(B.deathAT,b),fx:{bondDeath:true}}}]};
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
      const S=R.steps[b.step];b.step++;
      return {t:S.t,x:bondFill(S.x,b),c:[
        {l:S.a,h:`인연 +1 · 정신력 +${BD.loveMind}`,ok:{t:bondFill(B.stepAT,b),fx:{bondLove:1}}},
        {l:S.b,h:'변화 없음',ok:{t:bondFill(B.stepBT,b),fx:{}}}]};
    }
    const left=BD.tries-(b.tries||0);
    return {t:R.propose.t,x:bondFill(R.propose.x,b),c:[
      {l:B.proposeYes,h:`1d${BD.die} · ${BD.ok[0]}~${BD.ok[1]}이면 결혼 · 남은 기회 ${left}/${BD.tries}`,ok:{t:bondFill('{n}에게 말을 꺼냈다. 답이 돌아오기까지의 시간이 길게 느껴졌다.',b),fx:{bondPropose:true}}},
      {l:B.proposeWait,h:`1d100 · ${BD.waitDc} 이상이면 기회를 쓰지 않고 넘어간다`,check:{s:null,dc:BD.waitDc},ok:{t:bondFill(B.proposeWaitOk,b),fx:{bondWait:true}},fail:{t:bondFill(B.proposeWaitFail,b),fx:{bondSlip:true}}}]};
  }
  /* 일상: 사건이 있는 해 일부에 온다. 안정적으로 능력치를 조금 올려 주는 사건이고, 인연이 없는 캐릭터는 일부가 인연(조우자)을 만나는 사건이 된다 */
  const DL=CFG.daily;
  function dailyEvent(G){
    const ch=G.ch,y=G.year,L=D.dailyLife;
    if(!L||!L.length||ch.distForm||ch.job||y<DL.from||d(100)>DL.chance)return null;
    if(!ch.bond&&y>=BD.from&&bondRouteOf(ch)&&d(100)<=BD.meetChance){const e=bondMeetEvent(ch);if(e)return e}
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
    if(ch.distForm||ch.job||!isEastOuter(ch)||isN(ch)||!ch.licensed||ch.rank>Z.rank||ch.aff&&(ch.aff.type==='wing'||ch.aff.type==='finger'||ch.aff.type==='head')||(ch.eastScoutN||0)>=Z.tries||y<(ch.eastScoutNext||0))return null;
    ch.eastScoutN=(ch.eastScoutN||0)+1;ch.eastScoutNext=y+Z.gap;
    const T_=D.eastScout,R=D.careers.wing.ranks[Z.startFi];
    return {t:T_.t,x:T_.x,c:[
      {l:T_.yes,h:`${CFG.nWing.name} ${R.n}으로 입사 · 해결사 ${ch.rank}${T.rankUnit} 유지 · 승진마다 함께 오른다 · 운명(모든 판정 +${CFG.nWing.fate})`,ok:{t:T_.yesT,fx:{eastScout:true}}},
      {l:T_.no,h:Z.tries-ch.eastScoutN>0?'나중에 한 번 더 제안이 올 수 있다':'다시 제안은 없다',ok:{t:T_.noT,fx:{}}}]};
  }
  /* 조직 루트 사건: 엄지 전향 제안(흑운회·송곳) → 숙청 소문 → 반역 / 검계 역적 낙인 */
  /* 의리 순례: 중지 동생 이상 → 원한의 책 제안 → 장부 3장 (첫째·둘째는 히든 전투) → 형님의 시험 (순응: 버티기 / 반역: 암살자 추격) */
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
    return {t:K.t,x:K.x,c:[{l:K.l,h:`1d100 · ${P_.dc} 이상이면 ${K.k}를 얻는다 (${n}/${D.pinky.keys.length})`,check:{s:null,dc:P_.dc,pure:true},ok:{t:K.ok,fx:{pinkyKey:true}},fail:{t:K.fail,fx:{}}}]};
  }
  /* 성도: 인의예지를 모두 모으면 이름을 붙인 전용 무기. 공격·회피·추가 피해·명중을 각각 굴린다 */
  function setSeongdo(ch,name,force){
    if(!ch.seongPick||(!force&&nameErr(name)))return false;
    const R=CFG.pinky.seongdo,r=([a,b])=>a-1+d(b-a+1),fx={atk:r(R.atk),eva:r(R.eva)},db=r(R.dmgB),hit=r(R.hit);if(db)fx.dmgB=db;
    const nm=(name||'').trim()||'이름 없는',it={id:'w_seongdo',slot:'weapon',grade:5,n:nm+'성도',e:`공+${fx.atk} · 회피+${fx.eva}${db?' · 피해+'+db:''} · 명중+${hit} (소지의 도 · 인의예지)`,fx,wx:{hitB:hit}};
    offerGear(ch,it);ch.seongPick=false;ch.seongDone=true;(ch.relics=ch.relics||[]).push(`성도 · ${it.n}`);return it;
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
  /* 육신 뒤틀림: 장비를 모두 벗고(보관함), 깡 능력치 상승, 덱은 뒤틀린 책장으로 고정, 정신력은 더 깎이지 않는다 */
  function setDistort(ch,name){
    const X=CFG.distort,s=ch.stats;
    for(const it of Object.values(ch.gear)){if(!it)continue;for(const [k,v] of Object.entries(it.fx||{}))if(k!=='dmin'&&k in s)s[k]-=v;(ch.stash=ch.stash||[]).push(it)}
    ch.gear={};s.dmin=calcDmin(ch);addStats(s,X.fx);ch.hp=clamp(ch.hp+(X.fx.maxHp||0),1,s.maxHp);
    ch.distForm={n:(name||'').trim()||'이름 없는 뒤틀림'};ch.huntNext=(ch.year||0)+(BD.hunt?BD.hunt.gap:3);ch.distPick=false;ch.distortPend=false;ch.distortDone=true;ch.voiceUsed=true;ch.mind=mindMax(ch);
    ch.deck=X.deck.slice();ch.deckLocked=true;ch.cardMoney=true;ch.side=[];ch.offers=[];ch.packOffer=null;
    for(const g of ch.gearOffers||[])(ch.stash=ch.stash||[]).push(g);ch.gearOffers=[];
    (ch.relics=ch.relics||[]).push('뒤틀림 · '+ch.distForm.n);
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
  function tuneGear(ch,slot,stat){
    const T=CFG.shop.tune,g=ch.gear[slot];
    if(!g||ch.distForm||!['atk','eva'].includes(stat)||(g.tries||0)>=T.max||ch.money<tuneCost(g))return null;
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
    const ch=G.ch,b=ch.bond,S=D.bond&&D.bond.sweet,BD_=CFG.bond;
    if(!S||!b||b.st!=='married'||ch.distForm||ch.job)return null;
    const act2=G.year>CFG.years,every=act2?BD_.sweetEvery2:BD_.sweetEvery;
    if(b.sweetAt==null)b.sweetAt=b.since||G.year;
    if(G.year-b.sweetAt<every)return null;
    b.sweetAt=G.year;
    /* 배우자 소속(route)에 맞는 장면은 route가 같은 것만, 공통 장면은 route가 없는 것만. 소속 장면을 60% 확률로 먼저 고른다 */
    const seen=b.sweetSeen=b.sweetSeen||[],ok=e=>!e.route||e.route===b.route;
    let pool=S.items.map((e,i)=>i).filter(i=>ok(S.items[i])&&!seen.includes(i));
    if(!pool.length){seen.length=0;pool=S.items.map((e,i)=>i).filter(i=>ok(S.items[i]))}
    const own=pool.filter(i=>S.items[i].route===b.route),gen=pool.filter(i=>!S.items[i].route);
    const i=one(own.length&&(!gen.length||d(100)<=60)?own:gen.length?gen:pool);seen.push(i);const e=S.items[i];
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
  function advanceYear(G){
    /* G.free: 해를 넘기지 않는 사건(유물·라만차·뒤틀림 등)이면 true → 화면에 연차를 표시하지 않는다 */
    G.free=true;const mc=G.ch;repairFixed(mc);repairDmin(mc);repairFixer(mc);autoOffers(mc);
    if(mc.distPick)setDistort(mc,'');
    /* 기업 루트: 이름 고르기를 건너뛴 채(자동 진행) 넘어오면 기본값으로 정한다 */
    if(mc.singPick)setSing(mc,one(Object.keys(CP.types)),'제로',true);
    if(mc.wingPick)setWing(mc,'새벽',true);
    if(mc.bondPick)setBondName(mc,'동반자',true);
    if(mc.kidPick)setKidName(mc,'',true);
    if(mc.seongPick)setSeongdo(mc,'무명',true);
    if(mc.orgPick)chooseOrg(mc,one(D.orgs[mc.orgPick]));
    if(mc.fingerPick)chooseFinger(mc,mc.thumbBias&&d(100)<=mc.thumbBias?'엄지':one(D.orgs.finger));
    if(mc.pillPick)setPill(mc,'atk');
    if(mc.namePend)mc.namePend=null;
    if(mc.mindDead)return {type:'end',win:false,cause:'mind'};
    if(mc.distorted)return {type:'end',win:false,cause:'distort'};
    if(mc.distortPend&&!mc.ego){mc.distortPend=false;mc.distortDone=true;return {type:'event',ev:D.mindEvents.distort}}
    if(mc.innate==='mark'&&!mc.markOn&&G.year>=CFG.innate.markYear-1)return {type:'event',ev:D.innateEvents.mark};
    if(D.relicEvent&&!mc.relicEvt&&G.year===CFG.relicEvent.year-1){mc.relicEvt=true;return {type:'event',ev:D.relicEvent}}
    {const sw=bondSweetEvent(G);if(sw)return {type:'event',ev:sw}}
    if(mc.familyPend&&D.familyCall){mc.familyPend=false;mc.familyAsked=true;return {type:'event',ev:D.familyCall}}
    /* 조율자: 10년마다 머리의 권한이 한 단계 오른다 (해는 넘어가지 않음) */
    /* 혈귀: 16년차에 라만차랜드 초대장 (해는 넘어가지 않음) */
    if(mc.race==='hyeolgwi'&&D.lamanchaEvent&&!mc.lamanchaAsked&&G.year===CFG.lamancha.year-1){mc.lamanchaAsked=true;return {type:'event',ev:D.lamanchaEvent}}
    if(mc.job==='arbiter'&&D.arbiterAuth&&G.year%10===9&&mc.authAt!==G.year){mc.authAt=G.year;return {type:'event',ev:D.arbiterAuth}}
    if(mc.affRetry&&!mc.aff){mc.affRetry=false;return {type:'event',ev:D.affiliation}}
    if(mc.voicePend&&!mc.voiceUsed&&!mc.ego){mc.voicePend=false;mc.voiceUsed=true;return {type:'event',ev:D.mindEvents.voice}}
    /* 기업 루트 끝: 금기 실험을 forbMax번 하면 머리가 부른다. 발톱 → 조율자가 해를 넘기지 않고 연속으로 온다 */
    if(mc.corp&&mc.corp.chain&&mc.corp.chain.length){
      if(!mc.corp.headSeen){mc.corp.headSeen=true;return {type:'event',ev:D.corp.head}}
      const id=mc.corp.chain.shift();mc.corp.trial=id;(G.met=G.met||[]).push(id);
      return {type:'fight',enemy:id,enc:{hidden:true,label:'머리의 시험 · '+D.enemies[id].n}};
    }
    /* 연전: 바랄을 쓰러뜨리면 쉬지 않고 제나가 나선다 */
    if(G.ch.flags.zenaPend&&!G.ch.beaten.includes(CFG.endless.finalNext))return {type:'fight',enemy:CFG.endless.finalNext,enc:{hidden:true,label:'연전 · 마지막 상대'}};
    /* 무한 모드에서 oldAge살을 넘기면 히든 엔딩 (한 번만, 이어서 살아갈 수 있다) */
    if(G.infinite&&!G.ch.oldEnd&&age(G)>=CFG.oldAge){G.ch.oldEnd=true;return {type:'end',win:true,old:true}}
    /* 무한 모드 추가 엔딩: 한 번씩, 끝낸 뒤에도 이어서 살아갈 수 있다 */
    if(G.infinite){const ch=G.ch,OE=CFG.outEnds;ch.outSeen=ch.outSeen||{};
      const baseEnd_=CFG.years+CFG.endless.span*CFG.endless.grades.length;
      if(!ch.outSeen.seal&&(ch.infImp||1)-1>=OE.sealBeasts){ch.outSeen.seal=1;return {type:'end',win:true,out:'seal'}}
      if(!ch.outSeen.star&&ch.beaten.length>=OE.starHidden){ch.outSeen.star=1;return {type:'end',win:true,out:'star'}}
      if(!ch.outSeen.settle&&bondMarried(ch)&&(ch.bond.kids||[]).some(k=>G.year-k.born>=BD.kid.adult)&&G.year>=baseEnd_+OE.settleYears){ch.outSeen.settle=1;return {type:'end',win:true,out:'settle'}}}
    G.free=false;G.year++;
    if(G.year>lastYear(G)){G.year=lastYear(G);return {type:'end',win:true,trueEnd:!!G.endless}}
    G.ch.year=G.year;
    if(G.year>1){G.ch.hp=Math.min(G.ch.stats.maxHp,G.ch.hp+CFG.yearHeal);if(G.year%(M.healEvery||1)===0)gainMind(G.ch,M.yearHeal);
      {const mt=corpType(G.ch);if(mt&&mt.year)gainMind(G.ch,mt.year+G.ch.corp.up*(mt.yearPer||0))}
      if(bondMarried(G.ch))gainMind(G.ch,BD.yearMind);G.lastIncome=earn(G.ch,income(G.ch));G.ch.money+=G.lastIncome}
    /* 근속: 진로가 있으면 해마다 포인트가 조금씩 쌓인다 */
    if(G.year>1&&CFG.promo.gain.year&&canPromote(G.ch))G.ch.pp=(G.ch.pp||0)+CFG.promo.gain.year;
    let f=fixedSpec(G.year);
    /* 무한런 등급 전투: 등급 마지막 해. 도시의 별 등급은 피아니스트(이미 이겼으면 후반 조우), 마지막 등급은 최종 상대 */
    const X_=CFG.endless,k_=G.year-CFG.years;
    const baseEnd=CFG.years+X_.span*X_.grades.length,INF=CFG.infinite;
    if(G.infinite&&G.year>baseEnd){
      /* 제 2막 무한 모드: 위협 등급 전투는 후반 조우, every년마다 강화 불순물 */
      if((G.year-baseEnd)%INF.every===0)return {type:'fight',enemy:X_.final,enc:{hidden:true,label:`외곽의 괴수 · ${(G.ch.infImp||1)}번째`}};
      f=k_%X_.span?null:'table:late';
    }else
    if(k_>0)f=k_%X_.span?null:gradeAt(G.year)===X_.grades.length-1?X_.finalFirst:gradeAt(G.year)===X_.grades.indexOf('도시의 별')&&!(G.ch.minis||[]).includes(X_.star)?X_.star:'table:late';
    if(f&&k_>0&&!(G.infinite&&G.year>baseEnd)&&gradeAt(G.year)===X_.grades.length-1)return {type:'fight',enemy:f,enc:{label:X_.grades[gradeAt(G.year)]+' · 마지막 등급 전투'}};
    if(f){
      /* 히든 보스: 목록 위에서부터 조건(과 확률)이 맞는 첫 보스가 불길한 예감(omen)으로 먼저 나타난다.
         맞서면 그 보스와 싸우고(다시 나오지 않음), 돌아서면 평소 조우로 넘어간다(조건이 맞으면 다음에 또 나올 수 있다) */
      /* 제 2막 무한 모드의 세계의 균열: 조건과 상관없이 아직 이기지 못한 히든 보스 중 무엇이든 나타난다 */
      if(G.infinite&&G.year>baseEnd&&d(100)<=INF.crack){
        const pool=(D.hiddenBosses||[]).filter(h=>D.enemies[h.id]&&!G.ch.beaten.includes(h.id)&&!(G.met||[]).includes(h.id));
        if(pool.length){const h=one(pool),nm=D.enemies[h.id].n;
          return {type:'omen',boss:h.id,omen:{x:`세계에 균열이 갔다. 갈라진 틈 너머에서 ${nm}의 기척이 느껴진다. 무엇이든 나올 수 있는 시간이다.`,go:'균열 속으로 들어간다',away:'눈을 돌린다',awayT:'균열은 소리 없이 닫혔다. 틈 너머의 것은 다음 기회를 기다린다.'},escape:true,spec:f}}
      }
      for(const h of D.hiddenBosses||[]){
        if(h.infOnly&&!G.infinite)continue;
        if(h.afterKey&&G.year<(G.ch[h.afterKey]||0))continue;
        if(G.year<(h.from||1)||G.ch.beaten.includes(h.id)||(G.met||[]).includes(h.id)||!meets(G.ch,h.req))continue;
        /* chanceBonus: 조건이 맞으면 확률 가산 (예: 검지 소속은 대행자 +30%) */
        const ch_=h.chance?Math.min(95,h.chance+(h.chanceBonus&&meets(G.ch,h.chanceBonus.req)?h.chanceBonus.add:0)+(G.infinite?INF.hiddenAdd:0)):0;
        if(ch_&&d(100)>ch_)continue;
        return {type:'omen',boss:h.id,omen:omenOf(G.ch,h.omen),escape:!h.noEscape,spec:f};
      }
      const e=encounter(G.ch,f);return {type:'fight',enemy:e.id,enc:e};
    }
    /* 갈림길: 공방 해결사 제안이 가끔(WF.chance%) 끼어든다 */
    if(G.year===CFG.affiliationYear&&!G.ch.aff){
      if(D.workshopChoice&&!noFixer(G.ch)&&d(100)<=WF.chance)return {type:'event',ev:Object.assign({},D.affiliation,{x:D.affiliation.x+(D.workshopIntro||''),c:[...D.affiliation.c,D.workshopChoice]})};
      return {type:'event',ev:D.affiliation};
    }
    /* 승급 심사·특색 심사는 조건이 되면 다른 사건보다 먼저 (심사를 미룬 해의 다음 해까지는 다시 묻지 않음) */
    const ch=G.ch;
    if(topReady(ch))return {type:'event',ev:topEvent(ch)};
    if(examReady(ch)&&ch.examSkipYear!==G.year-1){const k=career(ch);return {type:'event',ev:(isFinger(ch)&&D.fingers[ch.aff.name].exam)||(CR[k]&&CR[k].exam)||D.promotionExam}}
    if(D.corp){const ce=corpEvent(G);if(ce)return {type:'event',ev:ce}}
    {const kh=kidHuntEvent(G);if(kh)return kh}
    {const bv=bondEvent(G);if(bv)return {type:'event',ev:bv}}
    {const es=bondEscortEvent(G);if(es)return {type:'event',ev:es}}
    {const dv=dailyEvent(G);if(dv)return {type:'event',ev:dv}}
    {const pe=pinkyEvent(G);if(pe)return {type:'event',ev:pe}}
    {const oe=oracleEvent(G);if(oe)return {type:'event',ev:oe}}
    {const se=eastScoutEvent(G);if(se)return {type:'event',ev:se}}
    {const sr=synRouteEvent(G);if(sr)return {type:'event',ev:sr}}
    {const gr=giriRouteEvent(G);if(gr)return {type:'event',ev:gr}}
    {const ch2=G.ch;if(D.redBook&&ch2.flags&&ch2.flags.redBook&&!ch2.beaten.includes('redmist')&&G.year>=(ch2.bookNext||0)){ch2.bookNext=G.year+CFG.redBook.every;return {type:'event',ev:D.redBook}}}
    /* 6시즌: 격리 실패 (환상체 보스는 조우 표가 아니라 이 사건으로만 나온다) */
    if(D.abnoBreach&&G.year>=CFG.abnoBreach.from&&abnoLeft(ch).length&&d(100)<=CFG.abnoBreach.chance)return {type:'event',ev:D.abnoBreach};
    /* 6시즌: 내 사무소 개설(5급 이상, 5년마다 다시 묻는다) · 소속 없는 해결사는 4년마다 급수에 맞는 사무소 문을 두드린다 */
    if(D.officeFound&&canFound(ch)&&G.year>=(ch.officeNext||0)){ch.officeNext=G.year+CFG.office.foundEvery;return {type:'event',ev:D.officeFound}}
    if(D.officeKnock&&ch.licensed&&!ch.aff&&!ch.job&&!noFixer(ch)&&G.year>CFG.affiliationYear&&G.year>=(ch.knockNext||0)){ch.knockNext=G.year+CFG.office.knockEvery;return {type:'event',ev:D.officeKnock}}
    /* 사건을 다 쓰면 다시 섞는다 */
    if(!G.pool.length)G.pool=sample(D.events.map((_,i)=>i),D.events.length);
    /* first 표시가 있는 사건(소속 전용 등)은 조건이 맞으면 먼저 나온다 */
    const fi=G.pool.findIndex(i=>D.events[i].first&&meets(G.ch,D.events[i].req));
    if(fi>=0)return {type:'event',ev:evForJob(D.events[G.pool.splice(fi,1)[0]],G.ch)};
    /* 출신 진로 보정이 있으면 그 진로의 권유 사건(tag)이 보정값 × pathEventMul % 확률로 먼저 나온다 */
    const tagged=G.pool.filter(i=>{const e=D.events[i];return e.tag&&(G.ch.paths[e.tag]||0)>0&&meets(G.ch,e.req)});
    if(tagged.length){
      const ti=one(tagged);
      if(d(100)<=(G.ch.paths[D.events[ti].tag]||0)*CFG.pathEventMul){G.pool.splice(G.pool.indexOf(ti),1);return {type:'event',ev:evForJob(D.events[ti],G.ch)}}
    }
    while(G.pool.length){const ev=D.events[G.pool.pop()];if(meets(G.ch,ev.req)&&(!ev.chance||d(100)<=ev.chance))return {type:'event',ev:evForJob(ev,G.ch)}}
    return {type:'event',ev:D.events.find(e=>e.fallback)||D.events[0]};
  }
  /* 불길한 예감에 대한 답: go면 히든 보스, 아니면 원래 고정 전투 지정대로 조우 */
  /* 인연이 걸린 전조 문구의 {n}을 이름으로 채운다 */
  const omenOf=(ch,o)=>{if(!o||!ch.bond||!ch.bond.name)return o||{};const f=t=>t&&bondFill(t,ch.bond);return Object.assign({},o,{x:f(o.x),go:f(o.go),away:f(o.away),awayT:f(o.awayT)})};
  function answerOmen(G,st,go){
    if(go||!st.escape){(G.met=G.met||[]).push(st.boss);return {type:'fight',enemy:st.boss,enc:{hidden:true,label:T.hiddenBoss}}}
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
  const checkDie=ch=>Math.min(CFG.checkMax,100+(ch.artSense||0)*CFG.artSense.die+(ch.innate==='miracle'?Math.floor((ch.year||0)/CFG.innate.miracleEvery)*CFG.innate.miracleDie:0));
  function checkMod(ch,check){if(check.pure)return 0;return (check.s?ch.stats[check.s]:0)+ch.stats.check+mindStat(ch)+pathMod(ch,check)+(check.dc==='color'?ch.colorBonus||0:0)}
  /* 선택: 판정이 있으면 1d100 + 능력치 + 판정 보정 ≥ 난이도 */
  function choose(G,ev,i){
    const ch=G.ch,c=ev.c[i];let res=c.ok,roll=null,xp=CFG.xp.plain,xpNote=null;
    if(c.check){
      const ib=ch.innate==='intuition'&&!c.check.pure?d(CFG.innate.intuitionDie):0;
      const dc=checkDc(ch,c.check),mod=checkMod(ch,c.check)+ib,cd=c.check.pure?100:checkDie(ch),r=d(cd),tot=r+mod,ok=tot>=dc;
      if(ib)xpNote=`타고난 직감 +${ib}`;
      roll={r,mod,tot,dc,ok,die:cd};res=ok?c.ok:c.fail;xp=ok?CFG.xp.ok:CFG.xp.fail;
    }
    const fx=res.fx||{};
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
      if(ok){giveRelic(ch,'odin',true);chips.push('유물 · '+D.relics.odin.n+' ('+D.relics.odin.e+')');if(ch.yeji)chips.push('패시브 · 가속하는 미래 · 버프 · 예지안 (전용 검술 카드 피해 +'+CFG.odin.yeji+')');else chips.push('버프 · 순간의 예지 · 첫 라운드 회피 +'+CFG.odin.first+' · 이후 +'+CFG.odin.after)}else chips.push('보물고는 비어 있었다')}
    if(fx.wsRoll){
      const r=d(WF.die);chips.push(`1d${WF.die} · ${r} (${WF.minRoll} 이상)`);
      if(r>=WF.minRoll){const was=ch.licensed;if(!was)license(ch);ch.aff={type:'workshop',name:'공방 해결사'};
        chips.push(`소속 · 공방 해결사${was?'':' · '+T.licenseGained+' '+ch.rank+T.rankUnit}`);chips.push('공방 물건 20% 할인 · 보관함 장비 판매');}
      else{chips.push('공방 주인이 고개를 젓는다 · 다른 길을 고른다');ch.affRetry=true}
    }
    if(fx.voice){
      const rs=[];for(let i=0;i<M.voiceRolls;i++)rs.push(d(M.voiceDie));
      const ok=rs.every(r=>r>=M.voiceDc);chips.push(`1d${M.voiceDie} × ${M.voiceRolls} · ${rs.join(' / ')} (${M.voiceDc} 이상 ${rs.filter(r=>r>=M.voiceDc).length}/${M.voiceRolls})`);
      const sight=!ok&&(ch.stats.egoSight||0)>0&&d(100)<=ch.stats.egoSight;if(sight)chips.push(`장비의 형상이 보였다 · ${ch.stats.egoSight}%`);
      if(ok||sight){ch.egoPick=true;chips.push('E.G.O 개화')}else{const x=d(M.failLoss);chips.push('개화 실패');loseMind(ch,x,t=>chips.push(t+` · 1d${M.failLoss}`))}
    }
    if(fx.distort){
      const r=d(2);chips.push(`뒤틀림 판정 1d2 · ${r}`);
      if(r===1){ch.egoPick=true;ch.mind=mindMax(ch);chips.push('뒤틀리기 직전, E.G.O 개화 · 정신력 회복')}else{ch.distPick=true;chips.push('육신이 뒤틀린다 · 뒤틀림의 이름을 정한다')}
    }
    if(fx.distortAccept){ch.distPick=true;chips.push('뒤틀림을 받아들였다 · 뒤틀림의 이름을 정한다')
    }
    if(fx.singPick){ch.singPick=true;chips.push('특이점 개발 · 효과와 이름을 정한다')}
    if(fx.corpDecline&&ch.corp)ch.corp.st='declined';
    if(fx.wingPick){ch.wingPick=true;chips.push('날개 설립 · 이름을 정한다')}
    if(fx.singGrow)corpGrow(ch,chips);
    if(fx.singUp)corpUp(ch,chips);
    if(fx.corpForb)corpForb(ch,chips);
    if(fx.bondMeet){ch.bond={st:'pick',route:fx.bondMeet,variant:fx.bondVariant||0,name:'',step:0,tries:0,love:0};ch.bondPick=true;chips.push('인연 · 동반자의 이름을 정한다')}
    if(fx.bondDecline)ch.bond={st:'declined'};
    if(fx.bondDeath&&ch.bond&&ch.bond.st==='married')bondDeath(ch,chips);
    if(fx.bondKid&&ch.bond){const k_={n:fx.bondKid,born:ch.year||0,job:one(D.bond.kidJobs).k,told:false};(ch.bond.kids=ch.bond.kids||[]).push(k_);ch.stats.mindMax=(ch.stats.mindMax||0)+BD.kid.mind;gainMind(ch,BD.kid.mind);k_.pend=true;ch.kidPick=true;chips.push('아이가 태어났다 · 이름을 정한다');chips.push(`최대 정신력 +${BD.kid.mind}`)}
    if(fx.bondLove&&ch.bond){ch.bond.love=(ch.bond.love||0)+1;const g_=gainMind(ch,BD.loveMind);chips.push('인연 +1'+(g_?` · 정신력 +${g_}`:''))}
    if(fx.bondPropose)bondPropose(ch,chips,true);
    if(fx.bondSlip)bondPropose(ch,chips,false);
    if(fx.bondWait)chips.push('기회는 그대로다');
    if(roll&&roll.ok&&!fx.examPass&&!fx.colorPass&&!fx.topPass)addPts(ch,CFG.promo.gain.check,chips);
    const up=gainXp(ch,xp);chips.push('경험치 +'+xp);if(up)chips.push('레벨 업 · Lv '+ch.lv);
    let enc=fx.combat?encounter(ch,fx.combat):null;
    if(ch.purge){enc={id:ch.purge};delete ch.purge;chips.push('숙청 · '+D.enemies[enc.id].n)}
    if(enc&&enc.roll)chips.push(`조우 1d100 ${enc.roll} · ${D.enemies[enc.id].n}`);
    return {t:res.t,roll,chips,title:licensed?rankLabel(ch):null,tlabel:licensed?T.licenseGained:null,combat:enc?enc.id:null,enc};
  }
  /* 전투 승리 보상: 회복, 카드, 경험치, 자격 등록 또는 (고정 전투) 승급 */
  function winRewards(G,C){
    const ch=G.ch,chips=[];
    ch.hp=clamp(C.P.hp+CFG.winHeal,1,ch.stats.maxHp);chips.push('HP +'+CFG.winHeal);
    if((ch.ample||0)!==(C.P.ample||0)){chips.push(`${CFG.ample.name} 사용 · 남은 ${C.P.ample||0}개`);ch.ample=C.P.ample||0}
    if(ch.infinite&&C.id===CFG.endless.final)ch.infImp=(ch.infImp||1)+1;
    if(C.escort){const Z=CFG.escort,m=earn(ch,Z.money+Z.moneyPer*C.escort.lv);ch.money+=m;chips.push(`동행 의뢰 보수 · ${C.escort.name} · +${money(m)}`)}
    if(C.id==='kid_hunt'&&ch.bond){
      if(ch.kidFoeSpouse){if(ch.bond.st==='married'){ch.bond.st='lost';chips.push(kf(D.bond.hunt.winSpouse,ch.bond.name))}}
      else{const kk=(ch.bond.kids||[]).find(k=>k.n===ch.kidFoe&&!k.dead);if(kk){kk.dead=true;chips.push(kf(D.bond.hunt.win,kk.n))}}}
    if(ch.flags&&ch.flags.redMist){const h=Math.min(CFG.redMist.heal,ch.stats.maxHp-ch.hp);if(h>0){ch.hp+=h;chips.push('붉은 안개 · 적을 쓰러뜨려 HP +'+h)}}
    addCard(ch,rewardCard(ch),chips,null,true);
    const bounty=earn(ch,D.money.bounty[D.enemies[C.id].tier]||0);if(bounty){ch.money+=bounty;chips.push('현상금 +'+money(bounty))}
    const up=gainXp(ch,CFG.xp.win);chips.push('경험치 +'+CFG.xp.win);if(up)chips.push('레벨 업 · Lv '+ch.lv);
    if(ch.egoNote){chips.push(ch.egoNote);ch.egoNote=null}
    if(ch.bloomNote){chips.push(ch.bloomNote);ch.bloomNote=null}
    let title=null,tlabel=null,newly=false,colorRoll=null,unlock=null;
    const foe=D.enemies[C.id];
    /* 인연: 결혼 중 히든 보스를 이길 때마다 배우자 사망 위험이 0.1%씩 쌓인다 (엔딩까지 가려면 거의 반드시 잡아야 하는 상대) */
    if(ch.bond&&ch.bond.st==='married'&&foe.hidden)ch.bond.risk=(ch.bond.risk||0)+BD.riskStep;
    /* 피의 각인된 갈망: 전투가 끝나면 자식이 흩어지고(각자 확률), 이긴 일반·보스 적은 새 자식이 된다. 히든 보스·환상체는 안 된다 */
    if(kidsOn(ch)){
      const KD=CFG.kids,before=ch.kids||0;let keep=0;for(let i=0;i<before;i++)if(d(100)>KD.lose)keep++;
      ch.kids=keep;if(before>keep)chips.push(`자식 ${before-keep}명이 흩어졌다 (${keep}/${KD.max})`);
      if(!foe.hidden&&!foe.abno&&ch.kids<KD.max){ch.kids++;chips.push(`피의 각인된 갈망 · ${foe.n}이(가) 혈귀가 되어 자식이 된다 (${ch.kids}/${KD.max})`)}
    }
    if(foe.hidden){
      ch.beaten.push(C.id);chips.push(T.hiddenWin+' · '+foe.n);
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
      if(foe.drop&&!td){const dr=foe.drop;addStats(ch.stats,dr.fx);if(dr.fx.maxHp)ch.hp+=dr.fx.maxHp;(ch.relics=ch.relics||[]).push(dr.n);
        if(dr.flag)ch.flags[dr.flag]=1;
        if(dr.promote&&ch.fi===(dr.promoteFrom||1)&&canFingerUp(ch))chips.push(...fingerStep(ch))
        if(dr.title){ch.titles=ch.titles||[];if(!ch.titles.includes(dr.title)){ch.titles.push(dr.title);(ch.titleLog=ch.titleLog||[]).push(dr.title)}chips.push('칭호 · '+dr.title)}
        for(const x of dr.extra||[]){addStats(ch.stats,x.fx);if(x.fx.maxHp)ch.hp+=x.fx.maxHp;ch.relics.push(x.n);if(x.flag)ch.flags[x.flag]=1;chips.push(`전리품 · ${x.n} (${x.e}, 영구)`)}
        if(dr.gear){offerGear(ch,Object.assign({id:dr.gear.id,grade:5},dr.gear));chips.push(`전리품 무기 · ${dr.gear.n} (${dr.gear.e}) · 장착할지 고른다`)}
        for(const g of dr.gears||[]){if(dr.gear&&dr.gearChance!=null&&d(100)>dr.gearChance)continue;offerGear(ch,Object.assign({grade:5},g));chips.push(`전리품 ${g.slot==='armor'?'방어구':'장비'} · ${g.n} (${g.e}) · 장착할지 고른다`)}
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
     라운드마다 1d100 + 속도로 순서를 정하고, 카드는 순서대로 한 장씩 번갈아 발동한다. */
  function mkEnt(o){return Object.assign({bleed:0,rupture:0,breath:0,burn:0,flame:0,nail:0,stagger:0,stunned:false,charge:0,sink:0,spent:0,chargeCap:CFG.charge.cap,chargeLoss:CFG.charge.loss,chargeRound:0,chargeHit:0,evaB:0,fs:false,fsOn:false,catchup:false,cu:false,
    dmin:1,defUp:0,adv:0,advUsed:false,hand:[],light:0,guarding:false,passHit:0,passHitNext:0,lightUp:0,lightNext:0},o)}
  /* 푸른 화염: 해방 레바테인에게 화상을 받은 쪽(blue), 또는 화상 blueAt 이상 */
  /* 카드 등급: 연차가 쌓이면 공격 카드가 강해지는 주인공 보정. 쉬움에서는 받지 않는다 */
  const cardGrade=(y,ch)=>ch&&ch.easy?CFG.cardGrade[0]:[...CFG.cardGrade].reverse().find(g=>(y||1)>=g.from)||CFG.cardGrade[0];
  /* 레바테인 해방 단계: 봉인(0) · 1단계 ¼ · 2단계 ½ · 완료 1 */
  const LAEV_F={laev_sealed:0,laev_s1:0.25,laev_s2:0.5,laev:1};
  const laevFrac=w=>w&&LAEV_F[w.id]!=null?LAEV_F[w.id]:null;
  const laevState=w=>{const f=laevFrac(w);return f==null?null:f>=0.5?'open':'sealed'};
  const isBlue=X=>X.flame>0&&(X.blue||X.flame>=CFG.laev.blueAt);
  const snap=C=>{const f=X=>({hunger:X.hunger||0,hp:Math.max(0,X.hp),bleed:X.bleed,rupture:X.rupture,breath:X.breath,burn:X.burn||0,flame:X.flame||0,nail:X.nail||0,stagger:X.stagger||0,stunned:!!X.stunned,work:X.work||0,blue:isBlue(X),echo:X.echo||0,ledger:X.ledger||0,prescript:X.prescript||0,warp:X.warp||0,shock:X.shock||0,chain:X.chain||0,web:X.web||0,mk:X.mk||0,grudge:X.grudge||0,shield:X.shield||0,matc:X.matc||0,mat:X.mat||0,wecho:X.wecho||0,revenge:X.revenge||0,revMul:X.revMul||0,presc:X.presc||0,serum:X.serum||0,ammo:X.ammo||0,manner:X.manner||0,disp:X.disp||0,sealMark:X.sealMark||0,accel:X.accel||0,cloud:X.cloud||0,black:X.black?1:0});return {P:f(C.P),E:f(C.E)}};
  /* 오랜 굶주림: HP를 회복할 때마다 스택 */
  const HG=(X,h)=>{if(h>0&&X&&X.hunger!=null)X.hunger=Math.min(CFG.hunger.max,X.hunger+h)};
  const kidsOn=ch=>ch.race==='hyeolgwi'&&(ch.beaten||[]).includes('dulcinea');
  function mkCombat(ch,id,quiet){
    const s=ch.stats,e=D.enemies[id];
    const P=mkEnt({uid:'P',hunger:ch.flags&&ch.flags.hunger?0:null,name:ch.name||T.you,color:ch.color,hp:ch.hp,maxHp:s.maxHp,atk:s.atk,eva:s.eva,spd:s.spd,
      bleed:s.startBleed,breath:s.startBreath,dmin:s.dmin,defUp:s.defUp,adv:s.adv,advDie:s.advDie||0,hwando:!!ch.hwando,resonance:!!ch.resonance,oracle:!!ch.oracle,middle:!!(ch.aff&&ch.aff.name==='중지'),bladeBoost:!!(ch.flags&&ch.flags.bladeBoost),kuro:synOf(ch)==='kuro'&&synTier(ch.deck.length)>=2,blade:synOf(ch)==='blade'&&synTier(ch.deck.length)>=2,awl:synOf(ch)==='awl'&&synTier(ch.deck.length)>=2,synT:synOf(ch)?Math.max(0,synTier(ch.deck.length)):0,midDr:ch.aff&&ch.aff.name==='중지'?(CFG.middle.dr[ch.fi||0]||0):0,midEff:ch.aff&&ch.aff.name==='중지'?(CFG.middle.evaEff[ch.fi||0]??1):1,ring:!!(ch.aff&&ch.aff.name==='약지'),work:0,index:!!(ch.aff&&ch.aff.name==='검지'),thumb:!!(ch.aff&&ch.aff.name==='엄지'),ammo:ch.aff&&ch.aff.name==='엄지'?CFG.thumbAmmo.base+CFG.thumbAmmo.per*(ch.fi||0):0,deck:ch.deck,extraD2:(s.extraD2||0),dmgB:s.dmgB||0,burnHit:s.burnHit||0,pdie:s.pdie||6,hyeolchan:ch.race==='hyeolgwi',psycho:ch.innate==='psycho',cg:cardGrade(ch.year,ch),wx:ch.gear.weapon&&ch.gear.weapon.wx||null,jobPassive:ch.job&&D.hiddenJobs[ch.job]?D.hiddenJobs[ch.job].passive||null:null,mark:!!ch.markOn,odin:!!ch.odin,odinMid:!!(ch.odin&&ch.aff&&ch.aff.name==='중지'),revenge:(ch.odin&&ch.aff&&ch.aff.name==='중지')?CFG.odin.midStart:0,bonB:bonCardB(ch),yeji:!!(ch.yeji||(ch.odin&&ch.o&&ch.o.n==='보냐텔리 가문')),dr:s.dr||0,regen:s.regen||0,singHeal:corpType(ch)&&corpType(ch).heal?corpType(ch).heal+ch.corp.up*corpType(ch).per:0,warpLead:corpType(ch)&&corpType(ch).lead?corpType(ch).lead+ch.corp.up*(corpType(ch).leadPer||0):0,egoLight:ch.ego?M.light:0,egoRounds:M.lightRounds,augHunt:isN(ch)?CFG.nWing.augDmg:0,distorted:!!ch.distForm,laev:laevState(ch.gear.weapon),laevF:laevFrac(ch.gear.weapon),isP:true});
    P.ample=ch.ample||0;
    const EZ=ch.easy?CFG.easy:null,S_=CFG.enemyScale,yy=Math.max(0,(ch.year||0)-S_.from),grow=e.hidden?0:yy*(EZ?EZ.grow:1);
    const H_=CFG.hidden,HL=CFG.hiddenLate,hy=e.hidden?Math.max(0,(ch.year||0)-HL.from)*(EZ?EZ.late:1):0,g=((ch.infinite?gradeRaw(ch.year||0):gradeAt(ch.year||0))+1)*(EZ?EZ.endless:1),X_=CFG.endless;
    const eh=Math.round(((e.hp+s.enemyHp)*(1+S_.hpPerYear*grow)*(e.hidden?H_.hpMul*(EZ?EZ.hidden:1):S_.hpMul)+hy*HL.hpPerYear)*(1+X_.hpMul*g));
    const up=Math.floor(grow/S_.atkEvery)+(e.hidden?H_.atk+Math.floor(hy/HL.atkEvery):0),xa=X_.atk*g;
    /* 보스별 난이도 보정(hard): 체력 배수, 공격·회피 가산 */
    const IM_=ch.infinite&&id===X_.final?(ch.infImp||0):0;
    const SI_=ch.infinite?Math.max(0,gradeRaw(ch.year||0)-X_.grades.length+1):0;
    const hd=e.hard||null,nm=e.names&&e.names.length?CFG.named:null,tr=ch.corp&&ch.corp.trial===id?CFG.corp.trial[id]:null,ehh0=Math.round((hd?eh*(EZ?1+((hd.hp||1)-1)*EZ.bossHard:(hd.hp||1)):eh)*(nm?nm.hp:1)*(tr?tr.hp:1)*(ch.hard?CFG.hard.hp:1)*(EZ?EZ.hp*(EZ.boss&&EZ.boss[id]||1):1)*(1+CFG.infinite.impPer*IM_)*Math.pow(1+CFG.infinite.hpGrow,SI_));
    const ehh=EZ&&e.hidden?Math.max(ehh0,EZ.hiddenMin||0):ehh0;
    /* 네임드: 로보토미 직원처럼 무작위 이름. 절반은 세력 이름 목록, 절반은 공용 이름 목록에서 */
    const E=mkEnt({uid:'E',name:e.names&&e.names.length?`${e.n} · ${(D.namePool&&d(2)===1?one(D.namePool):one(e.names))}`:e.n,color:e.color,hp:ehh,maxHp:ehh,atk:Math.max(1,e.atk+up+xa+CFG.infinite.impAtk*IM_+CFG.infinite.atkGrow*SI_+Math.round((hd&&hd.atk||0)*(EZ?EZ.bossHard:1))-(EZ?EZ.atkMinus:0))+(nm?nm.atk:0)+(tr?tr.atk:0)+(ch.hard?CFG.hard.atk:0),eva:e.eva+up+Math.round(CFG.infinite.evaGrow*SI_)+Math.round((hd&&hd.eva||0)*(EZ?EZ.bossHard:1))+(ch.hard?CFG.hard.eva:0),spd:e.spd,deck:e.deck,isP:false,passive:e.passive&&e.passive.id==='lockledger'&&ch.infinite?null:e.passive||null,aug:!!e.aug,hyeolchan:!!e.hyeolchan,trait:e.trait||null,ul:e.ul||null,middle:!!(e.passive&&e.passive.id==='brother'),revMul:e.passive&&e.passive.id==='brother'?e.passive.mul:0});
    /* 무한 모드에서도 적의 명중·회피는 enemyMax에서 멈춘다 */
    E.atk=Math.min(E.atk,CFG.infinite.enemyMax);E.eva=Math.min(E.eva,CFG.infinite.enemyMax);
    /* 급수 부족 보정: 히든 보스 규칙에 penalty가 있고 fullRank보다 급수가 낮으면 내 명중·회피가 깎인다 */
    const rule=(D.hiddenBosses||[]).find(h=>h.id===id),pen=rule&&rule.penalty;
    let penalty=null;
    if(isN(ch)){P.atk+=CFG.nWing.atk;P.eva+=CFG.nWing.eva;P.spd+=CFG.nWing.spd;P.nailHit=CFG.nail.hit;if(ch.fate){P.nailHit=0;P.atk+=CFG.nWing.fate;P.eva+=CFG.nWing.fate}}
    if(pen&&!(ch.licensed&&ch.rank<=pen.fullRank)){P.atk+=pen.atk||0;P.eva+=pen.eva||0;penalty=pen}
    /* 히든 보스: 체력이 너무 낮으면 최소치까지 채운 상태로 시작 */
    let hpNote=null;
    if(P.laev==='open'){P.flame=1}
    if(e.hidden&&P.hp<Math.min(CFG.hidden.minHp,P.maxHp)){const t=Math.min(CFG.hidden.minHp,P.maxHp);hpNote=`불길한 예감에 숨을 고른다 · HP ${P.hp} → ${t}`;P.hp=t;ch.hp=t}
    /* 정신력: 환상체와 마주치면 2d3 감소, 그다음 정신력 구간 보정(호흡·회피) */
    let mindNote=hpNote?[hpNote]:[];
    if(e.abno)loseMind(ch,d(3)+d(3),t=>mindNote.push(`환상체와 마주쳤다 · ${t} · 2d3`));
    const mt=mindTier(ch),ct=corpType(ch),tm=ct&&ct.tier?ct.tier+ch.corp.up*(ct.tierPer||0):1;
    {const dn=(ch.deck||[]).length,DB=CFG.deck.bonus,db=dn>=DB.from?(Math.floor((dn-DB.from)/DB.per)+1)*DB.atk:0;if(db){P.atk+=db;mindNote.push(`덱 ${dn}장 · 공격 +${db}`)}}
    if(P.kuro){const k=CFG.syn['흑운회'];P.cloud=k.start[P.synT];mindNote.push(`암운 · 구름 ${P.cloud} (덱 ${ch.deck.length}장)`)}
    if(P.blade)mindNote.push(`호흡결 · 매 라운드 호흡 +${P.synT>=2?2:1} · 자연 감소 ${CFG.syn['검계'].decay[P.synT]} (덱 ${ch.deck.length}장)`);
    if(P.awl){const w=CFG.syn['밤의 송곳'];P.synInit=w.init[P.synT];mindNote.push(`뒷골목의 룰 · 속도 굴림 +${P.synInit} (덱 ${ch.deck.length}장)`)}
    const ms=mindStat(ch);if(ms){P.atk+=ms;P.eva+=ms;P.spd+=ms;P.maxHp+=ms;P.hp+=ms;mindNote.push(`정신력 ${ch.mind} · 모든 능력치 +${ms}`)}
    if(mt){const tb=Math.round(mt.breath*tm),te=Math.round(mt.eva*tm);P.breath+=tb;P.eva+=te;mindNote.push(`정신력 ${ch.mind} · 호흡 +${tb}${te?` · 회피 +${te}`:''}${tm>1?' (월광석)':''}`)}
    {const o=assocOf(ch),CH=o&&(CFG.charge.orgs[o+(ch.rteam?'/'+ch.rteam:'')]||CFG.charge.orgs[o]);if(CH){P.chargeCap=CH.cap||P.chargeCap;P.chargeLoss=CH.loss??P.chargeLoss;P.chargeRound=CH.round||0;P.chargeHit=CH.hit||0;P.spd+=CH.spd||0;P.spdBoost=CH.boost||null;P.spdBase=P.spd;P.pw=CH.power||null;P.wl=CH.wall||null;P.focus=CH.focus||null;P.armor=CH.armor||null;P.dmgB0=P.dmgB||0;P.defUp0=P.defUp||0;P.dr0=P.dr||0;P.lostN=0}}
    /* 토벌 의뢰의 가족: 주인공과 같은 카드를 쓰고, 능력치는 내 능력치의 배수 (특색급(최고 급수)은 mulTop, 그 밑은 mul) */
    if(e.kidHunt){const K=CFG.bond.hunt,m=(ch.kidFoeLv||0)>=K.topLv?K.mulTop:K.mul;
      E.maxHp=E.hp=Math.max(1,Math.round(P.maxHp*m));E.atk=Math.max(1,Math.round(P.atk*m));E.eva=Math.round(P.eva*m);E.spd=Math.round(P.spd*m);E.deck=ch.deck.slice()}
    /* 인연과 함께 싸우는 보스(엘레나): 결혼한 인연이 라운드마다 추가 공격 */
    const ally=e.ally&&ch.bond&&ch.bond.st==='married'?{name:ch.bond.name,lv:spouseLevel(ch.bond,ch.year||0)}:null;
    const allyFirst=ch.flags&&ch.flags.bondFirst&&ch.bond&&ch.bond.st==='married'?{name:ch.bond.name,lv:spouseLevel(ch.bond,ch.year||0)}:null;
    const C={ch,P,E,id,ally,allyFirst,penalty,duel:assocOf(ch)===CFG.duel.org?CFG.duel.dmg:0,round:0,log:[],cur:[],evs:[],logBefore:0,over:null,order:[],quiet:!!quiet,mindNote};
    {const fl=ch.flags||{};if(fl.escortNext){fl.escortNext=0;if(ch.bond&&ch.bond.st==='married')C.escort={name:ch.bond.name,kind:escortKind(ch.bond.route),lv:spouseLevel(ch.bond,ch.year||0)}}}
    activeC=C;
    if(ch.mindDead&&!ch.ego&&!ch.distForm)mindBreak(C);
    newRound(C);
    return C;
  }
  /* 순서: 1d100 + 속도 (+ 지난 라운드에 뒤처졌으면 추격 보정).
     상대보다 높으면 빛 +1, 격차 gapFirst 이상이면 첫 공격 명중 +firstHit. 동점이면 둘 다 보너스 없음 */
  /* 오딘의 눈 · 가속하는 미래: 라운드마다 회피 보정이 cycle 순서로 돌아간다 (마지막 칸은 과부하) */
  /* 예지안(보냐텔리 가문이 오딘의 눈을 얻으면): 전용 검술 카드(b_)의 피해 +CFG.odin.yeji */
  const BONA=new Set(Object.entries(D.cards).filter(([k])=>k.startsWith('b_')).map(([,v])=>v));
  const odinEva=(r,X)=>X&&X.middle&&X.isP?0:X&&X.yeji?CFG.odin.cycle[(r-1)%CFG.odin.cycle.length]:(r===1?CFG.odin.first:CFG.odin.after);
  function newRound(C){
    C.round++;
    const {P,E}=C;P.triDmg=0;P.triCut=0;C.tri=null;
    P.evaPen=P.evaPenNext||0;P.evaPenNext=0;
    /* 토끼 강화·충전 자극 근력: 체력이 낮거나 충전이 충분하면 라운드 동안 속도가 오른다 */
    if(P.spdBoost){const B_=P.spdBoost;P.spd=P.spdBase+(P.hp<=P.maxHp*B_.low[0]?B_.low[1]:0)+(P.charge>=B_.charge[0]?B_.charge[1]:0)}
    /* 순록팀·코뿔소팀: 체력을 잃을수록 공격 피해(순록) · 방어(코뿔소)가 오르고, 충전이 충분하면 코뿔소는 받는 피해가 줄어든다 */
    if(P.pw||P.wl){const T_=P.pw||P.wl,n=Math.min(T_.max,Math.floor((P.maxHp-P.hp)/(P.maxHp*T_.step)));if(n>P.lostN)P.lostN=n;
      if(P.pw)P.dmgB=P.dmgB0+T_.dmg*P.lostN;if(P.wl)P.defUp=P.defUp0+T_.def*P.lostN}
    if(P.armor)P.dr=P.dr0+(P.charge>=P.armor.at?P.armor.dr:0);
    if(P.chargeRound){P.charge=Math.min(P.chargeCap,P.charge+P.chargeRound)}
    for(const X of [P,E]){X.r=d(100);X.cu=X.catchup;X.tot=X.r+X.spd*CFG.spdMul+(X.synInit||0)+(X.catchup?CFG.catchupBonus:0)+(X.warpLead>=C.round?200:0)}
    for(const [X,Y] of [[P,E],[E,P]]){
      X.lead=X.tot>Y.tot;X.awlUsed=false;X.fsOn=X.fs=X.tot-Y.tot>=CFG.gapFirst;X.catchup=X.tot<Y.tot;X.advUsed=false;
      const el=X.egoLight&&C.round<=X.egoRounds?X.egoLight:0;
      X.light=Math.min(CFG.lightMax+X.lightUp+X.lightNext+el,CFG.light+X.lightUp+X.lightNext+el+(X.lead?CFG.orderBonusLight:0));
      X.passHit=X.passHitNext;X.passHitNext=0;X.lightNext=0;X.matBonus=X.matNext||0;X.matNext=0;
    }
    /* 피의 각인된 갈망: 자식 1명당 라운드마다 혈찬 스택 per를 바로 얻는다 */
    {const kn=kidsOn(C.ch)&&P.hyeolchan?C.ch.kids||0:0;
      if(kn>0&&P.hp>0){P.hc=(P.hc||0)+CFG.kids.per*kn;let h=0;while(P.hc>=5){P.hc-=5;const x=Math.min(15,P.maxHp-P.hp);P.hp+=x;h+=x}HG(P,h);
        C.kidNote=`${P.name} · 피의 각인된 갈망 · 자식 ${kn}명 · 혈찬 +${CFG.kids.per*kn}${h?` · HP +${h}`:''}`}}
    if(C.round>1)for(const X of [P,E])if(X.breath>0)X.breath=Math.max(0,X.breath-(X.blade?(X.bladeBoost&&X.synT>=2?0:CFG.syn['검계'].decay[X.synT]):CFG.breath.decay));
    if(P.blade){const g=P.synT>=2?2:1;P.breath=Math.min(CFG.breath.cap,P.breath+g);if(!C.quiet){const m={t:'kw',s:`${P.name} · 호흡결 · 호흡 +${g} (지금 ${P.breath})`};C.log.push(m);C.cur.push(m)}}
    {const dk=P.deck.filter(id=>!(D.cards[id].once&&(C.onceUsed||[]).includes(id)));P.hand=sample(dk.length?dk:P.deck,CFG.hand)}
    if(P.furiosoNext){P.hand.push('x_furioso');P.furiosoNext=false}
    if(P.boneNext){P.hand.push('bl_bone');P.boneNext=false}
    if(P.grantNext){P.hand.push(P.grantNext);P.grantNext=null}
    /* 검지 패시브 지령 수행: 손패 한 칸에 ☆ 지령이 박힌다 */
    if(P.index){P.starSlot=d(Math.min(CFG.hand,P.hand.length))-1;P.starId=P.hand[P.starSlot]}
    /* 히든 보스 전용 패시브: 라운드 단위 */
    const pv=E.passive&&E.passive.id;
    E.maskOn=pv==='mask'&&C.round%E.passive.every===0;
    if(pv==='kin'&&C.round>1&&d(100)<=E.passive.chance){P.angry=E.passive.anger;{const m={t:'kw',s:`중지의 아우가 얻어맞았다 · 분노 · 다음 적중 +${E.passive.anger}`};if(!C.quiet){C.log.push(m);C.cur.push(m)}}}
    if(pv==='stance'){const st=Math.floor((C.round-1)/E.passive.every)%2===0?'bear':'tiger';if(E.sal==null)E.sal=5;
      if(E.stance!==st){E.stance=st;E.deck=E.passive.decks[st];if(!C.quiet){const m={t:'kw',s:`${E.name} · 본국태세 · ${st==='bear'?'곰 사냥 (강한 일격 · 살이 높을수록 강하다)':'범 사냥 (연격 · 살이 낮을수록 강하다)'}`};C.log.push(m);C.cur.push(m)}}}
    P.locked=pv==='lock'&&C.round%E.passive.every===0?d(P.hand.length)-1:-1;
    C.order=P.tot>=E.tot?[P,E]:[E,P];
    /* 히든 직업 패시브: 발톱 질주(빛), 조율자 봉인(적 공격 카드 1장) */
    const jp=P.jobPassive;C.jobNote=null;
    if(jp&&jp.id==='rush'&&C.round%jp.every===0){P.light+=jp.light;C.jobNote=`${P.name} · ${jp.n} · 이번 라운드 빛 +${jp.light}`}
    /* 적은 라운드 시작 때 낼 카드를 정한다 (화면에 의도로 공개) */
    /* 라운드마다 HP 회복 (전리품·장비 효과) */
    if(P.regen>0&&P.hp>0&&P.hp<P.maxHp){const h=Math.min(P.regen,P.maxHp-P.hp);P.hp+=h;HG(P,h);C.jobNote=(C.jobNote?C.jobNote+' · ':'')+`${P.name} · 회복 · HP +${h}`}
    /* 기업 루트 혈청: 라운드가 시작될 때마다 HP 회복 */
    if(P.singHeal&&P.hp>0&&P.hp<P.maxHp){const h=Math.min(P.singHeal,P.maxHp-P.hp);P.hp+=h;HG(P,h);C.jobNote=(C.jobNote?C.jobNote+' · ':'')+`${P.name} · 혈청 · HP +${h}`}
    C.ePlan=aiPlan(C);
    if(E.stunRound===C.round){E.stunned=true;for(const c of C.ePlan)if(c.next){E.forceNext=c.next;break}C.ePlan=[];C.jobNote=(C.jobNote?C.jobNote+' · ':'')+`${E.name} · 흐트러짐 · 이번 라운드 기절 (행동 불가 · 회피 0)`}else{E.stunned=false}
    /* 적 특성: 무리(공격 카드 한 장 더), 재생(HP 3 회복) */
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
  function autoPlay(hand,light){
    const plays=[];let l=light;
    for(const id of sample(hand,hand.length)){const c=D.cards[id];if(c.c<=l){plays.push(c);l-=c.c}}
    return plays;
  }
  /* 자동 전투용 카드 선택: 빛 안에서 점수 합이 가장 큰 조합(손패 4장이라 모든 조합을 본다).
     점수 = 기대 피해(타수 × (주사위 × 3.5 + 고정값)) + 키워드 스택 × 2. 방어 카드는 HP가 35% 미만일 때만 높게 친다.
     반환: 손패 번호 배열 (방어 → 점수 높은 순) */
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
  function autoPick(C){autoTri(C);
    const P=C.P,low=P.hp/P.maxHp<0.35;
    const bad=P.bleed+P.rupture+(P.burn||0)+(P.flame||0),score=c=>c.t==='def'?(low?8:c.selfHit?4:0.5):c.t==='buff'?(c.kw||[]).reduce((a,k)=>a+k[1]*1.5,0)+(c.heal&&P.hp/P.maxHp<0.75?c.heal*0.8:0)+(c.cleanseRand&&bad>0?c.cleanseRand*1.2:0)
      :c.hits*(c.dice*((c.die||6)+1)/2+c.b+(P.yeji&&BONA.has(c)?CFG.odin.yeji:0)+(P.bonB&&BONA.has(c)?P.bonB:0))+(c.kw||[]).reduce((a,k)=>a+k[1]*2,0)+c.hit*0.05+(c.spend?Math.min(P.charge||0,c.spend)*(c.fixPer||0)*c.hits:0)+(P.oracle&&P.starId&&c===D.cards[P.starId]?30:0)+(c.nailBurst&&C.E.nail>=Math.min(5,nailThr(C)-(C.E.stagger||0))?(C.E.nail||0)*2*c.nailBurst.mul+(c.nailBurst.add||0):0);
    let best=[],bs=-1;
    for(let m=1;m<1<<P.hand.length;m++){
      const idx=P.hand.map((_,i)=>i).filter(i=>m>>i&1);
      if(idx.includes(P.locked))continue;
      if(idx.some(i=>D.cards[P.hand[i]].needBlack&&!P.black))continue;
      if(idx.reduce((a,i)=>a+D.cards[P.hand[i]].c,0)>P.light)continue;
      const sc=idx.reduce((a,i)=>a+score(D.cards[P.hand[i]]),0);
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
    const plan=autoPlay(hand,E.light);
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
    if(n<=0||B.stunned)return;
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
      if(k==='burn'&&!A.isP&&to!=='s')n=Math.max(1,Math.floor(n*CFG.burn.foe));
      X[k]=Math.min(k==='breath'?CFG.breath.cap:k==='charge'?X.chargeCap:k==='burn'?CFG.burn.max:k==='rupture'?CFG.rupture.max:k==='nail'?CFG.nail.cap:CFG.stackCap,X[k]+n);
      L('kw',`  ${X.name}에게 ${D.keywords[k].n} +${n} (지금 ${X[k]})`);
      if(k==='bleed'&&to!=='s'&&A.kuro)addCloud(A,L);
    }
  }
  /* 발톱 전용 키워드 · 혈청: 혈청 카드를 낼 때마다 1 (최대 3). 3이면 다음 적중 피해 ×1.5 후 비움 */
  function addSerum(A,c,L){A.serum=Math.min(3,(A.serum||0)+c.serum);L('kw',`  ${A.name} · 혈청 ${A.serum}/3${A.serum>=3?' · 과부하 준비':''}`)}
  function act(C,A,c,L,push){
    const B=A===C.P?C.E:C.P;
    if(c.flesh){A.evaB-=30;A.fleshRound=C.round;L('kw',`${A.name} · ${c.n} · 이번 라운드 회피 −30`)}
    if(c.cloudGain&&A.kuro)for(let i=0;i<c.cloudGain;i++)addCloud(A,L);
    if(c.needBlack&&!A.black){L('sys',`${A.name} · ${c.n} · 흑운이 아니면 쓸 수 없다 · 불발`);return}
    if(c.t==='buff'&&(c.heal||c.passNext||c.debuffHit||c.cleanseRand)){
      if(c.cleanseRand){const ks=['bleed','rupture','burn','flame'].filter(k=>(A[k]||0)>0);if(ks.length){const k=ks[d(ks.length)-1],n0=A[k];A[k]=Math.max(0,n0-c.cleanseRand);L('kw',`  ${A.name} · ${c.n} · ${D.keywords[k].n} ${n0} → ${A[k]}`)}}
      if(c.heal){const h=Math.min(c.heal,A.maxHp-A.hp);A.hp+=h;HG(A,h);L('kw',`${A.name} · ${c.n} · HP +${h}`)}
      if(c.passNext){A.passHitNext=(A.passHitNext||0)+c.passNext;L('kw',`  ${A.name} · 다음 라운드 명중 ${sg(c.passNext)}`)}
      if(c.debuffHit){B.passHitNext=(B.passHitNext||0)+c.debuffHit;L('kw',`  ${B.name} · 다음 라운드 명중 ${sg(c.debuffHit)} (1라운드)`)}
    }
    if(c.t==='buff'){if(c.serum)addSerum(A,c,L);if(c.shield)A.shield=Math.min(CFG.shieldCap,(A.shield||0)+c.shield+(A.prescPlus||0)+(A.isP&&A.cg?5*CFG.cardGrade.indexOf(A.cg):0));L('sys',`${A.name} · ${c.n} (버프)${c.gain?` · 빛 +${c.gain}`:''}${c.shield?` · 보호막 ${A.shield}`:''}`);applyKw(A,B,c,L);push({k:'buff',side:A.uid,card:c});return}
    const hits=c.hits+(c.t==='atk'&&A.wx&&A.wx.extraHit?A.wx.extraHit:0);
    /* 가속: 라운드마다 처음 공격할 때 1스택 (전투당 최대 3) */
    /* 엄지 패시브 탄환: 공격 카드마다 1발 소모 · 상대에게 '예의를 지킬 것' 1 (상대 명중 −1×스택) */
    if(c.t==='atk'&&A.thumb&&A.ammo>0&&!A.distorted){A.ammo--;B.manner=(B.manner||0)+1;L('kw',`${A.name} · 탄환 1발 (남은 ${A.ammo}) · ${B.name}에게 예의를 지킬 것 ${B.manner} (명중 −${B.manner})`)}
    if(c.t==='atk'&&c.serum)addSerum(A,c,L);
    if(c.t==='atk'&&A.wx&&A.wx.accel&&A.accRound!==C.round&&(A.accel||0)<A.wx.accel.max){A.accRound=C.round;A.accel=(A.accel||0)+1;L('kw',`${A.name} · 가속 ${A.accel}/${A.wx.accel.max} (명중·회피 +${A.accel*A.wx.accel.hit})`)}
    for(let h=0;h<hits;h++){
      if(A.hp<=0||B.hp<=0)return;
      /* 출혈: 공격할 때마다(명중 여부 무관) 스택만큼 피해, 그 뒤 1 감소 */
      if(A.bleed>0){
        const bd=A.bleed;hpLoss(C,A,bd,L);A.bleed--;
        L('dmg',`${A.name} ${D.keywords.bleed.n} ${bd} 피해 (공격하며 상처가 벌어진다)`);
        push({k:'bleed',side:A.uid,dmg:bd});
        /* 혈귀 패시브 혈찬: 상대의 출혈이 5번 발동할 때마다 HP 15 회복 */
        if(B.hyeolchan){B.hc=(B.hc||0)+1;if(B.hc>=5){B.hc-=5;if(B.hp>0){const h=Math.min(15,B.maxHp-B.hp);B.hp+=h;HG(B,h);L('kw',`  ${B.name} · 혈찬 · HP +${h}`)}}}
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
      let am=A.atk+(!A.isP&&C.ally?CFG.bond.allyHit:0)+(A.awl&&B.bleed>0?CFG.syn['밤의 송곳'].bleedHit:0)+c.hit+exH-(A.manner||0)+(gr?gr.hit:0)+fsb+Math.min(CFG.spdHit.max,Math.max(0,Math.floor((A.spd-B.spd)/CFG.spdHit.per)))+A.passHit+acA+(A.wx&&A.wx.hitB||0)+(A.ring?CFG.ring.hit*A.work:0)+(sub?sub.atk:0)-3*(A.prescript||0)-Math.floor((B.middle?CFG.middle.sinkHit:1)*CFG.sink.hit*Math.floor((A.sink||0)/CFG.sink.per))-((staggerStage(A)||{}).hit||0)-(A.isP&&A.laev==='open'&&isBlue(A)?Math.round(CFG.laev.selfBlueHit*(A.laevF||1)):0),dm=B.eva+B.evaB-(B.evaPen||0)+(B.breath>=1&&B.breath<=CFG.breath.evaMax?CFG.breath.eva:0)+acB+trE-3*(B.shock||0)-2*((B.chain||0)+(B.web||0))+(B.maskOn?B.passive.eva:0)+(B.odin?odinEva(C.round,B):0);
      if(B.stunned)dm=0;
      /* 중지: 서열이 오를수록 회피의 '피하는 힘'이 줄어든다(evaEff). 줄어든 만큼은 받는 피해 감소로 돌려준다 */
      if(B.middle&&B.isP&&B.midEff<1&&!B.stunned)dm-=Math.floor(Math.max(0,B.eva+B.evaB-(B.evaPen||0)+(B.odin?Math.max(0,odinEva(C.round,B)):0))*(1-B.midEff));
      {const ev_=Math.max(0,B.eva+B.evaB-(B.evaPen||0));if(c.ignoreEva)dm-=ev_;else if(A.awl&&A.lead)dm-=Math.floor(ev_/2)}
      const sa=sub&&sub.sure?Math.max(ra+am,rd+dm+1):ra+am,sd=rd+dm,G_=CFG.guard;
      const base={k:'atk',att:A.uid,def:B.uid,card:c,ra,ra2,rd,rdMax,am,dm,sa,sd,b:c.b,guard:B.guarding};
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
      const wd=!c.die&&A.wx?(sub?sub.dice:A.wx.dice):null;
      if(sub&&sub.range&&!c.die)rolls.push(sub.range[0]-1+d(sub.range[1]-sub.range[0]+1));
      /* 무기 주사위: 면 수는 무기, 개수는 카드와 무기 중 많은 쪽 (+ 카드 등급) */
      else if(wd){const n=Math.max(wd[0],c.dice)+(gr?gr.dice:0);for(let i=0;i<n;i++)rolls.push(Math.max(Math.min(lo,wd[1]),d(wd[1])))}
      else{let ex=c.exec&&(B.disp||0)>0?c.exec:0;if(ex)pnote+=` 처분 표식 주사위+${ex}`;
        if(c.serumBurst&&(A.serum||0)>0){ex+=A.serum;pnote+=` 혈청 ${A.serum} 소모 · 주사위+${A.serum}`;A.serum=0}for(let i=0;i<c.dice+ex+(c.fsDice&&fsb?c.fsDice:0)+(gr&&!c.die?gr.dice:0);i++)rolls.push(c.range?c.range[0]-1+d(c.range[1]-c.range[0]+1):Math.max(lo2,d(die)))}
      let note=fsb?' 선제':'';
      if(c.rr&&rolls.length){
        let mi=0;rolls.forEach((v,i)=>{if(v<rolls[mi])mi=i});
        const nv=Math.max(lo2,d(die));if(nv>rolls[mi]){note+=` 재굴림 ${rolls[mi]}→${nv}`;rolls[mi]=nv}
      }
      let dmg=rolls.reduce((a,b)=>a+b,0)+c.b+(gr?gr.b:0)+(A.prescPlus||0)+(A.yeji&&BONA.has(c)?CFG.odin.yeji:0)+(A.bonB&&BONA.has(c)?A.bonB:0);
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
      if(A.passive){
        if(A.passive.id==='godfather'&&A.gfBonus){const x=d(2);dmg+=x;A.gfBonus=false;note+=` ${A.passive.n}+${x}`}
        if(A.passive.id==='claw'){const x=d(A.passive.dice||4);dmg+=x;note+=` ${A.passive.n}+${x}`}
      }
      if(A.breath>0||c.forceCrit){
        if(c.forceCrit||d(100)<=critPct(A.breath)){const cm=(A.blade?(A.bladeBoost?CFG.syn['검계'].boostCrit:CFG.syn['검계'].crit):CFG.critMult)+(A.hwando?0.1*Math.min(A.breath,CFG.breath.hwandoCap):0);dmg=Math.floor(dmg*cm);note+=A.hwando?` 치명(환도 ×${cm.toFixed(1)})`:' 치명'}
      }
      if(B.rupture>0){dmg+=B.rupture;note+=` ${D.keywords.rupture.n}+${B.rupture}`;B.rupture--}
      if(A.ring&&A.work>0){dmg+=CFG.ring.dmg*A.work;note+=` 작품 ${A.work}+${CFG.ring.dmg*A.work}`;if(A.work>=CFG.ring.max){dmg=Math.floor(dmg*CFG.ring.finish);A.work=CFG.ring.after;note+=` 완성×${CFG.ring.finish}`}}
      if(A.dmgB){dmg+=A.dmgB;note+=` 무기+${A.dmgB}`}
      if(A.triDmg){dmg+=A.triDmg;note+=` 건+${A.triDmg}`}
      if(A.hungerUse>0){dmg+=A.hungerUse;note+=` 굶주림+${A.hungerUse}`;A.hungerUse=0}
      if(c.bleedDmg&&B.bleed>0){const x=B.bleed*c.bleedDmg;dmg+=x;note+=` 출혈 ${B.bleed}×${c.bleedDmg}+${x}`}
      if(c.sinkDmg&&(B.sink||0)>=CFG.sink.per){const n_=Math.floor(B.sink/CFG.sink.per),x=n_*c.sinkDmg;dmg+=x;note+=` 침잠 ${n_}단계+${x}`}
      if(C.duel){dmg+=C.duel;note+=` 결투+${C.duel}`}
      if(A.augHunt&&B.aug){dmg+=A.augHunt;note+=` 의체 심판+${A.augHunt}`}
      /* 조율자 전용 키워드 · 봉인 각인: 해제가 각인 1당 피해 +4로 터뜨린다 */
      if(c.unseal&&(B.sealMark||0)>0){const x=B.sealMark*c.unseal;dmg+=x;note+=` 봉인 해제 ${B.sealMark}×${c.unseal}+${x}`;B.sealMark=0}
      if((A.serum||0)>=3&&!c.serumBurst){dmg=Math.floor(dmg*1.5);A.serum=0;note+=' 혈청 과부하×1.5'}
      /* 화상: 받는 피해 ×1.5, 5스택 이상이면 푸른 화염 ×2 */
      if(isBlue(B)){const bm=B.blueM||CFG.laev.blueMul;dmg=Math.floor(dmg*bm);note+=` 푸른 화염×${bm}`}else if(B.flame>0){dmg=Math.floor(dmg*1.5);note+=' 붉은 화염×1.5'}
      if(A.mark){const x=d(3)+d(3);dmg+=x;note+=` 표지+${x}`}
      if(B.guarding&&!ig){dmg=Math.floor(dmg*G_.guardFailMul);note+=` 방어 감소×${G_.guardFailMul}`}else if(B.guarding&&ig)note+=' 방어 무시'
      /* 무기 디버프: 왜곡(내가 주는 피해 감소), 표적(3스택이면 2배), 원한(쌓인 만큼 추가) */
      if(A.matBonus){dmg+=A.matBonus;note+=` 신체관극+${A.matBonus}`}
      if(c.reuse&&A.mat>0){let x=0;for(let i=0;i<A.mat;i++)x+=d(c.die||6);dmg+=x;note+=` 폐장 재사용 ${A.mat}회+${x}`;A.mat=0}
      if(A.warp){dmg=Math.max(1,dmg-A.warp);note+=` 왜곡−${A.warp}`}
      {const g2=staggerStage(B);if(g2&&g2.take){dmg+=g2.take;note+=` 흐트러짐 취약+${g2.take}`}}
      {const g_=staggerStage(A);if(g_&&g_.dmg){dmg=Math.max(1,dmg-g_.dmg);note+=` 흐트러짐−${g_.dmg}`}}
      if((A.sink||0)>=CFG.sink.per){const x=Math.floor(A.sink/CFG.sink.per)*CFG.sink.dmg;dmg=Math.max(1,dmg-x);note+=` 침잠−${x}`}
      if(A.wx&&A.wx.mark){B.mk=(B.mk||0)+1;if(B.mk>=A.wx.mark.need){dmg*=2;B.mk=0;note+=' 표적×2'}}
      /* 중지 패시브 되갚음: 맞을 때마다 1 (최대 5), 다음 적중 피해 +2×스택 */
      if(A.middle&&(A.revenge||0)>0){const x=A.revenge*(A.revMul||CFG.middle.dmg);dmg+=x;note+=` 되갚음+${x}`;const hl=A.isP?Math.min(A.revenge*CFG.middle.heal,A.maxHp-A.hp):0;if(hl>0){A.hp+=hl;HG(A,hl);note+=` 스택 ${A.revenge} 소모 · HP +${hl}`}A.revenge=Math.floor(A.revenge*CFG.middle.keep)}
      if(A.isP&&A.angry>0&&dmg>0){dmg+=A.angry;note+=` 분노+${A.angry}`;A.angry=0}
      if(A.wx&&A.wx.grudge&&A.grudge>0){const x=A.grudge*A.wx.grudge;dmg+=x;note+=` ${A.wx.grudgeN||'원한'}+${x}`;A.grudge=0}
      if(A.wx&&A.wx.crush&&A.crRound!==C.round){A.crRound=C.round;dmg+=A.wx.crush;note+=` ${A.wx.crushN||'짓누름'}+${A.wx.crush}`}
      if(B.middle&&B.isP&&(B.revenge||0)>0&&CFG.middle.def){const r_=Math.min(dmg-1,B.revenge*CFG.middle.def);if(r_>0){dmg-=r_;note+=` 되갚음 방어−${r_}`}}
      if(B.wx&&B.wx.ward){dmg=Math.max(1,dmg-B.wx.ward);note+=` 책장−${B.wx.ward}`}
      if(A.psycho||B.psycho){const m=(A.psycho?CFG.innate.psycho:1)*(B.psycho?CFG.innate.psycho:1);dmg*=m;note+=` 사이코패스×${m}`}
      if(A.trait==='enrage'&&A.hp<=A.maxHp/2){dmg+=2;note+=' 분노+2'}
      if(B.trait==='callus'){const r=Math.min(2,dmg-1);if(r>0){dmg-=r;note+=` 굳은살−${r}`}}
      if(B.presc>0){const r=Math.floor(dmg*B.presc*0.05);if(r>0){dmg-=r;note+=` 지령 수행−${r}`}}
      if(B.drRound===C.round){const r=dmg-Math.floor(dmg*0.4);dmg-=r;note+=` 공명−${r}`}
      /* 피해 감소(%): 영구 효과 + 황혼 키워드 (체력 from 이하부터 base%, low 이하에서 max%까지 선형으로 오른다) */
      {let mdr=B.midDr||0;if(B.middle&&B.isP&&B.midEff<1)mdr=Math.min(CFG.middle.drCap,mdr+Math.floor(Math.max(0,B.eva+B.evaB+(B.odin?Math.max(0,odinEva(C.round,B)):0))*(1-B.midEff)*CFG.middle.evaDr));let red=(B.dr||0)+(B.triCut||0)+mdr,tw='';const T_=B.wx&&B.wx.twilight;
        if(T_){const r_=B.hp/B.maxHp;if(r_<=T_.from){const x=Math.min(T_.max,T_.base+(T_.from-Math.max(r_,T_.low))/(T_.from-T_.low)*(T_.max-T_.base));red+=x;tw=` 황혼`}}
        if(red>0){const x=Math.floor(dmg*red/100);if(x>0){dmg-=x;note+=`${tw} ${mdr?(B.midDr>=CFG.middle.dr[3]?'초근성 ':'근성 '):''}피해감소${Math.round(red)}%−${x}`}}}
      if(c.spdDice&&A.spd>=c.spdDice[0]){const x=rolls.length*c.spdDice[1];dmg+=x;note+=` 속도 ${A.spd} · 주사위 ${rolls.length}개 +${c.spdDice[1]}=+${x}`}
      if(A.spent>0&&c.fixPer){const fp=c.fixPer+(A.focusOn?A.focus.fix:0),x=A.spent*fp;dmg+=x;note+=` 충전 ${A.spent}×${fp}=고정 +${x}`}
      if(B.kuro&&B.black&&B.synT>=3){dmg=Math.max(1,Math.floor(dmg*CFG.syn['흑운회'].half));note+=' 흑운 ×'+CFG.syn['흑운회'].half}
      if(B.isP&&C.escort&&C.escort.kind==='guard'&&B.escortRound!==C.round&&dmg>1){B.escortRound=C.round;const Z=CFG.escort.guard,es=C.escort,pc=Math.min(Z.cutMax,Z.cut+Z.cutPer*es.lv),x=Math.floor(dmg*pc/100);if(x>0){dmg-=x;note+=` ${es.name} 막아섬−${x}`}const cd=Z.counter+Z.counterPer*es.lv;A.hp=Math.max(0,A.hp-cd);L('dmg',`  ${es.name} · 수비 · ${A.name}에게 반격 ${cd}`)}
      if(B.shield>0&&!ig){const ab=Math.min(B.shield,dmg);B.shield-=ab;dmg-=ab;note+=` 보호막−${ab}`}else if(B.shield>0&&ig)note+=' 보호막 무시'
      if(B.passive&&B.passive.id==='lockledger'&&A.isP&&B.hp-dmg<=0&&!note.includes('되갚음+')){dmg=Math.max(0,B.hp-1);note+=' 장부가 지워지지 않는다';}
      hpLoss(C,B,dmg,L);
      L('hit',`${A.name} → ${B.name} · ${c.n} · 명중 ${sa} vs ${B.guarding?'방어':'회피'} ${sd} · 피해 [${rolls.join(',')}]${c.b?sg(c.b):''}${note} = ${dmg}`);
      if(c.hitShield){A.shield=Math.min(CFG.shieldCap,(A.shield||0)+c.hitShield);L('kw',`  ${A.name} · 보호막 +${c.hitShield} (지금 ${A.shield})`)}
      applyKw(A,B,c,L);
      if(A.kuro&&A.black&&B.hp>0){B.bleed=Math.min(CFG.stackCap,B.bleed+CFG.syn['흑운회'].bleedPlus);L('kw',`  ${A.name} · 흑운 · ${B.name}에게 출혈 +${CFG.syn['흑운회'].bleedPlus} (지금 ${B.bleed})`)}
      if(A.awl&&A.synT>=3&&A.lead&&!A.awlUsed&&B.hp>0){A.awlUsed=true;B.bleed=Math.min(CFG.stackCap,B.bleed+1);L('kw',`  ${A.name} · 선공 첫 적중 · ${B.name}에게 출혈 +1 (지금 ${B.bleed})`);if(A.kuro)addCloud(A,L)}
      if(A.ring&&A.work<CFG.ring.max){A.work++;L('kw',`  ${A.name} · 작품 ${A.work}/${CFG.ring.max}`)}
      if(A.nailHit&&B.hp>0){const n=B.aug?CFG.nail.augHit:A.nailHit;B.nail=Math.min(CFG.nail.cap,(B.nail||0)+n);L('kw',`  ${B.name}에게 못 +${n} (지금 ${B.nail})`)}
      if(c.nailBurst&&B.hp>0&&(B.nail||0)>0){const used=B.nail;B.nail=0;L('kw',`  ${B.name} · 못 ${used}개를 흐트러짐으로`);addStagger(C,B,Math.round(used*c.nailBurst.mul)+(c.nailBurst.add||0),L)}
      if(A.chargeHit){A.charge=Math.min(A.chargeCap,A.charge+A.chargeHit);L('kw',`  ${A.name} · 충전 +${A.chargeHit} (지금 ${A.charge})`)}
      if(B.chargeLoss>0&&B.charge>0&&B.isP){B.charge=Math.max(0,B.charge-B.chargeLoss);L('kw',`  ${B.name} · 피격 · 충전 −${B.chargeLoss} (남은 ${B.charge})`)}
      if(c.hitHeal&&A.hp>0){const h=Math.min(c.hitHeal,A.maxHp-A.hp);if(h>0){A.hp+=h;HG(A,h);L('kw',`  ${A.name} · ${c.n} · HP +${h}`)}}
      /* 보냐텔리 검술: 처분 표식, 엘레판테(표식이 있으면 다음 라운드 처분 1회) */
      if(c.grant&&(B.disp||0)>0&&B.hp>0&&!A.grantNext){A.grantNext=c.grant;L('sys',`  ${A.name} · 처분 표식 · 다음 손패에 ${D.cards[c.grant].n}`)}
      if(c.seal&&B.hp>0){B.sealMark=Math.min(5,(B.sealMark||0)+c.seal);L('kw',`  ${B.name}에게 봉인 각인 ${B.sealMark}/5`)}
      if(c.dmark&&B.hp>0){B.disp=Math.min(5,(B.disp||0)+c.dmark);L('kw',`  ${B.name}에게 처분 표식 ${B.disp}`)}
      /* 마에스트로 책장: 재료 수집 부여 / 신체관극(상대 디버프 수만큼 재료) */
      if(c.mat&&B.hp>0){B.matc=(B.matc||0)+c.mat;L('kw',`  ${B.name}에게 재료 수집 ${B.matc}`)}
      if(c.harvest&&B.matc>0){const n=['bleed','rupture','burn','flame','prescript','warp','shock','chain','web','mk','matc'].reduce((a,k)=>a+(B[k]>0?B[k]:0),0);
        A.mat=(A.mat||0)+n;A.matNext=(A.matNext||0)+n;L('kw',`  ${A.name} · 신체관극 · 재료 +${n} (지금 ${A.mat}) · 다음 라운드 적중마다 피해 +${A.matNext}`)}
      /* 전용 무기 효과: 적중 시 키워드·잔향·호흡·조율, 피격 시 반격 */
      if(A.wx&&B.hp>0){const X=A.wx;
        if(X.debuff){const {k,n}=X.debuff,nm={prescript:'지령',warp:'왜곡',shock:'감전',chain:'사슬',web:'거미줄'}[k];B[k]=Math.min(5,(B[k]||0)+n);L('kw',`  ${B.name}에게 ${nm} ${B[k]}`)}
        if(X.mindHit&&A.isP){const g=gainMind(C.ch,X.mindHit);if(g)L('kw',`  ${A.name} · 참회 · 정신력 +${g}`)}
        if(X.hitKw)for(const [k,n] of X.hitKw){B[k]=Math.min(k==='rupture'?CFG.rupture.max:CFG.stackCap,(B[k]||0)+n);L('kw',`  ${B.name}에게 ${D.keywords[k].n} +${n} (무기)`)}
        if(X.echo){B.wecho=(B.wecho||0)+1;L('kw',`  ${B.name}에게 ${X.echo.n||'잔향'} ${B.wecho}/${X.echo.need}`);if(B.wecho>=X.echo.need){hpLoss(C,B,X.echo.dmg,L);B.wecho=0;L('dmg',`  ${X.echo.n||'잔향'}이 울린다 · ${B.name} 고정 피해 ${X.echo.dmg}`)}}
        if(X.breathHit){A.breath=Math.min(CFG.breath.cap,A.breath+X.breathHit)}
        /* ALEPH E.G.O: 미미크리 흡수, 다 카포 악장 */
        if(X.drain&&A.hp>0){const h=Math.min(X.drain,A.maxHp-A.hp);if(h>0){A.hp+=h;HG(A,h);L('kw',`  ${A.name} · 흡수 · HP +${h}`)}}
        if(X.movement&&C.round%X.movement.every===0&&A.mvRound!==C.round&&B.hp>0){A.mvRound=C.round;hpLoss(C,B,X.movement.dmg,L);L('dmg',`  다 카포 · 악장 · ${B.name} 고정 피해 ${X.movement.dmg}`)}
        if(X.execute&&B.hp>0&&B.hp<=B.maxHp*X.execute.below){hpLoss(C,B,X.execute.dmg,L);L('dmg',`  조율 · ${B.name} 고정 피해 ${X.execute.dmg}`)}}
      if(B.wx&&B.wx.grudge&&B.hp>0){B.grudge=Math.min(5,(B.grudge||0)+1)}
      if(B.fleshRound===C.round&&B.isP&&!B.boneNext){B.boneNext=true;L('kw',`  ${B.name} · 육참 · 맞았다 · 다음 손패에 골단`)}
      if(B.kuro&&B.hp>0&&dmg>0)addCloud(B,L);
      if(A.passive&&A.passive.id==='stance')A.sal=Math.min(A.passive.salMax,A.sal+1);
      if(B.passive&&B.passive.id==='stance')B.sal=Math.max(0,B.sal-1);
      if(B.middle&&B.hp>0){B.revenge=Math.min(B.isP?CFG.middle.cap:5,(B.revenge||0)+1+(B.wx&&B.wx.revUp||0)+(B.odinMid&&B.odinMidRound!==C.round?(B.odinMidRound=C.round,CFG.odin.midHit):0))}
      /* 중지 수비 반격: 방어 카드(또는 방어 자세)를 낸 라운드에 맞으면 쌓인 되갚음 스택 × counter의 고정 피해로 바로 반격한다 (스택은 그대로, 라운드에 한 번) */
      if(B.middle&&B.isP&&B.hp>0&&A.hp>0&&(B.defRound===C.round||B.guarding)&&B.counterRound!==C.round&&(B.revenge||0)>0){B.counterRound=C.round;const x=B.revenge*CFG.middle.counter;A.hp=Math.max(0,A.hp-x);L('dmg',`  ${B.name} · 수비 반격 · 되갚음 ${B.revenge} · ${A.name} 고정 피해 ${x}`)}
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
        else{B.burn=Math.min(CFG.burn.max,(B.burn||0)+A.burnHit);L('kw',`  ${B.name}에게 화상 +${A.burnHit} (지금 ${B.burn})`)}}
      /* 주사위마다 무작위 디버프 1 (Furioso): 출혈 또는 파열 */
      if(c.rngDebuff&&B.hp>0){const got={};for(let i=0;i<c.dice;i++){const k=one(c.rngDebuff);B[k]=Math.min(k==='rupture'?CFG.rupture.max:CFG.stackCap,B[k]+1);got[k]=(got[k]||0)+1}
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
  function resolveRound(C,pp,ep){
    const {P,E}=C;
    C.cur=[];C.evs=[];
    /* 궁니르 공명: 궁니르 카드를 낸 라운드는 받는 피해 60% 감소 */
    if(P.resonance&&pp.some(c=>c.gungnir))P.drRound=C.round;
    const L=(t,s)=>{if(C.quiet)return;C.log.push({t,s});C.cur.push({t,s})};
    const push=ev=>{if(C.quiet)return;ev.lines=C.cur;C.cur=[];ev.snap=snap(C);ev.step=C.step;C.evs.push(ev)};
    L('head',`— ${C.round}라운드 · ${C.order[0].name} 선공 —`);
    if(C.round===1&&C.mindNote&&C.mindNote.length)C.mindNote.forEach(t=>L('kw',t));
    if(C.jobNote)L('kw',C.jobNote);
    if(C.triNote){L('kw',C.triNote);C.triNote=null}
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
    if(C.escort){const es=C.escort,Z=CFG.escort,K=D.bond.escort.kinds[es.kind];
      if(C.round===1)L('sys',`${es.name} · 동행 의뢰 · ${K.tag}`);
      if(es.kind==='support'){const sh=Z.support.shield+Z.support.shieldPer*es.lv,hl=Math.max(0,Math.min(Z.support.heal+Z.support.healPer*es.lv,P.maxHp-P.hp));P.shield=Math.min(CFG.shieldCap,(P.shield||0)+sh);if(hl>0){P.hp+=hl;HG(P,hl)}L('kw',`  ${es.name} · 지원 · 보호막 +${sh}${hl>0?` · HP +${hl}`:''}`)}}
    if(P.odin&&P.odinMid)L('kw',`${P.name} · 오딘의 눈 · 되갚음의 예지 · 이번 라운드 첫 피격 되갚음 +${CFG.odin.midHit}`);else if(P.odin){const v=odinEva(C.round,P);L('kw',`${P.name} · 오딘의 눈 · ${P.yeji?'가속하는 미래':'순간의 예지'} · 회피 ${v>0?'+':''}${v}${v<0?' (과부하)':''}`)}
    if(P.laev==='open'&&C.round>1&&C.round%CFG.laev.selfEvery===0){P.flame=Math.min(CFG.stackCap,(P.flame||0)+1);L('kw',`${P.name} · 레바테인 · 자신에게 붉은 화염 1 (지금 ${P.flame})`)}
    /* 아무 카드도 내지 않으면 방어 자세 */
    for(const [X,plays] of [[P,pp],[E,ep]]){
      X.guarding=plays.length===0&&!X.stunned;
      if(X.guarding){
        X.passHitNext=CFG.guard.nextHit;X.lightNext=CFG.guard.lightNext||0;X.lightUp=Math.min(CFG.guard.lightUpMax,X.lightUp+CFG.guard.lightUp);
        L('sys',`${X.name} · 방어 자세 · 이번 라운드 방어 판정 · 다음 라운드 명중 +${CFG.guard.nextHit} · 빛 +${CFG.guard.lightUp} (전투 동안)`);
        /* 플레이어 방어 자세: 출혈을 지혈해 스택을 줄인다 */
        if(X.isP&&X.bleed>0&&CFG.guard.bleedCut){const b0=X.bleed;X.bleed=Math.floor(X.bleed*CFG.guard.bleedCut);L('kw',`  ${X.name} 지혈 · ${D.keywords.bleed.n} ${b0} → ${X.bleed}`)}
        push({k:'def',side:X.uid,card:{n:'방어 자세'}});
      }
    }
    queue(C,pp,ep).forEach((st,i)=>{
      C.step=i;const A=C[st.side],c=st.card;
      if(c.next){if(A.isP)A.grantNext=c.next;else A.forceNext=c.next;L('sys',`${A.name} · ${c.n} · 다음 라운드 ${D.cards[c.next].n} 준비`)}
      if(A.isP&&c.t==='atk'&&(c.shield||c.lightNext)){if(c.shield){A.shield=Math.min(CFG.shieldCap,(A.shield||0)+c.shield);L('kw',`  ${A.name} · ${c.n} · 보호막 +${c.shield} (지금 ${A.shield})`)}if(c.lightNext){A.lightNext=(A.lightNext||0)+c.lightNext;L('kw',`  ${A.name} · ${c.n} · 다음 라운드 빛 +${c.lightNext}`)}}
      if(A.isP&&c.bloomGrant&&D.cards[c.bloomGrant]){A.bloomUses=(A.bloomUses||0)+1;L('sys',`  ${A.name} · 개화 ${A.bloomUses}회${A.bloomUses%CFG.bloom.every?` · ${CFG.bloom.every-A.bloomUses%CFG.bloom.every}회 더 쓰면 1회용 스킬`:''}`);if(A.bloomUses%CFG.bloom.every===0&&!A.grantNext){A.grantNext=c.bloomGrant;L('sys',`  ${A.name} · ${c.n} · 다음 라운드 손패에 ${D.cards[c.bloomGrant].n} (1회용)`)}}
      if(A.isP&&c.egoGrow){C.ch.egoUses=(C.ch.egoUses||0)+1;const up=egoGrow(C.ch);
        /* 특수 강화는 그 자리에서: 장착 중이면 이번 전투 수치도 바로 바꾼다 */
        if(up&&up.worn){for(const k of ['atk','eva'])A[k]+=(up.nw.fx[k]||0)-(up.old.fx[k]||0);A.wx=up.nw.wx}
        if(up)L('kw',`${A.name} · ${c.n} ${C.ch.egoUses}회 · E.G.O ${CFG.egoGrow.tier[up.nw.egoLv]} · ${up.nw.n}`)
        else{const G_=CFG.egoGrow,u_=C.ch.egoUses,L_=egoLvFor(u_),nx_=G_.need[L_+1];if(nx_!=null)L('kw',`${A.name} · ${c.n} ${u_}회 · E.G.O ${G_.tier[L_]} → ${G_.tier[L_+1]}까지 ${nx_-u_}회`)}}
      if(A.isP&&c.mindCost)loseMind(C.ch,c.mindCost,t=>L('kw',`${A.name} · ${c.n} · ${t}`));
      /* 오랜 굶주림: 공격 카드를 낼 때 쌓인 스택을 모두 써서 그 카드의 첫 적중 피해가 늘고, 스택은 비운다 */
      A.hungerUse=0;if(A.hunger>0&&c.t==='atk'){A.hungerUse=A.hunger;L('kw',`${A.name} · 오랜 굶주림 ${A.hunger} 소진 · 이 카드의 첫 적중 피해 +${A.hunger}`);A.hunger=0}
      if(c.hpCost&&A.hp>1){const x=Math.min(c.hpCost,A.hp-1);A.hp-=x;L('kw',`${A.name} · ${c.n} · HP −${x}`)}
      /* 충전: 카드를 낼 때 spend만큼(있는 만큼) 소모하고, 소모한 충전 1당 fixPer의 고정 피해를 적중마다 더한다 */
      if(c.once&&A.isP){const id_=Object.keys(D.cards).find(k=>D.cards[k]===c);if(id_)(C.onceUsed=C.onceUsed||[]).push(id_)}
      A.focusOn=!!(A.focus&&A.charge>=A.focus.at);A.spent=0;if(c.spend&&A.charge>0){A.spent=Math.min(A.charge,c.spend);A.charge-=A.spent;L('kw',`${A.name} · ${c.n} · 충전 ${A.spent} 소모 (남은 ${A.charge})`)}
      if(A.isP&&c.mindGain){const g=gainMind(C.ch,c.mindGain);if(g)L('kw',`${A.name} · ${c.n} · 정신력 +${g} (${C.ch.mind})`)}
      if(c.t==='def'){A.defRound=C.round;cutStacks(A);if(c.kw)applyKw(A,A===C.P?C.E:C.P,c,L);if(c.charge)A.charge=Math.min(A.chargeCap,A.charge+c.charge);if(c.shield){const sh_=c.shield+(A.prescPlus||0);A.shield=Math.min(CFG.shieldCap,(A.shield||0)+sh_);L('kw',`${A.name} · ${c.n} · 보호막 +${sh_} (지금 ${A.shield})`)}if(c.selfHit)A.passHit+=c.selfHit;const ev=(c.eva||CFG.defBonus)+A.defUp+(A.prescPlus||0);A.evaB+=ev;if(c.lightNext)A.lightNext=(A.lightNext||0)+c.lightNext;L('sys',`${A.name} · ${c.n} · 이번 라운드 회피 +${ev}${c.lightNext?` · 다음 라운드 빛 +${c.lightNext}`:''}`);push({k:'def',side:A.uid,card:c});return}
      if(P.hp<=0||E.hp<=0)return;
      act(C,A,c,L,push);
      ampUse(C,L);
    });
    C.step=-1;
    /* 인연의 추가 공격 */
    if(C.escort&&C.escort.kind==='fighter'&&E.hp>0&&P.hp>0){const es=C.escort,Z=CFG.escort.fighter,x=Z.base+Z.per*es.lv+d(Z.rand)-1;E.hp=Math.max(0,E.hp-x);L('dmg',`${es.name} · 협공 · ${E.name}에게 고정 피해 ${x}`);push({k:'bleed',side:'E',dmg:x})}
    {const A_=C.round===1?C.allyFirst:null;if(A_&&E.hp>0&&P.hp>0){const x=Math.max(1,CFG.bond.ally.base+CFG.bond.ally.per*A_.lv+d(7)-4);E.hp=Math.max(0,E.hp-x);L('dmg',`${A_.name} · 인연의 추가 공격 · ${E.name}에게 ${x} 피해`);push({k:'bleed',side:'E',dmg:x})}}
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
      if(X.burn>0&&X.hp>0){const x=X.burn*(X.isP?CFG.burn.dmgMe:CFG.burn.dmg);hpLoss(C,X,x,L);X.burn=Math.floor(X.burn*CFG.burn.keep);L('dmg',`${X.name} · 화상 ${x} 피해 (남은 ${X.burn})`)}
      if(X.kuro&&X.black){X.black=false;X.cloud=CFG.syn['흑운회'].reset;L('kw',`${X.name} · 흑운이 가라앉았다 · 구름 ${X.cloud}`)}
      for(const k of ['prescript','warp','shock','chain','web','sink'])if(X[k]>0)X[k]--}
    /* 무한 모드 침식: 오래 살수록 라운드마다 고정 피해 (회피·보호막으로 막을 수 없다) */
    if(C.ch.infinite&&P.hp>0&&E.hp>0){const IN=CFG.infinite,e_=(C.ch.year||0)-IN.erodeFrom,x=Math.floor(e_*IN.erodePer);
      if(e_>0&&x>0){hpLoss(C,P,x,L);L('dmg',`${P.name} · 세계의 균열이 몸을 갉는다 · 고정 피해 ${x}`)}}
    ampUse(C,L);
    if(P.hp<=0||C.ch.mindDead)C.over='lose';else if(E.hp<=0)C.over='win';else if(E.passive&&E.passive.id==='trial'&&C.round>=E.passive.rounds)C.over='win';
  }
  /* K사 엠플: 살아 있고 HP가 최대 HP의 belowPct 이하이면 자동으로 쓴다 (한 번에 1개, 전투당 제한 없음) */
  /* HP를 잃는다. 플레이어가 한 번에 쓰러질 피해(공격·출혈·화상·고정 피해 모두)를 받으면, 쓰러지기 전에 K사 엠플이 먼저 쓰이고 받은 피해만큼 회복이 깎인다 (HP − 피해 + 회복) */
  function hpLoss(C,X,x,L){
    if(X.isP&&X.ample>0&&x>=X.hp&&!X.distorted){
      const K=CFG.ample;let h=X.hp-x,u=0;
      while(X.ample>0&&h<=0){X.ample--;u++;h+=K.heal}
      h=Math.min(h,X.maxHp);X.hp=Math.max(0,h);
      L('amp',`${X.name} · ${K.name} ${u}개 사용 (치명적인 피해 ${x} · 회복 ${K.heal*u}에서 깎여 HP ${X.hp}, 남은 ${X.ample}개)`);
      return;
    }
    X.hp=Math.max(0,X.hp-x);
  }
  function ampUse(C,L){
    const P=C.P,K=CFG.ample;if(!(P.ample>0)||P.hp<=0||P.hp>Math.floor(P.maxHp*K.belowPct)||C.E.hp<=0)return;
    const h=Math.min(K.heal,P.maxHp-P.hp);P.hp+=h;P.ample--;L('amp',`${P.name} · ${K.name} 사용 · HP +${h} · 지금 ${P.hp}/${P.maxHp} (남은 ${P.ample}개)`);
  }
  /* 자동 전투 (시뮬): 카드 고르는 순서도 행동 순서를 따른다 */
  function fightAuto(ch,id){
    const C=mkCombat(ch,id,true);let g=0;
    while(!C.over&&g++<80){
      let pp,ep;
      autoTri(C);
      pp=autoPlay(C.P.hand.filter((id,i)=>i!==C.P.locked&&!(D.cards[id].needBlack&&!C.P.black)),C.P.light);ep=C.ePlan;
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
    isFinger,canFingerUp,bonCardB,giveRelic,relicChance,acceptPack,declinePack,bonItem,bonNeed,bonUpgrade,egoItem,egoLvFor,isN,deckMax,setSing,setWing,setPill,pillStats,renameForm,singNameErr,wingNameErr,corpType,singChips,mindMax,offerGear,canFound,officeNameErr,setOffice,officeBroker,officeCards,OKW,resolveGear,takeOffer,dropOffer,deckOut,deckIn,sideDrop,autoOffers,cardBox,boxPool,deckRoom,relicChoices,applyGrowth,earn,priceOf,sellStash,sellValue,isWs,equip,equipStash,shopAccess,canBuy,buy,canBuySpecial,buySpecial,income,money,encounter,answerOmen,meets,newGame,age,advanceYear,options,checkMod,pathMod,choose,winRewards,
    isFounder,chooseFinger,chooseOrg,lockedOptions,nailThr,setSeongdo,familyHunter,spouseLevel,bondFill,bondData,setTri,triOk,bondNameErr,setBondName,bondMarried,nameErr,swapCard,tuneGear,tuneCost,aidCount,buyAid,critPct,lastYear,buyHeal,clinicPrice,buyAmple,ampPrice,gradeAt,gradeRaw,checkDie,setDistort,cardGrade,loseMind,gainMind,mindTier,mindStat,synOf,synTier,kidNameErr,setKidName,egoNameErr,setEgo,delCard,promoNeed,examReady,checkDc,canPromote,ptsName,career,fixedSpec,mkCombat,newRound,queue,autoPick,resolveRound,aiPlan,autoPlay,snap,fightAuto,chainSim,simulate};
}
