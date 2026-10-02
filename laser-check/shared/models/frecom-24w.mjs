export const FRECOM_24W_ID='frecom-24w';
export const FRECOM_24W_LABEL='33K0008 - Frecom 24W';
export function parseFrecomCode(raw){
  const text=String(raw||'').trim().toUpperCase();
  const issues=[];
  if(!text)return {text,valid:false,year:null,week:null,sequence:null,issues};
  if(!/^I[0-9]{9}$/.test(text))issues.push('O código precisa ter I fixo e mais nove dígitos (IYYWWNNNNN).');
  const year=/^I[0-9]{2}/.test(text)?2000+Number(text.slice(1,3)):null;
  const week=/^I[0-9]{4}/.test(text)?Number(text.slice(3,5)):null;
  const sequence=/^I[0-9]{9}$/.test(text)?Number(text.slice(5)):null;
  if(year!==null&&year<2020)issues.push('Ano anterior a 2020.');
  if(week!==null&&(week<1||week>53))issues.push('Semana fora do intervalo 01–53.');
  if(sequence!==null&&sequence<1)issues.push('Sequência deve começar em 00001.');
  return {text,valid:!issues.length,year,week,sequence,issues};
}
export function extractFrecomPrinted(raw){
  const source=String(raw||'').toUpperCase();
  const matches=[...source.matchAll(/I[0-9]{9}/g)].map(item=>item[0]);
  const unique=[...new Set(matches)];
  return unique.length===1?unique[0]:'';
}
export function inspectFrecomLabel(barcodeRaw,printedRaw,reliable=false,confirmed=false){
  const barcode=parseFrecomCode(barcodeRaw),printedCode=extractFrecomPrinted(printedRaw),printed=parseFrecomCode(printedCode);
  const issues=[];
  if(barcode.text&&!barcode.valid)issues.push(...barcode.issues.map(item=>'Código de barras: '+item));
  if(String(printedRaw||'').trim()&&!printedCode)issues.push('Texto abaixo do código de barras não identificado de forma única.');
  if(printedCode&&!printed.valid)issues.push(...printed.issues.map(item=>'Texto impresso: '+item));
  if(barcode.valid&&printed.valid&&barcode.text!==printed.text)issues.push('Código de barras '+barcode.text+' ≠ texto impresso '+printed.text+'.');
  const missing=[];
  if(!barcode.text)missing.push('código de barras');
  if(!String(printedRaw||'').trim())missing.push('texto impresso');
  if(printed.valid&&!reliable&&!confirmed)missing.push('conferência manual do texto');
  const status=issues.length?'DIVERGENTE':missing.length?'PENDENTE':'COINCIDE';
  return {barcode,printed,issues,missing,status,reason:issues.join(' ')||(missing.length?'Pendente: '+missing.join(', ')+'.':'Código de barras e texto impresso coincidem.')};
}
