// A candidate comes only from printed pixels, never from the Data Matrix.
// Preserve every character, including I/1 and S/5 differences.
export function samsungSerialCandidate(text) {
 const tokens=[];
 for(const line of String(text).split(/\r?\n/)){
  const labelled=line.match(/(?:N[ÚUÜO]MERO\s*DE\s*S[ÉE]RIE|S\/?N)\s*[:=]?\s*(R37[A-Za-z0-9 \t]*)[^A-Za-z0-9]*$/i);
  const compact=labelled?.[1].replace(/[ \t]/g,'');
  if(compact&&/^R37[A-Za-z0-9]{11}$/.test(compact))tokens.push(compact);
  else tokens.push(...[...line.matchAll(/(?:^|[^A-Za-z0-9+])(R37[A-Za-z0-9]{11})(?=$|[^A-Za-z0-9])/g)].map(match=>match[1]));
 }
 return tokens.length&&new Set(tokens).size===1?tokens[0]:null;
}

export function samsungSerialSample(attempt) {
 if(!samsungSerialCandidate(attempt.lines.map(line=>line.text).join('\n')))return attempt;
 const candidates=attempt.lines.map(line=>({line,serial:samsungSerialCandidate(line.text)})).filter(item=>item.serial);
 if(!candidates.length||new Set(candidates.map(item=>item.serial)).size!==1)return attempt;
 const best=candidates.reduce((a,b)=>a.line.confidence>=b.line.confidence?a:b);
 return {...attempt,rawText:attempt.fullText,text:'NÚMERO DE SÉRIE: '+best.serial,
  confidence:best.line.confidence,serialLabelInferred:true,forceManualReview:true};
}
