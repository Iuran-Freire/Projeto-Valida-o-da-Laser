import test from 'node:test';
import assert from 'node:assert/strict';
import {parseFrecomCode,extractFrecomPrinted,inspectFrecomLabel,FRECOM_24W_ID} from '../shared/models/frecom-24w.mjs';
import {MODEL_PROFILES,isValidRecordShift} from '../shared/models/serial-profile.mjs';

test('Frecom 24W identifica PN e campos do código de dez caracteres',()=>{
 assert.equal(MODEL_PROFILES[FRECOM_24W_ID].label,'33K0008 - Frecom 24W');
 assert.deepEqual([parseFrecomCode('I263803579').year,parseFrecomCode('I263803579').week,parseFrecomCode('I263803579').sequence],[2026,38,3579]);
 assert.equal(parseFrecomCode('I263803579').valid,true);
 assert.equal(isValidRecordShift({model:FRECOM_24W_ID,shift:'H',status:'COINCIDE'}),true);
});
test('Frecom rejeita I ausente, semana e sequência inválidas',()=>{
 for(const code of ['1263803579','I260003579','I265403579','I263800000'])assert.equal(parseFrecomCode(code).valid,false,code);
});
test('Frecom só coincide com texto único e mesmo código',()=>{
 assert.equal(extractFrecomPrinted('I263803579'), 'I263803579');
 assert.equal(extractFrecomPrinted('I263803579\nI263803580'), '');
 assert.equal(inspectFrecomLabel('I263803579','I263803579',true,false).status,'COINCIDE');
 assert.equal(inspectFrecomLabel('I263803579','I263803580',true,false).status,'DIVERGENTE');
 assert.equal(inspectFrecomLabel('I263803579','I263803579',false,false).status,'PENDENTE');
});
