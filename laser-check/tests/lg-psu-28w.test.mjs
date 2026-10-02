import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {extractLGPSUPrinted,inspectLGPSULabel} from '../shared/models/lg-psu-28w.mjs';

test('LG PSU 28W interpreta e confere o exemplo da etiqueta',()=>{
 const checked=inspectLGPSULabel('IBN13658992060001','IBN13658992060001 (1.1)',true,true);
 assert.equal(checked.status,'COINCIDE');
 assert.deepEqual([checked.barcode.year,checked.barcode.month,checked.barcode.day,checked.barcode.line,checked.barcode.partNo,checked.barcode.sequence],[2021,11,1,'3','65899206','0001']);
});

test('LG PSU 28W compara as 17 posições e exige Part No. do modelo',()=>{
 assert.equal(inspectLGPSULabel('IBN13658992060001','IBN13658992060002 (1.1)',true,true).status,'DIVERGENTE');
 assert.equal(inspectLGPSULabel('IBN13658992060001','IBN14658992060001 (1.1)',true,true).status,'DIVERGENTE');
 assert.equal(inspectLGPSULabel('IBN13658889040001','IBN13658889040001 (1.1)',true,true).status,'DIVERGENTE');
 assert.equal(inspectLGPSULabel('1BN13658992060001','IBN13658992060001 (1.1)',true,true).status,'DIVERGENTE');
 assert.equal(inspectLGPSULabel('IBN13658992060001','',true,true).status,'PENDENTE');
 assert.equal(inspectLGPSULabel('IBN13658992060001','IBN13658992060001 (2.0)',true,true).status,'COINCIDE');
 assert.equal(extractLGPSUPrinted('IBN13658992060001 e IBN13658992060002'),'');
});
