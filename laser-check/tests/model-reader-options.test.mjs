import {test} from 'node:test';
import assert from 'node:assert/strict';
import {modelReaderOptions} from '../frontend/src/ocr/model-reader-options.mjs';

const samples={
 'type-c':'NUMERO DE SERIE:R37L8TGM512IPA',
 'type-c-m09031d':'NUMERO DE SERIE:R37L8TGM511IPA',
 '15w-ve':'NUMERO DE SERIE:R37L8TGM512IPA',
 'oppo-45w':'SN: I6AD11100001',
 'frecom-24w':'I263803579',
 'frecom-dm-24w':'B9PB0391IP',
 'lg-psu-28w':'IBN13658992060001 (1.1)',
 'lg-24w':'EAY65888904 (1.8)',
 'lg-32w':'EAY65889910 (0.1)',
 'a08-battery':'2026.10.01\nPW1LA01FS/--',
 'a08-battery-62':'2026.10.01\nPW1LA01FS/--',
};
test('todos os modelos usam o mesmo fluxo principal/alternativo, com extração própria',()=>{
 for(const [model,text] of Object.entries(samples)){
  const opts=modelReaderOptions(model);
  assert.equal(opts.directSerialReader,undefined,model);
  assert.ok(opts.extractSerial(text),model);
  assert.equal(opts.isReadable([{text,fullText:text}]),true,model);
  assert.equal(opts.isReadable([{text:'Power Supply Unit',fullText:'Power Supply Unit'}]),false,model);
 }
});
test('formatos OPPO, LG e Frecom não recebem regras de serial Samsung',()=>{
 for(const model of ['oppo-45w','frecom-24w','frecom-dm-24w','lg-psu-28w','lg-24w','lg-32w','a08-battery']){
  const opts=modelReaderOptions(model);assert.equal(opts.allowUnlabelledSerial,false);assert.equal(opts.lightOnDark,false);
  assert.equal(!!opts.extractSerial('NUMERO DE SERIE:R37L8TGM511IPA'),false,model);
 }
});
test('polaridade da impressão: Type C preto com letra clara; 15W VE branco com letra escura',()=>{
 assert.equal(modelReaderOptions('type-c').lightOnDark,true);
 assert.equal(modelReaderOptions('type-c-m09031d').lightOnDark,true);
 assert.equal(modelReaderOptions('15w-ve').lightOnDark,false);
 // The Samsung serial rules still apply to the white 15W VE.
 assert.equal(modelReaderOptions('15w-ve').allowUnlabelledSerial,true);
});
