export const LG_24W_ID='lg-24w';
export const LG_24W_LABEL='LG 24W';
const years='ABCDEFGHJK',months='123456789OND',days='123456789ABCDEFGHJKLMNPQRSTUVWX';
const sequencePattern=/^(?:[0-9]{4}|[A-Z][0-9]{3})$/;

export function parseLGQR(raw){
  const text=String(raw||'').trim().toUpperCase(),issues=[];
  if(!/^[A-Z0-9]{17}$/.test(text))return {text,valid:false,issues:['O QR precisa ter 17 letras/números.']};
  const brand=text[0],yearCode=text[1],monthCode=text[2],dayCode=text[3],line=text[4],partNo=text.slice(5,13),sequence=text.slice(13);
  const year=2020+years.indexOf(yearCode),month=months.indexOf(monthCode)+1,day=days.indexOf(dayCode)+1;
  if(brand!=='I')issues.push('posição 1: esperado I de Inventus Power');
  if(!years.includes(yearCode))issues.push('posição 2: código de ano inválido');
  if(!months.includes(monthCode))issues.push('posição 3: código de mês inválido');
  if(!days.includes(dayCode))issues.push('posição 4: código de dia inválido');
  if(years.includes(yearCode)&&months.includes(monthCode)&&days.includes(dayCode)){
    const date=new Date(Date.UTC(year,month-1,day));
    if(date.getUTCFullYear()!==year||date.getUTCMonth()!==month-1||date.getUTCDate()!==day)issues.push('data de fabricação inexistente');
  }
  if(!/^[1-9]$/.test(line))issues.push('posição 5: linha de produção inválida');
  if(!/^[0-9]{8}$/.test(partNo))issues.push('posições 6–13: Part No. inválido');
  if(!sequencePattern.test(sequence)||sequence==='0000'||/^[A-Z]000$/.test(sequence))issues.push('posições 14–17: sequência inválida');
  return {text,brand,yearCode,monthCode,dayCode,line,partNo,sequence,year,month,day,valid:issues.length===0,issues};
}

export function parseLGCode93(raw){
  const text=String(raw||'').trim().toUpperCase(),match=text.match(/^EAY([0-9]{8})$/);
  return {text,partNo:match?.[1]||null,valid:!!match};
}

export function parseLGPrinted(raw){
  const text=String(raw||'').toUpperCase(),compact=text.replace(/\s+/g,'');
  const matches=[...compact.matchAll(/EAY([0-9]{8})(?:\(([0-9]+(?:\.[0-9]+)?)\))?/g)];
  if(!matches.length||new Set(matches.map(match=>match[1])).size!==1)return {text,partNo:null,revision:null,valid:false};
  return {text,partNo:matches[0][1],revision:matches.find(match=>match[2])?.[2]||null,valid:true};
}

export function inspectLGLabel(qrRaw,barcodeRaw,printedRaw,reliable=false,confirmed=false){
  const qr=parseLGQR(qrRaw),barcode=parseLGCode93(barcodeRaw),printed=parseLGPrinted(printedRaw),issues=qr.text?[...qr.issues]:[];
  if(String(barcodeRaw||'').trim()&&!barcode.valid)issues.push('Code 93: esperado EAY seguido de oito dígitos.');
  if(String(printedRaw||'').trim()&&!printed.valid)issues.push('Texto impresso: esperado EAY seguido de oito dígitos.');
  if(qr.partNo&&barcode.partNo&&qr.partNo!==barcode.partNo)issues.push(`QR ${qr.partNo} ≠ Code 93 ${barcode.partNo}.`);
  if(qr.partNo&&printed.partNo&&qr.partNo!==printed.partNo)issues.push(`QR ${qr.partNo} ≠ texto impresso ${printed.partNo}.`);
  if(barcode.partNo&&printed.partNo&&barcode.partNo!==printed.partNo)issues.push(`Code 93 ${barcode.partNo} ≠ texto impresso ${printed.partNo}.`);
  const missing=[];
  if(!qr.text)missing.push('QR');
  if(!barcode.text)missing.push('Code 93');
  if(!printed.text.trim())missing.push('texto impresso');
  if(printed.valid&&!reliable&&!confirmed)missing.push('conferência manual do texto');
  const status=issues.length?'DIVERGENTE':missing.length?'PENDENTE':'COINCIDE';
  return {qr,barcode,printed,issues,missing,status,reason:issues.join(' ')||(!missing.length?'As três leituras apresentam o mesmo Part No.':'Pendente: '+missing.join(', ')+'.')};
}
