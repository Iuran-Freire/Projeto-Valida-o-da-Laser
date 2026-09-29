import {isValidRecordShift} from './src/serial-profile.mjs';
import {normalizeInspectorName,inspectorNameKey,validInspectorEntry} from './src/inspector-roster.mjs';
import {validManagementPassword,decodeManagementHeader,managementAttemptKey} from './src/management-auth.mjs';
const response=(status,data)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}});
async function readJSON(request){const body=await request.text();if(body.length>262144)throw new Error('Corpo muito grande');return JSON.parse(body);}
const photoKey=id=>'inspection-photo:'+id;
async function managerDenial(request,env,candidate){
  if(!env.MANAGEMENT_PASSWORD)return response(503,{error:'Senha de gestão não configurada.'});
  const key=await managementAttemptKey(request.headers.get('CF-Connecting-IP')||'unknown',env.MANAGEMENT_PASSWORD),now=Math.floor(Date.now()/1000);
  const attempts=await env.DB.prepare('SELECT failures,reset_at FROM management_attempts WHERE client_key=?').bind(key).first();
  if(attempts?.failures>=5&&attempts.reset_at>now)return response(429,{error:'Muitas tentativas. Tente novamente em 15 minutos.'});
  if(await validManagementPassword(candidate,env.MANAGEMENT_PASSWORD)){
    if(attempts)await env.DB.prepare('DELETE FROM management_attempts WHERE client_key=?').bind(key).run();
    return null;
  }
  const failures=attempts?.reset_at>now?attempts.failures+1:1,resetAt=attempts?.reset_at>now?attempts.reset_at:now+900;
  await env.DB.prepare('INSERT INTO management_attempts (client_key,failures,reset_at) VALUES (?,?,?) ON CONFLICT(client_key) DO UPDATE SET failures=?,reset_at=?').bind(key,failures,resetAt,failures,resetAt).run();
  return response(401,{error:'Senha incorreta.'});
}
async function readUpload(request){
  const multipart=request.headers.get('Content-Type')?.toLowerCase().startsWith('multipart/form-data');
  if(!multipart)return {record:await readJSON(request),photo:null};
  const form=await request.formData(),raw=form.get('record'),photo=form.get('photo');
  if(typeof raw!=='string'||raw.length>262144)throw new Error('Registro inválido.');
  if(!(photo instanceof File)||photo.type!=='image/jpeg'||photo.size<100||photo.size>2000000)throw new Error('Foto JPEG inválida ou maior que 2 MB.');
  const bytes=await photo.arrayBuffer(),head=new Uint8Array(bytes);
  if(head[0]!==0xff||head[1]!==0xd8||head[head.length-2]!==0xff||head[head.length-1]!==0xd9)throw new Error('Arquivo de foto inválido.');
  return {record:JSON.parse(raw),photo:bytes};
}
export default {async fetch(request,env){
  const url=new URL(request.url),path=url.pathname;
  if(!path.startsWith('/api/'))return env.ASSETS.fetch(request);
  try{
    if(!env.DB)return response(503,{error:'Banco de dados não configurado.'});
    if(['POST','DELETE'].includes(request.method)&&request.headers.get('Origin')!==url.origin)return response(403,{error:'Origem inválida'});
    if(path==='/api/management/unlock'&&request.method==='POST'){
      const body=await readJSON(request);
      const denial=await managerDenial(request,env,body?.password);
      return denial||response(200,{ok:true});
    }
    if(path==='/api/inspectors'&&request.method==='GET'){
      const {results}=await env.DB.prepare('SELECT id,name,shift,active,updated_at FROM inspectors ORDER BY active DESC,name_key').all();
      return response(200,{inspectors:results.map(row=>({...row,active:Boolean(row.active)}))});
    }
    if(path==='/api/inspectors'&&request.method==='POST'){
      const denial=await managerDenial(request,env,decodeManagementHeader(request.headers.get('X-Manager-Key')));
      if(denial)return denial;
      const entry=await readJSON(request),name=normalizeInspectorName(entry?.name),shift=String(entry?.shift||'');
      if(!validInspectorEntry(name,shift))return response(400,{error:'Informe nome e turno válidos.'});
      const id=entry.id?String(entry.id):crypto.randomUUID();
      if(!/^[0-9a-f-]{36}$/i.test(id))return response(400,{error:'Identificador inválido.'});
      const existing=entry.id?await env.DB.prepare('SELECT id FROM inspectors WHERE id=?').bind(id).first():null;
      if(entry.id&&!existing)return response(404,{error:'Inspetor não encontrado.'});
      const key=inspectorNameKey(name),duplicate=await env.DB.prepare('SELECT id FROM inspectors WHERE name_key=?').bind(key).first();
      if(duplicate&&duplicate.id!==id)return response(409,{error:'Este inspetor já está cadastrado.'});
      const active=existing?entry.active===false?0:1:1,updatedAt=new Date().toISOString();
      if(existing)await env.DB.prepare('UPDATE inspectors SET name=?,name_key=?,shift=?,active=?,updated_at=? WHERE id=?').bind(name,key,shift,active,updatedAt,id).run();
      else await env.DB.prepare('INSERT INTO inspectors (id,name,name_key,shift,active,updated_at) VALUES (?,?,?,?,?,?)').bind(id,name,key,shift,active,updatedAt).run();
      return response(existing?200:201,{inspector:{id,name,shift,active:Boolean(active),updated_at:updatedAt}});
    }
    if(path.startsWith('/api/inspectors/')&&request.method==='DELETE'){
      const denial=await managerDenial(request,env,decodeManagementHeader(request.headers.get('X-Manager-Key')));
      if(denial)return denial;
      const id=path.slice('/api/inspectors/'.length);
      if(!/^[0-9a-f-]{36}$/i.test(id))return response(400,{error:'Identificador inválido.'});
      const row=await env.DB.prepare('SELECT id FROM inspectors WHERE id=?').bind(id).first();
      if(!row)return response(404,{error:'Inspetor não encontrado.'});
      await env.DB.prepare('UPDATE inspectors SET active=0,updated_at=? WHERE id=?').bind(new Date().toISOString(),id).run();
      return response(200,{ok:true});
    }
    if(path==='/api/records'&&request.method==='GET'){
      const after=Number(url.searchParams.get('after')||0);if(!Number.isSafeInteger(after)||after<0)return response(400,{error:'Cursor inválido'});
      const {results}=await env.DB.prepare('SELECT seq,payload FROM inspections WHERE seq>? ORDER BY seq LIMIT 201').bind(after).all();
      return response(200,{records:results.slice(0,200).map(row=>({...JSON.parse(row.payload),seq:row.seq,syncState:'synced'})),hasMore:results.length>200});
    }
    if(path.startsWith('/api/photos/')&&request.method==='GET'){
      const id=path.slice('/api/photos/'.length);
      if(!/^[0-9a-f-]{36}$/i.test(id))return response(404,{error:'Foto não encontrada.'});
      const row=await env.DB.prepare('SELECT seq,payload FROM inspections WHERE id=?').bind(id).first();
      if(!row||!JSON.parse(row.payload).photoPresent)return response(404,{error:'Foto não encontrada.'});
      if(!env.PHOTOS)return response(503,{error:'Armazenamento de fotos indisponível.'});
      let image=await env.PHOTOS.get(photoKey(id));
      if(!image&&env.LEGACY_PHOTOS){
        const legacy=await env.LEGACY_PHOTOS.get(photoKey(id),'arrayBuffer');
        if(legacy){await env.PHOTOS.put(photoKey(id),legacy);image=await env.PHOTOS.get(photoKey(id));}
      }
      if(!image)return response(404,{error:'Foto ainda não disponível. Tente novamente.'});
      return new Response(await image.arrayBuffer(),{headers:{'Content-Type':'image/jpeg','Cache-Control':'private, max-age=3600','X-Content-Type-Options':'nosniff'}});
    }
    if(path==='/api/records'&&request.method==='POST'){
      const {record,photo}=await readUpload(request),inspector=String(record?.inspector||'').trim().replace(/\s+/g,' ');
      if(!inspector||inspector.length>80||!/^[0-9a-f-]{36}$/i.test(record.id||'')||!Number.isFinite(Date.parse(record.date))||!['COINCIDE','DIVERGENTE','PENDENTE'].includes(record.status))return response(400,{error:'Registro ou nome do inspetor inválido.'});
      const roster=await env.DB.prepare('SELECT COUNT(*) AS total FROM inspectors').first();
      if(roster.total&&!await env.DB.prepare('SELECT id FROM inspectors WHERE name_key=?').bind(inspectorNameKey(inspector)).first())return response(400,{error:'Inspetor não cadastrado.'});
      if(!isValidRecordShift(record))return response(400,{error:'Turno inválido ou incompatível com o código 2D.'});
      if(Boolean(photo)!==Boolean(record.photoPresent))return response(400,{error:'Cada novo registro deve incluir sua foto.'});
      if(photo&&!env.PHOTOS)return response(503,{error:'Armazenamento de fotos indisponível.'});
      const old=await env.DB.prepare('SELECT seq,payload FROM inspections WHERE id=?').bind(record.id).first();
      if(old)return response(200,{record:{...JSON.parse(old.payload),seq:old.seq,syncState:'synced'}});
      const stored={...record,inspector,photoPresent:Boolean(photo)};delete stored.seq;delete stored.syncState;
      if(photo)await env.PHOTOS.put(photoKey(stored.id),photo);
      try{await env.DB.prepare('INSERT OR IGNORE INTO inspections (id,date,inspector,payload) VALUES (?,?,?,?)').bind(stored.id,stored.date,stored.inspector,JSON.stringify(stored)).run();}
      catch(error){if(photo)await env.PHOTOS.delete(photoKey(stored.id));throw error;}
      const row=await env.DB.prepare('SELECT seq,payload FROM inspections WHERE id=?').bind(stored.id).first();
      return response(200,{record:{...JSON.parse(row.payload),seq:row.seq,syncState:'synced'}});
    }
    return response(404,{error:'Rota não encontrada'});
  }catch(error){return response(400,{error:error.message||'Falha no servidor'});}
}};
