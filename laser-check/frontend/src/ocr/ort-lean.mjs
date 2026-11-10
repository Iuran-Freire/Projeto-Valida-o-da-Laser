// Used only inside the main reader's worker (wired in scripts/build.mjs).
// Same PaddleOCR models and results, with less memory for weak phones:
// - the CPU-only ONNX Runtime build (the app never uses WebGPU), which is
//   about half the size of the default WebGPU-capable build;
// - sessions without a memory arena or preallocated memory pattern, so
//   memory is returned after each reading instead of being kept at its peak.
import * as ort from 'onnxruntime-web/wasm';
export * from 'onnxruntime-web/wasm';

export const LEAN_SESSION_OPTIONS=Object.freeze({enableCpuMemArena:false,enableMemPattern:false});
const create=ort.InferenceSession.create.bind(ort.InferenceSession);
// create(model, options) gets the lean options; the (buffer, offset, length, options) form is passed through.
ort.InferenceSession.create=(model,...rest)=>typeof rest[0]==='number'?create(model,...rest):create(model,{...LEAN_SESSION_OPTIONS,...(rest[0]||{})});
