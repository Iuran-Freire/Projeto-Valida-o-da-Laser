import {createWorker} from 'tesseract.js';
import {createReaderRecovery, compatibleItems} from './reader-recovery.mjs';
import {serialRegion} from './serial-region.mjs';
import {searchBands} from './m09031d-recovery.mjs';
import {samsungSerialCandidate,samsungSerialSample} from './samsung-serial.mjs';
import {refinePrintedSerial} from './light-serial-reader.mjs';
import {extractPrint} from '../../../shared/validation/compare.mjs';
const url=p=>new URL(p,document.baseURI).href;
let readerPromise=null;
const recoverReader=createReaderRecovery();
export function preloadPrintedReader(){return engine();}
function engine(){if(!readerPromise)readerPromise=(async()=>{const {PaddleOCR}=await import('@paddleocr/paddleocr-js');return PaddleOCR.create({textDetectionModelName:'PP-OCRv5_mobile_det',textRecognitionModelName:'PP-OCRv5_mobile_rec',textDetectionModelAsset:{url:url('./vendor/paddle/det.tar')},textRecognitionModelAsset:{url:url('./vendor/paddle/rec.tar')},worker:true,ortOptions:{backend:'wasm',numThreads:1,wasmPaths:url('./vendor/paddle/')}});})().catch(error=>{readerPromise=null;throw error});return readerPromise;}
function cropCanvas(source,region,variant='original',lightOnDark=false,maxScale=2){
 const c=document.createElement('canvas');const scale=Math.min(maxScale,1200/Math.max(region.w,region.h));
 c.width=Math.max(1,Math.round(region.w*scale));c.height=Math.max(1,Math.round(region.h*scale));
 const ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(source,region.x,region.y,region.w,region.h,0,0,c.width,c.height);
 if(variant!=='original'){const image=ctx.getImageData(0,0,c.width,c.height),d=image.data,gray=new Uint8Array(c.width*c.height),hist=new Uint32Array(256);
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
export async function readPrintedSerial(source,region,onProgress,lightOnDark=false,detailed=false,options={}){
 if(options.directSerialReader){
  onProgress('Preparando leitor de caracteres da tampografia…');
  const attempts=await refinePrintedSerial(source,[],onProgress,region);
  if(!attempts.length)throw new Error('A linha da série não foi localizada na foto. Aproxime a etiqueta e tente novamente.');
  return attempts;
 }
 return recoverReader(
  async()=>{
   onProgress('Preparando leitor da tampografia…');
   const reader=await engine();
   try{return await readAttempts(reader,'PP-OCRv5_mobile_rec',source,region,onProgress,lightOnDark,detailed,options);}
   catch(error){readerPromise=null;await reader.dispose().catch(()=>{});throw error;}
  },
  async()=>{
   let initialRefinement=[];
   if(options.allowUnlabelledSerial){
    try{
     initialRefinement=await refinePrintedSerial(source,[],onProgress,region);
     if(initialRefinement.some(item=>samsungSerialCandidate(item.text)))return initialRefinement;
    }catch{/* The previous reader remains available if this device cannot load the smaller model. */}
   }
   const worker=await createWorker('eng',1,{
    workerPath:url('./vendor/worker.min.js'),corePath:url('./vendor/'),langPath:url('./vendor/'),logger:()=>{},
   },{load_system_dawg:'0',load_freq_dawg:'0'});
   let attempts;
   try{
    const reader={predict:async(input,params)=>{
     await worker.setParameters({tessedit_pageseg_mode:params.singleLine?'7':'11'});
     const bordered=document.createElement('canvas');bordered.width=input.width+20;bordered.height=input.height+20;
     const context=bordered.getContext('2d');context.fillStyle='#fff';context.fillRect(0,0,bordered.width,bordered.height);context.drawImage(input,10,10);
     try{const {data}=await worker.recognize(bordered,{}, {text:true,blocks:true});
      return [{items:compatibleItems(data,10)}];
     }finally{bordered.width=0;bordered.height=0;}
    }};
    attempts=await readAttempts(reader,'Tesseract · compatibilidade',source,region,
     text=>onProgress('Modo de compatibilidade · '+text),lightOnDark,detailed,options,true);
   }finally{await worker.terminate();}
   // Release the localization engine before loading the smaller recognition model.
   if(options.allowUnlabelledSerial){
    try{attempts.push(...await refinePrintedSerial(source,attempts,onProgress));}
    catch(error){if(attempts[0])attempts[0].refinementError=String(error?.message||error);}
   }
   return [...initialRefinement,...attempts];
  },onProgress);
}
async function readAttempts(reader,model,source,region,onProgress,lightOnDark,detailed,options,compatible=false){
 const attempts=[];
 const variants=compatible?(detailed?['cinza','normalizado','cinza','nitidez']:['cinza','normalizado']):(detailed?['original','contraste','original','contraste']:['original','contraste']);
 let focused=null;
 for(const variant of variants){
  const currentRegion=(compatible||detailed&&attempts.length>=2)&&focused?focused:region;
  onProgress('Lendo a linha da série · '+(attempts.length+1)+' de '+variants.length+(currentRegion===focused?' · ampliada':'')+'…');
  const input=cropCanvas(source,currentRegion,variant,lightOnDark,compatible&&currentRegion===focused?4:2);
  try{const [result]=await reader.predict(input,{...(compatible?{singleLine:currentRegion===focused&&variant!=='normalizado'}:{}),textRecScoreThresh:0,textDetLimitSideLen:1200,textDetLimitType:'max',textDetBoxThresh:.4});let attempt={...sample(result.items,model,variant+(currentRegion===focused?'-ampliada':''),currentRegion),inputWidth:input.width};if(compatible&&options.allowUnlabelledSerial)attempt=samsungSerialSample(attempt);if((detailed||compatible)&&!focused)focused=serialRegion(attempt,currentRegion,input.width,source,{...options,...(compatible&&options.allowUnlabelledSerial?{extractSerial:samsungSerialCandidate}:{}),wholeLine:compatible});attempts.push(attempt);}
  finally{input.width=0;input.height=0;await new Promise(resolve=>setTimeout(resolve,20));}
 }
 if(options.searchSmallSerial&&!attempts.some(attempt=>extractPrint(attempt.text).serial)){
  // One crop at a time keeps the same 1200-pixel working limit on small devices.
  for(const band of searchBands(source.width,source.height)){
   onProgress('M09031D · procurando a série em um recorte ampliado…');
   const extra=await readAttempts(reader,model,source,band,onProgress,lightOnDark,false,{...options,searchSmallSerial:false},compatible);
   attempts.push(...extra);
   if(extra.some(attempt=>extractPrint(attempt.text).serial))break;
  }
 }
 return attempts;
}
