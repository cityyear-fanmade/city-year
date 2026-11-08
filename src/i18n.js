/* 다국어 바탕 (2026-11): 한국어가 원본이고, 다른 언어는 "한국어 문장 → 번역" 사전으로 덮어쓴다.
   - 데이터(data/*.json): localize(D)가 문자열을 통째로 일치하는 것만 바꾼다 (사전에 없으면 한국어 그대로)
   - 화면 고정 문구: trDom(app)이 그려진 글자를 바꾼다. 숫자가 섞이는 문장은 tr('…')로 따로 감싼다
   - 사전 파일: data/i18n/<언어>.json  (없거나 비어 있어도 게임은 한국어로 정상 동작한다) */
import {CFG} from './config.js';
export const LANGS=[{k:'ko',n:'한국어'},{k:'ja',n:'日本語'},{k:'en',n:'English'}];
const KEY='cityYearLang';
let lang='ko',dict={};
const rd=()=>{try{return localStorage.getItem(KEY)}catch(e){return null}};
export const getLang=()=>lang;
export function setLang(k){
  try{localStorage.setItem(KEY,k)}catch(e){}
  if(typeof location==='undefined')return;
  /* 다시 여는 동안 멈춘 것처럼 보이지 않게, 먼저 안내 화면을 한 프레임 그린 뒤에 새로고침한다 */
  try{
    const msg={ja:'言語を切り替えています…',ko:'언어를 바꾸는 중…',en:'Switching language…'}[k]||'…';
    const d=document.createElement('div');d.setAttribute('role','status');
    d.style.cssText='position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;background:rgba(12,14,19,.92);color:#e8e6df;font:600 18px/1.4 sans-serif;letter-spacing:.04em';
    d.textContent=msg;document.body.appendChild(d);
    requestAnimationFrame(()=>requestAnimationFrame(()=>setTimeout(()=>location.reload(),30)));
  }catch(e){location.reload()}
}
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
/* 화면 글자 하나를 번역한다. 사전과 통째로 같으면 바로 바꾸고, 아니면 숫자·이름이 낀 문장 틀({0}, {1}…)과 맞춰 본다.
   틀에 맞으면 끼어 있던 값을 뽑아 일본어 틀에 다시 끼운다(값도 사전에 있으면 함께 번역) */
