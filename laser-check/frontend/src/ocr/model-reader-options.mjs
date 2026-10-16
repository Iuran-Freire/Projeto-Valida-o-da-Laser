import {extractPrint} from '../../../shared/validation/compare.mjs';
import {extractOPPOPrinted} from '../../../shared/models/oppo-45w.mjs';
import {extractFrecomPrinted} from '../../../shared/models/frecom-24w.mjs';
import {extractFrecomDMPrinted} from '../../../shared/models/frecom-dm-24w.mjs';
import {extractLGPSUPrinted} from '../../../shared/models/lg-psu-28w.mjs';
import {parseLGPrinted} from '../../../shared/models/lg-label.mjs';
import {parseA08Print} from '../../../shared/models/a08-battery.mjs';
import {confidentPrintedReadings} from './reading-quality.mjs';

// Product formats decide whether text is usable; they never choose the engine.
export function modelReaderOptions(model){
 const samsung=['type-c','type-c-m09031d','15w-ve'].includes(model);
 let extractSerial=text=>extractPrint(text).serial;
 if(model==='oppo-45w')extractSerial=extractOPPOPrinted;
 else if(model==='frecom-24w')extractSerial=extractFrecomPrinted;
 else if(model==='frecom-dm-24w')extractSerial=extractFrecomDMPrinted;
 else if(model==='lg-psu-28w')extractSerial=extractLGPSUPrinted;
 else if(['lg-24w','lg-32w'].includes(model))extractSerial=text=>parseLGPrinted(text).valid?text:null;
 else if(['a08-battery','a08-battery-62'].includes(model))extractSerial=text=>{const parsed=parseA08Print(text);return parsed.date&&parsed.printCode?text:null;};
 const readingParts=['lg-24w','lg-32w'].includes(model)?text=>{const parsed=parseLGPrinted(text);return parsed.valid?[parsed.partNo]:[];}:
  ['a08-battery','a08-battery-62'].includes(model)?text=>{const parsed=parseA08Print(text);return [parsed.date,parsed.printCode].filter(Boolean);}:text=>{const serial=extractSerial(text);return serial?[serial]:[];};
 return {extractSerial,allowUnlabelledSerial:samsung,lightOnDark:samsung,
  isConfident:attempts=>confidentPrintedReadings(attempts,{extractSerial,readingParts,minConfidence:samsung||['lg-24w','lg-32w'].includes(model)?80:70}),
  isReadable:attempts=>attempts.some(item=>!!extractSerial(item.fullText||item.text||''))};
}
