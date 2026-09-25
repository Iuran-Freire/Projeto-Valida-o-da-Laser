import {PaddleOCR} from '@paddleocr/paddleocr-js';
import {extractPrint} from './compare.mjs';
const url=p=>new URL(p,document.baseURI).href;
function cropCanvas(source,region,contrast=false,lightOnDark=false){
 const c=document.createElement('canvas');const scale=Math.min(3,1800/region.w);
 c.width=Math.round(region.w*scale);c.height=Math.round(region.h*scale);
 const ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(source,region.x,region.y,region.w,region.h,0,0,c.width,c.height);
 if(contrast){const image=ctx.getImageData(0,0,c.width,c.height),d=image.data;
  for(let i=0;i<d.length;i+=4){const g=.299*d[i]+.587*d[i+1]+.114*d[i+2];const v=Math.max(0,Math.min(255,(g-30)*1.5));d[i]=d[i+1]=d[i+2]=lightOnDark?255-v:v;}ctx.putImageData(image,0,0);
 }return c;
}
function sample(items,model,variant,region){
 const lines=items.map(i=>({text:i.text,confidence:Math.round(i.score*100),poly:i.poly}));
 const candidates=lines.filter(i=>extractPrint(i.text).serial);
 const labelled=lines.filter(i=>/N[ÚUÜO]MERO\s*DE\s*S[ÉE]RIE/i.test(i.text));
 const chosen=candidates.length===1?candidates[0]:labelled.length===1?labelled[0]:null;
 return {text:chosen?.text||lines.map(i=>i.text).join('\n'),fullText:lines.map(i=>i.text).join('\n'),confidence:chosen?.confidence||0,model,variant,region,lines};
}
export async function readPrintedSerial(source,region,onProgress,lightOnDark=false){
 const attempts=[];
 for(const [model,file] of [['PP-OCRv6_small_rec','rec-v6.tar'],['PP-OCRv5_mobile_rec','rec.tar']]){
  onProgress('Preparando leitor '+(model.includes('v6')?'1':'2')+' de 2…');
  let engine;
  try{
   engine=await PaddleOCR.create({textDetectionModelName:'PP-OCRv5_mobile_det',textRecognitionModelName:model,textDetectionModelAsset:{url:url('./vendor/paddle/det.tar')},textRecognitionModelAsset:{url:url('./vendor/paddle/'+file)},worker:true,ortOptions:{backend:'wasm',numThreads:1,wasmPaths:url('./vendor/paddle/')}});
   for(const contrast of [false,true]){
    onProgress('Lendo a linha da série · '+(attempts.length+1)+' de 4…');
    const input=cropCanvas(source,region,contrast,lightOnDark);
    const [result]=await engine.predict(input,{textRecScoreThresh:0,textDetLimitSideLen:1280,textDetLimitType:'max',textDetBoxThresh:.4});
    attempts.push(sample(result.items,model,contrast?'contraste':'original',region));
   }
  }finally{await engine?.dispose();}
 }
 return attempts;
}
