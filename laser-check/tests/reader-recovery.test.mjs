import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createReaderRecovery, compatibleItems} from '../frontend/src/ocr/reader-recovery.mjs';

test('falha de memória na primeira leitura ativa alternativa e evita recarregar modelo pesado', async()=>{
 const read=createReaderRecovery();let primary=0,fallback=0;const notices=[];
 const run=()=>read(async()=>{primary++;throw new Error("Can't create a session. failed to allocate a buffer of size 16534782.");},async()=>{fallback++;return [{text:'NUMERO DE SERIE:R37L8TGM51LPA'}];},text=>notices.push(text));
 assert.equal((await run())[0].text,'NUMERO DE SERIE:R37L8TGM51LPA');
 await run();assert.equal(primary,1);assert.equal(fallback,2);
 assert.match(notices[0],/compatibilidade/);
});
test('erro de rede não é tratado como falta de memória',async()=>{
 const read=createReaderRecovery();let fallback=false;
 await assert.rejects(read(async()=>{throw new Error('Failed to fetch');},async()=>{fallback=true;},()=>{}),/Failed to fetch/);
 assert.equal(fallback,false);
 assert.deepEqual(await read(async()=>['normal'],async()=>[],()=>{}),['normal']);
});
test('falha dos dois motores permanece erro e permite nova tentativa compatível',async()=>{
 const read=createReaderRecovery();
 await assert.rejects(read(async()=>{throw new Error('out of memory');},async()=>{throw new Error('fallback unavailable');},()=>{}),/fallback unavailable/);
 assert.deepEqual(await read(async()=>{throw new Error('não deve recarregar');},async()=>['nova leitura'],()=>{}),['nova leitura']);
});
test('resultado compatível conserva caracteres, confiança por linha e coordenadas',()=>{
 const items=compatibleItems({blocks:[{paragraphs:[{lines:[{text:' SN:15AL11100332\n',confidence:62,bbox:{x0:10,y0:20,x1:200,y1:40}}]}]}]});
 assert.deepEqual(items,[{text:'SN:15AL11100332',score:.62,poly:[[10,20],[200,20],[200,40],[10,40]]}]);
 assert.deepEqual(compatibleItems({blocks:null}),[]);
});
