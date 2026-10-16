// Locate bright printed rows by image contrast, without interpreting characters.
export function printedRowBands(pixels,width,height,{lightOnDark=true,limit=3,bottomFirst=true}={}){
 if(width<40||height<8||pixels.length!==width*height*4)return [];
 const gray=new Uint8Array(width*height),hist=new Uint32Array(256);
 for(let p=0;p<gray.length;p++){const i=p*4,brightness=Math.round(.299*pixels[i]+.587*pixels[i+1]+.114*pixels[i+2]),g=lightOnDark?brightness:255-brightness;gray[p]=g;hist[g]++;}
 let threshold=0,count=0;while(threshold<255&&(count+=hist[threshold])<gray.length*.82)threshold++;
 let brightest=255;while(brightest>0&&!hist[brightest])brightest--;
 if(threshold>=brightest)threshold=Math.max(0,brightest-1);
 const rows=Array.from({length:height},(_,y)=>{let n=0;for(let x=0;x<width;x++)if(gray[y*width+x]>threshold)n++;return n;});
 const sorted=[...rows].sort((a,b)=>a-b),base=sorted[Math.floor(height*.2)],peak=Math.max(...rows);
 if(peak-base<width*.025)return [];
 const smooth=rows.map((_,y)=>(rows[Math.max(0,y-1)]+rows[y]+rows[Math.min(height-1,y+1)])/3);
 const cutoff=base+(peak-base)*.3,runs=[];let start=-1,last=-1;
 for(let y=0;y<=height+9;y++){
  const value=y<height?smooth[y]:0;
  if(value>cutoff){if(start<0)start=y;last=y;}
  else if(start>=0&&y-last>8){if(last-start>=5)runs.push([Math.max(0,start-3),Math.min(height,last+4)]);start=-1;}
 }
 // A narrow dark gap can separate two complete lines, even when the earlier
 // grouping joined them. Require substantial strokes on both sides so holes
 // inside letters do not split a single printed line.
 const separate=([top,bottom],depth=0)=>{
  if(depth>=3)return [[top,bottom]];
  let split=-1,best=1;
  for(let y=top+10;y<bottom-10;y++){
   const left=smooth.slice(Math.max(top,y-15),y),right=smooth.slice(y+1,Math.min(bottom,y+16));
   const a=Math.max(...left),b=Math.max(...right),value=smooth[y];
   if(a<=base||b<=base||value>=Math.min(a,b)*.15)continue;
   if(left.filter(n=>n>a*.5).length<10||right.filter(n=>n>b*.5).length<10)continue;
   const ratio=value/Math.min(a,b);if(ratio<best){best=ratio;split=y;}
  }
  return split<0?[[top,bottom]]:[...separate([top,split+2],depth+1),...separate([split-2,bottom],depth+1)];
 };
 const bands=runs.flatMap(run=>separate(run)).map(([top,bottom])=>{
  const cols=Array.from({length:width},(_,x)=>{let n=0;for(let y=top;y<bottom;y++)if(gray[y*width+x]>threshold)n++;return n;});
  const minimum=Math.max(2,Math.max(...cols)*.22);let left=cols.findIndex(n=>n>=minimum),right=width-1;
  while(right>=0&&cols[right]<minimum)right--;
  left=Math.max(0,left-4);right=Math.min(width,right+Math.max(5,2*(bottom-top)));
  return {x:left,y:top,w:right-left,h:bottom-top};
 }).filter(b=>b.w>40&&b.w/b.h>=4);
 return (bottomFirst?bands.reverse():bands).slice(0,limit);
}
