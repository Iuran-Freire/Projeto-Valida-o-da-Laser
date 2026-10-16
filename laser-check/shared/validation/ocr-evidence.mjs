// Compare whole photographed candidates. Never assemble or substitute glyphs.
export function compareOCREvidence(a,b){
 return (b.serialGlyphConfidence||0)-(a.serialGlyphConfidence||0)||
  (b.selectionSupport||0)-(a.selectionSupport||0);
}
