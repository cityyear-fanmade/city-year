/* 소리 시험실: 배경음악·효과음만 따로 들어 보는 단일 HTML을 만든다.
   사용: node tools/lab.mjs [샘플 폴더] → dist/soundlab.html
   샘플 폴더에 sample_*.mp3가 있으면 '샘플 배경음악' 구역에 넣는다 (저장소에는 넣지 않는다) */
import fs from 'node:fs';import path from 'node:path';
const strip=f=>fs.readFileSync(f,'utf8').replace(/export function /g,'function ');
const dir=process.argv[2],samples=[];
if(dir)for(const f of fs.readdirSync(dir).filter(x=>/^sample_.*\.mp3$/.test(x)).sort()){samples.push([f.replace(/^sample_|\.mp3$/g,''),fs.readFileSync(path.join(dir,f)).toString('base64')])}
const LABEL={dj_calm:'어두운 재즈 · 평시 (악기 샘플)',dj_fight:'어두운 재즈 · 전투 (악기 샘플)',lib_calm:'도서관 · 평시 (악기 샘플)',lib_fight:'도서관 · 전투 (악기 샘플)',dark_calm:'어두운 잔잔 · 평시 (악기 샘플)',dark_fight:'어두운 전투 (악기 샘플)'};
const html=`<title>소리 시험실</title>
<meta name="claude:viewport-fit-sides" content="cover">
<style>
/* 레이아웃: 한 줄 상단 상태 + 구역 3개(타격음 · 합성 배경음악 · 샘플 배경음악). 어두운 갈색 바탕에 호박색 하나만 쓴다 */
:root{--bg:#0e0a08;--panel:#18120f;--line:#3a2a20;--fg:#efe3d3;--dim:#9c8a78;--amber:#e8a24e;--amber-ink:#1a1008;--danger:#c9584c;color-scheme:dark;--mono:ui-monospace,SFMono-Regular,Menlo,monospace;--serif:"Noto Serif KR","Nanum Myeongjo",Georgia,serif}
@media (prefers-color-scheme:light){:root:not([data-theme="dark"]){--bg:#f6efe6;--panel:#fffaf2;--line:#d8c7b3;--fg:#2a1d12;--dim:#7a6652;--amber:#a9611a;--amber-ink:#fff7ea;--danger:#a63a30;color-scheme:light}}
:root[data-theme="light"]{--bg:#f6efe6;--panel:#fffaf2;--line:#d8c7b3;--fg:#2a1d12;--dim:#7a6652;--amber:#a9611a;--amber-ink:#fff7ea;--danger:#a63a30;color-scheme:light}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--fg);font:15px/1.55 "Noto Sans KR",system-ui,sans-serif;padding-block:20px 48px;padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px))}
main{max-width:720px;margin:0 auto;display:flex;flex-direction:column;gap:22px}
h1{font:700 26px/1.2 var(--serif);margin:0;text-wrap:balance}
h2{font:700 13px/1 var(--mono);letter-spacing:.14em;text-transform:uppercase;color:var(--amber);margin:0 0 12px}
p{margin:0;color:var(--dim)}
section{background:var(--panel);border:1px solid var(--line);padding:16px;display:flex;flex-direction:column;gap:12px;min-width:0}
.row{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
button{font:inherit;color:var(--fg);background:transparent;border:1px solid var(--line);padding:9px 13px;min-height:42px;cursor:pointer;border-radius:3px}
button:hover{border-color:var(--amber)}
button:focus-visible,input:focus-visible,audio:focus-visible{outline:2px solid var(--amber);outline-offset:2px}
button.on{background:var(--amber);color:var(--amber-ink);border-color:var(--amber);font-weight:700}
button.go{border-color:var(--amber);color:var(--amber)}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(132px,1fr));gap:8px}
.grid button{display:flex;flex-direction:column;align-items:flex-start;gap:2px;text-align:left}
.grid small{color:var(--dim);font:11px var(--mono)}
.vol{display:flex;align-items:center;gap:10px;flex:1 1 220px}
.vol input{flex:1;min-width:0;accent-color:var(--amber)}
.vol b{font:13px var(--mono);min-width:3.2em;text-align:right}
.lab{font:11px var(--mono);color:var(--dim);letter-spacing:.08em;text-transform:uppercase;min-width:3.4em}
audio{width:100%;height:40px}
.trk{display:flex;flex-direction:column;gap:6px;padding-top:10px;border-top:1px solid var(--line)}
.trk:first-of-type{border-top:0;padding-top:0}
.trk b{font-weight:600}
#state{font:12px var(--mono);color:var(--dim)}
</style>
<main>
<div><h1>소리 시험실</h1><p>배경음악과 타격음만 따로 들어 보는 페이지입니다. 소리는 버튼을 눌러야 납니다.</p></div>
<section><h2>타격음</h2>
<div class="row"><span class="lab">음량</span><label class="vol"><input id="sv" type="range" min="0" max="100" value="70" aria-label="효과음 음량"><b id="svp">70%</b></label></div>
<div class="row"><button class="go" data-seq="hit">공격 한 번 · 주사위 → 타격</button><button class="go" data-seq="miss">회피 한 번 · 주사위 → 빗나감</button></div>
<div class="row"><span class="lab">종류</span><span id="kindrow" class="row"></span><button id="bigb">큰 피해</button></div>
<h2 style="margin-top:6px">하나씩</h2>
<div class="grid" id="sg"></div>
</section>
<section><h2>합성 배경음악</h2>
<div class="row"><span class="lab">스타일</span><span id="stl" class="row"></span></div>
<div class="row"><span class="lab">장면</span><span id="scn" class="row"></span></div>
<div class="row"><button id="bgmb" class="go">재생</button><label class="vol"><span class="lab">음량</span><input id="bv" type="range" min="0" max="100" value="50" aria-label="배경음악 음량"><b id="bvp">50%</b></label></div>
<div id="state"></div>
</section>
${samples.length?`<section><h2>악기 샘플 배경음악</h2><p>사운드폰트로 연주한 시험 곡입니다. 반복 재생됩니다.</p>${samples.map(([k,b])=>`<div class="trk"><b>${LABEL[k]||k}</b><audio controls loop preload="none" src="data:audio/mpeg;base64,${b}"></audio></div>`).join('')}</section>`:''}
</main>
<script>
${strip('src/sfx.js')}
${strip('src/bgm.js')}
(()=>{
const $=id=>document.getElementById(id);let vol=0.7;
const SFX=createSfx(()=>true,()=>vol),BGM=createBgm();
const KINDS=[['slash','참격'],['pierce','관통'],['blunt','타격']];let kind='slash',big=false;
const mk=(box,items,get,set,after)=>{box.innerHTML='';for(const [k,t] of items){const b=document.createElement('button');b.textContent=t;b.dataset.k=k;b.onclick=()=>{set(k);paint();after&&after(k)};box.appendChild(b)}};
const paint=()=>{for(const b of $('kindrow').children)b.classList.toggle('on',b.dataset.k===kind);$('bigb').classList.toggle('on',big);for(const b of $('stl').children)b.classList.toggle('on',b.dataset.k===BGM.style());for(const b of $('scn').children)b.classList.toggle('on',b.dataset.k===scene)};
let scene='calm';
mk($('kindrow'),KINDS,()=>kind,k=>kind=k);
$('bigb').onclick=()=>{big=!big;paint()};
const NAMES=[['snap','주사위 굴림','시작'],['hit','주사위 멈춤','명중'],['dodge','주사위 멈춤','회피'],['tick','피해 주사위','틱'],['slash','참격','보통'],['slash_h','참격','큰 피해'],['pierce','관통','보통'],['pierce_h','관통','큰 피해'],['blunt','타격','보통'],['blunt_h','타격','큰 피해'],['block','막기','금속'],['whoosh','빗나감','먹먹']];
$('sg').innerHTML=NAMES.map(([k,a,b])=>'<button data-p="'+k+'">'+a+'<small>'+b+'</small></button>').join('');
$('sg').onclick=e=>{const b=e.target.closest('button');if(b)SFX.play(b.dataset.p)};
const seq=t=>{const k=kind+(big?'_h':'');if(t==='hit'){SFX.play('snap');setTimeout(()=>SFX.play('hit'),500);setTimeout(()=>SFX.play('dodge'),700);setTimeout(()=>SFX.play(k),1150)}else{SFX.play('snap');setTimeout(()=>SFX.play('hit'),500);setTimeout(()=>SFX.play('dodge'),700);setTimeout(()=>SFX.play('whoosh'),1150)}};
document.querySelectorAll('[data-seq]').forEach(b=>b.onclick=()=>seq(b.dataset.seq));
$('sv').oninput=e=>{vol=+e.target.value/100;$('svp').textContent=e.target.value+'%'};
mk($('stl'),[['calm','고요'],['passion','불길'],['library','도서관']],()=>BGM.style(),k=>BGM.setStyle(k));
mk($('scn'),[['calm','평시'],['fight','전투'],['boss','보스']],()=>scene,k=>{scene=k;BGM.setScene(k)});
$('bgmb').onclick=()=>{const on=BGM.set(!BGM.isOn());$('bgmb').textContent=on?'정지':'재생';$('bgmb').classList.toggle('go',!on);$('bgmb').classList.toggle('on',on)};
$('bv').oninput=e=>{BGM.setVol(+e.target.value/100);$('bvp').textContent=e.target.value+'%'};
BGM.setVol(0.5);BGM.setStyle('library');paint();
setInterval(()=>{const d=BGM.debug();$('state').textContent=BGM.isOn()?'재생 중 · '+d.style+' · '+d.scene+' · '+d.state:''},500);
})();
</script>`;
fs.mkdirSync('dist',{recursive:true});fs.writeFileSync('dist/soundlab.html',html);console.log('dist/soundlab.html',Math.round(html.length/1024)+'KB',samples.length+'곡');
