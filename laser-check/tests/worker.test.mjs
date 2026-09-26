import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import worker from '../worker.mjs';

const db=new DatabaseSync(':memory:');
db.exec('CREATE TABLE inspections (seq INTEGER PRIMARY KEY AUTOINCREMENT,id TEXT UNIQUE NOT NULL,date TEXT NOT NULL,inspector TEXT NOT NULL,payload TEXT NOT NULL)');
const photos=new Map();
const env={DB:{prepare(sql){return {bind(...values){return {all:async()=>({results:db.prepare(sql).all(...values)}),first:async()=>db.prepare(sql).get(...values),run:async()=>db.prepare(sql).run(...values)};}};}},PHOTOS:{put:async(key,value)=>photos.set(key,value),get:async key=>photos.get(key)||null,delete:async key=>photos.delete(key)}};
const origin='https://laser.example.com';
function call(path,method='GET',body){return worker.fetch(new Request(origin+path,{method,headers:body?{'Content-Type':'application/json','Origin':origin}:{},body:body?JSON.stringify(body):undefined}),env);}
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
 assert.equal((await callPhoto(record,bytes)).status,200);
 const history=await (await call('/api/records?after=0')).json();assert.equal(history.records.find(item=>item.id===record.id).photoPresent,true);
 assert.equal((await call('/api/photos/123e4567-e89b-42d3-a456-426614174999')).status,404);
});
