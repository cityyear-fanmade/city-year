/* 배경음악: 외부 음원 없이 Web Audio로 합성한다 (저작권 문제 없음). 직접 만든 곡이다.
   - 기본은 꺼져 있고, 사용자가 설정에서 켠 뒤에만 소리가 난다 (브라우저 정책상 한 번 눌러야 시작)
   - 켤 때 마스터 음량을 0에서 서서히 올리고, 전체 출력은 컴프레서를 거친다
   - 두 가지 스타일을 사용자가 고른다
     · 고요(calm): 로비 같은 곡. 3/4박 · 템포 60 · 마디마다 16분 아르페지오가 쉬지 않고 이어지고, 소리 크기는 거의 일정하다. 낮은 음역(건반 40~70)의 긴 베이스와 길게 깔리는 현, 가끔 얹히는 느린 선율. 코드는 장7·단7·서스 색 (G 장조: Gmaj7 · Em7 · Cmaj7 · Dsus). 전투에 들어가면 템포가 오르고 박동이 붙는다
     · 불길(passion): 전투 같은 곡. 4/4박 · 평소부터 빠르고(132) 소리 크기가 일정하다. 16분 되풀이 음형과 어긋난 박의 옥타브 베이스, 낮게 깔리는 현, 큰북·스네어. 코드는 7화음 색 (D 단조: Dm7 · Bbmaj7 · Fmaj7 · Csus). 전투에 들어가면 더 빨라지고 킥이 4박으로 늘며 스네어 연타가 붙는다
   - 참고 곡들을 분석해 템포·박자·음역·소리 크기의 변화·리듬 밀도를 맞췄고, 선율과 화성 진행은 직접 만들었다 (소리를 끊는 잡음 악기는 쓰지 않는다) */
