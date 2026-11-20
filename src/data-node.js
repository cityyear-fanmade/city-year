/* Node용 데이터 로더: data/*.json을 하나로 합친다 (브라우저는 src/main.js에서 fetch) */
import {readFileSync} from 'node:fs';
export const DATA_FILES=['cards','enemies','encounters','events','birth','workshops','fingers','web','text'];
export function loadData(dir=new URL('../data/',import.meta.url)){
  const D={};
  for(const f of DATA_FILES){
    const o=JSON.parse(readFileSync(new URL(f+'.json',dir),'utf8'));
    if(f==='text')D.text=o;else Object.assign(D,o);
  }
  return D;
}

/* JSON 원문에서 같은 객체 안의 중복 키를 찾는다. JSON.parse는 중복 키를 조용히 마지막 값으로 덮어써서 로드 뒤에는 알 수 없다.
   문자열 안의 따옴표·이스케이프·중첩 객체/배열을 구분하고, 키는 JSON 규칙대로 풀어서(\u 이스케이프 포함) 비교한다.
   반환: ['파일: 중복 키 "이름" (줄 a, b)', …] */
export function dupKeysIn(text,name='JSON'){
  const out=[],st=[];let i=0,line=1;const n=text.length;
  while(i<n){
    const c=text[i];
    if(c==='\n'){line++;i++;continue}
    if(c==='"'){
      const at=line;let j=i+1;
      while(j<n&&text[j]!=='"'){if(text[j]==='\\')j++;j++}
      const top=st[st.length-1];
      if(top&&top.obj&&top.wantKey){
        let key;try{key=JSON.parse(text.slice(i,j+1))}catch(e){key=text.slice(i+1,j)}
        const prev=top.seen.get(key);
        if(prev){prev.push(at);if(prev.length===2)out.push({key,lines:prev})}else top.seen.set(key,[at]);
        top.wantKey=false;
      }
      i=j+1;continue;
    }
    if(c==='{')st.push({obj:true,wantKey:true,seen:new Map()});
    else if(c==='[')st.push({obj:false});
    else if(c==='}'||c===']')st.pop();
    else if(c===','){const top=st[st.length-1];if(top&&top.obj)top.wantKey=true}
    i++;
  }
  return out.map(o=>`${name}: 중복 키 "${o.key}" (줄 ${o.lines.join(', ')})`);
}
/* 게임이 읽는 data/*.json(DATA_FILES) 전부의 중복 키 */
export function findDupKeys(dir=new URL('../data/',import.meta.url)){
  return DATA_FILES.flatMap(f=>dupKeysIn(readFileSync(new URL(f+'.json',dir),'utf8'),`data/${f}.json`));
}
