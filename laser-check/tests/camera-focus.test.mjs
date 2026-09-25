import {test} from 'node:test';
import assert from 'node:assert/strict';
import {enableContinuousFocus,refocusCamera,sharpnessScore} from '../src/camera-focus.mjs';

test('foco contínuo e toque preservam a resolução solicitada',async()=>{
  const calls=[];
  const track={readyState:'live',getCapabilities:()=>({focusMode:['continuous'],pointsOfInterest:true}),getConstraints:()=>({width:{ideal:3840},height:{ideal:2160}}),applyConstraints:async value=>calls.push(value)};
  assert.equal(await enableContinuousFocus(track),true);
  assert.equal(await refocusCamera(track,{x:.3,y:.7}),true);
  assert.deepEqual(calls[0],{width:{ideal:3840},height:{ideal:2160},advanced:[{focusMode:'continuous'}]});
  assert.deepEqual(calls[1].advanced,[{pointsOfInterest:[{x:.3,y:.7}],focusMode:'continuous'}]);
});

test('quadro com bordas nítidas recebe pontuação maior que quadro plano',()=>{
  const width=32,height=32,flat=new Uint8ClampedArray(width*height*4),edges=new Uint8ClampedArray(width*height*4);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){const index=(y*width+x)*4;flat.fill(128,index,index+3);edges.fill(x%4<2?0:255,index,index+3);}
  assert.ok(sharpnessScore(edges,width,height)>sharpnessScore(flat,width,height));
});
