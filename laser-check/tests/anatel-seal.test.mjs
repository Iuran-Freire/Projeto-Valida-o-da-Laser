import {test} from 'node:test';
import assert from 'node:assert/strict';
import {anatelSealFor,extractAnatelNumber,extractAnatelTab,inspectAnatelSeal,inspectAnatelNumbers,ANATEL_SEALS} from '../shared/models/anatel-seal.mjs';

test('número de homologação cadastrado por modelo',()=>{
 assert.deepEqual([...anatelSealFor('15w-ve').numbers],['03340-19-04952']);
 assert.equal(anatelSealFor('type-c'),null);   // número do Type C ainda não informado
 assert.equal(anatelSealFor('oppo-45w'),null);
 assert.equal(anatelSealFor('__proto__'),null);
 for(const seal of Object.values(ANATEL_SEALS))for(const number of seal.numbers)assert.match(number,/^\d{5}-\d{2}-\d{5}$/);
});

test('lê o número de cima e o TAB do selo, aceitando variações de OCR nos traços',()=>{
 const seal='ANATEL\n14099-21-04952\nTAB 079329356';
 assert.equal(extractAnatelNumber(seal),'14099-21-04952');assert.equal(extractAnatelTab(seal),'079329356');
 for(const text of ['14099 21 04952','1409921-04952','14099—21—04952','14099-2104952','x14099-21-04952y'])
  assert.equal(extractAnatelNumber(text),'14099-21-04952',text);
});

test('não confunde o selo com outros números da etiqueta',()=>{
 const label='CNPJ 00.399.541/0001-34\nENTRADA:100-240 V~50-60 Hz 0,5 A\nTAB 405066215\n03340-19-04952';
 assert.equal(extractAnatelNumber(label),'03340-19-04952');
 assert.equal(extractAnatelNumber('CNPJ 00.399.541/0001-34'),null);
 assert.equal(extractAnatelNumber('TAB 079329356'),null);
 assert.equal(extractAnatelNumber('140992104952'),'14099-21-04952'); // twelve digits in a row
 assert.equal(extractAnatelNumber('1409921049520'),null);              // thirteen: not a seal number
 assert.equal(extractAnatelNumber('14099-21-04952\n03340-19-04952'),null); // two different seals: ambiguous
});

test('compara com o número do modelo, posição por posição',()=>{
 const ok=inspectAnatelSeal('15w-ve','03340-19-04952\nTAB 405134148');
 assert.equal(ok.status,'COINCIDE');assert.equal(ok.tab,'405134148');assert.ok(ok.positions.every(item=>item.match));
 const wrong=inspectAnatelSeal('15w-ve','14099-21-04952');
 assert.equal(wrong.status,'DIVERGENTE');assert.match(wrong.reason,/posição 1 esperada 0, lida 1/);
 assert.equal(wrong.positions.filter(item=>!item.match).length,7); // 03340-19 × 14099-21
 const unread=inspectAnatelSeal('15w-ve','ANATEL\nTAB 405134148');
 assert.equal(unread.status,'PENDENTE');assert.equal(unread.read,null);
 assert.equal(inspectAnatelSeal('type-c','03340-19-04952').status,'PENDENTE'); // modelo sem selo cadastrado
});

test('modelo com mais de um certificado aceita qualquer número cadastrado',()=>{
 const accepted=['14099-21-04952','03340-19-04952'];
 assert.equal(inspectAnatelNumbers(accepted,'14099-21-04952').status,'COINCIDE');
 assert.equal(inspectAnatelNumbers(accepted,'03340-19-04952').status,'COINCIDE');
 const near=inspectAnatelNumbers(accepted,'03340-19-04953');
 assert.equal(near.status,'DIVERGENTE');assert.equal(near.expected,'03340-19-04952'); // compared with the closest
 assert.equal(near.positions.filter(item=>!item.match).length,1);
});

test('letras no lugar de dígitos não são "corrigidas": a leitura fica pendente',()=>{
 assert.equal(extractAnatelNumber('14O99-21-04952'),null);
 assert.equal(inspectAnatelSeal('15w-ve','O3340-19-04952').status,'PENDENTE');
});
