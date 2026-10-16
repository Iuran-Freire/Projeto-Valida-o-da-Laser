export function serialTensor(pixels,width,height) {
 if(height!==48||width<1||width>1600||pixels.length!==width*height*4)throw new Error('Recorte de série inválido.');
 const paddedWidth=Math.max(320,width),plane=height*paddedWidth,data=new Float32Array(3*plane);
 for(let c=0;c<3;c++)for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  data[c*plane+y*paddedWidth+x]=pixels[(y*width+x)*4+(2-c)]/127.5-1;
 }
 return {data,dims:[1,3,height,paddedWidth]};
}

export function decodeSerial(data,dims,dictionary) {
 const [batch,steps,classes]=dims;
 if(batch!==1||classes!==dictionary.length+1||data.length!==steps*classes)throw new Error('Saída do leitor incompatível.');
 let previous=-1,text='',sum=0,count=0;const glyphs=[],pairs={I:'1','1':'I',S:'5','5':'S'};
 for(let t=0;t<steps;t++){
  let best=0;for(let c=1;c<classes;c++)if(data[t*classes+c]>data[t*classes+best])best=c;
  if(best>0){
   const char=dictionary[best-1],score=data[t*classes+best],alternative=pairs[char],alternativeIndex=alternative?dictionary.indexOf(alternative)+1:0;
   const glyph={index:text.length,char,score,...(alternativeIndex?{alternative,alternativeScore:data[t*classes+alternativeIndex]}:{})};
   if(best!==previous){text+=char;sum+=score;count++;glyphs.push(glyph);}
   else if(score>glyphs[glyphs.length-1].score)glyphs[glyphs.length-1]={...glyph,index:glyphs[glyphs.length-1].index};
  }
  previous=best;
 }
 return {text,score:count?sum/count:0,glyphs:glyphs.map(glyph=>({...glyph,uncertain:!!glyph.alternative&&(glyph.score<.85||glyph.alternativeScore>=glyph.score*.3)}))};
}
