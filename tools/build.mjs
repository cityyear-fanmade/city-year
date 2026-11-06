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
const BGM_STUB=`function createBgm(){const f=()=>{};return {supported:false,isOn:()=>false,set:f,setMood:f,setScene:f,setVol:f,setStyle:f,setOnFail:f,style:()=>'calm',extOn:()=>false,ext:()=>({calm:1,fight:1}),setExt:f,vol:()=>0,level:()=>0,debug:()=>null}}`;
/* 악기 샘플 배경음악(assets/bgm/<스타일>_<장면>.mp3)을 data 주소로 넣는다. --nosamples면 넣지 않아 합성음만 쓴다 */
const noSamples=process.argv.includes('--nosamples');
/* --extbgm: 배경음악 파일을 HTML에 넣지 않고 assets/bgm/ 아래 mp3를 필요할 때 읽는다 (본섭 페이지가 너무 커서 휴대폰에서 안 열리던 문제) */
const extBgm=process.argv.includes('--extbgm');
/* --lake: 대호수 출생 시험용. 오늘의 시드가 언제나 히든 출생 40(대호수로 나간 자)으로 태어난다 */
const lakeTest=process.argv.includes('--lake');
/* --mind: 정신력 10 이하 연출(목소리·뒤틀림 사건·전투 중 정신력 0)만 시험하는 판 */
const mindTest=process.argv.includes('--mind');
/* --symtest: 심볼 시험판. 시작 화면에 '심볼 시험장'이 생긴다(무한 체력 전투 · 획득 화면 미리보기 · 장착) */
/* --alltest: 개인 시험판(모든 심볼·테두리·기록·해금 출생이 열려 있고 심볼 시험장이 있다). --pubtest: 공개 테스트 서버(잠금 규칙은 본섭과 같고 시험 메뉴 없음, 제목에 '테스트 서버' 표시) */
const allTest=process.argv.includes('--alltest'),pubTest=process.argv.includes('--pubtest');
const symTest=process.argv.includes('--symtest')||allTest;
/* --finger: 손가락 루트 전용 시험판. 출생 화면에 조직 출신·보냐텔리·별에 선택받은 자로 바로 태어나는 버튼이 생긴다 */
const fingerTest=process.argv.includes('--finger');
/* --unlocktest: 해금 출생 시험판 */
const unlockTest=process.argv.includes('--unlocktest')||allTest||pubTest;   /* 공개 테섭도 해금 출생·직업은 모두 열어 둔다(기록실·꾸미기 보상은 잠긴 채) */
/* 번역 사전(data/i18n/*.json): 단일 파일 빌드에는 넣고, --pages 빌드는 data/i18n/ 경로에서 읽는다 */
const i18nData={};try{const {readdirSync}=await import('node:fs');for(const f of readdirSync(new URL('../data/i18n/',import.meta.url)))if(f.endsWith('.json'))i18nData[f.replace('.json','')]=JSON.parse(readFileSync(new URL('../data/i18n/'+f,import.meta.url),'utf8'))}catch(e){}
/* 심볼 이미지(assets/symbol/*.png): 단일 파일 빌드에는 data 주소로 넣고, --pages 빌드는 assets 경로를 그대로 쓴다 */
const symData={};try{const {readdirSync}=await import('node:fs');for(const f of readdirSync(new URL('../assets/symbol/',import.meta.url)))if(f.endsWith('.png'))symData[f.replace('.png','')]='data:image/png;base64,'+readFileSync(new URL('../assets/symbol/'+f,import.meta.url)).toString('base64')}catch(e){}
const frmData={};try{const {readdirSync}=await import('node:fs');for(const f of readdirSync(new URL('../assets/frame/',import.meta.url)))if(f.endsWith('.png'))frmData[f.replace('.png','')]='data:image/png;base64,'+readFileSync(new URL('../assets/frame/'+f,import.meta.url)).toString('base64')}catch(e){}
const bgmData={};if(!noBgm&&!noSamples&&!extBgm){for(const st of ['calm','passion','library','wave'])for(const sc of ['calm','fight','fight1','fight2','fight3','fight4','fight5']){try{(bgmData[st]=bgmData[st]||{})[sc]='data:audio/mpeg;base64,'+readFileSync(new URL(`../assets/bgm/${st}_${sc}.mp3`,import.meta.url)).toString('base64')}catch(e){}}}{const td=(process.argv.find(x=>x.startsWith('--bgmtest='))||'').slice(10);if(td&&!noBgm){bgmData.ext={};for(let i=1;i<=5;i++)for(const sc of ['calm','fight']){bgmData.ext['t'+i+'_'+sc]=`assets/bgm/ext/t${i}_${sc}.mp3`}if(bgmData.passion)for(const k of ['fight1','fight2','fight3','fight4','fight5'])delete bgmData.passion[k]}}
try{bgmData.boss={boss:'data:audio/mpeg;base64,'+readFileSync(new URL('../assets/bgm/boss_boss.mp3',import.meta.url)).toString('base64')}}catch(e){}
/* 뤼엔 전용 곡은 사용자가 따로 정해 주기로 해서 기본 빌드에는 넣지 않는다(--ruenbgm으로만 넣는다) */
try{if(!noBgm&&!noSamples&&!extBgm&&process.argv.includes('--ruenbgm'))bgmData.ruen={boss:'data:audio/mpeg;base64,'+readFileSync(new URL('../assets/bgm/ruen_boss.mp3',import.meta.url)).toString('base64')}}catch(e){}
/* 이미지 저장용 html2canvas(MIT)를 파일에 넣어 둔다. 인터넷이 막힌 곳에서도 결과 이미지를 만들 수 있게 (없으면 CDN에서 받는다) */
const h2c=(()=>{try{return r('vendor/html2canvas.min.js').replace(/<\/script/gi,'<\\/script')}catch(e){return ''}})();
const js0=['src/config.js','src/i18n.js','src/engine.js','src/bgm.js','src/sfx.js','src/ui.js'].map(p=>`/* ---- ${p} ---- */\n`+(noBgm&&p==='src/bgm.js'?BGM_STUB:strip(r(p)))).join('\n');
const js1=routeTest?js0.replace(/blankFate: \{chance: \d+,/,'blankFate: {chance: 100,'):js0;
const js2=lakeTest?js1.replace(/dailyOrigin: \d+,/,'dailyOrigin: 40,').replace(/dailyPlan: \{[^\n]*\},\n/,'dailyPlan: {},\n').replace('<b>오늘의 시드</b><span class="dim small">${todayKey()} · 오늘은 모두가 같은 출생으로 시작한다','<b>바다로 나가기</b><span class="dim small">${todayKey()} · 대호수의 선원으로 시작한다 (시험용)').replace("${UI.confirmNew==='daily'?'오늘의 시드':'새로 시작하기'}","${UI.confirmNew==='daily'?'바다로 나가기':'새로 시작하기'}").replace("store.get('cityYearNotice')!==NOTICE.id","false"):js1;
const js3=mindTest?js2.replace('const MINDTEST=false;','const MINDTEST=true;').replace("store.get('cityYearNotice')!==NOTICE.id",'false'):js2;
const js4=fingerTest?js3.replace('const FINGERTEST=false;','const FINGERTEST=true;'):js3;
const js=unlockTest?js4.replace('const UNLOCKTEST=false;','const UNLOCKTEST=true;').replace("store.get('cityYearNotice')!==NOTICE.id",pubTest?"store.get('cityYearNotice')!==NOTICE.id":'false'):js4;   /* 공개 테섭은 공지를 보여 준다(선공개) */
/* 공개 테스트 서버·개인 시험판은 첫 화면 위쪽 글줄에 구분 표시를 붙인다 */
const jsL=(pubTest||allTest)?js.replace('비영리 · ${VERSION}</div>',()=>'비영리 · ${VERSION} · '+(allTest?'개인 시험판':'테스트 서버')+'</div>'):js;
const ai=process.argv.indexOf('--expires'),expires=ai>0?Date.parse(process.argv[ai+1]):null;
if(ai>0&&!expires){console.error('--expires 뒤에 ISO 시각이 필요하다 (예: 2026-10-11T11:30:00Z)');process.exit(1)}
let html=r('dev.html')
  .replace('<link rel="stylesheet" href="css/style.css">',()=>`<style>\n${r('css/style.css')}</style>`)
  .replace('<script type="module" src="src/main.js"></script>',()=>`<script>\nwindow.CITY_H2C=${JSON.stringify(h2c)};\n${process.argv.includes('--pages')?'':`window.CITY_SYM=${JSON.stringify(symData)};\n`}${process.argv.includes('--pages')?'':`window.CITY_FRM=${JSON.stringify(frmData)};\n`}${process.argv.includes('--pages')?'':`window.CITY_I18N=${JSON.stringify(i18nData)};\n`}${symTest?'window.CITY_SYMTEST=true;\n':''}${extBgm?'':`window.CITY_BGM=${JSON.stringify(bgmData)};\n`}(()=>{\n${jsL}\nconst DATA=${JSON.stringify(D)};\ninitI18n().then(()=>{localize(DATA);window.CITY=startUI(createEngine(DATA),document.getElementById('app'))});\n})();\n</script>`);
if(lab)html=html.replace('<title>도시의 한 해</title>','<title>타격 모션 시험실</title>').replace('\nwindow.CITY_BGM=',`\nwindow.CITY_LAB=true;\n${expires?`window.CITY_EXPIRES=${expires};\n`:''}window.CITY_BGM=`);
if(augdemo)html=html.replace('<title>도시의 한 해</title>','<title>의수 의뢰 체험</title>').replace('\nwindow.CITY_BGM=','\nwindow.CITY_AUGDEMO=true;\nwindow.CITY_BGM=');
if(routeTest)html=html.replace('<title>도시의 한 해</title>','<title>도시의 한 해 · R사·H사 테스트</title>');
if(mindTest)html=html.replace('<title>도시의 한 해</title>','<title>도시의 한 해 · 정신력 시험</title>');
if(lakeTest)html=html.replace('<title>도시의 한 해</title>','<title>도시의 한 해 · 대호수 테스트</title>');
if(fingerTest)html=html.replace('<title>도시의 한 해</title>','<title>도시의 한 해 · 손가락 테스트</title>');
if(unlockTest)html=html.replace('<title>도시의 한 해</title>','<title>도시의 한 해 · 해금 출생 테스트</title>');
if(expires)html=html.replace(routeTest?'<title>도시의 한 해 · R사·H사 테스트</title>':'<title>도시의 한 해</title>',routeTest?'<title>도시의 한 해 R사 H사 테스트</title>':'<title>도시의 한 해 플레이테스트</title>')
  .replace('\nwindow.CITY_BGM=',`\nwindow.CITY_EXPIRES=${expires};\nwindow.CITY_BGM=`);
if(allTest)html=html.replace('\nwindow.CITY_BGM=','\nwindow.CITY_OPENALL=true;\nwindow.CITY_ALLREC=true;\nwindow.CITY_BGM=').replace('<title>도시의 한 해</title>','<title>도시의 한 해 · 개인 시험판</title>');
if(pubTest)html=html.replace('<title>도시의 한 해</title>','<title>도시의 한 해 · 테스트 서버</title>');
const pages=process.argv.includes('--pages')&&!expires;
const out=allTest?'city-year-all-test.html':pubTest?'city-year-public-test.html':symTest?'city-year-symbol-test.html':augdemo?'aug-demo.html':lab?'motion-lab.html':unlockTest?'city-year-unlock-test.html':fingerTest?'city-year-finger-test.html':lakeTest?'city-year-lake-test.html':mindTest?'city-year-mind-test.html':pages?'index.html':routeTest&&expires?'city-year-route-playtest.html':routeTest?'city-year-route-test.html':expires?'city-year-playtest.html':'city-year.html';
mkdirSync(new URL('../dist/',import.meta.url),{recursive:true});
writeFileSync(new URL((pages?'../':'../dist/')+out,import.meta.url),html);
console.log(`${pages?'':'dist/'}${out} · ${(html.length/1024).toFixed(0)}KB${expires?' · 종료 '+new Date(expires).toISOString():''}`);
