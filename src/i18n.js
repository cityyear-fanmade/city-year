/* 다국어 바탕 (2026-11): 한국어가 원본이고, 다른 언어는 "한국어 문장 → 번역" 사전으로 덮어쓴다.
   - 데이터(data/*.json): localize(D)가 문자열을 통째로 일치하는 것만 바꾼다 (사전에 없으면 한국어 그대로)
   - 화면 고정 문구: trDom(app)이 그려진 글자를 바꾼다. 숫자가 섞이는 문장은 tr('…')로 따로 감싼다
   - 사전 파일: data/i18n/<언어>.json  (없거나 비어 있어도 게임은 한국어로 정상 동작한다) */
import {CFG} from './config.js';
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
/* 데이터 전체에서 사전과 통째로 일치하는 문자열을 바꾼다(제자리). 키·숫자·아이디는 건드리지 않는다.
   다른 데이터가 "이 한국어 글자"로 가리키는 이름표(객체 키, n/name 값, 조직 목록, aff·origin 같은 참조 값)는 바꾸지 않는다:
   바꾸면 서로 이름이 안 맞아 규칙이 깨진다. 이런 이름은 화면에 그려진 뒤 trDom이 글자 단위로 바꾼다 */
const IDVAL=/^(n|name|aff|origin|org|type|beat|key|id|card|enemy|boss|job|path|tag|req|flag|who|kind|src|from|to|sub|race|team|fam|k|virt)$/;
export function protectSet(D){
  const P=new Set();
  const keys=x=>{if(Array.isArray(x))x.forEach(keys);else if(x&&typeof x==='object')for(const k in x){P.add(k);keys(x[k])}};
  const refs=(x,k)=>{if(typeof x==='string'){if(k&&IDVAL.test(k))P.add(x)}else if(Array.isArray(x))x.forEach(v=>refs(v,k));else if(x&&typeof x==='object')for(const kk in x)refs(x[kk],kk)};
  keys(D);keys(CFG);refs(D,'');
  if(D.orgs)for(const g of Object.values(D.orgs))if(Array.isArray(g))g.forEach(n=>P.add(n));
  return P;
}
export function localizeWith(D,dict){
  if(!Object.keys(dict).length)return D;
  const P=protectSet(D),rep=v=>(dict[v]&&!P.has(v))?dict[v]:v;
  const walk=x=>{
    if(Array.isArray(x)){for(let i=0;i<x.length;i++){const v=x[i];if(typeof v==='string')x[i]=rep(v);else if(v&&typeof v==='object')walk(v)}}
    else if(x&&typeof x==='object'){for(const k in x){const v=x[k];if(typeof v==='string')x[k]=rep(v);else if(v&&typeof v==='object')walk(v)}}
  };
  walk(D);
  /* 홍원 12지 쌍의 표시 이름은 데이터에 함께 든 한자(예: 寅卯)로 바꾼다. 한글 한 글자 이름(묘 등)은 다른 줄기의 인물 이름과 겹치므로 사전으로 옮기지 않는다 */
  const zp=D.hwRoute&&D.hwRoute.pick&&D.hwRoute.pick.pairs;
  if(Array.isArray(zp))for(const q of zp)if(Array.isArray(q)&&typeof q[2]==='string'&&q[2].length>=2){q[0]=q[2][0];q[1]=q[2][1]}
  return D;
}
export function localize(D){return lang==='ko'?D:localizeWith(D,dict)}
/* 화면의 글자 조각 중 사전과 일치하는 것을 바꾼다 (렌더 뒤마다 부른다) */
export function trDom(root){
  if(lang==='ko'||!root||!Object.keys(dict).length||typeof document==='undefined')return;
  const w=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);let n;
  while((n=w.nextNode())){const t=n.nodeValue,s=t.trim();if(s&&dict[s])n.nodeValue=t.replace(s,dict[s])}
  root.querySelectorAll('[placeholder],[title]').forEach(e=>{for(const a of ['placeholder','title']){const v=e.getAttribute(a);if(v&&dict[v])e.setAttribute(a,dict[v])}});
}
