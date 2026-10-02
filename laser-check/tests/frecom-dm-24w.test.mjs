import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {parseFrecomDMSerial,parseFrecomDMCode,inspectFrecomDMLabel,extractFrecomDMPrinted} from '../shared/models/frecom-dm-24w.mjs';

test('Frecom 33K0009 interpreta data, linha e contador da série',()=>{
 const serial=parseFrecomDMSerial('B9PB0391IP');
 assert.equal(serial.valid,true);
 assert.deepEqual([serial.year,serial.month,serial.day,serial.shiftCode,serial.sequence],[2026,9,23,'B','039']);
});

test('Frecom 33K0009 rejeita formato e posições fixas inválidas',()=>{
 for(const value of ['B9PB0392IP','B9PB0391OP','B9PB0001IP','B9PD0391IP','BOPB0391IP','B9PB0391I','B9PB0391IPX'])assert.equal(parseFrecomDMSerial(value).valid,false,value);
});

test('Frecom 33K0009 exige prefixo e série impressa idêntica',()=>{
 assert.equal(parseFrecomDMCode('FC024A09+B9PB0391IP').valid,true);
 assert.equal(inspectFrecomDMLabel('FC024A09+B9PB0391IP','B9PB0391IP',true,true).status,'COINCIDE');
 assert.equal(inspectFrecomDMLabel('FC024A09+B9PB0391IP','B9PB0401IP',true,true).status,'DIVERGENTE');
 assert.equal(inspectFrecomDMLabel('FC024A08+B9PB0391IP','B9PB0391IP',true,true).status,'DIVERGENTE');
 assert.equal(inspectFrecomDMLabel('FC024A09+B9PB0391IP','',true,true).status,'PENDENTE');
 assert.equal(extractFrecomDMPrinted('B9PB0391IP\nB9PB0401IP'),'');
});
