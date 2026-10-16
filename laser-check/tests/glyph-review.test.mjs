import {test} from 'node:test';
import assert from 'node:assert/strict';
import {enhanceGlyphPixels,glyphRefinementIndexes,markGlyphReview} from '../frontend/src/ocr/glyph-review.mjs';
import {modelReaderOptions} from '../frontend/src/ocr/model-reader-options.mjs';
import {selectOCR} from '../shared/validation/inspection.mjs';
import {samsungSerialCandidate} from '../frontend/src/ocr/samsung-serial.mjs';

test('contraste e nitidez preservam dimensões e tons finos sem binarizar ou alterar a origem',()=>{
 const width=64,height=48,pixels=new Uint8ClampedArray(width*height*4);
 for(let p=0;p<width*height;p++){const g=60+(p%width)*2;pixels.set([g,g,g,255],p*4);}
 const original=pixels.slice();
 for(const variant of ['contraste','nitidez']){
  const out=enhanceGlyphPixels(pixels,width,height,variant);
  assert.equal(out.length,pixels.length);assert.deepEqual(pixels,original);
  assert.ok(new Set(Array.from(out).filter((_,i)=>i%4===0)).size>20);
  assert.equal(out[3],255);
 }
});

test('releitura prioriza as linhas de identificação, com limite para a memória do A13',()=>{
 const extract=text=>/^I\d{9}$/.test(text)?text:'';
 const lines=[{text:'Power Supply Unit'},...Array.from({length:8},(_,i)=>({text:'I26380357'+i}))];
 assert.deepEqual(glyphRefinementIndexes(lines,extract),[1,2,3]);
 assert.deepEqual(glyphRefinementIndexes([{text:'ABCDEF'}],extract),[]);
});

test('I/1 e 5/S discordantes continuam intactos e exigem conferência em formatos diferentes',()=>{
 for(const [model,a,b] of [
  ['oppo-45w','SN: I6AD11100051','SN: 16AD11100051'],
  ['oppo-45w','SN: I6AD11100051','SN: I6AD111000S1'],
  ['type-c-m09031d','NUMERO DE SERIE:R37L8TGFM51IPA','NUMERO DE SERIE:R37L8TGFMS1IPA'],
  ['frecom-24w','I263803579','1263803579'],
  ['a08-battery','2026.10.01\nPW1LA01FS/--','2026.10.01\nPWILA01FS/--'],
 ]){
  const extract=modelReaderOptions(model).extractSerial;
  const readings=[{text:a,fullText:a},{text:b,fullText:b}];
  const results=markGlyphReview(readings,extract);
  assert.ok(results.every(item=>item.glyphReview&&item.forceManualReview),model);
  assert.deepEqual(results.map(item=>item.text),[a,b]);
  assert.equal(readings[0].glyphReview,undefined);
 }
});

test('baixa confiança em um caractere pede revisão mesmo com score médio alto',()=>{
 const line={text:'SN: I6AD11100051',confidence:98,glyphs:[{index:4,char:'I',uncertain:true}]};
 const results=markGlyphReview([{text:line.text,lines:[line]}],modelReaderOptions('oppo-45w').extractSerial);
 assert.equal(results[0].glyphReview,true);
 const clear={...line,glyphs:[{index:4,char:'I',uncertain:false}]};
 assert.equal(markGlyphReview([{text:clear.text,lines:[clear]}],modelReaderOptions('oppo-45w').extractSerial)[0].glyphReview,undefined);
});
test('diagnóstico real: usa a candidata completa repetida, preservando tentativas discordantes',()=>{
 const values=[['R37LOTGFMS1IPA',98],['R37LOTGFMS1IPA',96],['R37L8TGFMS1IPA',96],['R37LOTGFMS1IPA',98],['R37L8TGFM51IPA',97],['R37L8TGFM51IPA',98]];
 const attempts=values.map(([serial,confidence])=>({text:'NÚMERO DE SÉRIE: '+serial,confidence}));
 const reviewed=markGlyphReview(attempts,samsungSerialCandidate),best=selectOCR(reviewed,'type-c-m09031d');
 assert.equal(samsungSerialCandidate(best.text),'R37L8TGFM51IPA');
 assert.equal(best.reliable,false);assert.equal(best.selectionSupport,2);
 assert.deepEqual(reviewed.map(item=>item.text),attempts.map(item=>item.text));
});
test('média alta e repetição não escondem baixa confiança em S/5',()=>{
 const sample=(serial,weakIndex,value)=>{
  const text='NÚMERO DE SÉRIE: '+serial,start=text.indexOf(serial);
  return {text,confidence:98,lines:[{text,confidence:98,glyphs:[...serial].map((char,i)=>({index:start+i,char,score:i===weakIndex?value:.99}))}]};
 };
 const wrong=sample('R37L8TGFMS1IPA',9,.6),correct=sample('R37L8TGFM51IPA',0,.84);
 const readings=markGlyphReview([wrong,wrong,correct],samsungSerialCandidate),best=selectOCR(readings,'type-c-m09031d');
 assert.equal(samsungSerialCandidate(best.text),'R37L8TGFM51IPA');
 assert.equal(best.serialGlyphConfidence,84);
 assert.equal(best.reliable,false);
 assert.equal(readings[0].selectionSupport,2);assert.equal(readings[0].serialGlyphConfidence,60);
});
