/* 배경음악: 외부 음원 없이 Web Audio로 합성한다 (저작권 문제 없음). 직접 만든 코드 진행과 리듬이다.
   - 기본은 꺼져 있고, 사용자가 설정에서 켠 뒤에만 소리가 난다 (브라우저 정책상 한 번 눌러야 시작)
   - 켤 때 마스터 음량을 0에서 서서히 올리고, 전체 출력은 컴프레서를 거친다
   - 평소(calm)는 느린 피아노풍 아르페지오와 부드러운 화음, 전투(fight)는 전진하는 박동과 저음이 붙는다 */
export function createBgm(){
  /* 모든 값은 여기서 조절한다 */
  const P={
    maxGain:2,          // 음량 100%일 때 마스터 음량 (컴프레서가 최고점을 눌러 준다)
    fadeIn:3,           // 켤 때 서서히 커지는 시간(초)
    fadeOut:0.8,        // 끌 때 서서히 줄어드는 시간(초)
    bpm:{calm:72,fight:124},
    /* 코드 진행(근음에서의 반음 수): i · VI · III · VII. 한 마디(8분음표 8개)마다 하나씩 */
    prog:[[0,3,7],[8,12,15],[3,7,10],[10,14,17]],
    progRoot:[0,8,3,10],
    moods:{
      base:    {root:57,cut:1400,bell:1,wet:0.28},
      dante:   {root:50,cut:900,bell:0.6,wet:0.3},
      terminal:{root:64,cut:2200,bell:1.2,wet:0.2},
      ruina:   {root:55,cut:1600,bell:1.4,wet:0.34}
    }
  };
  let ctx=null,master=null,bus=null,warm=null,bright=null,analyser=null,noiseBuf=null,on=false,vol=0.3,mood='base',scene='calm',timer=null,hidden=false;
  let stepT=0,step=0,bar=0,lastScene='calm',nextBell=0;
  const AC=typeof window!=='undefined'&&(window.AudioContext||window.webkitAudioContext);
  const hz=m=>440*Math.pow(2,(m-69)/12);
  /* 사용자 음량(0~1) → 마스터 음량. 측정: 100%에서 평균 약 −18dBFS, 최고점 약 −3dBFS */
  const gainOf=v=>on?P.maxGain*v:0;
  function ensure(){
    if(ctx||!AC)return !!ctx;
    ctx=new AC();
    const comp=ctx.createDynamicsCompressor();comp.threshold.value=-26;comp.knee.value=20;comp.ratio.value=10;comp.attack.value=0.01;comp.release.value=0.3;
    master=ctx.createGain();master.gain.value=0;
    bus=ctx.createGain();bus.connect(master);
    /* 울림: 짧은 되울림(딜레이)을 살짝 섞는다 */
    const dl=ctx.createDelay(1),fb=ctx.createGain(),lp=ctx.createBiquadFilter(),wet=ctx.createGain();dl.delayTime.value=0.34;fb.gain.value=0.32;lp.type='lowpass';lp.frequency.value=2400;wet.gain.value=P.moods.base.wet;
    bus.connect(dl);dl.connect(lp);lp.connect(fb);fb.connect(dl);lp.connect(wet);wet.connect(master);bus._wet=wet;
    warm=ctx.createBiquadFilter();warm.type='lowpass';warm.frequency.value=900;warm.Q.value=0.5;warm.connect(bus);
    bright=ctx.createBiquadFilter();bright.type='lowpass';bright.frequency.value=P.moods.base.cut;bright.Q.value=0.4;bright.connect(bus);
    master.connect(comp);comp.connect(ctx.destination);
    analyser=ctx.createAnalyser();analyser.fftSize=2048;comp.connect(analyser);
    noiseBuf=ctx.createBuffer(1,ctx.sampleRate*0.2,ctx.sampleRate);{const d=noiseBuf.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1}
    return true;
  }
  function ramp(target,t){
    if(!ctx)return;const g=master.gain,now=ctx.currentTime;
    g.cancelScheduledValues(now);g.setValueAtTime(g.value,now);g.linearRampToValueAtTime(target,now+t);
  }
  /* 악기들 */
  function pluck(m,t,peak,dur){            // 피아노풍: 짧게 때리고 길게 사그라든다
    const o=ctx.createOscillator(),o2=ctx.createOscillator(),g=ctx.createGain();o.type='triangle';o2.type='sine';o.frequency.value=hz(m);o2.frequency.value=hz(m+12);
    const g2=ctx.createGain();g2.gain.value=0.25;
    g.gain.setValueAtTime(0.0001,t);g.gain.linearRampToValueAtTime(peak,t+0.012);g.gain.exponentialRampToValueAtTime(0.0001,t+(dur||1.4));
    o.connect(g);o2.connect(g2);g2.connect(g);g.connect(bright);o.start(t);o.stop(t+(dur||1.4)+0.05);o2.start(t);o2.stop(t+(dur||1.4)+0.05);
  }
  function padN(m,t,dur,peak){             // 현악풍 화음: 천천히 일어나 천천히 사라진다
    const o=ctx.createOscillator(),g=ctx.createGain();o.type='sawtooth';o.frequency.value=hz(m);
    g.gain.setValueAtTime(0.0001,t);g.gain.linearRampToValueAtTime(peak,t+dur*0.4);g.gain.linearRampToValueAtTime(0.0001,t+dur);
    o.connect(g);g.connect(warm);o.start(t);o.stop(t+dur+0.05);
  }
  function bassN(m,t,dur,peak,type){
    const o=ctx.createOscillator(),f=ctx.createBiquadFilter(),g=ctx.createGain();o.type=type||'sawtooth';o.frequency.value=hz(m);f.type='lowpass';f.frequency.value=380;f.Q.value=0.7;
    g.gain.setValueAtTime(0.0001,t);g.gain.linearRampToValueAtTime(peak,t+0.02);g.gain.linearRampToValueAtTime(peak*0.5,t+dur*0.7);g.gain.linearRampToValueAtTime(0.0001,t+dur);
    o.connect(f);f.connect(g);g.connect(master);o.start(t);o.stop(t+dur+0.05);
  }
  function kick(t,peak){
    const o=ctx.createOscillator(),g=ctx.createGain();o.type='sine';o.frequency.setValueAtTime(120,t);o.frequency.exponentialRampToValueAtTime(48,t+0.13);
    g.gain.setValueAtTime(0.0001,t);g.gain.linearRampToValueAtTime(peak,t+0.008);g.gain.exponentialRampToValueAtTime(0.0001,t+0.22);
    o.connect(g);g.connect(master);o.start(t);o.stop(t+0.25);
  }
  function tickN(t,peak){
    const n=ctx.createBufferSource(),f=ctx.createBiquadFilter(),g=ctx.createGain();n.buffer=noiseBuf;f.type='highpass';f.frequency.value=6500;
    g.gain.setValueAtTime(peak,t);g.gain.exponentialRampToValueAtTime(0.0001,t+0.05);n.connect(f);f.connect(g);g.connect(master);n.start(t);n.stop(t+0.06);
  }
  function bell(m,t,peak){
    const o=ctx.createOscillator(),g=ctx.createGain();o.type='sine';o.frequency.value=hz(m);
    g.gain.setValueAtTime(0.0001,t);g.gain.linearRampToValueAtTime(peak,t+0.02);g.gain.exponentialRampToValueAtTime(0.0001,t+3);
    o.connect(g);g.connect(bus);o.start(t);o.stop(t+3.1);
  }
  /* 한 마디씩 예약한다: 코드 진행 → 화음·저음·아르페지오(·전투면 박동) */
  function schedule(now,M){
    const fight=scene==='fight',sd=60/P.bpm[scene]/2;
    if(lastScene!==scene){lastScene=scene;stepT=now+0.1;step=0}
    if(stepT<now)stepT=now+0.05;
    const wet=bus._wet;if(wet)wet.gain.setTargetAtTime(M.wet*(fight?0.6:1),now,1.5);
    bright.frequency.setTargetAtTime(M.cut*(fight?1.4:1),now,2);
    while(stepT<now+1.6){
      const s=step%8,t=stepT,ci=Math.floor(step/8)%P.prog.length,ch=P.prog[ci],cr=M.root+P.progRoot[ci];
      if(s===0){
        /* 화음 */
        for(const o of ch)padN(M.root+o,t,sd*8+0.8,fight?0.016:0.02);
        bassN(cr-12,t,sd*(fight?3:7),fight?0.07:0.045,fight?'sawtooth':'triangle');
      }
      if(fight){
        if(s%2===0)kick(t,s===0?0.14:0.08);
        if(s===3||s===6)bassN(cr-12,t,sd*1.4,0.05,'sawtooth');
        if(s%2===1)tickN(t,0.025);
        const sk=Math.random()<0.15;if(!sk){const a=[0,1,2,1,2,1,0,2][s];pluck(M.root+12+ch[a%3]+(Math.random()<0.15?12:0),t,s%4===0?0.04:0.028,0.5)}
      }else{
        /* 평시: 느린 아르페지오 (코드 구성음을 오르내린다) */
        const a=[0,1,2,1,0,1,2,1][s];
        if(!(Math.random()<0.12))pluck(M.root+12+ch[a]+(s===4&&Math.random()<0.5?12:0),t,s%2===0?0.045:0.032,1.5);
      }
      stepT+=sd;step++;
    }
    if(now>=nextBell){
      if(!fight){const ch=P.prog[Math.floor(step/8)%P.prog.length];bell(M.root+24+ch[Math.floor(Math.random()*3)],now+0.05,0.025)}
      nextBell=now+(6+Math.random()*7)/M.bell;
    }
  }
  function tick(){
    if(!ctx||!on||hidden)return;
    schedule(ctx.currentTime,P.moods[mood]||P.moods.base);
  }
  function start(){
    if(!ensure())return false;
    ctx.resume&&ctx.resume();
    if(!timer)timer=setInterval(tick,700);
    stepT=ctx.currentTime+0.1;step=0;nextBell=ctx.currentTime+4;lastScene=scene;
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
    else if(on){ctx.resume().then(()=>{stepT=ctx.currentTime+0.1;ramp(gainOf(vol),1.2)})}
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
