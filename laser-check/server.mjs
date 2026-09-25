import http from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {DatabaseSync} from 'node:sqlite';

const root=resolve('dist'),dataDir=resolve(process.env.LASER_DATA_DIR||'data');
await mkdir(dataDir,{recursive:true});
const db=new DatabaseSync(resolve(dataDir,'inspections.sqlite'));
db.exec('PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS inspections (seq INTEGER PRIMARY KEY AUTOINCREMENT,id TEXT UNIQUE NOT NULL,date TEXT NOT NULL,inspector TEXT NOT NULL,payload TEXT NOT NULL)');
const insert=db.prepare('INSERT INTO inspections (id,date,inspector,payload) VALUES (?,?,?,?)');
const existing=db.prepare('SELECT seq,payload FROM inspections WHERE id=?');
const list=db.prepare('SELECT seq,payload FROM inspections WHERE seq>? ORDER BY seq LIMIT 201');
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.wasm':'application/wasm','.webmanifest':'application/manifest+json','.gz':'application/gzip'};
function json(res,status,data){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));}
function readJSON(req){return new Promise((resolve,reject)=>{let body='';req.on('data',chunk=>{body+=chunk;if(body.length>262144){reject(new Error('Corpo muito grande'));req.destroy();}});req.on('end',()=>{try{resolve(JSON.parse(body));}catch{reject(new Error('JSON inválido'));}});req.on('error',reject);});}
function sameOrigin(req){try{const origin=new URL(req.headers.origin);return origin.host===req.headers.host&&['http:','https:'].includes(origin.protocol);}catch{return false;}}
async function api(req,res,path,url){
  if(req.method==='POST'&&!sameOrigin(req))return json(res,403,{error:'Origem inválida'});
  if(path==='/api/records'&&req.method==='GET'){
    const after=Number(url.searchParams.get('after')||0);if(!Number.isSafeInteger(after)||after<0)return json(res,400,{error:'Cursor inválido'});
    const rows=list.all(after),page=rows.slice(0,200);
    return json(res,200,{records:page.map(row=>({...JSON.parse(row.payload),seq:row.seq,syncState:'synced'})),hasMore:rows.length>200});
  }
  if(path==='/api/records'&&req.method==='POST'){
    const record=await readJSON(req),inspector=String(record?.inspector||'').trim().replace(/\s+/g,' ');
    if(!inspector||inspector.length>80||!/^[0-9a-f-]{36}$/i.test(record.id||'')||!Number.isFinite(Date.parse(record.date))||!['COINCIDE','DIVERGENTE','PENDENTE'].includes(record.status))return json(res,400,{error:'Registro ou nome do inspetor inválido.'});
    const found=existing.get(record.id);if(found)return json(res,200,{record:{...JSON.parse(found.payload),seq:found.seq,syncState:'synced'}});
    const stored={...record,inspector};delete stored.seq;delete stored.syncState;
    insert.run(stored.id,stored.date,stored.inspector,JSON.stringify(stored));
    const row=existing.get(stored.id);return json(res,201,{record:{...stored,seq:row.seq,syncState:'synced'}});
  }
  return json(res,404,{error:'Rota não encontrada'});
}
const port=Number(process.env.PORT||4173),host=process.env.HOST||'127.0.0.1';
http.createServer(async(req,res)=>{try{
  const url=new URL(req.url,'http://localhost'),path=decodeURIComponent(url.pathname);
  if(path.startsWith('/api/'))return await api(req,res,path,url);
  if(req.method!=='GET'&&req.method!=='HEAD'){res.writeHead(405).end();return;}
  const file=resolve(root,'.'+(path==='/'?'/index.html':path));if(!file.startsWith(root+sep)){res.writeHead(403).end();return;}
  const content=await readFile(file);res.writeHead(200,{'Content-Type':types[extname(file)]||'application/octet-stream','Cache-Control':'no-cache'});res.end(req.method==='HEAD'?undefined:content);
}catch(error){if((req.url||'').startsWith('/api/'))json(res,error.message==='Corpo muito grande'?413:400,{error:error.message});else res.writeHead(404).end('Não encontrado');}}).listen(port,host,()=>console.log(`Local: http://${host}:${port}`));
