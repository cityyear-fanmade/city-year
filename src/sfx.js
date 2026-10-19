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
  function play(kind){
    if(!isOn()||!ensure())return;
    const v=getVol();if(!(v>0))return;
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
  return {play,supported:!!AC};
}
