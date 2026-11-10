// Page side of the 2D code reader: the same zxing-wasm reader and options, run
// in a fresh worker that is terminated after each photo so its memory is freed.
// If the worker cannot run, it reads in the page exactly as before.
export function isolatedBarcodeReader({readInPage,createWorker,wasmUrl,timeoutMs=60000}){
 return async(image,options)=>{
  let worker;
  try{worker=createWorker();}catch{return readInPage(image,options);}
  try{
   const pixels=image.data.slice().buffer; // the photo itself stays intact for the OCR
   return await new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>reject(new Error('Leitor do código demorou a responder.')),timeoutMs);
    worker.onmessage=({data})=>{clearTimeout(timer);data.ok?resolve(data.codes):reject(new Error(data.error));};
    worker.onerror=event=>{event.preventDefault?.();clearTimeout(timer);reject(new Error(event.message||'Falha no leitor do código.'));};
    worker.postMessage({pixels,width:image.width,height:image.height,options,wasmUrl},[pixels]);
   });
  }catch{
   return readInPage(image,options);
  }finally{worker.terminate();}
 };
}
