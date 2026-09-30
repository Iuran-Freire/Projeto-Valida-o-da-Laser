import {test} from 'node:test';
import assert from 'node:assert/strict';
import {selectLGPrintedText} from '../frontend/src/ocr/lg-label-text.mjs';
import {parseLGPrinted,inspectLGLabel} from '../shared/models/lg-label.mjs';

test('LG: exclui ruído do OCR e preserva a linha EAY fotografada',()=>{
  assert.equal(selectLGPrintedText('樂\n3\nEAY65888904 (1.8)'), 'EAY65888904 (1.8)');
  assert.equal(selectLGPrintedText('樂\n3'), '');
});
test('LG: seleção não corrige letras/números nem escolhe entre etiquetas diferentes',()=>{
  const wrong=selectLGPrintedText('3\nEAY658889O4 (1.8)');
  assert.equal(wrong,'EAY658889O4 (1.8)');
  assert.equal(parseLGPrinted(wrong).valid,false);
  const conflict=selectLGPrintedText('EAY65888904 (1.8)\n3\nEAY65888905 (1.8)');
  assert.equal(parseLGPrinted(conflict).valid,false);
  assert.notEqual(inspectLGLabel('IG9V2658889042001','EAY65888904',conflict,true,true).status,'COINCIDE');
});

test('LG: ruído na mesma linha ou separado por CR não aparece no campo',()=>{
  assert.equal(selectLGPrintedText('题 EAY65888904 (1.8)'),'EAY65888904 (1.8)');
  assert.equal(selectLGPrintedText('题\rEAY65888904 (1.8)'),'EAY65888904 (1.8)');
});