export function createBgm(){
  /* 모든 값은 여기서 조절한다 */
  const P={
    maxGain:2,          // 음량 100%일 때 마스터 음량 (컴프레서가 최고점을 눌러 준다)
    fadeIn:3,           // 켤 때 서서히 커지는 시간(초)
    fadeOut:0.8,        // 끌 때 서서히 줄어드는 시간(초)
    bpm:{calm:{calm:60,fight:92},passion:{calm:132,fight:152}},   // [스타일][장면]
    styleGain:{calm:0.65,passion:0.95},   // 스타일별 전체 음량 보정 (격정은 피아노 중심이라 잔잔과 비슷한 크기로 맞춘다)
    cutMul:{calm:{calm:0.8,fight:1},passion:{calm:1.1,fight:1.3}}, // 장면별 밝기
    /* 코드(C=0 기준 반음): b=베이스 근음, t=구성음(피아노 · 현), sc=선율 음계 */
    /* 격정(D 단조, 7화음 색): Dm7 → Bbmaj7 → Fmaj7 → Csus */
    pChords:[
      {b:2,t:[-10,-7,-3,0],sc:[2,4,5,7,9,10,12]},     // Dm7
      {b:10,t:[-2,2,5,9],sc:[2,4,5,7,9,10,12]},       // Bbmaj7
      {b:5,t:[-7,-3,0,4],sc:[2,4,5,7,9,10,12]},       // Fmaj7
      {b:0,t:[0,5,7,12],sc:[2,4,5,7,9,11,12]}         // Csus
    ],
    /* 잔잔(G 장조, 장7·단7·서스 색): Gmaj7 → Em7 → Cmaj7 → Dsus. t=낮은 음역부터 오르는 5음 */
    lobby:[
      {b:7,t:[-5,-1,2,6,7],sc:[7,9,11,12,14,16,18]},     // Gmaj7
      {b:4,t:[-8,-5,-1,2,4],sc:[7,9,11,12,14,16,18]},    // Em7
      {b:0,t:[-12,-8,-5,-1,0],sc:[7,9,11,12,14,16,17]},  // Cmaj7
      {b:2,t:[-10,-5,-3,0,2],sc:[7,9,11,12,14,16,18]}    // Dsus
    ],
    moods:{
      base:    {root:60,cut:2600,room:1,wet:0.22},
      dante:   {root:55,cut:1800,room:1.2,wet:0.26},
      terminal:{root:62,cut:3400,room:0.8,wet:0.16},
      ruina:   {root:58,cut:2200,room:1.3,wet:0.3}
    }
  };
  let ctx=null,master=null,bus=null,bright=null,analyser=null,noiseBuf=null,on=false,vol=0.3,mood='base',scene='calm',style='calm',timer=null,hidden=false;
  let barT=0,barN=0,lastScene='calm',lastStyle='calm',cur=null,duckUntil=0;
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
    bus.connect(dl);dl.connect(lp);lp.connect(fb);fb.connect(dl);lp.connect(wet);wet.connect(master);bus._wet=wet;bus._fb=fb;
    bright=ctx.createBiquadFilter();bright.type='lowpass';bright.frequency.value=P.moods.base.cut;bright.Q.value=0.4;bright.connect(bus);
    master.connect(comp);comp.connect(ctx.destination);
    analyser=ctx.createAnalyser();analyser.fftSize=2048;comp.connect(analyser);
    noiseBuf=ctx.createBuffer(1,ctx.sampleRate*2.2,ctx.sampleRate);{const d=noiseBuf.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1}
    return true;
  }
  /* 장면(평시·전투)마다 새 출력 묶음을 만든다. 장면이 바뀌면 이전 묶음을 빠르게 줄여 끄고, 이미 예약된 이전 장면의 소리가 새 장면과 겹치지 않게 한다 */
  function newEpoch(){
    const now=ctx.currentTime;
    if(cur){const o=cur;for(const g of [o.b,o.u,o.m]){g.gain.cancelScheduledValues(now);g.gain.setValueAtTime(g.gain.value,now);g.gain.linearRampToValueAtTime(0,now+0.28)}setTimeout(()=>{try{for(const g of [o.b,o.u,o.m])g.disconnect()}catch(e){}},1200)}
    const mk=dest=>{const g=ctx.createGain();g.gain.setValueAtTime(0,now);g.gain.linearRampToValueAtTime(P.styleGain[style],now+0.3);g.connect(dest);return g};
    cur={b:mk(bright),u:mk(bus),m:mk(master)};
    /* 장면이 바뀔 때 되울림(꼬리)도 잠깐 끊어 이전 소리가 길게 남지 않게 한다 */
    const w=bus._wet,fb=bus._fb;duckUntil=now+0.9;
    w.gain.cancelScheduledValues(now);w.gain.setValueAtTime(w.gain.value,now);w.gain.linearRampToValueAtTime(0,now+0.08);
    fb.gain.cancelScheduledValues(now);fb.gain.setValueAtTime(0,now);fb.gain.setValueAtTime(0.3,now+0.5);
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
    o.connect(g);o2.connect(g2);g2.connect(g);g.connect(cur.b);o.start(t);o.stop(t+dur+0.05);o2.start(t);o2.stop(t+0.25);
  }
  function bassN(m,t,dur,peak){            // 어쿠스틱 베이스풍: 짧게 퉁기고 곧 사그라든다
    const o=ctx.createOscillator(),f=ctx.createBiquadFilter(),g=ctx.createGain();o.type='triangle';o.frequency.value=hz(m);f.type='lowpass';f.frequency.value=520;f.Q.value=0.6;
    g.gain.setValueAtTime(0.0001,t);g.gain.linearRampToValueAtTime(peak,t+0.012);g.gain.exponentialRampToValueAtTime(peak*0.35,t+dur*0.55);g.gain.exponentialRampToValueAtTime(0.0001,t+dur);
    o.connect(f);f.connect(g);g.connect(cur.m);o.start(t);o.stop(t+dur+0.05);
  }
  function noiseHit(t,peak,dur,hp,lpf){    // 심벌·브러시: 거른 노이즈
    const n=ctx.createBufferSource(),f=ctx.createBiquadFilter(),g=ctx.createGain();n.buffer=noiseBuf;f.type='highpass';f.frequency.value=hp;
    g.gain.setValueAtTime(0.0001,t);g.gain.linearRampToValueAtTime(peak,t+0.004);g.gain.exponentialRampToValueAtTime(0.0001,t+dur);
    n.connect(f);if(lpf){const l=ctx.createBiquadFilter();l.type='lowpass';l.frequency.value=lpf;f.connect(l);l.connect(g)}else f.connect(g);g.connect(cur.m);n.start(t,rnd()*0.9);n.stop(t+dur+0.02);
  }
  function feather(t,peak,soft){           // 킥: 부드러운 박동 (soft=잔잔)
    const o=ctx.createOscillator(),g=ctx.createGain();o.type='sine';o.frequency.setValueAtTime(soft?90:120,t);o.frequency.exponentialRampToValueAtTime(46,t+0.11);
    g.gain.setValueAtTime(0.0001,t);g.gain.linearRampToValueAtTime(peak,t+0.006);g.gain.exponentialRampToValueAtTime(0.0001,t+0.2);
    o.connect(g);g.connect(cur.m);o.start(t);o.stop(t+0.24);
  }
  function snare(t,peak){                  // 스네어: 노이즈 + 짧은 몸통음
    noiseHit(t,peak,0.12,1200,3800);
    const o=ctx.createOscillator(),g=ctx.createGain();o.type='triangle';o.frequency.setValueAtTime(210,t);o.frequency.exponentialRampToValueAtTime(120,t+0.09);
    g.gain.setValueAtTime(0.0001,t);g.gain.linearRampToValueAtTime(peak*0.9,t+0.004);g.gain.exponentialRampToValueAtTime(0.0001,t+0.11);
    o.connect(g);g.connect(cur.m);o.start(t);o.stop(t+0.14);
  }
  function padN(m,t,dur,peak){             // 패드: 살짝 어긋난 두 삼각파를 느리게 키우고 줄인다
    const g=ctx.createGain(),f=ctx.createBiquadFilter();f.type='lowpass';f.frequency.value=1100;f.Q.value=0.3;
    g.gain.setValueAtTime(0.0001,t);g.gain.linearRampToValueAtTime(peak,t+dur*0.35);g.gain.linearRampToValueAtTime(peak*0.8,t+dur*0.8);g.gain.exponentialRampToValueAtTime(0.0001,t+dur);
    for(const dt of [-6,6]){const o=ctx.createOscillator();o.type='triangle';o.frequency.value=hz(m);o.detune.value=dt;o.connect(f);o.start(t);o.stop(t+dur+0.05)}
    f.connect(g);g.connect(cur.u);
  }
  function sawN(m,t,dur,peak,cut){         // 베이스: 톱니파를 부드럽게 올렸다 내린다 (딱딱 끊기지 않게)
    const o=ctx.createOscillator(),f=ctx.createBiquadFilter(),g=ctx.createGain();o.type='sawtooth';o.frequency.value=hz(m);f.type='lowpass';f.frequency.setValueAtTime(cut,t);f.frequency.linearRampToValueAtTime(cut*0.7,t+dur);f.Q.value=0.5;
    g.gain.setValueAtTime(0.0001,t);g.gain.linearRampToValueAtTime(peak,t+0.02);g.gain.setValueAtTime(peak,t+dur*0.7);g.gain.linearRampToValueAtTime(0.0001,t+dur);
    o.connect(f);f.connect(g);g.connect(cur.b);o.start(t);o.stop(t+dur+0.05);
  }
  function pianoN(m,t,peak,dur){           // 피아노: 삼각파 + 한 옥타브 위 사인, 짧게 때리고 서서히 가라앉는다 (발음 수를 줄여 부하를 낮춘다)
    const f=hz(m),o=ctx.createOscillator(),o2=ctx.createOscillator(),g=ctx.createGain(),g2=ctx.createGain();
    o.type='triangle';o2.type='sine';o.frequency.value=f;o2.frequency.value=f*2;
    g.gain.setValueAtTime(0.0001,t);g.gain.linearRampToValueAtTime(peak,t+0.006);g.gain.exponentialRampToValueAtTime(peak*0.4,t+dur*0.25);g.gain.exponentialRampToValueAtTime(0.0001,t+dur);
    g2.gain.setValueAtTime(0.45,t);g2.gain.exponentialRampToValueAtTime(0.0001,t+dur*0.5);
    o.connect(g);o2.connect(g2);g2.connect(g);g.connect(cur.b);o.start(t);o2.start(t);o.stop(t+dur+0.05);o2.stop(t+dur*0.5+0.1);
  }
  function strN(m,t,dur,peak){             // 현: 톱니파 하나를 낮게 걸러 천천히 키운다
    const f=ctx.createBiquadFilter(),g=ctx.createGain(),o=ctx.createOscillator();f.type='lowpass';f.frequency.value=900;f.Q.value=0.4;
    g.gain.setValueAtTime(0.0001,t);g.gain.linearRampToValueAtTime(peak,t+dur*0.3);g.gain.linearRampToValueAtTime(peak*0.85,t+dur*0.85);g.gain.linearRampToValueAtTime(0.0001,t+dur);
    o.type='sawtooth';o.frequency.value=hz(m);o.connect(f);o.start(t);o.stop(t+dur+0.05);
    f.connect(g);g.connect(cur.u);
  }
  function boom(t,peak){                   // 큰북: 낮게 떨어지는 사인
    const o=ctx.createOscillator(),g=ctx.createGain();o.type='sine';o.frequency.setValueAtTime(82,t);o.frequency.exponentialRampToValueAtTime(38,t+0.35);
    g.gain.setValueAtTime(0.0001,t);g.gain.linearRampToValueAtTime(peak,t+0.01);g.gain.exponentialRampToValueAtTime(0.0001,t+0.7);
    o.connect(g);g.connect(cur.m);o.start(t);o.stop(t+0.75);
  }
  function leadN(m,t,dur,peak,cut){        // 이어 부는 선율: 살짝 어긋난 두 삼각파, 느리게 시작해 길게 이어진다
    const f=ctx.createBiquadFilter(),g=ctx.createGain();f.type='lowpass';f.frequency.value=cut;f.Q.value=0.5;
    g.gain.setValueAtTime(0.0001,t);g.gain.linearRampToValueAtTime(peak,t+0.05);g.gain.setValueAtTime(peak,t+dur*0.6);g.gain.linearRampToValueAtTime(0.0001,t+dur);
    for(const dt of [-5,5]){const o=ctx.createOscillator();o.type='triangle';o.frequency.value=hz(m);o.detune.value=dt;o.connect(f);o.start(t);o.stop(t+dur+0.05)}
    f.connect(g);g.connect(cur.u);
  }
  /* 잔잔 한 마디(3/4박): 16분 아르페지오가 12칸 내내 오르내리고 소리 크기는 거의 일정하다. 낮은 베이스, 길게 깔리는 현, 가끔 느린 선율. 전투에서는 템포가 오르고 부드러운 박동이 붙는다 */
  function barLobby(T,M){
    const fight=scene==='fight',bd=60/P.bpm.calm[scene],C=P.lobby[barN%P.lobby.length],R=M.root,at=k=>T+k*bd,lb=R-24+C.b;
    pianoN(lb,at(0),0.1,bd*2.9);pianoN(lb+12,at(0),0.045,bd*2.4);if(fight||barN%2===1)pianoN(lb+7,at(1.5),0.05,bd*1.4);
    C.t.slice(0,4).forEach((o,i)=>{strN(R+o-12,T+i*0.02,bd*3,fight?0.012:0.009)});
    const seq=[0,1,2,3,4,3,2,1,2,3,4,3];
    seq.forEach((ix,k)=>{const m=R+C.t[ix];pianoN(m,at(k*0.25),k%4===0?0.026:0.02,bd*1.25)});
    if(fight){feather(at(0),0.07,true);feather(at(1.5),0.04,true)}
    if(rnd()<0.6){const m=3,k0=pick([0,0.5,1]);let ix=Math.floor(rnd()*C.sc.length);
      for(let i=0;i<m;i++){const k=k0+i;if(k>=3)break;pianoN(R-12+C.sc[ix],at(k),fight?0.04:0.034,bd*1.6);ix=Math.max(0,Math.min(C.sc.length-1,ix+pick([-2,-1,-1,1,1,2])))}}
    barT=T+3*bd;barN++;
  }
  /* 격정 한 마디: 피아노가 끌고 간다. 오른손은 16분 되풀이 음형, 왼손은 옥타브 베이스 · 현이 낮게 깔리고 큰북과 스네어가 조여 든다.
     전투에서는 템포가 오르고 킥이 4박으로 늘며 4번째 박에 스네어 연타가 붙는다. 음역은 가운데 도 근처 아래쪽에 머문다 */
  function barPassion(T,M){
    const fight=scene==='fight',bd=60/P.bpm.passion[scene],C=P.pChords[barN%P.pChords.length],R=M.root,at=k=>T+k*bd,last=barN%4===3;
    /* 왼손: 옥타브 베이스 */
    const lb=R-24+C.b;
    for(const k of fight?[0,0.75,1.5,2,2.75,3.5]:[0,0.75,1.5,2.5]){pianoN(lb,at(k),k===0?0.1:0.07,bd*1.1);pianoN(lb+12,at(k),k===0?0.07:0.05,bd*0.9)}
    /* 현: 구성음을 한 마디 내내 낮게 */
    C.t.forEach((o,i)=>strN(R+o-12,T+i*0.02,bd*4,fight?0.014:0.011));
    /* 오른손: 16분 되풀이 음형 (낮은 음 → 가운데 → 높은 음 → 가운데), 박 머리에 힘을 준다 */
    const pat=[0,1,2,1, 0,1,3,1, 0,2,3,2, 1,2,3,2];
    pat.forEach((ix,n)=>{const m=R+C.t[ix];pianoN(m,at(n/4),(n%4===0?0.05:0.032)*(fight?1.15:1),bd*0.55)});
    /* 선율: 박 머리마다 눌러 내리는 음 (가운데 음역에 머무르고, 전투에서만 옥타브 위가 작게 겹친다) */
    {const ix0=Math.floor(rnd()*C.sc.length);[0,1,2,3].forEach((k,i)=>{const m=R-12+C.sc[(ix0+i*2)%C.sc.length];if(rnd()<(fight?0.9:0.55)){pianoN(m,at(k+0.5),fight?0.045:0.035,bd*1.2);if(fight)pianoN(m+12,at(k+0.5),0.014,bd*0.9)}})}
    /* 타악 */
    if(fight){for(let k=0;k<4;k++)feather(at(k),0.11)}else{feather(at(0),0.1);feather(at(2),0.09)}
    for(const k of [1,3])snare(at(k),fight?0.05:0.04);
    if(fight&&last)for(let n=1;n<4;n++)snare(at(3+n*0.25),0.025+0.008*n);
    if(barN%2===0)boom(T,fight?0.2:0.15);
    barT=T+4*bd;barN++;
  }
  function schedule(now,M){
    if(lastScene!==scene||lastStyle!==style){if(lastStyle!==style)barN=0;lastScene=scene;lastStyle=style;newEpoch();barT=now+0.32}
    if(barT<now)barT=now+0.05;
    const wet=bus._wet;if(wet&&now>duckUntil)wet.gain.setTargetAtTime(M.wet*(scene==='fight'?0.7:1)*(style==='passion'?0.7:1),now,0.6);
    bright.frequency.setTargetAtTime(M.cut*P.cutMul[style][scene],now,2);
    let g=0;while(barT<now+2.2&&g++<1)(style==='passion'?barPassion:barLobby)(barT,M);
  }
  function tick(){
    if(!ctx||!on||hidden)return;
    schedule(ctx.currentTime,P.moods[mood]||P.moods.base);
  }
  function start(){
    if(!ensure())return false;
    ctx.resume&&ctx.resume();
    if(!timer)timer=setInterval(tick,350);
    newEpoch();barT=ctx.currentTime+0.1;barN=0;lastScene=scene;lastStyle=style;
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
    else if(on){ctx.resume().then(()=>{newEpoch();barT=ctx.currentTime+0.1;ramp(gainOf(vol),1.2)})}
  });
  return {
    supported:!!AC,
    isOn:()=>on,vol:()=>vol,
    level:()=>{if(!analyser)return null;const d=new Float32Array(2048);analyser.getFloatTimeDomainData(d);let p=0,q=0;for(const v of d){const a=Math.abs(v);if(a>p)p=a;q+=v*v}return {peakDb:+(20*Math.log10(p+1e-9)).toFixed(1),rmsDb:+(10*Math.log10(q/d.length+1e-12)).toFixed(1)}},
    debug:()=>({state:ctx&&ctx.state,gain:master?master.gain.value:null,on,vol,mood,scene,style}),
    /* 켜기/끄기: 켜는 것은 사용자가 누른 순간(클릭 처리 안)에서만 호출해야 한다 */
    set(v){if(v===on)return on;on=!!v;if(on)start();else stop();return on},
    setVol(v){vol=Math.max(0,Math.min(1,+v||0));if(on&&ctx)ramp(gainOf(vol),0.3)},
    setMood(k){if(P.moods[k])mood=k},
    setScene(k){scene=k==='fight'?'fight':'calm'},
    style:()=>style,
    setStyle(k){if(k==='calm'||k==='passion')style=k}
  };
}
