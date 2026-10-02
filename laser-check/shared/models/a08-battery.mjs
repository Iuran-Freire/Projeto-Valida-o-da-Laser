export const A08_BATTERY_ID = 'a08-battery';
export const A08_BATTERY_62_ID = 'a08-battery-62';
export const A08_SEC_CODE = 'GH83-13417B';
export const A08_62_SEC_CODE = 'GH83-13419A';
export const expectedA08SecCode = model => model===A08_BATTERY_62_ID?A08_62_SEC_CODE:A08_SEC_CODE;

const YEARS = Object.freeze({R:2021,T:2022,W:2023,X:2024,Y:2025,L:2026,P:2027,Q:2028,S:2029,Z:2030,B:2031,C:2032,D:2033,F:2034,G:2035,H:2036,J:2037,K:2038,M:2039,N:2040});
const MONTHS = '123456789ABC';

export function parseA08QR(raw,model=A08_BATTERY_ID) {
  const text = String(raw || '').trim().toUpperCase();
  const issues = [];
  if (!text) return {text, valid:false, issues:[], secCode:null, printCode:null, date:null};
  const match = /^([A-Z0-9-]+)\+([A-Z0-9]{9})\+([A-Z0-9]{6})$/.exec(text);
  if (!match || text.length !== 28) return {text, valid:false, issues:['O 2D deve ter 28 caracteres no formato SEC CODE + código de fabricação + número de série.'], secCode:match?.[1]||null, printCode:match?.[2]||null, date:null};
  const [,secCode,printCode,tail] = match;
  const [vendor,cellVendor,version,yearCode,monthCode] = printCode;
  const dayText = printCode.slice(5,7),line = printCode[7],delivery = printCode[8];
  const year=YEARS[yearCode],month=MONTHS.indexOf(monthCode)+1,day=Number(dayText);
  const serial=tail.slice(0,5),cellSite=tail[5];
  if(secCode!==expectedA08SecCode(model))issues.push(`SEC CODE incorreto: esperado ${expectedA08SecCode(model)}; lido ${secCode}.`);
  if(vendor!=='P')issues.push('Posição 1 da fabricação: fornecedor da bateria deve ser P.');
  if(cellVendor!=='W')issues.push('Posição 2 da fabricação: fornecedor da célula deve ser W.');
  if(!/^[A-Z0-9]$/.test(version))issues.push('Versão da bateria inválida.');
  if(!year)issues.push('Código do ano de fabricação inválido.');
  if(!month)issues.push('Código do mês de fabricação inválido.');
  if(!/^\d{2}$/.test(dayText)||day<1||day>31)issues.push('Dia de fabricação inválido.');
  if(year&&month&&day>=1&&day<=31){const date=new Date(Date.UTC(year,month-1,day));if(date.getUTCFullYear()!==year||date.getUTCMonth()!==month-1||date.getUTCDate()!==day)issues.push('Data de fabricação inexistente.');}
  if(!/^[A-Z]$/.test(line))issues.push('Linha de produção inválida.');
  if(!['D','S'].includes(delivery))issues.push('Código de entrega inválido: esperado D ou S.');
  if(!/^\d{5}$/.test(serial)||serial==='00000')issues.push('Número de série inválido: esperado 00001–99999.');
  if(cellSite!=='W')issues.push('Código final da célula inválido: esperado W.');
  const date=year&&month&&day?`${year}.${String(month).padStart(2,'0')}.${String(day).padStart(2,'0')}`:null;
  return {text,valid:issues.length===0,issues,secCode,printCode,date,year,month,day,line,delivery,serial,cellSite,version};
}

export function parseA08Print(raw) {
  const text=String(raw||'').toUpperCase();
  const dates=[...text.matchAll(/\b(20\d{2})\s*[.\/-]\s*(\d{1,2})\s*[.\/-]\s*(\d{1,2})\b/g)].map(m=>`${m[1]}.${m[2].padStart(2,'0')}.${m[3].padStart(2,'0')}`);
  const codes=[...text.matchAll(/\b(PW[A-Z0-9]{7})\s*\/\s*--/g)].map(m=>m[1]);
  return {text,date:dates.length===1?dates[0]:null,printCode:codes.length===1?codes[0]:null,dateCount:dates.length,codeCount:codes.length};
}

export function inspectA08Battery(qrRaw,printRaw,reliable=false,confirmed=false,model=A08_BATTERY_ID) {
  const qr=parseA08QR(qrRaw,model),printed=parseA08Print(printRaw),issues=[...qr.issues],missing=[];
  if(qr.text&&!qr.valid&&qr.secCode===null)return {qr,printed,issues,missing,status:'DIVERGENTE',reason:issues.join(' ')};
  if(qr.printCode&&printed.printCode&&qr.printCode!==printed.printCode)issues.push(`Código de fabricação diferente: 2D ${qr.printCode}; impressão ${printed.printCode}.`);
  if(qr.date&&printed.date&&qr.date!==printed.date)issues.push(`Data diferente: 2D ${qr.date}; impressão ${printed.date}.`);
  if(printed.dateCount>1||printed.codeCount>1)issues.push('Mais de uma data ou código impresso identificado; confira a foto.');
  if(!qr.text)missing.push('2D');
  if(!printed.printCode)missing.push('código pontilhado PW…/--');
  if(!printed.date)missing.push('data impressa');
  if(printed.printCode&&printed.date&&!reliable&&!confirmed)missing.push('conferência manual do OCR');
  const status=issues.length?'DIVERGENTE':missing.length?'PENDENTE':'COINCIDE';
  return {qr,printed,issues,missing,status,reason:issues.join(' ')||(missing.length?'Pendente: '+missing.join(', ')+'.':'SEC CODE, código de fabricação e data conforme o padrão.')};
}
