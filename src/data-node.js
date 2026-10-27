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
