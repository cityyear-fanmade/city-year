/* 테마를 바꿀 때 화면이 밀리는지 잰다: 처음 화면 주요 요소의 위치·크기를 테마별로 비교
   node tools/shift.cjs [url]  (기본 dist/city-year.html) */
const {chromium}=require('playwright');const path=require('path');
const url=process.argv[2]||'file://'+path.resolve(__dirname,'..','dist','city-year.html');
const SEL={제목:'h1',소개:'.lead',시작버튼:'[data-a=start]',테마버튼:'[data-a=skin][data-i=base]',규칙:'details'};
(async()=>{
  const b=await chromium.launch();let bad=0;
  for(const vp of [{width:390,height:844},{width:1280,height:800}]){
    const p=await b.newPage({viewport:vp});
    await p.goto(url,{waitUntil:'networkidle'});await p.evaluate(()=>document.fonts.ready);
    const rows={};
    for(const skin of ['base','dante','terminal']){
      await p.click(`[data-a=skin][data-i=${skin}]`);await p.evaluate(()=>document.fonts.ready);
      rows[skin]=await p.evaluate(S=>Object.fromEntries(Object.entries(S).map(([k,s])=>{const r=document.querySelector(s).getBoundingClientRect();return [k,[r.x,r.y,r.width,r.height].map(v=>Math.round(v))]})),SEL);
    }
    console.log(`\n${vp.width}px  (x, y, 너비, 높이)`);
    for(const k of Object.keys(SEL)){
      const v=['base','dante','terminal'].map(s=>rows[s][k]);
      const diff=Math.max(...[0,1,2,3].map(i=>Math.max(...v.map(x=>x[i]))-Math.min(...v.map(x=>x[i]))));
      if(diff>1)bad++;
      console.log(`  ${k.padEnd(5,'　')} 기본 ${v[0].join(',')} | 단테 ${v[1].join(',')} | 단말기 ${v[2].join(',')}  → 최대 차이 ${diff}px`);
    }
    await p.close();
  }
  await b.close();console.log(bad?`\n밀림 ${bad}건`:'\n밀림 없음');process.exit(bad?1:0);
})();
