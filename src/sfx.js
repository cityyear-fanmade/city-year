/* 효과음: 외부 음원 없이 Web Audio로 합성한다. 주사위가 멈출 때의 둔탁한 '뚝' 소리만 쓴다.
   높고 날카로운 '딱' 잡음은 빼고, 나무 몸통이 울리는 낮은 공명 + 낮은 둔탁함 + 방에 남는 짧은 잔향으로 만든다 */
export function createSfx(isOn,getVol){
  const AC=typeof window!=='undefined'&&(window.AudioContext||window.webkitAudioContext);
  let ctx=null,nb=null,room=null,comp=null;const rnd=Math.random;
  const ensure=()=>{
    if(!AC)return false;
    if(!ctx){
      ctx=new AC();
      nb=ctx.createBuffer(1,ctx.sampleRate*0.5,ctx.sampleRate);const d=nb.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;
      /* 짧은 방 울림: 감쇠하는 잡음으로 만든 잔향 */
      const len=Math.floor(ctx.sampleRate*0.35),ib=ctx.createBuffer(2,len,ctx.sampleRate);
      for(let c=0;c<2;c++){const x=ib.getChannelData(c);for(let i=0;i<len;i++)x[i]=(Math.random()*2-1)*Math.pow(1-i/len,3.2)}
      comp=ctx.createGain();comp.gain.value=1;comp.connect(ctx.destination);
      room=ctx.createConvolver();room.buffer=ib;room.connect(comp);
    }
    if(ctx.state==='suspended')ctx.resume();
    return true;
  };
  /* crack은 쓰지 않는다(날카로운 '딱' 제거) · body: 몸통 공명(Hz 두 개와 길이) · room: 잔향 양 */
  const P={
    snap:{crack:[3800,1.6,0.028,0.9],body:[[1100,0.07,0.55],[2400,0.045,0.3]],room:0.4,g:1.0},
    hit: {crack:[2600,1.2,0.03,0.8], body:[[800,0.08,0.6],[1900,0.05,0.3]],room:0.35,g:0.95},
    dodge:{crack:[1900,1.0,0.034,0.65],body:[[620,0.09,0.6],[1500,0.06,0.3]],room:0.35,g:0.95},
    tick:{crack:[2200,1.0,0.025,0.6],body:[[1500,0.04,0.5],[3100,0.03,0.25]],room:0.25,g:0.85}
  };
  /* 결과음: 명중(impact·hard는 큰 피해) · 막음(block) · 회피(whoosh) */
  function result(kind){
    const hk=['impact','hard','slash','pierce','blunt','slash_h','pierce_h','blunt_h'].includes(kind),big=kind==='hard'||kind.endsWith('_h');
    const v=getVol(),t0=ctx.currentTime+0.005,t=t0+(hk?0.07:0),det=1+(Math.random()-0.5)*0.1;
    const out=ctx.createGain();out.gain.value=Math.min(1,0.85*(0.25+v*0.85));out.connect(comp);
    const wet=ctx.createGain();wet.gain.value=big?0.5:0.3;out.connect(wet);wet.connect(room);
    const noise=(f,q,type,len,gn,rate=1,att=0.003)=>{const n=ctx.createBufferSource();n.buffer=nb;n.playbackRate.value=rate*det;
      const fl=ctx.createBiquadFilter();fl.type=type;fl.frequency.value=f;fl.Q.value=q;
      const g=ctx.createGain();g.gain.setValueAtTime(0.0001,t);g.gain.linearRampToValueAtTime(gn,t+att);g.gain.exponentialRampToValueAtTime(0.0008,t+len);
      n.connect(fl);fl.connect(g);g.connect(out);n.start(t);n.stop(t+len+0.03);return fl};
    const tone=(f,len,gn,f2)=>{const o=ctx.createOscillator(),g=ctx.createGain();o.type='triangle';o.frequency.setValueAtTime(f*det,t);if(f2)o.frequency.exponentialRampToValueAtTime(f2*det,t+len*0.8);
      g.gain.setValueAtTime(0.0001,t);g.gain.linearRampToValueAtTime(gn,t+0.003);g.gain.exponentialRampToValueAtTime(0.0008,t+len);
      o.connect(g);g.connect(out);o.start(t);o.stop(t+len+0.03)};
    /* 타격 직전: 역재생처럼 짧게 차오르는 바람 소리 뒤에 아주 잠깐 비워 두어 타격이 더 세게 들린다 */
    if(hk){const n=ctx.createBufferSource();n.buffer=nb;n.playbackRate.value=1.1;const bp=ctx.createBiquadFilter();bp.type='bandpass';bp.Q.value=1.2;bp.frequency.setValueAtTime(500,t0);bp.frequency.exponentialRampToValueAtTime(3200,t0+0.065);
      const g=ctx.createGain();g.gain.setValueAtTime(0.0001,t0);g.gain.exponentialRampToValueAtTime(big?0.5:0.32,t0+0.06);g.gain.linearRampToValueAtTime(0.0001,t0+0.07);n.connect(bp);bp.connect(g);g.connect(out);n.start(t0);n.stop(t0+0.08)}
    if(kind==='whoosh'){
      /* 스쳐 지나가는 바람: 대역이 위로 쓸려 올라가고 조용히 사라진다 (피치 없는 잡음만) */
      const n=ctx.createBufferSource();n.buffer=nb;n.playbackRate.value=0.9*det;
      const bp=ctx.createBiquadFilter();bp.type='bandpass';bp.Q.value=1.1;bp.frequency.setValueAtTime(380,t);bp.frequency.exponentialRampToValueAtTime(1500,t+0.22);
      /* 빗나감은 맞았을 때보다 작고 먹먹하게: 허공을 가르는 소리만 낮게 지나간다 */
      const lp=ctx.createBiquadFilter();lp.type='lowpass';lp.frequency.value=1700;
      const g=ctx.createGain();g.gain.setValueAtTime(0.0001,t);g.gain.linearRampToValueAtTime(0.9,t+0.08);g.gain.exponentialRampToValueAtTime(0.0008,t+0.26);
      n.connect(bp);bp.connect(lp);lp.connect(g);g.connect(out);n.start(t);n.stop(t+0.3);
    }else if(kind==='block'){
      /* 막는 소리: 방패에 닿는 둔한 울림 */
      noise(2600,0.9,'bandpass',0.05,0.6);tone(1250,0.22,0.45);tone(1930,0.16,0.32);tone(3100,0.1,0.22);tone(420,0.1,0.4,300);
    }else if(kind.startsWith('slash')){
      /* 참격: 날카로운 쓸어내림 + 살이 갈리는 소리 */
      tone(big?1500:1900,0.07,0.5,big?600:800);noise(big?4200:5200,1.0,'bandpass',0.07,0.75);noise(big?1100:1500,0.8,'bandpass',0.1,0.7,0.8);tone(big?240:330,0.12,0.5,150);
      if(big)noise(300,0.7,'lowpass',0.18,0.4,0.45,0.01);
    }else if(kind.startsWith('pierce')){
      /* 관통: 짧게 박히는 둔탁한 퍽 + 뚫고 들어가는 소리 */
      tone(big?300:420,0.1,0.6,150);noise(big?700:1000,0.9,"bandpass",0.06,0.6,0.7);noise(2800,1.0,'bandpass',0.025,0.45);tone(big?120:170,0.14,0.7,80);
    }else if(kind.startsWith('blunt')){
      /* 타격: 묵직한 쿵 + 뼈가 울리는 갈라짐 */
      tone(big?150:220,big?0.22:0.15,0.95,big?85:120);noise(big?600:900,0.7,'lowpass',big?0.2:0.13,0.9,0.5);noise(2400,1.0,'bandpass',0.035,0.55);
      if(big){noise(1700,1.4,'bandpass',0.05,0.4,1.3,0.002);tone(70,0.26,0.6,45)}
    }else{
      const hard=kind==='hard';
      /* 맞는 소리: 낮은 몸통 + 둔탁한 살 + 짧은 잔향. 큰 피해는 더 낮고 길게 */
      noise(hard?900:1500,0.8,'bandpass',hard?0.14:0.09,hard?0.95:0.8,0.8);
      tone(hard?190:270,hard?0.18:0.12,hard?0.8:0.65,hard?120:180);
      tone(hard?560:760,0.08,0.45);
      noise(3800,0.9,'bandpass',0.03,hard?0.5:0.35);
      if(hard)noise(320,0.7,'lowpass',0.22,0.45,0.45,0.01);
    }
  }
  /* 모바일 브라우저는 사용자가 누르기 전에는 오디오를 멈춰 둔다. 멈춘 채 예약하면 시작 시각이 지나 버려 소리가 사라지므로,
     처음 누를 때 미리 깨워 두고, 아직 멈춰 있으면 깨어난 뒤에 낸다 */
  const unlock=()=>{if(isOn()&&ensure()&&ctx.state==='suspended')ctx.resume()};
  function play(kind){
    if(!isOn()||!ensure())return;
    if(ctx.state!=='running'){ctx.resume().then(()=>{if(ctx.state==='running')play(kind)}).catch(()=>{});return}
    const v=getVol();if(!(v>0))return;
    if(/^(impact|hard|block|whoosh|slash|pierce|blunt)/.test(kind)){result(kind);return}
    const p=P[kind]||P.tick,t=ctx.currentTime+0.005,det=1+(Math.random()-0.5)*0.12;
    const out=ctx.createGain();out.gain.value=Math.min(2.2,1.4*p.g*(0.25+v*0.85));
    out.connect(comp);
    const wet=ctx.createGain();wet.gain.value=p.room;out.connect(wet);wet.connect(room);
    /* 몸통 공명: 부딪힌 나무가 울리는 소리. 피치를 내리지 않고 그대로 줄어들게 해서 '뚝'하고 꺾이지 않게 한다 */
    for(const [f,len,gn] of p.body){
      const o=ctx.createOscillator(),g=ctx.createGain();o.type='triangle';o.frequency.value=f*det;
      g.gain.setValueAtTime(0.0001,t);g.gain.linearRampToValueAtTime(gn*0.5,t+0.002);g.gain.exponentialRampToValueAtTime(0.0008,t+len);
      const lp=ctx.createBiquadFilter();lp.type='lowpass';lp.frequency.value=f*3;
      o.connect(g);g.connect(lp);lp.connect(out);o.start(t);o.stop(t+len+0.03)}
    /* 낮은 둔탁함 */
    {const n=ctx.createBufferSource();n.buffer=nb;n.playbackRate.value=0.5*det;
      const lp=ctx.createBiquadFilter();lp.type='lowpass';lp.frequency.value=900;
      const g=ctx.createGain();g.gain.setValueAtTime(0.0001,t);g.gain.linearRampToValueAtTime(0.5,t+0.003);g.gain.exponentialRampToValueAtTime(0.0008,t+0.07);
      n.connect(lp);lp.connect(g);g.connect(out);n.start(t);n.stop(t+0.1)}
    /* 돌 주사위: 굴러가는 첫 소리(snap)는 거친 돌끼리 부딪히는 딸깍 두세 번, 눈이 정해지는 소리는 짧고 굵게 */
    if(kind==='snap')for(const [dt,gn] of [[0.05,0.55],[0.11,0.4]]){const n=ctx.createBufferSource();n.buffer=nb;n.playbackRate.value=0.9*det;const bp=ctx.createBiquadFilter();bp.type='bandpass';bp.frequency.value=1700*(0.9+rnd()*0.3);bp.Q.value=1.6;
      const g=ctx.createGain(),tt=t+dt;g.gain.setValueAtTime(0.0001,tt);g.gain.linearRampToValueAtTime(gn,tt+0.002);g.gain.exponentialRampToValueAtTime(0.0008,tt+0.05);n.connect(bp);bp.connect(g);g.connect(out);n.start(tt);n.stop(tt+0.07)}
    /* 폰 스피커에서도 들리도록 중고음의 짧은 딸깍 */
    {const n=ctx.createBufferSource();n.buffer=nb;n.playbackRate.value=1.2*det;const bp=ctx.createBiquadFilter();bp.type='bandpass';bp.frequency.value=3200;bp.Q.value=1.1;
      const g=ctx.createGain();g.gain.setValueAtTime(0.0001,t);g.gain.linearRampToValueAtTime(0.4,t+0.002);g.gain.exponentialRampToValueAtTime(0.0008,t+0.035);
      n.connect(bp);bp.connect(g);g.connect(out);n.start(t);n.stop(t+0.05)}
  }
  return {play,unlock,state:()=>ctx?ctx.state+' · '+ctx.sampleRate+'Hz':'아직 만들어지지 않음',supported:!!AC};
}
