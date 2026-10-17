/* 배경음악: 외부 음원 없이 Web Audio로 합성한다 (저작권 문제 없음). 직접 만든 재즈풍 코드 진행과 리듬이다.
   - 기본은 꺼져 있고, 사용자가 설정에서 켠 뒤에만 소리가 난다 (브라우저 정책상 한 번 눌러야 시작)
   - 켤 때 마스터 음량을 0에서 서서히 올리고, 전체 출력은 컴프레서를 거친다
   - 평소(calm)는 느린 스윙: 걷는 베이스, 라이드 심벌, 브러시, 전기 피아노의 엇박 컴핑, 가끔 지나가는 멜로디
     전투(fight)는 템포를 올리고 리듬을 촘촘히 한다. 코드는 ii7 · V13 · Imaj9 · vi9 (한 마디에 하나) */
export function createBgm(){
  /* 모든 값은 여기서 조절한다 */
  const P={
    maxGain:2,          // 음량 100%일 때 마스터 음량 (컴프레서가 최고점을 눌러 준다)
    fadeIn:3,           // 켤 때 서서히 커지는 시간(초)
    fadeOut:0.8,        // 끌 때 서서히 줄어드는 시간(초)
    bpm:{calm:76,fight:136},
    swing:0.64,         // 엇박 위치 (0.5=straight, 0.67=셋잇단 스윙)
    /* 코드: bass=근음(C=0 기준 반음), iv=베이스가 걷는 구성음, v=전기 피아노 보이싱(근음 생략), sc=즉흥에 쓰는 음계 */
    chords:[
      {bass:2,iv:[0,3,7,10],v:[5,9,12,16],sc:[2,5,7,9,12,14,17]},        // Dm9
      {bass:7,iv:[0,4,7,10],v:[5,11,14,16],sc:[7,9,11,12,14,16,17]},     // G13
      {bass:0,iv:[0,4,7,11],v:[4,7,11,14],sc:[0,2,4,7,9,11,14]},         // Cmaj9
      {bass:9,iv:[0,3,7,10],v:[12,16,19,23],sc:[9,12,14,16,19,21,23]}    // Am9
    ],
    moods:{
      base:    {root:60,cut:2600,room:1,wet:0.22},
      dante:   {root:55,cut:1800,room:1.2,wet:0.26},
      terminal:{root:62,cut:3400,room:0.8,wet:0.16},
      ruina:   {root:58,cut:2200,room:1.3,wet:0.3}
    }
  };
  let ctx=null,master=null,bus=null,bright=null,analyser=null,noiseBuf=null,on=false,vol=0.3,mood='base',scene='calm',timer=null,hidden=false;
  let barT=0,barN=0,lastScene='calm';
  const AC=typeof window!=='undefined'&&(window.AudioContext||window.webkitAudioContext);
  const hz=m=>440*Math.pow(2,(m-69)/12),rnd=Math.random,pick=a=>a[Math.floor(rnd()*a.length)];
  /* 사용자 음량(0~1) → 마스터 음량 */
  const gainOf=v=>on?P.maxGain*v:0;
  function ensure(){
    if(ctx||!AC)return !!ctx;
    ctx=new AC();
    const comp=ctx.createDynamicsCompressor();comp.threshold.value=-26;comp.knee.value=20;comp.ratio.value=10;comp.attack.value=0.01;comp.release.value=0.3;
    master=ctx.createGain();master.gain.value=0;
    bus=ctx.createGain();bus.connect(master);
    /* 방 울림: 짧은 되울림을 살짝 섞는다 */
    const dl=ctx.createDelay(1),fb=ctx.createGain(),lp=ctx.createBiquadFilter(),wet=ctx.createGain();dl.delayTime.value=0.19;fb.gain.value=0.3;lp.type='lowpass';lp.frequency.value=2800;wet.gain.value=P.moods.base.wet;
    bus.connect(dl);dl.connect(lp);lp.connect(fb);fb.connect(dl);lp.connect(wet);wet.connect(master);bus._wet=wet;
    bright=ctx.createBiquadFilter();bright.type='lowpass';bright.frequency.value=P.moods.base.cut;bright.Q.value=0.4;bright.connect(bus);
    master.connect(comp);comp.connect(ctx.destination);
    analyser=ctx.createAnalyser();analyser.fftSize=2048;comp.connect(analyser);
    noiseBuf=ctx.createBuffer(1,ctx.sampleRate*0.4,ctx.sampleRate);{const d=noiseBuf.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1}
    return true;
  }
  function ramp(target,t){
    if(!ctx)return;const g=master.gain,now=ctx.currentTime;
    g.cancelScheduledValues(now);g.setValueAtTime(g.value,now);g.linearRampToValueAtTime(target,now+t);
  }
  /* 악기들 */
  function ep(m,t,peak,dur){               // 전기 피아노: 부드러운 사인 + 짧게 울리는 윗배음
    const f=hz(m),o=ctx.createOscillator(),o2=ctx.createOscillator(),g=ctx.createGain(),g2=ctx.createGain();o.type='sine';o2.type='sine';o.frequency.value=f;o2.frequency.value=f*2.01;
    g.gain.setValueAtTime(0.0001,t);g.gain.linearRampToValueAtTime(peak,t+0.008);g.gain.exponentialRampToValueAtTime(0.0001,t+dur);
    g2.gain.setValueAtTime(peak*0.35,t);g2.gain.exponentialRampToValueAtTime(0.0001,t+0.18);
    o.connect(g);o2.connect(g2);g2.connect(g);g.connect(bright);o.start(t);o.stop(t+dur+0.05);o2.start(t);o2.stop(t+0.25);
  }
  function bassN(m,t,dur,peak){            // 어쿠스틱 베이스풍: 짧게 퉁기고 곧 사그라든다
    const o=ctx.createOscillator(),f=ctx.createBiquadFilter(),g=ctx.createGain();o.type='triangle';o.frequency.value=hz(m);f.type='lowpass';f.frequency.value=520;f.Q.value=0.6;
    g.gain.setValueAtTime(0.0001,t);g.gain.linearRampToValueAtTime(peak,t+0.012);g.gain.exponentialRampToValueAtTime(peak*0.35,t+dur*0.55);g.gain.exponentialRampToValueAtTime(0.0001,t+dur);
    o.connect(f);f.connect(g);g.connect(master);o.start(t);o.stop(t+dur+0.05);
  }
  function noiseHit(t,peak,dur,hp,lpf){    // 심벌·브러시: 거른 노이즈
    const n=ctx.createBufferSource(),f=ctx.createBiquadFilter(),g=ctx.createGain();n.buffer=noiseBuf;f.type='highpass';f.frequency.value=hp;
    g.gain.setValueAtTime(0.0001,t);g.gain.linearRampToValueAtTime(peak,t+0.004);g.gain.exponentialRampToValueAtTime(0.0001,t+dur);
    n.connect(f);if(lpf){const l=ctx.createBiquadFilter();l.type='lowpass';l.frequency.value=lpf;f.connect(l);l.connect(g)}else f.connect(g);g.connect(master);n.start(t,rnd()*0.15);n.stop(t+dur+0.02);
  }
  function feather(t,peak){                // 킥: 거의 들리지 않는 부드러운 박동
    const o=ctx.createOscillator(),g=ctx.createGain();o.type='sine';o.frequency.setValueAtTime(90,t);o.frequency.exponentialRampToValueAtTime(48,t+0.1);
    g.gain.setValueAtTime(0.0001,t);g.gain.linearRampToValueAtTime(peak,t+0.006);g.gain.exponentialRampToValueAtTime(0.0001,t+0.16);
    o.connect(g);g.connect(master);o.start(t);o.stop(t+0.2);
  }
  function horn(m,t,dur,peak,cut){         // 가끔 지나가는 멜로디: 먹먹한 삼각파
    const o=ctx.createOscillator(),f=ctx.createBiquadFilter(),g=ctx.createGain();o.type='triangle';o.frequency.value=hz(m);f.type='lowpass';f.frequency.value=cut;f.Q.value=0.8;
    g.gain.setValueAtTime(0.0001,t);g.gain.linearRampToValueAtTime(peak,t+0.03);g.gain.exponentialRampToValueAtTime(0.0001,t+dur);
    o.connect(f);f.connect(g);g.connect(bus);o.start(t);o.stop(t+dur+0.05);
  }
  /* 한 마디를 예약한다 */
  function scheduleBar(T,M){
    const fight=scene==='fight',bd=60/P.bpm[scene],sw=P.swing,ci=barN%P.chords.length,C=P.chords[ci],N=P.chords[(barN+1)%P.chords.length],R=M.root;
    const at=k=>T+k*bd,bassBase=R-24;
    /* 걷는 베이스: 근음 → 구성음 → 구성음 → 다음 근음으로 반음 접근 */
    {const nr=bassBase+N.bass,notes=[bassBase+C.bass,bassBase+C.bass+pick(C.iv.slice(1)),bassBase+C.bass+pick(C.iv.slice(1)),nr+(rnd()<0.5?-1:1)];
      for(let k=0;k<4;k++){const m=notes[k]<bassBase-5?notes[k]+12:notes[k];bassN(m,at(k),bd*0.9,k===0?0.1:0.075);
        if(fight&&k===1&&rnd()<0.5)bassN(m+7,at(k+sw),bd*0.4,0.05)}}
    /* 라이드: 딩, 딩-따, 딩, 딩-따 */
    for(const k of [0,1,1+sw,2,3,3+sw]){const acc=k%1===0;noiseHit(at(k),(acc?0.022:0.014)*(fight?1.25:1),acc?0.22:0.12,7200,10500)}
    if(fight)for(const k of [0.5,2.5])noiseHit(at(k),0.01,0.08,8000,11000);
    /* 하이햇 풋(2·4박)과 브러시, 전투에서는 가벼운 킥 */
    for(const k of [1,3]){noiseHit(at(k),0.03,0.07,2400,4500);noiseHit(at(k)+0.01,fight?0.016:0.01,0.16,1800,4200)}
    if(fight){for(let k=0;k<4;k++)feather(at(k),0.045);if(rnd()<0.6)noiseHit(at(2+sw),0.014,0.07,2000,4600)}
    /* 전기 피아노 컴핑: 1박과 엇박 */
    const pats=fight?[[0,1+sw,2,3+sw],[0,1.5,2+sw,3],[sw,2,3+sw]]:[[0,1+sw],[0,2+sw],[sw,2],[0,1+sw,3+sw]];
    for(const k of pick(pats)){
      const long=k===0,dur=(long?1.1:0.55)*bd*(fight?0.75:1);
      C.v.forEach((o,i)=>ep(R+o,at(k)+i*0.012+(rnd()*0.008),(long?0.021:0.016),dur+0.15));
    }
    /* 즉흥: 가끔 두세 음이 지나간다 */
    if(rnd()<(fight?0.22:0.42)){
      const n=3+Math.floor(rnd()*3),k0=pick([0.5,1,1.5,2,2.5]);let ix=Math.floor(rnd()*C.sc.length);
      for(let i=0;i<n;i++){const k=k0+i*0.5;if(k>=4)break;const kk=k%1===0?k:Math.floor(k)+sw;horn(R+12+C.sc[ix]+(rnd()<0.2?12:0),at(kk),bd*0.45,0.03,M.cut);ix=Math.max(0,Math.min(C.sc.length-1,ix+pick([-2,-1,1,2])))}
    }
    barT=T+4*bd;barN++;
  }
  function schedule(now,M){
    if(lastScene!==scene){lastScene=scene;barT=now+0.1}
    if(barT<now)barT=now+0.05;
    const wet=bus._wet;if(wet)wet.gain.setTargetAtTime(M.wet*(scene==='fight'?0.7:1),now,1.5);
    bright.frequency.setTargetAtTime(M.cut*(scene==='fight'?1.25:1),now,2);
    let g=0;while(barT<now+2.2&&g++<3)scheduleBar(barT,M);
  }
  function tick(){
    if(!ctx||!on||hidden)return;
    schedule(ctx.currentTime,P.moods[mood]||P.moods.base);
  }
  function start(){
    if(!ensure())return false;
    ctx.resume&&ctx.resume();
    if(!timer)timer=setInterval(tick,700);
    barT=ctx.currentTime+0.1;barN=0;lastScene=scene;
    tick();ramp(gainOf(vol),P.fadeIn);return true;
  }
  function stop(){
    ramp(0,P.fadeOut);
    if(timer){clearInterval(timer);timer=null}
    const c=ctx;if(c)setTimeout(()=>{if(!on&&c.state==='running')c.suspend&&c.suspend()},(P.fadeOut+0.3)*1000);
  }
  if(typeof document!=='undefined')document.addEventListener('visibilitychange',()=>{
    hidden=document.hidden;if(!ctx)return;
    if(hidden){ramp(0,0.4);setTimeout(()=>{if(hidden&&ctx.state==='running')ctx.suspend()},500)}
    else if(on){ctx.resume().then(()=>{barT=ctx.currentTime+0.1;ramp(gainOf(vol),1.2)})}
  });
  return {
    supported:!!AC,
    isOn:()=>on,vol:()=>vol,
    level:()=>{if(!analyser)return null;const d=new Float32Array(2048);analyser.getFloatTimeDomainData(d);let p=0,q=0;for(const v of d){const a=Math.abs(v);if(a>p)p=a;q+=v*v}return {peakDb:+(20*Math.log10(p+1e-9)).toFixed(1),rmsDb:+(10*Math.log10(q/d.length+1e-12)).toFixed(1)}},
    debug:()=>({state:ctx&&ctx.state,gain:master?master.gain.value:null,on,vol,mood,scene}),
    /* 켜기/끄기: 켜는 것은 사용자가 누른 순간(클릭 처리 안)에서만 호출해야 한다 */
    set(v){if(v===on)return on;on=!!v;if(on)start();else stop();return on},
    setVol(v){vol=Math.max(0,Math.min(1,+v||0));if(on&&ctx)ramp(gainOf(vol),0.3)},
    setMood(k){if(P.moods[k])mood=k},
    setScene(k){scene=k==='fight'?'fight':'calm'}
  };
}
