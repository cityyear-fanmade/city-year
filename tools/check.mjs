/* 데이터 검사: npm run check
   1) 없는 카드·적·키워드 참조 찾기  2) 무작위 선택으로 게임을 끝까지 N판 돌려 오류가 없는지 본다 */
import {loadData} from '../src/data-node.js';
import {validateData,createEngine,mulberry32} from '../src/engine.js';
const D=loadData(),err=validateData(D);
if(err.length){console.error('데이터 오류 '+err.length+'건:\n  '+err.join('\n  '));process.exit(1)}
console.log(`참조 검사 통과 · 카드 ${Object.keys(D.cards).length} · 적 ${Object.keys(D.enemies).length} · 사건 ${D.events.length} · 출신 ${D.origins.length}`);

const E=createEngine(D,{rng:mulberry32(42)}),N=+(process.argv[2]||4000),byOrigin={},seen=new Set(),aff={},end={완주:0,사망:0},rank={},color={n:0},hb={},omen={go:0,away:0},top7={n:0},buys={1:0,2:0,3:0},access={1:0,2:0,3:0},wealth=[],fr={},pinky={n:0,combo:{}};
for(let g=0;g<N;g++){
  const G=E.newGame(E.newChar());let pending=null;
  for(let guard=0;guard<300;guard++){
    while(G.ch.lvPend>0){const o=E.rollGrowth();E.applyFx(G.ch,o[E.d(o.length)-1].g.fx);G.ch.lvPend--}
    let fight=pending;pending=null;
    if(!fight){
      /* 공방: 지금 그 칸 장비보다 비싼 물건 중 살 수 있는 가장 비싼 것 하나를 산다 */
      const cur=sl=>(G.ch.gear[sl]&&G.ch.gear[sl].price)||0;
      const can=Object.keys(D.items).filter(id=>E.canBuy(G.ch,id)==='ok'&&D.items[id].price>cur(D.items[id].slot)).sort((a,b)=>D.items[b].price-D.items[a].price);
      if(can.length&&E.buy(G.ch,can[0]))buys[D.items[can[0]].grade]++;
      let st=E.advanceYear(G);
      if(st.type!=='end'&&G.year===7&&G.ch.licensed&&G.ch.rank<=3)top7.n++;
      if(st.type==='omen'){const go=E.d(2)===1;omen[go?'go':'away']++;st=E.answerOmen(G,st,go)}
      if(st.type==='end'){end.완주++;break}
      if(st.type==='fight')fight=st.enemy;
      else{const opts=E.options(G,st.ev);if(!opts.length)throw new Error(`"${st.ev.t}": 고를 수 있는 선택지가 없다`);
        seen.add(st.ev.t);pending=E.choose(G,st.ev,opts[E.d(opts.length)-1].i).combat;continue}
    }
    const C=E.fightAuto(G.ch,fight);
    if(D.enemies[fight].hidden){const h=hb[fight]||(hb[fight]={met:0,win:0});h.met++;if(C.over==='win')h.win++}
    if(C.over!=='win'){end.사망++;break}
    E.winRewards(G,C);
  }
  access[E.shopAccess(G.ch)]++;
  if(E.isFinger(G.ch)){const k=G.ch.aff.name+' '+G.ch.fr.n;fr[k]=(fr[k]||0)+1}
  if(G.ch.pinky){pinky.n++;const k=G.ch.aff?G.ch.aff.name:'?';pinky.combo[k]=(pinky.combo[k]||0)+1}wealth.push(G.ch.money);
  const k=G.ch.aff?D.text.affTypes[G.ch.aff.type]:'소속 없음';aff[k]=(aff[k]||0)+1;
  const o=byOrigin[G.ch.o.n]||(byOrigin[G.ch.o.n]={n:0,해결사:0});o.n++;o[k]=(o[k]||0)+1;if(G.ch.licensed)o.해결사++;
  const rk=G.ch.licensed?G.ch.rank+D.text.rankUnit:'미등록';rank[rk]=(rank[rk]||0)+1;if(G.ch.title)color.n++;
}
const never=[...D.events,D.affiliation].map(e=>e.t).filter(t=>!seen.has(t));
console.log(`진행 검사 통과 · ${N}판 · 완주 ${end.완주} / 사망 ${end.사망}`);
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
