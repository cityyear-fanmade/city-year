/* 효과음: 외부 음원 없이 Web Audio로 합성한다. 주사위가 멈출 때의 '탁' 소리만 쓴다 */
export function createSfx(isOn,getVol){
  const AC=typeof window!=='undefined'&&(window.AudioContext||window.webkitAudioContext);
  let ctx=null,nb=null;
  const ensure=()=>{
    if(!AC)return false;
    if(!ctx){ctx=new AC();nb=ctx.createBuffer(1,ctx.sampleRate*0.3,ctx.sampleRate);const d=nb.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1}
    if(ctx.state==='suspended')ctx.resume();
    return true;
  };
  /* kind: snap(합 시작, 손가락 튕기는 소리) · hit(명중 주사위 멈춤, 높고 단단하게) · dodge(회피 주사위 멈춤, 조금 낮게) · tick(사건 판정) */
  const P={snap:{f:2600,q:1.4,len:0.07,thump:190,g:1.0},hit:{f:2100,q:1.1,len:0.05,thump:150,g:0.8},dodge:{f:1500,q:1.0,len:0.05,thump:120,g:0.75},tick:{f:1800,q:1.0,len:0.045,thump:140,g:0.7}};
  function play(kind){
    if(!isOn()||!ensure())return;
    const v=getVol();if(!(v>0))return;
    const p=P[kind]||P.tick,t=ctx.currentTime,out=ctx.createGain();
    out.gain.value=Math.min(1,0.9*p.g*(0.35+v*0.9));out.connect(ctx.destination);
    const n=ctx.createBufferSource();n.buffer=nb;
    const bp=ctx.createBiquadFilter();bp.type='bandpass';bp.frequency.value=p.f;bp.Q.value=p.q;
    const ng=ctx.createGain();ng.gain.setValueAtTime(1,t);ng.gain.exponentialRampToValueAtTime(0.001,t+p.len);
    n.connect(bp);bp.connect(ng);ng.connect(out);n.start(t);n.stop(t+p.len+0.02);
    const o=ctx.createOscillator(),og=ctx.createGain();o.type='sine';
    o.frequency.setValueAtTime(p.thump*1.6,t);o.frequency.exponentialRampToValueAtTime(p.thump*0.6,t+0.08);
    og.gain.setValueAtTime(0.9,t);og.gain.exponentialRampToValueAtTime(0.001,t+0.1);
    o.connect(og);og.connect(out);o.start(t);o.stop(t+0.12);
  }
  return {play,supported:!!AC};
}
