import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validateSerialPositions,comparePositions,checkCodeShift,checkSecCode,isValidRecordShift,YEAR_BY_CODE,MONTH_CODES,DAY_CODES,COUNTER_ALPHABET,MODEL_PROFILES} from '../shared/models/serial-profile.mjs';
import {compare} from '../shared/validation/compare.mjs';
import {inspect,selectOCR} from '../shared/validation/inspection.mjs';

const code='GH44-03247A+R37L9QHG2Z2IPA';
const text='NUMERO DESERIE:R37L9QHG2Z2IPA';
test('planilha: 26 caracteres no código e 14 posições com significado',()=>{
  assert.equal(code.length,26);
  const check=validateSerialPositions('R37L9QHG2Z2IPA');
  assert.equal(check.valid,true);
  assert.deepEqual(check.positions.map(x=>x.meaning),['Família','Código do cliente','Classificação do produto','Ano de fabricação','Mês de fabricação','Dia de fabricação','Turno','Contador','Contador','Contador','Versão de produção','Código do fornecedor','Código do fornecedor','Código do vendedor']);
  assert.equal(compare(code,text).profile.valid,true);
});
test('I fixo não pode ser confundido com 1',()=>{
  const wrong='NUMERO DESERIE:R37L9QHG2Z21PA';
  const result=inspect(code,wrong,true);
  assert.equal(result.status,'PENDENTE');
  assert.equal(result.profile.printIssues[0],'posição 12 (Código do fornecedor): Esperado I; lido 1');
  assert.equal(result.profile.positions[11].match,false);
  assert.equal(inspect(code,wrong,false).status,'PENDENTE');
  assert.equal(inspect(code,wrong,true,true).status,'DIVERGENTE');
  assert.equal(inspect('GH44-03247A+R37L9QHG2Z21PA',wrong,true).status,'DIVERGENTE');
});
test('SEC CODE BLACK é fixo antes do sinal de mais',()=>{
  assert.equal(checkSecCode('GH44-03247A+R37L9QHG2Z2IPA').status,'match');
  assert.deepEqual(checkSecCode('GH44-03246A+R37L9QHG2Z2IPA'),{status:'mismatch',expected:'GH44-03247A',actual:'GH44-03246A'});
  assert.equal(checkSecCode('GH44-03247A+R37L9QHG2Z2IPA+EXTRA').status,'match');
});
test('valores variáveis de dia, turno e contador não são fixados no exemplo',()=>{
  for(const serial of ['R37L9RGGR22IPA','R37L9RGGR32IPA','R37L9RGGR42IPA','R37L9QHG2Z2IPA','R37L9QHG4S2IPA'])assert.equal(validateSerialPositions(serial).valid,true);
  assert.equal(validateSerialPositions('R37L9QKG2Z2IPA').valid,false);
});
test('tabela BLACK interpreta ano, mês e dia em suas posições',()=>{
  assert.equal(Object.keys(YEAR_BY_CODE).length,19);
  assert.equal(YEAR_BY_CODE.L,2026);
  assert.equal(YEAR_BY_CODE.N,2040);
  assert.equal(MONTH_CODES,'123456789ABC');
  assert.equal(DAY_CODES[17],'J');
  assert.equal(DAY_CODES[27],'V');
  assert.equal(DAY_CODES[30],'Y');
  const serial='R37LCJH0012IPA';
  const result=validateSerialPositions(serial);
  assert.equal(result.valid,true);
  assert.equal(result.positions[3].decoded,'2026');
  assert.equal(result.positions[4].decoded,'mês 12');
  assert.equal(result.positions[5].decoded,'dia 18');
  assert.equal(result.positions[6].decoded,'2º turno');
});
test('conta 001–ZZZ e exige 2IPA fixo nos dois modelos',()=>{
  assert.equal(COUNTER_ALPHABET.length,33);
  assert.equal(validateSerialPositions('R37L9QGZZZ2IPA').valid,true);
  assert.equal(validateSerialPositions('R37L9QG0012IPA').valid,true);
  for(const version of '013456789')assert.equal(validateSerialPositions(`R37L9QGZZZ${version}IPA`).positions[10].valid,false);
  for(const counter of ['000','I01','O01','U01'])assert.equal(validateSerialPositions(`R37L9QG${counter}2IPA`).valid,false);
  assert.equal(validateSerialPositions('R37L9QG00111PA').positions[11].valid,false);
});
test('operação atual usa exatamente G, H e J nos três turnos',()=>{
  for(const turno of 'GHJ'){
    const serial=`R37L9Q${turno}0012IPA`;
    assert.equal(validateSerialPositions(serial).valid,true);
    assert.equal(checkCodeShift('GH44-03247A+'+serial,serial,turno).status,'match');
    assert.equal(isValidRecordShift({shift:turno,status:'COINCIDE',qr:'GH44-03247A+'+serial}),true);
  }
  for(const letter of 'ABCDEFK'){
    const serial=`R37L9Q${letter}0012IPA`;
    assert.equal(validateSerialPositions(serial).positions[6].valid,false);
    assert.equal(checkCodeShift('GH44-03247A+'+serial,serial,'G').status,'mismatch');
    assert.equal(isValidRecordShift({shift:'G',status:'COINCIDE',qr:'GH44-03247A+'+serial}),false);
  }
});
test('15W VE usa SEC CODE próprio, G/H/J e termina em 2IPA',()=>{
 const serial='R37L8KH9K92IPA',qr='GH44-03086A+'+serial,print='NUMERO DE SERIE:'+serial;
 assert.equal(MODEL_PROFILES['15w-ve'].secCode,'GH44-03086A');
 assert.equal(checkSecCode(qr,'15w-ve').status,'match');
 assert.equal(checkSecCode(qr,'type-c').status,'mismatch');
 assert.equal(validateSerialPositions(serial,'15w-ve').valid,true);
 assert.equal(validateSerialPositions(serial,'15w-ve').positions[3].decoded,'2026');
 assert.equal(validateSerialPositions(serial,'15w-ve').positions[4].decoded,'mês 8');
 assert.equal(validateSerialPositions(serial,'15w-ve').positions[5].decoded,'dia 19');
 assert.equal(inspect(qr,print,true,false,'H','15w-ve').status,'COINCIDE');
 assert.equal(inspect(qr,print,true,false,'H','type-c').status,'DIVERGENTE');
 assert.equal(inspect(qr,print,true,false,'G','15w-ve').status,'DIVERGENTE');
 assert.equal(isValidRecordShift({model:'15w-ve',shift:'H',status:'COINCIDE',qr}),true);
 assert.equal(isValidRecordShift({model:'type-c',shift:'H',status:'COINCIDE',qr}),false);
 assert.equal(isValidRecordShift({model:'unknown',shift:'H',status:'PENDENTE',qr}),false);
 for(const bad of ['R37L8KH9K91IPA','R37L8KH9K921PA','R37L8KA9K92IPA'])assert.equal(validateSerialPositions(bad,'15w-ve').valid,false);
});
test('OCR prioriza um candidato que obedece aos caracteres fixos, sem usar a série do código',()=>{
  const attempts=[{text:'NUMERO DESERIE:R37L9QHG2Z21PA',confidence:99},{text,confidence:91}];
  const selected=selectOCR(attempts,true);
  assert.equal(selected.text,text);
  assert.equal(selected.reliable,false);
});
test('troca entre dia e turno é destacada e nunca aprovada',()=>{
  const result=inspect('GH44-03247A+R37L9QGC0R2IPA','NUMERO DE SERIE:R37L9GQC0R2IPA',true);
  assert.equal(result.status,'DIVERGENTE');
  assert.equal(result.profile.swappedDayShift,true);
  assert.match(result.reason,/troca entre dia de fabricação.*turno/i);
  assert.equal(result.profile.positions[5].match,false);
  assert.equal(result.profile.positions[6].match,false);
});
test('I lido como 1 pede confirmação sem apagar troca de dia e turno',()=>{
  const onlyI=inspect('GH44-03247A+R37L9QGC0R2IPA','NUMERO DE SERIE:R37L9QGC0R21PA',true);
  assert.equal(onlyI.status,'PENDENTE');
  assert.equal(onlyI.ambiguousI,true);
  const swapAndI=inspect('GH44-03247A+R37L9QGC0R2IPA','NUMERO DE SERIE:R37L9GQC0R21PA',true);
  assert.equal(swapAndI.status,'DIVERGENTE');
  assert.equal(swapAndI.ambiguousI,true);
  assert.equal(swapAndI.profile.swappedDayShift,true);
  assert.match(swapAndI.reason,/troca entre dia de fabricação/);
  const corrected=inspect('GH44-03247A+R37L9QGC0R2IPA','NUMERO DE SERIE:R37L9GQC0R2IPA',false,true);
  assert.equal(corrected.status,'DIVERGENTE');
  assert.equal(corrected.ambiguousI,false);
});

