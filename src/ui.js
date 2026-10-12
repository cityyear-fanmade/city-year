/* 화면: 렌더와 연출만 맡는다. 규칙과 판정은 전부 엔진(E)에 묻는다. */
import {CFG} from './config.js';
import {clamp,sg,STAT} from './engine.js';

export function startUI(E,app){
  const D=E.D,T=D.text;
  const KWC={bleed:'var(--bleed)',rupture:'var(--rupture)',breath:'var(--breath)',burn:'#f0903c'};
  const kwc=k=>KWC[k]||'var(--gold)';

  /* ===== 설정 저장 (연출 속도, 배경 테마) ===== */
  const store={get(k){try{return localStorage.getItem(k)}catch(e){return null}},set(k,v){try{localStorage.setItem(k,v)}catch(e){}}};
  let MODE=store.get('cityYearMode')||((window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches)?'off':'slow');
  const SKINS=[{k:'base',n:'기본'},{k:'dante',n:'단테의 노트'},{k:'terminal',n:'검지 단말기'},{k:'ruina',n:'도서관 초대장'}];
  const SKIN_TAB={base:'도시 기록',dante:'단테의 노트',terminal:'TERMINAL · 대행',ruina:'오늘의 책'};
  let SKIN=store.get('cityYearSkin')||'base';
  /* 전투 진행: 직접 고르기(pick) / 자동 전투(auto). 자동이면 카드 선택과 라운드 진행을 알아서 한다 */
  let FIGHT=store.get('cityYearFight')||'pick';
  /* 히든 직업 해금 기록: 이 브라우저에만 남는다 */
  const loadUnlocks=()=>{try{return JSON.parse(store.get('cityYearUnlocks')||'[]')}catch(e){return []}};
  const addUnlock=k=>{const u=loadUnlocks();if(!u.includes(k)){u.push(k);store.set('cityYearUnlocks',JSON.stringify(u))}};
  if(!SKINS.some(s=>s.k===SKIN))SKIN='base';
  document.documentElement.dataset.skin=SKIN;

  /* ===== 연출 (굴림 / 빠르게 / 끔) ===== */
  let PLAYING=false,SKIP=false,PRE=null,wake=null;
  const $=id=>document.getElementById(id);
  const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  /* 연출 속도: 빠르게 0.45배, 천천히·수동 1.4배 */
  const tm=()=>MODE==='fast'?0.45:1.4;
  /* 수동: 버튼을 눌러야 다음으로 넘어간다. 건너뛰기를 누르면 바로 풀린다 */
  let tapWake=null;
  function waitTap(label){
    if(MODE!=='manual'||SKIP||FIGHT==='auto')return Promise.resolve();
    const b=$('tapBtn');if(!b)return Promise.resolve();
    b.hidden=false;b.textContent=label;
    return new Promise(r=>{tapWake=()=>{tapWake=null;b.hidden=true;r()}});
  }
  function wait(ms){return SKIP?Promise.resolve():new Promise(r=>{wake=r;setTimeout(()=>{wake=null;r()},ms*tm())})}
  async function rollNum(el,final,ms,max){
    if(!el)return;
    if(MODE==='off'||SKIP){el.textContent=final;return}
    const end=Date.now()+ms*tm();
    while(Date.now()<end&&!SKIP&&el.isConnected){
      el.textContent=1+Math.floor(Math.random()*max);
      await new Promise(r=>setTimeout(r,55));
    }
    el.textContent=final;
  }
  function anim(el,cls,ms){
    if(!el)return;
    el.classList.remove(cls);void el.offsetWidth;el.classList.add(cls);
    setTimeout(()=>el.classList.remove(cls),ms||600);
  }
  function floatTxt(side,txt,color,cls){
    const p=$('ent-'+side);if(!p)return;
    const s=document.createElement('span');
    s.className='float'+(cls?' '+cls:'');s.textContent=txt;s.style.color=color;
    p.appendChild(s);setTimeout(()=>s.remove(),1000);
  }
  const PREV={};
  function applySnap(sn){
    for(const side of ['P','E']){
      const X=C[side],v=sn[side],h=$('hp-'+side);
      if(!h)return;
      /* 새로 붙은 키워드는 그 칸 위에 잠깐 띄운다 */
      const pv=PREV[side];PREV[side]={...v};
      if(pv)Object.keys(D.keywords).forEach((k,i)=>{const dlt=(v[k]||0)-(pv[k]||0);if(dlt>0)setTimeout(()=>floatTxt(side,`${D.keywords[k].n} +${dlt}`,kwc(k),'kwf'),120+i*160)});
      h.textContent=`HP ${v.hp}/${X.maxHp}`;
      $('bar-'+side).firstElementChild.style.width=clamp(v.hp/X.maxHp*100,0,100)+'%';
      $('chips-'+side).innerHTML=stacks(v);
    }
  }
  function appendLog(lines){
    const lg=$('log');if(!lg)return;
    for(const l of lines){const dv=document.createElement('div');dv.className=l.t;dv.textContent=l.s;lg.appendChild(dv)}
    lg.scrollTop=lg.scrollHeight;
  }
  function setLabel(t){const a=$('alabel');if(a)a.textContent=t}

  /* 재생 중 표시: 순서표의 지금 행동 강조, 공격하는 쪽/맞는 쪽 패널 테두리 */
  function markStep(i){
    const items=document.querySelectorAll('#queue li[data-i]');
    items.forEach(li=>{const k=+li.dataset.i;li.classList.toggle('now',k===i);li.classList.toggle('done',i>=0&&k<i)});
    const qn=$('qnow'),cur=[...items].find(li=>+li.dataset.i===i);
    if(qn)qn.innerHTML=cur?`<br>지금 ${i+1}/${items.length} · ${cur.lastElementChild.innerHTML}`:'';
  }
  function markSides(att,def){
    for(const s of ['P','E']){const el=$('ent-'+s);if(!el)continue;el.classList.toggle('acting',s===att);el.classList.toggle('target',s===def)}
  }
  const who=s=>`<b style="color:${C[s].color}">${esc(C[s].name)}</b>`;
  function setVerdict(t,cls){const v=$('verdict');if(v){v.textContent=t;v.className='verdict '+(cls||'')}}
  async function playEvent(e){
    const nm=s=>C[s].name;
    if(e.step!=null&&e.step>=0)markStep(e.step);
    markSides(e.att||e.side||null,e.def||null);setVerdict('');
    if(e.k==='head'){setLabel(e.lines[0]?e.lines[0].s:'');appendLog(e.lines);await wait(500);return}
    if(e.k==='def'){setLabel(`${nm(e.side)} · ${e.card.n}`);anim($('ent-'+e.side),'guard',700);appendLog(e.lines);await wait(450);return}
    if(e.k==='buff'){setLabel(`${nm(e.side)} · ${e.card.n}`);anim($('ent-'+e.side),'guard',700);appendLog(e.lines);applySnap(e.snap);await wait(500);return}
    if(e.k==='bleed'){
      setLabel(`${nm(e.side)} · ${D.keywords.bleed.n}`);anim($('ent-'+e.side),'hurt',500);
      floatTxt(e.side,'−'+e.dmg,'var(--bleed)');appendLog(e.lines);applySnap(e.snap);await wait(550);return;
    }
    const X=C[e.att],Y=C[e.def];
    const dA=$('dA'),dD=$('dD');
    if(!dA||!dD)return;
    if(MODE==='manual'){const a=$('alabel');if(a)a.innerHTML=`${who(e.att)}의 <b>${esc(e.card.n)}</b> → ${who(e.def)}`;
      $('capA').innerHTML=`${who(e.att)} · 명중 1d100`;$('capD').innerHTML=`${who(e.def)} · ${e.guard?'방어':'회피'} 1d${e.rdMax||100}`;
      dA.className='die';dD.className='die';dA.firstElementChild.textContent='?';dD.firstElementChild.textContent='?';$('dmgw').hidden=true;$('sA').textContent='';$('sD').textContent='';$('fA').innerHTML='&nbsp;';$('fD').innerHTML='&nbsp;';$('fM').innerHTML='&nbsp;';
      await waitTap('주사위를 굴린다')}
    const a=$('alabel');if(a)a.innerHTML=`${who(e.att)}의 <b>${esc(e.card.n)}</b> → ${who(e.def)}`;
    $('capA').innerHTML=`${who(e.att)} · 명중 1d100`;$('capD').innerHTML=`${who(e.def)} · ${e.guard?'방어':'회피'} 1d${e.rdMax||100}`;
    dA.className='die rolling';dD.className='die rolling';
    dA.style.borderColor=X.color;dD.style.borderColor=Y.color;
    $('dmgw').hidden=true;$('sA').textContent='';$('sD').textContent='';$('fA').innerHTML='&nbsp;';$('fD').innerHTML='&nbsp;';$('fM').innerHTML='&nbsp;';
    await Promise.all([
      rollNum(dA.firstElementChild,e.ra,650,100).then(()=>{dA.classList.remove('rolling');anim(dA,'settle',320)}),
      rollNum(dD.firstElementChild,e.rd,900,e.rdMax||100).then(()=>{dD.classList.remove('rolling');anim(dD,'settle',320)})
    ]);
    $('fA').textContent=e.sa;$('fD').textContent=e.sd;
    $('fA').className='dfinal '+(e.hit?'good':'');$('fD').className='dfinal '+(e.hit?'':'good');
    $('sA').textContent=`눈 ${e.ra}${e.am?' '+sg(e.am):''}${e.ra2?` (2회 굴림, ${e.ra2} 버림)`:''}`;
    $('sD').textContent=`눈 ${e.rd}${e.dm?' '+sg(e.dm):''}`;
    dA.classList.add(e.hit?'win':'lose');dD.classList.add(e.hit?'lose':'win');
    await wait(350);
    anim($('ent-'+e.att),e.att==='P'?'lunge-up':'lunge-down',500);
    await wait(200);
    if(e.hit){
      anim($('ent-'+e.def),'hurt',520);
      const box=$('dmgd'),fc=(e.card&&e.card.die)||6;$('dmgw').hidden=false;$('dmgw').querySelector('.dcap').textContent='피해 d'+fc;
      box.innerHTML=e.rolls.map(()=>'<div class="d6"><b>–</b></div>').join('');
      await Promise.all([...box.children].map((el,i)=>rollNum(el.firstElementChild,e.rolls[i],500+i*(fc<6?60:130),fc)));
      $('fM').textContent=e.dmg;
      setVerdict(e.guard?`방어 실패 · ${C[e.def].name}에게 줄어든 피해 ${e.dmg}`:`명중 · ${C[e.def].name}에게 피해 ${e.dmg}`,'bad');
      $('sM').textContent=`${e.rolls.join('+')}${e.b?sg(e.b):''}${e.note}`;
      floatTxt(e.def,'−'+e.dmg,'var(--bleed)');
      applySnap(e.snap);appendLog(e.lines);
      await wait(600);
    }else if(e.blocked){
      setVerdict(`막았다 · ${C[e.def].name} 피해 ${e.dmg}`,'miss');
      anim($('ent-'+e.def),'guard',600);floatTxt(e.def,'−'+e.dmg,'var(--rupture)');
      appendLog(e.lines);applySnap(e.snap);
      await wait(500);
    }else{
      setVerdict(`빗나감 · ${C[e.def].name}이(가) 피했다`,'miss');
      anim($('ent-'+e.def),'dodge',600);floatTxt(e.def,'회피','var(--rupture)');
      appendLog(e.lines);applySnap(e.snap);
      await wait(500);
    }
  }
  async function runPlayback(evs){
    PLAYING=true;SKIP=false;
    for(const e of evs){if(SKIP)break;await playEvent(e)}
    markSides(null,null);
    await waitTap(C.over?'전투 결과 보기':'라운드 마치기');
    PLAYING=false;SKIP=false;
    if(!C.over)E.newRound(C);
    render();if(isMobile())window.scrollTo(0,0);
  }
  async function resultAnim(){
    const r=UI.res.roll;SKIP=false;
    const die=$('rd'),b=$('rdb');
    if(die&&MODE==='manual'){const t=$('tapBtn');if(t){t.hidden=false;t.textContent='주사위를 굴린다';await new Promise(r=>{tapWake=()=>{tapWake=null;t.hidden=true;r()}})}}
    if(die){
      die.classList.add('rolling');
      await rollNum(b,r.r,900,100);
      die.classList.remove('rolling');anim(die,'settle',320);
      await wait(350);
    }
    const a=$('after');if(a)a.style.visibility='visible';
  }
  function rollAnim(){
    document.querySelectorAll('[data-roll]').forEach((el,i)=>{
      el.textContent='–';
      setTimeout(()=>rollNum(el,+el.dataset.roll,650,100),i*220);
    });
  }

  /* ===== 화면 ===== */
  let UI={screen:'title'},G=null,C=null,BC=null,SIM=null,lastScreen='';

  function bar(v,max){return `<div class="bar"><i style="width:${clamp(v/max*100,0,100)}%"></i></div>`}
  /* 걸려 있는 키워드: 수치와 다음에 일어날 일을 같이 보여 준다 */
  const KWHINT={burn:n=>n>=5?'받는 피해 ×2':'받는 피해 ×1.5',bleed:n=>`공격할 때 −${n}`,rupture:n=>`맞을 때 +${n}`,breath:n=>`치명 ${Math.min(100,n*CFG.breathCritPer)}%`};
  function stacks(X){
    const out=Object.keys(D.keywords).filter(k=>X[k]>0).map(k=>`<span class="chip stk" style="--kc:${kwc(k)}"><b>${k==='burn'&&X[k]>=5?'푸른 화염':D.keywords[k].n} ${X[k]}</b>${KWHINT[k]?`<small>${KWHINT[k](X[k])}</small>`:''}</span>`);
    /* 히든 보스 패시브 스택: 잔향(내게 쌓임), 장부(보스에게 쌓임) */
    const pv=C&&C.E&&C.E.passive;
    if(pv&&X.echo>0)out.push(`<span class="chip stk" style="--kc:var(--rupture)"><b>${pv.n} ${X.echo}/${pv.need}</b><small>${pv.need}에서 고정 피해 ${pv.dmg}</small></span>`);
    if(pv&&X.ledger>0)out.push(`<span class="chip stk" style="--kc:var(--bleed)"><b>${pv.n} ${X.ledger}/${pv.need}</b><small>${X.ledger>=pv.need?'다음 명중 1d110':'다 차면 명중 1d110'}</small></span>`);
    return out.length?out.join(''):'<span class="chip dim">상태 없음</span>';
  }
  function kwChips(c){
    return (c.kw||[]).map(([k,n,to])=>`<span class="chip" style="color:${kwc(k)};border-color:${kwc(k)}">${D.keywords[k].n} +${n}${to==='s'?' 자신':''}</span>`).join('');
  }
  function cardLine(c){
    if(c.t!=='atk')return c.d;
    const x=[];
    if(c.adv)x.push('명중 2회 굴림');
    if(c.rr)x.push('낮은 피해 재굴림');
    if(c.min)x.push('피해 최소 '+c.min);
    if(c.next)x.push('사용 후 다음 라운드 '+D.cards[c.next].n);
    if(c.rngDebuff)x.push('주사위마다 '+c.rngDebuff.map(k=>D.keywords[k].n).join('·')+' 중 무작위 +1');
    return `${c.hits>1?c.hits+'타 · ':''}${c.dice}d${c.die||6}${c.b?sg(c.b):''} · 명중 ${sg(c.hit)}${x.length?' · '+x.join(' · '):''}`;
  }
  function vSettings(){
    const b=(a,k,l,cur)=>`<button class="${cur===k?'on':''}" data-a="${a}" data-i="${k}">${l}</button>`;
    return `<div class="stack" style="gap:6px"><span class="eyebrow">배경 테마</span><div class="seg">${SKINS.map(s=>b('skin',s.k,s.n,SKIN)).join('')}</div></div>
      <div class="stack" style="gap:6px"><span class="eyebrow">주사위 · 전투 연출</span><div class="seg">${b('mode','manual','수동',MODE)}${b('mode','slow','천천히',MODE)}${b('mode','fast','빠르게',MODE)}${b('mode','off','끔',MODE)}</div>
        <span class="small dim">${{manual:'행동마다 버튼을 눌러 직접 주사위를 굴린다',slow:'자동으로 천천히 굴린다',fast:'자동으로 빠르게 굴린다',off:'연출 없이 결과만 본다'}[MODE]}</span></div>
      <div class="stack" style="gap:6px"><span class="eyebrow">전투 진행</span><div class="seg">${b('fightmode','pick','직접 고르기',FIGHT)}${b('fightmode','auto','자동 전투',FIGHT)}</div>
        <span class="small dim">${FIGHT==='auto'?'카드 선택과 라운드 진행을 알아서 한다. 전투가 끝나면 멈춘다':'라운드마다 손패에서 카드를 직접 고른다'}${FIGHT==='auto'&&MODE==='manual'?' · 자동 전투 중에는 수동 굴림 버튼을 기다리지 않는다':''}</span></div>`;
  }
  const affLabel=ch=>(ch.aff?`<span class="chip">${esc(ch.aff.name)}${ch.fr&&!['wing','finger'].includes(E.career(ch))?' · '+ch.fr.n:''}</span>`:ch.licensed?`<span class="chip">${T.licensed}</span>`:'')
    +(ch.pinky?`<span class="chip" title="${D.pinky.t}">+${D.pinky.n}</span>`:'');
  const innateName=c=>c.innate?(c.innate==='mark'&&c.markOn?D.innate.mark.awake:D.innate[c.innate].n):null;
  function vMind(ch){
    const m=ch.mind,mx=CFG.mind.max,t=E.mindTier(ch),low=m<=CFG.mind.voiceAt;
    return `<div class="row between small"><span class="mono" style="color:${low?'var(--bad,#c46a5a)':'var(--gold)'}">정신력 ${m}/${mx}</span><span class="mono dim">${ch.ego?`E.G.O ${esc(ch.ego.n)} · 하한 ${CFG.mind.ego[ch.ego.type].floor}`:t?`호흡 +${t.breath}${t.eva?` · 회피 +${t.eva}`:''}`:low?'목소리가 가깝다':'보정 없음'}${ch.egoGear?` · E.G.O 장비 ${ch.egoGear}`:''}${ch.innate?` · <span style="color:var(--gold)">${esc(innateName(ch))}</span>`:''}</span></div>
      <div class="bar" style="height:4px"><span style="width:${Math.round(m/mx*100)}%;background:${low?'#c46a5a':'#8a7fb8'}"></span></div>`;
  }
  function vHud(){
    const ch=G.ch,s=ch.stats,nx=E.xpNext(ch);
    return `<div class="panel stack">
      <div class="row between"><div class="row"><span class="swatch" style="background:${ch.color}"></span><b class="serif" style="color:${ch.color}">${esc(ch.name||T.you)}</b><span class="small" style="color:${ch.color}">${E.rankLabel(ch)}</span>${affLabel(ch)}</div>
      <span class="mono small dim">${E.age(G)}세 · ${G.year>CFG.years?`${G.year}년차 · ${CFG.endless.grades[E.gradeAt(G.year)]}`:`${G.year}/${CFG.years}년차`}</span></div>
      ${bar(ch.hp,s.maxHp)}
      ${vMind(ch)}
      <div class="mono small dim">HP ${ch.hp}/${s.maxHp} · 공격 ${sg(s.atk)} · 회피 ${sg(s.eva)} · 속도 ${sg(s.spd)} · 판정 ${sg(s.check)} · 카드 ${ch.deck.length}장</div>
      <div class="mono small dim">Lv ${ch.lv} · 경험치 ${ch.xp}${nx!=null?'/'+nx:' (최고)'}${E.canPromote(ch)?` · ${E.ptsName(ch)} ${ch.pp||0}/${E.promoNeed(ch)}`:''} · ${Object.values(ch.gear).map(g=>esc(g.n)).join(' · ')}</div>
      <div class="row between"><span class="mono small" style="color:var(--gold)">자산 ${E.money(ch.money)}${G.lastIncome&&UI.showIncome?` <span class="dim">(올해 수입 +${E.money(G.lastIncome)})</span>`:''}</span>
        </div>
      ${vInv()}
    </div>`;
  }
  /* 소지품: 정확한 능력치(장비 몫 따로), 장비 효과, 덱 카드 목록 */
  function vInv(){
    const ch=G.ch,s=ch.stats,gear=Object.values(ch.gear);
    const gsum=k=>gear.reduce((a,g)=>a+((g.fx||{})[k]||0),0);
    const row=(l,v,k)=>{const g=k?gsum(k):0;return `<div class="invr"><span>${l}</span><b class="mono">${v}</b><span class="mono small dim">${g?'장비 '+sg(g):''}</span></div>`};
    const stats=[row('최대 HP',s.maxHp,'maxHp'),row('공격 (명중 보정)',sg(s.atk),'atk'),row('회피',sg(s.eva),'eva'),row('속도 (순서 보정)',sg(s.spd),'spd'),
      row('사건 판정',sg(s.check),'check'),row('피해 주사위 최소',s.dmin,null),row('전투 시작 출혈',s.startBleed,null),row('전투 시작 호흡',s.startBreath,null),
      ...(s.defUp?[row('방어 카드 회피 추가',sg(s.defUp),null)]:[]),...(s.adv?[row('첫 공격 명중 두 번 굴림','있음',null)]:[])].join('');
    const eq=Object.entries(D.slots).map(([k,n])=>{const g=ch.gear[k];return `<div class="invr"><span>${n}</span><b>${g?esc(g.n):'<span class="dim">없음</span>'}</b><span class="mono" style="color:var(--gold)">${g?esc(g.e||''):''}</span></div>`}).join('');
    const cnt={};ch.deck.forEach(id=>cnt[id]=(cnt[id]||0)+1);
    const cards=Object.entries(cnt).map(([id,n])=>{const c=D.cards[id];return `<div class="invc"><span class="cost">${c.c}</span><div><b>${esc(c.n)}${n>1?` <span class="dim">×${n}</span>`:''}</b><div class="small dim">${c.t==='def'?'방어 · ':c.t==='buff'?'버프 · ':''}${cardLine(c)||''}</div>${c.kw?`<span class="chips">${kwChips(c)}</span>`:''}</div></div>`}).join('');
    const tabs=[['stat','능력치'],['gear','장비'+((ch.stash||[]).length?' '+ch.stash.length:'')],['card','카드 '+ch.deck.length],['relic','전리품'+((ch.relics||[]).length?' '+ch.relics.length:'')]];
    const tab=UI.invTab||'stat';
    const body={stat:`<div>${stats}</div><div class="small dim">${esc(ch.o.n)} · ${esc(ch.t.n)} · ${esc(ch.f.n)} · ${esc(ch.w.n)}</div>`,
      gear:`<div><span class="eyebrow">장착 중</span>${eq}</div>${(ch.stash||[]).length?'':'<p class="small dim">보관함이 비어 있다. 장비를 바꾸면 이전 장비가 여기에 남는다.</p>'}
        ${(ch.stash||[]).length?`<div><span class="eyebrow">보관함</span>${ch.stash.map((g,i)=>`<div class="invr"><span>${D.slots[g.slot]} · <b>${esc(g.n)}</b></span>${UI.screen==='combat'?'<span class="small dim">전투 중 교체 불가</span>':`<button class="chip" data-a="eqs" data-i="${i}" style="cursor:pointer">장착</button>`}<span class="mono" style="color:var(--gold)">${esc(g.e||'')}</span></div>`).join('')}</div>`:''}`,
      card:`<div class="invcards">${cards}</div>`,
      relic:(ch.relics||[]).length?`${(ch.relics||[]).length?`<div><span class="eyebrow">전리품</span>${ch.relics.map(n=>{const e=Object.values(D.enemies).find(x=>x.drop&&x.drop.n===n),r=Object.values(D.relics||{}).find(x=>x.n===n);return `<div class="invr"><span>${esc(n)}</span><b class="mono" style="color:var(--gold)">${e?esc(e.drop.e):r?esc(r.e):''}</b></div>`}).join('')}</div>`:''}`:'<p class="small dim">아직 전리품이 없다. 숨은 보스를 이기면 얻는다.</p>'}[tab];
    return `<details class="inv"${UI.invOpen?' open':''}><summary>소지품 · 능력치</summary>
      <div class="seg invtabs" style="margin-top:8px">${tabs.map(([k,n])=>`<button class="${tab===k?'on':''}" data-a="invtab" data-i="${k}">${n}</button>`).join('')}</div>
      <div class="stack" style="gap:10px;margin-top:8px">${body}</div></details>`;
  }
  /* 공방: 등급별 목록. 들어갈 수 없는 등급은 조건을 보여 준다 */
  function vBlack(){
    if(!(UI.stock||[]).length)return '';
    const ch=G.ch;
    const items=UI.stock.map(id=>{const it=D.special[id],st=E.canBuySpecial(ch,id);
      const note=st==='owned'?(it.perm?'이미 받음':'장착 중'):st==='stash'?'보관 중':st==='money'?'돈이 모자란다':it.perm?'영구 강화':`${D.slots[it.slot]} 교체${ch.gear[it.slot]?' · 지금 '+esc(ch.gear[it.slot].n):''}`;
      return `<button class="btn" data-a="bspecial" data-i="${id}" ${st==='ok'?'':'disabled'}><span class="row between"><b>${it.n}</b><span class="mono" style="color:var(--gold)">${E.money(it.price)}</span></span>
        <span class="mono" style="color:var(--gold)">${it.e}</span><span class="mono small dim">${note}</span></button>`}).join('');
    return `<div class="panel stack" style="gap:8px;border-color:var(--bleed)"><div class="row between"><b class="serif">암시장</b><span class="chip">이번 방문만</span></div>
      <p class="small dim">출처를 묻지 않는 물건들. 이번에 지나가면 다음엔 다른 물건이 나온다.</p><div class="stack">${items}</div></div>`;
  }
  function vShop(){
    const ch=G.ch,acc=E.shopAccess(ch),A=D.access;
    /* 입장 조건 문구: 그 등급을 주는 소속 / (한 등급 낮은 소속 또는 무소속) + 해결사 급수 보너스 */
    const need=g=>{
      const nm=f=>Object.entries(A.aff).filter(([,v])=>f(v)).map(([k])=>T.affTypes[k]);
      const direct=nm(v=>v>=g),low=nm(v=>v<g&&v+A.rankBonus.plus>=g),rk=`${T.licensed} ${A.rankBonus.rank}${T.rankUnit} 이상`;
      const parts=[];if(direct.length)parts.push(direct.join('·')+' 소속');
      if(A.base+A.rankBonus.plus>=g)parts.push(rk);else if(low.length)parts.push(`${low.join('·')} 소속이면서 ${rk}`);
      return parts.join(', 또는 ');
    };
    const shops=D.workshops.map(w=>{
      const open=w.grade<=acc;
      const items=Object.entries(D.items).filter(([,it])=>it.grade===w.grade).map(([id,it])=>{
        const st=E.canBuy(ch,id),cur=ch.gear[it.slot];
        const note=st==='owned'?'장착 중':st==='stash'?'보관 중':st==='money'?'돈이 모자란다':st==='locked'?'잠김':`${D.slots[it.slot]} 교체${cur?' · 지금 '+esc(cur.n):''}`;
        return `<button class="btn" data-a="buy" data-i="${id}" ${st==='ok'?'':'disabled'}><span class="row between"><b>${it.n}</b><span class="mono" style="color:var(--gold)">${E.isWs(ch)?`<s class="dim">${E.money(it.price)}</s> `:''}${E.money(E.priceOf(ch,id))}</span></span>
          <span class="mono" style="color:var(--gold)">${it.e}</span><span class="mono small dim">${D.slots[it.slot]} · ${note}</span></button>`;
      }).join('');
      return `<div class="panel stack" style="gap:8px${open?'':';opacity:.6'}"><div class="row between"><b class="serif">${w.n}</b><span class="chip${open?'':' dim'}">${w.grade}등급${open?'':' · 잠김'}</span></div>
        <p class="small dim">${w.t}${open?'':' 들어가려면 '+need(w.grade)+'.'}</p>${open?`<div class="stack">${items}</div>`:''}</div>`;
    }).join('');
    const gear=Object.entries(D.slots).map(([k,n])=>`<span class="chip">${n} · ${ch.gear[k]?esc(ch.gear[k].n):'없음'}</span>`).join('');
    return `${vHud()}<div class="stack" style="gap:6px"><div class="eyebrow">공방 · 내 등급 ${acc}</div><h2>무엇을 맞출까</h2>
      <div class="chips">${gear}</div>${UI.bought?`<p class="good small">${esc(UI.bought)}을(를) 맞췄다.</p>`:''}</div>${shops}${vBlack()}${vSell()}${vDelCard()}
      <button class="btn primary" data-a="unshop">공방을 나간다</button>`;
  }
  /* 공방 해결사: 보관함 장비 판매 */
  function vSell(){
    const ch=G.ch;if(!E.isWs(ch))return '';const st=ch.stash||[];
    return `<div class="panel stack" style="gap:8px"><div class="row between"><b class="serif">보관함 팔기</b><span class="chip">공방 해결사</span></div>
      <p class="small dim">보관함에 있는 장비를 공방에 넘긴다. 장착 중인 장비는 팔 수 없다.</p>
      ${UI.sold?`<p class="good small">${esc(UI.sold)}</p>`:''}
      ${st.length?st.map((g,i)=>`<button class="btn" data-a="sell" data-i="${i}"><span class="row between"><b>${esc(g.n)}</b><span class="mono" style="color:var(--gold)">+${E.money(E.sellValue(g))}</span></span><span class="mono small dim">${D.slots[g.slot]} · ${esc(g.e||'')}</span></button>`).join(''):'<p class="small dim">보관함이 비어 있다.</p>'}</div>`;
  }
  /* 공방: 카드 지우기 (방문 한 번에 1장, 덱 최소 장수 유지) */
  function vDelCard(){
    const ch=G.ch,S=CFG.shop,del=UI.deleted||[],left=S.delMax-del.length,can=left>0&&ch.money>=S.delCost&&ch.deck.length>S.minDeck;
    return `<div class="panel stack" style="gap:8px"><div class="row between"><b class="serif">카드 지우기</b><span class="mono" style="color:var(--gold)">${E.money(S.delCost)} · 이번 방문 ${del.length}/${S.delMax}</span></div>
      <p class="small dim">덱에서 카드를 지운다. 공방에 들를 때마다 ${S.delMax}장까지, 덱은 ${S.minDeck}장 아래로 줄일 수 없다.</p>
      ${del.length?`<p class="good small">지운 카드 · ${del.map(esc).join(', ')}</p>`:''}
      ${left>0?`<div class="chips">${ch.deck.map((id,i)=>`<button class="chip" data-a="delcard" data-i="${i}" ${can?'':'disabled'}>${D.cards[id].n} ×</button>`).join('')}</div>`:''}
      ${left>0&&!can?`<p class="small dim">${ch.deck.length<=S.minDeck?'덱이 더 줄어들 수 없다.':'돈이 모자란다.'}</p>`:''}${left<=0?'<p class="small dim">이번 방문에는 더 지울 수 없다.</p>':''}</div>`;
  }
  function vRules(){
    return `<details><summary>규칙 요약</summary><ul>
      <li><b>출생</b> 출신·재능·결점·무기·색을 1d100으로 정한다. 색은 직접 바꿀 수 있다.</li>
      <li><b>성장기</b> ${D.childhood.stages.map(s=>s.age+'세').join('·')}에 1d100으로 성장표를 굴려 능력치가 하나씩 자란다. ${CFG.startAge}세부터 직접 산다.</li>
      <li><b>사건</b> 해마다 사건 하나. 주사위 판정(1d100 + 능력치 + 판정 보정 ≥ 난이도)이 있는 선택과 결과가 정해진 선택이 있다.</li>
      <li><b>출신 진로</b> 어떤 출신은 특정 진로(${Object.values(T.paths).join('·')})에 보정이 붙는다. 그 진로에 들어가는 판정에 보정값을 더하고, 그 진로의 권유 사건이 더 자주 찾아온다.</li>
      <li><b>소속</b> 권유 사건으로 일찍 들어가거나, ${CFG.affiliationYear}년차 갈림길에서 고른다. ${T.licensed}면 ${T.affTypes.office}에 바로 들어가거나 ${T.affTypes.assoc} 심사를 볼 수 있고, ${T.affTypes.wing} 입사 시험과 ${T.affTypes.finger}의 문은 누구에게나 열려 있다. 소속에 따라 전용 사건이 생긴다.</li>
      <li><b>명중</b> 1d100 + 공격 + 카드 보정 &gt; 상대 1d100 + 회피면 명중, 동점은 방어 성공. 일부 카드·무기는 명중을 두 번 굴려 높은 값을 쓴다.</li>
      <li><b>피해</b> 카드의 d6 개수만큼 굴려 합산. 코스트가 높은 카드는 주사위가 많다.</li>
      <li><b>순서</b> 라운드마다 1d100 + 속도. 1등은 빛 +${CFG.orderBonusLight}, 격차 ${CFG.gapFirst} 이상이면 첫 공격 명중 +${CFG.firstHit}. 뒤처지면 다음 라운드 순서 +${CFG.catchupBonus}.</li>
      <li><b>방어 자세</b> 카드를 하나도 내지 않으면 그 라운드는 회피 대신 방어로 받는다. 막으면 피해 ${CFG.guard.guardHit}, 못 막으면 피해 ×${CFG.guard.guardFailMul}. 다음 라운드 명중 +${CFG.guard.nextHit}${CFG.guard.lightUp?`, 그 전투 동안 빛과 빛 최대치 +${CFG.guard.lightUp}(최대 +${CFG.guard.lightUpMax})`:''}${CFG.guard.lightNext?`, 다음 라운드 빛 +${CFG.guard.lightNext}`:''}.</li>
      <li><b>빛</b> 라운드마다 ${CFG.light}. 남은 빛으로 손패 카드를 원하는 순서로 낸다. 남긴 빛은 사라진다.</li>
      <li><b>${D.keywords.bleed.n}</b> 공격할 때마다(빗나가도) 스택만큼 피해, 그 뒤 1 감소. 내가 방어 자세면 절반으로 지혈. <b>${D.keywords.rupture.n}</b> 피격 시 스택만큼 추가 피해, 피격마다 1 감소. <b>화상</b>(레바테인 전용) 받는 피해 ×1.5, 5스택 이상이면 <b>푸른 화염</b> ×2, 라운드 끝에 1 감소. <b>${D.keywords.breath.n}</b> 스택당 치명 ${CFG.breathCritPer}%(×${CFG.critMult}), 명중마다 1 소모.</li>
      <li><b>성장</b> 판정 성공 ${CFG.xp.ok}, 실패 ${CFG.xp.fail}, 판정 없는 선택 ${CFG.xp.plain}, 전투 승리 ${CFG.xp.win} 경험치. 레벨이 오르면 성장표를 1d100으로 세 번 굴려 하나를 고른다.</li>
      <li><b>${T.licensed}</b> 자격 시험, 계약, 견습으로 ${T.rankStart}${T.rankUnit}에 등록된다. 소속이 없거나 ${T.affTypes.office} 소속이면 전투에서 이긴 뒤 소문 판정(1d100 + ${T.paths.fixer} 진로 보정 ≥ ${CFG.winLicenseDc})으로도 등록된다. 고정 전투(${Object.keys(D.fixedFights).join('·')}년차)에서 이기면 2${T.rankUnit}씩 ${T.promote}한다.</li>
      <li><b>손가락 서열</b> ${Object.entries(D.fingers).map(([n,F])=>`${n}: ${F.ranks.map(r=>r.branch?r.branch.map(b=>b.n).join('/'):r.n).join(' → ')}`).join(' · ')}. 고정 전투 승리나 승급 사건으로 오르고, 오를 때마다 보정을 받는다. 서열 ${D.fingerRules.shopTier}단계 이상이면 공방 등급 +1.</li>
      <li><b>${D.pinky.n}</b> 어느 소속에도 겹쳐 붙는 표식. ${D.pinky.e}.</li>
      <li><b>돈과 공방</b> 해마다 소속 봉급(${T.licensed}는 급수 수당 추가), 전투 현상금, 일부 사건으로 ${D.money.unit}을 번다. 공방은 ${D.workshops.map(w=>w.n).join(' · ')} 3등급이고, 소속과 급수에 따라 들어갈 수 있는 등급이 정해진다. 무기·방어구·의수 칸마다 하나씩 맞춘다.</li>
      <li><b>장비 표기</b> 공+N 공격(명중 보정) · HP+N 최대 HP · 회피·속도·판정+N 그 능력치 · D6≥N 피해 주사위 d6을 굴려 N보다 작게 나오면 N으로 친다 · 방어 카드 회피+N 방어 카드를 쓸 때 회피 추가.</li>
      <li><b>승급</b> 전투 승리(초반 ${CFG.promo.gain.early} · 중반 ${CFG.promo.gain.mid} · 보스 ${CFG.promo.gain.boss} · 히든 ${CFG.promo.gain.hidden})와 판정 성공(+${CFG.promo.gain.check})으로 진로의 포인트를 모은다(해결사 ${T.promoPoints} · 협회 ${D.careers.assoc.pts} · 날개 ${D.careers.wing.pts} · 손가락 ${D.careers.finger.pts}). 필요량에 닿으면 다음 해에 심사가 열리고, 성공하면 한 단계 오른다. 필요량은 단계마다 ×${CFG.promo.mult.join(' → ×')}씩 늘어난다. 실패하면 해결사·협회는 포인트 1/4, 날개·손가락은 1/3을 잃고, 날개는 두 번 연속 실패 시 해고, 손가락은 숙청 전투. 맨 위 단계에 오르면 특수 심사(해결사는 특색)가 한 번 열리고, 실패하면 다시 기회가 없다.</li>
      <li><b>${T.hiddenBoss}</b> 조건을 채우면 고정 전투 대신 나타난다. 금기를 어기면 머리의 집행자가, 초대장을 두 번 받아들이면 도서관이, 지령을 거역하면 대행자가 찾아온다. 특색은 ${D.hiddenBosses.find(h=>h.id==='blue').req.replace('rank<=','')}${T.rankUnit} 이상 해결사만 드물게 마주치며, ${D.hiddenBosses.find(h=>h.id==='blue').penalty.fullRank}${T.rankUnit} 미만이면 급수 부족 보정(명중·회피 ${sg(D.hiddenBosses.find(h=>h.id==='blue').penalty.atk)})을 받는다.</li>
      <li><b>${T.titleLabel}</b> ${CFG.colorRank}${T.rankUnit} ${T.licensed} 가운데 특출난 자만 받는다. ${CFG.colorRank}${T.rankUnit}에 오를 때 1d100 + 판정 보정 ≥ ${CFG.colorDc}이면 내 색과 가장 높은 능력치로 이름이 붙는다.</li>
    </ul></details>`;
  }
  /* 플레이테스트 빌드: 종료 시각이 지나면 새 판을 시작할 수 없다 (진행 중인 판은 끝까지) */
  const EXP=typeof window!=='undefined'&&window.CITY_EXPIRES||null;
  const expired=()=>!!EXP&&Date.now()>EXP;
  function vPlaytest(){
    if(!EXP)return '';
    if(expired())return `<div class="panel stack" style="gap:6px;border-color:var(--bleed)"><b>플레이테스트가 끝났습니다</b><span class="small dim">참여해 주셔서 고맙습니다.</span></div>`;
    const left=Math.max(0,Math.ceil((EXP-Date.now())/60000));
    return `<div class="check">플레이테스트 · ${new Date(EXP).toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'})}까지 (약 ${left}분 남음)</div>`;
  }
  function vTitle(){
    return `<div class="stack" style="gap:6px;padding-top:12px"><div class="eyebrow">Project Moon 팬메이드 · 비공식 · 비영리 · v5.4</div>
      <h1>도시의 한 해</h1></div>
      <p class="lead">주사위로 태어나 열여섯 해를 자라고, 그 뒤 최대 ${CFG.years}년을 직접 살아낸다. 한 해에 사건이 하나씩 찾아오고, 가끔은 칼을 뽑아야 한다.</p>
      ${vPlaytest()}
      <div class="stack"><button class="btn primary" data-a="start" ${expired()?'disabled':''}>태어난다</button>
      <button class="btn quiet" data-a="sim"><b>밸런스 측정</b><span class="dim small">자동 전투를 수백 번 돌려 승률을 본다</span></button></div>
      ${vJobs()}${vSettings()}${vRules()}`;
  }
  function vJobs(){
    const u=loadUnlocks();
    const row=k=>`<div class="row between"><span>${T.jobs[k]}</span><span class="chip${u.includes(k)?'':' dim'}">${u.includes(k)?'해금 · 이야기 준비 중':'잠김'}</span></div>`;
    return `<div class="panel stack" style="gap:8px"><span class="eyebrow">히든 직업</span>${Object.keys(T.jobs).map(row).join('')}
      <p class="small dim">금기를 어긴 대가로 찾아오는 ${D.enemies.claw.n}과 ${D.enemies.arbiter.n}를 한 번 이상 이기면 각각 열린다.</p></div>`;
  }
  function vBirth(){
    const b=BC,s=b.stats,fresh=b.fresh&&MODE!=='off';
    const v=r=>`<span class="v" ${fresh?`data-roll="${r}"`:''}>${r}</span>`;
    const row=(lab,r,x)=>`<div class="roll"><span class="mono small dim">${lab}</span>${v(r)}<div class="n"><b>${x.n}</b>${x.t?`<span>${x.t}</span>`:''}<span class="mono small" style="color:var(--gold)">${x.e}</span></div></div>`;
    const sw=D.colors.map((c,i)=>`<button class="sw ${i===b.ci?'on':''}" data-a="color" data-i="${i}" style="background:${c.hex}" aria-label="${c.adj} 색" title="${c.adj}"></button>`).join('');
    const kid=b.kid.length?`<div class="stack" style="gap:6px"><div class="eyebrow">성장기 · 1d100 × ${b.kid.length}</div>
      <div class="panel">${b.kid.map(k=>row(k.age+'세',k.r,k.x)).join('')}</div></div>`:'';
    return `<div class="stack" style="gap:6px"><div class="eyebrow">무작위 출생 · 1d100</div><h2>${b.name?esc(b.name)+'은(는)':'당신은'} 이렇게 태어났다</h2></div>
      <div class="panel stack" style="gap:10px">
        <label class="field" for="nm"><span class="eyebrow">이름</span><input id="nm" maxlength="12" value="${esc(b.name||'')}" placeholder="${T.you}" autocomplete="off"></label>
        <div class="row between"><span class="mono small dim">시드 <b style="color:var(--fg)">${b.seed}</b> · 태어날 때마다 새로 뽑힌다</span></div>
        <div class="row" style="flex-wrap:nowrap"><input id="seedIn" inputmode="numeric" enterkeyhint="go" maxlength="10" placeholder="시드 번호로 다시 태어나기" autocomplete="off" style="flex:1;min-width:0">
          <button class="chip" data-a="seed">이 시드로</button></div>
      </div>
      <div class="panel">${row('출신',b.r.o,b.o)}${row('재능',b.r.t,b.t)}${row('결점',b.r.f,b.f)}${row('무기',b.r.w,b.w)}</div>
      ${b.innate?`<div class="panel stack" style="gap:6px;border-color:var(--gold)"><span class="eyebrow" style="color:var(--gold)">타고난 것 · 1%</span><b class="serif">${esc(D.innate[b.innate].n)}</b><span class="mono small" style="color:var(--gold)">${esc(D.innate[b.innate].e)}</span></div>`:''}
      ${kid}
      <div class="panel stack">
        <div class="row between"><span class="mono small dim">색 · 1d100 → ${b.r.n}</span><b style="color:${b.color}">${D.colors[b.ci].adj} 빛</b></div>
        <div class="sws">${sw}</div>
        <p class="small dim">색은 직접 바꿀 수 있다. 훗날 ${CFG.colorRank}${T.rankUnit} ${T.licensed} 가운데 특출난 자로 인정받으면 이 색과 가장 높은 능력치로 ${T.titleLabel}을 받는다. 예: ${D.colors[b.ci].adj} ${D.titleWords.spd[1]}</p>
        <div class="row between"><span class="eyebrow">${CFG.startAge-1}세의 능력치</span></div>
        <div class="stat"><div><b>${s.maxHp}</b><span>HP</span></div><div><b>${sg(s.atk)}</b><span>공격</span></div><div><b>${sg(s.eva)}</b><span>회피</span></div><div><b>${sg(s.spd)}</b><span>속도</span></div></div>
        <div class="chips">${b.deck.map(id=>`<span class="chip">${D.cards[id].n}</span>`).join('')}</div></div>
      ${b.relicPick?`<div class="panel stack" style="gap:8px"><span class="eyebrow">유물 적성 · 하나를 고른다</span><p class="small dim">적성은 가지고 있으나 온전히 다루기 어렵다.</p>${Object.entries(D.relics).map(([k,r])=>`<button class="btn${UI.relic===k?' primary':''}" data-a="relic" data-i="${k}"><b>${esc(r.n)}</b><span class="mono small" style="color:var(--gold)">${esc(r.e)}</span></button>`).join('')}</div>`:''}
      ${vJobRoll()}${vJobPick()}
      <div class="stack"><button class="btn primary" data-a="live" ${b.relicPick&&!UI.relic?'disabled':''}>${b.relicPick&&!UI.relic?'유물을 먼저 고른다':'이 삶을 산다'}</button>
      <button class="btn quiet" data-a="reroll">다시 태어난다</button></div>${vSettings()}`;
  }
  /* 히든 직업: 이 브라우저에서 해금한 직업만 고를 수 있다 */
  /* 해금한 사람이 평범하게 굴려 출신 1(발톱)·100(조율자)이 나오면 원래 출신과 히든 직업 중 고른다 */
  function vJobRoll(){
    const b=BC,u=loadUnlocks();if(UI.job&&!UI.jobAuto)return '';
    const k=Object.keys(D.hiddenJobs).find(j=>u.includes(j)&&D.hiddenJobs[j].roll===(UI.jobAuto?D.hiddenJobs[UI.job].roll:b.r.o));if(!k)return '';
    const J=D.hiddenJobs[k],base=UI.jobAuto?UI.jobBase:b.o.n;
    return `<div class="panel stack" style="gap:8px;border-color:var(--gold)"><span class="eyebrow">출신 ${J.roll} · 히든 직업을 고를 수 있다</span>
      <div class="row" style="gap:8px"><button class="btn${!UI.jobAuto?' primary':''}" style="flex:1" data-a="jobroll" data-i="">${esc(base)}</button><button class="btn${UI.jobAuto?' primary':''}" style="flex:1" data-a="jobroll" data-i="${k}">${esc(J.n)}</button></div></div>`;
  }
  function vJobPick(){
    const u=loadUnlocks().filter(k=>D.hiddenJobs[k]);if(!u.length)return '';
    const cur=UI.job&&!UI.jobAuto&&u.includes(UI.job)?UI.job:null;
    return `<div class="panel stack" style="gap:8px;border-color:var(--gold)"><span class="eyebrow">히든 직업 · 해금됨</span>
      <p class="small dim">머리 소속으로 시작한다. 승급과 해결사 등록은 없고, 전용 의뢰가 찾아온다.</p>
      <button class="btn${!cur?' primary':''}" data-a="job" data-i="">평범하게 태어난다</button>
      ${u.map(k=>{const J=D.hiddenJobs[k];return `<button class="btn${cur===k?' primary':''}" data-a="job" data-i="${k}"><b>${esc(J.n)}</b><span class="small">${esc(J.t)}</span><span class="mono small" style="color:var(--gold)">${esc(J.e)}</span></button>`}).join('')}</div>`;
  }
  function vEvent(){
    if(UI.omen)return vOmen();
    if(UI.fight){
      const e=D.enemies[UI.fight];
      const rule=(D.hiddenBosses||[]).find(h=>h.id===UI.fight),pen=rule&&rule.penalty&&!(G.ch.licensed&&G.ch.rank<=rule.penalty.fullRank)?rule.penalty:null;
      const enc=UI.enc&&UI.enc.hidden?`<div class="check"><b>${T.hiddenBoss}</b>${pen?` · <span class="bad">${pen.label} · 명중 ${sg(pen.atk)} · 회피 ${sg(pen.eva)} (${pen.fullRank}${T.rankUnit}이면 보정 없음)</span>`:''}</div>`:UI.enc&&UI.enc.roll?`<div class="check">${UI.enc.label} · 1d100 ${UI.enc.roll} → <b>${e.n}</b></div>`:'';
      const avoid=UI.avoidText?`<p class="small dim">${UI.avoidText}</p>`:'';UI.avoidText=null;
      return `${vHud()}<div class="stack" style="gap:8px"><div class="eyebrow">${E.age(G)}세의 해 · 전투</div>${avoid}${enc}<h2 style="color:${e.color}">${e.n}</h2><p class="lead">${e.intro}</p></div>
        <button class="btn primary" data-a="fight">맞선다</button>`;
    }
    const ev=UI.ev,ch=G.ch;
    const btns=E.options(G,ev).map(({c,i})=>{
      let hint=c.h||'판정 없음 · 결과 확정';
      if(c.check){const pm=E.pathMod(ch,c.check);hint=`${c.check.s?STAT[c.check.s]+' 판정':'운 판정'} · 1d100 ${sg(E.checkMod(ch,c.check))} ≥ ${E.checkDc(ch,c.check)}${pm?` (출신 ${T.paths[c.check.path]} 보정 +${pm})`:''}${c.h?' · '+c.h:''}`}
      return `<button class="btn" data-a="choose" data-i="${i}"><b>${c.l}</b><span class="mono small dim">${hint}</span></button>`;
    }).join('');
    return `${vHud()}<div class="stack" style="gap:8px"><div class="eyebrow">${E.age(G)}세의 해</div><h2>${ev.t}</h2><p class="lead">${ev.x}</p></div><div class="stack">${btns}</div>`;
  }
  function nextLabel(){
    if(G.ch.lvPend>0)return '성장 굴림';
    if(UI.pending)return '맞선다';
    return G.year>=E.lastYear(G)?'결말을 본다':'다음 해로';
  }
  function vResult(){
    const r=UI.res,an=r.anim&&r.roll;
    const roll=r.roll?`<div class="check">1d100 ${r.roll.r} ${sg(r.roll.mod)} = ${r.roll.tot} / 난이도 ${r.roll.dc} → <b class="${r.roll.ok?'good':'bad'}">${r.roll.ok?'성공':'실패'}</b></div>`:'';
    const die=an?`<div class="row"><div class="die big" id="rd" style="border-color:var(--gold)"><b id="rdb">–</b></div><span class="mono small dim">1d100 · 난이도 ${r.roll.dc}</span></div><button class="btn primary" id="tapBtn" data-a="tap" hidden>주사위를 굴린다</button>`:'';
    const tt=r.title?`<div class="panel stack" style="border-color:${G.ch.color}"><span class="eyebrow">${r.tlabel||T.titleLabel}</span><h2 style="color:${G.ch.color}">${r.title}</h2></div>`:'';
    return `${die}<div class="stack" id="after"${an?' style="visibility:hidden"':''}>${vHud()}${roll}<p>${r.t}</p>${tt}<div class="chips">${r.chips.map(x=>`<span class="chip">${x}</span>`).join('')}</div>
      ${G.ch.egoPick?vEgoPick():G.ch.titlePick?vTitlePick():`<button class="btn primary" data-a="flow">${nextLabel()}</button>`}</div>`;
  }
  /* 특색 이름: 색은 고정, 뒤 단어(2~3글자)를 직접 적는다 */
  const TW_OK=/^[가-힣A-Za-z0-9]{2,3}$/;
  function vEgoPick(){
    const X=CFG.mind.ego,ty=UI.egoType||'atk';
    return `<div class="panel stack" style="gap:8px;border-color:var(--gold)"><span class="eyebrow">E.G.O 개화</span>
      <p class="small">마음이 무너지기 직전, 그것을 붙잡은 모양이 힘이 되었다. 종류와 이름을 정한다.</p>
      <div class="row" style="gap:8px">${['atk','def'].map(k=>`<button class="btn ${ty===k?'primary':'quiet'}" style="flex:1" data-a="egotype" data-i="${k}">${X[k].n}<br><span class="small">${k==='atk'?`명중 +${X.atk.hit} · 정신력 ${X.atk.floor} 밑으로 안 떨어짐`:`체력 +${X.def.hp} · 정신력 ${X.def.floor} 밑으로 안 떨어짐`}</span></button>`).join('')}</div>
      <div class="row"><span class="small">이름</span><input id="egoname" maxlength="5" value="${esc(UI.egoName||'')}" autocomplete="off" placeholder="1~5글자" style="width:9em"></div>
      <span class="small dim">게임에 있는 물건·전리품·유물·카드 이름은 쓸 수 없다.</span>
      <span class="small bad">${UI.egoErr||''}</span>
      <button class="btn primary" data-a="egoset">이 E.G.O로 정한다</button></div>`;
  }
  function vTitlePick(){
    const ch=G.ch,adj=D.colors[ch.ci].adj,cur=ch.title.slice(adj.length+1);
    return `<div class="panel stack" style="gap:8px;border-color:${ch.color}"><span class="eyebrow">${T.titleLabel} 이름 정하기</span>
      <p class="small">도시가 당신을 부를 이름이다. 색 뒤에 붙을 말을 2~3글자로 적는다.</p>
      <div class="row"><b class="serif" style="color:${ch.color}">${esc(adj)}</b><input id="tw" maxlength="3" value="${esc(cur)}" autocomplete="off" style="width:7em"></div>
      <span class="small bad" id="twerr">${UI.twErr||''}</span>
      <button class="btn primary" data-a="tname">이 이름으로 정한다</button></div>`;
  }
  function vLevel(){
    const ch=G.ch,fresh=UI.lvFresh&&MODE!=='off';
    const opts=ch.lvOpts.map((o,i)=>`<button class="btn grow" data-a="grow" data-i="${i}"><span class="row"><span class="v" ${fresh?`data-roll="${o.r}"`:''}>${o.r}</span><b>${o.g.n}</b></span><span class="mono small" style="color:var(--gold)">${o.g.e}</span></button>`).join('');
    return `${vHud()}<div class="stack" style="gap:6px"><div class="eyebrow">레벨 업 · Lv ${ch.lv-ch.lvPend+1} · 성장표 1d100 ×3</div><h2>한 단계 자랐다</h2>
      <p class="lead small">굴려 나온 세 가지 중 하나를 고른다.</p></div><div class="stack">${opts}</div>`;
  }
  /* 전투 화면을 한 화면 안에 들어오게 줄인 배치. 휴대폰에서 먼저 만들었고 PC도 같은 배치를 쓴다
     (예전 PC 배치로 되돌리려면 여기를 matchMedia('(max-width: 600px)')로 바꾼다) */
  const isMobile=()=>true;
  function entHtml(side,X,v,compact){
    const col=X.color;PREV[side]={...v};
    const head=compact?`<div class="entname"><span class="swatch" style="background:${col}"></span><b class="serif" style="color:${col}">${esc(X.name)}</b></div><span class="mono small" id="hp-${side}">HP ${v.hp}/${X.maxHp}${side==='P'?` · 정신 ${G.ch.mind}`:''}</span>`
      :`<div class="row between"><div class="row"><span class="swatch" style="background:${col}"></span><b class="serif" style="color:${col}">${esc(X.name)}</b></div><span class="mono small" id="hp-${side}">HP ${v.hp}/${X.maxHp}${side==='P'?` · 정신 ${G.ch.mind}`:''}</span></div>`;
    return `<div class="panel stack ent${compact?' compact':''}" id="ent-${side}" style="background:color-mix(in srgb,${col} 9%,var(--panel));border-color:color-mix(in srgb,${col} 45%,var(--line))">
      ${head}
      <div class="bar" id="bar-${side}"><i style="width:${clamp(v.hp/X.maxHp*100,0,100)}%;background:${col}"></i></div>
      <div class="chips" id="chips-${side}">${stacks(v)}</div>${side==='E'&&X.passive?`<div class="small" style="color:var(--gold)">패시브 · ${esc(X.passive.n)}${X.passive.id==='recital'?` (악장 ${X.recital||0}/${X.passive.every})`:''}${X.maskOn?' <b>(이번 라운드 발동)</b>':''} <span class="dim">· ${esc(X.passive.d)}</span></div>`:''}</div>`;
  }
  function arenaHtml(play){
    if(!play)return MODE==='off'?'':`<div class="arena"><div class="alabel">손패를 고르고 행동 개시를 누르면 주사위가 굴러간다</div></div>`;
    return `<div class="arena"><div class="alabel" id="alabel"></div><div class="dice">
      <div class="dwrap"><span class="dcap" id="capA">명중 1d100</span><b class="dfinal" id="fA">&nbsp;</b><div class="die" id="dA"><b>–</b></div><span class="dsum" id="sA"></span></div>
      <span class="vs">vs</span>
      <div class="dwrap"><span class="dcap" id="capD">회피 1d100</span><b class="dfinal" id="fD">&nbsp;</b><div class="die" id="dD"><b>–</b></div><span class="dsum" id="sD"></span></div>
      <div class="dwrap" id="dmgw" hidden><span class="dcap">피해 d6</span><b class="dfinal bad" id="fM">&nbsp;</b><div class="d6s" id="dmgd"></div><span class="dsum" id="sM"></span></div>
    </div><div class="verdict" id="verdict"></div><button class="btn primary" id="tapBtn" data-a="tap" hidden>주사위를 굴린다</button></div>`;
  }
  function vOrder(compact){
    const li=!compact?`<ol class="order">${C.order.map((X,i)=>`<li><span class="swatch" style="background:${X.color}"></span><b>${i+1}. ${esc(X.name)}</b>
      ${X.lead?`<span class="chip">빛 +${CFG.orderBonusLight}</span>`:''}${X.fsOn?'<span class="chip">선제</span>':''}
      <span class="mono small dim">${X.r}${X.spd?sg(X.spd):''}${X.cu?' +'+CFG.catchupBonus:''} = ${X.tot}</span></li>`).join('')}</ol>`
      :C.order.map((X,i)=>`<span class="ordx"><b style="color:${X.color}">${i+1}. ${esc(X.name)}</b> <span class="mono small dim">${X.tot}</span>${X.lead?` <span class="chip">빛 +${CFG.orderBonusLight}</span>`:''}${X.fsOn?' <span class="chip">선제</span>':''}</span>`).join('<span class="dim"> → </span>');
    const pen=C.penalty?`<div class="mono small bad">${C.penalty.label} · 내 명중 ${sg(C.penalty.atk)} · 회피 ${sg(C.penalty.eva)}</div>`:'';
    if(compact){
      /* 휴대폰: 접을 수 있는 라운드 패널. 접혀 있어도 요약 줄(재생 중이면 지금 행동)이 보인다 */
      const n=E.queue(C,PLAYING?UI.lastPP:UI.sel.map(i=>D.cards[C.P.hand[i]]),C.ePlan).length;
      return `<details class="panel roundbox"${UI.roundOpen?' open':''}><summary><span class="eyebrow">${C.round}라운드</span> · 선공 <b style="color:${C.order[0].color}">${esc(C.order[0].name)}</b> · 행동 ${n}개<span class="qnow" id="qnow"></span></summary>
        <div class="stack" style="gap:6px;margin-top:10px"><span class="eyebrow">순서 1d100 + 속도</span><div class="ordline">${li}</div>${pen}${vQueue()}</div></details>`;
    }
    return `<div class="panel stack" style="gap:6px"><span class="eyebrow">${C.round}라운드 · 순서 1d100 + 속도</span>${li}${pen}${vQueue()}</div>`;
  }
  /* 이번 라운드에 실제로 발동하는 순서. 적 카드는 미리 공개된 의도, 내 카드는 고른 대로 */
  function vQueue(){
    const pp=PLAYING?UI.lastPP:UI.sel.map(i=>D.cards[C.P.hand[i]]),q=E.queue(C,pp,C.ePlan);
    const other=s=>s==='P'?'E':'P';
    const what=st=>{const c=st.card;
      if(c.t==='def')return `${who(st.side)}의 <b>${esc(c.n)}</b> <span class="dim">· 이번 라운드 회피 +${(c.eva||CFG.defBonus)+C[st.side].defUp}</span>`;
      if(c.t==='buff')return `${who(st.side)}의 <b>${esc(c.n)}</b> <span class="dim">· ${(c.kw||[]).map(([k,n,to])=>`${to==='s'?'자신':C[other(st.side)].name} ${D.keywords[k].n} +${n}`).join(', ')}</span>`;
      const kw=(c.kw||[]).map(([k,n,to])=>`<span style="color:${kwc(k)}">${to==='s'?'자신 ':''}${D.keywords[k].n} +${n}</span>`).join(' · ');
      return `${who(st.side)}의 <b>${esc(c.n)}</b> → ${who(other(st.side))} <span class="dim">· ${cardLine(c)}${kw?' · 명중 시 '+kw:''}</span>`};
    const items=q.map((st,i)=>`<li data-i="${i}" class="${st.side==='E'?'foe':''}"><span class="qn">${i+1}</span><span>${what(st)}</span></li>`).join('');
    const g=CFG.guard;
    const hint=!PLAYING&&!UI.sel.length?`<li><span class="qn">·</span><span>${who('P')}의 <b>방어 자세</b> <span class="dim">· 카드를 하나도 고르지 않으면 이번 라운드는 방어 판정(막으면 피해 ${g.guardHit}, 못 막으면 피해 ×${g.guardFailMul}, 소수점 버림)${g.bleedCut&&C.P.bleed?` · ${D.keywords.bleed.n} ${C.P.bleed} → ${Math.floor(C.P.bleed*g.bleedCut)}`:''} · 다음 라운드 명중 +${g.nextHit}${g.lightUp?` · 전투 동안 빛 +${g.lightUp}`:''}${g.lightNext?` · 다음 라운드 빛 +${g.lightNext}`:''}</span></span></li>`:'';
    return `<span class="eyebrow" style="margin-top:6px">이번 라운드 행동 순서 · ${who('E')}의 의도 공개</span><ol class="queue" id="queue">${items}${hint}</ol>`;
  }
  function vCombat(){
    const {P,E:X}=C;
    const logLines=arr=>arr.map(l=>`<div class="${l.t}">${esc(l.s)}</div>`).join('');
    const M=isMobile();UI.wasMobile=M;
    const duo=v=>`<div class="duo">${entHtml('E',X,v.E,true)}${entHtml('P',P,v.P,true)}</div>`;
    const logBox=inner=>M?`<details class="logbox"${UI.logOpen?' open':''}><summary>전투 기록</summary><div class="log" id="log">${inner}</div></details>`:`<div class="log" id="log">${inner}</div>`;
    const autoOff=FIGHT==='auto'?'<button class="btn quiet" data-a="fightmode" data-i="pick">다음 라운드부터 직접 고르기</button>':'';
    if(PLAYING){
      const lg=logBox(logLines(C.log.slice(0,C.logBefore).slice(-40)));
      return M?`${duo(PRE)}${arenaHtml(true)}${vOrder(true)}<button class="btn quiet" data-a="skip">연출 건너뛰기</button>${lg}${autoOff}`
        :`${entHtml('E',X,PRE.E)}${arenaHtml(true)}${entHtml('P',P,PRE.P)}${vOrder()}${lg}<button class="btn quiet" data-a="skip">연출 건너뛰기</button>${autoOff}`;
    }
    const log=logBox(logLines(C.log.slice(-60))||'<div class="sys">전투가 시작되었다.</div>');
    if(C.over){
      const w=C.over==='win';
      return `${M?duo({E:X,P}):entHtml('E',X,X)+entHtml('P',P,P)}<div class="panel stack"><h2 class="${w?'good':'bad'}">${w?esc(X.name)+'이(가) 쓰러졌다':'당신은 쓰러졌다'}</h2>
        <button class="btn primary" data-a="fin">${w?'전리품을 챙긴다':'결말을 본다'}</button></div>${log}`;
    }
    const cost=UI.sel.reduce((a,i)=>a+D.cards[P.hand[i]].c,0),left=P.light-cost;
    const cards=P.hand.map((id,i)=>{
      const c=D.cards[id],si=UI.sel.indexOf(i),lk=i===P.locked,dis=lk||(si<0&&c.c>left);
      return `<button class="card ${si>=0?'sel':''}" data-a="pick" data-i="${i}" ${dis?'disabled':''}>
        <span class="cost">${c.c}</span>${si>=0?`<em class="ord">${si+1}</em>`:''}
        <span class="nm">${c.n}${lk?` <span class="bad small">잠김 · ${esc(C.E.passive.n)}</span>`:''}</span>${c.t==='atk'?`<span class="mono small" style="color:var(--gold)">최종 명중 ${sg(P.atk+c.hit+(P.passHit||0))}${P.fsOn&&P.fs?' (+선제 '+CFG.firstHit+')':''}</span>`:''}<span class="cd">${cardLine(c)}</span>
        ${c.kw?`<span class="chips">${kwChips(c)}</span>`:''}</button>`;
    }).join('');
    return `${M?duo({E:X,P})+vOrder(true):entHtml('E',X,X)+arenaHtml(false)+entHtml('P',P,P)+vOrder()+log}
      <div class="row between"><span class="eyebrow">손패 · 고른 순서대로 위 순서에 들어간다</span><span class="mono" style="color:var(--gold)">빛 ${left}/${P.light}</span></div>
      <div class="hand">${cards}</div>
      ${FIGHT==='auto'?`<div class="check">자동 전투 중 · 카드를 알아서 고르고 진행한다</div><button class="btn quiet" data-a="fightmode" data-i="pick">직접 고르기로 바꾸기</button>`
        :`<button class="btn primary" data-a="go">${UI.sel.length?'행동 개시':'카드 없이 방어 자세'}</button><button class="btn quiet" data-a="fightmode" data-i="auto">자동 전투로 바꾸기</button>`}
      ${M?`${log}<details class="logbox"><summary>설정 (테마 · 연출 · 전투 진행)</summary><div class="stack" style="margin-top:10px">${vSettings()}</div></details>`:vSettings()}`;
  }
  /* 엔딩: 진로별 최종 자리와 칭호, 사망이면 원인 */
  function careerLine(c){
    if(c.job)return T.jobs[c.job]+(c.title?' · '+esc(c.title):'');
    if(c.aff&&c.fr)return `${esc(c.aff.name)} · ${esc(c.fr.n)}${c.title?' · '+esc(c.title):''}`;
    if(c.licensed)return E.rankLabel(c)+(c.aff?' · '+esc(c.aff.name):'');
    return c.aff?esc(c.aff.name):T.unnamed;
  }
  function endLead(c,w){
    if(c.job)return w?'머리의 명령은 끝까지 집행되었다. 당신이 지나간 자리마다 도시는 조금 더 조용해졌다.':'집행자 하나가 돌아오지 않았다. 머리는 다음 이름을 부른다.';
    const k=E.career(c);
    if(!w)return c.title?'칭호는 남았지만, 그 이름을 부를 사람은 이제 없다.'
      :{fixer:'의뢰서 한 장이 주인 없이 사무소 책상에 남았다.',assoc:'협회 명부에서 이름 하나에 줄이 그어졌다.',wing:'담장 안의 자리는 다음 날 다른 사람으로 채워졌다.',finger:'조직은 빈자리를 오래 두지 않는다.'}[k]
      ||'이름을 부르는 사람은 없었다. 가로등만 계속 깜빡였다.';
    if(c.title)return {fixer:`도시는 이제 당신을 "${esc(c.title)}"(이)라고 부른다. 뒷골목 아이들이 그 색을 흉내 낸다.`,assoc:'본부의 결재 서류 맨 위에 당신의 도장이 찍힌다.',wing:'담장 가장 안쪽 문이 당신의 출입증으로 열린다.',finger:'조직의 누구도 당신 앞에서 고개를 들지 않는다.'}[k]||'도시는 당신의 이름을 기억한다.';
    return {fixer:'은퇴 서류에 마지막 급수를 적었다. 도시는 여전히 그 자리에 있다.',assoc:'협회 명부에 근속 기록이 길게 남았다.',wing:'날개의 둥지에서 마지막 출근을 마쳤다.',finger:'조직을 떠나지 않고 끝까지 버텼다. 그것만으로도 드문 일이다.'}[k]
      ||'도시는 여전히 그 자리에 있고, 당신은 한 해를 더 살 수 있다.';
  }
  function vEnd(){
    const c=G.ch,w=UI.endWin,dt=UI.death,X=CFG.endless,gi=E.gradeAt(G.year),tr=w&&UI.trueEnd;
    return `<div class="stack" style="gap:8px;padding-top:12px"><div class="eyebrow">${tr?'불순물을 넘어섰다':w?CFG.years+'년을 살아냈다':dt&&dt.cause==='distort'?'당신은 뒤틀렸다':'도시는 당신을 기억하지 않는다'} · ${E.age(G)}세</div>
      <h1 style="color:${c.color}">${esc(c.name||careerLine(c))}</h1>
      ${c.name?`<div class="mono small" style="color:${c.color}">${careerLine(c)}</div>`:''}
      ${c.title?`<div><span class="chip" style="color:var(--gold);border-color:var(--gold)">${c.titleKind==='top'?'칭호':T.titleLabel} · ${esc(c.title)}</span></div>`:''}
      ${!w&&dt?`<div class="mono small bad">${dt.year}년차 · ${dt.cause==='distort'?'뒤틀림':dt.cause==='mind'?'정신 붕괴로 쓰러졌다':esc(dt.foe)+'에게 쓰러졌다'}${dt.hidden?' (히든 보스)':''}</div>`:''}
      <div class="mono small dim">시드 ${c.seed}</div>
      <p class="lead">${dt&&dt.cause==='distort'?'당신의 모양을 한 무언가가 골목에 남았다. 사람들은 그것을 더 이상 당신의 이름으로 부르지 않는다.':dt&&dt.cause==='mind'?'몸은 멀쩡했지만, 마음이 먼저 꺼졌다.':tr?'도시가 붙일 수 있는 가장 높은 이름 너머까지 걸어갔다. 그 뒤로 당신을 부르는 이름은 도시의 어느 장부에도 맞지 않았다.':endLead(c,w)}</p>
      ${vRecord(c,w,gi)}
      ${c.beaten.length?`<div class="panel stack" style="gap:6px"><span class="eyebrow">${T.hiddenWin}</span><b>${c.beaten.map(id=>D.enemies[id].n).join(' · ')}</b>${UI.endText?`<p class="small">${UI.endText}</p>`:''}${c.unlocks.length?`<p class="small" style="color:var(--gold)">해금 · ${c.unlocks.map(k=>T.jobs[k]).join(', ')}</p>`:''}</div>`:''}</div>
      <div class="panel stack"><div class="stat"><div><b>${c.lv}</b><span>레벨</span></div><div><b>${sg(c.stats.atk)}</b><span>공격</span></div><div><b>${sg(c.stats.eva)}</b><span>회피</span></div><div><b>${sg(c.stats.spd)}</b><span>속도</span></div></div>
      <div class="chips">${c.deck.map(id=>`<span class="chip">${D.cards[id].n}</span>`).join('')}</div>
      <div class="mono small dim">${c.o.n} · ${c.t.n} · ${c.f.n} · ${c.w.n}${c.aff?' · '+esc(c.aff.name):c.licensed?' · '+T.licensed:''}</div></div>
      ${w&&!G.endless?`<div class="panel stack" style="gap:6px"><span class="eyebrow">무한런</span><p class="small">여기서 끝내도 된다. 계속 살아가면 ${X.span}년마다 도시의 위협 등급이 오른다. ${X.grades.join(' → ')}. 마지막 등급을 넘기면 진짜 결말이다. 도중에 쓰러지면 거기까지가 기록이 된다.</p><button class="btn primary" data-a="endless">계속 살아간다</button></div>`:''}
      <div class="row" style="gap:8px"><button class="btn quiet" style="flex:1" data-a="share">기록 공유</button><button class="btn quiet" style="flex:1" data-a="saveimg">이미지로 저장</button></div>
      ${UI.imgUrl?`<p class="small dim">저장이 막힌 환경이다. 아래 이미지를 길게 눌러 저장한다.</p><img src="${UI.imgUrl}" alt="엔딩 기록 이미지" style="width:100%;border-radius:8px">`:''}
      ${UI.shareMsg?`<p class="small dim">${UI.shareMsg}</p>`:''}${UI.shareText?`<textarea id="shareBox" readonly rows="9" style="width:100%;font:inherit;font-size:13px">${esc(UI.shareText)}</textarea>`:''}
      <button class="btn ${w&&!G.endless?'quiet':'primary'}" data-a="start">다시 태어난다</button><button class="btn quiet" data-a="title">처음 화면</button>`;
  }
  /* 공유용 기록 글 */
  function shareText(){
    const c=G.ch,w=UI.endWin,dt=UI.death,X=CFG.endless,gi=E.gradeAt(G.year),lived=w?G.year:Math.max(0,G.year-1);
    const head=w&&UI.trueEnd?'불순물을 넘어섰다':w?CFG.years+'년을 살아냈다':dt&&dt.cause==='distort'?'나는 뒤틀렸다':'도시는 나를 기억하지 않는다';
    const foes=[...c.beaten,...(c.minis||[])].map(id=>D.enemies[id].n);
    const url=/^https?:/.test(location.href)&&!/claude\.ai|claudeusercontent/.test(location.href)?location.href.split('#')[0]:'https://cityyear-fanmade.github.io/city-year/';
    return [`[도시의 한 해] ${head}`,(c.name?`${c.name} · `:'')+careerLine(c).replace(/<[^>]*>/g,'')+(c.title?` · ${c.title}`:''),
      `${lived}년 · ${E.age(G)}세`+(G.endless&&gi>=0?` · 위협 등급 ${X.grades[gi]}`:''),
      !w&&dt?`${dt.year}년차 · ${dt.cause?dt.foe:dt.foe+'에게 쓰러짐'}`:null,c.ego?`E.G.O · ${c.ego.n}`:null,c.innate?`타고난 것 · ${innateName(c)}`:null,foes.length?`쓰러뜨린 상대 · ${foes.join(', ')}`:null,
      `${c.o.n} · ${c.t.n} · ${c.f.n} · Lv ${c.lv}`,`시드 ${c.seed}`,url].filter(Boolean).join('\n');
  }
  /* 엔딩 카드 이미지 (1080×1350): 캔버스에 직접 그린다. 외부 라이브러리 없음 */
  async function endCard(){
    try{await Promise.all(['900 96px "Noto Serif KR"','600 36px "Noto Serif KR"','500 34px "Noto Sans KR"','400 30px "IBM Plex Mono"'].map(f=>document.fonts.load(f,'도시가나')));await document.fonts.ready}catch(e){}
    const c=G.ch,w=UI.endWin,dt=UI.death,X=CFG.endless,gi=E.gradeAt(G.year),lived=w?G.year:Math.max(0,G.year-1);
    const W=1080;const paint=(g,H)=>{
    const serif='"Noto Serif KR",serif',sans='"Noto Sans KR",sans-serif',mono='"IBM Plex Mono",monospace';
    const col=c.color||'#c9a961',gold='#c9a961',ink='#e8e4da',dim='#8b8778';
    g.fillStyle='#0d0d0f';g.fillRect(0,0,W,H);
    g.strokeStyle=gold;g.lineWidth=2;g.strokeRect(40,40,W-80,H-80);g.lineWidth=1;g.strokeRect(52,52,W-104,H-104);
    g.fillStyle=col;g.fillRect(52,52,W-104,10);
    const T_=(t,x,y,f,cl,al)=>{g.font=f;g.fillStyle=cl;g.textAlign=al||'left';g.fillText(t,x,y)};
    const fit=(t,max,size,fam,weight)=>{let z=size;do{g.font=`${weight||''} ${z}px ${fam}`;z-=2}while(g.measureText(t).width>max&&z>20);return g.font};
    const head=w&&UI.trueEnd?'불순물을 넘어섰다':w?CFG.years+'년을 살아냈다':dt&&dt.cause==='distort'?'당신은 뒤틀렸다':'도시는 당신을 기억하지 않는다';
    T_('도시의 한 해',W/2,140,`500 34px ${mono}`,gold,'center');
    T_(head,W/2,200,`400 30px ${sans}`,w?gold:'#c46a5a','center');
    const nm=c.name||careerLine(c).replace(/<[^>]*>/g,'').replace(/&amp;/g,'&');
    g.font=fit(nm,W-200,96,serif,'900');g.fillStyle=col;g.textAlign='center';g.fillText(nm,W/2,330);
    let y=400;
    if(c.name){g.font=fit(careerLine(c).replace(/<[^>]*>/g,''),W-200,34,sans,'500');g.fillStyle=col;g.fillText(careerLine(c).replace(/<[^>]*>/g,''),W/2,y);y+=56}
    if(c.title){T_('『'+c.title+'』',W/2,y,`700 40px ${serif}`,gold,'center');y+=60}
    g.strokeStyle='#2c2b30';g.beginPath();g.moveTo(140,y);g.lineTo(W-140,y);g.stroke();y+=70;
    const rows=[['산 햇수',`${lived}년 · ${E.age(G)}세`]];
    if(G.endless)rows.push(['위협 등급',gi>=0?X.grades[gi]:'—']);
    if(!w&&dt)rows.push(['마지막',`${dt.year}년차 · ${dt.foe}`]);
    if(c.innate)rows.push(['타고난 것',innateName(c)]);
    if(c.ego)rows.push(['E.G.O',`${c.ego.n} · ${CFG.mind.ego[c.ego.type].n}`]);
    rows.push(['정신력',`${c.mind}/${CFG.mind.max}`]);
    rows.push(['레벨',`Lv ${c.lv} · 공격 ${sg(c.stats.atk)} · 회피 ${sg(c.stats.eva)} · 속도 ${sg(c.stats.spd)}`]);
    rows.push(['출신',`${c.o.n} · ${c.t.n}`]);
    for(const [k,v] of rows){T_(k,140,y,`400 32px ${sans}`,dim);g.font=fit(v,W-480,36,sans,'500');g.fillStyle=ink;g.textAlign='right';g.fillText(v,W-140,y);y+=72}
    const foes=[...c.beaten,...(c.minis||[])].map(id=>D.enemies[id].n);
    if(foes.length){y+=10;T_('쓰러뜨린 이름난 상대',W/2,y,`400 30px ${sans}`,gold,'center');y+=58;
      let line='';const lines=[];for(const f of foes){const t=line?line+' · '+f:f;g.font=`500 36px ${serif}`;if(g.measureText(t).width>W-240){lines.push(line);line=f}else line=t}lines.push(line);
      for(const l of lines.slice(0,3)){T_(l,W/2,y,`600 36px ${serif}`,ink,'center');y+=54}}
    if(!H)return y;
    T_(`시드 ${c.seed}`,W/2,H-170,`400 30px ${mono}`,dim,'center');
    T_('cityyear-fanmade.github.io/city-year',W/2,H-120,`400 28px ${mono}`,gold,'center');
    T_('Project Moon 팬메이드 · 비공식 · 비영리',W/2,H-78,`400 24px ${sans}`,dim,'center');
    };
    const m=document.createElement('canvas').getContext('2d'),H=Math.max(1080,paint(m,0)+300);
    const cv=document.createElement('canvas');cv.width=W;cv.height=H;paint(cv.getContext('2d'),H);
    return cv;
  }
  /* 엔딩 기록: 산 햇수, 도달 등급, 쓰러뜨린 상대 */
  function vRecord(c,w,gi){
    const X=CFG.endless,lived=w?G.year:Math.max(0,G.year-1),mini=(c.minis||[]).map(id=>D.enemies[id].n);
    const grade=G.endless?(gi>=0?X.grades[gi]:'—'):'—';
    const line=G.endless?(w?`${X.grades.length}개 위협 등급을 모두 넘겼다.`:`${grade} 등급에서 멈췄다.`):w?`${CFG.years}년을 끝까지 버텼다.`:`${CFG.years}년 중 ${lived}년을 살았다.`;
    return `<div class="panel stack" style="gap:6px"><span class="eyebrow">기록</span>
      <div class="row between"><span>산 햇수</span><b class="mono">${lived}년 · ${E.age(G)}세</b></div>
      ${G.endless?`<div class="row between"><span>도달한 위협 등급</span><b class="mono">${grade}</b></div>`:''}
      <div class="row between"><span>최종 자리</span><b class="mono">${careerLine(c)}</b></div>
      ${mini.length?`<div class="row between"><span>쓰러뜨린 이름난 상대</span><b class="mono">${mini.join(' · ')}</b></div>`:''}
      <p class="small dim">${line}</p></div>`;
  }
  function vSim(){
    const s=SIM,pc=x=>Math.round(x*100)+'%';
    return `<div class="stack" style="gap:6px"><div class="eyebrow">밸런스 측정 · 각 ${s.n}회</div><h2>자동 전투 결과</h2></div>
      <div class="panel tbl"><table><thead><tr><th>적</th><th>승률</th><th>평균 라운드</th><th>승리 시 잔여 HP</th></tr></thead><tbody>
      ${s.rows.map(r=>`<tr><td>${r.n}</td><td>${pc(r.win)}</td><td>${r.rounds.toFixed(1)}</td><td>${r.left.toFixed(0)}</td></tr>`).join('')}</tbody></table></div>
      <div class="panel stack"><div class="row between"><span>연속 ${s.chainIds.length}전 클리어</span><b class="mono" style="color:var(--gold)">${pc(s.chain)}</b></div>
      <div class="row between"><span>연속 ${s.chainIds.length}전 · 성장 반영</span><b class="mono" style="color:var(--gold)">${pc(s.grown)}</b></div>
      <p class="small dim">무작위 캐릭터(성장기 포함), 카드는 손패에서 무작위로 낸다. 전투 사이 HP ${CFG.chainHeal} 회복. 더 많이 돌리려면 터미널에서 npm run sim -- --n 2000</p></div>
      <button class="btn primary" data-a="sim">다시 측정</button><button class="btn quiet" data-a="title">돌아가기</button>`;
  }
  function render(){
    const s=UI.screen;
    const h={shopask:vShopAsk,title:vTitle,birth:vBirth,event:vEvent,result:vResult,level:vLevel,combat:vCombat,end:vEnd,sim:vSim,shop:vShop}[s]();
    const tab=`<span class="skin-tab">${SKIN_TAB[SKIN]}</span>`;
    app.innerHTML=`<div class="wrap">${tab}${h}</div>`;
    const lg=$('log');if(lg)lg.scrollTop=lg.scrollHeight;
    if(s!==lastScreen){window.scrollTo(0,0);lastScreen=s}
    if(s==='birth'&&BC.fresh&&MODE!=='off'){BC.fresh=false;rollAnim()}
    if(s==='level'&&UI.lvFresh&&MODE!=='off'){UI.lvFresh=false;rollAnim()}
    if(s==='result'&&UI.res.anim&&UI.res.roll){UI.res.anim=false;resultAnim()}
    if(s==='combat'&&FIGHT==='auto'&&!PLAYING&&C&&!C.over&&!UI.autoTimer)
      UI.autoTimer=setTimeout(()=>{UI.autoTimer=null;if(FIGHT==='auto'&&UI.screen==='combat'&&!PLAYING&&!C.over){UI.sel=E.autoPick(C);render();setTimeout(()=>{if(FIGHT==='auto'&&!PLAYING&&!C.over)ACT.go()},MODE==='off'?150:500)}},MODE==='off'?150:600);
  }

  /* ===== 진행: 성장 굴림 → 대기 중인 전투 → 다음 해 ===== */
  function nextYear(){
    const st=E.advanceYear(G);
    UI.fight=null;UI.pending=null;
    if(st.type==='end'){UI.endWin=st.win;UI.trueEnd=!!st.trueEnd;UI.death=st.cause?{year:G.year,foe:st.cause==='mind'?'정신 붕괴':'뒤틀림',cause:st.cause}:null;UI.screen='end';render();return}
    UI.omen=null;UI.showIncome=G.year>1;
    if(st.type==='omen')UI.omen=st;
    else if(st.type==='fight'){UI.fight=st.enemy;UI.enc=st.enc}else UI.ev=st.ev;
    /* 공방 거리: 1년차부터 3년마다 들를지 묻는다. 들러도 해는 넘어가지 않는다 */
    if((G.year-1)%CFG.shop.every===0){
      UI.stock=G.year>=CFG.shop.blackFrom?E.sample(Object.keys(D.special),CFG.shop.blackStock):[];
      UI.bought=null;UI.deleted=null;UI.sold=null;UI.screen='shopask';render();return;
    }
    UI.stock=[];UI.screen='event';render();
  }
  function vShopAsk(){
    const nb=(G.year-1)+CFG.shop.every+1;
    return `${vHud()}<div class="stack" style="gap:8px"><div class="eyebrow">${E.age(G)}세의 해 · 공방 거리</div><h2>공방 거리를 지난다</h2>
      <p class="lead">장비를 손볼 수 있는 거리다. 들러도 한 해가 지나가지는 않는다.${UI.stock.length?' 골목 안쪽에 이번에만 열린 암시장 문도 보인다. 다음에 들를 때는 물건이 바뀐다.':''}</p>
      <p class="small dim">다음 기회는 ${Math.min(nb,CFG.years)}년차.</p></div>
      <div class="stack"><button class="btn primary" data-a="shop">들른다</button><button class="btn" data-a="unshop">지나간다</button></div>`;
  }
  function vOmen(){
    const o=UI.omen,m=o.omen;
    const go=`<button class="btn" data-a="omen" data-i="1"><b>${m.go||'이 길로 간다'}</b><span class="mono small dim">${T.hiddenBoss} · 매우 위험</span></button>`;
    const away=o.escape?`<button class="btn" data-a="omen" data-i="0"><b>${m.away||'돌아선다'}</b><span class="mono small dim">평소처럼 조우한다</span></button>`:'';
    return `${vHud()}<div class="stack" style="gap:8px"><div class="eyebrow">${E.age(G)}세의 해 · 불길한 예감</div><h2>무언가 다가온다</h2><p class="lead">${m.x||'무언가 안 좋은 예감이 든다.'}</p></div>
      <div class="stack">${go}${away}</div>`;
  }
  function flow(){
    const ch=G.ch;
    if(ch.lvPend>0){if(!ch.lvOpts){ch.lvOpts=E.rollGrowth();UI.lvFresh=true}UI.screen='level';render();return}
    if(UI.pending){const id=UI.pending;UI.pending=null;startCombat(id);return}
    nextYear();
  }
  function startCombat(id){C=E.mkCombat(G.ch,id);UI.sel=[];PLAYING=false;UI.screen='combat';render()}

  const ACT={
    egotype(k){UI.egoName=(($('egoname')||{}).value||UI.egoName||'');UI.egoType=k;render()},
    egoset(){
      const n=(($('egoname')||{}).value||'').trim(),err=E.egoNameErr(n);
      if(err){UI.egoErr=err;UI.egoName=n;render();return}
      const ty=UI.egoType||'atk';E.setEgo(G.ch,ty,n);UI.egoErr='';UI.egoName='';UI.egoType=null;
      UI.res.chips=[...UI.res.chips,`E.G.O · ${n} (${CFG.mind.ego[ty].n})`];render();
    },
    sell(i){const g=(G.ch.stash||[])[+i];if(!g)return;const v=E.sellStash(G.ch,+i);if(v){UI.sold=`${g.n}을(를) ${E.money(v)}에 팔았다.`;render()}},
    delcard(i){if((UI.deleted||[]).length>=CFG.shop.delMax)return;const c=E.delCard(G.ch,+i);if(c){(UI.deleted=UI.deleted||[]).push(D.cards[c].n);render()}},
    tname(){
      const ch=G.ch,adj=D.colors[ch.ci].adj,w=(($('tw')||{}).value||'').trim();
      if(!TW_OK.test(w)){UI.twErr='2~3글자로 적어 주세요 (한글·영문·숫자, 띄어쓰기 없이)';render();return}
      const old=ch.title;ch.title=adj+' '+w;ch.titlePick=false;UI.twErr='';
      UI.res.chips=UI.res.chips.map(x=>x===T.titleLabel+' · '+old?T.titleLabel+' · '+ch.title:x);render();
    },
    title(){UI.screen='title';render()},
    mode(i){MODE=i;store.set('cityYearMode',i);render()},
    fightmode(i){FIGHT=i;store.set('cityYearFight',i);render()},
    skin(i){SKIN=i;store.set('cityYearSkin',i);document.documentElement.dataset.skin=i;render()},
    endless(){G.endless=true;UI.shareText=UI.shareMsg=UI.imgUrl=null;nextYear()},
    async saveimg(){
      UI.imgUrl=null;const cv=await endCard(),name=`도시의한해_${G.ch.seed}.png`;
      const blob=await new Promise(r=>cv.toBlob(r,'image/png'));
      try{const f=new File([blob],name,{type:'image/png'});if(navigator.canShare&&navigator.canShare({files:[f]})){await navigator.share({files:[f]});return}}catch(e){if(e&&e.name==='AbortError')return}
      try{const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),4000)}catch(e){}
      /* 다운로드가 막히는 환경(미리보기 창 등)을 위해 이미지도 화면에 보여 준다 */
      if(window.self!==window.top){UI.imgUrl=cv.toDataURL('image/png');render()}
    },
    testCard:async()=>(await endCard()).toDataURL('image/png'),
    async share(){
      const t=shareText();UI.shareText=null;
      try{if(navigator.share){await navigator.share({text:t});UI.shareMsg='공유 창을 열었다.';render();return}}catch(e){if(e&&e.name==='AbortError')return}
      try{await navigator.clipboard.writeText(t);UI.shareMsg='기록을 복사했다. 붙여 넣어 공유하면 된다.'}
      catch(e){UI.shareMsg='복사가 막혀 있다. 아래 글을 길게 눌러 복사한다.';UI.shareText=t}
      render();const b=$('shareBox');if(b)b.select();
    },
    start(){UI.shareText=UI.shareMsg=UI.imgUrl=null;if(expired()){UI.screen='title';render();return}born(newSeed(),BC&&BC.name);UI.endText=null;UI.screen='birth';render()},
    reroll(){UI.relic=null;if(UI.jobAuto){UI.job=null;UI.jobAuto=false}born(newSeed(),BC&&BC.name);render()},
    seed(){UI.relic=null;if(UI.jobAuto){UI.job=null;UI.jobAuto=false}const v=parseInt(($('seedIn')||{}).value,10);if(!(v>=0)){const i=$('seedIn');if(i){i.value='';i.placeholder='숫자만 넣을 수 있다'}return}born(v,BC&&BC.name);render()},
    color(i){E.setColor(BC,+i);BC.fresh=false;render()},
    relic(k){UI.relic=k;render()},
    job(k){UI.job=k||null;UI.jobAuto=false;UI.relic=null;born(BC.seed,BC.name);render()},
    jobroll(k){if(k){UI.jobBase=BC.o.n;UI.job=k;UI.jobAuto=true}else{UI.job=null;UI.jobAuto=false}UI.relic=null;born(BC.seed,BC.name);render()},
    live(){if(BC.relicPick){if(!UI.relic)return;E.giveRelic(BC,UI.relic);UI.relic=null}G=E.newGame(BC);nextYear()},
    flow(){flow()},
    fight(){UI.pending=UI.fight;UI.fight=null;flow()},
    shop(){UI.showIncome=false;UI.screen='shop';render()},
    buy(id){if(E.buy(G.ch,id)){UI.bought=D.items[id].n;render()}},
    invtab(k){UI.invTab=k;render()},
    eqs(i){if(UI.screen!=='combat'&&E.equipStash(G.ch,+i))render()},
    bspecial(id){if(E.buySpecial(G.ch,id)){UI.bought=D.special[id].n;render()}},
    unshop(){UI.screen='event';render()},
    omen(i){
      const st=E.answerOmen(G,UI.omen,i==='1');
      const m=UI.omen.omen;UI.omen=null;UI.fight=st.enemy;UI.enc=st.enc;UI.avoidText=st.avoided?m.awayT:null;render();
    },
    choose(i){
      const r=E.choose(G,UI.ev,+i);
      UI.pending=r.combat;
      UI.res=Object.assign(r,{anim:!!r.roll&&MODE!=='off'});
      UI.screen='result';render();
    },
    grow(i){const ch=G.ch;E.applyGrowth(ch,ch.lvOpts[+i].g.fx);ch.lvPend--;ch.lvOpts=null;flow()},
    pick(i){i=+i;const at=UI.sel.indexOf(i);if(at>=0)UI.sel.splice(at,1);else UI.sel.push(i);render()},
    go(){
      const pp=UI.sel.map(i=>D.cards[C.P.hand[i]]);
      const lb=C.log.length;PRE=E.snap(C);UI.lastPP=pp;
      E.resolveRound(C,pp,C.ePlan);UI.sel=[];
      if(MODE==='off'){if(!C.over)E.newRound(C);render();return}
      C.logBefore=lb;PLAYING=true;render();if(isMobile())window.scrollTo(0,0);runPlayback(C.evs);
    },
    skip(){SKIP=true;if(wake)wake();if(tapWake)tapWake()},
    tap(){if(tapWake)tapWake()},
    fin(){
      if(C.over==='lose'){UI.endWin=false;UI.trueEnd=false;UI.death=G.ch.mindDead?{year:G.year,foe:'정신 붕괴',cause:'mind'}:{year:G.year,foe:D.enemies[C.id].n,hidden:!!D.enemies[C.id].hidden};UI.screen='end';render();return}
      const r=E.winRewards(G,C);
      if(r.unlock)addUnlock(r.unlock);
      if(r.endText)UI.endText=r.endText;
      UI.res={t:`${r.hidden?r.endText:C.E.name+'의 잔해 속에서 쓸 만한 것을 주웠다.'}${r.newly?' 소문이 돌아 이름이 '+T.licensed+' 명부에 올랐다.':''}${r.colorRoll?(r.colorRoll.ok?' 도시가 당신의 색을 기억하기 시작했다.':' 아직 도시는 당신의 색을 부르지 않는다.'):''}`,chips:r.chips,roll:r.colorRoll,anim:!!r.colorRoll&&MODE!=='off',title:r.title,tlabel:r.tlabel};
      UI.screen='result';render();
    },
    sim(){SIM=E.simulate(200);UI.screen='sim';render()}
  };
  /* 시드: 브라우저 암호 난수로 새로 뽑는다. 같은 시드면 같은 출생과 같은 굴림 */
  function newSeed(){try{return crypto.getRandomValues(new Uint32Array(1))[0]%1000000000}catch(e){return Math.floor(Math.random()*1e9)}}
  function born(seed,name){E.reseed(seed);BC=E.newChar(UI.job&&loadUnlocks().includes(UI.job)?UI.job:null);BC.seed=seed;BC.name=name||'';BC.fresh=true}
  /* 화면 폭이 휴대폰/PC 경계를 넘으면 전투 화면을 다시 그린다 (재생 중에는 그대로) */
  window.addEventListener('resize',()=>{if(UI.screen==='combat'&&!PLAYING&&UI.wasMobile!==isMobile())render()});
  app.addEventListener('toggle',e=>{const t=e.target;if(!t.classList)return;
    if(t.classList.contains('logbox')&&t.querySelector('#log'))UI.logOpen=t.open;
    if(t.classList.contains('roundbox'))UI.roundOpen=t.open;
    if(t.classList.contains('inv'))UI.invOpen=t.open},true);
  /* 휴대폰 키보드의 이동·완료(Enter)로도 시드 적용 */
  app.addEventListener('keydown',e=>{if(e.target.id==='seedIn'&&e.key==='Enter'){e.preventDefault();e.target.blur();ACT.seed()}});
  app.addEventListener('input',e=>{if(e.target.id==='nm'&&BC)BC.name=e.target.value.trim().slice(0,12)});
  app.addEventListener('click',e=>{
    const b=e.target.closest('[data-a]');
    if(!b||b.disabled||PLAYING&&!['skip','tap','fightmode'].includes(b.dataset.a))return;
    ACT[b.dataset.a](b.dataset.i);
  });
  render();
  /* 자동 테스트용 상태 조회 */
  return {state:()=>({screen:UI.screen,year:G&&G.year,endWin:UI.endWin,lv:G&&G.ch.lv,aff:G&&G.ch.aff}),
    /* 자동 테스트용: 진행 중인 게임에서 지정한 적과 바로 싸운다 (적 HP를 낮출 수 있다) */
    testCard:()=>ACT.testCard(),
    testMind(n){if(!G)return;G.ch.mind=n+1;E.loseMind(G.ch,1);render()},
    testEgoPick(){if(!G)return;G.ch.egoPick=true;UI.res=UI.res||{chips:[],t:''};UI.res.chips=UI.res.chips||[];UI.screen='result';render()},
    testDeath(y,foe){if(!G)return;G.year=G.ch.year=y;UI.endWin=false;UI.trueEnd=false;UI.death={year:y,foe,hidden:false};UI.screen='end';render()},
    testEnd(y){if(!G)return;G.year=G.ch.year=y||CFG.years;UI.endWin=true;UI.trueEnd=false;UI.death=null;UI.screen='end';render()},
    testFight(id,hp){if(!G)return;startCombat(id);if(hp)C.E.hp=hp;render()},
    /* 자동 테스트용: 특색 심사 통과 직후 화면 */
    testColor(){if(!G)return;G.ch.licensed=true;G.ch.rank=1;const r=E.applyFx(G.ch,{colorPass:true});UI.res={t:'심사 통과',chips:r.chips,roll:null};UI.screen='result';render()},
    testMoney(n){if(G){G.ch.money=n;render()}},
    testOrigin(n){if(!BC)return;const o=D.origins.find(x=>x.n===n);if(!o)return;E.reseed(BC.seed);let c;for(let i=0;i<5000;i++){c=E.newChar();if(c.o.n===n)break}c.seed=BC.seed;c.name=BC.name;BC=c;render()},
    testOmen(id){if(!G)return;const h=D.hiddenBosses.find(x=>x.id===id);UI.omen={type:'omen',boss:id,omen:h.omen||{},escape:!h.noEscape,spec:'table:early'};UI.screen='event';render()}};
}
