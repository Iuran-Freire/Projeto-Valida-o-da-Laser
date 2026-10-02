import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseA08QR,parseA08Print,inspectA08Battery,A08_BATTERY_62_ID} from '../shared/models/a08-battery.mjs';

const correct='GH83-13417B+PW1LA01FS+77321W';
const wrong='GH83-13417A+PW1LA01FS+77321W';
const percent62='GH83-13419A+PW1LA01FS+77321W';
const print='2026.10.01\nPW1LA01FS/--';

test('A08: 30% exige SEC CODE GH83-13417B e 62% exige GH83-13419A',()=>{
  assert.equal(inspectA08Battery(correct,print,true).status,'COINCIDE');
  assert.equal(inspectA08Battery(percent62,print,true,false,A08_BATTERY_62_ID).status,'COINCIDE');
  assert.equal(inspectA08Battery(correct,print,true,false,A08_BATTERY_62_ID).status,'DIVERGENTE');
  const check=inspectA08Battery(wrong,print,true);
  assert.equal(check.status,'DIVERGENTE');
  assert.match(check.reason,/GH83-13417B/);
  assert.equal(check.qr.date,'2026.10.01');
  assert.equal(check.qr.printCode,'PW1LA01FS');
});

test('A08: data e código pontilhado são comparados separadamente',()=>{
  assert.match(inspectA08Battery(correct,'2026.10.02\nPW1LA01FS/--',true).reason,/Data diferente/);
  assert.match(inspectA08Battery(correct,'2026.10.01\nPW1LA02FS\/--',true).reason,/Código de fabricação diferente/);
  assert.equal(inspectA08Battery(correct,'2026.10.01',true).status,'PENDENTE');
  assert.equal(inspectA08Battery(correct,print,false).status,'PENDENTE');
  assert.equal(inspectA08Battery(correct,print,false,true).status,'COINCIDE');
  assert.equal(parseA08Print('2026.10.01\nPW1LA01FS/--').printCode,'PW1LA01FS');
});

test('A08: rejeita data inexistente, fixos, número de série e formato incompleto',()=>{
  assert.equal(parseA08QR('GH83-13417B+PW1L931FS+77321W').valid,false);
  assert.equal(parseA08QR('GH83-13417B+PW1LA01FS+00000W').valid,false);
  assert.equal(parseA08QR('GH83-13417B+PW1LA01FS+77321X').valid,false);
  assert.equal(parseA08QR('GH83-13417B+PW1LA01FS').valid,false);
});
