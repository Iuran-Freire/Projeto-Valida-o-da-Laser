import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import worker from '../worker.mjs';

const db=new DatabaseSync(':memory:');
db.exec('CREATE TABLE inspections (seq INTEGER PRIMARY KEY AUTOINCREMENT,id TEXT UNIQUE NOT NULL,date TEXT NOT NULL,inspector TEXT NOT NULL,payload TEXT NOT NULL)');
const env={DB:{prepare(sql){return {bind(...values){return {all:async()=>({results:db.prepare(sql).all(...values)}),first:async()=>db.prepare(sql).get(...values),run:async()=>db.prepare(sql).run(...values)};}};}}};
const origin='https://laser.example.com';
function call(path,method='GET',body){return worker.fetch(new Request(origin+path,{method,headers:body?{'Content-Type':'application/json','Origin':origin}:{},body:body?JSON.stringify(body):undefined}),env);}

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
