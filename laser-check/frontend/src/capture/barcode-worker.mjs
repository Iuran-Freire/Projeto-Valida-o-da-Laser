// Reads the 2D code in a short-lived worker. After a full photo the reader's
// WebAssembly memory stays at tens of MB; terminating the worker returns it to
// the phone (important on weak devices such as the Samsung A13).
import {readBarcodes,prepareZXingModule} from 'zxing-wasm/reader';
let prepared=false;
self.onmessage=async({data})=>{
 try{
  if(!prepared){prepareZXingModule({overrides:{locateFile:path=>path.endsWith('.wasm')?data.wasmUrl:path}});prepared=true;}
  const codes=await readBarcodes(new ImageData(new Uint8ClampedArray(data.pixels),data.width,data.height),data.options);
  self.postMessage({ok:true,codes});
 }catch(error){self.postMessage({ok:false,error:String(error?.message||error)});}
};
