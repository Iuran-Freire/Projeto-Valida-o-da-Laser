export const PROFILE_PART='GH44-03247A';
export const DEFAULT_MODEL='type-c';
export const MODEL_PROFILES=Object.freeze({
  'type-c':Object.freeze({id:'type-c',label:'15W VE TYPE C',secCode:PROFILE_PART,version:'type-c-v2',layout:'below-left',fixed:Object.freeze({0:'R',1:'3',2:'7',10:'2',11:'I',12:'P',13:'A'})}),
  '15w-ve':Object.freeze({id:'15w-ve',label:'15W VE',secCode:'GH44-03086A',version:'15w-ve-v1',layout:'above',fixed:Object.freeze({0:'R',1:'3',2:'7',10:'2',11:'I',12:'P',13:'A'})})
});
export const isModelCode=value=>typeof value==='string'&&Object.hasOwn(MODEL_PROFILES,value);
export const getModelProfile=(model=DEFAULT_MODEL)=>MODEL_PROFILES[model]||MODEL_PROFILES[DEFAULT_MODEL];
export const SHIFT_LABELS=Object.freeze({G:'1º turno',H:'2º turno',J:'3º turno'});
export const isShiftCode=value=>typeof value==='string'&&Object.hasOwn(SHIFT_LABELS,value);
// Tabela do 15W VE TYPE C BLACK; a produção atual usa G/H/J para os três turnos.
export const YEAR_BY_CODE=Object.freeze({T:2022,W:2023,X:2024,Y:2025,L:2026,P:2027,Q:2028,S:2029,Z:2030,B:2031,C:2032,D:2033,F:2034,G:2035,H:2036,J:2037,K:2038,M:2039,N:2040});
export const MONTH_CODES='123456789ABC';
export const DAY_CODES='123456789ABCDEFGHJKLMNPQRSTVWXY';
export const COUNTER_ALPHABET='0123456789ABCDEFGHJKLMNPQRSTVWXYZ';
const VE_YEAR_BY_CODE=Object.freeze({R:2021,T:2022,W:2023,X:2024,Y:2025,L:2026,P:2027,Q:2028});
const meanings=['Família','Código do cliente','Classificação do produto','Ano de fabricação','Mês de fabricação','Dia de fabricação','Turno','Contador','Contador','Contador','Versão de produção','Código do fornecedor','Código do fornecedor','Código do vendedor'];
export function usesProfile(code,model=DEFAULT_MODEL){return typeof code==='string'&&code.trim().startsWith(getModelProfile(model).secCode+'+');}
export function checkSecCode(code,model=DEFAULT_MODEL){
  const expected=getModelProfile(model).secCode;
  const text=typeof code==='string'?code.trim():'';
  if(!text)return {status:'unread',expected,actual:null};
  const match=text.match(/^([A-Za-z0-9-]+)\+/);
  if(!match)return {status:'unsupported',expected,actual:null};
  return {status:match[1]===expected?'match':'mismatch',expected,actual:match[1]};
}
export function checkCodeShift(code,serial,shift,model=DEFAULT_MODEL){
  if(!isShiftCode(shift))return {status:'missing',expected:null,actual:null};
  if(!serial)return {status:'unread',expected:shift,actual:null};
  if(!usesProfile(code,model))return {status:'unsupported',expected:shift,actual:serial[6]||null};
  return {status:serial[6]===shift?'match':'mismatch',expected:shift,actual:serial[6]};
}
export function isValidRecordShift(record){
  const model=record.model??DEFAULT_MODEL;
  if(!isModelCode(model))return false;
  if(record.shift==null)return true; // Registros antigos ou pendentes criados antes do campo turno.
  if(!isShiftCode(record.shift))return false;
  if(record.status!=='COINCIDE')return true;
  const prefix=getModelProfile(model).secCode.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  const serial=String(record.qr||'').trim().match(new RegExp('^'+prefix+'\\+([A-Za-z0-9]{14})$'))?.[1];
  return !!serial&&serial[6]===record.shift;
}
export function validateSerialPositions(serial,model=DEFAULT_MODEL){
  if(typeof serial!=='string'||serial.length!==14)return {valid:false,positions:[],issues:['A série precisa ter 14 caracteres.']};
  const profile=getModelProfile(model),fixed=profile.fixed,years=model==='15w-ve'?VE_YEAR_BY_CODE:YEAR_BY_CODE;
  const positions=Array.from(serial,(value,index)=>{
    const expected=fixed[index]||null;
    let valid=false,rule='',decoded='';
    if(expected){valid=value===expected;rule=`Esperado ${expected}`;}
    else if(index===3){valid=Object.hasOwn(years,value);rule=model==='15w-ve'?'Código de ano conforme a tabela (2021–2028)':'Código de ano conforme a tabela (2022–2040)';if(valid)decoded=String(years[value]);}
    else if(index===4){valid=MONTH_CODES.includes(value);rule='Mês: 1–9, A=10, B=11, C=12';if(valid)decoded=`mês ${MONTH_CODES.indexOf(value)+1}`;}
    else if(index===5){valid=DAY_CODES.includes(value);rule='Dia: 1–9, A–H=10–17, J–N=18–22, P–T=23–27, V–Y=28–31';if(valid)decoded=`dia ${DAY_CODES.indexOf(value)+1}`;}
    else if(index===6){valid=isShiftCode(value);rule='G=1º, H=2º, J=3º turno';if(valid)decoded=SHIFT_LABELS[value];}
    else if(index>=7&&index<=9){valid=COUNTER_ALPHABET.includes(value)&&serial.slice(7,10)!=='000';rule='Contador 001–ZZZ em base 33 (sem I, O ou U)';}
    return {position:index+1,meaning:meanings[index],expected,rule,value,valid,decoded};
  });
  const issues=positions.filter(item=>!item.valid).map(item=>`posição ${item.position} (${item.meaning}): ${item.rule}; lido ${item.value}`);
  return {valid:issues.length===0,positions,issues};
}
export function comparePositions(code,print,model=DEFAULT_MODEL){
  const codeCheck=validateSerialPositions(code,model),printCheck=validateSerialPositions(print,model);
  const positions=codeCheck.positions.map((item,index)=>({...item,code:item.value,print:printCheck.positions[index]?.value||'',printValid:printCheck.positions[index]?.valid??false,match:item.value===printCheck.positions[index]?.value}));
  const swappedDayShift=code.length===14&&print.length===14&&code[5]!==code[6]&&code[5]===print[6]&&code[6]===print[5];
  return {valid:codeCheck.valid&&printCheck.valid,codeValid:codeCheck.valid,printValid:printCheck.valid,codeIssues:codeCheck.issues,printIssues:printCheck.issues,positions,swappedDayShift};
}
