/* 배경음악: 외부 음원 없이 Web Audio로 합성하는 잔잔한 앰비언트 (저작권 문제 없음).
   - 기본은 꺼져 있고, 사용자가 설정에서 켠 뒤에만 소리가 난다 (브라우저 정책상 한 번 눌러야 시작)
   - 시작할 때 마스터 음량을 0에서 서서히 올리고, 전체 출력은 컴프레서와 최대 음량 상한을 거친다 */
export function createBgm(){
  /* 모든 값은 여기서 조절한다 */
  const P={
    maxGain:1,          // 음량 100%일 때 마스터 음량 (음원 자체가 작게 만들어져 있어 1을 넘기지 않는다)
    fadeIn:3,           // 켤 때 서서히 커지는 시간(초)
    fadeOut:0.8,        // 끌 때 서서히 줄어드는 시간(초)
    chordEvery:{calm:11,fight:7},
    bpm:124,            // 전투 장면의 박자 (8분음표 단위로 움직이는 전진하는 리듬)
    moods:{
      base:    {root:57,scale:[0,3,7,10,12],cut:700,bell:0.9},
      dante:   {root:50,scale:[0,3,7,8,12],cut:480,bell:0.5},
      terminal:{root:64,scale:[0,2,7,9,12],cut:1100,bell:1.2},
      ruina:   {root:55,scale:[0,4,7,11,12],cut:800,bell:1.4}
    }
  };
  let ctx=null,master=null,pad=null,analyser=null,noiseBuf=null,stepT=0,step=0,on=false,vol=0.3,mood='base',scene='calm',timer=null,nextChord=0,nextBell=0,hidden=false;
  const AC=typeof window!=='undefined'&&(window.AudioContext||window.webkitAudioContext);
  const hz=m=>440*Math.pow(2,(m-69)/12);
  /* 사용자 음량(0~1) → 마스터 음량. 음원 합이 최대 약 0.2라서 음량 0.3이면 최고점이 약 −24dB이다 */
  const gainOf=v=>on?P.maxGain*v:0;
  function ensure(){
    if(ctx||!AC)return !!ctx;
    ctx=new AC();
    const comp=ctx.createDynamicsCompressor();comp.threshold.value=-26;comp.knee.value=20;comp.ratio.value=10;comp.attack.value=0.01;comp.release.value=0.3;
    master=ctx.createGain();master.gain.value=0;
    pad=ctx.createBiquadFilter();pad.type='lowpass';pad.frequency.value=P.moods.base.cut;pad.Q.value=0.4;
    pad.connect(master);master.connect(comp);comp.connect(ctx.destination);
    analyser=ctx.createAnalyser();analyser.fftSize=2048;comp.connect(analyser);
    noiseBuf=ctx.createBuffer(1,ctx.sampleRate*0.2,ctx.sampleRate);{const d=noiseBuf.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1}
    return true;
  }
  function ramp(target,t){
    if(!ctx)return;const g=master.gain,now=ctx.currentTime;
    g.cancelScheduledValues(now);g.setValueAtTime(g.value,now);g.linearRampToValueAtTime(target,now+t);
  }
  function note(m,when,dur,peak,type){
    const o=ctx.createOscillator(),g=ctx.createGain();o.type=type||'sine';o.frequency.value=hz(m);o.detune.value=(Math.random()-0.5)*10;
    g.gain.setValueAtTime(0.0001,when);g.gain.linearRampToValueAtTime(peak,when+dur*0.35);g.gain.linearRampToValueAtTime(0.0001,when+dur);
    o.connect(g);g.connect(pad);o.start(when);o.stop(when+dur+0.05);
  }
  function bell(m,when,peak){
    const o=ctx.createOscillator(),g=ctx.createGain();o.type='sine';o.frequency.value=hz(m);
    g.gain.setValueAtTime(0.0001,when);g.gain.linearRampToValueAtTime(peak,when+0.02);g.gain.exponentialRampToValueAtTime(0.0001,when+3.2);
    o.connect(g);g.connect(master);o.start(when);o.stop(when+3.3);
  }
  /* ── 전투 장면: 전진하는 리듬 (낮은 저음 + 부드러운 박동 + 8분음표 아르페지오). 선율은 매번 조금씩 다르게 즐거나 비운다 ── */
  function kick(t,peak){
    const o=ctx.createOscillator(),g=ctx.createGain();o.type='sine';o.frequency.setValueAtTime(110,t);o.frequency.exponentialRampToValueAtTime(42,t+0.13);
    g.gain.setValueAtTime(0.0001,t);g.gain.linearRampToValueAtTime(peak,t+0.008);g.gain.exponentialRampToValueAtTime(0.0001,t+0.22);
    o.connect(g);g.connect(master);o.start(t);o.stop(t+0.25);
  }
  function bassN(m,t,dur,peak){
    const o=ctx.createOscillator(),f=ctx.createBiquadFilter(),g=ctx.createGain();o.type='sawtooth';o.frequency.value=hz(m);f.type='lowpass';f.frequency.value=260;f.Q.value=0.7;
    g.gain.setValueAtTime(0.0001,t);g.gain.linearRampToValueAtTime(peak,t+0.02);g.gain.linearRampToValueAtTime(peak*0.5,t+dur*0.7);g.gain.linearRampToValueAtTime(0.0001,t+dur);
    o.connect(f);f.connect(g);g.connect(master);o.start(t);o.stop(t+dur+0.05);
  }
  function pluck(m,t,peak){
    const o=ctx.createOscillator(),g=ctx.createGain();o.type='triangle';o.frequency.value=hz(m);
    g.gain.setValueAtTime(0.0001,t);g.gain.linearRampToValueAtTime(peak,t+0.01);g.gain.exponentialRampToValueAtTime(0.0001,t+0.34);
    o.connect(g);g.connect(pad);o.start(t);o.stop(t+0.38);
  }
  function tickN(t,peak){
    const n=ctx.createBufferSource(),f=ctx.createBiquadFilter(),g=ctx.createGain();n.buffer=noiseBuf;f.type='highpass';f.frequency.value=6500;
    g.gain.setValueAtTime(peak,t);g.gain.exponentialRampToValueAtTime(0.0001,t+0.05);n.connect(f);f.connect(g);g.connect(master);n.start(t);n.stop(t+0.06);
  }
  function seq(now,M){
    const sd=60/P.bpm/2;if(stepT<now)stepT=now+0.05;
    const bassSteps=[0,3,6,8,11,14],ARP=[0,2,1,3,2,4,3,2];
    while(stepT<now+1.6){
      const s=step%16,t=stepT;
      if(s%2===0)kick(t,s%8===0?0.14:0.08);
      if(bassSteps.includes(s))bassN(M.root-24+(s===6||s===14?M.scale[2]:0),t,sd*1.7,0.08);
      if(s%2===1)tickN(t,0.025);
      /* 아르페지오: 정해진 윤곽에서 가끔 한 음을 바꾸거나 쉰다 */
      const sk=Math.random()<0.18;if(!sk){let i=ARP[s%8];if(Math.random()<0.2)i=(i+1)%M.scale.length;pluck(M.root+12+M.scale[i%M.scale.length],t,s%4===0?0.035:0.024)}
      stepT+=sd;step++;
    }
  }
  function tick(){
    if(!ctx||!on||hidden)return;
    const M=P.moods[mood]||P.moods.base,now=ctx.currentTime;
    pad.frequency.setTargetAtTime(M.cut*(scene==='fight'?1.5:1),now,2);
    /* 화음: 음계에서 3개 음을 골라 길게 깔고, 맨 아래에 근음을 낮은 옥타브로 둔다 */
    if(now>=nextChord-0.3){
      const dur=P.chordEvery[scene]+4,w=Math.max(now,nextChord),pick=[...M.scale].sort(()=>Math.random()-0.5).slice(0,3);
      note(M.root-12,w,dur,0.05,'sine');
      for(const s of pick){note(M.root+s,w,dur,0.035,'triangle');note(M.root+s,w+0.2,dur,0.02,'sine')}
      nextChord=w+P.chordEvery[scene];
    }
    if(scene==='fight')seq(now,M);else stepT=0;
    /* 드문드문 울리는 높은 음 */
    if(now>=nextBell){
      const s=M.scale[Math.floor(Math.random()*M.scale.length)];
      if(scene!=='fight')bell(M.root+12+s,now+0.05,0.03);
      nextBell=now+(5+Math.random()*7)/M.bell/(scene==='fight'?1.3:1);
    }
  }
  function start(){
    if(!ensure())return false;
    ctx.resume&&ctx.resume();
    if(!timer)timer=setInterval(tick,900);
    nextChord=ctx.currentTime;nextBell=ctx.currentTime+3;
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
    else if(on){ctx.resume().then(()=>{ramp(gainOf(vol),1.2)})}
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
