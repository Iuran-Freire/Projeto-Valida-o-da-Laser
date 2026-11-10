import {createWorker} from 'tesseract.js';
import {createReaderRecovery, compatibleItems} from './reader-recovery.mjs';
import {serialRegion} from './serial-region.mjs';
import {samsungSerialCandidate,samsungSerialSample,samsungUnlabelledSample} from './samsung-serial.mjs';
import {refinePrintedSerial} from './light-serial-reader.mjs';
import {extractPrint} from '../../../shared/validation/compare.mjs';
import {enhanceGlyphPixels,markGlyphReview} from './glyph-review.mjs';
import {createPaddleReader} from './paddle-client.mjs';
import {isMemoryError} from './reader-recovery.mjs';
// Main reader input: 1200 px; after a memory failure while reading (weak
// phones such as the A13) it retries once at 800 px and keeps that size.
const PRIMARY_SIDE=1200,REDUCED_PRIMARY_SIDE=800;
let primarySide=PRIMARY_SIDE;
const url=p=>new URL(p,document.baseURI).href;
let readerPromise=null;
const recoverReader=createReaderRecovery();
export function preloadPrintedReader(){return engine();}
function engine(){if(!readerPromise)readerPromise=createPaddleReader({textDetectionModelName:'PP-OCRv5_mobile_det',textRecognitionModelName:'PP-OCRv5_mobile_rec',textDetectionModelAsset:{url:url('./vendor/paddle/det.tar')},textRecognitionModelAsset:{url:url('./vendor/paddle/rec.tar')},ortOptions:{backend:'wasm',numThreads:1,wasmPaths:url('./vendor/paddle/')}}).catch(error=>{readerPromise=null;throw error});return readerPromise;}
function cropCanvas(source,region,variant='original',lightOnDark=false,maxScale=2,maxSide=PRIMARY_SIDE){
 const c=document.createElement('canvas');const scale=Math.min(maxScale,maxSide/Math.max(region.w,region.h));
 c.width=Math.max(1,Math.round(region.w*scale));c.height=Math.max(1,Math.round(region.h*scale));
 const ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(source,region.x,region.y,region.w,region.h,0,0,c.width,c.height);
 if(variant.startsWith('caracteres-')){
  const image=ctx.getImageData(0,0,c.width,c.height);
  image.data.set(enhanceGlyphPixels(image.data,c.width,c.height,variant.slice('caracteres-'.length)));
  if(lightOnDark)for(let i=0;i<image.data.length;i+=4){image.data[i]=255-image.data[i];image.data[i+1]=255-image.data[i+1];image.data[i+2]=255-image.data[i+2];}
  ctx.putImageData(image,0,0);
 }else if(variant!=='original'){const image=ctx.getImageData(0,0,c.width,c.height),d=image.data,gray=new Uint8Array(c.width*c.height),hist=new Uint32Array(256);
  for(let p=0;p<gray.length;p++){const i=p*4,g=Math.round(.299*d[i]+.587*d[i+1]+.114*d[i+2]);gray[p]=g;if(variant==='limiar'||variant==='normalizado')hist[g]++;}
  let low=0,high=255;if(variant==='normalizado'){const cutoff=gray.length*.02;let count=0;while(low<254&&(count+=hist[low])<cutoff)low++;count=0;while(high>low&&(count+=hist[high])<cutoff)high--;}
  let threshold=128;if(variant==='limiar'){let sum=0,lowSum=0,lowCount=0,best=-1;for(let i=0;i<256;i++)sum+=i*hist[i];for(let i=0;i<256;i++){lowCount+=hist[i];if(!lowCount||lowCount===gray.length)continue;lowSum+=i*hist[i];const score=(sum*lowCount-lowSum*gray.length)**2/(lowCount*(gray.length-lowCount));if(score>best){best=score;threshold=i;}}}
  for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++){const p=y*c.width+x,g=gray[p];const left=x?gray[p-1]:g,right=x<c.width-1?gray[p+1]:g,up=y?gray[p-c.width]:g,down=y<c.height-1?gray[p+c.width]:g;let v=variant==='cinza'?g:variant==='limiar'?(g>threshold?255:0):variant==='normalizado'?(g-low)*255/Math.max(1,high-low):variant==='nitidez'?3*g-(left+right+up+down)/2:(g-30)*1.5;v=Math.max(0,Math.min(255,v));if(lightOnDark)v=255-v;const i=p*4;d[i]=d[i+1]=d[i+2]=v;}ctx.putImageData(image,0,0);
 }return c;
}
function sample(items,model,variant,region){
 const lines=items.map(i=>({text:i.text,confidence:Math.round(i.score*100),poly:i.poly}));
 const candidates=lines.filter(i=>extractPrint(i.text).serial);
 const labelled=lines.filter(i=>/N[ÚUÜO]MERO\s*DE\s*S[ÉE]RIE/i.test(i.text));
 const chosen=candidates.length===1?candidates[0]:labelled.length===1?labelled[0]:null;
 return {text:chosen?.text||lines.map(i=>i.text).join('\n'),fullText:lines.map(i=>i.text).join('\n'),confidence:chosen?.confidence||0,model,variant,region,lines};
}
async function releasePrimary(){
 const pending=readerPromise;readerPromise=null;
 if(pending){const reader=await pending.catch(()=>null);await reader?.dispose().catch(()=>{});}
}
export async function readPrintedSerial(source,region,onProgress,lightOnDark=false,detailed=false,options={}){
 const isReadable=options.isReadable||(items=>items.some(item=>item.text?.trim()));
 return recoverReader(
  async()=>{
   onProgress('Preparando leitor principal da tampografia…');
   // Only the first use downloads the reader; say so instead of looking stuck.
   const slow=setTimeout(()=>onProgress('Preparando leitor principal · na primeira vez o download pode levar alguns minutos…'),15000);
   let reader;
   try{reader=await engine();}finally{clearTimeout(slow);}
   const primaryOptions=detailed?options:{allowUnlabelledSerial:options.allowUnlabelledSerial};
   try{return await readAttempts(reader,'PP-OCRv5_mobile_rec',source,region,onProgress,lightOnDark,detailed,primaryOptions,false,primarySide);}
   catch(error){
    await releasePrimary();
    // Out of memory while reading: same reader, fresh worker, smaller image.
    if(!isMemoryError(error)||primarySide<=REDUCED_PRIMARY_SIDE)throw error;
    primarySide=REDUCED_PRIMARY_SIDE;
    onProgress('Leitor principal · pouca memória · tentando de novo com imagem menor…');
    const retry=await engine();
    try{
     const attempts=await readAttempts(retry,'PP-OCRv5_mobile_rec',source,region,onProgress,lightOnDark,detailed,primaryOptions,false,primarySide);
     return attempts.map(item=>({...item,primaryMemoryRetry:{maxSide:primarySide,error:String(error?.message||error).slice(0,200)}}));
    }catch(retryError){await releasePrimary();throw retryError;}
   }
  },
  async({reason,attempts})=>{
   const results=[],errors=[];
   const light=async()=>{
    const settings={...options,lightOnDark,maxLines:detailed?12:10,preferVisual:reason==='uncertain',quantized:reason==='memory'};
    // On memory failure the light reader itself switches to the compact model
    // and narrower inputs (1600 → 640 → 480 px) in a fresh worker.
    return refinePrintedSerial(source,attempts,onProgress,region,settings);
   };
   const classic=async()=>{
    const worker=await createWorker('eng',1,{
     workerPath:url('./vendor/worker.min.js'),corePath:url('./vendor/'),langPath:url('./vendor/'),logger:()=>{},
    },{load_system_dawg:'0',load_freq_dawg:'0'});
    try{
     const reader={predict:async(input,params)=>{
      await worker.setParameters({tessedit_pageseg_mode:params.singleLine?'7':'11'});
      const bordered=document.createElement('canvas');bordered.width=input.width+20;bordered.height=input.height+20;
      const context=bordered.getContext('2d');context.fillStyle='#fff';context.fillRect(0,0,bordered.width,bordered.height);context.drawImage(input,10,10);
      try{const {data}=await worker.recognize(bordered,{}, {text:true,blocks:true});return [{items:compatibleItems(data,10)}];}
      finally{bordered.width=0;bordered.height=0;}
     }};
     return await readAttempts(reader,'Tesseract · alternativo',source,region,
      text=>onProgress('Leitor alternativo · '+text),lightOnDark,detailed,options,true);
    }finally{await worker.terminate();}
   };
   // A separate OCR runtime can help when the ONNX backend itself is unsupported.
   for(const read of reason==='unsupported'?[classic,light]:[light,classic]){
    try{
     const items=await read();results.push(...items);
     if(isReadable(items))return results.map(item=>({...item,...(errors.length?{recoveryErrors:errors}:{})}));
    }catch(error){errors.push(String(error?.message||error));}
   }
   if(results.length)return results.map(item=>({...item,...(errors.length?{recoveryErrors:errors}:{})}));
   throw new Error(errors.join(' | ')||'Nenhum leitor identificou o texto na foto.');
  },onProgress,{isReadable,isConfident:options.isConfident,beforeFallback:releasePrimary});
}
async function readAttempts(reader,model,source,region,onProgress,lightOnDark,detailed,options,compatible=false,maxSide=PRIMARY_SIDE){
 const attempts=[];
 const variants=compatible?(detailed?['cinza','normalizado','cinza','nitidez']:['cinza','normalizado']):(detailed?['original','contraste','original','contraste']:['original','contraste']);
 if(detailed)variants.push('caracteres-contraste','caracteres-nitidez');
 let focused=null;
 for(const variant of variants){
  const currentRegion=(compatible||detailed&&attempts.length>=2)&&focused?focused:region;
  onProgress((variant.startsWith('caracteres-')?'Leitura detalhada · conferindo I/1 e 5/S':'Lendo a linha da série')+' · '+(attempts.length+1)+' de '+variants.length+(currentRegion===focused?' · ampliada':'')+'…');
  const input=cropCanvas(source,currentRegion,variant,lightOnDark,compatible&&currentRegion===focused?4:2,maxSide);
  try{const [result]=await reader.predict(input,{...(compatible?{singleLine:currentRegion===focused&&variant!=='normalizado'}:{}),textRecScoreThresh:0,textDetLimitSideLen:maxSide,textDetLimitType:'max',textDetBoxThresh:.4});let attempt={...sample(result.items,model,variant+(currentRegion===focused?'-ampliada':''),currentRegion),inputWidth:input.width};if(options.allowUnlabelledSerial)attempt=compatible?samsungSerialSample(attempt):samsungUnlabelledSample(attempt);if((detailed||compatible)&&!focused)focused=serialRegion(attempt,currentRegion,input.width,source,{...options,...(compatible&&options.allowUnlabelledSerial?{extractSerial:samsungSerialCandidate}:{}),wholeLine:compatible});attempts.push(attempt);}
  finally{input.width=0;input.height=0;await new Promise(resolve=>setTimeout(resolve,20));}
 }
 return detailed?markGlyphReview(attempts,options.extractSerial||(text=>extractPrint(text).serial)):attempts;
}
