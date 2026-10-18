/* 화면: 렌더와 연출만 맡는다. 규칙과 판정은 전부 엔진(E)에 묻는다. */
import {CFG} from './config.js';
import {clamp,sg,STAT} from './engine.js';
import {createBgm} from './bgm.js';

export function startUI(E,app){
  const D=E.D,T=D.text;
  const KWC={bleed:'var(--bleed)',rupture:'var(--rupture)',breath:'var(--breath)',burn:'#f0903c',flame:'#e0503c',nail:'#9aa0a6',stagger:'#b07cc6',charge:'#e8d44d',sink:'#4a8fb0',ink:'#5a6ea0',obey:'#8a7fb8'};
  const kwc=k=>KWC[k]||'var(--gold)';

  /* ===== 설정 저장 (연출 속도, 배경 테마) ===== */
  /* 저장소가 막힌 브라우저(인앱 브라우저·시크릿 모드 등)에서도 이번 접속 동안은 값이 유지되도록 메모리에 같이 둔다 */
  const mem={};
  const store={get(k){try{const v=localStorage.getItem(k);if(v!==null)return v}catch(e){}return k in mem?mem[k]:null},set(k,v){mem[k]=v;try{localStorage.setItem(k,v)}catch(e){}},del(k){delete mem[k];try{localStorage.removeItem(k)}catch(e){}}};
  /* 이어하기: 해가 바뀔 때마다 판 전체를 저장한다 */
  const SAVE='cityYearSave';
  const HARDK='cityYearHard',DIFFK='cityYearDiff';
  const loadSave=()=>{try{const o=JSON.parse(store.get(SAVE)||'null');return o&&o.G&&o.G.ch?o:null}catch(e){return null}};
  /* 기록실: 만난 적·이긴 적·엔딩·타고난 것·최고 기록 */
  const REC='cityYearRecords';
  const VERSION='v8.1.0';
  const loadRec=()=>{let r=null;try{r=JSON.parse(store.get(REC)||'null')}catch(e){}return Object.assign({seen:[],beaten:[],endings:[],innate:[],titles:{},affs:[],runs:0,best:{years:0,lv:0,grade:-1}},r||{})};
  /* 칭호 기록: 최고 등급에 오를 때마다 그 칭호의 횟수를 +1 (판이 바뀌어도 쌓인다) */
  const syncAffs=()=>{const c=G&&G.ch;if(!c||!(c.affLog||[]).length)return;const r=loadRec();r.affs=r.affs||[];let ch=false;for(const n of c.affLog)if(!r.affs.includes(n)){r.affs.push(n);ch=true}if(ch)store.set(REC,JSON.stringify(r))};
  const syncTitles=()=>{syncAffs();const c=G&&G.ch;if(!c||!(c.titleLog||[]).length)return;const done=c.titleSeen||0;if(c.titleLog.length<=done)return;
    const r=loadRec();r.titles=r.titles||{};for(const n of c.titleLog.slice(done))r.titles[n]=(r.titles[n]||0)+1;c.titleSeen=c.titleLog.length;store.set(REC,JSON.stringify(r))};
  const recAdd=(k,v)=>{const r=loadRec();if(!r[k].includes(v)){r[k].push(v);store.set(REC,JSON.stringify(r))}};
  let MODE=store.get('cityYearMode')||((window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches)?'off':'slow');
  const SKINS=[{k:'base',n:'기본'},{k:'dante',n:'단테의 노트'},{k:'terminal',n:'검지 단말기'},{k:'ruina',n:'도서관 초대장'}];
  const SKIN_TAB={base:'도시 기록',dante:'단테의 노트',terminal:'TERMINAL · 대행',ruina:'오늘의 책'};
  let SKIN=store.get('cityYearSkin')||'base';
  /* 전투 진행: 직접 고르기(pick) / 자동 전투(auto). 자동이면 카드 선택과 라운드 진행을 알아서 한다 */
  let FIGHT=store.get('cityYearFight')||'pick';
  /* 자동 전투 라운드 간격: slow(느림) / normal(보통, 연출 속도에 맞춤) / fast(빠름) */
  let AUTOGAP=store.get('cityYearAutoGap')||'normal';
  /* 인생 주사위: free(태어난 뒤엔 매번 다르게) / fixed(시드 하나로 인생 전체가 같게, 재현용) */
  let DICE=store.get('cityYearDice')||'free';
  /* 히든 직업 해금 기록: 이 브라우저에만 남는다 */
  const loadUnlocks=()=>{try{return JSON.parse(store.get('cityYearUnlocks')||'[]')}catch(e){return []}};
  const addUnlock=k=>{const u=loadUnlocks();if(!u.includes(k)){u.push(k);store.set('cityYearUnlocks',JSON.stringify(u))}};
  if(!SKINS.some(s=>s.k===SKIN))SKIN='base';
  /* 배경음악: 기본은 꺼짐. 켜 둔 채 다시 열면 첫 터치 때 서서히 시작한다 (브라우저는 터치 전에 소리를 낼 수 없다) */
  const BGM=createBgm(),BGMK='cityYearBgm';
  const bgmSave=()=>store.set(BGMK,JSON.stringify({on:BGM.isOn(),vol:BGM.vol()}));
  {let o={};try{o=JSON.parse(store.get(BGMK)||'{}')||{}}catch(e){}
    BGM.setVol(typeof o.vol==='number'?o.vol:0.3);BGM.setMood(SKIN);
    if(o.on&&BGM.supported)document.addEventListener('pointerdown',()=>{BGM.set(true);bgmSave()},{once:true})}
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
  /* 수동: 주사위 눈이 나오면 화면을 누를 때까지 멈춘다. 버튼이나 배경 변화 없이 아래쪽에 작은 글자만 띄운다 (스크롤은 클릭이 아니라서 넘어가지 않고, 건너뛰기를 눌러도 풀린다) */
  function holdTap(label='화면 클릭 후 계속'){
    if(MODE!=='manual'||SKIP||FIGHT==='auto')return Promise.resolve();
    const h=document.createElement('div');h.id='holdHint';h.textContent=label;
    /* 주사위 굴림 영역 바로 아래, 가운데에 둔다 (전투: 판정 문구 아래 / 사건 판정: 주사위 줄 아래). 못 찾으면 화면 가운데 아래쪽에 띄운다 */
    h.style.cssText='text-align:center;font:500 13px/1.2 var(--mono);color:var(--dim,#9aa3b2);letter-spacing:.04em;pointer-events:none;padding:10px 0';
    const anchor=$('verdict')||($('rd')&&$('rd').closest('.row'));
    if(anchor)anchor.insertAdjacentElement('afterend',h);
    else{h.style.cssText+=';position:fixed;left:0;right:0;bottom:40%;z-index:5';document.body.appendChild(h)}
    return new Promise(r=>{
      const onClick=()=>{if(tapWake)tapWake()};
      const off=()=>{document.removeEventListener('click',onClick,true);h.remove()};
      tapWake=()=>{off();tapWake=null;r()};
      /* 방금 굴림 버튼을 누른 손가락의 클릭이 바로 이어 넘기지 않도록 잠깐 뒤에 건다 */
      setTimeout(()=>{if(tapWake)document.addEventListener('click',onClick,true)},300);
    });
  }
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
    /* 주사위 자리 고정: 적은 왼쪽, 플레이어는 오른쪽 (누가 공격하든 바뀌지 않는다) */
    {const wA=dA.closest('.dwrap'),wD=dD.closest('.dwrap'),vs=document.querySelector('.dice .vs'),dm=$('dmgw'),pAtt=e.att==='P';
     if(wA)wA.style.order=pAtt?3:1;if(wD)wD.style.order=pAtt?1:3;if(vs)vs.style.order=2;if(dm)dm.style.order=4}
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
    await holdTap();
    await wait(350);
    anim($('ent-'+e.att),e.att==='P'?'lunge-up':'lunge-down',500);
    await wait(200);
    if(e.hit){
      anim($('ent-'+e.def),'hurt',520);
      const box=$('dmgd'),fc=(e.card&&e.card.die)||6;$('dmgw').hidden=false;$('dmgw').querySelector('.dcap').textContent='피해 d'+fc;
      const dm=()=>'<div class="d6"><b>–</b></div>',sp=e.rolls2||[];
      box.innerHTML=e.rolls.map(dm).join('')+(sp.length?`<span class="small dim" style="align-self:center;padding:0 6px">${esc(e.ally2||'')}</span>`+sp.map(()=>'<div class="d6 sp" style="border-color:var(--bleed)"><b>–</b></div>').join(''):'');
      {const vals=[...e.rolls,...sp];await Promise.all([...box.querySelectorAll('.d6')].map((el,i)=>rollNum(el.firstElementChild,vals[i],500+i*(fc<6?60:130),fc)))}
      $('fM').textContent=e.dmg;
      setVerdict(e.guard?`방어 실패 · ${C[e.def].name}에게 줄어든 피해 ${e.dmg}`:`명중 · ${C[e.def].name}에게 피해 ${e.dmg}`,'bad');
      $('sM').textContent=`${e.rolls.join('+')}${e.rolls2?` | ${e.ally2} ${e.rolls2.join('+')}`:''}${e.b?sg(e.b):''}${e.note}`;
      floatTxt(e.def,'−'+e.dmg,'var(--bleed)');
      applySnap(e.snap);appendLog(e.lines);
      await holdTap();
      await wait(600);
    }else if(e.blocked){
      setVerdict(`막았다 · ${C[e.def].name} 피해 ${e.dmg}`,'miss');
      anim($('ent-'+e.def),'guard',600);floatTxt(e.def,'−'+e.dmg,'var(--rupture)');
      appendLog(e.lines);applySnap(e.snap);
      await holdTap();
      await wait(500);
    }else{
      setVerdict(`빗나감 · ${C[e.def].name}이(가) 피했다`,'miss');
      anim($('ent-'+e.def),'dodge',600);floatTxt(e.def,'회피','var(--rupture)');
      appendLog(e.lines);applySnap(e.snap);
      await holdTap();
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
      await rollNum(b,r.r,900,r.die||100);
      die.classList.remove('rolling');anim(die,'settle',320);
      await holdTap();
      await wait(350);
    }
    const a=$('after');if(a)a.style.visibility='visible';
  }
  /* 주사위가 구르는 동안 결과 이름도 표의 다른 칸들 사이를 돌다가 멈춘다 */
  function rollAnim(){
    document.querySelectorAll('[data-roll]').forEach((el,i)=>{
      el.textContent='–';
      const box=el.closest('.roll,.grow'),cy=box&&box.querySelector('[data-cyc]');let stop=null;
      if(cy&&!SKIP){const list=cy.dataset.cyc.split('|'),fin=cy.innerHTML;box.classList.add('cycling');
        const t=setInterval(()=>{cy.textContent=list[Math.floor(Math.random()*list.length)]},70);
        stop=()=>{clearInterval(t);cy.innerHTML=fin;box.classList.remove('cycling');anim(box,'settle',320)}}
      setTimeout(()=>rollNum(el,+el.dataset.roll,650,100).then(()=>stop&&stop()),i*220);
    });
  }

  /* ===== 화면 ===== */
  let UI={screen:'title'},G=null,C=null,BC=null,SIM=null,lastScreen='';

  /* 이름 일부에 취소선 (중지의 큰형님) */
  const ulName=(n,u)=>u?esc(n).replace(esc(u),`<s>${esc(u)}</s>`):esc(n);
  function bar(v,max){return `<div class="bar"><i style="width:${clamp(v/max*100,0,100)}%"></i></div>`}
  /* 걸려 있는 키워드: 수치와 다음에 일어날 일을 같이 보여 준다 */
  const KWHINT={obey:n=>`내 명중 −${n*CFG.hw.obey.hit} · 흑수 부하가 거들 때마다 −1 · 흑수여, 답하라는 전부 푼다`,nail:n=>'망치 카드가 쌓인 못을 흐트러짐으로 바꾼다',stagger:n=>{const st=CFG.nail.stages.filter(g=>n>=g.at).pop(),thr=C&&C.E?E.nailThr(C):CFG.nail.stun.mid;return `기절 ${n}/${thr}${st?` · 명중 −${st.hit}${st.dmg?` · 주는 피해 −${st.dmg}`:''}${st.take?` · 받는 피해 +${st.take}`:''}`:''}`},burn:n=>`라운드 끝에 스택×${CFG.burn.dmg} 피해(내가 받으면 ×${CFG.burn.dmgMe}) · 스택 절반 · 최대 ${CFG.burn.max}`,charge:n=>`쓰면 소모 · 맞으면 −${G&&G.ch&&C&&C.P?C.P.chargeLoss:1}`,ink:n=>`라운드가 끝날 때 스택당 ${CFG.ink.dmg} 피해(내가 받으면 ${CFG.ink.dmgMe}), 그 뒤 스택이 절반이 된다 (최대 ${CFG.ink.cap})`,sink:n=>`주는 피해 −${Math.floor(n/CFG.sink.per)*CFG.sink.dmg} · 명중 −${CFG.sink.hit*Math.floor(n/CFG.sink.per)} (${CFG.sink.per}당 1단계 · 라운드마다 −1)`,flame:n=>n>=CFG.laev.blueAt?`받는 피해 ×${CFG.laev.blueMul}`:`받는 피해 ×1.5 · ${CFG.laev.blueAt}스택이면 푸른 화염`,bleed:n=>`공격할 때 −${n}`,rupture:n=>`맞을 때 +${n}`,breath:n=>n>=1&&n<=CFG.breath.evaMax?`회피 +${CFG.breath.eva}`:`치명 ${E.critPct(n)}%`};
  function stacks(X){
    const out=Object.keys(D.keywords).filter(k=>X[k]>0).map(k=>`<span class="chip stk" style="--kc:${kwc(k)}"><b>${k==='flame'&&(X.blue||X[k]>=CFG.laev.blueAt)?'푸른 화염':D.keywords[k].n} ${X[k]}</b>${k==='flame'&&(X.blue||X[k]>=CFG.laev.blueAt)?`<small>받는 피해 ×${X.blueM||CFG.laev.blueMul} · 라운드마다 ${X[k]*(X.blueD||CFG.laev.blueDot)}</small>`:KWHINT[k]?`<small>${KWHINT[k](X[k])}</small>`:''}</span>`);
    if(X.stunned)out.push('<span class="chip stk" style="--kc:#b07cc6"><b>기절</b><small>이번 라운드 행동 불가 · 회피 0</small></span>');
    /* 히든 보스 패시브 스택: 잔향(내게 쌓임), 장부(보스에게 쌓임) */
    const pv=C&&C.E&&C.E.passive;
    if(pv&&X.echo>0)out.push(`<span class="chip stk" style="--kc:var(--rupture)"><b>${pv.n} ${X.echo}/${pv.need}</b><small>${pv.need}에서 고정 피해 ${pv.dmg}</small></span>`);
    if(pv&&X.ledger>0)out.push(`<span class="chip stk" style="--kc:var(--bleed)"><b>${pv.n} ${X.ledger}/${pv.need}</b><small>${X.ledger>=pv.need?'다음 명중 1d110':'다 차면 명중 1d110'}</small></span>`);
    /* 전용 무기 디버프 */
    const pw=G&&G.ch&&G.ch.gear.weapon&&G.ch.gear.weapon.wx||{};
    const W=[['cloud','구름',v=>`${v}/${CFG.syn['흑운회'].max} · 가득 차면 흑운`],['black','흑운',v=>`주사위마다 +${CFG.syn['흑운회'].die} · 적중 시 출혈 +1`],['prescript','지령',v=>`명중 −${3*v}`],['warp','왜곡',v=>`주는 피해 −${v}`],['shock','감전',v=>`회피 −${3*v}`],['chain','사슬',v=>`회피 −${2*v}`],['web','거미줄',v=>`회피 −${2*v}`],['hunger','오랜 굶주림',v=>`${v}/${CFG.hunger.max} · 다음 공격 카드의 첫 적중 피해 +${v} (쓰면 전부 소진)`],['work','작품',v=>`명중 +${CFG.ring.hit*v} · ${CFG.ring.max}이면 다음 적중 피해 ×${CFG.ring.finish}`],['mk','표적',v=>`${v}/3 · 3이면 피해 2배`],['grudge',pw.grudgeN||'원한',v=>`다음 적중 +${v*(pw.grudge||4)}`],['wecho',pw.echo&&pw.echo.n||'잔향',v=>`${v}/${pw.echo?pw.echo.need:5} · ${pw.echo?pw.echo.need:5}이면 고정 피해 ${pw.echo?pw.echo.dmg:10}`],['shield','보호막',v=>`피해 ${v} 막음`],['matc','재료 수집',v=>'신체관극의 재료가 된다'],['mat','재료',v=>`폐장 주사위 +${v}`],['disp','처분 표식',v=>'처분 주사위 +1'],['serum','혈청',v=>`${v}/3${v>=3?' · 다음 적중 ×1.5':''}`],['ammo','탄환',v=>`${v}발 남음 · 공격마다 1발`],['manner','예의를 지킬 것',v=>`명중 −${v}`],['presc','지령 수행',v=>`${v}/5 · 받는 피해 −${v*5}%`],['revenge','되갚음',v=>`${v}/${X.isP?CFG.middle.cap:5} · 받는 피해 −${v*CFG.middle.def} · 다음 적중 +${v*(X.revMul||CFG.middle.dmg)} · HP +${v*CFG.middle.heal}`],['sealMark','봉인 각인',v=>`${v}/5 · 해제 시 +${v*4}`],['accel','가속',v=>`명중·회피 +${v*5}`]];
    for(const [k,n,h] of W)if(X[k]>0)out.push(`<span class="chip stk" style="--kc:var(--gold)"><b>${n} ${X[k]}</b><small>${h(X[k])}</small></span>`);
    return out.length?out.join(''):'<span class="chip dim">상태 없음</span>';
  }
  function kwChips(c){
    return (c.kw||[]).map(([k,n,to])=>`<span class="chip" style="color:${kwc(k)};border-color:${kwc(k)}">${D.keywords[k].n} +${n}${to==='s'?' 자신':''}</span>`).join('');
  }
  /* 보냐텔리 검술 등 카드 고유 효과 문구 */
  const cardFx=c=>[c.serum?'혈청 +'+c.serum+' (3이 쌓이면 적중 피해 ×1.5 후 비움)':'',c.serumBurst?'혈청을 모두 써서 1당 주사위 +1':'',c.seal?'적중 시 봉인 각인 +'+c.seal:'',c.unseal?'봉인 각인 1당 피해 +'+c.unseal+' (각인 소모)':'',c.dmark?'적중 시 처분 표식 +'+c.dmark:'',c.exec?'처분 표식이 있으면 주사위 +'+c.exec:'',c.execHit?'처분 표식이 있으면 명중 +'+c.execHit:'',c.grant?'처분 표식이 있으면 다음 라운드 '+D.cards[c.grant].n+' 카드':'',c.once?'이번 라운드만 쓰는 카드':'',c.gungnir?'이 카드를 낸 라운드는 받는 피해 60% 감소 (공명)':''].filter(Boolean).map(x=>' · '+x).join('');
  function cardLine(c,g,wx){
    if(c.t!=='atk')return (c.d||'')+cardFx(c);
    return cardLine0(c,g,wx)+cardFx(c)+((c.mat||c.harvest||c.reuse)&&c.d?' · '+c.d:'')+(c.mindCost?` · 정신력 −${c.mindCost}`:'');
  }
  function cardLine0(c,g,wx){
    if(c.range)return `${c.hits>1?c.hits+'타 · ':''}${c.dice>1?c.dice+'개 · ':''}1d${c.range[0]}~${c.range[1]}${c.b?sg(c.b):''} · 명중 ${sg(c.hit+(g?g.hit:0))}`;
    if(c.gamble)return `${c.d} · 명중 ${sg(c.hit+(g?g.hit:0))}`;
    const x=[];
    if(c.adv)x.push('명중 2회 굴림');
    if(c.spend)x.push(`충전 ${c.spend>=99?'전부':c.spend} 소모 · 1당 고정 +${c.fixPer}${c.hits>1?' (적중마다)':''}`);
    if(c.once)x.push('전투당 1회');
    if(c.nailBurst)x.push(`못을 모두 흐트러짐으로 ×${c.nailBurst.mul}${c.nailBurst.add?' +'+c.nailBurst.add:''}`);
    if(c.spdDice)x.push(`속도 ${c.spdDice[0]} 이상이면 주사위마다 +${c.spdDice[1]}`);
    if(c.sinkDmg)x.push(`침잠 ${CFG.sink.per}당 +${c.sinkDmg}`);
    if(c.rr)x.push('낮은 피해 재굴림');
    if(c.min)x.push('피해 최소 '+c.min);
    if(c.next)x.push('사용 후 다음 라운드 '+D.cards[c.next].n);
    if(c.rngDebuff)x.push('주사위마다 '+c.rngDebuff.map(k=>D.keywords[k].n).join('·')+' 중 무작위 +1');
    
    const ex=x.length?' · '+x.join(' · '):'';
    /* 전용 무기 주사위가 있으면 실제로 굴리는 주사위로 표시 */
    if(wx&&wx.dice&&!c.die){const n=Math.max(wx.dice[0],c.dice)+(g?g.dice:0),b=(c.b||0)+(g?g.b:0);return `${c.hits>1?c.hits+'타 · ':''}${n}d${wx.dice[1]}${b?sg(b):''} · 명중 ${sg(c.hit+(g?g.hit:0))} · 무기 주사위${g&&g.n?' · 등급 '+g.n:''}${ex}`}
    if(g&&g.n){const dc=c.dice+(c.die?0:g.dice),b=(c.b||0)+g.b;return `${c.hits>1?c.hits+'타 · ':''}${dc}d${c.die||6}${b?sg(b):''} · 명중 ${sg(c.hit+g.hit)} · 등급 ${g.n}${ex}`}
    return `${c.hits>1?c.hits+'타 · ':''}${c.dice}d${c.die||6}${c.b?sg(c.b):''} · 명중 ${sg(c.hit)}${x.length?' · '+x.join(' · '):''}`;
  }
  function vSettings(){
    const b=(a,k,l,cur)=>`<button class="${cur===k?'on':''}" data-a="${a}" data-i="${k}">${l}</button>`;
    return `<div class="stack" style="gap:6px"><span class="eyebrow">배경 테마</span><div class="seg">${SKINS.map(s=>b('skin',s.k,s.n,SKIN)).join('')}</div></div>
      <div class="stack" style="gap:6px"><span class="eyebrow">주사위 · 전투 연출</span><div class="seg">${b('mode','manual','수동',MODE)}${b('mode','slow','천천히',MODE)}${b('mode','fast','빠르게',MODE)}${b('mode','off','끔',MODE)}</div>
        <span class="small dim">${{manual:'행동마다 버튼을 눌러 직접 주사위를 굴린다',slow:'자동으로 천천히 굴린다',fast:'자동으로 빠르게 굴린다',off:'연출 없이 결과만 본다'}[MODE]}</span></div>
      <div class="stack" style="gap:6px"><span class="eyebrow">자동 전투 간격</span><div class="seg">${b('autogap','slow','느림',AUTOGAP)}${b('autogap','normal','보통',AUTOGAP)}${b('autogap','mid','조금 빠름',AUTOGAP)}${b('autogap','fast','빠름',AUTOGAP)}</div>
        <span class="small dim">자동 전투에서 라운드와 라운드 사이를 얼마나 쉬는지 · 전투 중 일시정지도 할 수 있다</span></div>
      <div class="stack" style="gap:6px"><span class="eyebrow">인생 주사위</span><div class="seg">${b('dice','free','매번 다르게',DICE)}${b('dice','fixed','시드 고정(재현)',DICE)}</div>
        <span class="small dim">${DICE==='fixed'?'시드가 같고 선택이 같으면 인생 전체의 주사위가 똑같이 나온다 (공유·재현용)':'출생만 시드로 정해지고, 태어난 뒤의 사건 주사위는 판마다 달라진다'}</span></div>
      ${BGM.supported?`<div class="stack" style="gap:6px"><span class="eyebrow">배경음악</span><div class="seg">${b('bgm','off','끔',BGM.isOn()?'on':'off')}${b('bgm','on','켬',BGM.isOn()?'on':'off')}</div>
        <div class="stack" style="gap:4px"><div class="row between"><span class="small">음량</span><b class="mono" id="bgmPct">${Math.round(BGM.vol()*100)}%</b></div>
          <div class="bgmrow"><button class="chip" data-a="bgmstep" data-i="-10" aria-label="음량 10 줄이기">−10</button><input type="range" id="bgmRange" min="0" max="100" step="1" value="${Math.round(BGM.vol()*100)}" aria-label="배경음악 음량"><button class="chip" data-a="bgmstep" data-i="10" aria-label="음량 10 올리기">+10</button></div></div>
        <span class="small dim">외부 음원 없이 만든 잔잔한 배경음이다. 켜면 소리가 서서히 커지고, 언제든 끌 수 있다. 처음 음량은 30%이고, 막대를 끌거나 −10 · +10 버튼으로 0~100%까지 조절한다</span></div>`:''}
      <div class="stack" style="gap:6px"><span class="eyebrow">전투 진행</span><div class="seg">${b('fightmode','pick','직접 고르기',FIGHT)}${b('fightmode','auto','자동 전투',FIGHT)}</div>
        <span class="small dim">${FIGHT==='auto'?'카드 선택과 라운드 진행을 알아서 한다. 전투가 끝나면 멈춘다':'라운드마다 손패에서 카드를 직접 고른다'}${FIGHT==='auto'&&MODE==='manual'?' · 자동 전투 중에는 수동 굴림 버튼을 기다리지 않는다':''}</span></div>`;
  }
  const affLabel=ch=>(ch.aff?`<span class="chip"${ch.aff.own?' style="color:var(--gold);border-color:var(--gold)"':''}>${ch.aff.own?'내 사무소 · ':''}${esc(ch.aff.name)}${ch.corp&&ch.corp.wing?' · 설립 '+esc(ch.corp.wing):''}${ch.aff.own&&ch.office?' · '+E.OKW[ch.office.kw]:''}${ch.fr&&!['wing','finger'].includes(E.career(ch))?' · '+ch.fr.n:''}</span>`:ch.licensed?`<span class="chip">${T.licensed}</span>`:'')
    +(ch.pinky?`<span class="chip" title="${D.pinky.t}">+${D.pinky.n}</span>`:'');
  const innateName=c=>c.innate?(c.innate==='mark'&&c.markOn?D.innate.mark.awake:D.innate[c.innate].n):null;
  /* E.G.O 발현자: 무기 등급과 다음 등급까지 남은 발현 횟수 */
  const egoGrowTag=ch=>{if(ch.egoUses==null)return '';const G=CFG.egoGrow,L=E.egoLvFor(ch.egoUses),nx=G.need[L+1];
    return ` · <span style="color:var(--gold)">${G.tier[L]}</span>${nx!=null?` · 발현 ${ch.egoUses}/${nx}`:''}`};
  /* E.G.O 발현자: 다음 등급까지의 진행 막대 (정신력 아래 · 전투 화면에도) */
  const egoBar=ch=>{if(ch.egoUses==null)return '';const G=CFG.egoGrow,u=ch.egoUses,L=E.egoLvFor(u),nx=G.need[L+1],pct=nx==null?100:Math.round((u-G.need[L])/(nx-G.need[L])*100);
    return `<div class="egobar"><div class="row between small"><b style="color:var(--gold)">E.G.O 성장 · ${G.tier[L]}${nx!=null?` → ${G.tier[L+1]}`:' (최대)'}</b><span class="mono">${nx!=null?`발현 ${u}/${nx}`:`발현 ${u}회`}</span></div><div class="bar"><i style="width:${pct}%"></i></div>${nx!=null?`<div class="small dim">전용 카드 '발현'을 ${nx-u}번 더 쓰면 ${G.tier[L+1]}로 자란다</div>`:''}</div>`};
  function vMind(ch){
    const m=ch.mind,mx=E.mindMax(ch),t=E.mindTier(ch),low=m<=CFG.mind.voiceAt;
    return `<div class="row between small"><span class="mono" style="color:${low?'var(--bad,#c46a5a)':'var(--gold)'}">정신력 ${m}/${mx}</span><span class="mono dim">${ch.ego?`E.G.O ${esc(ch.ego.n)} · 하한 ${CFG.mind.ego[ch.ego.type].floor} · 빛 +${CFG.mind.light}(처음 ${CFG.mind.lightRounds}라운드)`:t?`호흡 +${t.breath}${t.eva?` · 회피 +${t.eva}`:''}${E.mindStat(ch)?` · 모든 능력치 +${E.mindStat(ch)}`:''}`:low?'목소리가 가깝다':'보정 없음'}${ch.egoGear?` · E.G.O 장비 ${ch.egoGear}`:''}${egoGrowTag(ch)}${ch.innate?` · <span style="color:var(--gold)">${esc(innateName(ch))}</span>`:''}${E.cardGrade(ch.year,ch).n?` · 카드 등급 <b style="color:var(--gold)">${E.cardGrade(ch.year,ch).n}</b>`:''}</span></div>
      <div class="bar" style="height:4px"><span style="width:${Math.round(m/mx*100)}%;background:${low?'#c46a5a':'#8a7fb8'}"></span></div>`;
  }
  /* 손가락별 지속 패시브 한 줄 (HUD와 가입 선택 화면이 같이 쓴다) */
  const fingerPassive=(af,fi)=>af==='엄지'?`탄환 · 전투마다 ${CFG.thumbAmmo.base+CFG.thumbAmmo.per*fi}발 (서열마다 +${CFG.thumbAmmo.per}) · 공격마다 1발 소모 · 상대에게 예의를 지킬 것 1 (상대 명중 −${CFG.thumbManner}×스택) · 탄환이 바닥나도 라운드마다 처음 공격에 ${CFG.thumbRefund}발이 돌아온다`
    :af==='검지'?'지령 수행 · ☆ 칸 카드를 내면 1(최대 5) · 호흡 +4 · 받는 피해 −5%×스택'
    :af==='중지'?'되갚음 · 맞을 때마다 1(최대 10) · 스택 1당 받는 피해 −2 · 다음 적중에서 스택을 모두 써 피해 +스택 · 소모한 스택 1당 HP 1 회복 · 방어 카드를 낸 라운드에 맞으면 스택 × 3의 고정 피해로 반격'
    :af==='약지'?`작품 · 적중할 때마다 +1(전투 한정, 최대 ${CFG.ring.max}) · 스택당 명중 +${CFG.ring.hit} · 최대면 다음 적중 피해 ×${CFG.ring.finish} 후 ${CFG.ring.after}로`
    :af==='흑운회'?`암운 · 덱 8장부터 열린다 (그 아래로 줄이면 닫힘) · 전투 시작 구름 3 (10장이면 4) · 출혈을 걸거나 맞을 때마다 구름 +1 · 5가 되면 흑운: 피해 주사위마다 +${CFG.syn['흑운회'].die} · 적중 시 출혈 +1 · 라운드 끝에 구름 2로 · 덱 10장이면 흑운 중 받는 피해 ×${CFG.syn['흑운회'].half}`
    :af==='검계'?'호흡결 · 덱 8장부터 열린다 (그 아래로 줄이면 닫힘) · 매 라운드 호흡 +2 · 호흡 자연 감소 1 (10장이면 줄지 않음) · 호흡 '+CFG.syn['검계'].per+'당 모든 카드 피해 +1 · 호흡 10 이상 적중은 방어·보호막 무시'
    :af==='밤의 송곳'?'뒷골목의 룰 · 덱 8장부터 열린다 (그 아래로 줄이면 닫힘) · 출혈이 걸린 적에게 명중 +'+CFG.syn['밤의 송곳'].bleedHit+' · 선공이면 상대 회피 절반 · 속도 굴림 +10 (10장이면 +15, 선공 첫 적중 출혈 +1)':null;
  /* 지속형 패시브: 손가락·히든 출생 등 늘 켜져 있는 효과를 HUD에 한 줄로 */
  function vPassive(ch){
    const P=[];const af=ch.aff&&ch.aff.name;
    {const t=fingerPassive(af,ch.fi||0);if(t)P.push(t)}
    if(ch.fate)P.push(`운명 · 모든 판정 +${CFG.nWing.fate} (사건 판정 · 전투 명중·회피) · 못 패시브 대신`);
    if(ch.oracle)P.push(`신탁대행자 · 지령 독촉 · 지령 스택 최대 ${CFG.oracle.presc} · 지령을 수행하지 못하면 다음 라운드 명중 −${CFG.oracle.missHit} · 회피 −${CFG.oracle.missEva}`);
    if(af==='약지'||ch.artSense)P.push(`예술적 감각 ${ch.artSense||0}/${CFG.artSense.max} · 선택지 판정 주사위 1d${E.checkDie(ch)}${af==='약지'?' · 적을 '+CFG.artSense.every+'번 쓰러뜨릴 때마다 +1 (영구)':''}`);
    if(ch.corp&&ch.corp.type&&['dev','wing'].includes(ch.corp.st)){const c=ch.corp,t=CFG.corp.types[c.type];
      P.push(`특이점 ${c.n} (${t.n}) · ${t.e.split(' (')[0]} · ${c.st==='dev'?`개발 ${c.stack}/${CFG.corp.devMax}`:`강화 ${c.up}/${CFG.corp.upMax} · 금기 실험 ${c.forb}/${CFG.corp.forbMax}`}`)}
    if(ch.race==='hyeolgwi'&&(ch.beaten||[]).includes('dulcinea'))P.push(`피의 각인된 갈망 · 자식 ${ch.kids||0}/${CFG.kids.max} · 라운드마다 혈찬 +${CFG.kids.per}×자식 · 전투가 끝나면 자식마다 ${CFG.kids.lose}% 흩어짐`);
    {const n=Math.floor((ch.lv||1)/CFG.lvLight.at);if(n>0)P.push(`레벨 ${CFG.lvLight.at}마다 · 전투 중 빛과 빛 최대치 +${CFG.lvLight.up*n} (지금 레벨 ${ch.lv})`)}
    if(ch.flags&&ch.flags.redMist)P.push('붉은 안개 · 적을 쓰러뜨리면 HP '+CFG.redMist.heal+' 회복');
    if(ch.hw&&ch.hw.mission)P.push(`흑수 부하 · 흑수 카드가 아닌 공격이 적중할 때마다 데려온 순서대로 흑수 한 사람이 거든다 (피해 ${CFG.ink.follow}, 부하가 둘이면 한 사람당 +${CFG.ink.followPer} · 상대에게 수흔 +${CFG.ink.followInk}). 흑수가 둘이면 번갈아 거든다`);
    if(ch.hw&&ch.hwDan)P.push(`${CFG.hw.dan.name} · 가문의 강화 시술 · 전투 중 매 라운드 시작에 HP ${CFG.hw.dan.heal[ch.hwDan]} 회복`);
    if(ch.hwando)P.push(`섬봉광 검술 · 호흡 1당 치명 피해 +10% (최대 ${CFG.breath.hwandoCap})`);
    {const bb=E.bonCardB(ch);if(bb>0)P.push(`검술 강화 · 보냐텔리의 검 단계와 연차에 따라 전용 검술 카드 피해 +${bb}`)}
    if(ch.odin){if(ch.yeji||(ch.o&&ch.o.n==='보냐텔리 가문'))P.push(`가속하는 미래 · 보냐텔리 패시브 · 라운드마다 회피 ${CFG.odin.cycle.map(v=>v>0?'+'+v:v).join(' → ')} (마지막은 과부하) 반복`,`버프 · 예지안 · 오딘의 눈과 전용 검술의 시너지 · 전용 검술 카드 피해 +${CFG.odin.yeji}`);else if(ch.aff&&ch.aff.name==='중지')P.push(`버프 · 되갚음의 예지 · 전투 시작 되갚음 +${CFG.odin.midStart} · 라운드마다 첫 피격에 되갚음 +${CFG.odin.midHit} (회피 보정 없음)`);else P.push(`버프 · 순간의 예지 · 첫 라운드 회피 +${CFG.odin.first}, 이후 +${CFG.odin.after}`)}
    if(ch.resonance)P.push('궁니르 공명 · 궁니르 카드를 낸 라운드 받는 피해 −60%');
    return P.length?`<div class="passives">${P.map(t=>`<div class="mono small"><span style="color:var(--gold)">◆</span> ${esc(t)}</div>`).join('')}</div>`:'';
  }
  function vHud(){
    const ch=G.ch,s=ch.stats,nx=E.xpNext(ch);
    return `<div class="panel stack">
      <div class="row between"><div class="row"><span class="swatch" style="background:${ch.color}"></span><b class="serif" style="color:${ch.color}">${titledName(ch)}</b><span class="small" style="color:${ch.color}">${E.rankLabel(ch)}</span>${affLabel(ch)}${ch.hard?'<span class="small bad">하드</span>':ch.easy?'<span class="small good">쉬움</span>':''}</div>
      <span class="mono small dim">${E.age(G)}세 · ${G.year>CFG.years?`${G.year}년차 · ${G.infinite&&G.year>CFG.years+CFG.endless.span*CFG.endless.grades.length?'제 2막 무한 모드 · '+(E.gradeRaw(G.year)-CFG.endless.grades.length+1)+'단계':'제 2막 · '+CFG.endless.grades[E.gradeAt(G.year)]}`:`${G.year}/${CFG.years}년차`}</span></div>
      ${bar(ch.hp,s.maxHp)}
      ${vMind(ch)}${egoBar(ch)}${G.infinite&&UI.screen!=='end'?`<button class="btn quiet" data-a="outerend">외곽에서 이야기를 끝낸다</button>`:''}
      ${vPassive(ch)}
      <div class="mono small dim hud-dup">HP ${ch.hp}/${s.maxHp} · 공격 ${sg(s.atk)} · 회피 ${sg(s.eva)} · 속도 ${sg(s.spd)} · 판정 ${sg(s.check)} · 카드 ${ch.deck.length}장</div>
      <div class="mono small dim hud-dup">Lv ${ch.lv} · 경험치 ${ch.xp}${nx!=null?'/'+nx:' (최고)'}${E.canPromote(ch)?` · ${E.ptsName(ch)} ${ch.pp||0}/${E.promoNeed(ch)}`:''} · ${Object.values(ch.gear).map(g=>esc(g.n)).join(' · ')}</div>
      <div class="row between"><span class="mono small" style="color:var(--gold)">자산 ${E.money(ch.money)}${G.lastIncome&&UI.showIncome?` <span class="dim">(올해 수입 +${E.money(G.lastIncome)})</span>`:''}</span>
        </div>
      ${vDock('dock-in')}
    </div>`;
  }
  /* ===== 6시즌: 가방 =====
     HUD 오른쪽의 네모 칸(능력치·장비·카드·전리품)을 누르면 가방을 열듯 화면이 펼쳐진다 */
  const ICON={family:'<path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.500-7 10-7 10z"/>',stat:'<path d="M4 20V11M10 20V4M16 20v-8M21 20H3"/>',gear:'<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/>',
    card:'<rect x="3" y="7" width="12" height="14" rx="2"/><path d="M8 3h11a2 2 0 0 1 2 2v12"/>',relic:'<path d="M6 3h12l4 6-10 12L2 9zM2 9h20M9 3l3 6 3-6"/>',title:'<path d="M12 3l2.600 5.400 5.900.8-4.300 4.100 1 5.800L12 16.300 6.800 19.100l1-5.800L3.500 9.200l5.900-.8z"/>'};
  const icon=k=>`<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round" stroke-linecap="round" aria-hidden="true">${ICON[k]}</svg>`;
  /* 칭호칸: 직급·특색 칭호, 보스를 쓰러뜨려 얻은 추가 칭호, 루트의 표식(가주 후보 등) */
  const MARKNOTE={'가주 후보':'가주의 명으로 후계 경쟁에 나선 몸이다. 다른 후보들과 겨루게 된다.','홍원의 가주':'홍원의 가주 자리에 올랐다.'};
  const titleList=ch=>[...(ch.title?[[ch.title,'']]:[]),...(ch.titles||[]).map(t=>[t,'']),...(ch.marks||[]).map(m=>[m,MARKNOTE[m]||''])];
  const eqTitle=ch=>ch.equipTitle&&titleList(ch).some(t=>t[0]===ch.equipTitle)?ch.equipTitle:'';
  const titledName=ch=>{const t=eqTitle(ch);return (t?`<span class="ctitle">[${esc(t)}]</span><br>`:'')+esc(ch.name||T.you)};
  const entName=X=>X.tt&&X.name.startsWith(`[${X.tt}] `)?`<span class="ctitle">[${esc(X.tt)}]</span><br>${ulName(X.name.slice(X.tt.length+3),X.ul)}`:ulName(X.name,X.ul);
  function bagTabs(ch){return [['stat','출생',''],['gear','장비',(ch.stash||[]).length?'보관 '+ch.stash.length:''],['card','카드',ch.deck.length+'/'+E.deckMax(ch)],['relic','전리품',(ch.relics||[]).length?String(ch.relics.length):'']].concat([['title','칭호',titleList(ch).length?String(titleList(ch).length):'']]).concat(ch.bond&&['met','married','lost'].includes(ch.bond.st)?[['family','가족',ch.bond.st==='married'?'♥':'']]:[])}
  /* PC 넓은 화면(1360px 이상) 왼쪽 수치판: 기본 능력치를 숫자로 늘 보여 준다. 좁은 화면에서는 CSS로 숨긴다. 나중에 칸을 늘려 가기 쉽게 항목 목록으로 만든다 */
  function vSideL(P){
    const ch=G.ch,s=ch.stats,pad=(k,v)=>`<div class="srow"><span>${k}</span><b>${v}</b></div>`,up=n=>n?` <i class="bufup">${n>0?'+':'−'}${Math.abs(n)}</i>`:'';
    const rows=[['HP',P?`${Math.max(0,P.hp)}/${P.maxHp}`:`${ch.hp}/${s.maxHp}`],['정신력',ch.distForm?'뒤틀림':`${ch.mind}/${E.mindMax(ch)}`],['공격',sg(s.atk)+(P?up(P.atk-s.atk):'')],['회피',sg(s.eva)+(P?up((P.evaB||0)):'')],['속도',sg(s.spd)+(P?up(P.spd-s.spd):'')],['판정',sg(s.check)],['최소 피해',s.dmin],...(s.dr?[['피해 감소',s.dr+'%']]:[]),...(s.regen?[['HP 회복/라운드',s.regen]]:[]),...(s.startBleed?[['시작 출혈',s.startBleed]]:[]),...(s.startBreath?[['시작 호흡',s.startBreath]]:[]),['카드',`${ch.deck.length}/${E.deckMax(ch)}`],['레벨',`Lv ${ch.lv}`],['경험치',E.xpNext(ch)!=null?`${ch.xp}/${E.xpNext(ch)}`:`${ch.xp} (최고)`],...(E.canPromote(ch)?[[E.ptsName(ch),`${ch.pp||0}/${E.promoNeed(ch)}`]]:[]),['자산',E.money(ch.money)]];
    const gear=Object.entries(D.slots).map(([k,n])=>`<div class="srow"><span>${n}</span><b class="gname">${ch.gear[k]?esc(ch.gear[k].n):'없음'}</b></div>`).join('');
    return `<aside class="side-l" aria-label="수치판"><div class="stitle">${titledName(ch)}</div>${rows.map(([k,v])=>pad(k,v)).join('')}<div class="ssep"></div>${gear}</aside>`;
  }
  function vDock(cls){
    const ch=G.ch;
    return `<div class="dock ${cls}">${bagTabs(ch).map(([k,n,b])=>`<button class="tile" data-a="bag" data-i="${k}" aria-label="가방 · ${n}">${icon(k)}<span>${n}</span>${b?`<em>${b}</em>`:''}</button>`).join('')}</div>`;
  }
  /* 카드 종류: 공격 · 회피 · 방어(보호막) · 버프, 그리고 상대에게 키워드를 거는 카드는 디버프 표시 */
  const KIND={atk:['공격','#c9715e'],eva:['회피','#5f95c9'],def:['방어','#55b39c'],buff:['버프','#c8a35a'],debuff:['디버프','#a77bd0']};
  const cardKind=c=>c.t==='def'?'eva':c.shield?'def':c.t==='buff'?'buff':'atk';
  const isDebuff=c=>(c.kw||[]).some(k=>k[2]!=='s');
  const kindBadge=c=>{const k=cardKind(c);return `<span class="kb" style="--kc:${KIND[k][1]}">${KIND[k][0]}</span>${isDebuff(c)?`<span class="kb" style="--kc:${KIND.debuff[1]}">디버프</span>`:''}`};
  function cardRow(id,acts){
    const ch=G.ch,c=D.cards[id],g_=E.cardGrade(ch.year,ch),wx_=ch.gear.weapon&&ch.gear.weapon.wx||null,ga=c.t==='atk'&&g_.n;
    return `<div class="invc" style="--kc:${KIND[cardKind(c)][1]}"><span class="cost">${c.c}</span><div class="stack" style="gap:3px;min-width:0"><div class="row" style="gap:6px">${kindBadge(c)}<b>${esc(c.n)}${ga?` <span style="color:var(--gold)">${g_.n}</span>`:''}</b></div>
      <div class="small dim">${cardLine(c,c.t==='atk'?g_:null,wx_)||''}${c.shield&&CFG.cardGrade.indexOf(g_)>0?` (지금 보호막 ${c.shield+5*CFG.cardGrade.indexOf(g_)})`:''}</div>${c.kw?`<span class="chips">${kwChips(c)}</span>`:''}</div>${acts?`<div class="acts">${acts}</div>`:''}</div>`;
  }
  function cardMatch(c){
    const f=UI.cf||{};
    if(f.k&&f.k!=='all'&&(f.k==='debuff'?!isDebuff(c):cardKind(c)!==f.k))return false;
    if(f.kw&&!(c.kw||[]).some(k=>k[0]===f.kw))return false;
    if(f.q&&!(c.n+' '+(c.d||'')).includes(f.q))return false;
    return true;
  }
  function cardListHtml(){
    const ch=G.ch,S=CFG.shop,can=!ch.deckLocked&&!ch.cardMoney&&UI.screen!=='combat',side=ch.side||[];
    const deck=ch.deck.map((id,i)=>({id,i})).filter(x=>cardMatch(D.cards[x.id]));
    const sd=side.map((id,i)=>({id,i})).filter(x=>cardMatch(D.cards[x.id]));
    const out=can&&ch.deck.length>S.minDeck,inn=can&&E.deckRoom(ch);const xo=i=>UI.screen!=='combat'&&ch.deck.length>S.minDeck&&E.extraOut(ch,i);
    const dl=deck.map(({id,i})=>cardRow(id,out&&!D.cards[id].fixed?`<button class="chip" data-a="dout" data-i="${i}">카드함으로</button>`:xo(i)?`<button class="chip" data-a="dout" data-i="${i}">덱에서 빼기</button>`:D.cards[id].fixed?'<span class="small dim">전용 · 뺄 수 없다</span>':'')).join('')||'<p class="small dim">조건에 맞는 카드가 없다.</p>';
    const sl=sd.map(({id,i})=>cardRow(id,can?`${inn?`<button class="chip" data-a="din" data-i="${i}">덱에 넣기</button>`:''}${ch.cardMoney?'':`<button class="chip${UI.dropAsk===i?' warn':''}" data-a="sdrop" data-i="${i}">${UI.dropAsk===i?'정말 버린다':'버리기'}</button>`}`:'')).join('');
    return `<div class="row between"><span class="eyebrow">덱 ${ch.deck.length}/${E.deckMax(ch)}</span>${ch.deckLocked||ch.cardMoney?`<span class="small dim">${ch.deckLocked?'덱 고정':'전용 카드팩'} · 넣고 뺄 수 없다</span>`:''}</div><div class="invcards">${dl}</div>
      <div class="row between" style="margin-top:6px"><span class="eyebrow">카드함 ${side.length}</span>${side.length&&!inn&&can?'<span class="small dim">덱이 가득 찼다. 먼저 덱에서 빼야 넣을 수 있다</span>':''}</div>
      <div class="invcards">${sl||`<p class="small dim">${side.length?'조건에 맞는 카드가 없다.':'비어 있다. 덱에서 뺀 카드와 덱이 가득 찼을 때 얻은 카드가 여기에 모인다.'}</p>`}</div>`;
  }
  function vCards(){
    const f=UI.cf=UI.cf||{k:'all'};
    const kinds=[['all','전체'],['atk','공격'],['debuff','디버프'],['buff','버프'],['eva','회피'],['def','방어']];
    return `<p class="small dim">덱에는 최대 ${E.deckMax(G.ch)}장을 넣는다. 전투 밖이면 언제든 덱과 카드함 사이에서 카드를 옮길 수 있고, 덱은 ${CFG.shop.minDeck}장보다 줄일 수 없다.</p>
      <div class="seg kinds">${kinds.map(([k,n])=>`<button class="${(f.k||'all')===k?'on':''}" data-a="cfk" data-i="${k}"${KIND[k]?` style="--kc:${KIND[k][1]}"`:''}>${n}</button>`).join('')}</div>
      <div class="row" style="gap:6px;flex-wrap:wrap">${Object.keys(D.keywords).map(k=>`<button class="chip${f.kw===k?' on':''}" data-a="cfw" data-i="${k}" style="color:${kwc(k)};border-color:${kwc(k)}">${D.keywords[k].n}</button>`).join('')}
        <input id="cardq" value="${esc(f.q||'')}" placeholder="카드 이름 찾기" autocomplete="off" style="flex:1;min-width:8em"></div>
      <div class="stack" style="gap:8px" id="cardlist">${cardListHtml()}</div>`;
  }
  const FXN={maxHp:'최대 HP',atk:'공격',eva:'회피',spd:'속도',check:'판정',dmin:'피해 최소',dr:'피해 감소(%)',regen:'라운드마다 HP 회복',die:'피해 주사위',dmgB:'피해',burnHit:'붉은 화염',startBleed:'시작 출혈',startBreath:'시작 호흡',defUp:'방어 회피',extraD2:'추가 피해'};
  function fxDiff(nw,old){
    const a=nw.fx||{},b=(old&&old.fx)||{};
    return [...new Set([...Object.keys(a),...Object.keys(b)])].filter(k=>FXN[k]&&(a[k]||0)!==(b[k]||0))
      .map(k=>`<span class="${(a[k]||0)>(b[k]||0)?'good':'bad'}">${FXN[k]} ${sg((a[k]||0)-(b[k]||0))}</span>`).join(' · ');
  }
  function vGear(){
    const ch=G.ch,st=ch.stash||[],cbt=UI.screen==='combat';
    const eq=Object.entries(D.slots).map(([k,n])=>{const g=ch.gear[k];return `<div class="invr"><span>${n}</span><b>${g?esc(g.n):'<span class="dim">없음</span>'}</b><span class="mono small" style="color:var(--gold)">${g?esc(g.e||''):''}</span></div>`}).join('');
    const sl=st.map((g,i)=>{const cur=ch.gear[g.slot],df=fxDiff(g,cur);
      return `<div class="invr stash"><span>${D.slots[g.slot]}</span><div class="stack" style="gap:2px;min-width:0"><b>${esc(g.n)}</b><span class="mono small" style="color:var(--gold)">${esc(g.e||'')}</span>${df?`<span class="mono small">지금 장비보다 · ${df}</span>`:''}</div>
        ${cbt?'<span class="small dim">전투 중 교체 불가</span>':`<button class="chip" data-a="eqs" data-i="${i}">장착</button>`}</div>`}).join('');
    const w=ch.gear.weapon,need=E.bonNeed(ch);
    const up=w&&w.id==='bonatelli'?`<div class="panel stack" style="gap:6px;border-color:var(--gold)"><div class="row between"><b class="serif">${esc(w.n)}</b><span class="mono" style="color:var(--gold)">강화 ${w.lvl}/${CFG.bon.max}</span></div>
      ${need==null?'<p class="small dim">최대로 강화했다.</p>':`<p class="small">보관함의 장비 하나를 녹여 한 단계 강화한다. 다음 단계 재료 · ${need?need+'등급 이상':'아무 장비'}${need>=5?' (유물·히든 장비)':''}</p>
        <p class="mono small">다음 단계 · ${esc(E.bonItem(w.lvl+1).e)}</p>
        ${cbt?'<p class="small dim">전투 중에는 강화할 수 없다.</p>':st.map((g,i)=>(g.grade||0)>=need?`<button class="chip${UI.bonAsk===i?' warn':''}" data-a="bonup" data-i="${i}">${UI.bonAsk===i?'정말 '+esc(g.n)+'을(를) 녹인다':esc(g.n)+' 재료로 쓰기'}</button>`:'').join(' ')||'<p class="small dim">재료로 쓸 수 있는 장비가 보관함에 없다.</p>'}`}</div>`:'';
    return `<div><span class="eyebrow">장착 중</span>${eq}</div>${up}
      <div><span class="eyebrow">보관함 ${st.length}</span>${sl||'<p class="small dim">보관함이 비어 있다. 새 장비를 얻으면 장착할지 보관할지 고를 수 있고, 장착하면 이전 장비가 여기로 온다.</p>'}</div>
      ${st.length?`<p class="small dim">장착을 누르면 같은 칸의 지금 장비와 자리를 바꾼다. 아무것도 사라지지 않는다.</p>`:''}`;
  }
  function vStat(){
    const ch=G.ch,s0=ch.s0,sgn=n=>(n>0?'+':n<0?'−':'')+Math.abs(n);
    const eff=x=>x&&x.e?`<span class="mono small" style="color:var(--gold)">${esc(x.e)}</span>`:'';
    const row=(lab,x)=>`<div class="roll"><span class="mono small dim">${lab}</span><div class="n"><b>${esc(x.n)}</b>${x.t?`<span>${esc(x.t)}</span>`:''}${eff(x)}</div></div>`;
    const kid=(ch.kid||[]).map(k=>row(k.age+'세',k.x)).join('');
    const base=s0?[['최대 HP',s0.maxHp],['공격',sgn(s0.atk)],['회피',sgn(s0.eva)],['속도',sgn(s0.spd)],['사건 판정',sgn(s0.check)]].map(([a,b])=>`<div class="invr"><span>${a}</span><b class="mono">${b}</b></div>`).join(''):'';
    return `<div class="stack" style="gap:10px"><h2>${esc(ch.name||T.you)}는 이렇게 태어났다</h2>
      ${ch.blank?'<p class="small dim">출신 · 재능 · 결점 · 무기 없이 성장기 보정만 가지고 태어났다.</p>':`<div class="panel">${row('출신',ch.o)}${row('재능',ch.t)}${row('결점',ch.f)}${row('무기',ch.w)}</div>`}
      ${kid?`<div class="eyebrow">성장기</div><div class="panel">${kid}</div>`:''}
      ${base?`<div class="eyebrow">태어났을 때의 능력치 (변하지 않음)</div><div class="panel">${base}</div>`:''}
      <div class="eyebrow">지금 · 장비 보정과 특수 상태</div>${vStatNow()}</div>`;
  }
  function vStatNow(){
    const ch=G.ch,s=ch.stats,gear=Object.values(ch.gear);
    const gsum=k=>gear.reduce((a,g)=>a+((g.fx||{})[k]||0),0);
    const row=(l,v,k)=>{const g=k?gsum(k):0;return `<div class="invr"><span>${l}</span><b class="mono">${v}</b><span class="mono small dim">${g?'장비 '+sg(g):''}</span></div>`};
    return `<div>${[row('최대 HP',s.maxHp,'maxHp'),row('공격 (명중 보정)',sg(s.atk),'atk'),row('회피',sg(s.eva),'eva'),row('속도 (순서 보정)',sg(s.spd),'spd'),
      row('사건 판정',sg(s.check),'check'),row('피해 주사위 최소',s.dmin,null),...(s.dr?[row('피해 감소',s.dr+'%',null)]:[]),...(s.regen?[row('라운드마다 HP 회복',s.regen,null)]:[]),row('전투 시작 출혈',s.startBleed,null),row('전투 시작 호흡',s.startBreath,null),
      ...(s.defUp?[row('방어 카드 회피 추가',sg(s.defUp),null)]:[]),...(s.adv?[row('첫 공격 명중 두 번 굴림',s.adv>=1?'있음':Math.round(s.adv*100)+'% 확률',null)]:[]),
      row('카드 등급',E.cardGrade(ch.year,ch).n||'기본',null),...(ch.corp&&ch.corp.type&&['dev','wing'].includes(ch.corp.st)?[row('특이점 · '+esc(ch.corp.n),`${CFG.corp.types[ch.corp.type].e}${ch.corp.wing?' · '+esc(ch.corp.wing):''}`,null)]:[]),...(E.isN(ch)?[row('N사 · 의체 심판',`의수를 쓰지 않는다 · 신체 강화 공격 +${CFG.nWing.atk} · 회피 +${CFG.nWing.eva} · 속도 +${CFG.nWing.spd} · 의체 상대 적중마다 피해 +${CFG.nWing.augDmg}`,null)]:[]),...(ch.aff&&ch.aff.name==='중지'?[row('중지 · 되갚음','맞을 때마다 1 (최대 5) · 다음 적중 +2×스택',null)]:[]),...(ch.aff&&ch.aff.name==='검지'?[row('검지 · 지령 수행',`☆ 칸 카드를 내면 1 (최대 5) · 호흡 +4 · 받는 피해 −5%×스택 · 가득 찬 뒤 ${CFG.prescPlus.every}번 더 수행할 때마다 카드 수치(피해 · 회피 · 보호막) +1 (최대 +${CFG.prescPlus.max})`,null)]:[]),...(ch.office?[row('내 사무소',esc(ch.office.name)+' · '+E.OKW[ch.office.kw],null)]:[]),...((ch.auth||[]).length?[row('조율자 권한',ch.auth.length+'단계 ('+ch.auth.map(a=>a==='seal'?'봉인':'집행').join('·')+')',null)]:[])].join('')}</div>`;
  }
  function vTitleBag(){
    const L=titleList(G.ch);
    const cur=eqTitle(G.ch);
    return L.length?`<div><p class="small dim">칭호를 장착하면 이름 위에 [칭호]로 표시된다.</p>${L.map(([n,d],i)=>`<div class="invr rel"><span>${esc(n)}${d?`<br><b class="mono small dim">${esc(d)}</b>`:''}</span><button class="chip${cur===n?' on':''}" data-a="titleeq" data-i="${i}">${cur===n?'장착 중 · 해제':'장착'}</button></div>`).join('')}</div>`:'<p class="small dim">아직 얻은 칭호가 없다. 직급·특색 칭호나 보스 처치 칭호를 얻으면 여기에 모인다.</p>';
  }
  function vRelic(){
    const ch=G.ch;
    return (ch.relics||[]).length?`<div>${ch.relics.map(n=>{const e=Object.values(D.enemies).find(x=>x.drop&&x.drop.n===n),r=Object.values(D.relics||{}).find(x=>x.n===n),nt=(D.relicNotes||{})[n];return `<div class="invr rel"><span>${esc(n)}</span><b class="mono" style="color:var(--gold)">${e?esc(e.drop.e):r?esc(r.e):nt?esc(nt):''}</b></div>`}).join('')}</div>`:'<p class="small dim">아직 전리품이 없다. 숨은 보스를 이기면 얻는다.</p>';
  }
  function sheet(inner,cls,closable){
    return `<div class="ov"><div class="ovbg"${closable?' data-a="bagclose"':''}></div><div class="sheet ${cls}" role="dialog" aria-modal="true">${inner}</div></div>`;
  }
  function vBag(){
    const ch=G.ch,t=UI.bag;
    const body={stat:vStat,gear:vGear,card:vCards,relic:vRelic,family:vFamily,title:vTitleBag}[t]();
    return sheet(`<div class="row between" style="flex-wrap:nowrap;gap:8px"><b class="serif">가방</b><span class="mono small" style="color:var(--gold);margin-left:auto">자산 ${E.money(ch.money)}</span><button class="chip" data-a="bagclose">닫기 ✕</button></div>
      <div class="bagtabs">${bagTabs(ch).map(([k,n,b])=>`<button class="tile sm${t===k?' on':''}" data-a="bag" data-i="${k}">${icon(k)}<span>${n}</span>${b?`<em>${b}</em>`:''}</button>`).join('')}</div>
      <div class="stack" style="gap:10px">${body}</div>`,'bag',true);
  }
  /* 새 장비·새 카드: 받기 전에 고른다 (장비가 몰래 바뀌지 않게) */
  function vOffer(){
    const ch=G.ch;
    /* 전용 카드팩 제안은 장비보다 먼저 보여 준다 (전리품을 얻자마자 바로 고른다) */
    if((ch.gearOffers||[]).length&&!ch.packOffer){
      const it=ch.gearOffers[0],cur=ch.gear[it.slot],df=fxDiff(it,cur);
      return sheet(`<span class="eyebrow">새 장비 · ${D.slots[it.slot]}${ch.gearOffers.length>1?` · 남은 ${ch.gearOffers.length}개`:''}</span><h2>${esc(it.n)}</h2>
        <div class="cmp"><div class="panel stack" style="gap:4px"><span class="eyebrow">지금 장착 중</span><b>${cur?esc(cur.n):'없음'}</b><span class="mono small dim">${cur?esc(cur.e||''):''}</span></div>
          <div class="panel stack" style="gap:4px;border-color:var(--gold)"><span class="eyebrow">새 장비</span><b>${esc(it.n)}</b><span class="mono small" style="color:var(--gold)">${esc(it.e||'')}</span>${it.t?`<span class="small dim" style="line-height:1.55">${esc(it.t)}</span>`:''}</div></div>
        <div class="mono small">바꾸면 · ${df||'능력치 변화 없음'}</div>
        <button class="btn primary" data-a="gwear">장착한다${cur?` · ${esc(cur.n)}은(는) 보관함으로`:''}</button>
        <button class="btn" data-a="gkeep">보관함에 넣어 둔다</button>
        <p class="small dim">보관함의 장비는 전투 밖이면 언제든 가방 → 장비에서 바꿔 낄 수 있다.</p>`,'offer',false);
    }
    if(ch.packOffer){const P=ch.packOffer,cnt={};P.cards.forEach(id=>cnt[id]=(cnt[id]||0)+1);
      return sheet(`<span class="eyebrow">전용 책장 · ${P.cards.length}장</span><h2>${esc(P.n)}으로 덱을 바꿀까</h2>
        <div class="check" style="border-color:var(--bleed)"><b class="bad">주의 · 영구 적용</b><br>바꾸면 지금 덱 ${ch.deck.length}장과 카드함 ${(ch.side||[]).length}장이 모두 사라지고 덱이 고정된다. 이후 카드를 지우거나 옮기거나 다시 바꿀 수 없고, 새 카드는 돈으로 받는다.</div>
        ${P.e?`<div class="check"><b>패시브</b> · ${esc(P.e)}</div>`:''}
        <div class="invcards">${Object.keys(cnt).map(id=>cardRow(id,cnt[id]>1?`<span class="mono small dim">×${cnt[id]}</span>`:'')).join('')}</div>
        <button class="btn${UI.packAsk?' primary':''}" data-a="packyes">${UI.packAsk?'정말 바꾼다 (되돌릴 수 없다)':'이 책장으로 바꾼다'}</button>
        <button class="btn primary" data-a="packno">지금 덱을 지킨다</button>
        <p class="small dim">지금 덱을 지키면 이 책장은 사라진다. 다른 전리품은 그대로 받는다.</p>`,'offer',false)}
    const cid=ch.offers[0],room=E.deckRoom(ch),many=ch.offers.length>1?` · 남은 ${ch.offers.length}장`:'';
    if(UI.swap)return sheet(`<span class="eyebrow">덱의 카드와 바꾸기 · 빠진 카드는 카드함으로</span>${cardRow(cid)}
      <div class="invcards">${ch.deck.map((id,j)=>cardRow(id,D.cards[id].fixed?'<span class="small dim">전용 · 바꿀 수 없다</span>':`<button class="chip" data-a="oswap" data-i="${j}">이 카드와 바꾼다</button>`)).join('')}</div>
      <button class="btn" data-a="oswapmode">돌아가기</button>`,'offer',false);
    return sheet(`<span class="eyebrow">카드 발견 · 덱 ${ch.deck.length}/${E.deckMax(ch)}${many}</span><h2>받을까, 버릴까</h2>${cardRow(cid)}
      ${room?'<button class="btn primary" data-a="otake" data-i="deck">덱에 넣는다</button>':`<button class="btn primary" data-a="oswapmode">덱의 카드와 바꾼다</button><p class="small dim">덱이 가득 찼다 (최대 ${E.deckMax(ch)}장).</p>`}
      <button class="btn" data-a="otake" data-i="side">카드함에 넣어 둔다</button>
      <button class="btn quiet" data-a="odrop">버린다</button>`,'offer',false);
  }
  /* 공방: 등급별 목록. 들어갈 수 없는 등급은 조건을 보여 준다 */
  function vBlack(){
    if(!(UI.stock||[]).length)return '';
    const ch=G.ch;
    const items=UI.stock.map(id=>{const it=D.special[id],st=E.canBuySpecial(ch,id);
      const note=st==='owned'?(it.perm?'이미 받음':'장착 중'):st==='stash'?'보관 중':st==='distort'?'뒤틀린 몸 · 장비를 쥘 수 없다':st==='nwing'?'N사 날개 · 의체를 쓰지 않는다':st==='money'?'돈이 모자란다':it.perm?'영구 강화':`${D.slots[it.slot]} 교체${ch.gear[it.slot]?' · 지금 '+esc(ch.gear[it.slot].n):''}`;
      return `<button class="btn" data-a="bspecial" data-i="${id}" ${st==='ok'?'':'disabled'}><span class="row between"><b>${it.n}</b><span class="mono" style="color:var(--gold)">${E.money(it.price)}</span></span>
        <span class="mono" style="color:var(--gold)">${it.e}</span><span class="mono small dim">${note}</span></button>`}).join('');
    const B=CFG.blackCard,box=UI.cardBox?`<div class="panel stack" style="gap:8px;border-color:${KIND.debuff[1]}"><div class="row between"><b class="serif">수상한 카드 상자</b><span class="mono" style="color:var(--gold)">${E.money(B.price)}</span></div>
      <p class="small dim">원하는 쪽을 말하면 그런 카드 한 장을 꺼내 준다. 무엇이 나올지는 모른다. 이번 방문에 한 번.</p>
      ${UI.boxDone?`<p class="good small">${UI.boxDone}</p>`:ch.deckLocked||ch.cardMoney?'<p class="small dim">덱이 고정되어 카드를 받을 수 없다.</p>':`<div class="row" style="gap:8px">${[['debuff','디버프 카드'],['buff','버프 · 회피 카드']].map(([k,n])=>`<button class="btn" style="flex:1" data-a="box" data-i="${k}" ${ch.money<B.price?'disabled':''}><b>${n}</b><span class="small dim">${k==='debuff'?'상대에게 출혈·파열·화상':'호흡·회피 등 나를 돕는 카드'}</span></button>`).join('')}</div>${ch.money<B.price?'<p class="small dim">돈이 모자란다.</p>':''}`}</div>`:'';
    const AID=CFG.blackAid,aid=UI.aid?`<div class="panel stack" style="gap:8px;border-color:${KIND.buff[1]}"><b class="serif">응급 거래</b><p class="small dim">구석 상인이 낡은 카드 두 장을 슬쩍 내민다. 같은 카드는 최대 ${AID.max}장까지 지닐 수 있다.</p>
      ${ch.deckLocked||ch.cardMoney?'<p class="small dim">덱이 고정되어 카드를 받을 수 없다.</p>':Object.keys(AID.price).map(id=>{const c=D.cards[id],n=E.aidCount(ch,id),ok=n<AID.max&&ch.money>=AID.price[id];return `<button class="btn" data-a="aid" data-i="${id}" ${ok?'':'disabled'}><span class="row between"><b>${c.n}</b><span class="mono" style="color:var(--gold)">${E.money(AID.price[id])}</span></span><span class="small dim">${c.d.replace(' (암시장 전용)','')}</span><span class="mono small dim">${n>=AID.max?'더는 지닐 수 없다':`지닌 수 ${n}/${AID.max}`}</span></button>`}).join('')}</div>`:'';
    return `<div class="panel stack" style="gap:8px;border-color:var(--bleed)"><div class="row between"><b class="serif">암시장</b><span class="chip">이번 방문만</span></div>
      <p class="small dim">출처를 묻지 않는 물건들. 이번에 지나가면 다음엔 다른 물건이 나온다.</p><div class="stack">${items}</div>${box}${aid}</div>`;
  }
  /* 공방 치유소 · 암시장 K사 엠플 */
  function vClinic(){
    const ch=G.ch,K=CFG.clinic,A=CFG.ample,n=UI.healed||0,left=K.max-n,cp=E.clinicPrice(ch),full=ch.hp>=ch.stats.maxHp,ok=left>0&&!full&&ch.money>=cp;
    const ap=E.ampPrice(ch),have=ch.ample||0,bought=ch.ampleBought||0,aok=have<A.carry&&bought<A.limit&&ch.money>=ap;
    return `<div class="panel stack" style="gap:8px"><div class="row between"><b class="serif">치유소</b><span class="mono" style="color:var(--gold)">${E.money(cp)} · 이번 방문 ${n}/${K.max}</span></div>
      <p class="small dim">돈을 내고 상처를 치료한다. 한 번에 HP ${K.hp} 회복. 치료를 받을 때마다 값이 ${E.money(K.step)}씩 오른다 (이번 판 ${ch.healBought||0}번 받음).</p>
      ${UI.healMsg?`<p class="good small">${esc(UI.healMsg)}</p>`:''}
      <button class="btn" data-a="heal" ${ok?'':'disabled'}><b>치료 받는다</b><span class="mono small dim">HP ${ch.hp}/${ch.stats.maxHp}${full?' · 이미 멀쩡하다':left<=0?' · 오늘은 더 받을 수 없다':ch.money<cp?' · 돈이 모자란다':''}</span></button></div>
    ${hwHome()?'':`<div class="panel stack" style="gap:8px;border-color:var(--bleed)"><div class="row between"><b class="serif">${A.name}</b><span class="mono" style="color:var(--gold)">${E.money(ap)}</span></div>
      <p class="small dim">암시장에서 도는 전리품. 전투 중 HP가 최대 HP의 ${Math.round(A.belowPct*100)}% 이하가 되면 자동으로 쓰여 최대 HP의 ${Math.round(A.healPct*100)}%를 회복한다. 한 번에 쓰러질 만한 피해를 받으면 쓰러지기 전에 먼저 쓰이고(받은 피해만큼 회복이 줄어든다), 전투 중 횟수 제한 없이 한 번에 1개씩 쓰이고, 최대 ${A.carry}개까지 지닌다. 쓰고 나면 다음 공방에서 다시 살 수 있지만, 한 판에 모두 ${A.limit}개까지만 살 수 있다.</p>
      <button class="btn" data-a="ample" ${aok?'':'disabled'}><b>${A.name} 구입</b><span class="mono small dim">지닌 수 ${have}/${A.carry} · 산 수 ${bought}/${A.limit}${bought>=A.limit?' · 더는 살 수 없다':have>=A.carry?' · 더는 지닐 수 없다':ch.money<ap?' · 돈이 모자란다':''}</span></button></div>`}`;
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
      const items=Object.entries(D.items).filter(([,it])=>it.grade===w.grade).filter(([id,it],_i,all)=>!hwHome()||all.filter(([,x])=>x.slot===it.slot).sort((a,b)=>a[1].price-b[1].price)[0][0]===id).map(([id,it])=>{
        const st=E.canBuy(ch,id),cur=ch.gear[it.slot];
        const note=st==='owned'?'장착 중':st==='stash'?'보관 중':st==='money'?'돈이 모자란다':st==='distort'?'뒤틀린 몸 · 장비를 쥘 수 없다':st==='nwing'?'N사 날개 · 의체를 쓰지 않는다':st==='locked'?'잠김':`${D.slots[it.slot]} 교체${cur?' · 지금 '+esc(cur.n):''}`;
        if(UI.buyAsk===id&&st==='ok')return `<div class="panel stack" style="gap:8px;border-color:var(--gold)"><div class="row between"><b>${it.n}</b><span class="mono" style="color:var(--gold)">${E.money(E.priceOf(ch,id))}</span></div><span class="mono" style="color:var(--gold)">${it.e}</span><span class="small dim">${D.slots[it.slot]}${cur?' · 지금 '+esc(cur.n)+'은(는) 보관함으로 간다':''} · 이 장비를 맞출까?</span><div class="row" style="gap:8px"><button class="btn primary" data-a="buyok" data-i="${id}">맞춘다</button><button class="btn quiet" data-a="buyno">취소</button></div></div>`;
        return `<button class="btn" data-a="buy" data-i="${id}" ${st==='ok'?'':'disabled'}><span class="row between"><b>${it.n}</b><span class="mono" style="color:var(--gold)">${E.isWs(ch)?`<s class="dim">${E.money(it.price)}</s> `:''}${E.money(E.priceOf(ch,id))}</span></span>
          <span class="mono" style="color:var(--gold)">${it.e}</span><span class="mono small dim">${D.slots[it.slot]} · ${note}</span></button>`;
      }).join('');
      return `<div class="panel stack" style="gap:8px${open?'':';opacity:.6'}"><div class="row between"><b class="serif">${hwHome()?HWSHOP[w.grade-1][0]:w.n}</b><span class="chip${open?'':' dim'}">${w.grade}등급${open?'':' · 잠김'}</span></div>
        <p class="small dim">${hwHome()?HWSHOP[w.grade-1][1]:w.t}${open?'':' 들어가려면 '+need(w.grade)+'.'}</p>${open?`<div class="stack">${items}</div>`:''}</div>`;
    }).join('');
    const gear=Object.entries(D.slots).map(([k,n])=>`<span class="chip">${n} · ${ch.gear[k]?esc(ch.gear[k].n):'없음'}</span>`).join('');
    return `${vHud()}<div class="moneybar"><span>자산</span><b class="mono">${E.money(ch.money)}</b></div><div class="stack" style="gap:6px"><div class="eyebrow">${hwHome()?'홍원의 저잣거리':'공방'} · 내 등급 ${acc}</div><h2>무엇을 맞출까</h2>
      <div class="chips">${gear}</div>${UI.bought?`<p class="good small">${esc(UI.bought)}을(를) 맞췄다.</p>`:''}</div>${shops}${vClinic()}${vBlack()}${vSell()}${vSwapCard()}${vTune()}
      <button class="btn primary" data-a="unshop">${hwHome()?'저잣거리를 나간다':'공방을 나간다'}</button>`;
  }
  /* 공방 해결사: 보관함 장비 판매 */
  function vSell(){
    const ch=G.ch;if(!E.isWs(ch))return '';const st=ch.stash||[];
    return `<div class="panel stack" style="gap:8px"><div class="row between"><b class="serif">보관함 팔기</b><span class="chip">공방 해결사</span></div>
      <p class="small dim">보관함에 있는 장비를 공방에 넘긴다. 장착 중인 장비는 팔 수 없다.</p>
      ${UI.sold?`<p class="good small">${esc(UI.sold)}</p>`:''}
      ${st.length?st.map((g,i)=>`<button class="btn" data-a="sell" data-i="${i}"><span class="row between"><b>${esc(g.n)}</b><span class="mono" style="color:var(--gold)">+${E.money(E.sellValue(g))}</span></span><span class="mono small dim">${D.slots[g.slot]} · ${esc(g.e||'')}</span></button>`).join(''):'<p class="small dim">보관함이 비어 있다.</p>'}</div>`;
  }
  /* 공방: 카드 교환 (방문마다 swapMax장까지, 일반 보상 카드 무작위로) */
  function vSwapCard(){
    if(G.ch.deckLocked||G.ch.cardMoney)return `<div class="panel stack" style="gap:6px"><b class="serif">카드 교환</b><p class="small dim">${G.ch.deckLocked?'덱이 고정되었다':'전용 검술을 익힌 몸이다'}. 카드를 바꿀 수 없다.</p></div>`;
    const ch=G.ch,S=CFG.shop,sw=UI.swapped||[],left=S.swapMax-sw.length,can=left>0&&ch.money>=S.swapCost;
    return `<div class="panel stack" style="gap:8px"><div class="row between"><b class="serif">카드 교환</b><span class="mono" style="color:var(--gold)">${E.money(S.swapCost)} · 이번 방문 ${sw.length}/${S.swapMax}</span></div>
      <p class="small dim">덱의 카드 한 장을 일반 전투에서 얻을 수 있는 카드 중 무작위 한 장으로 바꾼다. 무엇이 나올지는 모른다. 공방에 들를 때마다 ${S.swapMax}장까지.</p>
      ${sw.length?`<p class="good small">${sw.map(([a,b])=>`${esc(a)} → ${esc(b)}`).join(' · ')}</p>`:''}
      ${left>0?`<div class="chips">${ch.deck.map((id,i)=>D.cards[id].fixed?'':`<button class="chip" data-a="swapcard" data-i="${i}" ${can?'':'disabled'}>${D.cards[id].n} ⇄</button>`).join('')}</div>`:''}
      ${left>0&&!can?'<p class="small dim">돈이 모자란다.</p>':''}${left<=0?'<p class="small dim">이번 방문에는 더 바꿀 수 없다.</p>':''}</div>`;
  }
  /* 공방: 장비 정비 (장착 장비마다 최대 tune.max번, chance% 확률로 공격 또는 회피 +1) */
  function vTune(){
    const ch=G.ch,T=Object.assign({},CFG.shop.tune,{max:E.tuneMax(G.ch)}),slots=Object.keys(ch.gear).filter(k=>ch.gear[k]);
    const rows=slots.map(k=>{const g=ch.gear[k],n=g.tries||0,full=n>=T.max,cost=E.tuneCost(g),tn=g.tune||{},ok=!full&&ch.money>=cost&&!ch.distForm;
      return `<div class="stack" style="gap:4px;border-top:1px solid var(--line,#2a2f3a);padding-top:6px"><div class="row between"><b>${esc(g.n)}</b><span class="mono small dim">정비 ${n}/${T.max}${tn.atk||tn.eva?` · 공격+${tn.atk||0} 회피+${tn.eva||0}`:''}</span></div>
        ${full?'<p class="small dim">더는 정비할 수 없다.</p>':`<div class="row" style="gap:8px"><button class="btn" style="flex:1" data-a="tune" data-i="${k}" data-s="atk" ${ok?'':'disabled'}><b>공격 +1 시도</b><span class="mono small" style="color:var(--gold)">${E.money(cost)}</span></button><button class="btn" style="flex:1" data-a="tune" data-i="${k}" data-s="eva" ${ok?'':'disabled'}><b>회피 +1 시도</b><span class="mono small" style="color:var(--gold)">${E.money(cost)}</span></button></div>`}</div>`}).join('');
    return `<div class="panel stack" style="gap:8px"><div class="row between"><b class="serif">장비 정비</b><span class="chip">${T.chance}% 성공</span></div>
      <p class="small dim">장착한 장비 하나에 공격 또는 회피 +1을 시도한다. 성공하면 고른 쪽만 오르고, 실패해도 시도 횟수는 소모된다. 장비마다 ${T.max}번까지.</p>
      ${UI.tuneMsg?`<p class="${UI.tuneMsg.ok?'good':'bad'} small">${esc(UI.tuneMsg.t)}</p>`:''}
      ${ch.distForm?'<p class="small dim">뒤틀린 몸은 장비를 쥘 수 없다.</p>':rows||'<p class="small dim">장착한 장비가 없다.</p>'}</div>`;
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
      <li><b>${D.keywords.bleed.n}</b> 공격할 때마다(빗나가도) 스택만큼 피해, 그 뒤 1 감소. 내가 방어 자세면 절반으로 지혈. <b>${D.keywords.rupture.n}</b> 피격 시 스택만큼 추가 피해, 피격마다 1 감소. <b>${D.keywords.ink.n}</b> 라운드가 끝날 때 스택당 ${CFG.ink.dmg} 피해(내가 받으면 ${CFG.ink.dmgMe}), 그 뒤 스택이 절반으로 줄어든다. 최대 ${CFG.ink.cap}스택. <b>${D.keywords.burn.n}</b> 라운드가 끝날 때 스택당 ${CFG.burn.dmg} 피해(내가 받으면 ${CFG.burn.dmgMe}), 그 뒤 스택이 절반으로 줄어든다. 최대 ${CFG.burn.max}스택이고, 적이 거는 화상은 쌓이는 양이 절반이다. <b>${D.keywords.flame.n}</b>(레바테인 전용) 받는 피해 ×1.5, 라운드 끝에 1 감소. ${CFG.laev.blueAt}스택 이상이면 <b>푸른 화염</b>이 되어 받는 피해 ×${CFG.laev.blueMul}, 라운드 끝에 스택당 ${CFG.laev.blueDot} 피해를 주고 1 감소한다. 일반 디버프 스택의 최대치는 ${CFG.stackCap}이다. <b>${D.keywords.breath.n}</b> 최대 ${CFG.breath.cap}, 라운드마다 ${CFG.breath.decay} 줄어든다. 4~9는 치명 ${CFG.breath.base}%에서 90%까지(×${CFG.critMult}), ${CFG.breath.sure} 이상은 확정 치명, 1~${CFG.breath.evaMax}는 회피 +${CFG.breath.eva}. 방어 카드를 내면 내 출혈·파열이 1/4 줄어든다(적도 같다).</li>
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
    const left=Math.max(0,Math.ceil((EXP-Date.now())/60000)),t=left>=120?`약 ${Math.floor(left/60)}시간`:`약 ${left}분`;
    return `<div class="check" style="border-color:var(--bleed)"><b>테스트 서버</b> · ${new Date(EXP).toLocaleString('ko-KR',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'})}까지 (${t} 남음)<br><span class="small">실시간으로 고치고 있어 중간에 화면이 바뀌거나 이어서 하기가 깨질 수 있다. 정식 기록은 본 서버에서.</span></div>`;
  }
  function vTitle(){
    return `<div class="stack" style="gap:6px;padding-top:12px"><div class="eyebrow">Project Moon 팬메이드 · 비공식 · 비영리 · ${VERSION}</div>
      <h1>도시의 한 해</h1></div>
      <p class="lead">주사위로 태어나 열여섯 해를 자라고, 그 뒤 최대 ${CFG.years}년을 직접 살아낸다. 한 해에 사건이 하나씩 찾아오고, 가끔은 칼을 뽑아야 한다.</p>
      ${vUpdates()}
      ${vPlaytest()}
      <div class="stack">${vContinue()}${vHardToggle()}<button class="btn ${loadSave()?'':'primary'}" data-a="start" ${expired()?'disabled':''}>${loadSave()?'<b>새로 시작하기</b><span class="dim small">저장된 판은 지워진다</span>':'태어난다'}</button>
      ${UI.confirmNew?`<p class="small bad">저장된 판이 지워진다. 정말 새로 시작하려면 ${UI.confirmNew==='daily'?'오늘의 시드':'새로 시작하기'}를 한 번 더 누른다.</p>`:''}
      <button class="btn" data-a="daily" ${expired()?'disabled':''}><b>오늘의 시드</b><span class="dim small">${todayKey()} · 오늘은 모두가 같은 출생으로 시작한다</span></button>
      <button class="btn quiet" data-a="records"><b>기록실</b><span class="dim small">만난 적 · 본 엔딩 · 해금 · 최고 기록</span></button>
      <button class="btn quiet" data-a="sim"><b>밸런스 측정</b><span class="dim small">자동 전투를 수백 번 돌려 승률을 본다 (만난 적만 공개)</span></button>
      <a class="btn quiet" href="${CFG.feedbackUrl}" target="_blank" rel="noopener noreferrer" style="text-decoration:none;color:inherit"><b>의견·버그 제보</b><span class="dim small">구글 폼이 새 탭에서 열린다 · 게임 버전(${UPDATES.v})을 함께 적어 주세요</span></a>
      <div class="panel stack" style="gap:4px"><span class="eyebrow">지금 고민 중인 방향</span>
        <ul class="small dim" style="margin:0;padding-left:18px;display:grid;gap:3px">${DIRECTION.map(t=>`<li>${esc(t)}</li>`).join('')}</ul></div></div>
      ${vSettings()}${vRules()}${vPast()}${vTransfer()}`;
  }
  function vContinue(){
    const o=loadSave();if(!o)return '';const c=o.G.ch,y=o.G.year;
    const when=new Date(o.t).toLocaleString('ko-KR',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'});
    return `<button class="btn primary" data-a="cont"><b>이어서 하기</b><span class="small">${esc(c.name||'이름 없는 사람')} · ${E.rankLabel(c)} · ${y}년차 · ${CFG.startAge+y-1}세</span><span class="dim small">${when} 저장${o.v!==UPDATES.v?` · ${o.v} 저장본`:''}</span></button>`;
  }
  /* 기록실 */
  /* 난이도: easy(쉬움) / normal(보통) / hard(하드). 예전 하드 켜기 설정(cityYearHard)도 이어 받는다 */
  const diff=()=>{const v=store.get(DIFFK);return v==='easy'||v==='normal'||v==='hard'?v:(store.get(HARDK)==='1'?'hard':'normal')};
  const isHard=()=>diff()==='hard',isEasy=()=>diff()==='easy';
  function vHardToggle(){
    const d=diff(),X=CFG.hard,Z=CFG.easy,b=(k,l)=>`<button class="${d===k?'on':''}" data-a="diff" data-i="${k}">${l}</button>`;
    const info={easy:`<b class="serif">쉬움 · 수동 플레이 권장</b><span class="small dim">해마다 늘어나는 적 강화와 히든 보스 후반 성장을 없앤, 처음 설정한 약한 적으로 맞춘다. 직접 카드와 선택을 고르며 완주를 노리는 플레이를 기준으로 맞췄고, 히든 보스의 최소한의 강함은 남아 있다.</span>`,
      normal:`<b class="serif">보통 · 기본</b><span class="small dim">기존 그대로의 기본 난이도. 적이 해마다 강해진다.</span>`,
      hard:`<b class="serif">하드 · 도전</b><span class="small dim">모든 적 체력 ×${X.hp} · 공격 +${X.atk} · 회피 +${X.eva}. 쓰러지기 쉽다.</span>`}[d];
    return `<div class="stack" style="gap:6px"><span class="eyebrow">난이도 · 새로 태어날 때부터 적용</span><div class="seg">${b('easy','쉬움')}${b('normal','보통')}${b('hard','하드')}</div>
      <div class="panel stack" style="gap:3px;padding:10px 12px">${info}</div></div>`}
  const TITLE_REC=['본부 직속','특이점 부서','상석',CFG.nWing.eastTitle,'피의 왈츠','엄지를 넘어선 자','정해진 운명','곰과 범을 넘어선 자','의리를 지킨 자','의리를 찢은 자','끝내 갚지 않은 자','배신자를 갚은 자','허무를 넘어선 자','특색'];
  /* 기록실 힌트: 아직 열리지 않은 칭호와 엔딩이 어떤 길 끝에 있는지 짐작만 하게 한다 */
  const TITLE_HINT={'본부 직속':'협회 최고 자리에 올라 본부의 부름을 넘긴다','특이점 부서':'날개 임원에 오른 뒤 핵심 부서의 심사를 통과한다','상석':'손가락의 서열 맨 위에서 마지막 부름을 통과한다',[CFG.nWing.eastTitle]:'동쪽 외곽 출신으로 N사 날개에 들어가 끝까지 오른다','피의 왈츠':'인연과 함께 핏빛 존재와 맞선다','엄지를 넘어선 자':'엄지의 아랫 조직 끝에서 엄지에게 칼을 뽑는다','정해진 운명':'엄지의 가장 높은 이에게 맞섰다가 쓰러진다','곰과 범을 넘어선 자':'검계의 끝에서 본국의 칼을 마주한다','의리를 지킨 자':'중지의 동생이 되어 받은 장부를 갚고 큰누님의 여섯 대를 버틴다','배신자를 갚은 자':'큰형님이 되어 큰누님을 쓰러뜨린 뒤, 달아난 마티아스를 쫓는다','허무를 넘어선 자':'격리 실패의 환상체 네 마리를 모두 쓰러뜨린 뒤, 하나가 된 무언가를 마주한다','의리를 찢은 자':'중지의 마지막 장부를 받아들이지 않고 찢는다','끝내 갚지 않은 자':'의리를 찢은 뒤 쫓아오는 중지의 사슬을 끊어낸다','특색':'해결사 1급에서 도시가 색을 불러 줄지 심사를 받는다'};
  const END_HINT={hwlose:'붉은 누각의 등이 켜진다',hwhost:'가주의 자리에 앉는다',hwfree:'가주의 자리에 앉는다',hwbreak:'철함사를 친다',rcorp:'존재를 끝까지 증명한다',death:'어딘가에서 쓰러진다',mind:'정신력이 0이 된다',distort:'정신력이 한계에 닿아 몸이 뒤틀린다',win:CFG.years+'년을 끝까지 산다',true:'제 2막 마지막 등급을 넘는다',outer:'무한 모드에서 스스로 외곽에서 끝낸다',out_seal:'무한 모드에서 외곽의 괴수를 여러 번 쓰러뜨린다',out_star:'무한 모드에서 이름난 상대를 아주 많이 이긴다',out_settle:'무한 모드에서 가족과 오래 산다',distwin:'뒤틀린 채로 '+CFG.years+'년을 넘긴다',old:'무한 모드에서 백 살을 넘겨 산다',blank:'어떤 보정도 없이 시작해, 결혼하지 않은 채 '+CFG.years+'년을 채우고 제 2막으로 이어 가지 않고 끝낸다',blankwed:'그렇게 시작해 결혼한 채 '+CFG.years+'년을 채우고 제 2막으로 이어 가지 않고 끝낸다',wed:'결혼한 채 '+CFG.years+'년을 채우고 제 2막으로 이어 가지 않고 끝낸다',lovekill:'뒤틀린 채 사랑하던 이에게 쓰러진다'};
  const hintRow=(open,label,hint)=>`<div style="display:grid;grid-template-columns:auto minmax(0,1fr);gap:8px;align-items:baseline"><span class="chip${open?'':' dim'}" style="justify-self:start">${open?label:'???'}</span>${open?'':`<span class="small dim">${esc(hint||'')}</span>`}</div>`;
  function vRecords(){
    const r=loadRec(),X=CFG.endless,u=loadUnlocks();
    const ends=[['rcorp','나는 존재한다'],['hwhost','선황충을 품은 가주'],['hwlose','홍원 군주의 탄생'],['hwfree','홍원의 가주'],['hwbreak','철함사의 목을 친 가주'],['death','쓰러짐'],['mind','정신 붕괴'],['distort','뒤틀림'],['win',CFG.years+'년 완주'],['true','발톱과 조율자 너머'],['outer','외곽에서 끝낸 이야기'],['out_seal','균열이 닫힌 외곽'],['out_star','도시의 별'],['out_settle','외곽의 작은 집'],['distwin','뒤틀린 채 완주'],['old','늙어도 살아남은'],['blank','아무것도 없는 존재'],['blankwed','아무것도 없는 존재 · 가족'],['wed','함께 넘은 첫 번째 막'],['lovekill','사랑하던 이의 손에']];
    const groups=[['초반','early'],['중반','mid'],['후반','late'],['보스·이름난 상대','boss'],['히든','hidden']];
    const foes=g=>Object.entries(D.enemies).filter(([,e])=>e.tier===g);
    const total=Object.keys(D.enemies).length;
    return `<div class="stack" style="gap:6px;padding-top:12px"><div class="eyebrow">이 브라우저의 기록</div><h2>기록실</h2></div>
      <div class="panel stack" style="gap:6px"><span class="eyebrow">최고 기록</span>
        <div class="row between"><span>가장 오래 산 햇수</span><b class="mono">${r.best.years}년</b></div>
        ${r.hardClear?`<div class="row between"><span>하드 완주</span><b class="mono">${r.hardClear}회</b></div>`:''}${r.easyClear?`<div class="row between"><span>쉬움 완주</span><b class="mono">${r.easyClear}회</b></div>`:''}
        <div class="row between"><span>최고 레벨</span><b class="mono">${r.best.lv||'—'}</b></div>
        <div class="row between"><span>도달한 위협 등급</span><b class="mono">${r.best.grade>=0?X.grades[r.best.grade]:'—'}</b></div>
        <div class="row between"><span>끝낸 판</span><b class="mono">${r.runs}</b></div></div>
      <div class="panel stack" style="gap:6px"><span class="eyebrow">칭호 · 최고 등급에 오른 횟수</span><div class="stack" style="gap:6px">${TITLE_REC.map(n=>{const c=(r.titles||{})[n]||0;return hintRow(c,`${esc(n)} ×${c}`,TITLE_HINT[n])}).join('')}</div></div>
      ${(()=>{const GR=[['날개','wing'],['협회','assoc'],['사무소','office'],['손가락','finger'],['조직','syn']],all=GR.flatMap(([,k])=>D.orgs[k]||[]),got=(r.affs||[]).filter(n=>all.includes(n));
        return `<div class="panel stack" style="gap:8px"><span class="eyebrow">소속 ${got.length}/${all.length}</span>${GR.map(([n,k])=>`<div><span class="small dim">${n}</span><div class="chips">${(D.orgs[k]||[]).map(o=>`<span class="chip${(r.affs||[]).includes(o)?'':' dim'}">${(r.affs||[]).includes(o)?esc(o):'???'}</span>`).join('')}</div></div>`).join('')}<p class="small dim">한 번이라도 들어간 소속이 열린다.</p></div>`})()}
      <div class="panel stack" style="gap:6px"><span class="eyebrow">엔딩 ${r.endings.length}/${ends.length}</span><div class="stack" style="gap:6px">${ends.map(([k,n])=>hintRow(r.endings.includes(k),esc(n),END_HINT[k])).join('')}</div></div>
      <div class="panel stack" style="gap:6px"><span class="eyebrow">타고난 것 ${r.innate.length}/${Object.keys(D.innate).length}</span><div class="chips">${Object.entries(D.innate).map(([k,v])=>`<span class="chip${r.innate.includes(k)?'':' dim'}">${r.innate.includes(k)?esc(v.n):'???'}</span>`).join('')}</div></div>
      ${vJobs()}
      <div class="panel stack" style="gap:8px"><span class="eyebrow">만난 상대 ${r.seen.filter(id=>D.enemies[id]).length}/${total} · 이긴 상대 ${r.beaten.filter(id=>D.enemies[id]).length}</span>
        ${groups.map(([n,g])=>{const l=foes(g);return l.length?`<div><span class="small dim">${n}</span><div class="chips">${l.map(([id,e])=>`<span class="chip${r.seen.includes(id)?'':' dim'}" ${r.beaten.includes(id)?`style="color:${e.color};border-color:${e.color}"`:''}>${r.seen.includes(id)?esc(e.n)+(r.beaten.includes(id)?' ✓':''):'???'}</span>`).join('')}</div></div>`:''}).join('')}
        <p class="small dim">✓ 표시는 한 번 이상 이긴 상대. 기록은 이 브라우저에만 남는다.</p></div>
      <button class="btn primary" data-a="title">돌아가기</button>`;
  }
  /* 이번 업데이트: 처음 화면에서 접어 둔다 */
  const DIRECTION=['하드 난이도와 후반 난이도는 제보를 보며 계속 손봅니다.','테섭에서 시험 중인 새 시스템의 수치는 의견을 보고 조정하고, 본섭에 넣을 시기를 정합니다.','자동 전투 속도와 연출 설정은 쓰면서 불편한 점을 제보로 알려 주세요.'];
  const UPDATES={v:VERSION,items:[]};
  /* 공지: id가 바뀔 때만 한 번 뜬다 (버전·소폭 조정과 무관). 새 공지를 띄울 때만 id를 바꾼다 */
  /* v6.0 공지 본문 (v6.0.2부터는 첫 화면 '이번 업데이트'에서만 함께 보여 준다) */
  const V6SEC=[['🎒 화면과 편의',['가방: 화면 오른쪽 네모 칸(능력치·장비·카드·전리품)을 누르면 가방이 열립니다.','카드 정리: 카드마다 종류(공격·디버프·버프·회피·방어)가 색으로 표시되고, 종류·키워드·이름으로 찾을 수 있습니다.','출생 화면: 주사위와 함께 결과 이름이 굴러가고, "출생 규칙"에서 표 전체를 볼 수 있습니다.']],
      ['🃏 덱과 장비',['덱 최대 12장: 남는 카드는 카드함에 두고 전투 밖에서 넣고 뺄 수 있습니다.','받을지 고르기: 보상 카드와 새 장비는 받을지 고르고, 장비는 지금 것과 비교한 뒤 장착하거나 보관합니다. 장비가 몰래 바뀌지 않습니다.','전용 책장: 정해진 카드팩으로만 싸우는 덱입니다. 덱이 고정되어 지우기·옮기기가 막히고, 새 카드는 돈으로 받습니다.','암시장 카드 상자: 가끔 열리고, 원하는 테마의 카드를 한 장 얻을 수 있습니다.']],
      ['🏢 진로',['세계관 사무소: 지금 급수에 맞는 사무소가 문을 엽니다.','내 사무소: 5급 이상 해결사는 직접 사무소를 차려 이름을 짓고, 3년마다 전문 분야의 카드·장비를 알선받습니다.','손가락: 엄지·검지·중지·약지마다 사건·심사·패시브가 따로 생겼습니다.','특색·상석 심사: 최대 3번까지 도전할 수 있습니다.','공방 거리: 공방을 이용하지 않고 쉬어 가며 정신력을 회복할 수 있습니다.']],
      ['⚔ 적',['중반·후반 적: 세력별 일반 적과 보스가 크게 늘었습니다(약 3배). 후반에는 이름이 붙은 네임드 적이 나옵니다.','적 특성: 적마다 무리·겁쟁이·굳은살·재생 같은 특성이 생겼습니다.','격리 실패: 환상체는 이제 특수 사건으로만 나타납니다. 종류가 늘고 더 강해졌으며, 맞설지 숨을지 고를 수 있습니다.']],
      ['🔒 숨겨진 것',['히든 루트와 숨은 출생 2개가 추가되었습니다.','아주 드물게, 감당할 수 없는 것이 나타난다는 소문도 있습니다.','어디에 있는지는 직접 찾아보세요.']],
      ['⚠ 알아 두세요',['밸런스는 아직 조정 중이라 앞으로 수치가 조금씩 바뀔 수 있습니다.','5버전에서 하던 "이어서 하기" 저장은 새 규칙과 맞지 않을 수 있어서, 새로 시작하는 것을 권장합니다.']]];
  /* v6.0.2 공지 본문 (v6.0.3부터는 첫 화면 '이번 업데이트'에서만 함께 보여 준다) */
  const V602SEC=[['🛠 버그 수정',['사무소에 들어간 해결사가 1급에 올라도 승급 심사만 반복되고 특색 심사가 열리지 않던 문제를 고쳤습니다. 승급에 필요한 실적 계산도 바로잡았고, 전체를 소폭 낮췄습니다.','카드를 받을 때 "덱의 카드와 바꾼다"로 뺄 수 없는 고정 카드를 카드함으로 빼낼 수 있던 문제를 고쳤습니다. 이미 빠진 고정 카드는 다음 해에 덱으로 돌아옵니다.','단테의 노트·검지 단말기 배경에서 PC 화면 오른쪽의 가방 네모 칸(능력치·장비·카드·전리품)이 보이지 않던 문제를 고쳤습니다.','PC 창이 좁을 때(약 900~1020px) 가방 칸이 본문을 가리던 문제도 함께 고쳤습니다. 이 폭에서는 가방 칸이 상단 정보 안에 들어갑니다.']]];
  /* v6.0.3 공지 본문 (v6.0.4부터는 첫 화면 '이번 업데이트'에서만 함께 보여 준다) */
  const V603SEC=[['🛠 버그 수정 · 성장 효과',['재능 "타고난 완력"과 성장기 "어깨너머 손질"의 "피해 주사위 최소 2" 효과가 캐릭터를 만들 때 출생 무기를 끼면서 지워지던 문제를 고쳤습니다. 두 효과를 얻고도 적용되지 않던 판이 모두 해당합니다.','두 효과는 이제 각각 "피해 주사위 최소 +1"입니다. 둘이 겹치면 +2로 더해지고, 장비의 피해 최소값(예: 명장의 대검 3)과도 더해집니다. 합계는 최대 4까지입니다.','이미 진행 중인 판은 다음 해로 넘어갈 때 재능·성장기를 확인해 자동으로 반영됩니다.']]];
  /* v6.0.4 공지 본문 (v7.0.4부터는 첫 화면 '이번 업데이트'에서만 함께 보여 준다) */
  const V604SEC=[['🔒 지난 새 소식 (날개·소지)',['날개에서 무언가 일어나는 것 같습니다. 오래 살아남은 날개의 사람에게 낯선 제안이 올지도 모릅니다.','소지의 얼굴을 한 사람들 사이에서도 이상한 소문이 돕니다. 한참 뒤에야 닿는 곳에서 누군가 기다리고 있다고 합니다.','어떤 길인지, 어디로 이어지는지는 직접 확인해 보세요.']]];
  const V732SEC=[['🖐 중지 강화',['맞아야 강해지는 중지가 후반에 버티기 어렵다는 의견이 있어 서열 패시브를 추가했습니다.','중지의 세 번째 서열 이름이 "형님"에서 "작은형님"으로 바뀌었고, 패시브 "근성"으로 받는 피해가 10% 줄어듭니다.','큰형님은 패시브 "초근성"으로 받는 피해가 30% 줄어듭니다.']],
      ['⚡ 속도',['속도의 영향이 커졌습니다. 선공 판정이 "1d100 + 속도"에서 "1d100 + 속도×2"로 바뀌었습니다.','선공을 놓친 쪽이 받는 추격 보정은 +10에서 +5로 줄었습니다.','공격하는 쪽의 속도가 상대보다 5 높을 때마다 명중이 +1 오릅니다. 최대 +4이고, 적에게도 같은 규칙이 적용됩니다.']],
      ['🧠 정신력',['정신력 보정 구간이 세분화되었습니다. 11 · 15 · 20 · 26 · 32 · 40 이상에서 호흡과 회피 보정이 단계적으로 붙습니다. 최대 보정은 이전과 같고, 정신력이 낮은 구간에서도 보정을 받습니다.','정신력이 20 · 25 · 30 · 35 · 40 · 45 이상일 때마다 모든 능력치(공격 · 회피 · 속도 · 최대 HP · 판정)가 +1 오릅니다. 45에서는 +6입니다.','E.G.O 개화 판정 난이도가 낮아졌습니다. 보정이 없을 때 개화 확률이 약 14%에서 약 40%가 됩니다.']],
      ['🩹 K사 엠플 조정',['전투 중 자동으로 HP를 크게 회복하는 효과가 너무 강하다는 의견이 있어 조정했습니다.','가격은 5,000안으로 통일했습니다. 무한 모드 이후에도 같은 값입니다.','지닐 수 있는 수는 그대로 최대 3개입니다. 한 판에 살 수 있는 수는 모두 5개로 제한됩니다.','자동으로 회복하는 양이 60에서 50으로 줄었습니다.']],
      ['🔧 버그 수정',['날개에서 해고되어도 날개를 세우는 길(특이점 개발)이 이어지던 문제를 고쳤습니다. 날개를 잃으면 개발이 중단됩니다.','직접 세운 날개의 대표가 소속이 비어 있으면 공방이 1등급으로 잠기고 해결사로 등록되던 문제를 고쳤습니다. 대표는 날개 임원과 같은 공방 등급을 받고 해결사를 겸할 수 없습니다. 이미 등록된 저장본은 다음 해로 넘어갈 때 정리됩니다.','일부 숨은 길에서 직급과 해결사 급수가 맞지 않던 문제를 고쳤습니다.']],
      ['🙏 감사합니다',['의견과 제보를 주신 모든 분들께 감사드립니다.']]];
  const NOTICE={id:'v8.1.0',t:'도시의 한 해 '+VERSION+' · 새 소식',
    note:'이 공지는 업데이트 이후 처음 새로 고침한 분께 한 번만 표시됩니다. 확인을 누르면 다시 뜨지 않고, 첫 화면의 "이번 업데이트"에서 다시 볼 수 있습니다.',
    sec:[['🆕 v8.1.0 새로 들어온 것',['가방에 "칭호" 칸이 생겼습니다. 직급·특색 칭호, 보스를 쓰러뜨려 얻은 추가 칭호, 홍원의 "가주 후보" 같은 표식이 여기에 모입니다. 칭호가 있을 때만 탭이 나옵니다. 칭호를 "장착"하면 상단 카드와 전투 화면에서 이름 위에 [칭호]가 표시됩니다.','홍원 가문의 후계 후보: 흑수 선인에게 재갈을 청해 흑수 부하를 늘릴 수 있습니다. 영생의 단서를 하나 찾을 때마다 최대 세 번, 1d100 45 이상(예물을 올리면 30 이상)이면 재갈 하나를 얻습니다. 실패하면 못 얻습니다.','소 · 용 · 원숭이 · 닭의 재갈은 가주의 것이라 후보는 얻을 수 없고, 가주가 되면 영구히 당신 것이 됩니다.','부하는 최대 6명입니다. 부하가 많을수록 부하가 거드는 피해와 "흑수여, 답하라"의 위력이 커지고, 부하가 넷 이상이면 홍루를 따르는 흑수 한 사람이 네 라운드마다 더 덤벼듭니다.','철함사에서 부하가 4명 이상이면 "철함사의 목을 친다"가 열립니다. 철함사의 가모는 매 라운드 "공허한 순종"을 걸어 내 명중을 깎지만, 부하가 거들 때마다 풀리고 부하가 많을수록 가모가 약해집니다. 이긴 뒤에는 새 엔딩이 있습니다.','다른 가주 후보들도 소·용·원숭이·닭의 재갈은 쥐지 못합니다. 쥐·뱀 후보는 흑수 한 사람만 거느리고, 원숭이·닭 후보는 부하 없이 홀로 싸웁니다.','홍원 설정: 홍루를 따르는 흑수는 열 종으로 정해져 있고, 어느 세계선에서는 홍루가 열두 재갈을 모두 모아 홍원의 군주가 되었다고 전해집니다.']],
    ['🔧 v8.1.0 수정',['전리품 칸에 "흑수 · 용"과 "가주 후보 · 흑수 용"이 서로 다른 형식으로 섞여 나오던 표기를 정리했습니다. 가주 후보는 칭호 칸으로 옮겼습니다.','출신 없이 시작할 때 뜨는 운명 선택(R사·H사)에 "운명을 거절한다"를 추가했습니다. 거절하면 아무것도 쥐지 않은 채 그대로 시작해 솔로 엔딩을 노릴 수 있습니다.','칭호 탭이 칭호가 없어도 항상 보입니다.','레벨 상한이 없어졌습니다. 2막에 들어서면 최소 레벨 17이 되고(모자란 만큼 레벨 업), 그 뒤로도 계속 오릅니다 (레벨마다 필요한 경험치가 조금씩 늘어납니다).','레벨 보너스: 레벨 8마다 모든 전투에서 빛과 빛 최대치가 +1 늘어납니다 (8, 16, 24 …).','2막 무한 모드에서 적 HP가 끝없이 불어나던 문제를 막았습니다 (성장 상한 · HP 상한 1천만).','원한의 장부 · 첫 페이지의 "되갚음이 아니면 쓰러뜨릴 수 없다" 규칙을 없앴습니다. 소속과 상관없이 일반 전투처럼 끝낼 수 있습니다.']],
    ['🏮 홍원 가문의 후계 후보 안내',['출신 없이 시작하면 뜨는 운명 선택에서 고를 수 있는 길입니다.','처음에는 홍원 가문 안에서 삽니다. 도시의 일반 사건과 일반 적 대신 홍원 전용 사건과 가문의 적이 나옵니다. 해결사 등록과 갈림길은 없습니다.','공방 거리 대신 "홍원의 저잣거리"를 지납니다. 품목은 적고 K사 엠플은 팔지 않습니다.','가주의 명을 받으면 영생의 단서를 찾아 처음으로 홍원 밖 도시로 나갑니다. 단서는 네 곳이고, 돌아온 뒤 가주 후보로 지명됩니다.','흑수: 흑수환으로 외곽 생물의 특성을 지닌 사람들이고, 재갈을 쥔 사람의 말만 듣습니다. 나갈 때 한 사람, 지명될 때 한 사람이 부하로 붙고, 영생의 단서를 찾아 나선 길에서 흑수 선인을 만나면 재갈을 더 청할 수 있습니다(성공하면 부하가 늘고 실패하면 못 얻습니다). 소·용·원숭이·닭의 재갈은 가주의 것이라 후보는 얻을 수 없습니다. 흑수 카드가 아닌 공격이 적중할 때마다 부하가 순서대로 거들고(부하가 둘이면 한 사람당 피해가 더 큽니다), 맞은 상대에게는 흑수가 남긴 짐승의 흔적 "수흔"이 쌓입니다. "흑수여, 답하라"는 부하 전원이 나서서 때립니다.','홍단: 가문이 자제에게 내리는 강화 시술입니다. 전투 중 매 라운드 시작에 HP를 회복하고, 첫 가문 사건 뒤 2, 출가 때 3, 지명 때 4가 됩니다.','홍원의 장도는 세 단계로 강화되고, 전투에서 이긴 뒤 HP 회복이 +10 늘어납니다.','철함사에서는 선황충을 품거나 거부하는 길 외에, 재갈을 충분히 모았다면 철함사의 가모를 직접 치는 길이 열립니다. 부하가 많을수록 쉬워집니다. 가주 자리를 두고 다른 후보들과 겨루고, 마지막에 가주의 자리가 정해집니다. 이후에는 이어서 계속 살아갈 수 있습니다.']],
    ['🆕 v8.0.8 새로 들어온 것',['출신 없이 시작하면 운명 선택이 항상 뜨고, 운명으로 새로운 길 두 가지를 만날 수 있습니다. 자세한 내용은 직접 확인해 보세요.','배경음악이 재즈풍으로 바뀌었고, 전투에 들어가고 나올 때 소리가 겹치지 않습니다.','인연 선택 결과 문구가 사건마다 달라지고 더 달달해졌습니다.','공방 해결사: 장비 정비를 최대 10번까지 할 수 있고, 히든 장비를 훨씬 비싸게 팔 수 있습니다.','이름 없는 불순물을 쓰러뜨리면 돈과 영구 능력치 보상을 받습니다.']],
    ['🔧 v8.0.8 수정 · 조정',['일반 출생 굴림에서 운명 전용 출신이 잘못 나오던 문제를 고쳤습니다.','제 2막에서 루트 엔딩을 본 뒤 "계속 살아간다"가 뜨지 않아 이어서 할 수 없던 문제를 고쳤습니다.','제 2막 이후 검계 · 밤의 송곳의 배신 사건과 중지의 의리 순례 사건이 나오지 않습니다. (1막에서만 나옵니다)','숨은 출신 일부의 전용 카드 효과와 사건을 고쳤습니다.','디버프 로그에 현재 스택과 최대 스택이 함께 나오고, 최대치에 걸려 덜 오른 경우 실제 오른 양이 표시됩니다.','규칙 요약의 화상 · 붉은 화염 · 푸른 화염 설명과 기록실 엔딩 힌트를 실제 규칙에 맞게 고쳤습니다.','무한 모드에서 균열로 나타나는 히든 보스의 도입부와 전투 표시가 전용 문구로 나옵니다.']],
    ['🛠 v8.0.7 변경',['K사 엠플의 회복량이 최대 HP의 50%로 바뀌었습니다.','기업 루트의 특이점 "혈청"은 라운드마다 HP 5를 회복하고, 강화할 때마다 +2씩 늘어 최대 10까지 오릅니다.','덱이 고정된 상태에서도 사건이 밀어 넣은 카드 중 고정 카드가 아닌 것은 덱에서 뺄 수 있습니다.','밸런스 측정에서 아직 만나지 않은 적은 ???로 가려집니다.','디버프 로그에 현재 스택과 최대 스택이 함께 표시되고, 최대치에 걸려 덜 오른 경우 실제로 오른 양이 나옵니다.','E.G.O 무기 전 등급(TETH · HE · WAW · ALEPH)의 수치가 올랐습니다.','엄지: 탄환이 기본 8발(서열마다 +3)이 되었고, 탄환이 바닥나도 라운드마다 처음 공격에 1발이 돌아옵니다. 예의를 지킬 것 1스택당 상대 명중 감소가 −2가 되었습니다.','보냐텔리 가문: 검 강화 수치와 전용 검술 카드, 처분 표식 효과를 조정했습니다.','제 2막 이후에는 검계 · 밤의 송곳의 배신 사건과 중지의 의리 순례 사건이 나오지 않습니다.','무한 모드에서 히든 보스가 균열을 타고 나타날 때 전용 문구가 나옵니다.','기록실의 엔딩 힌트에 조건을 더 자세히 적었습니다.']],
    ["👫 외곽 동행 의뢰", ["무한 모드 2막 이후, 결혼한 배우자와 함께 외곽 의뢰를 나서는 사건이 가끔 옵니다. 함께 가면 외곽의 적과 같이 싸우고, 이기면 보수를 받습니다.","배우자의 소속에 따라 돕는 방식이 다릅니다.","전투형(해결사 · 조직 등): 매 라운드 배우자가 상대에게 고정 피해를 줍니다.","비전투형(사무소 · 협회 · 날개 연구원 등): 매 라운드 보호막과 HP 회복으로 뒤에서 돕습니다.","수비형(엄지 · 중지 등): 매 라운드 첫 피격을 막아서 피해를 줄이고 반격합니다.","배우자의 급수가 높을수록 도움이 커집니다. 혼자 다녀오는 선택도 있습니다."]], ["🛠 추가 개선", ["K사 엠플이 개선되었습니다. 최대 HP의 20% 이하에서 자동으로 쓰이고, 한 번에 쓰러질 피해(출혈·화상 등 포함)를 받으면 쓰러지기 전에 먼저 쓰입니다(받은 피해만큼 회복이 줄어듭니다). 전투 중 사용 횟수 제한이 없어지고, 사용하면 전투 기록에 눈에 띄는 알림이 뜹니다.","엄지 서열 보정이 올랐습니다. 탄환은 기본 6발입니다.","협회 입회 화면에서 각 협회의 전투 특성을 한 줄로 보여 줍니다.","조율자와 발톱 관련 장비가 전반적으로 강해졌습니다.","손가락 계열 적이 엄지·검지·중지·약지 소속별로 나뉘었습니다. 루트로 마주치는 전투는 그대로입니다.",
"적이 대폭 늘었습니다(초반 13종 · 중반 14종 · 후반 7종). 소속별 적이 더해졌고, 내 소속과 같은 조직의 적은 배신자나 처리 명부에 오른 대상이 아니면 만나지 않습니다.","사건에서 얻는 카드를 받을지 직접 고릅니다.","정신력이 깎이는 사건이 6개 추가되었습니다.","결혼 후 일정 간격마다 해가 넘어가지 않는 달달한 한때가 나옵니다. 배우자의 소속에 맞는 장면이 섞여 나옵니다.","오딘의 눈이 소속에 따라 다른 버프를 줍니다. 중지는 회피 대신 되갚음 쪽 버프를 받습니다.","조율자와 발톱은 일부 금기 사건에서 직업에 맞는 선택지가 나옵니다.","보냐텔리 가문 전용 검술 카드가 검 단계와 연차에 따라 강해집니다.","공방에서 장비를 살 때 확인 단계가 생겼습니다."]], ["🐞 오류 개선", ["개화한 E.G.O 카드를 3번 쓰면 1회용 스킬이 나오지 않던 문제를 고쳤습니다.","일부 적의 되갚음 패시브에 중지 전용 효과가 같이 적용되던 문제를 고쳤습니다.","무한 모드에서 특정 적을 쓰러뜨릴 수 없던 문제를 고쳤습니다.","회피가 높을 때 되갚음을 쌓을 수 없던 문제를 고쳤습니다."]], ["🤝 중지 개선", ["되갚음 스택의 최대치가 5에서 10으로 늘었습니다. 스택 1당 받는 피해 −2, 다음 적중의 추가 피해 +1, 회복 1은 그대로라 최대일 때 효과도 두 배가 됩니다.", "방어 카드(또는 방어 자세)를 낸 라운드에 맞으면, 쌓인 되갚음 스택 × 3의 고정 피해로 바로 반격합니다. 라운드에 한 번이고 스택은 소모하지 않습니다.", "서열이 오를수록 회피가 '피하는 힘'으로는 약해지고, 줄어든 만큼 받는 피해 감소가 됩니다. 효율은 작은형님 50%, 큰형님 0%이고, 줄어든 회피 1당 받는 피해가 0.5%p 줄어듭니다. 근성과 합쳐 최대 50%입니다.", "침잠을 중지에게 걸 때 명중 감소가 절반으로 줄어, 침잠을 써도 되갚음 스택이 덜 막힙니다.", "큰형님이 되면 4코스트 전용 카드 '의리 · 장부 결산'을 받습니다.", "중지 소속 전용의 새 이야기가 생겼습니다. 동생 이상이 되면 장부가 건네지고, 서열을 끝까지 오른 사람에게는 이야기가 이어집니다.", "기록실에 중지 칭호 4개가 추가되었습니다."]], ["💞 손가락별 연인 루트", ["엄지, 검지, 중지, 약지 소속마다 전용 연인 루트가 생겼습니다. 흑운회, 검계, 밤의 송곳과 같은 형식입니다.", "엄지는 서열과 예의의 인연, 검지는 지령과 봉투의 인연, 중지는 가족과 장부의 인연, 약지는 예술과 화실의 인연입니다.", "각 루트에는 만남, 이어지는 장면 3개, 청혼, 결혼, 사별, 이별 문구가 따로 있습니다. 소지는 지금까지처럼 일반 조직의 인연을 씁니다."]], ["🕴 새 조직 3종", ["갈림길에 \"조직원을 따라간다\"가 생겼습니다. 흑운회, 검계, 밤의 송곳 중에서 고릅니다.", "들어가면 전용 책장 8장으로 덱이 바뀌고, 이후 얻는 카드는 돈이 됩니다. 최고 서열에 오르면 전용 카드 2장이 더해져 10장이 됩니다.", "덱이 8장 이상일 때 패시브가 열리고, 10장에서 최종 단계가 됩니다. 8장 아래로 줄이면 패시브가 닫힙니다.", "흑운회: 출혈을 걸거나 맞을 때마다 구름이 쌓이고, 5가 되면 흑운이 되어 피해 주사위가 강해집니다.", "검계: 매 라운드 호흡이 쌓이고, 호흡이 높을수록 모든 카드가 강해집니다. 호흡 10 이상의 적중은 방어와 보호막을 무시합니다.", "밤의 송곳: 속도 굴림이 강해지고, 선공을 잡으면 상대의 회피가 절반이 됩니다. 출혈이 걸린 적에게는 명중이 오릅니다.", "조직마다 서열표와 인연이 따로 있고, 서열을 끝까지 오른 사람에게는 이야기가 이어집니다."]], ["🃏 덱 매수 보정", ["덱이 6장 이상이면 2장마다 공격이 +2 오릅니다. 12장이면 +8입니다. 덱을 꽉 채운 쪽과 압축한 쪽의 격차를 줄이기 위한 조정입니다."]], ["📜 검지 · 지령 수행", ["지령 스택이 가득 찬 뒤 지령 카드를 2번 더 수행할 때마다 카드 수치(피해, 회피, 보호막)가 +1 오릅니다. 최대 +5입니다."]], ["💍 인연과 함께하는 전투", ["일부 전투에서 배우자가 같은 공격을 함께 굴립니다. 피해 주사위 합은 본인과 배우자의 ¾씩을 더한 값입니다.", "피해 주사위 줄에 배우자의 주사위가 따로 나옵니다."]], ["🎒 화면 · 편의", ["가방의 능력치 탭에서 태생 능력치(출신, 재능, 결함, 성장기로 정해진 값)를 따로 볼 수 있습니다.", "아이의 이름을 직접 지을 수 있습니다.","특색 색이 5개 늘었습니다. 분홍빛, 연둣빛, 하늘빛, 자줏빛, 호박빛이고, 직접 고를 때만 쓸 수 있습니다."]], ["⚖ 밸런스 조정", ["일부 전용 책장과 히든 무기의 수치를 조정했습니다.", "히든 보스를 쓰러뜨렸을 때 방어구도 얻을 수 있습니다.","E.G.O가 개화한 사람은 덱 최대 장수가 +2장입니다. 고정 전용 카드 2장(발현, 정신 집중)이 일반 카드 12장 자리를 차지하지 않습니다."]], ["🔥 레바테인 단계 해방", ["봉인된 레바테인이 세 단계로 풀립니다. 레바테인 스택이 20이 되면 1단계 해방, 45가 되면 2단계 해방, 80이 되면 해방 완료입니다.","단계가 오를 때마다 레바테인의 수치가 해방 완료의 25%, 50%, 100%로 커지고, 푸른 불꽃도 단계에 맞게 강해집니다."]], ["🩹 치유소 가격", ["치유소의 회복 비용이 처음은 500안이고, 받을 때마다 500안씩 오릅니다."]], ["🌑 제 2막", ["마지막 등급 전투가 새로운 연전으로 바뀌었습니다. 쓰러뜨리면 이전보다 좋은 전리품이 나옵니다.", "바랄과 제나가 한층 강해졌습니다.","무한 모드는 머리에게 외곽으로 쫓겨난 설정이 되었습니다. 불순물은 \"외곽의 괴수\"로 표기가 바뀌었고, 무한 모드 틀은 그대로입니다.", "무한 모드에 죽는 것 말고도 엔딩이 3개 추가되었습니다. 엔딩을 본 뒤에도 이어서 살 수 있고, \"외곽에서 이야기를 끝낸다\" 버튼은 그대로입니다."]], ["📖 엔딩 · 기록실", ["완주 엔딩에 이 판의 행적을 이야기로 엮은 에필로그가 붙습니다.", "아직 ???인 칭호와 엔딩 옆에 얻는 방법의 힌트가 붙었습니다.","기록실에 소속 기록이 생겼습니다. 날개, 협회, 사무소, 손가락, 조직 중 한 번이라도 들어간 소속이 열립니다."]], ["🙏 감사합니다", ["의견과 제보를 주신 모든 분들께 감사드립니다."]]]};
  const V731SEC=[['🩹 치유소와 K사 엠플',['공방 거리에 치유소가 생겼습니다. 500안을 내면 HP 30을 회복합니다. 한 번 들를 때 3번까지 받을 수 있습니다.','K사 엠플을 공방에서 살 수 있습니다. 3,500안, 최대 3개까지 지닙니다.','전투 중 HP가 30 이하가 되면 자동으로 쓰여 HP를 60 회복합니다. 전투마다 1개까지 쓰이고, 쓰고 나면 다음 공방에서 다시 살 수 있습니다. 무한 모드 이후에는 값이 20,000안으로 오릅니다.']],
      ['🏢 소속 직접 선택',['날개 입사와 협회 입회 때 들어갈 곳을 직접 고릅니다. 날개 6곳, 협회 8곳 중에서 고를 수 있습니다.','사무소 견습에 성공하면 초반 사무소 4곳(윤 · 가로등 · 갈고리 · 새벽) 중에서 고릅니다. 실패해도 윤 사무소나 가로등 사무소 중 한 곳에 무작위로 들어갑니다.','초반 사무소 4곳은 해결사 급수와 상관없이 갈림길과 "사무소 문을 두드린다"에서 고를 수 있습니다.','전용 책장이 없는 K사 · J사 · G사 날개는 카드팩 대신 입사 때 보정치를 더 받습니다. 덱은 일반 카드로 꾸립니다.']],
      ['⚙ 설정과 자동 전투',['타이틀과 출생을 제외한 모든 화면의 오른쪽 위에 설정 버튼(⚙)이 생겼습니다. 어느 화면에서든 연출과 전투 간격을 바꿀 수 있습니다. 자동 전투 중에 열면 전투가 멈추고, 닫으면 이어집니다.','자동 전투 간격이 느림 · 보통 · 조금 빠름 · 빠름 네 단계가 되었습니다. 보통을 이전보다 느리게 했습니다.']],
      ['🩸 파열 · 화상',['파열의 최대 스택이 10에서 20으로 늘었습니다. 출혈은 그대로입니다.','리우 협회 전용 카드에 화상 카드 5장을 추가했습니다.']],
      ['💍 인연 · 가족',['8년차부터 일상 속에서 인연을 만날 수 있습니다. 이름은 직접 정합니다. 만났을 때 지나치면 그 판에서는 인연이 오지 않습니다.','인연이 이어지면 청혼까지 사건이 오고, 결혼하면 보정을 받습니다. 결혼 전에 놓치면 상대가 떠납니다.','결혼 뒤에는 배우자의 죽음이 올 수 있습니다. 금기를 저지르면 그다음 해부터 해마다 2%의 위험이 생기고, 히든 보스를 이길 때마다 위험이 0.1%씩 쌓입니다.','결혼 뒤에는 아이가 태어납니다. 아이는 함께 나이를 먹다가 20세에 사무소, 해결사, 협회 중 한 곳에 들어갑니다. 배우자도 결혼한 햇수에 따라 급수가 오르고, 내가 특색 심사나 최고 직급 심사에 실패하면 배우자가 대신 승급합니다.','뒤틀린 뒤에는 가장 강한 가족(배우자 또는 아이)이 토벌 의뢰로 찾아옵니다. 가족은 내 카드를 그대로 쓰고, 능력치는 내 능력치의 1.1배, 최고 급수는 1.5배로 맞서 옵니다.','아이가 있으면 엔딩마다 추가 문구가 붙습니다.']],
      ['🌤 일상 사건',['3년차부터 능력치가 오르는 안정적인 일상 사건이 열립니다. 한 판에 최대 10번입니다.']],
      ['⚡ 충전 · W사 날개 / R사 날개',['입사하면 충전 전용 책장 8장을 받고, 최고 직급에 오르면 4코스트 카드 2장을 얻어 10장이 됩니다.','충전은 쌓아 두었다가 카드로 소모하면 고정 피해가 붙는 자원입니다.','W사 날개는 라운드마다 충전이 쌓이는 저장형입니다. 맞아도 충전이 줄지 않습니다.','R사 날개는 입사 때 1d3으로 토끼팀, 순록팀, 코뿔소팀이 정해지고, 팀마다 전용 책장과 패시브가 다릅니다.']],
      ['🔨 N사 날개 · 못과 흐트러짐',['N사 날개는 적중할 때마다 상대에게 못이 쌓입니다. 3코스트·4코스트 망치 카드는 쌓인 못을 흐트러짐으로 바꿉니다.','흐트러짐이 쌓일수록 상대가 약해집니다. 3 · 6 · 10에서 단계가 오르고, 상대의 명중이 −8 · −15 · −20 줄며 주는 피해는 줄고 받는 피해는 늘어납니다.','흐트러짐이 상대 등급별 한계에 닿으면 다음 라운드에 기절합니다.','N사 날개는 의체를 쓰지 않습니다.']],
      ['🌊 침잠 · 일반 카드',['상대에게 쌓으면 3스택마다 상대의 명중과 주는 피해가 줄어듭니다. 라운드가 끝나면 1씩 줄어듭니다. 일반 보상 카드 8장이 추가되었습니다.']],
      ['🖐 손가락 개편',['중지: 되갚음 스택 1당 받는 피해가 2 줄어들고, 다음 적중에서 스택을 쓰면 소모한 스택 1당 HP를 1 회복합니다. 대신 되갚음의 추가 피해는 스택당 1로 줄었습니다.','약지: 적중할 때마다 "작품"이 쌓여 명중이 오르고, 가득 차면 다음 적중이 강해집니다. 예술적 감각은 확률이 아니라 적을 3번 쓰러뜨릴 때마다 오릅니다.','소지: 표식을 가진 사람에게 5년마다 사건이 열립니다.']],
      ['🎭 출생',['출생 화면의 출신 · 재능 줄과 성장기 사이에 "다시 태어난다" 버튼이 하나 더 생겼습니다.','출생 화면 맨 아래의 "어떤 출생 보정도 없이 시작한다"를 누르면 출신 · 재능 · 결점 · 무기 · 타고난 것 없이 시작합니다. 성장기 보정만 남고, 맨손에 기본 덱 4장으로 출발합니다.','이 상태로 제 1막을 넘기면 전용 엔딩이 있습니다.']],
      ['📖 기록실',['각 칭호의 최고 등급에 오를 때마다 횟수가 쌓입니다. 기록실에서 "본부 직속 ×44"처럼 몇 번 도달했는지 볼 수 있습니다. 아직 얻지 못한 칭호는 ???로 표시됩니다.','엔딩이 4종 늘어 기록실의 엔딩이 7종에서 11종이 되었습니다. 인연 · 가족과 출생 보정 없이 시작하는 길에서 볼 수 있습니다.']],
      ['🔧 그 밖',['오늘의 시드를 날짜마다 다른 출생으로 정할 수 있게 되었습니다.','히든 요소가 몇 가지 더 늘었습니다.','첫 화면의 "지금 고민 중인 방향"을 최신 내용으로 고쳤습니다.']],
      ['🙏 감사합니다',['의견을 주신 모든 분들께 감사드립니다.']]];
  const V730SEC=[['💍 인연 · 가족',['8년차부터 일상 속에서 인연을 만날 수 있습니다. 이름은 직접 정합니다. 만났을 때 지나치면 그 판에서는 인연이 오지 않습니다.','인연이 이어지면 청혼까지 사건이 오고, 결혼하면 보정을 받습니다. 결혼 전에 놓치면 상대가 떠납니다.','결혼 뒤에는 배우자의 죽음이 올 수 있습니다. 금기를 저지르면 그다음 해부터 해마다 2%의 위험이 생기고, 히든 보스를 이길 때마다 위험이 0.1%씩 쌓입니다.','결혼 뒤에는 아이가 태어납니다. 아이는 함께 나이를 먹다가 20세에 사무소, 해결사, 협회 중 한 곳에 들어갑니다. 배우자도 결혼한 햇수에 따라 급수가 오르고, 내가 특색 심사나 최고 직급 심사에 실패하면 배우자가 대신 승급합니다.','뒤틀린 뒤에는 가장 강한 가족(배우자 또는 아이)이 토벌 의뢰로 찾아옵니다. 가족은 내 카드를 그대로 쓰고, 능력치는 내 능력치의 1.1배, 최고 급수는 1.5배로 맞서 옵니다.','아이가 있으면 엔딩마다 추가 문구가 붙습니다.']],
      ['🌤 일상 사건',['3년차부터 능력치가 오르는 안정적인 일상 사건이 열립니다. 한 판에 최대 10번입니다.']],
      ['⚡ 충전 · W사 날개 / R사 날개',['입사하면 충전 전용 책장 8장을 받고, 최고 직급에 오르면 4코스트 카드 2장을 얻어 10장이 됩니다.','충전은 쌓아 두었다가 카드로 소모하면 고정 피해가 붙는 자원입니다.','W사 날개는 라운드마다 충전이 쌓이는 저장형입니다. 맞아도 충전이 줄지 않습니다.','R사 날개는 입사 때 1d3으로 토끼팀, 순록팀, 코뿔소팀이 정해지고, 팀마다 전용 책장과 패시브가 다릅니다.']],
      ['🔨 N사 날개 · 못과 흐트러짐',['N사 날개는 적중할 때마다 상대에게 못이 쌓입니다. 3코스트·4코스트 망치 카드는 쌓인 못을 흐트러짐으로 바꿉니다.','흐트러짐이 쌓일수록 상대가 약해집니다. 3 · 6 · 10에서 단계가 오르고, 상대의 명중이 −8 · −15 · −20 줄며 주는 피해는 줄고 받는 피해는 늘어납니다.','흐트러짐이 상대 등급별 한계에 닿으면 다음 라운드에 기절합니다.','N사 날개는 의체를 쓰지 않습니다.']],
      ['🌊 침잠 · 일반 카드',['상대에게 쌓으면 3스택마다 상대의 명중과 주는 피해가 줄어듭니다. 라운드가 끝나면 1씩 줄어듭니다. 일반 보상 카드 8장이 추가되었습니다.']],
      ['🖐 손가락 개편',['중지: 되갚음 스택 1당 받는 피해가 2 줄어들고, 다음 적중에서 스택을 쓰면 소모한 스택 1당 HP를 1 회복합니다. 대신 되갚음의 추가 피해는 스택당 1로 줄었습니다.','약지: 적중할 때마다 "작품"이 쌓여 명중이 오르고, 가득 차면 다음 적중이 강해집니다. 예술적 감각은 확률이 아니라 적을 3번 쓰러뜨릴 때마다 오릅니다.','소지: 표식을 가진 사람에게 5년마다 사건이 열립니다.']],
      ['🏢 날개',['전용 책장이 없는 K사 · J사 · G사 날개는 카드팩 대신 입사 때 보정치를 더 받습니다. 덱은 일반 카드로 꾸립니다.','날개를 세우면 직급 표시가 "날개 대표"로 바뀝니다.']],
      ['🎭 출생 보정 없이 시작',['출생 화면 맨 아래의 "어떤 출생 보정도 없이 시작한다"를 누르면 출신 · 재능 · 결점 · 무기 · 타고난 것 없이 시작합니다. 성장기 보정만 남고, 맨손에 기본 덱 4장으로 출발합니다.','이 상태로 제 1막을 넘기면 전용 엔딩이 있습니다.']],
      ['📖 기록실',['각 칭호의 최고 등급에 오를 때마다 횟수가 쌓입니다. 기록실에서 "본부 직속 ×44"처럼 몇 번 도달했는지 볼 수 있습니다. 아직 얻지 못한 칭호는 ???로 표시됩니다.','엔딩이 4종 늘어 기록실의 엔딩이 7종에서 11종이 되었습니다. 인연 · 가족과 출생 보정 없이 시작하는 길에서 볼 수 있습니다.']],
      ['🙏 감사합니다',['의견을 주신 모든 분들께 감사드립니다.']]];
  const V721SEC=[['🩹 치유소와 K사 엠플',['공방 거리에 치유소가 생겼습니다. 500안을 내면 HP 30을 회복합니다. 한 번 들를 때 3번까지 받을 수 있습니다.','K사 엠플을 공방에서 살 수 있습니다. 3,500안, 최대 3개까지 지닙니다.','전투 중 HP가 30 이하가 되면 자동으로 쓰여 HP를 60 회복합니다. 전투마다 1개까지 쓰이고, 쓰고 나면 다음 공방에서 다시 살 수 있습니다.','무한 모드 이후에는 값이 20,000안으로 오릅니다.']],
      ['🖐 손가락 직접 선택',['손가락에 들어갈 때 소지를 뺀 네 손가락(엄지·검지·중지·약지) 중에서 직접 고릅니다.','선택 화면에 각 손가락의 서열과 패시브가 표시됩니다. 검지의 마지막 서열은 "대행자 / 전령"으로 표기합니다. 약지의 첫 서열은 "스튜던트"입니다.']],
      ['🏢 날개·협회 직접 선택',['날개 입사와 협회 입회 때 들어갈 곳을 직접 고릅니다. 날개 6곳, 협회 8곳 중에서 고를 수 있습니다.','날개 임원(최고 직급)에 오르면 공방 3등급(명장)이 열립니다. 이전에는 해결사 급수가 오르지 않아 열리지 않았습니다.','직접 세운 날개가 승진·엔딩에서 입사한 회사 이름으로 보이던 문제를 고쳤습니다.']],
      ['🔥 화상 개편',['화상: 라운드가 끝날 때 스택당 3 피해(내가 받으면 2), 최대 15스택, 그 뒤 스택은 절반이 남습니다. 적이 거는 화상 스택은 절반으로 들어옵니다.','이전의 "화상 대상 추가 피해 ×1.5"는 사라졌습니다. 호흡과 효과가 겹쳤기 때문입니다.','레바테인의 붉은 화염과 푸른 화염은 화상과 별개로 분리했습니다. 레바테인 전용입니다.','카드의 화상이 걸리지 않던 문제를 고쳤습니다.','리우 협회 전용 카드에 화상 카드 5장을 추가했습니다.']],
      ['🩸 파열·보호막',['파열의 최대 스택이 10에서 20으로 늘었습니다. 출혈은 그대로입니다.','보호막은 최대 150까지만 쌓입니다. 최대 체력보다 훨씬 많아지던 문제를 막았습니다.']],
      ['⚙ 설정과 자동 전투',['타이틀과 출생을 제외한 모든 화면의 오른쪽 위에 설정 버튼(⚙)이 생겼습니다. 어느 화면에서든 연출과 전투 간격을 바꿀 수 있습니다. 자동 전투 중에 열면 전투가 멈추고, 닫으면 이어집니다.','자동 전투 간격이 느림 · 보통 · 조금 빠름 · 빠름 네 단계가 되었습니다. 보통을 이전보다 느리게 했습니다.']],
      ['🔧 개선과 수정',['공지 확인 버튼이 눌리지 않던 문제를 고쳤습니다.','혈귀 카드 몇 가지를 조정했습니다.']],
      ['🙏 감사합니다',['의견을 주신 모든 분들께 감사드립니다.']]];
  const V720SEC=[['🌑 제 1막과 제 2막',['55년을 살아내면 제 1막 종료입니다. 여기서 끝내도 되고, 제 2막 시작을 눌러 계속 살아갈 수도 있습니다.','제 2막은 3년마다 위협 등급이 오르는 구간이고, 마지막 등급인 불순물을 넘기면 진짜 결말입니다.']],
      ['♾ 무한 모드 (74년 이후)',['불순물을 넘긴 뒤에도 "무한 모드로 계속한다"를 고르면, 쓰러질 때까지 이어집니다. 여기서 끝낼 수도 있습니다.','위협 보정이 끝없이 오르고, 8년마다 더 강해진 불순물이 나타납니다. 이길 때마다 다음은 더 단단해집니다.','세계에 균열이 갑니다. 루트와 상관없이 아직 이기지 못한 히든 보스 중 무엇이든 불쑥 나타날 수 있습니다.','90년차부터는 전투 라운드마다 침식이 시작됩니다. 회피와 보호막으로도 막을 수 없는 고정 피해이고, 연차가 오를수록 커집니다. 스탯만으로는 버틸 수 없습니다.','결국 누구도 끝까지 버틸 수 없습니다. 얼마나 오래 살았는지가 기록입니다.']],
      ['🕰 오래 산 사람에게',['아주 오래 살아남으면, 무언가 일어납니다.','타고난 것이 하나 늘었습니다. 아주 드물게 만날 수 있습니다.']],
      ['🔧 개선과 수정',['엔딩 화면, 기록 공유, 이미지 저장에 클리어한 난이도(쉬움 / 보통 / 하드)가 표시됩니다.','시작 화면의 난이도 설명을 고쳤습니다. "수동 플레이 권장"은 쉬움에, 보통은 기본 난이도로 표시됩니다.','공방 거리의 "쉬어 간다"를 해마다 한 번만 쓸 수 있게 했습니다. 저장을 불러오는 방식으로 정신력을 무한히 회복하던 문제를 막았습니다.','전투에서 패배가 정해지면 저장이 지워집니다. 패배 화면에서 새로고침해서 다시 도전하던 문제를 막았습니다.']],
      ['🙏 감사합니다',['의견을 주신 모든 분들께 감사드립니다.']]];
  const V710SEC=[['🎚 난이도 3단계 · 쉬움 / 보통 / 하드',['쉬움 (수동 플레이 권장): 해마다 강해지던 적의 보정을 없애고, 처음 설정한 약한 적으로 맞췄습니다. 주인공의 연차별 카드 등급 보정도 없습니다. 아무리 쉬워도 히든 보스의 최소한의 강함은 남깁니다.','보통: 기존 그대로입니다.','하드: 기존 하드 그대로입니다.','난이도는 새로 태어날 때 고르고, 쉬움·하드 완주 기록은 따로 남습니다.']],
      ['🏛 협회 전용 카드팩',['협회에 입회하면 협회 전용 카드 10장을 한 번에 받고, 덱이 통째로 바뀝니다. 이전에 모은 카드는 모두 사라집니다.','전용 카드팩이라 이후 카드는 얻을 수 없고, 카드 보상은 돈으로 바뀝니다.','과장·부장·지부장으로 승진하면 능력치와 함께 돈을 받습니다.','본부 직속에 오르면 협회 최고에게 주는 전리품 \'협회 최고의 휘장\'을 받고, 해결사 급수는 최소 2급이 됩니다.','나중에 히든 책장으로 카드팩이 바뀌어도 협회 패시브는 유지됩니다.']],
      ['⚔ 협회 전용 패시브와 카드',['하나 협회 · 건곤감리: 전투에서 카드를 고르기 전에 매 라운드 한 가지를 고릅니다. 건(공격 피해 +2), 곤(받는 피해 30% 감소), 감(빛 +1), 이(HP 2 · 호흡 2 회복). 같은 괘는 연속으로 고를 수 없습니다.','생크 협회 · 결투 선언: 모든 전투에서 나와 상대가 주는 피해가 +3입니다.','시 협회 · 사의 경계(4코스트 카드): 1d4를 굴려 4가 나오면 피해 40, 1~3이면 기본 피해 그대로입니다.']],
      ['🔬 특이점 밸런스 조정',['금기 실험이 최대 8회까지 가능해졌고, 8회 합계 보상은 최대 HP +40, 공격 +16, 회피 +8입니다. 1회당 보상은 줄었습니다.','금기 실험을 무한히 반복하며 능력치가 계속 쌓이던 문제를 막았습니다.','"내 몸" 선택지의 HP 감소는 −8에서 −3으로 줄었습니다.']],
      ['🩸 혈귀 루트',['이제 1권속의 길이 열립니다.']],
      ['📖 도서관',['도서관 관장 · 아벨을 쓰러뜨린 뒤, 새로운 이야기가 시작됩니다.']],
      ['📅 오늘의 시드',['오늘의 시드는 혈귀 태생으로 고정됩니다.']],
      ['🙏 감사합니다',['의견을 주신 모든 분들께 감사드립니다.']]];
  const V704SEC=[['💰 자산 표시',['공방 거리에서 스크롤해도 자산이 위에 고정되어 보입니다.','가방을 열면 어느 탭에서든 자산이 바로 보입니다.']],
      ['🔧 수정',['"급수 심사" 사건의 성공 문구가 실제 효과(승급 포인트)와 맞지 않던 것을 고쳤습니다.']]];
  const V703SEC=[['🎲 수동 전투 가시성 증가',['수동 모드에서는 주사위 결과가 나오면 화면을 클릭할 때까지 멈춥니다. 결과를 눈으로 확인하고 넘어갈 수 있습니다.','주사위 자리를 고정했습니다. 적은 왼쪽, 플레이어는 오른쪽입니다.']]];
  const V701SEC=[['✍ 이름 글자 수 확대',['이제 글자 입력 최대수가 늘어납니다. 1 ~ 12','여러분의 창작 욕구를 충족시키세요']]];
  const V700SEC=[['1. 시드 분리',['시드는 출생만 정합니다. 출신·재능·결점·무기, 성장기와 숨은 출생 굴림까지 같은 시드면 똑같이 나옵니다.','태어난 뒤 사건 주사위는 매번 달라집니다. 같은 시드, 같은 선택으로 다시 해도 다른 사건이 나오는 것을 확인했습니다.','설정에 "인생 주사위: 매번 다르게 / 시드 고정(재현)"을 넣어서, 재현이 필요하면 예전처럼 쓸 수 있습니다.','"출생 + 히든 스탯 1%까지 보장"은 숨은 출생(1% 굴림)과 성장기까지 시드로 고정']],
      ['2. 세이브 옮기기',['첫 화면 아래 "세이브 옮기기"에서 코드로 내보내고, 다른 기기에서 붙여 넣거나 파일로 불러옵니다.','세이브·기록실·해금이 같이 옮겨집니다. 설정(테마·연출)은 안 옮겨집니다.','한 기기에서 만든 코드를 다른 기기 환경에서 불러와 이어하기가 뜨는 것까지 확인했고, 잘못된 코드는 안내 문구가 나옵니다.','이어하기 세이브가 있는 기기에서는 한 번 더 눌러야 덮어씁니다.']],
      ['3. 자동 전투',['전투 중 "일시정지" 버튼을 넣었습니다. 멈춘 동안 HP가 그대로 유지되고, 이어서 진행하면 다시 진행됩니다.','설정에 "자동 전투 간격"(느림 / 보통 / 빠름)을 넣었습니다. 보통은 기존과 같습니다.']],
      ['4. 표지 발현 버그 수정',['원인: 표지 발현이 장비 수치까지 ×1.6으로 불린 뒤, 장비를 바꾸면 원래 수치만 빼서 불어난 부분이 몸에 남았습니다.','재현: 무기를 낀 채 발현해 공격이 20에서 32가 됐고, 맨손 무기로 바꿔도 12가 남았습니다.','수정: 이제 장비 수치는 빼고 몸의 수치에만 ×1.6을 곱합니다. 같은 테스트에서 맨손으로 바꾸면 0이 됩니다.','이미 발현한 판은 이미 부푼 수치가 그대로 남습니다.','표지 발현 효과 자체가 장비를 낀 사람에게는 조금 약해집니다.']]];
  const V610SEC=[['💨 호흡·치명 개편',['이전: 호흡 1당 치명 5%, 타격마다 호흡 1 소모, 최대 10.','이후: 호흡은 최대 12, 타격해도 줄지 않고 라운드가 바뀔 때마다 2씩 줄어듭니다.','치명 확률: 호흡 4에서 20%, 1마다 +14%(9에서 90%), 10 이상은 확정 치명. 호흡 1~3은 치명 대신 회피 +5.','치명 피해는 그대로 ×1.5입니다. 환도의 호흡당 치명 피해 +10%는 호흡 10까지만 반영됩니다.']],
      ['🛡 출혈·파열',['방어 카드를 내면 자신의 출혈·파열이 1/4 줄어듭니다(파열 8이면 6). 적도 똑같이 적용됩니다.']],
      ['🔧 공방',['카드 지우기가 카드 교환으로 바뀌었습니다. 덱의 카드를 일반 전투에서 얻는 카드 중 무작위 한 장으로 바꿉니다(방문마다 3장, 500안).','장비 정비가 생겼습니다. 장착한 장비마다 최대 5번, 50% 확률로 공격 또는 회피 +1을 시도합니다(실패해도 횟수는 소모, 시도할수록 비용이 늘어납니다). 모든 장비에 적용됩니다.']],
      ['🃏 암시장',['공방 암시장에 가끔(방문마다 10%) 응급 거래가 열립니다. 응급처치(HP 4 회복, 출혈·파열·화상 중 하나를 2 줄임)와 거리 재기(이번 라운드 회피 +5, 명중 +5)를 살 수 있고, 같은 카드는 최대 3장까지 지닐 수 있습니다.']],
      ['⚠ 검토 중',['특이점(날개 기업 길)이 너무 강하다는 의견이 있어 너프를 검토하고 있습니다. 첫 화면 아래 "의견·버그 제보"에서 느낀 점을 알려 주세요.']]];
  const V609SEC=[['🔒 새로 열린 길',['더 어려운 난이도가 생겼습니다. 첫 화면에서 고를 수 있습니다.','도서관 안쪽에서 무언가 열렸습니다.']],
      ['🔧 수정',['일부 배경에서 선택한 버튼의 글씨가 보이지 않던 문제를 수정했습니다.']]];
  const V608SEC=[['🔧 수정',['불순물이 다른 강적들이 받던 후반 강화를 받지 못하던 오류를 확인했습니다. 보상으로 불순물을 대폭 강화했습니다.']]];
  const V607SEC=[['🔧 수정',['날개의 길 끝에서 맞닥뜨리는 상대가 본래의 체급보다 약하게 나오던 문제를 수정했습니다.']]];
  const V606SEC=[['🔧 수정',['엔딩 하나가 발동하지 않던 문제를 수정했습니다. 어떤 엔딩인지는 직접 확인해 보세요.']]];
  const V605SEC=[['🔒 지난 새 소식 (전투·새)',['전투 도중 마음이 한계에 닿으면 특별한 일이 일어납니다.','검은 숲의 새 세 마리에 얽힌 이야기가 생겼습니다. 끝까지 따라가 본 사람은 아직 없습니다.','일부 히든 상대의 난이도를 조정했습니다.']]];
  const noticeBody=(sec=NOTICE.sec)=>sec.map(([h,items])=>`<div class="stack" style="gap:4px"><b>${h}</b><ul class="small" style="margin:0;padding-left:18px;display:grid;gap:3px">${items.map(t=>`<li>${esc(t)}</li>`).join('')}</ul></div>`).join('');
  function vUpdates(){return `<details class="panel"><summary><b>이번 업데이트 · ${UPDATES.v}</b></summary><div class="stack" style="gap:10px;margin-top:10px">${noticeBody(NOTICE.sec)}</div><ul class="small" style="margin:8px 0 0;padding-left:18px">${UPDATES.items.map(t=>`<li>${t}</li>`).join('')}</ul></details>`}
  /* 세이브 옮기기: 이 브라우저의 세이브·기록실·해금을 코드(또는 파일)로 내보내고, 다른 기기에서 불러온다 */
  const XKEYS=[SAVE,REC,'cityYearUnlocks'];
  const xEncode=()=>{const d={};for(const k of XKEYS){const v=store.get(k);if(v)d[k]=v}return 'CY1:'+btoa(unescape(encodeURIComponent(JSON.stringify({cy:1,v:UPDATES.v,t:Date.now(),d}))))};
  function xDecode(txt){
    let t=String(txt||'').trim();if(!t)throw new Error('코드가 비어 있다');
    if(t.startsWith('CY1:'))t=decodeURIComponent(escape(atob(t.slice(4).replace(/\s+/g,''))));
    let o;try{o=JSON.parse(t)}catch(e){throw new Error('이 게임의 세이브 코드가 아니다 · 코드를 끝까지 복사했는지 확인해 주세요')}
    if(!o||o.cy!==1||!o.d||typeof o.d!=='object')throw new Error('이 게임의 세이브 코드가 아니다');
    const out={};for(const k of XKEYS)if(typeof o.d[k]==='string'){JSON.parse(o.d[k]);out[k]=o.d[k]}
    if(!Object.keys(out).length)throw new Error('들어 있는 세이브가 없다');
    if(out[SAVE]&&!JSON.parse(out[SAVE]).G)throw new Error('세이브가 깨져 있다');
    return {out,v:o.v,t:o.t};
  }
  function vTransfer(){
    const has=!!loadSave();
    return `<details${UI.xopen?' open':''}><summary>세이브 옮기기 (다른 기기에서 이어하기)</summary><div class="stack" style="gap:10px;margin-top:8px">
      <p class="small dim">이 기기의 세이브·기록실·해금을 코드로 만들어 다른 기기에서 불러온다. 불러오면 그 기기에 있던 세이브와 기록은 덮어쓴다. 설정(테마·연출)은 옮겨지지 않는다.</p>
      <button class="btn" data-a="xport"><b>내보내기</b><span class="dim small">${has?'지금 이어하기 세이브까지 포함한다':'이어하기 세이브는 없다 · 기록실과 해금만 담긴다'}</span></button>
      ${UI.xcode?`<textarea id="xcode" readonly rows="4" style="width:100%;font:12px/1.4 var(--mono);background:var(--panel2,#11151d);color:var(--fg);border:1px solid var(--line,#2a2f3a);border-radius:8px;padding:8px">${UI.xcode}</textarea>
        <div class="row" style="gap:8px"><button class="chip" data-a="xcopy">코드 복사</button><button class="chip" data-a="xfile">파일로 저장</button></div>`:''}
      <textarea id="xin" rows="3" placeholder="여기에 코드를 붙여 넣는다" style="width:100%;font:12px/1.4 var(--mono);background:var(--panel2,#11151d);color:var(--fg);border:1px solid var(--line,#2a2f3a);border-radius:8px;padding:8px"></textarea>
      <div class="row" style="gap:8px"><button class="btn" style="flex:1" data-a="ximport"><b>${UI.xask?'정말 덮어쓰기':'불러오기'}</b></button><label class="btn quiet" style="flex:1;text-align:center;cursor:pointer"><b>파일에서 불러오기</b><input id="xfileIn" type="file" accept=".json,.txt,text/plain,application/json" hidden></label></div>
      ${UI.xmsg?`<p class="small ${UI.xmsg[0]?'good':'bad'}">${esc(UI.xmsg[1])}</p>`:''}</div></details>`;
  }
  function xApply(txt){
    let r;try{r=xDecode(txt)}catch(e){UI.xmsg=[false,'불러오지 못했다 · '+(e&&e.message||'코드를 확인해 주세요')];UI.xask=null;UI.xopen=true;render();return}
    if(loadSave()&&UI.xask!==txt){UI.xask=txt;UI.xmsg=[false,'이 기기에 이어하기 세이브가 있다. 한 번 더 누르면 덮어쓴다.'];UI.xopen=true;render();return}
    for(const k of XKEYS){if(r.out[k])store.set(k,r.out[k])}
    UI.xask=null;UI.xcode=null;UI.xopen=true;UI.xmsg=[true,`불러왔다${r.v?` (v${String(r.v).replace(/^v/i,'')} 세이브)`:''} · 위의 이어하기를 눌러 계속한다`];render();
  }
  /* 이전 공지: 한 번만 뜨는 공지를 다시 볼 수 있게 버전별로 모아 둔다 (규칙 요약 아래) */
  const PAST=[['v7.3.2',V732SEC],['v7.3.1',V731SEC],['v7.3.0',V730SEC],['v7.2.1',V721SEC],['v7.2.0',V720SEC],['v7.1.0',V710SEC],['v7.0.4',V704SEC],['v7.0.3',V703SEC],['v7.0.1',V701SEC],['v7.0.0',V700SEC],['v6.1.0',V610SEC],['v6.0.9',V609SEC],['v6.0.8',V608SEC],['v6.0.7',V607SEC],['v6.0.6',V606SEC],['v6.0.5',V605SEC],['v6.0.4',V604SEC],['v6.0.3',V603SEC],['v6.0.2',V602SEC],['v6.0',V6SEC]];
  function vPast(){return `<details><summary>이전 공지</summary><div class="stack" style="gap:12px;margin-top:8px">${PAST.map(([v,sec])=>`<div class="stack" style="gap:6px"><div class="eyebrow">${v}</div>${noticeBody(sec)}</div>`).join('')}</div></details>`}
  /* 오늘의 시드: 한국 시간 날짜 → 숫자 */
  const todayKey=()=>{const t=new Date(Date.now()+9*3600e3);return t.toISOString().slice(0,10)};
  const dailySeed=k=>{let h=2166136261;for(const c of 'city-year:'+k)h=Math.imul(h^c.charCodeAt(0),16777619)>>>0;return h%1000000000};
  function vJobs(){
    const u=loadUnlocks();
    const row=k=>`<div class="row between"><span>${T.jobs[k]}</span><span class="chip${u.includes(k)?'':' dim'}">${u.includes(k)?'해금 · 출생 화면에서 고를 수 있다':'잠김'}</span></div>`;
    return `<div class="panel stack" style="gap:8px"><span class="eyebrow">히든 직업</span>${Object.keys(T.jobs).map(row).join('')}
      <p class="small dim">금기를 어긴 대가로 찾아오는 ${D.enemies.claw.n}과 ${D.enemies.arbiter.n}를 한 번 이상 이기면 각각 열린다.</p></div>`;
  }
  function vBirth(){
    const b=BC,s=b.stats,fresh=b.fresh&&MODE!=='off';
    const v=r=>`<span class="v" ${fresh?`data-roll="${r}"`:''}>${r}</span>`;
    const cyc=pool=>fresh&&pool?` data-cyc="${esc(pool.map(y=>y.n).join('|'))}"`:'';
    const row=(lab,r,x,pool)=>`<div class="roll"><span class="mono small dim">${lab}</span>${v(r)}<div class="n"><b${cyc(pool)}>${x.n}</b>${x.t?`<span>${x.t}</span>`:''}<span class="mono small" style="color:var(--gold)">${x.e}</span></div></div>`;
    const sw=D.colors.map((c,i)=>`<button class="sw ${i===b.ci?'on':''}" data-a="color" data-i="${i}" style="background:${c.hex}" aria-label="${c.adj} 색" title="${c.adj}"></button>`).join('');
    const kid=b.kid.length?`<div class="stack" style="gap:6px"><div class="eyebrow">성장기 · 1d100 × ${b.kid.length}</div>
      <div class="panel">${b.kid.map(k=>row(k.age+'세',k.r,k.x,D.childhood.table)).join('')}</div></div>`:'';
    return `<div class="stack" style="gap:6px"><div class="eyebrow">무작위 출생 · 1d100</div><h2>${b.name?esc(b.name)+'은(는)':'당신은'} 이렇게 태어났다</h2></div>
      <div class="panel stack" style="gap:10px">
        <label class="field" for="nm"><span class="eyebrow">이름</span><input id="nm" maxlength="12" value="${esc(b.name||'')}" placeholder="${T.you}" autocomplete="off"></label>
        <div class="row between"><span class="mono small dim">시드 <b style="color:var(--fg)">${b.seed}</b> · ${UI.daily&&b.seed===dailySeed(UI.daily)?`<b style="color:var(--gold)">오늘의 시드 ${UI.daily}</b>`:'태어날 때마다 새로 뽑힌다'}</span></div>
        <div class="row" style="flex-wrap:nowrap"><input id="seedIn" inputmode="numeric" enterkeyhint="go" maxlength="12" placeholder="시드 번호로 다시 태어나기" autocomplete="off" style="flex:1;min-width:0">
          <button class="chip" data-a="seed">이 시드로</button></div>
      </div>
      ${b.o.hidden?`<div class="panel stack" style="gap:6px;border-color:var(--gold)"><span class="eyebrow" style="color:var(--gold)">${b.fated?'운명이 강제된 출생':'숨은 출생 · 출신 '+b.r.o}</span><b class="serif">${esc(b.o.n)}</b><span class="small">${esc(b.o.t)}</span><span class="mono small" style="color:var(--gold)">${esc(b.o.e)}</span></div>`:''}
      ${b.fated?`<div class="panel stack" style="gap:6px"><span class="mono small" style="color:var(--gold)">재능 · 결점 · 무기 · 타고난 것 없음 · 출신과 성장기 보정만 가진다</span></div>`:b.blank?`<div class="panel stack" style="gap:6px;border-color:var(--gold)"><span class="eyebrow" style="color:var(--gold)">출생 보정 없음</span><b class="serif">${esc(b.o.n)}</b><span class="small">${esc(b.o.t)}</span><span class="mono small" style="color:var(--gold)">출신 · 재능 · 결점 · 무기 · 타고난 것 없음 · 맨손 · 성장기 보정만 가진다</span></div>`:`<div class="panel">${row('출신',b.r.o,b.o,UI.job?null:D.origins)}${row('재능',b.r.t,b.t,D.talents)}${row('결점',b.r.f,b.f,D.flaws)}${row('무기',b.r.w,b.w,D.weapons)}</div>`}
      ${b.innate?`<div class="panel stack" style="gap:6px;border-color:var(--gold)"><span class="eyebrow" style="color:var(--gold)">타고난 것 · 1%</span><b class="serif">${esc(D.innate[b.innate].n)}</b><span class="mono small" style="color:var(--gold)">${esc(D.innate[b.innate].e)}</span></div>`:''}
      <button class="btn quiet" data-a="reroll">다시 태어난다</button>
      ${kid}
      ${vBirthHelp(b)}
      <div class="panel stack">
        <div class="row between"><span class="mono small dim">색 · 1d100 → ${b.r.n}</span><b style="color:${b.color}">${D.colors[b.ci].adj} 빛</b></div>
        <div class="sws">${sw}</div>
        <p class="small dim">색은 직접 바꿀 수 있다. 훗날 ${CFG.colorRank}${T.rankUnit} ${T.licensed} 가운데 특출난 자로 인정받으면 이 색과 가장 높은 능력치로 ${T.titleLabel}을 받는다. 예: ${D.colors[b.ci].adj} ${D.titleWords.spd[1]}</p>
        <div class="row between"><span class="eyebrow">${CFG.startAge-1}세의 능력치</span></div>
        <div class="stat"><div><b>${s.maxHp}</b><span>HP</span></div><div><b>${sg(s.atk)}</b><span>공격</span></div><div><b>${sg(s.eva)}</b><span>회피</span></div><div><b>${sg(s.spd)}</b><span>속도</span></div></div>
        <div class="chips">${b.deck.map(id=>`<span class="chip">${D.cards[id].n}</span>`).join('')}</div></div>
      ${b.relicPick?`<div class="panel stack" style="gap:8px"><span class="eyebrow">유물 적성 · 하나를 고른다</span><p class="small dim">적성은 가지고 있으나 온전히 다루기 어렵다.</p>${Object.entries(D.relics).map(([k,r])=>`<button class="btn${UI.relic===k?' primary':''}" data-a="relic" data-i="${k}"><b>${esc(r.n)}</b><span class="mono small" style="color:var(--gold)">${esc(r.e)}</span></button>`).join('')}</div>`:''}
      ${vJobRoll()}${vJobPick()}
      ${b.fateChoices&&!b.fated?`<div class="panel stack" style="gap:8px;border-color:var(--gold)"><span class="eyebrow" style="color:var(--gold)">운명이 찾아왔다 · 하나를 고르거나 거절한다</span><span class="small">아무것도 쥐지 않고 태어났지만, 이름 없는 존재에게도 길이 두 갈래로 놓였다.</span>${b.fateChoices.map(r_=>{const h=D.hiddenOrigins.find(x=>x.roll===r_);return `<button class="btn" data-a="fate" data-i="${r_}"><b>${esc(h.n)}</b><span class="small">${esc(h.t)}</span><span class="mono small" style="color:var(--gold)">${esc(h.e)}</span></button>`}).join('')}<button class="btn" data-a="nofate"><b>운명을 거절한다</b><span class="small">아무것도 쥐지 않은 채 그대로 시작한다. 이름 없는 삶, 솔로 엔딩을 노리는 길이다.</span></button></div>`:''}
      <div class="stack"><button class="btn primary" data-a="live" ${(b.relicPick&&!UI.relic)||(b.fateChoices&&!b.fated)?'disabled':''}>${b.fateChoices&&!b.fated?'운명을 먼저 고른다':b.relicPick&&!UI.relic?'유물을 먼저 고른다':'이 삶을 산다'}</button>
      ${b.blank||UI.job?'':'<button class="btn quiet" data-a="blank">어떤 출생 보정도 없이 시작한다</button>'}</div>${vSettings()}`;
  }
  /* 6시즌: 출생 규칙 설명 + 표 전체 (이번에 나온 칸 표시) */
  function vBirthHelp(b){
    const tbl=(name,list,r,sel)=>{let lo=1;return `<div class="stack" style="gap:2px"><span class="eyebrow">${name} 표 · 1d100${Array.isArray(r)?' · '+r.length+'번':''}</span>${list.map(x=>{const a=lo;lo=x.max+1;const hit=Array.isArray(r)?r.some(v=>v>=a&&v<=x.max):r>=a&&r<=x.max;
      const sec=a===x.max&&(a===1||a===100)&&!hit;
      return `<div class="trow${hit?' hit':''}"><span class="mono">${a===x.max?a:a+'~'+x.max}</span><b>${sec?'???':esc(x.n)}</b><span class="mono small">${sec?'':esc(x.e||'')}</span></div>`}).join('')}</div>`};
    const kidR=b.kid.map(k=>k.r);
    return `<details class="panel bhelp"${UI.helpOpen?' open':''}><summary><b>출생 규칙 · 어떻게 정해지나</b></summary>
      <ul class="small" style="margin:10px 0 0;padding-left:18px;display:grid;gap:6px">
        <li><b>굴림</b> 출신·재능·결점·무기·색을 1d100으로 한 번씩 굴려, 표에서 그 숫자가 들어가는 칸이 정해진다. 숫자는 칸의 위치일 뿐이라 크다고 좋은 것이 아니다.</li>
        <li><b>출신</b> 어디서 태어났는지. 능력치 보정, 시작 카드 1장, 시작 자산이 정해진다. '진로 +'가 붙은 출신은 그 길(해결사·날개·협회·손가락)을 권하는 사건이 더 자주 온다.</li>
        <li><b>재능</b> 타고난 장점 하나. <b>결점</b> 타고난 약점 하나. 둘 다 평생 그대로다.</li>
        <li><b>무기</b> 처음 쥔 무기. 무기 칸 장비라서, 공방에서 더 좋은 무기를 사면 바꿀 수 있다 (바꾼 무기는 보관함으로).</li>
        <li><b>성장기</b> ${D.childhood.stages.map(x=>x.age+'세').join('·')}에 성장표를 1d100으로 굴려, 나온 칸의 능력치가 하나씩 자란다. 같은 칸이 여러 번 나오면 그만큼 쌓인다.</li>
        <li><b>색</b> 1d100을 10칸으로 나눈다. 직접 바꿀 수 있고, 훗날 특색 이름의 앞말이 된다.</li>
        <li><b>다시 태어난다</b>는 전부 새로 굴린다. 시드 번호가 같으면 굴림도 똑같이 나온다.</li></ul>
      <div class="stack" style="gap:12px;margin-top:12px">${b.job?'':tbl('출신',D.origins,b.r.o)}${tbl('재능',D.talents,b.r.t)}${tbl('결점',D.flaws,b.r.f)}${tbl('무기',D.weapons,b.r.w)}${tbl('성장기',D.childhood.table,kidR)}</div>
      <p class="small dim" style="margin-top:8px">밝게 표시된 칸이 이번에 나온 칸이다.</p></details>`;
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
      const enc=UI.enc&&UI.enc.hidden?`<div class="check"><b>${UI.enc.rift?'균열 너머의 운명':T.hiddenBoss}</b>${pen?` · <span class="bad">${pen.label} · 명중 ${sg(pen.atk)} · 회피 ${sg(pen.eva)} (${pen.fullRank}${T.rankUnit}이면 보정 없음)</span>`:''}</div>`:UI.enc&&UI.enc.roll?`<div class="check">${UI.enc.label} · 1d100 ${UI.enc.roll} → <b>${e.n}</b></div>`:'';
      const avoid=UI.avoidText?`<p class="small dim">${UI.avoidText}</p>`:'';UI.avoidText=null;
      return `${vHud()}<div class="stack" style="gap:8px"><div class="eyebrow">${yearTag()}${E.age(G)}세의 해 · 전투</div>${avoid}${enc}<h2 style="color:${e.color}">${ulName(e.n,e.ul)}</h2>${e.trait&&D.traits&&D.traits[e.trait]?`<div class="check"><b>특성 · ${esc(D.traits[e.trait].n)}</b> · ${esc(D.traits[e.trait].d)}</div>`:''}${e.abno?`<div class="check" style="border-color:#8a7fb8"><b style="color:#8a7fb8">환상체</b> · 마주치면 정신력이 2d3 깎인다${G.ch.ego?` (E.G.O 하한 ${CFG.mind.ego[G.ch.ego.type].floor})`:''}</div>`:''}<p class="lead">${UI.enc&&UI.enc.rift?`갈라진 틈 너머에서 ${esc(e.n)}이(가) 흘러들었다. 이 세계의 사건과는 이어지지 않은 채 다른 운명에서 건너온 존재다. 만날 수 없던 상대가 지금 눈앞에 서 있다.`:e.intro}</p></div>
        <button class="btn primary" data-a="fight">맞선다</button>`;
    }
    const ev=UI.ev,ch=G.ch;
    const lockBtns=E.lockedOptions(G,ev).map(({c,i})=>({i,html:`<button class="btn" disabled><b>🔒 ${c.l}</b><span class="mono small dim">${c.lock}</span></button>`}));
    const btns=E.options(G,ev).map(({c,i})=>{
      let hint=c.h||'판정 없음 · 결과 확정';
      if(c.ok&&c.ok.fx&&c.ok.fx.relicRoll)hint=`1d100 · ${E.relicChance(ch)} 이하가 나오면 유물을 고른다${ch.relicBase?' (출신 보정 '+ch.relicBase+'%)':''}${(ch.stats.relicApt||0)>0?' (유물 적성 +'+ch.stats.relicApt+')':''}`;
      if(c.check){const pm=E.pathMod(ch,c.check);hint=`${c.check.s?STAT[c.check.s]+' 판정':'운 판정'} · 1d${c.check.pure?100:E.checkDie(ch)} ${sg(E.checkMod(ch,c.check))} ≥ ${E.checkDc(ch,c.check)}${pm?` (출신 ${T.paths[c.check.path]} 보정 +${pm})`:''}${c.h?' · '+c.h:''}`}
      return {i,html:`<button class="btn" data-a="choose" data-i="${i}"><b>${c.l}</b><span class="mono small dim">${hint}</span></button>`};
    }).concat(lockBtns).sort((a,b)=>a.i-b.i).map(x=>x.html).join('');
    return `${vHud()}<div class="stack" style="gap:8px"><div class="eyebrow">${yearTag()}${E.age(G)}세의 해</div><h2>${ev.t}</h2><p class="lead">${ev.x}</p></div><div class="stack">${btns}</div>`;
  }
  function nextLabel(){
    if(G.ch.lvPend>0)return '성장 굴림';
    if(UI.pending)return '맞선다';
    return G.year>=E.lastYear(G)?'결말을 본다':'다음 해로';
  }
  function vResult(){
    const r=UI.res,an=r.anim&&r.roll;
    const roll=r.roll?`<div class="check">1d${r.roll.die||100} ${r.roll.r} ${sg(r.roll.mod)} = ${r.roll.tot} / 난이도 ${r.roll.dc} → <b class="${r.roll.ok?'good':'bad'}">${r.roll.ok?'성공':'실패'}</b></div>`:'';
    const die=an?`<div class="row"><div class="die big" id="rd" style="border-color:var(--gold)"><b id="rdb">–</b></div><span class="mono small dim">1d${r.roll.die||100} · 난이도 ${r.roll.dc}</span></div><button class="btn primary" id="tapBtn" data-a="tap" hidden>주사위를 굴린다</button>`:'';
    const tt=r.title?`<div class="panel stack" style="border-color:${G.ch.color}"><span class="eyebrow">${r.tlabel||T.titleLabel}</span><h2 style="color:${G.ch.color}">${r.title}</h2></div>`:'';
    return `${die}<div class="stack" id="after"${an?' style="visibility:hidden"':''}>${vHud()}${roll}<p>${r.t}</p>${tt}<div class="chips chipscroll">${r.chips.map(x=>`<span class="chip">${x}</span>`).join('')}</div>${r.chips.length>8?'<span class="small dim">결과가 길면 위 칸을 밀어서 볼 수 있다.</span>':''}
      ${G.ch.relicPickLate?vLateRelic():G.ch.namePend?vNamePend():G.ch.pillPick?vPillPick():G.ch.singPick?vSingPick():G.ch.bondPick?vBondPick():G.ch.kidPick?vKidPick():G.ch.wingPick?vWingPick():G.ch.orgPick?vOrgPick():G.ch.fingerPick?vFingerPick():G.ch.seongPick?vSeongPick():G.ch.officePick?vOfficePick():G.ch.distPick?vDistPick():G.ch.egoPick?vEgoPick():G.ch.titlePick?vTitlePick():`<button class="btn primary" data-a="flow">${nextLabel()}</button>`}</div>`;
  }
  /* 특색 이름: 색은 고정, 뒤 단어(2~12글자)를 직접 적는다 */
  function vLateRelic(){
    const ks=E.relicChoices(G.ch);
    return `<div class="panel stack" style="gap:8px;border-color:var(--gold)"><span class="eyebrow">잊힌 유물 · 하나를 고른다</span><p class="small dim">이미 가진 유물은 고를 수 없다.</p>
      ${ks.map(k=>{const r=D.relics[k];return `<button class="btn" data-a="lrelic" data-i="${k}"><b>${esc(r.n)}</b><span class="mono small" style="color:var(--gold)">${esc(r.e)}</span></button>`}).join('')}</div>`;
  }
  /* 6시즌: 내 사무소 이름(1~12글자 + 사무소)과 전문 분야 */
  function vOfficePick(){
    const kw=UI.offKw||'bleed',nm=UI.offName||'';
    return `<div class="panel stack" style="gap:8px;border-color:var(--gold)"><span class="eyebrow">내 사무소 차리기</span>
      <p class="small">간판에 들어갈 이름을 1~12글자로 적는다. 뒤에 '사무소'가 붙는다.</p>
      <div class="row"><input id="offname" maxlength="12" value="${esc(nm)}" autocomplete="off" placeholder="1~12글자" style="width:min(12em,50vw)"><b class="serif">사무소</b></div>
      <span class="eyebrow" style="margin-top:4px">전문 분야</span>
      <div class="seg">${Object.entries(E.OKW).map(([k,n])=>`<button class="${kw===k?'on':''}" data-a="offkw" data-i="${k}">${n}</button>`).join('')}</div>
      <p class="small dim">3년마다(공방 거리를 지날 때) 사무소가 이 분야의 카드나 의수를 알선해 준다. 급수가 오르면 더 좋은 의수가 들어온다.</p>
      <span class="small bad">${UI.offErr||''}</span>
      <button class="btn primary" data-a="offset">이 이름으로 간판을 건다</button></div>`;
  }
  function vDistPick(){
    return `<div class="panel stack" style="gap:8px;border-color:#8a2a2a"><span class="eyebrow" style="color:#c25050">육신 뒤틀림</span>
      <p class="small">몸이 마음의 모양을 따라 비틀렸다. 이제 장비를 쥘 수 없고, 상대에게 디버프를 걸 수 없다. 대신 몸 자체가 무기가 된다.</p>
      <p class="small mono" style="color:#c25050">최대 HP +${CFG.distort.fx.maxHp} · 공격 +${CFG.distort.fx.atk} · 장비 전부 보관함으로 · 덱이 뒤틀린 책장 ${CFG.distort.deck.length}장으로 고정 (빛 없음) · 정신력이 더 깎이지 않는다</p>
      <div class="row"><span class="small">뒤틀림의 이름</span><input id="distname" maxlength="12" value="${esc(UI.distName||'')}" autocomplete="off" placeholder="1~12글자" style="width:min(14em,60vw)"></div>
      <span class="small bad">${UI.distErr||''}</span>
      <button class="btn primary" data-a="distset">이 이름으로 뒤틀린다</button></div>`;
  }
  /* 연차 표시: 해를 넘기지 않는 사건에서는 숨긴다 */
  const yearTag=()=>G.free||G.year<1?'':G.infinite?`${G.year}년차 · `:`${G.year}/${E.lastYear(G)} · `;
  function vEgoPick(){
    const X=CFG.mind.ego,ty=UI.egoType||'atk';
    return `<div class="panel stack" style="gap:8px;border-color:var(--gold)"><span class="eyebrow">E.G.O 개화</span>
      <p class="small">마음이 무너지기 직전, 그것을 붙잡은 모양이 힘이 되었다. 종류와 이름을 정한다. 덱 최대 ${CFG.deck.max+CFG.mind.deckPlus}장(전용 카드 2장은 고정) · 전투 처음 ${CFG.mind.lightRounds}라운드 빛 +${CFG.mind.light}.</p>
      <div class="row" style="gap:8px">${['atk','def'].map(k=>`<button class="btn ${ty===k?'primary':'quiet'}" style="flex:1" data-a="egotype" data-i="${k}">${X[k].n}<br><span class="small">${k==='atk'?`공격 +${X.atk.hit} · 정신력 ${X.atk.floor} 밑으로 안 떨어짐 · 전용 카드 ${D.cards[X.atk.card].n}`:`체력 +${X.def.hp} · 회피 +${X.def.eva} · 정신력 ${X.def.floor} 밑으로 안 떨어짐 · 전용 카드 ${D.cards[X.def.card].n}`}</span></button>`).join('')}</div>
      <div class="row"><span class="small">이름</span><input id="egoname" maxlength="12" value="${esc(UI.egoName||'')}" autocomplete="off" placeholder="1~12글자" style="width:min(14em,60vw)"></div>
      <span class="small dim">게임에 있는 물건·전리품·유물·카드 이름은 쓸 수 없다.</span>
      <span class="small bad">${UI.egoErr||''}</span>
      <button class="btn primary" data-a="egoset">이 E.G.O로 정한다</button></div>`;
  }
  /* 기업 루트: 특이점 개발(효과 + 이름), 날개 설립(이름) */
  function vSingPick(){
    const T_=CFG.corp.types,ty=UI.singType||'warp';
    return `<div class="panel stack" style="gap:8px;border-color:var(--gold)"><span class="eyebrow">특이점 개발</span>
      <p class="small">전용 연구 구역에서 특이점의 모양이 잡혀 간다. 어떤 효과로 개발할지, 무엇이라 부를지 정한다. 이후 강화 실험으로 효과가 자란다.</p>
      <div class="stack" style="gap:8px">${Object.entries(T_).map(([k,v])=>`<button class="btn ${ty===k?'primary':'quiet'}" data-a="singtype" data-i="${k}"><b>${v.n}</b><span class="small">${v.e}</span></button>`).join('')}</div>
      <div class="row"><span class="small">이름</span><input id="singname" maxlength="12" value="${esc(UI.singName||'')}" autocomplete="off" placeholder="1~12글자" style="width:min(14em,60vw)"></div>
      <span class="small dim">게임에 있는 물건·전리품·유물·카드 이름은 쓸 수 없다.</span>
      <span class="small bad">${UI.singErr||''}</span>
      <button class="btn primary" data-a="singset">이 특이점으로 정한다</button></div>`;
  }
  /* 특수환: 승리 보상으로 능력치 하나를 골라 영구 증가 */
  function vPillPick(){
    const P=Object.values(D.enemies).find(e=>e.pill).pill;
    return `<div class="panel stack" style="gap:8px;border-color:var(--gold)"><span class="eyebrow">${P.n}</span>
      <p class="small">붉은 붕대 사이에서 작은 환이 나왔다. 삼키면 능력치 하나가 영구히 +${P.v} 오른다. 하나만 고를 수 있다.</p>
      <div class="row" style="gap:8px;flex-wrap:wrap">${P.stats.map(k=>`<button class="btn" style="flex:1 1 40%" data-a="pill" data-i="${k}"><b>${E.pillStats[k]} +${P.v}</b><span class="small dim">지금 ${G.ch.stats[k]}</span></button>`).join('')}</div></div>`;
  }
  /* 전투 중 정신력 0으로 개화·뒤틀림이 된 뒤: 이름 정하기 */
  function vNamePend(){
    const ego=G.ch.namePend==='ego';
    return `<div class="panel stack" style="gap:8px;border-color:${ego?'var(--gold)':'#c25050'}"><span class="eyebrow">${ego?'E.G.O 개화':'육신 뒤틀림'}</span>
      <p class="small">${ego?'싸우는 도중 마음이 무너지는 순간, 붙잡은 모양이 힘이 되었다. 그 이름을 정한다.':'싸우는 도중 마음이 버티지 못하고 몸이 뒤틀렸다. 그 이름을 정한다.'}</p>
      <div class="row"><span class="small">이름</span><input id="nameval" maxlength="12" value="${esc(UI.nameVal||'')}" autocomplete="off" placeholder="1~12글자" style="width:min(14em,60vw)"></div>
      <span class="small dim">게임에 있는 물건·전리품·유물·카드 이름은 쓸 수 없다.</span>
      <span class="small bad">${UI.nameErr||''}</span>
      <button class="btn primary" data-a="nameset">이 이름으로 정한다</button></div>`;
  }
  /* 인연(동반자): 이름 정하기와 가족 탭 */
  const josa=(x,a,b)=>{const ch=String(x).replace(/[^가-힣]+$/,'').slice(-1).charCodeAt(0),f=ch>=0xAC00&&ch<=0xD7A3?(ch-0xAC00)%28:0;return x+(a==='으로'?(f&&f!==8?'으로':'로'):f?a:b)};
  function vKidPick(){
    const ch=G.ch,k=(ch.bond&&ch.bond.kids||[]).find(x=>x.pend)||{n:''};
    return `<div class="panel stack" style="gap:8px;border-color:var(--gold)"><span class="eyebrow">아이 · ${esc(josa(ch.bond.name,'과','와'))}의 아이</span>
      <p class="small">아이의 이름을 정한다. 비워 두면 ${esc(josa(k.n,'으로','로'))} 부른다.</p>
      <div class="row"><span class="small">이름</span><input id="kidname" maxlength="12" value="${esc(UI.kidName||'')}" autocomplete="off" placeholder="${esc(k.n)}" style="width:min(14em,60vw)"></div>
      <span class="small bad">${UI.kidErr||''}</span>
      <button class="btn primary" data-a="kidset">이 이름으로 부른다</button></div>`;
  }
  function vBondPick(){
    const b=G.ch.bond,R=E.bondData(G.ch);
    return `<div class="panel stack" style="gap:8px;border-color:var(--gold)"><span class="eyebrow">인연 · ${esc(R.who)}</span>
      <p class="small">그 사람의 이름을 정한다.</p>
      <div class="row"><span class="small">이름</span><input id="bondname" maxlength="12" value="${esc(UI.bondName||'')}" autocomplete="off" placeholder="1~12글자" style="width:min(14em,60vw)"></div>
      <span class="small bad">${UI.bondErr||''}</span>
      <button class="btn primary" data-a="bondset">이 이름으로 부른다</button></div>`;
  }
  function vFamily(){
    const ch=G.ch,b=ch.bond,BDc=CFG.bond;if(!b)return '<p class="small dim">가족 없음</p>';
    const R=E.bondData(ch)||{who:''},st=b.st;
    const head=st==='married'?(ch.distForm?'당신을 알아보지 못한다':'배우자'):st==='lost'?'배우자의 죽음':st==='left'?'떠났다':`인연 · ${R.who}`;
    const rows=[];
    if(R.look)rows.push(['특징',R.look]);
    if(st==='married'){
      rows.push(['결혼한 해',b.since+'년차']);
      rows.push(['배우자 등급',`${9-E.spouseLevel(b,G.year)}급 (결혼 ${BDc.hunt.spouseYears}년마다 한 단계)`]);
      rows.push(['보정',`최대 HP +${BDc.marry.maxHp} · 최대 정신력 +${BDc.marry.mindMax} · 사건 판정 +${BDc.marry.check}`]);
      rows.push(['해마다',`정신력 +${BDc.yearMind}`]);
      rows.push(['가족의 목소리',b.saved?'이미 한 번 붙잡아 주었다':`정신력이 1이 되면 한 번 붙잡아 준다 (정신력 ${BDc.saveMind})`]);
      if(ch.distForm)rows.push(['뒤틀린 뒤','이름을 불러도 대답하지 않는다']);
    }else if(st==='met'){
      rows.push(['단계',`${Math.min(b.step,BDc.steps)}/${BDc.steps}${b.step>=BDc.steps?' · 다음은 청혼':''}`]);
      rows.push(['인연 점수',String(b.love||0)]);
      rows.push(['청혼 기회',`${BDc.tries-(b.tries||0)}/${BDc.tries}`]);
    }else rows.push(['대가',`최대 정신력 −${st==='left'?BDc.leaveMind:BDc.lossMind} (영구)`]);
    for(const k of b.kids||[]){const a=Math.max(0,G.year-k.born),J=(D.bond.kidJobs.find(j=>j.k===k.job)||{}).l;rows.push([`아이 · ${k.n}`,k.dead?'토벌 의뢰에서 쓰러졌다':`${a}세${a>=BDc.kid.adult?' · '+J:' · 자라는 중'}`])}
    return `<div class="panel stack" style="gap:8px"><span class="eyebrow">가족 · 인연</span><div class="row between"><b class="serif" style="font-size:20px">${esc(b.name)}</b><span class="chip" style="${st==='married'?'color:var(--gold);border-color:var(--gold)':''}">${head}</span></div>
      ${rows.map(([k,v])=>`<div class="row between small"><span class="dim">${k}</span><b class="mono" style="text-align:right">${esc(v)}</b></div>`).join('')}</div>`;
  }
  function orgBrief(t,n){
    const R=((D.careers[t]||{}).cards||{});const keys=Object.keys(R).filter(k=>k.split('/')[0]===n);
    const br=t==='assoc'&&((D.careers.assoc||{}).brief||{})[n];
    return keys.length?'전용 책장 있음'+(br?' · '+br:'')+(t==='wing'&&n==='R사 날개'?' · 입사 때 팀 결정 (토끼·순록·코뿔소)':''):(CFG.freeWing.names.includes(n)?`전용 책장 없음 · 보정치 증가 (최대 HP +${CFG.freeWing.fx.maxHp}, 공격·회피·속도 +${CFG.freeWing.fx.atk}, 사건 판정 +${CFG.freeWing.fx.check})`:'')
  }
  function vOrgPick(){
    const t=G.ch.orgPick;
    return `<div class="panel stack" style="gap:8px;border-color:var(--gold)"><span class="eyebrow">${t==='wing'?'날개 입사':t==='office'?'사무소 입소':t==='syn'?'조직 가입':'협회 입회'}</span>
      <p class="small">${t==='wing'?'어느 날개에 들어갈지 고른다.':t==='office'?'어느 사무소에 들어갈지 고른다.':t==='syn'?'어느 조직에 들어갈지 고른다. 전용 책장 8장으로 시작하고, 덱 8장부터 패시브가 열려 10장에서 최종 단계가 된다.':'어느 협회에 들어갈지 고른다.'}</p>
      ${D.orgs[t].map(n=>t==='syn'?(()=>{const F=D.fingers[n];return `<button class="btn" data-a="orgset" data-i="${esc(n)}"><b>${esc(n)}</b><span class="small">${esc(F.trait)}</span><span class="mono small" style="color:var(--gold)">${F.ranks.map(r=>esc(r.n)).join(' → ')}</span><span class="small dim">${esc(fingerPassive(n,0))}</span><span class="small dim">${esc(F.lore||'')}</span></button>`})():`<button class="btn" data-a="orgset" data-i="${esc(n)}"><b>${esc(n)}</b><span class="small dim">${esc(t==='office'?((D.offices||[]).find(o=>o.n===n)||{}).h||'':orgBrief(t,n))}</span></button>`).join('')}</div>`;
  }
  function vFingerPick(){
    return `<div class="panel stack" style="gap:8px;border-color:var(--gold)"><span class="eyebrow">손가락 가입</span>
      <p class="small">어느 손가락에 설지 고른다. 정하면 그 손가락의 서열표를 따른다.</p>
      ${D.orgs.finger.map(n=>{const F=D.fingers[n];return `<button class="btn" data-a="fingerset" data-i="${esc(n)}"><b>${esc(n)}</b><span class="small">${esc(F.trait)}</span><span class="mono small" style="color:var(--gold)">${F.ranks.map(r=>esc(r.n||(r.branch||[]).map(b=>b.n).join(' / '))).join(' → ')}</span><span class="small dim">${esc(fingerPassive(n,0)||'')}</span></button>`}).join('')}</div>`;
  }
  function vSeongPick(){
    const N=D.pinky.named;
    return `<div class="panel stack" style="gap:8px;border-color:var(--gold)"><span class="eyebrow">${N.t}</span>
      <p class="small">${N.x} 이름 뒤에 '성도'가 붙는다.</p>
      <div class="row"><span class="small">이름</span><input id="seongname" maxlength="12" value="${esc(UI.seongName||'')}" autocomplete="off" placeholder="1~12글자" style="width:min(14em,60vw)"></div>
      <span class="small bad">${UI.seongErr||''}</span>
      <button class="btn primary" data-a="seongset">이 이름으로 부른다</button></div>`;
  }
  function vWingPick(){
    return `<div class="panel stack" style="gap:8px;border-color:var(--gold)"><span class="eyebrow">날개 설립</span>
      <p class="small">새 법인의 이름을 정한다. 뒤에 '날개'가 붙는다.</p>
      <div class="row"><span class="small">이름</span><input id="wingname" maxlength="12" value="${esc(UI.wingName||'')}" autocomplete="off" placeholder="1~12글자" style="width:min(14em,60vw)"></div>
      <span class="small bad">${UI.wingErr||''}</span>
      <button class="btn primary" data-a="wingset">이 이름으로 세운다</button></div>`;
  }
  function vTitlePick(){
    const ch=G.ch,adj=D.colors[ch.ci].adj,cur=ch.title.slice(adj.length+1);
    return `<div class="panel stack" style="gap:8px;border-color:${ch.color}"><span class="eyebrow">${T.titleLabel} 이름 정하기</span>
      <p class="small">도시가 당신을 부를 이름이다. 색 뒤에 붙을 말을 2~12글자로 적는다.</p>
      <div class="row"><b class="serif" style="color:${ch.color}">${esc(adj)}</b><input id="tw" maxlength="12" value="${esc(cur)}" autocomplete="off" placeholder="2~12글자" style="width:min(12em,50vw)"></div>
      <span class="small bad" id="twerr">${UI.twErr||''}</span>
      <button class="btn primary" data-a="tname">이 이름으로 정한다</button></div>`;
  }
  function vLevel(){
    const ch=G.ch,fresh=UI.lvFresh&&MODE!=='off';
    const pool=fresh?` data-cyc="${esc(D.growth.map(y=>y.n).join('|'))}"`:'';
    const opts=ch.lvOpts.map((o,i)=>`<button class="btn grow" data-a="grow" data-i="${i}"><span class="row"><span class="v" ${fresh?`data-roll="${o.r}"`:''}>${o.r}</span><b${pool}>${o.g.n}</b></span><span class="mono small" style="color:var(--gold)">${o.g.e}</span></button>`).join('');
    return `${vHud()}<div class="stack" style="gap:6px"><div class="eyebrow">레벨 업 · Lv ${ch.lv-ch.lvPend+1} · 성장표 1d100 ×3</div><h2>한 단계 자랐다</h2>
      <p class="lead small">성장표를 1d100으로 세 번 굴려, 나온 세 칸 중 하나를 고른다.</p>
      <p class="small dim">왼쪽 숫자는 성장표에서 어느 칸이 나왔는지 보여 줄 뿐이다. 숫자가 크다고 더 좋은 것은 아니니, 오른쪽 효과를 보고 고르면 된다.</p></div><div class="stack">${opts}</div>`;
  }
  /* 전투 화면을 한 화면 안에 들어오게 줄인 배치. 휴대폰에서 먼저 만들었고 PC도 같은 배치를 쓴다
     (예전 PC 배치로 되돌리려면 여기를 matchMedia('(max-width: 600px)')로 바꾼다) */
  const isMobile=()=>true;
  function entHtml(side,X,v,compact){
    const col=X.color;PREV[side]={...v};
    const head=compact?`<div class="entname"><span class="swatch" style="background:${col}"></span><b class="serif" style="color:${col}">${entName(X)}</b></div><span class="mono small" id="hp-${side}">HP ${v.hp}/${X.maxHp}${side==='P'?` · 정신 ${G.ch.mind}`:''}</span>`
      :`<div class="row between"><div class="row"><span class="swatch" style="background:${col}"></span><b class="serif" style="color:${col}">${entName(X)}</b></div><span class="mono small" id="hp-${side}">HP ${v.hp}/${X.maxHp}${side==='P'?` · 정신 ${G.ch.mind}`:''}</span></div>`;
    return `<div class="panel stack ent${compact?' compact':''}" id="ent-${side}" style="background:color-mix(in srgb,${col} 9%,var(--panel));border-color:color-mix(in srgb,${col} 45%,var(--line))">
      ${head}
      <div class="bar" id="bar-${side}"><i style="width:${clamp(v.hp/X.maxHp*100,0,100)}%;background:${col}"></i></div>
      <div class="chips" id="chips-${side}">${stacks(v)}</div>${side==='P'&&C&&C.ally?`<div class="small" style="color:var(--bleed)">${esc(C.ally.name)} · 함께 싸운다 <span class="dim">· 같은 공격을 함께 굴려 주사위 합 ¾씩 · 상대 명중 +${CFG.bond.allyHit}</span></div>`:''}${side==='E'&&X.passive?`<div class="small" style="color:var(--gold)">패시브 · ${esc(X.passive.n)}${X.passive.id==='recital'?` (악장 ${X.recital||0}/${X.passive.every})`:''}${X.passive.id==='stance'?` (${X.stance==='bear'?'곰 사냥':'범 사냥'} · 살 ${X.sal==null?5:X.sal}/${X.passive.salMax})`:''}${X.maskOn?' <b>(이번 라운드 발동)</b>':''} <span class="dim">· ${esc(X.passive.d)}</span></div>`:''}${side==='E'&&X.trait&&D.traits&&D.traits[X.trait]?`<div class="small" style="color:var(--gold)">특성 · ${esc(D.traits[X.trait].n)} <span class="dim">· ${esc(D.traits[X.trait].d)}</span></div>`:''}</div>`;
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
    /* 빛 회복 카드(gain)는 내는 순간 빛이 그만큼 늘어난다 */
    const cost=UI.sel.reduce((a,i)=>a+D.cards[P.hand[i]].c-(D.cards[P.hand[i]].gain||0),0),left=P.light-cost;
    const cards=P.hand.map((id,i)=>{
      const c=D.cards[id],si=UI.sel.indexOf(i),lk=i===P.locked,dis=lk||(si<0&&c.c>left)||(c.needBlack&&!P.black)||(c.needLow&&X.hp>X.maxHp*CFG.raven.low);
      return `<button class="card ${si>=0?'sel':''}${P.index&&i===P.starSlot?' presc':''}" data-a="pick" data-i="${i}" ${dis?'disabled':''}>
        <span class="cost">${c.c}</span>${si>=0?`<em class="ord">${si+1}</em>`:''}${P.index&&i===P.starSlot?'<span class="prescTag">📜 지령</span>':''}
        <span class="nm">${kindBadge(c)} ${c.n}${c.t==='atk'&&P.cg&&P.cg.n?` <b style="color:var(--gold)">${P.cg.n}</b>`:''}${lk?` <span class="bad small">잠김 · ${esc(C.E.passive.n)}</span>`:''}</span>${c.t==='atk'?`<span class="mono small" style="color:var(--gold)">최종 명중 ${sg(P.atk+c.hit+(P.passHit||0)+(P.cg?P.cg.hit:0))}${P.fsOn&&P.fs?' (+선제 '+CFG.firstHit+')':''}</span>`:''}<span class="cd">${cardLine(c,c.t==='atk'?P.cg:null,P.wx)}</span>
        ${c.kw?`<span class="chips">${kwChips(c)}</span>`:''}</button>`;
    }).join('');
    return `${M?duo({E:X,P})+vOrder(true):entHtml('E',X,X)+arenaHtml(false)+entHtml('P',P,P)+vOrder()+log}
      ${P.index&&P.starId?`<div class="prescBar"><b>📜 이번 라운드 지령</b> · <b>${esc(D.cards[P.starId].n)}</b>을(를) 내라 <span class="small">→ 지령 수행 +1 (지금 ${P.presc||0}/5) · 호흡 +4 · 받는 피해 −5%씩</span>${UI.sel.some(j=>j===P.starSlot)?' <b class="good">✔ 지령 카드를 골랐다</b>':''}</div>`:''}
      ${triBar(P)}
      ${egoBar(C.ch)}
      <div class="row between"><span class="eyebrow">손패 · 고른 순서대로 위 순서에 들어간다</span><span class="mono" style="color:var(--gold)">${P.distorted?'빛 없음':`빛 ${left}/${P.light}`}</span></div>
      <div class="hand">${cards}</div>
      ${FIGHT==='auto'?`<div class="check">${UI.paused?'일시정지 · 다음 라운드를 기다린다':'자동 전투 중 · 카드를 알아서 고르고 진행한다'}</div><div class="row" style="gap:8px"><button class="btn${UI.paused?' primary':''}" style="flex:1" data-a="pause"><b>${UI.paused?'이어서 진행':'일시정지'}</b></button><button class="btn quiet" style="flex:1" data-a="fightmode" data-i="pick">직접 고르기로 바꾸기</button></div>`
        :`<button class="btn primary" data-a="go">${UI.sel.length?'행동 개시':'카드 없이 방어 자세'}</button><button class="btn quiet" data-a="fightmode" data-i="auto">자동 전투로 바꾸기</button>`}
      ${M?`${log}<details class="logbox"><summary>설정 (테마 · 연출 · 전투 진행)</summary><div class="stack" style="margin-top:10px">${vSettings()}</div></details>`:vSettings()}`;
  }
  /* 하나 협회 패시브: 카드 위에서 매 라운드 한 가지를 고른다 */
  const TRI_E={gun:'공격 피해 +'+CFG.tri.gun,gon:'받는 피해 −'+CFG.tri.gon+'%',gam:'빛 +'+CFG.tri.gam,ri:'HP +'+CFG.tri.ri.heal+' · 호흡 +'+CFG.tri.ri.breath};
  function triBar(P){
    if(!E.triOk(C))return '';
    const used=C.triRound===C.round&&!PLAYING,off=PLAYING||FIGHT==='auto';
    return `<div class="triBar"><div class="small dim">하나 협회 · 이번 라운드 한 가지를 고른다 (같은 괘는 연속으로 못 고른다)${used?' · <b class="good">'+esc(CFG.tri.names[C.tri])+' 선택</b>':''}</div><div class="row" style="gap:6px">${Object.keys(CFG.tri.names).map(k=>`<button class="btn quiet${C.tri===k?' primary':''}" style="flex:1;padding:8px 4px" data-a="tri" data-i="${k}" ${off||C.triRound===C.round||C.triPrev===k?'disabled':''}><b>${esc(CFG.tri.names[k])}</b><br><span class="small">${C.triPrev===k&&C.triRound!==C.round?'직전에 고른 괘':esc(TRI_E[k])}</span></button>`).join('')}</div></div>`;
  }
  /* 엔딩: 진로별 최종 자리와 칭호, 사망이면 원인 */
  /* 내가 세운 날개가 있으면 소속 이름은 그 날개로 보인다 (승진해도 입사한 회사 이름으로 되돌아가지 않는다) */
  const affName=c=>c.aff?(c.corp&&c.corp.wing?c.corp.wing:c.aff.name):'';
  /* 보스를 쓰러뜨려 얻은 추가 칭호(피의 왈츠 등)는 직급 칭호와 따로 쌓인다 */
  const extraT=c=>(c.titles||[]).map(t=>' · '+esc(t)).join('');
  const careerLine=c=>careerLine0(c)+extraT(c);
  function careerLine0(c){
    if(c.job)return T.jobs[c.job]+(c.title?' · '+esc(c.title):'');
    if(c.aff&&c.corp&&c.corp.wing)return `${esc(c.corp.wing)} · 대표${c.title?' · '+esc(c.title):''}`;
    if(c.aff&&c.fr)return `${esc(affName(c))} · ${esc(c.fr.n)}${c.oracle?' · 신탁대행자':''}${c.title?' · '+esc(c.title):''}`;
    if(c.licensed)return E.rankLabel(c)+(c.aff?' · '+esc(affName(c)):'');
    return c.aff?esc(affName(c)):T.unnamed;
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
  /* 엔딩 덱: 종류별로 묶어 접을 수 있게, 카드 등급·장수를 함께 */
  function endDeck(c){
    const g=E.cardGrade(c.year,c),cnt={};c.deck.forEach(id=>cnt[id]=(cnt[id]||0)+1);
    const groups={};for(const id of Object.keys(cnt)){const k=cardKind(D.cards[id]);(groups[k]=groups[k]||[]).push(id)}
    return Object.keys(KIND).filter(k=>groups[k]).map(k=>`<details class="endgrp" open style="--kc:${KIND[k][1]}"><summary><span class="kb" style="--kc:${KIND[k][1]}">${KIND[k][0]}</span> <span class="mono small dim">${groups[k].reduce((a,id)=>a+cnt[id],0)}장</span></summary>
      <div class="chips">${groups[k].map(id=>{const x=D.cards[id];return `<span class="chip" style="border-color:color-mix(in srgb,${KIND[k][1]} 55%,var(--line2))">${esc(x.n)}${x.t==='atk'&&g.n?` <b style="color:var(--gold)">${g.n}</b>`:''}${cnt[id]>1?` <span class="dim">×${cnt[id]}</span>`:''}${isDebuff(x)?` <span style="color:${KIND.debuff[1]}">디버프</span>`:''}</span>`}).join('')}</div></details>`).join('')
      +`<div class="mono small dim">덱 ${c.deck.length}장${(c.side||[]).length?` · 카드함 ${c.side.length}장`:''}</div>`;
  }
  /* 육신 뒤틀림 상태로 맞은 엔딩: 전용 문구 */
  const distEyebrow=(w,tr,dt)=>!w&&dt&&dt.hunt?'사랑하던 이의 손에':tr?'뒤틀린 채 발톱과 조율자를 넘어섰다':w?`뒤틀린 채 ${CFG.years}년을 살아냈다`:'뒤틀림이 쓰러졌다';
  function distLead(c,w,tr,dt){
    const raw=c.distForm.n,n=esc(raw),ch_=raw.charCodeAt(raw.length-1),bat=ch_>=0xAC00&&ch_<=0xD7A3&&(ch_-0xAC00)%28>0;
    if(tr)return `도시의 별도, 발톱도, 조율자도 그것을 삼키지 못했다. 마지막 위협이 지나간 뒤 골목에 남은 것은 '${n}'${bat?'이라는':'라는'} 이름 하나였다. 그 이름이 한때 사람이었다는 것을 아는 이는 이제 아무도 없다.`;
    if(w)return `도시는 그것을 '${n}'${bat?'이라고':'라고'} 불렀다. 처음에는 괴담이었고, 나중에는 골목의 일부가 되었다. 해결사들이 몇 번 찾아왔지만 돌아간 사람보다 돌아가지 못한 사람이 더 많았다. 원래 이름을 기억하는 사람은 남지 않았다. 그래도 가끔, 그것은 사람이던 시절의 버릇대로 어느 집 문 앞에서 한참을 멈춰 선다.`;
    if(dt&&dt.hunt)return c.kidFoeSpouse?`'${n}'${bat?'은':'는'} 낯익은 손에 쓰러졌다. 의뢰서를 든 사람은 사랑하던 이였다. 이름을 불렀지만 뒤틀린 목소리는 대답이 되지 못했고, 마지막으로 본 것은 곁에서 늙어 가던 얼굴이었다.`:`'${n}'${bat?'은':'는'} 낯익은 손에 쓰러졌다. 의뢰서를 든 사람은 함께 나이를 먹던 아이였다. 이름을 불렀지만 뒤틀린 목소리는 대답이 되지 못했고, 마지막으로 본 것은 자신을 닮은 얼굴이었다.`;
    return `'${n}'${bat?'은':'는'} ${dt&&dt.foe?esc(dt.foe)+'의 손에':'골목 끝에서'} 쓰러졌다. 의뢰서에는 '뒤틀림 제거 완료'라고만 적혔다. 그 아래, 원래 이름을 적는 칸은 비어 있었다.`;
  }
  /* 아이가 있으면 엔딩마다 한 문단이 붙는다: 뒤틀림사(도시가 기억하지 못함) · 쓰러짐 · 살아냄, 1막·2막·무한 모드별 */
  /* 엔딩 에필로그: 이 판의 행적을 이야기로 엮는다 (출신 · 진로 · 만난 이들 · 가족 · 마음 · 마지막) */
  function epilogue(c,w,tr){
    const nm=c.name||'당신',yr=G.year,P=[];
    /* 조사: 받침이 있으면 앞 것, 없으면 뒤 것 (으로/로는 ㄹ 받침도 뒤 것) */
    const jp=(x,a,b)=>{const ch=String(x).replace(/[^가-힣]+$/,'').slice(-1).charCodeAt(0),f=ch>=0xAC00&&ch<=0xD7A3?(ch-0xAC00)%28:0;return x+(a==='으로'?(f&&f!==8?'으로':'로'):f?a:b)};
    const J={eun:x=>jp(x,'은','는'),eul:x=>jp(x,'을','를'),i:x=>jp(x,'이','가'),gwa:x=>jp(x,'과','와'),ro:x=>jp(x,'으로','로')};
    const E_=esc;
    P.push(`${J.eun(E_(nm))} ${J.ro(E_(c.o.n))} 태어났다. ${J.eul(E_(c.t.n))} 타고났고, ${J.eul(E_(c.f.n))} 짊어진 채, ${J.eul(E_(c.w.n))} 손에 쥐고 이 도시의 골목에 섰다.`);
    if(c.job)P.push(`평범한 길은 일찍 닫혔다. ${E_(T.jobs[c.job])}의 자리가 ${E_(nm)}에게 주어졌고, 그 일은 사는 내내 이름을 대신했다.`);
    else if(c.aff&&c.corp&&c.corp.wing)P.push(`담장 안에서 시작해 담장을 스스로 세웠다. ${E_(c.corp.wing)}의 대표로서 이름을 걸었고, 그 이름은 다른 이들의 일자리가 되었다.`);
    else if(c.aff&&c.fr)P.push(`${E_(affName(c))}에 들어가 ${E_(c.fr.n)}까지 올랐다. 서열은 손이 아니라 버틴 햇수로 정해졌고, ${J.eun(E_(nm))} 그 계단을 하나씩 밟았다.`);
    else if(c.aff)P.push(`${E_(affName(c))}의 일원으로 해를 넘겼다.`);
    else P.push('어디에도 속하지 않았다. 혼자 움직이는 편이 낫다는 말은 처음 한 말 그대로 끝까지 남았다.');
    if(c.licensed&&!c.job)P.push(`해결사로서는 ${c.rank}${T.rankUnit}${c.title?` · ${E_(c.title)}`:''}에 닿았다. 의뢰서에 적힌 이름 하나하나가 ${yr}년 동안 쌓은 기록이다.`);
    else if(c.title)P.push(`${jp(E_(c.title),'이라는','라는')} 이름이 붙었다. 누가 먼저 불렀는지는 아무도 기억하지 못한다.`);
    if(c.beaten.length)P.push(`그 사이 도시가 감춰 둔 것들과 마주쳤다. ${c.beaten.map(id=>E_(D.enemies[id].n)).join(', ')}. 이름이 기록에 남지 않은 싸움도 있었고, 이름만 남은 싸움도 있었다.`);
    if(E.bondMarried(c)){const k=(c.bond.kids||[]);P.push(`곁에는 ${J.i(E_(c.bond.name))} 있었다. ${k.length?`아이 ${jp(k.map(x=>E_(x.n)).join(' · '),'과','와')} 함께 식탁을 나눴다. `:''}도시의 해가 바뀔 때마다 한 사람 몫의 자리가 더 비어 있지 않다는 것이 가장 큰 보상이었다.`)}
    else if(c.bond&&c.bond.st==='lost')P.push('한 번은 곁에 누군가 있었다. 지키지 못한 이름 하나가 오래 남았다.');
    if(c.distForm)P.push(`육신은 뒤틀렸고, ${J.i(E_(c.distForm.n))} 이름이 되었다. 그래도 걸음은 멈추지 않았다.`);
    else if(c.ego)P.push(`마음이 무너지려던 순간 붙잡은 모양이 ${J.i(E_(c.ego.n||'E.G.O'))} 되어 곁에 남았다. 그것은 무기이기 전에 버틴 증거였다.`);
    P.push(w?(tr?`${yr}년. 도시가 붙일 수 있는 가장 높은 이름을 넘어섰다. 발톱도, 조율자도 ${J.eul(E_(nm))} 막지 못했다. 끝이라고 부르던 자리 너머로 길은 이어져 있었다.`:`${yr}년. 도시는 해마다 시끄러웠고 해마다 조용해졌다. ${J.eun(E_(nm))} 그 소란 속에서 끝까지 서 있었다. 이야기는 여기서 한 막을 내린다.`):'');
    return P.filter(Boolean);
  }
  function kinLine(c,w,dt){
    const b=c.bond,kids=(b&&b.kids||[]).filter(k=>!k.dead);if(!D.bond.ending)return '';
    if(!w&&dt&&dt.hunt)return `<p class="small" style="border-left:2px solid var(--gold);padding-left:10px">${esc(E.bondFill(D.bond.hunt.ending[G.infinite?'inf':G.endless?'act2':'act1'].replace(/\{k\}/g,'{n}'),{name:dt.hunt}))}</p>`;
    if(!kids.length)return '';
    const X=D.bond.ending,ph=G.infinite?'inf':G.endless?'act2':'act1',forgot=!w&&(c.distForm||(dt&&dt.cause==='distort'));
    const t=forgot?X.forgotten[ph]:w?(UI.oldEnd?X.win.old:X.win[ph]):X.death[ph];
    return t?`<p class="small" style="border-left:2px solid var(--gold);padding-left:10px">${esc(t).replace(/\{k\}/g,kids.length>1?'자식들':'자식')}</p>`:'';
  }
  const diffOf=c=>c.easy?'쉬움':c.hard?'하드':'보통';
  /* 출생 보정 없이 시작한 존재가 제 1막을 넘겼을 때(제 2막에 이르렀을 때)의 전용 엔딩 */
  const blankEnd=(c,w)=>{if(UI.rbEnd&&w)return 'rcorp';if(UI.hwEnd&&w)return UI.hwEnd;if(!(w&&c&&!c.distForm&&!G.endless&&!UI.oldEnd&&!UI.trueEnd))return '';const m=!!(E.bondMarried&&E.bondMarried(c));return c.rb&&c.rb.done?'rcorp':c.blank?(m?'blankwed':'blank'):m?'wed':''};
  const BLANK_END={hwhost:['선황충을 품은 가주','붉은 누각의 등이 모두 켜졌다. 열두 흑수가 고개를 숙이고 가주의 자리가 비워졌다. 자리에 앉은 것은 당신이지만, 선황충은 당신의 이름으로 먹고 마신다. 몸은 지칠 줄 모르고 마음은 한 겹 멀다. 홍원은 새 주인을 얻었고, 주인은 아직 자기가 누구인지 모른다.'],
    hwbreak:['철함사의 목을 친 가주','흑수 선인에게서 얻은 재갈이 허리춤에서 짤랑거렸다. 수레는 멈췄고 선황충은 숙주를 얻지 못한 채 향 속에서 말라 갔다. 어르신들은 일어서지 못했다. 열두 흑수가 새 가주 앞에 고개를 숙이고, 가주의 몫이던 네 재갈마저 당신의 허리춤으로 건너왔다. 홍원의 가주 자리는 더 이상 함정이 아니다.'],
    hwfree:['홍원의 가주','선황충을 상자에 가둔 채 가주의 자리에 앉았다. 어르신들은 일어서지 않았고 열두 흑수는 새 주인 앞에 말없이 무릎을 꿇었다. 가문의 식탁에는 이제 자리마다 이름표가 없다. 가장 먼 자리에도 따뜻한 밥이 놓인다.'],
    rcorp:['나는 존재한다. 그러므로 살아있다','부화장에서 같은 얼굴 열둘을 쓰러뜨리고 나왔다. 본체인지 복제체인지는 끝내 알 수 없었다. 번호표는 재가 되었고, 추격대의 호출 부호도 끊겼다. 이름 없는 몸으로 첫 번째 막을 넘겼다. 누가 만들었든, 지금 숨을 쉬는 것은 당신이다. 나는 존재한다. 그러므로 살아있다.'],
    blank:['아무것도 없는 존재',`이름도 내력도 쥐여 주지 않은 채 태어난 존재가 ${CFG.years}년을 걸어 첫 번째 막을 넘겼다. 아무것도 없던 손에는 이제 이 도시에서 살아낸 시간이 있다. 도시는 그것을 기억하지 않지만, 당신은 기억한다.`],
    wed:['함께 넘은 첫 번째 막',`같은 이름을 오래 불렀다. 도시는 변했고 서류 속 이름은 닳았지만, 문을 열면 대답하는 사람이 있었다. ${CFG.years}년이 지나 첫 번째 막이 끝났다. 다음 막에도 그 목소리는 곁에 있을 것이다.`],
    blankwed:['아무것도 없는 존재 · 가족',`아무것도 없던 존재가 누군가의 이름을 불렀고, 누군가가 대답했다. ${CFG.years}년이 지나 첫 번째 막이 끝났을 때 곁에는 같은 지붕 아래의 사람이 있다. 아무것도 없던 곳에서 시작한 이야기가 둘이 되었다.`]};
  const OUTEND={seal:['균열이 닫혔다','외곽의 괴수들이 하나둘 울음을 멈췄다. 세계의 균열은 당신이 선 자리에서 가장 먼저 아물었다. 머리도 닫지 못한 문을, 당신이 한 겹 닫았다.'],
    star:['도시의 별이 되었다','이름을 가진 존재들 거의 전부와 맞서 이겼다. 도시의 장부에는 더 이상 당신에게 붙일 이름이 없었고, 사람들은 하늘에 새로 뜬 별 하나를 당신의 이름으로 불렀다.'],
    settle:['외곽에 집을 지었다','괴수의 울음이 닿지 않는 언덕에 작은 집을 지었다. 식탁에는 가족의 자리가 있고, 창밖의 균열은 오늘도 멀리서 닫혀 간다.']};
  function vEnd(){
    const c=G.ch,w=UI.endWin,dt=UI.death,X=CFG.endless,gi=E.gradeAt(G.year),tr=w&&UI.trueEnd,df=c.distForm;
    /* 전투 중 E.G.O 개화·뒤틀림 이름을 정하기 전에 판이 끝났으면(전투에서 쓰러짐 등) 결과 화면에서 먼저 정한다 */
    if(c.namePend)return `<div class="stack" style="gap:12px"><div class="eyebrow">이야기를 끝내기 전에</div>${vNamePend()}</div>`;
    return `<div id="endShot" class="stack" style="gap:12px"><div class="stack" style="gap:8px;padding-top:12px"><div class="eyebrow"${df?' style="color:#c25050"':''}>${df?distEyebrow(w,tr,dt):UI.outEnd?OUTEND[UI.outEnd][0]:UI.outerEnd?'외곽에서 이야기를 끝냈다':UI.oldEnd?'히든 엔딩 · 늙었다는 것은 살아남았다는 것':tr?'발톱과 조율자를 넘어섰다':blankEnd(c,w)?BLANK_END[blankEnd(c,w)][0]:w?CFG.years+'년을 살아냈다':dt&&dt.id==='hongru'?'홍원에 군주가 태어났다':dt&&dt.hunt&&G.ch.distForm?'당신은 사랑하던 이의 손에 쓰러졌다':dt&&dt.cause==='distort'?'당신은 뒤틀렸다':'도시는 당신을 기억하지 않는다'} · ${E.age(G)}세</div>
      <h1 style="color:${c.color}">${esc(c.name||careerLine(c))}</h1>
      ${c.name?`<div class="mono small" style="color:${c.color}">${careerLine(c)}</div>`:''}
      ${df?`<div><span class="chip" style="color:#c25050;border-color:#c25050">뒤틀림 · ${esc(df.n)}</span></div>`:''}
      ${E.bondMarried(c)?`<div><span class="chip">가족 · ${esc(c.bond.name)}${c.distForm?' (당신을 알아보지 못한다)':''}</span></div>`:''}
      ${(c.bond&&(c.bond.kids||[]).length)?`<div class="row" style="gap:6px;flex-wrap:wrap">${c.bond.kids.map(k=>{const a=Math.max(0,G.year-k.born);return `<span class="chip">아이 · ${esc(k.n)} ${a}세${a>=CFG.bond.kid.adult?' · '+esc((D.bond.kidJobs.find(j=>j.k===k.job)||{}).l):''}</span>`}).join('')}</div>`:''}
      ${c.title?`<div><span class="chip" style="color:var(--gold);border-color:var(--gold)">${c.titleKind==='top'?'칭호':T.titleLabel} · ${esc(c.title)}</span></div>`:''}
      ${!w&&dt?`<div class="mono small bad">${dt.year}년차 · ${dt.cause==='distort'?'뒤틀림':dt.cause==='mind'?'정신 붕괴로 쓰러졌다':esc(dt.foe)+'에게 쓰러졌다'}${dt.hidden?' (히든 보스)':''}</div>`:''}
      <div class="row" style="gap:8px;flex-wrap:wrap"><span class="chip" style="color:${c.hard?'#c25050':c.easy?'#6aa0c4':'var(--fg)'};border-color:currentColor">난이도 · ${diffOf(c)}</span><span class="mono small dim" style="align-self:center">시드 ${c.seed}</span></div>
      <p class="lead">${df?distLead(c,w,tr,dt):UI.outEnd?OUTEND[UI.outEnd][1]:UI.outerEnd?'머리가 닫은 문 바깥, 아무도 이름을 붙이지 않은 땅에서 당신은 걸음을 멈췄다. 괴수들의 울음이 멀어졌다. 쫓겨난 것이 아니라 스스로 닿은 자리라고, 누군가는 기록할 것이다.':UI.oldEnd?'백 살을 넘겼다. 이 도시에서 늙는다는 것은 끝까지 이겨 왔다는 뜻이다.':blankEnd(c,w)?BLANK_END[blankEnd(c,w)][1]:dt&&dt.id==='hongru'?'홍루가 가주의 자리 앞에서 붕대를 천천히 풀었다. 주인을 잃은 열 흑수가 그의 곁으로 모였다. 붉은 누각의 등이 하나씩 켜졌고, 홍원에는 군주가 살게 되었다. 이 세계에서 홍원 군주는 그렇게 태어났다.':dt&&dt.cause==='distort'?'당신의 모양을 한 무언가가 골목에 남았다. 사람들은 그것을 더 이상 당신의 이름으로 부르지 않는다.':dt&&dt.cause==='mind'?'몸은 멀쩡했지만, 마음이 먼저 꺼졌다.':tr?'바랄의 발톱도, 제나의 봉인도 당신을 멈추지 못했다. 금기를 정하던 쪽이 처음으로 질문을 받았고, 도시의 문은 한 번도 닫힌 적 없는 방향으로 한 뼘 열렸다. 당신을 부르는 이름은 도시의 어느 장부에도 맞지 않았다. 끝이라고 불리던 자리 너머로 외곽이 이어진다.':endLead(c,w)}</p>
      ${kinLine(c,w,dt)}
      ${w?`<div class="panel stack" style="gap:8px"><span class="eyebrow">행적</span>${epilogue(c,w,tr).map(t=>`<p class="small" style="line-height:1.65">${t}</p>`).join('')}</div>`:''}
      ${vRecord(c,w,gi)}
      ${c.beaten.length?`<div class="panel stack" style="gap:6px"><span class="eyebrow">${T.hiddenWin}</span><b>${c.beaten.map(id=>D.enemies[id].n).join(' · ')}</b>${UI.endText?`<p class="small">${UI.endText}</p>`:''}${c.unlocks.length?`<p class="small" style="color:var(--gold)">해금 · ${c.unlocks.map(k=>T.jobs[k]).join(', ')}</p>`:''}</div>`:''}</div>
      <div class="panel stack"><div class="stat"><div><b>${c.lv}</b><span>레벨</span></div><div><b>${sg(c.stats.atk)}</b><span>공격</span></div><div><b>${sg(c.stats.eva)}</b><span>회피</span></div><div><b>${sg(c.stats.spd)}</b><span>속도</span></div></div>
      ${endDeck(c)}
      <div class="mono small dim">${c.o.n} · ${c.t.n} · ${c.f.n} · ${c.w.n}${c.aff?' · '+esc(affName(c)):c.licensed?' · '+T.licensed:''}</div></div>
      <div class="mono small dim" style="text-align:center">도시의 한 해 · cityyear-fanmade.github.io/city-year · Project Moon 팬메이드</div></div>
      ${w&&!G.endless?`<div class="panel stack" style="gap:6px"><span class="eyebrow">제 1막 종료</span><p class="small">여기서 끝내도 된다. 제 2막이 시작되면 ${X.span}년마다 도시의 위협 등급이 오른다. ${X.grades.join(' → ')}. 마지막 등급을 넘기면 제 2막의 결말이다. 도중에 쓰러지면 거기까지가 기록이 된다.</p><button class="btn primary" data-a="endless">제 2막 시작</button></div>`:''}
      ${w&&UI.outEnd?`<div class="panel stack" style="gap:6px"><span class="eyebrow">무한 모드 엔딩</span><p class="small">여기서 끝내도 된다. 계속 살아가면 무한 모드가 이어진다. 도중에 쓰러지면 거기까지가 기록이 된다.</p><button class="btn primary" data-a="oldgo">계속 살아간다</button></div>`:''}
      ${w&&UI.oldEnd?`<div class="panel stack" style="gap:6px"><span class="eyebrow">히든 엔딩</span><p class="small">여기서 끝내도 된다. 계속 살아가면 무한 모드가 이어진다. 도중에 쓰러지면 거기까지가 기록이 된다.</p><button class="btn primary" data-a="oldgo">계속 살아간다</button></div>`:''}
      ${w&&(UI.hwEnd||UI.rbEnd)&&G.endless&&!UI.trueEnd?`<div class="panel stack" style="gap:6px"><span class="eyebrow">이야기의 끝</span><p class="small">여기서 끝내도 된다. 계속 살아가면 제 2막이 이어진다. 도중에 쓰러지면 거기까지가 기록이 된다.</p><button class="btn primary" data-a="oldgo">계속 살아간다</button></div>`:''}
      ${w&&UI.trueEnd&&!G.infinite?`<div class="panel stack" style="gap:6px"><span class="eyebrow">제 2막 · 무한 모드</span><p class="small">여기서 끝내도 된다. 계속 살아가면 머리에게 외곽으로 쫓겨난 셈이 되어 위협 보정이 끝없이 오르고, ${CFG.infinite.every}년마다 외곽의 괴수(더 강해진 불순물)가 나타나며, 루트 전용 히든 보스를 만날 확률이 오른다. 도중에 쓰러지면 거기까지가 기록이 된다.</p><button class="btn primary" data-a="infinite">무한 모드로 계속한다</button></div>`:''}
      <div class="row" style="gap:8px"><button class="btn quiet" style="flex:1" data-a="share">기록 공유</button><button class="btn quiet" style="flex:1" data-a="saveimg">이미지로 저장</button></div>
      ${UI.imgUrl?`<p class="small dim">저장이 막힌 환경이다. 아래 이미지를 길게 눌러 저장한다.</p><img src="${UI.imgUrl}" alt="엔딩 기록 이미지" style="width:100%;border-radius:8px">`:''}
      ${UI.shareMsg?`<p class="small dim">${UI.shareMsg}</p>`:''}${UI.shareText?`<input id="shareBox" readonly value="${esc(UI.shareText)}" onclick="this.select()" style="width:100%;font:inherit;font-size:13px">`:''}
      <button class="btn ${w&&!G.endless?'quiet':'primary'}" data-a="start">다시 태어난다</button><button class="btn quiet" data-a="title">처음 화면</button>`;
  }
  /* 기록 링크: 기록을 주소(#r=...) 안에 담는다. 서버 없이 열린다 */
  const PAGES='https://cityyear-fanmade.github.io/city-year/';
  const b64e=o=>{const u=new TextEncoder().encode(JSON.stringify(o));let x='';u.forEach(c=>x+=String.fromCharCode(c));return btoa(x).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')};
  const b64d=t=>{const x=atob(t.replace(/-/g,'+').replace(/_/g,'/'));return JSON.parse(new TextDecoder().decode(Uint8Array.from(x,c=>c.charCodeAt(0))))};
  function shareHead(){const w=UI.endWin,dt=UI.death;return UI.outEnd?OUTEND[UI.outEnd][0]:UI.outerEnd?'외곽에서 이야기를 끝냈다':w&&UI.oldEnd?'늙었다는 것은 살아남았다는 것':w&&UI.trueEnd?'발톱과 조율자를 넘어섰다':blankEnd(G.ch,w)==='rcorp'?'나는 존재한다':blankEnd(G.ch,w)?'아무것도 없던 존재':w?CFG.years+'년을 살아냈다':dt&&dt.hunt&&G.ch.distForm?'사랑하던 이의 손에':dt&&dt.id==='hongru'?'홍원에 군주가 태어났다':dt&&dt.cause==='distort'?'뒤틀렸다':'도시는 나를 기억하지 않는다'}
  function shareLink(){
    const c=G.ch,w=UI.endWin,dt=UI.death,X=CFG.endless,gi=E.gradeAt(G.year),lived=w?G.year:Math.max(0,G.year-1);
    const o={v:1,h:shareHead(),w:w?1:0,n:c.name||'',k:careerLine(c).replace(/<[^>]*>/g,'').replace(/&amp;/g,'&'),t:c.title||'',col:c.color,y:lived,a:E.age(G),
      g:G.endless&&gi>=0?X.grades[gi]:'',d:!w&&dt?`${dt.year}년차 · ${dt.cause?dt.foe:dt.foe+'에게 쓰러짐'}`:'',f:[...c.beaten,...(c.minis||[])].map(id=>D.enemies[id].n),
      e:c.ego?c.ego.n:'',i:innateName(c)||'',o:`${c.o.n} · ${c.t.n} · ${c.f.n}`,lv:c.lv,st:[c.stats.atk,c.stats.eva,c.stats.spd],s:c.seed,dy:c.daily||'',df:diffOf(c),ver:UPDATES.v};
    const base=/^https?:/.test(location.href)&&!/claude\.ai|claudeusercontent/.test(location.href)?location.origin+location.pathname:PAGES;
    return base+'#r='+b64e(o);
  }
  function vShared(){
    const r=UI.shared;
    const row=(k,v)=>v?`<div class="row between"><span class="dim">${k}</span><b class="mono" style="text-align:right">${esc(String(v))}</b></div>`:'';
    return `<div class="stack" style="gap:8px;padding-top:12px"><div class="eyebrow">공유된 기록 · ${esc(r.ver||'')}</div>
      <div class="eyebrow" style="color:${r.w?'var(--gold)':'#c46a5a'}">${esc(r.h)} · ${r.a}세</div>
      <h1 style="color:${esc(r.col||'')}">${esc(r.n||r.k)}</h1>${r.n?`<div class="mono small" style="color:${esc(r.col||'')}">${esc(r.k)}</div>`:''}
      ${r.t?`<div><span class="chip" style="color:var(--gold);border-color:var(--gold)">${esc(r.t)}</span></div>`:''}</div>
      <div class="panel stack" style="gap:6px">${row('산 햇수',r.y+'년')}${row('위협 등급',r.g)}${row('마지막',r.d)}${row('타고난 것',r.i)}${row('E.G.O',r.e)}
        ${row('레벨',`Lv ${r.lv} · 공격 ${sg(r.st[0])} · 회피 ${sg(r.st[1])} · 속도 ${sg(r.st[2])}`)}${row('출신',r.o)}${row('난이도',r.df)}${row('시드',r.s+(r.dy?' · 오늘의 시드 '+r.dy:''))}
        ${r.f&&r.f.length?`<div class="small"><span class="dim">쓰러뜨린 이름난 상대</span><br><b>${r.f.map(esc).join(' · ')}</b></div>`:''}</div>
      <button class="btn primary" data-a="sharedSeed"><b>같은 시드로 태어나기</b><span class="small">시드 ${r.s}</span></button>
      <button class="btn quiet" data-a="title">처음 화면</button>`;
  }
  /* 공유용 기록 글 */
  function shareText(){
    const c=G.ch,w=UI.endWin,dt=UI.death,X=CFG.endless,gi=E.gradeAt(G.year),lived=w?G.year:Math.max(0,G.year-1);
    const head=UI.outEnd?OUTEND[UI.outEnd][0]:UI.outerEnd?'외곽에서 이야기를 끝냈다':w&&UI.oldEnd?'늙었다는 것은 살아남았다는 것':w&&UI.trueEnd?'발톱과 조율자를 넘어섰다':blankEnd(G.ch,w)==='rcorp'?'나는 존재한다':blankEnd(G.ch,w)?'아무것도 없던 존재':w?CFG.years+'년을 살아냈다':dt&&dt.hunt&&G.ch.distForm?'나는 사랑하던 이의 손에 쓰러졌다':dt&&dt.id==='hongru'?'홍원에 군주가 태어났다':dt&&dt.cause==='distort'?'나는 뒤틀렸다':'도시는 나를 기억하지 않는다';
    const foes=[...c.beaten,...(c.minis||[])].map(id=>D.enemies[id].n);
    const url=/^https?:/.test(location.href)&&!/claude\.ai|claudeusercontent/.test(location.href)?location.href.split('#')[0]:'https://cityyear-fanmade.github.io/city-year/';
    return [`[도시의 한 해] ${head}`,(c.name?`${c.name} · `:'')+careerLine(c).replace(/<[^>]*>/g,'')+(c.title?` · ${c.title}`:''),
      `${lived}년 · ${E.age(G)}세`+(G.endless&&gi>=0?` · 위협 등급 ${X.grades[gi]}`:''),
      !w&&dt?`${dt.year}년차 · ${dt.cause?dt.foe:dt.foe+'에게 쓰러짐'}`:null,c.ego?`E.G.O · ${c.ego.n}`:null,c.innate?`타고난 것 · ${innateName(c)}`:null,foes.length?`쓰러뜨린 상대 · ${foes.join(', ')}`:null,
      `${c.o.n} · ${c.t.n} · ${c.f.n} · Lv ${c.lv}`,`난이도 · ${diffOf(c)}`,`시드 ${c.seed}`+(c.daily?` · 오늘의 시드 ${c.daily}`:''),url].filter(Boolean).join('\n');
  }
  /* 엔딩 화면 그대로 찍기: 저장 버튼을 누를 때만 html2canvas를 불러온다. 실패하면 null (카드 이미지로 대신) */
  function loadShot(){
    if(window.html2canvas)return Promise.resolve(true);
    return new Promise(res=>{const sc=document.createElement('script');sc.src='https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
      sc.onload=()=>res(!!window.html2canvas);sc.onerror=()=>res(false);document.head.appendChild(sc);setTimeout(()=>res(!!window.html2canvas),8000)});
  }
  async function shotEnd(){
    const el=$('endShot');if(!el||!(await loadShot()))return null;
    try{await document.fonts.ready}catch(e){}
    try{const bg=getComputedStyle(document.body).backgroundColor||'#0d0d0f';
      return await window.html2canvas(el,{backgroundColor:bg,scale:2,useCORS:true,logging:false,windowWidth:Math.min(900,window.innerWidth),onclone:d=>{const e=d.getElementById('endShot');if(e){e.style.padding='28px 22px';e.style.background=bg}}})}catch(e){return null}
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
    /* 너무 긴 글은 ' · ' 단위로 줄을 나눈다 (한 줄에 글자가 칸 밖으로 넘치지 않게) */
    const wrapW=(t,mx,f)=>{g.font=f;const out=[];let line='';for(const tk of String(t).split(' · ')){const tt=line?line+' · '+tk:tk;if(g.measureText(tt).width>mx&&line){out.push(line);line=tk}else line=tt}if(line)out.push(line);return out};
    const fit=(t,max,size,fam,weight)=>{let z=size;do{g.font=`${weight||''} ${z}px ${fam}`;z-=2}while(g.measureText(t).width>max&&z>20);return g.font};
    const head=UI.outEnd?OUTEND[UI.outEnd][0]:UI.outerEnd?'외곽에서 이야기를 끝냈다':w&&UI.oldEnd?'늙었다는 것은 살아남았다는 것':w&&UI.trueEnd?'발톱과 조율자를 넘어섰다':blankEnd(G.ch,w)==='rcorp'?'나는 존재한다':blankEnd(G.ch,w)?'아무것도 없던 존재':w?CFG.years+'년을 살아냈다':dt&&dt.hunt&&G.ch.distForm?'당신은 사랑하던 이의 손에 쓰러졌다':dt&&dt.cause==='distort'?'당신은 뒤틀렸다':'도시는 당신을 기억하지 않는다';
    T_('도시의 한 해',W/2,140,`500 34px ${mono}`,gold,'center');
    T_(head,W/2,200,`600 36px ${serif}`,w?gold:'#c46a5a','center');
    const nm=c.name||careerLine(c).replace(/<[^>]*>/g,'').replace(/&amp;/g,'&');
    g.font=fit(nm,W-200,96,serif,'900');g.fillStyle=col;g.textAlign='center';
    let y=400;
    if(g.measureText(nm).width>W-200){const nf=`900 44px ${serif}`,ls=wrapW(nm,W-200,nf);g.font=nf;g.fillStyle=col;g.textAlign='center';ls.forEach((l,i)=>g.fillText(l,W/2,330+i*58));y+=(ls.length-1)*58}
    else g.fillText(nm,W/2,330);
    if(c.name){const cl=careerLine(c).replace(/<[^>]*>/g,''),cf=`500 34px ${sans}`,ls=wrapW(cl,W-200,cf);g.font=cf;g.fillStyle=col;g.textAlign='center';for(const l of ls){g.fillText(l,W/2,y);y+=46}y+=10}
    if(c.title){T_('『'+c.title+'』',W/2,y,`700 40px ${serif}`,gold,'center');y+=60}
    g.strokeStyle='#2c2b30';g.beginPath();g.moveTo(140,y);g.lineTo(W-140,y);g.stroke();y+=70;
    /* 행적: 에필로그에서 출신 · 진로 · 마지막 문장만 뽑아 넣는다 */
    if(w){const plain=t=>t.replace(/<[^>]*>/g,'').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,"'");
      const ep=epilogue(c,w,UI.trueEnd).map(plain),pick=[ep[0],ep[1],ep[ep.length-1]].filter((t,i,a)=>t&&a.indexOf(t)===i);
      const wrap=(t,mx,f)=>{g.font=f;const out=[];let line='';for(const word of t.split(' ')){const tt=line?line+' '+word:word;if(g.measureText(tt).width>mx&&line){out.push(line);line=word}else line=tt}if(line)out.push(line);return out};
      T_('행적',140,y,`400 28px ${sans}`,gold);y+=52;
      for(const t of pick){for(const l of wrap(t,W-280,`400 30px ${sans}`).slice(0,4)){T_(l,140,y,`400 30px ${sans}`,ink);y+=46}y+=14}
      y+=6;g.strokeStyle='#2c2b30';g.beginPath();g.moveTo(140,y);g.lineTo(W-140,y);g.stroke();y+=60}
    const rows=[['난이도',diffOf(c)],['산 햇수',`${lived}년 · ${E.age(G)}세`]];
    if(c.aff||c.job)rows.push(['소속',c.job?T.jobs[c.job]:(c.corp&&c.corp.wing?c.corp.wing+' · 대표':`${affName(c)}${c.fr?' · '+c.fr.n:''}`)]);
    if(c.licensed&&!c.job)rows.push(['해결사',`${c.rank}${T.rankUnit}${c.title?' · '+c.title:''}`]);
    if((c.titles||[]).length)rows.push(['칭호',c.titles.join(' · ')]);
    if(E.bondMarried(c)){const k=(c.bond.kids||[]).map(x=>`${x.n} ${Math.max(0,G.year-x.born)}세`);rows.push(['가족',`${c.bond.name}${k.length?' · 아이 '+k.join(', '):''}`])}
    if(G.endless)rows.push(['위협 등급',gi>=0?X.grades[gi]:'—']);
    if(!w&&dt)rows.push(['마지막',`${dt.year}년차 · ${dt.foe}`]);
    if(c.innate)rows.push(['타고난 것',innateName(c)]);
    if(c.ego)rows.push(['E.G.O',`${c.ego.n} · ${CFG.mind.ego[c.ego.type].n}`]);
    rows.push(['정신력',`${c.mind}/${E.mindMax(c)}`]);
    rows.push(['레벨',`Lv ${c.lv} · 공격 ${sg(c.stats.atk)} · 회피 ${sg(c.stats.eva)} · 속도 ${sg(c.stats.spd)}`]);
    rows.push(['출신',`${c.o.n} · ${c.t.n}`]);
    {const gw=c.gear&&c.gear.weapon,ga=c.gear&&c.gear.armor,ge=[gw&&gw.n,ga&&ga.n].filter(Boolean).join(' · ');if(ge)rows.push(['장비',ge])}
    for(const [k,v] of rows){T_(k,140,y,`400 32px ${sans}`,dim);g.font=fit(v,W-480,36,sans,'500');
      if(g.measureText(v).width>W-480){const vf=`500 30px ${sans}`,ls=wrapW(v,W-480,vf);g.font=vf;g.fillStyle=ink;g.textAlign='right';ls.forEach((l,i)=>g.fillText(l,W-140,y+i*42));y+=72+(ls.length-1)*42}
      else{g.fillStyle=ink;g.textAlign='right';g.fillText(v,W-140,y);y+=72}}
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
    const line=G.endless?(w?`${X.grades.length}개 위협 등급을 모두 넘겼다.`:`${grade} 등급에서 멈췄다.`):w?`${CFG.years}년을 끝까지 버텼다.`:lived>CFG.years?`${lived}년을 살았다.`:`${CFG.years}년 중 ${lived}년을 살았다.`;
    return `<div class="panel stack" style="gap:6px"><span class="eyebrow">기록</span>
      <div class="row between"><span>산 햇수</span><b class="mono">${lived}년 · ${E.age(G)}세</b></div>
      ${G.endless?`<div class="row between"><span>도달한 위협 등급</span><b class="mono">${grade}</b></div>`:''}
      <div class="row between"><span>최종 자리</span><b class="mono">${careerLine(c)}</b></div>
      ${mini.length?`<div class="row between"><span>쓰러뜨린 이름난 상대</span><b class="mono">${mini.join(' · ')}</b></div>`:''}
      <p class="small dim">${line}</p></div>`;
  }
  function vSim(){
    const s=SIM,pc=x=>Math.round(x*100)+'%',seen=loadRec().seen||[];
    return `<div class="stack" style="gap:6px"><div class="eyebrow">밸런스 측정 · 각 ${s.n}회</div><h2>자동 전투 결과</h2></div>
      <div class="panel tbl"><table><thead><tr><th>적</th><th>승률</th><th>평균 라운드</th><th>승리 시 잔여 HP</th></tr></thead><tbody>
      ${s.rows.map(r=>seen.includes(r.id)?`<tr><td>${r.n}</td><td>${pc(r.win)}</td><td>${r.rounds.toFixed(1)}</td><td>${r.left.toFixed(0)}</td></tr>`:`<tr class="dim"><td>???</td><td>???</td><td>???</td><td>???</td></tr>`).join('')}</tbody></table></div>
      <div class="panel stack"><div class="row between"><span>연속 ${s.chainIds.length}전 클리어</span><b class="mono" style="color:var(--gold)">${pc(s.chain)}</b></div>
      <div class="row between"><span>연속 ${s.chainIds.length}전 · 성장 반영</span><b class="mono" style="color:var(--gold)">${pc(s.grown)}</b></div>
      <p class="small dim">무작위 캐릭터(성장기 포함), 카드는 손패에서 무작위로 낸다. 전투 사이 HP ${CFG.chainHeal} 회복. 더 많이 돌리려면 터미널에서 npm run sim -- --n 2000</p></div>
      <button class="btn primary" data-a="sim">다시 측정</button><button class="btn quiet" data-a="title">돌아가기</button>`;
  }
  function render(){
    const s=UI.screen;
    BGM.setScene(s==='combat'?'fight':'calm');
    const h={shared:vShared,records:vRecords,shopask:vShopAsk,title:vTitle,birth:vBirth,event:vEvent,result:vResult,level:vLevel,combat:vCombat,end:vEnd,sim:vSim,shop:vShop}[s]();
    const tab=`<span class="skin-tab">${SKIN_TAB[SKIN]}</span>`;
    /* 가방·받기 화면은 위에 덮는다. 받기(새 장비·카드)가 남아 있으면 그게 먼저다 */
    const ok=G&&G.ch&&['result','event','shop','shopask','level'].includes(s)&&!UI.animing;
    const pend=ok&&((G.ch.gearOffers||[]).length||G.ch.packOffer||(G.ch.offers||[]).length);
    const showNotice=s==='title'&&!UI.shared&&store.get('cityYearNotice')!==NOTICE.id;
    const ov=UI.cfg?sheet(`<div class="row between" style="flex-wrap:nowrap;gap:8px"><b class="serif">설정</b><button class="btn quiet" data-a="cfgclose">닫기</button></div>${FIGHT==='auto'&&s==='combat'?'<span class="small dim">설정을 여는 동안 자동 전투가 멈춘다. 닫으면 이어서 진행한다</span>':''}<div class="stack" style="margin-top:10px">${vSettings()}</div>`,'offer',true):pend?vOffer():ok&&UI.bag?vBag():showNotice?sheet(`<span class="eyebrow">공지</span><h2>${esc(NOTICE.t)}</h2><p class="small dim">${esc(NOTICE.note)}</p>${noticeBody()}<button class="btn primary" data-a="noticeok">확인</button>`,'offer',false):'';
    const ovKey=UI.cfg?'cfg':showNotice&&!pend&&!(ok&&UI.bag)?'notice':pend?'offer:'+(G.ch.packOffer?'p':(G.ch.gearOffers||[]).length?'g':'c')+(UI.swap?'s':''):ov?'bag':'';
    app.innerHTML=`<div class="wrap">${tab}${h}</div>${h.includes('dock-in')?vDock('dock-out')+vSideL():s==='combat'&&C&&C.P?vSideL(C.P):''}${ov}${!ov&&!['title','birth'].includes(s)?'<button class="cfgbtn" data-a="cfg" aria-label="설정" title="설정">⚙</button>':''}`;
    if(ov&&ovKey!==UI.lastOv){const sh=app.querySelector('.sheet');if(sh)anim(sh,'bagopen',420)}
    UI.lastOv=ovKey;document.documentElement.classList.toggle('ovopen',!!ov);
    const lg=$('log');if(lg)lg.scrollTop=lg.scrollHeight;
    if(s!==lastScreen){window.scrollTo(0,0);lastScreen=s}
    if(s==='birth'&&BC.fresh&&MODE!=='off'){BC.fresh=false;rollAnim()}
    if(s==='level'&&UI.lvFresh&&MODE!=='off'){UI.lvFresh=false;rollAnim()}
    if(s==='result'&&UI.res.anim&&UI.res.roll){UI.res.anim=false;UI.animing=true;resultAnim().then(()=>{UI.animing=false;if(G&&((G.ch.offers||[]).length||(G.ch.gearOffers||[]).length||G.ch.packOffer))render()})}
    if(s==='combat'&&FIGHT==='auto'&&!PLAYING&&C&&!C.over&&!UI.autoTimer&&!UI.paused&&!UI.cfg){const g=autoGap();
      UI.autoTimer=setTimeout(()=>{UI.autoTimer=null;if(FIGHT==='auto'&&UI.screen==='combat'&&!PLAYING&&!C.over&&!UI.paused&&!UI.cfg){UI.sel=E.autoPick(C);render();setTimeout(()=>{if(FIGHT==='auto'&&!PLAYING&&!C.over&&!UI.paused)ACT.go()},g[1])}},g[0])}
  }

  /* ===== 진행: 성장 굴림 → 대기 중인 전투 → 다음 해 ===== */
  /* 저장: 사건까지 함께 저장해서, 다시 열어도 같은 사건·같은 전투 상대가 나온다 */
  let lastSaveX=null;
  const saveGame=x=>{lastSaveX=x||{};store.set(SAVE,JSON.stringify(Object.assign({v:UPDATES.v,t:Date.now(),G},x||{})))};
  /* 가방에서 카드·장비를 옮긴 뒤 같은 지점으로 다시 저장한다 */
  const resave=()=>{if(G&&lastSaveX&&UI.screen!=='combat')saveGame(lastSaveX)};
  function nextYear(){
    const st=E.advanceYear(G);
    showYear(st,null);
  }
  /* 한 해의 시작 화면. stock이 있으면(불러오기) 공방 진열을 그대로 쓴다 */
  function showYear(st,stock,shopDone){
    UI.fight=null;UI.pending=null;UI.curSt=st;UI.oldEnd=false;
    /* 100살 히든 엔딩은 한 번 본 뒤로는 다시 뜨지 않는다 (이미 본 기록이 있으면 그냥 이어서 간다) */
    if(st.type==='end'&&st.old&&loadRec().endings.includes('old')){nextYear();return}
    if(st.type==='end'){UI.outEnd=st.out||null;UI.outerEnd=false;UI.endWin=st.win;UI.trueEnd=!!st.trueEnd;UI.oldEnd=!!st.old;UI.rbEnd=!!st.rb;UI.hwEnd=st.hw||null;UI.death=st.cause?{year:G.year,foe:st.cause==='mind'?'정신 붕괴':'뒤틀림',cause:st.cause}:null;recordEnd();UI.screen='end';render();return}
    UI.omen=null;UI.showIncome=G.year>1;
    if(st.type==='omen')UI.omen=st;
    else if(st.type==='fight'){UI.fight=st.enemy;UI.enc=st.enc}else UI.ev=st.ev;
    /* 공방 거리: 1년차부터 3년마다 들를지 묻는다. 들러도 해는 넘어가지 않는다 */
    if((G.year-1)%CFG.shop.every===0&&!shopDone&&!G.ch.rb){
      UI.stock=hwHome()?[]:stock||(G.year>=CFG.shop.blackFrom?E.sample(Object.keys(D.special),CFG.shop.blackStock):[]);
      UI.cardBox=UI.stock.length>0&&E.d(100)<=CFG.blackCard.chance;UI.aid=UI.stock.length>0&&E.d(100)<=CFG.blackAid.chance;UI.boxDone=null;
      UI.broker=E.officeBroker(G.ch);
      UI.bought=null;UI.deleted=null;UI.swapped=null;UI.tuneMsg=null;UI.sold=null;UI.rested=null;UI.healed=0;UI.healMsg=null;saveGame({st,stock:[],shopDone:true});UI.screen='shopask';render();return;
    }
    UI.stock=[];saveGame({st});UI.screen='event';render();
  }
  /* H사 홍원 가문 안에 사는 동안은 공방 거리 대신 홍원의 저잣거리 */
  const hwHome=()=>!!(G&&G.ch&&G.ch.hw&&!G.ch.hw.out&&!G.ch.hw.done);
  const HWSHOP=[['저잣거리 대장간','홍원 성문 안쪽 골목의 대장간이다. 가문 이름을 대면 값을 속이지 않는다.'],['홍원 장인방','가문에 칼을 대는 장인들이 모여 사는 방이다. 후보라는 이름이 문을 연다.'],['가문의 보물고','선대가 모아 둔 물건을 푸는 방이다. 가주의 허락 없이는 열리지 않는다.']];
  function vShopAsk(){
    const nb=(G.year-1)+CFG.shop.every+1,hh=hwHome();
    return `${vHud()}<div class="stack" style="gap:8px"><div class="eyebrow">${E.age(G)}세의 해 · ${hh?'홍원의 저잣거리':'공방 거리'}</div><h2>${hh?'홍원의 저잣거리를 지난다':'공방 거리를 지난다'}</h2>
      <p class="lead">${hh?'붉은 대문 안쪽에 가문의 저잣거리가 있다. 장인과 상인은 모두 가문의 이름 아래 있다. 들러도 한 해가 지나가지는 않는다.':'장비를 손볼 수 있는 거리다. 들러도 한 해가 지나가지는 않는다.'}${UI.stock.length?' 골목 안쪽에 이번에만 열린 암시장 문도 보인다. 다음에 들를 때는 물건이 바뀐다.':''}</p>
      <p class="small dim">다음 기회는 ${Math.min(nb,CFG.years)}년차.</p>
      ${UI.broker?`<div class="check" style="border-color:var(--gold)"><b>${esc(G.ch.office.name)}</b> · 일감을 알선했다 · ${UI.broker.kind==='gear'?'의수 ':'카드 '}<b>${esc(UI.broker.n)}</b>${UI.broker.locked?' (덱 고정이라 돈으로 받았다)':''}</div>`:''}</div>
      ${UI.rested?`<p class="good small">${UI.rested}</p>`:''}
      <div class="stack">${UI.rested?'':'<button class="btn primary" data-a="shop">들른다</button>'}
        ${UI.rested?'':`<button class="btn" data-a="rest"><b>쉬어 간다</b><span class="mono small dim">공방은 이용하지 않는다 · 정신력 +${CFG.shop.restMind} (지금 ${G.ch.mind}/${E.mindMax(G.ch)})</span></button>`}
        <button class="btn" data-a="unshop">${UI.rested?'다시 길을 나선다':'지나간다'}</button></div>`;
  }
  function vOmen(){
    const o=UI.omen,m=o.omen;
    const go=`<button class="btn" data-a="omen" data-i="1"><b>${m.go||'이 길로 간다'}</b><span class="mono small dim">${T.hiddenBoss} · 매우 위험</span></button>`;
    const away=o.escape?`<button class="btn" data-a="omen" data-i="0"><b>${m.away||'돌아선다'}</b><span class="mono small dim">평소처럼 조우한다</span></button>`:'';
    return `${vHud()}<div class="stack" style="gap:8px"><div class="eyebrow">${yearTag()}${E.age(G)}세의 해 · 불길한 예감</div><h2>무언가 다가온다</h2><p class="lead">${m.x||'무언가 안 좋은 예감이 든다.'}</p></div>
      <div class="stack">${go}${away}</div>`;
  }
  function flow(){
    const ch=G.ch;
    if(ch.lvPend>0){if(!ch.lvOpts){ch.lvOpts=E.rollGrowth(ch);UI.lvFresh=true}UI.screen='level';render();return}
    if(UI.pending){const id=UI.pending;UI.pending=null;startCombat(id);return}
    nextYear();
  }
  /* 엔딩 기록: 죽으면 저장을 지운다 (완주는 무한런을 위해 남긴다) */
  function recordEnd(){
    syncTitles();
    const r=loadRec(),c=G.ch,w=UI.endWin,dt=UI.death,lived=w?G.year:Math.max(0,G.year-1);
    const fe=blankEnd(c,w),k=(fe&&fe!=='wed')?fe:(w&&c.distForm?'distwin':w&&UI.outEnd?'out_'+UI.outEnd:w&&UI.outerEnd?'outer':w&&UI.oldEnd?'old':w&&UI.trueEnd?'true':w?'win':dt&&dt.hunt&&c.distForm?'lovekill':dt&&(dt.cause==='distort'||c.distForm)?'distort':dt&&dt.cause==='mind'?'mind':dt&&dt.id==='hongru'?'hwlose':'death');
    if(!r.endings.includes(k))r.endings.push(k);if(fe==='wed'&&!r.endings.includes('wed'))r.endings.push('wed');r.runs++;if(w&&c.hard)r.hardClear=(r.hardClear||0)+1;if(w&&c.easy)r.easyClear=(r.easyClear||0)+1;
    r.best.years=Math.max(r.best.years,lived);r.best.lv=Math.max(r.best.lv,c.lv);if(G.endless)r.best.grade=Math.max(r.best.grade,E.gradeAt(G.year));
    if(dt&&dt.id==='godmother'){r.titles=r.titles||{};r.titles['정해진 운명']=(r.titles['정해진 운명']||0)+1}
    store.set(REC,JSON.stringify(r));if(!w)store.del(SAVE);
  }
  function startCombat(id){recAdd('seen',id);C=E.mkCombat(G.ch,id);UI.sel=[];PLAYING=false;UI.paused=false;UI.screen='combat';render()}

  const ACT={
    lrelic(k){if(!E.relicChoices(G.ch).includes(k))return;E.giveRelic(G.ch,k,true);UI.res.chips=[...UI.res.chips,'유물 · '+D.relics[k].n];render()},
    offkw(k){UI.offName=(($('offname')||{}).value||UI.offName||'');UI.offKw=k;render()},
    offset(){
      const n=(($('offname')||{}).value||'').trim(),err=E.officeNameErr(n);
      if(err){UI.offErr=err;UI.offName=n;render();return}
      const kw=UI.offKw||'bleed';E.setOffice(G.ch,n,kw);UI.offErr='';UI.offName='';UI.offKw=null;resave();
      UI.res.chips=[...UI.res.chips,`내 사무소 · ${G.ch.office.name} (${E.OKW[kw]})`];render();
    },
    pill(k){
      const P=Object.values(D.enemies).find(e=>e.pill).pill;
      if(E.setPill(G.ch,k,P.v)){resave();UI.res.chips=[...UI.res.chips,`${P.n} · ${E.pillStats[k]} +${P.v}`];render()}
    },
    nameset(){
      const n=(($('nameval')||{}).value||'').trim(),err=E.renameForm(G.ch,n);
      if(err){UI.nameErr=err;UI.nameVal=n;render();return}
      UI.nameErr='';UI.nameVal='';resave();if(UI.res)UI.res.chips=[...(UI.res.chips||[]),`이름 · ${n}`];render();
    },
    singtype(k){UI.singName=(($('singname')||{}).value||UI.singName||'');UI.singType=k;render()},
    singset(){
      const n=(($('singname')||{}).value||'').trim(),err=E.singNameErr(n),ty=UI.singType||'warp';
      if(err){UI.singErr=err;UI.singName=n;render();return}
      E.setSing(G.ch,ty,n);UI.singErr='';UI.singName='';UI.singType=null;resave();
      UI.res.chips=[...UI.res.chips,`특이점 · ${n} (${CFG.corp.types[ty].n})`,...E.singChips(G.ch)];render();
    },
    kidset(){
      const n=(($('kidname')||{}).value||'').trim(),err=E.kidNameErr(G.ch,n);
      if(err){UI.kidErr=err;UI.kidName=n;render();return}
      const k=(G.ch.bond.kids||[]).find(x=>x.pend),nm=n||(k&&k.n)||'';E.setKidName(G.ch,n);UI.kidErr='';UI.kidName='';resave();
      UI.res.chips=[...UI.res.chips,`아이 · ${nm}`];render();
    },
    bondset(){
      const n=(($('bondname')||{}).value||'').trim(),err=E.bondNameErr(n);
      if(err){UI.bondErr=err;UI.bondName=n;render();return}
      E.setBondName(G.ch,n);UI.bondErr='';UI.bondName='';resave();
      UI.res.chips=[...UI.res.chips,`인연 · ${n}`];render();
    },
    orgset(i){
      const chips=E.chooseOrg(G.ch,i);if(!chips)return;
      syncAffs();resave();UI.res.chips=[...UI.res.chips,...chips];render();
    },
    fingerset(i){
      const chips=E.chooseFinger(G.ch,i);if(!chips)return;
      syncAffs();resave();UI.res.chips=[...UI.res.chips,...chips];render();
    },
    seongset(){
      const n=(($('seongname')||{}).value||'').trim(),err=E.nameErr(n);
      if(err){UI.seongErr=err;UI.seongName=n;render();return}
      const it=E.setSeongdo(G.ch,n);UI.seongErr='';UI.seongName='';resave();
      UI.res.chips=[...UI.res.chips,`성도 · ${it.n}  획득 · ${it.e}`];render();
    },
    wingset(){
      const n=(($('wingname')||{}).value||'').trim(),err=E.wingNameErr(n);
      if(err){UI.wingErr=err;UI.wingName=n;render();return}
      E.setWing(G.ch,n);UI.wingErr='';UI.wingName='';resave();
      UI.res.chips=[...UI.res.chips,`날개 설립 · ${G.ch.corp.wing} 대표가 되었다`];render();
    },
    egotype(k){UI.egoName=(($('egoname')||{}).value||UI.egoName||'');UI.egoType=k;render()},
    distset(){
      const n=(($('distname')||{}).value||'').trim(),err=E.egoNameErr(n);
      if(err){UI.distErr=err;UI.distName=n;render();return}
      E.setDistort(G.ch,n);UI.distErr='';UI.distName='';UI.res.chips=[...UI.res.chips,`육신 뒤틀림 · ${n}`];render();
    },
    egoset(){
      const n=(($('egoname')||{}).value||'').trim(),err=E.egoNameErr(n);
      if(err){UI.egoErr=err;UI.egoName=n;render();return}
      const ty=UI.egoType||'atk';E.setEgo(G.ch,ty,n);UI.egoErr='';UI.egoName='';UI.egoType=null;
      UI.res.chips=[...UI.res.chips,`E.G.O · ${n} (${CFG.mind.ego[ty].n})`];render();
    },
    sell(i){const g=(G.ch.stash||[])[+i];if(!g)return;const v=E.sellStash(G.ch,+i);if(v){UI.sold=`${g.n}을(를) ${E.money(v)}에 팔았다.`;render()}},
    swapcard(i){if((UI.swapped||[]).length>=CFG.shop.swapMax)return;const r=E.swapCard(G.ch,+i);if(r){(UI.swapped=UI.swapped||[]).push([D.cards[r.old].n,D.cards[r.nid].n]);render()}},
    tune(k,el){const r=E.tuneGear(G.ch,k,el&&el.dataset?el.dataset.s:null);if(r){UI.tuneMsg={ok:r.ok,t:`${r.n} · ${r.stat==='atk'?'공격':'회피'} +1 ${r.ok?'성공':'실패'} (${r.tries}/${E.tuneMax(G.ch)})`};render()}},
    delcard(i){if((UI.deleted||[]).length>=CFG.shop.delMax)return;const c=E.delCard(G.ch,+i);if(c){(UI.deleted=UI.deleted||[]).push(D.cards[c].n);render()}},
    tname(){
      const ch=G.ch,adj=D.colors[ch.ci].adj,w=(($('tw')||{}).value||'').trim();
      {const e=E.nameErr(w,{min:2});if(e){UI.twErr=e;render();return}}
      const old=ch.title;ch.title=adj+' '+w;ch.titlePick=false;UI.twErr='';
      UI.res.chips=UI.res.chips.map(x=>x===T.titleLabel+' · '+old?T.titleLabel+' · '+ch.title:x);render();
    },
    title(){UI.confirmNew=null;if(UI.shared){UI.shared=null;try{history.replaceState(null,'',location.pathname+location.search)}catch(e){}}UI.screen='title';render()},
    mode(i){MODE=i;store.set('cityYearMode',i);render()},
    fightmode(i){FIGHT=i;store.set('cityYearFight',i);UI.paused=false;render()},
    pause(){UI.paused=!UI.paused;if(UI.paused&&UI.autoTimer){clearTimeout(UI.autoTimer);UI.autoTimer=null}render()},
    autogap(i){AUTOGAP=i;store.set('cityYearAutoGap',i);if(UI.autoTimer){clearTimeout(UI.autoTimer);UI.autoTimer=null}render()},
    dice(i){DICE=i;store.set('cityYearDice',i);render()},
    bgm(i){BGM.set(i==='on');bgmSave();render()},
    bgmstep(i){const p=Math.round(BGM.vol()*100),n=+i>0?Math.floor(p/10)*10+10:Math.ceil(p/10)*10-10;BGM.setVol(clamp(n,0,100)/100);bgmSave();render()},
    skin(i){SKIN=i;BGM.setMood(i);store.set('cityYearSkin',i);document.documentElement.dataset.skin=i;render()},
    endless(){G.endless=true;E.enterAct2(G.ch);UI.shareText=UI.shareMsg=UI.imgUrl=null;flow()},
    outerend(){if(!G||!G.infinite)return;UI.outEnd=null;if(typeof confirm==='function'&&!confirm('외곽에서 이야기를 끝낼까? 이 판은 여기까지가 기록이 된다.'))return;UI.outerEnd=true;UI.endWin=true;UI.trueEnd=true;UI.oldEnd=false;UI.death=null;recordEnd();UI.screen='end';render()},
    oldgo(){UI.oldEnd=false;UI.outEnd=null;UI.shareText=UI.shareMsg=UI.imgUrl=null;nextYear()},
    infinite(){G.infinite=true;G.endless=true;E.enterAct2(G.ch);G.ch.infinite=true;G.ch.infImp=1;UI.shareText=UI.shareMsg=UI.imgUrl=null;flow()},
    async saveimg(){
      UI.imgUrl=null;const cv=await shotEnd()||await endCard(),name=`도시의한해_${G.ch.seed}.png`;
      const blob=await new Promise(r=>cv.toBlob(r,'image/png'));
      try{const f=new File([blob],name,{type:'image/png'});if(navigator.canShare&&navigator.canShare({files:[f]})){await navigator.share({files:[f]});return}}catch(e){if(e&&e.name==='AbortError')return}
      try{const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),4000)}catch(e){}
      /* 다운로드가 막히는 환경(미리보기 창 등)을 위해 이미지도 화면에 보여 준다 */
      if(window.self!==window.top){UI.imgUrl=cv.toDataURL('image/png');render()}
    },
    testCard:async()=>(await endCard()).toDataURL('image/png'),
    async share(){
      const url=shareLink();UI.shareText=null;UI.shareMsg=null;
      try{if(navigator.share){await navigator.share({title:'도시의 한 해 · 내 기록',text:shareHead(),url});UI.shareMsg='공유 창을 열었다.';render();return}}catch(e){if(e&&e.name==='AbortError')return}
      try{await navigator.clipboard.writeText(url);UI.shareMsg='기록 링크를 복사했다. 붙여 넣기만 하면 된다.';render();return}catch(e){}
      UI.shareText=url;render();const b=$('shareBox');
      if(b){b.focus();b.select();try{if(document.execCommand('copy')){UI.shareMsg='기록 링크를 복사했다. 붙여 넣기만 하면 된다.';UI.shareText=null;render();return}}catch(e){}}
      UI.shareMsg='이 화면에서는 자동 복사가 막혀 있다. 아래 링크를 눌러 복사한다.';render();const b2=$('shareBox');if(b2)b2.select();
    },
    sharedSeed(){const r=UI.shared;history.replaceState&&history.replaceState(null,'',location.pathname+location.search);UI.shared=null;UI.job=null;born(+r.s,'');UI.screen='birth';render()},
    xport(){UI.xcode=xEncode();UI.xmsg=null;UI.xopen=true;render()},
    xcopy(){const t=UI.xcode;if(!t)return;const ok=()=>{UI.xmsg=[true,'코드를 복사했다. 다른 기기의 "불러오기"에 붙여 넣는다.'];UI.xopen=true;render()};
      try{navigator.clipboard.writeText(t).then(ok,()=>{const a=$('xcode');if(a){a.select();document.execCommand('copy')}ok()})}catch(e){const a=$('xcode');if(a){a.select();try{document.execCommand('copy')}catch(_){}}ok()}},
    xfile(){const t=UI.xcode;if(!t)return;try{const b=new Blob([t],{type:'text/plain'}),u=URL.createObjectURL(b),a=document.createElement('a');a.href=u;a.download='도시의한해_세이브.txt';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),2000)}catch(e){}},
    ximport(){const a=$('xin');xApply((a&&a.value.trim())||UI.xask||'')},
    diff(i){if(['easy','normal','hard'].includes(i)){store.set(DIFFK,i);render()}},
    start(){if(UI.screen==='title'&&loadSave()&&UI.confirmNew!=='start'){UI.confirmNew='start';render();return}if(UI.screen==='title')store.del(SAVE);UI.confirmNew=null;UI.shareText=UI.shareMsg=UI.imgUrl=null;UI.daily=null;if(expired()){UI.screen='title';render();return}born(newSeed(),BC&&BC.name);UI.endText=null;UI.screen='birth';render()},
    cont(){const o=loadSave();if(!o)return;G=o.G;C=null;UI.shareText=UI.shareMsg=UI.imgUrl=null;UI.endText=null;UI.confirmNew=null;
      if(o.st)showYear(o.st,o.stock,o.shopDone);else if(o.after){UI.pending=o.pending||null;flow()}else nextYear()},
    records(){UI.screen='records';render()},
    daily(){if(loadSave()&&UI.confirmNew!=='daily'){UI.confirmNew='daily';render();return}store.del(SAVE);UI.confirmNew=null;if(expired()){UI.screen='title';render();return}UI.shareText=UI.shareMsg=UI.imgUrl=null;UI.daily=todayKey();born(dailySeed(UI.daily),'',true);UI.endText=null;UI.screen='birth';render()},
    blank(){if(!BC||BC.blank||UI.job)return;const nm=BC.name,sd=BC.seed;BC=E.newChar(null,null,{r:BC.r,kid:BC.kid});BC.seed=sd;BC.name=nm;BC.fresh=false;UI.relic=null;BC.fateChoices=E.blankFate();render()},
    nofate(){if(!BC||!BC.fateChoices||BC.fated)return;BC.fateChoices=null;render()},
    fate(i){const roll=+i;if(!BC||!BC.fateChoices||!BC.fateChoices.includes(roll))return;const nm=BC.name,sd=BC.seed,r=BC.r,kid=BC.kid;BC=E.newChar(null,null,{r,kid,fate:roll});BC.seed=sd;BC.name=nm;BC.fresh=false;UI.relic=null;render()},
    reroll(){UI.relic=null;UI.daily=null;if(UI.jobAuto){UI.job=null;UI.jobAuto=false}born(newSeed(),BC&&BC.name);render()},
    seed(){UI.relic=null;UI.daily=null;if(UI.jobAuto){UI.job=null;UI.jobAuto=false}const v=parseInt(($('seedIn')||{}).value,10);if(!(v>=0)){const i=$('seedIn');if(i){i.value='';i.placeholder='숫자만 넣을 수 있다'}return}born(v,BC&&BC.name);render()},
    color(i){E.setColor(BC,+i);BC.fresh=false;render()},
    relic(k){UI.relic=k;render()},
    job(k){UI.job=k||null;UI.jobAuto=false;UI.relic=null;born(BC.seed,BC.name);render()},
    jobroll(k){if(k){UI.jobBase=BC.o.n;UI.job=k;UI.jobAuto=true}else{UI.job=null;UI.jobAuto=false}UI.relic=null;born(BC.seed,BC.name);render()},
    live(){if(BC&&BC.fateChoices&&!BC.fated)return;if(UI.daily&&BC.seed===dailySeed(UI.daily))BC.daily=UI.daily;if(BC.innate)recAdd('innate',BC.innate);if(BC.relicPick){if(!UI.relic)return;E.giveRelic(BC,UI.relic);UI.relic=null}if(isHard())BC.hard=true;else delete BC.hard;if(isEasy())BC.easy=true;else delete BC.easy;if(DICE!=='fixed')E.reseed(newSeed());G=E.newGame(BC);nextYear()},
    flow(){flow()},
    fight(){UI.pending=UI.fight;UI.fight=null;flow()},
    shop(){UI.showIncome=false;UI.screen='shop';render()},
    /* 6시즌: 공방 거리에서 쉬어 가기 (공방 거래 없이 정신력 회복) */
    rest(){if(UI.rested)return;if(G.ch.restYear===G.year){UI.rested='이번 해에는 이미 쉬었다 · 정신력은 해마다 한 번만 회복한다';render();return}G.ch.restYear=G.year;const g=E.gainMind(G.ch,CFG.shop.restMind);UI.rested=g?`잠시 쉬었다 · 정신력 +${g} (${G.ch.mind}/${E.mindMax(G.ch)})`:'잠시 쉬었다 · 정신력이 이미 가득하다';UI.showIncome=false;resave();render()},
    buy(id){UI.buyAsk=id;render()},
    buyok(id){UI.buyAsk=null;if(E.buy(G.ch,id,true)){UI.bought=D.items[id].n}render()},
    buyno(){UI.buyAsk=null;render()},
    eqs(i){if(UI.screen!=='combat'&&E.equipStash(G.ch,+i)){resave();render()}},
    bspecial(id){if(E.buySpecial(G.ch,id,true)){UI.bought=D.special[id].n;render()}},
    noticeok(){store.set('cityYearNotice',NOTICE.id);render()},
    titleeq(i){const L=titleList(G.ch),t=L[+i];if(!t)return;G.ch.equipTitle=G.ch.equipTitle===t[0]?'':t[0];resave();render()},
    bag(k){UI.bag=k;UI.dropAsk=null;UI.bonAsk=null;render()},
    bonup(i){i=+i;if(UI.bonAsk!==i){UI.bonAsk=i;render();return}UI.bonAsk=null;if(E.bonUpgrade(G.ch,i)){resave();render()}},
    bagclose(){if(UI.cfg){UI.cfg=false;render();return}UI.bag=null;UI.dropAsk=null;render()},
    cfg(){UI.cfg=true;if(UI.autoTimer){clearTimeout(UI.autoTimer);UI.autoTimer=null}render()},
    cfgclose(){UI.cfg=false;render()},
    packyes(){if(!UI.packAsk){UI.packAsk=true;render();return}UI.packAsk=false;const n=G.ch.packOffer.n;if(E.acceptPack(G.ch)){UI.res.chips=[...UI.res.chips,`${n} · 덱이 바뀌고 고정되었다`];resave();render()}},
    packno(){UI.packAsk=false;const n=G.ch.packOffer.n;if(E.declinePack(G.ch)){UI.res.chips=[...UI.res.chips,`${n} · 지금 덱을 지켰다`];resave();render()}},
    gwear(){E.resolveGear(G.ch,0,true);resave();render()},
    gkeep(){E.resolveGear(G.ch,0,false);resave();render()},
    otake(to){if(E.takeOffer(G.ch,0,to)){UI.swap=false;resave();render()}},
    oswapmode(){UI.swap=!UI.swap;render()},
    oswap(j){if(E.takeOffer(G.ch,0,'swap',j)){UI.swap=false;resave();render()}},
    odrop(){if(E.dropOffer(G.ch,0)){UI.swap=false;resave();render()}},
    dout(i){UI.dropAsk=null;if(E.deckOut(G.ch,+i)){resave();render()}},
    din(i){UI.dropAsk=null;if(E.deckIn(G.ch,+i)){resave();render()}},
    sdrop(i){i=+i;if(UI.dropAsk!==i){UI.dropAsk=i;render();return}UI.dropAsk=null;if(E.sideDrop(G.ch,i)){resave();render()}},
    cfk(k){(UI.cf=UI.cf||{}).k=k;render()},
    cfw(k){const f=UI.cf=UI.cf||{};f.kw=f.kw===k?null:k;render()},
    aid(id){if(E.buyAid(G.ch,id))render()},
    heal(){if((UI.healed||0)>=CFG.clinic.max)return;const h=E.buyHeal(G.ch);if(h){UI.healed=(UI.healed||0)+1;UI.healMsg=`HP +${h}`;resave();render()}},
    ample(){if(E.buyAmple(G.ch)){resave();render()}},
    box(t){if(UI.boxDone)return;const c=E.cardBox(G.ch,t);if(c){UI.boxDone=`상자에서 ${D.cards[c].n}이(가) 나왔다.`;render()}},
    unshop(){UI.buyAsk=null;saveGame({st:UI.curSt,stock:[],shopDone:true});UI.screen='event';render()},
    omen(i){
      const st=E.answerOmen(G,UI.omen,i==='1');saveGame({st,stock:[],shopDone:true});
      const m=UI.omen.omen;UI.omen=null;UI.fight=st.enemy;UI.enc=st.enc;UI.avoidText=st.avoided?m.awayT:null;render();
    },
    choose(i){
      const r=E.choose(G,UI.ev,+i);syncTitles();
      UI.pending=r.combat;saveGame({after:true,pending:UI.pending});
      UI.res=Object.assign(r,{anim:!!r.roll&&MODE!=='off'});
      UI.screen='result';render();
    },
    grow(i){const ch=G.ch;E.applyGrowth(ch,ch.lvOpts[+i].g.fx);ch.lvPend--;ch.lvOpts=null;flow()},
    pick(i){i=+i;const at=UI.sel.indexOf(i);if(at>=0){UI.sel.splice(at,1);
        /* 빛 회복 카드를 빼서 빛이 모자라면 뒤에 고른 카드부터 뺀다 */
        const H=C.P.hand,net=()=>UI.sel.reduce((a,j)=>a+D.cards[H[j]].c-(D.cards[H[j]].gain||0),0);while(UI.sel.length&&net()>C.P.light)UI.sel.pop()}
      else UI.sel.push(i);render()},
    go(){
      const pp=UI.sel.map(i=>D.cards[C.P.hand[i]]);
      const lb=C.log.length;PRE=E.snap(C);UI.lastPP=pp;
      E.resolveRound(C,pp,C.ePlan);UI.sel=[];
      if(C.over==='lose')store.del(SAVE);
      if(MODE==='off'){if(!C.over)E.newRound(C);render();return}
      C.logBefore=lb;PLAYING=true;render();if(isMobile())window.scrollTo(0,0);runPlayback(C.evs);
    },
    tri(k){if(E.setTri(C,k))render()},
    skip(){SKIP=true;if(wake)wake();if(tapWake)tapWake()},
    tap(){if(tapWake)tapWake()},
    fin(){
      if(C.over==='lose'){UI.outEnd=null;UI.outerEnd=false;UI.endWin=false;UI.trueEnd=false;UI.death=G.ch.mindDead?{year:G.year,foe:'정신 붕괴',cause:'mind'}:{year:G.year,id:C.id,foe:D.enemies[C.id].n,hidden:!!D.enemies[C.id].hidden,hunt:C.id==='kid_hunt'?G.ch.kidFoe:null};recordEnd();UI.screen='end';render();return}
      const r=E.winRewards(G,C);syncTitles();recAdd('beaten',C.id);saveGame({after:true,pending:null});
      if(r.unlock)addUnlock(r.unlock);
      if(r.endText)UI.endText=r.endText;
      UI.res={t:`${r.hidden?r.endText:C.E.name+'의 잔해 속에서 쓸 만한 것을 주웠다.'}${r.newly?' 소문이 돌아 이름이 '+T.licensed+' 명부에 올랐다.':''}${r.colorRoll?(r.colorRoll.ok?' 도시가 당신의 색을 기억하기 시작했다.':' 아직 도시는 당신의 색을 부르지 않는다.'):''}`,chips:r.chips,roll:r.colorRoll,anim:!!r.colorRoll&&MODE!=='off',title:r.title,tlabel:r.tlabel};
      UI.screen='result';render();
    },
    sim(){SIM=E.simulate(200);UI.screen='sim';render()}
  };
  /* 시드: 브라우저 암호 난수로 새로 뽑는다. 같은 시드면 같은 출생과 같은 굴림 */
  /* 자동 전투 간격: [카드 고르기 전, 행동 개시 전] ms */
  const autoGap=()=>AUTOGAP==='slow'?[1600,1100]:AUTOGAP==='fast'?[150,150]:AUTOGAP==='mid'?[600,500]:[1000,800];
  function newSeed(){try{return crypto.getRandomValues(new Uint32Array(1))[0]%1000000000}catch(e){return Math.floor(Math.random()*1e9)}}
  function born(seed,name,daily){const dly=daily||(UI.daily&&seed===dailySeed(UI.daily));E.reseed(seed);const pl=dly&&UI.daily&&CFG.dailyPlan[UI.daily];BC=E.newChar(UI.job&&loadUnlocks().includes(UI.job)?UI.job:null,dly?(pl&&pl.origin)||CFG.dailyOrigin:null);if(pl&&pl.innate&&D.innate[pl.innate])BC.innate=pl.innate;BC.seed=seed;BC.name=name||'';BC.fresh=true}
  /* 화면 폭이 휴대폰/PC 경계를 넘으면 전투 화면을 다시 그린다 (재생 중에는 그대로) */
  window.addEventListener('resize',()=>{if(UI.screen==='combat'&&!PLAYING&&UI.wasMobile!==isMobile())render()});
  app.addEventListener('toggle',e=>{const t=e.target;if(!t.classList)return;
    if(t.classList.contains('logbox')&&t.querySelector('#log'))UI.logOpen=t.open;
    if(t.classList.contains('roundbox'))UI.roundOpen=t.open;
    if(t.classList.contains('inv'))UI.invOpen=t.open;
    if(t.classList.contains('bhelp'))UI.helpOpen=t.open},true);
  /* 휴대폰 키보드의 이동·완료(Enter)로도 시드 적용 */
  app.addEventListener('change',e=>{if(e.target.id!=='xfileIn')return;const f=e.target.files&&e.target.files[0];if(!f)return;const r=new FileReader();r.onload=()=>{UI.xask=null;xApply(String(r.result||''))};r.readAsText(f)});
  app.addEventListener('input',e=>{if(e.target.id!=='bgmRange')return;const v=Math.max(0,Math.min(100,+e.target.value||0));BGM.setVol(v/100);const l=document.getElementById('bgmPct');if(l)l.textContent=v+'%'});
  app.addEventListener('change',e=>{if(e.target.id==='bgmRange')bgmSave()});
  app.addEventListener('keydown',e=>{if(e.target.id==='seedIn'&&e.key==='Enter'){e.preventDefault();e.target.blur();ACT.seed()}});
  app.addEventListener('input',e=>{if(e.target.id==='nm'&&BC)BC.name=e.target.value.trim().slice(0,12);
    if(e.target.id==='cardq'){(UI.cf=UI.cf||{}).q=e.target.value.trim();const l=$('cardlist');if(l)l.innerHTML=cardListHtml()}});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&UI.bag){UI.bag=null;render()}});
  app.addEventListener('click',e=>{
    const b=e.target.closest('[data-a]');
    if(!b||b.disabled||PLAYING&&!['skip','tap','fightmode'].includes(b.dataset.a))return;
    ACT[b.dataset.a](b.dataset.i,b);
  });
  /* 공유된 기록 링크로 열었으면 그 기록부터 보여 준다 */
  try{const m=/#r=([\w-]+)/.exec(location.hash||'');if(m){const r=b64d(m[1]);if(r&&r.s!=null){UI.shared=r;UI.screen='shared'}}}catch(e){}
  render();
  /* 자동 테스트용 상태 조회 */
  return {state:()=>({screen:UI.screen,year:G&&G.year,endWin:UI.endWin,lv:G&&G.ch.lv,aff:G&&G.ch.aff}),
    /* 자동 테스트용: 진행 중인 게임에서 지정한 적과 바로 싸운다 (적 HP를 낮출 수 있다) */
    testCard:()=>ACT.testCard(),testBgm:()=>BGM.debug(),testBgmLevel:()=>BGM.level(),testBgmScene:k=>BGM.setScene(k),testBgmVol:v=>BGM.setVol(v),testTitles:a=>ACT.testTitles(a),
    testShareLink:()=>shareLink(),
    testDistort(){if(!G)return;UI.ev=D.mindEvents.distort;UI.fight=null;UI.omen=null;UI.screen='event';render()},
    testMind(n){if(!G)return;G.ch.mind=n+1;E.loseMind(G.ch,1);render()},
    testEgoPick(){if(!G)return;G.ch.egoPick=true;UI.res=UI.res||{chips:[],t:''};UI.res.chips=UI.res.chips||[];UI.screen='result';render()},
    testRouteEnd(k,act2){if(!G)return;G.endless=!!act2;G.year=G.ch.year=act2?66:CFG.years;UI.endWin=true;UI.trueEnd=false;UI.oldEnd=false;UI.rbEnd=k==='rcorp';UI.hwEnd=k==='rcorp'?null:(k||'hwhost');UI.death=null;UI.screen='end';render()},
    testWin(){if(!G)return;G.year=G.ch.year=CFG.years;UI.endWin=true;UI.trueEnd=false;UI.death=null;UI.screen='end';render()},
    testDeath(y,foe,hunt){if(!G)return;G.year=G.ch.year=y;UI.endWin=false;UI.trueEnd=false;UI.death={year:y,foe,hidden:false,hunt:hunt||null};UI.screen='end';render()},
    testOut(k){if(!G)return;G.infinite=true;G.year=G.ch.year=80;UI.endWin=true;UI.trueEnd=false;UI.oldEnd=false;UI.outerEnd=false;UI.outEnd=k;UI.death=null;UI.screen='end';render()},
    testTitles(a){if(G)G.ch.titles=a},
    async testCard(){if(!G)return null;const cv=await endCard();return cv.toDataURL('image/png')},
    testPatch(o){if(!G)return;Object.assign(G.ch,o);render()},
    testEnd(y,t,o){if(!G)return;G.year=G.ch.year=y||CFG.years;UI.endWin=true;UI.trueEnd=!!t;UI.oldEnd=!!o;UI.death=null;UI.screen='end';render()},
    testFight(id,hp,php){if(!G)return;startCombat(id);if(hp)C.E.hp=hp;if(php){C.P.hp=C.P.maxHp=php}render()},
    /* 자동 테스트용: 특색 심사 통과 직후 화면 */
    testColor(){if(!G)return;G.ch.licensed=true;G.ch.rank=1;const r=E.applyFx(G.ch,{colorPass:true});UI.res={t:'심사 통과',chips:r.chips,roll:null};UI.screen='result';render()},
    testBond(k,kids,dist){if(!G)return;const c=G.ch;c.aff=c.aff||{type:'office',name:'윤 사무소'};
      c.bond={st:k,route:c.aff.type==='office'?'office':c.aff.type,name:k==='pick'?'':'하나',step:2,tries:1,love:2,since:G.year,saved:false};if(k==='pick')c.bondPick=true;if(kids)c.bond.kids=[{n:'하늘',born:G.year-23,job:'assoc',told:true},{n:'이슬',born:G.year-4,job:'fixer',told:false}];if(dist)c.distForm={n:'이름 없는 뒤틀림'};UI.res={t:'인연 시험',chips:[]};UI.screen='result';render()},
    testPick(k,v){if(!G)return;G.ch[k]=k==='orgPick'?(v||'wing'):true;if(k==='singPick'){G.ch.corp=G.ch.corp||{st:'dev',stack:0}}if(k==='wingPick'){G.ch.corp=G.ch.corp||{st:'dev',stack:0,n:'ゼロ'}}if(k==='titlePick'){G.ch.licensed=true;G.ch.rank=5;G.ch.title=D.colors[G.ch.ci].adj+' 임시'}if(k==='officePick'){G.ch.licensed=true;G.ch.rank=5}UI.res={t:'이름 시험',chips:[]};UI.screen='result';render()},
    testMoney(n){if(G){G.ch.money=n;render()}},
    testShop(){if(!G)return;G.ch.money=5000;G.ch.hp=Math.floor(G.ch.stats.maxHp/2);UI.stock=Object.keys(D.special).slice(0,2);UI.cardBox=true;UI.aid=true;UI.swapped=null;UI.tuneMsg=null;UI.bought=null;UI.deleted=null;UI.sold=null;UI.rested=null;UI.broker=null;UI.screen='shop';render()},
    /* 6시즌 자동 테스트: 사무소 개설 화면, 사건 바로 보기, 사무소 알선 */
    testBirthRoll(n){if(!BC)return;E.reseed(BC.seed);let c;for(let i=0;i<20000;i++){c=E.newChar();if(c.r.o===n)break}c.seed=BC.seed;c.name=BC.name;BC=c;BC.fresh=false;render()},
    testRelic(k){if(!G)return;E.giveRelic(G.ch,k,true);UI.res={t:'유물',chips:[]};UI.screen='result';render()},
    testArt(n){if(!G)return;G.ch.artSense=n;render()},
    testAff(type,name){if(!G)return;G.ch.aff={type,name};const r=D.careers[type]&&D.careers[type].cards&&D.careers[type].cards[name];if(r){G.ch.deck=r.flat().concat(G.ch.deck.filter(id=>D.cards[id].fixed));G.ch.assocName=name;G.ch.cardMoney=true}render()},
    testStash(){if(!G)return;for(const id of ['club','sword','greatsword'])G.ch.stash.push(Object.assign({id},D.items[id]));G.ch.stash.push(Object.assign({id:'x',grade:5,slot:'aug',n:'시험용 유물',e:'',fx:{}}));render()},
    testOffice(){if(!G)return;G.ch.licensed=true;G.ch.rank=5;G.ch.officePick=true;UI.res={t:'사무소 개설',chips:[]};UI.screen='result';render()},
    testPill(){if(!G)return;G.ch.pillPick=true;UI.res={t:'붕대 사이에서 작은 환이 나왔다.',chips:['특수환 · 능력치 하나를 골라 +10 (영구)','전리품 · 붉은 붕대 (HP+20, 영구)']};UI.screen='result';render()},
    testBreak(){if(!G)return;G.ch.mind=1;startCombat('thug');E.loseMind(G.ch,99,()=>{});render()},
    testName(k){if(!G)return;G.ch.namePend=k;if(k==='ego'){G.ch.ego={type:'atk',n:''};G.ch.relics=[...(G.ch.relics||[]),'E.G.O · ']}else{G.ch.distForm={n:'이름 없는 뒤틀림'}}UI.res={t:'적의 잔해 속에서 쓸 만한 것을 주웠다.',chips:['전투 중 정신력 0 · '+(k==='ego'?'E.G.O 개화':'육신이 뒤틀렸다')+' · 이름을 정한다']};UI.screen='result';render()},
    testApoc(){if(!G)return;const g=Object.assign({grade:5},structuredClone(D.enemies.apocalypse.drop.gear));G.ch.gearOffers=[g];UI.res={t:'종말이 쓰러졌다.',chips:['종말의 예언 · 검은 숲 깊은 곳에서 무언가 눈을 뜬다']};UI.screen='result';render()},
    testChain(){if(!G)return;G.ch.aff={type:'wing',name:'K사 날개'};G.ch.year=G.year=45;G.ch.corp={st:'wing',type:'serum',n:'시험',stack:2,up:3,forb:2,wing:'새벽 날개',chain:['claw','arbiter'],next:99};UI.ev=D.corp.head;UI.fight=null;UI.omen=null;UI.screen='event';render()},
    testCorp(k){if(!G)return;G.ch.aff={type:'wing',name:'K사 날개'};G.ch.year=G.year=22;if(!G.ch.corp)G.ch.corp={st:'offer'};UI.ev=D.corp[k];UI.fight=null;UI.omen=null;UI.screen='event';render()},
    testEvent(k,lic){if(!G)return;G.ch.licensed=lic!==false;G.ch.rank=G.ch.rank||9;UI.ev=D[k];UI.fight=null;UI.omen=null;UI.screen='event';render()},
    testBroker(){if(!G)return;UI.stock=[];UI.broker=E.officeBroker(G.ch);UI.screen='shopask';render()},
    testOrigin(n){if(!BC)return;const o=D.origins.find(x=>x.n===n);if(!o)return;E.reseed(BC.seed);let c;for(let i=0;i<5000;i++){c=E.newChar();if(c.o.n===n)break}c.seed=BC.seed;c.name=BC.name;BC=c;render()},
    testOmen(id){if(!G)return;const h=D.hiddenBosses.find(x=>x.id===id);UI.omen={type:'omen',boss:id,omen:h.omen||{},escape:!h.noEscape,spec:'table:early'};UI.screen='event';render()}};
}
