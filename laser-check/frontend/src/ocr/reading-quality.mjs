// Decide whether another OCR engine is needed, without access to barcode text.
export function confidentPrintedReadings(attempts,{extractSerial,readingParts,minConfidence=80}){
 const readings=attempts.map(item=>{
  const text=item.fullText||item.text||'';
  if(!extractSerial(text))return null;
  const parts=readingParts(text);
  if(!parts.length)return null;
  const scores=parts.map(part=>{
   const lines=(item.lines||[]).filter(line=>readingParts(line.text).includes(part));
   return lines.length?Math.max(...lines.map(line=>Number(line.confidence)||0)):Number(item.confidence)||0;
  });
  return {key:JSON.stringify(parts),score:Math.min(...scores),review:!!item.glyphReview};
 }).filter(Boolean);
 const strong=readings.filter(item=>item.score>=minConfidence&&!item.review);
 return strong.length>=2&&new Set(strong.map(item=>item.key)).size===1;
}
