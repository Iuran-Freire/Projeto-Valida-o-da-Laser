import {test} from 'node:test';
import assert from 'node:assert/strict';
import {diagnosticRegion,readingDiagnostic} from '../frontend/src/ocr/reading-diagnostic.mjs';

test('diagnóstico conserva a região original e respeita os limites da foto',()=>{
 assert.deepEqual(diagnosticRegion([{region:{x:148,y:1323,w:720,h:77}}],1080,2408),{x:148,y:1323,w:720,h:77});
 assert.deepEqual(diagnosticRegion([{region:{x:-10,y:-5,w:100,h:50}}],80,40),{x:0,y:0,w:80,h:40});
 assert.equal(diagnosticRegion([{region:{x:Infinity,y:0,w:1,h:1}}],80,40),null);
 assert.equal(diagnosticRegion([{region:{x:100,y:0,w:1,h:1}}],80,40),null);
});

test('exportação conserva todas as tentativas e erros, sem corrigir os caracteres',()=>{
 const attempts=[{text:'RITLOTGEMSTIPA',model:'PP-OCRv5_mobile_rec',confidence:34},{text:'R37L8TGFM51IPA',model:'en_PP-OCRv5_mobile_rec',confidence:96,recoveryReason:'uncertain'}];
 const data=readingDiagnostic({model:'type-c-m09031d',build:'app-abc.js',captureSource:'câmera do celular',code:'GH44-03247A+R37L8TGFM51IPA',printed:attempts[0].text,attempts,photo:{width:1080,height:2408},crop:null,environment:{userAgent:'Android A13'},message:'Conferir'});
 const restored=JSON.parse(JSON.stringify(data));
 assert.equal(restored.schema,'valida-laser-ocr/1');assert.deepEqual(restored.attempts,attempts);
 assert.equal(restored.printed,'RITLOTGEMSTIPA');assert.equal(restored.environment.userAgent,'Android A13');
 assert.equal(restored.build,'app-abc.js');
});
