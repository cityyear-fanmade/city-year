/* 배경음악: 외부 음원 없이 Web Audio로 합성한다 (저작권 문제 없음). 직접 만든 곡이다.
   - 기본은 꺼져 있고, 사용자가 설정에서 켠 뒤에만 소리가 난다 (브라우저 정책상 한 번 눌러야 시작)
   - 켤 때 마스터 음량을 0에서 서서히 올리고, 전체 출력은 컴프레서를 거친다
   - 두 가지 스타일을 사용자가 고른다
     · 잔잔(calm): 원래 쓰던 느린 스윙 재즈. 걷는 베이스, 라이드 심벌, 브러시, 전기 피아노 컴핑, 가끔 지나가는 멜로디. 전투에 들어가면 템포가 오른다 (ii7 · V13 · Imaj9 · vi9)
     · 격정(passion): 평소부터 빠른 피아노 곡. 16분 되풀이 음형과 옥타브 베이스, 낮게 깔리는 현, 큰북·스네어. 전투에 들어가면 더 빨라지고 킥이 4박으로 늘며 스네어 연타와 높은 선율이 붙는다 (Am · F · Dm · E 단조) */
export function createBgm(){
  /* 모든 값은 여기서 조절한다 */
  const P={
    maxGain:2,          // 음량 100%일 때 마스터 음량 (컴프레서가 최고점을 눌러 준다)
    fadeIn:3,           // 켤 때 서서히 커지는 시간(초)
    fadeOut:0.8,        // 끌 때 서서히 줄어드는 시간(초)
    bpm:{calm:{calm:76,fight:136},passion:{calm:132,fight:152}},   // [스타일][장면]
    styleGain:{calm:0.65,passion:0.8},   // 스타일별 전체 음량 보정 (격정은 피아노 중심이라 잔잔과 비슷한 크기로 맞춘다)
    cutMul:{calm:{calm:1,fight:1.25},passion:{calm:1.3,fight:1.5}}, // 장면별 밝기
    /* 코드(C=0 기준 반음): b=베이스 근음, t=코드 구성음(피아노 아르페지오·패드·오스티나토), sc=멜로디에 쓰는 음계(A 단음계 계열) */
    /* 격정(단조): b=베이스 근음, t=피아노·현 구성음, sc=선율 음계(A 화성단음계). Am → F → Dm → E (으뜸 · 여섯째 · 넷째 · 딸림으로 조여 든다) */
    pChords:[
      {b:9,t:[-3,0,4,9],sc:[9,11,12,14,16,17,20]},    // Am
      {b:5,t:[-7,-3,0,5],sc:[9,11,12,14,16,17,19]},   // F
      {b:2,t:[-10,-7,-3,2],sc:[9,11,12,14,16,17,19]}, // Dm
      {b:4,t:[-8,-4,-1,4],sc:[8,9,11,12,14,16,17]}    // E
    ],
    jazz:[
      {bass:2,iv:[0,3,7,10],v:[5,9,12,16],sc:[2,5,7,9,12,14,17]},        // Dm9
      {bass:7,iv:[0,4,7,10],v:[5,11,14,16],sc:[7,9,11,12,14,16,17]},     // G13
      {bass:0,iv:[0,4,7,11],v:[4,7,11,14],sc:[0,2,4,7,9,11,14]},         // Cmaj9
      {bass:9,iv:[0,3,7,10],v:[12,16,19,23],sc:[9,12,14,16,19,21,23]}    // Am9
    ],
    swing:0.64,         // 잔잔(재즈)의 엇박 위치 (0.5=straight, 0.67=셋잇단 스윙)
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
    noiseBuf=ctx.createBuffer(1,ctx.sampleRate*0.4,ctx.sampleRate);{const d=noiseBuf.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1}
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
    n.connect(f);if(lpf){const l=ctx.createBiquadFilter();l.type='lowpass';l.frequency.value=lpf;f.connect(l);l.connect(g)}else f.connect(g);g.connect(cur.m);n.start(t,rnd()*0.15);n.stop(t+dur+0.02);
  }
  function feather(t,peak,soft){           // 킥: 부드러운 박동 (soft=잔잔)
    const o=ctx.createOscillator(),g=ctx.createGain();o.type='sine';o.frequency.setValueAtTime(soft?90:120,t);o.frequency.exponentialRampToValueAtTime(46,t+0.11);
    g.gain.setValueAtTime(0.0001,t);g.gain.linearRampToValueAtTime(peak,t+0.006);g.gain.exponentialRampToValueAtTime(0.0001,t+0.2);
    o.connect(g);g.connect(cur.m);o.start(t);o.stop(t+0.24);
  }
  function snare(t,peak){                  // 스네어: 노이즈 + 짧은 몸통음
    noiseHit(t,peak,0.15,1400,7000);
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
  function pianoN(m,t,peak,dur){           // 피아노: 삼각파 + 윗배음 둘, 짧게 때리고 서서히 가라앉는다
    const f=hz(m),o=ctx.createOscillator(),o2=ctx.createOscillator(),o3=ctx.createOscillator(),g=ctx.createGain(),g2=ctx.createGain(),g3=ctx.createGain();
    o.type='triangle';o2.type='sine';o3.type='sine';o.frequency.value=f;o2.frequency.value=f*2;o3.frequency.value=f*3.01;
    g.gain.setValueAtTime(0.0001,t);g.gain.linearRampToValueAtTime(peak,t+0.004);g.gain.exponentialRampToValueAtTime(peak*0.4,t+dur*0.25);g.gain.exponentialRampToValueAtTime(0.0001,t+dur);
    g2.gain.setValueAtTime(0.5,t);g2.gain.exponentialRampToValueAtTime(0.01,t+dur*0.6);g3.gain.setValueAtTime(0.22,t);g3.gain.exponentialRampToValueAtTime(0.005,t+dur*0.3);
    o.connect(g);o2.connect(g2);o3.connect(g3);g2.connect(g);g3.connect(g);g.connect(cur.b);o.start(t);o2.start(t);o3.start(t);o.stop(t+dur+0.05);o2.stop(t+dur+0.05);o3.stop(t+dur+0.05);
  }
  function strN(m,t,dur,peak){             // 현: 톱니파를 낮게 걸러 떨림을 얹고 천천히 키운다
    const f=ctx.createBiquadFilter(),g=ctx.createGain(),tr=ctx.createGain(),lfo=ctx.createOscillator(),lg=ctx.createGain();f.type='lowpass';f.frequency.value=1000;f.Q.value=0.4;
    tr.gain.value=0.78;lfo.frequency.value=5.5;lg.gain.value=0.22;lfo.connect(lg);lg.connect(tr.gain);
    g.gain.setValueAtTime(0.0001,t);g.gain.linearRampToValueAtTime(peak,t+dur*0.3);g.gain.linearRampToValueAtTime(peak*0.85,t+dur*0.85);g.gain.linearRampToValueAtTime(0.0001,t+dur);
    for(const dt of [-7,7]){const o=ctx.createOscillator();o.type='sawtooth';o.frequency.value=hz(m);o.detune.value=dt;o.connect(f);o.start(t);o.stop(t+dur+0.05)}
    lfo.start(t);lfo.stop(t+dur+0.05);f.connect(tr);tr.connect(g);g.connect(cur.u);
  }
  function boom(t,peak){                   // 큰북: 낮게 떨어지는 사인
    const o=ctx.createOscillator(),g=ctx.createGain();o.type='sine';o.frequency.setValueAtTime(82,t);o.frequency.exponentialRampToValueAtTime(38,t+0.35);
    g.gain.setValueAtTime(0.0001,t);g.gain.linearRampToValueAtTime(peak,t+0.01);g.gain.exponentialRampToValueAtTime(0.0001,t+0.7);
    o.connect(g);g.connect(cur.m);o.start(t);o.stop(t+0.75);
  }
  function leadN(m,t,dur,peak,cut){        // 이어 부는 선율: 살짝 어긋난 두 삼각파, 느리게 시작해 길게 이어진다
    const f=ctx.createBiquadFilter(),g=ctx.createGain(),lfo=ctx.createOscillator(),lg=ctx.createGain();f.type='lowpass';f.frequency.value=cut;f.Q.value=0.5;
    lfo.frequency.value=5;lg.gain.value=5;lfo.connect(lg);
    g.gain.setValueAtTime(0.0001,t);g.gain.linearRampToValueAtTime(peak,t+0.05);g.gain.setValueAtTime(peak,t+dur*0.6);g.gain.linearRampToValueAtTime(0.0001,t+dur);
    for(const dt of [-5,5]){const o=ctx.createOscillator();o.type='triangle';o.frequency.value=hz(m);o.detune.value=dt;lg.connect(o.detune);o.connect(f);o.start(t);o.stop(t+dur+0.05)}
    lfo.start(t);lfo.stop(t+dur+0.05);f.connect(g);g.connect(cur.u);
  }
  /* 한 마디를 예약한다 */
  function barJazz(T,M){
    const fight=scene==='fight',bd=60/P.bpm.calm[scene],sw=P.swing,ci=barN%P.jazz.length,C=P.jazz[ci],N=P.jazz[(barN+1)%P.jazz.length],R=M.root;
    const at=k=>T+k*bd,bassBase=R-24;
    /* 걷는 베이스: 근음 → 구성음 → 구성음 → 다음 근음으로 반음 접근 */
    {const nr=bassBase+N.bass,notes=[bassBase+C.bass,bassBase+C.bass+pick(C.iv.slice(1)),bassBase+C.bass+pick(C.iv.slice(1)),nr+(rnd()<0.5?-1:1)];
      for(let k=0;k<4;k++){const m=notes[k]<bassBase-5?notes[k]+12:notes[k];bassN(m,at(k),bd*0.9,k===0?0.1:0.075);
        if(fight&&k===1&&rnd()<0.5)bassN(m+7,at(k+sw),bd*0.4,0.05)}}
    /* 라이드: 딩, 딩-따, 딩, 딩-따 */
    for(const k of [0,1,1+sw,2,3,3+sw]){const acc=k%1===0;noiseHit(at(k),(acc?0.012:0.007)*(fight?1.25:1),acc?0.22:0.12,6000,9000)}
    if(fight)for(const k of [0.5,2.5])noiseHit(at(k),0.01,0.08,8000,11000);
    /* 하이햇 풋(2·4박)과 브러시, 전투에서는 가벼운 킥 */
    for(const k of [1,3]){noiseHit(at(k),0.016,0.07,2000,4000);noiseHit(at(k)+0.01,fight?0.01:0.006,0.16,1600,3800)}
    if(fight){for(let k=0;k<4;k++)feather(at(k),0.045,true);if(rnd()<0.6)noiseHit(at(2+sw),0.014,0.07,2000,4600)}
    /* 전기 피아노 컴핑: 1박과 엇박 */
    const pats=fight?[[0,1+sw,2,3+sw],[0,1.5,2+sw,3],[sw,2,3+sw]]:[[0,1+sw],[0,2+sw],[sw,2],[0,1+sw,3+sw]];
    for(const k of pick(pats)){
      const long=k===0,dur=(long?1.1:0.55)*bd*(fight?0.75:1);
      C.v.forEach((o,i)=>ep(R+o,at(k)+i*0.012+(rnd()*0.008),(long?0.021:0.016),dur+0.15));
    }
    /* 패드: 코드 구성음을 한 마디 내내 깔아 빈 틈을 메운다 */
    C.v.forEach((o,i)=>padN(R+o-12,T+i*0.02,bd*4,fight?0.009:0.011));
    /* 선율: 거의 매 마디 이어 부는 네댓 음 (끊기지 않게 길게 이어 붙인다) */
    if(rnd()<(fight?0.6:0.85)){
      const n=4+Math.floor(rnd()*3),len=4/n,k0=pick([0,0,0.5]);let ix=Math.floor(rnd()*C.sc.length);
      for(let i=0;i<n;i++){const k=k0+i*len;if(k>=4)break;leadN(R+12+C.sc[ix],at(k),bd*len*1.2,fight?0.026:0.03,M.cut*0.9);ix=Math.max(0,Math.min(C.sc.length-1,ix+pick([-2,-1,-1,1,1,2])))}
    }
    barT=T+4*bd;barN++;
  }
  /* 격정 한 마디: 피아노가 끌고 간다. 오른손은 16분 되풀이 음형, 왼손은 옥타브 베이스 · 현이 낮게 깔리고 큰북과 스네어가 조여 든다.
     전투에서는 템포가 오르고 킥이 4박으로 늘며 4번째 박에 스네어 연타, 높은 옥타브 선율이 붙는다 */
  function barPassion(T,M){
    const fight=scene==='fight',bd=60/P.bpm.passion[scene],C=P.pChords[barN%P.pChords.length],R=M.root,at=k=>T+k*bd,last=barN%4===3;
    /* 왼손: 옥타브 베이스 */
    const lb=R-24+C.b;
    for(const k of fight?[0,1.5,2,3.5]:[0,1.5,2.5]){pianoN(lb,at(k),k===0?0.1:0.07,bd*1.1);pianoN(lb+12,at(k),k===0?0.07:0.05,bd*0.9)}
    /* 현: 구성음을 한 마디 내내 낮게 */
    C.t.forEach((o,i)=>strN(R+o-12,T+i*0.02,bd*4,fight?0.014:0.011));
    /* 오른손: 16분 되풀이 음형 (낮은 음 → 가운데 → 높은 음 → 가운데), 박 머리에 힘을 준다 */
    const pat=[0,1,2,1, 0,1,3,1, 0,2,3,2, 1,2,3,2];
    pat.forEach((ix,n)=>{const m=R+C.t[ix]+12;pianoN(m,at(n/4),(n%4===0?0.05:0.032)*(fight?1.15:1),bd*0.55)});
    /* 선율: 박 머리마다 위에서 눌러 내리는 음 (전투에서는 옥타브 위가 겹친다) */
    {const ix0=Math.floor(rnd()*C.sc.length);[0,1,2,3].forEach((k,i)=>{const m=R+24+C.sc[(ix0+i*2)%C.sc.length]-12*(i%2);if(rnd()<(fight?0.9:0.55))pianoN(m,at(k+0.5),fight?0.04:0.03,bd*1.2)})}
    /* 타악 */
    if(fight){for(let k=0;k<4;k++)feather(at(k),0.11)}else{feather(at(0),0.1);feather(at(2),0.09)}
    for(const k of [1,3])snare(at(k),fight?0.05:0.04);
    if(fight&&last)for(let n=1;n<4;n++)snare(at(3+n*0.25),0.025+0.008*n);
    if(barN%2===0)boom(T,fight?0.2:0.15);
    if(barN%4===0)noiseHit(T,fight?0.025:0.015,1.2,3200,6000);
    barT=T+4*bd;barN++;
  }
  function schedule(now,M){
    if(lastScene!==scene||lastStyle!==style){if(lastStyle!==style)barN=0;lastScene=scene;lastStyle=style;newEpoch();barT=now+0.32}
    if(barT<now)barT=now+0.05;
    const wet=bus._wet;if(wet&&now>duckUntil)wet.gain.setTargetAtTime(M.wet*(scene==='fight'?0.7:1)*(style==='passion'?0.7:1),now,0.6);
    bright.frequency.setTargetAtTime(M.cut*P.cutMul[style][scene],now,2);
    let g=0;while(barT<now+2.2&&g++<3)(style==='passion'?barPassion:barJazz)(barT,M);
  }
  function tick(){
    if(!ctx||!on||hidden)return;
    schedule(ctx.currentTime,P.moods[mood]||P.moods.base);
  }
  function start(){
    if(!ensure())return false;
    ctx.resume&&ctx.resume();
    if(!timer)timer=setInterval(tick,700);
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
