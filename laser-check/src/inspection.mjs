import {compare,extractPrint} from './compare.mjs';
import {validateSerialPositions,checkCodeShift,checkSecCode,usesProfile,SHIFT_LABELS} from './serial-profile.mjs';
// OCR candidates are selected without consulting the barcode's expected serial.
export function selectOCR(attempts,profileEnabled=false){
  const score=attempt=>{const serial=extractPrint(attempt.text).serial;return [Number(!!serial),Number(profileEnabled&&!!serial&&validateSerialPositions(serial).valid),Math.min(attempt.text.length,100),attempt.confidence]};
  const ranked=[...attempts].sort((a,b)=>{const x=score(a),y=score(b);return y[0]-x[0]||y[1]-x[1]||y[2]-x[2]||y[3]-x[3]});
  const best=ranked[0]||{text:'',confidence:0};
  const serial=extractPrint(best.text).serial;
  const reliable=!!serial&&attempts.length>=2&&attempts.every(a=>extractPrint(a.text).serial===serial&&a.confidence>=80);
  return {...best,reliable};
}
export function inspect(qr,ocr,reliable,visuallyConfirmed=false,shift=''){
  const result=compare(qr,ocr);
  const partCheck=checkSecCode(qr);
  const partMismatch=partCheck.status==='mismatch';
  const codeCheck=usesProfile(qr)&&result.code.serial?validateSerialPositions(result.code.serial):null;
  const invalidCode=!!codeCheck&&!codeCheck.valid;
  const shiftCheck=checkCodeShift(qr,result.code.serial,shift);
  const shiftMismatch=shiftCheck.status==='mismatch';
  const shiftUnsupported=shiftCheck.status==='unsupported';
  const ambiguousI=!!(result.profile?.codeValid&&result.code.serial?.[11]==='I'&&result.print.serial?.[11]==='1');
  const onlyAmbiguousI=ambiguousI&&result.profile.positions.every(item=>item.position===12||item.match)&&result.profile.printIssues.every(issue=>issue.startsWith('posição 12 '));
  const profileIssue=result.profile?[...result.profile.codeIssues.map(x=>'Código 2D: '+x),...result.profile.printIssues.map(x=>'Tampografia: '+x)].join('; '):'';
  const codeOnlyIssue=!result.profile&&invalidCode?codeCheck.issues.map(x=>'Código 2D: '+x).join('; ')+'. ':'';
  const pending=!result.code.serial||!result.print.serial||!reliable&&!visuallyConfirmed||onlyAmbiguousI&&!visuallyConfirmed||shiftUnsupported;
  const firstDifference=result.profile?.positions.find(item=>!item.match);
  const swapIssue=result.profile?.swappedDayShift?`Possível troca entre dia de fabricação (posição 6) e turno (posição 7): código ${result.code.serial[5]}${result.code.serial[6]}, tampografia ${result.print.serial[5]}${result.print.serial[6]}. `:'';
  const iIssue=ambiguousI?'O OCR leu 1 na posição 12, onde o padrão exige I. Confira esse caractere na peça. ':'';
  const partIssue=partMismatch?`SEC CODE do código 2D incorreto: esperado ${partCheck.expected}; lido ${partCheck.actual}. `:'';
  const shiftIssue=shiftMismatch?`Código 2D: ${SHIFT_LABELS[shift]} exige ${shift} na posição 7; lido ${shiftCheck.actual}. `:shiftUnsupported&&!partMismatch?'Este formato de código 2D não permite validar o turno selecionado. ':'';
  const baseReason=!result.code.serial?'Série de 14 caracteres após + não identificada no código 2D.':!result.print.serial?'Série de 14 caracteres após : não identificada na tampografia.':!reliable&&!visuallyConfirmed?`${swapIssue}${iIssue}${profileIssue?profileIssue+'. ':''}${result.status==='COINCIDE'?'As séries exibidas coincidem. O OCR não confirmou a série com confiança em todas as tentativas.':'As séries exibidas são diferentes e o OCR não confirmou a leitura com confiança.'} Confira a série na peça e marque a conferência manual.`:swapIssue+iIssue+((profileIssue||firstDifference)?profileIssue||`Diferença na posição ${firstDifference.position} (${firstDifference.meaning}): código ${firstDifference.code}, tampografia ${firstDifference.print}.`:'');
  return {...result,status:partMismatch||shiftMismatch||invalidCode?'DIVERGENTE':pending?'PENDENTE':profileIssue?'DIVERGENTE':result.status,reason:partIssue+shiftIssue+codeOnlyIssue+baseReason,rawComparison:result.status,ambiguousI,shiftCheck,partCheck};
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
