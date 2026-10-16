import {test} from 'node:test';
import assert from 'node:assert/strict';
import {serialTensor,decodeSerial} from '../frontend/src/ocr/serial-recognition.mjs';
import {refinementRegions} from '../frontend/src/ocr/light-serial-reader.mjs';
test('entrada usa BGR normalizado, mantém proporção e limita a memória',()=>{
 const pixels=new Uint8ClampedArray(2*48*4);pixels.set([255,127.5,0,255]);
 const {data,dims}=serialTensor(pixels,2,48);
 assert.deepEqual(dims,[1,3,48,320]);assert.equal(data[0],-1);assert.equal(data[2*48*320],1);
 assert.equal(data[2],0);
 assert.throws(()=>serialTensor(new Uint8Array(10),2,48),/inválido/);
 assert.throws(()=>serialTensor(new Uint8Array(1601*48*4),1601,48),/inválido/);
});
test('decodificação CTC preserva I/1, S/5 e letras repetidas separadas por branco',()=>{
 const dictionary=['I','1','S','5'];
 const sequence=[1,1,0,1,2,3,4,0,4],classes=5;
 const data=new Float32Array(sequence.length*classes);
 sequence.forEach((value,index)=>data[index*classes+value]=.95);
 const result=decodeSerial(data,[1,sequence.length,classes],dictionary);
 assert.equal(result.text,'II1S55');assert.ok(result.score>.94);
 assert.throws(()=>decodeSerial(data,[1,sequence.length,6],dictionary),/incompatível/);
});
test('recorte da foto real é calculado pela linha localizada, sem conteúdo do 2D',()=>{
 const attempt={region:{x:167,y:1351,w:1143,h:123},inputWidth:1200,
  lines:[{text:'NUMERO DE SERIE : R37L8TGFMS TPA:',poly:[[101,75],[889,75],[889,124],[101,124]]}]};
 assert.deepEqual(refinementRegions([attempt,attempt],{width:1530,height:2040}),[{x:255,y:1414,w:771,h:64}]);
});
test('confiança por caractere detecta competição I/1 e S/5 sem substituir o vencedor',()=>{
 const dictionary=['I','1','S','5'],data=new Float32Array([
  0,.51,.48,0,0,
  0,.95,.03,0,0,
  1,0,0,0,0,
  0,0,0,.52,.47,
  1,0,0,0,0,
  0,0,0,.01,.98,
 ]);
 const result=decodeSerial(data,[1,6,5],dictionary);
 assert.equal(result.text,'IS5');
 assert.equal(result.glyphs[0].uncertain,false,'a evidência mais forte do mesmo caractere é usada');
 assert.equal(result.glyphs[1].uncertain,true);
 assert.equal(result.glyphs[1].alternative,'5');
 assert.equal(result.glyphs[2].uncertain,false);
 assert.equal(result.glyphs[1].index,1);
});
