import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createReaderRecovery, compatibleItems,readerFailureKind} from '../frontend/src/ocr/reader-recovery.mjs';

test('falha de memória na primeira leitura ativa alternativa e evita recarregar modelo pesado', async()=>{
 const read=createReaderRecovery();let primary=0,fallback=0;const notices=[];
 const run=()=>read(async()=>{primary++;throw new Error("Can't create a session. failed to allocate a buffer of size 16534782.");},async()=>{fallback++;return [{text:'NUMERO DE SERIE:R37L8TGM51LPA'}];},text=>notices.push(text));
 assert.equal((await run())[0].text,'NUMERO DE SERIE:R37L8TGM51LPA');
 await run();assert.equal(primary,1);assert.equal(fallback,2);
 assert.match(notices[0],/alternativo.*memória/);
});
test('erro transitório de rede repete o principal sem acionar alternativa',async()=>{
 const read=createReaderRecovery();let primary=0,fallback=0;const original=[{text:'SN de outro modelo'}];
 const result=await read(async()=>{if(++primary===1)throw new Error('Failed to fetch');return original;},async()=>{fallback++;return [];},()=>{});
 assert.equal(result,original);assert.equal(primary,2);assert.equal(fallback,0);
});

test('principal que funciona é preservado inclusive quando a leitura diverge do código',async()=>{
 const read=createReaderRecovery(),original=[{text:'SN com divergência real',confidence:97}];
 let alternative=false;
 assert.equal(await read(async()=>original,async()=>{alternative=true;return [];},()=>{},{isReadable:()=>true}),original);
 assert.equal(alternative,false);
});
test('rede persistente aciona alternativa apenas para aquela leitura',async()=>{
 const read=createReaderRecovery();let calls=0;
 const primary=async()=>{if(++calls<=2)throw new Error('Failed to fetch');return [{text:'principal voltou'}];};
 const first=await read(primary,async context=>{assert.equal(context.reason,'network');return [{text:'alternativo'}];},()=>{});
 assert.equal(first[0].recoveryReason,'network');
 assert.equal((await read(primary,async()=>{throw Error('não deve alternar');},()=>{}))[0].text,'principal voltou');
 assert.equal(calls,3);
});
test('ausência de texto permite outra análise sem desativar principal',async()=>{
 const read=createReaderRecovery(),partial={text:'rótulo sem série'},opts={isReadable:items=>items.some(item=>item.text==='série lida')};
 const first=await read(async()=>[partial],async context=>{assert.equal(context.reason,'unread');return [{text:'série lida'}];},()=>{},opts);
 assert.equal(first[0],partial);assert.equal(first[1].recoveryReason,'unread');
 let primary=false;await read(async()=>{primary=true;return [{text:'série lida'}];},async()=>[],()=>{},opts);assert.equal(primary,true);
});
test('libera o principal antes de iniciar a alternativa',async()=>{
 const sequence=[],read=createReaderRecovery();
 await read(async()=>{sequence.push('principal');throw Error('out of memory');},async()=>{sequence.push('alternativo');return [];},()=>{},{beforeFallback:async()=>sequence.push('liberado')});
 assert.deepEqual(sequence,['principal','liberado','alternativo']);
});
test('baixa confiança recupera a mesma foto e preserva principal para a próxima leitura',async()=>{
 const read=createReaderRecovery(),weak=[{text:'NUMERO DE SERIE:R37L8TGFMSTIPA',confidence:34}];let calls=0;
 const opts={isReadable:()=>true,isConfident:items=>items.every(item=>item.confidence>=80)};
 const primary=async()=>{calls++;return calls===1?weak:[{text:'outra série',confidence:98}];};
 const recovered=await read(primary,async context=>{
  assert.equal(context.reason,'uncertain');assert.equal(context.attempts,weak);
  return [{text:'NUMERO DE SERIE:R37L8TGFM51IPA',confidence:99}];
 },()=>{},opts);
 assert.equal(recovered[0],weak[0]);assert.equal(recovered[1].recoveryReason,'uncertain');
 const next=await read(primary,async()=>{throw Error('principal forte deve permanecer');},()=>{},opts);
 assert.equal(next[0].text,'outra série');assert.equal(calls,2);
});
test('falha de processamento e tempo limite não bloqueiam futuras tentativas principais',async()=>{
 for(const message of ['memory access out of bounds','Recognition model timed out']){
  const read=createReaderRecovery();await read(async()=>{throw Error(message);},async()=>[{text:'outro motor'}],()=>{});
  assert.deepEqual(await read(async()=>[{text:'principal'}],async()=>[],()=>{}),[{text:'principal'}]);
 }
});
test('erro de programação não é mascarado por outro leitor',async()=>{
 const read=createReaderRecovery();let alternative=false;
 await assert.rejects(read(async()=>{throw TypeError('cannot read properties of undefined');},async()=>{alternative=true;return [];},()=>{}),/undefined/);
 assert.equal(alternative,false);
 assert.equal(readerFailureKind(Error('SIMD is not supported')),'unsupported');
});
test('falha dos dois motores permanece erro e permite nova tentativa compatível',async()=>{
 const read=createReaderRecovery();
 await assert.rejects(read(async()=>{throw new Error('out of memory');},async()=>{throw new Error('fallback unavailable');},()=>{}),/fallback unavailable/);
 const next=await read(async()=>{throw new Error('não deve recarregar');},async()=>[{text:'nova leitura'}],()=>{});
 assert.equal(next[0].text,'nova leitura');assert.equal(next[0].recoveryReason,'memory');
});
test('resultado compatível conserva caracteres, confiança por linha e coordenadas',()=>{
 const items=compatibleItems({blocks:[{paragraphs:[{lines:[{text:' SN:15AL11100332\n',confidence:62,bbox:{x0:10,y0:20,x1:200,y1:40}}]}]}]});
 assert.deepEqual(items,[{text:'SN:15AL11100332',score:.62,poly:[[10,20],[200,20],[200,40],[10,40]]}]);
 assert.deepEqual(compatibleItems({blocks:null}),[]);
});
