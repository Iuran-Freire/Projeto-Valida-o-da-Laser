const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function capabilities(track){try{return track.getCapabilities?.()||{};}catch{return {};}}
function withFocus(track,settings){
  const {advanced,focusMode,pointsOfInterest,...base}=track.getConstraints?.()||{};
  return {...base,advanced:[settings]};
}
export async function enableContinuousFocus(track){
  if(!capabilities(track).focusMode?.includes('continuous'))return false;
  try{await track.applyConstraints(withFocus(track,{focusMode:'continuous'}));return true;}catch{return false;}
}
export async function refocusCamera(track,point){
  const caps=capabilities(track),settings={};
  if(point&&caps.pointsOfInterest)settings.pointsOfInterest=[point];
  if(caps.focusMode?.includes('single-shot'))settings.focusMode='single-shot';
  else if(caps.focusMode?.includes('continuous'))settings.focusMode='continuous';
  if(!Object.keys(settings).length)return false;
  try{
    await track.applyConstraints(withFocus(track,settings));
    if(settings.focusMode==='single-shot'&&caps.focusMode?.includes('continuous')){
      await wait(450);
      if(track.readyState==='live')await enableContinuousFocus(track);
    }
    return true;
  }catch{return false;}
}
export function sharpnessScore(data,width,height){
  let total=0,count=0;
  const gray=(x,y)=>{const i=(y*width+x)*4;return .299*data[i]+.587*data[i+1]+.114*data[i+2];};
  const step=2;
  for(let y=2;y<height-2;y+=step)for(let x=2;x<width-2;x+=step){
    const center=gray(x,y);
    total+=Math.abs(4*center-gray(x-1,y)-gray(x+1,y)-gray(x,y-1)-gray(x,y+1));
    count++;
  }
  return count?total/count:0;
}
export async function captureSharpestFrame(video){
  const width=video.videoWidth,height=video.videoHeight;
  if(!width||!height)throw new Error('Aguarde a imagem da câmera.');
  if(typeof createImageBitmap!=='function')return null;
  const sample=document.createElement('canvas');sample.width=256;sample.height=Math.max(32,Math.round(256*height/width));
  const context=sample.getContext('2d',{willReadFrequently:true});
  let best=null,bestScore=-Infinity;
  try{
    for(let index=0;index<3;index++){
      if(index)await wait(180);
      const frame=await createImageBitmap(video);
      context.drawImage(frame,0,0,sample.width,sample.height);
      const score=sharpnessScore(context.getImageData(0,0,sample.width,sample.height).data,sample.width,sample.height);
      if(score>bestScore){best?.close();best=frame;bestScore=score;}else frame.close();
    }
    return best;
  }catch(error){best?.close();throw error;}
}
