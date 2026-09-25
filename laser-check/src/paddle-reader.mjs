import {PaddleOCR} from '@paddleocr/paddleocr-js';
import {extractPrint} from './compare.mjs';
const url=p=>new URL(p,document.baseURI).href;
let readerPromise=null;
function engine(){if(!readerPromise)readerPromise=PaddleOCR.create({textDetectionModelName:'PP-OCRv5_mobile_det',textRecognitionModelName:'PP-OCRv5_mobile_rec',textDetectionModelAsset:{url:url('./vendor/paddle/det.tar')},textRecognitionModelAsset:{url:url('./vendor/paddle/rec.tar')},worker:true,ortOptions:{backend:'wasm',numThreads:1,wasmPaths:url('./vendor/paddle/')}}).catch(error=>{readerPromise=null;throw error});return readerPromise;}
function cropCanvas(source,region,variant='original',lightOnDark=false){
 const c=document.createElement('canvas');const scale=Math.min(2,1200/Math.max(region.w,region.h));
 c.width=Math.max(1,Math.round(region.w*scale));c.height=Math.max(1,Math.round(region.h*scale));
 const ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(source,region.x,region.y,region.w,region.h,0,0,c.width,c.height);
 if(variant!=='original'){const image=ctx.getImageData(0,0,c.width,c.height),d=image.data,gray=new Uint8Array(c.width*c.height),hist=new Uint32Array(256);
  for(let p=0;p<gray.length;p++){const i=p*4,g=Math.round(.299*d[i]+.587*d[i+1]+.114*d[i+2]);gray[p]=g;if(variant==='limiar')hist[g]++;}
  let threshold=128;if(variant==='limiar'){let sum=0,lowSum=0,lowCount=0,best=-1;for(let i=0;i<256;i++)sum+=i*hist[i];for(let i=0;i<256;i++){lowCount+=hist[i];if(!lowCount||lowCount===gray.length)continue;lowSum+=i*hist[i];const score=(sum*lowCount-lowSum*gray.length)**2/(lowCount*(gray.length-lowCount));if(score>best){best=score;threshold=i;}}}
  for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++){const p=y*c.width+x,g=gray[p];const left=x?gray[p-1]:g,right=x<c.width-1?gray[p+1]:g,up=y?gray[p-c.width]:g,down=y<c.height-1?gray[p+c.width]:g;let v=variant==='limiar'?(g>threshold?255:0):variant==='nitidez'?3*g-(left+right+up+down)/2:(g-30)*1.5;v=Math.max(0,Math.min(255,v));if(lightOnDark)v=255-v;const i=p*4;d[i]=d[i+1]=d[i+2]=v;}ctx.putImageData(image,0,0);
 }return c;
}
function sample(items,model,variant,region){
 const lines=items.map(i=>({text:i.text,confidence:Math.round(i.score*100),poly:i.poly}));
 const candidates=lines.filter(i=>extractPrint(i.text).serial);
 const labelled=lines.filter(i=>/N[ÚUÜO]MERO\s*DE\s*S[ÉE]RIE/i.test(i.text));
 const chosen=candidates.length===1?candidates[0]:labelled.length===1?labelled[0]:null;
 return {text:chosen?.text||lines.map(i=>i.text).join('\n'),fullText:lines.map(i=>i.text).join('\n'),confidence:chosen?.confidence||0,model,variant,region,lines};
}
function serialRegion(attempt,region,inputWidth,source){
 const line=attempt.lines.find(item=>extractPrint(item.text).serial);
 const poly=line?.poly;
 if(!Array.isArray(poly)||poly.length<4)return null;
 const xs=poly.map(point=>point[0]),ys=poly.map(point=>point[1]);
 if([...xs,...ys].some(value=>!Number.isFinite(value)))return null;
 const scale=inputWidth/region.w,left=Math.min(...xs),right=Math.max(...xs),top=Math.min(...ys),bottom=Math.max(...ys);
 const x=Math.max(0,Math.floor(region.x+(left+(right-left)*.38)/scale-8));
 const y=Math.max(0,Math.floor(region.y+top/scale-8));
 const width=Math.min(source.width-x,Math.ceil(region.x+right/scale+12-x));
 const height=Math.min(source.height-y,Math.ceil(region.y+bottom/scale+8-y));
 return width>40&&height>8?{x,y,w:width,h:height}:null;
}
export async function readPrintedSerial(source,region,onProgress,lightOnDark=false,detailed=false){
 const attempts=[];
 const variants=detailed?['original','contraste','original','contraste']:['original','contraste'];
 let focused=null;
 onProgress('Preparando leitor da tampografia…');
 const reader=await engine();
 try{for(const variant of variants){
  const currentRegion=detailed&&attempts.length>=2&&focused?focused:region;
  onProgress('Lendo a linha da série · '+(attempts.length+1)+' de '+variants.length+(currentRegion===focused?' · ampliada':'')+'…');
  const input=cropCanvas(source,currentRegion,variant,lightOnDark);
  try{const [result]=await reader.predict(input,{textRecScoreThresh:0,textDetLimitSideLen:1200,textDetLimitType:'max',textDetBoxThresh:.4});const attempt=sample(result.items,'PP-OCRv5_mobile_rec',variant+(currentRegion===focused?'-ampliada':''),currentRegion);if(detailed&&!focused)focused=serialRegion(attempt,currentRegion,input.width,source);attempts.push(attempt);}
  finally{input.width=0;input.height=0;await new Promise(resolve=>setTimeout(resolve,20));}
 }}catch(error){readerPromise=null;await reader.dispose().catch(()=>{});throw error;}
 return attempts;
}
