/* 효과음: 외부 음원 없이 Web Audio로 합성한다. 주사위가 멈출 때의 둔탁한 '뚝' 소리만 쓴다.
   높고 날카로운 '딱' 잡음은 빼고, 나무 몸통이 울리는 낮은 공명 + 낮은 둔탁함 + 방에 남는 짧은 잔향으로 만든다 */
export function createSfx(isOn,getVol){
  const AC=typeof window!=='undefined'&&(window.AudioContext||window.webkitAudioContext);
  let ctx=null,nb=null,room=null;
  const ensure=()=>{
    if(!AC)return false;
    if(!ctx){
      ctx=new AC();
      nb=ctx.createBuffer(1,ctx.sampleRate*0.5,ctx.sampleRate);const d=nb.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;
      /* 짧은 방 울림: 감쇠하는 잡음으로 만든 잔향 */
      const len=Math.floor(ctx.sampleRate*0.35),ib=ctx.createBuffer(2,len,ctx.sampleRate);
      for(let c=0;c<2;c++){const x=ib.getChannelData(c);for(let i=0;i<len;i++)x[i]=(Math.random()*2-1)*Math.pow(1-i/len,3.2)}
      room=ctx.createConvolver();room.buffer=ib;room.connect(ctx.destination);
    }
    if(ctx.state==='suspended')ctx.resume();
    return true;
  };
  /* crack은 쓰지 않는다(날카로운 '딱' 제거) · body: 몸통 공명(Hz 두 개와 길이) · room: 잔향 양 */
  const P={
    snap:{crack:[3800,1.6,0.028,0.9],body:[[520,0.085,0.55],[1180,0.05,0.25]],room:0.45,g:1.0},
    hit: {crack:[2600,1.2,0.03,0.8], body:[[340,0.09,0.7],[760,0.055,0.3]],room:0.35,g:0.95},
    dodge:{crack:[1900,1.0,0.034,0.65],body:[[260,0.1,0.75],[590,0.06,0.3]],room:0.35,g:0.95},
    tick:{crack:[2200,1.0,0.025,0.6],body:[[300,0.07,0.6],[690,0.045,0.25]],room:0.25,g:0.85}
  };
  /* 결과음: 명중(impact·hard는 큰 피해) · 막음(block) · 회피(whoosh) */
  function result(kind){
    const v=getVol(),t=ctx.currentTime+0.005,det=1+(Math.random()-0.5)*0.1;
    const out=ctx.createGain();out.gain.value=Math.min(1,0.95*(0.25+v*0.85));out.connect(ctx.destination);
    const wet=ctx.createGain();wet.gain.value=kind==='hard'?0.5:0.3;out.connect(wet);wet.connect(room);
    const noise=(f,q,type,len,gn,rate=1,att=0.003)=>{const n=ctx.createBufferSource();n.buffer=nb;n.playbackRate.value=rate*det;
      const fl=ctx.createBiquadFilter();fl.type=type;fl.frequency.value=f;fl.Q.value=q;
      const g=ctx.createGain();g.gain.setValueAtTime(0.0001,t);g.gain.linearRampToValueAtTime(gn,t+att);g.gain.exponentialRampToValueAtTime(0.0008,t+len);
      n.connect(fl);fl.connect(g);g.connect(out);n.start(t);n.stop(t+len+0.03);return fl};
    const tone=(f,len,gn,f2)=>{const o=ctx.createOscillator(),g=ctx.createGain();o.type='triangle';o.frequency.setValueAtTime(f*det,t);if(f2)o.frequency.exponentialRampToValueAtTime(f2*det,t+len*0.8);
      g.gain.setValueAtTime(0.0001,t);g.gain.linearRampToValueAtTime(gn,t+0.003);g.gain.exponentialRampToValueAtTime(0.0008,t+len);
      o.connect(g);g.connect(out);o.start(t);o.stop(t+len+0.03)};
    if(kind==='whoosh'){
      /* 스쳐 지나가는 바람: 대역이 위로 쓸려 올라가고 조용히 사라진다 (피치 없는 잡음만) */
      const n=ctx.createBufferSource();n.buffer=nb;n.playbackRate.value=0.9*det;
      const bp=ctx.createBiquadFilter();bp.type='bandpass';bp.Q.value=1.1;bp.frequency.setValueAtTime(500,t);bp.frequency.exponentialRampToValueAtTime(2600,t+0.2);
      const g=ctx.createGain();g.gain.setValueAtTime(0.0001,t);g.gain.linearRampToValueAtTime(0.55,t+0.07);g.gain.exponentialRampToValueAtTime(0.0008,t+0.24);
      n.connect(bp);bp.connect(g);g.connect(out);n.start(t);n.stop(t+0.27);
    }else if(kind==='block'){
      /* 막는 소리: 방패에 닿는 둔한 울림 */
      noise(1400,0.9,'bandpass',0.05,0.5);tone(240,0.12,0.7,170);tone(610,0.07,0.35);noise(300,0.7,'lowpass',0.08,0.5,0.5);
    }else{
      const hard=kind==='hard';
      /* 맞는 소리: 낮은 몸통 + 둔탁한 살 + 짧은 잔향. 큰 피해는 더 낮고 길게 */
      noise(hard?260:340,0.7,'lowpass',hard?0.13:0.09,hard?0.95:0.75,0.5);
      tone(hard?95:130,hard?0.2:0.14,hard?0.95:0.75,hard?55:80);
      tone(hard?210:280,0.09,0.4);
      noise(1100,0.8,'bandpass',0.035,hard?0.35:0.22);
      if(hard)noise(180,0.7,'lowpass',0.26,0.5,0.35,0.01);
    }
  }
  /* 모바일 브라우저는 사용자가 누르기 전에는 오디오를 멈춰 둔다. 멈춘 채 예약하면 시작 시각이 지나 버려 소리가 사라지므로,
     처음 누를 때 미리 깨워 두고, 아직 멈춰 있으면 깨어난 뒤에 낸다 */
  const unlock=()=>{if(isOn()&&ensure()&&ctx.state==='suspended')ctx.resume()};
  function play(kind){
    if(!isOn()||!ensure())return;
    if(ctx.state!=='running'){ctx.resume().then(()=>{if(ctx.state==='running')play(kind)}).catch(()=>{});return}
    const v=getVol();if(!(v>0))return;
    if(kind==='impact'||kind==='hard'||kind==='block'||kind==='whoosh'){result(kind);return}
    const p=P[kind]||P.tick,t=ctx.currentTime+0.005,det=1+(Math.random()-0.5)*0.12;
    const out=ctx.createGain();out.gain.value=Math.min(1,p.g*(0.25+v*0.85));
    out.connect(ctx.destination);
    const wet=ctx.createGain();wet.gain.value=p.room;out.connect(wet);wet.connect(room);
    /* 몸통 공명: 부딪힌 나무가 울리는 소리. 피치를 내리지 않고 그대로 줄어들게 해서 '뚝'하고 꺾이지 않게 한다 */
    for(const [f,len,gn] of p.body){
      const o=ctx.createOscillator(),g=ctx.createGain();o.type='triangle';o.frequency.value=f*det;
      g.gain.setValueAtTime(0.0001,t);g.gain.linearRampToValueAtTime(gn*0.5,t+0.002);g.gain.exponentialRampToValueAtTime(0.0008,t+len);
      const lp=ctx.createBiquadFilter();lp.type='lowpass';lp.frequency.value=f*3;
      o.connect(g);g.connect(lp);lp.connect(out);o.start(t);o.stop(t+len+0.03)}
    /* 낮은 둔탁함 */
    {const n=ctx.createBufferSource();n.buffer=nb;n.playbackRate.value=0.5*det;
      const lp=ctx.createBiquadFilter();lp.type='lowpass';lp.frequency.value=420;
      const g=ctx.createGain();g.gain.setValueAtTime(0.0001,t);g.gain.linearRampToValueAtTime(0.5,t+0.003);g.gain.exponentialRampToValueAtTime(0.0008,t+0.07);
      n.connect(lp);lp.connect(g);g.connect(out);n.start(t);n.stop(t+0.1)}
  }
  return {play,unlock,state:()=>ctx?ctx.state+' · '+ctx.sampleRate+'Hz':'아직 만들어지지 않음',supported:!!AC};
}
