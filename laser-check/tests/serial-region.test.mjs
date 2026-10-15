import {test} from 'node:test';
import assert from 'node:assert/strict';
import {serialRegion} from '../frontend/src/ocr/serial-region.mjs';
const region={x:100,y:200,w:600,h:200},source={width:1000,height:800};
const line=(text='NUMERO DE SERIE:R37L8TGM511IPA')=>({text,poly:[[20,30],[820,30],[820,70],[20,70]]});
test('recorte compatível preserva rótulo, separador e início da série sem consultar o 2D',()=>{
 assert.deepEqual(serialRegion({lines:[line()]},region,1200,source,{wholeLine:true}),{x:102,y:207,w:420,h:36});
});
test('linha com caracteres faltantes ainda permite releitura pelo rótulo visível',()=>{
 const attempt={lines:[line('NUMERO DE SERIE:R37L8TGM5')]};
 assert.ok(serialRegion(attempt,region,1200,source,{wholeLine:true}));
 assert.equal(serialRegion(attempt,region,1200,source),null);
});
test('não escolhe arbitrariamente entre duas séries ou rótulos',()=>{
 for(const lines of [[line(),line('SN:R37L8TGM521IPA')],[line('SN:ilegivel'),line('SN:duvida')]])
  assert.equal(serialRegion({lines},region,1200,source,{wholeLine:true}),null);
});
test('recorte respeita bordas da foto e rejeita coordenadas inválidas',()=>{
 const edge={text:line().text,poly:[[-10,-10],[1200,-10],[1200,300],[-10,300]]};
 assert.deepEqual(serialRegion({lines:[edge]},{x:0,y:0,w:600,h:150},1200,{width:600,height:150},{wholeLine:true}),{x:0,y:0,w:600,h:150});
 edge.poly[0][0]=NaN;
 assert.equal(serialRegion({lines:[edge]},region,1200,source,{wholeLine:true}),null);
});
