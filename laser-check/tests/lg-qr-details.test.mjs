import {test} from 'node:test';
import assert from 'node:assert/strict';
import {describeLGQR} from '../shared/models/lg-label.mjs';
test('LG: tabela explica todas as posições do QR da foto',()=>{const {qr,rows}=describeLGQR('IG9V2658889042001');assert.equal(qr.valid,true);assert.ok(rows.every(row=>row.valid));assert.deepEqual([qr.year,qr.month,qr.day,qr.line,qr.partNo,qr.sequence],[2026,9,29,'2','65888904','2001']);});
test('LG: tabela aponta fixo errado, data impossível, sequência inválida e tamanho incorreto',()=>{assert.equal(describeLGQR('XG9V2658889042001').rows[0].valid,false);assert.equal(describeLGQR('IG2X2658889042001').rows[3].valid,false);assert.equal(describeLGQR('IG9V2658889040000').rows[6].valid,false);assert.ok(describeLGQR('IG9').rows.every(row=>!row.valid));});
