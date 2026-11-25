/* 데이터 검사: npm run check
   1) 없는 카드·적·키워드 참조 찾기  2) 무작위 선택으로 게임을 끝까지 N판 돌려 오류가 없는지 본다 */
import {loadData,findDupKeys} from '../src/data-node.js';
import {validateData,createEngine,mulberry32} from '../src/engine.js';
const D=loadData(),err=[...findDupKeys(),...validateData(D)];
if(err.length){console.error('데이터 오류 '+err.length+'건:\n  '+err.join('\n  '));process.exit(1)}
console.log(`참조 검사 통과 · 카드 ${Object.keys(D.cards).length} · 적 ${Object.keys(D.enemies).length} · 사건 ${D.events.length} · 출신 ${D.origins.length}`);

const E=createEngine(D,{rng:mulberry32(42)}),reqErr=E.unknownReqs();
if(reqErr.length){console.error('조건(req) 오류 '+reqErr.length+'건:\n  '+reqErr.join('\n  '));process.exit(1)}
console.log('중복 키 · 조건 토큰 검사 통과');
const N=+(process.argv[2]||4000),byOrigin={},seen=new Set(),aff={},end={완주:0,사망:0},rank={},color={n:0},hb={},omen={go:0,away:0},top7={n:0},buys={1:0,2:0,3:0},access={1:0,2:0,3:0},wealth=[],fr={},pinky={n:0,combo:{}};
/* 예외 진단: 시뮬 중 예외가 나면 몇 번째 판 어느 단계인지 알려 준다. 진단용 기록(ctx)은 이 파일에서만 갱신하고 엔진은 건드리지 않는다.
   진단 코드는 자기 오류를 삼켜서 원래 예외를 가리지 않는다(원래 예외는 먼저 출력하고 다시 던진다) */
