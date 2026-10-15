import * as ort from 'onnxruntime-web/wasm';
import {decodeSerial} from './serial-recognition.mjs';
ort.env.wasm.numThreads=1;
ort.env.wasm.proxy=false;
ort.env.wasm.wasmPaths=new URL('../vendor/paddle/',self.location.href).href;
ort.env.logLevel='error';
let initialized;
async function engine(){
 if(!initialized)initialized=(async()=>{
  const [model,vocabulary]=await Promise.all([
   fetch(new URL('../vendor/paddle/serial-rec-en-v5.onnx',self.location.href)),
   fetch(new URL('../vendor/paddle/serial-rec-en-v5.json',self.location.href)),
  ]);
  if(!model.ok||!vocabulary.ok)throw new Error('Não foi possível carregar o leitor da série.');
  const session=await ort.InferenceSession.create(await model.arrayBuffer(),{
   executionProviders:['wasm'],enableCpuMemArena:false,enableMemPattern:false,logSeverityLevel:3,
  });
  return {session,dictionary:(await vocabulary.json()).dictionary};
 })();
 return initialized;
}
self.onmessage=async({data})=>{
 try{
  const {session,dictionary}=await engine();
  const outputs=await session.run({[session.inputNames[0]]:new ort.Tensor('float32',data.tensor,data.dims)});
  const output=outputs[session.outputNames[0]];
  const result=decodeSerial(output.data,output.dims,dictionary);
  for(const item of Object.values(outputs))item.dispose();
  self.postMessage({ok:true,result});
 }catch(error){self.postMessage({ok:false,error:String(error?.message||error)});}
};
