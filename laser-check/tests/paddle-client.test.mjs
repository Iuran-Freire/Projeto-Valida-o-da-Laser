import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createPaddleReader} from '../frontend/src/ocr/paddle-client.mjs';

function mockWorker(handle){return {terminated:0,posts:[],postMessage(data,transfer){this.posts.push({data,transfer});queueMicrotask(()=>handle(this,data));},terminate(){this.terminated++;}};}
const success=(worker,data,result)=>worker.onmessage({data:{id:data.id,ok:true,result}});

test('principal usa os mesmos modelos e pixels em um worker que pode ser encerrado',async()=>{
 const result=[{items:[{text:'SN: I6AD11100051',score:.98}]}],worker=mockWorker((w,d)=>success(w,d,d.type==='init'?{ready:true}:result));
 const options={textDetectionModelName:'PP-OCRv5_mobile_det',textRecognitionModelName:'PP-OCRv5_mobile_rec',ortOptions:{backend:'wasm',numThreads:1}};
 const reader=await createPaddleReader(options,{createWorker:()=>worker});
 const pixels=Uint8ClampedArray.from([10,20,30,255,40,50,60,255]);
 const input={width:2,height:1,getContext:()=>({getImageData:()=>({data:pixels})})};
 assert.deepEqual(await reader.predict(input,{textRecScoreThresh:0}),result);
 assert.deepEqual(worker.posts[0].data.options,options);
 assert.equal(worker.posts[1].data.pixels,pixels.buffer);assert.deepEqual(worker.posts[1].transfer,[pixels.buffer]);
 assert.equal(worker.posts[1].data.width,2);assert.equal(worker.posts[1].data.height,1);
 await reader.dispose();await reader.dispose();assert.equal(worker.terminated,1);
});

test('falha de memória ao iniciar encerra o worker antes de propagar o erro',async()=>{
 const worker=mockWorker((w,d)=>w.onmessage({data:{id:d.id,ok:false,error:{name:'RangeError',message:'WebAssembly.Memory(): could not allocate memory'}}}));
 await assert.rejects(createPaddleReader({}, {createWorker:()=>worker}),/could not allocate memory/);
 assert.equal(worker.terminated,1);
});

test('erro não capturado e timeout também liberam o worker',async()=>{
 const errorWorker=mockWorker(w=>w.onerror({message:'Uncaught RangeError: could not allocate memory'}));
 await assert.rejects(createPaddleReader({}, {createWorker:()=>errorWorker}),/allocate memory/);assert.equal(errorWorker.terminated,1);
 const silent=mockWorker(()=>{});
 await assert.rejects(createPaddleReader({}, {createWorker:()=>silent,timeoutMs:10}),/timeout/);assert.equal(silent.terminated,1);
});

test('falha durante a previsão encerra a memória do principal',async()=>{
 const worker=mockWorker((w,d)=>d.type==='init'?success(w,d,{ready:true}):w.onmessage({data:{id:d.id,ok:false,error:{name:'RangeError',message:'failed to allocate a buffer'}}}));
 const reader=await createPaddleReader({}, {createWorker:()=>worker});
 const input={width:1,height:1,getContext:()=>({getImageData:()=>({data:new Uint8ClampedArray(4)})})};
 await assert.rejects(reader.predict(input,{}),/failed to allocate/);assert.equal(worker.terminated,1);
});
