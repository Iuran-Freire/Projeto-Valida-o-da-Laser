// Lightweight, advisory visual check for the photographed TYPE C print.
// The barcode and serial are variable and are excluded from template comparison.
const WIDTH=485,HEIGHT=390,LOGO_WIDTH=740,LOGO_HEIGHT=200;
const REFERENCE_POSITION={topLeft:{x:411,y:465},topRight:{x:496,y:464},bottomRight:{x:497,y:549},bottomLeft:{x:412,y:550}};
let referencePromise;

function bounds(position){
  const points=Object.values(position||{});
  if(points.length<4||points.some(point=>!Number.isFinite(point?.x)||!Number.isFinite(point?.y)))return null;
  const left=Math.min(...points.map(point=>point.x)),top=Math.min(...points.map(point=>point.y));
  const right=Math.max(...points.map(point=>point.x)),bottom=Math.max(...points.map(point=>point.y));
  const side=(right-left+bottom-top)/2;
  return {left,top,side};
}
function canvas(width,height){const result=document.createElement('canvas');result.width=width;result.height=height;return result;}
function normalized(source,position,width,height,logo=false){
  const box=bounds(position);if(!box||box.side<60)return null;
  const sx=box.left-3.75*box.side,sy=box.top-1.25*box.side;
  const sw=(logo?3.7:4.85)*box.side,sh=(logo?1:3.9)*box.side;
  if(sx<0||sy<0||sx+sw>source.width||sy+sh>source.height)return null;
  const output=canvas(width,height);output.getContext('2d',{willReadFrequently:true}).drawImage(source,sx,sy,sw,sh,0,0,width,height);
  return {image:output,source:{x:sx,y:sy,w:sw,h:sh}};
}
function mask(source){
  const {width,height}=source,image=source.getContext('2d',{willReadFrequently:true}).getImageData(0,0,width,height);
  const gray=new Uint8Array(width*height),hist=new Uint32Array(256);
  for(let p=0;p<gray.length;p++){
    const i=p*4,value=Math.round(.299*image.data[i]+.587*image.data[i+1]+.114*image.data[i+2]);
    gray[p]=value;hist[value]++;
  }
  const total=gray.length,sum=hist.reduce((acc,count,value)=>acc+count*value,0);
  let lowCount=0,lowSum=0,best=-1,threshold=127;
  for(let value=0;value<256;value++){
    lowCount+=hist[value];lowSum+=hist[value]*value;
    if(!lowCount||lowCount===total)continue;
    const score=(sum*lowCount-lowSum*total)**2/(lowCount*(total-lowCount));
    if(score>best){best=score;threshold=value;}
  }
  const ink=new Uint8Array(gray.length);let bright=0,dark=0,brightCount=0,darkCount=0;
  for(let p=0;p<gray.length;p++){
    ink[p]=Number(gray[p]>threshold);
    if(ink[p]){bright+=gray[p];brightCount++;}else{dark+=gray[p];darkCount++;}
  }
  return {ink,width,height,contrast:bright/Math.max(1,brightCount)-dark/Math.max(1,darkCount)};
}
function fixed(x,y){return !(x>=375&&y>=120&&y<240)&&!(x>=175&&x<375&&y>=280&&y<320);}
function alignment(reference,candidate){
  let best={score:-1,dx:0,dy:0};
  for(let dy=-8;dy<=8;dy++)for(let dx=-8;dx<=8;dx++){
    let overlap=0,union=0;
    for(let y=6;y<HEIGHT-6;y+=3)for(let x=6;x<WIDTH-6;x+=3){
      if(!fixed(x,y))continue;
      const a=reference[y*WIDTH+x],b=candidate[(y-dy)*WIDTH+x-dx];
      if(a&&b)overlap++;if(a||b)union++;
    }
    const score=overlap/Math.max(1,union);
    if(score>best.score)best={score,dx,dy};
  }
  return best;
}
function components(binary,width,height,minX=0,maxX=width,minY=0,maxY=height){
  const visited=new Uint8Array(binary.length),found=[];
  for(let y=minY;y<maxY;y++)for(let x=minX;x<maxX;x++){
    const first=y*width+x;if(!binary[first]||visited[first])continue;
    let left=x,right=x,top=y,bottom=y,count=0;
    const stack=[first];visited[first]=1;
    while(stack.length){
      const index=stack.pop(),px=index%width,py=(index/width)|0;count++;
      left=Math.min(left,px);right=Math.max(right,px);top=Math.min(top,py);bottom=Math.max(bottom,py);
      for(let ny=Math.max(minY,py-1);ny<=Math.min(maxY-1,py+1);ny++)for(let nx=Math.max(minX,px-1);nx<=Math.min(maxX-1,px+1);nx++){
        const next=ny*width+nx;if(binary[next]&&!visited[next]){visited[next]=1;stack.push(next);}
      }
    }
    found.push({count,x:left,y:top,w:right-left+1,h:bottom-top+1});
  }
  return found.sort((a,b)=>b.count-a.count);
}
function missingInk(reference,candidate,shift){
  const missing=new Uint8Array(WIDTH*HEIGHT);
  for(let y=1;y<HEIGHT-1;y++)for(let x=1;x<WIDTH-1;x++){
    if(!fixed(x,y)||!reference[y*WIDTH+x])continue;
    let nearby=false;
    for(let oy=-1;oy<=1&&!nearby;oy++)for(let ox=-1;ox<=1;ox++){
      const nx=x-shift.dx+ox,ny=y-shift.dy+oy;
      if(nx>=0&&nx<WIDTH&&ny>=0&&ny<HEIGHT&&candidate[ny*WIDTH+nx]){nearby=true;break;}
    }
    if(!nearby)missing[y*WIDTH+x]=1;
  }
  return missing;
}
function extraInk(reference,candidate,shift){
  const extra=new Uint8Array(WIDTH*HEIGHT);
  for(let y=8;y<HEIGHT-8;y++)for(let x=8;x<WIDTH-8;x++){
    // Ignore the edge of the variable barcode/serial masks and of the photo.
    if(!fixed(x-3,y-3)||!fixed(x+3,y+3))continue;
    const cx=x-shift.dx,cy=y-shift.dy;
    if(cx<0||cx>=WIDTH||cy<0||cy>=HEIGHT||!candidate[cy*WIDTH+cx])continue;
    let expectedNearby=false;
    for(let oy=-2;oy<=2&&!expectedNearby;oy++)for(let ox=-2;ox<=2;ox++){
      if(reference[(y+oy)*WIDTH+x+ox]){expectedNearby=true;break;}
    }
    if(!expectedNearby)extra[y*WIDTH+x]=1;
  }
  return extra;
}
function maxFilter(input,width,height,radius){
  const result=new Uint8Array(input.length);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    let value=0;
    for(let oy=-radius;oy<=radius&&!value;oy++)for(let ox=-radius;ox<=radius;ox++){
      const nx=x+ox,ny=y+oy;
      if(nx>=0&&nx<width&&ny>=0&&ny<height&&input[ny*width+nx]){value=1;break;}
    }
    result[y*width+x]=value;
  }
  return result;
}
function minFilter(input,width,height,radius){
  const result=new Uint8Array(input.length);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    let value=1;
    for(let oy=-radius;oy<=radius&&value;oy++)for(let ox=-radius;ox<=radius;ox++){
      const nx=x+ox,ny=y+oy;
      if(nx<0||nx>=width||ny<0||ny>=height||!input[ny*width+nx]){value=0;break;}
    }
    result[y*width+x]=value;
  }
  return result;
}
function thinCracks(logo){
  const {ink,width,height}=logo,dilated=maxFilter(ink,width,height,2),closed=minFilter(dilated,width,height,2);
  const gaps=new Uint8Array(ink.length);
  for(let i=0;i<gaps.length;i++)gaps[i]=Number(closed[i]&&!ink[i]);
  return components(gaps,width,height,5,width-5,5,height-5)
    .filter(item=>item.count>=60&&item.w>=10&&item.h>=10);
}
function mapRegion(region,normal){return {x:Math.round(normal.source.x+region.x*normal.source.w/normal.image.width),y:Math.round(normal.source.y+region.y*normal.source.h/normal.image.height),w:Math.round(region.w*normal.source.w/normal.image.width),h:Math.round(region.h*normal.source.h/normal.image.height)};}
async function reference(){
  if(!referencePromise)referencePromise=(async()=>{
    const image=new Image();image.src=new URL('./reference/type-c-boa.png',document.baseURI).href;await image.decode();
    const normal=normalized(image,REFERENCE_POSITION,WIDTH,HEIGHT);
    if(!normal)throw new Error('Referência visual inválida.');
    return mask(normal.image);
  })().catch(error=>{referencePromise=null;throw error});
  return referencePromise;
}
export async function analyzeVisualPrint(photo,position,model){
  if(model!=='type-c')return {status:'indisponivel',reason:'Análise visual do 15W VE ainda não calibrada.'};
  const normal=normalized(photo,position,WIDTH,HEIGHT),logo=normalized(photo,position,LOGO_WIDTH,LOGO_HEIGHT,true);
  if(!normal||!logo)return {status:'inconclusivo',reason:'Enquadre a tampografia inteira, com o código 2D nítido, e tire outra foto.'};
  const observed=mask(normal.image),logoMask=mask(logo.image);
  if(observed.contrast<60||logoMask.contrast<60)return {status:'inconclusivo',reason:'A impressão está com pouco contraste na foto. Melhore a luz ou o foco e fotografe novamente.'};
  const expected=await reference(),shift=alignment(expected.ink,observed.ink);
  if(shift.score<.6)return {status:'inconclusivo',reason:'Não foi possível alinhar toda a tampografia ao padrão. Confira o modelo e tire outra foto.'};
  const missing=missingInk(expected.ink,observed.ink,shift);
  const large=components(missing,WIDTH,HEIGHT,1,374,1,HEIGHT-1).find(item=>item.count>=120);
  const extra=components(extraInk(expected.ink,observed.ink,shift),WIDTH,HEIGHT)
    .find(item=>item.count>=20&&item.w>=3&&item.h>=3);
  const crack=thinCracks(logoMask)[0];
  if(large)return {status:'suspeita',reason:'Possível risco ou trecho sem tinta na tampografia. Confira a área marcada na foto.',kind:'falha-de-impressao',region:mapRegion(large,normal),score:large.count};
  if(extra)return {status:'suspeita',reason:'Possível borrão ou excesso de tinta na tampografia. Confira a área marcada na foto.',kind:'excesso-de-tinta',region:mapRegion(extra,normal),score:extra.count};
  if(crack)return {status:'suspeita',reason:'Possível risco fino nas letras SAMSUNG. Confira a área marcada na foto.',kind:'risco-fino',region:mapRegion(crack,logo),score:crack.count};
  return {status:'sem-suspeita',reason:'Nenhuma falha visual evidente encontrada nesta foto. Confirme a peça antes de registrar.'};
}
