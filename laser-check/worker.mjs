const response=(status,data)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}});
async function readJSON(request){const body=await request.text();if(body.length>262144)throw new Error('Corpo muito grande');return JSON.parse(body);}
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
    if(path==='/api/records'&&request.method==='POST'){
      const record=await readJSON(request),inspector=String(record?.inspector||'').trim().replace(/\s+/g,' ');
      if(!inspector||inspector.length>80||!/^[0-9a-f-]{36}$/i.test(record.id||'')||!Number.isFinite(Date.parse(record.date))||!['COINCIDE','DIVERGENTE','PENDENTE'].includes(record.status))return response(400,{error:'Registro ou nome do inspetor inválido.'});
      const stored={...record,inspector};delete stored.seq;delete stored.syncState;
      await env.DB.prepare('INSERT OR IGNORE INTO inspections (id,date,inspector,payload) VALUES (?,?,?,?)').bind(stored.id,stored.date,stored.inspector,JSON.stringify(stored)).run();
      const row=await env.DB.prepare('SELECT seq,payload FROM inspections WHERE id=?').bind(stored.id).first();
      return response(200,{record:{...JSON.parse(row.payload),seq:row.seq,syncState:'synced'}});
    }
    return response(404,{error:'Rota não encontrada'});
  }catch(error){return response(400,{error:error.message||'Falha no servidor'});}
}};
