import {compare,extractPrint} from './compare.mjs';
import {validateSerialPositions,checkCodeShift,checkSecCode,usesProfile,SHIFT_LABELS,DEFAULT_MODEL,getModelProfile} from './serial-profile.mjs';
// OCR candidates are selected without consulting the barcode's expected serial.
export function selectOCR(attempts,profileEnabled=false){
  const model=typeof profileEnabled==='string'?profileEnabled:DEFAULT_MODEL;
  const score=attempt=>{const serial=extractPrint(attempt.text).serial;return [Number(!!serial),Number(profileEnabled&&!!serial&&validateSerialPositions(serial,model).valid),Math.min(attempt.text.length,100),attempt.confidence]};
  const ranked=[...attempts].sort((a,b)=>{const x=score(a),y=score(b);return y[0]-x[0]||y[1]-x[1]||y[2]-x[2]||y[3]-x[3]});
  const best=ranked[0]||{text:'',confidence:0};
  const serial=extractPrint(best.text).serial;
  const reliable=!!serial&&attempts.length>=2&&attempts.every(a=>extractPrint(a.text).serial===serial&&a.confidence>=80)&&(!profileEnabled||validateSerialPositions(serial,model).valid);
  return {...best,reliable};
}
export function inspect(qr,ocr,reliable,visuallyConfirmed=false,shift='',model=DEFAULT_MODEL){
  const result=compare(qr,ocr,model);
  const partCheck=checkSecCode(qr,model);
  const partMismatch=partCheck.status==='mismatch';
  const codeCheck=usesProfile(qr,model)&&result.code.serial?validateSerialPositions(result.code.serial,model):null;
  const invalidCode=!!codeCheck&&!codeCheck.valid;
  const shiftCheck=checkCodeShift(qr,result.code.serial,shift,model);
  const shiftMismatch=shiftCheck.status==='mismatch';
  const shiftUnsupported=shiftCheck.status==='unsupported';
  const ambiguousI=!!(result.profile?.codeValid&&result.code.serial?.[11]==='I'&&result.print.serial?.[11]==='1');
  const onlyAmbiguousI=ambiguousI&&result.profile.positions.every(item=>item.position===12||item.match)&&result.profile.printIssues.every(issue=>issue.startsWith('posição 12 '));
  const ambiguousOIndexes=result.profile?.codeValid?result.profile.positions.filter(item=>item.code==='0'&&item.print==='O').map(item=>item.position-1):[];
  const ambiguousO=ambiguousOIndexes.length>0;
  const onlyAmbiguousO=ambiguousO&&result.profile.positions.every(item=>item.match||ambiguousOIndexes.includes(item.position-1))&&result.profile.printIssues.every(issue=>ambiguousOIndexes.some(index=>issue.startsWith(`posição ${index+1} `)));
  const ocrAmbiguity=ambiguousI?{index:11,position:12,read:'1',expected:'I'}:ambiguousOIndexes.length===1?{index:ambiguousOIndexes[0],position:ambiguousOIndexes[0]+1,read:'O',expected:'0'}:null;
  const profileIssue=result.profile?[...result.profile.codeIssues.map(x=>'Código 2D: '+x),...result.profile.printIssues.map(x=>'Tampografia: '+x)].join('; '):'';
  const codeOnlyIssue=!result.profile&&invalidCode?codeCheck.issues.map(x=>'Código 2D: '+x).join('; ')+'. ':'';
  const pending=!result.code.serial||!result.print.serial||!reliable&&!visuallyConfirmed||(onlyAmbiguousI||onlyAmbiguousO)&&!visuallyConfirmed||shiftUnsupported;
  const firstDifference=result.profile?.positions.find(item=>!item.match);
  const swapIssue=result.profile?.swappedDayShift?`Possível troca entre dia de fabricação (posição 6) e turno (posição 7): código ${result.code.serial[5]}${result.code.serial[6]}, tampografia ${result.print.serial[5]}${result.print.serial[6]}. `:'';
  const iIssue=ambiguousI?'O OCR leu 1 na posição 12, onde o padrão exige I. Confira esse caractere na peça. ':'';
  const oIssue=ambiguousO?`O OCR leu O na posição ${ambiguousOIndexes.map(index=>index+1).join(', ')}, onde o código 2D traz 0. O não é permitido nessa posição. Confira o caractere na peça. `:'';
  const partIssue=partMismatch?`SEC CODE do código 2D incorreto: esperado ${partCheck.expected}; lido ${partCheck.actual}. `:'';
  const shiftIssue=shiftMismatch?`Código 2D: ${SHIFT_LABELS[shift]} exige ${shift} na posição 7; lido ${shiftCheck.actual}. `:shiftUnsupported&&!partMismatch?'Este formato de código 2D não permite validar o turno selecionado. ':'';
  const baseReason=!result.code.serial?'Série de 14 caracteres após + não identificada no código 2D.':!result.print.serial?'Série de 14 caracteres após : não identificada na tampografia.':!reliable&&!visuallyConfirmed?`${swapIssue}${iIssue}${oIssue}${profileIssue?profileIssue+'. ':''}${result.status==='COINCIDE'?'As séries exibidas coincidem. O OCR não confirmou a série com confiança em todas as tentativas.':'As séries exibidas são diferentes e o OCR não confirmou a leitura com confiança.'} Confira a série na peça e marque a conferência manual.`:swapIssue+iIssue+oIssue+((profileIssue||firstDifference)?profileIssue||`Diferença na posição ${firstDifference.position} (${firstDifference.meaning}): código ${firstDifference.code}, tampografia ${firstDifference.print}.`:'');
  return {...result,status:partMismatch||shiftMismatch||invalidCode?'DIVERGENTE':pending?'PENDENTE':profileIssue?'DIVERGENTE':result.status,reason:partIssue+shiftIssue+codeOnlyIssue+baseReason,rawComparison:result.status,ambiguousI,ambiguousO,ocrAmbiguity,shiftCheck,partCheck};
}
export function nearbyRegion(position,width,height,model=DEFAULT_MODEL){
  if(!position)return {x:0,y:0,w:width,h:height};
  const points=Object.values(position).filter(p=>Number.isFinite(p?.x)&&Number.isFinite(p?.y));
  if(points.length<4)return {x:0,y:0,w:width,h:height};
  const xs=points.map(p=>p.x),ys=points.map(p=>p.y),left=Math.min(...xs),top=Math.min(...ys),right=Math.max(...xs),bottom=Math.max(...ys);
  const size=Math.max(right-left,bottom-top);
  if(getModelProfile(model).layout==='above'){
    // 15W VE: a linha NÚMERO DE SÉRIE está imediatamente acima do Data Matrix.
    const x=Math.max(0,Math.floor(left-.2*size)),y=Math.max(0,Math.floor(top-.55*size));
    const w=Math.min(width-x,Math.ceil(3.5*size)),h=Math.min(height-y,Math.ceil(top+.08*size-y));
    return w>40&&h>8?{x,y,w,h}:{x:0,y:0,w:width,h:height};
  }
  // Adapter layout supplied by the user: serial line below and to the left of the matrix.
  // Only geometry is used here; the barcode payload never supplies OCR characters.
  const x=Math.max(0,Math.floor(left-4.5*size)),y=Math.max(0,Math.floor(bottom+.28*size));
  if(y>=height-10)return {x:0,y:0,w:width,h:height};
  return {x,y,w:Math.min(width-x,Math.ceil(right+.3*size-x)),h:Math.min(height-y,Math.ceil(.62*size))};
}
