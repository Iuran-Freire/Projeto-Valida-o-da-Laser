import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as ort from 'onnxruntime-web/wasm';
import {serialTensor,decodeSerial} from '../frontend/src/ocr/serial-recognition.mjs';
import {samsungSerialCandidate} from '../frontend/src/ocr/samsung-serial.mjs';
import {enhanceGlyphPixels,markGlyphReview} from '../frontend/src/ocr/glyph-review.mjs';

test('foto real do A13: reconhece os 14 caracteres, incluindo 5, 1 e I, sem correção',async()=>{
 ort.env.wasm.numThreads=1;
 const {dictionary}=JSON.parse(await readFile(new URL('../frontend/dist/vendor/paddle/serial-rec-en-v5.json',import.meta.url),'utf8'));
 for(const modelFile of ['serial-rec-en-v5.onnx','serial-rec-en-v5-int8.onnx']){
 const model=await readFile(new URL('../frontend/dist/vendor/paddle/'+modelFile,import.meta.url));
 const session=await ort.InferenceSession.create(model,{executionProviders:['wasm'],enableCpuMemArena:false,enableMemPattern:false,logSeverityLevel:3});
 try{
  for(const name of ['m09031d-a13-line','a13-screenshot-line']){
  const fixture=JSON.parse(await readFile(new URL('./fixtures/'+name+'.json',import.meta.url),'utf8'));
  const original=await readFile(new URL('./fixtures/'+name+'.rgba',import.meta.url));
  const readings=[];
  for(const variant of ['original','contraste','nitidez'])for(const invert of [false,true]){
   const pixels=variant==='original'?Uint8Array.from(original):enhanceGlyphPixels(original,fixture.width,fixture.height,variant);
   if(invert)for(let i=0;i<pixels.length;i+=4){pixels[i]=255-pixels[i];pixels[i+1]=255-pixels[i+1];pixels[i+2]=255-pixels[i+2];}
   const input=serialTensor(pixels,fixture.width,fixture.height);
   const outputs=await session.run({[session.inputNames[0]]:new ort.Tensor('float32',input.data,input.dims)});
   const output=outputs[session.outputNames[0]],result=decodeSerial(output.data,output.dims,dictionary);
   readings.push({text:result.text,confidence:result.score*100});
   // The screenshot is compressed: extra treatments can disagree. Both raw
   // polarities must find the correct series; a conflicting variant stays raw.
   if(name==='m09031d-a13-line'||variant==='original'){
    assert.equal(samsungSerialCandidate(result.text),fixture.serial,name+' '+variant+' '+result.text);
    assert.ok(result.score>.9);
   }
   for(const value of Object.values(outputs))value.dispose();
  }
  if(readings.some(item=>samsungSerialCandidate(item.text)!==fixture.serial)){
   assert.ok(markGlyphReview(readings,samsungSerialCandidate).every(item=>item.glyphReview));
  }
  }
 }finally{await session.release();}
 }
});
