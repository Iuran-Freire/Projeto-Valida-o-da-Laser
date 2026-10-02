import {parseLGQR} from './lg-label.mjs';

export const LG_PSU_28W_ID='lg-psu-28w';
export const LG_PSU_28W_LABEL='U01006R - LG PSU 28W';
export const LG_PSU_PART_NO='65899206';
const printedPattern=/I[A-HJK][1-9OND][1-9A-HJ-NP-X][1-9][0-9]{8}(?:[0-9]{4}|[A-Z][0-9]{3})/g;

export function extractLGPSUPrinted(raw){
 const source=String(raw||'').toUpperCase().replace(/\s+/g,'');
 const matches=[...source.matchAll(printedPattern)].map(item=>item[0]);
 const unique=[...new Set(matches)];
 return unique.length===1?unique[0]:'';
}

export function inspectLGPSULabel(barcodeRaw,printedRaw,reliable=false,confirmed=false){
 const barcode=parseLGQR(barcodeRaw),printedCode=extractLGPSUPrinted(printedRaw),printed=parseLGQR(printedCode),issues=[];
 if(barcode.text&&!barcode.valid)issues.push(...barcode.issues.map(issue=>'Code 93: '+issue.replace('O QR','O código')));
 if(String(printedRaw||'').trim()&&!printedCode)issues.push('Texto impresso: não foi identificado um código único de 17 caracteres.');
 if(printedCode&&!printed.valid)issues.push(...printed.issues.map(issue=>'Texto impresso: '+issue));
 if(barcode.partNo&&barcode.partNo!==LG_PSU_PART_NO)issues.push('Code 93: Part No. '+barcode.partNo+'; esperado '+LG_PSU_PART_NO+'.');
 if(printed.partNo&&printed.partNo!==LG_PSU_PART_NO)issues.push('Texto impresso: Part No. '+printed.partNo+'; esperado '+LG_PSU_PART_NO+'.');
 if(barcode.valid&&printed.valid&&barcode.text!==printed.text)issues.push('Code 93 '+barcode.text+' ≠ texto impresso '+printed.text+'.');
 const missing=[];
 if(!barcode.text)missing.push('Code 93');
 if(!String(printedRaw||'').trim())missing.push('texto impresso');
 if(printed.valid&&!reliable&&!confirmed)missing.push('conferência manual do texto');
 const status=issues.length?'DIVERGENTE':missing.length?'PENDENTE':'COINCIDE';
 return {barcode,printed,issues,missing,status,reason:issues.join(' ')||(missing.length?'Pendente: '+missing.join(', ')+'.':'Code 93 e texto impresso coincidem em todas as 17 posições.')};
}
