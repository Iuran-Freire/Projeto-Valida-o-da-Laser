import {test} from 'node:test';import assert from 'node:assert/strict';
import {selectOCR,inspect,nearbyRegion} from '../src/inspection.mjs';
const text='NUMERO DE SERIE: AB123456789012';
test('Duas leituras consistentes e confiáveis permitem comparação automática',()=>{const o=selectOCR([{text,confidence:90},{text,confidence:85}]);assert.equal(o.reliable,true);assert.equal(inspect('AB123456789012',o.text,o.reliable).status,'COINCIDE');assert.equal(inspect('ZZ123456789012',o.text,o.reliable).status,'DIVERGENTE');});
test('OCR incerto nunca aprova mesmo se o texto coincidir',()=>{const o=selectOCR([{text,confidence:79},{text,confidence:95}]);assert.equal(inspect('AB123456789012',o.text,o.reliable).status,'PENDENTE');});
test('Duas leituras diferentes ficam pendentes e preservam a candidata',()=>{const o=selectOCR([{text,confidence:95},{text:'NUMERO DE SERIE: AZ123456789012',confidence:90}]);const result=inspect('AB123456789012',o.text,o.reliable);assert.equal(result.status,'PENDENTE');assert.equal(result.print.serial,'AB123456789012');});
test('O lido no lugar de 0 exige conferência sem alterar a leitura original',()=>{
 const qr='GH44-03247A+R37L9RGJ0K2IPA',ocr='NUMERO DESERIE:R37L9RGJOK2IPA';
 const selected=selectOCR([{text:ocr,confidence:96},{text:ocr,confidence:96}],'type-c');
 assert.equal(selected.reliable,false);
 const pending=inspect(qr,selected.text,selected.reliable,false,'G');
 assert.equal(pending.status,'PENDENTE');
 assert.deepEqual(pending.ocrAmbiguity,{index:8,position:9,read:'O',expected:'0'});
 assert.match(pending.reason,/OCR leu O na posição 9/);
 assert.equal(inspect(qr,ocr,true,false,'G').status,'PENDENTE');
 assert.equal(inspect(qr,ocr,false,true,'G').status,'DIVERGENTE');
 assert.equal(inspect(qr,'NUMERO DESERIE:R37L9RGJ0K2IPA',false,true,'G').status,'COINCIDE');
});
test('Séries exibidas iguais com OCR incerto explicam a pendência sem alegar divergência entre as fontes',()=>{const result=inspect('GH44-03247A+R37L9QHG2P2IPA','NUMERO DE SERIE:R37L9QHG2P2IPA',false);assert.equal(result.status,'PENDENTE');assert.equal(result.rawComparison,'COINCIDE');assert.match(result.reason,/séries exibidas coincidem/i);assert.equal(inspect('GH44-03247A+R37L9QHG2P2IPA','NUMERO DE SERIE:R37L9QHG2P2IPA',false,true).status,'COINCIDE');});
test('Região sem posição usa foto inteira',()=>assert.deepEqual(nearbyRegion(null,640,480),{x:0,y:0,w:640,h:480}));
test('15W VE procura tampografia acima do Data Matrix; TYPE C mantém recorte antigo',()=>{
 const position={topLeft:{x:200,y:400},topRight:{x:300,y:400},bottomLeft:{x:200,y:500},bottomRight:{x:300,y:500}};
 const ve=nearbyRegion(position,1000,1000,'15w-ve'),typeC=nearbyRegion(position,1000,1000,'type-c');
 assert.ok(ve.y<400&&ve.y+ve.h<500&&ve.w>200);
 assert.ok(typeC.y>500);
});
test('OCR exibe a linha completa quando o recorte ampliado lê a mesma série',()=>{
 const full='NUMERO DE SERIE: AB123456789012';
 const selected=selectOCR([{text:'E:AB123456789012',confidence:98},{text:full,confidence:95}],false);
 assert.equal(selected.text,full);
 assert.equal(selected.reliable,true);
});
test('turno informado valida o código 2D mesmo quando código e tampografia coincidem',()=>{
 const qr='GH44-03247A+R37L9QHG2P2IPA',print='NUMERO DE SERIE:R37L9QHG2P2IPA';
 assert.equal(inspect(qr,print,true,false,'H').status,'COINCIDE');
 const mismatch=inspect(qr,print,true,false,'G');
 assert.equal(mismatch.status,'DIVERGENTE');
 assert.equal(mismatch.shiftCheck.actual,'H');
 assert.match(mismatch.reason,/Código 2D: 1º turno exige G na posição 7; lido H/);
 assert.equal(inspect('GH44-03247A+R37L9QAE3Y2IPA','NUMERO DE SERIE:R37L9QAE3Y2IPA',true,false,'G').status,'DIVERGENTE');
 assert.equal(inspect(qr,'',false,false,'G').status,'DIVERGENTE');
 assert.equal(inspect('OUTRO+R37L9QHG2P2IPA',print,true,false,'H').status,'DIVERGENTE');
 assert.equal(inspect('{"serial":"R37L9QHG2P2IPA"}',print,true,false,'H').status,'PENDENTE');
});
test('SEC CODE errado é divergente mesmo se as séries coincidirem ou faltar OCR',()=>{
 const qr='GH44-03246A+R37L9QHG2P2IPA',print='NUMERO DE SERIE:R37L9QHG2P2IPA';
 for(const ocr of [print,'']){
  const result=inspect(qr,ocr,true,false,'H');
  assert.equal(result.status,'DIVERGENTE');
  assert.match(result.reason,/SEC CODE.*esperado GH44-03247A; lido GH44-03246A/);
 }
});
test('fixos da série no próprio QR são divergentes antes de ler a tampografia',()=>{
 for(const [serial,position] of [['X37L9QHG2P2IPA',1],['R37L9QHG2P21PA',12],['R37L9QHG2P2IPB',14]]){
  const result=inspect('GH44-03247A+'+serial,'',false,false,'H');
  assert.equal(result.status,'DIVERGENTE');
  assert.match(result.reason,new RegExp(`Código 2D: posição ${position} `));
 }
});
