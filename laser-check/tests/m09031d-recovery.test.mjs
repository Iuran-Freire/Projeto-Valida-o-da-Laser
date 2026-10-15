import {test} from 'node:test';
import assert from 'node:assert/strict';
import {searchBands,readCodeWithRetry} from '../frontend/src/ocr/m09031d-recovery.mjs';
test('recortes sobrepostos cobrem a foto sem cortar horizontalmente a série',()=>{
 const bands=searchBands(1920,2560);
 assert.equal(bands.length,3);
 for(const b of bands){assert.equal(b.x,0);assert.equal(b.w,1920);assert.ok(b.y>=0&&b.y+b.h<=2560);assert.ok(b.h<2560);}
 for(let y=0;y<2560;y++)assert.ok(bands.some(b=>y>=b.y&&y<b.y+b.h));
 assert.deepEqual(searchBands(0,100),[]);
});
test('segunda tentativa usa a mesma foto e preserva posição do código',async()=>{
 const input={},calls=[],code={text:'GH44-03247A+R37L8TGM511IPA',position:{topLeft:{x:100,y:200}}};
 const found=await readCodeWithRetry(async(image,options)=>{assert.equal(image,input);calls.push(options);return calls.length===1?[]:[code];},input,()=>{});
 assert.deepEqual(found,[code]);assert.equal(calls.length,2);assert.equal(calls[1].binarizer,'GlobalHistogram');
});
test('leitura existente e múltiplos códigos não são substituídos pela recuperação',async()=>{
 for(const codes of [[{text:'A'}],[{text:'A'},{text:'B'}]]){
  let count=0;assert.deepEqual(await readCodeWithRetry(async()=>{count++;return codes;},{},()=>{}),codes);assert.equal(count,1);
 }
});
test('nenhuma leitura válida continua vazia, sem inventar código',async()=>{
 assert.deepEqual(await readCodeWithRetry(async()=>[{isValid:false,text:'ruído'}],{},()=>{}),[]);
});
