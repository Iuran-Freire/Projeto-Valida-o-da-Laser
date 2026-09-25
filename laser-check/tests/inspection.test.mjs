import {test} from 'node:test';import assert from 'node:assert/strict';
import {selectOCR,inspect,nearbyRegion} from '../src/inspection.mjs';
const text='NUMERO DE SERIE: AB123456789012';
test('Duas leituras consistentes e confiáveis permitem comparação automática',()=>{const o=selectOCR([{text,confidence:90},{text,confidence:85}]);assert.equal(o.reliable,true);assert.equal(inspect('AB123456789012',o.text,o.reliable).status,'COINCIDE');assert.equal(inspect('ZZ123456789012',o.text,o.reliable).status,'DIVERGENTE');});
test('OCR incerto nunca aprova mesmo se o texto coincidir',()=>{const o=selectOCR([{text,confidence:79},{text,confidence:95}]);assert.equal(inspect('AB123456789012',o.text,o.reliable).status,'PENDENTE');});
test('Duas leituras diferentes ficam pendentes e preservam a candidata',()=>{const o=selectOCR([{text,confidence:95},{text:'NUMERO DE SERIE: AZ123456789012',confidence:90}]);const result=inspect('AB123456789012',o.text,o.reliable);assert.equal(result.status,'PENDENTE');assert.equal(result.print.serial,'AB123456789012');});
test('Região sem posição usa foto inteira',()=>assert.deepEqual(nearbyRegion(null,640,480),{x:0,y:0,w:640,h:480}));
