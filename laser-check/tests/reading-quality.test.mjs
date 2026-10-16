import {test} from 'node:test';
import assert from 'node:assert/strict';
import {modelReaderOptions} from '../frontend/src/ocr/model-reader-options.mjs';

const sample=(text,confidence)=>({text,fullText:text,confidence,lines:[{text,confidence}]});

test('caso A13: uma série extraída com score 34 em seis tentativas pede outro leitor',()=>{
 const opts=modelReaderOptions('type-c-m09031d');
 const attempts=[sample('NUMERO DE SERIE:R37L8TGFMSTIPA',34),...Array.from({length:5},()=>sample('texto incompleto',20))];
 assert.equal(opts.isReadable(attempts),true);
 assert.equal(opts.isConfident(attempts),false);
});

test('duas leituras fortes são preservadas em todos os modelos sem consultar código 2D',()=>{
 for(const [model,text] of [
  ['type-c','NUMERO DE SERIE:R37L8TGFM52IPA'],
  ['type-c-m09031d','NUMERO DE SERIE:R37L8TGFM51IPA'],
  ['15w-ve','NUMERO DE SERIE:R37L8TGFM52IPA'],
  ['oppo-45w','SN: I6AD11100051'],
  ['frecom-24w','I263803579'],
  ['frecom-dm-24w','B9PB0391IP'],
  ['lg-psu-28w','IBN13658992060001 (1.1)'],
  ['lg-24w','EAY65888904 (1.8)'],
  ['lg-32w','EAY65889910 (0.1)'],
  ['a08-battery','2026.10.01\nPW1LA01FS/--'],
  ['a08-battery-62','2026.10.01\nPW1LA01FS/--'],
 ]){
  const opts=modelReaderOptions(model);
  assert.equal(opts.isConfident([sample(text,98),sample(text,96)]),true,model);
  assert.equal(opts.isConfident([sample(text,34),sample(text,36)]),false,model);
 }
});

test('score alto de outra linha não mascara a confiança baixa da série',()=>{
 const text='SN: I6AD11100051',opts=modelReaderOptions('oppo-45w');
 const item={text,fullText:'Power Supply Unit\n'+text,confidence:99,lines:[{text:'Power Supply Unit',confidence:99},{text,confidence:34}]};
 assert.equal(opts.isConfident([item,item]),false);
});

test('resultado inconsistente ou caractere ambíguo aciona recuperação; revisão manual não desliga leitor',()=>{
 const opts=modelReaderOptions('oppo-45w'),a=sample('SN: I6AD11100051',98),b=sample('SN: I6AD111000S1',98);
 assert.equal(opts.isConfident([a,b]),false);
 assert.equal(opts.isConfident([{...a,glyphReview:true},{...a,glyphReview:true}]),false);
 assert.equal(opts.isConfident([{...a,forceManualReview:true},{...a,forceManualReview:true}]),true);
});

test('A08 exige confiança na data e no código; LG usa Part No. sem ruído de cabeçalho',()=>{
 const a08=modelReaderOptions('a08-battery'),date={text:'2026.10.01',confidence:99},code={text:'PW1LA01FS/--',confidence:32};
 const item={text:date.text+'\n'+code.text,confidence:99,lines:[date,code]};
 assert.equal(a08.isConfident([item,item]),false);
 assert.equal(a08.isConfident([item,{...item,lines:[date,{...code,confidence:99}]}]),false);
 const strong={...item,lines:[date,{...code,confidence:99}]};
 assert.equal(a08.isConfident([strong,strong]),true);
 const lg=modelReaderOptions('lg-24w');
 assert.equal(lg.isConfident([sample('Power Supply Unit\nEAY65888904 (1.8)',95),sample('EAY65888904 (1.8)',95)]),true);
});