let PAT=null,PATIDX=null,PATSHORT=[];const memo=new Map();
const UNITS={ja:[[/(\d+)세/g,'$1歳'],[/(\d+)년차/g,'$1年目'],[/(\d+)살/g,'$1歳'],[/(\d+)번/g,'$1回'],[/(\d+)등급/g,'$1等級']],en:[[/(\d+)세/g,'age $1'],[/(\d+)년차/g,'Year $1'],[/(\d+)살/g,'age $1'],[/(\d+)번/g,'$1×'],[/(\d+)등급/g,'Rank $1']]};
const esc=x=>x.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
function buildPat(){
  PAT=[];
  for(const k in dict){
    if(!/\{\d+\}/.test(k))continue;
    const parts=k.split(/\{\d+\}/),han=(parts.join('').match(/[가-힣]/g)||[]).length;
    if(han<3&&!(han>=2&&parts[0]&&/^[가-힣A-Za-z]/.test(parts[0]))&&parts.join('').replace(/\s/g,'').length<7)continue;
    PAT.push({k,v:dict[k],re:new RegExp('^'+parts.map(esc).join('([\\s\\S]*?)').replace(/^\(\[\\s\\S\]\*\?\) /,'([\\s\\S]*?) ?').replace(/ \(\[\\s\\S\]\*\?\)$/,' ?([\\s\\S]*?)')+'$'),lk:parts.reduce((a,x)=>x.length>a.length?x:a,''),w:parts.join('').length});
  }
  PAT.sort((a,b)=>b.w-a.w);
  /* 색인: 틀의 가장 긴 고정 글자 앞 두 글자로 묶어 둔다. 글자 하나를 번역할 때 수천 개를 다 훑지 않고 그 글자에 나오는 두 글자 묶음의 틀만 맞춘다 */
  PAT.forEach((p,i)=>{p.o=i});PATIDX=new Map();PATSHORT=[];
  for(const p of PAT){if(p.lk.length<2){PATSHORT.push(p);continue}const k=p.lk.slice(0,2);let a=PATIDX.get(k);if(!a)PATIDX.set(k,a=[]);a.push(p)}
}
function patCands(s){
  const seen=new Set(),out=PATSHORT.slice();
  for(let i=0;i<s.length-1;i++){const k=s.slice(i,i+2);if(seen.has(k))continue;seen.add(k);const a=PATIDX.get(k);if(a)for(const p of a)out.push(p)}
  out.sort((a,b)=>a.o-b.o);return out;
}
function trVal(v){
  if(dict[v])return dict[v];
  /* 값 전체가 틀에 맞으면(예: '다음 등급까지 성과 0/8') 먼저 통째로 번역한다 */
  if(/[가-힣]/.test(v)){const w=trText(v.trim());if(w)return w}
  let o=v;
  if(/[가-힣]/.test(o))o=o.split(/( · |·|, |\/| → | ~ |: )/).map((x,i)=>i%2?x:(dict[x]||(/[가-힣]/.test(x)&&trText(x.trim()))||x)).join('');
  for(const [r,t] of UNITS[lang]||[])o=o.replace(r,t);
  return o;
}
function trText(s){
  if(dict[s])return dict[s];
  if(!/[가-힣]/.test(s))return null;
  if(memo.has(s))return memo.get(s);
  if(!PAT)buildPat();
  memo.set(s,null);   /* 같은 글자가 값 안에서 다시 불려도 끝없이 돌지 않게 먼저 비워 둔다 */
  let out=null;
  for(const p of patCands(s)){
    if(!s.includes(p.lk))continue;
    const m=p.re.exec(s);if(!m)continue;
    out=p.v.replace(/\{(\d+)\}/g,(_,i)=>trVal(m[+i+1]));break;
  }
  /* 구분점(·)으로 이어 붙은 글자는 조각마다 따로 번역한다. 숫자 단독(5세)은 단위만 바꾼다 */
  if(!out){
    const ps=s.split(/(\([^()]*\)| · | ·|· |·|: | → )/);   // 괄호 묶음 (명중+1 · 피해+0) 은 한 덩어리로 맞춘다
    if(ps.length>1){let any=false;const o=ps.map((x,i)=>{if(i%2){if(x[0]==='('&&/[가-힣]/.test(x)){const r=trText(x);if(r){any=true;return r}}return x}if(!/[가-힣]/.test(x))return x;const r=trText(x.trim())||(()=>{const u=trVal(x.trim());return u!==x.trim()?u:null})();if(r){any=true;return r}return x});if(any)out=o.join('')}
    else{const u=trVal(s);if(u!==s)out=u}
    /* 글자를 이어 붙여 만든 문장은 띄어쓰기 자리에서 앞뒤로 나눠, 양쪽이 다 번역되면 이어 붙인다 */
    if(!out){const ws=s.split(' ');if(ws.length>1&&ws.length<=14)for(let k=1;k<ws.length&&!out;k++){const a=trText(ws.slice(0,k).join(' ')),b=trText(ws.slice(k).join(' '));if(a&&b)out=a+b}}
  }
  /* 마지막 수단: 띄어쓰기 단위로 사전에 있는 가장 긴 구절을 찾아 바꾼다(못 찾은 말은 한국어 그대로) */
  if(!out){const ws=s.split(' ');if(ws.length<=40){let o='',ch=false;for(let i=0;i<ws.length;){let hit=null;for(let j=Math.min(ws.length,i+6);j>i;j--){const k=ws.slice(i,j).join(' ');const r=dict[k]||dict[k.replace(/[·,]+$/,'')];if(r&&/[가-힣]/.test(k)){hit=[j,r];break}}if(hit){o+=(o&&!/[ぁ-ヿ一-鿿]$/.test(o)?' ':'')+hit[1];i=hit[0];ch=true}else{o+=(o?' ':'')+ws[i];i++}}if(ch)out=o}}
  memo.set(s,out);return out;
}
export const trAny=s=>lang==='ko'?s:(trText(String(s).replace(/\s+/g,' '))||s);
/* 화면의 글자 조각 중 사전과 일치하는 것을 바꾼다 (렌더 뒤마다 부른다) */
export function trDom(root){
  if(lang==='ko'||!root||!Object.keys(dict).length||typeof document==='undefined')return;
  const w=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);let n;
  while((n=w.nextNode())){const t=n.nodeValue,s=t.trim();if(!s)continue;const r=trText(s.replace(/\s+/g,' '));if(r)n.nodeValue=t.replace(s,()=>r)}
  root.querySelectorAll('[placeholder],[title]').forEach(e=>{for(const a of ['placeholder','title']){const v=e.getAttribute(a);if(v){const r=trText(v.replace(/\s+/g,' '));if(r)e.setAttribute(a,r)}}});
}

/* 바뀐 조각(새로 붙은 노드·글자가 바뀐 노드)만 번역한다. 화면 전체를 다시 훑지 않는다 */
export function trNodes(list){
  if(lang==='ko'||!Object.keys(dict).length||typeof document==='undefined')return;
  for(const n of list){
    if(!n||!n.isConnected)continue;
    if(n.nodeType===3){const t=n.nodeValue,s=t.trim();if(!s)continue;const r=trText(s.replace(/\s+/g,' '));if(r)n.nodeValue=t.replace(s,()=>r)}
    else if(n.nodeType===1)trDom(n);
  }
}
