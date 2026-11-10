import {test} from 'node:test';
import assert from 'node:assert/strict';
import {isolatedBarcodeReader} from '../frontend/src/capture/barcode-reader.mjs';

const photo=()=>({width:2,height:1,data:Uint8ClampedArray.from([1,2,3,255,4,5,6,255])});
function mockWorker(reply){return {posts:[],terminated:0,postMessage(data,transfer){this.posts.push({data,transfer});queueMicrotask(()=>reply(this,data));},terminate(){this.terminated++;}};}

test('lê o código num worker separado e o encerra para liberar memória',async()=>{
 const codes=[{text:'GH44-03086A+R37LB9G58L2IPA',format:'DataMatrix',position:{topLeft:{x:1,y:2}}}];
 const worker=mockWorker(w=>w.onmessage({data:{ok:true,codes}}));
 const options={formats:['QRCode','DataMatrix'],tryHarder:true};
 const read=isolatedBarcodeReader({createWorker:()=>worker,wasmUrl:'/vendor/zxing_reader.wasm',readInPage:()=>{throw Error('não deve ler na página');}});
 const image=photo();
 assert.deepEqual(await read(image,options),codes);
 const sent=worker.posts[0].data;
 assert.deepEqual(sent.options,options);assert.equal(sent.wasmUrl,'/vendor/zxing_reader.wasm');
 assert.equal(sent.width,2);assert.equal(sent.height,1);assert.deepEqual([...new Uint8ClampedArray(sent.pixels)],[...image.data]);
 // A copy is transferred: the photo used afterwards by the OCR is untouched.
 assert.notEqual(sent.pixels,image.data.buffer);assert.equal(image.data.length,8);
 assert.equal(worker.terminated,1);
});

test('se o worker falhar ou não puder ser criado, lê na página como antes',async()=>{
 const inPage=[];const readInPage=async(image,options)=>{inPage.push(options);return [{text:'na página'}];};
 const failing=mockWorker(w=>w.onmessage({data:{ok:false,error:'falhou'}}));
 const read=isolatedBarcodeReader({createWorker:()=>failing,wasmUrl:'x',readInPage});
 assert.deepEqual(await read(photo(),{a:1}),[{text:'na página'}]);assert.equal(failing.terminated,1);
 const noWorker=isolatedBarcodeReader({createWorker:()=>{throw Error('sem suporte');},wasmUrl:'x',readInPage});
 assert.deepEqual(await noWorker(photo(),{b:2}),[{text:'na página'}]);
 assert.deepEqual(inPage,[{a:1},{b:2}]);
});

test('worker que não responde não trava a leitura',async()=>{
 const silent=mockWorker(()=>{});
 const read=isolatedBarcodeReader({createWorker:()=>silent,wasmUrl:'x',timeoutMs:20,readInPage:async()=>[{text:'na página'}]});
 assert.deepEqual(await read(photo(),{}),[{text:'na página'}]);assert.equal(silent.terminated,1);
});
