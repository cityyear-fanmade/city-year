/* 단일 파일 빌드: npm run build → dist/city-year.html
   CSS, 데이터(JSON), config·engine·ui를 한 파일에 넣는다. 서버 없이 휴대폰에서 바로 열 수 있다.
   플레이테스트용: npm run build -- --expires 2026-10-11T11:30:00Z → dist/city-year-playtest.html
   (그 시각이 지나면 새 판을 시작할 수 없다)
   R사·H사 루트 테스트용: npm run build -- --routetest → dist/city-year-route-test.html (운명 선택이 항상 뜬다)
   공유용(마감 있음): npm run build -- --routetest --expires 2026-10-17T15:00:00Z → dist/city-year-route-playtest.html
   타격 모션 시험실: npm run build -- --lab → dist/motion-lab.html
   의수 의뢰 체험: npm run build -- --augdemo → dist/aug-demo.html
   손가락 루트 시험판: npm run build -- --finger → dist/city-year-finger-test.html (출생 화면에서 조직 출신·보냐텔리·별에 선택받은 자로 바로 태어난다)
   해금 출생 시험판: npm run build -- --unlocktest → dist/city-year-unlock-test.html (해금 출생·히든 직업이 모두 열려 있고, 출생 화면에서 중간 연차로 바로 시작할 수 있다)
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
/* --lake: 대호수 출생 시험용. 오늘의 시드가 언제나 히든 출생 40(대호수로 나간 자)으로 태어난다 */
const lakeTest=process.argv.includes('--lake');
/* --mind: 정신력 10 이하 연출(목소리·뒤틀림 사건·전투 중 정신력 0)만 시험하는 판 */
const mindTest=process.argv.includes('--mind');
/* --finger: 손가락 루트 전용 시험판. 출생 화면에 조직 출신·보냐텔리·별에 선택받은 자로 바로 태어나는 버튼이 생긴다 */
const fingerTest=process.argv.includes('--finger');
/* --unlocktest: 해금 출생 시험판 */
const unlockTest=process.argv.includes('--unlocktest');
const bgmData={};if(!noBgm&&!noSamples){for(const st of ['calm','passion','library','wave'])for(const sc of ['calm','fight','fight1','fight2','fight3','fight4','fight5']){try{(bgmData[st]=bgmData[st]||{})[sc]='data:audio/mpeg;base64,'+readFileSync(new URL(`../assets/bgm/${st}_${sc}.mp3`,import.meta.url)).toString('base64')}catch(e){}}}{const td=(process.argv.find(x=>x.startsWith('--bgmtest='))||'').slice(10);if(td&&!noBgm){bgmData.ext={};for(let i=1;i<=5;i++)for(const sc of ['calm','fight']){bgmData.ext['t'+i+'_'+sc]=`assets/bgm/ext/t${i}_${sc}.mp3`}if(bgmData.passion)for(const k of ['fight1','fight2','fight3','fight4','fight5'])delete bgmData.passion[k]}}
try{bgmData.boss={boss:'data:audio/mpeg;base64,'+readFileSync(new URL('../assets/bgm/boss_boss.mp3',import.meta.url)).toString('base64')}}catch(e){}
try{if(!noBgm&&!noSamples)bgmData.ruen={boss:'data:audio/mpeg;base64,'+readFileSync(new URL('../assets/bgm/ruen_boss.mp3',import.meta.url)).toString('base64')}}catch(e){}
/* 이미지 저장용 html2canvas(MIT)를 파일에 넣어 둔다. 인터넷이 막힌 곳에서도 결과 이미지를 만들 수 있게 (없으면 CDN에서 받는다) */
const h2c=(()=>{try{return r('vendor/html2canvas.min.js').replace(/<\/script/gi,'<\\/script')}catch(e){return ''}})();
const js0=['src/config.js','src/engine.js','src/bgm.js','src/sfx.js','src/ui.js'].map(p=>`/* ---- ${p} ---- */\n`+(noBgm&&p==='src/bgm.js'?BGM_STUB:strip(r(p)))).join('\n');
const js1=routeTest?js0.replace(/blankFate: \{chance: \d+,/,'blankFate: {chance: 100,'):js0;
const js2=lakeTest?js1.replace(/dailyOrigin: \d+,/,'dailyOrigin: 40,').replace(/dailyPlan: \{[^\n]*\},\n/,'dailyPlan: {},\n').replace('<b>오늘의 시드</b><span class="dim small">${todayKey()} · 오늘은 모두가 같은 출생으로 시작한다','<b>바다로 나가기</b><span class="dim small">${todayKey()} · 대호수의 선원으로 시작한다 (시험용)').replace("${UI.confirmNew==='daily'?'오늘의 시드':'새로 시작하기'}","${UI.confirmNew==='daily'?'바다로 나가기':'새로 시작하기'}").replace("store.get('cityYearNotice')!==NOTICE.id","false"):js1;
const js3=mindTest?js2.replace('const MINDTEST=false;','const MINDTEST=true;').replace("store.get('cityYearNotice')!==NOTICE.id",'false'):js2;
const js4=fingerTest?js3.replace('const FINGERTEST=false;','const FINGERTEST=true;'):js3;
const js=unlockTest?js4.replace('const UNLOCKTEST=false;','const UNLOCKTEST=true;').replace("store.get('cityYearNotice')!==NOTICE.id",'false'):js4;
const ai=process.argv.indexOf('--expires'),expires=ai>0?Date.parse(process.argv[ai+1]):null;
if(ai>0&&!expires){console.error('--expires 뒤에 ISO 시각이 필요하다 (예: 2026-10-11T11:30:00Z)');process.exit(1)}
let html=r('dev.html')
  .replace('<link rel="stylesheet" href="css/style.css">',()=>`<style>\n${r('css/style.css')}</style>`)
  .replace('<script type="module" src="src/main.js"></script>',()=>`<script>\nwindow.CITY_H2C=${JSON.stringify(h2c)};\nwindow.CITY_BGM=${JSON.stringify(bgmData)};\n(()=>{\n${js}\nconst DATA=${JSON.stringify(D)};\nwindow.CITY=startUI(createEngine(DATA),document.getElementById('app'));\n})();\n</script>`);
if(lab)html=html.replace('<title>도시의 한 해</title>','<title>타격 모션 시험실</title>').replace('\nwindow.CITY_BGM=',`\nwindow.CITY_LAB=true;\n${expires?`window.CITY_EXPIRES=${expires};\n`:''}window.CITY_BGM=`);
if(augdemo)html=html.replace('<title>도시의 한 해</title>','<title>의수 의뢰 체험</title>').replace('\nwindow.CITY_BGM=','\nwindow.CITY_AUGDEMO=true;\nwindow.CITY_BGM=');
if(routeTest)html=html.replace('<title>도시의 한 해</title>','<title>도시의 한 해 · R사·H사 테스트</title>');
if(mindTest)html=html.replace('<title>도시의 한 해</title>','<title>도시의 한 해 · 정신력 시험</title>');
if(lakeTest)html=html.replace('<title>도시의 한 해</title>','<title>도시의 한 해 · 대호수 테스트</title>');
if(fingerTest)html=html.replace('<title>도시의 한 해</title>','<title>도시의 한 해 · 손가락 테스트</title>');
if(unlockTest)html=html.replace('<title>도시의 한 해</title>','<title>도시의 한 해 · 해금 출생 테스트</title>');
if(expires)html=html.replace(routeTest?'<title>도시의 한 해 · R사·H사 테스트</title>':'<title>도시의 한 해</title>',routeTest?'<title>도시의 한 해 R사 H사 테스트</title>':'<title>도시의 한 해 플레이테스트</title>')
  .replace('\nwindow.CITY_BGM=',`\nwindow.CITY_EXPIRES=${expires};\nwindow.CITY_BGM=`);
const pages=process.argv.includes('--pages')&&!expires;
const out=augdemo?'aug-demo.html':lab?'motion-lab.html':unlockTest?'city-year-unlock-test.html':fingerTest?'city-year-finger-test.html':lakeTest?'city-year-lake-test.html':mindTest?'city-year-mind-test.html':pages?'index.html':routeTest&&expires?'city-year-route-playtest.html':routeTest?'city-year-route-test.html':expires?'city-year-playtest.html':'city-year.html';
mkdirSync(new URL('../dist/',import.meta.url),{recursive:true});
writeFileSync(new URL((pages?'../':'../dist/')+out,import.meta.url),html);
console.log(`${pages?'':'dist/'}${out} · ${(html.length/1024).toFixed(0)}KB${expires?' · 종료 '+new Date(expires).toISOString():''}`);
