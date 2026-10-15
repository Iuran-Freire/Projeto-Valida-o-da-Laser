import {serialTensor} from './serial-recognition.mjs';
import {serialRegion} from './serial-region.mjs';
import {samsungSerialCandidate,samsungSerialSample} from './samsung-serial.mjs';
import {printedRowBands} from './line-bands.mjs';

function visualRegions(source,region){
 if(!region)return [];
 const canvas=document.createElement('canvas'),scale=Math.min(1,1200/Math.max(region.w,region.h));
 canvas.width=Math.max(1,Math.round(region.w*scale));canvas.height=Math.max(1,Math.round(region.h*scale));
 try{
  const ctx=canvas.getContext('2d',{willReadFrequently:true});
  ctx.drawImage(source,region.x,region.y,region.w,region.h,0,0,canvas.width,canvas.height);
  return printedRowBands(ctx.getImageData(0,0,canvas.width,canvas.height).data,canvas.width,canvas.height).map(b=>{
   const x=Math.max(0,Math.floor(region.x+b.x/scale)),y=Math.max(0,Math.floor(region.y+b.y/scale));
   return {x,y,w:Math.min(source.width-x,Math.ceil(b.w/scale)),h:Math.min(source.height-y,Math.ceil(b.h/scale))};
  });
 }finally{canvas.width=0;canvas.height=0;}
}

export function refinementRegions(attempts,source){
 const regions=[];
 for(const attempt of attempts){
  const region=serialRegion(attempt,attempt.region,attempt.inputWidth,source,{wholeLine:true,extractSerial:samsungSerialCandidate});
  if(!region)continue;
  if(regions.some(other=>Math.abs(other.x-region.x)<20&&Math.abs(other.y-region.y)<15))continue;
  regions.push(region);if(regions.length===2)break;
 }
 return regions;
}

export async function refinePrintedSerial(source,attempts,onProgress,region){
 const detected=refinementRegions(attempts,source),regions=detected.length?detected:visualRegions(source,region);
 if(!regions.length)return [];
 const worker=new Worker(new URL(__SERIAL_WORKER__,document.baseURI),{type:'module'});
 const results=[];
 try{
  for(const region of regions){for(const invert of [false,true]){
   onProgress('Reconhecendo os caracteres da tampografia…');
   const canvas=document.createElement('canvas');
   canvas.width=Math.min(1600,Math.ceil(48*region.w/region.h));canvas.height=48;
   try{
    const ctx=canvas.getContext('2d',{willReadFrequently:true});
    ctx.drawImage(source,region.x,region.y,region.w,region.h,0,0,canvas.width,48);
    const pixels=ctx.getImageData(0,0,canvas.width,48).data;
    if(invert)for(let i=0;i<pixels.length;i+=4){pixels[i]=255-pixels[i];pixels[i+1]=255-pixels[i+1];pixels[i+2]=255-pixels[i+2];}
    const input=serialTensor(pixels,canvas.width,48);
    const result=await new Promise((resolve,reject)=>{
     const timer=setTimeout(()=>reject(new Error('O leitor da série demorou a responder.')),45000);
     worker.onmessage=({data})=>{clearTimeout(timer);data.ok?resolve(data.result):reject(new Error(data.error));};
     worker.onerror=event=>{clearTimeout(timer);reject(new Error('Falha no leitor da série: '+String(event.message||'não foi possível iniciar o processamento').slice(0,180)));};
     worker.postMessage({tensor:input.data,dims:input.dims},[input.data.buffer]);
    });
    const line={text:result.text,confidence:Math.round(result.score*100)};
    results.push(samsungSerialSample({text:result.text,fullText:result.text,confidence:line.confidence,
     lines:[line],model:'en_PP-OCRv5_mobile_rec',variant:invert?'linha-invertida':'linha-original',region}));
   }finally{canvas.width=0;canvas.height=0;}
  }
   const recent=results.slice(-2).map(item=>samsungSerialCandidate(item.text));
   if(recent.length===2&&recent[0]&&recent[0]===recent[1])break;
  }
 }finally{worker.terminate();}
 return results;
}
