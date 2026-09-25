import {build} from 'esbuild';
import {mkdir,copyFile,readdir,writeFile,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
await mkdir('dist/vendor',{recursive:true});
await build({entryPoints:['src/app.mjs'],bundle:true,format:'esm',platform:'browser',target:['es2022'],outfile:'dist/app.js',minify:true,legalComments:'eof',external:['fs','path','crypto','module']});
await copyFile('node_modules/zxing-wasm/dist/reader/zxing_reader.wasm','dist/vendor/zxing_reader.wasm');
await copyFile('node_modules/tesseract.js/dist/worker.min.js','dist/vendor/worker.min.js');
for(const file of await readdir('node_modules/tesseract.js-core'))if(file.endsWith('.wasm.js'))await copyFile('node_modules/tesseract.js-core/'+file,'dist/vendor/'+file);
await copyFile('node_modules/@tesseract.js-data/eng/4.0.0/eng.traineddata.gz','dist/vendor/eng.traineddata.gz');
async function walk(dir){let result=[];for(const item of await readdir(dir,{withFileTypes:true})){const p=dir+'/'+item.name;if(item.isDirectory())result.push(...await walk(p));else if(!p.endsWith('/sw.js'))result.push(p);}return result;}
await mkdir('dist/assets',{recursive:true});
for(const file of await readdir('node_modules/@paddleocr/paddleocr-js/dist/assets'))if(file.endsWith('.js'))await copyFile('node_modules/@paddleocr/paddleocr-js/dist/assets/'+file,'dist/assets/'+file);
for(const file of ['ort-wasm-simd-threaded.jsep.mjs','ort-wasm-simd-threaded.jsep.wasm'])await copyFile('node_modules/onnxruntime-web/dist/'+file,'dist/vendor/paddle/'+file);
const files=await walk('dist');const hash=createHash('sha256');for(const file of files)hash.update(await readFile(file));const version='valida-laser-'+hash.digest('hex').slice(0,12);const assets=['./',...files.map(f=>'./'+f.slice(5))];
await writeFile('dist/sw.js',`const CACHE=${JSON.stringify(version)};const ASSETS=${JSON.stringify(assets)};self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS))));self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('valida-laser-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));self.addEventListener('fetch',event=>{if(event.request.method!=='GET'||new URL(event.request.url).origin!==self.location.origin)return;event.respondWith(caches.open(CACHE).then(async cache=>{const cached=await cache.match(event.request);if(cached)return cached;return fetch(event.request);}));});`);
console.log('Aplicativo e leitores empacotados. Cache offline: '+version);
