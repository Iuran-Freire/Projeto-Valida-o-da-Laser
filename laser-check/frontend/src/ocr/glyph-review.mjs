// These transforms use photographed pixels only, never the expected barcode.
export function enhanceGlyphPixels(pixels,width,height,variant){
 const gray=new Uint8Array(width*height),hist=new Uint32Array(256),out=new Uint8ClampedArray(pixels.length);
 for(let p=0;p<gray.length;p++){const i=p*4;gray[p]=Math.round(.299*pixels[i]+.587*pixels[i+1]+.114*pixels[i+2]);hist[gray[p]]++;}
 let low=0,high=255,count=0;const cutoff=gray.length*.02;
 while(low<254&&(count+=hist[low])<cutoff)low++;
 count=0;while(high>low&&(count+=hist[high])<cutoff)high--;
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const p=y*width+x,g=gray[p];let value=g;
  if(variant==='contraste'&&high-low>=24)value=(g-low)*255/(high-low);
  if(variant==='nitidez'){
   const neighbours=(gray[y*width+Math.max(0,x-1)]+gray[y*width+Math.min(width-1,x+1)]+gray[Math.max(0,y-1)*width+x]+gray[Math.min(height-1,y+1)*width+x])/4;
   value=g+.6*(g-neighbours);
  }
  const i=p*4;out[i]=out[i+1]=out[i+2]=value;out[i+3]=pixels[i+3];
 }
 return out;
}

export function glyphRefinementIndexes(lines,extractSerial){
 const candidates=lines.map((line,index)=>({line,index})).filter(({line})=>/[I1S5]/.test(line.text));
 const serialLines=candidates.filter(({line})=>!!extractSerial(line.text));
 return (serialLines.length?serialLines:candidates.filter(({line})=>/[A-Z0-9]{6,}/.test(line.text))).slice(0,3).map(({index})=>index);
}

export function markGlyphReview(attempts,extractSerial){
 const candidates=attempts.map(item=>String(extractSerial(item.text)||extractSerial(item.fullText||'')||''));
 const serials=attempts.map(item=>{
  const text=item.fullText||item.text||'',serial=String(extractSerial(text)||'');
  // Also retain unparsed tokens: a mistaken glyph can make the format invalid.
  return [...new Set([...(serial?[serial]:[]),...(text.match(/[A-Z0-9]{6,}/g)||[])])];
 });
 // Only I/1 and S/5 substitutions count here; no character is corrected.
 const key=text=>text.replace(/[I1]/g,'|').replace(/[S5]/g,'$');
 const conflict=serials.some((values,i)=>values.some(serial=>serials.some((others,j)=>j!==i&&others.some(other=>other!==serial&&key(other)===key(serial)))));
 return attempts.map((item,index)=>{
  const lines=item.lines||[],relevant=glyphRefinementIndexes(lines,extractSerial).map(index=>lines[index]);
  const glyphScores=relevant.flatMap(line=>{
   const serial=String(extractSerial(line.text)||''),start=serial?line.text.indexOf(serial):-1;
   if(start<0)return [];
   const glyphs=(line.glyphs||[]).filter(glyph=>glyph.index>=start&&glyph.index<start+serial.length);
   return glyphs.length===serial.length?glyphs.map(glyph=>glyph.score):[];
  });
  const serialGlyphConfidence=glyphScores.length?Math.min(...glyphScores)*100:0;
  const uncertain=relevant.some(line=>{
   const serial=String(extractSerial(line.text)||''),start=serial?line.text.indexOf(serial):-1;
   return line.glyphs?.some(glyph=>glyph.uncertain&&(start<0||glyph.index>=start&&glyph.index<start+serial.length));
  });
  const selectionSupport=candidates[index]?candidates.filter(value=>value===candidates[index]).length:0;
  return {...item,selectionSupport,serialGlyphConfidence,...(conflict||uncertain||glyphScores.length&&serialGlyphConfidence<80?{glyphReview:true,forceManualReview:true}:{})};
 });
}
