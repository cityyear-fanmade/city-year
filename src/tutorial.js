/* 튜토리얼 v2: 안내자 앤젤라가 가상의 게임 화면을 보여 주며 게임이 흘러가는 방식을 설명한다.
   - 실제 게임 상태(G·E·기록)는 읽지도 쓰지도 않는다. 시연 숫자는 미리 정한 값이고, 규칙 수치는 CFG·카드 데이터에서 읽는다.
   - 장면(scene) 목록이 곧 튜토리얼이다. 장면을 더하거나 빼도 진행 표시와 이동은 그대로 동작한다.
   - 화면 모양은 실제 게임의 클래스(panel · card · btn · bar …)를 그대로 쓰고, 연출도 전투에서 쓰는 keyframes(wob · hurt · settle)를 부른다. */
export function createTutorial({CFG,D,esc,kindBadge,cardLine,sg,getName,getLang}){
  const NAME='앤젤라',DEFAULT_HERO='아인';   /* 시연 인물: 플레이어가 이름을 정해 두었으면 그 이름으로, 아니면 아인 */
  const POSE={basic:'01_basic',read:'02_reading',point:'03_pointing',happy:'04_happy',think:'05_thinking',surprise:'06_surprised',dice:'07_dice',card:'08_cards',guide:'09_presenting',idea:'10_considering',worry:'11_worried',bye:'12_closing'};
  const img=k=>(typeof window!=='undefined'&&window.CITY_TUT&&window.CITY_TUT[k])||`assets/tutorial/${k}.webp`;
  /* 조사: 받침이 있으면 앞 것, 없으면 뒤 것 (한글 글자와 숫자 모두) */
  const jong=w=>{const c=String(w).trim().slice(-1);if(/[0-9]/.test(c))return '013678'.includes(c);const k=c.charCodeAt(0)-0xAC00;return k>=0&&k<11172&&k%28!==0};
  const lg=()=>(getLang&&getLang())||'ko';   /* 한국어가 아닐 때는 조사를 붙이지 않고, 기본 인물 이름은 그 언어 이름으로 둔다 */
  const j=(w,a,b)=>lg()!=='ko'?'':jong(w)?a:b;
  /* 시연용 고정 값 (굴림은 난수가 아니라 미리 정한 값) */
  const V={hero:{atk:4,spd:3,eva:1,hp:60,chk:10},foe:{eva:3,spd:1,hp:12},ord:{me:62,foe:55},hit:{me:40,foe:45,dmg:4},chk:{dc:60,stat:10,ok:52,ng:41},ev:{age:CFG.startAge}};
  const dieHtml=(n,lbl)=>`<span class="tdie"><b>${n}</b>${lbl?`<i>${lbl}</i>`:''}</span>`;
  const demoCard=id=>{const c=D.cards[id];if(!c)return '';return `<div class="card tcard2"><span class="cost">${c.c}</span><span class="nm">${kindBadge(c)} ${esc(c.n)}</span><span class="cd">${esc(cardLine(c,null,null))}</span></div>`};
  const stage=(body,extra)=>`<div class="tut2-stage"><div class="tut2-bar"><b>가상의 게임 화면</b><span class="tut2-badge">시연 중</span></div><div class="tut2-body stack">${body}</div>${extra||''}</div>`;
  /* 큰 쪽 · 작은 쪽 비교: 두 값을 나란히 놓고 큰 쪽에 표시한다 */
  const vsHtml=(L,R,note)=>{const bg=L[1]>R[1],eq=L[1]===R[1],tag=(w)=>w?'<span class="small" style="color:var(--good)">큰 쪽</span>':'<span class="small dim">작은 쪽</span>';
    return `<div class="row" style="gap:12px;flex-wrap:wrap"><div class="stack" style="gap:6px;flex:1;align-items:center">${dieHtml(L[1],L[0])}${eq?'':tag(bg)}</div><div class="stack" style="gap:6px;flex:1;align-items:center">${dieHtml(R[1],R[0])}${eq?'':tag(!bg)}</div></div>${note?`<div class="tbox"><span>${note}</span></div>`:''}`};
  const pips=(n,max,plus)=>Array.from({length:max},(_,i)=>`<i class="tpip${i<n?' on':i<n+plus?' bonus':''}"></i>`).join('');

  /* 장면 목록: {id, pose, say:[문장…], screen:(st)=>html}. say는 말풍선에 한 문단씩 들어간다 */
  function scenes(){
    const nm=String((getName&&getName())||'').trim().slice(0,12),HERO=esc(nm||({ja:'アイン',en:'Ain'})[lg()]||DEFAULT_HERO),custom=!!nm;
    const L=CFG.light,LM=CFG.lightMax,B=CFG.orderBonusLight,H=CFG.hand,th=D.cards.thrust||{hit:10,n:'찌르기'},hitBonus=th.hit,age0=CFG.startAge;
    const hb=V.hero.spd*CFG.spdMul,fb=V.foe.spd*CFG.spdMul;
    const ordMe=V.ord.me+V.hero.spd*CFG.spdMul,ordFo=V.ord.foe+V.foe.spd*CFG.spdMul;
    const AR=CFG.atkRule||{on:false,hitPer:1,dmgPer:6},atkHit=AR.on?Math.trunc(V.hero.atk*AR.hitPer):V.hero.atk,my=V.hit.me+atkHit+hitBonus,fo=V.hit.foe+V.foe.eva;
    return [
      {id:'intro',pose:'basic',say:[`처음 보는 얼굴이네. 나는 ${NAME}, 이곳의 안내를 맡고 있어.`,`지금부터 보여 주는 건 실제 게임이 아니라 시연이야. 가상의 인물이 사건을 만나고 싸우는 모습을 같이 보자.`],
        screen:()=>stage(`<div class="panel stack"><span class="eyebrow">도시의 한 해</span><b class="serif">새로 태어난다</b><span class="small dim">주사위로 사람을 만들고, 그 사람의 일생을 살아 본다.</span></div><span class="tfake primary">새로 태어난다</span>`)},
      {id:'flow',pose:'guide',say:[`이 게임은 주사위로 사람 하나를 만들고, ${age0}세부터 ${CFG.years}년을 한 해씩 살아 보는 이야기야.`,`대부분은 글을 읽고 선택지를 고르는 일이고, 칼을 뽑아야 할 때만 카드를 써. HP가 0이 되면 거기서 끝이야.`],
        screen:()=>stage(`<div class="tflow"><span>출생</span><i>›</i><span>성장기</span><i>›</i><span>해마다 사건 1개</span><i>›</i><span>가끔 전투</span><i>›</i><span>완주 · 또는 쓰러짐</span></div><div class="tbox"><span>${age0}세부터 ${age0+CFG.years-1}세까지 <b>${CFG.years}년</b>을 버티면 완주다.</span></div>`)},
      {id:'birth',pose:'point',say:[custom?`태어날 때 출신, 재능, 결점, 무기를 주사위로 정해. 이번 시연은 네가 정한 이름 ${HERO}${j(nm,'으로','로')} 보여 줄게.`:`태어날 때 출신, 재능, 결점, 무기를 주사위로 정해. 이번 시연의 인물은 ${HERO}${j(HERO,'이야','야')}.`,`마음에 들지 않으면 다시 굴릴 수 있어. 이름을 적으면 그 이름으로 설명해 줄게.`],
        screen:st=>{const R=st.roll,lbl=['재능','결점','무기'];
          return stage(`<label class="field"><span class="eyebrow">이름 · 비워 두면 ${DEFAULT_HERO}</span><input id="tutnm" maxlength="12" value="${esc(nm)}" placeholder="${DEFAULT_HERO}" autocomplete="off"></label><div class="tbox"><b>${HERO}</b><span class="small dim">출신 · 둥지 노동자 · L사</span></div><div class="row" style="gap:10px;flex-wrap:wrap">${lbl.map((l,k)=>dieHtml(R?R[k]:'1d100',l)).join('')}</div><button class="btn" data-a="tutroll">${R?'다시 굴린다':'굴려 본다'}</button><span class="small dim">이름은 다음 설명으로 넘어가면 반영된다. 시연용이라 게임 기록에는 남지 않는다.</span>`)}},
      {id:'growth',pose:'happy',say:[`태어난 뒤에도 몇 번의 성장기를 지나. 그때마다 표를 굴려 능력치가 하나씩 오르는 거야.`],
        screen:()=>stage(`<div class="tflow"><span>5세</span><i>›</i><span>9세</span><i>›</i><span>13세</span><i>›</i><span>16세</span></div><div class="tbox"><span>성장기에는 <b>주사위를 굴려</b> 능력치가 하나씩 오른다.</span></div>`)},
      {id:'stats',pose:'point',say:[`능력치는 ${HERO}${j(HERO,'이','가')} 가진 기본 숫자야. 능력치마다 어떤 굴림에 더해지는지가 정해져 있어.`,`공격은 절반(소수점 버림)이 명중 굴림에 더해지고, ${AR.dmgPer}마다 피해도 1 늘어. 공격 ${AR.dmgPer}이면 피해 +1, ${AR.dmgPer*2}면 +2, ${AR.dmgPer*3}이면 +3이야. 회피는 상대의 명중을 막는 굴림에 더해져.`,`속도가 빠르면 먼저 움직이기 쉽고, 먼저 움직이면 빛을 더 받아. 상대보다 훨씬 빠르면 첫 공격의 명중도 올라가.`],
        screen:()=>stage(`<div class="tcalc"><div class="row between"><span>HP <span class="small dim">0이 되면 끝</span></span><b>${V.hero.hp}</b></div><div class="row between"><span>공격 <span class="small dim">명중에 ×${AR.hitPer}, ${AR.dmgPer}마다 피해 +1</span></span><b>${V.hero.atk}</b></div><div class="row between"><span>회피 <span class="small dim">상대의 명중을 막는 굴림에 더한다</span></span><b>${V.hero.eva}</b></div><div class="row between"><span>속도 <span class="small dim">빠를수록 먼저 움직이고 빛도 더 받는다</span></span><b>${V.hero.spd}</b></div></div><span class="small dim">${HERO}의 능력치 (시연용 예시 값)</span>`)},
      {id:'event',pose:'idea',say:[`해마다 사건이 하나 찾아와. 아래 선택지를 직접 눌러 봐.`,`고른 쪽에 따라 이야기가 달라져. 이게 이 게임의 중심이야.`],
        screen:st=>{const R=['의뢰를 받아들였다. 위험한 일이지만 사례는 넉넉했다.','의뢰를 거절했다. 수상한 사람은 말없이 골목으로 사라졌다.','상대를 관찰했다. 손끝이 가늘게 떨리고 있었다.'],P=st.pick;
          return stage(`<div class="panel stack"><span class="eyebrow">${age0}세 — 첫 번째 사건</span><p style="margin:0">한 사람이 길거리에서 수상한 의뢰를 받았다.</p></div>${['의뢰를 받아들인다','의뢰를 거절한다','상대를 관찰한다'].map((t,i)=>`<button class="btn${P===i?' primary':''}" data-a="tutpick" data-i="${i}"><b>${'①②③'[i]} ${t}</b></button>`).join('')}${P!=null?`<div class="tbox tsettle"><span>${R[P]}</span></div>`:'<span class="small dim">선택지를 눌러 보세요</span>'}`)}},
      {id:'check-ok',pose:'dice',say:[`위험한 선택에는 판정이 따라와. 주사위(1d100)를 굴려 내 능력치를 더한 값이, 난이도보다 크면 성공이야.`,`이번엔 내 값이 난이도보다 커.`],
        screen:()=>stage(vsHtml(['내 굴림',V.chk.ok+V.chk.stat],['난이도',V.chk.dc],`<b class="good">내 값이 더 크다 → 성공</b>`))},
      {id:'check-ng',pose:'worry',say:[`주사위가 낮게 나오면 내 값이 난이도보다 작아져. 그러면 실패하고, 체력을 잃거나 기회를 놓칠 수 있어.`],
        screen:()=>stage(vsHtml(['내 굴림',V.chk.ng+V.chk.stat],['난이도',V.chk.dc],`<b class="bad">내 값이 더 작다 → 실패</b>`))},
      {id:'hand',pose:'card',say:[`전투에서 하는 행동은 전부 카드야. 라운드마다 덱에서 ${H}장이 손패로 나와.`,`카드 왼쪽 동그라미 숫자는 코스트, 아래 줄은 주사위와 명중 보정이야.`],
        screen:()=>stage(`<div class="hand tut2-hand">${['slash','thrust','guard','smash'].slice(0,H).map(demoCard).join('')}</div><span class="small dim">손패 ${H}장 · 덱에서 무작위</span>`)},
      {id:'light',pose:'point',say:[`카드를 내려면 빛이 필요해. 라운드마다 빛은 ${L}이고, 먼저 움직이면 ${B} 더 받아. 최대 ${LM}까지야.`,`카드를 낼 때마다 그 카드의 코스트만큼 줄고, 남은 빛은 사라져.`],
        screen:()=>stage(`<div class="tbox"><span>빛</span><div class="tpips">${pips(L,LM,B)}</div><span class="small dim">기본 ${L} · 먼저 움직이면 +${B} · 최대 ${LM}</span></div>`)},
      {id:'order',pose:'dice',say:st=>st.pick==null?[`전투가 시작되면 "순서 1D100 + 속도×${CFG.spdMul}" 줄이 나와. 각자 "주사위 +속도 보너스 = 합계"로 보이고, 합계가 큰 쪽이 먼저 움직여.`,`${HERO}${j(HERO,'은','는')} 주사위 ${V.ord.me}에 속도 보너스 +${hb}, 상대는 주사위 ${V.ord.foe}에 보너스 +${fb}이야. 합계를 계산해서 누가 먼저 움직일지 골라 봐.`]:[`${st.pick===0?'맞아! ':'아쉽지만 '}${V.ord.me} +${hb} = ${ordMe}, ${V.ord.foe} +${fb} = ${ordFo}. 합계가 큰 ${HERO}${j(HERO,'이','가')} 먼저 움직여.`,`주사위는 운이지만 속도 보너스는 능력치에서 와. 속도가 빠를수록 보너스가 커서 먼저 움직이기 쉽고, 먼저 움직이면 "빛 +${B}"${j(B,'을','를')} 받아.`],
        screen:st=>{const P=st.pick;
          return stage(`<span class="eyebrow">순서 1D100 + 속도×${CFG.spdMul}</span><div class="ordline"><span class="ordx"><b style="color:var(--gold)">1. ${HERO}</b> <span class="mono small dim">${V.ord.me} +${hb} = ${P==null?'?':ordMe}</span>${P!=null?` <span class="chip">빛 +${B}</span>`:''}</span><span class="dim"> → </span><span class="ordx"><b style="color:#c0615a">2. 상대</b> <span class="mono small dim">${V.ord.foe} +${fb} = ${P==null?'?':ordFo}</span></span></div><button class="btn${P===0?' primary':''}" data-a="tutpick" data-i="0"><b>${HERO}${j(HERO,'이','가')} 먼저 움직인다</b></button><button class="btn${P===1?' primary':''}" data-a="tutpick" data-i="1"><b>상대가 먼저 움직인다</b></button>${P!=null?`<div class="tbox tsettle"><span>${P===0?'정답이야. 합계가 큰 쪽이 먼저 움직인다.':'정답은 '+HERO+'야. 합계가 큰 쪽이 먼저 움직인다.'}</span></div>`:'<span class="small dim">버튼을 눌러 보세요</span>'}`)}},
      {id:'hit',pose:'point',say:[`공격 카드를 내면 명중 판정이 나와. 내 명중값은 주사위에 내 공격 능력치와 카드 보정을 더한 값이야.`,`상대도 주사위에 회피 능력치를 더한 회피값을 굴려. 내 명중값이 더 크면 명중이고, 같으면 막는 쪽이 이겨.`],
        screen:()=>stage(vsHtml(['내 명중',my],['상대 회피',fo],`<b class="good">내 쪽이 더 크다 → 명중</b>`))},
      {id:'damage',pose:'happy',say:[`명중하면 카드의 주사위로 피해를 굴려. ${esc(th.n)}${j(th.n,'은','는')} 1d6이고, 이번엔 ${V.hit.dmg}${j(V.hit.dmg,'이','가')} 나왔어.`,`그래서 상대 HP가 ${V.hit.dmg}만큼 줄어. 주사위가 많은 카드일수록 코스트도 높아.`],
        screen:()=>stage(`<div class="tfoe tshake"><div class="row between"><b>상대</b><span class="mono small">HP ${V.foe.hp-V.hit.dmg}/${V.foe.hp}</span></div><div class="bar"><i class="thpfall" style="--to:${Math.round((V.foe.hp-V.hit.dmg)/V.foe.hp*100)}%"></i></div><span class="tfloat">−${V.hit.dmg}</span></div><div class="row" style="gap:10px">${dieHtml(V.hit.dmg,'1d6')}</div>`)},
      {id:'guard',pose:'worry',say:[`카드를 하나도 내지 않으면 방어 자세가 돼. 회피 대신 방어로 같은 굴림을 해서 피해를 줄여.`,`라운드가 끝나면 다시 ${H}장을 받고 시작해. 굴림이 번거로우면 '자동 전투로 바꾸기'가 카드를 알아서 골라 줘.`],
        screen:()=>stage(`<div class="tbox"><span>${demoCard('guard')}</span></div><span class="tfake">행동 개시</span><span class="tfake quiet">자동 전투로 바꾸기</span>`)},
      {id:'reward',pose:'idea',say:[`전투에서 이기면 체력을 조금 회복하고, 보상 카드와 경험치를 받아. 레벨이 오르면 성장표를 굴려 능력치를 하나 골라.`,`덱에 넣을 수 있는 장수에는 한도가 있어서, 어떤 카드를 넣을지 고르는 게 중요해.`],
        screen:()=>stage(`<span class="eyebrow">보상 카드 · 하나를 고른다</span><div class="hand tut2-hand">${['slash','thrust','guard'].map(demoCard).join('')}</div><span class="small dim">덱은 최대 ${CFG.deck.max}장까지</span>`)},
      {id:'record',pose:'read',say:[`${CFG.years}년을 버티면 완주야. 쓰러지면 거기서 끝이고, 끝난 판은 일대기에 남아.`,`기록실은 업적 같은 곳이야. 만난 적, 본 엔딩, 얻은 칭호가 쌓이고, 그 기록으로 새로운 출생과 꾸미기가 열리기도 해.`],
        screen:()=>stage(`<div class="tbox"><span>끝난 판의 이야기는 <b>일대기</b>에 남는다.</span></div><div class="tflow"><span>요약</span><span>칭호</span><span>인연</span><span>엔딩</span><span>히든 보스</span><span>출생·소속</span><span>심볼</span></div><div class="tbox"><span><b>기록실</b>에는 만난 적 · 엔딩 · 칭호 · 해금이 업적처럼 쌓인다. 이 시연은 어디에도 남지 않는다.</span></div>`)},
      {id:'bye',pose:'bye',say:[`처음에는 이기려 하지 말고 한 판을 끝까지 살아 보자. 막히면 화면 위쪽 ? 버튼에서 카드와 규칙을 다시 볼 수 있어.`,`시작 화면의 난이도 '쉬움'은 해마다 적이 강해지지 않아. 준비됐으면 이제 직접 해 보자.`],
        screen:()=>stage(`<div class="tbox"><b>시연 끝</b><span>카드 읽는 법 · 키워드 · 규칙은 위쪽 <b>?</b> 버튼에 있다.</span></div>`)}
    ];
  }

  /* 한 장면을 그린다. st={step,pick}. 말풍선·진행 표시·이동 버튼까지 만들어 돌려준다(이동은 ui.js의 tutgo / tutpick / tutclose) */
  function view(st){
    const only=typeof window!=='undefined'&&!!window.CITY_TUTONLY;   /* 미리보기에서는 끝내기가 처음부터 다시 보기라서 버튼 이름도 그렇게 쓴다 */
    const S=scenes(),n=S.length,i=Math.max(0,Math.min(n-1,st.step|0)),sc=S[i],last=i===n-1;
    return `<div class="tut2">
      <div class="tut2-top"><span class="eyebrow">시연 진행 ${i+1} / ${n}</span><div class="tut-dots" aria-hidden="true">${S.map((_,k)=>`<i class="${k===i?'on':k<i?'done':''}"></i>`).join('')}</div><button class="chip" data-a="tutclose">${only?'처음으로 ↺':'건너뛰기 ✕'}</button></div>
      ${sc.screen({pick:st.pick,roll:st.roll})}
      <div class="tut2-note">※ 실제 게임 데이터와 무관한 예시 화면</div>
      <div class="tut2-guide"><img class="tut2-pic" src="${img(POSE[sc.pose]||POSE.basic)}" alt="${NAME}" width="96"><div class="tut2-say"><b class="tut2-name">${NAME}</b>${(typeof sc.say==='function'?sc.say(st):sc.say).map(x=>`<p>${x}</p>`).join('')}</div></div>
      <div class="row tut-nav" style="gap:8px"><button class="btn quiet" style="flex:1" data-a="tutgo" data-i="${i-1}" ${i?'':'disabled'}>이전</button>${last?`<button class="btn primary" style="flex:1" data-a="tutclose">${only?'처음부터 다시 보기':'게임으로'}</button>`:`<button class="btn primary" style="flex:1" data-a="tutgo" data-i="${i+1}">다음 설명</button>`}</div>
    </div>`;
  }
  return {scenes,view,count:()=>scenes().length};
}
