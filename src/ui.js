/* 화면: 렌더와 연출만 맡는다. 규칙과 판정은 전부 엔진(E)에 묻는다. */
import {CFG} from './config.js';
import {clamp,sg,STAT} from './engine.js';
import {createBgm} from './bgm.js';
import {createSfx} from './sfx.js';

export function startUI(E,app){
  const D=E.D,T=D.text;
  const KWC={bleed:'var(--bleed)',rupture:'var(--rupture)',breath:'var(--breath)',burn:'#f0903c',flame:'#e0503c',nail:'#9aa0a6',harpoon:'#6fa3b8',wspear:'#3f7fb0',stagger:'#b07cc6',charge:'#e8d44d',sink:'#4a8fb0',ink:'#5a6ea0',obey:'#8a7fb8'};
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
  const REC='cityYearRecords',DAILYK='cityYearDaily';
  const VERSION='v10.3.2';
  const loadDaily=()=>{try{const o=JSON.parse(store.get(DAILYK)||'{}');return o&&typeof o==='object'?o:{}}catch(e){return{}}};
  const loadRec=()=>{let r=null;try{r=JSON.parse(store.get(REC)||'null')}catch(e){}return Object.assign({seen:[],beaten:[],endings:[],innate:[],unl:[],titles:{},affs:[],runs:0,best:{years:0,lv:0,grade:-1}},r||{})};
  /* 칭호 기록: 최고 등급에 오를 때마다 그 칭호의 횟수를 +1 (판이 바뀌어도 쌓인다) */
  /* 연인·히든 출생 기록: 연인은 만나본 적(1)·결혼까지 간 적(2), 히든 출생은 그 출생으로 시작한 적이 있는지를 남긴다 */
  /* 기록실 도감: 히든 보스 전리품·출신 전용 장비와 전용 카드팩. 이름을 직접 정하는 것(성도·개화/뒤틀림 이름)은 넣지 않는다 */
  const specCat=(()=>{let c=null;return()=>{if(c)return c;c={g:{},p:{}};const add=x=>{if(x&&x.id&&x.n&&x.id!=='star'&&!x.virt)c.g[x.id]=x.n};
    for(const e of Object.values(D.enemies)){const d=e.drop;if(!d)continue;add(d.gear);(d.gears||[]).forEach(add);if(d.packName&&d.cards)c.p[d.packName]=d.cards.length;if(e.thumbDrop)add(e.thumbDrop.gear)}
    for(const o of D.hiddenOrigins||[]){add(o.gear);(o.egoWeapons||[]).forEach(add)}
    for(const r of Object.values(D.relics||{}))add(r.gear);return c}})();
  const syncKin=()=>{const c=G&&G.ch;if(!c)return;const r=loadRec();let ch=false;
    {const cat=specCat();r.gears=r.gears||[];r.packs=r.packs||[];
      for(const it of [...Object.values(c.gear||{}),...(c.stash||[])])if(it&&it.id&&cat.g[it.id]&&!r.gears.includes(it.id)){r.gears.push(it.id);ch=true}
      for(const n of [c.packName,c.birthPack,...(c.packs||[]).map(p=>p&&p.n)])if(n&&cat.p[n]!=null&&!r.packs.includes(n)){r.packs.push(n);ch=true}}
    const b=c.bond;if(b&&b.route&&['met','married','lost','left'].includes(b.st)){const k=b.route+':'+(b.variant||0),lv=(b.st==='married'||b.st==='lost'||b.wed)?2:1;r.lovers=r.lovers||{};if((r.lovers[k]||0)<lv){r.lovers[k]=lv;ch=true}}
    if(c.o&&(D.hiddenOrigins||[]).some(x=>x.n===c.o.n)){r.births=r.births||[];if(!r.births.includes(c.o.n)){r.births.push(c.o.n);ch=true}}
    if(ch)store.set(REC,JSON.stringify(r))};
  const syncAffs=()=>{syncKin();const c=G&&G.ch;if(!c||!(c.affLog||[]).length)return;const r=loadRec();r.affs=r.affs||[];let ch=false;for(const n of c.affLog)if(!r.affs.includes(n)){r.affs.push(n);ch=true}if(ch)store.set(REC,JSON.stringify(r))};
  const syncTitles=()=>{syncAffs();const c=G&&G.ch;if(!c||!(c.titleLog||[]).length)return;const done=c.titleSeen||0;if(c.titleLog.length<=done)return;
    const r=loadRec();r.titles=r.titles||{};for(const n of c.titleLog.slice(done))r.titles[n]=(r.titles[n]||0)+1;c.titleSeen=c.titleLog.length;store.set(REC,JSON.stringify(r))};
  E.setInnateOpen(loadRec().unl||[]);
  /* 해금 조건이 있는 타고난 것: 전투가 끝날 때와 한 판이 끝날 때 조건을 살핀다. 새로 열리면 이름을 돌려준다 */
  function checkInnateUnlock(){
    if(!G||!G.ch)return [];const r=loadRec(),open=r.unl||[],now=E.innateUnlocks(G.ch,r.best.lv).filter(k=>!open.includes(k));
    if(!now.length)return [];r.unl=open.concat(now);store.set(REC,JSON.stringify(r));E.setInnateOpen(r.unl);return now.map(k=>D.innate[k].n);
  }
  const recAdd=(k,v)=>{const r=loadRec();if(!r[k].includes(v)){r[k].push(v);store.set(REC,JSON.stringify(r))}};
  let INFNOTE=store.get('cityYearInfNote')!=='off';let AUTOMELT=store.get('cityYearAutoMelt')==='on';
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
  const loadUnlocks=()=>{let u=[];try{u=JSON.parse(store.get('cityYearUnlocks')||'[]')}catch(e){u=[]}if(typeof UNLOCKTEST!=='undefined'&&UNLOCKTEST){const all=[...(D.unlockOrigins||[]).map(o=>'origin:'+o.key),...Object.keys(D.hiddenJobs||{})];u=[...new Set([...u,...all])]}
    /* 직업 해금(발톱·조율자)은 'claw'·'arbiter'로 저장돼 있으니 같은 해금 출생도 열린 것으로 읽는다 */
    for(const o of D.unlockOrigins||[])if(o.job&&u.includes(o.job)&&!u.includes('origin:'+o.key))u=[...u,'origin:'+o.key];
    return u};
  const addUnlock=k=>{const u=loadUnlocks();if(!u.includes(k)){u.push(k);store.set('cityYearUnlocks',JSON.stringify(u))}};
  if(!SKINS.some(s=>s.k===SKIN))SKIN='base';
  /* 배경음악: 기본은 꺼짐. 켜 둔 채 다시 열면 첫 터치 때 서서히 시작한다 (브라우저는 터치 전에 소리를 낼 수 없다) */
  const BGM=createBgm(),BGMK='cityYearBgm';
  /* 주사위 효과음: 배경음악과 따로 켜고 끈다 (기본 켬, 음량 70%). 연출 끔이거나 건너뛰는 중이면 내지 않는다 */
  const SFXK='cityYearSfx';
  const SFXS=(()=>{let o={};try{o=JSON.parse(store.get(SFXK)||'{}')||{}}catch(e){}return {on:o.on!==false,vol:typeof o.vol==='number'?Math.max(0,Math.min(1,o.vol)):0.7}})();
  const sfxSave=()=>store.set(SFXK,JSON.stringify(SFXS));
  const SFX=createSfx(()=>SFXS.on,()=>SFXS.vol);
  if(SFX.supported)['pointerdown','touchend','keydown'].forEach(t=>document.addEventListener(t,SFX.unlock,{passive:true}));
  const sfx=k=>{if(!SKIP)SFX.play(k)};
  const bgmSave=()=>store.set(BGMK,JSON.stringify({on:BGM.isOn(),vol:BGM.vol(),style:BGM.style()}));
  {let o={};try{o=JSON.parse(store.get(BGMK)||'{}')||{}}catch(e){}
    BGM.setVol(typeof o.vol==='number'?o.vol:0.3);BGM.setMood(SKIN);BGM.setStyle(o.style);
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
  /* 체력 위험 표시(깜빡임): 최대 체력이 50 미만이면 10% 미만, 그 이상이면 체력 20 이하 (체력이 아주 큰 상대는 10%에서 계속 깜빡이지 않게) */
  const isDanger=(hp,max)=>hp>0&&(max<50?hp<max*0.1:hp<=20);
  const PREV={};
  /* 타격 연출: 맞은 쪽 상자 위에 베기 선·파편이 튄다. 맞은 카드·무기가 새로 건 키워드(화상·출혈·파열 등)에 따라 색이 달라진다. 단계: off(끔)·low(가볍게)·mid(보통)·high(강하게) */
  /* 전체 화면: 브라우저 위아래 줄이 보이지 않게 (방송·PC용). 지원하지 않는 브라우저(아이폰 사파리 등)와 휴대폰 폭(700px 이하)에서는 버튼을 숨긴다 */
  const FS={ok:()=>!!(document.fullscreenEnabled||document.webkitFullscreenEnabled)&&!(window.matchMedia&&matchMedia('(max-width:700px)').matches),on:()=>!!(document.fullscreenElement||document.webkitFullscreenElement),
    toggle(){const d=document,el=d.documentElement;try{if(FS.on())(d.exitFullscreen||d.webkitExitFullscreen).call(d);else(el.requestFullscreen||el.webkitRequestFullscreen).call(el)}catch(e){}}};
  /* 전체 화면이 켜지거나 꺼져도 화면 전체를 다시 그리지 않고 버튼 글자만 바꾼다 (전투 연출 중에도 끊기지 않게). 설정 창이 열려 있으면 그 창만 갱신 */
  ['fullscreenchange','webkitfullscreenchange'].forEach(t=>document.addEventListener(t,()=>{const on=FS.on(),b=document.querySelector('.fsbtn');if(b){b.textContent=on?'창화면':'전체화면';b.setAttribute('aria-label',on?'전체 화면 끝내기':'전체 화면');b.title=b.getAttribute('aria-label')}if(UI&&UI.cfg&&typeof render==='function')render()}));
  /* 운영체제 공유 창은 휴대폰(터치 기기)에서만 연다. PC(특히 윈도)의 공유 창에는 로그인한 계정의 이메일 주소가 보여 방송에 노출될 수 있어서, PC에서는 파일을 바로 내려받게 한다 */
  const touchShare=()=>!!(window.matchMedia&&matchMedia('(pointer: coarse)').matches);
  const HFXK='cityYearHitFx';let HFX=store.get(HFXK)||'mid';
  const HFX_N={off:0,low:1,mid:2,high:3};let HFXFLIP=false;const HFXMK='cityYearHitFxM';let HFXM=store.get(HFXMK)||'each';
  /* 무기 이름으로 타격 모양을 고른다 (플레이어의 공격만. 맨손·기타는 키워드·무작위 모션) */
  const WMOT=[[/낫|발톱|손톱|팔$|부리|갈고리/,'claw'],[/십자가|쌍수|난무|대검/,'cross'],[/창|송곳|비수|권총|화살|작살|총$|탄/,'thrust'],[/망치|몽둥이|파이프|지휘봉|장갑|주먹|사슬|방패|책갈피/,'ring'],[/도$|검$|칼$|단도|장도|박도|언월도|톱$|검 |칼날/,'slash']];
  const WMOT2={궁니르:'thrust',레바테인:'slash',미미크리:'slash','다 카포':'ring',절대음감:'ring',금서:'ring',황혼:'slash',아라야시키:'slash',동부십검:'slash','붉은 눈':'ring','우주의 조각':'ring',후회:'ring',요정:'slash'};
  const weaponMotion=n=>{if(!n)return '';n=n.split(' · ')[0].replace(/\s*\(.*\)$/,'');if(WMOT2[n])return WMOT2[n];for(const [re,m] of WMOT)if(re.test(n))return m;return ''};
  /* 타격음 종류: 무기 모션으로 정한다 (베기·할퀴기=참격, 찌르기=관통, 고리=타격). 큰 피해는 뒤에 _h */
  function hitKind(e){
    const big=e.dmg>=(C[e.def].maxHp||100)*0.15,crit=/치명/.test(e.note||'');
    const edg=e.att!=='P'&&C&&D.enemies[C.id]&&D.enemies[C.id].drop&&D.enemies[C.id].drop.gear,ewn=(Array.isArray(edg)?edg:[edg]).filter(g=>g&&g.slot==='weapon').map(g=>g.n)[0]||'';
    const wn=e.att==='P'&&C&&C.ch&&C.ch.gear&&C.ch.gear.weapon?C.ch.gear.weapon.n:ewn,m=weaponMotion(wn);
    const k=m==='thrust'?'pierce':m==='ring'?'blunt':'slash';
    return k+(big||crit?'_h':'');
  }
  /* 히든 무기 전용 이펙트: 무기 id로 연결한다 (시험실 시안 = fxv). 없으면 기존 일반 모션 */
  const WFXM={w_whiteclaw:'n_claw',job_claw:'n_claw',w_baralclaw:'n_claw',w_mimicry:'n_mist',w_mimicry_p:'n_mist',w_sealfairy:'n_fairy_g',job_fairy:'n_fairy_g',w_zenafairy:'n_fairy_b',w_bookmark:'n_book',w_forbidden_book:'n_book',w_perfectpitch:'n_pitch',w_twilight:'n_twilight',cheontoe:'n_geom1',dongbu:'n_geom2',w_prescript:'n_finger',w_middlechain:'n_chain',w_ssangsu:'n_ssang',w_godfather:'n_gun',w_indigo:'n_gung',gungnir:'n_gung2',w_dacapo:'n_dacapo',w_ledgerblade:'n_grudge',w_baton:'n_baton',arayashiki:'n_araya',w_redlance:'n_lance',w_scarlet_cross:'n_cross',w_kas_needle:'n_needle',ego_beak:'n_beak',ego_redeyes:'n_redeye',ego_universe:'n_cosmos',ego_regret:'n_regret'};
  const VFORM={a:'n_vi_slash',d:'n_vi_guard',p:'n_vi_pierce',s:'n_vi_snake'},LAEV={laev_sealed:0,laev_s1:1,laev_s2:2,laev:3};
  /* 공방 무기가 흡수한 것의 수: 녹인 히든 + 흡수한 유물 (1 · 4 · 7 · 10개에서 이펙트가 한 단계씩 변한다) */
  const wsAbs=g=>((g&&g.wsH)||0)+Object.keys((C&&C.ch&&C.ch.wsRelic)||{}).length;
  function weaponFx(wid,e,isP,gw0){
    if(!wid)return (isP&&C&&C.ch&&C.ch.hwando)?'n_rune':'';
    if(WFXM[wid])return WFXM[wid];
    if(wid==='ws_weapon'){const h=Math.min(10,wsAbs(gw0));return 'n_ws'+(h<=0?0:h<=3?1:h<=6?2:h<=9?3:4)}
    if(wid in LAEV)return 'n_lev'+LAEV[wid];
    const w=/^w_d(blade|scythe|gaunt)([1-5])$/.exec(wid);if(w)return 'n_warp'+w[2];
    if(wid==='w_violet_dagger')return VFORM[(C&&C.P&&C.P.form)||'a']||'n_vi_slash';
    if(wid==='w_blacksilence'){if(e.card&&(e.card.id==='x_furioso'||/Furioso/i.test(e.card.n||'')))return 'n_bsF';const m=/장갑 1d9 (\d)/.exec(e.note||'');return m?'n_bs'+m[1]:'n_bs0'}
    return '';
  }
  function hitFx(e){
    const lv=HFX_N[HFX]||0;if(!lv||MODE==='off'||SKIP||(window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches))return;
    const box=$('ent-'+e.def);if(!box)return;
    let col='#cfe6ff',best=0;const sn=e.snap&&e.snap[e.def],pv=PREV[e.def];
    if(sn&&pv)for(const k of Object.keys(D.keywords)){const dl=(sn[k]||0)-(pv[k]||0);if(dl>best){best=dl;col=kwc(k)}}
    const crit=/치명/.test(e.note||'');const edg0=e.att!=='P'&&C&&D.enemies[C.id]&&D.enemies[C.id].drop&&D.enemies[C.id].drop.gear,hid=!!e.fxv||!!(e.att==='P'&&C&&C.ch&&C.ch.gear&&C.ch.gear.weapon&&C.ch.gear.weapon.id==='ws_weapon'&&wsAbs(C.ch.gear.weapon)>=7)||/^(w_|laev|gungnir|job_claw|cheontoe|dongbu|arayashiki|ego_)/.test(e.att==='P'?((C&&C.ch&&C.ch.gear&&C.ch.gear.weapon&&C.ch.gear.weapon.id)||''):((Array.isArray(edg0)?edg0:[edg0]).filter(g=>g&&g.slot==='weapon').map(g=>g.id)[0]||''));if(crit&&!hid)col='#ffd35a';
    const big=crit||!!e.fxv||e.dmg>=(C[e.def].maxHp||100)*0.15;
    /* '마지막만 크게': 타수 3 이상인 카드는 앞의 타격은 작은 파편만, 마지막 타격에 베기와 큰 효과가 몰린다 */
    const multi=HFXM==='last'&&e._g&&e._g.n>=3,lastHit=!multi||e._g.i===e._g.n-1,bigFx=big||(multi&&lastHit);
    let n=multi&&!lastHit?3:lv===1?0:lv===2?(bigFx?10:6):(bigFx?18:12);
    /* 방향: 공격한 쪽에서 맞은 쪽으로 베어 들어온다 (플레이어가 오른쪽 · 적이 왼쪽). 연달아 맞을 때는 위·아래로 번갈아 긋는다 */
    HFXFLIP=!HFXFLIP;const fromRight=e.att==='P',pose=['/','\\','|'][Math.floor(Math.random()*3)],RD=Math.random(),rot=pose==='/'?-(24+RD*14):pose==='\\'?(24+RD*14):(HFXFLIP?1:-1)*(66+RD*10);
    const org=`${fromRight?'right':'left'} center`,sl0=(r,top,ex='')=>`<svg class="blade" viewBox="0 0 100 24" preserveAspectRatio="none" style="--c:${col};--rot:${Math.max(-82,Math.min(82,r))}deg;--w:${pose==='|'?44:84}%;--wm:${pose==='|'?120:210}px;--org:${org};--a0:inset(0 ${fromRight?'0 0 100%':'100% 0 0'});--top:${top}%;${ex}"><path class="bd" d="M0 18 Q44 -4 100 8 Q50 20 0 18Z"/><path class="bc" d="M6 17 Q46 9 94 8.5"/></svg>`,sl=(r,top,ex='')=>{const m=/animation-delay:(\d+)ms/.exec(ex);return sl0(r,top,ex)+(/--ng/.test(ex)?'':sl0(r,top,ex+`;--ng:1;animation-delay:${(m?+m[1]:0)+40}ms;animation-duration:.26s;filter:opacity(.3);margin-top:-4px`))};
    /* 모션: 새로 걸린 키워드와 타수로 고른다 (화상=불꽃 고리, 출혈=할퀴기, 파열=균열, 연타=할퀴기·X자, 그 밖에는 베기·찌르기·X자 중 무작위) */
    const kt=col===kwc('burn')||col===kwc('flame')?'burn':col===kwc('bleed')?'bleed':col===kwc('rupture')?'rupture':'';
    const hitsN=(e.card&&e.card.hits)||1,pk=a=>a[Math.floor(Math.random()*a.length)];
    const edg=e.att!=='P'&&C&&D.enemies[C.id]&&D.enemies[C.id].drop&&D.enemies[C.id].drop.gear,ewn=(Array.isArray(edg)?edg:[edg]).filter(g=>g&&g.slot==='weapon').map(g=>g.n)[0]||'';
    const wn=e.att==='P'&&C&&C.ch&&C.ch.gear&&C.ch.gear.weapon?C.ch.gear.weapon.n:ewn,wm=weaponMotion(wn);
    const mo=wm?wm:crit?'critx':kt==='burn'?'ring':kt==='bleed'?'claw':kt==='rupture'?'crack':hitsN>=2?pk(['cross','claw']):pk(['slash','slash','thrust','cross']);
    /* 전용 모션: 기믹 무기는 무기마다 따로 그린다 (레바테인=해방 단계별, 발톱=흰 발톱자국, 미미크리=눈, 다 카포·궁니르=떨림, 검은 침묵의 장갑=나온 무기 번호별) */
    const gw=e.att==='P'&&C&&C.ch&&C.ch.gear&&C.ch.gear.weapon?C.ch.gear.weapon:null,wid=gw?gw.id:'',gl=/장갑 1d9 (\d)/.exec(e.note||'');
    const LST={laev_sealed:0,laev_s1:1,laev_s2:2,laev:3};
    const gwid=e.att==='P'?wid:((Array.isArray(edg)?edg:[edg]).filter(g=>g&&g.slot==='weapon').map(g=>g.id)[0]||''),sp=e.fxv||weaponFx(gwid,e,e.att==='P',gw)||(gl?'gl'+gl[1]:(wid==='job_claw'||/하얀 발톱/.test(wn))?'tclaw':wid in LST?'lv'+LST[wid]:/미미크리/.test(wn)?'eye':/다 카포/.test(wn)?'tremor':(wid==='gungnir'||/절대음감/.test(wn))?'reson':'');
    const NR=(a,b)=>a+Math.random()*(b-a),NSP=(c,d,a,r,cls='',ex='')=>`<b class="spk${cls}" style="--c:${c};--dx:${Math.round(Math.cos(a)*r)}px;--dy:${Math.round(Math.sin(a)*r)}px;--d:${d}ms;${ex}"></b>`;
    const PSX=pose==='|'?.42:1,PFY=pose==='\\'||(pose==='|'&&HFXFLIP)?-1:1;
    const RB=(P,W,c,o,N=22)=>{const B=(t,i)=>{const u=1-t;return u*u*u*P[0][i]+3*u*u*t*P[1][i]+3*u*t*t*P[2][i]+t*t*t*P[3][i]},Lf=[],Rt=[];for(let k=0;k<=N;k++){const t=k/N,x=B(t,0),y=B(t,1),dx=B(Math.min(1,t+.01),0)-B(Math.max(0,t-.01),0),dy=B(Math.min(1,t+.01),1)-B(Math.max(0,t-.01),1),m=Math.hypot(dx,dy)||1,w=W*Math.pow(Math.sin(Math.PI*t),.7)*(1+(Math.random()*2-1)*.16);Lf.push(`${(x-dy/m*w).toFixed(1)} ${(y+dx/m*w).toFixed(1)}`);Rt.push(`${(x+dy/m*w).toFixed(1)} ${(y-dx/m*w).toFixed(1)}`)}return `<path d="M${Lf.join('L')}L${Rt.reverse().join('L')}Z" style="fill:${c};stroke:none;opacity:${o}"/>`},
      SPKS=(N,r0,r1,f,k,d='.08s')=>{let q='';for(let i=0;i<N;i++){const a=i/N*6.283+NR(-.12,.12),lg=(i%4===0?1:i%2?.55:.8)*NR(.85,1.15)*r1,w=NR(.07,.12),pt=(r,aa)=>`${(Math.cos(aa)*r).toFixed(1)},${(Math.sin(aa)*r*.85).toFixed(1)}`;q+=`<polygon points="${pt(r0,a-w)} ${pt(lg*.55,a-w*.3+NR(-.05,.05))} ${pt(lg,a)} ${pt(lg*.5,a+w*.3+NR(-.05,.05))} ${pt(r0,a+w)}" style="fill:${f};stroke:${k};stroke-width:1.4px"/>`;if(lg>r1*.7)q+=`<polygon points="${pt(r0+2,a-w*.4)} ${pt(lg*.8,a)} ${pt(r0+2,a+w*.4)}" style="fill:#fff;opacity:.85"/>`}return `<svg class="burst" viewBox="-150 -65 300 130" style="--d:${d}">${q}</svg>`},
      SV=(inner,fl,ex='',dir=1)=>`<svg class="scv" viewBox="0 0 100 100" preserveAspectRatio="none" style="transform:scaleX(${fl*(dir?PSX:1)}) scaleY(${dir?PFY:1});${ex}">${inner}</svg>`,
      SHD=(N,cols,keys,lens)=>{let q='';for(let i=0;i<N;i++){const k=i%cols.length,L=Math.round(NR(lens[0],lens[1])*(i%5===0?1.5:1)),a=Math.round(i/N*360+NR(-9,9));q+=`<u class="sw" style="--a:${a}deg;--len:${L}px;--th:${Math.round(NR(4,9))}px;--r0:${Math.round(NR(2,10))}px;--r1:${Math.round(L*.18)}px;--r2:${Math.round(L*.75)}px;--c:${cols[k]};--k:${keys[k]};--d:${Math.round(NR(40,110))}ms"><i></i></u>`}return q};
    let h='';
    if(sp&&!(multi&&!lastHit)){
      const FL='#ff8a3c';
      if(sp==='tclaw'){col='#fff';const T=[[18,3],[36,4],[54,4],[72,3]],gh=(t,hh,d)=>sl(rot*0.7,t,`--ng:1;--sw:0;height:${hh}px;animation-delay:${d}ms`),ghost=(t,hh,d,mt,o)=>sl(rot*0.7,t,`--ng:1;--sw:0;height:${hh}px;animation-delay:${d}ms;margin-top:${mt}px;filter:opacity(${o})`);h=`<u class="jw lng">`+T.map(([t,hh],k)=>ghost(t,hh,k*40+90,-7,.18)+ghost(t,hh,k*40+45,-3,.4)+gh(t,hh+1,k*40)).join('')+`</u>`}
      /* 신규 설계안 시안(시험실 전용 fxv): 3프레임 기획(80 · 170 · 280ms)대로 만든 전용 이펙트 */
      else if(sp==='n_claw'){const fl=fromRight?-1:1,Y=[40,66,92],F=(i,dy,W,c,o)=>RB([[3,6+dy*.2],[30,-8+i*10],[66,22+Y[i]*.45],[96,Y[i]-10+dy]],W,c,o),claws=[0,1,2].map(i=>F(i,0,3.6,'#ffffff',1)).join(''),wound=[0,1,2].map(i=>F(i,0,5.2,'#b3121f',.9)).join('');col='#7ba6dc';h=SV(wound,fl,'animation-delay:130ms,330ms')+SV(claws,fl,'animation-delay:90ms,300ms;opacity:.28;margin-left:-5%')+SV(claws,fl,'animation-delay:45ms,260ms;opacity:.5;margin-left:-2.5%')+SV(claws,fl)+SPKS(8,4,46,'#b3121f','#2a0a0a','.12s')+`<i class="ringfx" style="--c:#7ba6dc;animation-delay:.12s;border-width:5px"></i>`;for(let i=0;i<10;i++)h+=NSP(i%2?'#b3121f':'#fff',Math.round(NR(110,150)),NR(0,6.28),NR(30,86),'','animation-duration:.5s');n=0}
      else if(sp==='n_fairy_g'||sp==='n_fairy_b'){const g=sp==='n_fairy_g',G='#f2c94c',K='#0b0a12',cols=g?[G,K,G]:[K,G,K],keys=g?[K,G,K]:[G,K,G];col=g?'#ffe08a':G;h=`<i class="disc" style="--c:${g?'#000':G}"></i><i class="hflash" style="--c:#fff2b0;animation-delay:.04s"></i><i class="glint" style="--c:${G};--x:50%;--y:50%;--d:.04s;width:96px;height:96px;margin:-48px"></i>`+SHD(30,cols,keys,[34,84]);for(let i=0;i<14;i++)h+=`<b class="spk up" style="--c:${col};left:${Math.round(NR(15,85))}%;--dx:${Math.round(NR(-10,10))}px;--dy:${-Math.round(NR(22,62))}px;--d:${Math.round(NR(130,220))}ms"></b>`;n=0}
      else if(sp==='n_mist'){const R='#c81e32',fl=fromRight?-1:1,P=[[0,72],[28,86],[66,16],[100,26]],B=(t,i)=>{const u=1-t;return u*u*u*P[0][i]+3*u*u*t*P[1][i]+3*u*t*t*P[2][i]+t*t*t*P[3][i]},px=t=>(50+((fl<0?100-B(t,0):B(t,0))-50)*PSX).toFixed(1)+'%',py=(t,j)=>(PFY<0?100-(B(t,1)+j):B(t,1)+j).toFixed(1)+'%',M=(dy,W,c,o)=>RB([[0,72+dy],[28,86+dy],[66,16+dy],[100,26+dy]],W,c,o,28);col=R;h=SV(M(0,17,'#7a0f1e',.92)+M(-2,12,R,.96)+M(-4,6,'#ff4a5e',.96)+M(-5,2,'#ffd0d6',.92)+M(8,4.5,'#a3162a',.78),fl)+`<i class="hflash" style="--c:#ff4a5e;animation-delay:.13s"></i>`+SPKS(14,4,64,'#c81e32','#2a0510','.13s');for(let i=0;i<22;i++){const thru=i>=14,t0=thru?NR(.3,.55):NR(0,.33),j=NR(-6,6),ts=thru?[t0,t0+.2,Math.min(1,t0+.42)]:[t0,t0+.17,.5],sz=Math.round(NR(7,12)),sx=thru?px(1):(50+NR(-40,40)).toFixed(0)+'%',sy=thru?py(1,j):(50+NR(-46,46)).toFixed(0)+'%';h+=`<i class="edot" style="width:${sz}px;height:${sz}px;margin:-${sz/2}px;${ts.map((t,k)=>`--x${k}:${px(t)};--y${k}:${py(t,j)}`).join(';')};--x3:${sx};--y3:${sy};--d:${Math.round(NR(30,110))}ms"></i>`}for(let i=0;i<10;i++)h+=NSP(R,Math.round(NR(150,220)),NR(0,6.28),NR(30,80),' drop','animation-duration:.5s');n=0}
      else if(sp==='n_vi_slash'){const fl=fromRight?-1:1,Q=(dy,W,c,o)=>RB([[0,92+dy],[30,100+dy],[66,40+dy],[100,6+dy]],W,c,o);col='#d946ef';h=SV(Q(0,27,'#26104a',.92)+Q(-2,19,'#6d28d9',.95)+Q(-4,10,'#d946ef',.97)+Q(-5,3,'#f6d4ff',.95)+Q(14,3.5,'#a855f7',.8)+Q(-16,3,'#a855f7',.8)+Q(24,2,'#c084fc',.7),fl)+SPKS(7,4,46,'#a855f7','#26104a','.12s');for(let i=0;i<10;i++)h+=NSP(i%2?'#d946ef':'#f6d4ff',Math.round(NR(60,140)),NR(0,6.28),NR(30,86),'','animation-duration:.5s');n=0}
      else if(sp==='n_vi_pierce'){col='#d946ef';h=`<i class="disc" style="--c:#a21caf"></i><i class="thrust beam" style="--c:#d946ef;--org:${org}"></i>`+SPKS(20,4,78,'#7c3aed','#26104a','.1s')+`<i class="hflash" style="--c:#f0abfc"></i>`;for(let i=0;i<10;i++)h+=NSP('#f6d4ff',Math.round(NR(100,160)),NR(0,6.28),NR(30,80),'','animation-duration:.5s');n=0}
      else if(sp==='n_vi_snake'){const fl=fromRight?-1:1,hd=[[26,'#26104a','#6d28d9'],[52,'#3b1578','#a855f7'],[78,'#26104a','#7c3aed']];col='#d946ef';h=SV(hd.map(([y,a,b],i)=>{const S=[[0,y>50?34:66],[34,y-70+i*8],[56,y+70-i*8],[84,y]];return RB(S,10.5,a,.95)+RB(S,6,b,.98)+RB(S,1.6,'#f6d4ff',.9)}).join(''),fl,'',0);hd.forEach(([y],i)=>{h+=`<i class="ringfx small" style="--c:#d946ef;left:${fl<0?100-84:84}%;top:${y}%;animation-delay:${150+i*55}ms;border-width:3px"></i>`});for(let i=0;i<10;i++)h+=NSP('#c084fc',Math.round(NR(170,250)),NR(0,6.28),NR(20,60),'','animation-duration:.5s');n=0}
      else if(sp==='n_vi_guard'){col='#c084fc';h=`<i class="shield"></i><i class="shield in"></i>`+sl(rot*0.5,50,`--ng:1;--sw:0;height:4px;--w:96%;--wm:300px;animation-duration:.22s;--c:#f6d4ff`);for(let i=0;i<10;i++)h+=NSP('#d946ef',Math.round(NR(120,200)),NR(0,6.28),NR(40,70),'','animation-duration:.5s');n=0}
      else if(sp==='n_book'){col='#7ba6dc';h=sl(rot,50,`--ng:1;--sw:0;height:4px;--w:92%;--wm:260px;animation-duration:.22s;--c:#fff`)+`<i class="ringfx small" style="--c:#7ba6dc;animation-delay:.11s;border-width:2px"></i><i class="ringfx" style="--c:#7ba6dc;animation-delay:.13s;border-width:2px"></i>`;for(let i=0;i<16;i++){const w=Math.round(NR(8,14)),k=i%2,z=()=>Math.round(NR(-22,22));h+=`<u class="paper" style="--w:${w}px;--c:${k?'#f1f1f1':'#101018'};--k:${k?'#101018':'#f1f1f1'};--x1:${z()}px;--y1:${Math.round(NR(-26,-6))}px;--x2:${Math.round(z()*1.4)}px;--y2:${Math.round(NR(6,22))}px;--x3:${z()}px;--y3:${Math.round(NR(30,52))}px;--x4:${z()}px;--y4:${Math.round(NR(58,86))}px;--r0:${Math.round(NR(-40,40))}deg;--r1:${Math.round(NR(-160,160))}deg;--d:${Math.round(NR(105,150))}ms"></u>`}n=0}
      else if(sp==='n_pitch'){const fl=fromRight?-1:1,Pp=[[2,76],[16,-14],[84,-14],[98,76]];col='#5fb8ff';h=SV(RB(Pp,7,'#2f7bff',.95,26)+RB(Pp,3.2,'#bfe3ff',1,26),fl);[90,150,210].forEach(d=>{h+=`<i class="ripple" style="--c:#7bc4ff;--d:${d}ms"></i>`});n=0}
      else if(sp==='n_twilight'){col='#ff8a2a';const X=(a,b,c,d,W,cl,o)=>RB([[a,b],[a+30,b+(d-b)*.2],[c-30,d-(d-b)*.2],[c,d]],W,cl,o);h=SV(X(4,10,96,92,10.5,'#120d18',.97)+X(4,92,96,10,10.5,'#120d18',.97)+X(4,10,96,92,6,'#ff8a2a',.98)+X(4,92,96,10,6,'#ff8a2a',.98)+X(4,10,96,92,2,'#ffe0a8',.9)+X(4,92,96,10,2,'#ffe0a8',.9),1,'',0)+`<i class="ringfx" style="--c:#ff7a1a;animation-delay:.1s;border-width:8px;width:60px;height:60px;margin:-30px"></i><i class="hflash" style="--c:#ff7a1a;animation-delay:.1s"></i>`;for(let i=0;i<14;i++){const a=NR(0,6.28),r=NR(40,96);h+=`<u class="dia" style="--dx:${Math.round(Math.cos(a)*r)}px;--dy:${Math.round(Math.sin(a)*r*.8)}px;--r:${Math.round(NR(-200,200))}deg;--d:${Math.round(NR(100,150))}ms"></u>`}for(let i=0;i<22;i++)h+=NSP('#ff8a2a',Math.round(NR(215,275)),NR(0,6.28),NR(30,90),' ash','animation-duration:.4s');n=0}
      else if(/^n_(thunder|warp[1-5])$/.test(sp)){const m=sp==='n_thunder'?1:[.34,.5,.66,.82,1][+sp.slice(6)-1],fl=fromRight?-1:1,Q=(W,c,o)=>RB([[2,86],[34,60],[66,36],[98,10]],W,c,o),zig=k=>{let d=`M2 ${86+k}`;for(let i=1;i<=14;i++){const t=i/14;d+=` L${(2+96*t).toFixed(1)} ${((86+k)*(1-t)+(10+k)*t+(i%2?-1:1)*NR(5,13)*(.5+m*.5)).toFixed(1)}`}return `<path d="${d}" style="fill:none;stroke:#7fd0ff;stroke-width:${(1.2+m).toFixed(1)}px;opacity:.95"/>`};col='#7fd0ff';h=SV(Q(12*m,'#0a2a5a',.92)+Q(8*m,'#eaf6ff',.96)+zig(0)+(m>.6?zig(-5)+zig(5):''),fl,'animation-delay:0s,.14s')+SPKS(Math.round(4+10*m),3,Math.round(24+34*m),'#7fd0ff','#0a2a5a','.11s')+`<i class="ringfx" style="--c:#ff8a2a;animation-delay:.11s;border-width:${Math.round(2+3*m)}px;width:${Math.round(24+20*m)}px;height:${Math.round(24+20*m)}px;margin:${-Math.round(12+10*m)}px"></i>`;for(let i=0;i<Math.round(4+12*m);i++)h+=NSP('#7fd0ff',Math.round(NR(210,280)),NR(0,6.28),NR(20,80)*(.5+m*.5),' ash','animation-duration:.4s');n=0}
      else if(/^n_geom[12]$/.test(sp)){const m=sp==='n_geom1'?1:.8,fl=fromRight?-1:1,Gq=(dy,W,c,o)=>RB([[2,84+dy],[26,96+dy],[70,40+dy],[98,8+dy]],W,c,o,28);col='#ff8a1f';const base=Gq(0,15*m,'#7a1208',.92)+Gq(-1,11*m,'#d6281c',.96)+Gq(-2,7.4*m,'#ff8a1f',.97)+Gq(-3,4*m,'#ffd83a',.98)+Gq(-4,1.6*m,'#fff6c8',.95);h=SV(base,fl)+SV(Gq(-6,6*m,'#ff8a1f',.6)+Gq(8,3*m,'#ffd83a',.6),fl,'animation-delay:60ms,260ms;opacity:.6;margin-left:-4%')+SPKS(Math.round(8*m),4,Math.round(54*m),'#ff8a1f','#3a0a04','.11s')+`<i class="hflash" style="--c:#ff6a1a;animation-delay:.1s"></i>`;for(let i=0;i<Math.round(14*m);i++)h+=NSP(i%2?'#ffd83a':'#ff4a1f',Math.round(NR(100,170)),NR(0,6.28),NR(30,96)*m,'','animation-duration:.5s');n=0}
      else if(sp==='n_finger'){col='#3b82f6';h=sl(rot,50,`--ng:1;--sw:0;height:4px;--w:90%;--wm:240px;animation-duration:.2s;--c:#9fd0ff`)+`<i class="hflash" style="--c:#3b82f6;animation-delay:.1s"></i>`;for(let i=0;i<5;i++){h+=`<u class="petal" style="--a:${i*72}deg;--sp:${Math.round(NR(-70,70))}deg"><svg viewBox="0 0 22 44"><path d="M11 44C-2 28 2 8 11 0C20 8 24 28 11 44Z" style="fill:#3b82f6;stroke:#0b2a6a;stroke-width:1.6"/><path d="M11 40V8" style="stroke:#dbeafe;stroke-width:1.6;fill:none"/><path d="M11 36C5 26 5 14 11 6" style="stroke:#93c5fd;stroke-width:1.2;fill:none"/></svg></u>`}h+=`<i class="ringfx" style="--c:#9fd0ff;animation-delay:.14s;border-width:3px"></i>`;for(let i=0;i<14;i++)h+=NSP(i%2?'#93c5fd':'#fff',Math.round(NR(200,270)),NR(0,6.28),NR(26,76),' ash','animation-duration:.4s');n=0}
      else if(sp==='n_chain'){col='#a855f7';h=`<i class="disc" style="--c:#7c3aed;width:260px;height:150px;margin:-75px -130px"></i><i class="thrust beam" style="--c:#c084fc;--org:${org};height:20px;margin-top:-10px"></i><i class="hflash" style="--c:#d8b4fe;animation-delay:.09s"></i><i class="ringfx" style="--c:#a855f7;animation-delay:.1s;border-width:9px;width:62px;height:62px;margin:-31px"></i><i class="ringfx small" style="--c:#f3e8ff;animation-delay:.16s;border-width:3px"></i>`+SPKS(14,4,62,'#7c3aed','#26104a','.1s');for(let i=0;i<11;i++){const x=Math.round(NR(30,70)),hh=Math.round(NR(40,72));h+=`<u class="aura" style="left:${x}%;--h:${hh}px;--d:${Math.round(NR(100,200))}ms;--w:${Math.round(NR(12,22))}px"></u>`}for(let i=0;i<14;i++)h+=NSP(i%2?'#d8b4fe':'#a855f7',Math.round(NR(110,170)),NR(0,6.28),NR(30,86),'','animation-duration:.5s');n=0}
      else if(sp==='n_ssang'){col='#e02a40';const sg=HFXFLIP?1:-1;h=sl(0,50,`--ng:1;--sw:0;height:3px;--w:96%;--wm:300px;animation-duration:.2s;--c:#fff`)+sl(-26*sg,50,`--ng:1;--sw:0;height:3px;--w:96%;--wm:300px;animation-duration:.2s;animation-delay:25ms;--c:#fff`)+`<i class="ringfx small" style="--c:#e02a40;animation-delay:.09s;animation-duration:.22s;border-width:2px"></i><i class="ringfx" style="--c:#c81e32;animation-delay:.12s;animation-duration:.22s;border-width:2px"></i>`;n=0}
      else if(sp==='n_gun'){col='#ffe08a';h=`<i class="muzzle"></i><i class="ringfx" style="--c:#d9d9d9;animation-delay:.1s;border-width:6px;border-style:dashed"></i>`;for(let i=0;i<9;i++)h+=`<i class="smoke" style="--x:${Math.round(NR(38,62))}%;--y:${Math.round(NR(38,62))}%;--s:${Math.round(NR(22,46))}px;--sx:${Math.round(NR(-14,14))}px;--d:${Math.round(NR(100,170))}ms"></i>`;n=0}
      else if(sp==='n_harp'){const dr=fromRight?Math.PI:0;col='#9fd0ff';h=`<i class="hbeam" style="--o:${fromRight?'right':'left'}"></i>`;for(let i=0;i<30;i++){const a=dr+NR(-.85,.85),r=NR(40,120);h+=`<b class="spk fall" style="--c:${i%2?'#fff':'#4aa0ff'};--dx:${Math.round(Math.cos(a)*r)}px;--dy:${Math.round(Math.sin(a)*r*.7)}px;--d:${Math.round(NR(100,150))}ms"></b>`}n=0}
      else if(sp==='n_gung'){col='#6ab8ff';h=`<i class="gbeam"></i>`;[26,38,50,62,74].forEach((x,i)=>{h+=`<i class="rz" style="--x:${x}%;--c:${i%2?'#fff':'#4aa8ff'};--d:${100+i*22}ms"></i>`});h+=`<i class="glint" style="--c:#cfe8ff;--x:50%;--y:50%;--d:.27s;width:60px;height:60px;margin:-30px"></i>`;n=0}
      else if(sp==='n_rune'){col='#e8d28a';h=`<i class="thrust beam" style="--c:#e8d28a;--org:${org};height:12px;margin-top:-6px"></i><u class="rune blk"><svg viewBox="0 0 44 56"><polygon points="22,3 40,28 22,53 4,28" style="fill:none;stroke:#0b0a12;stroke-width:3"/><path d="M22 3V53M12 20L32 36M32 20L12 36M13 28H31" style="fill:none;stroke:#0b0a12;stroke-width:2.4"/></svg></u><u class="rune"><svg viewBox="0 0 44 56"><polygon points="22,3 40,28 22,53 4,28" style="fill:none;stroke:#f4e6a8;stroke-width:3"/><path d="M22 3V53M12 20L32 36M32 20L12 36M13 28H31" style="fill:none;stroke:#f4e6a8;stroke-width:2.4"/></svg></u>`;h+=SHD(16,['#f4e6a8','#0b0a12','#e8d28a'],['#0b0a12','#f4e6a8','#0b0a12'],[10,28]).replace(/--d:\d+ms/g,()=>`--d:${Math.round(NR(232,268))}ms`)+`<i class="ringfx small" style="--c:#e8d28a;animation-delay:.1s;border-width:2px"></i>`;n=0}
      else if(/^n_lev[0-3]$/.test(sp)){const k=+sp.slice(5),amp=[0,.35,.68,1][k],m=[.24,.42,.66,1][k],burn=kt==='burn'||e.fxOr,C1=burn?'#ff6a1a':'#2f7bff',C2=burn?'#ffb25a':'#9fd0ff',C0=burn?'#5a1a05':'#0a2a7a',Pl=[[4,88],[14,88-108*amp],[86,88-108*amp],[96,88]],fl=fromRight?-1:1,Bz=(t,i)=>{const u=1-t;return u*u*u*Pl[0][i]+3*u*u*t*Pl[1][i]+3*u*t*t*Pl[2][i]+t*t*t*Pl[3][i]},mx=t=>(50+((fl<0?100-Bz(t,0):Bz(t,0))-50)*PSX).toFixed(1)+'%',my=t=>(PFY<0?100-Bz(t,1):Bz(t,1)).toFixed(1)+'%';col=C1;h=SV(RB(Pl,15*m,C0,.95,28)+RB(Pl,10.5*m,C1,.97,28)+RB(Pl,5*m,C2,.98,28)+RB(Pl,1.8*m,'#ffffff',.95,28),fl,'animation-delay:0s,.2s;animation-duration:.18s,.5s');const rn=[0,1,2,4][k];for(let i=0;i<rn;i++){const t=(i+1)/(rn+1);h+=`<i class="ringfx" style="--c:${C1};left:${mx(t)};top:${my(t)};animation-delay:${100+i*38}ms;border-width:${Math.round(3+3*m)}px;width:${Math.round(30+30*m)}px;height:${Math.round(30+30*m)}px;margin:${-Math.round(15+15*m)}px"></i>`}const pn=[6,12,22,40][k],dr=fromRight?Math.PI:0;for(let i=0;i<pn;i++){const a=dr+NR(-.9,.9),r=NR(30,110)*(.5+m*.5);h+=NSP(i%3?C2:'#fff',Math.round(NR(95,150)),a,r,'','animation-duration:.5s')}for(let i=0;i<pn;i++)h+=`<b class="spk ember" style="--c:${i%2?C1:C2};left:${Math.round(NR(15,85))}%;top:${Math.round(NR(40,70))}%;--w1:${Math.round(NR(-12,12))}px;--w2:${Math.round(NR(-18,18))}px;--d:${Math.round(NR(190,260))}ms"></b>`;n=0}
      else if(sp==='n_gung2'){col='#ffe27a';const RN=[['<svg viewBox="0 0 44 56"><polygon points="22,3 40,28 22,53 4,28" style="fill:none;stroke:#0b0a12;stroke-width:3"/><path d="M22 3V53M12 20L32 36M32 20L12 36M13 28H31" style="fill:none;stroke:#0b0a12;stroke-width:2.4"/></svg>','<svg viewBox="0 0 44 56"><polygon points="22,3 40,28 22,53 4,28" style="fill:none;stroke:#ffe27a;stroke-width:3"/><path d="M22 3V53M12 20L32 36M32 20L12 36M13 28H31" style="fill:none;stroke:#ffe27a;stroke-width:2.4"/></svg>'],['<svg viewBox="0 0 44 56"><path d="M22 4V52M22 14L36 6M22 14L8 6M22 30L38 20M22 30L6 20" style="fill:none;stroke:#0b0a12;stroke-width:3;stroke-linecap:round"/><circle cx="22" cy="46" r="3" style="fill:#0b0a12"/></svg>','<svg viewBox="0 0 44 56"><path d="M22 4V52M22 14L36 6M22 14L8 6M22 30L38 20M22 30L6 20" style="fill:none;stroke:#ffe27a;stroke-width:3;stroke-linecap:round"/><circle cx="22" cy="46" r="3" style="fill:#ffe27a"/></svg>'],['<svg viewBox="0 0 44 56"><polygon points="22,4 40,46 4,46" style="fill:none;stroke:#0b0a12;stroke-width:3"/><path d="M22 4V46M12 30H32M16 38L28 22" style="fill:none;stroke:#0b0a12;stroke-width:2.4"/></svg>','<svg viewBox="0 0 44 56"><polygon points="22,4 40,46 4,46" style="fill:none;stroke:#ffe27a;stroke-width:3"/><path d="M22 4V46M12 30H32M16 38L28 22" style="fill:none;stroke:#ffe27a;stroke-width:2.4"/></svg>']],pos=[[36,44],[52,58],[66,42],[46,30],[58,36]];h='';[-9,-4,0,4,9].forEach((dg,i)=>{h+=`<i class="thrust beam" style="--c:#ffd84a;--org:${org};top:${50+dg*1.1}%;rotate:${fromRight?-dg*.6:dg*.6}deg;height:7px;margin-top:-3px;animation-delay:${i*30}ms;animation-duration:.2s"></i>`});pos.forEach(([x,y],i)=>{const r=RN[i%3];h+=`<u class="rune blk" style="left:${x}%;top:${y}%;animation-delay:${.12+i*.03}s;animation-duration:.2s">${r[0]}</u><u class="rune" style="left:${x}%;top:${y}%;animation-delay:${.12+i*.03}s;animation-duration:.2s;filter:drop-shadow(0 0 4px #ffd84a)">${r[1]}</u>`});h+=SPKS(16,6,70,'#ffd84a','#3a2a00','.12s')+`<i class="glint" style="--c:#fff2a8;--x:50%;--y:50%;--d:.1s;width:84px;height:84px;margin:-42px"></i><i class="ringfx" style="--c:#ffd84a;animation-delay:.14s;border-width:4px"></i>`+SHD(18,['#ffe27a','#fff','#c9a227'],['#3a2a00','#3a2a00','#3a2a00'],[10,30]).replace(/--d:\d+ms/g,()=>`--d:${Math.round(NR(250,300))}ms`);n=0}
      else if(sp==='n_grudge'){const V=[[50,-8],[50,28],[50,62],[50,100]];col='#c81e32';h=SV(RB(V,13,'#4a0810',.95,26)+RB(V,9,'#c81e32',.97,26)+RB(V,4,'#ff4a5e',.97,26)+RB(V,1.4,'#ffd0d6',.9,26),1,'clip-path:inset(0 0 100% 0);animation-name:hScvDn,hScvOut;animation-duration:.14s,.5s',0)+`<i class="ringfx" style="--c:#8e1224;animation-delay:.1s;border-width:9px;width:62px;height:62px;margin:-31px"></i><i class="ringfx small" style="--c:#ff4a5e;animation-delay:.15s;border-width:3px"></i><i class="hflash" style="--c:#c81e32;animation-delay:.1s"></i>`;for(let i=0;i<10;i++){const a=NR(0,6.28),r=NR(24,66);h+=NSP(i%2?'#e02a40':'#a3162a',Math.round(NR(100,150)),a,r,' drop','animation-duration:.45s')}for(let i=0;i<12;i++)h+=`<b class="spk drip" style="--c:${i%2?'#c81e32':'#8e1224'};left:${Math.round(NR(30,70))}%;top:${Math.round(NR(36,62))}%;--fall:${Math.round(NR(40,78))}px;--d:${Math.round(NR(200,270))}ms"></b>`;n=0}
      else if(sp==='n_baton'){const fl=fromRight?-1:1;let zz=`M2 84`;for(let i=1;i<=12;i++){const t=i/12;zz+=` L${(2+96*t).toFixed(1)} ${(84-72*t+(i%2?-15:15)).toFixed(1)}`}col='#7ba6dc';h=`<svg class="scv" viewBox="0 0 100 100" preserveAspectRatio="none" style="transform:scaleX(${fl*PSX}) scaleY(${PFY})"><path d="${zz}" style="fill:none;stroke:#2a2d36;stroke-width:9px;stroke-linejoin:miter"/><path d="${zz}" style="fill:none;stroke:#c3c7d1;stroke-width:5px;stroke-linejoin:miter"/><path d="${zz}" style="fill:none;stroke:#fff;stroke-width:1.6px;stroke-linejoin:miter"/></svg><i class="ringfx" style="--c:#7ba6dc;animation-delay:.11s;border-width:5px"></i><i class="ringfx small" style="--c:#fff;animation-delay:.17s;border-width:2px"></i>`;for(let i=0;i<22;i++){const L=Math.round(NR(28,96)),a=Math.round(NR(0,360));h+=`<u class="sw thr" style="--a:${a}deg;--len:${L}px;--th:${(NR(1.2,2.6)).toFixed(1)}px;--r0:${Math.round(NR(2,10))}px;--r1:${Math.round(L*.25)}px;--r2:${Math.round(L*.75)}px;--c:${i%3?'#d7dae2':'#7ba6dc'};--k:#14171f;--d:${Math.round(NR(100,150))}ms"><i></i></u>`}n=0}
      else if(sp==='n_araya'){const fl=fromRight?-1:1,Sp=[[2,78],[30,104],[66,-4],[98,22]];col='#5b8def';h=SV(RB(Sp,10,'#d6283a',.95,28)+RB(Sp.map(([x,y])=>[x,y+7]),8,'#2f6bff',.9,28)+RB(Sp,3,'#ffd0d6',.85,28),fl)+`<i class="ringfx" style="--c:#5b8def;animation-delay:.11s;border-width:6px"></i>`;for(let i=0;i<18;i++){const a=NR(0,6.28),r=NR(24,100),sz=Math.round(NR(5,15));h+=`<b class="spk drop" style="--c:#d6283a;width:${sz}px;height:${sz}px;margin:-${sz/2}px;--dx:${Math.round(Math.cos(a)*r)}px;--dy:${Math.round(Math.sin(a)*r*.7)}px;--d:${Math.round(NR(100,150))}ms;animation-duration:.45s"></b>`}for(let i=0;i<12;i++)h+=`<b class="spk drip" style="--c:${i%3?'#d6283a':'#2f6bff'};left:${Math.round(NR(20,80))}%;top:${Math.round(NR(32,66))}%;--fall:${Math.round(NR(34,70))}px;--d:${Math.round(NR(210,260))}ms"></b>`;n=0}
      else if(sp==='n_lance'){let sp1='',sp2='';for(let k=0;k<2;k++){let d='';for(let t=0;t<=6.5;t+=.12){const r=3+t*5.6,a=t+k*Math.PI;d+=(t?'L':'M')+(Math.cos(a)*r).toFixed(1)+' '+(Math.sin(a)*r).toFixed(1)}sp1+=`<path d="${d}" style="fill:none;stroke:#e02a40;stroke-width:2.2;stroke-linecap:round"/>`}col='#c81e32';h=`<i class="lance" style="--o:${fromRight?'right':'left'}"></i><i class="ringfx" style="--c:#a3162a;animation-delay:.1s;border-width:9px;width:60px;height:60px;margin:-30px"></i><svg class="spiral" viewBox="-50 -50 100 100">${sp1}</svg><i class="hflash" style="--c:#c81e32;animation-delay:.1s"></i>`;for(let i=0;i<16;i++)h+=NSP('#e02a40',Math.round(NR(235,285)),NR(0,6.28),NR(30,90),' ash','animation-duration:.4s');n=0}
      else if(sp==='n_cross'){const Hh=[[50,2],[50,34],[50,66],[50,98]],Vv=[[2,50],[34,50],[66,50],[98,50]];col='#ff8a2a';h=SV(RB(Hh,10,'#5a1a05',.95,26)+RB(Vv,10,'#5a1a05',.95,26)+RB(Hh,6.4,'#e0560f',.97,26)+RB(Vv,6.4,'#e0560f',.97,26)+RB(Hh,2.6,'#ffb25a',.95,26)+RB(Vv,2.6,'#ffb25a',.95,26),1,'',0)+`<i class="ringfx" style="--c:#ff6a1a;animation-delay:.1s;border-width:8px;width:60px;height:60px;margin:-30px"></i><u class="brand"></u>`;for(let i=0;i<16;i++)h+=`<b class="spk up" style="--c:${i%3?'#2b2b30':'#4a4a52'};left:${Math.round(NR(34,66))}%;top:${Math.round(NR(40,64))}%;--dx:${Math.round(NR(-12,12))}px;--dy:${-Math.round(NR(30,70))}px;--d:${Math.round(NR(220,270))}ms"></b>`;n=0}
      else if(sp==='n_needle'){const ax=fromRight?88:12,dr=fromRight?1:-1;col='#c81e32';h='';[-14,-8,-3,3,8,14].forEach((dg,i)=>{h+=`<i class="thrust" style="--c:#e02a40;--org:${org};top:${50+dg*1.4}%;rotate:${fromRight?-dg*.5:dg*.5}deg;height:3px;margin-top:-1.5px;border:0;border-radius:0;animation-delay:${i*14}ms;animation-duration:.18s"></i>`});h+=`<i class="ringfx" style="--c:#c81e32;animation-delay:.11s;border-width:5px"></i>`;for(let i=0;i<14;i++){const sz=Math.round(NR(6,11));h+=`<i class="bdrop" style="width:${sz}px;height:${sz}px;margin:-${sz/2}px;--x0:${(50+NR(-6,6)).toFixed(0)}%;--y0:${(50+NR(-14,14)).toFixed(0)}%;--tx:${ax}%;--ty:50%;--d:${Math.round(NR(100,170))}ms"></i>`}h+=SPKS(10,3,40,'#c81e32','#2a0510','.37s').replace('class="burst"',`class="burst" style="left:${ax-50}%;--d:.37s"`);n=0}
      else if(/^n_bs([0-9]|F)$/.test(sp)){const g=sp==='n_bs0'?1+Math.floor(Math.random()*9):sp==='n_bsF'?10:+sp.slice(4),W1='#f4f4f6',K1='#0a0a10',ln=(r,t,ex='')=>sl(r,t,`--ng:1;--sw:0;--c:${W1};animation-duration:.2s;${ex}`);col=W1;h='';
        if(g===1)h=SV(RB([[8,6],[40,-6],[88,34],[84,96]],13,K1,.95,24)+RB([[8,6],[40,-6],[88,34],[84,96]],8.5,W1,.98,24),1,'',0)+`<i class="ringfx" style="--c:${W1};animation-delay:.11s;border-width:4px"></i>`+SPKS(6,3,40,W1,K1,'.11s');
        else if(g===2)h=ln(rot,50,'height:5px;--w:98%;--wm:320px')+ln(rot,56,'height:2px;--w:90%;--wm:290px;animation-delay:40ms;opacity:.6');
        else if(g===3){h=ln(0,50,'height:3px;--w:60%;--wm:180px;animation-duration:.14s')+SV(RB([[50,-8],[50,30],[50,66],[50,100]],11,K1,.96,26)+RB([[50,-8],[50,30],[50,66],[50,100]],6.5,W1,.98,26),1,'clip-path:inset(0 0 100% 0);animation-name:hScvDn,hScvOut;animation-duration:.12s,.3s;animation-delay:.08s,.2s',0)+`<i class="hflash" style="--c:#fff;animation-delay:.14s"></i>`}
        else if(g===4)h=ln(-30,50,'height:4px;--w:94%;--wm:290px;--c:#dff3ff')+ln(30,50,'height:4px;--w:94%;--wm:290px;--c:#dff3ff;animation-delay:30ms')+SHD(12,['#dff3ff','#fff'],[K1,K1],[10,28]);
        else if(g===5)h=[[34,-10],[50,0],[66,10]].map(([t,r2],k)=>`<i class="thrust" style="--c:${W1};--org:${org};top:${t}%;left:${fromRight?40:20}%;width:40%;rotate:${r2}deg;height:3px;margin-top:-1.5px;border:0;animation-delay:${k*40}ms;animation-duration:.14s"></i>`).join('')+`<i class="ringfx small" style="--c:${W1};animation-delay:.14s;border-width:2px"></i>`;
        else if(g===6){h=`<i class="muzzle" style="filter:grayscale(1)"></i>`;for(let k=0;k<8;k++){const dg=-18+k*5;h+=`<i class="thrust" style="--c:${W1};--org:${org};top:${50+dg*.9}%;rotate:${fromRight?-dg*.5:dg*.5}deg;height:2px;margin-top:-1px;border:0;animation-duration:.16s"></i>`}for(let k=0;k<5;k++)h+=`<i class="smoke dk" style="--x:${Math.round(NR(40,60))}%;--y:${Math.round(NR(40,62))}%;--s:${Math.round(NR(26,46))}px;--sx:${Math.round(NR(-16,16))}px;--d:${Math.round(NR(100,150))}ms"></i>`}
        else if(g===7)h=`<i class="lance" style="--o:${fromRight?'right':'left'};height:22px;margin-top:-11px;background:linear-gradient(90deg,transparent,#6f737d 20%,#fff 92%)"></i><i class="ringfx small" style="--c:${W1};animation-delay:.12s;border-width:3px"></i>`;
        else if(g===8)h=SV(RB([[2,86],[30,98],[70,34],[98,6]],15,K1,.96,26)+RB([[2,86],[30,98],[70,34],[98,6]],10,W1,.98,26)+RB([[2,86],[30,98],[70,34],[98,6]],3,'#9aa0ad',.9,26),1)+SPKS(10,4,52,W1,K1,'.11s')+`<i class="hflash" style="--c:#fff;animation-delay:.1s"></i>`;
        else if(g===9)h=`<i class="ringfx" style="--c:${W1};animation-delay:.08s;border-width:9px;width:66px;height:66px;margin:-33px"></i><i class="ringfx" style="--c:#9aa0ad;animation-delay:.15s;border-width:4px;width:90px;height:90px;margin:-45px"></i><i class="crack" style="--c:${W1};--fl:1"></i>`+[0,1,2,3,4,5].map(k=>`<i class="smoke dk" style="--x:${Math.round(NR(38,62))}%;--y:${Math.round(NR(44,66))}%;--s:${Math.round(NR(26,50))}px;--sx:${Math.round(NR(-18,18))}px;--d:${Math.round(NR(100,160))}ms"></i>`).join('');
        else{[-60,-30,-8,12,34,58,-44,22,72].forEach((r2,k)=>{h+=ln(r2,50,`height:${k%3?3:5}px;--w:96%;--wm:300px;animation-delay:${k*34}ms;animation-duration:.14s${k%2?';--c:#9aa0ad':''}`)});h+=SV(RB([[50,-8],[50,30],[50,66],[50,100]],11,K1,.96,26)+RB([[50,-8],[50,30],[50,66],[50,100]],6.5,W1,.98,26),1,'clip-path:inset(0 0 100% 0);animation-name:hScvDn,hScvOut;animation-duration:.12s,.3s;animation-delay:.34s,.46s',0)+`<i class="hflash" style="--c:#fff;animation-delay:.38s"></i>`+SPKS(14,4,60,W1,K1,'.38s')}
        for(let i=0;i<8;i++)h+=NSP(i%2?W1:'#34343c',Math.round(NR(110,170)),NR(0,6.28),NR(20,66),'','animation-duration:.45s');n=0}
      else if(sp==='n_beak'){col='#ff4a5e';h=`<i class="thrust" style="--c:#ff3b4f;--org:${org};height:3px;margin-top:-1.5px;border:0;border-radius:0;animation-duration:.13s"></i><i class="ringfx small" style="--c:#fff;animation-delay:.1s;border-width:2px"></i>`;for(let i=0;i<3;i++){const z=()=>Math.round(NR(-18,18)),w=Math.round(NR(8,11));h+=`<u class="paper feather" style="--w:${w}px;--c:${i%2?'#fff':'#e02a40'};--k:${i%2?'#a3162a':'#fff'};--x1:${z()}px;--y1:${Math.round(NR(-16,-4))}px;--x2:${z()}px;--y2:${Math.round(NR(8,18))}px;--x3:${z()}px;--y3:${Math.round(NR(26,40))}px;--x4:${z()}px;--y4:${Math.round(NR(44,60))}px;--r0:${Math.round(NR(-40,40))}deg;--r1:${Math.round(NR(-140,140))}deg;--d:${Math.round(NR(100,140))}ms"></u>`}n=0}
      else if(sp==='n_redeye'){const fl=fromRight?-1:1,Cv=[[14,0],[4,50],[40,98],[96,92]];col='#b3192b';let web='';for(let k=0;k<8;k++){const a=k/8*6.283;web+=`<path d="M0 0L${(Math.cos(a)*46).toFixed(1)} ${(Math.sin(a)*46).toFixed(1)}"/>`}for(const r of [14,28,44]){let d='';for(let k=0;k<=8;k++){const a=k/8*6.283,rr=r*(k%2?.88:1);d+=(k?'L':'M')+(Math.cos(a)*rr).toFixed(1)+' '+(Math.sin(a)*rr).toFixed(1)}web+=`<path d="${d}"/>`}h=SV(RB(Cv,13,'#2a0508',.96,26)+RB(Cv,9,'#7a0f1e',.97,26)+RB(Cv,3.4,'#e02a40',.95,26),fl)+`<i class="ringfx" style="--c:#b3192b;animation-delay:.1s;border-width:7px;border-style:dashed"></i><svg class="web" viewBox="-50 -50 100 100">${web}</svg>`+SHD(14,['#e02a40','#7a0f1e'],['#2a0508','#2a0508'],[8,22]).replace(/--th:\d+px/g,'--th:2px').replace(/--d:\d+ms/g,()=>`--d:${Math.round(NR(225,275))}ms`);n=0}
      else if(sp==='n_cosmos'){const fl=fromRight?-1:1;let zz='M2 80';[[18,40],[30,70],[44,28],[58,60],[72,14],[86,44],[98,10]].forEach(([x,y])=>{zz+=` L${x} ${y}`});col='#8b6cf0';h=`<svg class="scv" viewBox="0 0 100 100" preserveAspectRatio="none" style="transform:scaleX(${fl*PSX}) scaleY(${PFY})"><path d="${zz}" style="fill:none;stroke:#0c0a2e;stroke-width:11px;stroke-linejoin:miter"/><path d="${zz}" style="fill:none;stroke:#4c34b8;stroke-width:6.5px;stroke-linejoin:miter"/><path d="${zz}" style="fill:none;stroke:#c4b5fd;stroke-width:2px;stroke-linejoin:miter"/></svg>`+[90,150,210].map(d=>`<i class="ripple" style="--c:#7bb8ff;--d:${d}ms"></i>`).join('');for(let i=0;i<16;i++){const a=NR(0,6.28),r=NR(30,100),z=Math.round(NR(8,16));h+=`<b class="star" style="--z:${z}px;--dx:${Math.round(Math.cos(a)*r)}px;--dy:${Math.round(Math.sin(a)*r*.7)}px;--d:${Math.round(NR(100,170))}ms"></b>`}for(let i=0;i<14;i++)h+=NSP(i%2?'#8b6cf0':'#4c34b8',Math.round(NR(225,280)),NR(0,6.28),NR(20,80),' ash','animation-duration:.45s');n=0}
      else if(sp==='n_regret'){const Vv=[[50,-8],[50,30],[50,66],[50,100]];col='#d0d0d6';h=SV(RB(Vv,16,'#17171c',.96,26)+RB(Vv,11,'#6f6f78',.97,26)+RB(Vv,4,'#c8c8d0',.95,26),1,'clip-path:inset(0 0 100% 0);animation-name:hScvDn,hScvOut;animation-duration:.13s,.3s;animation-delay:0s,.18s',0)+`<i class="ringfx" style="--c:#f4f4f6;animation-delay:.11s;border-width:9px;width:62px;height:62px;margin:-31px"></i>`;for(let i=0;i<12;i++){const a=NR(-3.14,0),r=NR(30,84),L=Math.round(NR(10,26));h+=`<u class="chunk" style="--len:${L}px;--th:${Math.round(NR(4,8))}px;--c:${i%2?'#8a8a92':'#c8c8d0'};--a:${Math.round(NR(0,180))}deg;--dx:${Math.round(Math.cos(a)*r*1.2)}px;--dy:${Math.round(Math.sin(a)*r*.5)}px;--d:${Math.round(NR(110,150))}ms"></u>`}n=0}
      else if(/^n_ws[0-4]$/.test(sp)){const t=+sp.slice(4),fl=fromRight?-1:1,Pw=[[2,86],[30,98],[70,34],[98,8]],spark=(c1,c2,k)=>{let q='';for(let i=0;i<k;i++)q+=NSP(i%2?c1:c2,Math.round(NR(80,150)),NR(-.4,.4)+(fromRight?Math.PI:0)+NR(-1,1),NR(24,84),'','animation-duration:.4s');return q};
        if(t===0){col='#ffb25a';h=sl(rot,50,`--ng:1;--sw:0;height:9px;--c:#7a3a10;animation-duration:.22s`)+sl(rot,50,`--ng:1;--sw:0;height:4px;--c:#ffe3b8;animation-duration:.22s`)+spark('#ff9a3a','#ffd08a',9)}
        else if(t===1){col='#ffb25a';h=sl(rot,50,`--ng:1;--sw:0;height:10px;--c:#7a3a10;animation-duration:.22s`)+sl(rot,50,`--ng:1;--sw:0;height:4px;--c:#ffe3b8;animation-duration:.22s`)+sl(rot,56,`--ng:1;--sw:0;height:3px;--c:#7fd0ff;animation-duration:.24s;animation-delay:30ms`)+spark('#ff9a3a','#7fd0ff',14)+`<i class="ringfx small" style="--c:#7fd0ff;animation-delay:.12s;border-width:2px"></i>`}
        else if(t===2){col='#7fd0ff';h=SV(RB(Pw,7,'#0a2a5a',.95,24)+RB(Pw,4.4,'#bfe3ff',.97,24)+RB(Pw,1.4,'#fff',.95,24),fl)+SV(RB(Pw,4,'#7fd0ff',.7,24),fl,'animation-delay:50ms,260ms;opacity:.45;margin-left:-3%')+`<i class="ringfx" style="--c:#7fd0ff;animation-delay:.11s;border-width:3px"></i>`+spark('#ff9a3a','#7fd0ff',16)}
        else if(t===3){col='#7fd0ff';h=SV(RB(Pw,11,'#0a2a5a',.95,26)+RB(Pw,7.4,'#7fd0ff',.97,26)+RB(Pw,3.4,'#ffe08a',.97,26)+RB(Pw,1.2,'#fff',.95,26),fl)+SV(RB(Pw,6,'#7fd0ff',.7,26),fl,'animation-delay:45ms,250ms;opacity:.5;margin-left:-3%')+SV(RB(Pw,5,'#7fd0ff',.7,26),fl,'animation-delay:90ms,290ms;opacity:.3;margin-left:-6%')+SPKS(10,3,50,'#7fd0ff','#0a2a5a','.11s')+`<i class="ringfx" style="--c:#ffe08a;animation-delay:.11s;border-width:5px"></i><i class="hflash" style="--c:#7fd0ff;animation-delay:.1s"></i>`+spark('#ffe08a','#7fd0ff',22)}
        else{const Pc=[[4,88],[14,-10],[86,-10],[96,88]];col='#ffe08a';h=SV(RB(Pc,15,'#0a1a4a',.95,28)+RB(Pc,10.5,'#4a8dff',.97,28)+RB(Pc,5.4,'#ffe08a',.98,28)+RB(Pc,1.8,'#fff',.95,28),fl)+SV(RB(Pc,8,'#7fd0ff',.7,28),fl,'animation-delay:45ms,250ms;opacity:.5;margin-left:-3%')+SV(RB(Pc,6,'#7fd0ff',.7,28),fl,'animation-delay:90ms,290ms;opacity:.3;margin-left:-6%')+SPKS(16,4,72,'#ffe08a','#1a2a5a','.11s')+`<i class="hflash" style="--c:#ffe08a;animation-delay:.1s"></i><i class="glint" style="--c:#fff2b0;--x:50%;--y:50%;--d:.1s;width:80px;height:80px;margin:-40px"></i>`+[100,140,180].map(d=>`<i class="ringfx" style="--c:#ffe08a;animation-delay:${d}ms;border-width:4px"></i>`).join('')+spark('#ffe08a','#fff',30);for(let i=0;i<14;i++)h+=`<b class="spk ember" style="--c:${i%2?'#ffe08a':'#7fd0ff'};left:${Math.round(NR(15,85))}%;top:${Math.round(NR(40,70))}%;--w1:${Math.round(NR(-12,12))}px;--w2:${Math.round(NR(-18,18))}px;--d:${Math.round(NR(190,260))}ms"></b>`}
        n=0}
      else if(sp==='n_dacapo'){col='#5fb8ff';h=sl((rot<0?-1:1)*Math.min(Math.abs(rot),32),50,`--ng:1;--sw:0;height:4px;--w:92%;--wm:250px;--c:#fff;animation-duration:.22s`)+`<i class="ringfx" style="--c:#5fb8ff;animation-delay:.11s"></i><i class="ringfx small" style="--c:#fff;animation-delay:.2s"></i>`;[['♪',40,44,-14],['♫',54,56,10],['♪',66,42,16]].forEach(([c,x,y,r])=>{h+=`<u class="note blk" style="--x:${x}%;--y:${y}%;--r:${r}deg">${c}</u><u class="note" style="--x:${x}%;--y:${y}%;--r:${r}deg">${c}</u>`;for(let i=0;i<6;i++)h+=`<b class="spk" style="--c:#5fb8ff;left:${x}%;top:${y}%;--dx:${Math.round(NR(-34,34))}px;--dy:${Math.round(NR(-30,30))}px;--d:${Math.round(NR(235,275))}ms;animation-duration:.5s"></b>`});n=0}
      else if(sp==='eye'){col='#d0344a';h=sl(rot,50,'height:7px;--c:#d0344a')+sl(rot*0.6,56,'--sw:0;height:3px;--c:#7a1020;animation-delay:50ms')}
      else if(sp==='tremor'){h=`<u class="jw">`+sl(rot,50,'--c:#5fd0ff;margin-top:-3px')+sl(rot,50,'--c:#ff4d6d;margin-top:3px;animation-delay:30ms')+sl(rot,50,'--c:#fff;animation-delay:15ms')+sl(rot,50,'opacity:.5;animation-delay:70ms')+sl(rot,50,'opacity:.3;animation-delay:140ms')+`</u>`}
      else if(sp==='reson'){col='#4aa8ff';h=`<u class="jw"><i class="thrust beam" style="--c:#4aa8ff;--org:${org}"></i></u><i class="ringfx" style="--c:${col}"></i><i class="ringfx small" style="--c:${col};animation-delay:.22s"></i><i class="ringfx" style="--c:${col};animation-delay:.34s;opacity:.5"></i>`}
      else if(sp==='lv0'){col=kt==='burn'?col:FL;h=sl(rot*1.3,34,'--sw:0;height:3px;--c:'+col)+sl(-rot,64,'--sw:0;height:3px;animation-delay:80ms;--c:'+col)}
      else if(sp==='lv1'){col=kt==='burn'?col:FL;h=sl(rot,40,'--c:'+col)+sl(-rot,60,'animation-delay:70ms;--c:'+col)}
      else if(sp==='lv2'){col=kt==='burn'?col:FL;h=sl(rot,50,'height:7px;--c:'+col)+`<i class="ringfx" style="--c:${col}"></i>`}
      else if(sp==='lv3'){col=kt==='burn'?col:FL;h=`<i class="cres" style="--c:${col};--rot:${Math.max(-60,Math.min(60,rot*1.2))}deg;--org:center center"></i>`+sl(rot*1.4,50,'--sw:0;height:3px;--c:#fff')+`<i class="ringfx" style="--c:${col}"></i><i class="ringfx small" style="--c:#fff"></i>`}
      else{
        const g=+sp.slice(2);
        if(g===1)h=sl(rot*1.3,50,'height:9px');
        else if(g===2||g===3)h=sl(rot,50);
        else if(g===4)h=sl(rot,50)+sl(-rot,50,'animation-delay:70ms');
        else if(g===5)h=sl(rot,34,'--sw:0;height:3px')+sl(rot,66,'--sw:0;height:3px;animation-delay:60ms');
        else if(g===6)h=`<i class="thrust" style="--c:${col};--org:${org}"></i><i class="thrust" style="--c:${col};--org:${org};top:30%;animation-delay:30ms"></i><i class="thrust" style="--c:${col};--org:${org};top:70%;animation-delay:30ms"></i>`;
        else if(g===7)h=`<i class="thrust" style="--c:${col};--org:${org};height:7px"></i><i class="ringfx small" style="--c:${col}"></i>`;
        else if(g===8)h=sl(rot,50,'height:11px')+`<i class="hflash" style="--c:${col}"></i>`;
        else h=`<i class="ringfx" style="--c:${col}"></i><i class="ringfx small" style="--c:${col}"></i>`;
      }
    }else if(!(multi&&!lastHit)){
      if(wm&&kt==='burn')h+=`<i class="ringfx small" style="--c:${col}"></i>`;
      if(mo==='critx')h=`<i class="hdark"></i>`+sl(rot,50,'height:7px')+sl(-rot,50,'height:7px;animation-delay:60ms')+`<i class="critstar" style="--c:${col}"></i>`;
      else if(mo==='slash')h=sl(rot,50);
      else if(mo==='cross')h=sl(rot,50)+sl(-rot,50,'animation-delay:70ms');
      else if(mo==='claw')h=sl(rot,24,'--sw:0;height:3px')+sl(rot,50,'--sw:0;height:3px;animation-delay:50ms')+sl(rot,76,'--sw:0;height:3px;animation-delay:100ms');
      else if(mo==='thrust')h=`<i class="thrust" style="--c:${col};--org:${org}"></i><i class="ringfx small" style="--c:${col}"></i>`;
      else if(mo==='ring')h=`<i class="ringfx" style="--c:${col}"></i>`;
      else h=`<i class="crack" style="--c:${col};--fl:${fromRight?-1:1}"></i>`;
    }
    if(lv>=3&&lastHit)h+=`<i class="hflash" style="--c:${col}"></i>`;
    for(let i=0;i<n;i++){const a=Math.random()*Math.PI*2,r=26+Math.random()*(big?70:46);h+=`<b class="spk${sp==='eye'?' drop':''}" style="--c:${col};--dx:${Math.round(Math.cos(a)*r)}px;--dy:${Math.round(Math.sin(a)*r)+(sp==='eye'?26:0)}px;--d:${Math.round(Math.random()*90)}ms"></b>`}
    const fx=document.createElement('div');fx.className='hfx'+(/^n_(?!dacapo)/.test(sp)?' big':'');fx.innerHTML=h;{let zf=(gw&&/^ego_/.test(wid)&&typeof gw.egoLv==='number')?[.65,.8,.95,1.15][Math.min(3,gw.egoLv)]:1;
      if(/^n_/.test(sp)){/* 연출 강도: 가볍게=파티클 1/3·번쩍임 없음·80%, 강하게=110% (시안 이펙트는 '보통' 기준) */
        if(lv===1){zf*=.8;fx.querySelectorAll('.spk,.smoke,.sw,.paper,.star,.dia,.edot,.chunk,.petal,.link,.bdrop,.aura,.rune,.note').forEach((el,i)=>{if(i%3)el.remove()});fx.querySelectorAll('.hflash,.disc,.ripple').forEach(el=>el.remove())}
        else if(lv>=3)zf*=1.1}
      if(zf!==1)fx.style.transform=`scale(${zf})`}box.appendChild(fx);setTimeout(()=>fx.remove(),800);
    if(crit&&lv>=2)floatTxt(e.def,'치명!','#ffd35a','crit');
    if(crit&&hid&&lv>=2){box.classList.remove('cjit');void box.offsetWidth;box.classList.add('cjit');setTimeout(()=>box.classList.remove('cjit'),420)}
    if(lastHit&&(lv>=2&&bigFx||lv>=3)){const hs=bigFx&&lv>=2?90:0;/* 역경직: 큰 타격은 잠깐 멈칫(밝아졌다 굳음)한 뒤 흔들린다 */if(hs){box.classList.add('hstop');setTimeout(()=>box.classList.remove('hstop'),hs)}setTimeout(()=>{const w=document.querySelector('.wrap');if(w){w.classList.remove('shk','shk2');void w.offsetWidth;w.classList.add(lv>=3&&bigFx?'shk2':'shk');setTimeout(()=>w.classList.remove('shk','shk2'),320)}},hs)}
  }
  function whiffFx(e){
    const lv=HFX_N[HFX]||0;if(lv<2||MODE==='off'||SKIP)return;
    const box=$('ent-'+e.def);if(!box)return;const fx=document.createElement('div');fx.className='hfx';fx.innerHTML='<i class="whiff"></i>';box.appendChild(fx);setTimeout(()=>fx.remove(),600);
  }
  function applySnap(sn){
    for(const side of ['P','E']){
      const X=C[side],v=sn[side],h=$('hp-'+side);
      if(!h)return;
      /* 새로 붙은 키워드는 그 칸 위에 잠깐 띄운다 */
      const pv=PREV[side];PREV[side]={...v};
      if(pv)Object.keys(D.keywords).forEach((k,i)=>{const dlt=(v[k]||0)-(pv[k]||0);if(dlt>0)setTimeout(()=>floatTxt(side,`${D.keywords[k].n} +${dlt}`,kwc(k),'kwf'),120+i*160)});
      h.textContent=`HP ${v.hp}/${X.maxHp}`;
      $('bar-'+side).firstElementChild.style.width=clamp(v.hp/X.maxHp*100,0,100)+'%';
      {const en=$('ent-'+side);if(en)en.classList.toggle('danger',isDanger(v.hp,X.maxHp))}
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
  /* 들리는 목소리 판정(1d50 세 번, 모두 기준 이상): 주사위 세 개가 차례로 멈추고, 기준 이상이면 금빛으로 켜진다 */
  function rollFxVoice({rs,dc,die,ok,sight,at,twist}){
    return new Promise(res=>{
      if(document.getElementById('rv')){res();return}
      const still=MODE==='off'||SKIP;
      const o=document.createElement('div');o.id='rv';
      o.innerHTML=`<div class="rv-t">정신력 ${at} · 목소리가 가깝다</div><div class="rv-d">${rs.map(()=>'<b>–</b>').join('')}</div><div class="rv-s">1d${die} × ${rs.length} · 모두 ${dc} 이상이어야 E.G.O 개화</div><div class="rv-r" id="rvr"></div>`;
      document.body.appendChild(o);
      const bs=[...o.querySelectorAll('.rv-d b')],rr=document.getElementById('rvr');let t=still?9000:0,stop=0,done=false;
      const iv=setInterval(()=>{t+=70;bs.forEach((b,i)=>{if(i>=stop)b.textContent=1+Math.floor(Math.random()*die)});
        if(t>=900+stop*500&&stop<rs.length){bs[stop].textContent=rs[stop];bs[stop].className=rs[stop]>=dc?'on':'off';stop++}
        if(stop>=rs.length){clearInterval(iv);const all=rs.every(x=>x>=dc);o.classList.add(ok?'good':'bad');rr.textContent=ok?(all?'E.G.O 개화':'장비의 형상이 보였다 · E.G.O 개화'):twist?'목소리를 밀어내지 못했다 · 육신이 뒤틀린다':'개화하지 못했다 · 아직 마음이 버틴다';setTimeout(end,1500)}},70);
      function end(){if(done)return;done=true;clearInterval(iv);o.classList.add('out');setTimeout(()=>{o.remove();res()},400)}
      o.addEventListener('click',()=>{if(stop>=rs.length)end()});
    });
  }
  /* 정신력 1·0의 판정 연출: 1d100이 굴러 멈추고, 기준선(개화 N 이하)과 결과를 보여 준다. 개화=금빛 파동, 뒤틀림=붉은 번쩍임·떨림 */
  /* 전투 중 정신력 0: 개화 판정에 실패하면(r2가 있으면) 뒤틀림 판정을 한 번 더 굴린다. 두 번째도 실패하면 정신 붕괴 */
  function rollFx(a){
    if(a.rs)return rollFxVoice(a);
    return rollBar(a).then(()=>a.r2!=null&&!a.ok?rollBar({r:a.r2,th:a.th2,ok:!a.dead,at:a.at,second:true}):null);
  }
  function rollBar(a){
    const {r,th,ok,at,sight,second}=a,two=a.r2!=null;
    return new Promise(res=>{
      if(document.getElementById('rv')){res();return}
      const still=MODE==='off'||SKIP;
      const o=document.createElement('div');o.id='rv';
      o.innerHTML=`<div class="rv-t">정신력 ${at} · ${second?'마음이 한계를 넘는다':'마음이 한계에 닿았다'}</div><div class="rv-n" id="rvn">–</div><div class="rv-bar"><i class="rv-ok" style="width:${th}%"></i><i class="rv-mk" id="rvm" style="left:0"></i><span class="rv-l" style="left:0">1</span><span class="rv-l" style="left:${th}%">${th}</span><span class="rv-l" style="right:0">100</span></div><div class="rv-s">${second?`1d100 · ${th} 이하면 육신이 뒤틀리고, 넘으면 정신이 무너진다`:`1d100 · ${th} 이하면 E.G.O 개화, 넘으면 ${two?'뒤틀림 판정으로 넘어간다':'육신이 뒤틀린다'}`}</div><div class="rv-r" id="rvr"></div>`;
      document.body.appendChild(o);
      const n=document.getElementById('rvn'),m=document.getElementById('rvm'),rr=document.getElementById('rvr');let t=still?1300:0,done=false;
      const iv=setInterval(()=>{t+=70;const v=1+Math.floor(Math.random()*100);n.textContent=v;m.style.left=v+'%';if(t>=1300){clearInterval(iv);n.textContent=r;m.style.left=r+'%';o.classList.add(ok?'good':'bad');rr.textContent=second?(ok?'육신이 뒤틀린다':'정신이 무너진다'):ok?(sight?'장비의 형상이 보였다 · E.G.O 개화':'E.G.O 개화'):two?'개화하지 못했다':'육신이 뒤틀린다';setTimeout(end,1500)}},70);
      function end(){if(done)return;done=true;clearInterval(iv);o.classList.add('out');setTimeout(()=>{o.remove();res()},400)}
      o.addEventListener('click',()=>{if(t>=1300)end()});
    });
  }
  async function playEvent(e){
    const nm=s=>C[s].name;
    if(e.step!=null&&e.step>=0)markStep(e.step);
    markSides(e.att||e.side||null,e.def||null);setVerdict('');
    {const rl=(e.lines||[]).find(l=>l.roll);if(rl)await rollFx(rl.roll)}
    if(e.k==='head'){setLabel(e.lines[0]?e.lines[0].s:'');appendLog(e.lines);await wait(500);return}
    if(e.k==='def'){setLabel(`${nm(e.side)} · ${e.card.n}`);anim($('ent-'+e.side),'guard',700);appendLog(e.lines);await wait(450);return}
    if(e.k==='buff'){setLabel(`${nm(e.side)} · ${e.card.n}`);anim($('ent-'+e.side),'guard',700);appendLog(e.lines);applySnap(e.snap);await wait(500);return}
    if(e.k==='herm'){floatTxt(e.side,e.txt,'var(--gold)','herm');appendLog(e.lines);applySnap(e.snap);await wait(750);return}
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
      rollNum(dA.firstElementChild,e.ra,650,100).then(()=>{dA.classList.remove('rolling');anim(dA,'settle',320);sfx('hit')}),
      rollNum(dD.firstElementChild,e.rd,900,e.rdMax||100).then(()=>{dD.classList.remove('rolling');anim(dD,'settle',320);sfx('dodge')})
    ]);
    $('fA').textContent=e.sa;$('fD').textContent=e.sd;
    $('fA').className='dfinal '+(e.hit?'good':'');$('fD').className='dfinal '+(e.hit?'':'good');
    {const rl=(r,list,note)=>`<div class="rl"><span>눈</span><b>${r}</b></div>${(()=>{const L=list||[],ps=L.filter(x=>x[1]>0),ms=L.filter(x=>x[1]<0),row=(c,sg,arr)=>arr.length?`<div class="rl ${c}" title="${esc(arr.map(([n,v])=>n+' '+(v>0?'+':'−')+Math.abs(v)).join(' · '))}"><span>${sg==='+'?'버프':'디버프'}</span><b>${sg}${Math.abs(arr.reduce((t,x)=>t+x[1],0))}</b></div>`:'';return row('pl','+',ps)+row('mi','−',ms)})()}${note?`<div class="rn">${note}</div>`:''}`;
      $('sA').innerHTML=rl(e.ra,e.amL,e.ra2?`(2회 굴림, ${e.ra2} 버림)`:'');$('sD').innerHTML=rl(e.rd,e.dmL,'')}
    dA.classList.add(e.hit?'win':'lose');dD.classList.add(e.hit?'lose':'win');
    await holdTap();
    await wait(350);
    anim($('ent-'+e.att),e.att==='P'?'lunge-up':'lunge-down',500);
    await wait(200);
    if(e.hit){
      anim($('ent-'+e.def),'hurt',520);hitFx(e);sfx(hitKind(e));
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
      anim($('ent-'+e.def),'guard',600);sfx('block');floatTxt(e.def,'−'+e.dmg,'var(--rupture)');
      appendLog(e.lines);applySnap(e.snap);
      await holdTap();
      await wait(500);
    }else{
      setVerdict(`빗나감 · ${C[e.def].name}이(가) 피했다`,'miss');
      anim($('ent-'+e.def),'dodge',600);whiffFx(e);sfx('whoosh');floatTxt(e.def,'회피','var(--rupture)');
      appendLog(e.lines);applySnap(e.snap);
      await holdTap();
      await wait(500);
    }
  }
  async function runPlayback(evs){
    PLAYING=true;SKIP=false;
    /* 같은 카드로 이어지는 타격 묶음: 타수가 3 이상이면 묶음 안에서 몇 번째 타격인지 표시해 둔다 (연출 '마지막만 크게'에서 쓴다) */
    for(let i=0;i<evs.length;i++){const a=evs[i];if(!a||a.k!=='atk'||a._g)continue;let j=i;while(j+1<evs.length&&evs[j+1]&&evs[j+1].k==='atk'&&evs[j+1].att===a.att&&evs[j+1].card===a.card)j++;
      const n=j-i+1;for(let k=i;k<=j;k++)evs[k]._g={n,i:k-i};}
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
      die.classList.remove('rolling');anim(die,'settle',320);sfx('tick');
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
    if(X.vt>0)out.push(`<span class="chip stk" style="--kc:#8e5fc7"><b>뱀의 장벽 ${X.vt}/${CFG.serpent.max}</b><small>환영난무 빛 −${X.vt} · 피해 +${X.vt}</small></span>`);
    if(X.stunned)out.push('<span class="chip stk" style="--kc:#b07cc6"><b>기절</b><small>이번 라운드 행동 불가 · 회피 0</small></span>');
    /* 히든 보스 패시브 스택: 잔향(내게 쌓임), 장부(보스에게 쌓임) */
    const pv=C&&C.E&&C.E.passive;
    if(pv&&X.echo>0)out.push(`<span class="chip stk" style="--kc:var(--rupture)"><b>${pv.n} ${X.echo}/${pv.need}</b><small>${pv.need}에서 고정 피해 ${pv.dmg}</small></span>`);
    if(pv&&X.ledger>0)out.push(`<span class="chip stk" style="--kc:var(--bleed)"><b>${pv.n} ${X.ledger}/${pv.need}</b><small>${X.ledger>=pv.need?'다음 명중 1d110':'다 차면 명중 1d110'}</small></span>`);
    /* 전용 무기 디버프 */
    const pw=G&&G.ch&&G.ch.gear.weapon&&G.ch.gear.weapon.wx||{};
    const W=[['cloud','구름',v=>`${v}/${CFG.syn['흑운회'].max} · 가득 차면 흑운`],['black','흑운',v=>`주사위마다 +${CFG.syn['흑운회'].die} · 적중 시 출혈 +1`],['prescript','지령',v=>`명중 −${3*v}`],['warp','왜곡',v=>`주는 피해 −${v}`],['shock','감전',v=>`회피 −${3*v}`],['chain','사슬',v=>`회피 −${2*v}`],['web','거미줄',v=>`회피 −${2*v}`],['hunger','오랜 굶주림',v=>`${v}/${CFG.hunger.max} · 다음 공격 카드의 첫 적중 피해 +${v} (쓰면 전부 소진)`],['work','작품',v=>`명중 +${CFG.ring.hit*v} · ${CFG.ring.max}이면 다음 적중 피해 ×${CFG.ring.finish}`],['awlMark','급소',v=>`${v}/${CFG.syn['밤의 송곳'].mark.cap} · ${CFG.syn['밤의 송곳'].mark.per}당 피해 +1 · ${CFG.syn['밤의 송곳'].mark.burst.at} 이상이면 송곳 박기`],['mk','표적',v=>`${v}/3 · 3이면 피해 2배`],['grudge',pw.grudgeN||'원한',v=>`다음 적중 +${v*(pw.grudge||4)}`],['dimCharge','차원이동',v=>'충전됨 · 다음 상대 공격 하나를 피하고 사각에서 벤다'],['fairy','요정',v=>`${v}/30 · 이후 적중마다 추가 피해 +${v} · 라운드마다 −3`],['imprint','각인',v=>`${v}/5 · 상대의 공격 카드 봉인 확률 ${15*v}%${v>=5?' · 다음 행동 봉인':''}`],['cmark','발톱자국',v=>`${v}/5 · 적중 피해 +${2*v} · 5가 되면 추가타`],['wecho',pw.echo&&pw.echo.n||'잔향',v=>`${v}/${pw.echo?pw.echo.need:5} · ${pw.echo?pw.echo.need:5}이면 고정 피해 ${pw.echo?pw.echo.dmg:10}`],['shield','보호막',v=>`피해 ${v} 막음`],['matc','재료 수집',v=>'신체관극의 재료가 된다'],['mat','재료',v=>`폐장 주사위 +${v}`],['disp','처분 표식',v=>'처분 주사위 +1'],['serum','혈청',v=>`${v}/3${v>=3?' · 다음 적중 ×1.5':''}`],['ammo','탄환',v=>`${v}발 남음 · 공격마다 1발`],['manner','예의를 지킬 것',(v,X)=>`명중 −${Math.floor(v*(X.mannerPer||(Array.isArray(CFG.thumbManner)?CFG.thumbManner[0]:CFG.thumbManner)))}`],['presc','지령 수행',v=>`${v}/5 · 받는 피해 −${v*5}%`],['revenge','되갚음',v=>`${v}/${X.isP?CFG.middle.cap:5} · 받는 피해 −${v*CFG.middle.def} · 다음 적중 +${v*(X.revMul||CFG.middle.dmg)} · HP +${v*CFG.middle.heal}`],['sealMark','봉인 각인',v=>`${v}/5 · 해제 시 +${v*4}`],['accel','가속',v=>`명중·회피 +${v*5}`]];
    for(const [k,n,h] of W)if(X[k]>0)out.push(`<span class="chip stk" style="--kc:var(--gold)"><b>${n} ${X[k]}</b><small>${h(X[k],X)}</small></span>`);
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
  /* 타수가 있으면 '(한 타의 피해) × n타'로 적어 주사위 개수(2d6)와 타수가 헷갈리지 않게 한다 */
  const hx=(c,e)=>c.hits>1?`(${e}) × ${c.hits}타`:e;
  function cardLine0(c,g,wx){
    if(c.range)return `${hx(c,`주사위 ${c.dice}개(각 ${c.range[0]}~${c.range[1]})${c.b?sg(c.b):''}`)} · 명중 ${sg(c.hit+(g?g.hit:0))}`;
    if(c.gamble)return `${c.d} · 명중 ${sg(c.hit+(g?g.hit:0))}`;
    const x=[];
    if(c.adv)x.push('명중 2회 굴림');
    if(c.spend)x.push(`충전 ${c.spend>=99?'전부':c.spend} 소모 · 1당 고정 +${c.fixPer}${c.hits>1?' (적중마다)':''}`);
    if(c.once)x.push('전투당 1회');
    if(c.harpoonPull)x.push(`작살을 모두 당겨 스택당 +${c.harpoonPull.per} 피해`);
    if(c.nailBurst)x.push(`못을 모두 흐트러짐으로 ×${c.nailBurst.mul}${c.nailBurst.add?' +'+c.nailBurst.add:''}`);
    if(c.spdDice)x.push(`속도 ${c.spdDice[0]} 이상이면 주사위마다 +${c.spdDice[1]}`);
    if(c.sinkDmg)x.push(`침잠 ${CFG.sink.per}당 +${c.sinkDmg}`);
    if(c.egT)x.push(c.egT);
    if(c.rr)x.push('낮은 피해 재굴림');
    if(c.min)x.push('피해 최소 '+c.min);
    if(c.next)x.push('사용 후 다음 라운드 '+D.cards[c.next].n);
    if(c.rngDebuff)x.push('주사위마다 '+c.rngDebuff.map(k=>D.keywords[k].n).join('·')+' 중 무작위 +1');
    
    const ex=x.length?' · '+x.join(' · '):'';
    /* 전용 무기 주사위가 있으면 실제로 굴리는 주사위로 표시 */
    if(wx&&wx.dice){const dc=c.dice+(g&&!c.die?g.dice:0),b=(c.b||0)+(g?g.b:0),base=c.range?`${dc}d(${c.range[0]}~${c.range[1]})`:`${dc}d${c.die||6}`;return `${hx(c,`${base}${b?sg(b):''} + ${wx.dice[0]}d${wx.dice[1]}`)} · 명중 ${sg(c.hit+(g?g.hit:0))} · 무기 주사위 추가${g&&g.n?' · 등급 '+g.n:''}${ex}`}
    if(g&&g.n){const dc=c.dice+(c.die?0:g.dice),b=(c.b||0)+g.b;return `${hx(c,`${dc}d${c.die||6}${b?sg(b):''}`)} · 명중 ${sg(c.hit+g.hit)} · 등급 ${g.n}${ex}`}
    return `${hx(c,`${c.dice}d${c.die||6}${c.b?sg(c.b):''}`)} · 명중 ${sg(c.hit)}${x.length?' · '+x.join(' · '):''}`;
  }
  /* 게임 중 화면 구석의 간단한 음악 조절: 왼쪽 위에 켬/끔·스타일(고요/불길), 오른쪽에 음량 버튼(누르면 작은 세로 막대가 열린다) */
  /* 모바일: 위쪽 소리·설정 버튼 줄이 본문을 가리므로 접었다 펼 수 있다 (브라우저에 기억) */
  const barHidden=()=>{try{return localStorage.getItem('cy_barhide')==='1'}catch(e){return false}};
  function quickAudio(){
    if(!BGM.supported)return '';
    const on=BGM.isOn(),v=Math.round(BGM.vol()*100),ic=v===0?'<path d="M3 9v6h4l5 4V5L7 9H3z"/><path d="M16 9l5 6M21 9l-5 6" stroke="currentColor" stroke-width="2" fill="none"/>':'<path d="M3 9v6h4l5 4V5L7 9H3z"/><path d="M15.5 8.5a5 5 0 010 7M18 6a8.5 8.5 0 010 12" stroke="currentColor" stroke-width="2" fill="none"/>';
    return `<div class="qaudio"><div class="qrow"><button class="qb${on?' on':''}" data-a="qbgm" aria-label="배경음악 ${on?'끄기':'켜기'}" title="배경음악">${on?'♪ 켬':'♪ 끔'}</button><button class="qb" data-a="qstyle" aria-label="배경음악 스타일 바꾸기" title="스타일">${{passion:'불길',library:'도서관',wave:'물결',ext:'시험곡'}[BGM.style()]||'고요'}</button></div>${SFX.supported?`<div class="qrow"><button class="qb${SFXS.on?' on':''}" data-a="qsfx" aria-label="효과음 ${SFXS.on?'끄기':'켜기'}" title="효과음">${SFXS.on?'효과음 켬':'효과음 끔'}</button></div>`:''}</div>
      <div class="volbox"><button class="qb${UI.volOpen?' on':''}" data-a="qvol" aria-label="음량 조절" title="음량"><svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">${ic}</svg></button>${UI.volOpen?`<div class="volpop"><input type="range" id="bgmQuick" min="0" max="100" step="1" value="${v}" aria-label="배경음악 음량"><b class="mono" id="bgmQuickPct">${v}%</b></div>`:''}</div>`;
  }
  /* 엔딩 화면에서 이어서 살 수 있는 경우(여기서 끝낸다 버튼이 있는 경우). 이때 다시 태어나면 이어 살 판이 사라지므로 한 번 더 누르게 한다 */
  const INF_WHY={"crowsucceed": "총사령관의 자리가 외곽의 배양 시설로 옮겨 가고, 복제체의 길이 도시 안에서 끝나지 않는다", "hermobey": "수행 완료 뒤에도 단말기가 꺼지지 않고, 새 지령이 어긋난 자리를 가리킨다", "hermfree": "지령이 끊긴 뒤에도 단말기가 꺼지지 않고, 어디로 걸어도 어긋난 자리로 이어진다", "libstay": "도서관의 서가가 외곽의 어긋난 자리까지 이어지고, 손님은 계속 찾아온다", "libclose": "문을 닫은 서가가 어긋난 자리에 남고, 닫힌 문 앞을 찾아오는 손님을 돌려보내는 일이 끝나지 않는다", "clawreturn": "도서관이 있던 자리에 선 바깥으로 이어지는 문이 남아, 머리의 마지막 명령 \"닫아라\"가 끝나지 않는다", "clawstay": "선 바깥은 닫히지 않았고, 문 앞을 지키는 자리가 끝나지 않는다", "arbkeep": "균형의 한쪽을 도시에 남기면 다른 한쪽을 선 바깥에 두어야 해서, 바깥쪽 추를 맡게 된다", "arbdown": "조율의 자리에서 내려온 곳이 외곽이라, 맞추는 사람 없이 흔들리는 추로 남는다", "gwmoth": "도시가 받아들이지 않는 몸이라 군체를 이끌고 외곽으로 나선다", "gwroach": "도시가 받아들이지 않는 몸이라 군체를 이끌고 외곽으로 나선다", "gwfly": "도시가 받아들이지 않는 몸이라 군체를 이끌고 외곽으로 나선다", "gwhuman": "인간으로 남은 몸이 도시에 어울리지 않아 외곽으로 물러난다"};
  const INF_KEYS=Object.keys(INF_WHY);
  const endCanResume=()=>!!(UI.endWin&&G&&((!G.endless)||UI.outEnd||UI.oldEnd||((UI.hwEnd||UI.rbEnd)&&G.endless&&!UI.trueEnd)||(UI.trueEnd&&!G.infinite)||(UI.crowEnd==='crowrefuse'&&!G.infinite)||(INF_KEYS.includes(UI.crowEnd)&&!G.infinite)));
  function vSettings(){
    const b=(a,k,l,cur)=>`<button class="${cur===k?'on':''}" data-a="${a}" data-i="${k}">${l}</button>`;
    return `${FS.ok()?`<div class="stack" style="gap:6px"><span class="eyebrow">전체 화면</span><div class="seg">${b('fs','off','끔',FS.on()?'':'off')}${b('fs','on','켬',FS.on()?'on':'')}</div><span class="small dim">브라우저 주소창·탭 줄을 숨깁니다 · 방송이나 넓은 화면용 · Esc로도 끝낼 수 있습니다</span></div>`:''}<div class="stack" style="gap:6px"><span class="eyebrow">배경 테마</span><div class="seg">${SKINS.map(s=>b('skin',s.k,s.n,SKIN)).join('')}</div></div>
      <div class="stack" style="gap:6px"><span class="eyebrow">주사위 · 전투 연출</span><div class="seg">${b('mode','manual','수동',MODE)}${b('mode','slow','천천히',MODE)}${b('mode','fast','빠르게',MODE)}${b('mode','off','끔',MODE)}</div>
        <span class="small dim">${{manual:'행동마다 버튼을 눌러 직접 주사위를 굴린다',slow:'자동으로 천천히 굴린다',fast:'자동으로 빠르게 굴린다',off:'연출 없이 결과만 본다'}[MODE]}</span></div>
      <div class="stack" style="gap:6px"><span class="eyebrow">자동 전투 간격</span><div class="seg">${b('autogap','slow','느림',AUTOGAP)}${b('autogap','normal','보통',AUTOGAP)}${b('autogap','mid','조금 빠름',AUTOGAP)}${b('autogap','fast','빠름',AUTOGAP)}</div>
        <span class="small dim">자동 전투에서 라운드와 라운드 사이를 얼마나 쉬는지 · 전투 중 일시정지도 할 수 있다</span></div>
      <div class="stack" style="gap:6px"><span class="eyebrow">인생 주사위</span><div class="seg">${b('dice','free','매번 다르게',DICE)}${b('dice','fixed','시드 고정(재현)',DICE)}</div>
        <span class="small dim">${DICE==='fixed'?'시드가 같고 선택이 같으면 인생 전체의 주사위가 똑같이 나온다 (공유·재현용)':'출생만 시드로 정해지고, 태어난 뒤의 사건 주사위는 판마다 달라진다'}</span></div>
      <div class="stack" style="gap:6px"><span class="eyebrow">무한 모드 문구</span><div class="seg">${b('infnote','on','켬',INFNOTE?'on':'off')}${b('infnote','off','끔',INFNOTE?'on':'off')}</div>
        <span class="small dim">무한 모드에서 해마다 위쪽에 뜨는 문구와 상태창 아래의 작은 글을 보일지 정한다</span></div>
      ${BGM.supported?`<div class="stack" style="gap:6px"><span class="eyebrow">배경음악</span><div class="seg">${b('bgm','off','끔',BGM.isOn()?'on':'off')}${b('bgm','on','켬',BGM.isOn()?'on':'off')}</div><div class="stack" style="gap:4px"><span class="small">스타일 · 전투에 들어가면 템포가 오른다</span><div class="seg">${b('bgmstyle','calm','고요',BGM.style())}${b('bgmstyle','passion','불길',BGM.style())}${b('bgmstyle','library','도서관',BGM.style())}${b('bgmstyle','wave','물결',BGM.style())}${BGM.extOn()?b('bgmstyle','ext','시험곡',BGM.style()):''}</div>${BGM.extOn()?`<div class="stack" style="gap:6px;margin-top:6px"><span class="small">시험곡 · 한 곡이 평시에 나오고, 전투에서는 같은 곡이 템포만 빨라진다 (히든 보스는 기존 곡)</span><div class="row" style="gap:6px;flex-wrap:wrap">${['강철','냉철','차선','사서','자정'].map((nm,k)=>`<button class="${BGM.ext()===k+1?'on':''}" data-a="bgmext" data-i="${k+1}">${k+1} ${nm}</button>`).join('')}</div><span class="small dim">1 Steel Core Conflict · 2 Weight of Cold Iron · 3 The Penultimate Gambit · 4 The Librarian's Gambit · 5 Midnight Manuscript Duel</span></div>`:''}</div>
        <div class="stack" style="gap:4px"><div class="row between"><span class="small">음량</span><b class="mono" id="bgmPct">${Math.round(BGM.vol()*100)}%</b></div>
          <div class="bgmrow"><button class="chip" data-a="bgmstep" data-i="-10" aria-label="음량 10 줄이기">−10</button><input type="range" id="bgmRange" min="0" max="100" step="1" value="${Math.round(BGM.vol()*100)}" aria-label="배경음악 음량"><button class="chip" data-a="bgmstep" data-i="10" aria-label="음량 10 올리기">+10</button></div></div>
        <span class="small dim">고요 · 불길 · 도서관 · 물결 중에서 고른다. 불길과 물결은 전투에 들어가면 같은 곡이 빨라져 이어진다. 켜면 소리가 서서히 커지고, 언제든 끌 수 있다. 처음 음량은 30%이고, 막대를 끌거나 −10 · +10 버튼으로 0~100%까지 조절한다</span></div>`:''}
      ${SFX.supported?`<div class="stack" style="gap:6px"><span class="eyebrow">효과음</span><div class="seg">${b('sfx','off','끔',SFXS.on?'on':'off')}${b('sfx','on','켬',SFXS.on?'on':'off')}</div>
        <div class="stack" style="gap:4px"><div class="row between"><span class="small">효과음 음량</span><b class="mono" id="sfxPct">${Math.round(SFXS.vol*100)}%</b></div>
          <div class="bgmrow"><button class="chip" data-a="sfxstep" data-i="-10" aria-label="효과음 10 줄이기">−10</button><input type="range" id="sfxRange" min="0" max="100" step="1" value="${Math.round(SFXS.vol*100)}" aria-label="효과음 음량"><button class="chip" data-a="sfxstep" data-i="10" aria-label="효과음 10 올리기">+10</button></div></div>
        <button class="chip" data-a="sfxtest">소리 시험 (멈춤 · 회피 · 참격)</button><span class="small mono" id="sfxState"></span><span class="small dim">주사위가 멈출 때와 타격·회피 때 나는 소리다. 배경음악과 따로 켜고 끈다. 연출을 끄면 나지 않는다. 시험 소리가 안 들리면 기기의 미디어 음량·무음 설정을 확인한다</span></div>`:''}
      <div class="stack" style="gap:6px"><span class="eyebrow">타격 연출</span><div class="seg">${b('hitfx','off','끔',HFX)}${b('hitfx','low','가볍게',HFX)}${b('hitfx','mid','보통',HFX)}${b('hitfx','high','강하게',HFX)}</div><div class="seg">${b('hitfxm','each','타격마다',HFXM)}${b('hitfxm','last','타수 많으면 마지막만 크게',HFXM)}</div><span class="small dim">맞은 쪽에 베기 선과 파편이 튄다. 화상은 주황, 출혈은 붉은색, 파열은 보라 같은 식으로 새로 걸린 키워드에 따라 색이 달라진다. 연출을 끄면 나오지 않는다</span></div>
      <div class="stack" style="gap:6px"><span class="eyebrow">전투 진행</span><div class="seg">${b('fightmode','pick','직접 고르기',FIGHT)}${b('fightmode','auto','자동 전투',FIGHT)}</div>
        <span class="small dim">${FIGHT==='auto'?'카드 선택과 라운드 진행을 알아서 한다. 전투가 끝나면 멈춘다':'라운드마다 손패에서 카드를 직접 고른다'}${FIGHT==='auto'&&MODE==='manual'?' · 자동 전투 중에는 수동 굴림 버튼을 기다리지 않는다':''}</span></div>`;
  }
  /* 호수 선장은 직위표의 맨 위(부선장)가 아니라 선장으로 보인다(칭호 '선장'과 함께 뜨던 부선장 표기 제거) */
  const frName=c=>c.flags&&c.flags.lake&&c.lake&&c.lake.captain&&c.fr?'선장':(c.fr?c.fr.n:'');
  const affLabel=ch=>(ch.aff?`<span class="chip"${ch.aff.own?' style="color:var(--gold);border-color:var(--gold)"':''}>${ch.aff.own?'내 사무소 · ':''}${esc(ch.aff.name)}${ch.office&&ch.office.ws?' · 내 사무소 '+esc(ch.office.name):''}${ch.corp&&ch.corp.wing?' · 설립 '+esc(ch.corp.wing):''}${ch.aff.own&&ch.office?' · '+E.OKW[ch.office.kw]:''}${ch.fr&&!['wing','finger'].includes(E.career(ch))?' · '+frName(ch):''}</span>`+(ch.tattoo&&D.tattoos&&D.tattoos[ch.tattoo.key]?`<span class="chip" style="color:var(--gold);border-color:var(--gold)">${esc(D.tattoos[ch.tattoo.key].n)} ${ch.tattoo.lv}단계</span>`:''):ch.hw?`<span class="chip" style="color:var(--gold);border-color:var(--gold)">H사 홍원${ch.hw.done?' · 가주':ch.hw.out?' · 외부 임무':''}</span>`:ch.licensed?`<span class="chip">${T.licensed}</span>`:'')
    +(ch.pinky?`<span class="chip" title="${D.pinky.t}">${ch.pinkyFull?D.pinky.n:ch.aff?'+'+D.pinky.n:D.pinky.n+' 표식'}</span>`:'');
  const innateOne=(c,k)=>k==='mark'&&c.markOn?D.innate.mark.awake:D.innate[k].n;
  const innateName=c=>c.innate?[c.innate,c.innate2].filter(Boolean).map(k=>innateOne(c,k)).join(' · '):null;
  /* E.G.O 적성자: 무기 등급과 다음 등급까지 남은 발현 횟수 */
  const egoGrowTag=ch=>{if(ch.egoUses==null)return '';const G=CFG.egoGrow,L=E.egoLvFor(ch.egoUses),nx=G.need[L+1];
    return ` · <span style="color:var(--gold)">${G.tier[L]}</span>${nx!=null?` · 발현 ${ch.egoUses}/${nx}`:''}`};
  /* E.G.O 적성자: 다음 등급까지의 진행 막대 (정신력 아래 · 전투 화면에도) */
  const egoBar=ch=>{if(ch.egoUses==null)return '';const G=CFG.egoGrow,u=ch.egoUses,L=E.egoLvFor(u),nx=G.need[L+1],pct=nx==null?100:Math.round((u-G.need[L])/(nx-G.need[L])*100);
    return `<div class="egobar"><div class="row between small"><b style="color:var(--gold)">E.G.O 성장 · ${G.tier[L]}${nx!=null?` → ${G.tier[L+1]}`:' (최대)'}</b><span class="mono">${nx!=null?`발현 ${u}/${nx}`:`발현 ${u}회`}</span></div><div class="bar"><i style="width:${pct}%"></i></div>${nx!=null?`<div class="small dim">전용 카드 '발현'을 ${nx-u}번 더 쓰면 ${G.tier[L+1]}로 자란다</div>`:''}</div>`};
  /* 선장의 배 내구도: 가방을 열지 않아도 정신력 아래에 항상 보인다 */
  function vShip(ch){
    const L=ch.lake;if(!(ch.flags&&ch.flags.lake&&L&&L.captain))return '';
    const h=E.hullOf(ch),mx=CFG.lake.hullMax,low=h<=mx*0.25,col=low?'#e0705a':'#6fb4d8';
    return `<div class="panel stack" style="gap:5px;padding:8px 10px;border-color:${col}"><div class="row between"><b style="color:${col};font-size:15px">⚓ 배 내구도 ${h}/${mx}</b><span class="mono small dim">${low?'곧 가라앉는다':'전투마다 -'+CFG.lake.hullWear}</span></div><div class="bar" style="height:10px"><i style="width:${Math.round(h/mx*100)}%;background:${col}"></i></div><span class="mono small dim">${low?'항구에서 700안으로 수리하지 않으면 침몰한다':'항구에서 '+CFG.lake.repairCost+'안으로 수리'}</span></div>`;
  }
  function vMind(ch){
    if(ch.distForm)return `<div class="row between small"><span class="mono" style="color:#c25050">정신력 ???</span><span class="mono dim">이점도 불이익도 없다</span></div>`;
    const m=ch.mind,mx=E.mindMax(ch),t=E.mindTier(ch),low=m<=CFG.mind.voiceAt;
    return `<div class="row between small"><span class="mono" style="color:${low?'var(--bad,#c46a5a)':'var(--gold)'}">정신력 ${m}/${mx}</span><span class="mono dim">${ch.ego?`E.G.O ${esc(ch.ego.n)} · 하한 ${CFG.mind.ego[ch.ego.type].floor} · 빛 +${CFG.mind.light}(처음 ${CFG.mind.lightRounds}라운드)`:t?`호흡 +${t.breath}${t.eva?` · 회피 +${t.eva}`:''}${E.mindStat(ch)?` · 모든 능력치 +${E.mindStat(ch)}`:''}`:low?'목소리가 가깝다':'보정 없음'}${ch.egoGear?` · E.G.O 장비 ${ch.egoGear}`:''}${egoGrowTag(ch)}${ch.innate?` · <span style="color:var(--gold)">${esc(innateName(ch))}</span>`:''}${E.cardGrade(ch.year,ch).n?` · 카드 등급 <b style="color:var(--gold)">${E.cardGrade(ch.year,ch).n}</b>`:''}</span></div>
      <div class="bar" style="height:4px"><i style="width:${Math.round(m/mx*100)}%;background:${low?'#c46a5a':'#8a7fb8'}"></i></div>`;
  }
  /* 손가락별 지속 패시브 한 줄 (HUD와 가입 선택 화면이 같이 쓴다) */
  const fingerPassive=(af,fi)=>af==='엄지'?`탄환 · 전투마다 ${CFG.thumbAmmo.base+CFG.thumbAmmo.per*fi}발 (서열마다 +${CFG.thumbAmmo.per}) · 공격마다 1발 소모 · 상대에게 예의를 지킬 것 1 (상대 명중 −${(Array.isArray(CFG.thumbManner)?CFG.thumbManner[Math.min(CFG.thumbManner.length-1,fi||0)]:CFG.thumbManner)}×스택, 전투가 끝날 때까지 유지) · 탄환 수만큼만 쌓이고, 탄환이 바닥나면 더는 쌓이지 않는다`
    :af==='검지'?'지령 수행 · ☆ 칸 카드를 내면 1(최대 5) · 호흡 +4 · 받는 피해 −5%×스택'
    :af==='중지'?'되갚음 · 맞을 때마다 1(최대 10) · 스택 1당 받는 피해 −2 · 다음 적중에서 스택을 모두 써 피해 +스택 · 소모한 스택 1당 HP 1 회복 · 방어 카드를 낸 라운드에 맞으면 스택 × 3의 고정 피해로 반격'
    :af==='약지'?`작품 · 적중할 때마다 +1(전투 한정, 최대 ${CFG.ring.max}) · 스택당 명중 +${CFG.ring.hit} · 최대면 다음 적중 피해 ×${CFG.ring.finish} 후 ${CFG.ring.after}로`
    :af==='흑운회'?`암운 · 덱 8장부터 열린다 (그 아래로 줄이면 닫힘) · 전투 시작 구름 3 (10장이면 4) · 출혈을 걸거나 맞을 때마다 구름 +1 · 5가 되면 흑운: 피해 주사위마다 +${CFG.syn['흑운회'].die} · 적중 시 출혈 +1 · 라운드 끝에 구름 2로 · 덱 10장이면 흑운 중 받는 피해 ×${CFG.syn['흑운회'].half} · 맞을 때마다 구름 수치(흑운일 땐 ${CFG.syn['흑운회'].max}) × ${CFG.syn['흑운회'].counter[2]}(8장) · ${CFG.syn['흑운회'].counter[3]}(10장)의 고정 피해로 자동 반격`
    :af==='검계'?'호흡결 · 덱 8장부터 열린다 (그 아래로 줄이면 닫힘) · 호흡 최대 '+CFG.syn['검계'].cap+' · 매 라운드 호흡 +2 · 호흡 자연 감소 1 (10장이면 줄지 않음) · 호흡 '+CFG.syn['검계'].per+'당 모든 카드 피해 +1 · 호흡 10 이상 적중은 방어·보호막 무시 · 호흡 10을 넘는 만큼 치명 배수 +'+CFG.syn['검계'].critPer+'씩 · 호흡 '+CFG.syn['검계'].burst.at+' 이상이면 호흡을 모아 폭발(최대 '+CFG.syn['검계'].burst.max+', 쓴 호흡의 절반만 소모, 호흡 1당 고정 피해 '+CFG.syn['검계'].burst.per[2]+'(8장) · '+CFG.syn['검계'].burst.per[3]+'(10장), '+CFG.syn['검계'].burst.every+'라운드에 한 번)'
    :af==='밤의 송곳'?'뒷골목의 룰 · 덱 8장부터 열린다 (그 아래로 줄이면 닫힘) · 출혈이 걸린 적에게 명중 +'+CFG.syn['밤의 송곳'].bleedHit+' · 선공이면 상대 회피 절반 · 속도 굴림 +10 (10장이면 +15, 선공 첫 적중 출혈 +1) · 급소: 출혈 걸린 적을 맞히면 +'+CFG.syn['밤의 송곳'].mark.bleed+', 선공 첫 적중 +'+CFG.syn['밤의 송곳'].mark.lead+' (최대 '+CFG.syn['밤의 송곳'].mark.cap+(CFG.syn['밤의 송곳'].mark.decay?', 라운드마다 −'+CFG.syn['밤의 송곳'].mark.decay:', 라운드가 바뀌어도 줄지 않음')+'), '+CFG.syn['밤의 송곳'].mark.per+'당 모든 카드 피해 +1 · 급소 '+CFG.syn['밤의 송곳'].mark.burst.at+' 이상이면 적중에 상대 출혈 스택×'+CFG.syn['밤의 송곳'].mark.burst.mul[2]+'(8장) · ×'+CFG.syn['밤의 송곳'].mark.burst.mul[3]+'(10장)을 더하고 급소 '+CFG.syn['밤의 송곳'].mark.burst.at+' 소모':null;
  /* 지속형 패시브: 손가락·히든 출생 등 늘 켜져 있는 효과를 HUD에 한 줄로 */
  function vPassive(ch){
    const P=[];const af=ch.aff&&ch.aff.name;
    {const t=fingerPassive(af,ch.fi||0);if(t)P.push(t)}
    if(ch.pinky&&!ch.hw&&CFG.rankCardF['소지']){const tab=CFG.rankCardF['소지'],n=(ch.pinkyKeys||[]).length,t=tab[Math.min(n,tab.length-1)];if(t&&(t.dice||t.b||t.hit))P.push(`별 카드 강화 (인의예지 ${n}/4) · 모든 공격 · 주사위 +${t.dice} · 피해 +${t.b} · 명중 +${t.hit}`)}
    else {const tab=CFG.syn[af]?(D.fingers[af]&&D.fingers[af].pack?CFG.rankCard:null):CFG.rankCardF[af];if(tab&&!ch.hw&&ch.aff&&ch.aff.type==='finger'){const t=tab[Math.min(Math.max(ch.fi||0,0),tab.length-1)];if(t&&(t.dice||t.b||t.hit))P.push(`서열 카드 강화 · ${CFG.syn[af]?'전용 카드':'모든'} 공격 · 주사위 +${t.dice} · 피해 +${t.b} · 명중 +${t.hit}`)}}
    if(ch.gw&&ch.gw.proc){const Z_=CFG.gweapon,Pr=Z_.proc[ch.gw.proc],F=ch.gw.form&&Z_.forms[ch.gw.form];P.push(`날개 시술 · ${Pr.n}(생체 변형) · 방어구 말고는 장비를 쥘 수 없다 · 장비를 먹을수록 능력치가 오른다 (섭식 ${ch.gw.eaten||0}번 · 히든 ${ch.gw.hidden||0}/${Z_.hiddenNeed})`);if(F)P.push(`왕족 인자 · ${F.n} · ${F.e}`);else if(ch.gw.royal)P.push('왕족 인자가 깨어났다 · 다음 해에 해충황족으로 변할 수 있다')}
    if(ch.fate)P.push(`운명 · 모든 판정 +${CFG.nWing.fate} (사건 판정 · 전투 명중·회피) · 못 패시브 대신`);
    if(ch.oracle)P.push(`신탁대행자 · 지령 독촉 · 지령 스택 최대 ${CFG.oracle.presc} · 지령을 수행하지 못하면 다음 라운드 명중 −${CFG.oracle.missHit} · 회피 −${CFG.oracle.missEva}`);
    if(af==='약지'||ch.artSense)P.push(`예술적 감각 ${ch.artSense||0}/${CFG.artSense.max} · 선택지 판정 주사위 1d${E.checkDie(ch)}${af==='약지'?' · 적을 '+CFG.artSense.every+'번 쓰러뜨릴 때마다 +1 (영구)':''}`);
    if(ch.corp&&ch.corp.type&&['dev','wing'].includes(ch.corp.st)){const c=ch.corp,t=CFG.corp.types[c.type];
      P.push(`특이점 ${c.n} (${t.n}) · ${t.e.split(' (')[0]} · ${c.st==='dev'?`개발 ${c.stack}/${CFG.corp.devMax}`:`강화 ${c.up}/${CFG.corp.upMax} · 금기 실험 ${c.forb}/${CFG.corp.forbMax}`}`)}
    if(ch.colorPasv&&E.colorPasv[ch.colorPasv])P.push(`특색 패시브 · ${E.colorPasv[ch.colorPasv].n} · ${E.colorPasv[ch.colorPasv].e}`);
    if(ch.aff&&ch.aff.name==='W사 날개'){const WC=CFG.charge.orgs['W사 날개'];P.push(`W사 · 열차 충전 · 전투 시작 충전 ${WC.start} · 라운드마다 +${WC.round}(직급이 오르면 3~4) · 충전 ${WC.express.at} 이상일 때 쓰면 충전 소모 카드의 고정 피해 ×${WC.express.mul}(급행)`)}
    if(ch.race==='hyeolgwi')P.push(`혈귀 · 혈찬 · 상대의 출혈이 5번 발동할 때마다 HP ${CFG.hyeolchan.heal} 회복`);
    if(ch.race==='hyeolgwi'&&(ch.beaten||[]).includes('dulcinea'))P.push(`피에 각인된 갈망 · 자식 ${ch.kids||0}/${CFG.kids.max} · 라운드마다 혈찬 +${CFG.kids.per}×자식 · 전투가 끝나면 자식마다 ${CFG.kids.lose}% 흩어짐`);
    {const n=Math.floor((ch.lv||1)/CFG.lvLight.at);if(n>0)P.push(`레벨 ${CFG.lvLight.at}마다 · 전투 중 빛과 빛 최대치 +${CFG.lvLight.up*n} (지금 레벨 ${ch.lv})`)}
    for(const [k,t] of Object.entries(CFG.lake.loot))if(ch.flags&&ch.flags['lkL_'+k])P.push('고래 전리품 · '+t);
    if(ch.flags&&ch.flags.redMist)P.push('붉은 안개 · 적을 쓰러뜨리면 HP '+CFG.redMist.heal+' + 최대 HP의 '+Math.round(CFG.redMist.healPct*100)+'% 회복 · 미미크리 적중 '+CFG.redMist.gauge+'번 → 대절단 가로');
    if(ch.hw&&ch.hw.mission)P.push(`흑수 부하 · 카드를 쓸 때(적중마다) 데려온 순서대로 흑수 한 사람이 거든다 (피해 ${CFG.ink.follow}, 부하가 둘이면 한 사람당 +${CFG.ink.followPer} · 상대에게 수흔 +${CFG.ink.followInk}). 흑수가 둘이면 번갈아 거든다`);
    if(ch.hw&&ch.hwDan)P.push(`${CFG.hw.dan.name} · 가문의 강화 시술 · 전투 중 매 라운드 시작에 HP ${CFG.hw.dan.heal[ch.hwDan]} 회복`);
    if(ch.hwando)P.push(`섬봉광 검술 · 호흡 1당 치명 피해 +10% (최대 ${CFG.breath.hwandoCap})`);
    {const bb=E.bonCardB(ch);if(bb>0)P.push(`검술 강화 · 보냐텔리의 검 단계와 연차에 따라 전용 검술 카드 피해 +${bb}`)}
    if(ch.odin){if(ch.yeji||(ch.o&&ch.o.n==='보냐텔리 가문'))P.push(`가속하는 미래 · 보냐텔리 패시브 · 라운드마다 회피 ${CFG.odin.cycle.map(v=>v>0?'+'+v:v).join(' → ')} (마지막은 과부하) 반복`,`버프 · 예지안 · 오딘의 눈과 전용 검술의 시너지 · 전용 검술 카드 피해 +${CFG.odin.yeji}`);else if(ch.aff&&ch.aff.name==='중지')P.push(`버프 · 되갚음의 예지 · 전투 시작 되갚음 +${CFG.odin.midStart} · 라운드마다 첫 피격에 되갚음 +${CFG.odin.midHit} (회피 보정 없음)`);else P.push(`버프 · 순간의 예지 · 첫 라운드 회피 +${CFG.odin.first}, 이후 +${CFG.odin.after}`)}
    if(ch.resonance)P.push('궁니르 공명 · 궁니르 카드를 낸 라운드 받는 피해 −60%');
    return P.length?`<div class="passives">${P.map(t=>`<div class="mono small"><span style="color:var(--gold)">◆</span> ${esc(t)}</div>`).join('')}</div>`:'';
  }
  /* 무한 모드: 외곽에서 나만 어색하다는 짧은 글이 해마다 바뀌고, 천 살에 가까워질수록 넘치려는 쪽으로 간다 */
  function infNote(){const N=(G.ch&&G.ch.flags&&G.ch.flags.lake&&D.lake&&D.lake.infinite&&D.lake.infinite.notes)||D.infinite.notes,y=G.year||0,st=y<300?0:y<600?1:y<900?2:3,L=N[Math.min(st,N.length-1)];return L[y%L.length]}
  /* 무한 모드: 해가 바뀔 때 어긋난 글이 공지처럼 떠서 한동안 떨린다. 자동으로 넘기는 사람이 놓치지 않도록 떨림은 2초, 글은 약 20초 동안 남고(끝 2초에 흐려짐), ✕를 누르거나 다음 해의 글이 뜨거나 엔딩·첫 화면 등으로 넘어가면 바로 사라진다 (화면 클릭은 막지 않는다) */
  function showInfNote(text){
    try{const old=document.querySelector('.infnote');if(old)old.remove();const el=document.createElement('div');el.className='infnote';el.setAttribute('role','status');const tx=document.createElement('span');tx.textContent=text;el.appendChild(tx);const x=document.createElement('button');x.type='button';x.className='infnote-x';x.setAttribute('aria-label','닫기');x.textContent='✕';x.addEventListener('click',ev=>{ev.stopPropagation();el.remove()});el.appendChild(x);document.body.appendChild(el);setTimeout(()=>{try{el.remove()}catch(e){}},20200)}catch(e){}
  }
  function vHud(){
    const ch=G.ch,s=ch.stats,nx=E.xpNext(ch);
    return `<div class="panel stack">
      <div class="row between"><div class="row"><span class="swatch" style="background:${ch.color}"></span><b class="serif" style="color:${ch.color}">${titledName(ch)}</b><span class="small" style="color:${ch.color}">${E.rankLabel(ch)}</span>${affLabel(ch)}${ch.hard?'<span class="small bad">하드</span>':ch.easy?'<span class="small good">쉬움</span>':''}</div>
      <span class="mono small dim">${E.age(G)}세 · ${G.year>CFG.years?`${G.year}년차 · ${G.infinite&&G.year>CFG.years+CFG.endless.span*CFG.endless.grades.length?'제 2막 무한 모드 · '+(E.gradeRaw(G.year)-CFG.endless.grades.length+1)+'단계':'제 2막 · '+CFG.endless.grades[E.gradeAt(G.year)]}`:`${G.year}/${CFG.years}년차`}</span></div>
      ${bar(ch.hp,s.maxHp)}
      ${INFNOTE&&G.infinite&&ch.infinite&&D.infinite&&D.infinite.notes?`<div class="small dim" style="font-style:italic;line-height:1.55">${esc(infNote())}</div>`:''}
      ${vMind(ch)}${vShip(ch)}${egoBar(ch)}${G.infinite&&UI.screen!=='end'?`<button class="btn quiet" data-a="outerend">외곽에서 이야기를 끝낸다</button>`:''}
      ${vPassive(ch)}
      <div class="mono small dim hud-dup">HP ${ch.hp}/${s.maxHp} · 공격 ${sg(s.atk)} · 회피 ${evaNow(ch,s.eva)} · 속도 ${sg(s.spd)} · 판정 ${sg(s.check)} · 카드 ${ch.deck.length}장${shipTxt(ch)}</div>
      <div class="mono small dim hud-dup">Lv ${ch.lv} · 경험치 ${ch.xp}${nx!=null?'/'+nx:' (최고)'}${E.canPromote(ch)?` · ${E.ptsName(ch)} ${ch.pp||0}/${E.promoNeed(ch)}`:''} · ${Object.values(ch.gear).map(g=>esc(g.n)).join(' · ')}</div>
      <div class="row between"><span class="mono small" style="color:var(--gold)">자산 ${E.money(ch.money)}${G.lastIncome&&UI.showIncome?` <span class="dim">(올해 수입 +${E.money(G.lastIncome)})</span>`:''}</span>
        </div>
      ${vDock('dock-in')}
    </div>`;
  }
  /* ===== 6시즌: 가방 =====
     HUD 오른쪽의 네모 칸(능력치·장비·카드·전리품)을 누르면 가방을 열듯 화면이 펼쳐진다 */
  const ICON={supply:'<path d="M9 3h6M10 3v4l-4 6v6a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-6l-4-6V3"/><path d="M12 12v5M9.5 14.5h5"/>',family:'<path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.500-7 10-7 10z"/>',stat:'<path d="M4 20V11M10 20V4M16 20v-8M21 20H3"/>',gear:'<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/>',
    pack:'<rect x="5" y="9" width="14" height="12" rx="2"/><path d="M7 6h10M9 3h6M9 14h6M9 17.500h4"/>',
    card:'<rect x="3" y="7" width="12" height="14" rx="2"/><path d="M8 3h11a2 2 0 0 1 2 2v12"/>',relic:'<path d="M6 3h12l4 6-10 12L2 9zM2 9h20M9 3l3 6 3-6"/>',title:'<path d="M12 3l2.600 5.400 5.900.8-4.300 4.100 1 5.800L12 16.300 6.800 19.100l1-5.800L3.500 9.200l5.900-.8z"/>'};
  const icon=k=>`<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round" stroke-linecap="round" aria-hidden="true">${ICON[k]}</svg>`;
  /* 칭호칸: 직급·특색 칭호, 보스를 쓰러뜨려 얻은 추가 칭호, 루트의 표식(가주 후보 등) */
  const MARKNOTE={'가주 후보':'가주의 명으로 후계 경쟁에 나선 몸이다. 다른 후보들과 겨루게 된다.','홍원의 가주':'홍원의 가주 자리에 올랐다.'};
  const titleList=ch=>[...(ch.title?[[ch.title,'']]:[]),...(ch.titles||[]).map(t=>[t,'']),...(ch.marks||[]).map(m=>[m,MARKNOTE[m]||''])];
  /* 공유에 쓰는 칭호: 기본은 대표 칭호(c.title)이고, 결과 화면에서 지금까지 얻은 칭호 중 하나로 바꾸거나 뺄 수 있다 */
  const shTitles=c=>{const L=[];for(const [t] of titleList(c))if(t&&!L.includes(t))L.push(t);return L};
  const shTitle=c=>{if(UI.shareTitleFor!==c.seed||UI.shareTitle==null)return c.title||'';return UI.shareTitle};
  const eqTitle=ch=>ch.equipTitle&&titleList(ch).some(t=>t[0]===ch.equipTitle)?ch.equipTitle:'';
  const titledName=ch=>{const t=eqTitle(ch);return (t?`<span class="ctitle">[${esc(t)}]</span><br>`:'')+esc(ch.name||T.you)};
  const entName=X=>X.tt&&X.name.startsWith(`[${X.tt}] `)?`<span class="ctitle">[${esc(X.tt)}]</span><br>${ulName(X.name.slice(X.tt.length+3),X.ul)}`:ulName(X.name,X.ul);
  function bagTabs(ch){return [['stat','정보',''],['pack','카드팩',(ch.packs||[]).length?'보관 '+ch.packs.length:''],['gear','장비',(ch.stash||[]).length?'보관 '+ch.stash.length:''],['card','카드',ch.deck.length+'/'+E.deckMax(ch)],['relic','전리품',(ch.relics||[]).length?String(ch.relics.length):''],['supply','소모품',E.supplyCount(ch)?String(E.supplyCount(ch)):'']].concat([['title','칭호',titleList(ch).length?String(titleList(ch).length):'']]).concat(ch.bond&&['met','married','lost'].includes(ch.bond.st)?[['family','가족',ch.bond.st==='married'?'♥':'']]:[])}
  /* PC 넓은 화면(1360px 이상) 왼쪽 수치판: 기본 능력치를 숫자로 늘 보여 준다. 좁은 화면에서는 CSS로 숨긴다. 나중에 칸을 늘려 가기 쉽게 항목 목록으로 만든다 */
  /* 무한 모드의 연차 감소: 회피는 해마다 깎여 0에서 멈춘다. 표시도 깎인 뒤의 값으로 보이고, 깎인 양은 괄호로 알린다 */
  const shipTxt=ch=>ch.lake&&ch.lake.captain&&ch.flags&&ch.flags.lake?` · 배 ${E.hullOf(ch)}/${CFG.lake.hullMax}`:'';
  /* 수치 칸: 숫자가 길면(무한 모드 공격 등) 글자 크기를 줄이고 칸 안에서 줄을 바꿔 잘리지 않게 한다 */
  const fit=t=>{const n=String(t).length;return n<=5?'':` style="font-size:${n<=6?14:n<=7?12.5:n<=8?11:n<=9?10:9}px;overflow-wrap:anywhere"`};
  const evaNow=(ch,e)=>{const c=ch.infinite?E.infEvaCut(ch):0;return c>0?`${sg(e-c)} (무한 모드 −${c}${e-c<=0?' · 0에서 멈춤':''})`:sg(e)};
  function vSideL(P){
    const ch=G.ch,s=ch.stats,pad=(k,v)=>`<div class="srow"><span>${k}</span><b>${v}</b></div>`,up=n=>n?` <i class="bufup">${n>0?'+':'−'}${Math.abs(n)}</i>`:'';
    const rows=[['HP',P?`${Math.max(0,P.hp)}/${P.maxHp}`:`${ch.hp}/${s.maxHp}`],['정신력',ch.distForm?'???':`${ch.mind}/${E.mindMax(ch)}`],['공격',sg(s.atk)+(P?up(P.atk-s.atk):'')+(CFG.atkRule.on?` (명중+${Math.trunc((P?P.atk:s.atk)*CFG.atkRule.hitPer)} · 피해+${Math.floor(Math.max(0,P?P.atk:s.atk)/CFG.atkRule.dmgPer)})`:'')],...(s.hit?[['명중',sg(s.hit)]]:[]),['회피',evaNow(ch,s.eva)+(P?up((P.evaB||0)):'')],['속도',sg(s.spd)+(P?up(P.spd-s.spd):'')],['판정',sg(s.check)],['최소 피해',s.dmin],...(ch.lake&&ch.lake.captain&&ch.flags&&ch.flags.lake?[['배 내구도',E.hullOf(ch)+'/'+CFG.lake.hullMax]]:[]),...(s.dr?[['피해 감소',s.dr+'%']]:[]),...(E.regenTotal(ch)?[['HP 회복/라운드',E.regenTotal(ch)]]:[]),...(s.startBleed?[['시작 출혈',s.startBleed]]:[]),...(s.startBreath?[['시작 호흡',s.startBreath]]:[]),['카드',`${ch.deck.length}/${E.deckMax(ch)}`],['레벨',`Lv ${ch.lv}`],['경험치',E.xpNext(ch)!=null?`${ch.xp}/${E.xpNext(ch)}`:`${ch.xp} (최고)`],...(E.canPromote(ch)?[[E.ptsName(ch),`${ch.pp||0}/${E.promoNeed(ch)}`]]:[]),['자산',E.money(ch.money)]];
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
  function cardRow(id,acts,n){
    const ch=G.ch,c=D.cards[id],g_=E.cardGrade(ch.year,ch),wx_=ch.gear.weapon&&ch.gear.weapon.wx||null,ga=c.t==='atk'&&g_.n;
    return `<div class="invc" style="--kc:${KIND[cardKind(c)][1]}"><span class="cost">${c.c}</span><div class="stack" style="gap:3px;min-width:0"><div class="row" style="gap:6px">${kindBadge(c)}<b>${esc(c.n)}${ga?` <span style="color:var(--gold)">${g_.n}</span>`:''}</b>${n>1?`<span class="mono" style="color:var(--gold)">×${n}</span>`:''}</div>
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
    /* 같은 카드는 한 줄로 묶어 ×N으로 보여 준다 (버튼은 그중 한 장에 적용). 정렬: 획득순(원래 순서) · 코스트 · 이름 */
    const sk=(UI.cf&&UI.cf.s)||'got',grp=list=>{const m=new Map();list.forEach((id,i)=>{if(!cardMatch(D.cards[id]))return;const g=m.get(id);if(g)g.n++;else m.set(id,{id,i,n:1})});const a=[...m.values()];
      if(sk==='cost')a.sort((x,y)=>D.cards[x.id].c-D.cards[y.id].c||D.cards[x.id].n.localeCompare(D.cards[y.id].n,'ko')||x.i-y.i);else if(sk==='name')a.sort((x,y)=>D.cards[x.id].n.localeCompare(D.cards[y.id].n,'ko')||x.i-y.i);return a};
    const deck=grp(ch.deck),sd=grp(side);
    const out=can&&ch.deck.length>S.minDeck,inn=can&&E.deckRoom(ch);const xo=i=>UI.screen!=='combat'&&ch.deck.length>S.minDeck&&E.extraOut(ch,i);
    const dl=deck.map(({id,i,n})=>cardRow(id,out&&!D.cards[id].fixed?`<button class="chip" data-a="dout" data-i="${i}">카드함으로</button>`:xo(i)?`<button class="chip" data-a="dout" data-i="${i}">덱에서 빼기</button>`:D.cards[id].fixed?'<span class="small dim">전용 · 뺄 수 없다</span>':'',n)).join('')||'<p class="small dim">조건에 맞는 카드가 없다.</p>';
    const sl=sd.map(({id,i,n})=>cardRow(id,can?`${inn?`<button class="chip" data-a="din" data-i="${i}">덱에 넣기</button>`:''}${ch.cardMoney?'':`<button class="chip${UI.dropAsk===i?' warn':''}" data-a="sdrop" data-i="${i}">${UI.dropAsk===i?'정말 버린다':'버리기'}</button>`}`:'',n)).join('');
    return `<div class="row between"><span class="eyebrow">덱 ${ch.deck.length}/${E.deckMax(ch)}</span>${ch.deckLocked||ch.cardMoney?`<span class="small dim">${ch.deckLocked?'덱 고정':'전용 카드팩'} · 넣고 뺄 수 없다</span>`:''}</div><div class="invcards">${dl}</div>
      <div class="row between" style="margin-top:6px"><span class="eyebrow">카드함 ${side.length}</span>${side.length&&!inn&&can?'<span class="small dim">덱이 가득 찼다. 먼저 덱에서 빼야 넣을 수 있다</span>':''}</div>
      <div class="invcards">${sl||`<p class="small dim">${side.length?'조건에 맞는 카드가 없다.':'비어 있다. 덱에서 뺀 카드와 덱이 가득 찼을 때 얻은 카드가 여기에 모인다.'}</p>`}</div>`;
  }
  function vCards(){
    const f=UI.cf=UI.cf||{k:'all'};
    const kinds=[['all','전체'],['atk','공격'],['debuff','디버프'],['buff','버프'],['eva','회피'],['def','방어']];
    return `<p class="small dim">덱에는 최대 ${E.deckMax(G.ch)}장을 넣는다. 전투 밖이면 언제든 덱과 카드함 사이에서 카드를 옮길 수 있고, 덱은 ${CFG.shop.minDeck}장보다 줄일 수 없다.</p>
      <div class="seg kinds">${kinds.map(([k,n])=>`<button class="${(f.k||'all')===k?'on':''}" data-a="cfk" data-i="${k}"${KIND[k]?` style="--kc:${KIND[k][1]}"`:''}>${n}</button>`).join('')}</div>
      <div class="row" style="gap:6px;flex-wrap:wrap">${Object.keys(D.keywords).map(k=>`<button class="chip${f.kw===k?' on':''}" data-a="cfw" data-i="${k}" aria-pressed="${f.kw===k}" style="${f.kw===k?`background:${kwc(k)};color:var(--bg);font-weight:700;`:`color:${kwc(k)};`}border-color:${kwc(k)}">${f.kw===k?'✓ ':''}${D.keywords[k].n}</button>`).join('')}
        <input id="cardq" value="${esc(f.q||'')}" placeholder="카드 이름 찾기" autocomplete="off" style="flex:1;min-width:8em"></div>
      <div class="row" style="gap:6px;align-items:center"><span class="small dim">정렬</span><div class="seg" style="flex:1">${[['got','획득순'],['cost','코스트'],['name','이름']].map(([k,n])=>`<button class="${(f.s||'got')===k?'on':''}" data-a="cfs" data-i="${k}">${n}</button>`).join('')}</div></div>
      <div class="stack" style="gap:8px" id="cardlist">${cardListHtml()}</div>`;
  }
  const FXN={maxHp:'최대 HP',atk:'공격',hit:'명중',eva:'회피',spd:'속도',check:'판정',dmin:'피해 최소',dr:'피해 감소(%)',regen:'라운드마다 HP 회복',die:'피해 주사위',dmgB:'피해',burnHit:'붉은 화염',startBleed:'시작 출혈',startBreath:'시작 호흡',defUp:'방어 회피',extraD2:'추가 피해'};
  function fxDiff(nw,old){
    const a=nw.fx||{},b=(old&&old.fx)||{};
    return [...new Set([...Object.keys(a),...Object.keys(b)])].filter(k=>FXN[k]&&(a[k]||0)!==(b[k]||0))
      .map(k=>`<span class="${(a[k]||0)>(b[k]||0)?'good':'bad'}">${FXN[k]} ${sg((a[k]||0)-(b[k]||0))}</span>`).join(' · ');
  }
  function vGear(){
    const ch=G.ch,st=ch.stash||[],cbt=UI.screen==='combat';
    const eq=Object.entries(D.slots).map(([k,n])=>{const g=ch.gear[k],w=E.slotWhy(ch,k);return `<div class="invr"><span>${n}</span><b>${g?esc(g.n):k==='weapon'?'맨손':'<span class="dim">없음</span>'}</b><span class="mono small" style="color:var(--gold)">${g?esc(g.e||''):''}</span>${g&&g.lore?`<span class="small dim" style="grid-column:1/-1;font-style:italic;line-height:1.6">${esc(g.lore)}</span>`:''}${w?`<span class="small bad" style="flex-basis:100%">🚫 ${esc(w)}</span>`:''}</div>`}).join('');
    /* 보관함 분류: 전체 · 무기 · 방어구 · 의수. 전체에서는 칸 순서(무기→방어구→의수)로 묶어 보여 준다 (장착·재료 번호는 그대로) */
    const slotKeys=Object.keys(D.slots),gt=UI.gTab&&slotKeys.includes(UI.gTab)?UI.gTab:'all',cnt=k=>st.filter(g=>g.slot===k).length;
    const order=st.map((g,i)=>i).filter(i=>gt==='all'||st[i].slot===gt).sort((a,b)=>slotKeys.indexOf(st[a].slot)-slotKeys.indexOf(st[b].slot)||a-b);
    const gtabs=st.length?`<div class="seg" style="margin:6px 0">${[['all','전체',st.length],...slotKeys.map(k=>[k,D.slots[k],cnt(k)])].map(([k,n,c])=>`<button class="${gt===k?'on':''}" data-a="gtab" data-i="${k}">${n} ${c}</button>`).join('')}</div>`:'';
    const sl=order.map(i=>{const g=st[i],cur=ch.gear[g.slot],df=fxDiff(g,cur);
      return `<div class="invr stash"><span>${D.slots[g.slot]}</span><div class="stack" style="gap:2px;min-width:0"><b>${esc(g.n)}</b><span class="mono small" style="color:var(--gold)">${esc(g.e||'')}</span>${df?`<span class="mono small">지금 장비보다 · ${df}</span>`:''}</div>
        ${cbt?'<span class="small dim">전투 중 교체 불가</span>':E.equipWhy(ch,g)?`<span class="small bad">${esc(E.equipWhy(ch,g))}</span>`:`<button class="chip" data-a="eqs" data-i="${i}">장착</button>`}${ch.gw&&ch.gw.proc&&!cbt?`<button class="chip warn" data-a="geats" data-i="${i}">먹는다${(g.grade||0)>=5?' (히든)':''}</button>`:''}</div>`}).join('');
    const w=ch.gear.weapon,need=E.bonNeed(ch);
    const up=w&&(w.id==='bonatelli'||w.id==='star')?`<div class="panel stack" style="gap:6px;border-color:var(--gold)"><div class="row between"><b class="serif">${esc(w.n)}</b><span class="mono" style="color:var(--gold)">강화 ${w.lvl}/${w.id==='star'?CFG.star.max:CFG.bon.max}</span></div>
      ${need==null?'<p class="small dim">최대로 강화했다.</p>':`<p class="small">보관함의 장비 하나를 녹여 한 단계 강화한다. 다음 단계 재료 · ${need?need+'등급 이상':'아무 장비'}${need>=5?' (유물·히든 장비)':''}</p>
        <p class="mono small">다음 단계 · ${esc(E.upItem(w,w.lvl+1).e)}</p>
        ${cbt?'<p class="small dim">전투 중에는 강화할 수 없다.</p>':st.map((g,i)=>(g.grade||0)>=need&&!(g.id==='birth'&&g.n==='맨손')?`<button class="chip${UI.bonAsk===i?' warn':''}" data-a="bonup" data-i="${i}">${UI.bonAsk===i?'정말 '+esc(g.n)+'을(를) 녹인다':esc(g.n)+' 재료로 쓰기'}</button>`:'').join(' ')||'<p class="small dim">재료로 쓸 수 있는 장비가 보관함에 없다.</p>'}`}</div>`:'';
    const lv_=w&&['laev_sealed','laev_s1','laev_s2','laev'].includes(w.id)?w:null,LS=CFG.laev.stages,ln=(ch.laevN||0),lnx=LS.find(x=>ln<x.at);
    const lp=lv_?`<div class="panel stack" style="gap:6px;border-color:var(--gold)"><div class="row between"><b class="serif">레바테인</b><span class="mono" style="color:var(--gold)">붉은 화염 ${ln}회</span></div>
      <p class="small">${lnx?`다음 단계 · ${esc(lnx.n)}까지 ${lnx.at-ln}번 남았다 (${ln}/${lnx.at})`:'해방을 마쳤다.'}</p>
      <p class="small dim">붉은 화염을 건 횟수는 영구히 쌓인다. 단계가 올라 무기가 바뀌어도 쌓은 횟수와 공방에서 한 정비(공격·회피 강화)는 그대로 이어진다.</p></div>`:'';
    return `${UI.eatMsg?`<p class="good small">${esc(UI.eatMsg)}</p>`:''}<div><span class="eyebrow">장착 중</span>${eq}</div>${lp}${up}
      <div><span class="eyebrow">보관함 ${st.length}</span>${gtabs}${sl||(st.length?'<p class="small dim">이 분류에는 장비가 없다.</p>':'<p class="small dim">보관함이 비어 있다. 새 장비를 얻으면 장착할지 보관할지 고를 수 있고, 장착하면 이전 장비가 여기로 온다.</p>')}</div>
      ${st.length?`<p class="small dim">장착을 누르면 같은 칸의 지금 장비와 자리를 바꾼다. 아무것도 사라지지 않는다.</p>`:''}`;
  }
  /* 태어난 곳: 출신에서 정해진다. 날개 글자(K·R·W·N·J·G)와 둥지·뒷골목·외곽으로 적는다. 이미 굴린 값(r.n)으로만 정해 시드를 흔들지 않는다 */
  function placeOf(o,r,blank){if(blank||!o)return null;const n=o.n,w='KRWNJG'[((r&&r.n)||1)%6];
    if(n==='외곽 생존자'||n==='동부 출신 외곽 생존자')return {n:'외곽 출신',t:'도시 밖 외곽에서 났다'};
    /* 세계관상 날개가 정해진 출신은 고정한다 (R사 복제 부화장, H사 홍원) */
    if(n==='부화장에서 태어난 자')return {n:'R사 둥지 출신',t:'R사 날개의 부화장에서 났다'};
    if(n==='홍원의 자제')return {n:'H사 둥지 출신',t:'H사 홍원의 가문에서 났다'};
    if(n==='E.G.O 적성자')return {n:'L사 둥지 출신',t:'L사 날개의 둥지에서 났다'};
    if(n==='대호수로 나간 자')return {n:'U사 둥지 출신',t:'U사 날개의 둥지에서 났다'};
    if(n==='혈귀'||n==='별에 선택받은 자')return {n:'출신 불명',t:'어디서 났는지 아무도 모른다'};
    if(n==='도서관의 손님'||n==='유물 적성자'){const k=((r&&r.f)||1)%3;   // 둥지·뒷골목·외곽 중 하나 (굴린 값으로 정함)
      return k===0?{n:'외곽 출신',t:'도시 밖 외곽에서 났다'}:k===1?{n:`${w}사 둥지 출신`,t:`${w}사 날개의 둥지에서 났다`}:{n:`${w}사 뒷골목 출신`,t:`${w}사 날개 둥지의 뒷골목에서 났다`}}
    if(n==='보냐텔리 가문')return {n:'둥지 가문 출신',t:'둥지에 뿌리를 둔 가문에서 났다'};
    if(n==='조율자')return {n:'A사 머리 출신',t:'A사 머리에서 조율자로 길러졌다'};
    if(n==='머리의 발톱')return {n:'C사 발톱 출신',t:'C사 발톱으로 길러졌다'};
    if(n==='뒷골목 태생'||n==='조직 출신')return {n:`${w}사 뒷골목 출신`,t:`${w}사 날개 둥지의 뒷골목에서 났다`};
    if(['평범한 둥지 시민','둥지 노동자','날개 직원 집안','몰락한 가문'].includes(n))return {n:`${w}사 둥지 출신`,t:`${w}사 날개의 둥지에서 났다`};
    return null}
  /* 가방 정보 칸의 접이식 구역: 열고 닫은 상태는 다시 그려도 유지한다 */
  const stSec=(k,title,body,openDef)=>{const o=(UI.stOpen||{})[k];const open=o===undefined?!!openDef:!!o;return `<details class="stsec panel" data-k="${k}"${open?' open':''} style="padding:8px 10px"><summary style="cursor:pointer"><span class="eyebrow">${title}</span></summary><div class="stack" style="gap:6px;margin-top:8px">${body}</div></details>`};
  /* 성장기 이야기: 출신별 4줄(5·9·13·16세)이 줄 본문이고, 굴림 결과(이름과 효과)는 그 아래 작은 줄로 붙는다. 같은 결과가 여러 번 나와도 줄거리는 겹치지 않는다 */
  /* 같은 결과가 여러 번 나오면 줄마다 '이번에도 · 또다시 · 끝내'로 이어 쓰고, 끝에 요약 한 줄을 붙인다 */
  const kidRep=(kid,i)=>{const n=kid[i].x.n;let c=0;for(let j=0;j<=i;j++)if(kid[j].x.n===n)c++;return {c,tot:kid.filter(k=>k.x.n===n).length}};
  const kidLabel=(kid,i)=>{const r=kidRep(kid,i),n=kid[i].x.n;let st=1;while(i-st>=0&&kid[i-st].x.n===n)st++;const w=r.tot>1&&r.c>1?(st>1?['','이번에도 ','또다시 ','끝내 '][Math.min(st-1,3)]:'다시 '):'';return `${w}${n}${r.tot>1?` ×${r.c}`:''}`};
  const kidSum=kid=>{const seen=new Set(),out=[];kid.forEach((k,i)=>{const r=kidRep(kid,i);if(r.tot>=2&&!seen.has(k.x.n)){seen.add(k.x.n);out.push(r.tot>=kid.length?`네 번을 모두 「${k.x.n}」으로 채웠다. 몸이 그 하나만 기억한다. (효과가 ${r.tot}번 그대로 쌓인다)`:`「${k.x.n}」을(를) ${r.tot}번 되풀이했다. (효과가 ${r.tot}번 쌓인다)`)}});return out.length?`<p class="small" style="margin:6px 0 0;border-left:2px solid var(--gold);padding-left:10px;line-height:1.6">${esc(out.join(' '))}</p>`:''};
  /* 성장기 문장: 결과(태그)마다 시기별 문장(5세 놀이 · 9세 동네 · 13·16세 일)이 있고, 출신의 장소(place)로 바뀐다. 전용표 출신의 고유 결과는 원래 설명을 쓴다 */
  const kidStory=(o,i,x)=>{const P=o&&D.prologue&&D.prologue[o.n],T=x&&D.childhoodTale&&D.childhoodTale[x.n];if(P&&P.place&&T&&T[i])return T[i].replace(/\{a\}/g,P.place.a).replace(/\{b\}/g,P.place.b).replace(/\{w\}/g,P.place.w);return x&&x.t||''};
  function vStat(){
    const ch=G.ch,s0=ch.s0,sgn=n=>(n>0?'+':n<0?'−':'')+Math.abs(n);
    const eff=x=>x&&x.e?`<span class="mono small" style="color:var(--gold)">${esc(x.e)}</span>`:'';
    const row=(lab,x)=>`<div class="roll"><span class="mono small dim">${lab}</span><div class="n"><b>${esc(x.n)}</b>${x.t?`<span>${esc(x.t)}</span>`:''}${eff(x)}</div></div>`;
    const place=placeOf(ch.o,ch.r,ch.blank);
    const lk_=ch.flags&&ch.flags.lake&&ch.lake?ch.lake:null,lakeLog=lk_?(()=>{const K=lk_.killed||[],ny=K.filter(x=>x.startsWith('lake_ywhale_')).length,na=K.filter(x=>x.startsWith('lake_whale_')).length,cr=(lk_.crew||[]).map(m=>m.n).join(' · ')||'없음',tl=lk_.tools||{},tn=Object.entries(tl).filter(([,v])=>v>0).map(([k,v])=>`${(D.lake&&D.lake.tools&&D.lake.tools[k]||{}).n||k} ×${v}`).join(' · ')||'없음';
      return stSec('lake','항해 기록 · 배 내구도',`<div class="invr"><span>지나온 호수</span><b class="mono">${lk_.seen||0}번</b></div><div class="invr"><span>고래에게서 도망</span><b class="mono">${lk_.fled||0}번</b></div>${lk_.captain?`<div class="invr"><span>목표 · 대재앙 토벌</span><b class="mono">보스급 ${ny}/4 · 대재앙 ${na}/6</b></div><div class="invr"><span>배 내구도</span><b class="mono">${E.hullOf(ch)}/${CFG.lake.hullMax}</b></div><p class="small dim">전투마다 -${CFG.lake.hullWear} · 항구에서 ${E.money(CFG.lake.repairCost)} 수리 · 0이 되면 침몰</p><div class="invr"><span>선원</span><b class="mono">${esc(cr)}</b></div>`:'<p class="small dim">선장이 되면 대재앙 토벌이 목표가 된다.</p>'}`,false)})():'';
    const kid=(place?row('태어난 곳',place):'')+(ch.kid||[]).map((k,i)=>{const st=kidStory(ch.o,i,k.x);return st?`<div class="roll"><span class="mono small dim">${k.age}세</span><div class="n"><span style="font-style:italic;line-height:1.6">${esc(st)}</span><span class="mono small" style="color:var(--gold)"><b>${esc(kidLabel(ch.kid,i))}</b> · ${esc(k.x.e)}</span></div></div>`:row(k.age+'세',k.x)}).join('')+kidSum(ch.kid||[]);
    const base=s0?[['최대 HP',s0.maxHp],['공격',sgn(s0.atk)],['회피',sgn(s0.eva)],['속도',sgn(s0.spd)],['사건 판정',sgn(s0.check)]].map(([a,b])=>`<div class="invr"><span>${a}</span><b class="mono">${b}</b></div>`).join(''):'';
    return `<div class="stack" style="gap:10px"><h2>${esc(ch.name||T.you)}는 이렇게 태어났다</h2>
      ${ch.blank?'<p class="small dim">출신 · 재능 · 결점 · 무기 없이 성장기 보정만 가지고 태어났다. 빈손이라 히든 보스 전리품 장비를 더 자주 쥐고(+25%p), 정신이 꺾일 때 E.G.O 형상이 보일 확률이 25%다.</p>':`<div class="panel">${row('출신',ch.o)}${row('재능',ch.t)}${row('결점',ch.f)}${ch.egoUses!=null&&ch.o&&ch.o.egoWeapons?(()=>{const w=[ch.gear.weapon,...(ch.stash||[])].find(x=>x&&x.egoLv!=null);return row('무기',w?{n:'E.G.O · '+w.n,t:'환상체에게서 얻은 무기',e:w.e}:ch.w)})():row('무기',ch.w)}</div>`}
      ${(()=>{const g=E.infGrowth(ch);return g.length?`<div class="eyebrow">무한 모드 성장</div><div class="panel stack" style="gap:6px">${g.map(([k,v,d_])=>`<div class="invr"><span>${esc(k)}</span><b class="mono">${esc(v)}</b></div><p class="small dim" style="margin:0 0 4px">${esc(d_)}</p>`).join('')}</div>`:''})()}
      ${lakeLog}${kid?stSec('kid','성장기',kid,false):''}
      ${base?stSec('base','태어났을 때의 능력치 (변하지 않음)',base,false):''}
      ${stSec('now','지금 · 장비 보정과 특수 상태',vStatNow(),true)}</div>`;
  }
  function vStatNow(){
    const ch=G.ch,s=ch.stats,gear=Object.values(ch.gear);
    const gsum=k=>gear.reduce((a,g)=>a+((g.fx||{})[k]||0),0);
    const row=(l,v,k)=>{const g=k?gsum(k):0;return `<div class="invr"><span>${l}</span><b class="mono">${v}</b><span class="mono small dim">${g?'장비 '+sg(g):''}</span></div>`};
    return `<div>${[row('최대 HP',s.maxHp,'maxHp'),row('공격 (명중 +½ · 피해 6마다 +1, 소수점 버림)',sg(s.atk),'atk'),row('명중',sg(s.hit||0),'hit'),row('회피',evaNow(ch,s.eva),'eva'),row('속도 (순서 보정)',sg(s.spd),'spd'),
      row('사건 판정',sg(s.check),'check'),row('1d6 최소치',s.dmin+(s.dmin>=CFG.dminCap?' (최대)':''),null),...(s.dr?[row('피해 감소',s.dr+'%',null)]:[]),...(E.regenTotal(ch)?[row('라운드마다 HP 회복',E.regenTotal(ch)+(()=>{const r=E.regenParts(ch),t=[r.absorb&&`흡수 코어 ${r.absorb}`,r.dan&&`단약 ${r.dan}`,r.serum&&`혈청 ${r.serum}`].filter(Boolean);return t.length?` (${t.join(' · ')} 포함)`:''})(),null)]:[]),row('전투 시작 출혈',s.startBleed,null),row('전투 시작 호흡',s.startBreath,null),
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
    return (ch.relics||[]).length?`<div>${ch.relics.map(n=>{const e=Object.values(D.enemies).find(x=>x.drop&&x.drop.n===n),r=Object.values(D.relics||{}).find(x=>x.n===n),nt=(D.relicNotes||{})[n]||((n.startsWith('의안 · ')||n.startsWith('신체 개조 · '))&&ch.custNote?ch.custNote:'')||(n.startsWith('성도 · ')&&ch.seongNote?ch.seongNote.replace(/^[^·]*· /,''):'');return `<div class="invr rel"><span>${esc(n)}</span><b class="mono" style="color:var(--gold)">${e?esc(e.drop.e):r?esc(r.e):nt?esc(nt):''}</b></div>`}).join('')}</div>`:'<p class="small dim">아직 전리품이 없다. 숨은 보스를 이기면 얻는다.</p>';
  }
  function sheet(inner,cls,closable){
    return `<div class="ov"><div class="ovbg"${closable?' data-a="bagclose"':''}></div><div class="sheet ${cls}" role="dialog" aria-modal="true">${inner}</div></div>`;
  }
  /* 도움말(카드·키워드·규칙): 전투 중에도 열어 볼 수 있는 읽기 전용 창 */
  const HELPTABS=[['card','카드 읽는 법'],['kw','키워드'],['rule','규칙']];
  function kwDoc(){
    const K=D.keywords,N=CFG.nail.stages.map(g=>`${g.at}: 명중 −${g.hit}${g.dmg?` · 주는 피해 −${g.dmg}`:''}`).join(' / ');
    return [
      [K.bleed.n,'bleed',`최대 ${CFG.stackCap}스택(내가 적에게 거는 출혈은 ${CFG.bleedMax}스택). 공격할 때마다(빗나가도) 스택만큼 피해를 입고, 그 뒤 1 줄어든다. 내가 방어 자세면 절반으로 지혈한다.`],
      [K.rupture.n,'rupture',`최대 ${CFG.rupture.max}스택. 피격 시 스택만큼 추가 피해를 입고, 피격마다 1 줄어든다.`],
      [K.breath.n,'breath',`최대 ${CFG.breath.cap}(검계는 ${CFG.syn['검계'].cap}), 라운드마다 ${CFG.breath.decay} 줄어든다. 4~9는 치명 ${CFG.breath.base}%에서 90%까지(×${CFG.critMult}), ${CFG.breath.sure} 이상은 확정 치명, 1~${CFG.breath.evaMax}는 회피 +${CFG.breath.eva}.`],
      [K.ink.n,'ink',`라운드가 끝날 때 스택당 ${CFG.ink.dmg} 피해(내가 받으면 ${CFG.ink.dmgMe}), 그 뒤 스택이 절반으로 줄어든다. 최대 ${CFG.ink.cap}스택.`],
      [K.burn.n,'burn',`라운드가 끝날 때 스택당 ${CFG.burn.dmg} 피해(내가 받으면 ${CFG.burn.dmgMe}), 그 뒤 스택이 절반으로 줄어든다. 최대 ${CFG.burn.max}스택. 적이 거는 화상은 쌓이는 양이 절반이다.`],
      [K.flame.n,'flame',`(레바테인 전용) 최대 ${CFG.stackCap}스택. 받는 피해 ×1.5, 라운드 끝에 1 감소. ${CFG.laev.blueAt}스택 이상이면 푸른 화염이 되어 받는 피해 ×${CFG.laev.blueMul}, 라운드 끝에 스택당 ${CFG.laev.blueDot} 피해를 주고 1 감소한다.`],
      [K.charge.n,'charge',`자신에게 쌓는 스택. 기본 최대 ${CFG.charge.cap}스택(소속마다 다르다: R사 토끼팀 8, 순록·코뿔소팀 20). 카드가 정한 만큼 소모하면, 소모한 1당 고정 피해(피해 감소 무시, 보호막은 깎임)를 적중마다 더한다. 라운드가 바뀌어도 줄지 않고, 맞으면 줄어든다. 쌓이는 방식도 소속마다 다르다.`],
      [K.sink.n,'sink',`상대에게 쌓는 스택. 최대 ${CFG.stackCap}스택. ${CFG.sink.per}스택마다 한 단계, 단계마다 침잠이 걸린 쪽의 명중 −${CFG.sink.hit} · 주는 피해 −${CFG.sink.dmg}. 라운드마다 1 줄어든다.`],
      [K.wspear.n,'wspear','쪽빛 노인의 작살(전용 무기)이 적중하면 상대에게 쌓인다. 최대 5스택. 스택 하나마다 상대가 입는 출혈 피해가 ×1.2로 곱해진다(5스택이면 약 ×2.5). 한 번의 싸움 동안 유지된다.'],
      [K.harpoon.n,'harpoon',`대호수: 작살 카드가 적중하면 상대에게 쌓인다. 최대 ${CFG.harpoon.cap}스택. 당기는 카드(감아올리기·당겨 뜯기·고래 사냥)가 쌓인 작살을 모두 소모해 스택당 고정 피해를 더한다. 로프 끊기는 내게 걸린 작살을 푼다.`],
      [K.nail.n,'nail',`N사 날개: 적중할 때마다 상대에게 쌓인다. 최대 ${CFG.nail.cap}스택. 망치 카드가 쌓인 못을 흐트러짐으로 바꾼다.`],
      [K.stagger.n,'stagger',`쌓일수록 상대가 약해진다. 최대 ${CFG.nail.staggerCap}스택. ${N}. 주는 피해는 줄고 받는 피해는 늘며, 기준을 넘으면 기절한다.`],
      [K.obey.n,'obey',`최대 ${CFG.hw.obey.cap}스택. 내 명중 −${CFG.hw.obey.hit}(스택당) · 흑수 부하가 거들 때마다 −1.`],
      ['기절','','이번 라운드 행동 불가, 회피 0.'],
      ['스택 상한','',`위에 따로 적지 않은 스택의 최대치는 ${CFG.stackCap}이다. 최대치를 넘겨 쌓으면 넘친 만큼은 사라진다. 방어 카드를 내면 내 출혈·파열이 1/4 줄어든다(적도 같다).`]
    ];
  }
  function ruleDoc(){
    return [['명중','1d100 + 공격 + 카드 보정 > 상대 1d100 + 회피면 명중, 동점은 방어 성공. 일부 카드·무기는 명중을 두 번 굴려 높은 값을 쓴다.'],
      ['피해','카드의 d6 개수만큼 굴려 합산한다. 코스트가 높은 카드는 주사위가 많다.'],
      ['순서',`라운드마다 1d100 + 속도×${CFG.spdMul}. 1등은 빛 +${CFG.orderBonusLight}, 격차 ${CFG.gapFirst} 이상이면 첫 공격 명중 +${CFG.firstHit}. 뒤처지면 다음 라운드 순서 +${CFG.catchupBonus}.`],
      ['방어 자세',`카드를 하나도 내지 않으면 그 라운드는 회피 대신 방어로 받는다. 막으면 피해 ${CFG.guard.guardHit}, 못 막으면 피해 ×${CFG.guard.guardFailMul}.`],
      ['빛',`라운드마다 ${CFG.light}. 남은 빛으로 손패 카드를 원하는 순서로 낸다. 남긴 빛은 사라진다.`]];
  }
  /* 카드 읽는 법: 카드 한 장이 어떤 순서로 풀리는지와 카드 문구의 표기를 설명한다 */
  function cardGuide(){
    const G_=CFG.cardGrade.slice(1).map(g=>`${g.n}(${g.from}년차~ 피해 +${g.b} · 명중 +${g.hit}${g.dice?' · 주사위 +'+g.dice:''})`).join(' / ');
    const rows=[
      ['카드 한 장의 흐름','① 빛(왼쪽 숫자)을 내고 카드를 낸다 → ② 명중 굴림: 1d100 + 명중(공격의 절반, 소수점 버림 + 명중 스탯) + 카드 명중 보정이 상대 1d100 + 회피보다 크면 적중 → ③ 적중하면 피해 주사위를 굴린다 → ④ 같은 적중에 "적중 시" 효과가 붙는다(키워드 스택·보호막 등) → ⑤ 흑수 부하·전용 무기가 있으면 그 효과가 이어진다. 빗나가면 ③~⑤는 일어나지 않는다.'],
      ['○타','"(2d6+3) × 3타"는 괄호 안(주사위 2개를 굴려 3을 더한 피해)을 3번 따로 반복한다 (②~⑤를 3번 반복). 명중 굴림도, 피해 주사위도 타마다 새로 굴린다. 출혈이 걸린 쪽은 타마다 피해를 입으므로, 타수가 많은 카드를 낼수록 출혈이 빨리 닳는다.'],
      ['6d8 · 3d6 표기','"6d8"은 8면체 주사위 6개를 굴려 합친다는 뜻이다. "3d6"은 6면체 3개. 앞 숫자가 개수, 뒤 숫자가 면 수다. 개수가 많을수록 결과가 평균 근처로 모이고, 면 수가 클수록 눈의 폭이 커진다. 면 수를 적지 않은 카드는 6면체다.'],
      ['+N (피해 뒤 고정값)','"2d4+2"의 +2는 주사위를 합친 값에 더하는 고정 피해다.'],
      ['1d6 최소치 N',`장비·타고난 것에 쓰인 표기다. 1d6의 눈이 N보다 작게 나오면 N으로 친다(예: 1d6 최소치 2면 1이 나와도 2). 카드의 "2d6" 같은 주사위도 주사위 한 개마다 눈이 N보다 작게 나오면 N으로 친다. 타수와는 상관없다. 여러 곳에서 오는 보정을 합쳐도 최대 ${CFG.dminCap}까지다.`],
      ['명중 +N / 명중 2회 굴림','카드의 "명중 +N"은 그 카드의 명중 굴림에만 더해지는 값이다(마이너스면 빗나가기 쉽다). "명중 2회 굴림"은 명중 굴림을 두 번 해서 높은 쪽을 쓴다.'],
      ['적중 시 ○○','명중 굴림에 이겼을 때만 일어나는 효과다. 색이 있는 칩이 키워드이고, "출혈 +2"처럼 상대에게 쌓이는 것이 기본이다. 칩 끝에 "자신"이 붙은 것(예: 호흡 +3 자신)은 나에게 쌓인다.'],
      ['보호막 · 회피 · 방어 카드','방어 카드의 "회피 +N"은 이번 라운드 상대의 명중 굴림에 맞서는 내 수치에 더해진다. 보호막은 체력 앞에서 피해를 대신 맞아 주는 수치다. 버프 카드는 피해를 주지 않고 나에게 효과를 건다.'],
      ['카드 종류 배지','카드 이름 앞의 작은 표시다. 공격은 피해 주사위를 굴리는 카드, 회피는 이번 라운드 회피를 올리는 카드, 방어는 보호막을 세우는 카드, 버프는 나에게 효과를 거는 카드, 디버프는 상대에게 키워드를 거는 카드다.'],
      ['빛과 손패',`라운드마다 빛 ${CFG.light}(최대 ${CFG.lightMax}까지 늘어난다)이 주어지고, 손패 ${CFG.hand}장에서 빛이 남는 한 원하는 순서로 낸다. 남긴 빛은 사라진다. 카드를 하나도 내지 않으면 방어 자세다.`],
      ['1d4~10 같은 범위 표기','주사위 면이 아니라 4부터 10 사이의 값 중 하나가 같은 확률로 나온다는 뜻이다.'],
      ['사용 제한','"연속 사용 불가"는 바로 다음 라운드에 다시 낼 수 없는 카드다. "전투당 1회"는 한 전투에서 한 번만 낸다. "사용 후 다음 라운드 ○○"는 그 카드를 낸 다음 라운드에 ○○ 카드가 손패로 들어온다.'],
      ['빛 외의 비용','"정신력 N 소모"나 "HP N을 바쳐"가 적힌 카드는 빛과 함께 그 비용을 낸다.'],
      ['이름 옆 +1 · +2 · +3 (등급)','공격 카드에 연차가 지나며 붙는 강화다. '+G_+'. 보호막이 있는 카드도 등급이 오르면 보호막이 늘어난다.']
    ];
    return `<div class="panel stack" style="gap:8px"><b style="color:var(--gold)">카드 읽는 법</b>${rows.map(([n,x])=>`<div class="stack" style="gap:2px"><b class="small">${esc(n)}</b><span class="small dim">${esc(x)}</span></div>`).join('')}</div>`;
  }
  function vHelp(){
    const t=UI.help==='kw'||UI.help==='rule'?UI.help:'card';
    let body='';
    if(t==='card'){
      body=cardGuide();
    }else if(t==='kw'){
      body=`<p class="small dim">카드의 키워드와 걸리는 상태의 뜻이다.</p>`+kwDoc().map(([n,k,x])=>`<div class="panel stack" style="gap:3px;padding:10px 12px"><b style="color:${k?kwc(k):'var(--gold)'}">${esc(n)}</b><span class="small">${esc(x)}</span></div>`).join('');
    }else{
      body=ruleDoc().map(([n,x])=>`<div class="panel stack" style="gap:3px;padding:10px 12px"><b style="color:var(--gold)">${esc(n)}</b><span class="small">${esc(x)}</span></div>`).join('');
    }
    return sheet(`<div class="row between" style="flex-wrap:nowrap;gap:8px;flex:none"><b class="serif">설명</b><button class="chip" data-a="bagclose">닫기 ✕</button></div>
      <div class="seg" style="margin:8px 0;flex:none;min-height:44px">${HELPTABS.map(([k,n])=>`<button class="${t===k?'on':''}" data-a="helptab" data-i="${k}">${n}</button>`).join('')}</div>
      <div class="stack" style="gap:8px;flex:none">${body}</div>`,'bag',true);
  }
  /* 카드팩 보관함: 덱이 통째로 바뀐 적이 있으면 이전 팩이 여기에 남는다. 해마다 한 번 바꿔 끼운다 */
  function vPacks(){
    const ch=G.ch,ps=ch.packs||[],msg=UI.packMsg;UI.packMsg='';
    const chips=ids=>{const cnt={};ids.forEach(id=>{if(D.cards[id])cnt[id]=(cnt[id]||0)+1});return `<div class="chips">${Object.keys(cnt).map(id=>`<span class="chip">${esc(D.cards[id].n)}${cnt[id]>1?' ×'+cnt[id]:''}</span>`).join('')}</div>`};
    const flag=(l,c)=>l?`<span class="mono small dim">${c?'덱 고정 · ':''}${c?'새 카드는 돈으로 받는다':'카드를 지우고 옮길 수 있다'}</span>`:'';
    const rn=(i,nm)=>`<div class="row" style="gap:6px;flex-wrap:nowrap"><input id="pkn${i<0?'a':i}" value="${esc(nm)}" maxlength="10" autocomplete="off" aria-label="카드팩 이름" style="flex:1;min-width:0;background:var(--panel2);color:var(--fg);border:1px solid var(--line2);border-radius:5px;padding:8px 10px;font:inherit"><button class="chip" data-a="packrn" data-i="${i}">이름 저장</button></div>`;
    const why={busy:'받을 카드·장비를 먼저 고른다.',no:'지금은 바꿀 수 없다.'};
    return `<p class="small dim">기본 카드팩 3개(기본 4장으로 시작, 이름을 바꿀 수 있다)와 출신 카드팩이 여기 보관된다. 덱이 통째로 바뀌는 전용 카드팩을 받으면 이전 덱도 여기에 남는다. 보상으로 얻은 카드는 편집할 수 있는 모든 팩에 복사되고, 출신·소속 전용 카드는 그 전용 팩에만 들어간다. E.G.O 같은 고정 카드는 모든 팩에 자동으로 들어간다. 전투 밖에서는 횟수 제한 없이 바꿔 끼울 수 있다. 전투 중에는 가방이 열리지 않아 바꿀 수 없다.</p>
      ${msg?`<p class="small bad">${esc(msg)}</p>`:''}
      <div class="panel stack" style="gap:6px;border-color:var(--gold)"><div class="row between"><b style="color:var(--gold)">지금 쓰는 팩 · ${esc(ch.packName||'출신 카드팩')}</b><span class="mono small dim">덱 ${ch.deck.length}장</span></div>${flag(1,ch.deckLocked||ch.cardMoney)}${chips(ch.deck)}${ch.packKind==='basic'?rn(-1,ch.packName):''}</div>
      ${ps.length?ps.map((t,i)=>{const can=E.packCan(ch,i),ask=UI.packSwAsk===i;return `<div class="panel stack" style="gap:6px"><div class="row between"><b>${esc(t.n)}</b><span class="mono small dim">덱 ${t.deck.length}장${t.side.length?' · 카드함 '+t.side.length+'장':''}</span></div>${flag(1,t.deckLocked||t.cardMoney)}${chips(t.deck)}${t.k==='basic'?rn(i,t.n):''}
        ${can==='ok'?`<button class="btn${ask?' primary':''}" data-a="packsw" data-i="${i}"><b>이 팩으로 바꾼다</b><span class="dim small">지금 팩은 보관함으로 간다</span></button>`:`<p class="small dim">${why[can]||''}</p>`}</div>`}).join(''):'<div class="panel"><p class="small dim">보관한 팩이 없다. 전용 카드팩을 받아 덱이 통째로 바뀌면 이전 덱이 여기에 남는다.</p></div>'}`;
  }
  /* 소모품 칸: 가방 탭(밖에서 쓴다)과 공방 거리 구입 칸 */
  /* 호수별 방지 도구: 소모품과 같은 칸에서 확인한다 */
  function vTools(){
    const ch=G.ch,L=ch.flags&&ch.flags.lake&&ch.lake?ch.lake:null;if(!L)return '';
    const tl=L.tools||{},list=Object.entries(tl).filter(([,v])=>v>0).map(([k,v])=>`${(D.lake&&D.lake.tools&&D.lake.tools[k]||{}).n||k} ×${v}`);
    return `<div class="panel stack" style="gap:6px;margin-top:8px"><span class="eyebrow">방지 도구</span><p class="small dim">호수의 금기를 안전하게 지나가는 데 쓰는 소모형 도구다. 항구에서 산다. 해당 호수에서 선택지로 쓰면 하나가 사라진다.</p><div class="mono">${list.length?esc(list.join(' · ')):'없음'}</div></div>`}
  function vSupply(){
    const ch=G.ch,K=CFG.supply;
    return `<div class="panel stack" style="gap:8px"><span class="eyebrow">소모품 · 종류마다 최대 ${K.max}개</span><p class="small dim">전투 밖에서는 여기서, 전투 중에는 행동을 고르는 화면에서 쓴다(라운드마다 한 번). 공방 거리에서 살 수 있다.</p>${Object.entries(K.items).map(([id,it])=>{const n=(ch.supply||{})[id]||0;return `<div class="row between" style="gap:8px;flex-wrap:nowrap"><div class="stack" style="gap:2px"><b>${esc(E.supplyName(ch,id))} <span class="mono small dim">${n}/${K.max}</span></b><span class="mono small" style="color:var(--gold)">${esc(it.e)}</span></div><button class="chip" data-a="usesupply" data-i="${id}" ${n>0?'':'disabled'}>쓴다</button></div>`}).join('')}${UI.supMsg?`<p class="good small">${esc(UI.supMsg)}</p>`:''}</div>${vTools()}`;
  }
  function vHull(){
    const ch=G.ch,L=ch.lake,K=CFG.lake;if(!L||!L.captain)return '';const h=E.hullOf(ch),ok=h<K.hullMax&&ch.money>=K.repairCost;
    return `<div class="panel stack" style="gap:8px"><div class="row between"><b class="serif">배 수리</b><span class="mono small dim">내구도 ${h}/${K.hullMax}</span></div><p class="small dim">전투마다 내구도가 ${K.hullWear}씩 닳고, 파도에서는 크게 잃는다. 0이 되면 배가 가라앉는다. 수리는 항구에서만 된다.</p><button class="btn" data-a="repairhull" ${ok?'':'disabled'}><span class="row between"><b>배를 고친다</b><span class="mono" style="color:var(--gold)">${E.money(K.repairCost)}</span></span><span class="mono small dim">내구도 ${K.hullMax}까지${h>=K.hullMax?' · 고칠 곳이 없다':ch.money<K.repairCost?' · 돈이 모자란다':''}</span></button></div>`
  }
  function vSupplyShop(){
    const ch=G.ch,K=CFG.supply;
    return `<div class="panel stack" style="gap:8px"><div class="row between"><b class="serif">소지품</b><span class="mono small dim">종류마다 최대 ${K.max}개</span></div><p class="small dim">가방의 소모품 칸에 들어간다. 전투 중에도 쓸 수 있다. 값은 ${K.priceEvery}해마다 ${E.money(K.priceStep)}씩 오른다(최대 ${E.money(K.priceMax)}).</p>${Object.entries(K.items).map(([id,it])=>{const n=(ch.supply||{})[id]||0,pr=E.supplyPrice(ch,id),ok=n<K.max&&ch.money>=pr;return `<button class="btn" data-a="buysupply" data-i="${id}" ${ok?'':'disabled'}><span class="row between"><b>${esc(E.supplyName(ch,id))}</b><span class="mono" style="color:var(--gold)">${E.money(pr)}</span></span><span class="mono small dim">${esc(it.e)} · 지닌 수 ${n}/${K.max}${n>=K.max?' · 더는 지닐 수 없다':ch.money<pr?' · 돈이 모자란다':''}</span></button>`}).join('')}</div>`;
  }
  function vBag(){
    const ch=G.ch,t=UI.bag;
    const body={stat:vStat,pack:vPacks,gear:vGear,card:vCards,relic:vRelic,supply:vSupply,family:vFamily,title:vTitleBag}[t]();
    return sheet(`<div class="row between" style="flex-wrap:nowrap;gap:8px"><b class="serif">가방</b><span class="mono small" style="color:var(--gold);margin-left:auto">자산 ${E.money(ch.money)}</span><button class="chip" data-a="bagclose">닫기 ✕</button></div>
      <div class="bagtabs">${bagTabs(ch).map(([k,n,b])=>`<button class="tile sm${t===k?' on':''}" data-a="bag" data-i="${k}">${icon(k)}<span>${n}</span>${b?`<em>${b}</em>`:''}</button>`).join('')}</div>
      <div class="stack" style="gap:10px">${body}</div>`,'bag',true);
  }
  /* 카드 보상: 이미 가진 장수(덱+카드함)와 지금 덱을 같이 보여 준다 */
  const ownN=(ch,id)=>ch.deck.filter(x=>x===id).length+(ch.side||[]).filter(x=>x===id).length;
  const ownTag=(ch,id)=>{const n=ownN(ch,id);return n?`<span class="mono small" style="color:var(--gold)">보유 ×${n}</span>`:'<span class="mono small dim">새 카드</span>'};
  const myDeck=ch=>{const cnt={};ch.deck.forEach(id=>cnt[id]=(cnt[id]||0)+1);const sd={};(ch.side||[]).forEach(id=>sd[id]=(sd[id]||0)+1);
    const ch_=o=>Object.keys(o).map(id=>`<span class="chip">${esc(D.cards[id].n)}${o[id]>1?' ×'+o[id]:''}</span>`).join('');
    return `<details class="panel"><summary class="small">지금 덱 ${ch.deck.length}/${E.deckMax(ch)}장${(ch.side||[]).length?` · 카드함 ${ch.side.length}장`:''} 보기</summary><div class="chips" style="margin-top:6px">${ch_(cnt)}</div>${(ch.side||[]).length?`<span class="eyebrow" style="margin-top:6px">카드함</span><div class="chips">${ch_(sd)}</div>`:''}</details>`};
  /* 새 장비·새 카드: 받기 전에 고른다 (장비가 몰래 바뀌지 않게) */
  function vOffer(){
    const ch=G.ch;
    /* 전용 카드팩 제안은 장비보다 먼저 보여 준다 (전리품을 얻자마자 바로 고른다) */
    if((ch.gearOffers||[]).length&&!ch.packOffer){
      const it=ch.gearOffers[0],cur=ch.gear[it.slot],df=fxDiff(it,cur);
      return sheet(`${UI.eatMsg?`<p class="good small">${esc(UI.eatMsg)}</p>`:''}<span class="eyebrow">새 장비 · ${D.slots[it.slot]}${ch.gearOffers.length>1?` · 남은 ${ch.gearOffers.length}개`:''}</span><h2>${esc(it.n)}</h2>
        <div class="cmp"><div class="panel stack" style="gap:4px"><span class="eyebrow">지금 장착 중</span><b>${cur?esc(cur.n):'없음'}</b><span class="mono small dim">${cur?esc(cur.e||''):''}</span></div>
          <div class="panel stack" style="gap:4px;border-color:var(--gold)"><span class="eyebrow">새 장비</span><b>${esc(it.n)}</b><span class="mono small" style="color:var(--gold)">${esc(it.e||'')}</span>${it.t?`<span class="small dim" style="line-height:1.55">${esc(it.t)}</span>`:''}</div></div>
        <div class="mono small">바꾸면 · ${df||'능력치 변화 없음'}</div>
        ${E.equipWhy(ch,it)?`<p class="small bad">장착할 수 없다 · ${esc(E.equipWhy(ch,it))}</p>`:`<button class="btn primary" data-a="gwear">장착한다${cur?` · ${esc(cur.n)}은(는) 보관함으로`:''}</button>`}
        ${ch.gw&&ch.gw.proc?`<button class="btn" data-a="geat"><b>먹는다</b><span class="mono small dim">섭식 ${(ch.gw.eaten||0)+1}번째 · 능력치 상승${(it.grade||0)>=5?` · 히든 ${(ch.gw.hidden||0)+1}/${CFG.gweapon.hiddenNeed}`:''}</span></button>`:''}
        <button class="btn" data-a="gkeep">보관함에 넣어 둔다</button>
        <p class="small dim">보관함의 장비는 전투 밖이면 언제든 가방 → 장비에서 바꿔 낄 수 있다.</p>`,'offer',false);
    }
    if(ch.packOffer){const P=ch.packOffer,cnt={};P.cards.forEach(id=>cnt[id]=(cnt[id]||0)+1);
      return sheet(`<span class="eyebrow">전용 책장 · ${P.cards.length}장</span><h2>${esc(P.n)}으로 덱을 바꿀까</h2>
        <div class="check" style="border-color:var(--bleed)"><b class="bad">주의 · 덱이 통째로 바뀐다</b><br>바꾸면 지금 덱 ${ch.deck.length}장과 카드함 ${(ch.side||[]).length}장이 '${esc(ch.packName||'기본 카드팩')}'으로 가방의 카드팩 보관함에 남는다. 새 팩은 덱이 고정되고 새 카드는 돈으로 받는다. 보관한 팩은 가방의 카드팩 탭에서 전투 밖이면 언제든 바꿔 끼울 수 있다.</div>
        ${P.e?`<div class="check"><b>패시브</b> · ${esc(P.e)}</div>`:''}
        <div class="invcards">${Object.keys(cnt).map(id=>cardRow(id,ownTag(ch,id)+(cnt[id]>1?` <span class="mono small dim">책장 ×${cnt[id]}</span>`:''))).join('')}</div>
        ${P.must?`<div class="check"><b>${esc(P.yes)}</b> · ${esc(P.yesE)}</div><div class="check"><b>${esc(P.alt.label)}</b> · ${esc(P.alt.e)}</div>`:''}
        <button class="btn${UI.packAsk?' primary':''}" data-a="packyes">${UI.packAsk?'정말 바꾼다 (이전 덱은 보관된다)':(P.must?esc(P.yes):'이 책장으로 바꾼다')}</button>
        ${P.alt?`<button class="btn primary" data-a="packalt">${esc(P.alt.label)}</button>`:`<button class="btn primary" data-a="packno">지금 덱을 지킨다</button>`}
        <p class="small dim">${P.must?'둘 중 하나를 고른다. 이전 덱은 가방의 카드팩 보관함에 남는다.':'지금 덱을 지키면 이 책장은 사라진다. 다른 전리품은 그대로 받는다.'}</p>`,'offer',false)}
    if((ch.picks||[]).length&&!(ch.offers||[]).length){const g=ch.picks[0];
      return sheet(`<span class="eyebrow">카드 발견 · ${g.length}장 가운데 하나${ch.picks.length>1?` · 남은 묶음 ${ch.picks.length}`:''}</span><h2>하나를 고른다</h2>
        <div class="invcards">${g.map((id,j)=>cardRow(id,`${ownTag(ch,id)}<button class="chip" data-a="pkpick" data-i="${j}">이 카드를 고른다</button>`)).join('')}</div>
        ${myDeck(ch)}
        <button class="btn quiet" data-a="pkskip">모두 버린다</button>
        <p class="small dim">고른 카드는 다음 화면에서 덱에 넣거나 카드함에 둘 수 있다.</p>`,'offer',false)}
    const cid=ch.offers[0],room=E.deckRoom(ch),many=ch.offers.length>1?` · 남은 ${ch.offers.length}장`:'';
    if(UI.swap)return sheet(`<span class="eyebrow">덱의 카드와 바꾸기 · 빠진 카드는 카드함으로</span>${cardRow(cid)}
      <div class="invcards">${ch.deck.map((id,j)=>cardRow(id,D.cards[id].fixed?'<span class="small dim">전용 · 바꿀 수 없다</span>':`<button class="chip" data-a="oswap" data-i="${j}">이 카드와 바꾼다</button>`)).join('')}</div>
      <button class="btn" data-a="oswapmode">돌아가기</button>`,'offer',false);
    return sheet(`<span class="eyebrow">카드 발견 · 덱 ${ch.deck.length}/${E.deckMax(ch)}${many}</span><h2>받을까, 버릴까</h2>${cardRow(cid,ownTag(ch,cid))}
      ${room?'<button class="btn primary" data-a="otake" data-i="deck">덱에 넣는다</button>':`<button class="btn primary" data-a="oswapmode">덱의 카드와 바꾼다</button><p class="small dim">덱이 가득 찼다 (최대 ${E.deckMax(ch)}장).</p>`}
      <button class="btn" data-a="otake" data-i="side">카드함에 넣어 둔다</button>
      <button class="btn quiet" data-a="odrop">버린다</button>`,'offer',false);
  }
  /* 공방: 등급별 목록. 들어갈 수 없는 등급은 조건을 보여 준다 */
  function vBlack(){
    if(!(UI.stock||[]).length)return '';
    const ch=G.ch;
    const items=UI.stock.map(id=>{const it=D.special[id],st=E.canBuySpecial(ch,id);
      const note=it.wsOnly?(st==='money'?'돈이 모자란다':'공방 해결사 전용 재료 · 보관함에 들어간다'):st==='owned'?(it.perm?'이미 받음':'장착 중'):st==='stash'?'보관 중':st==='distort'?'뒤틀린 몸 · 장비를 쥘 수 없다':st==='nwing'?'N사 날개 · 의체를 쓰지 않는다':st==='herm'?'카두세우스-헤르메스 · 다른 무기는 쥘 수 없다':st==='money'?'돈이 모자란다':it.perm?'영구 강화':`${D.slots[it.slot]} 교체${ch.gear[it.slot]?' · 지금 '+esc(ch.gear[it.slot].n):''}`;
      return `<button class="btn" data-a="bspecial" data-i="${id}" ${st==='ok'?'':'disabled'}><span class="row between"><b>${it.n}</b><span class="mono" style="color:var(--gold)">${E.money(E.specialPrice(ch,id))}</span></span>
        <span class="mono" style="color:var(--gold)">${it.e}</span><span class="mono small dim">${note}</span></button>`}).join('');
    const B=CFG.blackCard,box=UI.cardBox?`<div class="panel stack" style="gap:8px;border-color:${KIND.debuff[1]}"><div class="row between"><b class="serif">수상한 카드 상자</b><span class="mono" style="color:var(--gold)">${E.money(B.price)}</span></div>
      <p class="small dim">원하는 쪽을 말하면 그런 카드 한 장을 꺼내 준다. 무엇이 나올지는 모른다. 이번 방문에 한 번.</p>
      ${UI.boxDone?`<p class="good small">${UI.boxDone}</p>`:ch.deckLocked||ch.cardMoney?'<p class="small dim">덱이 고정되어 카드를 받을 수 없다.</p>':`<div class="row" style="gap:8px">${[['debuff','디버프 카드'],['buff','버프 · 회피 카드']].map(([k,n])=>`<button class="btn" style="flex:1" data-a="box" data-i="${k}" ${ch.money<B.price?'disabled':''}><b>${n}</b><span class="small dim">${k==='debuff'?'상대에게 출혈·파열·화상':'호흡·회피 등 나를 돕는 카드'}</span></button>`).join('')}</div>${ch.money<B.price?'<p class="small dim">돈이 모자란다.</p>':''}`}</div>`:'';
    const AID=CFG.blackAid,aid=UI.aid?`<div class="panel stack" style="gap:8px;border-color:${KIND.buff[1]}"><b class="serif">응급 거래</b><p class="small dim">구석 상인이 낡은 카드 두 장을 슬쩍 내민다. 같은 카드는 최대 ${AID.max}장까지 지닐 수 있다.</p>
      ${ch.deckLocked||ch.cardMoney?'<p class="small dim">덱이 고정되어 카드를 받을 수 없다.</p>':Object.keys(AID.price).map(id=>{const c=D.cards[id],n=E.aidCount(ch,id),ok=n<AID.max&&ch.money>=AID.price[id];return `<button class="btn" data-a="aid" data-i="${id}" ${ok?'':'disabled'}><span class="row between"><b>${c.n}</b><span class="mono" style="color:var(--gold)">${E.money(AID.price[id])}</span></span><span class="small dim">${c.d.replace(' (암시장 전용)','')}</span><span class="mono small dim">${n>=AID.max?'더는 지닐 수 없다':`지닌 수 ${n}/${AID.max}`}</span></button>`}).join('')}</div>`:'';
    return `<div class="panel stack" style="gap:8px;border-color:var(--bleed)"><div class="row between"><b class="serif">암시장</b><span class="chip">이번 방문만</span></div>
      <p class="small dim">출처를 묻지 않는 물건들. 이번에 지나가면 다음엔 다른 물건이 나온다.</p><div class="stack">${items}</div>${box}${aid}</div>`;
  }
  /* 공방 거리의 카페: 돈을 내고 차를 마시며 정신력을 회복한다 (치유소는 HP, 카페는 정신력) */
  function vCafe(){
    const ch=G.ch,K=CFG.clinic,mn=UI.mindHealed||0,mleft=K.mindMaxBuy-mn,mp=E.mindClinicPrice(ch),mmax=E.mindMax(ch),mfull=ch.mind>=mmax,mok=mleft>0&&!mfull&&!ch.distForm&&ch.money>=mp;
    return `<div class="panel stack" style="gap:8px"><div class="row between"><b class="serif">골목 카페</b><span class="mono" style="color:var(--gold)">${E.money(mp)} · 이번 방문 ${mn}/${K.mindMaxBuy}</span></div>
      <p class="small dim">공방 거리 끝에 불이 켜진 작은 카페가 있다. 따뜻한 잔을 앞에 두고 앉으면 머릿속이 조용해진다. 한 잔에 정신력 ${K.mind} 회복. 마실 때마다 값이 ${E.money(K.mindStep)}씩 오른다 (이번 판 ${ch.mindBought||0}잔).</p>
      ${UI.mindMsg?`<p class="good small">${esc(UI.mindMsg)}</p>`:''}
      <button class="btn" data-a="mindcare" ${mok?'':'disabled'}><b>카페에 들른다</b><span class="mono small dim">정신력 ${ch.mind}/${mmax}${ch.distForm?' · 뒤틀린 몸은 마실 수 없다':mfull?' · 이미 평온하다':mleft<=0?' · 오늘은 더 마실 수 없다':ch.money<mp?' · 돈이 모자란다':''}</span></button></div>`;
  }
  /* 공방 치유소 · 암시장 K사 엠플 */
  function vClinic(){
    const ch=G.ch,K=CFG.clinic,A=CFG.ample,n=UI.healed||0,left=K.max-n,cp=E.clinicPrice(ch),full=ch.hp>=ch.stats.maxHp,ok=left>0&&!full&&ch.money>=cp;
    const ap=E.ampPrice(ch),have=ch.ample||0,bought=ch.ampleBought||0,aok=have<A.carry&&(bought<A.limit||ch.infinite)&&ch.money>=ap;
    return `<div class="panel stack" style="gap:8px"><div class="row between"><b class="serif">치유소</b><span class="mono" style="color:var(--gold)">${E.money(cp)} · 이번 방문 ${n}/${K.max}</span></div>
      <p class="small dim">돈을 내고 상처를 치료한다. 한 번에 HP ${K.hp} 회복. 치료를 받을 때마다 값이 ${E.money(K.step)}씩 오른다 (이번 판 ${ch.healBought||0}번 받음).</p>
      ${UI.healMsg?`<p class="good small">${esc(UI.healMsg)}</p>`:''}
      <button class="btn" data-a="heal" ${ok?'':'disabled'}><b>치료 받는다</b><span class="mono small dim">HP ${ch.hp}/${ch.stats.maxHp}${full?' · 이미 멀쩡하다':left<=0?' · 오늘은 더 받을 수 없다':ch.money<cp?' · 돈이 모자란다':''}</span></button></button></div>
    ${hwHome()?'':`<div class="panel stack" style="gap:8px;border-color:var(--bleed)"><div class="row between"><b class="serif">${A.name}</b><span class="mono" style="color:var(--gold)">${E.money(ap)}</span></div>
      <p class="small dim">암시장에서 도는 전리품. 전투 중 HP가 최대 HP의 ${Math.round(A.belowPct*100)}% 이하가 되면 자동으로 쓰여 최대 HP의 ${Math.round(A.healPct*100)}%를 회복한다. 한 번에 쓰러질 만한 피해를 받으면 쓰러지기 전에 먼저 쓰이고(받은 피해만큼 회복이 줄어든다), 전투 중 횟수 제한 없이 한 번에 1개씩 쓰이고, 최대 ${A.carry}개까지 지닌다. 쓰고 나면 다음 공방에서 다시 살 수 있다. ${ch.infinite?`2막 무한 모드에서는 구매 횟수 제한이 없고 값이 ${E.money(A.priceInf)}이다.`:`한 판에 모두 ${A.limit}개까지만 살 수 있다 (2막 무한 모드에 들어서면 제한이 없어지고 값이 ${E.money(A.priceInf)}이 된다).`}</p>
      <button class="btn" data-a="ample" ${aok?'':'disabled'}><b>${A.name} 구입</b><span class="mono small dim">지닌 수 ${have}/${A.carry} · 산 수 ${bought}${ch.infinite?' (제한 없음)':'/'+A.limit}${bought>=A.limit&&!ch.infinite?' · 더는 살 수 없다':have>=A.carry?' · 더는 지닐 수 없다':ch.money<ap?' · 돈이 모자란다':''}</span></button></div>`}${vEnchant()}`;
  }
  /* 무한 모드: 효과 부여. 장착한 무기·방어구·보조 장비 각각에 효과를 새기고, 다시 새기면 이전 효과가 지워지고 다른 효과로 바뀐다 */
  function vEnchant(){
    const ch=G.ch,K=CFG.enchant;if(!E.enchantable(ch)||hwHome())return '';
    const row=(sl,lb)=>{const it=ch.gear[sl];if(!it)return `<div class="row between small dim"><span>${lb}</span><span>장착한 장비가 없다</span></div>`;
      const pr=E.enchantPrice(ch,sl),ok=ch.money>=pr,en=it.ench;
      return `<div class="stack" style="gap:4px"><div class="row between"><b>${lb} · ${esc(it.n)}</b><span class="mono small" style="color:var(--gold)">${E.money(pr)}</span></div>
        <p class="small ${en?'':'dim'}">${en?`<b>${esc(en.n)}</b> · ${esc(en.type)} · ${esc(en.e)}`:'새겨진 효과 없음'}</p>
        <button class="btn" data-a="enchant" data-i="${sl}" ${ok?'':'disabled'}><b>${en?'효과를 바꾼다':'효과를 새긴다'}</b><span class="mono small dim">${it.enchN?`지금까지 ${it.enchN}번`:'처음'}${ok?'':' · 돈이 모자란다'}</span></button></div>`};
    return `<div class="panel stack" style="gap:10px;border-color:var(--rupture)"><div class="row between"><b class="serif">효과 부여</b><span class="mono small dim">${E.money(K.base)} ~ ${E.money(K.max)}</span></div>
      <p class="small dim">돈을 내고 장비에 효과를 새긴다. 다시 새기면 이전 효과가 지워지고 다른 효과로 바뀐다(쌓이지 않는다). 첫 값은 ${E.money(K.base)}이고, 새길 때마다 ${E.money(K.step)}씩 올라 ${E.money(K.max)}에서 멈춘다. 횟수 제한은 없다. 효과는 버프형 · 디버프형 · 스탯형 · 스택형 · 패시브형 중에서 나온다.</p>
      ${UI.enchMsg?`<p class="good small">${esc(UI.enchMsg)}</p>`:''}
      ${row('weapon','무기')}${row('armor','방어구')}${row('aug','보조 장비')}</div>`;
  }
  const auxLbl=it=>it.kind?it.kind+' · '+({'공':'공격형','방':'방어형','유':'유틸형'}[it.tag]||it.tag):D.slots[it.slot];
  function vShop(){
    const ch=G.ch,acc=E.shopAccess(ch),A=D.access;
    if(trainHome())return `${vHud()}<div class="moneybar"><span>자산</span><b class="mono">${E.money(ch.money)}</b></div><div class="stack" style="gap:6px"><div class="eyebrow">열차 승무원 칸</div><h2>잠시 숨을 돌린다</h2><p class="small dim">열차 안에는 공방이 없다. 의무실만 문을 열어 둔다.</p></div>${vClinic()}<button class="btn primary" data-a="unshop">칸을 나간다</button>`;
    /* 입장 조건 문구: 그 등급을 주는 소속 / (한 등급 낮은 소속 또는 무소속) + 해결사 급수 보너스 */
    const need=g=>{
      if(g>A.base+A.rankBonus.plus+1&&A.top)return `${T.licensed} ${A.top}${T.rankUnit} 이상(또는 진로 최고 직위)`;
      const nm=f=>Object.entries(A.aff).filter(([,v])=>f(v)).map(([k])=>T.affTypes[k]);
      const direct=nm(v=>v>=g),low=nm(v=>v<g&&v+A.rankBonus.plus>=g),rk=`${T.licensed} ${A.rankBonus.rank}${T.rankUnit} 이상`;
      const parts=[];if(direct.length)parts.push(direct.join('·')+' 소속');
      if(A.base+A.rankBonus.plus>=g)parts.push(rk);else if(low.length)parts.push(`${low.join('·')} 소속이면서 ${rk}`);
      return parts.join(', 또는 ');
    };
    const shops=D.workshops.filter(w=>lakeHome()?w.grade<3:hwHome()?w.grade<=3:true).map(w=>{
      const open=w.grade<=acc||(hwHome()&&w.grade===3);
      const items=Object.entries(D.items).filter(([,it])=>it.grade===w.grade&&(lakeHome()?!!it.lake:hwHome()?(w.grade<3||it.hw):(!it.hw&&!it.lake))).filter(([id,it],_i,all)=>!hwHome()||w.grade===3||all.filter(([,x])=>x.slot===it.slot).sort((a,b)=>a[1].price-b[1].price)[0][0]===id).map(([id,it])=>{
        const st=E.canBuy(ch,id),cur=ch.gear[it.slot];
        const note=it.tool&&st==='ok'?`쓰면 사라진다 · 지금 ${((ch.lake||{}).tools||{})[it.tool]||0}개`:it.tool&&st==='money'?'돈이 모자란다':it.tool&&st==='locked'?'이 호수의 소문을 아직 듣지 못했다':it.tool&&st==='owned'?'이미 두 개를 챙겨 두었다':st==='owned'?(it.hw&&(ch.hwGot||[]).includes(id)&&!(cur&&cur.id===id)?'이미 받음':'장착 중'):st==='stash'?'보관 중':st==='money'?'돈이 모자란다':st==='distort'?'뒤틀린 몸 · 장비를 쥘 수 없다':st==='nwing'?'N사 날개 · 의체를 쓰지 않는다':st==='herm'?'카두세우스-헤르메스 · 다른 무기는 쥘 수 없다':st==='locked'?'잠김':`${D.slots[it.slot]} 교체${cur?' · 지금 '+esc(cur.n):''}`;
        if(UI.buyAsk===id&&st==='ok')return `<div class="panel stack" style="gap:8px;border-color:var(--gold)"><div class="row between"><b>${it.n}</b><span class="mono" style="color:var(--gold)">${it.hw?'하사':E.money(E.priceOf(ch,id))}</span></div><span class="mono" style="color:var(--gold)">${it.e}</span><span class="small dim">${it.tool?'소모형 도구':auxLbl(it)}${cur&&!it.tool?' · 지금 '+esc(cur.n)+'은(는) 보관함으로 간다':''} · ${it.tool?'이 도구를 챙길까?':'이 장비를 맞출까?'}</span><div class="row" style="gap:8px"><button class="btn primary" data-a="buyok" data-i="${id}">${it.perm?'먹는다':it.hw?'받는다':it.tool?'챙긴다':'맞춘다'}</button>${E.isWs(ch)&&!it.tool&&!it.perm&&!it.hw&&ch.ws?`<button class="btn" data-a="buymelt" data-i="${id}">사서 바로 녹이기</button><button class="btn" data-a="buymelt" data-i="${id}" data-n="5">5개 녹이기</button><button class="btn" data-a="buymelt" data-i="${id}" data-n="10">10개 녹이기</button>`:''}<button class="btn quiet" data-a="buyno">취소</button></div></div>`;
        return `<button class="btn" data-a="buy" data-i="${id}" ${st==='ok'?'':'disabled'}><span class="row between"><b>${it.n}</b><span class="mono" style="color:var(--gold)">${it.hw?'하사':(E.isWs(ch)?`<s class="dim">${E.money(it.price)}</s> `:'')+E.money(E.priceOf(ch,id))}</span></span>
          <span class="mono" style="color:var(--gold)">${it.e}</span><span class="mono small dim">${it.tool?'도구 · 소모형':it.perm?'영구 강화':auxLbl(it)} · ${note}</span></button>`;
      }).join('');
      return `<div class="panel stack" style="gap:8px${open?'':';opacity:.6'}"><div class="row between"><b class="serif">${hwHome()?HWSHOP[w.grade-1][0]:lakeHome()?LKSHOP[w.grade-1][0]:w.n}</b><span class="chip${open?'':' dim'}">${w.grade}등급${open?'':' · 잠김'}</span></div>
        <p class="small dim">${hwHome()?HWSHOP[w.grade-1][1]:lakeHome()?LKSHOP[w.grade-1][1]:w.t}${open?'':' 들어가려면 '+need(w.grade)+'.'}</p>${open?`<div class="stack">${items}</div>`:''}</div>`;
    }).join('');
    const gear=Object.entries(D.slots).map(([k,n])=>`<span class="chip">${n} · ${ch.gear[k]?esc(ch.gear[k].n):'없음'}</span>`).join('');
    return `${vHud()}<div class="moneybar"><span>자산</span><b class="mono">${E.money(ch.money)}</b></div><div class="stack" style="gap:6px"><div class="eyebrow">${hwHome()?'홍원의 저잣거리':lakeHome()?'U사의 어느 항구':(G.infinite&&G.ch.infinite)?'외곽의 가게':'공방'} · 내 등급 ${acc}</div><h2>무엇을 맞출까</h2>
      <p class="small dim">▾ 각 상점의 이름 줄을 누르면 접고 펼 수 있다.</p><div class="chips">${gear}</div>${(()=>{const g={};for(const k of Object.keys(D.slots)){const w=E.slotWhy(ch,k);if(w)(g[w]=g[w]||[]).push(D.slots[k])}return Object.entries(g).map(([w,ns])=>`<p class="small bad">🚫 ${ns.join('·')} · ${esc(w)}</p>`).join('')})()}${UI.bought?`<p class="good small">${esc(UI.bought)}을(를) 맞췄다.</p>`:''}${E.isWs(ch)&&ch.ws?`<button class="btn quiet" data-a="automelt"><b>구매하면 바로 녹이기 · ${AUTOMELT?'켜짐':'꺼짐'}</b><span class="small dim">켜면 장비를 누르는 즉시 사서 작업대 재료로 녹인다 (확인 없이 같은 장비를 연달아 살 수 있다)</span></button>`:''}${UI.meltMsg?`<p class="good small">${esc(UI.meltMsg)}</p>`:''}</div>${shops}${vClinic()}${vHull()}${vSupplyShop()}${vCafe()}${vBlack()}${vSell()}${vSwapCard()}${vForge()}${vTune()}
      <button class="btn primary" data-a="unshop">${hwHome()?'저잣거리를 나간다':lakeHome()?'항구를 나간다':'공방을 나간다'}</button>`;
  }
  /* 공방 해결사: 카드 판매 (장비 판매는 없다) */
  function vSell(){
    const ch=G.ch;if(!E.isWs(ch))return '';const WF=CFG.workshopFixer,n=UI.soldN||0,locked=ch.deckLocked||ch.cardMoney,full=n>=WF.cardMax,min=ch.deck.length<=CFG.shop.minDeck;
    const rows=ch.deck.map((id,i)=>[id,i]).filter(([id])=>!D.cards[id].fixed).map(([id,i])=>`<button class="btn" data-a="sellcard" data-i="${i}" ${locked||full||min?'disabled':''}><span class="row between"><b>${esc(D.cards[id].n)}</b><span class="mono" style="color:var(--gold)">+${E.money(E.cardPrice(id))}</span></span><span class="mono small dim">${esc(D.cards[id].d||'')}</span></button>`).join('');
    return `<div class="panel stack" style="gap:8px"><div class="row between"><b class="serif">카드 팔기</b><span class="chip">공방 해결사 · ${n}/${WF.cardMax}</span></div>
      <p class="small dim">덱의 카드를 공방에 넘긴다. 한 번 들를 때 ${WF.cardMax}장까지, 덱은 ${CFG.shop.minDeck}장 아래로 줄일 수 없다. 값은 ${E.money(WF.cardBase)}에 카드 비용 1마다 ${E.money(WF.cardPer)}을 더한다.</p>
      ${UI.sold?`<p class="good small">${esc(UI.sold)}</p>`:''}
      ${locked?'<p class="small dim">이 덱은 카드를 팔 수 없다.</p>':rows||'<p class="small dim">팔 수 있는 카드가 없다.</p>'}</div>`;
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
  /* 공방 해결사의 작업대: 전용 무기·방어구는 보관함 장비를 녹여 끝없이 강화하고, 의수는 히든 의수 하나로 한 번만 개조한다 */
  function vForge(){
    const ch=G.ch;if(!E.isWs(ch))return '';E.wsEnsure(ch);const w=ch.ws;if(!w)return '';
    const st=ch.stash||[],W_=CFG.ws,nm={weapon:'무기',armor:'방어구'},key={weapon:'w',armor:'a'};
    const dead=ch.distForm&&!ch.distStable;
    const nameRow=sl=>`<div class="row" style="gap:6px"><input id="wsn_${sl}" maxlength="12" autocomplete="off" placeholder="이름 짓기 (12자까지)" value="${esc(((ch.ws.names||{})[sl])||'')}" style="flex:1;min-width:0"><button class="chip" data-a="wsname" data-i="${sl}">이름 정하기</button></div>`;
    const rows=['weapon','armor'].map(sl=>{
      const cur=ch.gear[sl];if(!cur||cur.id!=='ws_'+sl)return '';
      const k=w[key[sl]],mats=st.map((m,i)=>[m,i]).filter(([m])=>!(m.id&&String(m.id).startsWith('ws_'))&&!(m.id==='birth'&&m.n==='맨손')&&(m.slot===sl||m.id==='hidmat'));
      const btns=mats.map(([m,i])=>{const hid=E.wsHidden(m);return `<button class="btn" data-a="wsmelt" data-i="${sl}:${i}" ${dead?'disabled':''}><span class="row between"><b>${esc(m.n)}</b><span class="chip${hid?' warn':''}">${hid?'히든 · 한 단계':'일반 · 강화 점수 +'+E.wsMatVal(m)}</span></span><span class="mono small dim">${esc(m.e||'')}</span></button>`}).join('');
      return `<div class="stack" style="gap:6px;border-top:1px solid var(--line,#2a2f3a);padding-top:6px">${nameRow(sl)}<div class="row between"><b>${esc(cur.n)}</b><span class="mono small dim">일반 ${k.p}/${E.wsNeed(k.n)} · 강화 ${k.n}${k.h?' · 히든 '+k.h:''}</span></div><span class="mono small" style="color:var(--gold)">${esc(cur.e)}</span>${btns||`<p class="small dim">녹일 ${nm[sl]}이(가) 보관함에 없다.</p>`}</div>`;
    }).join('');
    const ag=ch.gear.aug,done=w.g&&w.g.pick,cands=st.map((m,i)=>[m,i]).filter(([m])=>E.wsAugOk(ch,m));
    const amats=st.map((m,i)=>[m,i]).filter(([m])=>!(m.id&&String(m.id).startsWith('ws_'))&&(m.id==='hidmat'||m.slot==='aug'));
    const abtn=amats.map(([m,i])=>{const hid=E.wsHidden(m);return `<button class="btn" data-a="wsmelt" data-i="aug:${i}" ${dead?'disabled':''}><span class="row between"><b>${esc(m.n)}</b><span class="chip${hid?' warn':''}">${hid?'히든 · 한 단계':'일반 · 강화 점수 +'+E.wsMatVal(m)}</span></span><span class="mono small dim">${esc(m.e||'')}</span></button>`}).join('');
    const K_=W_.cust,cu=UI.cu=UI.cu||{atk:0,eva:0,hp:0,pas:null},spent=cu.atk*K_.atkCost+cu.eva*K_.evaCost+cu.hp*K_.hpCost+(cu.pas?K_.passCost:0),left=K_.pts-spent;
    const stp=(k,l,cost,unit)=>`<div class="row between" style="gap:6px"><span class="small"><b>${l}</b> +${cu[k]*unit} <span class="dim">(${cost}포인트당 +${unit})</span></span><span class="row" style="gap:6px"><button class="chip" data-a="custd" data-i="${k}:-1" ${cu[k]<=0?'disabled':''}>−</button><button class="chip" data-a="custd" data-i="${k}:1" ${left<cost?'disabled':''}>＋</button></span></div>`;
    const custRow=(!ag||ag.id!=='ws_aug'||(w.cust&&w.cust.done))?'':`<div class="stack" style="gap:6px;border-top:1px solid var(--line,#2a2f3a);padding-top:6px"><div class="row between"><b>커스텀 의수 만들기</b><span class="chip warn">남은 포인트 ${left}/${K_.pts}</span></div><p class="small dim">포인트를 나눠 의수를 한 번 만든다. 만들고 나면 바꿀 수 없다.</p>${stp('atk','공격',K_.atkCost,K_.atkPer)}${stp('eva','회피',K_.evaCost,1)}${stp('hp','체력',K_.hpCost,K_.hpPer)}<div class="stack" style="gap:4px"><span class="small"><b>패시브</b> <span class="dim">(${K_.passCost}포인트, 하나만)</span></span><div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;align-items:stretch">${Object.entries(K_.pass).map(([k,v])=>`<button class="btn${cu.pas===k?' primary':''}" style="min-height:96px;justify-content:flex-start;word-break:keep-all" data-a="custp" data-i="${k}" ${cu.pas!==k&&!cu.pas&&left<K_.passCost?'disabled':''}><b>${v.n}</b><span class="small dim">${v.e}</span></button>`).join('')}</div></div><button class="btn primary" data-a="custok" ${spent<=0||dead?'disabled':''}>이 설계로 만든다</button></div>`;
    const augRow=!ag||ag.id!=='ws_aug'?'':`<div class="stack" style="gap:6px;border-top:1px solid var(--line,#2a2f3a);padding-top:6px">${nameRow('aug')}<div class="stack" style="gap:4px"><span class="small"><b>보조 장비 종류</b> <span class="dim">(종류마다 기본 보너스와 일반 강화 능력치가 다르다 · 언제든 바꿀 수 있다)</span></span><div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px">${Object.entries(CFG.custKinds).map(([k,v])=>`<button class="btn${(w.kind||'aug')===k?' primary':''}" data-a="wskind" data-i="${k}" ${dead?'disabled':''}><b>${v.n}</b><span class="small dim">${(W_.aug.kindE||{})[k]||v.e}</span></button>`).join('')}</div></div>${(w.kind||'aug')==='staff'?`<div class="stack" style="gap:4px"><span class="small"><b>집중 키워드</b> <span class="dim">(일반 강화마다 최대치 +1 · 특수 강화 5·10·15단계와 히든 4번마다 적중마다 +1 더 걸린다)</span></span><div class="row" style="gap:6px">${W_.aug.kwList.map(k=>`<button class="btn${(w.staffKw||'bleed')===k?' primary':''}" data-a="wsstkw" data-i="${k}" ${dead?'disabled':''}><b>${D.keywords[k].n}</b></button>`).join('')}</div></div>`:''}<div class="row between"><b>${esc(ag.n)}</b><span class="mono small dim">일반 ${w.g.p||0}/${E.wsNeed(w.g.n||0)} · 강화 ${w.g.n||0}${w.g.h?' · 히든 '+w.g.h:''} · ${(w.g.picks||[]).length}/${W_.big.at.length} 선택</span></div><span class="mono small" style="color:var(--gold)">${esc(ag.e)}</span>${abtn||'<p class="small dim">녹일 의수가 보관함에 없다.</p>'}
      ${w.g.pend>0&&(w.kind||'aug')!=='staff'?`<div class="stack" style="gap:4px"><b class="small" style="color:var(--gold)">특수 강화 · 하나를 고른다 (${w.g.pend}번 남음)</b><div class="row" style="gap:6px;flex-wrap:wrap">${W_.aug.kwList.map(k=>`<button class="btn" data-a="wsaugc" data-i="${k}" ${dead?'disabled':''}><b>적중 시 ${D.keywords[k].n} +${W_.aug.kwAmt[Math.min((w.g.picks||[]).length,W_.aug.kwAmt.length-1)]}</b></button>`).join('')}</div></div>`:`<p class="small dim">${W_.big.at.map(t=>t+'단계').join('·')}에 닿으면 ${(w.kind||'aug')==='staff'?'집중 키워드가 적중마다 +1 더 걸리고, 15강에는 부여량이 2배가 된다':'종류에 맞는 특수 강화가 붙고, 출혈·파열·화상 중 하나를 골라 적중마다 건다'} (지금 ${(w.kind||'aug')==='staff'?W_.big.at.filter(t=>(w.g.n||0)>=t).length:(w.g.picks||[]).length}/${W_.big.at.length}).</p>`}</div>`;
    return `<div class="panel stack" style="gap:8px;border-color:var(--gold)"><div class="row between"><b class="serif">작업대</b><span class="chip">공방 해결사</span></div>
      <p class="small dim">전용 무기·방어구·의수는 빼거나 바꿀 수 없다. 다른 장비는 모두 재료다. 무기·방어구·의수는 같은 칸의 보관함 장비를 녹여 끝없이 강화하고, 5·10·15단계에서 한 번씩 크게 오른다(특수 강화). 15단계 뒤로는 일반 강화만 끝없이 이어진다. 히든 강화재료는 어떤 전용 장비에든 쓸 수 있다. 일반 장비는 모아서 한 단계(필요한 개수는 단계가 오를수록 늘어난다), 히든 장비는 1개로 한 단계. 녹인 장비는 돌아오지 않고, 공방 물건의 값은 고정이고, 20년차마다 한 번씩 오른다.</p>
      ${UI.wsMsg?`<p class="good small">${esc(UI.wsMsg)}</p>`:''}${rows}${augRow}</div>`;
  }
  function vTune(){
    const ch=G.ch,T=Object.assign({},CFG.shop.tune,{max:E.tuneMax(G.ch)}),slots=Object.keys(ch.gear).filter(k=>ch.gear[k]);
    const rows=slots.map(k=>{const g=ch.gear[k],n=g.tries||0,mx=E.tuneMax(ch,g),full=n>=mx,cost=E.tuneCost(g),tn=g.tune||{},ok=!full&&ch.money>=cost&&(!ch.distForm||ch.distStable);
      return `<div class="stack" style="gap:4px;border-top:1px solid var(--line,#2a2f3a);padding-top:6px"><div class="row between"><b>${esc(g.n)}</b><span class="mono small dim">정비 ${n}/${mx}${tn.atk||tn.eva?` · 공격+${tn.atk||0} 회피+${tn.eva||0}`:''}</span></div>
        ${full?'<p class="small dim">더는 정비할 수 없다.</p>':`<div class="row" style="gap:8px"><button class="btn" style="flex:1" data-a="tune" data-i="${k}" data-s="atk" ${ok?'':'disabled'}><b>공격 +1 시도</b><span class="mono small" style="color:var(--gold)">${E.money(cost)}</span></button><button class="btn" style="flex:1" data-a="tune" data-i="${k}" data-s="eva" ${ok?'':'disabled'}><b>회피 +1 시도</b><span class="mono small" style="color:var(--gold)">${E.money(cost)}</span></button></div>`}</div>`}).join('');
    return `<div class="panel stack" style="gap:8px"><div class="row between"><b class="serif">장비 정비</b><span class="chip">${T.chance}% 성공</span></div>
      <p class="small dim">장착한 장비 하나에 공격 또는 회피 +1을 시도한다. 성공하면 고른 쪽만 오르고, 실패해도 시도 횟수는 소모된다. 장비마다 ${T.max}번까지.${ch.flags&&ch.flags.beatZena?` 제나를 쓰러뜨린 뒤로는 장비마다 ${CFG.shop.tune.zenaPlus}번씩 더 늘어난다. 바랄·제나의 장비는 기본 횟수만 정비할 수 있다.`:''}</p>
      ${UI.tuneMsg?`<p class="${UI.tuneMsg.ok?'good':'bad'} small">${esc(UI.tuneMsg.t)}</p>`:''}
      ${ch.distForm&&!ch.distStable?'<p class="small dim">뒤틀린 몸은 장비를 쥘 수 없다.</p>':rows||'<p class="small dim">장착한 장비가 없다.</p>'}</div>`;
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
      <li><b>순서</b> 라운드마다 1d100 + 속도×${CFG.spdMul}. 1등은 빛 +${CFG.orderBonusLight}, 격차 ${CFG.gapFirst} 이상이면 첫 공격 명중 +${CFG.firstHit}. 뒤처지면 다음 라운드 순서 +${CFG.catchupBonus}.</li>
      <li><b>방어 자세</b> 카드를 하나도 내지 않으면 그 라운드는 회피 대신 방어로 받는다. 막으면 피해 ${CFG.guard.guardHit}, 못 막으면 피해 ×${CFG.guard.guardFailMul}. 다음 라운드 명중 +${CFG.guard.nextHit}${CFG.guard.lightUp?`, 그 전투 동안 빛과 빛 최대치 +${CFG.guard.lightUp}(최대 +${CFG.guard.lightUpMax})`:''}${CFG.guard.lightNext?`, 다음 라운드 빛 +${CFG.guard.lightNext}`:''}.</li>
      <li><b>빛</b> 라운드마다 ${CFG.light}. 남은 빛으로 손패 카드를 원하는 순서로 낸다. 남긴 빛은 사라진다.</li>
      <li><b>${D.keywords.bleed.n}</b> 공격할 때마다(빗나가도) 스택만큼 피해, 그 뒤 1 감소. 내가 방어 자세면 절반으로 지혈. <b>${D.keywords.rupture.n}</b> 피격 시 스택만큼 추가 피해, 피격마다 1 감소. <b>${D.keywords.ink.n}</b> 라운드가 끝날 때 스택당 ${CFG.ink.dmg} 피해(내가 받으면 ${CFG.ink.dmgMe}), 그 뒤 스택이 절반으로 줄어든다. 최대 ${CFG.ink.cap}스택. <b>${D.keywords.burn.n}</b> 라운드가 끝날 때 스택당 ${CFG.burn.dmg} 피해(내가 받으면 ${CFG.burn.dmgMe}), 그 뒤 스택이 절반으로 줄어든다. 최대 ${CFG.burn.max}스택이고, 적이 거는 화상은 쌓이는 양이 절반이다. <b>${D.keywords.flame.n}</b>(레바테인 전용) 받는 피해 ×1.5, 라운드 끝에 1 감소. ${CFG.laev.blueAt}스택 이상이면 <b>푸른 화염</b>이 되어 받는 피해 ×${CFG.laev.blueMul}, 라운드 끝에 스택당 ${CFG.laev.blueDot} 피해를 주고 1 감소한다. 일반 디버프 스택의 최대치는 ${CFG.stackCap}이다. <b>${D.keywords.breath.n}</b> 최대 ${CFG.breath.cap}, 라운드마다 ${CFG.breath.decay} 줄어든다. 4~9는 치명 ${CFG.breath.base}%에서 90%까지(×${CFG.critMult}), ${CFG.breath.sure} 이상은 확정 치명, 1~${CFG.breath.evaMax}는 회피 +${CFG.breath.eva}. 방어 카드를 내면 내 출혈·파열이 1/4 줄어든다(적도 같다).</li>
      <li><b>부여량 제한</b> 무기와 보조 장비는 각각 라운드마다 한 키워드로 ${CFG.kwTurnCap}까지, 둘을 합쳐 ${CFG.kwTurnTotal}까지 부여한다. 공방 지팡이의 집중 키워드는 제외한다. 무기의 ${D.keywords.rupture.n}은 라운드 제한 대신 적중 한 번마다 ${CFG.kwHitCap.rupture}까지 부여한다(쌓이는 최대치는 그대로).</li>
      <li><b>성장</b> 판정 성공 ${CFG.xp.ok}, 실패 ${CFG.xp.fail}, 판정 없는 선택 ${CFG.xp.plain}, 전투 승리 ${CFG.xp.win} 경험치. 레벨이 오르면 성장표를 1d100으로 세 번 굴려 하나를 고른다.</li>
      <li><b>${T.licensed}</b> 자격 시험, 계약, 견습으로 ${T.rankStart}${T.rankUnit}에 등록된다. 소속이 없거나 ${T.affTypes.office} 소속이면 전투에서 이긴 뒤 소문 판정(1d100 + ${T.paths.fixer} 진로 보정 ≥ ${CFG.winLicenseDc})으로도 등록된다. 고정 전투(${Object.keys(D.fixedFights).join('·')}년차)에서 이기면 2${T.rankUnit}씩 ${T.promote}한다.</li>
      <li><b>손가락 서열</b> ${Object.entries(D.fingers).map(([n,F])=>`${n}: ${F.ranks.map(r=>r.branch?r.branch.map(b=>b.n).join('/'):r.n).join(' → ')}`).join(' · ')}. 고정 전투 승리나 승급 사건으로 오르고, 오를 때마다 보정을 받는다. 서열 ${D.fingerRules.shopTier}단계 이상이면 공방 등급 +1.</li>
      <li><b>인연 · 가족</b> ${CFG.bond.from}년차부터 일상 속에서 인연을 만난다. 결혼하면 최대 HP·정신력·판정이 오르고 아이가 생길 수 있다. 결혼한 뒤에는 <b>금기 실험이나 금기 사건을 한 번이라도 저지르면</b> 그 다음 해부터 해마다 ${CFG.bond.dieChance}% 확률로 배우자가 세상을 떠난다(최대 정신력 −${CFG.bond.lossMind}, 영구). 결혼한 채 히든 보스를 이길 때마다 이 확률이 +${CFG.bond.riskStep}%p 쌓인다. 배우자가 죽어도 아이는 남는다. 히든 보스의 전리품 「엘레나의 처방전」을 가지면 이 확률이 절반이 된다.</li>
      <li><b>특이점 강화 · 금기 실험</b> 특이점은 강화를 ${CFG.corp.upMax}번까지만 할 수 있다. 그보다 더 오르지 않는다. 금기 실험은 별개로 ${CFG.corp.forbMax}번까지 할 수 있고, 큰 강화를 주는 대신 정신력이 깎이고 결혼 중이면 위의 배우자 사망 위험이 붙는다. 금기 실험을 ${CFG.corp.forbMax}번 채우면 머리가 ${D.enemies.claw.n}과 ${D.enemies.arbiter.n}를 보낸다. 둘을 이기면 보상을 한 번 받고, 그 뒤로 더 일어나는 일은 없다.</li>
      <li><b>${D.pinky.n}</b> 어느 소속에도 겹쳐 붙는 표식. ${D.pinky.e}.</li>
      <li><b>돈과 공방</b> 해마다 소속 봉급(${T.licensed}는 급수 수당 추가), 전투 현상금, 일부 사건으로 ${D.money.unit}을 번다. 공방은 ${D.workshops.map(w=>w.n).join(' · ')} 3등급이고, 소속과 급수에 따라 들어갈 수 있는 등급이 정해진다. 무기·방어구·의수 칸마다 하나씩 맞춘다.</li>
      <li><b>장비 표기</b> 공+N 공격(명중 +N÷2, 피해 +N÷6, 모두 소수점 버림) · 명중+N 명중만 올라간다 · HP+N 최대 HP · 회피·속도·판정+N 그 능력치 · 피해 주사위 최소 N 피해 주사위 눈이 N보다 작게 나오면 N으로 친다(타수와는 무관) · 방어 카드 회피+N 방어 카드를 쓸 때 회피 추가.</li>
      <li><b>무한 모드 성장</b> 무한 모드에서는 주는 피해 · 일격 · 받는 피해 · 회피 감소 · 연륜이 쌓인다. 늘어난 값은 가방의 정보 칸 "무한 모드 성장"에서 언제든 볼 수 있다. 백 해마다 주는 피해와 적의 피해가 함께 늘고, 불순물을 쓰러뜨리면 조각이 쌓이며, 10년마다 한계 돌파로 공세·맹공·일격 중 하나를 고른다. <b>연륜</b>은 최고 직위에 오른 뒤 쌓이는 전공이 바뀐 것으로, 단계마다 주력 능력치가 1 오르고(최대 ${CFG.infinite.legacyMax}단계, 직위를 올릴 곳이 없을 때만 쌓인다) 직위 줄에 "연륜 N단계"로 표시된다.</li>
      <li><b>승급</b> 전투 승리(초반 ${CFG.promo.gain.early} · 중반 ${CFG.promo.gain.mid} · 보스 ${CFG.promo.gain.boss} · 히든 ${CFG.promo.gain.hidden})와 판정 성공(+${CFG.promo.gain.check})으로 진로의 포인트를 모은다(해결사 ${T.promoPoints} · 협회 ${D.careers.assoc.pts} · 날개 ${D.careers.wing.pts} · 손가락 ${D.careers.finger.pts}). 필요량에 닿으면 다음 해에 심사가 열리고, 성공하면 한 단계 오른다. 필요량은 단계마다 ×${CFG.promo.mult.join(' → ×')}씩 늘어난다. 실패하면 해결사·협회는 포인트 1/4, 날개·손가락은 1/3을 잃고, 날개는 두 번 연속 실패 시 해고, 손가락은 숙청 전투. 맨 위 단계에 오르면 특수 심사(해결사는 특색)가 한 번 열리고, 실패하면 다시 기회가 없다.</li>
      <li><b>${T.hiddenBoss}</b> 조건을 채우면 고정 전투 대신 나타난다. 금기를 어기면 머리의 집행자가, 초대장을 두 번 받아들이면 도서관이, 지령을 거역하면 대행자가 찾아온다. 특색은 ${D.hiddenBosses.find(h=>h.id==='blue').req.replace('rank<=','')}${T.rankUnit} 이상 해결사만 드물게 마주치며, ${D.hiddenBosses.find(h=>h.id==='blue').penalty.fullRank}${T.rankUnit} 미만이면 급수 부족 보정(명중·회피 ${sg(D.hiddenBosses.find(h=>h.id==='blue').penalty.atk)})을 받는다.</li>
      <li><b>${T.titleLabel}</b> ${CFG.colorRank}${T.rankUnit} ${T.licensed} 가운데 특출난 자만 받는다. ${CFG.colorRank}${T.rankUnit}에 오를 때 1d100 + 판정 보정 ≥ ${CFG.colorDc}이면 내 색과 가장 높은 능력치로 이름이 붙는다.${CFG.colorReward?` 모든 능력치가 ${CFG.colorMul}배가 되며 패시브를 하나 고른다.`:''}</li>
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
  const UNLOCKTEST=false; /* build --unlocktest: 해금 출생·히든 직업을 전부 열고, 출생 화면에서 중간 연차로 바로 시작할 수 있는 시험판 */
  const FINGERTEST=false; /* build --finger: 손가락 루트 전용 시험판. 출생 화면에 조직 출신·보냐텔리·별에 선택받은 자로 태어나는 버튼이 생긴다 */
  const fingerBtns=()=>FINGERTEST?`<div class="panel stack" style="gap:6px;border:2px solid var(--gold)"><div class="eyebrow">손가락 시험판 · 바로 태어나기</div><button class="btn" data-a="fbirth" data-i="조직"><b>조직 출신으로 태어나기</b><span class="dim small">1년차에 손가락이 먼저 찾아온다 · 2년차에 거미집 초대</span></button><button class="btn" data-a="fbirth" data-i="보냐텔리"><b>보냐텔리 가문으로 태어나기</b><span class="dim small">엄지 · 가문 전용 · 서열 점수 ×2</span></button><button class="btn" data-a="fbirth" data-i="별"><b>별에 선택받은 자(소지)로 태어나기</b><span class="dim small">정식 소지가 되면 거미집 초대</span></button></div>`:'';
  const MINDTEST=false; /* build --mind: 정신력 10 이하 연출만 시험하는 판 */
  function vMindTest(){
    if(!MINDTEST)return '';
    const mb=UI.mindBias||'',ms=UI.mindSight||0,seg=(a,cur,arr)=>`<div class="seg">${arr.map(([k,l])=>`<button class="${String(cur)===String(k)?'on':''}" data-a="${a}" data-i="${k}">${l}</button>`).join('')}</div>`;
    const dcs=mb==='good'?CFG.mind.voiceGoodDc:mb==='bad'?CFG.mind.voiceBadDc:CFG.mind.voiceDc,th=50+(mb==='good'?-20:mb==='bad'?20:0);
    return `<div class="panel stack" style="gap:8px;border-color:var(--gold)"><span class="eyebrow" style="color:var(--gold)">정신력 시험 · 새 캐릭터로 바로 시작한다</span>
      <span class="small dim">목소리 선택 (②·③에 적용)</span>${seg('mindbias',mb,[['','선택 안 함'],['good','듣기 좋다'],['bad','듣기 싫다']])}
      <span class="small dim">성장기 "장비의 형상이 보임" 개수 (개화 구제 ${15*ms}%)</span>${seg('mindsight',ms,[[0,'0'],[1,'1'],[2,'2'],[3,'3'],[4,'4']])}
      <span class="mono small" style="color:var(--gold)">정신력 1·0 개화 기준 ${th} 이하 · 목소리 판정 ${dcs} 이상 × 3 · 구제 ${15*ms}%${mb==='bad'&&ms>=4?' · 목소리 판정 개화 확정':''}</span>
      <button class="btn primary" data-a="mindtest" data-i="voice"><b>① 정신력 8 · 들리는 목소리</b><span class="dim small">목소리 연출 → 듣기 좋다/싫다 → 기존 개화 판정 (목소리 선택은 직접 고른다 · 성장기 개수는 위 값 적용)</span></button>
      <button class="btn" data-a="mindtest" data-i="distort"><b>② 정신력 1 · 뒤틀림 사건</b><span class="dim small">정신을 붙잡는다 → 판정 연출 (기준선 표시)</span></button>
      <button class="btn" data-a="mindtest" data-i="break"><b>③ 전투 중 정신력 0</b><span class="dim small">전투가 시작되자마자 개화/뒤틀림 판정 연출</span></button></div>`}
  function vTitle(){
    return `${chronBtn('chron-in')}<div class="stack" style="gap:6px;padding-top:6px"><div class="eyebrow">Project Moon 팬메이드 · 비공식 · 비영리 · ${VERSION}</div>
      <h1>도시의 한 해</h1></div>
      <p class="lead">주사위로 태어나 열여섯 해를 자라고, 그 뒤 최대 ${CFG.years}년을 직접 살아낸다. 한 해에 사건이 하나씩 찾아오고, 가끔은 칼을 뽑아야 한다.</p>
      ${vMindTest()}
      ${vUpdates()}
      ${vPlaytest()}
      <div class="stack">${vContinue()}${vHardToggle()}<button class="btn ${loadSave()?'':'primary'}" data-a="start" ${expired()?'disabled':''}>${loadSave()?'<b>새로 시작하기</b><span class="dim small">저장된 판은 지워진다</span>':'태어난다'}</button>
      ${UI.confirmNew?`<p class="small bad">저장된 판이 지워진다. 정말 새로 시작하려면 ${UI.confirmNew==='daily'?'오늘의 시드':'새로 시작하기'}를 한 번 더 누른다.</p>`:''}
      <button class="btn" data-a="daily" ${expired()?'disabled':''}><b>오늘의 시드</b><span class="dim small">${todayKey()} · 오늘은 모두가 같은 출생으로 시작한다${(()=>{const d=loadDaily()[todayKey()];return d&&d.best?` · 오늘 ${d.n}회 도전 · 최고 ${d.best.w?'완주':d.best.y+'년'}`:''})()}</span></button>
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
  /* 일대기: 클리어·쓰러짐 결과 화면을 판마다 자동 저장(최대 10개). 명예의 전당은 직접 고른 판만(최대 5개). 둘 다 직접 삭제할 수 있다 */
  const CHRON='cityYearChron',CHRON_LIFE=10,CHRON_FAME=5;
  const loadChron=()=>{try{const o=JSON.parse(store.get(CHRON)||'{}');return{life:Array.isArray(o.life)?o.life:[],fame:Array.isArray(o.fame)?o.fame:[]}}catch(e){return{life:[],fame:[]}}};
  const saveChron=o=>store.set(CHRON,JSON.stringify(o));
  function chronSnap(){
    const el=$('endShot');if(!el)return null;
    const cl=el.cloneNode(true),c=G.ch;cl.removeAttribute('id');
    cl.querySelectorAll('button,script').forEach(x=>x.remove());cl.querySelectorAll('[data-a]').forEach(x=>x.removeAttribute('data-a'));
    const res=((cl.querySelector('.eyebrow')||{}).textContent||'').trim();
    return {id:Date.now().toString(36)+Math.random().toString(36).slice(2,5),key:c.seed+'|'+G.year+'|'+res,t:Date.now(),v:UPDATES.v,name:c.name||'',lover:(c.bond&&c.bond.name)||'',lost:!!(c.bond&&c.bond.st==='lost'),lostAge:!!(c.bond&&c.bond.dieBy==='age'),wp:(E.isWs(c)&&c.gear.weapon&&c.gear.weapon.n)||'',kids:((c.bond&&c.bond.kids)||[]).filter(k=>!k.pend).map(k=>k.n),line:careerLine(c),res,yr:G.year,win:!!UI.endWin,dy:c.daily||'',html:cl.outerHTML};
  }
  function chronAuto(){
    const e=chronSnap();if(!e)return;const o=loadChron();
    if(o.life.some(x=>x.key===e.key)||o.fame.some(x=>x.key===e.key))return;
    o.life.unshift(e);o.life=o.life.slice(0,CHRON_LIFE);saveChron(o);
  }
  /* 손주 이름: 명예의 전당에 직접 올린 지난 삶의 이름(나·연인·아이)을 엔진에 넘긴다. 지금 진행 중인 판의 기록(제1막 종료 때 자동으로 남는 것)은 뺀다. 예전에 저장한 판은 이름만 있다 */
  E.setGhost(()=>loadRec().ghost||null);
  E.setLegacy(()=>{const o=loadChron(),out=[],sd=G&&G.ch&&G.ch.seed!=null?G.ch.seed+'|':null;for(const e of o.fame){if(sd&&String(e.key||'').startsWith(sd))continue;if(e.name)out.push({n:e.name,k:'self'});if(e.lover)out.push({n:e.lover,k:'lover'});for(const n of e.kids||[])out.push({n:n,k:'kid'})}return out});
  const chDate=t=>new Date(t).toLocaleString('ko-KR',{year:'2-digit',month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'});
  function chBtns(tab,e,view){
    return `<div class="row" style="gap:6px;flex-wrap:wrap">${view?'':`<button class="btn quiet" style="width:auto;padding:8px 12px" data-a="chview" data-i="${tab}:${e.id}">펼쳐 보기</button>`}${tab==='life'?`<button class="btn quiet" style="width:auto;padding:8px 12px" data-a="chfame" data-i="${e.id}">명예의 전당에 올리기</button>`:''}${tab==='fame'?`<button class="btn quiet" style="width:auto;padding:8px 12px" data-a="chmove" data-i="up:${e.id}" aria-label="위로">▲ 위로</button><button class="btn quiet" style="width:auto;padding:8px 12px" data-a="chmove" data-i="down:${e.id}" aria-label="아래로">▼ 아래로</button>`:''}<button class="btn quiet" data-a="chdel" data-i="${tab}:${e.id}"${UI.delAsk===tab+':'+e.id?' style="width:auto;padding:8px 12px;border-color:#c25050;color:#c25050"':' style="width:auto;padding:8px 12px"'}>${UI.delAsk===tab+':'+e.id?'정말 삭제 · 한 번 더':'삭제'}</button></div>`;
  }
  /* 시작 화면 일대기 버튼: 좁은 화면은 위 한 줄(chron-in), 넓은 화면은 틀 바깥 왼쪽 위 모서리(chron-out). 틀 안에 두면 단테·검지 테마의 clip-path에 잘린다 */
  const chronBtn=cls=>{const o=loadChron();return `<button class="btn chronbtn ${cls}" data-a="chron"><b>📜 일대기 · 명예의 전당</b><span class="dim small">지난 판의 결과 화면 ${o.life.length}/${CHRON_LIFE} · 명예의 전당 ${o.fame.length}/${CHRON_FAME}</span></button>`};
  function vChron(){
    const o=loadChron(),tab=UI.chTab==='fame'?'fame':'life',L=o[tab],msg=UI.chMsg;UI.chMsg='';
    const b=(k,l)=>`<button class="${tab===k?'on':''}" data-a="chtab" data-i="${k}">${l}</button>`;
    const row=e=>`<div class="panel stack" style="gap:5px"><div class="row between" style="flex-wrap:nowrap;gap:8px"><b class="serif">${esc(e.name||e.line)}</b><span class="mono small dim" style="white-space:nowrap;text-align:right">${chDate(e.t)}${e.v?`<br>${esc(e.v)}`:''}</span></div><span class="small dim">${esc(e.line)}${e.wp?' · '+esc(e.wp):''}</span>${e.lover?`<span class="small dim">가족 · ${esc(e.lover)}${e.lost?(e.lostAge?' (수명을 다해 세상을 떠났다)':' (세상을 떠났다)'):''}</span>`:''}<span class="small" style="color:var(--gold)">${esc(e.res)}${e.yr?` · ${e.yr}년차`:''}${e.dy?` · 오늘의 시드 ${esc(e.dy)}`:''}</span>${chBtns(tab,e)}</div>`;
    return `<div class="stack" style="gap:6px;padding-top:12px"><div class="eyebrow">이 브라우저에만 남는 기록</div><h2>일대기</h2></div>
      <div class="seg">${b('life',`일대기 ${o.life.length}/${CHRON_LIFE}`)}${b('fame',`명예의 전당 ${o.fame.length}/${CHRON_FAME}`)}</div>
      <p class="small dim">${tab==='life'?`클리어하거나 쓰러질 때마다 그 판의 결과 화면이 자동으로 저장된다. 최대 ${CHRON_LIFE}개이고, 가득 차면 가장 오래된 판부터 밀려난다. 남기고 싶은 판은 명예의 전당에 올려 둔다.`:`직접 고른 판만 모아 두는 곳. 최대 ${CHRON_FAME}개이고, 일대기가 밀려나도 남는다. 지우려면 삭제를 누른다.`}</p>
      ${msg?`<p class="small bad">${esc(msg)}</p>`:''}
      ${L.length?L.map(row).join(''):`<div class="panel"><p class="small dim">${tab==='life'?'아직 저장된 판이 없다. 이야기가 끝나면 여기에 쌓인다.':'아직 올린 판이 없다. 일대기에서 골라 올린다.'}</p></div>`}
      <button class="btn primary" data-a="title">돌아가기</button>`;
  }
  const chMsgP=()=>{const m=UI.chMsg;UI.chMsg='';return m?`<p class="small bad">${esc(m)}</p>`:''};
  function vChronView(){
    const o=loadChron(),sel=UI.chSel||{},e=(o[sel.tab]||[]).find(x=>x.id===sel.id);
    if(!e)return `<div class="panel"><p class="small dim">기록을 찾을 수 없다.</p></div><button class="btn primary" data-a="chron">돌아가기</button>`;
    return `<div class="stack" style="gap:6px;padding-top:12px"><div class="eyebrow">${sel.tab==='fame'?'명예의 전당':'일대기'} · ${chDate(e.t)} 저장${e.v?' · '+esc(e.v):''}</div></div><div id="chShot" class="stack" style="gap:12px">${e.html}</div>${chMsgP()}${UI.imgUrl&&UI.screen==='chronview'?`<img alt="일대기 이미지" src="${UI.imgUrl}" style="width:100%;border-radius:6px"><p class="small dim">이미지를 길게 눌러(또는 오른쪽 클릭) 저장한다.</p>`:''}<button class="btn" data-a="chimg" data-i="${sel.tab}:${e.id}"><b>이미지로 저장 · 공유</b><span class="dim small">이 결과 화면을 그림 파일로 만든다</span></button>${chBtns(sel.tab,e,true)}<button class="btn primary" data-a="chron">목록으로</button>`;
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
  /* 칭호의 정확한 조건: 하드 완주를 한 번이라도 하면 기록실에 열린다 */
  const TITLE_EXACT={"흑수 필두": "홍원에서 가주 승계를 포기하고 흑수로 활동해 필두에 오른다", "피의 왈츠": "결혼한 채 2급 이상, 직업 없이 18년차 이후에 만나는 \"엘레나 · 핏빛 밤\"을 이긴다", "엄지를 넘어선 자": "엄지에서 반역 줄기를 타고 \"엄지의 대모\"를 이긴다", "곰과 범을 넘어선 자": "검계의 배신 줄기에서 \"S사 절도사 · 김삿갓\"을 이긴다", "의리를 지킨 자": "중지 소속에서 원한의 장부를 받고 \"형님의 징벌을 받아들인다\"를 골라 큰누님의 시험(여섯 대)을 이긴다", "의리를 찢은 자": "중지 소속에서 원한의 장부를 받은 뒤 마지막 장부를 받아들이지 않고 찢는다", "끝내 갚지 않은 자": "의리를 찢은 뒤 나타나는 \"중지의 대리인\"을 이기고, 이어서 나타나는 \"중지의 큰형님의 사슬\"을 이긴다", "배신자를 갚은 자": "중지 3단계 이상(큰형님)으로 의리를 끝까지 마치고 큰누님을 쓰러뜨린 뒤 나타나는 \"배신자 마티아스\"를 이긴다", "허무를 넘어선 자": "허무 줄기에서 격리 실패의 환상체 네 마리를 모두 쓰러뜨린 뒤 \"허무의 광대\"를 이긴다", "정리 요원장": "W사 열차 직원으로 무한 모드에 들어가 서류를 접어 서랍에 넣고 열차에 남는다", "열차를 내린 자": "W사 열차 직원으로 무한 모드에 들어가 퇴직 서류에 서명하거나 웨이페어러 컴퍼니의 제안을 받는다", "혈귀를 잠재운 자": "혈귀 훈련 줄기에서 \"혈귀 · 카세티\"를 이긴다"};
  const TITLE_REC=['흑수 필두','본부 직속','특이점 부서','상석',CFG.nWing.eastTitle,'피의 왈츠','엄지를 넘어선 자','정해진 운명','곰과 범을 넘어선 자','의리를 지킨 자','의리를 찢은 자','끝내 갚지 않은 자','배신자를 갚은 자','허무를 넘어선 자','정리 요원장','열차를 내린 자','혈귀를 잠재운 자','특색'];
  /* 기록실 힌트: 아직 열리지 않은 칭호와 엔딩이 어떤 길 끝에 있는지 짐작만 하게 한다 */
  const TITLE_HINT={'흑수 필두':'홍원에서 승계를 포기하고 흑수로 활동해 필두에 오른다','본부 직속':'협회 최고 자리에 올라 본부의 부름을 넘긴다','특이점 부서':'날개 임원에 오른 뒤 핵심 부서의 심사를 통과한다','상석':'손가락의 서열 맨 위에서 마지막 부름을 통과한다',[CFG.nWing.eastTitle]:'동쪽 외곽 출신으로 N사 날개에 들어가 끝까지 오른다','피의 왈츠':'인연과 함께 핏빛 존재와 맞선다','엄지를 넘어선 자':'엄지의 아랫 조직 끝에서 엄지에게 칼을 뽑는다','정해진 운명':'엄지의 가장 높은 이에게 맞섰다가 쓰러진다','곰과 범을 넘어선 자':'검계의 끝에서 본국의 칼을 마주한다','의리를 지킨 자':'중지의 동생이 되어 받은 장부를 갚고 큰누님의 여섯 대를 버틴다','배신자를 갚은 자':'큰형님이 되어 큰누님을 쓰러뜨린 뒤, 달아난 마티아스를 쫓는다','허무를 넘어선 자':'격리 실패의 환상체 네 마리를 모두 쓰러뜨린 뒤, 하나가 된 무언가를 마주한다','의리를 찢은 자':'중지의 마지막 장부를 받아들이지 않고 찢는다','끝내 갚지 않은 자':'의리를 찢은 뒤 쫓아오는 중지의 사슬을 끊어낸다','특색':'해결사 1급에서 도시가 색을 불러 줄지 심사를 받는다'};
  const END_HINT={gwmoth:'날개의 병기였던 몸이, 밤에 어울리는 모습으로 끝에서 군림한다',gwroach:'날개의 병기였던 몸이, 무너지지 않는 모습으로 끝에서 군림한다',gwfly:'날개의 병기였던 몸이, 무리를 이끄는 모습으로 끝에서 군림한다',gwhuman:'날개의 병기였던 몸이, 끝에서 사람으로 남는다',clawreturn:'머리의 명령을 끝까지 따른 발톱이 무언가를 가져온다',clawstay:'머리의 명령을 끝까지 따른 발톱이 무언가를 무너뜨린다',arbkeep:'균형을 맞추던 이가 얻은 것의 한쪽을 남기고 끝낸다',arbdown:'균형을 맞추던 이가 지운 뒤에 자리에서 내려온다',libstay:'도서관에 남은 사서의 끝',libclose:'도서관의 문을 닫는 사서의 끝',hermobey:'지령을 끝까지 따른 대행자의 끝',hermfree:'지령 없이 맞이하는 아침',crowsucceed:'복제체의 길 끝에 닿는다',crowrefuse:'복제체의 길 끝에서 돌아오지 못한다',wfree:'열차를 내리는 길이 있다',wrival:'열차 밖에서 제안이 온다',wstay:'열차에 남는 길이 있다',hwmaker:'가주를 세우고 문 밖을 지킨다',hwflee:'후보를 데리고 가문을 떠난다',hwlose:'붉은 누각의 등이 켜진다',hwhost:'선황충을 받아들이고 가주의 자리에 앉는다',hwfree:'선황충을 받아들이지 않고 가주의 자리에 앉는다',hwbreak:'흑수 부하의 재갈을 많이 모아 철함사를 친다',rcorp:'존재를 끝까지 증명한다',death:'어딘가에서 쓰러진다',mind:'정신력이 0이 된다',distort:'정신력이 한계에 닿아 몸이 뒤틀린다',win:CFG.years+'년을 끝까지 산다',true:'제 2막 마지막 등급을 넘는다',outer:'무한 모드에서 스스로 외곽에서 끝낸다',out_seal:'무한 모드에서 균열로 흘러드는 히든 보스를 모두 쓰러뜨린다',out_star:'무한 모드에서 이름난 상대를 아주 많이 이긴다',out_settle:'무한 모드에서 가족과 오래 산다',distwin:'뒤틀린 채로 '+CFG.years+'년을 넘긴다',old:'무한 모드에서 백 살을 넘겨 산다',blank:'출생 화면에서 "어떤 출생 보정도 없이 시작한다"를 눌러 시작하고, 결혼하지 않은 채 '+CFG.years+'년을 채우고 제 2막으로 이어 가지 않고 끝낸다',blankwed:'출생 화면에서 "어떤 출생 보정도 없이 시작한다"를 눌러 아무것도 없이 시작하고, 결혼한 채 '+CFG.years+'년을 채우고 제 2막으로 이어 가지 않고 끝낸다',wed:'결혼한 채 '+CFG.years+'년을 채우고 제 2막으로 이어 가지 않고 끝낸다',lovekill:'뒤틀린 채 사랑하던 이에게 쓰러진다',overflow:''};
  /* 엔딩 힌트: 그 엔딩으로 이어지는 갈림길을 한 번이라도 지나치면, 소개 문구가 정확한 조건으로 바뀐다 */
  const END_EXACT={gwmoth:'G사 병기 출신으로 히든 장비를 3개 이상 먹어 왕족 인자를 깨우고 "나방 공주"를 고른 뒤, 73년차 "왕족의 자리에 앉는다"를 고른다',gwroach:'G사 병기 출신으로 히든 장비를 3개 이상 먹어 왕족 인자를 깨우고 "바퀴 황제"를 고른 뒤, 73년차 "왕족의 자리에 앉는다"를 고른다',gwfly:'G사 병기 출신으로 히든 장비를 3개 이상 먹어 왕족 인자를 깨우고 "파리 대왕"을 고른 뒤, 73년차 "왕족의 자리에 앉는다"를 고른다',gwhuman:'G사 병기 출신으로 73년차 "인간으로 남는다"를 고른다',clawreturn:'머리의 발톱 해금 출생으로 2막 끝까지 가서 지정사서들과 도서관 관장 아벨을 쓰러뜨리고, 종막에서 "도서관의 힘을 추출한다"를 고른다',clawstay:'머리의 발톱 해금 출생으로 2막 끝까지 가서 지정사서들과 도서관 관장 아벨을 쓰러뜨리고, 종막에서 "도서관을 파괴한다"를 고른다',arbkeep:'조율자 해금 출생으로 2막 끝까지 가서 지정사서들과 도서관 관장 아벨을 쓰러뜨리고, 종막에서 "도서관의 힘을 추출하고 한쪽을 남긴다"를 고른다',arbdown:'조율자 해금 출생으로 2막 끝까지 가서 지정사서들과 도서관 관장 아벨을 쓰러뜨리고, 종막에서 "도서관을 파괴하고 조율의 자리에서 내려온다"를 고른다',libstay:'도서관의 지정사서로 56년차부터 요동치는 붉은 책, 붉은 안개, 추출 통지서, 푸른 잔향, 검은 침묵, 총류의 층, 침묵의 오케스트라를 지나, 71년차 "응시자"에서 "추출을 받아들인다"를 고르고 73년차에 마지막 장을 덮는다',libclose:'도서관의 지정사서로 71년차 "응시자"에서 "추출을 막는다"를 고르고 바랄과 제나를 쓰러뜨린 뒤 73년차에 마지막 장을 덮는다',hermobey:'신탁대행자 · 헤르메스로 38년차 이후 "가족을 없애라"에서 "지령을 따른다"를 고르고, 제 2막 73년차 "같은 단말기"에서 뤼엔을 쓰러뜨린다.',hermfree:'신탁대행자 · 헤르메스로 "가족을 없애라"에서 "지령을 거부한다"를 고르거나 가족 지령을 거부하고, 거부 연전과 헤르메스의 자비를 받은 뒤 제 2막 73년차에 뤼엔을 쓰러뜨린다.',crowsucceed:'까마귀팀 복제체로 2막 끝(73년차)의 "처분 판정서를 쓰는 사람"에서 "총사령관의 자리를 잇는다"를 고르고 총사령관 니콜라이를 쓰러뜨린다.',crowrefuse:'까마귀팀 복제체로 2막 끝(73년차)의 "처분 판정서를 쓰는 사람"에서 "자리를 거부하고 사령관으로 남는다"를 고르고 총사령관 니콜라이를 쓰러뜨린다.',wfree:'W사에서 열차 직원을 고르고, 제 2막(무한 모드)의 "열차에서 내릴 수 있다면"에서 "퇴직 서류에 서명한다"를 고른다.',wrival:'W사에서 열차 직원을 고르고, 제 2막(무한 모드)의 "열차에서 내릴 수 있다면"에서 "웨이페어러 컴퍼니의 제안을 받는다"를 고른다.',wstay:'W사에서 열차 직원을 고르고, 제 2막(무한 모드)의 "열차에서 내릴 수 있다면"에서 "서류를 접어 서랍에 넣는다"를 고른다. ("조금 더 생각해 본다"는 5년 뒤 같은 서류가 다시 온다.)',
    hwmaker:'홍원 2년차에 승계를 내려놓고 흑수가 되어 필두까지 오른다. 후보를 차기 가주로 세우고, 45년차 이후 "철함사의 문 앞"에서 "문 밖에서 주위를 지킨다"를 고른 뒤 55년을 채운다.',
    hwflee:'홍원 2년차에 승계를 내려놓고 흑수가 되어 필두까지 오른다. 후보를 차기 가주로 세우고, 45년차 이후 "철함사의 문 앞"에서 "곁에서 지킨다"를 고른 뒤 추격 4팀(방계 자객조, 추격하는 흑수들, 흑수 필두들, 홍루)을 모두 쓰러뜨린다.',
    hwhost:'홍원 가주 후보 루트에서 "철함사의 소요"의 "선황충을 품는다"를 고르고, 이어지는 "홍루의 시험"에서 홍루를 쓰러뜨린다.',
    hwfree:'홍원 가주 후보 루트에서 "철함사의 소요"의 "거부하고 어르신들과 싸운다"를 고르고 철함사의 원로를 쓰러뜨린다.',
    hwbreak:'홍원 가주 후보 루트에서 흑수 선인에게 재갈을 4개 이상 모은 뒤, "철함사의 소요"에서 "철함사의 목을 친다"를 고르고 철함사의 가모를 쓰러뜨린다.',
    hwlose:'홍원 가주 후보 루트에서 "선황충을 품는다"를 고르고, "홍루의 시험"에서 홍루에게 쓰러진다.',
    rcorp:'R사 부화장 개체로 태어나 R사의 추격을 이겨 내고, 머리의 사자가 나타난 뒤 제 2막의 마지막 상대 "조율자 · 제나"를 쓰러뜨려 금기의 끝에 닿는다',
    death:'전투에서 HP가 0이 되어 쓰러진다',
    mind:'정신력이 바닥나 마음이 무너진다. 결혼한 인연이 있으면 목소리가 한 번만 붙잡아 준다',
    distort:'정신력이 바닥난 상태에서 목소리를 전혀 밀어내지 못해 개화하지 못하면 육신이 뒤틀리고, 뒤틀림의 이름을 정한다',
    true:'무한 모드에서 제 2막의 위협 등급을 끝까지 올라 마지막 등급 "발톱과 조율자"를 넘긴다',
    outer:'무한 모드에서 제 2막을 넘겨 외곽으로 나간 뒤, "외곽에서 이야기를 끝낸다"를 직접 고른다',
    out_seal:'무한 모드 외곽에서 균열로 흘러드는 히든 보스를 모두 쓰러뜨린다',
    out_star:'무한 모드 외곽에서 쓰러뜨린 상대가 16명 이상이 된다',
    out_settle:'무한 모드 외곽에서 결혼한 채 자식이 성인이 되고, 제 2막을 넘긴 뒤 12년이 지난다',
    distwin:'뒤틀린 몸으로 '+CFG.years+'년을 넘긴다',
    old:'무한 모드에서 나이가 100살을 넘긴다',
    blank:'출생 화면에서 "어떤 출생 보정도 없이 시작한다"를 눌러 시작하고, 결혼하지 않은 채 '+CFG.years+'년을 채우고 제 2막으로 이어 가지 않고 끝낸다',
    blankwed:'출생 화면에서 "어떤 출생 보정도 없이 시작한다"를 눌러 시작하고, 결혼한 채 '+CFG.years+'년을 채우고 제 2막으로 이어 가지 않고 끝낸다',
    wed:'결혼한 채 '+CFG.years+'년을 채우고 제 2막으로 이어 가지 않고 끝낸다',
    lovekill:'뒤틀린 몸으로 살아가다 찾아온 사냥에서, 사랑하던 이에게 쓰러진다'};
  const HINT_TRIG=[{t:'열차에서 내릴 수 있다면',k:['wfree','wrival','wstay']},{t:'철함사의 문 앞',k:['hwmaker','hwflee']},{t:'철함사의 소요',l:'선황충을 품는다',k:['hwhost','hwfree','hwbreak']},{t:'홍루의 시험',k:['hwhost','hwlose']}];
  function noteHint(ev){
    if(!ev||!ev.t)return;const ks=[];for(const h of HINT_TRIG)if(ev.t===h.t&&(!h.l||(ev.c||[]).some(c=>c.l===h.l)))ks.push(...h.k);
    if(!ks.length)return;const r=loadRec();r.hints=r.hints||{};let ch=false;for(const k of ks)if(!r.hints[k]){r.hints[k]=1;ch=true}if(ch)store.set(REC,JSON.stringify(r))}
  const hintRow=(open,label,hint)=>`<div style="display:flex;flex-direction:column;gap:5px;align-items:flex-start"><span class="chip${open?'':' dim'}">${open?label:'???'}</span><span class="small dim" style="white-space:pre-line">${esc(hint||'')}</span></div>`;
  /* 기록실: 대호수 도감. 대호수로 태어났거나 호수의 적을 한 번이라도 만난 기록이 있으면 보인다 */
  function vLakeRec(r){
    const ids=Object.keys(D.enemies).filter(id=>/^lake_(ywhale|whale|indigo)/.test(id));
    if(!ids.length||!(r.births||[]).concat(r.seen).some(x=>x==='대호수로 나간 자'||/^lake_/.test(x)))return '';
    const rows=(list,title)=>`<div><span class="small dim">${title}</span><div class="stack" style="gap:6px">${list.map(id=>{const e=D.enemies[id],seen=r.seen.includes(id),won=r.beaten.includes(id);
      return `<div style="display:grid;grid-template-columns:auto minmax(0,1fr);gap:8px;align-items:baseline"><span class="chip${seen?'':' dim'}"${won?` style="color:${e.color};border-color:${e.color}"`:''}>${seen?esc(e.n)+(won?' ✓':''):'???'}</span><span class="small dim">${won?(e.drop?esc(e.drop.e):'쓰러뜨렸다'):seen?'아직 이기지 못했다':'아직 만나지 못했다'}</span></div>`}).join('')}</div></div>`;
    const y=ids.filter(id=>/^lake_ywhale/.test(id)),w=ids.filter(id=>/^lake_whale/.test(id)),o=ids.filter(id=>/^lake_indigo/.test(id));
    return `<div class="panel stack" style="gap:8px"><span class="eyebrow">대호수 도감 · 대재앙 ${w.filter(id=>r.beaten.includes(id)).length}/${w.length} · 어린 고래 ${y.filter(id=>r.beaten.includes(id)).length}/${y.length}</span>${rows(w,'대재앙')}${rows(y,'보스급 고래')}${rows(o,'그 밖에')}</div>`
  }
  /* 기록실: 칸 제목을 누르면 그 칸이 접히고 펼쳐진다 (브라우저에 기억) */
  const BOND_COND={claw:'머리의 발톱으로 태어났을 때',arbiter:'조율자로 태어났을 때',librarian:'도서관의 지정사서일 때 (세 부서장 중 한 사람을 고른다)',gweapon:'G사 병기 출신으로 G사가 몰락한 뒤 해결사로 등록했을 때',office:'사무소 소속일 때',assoc:'협회 소속일 때',wing:'날개 소속일 때',freelance:'해결사로 등록하고 소속 없이 지내거나 자기 사무소를 열었을 때',thumb:'엄지 소속일 때',pointer:'검지 소속일 때',middle:'중지 소속일 때',ring:'약지 소속일 때',kuro:'흑운회 소속일 때',blade:'검계 소속일 때',awl:'밤의 송곳 소속일 때',hyeolgwi:'혈귀로 태어났을 때',east:'동부 출신 외곽 생존자로 태어났을 때',highfixer:'해결사 '+CFG.bond.hidden.rank+'급 이상일 때 ('+CFG.bond.hidden.chance+'%)',rcorp:'R사 부화장에서 쫓기는 줄기일 때',hcorp:'홍원(H사) 줄기일 때',hermes:'신탁대행자 · 헤르메스로 태어났을 때',crow:'까마귀팀 복제체로 태어났을 때',lake:'대호수로 나간 자일 때',finger:'소지 표식을 가진 채 손가락 조직원이 아닌 곳에서 지낼 때'};
  const FLAG_TX={giri:'중지의 의리 줄기를 탄',giriDone:'의리 줄기를 끝까지 마친',giriObey:'의리에 순종한',giriTraitor:'의리를 배신한',thumbRebel:'엄지에 반역한',traitor:'배신 줄기를 탄',prophecy:'예언 줄기를 탄',starborn:'별 태생인',lamancha:'라만차 줄기를 탄',taboo:'금기를 어긴',libraryGuest:'도서관의 손님 줄기를 탄',defied:'지령을 어긴',synTop:'조직 최상위에 오른',nihil:'허무 줄기를 탄'};
  const reqPart=t=>{const nm=id=>(D.enemies[id]||{}).n||id;let m;
    if(t==='nojob')return '직업 없이';if(t==='pinky')return '소지 표식을 가진 채';if(t==='bondmarried')return '결혼한 채';if(t==='wtrain')return '혈귀 훈련 줄기일 때';
    if(m=t.match(/^affname:(.+)$/))return m[1]+' 소속일 때';if(m=t.match(/^notaffname:(.+)$/))return m[1]+' 소속이 아닐 때';
    if(m=t.match(/^rank<=(\d+)$/))return m[1]+'급 이상일 때';if(m=t.match(/^fi>=(\d+)$/))return '손가락 '+m[1]+'단계 이상일 때';
    if(t==='beat:any')return '히든 보스를 한 번 이긴 뒤';
    if(m=t.match(/^beat:(.+)$/))return m[1].split('|').map(nm).join(' · ')+(m[1].includes('|')?' 중 하나':'')+'를 이긴 뒤';
    if(m=t.match(/^flag:(\w+)>=(\d+)$/))return (FLAG_TX[m[1]]||m[1])+' 횟수가 '+m[2]+'번 이상일 때';
    if(m=t.match(/^flag:(\w+)$/))return (FLAG_TX[m[1]]||m[1])+' 상태일 때';
    return '';};
  const reqText=q=>{const out=[];const walk=x=>{if(!x)return;if(Array.isArray(x))x.forEach(walk);else if(typeof x==='object'){if(x.any)out.push((x.any.map(reqPart).filter(Boolean)).join(' 또는 '))}else{const t=reqPart(x);if(t)out.push(t)}};walk(q);return out.join(' · ')};
  const BOSS_HOW={"pil1": ["중지의 의리 줄기", "중지 소속에서 의리 순례(원한의 장부)를 시작한다"], "pil2": ["중지의 의리 줄기", "원한의 장부 첫 페이지를 이긴다"], "pil_trial": ["중지의 의리 줄기", "장부를 받은 뒤 형님의 징벌을 받아들인다"], "pil_hunter1": ["중지의 의리 줄기", "장부를 찢어 의리를 배신한다"], "pil_hunter2": ["중지의 의리 줄기", "중지의 대리인을 이긴다"], "pil_matthias": ["중지의 의리 줄기", "중지 3단계 이상에서 의리를 마친 뒤 큰누님을 이긴다"], "bigsis": ["중지", "히든 보스를 한 번 이긴 뒤 만난다. 중지 소속일 때 훨씬 자주 나온다"], "matthias": ["중지", "중지 소속에서 의리 줄기를 타지 않고 15년차 이후에 만난다"], "matthias2": ["중지가 아닌 곳", "다른 소속에서 15년차 이후, 히든 보스를 한 번 이긴 뒤 만난다"], "godmother": ["엄지의 반역 줄기", "엄지에서 반역을 택한다"], "godfather": ["엄지", "히든 보스를 한 번 이긴 뒤 만난다. 엄지 성향이 높을수록 자주 나온다"], "leihuang": ["엄지", "엄지 소속이거나 히든 보스를 한 번 이긴 뒤 만난다. 엄지면 훨씬 자주 나온다"], "proxy": ["검지", "검지 소속이거나 지령을 어긴 뒤 13년차 이후에 만난다. 검지면 더 자주 나온다"], "araya": ["약지", "직업 없이 13년차 이후에 만난다. 약지 소속이면 훨씬 자주 나온다"], "ryoshu": ["약지", "약지 소속에서 신체파 도슨트를 이긴 뒤 18년차 이후에 만난다"], "twistedjun": ["검계", "검계 최상위(조직 정상)에 오른 뒤 만난다"], "jeoldosa": ["검계의 배신 줄기", "배신 줄기를 탄다"], "jester": ["허무 줄기", "허무 줄기를 탄다"], "apocalypse": ["예언 줄기", "예언 줄기를 타고 2급 이상으로 20년차 이후에 만난다"], "hongwon": ["홍원", "별 태생이면 65년차 이후, 소지 표식을 가진 채면 40년차 이후에 만난다"], "dulcinea": ["라만차 줄기", "라만차 줄기에서 신부를 이긴 뒤 18년차 이후에 만난다"], "priest": ["라만차 줄기", "라만차 줄기를 타고 17년차 이후에 만난다"], "arbiter": ["금기 줄기", "금기를 두 번 이상 어기고 이미 히든 보스 하나를 이긴 뒤, 직업 없이 13년차 이후에 만난다"], "claw": ["금기 줄기", "금기를 한 번 어기고 이미 히든 보스 하나를 이긴 뒤, 직업 없이 13년차 이후에 만난다"], "library": ["도서관 줄기", "도서관 손님 줄기를 탄다"], "abel": ["도서관 줄기", "도서관의 사서를 이긴 뒤 20년차 이후에 만난다"], "black": ["해결사 2급 이상", "2급 이상이 된 뒤 13년차 이후에 만난다"], "blue": ["해결사 2급 이상", "2급 이상이 된 뒤 13년차 이후에 만난다"], "scarlet": ["해결사 2급 이상", "2급 이상이 된 뒤 13년차 이후에 만난다. 열기 성향이면 더 자주 나온다"], "violet": ["해결사 2급 이상", "2급 이상이 되고 검은 침묵을 이긴 뒤 만난다. 검 성향이면 더 자주 나온다"], "nothing": ["해결사 3급 이상", "3급 이상이 되고 히든 보스를 한 번 이긴 뒤, 20년차 이후에 만난다"], "orchestra": ["해결사 3급 이상", "3급 이상이 되고 히든 보스를 한 번 이긴 뒤, 20년차 이후에 만난다"], "elena": ["결혼", "결혼한 채 2급 이상, 직업 없이 18년차 이후에 만난다"], "kasetti": ["혈귀 훈련 줄기", "혈귀 훈련 줄기를 탄다"]};
  /* 히든 보스 도감: 하드 완주 전에는 ???, 하드 완주 후에는 1차(어디서·어떤 조건) 설명, 한 번이라도 만나면 2차(획득 방법) 설명 */
  function hiddenDex(r){
    const hb=D.hiddenBosses||[],ids=[...new Set(hb.map(h=>h.id))].filter(id=>D.enemies[id]);
    const rows=ids.map(id=>{const e=D.enemies[id],hs=hb.filter(h=>h.id===id),seen=(r.seen||[]).includes(id),won=(r.beaten||[]).includes(id);
      const conds=hs.map(h=>reqText(h.req)).filter(Boolean),from=Math.min(...hs.map(h=>h.from||1));
      const route=hs.some(h=>JSON.stringify(h.req||'').includes('affname'))?'소속 줄기':'갈림길';
      const d=e.drop||{},gears=[...(d.gears||[]).map(g=>g.n),...(d.gear?[d.gear.n]:[])];
      let tx;
      if(seen)tx=`만난 곳: ${BOSS_HOW[id]?BOSS_HOW[id][1]:(conds.join(' / ')||'조건 없음')+' · '+from+'년차부터'}\n이기면: ${gears.length?gears.join(' · ')+' 획득':(d.n?d.n+' 획득':'쓰러뜨린 기록이 남는다')}${won?'':'\n지면: 이야기가 거기서 끝난다'}${won?'\n✓ 쓰러뜨렸다':''}`;
      else if(r.hardClear)tx=BOSS_HOW[id]?`[하드 완주 보상] ${BOSS_HOW[id][0]}에서 만날 수 있다\n${BOSS_HOW[id][1]}`:`[하드 완주 보상] ${route}에서 만날 수 있다\n조건: ${conds.join(' / ')||'조건 없음'} · ${from}년차부터`;
      else tx='';
      return [seen,seen?esc(e.n)+(won?' ✓':''):'???',tx||(seen?'':'하드 완주 후에 어디서 만나는지 알 수 있다')]});
    const got=rows.filter(x=>x[0]).length;
    return `<div class="panel stack" style="gap:6px"><span class="eyebrow">히든 보스 도감 · 만난 ${got}/${rows.length}</span><div class="stack" style="gap:10px">${rows.map(([o,l,h])=>`<div style="display:flex;flex-direction:column;gap:5px;align-items:flex-start"><span class="chip${o?'':' dim'}">${l}</span><span class="small dim" style="white-space:pre-line">${esc(h)}</span></div>`).join('')}</div><p class="small dim">${r.hardClear?'하드 완주 보상: 만나지 못한 상대는 어디서 만나는지, 만난 상대는 얻는 방법이 열려 있다.':'하드 완주를 하면 만나지 못한 상대가 어디서 나오는지 알 수 있다.'}</p></div>`}
  const REC_TABS=['요약','칭호','인연','엔딩','히든 보스','출생·소속','장비','상대'];
  const recTabOf=t=>/^(최고 기록|판 통계)/.test(t)?'요약':/^칭호/.test(t)?'칭호':/^인연/.test(t)?'인연':/^엔딩/.test(t)?'엔딩':/^히든 보스/.test(t)?'히든 보스':/^(히든 출생|소속|타고난 것|해금 출생|히든 직업)/.test(t)?'출생·소속':/^특수 장비/.test(t)?'장비':'상대';
  const RFK='cy_recfold',recFold=()=>{try{return JSON.parse(localStorage.getItem(RFK)||'[]')||[]}catch(e){return []}};
  const vRecords=()=>{const f=recFold(),tab=UI.recTab||'요약';const html=vRecords0().replace(/<div class="panel stack"( style="[^"]*")?><span class="eyebrow">([^<]*)<\/span>/g,(m,st,t)=>{const k=t.replace(/\s*·.*$/,'').replace(/\s*[0-9].*$/,'')||t,c=f.includes(k);return `<div class="panel stack rfold${c?' closed':''}"${(()=>{const hide=recTabOf(t)!==tab;if(!hide)return st||'';return st?st.replace(/"$/,';display:none"'):' style="display:none"'})()}><span class="eyebrow rfh" data-a="rfold" data-i="${esc(k)}" role="button" aria-expanded="${!c}">${c?'▸':'▾'} ${t}</span>`});return html};
  function vRecords0(){
    const r=loadRec(),X=CFG.endless,u=loadUnlocks();
    const ends0=[['gwmoth','나방 공주의 밤'],['gwroach','바퀴 황제의 왕좌'],['gwfly','파리 대왕의 식탁'],['gwhuman','인간으로 남은 병기'],['clawreturn','돌아온 발톱'],['clawstay','길을 닫은 발톱'],['arbkeep','한쪽을 남긴 조율자'],['arbdown','내려온 조율자'],['libstay','책이 된 사서'],['libclose','문을 닫는 사서'],['wfree','열차를 내린 사람'],['wrival','열차를 쓰지 않는 계약'],['wstay','출발 신호음 없는 열차'],['rcorp','나는 존재한다'],['hwhost','선황충을 품은 가주'],['hwmaker','가주메이커'],['hwflee','후보를 데리고 떠난 필두'],['hwlose','홍원 군주의 탄생'],['hwfree','홍원의 가주'],['hwbreak','철함사의 목을 친 가주'],['crowsucceed','처분 판정서의 마지막 장'],['hermobey','끝난 지령'],['hermfree','지령 없는 아침'],['crowrefuse','돌아가지 못한 사령관'],['death','쓰러짐'],['mind','정신 붕괴'],['distort','뒤틀림'],['win',CFG.years+'년 완주'],['true','발톱과 조율자 너머'],['outer','외곽에서 끝낸 이야기'],['out_seal','균열이 닫힌 외곽'],['out_star','도시의 별'],['out_settle','외곽의 작은 집'],['distwin','뒤틀린 채 완주'],['old','늙어도 살아남은'],['blank','아무것도 없는 존재'],['blankwed','아무것도 없는 존재 · 가족'],['wed','함께 넘은 첫 번째 막'],['lovekill','사랑하던 이의 손에'],['overflow','히든 엔딩 · 오버플로우']];
    /* 오버플로우(무한 모드 1000살)는 달성하기 전에는 칸도 개수도 보이지 않는다 */
    const ends=ends0.filter(([k])=>k!=='overflow'||r.endings.includes('overflow'));
    const groups=[['초반','early'],['중반','mid'],['후반','late'],['보스·이름난 상대','boss'],['히든','hidden']];
    const foes=g=>Object.entries(D.enemies).filter(([,e])=>e.tier===g);
    const total=Object.keys(D.enemies).length;
    return `<div class="stack" style="gap:6px;padding-top:12px"><div class="eyebrow">이 브라우저의 기록</div><h2>기록실</h2></div>
      <div class="seg kinds" style="margin:4px 0">${REC_TABS.map(k=>`<button class="${(UI.recTab||'요약')===k?'on':''}" data-a="rectab" data-i="${k}">${k}</button>`).join('')}</div>
      <div class="panel stack" style="gap:6px"><span class="eyebrow">최고 기록</span>
        <div class="row between"><span>가장 오래 산 햇수</span><b class="mono">${r.best.years}년</b></div>
        ${r.hardClear?`<div class="row between"><span>하드 완주</span><b class="mono">${r.hardClear}회</b></div>`:''}${r.easyClear?`<div class="row between"><span>쉬움 완주</span><b class="mono">${r.easyClear}회</b></div>`:''}
        <div class="row between"><span>최고 레벨</span><b class="mono">${r.best.lv||'—'}</b></div>
        <div class="row between"><span>도달한 위협 등급</span><b class="mono">${r.best.grade>=0?X.grades[r.best.grade]:'—'}</b></div>
        <div class="row between"><span>끝낸 판</span><b class="mono">${r.runs}</b></div></div>
      <div class="panel stack" style="gap:6px"><span class="eyebrow">칭호 · 최고 등급에 오른 횟수</span><div class="stack" style="gap:6px">${TITLE_REC.map(n=>{const c=(r.titles||{})[n]||0;return hintRow(c,`${esc(n)} ×${c}`,!c&&r.hardClear&&TITLE_EXACT[n]?'[하드 완주 보상] '+TITLE_EXACT[n]:TITLE_HINT[n])}).join('')}</div></div>
      ${(()=>{const BDc0=CFG.bond,LR={claw:'발톱',arbiter:'조율자',librarian:'도서관',gweapon:'G사 병기',office:'사무소',assoc:'협회',wing:'날개',finger:'소지',thumb:'엄지',pointer:'검지',middle:'중지',ring:'약지',kuro:'흑운회',blade:'검계',awl:'밤의 송곳',hyeolgwi:'혈귀',freelance:'무소속',east:'동부 외곽 출신',highfixer:'고급 해결사',rcorp:'R사',hcorp:'H사',lake:'대호수'},lov=r.lovers||{},rows=[];
        for(const [rk,R] of Object.entries((D.bond&&D.bond.routes)||{}))for(let vi=0;vi<(R.variants?R.variants.length:1);vi++){const V=R.variants?R.variants[vi]:R,lv=lov[rk+':'+vi]||0;rows.push([lv,lv?`${lv>1?'♥':'✓'} ${V.who}`:'???',lv?`${LR[rk]||rk} · ${V.look||''}`:r.hardClear&&V.meet?`[하드 완주 보상] ${LR[rk]||rk} 줄기에서 만날 수 있다\n조건: ${BOND_COND[rk]||'해당 줄기일 때'} · ${BDc0.from}년차부터\n만남 사건 「${V.meet.t}」`:rk==='finger'?'소지 표식을 가진 채 손가락 조직원이 아닌 곳(사무소·협회·날개·무소속)에서 지내면, 말수가 적은 사람이 먼저 눈을 마주친다':`${LR[rk]||rk} 쪽에서 만난다`])}
        const met=rows.filter(x=>x[0]).length,wed=rows.filter(x=>x[0]>1).length;
        return `<div class="panel stack" style="gap:6px"><span class="eyebrow">인연 · 만난 ${met}/${rows.length} · 결혼 ${wed}</span><div class="stack" style="gap:6px">${rows.map(([lv,l,h])=>`<div style="display:flex;flex-direction:column;gap:5px;align-items:flex-start"><span class="chip${lv?'':' dim'}" style="${lv>1?'color:var(--bleed);border-color:var(--bleed)':''}">${esc(l)}</span><span class="small dim" style="white-space:pre-line">${esc(h)}</span></div>`).join('')}</div><p class="small dim">✓ 만나 본 인연 · ♥ 결혼까지 간 인연. 소속마다 만나는 사람이 다르다.</p></div>`})()}
      ${(()=>{const H=D.hiddenOrigins||[],got=r.births||[];return H.length?`<div class="panel stack" style="gap:6px"><span class="eyebrow">히든 출생 ${H.filter(x=>got.includes(x.n)).length}/${H.length}</span><div class="stack" style="gap:6px">${H.map(x=>{const o=got.includes(x.n);return `<div style="display:grid;grid-template-columns:auto minmax(0,1fr);gap:8px;align-items:baseline"><span class="chip${o?'':' dim'}" style="justify-self:start">${o?esc(x.n):'???'}</span><span class="small dim">${o?esc(String(x.t||'').split(/(?<=[.다])\s/)[0]):'아직 태어나 보지 못했다'}</span></div>`}).join('')}</div><p class="small dim">그 출생으로 한 번이라도 시작하면 열린다.</p></div>`:''})()}
      ${(()=>{const GR=[['날개','wing'],['협회','assoc'],['사무소','office'],['손가락','finger'],['조직','syn']],all=GR.flatMap(([,k])=>D.orgs[k]||[]),got=(r.affs||[]).filter(n=>all.includes(n));
        return `<div class="panel stack" style="gap:8px"><span class="eyebrow">소속 ${got.length}/${all.length}</span>${GR.map(([n,k])=>`<div><span class="small dim">${n}</span><div class="chips">${(D.orgs[k]||[]).map(o=>`<span class="chip${(r.affs||[]).includes(o)?'':' dim'}">${(r.affs||[]).includes(o)?esc(o):'???'}</span>`).join('')}</div></div>`).join('')}<p class="small dim">한 번이라도 들어간 소속이 열린다.</p></div>`})()}
      ${hiddenDex(r)}
      <div class="panel stack" style="gap:6px"><span class="eyebrow">엔딩 ${r.endings.length}/${ends.length}</span>${r.hardClear?'<span class="small dim">하드 완주 보상 · 모든 엔딩의 정확한 조건이 열려 있습니다</span>':''}<div class="stack" style="gap:6px">${ends.map(([k,n])=>{const op=r.endings.includes(k),pass=!!(r.hints&&r.hints[k])&&END_EXACT[k],hd=!!r.hardClear&&END_EXACT[k];return hintRow(op,esc(n),(op||pass||hd)&&END_EXACT[k]?(!op?(pass?'[갈림길을 지나쳤다] ':'[하드 완주 보상] '):'')+END_EXACT[k]:END_HINT[k])}).join('')}</div></div>
      ${(()=>{const cat=specCat(),ids=Object.keys(cat.g),gs=r.gears||[],pk=Object.keys(cat.p),pg=r.packs||[];return `<div class="panel stack" style="gap:8px"><span class="eyebrow">특수 장비 ${ids.filter(k=>gs.includes(k)).length}/${ids.length}</span><div class="chips">${ids.map(k=>`<span class="chip${gs.includes(k)?'':' dim'}">${gs.includes(k)?esc(cat.g[k]):'???'}</span>`).join('')}</div>
        <span class="eyebrow">전용 카드팩 ${pk.filter(k=>pg.includes(k)).length}/${pk.length}</span><div class="chips">${pk.map(k=>`<span class="chip${pg.includes(k)?'':' dim'}">${pg.includes(k)?esc(k)+' · '+cat.p[k]+'장':'???'}</span>`).join('')}</div>
        <p class="small dim">히든 보스 전리품, 출신 전용 장비, 전용 카드팩이 쌓인다. 이름을 직접 정하는 것(성도 · 개화 · 뒤틀림)은 넣지 않았다. 아직 얻지 못한 것은 ???로 제자리에 두어, 어디쯤 있는 장비인지 짐작할 수 있다.</p></div>`})()}
      <div class="panel stack" style="gap:6px"><span class="eyebrow">타고난 것 ${r.innate.length}/${Object.keys(D.innate).length}</span><div class="chips">${Object.entries(D.innate).map(([k,v])=>`<span class="chip${r.innate.includes(k)?'':' dim'}">${r.innate.includes(k)?esc(v.n):'???'}</span>`).join('')}</div>${Object.entries(D.innate).filter(([k,v])=>v.unlock&&!(r.unl||[]).includes(k)).map(([k,v])=>`<span class="small dim">잠김 · ${r.innate.includes(k)?esc(v.n):'???'} — 해금: ${esc(v.unlock)}</span>`).join('')}${Object.entries(D.innate).filter(([k,v])=>v.unlock&&(r.unl||[]).includes(k)).map(([k,v])=>`<span class="small" style="color:var(--gold)">해금됨 · ${r.innate.includes(k)?esc(v.n):'???'} — 이제 태어날 때 1%로 나올 수 있다${r.innate.includes(k)?'':' (만나면 이름이 열린다)'}</span>`).join('')}</div>
${(()=>{const S=r.st;if(!S||!S.n)return `<div class="panel stack" style="gap:6px"><span class="eyebrow">판 통계</span><p class="small dim">v8.2.0부터 집계한다. 이야기가 끝나면 여기에 쌓인다.</p></div>`;
        const top=(m,n)=>Object.entries(m||{}).sort((a,b)=>b[1]-a[1]).slice(0,n),line=(l,arr)=>arr.length?`<div class="row between" style="align-items:flex-start;gap:10px"><span>${l}</span><span class="small" style="text-align:right">${arr.map(([k,v])=>`${esc(k)} ×${v}`).join(' · ')}</span></div>`:'',en=Object.fromEntries(ends);
        return `<div class="panel stack" style="gap:6px"><span class="eyebrow">판 통계 · v8.2.0부터 집계</span>
        <div class="row between"><span>집계한 판</span><b class="mono">${S.n}</b></div>
        <div class="row between"><span>평균 생존</span><b class="mono">${(S.sum/S.n).toFixed(1)}년</b></div>
        <div class="row between"><span>가장 짧게 · 길게</span><b class="mono">${S.min}년 · ${S.max}년</b></div>
        ${line('엔딩',top(S.ends,6).map(([k,v])=>[en[k]||k,v]))}${line('자주 쓴 소속',top(S.aff,3))}${line('자주 나온 출신',top(S.ori,3))}${line('자주 나온 타고난 것',top(S.inn,3))}</div>`})()}
      ${vJobs()}${vOrigins()}
      ${vLakeRec(r)}
      <div class="panel stack" style="gap:8px"><span class="eyebrow">만난 상대 ${r.seen.filter(id=>D.enemies[id]).length}/${total} · 이긴 상대 ${r.beaten.filter(id=>D.enemies[id]).length}</span>
        ${groups.map(([n,g])=>{const l=foes(g);return l.length?`<div><span class="small dim">${n}</span><div class="chips">${l.map(([id,e])=>`<span class="chip${r.seen.includes(id)?'':' dim'}" ${r.beaten.includes(id)?`style="color:${e.color};border-color:${e.color}"`:''}>${r.seen.includes(id)?esc(e.n)+(r.beaten.includes(id)?' ✓':''):'???'}</span>`).join('')}</div></div>`:''}).join('')}
        <p class="small dim">✓ 표시는 한 번 이상 이긴 상대. 기록은 이 브라우저에만 남는다.</p></div>
      <button class="btn primary" data-a="title">돌아가기</button>`;
  }
  /* 이번 업데이트: 처음 화면에서 접어 둔다 */
  const DIRECTION=['전체 밸런스: 몬스터 조정과 아이템(이펙트 포함) 조정을 고민 중입니다.','테섭에서 시험 중인 새 시스템의 수치는 의견을 보고 조정하고, 본섭에 넣을 시기를 정합니다.','자동 전투 속도와 연출 설정은 쓰면서 불편한 점을 제보로 알려 주세요.'];
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
  const V934SEC=[['⚔ 후반 보스 · 무기',['일부 후반 히든 보스의 능력치와 그 전리품 무기를 조정했습니다.','검은 침묵의 장갑이 주는 카드 Furioso가 크게 강해졌습니다. 주사위 9개가 모두 3~14로 고정되고 명중 +30이 붙습니다.']],
    ['🔬 특이점 · 금기 설명',['특이점 강화는 최대 3번까지이고, 다 채우면 더 오르지 않습니다.','금기 실험은 강화와 따로 최대 8번까지 할 수 있습니다. 8번을 채우면 머리가 발톱과 조율자를 보내고, 둘을 이기면 보상을 한 번 받습니다. 이미 둘을 이긴 사람은 금기 실험마다 가끔 장비 없이 돈과 경험치를 주는 더 단단한 시험이 찾아오고, 8번째에는 확정입니다. 8번을 채우면 특이점이 2단계 더 강해집니다(2차 강화). 결혼 중에 금기를 저지르면 배우자가 죽을 위험이 붙습니다.']],
    ['🔧 수정',['엄지의 "상납 마감"이 상석 대부에게도 나오던 문제를 고쳤습니다. 이제 솔다토에게만 나오고, 카포 이상에게는 아랫사람의 몫을 두고 책임을 정하는 사건이 나옵니다.','홍원 가주의 자리에서 얻는 흑수 재갈이 카드와 전리품으로 지급되지 않던 문제를 고쳤습니다. 새로 잡는 판부터 적용됩니다.']]];
  const V940SEC=[['♾ 무한 모드 · 전투 규칙',['무한 모드(73년차 이후)에서 한 해가 지날 때마다 플레이어의 기본 회피가 1씩 줄어듭니다(0에서 멈춤). 장비·정신력 등으로 얻은 회피는 줄지 않고, 스탯창의 회피에 "(무한 −N)"으로 표시됩니다.','적은 2해마다 명중 보정이 1씩 오릅니다.','한 전투에서 공격을 한 번 맞을 때마다, 맞은 쪽이 받는 피해가 3%씩 늘어납니다(최대 2배). 플레이어와 적 모두에게 똑같이 적용되고, 전투가 끝나면 처음부터 다시 쌓입니다.','중지는 이 규칙이 다르게 적용됩니다. 회피를 쓰기 어려워 맞는 일이 많으므로 받는 피해가 늘어나지 않고, 한 번 맞을 때마다 받는 피해가 1%p씩 줄어듭니다(전투 내 누적).']],
    ['🛡 받는 피해 감소 상한',['근성·초근성, 하나 협회의 곤, 출생·전리품 효과, 호위의 막아섬 등 받는 피해 감소를 모두 합쳐 최대 70%까지만 적용됩니다. 합이 이보다 높아져도 70%입니다.']]];
  const V942SEC=[['♾ 무한 모드 조정',['전투에서 맞을 때마다 받는 피해가 늘어나는 규칙이 복리로 바뀌었습니다. 맞을 때마다 직전 배율에 3%를 곱하고, 플레이어는 최대 4배, 적은 최대 30배까지 늘어납니다. 오래 끄는 싸움일수록 맞는 것이 치명적입니다.','중지는 맞을 때마다 받는 피해가 1%p씩 줄어드는 규칙이 그대로이고, 이 누적 감소는 최대 20%에서 멈춥니다.']],
    ['🩸 출혈 상한',['플레이어가 적에게 거는 출혈의 최대 스택이 10에서 40으로 늘었습니다. 적이 플레이어에게 거는 출혈은 그대로 10입니다.']]];
  const V943SEC=[['🔧 버그 수정',['날개 대표에게 "날개 채용 공고", "조직의 손짓", "협회 추천서"가 나오던 문제를 고쳤습니다. 날개 대표는 이제 이 사건들이 나오지 않습니다.','이미 1급인 해결사에게 "급수 심사"와 "승급 추천"이 나오던 문제를 고쳤습니다. 2급 이하일 때만 나옵니다.','도서관을 이미 잡았거나 두 번째 초대장에 이미 답한 뒤에도 "두 번째 초대장"이 계속 나오고, 해의 마지막 날 이벤트를 예고하고도 아무것도 일어나지 않던 문제를 고쳤습니다.']],
    ['⚖ 조정',['혈귀의 혈찬 회복량을 줄였습니다. 상대 출혈이 5번 발동할 때마다 HP 15를 회복하던 것이 HP 8을 회복합니다. 출혈 최대 스택이 늘어난 데 맞춘 조정입니다.']]];
  const V984SEC=[['🎵 소리·연출',['타격 이펙트: 공격이 맞을 때 베기·찌르기·충격 같은 효과가 나옵니다. 설정에서 끔·가볍게·보통·강하게로 고를 수 있습니다.','배경음악: ♪ 버튼으로 켜고 끕니다(기본은 꺼짐). 고요·불길·도서관 세 가지 스타일이 있고, 전투 곡이 따로 있습니다.','효과음: 참격·관통·타격을 소리로 구분할 수 있게 다시 만들었습니다.']],
      ['🚆 W사',['W사에 신규 직업 "워프열차 정리직"이 추가되었습니다.','정리직 전용 무기와 책장이 있습니다.']],
      ['🏯 흑수 루트',['흑수 루트가 추가되었습니다. 흑수 전용 카드와 무기가 있습니다. 어디서 열리는지는 직접 찾아보세요.']],
      ['🩸 혈귀',['혈귀 종족 특수 이벤트가 하나 추가되었습니다.']],
      ['⚔ 규칙·장비·적',['공격 수치 규칙을 바꿨습니다. 공격 2당 명중 1, 공격 6당 피해 1이 붙습니다. 상태 화면에서 환산을 볼 수 있습니다.','공방 해결사는 전용 장비로 시작하고 보관함 장비를 녹여 계속 강화합니다.','초반 적이 늘었고, 적마다 싸우는 이유를 붙이고 있습니다.','숨은 요소 일부가 추가·개편되었습니다. 어디에 있는지는 직접 찾아보세요.']],
      ['📜 엔딩 힌트',['기록실의 엔딩 힌트가 더 분명해졌습니다. 엔딩으로 이어지는 갈림길을 한 번이라도 지나치면, 그 엔딩의 소개 문구가 정확한 조건으로 바뀝니다.']],
      ['🔧 그 밖에',['청혼과 결혼 판정을 고쳤습니다.','무한 모드에 전공 승급과 전용 사건이 추가되었습니다. 덜 본 사건이 먼저 나오고, 같은 사건이 반복되면 문구가 달라집니다.','보냐텔리 가문 출신 설명에 남아 있던 엄지 90% 문구를 지웠습니다.','일부 문구를 다듬었습니다. (웃는 가로등 설명, 기록실 엔딩 힌트 표기)','적 40여 종에 싸우는 이유를 붙였습니다.','협회 직원도 "본부 직속"에 오르면 해결사 1급이 되고, 특색 심사를 따로 받을 수 있습니다.','무기 흡수(미미크리 등)의 횟수 제한을 전투당 5번에서 턴당 5번으로 바꿨습니다.','배경 테마(단테·검지 단말기·도서관)의 보조 글자 색을 밝혀 읽기 쉽게 했습니다.','자동 전투가 0코스트 버프 카드(방어막·명중 보정·빛 획득 등)를 쓰지 않던 문제를 고쳤습니다.','흑수 루트에서 후보 이름이 {c}로 그대로 보이던 문제를 고쳤습니다.','인연을 만나는 시기를 27세 이후 40세 안쪽으로 앞당겼습니다.','회복 카드(재생 조직 등)는 한 번 쓰면 몇 턴 동안 손패에 들어오지 않습니다. 덱이 작을 때 매 라운드 쓰던 문제를 고쳤습니다.','R사 부화장 출신의 배치 설명과 연인 문구를 고쳤습니다.','아이폰 무음 모드에서 배경음악·효과음이 나지 않던 문제를 줄이는 수정을 넣었습니다. (연출 끔 상태에서도 효과음이 납니다)']]];
  const V985SEC=[['🛠 공방 해결사',['공방 해결사 밸런스를 조절했습니다. 기본 아이템 수치를 다시 맞췄습니다.','전투 2번마다 랜덤 재료 아이템을 주는 기능이 제대로 동작하지 않던 버그를 고쳤습니다.','강화 15단계까지 5단계마다 한 번씩 크게 오르는 구간을 추가했습니다. 그 뒤의 무한 강화에는 5단계 보너스가 없습니다.']]];
  const V986SEC=[['🛠 공방 해결사',['공방 해결사 밸런스를 조절했습니다. 기본 아이템 수치를 다시 맞췄습니다.','공방 해결사가 전투를 두 번 이길 때마다 재료용 장비(무기·방어구·의수) 중 하나를 줍니다. 이전 버전에서는 이 보상이 나오지 않던 버그가 있었습니다. 무한 모드에서는 5해마다 한 번 나옵니다.','강화 15단계까지 5·10·15단계에서 크게 오르는 특수 강화를 추가했습니다. 그 뒤의 무한 강화에는 5단계 보너스가 없습니다.','의수도 강화할 수 있습니다. 5·10·15단계마다 공격·회피·명중 중 하나를 고릅니다.','공방 해결사도 5급부터 자신의 사무소를 열 수 있습니다.','장비 판매가 없어지고, 대신 카드를 한 번에 3장까지 팔 수 있습니다. (300원 + 카드 비용 1마다 30원)']],
      ['🔧 그 밖의 버그 수정',['흑수 루트에서 후보 이름이 {c}로 그대로 보이던 문제를 고쳤습니다.','자동 전투가 0코스트 버프 카드(방어막·명중 보정·빛 획득 등)를 쓰지 않던 문제를 고쳤습니다.','재생 조직 등 회복 카드가 덱이 작을 때 매 라운드 손패에 들어오던 문제를 고쳤습니다. 한 번 쓰면 몇 턴 동안 손패에 들어오지 않습니다.','무기 흡수(미미크리 등)의 횟수 제한을 전투당 5번에서 턴당 5번으로 바꿨습니다.','기록실의 "아무것도 없이 시작해 결혼한 채 55년" 엔딩 설명에서 앞부분이 잘려 보이던 문제를 고쳤습니다. 이제 필요한 출생 선택이 그대로 적힙니다.','협회 직원이 2급에서 더 오르지 못하던 문제를 고쳤습니다. 본부 직속에 오르면 1급이 되고 특색 심사도 받을 수 있습니다.','아이폰 무음 모드에서 배경음악·효과음이 나지 않던 문제를 줄이는 수정을 넣었습니다. 연출을 끈 상태에서도 효과음이 납니다.','공방 해결사가 5급부터 사무소를 열 수 없던 문제를 고쳤습니다.']],
      ['📝 문구·보기',['문구를 다듬었습니다. (웃는 가로등, 승급 추천·급수 심사, R사 연인 문구)','배경 테마(단테·검지 단말기·도서관)의 보조 글자 색을 밝혀 읽기 쉽게 했습니다.']]];
  const V987SEC=[['🔧 버그 수정',['무기 주사위가 카드 주사위를 덮어쓰던 문제를 고쳤습니다. 이제 카드 주사위에 더해집니다.']]];
  const V1003SEC=[['🔧 조정',['가방의 "정보" 칸이 길어서, 항해 기록 · 성장기 · 태어났을 때의 능력치를 접어 둘 수 있게 했습니다. 열고 닫은 상태는 그대로 유지됩니다.']]];
  const V1004SEC=[['🔧 개선',['전투 판정에서 주사위 눈 아래에 명중·회피를 올린 요소(버프 +)와 깎은 요소(디버프 −)의 합계가 표시됩니다. 줄을 길게 누르면(PC는 마우스를 올리면) 세부 내역을 볼 수 있습니다.','한 번에 굴리는 피해 주사위가 많아도 화면 밖으로 넘치지 않고 줄바꿈됩니다.']]];
  const V1005SEC=[['🆕 기록실',['기록실에 특수 장비와 전용 카드팩 도감이 추가됩니다.']],
      ['🔧 조정',['몇몇 연출이 보강됩니다.','일부 히든 보스의 무기와 책장이 조정됩니다.','일부 출생이 조정됩니다.','일부 전리품의 조건이 조정됩니다.','카드 설명이 보강됩니다.']],
      ['🐛 수정',['연출을 꺼도 판정 결과가 표시됩니다.','카드팩 관련 오류가 수정됩니다.']]];
  const V1006SEC=[['🔧 조정',['일대기 항목이 보강됩니다.']]];
  const V1007SEC=[['🎵 배경음악',['BGM이 변경 및 추가됩니다. 불길이 새 곡으로 변경되고, 물결이 추가됩니다.']],
      ['🆕 추가',['내 사무소의 전문 분야에 침잠이 추가됩니다.']],
      ['🔧 조정',['일대기 항목이 보강됩니다.','공방 해결사의 장비 강화와 유물이 조정됩니다.','별에 선택받은 자의 소지 소속이 조정됩니다.']]];
  const V1008SEC=[['🆕 기록실',['기록실의 특수 장비 칸이 제자리에 표시되어 어디쯤의 장비인지 짐작할 수 있습니다.','기록실의 각 칸 제목을 눌러 접고 펼 수 있습니다.']],
      ['🔧 조정',['일부 히든 보스의 장비와 난이도가 조정됩니다.','일부 무기에 키워드가 추가됩니다.','일부 히든 보스의 등장 조건과 문구가 조정됩니다.','일부 전리품과 책장이 조정됩니다.']],
      ['🐛 수정',['판정 연출이 엉뚱한 사건에서 다시 재생되던 문제가 수정됩니다.','결과 화면에서 세상을 떠난 아이가 살아 있는 것처럼 보이던 문제가 수정됩니다.','PC에서 음량 조절이 가려지던 문제가 수정됩니다.']]];
  const V1010SEC=[['🆕 보조 장비',['의수 칸이 보조 장비 칸으로 바뀌고, 의복·지팡이·단말기·계약서·장치가 공방에 추가됩니다.','소속마다 제식 장비를 받고, 소속을 떠나면 사라집니다.','중지·흑운회는 문신을, N사는 강화 시술을 받습니다.','특색 전용 장비의 종류를 고를 수 있습니다.']],
      ['🆕 추가',['약지에 작품을 만들어 품평회에 내는 이야기가 추가됩니다.','소지 표식을 가진 사람에게 새로운 인연이 생깁니다.','외곽에서 승급이 막힌 사람을 위한 사건이 추가됩니다.']],
      ['🔧 조정',['공방 해결사의 엠플 값이 조정되고, 돈을 벌 수 있는 사건이 추가됩니다.','협회 추천서가 더 일찍 나옵니다.','기록실에 인연 힌트가 보강됩니다.','장인·명장 공방 장비와 암시장 장비가 조정되고, 명장의 공방에 4등급 보조 장비가 추가됩니다.','공방 해결사에 특수 강화와, 장비를 사자마자 재료로 쓰는 기능이 추가됩니다.','약지는 작품 이야기를 거쳐야 마에스트로가 됩니다.','무한 모드에서는 새 소속에 들어가거나 이직할 수 없습니다.','무한 모드에서 위쪽에 뜨는 글이 100년마다 한 번만 나옵니다.','일부 제식 장비와 N사 강화 시술이 강해집니다.']]];
  const V1015SEC=[['🔧 추가 조정',['무기 이펙트 조정','환상체 4종 조정']]];
  const V1030SEC=[['🆕 해금 출생',['해금 출생이 늘어납니다. 까마귀팀 복제체 · 신탁대행자 헤르메스 · 도서관의 지정사서 · 머리의 발톱 · 조율자 · G사 병기 출신이 각자의 이야기와 엔딩을 가집니다.','해금 출생마다 이어 살아갈 이유가 생겨, 엔딩 뒤에도 무한 모드로 계속할 수 있습니다.','일부 해금 출생에 전용 인연이 추가됩니다.','출생마다 성장기 이야기가 이어지고, 첫 해에 출발 장면이 나옵니다.']],
      ['🆕 기록실',['기록실에 종류별 탭이 생기고, 설명이 아래로 길게 표시됩니다.','하드 모드로 이야기를 끝내면 엔딩·칭호·인연의 정확한 조건과 히든 상대의 위치를 알려 주는 안내가 열립니다.','엔딩 기본 힌트 문구가 정리됩니다.']],
      ['🩸 혈귀',['혈귀가 시작할 때 피로 만든 무기를 고를 수 있고, 이긴 횟수에 따라 무기가 단계별로 강해집니다.','무한 모드에서 돈으로 장비에 효과를 새길 수 있습니다.']],
      ['🔧 조정',['소속 서열이 오를수록 공격 카드가 강해집니다. (엄지·검지·중지·약지·소지, 흑운회·검계·밤의 송곳)','검계·밤의 송곳이 상향됩니다.','중지의 승급 요구량이 줄어듭니다.','일부 직업이 해금 출생으로 옮겨지고, 시작 보너스가 조정됩니다.','성장기 이야기의 문구와 반복 표현이 다듬어집니다.','일부 이야기와 전투가 보강됩니다.']],
      ['🐛 수정',['해금 출생 인연이 처분 의뢰와 겹쳐 나오지 않던 문제가 수정됩니다.']]];
  const NOTICE={id:'v10.3.0',t:'도시의 한 해 '+VERSION+' · 새 소식',
    note:'이 공지는 업데이트 이후 처음 새로 고침한 분께 한 번만 표시됩니다. 확인을 누르면 다시 뜨지 않고, 첫 화면의 "이번 업데이트"에서 다시 볼 수 있습니다.',
    sec:[...V1030SEC,...V1010SEC,...V1015SEC,['🔧 v10.1.7 조정',['공방 해결사 편의성 증가','연출 강도 차이가 나지 않던 것 수정','환상체 몇 명 조정','라운드마다 HP UI 조정']],['🔧 v10.1.8 조정',['세이브 불러오기 시 해금 목록이 바로 적용되지 않던 문제 수정']],['🔧 v10.1.9 조정',['공방 해결사 보조 장비 종류 선택 · 강화 개편','카드 보상을 받을 때 돈 500안을 함께 지급','R사 팀별 시작 무기 변경','손가락 승급 이벤트 추가']],['🔧 v10.2.0 조정',['호흡이 최대치를 넘어 쌓이던 버그 수정','보호막이 최대치를 넘은 상태에서 카드로 보호막을 얻으면 줄어들던 버그 수정','1000해 달성 이후 불순물 너프']],['🔧 v10.2.1 조정',['무기와 보조 장비로 부여할 수 있는 키워드량을 정리했습니다. 한 키워드당 라운드마다 무기 5, 보조 장비 5까지 부여하고, 둘을 합쳐 최대 10까지 부여할 수 있습니다.','공방 해결사 지팡이의 집중 키워드는 이 제한을 받지 않습니다. 강화 단계가 오를수록 쌓을 수 있는 최대치도 함께 늘어납니다.','위 부여량 제한이 규칙 요약에 빠져 있던 것을 추가했습니다.']],['🔧 v10.2.2 조정',['카드 보상을 받을 때 함께 주는 돈을 500안에서 200안으로 조정했습니다.']],['🔧 v10.2.3 조정',['무기로 거는 파열은 라운드 제한 대신 적중 한 번마다 5까지 부여합니다. 파열은 소모가 빨라 높게 쌓기 어려웠던 점을 고쳤습니다. 쌓이는 최대치는 그대로입니다.']],['🔧 v10.2.4 조정',['흑운회 전용 카드 흑운도를 낼 수 없던 문제를 고쳤습니다. 이제 구름이 3 이상이면 쓸 수 있고, 낼 차례에 구름이 모자라면 불발합니다(앞선 카드로 구름을 채웁니다).','흑운도를 강화했습니다. 주사위 5개 → 6개, 출혈 5 → 7.','카드가 효과를 내려면 필요한 구름이 카드에 표시됩니다.']],['🔧 v10.2.5 조정',['상대 HP 조건이 있는 카드(내부 숙청 · 처형 선고)를 낼 수 없을 때 이유를 카드에 표시합니다.']],['🔧 v10.2.6 조정',['검계·흑운회 보상 패치: 흑운도 강화, 육참·골단 조정, 폭발·반격 배율 표시 수정']],['🔧 v10.2.7 조정',['오늘의 시드가 11월 5일까지 특수 출신과 타고난 것 조합으로 바뀝니다. 타고난 것이 둘 함께 붙는 날도 있습니다.']],['🔧 v10.2.8 조정',['푸른 잔향 난이도를 조정했습니다.']],['🔧 v10.2.9 조정',['장비금지 가시성을 조금 올렸습니다.']]]};
  const V1002SEC=[['🔧 조정',['인연 캐릭터의 성격과 말투를 조정하고, 루트별 전용 이벤트를 늘렸습니다.']]];
  const V1001SEC=[['🔧 개선 및 수정',['무한 모드 성장(주는 피해·일격·받는 피해·연륜)을 가방의 "정보" 칸에서 항상 볼 수 있습니다. 규칙 요약에 연륜 설명을 넣었습니다.','한계 돌파의 공격 선택지가 눌리지 않던 문제를 고쳤습니다. 일격 설명 문구도 알기 쉽게 바꿨습니다.','새로운 이야기에서 싸우기로 하면 다음 해로 미루지 않고 바로 전투가 시작됩니다.','무한 모드에서 이미 이긴 상대가 반복해서 나오던 것을 줄였습니다.','불순물을 쓰러뜨리면 받는 조각과 잔재 보상을 한 줄로 합쳤습니다.','정신력 막대의 채움이 보이지 않던 문제를 고쳤습니다.','엔딩 이미지에서 같은 히든 보스가 반복해 찍히거나 카드 장수가 줄바꿈되던 문제를 고쳤습니다.','가방의 첫 칸 이름을 "출생"에서 "정보"로 바꿨습니다.']]];
  const V1000SEC=[['🆕 소모품',['공방 거리의 "소지품"에서 붕대·간식·진정제를 살 수 있습니다. 종류마다 최대 3개까지 지닙니다.','소모품은 가방의 "소모품" 칸에 들어가고, 전투 중에도 쓸 수 있습니다.','가격은 10해마다 100안씩 오르고 최대 5,000안입니다.','인연이 있으면 전투를 이긴 뒤 가끔 도시락을 받아 HP와 정신력을 회복합니다.']],
      ['🌊 새로운 이야기',['새로운 이야기가 하나 추가되었습니다. 오늘의 시드에서 만나 볼 수 있습니다.']],
      ['🔧 버그 및 수정사항',['공유 링크가 짧아졌습니다. 긴 기록도 훨씬 짧은 주소로 공유됩니다.','설정에 "무한 모드 문구 끄기"가 추가되었습니다.','숨은 출생 화면과 "태어난 곳" 표기가 정리되었습니다.','책장 카드팩 패시브가 팩을 바꿔도 남던 문제를 고쳤습니다.','무한 모드의 회피 표시가 "무한 −N · 0에서 멈춤"으로 바뀌었습니다.','홍원 소속 고정과 공방 의수 재료 문제를 고쳤습니다.','R사 팀 배치 규칙과 부화장 팀 선택이 바뀌었습니다.','충전과 침잠 스택이 전투 연출 중에 사라지던 표시 문제를 고쳤습니다.','오버플로우 엔딩 문구가 잘못 나오던 문제를 고쳤습니다.','창이 전체화면이 아닐 때 오른쪽 가방 칸이 위쪽 옵션 버튼을 가리던 문제를 고쳤습니다.']]];
  const V994SEC=[['🩸 혈귀',['「붉은 밤의 초대」가 나오는 조건을 정리했고, 선택지에 얻는 것과 치르는 것을 자세히 적었습니다.','혈찬이 패시브 칸에 표시됩니다.','초대로 혈귀가 된 경우의 인연과 아이 설정을 고쳤습니다.']],
      ['🔧 그 밖의 변경',['새로운 인연이 추가됩니다.','카드 화면에서 같은 카드를 ×N으로 묶어 보고, 정렬할 수 있습니다.','싸우는 이유가 더 많은 적에게 붙습니다.']]];
  const V944SEC=[['🔧 버그 수정',['별에 선택받은 자가 무기를 강화할 때 처음 가진 "맨손"이 재료로 뜨던 문제를 고쳤습니다. 맨손은 더 이상 보관함에 남지 않습니다.','출생 화면의 "다시 태어난다"가 다시 굴릴 때마다 위쪽 내용 높이가 달라져 움직이던 문제를 고쳤습니다. 이제 제자리에 있습니다.','제 1막 종료 화면에 "여기서 끝낸다" 버튼을 넣었습니다. 제 2막으로 가지 않고 끝낼 수 있고, 이 판의 저장이 지워집니다. "다시 태어난다"를 눌러도 이전 판 저장이 바로 지워집니다.','설정 팝업의 제목이 세로로 쪼개져 보이던 문제를 고쳤습니다.']],
    ['⚖ 조정',['PC 화면(폭 900px 이상)에서 본문, 왼쪽 능력치 칸, 오른쪽 가방 칸, 버튼, 팝업을 함께 키웠습니다. 창이 넓을수록 더 커지고, 창 높이가 낮으면 잘리지 않도록 배율을 낮춥니다. 첫 화면과 휴대폰 화면은 그대로입니다.','금기 실험으로 찾아오는 "강화체"의 이름을 "발톱 · 재시험", "조율자 · 재시험"으로 바꿨습니다.','무한 모드 불순물의 최대 HP 상한을 1000만에서 1500만으로 늘렸습니다.']]];
  const V933SEC=[['🔧 버그 수정',['특이점 루트에서 금기 실험 8/8을 채워도 아무 일도 일어나지 않던 문제를 고쳤습니다. 이미 그 상태로 멈춘 저장도 다음 해로 넘어갈 때 이어집니다.','일부 출생에서 소지와의 거래 사건이 잘못 뜨던 문제를 고쳤습니다.','배경음악에서 "타탁" 하는 잡음과 이어폰에서 들리던 떨림을 줄였습니다.']]];
  const V932SEC=[['🔀 출생 변경',['이번 업데이트에 H사 루트와 R사 전용 루트가 히든 출생으로 이전됩니다. "아무것도 없는 존재"로 시작하면 100% 나오던 운명 선택이 출생으로 넘어갑니다. 이제 출생 굴림에서 직접 나오며, 재능·결점·성장기도 그 출생에 맞는 것으로 정해집니다.','"어떤 출생 보정도 없이 시작한다"를 고르면 운명 선택 없이 아무것도 없는 존재로 시작합니다. 대신 빈손 보정(히든 보스 전리품 장비 확률 +25%p, 정신이 꺾일 때 E.G.O 형상이 보일 확률 25%)을 받습니다.','출생이 추가되었습니다.']],
    ['🔧 그 밖의 변경',['카드 보상 화면에서 카드마다 이미 가진 장수(보유 ×N)나 새 카드 표시가 나오고, 지금 덱과 카드함을 펼쳐 볼 수 있습니다.','가방의 카드 목록에서 키워드 필터를 누르면 그 색으로 채워지고 ✓가 붙어, 켜져 있는지 바로 보입니다.','2막·무한 모드에서 공방 거리의 "다음 기회"가 55년차로 잘못 나오던 문제를 고쳤습니다.','R사 밸런스 패치: R사 부화장 출생도 이제 공방을 쓸 수 있습니다. 부화장을 나온 뒤에는 R사 보급 구역, 탈주한 뒤에는 뒷골목 공방이 열립니다.']]];
  const V910SEC=[['🌀 뒤틀림 안정화',['뒤틀리면 장비는 보관함으로 가고 카드팩은 뒤틀린 카드팩으로 고정됩니다. 정신력은 "???"로 바뀌어 이점도 불이익도 없고, E.G.O 장비는 얻을 수 없습니다.','뒤틀린 뒤 2년마다 40% 확률로 "뒤틀림이 가라앉는다"가 나옵니다. 안정화되면 장비와 카드팩을 다시 쓸 수 있고, 뒤틀림을 다루는 더 강한 카드로 이루어진 "더 강해진 뒤틀린 카드팩"을 얻습니다. 부풀려진 능력치는 그대로입니다.','선택지 이름이 "정신을 붙잡는다" · "나는 나로서 새로운 모습을 받아들인다"로 바뀌었습니다.']],
    ['🔧 그 밖의 변경',['엄지의 서열 이름 "소토카포"를 "언더보스"로 바꿨습니다. 솔다토 → 카포 → 언더보스 → 대부 순서입니다. 카포의 바로 윗서열입니다.','후반의 어떤 보스를 쓰러뜨린 뒤에는 공방 장비 정비 횟수가 장비마다 10번 늘어납니다. 그 보스들이 주는 장비는 기본 횟수만 정비할 수 있습니다. 일부 후반 보스의 능력치를 올렸습니다.']]];
  const V900SEC=[['🆕 v9.0.0 카드팩 시스템',['가방에 "카드팩" 탭이 생겼습니다. 기본 4장으로 시작하는 기본 카드팩 3개(이름을 바꿀 수 있습니다)와 출신 카드팩이 보관됩니다. 전투 밖에서는 횟수 제한 없이 바꿔 끼울 수 있고, 전투 중에는 바꿀 수 없습니다.','전용 카드팩을 받아 덱이 통째로 바뀌어도 이전 덱이 보관함에 남아, 실수로 바꿨어도 되돌릴 수 있습니다.','출신 보정 카드는 출신 카드팩에만, 의수·승진·궁니르 같은 소속 카드는 그 소속의 팩에만 들어갑니다. E.G.O 같은 고정 카드는 모든 팩에 따라갑니다.','보상 카드는 편집할 수 있는 모든 팩(기본 카드팩 3개, 고정 없는 출신 팩)에 복사됩니다. 전용 카드팩이나 덱 고정 중에는 돈과 함께 카드도 받아 기본 카드팩에 보관합니다.']],
    ['🆕 그 밖에 새로 들어온 것',['"?" 설명 창: 전투 중에도 카드 읽는 법, 키워드(최대 스택 포함), 규칙을 볼 수 있습니다.','일대기·명예의 전당, 기록실 판 통계, 오늘의 시드 도전 기록, 첫 화면으로 가는 버튼이 생겼습니다.','홍원: 재갈로 얻은 흑수도 카드를 주고, 흑수 카드가 크게 강해졌습니다. 소지의 도 "성도"는 무기가 아닌 전리품(패시브)입니다. 개화 · 일격의 주사위가 6개로 늘었습니다.']],
    ['🔧 수정',['같은 시드면 해금 상태와 상관없이 같은 타고난 것이 나옵니다. 지난 날 오늘의 시드를 번호로 입력해도 그날 지정이 적용됩니다.','"균열이 닫혔다" 엔딩 뒤에는 균열 고정 피해가 없고 적 공격 상한이 높아집니다. 최고 서열 엄지에게 "윗선의 시험"이 나오지 않고, 하인의 방패 보호막은 6에서 3으로 낮췄습니다.']]];
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
  const noticeTop=()=>NOTICE.top?`<div class="panel stack" style="gap:6px;border:2px solid var(--gold);padding:14px"><b style="font-size:1.25em;color:var(--gold)">${NOTICE.top[0]}</b><ul style="margin:0;padding-left:20px;display:grid;gap:5px;font-size:1.05em;font-weight:600">${NOTICE.top[1].map(t=>`<li>${esc(t)}</li>`).join('')}</ul></div>`:'';
  const noticeBody=(sec=NOTICE.sec)=>sec.map(([h,items])=>`<div class="stack" style="gap:4px"><b>${h}</b><ul class="small" style="margin:0;padding-left:18px;display:grid;gap:3px">${items.map(t=>`<li>${esc(t)}</li>`).join('')}</ul></div>`).join('');
  function vUpdates(){return `<details class="panel"><summary><b>이번 업데이트 · ${UPDATES.v}</b></summary><div class="stack" style="gap:10px;margin-top:10px">${noticeTop()}${noticeBody(NOTICE.sec)}</div><ul class="small" style="margin:8px 0 0;padding-left:18px">${UPDATES.items.map(t=>`<li>${t}</li>`).join('')}</ul></details>`}
  /* 세이브 옮기기: 이 브라우저의 세이브·기록실·해금을 코드(또는 파일)로 내보내고, 다른 기기에서 불러온다 */
  const XKEYS=[SAVE,REC,'cityYearUnlocks','cityYearChron','cityYearDaily'];
  const xEncode=()=>{const d={};for(const k of XKEYS){const v=store.get(k);if(v)d[k]=v}return 'CY1:'+btoa(unescape(encodeURIComponent(JSON.stringify({cy:1,v:UPDATES.v,t:Date.now(),d}))))};
  function xDecode(txt){
    let t=String(txt||'').trim();if(!t)throw new Error('코드가 비어 있다');
    t=t.replace(/[\u200b-\u200f\u2060\ufeff]/g,'').replace(/[“”]/g,'"');
    const i=t.search(/CY1\s*[:：]/);
    if(i>=0){const b=t.slice(i).replace(/^CY1\s*[:：]/,'').replace(/[^A-Za-z0-9+/=_-]/g,'').replace(/-/g,'+').replace(/_/g,'/');
      try{t=decodeURIComponent(escape(atob(b)))}catch(e){throw new Error('코드가 중간에 잘렸거나 바뀌었다 · 내보내기를 다시 하고 "코드 복사"나 "파일로 저장"을 써 보세요')}}
    else if(!/^[\[{]/.test(t)&&/^[A-Za-z0-9+/=\s]{40,}$/.test(t)){try{t=decodeURIComponent(escape(atob(t.replace(/\s+/g,''))))}catch(e){}}
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
      <p class="small dim">이 기기의 세이브·기록실·해금·일대기·명예의 전당·오늘의 시드 기록을 코드로 만들어 다른 기기에서 불러온다. 불러오면 그 기기에 있던 세이브와 기록(일대기·명예의 전당 포함)은 덮어쓴다. 설정(테마·연출)은 옮겨지지 않는다.</p>
      <button class="btn" data-a="xport"><b>내보내기</b><span class="dim small">${has?'지금 이어하기 세이브까지 포함한다':'이어하기 세이브는 없다 · 기록실·해금·일대기만 담긴다'}</span></button>
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
    E.setInnateOpen(loadRec().unl||[]);   // 불러온 해금 목록을 바로 적용(새로고침 전에는 옛 목록이 남아 해금 타고난 것이 안 나왔다)
    UI.xask=null;UI.xcode=null;UI.xopen=true;UI.xmsg=[true,`불러왔다${r.v?` (v${String(r.v).replace(/^v/i,'')} 세이브)`:''} · 위의 이어하기를 눌러 계속한다`];render();
  }
  /* 이전 공지: 한 번만 뜨는 공지를 다시 볼 수 있게 버전별로 모아 둔다 (규칙 요약 아래) */
  const PAST=[['v10.1.5',V1015SEC],['v10.1.0',V1010SEC],['v10.0.8',V1008SEC],['v10.0.7',V1007SEC],['v10.0.6',V1006SEC],['v10.0.5',V1005SEC],['v10.0.4',V1004SEC],['v10.0.3',V1003SEC],['v10.0.2',V1002SEC],['v10.0.1',V1001SEC],['v10.0.0',V1000SEC],['v9.9.4',V994SEC],['v9.8.7',V987SEC],['v9.8.6',V986SEC],['v9.8.5',V985SEC],['v9.8.4',V984SEC],['v9.4.4',V944SEC],['v9.4.3',V943SEC],['v9.4.2',V942SEC],['v9.4.0',V940SEC],['v9.3.4',V934SEC],['v9.3.3',V933SEC],['v9.3.2',V932SEC],['v9.1.0',V910SEC],['v9.0.0',V900SEC],['v7.3.2',V732SEC],['v7.3.1',V731SEC],['v7.3.0',V730SEC],['v7.2.1',V721SEC],['v7.2.0',V720SEC],['v7.1.0',V710SEC],['v7.0.4',V704SEC],['v7.0.3',V703SEC],['v7.0.1',V701SEC],['v7.0.0',V700SEC],['v6.1.0',V610SEC],['v6.0.9',V609SEC],['v6.0.8',V608SEC],['v6.0.7',V607SEC],['v6.0.6',V606SEC],['v6.0.5',V605SEC],['v6.0.4',V604SEC],['v6.0.3',V603SEC],['v6.0.2',V602SEC],['v6.0',V6SEC]];
  function vPast(){return `<details><summary>이전 공지</summary><div class="stack" style="gap:12px;margin-top:8px">${PAST.map(([v,sec])=>`<div class="stack" style="gap:6px"><div class="eyebrow">${v}</div>${noticeBody(sec)}</div>`).join('')}</div></details>`}
  /* 오늘의 시드: 한국 시간 날짜 → 숫자 */
  const todayKey=()=>{const t=new Date(Date.now()+9*3600e3);return t.toISOString().slice(0,10)};
  const dailySeed=k=>{let h=2166136261;for(const c of 'city-year:'+k)h=Math.imul(h^c.charCodeAt(0),16777619)>>>0;return h%1000000000};
  function vOrigins(){
    const u=loadUnlocks();if(!(D.unlockOrigins||[]).length)return '';
    return `<div class="panel stack" style="gap:8px"><span class="eyebrow">해금 출생</span>${(D.unlockOrigins||[]).map(o=>`<div class="row between"><span>${esc(o.n)}</span><span class="chip${u.includes('origin:'+o.key)?'':' dim'}">${u.includes('origin:'+o.key)?'해금 · 출생 화면에서 고를 수 있다':'잠김'}</span></div>`).join('')}
      <p class="small dim">정해진 출생으로 태어나거나 정해진 물건을 들고 무한 모드 전, 제 2막의 끝까지 가면 열린다. 무한 모드(제 2막)의 마지막 상대 ${D.enemies.baral.n}과 ${D.enemies.zena.n}을 보통 이상 난이도에서 이기면 머리의 발톱과 조율자가 각각 열린다. 쉬움에서는 열리지 않는다.</p></div>`;
  }
  function vJobs(){
    const u=loadUnlocks();
    const row=k=>`<div class="row between"><span>${T.jobs[k]}</span><span class="chip${u.includes(k)?'':' dim'}">${u.includes(k)?'해금 · 출생 화면에서 고를 수 있다':'잠김'}</span></div>`;
    const left=Object.keys(T.jobs).filter(k=>!(D.unlockOrigins||[]).some(o=>o.job===k));if(!left.length)return '';
    return `<div class="panel stack" style="gap:8px"><span class="eyebrow">히든 직업</span>${left.map(row).join('')}</div>`;
  }
  /* 출생 화면: 출신·재능·결점·무기 줄의 높이를, 이 폭에서 나올 수 있는 가장 긴 내용에 맞춰 고정한다.
     그래서 다시 굴려도 아래의 '다시 태어난다' 버튼이 움직이지 않는다 (숨은 출생·타고난 것 칸이 생길 때만 밀린다) */
  function fixBirthRows(){
    const panel=document.querySelector('.brows'),wrap=document.querySelector('.wrap');if(!panel||!wrap)return;
    const rows=[...panel.querySelectorAll('.roll')];if(rows.length!==4)return;
    const z=parseFloat(getComputedStyle(wrap).zoom)||1,pw=panel.getBoundingClientRect().width,key=Math.round(pw)+'/'+z;
    UI.brCache=UI.brCache||{};
    if(!UI.brCache[key]){
      const box=panel.cloneNode(true);box.removeAttribute('data-a');
      box.style.cssText=`position:absolute;visibility:hidden;pointer-events:none;left:0;top:0;width:${pw/z}px;box-sizing:border-box`;
      wrap.appendChild(box);
      const bx=[...box.querySelectorAll('.roll')],pools=[D.origins,D.talents,D.flaws,D.weapons],mx=[0,0,0,0];
      pools.forEach((pool,i)=>{(pool||[]).forEach(x=>{bx[i].querySelector('.n').innerHTML=`<b>${x.n}</b>${x.t?`<span>${x.t}</span>`:''}<span class="mono small" style="color:var(--gold)">${x.e}</span>`;mx[i]=Math.max(mx[i],bx[i].getBoundingClientRect().height)})});
      wrap.removeChild(box);UI.brCache[key]=mx;
    }
    UI.brCache[key].forEach((h,i)=>{if(h)rows[i].style.minHeight=(h/z)+'px'});
  }
  function vBirth(){
    const b=BC,s=b.stats,fresh=b.fresh&&MODE!=='off';
    const v=r=>`<span class="v" ${fresh?`data-roll="${r}"`:''}>${r}</span>`;
    const cyc=pool=>fresh&&pool?` data-cyc="${esc(pool.map(y=>y.n).join('|'))}"`:'';
    const row=(lab,r,x,pool)=>{const fx_=lab==='출신'&&b.o&&b.o.key;return `<div class="roll"><span class="mono small dim">${lab}</span>${fx_?'<span class="v">해금</span>':v(r)}<div class="n"><b${fx_?'':cyc(pool)}>${x.n}</b>${x.t?`<span>${x.t}</span>`:''}<span class="mono small" style="color:var(--gold)">${x.e}</span></div></div>`};
    const sw=D.colors.map((c,i)=>`<button class="sw ${i===b.ci?'on':''}" data-a="color" data-i="${i}" style="background:${c.hex}" aria-label="${c.adj} 색" title="${c.adj}"></button>`).join('');
    const kid=b.kid.length?`<div class="stack" style="gap:6px"><div class="eyebrow">성장기 · 1d100 × ${b.kid.length}</div>
      <div class="panel">${(()=>{const pl=placeOf(b.o,b.r,b.blank);return pl?`<div class="roll"><span class="mono small dim">태어난 곳</span><span class="v">·</span><div class="n"><b>${pl.n}</b><span>${pl.t}</span></div></div>`:''})()}${b.kid.map((k,i)=>{const st=kidStory(b.o,i,k.x);return st?`<div class="roll"><span class="mono small dim">${k.age}세</span>${v(k.r)}<div class="n"><span style="font-style:italic;line-height:1.6">${esc(st)}</span><span class="mono small" style="color:var(--gold)"><b${cyc(D.childhood.table)}>${kidLabel(b.kid,i)}</b> · ${k.x.e}</span></div></div>`:row(k.age+'세',k.r,k.x,D.childhood.table)}).join('')}${kidSum(b.kid)}</div></div>`:'';
    return `<div class="row" style="justify-content:flex-start"><button class="btn quiet" data-a="title" style="width:auto;padding:6px 12px"><b>← 첫 화면으로</b></button></div><div class="stack" style="gap:6px"><div class="eyebrow">무작위 출생 · 1d100</div><h2>${b.name?esc(b.name)+'은(는)':'당신은'} 이렇게 태어났다</h2></div>
      <div class="panel stack" style="gap:10px">
        <label class="field" for="nm"><span class="eyebrow">이름</span><input id="nm" maxlength="12" value="${esc(b.name||'')}" placeholder="${T.you}" autocomplete="off"></label>
        <div class="row between"><span class="mono small dim">시드 <b style="color:var(--fg)">${b.seed}</b> · ${dailyKeyOf(b.seed)?`<b style="color:var(--gold)">${dailyKeyOf(b.seed)===todayKey()?'오늘의 시드':'지난 시드'} ${dailyKeyOf(b.seed)}</b>`:'태어날 때마다 새로 뽑힌다'}</span></div>
        <div class="row" style="flex-wrap:nowrap"><input id="seedIn" inputmode="numeric" enterkeyhint="go" maxlength="12" placeholder="시드 번호로 다시 태어나기" autocomplete="off" style="flex:1;min-width:0">
          <button class="chip" data-a="seed">이 시드로</button></div>
      </div>
      ${b.o.hidden||(b.o.secret&&!b.blank)?`<div class="panel stack" style="gap:6px;border-color:var(--gold)"><span class="eyebrow" style="color:var(--gold)">${b.fated?'운명이 강제된 출생':'숨은 출생 · 출신 '+b.r.o}</span><b class="serif">${esc(b.o.n)}</b><span class="small">${esc(b.o.t)}</span><span class="mono small" style="color:var(--gold)">${esc(b.o.e)}</span>${b.starPick?`<div class="row"><span class="small">성도의 이름</span><input id="starname" maxlength="12" value="${esc(UI.starName||'')}" autocomplete="off" placeholder="1~12글자 · 뒤에 '성도'가 붙는다" style="width:min(14em,60vw)"></div><span class="small bad">${UI.starErr||''}</span>`:''}</div>`:''}
      ${b.fated?`<div class="panel stack" style="gap:6px"><span class="mono small" style="color:var(--gold)">재능 · 결점 · 무기 · 타고난 것 없음 · 출신과 성장기 보정만 가진다</span></div>`:b.blank?`<div class="panel stack" style="gap:6px;border-color:var(--gold)"><span class="eyebrow" style="color:var(--gold)">출생 보정 없음</span><b class="serif">${esc(b.o.n)}</b><span class="small">${esc(b.o.t)}</span><span class="mono small" style="color:var(--gold)">출신 · 재능 · 결점 · 무기 · 타고난 것 없음 · 맨손 · 성장기 보정만 가진다</span><span class="mono small">빈손 · 히든 보스 전리품 장비 확률 +25%p · 정신이 꺾일 때 E.G.O 형상이 보일 확률 25%</span></div>`:`<div class="panel brows">${row('출신',b.r.o,b.o,UI.job?null:D.origins)}${row('재능',b.r.t,b.t,D.talents)}${row('결점',b.r.f,b.f,D.flaws)}${b.o.egoWeapons&&b.gear&&b.gear.weapon&&b.gear.weapon.egoLv!=null?row('무기',b.r.w,{n:'E.G.O · '+b.gear.weapon.n,t:'환상체에게서 얻은 무기 · 전용 카드 발현을 쌓으면 무기와 책장이 함께 자란다',e:b.gear.weapon.e},null):row('무기',b.r.w,b.w,D.weapons)}</div>`}
      ${b.innate?`<div class="panel stack" style="gap:6px;border-color:var(--gold)"><span class="eyebrow" style="color:var(--gold)">타고난 것 · 1%${b.innate2?' · 둘이 함께':''}</span>${[b.innate,b.innate2].filter(Boolean).map(k=>`<b class="serif">${esc(D.innate[k].n)}</b><span class="mono small" style="color:var(--gold)">${esc(D.innate[k].e)}</span>`).join('')}</div>`:''}
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
      ${b.teamPick?`<div class="panel stack" style="gap:8px"><span class="eyebrow">부화장 팀 · 하나를 고른다</span><p class="small dim">어느 팀의 개체로 길러졌는지에 따라 몸이 다르다. 고르지 않은 두 팀의 추격자가 나중에 쫓아온다.</p>${Object.entries(CFG.rb.teamBonus).map(([t,B])=>`<button class="btn${UI.team===t?' primary':''}" data-a="rbteam" data-i="${t}"><b>${esc(t)}</b><span class="mono small" style="color:var(--gold)">${Object.entries(B).map(([k,v])=>`${{spd:'속도',maxHp:'최대 HP',eva:'회피'}[k]} +${v}`).join(' · ')}</span></button>`).join('')}</div>`:''}
      ${b.relicPick?`<div class="panel stack" style="gap:8px"><span class="eyebrow">유물 적성 · 하나를 고른다</span><p class="small dim">적성은 가지고 있으나 온전히 다루기 어렵다.</p>${Object.entries(D.relics).map(([k,r])=>`<button class="btn${UI.relic===k?' primary':''}" data-a="relic" data-i="${k}"><b>${esc(r.n)}</b><span class="mono small" style="color:var(--gold)">${esc(r.e)}</span></button>`).join('')}</div>`:''}
      ${vJobRoll()}${vJobPick()}${vOriginPick()}${vBloodPick()}${testPresetPanel()}
      ${b.fateChoices&&!b.fated?`<div class="panel stack" style="gap:8px;border-color:var(--gold)"><span class="eyebrow" style="color:var(--gold)">운명이 찾아왔다 · 하나를 고르거나 거절한다</span><span class="small">아무것도 쥐지 않고 태어났지만, 이름 없는 존재에게도 길이 두 갈래로 놓였다.</span>${b.fateChoices.map(r_=>{const h=D.hiddenOrigins.find(x=>x.roll===r_);return `<button class="btn" data-a="fate" data-i="${r_}"><b>${esc(h.n)}</b><span class="small">${esc(h.t)}</span><span class="mono small" style="color:var(--gold)">${esc(h.e)}</span></button>`}).join('')}<button class="btn" data-a="nofate"><b>운명을 거절한다</b><span class="small">아무것도 쥐지 않은 채 그대로 시작한다. 이름 없는 삶, 솔로 엔딩을 노리는 길이다.</span></button></div>`:''}
      <div class="stack"><button class="btn primary" data-a="live" ${(b.relicPick&&!UI.relic)||(b.teamPick&&!UI.team)||(b.fateChoices&&!b.fated)?'disabled':''}>${b.fateChoices&&!b.fated?'운명을 먼저 고른다':b.relicPick&&!UI.relic?'유물을 먼저 고른다':b.teamPick&&!UI.team?'팀을 먼저 고른다':'이 삶을 산다'}</button>
      ${fingerBtns()}${b.blank||UI.job?'':'<button class="btn quiet" data-a="blank">어떤 출생 보정도 없이 시작한다</button>'}<button class="btn quiet" data-a="title"><b>첫 화면으로</b><span class="dim small">출생 굴림을 접고 처음으로 돌아간다</span></button></div>${vSettings()}`;
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
    const k=Object.keys(D.hiddenJobs).find(j=>u.includes(j)&&!(D.unlockOrigins||[]).some(o=>o.job===j)&&D.hiddenJobs[j].roll===(UI.jobAuto?D.hiddenJobs[UI.job].roll:b.r.o));if(!k)return '';
    const J=D.hiddenJobs[k],base=UI.jobAuto?UI.jobBase:b.o.n;
    return `<div class="panel stack" style="gap:8px;border-color:var(--gold)"><span class="eyebrow">출신 ${J.roll} · 히든 직업을 고를 수 있다</span>
      <div class="row" style="gap:8px"><button class="btn${!UI.jobAuto?' primary':''}" style="flex:1" data-a="jobroll" data-i="">${esc(base)}</button><button class="btn${UI.jobAuto?' primary':''}" style="flex:1" data-a="jobroll" data-i="${k}">${esc(J.n)}</button></div></div>`;
  }
  /* 해금 출생: 무한 모드 전 2막 끝까지 간 숨은 출생은 이 목록에서 골라 시작할 수 있다. 다시 태어나도 출생은 그대로, 나머지만 다시 굴린다 */
  const openOrigins=()=>{const u=loadUnlocks();return (D.unlockOrigins||[]).filter(o=>u.includes('origin:'+o.key)||(o.job&&u.includes(o.job)))};
  /* 혈귀 출생: 피로 벼린 무기 4종 중에서 시작 무기를 고른다 */
  function vBloodPick(){
    if(!BC||!BC.o||BC.o.race!=='hyeolgwi'||UI.job)return '';
    const cur=UI.bloodW||null;
    return `<div class="panel stack" style="gap:8px;border-color:var(--bleed)"><span class="eyebrow">혈귀의 무기</span>
      <p class="small dim">피로 벼린 무기를 고르면 굴림으로 받은 무기를 대신한다.</p>
      <button class="btn${!cur?' primary':''}" data-a="bloodw" data-i="">굴림으로 받은 무기를 쓴다</button>
      ${(CFG.bloodWeapons||[]).map(w=>`<button class="btn${cur===w.key?' primary':''}" data-a="bloodw" data-i="${w.key}"><b>${esc(w.n)}</b><span class="small">${esc(w.lore)}</span><span class="mono small" style="color:var(--gold)">${esc(w.e)}</span></button>`).join('')}</div>`;
  }
  function vOriginPick(){
    const L=openOrigins();if(!L.length||UI.daily)return '';
    const cur=UI.origin&&!UI.job&&L.some(o=>o.key===UI.origin)?UI.origin:null;
    return `<div class="panel stack" style="gap:8px;border-color:var(--gold)"><span class="eyebrow">해금된 출생</span>
      <p class="small dim">고르면 출생이 고정된다. 다시 태어나면 재능·결점·무기·성장기·타고난 것만 새로 굴린다.</p>
      <button class="btn${!cur?' primary':''}" data-a="origin" data-i="">굴림에 맡긴다</button>
      ${L.map(o=>`<button class="btn${cur===o.key?' primary':''}" data-a="origin" data-i="${o.key}"><b>${esc(o.n)}</b><span class="small">${esc(o.t)}</span></button>`).join('')}</div>`;
  }
  /* 시험판: 고른 출생에 맞는 시작 상황 (중간 연차에서 바로 시작) */
  const TEST_PRESETS=[['','처음부터 (1년차)',''],['crow55','까마귀팀 · 55년차 (1막 끝, 2막 직전)','crow'],['lib56','도서관 지정사서 · 56년차 (2막 시작 직전, 손님 24명)','librarian'],['lib69','도서관 지정사서 · 69년차 (붉은 안개와 침묵의 오케스트라까지 마침, 종막 직전)','librarian'],['gw20','G사 병기 출신 · 21년차 (몰락 뒤 시술 직전)','gweapon'],['gw40','G사 병기 출신 · 40년차 (벌레팔 시술 · 히든 2개 섭식)','gweapon'],['gw56','G사 병기 출신 · 56년차 (2막 시작 · 왕족 인자 발현 전)','gweapon'],['lib20','도서관 지정사서 · 20년차 (손님 10명, 도시전설)','librarian'],['lib42','도서관 지정사서 · 42년차 (손님 21명, 도시질병)','librarian'],['lib55','도서관 지정사서 · 55년차 (손님 26명, 도시악몽)','librarian'],['herm37','헤르메스 · 37년차 (결혼·아이 있음, 곧 가족을 없애라)','hermes'],['herm55a','헤르메스 · 55년차 (지령을 따른 뒤)','hermes'],['herm55b','헤르메스 · 55년차 (지령을 거부하고 자비를 받은 뒤)','hermes']];
  function testPresetPanel(){
    if(!UNLOCKTEST)return '';
    const key=UI.origin||'',cur=UI.testPreset||'';
    return `<div class="panel stack" style="gap:6px;border:2px dashed var(--gold)"><span class="eyebrow">테섭 · 시작 상황</span><p class="small dim">위에서 해금 출생을 먼저 고른 뒤, 아래에서 시작 상황을 고른다. 출생과 맞지 않으면 처음부터 시작한다.</p>${TEST_PRESETS.map(([k,n,o])=>`<button class="btn${cur===k?' primary':''}" data-a="tpreset" data-i="${k}"${o&&o!==key?' style="opacity:.55"':''}>${n}</button>`).join('')}</div>`;
  }
  function vJobPick(){
    const u=loadUnlocks().filter(k=>D.hiddenJobs[k]&&!(D.unlockOrigins||[]).some(o=>o.job===k));if(!u.length)return '';
    const cur=UI.job&&!UI.jobAuto&&u.includes(UI.job)?UI.job:null;
    return `<div class="panel stack" style="gap:8px;border-color:var(--gold)"><span class="eyebrow">히든 직업 · 해금됨</span>
      <p class="small dim">머리 소속으로 시작한다. 승급과 해결사 등록은 없고, 전용 의뢰가 찾아온다.</p>
      <button class="btn${!cur?' primary':''}" data-a="job" data-i="">평범하게 태어난다</button>
      ${u.map(k=>{const J=D.hiddenJobs[k];return `<button class="btn${cur===k?' primary':''}" data-a="job" data-i="${k}"><b>${esc(J.n)}</b><span class="small">${esc(J.t)}</span><span class="mono small" style="color:var(--gold)">${esc(J.e)}</span></button>`}).join('')}</div>`;
  }
  /* 정신력 10 이하 "들리는 목소리": 기존 화면 위에 목소리가 하나씩 떠올랐다 4초 뒤 사라지고, 마지막에 선택지(듣기 좋다/싫다)가 열린다 */
  function voiceOverlay(ev){
    const seen=UI.voiceSeen===ev;
    if(UI.voicePlay!==ev){UI.voicePlay=ev;setTimeout(()=>{if(UI.ev===ev){UI.voiceSeen=ev}},9500)}
    const mob=innerWidth<700,W=innerWidth,H=innerHeight,cx=W/2,cy=H*0.46,rx=mob?W*0.30:Math.min(W*0.34,380),ry=mob?H*0.33:H*0.34,bw=mob?150:250,fs=mob?12:14.5,slots=[0,3,6,2,5,1,4];
    const vs=seen?'':ev.voices.map((t,i)=>{const a=0.35+slots[i%7]*2*Math.PI/7+Math.sin(i*7.1)*.12;return `<div class="vv" style="left:${(cx+Math.cos(a)*rx).toFixed(0)}px;top:${(cy+Math.sin(a)*ry).toFixed(0)}px;--w:${bw}px;--fs:${fs}px;animation-delay:${(i*1.0+0.8).toFixed(1)}s"><i>빛 속의 목소리</i>${esc(t)}</div>`}).join('');
    return `<div id="vo" class="${seen?'seen':''}" data-a="voiceskip"><div class="vt">정신력 ${G.ch.mind} · 마음이 한계에 닿았다</div>${vs}<div class="vc"><button class="btn vbtn" data-a="voicepick" data-i="good"><b>듣기 좋다</b><span class="mono small dim">목소리에 마음이 기운다</span></button><button class="btn vbtn" data-a="voicepick" data-i="bad"><b>듣기 싫다</b><span class="mono small dim">목소리를 밀어낸다</span></button></div></div>`;
  }
  function vEvent(){
    if(UI.omen)return vOmen();
    if(UI.fight){
      const e=D.enemies[UI.fight];
      const rule=(D.hiddenBosses||[]).find(h=>h.id===UI.fight),pen=rule&&rule.penalty&&!E.rankMet(G.ch,rule.penalty.fullRank)?rule.penalty:null;
      const enc=UI.enc&&UI.enc.hidden?`<div class="check"><b>${UI.enc.rift?(G.ch.flags&&G.ch.flags.lake?'호수 밑의 운명':'균열 너머의 운명'):T.hiddenBoss}</b>${pen?` · <span class="bad">${pen.label} · 명중 ${sg(pen.atk)} · 회피 ${sg(pen.eva)} (${pen.fullRank}${T.rankUnit}이면 보정 없음)</span>`:''}</div>`:UI.enc&&UI.enc.roll?`<div class="check">${UI.enc.label} · 1d100 ${UI.enc.roll} → <b>${e.n}</b></div>`:'';
      const avoid=UI.avoidText?`<p class="small dim">${UI.avoidText}</p>`:'';UI.avoidText=null;
      return `${vHud()}<div class="stack" style="gap:8px"><div class="eyebrow">${yearTag()}${E.age(G)}세의 해 · 전투</div>${avoid}${enc}<h2 style="color:${e.color}">${ulName(e.n+(UI.enc&&UI.enc.echo?' · 불순물':''),e.ul)}</h2>${e.trait&&D.traits&&D.traits[e.trait]?`<div class="check"><b>특성 · ${esc(D.traits[e.trait].n)}</b> · ${esc(D.traits[e.trait].d)}</div>`:''}${e.abno?`<div class="check" style="border-color:#8a7fb8"><b style="color:#8a7fb8">환상체</b> · 마주치면 정신력이 2d3 깎인다${G.ch.ego?` (E.G.O 하한 ${CFG.mind.ego[G.ch.ego.type].floor})`:''}</div>`:''}<p class="lead">${UI.enc&&UI.enc.rift?`갈라진 틈 너머에서 ${esc(e.n)}이(가) 흘러들었다. 이 세계의 사건과는 이어지지 않은 채 다른 운명에서 건너온 존재다. 만날 수 없던 상대가 지금 눈앞에 서 있다.`:UI.enc&&UI.enc.echo?'예전에 상대한 적이 있는 모습이다. 하지만 불순물과 같은 느낌이 든다.':e.intro}${UI.fight==='impurity'&&G.ch.infinite&&E.ghostOf(G.ch)?` <span class="dim">그런데 낯익다. 천 살을 넘긴 ${esc(E.ghostOf(G.ch).name||T.you)}. 이름을 잃고 저 자리에 서 있다${E.ghostOf(G.ch).aff?' ('+esc(E.ghostOf(G.ch).aff)+' 출신)':''}.</span>`:''}</p>${e.why&&!(UI.enc&&UI.enc.rift)?`<p class="small dim" style="font-style:italic">${esc(e.why)}</p>`:''}</div>
        <button class="btn primary" data-a="fight">맞선다</button>`;
    }
    const ev=UI.ev,ch=G.ch;
    const lockBtns=E.lockedOptions(G,ev).map(({c,i})=>({i,html:`<button class="btn" disabled><b>🔒 ${c.l}</b><span class="mono small dim">${c.lock}</span></button>`}));
    const btns=E.options(G,ev).map(({c,i})=>{
      let hint=c.h||'판정 없음 · 결과 확정';
      if(c.ok&&c.ok.fx&&c.ok.fx.relicRoll)hint=`1d100 · ${E.relicChance(ch)} 이하가 나오면 유물을 고른다${ch.relicBase?' (출신 보정 '+ch.relicBase+'%)':''}${(ch.stats.relicApt||0)>0?' (유물 적성 +'+ch.stats.relicApt+')':''}`;
      if(c.ok&&c.ok.fx&&c.ok.fx.voice){const M_=CFG.mind,dc=ch.voiceBias==='good'?M_.voiceGoodDc:ch.voiceBias==='bad'?M_.voiceBadDc:M_.voiceDc;hint=`1d${M_.voiceDie} × ${M_.voiceRolls} · 모두 ${dc} 이상이면 E.G.O 개화 · 셋 다 실패하면 바로 뒤틀린다${ch.voiceBias==='bad'&&(ch.stats.egoSight||0)>=M_.sureSight?' (장비의 형상이 또렷해 실패해도 개화한다)':''} · 실패하면 정신력 감소`}
      if(c.check){const pm=E.pathMod(ch,c.check);hint=`${c.check.s?STAT[c.check.s]+' 판정':'운 판정'} · 1d${c.check.die||(c.check.pure?100:E.checkDie(ch))} ${sg(E.checkMod(ch,c.check))} ≥ ${E.checkDc(ch,c.check)}${pm?` (출신 ${T.paths[c.check.path]} 보정 +${pm})`:''}${c.h?' · '+c.h:''}`}
      return {i,html:`<button class="btn" data-a="choose" data-i="${i}"><b>${c.l}</b><span class="mono small dim">${hint}</span></button>`};
    }).concat(lockBtns).sort((a,b)=>a.i-b.i).map(x=>x.html).join('');
    const page=`${vHud()}<div class="stack${ev.shake?' wave-shake':''}" style="gap:8px"><div class="eyebrow">${yearTag()}${E.age(G)}세의 해</div><h2>${ev.t}</h2><p class="lead" style="white-space:pre-line">${ev.x}</p></div><div class="stack">${btns}</div>`;
    return ev.voices&&G.ch.mind<=CFG.mind.voiceAt&&UI.voicePicked!==ev?page+voiceOverlay(ev):page;
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
      ${G.ch.relicPickLate?vLateRelic():G.ch.namePend?vNamePend():G.ch.pillPick?vPillPick():G.ch.custPick?vCustPick():G.ch.colorPick?vColorPick():G.ch.singPick?vSingPick():G.ch.bondColPick?vBondCol():G.ch.bondPick?vBondPick():G.ch.kidPick?vKidPick():G.ch.wingPick?vWingPick():G.ch.orgPick?vOrgPick():G.ch.fingerPick?vFingerPick():G.ch.seongPick?vSeongPick():G.ch.starPick?vStarPick():G.ch.officePick?vOfficePick():G.ch.distPick?vDistPick():G.ch.egoPick?vEgoPick():G.ch.titlePick?vTitlePick():`<button class="btn primary" data-a="flow">${nextLabel()}</button>`}</div>`;
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
      <p class="small">몸이 마음의 모양을 따라 비틀렸다. 이제 장비를 쥘 수 없고, 카드팩은 뒤틀린 카드팩으로 고정된다. 정신력 시스템은 사라진다. 몸이 안정되면(2년마다 40%) 장비와 카드팩을 다시 쓸 수 있고, 더 강해진 뒤틀린 카드팩을 얻는다.</p>
      <p class="small mono" style="color:#c25050">최대 HP +${CFG.distort.fx.maxHp} · 공격 +${CFG.distort.fx.atk} · 장비 전부 보관함으로 · 뒤틀린 카드팩 ${CFG.distort.deck.length}장으로 고정 (빛 없음) · 정신력 ??? (이점도 불이익도 없다) · E.G.O 장비를 얻을 수 없다</p>
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
  function vColorPick(){
    const P=E.colorPasv;
    return `<div class="panel stack" style="gap:8px;border-color:var(--gold)"><span class="eyebrow">특색 패시브</span>
      <p class="small">도시가 당신의 색을 불렀다. 색이 주는 힘 중 하나만 고를 수 있다.</p>
      <div class="stack" style="gap:8px">${Object.entries(P).map(([k,v])=>`<button class="btn" data-a="cpick" data-i="${k}"><b>${v.n}</b><span class="small dim">${v.e}</span></button>`).join('')}</div></div>`;
  }
  /* 특색 기념 의뢰: 이름·능력치·패시브를 직접 설계한다 */
  function vCustPick(){
    const ch=G.ch,K=CFG.ws.cust,cu=UI.cu=UI.cu||{name:'',atk:0,eva:0,hp:0,pas:null},noun=E.custNoun(ch);
    const used=cu.atk*K.atkCost+cu.eva*K.evaCost+cu.hp*K.hpCost+(cu.pas?K.passCost:0),left=K.pts-used;
    const stp=(k,l,cost,unit)=>`<div class="row between" style="gap:6px"><span class="small"><b>${l}</b> +${cu[k]*unit} <span class="dim">(${cost}포인트당 +${unit})</span></span><span class="row" style="gap:6px"><button class="chip" data-a="custd" data-i="${k}:-1" ${cu[k]<=0?'disabled':''}>−</button><button class="chip" data-a="custd" data-i="${k}:1" ${left<cost?'disabled':''}>＋</button></span></div>`;
    const nm=(cu.name||'').trim()||'이름 없는 '+noun,pv=[cu.atk?`공격 +${cu.atk*K.atkPer}`:'',cu.eva?`회피 +${cu.eva}`:'',cu.hp?`최대 HP +${cu.hp*K.hpPer}`:'',cu.pas?`패시브 · ${K.pass[cu.pas].n} (${K.pass[cu.pas].e})`:''].filter(Boolean);
    return `<div class="panel stack" style="gap:10px;border-color:var(--gold)"><span class="eyebrow">특색 기념 · 전용 ${noun}</span><p class="small">${esc(E.custIntro(ch))}</p>
      ${E.custKind(ch)==='aug'?`<div class="stack" style="gap:4px"><span class="small"><b>종류</b> <span class="dim">(종류마다 기본 보너스가 붙는다)</span></span><div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px">${Object.entries(CFG.custKinds).map(([k,v])=>`<button class="btn${(cu.ak||'aug')===k?' primary':''}" style="min-height:62px;justify-content:flex-start" data-a="cuk" data-i="${k}"><b>${v.n}</b><span class="mono small dim">${v.e}</span></button>`).join('')}</div></div>`:''}
      <div class="row" style="gap:8px"><span class="small"><b>이름</b></span><input id="cuname" maxlength="12" autocomplete="off" placeholder="${noun} 이름 (12자까지)" value="${esc(cu.name)}" style="flex:1;min-width:0"></div>
      <div class="row between"><b>포인트</b><span class="chip warn">남은 포인트 ${left}/${K.pts}</span></div>${stp('atk','공격',K.atkCost,K.atkPer)}${stp('eva','회피',K.evaCost,1)}${stp('hp','체력',K.hpCost,K.hpPer)}
      <div class="stack" style="gap:4px"><span class="small"><b>패시브</b> <span class="dim">(${K.passCost}포인트, 하나만)</span></span><div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;align-items:stretch">${Object.entries(K.pass).map(([k,v])=>`<button class="btn${cu.pas===k?' primary':''}" style="min-height:96px;justify-content:flex-start;word-break:keep-all" data-a="custp" data-i="${k}" ${cu.pas!==k&&!cu.pas&&left<K.passCost?'disabled':''}><b>${v.n}</b><span class="small dim">${v.e}</span></button>`).join('')}</div></div>
      <div class="panel stack" style="gap:4px"><span class="eyebrow">미리보기</span><b class="serif">${esc(nm)}</b>${pv.length?pv.map(t=>`<div class="mono small" style="color:var(--gold)">${esc(t)}</div>`).join(''):'<div class="small dim">아직 아무것도 고르지 않았다.</div>'}</div>
      <button class="btn primary" data-a="custok" ${used<=0?'disabled':''}>이 설계로 맡긴다</button><span class="small dim">포인트를 다 쓰지 않아도 맡길 수 있다. 맡기면 바꿀 수 없다.</span></div>`;
  }
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
  function vBondCol(){
    const b=G.ch.bond;
    return `<div class="panel stack" style="gap:8px;border-color:${esc(b.col.hex)}"><span class="eyebrow">인연 · ${esc(b.name)}의 특색 · <span style="color:${esc(b.col.hex)}">${esc(b.col.adj)}</span></span>
      <p class="small">${esc(b.col.adj)} 특색을 얻은 ${esc(b.name)}의 이름을 함께 정한다.</p>
      <div class="row"><span class="small">이름</span><input id="bondalias" maxlength="12" value="${esc(UI.bondAlias||'')}" autocomplete="off" placeholder="2~12글자" style="width:min(14em,60vw)"></div>
      <span class="small bad">${UI.bondErr||''}</span>
      <button class="btn primary" data-a="bondaliasset">이 이름으로 부른다</button></div>`;
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
    {const Lk=R.looks,lt=Lk?(st==='met'?(Lk.met||[])[Math.min(b.step||0,(Lk.met||[]).length-1)]:Lk[st]):null;if(lt||R.look)rows.push(['특징',lt||R.look])}
    if(R.immortal)rows.push(['도서관','이 도서관에서는 늙지도 떠나지도 않는다 · 아이도 지정사서가 된다'])
    if(b.alias)rows.push(['특색',`${b.alias} (${b.col.adj})`]);
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
      rows.push(['결혼 판정',`1d${BDc.die} + 인연 ${Math.min(b.love||0,BDc.steps)+(b.extra||0)} · ${BDc.marryNeed} 이상이면 성공 (인연 ${Math.min(b.love||0,BDc.steps)}/${BDc.steps}${b.extra?` · 더 쌓은 인연 ${b.extra}`:''})`]);
    }else rows.push(['대가',`최대 정신력 −${st==='left'?BDc.leaveMind:BDc.lossMind} (영구)`]);
    for(const k of b.kids||[]){const a=Math.max(0,G.year-k.born),J=(E.bondTx(G.ch).kidJobs.find(j=>j.k===k.job)||{}).l;rows.push([`아이 · ${k.n}`,k.dead?(k.dead==='old'?'오래 살다 눈을 감았다':'토벌 의뢰에서 쓰러졌다'):`${a}세${a>=BDc.kid.adult?' · '+J:' · 자라는 중'}`]);if(k.grand&&!k.dead)rows.push([`손주 · ${k.grand.n}`,`${Math.max(0,G.year-k.grand.born)}세 · ${k.n}의 아이`])}
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
      ${D.orgs[t].filter(n=>!(t==='wing'&&n===CFG.nWing.name&&E.nBlocked(G.ch))).map(n=>t==='syn'?(()=>{const F=D.fingers[n];return `<button class="btn" data-a="orgset" data-i="${esc(n)}"><b>${esc(n)}</b><span class="small">${esc(F.trait)}</span><span class="mono small" style="color:var(--gold)">${F.ranks.map(r=>esc(r.n)).join(' → ')}</span><span class="small dim">${esc(fingerPassive(n,0))}</span><span class="small dim">${esc(F.lore||'')}</span></button>`})():`<button class="btn" data-a="orgset" data-i="${esc(n)}"><b>${esc(n)}</b><span class="small dim">${esc(t==='office'?((D.offices||[]).find(o=>o.n===n)||{}).h||'':orgBrief(t,n))}</span></button>`).join('')}</div>`;
  }
  function vFingerPick(){
    return `<div class="panel stack" style="gap:8px;border-color:var(--gold)"><span class="eyebrow">손가락 가입</span>
      <p class="small">어느 손가락에 설지 고른다. 정하면 그 손가락의 서열표를 따른다.</p>
      ${G.ch.flags&&G.ch.flags.starborn&&!G.ch.pinkyFull?`<button class="btn" data-a="fingerset" data-i="소지"><b>정식 소지</b><span class="small">${esc(D.pinky.t)}</span><span class="mono small" style="color:var(--gold)">서열 없음 · 소지 한 곳에만 선다 (다른 손가락을 고르면 그 서열을 쌓으면서 +소지로 겸한다) · 인 → 의 → 예 → 지 (5년마다 별을 잇는다)</span><span class="small dim">${esc(D.pinky.e)} · 별을 하나 이을 때마다 성도에 그 별을 새긴다 (재료 강화와 별개인 추가 강화: 인 HP · 의 공격 · 예 회피 · 지 피해와 별 잇기) · 네 별을 모두 이으면 '별을 잇다' 한 장 더</span></button>`:''}
      ${D.orgs.finger.map(n=>{const F=D.fingers[n];return `<button class="btn" data-a="fingerset" data-i="${esc(n)}"><b>${esc(n)}</b><span class="small">${esc(F.trait)}</span><span class="mono small" style="color:var(--gold)">${F.ranks.map(r=>esc(r.n||(r.branch||[]).map(b=>b.n).join(' / '))).join(' → ')}</span><span class="small dim">${esc(fingerPassive(n,0)||'')}</span></button>`}).join('')}</div>`;
  }
  function vStarPick(){
    return `<div class="panel stack" style="gap:8px;border-color:var(--gold)"><span class="eyebrow">별에 선택받은 칼</span>
      <p class="small">태어날 때부터 손에 있던 칼이다. 네 개의 별이 이어진 밤을 기억하는 이름을 붙인다. 이름 뒤에 '성도'가 붙는다.</p>
      <div class="row"><span class="small">이름</span><input id="starname" maxlength="12" value="${esc(UI.starName||'')}" autocomplete="off" placeholder="1~12글자" style="width:min(14em,60vw)"></div>
      <span class="small bad">${UI.starErr||''}</span>
      <button class="btn primary" data-a="starset">이 이름으로 부른다</button></div>`;
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
    return `<div class="panel stack ent${compact?' compact':''}${isDanger(v.hp,X.maxHp)?' danger':''}" id="ent-${side}" style="background:color-mix(in srgb,${col} 9%,var(--panel));border-color:color-mix(in srgb,${col} 45%,var(--line))">
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
        <div class="stack" style="gap:6px;margin-top:10px"><span class="eyebrow">순서 1d100 + 속도×${CFG.spdMul}</span><div class="ordline">${li}</div>${pen}${vQueue()}</div></details>`;
    }
    return `<div class="panel stack" style="gap:6px"><span class="eyebrow">${C.round}라운드 · 순서 1d100 + 속도×${CFG.spdMul}</span>${li}${pen}${vQueue()}</div>`;
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
      UI.cbar=`<button class="btn quiet" data-a="skip">연출 건너뛰기</button>${autoOff}`;
      return M?`${duo(PRE)}${arenaHtml(true)}${vOrder(true)}${lg}`
        :`${entHtml('E',X,PRE.E)}${arenaHtml(true)}${entHtml('P',P,PRE.P)}${vOrder()}${lg}`;
    }
    const log=logBox(logLines(C.log.slice(-60))||'<div class="sys">전투가 시작되었다.</div>');
    if(C.over==='flee'){
      UI.cbar=`<button class="btn primary" data-a="finflee">호수를 벗어난다</button>`;
      return `${M?duo({E:X,P}):entHtml('E',X,X)+entHtml('P',P,P)}<div class="panel stack"><h2 class="good">도주 성공 · ${esc(X.name)}에게서 벗어났다</h2></div>${log}`;
    }
    if(C.over){
      const w=C.over==='win';
      UI.cbar=`<button class="btn primary" data-a="fin">${w?'전리품을 챙긴다':'결말을 본다'}</button>`;
      return `${M?duo({E:X,P}):entHtml('E',X,X)+entHtml('P',P,P)}<div class="panel stack"><h2 class="${w?'good':'bad'}">${w?'승리 · '+esc(X.name)+'을(를) 꺾었다':'당신은 쓰러졌다'}</h2></div>${log}`;
    }
    /* 전투 버튼은 화면 아래에 고정한 막대에 둔다: 내용 길이가 바뀌어도 버튼 자리는 움직이지 않는다 */
    const supBtns=(()=>{const ch=G.ch,K=CFG.supply,have=Object.keys(K.items).filter(id=>((ch.supply||{})[id]||0)>0);if(!have.length)return FIGHT==='auto'&&!UI.paused?'':'<div class="small dim" style="flex:1 1 100%">소모품 없음 · 공방 거리의 소지품에서 살 수 있다</div>';if(C.supplyRound===C.round)return '';return `<div class="row" style="gap:6px;flex-wrap:wrap;flex:1 1 100%">${have.map(id=>`<button class="chip" data-a="csupply" data-i="${id}">${esc(E.supplyName(ch,id))} ×${ch.supply[id]} · ${esc(K.items[id].e)}</button>`).join('')}</div>`})();
    const fleeBtn=X.name&&D.enemies[C.id]&&D.enemies[C.id].flee&&!E.lakeNoFlee(G.ch,C.id)?`<button class="btn" data-a="flee"><b>도주를 시도한다</b><span class="mono small dim">1d100 + 회피·속도 보정 ≥ ${D.enemies[C.id].flee.dc} · 실패하면 이번 라운드는 공격만 받는다</span></button>`:'';
    UI.cbar=FIGHT==='auto'?`${UI.paused?supBtns:''}<button class="btn${UI.paused?' primary':''}" data-a="pause"><b>${UI.paused?'이어서 진행':'일시정지'}</b></button>${fleeBtn}<button class="btn quiet" data-a="fightmode" data-i="pick">직접 고르기로 바꾸기</button>`
      :`${supBtns}<button class="btn primary" data-a="go">${UI.sel.length?'행동 개시':'카드 없이 방어 자세'}</button>${fleeBtn}<button class="btn quiet" data-a="fightmode" data-i="auto">자동 전투로 바꾸기</button>`;
    /* 빛 회복 카드(gain)는 내는 순간 빛이 그만큼 늘어난다 */
    const cost=UI.sel.reduce((a,i)=>a+E.cardCost(P,D.cards[P.hand[i]])-(D.cards[P.hand[i]].gain||0),0),left=P.light-cost;
    const cards=P.hand.map((id,i)=>{
      const c=D.cards[id],si=UI.sel.indexOf(i),lk=i===P.locked,dis=lk||(si<0&&E.cardCost(P,c)>left)||(c.needLow&&X.hp>X.maxHp*CFG.raven.low);
      return `<button class="card ${si>=0?'sel':''}${P.index&&i===P.starSlot?(P.oracle?' presc term':' presc'):''}" data-a="pick" data-i="${i}" ${dis?'disabled':''}>
        <span class="cost">${E.cardCost(P,c)}</span>${si>=0?`<em class="ord">${si+1}</em>`:''}${P.index&&i===P.starSlot&&!P.oracle?'<span class="prescTag">📜 지령</span>':''}
        <span class="nm">${kindBadge(c)} ${c.n}${c.t==='atk'&&P.cg&&P.cg.n?` <b style="color:var(--gold)">${P.cg.n}</b>`:''}${lk?` <span class="bad small">잠김 · ${esc(C.E.passive.n)}</span>`:''}</span>${c.t==='atk'?`<span class="mono small" style="color:var(--gold)">최종 명중 ${sg(P.atk+c.hit+(P.passHit||0)+(P.cg?P.cg.hit:0))}${P.fsOn&&P.fs?' (+선제 '+CFG.firstHit+')':''}</span>`:''}<span class="cd">${cardLine(c,c.t==='atk'?P.cg:null,P.wx)}</span>
        ${c.needCloud&&!(P.black||(P.cloud||0)>=c.needCloud)?`<span class="bad small">내는 순서가 올 때 구름이 ${c.needCloud} 이상이어야 효과가 난다 · 구름 ${P.cloud||0}/${c.needCloud} (출혈을 걸거나 맞을 때마다 +1, 앞선 카드로 채운다)</span>`:''}${c.needLow&&X.hp>X.maxHp*CFG.raven.low?`<span class="bad small">상대 HP ${Math.round(CFG.raven.low*100)}% 이하일 때만 낼 수 있다</span>`:''}
        ${c.kw?`<span class="chips">${kwChips(c)}</span>`:''}</button>`;
    }).join('');
    return `${M?duo({E:X,P})+vOrder(true):entHtml('E',X,X)+arenaHtml(false)+entHtml('P',P,P)+vOrder()+log}
      ${P.index&&P.starId?(P.oracle?`<div class="termBar" data-k="${C.round}:${P.starId}" data-t="${esc('지령 · '+D.cards[P.starId].n)}"><div class="tm">· · · · ·</div><div class="small">지령 수행 +1 (지금 ${P.presc||0}/${CFG.oracle.presc}) · 호흡 +4 · 받는 피해 −5%씩${P.herm?` · 타수 ${P.herm.wait?'(퓨리오소를 쓸 때까지 멈춤)':P.herm.n}`:''}${UI.sel.some(j=>j===P.starSlot)?' · <b class="good">✔ 수신한 지령을 따른다</b>':''}</div></div>`:`<div class="prescBar"><b>📜 이번 라운드 지령</b> · <b>${esc(D.cards[P.starId].n)}</b>을(를) 내라 <span class="small">→ 지령 수행 +1 (지금 ${P.presc||0}/5) · 호흡 +4 · 받는 피해 −5%씩</span>${UI.sel.some(j=>j===P.starSlot)?' <b class="good">✔ 지령 카드를 골랐다</b>':''}</div>`):''}
      ${triBar(P)}${formBar(P)}
      ${egoBar(C.ch)}
      <div class="row between"><span class="eyebrow">손패 · 고른 순서대로 위 순서에 들어간다</span><span class="mono" style="color:var(--gold)">${P.distorted?'빛 없음':`빛 ${left}/${P.light}`}</span></div>
      <div class="hand">${cards}</div>
      ${FIGHT==='auto'?`<div class="check">${UI.paused?'일시정지 · 다음 라운드를 기다린다':'자동 전투 중 · 카드를 알아서 고르고 진행한다'}</div>`:''}
      ${M?log:''}`;   /* 전투 화면 아래의 설정은 없앴다: 오른쪽 위 설정(⚙)과 같은 일을 하고, 누르면 전투 화면이 초기화되듯 돌아가서 헷갈렸다 */
  }
  /* 하나 협회 패시브: 카드 위에서 매 라운드 한 가지를 고른다 */
  const TRI_E={gun:'공격 피해 +'+CFG.tri.gun,gon:'받는 피해 −'+CFG.tri.gon+'%',gam:'빛 +'+CFG.tri.gam,ri:'HP +'+CFG.tri.ri.heal+' · 호흡 +'+CFG.tri.ri.breath};
  /* 보랏빛 사복검: 전투 중 라운드마다 자세를 하나 고른다 (카드를 고르기 전에) */
  const FORM_E={a:'참격 · 피해 +'+CFG.form.atkDmg,d:'방어 · 받는 피해 −'+CFG.form.defCut+'%',p:'관통 · 적중마다 출혈 +'+CFG.form.bleed,s:'타격 · 적중마다 상대의 흐트러짐 +'+CFG.form.stagger};
  function formBar(P){
    if(!E.formOk(C))return '';
    const used=C.formRound===C.round&&!PLAYING,off=PLAYING||FIGHT==='auto';
    return `<div class="triBar"><div class="small dim">${esc(CFG.form.weapon[P.form]||'보랏빛 사복검')} · 이번 라운드 자세를 고른다 (손패의 카드가 그 자세의 카드로 바뀐다)${used?' · <b class="good">'+esc(CFG.form.names[P.form])+' 선택</b>':''}</div><div class="row" style="gap:6px">${Object.keys(CFG.form.names).map(k=>`<button class="btn quiet${P.form===k?' primary':''}" style="flex:1;padding:8px 4px;flex-direction:column" data-a="form" data-i="${k}" ${off||used?'disabled':''}><b>${CFG.form.names[k].replace(' 자세','')}</b><span class="mono small dim" style="font-size:10px;line-height:1.2">${esc(FORM_E[k])}</span></button>`).join('')}</div></div>`;
  }
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
    if(c.aff&&c.fr)return `${esc(affName(c))} · ${esc(frName(c))}${c.oracle?' · 신탁대행자':''}${c.title?' · '+esc(c.title):''}`;
    if(c.licensed)return E.rankLabel(c)+(c.aff?' · '+esc(affName(c)):'');
    return c.aff?esc(affName(c)):T.unnamed;
  }
  /* 호수 출생의 엔딩 말투: 도시 대신 호수·항구 */
  const cityN=()=>G&&G.ch&&G.ch.flags&&G.ch.flags.lake?'호수':'도시';
  function endLead(c,w){
    if(c.flags&&c.flags.lake&&!c.job){
      if(!w)return c.title?'칭호는 남았지만, 그 이름을 부를 사람은 이제 없다.':'이름을 부르는 사람은 없었다. 물결만 계속 뱃전을 두드렸다.';
      return c.title?`항구는 이제 당신을 "${esc(c.title)}"(이)라고 부른다. 부두의 선원들이 그 이름을 입에 올린다.`:'항해 일지에 마지막 항해를 적었다. 호수는 여전히 그 자리에 있다.';
    }
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
    P.push(`${J.eun(E_(nm))} ${(pl=>pl?pl.n+', ':'')(placeOf(c.o,c.r,c.blank))}${J.ro(E_(c.o.n))} 태어났다. ${J.eul(E_(c.t.n))} 타고났고, ${J.eul(E_(c.f.n))} 짊어진 채, ${J.eul(E_(c.w.n))} 손에 쥐고 이 ${c.flags&&c.flags.lake?'호수의 부두':'도시의 골목'}에 섰다.`);
    if(c.job)P.push(`평범한 길은 일찍 닫혔다. ${E_(T.jobs[c.job])}의 자리가 ${E_(nm)}에게 주어졌고, 그 일은 사는 내내 이름을 대신했다.`);
    else if(c.aff&&c.corp&&c.corp.wing)P.push(`담장 안에서 시작해 담장을 스스로 세웠다. ${E_(c.corp.wing)}의 대표로서 이름을 걸었고, 그 이름은 다른 이들의 일자리가 되었다.`);
    else if(c.aff&&c.fr)P.push(`${E_(affName(c))}에 들어가 ${E_(frName(c))}까지 올랐다. 서열은 손이 아니라 버틴 햇수로 정해졌고, ${J.eun(E_(nm))} 그 계단을 하나씩 밟았다.`);
    else if(c.aff)P.push(`${E_(affName(c))}의 일원으로 해를 넘겼다.`);
    else P.push('어디에도 속하지 않았다. 혼자 움직이는 편이 낫다는 말은 처음 한 말 그대로 끝까지 남았다.');
    if(c.licensed&&!c.job)P.push(`해결사로서는 ${c.rank}${T.rankUnit}${c.title?` · ${E_(c.title)}`:''}에 닿았다. 의뢰서에 적힌 이름 하나하나가 ${yr}년 동안 쌓은 기록이다.`);
    else if(c.title)P.push(`${jp(E_(c.title),'이라는','라는')} 이름이 붙었다. 누가 먼저 불렀는지는 아무도 기억하지 못한다.`);
    if(c.beaten.length)P.push(`그 사이 도시가 감춰 둔 것들과 마주쳤다. ${[...new Set(c.beaten)].map(id=>E_(D.enemies[id].n)).join(', ')}. 이름이 기록에 남지 않은 싸움도 있었고, 이름만 남은 싸움도 있었다.`);
    /* 은원 장부: 도운 일·등 돌린 일·지나친 일이 쌓였으면 한 줄씩 남긴다 */
    {const L=c.ledger||{};
      if((L.help||0)>=4)P.push('은혜는 갚는 쪽이 먼저 기억한다고 했다. 도운 이들의 얼굴이 도시 곳곳에 남아, 낯선 길에서도 고개를 끄덕여 주었다.');
      if((L.betray||0)>=2)P.push('원한은 소리 없이 쌓였다. 등을 돌린 이들의 말이 골목마다 돌았고, 그 말은 끝내 이름보다 오래 남았다.');
      if((L.silence||0)>=5)P.push('지나친 일이 많았다. 잘못이라 할 것은 아니었지만, 도시는 침묵도 장부에 적는다.')}
    if(E.bondMarried(c)){const k=(c.bond.kids||[]);P.push(`곁에는 ${J.i(E_(c.bond.name))} 있었다. ${k.length?`아이 ${jp(k.map(x=>E_(x.n)).join(' · '),'과','와')} 함께 식탁을 나눴다. `:''}도시의 해가 바뀔 때마다 한 사람 몫의 자리가 더 비어 있지 않다는 것이 가장 큰 보상이었다.`)}
    else if(c.bond&&c.bond.st==='lost')P.push('한 번은 곁에 누군가 있었다. 지키지 못한 이름 하나가 오래 남았다.');
    if(c.distForm)P.push(`육신은 뒤틀렸고, ${J.i(E_(c.distForm.n))} 이름이 되었다. 그래도 걸음은 멈추지 않았다.`);
    else if(c.ego)P.push(`마음이 무너지려던 순간 붙잡은 모양이 ${J.i(E_(c.ego.n||'E.G.O'))} 되어 곁에 남았다. 그것은 무기이기 전에 버틴 증거였다.`);
    if(c.o&&c.o.key==='librarian'){const n=(c.rt&&c.rt.guests)||0;P.push(`도서관의 지정사서로서 ${n}명의 손님을 책으로 남겼다. 초대장에 적힌 이름은 서가에 올랐고, ${w?'서가는 끝내 외곽으로 옮겨졌다.':'사서가 쓰러진 날 아벨은 그 이름이 적힌 책을 서가에 꽂았다. 책의 등급은 마지막 손님의 등급에 맞춰졌다.'}`)}
    P.push(w?(tr?`${yr}년. 도시가 붙일 수 있는 가장 높은 이름을 넘어섰다. 발톱도, 조율자도 ${J.eul(E_(nm))} 막지 못했다. 끝이라고 부르던 자리 너머로 길은 이어져 있었다.`:`${yr}년. ${c.flags&&c.flags.lake?'호수는 해마다 깊어졌고':'도시는 해마다 시끄러웠고'} 해마다 조용해졌다. ${J.eun(E_(nm))} 그 소란 속에서 끝까지 서 있었다. 이야기는 여기서 한 막을 내린다.`):'');
    return P.filter(Boolean);
  }
  function kinLine(c,w,dt){
    const b=c.bond,kids=(b&&b.kids||[]).filter(k=>!k.dead);if(!E.bondTx(c).ending)return '';
    if(!w&&dt&&dt.hunt)return `<p class="small" style="border-left:2px solid var(--gold);padding-left:10px">${esc(E.bondFill(E.bondTx(c).hunt.ending[G.infinite?'inf':G.endless?'act2':'act1'].replace(/\{k\}/g,'{n}'),{name:dt.hunt}))}</p>`;
    if(!kids.length)return '';
    const X=E.bondTx(c).ending,ph=G.infinite?'inf':G.endless?'act2':'act1',forgot=!w&&(c.distForm||(dt&&dt.cause==='distort'));
    const t=forgot?X.forgotten[ph]:w?(UI.oldEnd?X.win.old:X.win[ph]):X.death[ph];
    return t?`<p class="small" style="border-left:2px solid var(--gold);padding-left:10px">${esc(t).replace(/\{k\}/g,kids.length>1?'자식들':'자식')}</p>`:'';
  }
  const diffOf=c=>c.easy?'쉬움':c.hard?'하드':'보통';
  /* 출생 보정 없이 시작한 존재가 제 1막을 넘겼을 때(제 2막에 이르렀을 때)의 전용 엔딩 */
  /* 흑수 루트 엔딩 끝: 연인이면 함께, 아니면 역할을 다하고 가주와 헤어진다 */
  const hwTail=(c,k)=>{if(!c||!c.hw||k!=='hwflee')return '';const nm=(c.bond&&c.bond.name)||'후보';
    return c.hw.loved?(k==='hwmaker'?` ${nm}은(는) 가주의 자리에서도 곁의 자리 하나를 비워 두었다. 그 뒤로도 두 사람은 함께였다.`:` ${nm}의 손은 그 뒤로도 당신의 소매를 놓지 않았다. 두 사람은 함께 걸었다.`):` 당신은 당신의 역할을 다했다. ${nm}과(와)는 여기서 헤어졌다. 서로 이름을 부르지 않은 채, 각자의 길로.`};
  const blankEnd=(c,w)=>{if(UI.crowEnd&&w)return UI.crowEnd;if(UI.rbEnd&&w)return 'rcorp';if(UI.hwEnd&&w)return UI.hwEnd;if(!(w&&c&&!c.distForm&&!G.endless&&!UI.oldEnd&&!UI.overflowEnd&&!UI.trueEnd))return '';const m=!!(E.bondMarried&&E.bondMarried(c));return c.rb&&c.rb.done?'rcorp':c.blank?(m?'blankwed':'blank'):m?'wed':''};
  const BLANK_END={gwmoth:['나방 공주의 밤','전쟁이 끝난 밤, 몸이 가볍게 갈라지며 날개가 펼쳐졌다. 가루가 떨어지는 자리마다 불빛이 흔들렸다. 군체는 말없이 공주를 올려다보았다. 공주는 왕좌에 앉지 않고 창가에 서서 도시의 불빛을 한참 보았다. 불빛은 모두 이쪽을 향해 날아오고 있었다.'],
    gwroach:['바퀴 황제의 왕좌','전쟁이 끝난 뒤에도 몸은 죽지 않았다. 부서진 자리마다 갑각이 자랐고, 쓰러뜨린 자리마다 군체가 모였다. 황제는 왕좌에 앉았다. 왕좌는 폐허의 한가운데였다. 어떤 것도 이 몸을 끝낼 수 없다는 것을 황제는 알았다. 끝낼 것이 없다는 사실이 가장 무거웠다.'],
    gwfly:['파리 대왕의 식탁','전쟁터는 곧 식탁이 되었다. 대왕이 손을 들자 군체가 일제히 소리를 낮추었다. 썩은 것과 새로 난 것이 같은 접시 위에 놓였다. 대왕은 아무것도 먹지 않고 군체가 먹는 것을 오래 지켜보았다. 이 도시는 한동안 조용하지 않을 것이다.'],
    gwhuman:['인간으로 남은 병기','병기의 몸으로 인간의 하루를 살기로 했다. 이음매는 아직 뻐근했고 먹은 것들은 몸 안에서 조용했다. 왕족의 인자는 깊은 곳에 누웠다. 이 몸이 무엇을 위해 만들어졌는지는 알고 있다. 그래서 오늘은 아무것도 먹지 않고 아침을 맞았다.'],
    clawreturn:['돌아온 발톱','도서관의 힘을 뽑아 머리에게 가져갔다. 도서관은 도시의 지도에서 사라졌다. 불빛이 하나씩 켜지는 쪽으로 걸었다. 머리의 대기실은 비어 있었고, 책상에는 명령서 한 장이 놓여 있었다. 사유 칸에는 번호만 있었다. 판 위의 말로 돌아온 것이다. 발톱은 날을 세우지 않은 채 서랍에 넣었다.'],
    clawstay:['길을 닫은 발톱','도서관을 서가 하나 남기지 않고 무너뜨렸다. 책 속의 이름들이 흩어졌다. 발톱을 길 입구에 내려놓았다. 명령서는 더 이상 도착하지 않았다. 선 바깥은 해가 뜨는 방향이 매번 달랐다. 쫓아가지 않았다. 이름 없는 날은 길 위에서 녹이 슬었다.'],
    arbkeep:['한쪽을 남긴 조율자','도서관의 힘을 뽑아 균형의 한쪽을 도시에 남겨 두고 돌아섰다. 도서관은 도시의 지도에서 사라졌다. 남은 쪽은 조율 장부에 한 줄로 기록되었다. 도시는 이 한쪽 없이도 균형을 맞추는 법을 알고 있었다. 머리는 아무 말도 하지 않았다.'],
    arbdown:['내려온 조율자','도서관을 조율의 대상에서 지웠다. 서가가 하나씩 사라졌다. 조율자의 인장을 길 위에 내려놓았다. 인장은 한참 뒤에야 땅에 닿는 소리를 냈다. 맞추지 않아도 되는 날이 처음으로 하루 이어졌다. 그것은 쉬운 하루가 아니었다.'],
    libstay:['책이 된 사서','도서관이 외곽으로 옮겨진 날, 사서는 마지막 책을 서가의 가장 높은 칸에 꽂았다. 서재 문은 열려 있었지만 아벨은 아무 말도 하지 않았다. 도시로 가는 초대장은 그 뒤로도 끊기지 않았다. 사서는 오늘도 손님이 오기 전에 서가의 먼지를 턴다. 단 하나의 책이 만들어졌는지는 아무도 말해 주지 않았다. 사서는 묻지 않았다.'],
    libclose:['문을 닫는 사서','제나가 쓰러진 자리에서 사서는 서가의 불을 하나씩 껐다. 책들은 도시의 별처럼 서가에서 흩어졌다. 만들던 책은 누구에게도 읽히지 못한 채 한 장 모자라게 남았다. 아벨은 서재 문 앞에서 오래 서 있었다. 도서관은 도시에도 외곽에도 없다. 사서는 마지막 책의 표지를 쓰다듬었다. 표지에는 아무 이름도 적혀 있지 않았다.'],
    hermobey:['끝난 지령','뤼엔이 쓰러지고 단말기가 한 번 울렸다. 문장이 아니라 빈 화면이었다. 오래 따른 지령이 처음으로 아무것도 말하지 않았다. 식탁에는 그릇이 하나 놓여 있고, 그 앞에 앉았다. 같은 길의 끝에서 파도 소리를 들었다. 단말기는 서랍에 넣지 않았다. 켜진 채로 두었다.'],
    hermfree:['지령 없는 아침','다리를 건넌 아침이었다. 뤼엔이 쓰러진 자리에서 단말기가 한 번 울렸다. 이번에도 문장이 아니라 점 하나였다. 파도 소리는 멀리서 잠깐 들렸다가 멎었다. 식탁에는 아직 따뜻한 국이 있다. 오늘의 지령은 해가 지기 전에 다리를 건너는 것뿐이다. 그 정도라면 따라도 좋겠다고 생각했다.'],
    crowsucceed:['처분 판정서의 마지막 장','서명란에 이름이 올라가는 순간 방의 불이 한 번 깜빡였다. 니콜라이가 앉아 있던 자리는 비었고, 그 자리에는 이제 당신이 앉는다. 총사령관의 책상에는 처분 판정서가 한 장 놓여 있다. 첫 줄의 대상은 비어 있다. 이 장부는 앞으로 한 줄씩 채워질 것이다. 책상 옆에서 검은 세이버가 한 번 반짝였다. 처음으로, 쓰는 쪽에 앉았다.'],
    crowrefuse:['돌아가지 못한 사령관','명령서는 찢어졌지만 자리는 비우지 않았다. 사령관의 자리를 지킨 채 도시 밖의 임무에 나섰다. 불순물의 흔적을 따라간 곳에서 길이 어긋났다. 돌아가는 길을 몇 번이나 되짚었지만 도착하는 곳은 도시가 아니었다. 외곽의 차원이 방향을 틀어 놓았고, 도시는 더 이상 돌아갈 수 있는 자리가 아니었다.'],
    wfree:['열차를 내린 사람','승강장에 처음으로 해가 졌다. 서류에는 서명이 남았고, 손에는 닳은 공구가 쥐여 있었다. 열차는 당신 없이 출발 신호음을 울렸다. 열 번을 세기도 전에 끝나는 소리였다. 당신은 그 소리를 등지고 걸었다. 특이점이라는 말도, 열차 안의 일도 이제 입에 올릴 수 없다. 어떠한 이유에서인지는 알 수 없다. 도시에는 아직 당신이 모르는 길이 많다.'],
    wrival:['열차를 쓰지 않는 계약','웨이페어러 컴퍼니의 안내원이 서류를 내밀었다. 열차 없이 문과 문을 잇는 계약이었다. 계약금으로 오랜만에 따뜻한 끼니를 먹었다. W사의 날개 자리는 흔들리고, 그 흔들림 안에서 당신은 이름 없는 직원 하나로 남았다. 시간을 도둑맞지 않는 길도 있다는 것이 이상하게 느껴졌다.'],
    wstay:['출발 신호음 없는 열차','서류는 서랍 안에서 번호표가 되었다. 정리 요원장이 된 당신은 도착한 열차마다 이름 없는 조각을 가려 좌석에 앉힌다. 승객은 열 번을 세기 전에 도착했다고 믿는다. 당신은 그 열 번 사이에 일어난 모든 일을 기억하는 몇 안 되는 사람이다. 다음 열차가 들어온다.'],
    hwmaker:['가주메이커','가주는 문 안에서 나왔다. 같은 얼굴이지만 무언가 바뀐 가주와 함께한다. 어째선지 모르겠지만, 무언가 놓친 것 같다. 하지만 흑수 필두로서 가주를 지킬 뿐이다.'],
    hwflee:["후보를 데리고 떠난 필두","후보는 선황충도 가주의 자리도 받아들이지 않았다. 필두는 그 손을 잡고 누각을 나섰고, 열두 흑수는 길을 열어 주었다. 가문은 방계의 자객과 추격하는 흑수, 흑수 필두들, 마지막으로 홍루까지 보냈지만 모두 길 위에서 쓰러졌다. 가문의 중압감도, 어두운 비밀도 이제 등 뒤에 있다. 홍원 밖의 도시는 낯설고 넓다. 두 사람의 이야기는 지금부터다."],
    hwhost:['선황충을 품은 가주','붉은 누각의 등이 모두 켜졌다. 열두 흑수가 고개를 숙이고 가주의 자리가 비워졌다. 자리에 앉은 것은 당신이지만, 선황충은 당신의 이름으로 먹고 마신다. 몸은 지칠 줄 모르고 마음은 한 겹 멀다. 홍원은 새 주인을 얻었고, 주인은 아직 자기가 누구인지 모른다.'],
    hwbreak:['철함사의 목을 친 가주','흑수 선인에게서 얻은 재갈이 허리춤에서 짤랑거렸다. 수레는 멈췄고 선황충은 숙주를 얻지 못한 채 향 속에서 말라 갔다. 어르신들은 일어서지 못했다. 열두 흑수가 새 가주 앞에 고개를 숙이고, 가주의 몫이던 네 재갈마저 당신의 허리춤으로 건너왔다. 홍원의 가주 자리는 더 이상 함정이 아니다.'],
    hwfree:['홍원의 가주','선황충을 상자에 가둔 채 가주의 자리에 앉았다. 어르신들은 일어서지 않았고 열두 흑수는 새 주인 앞에 말없이 무릎을 꿇었다. 가문의 식탁에는 이제 자리마다 이름표가 없다. 가장 먼 자리에도 따뜻한 밥이 놓인다.'],
    rcorp:['나는 존재한다. 그러므로 살아있다','부화장에서 같은 얼굴 열둘을 쓰러뜨리고 나왔다. 본체인지 복제체인지는 끝내 알 수 없었다. 번호표는 재가 되었고, 추격대의 호출 부호도 끊겼다. 이름 없는 몸으로 첫 번째 막을 넘겼다. 누가 만들었든, 지금 숨을 쉬는 것은 당신이다. 나는 존재한다. 그러므로 살아있다.'],
    blank:['아무것도 없는 존재',`이름도 내력도 쥐여 주지 않은 채 태어난 존재가 ${CFG.years}년을 걸어 첫 번째 막을 넘겼다. 아무것도 없던 손에는 이제 이 도시에서 살아낸 시간이 있다. 도시는 그것을 기억하지 않지만, 당신은 기억한다.`],
    wed:['함께 넘은 첫 번째 막',`같은 이름을 오래 불렀다. 도시는 변했고 서류 속 이름은 닳았지만, 문을 열면 대답하는 사람이 있었다. ${CFG.years}년이 지나 첫 번째 막이 끝났다. 다음 막에도 그 목소리는 곁에 있을 것이다.`],
    blankwed:['아무것도 없는 존재 · 가족',`아무것도 없던 존재가 누군가의 이름을 불렀고, 누군가가 대답했다. ${CFG.years}년이 지나 첫 번째 막이 끝났을 때 곁에는 같은 지붕 아래의 사람이 있다. 아무것도 없던 곳에서 시작한 이야기가 둘이 되었다.`]};
  const OUTEND={seal:['균열이 닫혔다','균열 너머에서 흘러든 이름들이 하나둘 쓰러졌다. 마지막 하나가 눈을 감자 세계의 균열은 당신이 선 자리에서 가장 먼저 아물었다. 머리도 닫지 못한 문을, 당신이 한 겹 닫았다.'],
    star:['도시의 별이 되었다','이름을 가진 존재들 거의 전부와 맞서 이겼다. 도시의 장부에는 더 이상 당신에게 붙일 이름이 없었고, 사람들은 하늘에 새로 뜬 별 하나를 당신의 이름으로 불렀다.'],
    settle:['외곽에 집을 지었다','괴수의 울음이 닿지 않는 언덕에 작은 집을 지었다. 식탁에는 가족의 자리가 있고, 창밖의 균열은 오늘도 멀리서 닫혀 간다.']};
  /* 오늘의 시드: 그날 도전 기록. 이번 결과를 이전 최고와 견준다 */
  function vDailyCmp(){
    const o=UI.dailyCmp;if(!o||!G||!G.ch||G.ch.daily!==o.day)return '';
    const sc=x=>(x.w?1000:0)+x.y,cur=o.cur,pv=o.prev,row=(l,x)=>`<div class="row between" style="gap:10px"><span>${l}</span><b class="small" style="text-align:right">${esc(x.h||'')} · ${x.y}년 · Lv ${x.lv}</b></div>`;
    let cmp='첫 도전이다. 다음 도전부터 이 기록과 견줘 준다.';
    if(pv){const d=cur.y-pv.y;cmp=cur.w&&!pv.w?'이전 최고보다 나아졌다 (완주).':!cur.w&&pv.w?`이전 최고는 완주 기록이다. 완주하지 못한 이번 판은 ${d>0?`${d}년 더 살았어도 `:''}그보다 낮게 친다.`:d>0?`이전 최고보다 ${d}년 더 살았다.`:d===0?'이전 최고와 같다.':`이전 최고보다 ${-d}년 짧다.`}
    return `<div class="panel stack" style="gap:6px"><span class="eyebrow">오늘의 시드 · ${esc(o.day)} · ${o.n}번째 도전</span>${row('이번',cur)}${pv?row('이전 최고',pv):''}<p class="small" style="color:var(--gold)">${cmp}</p></div>`;
  }
  function vEnd(){
    const c=G.ch,w=UI.endWin,dt=UI.death,X=CFG.endless,gi=E.gradeAt(G.year),tr=w&&UI.trueEnd,df=c.distForm;
    /* 전투 중 E.G.O 개화·뒤틀림 이름을 정하기 전에 판이 끝났으면(전투에서 쓰러짐 등) 결과 화면에서 먼저 정한다 */
    if(c.namePend)return `<div class="stack" style="gap:12px"><div class="eyebrow">이야기를 끝내기 전에</div>${vNamePend()}</div>`;
    return `<div id="endShot" class="stack" style="gap:12px"><div class="stack" style="gap:8px;padding-top:12px"><div class="eyebrow"${df?' style="color:#c25050"':''}>${UI.overflowEnd?'히든 엔딩 · 오버플로우':df?distEyebrow(w,tr,dt):UI.outEnd?OUTEND[UI.outEnd][0]:UI.outerEnd?'외곽에서 이야기를 끝냈다':UI.oldEnd?'히든 엔딩 · 늙었다는 것은 살아남았다는 것':tr?'발톱과 조율자를 넘어섰다':blankEnd(c,w)?BLANK_END[blankEnd(c,w)][0]:w?CFG.years+'년을 살아냈다':dt&&dt.id==='hongru'?'홍원에 군주가 태어났다':dt&&dt.hunt&&G.ch.distForm?'당신은 사랑하던 이의 손에 쓰러졌다':dt&&dt.cause==='distort'?'당신은 뒤틀렸다':cityN()+'는 당신을 기억하지 않는다'} · ${E.age(G)}세</div>
      <h1 style="color:${c.color}">${esc(c.name||careerLine(c))}</h1>
      ${c.name?`<div class="mono small" style="color:${c.color}">${careerLine(c)}</div>`:''}
      ${df?`<div><span class="chip" style="color:#c25050;border-color:#c25050">뒤틀림 · ${esc(df.n)}</span></div>`:''}
      ${E.bondMarried(c)?`<div><span class="chip">가족 · ${esc(c.bond.name)}${c.distForm?' (당신을 알아보지 못한다)':''}</span></div>`:''}
      ${c.bond&&c.bond.st==='lost'&&c.bond.name?`<div><span class="chip">가족 · ${esc(c.bond.name)} (${c.bond.dieBy==='age'?'수명을 다해 세상을 떠났다':'세상을 떠났다'}${c.bond.dieYear?' · '+c.bond.dieYear+'년차':''})</span></div>`:''}
      ${E.isWs(c)&&(c.gear.weapon||c.gear.armor)?`<div class="row" style="gap:6px;flex-wrap:wrap">${[c.gear.weapon,c.gear.armor].filter(Boolean).map(g=>`<span class="chip">공방 ${g.slot==='weapon'?'무기':'방어구'} · ${esc(g.n)}</span>`).join('')}</div>`:''}
      ${(c.bond&&(c.bond.kids||[]).length)?`<div class="row" style="gap:6px;flex-wrap:wrap">${c.bond.kids.map(k=>{const a=Math.max(0,G.year-k.born);if(k.dead)return `<span class="chip" style="opacity:.75">아이 · ${esc(k.n)} (${k.dead==='old'?'수명을 다해 세상을 떠났다':'토벌 의뢰에서 쓰러졌다'}${k.dieYear?' · '+k.dieYear+'년차':''})</span>`;return `<span class="chip">아이 · ${esc(k.n)} ${a}세${a>=CFG.bond.kid.adult?' · '+esc((D.bond.kidJobs.find(j=>j.k===k.job)||{}).l):''}</span>`}).join('')}</div>`:''}
      ${c.title?`<div><span class="chip" style="color:var(--gold);border-color:var(--gold)">${c.titleKind==='top'?'칭호':T.titleLabel} · ${esc(c.title)}</span>${c.title2?` <span class="chip" style="color:var(--gold);border-color:var(--gold)">칭호 · ${esc(c.title2)}</span>`:''}</div>`:''}
      ${!w&&dt?`<div class="mono small bad">${dt.year}년차 · ${dt.cause==='distort'?'뒤틀림':dt.cause==='sunk'?'배가 가라앉았다':dt.cause==='mind'?'정신 붕괴로 쓰러졌다':esc(dt.foe)+'에게 쓰러졌다'}${dt.hidden?' (히든 보스)':''}</div>`:''}
      <div class="row" style="gap:8px;flex-wrap:wrap"><span class="chip" style="color:${c.hard?'#c25050':c.easy?'#6aa0c4':'var(--fg)'};border-color:currentColor">난이도 · ${diffOf(c)}</span><span class="mono small dim" style="align-self:center">시드 ${c.seed}</span></div>
      <p class="lead">${UI.overflowEnd?'이름 없는 불순물이 되다. 천 살이 차자 이름이 먼저 떨어져 나갔다. 당신은 이 세계에 맞지 않는 것, 이름 없는 불순물이 되었다. 이제 다른 세상의 어긋난 자리를 떠돈다. 그곳에서 누군가 당신을 마주친다면, 당신은 그에게 맞서야 할 불순물이다.':df?distLead(c,w,tr,dt):UI.outEnd?OUTEND[UI.outEnd][1]:UI.outerEnd?'머리가 닫은 문 바깥, 아무도 이름을 붙이지 않은 땅에서 당신은 걸음을 멈췄다. 괴수들의 울음이 멀어졌다. 쫓겨난 것이 아니라 스스로 닿은 자리라고, 누군가는 기록할 것이다.':UI.oldEnd?'백 살을 넘겼다. 이 도시에서 늙는다는 것은 끝까지 이겨 왔다는 뜻이다.':blankEnd(c,w)?BLANK_END[blankEnd(c,w)][1]+hwTail(c,blankEnd(c,w)):dt&&dt.id==='hongru'?'홍루가 가주의 자리 앞에서 붕대를 천천히 풀었다. 주인을 잃은 열 흑수가 그의 곁으로 모였다. 붉은 누각의 등이 하나씩 켜졌고, 홍원에는 군주가 살게 되었다. 이 세계에서 홍원 군주는 그렇게 태어났다.':dt&&dt.cause==='distort'?'당신의 모양을 한 무언가가 골목에 남았다. 사람들은 그것을 더 이상 당신의 이름으로 부르지 않는다.':dt&&dt.cause==='sunk'?'배가 호수 밑으로 가라앉았다. 선원들의 이름을 부르는 소리가 물결에 묻혔다.':dt&&dt.cause==='mind'?'몸은 멀쩡했지만, 마음이 먼저 꺼졌다.':tr?'바랄의 발톱도, 제나의 봉인도 당신을 멈추지 못했다. 금기를 정하던 쪽이 처음으로 질문을 받았고, 도시의 문은 한 번도 닫힌 적 없는 방향으로 한 뼘 열렸다. 당신을 부르는 이름은 도시의 어느 장부에도 맞지 않았다. 끝이라고 불리던 자리 너머로 외곽이 이어진다.':endLead(c,w)}</p>
      ${kinLine(c,w,dt)}
      ${w?`<div class="panel stack" style="gap:8px"><span class="eyebrow">행적</span>${epilogue(c,w,tr).map(t=>`<p class="small" style="line-height:1.65">${t}</p>`).join('')}</div>`:''}
      ${vRecord(c,w,gi)}
      ${c.beaten.length?`<div class="panel stack" style="gap:6px"><span class="eyebrow">${T.hiddenWin}</span><b>${[...new Set(c.beaten)].map(id=>D.enemies[id].n).join(' · ')}</b>${UI.endText?`<p class="small">${UI.endText}</p>`:''}${c.unlocks.length?`<p class="small" style="color:var(--gold)">해금 · ${c.unlocks.map(k=>T.jobs[k]).join(', ')}</p>`:''}</div>`:''}</div>
      <div class="panel stack"><div class="stat"><div><b${fit(c.lv)}>${c.lv}</b><span>레벨</span></div><div><b${fit(sg(c.stats.atk))}>${sg(c.stats.atk)}</b><span>공격</span></div><div><b${fit(sg(c.stats.eva-E.infEvaCut(c)))}>${sg(c.stats.eva-E.infEvaCut(c))}</b><span>회피</span>${c.infinite&&E.infEvaCut(c)>0?`<span class="sub">무한 모드 −${E.infEvaCut(c)}${c.stats.eva-E.infEvaCut(c)<=0?'<br>0에서 멈춤':''}</span>`:''}</div><div><b${fit(sg(c.stats.spd))}>${sg(c.stats.spd)}</b><span>속도</span></div></div>
      ${endDeck(c)}
      <div class="mono small dim">${(pl=>pl?pl.n+' · ':'')(placeOf(c.o,c.r,c.blank))}${c.o.n} · ${c.t.n} · ${c.f.n} · ${c.w.n}${c.aff?' · '+esc(affName(c)):c.licensed?' · '+T.licensed:''}</div></div>
      <div class="mono small dim" style="text-align:center">도시의 한 해 · cityyear-fanmade.github.io/city-year · Project Moon 팬메이드</div></div>
      ${vDailyCmp()}
      ${UI.newOrigin?`<div class="panel stack" style="gap:6px;border-color:var(--gold)"><span class="eyebrow">출생 해금</span><p class="small">${esc(UI.newOrigin)} 출생을 이제 골라서 시작할 수 있다. 출생 화면의 '해금된 출생'에서 고른다.</p></div>`:''}
      ${w&&!G.endless?`<div class="panel stack" style="gap:6px"><span class="eyebrow">제 1막 종료</span><p class="small">여기서 끝내도 된다. 제 2막이 시작되면 ${X.span}년마다 도시의 위협 등급이 오른다. ${X.grades.join(' → ')}. 마지막 등급을 넘기면 제 2막의 결말이다. 도중에 쓰러지면 거기까지가 기록이 된다.</p><button class="btn primary" data-a="endless">제 2막 시작</button></div>`:''}
      ${w&&UI.outEnd?`<div class="panel stack" style="gap:6px"><span class="eyebrow">무한 모드 엔딩</span><p class="small">여기서 끝내도 된다. 계속 살아가면 무한 모드가 이어진다. 도중에 쓰러지면 거기까지가 기록이 된다.</p><button class="btn primary" data-a="oldgo">계속 살아간다</button></div>`:''}
      ${w&&UI.oldEnd?`<div class="panel stack" style="gap:6px"><span class="eyebrow">히든 엔딩</span><p class="small">여기서 끝내도 된다. 계속 살아가면 무한 모드가 이어진다. 도중에 쓰러지면 거기까지가 기록이 된다.</p><button class="btn primary" data-a="oldgo">계속 살아간다</button></div>`:''}
      ${w&&(UI.hwEnd||UI.rbEnd)&&G.endless&&!UI.trueEnd?`<div class="panel stack" style="gap:6px"><span class="eyebrow">이야기의 끝</span><p class="small">여기서 끝내도 된다. 계속 살아가면 제 2막이 이어진다. 도중에 쓰러지면 거기까지가 기록이 된다.</p><button class="btn primary" data-a="oldgo">계속 살아간다</button></div>`:''}
      ${w&&INF_KEYS.includes(UI.crowEnd)&&!G.infinite?`<div class="panel stack" style="gap:6px"><span class="eyebrow">제 2막 · 무한 모드</span><p class="small">여기서 끝내도 된다. 계속 살아가면 ${INF_WHY[UI.crowEnd]}. 위협 보정이 끝없이 오르고, ${CFG.infinite.every}년마다 외곽의 괴수(더 강해진 불순물)가 나타나며, 루트 전용 히든 보스를 만날 확률이 오른다. 도중에 쓰러지면 거기까지가 기록이 된다.</p><button class="btn primary" data-a="infinite">무한 모드로 계속한다</button></div>`:''}
      ${w&&UI.crowEnd==='crowrefuse'&&!G.infinite?`<div class="panel stack" style="gap:6px"><span class="eyebrow">제 2막 · 무한 모드</span><p class="small">여기서 끝내도 된다. 계속 살아가면 외곽의 차원에 발이 묶인 채 위협 보정이 끝없이 오르고, ${CFG.infinite.every}년마다 외곽의 괴수(더 강해진 불순물)가 나타나며, 루트 전용 히든 보스를 만날 확률이 오른다. 도중에 쓰러지면 거기까지가 기록이 된다.</p><button class="btn primary" data-a="infinite">무한 모드로 계속한다</button></div>`:''}
      ${w&&UI.trueEnd&&!G.infinite?`<div class="panel stack" style="gap:6px"><span class="eyebrow">제 2막 · 무한 모드</span><p class="small">여기서 끝내도 된다. 계속 살아가면 머리에게 외곽으로 쫓겨난 셈이 되어 위협 보정이 끝없이 오르고, ${CFG.infinite.every}년마다 외곽의 괴수(더 강해진 불순물)가 나타나며, 루트 전용 히든 보스를 만날 확률이 오른다. 도중에 쓰러지면 거기까지가 기록이 된다.</p><button class="btn primary" data-a="infinite">무한 모드로 계속한다</button></div>`:''}
      ${(()=>{const L=shTitles(c);if(L.length<1)return '';const cur=shTitle(c);return `<div class="row between" style="gap:8px;align-items:center"><span class="small dim">공유에 쓸 칭호</span><select id="shTitle" style="flex:1;max-width:60%;font:inherit;font-size:13px">${L.map(t=>`<option value="${esc(t)}"${cur===t?' selected':''}>『${esc(t)}』</option>`).join('')}<option value=""${cur===''?' selected':''}>칭호 없음</option></select></div>`})()}
      <div class="row" style="gap:8px"><button class="btn quiet" style="flex:1" data-a="share">기록 공유</button><button class="btn quiet" style="flex:1" data-a="saveimg">이미지로 저장</button></div>
      ${UI.imgUrl?`<p class="small dim">저장이 막힌 환경이다. 아래 이미지를 길게 눌러 저장한다.</p><img src="${UI.imgUrl}" alt="엔딩 기록 이미지" style="width:100%;border-radius:8px">`:''}
      ${UI.shareMsg?`<p class="small dim">${UI.shareMsg}</p>`:''}${UI.shareText?`<input id="shareBox" readonly value="${esc(UI.shareText)}" onclick="this.select()" style="width:100%;font:inherit;font-size:13px">`:''}
      ${w&&((!G.endless)||UI.outEnd||UI.oldEnd||((UI.hwEnd||UI.rbEnd)&&G.endless&&!UI.trueEnd)||(UI.trueEnd&&!G.infinite)||(UI.crowEnd==='crowrefuse'&&!G.infinite)||(INF_KEYS.includes(UI.crowEnd)&&!G.infinite))?'<button class="btn quiet" data-a="finish">여기서 끝낸다 (이 판의 저장 삭제)</button>':''}
      ${UI.confirmNew==='start'&&endCanResume()?'<p class="small bad" style="margin:0 0 6px">이 판은 여기서 끝나고, 이어서 살 수 없게 된다. 정말 다시 태어나려면 한 번 더 누른다.</p>':''}<div class="endbar"><button class="btn ${w&&!G.endless?'quiet':'primary'}" data-a="start">${UI.confirmNew==='start'&&endCanResume()?'정말 다시 태어난다':'다시 태어난다'}</button><button class="btn quiet" data-a="title">처음 화면</button></div>`;
  }
  /* 기록 링크: 기록을 주소(#r=...) 안에 담는다. 서버 없이 열린다 */
  const PAGES='https://cityyear-fanmade.github.io/city-year/';
  const b64e=o=>{const u=new TextEncoder().encode(JSON.stringify(o));let x='';u.forEach(c=>x+=String.fromCharCode(c));return btoa(x).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')};
  const b64d=t=>{const x=atob(t.replace(/-/g,'+').replace(/_/g,'/'));return JSON.parse(new TextDecoder().decode(Uint8Array.from(x,c=>c.charCodeAt(0))))};
  /* 링크 압축용 사전: 순서를 바꾸지 말고 끝에만 덧붙인다(옛 링크가 깨진다) */
  const SHFOES=["claw", "arbiter", "library", "proxy", "blue", "black", "godfather", "bigsis", "yan", "leihuang", "pianist", "freischutz", "wolf", "bigwolf", "bigbird", "knight", "araya", "ryoshu", "barber", "priest", "dulcinea", "rat_father", "sc_master", "iron_boss", "pb_boss", "ch_boss", "ob_boss", "zw_boss", "sv_boss", "liu_boss", "shi_boss", "kuro_boss", "judgebird", "redhood", "queenhate", "kinggreed", "servantwrath", "queenbee", "nothing", "orchestra", "matthias", "hongwon", "punishbird", "apocalypse", "abel", "redmist", "elena", "godmother", "twistedjun", "jeoldosa", "baral", "zena", "pil1", "pil2", "pil_hunter1", "pil_hunter2", "pil_matthias", "matthias2", "pil_trial", "jester", "rc13", "rh1", "rh2", "rh3", "rh4", "rcorp_boss", "rh5", "hr_0", "hr_1", "hr_2", "hr_3", "hr_4", "hr_5", "hw_elder", "hongru", "hw_kamo", "claw_x", "arbiter_x", "scarlet", "violet", "kasetti", "hf_1", "hf_2", "hf_3", "hf_4", "lake_whale_silence", "lake_whale_lamp", "lake_whale_anchor", "lake_whale_tide", "lake_whale_genesis", "lake_whale_pale", "lake_ricardo"];
  const SHHEADS=["오버플로우", "외곽에서 이야기를 끝냈다", "늙었다는 것은 살아남았다는 것", "발톱과 조율자를 넘어섰다", "나는 존재한다", "아무것도 없던 존재", "홍원에 군주가 태어났다", "사랑하던 이의 손에", "뒤틀렸다", "도시는 나를 기억하지 않는다", "호수는 나를 기억하지 않는다"];
  const shHeadK=h=>{const i=SHHEADS.indexOf(h);return i>=0?'#'+i:h};
  const shHeadV=h=>/^#\d+$/.test(h)?(SHHEADS[+h.slice(1)]||h):h;
  const foeEnc=ids=>{const u=new Uint8Array(Math.ceil(SHFOES.length/8)),x=[];for(const id of ids){const i=SHFOES.indexOf(id);if(i>=0)u[i>>3]|=1<<(i&7);else x.push(id)}let m=u.length;while(m>0&&!u[m-1])m--;return u8b64(u.slice(0,m))+(x.length?'~'+x.join(','):'')};
  const foeDec=t=>{const [b,x]=String(t||'').split('~'),u=b?b64u8(b):new Uint8Array(0),o=[];for(let i=0;i<SHFOES.length;i++)if(u[i>>3]&(1<<(i&7)))o.push(SHFOES[i]);return o.concat(x?x.split(','):[])};
  function shareHead(){const w=UI.endWin,dt=UI.death;return UI.overflowEnd?'오버플로우':UI.outEnd?OUTEND[UI.outEnd][0]:UI.outerEnd?'외곽에서 이야기를 끝냈다':w&&UI.oldEnd?'늙었다는 것은 살아남았다는 것':w&&UI.trueEnd?'발톱과 조율자를 넘어섰다':blankEnd(G.ch,w)==='rcorp'?'나는 존재한다':blankEnd(G.ch,w)?'아무것도 없던 존재':w?CFG.years+'년을 살아냈다':dt&&dt.hunt&&G.ch.distForm?'사랑하던 이의 손에':dt&&dt.id==='hongru'?'홍원에 군주가 태어났다':dt&&dt.cause==='distort'?'뒤틀렸다':cityN()+'는 나를 기억하지 않는다'}
  /* 링크에 담는 가족·일대기: 받는 쪽은 게임 상태가 없으니 글로 풀어 담는다 */
  const shPlain=t=>String(t).replace(/<[^>]*>/g,'').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,"'");
  function shFamily(c){
    const b=c.bond,o=[];if(!b)return o;
    if(E.bondMarried(c))o.push(`가족 · ${b.name}${c.distForm?' (당신을 알아보지 못한다)':''}`);
    else if(b.st==='lost'&&b.name)o.push(`가족 · ${b.name} (${b.dieBy==='age'?'수명을 다해 세상을 떠났다':'세상을 떠났다'}${b.dieYear?' · '+b.dieYear+'년차':''})`);
    for(const k of b.kids||[]){if(k.pend)continue;const a=Math.max(0,G.year-k.born);
      o.push(k.dead?`아이 · ${k.n} (${k.dead==='old'?'수명을 다해 세상을 떠났다':'토벌 의뢰에서 쓰러졌다'}${k.dieYear?' · '+k.dieYear+'년차':''})`:`아이 · ${k.n} ${a}세${a>=CFG.bond.kid.adult?' · '+((D.bond.kidJobs.find(j=>j.k===k.job)||{}).l||''):''}`)}
    return o;
  }
  const shLife=(c,w)=>{try{return epilogue(c,w,UI.trueEnd||!!UI.crowEnd).map(shPlain).filter(t=>!t.startsWith('그 사이 도시가 감춰')).join('\n')}catch(e){return ''}};
  /* 링크용 기록: 이름이 아니라 id를 담아 짧게 만든다(받는 쪽에서 이름으로 바꾼다) */
  function shareRec(){
    const c=G.ch,w=UI.endWin,dt=UI.death,X=CFG.endless,gi=E.gradeAt(G.year),lived=w?G.year:Math.max(0,G.year-1);
    return {v:2,h:shareHead(),w:w?1:0,n:c.name||'',k:careerLine0(c).replace(/<[^>]*>/g,'').replace(/&amp;/g,'&'),xt:(c.titles||[]).slice(),t:shTitle(c),col:c.color,y:lived,a:E.age(G),
      g:G.endless&&gi>=0?X.grades[gi]:'',d:!w&&dt?`${dt.year}년차 · ${dt.cause?dt.foe:dt.foe+'에게 쓰러짐'}`:'',fi:[...new Set([...c.beaten,...(c.minis||[])])],
      e:c.ego?c.ego.n:'',i:innateName(c)||'',o:`${(pl=>pl?pl.n+' · ':'')(placeOf(c.o,c.r,c.blank))}${c.o.n} · ${c.t.n} · ${c.f.n}`,lv:c.lv,st:[c.stats.atk,c.stats.eva,c.stats.spd],s:c.seed,dy:c.daily||'',df:diffOf(c),ver:UPDATES.v,fm:shFamily(c),lf:shLife(c,w)};
  }
  const shBase=()=>/^https?:/.test(location.href)&&!/claude\.ai|claudeusercontent/.test(location.href)?location.origin+location.pathname:PAGES;
  const u8b64=u=>{let x='';u.forEach(c=>x+=String.fromCharCode(c));return btoa(x).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')};
  const b64u8=t=>Uint8Array.from(atob(t.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
  const canZip=typeof CompressionStream==='function'&&typeof DecompressionStream==='function';
  const zipB=async(u,Cls,fmt)=>{const st=new Cls(fmt),wr=st.writable.getWriter();wr.write(u);wr.close();return new Uint8Array(await new Response(st.readable).arrayBuffer())};
  /* 배열로 줄여 담는다(키 이름 생략). 순서를 바꾸지 말고 끝에만 덧붙인다 */
  const shArr=o=>[3,shHeadK(o.h),o.w,o.n,o.k,o.t,String(o.col||'').replace(/^#/,''),o.y,o.a,o.g,o.d,foeEnc(o.fi),o.e,o.i,o.o,o.lv,o.st.join(','),o.s,o.dy,o.df,o.ver,(o.fm||[]).join('|'),o.lf||'',(o.xt||[]).join('|')];
  const shObj=a=>({v:a[0],h:a[0]>=3?shHeadV(a[1]):a[1],w:a[2],n:a[3],k:a[4],t:a[5],col:/^[0-9a-f]{3,8}$/i.test(a[6])?'#'+a[6]:a[6],y:a[7],a:a[8],g:a[9],d:a[10],
    f:(a[0]>=3?foeDec(a[11]):String(a[11]||'').split(',').filter(Boolean)).map(id=>(D.enemies[id]&&D.enemies[id].n)||id),e:a[12],i:a[13],o:a[14],lv:a[15],st:String(a[16]||'0,0,0').split(',').map(Number),s:a[17],dy:a[18],df:a[19],ver:a[20],fm:a[21]?String(a[21]).split('|'):[],lf:a[22]||'',xt:a[23]?String(a[23]).split('|'):[]});
  /* 기록 링크: #c= 압축(deflate) 배열, #a= 압축 없는 배열(압축을 못 쓰는 브라우저), #r= 예전 형식(그대로 읽는다) */
  async function shareLinkAsync(){
    const j=new TextEncoder().encode(JSON.stringify(shArr(shareRec()))),a='#a='+u8b64(j);
    if(canZip){try{const c='#c='+u8b64(await zipB(j,CompressionStream,'deflate-raw'));return shBase()+(c.length<a.length?c:a)}catch(e){}}
    return shBase()+a;
  }
  async function readShared(h){
    const m=/#([rac])=([\w-]+)/.exec(h||'');if(!m)return null;
    if(m[1]==='r')return b64d(m[2]);
    let u=b64u8(m[2]);if(m[1]==='c')u=await zipB(u,DecompressionStream,'deflate-raw');
    return shObj(JSON.parse(new TextDecoder().decode(u)));
  }
  /* 끝 화면에서 미리 만들어 둔다: 복사 버튼을 누를 때 기다리지 않게(일부 브라우저는 클릭 직후에만 복사를 허용한다) */
  function prepShare(){const k=JSON.stringify(shareRec());if(UI.shK===k)return;UI.shK=k;UI.shU=null;shareLinkAsync().then(u=>{if(UI.shK===k)UI.shU=u}).catch(()=>{})}
  /* 예전 형식 링크(#r=): 시험용으로만 남긴다 */
  function shareLink(){const o=shareRec();o.v=1;o.f=o.fi.map(id=>D.enemies[id].n);delete o.fi;return shBase()+'#r='+b64e(o)}
  function vShared(){
    const r=UI.shared;
    const row=(k,v)=>v?`<div class="row between"><span class="dim">${k}</span><b class="mono" style="text-align:right">${esc(String(v))}</b></div>`:'';
    return `<div class="stack" style="gap:8px;padding-top:12px"><div class="eyebrow">공유된 기록 · ${esc(r.ver||'')}</div>
      <div class="eyebrow" style="color:${r.w?'var(--gold)':'#c46a5a'}">${esc(r.h)} · ${r.a}세</div>
      <h1 style="color:${esc(r.col||'')};${String(r.n||r.k).length>14?'font-size:clamp(20px,5.6vw,30px);line-height:1.3;word-break:keep-all':''}">${esc(r.n||r.k)}</h1>${r.n?`<div class="mono small" style="color:${esc(r.col||'')}">${esc(r.k)}</div>`:''}
      ${r.t||(r.xt&&r.xt.length)?`<div class="row" style="gap:6px;flex-wrap:wrap">${r.t?`<span class="chip" style="color:var(--gold);border-color:var(--gold)">${esc(r.t)}</span>`:''}${(r.xt||[]).filter(x=>x!==r.t).map(x=>`<span class="chip" style="color:var(--gold);border-color:var(--gold)">${esc(x)}</span>`).join('')}</div>`:''}</div>
      <div class="panel stack" style="gap:6px">${row('산 햇수',r.y+'년')}${row('위협 등급',r.g)}${row('마지막',r.d)}${row('타고난 것',r.i)}${row('E.G.O',r.e)}
        ${row('레벨',`Lv ${r.lv} · 공격 ${sg(r.st[0])} · 회피 ${sg(r.st[1])} · 속도 ${sg(r.st[2])}`)}${row('출신',r.o)}${row('난이도',r.df)}${row('시드',r.s+(r.dy?' · 오늘의 시드 '+r.dy:''))}
        ${r.f&&r.f.length?`<div class="small"><span class="dim">쓰러뜨린 이름난 상대</span><br><b>${r.f.map(esc).join(' · ')}</b></div>`:''}</div>
      ${r.fm&&r.fm.length?`<div class="row" style="gap:6px;flex-wrap:wrap">${r.fm.map(t=>`<span class="chip">${esc(t)}</span>`).join('')}</div>`:''}
      ${r.lf?`<div class="panel stack" style="gap:8px"><span class="eyebrow">어떤 삶을 살았나</span>${String(r.lf).split('\n').map(t=>`<p class="small" style="line-height:1.65">${esc(t)}</p>`).join('')}</div>`:''}
      <button class="btn primary" data-a="sharedSeed"><b>같은 시드로 태어나기</b><span class="small">시드 ${r.s}</span></button>
      <button class="btn quiet" data-a="title">처음 화면</button>`;
  }
  /* 공유용 기록 글 */
  function shareText(){
    const c=G.ch,w=UI.endWin,dt=UI.death,X=CFG.endless,gi=E.gradeAt(G.year),lived=w?G.year:Math.max(0,G.year-1);
    const head=UI.overflowEnd?'오버플로우':UI.outEnd?OUTEND[UI.outEnd][0]:UI.outerEnd?'외곽에서 이야기를 끝냈다':w&&UI.oldEnd?'늙었다는 것은 살아남았다는 것':w&&UI.trueEnd?'발톱과 조율자를 넘어섰다':blankEnd(G.ch,w)==='rcorp'?'나는 존재한다':blankEnd(G.ch,w)?'아무것도 없던 존재':w?CFG.years+'년을 살아냈다':dt&&dt.hunt&&G.ch.distForm?'나는 사랑하던 이의 손에 쓰러졌다':dt&&dt.id==='hongru'?'홍원에 군주가 태어났다':dt&&dt.cause==='distort'?'나는 뒤틀렸다':cityN()+'는 나를 기억하지 않는다';
    const foes=[...c.beaten,...(c.minis||[])].map(id=>D.enemies[id].n);
    const url=/^https?:/.test(location.href)&&!/claude\.ai|claudeusercontent/.test(location.href)?location.href.split('#')[0]:'https://cityyear-fanmade.github.io/city-year/';
    return [`[도시의 한 해] ${head}`,(c.name?`${c.name} · `:'')+careerLine(c).replace(/<[^>]*>/g,'')+(shTitle(c)?` · ${shTitle(c)}`:''),
      `${lived}년 · ${E.age(G)}세`+(G.endless&&gi>=0?` · 위협 등급 ${X.grades[gi]}`:''),
      !w&&dt?`${dt.year}년차 · ${dt.cause?dt.foe:dt.foe+'에게 쓰러짐'}`:null,c.ego?`E.G.O · ${c.ego.n}`:null,c.innate?`타고난 것 · ${innateName(c)}`:null,foes.length?`쓰러뜨린 상대 · ${foes.join(', ')}`:null,
      `${(pl=>pl?pl.n+' · ':'')(placeOf(c.o,c.r,c.blank))}${c.o.n} · ${c.t.n} · ${c.f.n} · Lv ${c.lv}`,`난이도 · ${diffOf(c)}`,`시드 ${c.seed}`+(c.daily?` · 오늘의 시드 ${c.daily}`:''),...shFamily(c).slice(0,1),url].filter(Boolean).join('\n');
  }
  /* 엔딩 화면 그대로 찍기: 저장 버튼을 누를 때만 html2canvas를 불러온다. 실패하면 null (카드 이미지로 대신) */
  const SHOTSRC=['https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js','https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js'];
  function loadShot(){
    if(window.html2canvas)return Promise.resolve(true);
    /* 파일에 넣어 둔 html2canvas가 있으면 인터넷 없이 바로 쓴다 */
    if(window.CITY_H2C){try{(0,eval)(window.CITY_H2C);if(window.html2canvas)return Promise.resolve(true)}catch(e){}}
    /* 한 곳에서 못 받으면 다른 곳에서 한 번 더 받는다 (휴대폰 앱 브라우저·학교·회사 망에서 막히는 경우) */
    const get=src=>new Promise(res=>{const sc=document.createElement('script');sc.src=src;let done=false;const fin=v=>{if(!done){done=true;res(v)}};
      sc.onload=()=>fin(!!window.html2canvas);sc.onerror=()=>fin(false);document.head.appendChild(sc);setTimeout(()=>fin(!!window.html2canvas),8000)});
    return get(SHOTSRC[0]).then(ok=>ok||get(SHOTSRC[1]));
  }
  /* 엔딩 화면 그대로 찍기. 실패하면 null이고 UI.shotWhy에 이유('load' 도구를 못 불러옴 · 'draw' 그림을 못 만듦)가 남는다.
     휴대폰은 캔버스 크기 제한이 작아 긴 화면은 해상도를 낮춰 다시 시도한다 */
  /* html2canvas 1.4.1은 color-mix()가 계산된 'color(srgb …)' 색을 읽지 못해 통째로 실패한다. 복제본의 그런 색을 rgb로 바꿔 둔다 */
  function fixShotColors(d,root){
    try{const cv=d.createElement('canvas');cv.width=cv.height=1;const g=cv.getContext('2d',{willReadFrequently:true});
      const rgb=m=>{try{g.clearRect(0,0,1,1);g.fillStyle='#000';g.fillStyle=m;g.fillRect(0,0,1,1);const p=g.getImageData(0,0,1,1).data;return `rgba(${p[0]},${p[1]},${p[2]},${(p[3]/255).toFixed(3)})`}catch(e){return 'rgba(0,0,0,0)'}};
      const props=['color','background-color','background-image','border-top-color','border-right-color','border-bottom-color','border-left-color','outline-color','text-decoration-color','box-shadow','text-shadow','fill','stroke'];
      const win=d.defaultView||window,els=[root,...root.querySelectorAll('*')];
      for(const el of els){const cs=win.getComputedStyle(el);for(const pr of props){const v=cs.getPropertyValue(pr);if(v&&/color\(|color-mix\(/.test(v))el.style.setProperty(pr,v.replace(/color\((?:[^()]|\([^()]*\))*\)/g,rgb),'important')}}
    }catch(e){}
  }
  async function shotEnd(id){
    id=id||'endShot';UI.shotWhy='';const el=$(id);if(!el){UI.shotWhy='draw';return null}
    if(!(await loadShot())){UI.shotWhy='load';return null}
    try{await document.fonts.ready}catch(e){}
    const bg=getComputedStyle(document.body).backgroundColor||'#0d0d0f',r=el.getBoundingClientRect(),w=Math.max(1,r.width),h=Math.max(1,r.height);
    /* 한 변 최대 8000px · 전체 1400만 화소 안에서 가장 큰 배율부터 */
    const fit=Math.min(2,8000/h,Math.sqrt(14e6/(w*h))),tries=[fit,Math.min(fit,1),Math.min(fit,0.7),Math.min(fit,0.5)].filter((s,k,a)=>s>=0.3&&a.indexOf(s)===k);
    for(const sc of tries){
      try{const cv=await window.html2canvas(el,{backgroundColor:bg,scale:sc,useCORS:true,logging:false,windowWidth:Math.min(900,window.innerWidth),onclone:d=>{const e=d.getElementById(id);if(e){fixShotColors(d,e);e.style.padding='28px 22px';e.style.background=bg}}});
        if(cv&&cv.width>0&&cv.height>0)return cv}catch(e){}
    }
    UI.shotWhy='draw';return null;
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
    const head=UI.overflowEnd?'오버플로우':UI.outEnd?OUTEND[UI.outEnd][0]:UI.outerEnd?'외곽에서 이야기를 끝냈다':w&&UI.oldEnd?'늙었다는 것은 살아남았다는 것':w&&UI.trueEnd?'발톱과 조율자를 넘어섰다':blankEnd(G.ch,w)==='rcorp'?'나는 존재한다':blankEnd(G.ch,w)?'아무것도 없던 존재':w?CFG.years+'년을 살아냈다':dt&&dt.hunt&&G.ch.distForm?'당신은 사랑하던 이의 손에 쓰러졌다':dt&&dt.cause==='distort'?'당신은 뒤틀렸다':cityN()+'는 당신을 기억하지 않는다';
    T_('도시의 한 해',W/2,140,`500 34px ${mono}`,gold,'center');
    T_(head,W/2,200,`600 36px ${serif}`,w?gold:'#c46a5a','center');
    const nm=c.name||careerLine(c).replace(/<[^>]*>/g,'').replace(/&amp;/g,'&');
    g.font=fit(nm,W-200,96,serif,'900');g.fillStyle=col;g.textAlign='center';
    let y=400;
    if(g.measureText(nm).width>W-200){const nf=`900 44px ${serif}`,ls=wrapW(nm,W-200,nf);g.font=nf;g.fillStyle=col;g.textAlign='center';ls.forEach((l,i)=>g.fillText(l,W/2,330+i*58));y+=(ls.length-1)*58}
    else g.fillText(nm,W/2,330);
    if(c.name){const cl=careerLine(c).replace(/<[^>]*>/g,''),cf=`500 34px ${sans}`,ls=wrapW(cl,W-200,cf);g.font=cf;g.fillStyle=col;g.textAlign='center';for(const l of ls){g.fillText(l,W/2,y);y+=46}y+=10}
    if(shTitle(c)){T_('『'+shTitle(c)+'』',W/2,y,`700 40px ${serif}`,gold,'center');y+=60}
    g.strokeStyle='#2c2b30';g.beginPath();g.moveTo(140,y);g.lineTo(W-140,y);g.stroke();y+=70;
    /* 행적: 에필로그에서 출신 · 진로 · 마지막 문장만 뽑아 넣는다 */
    if(w){const plain=t=>t.replace(/<[^>]*>/g,'').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,"'");
      const ep=epilogue(c,w,UI.trueEnd||!!UI.crowEnd).map(plain),pick=[ep[0],ep[1],ep[ep.length-1]].filter((t,i,a)=>t&&a.indexOf(t)===i);
      const wrap=(t,mx,f)=>{g.font=f;const out=[];let line='';for(const word of t.split(' ')){const tt=line?line+' '+word:word;if(g.measureText(tt).width>mx&&line){out.push(line);line=word}else line=tt}if(line)out.push(line);return out};
      T_('행적',140,y,`400 28px ${sans}`,gold);y+=52;
      for(const t of pick){for(const l of wrap(t,W-280,`400 30px ${sans}`).slice(0,4)){T_(l,140,y,`400 30px ${sans}`,ink);y+=46}y+=14}
      y+=6;g.strokeStyle='#2c2b30';g.beginPath();g.moveTo(140,y);g.lineTo(W-140,y);g.stroke();y+=60}
    const rows=[['난이도',diffOf(c)],['산 햇수',`${lived}년 · ${E.age(G)}세`]];
    if(c.aff||c.job)rows.push(['소속',c.job?T.jobs[c.job]:(c.corp&&c.corp.wing?c.corp.wing+' · 대표':`${affName(c)}${c.fr?' · '+frName(c):''}`)]);
    if(c.licensed&&!c.job)rows.push(['해결사',`${c.rank}${T.rankUnit}${c.title?' · '+c.title:''}`]);
    if((c.titles||[]).length)rows.push(['칭호',c.titles.join(' · ')]);
    if(E.bondMarried(c)){const k=(c.bond.kids||[]).map(x=>`${x.n} ${Math.max(0,G.year-x.born)}세`);rows.push(['가족',`${c.bond.name}${k.length?' · 아이 '+k.join(', '):''}`])}
    if(G.endless)rows.push(['위협 등급',gi>=0?X.grades[gi]:'—']);
    if(!w&&dt)rows.push(['마지막',`${dt.year}년차 · ${dt.foe}`]);
    if(c.innate)rows.push(['타고난 것',innateName(c)]);
    if(c.ego)rows.push(['E.G.O',`${c.ego.n} · ${CFG.mind.ego[c.ego.type].n}`]);
    rows.push(['정신력',c.distForm?'???':`${c.mind}/${E.mindMax(c)}`]);
    if(c.rs&&(c.rs.dealt||c.rs.taken)){const n_=v=>(v||0).toLocaleString('ko-KR');rows.push(['입힌 피해',n_(c.rs.dealt)],['받은 피해',n_(c.rs.taken)],['총 회복량',n_(c.rs.heal)],['건 디버프 · 얻은 버프',`${n_(c.rs.debuff)} · ${n_(c.rs.buff)}`]);if(c.rs.debuffTaken)rows.push(['받은 디버프',n_(c.rs.debuffTaken)])}
    rows.push(['레벨',`Lv ${c.lv} · 공격 ${sg(c.stats.atk)} · 회피 ${sg(c.stats.eva)} · 속도 ${sg(c.stats.spd)}`]);
    rows.push(['출신',`${(pl=>pl?pl.n+' · ':'')(placeOf(c.o,c.r,c.blank))}${c.o.n} · ${c.t.n}`]);
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
      <p class="small dim">${line}</p></div>
    <div class="panel stack" style="gap:6px"><span class="eyebrow">전투 기록</span>${(()=>{const n_=v=>(v||0).toLocaleString('ko-KR'),R=c.rs||{},rw=(l,v)=>`<div class="row between"><span>${l}</span><b class="mono">${v}</b></div>`;return rw('입힌 피해',n_(R.dealt))+rw('받은 피해',n_(R.taken))+rw('총 회복량',n_(R.heal))+rw('건 디버프',n_(R.debuff))+rw('얻은 버프',n_(R.buff))+rw('받은 디버프',n_(R.debuffTaken))})()}</div>`;
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
  /* ===== 타격 모션 시험실 (dist/motion-lab.html 빌드에서만 켜진다) ===== */
  const LABW=[['칼 (베기)',{n:'식칼'}],['대검 (X자)',{n:'대검'}],['창 (찌르기)',{n:'창'}],['낫 (할퀴기)',{n:'낫'}],['망치 (충격 고리)',{n:'망치'}],['무기 없음 (키워드로 결정)',null]];
  const LABS=[['하얀 발톱',{n:'하얀 발톱',id:'job_claw'}],['미미크리',{n:'미미크리',id:'w_mimicry'}],['다 카포',{n:'다 카포',id:'w_dacapo'}],['궁니르',{n:'궁니르',id:'gungnir'}],['절대음감',{n:'절대음감',id:'w_perfectpitch'}],['레바테인 · 봉인',{n:'레바테인',id:'laev_sealed'}],['레바테인 · 1단계',{n:'레바테인',id:'laev_s1'}],['레바테인 · 2단계',{n:'레바테인',id:'laev_s2'}],['레바테인 · 해방',{n:'레바테인',id:'laev'}],...[1,2,3,4,5,6,7,8,9].map(k=>['검은 침묵의 장갑 '+k,{n:'검은 침묵의 장갑',id:'w_blacksilence',note:'장갑 1d9 '+k}])];
  const LABN=[['발톱 (하얀 발톱 · 바랄)',{n:'하얀 발톱',fxv:'n_claw'}],['조율자 · 봉인의 요정 (황금)',{n:'봉인의 요정',fxv:'n_fairy_g'}],['조율자 · 제나의 요정 (검은빛)',{n:'제나의 요정',fxv:'n_fairy_b'}],['붉은 안개 · 미미크리 프로토타입',{n:'미미크리 (프로토타입)',fxv:'n_mist'}],['보라눈물 · 참격 (한 번 크게 벰)',{n:'보랏빛 사복검',fxv:'n_vi_slash'}],['보라눈물 · 관통 (한 점 찌르기)',{n:'보랏빛 사복검',fxv:'n_vi_pierce'}],['보라눈물 · 타격 (뱀처럼 여러 갈래)',{n:'보랏빛 사복검',fxv:'n_vi_snake'}],['보라눈물 · 방어 (방벽)',{n:'보랏빛 사복검',fxv:'n_vi_guard'}],['레바테인 · 봉인 (선 위주)',{n:'레바테인',id:'laev_sealed',fxv:'n_lev0'}],['레바테인 · 1단계',{n:'레바테인',id:'laev_s1',fxv:'n_lev1'}],['레바테인 · 2단계',{n:'레바테인',id:'laev_s2',fxv:'n_lev2'}],['레바테인 · 해방 완료 (푸른 화염)',{n:'레바테인',id:'laev',fxv:'n_lev3'}],['공방 무기 · 흡수 0개 (금속 불꽃)',{n:'작업대의 칼날',id:'ws_weapon',fxv:'n_ws0'}],['공방 무기 · 흡수 1~3개 (1개째 변화)',{n:'작업대의 칼날',id:'ws_weapon',fxv:'n_ws1'}],['공방 무기 · 흡수 4~6개 (검기)',{n:'작업대의 칼날',id:'ws_weapon',fxv:'n_ws2'}],['공방 무기 · 흡수 7~9개',{n:'작업대의 칼날',id:'ws_weapon',fxv:'n_ws3'}],['공방 무기 · 흡수 10개 (완전 변환)',{n:'작업대의 칼날',id:'ws_weapon',fxv:'n_ws4'}],['환도 (전용 · 룬)',{n:'환도',fxv:'n_rune'}],['서가의 책갈피 / 금서',{n:'서가의 책갈피',fxv:'n_book'}],['절대음감',{n:'절대음감',fxv:'n_pitch'}],['황혼',{n:'황혼',fxv:'n_twilight'}],['천퇴성도 (뇌횡 · 붉은 노란 검기)',{n:'천퇴성도',fxv:'n_geom1'}],['동부십검 (엄지 검술 · 같은 검기, 조금 작게)',{n:'동부십검',fxv:'n_geom2'}],['W사 무기 · 1등급 (가늘게)',{n:'차원 도 · 균열',fxv:'n_warp1'}],['W사 무기 · 2등급',{n:'차원 도 · 절단',fxv:'n_warp2'}],['W사 무기 · 3등급',{n:'차원 도 · 공간',fxv:'n_warp3'}],['W사 무기 · 4등급',{n:'차원 도 · 단절',fxv:'n_warp4'}],['W사 무기 · 5등급 (기존 크기)',{n:'차원 도 · 종단',fxv:'n_warp5'}],['검지 · 지령 집행도 (파란 꽃잎 5장)',{n:'지령 집행도',fxv:'n_finger'}],['중지 · 중지 사슬 (타격 + 보라 오라)',{n:'중지 사슬',fxv:'n_chain'}],['쌍수대도',{n:'쌍수대도',fxv:'n_ssang'}],['대부의 권총',{n:'대부의 권총',fxv:'n_gun'}],['쪽빛 노인의 작살 (이전 설계: 굵은 관통선 + 물보라)',{n:'쪽빛 노인의 작살',fxv:'n_harp'}],['궁니르 (노랑 · 연속 찌르기 · 룬)',{n:'궁니르',id:'gungnir',fxv:'n_gung2'}],['쪽빛 노인의 작살 (기존 궁니르 이펙트: 흰 빔 + 푸른 고리)',{n:'쪽빛 노인의 작살',fxv:'n_gung'}],['앙갚음의 칼 (중지의 큰누님)',{n:'앙갚음의 칼',fxv:'n_grudge'}],['왜곡된 지휘봉 (뒤틀린 얀)',{n:'왜곡된 지휘봉',fxv:'n_baton'}],['아라야시키 (신체파 료슈)',{n:'아라야시키',fxv:'n_araya'}],['돌네시아의 붉은 창',{n:'돌네시아의 붉은 창',fxv:'n_lance'}],['달궈진 십자가 (주홍십자)',{n:'달궈진 십자가',fxv:'n_cross'}],['채혈침 (혈귀 카세티)',{n:'채혈침',fxv:'n_needle'}],['검은 침묵 · Furioso (9종 연타 + 세로 베기)',{n:'검은 침묵의 장갑',id:'w_blacksilence',fxv:'n_bsF'}],['검은 침묵 · 무작위 1~9',{n:'검은 침묵의 장갑',id:'w_blacksilence',fxv:'n_bs0'}],['검은 침묵 · 1 느티나무 도끼',{n:'검은 침묵의 장갑',id:'w_blacksilence',fxv:'n_bs1'}],['검은 침묵 · 2 묵 장검',{n:'검은 침묵의 장갑',id:'w_blacksilence',fxv:'n_bs2'}],['검은 침묵 · 3 뒤랑달',{n:'검은 침묵의 장갑',id:'w_blacksilence',fxv:'n_bs3'}],['검은 침묵 · 4 크리스탈 쌍검',{n:'검은 침묵의 장갑',id:'w_blacksilence',fxv:'n_bs4'}],['검은 침묵 · 5 랑아 단검',{n:'검은 침묵의 장갑',id:'w_blacksilence',fxv:'n_bs5'}],['검은 침묵 · 6 로직 샷건',{n:'검은 침묵의 장갑',id:'w_blacksilence',fxv:'n_bs6'}],['검은 침묵 · 7 알라스 랜스',{n:'검은 침묵의 장갑',id:'w_blacksilence',fxv:'n_bs7'}],['검은 침묵 · 8 휠스 대검',{n:'검은 침묵의 장갑',id:'w_blacksilence',fxv:'n_bs8'}],['검은 침묵 · 9 올드보이 해머',{n:'검은 침묵의 장갑',id:'w_blacksilence',fxv:'n_bs9'}],['부리 (징벌 새 E.G.O)',{n:'부리',id:'ego_beak',fxv:'n_beak'}],['붉은 눈 (거미봉오리 E.G.O · 눈 대신 거미줄)',{n:'붉은 눈',id:'ego_redeyes',fxv:'n_redeye'}],['우주의 조각 (E.G.O)',{n:'우주의 조각',id:'ego_universe',fxv:'n_cosmos'}],['후회 (버려진 살인마 E.G.O)',{n:'후회',id:'ego_regret',fxv:'n_regret'}],['다 카포 · 침묵의 오케스트라',{n:'다 카포',fxv:'n_dacapo'}]];
  const LAB={att:'P',lv:'mid',kw:'',crit:false,big:false,hits:1,last:false,chips:false};
  function labPlay(w){
    const sv={C,HFX,MODE,SKIP,HFXM};HFX=LAB.lv;MODE='slow';SKIP=false;HFXM=LAB.last?'last':'each';
    const def=LAB.att==='P'?'E':'P',n=LAB.hits;
    C={id:'lab',P:{maxHp:100},E:{maxHp:100},ch:{gear:{weapon:LAB.att==='P'&&w&&w.n?{n:w.n,id:w.id||''}:null}}};
    for(let i=0;i<n;i++)setTimeout(()=>{PREV[def]={};const snap={};snap[def]=LAB.kw?{[LAB.kw]:3}:{};
      hitFx({def,att:LAB.att,snap,fxv:w&&w.fxv,note:(LAB.crit?'치명 ':'')+((w&&w.note)||''),dmg:LAB.big||LAB.crit?30:6,card:{hits:n},_g:{i,n}})},i*230);
    setTimeout(()=>{C=sv.C;HFX=sv.HFX;MODE=sv.MODE;SKIP=sv.SKIP;HFXM=sv.HFXM},n*230+900);
  }
  function labDraw(){
    const EXP=window.CITY_EXPIRES;
    if(EXP&&Date.now()>EXP){app.innerHTML='<div class="stack" style="gap:10px;padding:40px 20px;text-align:center"><b class="serif" style="font-size:1.3em">시험 기간이 끝났습니다</b><span class="small dim">이 타격 모션 시험실은 정해진 시간까지만 열려 있습니다.</span></div>';return}
    if(EXP&&!app._labTimer){app._labTimer=setInterval(()=>{if(Date.now()>EXP){clearInterval(app._labTimer);labDraw()}},15000)}
    const chip=(on,a,t)=>`<button class="btn quiet" style="width:auto;flex:none;padding:6px 12px${on?';background:var(--gold);color:#111;border-color:var(--gold);font-weight:700':''}" data-lab="${a}">${t}</button>`;
    const box=(side,nm,col)=>`<div class="panel stack ent" id="ent-${side}" style="min-height:110px;background:color-mix(in srgb,${col} 9%,var(--panel));border-color:color-mix(in srgb,${col} 45%,var(--line))"><div class="row between"><b class="serif">${nm}</b><span class="mono small dim">HP 100/100</span></div><div class="small dim">타격 효과는 이 상자 가운데에 나옵니다</div>${LAB.chips?'<div class="chips" id="chips-'+side+'">'+['출혈 3','화상 2','파열 5','충전 4','호흡 3','침잠 1'].map(t=>'<span class="chip">'+t+'</span>').join('')+'</div>':''}</div>`;
    app.innerHTML=`<div class="stack" style="gap:10px;padding:14px;max-width:760px;margin:0 auto"><div class="eyebrow">타격 모션 시험실 · 게임에 들어 있는 실제 코드로 그립니다${window.CITY_EXPIRES?' · '+new Date(window.CITY_EXPIRES).toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit',timeZone:'Asia/Seoul'})+'까지':''}</div>
      <div class="row" style="gap:8px;align-items:stretch;position:sticky;top:0;z-index:30;background:var(--bg);padding:8px 0;border-bottom:1px solid var(--line)">${box('E','적','#c25050')}${box('P','나','#5a8ac2')}</div>
      <div class="row" style="gap:6px;flex-wrap:wrap"><span class="small dim">공격자</span>${chip(LAB.att==='P','att:P','나 → 적')}${chip(LAB.att==='E','att:E','적 → 나')}</div>
      <div class="row" style="gap:6px;flex-wrap:wrap"><span class="small dim">강도</span>${chip(LAB.lv==='low','lv:low','가볍게')}${chip(LAB.lv==='mid','lv:mid','보통')}${chip(LAB.lv==='high','lv:high','강하게')}</div>
      <div class="row" style="gap:6px;flex-wrap:wrap"><span class="small dim">키워드 색</span>${chip(!LAB.kw,'kw:','없음')}${chip(LAB.kw==='bleed','kw:bleed','출혈')}${chip(LAB.kw==='burn','kw:burn','화상')}${chip(LAB.kw==='rupture','kw:rupture','파열')}</div>
      <div class="row" style="gap:6px;flex-wrap:wrap"><span class="small dim">옵션</span>${chip(LAB.crit,'crit','치명타')}${chip(LAB.big,'big','큰 피해')}${[1,2,3,4].map(k=>chip(LAB.hits===k,'hits:'+k,k+'연타')).join('')}${chip(LAB.last,'last','마지막만 크게')}${chip(LAB.chips,'chips','디버프 칩 많음(상자가 커짐)')}</div>
      <div class="small dim">무기를 누르면 그 무기로 때리는 모션이 나옵니다. 연타는 한 번에 여러 번 이어서 나옵니다.</div>
      <div class="row" style="gap:6px;flex-wrap:wrap">${LABW.map(([t],i)=>`<button class="btn" style="width:auto;flex:none;padding:8px 14px" data-w="w${i}">${t}</button>`).join('')}</div>
      <div class="small" style="color:var(--gold)">신규 설계안 (히든 무기 전용 시안 · 80 · 170 · 280ms 기획대로)</div>
      <div class="row" style="gap:6px;flex-wrap:wrap">${LABN.map(([t],i)=>`<button class="btn" style="width:auto;flex:none;padding:8px 14px;border-color:var(--gold)" data-w="n${i}">${t}</button>`).join('')}</div>
      <div class="small dim">전용 모션이 있는 무기</div>
      <div class="row" style="gap:6px;flex-wrap:wrap">${LABS.map(([t],i)=>`<button class="btn" style="width:auto;flex:none;padding:8px 14px" data-w="s${i}">${t}</button>`).join('')}</div></div>`;
    if(!app._lab){app._lab=true;app.addEventListener('click',ev=>{
      const b=ev.target.closest('[data-w]');if(b){const k=b.dataset.w;labPlay(k[0]==='w'?LABW[+k.slice(1)][1]:k[0]==='n'?LABN[+k.slice(1)][1]:LABS[+k.slice(1)][1]);return}
      const c=ev.target.closest('[data-lab]');if(!c)return;const [a,v]=c.dataset.lab.split(':');
      if(a==='att')LAB.att=v;else if(a==='lv')LAB.lv=v;else if(a==='kw')LAB.kw=v;else if(a==='hits')LAB.hits=+v;else if(a==='crit')LAB.crit=!LAB.crit;else if(a==='big')LAB.big=!LAB.big;else if(a==='last')LAB.last=!LAB.last;else if(a==='chips')LAB.chips=!LAB.chips;
      labDraw()})}
  }
  /* 의수 의뢰 체험(--augdemo 빌드): 특색을 얻은 지 한 해 뒤에 오는 "커스텀 공방제 의수 의뢰"를 게임 없이 미리 만져 본다 */
  const AD={name:'',atk:0,eva:0,hp:0,pas:null,done:false,org:'하나 협회'};
  const ADORG=[['하나 협회','협회'],['K사 날개','날개'],['N사 날개','N'],['엄지','손가락'],['윤 사무소','사무소'],['공방 해결사','공방'],['소속 없음','없음']];
  const adIntro=o=>({협회:`${AD.org} 직속 공방에서 특색 기념으로 전용 의수를 만들어 준다고 한다.`,날개:`${AD.org} 직속 개발실에서 특색 기념으로 전용 의수를 만들어 준다고 한다.`,N:'N사는 의체를 쓰지 않는다. 대신 연구소에서 특색 기념으로 전용 신체 개조를 설계해 준다고 한다.',손가락:`${AD.org}이 쓰는 공방에서 특색 기념으로 전용 의수를 만들어 준다고 한다.`,사무소:`${AD.org} 단골 공방에서 특색 기념으로 전용 의수를 만들어 준다고 한다.`,공방:'공방 동료들이 특색 기념으로 전용 의안을 만들어 준다고 한다.',없음:'협회가 이름도 알려 주지 않고 공방 하나를 안내해 주었다. 특색 기념으로 전용 의수를 만들어 준다고 한다.'})[o];
  function augDemoDraw(){
    const K=CFG.ws.cust,used=AD.atk*K.atkCost+AD.eva*K.evaCost+AD.hp*K.hpCost+(AD.pas?K.passCost:0),left=K.pts-used;
    const stp=(k,l,cost,unit)=>`<div class="row between" style="gap:6px"><span class="small"><b>${l}</b> +${AD[k]*unit} <span class="dim">(${cost}포인트당 +${unit})</span></span><span class="row" style="gap:6px"><button class="chip" data-ad="d:${k}:-1" ${AD[k]<=0?'disabled':''}>−</button><button class="chip" data-ad="d:${k}:1" ${left<cost?'disabled':''}>＋</button></span></div>`;
    const orgK=(ADORG.find(x=>x[0]===AD.org)||ADORG[0])[1],noun=orgK==='N'?'신체 개조':orgK==='공방'?'의안':'의수',nm=(AD.name||'').trim()||'이름 없는 '+noun,pv=[AD.atk?`공격 +${AD.atk*K.atkPer}`:'',AD.eva?`회피 +${AD.eva}`:'',AD.hp?`최대 HP +${AD.hp*K.hpPer}`:'',AD.pas?`패시브 · ${K.pass[AD.pas].n} (${K.pass[AD.pas].e})`:''].filter(Boolean);
    if(AD.done){app.innerHTML=`<div class="stack" style="gap:12px;padding:16px;max-width:560px;margin:0 auto"><div class="eyebrow">특색 기념 · 설계 완료</div><h2>${esc(nm)}</h2>
      <div class="panel stack" style="gap:6px;border-color:var(--gold)"><span class="small">${orgK==='N'?'연구원이 설계서를 접어 넣으며 말한다. "수술 일정은 내일입니다. 몸이 먼저 기억할 겁니다."':orgK==='공방'?'공방 동료들이 작업대에 모여 도면을 들여다본다. "눈 크기부터 똑같이 맞춰야지."':'공방 사람이 도면을 접어 넣으며 말한다. "이만하면 사흘이면 됩니다."'}</span>${pv.length?pv.map(t=>`<div class="mono small" style="color:var(--gold)">${esc(t)}</div>`).join(''):'<div class="small dim">주문서에 적힌 것이 없다.</div>'}<div class="small dim">쓴 포인트 ${used}/${K.pts}</div></div>
      <p class="small dim">${orgK==='N'?'실제 게임에서는 이 개조가 몸에 새겨져 능력치와 패시브로 바로 적용됩니다 (N사는 의수 칸을 쓰지 않습니다).':orgK==='공방'?'실제 게임에서는 이 의안이 전리품 칸으로 들어옵니다. 의수와 같은 효과(공격·회피·체력·패시브)를 주고, 공방 해결사만 받습니다. 공방 해결사의 의수 칸은 전용 의수로 고정되어 있어서 전리품으로 따로 줍니다.':'실제 게임에서는 이 의수가 보관함(또는 바로 장착)으로 들어옵니다.'} 이 체험판에서는 여기까지만 만져 볼 수 있습니다.</p>
      <button class="btn primary" data-ad="again">다시 설계해 본다</button></div>`;return}
    app.innerHTML=`<div class="stack" style="gap:12px;padding:16px;max-width:560px;margin:0 auto"><div class="eyebrow">체험판 · 특색 기념 전용 ${noun}</div><h2>전용 ${noun} 설계</h2>
      <div class="row" style="gap:6px;flex-wrap:wrap"><span class="small dim">내 소속(체험용)</span>${ADORG.map(([k,l])=>`<button class="btn quiet" style="width:auto;flex:none;padding:6px 12px${AD.org===k?';background:var(--gold);color:#111;border-color:var(--gold);font-weight:700':''}" data-ad="o:${k}">${k}</button>`).join('')}</div>
      <div class="panel stack" style="gap:6px"><span class="small dim">특색을 받고 한 해가 지났다.</span><span>${adIntro(orgK)}</span><span class="small dim">이름과 능력치를 직접 설계할 수 있다.</span></div>
      <div class="panel stack" style="gap:10px"><div class="row" style="gap:8px"><span class="small"><b>이름</b></span><input id="adname" maxlength="12" autocomplete="off" placeholder="${noun} 이름 (12자까지)" value="${esc(AD.name)}" style="flex:1;min-width:0"></div>
        <div class="row between"><b>포인트</b><span class="chip warn">남은 포인트 ${left}/${K.pts}</span></div>${stp('atk','공격',K.atkCost,K.atkPer)}${stp('eva','회피',K.evaCost,1)}${stp('hp','체력',K.hpCost,K.hpPer)}
        <div class="stack" style="gap:4px"><span class="small"><b>패시브</b> <span class="dim">(${K.passCost}포인트, 하나만)</span></span><div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;align-items:stretch">${Object.entries(K.pass).map(([k,v])=>`<button class="btn${AD.pas===k?' primary':''}" style="min-height:96px;justify-content:flex-start;word-break:keep-all" data-ad="p:${k}" ${AD.pas!==k&&!AD.pas&&left<K.passCost?'disabled':''}><b>${v.n}</b><span class="small dim">${v.e}</span></button>`).join('')}</div></div></div>
      <div class="panel stack" style="gap:4px;border-color:var(--gold)"><span class="eyebrow">미리보기</span><b class="serif">${esc(nm)}</b>${pv.length?pv.map(t=>`<div class="mono small" style="color:var(--gold)">${esc(t)}</div>`).join(''):'<div class="small dim">아직 아무것도 고르지 않았다.</div>'}</div>
      <button class="btn primary" data-ad="ok" ${used<=0?'disabled':''}>이 설계로 맡긴다</button><div class="small dim">포인트를 다 쓰지 않아도 주문할 수 있습니다. 주문하면 바꿀 수 없습니다.</div></div>`;
    if(!app._ad){app._ad=true;
      app.addEventListener('input',ev=>{if(ev.target.id==='adname')AD.name=ev.target.value});
      app.addEventListener('click',ev=>{const b=ev.target.closest('[data-ad]');if(!b)return;const [a,x,y]=b.dataset.ad.split(':'),K=CFG.ws.cust,cost={atk:K.atkCost,eva:K.evaCost,hp:K.hpCost},u=AD.atk*K.atkCost+AD.eva*K.evaCost+AD.hp*K.hpCost+(AD.pas?K.passCost:0);
        if(a==='d'){if(+y>0){if(K.pts-u>=cost[x])AD[x]++}else AD[x]=Math.max(0,AD[x]-1)}
        else if(a==='p'){if(AD.pas===x)AD.pas=null;else if(!AD.pas&&K.pts-u>=K.passCost)AD.pas=x}
        else if(a==='o'){AD.org=x}else if(a==='ok'){if(u>0)AD.done=true}else if(a==='again'){AD.done=false}
        augDemoDraw()})}
  }
  /* 공방 거리: 상점마다 머리글을 눌러 접고 펼친다. 접은 상태는 이 브라우저에 기억한다 */
  const SHOPFOLD_K='cityYearShopFold';
  let SHOPFOLD={};try{SHOPFOLD=JSON.parse(store.get(SHOPFOLD_K)||'{}')||{}}catch(e){SHOPFOLD={}}
  /* 단말기 지령(신탁대행자·헤르메스): '· · · · ·'이 깜빡이다가 글자가 흔들리며 한 글자씩 자리를 잡는다. 같은 라운드에는 한 번만 움직인다 */
  function termRun(){
    const el=document.querySelector('.termBar');if(!el)return;
    const tm=el.querySelector('.tm'),key=el.dataset.k,fin=el.dataset.t||'';
    if(UI.termKey!==key){UI.termKey=key;UI.termT0=performance.now()}   // 같은 라운드에 화면이 다시 그려져도 처음 시각부터 이어서 움직인다
    const G_='·:;░▒▓<>/|#@%&*+=?~',t0=UI.termT0,DOT=700,STEP=75;
    const tick=()=>{
      if(!document.body.contains(tm))return;
      const x=performance.now()-t0;
      if(x<DOT){tm.textContent=Array(1+Math.floor(x/140)%5).fill('·').join(' ')}
      else if(x<DOT+fin.length*STEP+250){const k=Math.max(0,Math.floor((x-DOT)/STEP));tm.textContent=fin.slice(0,k)+Array.from(fin.slice(k)).map(c=>c===' '?' ':G_[Math.floor(Math.random()*G_.length)]).join('')}
      else{tm.textContent=fin;return}
      requestAnimationFrame(tick)};
    tick();
  }
  function applyShopFold(){
    const mb=document.querySelector('.wrap .moneybar');if(!mb)return;
    for(let el=mb.nextElementSibling;el;el=el.nextElementSibling){
      if(!el.matches('.panel.stack')||!el.firstElementChild)continue;
      const hd=el.firstElementChild,t=(hd.querySelector('b.serif')||hd).textContent.trim();
      if(!t)continue;
      hd.dataset.a='shopfold';hd.dataset.i=t;hd.classList.add('foldhd');
      const f=!!SHOPFOLD[t];el.classList.toggle('folded',f);
      const m=document.createElement('span');m.className='foldmark';m.textContent=f?'▸':'▾';const tg=hd.querySelector('b.serif')||hd;tg.insertBefore(m,tg.firstChild);
    }
  }
  function render(){
    if(window.CITY_LAB){labDraw();return}
    if(window.CITY_AUGDEMO){augDemoDraw();return}
    const s=UI.screen;
    app.classList.toggle('barhide',barHidden());
    if(INFNOTE&&G&&G.infinite&&G.ch&&G.ch.infinite&&D.infinite&&D.infinite.notes&&!['title','birth','end','records','chron','chronview'].includes(s)&&UI.noteYear!==Math.floor((G.year||0)/100)){UI.noteYear=Math.floor((G.year||0)/100);showInfNote(infNote())}
    if(['title','birth','end','records','chron','chronview'].includes(s)||!(G&&G.infinite)||!INFNOTE){const o=document.querySelector('.infnote');if(o)o.remove();if(['title','birth'].includes(s))UI.noteYear=null}
    BGM.setBossTrack&&BGM.setBossTrack(C&&D.enemies[C.id]&&D.enemies[C.id].bgm==='ruen'?'ruen':'boss');
    BGM.setScene(s==='combat'?(C&&D.enemies[C.id]&&D.enemies[C.id].hidden?'boss':'fight'):'calm');
    const h={shared:vShared,records:vRecords,chron:vChron,chronview:vChronView,shopask:vShopAsk,title:vTitle,birth:vBirth,event:vEvent,result:vResult,level:vLevel,combat:vCombat,end:vEnd,sim:vSim,shop:vShop}[s]();
    const tab=`<span class="skin-tab">${SKIN_TAB[SKIN]}</span>`;
    /* 가방·받기 화면은 위에 덮는다. 받기(새 장비·카드)가 남아 있으면 그게 먼저다 */
    const ok=G&&G.ch&&['result','event','shop','shopask','level'].includes(s)&&!UI.animing;
    const pend=ok&&((G.ch.gearOffers||[]).length||G.ch.packOffer||(G.ch.offers||[]).length||(G.ch.picks||[]).length);
    if(s==='end'&&G&&G.ch){try{prepShare()}catch(e){}}
    const showNotice=s==='title'&&!UI.shared&&store.get('cityYearNotice')!==NOTICE.id;
    const ov=UI.help&&!UI.cfg?vHelp():UI.cfg?sheet(`<div class="row between" style="flex-wrap:nowrap;gap:8px"><b class="serif" style="white-space:nowrap">설정</b><button class="btn quiet" style="width:auto;flex:none;padding:8px 16px" data-a="cfgclose">닫기</button></div>${G&&G.ch&&s!=='title'?`<button class="btn" data-a="home" style="margin-top:8px;flex:none;height:auto${UI.homeAsk?';border-color:var(--gold)':''}"><b>${UI.homeAsk?'정말 나간다 · 한 번 더 누른다':'첫 화면으로'}</b><span class="dim small">${UI.homeAsk?'전투 중이면 그 전투는 처음부터 다시 시작한다. 판은 저장되어 있다':'진행 중인 판은 저장되어 있어 "이어서 하기"로 다시 열 수 있다'}</span></button>`:''}${FIGHT==='auto'&&s==='combat'?'<span class="small dim">설정을 여는 동안 자동 전투가 멈춘다. 닫으면 이어서 진행한다</span>':''}<div class="stack" style="margin-top:10px">${vSettings()}</div>`,'offer',true):ok&&UI.bag?vBag():pend?vOffer():showNotice?sheet(`<span class="eyebrow">공지</span><h2>${esc(NOTICE.t)}</h2><p class="small dim">${esc(NOTICE.note)}</p>${noticeTop()}${noticeBody()}<button class="btn primary" data-a="noticeok">확인</button>`,'offer',false):'';
    const bagOver=ok&&UI.bag&&pend;
    const ovKey=UI.help&&!UI.cfg?'help':UI.cfg?'cfg':showNotice&&!pend&&!(ok&&UI.bag)?'notice':pend?'offer:'+(G.ch.packOffer?'p':(G.ch.gearOffers||[]).length?'g':((G.ch.picks||[]).length&&!(G.ch.offers||[]).length)?'k':'c')+(UI.swap?'s':''):ov?'bag':'';
    const shO=app.querySelector('.sheet'),stO=shO?shO.scrollTop:0,scrKey=ovKey+(ok&&UI.bag?':'+UI.bag:'');
    app.innerHTML=`${s==='title'?chronBtn('chron-out'):''}<div class="wrap">${['records','chron','chronview'].includes(s)?`<button class="backbtn" data-a="${s==='chronview'?'chron':'title'}" aria-label="돌아가기">←</button>`:''}${tab}${h}</div>${h.includes('dock-in')?vDock('dock-out')+vSideL():s==='combat'&&C&&C.P?vSideL(C.P):''}${(()=>{const cb=UI.cbar;UI.cbar='';return s==='combat'&&cb&&!ov?`<div class="cbar"><div class="cbar-in">${cb}</div></div>`:''})()}${ov}${pend&&!UI.bag&&!UI.help&&!UI.cfg?'<button class="bagpeek" data-a="bag" data-i="card" aria-label="가방 열기">가방 보기</button>':''}${!ov&&!['title','birth'].includes(s)?`<button class="bartog" data-a="bartog" aria-label="${barHidden()?'위쪽 버튼 펼치기':'위쪽 버튼 접기'}">${barHidden()?'﹀':'︿'}</button>`:''}${!ov&&!['title','birth'].includes(s)?'<button class="cfgbtn" data-a="cfg" aria-label="설정" title="설정">⚙</button><button class="cfgbtn helpbtn" data-a="help" aria-label="카드·키워드 설명" title="카드·키워드 설명">?</button>'+(FS.ok()?`<button class="cfgbtn fsbtn" data-a="fs" aria-label="${FS.on()?'전체 화면 끝내기':'전체 화면'}" title="${FS.on()?'전체 화면 끝내기':'전체 화면'}">${FS.on()?'창화면':'전체화면'}</button>`:'')+quickAudio():''}`;
    if(ov&&ovKey!==UI.lastOv){const sh=app.querySelector('.sheet');if(sh)anim(sh,'bagopen',420)}
    if(ov&&scrKey===UI.lastScr){const sh=app.querySelector('.sheet');if(sh)sh.scrollTop=stO}
    UI.lastScr=scrKey;
    if(s==='end'){if(!UI.chronDone&&$('endShot')){UI.chronDone=true;try{chronAuto()}catch(e){}}}else UI.chronDone=false;
    document.documentElement.dataset.scr=s;
    if(s==='birth')fixBirthRows();
    UI.lastOv=ovKey;document.documentElement.classList.toggle('ovopen',!!ov);
    const lg=$('log');if(lg)lg.scrollTop=lg.scrollHeight;
    if(s!==lastScreen){window.scrollTo(0,0);lastScreen=s}
    if(s==='shop')applyShopFold();
    if(s==='combat')termRun();
    if(s==='birth'&&BC.fresh&&MODE!=='off'){BC.fresh=false;rollAnim()}
    if(s==='level'&&UI.lvFresh&&MODE!=='off'){UI.lvFresh=false;rollAnim()}
    if(s==='result'&&UI.res.anim&&UI.res.roll){UI.res.anim=false;UI.animing=true;resultAnim().then(()=>{UI.animing=false;if(G&&((G.ch.offers||[]).length||(G.ch.picks||[]).length||(G.ch.gearOffers||[]).length||G.ch.packOffer))render()})}
    if(s==='combat'&&FIGHT==='auto'&&!PLAYING&&C&&!C.over&&!UI.autoTimer&&!UI.paused&&!UI.cfg&&!UI.help){const g=autoGap();
      UI.autoTimer=setTimeout(()=>{UI.autoTimer=null;if(FIGHT==='auto'&&UI.screen==='combat'&&!PLAYING&&!C.over&&!UI.paused&&!UI.cfg&&!UI.help&&!UI.help){UI.sel=E.autoPick(C);render();setTimeout(()=>{if(FIGHT==='auto'&&!PLAYING&&!C.over&&!UI.paused)ACT.go()},g[1])}},g[0])}
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
    UI.fight=null;UI.pending=null;UI.curSt=st;UI.oldEnd=false;UI.overflowEnd=false;
    /* 100살 히든 엔딩은 한 번 본 뒤로는 다시 뜨지 않는다 (이미 본 기록이 있으면 그냥 이어서 간다) */
    if(st.type==='end'&&st.old&&loadRec().endings.includes('old')){nextYear();return}
    if(st.type==='end'){UI.confirmNew=null;UI.outEnd=st.out||null;UI.outerEnd=false;UI.endWin=st.win;UI.trueEnd=!!st.trueEnd;UI.crowEnd=st.crow||null;UI.oldEnd=!!st.old;UI.overflowEnd=!!st.overflow;UI.rbEnd=!!st.rb;UI.hwEnd=st.hw||null;UI.death=st.cause?{year:G.year,foe:st.cause==='sunk'?'침몰':st.cause==='mind'?'정신 붕괴':'뒤틀림',cause:st.cause}:null;recordEnd();UI.screen='end';render();return}
    UI.omen=null;UI.showIncome=G.year>1;
    if(st.type==='omen')UI.omen=st;
    else if(st.type==='fight'){UI.fight=st.enemy;UI.enc=st.enc}else{UI.ev=st.ev;noteHint(st.ev)}
    /* 공방 거리: 1년차부터 3년마다 들를지 묻는다. 들러도 해는 넘어가지 않는다 */
    const lakeDue=lakeHome()&&G.ch.lake&&G.ch.lake.harbor;if(lakeDue)G.ch.lake.harbor=false;
    /* 거미집 안에서는 공방 거리가 끼어들지 않는다: 그 해의 기회는 거미집이 끝난 뒤 첫 해로 미룬다(G.shopOwed) */
    let shopDue=lakeHome()?lakeDue:((G.year-1)%CFG.shop.every===0||!!G.shopOwed);
    if(shopDue&&!lakeHome()&&st.type==='event'&&st.ev&&st.ev.web){G.shopOwed=true;shopDue=false}
    if(shopDue&&!shopDone&&!G.free&&!(G.ch.rb&&!G.ch.rb.out)&&E.routeShop(G.ch)){G.shopOwed=false;
      UI.stock=hwHome()||trainHome()?[]:stock||(G.year>=CFG.shop.blackFrom?E.sample(Object.keys(D.special).filter(k=>!D.special[k].wsOnly),CFG.shop.blackStock).concat(E.wsAuxStock(G.ch)||[]):[]);
      UI.cardBox=UI.stock.length>0&&E.d(100)<=CFG.blackCard.chance;UI.aid=UI.stock.length>0&&E.d(100)<=CFG.blackAid.chance;UI.boxDone=null;
      UI.broker=E.officeBroker(G.ch);
      UI.bought=null;UI.meltMsg=null;UI.meltN=0;UI.deleted=null;UI.swapped=null;UI.tuneMsg=null;UI.sold=null;UI.soldN=0;UI.rested=null;UI.healed=0;UI.healMsg=null;UI.mindHealed=0;UI.mindMsg=null;saveGame({st,stock:[],shopDone:true});UI.screen='shopask';render();return;
    }
    UI.stock=[];saveGame({st});UI.screen='event';render();
  }
  /* H사 홍원 가문 안에 사는 동안은 공방 거리 대신 홍원의 저잣거리 */
  const hwHome=()=>!!(G&&G.ch&&G.ch.hw&&!G.ch.hw.out&&!G.ch.hw.done);
  /* 대호수로 나간 자는 공방 거리 대신 'U사의 어느 항구' (무한 모드의 외곽 가게는 따로) */
  const lakeHome=()=>!!(G&&G.ch&&G.ch.flags&&G.ch.flags.lake&&!(G.infinite&&G.ch.infinite));
  const LKSHOP=[['부두 선구점','U사 항구 끝, 닻줄과 작살을 파는 가게다. 값은 정직하고 주인은 말이 없다.'],['항만 장인방','고래를 잡는 배에 물건을 대는 장인들의 방이다. 배를 타 본 사람에게만 값을 깎아 준다.'],['U사 보급 창고','U사가 고래잡이 배에 내주는 창고다. 오래 배를 탄 사람의 이름을 적어 두었다.']];
  /* W사 열차 직원은 도시의 공방 거리를 쓰지 않는다: 3년마다 승무원 칸(의무실과 쉴 자리)만 지난다 */
  const trainHome=()=>!!(G&&G.ch&&G.ch.wtrain);
  const HWSHOP=[['저잣거리 대장간','홍원 성문 안쪽 골목의 대장간이다. 가문 이름을 대면 값을 속이지 않는다.'],['홍원 장인방','가문에 칼을 대는 장인들이 모여 사는 방이다. 후보라는 이름이 문을 연다.'],['가문의 보물고','선대가 모아 둔 물건을 푸는 방이다. 후보에게는 값을 받지 않고 내린다. 각각 한 번씩만 받을 수 있다.']];
  function vShopAsk(){
    const nb=(G.year-1)+CFG.shop.every+1,hh=hwHome(),tr=trainHome(),rb=G.ch.rb&&G.ch.rb.out?(G.ch.rb.fled?(G.ch.rb.bossDone?null:'alley'):'supply'):null,   /* R사 추적이 끝나면(숙청 집행관까지) '쫓기는 몸' 문구는 평범한 공방으로 돌아온다 */
      of=!!(G.infinite&&G.ch.infinite&&!tr&&!hh&&!rb);
    return `${vHud()}<div class="stack" style="gap:8px"><div class="eyebrow">${E.age(G)}세의 해 · ${tr?'열차 승무원 칸':hh?'홍원의 저잣거리':lakeHome()&&!rb?'U사의 어느 항구':rb==='supply'?'R사 보급 구역':rb==='alley'?'뒷골목 공방':of?'외곽의 어긋난 가게':'공방 거리'}</div><h2>${tr?'승무원 칸에 들른다':hh?'홍원의 저잣거리를 지난다':lakeHome()&&!rb?'대호수를 벗어나 선박장에 배를 댄다':rb==='supply'?'R사 보급 구역을 지난다':rb==='alley'?'뒷골목 공방을 찾는다':of?'집 앞길 끝의 가게에 들른다':'공방 거리를 지난다'}</h2>
      <p class="lead">${rb==='supply'?'R사 날개 직원에게 열린 보급 구역이다. 손등의 번호표를 보여 주면 장비를 내준다. 들러도 한 해가 지나가지는 않는다. ':rb==='alley'?'번호표를 가리고 뒷골목 공방을 찾았다. 쫓기는 몸이라 아무것도 묻지 않는 곳만 골랐다. 들러도 한 해가 지나가지는 않는다. ':''}${rb?'':tr?'열차 끝 칸의 승무원 칸이다. 팔 물건은 없고, 의무실과 눈 붙일 자리만 있다. 들러도 해는 넘어가지 않는다.':lakeHome()?'대호수를 벗어났다. 근처 U사의 선박장에 배를 대고 정비를 할 수 있다. 닻줄과 작살, 기름 먹인 천을 파는 가게가 늘어서 있다. 들러도 한 해가 지나가지는 않는다.':hh?'붉은 대문 안쪽에 가문의 저잣거리가 있다. 장인과 상인은 모두 가문의 이름 아래 있다. 들러도 한 해가 지나가지는 않는다.':of?'외곽에는 거리가 없다. 그런데 집 앞길 끝에 가게가 하나 서 있다. 누가 여는지, 어디서 물건을 들여오는지 아무도 모른다. 이 자리에서는 필요한 사람이 있으면 필요한 가게가 선다. 들러도 한 해가 지나가지는 않는다.':'장비를 손볼 수 있는 거리다. 들러도 한 해가 지나가지는 않는다.'}${UI.stock.length?' 골목 안쪽에 이번에만 열린 암시장 문도 보인다. 다음에 들를 때는 물건이 바뀐다.':''}</p>
      ${lakeHome()?'':`<p class="small dim">${nb<=E.lastYear(G)?`다음 기회는 ${nb}년차.`:'이번이 마지막 기회다.'}</p>`}
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
    checkInnateUnlock();
    /* 해금 출생(D.unlockOrigins): 무한 모드 전 2막 끝까지 간 판이 cond의 출생(origin 이름) 또는 아이템(item id)을 만족하면 열린다. 굴림 번호 히든 출생과는 별개 */
    {const cc=G.ch,cleared=UI.endWin&&(UI.trueEnd||UI.crowEnd||UI.outEnd||UI.oldEnd||UI.outerEnd||G.infinite),u0=loadUnlocks();
      if(cleared)for(const o of D.unlockOrigins||[]){const k='origin:'+o.key,cd=o.cond||{};if(u0.includes(k))continue;
        const has=cd.item?[...Object.values(cc.gear||{}),...(cc.stash||[])].some(x=>x&&x.id===cd.item):false;
        if((cd.origin&&cc.o&&cc.o.n===cd.origin&&(!cd.beat||(cc.beaten||[]).includes(cd.beat)))||(cd.aff&&((cc.aff&&cc.aff.name===cd.aff)||(cc.affLog||[]).includes(cd.aff)))||has||(cd.relic&&(cc.relics||[]).includes(cd.relic))){addUnlock(k);UI.newOrigin=o.n}}}
    const r=loadRec(),c=G.ch,w=UI.endWin,dt=UI.death,lived=w?G.year:Math.max(0,G.year-1);
    const fe=blankEnd(c,w),k=(fe&&fe!=='wed')?fe:w&&UI.overflowEnd?'overflow':(w&&c.distForm?'distwin':w&&UI.outEnd?'out_'+UI.outEnd:w&&UI.outerEnd?'outer':w&&UI.oldEnd?'old':w&&UI.trueEnd?'true':w?'win':dt&&dt.hunt&&c.distForm?'lovekill':dt&&(dt.cause==='distort'||c.distForm)?'distort':dt&&dt.cause==='mind'?'mind':dt&&dt.id==='hongru'?'hwlose':'death');
    if(w&&UI.overflowEnd){const wp=c.gear&&c.gear.weapon;r.ghost={name:c.name||T.you,lv:c.lv,aff:affName(c)||'',wpn:(wp&&wp.n)||'',wx:(wp&&wp.wx)?JSON.parse(JSON.stringify(wp.wx)):null,deck:(c.deck||[]).filter(id=>D.cards[id]&&['atk','def','buff'].includes(D.cards[id].t)).slice(0,12),atk:c.stats.atk,eva:c.stats.eva,spd:c.stats.spd,hp:c.stats.maxHp}}
    if(!r.endings.includes(k))r.endings.push(k);if(fe==='wed'&&!r.endings.includes('wed'))r.endings.push('wed');r.runs++;if(w&&c.hard)r.hardClear=(r.hardClear||0)+1;if(w&&c.easy)r.easyClear=(r.easyClear||0)+1;
    const S=r.st=r.st||{n:0,sum:0,min:null,max:0,ends:{},aff:{},ori:{},inn:{}},bump=(m,n)=>{if(n)m[n]=(m[n]||0)+1};
    S.n++;S.sum+=lived;S.min=S.min==null?lived:Math.min(S.min,lived);S.max=Math.max(S.max,lived);if(!UI.overflowEnd)bump(S.ends,k);bump(S.aff,affName(c)||(c.licensed?T.licensed:''));bump(S.ori,c.o&&c.o.n);
    [c.innate,c.innate2].filter(Boolean).forEach(i=>bump(S.inn,D.innate[i]&&D.innate[i].n));
    if(c.daily){let h='';try{h=shareHead()}catch(e){}const dd=loadDaily(),cur={w:w?1:0,y:lived,lv:c.lv,h,df:diffOf(c)},sc=x=>(x.w?1000:0)+x.y,e0=dd[c.daily]||{n:0,best:null};
      UI.dailyCmp={day:c.daily,prev:e0.best,last:e0.last||null,n:e0.n+1,cur};
      e0.n++;e0.last=cur;if(!e0.best||sc(cur)>sc(e0.best))e0.best=cur;dd[c.daily]=e0;
      const ks=Object.keys(dd).sort();while(ks.length>40)delete dd[ks.shift()];store.set(DAILYK,JSON.stringify(dd))}else UI.dailyCmp=null;
    r.best.years=Math.max(r.best.years,lived);r.best.lv=Math.max(r.best.lv,c.lv);if(G.endless)r.best.grade=Math.max(r.best.grade,E.gradeAt(G.year));
    if(dt&&dt.id==='godmother'){r.titles=r.titles||{};r.titles['정해진 운명']=(r.titles['정해진 운명']||0)+1}
    store.set(REC,JSON.stringify(r));if(!w||UI.overflowEnd)store.del(SAVE);
  }
  function startCombat(id){recAdd('seen',id);C=E.mkCombat(G.ch,id);UI.sel=[];PLAYING=false;UI.paused=false;UI.screen='combat';render()}

  const ACT={
    lrelic(k){if(!E.relicChoices(G.ch).includes(k))return;const wn=E.giveRelic(G.ch,k,true);UI.res.chips=[...UI.res.chips,'유물 · '+D.relics[k].n+(wn?' · '+wn:'')];render()},
    offkw(k){UI.offName=(($('offname')||{}).value||UI.offName||'');UI.offKw=k;render()},
    offset(){
      const n=(($('offname')||{}).value||'').trim(),err=E.officeNameErr(n);
      if(err){UI.offErr=err;UI.offName=n;render();return}
      const kw=UI.offKw||'bleed';E.setOffice(G.ch,n,kw);UI.offErr='';UI.offName='';UI.offKw=null;resave();
      UI.res.chips=[...UI.res.chips,`내 사무소 · ${G.ch.office.name} (${E.OKW[kw]})`];render();
    },
    cpick(k){
      if(E.setColorPick(G.ch,k)){resave();UI.res.chips=[...UI.res.chips,`특색 패시브 · ${E.colorPasv[k].n} · ${E.colorPasv[k].e}`];render()}
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
    bondaliasset(){
      const n=(($('bondalias')||{}).value||'').trim(),err=E.partnerAliasErr(n);
      if(err){UI.bondErr=err;UI.bondAlias=n;render();return}
      E.setPartnerAlias(G.ch,n);UI.bondErr='';UI.bondAlias='';resave();
      UI.res.chips=[...UI.res.chips,`특색 · ${n}`];render();
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
    starset(){
      const n=(($('starname')||{}).value||'').trim(),err=E.nameErr(n);
      if(err){UI.starErr=err;UI.starName=n;render();return}
      const it=E.setStar(G.ch,n);UI.starErr='';UI.starName='';resave();
      if(UI.res&&UI.res.chips)UI.res.chips=[...UI.res.chips,`전용 무기 · ${it.n} · ${it.e}`];render();
    },
    seongset(){
      const n=(($('seongname')||{}).value||'').trim(),err=E.nameErr(n);
      if(err){UI.seongErr=err;UI.seongName=n;render();return}
      const it=E.setSeongdo(G.ch,n);UI.seongErr='';UI.seongName='';resave();
      UI.res.chips=[...UI.res.chips,`전리품 · 성도 · ${it.n}  획득 · ${it.e} (능력치에 더해졌다)`];render();
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
    sellcard(i){if((UI.soldN||0)>=CFG.workshopFixer.cardMax)return;const r=E.sellCard(G.ch,+i);if(r){UI.soldN=(UI.soldN||0)+1;UI.sold=`${D.cards[r.id].n}을(를) ${E.money(r.v)}에 팔았다.`;resave();render()}},
    swapcard(i){if((UI.swapped||[]).length>=CFG.shop.swapMax)return;const r=E.swapCard(G.ch,+i);if(r){(UI.swapped=UI.swapped||[]).push([D.cards[r.old].n,D.cards[r.nid].n]);render()}},
    wsmelt(i){const [sl,ix]=String(i).split(':'),r=E.wsMelt(G.ch,sl,+ix);if(r){UI.wsMsg=`${r.m}을(를) 녹였다 · ${r.hidden?'히든 재료 · 한 단계 상승':r.step?'일반 재료 +'+r.val+' · '+(r.step>1?r.step+'단계 한꺼번에 ':'한 단계 ')+'상승 ('+r.n+'단계)':'일반 재료 +'+r.val+' · '+r.p+'/'+r.need}${r.sp?' · 특수 효과 획득 · '+({baral:'공격 카드마다 1타 추가',zena:'2번 적중마다 요정 +1',gebura:'적중마다 HP 1 흡수'})[r.sp]:''}`;resave();render()}},
    wsname(sl){const el=document.getElementById('wsn_'+sl),n=E.wsRename(G.ch,sl,el?el.value:'');if(n){UI.wsMsg=`이름을 '${n}'(으)로 정했다.`;resave();render()}},
    wskind(i){const r=E.wsSetKind(G.ch,i);if(r){UI.wsMsg=`보조 장비 종류 · ${r.n} (${(CFG.ws.aug.kindE||{})[i]||r.e})`;resave();render()}},
    wsstkw(i){const r=E.wsSetStaffKw(G.ch,i);if(r){UI.wsMsg=`지팡이 집중 키워드 · ${r.n}`;resave();render()}},
    wsaugc(i){const r=E.wsAugChoose(G.ch,i);if(r){UI.wsMsg=`의수 특수 강화 · 적중 시 ${D.keywords[r.stat].n} +${r.amt}`;resave();render()}},
    wsaug(i){const [ix,k]=String(i).split(':'),r=E.wsAugPick(G.ch,+ix,k);if(r){UI.wsMsg=`${r.m}을(를) 녹여 의수를 개조했다 · ${CFG.ws.aug.stats[r.stat]} +${CFG.ws.aug.pick}`;resave();render()}},
    tune(k,el){const r=E.tuneGear(G.ch,k,el&&el.dataset?el.dataset.s:null);if(r){UI.tuneMsg={ok:r.ok,t:`${r.n} · ${r.stat==='atk'?'공격':'회피'} +1 ${r.ok?'성공':'실패'} (${r.tries}/${E.tuneMax(G.ch)})`};render()}},
    delcard(i){if((UI.deleted||[]).length>=CFG.shop.delMax)return;const c=E.delCard(G.ch,+i);if(c){(UI.deleted=UI.deleted||[]).push(D.cards[c].n);render()}},
    tname(){
      const ch=G.ch,adj=D.colors[ch.ci].adj,w=(($('tw')||{}).value||'').trim();
      {const e=E.nameErr(w,{min:2});if(e){UI.twErr=e;render();return}}
      const old=ch.title;ch.title=adj+' '+w;ch.titlePick=false;UI.twErr='';
      UI.res.chips=UI.res.chips.map(x=>x===T.titleLabel+' · '+old?T.titleLabel+' · '+ch.title:x);render();
    },
    finish(){store.del(SAVE);UI.confirmNew=null;UI.shareText=UI.shareMsg=UI.imgUrl=null;UI.screen='title';render()},
    title(){UI.confirmNew=null;if(UI.shared){UI.shared=null;try{history.replaceState(null,'',location.pathname+location.search)}catch(e){}}UI.screen='title';render()},
    infnote(i){INFNOTE=i!=='off';store.set('cityYearInfNote',i==='off'?'off':'on');render()},
    mode(i){MODE=i;store.set('cityYearMode',i);render()},
    hitfx(i){HFX=i;store.set(HFXK,i);render()},
    hitfxm(i){HFXM=i;store.set(HFXMK,i);render()},
    fightmode(i){FIGHT=i;store.set('cityYearFight',i);UI.paused=false;render()},
    pause(){UI.paused=!UI.paused;if(UI.paused&&UI.autoTimer){clearTimeout(UI.autoTimer);UI.autoTimer=null}render()},
    autogap(i){AUTOGAP=i;store.set('cityYearAutoGap',i);if(UI.autoTimer){clearTimeout(UI.autoTimer);UI.autoTimer=null}render()},
    dice(i){DICE=i;store.set('cityYearDice',i);render()},
    bgm(i){BGM.set(i==='on');bgmSave();render()},
    qsfx(){SFXS.on=!SFXS.on;sfxSave();if(SFXS.on)SFX.play('hit');render()},
    sfx(i){SFXS.on=i==='on';sfxSave();if(SFXS.on)SFX.play('hit');render()},
    sfxtest(){SFX.play('hit');setTimeout(()=>{const x=$('sfxState');if(x)x.textContent='오디오 상태 · '+SFX.state()},300);setTimeout(()=>SFX.play('dodge'),380);setTimeout(()=>SFX.play('slash'),760)},
    sfxstep(i){const p=Math.round(SFXS.vol*100),n=+i>0?Math.floor(p/10)*10+10:Math.ceil(p/10)*10-10;SFXS.vol=clamp(n,0,100)/100;sfxSave();SFX.play('hit');render()},
    bartog(){try{localStorage.setItem('cy_barhide',barHidden()?'0':'1')}catch(e){}render()},
    qbgm(){BGM.set(!BGM.isOn());bgmSave();render()},
    qstyle(){BGM.setStyle({calm:'passion',passion:'library',library:'wave',wave:BGM.extOn()?'ext':'calm',ext:'calm'}[BGM.style()]||'calm');bgmSave();render()},
    qvol(){UI.volOpen=!UI.volOpen;render()},
    voicepick(k){if(!UI.ev||!UI.ev.voices||(k!=='good'&&k!=='bad'))return;G.ch.voiceBias=k;UI.voicePicked=UI.ev;resave();render()},
    mindbias(k){UI.mindBias=k||'';render()},
    mindsight(k){UI.mindSight=+k||0;render()},
    mindtest(k){
      const sd=newSeed();E.reseed(sd);let c=E.newChar(),g=0;while((c.o.hidden||c.ego||c.o.secret)&&g++<200)c=E.newChar();BC=c;BC.seed=sd;BC.name='';BC.fresh=false;
      ACT.live();const ch=G.ch;ch.year=G.year=Math.max(G.year||0,12);ch.hp=ch.stats.maxHp;ch.voiceUsed=false;ch.distortDone=false;ch.voicePend=false;ch.distortPend=false;ch.voiceBias=k==='voice'?null:(UI.mindBias||null);ch.stats.egoSight=15*(UI.mindSight||0);UI.voicePicked=null;UI.voicePlay=null;UI.voiceSeen=null;
      if(k==='voice'){ch.mind=8;ch.voicePend=true}
      else if(k==='distort'){ch.mind=1;ch.distortPend=true}
      else if(k==='break'){ch.mind=0;ch.mindDead=true;ch.distortDone=true;UI.pending='thug'}
      UI.ev=null;UI.res=null;flow()},
    voiceskip(){if(UI.ev&&UI.ev.voices&&UI.voiceSeen!==UI.ev){UI.voiceSeen=UI.ev;render()}},
    bgmstyle(i){BGM.setStyle(i);bgmSave();render()},
    bgmext(i){BGM.setExt(+i);BGM.setStyle('ext');bgmSave();render()},
    bgmstep(i){const p=Math.round(BGM.vol()*100),n=+i>0?Math.floor(p/10)*10+10:Math.ceil(p/10)*10-10;BGM.setVol(clamp(n,0,100)/100);bgmSave();render()},
    skin(i){SKIN=i;BGM.setMood(i);store.set('cityYearSkin',i);document.documentElement.dataset.skin=i;render()},
    endless(){G.endless=true;UI.shareText=UI.shareMsg=UI.imgUrl=null;flow()},
    outerend(){if(!G||!G.infinite)return;UI.outEnd=null;if(typeof confirm==='function'&&!confirm('외곽에서 이야기를 끝낼까? 이 판은 여기까지가 기록이 된다.'))return;UI.outerEnd=true;UI.endWin=true;UI.trueEnd=true;UI.oldEnd=false;UI.death=null;recordEnd();UI.screen='end';render()},
    oldgo(){UI.oldEnd=false;UI.outEnd=null;UI.shareText=UI.shareMsg=UI.imgUrl=null;nextYear()},
    infinite(){G.infinite=true;G.endless=true;G.ch.infinite=true;G.ch.infImp=1;UI.shareText=UI.shareMsg=UI.imgUrl=null;flow()},
    async saveimg(){
      UI.imgUrl=null;const cv=await shotEnd()||await endCard(),name=`도시의한해_${G.ch.seed}.png`;
      const blob=await new Promise(r=>cv.toBlob(r,'image/png'));
      try{const f=new File([blob],name,{type:'image/png'});if(touchShare()&&navigator.canShare&&navigator.canShare({files:[f]})){await navigator.share({files:[f]});return}}catch(e){if(e&&e.name==='AbortError')return}
      try{const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),4000)}catch(e){}
      /* 다운로드가 막히는 환경(미리보기 창 등)을 위해 이미지도 화면에 보여 준다 */
      if(window.self!==window.top){UI.imgUrl=cv.toDataURL('image/png');render()}
    },
    testCard:async()=>(await endCard()).toDataURL('image/png'),
    async share(){
      UI.shareText=null;UI.shareMsg=null;
      const url=UI.shU&&UI.shK===JSON.stringify(shareRec())?UI.shU:await shareLinkAsync();
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
    start(){if(UI.screen==='title'&&loadSave()&&UI.confirmNew!=='start'){UI.confirmNew='start';render();return}if(UI.screen==='end'&&endCanResume()&&UI.confirmNew!=='start'){UI.confirmNew='start';render();return}store.del(SAVE);UI.confirmNew=null;UI.shareText=UI.shareMsg=UI.imgUrl=null;UI.daily=null;if(expired()){UI.screen='title';render();return}born(newSeed(),BC&&BC.name);UI.endText=null;UI.screen='birth';render()},
    cont(){const o=loadSave();if(!o)return;G=o.G;E.ensurePacks(G.ch);C=null;UI.shareText=UI.shareMsg=UI.imgUrl=null;UI.endText=null;UI.confirmNew=null;
      if(o.st)showYear(o.st,o.stock,o.shopDone);else if(o.after){UI.pending=o.pending||null;flow()}else nextYear()},
    async chimg(v){
      const [tab,id]=String(v).split(':'),e=(loadChron()[tab]||[]).find(x=>x.id===id);if(!e)return;
      const cv=await shotEnd('chShot');if(!cv){UI.chMsg=UI.shotWhy==='load'?'이미지 도구를 불러오지 못했다. 인터넷 연결을 확인하거나 앱 속 브라우저라면 크롬·사파리로 열어 다시 시도해 주세요.':'이 기록은 화면이 너무 길어 이미지로 만들지 못했다. 기록 화면을 직접 캡처해 저장해 주세요.';render();return}
      const name=`도시의한해_일대기_${(e.v||'')}_${e.id}.png`,blob=await new Promise(r=>cv.toBlob(r,'image/png'));
      try{const f=new File([blob],name,{type:'image/png'});if(touchShare()&&navigator.canShare&&navigator.canShare({files:[f]})){await navigator.share({files:[f]});return}}catch(er){if(er&&er.name==='AbortError')return}
      try{const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),4000)}catch(er){}
      if(window.self!==window.top){UI.imgUrl=cv.toDataURL('image/png');UI.chMsg='';render()}
    },
    chron(){UI.delAsk=null;UI.screen='chron';render()},
    rfold(k){const f=recFold(),i=f.indexOf(k);if(i<0)f.push(k);else f.splice(i,1);try{localStorage.setItem(RFK,JSON.stringify(f))}catch(e){}render()},
    chtab(k){UI.delAsk=null;UI.chTab=k==='fame'?'fame':'life';UI.screen='chron';render()},
    chview(v){const [tab,id]=String(v).split(':');UI.delAsk=null;UI.imgUrl=null;UI.chSel={tab,id};UI.screen='chronview';render()},
    chfame(id){const o=loadChron(),e=o.life.find(x=>x.id===id);if(!e)return;
      if(o.fame.some(x=>x.key===e.key)){UI.chMsg='이미 명예의 전당에 있다.'}
      else if(o.fame.length>=CHRON_FAME){UI.chMsg=`명예의 전당은 최대 ${CHRON_FAME}개다. 하나를 삭제한 뒤 올려 주세요.`;UI.chTab='fame'}
      else{o.fame.unshift(e);saveChron(o);UI.chMsg='명예의 전당에 올렸다.'}
      UI.screen='chron';render()},
    chmove(v){const [dir,id]=String(v).split(':'),o=loadChron(),i=o.fame.findIndex(x=>x.id===id),j=dir==='up'?i-1:i+1;if(i<0||j<0||j>=o.fame.length)return;[o.fame[i],o.fame[j]]=[o.fame[j],o.fame[i]];saveChron(o);UI.chTab='fame';UI.screen='chron';render()},
    chdel(v){const [tab,id]=String(v).split(':');if(UI.delAsk!==v){UI.delAsk=v;render();return}UI.delAsk=null;
      const o=loadChron();o[tab]=(o[tab]||[]).filter(x=>x.id!==id);saveChron(o);UI.chTab=tab;UI.screen='chron';render()},
    records(){UI.screen='records';render()},
    daily(){if(loadSave()&&UI.confirmNew!=='daily'){UI.confirmNew='daily';render();return}store.del(SAVE);UI.confirmNew=null;if(expired()){UI.screen='title';render();return}UI.shareText=UI.shareMsg=UI.imgUrl=null;UI.daily=todayKey();born(dailySeed(UI.daily),'',true);UI.endText=null;UI.screen='birth';render()},
    blank(){if(!BC||BC.blank||UI.job)return;const nm=BC.name,sd=BC.seed;BC=E.newChar(null,null,{r:BC.r,kid:BC.kid});BC.seed=sd;BC.name=nm;BC.fresh=false;UI.relic=null;BC.fateChoices=E.blankFate();render()},
    fbirth(k){if(!FINGERTEST||!BC)return;const nm=BC.name,sd=BC.seed;E.reseed(sd);let c;
      if(k==='조직'){for(let i=0;i<5000;i++){c=E.newChar();if(c.o.n==='조직 출신')break}}
      else{const roll=k==='보냐텔리'?90:50;for(let i=0;i<20000;i++){c=E.newChar();if(c.r.o===roll)break}}
      c.seed=sd;c.name=nm;BC=c;BC.fresh=false;UI.relic=null;render()},
    nofate(){if(!BC||!BC.fateChoices||BC.fated)return;BC.fateChoices=null;render()},
    fate(i){const roll=+i;if(!BC||!BC.fateChoices||!BC.fateChoices.includes(roll))return;const nm=BC.name,sd=BC.seed,r=BC.r,kid=BC.kid;BC=E.newChar(null,null,{r,kid,fate:roll});BC.seed=sd;BC.name=nm;BC.fresh=false;UI.relic=null;render()},
    reroll(){UI.relic=null;UI.daily=null;if(UI.jobAuto){UI.job=null;UI.jobAuto=false}born(newSeed(),BC&&BC.name);render()},
    seed(){UI.relic=null;UI.daily=null;if(UI.jobAuto){UI.job=null;UI.jobAuto=false}const v=parseInt(($('seedIn')||{}).value,10);if(!(v>=0)){const i=$('seedIn');if(i){i.value='';i.placeholder='숫자만 넣을 수 있다'}return}born(v,BC&&BC.name);render()},
    color(i){E.setColor(BC,+i);BC.fresh=false;render()},
    relic(k){UI.relic=k;render()},
    rbteam(t){UI.team=t;render()},
    bloodw(k){UI.bloodW=k||null;render()},
    origin(k){UI.origin=k||null;if(UI.origin){UI.job=null;UI.jobAuto=false}UI.relic=null;born(BC.seed,BC.name);render()},
    tpreset(k){UI.testPreset=k||null;render()},
    job(k){if(k)UI.origin=null;UI.job=k||null;UI.jobAuto=false;UI.relic=null;born(BC.seed,BC.name);render()},
    jobroll(k){if(k){UI.jobBase=BC.o.n;UI.job=k;UI.jobAuto=true}else{UI.job=null;UI.jobAuto=false}UI.relic=null;born(BC.seed,BC.name);render()},
    live(){if(BC&&BC.fateChoices&&!BC.fated)return;if(BC&&BC.o&&BC.o.race==='hyeolgwi'&&UI.bloodW&&!UI.job)E.bloodWeapon(BC,UI.bloodW);if(BC&&BC.starPick){const n=(($('starname')||{}).value||'').trim(),err=E.nameErr(n);if(err){UI.starErr=err;UI.starName=n;render();return}E.setStar(BC,n);UI.starErr='';UI.starName=''}{const dk=dailyKeyOf(BC.seed);if(dk)BC.daily=dk}if(BC.innate)recAdd('innate',BC.innate);if(BC.innate2)recAdd('innate',BC.innate2);if(BC.relicPick){if(!UI.relic)return;E.giveRelic(BC,UI.relic);UI.relic=null}if(BC.teamPick){if(!UI.team)return;E.setRbTeam(BC,UI.team);UI.team=null}if(isHard())BC.hard=true;else delete BC.hard;if(isEasy())BC.easy=true;else delete BC.easy;if(DICE!=='fixed')E.reseed(newSeed());G=E.newGame(BC);if(UNLOCKTEST&&UI.testPreset)E.testPreset(G,UI.testPreset);nextYear()},
    flow(){flow()},
    fight(){UI.pending=UI.fight;UI.fight=null;flow()},
    shop(){UI.wsMsg=null;E.wsEnsure(G.ch);UI.showIncome=false;UI.screen='shop';render()},
    /* 6시즌: 공방 거리에서 쉬어 가기 (공방 거래 없이 정신력 회복) */
    rest(){if(UI.rested)return;if(G.ch.restYear===G.year){UI.rested='이번 해에는 이미 쉬었다 · 정신력은 해마다 한 번만 회복한다';render();return}G.ch.restYear=G.year;const g=E.gainMind(G.ch,CFG.shop.restMind);UI.rested=g?`잠시 쉬었다 · 정신력 +${g} (${G.ch.mind}/${E.mindMax(G.ch)})`:'잠시 쉬었다 · 정신력이 이미 가득하다';UI.showIncome=false;resave();render()},
    buy(id){const ch=G.ch,it=D.items[id];if(AUTOMELT&&it&&E.isWs(ch)&&ch.ws&&!it.tool&&!it.perm&&!it.hw&&E.canBuy(ch,id)==='ok'){ACT.buymelt(id);return}UI.buyAsk=id;render()},
    buymelt(id,b){UI.buyAsk=null;const ch=G.ch,it=D.items[id];if(!it||!E.isWs(ch)||!ch.ws||it.tool||it.perm||it.hw){render();return}
      const cnt=Math.max(1,+((b&&b.dataset&&b.dataset.n)||1)),m0=ch.money;let ok=0,last=null,why='';
      for(let k=0;k<cnt;k++){const before=(ch.stash||[]).length;if(!E.buy(ch,id,false)){why='돈이 모자라거나 더 살 수 없다';break}const st=ch.stash||[];let ix=-1;for(let i=st.length-1;i>=0;i--)if(st[i].id===id){ix=i;break}
        const r=ix>=0&&st.length>=before?E.wsMelt(ch,it.slot,ix):null;if(!r){why='작업대에 이 칸의 전용 장비가 없어 녹이지 못했다 (보관함에 남았다)';break}ok++;last=r}
      if(ok){UI.meltN=(UI.meltN||0)+ok;UI.meltMsg=`${it.n} ${ok}개를 사서 바로 녹였다 (−${E.money(m0-ch.money)}) · ${last.step?'강화 '+last.n+'단계':'일반 재료 +'+last.val+' · '+last.p+'/'+last.need} · 이번 방문 모두 ${UI.meltN}개${why?' · '+why:''}`;resave()}
      else UI.meltMsg=`${it.n}: ${why||'녹이지 못했다'}`;render()},
    automelt(){AUTOMELT=!AUTOMELT;store.set('cityYearAutoMelt',AUTOMELT?'on':'off');render()},
    buyok(id){UI.buyAsk=null;if(E.buy(G.ch,id,true)){UI.bought=D.items[id].n}render()},
    buyno(){UI.buyAsk=null;render()},
    gtab(i){UI.gTab=i;render()},
    eqs(i){if(UI.screen!=='combat'&&E.equipStash(G.ch,+i)){resave();render()}},
    bspecial(id){if(E.buySpecial(G.ch,id,true)){UI.bought=D.special[id].n;render()}},
    noticeok(){store.set('cityYearNotice',NOTICE.id);render()},
    titleeq(i){const L=titleList(G.ch),t=L[+i];if(!t)return;G.ch.equipTitle=G.ch.equipTitle===t[0]?'':t[0];resave();render()},
    packrn(i){
      i=+i;const el=$('pkn'+(i<0?'a':i)),r=E.renamePack(G.ch,i,el?el.value:'');
      UI.packMsg=r===true?'이름을 바꿨다.':r;if(r===true)resave();render();
    },
    packsw(i){
      i=+i;UI.packSwAsk=null;
      if(E.switchPack(G.ch,i)){UI.packMsg='카드팩을 바꿨다 · 지금 쓰는 팩: '+(G.ch.packName||'기본 카드팩');resave()}else UI.packMsg='지금은 바꿀 수 없다.';
      render();
    },
    shopfold(i,el){const p=el.closest('.panel');if(!p)return;const f=!p.classList.contains('folded');p.classList.toggle('folded',f);const m=el.querySelector('.foldmark');if(m)m.textContent=f?'▸':'▾';if(f)SHOPFOLD[i]=1;else delete SHOPFOLD[i];try{store.set(SHOPFOLD_K,JSON.stringify(SHOPFOLD))}catch(e){}},
    bag(k){if(UI.bag===k){UI.bag=null;UI.dropAsk=null;UI.bonAsk=null;UI.packSwAsk=null;render();return}UI.bag=k;UI.dropAsk=null;UI.bonAsk=null;UI.packSwAsk=null;render()},
    bonup(i){i=+i;if(UI.bonAsk!==i){UI.bonAsk=i;render();return}UI.bonAsk=null;if(E.bonUpgrade(G.ch,i)){resave();render()}},
    help(){UI.help='card';if(UI.autoTimer){clearTimeout(UI.autoTimer);UI.autoTimer=null}render()},
    helptab(k){UI.help=k;render()},
    rectab(k){UI.recTab=k;render()},
    bagclose(){if(UI.help){UI.help=null;render();return}if(UI.cfg){UI.cfg=false;render();return}UI.bag=null;UI.dropAsk=null;render()},
    fs(i){if(i==null||(i==='on')!==FS.on())FS.toggle()},
    cfg(){UI.cfg=true;UI.homeAsk=false;if(UI.autoTimer){clearTimeout(UI.autoTimer);UI.autoTimer=null}render()},
    cfgclose(){UI.cfg=false;UI.homeAsk=false;render()},
    home(){
      if(UI.screen!=='birth'&&!UI.homeAsk){UI.homeAsk=true;render();return}UI.homeAsk=false;
      if(UI.autoTimer){clearTimeout(UI.autoTimer);UI.autoTimer=null}UI.cfg=false;UI.bag=false;UI.confirmNew=null;UI.paused=false;PLAYING=false;
      if(UI.screen==='end'||!loadSave()){UI.screen='title';render();return}
      UI.screen='title';render();
    },
    packyes(){if(!UI.packAsk){UI.packAsk=true;render();return}UI.packAsk=false;const n=G.ch.packOffer.n;if(E.acceptPack(G.ch)){UI.res.chips=[...UI.res.chips,`${n} · 덱이 바뀌고 고정되었다 (이전 덱은 가방의 카드팩 보관함에 남았다)`];resave();render()}},
    custd(v){const [k,d]=String(v).split(':'),K=CFG.ws.cust,cu=UI.cu=UI.cu||{atk:0,eva:0,hp:0,pas:null},cost={atk:K.atkCost,eva:K.evaCost,hp:K.hpCost}[k];if(!cost)return;const left=K.pts-(cu.atk*K.atkCost+cu.eva*K.evaCost+cu.hp*K.hpCost+(cu.pas?K.passCost:0));if(+d>0&&left<cost)return;cu[k]=Math.max(0,cu[k]+(+d>0?1:-1));render()},
    custp(k){const K=CFG.ws.cust,cu=UI.cu=UI.cu||{atk:0,eva:0,hp:0,pas:null};if(cu.pas===k){cu.pas=null}else{const left=K.pts-(cu.atk*K.atkCost+cu.eva*K.evaCost+cu.hp*K.hpCost+(cu.pas?K.passCost:0));if(!cu.pas&&left<K.passCost)return;cu.pas=k}render()},
    cuk(k){(UI.cu=UI.cu||{name:'',atk:0,eva:0,hp:0,pas:null}).ak=k;render()},
    custok(){const r=E.custBuild(G.ch,UI.cu||{});if(r){if(UI.res)UI.res.chips=[...(UI.res.chips||[]),...r.chips];UI.cu=null;resave();render()}},
    packalt(){UI.packAsk=false;const P=G.ch.packOffer;if(!P||!P.alt)return;if(E.acceptPackAlt(G.ch)){UI.res.chips=[...UI.res.chips,`${P.alt.label} · 후보 시절 카드를 덜어내고 흑수의 카드를 더했다`];resave();render()}},
    packno(){UI.packAsk=false;const n=G.ch.packOffer.n;if(E.declinePack(G.ch)){UI.res.chips=[...UI.res.chips,`${n} · 지금 덱을 지켰다`];resave();render()}},
    gwear(){E.resolveGear(G.ch,0,true);resave();render()},
    geat(){const c=E.gwEatOffer(G.ch);if(c){UI.eatMsg=c.join(' · ');resave();render()}},
    geats(i){const c=E.gwEatStash(G.ch,+i);if(c){UI.eatMsg=c.join(' · ');resave();render()}},
    gkeep(){E.resolveGear(G.ch,0,false);resave();render()},
    otake(to){if(E.takeOffer(G.ch,0,to)){UI.swap=false;resave();render()}},
    oswapmode(){UI.swap=!UI.swap;render()},
    oswap(j){if(E.takeOffer(G.ch,0,'swap',j)){UI.swap=false;resave();render()}},
    pkpick(i){if(E.pickTake(G.ch,+i)){UI.swap=false;resave();render()}},
    pkskip(){if(E.pickSkip(G.ch)){resave();render()}},
    odrop(){if(E.dropOffer(G.ch,0)){UI.swap=false;resave();render()}},
    dout(i){UI.dropAsk=null;if(E.deckOut(G.ch,+i)){resave();render()}},
    din(i){UI.dropAsk=null;if(E.deckIn(G.ch,+i)){resave();render()}},
    sdrop(i){i=+i;if(UI.dropAsk!==i){UI.dropAsk=i;render();return}UI.dropAsk=null;if(E.sideDrop(G.ch,i)){resave();render()}},
    cfk(k){(UI.cf=UI.cf||{}).k=k;render()},
    cfs(k){(UI.cf=UI.cf||{}).s=k;render()},
    cfw(k){const f=UI.cf=UI.cf||{};f.kw=f.kw===k?null:k;render()},
    aid(id){if(E.buyAid(G.ch,id))render()},
    mindcare(){if((UI.mindHealed||0)>=CFG.clinic.mindMaxBuy)return;const g=E.buyMind(G.ch);if(g){UI.mindHealed=(UI.mindHealed||0)+1;UI.mindMsg=`정신력 +${g}`;resave();render()}},
    heal(){if((UI.healed||0)>=CFG.clinic.max)return;const h=E.buyHeal(G.ch);if(h){UI.healed=(UI.healed||0)+1;UI.healMsg=`HP +${h}`;resave();render()}},
    ample(){if(E.buyAmple(G.ch)){resave();render()}},
    enchant(sl){const r=E.enchant(G.ch,sl);if(r){UI.enchMsg=`${r.item.baseN}에 ${r.eff.n}의 효과를 새겼다 (${r.eff.type} · ${r.eff.e}) · ${E.money(r.price)}`;resave();render()}},
    repairhull(){if(E.repairHull(G.ch)){resave();render()}},
    buysupply(id){if(E.buySupply(G.ch,id)){resave();render()}},
    usesupply(id){const m=E.useSupply(G.ch,id,null);UI.supMsg=m||'지금은 쓸 데가 없다.';if(m)resave();render()},
    csupply(id){const m=E.useSupply(G.ch,id,C);if(!m)return;C.log.push({t:'kw',s:`${C.P.name} · ${m}`});resave();render()},
    box(t){if(UI.boxDone)return;const c=E.cardBox(G.ch,t);if(c){UI.boxDone=Array.isArray(c)?`상자에서 카드 ${c.length}장이 나왔다. 하나를 고른다.`:'상자에서 카드가 나왔다.';render()}},
    unshop(){UI.buyAsk=null;saveGame({st:UI.curSt,stock:[],shopDone:true});UI.screen='event';render()},
    omen(i){
      const st=E.answerOmen(G,UI.omen,i==='1');saveGame({st,stock:[],shopDone:true});
      const m=UI.omen.omen;UI.omen=null;UI.fight=st.enemy;UI.enc=st.enc;UI.avoidText=st.avoided?m.awayT:null;render();
    },
    choose(i){
      G.ch.rollFx=null;   /* 지난 판정(저장돼 남은 것)이 엉뚱한 사건 결과 때 다시 재생되지 않게, 이번 선택에서 새로 생긴 것만 남긴다 */
      const ev0=UI.ev,r=E.choose(G,UI.ev,+i);syncTitles();
      if(ev0&&ev0.voices&&r&&r.t){const vb=G.ch.voiceBias;if(vb==='good'&&ev0.tGood)r.t=ev0.tGood;else if(vb==='bad'&&ev0.tBad)r.t=ev0.tBad}
      {const un=checkInnateUnlock();if(un.length)r.chips=[...(r.chips||[]),`타고난 것 해금 · ${un.join(', ')} (이제 태어날 때 1%로 나온다)`]}
      UI.pending=r.combat;saveGame({after:true,pending:UI.pending});
      UI.res=Object.assign(r,{anim:!!r.roll&&MODE!=='off'});
      UI.screen='result';
      {const rf=G.ch.rollFx;if(rf&&rf!==UI.rollSeen){UI.rollSeen=rf;rollFx(rf).then(render);return}}
      render();
    },
    grow(i){const ch=G.ch;E.applyGrowth(ch,ch.lvOpts[+i].g.fx);ch.lvPend--;ch.lvOpts=null;flow()},
    pick(i){i=+i;const at=UI.sel.indexOf(i);if(at>=0){UI.sel.splice(at,1);
        /* 빛 회복 카드를 빼서 빛이 모자라면 뒤에 고른 카드부터 뺀다 */
        const H=C.P.hand,net=()=>UI.sel.reduce((a,j)=>a+E.cardCost(C.P,D.cards[H[j]])-(D.cards[H[j]].gain||0),0);while(UI.sel.length&&net()>C.P.light)UI.sel.pop()}
      else UI.sel.push(i);render()},
    go(){
      const pp=UI.sel.map(i=>D.cards[C.P.hand[i]]);
      const lb=C.log.length;PRE=E.snap(C);UI.lastPP=pp;
      E.resolveRound(C,pp,C.ePlan);UI.sel=[];
      if(C.over==='lose')store.del(SAVE);
      if(MODE==='off'){if(!C.over)E.newRound(C);render();return}
      C.logBefore=lb;PLAYING=true;render();if(isMobile())window.scrollTo(0,0);runPlayback(C.evs);
    },
    flee(){
      if(!C||C.over||UI.screen!=='combat')return;
      UI.paused=false;const r=E.fleeCheck(C);if(!r)return;
      if(r.ok){UI.sel=[];render();return}
      UI.sel=[];ACT.go()
    },
    finflee(){
      const r=E.fleeEnd(G,C);UI.res={t:r.text,chips:r.chips,title:null,roll:null};saveGame({after:true,pending:null});UI.screen='result';render()
    },
    tri(k){if(E.setTri(C,k))render()},
    form(k){if(E.setForm(C,k))render()},
    skip(){SKIP=true;if(wake)wake();if(tapWake)tapWake()},
    tap(){if(tapWake)tapWake()},
    fin(){
      if(C.over==='lose')checkInnateUnlock();
      if(C.over==='lose'){UI.outEnd=null;UI.outerEnd=false;UI.endWin=false;UI.trueEnd=false;UI.death=G.ch.mindDead?{year:G.year,foe:'정신 붕괴',cause:'mind'}:{year:G.year,id:C.id,foe:D.enemies[C.id].n,hidden:!!D.enemies[C.id].hidden,hunt:C.id==='kid_hunt'?G.ch.kidFoe:null};recordEnd();UI.screen='end';render();return}
      const r=E.winRewards(G,C);syncTitles();recAdd('beaten',C.id);const unl=checkInnateUnlock();
      {const q=G.ch.fightQ;if(q&&q.length){UI.pending=q.shift();(r.chips=r.chips||[]).push(`연전 · 다음 상대가 온다 (남은 ${q.length+1}번)`)}else if(q)delete G.ch.fightQ}
      saveGame({after:true,pending:UI.pending||null});
      if(r.unlock)addUnlock(r.unlock);
      if(r.endText)UI.endText=r.endText;
      UI.res={t:`${r.hidden?r.endText:C.E.name+'이(가) 물러난 자리에서 쓸 만한 것을 얻었다.'}${r.newly?' 소문이 돌아 이름이 '+T.licensed+' 명부에 올랐다.':''}${r.colorRoll?(r.colorRoll.ok?' 도시가 당신의 색을 기억하기 시작했다.':' 아직 도시는 당신의 색을 부르지 않는다.'):''}`,chips:r.chips,roll:r.colorRoll,anim:!!r.colorRoll&&MODE!=='off',title:r.title,tlabel:r.tlabel};
      if(unl.length&&UI.res)UI.res.chips=[...(UI.res.chips||[]),`타고난 것 해금 · ${unl.join(', ')} (이제 태어날 때 1%로 나온다)`];
      UI.screen='result';render();
    },
    sim(){SIM=E.simulate(200);UI.screen='sim';render()}
  };
  /* 시드: 브라우저 암호 난수로 새로 뽑는다. 같은 시드면 같은 출생과 같은 굴림 */
  /* 자동 전투 간격: [카드 고르기 전, 행동 개시 전] ms */
  const autoGap=()=>AUTOGAP==='slow'?[1600,1100]:AUTOGAP==='fast'?[150,150]:AUTOGAP==='mid'?[600,500]:[1000,800];
  function newSeed(){try{return crypto.getRandomValues(new Uint32Array(1))[0]%1000000000}catch(e){return Math.floor(Math.random()*1e9)}}
  /* 오늘의 시드와 같은 시드(지나간 날의 시드를 번호로 입력한 경우 포함)면 그날의 출신·타고난 것 지정을 그대로 쓴다 */
  const dailyKeyOf=seed=>UI.daily&&seed===dailySeed(UI.daily)?UI.daily:(Object.keys(CFG.dailyPlan||{}).find(k=>dailySeed(k)===seed)||null);
  function born(seed,name,daily){UI.team=null;const dk=daily?UI.daily:dailyKeyOf(seed),dly=!!dk;E.reseed(seed);const pl=dly&&CFG.dailyPlan[dk];BC=E.newChar(UI.job&&loadUnlocks().includes(UI.job)?UI.job:null,dly?(pl&&pl.origin)||CFG.dailyOrigin:(UI.origin&&loadUnlocks().includes('origin:'+UI.origin)?UI.origin:null));UI.newOrigin=null;if(pl&&pl.innate&&D.innate[pl.innate])BC.innate=pl.innate;if(pl&&pl.innate2&&pl.innate2!==pl.innate&&D.innate[pl.innate2])BC.innate2=pl.innate2;BC.seed=seed;BC.name=name||'';BC.fresh=true}
  /* 화면 폭이 휴대폰/PC 경계를 넘으면 전투 화면을 다시 그린다 (재생 중에는 그대로) */
  window.addEventListener('resize',()=>{if(UI.screen==='combat'&&!PLAYING&&UI.wasMobile!==isMobile())render()});
  app.addEventListener('toggle',e=>{const t=e.target;if(!t.classList)return;
    if(t.classList.contains('logbox')&&t.querySelector('#log'))UI.logOpen=t.open;
    if(t.classList.contains('roundbox'))UI.roundOpen=t.open;
    if(t.classList.contains('inv'))UI.invOpen=t.open;
    if(t.classList.contains('bhelp'))UI.helpOpen=t.open;
    if(t.classList.contains('stsec')&&t.dataset.k){UI.stOpen=UI.stOpen||{};UI.stOpen[t.dataset.k]=t.open}},true);
  /* 휴대폰 키보드의 이동·완료(Enter)로도 시드 적용 */
  app.addEventListener('change',e=>{if(e.target.id!=='xfileIn')return;const f=e.target.files&&e.target.files[0];if(!f)return;const r=new FileReader();r.onload=()=>{UI.xask=null;xApply(String(r.result||''))};r.readAsText(f)});
  app.addEventListener('input',e=>{if(e.target.id==='cuname'){(UI.cu=UI.cu||{name:'',atk:0,eva:0,hp:0,pas:null}).name=e.target.value}});
  app.addEventListener('input',e=>{if(e.target.id!=='bgmRange'&&e.target.id!=='bgmQuick')return;const v=Math.max(0,Math.min(100,+e.target.value||0));BGM.setVol(v/100);for(const id of ['bgmPct','bgmQuickPct']){const l=document.getElementById(id);if(l)l.textContent=v+'%'}});
  app.addEventListener('input',e=>{if(e.target.id!=='sfxRange')return;const v=Math.max(0,Math.min(100,+e.target.value||0));SFXS.vol=v/100;const l=document.getElementById('sfxPct');if(l)l.textContent=v+'%'});
  app.addEventListener('change',e=>{if(e.target.id==='shTitle'&&G&&G.ch){UI.shareTitle=e.target.value;UI.shareTitleFor=G.ch.seed;UI.shareText=UI.shareMsg=UI.imgUrl=null;render()}});
  app.addEventListener('change',e=>{if(e.target.id==='sfxRange'){sfxSave();SFX.play('hit')}});
  app.addEventListener('change',e=>{if(e.target.id==='bgmRange'||e.target.id==='bgmQuick'){bgmSave();if(e.target.id==='bgmQuick')render()}});
  document.addEventListener('pointerdown',e=>{if(UI.volOpen&&!e.target.closest('.volbox')){UI.volOpen=false;const p=document.querySelector('.volpop');if(p)p.remove()}});
  app.addEventListener('keydown',e=>{if(e.target.id==='seedIn'&&e.key==='Enter'){e.preventDefault();e.target.blur();ACT.seed()}});
  app.addEventListener('input',e=>{if(e.target.id==='nm'&&BC)BC.name=e.target.value.trim().slice(0,12);
    if(e.target.id==='cardq'){(UI.cf=UI.cf||{}).q=e.target.value.trim();const l=$('cardlist');if(l)l.innerHTML=cardListHtml()}});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&UI.bag){UI.bag=null;render()}});
  app.addEventListener('click',e=>{
    const b=e.target.closest('[data-a]');
    if(!b||b.disabled||PLAYING&&!['skip','tap','fightmode','qbgm','qstyle','qvol','qsfx','bartog'].includes(b.dataset.a))return;
    ACT[b.dataset.a](b.dataset.i,b);
  });
  /* 공유된 기록 링크로 열었으면 그 기록부터 보여 준다 */
  try{const h=location.hash||'';if(/#r=/.test(h)){const r=b64d(/#r=([\w-]+)/.exec(h)[1]);if(r&&r.s!=null){UI.shared=r;UI.screen='shared'}}
    else if(/#[ac]=/.test(h))readShared(h).then(r=>{if(r&&r.s!=null){UI.shared=r;UI.screen='shared';render()}}).catch(()=>{})}catch(e){}
  render();
  /* 자동 테스트용 상태 조회 */
  return {state:()=>({screen:UI.screen,year:G&&G.year,endWin:UI.endWin,lv:G&&G.ch.lv,aff:G&&G.ch.aff,fi:G&&G.ch.fi,pp:G&&G.ch.pp,fr:G&&G.ch.fr&&G.ch.fr.n,hp:G&&G.ch.hp,dead:!!(UI.death),art:G&&G.ch.art&&G.ch.art.ring}),
    /* 자동 테스트용: 진행 중인 게임에서 지정한 적과 바로 싸운다 (적 HP를 낮출 수 있다) */
    testCard:()=>ACT.testCard(),testBgm:()=>BGM.debug(),testBgmLevel:()=>BGM.level(),testBgmScene:k=>BGM.setScene(k),testBgmStyle:k=>BGM.setStyle(k),testBgmStage:n=>BGM.setStage(n),testWfxWs:(h,r)=>{const sv=C;C={P:{},ch:{wsRelic:Object.fromEntries(Array.from({length:r||0},(_,i)=>['r'+i,true]))}};const o=weaponFx('ws_weapon',{},true,{wsH:h});C=sv;return o},testWfx:(id,form,note)=>{const sv=C;C={P:{form},ch:{}};const r=weaponFx(id,{note:note||'장갑 1d9 3'},true);C=sv;return r},testInfNote:y=>{if(G)G.year=y||300;showInfNote(G?infNote():D.infinite.notes[2][3])},testBgmPos:()=>BGM.pos(),testBgmVol:v=>BGM.setVol(v),testTitles:a=>ACT.testTitles(a),
    testShareLink:()=>shareLinkAsync(),testShareLinkOld:()=>shareLink(),
    testDistort(){if(!G)return;UI.ev=D.mindEvents.distort;UI.fight=null;UI.omen=null;UI.screen='event';render()},
    testMind(n){if(!G)return;G.ch.mind=n+1;E.loseMind(G.ch,1);render()},
    testEgoPick(){if(!G)return;G.ch.egoPick=true;UI.res=UI.res||{chips:[],t:''};UI.res.chips=UI.res.chips||[];UI.screen='result';render()},
    testRouteEnd(k,act2){if(!G)return;G.endless=!!act2;G.year=G.ch.year=act2?66:CFG.years;UI.endWin=true;UI.trueEnd=false;UI.oldEnd=false;UI.rbEnd=k==='rcorp';UI.hwEnd=k==='rcorp'?null:(k||'hwhost');UI.death=null;UI.screen='end';render()},
    testWin(){if(!G)return;G.year=G.ch.year=CFG.years;UI.endWin=true;UI.trueEnd=false;UI.death=null;UI.screen='end';render()},
    testCrowEnd(k){if(!G)return;G.endless=true;G.ch.year=G.year=73;UI.endWin=true;UI.trueEnd=false;UI.oldEnd=false;UI.rbEnd=false;UI.hwEnd=null;UI.crowEnd=k;UI.death=null;UI.screen='end';render()},
    testRec(){if(!G)return;recordEnd();render()},
    testDeath(y,foe,hunt){if(!G)return;G.year=G.ch.year=y;UI.endWin=false;UI.trueEnd=false;UI.death={year:y,foe,hidden:false,hunt:hunt||null};UI.screen='end';render()},
    testOut(k){if(!G)return;G.infinite=true;G.year=G.ch.year=80;UI.endWin=true;UI.trueEnd=false;UI.oldEnd=false;UI.outerEnd=false;UI.outEnd=k;UI.death=null;UI.screen='end';render()},
    testTitles(a){if(G)G.ch.titles=a},
    testRoll(r,th,ok,at){rollFx({r:r||38,th:th||50,ok:ok!==false&&(r||38)<=(th||50),at:at==null?1:at});return true},
    testVoice(mind){if(!G)return null;G.ch.mind=mind||6;UI.ev=D.mindEvents.voice;UI.voicePlay=null;UI.voiceSeen=null;UI.voicePicked=null;G.ch.voiceBias=null;UI.screen='event';render();return true},
    testEgo(L){if(!G||!E.egoItem)return null;const c=G.ch,w=c.gear.weapon;if(!w)return null;const it=E.egoItem(w.id,L);E.equip(c,it);E.egoDeck(c,w.id,L,true);c.egoUses=[0,5,15,30][L];render();return c.deck.length},
    async testCard(){if(!G)return null;const cv=await endCard();return cv.toDataURL('image/png')},
    testPatch(o){if(!G)return;Object.assign(G.ch,o);render()},
    testG(o){if(!G)return;Object.assign(G,o);render()},
    testOverflow(){if(!G)return;G.infinite=true;G.endless=true;G.ch.infinite=true;G.year=G.ch.year=984;UI.endWin=true;UI.trueEnd=false;UI.oldEnd=false;UI.outEnd=null;UI.outerEnd=false;UI.overflowEnd=true;UI.death=null;UI.screen='end';render()},
    testInfLake(n){if(!G)return null;const c=G.ch,X=CFG.endless,be=CFG.years+X.span*X.grades.length,out={};G.infinite=true;c.infinite=true;c.infIntro=1;c.flags=c.flags||{};c.flags.lake=1;c.lake=c.lake||{};c.lake.captain=true;
      for(let i=0;i<(n||300);i++){G.year=c.year=be+1+i;c.hp=c.stats.maxHp;c.mind=E.mindMax(c);try{const st=E.advanceYear(G);const k=st.type==='omen'?'omen:'+st.boss+(st.echo?'(echo)':''):st.type==='fight'?'fight:'+st.enemy:st.type;out[k]=(out[k]||0)+1}catch(e){out['ERR '+e.message]=(out['ERR '+e.message]||0)+1}}try{E.answerOmen(G,{boss:'hongwon',rift:true,escape:true,spec:'table:late'},true);out._intro=D.enemies.hongwon.intro}catch(e){out._intro='ERR '+e.message}return out},
    testWsMat(){if(!G)return;const c=G.ch;c.aff={type:'workshop',name:'공방 해결사'};c.gear.weapon={id:'ws_weapon',slot:'weapon',n:'녹슨 쇠의 칼',e:'공+9',fx:{atk:9}};c.gear.armor={id:'ws_armor',slot:'armor',n:'두꺼운 가죽 갑',e:'',fx:{}};E.wsOpen&&E.wsEnsure(c);c.stash=[{id:'t1',slot:'weapon',n:'낡은 단검',grade:1,e:'공+2'},{id:'t3',slot:'weapon',n:'강철 장검',grade:3,e:'공+9'},{id:'t4',slot:'weapon',n:'명가의 검',grade:4,e:'공+16'},{id:'h1',slot:'weapon',n:'히든 전리품 검',grade:5,e:'공+30'}];UI.wsMsg=null;UI.screen='shop';render();return true},
    testKin(by){if(!G)return;const c=G.ch;c.bond={st:'lost',route:'office',name:'하나',variant:0,kids:[],dieBy:by||'age',dieYear:44,step:2,tries:1,love:2,since:20};return true},
    testEnd(y,t,o){if(!G)return;G.year=G.ch.year=y||CFG.years;UI.endWin=true;UI.trueEnd=!!t;UI.oldEnd=!!o;UI.death=null;UI.screen='end';render()},
    testFight(id,hp,php,sink){if(!G)return;startCombat(id);if(hp)C.E.hp=hp;if(php){C.P.hp=C.P.maxHp=php}if(sink){C.E.sink=sink;C.P.sink=sink}render()},
    /* 자동 테스트용: 특색 심사 통과 직후 화면 */
    testColor(){if(!G)return;G.ch.licensed=true;G.ch.rank=1;const r=E.applyFx(G.ch,{colorPass:true});UI.res={t:'심사 통과',chips:r.chips,roll:null};UI.screen='result';render()},
    testBond(k,kids,dist){if(!G)return;const c=G.ch;c.aff=c.aff||{type:'office',name:'윤 사무소'};
      c.bond={st:k,route:c.aff.type==='office'?'office':c.aff.type,name:k==='pick'?'':'하나',step:2,tries:1,love:2,since:G.year,saved:false};if(k==='pick')c.bondPick=true;if(kids)c.bond.kids=[{n:'하늘',born:G.year-23,job:'assoc',told:true},{n:'이슬',born:G.year-4,job:'fixer',told:false}];if(dist)c.distForm={n:'이름 없는 뒤틀림'};UI.res={t:'인연 시험',chips:[]};UI.screen='result';render()},
    testPick(k,v){if(!G)return;G.ch[k]=k==='orgPick'?(v||'wing'):true;if(k==='singPick'){G.ch.corp=G.ch.corp||{st:'dev',stack:0}}if(k==='wingPick'){G.ch.corp=G.ch.corp||{st:'dev',stack:0,n:'ゼロ'}}if(k==='titlePick'){G.ch.licensed=true;G.ch.rank=5;G.ch.title=D.colors[G.ch.ci].adj+' 임시'}if(k==='officePick'){G.ch.licensed=true;G.ch.rank=5}UI.res={t:'이름 시험',chips:[]};UI.screen='result';render()},
    testMoney(n){if(G){G.ch.money=n;render()}},
    testCh(f){if(G&&typeof f==='function'){f(G.ch);render()}},
    testForm(assoc){if(!G)return;const dr=D.enemies.violet.drop;E.equip(G.ch,structuredClone(dr.gear));G.ch.deck=dr.cards.slice();G.ch.deckLocked=true;if(assoc)G.ch.aff={type:'assoc',name:'하나 협회'};startCombat('thug');C.E.hp=400;C.E.maxHp=400;render()},
    testWs(yrs){if(!G)return;const c=G.ch;c.licensed=true;c.rank=5;c.aff={type:'workshop',name:'공방 해결사'};c.year=G.year=yrs||14;E.wsEnsure(c);c.stash=(c.stash||[]).concat([{id:'club',slot:'weapon',n:'무거운 쇠몽둥이',grade:1,e:'공+1',fx:{}},{id:'h_w',slot:'weapon',n:'히든 시험 무기',grade:5,e:'공+14',fx:{}},{id:'leather',slot:'armor',n:'덧댄 가죽옷',grade:1,e:'HP+6',fx:{}},{id:'rustpart',slot:'aug',n:'녹슨 특이점 부품',grade:5,e:'시험',fx:{}}]);UI.screen='shop';render()},
    testShop(){if(!G)return;G.ch.money=5000;G.ch.hp=Math.floor(G.ch.stats.maxHp/2);UI.stock=Object.keys(D.special).slice(0,2);UI.cardBox=true;UI.aid=true;UI.swapped=null;UI.tuneMsg=null;UI.bought=null;UI.deleted=null;UI.sold=null;UI.rested=null;UI.broker=null;UI.screen='shop';render()},
    /* 6시즌 자동 테스트: 사무소 개설 화면, 사건 바로 보기, 사무소 알선 */
    testBirthRoll(n){if(!BC)return;E.reseed(BC.seed);let c;for(let i=0;i<20000;i++){c=E.newChar();if(c.r.o===n)break}c.seed=BC.seed;c.name=BC.name;BC=c;BC.fresh=false;render()},
    testRelic(k){if(!G)return;E.giveRelic(G.ch,k,true);UI.res={t:'유물',chips:[]};UI.screen='result';render()},
    testArt(n){if(!G)return;G.ch.artSense=n;render()},
    testAff(type,name){if(!G)return;G.ch.aff={type,name};const r=D.careers[type]&&D.careers[type].cards&&D.careers[type].cards[name];if(r){G.ch.deck=r.flat().concat(G.ch.deck.filter(id=>D.cards[id].fixed));G.ch.assocName=name;G.ch.cardMoney=true}render()},
    testPack(){if(!G)return;UI.res=UI.res||{t:'시험',chips:[]};G.ch.packOffer={n:'시험 책장',cards:['slash','thrust','guard','hc_1'],relic:'시험 책장'};render()},
    testStash(){if(!G)return;for(const id of ['club','sword','greatsword'])G.ch.stash.push(Object.assign({id},D.items[id]));G.ch.stash.push(Object.assign({id:'x',grade:5,slot:'aug',n:'시험용 유물',e:'',fx:{}}));render()},
    testOffice(){if(!G)return;G.ch.licensed=true;G.ch.rank=5;G.ch.officePick=true;UI.res={t:'사무소 개설',chips:[]};UI.screen='result';render()},
    testPill(){if(!G)return;G.ch.pillPick=true;UI.res={t:'붕대 사이에서 작은 환이 나왔다.',chips:['특수환 · 능력치 하나를 골라 +10 (영구)','전리품 · 붉은 붕대 (HP+20, 영구)']};UI.screen='result';render()},
    testBreak(){if(!G)return;G.ch.mind=1;startCombat('thug');E.loseMind(G.ch,99,()=>{});render()},
    testName(k){if(!G)return;G.ch.namePend=k;if(k==='ego'){G.ch.ego={type:'atk',n:''};G.ch.relics=[...(G.ch.relics||[]),'E.G.O · ']}else{G.ch.distForm={n:'이름 없는 뒤틀림'}}UI.res={t:'적의 잔해 속에서 쓸 만한 것을 주웠다.',chips:['전투 중 정신력 0 · '+(k==='ego'?'E.G.O 개화':'육신이 뒤틀렸다')+' · 이름을 정한다']};UI.screen='result';render()},
    testApoc(){if(!G)return;const g=Object.assign({grade:5},structuredClone(D.enemies.apocalypse.drop.gear));G.ch.gearOffers=[g];UI.res={t:'종말이 쓰러졌다.',chips:['종말의 예언 · 검은 숲 깊은 곳에서 무언가 눈을 뜬다']};UI.screen='result';render()},
    testChain(){if(!G)return;G.ch.aff={type:'wing',name:'K사 날개'};G.ch.year=G.year=45;G.ch.corp={st:'wing',type:'serum',n:'시험',stack:2,up:3,forb:2,wing:'새벽 날개',chain:['claw','arbiter'],next:99};UI.ev=D.corp.head;UI.fight=null;UI.omen=null;UI.screen='event';render()},
    testCorp(k){if(!G)return;G.ch.aff={type:'wing',name:'K사 날개'};G.ch.year=G.year=22;if(!G.ch.corp)G.ch.corp={st:'offer'};UI.ev=D.corp[k];UI.fight=null;UI.omen=null;UI.screen='event';render()},
    testHint(e){noteHint(e)},
    testRecordEnd(){recordEnd()},
    testCent(n){if(!G)return;G.infinite=true;G.endless=true;G.ch.infinite=true;G.ch.infIntro=1;G.ch.infCent=Array.from({length:n-1},(_,i)=>i+1);G.year=G.ch.year=n*100-16;const ev=E.infiniteEvent(G);if(!ev)return;UI.ev=ev;UI.fight=null;UI.omen=null;UI.screen='event';render()},
    testEvent(k,lic){if(!G)return;G.ch.licensed=lic!==false;G.ch.rank=G.ch.rank||9;UI.ev=D[k];UI.fight=null;UI.omen=null;UI.screen='event';render()},
    testShip(mode){if(!G)return;const c=G.ch;c.flags=c.flags||{};c.flags.lake=1;c.lake={captain:true,hull:63,crew:[{role:'cook',n:'요리사'},{role:'navigator',n:'항해사'}],seen:7,killed:[],wave:mode==='wave'?{i:1,max:4}:null};c.money=2000;if(mode==='anchor')c.flags.lkL_anchor=1;if(mode==='nocap')c.lake.captain=false;
      if(mode==='wave'){UI.ev=E.waveEv(c,c.lake);UI.fight=null;UI.omen=null;UI.screen='event'}
      else if(mode==='hunt'){c.lake.captain=true;c.lake.whaleTarget='lake_whale_anchor';UI.ev=D.lake.hunt;UI.fight=null;UI.omen=null;UI.screen='event'}
      else if(mode==='inf'){G.infinite=true;c.infinite=true;c.infBoost=3;c.infShard=2;c.famLoss=1;c.limDmg=0.08;c.limStrike=0.01;c.legacyTier=5;c.legacyPts=12;c.year=G.year=300;UI.bag='stat';UI.screen='event';UI.ev=D.lake.indigo}
      else if(mode==='limit'){G.infinite=true;c.infinite=true;c.infIntro=1;c.limAt=1;c.lake.crew=[];UI.ev=E.infiniteEvent(G);UI.fight=null;UI.omen=null;UI.screen='event'}
      else if(mode==='morph'){G.infinite=true;c.infinite=true;c.infIntro=1;c.limAt=9999;c.lake.morphAt=1;c.lake.crew[0].mo=3;UI.ev=E.infiniteEvent(G);UI.fight=null;UI.omen=null;UI.screen='event'}
      else if(mode==='indigo'){c.lake.killed=['lake_whale_silence','lake_whale_lamp'];c.lake.phase='enter';UI.ev=D.lake.indigo;UI.fight=null;UI.omen=null;UI.screen='event'}
      else if(mode==='shop'){UI.stock=[];UI.bought=null;UI.screen='shop'}
      else{UI.bag='stat';UI.screen='event';UI.ev=D.hunter||UI.ev}
      render()},
    testEvT(t){if(!G)return;const ev=D.events.find(e=>e.t===t);if(!ev)return;G.ch.licensed=true;G.ch.rank=G.ch.rank||9;UI.ev=ev;UI.fight=null;UI.omen=null;UI.screen='event';render()},
    testPreFight(id){if(!G||!D.enemies[id])return;UI.fight=id;UI.enc=null;UI.omen=null;UI.ev=null;UI.screen='event';render()},
    testShopAsk(){if(!G)return;UI.stock=[];UI.screen='shopask';render()},
    testBroker(){if(!G)return;UI.stock=[];UI.broker=E.officeBroker(G.ch);UI.screen='shopask';render()},
    testOrigin(n){if(!BC)return;const o=D.origins.find(x=>x.n===n);if(!o)return;E.reseed(BC.seed);let c;for(let i=0;i<5000;i++){c=E.newChar();if(c.o.n===n)break}c.seed=BC.seed;c.name=BC.name;BC=c;render()},
    testOmen(id){if(!G)return;const h=D.hiddenBosses.find(x=>x.id===id);UI.omen={type:'omen',boss:id,omen:h.omen||{},escape:!h.noEscape,spec:'table:early'};UI.screen='event';render()}};
}

/* 조사 자동 선택: 문구에 이(가)·은(는)·을(를)·과(와)로 적어 두면 화면에 나올 때 앞 글자의 받침을 보고 알맞은 쪽으로 바꾼다 */
if(typeof document!=='undefined'&&typeof MutationObserver!=='undefined'){
  const JO={'이(가)':['이','가'],'은(는)':['은','는'],'을(를)':['을','를'],'과(와)':['과','와'],'와(과)':['과','와']},MARK=/(?:이\(가\)|은\(는\)|을\(를\)|[과와]\([와과]\))/;
  const hasBat=c=>{if(!c)return false;const k=c.charCodeAt(0);if(k>=0xAC00&&k<=0xD7A3)return (k-0xAC00)%28>0;if(/[0136-8]/.test(c))return true;return /[lmnrLMNR]/.test(c)};
  const tail=s=>s.replace(/\([^)]*\)\s*$/,'').replace(/[^가-힣A-Za-z0-9]+$/,'').slice(-1);
  const fixJosa=root=>{
    const w=document.createTreeWalker(root,NodeFilter.SHOW_TEXT),nodes=[];
    for(let n=w.nextNode();n;n=w.nextNode())nodes.push(n);
    nodes.forEach((n,i)=>{
      const v=n.nodeValue;if(!MARK.test(v))return;
      n.nodeValue=v.replace(new RegExp(MARK.source,'g'),(m,off)=>{
        let pre=v.slice(0,off),j=i;while(!tail(pre)&&j>0)pre=nodes[--j].nodeValue+pre;
        return JO[m][hasBat(tail(pre))?0:1]})});
  };
  let busy=false;
  new MutationObserver(ms=>{
    if(busy)return;busy=true;
    try{for(const m of ms){const t=m.type==='characterData'?m.target.parentNode:m.target;if(t&&t.nodeType===1&&MARK.test(t.textContent||''))fixJosa(t)}}finally{busy=false}
  }).observe(document.documentElement,{childList:true,subtree:true,characterData:true});
}
