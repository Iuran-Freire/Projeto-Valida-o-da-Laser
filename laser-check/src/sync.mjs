import {saveRecord,listRecords,getPhoto,deletePhoto} from './storage.mjs';

const endpoint=new URL('api/',new URL('./',location.href));
async function request(path,options={}){
  const response=await fetch(new URL(path,endpoint),{credentials:'same-origin',cache:'no-store',...options});
  const body=await response.json();
  if(!response.ok)throw Object.assign(new Error(body.error||'Falha de comunicação'),{status:response.status});
  return body;
}
export async function syncRecords(){
  let local=await listRecords();
  for(const record of local.filter(item=>item.syncState==='pending')){
    let options={method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(record)};
    if(record.photoPresent){
      const photo=await getPhoto(record.id);
      if(!photo)throw new Error('Foto local não encontrada para o registro '+record.id);
      const form=new FormData();form.set('record',JSON.stringify(record));form.set('photo',photo,'inspecao.jpg');
      options={method:'POST',body:form};
    }
    const result=await request('records',options);
    await saveRecord(result.record);
    if(record.photoPresent)await deletePhoto(record.id);
  }
  local=await listRecords();
  let cursor=Math.max(0,...local.map(item=>item.seq||0));
  let more=true;
  while(more){
    const page=await request('records?after='+cursor);
    for(const record of page.records){await saveRecord(record);cursor=Math.max(cursor,record.seq);}
    more=page.hasMore;
  }
  return listRecords();
}
