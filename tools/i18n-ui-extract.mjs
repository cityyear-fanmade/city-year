/* 코드(src/*.js)에 박힌 화면 문구를 문장 틀로 뽑는다: node tools/i18n-ui-extract.mjs
   - 코드를 직접 훑어(주석·정규식·중첩 ${…} 처리) 따옴표·템플릿 문자열을 찾는다.
   - 템플릿의 ${…} 자리는 {0}, {1}…로 바꾸고 <태그> 기준으로 나눈 한글 덩어리를 data/i18n/ui-strings.json 에 쓴다.
   - 번역(제미나이)도 같은 틀 단위로 한다. 화면에서는 src/i18n.js 의 trDom 이 틀에 맞는 글자를 찾아 값을 다시 끼운다 */
import {readFileSync,writeFileSync} from 'node:fs';
const HAN=/[가-힣]/;
export function scanFile(s){
  const tpls=[],strs=[];let i=0;const n=s.length;
  const isRe=prev=>!prev||/[(,=:\[!&|?{};+\-*%<>~^]/.test(prev)||/(^|\W)(return|typeof|case|in|of|void|delete)$/.test(prev);
  /* 템플릿 문자열 하나를 읽는다. i는 여는 백틱 다음 */
  function tpl(){
    const st=[''];
    while(i<n){const c=s[i];
      if(c==='\\'){st[st.length-1]+=s.slice(i,i+2);i+=2;continue}
      if(c==='`'){i++;break}
      if(c==='$'&&s[i+1]==='{'){i+=2;code(true);st.push('');continue}
      st[st.length-1]+=c;i++}
    tpls.push(st);
  }
  /* 코드를 읽는다. untilBrace이면 짝이 맞는 } 에서 멈춘다 */
  function code(untilBrace){
    let depth=0,prev='',word='';
    while(i<n){const c=s[i];
      if(c==='/'&&s[i+1]==='/'){while(i<n&&s[i]!=='\n')i++;continue}
      if(c==='/'&&s[i+1]==='*'){i=s.indexOf('*/',i+2)+2;continue}
      if(c==="'"||c==='"'){const q=c;let j=i+1;while(j<n&&s[j]!==q){if(s[j]==='\\')j++;j++}strs.push(s.slice(i+1,j));i=j+1;prev='x';word='';continue}
      if(c==='`'){i++;tpl();prev='x';word='';continue}
      if(c==='/'&&isRe(prev||word)){let j=i+1,cl=false;while(j<n){if(s[j]==='\\')j++;else if(s[j]==='[')cl=true;else if(s[j]===']')cl=false;else if(s[j]==='/'&&!cl)break;j++}i=j+1;while(/[a-z]/.test(s[i]||''))i++;prev='x';word='';continue}
      if(c==='{'){depth++}
      if(c==='}'){if(depth===0&&untilBrace){i++;return}depth--}
      if(/\s/.test(c)){i++;continue}
      if(/[A-Za-z_$]/.test(c)){word+=c;prev=''}else{word='';prev=c}
      i++}
  }
  code(false);
  return {tpls,strs};
}
const unesc=t=>t.replace(/\\n/g,' ').replace(/\\t/g,' ').replace(/\\(['"`$\\])/g,'$1');
/* 정적 조각들과 구멍 → 태그로 나눈 덩어리 목록 ({0}, {1}… 번호는 덩어리마다 새로 센다) */
export function segments(statics){
  const t=statics.map(unesc).reduce((a,x,k)=>a+(k?'\u0001':'')+x,'');
  const out=[];
  for(let seg of t.split(/<[^>]*>/)){
    seg=seg.replace(/\s+/g,' ').replace(/^[\s·,→]+|[\s·,→]+$/g,'');   // 앞뒤의 구분점은 틀에 넣지 않는다(화면에서 구분점 기준으로 나눠 맞춘다)
    let k=0;seg=seg.replace(/\u0001/g,()=>`{${k++}}`);
    if(HAN.test(seg))out.push(seg)
  }
  return out;
}
export function extractAll(files=['ui.js','engine.js','config.js']){
  const out=new Set();
  for(const f of files){
    const {tpls,strs}=scanFile(readFileSync(new URL('../src/'+f,import.meta.url),'utf8'));
    for(const st of tpls)if(st.some(x=>HAN.test(x)))for(const g of segments(st))out.add(g);
    for(const x of strs)if(HAN.test(x))for(const g of segments([x]))out.add(g);
  }
  return [...out];
}
if(process.argv[1]&&process.argv[1].endsWith('i18n-ui-extract.mjs')){
  const list=extractAll();writeFileSync(new URL('../data/i18n/ui-strings.json',import.meta.url),JSON.stringify(list));
  const holes=list.filter(x=>/\{\d+\}/.test(x)).length;
  console.log(`화면 문구 ${list.length}개 (자리표시 있는 틀 ${holes}개) · ${list.reduce((a,x)=>a+x.length,0)}자`);
}
