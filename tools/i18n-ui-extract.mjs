/* 코드(src/*.js)에 박힌 화면 문구 조각을 뽑는다: node tools/i18n-ui-extract.mjs
   따옴표·템플릿 문자열 안의 한글 조각을 ${…}와 <태그> 기준으로 나눠 data/i18n/ui-strings.json 에 쓴다.
   조각이 화면의 글자 한 덩어리와 정확히 같을 때만 trDom이 바꾼다(숫자·이름이 섞이는 문장은 나중에 tr()로 따로 감싼다) */
import {readFileSync,writeFileSync} from 'node:fs';
const out=new Set();
for(const f of ['ui.js','engine.js','config.js']){
  const s=readFileSync(new URL('../src/'+f,import.meta.url),'utf8');
  const re=/'((?:[^'\\\n]|\\.)*[가-힣](?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*[가-힣](?:[^"\\\n]|\\.)*)"|`((?:[^`\\]|\\.)*[가-힣](?:[^`\\]|\\.)*)`/g;let m;
  while((m=re.exec(s))){const t=m[1]||m[2]||m[3];
    for(let seg of t.split(/\$\{[^}]*\}|<[^>]+>/)){seg=seg.replace(/\\n/g,' ').replace(/\\'/g,"'").trim();if(/[가-힣]/.test(seg)&&seg.length>=2&&!/[\t\n]/.test(seg))out.add(seg)}}
}
const list=[...out];writeFileSync(new URL('../data/i18n/ui-strings.json',import.meta.url),JSON.stringify(list));
console.log(`화면 문구 조각 ${list.length}개 · ${list.reduce((a,x)=>a+x.length,0)}자`);
