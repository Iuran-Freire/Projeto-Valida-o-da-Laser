import {test} from 'node:test';
import assert from 'node:assert/strict';
import {printedRowBands} from '../frontend/src/ocr/line-bands.mjs';
import {readFile} from 'node:fs/promises';
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
test('mesma localização funciona em impressão clara e em etiqueta branca',()=>{
 const width=200,height=60,dark=new Uint8Array(width*height*4),light=new Uint8Array(width*height*4);
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const value=y>=20&&y<=40&&x>=20&&x<=180&&x%6<3?230:30,p=(y*width+x)*4;
  for(let c=0;c<3;c++){dark[p+c]=value;light[p+c]=255-value;}
  dark[p+3]=light[p+3]=255;
 }
 const first=printedRowBands(dark,width,height,{lightOnDark:true});
 assert.equal(first.length,1);
 assert.deepEqual(printedRowBands(light,width,height,{lightOnDark:false}),first);
});
test('captura real A13: separa fabricante e série mesmo com intervalo estreito',async()=>{
 const pixels=await readFile(new URL('./fixtures/a13-close-lines.rgba',import.meta.url));
 const bands=printedRowBands(pixels,500,80,{lightOnDark:true,limit:12});
 assert.equal(bands.length,2);
 assert.ok(bands[0].y>=24&&bands[0].h<=28,'a série deve ser uma linha isolada');
 assert.ok(bands[0].y+bands[0].h>=48,'não recorta a base dos caracteres');
 assert.ok(bands[0].w>=350,'preserva rótulo e todos os caracteres da série');
});
test('15W VE branco (foto real): impressão escura localiza a linha da série',async()=>{
 const info=JSON.parse(await readFile(new URL('./fixtures/15w-ve-white-region.json',import.meta.url),'utf8'));
 const gray=await readFile(new URL('./fixtures/15w-ve-white-region.gray',import.meta.url));
 const {width,height}=info,pixels=new Uint8ClampedArray(width*height*4);
 for(let p=0;p<width*height;p++){pixels[p*4]=pixels[p*4+1]=pixels[p*4+2]=gray[p];pixels[p*4+3]=255;}
 const [top,bottom]=info.serialLine.y,[left,right]=info.serialLine.x;
 const coversSerial=band=>band.y<=top+4&&band.y+band.h>=bottom-4&&band.x<=left+8&&band.x+band.w>=right;
 assert.ok(printedRowBands(pixels,width,height,{lightOnDark:false,limit:10}).some(coversSerial));
 // Treating this white charger as light-on-dark finds only blank plastic.
 assert.equal(printedRowBands(pixels,width,height,{lightOnDark:true,limit:10}).some(coversSerial),false);
});
