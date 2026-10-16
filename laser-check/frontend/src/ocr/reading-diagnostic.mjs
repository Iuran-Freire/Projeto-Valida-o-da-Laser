export function diagnosticRegion(attempts,width,height){
 const region=attempts.find(item=>item.region)?.region||{x:0,y:0,w:width,h:height};
 if(![region.x,region.y,region.w,region.h,width,height].every(Number.isFinite))return null;
 const x=Math.max(0,Math.floor(region.x)),y=Math.max(0,Math.floor(region.y));
 const right=Math.min(width,Math.ceil(region.x+region.w)),bottom=Math.min(height,Math.ceil(region.y+region.h));
 return right>x&&bottom>y?{x,y,w:right-x,h:bottom-y}:null;
}

export function readingDiagnostic({model,build,captureSource,code,printed,attempts,photo,crop,environment,message}){
 return {schema:'valida-laser-ocr/1',createdAt:new Date().toISOString(),model,build,captureSource,
  environment,photo,code,printed,message,attempts,crop};
}

// Export only on the operator's request; no diagnostic data is uploaded.
export function diagnosticCrop(photo,region){
 if(!region||region.w*region.h>1000000)return null;
 const canvas=document.createElement('canvas');canvas.width=region.w;canvas.height=region.h;
 try{
  canvas.getContext('2d').putImageData(photo,-region.x,-region.y);
  return {region,width:canvas.width,height:canvas.height,mimeType:'image/png',dataUrl:canvas.toDataURL('image/png')};
 }finally{canvas.width=0;canvas.height=0;}
}
