export const LG_24W_ID='lg-24w';
export const LG_24W_LABEL='C01012R - LG 24W';
export const LG_32W_ID='lg-32w';
export const LG_32W_LABEL='C01016R - LG 32W';
export const LG_PART_NO=Object.freeze({[LG_24W_ID]:'65888904',[LG_32W_ID]:'65889910'});
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

export function inspectLGLabel(qrRaw,barcodeRaw,printedRaw,reliable=false,confirmed=false,model=LG_24W_ID){
  const qr=parseLGQR(qrRaw),barcode=parseLGCode93(barcodeRaw),printed=parseLGPrinted(printedRaw),issues=qr.text?[...qr.issues]:[];
  if(String(barcodeRaw||'').trim()&&!barcode.valid)issues.push('Code 93: esperado EAY seguido de oito dígitos.');
  if(String(printedRaw||'').trim()&&!printed.valid)issues.push('Texto impresso: esperado EAY seguido de oito dígitos.');
  if(qr.partNo&&barcode.partNo&&qr.partNo!==barcode.partNo)issues.push(`QR ${qr.partNo} ≠ Code 93 ${barcode.partNo}.`);
  if(qr.partNo&&printed.partNo&&qr.partNo!==printed.partNo)issues.push(`QR ${qr.partNo} ≠ texto impresso ${printed.partNo}.`);
  if(barcode.partNo&&printed.partNo&&barcode.partNo!==printed.partNo)issues.push(`Code 93 ${barcode.partNo} ≠ texto impresso ${printed.partNo}.`);
  const expected=LG_PART_NO[model];
  if(expected)for(const [source,value] of [['QR',qr.partNo],['Code 93',barcode.partNo],['texto impresso',printed.partNo]])if(value&&value!==expected)issues.push(`${source}: Part No. ${value}; esperado ${expected} para este modelo.`);
  const missing=[];
  if(!qr.text)missing.push('QR');
  if(!barcode.text)missing.push('Code 93');
  if(!printed.text.trim())missing.push('texto impresso');
  if(printed.valid&&!reliable&&!confirmed)missing.push('conferência manual do texto');
  const status=issues.length?'DIVERGENTE':missing.length?'PENDENTE':'COINCIDE';
  return {qr,barcode,printed,issues,missing,status,reason:issues.join(' ')||(!missing.length?'As três leituras apresentam o mesmo Part No.':'Pendente: '+missing.join(', ')+'.')};
}

export function describeLGQR(raw){
  const qr=parseLGQR(raw),text=qr.text;
  const hasIssue=fragment=>qr.issues.some(issue=>issue.includes(fragment));
  const shape=/^[A-Z0-9]{17}$/.test(text);
  const row=(positions,label,value,rule,valid)=>({positions,label,value:value||'—',rule,valid:shape&&valid});
  return {qr,rows:[
    row('1','Fabricante',text[0],'I fixo · Inventus Power',text[0]==='I'),
    row('2','Ano',text[1],qr.year&&years.includes(text[1])?String(qr.year):'A–H, J, K · 2020–2029',!hasIssue('posição 2')),
    row('3','Mês',text[2],qr.month?'Mês '+qr.month:'1–9, O, N, D',!hasIssue('posição 3')),
    row('4','Dia',text[3],qr.day?'Dia '+qr.day:'1–31 conforme tabela, sem I/O',!hasIssue('posição 4')&&!hasIssue('data de fabricação')),
    row('5','Linha de produção',text[4],'Linha de 1 a 9',/^[1-9]$/.test(text[4]||'')),
    row('6–13','Part No.',text.slice(5,13),'8 dígitos; comparados com Code 93 e impressão',/^[0-9]{8}$/.test(text.slice(5,13))),
    row('14–17','Sequência',text.slice(13),'0001–9999 ou letra + 001–999',!hasIssue('sequência inválida'))
  ]};
}
