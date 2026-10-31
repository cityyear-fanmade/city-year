/* 브라우저 자동 플레이: 무작위로 버튼을 눌러 결말까지 간다. JS 오류가 하나라도 나면 실패.
   node tools/play.cjs [판 수=5] [url]   (Playwright 필요. url 없으면 dist/city-year.html)
   --shots 를 붙이면 테마 3종 캡처를 screens/에 저장한다. */
const {chromium}=require('playwright');const path=require('path');
const args=process.argv.slice(2),shots=args.includes('--shots'),pos=args.filter(a=>!a.startsWith('--'));
const runs=+pos[0]||5,url=pos[1]||'file://'+path.resolve(__dirname,'..','dist','city-year.html');
(async()=>{
  const b=await chromium.launch(),errs=[],out=[];
  for(let run=0;run<runs;run++){
    const p=await b.newPage({viewport:{width:390,height:844}});
    p.on('pageerror',e=>errs.push(e.message));p.on('console',m=>{if(m.type()==='error'||m.type()==='warning')errs.push(m.text())});
    await p.addInitScript(m=>{try{localStorage.setItem('cityYearMode',m)}catch(e){}},run===0?'fast':'off');
    await p.goto(url);await p.waitForSelector('[data-a=start]');{const nk=await p.$('[data-a=noticeok]');if(nk)await nk.click().catch(()=>{})}
    await p.click('[data-a=start]');
    const seen=new Set();let steps=0;
    while(steps++<2000){
      const st=await p.evaluate(()=>CITY.state());seen.add(st.screen);
      if(st.screen==='end')break;
      if(await p.$('[data-a=skip]')){await p.click('[data-a=skip]');await p.waitForTimeout(50);continue}
      if(st.screen==='birth'){await p.click('[data-a=live]');continue}
      if(st.screen==='combat'){
        for(let i=0;i<4;i++){const s=`[data-a=pick][data-i="${i}"]:not([disabled])`;if(Math.random()<.7&&await p.$(s))await p.click(s)}
        await p.click((await p.$('[data-a=fin]'))?'[data-a=fin]':'[data-a=go]');continue;
      }
      const btns=await p.$$('[data-a=choose],[data-a=grow],[data-a=flow],[data-a=fight],[data-a=unshop]');
      if(!btns.length){await p.waitForTimeout(100);continue}
      await btns[Math.floor(Math.random()*btns.length)].click();
    }
    const st=await p.evaluate(()=>CITY.state());
    out.push(`${st.endWin?'완주':'사망'} ${st.year}년차 Lv${st.lv} ${st.aff?st.aff.name:'소속 없음'} · ${[...seen].join(',')}`);
    await p.close();
  }
  if(shots){
    for(const skin of ['base','dante','terminal']){
      const p=await b.newPage({viewport:{width:390,height:844},deviceScaleFactor:2});
      await p.addInitScript(s=>{localStorage.setItem('cityYearSkin',s);localStorage.setItem('cityYearMode','off')},skin);
      await p.goto(url,{waitUntil:'networkidle'});await p.evaluate(()=>document.fonts.ready);
      await p.click('[data-a=start]');await p.screenshot({path:path.resolve(__dirname,'..','screens',skin+'_birth.png'),fullPage:true});
      await p.close();
    }
  }
  console.log(out.join('\n'));console.log('오류',errs.length,errs.slice(0,5));
  await b.close();process.exit(errs.length?1:0);
})();
