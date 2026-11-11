import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {jpegOrientation,missingOrientation,orientationTransform} from '../frontend/src/capture/photo-orientation.mjs';

// Minimal JPEG header: SOI, optional APP1/Exif with Orientation, SOF0 with the stored size.
function jpegHeader({orientation,width,height,little=false,extraApp=false}){
 const bytes=[0xFF,0xD8];
 if(extraApp)bytes.push(0xFF,0xE0,0x00,0x10,...Array(14).fill(0)); // APP0/JFIF before EXIF
 if(orientation){
  const u16=v=>little?[v&255,v>>8]:[v>>8,v&255],u32=v=>little?[v&255,(v>>8)&255,(v>>16)&255,v>>>24]:[v>>>24,(v>>16)&255,(v>>8)&255,v&255];
  const tiff=[...(little?[0x49,0x49]:[0x4D,0x4D]),...u16(42),...u32(8),...u16(2),
   ...u16(0x010F),...u16(2),...u32(4),...[65,112,112,0],            // Make = "App"
   ...u16(0x0112),...u16(3),...u32(1),...u16(orientation),0,0,      // Orientation
   ...u32(0)];
  const app1=[0x45,0x78,0x69,0x66,0,0,...tiff];
  bytes.push(0xFF,0xE1,(app1.length+2)>>8,(app1.length+2)&255,...app1);
 }
 bytes.push(0xFF,0xC0,0x00,0x11,8,height>>8,height&255,width>>8,width&255,3,...Array(9).fill(0));
 bytes.push(0xFF,0xDA,0x00,0x08,...Array(6).fill(0));
 return new Uint8Array(bytes).buffer;
}

test('lê a rotação EXIF e o tamanho gravado de uma foto de iPhone',()=>{
 assert.deepEqual(jpegOrientation(jpegHeader({orientation:6,width:4032,height:3024})),{orientation:6,width:4032,height:3024});
 assert.deepEqual(jpegOrientation(jpegHeader({orientation:8,width:4032,height:3024,little:true,extraApp:true})),{orientation:8,width:4032,height:3024});
 assert.deepEqual(jpegOrientation(jpegHeader({width:1920,height:2560})),{orientation:1,width:1920,height:2560});
 assert.equal(jpegOrientation(new Uint8Array([0x89,0x50,0x4E,0x47]).buffer),null); // PNG
 assert.equal(jpegOrientation(new ArrayBuffer(0)),null);
});

test('JPEG real gravado como no iPhone (pixels deitados + EXIF 6)',()=>{
 const bytes=readFileSync(new URL('./fixtures/iphone-exif6.jpg',import.meta.url));
 const info=jpegOrientation(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength));
 assert.deepEqual(info,{orientation:6,width:64,height:48});
 assert.equal(missingOrientation(info,64,48),6);assert.equal(missingOrientation(info,48,64),1);
});

test('só gira quando o navegador não girou (sem risco de girar duas vezes)',()=>{
 const stored={orientation:6,width:4032,height:3024};
 assert.equal(missingOrientation(stored,4032,3024),6);   // decoded lying down: turn it
 assert.equal(missingOrientation(stored,3024,4032),1);   // browser already turned it
 assert.equal(missingOrientation({orientation:3,width:4032,height:3024},4032,3024),1); // 180°: not a quarter turn
 assert.equal(missingOrientation({orientation:1,width:4032,height:3024},4032,3024),1);
 assert.equal(missingOrientation(null,4032,3024),1);
 assert.equal(missingOrientation({orientation:6,width:3000,height:3000},3000,3000),1); // square: cannot tell
});

test('a transformação põe cada canto da foto gravada no lugar certo',()=>{
 const W=40,H=30,apply=([a,b,c,d,e,f],[x,y])=>[a*x+c*y+e,b*x+d*y+f];
 // Stored corners (top-left, top-right, bottom-left) and where they must end up.
 const expected={
  5:{tl:[0,0],tr:[0,W],bl:[H,0]},   // transpose
  6:{tl:[H,0],tr:[H,W],bl:[0,0]},   // 90° clockwise
  7:{tl:[H,W],tr:[H,0],bl:[0,W]},   // transverse
  8:{tl:[0,W],tr:[0,0],bl:[H,W]},   // 90° counter-clockwise
 };
 for(const [orientation,corners] of Object.entries(expected)){
  const t=orientationTransform(Number(orientation),W,H);
  assert.deepEqual([t.width,t.height],[H,W],orientation);
  assert.deepEqual(apply(t.matrix,[0,0]),corners.tl,orientation+' tl');
  assert.deepEqual(apply(t.matrix,[W,0]),corners.tr,orientation+' tr');
  assert.deepEqual(apply(t.matrix,[0,H]),corners.bl,orientation+' bl');
 }
 assert.deepEqual(orientationTransform(1,W,H),{matrix:[1,0,0,1,0,0],width:W,height:H});
});
