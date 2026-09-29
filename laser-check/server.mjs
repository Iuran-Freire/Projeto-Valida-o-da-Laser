import http from 'node:http';
import {readFile,mkdir,writeFile,unlink} from 'node:fs/promises';
import {Readable} from 'node:stream';
import {resolve,extname,sep} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {randomUUID} from 'node:crypto';
import {isValidRecordShift} from './src/serial-profile.mjs';
import {normalizeInspectorName,inspectorNameKey,validInspectorEntry} from './src/inspector-roster.mjs';
import {validManagementPassword,decodeManagementHeader,managementAttemptKey} from './src/management-auth.mjs';

const root=resolve('dist'),dataDir=resolve(process.env.LASER_DATA_DIR||'data');
await mkdir(dataDir,{recursive:true});
const photoDir=resolve(dataDir,'photos');await mkdir(photoDir,{recursive:true});
const db=new DatabaseSync(resolve(dataDir,'inspections.sqlite'));
db.exec('PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS inspections (seq INTEGER PRIMARY KEY AUTOINCREMENT,id TEXT UNIQUE NOT NULL,date TEXT NOT NULL,inspector TEXT NOT NULL,payload TEXT NOT NULL)');
db.exec("CREATE TABLE IF NOT EXISTS inspectors (id TEXT PRIMARY KEY,name TEXT NOT NULL,name_key TEXT NOT NULL UNIQUE,shift TEXT NOT NULL CHECK (shift IN ('G','H','J')),active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1)),updated_at TEXT NOT NULL)");
db.exec('CREATE TABLE IF NOT EXISTS management_attempts (client_key TEXT PRIMARY KEY,failures INTEGER NOT NULL,reset_at INTEGER NOT NULL)');
const insert=db.prepare('INSERT INTO inspections (id,date,inspector,payload) VALUES (?,?,?,?)');
const existing=db.prepare('SELECT seq,payload FROM inspections WHERE id=?');
const list=db.prepare('SELECT seq,payload FROM inspections WHERE seq>? ORDER BY seq LIMIT 201');
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.wasm':'application/wasm','.webmanifest':'application/manifest+json','.gz':'application/gzip'};
function json(res,status,data){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));}
function readJSON(req){return new Promise((resolve,reject)=>{let body='';req.on('data',chunk=>{body+=chunk;if(body.length>262144){reject(new Error('Corpo muito grande'));req.destroy();}});req.on('end',()=>{try{resolve(JSON.parse(body));}catch{reject(new Error('JSON inválido'));}});req.on('error',reject);});}
async function readUpload(req){
 if(!req.headers['content-type']?.toLowerCase().startsWith('multipart/form-data'))return {record:await readJSON(req),photo:null};
 if(Number(req.headers['content-length'])>2300000)throw new Error('Foto maior que 2 MB.');
 const web=new Request('http://localhost/api/records',{method:'POST',headers:{'Content-Type':req.headers['content-type']},body:Readable.toWeb(req),duplex:'half'});
 const form=await web.formData(),raw=form.get('record'),photo=form.get('photo');
 if(typeof raw!=='string'||raw.length>262144||!(photo instanceof File)||photo.type!=='image/jpeg'||photo.size<100||photo.size>2000000)throw new Error('Registro ou foto inválida.');
 const bytes=Buffer.from(await photo.arrayBuffer());if(bytes[0]!==0xff||bytes[1]!==0xd8||bytes.at(-2)!==0xff||bytes.at(-1)!==0xd9)throw new Error('Arquivo de foto inválido.');
 return {record:JSON.parse(raw),photo:bytes};
}
function sameOrigin(req){try{const origin=new URL(req.headers.origin);return origin.host===req.headers.host&&['http:','https:'].includes(origin.protocol);}catch{return false;}}
async function managerDenial(req,candidate){
  const secret=process.env.MANAGEMENT_PASSWORD;
  if(!secret)return {status:503,error:'Senha de gestão não configurada.'};
  const key=await managementAttemptKey(req.socket.remoteAddress||'local',secret),now=Math.floor(Date.now()/1000);
  const attempts=db.prepare('SELECT failures,reset_at FROM management_attempts WHERE client_key=?').get(key);
  if(attempts?.failures>=5&&attempts.reset_at>now)return {status:429,error:'Muitas tentativas. Tente novamente em 15 minutos.'};
  if(await validManagementPassword(candidate,secret)){
    if(attempts)db.prepare('DELETE FROM management_attempts WHERE client_key=?').run(key);
    return null;
  }
  const failures=attempts?.reset_at>now?attempts.failures+1:1,resetAt=attempts?.reset_at>now?attempts.reset_at:now+900;
  db.prepare('INSERT INTO management_attempts (client_key,failures,reset_at) VALUES (?,?,?) ON CONFLICT(client_key) DO UPDATE SET failures=?,reset_at=?').run(key,failures,resetAt,failures,resetAt);
  return {status:401,error:'Senha incorreta.'};
}
async function api(req,res,path,url){
  if(['POST','DELETE'].includes(req.method)&&!sameOrigin(req))return json(res,403,{error:'Origem inválida'});
  if(path==='/api/management/unlock'&&req.method==='POST'){
    const body=await readJSON(req);
    const denial=await managerDenial(req,body?.password);
    return json(res,denial?.status||200,denial?{error:denial.error}:{ok:true});
  }
  if(path==='/api/inspectors'&&req.method==='GET'){
    return json(res,200,{inspectors:db.prepare('SELECT id,name,shift,active,updated_at FROM inspectors ORDER BY active DESC,name_key').all().map(row=>({...row,active:Boolean(row.active)}))});
  }
  if(path==='/api/inspectors'&&req.method==='POST'){
    const denial=await managerDenial(req,decodeManagementHeader(req.headers['x-manager-key']));
    if(denial)return json(res,denial.status,{error:denial.error});
    const entry=await readJSON(req),name=normalizeInspectorName(entry?.name),shift=String(entry?.shift||'');
    if(!validInspectorEntry(name,shift))return json(res,400,{error:'Informe nome e turno válidos.'});
    const id=entry.id?String(entry.id):randomUUID();
    if(!/^[0-9a-f-]{36}$/i.test(id))return json(res,400,{error:'Identificador inválido.'});
    const existing=entry.id?db.prepare('SELECT id FROM inspectors WHERE id=?').get(id):null;
    if(entry.id&&!existing)return json(res,404,{error:'Inspetor não encontrado.'});
    const key=inspectorNameKey(name),duplicate=db.prepare('SELECT id FROM inspectors WHERE name_key=?').get(key);
    if(duplicate&&duplicate.id!==id)return json(res,409,{error:'Este inspetor já está cadastrado.'});
    const active=existing?entry.active===false?0:1:1,updatedAt=new Date().toISOString();
    if(existing)db.prepare('UPDATE inspectors SET name=?,name_key=?,shift=?,active=?,updated_at=? WHERE id=?').run(name,key,shift,active,updatedAt,id);
    else db.prepare('INSERT INTO inspectors (id,name,name_key,shift,active,updated_at) VALUES (?,?,?,?,?,?)').run(id,name,key,shift,active,updatedAt);
    return json(res,existing?200:201,{inspector:{id,name,shift,active:Boolean(active),updated_at:updatedAt}});
  }
  if(path.startsWith('/api/inspectors/')&&req.method==='DELETE'){
    const denial=await managerDenial(req,decodeManagementHeader(req.headers['x-manager-key']));
    if(denial)return json(res,denial.status,{error:denial.error});
    const id=path.slice('/api/inspectors/'.length);
    if(!/^[0-9a-f-]{36}$/i.test(id))return json(res,400,{error:'Identificador inválido.'});
    if(!db.prepare('SELECT id FROM inspectors WHERE id=?').get(id))return json(res,404,{error:'Inspetor não encontrado.'});
    db.prepare('UPDATE inspectors SET active=0,updated_at=? WHERE id=?').run(new Date().toISOString(),id);
    return json(res,200,{ok:true});
  }
  if(path==='/api/records'&&req.method==='GET'){
    const after=Number(url.searchParams.get('after')||0);if(!Number.isSafeInteger(after)||after<0)return json(res,400,{error:'Cursor inválido'});
    const rows=list.all(after),page=rows.slice(0,200);
    return json(res,200,{records:page.map(row=>({...JSON.parse(row.payload),seq:row.seq,syncState:'synced'})),hasMore:rows.length>200});
  }
  if(path.startsWith('/api/photos/')&&req.method==='GET'){
    const id=path.slice('/api/photos/'.length);if(!/^[0-9a-f-]{36}$/i.test(id))return json(res,404,{error:'Foto não encontrada.'});
    const row=existing.get(id);if(!row||!JSON.parse(row.payload).photoPresent)return json(res,404,{error:'Foto não encontrada.'});
    try{const bytes=await readFile(resolve(photoDir,id+'.jpg'));res.writeHead(200,{'Content-Type':'image/jpeg','Cache-Control':'private, max-age=3600','X-Content-Type-Options':'nosniff'});res.end(bytes);}catch{return json(res,404,{error:'Foto não encontrada.'});}return;
  }
  if(path==='/api/records'&&req.method==='POST'){
    const {record,photo}=await readUpload(req),inspector=String(record?.inspector||'').trim().replace(/\s+/g,' ');
    if(!inspector||inspector.length>80||!/^[0-9a-f-]{36}$/i.test(record.id||'')||!Number.isFinite(Date.parse(record.date))||!['COINCIDE','DIVERGENTE','PENDENTE'].includes(record.status))return json(res,400,{error:'Registro ou nome do inspetor inválido.'});
    if(db.prepare('SELECT COUNT(*) AS total FROM inspectors').get().total&&!db.prepare('SELECT id FROM inspectors WHERE name_key=?').get(inspectorNameKey(inspector)))return json(res,400,{error:'Inspetor não cadastrado.'});
    if(!isValidRecordShift(record))return json(res,400,{error:'Turno inválido ou incompatível com o código 2D.'});
    if(Boolean(photo)!==Boolean(record.photoPresent))return json(res,400,{error:'Cada novo registro deve incluir sua foto.'});
    const found=existing.get(record.id);if(found)return json(res,200,{record:{...JSON.parse(found.payload),seq:found.seq,syncState:'synced'}});
    const stored={...record,inspector,photoPresent:Boolean(photo)};delete stored.seq;delete stored.syncState;
    if(photo)await writeFile(resolve(photoDir,stored.id+'.jpg'),photo);
    try{insert.run(stored.id,stored.date,stored.inspector,JSON.stringify(stored));}catch(error){if(photo)await unlink(resolve(photoDir,stored.id+'.jpg')).catch(()=>{});throw error;}
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
