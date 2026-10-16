import {serialTensor} from './serial-recognition.mjs';
import {serialRegion} from './serial-region.mjs';
import {samsungSerialCandidate,samsungSerialSample} from './samsung-serial.mjs';
import {printedRowBands} from './line-bands.mjs';
import {extractPrint} from '../../../shared/validation/compare.mjs';
import {enhanceGlyphPixels,glyphRefinementIndexes,markGlyphReview} from './glyph-review.mjs';

function visualRegions(source,region,options){
 if(!region)return [];
 const canvas=document.createElement('canvas'),scale=Math.min(1,1200/Math.max(region.w,region.h));
 canvas.width=Math.max(1,Math.round(region.w*scale));canvas.height=Math.max(1,Math.round(region.h*scale));
 try{
  const ctx=canvas.getContext('2d',{willReadFrequently:true});
  ctx.drawImage(source,region.x,region.y,region.w,region.h,0,0,canvas.width,canvas.height);
  return printedRowBands(ctx.getImageData(0,0,canvas.width,canvas.height).data,canvas.width,canvas.height,{
   lightOnDark:options.lightOnDark,limit:options.maxLines||10,bottomFirst:!!options.allowUnlabelledSerial,
  }).map(b=>{
   const x=Math.max(0,Math.floor(region.x+b.x/scale)),y=Math.max(0,Math.floor(region.y+b.y/scale));
   return {x,y,w:Math.min(source.width-x,Math.ceil(b.w/scale)),h:Math.min(source.height-y,Math.ceil(b.h/scale))};
  });
 }finally{canvas.width=0;canvas.height=0;}
}

export function refinementRegions(attempts,source,options={}){
 const regions=[];
 for(const attempt of attempts){
  const region=serialRegion(attempt,attempt.region,attempt.inputWidth,source,{wholeLine:true,extractSerial:options.extractSerial||samsungSerialCandidate});
  if(!region)continue;
  if(regions.some(other=>Math.abs(other.x-region.x)<20&&Math.abs(other.y-region.y)<15))continue;
  regions.push(region);if(regions.length===2)break;
 }
 return regions;
}

export async function refinePrintedSerial(source,attempts,onProgress,region,options={}){
 const extractSerial=options.extractSerial||(text=>extractPrint(text).serial);
 const detected=refinementRegions(attempts,source,options);
 // A weak OCR result can also have a bad bounding box. Locate rows afresh from
 // the photographed region rather than inheriting that reader's failed crop.
 const visual=options.preferVisual||!detected.length?visualRegions(source,region,options):[];
 const regions=visual.length?visual:detected;
 if(!regions.length)return [];
 const worker=new Worker(new URL(__SERIAL_WORKER__,document.baseURI),{type:'module'});
 const results=[];
 const recognize=async(region,invert,variant)=>{
  let stretch=1;
  if(variant?.startsWith('margem-')){
   const pad=Math.max(2,Math.ceil(region.h*.1)),y=Math.max(0,region.y-pad),bottom=Math.min(source.height,region.y+region.h+pad);
   region={...region,y,h:bottom-y};stretch=variant==='margem-compacta'?0.8:1.2;
  }
  const canvas=document.createElement('canvas');
  canvas.width=Math.min(1600,Math.ceil(48*region.w/region.h*stretch));canvas.height=48;
  try{
   const ctx=canvas.getContext('2d',{willReadFrequently:true});
   ctx.drawImage(source,region.x,region.y,region.w,region.h,0,0,canvas.width,48);
   let pixels=ctx.getImageData(0,0,canvas.width,48).data;
   if(variant)pixels=enhanceGlyphPixels(pixels,canvas.width,48,variant.startsWith('margem-')?'contraste':variant);
   if(invert)for(let i=0;i<pixels.length;i+=4){pixels[i]=255-pixels[i];pixels[i+1]=255-pixels[i+1];pixels[i+2]=255-pixels[i+2];}
   const input=serialTensor(pixels,canvas.width,48);
   const result=await new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>reject(new Error('O leitor da série demorou a responder.')),45000);
    worker.onmessage=({data})=>{clearTimeout(timer);data.ok?resolve(data.result):reject(new Error(data.error));};
    worker.onerror=event=>{clearTimeout(timer);reject(new Error('Falha no leitor da série: '+String(event.message||'não foi possível iniciar o processamento').slice(0,180)));};
    worker.postMessage({tensor:input.data,dims:input.dims,quantized:!!options.quantized},[input.data.buffer]);
   });
   return {text:result.text,confidence:Math.round(result.score*100),glyphs:result.glyphs,
    poly:[[region.x,region.y],[region.x+region.w,region.y],[region.x+region.w,region.y+region.h],[region.x,region.y+region.h]]};
  }finally{canvas.width=0;canvas.height=0;}
 };
 const append=(lines,variant)=>{
  const fullText=lines.map(line=>line.text).join('\n'),candidates=lines.filter(line=>extractSerial(line.text));
  const chosen=candidates.length===1?candidates[0]:null;
  results.push({text:chosen?.text||fullText,fullText,confidence:chosen?.confidence||0,
   lines,model:options.quantized?'en_PP-OCRv5_mobile_rec · pesos INT8':'en_PP-OCRv5_mobile_rec',weightPrecision:options.quantized?'int8':'float32',variant,region});
 };
 try{
  for(const invert of [false,true]){
   const lines=[];
   for(const region of regions){
   onProgress('Leitor alternativo · reconhecendo o texto impresso · '+(lines.length+1)+' de '+regions.length+'…');
   lines.push(await recognize(region,invert));
  }
   append(lines,invert?'linhas-invertidas':'linhas-originais');
  }
  // Reuse the stronger photographed line; never select by the barcode's text.
  const rank=item=>item.lines.reduce((sum,line)=>sum+(extractSerial(line.text)?100:0)+line.confidence/100,0);
  const best=results[1]&&rank(results[1])>rank(results[0])?results[1]:results[0];
  const indexes=glyphRefinementIndexes(best.lines,extractSerial),invert=best.variant==='linhas-invertidas';
  for(const variant of ['contraste','nitidez','margem-compacta','margem-ampla']){
   if(!indexes.length)break;
   onProgress('Leitor alternativo · conferindo I/1 e 5/S · '+variant+'…');
   const lines=[...best.lines];
   try{
    // At most three lines, processed sequentially by the existing small worker.
    for(const index of indexes)lines[index]=await recognize(regions[index],invert,variant);
    append(lines,'caracteres-'+variant);
   }catch(error){
    for(const attempt of results)attempt.refinementError=String(error?.message||error);
    break; // Keep successful original readings if the extra analysis fails.
   }
  }
 }finally{worker.terminate();}
 return markGlyphReview(results,extractSerial).map(attempt=>options.allowUnlabelledSerial?samsungSerialSample(attempt):attempt);
}
