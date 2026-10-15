import {PaddleOCR} from '@paddleocr/paddleocr-js';
import {createWorker} from 'tesseract.js';
import {createReaderRecovery, compatibleItems} from './reader-recovery.mjs';
import {serialRegion} from './serial-region.mjs';
import {extractPrint} from '../../../shared/validation/compare.mjs';
const url=p=>new URL(p,document.baseURI).href;
let readerPromise=null;
const recoverReader=createReaderRecovery();
export function preloadPrintedReader(){return engine();}
function engine(){if(!readerPromise)readerPromise=PaddleOCR.create({textDetectionModelName:'PP-OCRv5_mobile_det',textRecognitionModelName:'PP-OCRv5_mobile_rec',textDetectionModelAsset:{url:url('./vendor/paddle/det.tar')},textRecognitionModelAsset:{url:url('./vendor/paddle/rec.tar')},worker:true,ortOptions:{backend:'wasm',numThreads:1,wasmPaths:url('./vendor/paddle/')}}).catch(error=>{readerPromise=null;throw error});return readerPromise;}
function cropCanvas(source,region,variant='original',lightOnDark=false,maxScale=2){
 const c=document.createElement('canvas');const scale=Math.min(maxScale,1200/Math.max(region.w,region.h));
 c.width=Math.max(1,Math.round(region.w*scale));c.height=Math.max(1,Math.round(region.h*scale));
 const ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(source,region.x,region.y,region.w,region.h,0,0,c.width,c.height);
 if(variant!=='original'){const image=ctx.getImageData(0,0,c.width,c.height),d=image.data,gray=new Uint8Array(c.width*c.height),hist=new Uint32Array(256);
  for(let p=0;p<gray.length;p++){const i=p*4,g=Math.round(.299*d[i]+.587*d[i+1]+.114*d[i+2]);gray[p]=g;if(variant==='limiar'||variant==='normalizado')hist[g]++;}
  let low=0,high=255;if(variant==='normalizado'){const cutoff=gray.length*.02;let count=0;while(low<254&&(count+=hist[low])<cutoff)low++;count=0;while(high>low&&(count+=hist[high])<cutoff)high--;}
  let threshold=128;if(variant==='limiar'){let sum=0,lowSum=0,lowCount=0,best=-1;for(let i=0;i<256;i++)sum+=i*hist[i];for(let i=0;i<256;i++){lowCount+=hist[i];if(!lowCount||lowCount===gray.length)continue;lowSum+=i*hist[i];const score=(sum*lowCount-lowSum*gray.length)**2/(lowCount*(gray.length-lowCount));if(score>best){best=score;threshold=i;}}}
  for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++){const p=y*c.width+x,g=gray[p];const left=x?gray[p-1]:g,right=x<c.width-1?gray[p+1]:g,up=y?gray[p-c.width]:g,down=y<c.height-1?gray[p+c.width]:g;let v=variant==='limiar'?(g>threshold?255:0):variant==='normalizado'?(g-low)*255/Math.max(1,high-low):variant==='nitidez'?3*g-(left+right+up+down)/2:(g-30)*1.5;v=Math.max(0,Math.min(255,v));if(lightOnDark)v=255-v;const i=p*4;d[i]=d[i+1]=d[i+2]=v;}ctx.putImageData(image,0,0);
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
 return recoverReader(
  async()=>{
   onProgress('Preparando leitor da tampografia…');
   const reader=await engine();
   try{return await readAttempts(reader,'PP-OCRv5_mobile_rec',source,region,onProgress,lightOnDark,detailed,options);}
   catch(error){readerPromise=null;await reader.dispose().catch(()=>{});throw error;}
  },
  async()=>{
   const worker=await createWorker('eng',1,{
    workerPath:url('./vendor/worker.min.js'),corePath:url('./vendor/'),langPath:url('./vendor/'),logger:()=>{},
   },{load_system_dawg:'0',load_freq_dawg:'0'});
   try{
    const reader={predict:async(input,params)=>{
     await worker.setParameters({tessedit_pageseg_mode:params.singleLine?'7':'11'});
     const {data}=await worker.recognize(input,{}, {text:true,blocks:true});
     return [{items:compatibleItems(data)}];
    }};
    return await readAttempts(reader,'Tesseract · compatibilidade',source,region,
     text=>onProgress('Modo de compatibilidade · '+text),lightOnDark,detailed,options,true);
   }finally{await worker.terminate();}
  },onProgress);
}
async function readAttempts(reader,model,source,region,onProgress,lightOnDark,detailed,options,compatible=false){
 const attempts=[];
 const variants=compatible?(detailed?['original','normalizado','original','nitidez']:['original','normalizado']):(detailed?['original','contraste','original','contraste']:['original','contraste']);
 let focused=null;
 for(const variant of variants){
  const currentRegion=(compatible||detailed&&attempts.length>=2)&&focused?focused:region;
  onProgress('Lendo a linha da série · '+(attempts.length+1)+' de '+variants.length+(currentRegion===focused?' · ampliada':'')+'…');
  const input=cropCanvas(source,currentRegion,variant,lightOnDark,compatible&&currentRegion===focused?4:2);
  try{const [result]=await reader.predict(input,{...(compatible?{singleLine:currentRegion===focused}:{}),textRecScoreThresh:0,textDetLimitSideLen:1200,textDetLimitType:'max',textDetBoxThresh:.4});const attempt=sample(result.items,model,variant+(currentRegion===focused?'-ampliada':''),currentRegion);if((detailed||compatible)&&!focused)focused=serialRegion(attempt,currentRegion,input.width,source,{...options,wholeLine:compatible});attempts.push(attempt);}
  finally{input.width=0;input.height=0;await new Promise(resolve=>setTimeout(resolve,20));}
 }
 return attempts;
}
