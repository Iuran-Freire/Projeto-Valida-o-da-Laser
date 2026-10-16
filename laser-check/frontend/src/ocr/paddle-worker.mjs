// Keep OpenCV and ONNX in one disposable worker. Importing the SDK in the page
// also initializes OpenCV there, even when the SDK's worker option is enabled.
let reader;
self.onmessage=async({data})=>{
 try{
  if(data.type==='init'){
   const {PaddleOCR}=await import('@paddleocr/paddleocr-js');
   reader=await PaddleOCR.create({...data.options,worker:false,
    ortOptions:{...data.options.ortOptions,disableWasmProxy:true}});
   self.postMessage({id:data.id,ok:true,result:{ready:true}});
  }else if(data.type==='predict'){
   if(!reader)throw new Error('Leitor principal não inicializado.');
   const pixels=new Uint8ClampedArray(data.pixels);
   const mat=reader.cv.matFromArray(data.height,data.width,reader.cv.CV_8UC4,pixels);
   try{self.postMessage({id:data.id,ok:true,result:await reader.predict(mat,data.params)});}
   finally{mat.delete();}
  }else throw new Error('Operação de leitura desconhecida.');
 }catch(error){self.postMessage({id:data.id,ok:false,error:{name:error?.name||'Error',message:String(error?.message||error)}});}
};
