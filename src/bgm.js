import {unlockIOSAudio} from './sfx.js';
/* 배경음악: 외부 음원 없이 Web Audio로 합성한다 (저작권 문제 없음). 직접 만든 곡이다.
   - 기본은 꺼져 있고, 사용자가 설정에서 켠 뒤에만 소리가 난다 (브라우저 정책상 한 번 눌러야 시작)
   - 켤 때 마스터 음량을 0에서 서서히 올리고, 전체 출력은 컴프레서를 거친다
   - 두 가지 스타일을 사용자가 고른다. 둘 다 32마디를 한 바퀴로 도는 곡이고, 구간(도입 → 선율 A → 선율 B → 되풀이)이 바뀌며 흐름이 생긴다
     · 고요(calm): 마을 곡처럼 적당히 들뜨는 잔잔함. 4/4박 · 템포 100(전투 132) · G 장조, 통통 튀는 베이스(근음·5음), 엇박 건반 반주, 가벼운 셰이커·림, 피리 같은 선율
       진행: Cmaj7 → D → Bm7 → Em7 → Am7 → D → G → G (IV-V-iii-vi 흐름)
     · 불길(passion): 묵직하고 신나는 전투 곡. 4/4박 · 템포 150(전투 168) · D 단조, 일그러진 파워 코드(끊어 치기/길게), 8분 질주 베이스 + 서브 베이스, 무거운 킥의 록 드럼, 16분 피아노 리프, 신스 선율 훅
       진행: Dm → Bb → F → C → Dm → Bb → Gm → A (i-VI-III-VII, 끝에 딸림화음으로 다시 당긴다) · 구간마다 심벌, 8마디 끝마다 스네어 필, 쉬어 가는 구간 뒤 다시 터진다
   - 히든 보스(boss 장면): 고요·불길 선택과 상관없이 전용 곡 하나. 느리고 무거운 도입(종 · 낮은 지속음 · 합창) 4마디 → 반박자 느낌의 묵직한 본 구간 → 몰아치는 구간(끝에 7/8 마디로 한 번 비튼다) → 숨 고르기 → 본 구간으로 되돌아간다
       C 단조(화성 단음계)에 감화음·나폴리 화음(Db)을 섞어 불길하게: Cm → Ab → Fm → G → Cm → Db → Bdim → G
   - 참고한 것은 장르의 흐름(템포·박자·구간 구성·악기 역할)뿐이고, 선율과 화성 진행은 직접 만들었다 */
