export const FRECOM_DM_24W_ID='frecom-dm-24w';
export const FRECOM_DM_24W_LABEL='33K0009 - Frecom 24W';
export const FRECOM_DM_MODEL='FC024A09-120020Z';
export const FRECOM_DM_PREFIX='FC024A09';
const years='ABCDEFGHJKLMNPQRSTVWXYZ',months='123456789ABC',days='123456789ABCDEFGHJKLMNPQRSTVWXY',counter='0123456789ABCDEFGHJKLMNPQRSTVWXYZ';

export function parseFrecomDMSerial(raw){
 const text=String(raw||'').trim().toUpperCase(),issues=[];
 if(!text)return {text,valid:false,issues};
 if(!/^[A-Z0-9]{10}$/.test(text))return {text,valid:false,issues:['Série: esperados dez caracteres (YMDSXXX1IP).']};
 const [yearCode,monthCode,dayCode,shiftCode]=text;
 const year=2025+years.indexOf(yearCode),month=months.indexOf(monthCode)+1,day=days.indexOf(dayCode)+1,shift=({A:'1º',B:'2º',C:'3º'})[shiftCode]||null,sequence=text.slice(4,7),revision=text[7];
 if(!years.includes(yearCode))issues.push('Ano inválido na posição 1.');
 if(!months.includes(monthCode))issues.push('Mês inválido na posição 2.');
 if(!days.includes(dayCode))issues.push('Dia inválido na posição 3.');
 if(years.includes(yearCode)&&months.includes(monthCode)&&days.includes(dayCode)){const date=new Date(Date.UTC(year,month-1,day));if(date.getUTCFullYear()!==year||date.getUTCMonth()!==month-1||date.getUTCDate()!==day)issues.push('Data de fabricação inexistente.');}
 if(!shift)issues.push('Turno/linha inválido na posição 4; esperado A, B ou C.');
 if(![...sequence].every(char=>counter.includes(char))||sequence==='000')issues.push('Contador inválido nas posições 5–7.');
 if(revision!=='1')issues.push('Revisão inválida na posição 8; esperado 1 para MP.');
 if(text.slice(8)!=='IP')issues.push('Final inválido nas posições 9–10; esperado IP.');
 return {text,valid:!issues.length,year,month,day,shift,shiftCode,sequence,revision,issues};
}

export function extractFrecomDMPrinted(raw){
 const lines=String(raw||'').toUpperCase().split(/[\r\n]+/).map(line=>line.replace(/\s+/g,''));
 const candidates=lines.flatMap(line=>[...line.matchAll(/(?<![A-Z0-9])[A-Z0-9]{10}(?![A-Z0-9])/g)].map(match=>match[0]));
 const unique=[...new Set(candidates)];return unique.length===1?unique[0]:'';
}

export function parseFrecomDMCode(raw){
 const text=String(raw||'').trim().toUpperCase(),match=text.match(/^([A-Z0-9-]+)\+([A-Z0-9]+)$/);
 const serial=parseFrecomDMSerial(match?.[2]||''),issues=[];
 if(text&&!match)issues.push('Data Matrix: esperado prefixo + série.');
 if(match&&match[1]!==FRECOM_DM_PREFIX)issues.push('Prefixo do Data Matrix: esperado '+FRECOM_DM_PREFIX+'.');
 if(match&&!serial.valid)issues.push(...serial.issues);
 return {text,prefix:match?.[1]||null,serial,valid:!!match&&!issues.length,issues};
}

export function inspectFrecomDMLabel(codeRaw,printedRaw,reliable=false,confirmed=false){
 const code=parseFrecomDMCode(codeRaw),printedCode=extractFrecomDMPrinted(printedRaw),printed=parseFrecomDMSerial(printedCode),issues=[...code.issues];
 if(String(printedRaw||'').trim()&&!printedCode)issues.push('Série impressa não identificada de forma única.');
 if(printedCode&&!printed.valid)issues.push(...printed.issues.map(issue=>'Impressão: '+issue));
 if(code.serial.text&&printed.text&&code.serial.text!==printed.text)issues.push('Data Matrix '+code.serial.text+' ≠ impressão '+printed.text+'.');
 const missing=[];
 if(!code.text)missing.push('Data Matrix');
 if(!String(printedRaw||'').trim())missing.push('série impressa');
 if(printed.valid&&!reliable&&!confirmed)missing.push('conferência manual da série');
 const status=issues.length?'DIVERGENTE':missing.length?'PENDENTE':'COINCIDE';
 return {code,printed,issues,missing,status,reason:issues.join(' ')||(missing.length?'Pendente: '+missing.join(', ')+'.':'Data Matrix e série impressa coincidem.')};
}
