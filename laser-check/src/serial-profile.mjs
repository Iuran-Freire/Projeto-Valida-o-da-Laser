export const PROFILE_PART='GH44-03247A';
export const SHIFT_LABELS=Object.freeze({G:'1º turno',H:'2º turno',J:'3º turno'});
export const isShiftCode=value=>typeof value==='string'&&Object.hasOwn(SHIFT_LABELS,value);
// Tabela do 15W VE TYPE C BLACK; a produção atual usa G/H/J para os três turnos.
export const YEAR_BY_CODE=Object.freeze({T:2022,W:2023,X:2024,Y:2025,L:2026,P:2027,Q:2028,S:2029,Z:2030,B:2031,C:2032,D:2033,F:2034,G:2035,H:2036,J:2037,K:2038,M:2039,N:2040});
export const MONTH_CODES='123456789ABC';
export const DAY_CODES='123456789ABCDEFGHJKLMNPQRSTVWXY';
export const COUNTER_ALPHABET='0123456789ABCDEFGHJKLMNPQRSTVWXYZ';
const fixed={0:'R',1:'3',2:'7',11:'I',12:'P',13:'A'};
const meanings=['Família','Código do cliente','Classificação do produto','Ano de fabricação','Mês de fabricação','Dia de fabricação','Turno','Contador','Contador','Contador','Versão de produção','Código do fornecedor','Código do fornecedor','Código do vendedor'];
export function usesProfile(code){return typeof code==='string'&&code.trim().startsWith(PROFILE_PART+'+');}
export function checkSecCode(code){
  const text=typeof code==='string'?code.trim():'';
  if(!text)return {status:'unread',expected:PROFILE_PART,actual:null};
  const match=text.match(/^([A-Za-z0-9-]+)\+/);
  if(!match)return {status:'unsupported',expected:PROFILE_PART,actual:null};
  return {status:match[1]===PROFILE_PART?'match':'mismatch',expected:PROFILE_PART,actual:match[1]};
}
export function checkCodeShift(code,serial,shift){
  if(!isShiftCode(shift))return {status:'missing',expected:null,actual:null};
  if(!serial)return {status:'unread',expected:shift,actual:null};
  if(!usesProfile(code))return {status:'unsupported',expected:shift,actual:serial[6]||null};
  return {status:serial[6]===shift?'match':'mismatch',expected:shift,actual:serial[6]};
}
export function isValidRecordShift(record){
  if(record.shift==null)return true; // Registros antigos ou pendentes criados antes do campo turno.
  if(!isShiftCode(record.shift))return false;
  if(record.status!=='COINCIDE')return true;
  const serial=String(record.qr||'').trim().match(/^GH44-03247A\+([A-Za-z0-9]{14})$/)?.[1];
  return !!serial&&serial[6]===record.shift;
}
export function validateSerialPositions(serial){
  if(typeof serial!=='string'||serial.length!==14)return {valid:false,positions:[],issues:['A série precisa ter 14 caracteres.']};
  const positions=Array.from(serial,(value,index)=>{
    const expected=fixed[index]||null;
    let valid=false,rule='',decoded='';
    if(expected){valid=value===expected;rule=`Esperado ${expected}`;}
    else if(index===3){valid=Object.hasOwn(YEAR_BY_CODE,value);rule='Código de ano conforme a tabela (2022–2040)';if(valid)decoded=String(YEAR_BY_CODE[value]);}
    else if(index===4){valid=MONTH_CODES.includes(value);rule='Mês: 1–9, A=10, B=11, C=12';if(valid)decoded=`mês ${MONTH_CODES.indexOf(value)+1}`;}
    else if(index===5){valid=DAY_CODES.includes(value);rule='Dia: 1–9, A–H=10–17, J–N=18–22, P–T=23–27, V–Y=28–31';if(valid)decoded=`dia ${DAY_CODES.indexOf(value)+1}`;}
    else if(index===6){valid=isShiftCode(value);rule='G=1º, H=2º, J=3º turno';if(valid)decoded=SHIFT_LABELS[value];}
    else if(index>=7&&index<=9){valid=COUNTER_ALPHABET.includes(value)&&serial.slice(7,10)!=='000';rule='Contador 001–ZZZ em base 33 (sem I, O ou U)';}
    else if(index===10){valid=/^[0-9]$/.test(value);rule='Versão: 0=desenvolvimento, 1=produção, 2 em diante=alterações';if(valid)decoded=value==='0'?'desenvolvimento':value==='1'?'produção':`alteração ${value}`;}
    return {position:index+1,meaning:meanings[index],expected,rule,value,valid,decoded};
  });
  const issues=positions.filter(item=>!item.valid).map(item=>`posição ${item.position} (${item.meaning}): ${item.rule}; lido ${item.value}`);
  return {valid:issues.length===0,positions,issues};
}
export function comparePositions(code,print){
  const codeCheck=validateSerialPositions(code),printCheck=validateSerialPositions(print);
  const positions=codeCheck.positions.map((item,index)=>({...item,code:item.value,print:printCheck.positions[index]?.value||'',printValid:printCheck.positions[index]?.valid??false,match:item.value===printCheck.positions[index]?.value}));
  const swappedDayShift=code.length===14&&print.length===14&&code[5]!==code[6]&&code[5]===print[6]&&code[6]===print[5];
  return {valid:codeCheck.valid&&printCheck.valid,codeValid:codeCheck.valid,printValid:printCheck.valid,codeIssues:codeCheck.issues,printIssues:printCheck.issues,positions,swappedDayShift};
}
