/* 다국어 바탕 (2026-11): 한국어가 원본이고, 다른 언어는 "한국어 문장 → 번역" 사전으로 덮어쓴다.
   - 데이터(data/*.json): localize(D)가 문자열을 통째로 일치하는 것만 바꾼다 (사전에 없으면 한국어 그대로)
   - 화면 고정 문구: trDom(app)이 그려진 글자를 바꾼다. 숫자가 섞이는 문장은 tr('…')로 따로 감싼다
   - 사전 파일: data/i18n/<언어>.json  (없거나 비어 있어도 게임은 한국어로 정상 동작한다) */
export const LANGS=[{k:'ko',n:'한국어'},{k:'ja',n:'日本語'}];
const KEY='cityYearLang';
let lang='ko',dict={};
const rd=()=>{try{return localStorage.getItem(KEY)}catch(e){return null}};
export const getLang=()=>lang;
export function setLang(k){try{localStorage.setItem(KEY,k)}catch(e){}if(typeof location!=='undefined')location.reload()}
/* 사전을 불러온다. 단일 파일 빌드는 window.CITY_I18N에 들어 있고, 그 밖에는 i18n/<언어>.json을 읽는다 */
export async function initI18n(){
  const k=rd();lang=LANGS.some(l=>l.k===k)?k:'ko';dict={};
  if(lang==='ko')return;
  try{
    if(typeof window!=='undefined'&&window.CITY_I18N&&window.CITY_I18N[lang])dict=window.CITY_I18N[lang];
    else{const r=await fetch(`data/i18n/${lang}.json`);if(r.ok)dict=await r.json()}
  }catch(e){dict={}}
  if(typeof document!=='undefined')document.documentElement.lang=lang;
}
export const tr=s=>(lang!=='ko'&&dict[s])||s;
/* 데이터 전체에서 사전과 통째로 일치하는 문자열을 바꾼다(제자리). 키·숫자·아이디는 건드리지 않는다 */
export function localize(D){
  if(lang==='ko'||!Object.keys(dict).length)return D;
  const walk=x=>{
    if(Array.isArray(x)){for(let i=0;i<x.length;i++){const v=x[i];if(typeof v==='string'){if(dict[v])x[i]=dict[v]}else if(v&&typeof v==='object')walk(v)}}
    else if(x&&typeof x==='object'){for(const k in x){const v=x[k];if(typeof v==='string'){if(dict[v])x[k]=dict[v]}else if(v&&typeof v==='object')walk(v)}}
  };
  walk(D);return D;
}
/* 화면의 글자 조각 중 사전과 일치하는 것을 바꾼다 (렌더 뒤마다 부른다) */
export function trDom(root){
  if(lang==='ko'||!root||!Object.keys(dict).length||typeof document==='undefined')return;
  const w=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);let n;
  while((n=w.nextNode())){const t=n.nodeValue,s=t.trim();if(s&&dict[s])n.nodeValue=t.replace(s,dict[s])}
  root.querySelectorAll('[placeholder],[title]').forEach(e=>{for(const a of ['placeholder','title']){const v=e.getAttribute(a);if(v&&dict[v])e.setAttribute(a,dict[v])}});
}
