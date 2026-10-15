export const OPPO_45W_ID='oppo-45w',OPPO_MATERIAL='611401000196',OPPO_PREFIX='I*'+OPPO_MATERIAL;
const years='0123456789ABCDEFGHJKLMNPQRSTUVWXYZ',months='123456789ABC',days='123456789ABCDEFGHJKLMNPQRSTUVWX',lineCodes='123456789ABCDEFGHJKLMNPQRSTUVWXYZ';
export function parseOPPOSerial(raw){
 const text=String(raw||'').trim(),issues=[];
 if(!text)return {text,valid:false,issues};
 if(!/^I[A-Z0-9]{6}[0-9]{5}$/.test(text))return {text,valid:false,issues:['SN inválido: esperado I, data, linha, status, versão e cinco dígitos.']};
 const year=2020+years.indexOf(text[1]),month=months.indexOf(text[2])+1,day=days.indexOf(text[3])+1,shiftCode=text[4],productStatus=text[5],revision=text[6],sequence=text.slice(7);
 if(!years.includes(text[1])||!month||!day)issues.push('Data codificada inválida.');
 else {const date=new Date(Date.UTC(year,month-1,day));if(date.getUTCFullYear()!==year||date.getUTCMonth()!==month-1||date.getUTCDate()!==day)issues.push('Data de fabricação inexistente.');}
 if(shiftCode!=='1')issues.push('Linha de produção incorreta: esperado 1.');
 if(productStatus!=='1')issues.push('Status do produto incorreto: esperado 1.');
 if(revision!=='1')issues.push('Versão incorreta: esperado 1.');
 if(sequence==='00000')issues.push('Contador precisa estar entre 00001 e 99999.');
 return {text,valid:!issues.length,year,month,day,shiftCode,productStatus,revision,sequence,issues};
}
export function extractOPPOPrinted(raw){
 const text=String(raw||'');const tagged=[...text.matchAll(/\bS\s*N\s*[:：]\s*([A-Za-z0-9]+)/gi)].map(m=>m[1]);
 const values=tagged.length?tagged:[...text.matchAll(/(?<![A-Za-z0-9])[A-Za-z0-9]{12}(?![A-Za-z0-9])/g)].map(m=>m[0]);
 const unique=[...new Set(values)];return unique.length===1&&unique[0].length===12?unique[0]:'';
}
export function parseOPPOCode(raw){
 const text=String(raw||'').trim(),match=text.match(/^I\*([0-9]{12})([A-Z0-9]{11})$/),serial=parseOPPOSerial(match?'I'+match[2]:''),issues=[];
 if(text&&!match)issues.push('Data Matrix inválido: esperado I*, material e série codificada.');
 if(match&&match[1]!==OPPO_MATERIAL)issues.push('Código de material incorreto: esperado '+OPPO_MATERIAL+'.');
 if(match)issues.push(...serial.issues);
 return {text,prefix:match?'I*'+match[1]:null,material:match?.[1]||null,serial,valid:!!match&&!issues.length,issues};
}
export function inspectOPPOLabel(codeRaw,printRaw,reliable=false,confirmed=false){
 const code=parseOPPOCode(codeRaw),printed=parseOPPOSerial(extractOPPOPrinted(printRaw)),issues=[...code.issues],missing=[];
 if(!code.text)missing.push('Data Matrix');
 if(!printed.text)missing.push('SN impresso');else issues.push(...printed.issues);
 if(code.serial.text&&printed.text&&code.serial.text!==printed.text)issues.push('SN do Data Matrix diferente do SN impresso.');
 if(printed.valid&&!reliable&&!confirmed)missing.push('confirmação manual da leitura');
 return {code,printed,issues,missing,status:issues.length?'DIVERGENTE':missing.length?'PENDENTE':'COINCIDE',reason:issues.join(' ')||(missing.length?'Pendente: '+missing.join(', ')+'.':'Data Matrix e SN impresso coincidem.')};
}

export function oppoManufacturerAmbiguity(raw){const serial=extractOPPOPrinted(raw);return serial.startsWith('1')&&parseOPPOSerial('I'+serial.slice(1)).valid?{index:0,position:1,read:'1',expected:'I'}:null;}
