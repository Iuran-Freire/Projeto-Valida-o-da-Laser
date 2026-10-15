import {test} from 'node:test';
import assert from 'node:assert/strict';
import {samsungSerialCandidate,samsungSerialSample} from '../frontend/src/ocr/samsung-serial.mjs';
import {selectOCR,inspect} from '../shared/validation/inspection.mjs';
import {compatibleItems} from '../frontend/src/ocr/reader-recovery.mjs';
const serial='R37L8TGM511IPA';
const sample=text=>({text,fullText:text,confidence:0,lines:[{text,confidence:91,poly:[[10,10],[400,10],[400,30],[10,30]]}]});
test('série sem dois-pontos é aproveitada sem inventar ou substituir caracteres',()=>{
 for(const text of [serial,'NUMERO DE SERIE '+serial,'SN '+serial]){
  const result=samsungSerialSample(sample(text));
  assert.equal(result.text,'NÚMERO DE SÉRIE: '+serial);
  assert.equal(result.rawText,text);assert.equal(result.confidence,91);
 }
});
test('recusa números alheios, série truncada, dados do código e múltiplas séries',()=>{
 for(const text of ['01234567890123','R37L8TGM511IP','XR37L8TGM511IPA','R37L8TGM511IPAX','GH44-03247A+'+serial,serial+' R37L8TGM521IPA'])
  assert.equal(samsungSerialCandidate(text),null,text);
 const result=sample(serial);result.lines.push({text:'R37L8TGM521IPA',confidence:99});
 assert.equal(samsungSerialSample(result),result);
 const mixed=sample(serial);mixed.lines.push({text:serial+' R37L8TGM521IPA',confidence:99});
 assert.equal(samsungSerialSample(mixed),mixed);
});
test('série fragmentada em linhas não é remontada por suposição',()=>{
 assert.equal(samsungSerialCandidate('R37L8TG\nM511IPA'),null);
});
test('foto real do A13: espaços espúrios só são removidos na linha rotulada',()=>{
 const text='NUMERO DE SERIE : R37L8TGFMS T1PA-';
 const recovered=samsungSerialSample(sample(text));
 assert.equal(recovered.text,'NÚMERO DE SÉRIE: R37L8TGFMST1PA');
 assert.equal(recovered.rawText,text);
 const selected=selectOCR([recovered,recovered],'type-c-m09031d');
 assert.equal(selected.reliable,false);
 assert.notEqual(inspect('GH44-03247A+R37L8TGFM51IPA',selected.text,selected.reliable,false,'G','type-c-m09031d').status,'COINCIDE');
 assert.equal(samsungSerialCandidate('R37L8TGFMS T1PA'),null);
});
test('recuperação do rótulo sempre exige conferência mesmo com score alto',()=>{
 const recovered=samsungSerialSample(sample(serial));
 const selected=selectOCR([recovered,recovered],'type-c-m09031d');
 assert.equal(selected.reliable,false);
 const qr='GH44-03247A+'+serial;
 assert.equal(inspect(qr,selected.text,selected.reliable,false,'G','type-c-m09031d').status,'PENDENTE');
 assert.equal(inspect(qr,selected.text,selected.reliable,true,'G','type-c-m09031d').status,'COINCIDE');
});
test('recuperação de rótulo preserva I/1 e 5/S e continua apontando divergências',()=>{
 for(const raw of ['R37L8TGM5111PA','R37L8TGMS11IPA']){
  const recovered=samsungSerialSample(sample(raw));
  const best=selectOCR([recovered,recovered],'type-c-m09031d');
  const result=inspect('GH44-03247A+'+serial,best.text,best.reliable,true,'G','type-c-m09031d');
  assert.equal(result.status,'DIVERGENTE');assert.equal(result.print.serial,raw);
  assert.equal(recovered.rawText,raw);
 }
});
test('margem do leitor não desloca a posição usada no próximo recorte',()=>{
 const items=compatibleItems({blocks:[{paragraphs:[{lines:[{text:serial,confidence:80,bbox:{x0:20,y0:30,x1:200,y1:50}}]}]}]},10);
 assert.deepEqual(items[0].poly,[[10,20],[190,20],[190,40],[10,40]]);
});
