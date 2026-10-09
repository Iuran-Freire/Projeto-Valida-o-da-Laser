import {test} from 'node:test';
import assert from 'node:assert/strict';
import {inspect} from '../shared/validation/inspection.mjs';
import {readingResultNotice} from '../frontend/src/reading-view.mjs';
const qr='GH44-03247A+R37L9RGJ0K2IPA';
const printed='NUMERO DESERIE:R37L9RGJ0K2IPA';
test('OCR incerto com diferença destaca divergência sem dispensar confirmação',()=>{
 const result=inspect(qr,'NUMERO DESERIE:R37L9RGJOK2IPA',false,false,'G');
 assert.equal(result.status,'PENDENTE');
 assert.equal(readingResultNotice(result).style,'mismatch');
 assert.match(readingResultNotice(result).description,/confirmação/);
});
test('Leituras iguais aparecem em verde mesmo com OCR incerto; confirmação permanece',()=>{
 const result=inspect(qr,printed,false,false,'G');
 assert.equal(result.status,'PENDENTE');
 assert.equal(readingResultNotice(result).title,'Leituras coincidem');
 assert.equal(readingResultNotice(result).style,'match');
 assert.match(readingResultNotice(result).description,/confirmação/);
 assert.doesNotMatch(readingResultNotice(result,true).description,/marque a confirmação/);
});
test('Leitura incompleta e divergência de turno não são apresentadas como coincidência',()=>{
 assert.equal(readingResultNotice(inspect(qr,'',false,false,'G')),null);
 assert.equal(readingResultNotice(inspect(qr,printed,false,false,'H')),null);
});
