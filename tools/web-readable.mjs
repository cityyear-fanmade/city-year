/* 거미집 원고를 읽기 좋은 문서로 바꾼다: 흐름 → 선택지 → 선택 결과 순
   사용: node tools/web-readable.mjs data/web/엄지-master.json > out.md */
import {readFileSync} from 'node:fs';
const J=JSON.parse(readFileSync(process.argv[2],'utf8'));
const T=J.turns||J;
const stage20=['문 안으로, 그리고 가르침','서로의 편, 가르침의 소유자','관계의 대가, 바깥의 역할','진실과 재료의 이름'];
const stage=['문 안으로 들어온 사람','몸에 남는 가르침','서로의 편','가르침의 소유자','관계의 대가','바깥에서 정해진 역할','사제 관계의 진실','재료의 이름'];
const sz={없음:'',작음:'보상 작음',보통:'보상 보통',큼:'보상 큼'};
const endName={complete:'이어진 실',apart:'각자의 길',accomplice:'같은 매듭',left:'남겨진 자리',revolt:'끊어낸 실'};
let out=`# ${J.finger||''} ${J.route==='master'?'스승 루트':'제자 루트'} · ${T.length}턴\n\n`;
const cnt={};
T.forEach(t=>{
  if((t.n-1)%5===0)out+=`\n---\n## ${Math.ceil(t.n/5)}해째 · ${(T.length===20?stage20:stage)[Math.floor((t.n-1)/5)]}\n`;
  out+=`\n### ${t.n}턴 · ${t.t}\n\n**흐름**\n\n${t.x.replace(/\n/g,'\n\n')}\n`;
  t.c.forEach((c,i)=>{
    const tag=[c.bond?`인연 ${c.bond}`:'',sz[c.size]||'',c.risk?'위험(판정)':'',c.flag?`표식 ${c.flag}`:'',c.end?`결말 ${endName[c.end]}`:''].filter(Boolean).join(' · ');
    out+=`\n**선택지 ${i+1}. ${c.l}**${c.h?` — ${c.h}`:''}${tag?`  \n(${tag})`:''}\n\n> 결과: ${c.r}\n`;
    if(c.risk)out+=`>\n> 실패하면: ${c.f}\n`;
    if(c.bond)cnt[c.bond]=(cnt[c.bond]||0)+1;
  });
});
out+=`\n---\n## 인연 선택지 수\n\n${Object.entries(cnt).map(([k,v])=>`- ${k}: ${v}개`).join('\n')}\n`;
console.log(out);
