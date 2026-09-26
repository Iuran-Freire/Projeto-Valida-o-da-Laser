import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validateSerialPositions,comparePositions,checkCodeShift,isValidRecordShift,YEAR_BY_CODE,MONTH_CODES,DAY_CODES,COUNTER_ALPHABET} from '../src/serial-profile.mjs';
import {compare} from '../src/compare.mjs';
import {inspect,selectOCR} from '../src/inspection.mjs';

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
  const serial='R37LCJH0011IPA';
  const result=validateSerialPositions(serial);
  assert.equal(result.valid,true);
  assert.equal(result.positions[3].decoded,'2026');
  assert.equal(result.positions[4].decoded,'mês 12');
  assert.equal(result.positions[5].decoded,'dia 18');
  assert.equal(result.positions[6].decoded,'2º turno');
});
test('conta 001–ZZZ, aceita versão variável e mantém IPA fixo',()=>{
  assert.equal(COUNTER_ALPHABET.length,33);
  for(const version of '0123456789')assert.equal(validateSerialPositions(`R37L9QGZZZ${version}IPA`).valid,true);
  assert.equal(validateSerialPositions('R37L9QG0011IPA').valid,true);
  for(const counter of ['000','I01','O01','U01'])assert.equal(validateSerialPositions(`R37L9QG${counter}1IPA`).valid,false);
  assert.equal(validateSerialPositions('R37L9QG00111PA').positions[11].valid,false);
});
test('a linha não interfere: A/D/G, B/E/H e C/F/J representam os turnos',()=>{
  const example='R37T11A0011IPA';
  assert.equal(validateSerialPositions(example).valid,true);
  assert.equal(checkCodeShift('GH44-03247A+'+example,example,'G').status,'match');
  for(const [turno,letters] of [['G','ADG'],['H','BEH'],['J','CFJ']])for(const letter of letters){
    const serial=`R37L9Q${letter}0011IPA`;
    assert.equal(validateSerialPositions(serial).valid,true);
    assert.equal(checkCodeShift('GH44-03247A+'+serial,serial,turno).status,'match');
    assert.equal(isValidRecordShift({shift:turno,status:'COINCIDE',qr:'GH44-03247A+'+serial}),true);
  }
  assert.equal(checkCodeShift('GH44-03247A+R37L9QA0011IPA','R37L9QA0011IPA','H').status,'mismatch');
  assert.equal(validateSerialPositions('R37L9QK0011IPA').positions[6].valid,false);
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
