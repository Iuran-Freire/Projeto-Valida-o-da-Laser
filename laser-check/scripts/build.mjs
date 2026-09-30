import {build} from 'esbuild';
import {mkdir, cp, copyFile, readdir, writeFile, readFile, unlink} from 'node:fs/promises';
import {createHash} from 'node:crypto';

const output='frontend/dist';
const appAsset='app-fixed-contrast.js';
const styles={'base.css':'base.css','theme.css':'theme.css','components/serial-positions.css':'serial-positions.css'};

await mkdir(`${output}/vendor/paddle`,{recursive:true});
await mkdir(`${output}/assets`,{recursive:true});
await cp('frontend/public',output,{recursive:true});
await mkdir(`${output}/styles`,{recursive:true});
for(const [source,target] of Object.entries(styles))await copyFile(`frontend/src/styles/${source}`,`${output}/styles/${target}`);
// Remove only obsolete generated assets whose sources now have dedicated folders.
for(const file of ['brand.css','brand-lg-label.css','style.css','positions-v1.css','positions-v2.css','icon.svg','icon-192.png','icon-512.png','inventus-power-logo.svg'])await unlink(`${output}/${file}`).catch(error=>{if(error.code!=='ENOENT')throw error;});
for(const file of await readdir(output))if(/^app-.*\.js$/.test(file)&&file!==appAsset)await unlink(`${output}/${file}`);

await build({entryPoints:['frontend/src/app.mjs'],bundle:true,format:'esm',platform:'browser',target:['es2022'],outfile:`${output}/${appAsset}`,minify:true,legalComments:'eof',external:['fs','path','crypto','module']});

await copyFile('node_modules/zxing-wasm/dist/reader/zxing_reader.wasm',`${output}/vendor/zxing_reader.wasm`);
await copyFile('node_modules/tesseract.js/dist/worker.min.js',`${output}/vendor/worker.min.js`);
for(const file of await readdir('node_modules/tesseract.js-core'))if(file.endsWith('.wasm.js'))await copyFile(`node_modules/tesseract.js-core/${file}`,`${output}/vendor/${file}`);
await copyFile('node_modules/@tesseract.js-data/eng/4.0.0/eng.traineddata.gz',`${output}/vendor/eng.traineddata.gz`);
for(const file of await readdir('node_modules/@paddleocr/paddleocr-js/dist/assets'))if(file.endsWith('.js'))await copyFile(`node_modules/@paddleocr/paddleocr-js/dist/assets/${file}`,`${output}/assets/${file}`);
for(const file of ['ort-wasm-simd-threaded.jsep.mjs','ort-wasm-simd-threaded.jsep.wasm'])await copyFile(`node_modules/onnxruntime-web/dist/${file}`,`${output}/vendor/paddle/${file}`);

async function walk(dir){
  const result=[];
  for(const item of await readdir(dir,{withFileTypes:true})){
    const path=`${dir}/${item.name}`;
    if(item.isDirectory())result.push(...await walk(path));
    else if(!path.endsWith('/sw.js'))result.push(path);
  }
  return result;
}
const files=await walk(output);
const hash=createHash('sha256');
for(const file of files)hash.update(await readFile(file));
const version=`valida-laser-${hash.digest('hex').slice(0,12)}`;
const assets=['./',...files.map(file=>`./${file.slice(output.length+1)}`)];
const core=assets.filter(path=>!path.startsWith('./vendor/')&&!path.startsWith('./assets/')&&path!=='./app.js'&&path!=='./brand.css');
const freshAssetPattern=/\/(app-fixed-contrast\.js|styles\/(base|theme|serial-positions)\.css)$/;
await writeFile(`${output}/sw.js`,`const CACHE=${JSON.stringify(version)};const CORE=${JSON.stringify(core)};self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(CORE)).then(()=>self.skipWaiting())));self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('valida-laser-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));self.addEventListener('fetch',event=>{if(event.request.method!=='GET'||new URL(event.request.url).origin!==self.location.origin||new URL(event.request.url).pathname.startsWith('/api/'))return;if(event.request.mode==='navigate'){event.respondWith(fetch(event.request).catch(()=>caches.match('./index.html')));return;}event.respondWith(caches.open(CACHE).then(async cache=>{const freshAsset=${freshAssetPattern};if(freshAsset.test(new URL(event.request.url).pathname)){try{const response=await fetch(event.request);if(response.ok)event.waitUntil(cache.put(event.request,response.clone()));return response;}catch{return await cache.match(event.request,{ignoreSearch:true})||Response.error();}}const cached=await cache.match(event.request,{ignoreSearch:true});if(cached)return cached;const response=await fetch(event.request);if(response.ok)event.waitUntil(cache.put(event.request,response.clone()));return response;}));});`);
console.log(`Aplicativo e leitores empacotados. Cache offline: ${version}`);
