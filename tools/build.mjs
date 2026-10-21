/* 단일 파일 빌드: npm run build → dist/city-year.html
   CSS, 데이터(JSON), config·engine·ui를 한 파일에 넣는다. 서버 없이 휴대폰에서 바로 열 수 있다.
   플레이테스트용: npm run build -- --expires 2026-10-11T11:30:00Z → dist/city-year-playtest.html
   (그 시각이 지나면 새 판을 시작할 수 없다)
   R사·H사 루트 테스트용: npm run build -- --routetest → dist/city-year-route-test.html (운명 선택이 항상 뜬다)
   공유용(마감 있음): npm run build -- --routetest --expires 2026-10-17T15:00:00Z → dist/city-year-route-playtest.html
   타격 모션 시험실: npm run build -- --lab → dist/motion-lab.html
   의수 의뢰 체험: npm run build -- --augdemo → dist/aug-demo.html
   음악 제외: --nobgm (배경음악 코드를 넣지 않는다)
   GitHub Pages용: npm run build -- --pages → 저장소 루트 index.html */
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {loadData} from '../src/data-node.js';
import {validateData} from '../src/engine.js';
const r=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const D=loadData(),err=validateData(D);
if(err.length){console.error('데이터 오류:\n  '+err.join('\n  '));process.exit(1)}
/* 모듈 문법만 걷어 낸다: import 줄 삭제, export 키워드 삭제 */
const strip=s=>s.replace(/^import .*;\s*$/gm,'').replace(/^export (const|function|async function|let)/gm,'$1');
const routeTest=process.argv.includes('--routetest'),lab=process.argv.includes('--lab'),augdemo=process.argv.includes('--augdemo'),noBgm=lab||augdemo||process.argv.includes('--nobgm');
const BGM_STUB=`function createBgm(){const f=()=>{};return {supported:false,isOn:()=>false,set:f,setMood:f,setScene:f,setVol:f,setStyle:f,style:()=>'calm',extOn:()=>false,ext:()=>({calm:1,fight:1}),setExt:f,vol:()=>0,level:()=>0,debug:()=>null}}`;
/* 악기 샘플 배경음악(assets/bgm/<스타일>_<장면>.mp3)을 data 주소로 넣는다. --nosamples면 넣지 않아 합성음만 쓴다 */
const noSamples=process.argv.includes('--nosamples');
const bgmData={};if(!noBgm&&!noSamples){for(const st of ['calm','passion','library'])for(const sc of ['calm','fight','fight1','fight2','fight3','fight4','fight5']){try{(bgmData[st]=bgmData[st]||{})[sc]='data:audio/mpeg;base64,'+readFileSync(new URL(`../assets/bgm/${st}_${sc}.mp3`,import.meta.url)).toString('base64')}catch(e){}}}{const td=(process.argv.find(x=>x.startsWith('--bgmtest='))||'').slice(10);if(td&&!noBgm){bgmData.ext={};for(let i=1;i<=5;i++)for(const sc of ['calm','fight']){bgmData.ext['t'+i+'_'+sc]=`assets/bgm/ext/t${i}_${sc}.mp3`}if(bgmData.passion)for(const k of ['fight1','fight2','fight3','fight4','fight5'])delete bgmData.passion[k]}}
try{bgmData.boss={boss:'data:audio/mpeg;base64,'+readFileSync(new URL('../assets/bgm/boss_boss.mp3',import.meta.url)).toString('base64')}}catch(e){}
const js0=['src/config.js','src/engine.js','src/bgm.js','src/sfx.js','src/ui.js'].map(p=>`/* ---- ${p} ---- */\n`+(noBgm&&p==='src/bgm.js'?BGM_STUB:strip(r(p)))).join('\n');
const js=routeTest?js0.replace(/blankFate: \{chance: \d+,/,'blankFate: {chance: 100,'):js0;
const ai=process.argv.indexOf('--expires'),expires=ai>0?Date.parse(process.argv[ai+1]):null;
if(ai>0&&!expires){console.error('--expires 뒤에 ISO 시각이 필요하다 (예: 2026-10-11T11:30:00Z)');process.exit(1)}
let html=r('dev.html')
  .replace('<link rel="stylesheet" href="css/style.css">',()=>`<style>\n${r('css/style.css')}</style>`)
  .replace('<script type="module" src="src/main.js"></script>',()=>`<script>\nwindow.CITY_BGM=${JSON.stringify(bgmData)};\n(()=>{\n${js}\nconst DATA=${JSON.stringify(D)};\nwindow.CITY=startUI(createEngine(DATA),document.getElementById('app'));\n})();\n</script>`);
if(lab)html=html.replace('<title>도시의 한 해</title>','<title>타격 모션 시험실</title>').replace('<script>\nwindow.CITY_BGM=',`<script>\nwindow.CITY_LAB=true;\n${expires?`window.CITY_EXPIRES=${expires};\n`:''}window.CITY_BGM=`);
if(augdemo)html=html.replace('<title>도시의 한 해</title>','<title>의수 의뢰 체험</title>').replace('<script>\nwindow.CITY_BGM=','<script>\nwindow.CITY_AUGDEMO=true;\nwindow.CITY_BGM=');
if(routeTest)html=html.replace('<title>도시의 한 해</title>','<title>도시의 한 해 · R사·H사 테스트</title>');
if(expires)html=html.replace(routeTest?'<title>도시의 한 해 · R사·H사 테스트</title>':'<title>도시의 한 해</title>',routeTest?'<title>도시의 한 해 R사 H사 테스트</title>':'<title>도시의 한 해 플레이테스트</title>')
  .replace('<script>\nwindow.CITY_BGM=',`<script>\nwindow.CITY_EXPIRES=${expires};\nwindow.CITY_BGM=`);
const pages=process.argv.includes('--pages')&&!expires;
const out=augdemo?'aug-demo.html':lab?'motion-lab.html':pages?'index.html':routeTest&&expires?'city-year-route-playtest.html':routeTest?'city-year-route-test.html':expires?'city-year-playtest.html':'city-year.html';
mkdirSync(new URL('../dist/',import.meta.url),{recursive:true});
writeFileSync(new URL((pages?'../':'../dist/')+out,import.meta.url),html);
console.log(`${pages?'':'dist/'}${out} · ${(html.length/1024).toFixed(0)}KB${expires?' · 종료 '+new Date(expires).toISOString():''}`);
