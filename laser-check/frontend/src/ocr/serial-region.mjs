import {extractPrint} from '../../../shared/validation/compare.mjs';

// Locate text from the photograph only; barcode contents never guide the crop.
export function serialRegion(attempt,region,inputWidth,source,options={}) {
 const lines=attempt.lines || [];
 const candidates=lines.filter(item=>options.extractSerial?options.extractSerial(item.text):extractPrint(item.text).serial);
 const labelled=options.wholeLine?lines.filter(item=>/N[ÚUÜO]MERO\s*DE\s*S[ÉE]RIE|\bS\/?N\s*[:=]/i.test(item.text)):[];
 const line=candidates.length===1?candidates[0]:candidates.length===0&&labelled.length===1?labelled[0]:null;
 const poly=line?.poly;
 if(!Array.isArray(poly)||poly.length<4)return null;
 const xs=poly.map(point=>point[0]),ys=poly.map(point=>point[1]);
 if([...xs,...ys].some(value=>!Number.isFinite(value))||region.w<=0||inputWidth<=0)return null;
 const scale=inputWidth/region.w,left=Math.min(...xs),right=Math.max(...xs),top=Math.min(...ys),bottom=Math.max(...ys);
 if(right<=left||bottom<=top)return null;
 const x=Math.max(0,Math.floor(region.x+(left+(right-left)*(options.extractSerial||options.wholeLine?0:.38))/scale-8));
 const y=Math.max(0,Math.floor(region.y+top/scale-8));
 const w=Math.min(source.width-x,Math.ceil(region.x+right/scale+12-x));
 const h=Math.min(source.height-y,Math.ceil(region.y+bottom/scale+8-y));
 return w>40&&h>8?{x,y,w,h}:null;
}
