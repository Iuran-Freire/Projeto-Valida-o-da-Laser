export function isMemoryError(error) {
  // ONNX Runtime on weak phones (e.g. Samsung A13) reports C++ "std::bad_alloc"
  // from OrtRun and "Aborted(OOM)" / "could not grow memory" from WebAssembly.
  return /failed to allocate|out of memory|cannot enlarge memory|could not allocate|allocation failed|bad_alloc|Aborted\(OOM\)|could not grow memory|memory limit exceeded/i.test(String(error?.message || error));
}

export function readerFailureKind(error){
 const message=String(error?.message||error);
 if(isMemoryError(error))return 'memory';
 if(/failed to fetch|networkerror|network error|fetch failed|download|HTTP (?:4|5)\d\d|status (?:4|5)\d\d/i.test(message))return 'network';
 if(/timed?\s*out|timeout|demorou a responder/i.test(message))return 'timeout';
 if(/WebAssembly.*(?:not supported|unsupported|not defined)|SIMD.*(?:not supported|unsupported)|(?:unsupported|not supported).*SIMD|Worker.*(?:not supported|unsupported)|no available backend|CompileError|not a valid WASM|ImageBitmap support/i.test(message))return 'unsupported';
 if(error?.name==='RuntimeError'||/memory access out of bounds|WebAssembly.*runtime/i.test(message))return 'runtime';
 return 'unknown';
}

const messages={memory:'memória insuficiente',unsupported:'incompatibilidade do navegador',network:'falha ao carregar o leitor',timeout:'o leitor demorou a responder',runtime:'falha no processamento',unread:'a leitura principal não identificou o texto necessário',uncertain:'baixa confiança ou leituras inconsistentes'};
// Only a device/runtime failure disables the primary reader for this page.
export function createReaderRecovery() {
  let deviceFailure=null,deviceMessage='';
  return async (primary, fallback, notify,options={}) => {
    const readingProblem=items=>options.isReadable&&!options.isReadable(items)?'unread':options.isConfident&&!options.isConfident(items)?'uncertain':null;
    let reason=deviceFailure,primaryError=deviceMessage,original=[];
    if(!reason){
      try {
        original=await primary();
        reason=readingProblem(original);
        if(!reason)return original;
      }
      catch (error) {
        primaryError=String(error?.message||error).slice(0,300);
        const kind=readerFailureKind(error);
        if(kind==='unknown')throw error;
        reason=kind;
        if(kind==='network'){
          notify('Falha ao carregar o leitor · tentando novamente…');
          try{
            original=await primary();
            reason=readingProblem(original);
            if(!reason)return original;
          }catch(retryError){
            primaryError=String(retryError?.message||retryError).slice(0,300);
            reason=readerFailureKind(retryError);
            if(reason==='unknown')throw retryError;
          }
        }
      }
    }
    if(reason==='memory'||reason==='unsupported'){deviceFailure=reason;deviceMessage=primaryError;}
    await options.beforeFallback?.();
    notify('Leitor alternativo · '+messages[reason]+' · analisando a mesma foto…');
    let alternate;
    try{alternate=await fallback({reason,attempts:original,primaryError});}
    catch(fallbackError){
      if(original.length)return original.map(item=>({...item,recoveryError:String(fallbackError?.message||fallbackError)}));
      throw new Error('Leitura principal indisponível ('+messages[reason]+'). Leitor alternativo: '+String(fallbackError?.message||fallbackError),{cause:fallbackError});
    }
    return [...original,...alternate.map(item=>({...item,readerMode:'alternative',recoveryReason:reason,...(primaryError?{primaryError}:{})}))];
  };
}

export function compatibleItems(data,offset=0) {
  const lines = (data.blocks || []).flatMap(block =>
    (block.paragraphs || []).flatMap(paragraph => paragraph.lines || []));
  return lines.filter(line => line.text?.trim()).map(line => {
    const {x0, y0, x1, y1} = line.bbox;
    return {text: line.text.trim(), score: (line.confidence || 0) / 100,
      poly: [[x0-offset,y0-offset],[x1-offset,y0-offset],[x1-offset,y1-offset],[x0-offset,y1-offset]]};
  });
}
