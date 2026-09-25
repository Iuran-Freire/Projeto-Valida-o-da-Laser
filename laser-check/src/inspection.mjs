import {compare,extractPrint} from './compare.mjs';
// OCR candidates are selected without consulting the barcode's expected serial.
export function selectOCR(attempts){
  const ranked=[...attempts].sort((a,b)=>Number(!!extractPrint(b.text).serial)-Number(!!extractPrint(a.text).serial)||b.confidence-a.confidence);
  const best=ranked[0]||{text:'',confidence:0};
  const serial=extractPrint(best.text).serial;
  const reliable=!!serial&&attempts.length>=2&&attempts.every(a=>extractPrint(a.text).serial===serial&&a.confidence>=80);
  return {...best,reliable};
}
export function inspect(qr,ocr,reliable,visuallyConfirmed=false){
  const result=compare(qr,ocr);
  const reason=!result.code.serial?'Código 2D não identificado.':!result.print.serial?'Número da tampografia não identificado.':!reliable&&!visuallyConfirmed?'OCR sem confiança suficiente ou com leituras inconsistentes.':'';
  return {...result,status:reason?'PENDENTE':result.status,reason,rawComparison:result.status};
}
export function nearbyRegion(position,width,height){
  if(!position)return {x:0,y:0,w:width,h:height};
  const points=Object.values(position).filter(p=>Number.isFinite(p?.x)&&Number.isFinite(p?.y));
  if(points.length<4)return {x:0,y:0,w:width,h:height};
  const xs=points.map(p=>p.x),ys=points.map(p=>p.y),left=Math.min(...xs),top=Math.min(...ys),right=Math.max(...xs),bottom=Math.max(...ys);
  const size=Math.max(right-left,bottom-top);
  // Adapter layout supplied by the user: serial line below and to the left of the matrix.
  // Only geometry is used here; the barcode payload never supplies OCR characters.
  const x=Math.max(0,Math.floor(left-4.5*size)),y=Math.max(0,Math.floor(bottom+.28*size));
  if(y>=height-10)return {x:0,y:0,w:width,h:height};
  return {x,y,w:Math.min(width-x,Math.ceil(right+.3*size-x)),h:Math.min(height-y,Math.ceil(.62*size))};
}