const ctx={g:0,step:'unknown',guard:'unknown',year:'unknown',ev:'unknown',enemy:'unknown',origin:'unknown'};
const fmt=v=>{try{return v==null?'unknown':String(v)}catch(_){return 'unknown'}};
const safe=f=>{try{return fmt(f())}catch(_){return 'unknown'}};
const line=f=>{try{console.error(f())}catch(_){}};   // 줄마다 따로 감싸서 한 줄이 실패해도 나머지와 원래 예외는 그대로 나온다
function diag(e){
  line(()=>`\n시뮬레이션 예외 · 원래 예외: ${e&&e.stack?e.stack:fmt(e)}`);
  line(()=>`  진행 중이던 판: ${ctx.g}번째 / ${N}판 · 단계 ${fmt(ctx.step)} · 반복 ${fmt(ctx.guard)} · 연도 ${fmt(ctx.year)} · 출신 ${fmt(ctx.origin)}`);
  line(()=>`  사건: ${fmt(ctx.ev)}`);
  line(()=>`  적: ${fmt(ctx.enemy)} (이름 ${safe(()=>D.enemies[ctx.enemy].n)})`);
  line(()=>'  (참고: 호수 파도 처리가 Math.random을 써서 같은 판이 그대로 재현되지 않을 수 있다)');
}
let played=0;
for(let g=0;g<N;g++){
  ctx.g=g+1;ctx.step='newGame';ctx.guard=ctx.year=ctx.ev=ctx.enemy=ctx.origin='unknown';
  try{
  const G=E.newGame(E.newChar());let pending=null;ctx.origin=safe(()=>G.ch.o.n);
  for(let guard=0;guard<2000;guard++){
    ctx.guard=guard;ctx.step='growth';ctx.enemy='unknown';   /* 반복마다 적 정보를 비우고, 실제 전투에 들어갈 때만 채운다 */
    while(G.ch.lvPend>0){const o=E.rollGrowth(G.ch);E.applyFx(G.ch,o[E.d(o.length)-1].g.fx);G.ch.lvPend--}
    let fight=pending;pending=null;
    if(!fight){
      /* 공방: 지금 그 칸 장비보다 비싼 물건 중 살 수 있는 가장 비싼 것 하나를 산다 */
      const cur=sl=>(G.ch.gear[sl]&&G.ch.gear[sl].price)||0;
      const can=Object.keys(D.items).filter(id=>E.canBuy(G.ch,id)==='ok'&&D.items[id].price>cur(D.items[id].slot)).sort((a,b)=>D.items[b].price-D.items[a].price);
      ctx.step='buy';
      if(can.length&&E.buy(G.ch,can[0]))buys[D.items[can[0]].grade]++;
      ctx.step='advanceYear';let st=E.advanceYear(G);{let q_=0;while(st&&st.type==='quiet'&&q_<400){q_++;st=E.advanceYear(G)}}   /* 시지프 백화점 안·밖의 조용한 해: 화면(nextYear)처럼 이어서 넘긴다 */ctx.year=G.year;ctx.ev=st.ev?st.ev.t:'('+st.type+')';
      if(st.type!=='end'&&G.year===7&&G.ch.licensed&&G.ch.rank<=3)top7.n++;
      if(st.type==='omen'){ctx.step='omen';const go=E.d(2)===1;omen[go?'go':'away']++;st=E.answerOmen(G,st,go)}
      if(st.type==='end'){end.완주++;break}
      if(st.type==='fight')fight=st.enemy;
      else{ctx.step='options';const opts=E.options(G,st.ev);if(!opts.length)throw new Error(`"${st.ev.t}": 고를 수 있는 선택지가 없다`);
        seen.add(st.ev.t);ctx.step='choose';pending=E.choose(G,st.ev,opts[E.d(opts.length)-1].i).combat;continue}
    }
    ctx.step='fightAuto';ctx.enemy=fight;const C=E.fightAuto(G.ch,fight);
    if(D.enemies[fight].hidden){const h=hb[fight]||(hb[fight]={met:0,win:0});h.met++;if(C.over==='win')h.win++}
    if(C.over!=='win'){end.사망++;break}
    ctx.step='winRewards';E.winRewards(G,C);
  }
  ctx.step='post';
  access[E.shopAccess(G.ch)]++;
  if(E.isFinger(G.ch)){const k=G.ch.aff.name+' '+G.ch.fr.n;fr[k]=(fr[k]||0)+1}
  if(G.ch.pinky){pinky.n++;const k=G.ch.aff?G.ch.aff.name:'?';pinky.combo[k]=(pinky.combo[k]||0)+1}wealth.push(G.ch.money);
  const k=G.ch.aff?D.text.affTypes[G.ch.aff.type]:'소속 없음';aff[k]=(aff[k]||0)+1;
  const o=byOrigin[G.ch.o.n]||(byOrigin[G.ch.o.n]={n:0,해결사:0});o.n++;o[k]=(o[k]||0)+1;if(G.ch.licensed)o.해결사++;
  const rk=G.ch.licensed?G.ch.rank+D.text.rankUnit:'미등록';rank[rk]=(rank[rk]||0)+1;if(G.ch.title)color.n++;
  }catch(e){diag(e);throw e}
  played++;
}
const never=[...D.events,D.affiliation].map(e=>e.t).filter(t=>!seen.has(t));
/* 4000판이 전부 끝까지(완주 또는 사망) 처리됐는지: 판당 반복 한도(2000)를 다 쓰고 끝나지 못한 판이 있으면 조용히 넘어가지 않고 오류로 본다 */
if(played!==N||end.완주+end.사망!==N){console.error(`시뮬레이션 판수 불일치 · 계획 ${N}판 · 끝까지 진행 ${played}판 · 정상 종료 ${end.완주+end.사망}판 (완주 ${end.완주} + 사망 ${end.사망}) · 끝나지 못한 판 ${N-(end.완주+end.사망)}`);process.exit(1)}
console.log(`진행 검사 통과 · ${N}판 · 완주 ${end.완주} / 사망 ${end.사망} · 정상 종료 ${end.완주+end.사망}/${N}`);
const cols=['해결사',...Object.values(D.text.affTypes),'소속 없음'],pc=(a,b)=>((a||0)/b*100).toFixed(0).padStart(4)+'%';
console.log('\n출신별 결과 (해결사 = 등록 비율, 나머지 = 최종 소속)\n'+'출신'.padEnd(10,'　')+cols.map(c=>c.padStart(5,'　')).join(''));
for(const [n,o] of Object.entries(byOrigin))console.log(n.padEnd(10,'　')+cols.map(c=>pc(o[c],o.n).padStart(6)).join('')+`  (${o.n}판)`);
console.log('\n소속 분포 · '+Object.entries(aff).map(([k,v])=>`${k} ${(v/N*100).toFixed(0)}%`).join(' · '));
console.log('최종 급수 · '+Object.entries(rank).sort().map(([k,v])=>`${k} ${(v/N*100).toFixed(0)}%`).join(' · ')+` · ${D.text.titleLabel} ${color.n}명`);
wealth.sort((a,b)=>a-b);
console.log(`공방 · 마지막 접근 등급 ${[1,2,3].map(g=>D.workshops[g-1].n+' '+(access[g]/N*100).toFixed(0)+'%').join(' · ')} · 구매 ${[1,2,3].map(g=>g+'등급 '+buys[g]).join(' / ')} · 끝날 때 자산 중앙값 ${E.money(wealth[wealth.length>>1])}`);
console.log('손가락 최종 서열 · '+Object.entries(fr).sort().map(([k,v])=>`${k} ${v}`).join(' · '));
console.log(`소지 표식 · ${pinky.n}명 (${Object.entries(pinky.combo).sort((a,b)=>b[1]-a[1]).slice(0,6).map(([k,v])=>k+'+소지 '+v).join(' · ')})`);
console.log(`7년차를 3급 이상으로 맞은 판 · ${top7.n}`);
console.log(`불길한 예감 · 맞섬 ${omen.go} / 돌아섬 ${omen.away} (무작위 선택)`);
console.log('히든 보스 (만남/승리) · '+(Object.entries(hb).map(([k,v])=>`${D.enemies[k].n} ${v.met}/${v.win}`).join(' · ')||'없음'));
if(never.length)console.log('한 번도 안 나온 사건 · '+never.join(', '));
