import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {parseLGQR,inspectLGLabel} from '../shared/models/lg-label.mjs';

test('foto LG 24W: QR de 17 posições representa data, linha, Part No. e sequência',()=>{
  const qr=parseLGQR('IG9U2658889043905');
  assert.equal(qr.valid,true);
  assert.deepEqual([qr.year,qr.month,qr.day,qr.line,qr.partNo,qr.sequence],[2026,9,28,'2','65888904','3905']);
});

test('etiqueta LG 24W coincide somente com QR, Code 93 e texto impresso compatíveis',()=>{
  const good=inspectLGLabel('IG9U2658889043905','EAY65888904','EAY65888904 (1.8)',false,true);
  assert.equal(good.status,'COINCIDE');
  assert.equal(inspectLGLabel('IG9U2658889043905','EAY65888905','EAY65888904 (1.8)',true).status,'DIVERGENTE');
  assert.equal(inspectLGLabel('IG9U2658889043905','EAY65888904','EAY65888905 (1.8)',true).status,'DIVERGENTE');
  assert.equal(inspectLGLabel('IG9U2658889043905','EAY65888904','',true).status,'PENDENTE');
  assert.equal(inspectLGLabel('IG9U2658889043905','EAY65888904','EAY65888904 (2.0)',true).status,'COINCIDE');
  assert.equal(inspectLGLabel('IG9U2658889043905','EAY65888904','EAY65888904 (1.8)',false,false).status,'PENDENTE');
  assert.equal(inspectLGLabel('IG9U2658889043905','ABC65888904','EAY65888904',true).status,'DIVERGENTE');
  assert.equal(parseLGQR('IG9U2658889040000').valid,false);
  assert.equal(parseLGQR('IG9U2658889041000').valid,true);
});


test('LG 32W exige Part No. 65889910 nas três fontes',()=>{
 const qr='IA312658899100001',barcode='EAY65889910',printed='EAY65889910 (0.1)';
 assert.equal(parseLGQR(qr).valid,true);
 assert.equal(inspectLGLabel(qr,barcode,printed,true,true,'lg-32w').status,'COINCIDE');
 assert.equal(inspectLGLabel(qr,barcode,printed,true,true,'lg-24w').status,'DIVERGENTE');
 assert.equal(inspectLGLabel('IA312658889040001','EAY65888904','EAY65888904 (0.1)',true,true,'lg-32w').status,'DIVERGENTE');
 assert.equal(inspectLGLabel(qr,barcode,'EAY65888904 (0.1)',true,true,'lg-32w').status,'DIVERGENTE');
});
