import {isValidRecordShift} from './src/serial-profile.mjs';
const response=(status,data)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}});
async function readJSON(request){const body=await request.text();if(body.length>262144)throw new Error('Corpo muito grande');return JSON.parse(body);}
const photoKey=id=>'inspection-photo:'+id;
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
    if(request.method==='POST'&&request.headers.get('Origin')!==url.origin)return response(403,{error:'Origem inválida'});
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
