import {test} from 'node:test';
import assert from 'node:assert/strict';
import {printedRowBands} from '../frontend/src/ocr/line-bands.mjs';
test('mantém a altura das letras e separa linhas vizinhas',()=>{
 const w=180,h=80,pixels=new Uint8ClampedArray(w*h*4);
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const printed=((y>=8&&y<=27&&!(y>=15&&y<=19))||(y>=45&&y<=70&&!(y>=54&&y<=59)))&&x>=15&&x<=165&&x%7<4;
  const p=(y*w+x)*4;pixels[p]=pixels[p+1]=pixels[p+2]=printed?240:30;pixels[p+3]=255;
 }
 const bands=printedRowBands(pixels,w,h);
 assert.equal(bands.length,2);assert.ok(bands[0].y<=45&&bands[0].y+bands[0].h>=71);
 assert.ok(bands[1].y<=8&&bands[1].y+bands[1].h>=28);
});
test('não inventa linha numa imagem vazia ou uniforme',()=>{
 assert.deepEqual(printedRowBands(new Uint8Array(100*50*4),100,50),[]);
 assert.deepEqual(printedRowBands(new Uint8Array(0),0,0),[]);
});
