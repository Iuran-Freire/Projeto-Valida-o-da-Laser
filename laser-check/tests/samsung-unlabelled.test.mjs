import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {modelReaderOptions} from '../frontend/src/ocr/model-reader-options.mjs';
import {samsungUnlabelledSample} from '../frontend/src/ocr/samsung-serial.mjs';
import {extractPrint} from '../shared/validation/compare.mjs';
import {selectOCR,inspect} from '../shared/validation/inspection.mjs';

// Real PP-OCRv5 output (main reader) for a white 15W VE photo. The reader split
// "NÚMERO DE SÉRIE:" into separate boxes but read the serial line correctly.
const fixture=JSON.parse(readFileSync(new URL('./fixtures/15w-ve-white-primary.json',import.meta.url),'utf8'));
const serial='R37LB9G58L2IPA';

// Same selection the main reader applies to each OCR pass (paddle-reader sample()).
function asAttempt({variant,lines}){
 const fullText=lines.map(line=>line.text).join('\n'),candidates=lines.filter(line=>extractPrint(line.text).serial);
 const chosen=candidates.length===1?candidates[0]:null;
 return {text:chosen?.text||fullText,fullText,confidence:chosen?.confidence||0,model:'PP-OCRv5_mobile_rec',variant,lines};
}

test('15W VE: série lida pelo leitor principal é aceita mesmo com rótulo quebrado ou sem ":"',()=>{
 const opts=modelReaderOptions('15w-ve');
 for(const [name,passes] of Object.entries(fixture.photos)){
  const attempts=passes.map(asAttempt);
  // Before the fix these were "unread" and the app fell back to slower readers.
  assert.equal(attempts.some(item=>extractPrint(item.fullText).serial),false,name);
  assert.equal(opts.isReadable(attempts),true,name);
  // Two passes agree with high confidence: no second reader needed (less memory on the A13).
  assert.equal(opts.isConfident(attempts),true,name);
  const normalized=attempts.map(samsungUnlabelledSample);
  for(const item of normalized)assert.equal(extractPrint(item.text).serial,serial,name);
  assert.ok(normalized.some(item=>item.serialLabelInferred&&item.forceManualReview),name);
  // The original OCR text is kept for the record.
  for(const item of normalized.filter(item=>item.serialLabelInferred))assert.equal(item.rawText,item.fullText,name);
 }
});

test('série sem rótulo exige conferência visual antes de concluir',()=>{
 const normalized=fixture.photos['sem-rotulo'].map(asAttempt).map(samsungUnlabelledSample);
 const best=selectOCR(normalized,'15w-ve');
 assert.equal(extractPrint(best.text).serial,serial);
 assert.equal(best.reliable,false);
 assert.equal(inspect(fixture.code,best.text,best.reliable,false,'','15w-ve').status,'PENDENTE');
 assert.equal(inspect(fixture.code,best.text,best.reliable,true,'','15w-ve').status,'COINCIDE');
});

test('leitura principal com rótulo completo continua igual (sem conferência extra)',()=>{
 const line=text=>({text,fullText:text,confidence:97,lines:[{text,confidence:97,poly:[[0,0],[400,0],[400,30],[0,30]]}]});
 const attempts=[line('NUMERO DE SERIE:'+serial),line('NÚMERO DE SÉRIE: '+serial)];
 for(const item of attempts)assert.equal(samsungUnlabelledSample(item),item);
 const best=selectOCR(attempts.map(samsungUnlabelledSample),'15w-ve');
 assert.equal(best.reliable,true);
 assert.equal(inspect(fixture.code,best.text,best.reliable,false,'','15w-ve').status,'COINCIDE');
});

test('nenhum caractere vem do código 2D: divergência lida na foto é mantida',()=>{
 const opts=modelReaderOptions('15w-ve');
 assert.equal(opts.extractSerial(fixture.code),null);
 assert.equal(opts.extractSerial('GH44-03086A+'+serial),null);
 // Same photo passes, but the print shows "1" where the code has "I".
 const misprint=fixture.photos['sem-rotulo'].map(pass=>({...pass,lines:pass.lines.map(line=>({...line,text:line.text.replace(serial,'R37LB9G58L21PA')}))}));
 const normalized=misprint.map(asAttempt).map(samsungUnlabelledSample);
 const best=selectOCR(normalized,'15w-ve');
 assert.equal(extractPrint(best.text).serial,'R37LB9G58L21PA');
 assert.notEqual(inspect(fixture.code,best.text,best.reliable,false,'','15w-ve').status,'COINCIDE');
 assert.equal(inspect(fixture.code,best.text,best.reliable,true,'','15w-ve').status,'DIVERGENTE');
});

test('regra Samsung não vale para os demais modelos',()=>{
 for(const model of ['oppo-45w','frecom-24w','frecom-dm-24w','lg-psu-28w','lg-24w','lg-32w','a08-battery'])
  assert.equal(!!modelReaderOptions(model).extractSerial(serial),false,model);
 for(const model of ['type-c','type-c-m09031d','15w-ve'])
  assert.equal(modelReaderOptions(model).extractSerial('NUMERO\nSERIE\nDE\n'+serial),serial,model);
});
