/* 개발 서버: npm run dev → http://localhost:5173 (JSON을 fetch하려면 file:// 대신 서버로 연다) */
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {extname,join,normalize} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('..',import.meta.url));
const port=+process.env.PORT||5173;
const TYPES={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.png':'image/png'};
createServer(async(req,res)=>{
  let p=decodeURIComponent(new URL(req.url,'http://x').pathname);
  if(p.endsWith('/'))p+='dev.html';
  const f=normalize(join(root,p));
  if(!f.startsWith(root)){res.writeHead(403).end();return}
  try{const b=await readFile(f);res.writeHead(200,{'content-type':TYPES[extname(f)]||'application/octet-stream','cache-control':'no-store'}).end(b)}
  catch{res.writeHead(404).end('not found')}
}).listen(port,()=>console.log(`도시의 한 해 · http://localhost:${port}`));
