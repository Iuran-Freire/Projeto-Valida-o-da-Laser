import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validateSerialPositions,comparePositions} from '../src/serial-profile.mjs';
import {compare} from '../src/compare.mjs';
import {inspect,selectOCR} from '../src/inspection.mjs';

const code='GH44-03247A+R37L9QHG2Z2IPA';
const text='NUMERO DESERIE:R37L9QHG2Z2IPA';
test('planilha: 26 caracteres no código e 14 posições com significado',()=>{
  assert.equal(code.length,26);
  const check=validateSerialPositions('R37L9QHG2Z2IPA');
  assert.equal(check.valid,true);
  assert.deepEqual(check.positions.map(x=>x.meaning),['Texto fixo','Texto fixo','Texto fixo','Ano de fabricação','Mês de fabricação','Dia de fabricação','Turno/linha','Contador','Contador','Contador','Texto fixo','Texto fixo','Texto fixo','Texto fixo']);
  assert.equal(compare(code,text).profile.valid,true);
});
test('I fixo não pode ser confundido com 1',()=>{
  const wrong='NUMERO DESERIE:R37L9QHG2Z21PA';
  const result=inspect(code,wrong,true);
  assert.equal(result.status,'PENDENTE');
  assert.equal(result.profile.printIssues[0],'posição 12 (Texto fixo): Esperado I; lido 1');
  assert.equal(result.profile.positions[11].match,false);
  assert.equal(inspect(code,wrong,false).status,'PENDENTE');
  assert.equal(inspect(code,wrong,true,true).status,'DIVERGENTE');
  assert.equal(inspect('GH44-03247A+R37L9QHG2Z21PA',wrong,true).status,'DIVERGENTE');
});
test('valores variáveis de dia, turno e contador não são fixados no exemplo',()=>{
  for(const serial of ['R37L9RGGR22IPA','R37L9RGGR32IPA','R37L9RGGR42IPA','R37L9QHG2Z2IPA','R37L9QHG4S2IPA'])assert.equal(validateSerialPositions(serial).valid,true);
  assert.equal(validateSerialPositions('R37L9QKG2Z2IPA').valid,false);
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
  assert.match(result.reason,/troca entre dia de fabricação.*turno\/linha/i);
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
