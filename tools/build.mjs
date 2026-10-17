/* 단일 파일 빌드: npm run build → dist/city-year.html
   CSS, 데이터(JSON), config·engine·ui를 한 파일에 넣는다. 서버 없이 휴대폰에서 바로 열 수 있다.
   플레이테스트용: npm run build -- --expires 2026-10-11T11:30:00Z → dist/city-year-playtest.html
   (그 시각이 지나면 새 판을 시작할 수 없다)
   R사·H사 루트 테스트용: npm run build -- --routetest → dist/city-year-route-test.html (운명 선택이 항상 뜬다)
   공유용(마감 있음): npm run build -- --routetest --expires 2026-10-17T15:00:00Z → dist/city-year-route-playtest.html
   GitHub Pages용: npm run build -- --pages → 저장소 루트 index.html */
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {loadData} from '../src/data-node.js';
import {validateData} from '../src/engine.js';
const r=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const D=loadData(),err=validateData(D);
if(err.length){console.error('데이터 오류:\n  '+err.join('\n  '));process.exit(1)}
/* 모듈 문법만 걷어 낸다: import 줄 삭제, export 키워드 삭제 */
const strip=s=>s.replace(/^import .*;\s*$/gm,'').replace(/^export (const|function|async function|let)/gm,'$1');
const routeTest=process.argv.includes('--routetest');
const js0=['src/config.js','src/engine.js','src/bgm.js','src/ui.js'].map(p=>`/* ---- ${p} ---- */\n`+strip(r(p))).join('\n');
const js=routeTest?js0.replace(/blankFate: \{chance: \d+,/,'blankFate: {chance: 100,'):js0;
const ai=process.argv.indexOf('--expires'),expires=ai>0?Date.parse(process.argv[ai+1]):null;
if(ai>0&&!expires){console.error('--expires 뒤에 ISO 시각이 필요하다 (예: 2026-10-11T11:30:00Z)');process.exit(1)}
let html=r('dev.html')
  .replace('<link rel="stylesheet" href="css/style.css">',()=>`<style>\n${r('css/style.css')}</style>`)
  .replace('<script type="module" src="src/main.js"></script>',()=>`<script>\n(()=>{\n${js}\nconst DATA=${JSON.stringify(D)};\nwindow.CITY=startUI(createEngine(DATA),document.getElementById('app'));\n})();\n</script>`);
if(routeTest)html=html.replace('<title>도시의 한 해</title>','<title>도시의 한 해 · R사·H사 테스트</title>');
if(expires)html=html.replace(routeTest?'<title>도시의 한 해 · R사·H사 테스트</title>':'<title>도시의 한 해</title>',routeTest?'<title>도시의 한 해 R사 H사 테스트</title>':'<title>도시의 한 해 플레이테스트</title>')
  .replace('<script>\n(()=>{',`<script>\nwindow.CITY_EXPIRES=${expires};\n(()=>{`);
const pages=process.argv.includes('--pages')&&!expires;
const out=pages?'index.html':routeTest&&expires?'city-year-route-playtest.html':routeTest?'city-year-route-test.html':expires?'city-year-playtest.html':'city-year.html';
mkdirSync(new URL('../dist/',import.meta.url),{recursive:true});
writeFileSync(new URL((pages?'../':'../dist/')+out,import.meta.url),html);
console.log(`${pages?'':'dist/'}${out} · ${(html.length/1024).toFixed(0)}KB${expires?' · 종료 '+new Date(expires).toISOString():''}`);
