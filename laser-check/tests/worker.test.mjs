import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import worker from '../backend/worker.mjs';

const db=new DatabaseSync(':memory:');
db.exec('CREATE TABLE inspections (seq INTEGER PRIMARY KEY AUTOINCREMENT,id TEXT UNIQUE NOT NULL,date TEXT NOT NULL,inspector TEXT NOT NULL,payload TEXT NOT NULL)');
db.exec("CREATE TABLE inspectors (id TEXT PRIMARY KEY,name TEXT NOT NULL,name_key TEXT NOT NULL UNIQUE,shift TEXT NOT NULL CHECK (shift IN ('G','H','J')),active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1)),updated_at TEXT NOT NULL)");
db.exec('CREATE TABLE management_attempts (client_key TEXT PRIMARY KEY,failures INTEGER NOT NULL,reset_at INTEGER NOT NULL)');
const photos=new Map(),legacyPhotos=new Map();
const env={MANAGEMENT_PASSWORD:'SenhaGestorTeste_2026!',DB:{prepare(sql){const bound=(values=[])=>({all:async()=>({results:db.prepare(sql).all(...values)}),first:async()=>db.prepare(sql).get(...values),run:async()=>db.prepare(sql).run(...values)});return {...bound(),bind:(...values)=>bound(values)};}},PHOTOS:{put:async(key,value)=>photos.set(key,value),get:async key=>photos.has(key)?{arrayBuffer:async()=>photos.get(key)}:null,delete:async key=>photos.delete(key)},LEGACY_PHOTOS:{get:async key=>legacyPhotos.get(key)||null}};
const origin='https://laser.example.com';
function call(path,method='GET',body){return worker.fetch(new Request(origin+path,{method,headers:method==='GET'?{}:{...(body?{'Content-Type':'application/json'}:{}),Origin:origin},body:body?JSON.stringify(body):undefined}),env);}
function callManager(path,method='POST',body,password=env.MANAGEMENT_PASSWORD){return worker.fetch(new Request(origin+path,{method,headers:{Origin:origin,'X-Manager-Key':btoa(password),...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined}),env);}
function callPhoto(record,bytes){const form=new FormData();form.set('record',JSON.stringify(record));form.set('photo',new File([bytes],'piece.jpg',{type:'image/jpeg'}));return worker.fetch(new Request(origin+'/api/records',{method:'POST',headers:{Origin:origin},body:form}),env);}

test('nome do inspetor identifica o registro compartilhado sem login',async()=>{
  assert.equal((await call('/api/records')).status,200);
  const record={id:'123e4567-e89b-42d3-a456-426614174000',date:'2026-09-25T12:00:00Z',inspector:'Ana',status:'PENDENTE',codeSerial:'AB123456789012',syncState:'pending'};
  assert.equal((await call('/api/records','POST',{...record,inspector:''})).status,400);
  const saved=await call('/api/records','POST',record);
  assert.equal((await saved.json()).record.inspector,'Ana');
  await call('/api/records','POST',record);
  const history=await (await call('/api/records?after=0')).json();
  assert.equal(history.records.length,1);
  assert.equal(history.records[0].inspector,'Ana');
  assert.equal(history.records[0].syncState,'synced');
  assert.equal((await (await call('/api/records?after=1')).json()).records.length,0);
});
test('turno é compartilhado e o servidor rejeita coincidência com letra incorreta',async()=>{
 const record={id:'123e4567-e89b-42d3-a456-426614174001',date:'2026-09-26T12:00:00Z',inspector:'Ana',shift:'H',status:'COINCIDE',qr:'GH44-03247A+R37L9QHG2P2IPA'};
 assert.equal((await call('/api/records','POST',{...record,shift:'X'})).status,400);
 assert.equal((await call('/api/records','POST',{...record,shift:'toString'})).status,400);
 assert.equal((await call('/api/records','POST',{...record,shift:'G'})).status,400);
 const saved=await call('/api/records','POST',record);
 assert.equal(saved.status,200);
 assert.equal((await saved.json()).record.shift,'H');
 const history=await (await call('/api/records?after=0')).json();
 assert.equal(history.records.find(item=>item.id===record.id).shift,'H');
});
test('foto JPEG fica vinculada ao registro e disponível no histórico compartilhado',async()=>{
 const record={id:'123e4567-e89b-42d3-a456-426614174002',date:'2026-09-26T13:00:00Z',inspector:'Bia',shift:'H',status:'PENDENTE',photoPresent:true};
 const bytes=new Uint8Array(120);bytes[0]=255;bytes[1]=216;bytes[118]=255;bytes[119]=217;
 assert.equal((await call('/api/records','POST',record)).status,400);
 const result=await callPhoto(record,bytes);assert.equal(result.status,200);assert.equal((await result.json()).record.photoPresent,true);
 const image=await call('/api/photos/'+record.id);assert.equal(image.status,200);assert.equal(image.headers.get('Content-Type'),'image/jpeg');assert.deepEqual(new Uint8Array(await image.arrayBuffer()),bytes);
 const key='inspection-photo:'+record.id;legacyPhotos.set(key,photos.get(key));photos.delete(key);
 const migrated=await call('/api/photos/'+record.id);assert.equal(migrated.status,200);assert.equal(photos.has(key),true);assert.deepEqual(new Uint8Array(await migrated.arrayBuffer()),bytes);
 assert.equal((await callPhoto(record,bytes)).status,200);
 const history=await (await call('/api/records?after=0')).json();assert.equal(history.records.find(item=>item.id===record.id).photoPresent,true);
 assert.equal((await call('/api/photos/123e4567-e89b-42d3-a456-426614174999')).status,404);
});
test('servidor mantém modelo no registro e rejeita coincidência do modelo errado',async()=>{
 const record={id:'123e4567-e89b-42d3-a456-426614174003',date:'2026-09-26T14:00:00Z',inspector:'Bia',model:'15w-ve',shift:'H',status:'COINCIDE',qr:'GH44-03086A+R37L8KH9K92IPA'};
 assert.equal((await call('/api/records','POST',{...record,model:'unknown'})).status,400);
 assert.equal((await call('/api/records','POST',{...record,model:'type-c'})).status,400);
 assert.equal((await call('/api/records','POST',{...record,shift:'G'})).status,400);
 const saved=await call('/api/records','POST',record);assert.equal(saved.status,200);assert.equal((await saved.json()).record.model,'15w-ve');
});

test('LG 24W só aceita coincidência entre QR, Code 93 e texto EAY',async()=>{
 const record={id:'123e4567-e89b-42d3-a456-426614174004',date:'2026-09-29T12:00:00Z',inspector:'Bia',model:'lg-24w',shift:'H',confirmed:true,status:'COINCIDE',qr:'IG9U2658889043905',barcode:'EAY65888904',ocr:'EAY65888904 (1.8)'};
 assert.equal((await call('/api/records','POST',{...record,barcode:'EAY65888905'})).status,400);
 assert.equal((await call('/api/records','POST',{...record,ocr:'EAY65888905 (1.8)'})).status,400);
 assert.equal((await call('/api/records','POST',{...record,barcode:'ABC65888904'})).status,400);
 assert.equal((await call('/api/records','POST',{...record,shift:''})).status,400);
 const saved=await call('/api/records','POST',record);
 assert.equal(saved.status,200);
 assert.equal((await saved.json()).record.model,'lg-24w');
});

test('gestão compartilha inspetores e turno padrão sem alterar o histórico',async()=>{
  assert.equal((await call('/api/management/unlock','POST',{password:'errada'})).status,401);
  assert.equal((await call('/api/management/unlock','POST',{password:env.MANAGEMENT_PASSWORD})).status,200);
  assert.equal((await call('/api/inspectors','POST',{name:'Ana Souza',shift:'H'})).status,401);
  assert.equal((await callManager('/api/inspectors','POST',{name:'Ana Souza',shift:'H'},'errada')).status,401);
  const created=await callManager('/api/inspectors','POST',{name:'  Ana   Souza  ',shift:'H'});
  assert.equal(created.status,201);
  const entry=(await created.json()).inspector;
  assert.equal(entry.name,'Ana Souza');
  assert.equal(entry.shift,'H');
  assert.equal((await callManager('/api/inspectors','POST',{name:'ana souza',shift:'G'})).status,409);
  const roster=await (await call('/api/inspectors')).json();
  assert.equal(roster.inspectors.length,1);
  assert.equal(roster.inspectors[0].active,true);
  const updated=await callManager('/api/inspectors','POST',{id:entry.id,name:'Ana Souza',shift:'J'});
  assert.equal((await updated.json()).inspector.shift,'J');
  const unregistered={id:'123e4567-e89b-42d3-a456-426614174099',date:'2026-09-29T12:00:00Z',inspector:'Outra pessoa',status:'PENDENTE'};
  assert.equal((await call('/api/records','POST',unregistered)).status,400);
  assert.equal((await call('/api/inspectors/'+entry.id,'DELETE')).status,401);
  assert.equal((await callManager('/api/inspectors/'+entry.id,'DELETE')).status,200);
  assert.equal((await (await call('/api/inspectors')).json()).inspectors[0].active,false);
  assert.equal((await callManager('/api/inspectors','POST',{id:entry.id,name:'Ana Souza',shift:'H',active:true})).status,200);
  assert.equal((await (await call('/api/records?after=0')).json()).records.length,5);
});

test('cinco senhas erradas bloqueiam novas tentativas por quinze minutos',async()=>{
  for(let i=0;i<5;i++)assert.equal((await call('/api/management/unlock','POST',{password:'errada'})).status,401);
  assert.equal((await call('/api/management/unlock','POST',{password:env.MANAGEMENT_PASSWORD})).status,429);
  const other=new Request(origin+'/api/management/unlock',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json','CF-Connecting-IP':'198.51.100.2'},body:JSON.stringify({password:env.MANAGEMENT_PASSWORD})});
  assert.equal((await worker.fetch(other,env)).status,200);
});

test('A08 30% e 62% exigem SEC CODE próprio, data e código impresso iguais',async()=>{
  const record={id:'123e4567-e89b-42d3-a456-426614174005',date:'2026-10-02T12:00:00Z',inspector:'Ana Souza',model:'a08-battery',shift:'H',confirmed:true,status:'COINCIDE',qr:'GH83-13417B+PW1LA01FS+77321W',ocr:'2026.10.01\nPW1LA01FS/--'};
  assert.equal((await call('/api/records','POST',{...record,qr:'GH83-13417A+PW1LA01FS+77321W'})).status,400);
  assert.equal((await call('/api/records','POST',{...record,ocr:'2026.10.02\nPW1LA01FS/--'})).status,400);
  assert.equal((await call('/api/records','POST',{...record,ocr:'2026.10.01\nPW1LA02FS/--'})).status,400);
  assert.equal((await call('/api/records','POST',{...record,confirmed:false})).status,400);
  const saved=await call('/api/records','POST',record);
  assert.equal(saved.status,200);
  assert.equal((await saved.json()).record.model,'a08-battery');
  const other={...record,id:'123e4567-e89b-42d3-a456-426614174006',model:'a08-battery-62',qr:'GH83-13419A+PW1LA01FS+77321W'};
  assert.equal((await call('/api/records','POST',{...other,qr:record.qr})).status,400);
  assert.equal((await call('/api/records','POST',other)).status,200);
});

test('servidor rejeita coincidência do PN M09031D com final 2IPA',async()=>{
  const record={id:'123e4567-e89b-42d3-a456-426614174007',date:'2026-10-02T13:00:00Z',inspector:'Ana Souza',model:'type-c-m09031d',shift:'H',confirmed:true,status:'COINCIDE',qr:'GH44-03247A+R37L9QHG2Z1IPA',ocr:'NUMERO DE SERIE:R37L9QHG2Z1IPA'};
  assert.equal((await call('/api/records','POST',{...record,qr:'GH44-03247A+R37L9QHG2Z2IPA',ocr:'NUMERO DE SERIE:R37L9QHG2Z2IPA'})).status,400);
  assert.equal((await call('/api/records','POST',{...record,ocr:'NUMERO DE SERIE:R37L9QHG2Z2IPA'})).status,400);
  assert.equal((await call('/api/records','POST',record)).status,200);
});

test('Frecom exige duas fotos e conserva laser e etiqueta separadamente',async()=>{
 const record={id:'123e4567-e89b-42d3-a456-426614174008',date:'2026-10-02T15:00:00Z',inspector:'Ana Souza',model:'frecom-24w',shift:'H',confirmed:true,visualDecision:'clear',status:'COINCIDE',qr:'I263803579',ocr:'I263803579',photoPresent:true,barcodePhotoPresent:true};
 const laser=new Uint8Array(120),label=new Uint8Array(140);for(const image of [laser,label]){image[0]=255;image[1]=216;image[image.length-2]=255;image[image.length-1]=217;}
 const upload=async(item,includeLabel=true)=>{const form=new FormData();form.set('record',JSON.stringify(item));form.set('photo',new File([laser],'laser.jpg',{type:'image/jpeg'}));if(includeLabel)form.set('barcodePhoto',new File([label],'etiqueta.jpg',{type:'image/jpeg'}));return worker.fetch(new Request(origin+'/api/records',{method:'POST',headers:{Origin:origin},body:form}),env);};
 assert.equal((await upload(record,false)).status,400);
 assert.equal((await upload({...record,ocr:'I263803580'})).status,400);
 assert.equal((await upload({...record,visualDecision:''})).status,400);
 assert.equal((await upload(record)).status,200);
 assert.deepEqual(new Uint8Array(await (await call('/api/photos/'+record.id)).arrayBuffer()),laser);
 assert.deepEqual(new Uint8Array(await (await call('/api/photos/'+record.id+'/barcode')).arrayBuffer()),label);
});


test('LG 32W exige duas fotos, confirmação e Part No. próprio',async()=>{
 const record={id:'123e4567-e89b-42d3-a456-426614174009',date:'2026-10-02T16:00:00Z',inspector:'Ana Souza',model:'lg-32w',shift:'H',confirmed:true,visualDecision:'clear',status:'COINCIDE',qr:'IA312658899100001',barcode:'EAY65889910',ocr:'EAY65889910 (0.1)',photoPresent:true,barcodePhotoPresent:true};
 const photo=new Uint8Array(120),label=new Uint8Array(140);for(const image of [photo,label]){image[0]=255;image[1]=216;image[image.length-2]=255;image[image.length-1]=217;}
 const upload=async(item,includeLabel=true)=>{const form=new FormData();form.set('record',JSON.stringify(item));form.set('photo',new File([photo],'corpo.jpg',{type:'image/jpeg'}));if(includeLabel)form.set('barcodePhoto',new File([label],'lateral.jpg',{type:'image/jpeg'}));return worker.fetch(new Request(origin+'/api/records',{method:'POST',headers:{Origin:origin},body:form}),env);};
 assert.equal((await upload(record,false)).status,400);
 assert.equal((await upload({...record,visualDecision:''})).status,400);
 assert.equal((await upload({...record,barcode:'EAY65888904'})).status,400);
 assert.equal((await upload(record)).status,200);
 assert.deepEqual(new Uint8Array(await (await call('/api/photos/'+record.id)).arrayBuffer()),photo);
 assert.deepEqual(new Uint8Array(await (await call('/api/photos/'+record.id+'/barcode')).arrayBuffer()),label);
});

test('LG PSU 28W exige uma foto, avaliação visual e código impresso completo',async()=>{
 const record={id:'123e4567-e89b-42d3-a456-426614174010',date:'2026-10-02T17:00:00Z',inspector:'Ana Souza',model:'lg-psu-28w',shift:'H',confirmed:true,visualDecision:'clear',status:'COINCIDE',qr:'IBN13658992060001',ocr:'IBN13658992060001 (1.1)',photoPresent:true,barcodePhotoPresent:false};
 const image=new Uint8Array(120);image[0]=255;image[1]=216;image[118]=255;image[119]=217;
 const upload=async(item,withPhoto=true)=>{const form=new FormData();form.set('record',JSON.stringify(item));if(withPhoto)form.set('photo',new File([image],'etiqueta.jpg',{type:'image/jpeg'}));return worker.fetch(new Request(origin+'/api/records',{method:'POST',headers:{Origin:origin},body:form}),env);};
 assert.equal((await upload(record,false)).status,400);
 assert.equal((await upload({...record,confirmed:false})).status,400);
 assert.equal((await upload({...record,visualDecision:''})).status,400);
 assert.equal((await upload({...record,qr:'IBN13658889040001',ocr:'IBN13658889040001 (1.1)'})).status,400);
 assert.equal((await upload({...record,ocr:'IBN13658992060002 (1.1)'})).status,400);
 assert.equal((await upload(record)).status,200);
 assert.deepEqual(new Uint8Array(await (await call('/api/photos/'+record.id)).arrayBuffer()),image);
});

test('Frecom 33K0009 exige uma foto, confirmação e série do Data Matrix igual à impressa',async()=>{
 const record={id:'123e4567-e89b-42d3-a456-426614174011',date:'2026-10-02T18:00:00Z',inspector:'Ana Souza',model:'frecom-dm-24w',shift:'H',confirmed:true,visualDecision:'clear',status:'COINCIDE',qr:'FC024A09+B9PB0391IP',ocr:'B9PB0391IP',photoPresent:true,barcodePhotoPresent:false};
 const image=new Uint8Array(120);image[0]=255;image[1]=216;image[118]=255;image[119]=217;
 const upload=async(item,withPhoto=true)=>{const form=new FormData();form.set('record',JSON.stringify(item));if(withPhoto)form.set('photo',new File([image],'etiqueta.jpg',{type:'image/jpeg'}));return worker.fetch(new Request(origin+'/api/records',{method:'POST',headers:{Origin:origin},body:form}),env);};
 assert.equal((await upload(record,false)).status,400);
 assert.equal((await upload({...record,confirmed:false})).status,400);
 assert.equal((await upload({...record,visualDecision:''})).status,400);
 assert.equal((await upload({...record,qr:'FC024A08+B9PB0391IP'})).status,400);
 assert.equal((await upload({...record,ocr:'B9PB0401IP'})).status,400);
 assert.equal((await upload(record)).status,200);
 assert.deepEqual(new Uint8Array(await (await call('/api/photos/'+record.id)).arrayBuffer()),image);
});
