export const PROFILE_PART='GH44-03247A';
export const SHIFT_LABELS=Object.freeze({G:'1º turno',H:'2º turno',J:'3º turno'});
export const isShiftCode=value=>typeof value==='string'&&Object.hasOwn(SHIFT_LABELS,value);
const specs=[
  ['Texto fixo','R'],['Texto fixo','3'],['Texto fixo','7'],
  ['Ano de fabricação',null],['Mês de fabricação',null],['Dia de fabricação',null],
  ['Turno/linha',null],
  ['Contador',null],['Contador',null],['Contador',null],
  ['Texto fixo','2'],['Texto fixo','I'],['Texto fixo','P'],['Texto fixo','A']
];
export function usesProfile(code){return typeof code==='string'&&code.trim().startsWith(PROFILE_PART+'+');}
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
  const positions=specs.map(([meaning,expected],index)=>{
    const value=serial[index];
    const valid=expected?value===expected:index===6?/^[GHJ]$/.test(value):/^[A-Za-z0-9]$/.test(value);
    const rule=expected?`Esperado ${expected}`:index===6?'G=1ª, H=2ª, J=3ª':'Código variável';
    return {position:index+1,meaning,expected,rule,value,valid};
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
