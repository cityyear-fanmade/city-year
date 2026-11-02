/* 브라우저 진입점: data/*.json을 불러와 엔진과 화면을 붙인다.
   단일 파일 빌드(npm run build)에서는 이 fetch 대신 데이터가 파일 안에 들어간다. */
import {createEngine,validateData} from './engine.js';
import {startUI} from './ui.js';

const FILES=['cards','enemies','encounters','events','birth','workshops','fingers','text'];
async function loadData(){
  const D={};
  for(const f of FILES){
    const r=await fetch(`data/${f}.json`);
    if(!r.ok)throw new Error(`data/${f}.json을 읽지 못했다 (${r.status})`);
    const o=await r.json();
    if(f==='text')D.text=o;else Object.assign(D,o);
  }
  return D;
}
loadData().then(D=>{
  const err=validateData(D);
  if(err.length)console.warn('데이터 오류:\n'+err.join('\n'));
  window.CITY=startUI(createEngine(D),document.getElementById('app'));
}).catch(e=>{
  document.getElementById('app').innerHTML=`<div class="wrap"><h2>불러오기 실패</h2><p class="lead">${e.message}</p>
    <p class="small dim">파일을 바로 열면(file://) 브라우저가 JSON을 막는다. 터미널에서 <b>npm run dev</b>로 열거나, <b>npm run build</b>로 만든 dist/city-year.html을 연다.</p></div>`;
});
