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
  for(const o of D.origins)if(D.money.start[o.n]==null)err.push(`출신 ${o.n}: 시작 자산(money.start) 없음`);
  for(const [id,e] of Object.entries(D.enemies))if(!e.tier||D.money.bounty[e.tier]==null)err.push(`적 ${id}: tier 없음 또는 현상금 없음`);
  D.origins.forEach(o=>{card(o.card,`출신 ${o.n}`);for(const k in o.paths||{})if(!D.text.paths[k])err.push(`출신 ${o.n}: 없는 진로 "${k}"`)});
  for(const ev of D.events)if(ev.tag&&!D.text.paths[ev.tag])err.push(`사건 "${ev.t}": 없는 진로 태그 "${ev.tag}"`);
  const evs=[...D.events,D.affiliation,D.promotionExam,D.colorExam].filter(Boolean);
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
  function newChar(job){
    const r={o:d(100),t:d(100),f:d(100),w:d(100),n:d(100)},J=job&&D.hiddenJobs[job];
    if(J)r.o=J.roll;
    const o=J?{n:J.n,t:J.t,e:J.e,fx:J.fx,card:J.cards[0],paths:{},flags:{}}:pick(D.origins,r.o),t=pick(D.talents,r.t),f=pick(D.flaws,r.f),w=pick(D.weapons,r.w),ci=Math.floor((r.n-1)/10);
    const s={maxHp:CFG.baseHp,atk:0,eva:0,spd:0,check:0,startBleed:0,startBreath:0,enemyHp:0,dmin:1,defUp:0,adv:0,extraD2:0,dmgB:0,burnHit:0,pdie:6};
    for(const x of [o,t,f])addStats(s,x.fx);
    const kid=childhood(s);
    const ch={r,o,t,f,w,kid,ci,color:D.colors[ci].hex,licensed:false,title:null,aff:null,paths:Object.assign({},o.paths),
      flags:Object.assign({},o.flags),beaten:[],unlocks:[],mind:CFG.mind.max,stats:s,hp:s.maxHp,gear:{},money:D.money.start[o.n]||0,
      deck:['slash','thrust','smash','guard',o.card],xp:0,lv:1,lvPend:0,lvOpts:null};
    if(o.race)ch.race=o.race;if(o.relicPick)ch.relicPick=true;
    /* 타고난 것 (히든): 출생 굴림 값의 해시로 정한다 */
    const IN=CFG.innate,h=(r.o*7919+r.t*104729+r.f*1299709+r.w*15485863+r.n*32452843+ch.kid.reduce((a,k)=>a*31+k.r,7))%1000003;
    if(h%IN.chanceDiv===0){const ks=Object.keys(D.innate||{});if(ks.length)ch.innate=ks[Math.floor(h/IN.chanceDiv)%ks.length]}
    if(J){ch.job=job;ch.aff={type:'head',name:'머리'};for(const c of J.cards.slice(1))ch.deck.push(c);ch.money=J.money||0;ch.relics=[J.n]}
    /* 출생 때 굴린 무기는 무기 칸의 첫 장비 */
    equip(ch,{id:'birth',slot:'weapon',n:w.n,e:w.e,fx:w.fx});
    /* 히든 직업 전용 무기: 출생 무기는 보관함으로 */
    if(J&&J.weapon)equip(ch,Object.assign({grade:5},J.weapon));
    return ch;
  }
  /* 유물 적성자: 출생 때 고른 유물 지급 */
  function giveRelic(ch,id){
    const R=D.relics[id];if(!R)return;
    (ch.relics=ch.relics||[]).push(R.n);ch.relicPick=false;
    if(R.odin)ch.odin=true;
    if(R.gear){equip(ch,Object.assign({id:R.gear.id||id,grade:5},R.gear));ch.stash=(ch.stash||[]).filter(x=>x.id!=='birth')}
  }
  /* ===== 장비·돈·공방 ===== */
  /* 장비 칸마다 하나. 바꾸면 이전 장비 효과를 빼고 새 장비 효과를 더한다. 피해 최소값은 장비 중 가장 큰 값 */
  function equip(ch,item){
    const s=ch.stats,old=ch.gear[item.slot];
    if(old)for(const [k,v] of Object.entries(old.fx))if(k!=='dmin'&&k in s){s[k]-=v;if(k==='maxHp')ch.hp=Math.min(ch.hp,s.maxHp)}
    for(const [k,v] of Object.entries(item.fx))if(k!=='dmin'&&k in s){s[k]+=v;if(k==='maxHp')ch.hp+=v}
    ch.gear[item.slot]=item;
    /* 빼낸 장비는 버리지 않고 보관함으로 */
    if(old)(ch.stash=ch.stash||[]).push(old);
    s.dmin=Math.max(1,...Object.values(ch.gear).map(g=>g.fx.dmin||1));
    /* 무기 피해 주사위 면 수 (궁니르 d10). 장비 중 가장 큰 값, 기본 d6 */
    s.pdie=Math.max(6,...Object.values(ch.gear).map(g=>g.fx.die||6));
    if(item.card&&!ch.deck.includes(item.card)&&!ch.deckLocked)ch.deck.push(item.card);
  }
  /* 보관함의 장비를 꺼내 장착 (지금 장비는 보관함으로) */
  function equipStash(ch,i){const st=ch.stash||[];if(!st[i])return false;equip(ch,st.splice(i,1)[0]);return true}
  const inStash=(ch,id)=>(ch.stash||[]).some(x=>x.id===id);
  /* 공방 등급: 기본 → 소속 → 해결사 급수 보너스 */
  function shopAccess(ch){
    const A=D.access;let g=A.base;
    if(ch.aff&&A.aff[ch.aff.type])g=Math.max(g,A.aff[ch.aff.type]);
    const fingerUp=isFinger(ch)&&ch.fr&&ch.fr.tier>=D.fingerRules.shopTier;
    if((ch.licensed&&ch.rank<=A.rankBonus.rank)||fingerUp)g=Math.min(A.max,g+A.rankBonus.plus);
    return g;
  }
  /* 살 수 있는지: 'ok' / 'locked'(등급) / 'money' / 'owned' */
  function canBuy(ch,id){
    const it=D.items[id];
    if(ch.gear[it.slot]&&ch.gear[it.slot].id===id)return 'owned';
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
    if(!it.perm&&inStash(ch,id))return 'stash';
    if(ch.money<it.price)return 'money';
    return 'ok';
  }
  function buySpecial(ch,id){
    if(canBuySpecial(ch,id)!=='ok')return false;
    const it=D.special[id];ch.money-=it.price;
    if(it.perm){(ch.perms=ch.perms||[]).push(id);addStats(ch.stats,it.fx);if(it.fx.maxHp)ch.hp+=it.fx.maxHp}
    else equip(ch,Object.assign({id,grade:4},it));
    return true;
  }
  function buy(ch,id){
    if(canBuy(ch,id)!=='ok')return false;
    const it=D.items[id];ch.money-=priceOf(ch,id);equip(ch,Object.assign({id},it));return true;
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
  const noFixer=ch=>isFinger(ch)||(!!ch.aff&&(ch.aff.type==='wing'||ch.aff.type==='head'));
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
  function career(ch){
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
  function promoNeed(ch){
    const k=career(ch),n=Math.max(1,steps(k,ch));let sum=0,m=1;
    for(let i=0;i<n;i++){sum+=m;m*=multAt(i)}
    let need=CFG.promo.total*(k==='fixer'?CFG.promo.fixerMul:(CR[k].totalMul||1))/sum;
    for(let i=0;i<(ch.promos||0);i++)need*=multAt(i);
    return Math.round(need);
  }
  const canPromote=ch=>{const k=career(ch);return !!k&&(ch.promos||0)<steps(k,ch)};
  const ptsName=ch=>{const k=career(ch);return k&&CR[k]?CR[k].pts:T.promoPoints};
  const examReady=ch=>canPromote(ch)&&(ch.pp||0)>=promoNeed(ch);
  const examDc=ch=>{const k=career(ch),n=Math.max(1,steps(k,ch));return Math.round(CFG.promo.examDc+CFG.promo.examDcSpan*(ch.promos||0)/n)};
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
    return [`${ch.aff.name} · ${r.n}`,...(r.e?[r.e]:[])];
  }
  /* 최고 단계의 특수 사건: 해결사는 특색 심사, 다른 진로는 careers.*.top */
  const topEvent=ch=>{const k=career(ch);return k==='fixer'?D.colorExam:CR[k]&&CR[k].top};
  const topReady=ch=>{const k=career(ch);return !!k&&!canPromote(ch)&&!ch.title&&!ch.colorFailed&&(ch.promos||0)>0}
  /* ===== 손가락 서열 =====
     손가락마다 서열표가 있고, 오를 때마다 그 서열의 보정을 더한다. branch면 1d100으로 갈래를 고른다 */
  const isFinger=ch=>!!ch.aff&&ch.aff.type==='finger'&&!!D.fingers[ch.aff.name];
  function fingerStep(ch){
    const F=D.fingers[ch.aff.name],next=F.ranks[(ch.fi??-1)+1];
    if(!next)return null;
    const r=next.branch?next.branch[d(100)<=50?0:1]:next;
    ch.fi=(ch.fi??-1)+1;ch.fr=r;
    addStats(ch.stats,r.fx);if(r.fx.maxHp)ch.hp+=r.fx.maxHp;
    if(r.card&&!ch.deck.includes(r.card))ch.deck.push(r.card);
    return [`${ch.aff.name} · ${r.n}`,...(r.e?[r.e]:[])];
  }
  const canFingerUp=ch=>isFinger(ch)&&!!D.fingers[ch.aff.name].ranks[(ch.fi??-1)+1];
  /* 승급 사건·고정 전투 승리: 손가락이면 서열, 아니면 해결사 급수 */
  function promoteAny(ch){
    if(canFingerUp(ch))return {chips:fingerStep(ch),finger:true};
    const k=career(ch);if(k&&k!=='fixer'){const c=careerStep(ch);return c?{chips:c}:null}
    if(ch.licensed&&ch.rank>T.rankTop)return promote(ch);
    return null;
  }
  /* 날개·손가락 진로면 해결사 급수 대신 그 진로의 직급을 보여 준다 (해결사 급수는 그 진로에서 오르지 않는다) */
  const rankLabel=ch=>{if(ch.job)return ch.title?`${ch.title} · ${T.jobs[ch.job]}`:T.jobs[ch.job];const k=career(ch);if((k==='wing'||k==='finger')&&ch.fr)return ch.title?`${ch.title} · ${ch.fr.n}`:ch.fr.n;return rankLabel0(ch)};
  const rankLabel0=ch=>!ch.licensed?T.unranked:ch.title?`${ch.title} · ${ch.rank}${T.rankUnit}`:`${ch.rank}${T.rankUnit} ${T.licensed}`;
  /* 카드 얻기: 덱이 고정(엄지 검술)이면 카드 대신 돈 */
  function addCard(ch,cid,chips,label){
    if(!cid)return;
    if(ch.deckLocked){const m=earn(ch,CFG.lockedCardMoney);ch.money+=m;chips&&chips.push(`엄지 검술 · ${D.cards[cid].n} 대신 +${money(m)}`);return}
    ch.deck.push(cid);chips&&chips.push((label||'카드')+' · '+D.cards[cid].n);
  }
  function rewardCard(ch){const pool=D.rewards.filter(id=>!ch.deck.includes(id));return pool.length?one(pool):null}
  /* 사건·성장·보상 효과를 적용하고 화면용 칩을 돌려준다 */
  function applyFx(ch,fx){
    const s=ch.stats,chips=[];
    if(fx.maxHp){s.maxHp+=fx.maxHp;ch.hp+=fx.maxHp;chips.push('최대 HP '+sg(fx.maxHp))}
    if(fx.hp){ch.hp=clamp(ch.hp+fx.hp,1,s.maxHp);chips.push('HP '+sg(fx.hp))}
    for(const k of ['atk','eva','spd'])if(fx[k]){s[k]+=fx[k];chips.push(STAT[k]+' '+sg(fx[k]))}
    if(fx.money){const m=earn(ch,fx.money);ch.money=Math.max(0,ch.money+m);chips.push((m>0?'+':'−')+money(Math.abs(m))+(m!==fx.money?' (금전운)':''))}
    if(fx.check){s.check+=fx.check;chips.push('사건 판정 '+sg(fx.check))}
    if(fx.startBreath){s.startBreath+=fx.startBreath;chips.push('시작 '+D.keywords.breath.n+' +'+fx.startBreath)}
    const cid=fx.card||(fx.reward?rewardCard(ch):null);
    addCard(ch,cid,chips);
    /* 표시 없이 쌓이는 기록(금기 위반, 초대 등). 조건 "flag:이름" / "flag:이름>=n"으로 읽는다 */
    for(const f of [].concat(fx.flag||[]))ch.flags[f]=(ch.flags[f]||0)+1;
    if(fx.join){
      const name=fx.join.name||one(D.orgs[fx.join.from]);
      ch.aff={type:fx.join.type,name};chips.push((T.affTypes[fx.join.type]||'소속')+' · '+name);
      ch.fi=undefined;ch.fr=null;ch.pp=0;ch.promos=0;ch.strikes=0;
      if(noFixer(ch)&&ch.licensed){ch.licensed=false;ch.title=null;chips.push(`해결사 자격 반납 · ${T.affTypes[ch.aff.type]}은(는) 해결사를 겸할 수 없다`)}
      if(isFinger(ch))chips.push(...fingerStep(ch));
      else if(CR[ch.aff.type]&&CR[ch.aff.type].ranks)chips.push(...careerStep(ch));
    }
    /* 사건으로 승급 (해결사만, 최고 급수 미만일 때) */
    if(fx.promote)addPts(ch,CFG.promo.gain.mid,chips);
    if(fx.pinky&&!ch.pinky){ch.pinky=true;addStats(s,D.pinky.fx);chips.push(D.pinky.n+' 표식 · '+D.pinky.e)}
    if(fx.examPass){const need=promoNeed(ch),p=promoteAny(ch);if(p){chips.push(...p.chips);ch.pp=Math.max(0,(ch.pp||0)-need);ch.promos=(ch.promos||0)+1;ch.strikes=0}}
    if(fx.examFail){
      const k=career(ch),C_=CR[k]||{},lost=Math.floor((ch.pp||0)*(C_.lose||CFG.promo.loseFrac));
      ch.pp=(ch.pp||0)-lost;chips.push(`${ptsName(ch)} −${lost} (${ch.pp}/${promoNeed(ch)})`);
      if(C_.failHp){ch.hp=clamp(ch.hp+C_.failHp,1,s.maxHp);chips.push('HP '+sg(C_.failHp))}
      ch.strikes=(ch.strikes||0)+1;
      if(C_.strikes&&ch.strikes>=C_.strikes){
        ch.strikes=0;
        if(C_.strike==='fire'){chips.push(`${ch.aff.name} 해고 · 소속을 잃었다`);ch.aff=null;ch.fi=undefined;ch.fr=null;ch.pp=0;ch.promos=0}
        if(C_.strike==='purge'){ch.purge=C_.purgeFoe;chips.push('숙청 대상이 되었다')}
      }
    }
    if(fx.topPass){const C_=CR[career(ch)];ch.title=C_.topTitle;ch.titleKind='top';addStats(s,C_.topFx||{});if((C_.topFx||{}).maxHp)ch.hp+=C_.topFx.maxHp;chips.push('칭호 · '+ch.title)}
    if(fx.topFail){ch.colorFailed=true;chips.push('심사 실패 · 다시 기회 없음')}
    if(fx.examSkip)ch.examSkipYear=ch.year;
    if(fx.colorPass){ch.title=D.colors[ch.ci].adj+' '+one(D.titleWords[ch.dom||'atk']);ch.titleKind='color';ch.titlePick=true;chips.push(T.titleLabel+' · '+ch.title)}
    if(fx.colorFail){ch.colorFailed=true;chips.push(T.titleLabel+' 심사 실패 · 다시 기회 없음')}
    let licensed=false;
    if(fx.license){licensed=license(ch);if(licensed)chips.push(T.licenseGained+' · '+ch.rank+T.rankUnit)}
    return {chips,licensed};
  }
  function lvOf(xp){let l=1;for(let i=1;i<CFG.levels.length;i++)if(xp>=CFG.levels[i])l=i+1;return l}
  const xpNext=ch=>CFG.levels[ch.lv];
  function gainXp(ch,n){const b=ch.lv;ch.xp+=n;ch.lv=lvOf(ch.xp);ch.lvPend+=ch.lv-b;return ch.lv-b}
  function rollGrowth(){
    const out=[];let g=0;
    while(out.length<3&&g++<40){const r=d(100),x=pick(D.growth,r);if(!out.some(o=>o.g===x))out.push({r,g:x})}
    return out;
  }

  /* ===== 조우 =====
     "table:<이름>"이면 1d100으로 조우 표를 굴린다. 소속 전용 표(<이름>@<소속 종류>)가 있으면 그것을 쓴다 */
  function encounter(ch,s){
    if(!s.startsWith('table:'))return {id:s,roll:null,table:null};
    const name=s.slice(6),T_=D.encounters.tables;
    const key=ch.aff&&T_[`${name}@${ch.aff.type}`]?`${name}@${ch.aff.type}`:name;
    const r=d(100);
    let id=pick(T_[key],r).enemy;
    /* once: 한 번 이긴 미니보스는 다시 나오지 않는다 (표의 첫 적으로 바뀜) */
    if(D.enemies[id].once&&(ch.minis||[]).includes(id))id=T_[key][0].enemy;
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
    if(req==='pinky')return !!ch.pinky;
    if(req==='nopinky')return !ch.pinky;
    /* beat:any = 히든 보스를 하나라도 이김, beat:a|b = 그중 하나를 이김 */
    if(req==='beat:any')return ch.beaten.length>0;
    if(req.startsWith('beat:'))return req.slice(5).split('|').some(id=>ch.beaten.includes(id));
    if(req.startsWith('affname:'))return !!ch.aff&&ch.aff.name===req.slice(8);
    if(req.startsWith('rank<='))return ch.licensed&&ch.rank<=+req.slice(6);
    if(req==='licensed')return ch.licensed;
    if(req==='unlicensed')return !ch.licensed;
    if(req.startsWith('noflag:'))return !ch.flags[req.slice(7)];
    if(req==='nofinger')return !isFinger(ch);
    if(req==='nojob')return !ch.job;
    if(req==='canfix')return !noFixer(ch);
    if(req==='aff')return !!ch.aff;
    if(req==='noaff')return !ch.aff;
    if(req.startsWith('aff:'))return !!ch.aff&&ch.aff.type===req.slice(4);
    return true;
  }
  /* ===== 정신력 ===== */
  const M=CFG.mind;
  const mindFloor=ch=>ch.ego?M.ego[ch.ego.type].floor:0;
  function loseMind(ch,n,out){
    if(n<=0)return;const m0=ch.mind;ch.mind=Math.max(mindFloor(ch),ch.mind-n);
    if(ch.mind<m0&&out)out(`정신력 −${m0-ch.mind} (${ch.mind}/${M.max})`);
    if(ch.ego)return;
    if(ch.mind<=0)ch.mindDead=true;
    else if(ch.mind===1&&!ch.distortDone)ch.distortPend=true;
    else if(ch.mind<=M.voiceAt&&!ch.voiceUsed)ch.voicePend=true;
  }
  const gainMind=(ch,n)=>{const m0=ch.mind;ch.mind=Math.min(M.max,ch.mind+n);return ch.mind-m0};
  const mindTier=ch=>M.tiers.find(t=>ch.mind>=t.at)||null;
  /* E.G.O 이름: 1~5글자, 게임에 있는 물건·전리품·유물·카드 이름과 같으면 안 된다 (띄어쓰기 무시) */
  function egoTaken(){
    const n=new Set(),add=x=>{if(x)n.add(String(x).replace(/\s/g,''))};
    for(const o of [D.items,D.special,D.cards])for(const v of Object.values(o||{}))add(v.n);
    for(const v of Object.values(D.relics||{})){add(v.n);if(v.open)add(v.open.n)}
    for(const v of Object.values(D.hiddenJobs||{})){add(v.n);if(v.weapon)add(v.weapon.n)}
    for(const e of Object.values(D.enemies)){if(e.drop){add(e.drop.n);if(e.drop.gear)add(e.drop.gear.n)}}
    return n;
  }
  function egoNameErr(name){
    const w=(name||'').trim();
    if(!/^[가-힣A-Za-z0-9 ]{1,5}$/.test(w)||!w.replace(/\s/g,''))return '1~5글자로 적어 주세요 (한글·영문·숫자)';
    if(egoTaken().has(w.replace(/\s/g,'')))return '이미 게임에 있는 물건·전리품·유물·카드 이름이다';
    return null;
  }
  function setEgo(ch,type,name){
    const e=M.ego[type];ch.ego={type,n:name.trim()};ch.egoPick=false;ch.voiceUsed=true;ch.voicePend=false;ch.distortPend=false;
    if(e.hit)ch.stats.atk+=e.hit;if(e.hp){ch.stats.maxHp+=e.hp;ch.hp+=e.hp}
    ch.mind=Math.max(ch.mind,e.floor);(ch.relics=ch.relics||[]).push(`E.G.O · ${ch.ego.n}`);
  }
  /* 무한런: 마지막 해, 지금 위협 등급(-1이면 아직 기본 연차) */
  const lastYear=G=>CFG.years+(G.endless?CFG.endless.span*CFG.endless.grades.length:0);
  const gradeAt=y=>y>CFG.years?Math.min(CFG.endless.grades.length-1,Math.floor((y-CFG.years-1)/CFG.endless.span)):-1;
  function delCard(ch,i){
    if(ch.deckLocked)return false;
    if(ch.money<CFG.shop.delCost||ch.deck.length<=CFG.shop.minDeck||!ch.deck[i])return false;
    ch.money-=CFG.shop.delCost;return ch.deck.splice(i,1)[0];
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
    const mc=G.ch;
    if(mc.mindDead)return {type:'end',win:false,cause:'mind'};
    if(mc.distorted)return {type:'end',win:false,cause:'distort'};
    if(mc.distortPend&&!mc.ego){mc.distortPend=false;mc.distortDone=true;return {type:'event',ev:D.mindEvents.distort}}
    if(mc.innate==='mark'&&!mc.markOn&&G.year>=CFG.innate.markYear-1)return {type:'event',ev:D.innateEvents.mark};
    if(mc.affRetry&&!mc.aff){mc.affRetry=false;return {type:'event',ev:D.affiliation}}
    if(mc.voicePend&&!mc.voiceUsed&&!mc.ego){mc.voicePend=false;mc.voiceUsed=true;return {type:'event',ev:D.mindEvents.voice}}
    G.year++;
    if(G.year>lastYear(G)){G.year=lastYear(G);return {type:'end',win:true,trueEnd:!!G.endless}}
    G.ch.year=G.year;
    if(G.year>1){G.ch.hp=Math.min(G.ch.stats.maxHp,G.ch.hp+CFG.yearHeal);if(G.year%(M.healEvery||1)===0)gainMind(G.ch,M.yearHeal);G.lastIncome=earn(G.ch,income(G.ch));G.ch.money+=G.lastIncome}
    /* 근속: 진로가 있으면 해마다 포인트가 조금씩 쌓인다 */
    if(G.year>1&&CFG.promo.gain.year&&canPromote(G.ch))G.ch.pp=(G.ch.pp||0)+CFG.promo.gain.year;
    let f=fixedSpec(G.year);
    /* 무한런 등급 전투: 등급 마지막 해. 도시의 별 등급은 피아니스트(이미 이겼으면 후반 조우), 마지막 등급은 최종 상대 */
    const X_=CFG.endless,k_=G.year-CFG.years;
    if(k_>0)f=k_%X_.span?null:gradeAt(G.year)===X_.grades.length-1?X_.final:gradeAt(G.year)===X_.grades.indexOf('도시의 별')&&!(G.ch.minis||[]).includes(X_.star)?X_.star:'table:late';
    if(f&&k_>0&&gradeAt(G.year)===X_.grades.length-1)return {type:'fight',enemy:f,enc:{label:X_.grades[gradeAt(G.year)]+' · 마지막 등급 전투'}};
    if(f){
      /* 히든 보스: 목록 위에서부터 조건(과 확률)이 맞는 첫 보스가 불길한 예감(omen)으로 먼저 나타난다.
         맞서면 그 보스와 싸우고(다시 나오지 않음), 돌아서면 평소 조우로 넘어간다(조건이 맞으면 다음에 또 나올 수 있다) */
      for(const h of D.hiddenBosses||[]){
        if(G.year<(h.from||1)||G.ch.beaten.includes(h.id)||(G.met||[]).includes(h.id)||!meets(G.ch,h.req))continue;
        /* chanceBonus: 조건이 맞으면 확률 가산 (예: 검지 소속은 대행자 +30%) */
        const ch_=h.chance?h.chance+(h.chanceBonus&&meets(G.ch,h.chanceBonus.req)?h.chanceBonus.add:0):0;
        if(ch_&&d(100)>ch_)continue;
        return {type:'omen',boss:h.id,omen:h.omen||{},escape:!h.noEscape,spec:f};
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
    if(examReady(ch)&&ch.examSkipYear!==G.year-1){const k=career(ch);return {type:'event',ev:(CR[k]&&CR[k].exam)||D.promotionExam}}
    /* 사건을 다 쓰면 다시 섞는다 */
    if(!G.pool.length)G.pool=sample(D.events.map((_,i)=>i),D.events.length);
    /* first 표시가 있는 사건(소속 전용 등)은 조건이 맞으면 먼저 나온다 */
    const fi=G.pool.findIndex(i=>D.events[i].first&&meets(G.ch,D.events[i].req));
    if(fi>=0)return {type:'event',ev:D.events[G.pool.splice(fi,1)[0]]};
    /* 출신 진로 보정이 있으면 그 진로의 권유 사건(tag)이 보정값 × pathEventMul % 확률로 먼저 나온다 */
    const tagged=G.pool.filter(i=>{const e=D.events[i];return e.tag&&(G.ch.paths[e.tag]||0)>0&&meets(G.ch,e.req)});
    if(tagged.length){
      const ti=one(tagged);
      if(d(100)<=(G.ch.paths[D.events[ti].tag]||0)*CFG.pathEventMul){G.pool.splice(G.pool.indexOf(ti),1);return {type:'event',ev:D.events[ti]}}
    }
    while(G.pool.length){const ev=D.events[G.pool.pop()];if(meets(G.ch,ev.req))return {type:'event',ev}}
    return {type:'event',ev:D.events.find(e=>e.fallback)||D.events[0]};
  }
  /* 불길한 예감에 대한 답: go면 히든 보스, 아니면 원래 고정 전투 지정대로 조우 */
  function answerOmen(G,st,go){
    if(go||!st.escape){(G.met=G.met||[]).push(st.boss);return {type:'fight',enemy:st.boss,enc:{hidden:true,label:T.hiddenBoss}}}
    const e=encounter(G.ch,st.spec);return {type:'fight',enemy:e.id,enc:e,avoided:st.boss};
  }
  /* 고를 수 있는 선택지 (조건이 맞지 않는 선택지는 빠진다). i는 원래 번호 */
  const options=(G,ev)=>ev.c.map((c,i)=>({c,i})).filter(o=>meets(G.ch,o.c.req));
  /* 판정 보정 = 능력치 + 사건 판정 보정 + (그 진로 판정이면) 출신 진로 보정 */
  const pathMod=(ch,check)=>check.path?(ch.paths[check.path]||0):0;
  const checkDc=(ch,check)=>check.dc==='exam'?examDc(ch):check.dc==='color'?CFG.colorDc:check.dc==='top'?CFG.topDc:check.dc;
  function checkMod(ch,check){return (check.s?ch.stats[check.s]:0)+ch.stats.check+pathMod(ch,check)}
  /* 선택: 판정이 있으면 1d100 + 능력치 + 판정 보정 ≥ 난이도 */
  function choose(G,ev,i){
    const ch=G.ch,c=ev.c[i];let res=c.ok,roll=null,xp=CFG.xp.plain,xpNote=null;
    if(c.check){
      const ib=ch.innate==='intuition'?d(CFG.innate.intuitionDie):0;
      const dc=checkDc(ch,c.check),mod=checkMod(ch,c.check)+ib,r=d(100),tot=r+mod,ok=tot>=dc;
      if(ib)xpNote=`타고난 직감 +${ib}`;
      roll={r,mod,tot,dc,ok};res=ok?c.ok:c.fail;xp=ok?CFG.xp.ok:CFG.xp.fail;
    }
    const fx=res.fx||{};
    const {chips,licensed}=applyFx(ch,fx);
    if(xpNote)chips.unshift(xpNote);
    if(fx.markAwake){const M_=CFG.innate.markMul,s0=ch.stats,b={};
      for(const k of ['atk','eva','spd','check'])if(s0[k]>0){const n=Math.floor(s0[k]*M_)-s0[k];if(n>0){s0[k]+=n;b[k]=n}}
      const hp=Math.floor(s0.maxHp*M_)-s0.maxHp;s0.maxHp+=hp;ch.hp+=hp;ch.markOn=true;
      chips.push('표지 발현 · 능력치 ×'+M_);chips.push(Object.entries(b).map(([k,v])=>`${k}+${v}`).concat(`HP+${hp}`,'적중마다 +2d3').join(' · '))}
    /* 선택지의 정신력: mind -1이면 2d3 감소, +1이면 2d3 회복 */
    if(c.mind){const x=d(3)+d(3);if(c.mind<0)loseMind(ch,x,t=>chips.push(t+' · 2d3'));else{const g=gainMind(ch,x);if(g)chips.push(`정신력 +${g} (${ch.mind}/${M.max})`)}}
    if(fx.wsRoll){
      const r=d(WF.die);chips.push(`1d${WF.die} · ${r} (${WF.minRoll} 이상)`);
      if(r>=WF.minRoll){const was=ch.licensed;if(!was)license(ch);ch.aff={type:'workshop',name:'공방 해결사'};
        chips.push(`소속 · 공방 해결사${was?'':' · '+T.licenseGained+' '+ch.rank+T.rankUnit}`);chips.push('공방 물건 20% 할인 · 보관함 장비 판매');}
      else{chips.push('공방 주인이 고개를 젓는다 · 다른 길을 고른다');ch.affRetry=true}
    }
    if(fx.voice){
      const rs=[];for(let i=0;i<M.voiceRolls;i++)rs.push(d(M.voiceDie));
      const ok=rs.every(r=>r>=M.voiceDc);chips.push(`1d${M.voiceDie} × ${M.voiceRolls} · ${rs.join(' / ')} (${M.voiceDc} 이상 ${rs.filter(r=>r>=M.voiceDc).length}/${M.voiceRolls})`);
      if(ok){ch.egoPick=true;chips.push('E.G.O 개화')}else{const x=d(M.failLoss);chips.push('개화 실패');loseMind(ch,x,t=>chips.push(t+` · 1d${M.failLoss}`))}
    }
    if(fx.distort){
      const r=d(2);chips.push(`뒤틀림 판정 1d2 · ${r}`);
      if(r===1){ch.egoPick=true;ch.mind=M.max;chips.push('뒤틀리기 직전, E.G.O 개화 · 정신력 회복')}else{ch.distorted=true;chips.push('뒤틀림')}
    }
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
    addCard(ch,rewardCard(ch),chips);
    const bounty=earn(ch,D.money.bounty[D.enemies[C.id].tier]||0);if(bounty){ch.money+=bounty;chips.push('현상금 +'+money(bounty))}
    const up=gainXp(ch,CFG.xp.win);chips.push('경험치 +'+CFG.xp.win);if(up)chips.push('레벨 업 · Lv '+ch.lv);
    let title=null,tlabel=null,newly=false,colorRoll=null,unlock=null;
    const foe=D.enemies[C.id];
    if(foe.hidden){
      ch.beaten.push(C.id);chips.push(T.hiddenWin+' · '+foe.n);
      {const h=Math.min(CFG.hidden.winHeal,ch.stats.maxHp-ch.hp);if(h>0){ch.hp+=h;chips.push('숨을 돌린다 · HP +'+h)}}
      /* 엄지 소속으로 뇌횡: 동부십검 + 엄지 검술 (덱 고정) */
      const td=foe.thumbDrop&&meets(ch,foe.thumbDrop.req)?foe.thumbDrop:null;
      /* 도서관의 사서: 낮은 확률로 책장 카드 */
      for(const b of foe.bonusCards||[])if(d(100)<=b.chance)addCard(ch,b.card,chips,'책장 카드');
      if(td){addStats(ch.stats,td.fx);ch.hp+=td.fx.maxHp||0;(ch.relics=ch.relics||[]).push(td.n,'엄지 검술');equip(ch,Object.assign({grade:5},td.gear));
        ch.deck=td.deck.slice();ch.deckLocked=true;chips.push(`전리품 · ${td.n} 장착 (${td.gear.e})`);chips.push('엄지 검술 · 덱이 검술 10장으로 바뀐다. 이제 카드를 더 받지 않고, 대신 돈을 받는다')}
      if(foe.drop&&!td){const dr=foe.drop;addStats(ch.stats,dr.fx);if(dr.fx.maxHp)ch.hp+=dr.fx.maxHp;(ch.relics=ch.relics||[]).push(dr.n);
        if(dr.gear){equip(ch,Object.assign({id:dr.gear.id,grade:5},dr.gear));chips.push(`전리품 무기 장착 · ${dr.gear.n} (${dr.gear.e})`)}
        chips.push(`전리품 · ${dr.n} (${dr.e}, 영구)`);if(dr.card)addCard(ch,dr.card,chips,'전용 카드');for(const cc of dr.cards||[])addCard(ch,cc,chips,'전용 책장');}
      if(foe.unlock&&!ch.unlocks.includes(foe.unlock)){ch.unlocks.push(foe.unlock);unlock=foe.unlock;chips.push('해금 · '+(T.jobs[foe.unlock]||foe.unlock))}
    }
    /* 미니보스 전리품(once): 처음 이겼을 때만 */
    if(!foe.hidden&&foe.drop&&!(ch.minis||[]).includes(C.id)){
      (ch.minis=ch.minis||[]).push(C.id);const dr=foe.drop;if(dr.ego)ch.egoGear=(ch.egoGear||0)+1;addStats(ch.stats,dr.fx);if(dr.fx.maxHp)ch.hp+=dr.fx.maxHp;(ch.relics=ch.relics||[]).push(dr.n);
      chips.push(`전리품 · ${dr.n} (${dr.e}, 영구)`);if(dr.card)addCard(ch,dr.card,chips,'전용 카드');for(const cc of dr.cards||[])addCard(ch,cc,chips,'전용 책장');
    }
    /* 전투 승리 후 등록: 소속이 없거나 사무소 소속일 때만, 소문 판정(1d100 + 해결사 진로 보정 ≥ winLicenseDc) */
    if(!ch.licensed){
      if((!ch.aff||ch.aff.type==='office')&&d(100)+(ch.paths.fixer||0)>=CFG.winLicenseDc&&license(ch)){
        newly=true;chips.push(T.licenseGained+' · '+ch.rank+T.rankUnit);title=rankLabel(ch);tlabel=T.licenseGained;
      }
    }
    addPts(ch,foe.hidden?CFG.promo.gain.hidden:(CFG.promo.gain[foe.tier]||0),chips);
    return {chips,title,tlabel,newly,colorRoll,unlock,hidden:!!foe.hidden,endText:foe.endText||null,last:G.year>=lastYear(G)};
  }

  /* ===== 전투 (1:1) =====
     라운드마다 1d100 + 속도로 순서를 정하고, 카드는 순서대로 한 장씩 번갈아 발동한다. */
  function mkEnt(o){return Object.assign({bleed:0,rupture:0,breath:0,evaB:0,fs:false,fsOn:false,catchup:false,cu:false,
    dmin:1,defUp:0,adv:0,advUsed:false,hand:[],light:0,guarding:false,passHit:0,passHitNext:0,lightUp:0,lightNext:0},o)}
  /* 푸른 화염: 해방 레바테인에게 화상을 받은 쪽(blue), 또는 화상 blueAt 이상 */
  const cardGrade=y=>[...CFG.cardGrade].reverse().find(g=>(y||1)>=g.from)||CFG.cardGrade[0];
  const isBlue=X=>X.burn>0&&(X.blue||X.burn>=CFG.laev.blueAt);
  const snap=C=>{const f=X=>({hp:Math.max(0,X.hp),bleed:X.bleed,rupture:X.rupture,breath:X.breath,burn:X.burn||0,blue:isBlue(X),echo:X.echo||0,ledger:X.ledger||0,prescript:X.prescript||0,warp:X.warp||0,shock:X.shock||0,mk:X.mk||0,grudge:X.grudge||0,shield:X.shield||0,matc:X.matc||0,mat:X.mat||0,wecho:X.wecho||0});return {P:f(C.P),E:f(C.E)}};
  function mkCombat(ch,id,quiet){
    const s=ch.stats,e=D.enemies[id];
    const P=mkEnt({uid:'P',name:ch.name||T.you,color:ch.color,hp:ch.hp,maxHp:s.maxHp,atk:s.atk,eva:s.eva,spd:s.spd,
      bleed:s.startBleed,breath:s.startBreath,dmin:s.dmin,defUp:s.defUp,adv:s.adv,deck:ch.deck,extraD2:(s.extraD2||0),dmgB:s.dmgB||0,burnHit:s.burnHit||0,pdie:s.pdie||6,hyeolchan:ch.race==='hyeolgwi',psycho:ch.innate==='psycho',cg:cardGrade(ch.year),wx:ch.gear.weapon&&ch.gear.weapon.wx||null,jobPassive:ch.job&&D.hiddenJobs[ch.job]?D.hiddenJobs[ch.job].passive||null:null,mark:!!ch.markOn,odin:!!ch.odin,laev:ch.gear.weapon&&ch.gear.weapon.id==='laev_sealed'?'sealed':ch.gear.weapon&&ch.gear.weapon.id==='laev'?'open':null,isP:true});
    const S_=CFG.enemyScale,yy=Math.max(0,(ch.year||0)-S_.from),grow=e.hidden?0:yy;
    const H_=CFG.hidden,HL=CFG.hiddenLate,hy=e.hidden?Math.max(0,(ch.year||0)-HL.from):0,g=gradeAt(ch.year||0)+1,X_=CFG.endless;
    const eh=Math.round(((e.hp+s.enemyHp)*(1+S_.hpPerYear*grow)*(e.hidden?H_.hpMul:S_.hpMul)+hy*HL.hpPerYear)*(1+X_.hpMul*g));
    const up=Math.floor(grow/S_.atkEvery)+(e.hidden?H_.atk+Math.floor(hy/HL.atkEvery):0),xa=X_.atk*g;
    /* 보스별 난이도 보정(hard): 체력 배수, 공격·회피 가산 */
    const hd=e.hard||null,ehh=hd?Math.round(eh*(hd.hp||1)):eh;
    const E=mkEnt({uid:'E',name:e.n,color:e.color,hp:ehh,maxHp:ehh,atk:e.atk+up+xa+(hd&&hd.atk||0),eva:e.eva+up+(hd&&hd.eva||0),spd:e.spd,deck:e.deck,isP:false,passive:e.passive||null});
    /* 급수 부족 보정: 히든 보스 규칙에 penalty가 있고 fullRank보다 급수가 낮으면 내 명중·회피가 깎인다 */
    const rule=(D.hiddenBosses||[]).find(h=>h.id===id),pen=rule&&rule.penalty;
    let penalty=null;
    if(pen&&!(ch.licensed&&ch.rank<=pen.fullRank)){P.atk+=pen.atk||0;P.eva+=pen.eva||0;penalty=pen}
    /* 히든 보스: 체력이 너무 낮으면 최소치까지 채운 상태로 시작 */
    let hpNote=null;
    if(P.laev==='open'){P.burn=1}
    if(e.hidden&&P.hp<Math.min(CFG.hidden.minHp,P.maxHp)){const t=Math.min(CFG.hidden.minHp,P.maxHp);hpNote=`불길한 예감에 숨을 고른다 · HP ${P.hp} → ${t}`;P.hp=t;ch.hp=t}
    /* 정신력: 환상체와 마주치면 2d3 감소, 그다음 정신력 구간 보정(호흡·회피) */
    let mindNote=hpNote?[hpNote]:[];
    if(e.abno)loseMind(ch,d(3)+d(3),t=>mindNote.push(`환상체와 마주쳤다 · ${t} · 2d3`));
    const mt=mindTier(ch);if(mt){P.breath+=mt.breath;P.eva+=mt.eva;mindNote.push(`정신력 ${ch.mind} · 호흡 +${mt.breath}${mt.eva?` · 회피 +${mt.eva}`:''}`)}
    const C={ch,P,E,id,penalty,round:0,log:[],cur:[],evs:[],logBefore:0,over:null,order:[],quiet:!!quiet,mindNote};
    newRound(C);
    return C;
  }
  /* 순서: 1d100 + 속도 (+ 지난 라운드에 뒤처졌으면 추격 보정).
     상대보다 높으면 빛 +1, 격차 gapFirst 이상이면 첫 공격 명중 +firstHit. 동점이면 둘 다 보너스 없음 */
  function newRound(C){
    C.round++;
    const {P,E}=C;
    for(const X of [P,E]){X.r=d(100);X.cu=X.catchup;X.tot=X.r+X.spd+(X.catchup?CFG.catchupBonus:0)}
    for(const [X,Y] of [[P,E],[E,P]]){
      X.lead=X.tot>Y.tot;X.fsOn=X.fs=X.tot-Y.tot>=CFG.gapFirst;X.catchup=X.tot<Y.tot;X.advUsed=false;
      X.light=Math.min(CFG.lightMax+X.lightUp+X.lightNext,CFG.light+X.lightUp+X.lightNext+(X.lead?CFG.orderBonusLight:0));
      X.passHit=X.passHitNext;X.passHitNext=0;X.lightNext=0;X.matBonus=X.matNext||0;X.matNext=0;
    }
    P.hand=sample(P.deck,CFG.hand);
    if(P.furiosoNext){P.hand.push('x_furioso');P.furiosoNext=false}
    /* 히든 보스 전용 패시브: 라운드 단위 */
    const pv=E.passive&&E.passive.id;
    E.maskOn=pv==='mask'&&C.round%E.passive.every===0;
    P.locked=pv==='lock'&&C.round%E.passive.every===0?d(P.hand.length)-1:-1;
    C.order=P.tot>=E.tot?[P,E]:[E,P];
    /* 히든 직업 패시브: 발톱 질주(빛), 조율자 봉인(적 공격 카드 1장) */
    const jp=P.jobPassive;C.jobNote=null;
    if(jp&&jp.id==='rush'&&C.round%jp.every===0){P.light+=jp.light;C.jobNote=`${P.name} · ${jp.n} · 이번 라운드 빛 +${jp.light}`}
    /* 적은 라운드 시작 때 낼 카드를 정한다 (화면에 의도로 공개) */
    C.ePlan=aiPlan(C);
    if(jp&&jp.id==='seal'&&C.round%jp.every===0){const i=C.ePlan.findIndex(c=>c.t==='atk');if(i>=0){const c=C.ePlan.splice(i,1)[0];C.jobNote=`${P.name} · ${jp.n} · ${E.name}의 ${c.n}을(를) 봉인했다`}}
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
  function autoPick(C){
    const P=C.P,low=P.hp/P.maxHp<0.35;
    const score=c=>c.t==='def'?(low?8:0.5):c.t==='buff'?(c.kw||[]).reduce((a,k)=>a+k[1]*1.5,0)
      :c.hits*(c.dice*3.5+c.b)+(c.kw||[]).reduce((a,k)=>a+k[1]*2,0)+c.hit*0.05;
    let best=[],bs=-1;
    for(let m=1;m<1<<P.hand.length;m++){
      const idx=P.hand.map((_,i)=>i).filter(i=>m>>i&1);
      if(idx.includes(P.locked))continue;
      if(idx.reduce((a,i)=>a+D.cards[P.hand[i]].c,0)>P.light)continue;
      const sc=idx.reduce((a,i)=>a+score(D.cards[P.hand[i]]),0);
      if(sc>bs){bs=sc;best=idx}
    }
    return best.sort((a,b)=>(D.cards[P.hand[b]].t==='def')-(D.cards[P.hand[a]].t==='def')||score(D.cards[P.hand[b]])-score(D.cards[P.hand[a]]));
  }
  /* 적의 카드 선택. 방어 카드는 CFG.enemyGuard.chance% 확률로만 손에 남기고, 직전 라운드에 썼으면 이번엔 쓰지 않는다 */
  function aiPlan(C){
    const G_=CFG.enemyGuard,E=C.E;
    /* 연계 카드: 직전 라운드에 쓴 카드가 다음 카드를 열면 그 카드 하나만 낸다 (빛 무시) */
    if(E.forceNext){const id=E.forceNext;E.forceNext=null;return [D.cards[id]]}
    let hand=drawHand(E.deck,CFG.hand);
    const noGuard=E.lastGuard===C.round-1||d(100)>G_.chance;
    if(noGuard&&hand.some(id=>D.cards[id].t!=='def'))hand=hand.filter(id=>D.cards[id].t!=='def');
    const plan=autoPlay(hand,E.light);
    if(plan.some(c=>c.t==='def'))E.lastGuard=C.round;
    return plan;
  }
  function applyKw(A,D_,c,L){
    for(const [k,n,to] of (c.kw||[])){
      const X=to==='s'?A:D_;
      X[k]=Math.min(CFG.stackCap,X[k]+n);
      L('kw',`  ${X.name}에게 ${D.keywords[k].n} +${n} (지금 ${X[k]})`);
    }
  }
  function act(C,A,c,L,push){
    const B=A===C.P?C.E:C.P;
    if(c.t==='buff'){if(c.shield)A.shield=(A.shield||0)+c.shield;L('sys',`${A.name} · ${c.n} (버프)${c.gain?` · 빛 +${c.gain}`:''}${c.shield?` · 보호막 ${A.shield}`:''}`);applyKw(A,B,c,L);push({k:'buff',side:A.uid,card:c});return}
    const hits=c.hits+(c.t==='atk'&&A.wx&&A.wx.extraHit?A.wx.extraHit:0);
    for(let h=0;h<hits;h++){
      if(A.hp<=0||B.hp<=0)return;
      /* 출혈: 공격할 때마다(명중 여부 무관) 스택만큼 피해, 그 뒤 1 감소 */
      if(A.bleed>0){
        const bd=A.bleed;A.hp=Math.max(0,A.hp-bd);A.bleed--;
        L('dmg',`${A.name} ${D.keywords.bleed.n} ${bd} 피해 (공격하며 상처가 벌어진다)`);
        push({k:'bleed',side:A.uid,dmg:bd});
        /* 혈귀 패시브 혈찬: 상대의 출혈이 5번 발동할 때마다 HP 15 회복 */
        if(B.hyeolchan){B.hc=(B.hc||0)+1;if(B.hc%5===0&&B.hp>0){const h=Math.min(15,B.maxHp-B.hp);B.hp+=h;L('kw',`  ${B.name} · 혈찬 · HP +${h}`)}}
        if(A.hp<=0)return;
      }
      /* 명중: 1d100 + 공격 + 카드 보정 > 상대 1d100 + 회피 (동점은 방어 성공). 두 번 굴림이면 높은 값 */
      let ra=d(100),ra2=0,pnote='';
      /* 앙갚음 장부: 3스택이면 이번 명중 굴림은 1d110, 스택 소모 */
      if(A.passive&&A.passive.id==='ledger'&&(A.ledger||0)>=A.passive.need){ra=d(110);A.ledger=0;pnote=` ${A.passive.n}(1d110)`}
      /* 장비 두 번 굴림: adv 1 이상이면 라운드 첫 공격마다, 1 미만이면 그 확률로 */
      if(c.adv||(A.adv&&!A.advUsed&&(A.adv>=1||d(100)<=A.adv*100))){ra2=d(100);if(ra2>ra)[ra,ra2]=[ra2,ra]}
      A.advUsed=true;
      /* 회피 주사위: 적은 단계별 크기(CFG.enemyEvadeDie), 플레이어는 1d100 */
      const rdMax=B.isP?100:(D.enemies[C.id].evadeDie||CFG.enemyEvadeDie[D.enemies[C.id].tier]||100),rd=d(rdMax);
      const fsb=A.fs?CFG.firstHit:0;A.fs=false;
      /* 검은 침묵의 장갑: 공격마다 1d9로 무기가 바뀐다 */
      let sub=null;
      if(A.wx&&A.wx.arsenal){const i=d(A.wx.arsenal.length);sub=A.wx.arsenal[i-1];(C.ars=C.ars||[]);if(!C.ars.includes(i))C.ars.push(i);pnote+=` 장갑 1d9 ${i}·${sub.n}`}
      const gr=A.isP&&A.cg&&c.t==='atk'?A.cg:null;
      const am=A.atk+c.hit+(gr?gr.hit:0)+fsb+A.passHit+(sub?sub.atk:0)-3*(A.prescript||0)-(A.isP&&A.laev==='open'&&isBlue(A)?CFG.laev.selfBlueHit:0),dm=B.eva+B.evaB-3*(B.shock||0)+(B.maskOn?B.passive.eva:0)+(B.odin?(C.round===1?30:15):0);
      const sa=sub&&sub.sure?Math.max(ra+am,rd+dm+1):ra+am,sd=rd+dm,G_=CFG.guard;
      const base={k:'atk',att:A.uid,def:B.uid,card:c,ra,ra2,rd,rdMax,am,dm,sa,sd,b:c.b,guard:B.guarding};
      /* 방어 자세: 막아도 피해 guardHit는 받는다 (키워드는 붙지 않음) */
      if(B.guarding&&sa<=sd){
        const dmg=G_.guardHit;B.hp=Math.max(0,B.hp-dmg);
        L('miss',`${A.name} → ${B.name} · ${c.n} · 명중 ${sa} vs 방어 ${sd} · 막았다 · 피해 ${dmg}`);
        push(Object.assign(base,{hit:false,blocked:true,rolls:[],dmg,note:''}));
        continue;
      }
      if(sa<=sd){
        if(B.passive&&B.passive.id==='godfather'&&!B.gfBonus){B.gfBonus=true;L('kw',`  ${B.name} · ${B.passive.n} · 다음 적중 피해 +1d2`)}
        L('miss',`${A.name} → ${B.name} · ${c.n} · 명중 ${sa} vs 회피 ${sd}${B.maskOn?` (${B.passive.n} +${B.passive.eva})`:''} · 빗나감`);
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
      else if(wd){for(let i=0;i<wd[0]+(gr?gr.dice:0);i++)rolls.push(Math.max(Math.min(lo,wd[1]),d(wd[1])))}
      else for(let i=0;i<c.dice+(gr&&!c.die?gr.dice:0);i++)rolls.push(Math.max(lo2,d(die)));
      let note=fsb?' 선제':'';
      if(c.rr&&rolls.length){
        let mi=0;rolls.forEach((v,i)=>{if(v<rolls[mi])mi=i});
        const nv=Math.max(lo2,d(die));if(nv>rolls[mi]){note+=` 재굴림 ${rolls[mi]}→${nv}`;rolls[mi]=nv}
      }
      let dmg=rolls.reduce((a,b)=>a+b,0)+c.b+(gr?gr.b:0);
      if(gr&&gr.n)note+=` 등급${gr.n}`;
      note+=pnote;
      /* 장비 추가 주사위 (천퇴성도: 적중마다 1d2 × N) */
      if(A.extraD2){let x=0;for(let i=0;i<A.extraD2;i++)x+=d(2);dmg+=x;note+=` 추가 1d2×${A.extraD2}+${x}`}
      if(A.passive){
        if(A.passive.id==='godfather'&&A.gfBonus){const x=d(2);dmg+=x;A.gfBonus=false;note+=` ${A.passive.n}+${x}`}
        if(A.passive.id==='claw'){const x=d(4);dmg+=x;note+=` ${A.passive.n}+${x}`}
      }
      if(A.breath>0){
        if(d(100)<=A.breath*CFG.breathCritPer){dmg=Math.floor(dmg*CFG.critMult);note+=' 치명'}
        A.breath--;
      }
      if(B.rupture>0){dmg+=B.rupture;note+=` ${D.keywords.rupture.n}+${B.rupture}`;B.rupture--}
      if(A.dmgB){dmg+=A.dmgB;note+=` 무기+${A.dmgB}`}
      /* 화상: 받는 피해 ×1.5, 5스택 이상이면 푸른 화염 ×2 */
      if(isBlue(B)){dmg=dmg*2;note+=' 푸른 화염×2'}else if(B.burn>0){dmg=Math.floor(dmg*1.5);note+=' 화상×1.5'}
      if(A.mark){const x=d(3)+d(3);dmg+=x;note+=` 표지+${x}`}
      if(B.guarding){dmg=Math.floor(dmg*G_.guardFailMul);note+=` 방어 감소×${G_.guardFailMul}`}
      /* 무기 디버프: 왜곡(내가 주는 피해 감소), 표적(3스택이면 2배), 원한(쌓인 만큼 추가) */
      if(A.matBonus){dmg+=A.matBonus;note+=` 신체관극+${A.matBonus}`}
      if(c.reuse&&A.mat>0){let x=0;for(let i=0;i<A.mat;i++)x+=d(c.die||6);dmg+=x;note+=` 폐장 재사용 ${A.mat}회+${x}`;A.mat=0}
      if(A.warp){dmg=Math.max(1,dmg-A.warp);note+=` 왜곡−${A.warp}`}
      if(A.wx&&A.wx.mark){B.mk=(B.mk||0)+1;if(B.mk>=A.wx.mark.need){dmg*=2;B.mk=0;note+=' 표적×2'}}
      if(A.wx&&A.wx.grudge&&A.grudge>0){const x=A.grudge*A.wx.grudge;dmg+=x;note+=` 원한+${x}`;A.grudge=0}
      if(B.wx&&B.wx.ward){dmg=Math.max(1,dmg-B.wx.ward);note+=` 책장−${B.wx.ward}`}
      if(A.psycho||B.psycho){const m=(A.psycho?CFG.innate.psycho:1)*(B.psycho?CFG.innate.psycho:1);dmg*=m;note+=` 사이코패스×${m}`}
      if(B.shield>0){const ab=Math.min(B.shield,dmg);B.shield-=ab;dmg-=ab;note+=` 보호막−${ab}`}
      B.hp=Math.max(0,B.hp-dmg);
      L('hit',`${A.name} → ${B.name} · ${c.n} · 명중 ${sa} vs ${B.guarding?'방어':'회피'} ${sd} · 피해 [${rolls.join(',')}]${c.b?sg(c.b):''}${note} = ${dmg}`);
      applyKw(A,B,c,L);
      /* 마에스트로 책장: 재료 수집 부여 / 신체관극(상대 디버프 수만큼 재료) */
      if(c.mat&&B.hp>0){B.matc=(B.matc||0)+c.mat;L('kw',`  ${B.name}에게 재료 수집 ${B.matc}`)}
      if(c.harvest&&B.matc>0){const n=['bleed','rupture','burn','prescript','warp','shock','mk','matc'].reduce((a,k)=>a+(B[k]>0?B[k]:0),0);
        A.mat=(A.mat||0)+n;A.matNext=(A.matNext||0)+n;L('kw',`  ${A.name} · 신체관극 · 재료 +${n} (지금 ${A.mat}) · 다음 라운드 적중마다 피해 +${A.matNext}`)}
      /* 전용 무기 효과: 적중 시 키워드·잔향·호흡·조율, 피격 시 반격 */
      if(A.wx&&B.hp>0){const X=A.wx;
        if(X.debuff){const {k,n}=X.debuff,nm={prescript:'지령',warp:'왜곡',shock:'감전'}[k];B[k]=Math.min(5,(B[k]||0)+n);L('kw',`  ${B.name}에게 ${nm} ${B[k]}`)}
        if(X.hitKw)for(const [k,n] of X.hitKw){B[k]=Math.min(CFG.stackCap,(B[k]||0)+n);L('kw',`  ${B.name}에게 ${D.keywords[k].n} +${n} (무기)`)}
        if(X.echo){B.wecho=(B.wecho||0)+1;L('kw',`  ${B.name}에게 잔향 ${B.wecho}/${X.echo.need}`);if(B.wecho>=X.echo.need){B.hp=Math.max(0,B.hp-X.echo.dmg);B.wecho=0;L('dmg',`  잔향이 울린다 · ${B.name} 고정 피해 ${X.echo.dmg}`)}}
        if(X.breathHit){A.breath=Math.min(CFG.stackCap,A.breath+X.breathHit)}
        if(X.execute&&B.hp>0&&B.hp<=B.maxHp*X.execute.below){B.hp=Math.max(0,B.hp-X.execute.dmg);L('dmg',`  조율 · ${B.name} 고정 피해 ${X.execute.dmg}`)}}
      if(B.wx&&B.wx.grudge&&B.hp>0){B.grudge=Math.min(5,(B.grudge||0)+1)}
      if(B.wx&&B.wx.thorns&&A.hp>0){A.hp=Math.max(0,A.hp-B.wx.thorns);L('dmg',`  ${B.name}의 무기 반격 · ${A.name} 피해 ${B.wx.thorns}`)}
      /* 검은 침묵의 장갑: 서로 다른 무기 3종을 쓰면 이번 전투에 한 번, 다음 손패에 Furioso */
      if(A.wx&&A.wx.arsenal&&!C.furiosoGiven&&(C.ars||[]).length>=3){C.furiosoGiven=true;A.furiosoNext=true;L('sys',`  ${A.name} · 서로 다른 무기 3종 · 다음 손패에 Furioso`)}
      /* 회피 실패: 1d5에서 1이면 정신력 1 감소 (E.G.O 장비 1개당 +1) */
      if(B.isP&&d(M.evadeDie)===1)loseMind(C.ch,1+(C.ch.egoGear||0),t=>L('kw',`  ${B.name} · ${t}`));
      /* 레바테인 계열: 적중 시 화상 */
      if(A.burnHit&&B.hp>0){B.burn=Math.min(CFG.stackCap,(B.burn||0)+A.burnHit);if(A.laev==='open')B.blue=true;
        L('kw',`  ${B.name}에게 ${A.laev==='open'?'푸른 화염':'화상'} +${A.burnHit} (지금 ${B.burn})`);
        /* 봉인: 화상을 건 횟수가 쌓이면 해방 (전투가 끝나도 유지) */
        if(A.laev==='sealed'){const ch=C.ch;ch.laevN=(ch.laevN||0)+A.burnHit;
          if(ch.laevN>=CFG.laev.unlock){const L_=D.relics.laev.open;A.laev='open';A.atk+=L_.fx.atk-(ch.gear.weapon.fx.atk||0);A.wx=L_.wx;
            equip(ch,Object.assign({id:'laev',grade:5},L_));ch.stash=(ch.stash||[]).filter(x=>x.id!=='laev_sealed');
            L('sys',`  봉인이 풀렸다 · 레바테인 (공+${L_.fx.atk}, 피해 1d15, 상대의 화상은 푸른 화염으로)`)}
          else L('kw',`  레바테인 봉인 ${ch.laevN}/${CFG.laev.unlock}`)}}
      /* 주사위마다 무작위 디버프 1 (Furioso): 출혈 또는 파열 */
      if(c.rngDebuff&&B.hp>0){const got={};for(let i=0;i<c.dice;i++){const k=one(c.rngDebuff);B[k]=Math.min(CFG.stackCap,B[k]+1);got[k]=(got[k]||0)+1}
        L('kw',`  ${B.name}에게 ${Object.entries(got).map(([k,n])=>D.keywords[k].n+' +'+n).join(' · ')} (무작위)`)}
      if(B.passive&&B.passive.id==='ledger'&&B.hp>0){B.ledger=Math.min(B.passive.need,(B.ledger||0)+1);L('kw',`  ${B.name} · ${B.passive.n} ${B.ledger}/${B.passive.need}`)}
      if(A.passive&&A.passive.id==='echo'&&B.hp>0){
        B.echo=(B.echo||0)+1;L('kw',`  ${B.name}에게 ${A.passive.n} ${B.echo}/${A.passive.need}`);
        if(B.echo>=A.passive.need){B.hp=Math.max(0,B.hp-A.passive.dmg);B.echo=0;L('dmg',`  ${A.passive.n}이 울린다 · ${B.name} 고정 피해 ${A.passive.dmg}`)}
      }
      push(Object.assign(base,{hit:true,rolls,dmg,note}));
    }
  }
  /* pp, ep: 이번 라운드에 낼 카드 배열 */
  function resolveRound(C,pp,ep){
    const {P,E}=C;
    C.cur=[];C.evs=[];
    const L=(t,s)=>{if(C.quiet)return;C.log.push({t,s});C.cur.push({t,s})};
    const push=ev=>{if(C.quiet)return;ev.lines=C.cur;C.cur=[];ev.snap=snap(C);ev.step=C.step;C.evs.push(ev)};
    L('head',`— ${C.round}라운드 · ${C.order[0].name} 선공 —`);
    if(C.round===1&&C.mindNote&&C.mindNote.length)C.mindNote.forEach(t=>L('kw',t));
    if(C.jobNote)L('kw',C.jobNote);
    C.step=-1;push({k:'head'});
    P.evaB=E.evaB=0;
    if(P.laev==='open'&&C.round>1&&C.round%CFG.laev.selfEvery===0){P.burn=Math.min(CFG.stackCap,(P.burn||0)+1);L('kw',`${P.name} · 레바테인 · 자신에게 화상 1 (지금 ${P.burn})`)}
    /* 아무 카드도 내지 않으면 방어 자세 */
    for(const [X,plays] of [[P,pp],[E,ep]]){
      X.guarding=plays.length===0;
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
      if(c.next&&!A.isP){A.forceNext=c.next;L('sys',`${A.name} · ${c.n} · 다음 라운드 ${D.cards[c.next].n} 준비`)}
      if(c.t==='def'){const ev=(c.eva||CFG.defBonus)+A.defUp;A.evaB+=ev;if(c.lightNext)A.lightNext=(A.lightNext||0)+c.lightNext;L('sys',`${A.name} · ${c.n} · 이번 라운드 회피 +${ev}${c.lightNext?` · 다음 라운드 빛 +${c.lightNext}`:''}`);push({k:'def',side:A.uid,card:c});return}
      if(P.hp<=0||E.hp<=0)return;
      act(C,A,c,L,push);
    });
    C.step=-1;
    /* 연주(피아니스트): 라운드마다 악장 1. every에 닿으면 고정 피해 dmg, 그 라운드에 방어 자세였으면 절반 */
    if(E.passive&&E.passive.id==='recital'&&E.hp>0&&P.hp>0){
      const R=E.passive;E.recital=(E.recital||0)+1;
      if(E.recital>=R.every){const x=P.guarding?Math.floor(R.dmg/2):R.dmg;P.hp=Math.max(0,P.hp-x);E.recital=0;L('dmg',`${E.name} · ${R.n} · 절정 · ${P.name} 고정 피해 ${x}${P.guarding?' (방어 자세로 절반)':''}`)}
      else L('kw',`${E.name} · ${R.n} ${E.recital}/${R.every}${E.recital===R.every-1?' · 다음 라운드 끝에 절정 (방어 자세면 절반)':''}`);
      push({k:'buff',side:'E',card:{n:R.n}});
    }
    /* 푸른 화염: 라운드 끝에 스택 × blueDot 피해, 그 뒤 1 감소. 해방 레바테인 소지자의 일반 화상은 줄지 않는다 */
    for(const X of [P,E]){
      if(isBlue(X)&&X.hp>0){const x=X.burn*CFG.laev.blueDot;X.hp=Math.max(0,X.hp-x);X.burn--;L('dmg',`${X.name} · 푸른 화염 ${x} 피해 (남은 ${X.burn})`)}
      else if(X.burn>0&&!(X.isP&&X.laev==='open'))X.burn--;
      for(const k of ['prescript','warp','shock'])if(X[k]>0)X[k]--}
    if(P.hp<=0||C.ch.mindDead)C.over='lose';else if(E.hp<=0)C.over='win';
  }
  /* 자동 전투 (시뮬): 카드 고르는 순서도 행동 순서를 따른다 */
  function fightAuto(ch,id){
    const C=mkCombat(ch,id,true);let g=0;
    while(!C.over&&g++<80){
      let pp,ep;
      pp=autoPlay(C.P.hand.filter((_,i)=>i!==C.P.locked),C.P.light);ep=C.ePlan;
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
        if(grow){const c=rewardCard(ch);if(c)ch.deck.push(c)}
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
    isFinger,canFingerUp,giveRelic,applyGrowth,earn,priceOf,sellStash,sellValue,isWs,equip,equipStash,shopAccess,canBuy,buy,canBuySpecial,buySpecial,income,money,encounter,answerOmen,meets,newGame,age,advanceYear,options,checkMod,pathMod,choose,winRewards,
    lastYear,gradeAt,cardGrade,loseMind,gainMind,mindTier,egoNameErr,setEgo,delCard,promoNeed,examReady,checkDc,canPromote,ptsName,career,fixedSpec,mkCombat,newRound,queue,autoPick,resolveRound,aiPlan,autoPlay,snap,fightAuto,chainSim,simulate};
}