export function createBgm(){
  /* 모든 값은 여기서 조절한다 */
  const P={
    maxGain:2,          // 음량 100%일 때 마스터 음량 (컴프레서가 최고점을 눌러 준다)
    fadeIn:3,           // 켤 때 서서히 커지는 시간(초)
    fadeOut:0.8,        // 끌 때 서서히 줄어드는 시간(초)
    bpm:{calm:{calm:100,fight:132},passion:{calm:150,fight:168},library:{calm:116,fight:176},wave:{calm:100,fight:132}},   // [스타일][장면]
    bossBpm:{intro:66,main:144},bossGain:0.62,bossCut:2400,
    styleGain:{calm:0.7,passion:0.6,library:1.0,wave:1.0},   // 스타일별 전체 음량 보정 (격정은 피아노 중심이라 잔잔과 비슷한 크기로 맞춘다)
    cutMul:{calm:{calm:0.8,fight:1},passion:{calm:1.1,fight:1.3},library:{calm:1.9,fight:2.3},wave:{calm:1.5,fight:1.5}}, // 장면별 밝기
    /* 코드(C=0 기준 반음): b=베이스 근음, t=구성음(피아노 · 현), sc=선율 음계 */
    /* 코드(C=0 기준 반음): b=베이스 근음, f=베이스 5음(근음 기준), t=반주 구성음 (가운데 도=0) */
    /* 불길(D 단조): Dm → Bb → F → C → Dm → Bb → Gm → A */
    pChords:[
      {b:2,f:7,t:[2,5,9,14]},{b:10,f:7,t:[-2,2,5,10]},{b:5,f:7,t:[0,5,9,12]},{b:0,f:7,t:[0,4,7,12]},
      {b:2,f:7,t:[2,5,9,14]},{b:10,f:7,t:[-2,2,5,10]},{b:7,f:7,t:[-5,-2,2,7]},{b:9,f:7,t:[-3,1,4,9]}
    ],
    /* 고요(G 장조): Cmaj7 → D → Bm7 → Em7 → Am7 → D → G → G */
    lobby:[
      {b:0,f:7,t:[4,7,11,12]},{b:2,f:7,t:[2,6,9,14]},{b:-1,f:7,t:[-1,2,6,9]},{b:4,f:7,t:[4,7,11,14]},
      {b:-3,f:7,t:[-3,0,4,7]},{b:2,f:7,t:[2,6,9,12]},{b:7,f:7,t:[-1,2,7,11]},{b:7,f:5,t:[0,2,7,12]}
    ],
    /* 선율: 마디마다 8칸(8분음표). 숫자=가운데 도 기준 반음 · '.'=앞 음을 잇는다 · '_'=쉰다 */
    /* 도서관(C 기준 재즈 진행): Dm9 → G7 → Cmaj9 → Fmaj7 → Bm7b5 → E7b9 → Am9 → A7alt. w=베이스가 걷는 두 번째·세 번째 음 */
    lChords:[
      {b:2,t:[5,9,12,16],w:[7,9]},{b:7,t:[5,11,14,16],w:[2,5]},{b:0,t:[4,7,11,14],w:[4,7]},{b:5,t:[4,9,12,16],w:[7,9]},
      {b:-1,t:[2,5,9,14],w:[2,5]},{b:4,t:[8,11,14,17],w:[8,11]},{b:-3,t:[0,4,7,11],w:[3,7]},{b:-3,t:[1,5,7,12],w:[4,7]}
    ],
    libA:['14 . 17 . 21 . 19 17','16 . 14 . 11 . 14 16','19 . . 16 . 14 12 .','9 . 12 . 16 . 19 .','17 . 14 . 11 . 9 .','8 . 11 . 14 . 17 .','16 . . 12 . 11 . 9','17 . 13 . 12 . 13 .'],
    libB:['21 . . 19 17 . 14 .','19 . . 16 14 . 11 .','16 . 19 . 23 . 21 19','17 . 16 . 12 . 9 .','17 . . 14 . 11 . 14','20 . 17 . 14 . 11 .','16 . 19 . 16 . 12 .','13 . 17 . 20 . 17 13'],
    /* 히든 보스(C 단조) */
    bChords:[{b:0,t:[0,3,7,12]},{b:8,t:[-4,0,3,8]},{b:5,t:[-7,-4,0,5]},{b:7,t:[-5,-1,2,7]},{b:0,t:[0,3,7,12]},{b:1,t:[1,5,8,13]},{b:11,t:[-1,2,5,8]},{b:7,t:[-5,-1,2,7]}],
    bossBell:[12,7,8,7,15,14,11,7],
    bossLead:['12 . . 15 14 . 12 .','15 . 14 . 12 . 8 .','17 . 15 . 12 . 8 .','11 . . . 14 . 11 .','12 . 15 . 19 . 20 .','20 . 17 . 13 . 17 .','14 . 11 . 8 . 14 .','11 . . . _ _ _ _'],
    calmA:['16 . 19 . 23 . 21 19','18 . . 16 18 . 21 .','18 . 14 . 11 . 14 18','19 . . . 16 . _ _','16 . 19 . 24 . 23 21','21 . 18 . 16 . 18 21','23 . 21 19 . . 18 19','19 . . . _ _ 14 16'],
    calmB:['_ _ 23 . 24 . 23 21','18 . . . 14 . 16 18','_ _ 18 . 21 . 18 14','16 . . . . . _ _','_ _ 16 . 19 . 21 23','21 . . 18 . . 16 .','14 . 16 . 18 . 21 .','19 . . . . . _ _'],
    fireA:['21 . 21 19 21 . 24 .','22 . 21 . 19 . 17 .','17 . 19 21 . . 24 .','19 . . . 16 . 17 19','21 . 21 19 21 . 26 .','24 . 22 . 21 . 22 .','19 . 17 . 19 . 22 .','21 . . . _ _ 25 .'],
    fireB:['26 . 24 . 26 . 29 .','29 . 26 . 22 . . .','24 . 21 . 24 . 26 .','28 . . . 24 . . .','26 . 24 . 26 . 29 .','31 . 29 . 26 . 22 .','26 . 24 . 22 . 19 .','25 . . . . . _ _'],
    moods:{
      base:    {root:60,cut:2600,room:1,wet:0.22},
      dante:   {root:55,cut:1800,room:1.2,wet:0.26},
      terminal:{root:62,cut:3400,room:0.8,wet:0.16},
      ruina:   {root:58,cut:2200,room:1.3,wet:0.3}
    }
  };
  let ctx=null,master=null,bus=null,bright=null,analyser=null,noiseBuf=null,on=false,vol=0.3,mood='base',scene='calm',style='calm',timer=null,hidden=false;
  /* 악기 샘플 곡: 스타일마다 평시·전투 한 곡씩(32마디가 한 바퀴, 끝에서 처음으로 이어진다). 히든 보스 곡도 한 곡(boss_boss.mp3, 도입 4마디 뒤부터 되풀이).
     빌드 파일에서는 window.CITY_BGM에 data 주소로 들어 있고, 개발 서버에서는 assets/bgm/<스타일>_<장면>.mp3를 읽는다. 읽지 못하면 합성음으로 돌아간다 */
  const smp={buf:{},loading:{},bad:{},cur:null,node:null};
  const ONE={passion:1,wave:1},smpKey=(st,sc)=>sc==='boss'?'boss_boss':st+'_'+sc,BOSS_LOOP=4*4*60/66;
  const smpSrc=(st,sc)=>{if(typeof window==='undefined')return null;const M=window.CITY_BGM;if(sc==='boss'){st='boss'}if(M===undefined)return `assets/bgm/${st}_${sc}.mp3`;return (M&&M[st]&&M[st][sc])||null};
  const smpUsable=(st,sc)=>!!smpSrc(st,sc)&&!smp.bad[smpKey(st,sc)];
  function smpLoad(key,src){
    if(smp.loading[key])return;
    smp.loading[key]=(async()=>{try{let ab;
      if(src.startsWith('data:')){const b=atob(src.slice(src.indexOf(',')+1)),u=new Uint8Array(b.length);for(let i=0;i<b.length;i++)u[i]=b.charCodeAt(i);ab=u.buffer}
      else{const r=await fetch(src);if(!r.ok)throw new Error('no');ab=await r.arrayBuffer()}
      smp.buf[key]=await ctx.decodeAudioData(ab)}catch(e){smp.bad[key]=1}})();
  }
  function smpStop(fade){
    const o=smp.node;smp.cur=null;smp.node=null;if(!o||!ctx)return;
    const now=ctx.currentTime;o.g.gain.cancelScheduledValues(now);o.g.gain.setValueAtTime(o.g.gain.value,now);o.g.gain.linearRampToValueAtTime(0,now+fade);
    try{o.src.stop(now+fade+0.05)}catch(e){}setTimeout(()=>{try{o.src.disconnect();o.g.disconnect()}catch(e){}},(fade+0.3)*1000);
  }
  /* 지금 스타일·장면의 샘플 곡을 틀고 있게 한다. 합성음으로 넘어가야 하면 false */
  function smpPlay(){
    if(!smpUsable(style,scene)){smpStop(0.5);return false}
    const key=smpKey(style,scene);if(smp.cur===key)return true;
    if(!smp.buf[key]){smpLoad(key,smpSrc(style,scene));return !smp.bad[key]}   // 읽는 동안은 조용히 기다린다
    /* 불길·물결: 평시본과 전투본(같은 곡, 전투가 1.25배 빠름)은 길이 비율만큼 위치를 옮겨 같은 곳에서 이어 붙인다 */
    let off=0;const o0=smp.node,buf=smp.buf[key],one=ONE[style]&&scene!=='boss';
    if(one&&o0&&o0.one===style&&o0.scene&&o0.scene!==scene&&o0.dur){const pos=((o0.off+(ctx.currentTime-o0.t0))%o0.dur+o0.dur)%o0.dur;off=pos*buf.duration/o0.dur}
    if(one){const ok=smpKey(style,scene==='fight'?'calm':'fight');if(!smp.buf[ok]&&smpSrc(style,scene==='fight'?'calm':'fight'))smpLoad(ok,smpSrc(style,scene==='fight'?'calm':'fight'))}   // 반대 장면도 미리 읽어 둔다
    smpStop(0.6);
    const now=ctx.currentTime,src=ctx.createBufferSource(),g=ctx.createGain();
    src.buffer=smp.buf[key];src.loop=true;if(scene==='boss'){src.loopStart=BOSS_LOOP;src.loopEnd=smp.buf[key].duration}g.gain.setValueAtTime(0,now);g.gain.linearRampToValueAtTime(1,now+0.8);
    src.connect(g);g.connect(master);src.start(now,off);smp.cur=key;smp.node={src,g,one:one?style:0,scene,off,t0:now,dur:buf.duration};return true;
  }
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
    const mk=dest=>{const g=ctx.createGain();g.gain.setValueAtTime(0,now);g.gain.linearRampToValueAtTime(scene==='boss'?P.bossGain:P.styleGain[style],now+0.3);g.connect(dest);return g};
    cur={b:mk(bright),u:mk(bus),m:mk(master)};
    /* 일그러진 기타 묶음 (불길·보스): 살짝만 찌그러뜨리고(과하면 깨지는 소리처럼 들린다) 높은 쇳소리를 걸러 묵직하게 */
    {const sh=ctx.createWaveShaper(),n=1024,cv=new Float32Array(n);for(let i=0;i<n;i++){const x=i/(n-1)*2-1;cv[i]=Math.tanh(x*2.2)/Math.tanh(2.2)}sh.curve=cv;sh.oversample='2x';
      const lp=ctx.createBiquadFilter();lp.type='lowpass';lp.frequency.value=2000;lp.Q.value=0.5;const hp=ctx.createBiquadFilter();hp.type='highpass';hp.frequency.value=70;
      const og=ctx.createGain();og.gain.value=0.22;sh.connect(hp);hp.connect(lp);lp.connect(og);og.connect(cur.b);cur.d=sh}
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
    const f=hz(m),o=ctx.createOscillator(),o2=ctx.createOscillator(),g=ctx.createGain(),g2=ctx.createGain();o.type='sine';o2.type='sine';o.frequency.value=f;o2.frequency.value=f*2;
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
  /* 파워 코드 (불길): 근음 · 5음 · 옥타브를 일그러뜨린다. mute=짧게 끊어 치기 */
  function powerC(m,t,dur,peak,mute){
    const g=ctx.createGain();g.gain.setValueAtTime(0.0001,t);g.gain.linearRampToValueAtTime(peak,t+0.005);
    if(mute)g.gain.exponentialRampToValueAtTime(0.0001,t+dur);else{g.gain.linearRampToValueAtTime(peak*0.85,t+dur*0.8);g.gain.linearRampToValueAtTime(0.0001,t+dur)}
    /* 근음·5음·옥타브를 순정 비율(1 · 1.5 · 2)로 맞춘다: 어긋나 있으면 찌그러진 소리에서 맥놀이(떨림)가 생긴다 */
    for(const r of [1,1.5,2]){const x=ctx.createOscillator();x.type='sawtooth';x.frequency.value=hz(m)*r;x.connect(g);x.start(t);x.stop(t+dur+0.05)}
    g.connect(cur.d);
  }
  /* 서브 베이스: 아주 낮은 사인으로 바닥을 받친다 */
  function subB(m,t,dur,peak){
    const o=ctx.createOscillator(),g=ctx.createGain();o.type='sine';o.frequency.value=hz(m);
    g.gain.setValueAtTime(0.0001,t);g.gain.linearRampToValueAtTime(peak,t+0.01);g.gain.linearRampToValueAtTime(peak*0.8,t+dur*0.7);g.gain.linearRampToValueAtTime(0.0001,t+dur);
    o.connect(g);g.connect(cur.m);o.start(t);o.stop(t+dur+0.05);
  }
  /* 무거운 킥: 높은 데서 낮게 떨어지는 사인 + 짧은 딸깍 */
  function kickH(t,peak){
    const o=ctx.createOscillator(),g=ctx.createGain();o.type='sine';o.frequency.setValueAtTime(115,t);o.frequency.exponentialRampToValueAtTime(42,t+0.13);
    g.gain.setValueAtTime(0.0001,t);g.gain.linearRampToValueAtTime(peak,t+0.009);g.gain.linearRampToValueAtTime(peak*0.8,t+0.06);g.gain.exponentialRampToValueAtTime(0.0001,t+0.32);
    o.connect(g);g.connect(cur.m);o.start(t);o.stop(t+0.36);
  }
  function feather(t,peak,soft){           // 킥: 부드러운 박동 (soft=잔잔)
    const o=ctx.createOscillator(),g=ctx.createGain();o.type='sine';o.frequency.setValueAtTime(soft?90:120,t);o.frequency.exponentialRampToValueAtTime(46,t+0.11);
    g.gain.setValueAtTime(0.0001,t);g.gain.linearRampToValueAtTime(peak,t+0.006);g.gain.exponentialRampToValueAtTime(0.0001,t+0.2);
    o.connect(g);g.connect(cur.m);o.start(t);o.stop(t+0.24);
  }
  function snare(t,peak){                  // 스네어: 부드럽게 거른 노이즈 + 몸통음 (날카로운 '타탁'이 나지 않게 고음을 줄이고 시작을 조금 무르게)
    {const n=ctx.createBufferSource(),f=ctx.createBiquadFilter(),l=ctx.createBiquadFilter(),g=ctx.createGain();n.buffer=noiseBuf;f.type='highpass';f.frequency.value=1800;l.type='lowpass';l.frequency.value=7000;
      g.gain.setValueAtTime(0.0001,t);g.gain.linearRampToValueAtTime(peak*0.55,t+0.008);g.gain.exponentialRampToValueAtTime(0.0001,t+0.14);
      n.connect(f);f.connect(l);l.connect(g);g.connect(cur.m);n.start(t,rnd()*0.9);n.stop(t+0.18)}
    const o=ctx.createOscillator(),g=ctx.createGain();o.type='triangle';o.frequency.setValueAtTime(190,t);o.frequency.exponentialRampToValueAtTime(110,t+0.1);
    g.gain.setValueAtTime(0.0001,t);g.gain.linearRampToValueAtTime(peak*0.6,t+0.008);g.gain.exponentialRampToValueAtTime(0.0001,t+0.11);
    o.connect(g);g.connect(cur.m);o.start(t);o.stop(t+0.14);
  }
  function padN(m,t,dur,peak){             // 패드: 살짝 어긋난 두 삼각파를 느리게 키우고 줄인다
    const g=ctx.createGain(),f=ctx.createBiquadFilter();f.type='lowpass';f.frequency.value=1100;f.Q.value=0.3;
    g.gain.setValueAtTime(0.0001,t);g.gain.linearRampToValueAtTime(peak,t+dur*0.35);g.gain.linearRampToValueAtTime(peak*0.8,t+dur*0.8);g.gain.exponentialRampToValueAtTime(0.0001,t+dur);
    for(const dt of [-3,3]){const o=ctx.createOscillator();o.type='triangle';o.frequency.value=hz(m);o.detune.value=dt;o.connect(f);o.start(t);o.stop(t+dur+0.05)}
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
  /* 피리 같은 선율 (고요): 사인 + 삼각파, 살짝 떨림(비브라토) */
  function fluteN(m,t,dur,peak){
    const f=hz(m),g=ctx.createGain(),o=ctx.createOscillator(),o2=ctx.createOscillator(),lfo=ctx.createOscillator(),lg=ctx.createGain();
    o.type='sine';o2.type='triangle';o.frequency.value=f;o2.frequency.value=f;lfo.frequency.value=5;lg.gain.value=f*0.0025;
    lfo.connect(lg);lg.connect(o.frequency);lg.connect(o2.frequency);
    const g2=ctx.createGain();g2.gain.value=0.45;o2.connect(g2);g2.connect(g);o.connect(g);
    g.gain.setValueAtTime(0.0001,t);g.gain.linearRampToValueAtTime(peak,t+0.04);g.gain.linearRampToValueAtTime(peak*0.9,t+Math.max(0.05,dur-0.08));g.gain.linearRampToValueAtTime(0.0001,t+dur);
    g.connect(cur.u);for(const x of [o,o2,lfo]){x.start(t);x.stop(t+dur+0.05)}
  }
  /* 신스 선율 (불길): 살짝 어긋난 톱니 둘을 걸러 또렷하게 */
  function synthN(m,t,dur,peak,cut){
    const f=ctx.createBiquadFilter(),g=ctx.createGain();f.type='lowpass';f.frequency.setValueAtTime(cut*1.4,t);f.frequency.exponentialRampToValueAtTime(cut,t+0.12);f.Q.value=1.2;
    g.gain.setValueAtTime(0.0001,t);g.gain.linearRampToValueAtTime(peak,t+0.012);g.gain.linearRampToValueAtTime(peak*0.8,t+Math.max(0.03,dur-0.05));g.gain.linearRampToValueAtTime(0.0001,t+dur);
    for(const dt of [-3,3]){const o=ctx.createOscillator();o.type='sawtooth';o.frequency.value=hz(m);o.detune.value=dt;o.connect(f);o.start(t);o.stop(t+dur+0.05)}
    f.connect(g);g.connect(cur.b);
  }
  /* 퉁기는 베이스 (고요): 삼각파를 짧게 */
  function pluckB(m,t,dur,peak){
    const o=ctx.createOscillator(),f=ctx.createBiquadFilter(),g=ctx.createGain();o.type='triangle';o.frequency.value=hz(m);f.type='lowpass';f.frequency.setValueAtTime(900,t);f.frequency.exponentialRampToValueAtTime(300,t+dur);
    g.gain.setValueAtTime(0.0001,t);g.gain.linearRampToValueAtTime(peak,t+0.008);g.gain.exponentialRampToValueAtTime(0.0001,t+dur);
    o.connect(f);f.connect(g);g.connect(cur.m);o.start(t);o.stop(t+dur+0.05);
  }
  /* 하이햇·셰이커: 띠 모양으로 거른 노이즈를 살짝 부풀렸다 길게 꼬리를 남긴다 ("틱" 대신 "츠—") */
  function hat(t,peak,open){
    const n=ctx.createBufferSource(),bp=ctx.createBiquadFilter(),hp=ctx.createBiquadFilter(),g=ctx.createGain(),dur=open?0.32:0.11;n.buffer=noiseBuf;
    bp.type='bandpass';bp.frequency.value=9000;bp.Q.value=0.8;hp.type='highpass';hp.frequency.value=5500;
    g.gain.setValueAtTime(0.0001,t);g.gain.linearRampToValueAtTime(peak,t+0.012);g.gain.exponentialRampToValueAtTime(peak*0.3,t+dur*0.4);g.gain.exponentialRampToValueAtTime(0.0001,t+dur);
    n.connect(bp);bp.connect(hp);hp.connect(g);g.connect(cur.m);n.start(t,rnd()*0.9);n.stop(t+dur+0.02);
  }
  const crash=(t,peak)=>noiseHit(t,peak,1.4,4000,12000);                         // 심벌 (구간 시작)
  /* 선율 한 마디 읽기: '16 . 19 _' → [{k:칸,m:음,n:길이(칸)}] */
  function mel(str){const tk=str.split(/\s+/),out=[];let last=null;tk.forEach((x,k)=>{if(x==='.'){if(last)last.n++}else if(x==='_')last=null;else{last={k,m:+x,n:1};out.push(last)}});return out}
  /* 고요 한 마디(4/4): 32마디 한 바퀴 — 0~7 도입(반주만) · 8~15 선율 A · 16~23 선율 B · 24~31 선율 A(옥타브 겹침)
     통통 튀는 베이스(1박 근음 · 2박 반 옥타브 · 3박 5음 · 4박 반 근음), 엇박 건반, 가벼운 킥·림·셰이커 */
  function barLobby(T,M){
    const fight=scene==='fight',bd=60/P.bpm.calm[scene],ci=barN%8,C=P.lobby[ci],R=M.root,at=k=>T+k*bd,sec=Math.floor((barN%32)/8),lb=R-24+C.b;
    /* 베이스 */
    [[0,0,0.11],[1.5,12,0.07],[2,C.f,0.09],[3.5,0,0.07]].forEach(([k,o,p])=>pluckB(lb+o,at(k),bd*0.9,p));
    if(ci===7)pluckB(lb+C.f-12+12,at(3),bd*0.4,0.06);
    /* 건반: 엇박 짧은 화음 */
    for(const k of [0.5,1.5,2.5,3.5]){const acc=k===1.5||k===3.5;C.t.slice(1).forEach(o=>ep(R+o,at(k),acc?0.034:0.025,bd*0.7))}
    /* 길게 깔리는 소리 */
    C.t.slice(0,3).forEach((o,i)=>padN(R+o-12,T+i*0.02,bd*4,0.012));
    /* 타악 */
    feather(at(0),0.08,true);feather(at(2),0.06,true);if(fight){feather(at(1),0.05,true);feather(at(3),0.05,true)}
    if(sec>0)for(const k of [1,3])snare(at(k),0.018);
    for(let n=0;n<8;n++)hat(at(n/2),n%2?0.012:0.007,false);
    /* 선율 */
    if(sec>0){const L=sec===2?P.calmB:P.calmA;
      for(const x of mel(L[ci])){const d=x.n*bd/2*0.95;fluteN(R+x.m,at(x.k/2),d,fight?0.05:0.042);if(sec===3)fluteN(R+x.m-12,at(x.k/2),d,0.02)}}
    barT=T+4*bd;barN++;
  }
  /* 불길 한 마디(4/4): 32마디 한 바퀴 — 0~3 도입(리프·베이스) · 4~11 훅 A · 12~19 훅 B · 20~23 숨 고르기(킥 없이, 끝에 스네어 몰아치기) · 24~31 훅 A(옥타브 겹침)
     8분 질주 베이스, 16분 피아노 리프, 록 드럼(킥 1·2박 반·3 · 스네어 2·4 · 8분 하이햇), 구간 시작마다 심벌, 8마디 끝마다 스네어 필 */
  function barPassion(T,M){
    const fight=scene==='fight',bd=60/P.bpm.passion[scene],ci=barN%8,C=P.pChords[ci],R=M.root,at=k=>T+k*bd,pos=barN%32,lb=R-24+C.b;
    const sec=pos<4?'intro':pos<12?'A':pos<20?'B':pos<24?'break':'A2',start=pos===4||pos===12||pos===24,phraseEnd=pos%8===3||pos===23;
    /* 베이스: 8분으로 몰아친다 (숨 고르기에서는 2분음표) */
    if(sec==='break'){sawN(lb,at(0),bd*2,0.07,700);sawN(lb,at(2),bd*2,0.07,700);subB(lb-12,at(0),bd*4,0.12)}
    else{[0,0,12,0,0,C.f,12,0].forEach((o,n)=>sawN(lb+o,at(n/2),bd*0.45,n%2?0.06:0.08,fight?1300:1000));
      for(const k of [0,1.5,2,3])subB(lb-12,at(k),bd*(k===1.5?0.5:0.95),0.13)}
    /* 일그러진 기타: 도입·훅 A는 8분 끊어 치기(첫 박은 길게), 훅 B는 길게 울리는 파워 코드 */
    {const gm=R-24+12+C.b;
      if(sec==='B'){powerC(gm,at(0),bd*2,0.05,false);powerC(gm,at(2),bd*1.5,0.05,false);powerC(gm,at(3.5),bd*0.5,0.045,true)}
      else if(sec!=='break')[0,0.5,1,1.5,2,2.5,3,3.5].forEach((k,n)=>powerC(gm,at(k),n===0?bd*0.9:bd*0.32,n===0?0.05:0.035,n!==0))}
    /* 피아노 리프: 16분 되풀이 */
    /* 피아노 리프: 숨 고르기·도입은 16분, 기타가 들어오는 구간은 8분으로 줄여 소리가 뭉개지지 않게 */
    const pat=[0,1,2,1, 3,1,2,1, 0,1,2,3, 2,1,2,1],dense=sec==='break'||sec==='intro';
    pat.forEach((ix,n)=>{if(!dense&&n%2)return;pianoN(R+C.t[ix],at(n/4),(n%4===0?0.042:0.03)*(sec==='break'?0.8:1),bd*0.5)});
    /* 현: 숨 고르기와 훅 B에서 길게 */
    if(sec==='break'||sec==='B')C.t.slice(0,3).forEach((o,i)=>strN(R+o-12,T+i*0.02,bd*4,0.012));
    /* 드럼 */
    if(sec!=='break'){
      if(fight||sec==='B')for(let k=0;k<4;k++)kickH(at(k),0.2);else for(const k of [0,1.5,2,2.75])kickH(at(k),0.2);
      if(sec!=='intro')for(const k of [1,3])snare(at(k),0.045);
      for(let n=0;n<8;n++)hat(at(n/2),n%2?0.016:0.01,n===7&&sec==='B');
    }else if(pos===23){for(let n=0;n<16;n+=2)snare(at(n/4),0.012+0.003*n)}
    else kickH(at(0),0.14);
    if(start){crash(T,0.05);boom(T,0.22)}
    if(phraseEnd&&sec!=='break'&&pos!==23)for(let n=1;n<4;n+=2)snare(at(3+n*0.25),0.022+0.006*n);
    if(pos%8===0&&sec!=='break')boom(T,0.18);
    /* 훅 */
    if(sec==='A'||sec==='B'||sec==='A2'){const L=sec==='B'?P.fireB:P.fireA,cut=fight?3600:3000;
      for(const x of mel(L[ci])){const d=x.n*bd/2*0.9;synthN(R+x.m-12,at(x.k/2),d,0.035,cut);if(sec==='A2')synthN(R+x.m,at(x.k/2),d,0.016,cut)}}
    barT=T+4*bd;barN++;
  }
  /* 종: 사인에 어긋난 배음(2.76배 · 5.4배)을 섞어 길게 울린다 */
  function bellN(m,t,peak,dur){
    const f=hz(m),g=ctx.createGain();g.gain.setValueAtTime(0.0001,t);g.gain.linearRampToValueAtTime(peak,t+0.004);g.gain.exponentialRampToValueAtTime(0.0001,t+dur);
    for(const [r,a,d] of [[1,1,1],[2.76,0.35,0.5],[5.4,0.15,0.25]]){const o=ctx.createOscillator(),og=ctx.createGain();o.type='sine';o.frequency.value=f*r;og.gain.setValueAtTime(a,t);og.gain.exponentialRampToValueAtTime(0.0001,t+dur*d);o.connect(og);og.connect(g);o.start(t);o.stop(t+dur*d+0.05)}
    g.connect(cur.u);
  }
  /* 합창 같은 소리: 톱니 둘을 '아' 모음 대역(700·1150Hz)으로 걸러 천천히 키운다 */
  function choirN(m,t,dur,peak){
    const g=ctx.createGain(),f1=ctx.createBiquadFilter(),f2=ctx.createBiquadFilter();f1.type='bandpass';f1.frequency.value=700;f1.Q.value=2.5;f2.type='bandpass';f2.frequency.value=1150;f2.Q.value=3;
    g.gain.setValueAtTime(0.0001,t);g.gain.linearRampToValueAtTime(peak,t+dur*0.4);g.gain.setValueAtTime(peak,t+dur*0.75);g.gain.linearRampToValueAtTime(0.0001,t+dur);
    for(const dt of [-4,4]){const o=ctx.createOscillator();o.type='sawtooth';o.frequency.value=hz(m);o.detune.value=dt;o.connect(f1);o.connect(f2);o.start(t);o.stop(t+dur+0.05)}
    f1.connect(g);f2.connect(g);g.connect(cur.u);
  }
  /* 히든 보스 한 마디: 0~3 도입(느리게) · 이후 20마디 한 바퀴 — 0~7 본 구간(반박자: 킥 1·3박 반, 스네어 3박, 긴 파워 코드) · 8~15 몰아치기(킥 매 박·스네어 2·4·8분 끊어 치기·선율, 마지막 마디는 7/8) · 16~19 숨 고르기(종·합창·지속음) */
  function barBoss(T,M){
    const R=M.root,intro=barN<4,pos=intro?-1:(barN-4)%20,ci=intro?barN%4:pos%8,C=P.bChords[intro?[0,1,2,3][barN]:ci];
    const bd=60/(intro?P.bossBpm.intro:P.bossBpm.main),at=k=>T+k*bd,lb=R-24+C.b;
    const sec=intro?'intro':pos<8?'A':pos<16?'B':'break',beats=pos===15?3.5:4;
    if(sec==='intro'||sec==='break'){
      subB(lb-12,at(0),bd*4,0.14);
      C.t.slice(0,3).forEach((o,i)=>choirN(R+o-12,T+i*0.03,bd*4,0.02));
      bellN(R+P.bossBell[(barN*2)%8],at(0),0.07,bd*3);bellN(R+P.bossBell[(barN*2+1)%8],at(2),0.055,bd*2.2);
      boom(T,0.24);if(sec==='break'&&pos===19)for(let n=0;n<8;n++)snare(at(2+n/4),0.012+0.005*n);
      if(barN===3)for(let n=0;n<6;n++)boom(at(2.5+n*0.25),0.06+0.025*n);
    }else{
      const gm=R-24+12+C.b;
      if(sec==='A'){
        powerC(gm,at(0),bd*2.5,0.055,false);powerC(gm,at(2.5),bd*1.5,0.05,false);
        for(const k of [0,1.5,2.5])subB(lb-12,at(k),bd*(k===0?1.4:0.9),0.14);
        sawN(lb,at(0),bd*1.4,0.07,700);sawN(lb,at(2.5),bd*1.4,0.07,700);
        kickH(at(0),0.22);kickH(at(2.5),0.2);snare(at(2),0.05);
        for(let n=0;n<4;n++)hat(at(n),n%2?0.012:0.008,false);
        C.t.slice(0,3).forEach((o,i)=>choirN(R+o-12,T+i*0.03,bd*4,0.012));
        if(pos%2===0)bellN(R+P.bossBell[pos%8],at(0),0.04,bd*3);
      }else{
        for(let n=0;n<beats*2;n++){powerC(gm,at(n/2),n===0?bd*0.9:bd*0.32,n===0?0.05:0.036,n!==0);sawN(lb+(n%4===3?12:0),at(n/2),bd*0.45,n%2?0.06:0.08,1100)}
        for(let k=0;k<beats;k++){kickH(at(k),0.2);subB(lb-12,at(k),bd*0.9,0.12)}
        for(const k of [1,3])if(k<beats)snare(at(k),0.045);
        for(let n=0;n<beats*2;n++)hat(at(n/2),n%2?0.015:0.009,false);
        for(const x of mel(P.bossLead[ci])){if(x.k>=beats*2)continue;synthN(R+x.m-12,at(x.k/2),x.n*bd/2*0.9,0.035,2600)}
        if(pos===8)crash(T,0.055);
        if(pos===15)for(let n=1;n<4;n+=2)snare(at(2.5+n*0.25),0.022+0.008*n);
      }
      if(pos===0)crash(T,0.05),boom(T,0.24);
    }
    barT=T+beats*bd;barN++;
  }
  /* 현악 합주 (도서관): 살짝 어긋난 톱니 셋을 느린 떨림(비브라토)과 함께 걸러 올린다. 윗배음이 살아 있어 합성음보다 공기감이 있다 */
  function strE(m,t,dur,peak,cut){
    const f=ctx.createBiquadFilter(),g=ctx.createGain(),lfo=ctx.createOscillator(),lg=ctx.createGain();f.type='lowpass';f.frequency.setValueAtTime(cut*0.6,t);f.frequency.linearRampToValueAtTime(cut,t+dur*0.4);f.Q.value=0.5;
    g.gain.setValueAtTime(0.0001,t);g.gain.linearRampToValueAtTime(peak,t+Math.min(dur*0.35,0.5));g.gain.linearRampToValueAtTime(peak*0.8,t+dur*0.85);g.gain.linearRampToValueAtTime(0.0001,t+dur);
    lfo.frequency.value=5.2;lg.gain.value=7;lfo.connect(lg);
    for(const dt of [-9,0,9]){const o=ctx.createOscillator();o.type='sawtooth';o.frequency.value=hz(m);o.detune.value=dt;lg.connect(o.detune);o.connect(f);o.start(t);o.stop(t+dur+0.05)}
    lfo.start(t);lfo.stop(t+dur+0.05);f.connect(g);g.connect(cur.u);
  }
  /* 도서관 한 마디(4/4): 재즈 피아노 · 걷는 베이스 · 현악 + 전투에서는 록 드럼과 일그러진 기타가 얹힌다
     32마디: 0~3 도입 · 4~11 선율 A · 12~19 선율 B · 20~23 쉬어 가기(피아노만) · 24~31 선율 A(옥타브 겹침)
     평시는 스윙 리듬(뒷박을 늦춰 친다)의 브러시 드럼, 전투는 곧은 8분 록 드럼 */
  function barLibrary(T,M){
    const fight=scene==='fight',bd=60/P.bpm.library[scene],ci=barN%8,C=P.lChords[ci],N=P.lChords[(ci+1)%8],R=M.root,at=k=>T+k*bd,pos=barN%32;
    const sec=pos<4?'intro':pos<12?'A':pos<20?'B':pos<24?'break':'A2',lb=R-12+C.b,sw=fight?0.5:0.64;
    /* 걷는 베이스: 근음 · 5음/3음 · 근음 위 · 다음 화음으로 반음 다가가기 (한 옥타브 높게 잡아 폰에서도 들린다) */
    {const nb=R-12+N.b,ap=nb+(nb>lb?-1:1);[[0,lb,0.1],[1,lb+C.w[0],0.07],[2,lb+C.w[1],0.07],[3,ap,0.07]].forEach(([k,m,pk])=>pluckB(m,at(k),bd*0.85,pk))}
    /* 바닥: 마디마다 낮은 사인과 낮은 현 한 줄로 아래를 받친다 */
    subB(R-24+C.b,T,bd*3.8,0.06);if(sec!=="intro")strE(R-24+C.b+12,T,bd*4,0.01,1500);
    /* 건반: 재즈 코드 짚기 — 1박 약하게, 2박 뒷박(스윙)과 4박에 센 한 번 */
    const comp=sec==='break'?[0,1.5,2.5]:[0.0,sw+1,2.5,3.5];
    comp.forEach((k,n)=>C.t.forEach(o=>ep(R+o,at(k),(n%2?0.05:0.04)*(sec==='break'?1.2:1),bd*0.8)));
    /* 현: 쉬어 가기와 선율 B에서 길게 깔고, 전투에서는 8분으로 끊어 친다 */
    if(sec==='break'||sec==='B'||sec==='A2')C.t.slice(0,3).forEach((o,i)=>strE(R+o,T+i*0.02,bd*4,0.03,3200));
    if(fight&&sec!=='break'&&sec!=='intro')for(let n=0;n<8;n++)strE(R+C.t[n%3],at(n/2),bd*0.42,0.024,3600);
    /* 드럼 */
    if(sec!=='break'){
      if(fight){
        for(const k of [0,2.5,3])kickH(at(k),0.17);
        for(const k of [1,3])snare(at(k),0.04);
        for(let n=0;n<8;n++)hat(at(n/2),n%2?0.026:0.016,n===7);
        /* 일그러진 기타: 마디 첫 박에 파워 코드 */
        powerC(R-12+C.b,T,bd*1.8,0.06,false);if(sec==='B')powerC(R-12+C.b,at(2),bd*1.6,0.05,false);
      }else{
        feather(at(0),0.07,true);feather(at(2.5),0.05,true);
        for(const k of [1,3])noiseHit(at(k),0.02,0.14,1800,6000);
        [0,1,sw+1,2,3,sw+3].forEach(k=>noiseHit(at(k),0.03,0.16,5500,16000));
      }
    }else if(pos===23){for(let n=0;n<8;n++)snare(at(2+n/4),0.012+0.003*n)}
    if(pos===4||pos===12||pos===24){crash(T,0.075)}
    /* 선율: 가볍게 숨 쉬는 관악풍 */
    if(sec==='A'||sec==='B'||sec==='A2'){const L=sec==='B'?P.libB:P.libA;
      for(const x of mel(L[ci])){const k=x.k/2,t0=at(x.k%2?k+(sw-0.5):k),d=x.n*bd/2*0.92;leadN(R+x.m,t0,d,fight?0.07:0.058,3200);if(sec==='A2'||sec==='B')fluteN(R+x.m+12,t0,d,0.012)}}
    barT=T+4*bd;barN++;
  }
  function schedule(now,M){
    if(lastScene!==scene||lastStyle!==style){if(lastStyle!==style||lastScene==='boss'||scene==='boss')barN=0;lastScene=scene;lastStyle=style;newEpoch();barT=now+0.32}
    if(smpPlay())return;
    if(barT<now)barT=now+0.05;
    const wet=bus._wet;if(wet&&now>duckUntil)wet.gain.setTargetAtTime(M.wet*(scene==='fight'?0.7:1)*(style==='passion'?0.7:style==='library'?1.35:1),now,0.6);
    bright.frequency.setTargetAtTime(scene==='boss'?Math.min(M.cut,P.bossCut)*1.2:M.cut*P.cutMul[style][scene],now,2);
    let g=0;while(barT<now+2.2&&g++<1)(scene==='boss'?barBoss:style==='passion'?barPassion:style==='library'?barLibrary:barLobby)(barT,M);
  }
  function tick(){
    if(!ctx||!on||hidden)return;
    schedule(ctx.currentTime,P.moods[mood]||P.moods.base);
  }
  function start(){
    unlockIOSAudio();
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
    debug:()=>({state:ctx&&ctx.state,gain:master?master.gain.value:null,on,vol,mood,scene,style,sample:smp.cur,sampleBad:Object.keys(smp.bad)}),
    /* 켜기/끄기: 켜는 것은 사용자가 누른 순간(클릭 처리 안)에서만 호출해야 한다 */
    set(v){if(v===on)return on;on=!!v;if(on)start();else stop();return on},
    setVol(v){vol=Math.max(0,Math.min(1,+v||0));if(on&&ctx)ramp(gainOf(vol),0.3)},
    setMood(k){if(P.moods[k])mood=k},
    setScene(k){scene=k==='boss'?'boss':k==='fight'?'fight':'calm'},
    style:()=>style,
    setStyle(k){if(k==='calm'||k==='passion'||k==='library'||k==='wave')style=k}
  };
}
