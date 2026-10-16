// This page-side adapter must never import the Paddle SDK/OpenCV.
export async function createPaddleReader(options,{createWorker,timeoutMs=60000}={}){
 const worker=createWorker?createWorker():new Worker(new URL(__PADDLE_WORKER__,document.baseURI),{type:'module'});
 const pending=new Map();let nextId=1,closed=false;
 const stop=(error=new Error('Leitor principal encerrado.'))=>{
  if(closed)return;
  closed=true;worker.terminate();
  for(const item of pending.values()){clearTimeout(item.timer);item.reject(error);}
  pending.clear();
 };
 worker.onmessage=({data})=>{
  const item=pending.get(data.id);if(!item)return;
  pending.delete(data.id);clearTimeout(item.timer);
  if(data.ok)item.resolve(data.result);
  else{const error=new Error(data.error?.message||'Falha no leitor principal.');error.name=data.error?.name||'Error';item.reject(error);}
 };
 worker.onerror=event=>{event.preventDefault?.();stop(new Error(event.message||'Falha no processamento WebAssembly do leitor principal.'));};
 worker.onmessageerror=()=>stop(new Error('Falha no processamento WebAssembly: resposta inválida do leitor.'));
 const request=(type,payload,transfer=[])=>new Promise((resolve,reject)=>{
  if(closed){reject(new Error('Leitor principal encerrado.'));return;}
  const id=nextId++,timer=setTimeout(()=>stop(new Error('O leitor principal demorou a responder (timeout).')),timeoutMs);
  pending.set(id,{resolve,reject,timer});
  try{worker.postMessage({id,type,...payload},transfer);}catch(error){stop(error);}
 });
 try{await request('init',{options});}
 catch(error){stop(error);throw error;}
 return {
  predict:async(input,params)=>{
   const pixels=input.getContext('2d',{willReadFrequently:true}).getImageData(0,0,input.width,input.height).data;
   try{return await request('predict',{width:input.width,height:input.height,pixels:pixels.buffer,params},[pixels.buffer]);}
   catch(error){stop(error);throw error;}
  },
  dispose:async()=>stop(),
 };
}
