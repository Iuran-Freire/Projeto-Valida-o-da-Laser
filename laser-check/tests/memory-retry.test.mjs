import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readerFailureKind,isMemoryError,createReaderRecovery} from '../frontend/src/ocr/reader-recovery.mjs';
import {refinePrintedSerial,serialInputWidth,SERIAL_INPUT_WIDTHS} from '../frontend/src/ocr/light-serial-reader.mjs';

// Messages reported by the Samsung A13 diagnostics.
const a13Errors=[
 "Can't create a session. failed to allocate a buffer of size 16534782.",
 'failed to call OrtRun(). ERROR_CODE: 6, ERROR_MESSAGE: std::bad_alloc',
 'OrtRun(): std::bad_alloc',
 'Uncaught RuntimeError: Aborted(OOM)',
 '[WebAssembly.Memory]: could not grow memory',
];

test('erros de memória do A13 são reconhecidos como falta de memória',()=>{
 for(const message of a13Errors){
  assert.equal(isMemoryError(new Error(message)),true,message);
  assert.equal(readerFailureKind(new Error(message)),'memory',message);
 }
 assert.equal(isMemoryError(new Error('Recorte de série inválido.')),false);
});

test('std::bad_alloc na leitura principal aciona o leitor alternativo em vez de abortar',async()=>{
 const read=createReaderRecovery();let fallback=0;
 const result=await read(async()=>{throw new Error('failed to call OrtRun(). ERROR_CODE: 6, ERROR_MESSAGE: std::bad_alloc');},
  async context=>{fallback++;assert.equal(context.reason,'memory');return [{text:'NUMERO DE SERIE:R37LAGG0011IPA'}];},()=>{});
 assert.equal(fallback,1);assert.equal(result[0].recoveryReason,'memory');
});

test('largura da linha respeita o limite de cada tentativa',()=>{
 assert.deepEqual(SERIAL_INPUT_WIDTHS,[1600,640,480]);
 const region={x:0,y:0,w:2000,h:40};
 assert.equal(serialInputWidth(region),1600);
 assert.equal(serialInputWidth(region,1,640),640);
 assert.equal(serialInputWidth({x:0,y:0,w:100,h:48}),100);
});

function fakeDom(){
 const created=[];
 globalThis.document={createElement:()=>{
  const canvas={width:0,height:0,getContext:()=>({drawImage(){},getImageData:(x,y,w,h)=>({data:new Uint8ClampedArray(w*h*4).fill(255)})})};
  created.push(canvas);return canvas;
 }};
 return created;
}

test('falta de memória no leitor alternativo tenta de novo com imagem menor e worker novo',async()=>{
 fakeDom();
 const workers=[],widths=[],progress=[];
 const createWorker=()=>{
  const worker={terminated:false,terminate(){this.terminated=true;},postMessage(message){
   const width=message.dims[3];widths.push({width,quantized:message.quantized});
   // The phone only copes with narrow inputs.
   queueMicrotask(()=>width>640?this.onmessage({data:{ok:false,error:'OrtRun(): std::bad_alloc'}})
    :this.onmessage({data:{ok:true,result:{text:'NUMERO DE SERIE:R37LAGG0011IPA',score:.97,glyphs:[]}}}));
  }};
  workers.push(worker);return worker;
 };
 // Detected line of the photo (no barcode text involved).
 const attempts=[{text:'NUMERO DE SERIE:R37LAGG0011IPA',inputWidth:3000,region:{x:0,y:0,w:3000,h:200},
  lines:[{text:'NUMERO DE SERIE:R37LAGG0011IPA',confidence:40,poly:[[10,50],[2990,50],[2990,80],[10,80]]}]}];
 const source={width:3000,height:200};
 const results=await refinePrintedSerial(source,attempts,text=>progress.push(text),{x:0,y:0,w:3000,h:200},{createWorker});
 assert.equal(widths[0].width,1600);assert.equal(widths[0].quantized,false);
 assert.equal(widths[1].width,640);assert.equal(widths[1].quantized,true);
 // After the reduction every following line stays narrow: no repeated failures.
 assert.ok(widths.slice(1).every(item=>item.width<=640));
 assert.equal(widths.filter(item=>item.width>640).length,1);
 assert.ok(workers.length>=2);assert.ok(workers.every(worker=>worker.terminated));
 assert.ok(progress.some(text=>/imagem menor \(640 px\)/.test(text)));
 assert.equal(results[0].weightPrecision,'int8');
 assert.equal(results[0].memoryRetries[0].width,640);
 assert.match(results[0].text,/R37LAGG0011IPA/);
 delete globalThis.document;
});

test('falta de memória em todas as larguras é repassada para o próximo leitor',async()=>{
 fakeDom();
 const widths=[];
 const createWorker=()=>({terminate(){},postMessage(message){widths.push(message.dims[3]);queueMicrotask(()=>this.onmessage({data:{ok:false,error:'std::bad_alloc'}}));}});
 const attempts=[{text:'NUMERO DE SERIE:R37LAGG0011IPA',inputWidth:3000,region:{x:0,y:0,w:3000,h:200},
  lines:[{text:'NUMERO DE SERIE:R37LAGG0011IPA',confidence:40,poly:[[10,50],[2990,50],[2990,80],[10,80]]}]}];
 await assert.rejects(refinePrintedSerial({width:3000,height:200},attempts,()=>{},{x:0,y:0,w:3000,h:200},{createWorker}),/bad_alloc/);
 assert.deepEqual(widths,[1600,640,480]);
 delete globalThis.document;
});