test('Type C distingue os PN M09030D e M09031D pelo final fixo',()=>{
  const old='R37L9QHG2Z2IPA',newSerial='R37L9QHG2Z1IPA';
  assert.equal(MODEL_PROFILES['type-c'].label,'M09030D - 15W Type C LowStandBy');
  assert.equal(MODEL_PROFILES['type-c-m09031d'].label,'M09031D - 15W Type C');
  assert.equal(validateSerialPositions(old,'type-c').valid,true);
  assert.equal(validateSerialPositions(newSerial,'type-c-m09031d').valid,true);
  assert.equal(validateSerialPositions(old,'type-c-m09031d').positions[10].valid,false);
  assert.equal(validateSerialPositions(newSerial,'type-c').positions[10].valid,false);
  assert.equal(inspect('GH44-03247A+'+newSerial,'NUMERO DE SERIE:'+newSerial,true,false,'H','type-c-m09031d').status,'COINCIDE');
  assert.equal(inspect('GH44-03247A+'+old,'NUMERO DE SERIE:'+old,true,false,'H','type-c-m09031d').status,'DIVERGENTE');
  assert.equal(inspect('GH44-03247A+'+newSerial,'NUMERO DE SERIE:'+newSerial,true,false,'H','type-c').status,'DIVERGENTE');
  assert.equal(isValidRecordShift({model:'type-c-m09031d',shift:'H',status:'COINCIDE',qr:'GH44-03247A+'+newSerial}),true);
});
